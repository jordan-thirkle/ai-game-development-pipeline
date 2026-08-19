import assert from 'node:assert/strict';
import test from 'node:test';
import {
  auditOwnershipProjection,
  deriveOpenPullClaims,
  pathMatchesOwnedPattern,
  projectOwnership,
} from './control-plane-ownership.mjs';

const state = () => ({
  generatedAt: '2026-08-19T06:57:00+01:00',
  project: { repository: 'jordan-thirkle/ai-game-development-pipeline' },
  workstreams: [
    {
      id: 'ws-playcanvas',
      title: 'PlayCanvas',
      status: 'blocked',
      sessionId: 'available',
      branch: 'benchmark/001-playcanvas',
      base: 'main',
      environment: 'browser',
      ownedPaths: ['experiments/BYJTT-LAB-001/candidates/playcanvas/**'],
      evidenceIds: ['ev-existing'],
      nextSafeAction: 'Keep semantic status independent from ownership projection.',
    },
    {
      id: 'ws-godot',
      title: 'Godot',
      status: 'planned',
      sessionId: 'unclaimed',
      branch: 'benchmark/001-godot',
      base: 'main',
      environment: 'godot',
      ownedPaths: ['experiments/BYJTT-LAB-001/candidates/godot/**'],
      evidenceIds: [],
      nextSafeAction: 'Claim in a capable environment.',
    },
  ],
  stages: [], gates: [], agents: [], decisions: [], evidence: [], builds: [],
});

const pr = (number, branch, filenames) => ({
  number,
  head: { ref: branch, sha: `head-${number}` },
  base: { ref: 'main', sha: 'base' },
  files: filenames.map((filename) => ({ filename })),
});

test('owned-path matching respects directory boundaries', () => {
  assert.equal(
    pathMatchesOwnedPattern(
      'experiments/BYJTT-LAB-001/candidates/godot/project.godot',
      'experiments/BYJTT-LAB-001/candidates/godot/**',
    ),
    true,
  );
  assert.equal(
    pathMatchesOwnedPattern(
      'experiments/BYJTT-LAB-001/candidates/godot-other/project.godot',
      'experiments/BYJTT-LAB-001/candidates/godot/**',
    ),
    false,
  );
});

test('one open PR becomes the explicit owner without rewriting blocked semantic status', () => {
  const input = state();
  const pull = pr(88, 'benchmark/001-playcanvas-ammo-gate', [
    'experiments/BYJTT-LAB-001/candidates/playcanvas/physics-gate/src/main.ts',
  ]);

  const output = projectOwnership(input, [pull], '2026-08-20T00:30:46.000Z');
  const workstream = output.workstreams.find(({ id }) => id === 'ws-playcanvas');

  assert.equal(workstream.sessionId, 'github-pr:88');
  assert.equal(workstream.branch, 'benchmark/001-playcanvas-ammo-gate');
  assert.equal(workstream.base, 'main');
  assert.equal(workstream.status, 'blocked');
  assert.deepEqual(workstream.evidenceIds, ['ev-existing']);
  assert.equal(output.generatedAt, input.generatedAt, 'partial ownership sync must not freshen whole state');
  assert.equal(output.ownershipProjectedAt, '2026-08-20T00:30:46.000Z');
});

test('planned workstream becomes claimed when an overlapping open PR exists', () => {
  const input = state();
  const output = projectOwnership(
    input,
    [pr(80, 'benchmark/001-godot', ['experiments/BYJTT-LAB-001/candidates/godot/README.md'])],
    '2026-08-20T00:30:46.000Z',
  );
  const workstream = output.workstreams.find(({ id }) => id === 'ws-godot');
  assert.equal(workstream.status, 'claimed');
  assert.equal(workstream.sessionId, 'github-pr:80');
});

test('unrelated PR is ignored', () => {
  const claims = deriveOpenPullClaims(
    state(),
    [pr(82, 'pipeline/control-plane-freshness-gate', ['apps/studio/index.html'])],
  );
  assert.equal(claims.size, 0);
});

test('PR touching two owned workstreams fails closed as ambiguous ownership', () => {
  assert.throws(
    () =>
      deriveOpenPullClaims(
        state(),
        [
          pr(999, 'bad-overlap', [
            'experiments/BYJTT-LAB-001/candidates/godot/a.gd',
            'experiments/BYJTT-LAB-001/candidates/playcanvas/b.ts',
          ]),
        ],
      ),
    /overlaps multiple workstreams/,
  );
});

test('two open PRs owning the same workstream fail closed', () => {
  assert.throws(
    () =>
      deriveOpenPullClaims(state(), [
        pr(80, 'benchmark/001-godot', ['experiments/BYJTT-LAB-001/candidates/godot/a.gd']),
        pr(81, 'benchmark/001-godot-2', ['experiments/BYJTT-LAB-001/candidates/godot/b.gd']),
      ]),
    /multiple open PR owners/,
  );
});

test('audit reports ownership drift without mutating source state', () => {
  const input = state();
  const pull = pr(80, 'benchmark/001-godot', ['experiments/BYJTT-LAB-001/candidates/godot/a.gd']);
  const { drift } = auditOwnershipProjection(input, [pull]);
  assert.equal(drift.length, 1);
  assert.equal(drift[0].workstreamId, 'ws-godot');
  assert.equal(drift[0].expected.sessionId, 'github-pr:80');
  assert.equal(input.workstreams[1].sessionId, 'unclaimed');
});

test('closed github-pr claim is detected but generic external claims are not guessed away', () => {
  const input = state();
  input.workstreams[0].sessionId = 'github-pr:77';
  input.workstreams[1].sessionId = 'claimed-external-worker';
  const { drift } = auditOwnershipProjection(input, []);
  assert.deepEqual(drift.map(({ workstreamId }) => workstreamId), ['ws-playcanvas']);
});
