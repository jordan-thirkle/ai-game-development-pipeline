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

test('creates a bounded gzip tar with starter and evidence content', async () => {
  await withWorkspace(async ({ projectDir, outputDir }) => {
    await writeFile(resolve(projectDir, 'project.manifest.json'), '{"name":"Harbour Run"}\n');
    await writeFile(resolve(projectDir, 'dist', 'index.html'), '<h1>Harbour Run</h1>\n');
    await writeFile(resolve(outputDir, 'release-candidate.json'), '{"dryRunOnly":true}\n');
    const bundle = await createStudioBundle({ projectDir, outputDir, projectId: 'brief-harbour-run' });
    assert.equal(bundle.contentType, 'application/gzip');
    assert.equal(bundle.filename, 'brief-harbour-run-verified-local-starter.tar.gz');
    assert.match(bundle.sha256, /^sha256:[a-f0-9]{64}$/);
    assert.equal(bundle.fileCount, 3);
    const tar = gunzipSync(bundle.bytes);
    assert.equal(tar.includes(Buffer.from('starter/project.manifest.json')), true);
    assert.equal(tar.includes(Buffer.from('starter/dist/index.html')), true);
    assert.equal(tar.includes(Buffer.from('evidence/release-candidate.json')), true);
    assert.equal(tar.includes(Buffer.from('Harbour Run')), true);
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
