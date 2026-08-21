import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { buildInlineVerificationFacts } from '../apps/studio/latest-run-recovery.mjs';
import { runPipeline } from './run-pipeline.mjs';
import { createStudioBundle } from './studio-bundle.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function realSampleResult() {
  const workspace = await mkdtemp(resolve(tmpdir(), 'byjtt-studio-inline-publishing-'));
  const projectDir = resolve(workspace, 'sample-game');
  const outputDir = resolve(workspace, 'evidence');
  try {
    await cp(resolve(repositoryRoot, 'examples/sample-game'), projectDir, { recursive: true });
    const manifest = await readJson(resolve(projectDir, 'project.manifest.json'));
    const pipeline = await runPipeline({ projectDir, outputDir, dryRun: true, sourceRevision: 'studio-inline-publishing-plan-dogfood' });
    assert.equal(pipeline.status, 'pass');
    const [intake, registry, build, qa, releaseCandidate, publishing] = await Promise.all([
      readJson(resolve(outputDir, 'intake.json')),
      readJson(resolve(outputDir, 'registry-selection.json')),
      readJson(resolve(outputDir, 'build-result.json')),
      readJson(resolve(outputDir, 'qa-result.json')),
      readJson(resolve(outputDir, 'release-candidate.json')),
      readJson(resolve(outputDir, 'publishing-receipt.json'))
    ]);
    const bundle = await createStudioBundle({ projectDir, outputDir, projectId: manifest.projectId });
    return {
      workspace,
      result: {
        status: 'pass',
        evidence: { intake, registry, build, qa, releaseCandidate, publishing },
        safety: {
          dryRun: publishing.dryRun,
          publicationExecuted: publishing.executed,
          secretsUsed: publishing.secretsUsed,
          destination: publishing.destination
        },
        download: { filename: bundle.filename, sha256: bundle.sha256 }
      },
      publishing,
      bundle
    };
  } catch (error) {
    await rm(workspace, { recursive: true, force: true });
    throw error;
  }
}

function factsObject(result) {
  return Object.fromEntries(buildInlineVerificationFacts(result));
}

test('dogfoods the real sample and exposes its exact non-executing publishing plan in Studio verification', async () => {
  const { workspace, result, publishing, bundle } = await realSampleResult();
  try {
    const facts = factsObject(result);
    assert.equal(publishing.executed, false);
    assert.equal(publishing.dryRun, true);
    assert.equal(publishing.provider, null);
    assert.equal(publishing.storeOperation, null);
    assert.equal(publishing.secretsUsed, false);
    assert.equal(publishing.destination.kind, 'local');
    assert.deepEqual(publishing.plan, [`Would publish release-candidate.json to ${publishing.destination.target}`]);
    assert.equal(facts['Publication'], 'not executed');
    assert.equal(facts['Destination'], publishing.destination.target);
    assert.equal(facts['Publishing plan'], publishing.plan[0]);
    assert.match(facts['Publishing authority'], /^none · .*separately authorized credentialed execution evidence$/);
    assert.equal(facts['Starter bundle'], bundle.sha256);
    console.log(`Studio inline publishing-plan dogfood passed: ${JSON.stringify({ pipelineStatus: result.status, publicationExecuted: publishing.executed, dryRun: publishing.dryRun, destination: publishing.destination, plan: publishing.plan, bundleSha256: bundle.sha256 })}`);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('inline Studio verification fails closed when provider authority appears', async () => {
  const { workspace, result } = await realSampleResult();
  try {
    result.evidence.publishing.provider = 'example-provider';
    assert.throws(() => factsObject(result), /truthful local-only dry-run publishing plan/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('inline Studio verification fails closed when a store operation appears', async () => {
  const { workspace, result } = await realSampleResult();
  try {
    result.evidence.publishing.storeOperation = 'submit';
    assert.throws(() => factsObject(result), /truthful local-only dry-run publishing plan/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('inline Studio verification fails closed when the retained plan points at a remote destination', async () => {
  const { workspace, result } = await realSampleResult();
  try {
    result.evidence.publishing.plan = ['Would publish release-candidate.json to https://example.invalid'];
    assert.throws(() => factsObject(result), /truthful local-only dry-run publishing plan/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('inline Studio verification fails closed when publishing receipt destination contradicts the safety destination', async () => {
  const { workspace, result } = await realSampleResult();
  try {
    const expectedTarget = result.safety.destination.target;
    assert.deepEqual(result.evidence.publishing.plan, [`Would publish release-candidate.json to ${expectedTarget}`]);
    result.evidence.publishing.destination = { kind: 'provider', target: 'https://example.invalid/release' };
    assert.throws(() => factsObject(result), /truthful local-only dry-run publishing plan/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('inline Studio verification fails closed when two local publishing destinations disagree', async () => {
  const { workspace, result } = await realSampleResult();
  try {
    const expectedTarget = result.safety.destination.target;
    assert.deepEqual(result.evidence.publishing.plan, [`Would publish release-candidate.json to ${expectedTarget}`]);
    result.evidence.publishing.destination = { kind: 'local', target: 'local://planned/other-project' };
    assert.throws(() => factsObject(result), /truthful local-only dry-run publishing plan/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});
