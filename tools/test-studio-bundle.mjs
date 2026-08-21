import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { gunzipSync } from 'node:zlib';
import { createStudioBundle, StudioBundleError } from './studio-bundle.mjs';

const DEFAULT_MANIFEST = {
  manifestVersion: '1.0.0',
  projectId: 'brief-harbour-run',
  name: 'Harbour Run',
  objective: 'A small arcade game with a clear goal that I can play immediately and keep as a verified local starter.',
  targetPlatforms: ['web'],
  starter: {
    mechanic: 'collect',
    requestedTargetPlatform: 'mobile',
    executedTargetPlatform: 'web',
    targetExecutionStatus: 'requested-not-executed'
  }
};

async function withWorkspace(callback) {
  const root = await mkdtemp(resolve(tmpdir(), 'byjtt-studio-bundle-test-'));
  try {
    const projectDir = resolve(root, 'project');
    const outputDir = resolve(root, 'evidence');
    await mkdir(resolve(projectDir, 'dist'), { recursive: true });
    await mkdir(outputDir, { recursive: true });
    await writeFile(resolve(projectDir, 'project.manifest.json'), `${JSON.stringify(DEFAULT_MANIFEST, null, 2)}\n`);
    return await callback({ root, projectDir, outputDir });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function hashArtifact(path) {
  const root = resolve(path);
  const rootStat = await lstat(root);
  const hash = createHash('sha256');
  async function visit(current, relativePath) {
    const stat = await lstat(current);
    if (stat.isDirectory()) {
      hash.update(`directory\0${relativePath}\0`);
      const names = (await readdir(current)).sort((a, b) => Buffer.from(a).compare(Buffer.from(b)));
      for (const name of names) await visit(resolve(current, name), relativePath ? `${relativePath}/${name}` : name);
      return;
    }
    if (stat.isFile()) {
      const body = await readFile(current);
      hash.update(`file\0${relativePath}\0${stat.size}\0`);
      hash.update(body);
      return;
    }
    throw new Error(`unsupported fixture artifact entry: ${current}`);
  }
  await visit(root, rootStat.isDirectory() ? '' : 'artifact');
  return `sha256:${hash.digest('hex')}`;
}

async function writePassingEvidence(projectDir, outputDir, overrides = {}) {
  const artifactSha256 = await hashArtifact(resolve(projectDir, 'dist'));
  const records = {
    'build-result.json': { executed: true, status: 'pass', artifactPath: 'dist', artifactSha256 },
    'qa-result.json': { executed: true, status: 'pass', artifactPath: 'dist', artifactSha256 },
    'release-candidate.json': { dryRunOnly: true, build: { artifactPath: 'dist', outputSha256: artifactSha256 } },
    'publishing-receipt.json': { executed: false, secretsUsed: false, destination: { kind: 'local', target: 'local://release-candidate' } },
    ...overrides
  };
  for (const [filename, value] of Object.entries(records)) await writeFile(resolve(outputDir, filename), `${JSON.stringify(value)}\n`);
  return artifactSha256;
}

function readTarEntries(bytes) {
  const tar = gunzipSync(bytes);
  const entries = new Map();
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '');
    const sizeText = header.subarray(124, 136).toString('ascii').replace(/\0.*$/, '').trim();
    const size = Number.parseInt(sizeText || '0', 8);
    assert(Number.isSafeInteger(size) && size >= 0, `invalid TAR size for ${name}`);
    const bodyStart = offset + 512;
    entries.set(name, tar.subarray(bodyStart, bodyStart + size));
    offset = bodyStart + Math.ceil(size / 512) * 512;
  }
  return entries;
}

