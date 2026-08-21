import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildInlineVerificationFacts, recoverableBriefValues } from '../apps/studio/latest-run-recovery.mjs';

const HASH = `sha256:${'a'.repeat(64)}`;
const BUNDLE_HASH = `sha256:${'b'.repeat(64)}`;
const REGISTRY_HASH = `sha256:${'c'.repeat(64)}`;

function safeResult() {
  return {
    status: 'pass',
    brief: {
      name: 'Harbour Run',
      objective: 'Build a small verified arcade starter.',
      targetPlatform: 'desktop',
      mechanic: 'dodge'
    },
    evidence: {
      intake: { validation: { status: 'pass' } },
      registry: {
        registryRevision: REGISTRY_HASH,
        selectionMode: 'requested',
        entries: [{
          entry_id: 'system.reviewed-starter',
          name: 'Reviewed Starter',
          execution_status: 'SOURCE-VERIFIED',
          license_review_status: 'repository_only_verified'
        }]
      },
      build: { executed: true, status: 'pass', artifactSha256: HASH },
      qa: { executed: true, status: 'pass', artifactSha256: HASH },
      releaseCandidate: { dryRunOnly: true, build: { outputSha256: HASH } },
      publishing: {
        dryRun: true,
        executed: false,
        provider: null,
        storeOperation: null,
        secretsUsed: false,
        releaseCandidatePath: 'release-candidate.json',
        destination: { kind: 'local', target: 'local://planned/sample-game' }
      }
    },
    safety: {
      dryRun: true,
      publicationExecuted: false,
      secretsUsed: false,
      destination: { kind: 'local', target: 'local://planned/sample-game' }
    },
    download: {
      filename: 'sample-game-verified-local-starter.tar.gz',
      sha256: BUNDLE_HASH
    }
  };
}

test('summarizes only consistent passing local evidence', () => {
  const facts = Object.fromEntries(buildInlineVerificationFacts(safeResult()));
  assert.match(facts['Solved-system selection'], /Reviewed Starter \(system\.reviewed-starter\)/);
  assert.match(facts['Solved-system selection'], /selection is not this run's runtime execution/);
  assert.equal(facts['Registry provenance'], `requested · ${REGISTRY_HASH}`);
  assert.equal(facts.Build, 'executed · pass');
  assert.equal(facts.QA, 'executed · pass');
  assert.equal(facts['Release candidate'], 'dry-run only');
  assert.equal(facts.Publication, 'not executed');
  assert.equal(facts.Secrets, 'not used');
  assert.equal(facts.Destination, 'local://planned/sample-game');
  assert.match(facts['Publishing plan'], /unavailable.*No publication is implied/i);
  assert.match(facts['Publishing authority'], /^none · /);
  assert.equal(facts['Verified artifact'], HASH);
  assert.equal(facts['Starter bundle'], BUNDLE_HASH);
});

test('recovers only bounded Creator Mode brief fields', () => {
  assert.deepEqual(recoverableBriefValues(safeResult()), {
    name: 'Harbour Run',
    objective: 'Build a small verified arcade starter.',
    targetPlatform: 'desktop',
    mechanic: 'dodge'
  });
  const sample = safeResult();
  sample.brief = null;
  assert.equal(recoverableBriefValues(sample), null);
});

test('rejects malformed recovered brief fields', () => {
  const target = safeResult();
  target.brief.targetPlatform = 'store';
  assert.throws(() => recoverableBriefValues(target), /target is invalid/i);
  const mechanic = safeResult();
  mechanic.brief.mechanic = 'arbitrary-code';
  assert.throws(() => recoverableBriefValues(mechanic), /mechanic is invalid/i);
  for (const control of ['\u0000', '\t', '\n', '\r', '\u0085']) {
    const name = safeResult();
    name.brief.name = `Bad${control}Name`;
    assert.throws(() => recoverableBriefValues(name), /name is invalid/i);
  }
  const objective = safeResult();
  objective.brief.objective = 'x'.repeat(501);
  assert.throws(() => recoverableBriefValues(objective), /objective is invalid/i);
});

test('keeps multiline objective whitespace distinct from single-line name rules', () => {
  const result = safeResult();
  result.brief.objective = 'Build a small starter.\nKeep the local proof boundary visible.\tNo publication.';
  assert.equal(recoverableBriefValues(result).objective, result.brief.objective);
});

test('rejects a false publication claim', () => {
  const result = safeResult();
  result.safety.publicationExecuted = true;
  assert.throws(() => buildInlineVerificationFacts(result), /publishing safety evidence/i);
});

test('rejects failed or unexecuted QA', () => {
  const failed = safeResult();
  failed.evidence.qa.status = 'fail';
  assert.throws(() => buildInlineVerificationFacts(failed), /QA evidence/i);
  const unexecuted = safeResult();
  unexecuted.evidence.qa.executed = false;
  assert.throws(() => buildInlineVerificationFacts(unexecuted), /QA evidence/i);
});

test('rejects artifact hash disagreement across build, QA, and release evidence', () => {
  const result = safeResult();
  result.evidence.releaseCandidate.build.outputSha256 = `sha256:${'d'.repeat(64)}`;
  assert.throws(() => buildInlineVerificationFacts(result), /revision-consistent/i);
});

test('rejects malformed bundle provenance instead of displaying a verified summary', () => {
  const missing = safeResult();
  missing.download = null;
  assert.throws(() => buildInlineVerificationFacts(missing), /download was not produced/i);
  const malformed = safeResult();
  malformed.download.sha256 = 'sha256:not-a-digest';
  assert.throws(() => buildInlineVerificationFacts(malformed), /download was not produced/i);
});

test('rejects remote or secret-backed destinations', () => {
  const remote = safeResult();
  remote.safety.destination = { kind: 'provider', target: 'https://example.invalid/release' };
  assert.throws(() => buildInlineVerificationFacts(remote), /publishing safety evidence/i);
  const secret = safeResult();
  secret.safety.secretsUsed = true;
  assert.throws(() => buildInlineVerificationFacts(secret), /publishing safety evidence/i);
});
