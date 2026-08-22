import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFailedRunReceipt, failedRunStageStatuses } from './studio-verification-page.mjs';

const baseFailure = {
  status: 'fail',
  error: 'Build failed or did not produce a contained artifact.',
  brief: { name: 'Failure Dogfood', objective: 'Exercise fail-honest recovery', targetPlatform: 'web', mechanic: 'collect' },
  safety: null,
  evidence: {
    intake: { validation: { status: 'pass' } },
    registry: { entries: [{ entry_id: 'system.gdevelop' }] },
    build: { executed: true, status: 'fail', exitStatus: 17 },
    qa: { executed: false, status: 'fail', reason: 'Build did not produce a usable artifact' },
    run: { outcome: { status: 'fail' } }
  },
  download: { url: '/should-not-survive' },
  playable: { launchUrl: '/should-not-survive' }
};

test('failed receipt retains only partial evidence and grants no success authority', () => {
  const receipt = buildFailedRunReceipt(baseFailure);
  assert.equal(receipt.kind, 'byjtt-local-failed-attempt-evidence');
  assert.equal(receipt.status, 'failed');
  assert.deepEqual(receipt.authority, {
    playable: false,
    downloadableStarter: false,
    publication: false,
    secrets: false,
    note: 'This receipt preserves partial local execution evidence only. Missing or failed stages are not treated as executed or passing.'
  });
  assert.equal('download' in receipt, false);
  assert.equal('playable' in receipt, false);
  assert.equal(receipt.evidence.build.status, 'fail');
  assert.equal(receipt.evidence.qa.executed, false);
});

test('stage projection preserves pass, fail, and blocked distinctions', () => {
  assert.deepEqual(failedRunStageStatuses(baseFailure), {
    intake: 'pass',
    registry: 'pass',
    build: 'fail',
    qa: 'fail',
    releaseCandidate: 'blocked',
    publishing: 'blocked'
  });
});

test('a passing result cannot be relabelled as a failed-attempt receipt', () => {
  assert.throws(() => buildFailedRunReceipt({ ...baseFailure, status: 'pass' }), /non-passing pipeline result/);
});

test('a transport or validation error without machine evidence is not fabricated into a receipt', () => {
  assert.throws(() => buildFailedRunReceipt({ status: 'fail', error: 'bad request', evidence: {} }), /retained pipeline evidence/);
  assert.throws(() => buildFailedRunReceipt({ status: 'fail', error: 'bad request' }), /retained pipeline evidence/);
});

test('unsafe or executed publishing evidence is never projected as a passing failed-run stage', () => {
  const remote = structuredClone(baseFailure);
  remote.evidence.publishing = {
    executed: false,
    secretsUsed: false,
    dryRun: true,
    destination: { kind: 'remote', target: 'https://example.invalid' }
  };
  assert.equal(failedRunStageStatuses(remote).publishing, 'fail');

  const executed = structuredClone(baseFailure);
  executed.evidence.publishing = {
    executed: true,
    secretsUsed: true,
    dryRun: false,
    destination: { kind: 'local', target: 'local://planned/sample-game' }
  };
  assert.equal(failedRunStageStatuses(executed).publishing, 'fail');
});
