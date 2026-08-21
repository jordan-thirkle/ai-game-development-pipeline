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

test('creates a bounded gzip tar with a zero-terminal starter entry point and evidence content', async () => {
  await withWorkspace(async ({ projectDir, outputDir }) => {
    await writeFile(resolve(projectDir, 'project.manifest.json'), '{"name":"Harbour Run"}\n');
    await writeFile(resolve(projectDir, 'dist', 'index.html'), '<h1>Harbour Run</h1>\n');
    await writeFile(resolve(outputDir, 'release-candidate.json'), '{"dryRunOnly":true}\n');
    const bundle = await createStudioBundle({ projectDir, outputDir, projectId: 'brief-harbour-run' });
    assert.equal(bundle.contentType, 'application/gzip');
    assert.equal(bundle.filename, 'brief-harbour-run-verified-local-starter.tar.gz');
    assert.match(bundle.sha256, /^sha256:[a-f0-9]{64}$/);
    assert.equal(bundle.fileCount, 4);
    const entries = readTarEntries(bundle.bytes);
    assert.equal(entries.has('START_HERE.html'), true);
    assert.equal(entries.has('starter/project.manifest.json'), true);
    assert.equal(entries.has('starter/dist/index.html'), true);
    assert.equal(entries.has('evidence/release-candidate.json'), true);
    const startHere = entries.get('START_HERE.html').toString('utf8');
    assert.match(startHere, /starter\/dist\/index\.html/);
    assert.doesNotMatch(startHere, /https?:\/\//i);
    assert.doesNotMatch(startHere, /javascript:/i);
    assert.equal(entries.get('starter/dist/index.html').toString('utf8'), '<h1>Harbour Run</h1>\n');
  });
});

test('fails closed instead of exporting a launcher without the verified playable artifact', async () => {
  await withWorkspace(async ({ projectDir, outputDir }) => {
    await writeFile(resolve(projectDir, 'project.manifest.json'), '{"name":"No build"}\n');
    await writeFile(resolve(outputDir, 'pipeline-run.json'), '{}\n');
    await assert.rejects(
      createStudioBundle({ projectDir, outputDir, projectId: 'missing-playable' }),
      (error) => error instanceof StudioBundleError && error.code === 'PLAYABLE_MISSING'
    );
  });
});

test('refuses symbolic links instead of exporting paths outside the reviewed sandbox', async () => {
  await withWorkspace(async ({ projectDir, outputDir, root }) => {
    await writeFile(resolve(root, 'outside.txt'), 'secret-like external content');
    await symlink(resolve(root, 'outside.txt'), resolve(projectDir, 'outside-link.txt'));
    await writeFile(resolve(outputDir, 'pipeline-run.json'), '{}\n');
    await assert.rejects(
      createStudioBundle({ projectDir, outputDir, projectId: 'unsafe' }),
      (error) => error instanceof StudioBundleError && error.code === 'SYMLINK_REFUSED'
    );
  });
});

test('rejects backslash-delimited traversal before archive serialization', async () => {
  await withWorkspace(async ({ projectDir, outputDir }) => {
    await writeFile(resolve(projectDir, 'nested\\..\\..\\..\\escape.txt'), 'must never enter archive');
    await writeFile(resolve(outputDir, 'pipeline-run.json'), '{}\n');
    await assert.rejects(
      createStudioBundle({ projectDir, outputDir, projectId: 'unsafe-path' }),
      (error) => error instanceof StudioBundleError && error.code === 'PATH_CONTAINMENT'
    );
  });
});

test('fails closed when the local starter exceeds the fixed export budget', async () => {
  await withWorkspace(async ({ projectDir, outputDir }) => {
    await writeFile(resolve(projectDir, 'oversize.bin'), Buffer.alloc(8 * 1024 * 1024 + 1, 1));
    await writeFile(resolve(outputDir, 'pipeline-run.json'), '{}\n');
    await assert.rejects(
      createStudioBundle({ projectDir, outputDir, projectId: 'oversize' }),
      (error) => error instanceof StudioBundleError && error.code === 'BUNDLE_TOO_LARGE'
    );
  });
});
