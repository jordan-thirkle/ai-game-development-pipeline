import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { gunzipSync } from 'node:zlib';
import { createStudioBundle } from './studio-bundle.mjs';
import { createStarterHomePage } from './studio-starter-home-page.mjs';
import { runPipeline } from './run-pipeline.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VALID_SHA = `sha256:${'a'.repeat(64)}`;

function readTarEntries(bytes) {
  const tar = gunzipSync(bytes);
  const entries = new Map();
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '');
    const size = Number.parseInt(header.subarray(124, 136).toString('ascii').replace(/\0.*$/, '').trim() || '0', 8);
    assert(Number.isSafeInteger(size) && size >= 0, `invalid TAR size for ${name}`);
    const bodyStart = offset + 512;
    entries.set(name, tar.subarray(bodyStart, bodyStart + size));
    offset = bodyStart + Math.ceil(size / 512) * 512;
  }
  return entries;
}

function fixture() {
  const destinationTarget = 'local://release-candidate';
  return {
    manifest: {
      name: 'Harbour Run',
      objective: 'A bounded local starter.',
      starter: { mechanic: 'collect', requestedTargetPlatform: 'mobile', executedTargetPlatform: 'web' }
    },
    evidence: {
      build: { executed: true, status: 'pass' },
      qa: { executed: true, status: 'pass' },
      releaseCandidate: {
        candidateId: 'harbour-run-run-test',
        dryRunOnly: true,
        build: { artifactPath: 'dist', outputSha256: VALID_SHA },
        destination: { kind: 'local', target: destinationTarget }
      },
      publishing: {
        releaseCandidatePath: 'release-candidate.json',
        destination: { kind: 'local', target: destinationTarget },
        dryRun: true,
        executed: false,
        provider: null,
        storeOperation: null,
        secretsUsed: false,
        plan: [`Would publish release-candidate.json to ${destinationTarget}`]
      },
      destination: { kind: 'local', target: destinationTarget },
      destinationTarget
    }
  };
}

test('dogfoods the real sample pipeline and renders its local dry-run publishing plan on the offline starter home', async () => {
  const workspace = await mkdtemp(resolve(tmpdir(), 'byjtt-studio-publishing-plan-'));
  try {
    const projectDir = resolve(workspace, 'sample-game');
    const outputDir = resolve(workspace, 'evidence');
    await cp(resolve(repositoryRoot, 'examples/sample-game'), projectDir, { recursive: true });
    const manifest = JSON.parse(await readFile(resolve(projectDir, 'project.manifest.json'), 'utf8'));
    const result = await runPipeline({ projectDir, outputDir, dryRun: true, sourceRevision: 'studio-publishing-plan-dogfood' });
    assert.equal(result.status, 'pass');
    const receipt = JSON.parse(await readFile(resolve(outputDir, 'publishing-receipt.json'), 'utf8'));
    assert.equal(receipt.executed, false);
    assert.equal(receipt.dryRun, true);
    assert.equal(receipt.secretsUsed, false);
    assert.equal(receipt.provider, null);
    assert.equal(receipt.storeOperation, null);
    assert.equal(receipt.destination.kind, 'local');
    assert.deepEqual(receipt.plan, [`Would publish release-candidate.json to ${receipt.destination.target}`]);

    const bundle = await createStudioBundle({ projectDir, outputDir, projectId: manifest.projectId });
    const home = readTarEntries(bundle.bytes).get('OPEN_PROJECT.html')?.toString('utf8');
    assert(home, 'verified bundle did not contain OPEN_PROJECT.html');
    assert.match(home, /Dry-run publishing plan/);
    assert.match(home, /NOT PUBLISHED/);
    assert.match(home, new RegExp(receipt.plan[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(home, /Provider\s*<b>none<\/b>/);
    assert.match(home, /Store operation\s*<b>none<\/b>/);
    assert.match(home, /Secrets\s*<b>not used<\/b>/);
    assert.match(home, /External proof gate:/);
    assert.match(home, /separately authorized workflow/);
    assert.doesNotMatch(home, /<script/i);
    assert.doesNotMatch(home, /https?:\/\//i);
    assert.doesNotMatch(home, /javascript:/i);
    console.log(`Studio publishing-plan dogfood passed: ${JSON.stringify({ projectId: manifest.projectId, pipelineStatus: result.status, publicationExecuted: receipt.executed, dryRun: receipt.dryRun, destination: receipt.destination, plan: receipt.plan, bundleSha256: bundle.sha256 })}`);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('fails closed when a retained publishing plan contradicts the local-only receipt', () => {
  const { manifest, evidence } = fixture();
  evidence.publishing.plan = ['Would publish release-candidate.json to https://example.invalid'];
  assert.throws(() => createStarterHomePage(manifest, evidence, VALID_SHA), /truthful local-only dry-run publishing plan/);
});

test('fails closed when a plan claims provider execution authority', () => {
  const { manifest, evidence } = fixture();
  evidence.publishing.provider = 'example-provider';
  assert.throws(() => createStarterHomePage(manifest, evidence, VALID_SHA), /truthful local-only dry-run publishing plan/);
});

test('fails closed when a plan claims a store operation', () => {
  const { manifest, evidence } = fixture();
  evidence.publishing.storeOperation = 'submit';
  assert.throws(() => createStarterHomePage(manifest, evidence, VALID_SHA), /truthful local-only dry-run publishing plan/);
});

test('legacy evidence without a plan stays visibly unavailable instead of inventing one', () => {
  const { manifest, evidence } = fixture();
  delete evidence.publishing.plan;
  const home = createStarterHomePage(manifest, evidence, VALID_SHA).toString('utf8');
  assert.match(home, /Publishing plan unavailable in this retained receipt/);
  assert.match(home, /NOT PUBLISHED/);
  assert.doesNotMatch(home, /Would publish release-candidate\.json/);
});

test('legacy evidence without a plan still rejects explicit provider authority', () => {
  const { manifest, evidence } = fixture();
  delete evidence.publishing.plan;
  delete evidence.publishing.dryRun;
  evidence.publishing.provider = 'example-provider';
  assert.throws(() => createStarterHomePage(manifest, evidence, VALID_SHA), /truthful local-only dry-run publishing plan/);
});
