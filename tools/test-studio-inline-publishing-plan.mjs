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
      releaseCandidate,
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

test('dogfoods the real sample and exposes its exact release candidate plus non-executing publishing plan in Studio verification', async () => {
  const { workspace, result, publishing, releaseCandidate, bundle } = await realSampleResult();
  try {
    const facts = factsObject(result);
    assert.equal(releaseCandidate.dryRunOnly, true);
    assert.equal(typeof releaseCandidate.candidateId, 'string');
    assert(releaseCandidate.candidateId.length > 0);
    assert.equal(typeof releaseCandidate.build?.artifactPath, 'string');
    assert(releaseCandidate.build.artifactPath.length > 0);
    assert.match(releaseCandidate.build.outputSha256, /^sha256:[a-f0-9]{64}$/);
    assert.deepEqual(releaseCandidate.destination, publishing.destination);
    assert.equal(facts['Release candidate ID'], releaseCandidate.candidateId);
    assert.equal(facts['Release candidate artifact'], releaseCandidate.build.artifactPath);
    assert.equal(facts['Release candidate'], 'dry-run only');
    assert.equal(facts['Release destination'], publishing.destination.target);
    assert.equal(facts['Release candidate provenance'], 'explicit identity + destination');
    assert.equal(facts['Release candidate SHA-256'], releaseCandidate.build.outputSha256);
    assert.equal(facts['Verified artifact'], releaseCandidate.build.outputSha256);
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
    console.log(`Studio inline release/publishing dogfood passed: ${JSON.stringify({ pipelineStatus: result.status, candidateId: releaseCandidate.candidateId, candidateArtifact: releaseCandidate.build.artifactPath, candidateSha256: releaseCandidate.build.outputSha256, publicationExecuted: publishing.executed, dryRun: publishing.dryRun, destination: publishing.destination, plan: publishing.plan, bundleSha256: bundle.sha256 })}`);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('inline Studio verification keeps safe legacy release identity and destination explicitly unavailable', async () => {
  const { workspace, result, releaseCandidate } = await realSampleResult();
  try {
    delete result.evidence.releaseCandidate.candidateId;
    delete result.evidence.releaseCandidate.destination;
    const facts = factsObject(result);
    assert.equal(facts['Release candidate ID'], 'unavailable in legacy evidence');
    assert.equal(facts['Release destination'], 'unavailable in legacy evidence');
    assert.equal(facts['Release candidate provenance'], 'legacy evidence · identity/destination unavailable; not inferred');
    assert.equal(facts['Release candidate artifact'], releaseCandidate.build.artifactPath);
    assert.equal(facts['Release candidate SHA-256'], releaseCandidate.build.outputSha256);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('inline Studio verification fails closed when release candidate destination contradicts the verified local destination', async () => {
  const { workspace, result } = await realSampleResult();
  try {
    result.evidence.releaseCandidate.destination = { kind: 'local', target: 'local://planned/other-project' };
    assert.throws(() => factsObject(result), /Release candidate evidence is incomplete or contradicts/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('inline Studio verification fails closed when release candidate identity contains control characters', async () => {
  const { workspace, result } = await realSampleResult();
  try {
    result.evidence.releaseCandidate.candidateId = 'candidate\nforged';
    assert.throws(() => factsObject(result), /Release candidate evidence is incomplete or contradicts/);
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
