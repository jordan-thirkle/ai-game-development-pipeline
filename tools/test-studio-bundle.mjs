import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { gunzipSync } from 'node:zlib';
import { createStudioBundle, StudioBundleError } from './studio-bundle.mjs';

async function withWorkspace(callback) {
  const root = await mkdtemp(resolve(tmpdir(), 'byjtt-studio-bundle-test-'));
  try {
    const projectDir = resolve(root, 'project');
    const outputDir = resolve(root, 'evidence');
    await mkdir(resolve(projectDir, 'dist'), { recursive: true });
    await mkdir(outputDir, { recursive: true });
    return await callback({ root, projectDir, outputDir });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function writePassingEvidence(outputDir, overrides = {}) {
  const records = {
    'build-result.json': { executed: true, status: 'pass', artifactSha256: 'sha256:' + '1'.repeat(64) },
    'qa-result.json': { executed: true, status: 'pass', artifactSha256: 'sha256:' + '1'.repeat(64) },
    'release-candidate.json': { dryRunOnly: true },
    'publishing-receipt.json': { executed: false, secretsUsed: false, destination: { kind: 'local', target: 'local://release-candidate' } },
    ...overrides
  };
  for (const [filename, value] of Object.entries(records)) {
    await writeFile(resolve(outputDir, filename), `${JSON.stringify(value)}\n`);
  }
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

test('creates a bounded gzip tar with zero-terminal starter and portable verification entry points', async () => {
  await withWorkspace(async ({ projectDir, outputDir }) => {
    await writeFile(resolve(projectDir, 'project.manifest.json'), '{"name":"Harbour Run"}\n');
    await writeFile(resolve(projectDir, 'dist', 'index.html'), '<h1>Harbour Run</h1>\n');
    await writePassingEvidence(outputDir);
    const bundle = await createStudioBundle({ projectDir, outputDir, projectId: 'brief-harbour-run' });
    assert.equal(bundle.contentType, 'application/gzip');
    assert.equal(bundle.filename, 'brief-harbour-run-verified-local-starter.tar.gz');
    assert.match(bundle.sha256, /^sha256:[a-f0-9]{64}$/);
    assert.equal(bundle.fileCount, 8);
    const entries = readTarEntries(bundle.bytes);
    assert.equal(entries.has('START_HERE.html'), true);
    assert.equal(entries.has('VERIFICATION.txt'), true);
    assert.equal(entries.has('starter/project.manifest.json'), true);
    assert.equal(entries.has('starter/dist/index.html'), true);
    assert.equal(entries.has('evidence/build-result.json'), true);
    assert.equal(entries.has('evidence/qa-result.json'), true);
    assert.equal(entries.has('evidence/release-candidate.json'), true);
    assert.equal(entries.has('evidence/publishing-receipt.json'), true);
    const startHere = entries.get('START_HERE.html').toString('utf8');
    assert.match(startHere, /starter\/dist\/index\.html/);
    assert.doesNotMatch(startHere, /https?:\/\//i);
    assert.doesNotMatch(startHere, /javascript:/i);
    const verification = entries.get('VERIFICATION.txt').toString('utf8');
    assert.match(verification, /Build executed: true/);
    assert.match(verification, /QA status: pass/);
    assert.match(verification, /Release candidate dry-run only: true/);
    assert.match(verification, /Publication executed: false/);
    assert.match(verification, /Secrets used: false/);
    assert.match(verification, /Destination: local:\/\/release-candidate/);
    assert.match(verification, /does not claim store\/provider publication/);
    assert.equal(entries.get('starter/dist/index.html').toString('utf8'), '<h1>Harbour Run</h1>\n');
  });
});

test('fails closed instead of exporting a launcher without the verified playable artifact', async () => {
  await withWorkspace(async ({ projectDir, outputDir }) => {
    await writeFile(resolve(projectDir, 'project.manifest.json'), '{"name":"No build"}\n');
    await writePassingEvidence(outputDir);
    await assert.rejects(
      createStudioBundle({ projectDir, outputDir, projectId: 'missing-playable' }),
      (error) => error instanceof StudioBundleError && error.code === 'PLAYABLE_MISSING'
    );
  });
});

test('fails closed when portable verification evidence is missing', async () => {
  await withWorkspace(async ({ projectDir, outputDir }) => {
    await writeFile(resolve(projectDir, 'dist', 'index.html'), '<h1>Missing QA</h1>\n');
    await writePassingEvidence(outputDir);
    await rm(resolve(outputDir, 'qa-result.json'));
    await assert.rejects(
      createStudioBundle({ projectDir, outputDir, projectId: 'missing-evidence' }),
      (error) => error instanceof StudioBundleError && error.code === 'EVIDENCE_INCOMPLETE'
    );
  });
});

test('fails closed instead of summarizing a false publication or secret-backed result', async () => {
  await withWorkspace(async ({ projectDir, outputDir }) => {
    await writeFile(resolve(projectDir, 'dist', 'index.html'), '<h1>Unsafe</h1>\n');
    await writePassingEvidence(outputDir, {
      'publishing-receipt.json': { executed: true, secretsUsed: true, destination: { kind: 'remote', target: 'https://example.invalid' } }
    });
    await assert.rejects(
      createStudioBundle({ projectDir, outputDir, projectId: 'unsafe-evidence' }),
      (error) => error instanceof StudioBundleError && error.code === 'EVIDENCE_INCOMPLETE'
    );
  });
});

test('refuses symbolic links instead of exporting paths outside the reviewed sandbox', async () => {
  await withWorkspace(async ({ projectDir, outputDir, root }) => {
    await writeFile(resolve(projectDir, 'dist', 'index.html'), '<h1>Safe</h1>\n');
    await writePassingEvidence(outputDir);
    await writeFile(resolve(root, 'outside.txt'), 'secret-like external content');
    await symlink(resolve(root, 'outside.txt'), resolve(projectDir, 'outside-link.txt'));
    await assert.rejects(
      createStudioBundle({ projectDir, outputDir, projectId: 'unsafe' }),
      (error) => error instanceof StudioBundleError && error.code === 'SYMLINK_REFUSED'
    );
  });
});

test('rejects backslash-delimited traversal before archive serialization', async () => {
  await withWorkspace(async ({ projectDir, outputDir }) => {
    await writeFile(resolve(projectDir, 'dist', 'index.html'), '<h1>Safe</h1>\n');
    await writePassingEvidence(outputDir);
    await writeFile(resolve(projectDir, 'nested\\..\\..\\..\\escape.txt'), 'must never enter archive');
    await assert.rejects(
      createStudioBundle({ projectDir, outputDir, projectId: 'unsafe-path' }),
      (error) => error instanceof StudioBundleError && error.code === 'PATH_CONTAINMENT'
    );
  });
});

test('fails closed when the local starter exceeds the fixed export budget', async () => {
  await withWorkspace(async ({ projectDir, outputDir }) => {
    await writeFile(resolve(projectDir, 'dist', 'index.html'), '<h1>Safe</h1>\n');
    await writePassingEvidence(outputDir);
    await writeFile(resolve(projectDir, 'oversize.bin'), Buffer.alloc(8 * 1024 * 1024 + 1, 1));
    await assert.rejects(
      createStudioBundle({ projectDir, outputDir, projectId: 'oversize' }),
      (error) => error instanceof StudioBundleError && error.code === 'BUNDLE_TOO_LARGE'
    );
  });
});