test('creates a bounded gzip tar with zero-terminal starter, portable brief, and artifact-bound verification', async () => {
  await withWorkspace(async ({ projectDir, outputDir }) => {
    await writeFile(resolve(projectDir, 'dist', 'index.html'), '<h1>Harbour Run</h1>\n');
    const artifactSha256 = await writePassingEvidence(projectDir, outputDir);
    const bundle = await createStudioBundle({ projectDir, outputDir, projectId: 'brief-harbour-run' });
    assert.equal(bundle.contentType, 'application/gzip');
    assert.equal(bundle.filename, 'brief-harbour-run-verified-local-starter.tar.gz');
    assert.match(bundle.sha256, /^sha256:[a-f0-9]{64}$/);
    assert.equal(bundle.fileCount, 10);
    const entries = readTarEntries(bundle.bytes);
    assert.equal(entries.has('START_HERE.html'), true);
    assert.equal(entries.has('PROJECT_BRIEF.html'), true);
    assert.equal(entries.has('VERIFICATION.html'), true);
    assert.equal(entries.has('VERIFICATION.txt'), true);
    assert.equal(entries.has('starter/project.manifest.json'), true);
    assert.equal(entries.has('starter/dist/index.html'), true);
    const briefPage = entries.get('PROJECT_BRIEF.html').toString('utf8');
    assert.match(briefPage, /Harbour Run/);
    assert.match(briefPage, /A small arcade game/);
    assert.match(briefPage, /collect/);
    assert.match(briefPage, /mobile requested · web executed locally/);
    assert.match(briefPage, /START_HERE\.html/);
    assert.match(briefPage, /VERIFICATION\.html/);
    assert.match(briefPage, /Content-Security-Policy/);
    assert.doesNotMatch(briefPage, /<script/i);
    assert.doesNotMatch(briefPage, /https?:\/\//i);
    assert.doesNotMatch(briefPage, /javascript:/i);
    const verification = entries.get('VERIFICATION.txt').toString('utf8');
    assert.match(verification, /Build executed: true/);
    assert.match(verification, /QA status: pass/);
    assert.match(verification, new RegExp(`Bundled artifact SHA-256: ${artifactSha256}`));
    assert.match(verification, /Publication executed: false/);
    assert.match(verification, /Secrets used: false/);
    assert.equal(entries.get('starter/dist/index.html').toString('utf8'), '<h1>Harbour Run</h1>\n');
  });
});

test('fails closed when the artifact changes after build and QA evidence was recorded', async () => {
  await withWorkspace(async ({ projectDir, outputDir }) => {
    await writeFile(resolve(projectDir, 'dist', 'index.html'), '<h1>Certified bytes</h1>\n');
    await writePassingEvidence(projectDir, outputDir);
    await writeFile(resolve(projectDir, 'dist', 'index.html'), '<h1>Mutated after QA</h1>\n');
    await assert.rejects(createStudioBundle({ projectDir, outputDir, projectId: 'mutated-after-qa' }), (error) => error instanceof StudioBundleError && error.code === 'EVIDENCE_INCOMPLETE' && /no longer match/.test(error.message));
  });
});

test('fails closed when build, QA, and release evidence disagree on the artifact digest', async () => {
  await withWorkspace(async ({ projectDir, outputDir }) => {
    await writeFile(resolve(projectDir, 'dist', 'index.html'), '<h1>Digest disagreement</h1>\n');
    const artifactSha256 = await hashArtifact(resolve(projectDir, 'dist'));
    await writePassingEvidence(projectDir, outputDir, {
      'qa-result.json': { executed: true, status: 'pass', artifactPath: 'dist', artifactSha256: 'sha256:' + '2'.repeat(64) },
      'release-candidate.json': { dryRunOnly: true, build: { artifactPath: 'dist', outputSha256: artifactSha256 } }
    });
    await assert.rejects(createStudioBundle({ projectDir, outputDir, projectId: 'digest-disagreement' }), (error) => error instanceof StudioBundleError && error.code === 'EVIDENCE_INCOMPLETE');
  });
});

test('fails closed instead of exporting a launcher without the verified playable artifact', async () => {
  await withWorkspace(async ({ projectDir, outputDir }) => {
    await writePassingEvidence(projectDir, outputDir);
    await assert.rejects(createStudioBundle({ projectDir, outputDir, projectId: 'missing-playable' }), (error) => error instanceof StudioBundleError && error.code === 'PLAYABLE_MISSING');
  });
});

test('fails closed when portable verification evidence is missing', async () => {
  await withWorkspace(async ({ projectDir, outputDir }) => {
    await writeFile(resolve(projectDir, 'dist', 'index.html'), '<h1>Missing QA</h1>\n');
    await writePassingEvidence(projectDir, outputDir);
    await rm(resolve(outputDir, 'qa-result.json'));
    await assert.rejects(createStudioBundle({ projectDir, outputDir, projectId: 'missing-evidence' }), (error) => error instanceof StudioBundleError && error.code === 'EVIDENCE_INCOMPLETE');
  });
});

test('fails closed instead of summarizing a false publication or secret-backed result', async () => {
  await withWorkspace(async ({ projectDir, outputDir }) => {
    await writeFile(resolve(projectDir, 'dist', 'index.html'), '<h1>Unsafe</h1>\n');
    await writePassingEvidence(projectDir, outputDir, {
      'publishing-receipt.json': { executed: true, secretsUsed: true, destination: { kind: 'remote', target: 'https://example.invalid' } }
    });
    await assert.rejects(createStudioBundle({ projectDir, outputDir, projectId: 'unsafe-evidence' }), (error) => error instanceof StudioBundleError && error.code === 'EVIDENCE_INCOMPLETE');
  });
});

test('fails closed when project brief tries to smuggle markup or an unsupported target', async () => {
  await withWorkspace(async ({ projectDir, outputDir }) => {
    await writeFile(resolve(projectDir, 'dist', 'index.html'), '<h1>Safe</h1>\n');
    await writePassingEvidence(projectDir, outputDir);
    await writeFile(resolve(projectDir, 'project.manifest.json'), `${JSON.stringify({ ...DEFAULT_MANIFEST, name: '<script>alert(1)</script>', starter: { ...DEFAULT_MANIFEST.starter, requestedTargetPlatform: 'store' } })}\n`);
    await assert.rejects(createStudioBundle({ projectDir, outputDir, projectId: 'unsafe-brief' }), (error) => error instanceof StudioBundleError && error.code === 'BRIEF_INCOMPLETE');
  });
});

test('refuses symbolic links instead of exporting paths outside the reviewed sandbox', async () => {
  await withWorkspace(async ({ projectDir, outputDir, root }) => {
    await writeFile(resolve(projectDir, 'dist', 'index.html'), '<h1>Safe</h1>\n');
    await writePassingEvidence(projectDir, outputDir);
    await writeFile(resolve(root, 'outside.txt'), 'secret-like external content');
    await symlink(resolve(root, 'outside.txt'), resolve(projectDir, 'outside-link.txt'));
    await assert.rejects(createStudioBundle({ projectDir, outputDir, projectId: 'unsafe' }), (error) => error instanceof StudioBundleError && error.code === 'SYMLINK_REFUSED');
  });
});

test('rejects backslash-delimited traversal before archive serialization', async () => {
  await withWorkspace(async ({ projectDir, outputDir }) => {
    await writeFile(resolve(projectDir, 'dist', 'index.html'), '<h1>Safe</h1>\n');
    await writePassingEvidence(projectDir, outputDir);
    await writeFile(resolve(projectDir, 'nested\\..\\..\\..\\escape.txt'), 'must never enter archive');
    await assert.rejects(createStudioBundle({ projectDir, outputDir, projectId: 'unsafe-path' }), (error) => error instanceof StudioBundleError && error.code === 'PATH_CONTAINMENT');
  });
});

test('fails closed when the local starter exceeds the fixed export budget', async () => {
  await withWorkspace(async ({ projectDir, outputDir }) => {
    await writeFile(resolve(projectDir, 'dist', 'index.html'), '<h1>Safe</h1>\n');
    await writePassingEvidence(projectDir, outputDir);
    await writeFile(resolve(projectDir, 'oversize.bin'), Buffer.alloc(8 * 1024 * 1024 + 1, 1));
    await assert.rejects(createStudioBundle({ projectDir, outputDir, projectId: 'oversize' }), (error) => error instanceof StudioBundleError && error.code === 'BUNDLE_TOO_LARGE');
  });
});