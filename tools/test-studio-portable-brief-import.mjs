import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  parsePortableStarterBriefText,
  portableStarterBriefFromManifest,
  portableStarterManifestFileFromSelection
} from '../apps/studio/failed-run-retry.mjs';

const sampleManifest = JSON.parse(await readFile(new URL('../examples/sample-game/project.manifest.json', import.meta.url), 'utf8'));

function mockFile(path, size = 128) {
  return { webkitRelativePath: path, size };
}

test('imports planning intent from the real sample manifest without execution authority', () => {
  const brief = portableStarterBriefFromManifest(sampleManifest);
  assert.deepEqual(brief, {
    name: 'Pipeline Sample Game',
    objective: 'Prove a dependency-free build, QA, release-candidate, and publishing dry run.',
    targetPlatform: 'web',
    mechanic: 'collect'
  });
  assert.deepEqual(Object.keys(brief).sort(), ['mechanic', 'name', 'objective', 'targetPlatform']);
  assert.equal('build' in brief, false);
  assert.equal('qa' in brief, false);
  assert.equal('publish' in brief, false);
  assert.equal('registry' in brief, false);
});

test('parses JSON text through the same fail-closed contract', () => {
  assert.deepEqual(
    parsePortableStarterBriefText(JSON.stringify(sampleManifest)),
    portableStarterBriefFromManifest(sampleManifest)
  );
  assert.throws(() => parsePortableStarterBriefText('{bad json'), /valid JSON/i);
});

test('selects exactly the reviewed manifest from an extracted starter folder inventory', () => {
  const manifest = mockFile('verified-starter/starter/project.manifest.json', 512);
  const selected = portableStarterManifestFileFromSelection([
    mockFile('verified-starter/OPEN_PROJECT.html'),
    mockFile('verified-starter/VERIFICATION.html'),
    manifest,
    mockFile('verified-starter/starter/dist/index.html')
  ]);
  assert.equal(selected, manifest);
});

test('folder selection fails closed on missing, ambiguous, unsafe, or oversized inventories', () => {
  assert.throws(() => portableStarterManifestFileFromSelection([]), /choose the extracted verified starter folder/i);
  assert.throws(() => portableStarterManifestFileFromSelection([
    mockFile('verified-starter/OPEN_PROJECT.html')
  ]), /exactly one starter\/project\.manifest\.json/i);
  assert.throws(() => portableStarterManifestFileFromSelection([
    mockFile('a/starter/project.manifest.json'),
    mockFile('b/starter/project.manifest.json')
  ]), /more than one/i);
  assert.throws(() => portableStarterManifestFileFromSelection([
    mockFile('verified-starter/../starter/project.manifest.json')
  ]), /unsafe relative path/i);
  assert.throws(() => portableStarterManifestFileFromSelection([
    mockFile('verified-starter\\starter\\project.manifest.json')
  ]), /unsupported path separator/i);
  assert.throws(() => portableStarterManifestFileFromSelection([
    mockFile('verified-starter/starter/project.manifest.json', 0)
  ]), /between 1 byte/i);
  assert.throws(() => portableStarterManifestFileFromSelection([
    mockFile('verified-starter/starter/project.manifest.json', 64 * 1024 + 1)
  ]), /between 1 byte/i);
  assert.throws(() => portableStarterManifestFileFromSelection(
    Array.from({ length: 257 }, (_, index) => mockFile(`verified-starter/file-${index}.txt`))
  ), /no more than 256 files/i);
});

test('rejects native or unsupported execution claims', () => {
  assert.throws(() => portableStarterBriefFromManifest({
    ...sampleManifest,
    targetPlatforms: ['web', 'desktop']
  }), /local web target/i);
  assert.throws(() => portableStarterBriefFromManifest({
    ...sampleManifest,
    starter: { ...sampleManifest.starter, executedTargetPlatform: 'desktop' }
  }), /executed target/i);
  assert.throws(() => portableStarterBriefFromManifest({
    ...sampleManifest,
    starter: { ...sampleManifest.starter, requestedTargetPlatform: 'store' }
  }), /requested target/i);
  assert.throws(() => portableStarterBriefFromManifest({
    ...sampleManifest,
    starter: { ...sampleManifest.starter, targetExecutionStatus: 'executed-local-web', requestedTargetPlatform: 'mobile' }
  }), /target execution status/i);
});

test('rejects publication authority and remote destinations', () => {
  assert.throws(() => portableStarterBriefFromManifest({
    ...sampleManifest,
    publish: { provider: 'steam', destination: 'https://store.example.invalid/app' }
  }), /local-only publication plan/i);
  assert.throws(() => portableStarterBriefFromManifest({
    ...sampleManifest,
    publish: { provider: 'local', destination: 'https://example.invalid/upload' }
  }), /local-only publication plan/i);
});

test('rejects malformed, unsafe, or incompatible intent fields', () => {
  assert.throws(() => portableStarterBriefFromManifest(null), /manifest must be an object/i);
  assert.throws(() => portableStarterBriefFromManifest({ ...sampleManifest, manifestVersion: '2.0.0' }), /manifestVersion 1\.0\.0/i);
  assert.throws(() => portableStarterBriefFromManifest({ ...sampleManifest, name: 'Bad\u0000Name' }), /control characters/i);
  assert.throws(() => portableStarterBriefFromManifest({
    ...sampleManifest,
    starter: { ...sampleManifest.starter, mechanic: 'arbitrary-code' }
  }), /starter mechanic/i);
});
