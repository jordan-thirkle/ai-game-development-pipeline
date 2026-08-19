import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateLifecycleStatus, validateGameStatus } from './check-lifecycle-status.mjs';

function healthy(evidence) {
  return { status: 'healthy', evidence };
}

function record(overrides = {}) {
  const base = {
    schemaVersion: '1.0.0',
    gameId: 'fixture-game',
    repository: 'owner/repo',
    lifecycleStage: 'production',
    runtime: { name: 'fixture-runtime', version: '1.0.0', decisionEvidence: 'docs/runtime.md' },
    releases: [{ platform: 'web', channel: 'preview', status: 'testing', version: '0.1.0', buildId: 'build-1', releasedAt: null }],
    health: {
      telemetry: healthy('evidence/telemetry.json'),
      crashReporting: healthy('evidence/crashes.json'),
      releasePipeline: healthy('evidence/release.json'),
      commerce: { status: 'not-applicable', evidence: null },
      support: healthy('evidence/support.md')
    },
    monetisation: { model: [], state: 'none', activeExperiment: null, economicsEvidence: null },
    maintenance: {
      policy: 'Monthly dependency and platform review.',
      lastDependencyReview: null,
      lastPlatformReview: null,
      risks: []
    },
    evidence: {
      pipelineRuns: ['evidence/pipeline-run.json'],
      releaseEvidence: ['evidence/release.json'],
      publicationSafe: ['evidence/public-summary.json']
    },
    nextReview: { date: '2026-09-01', action: 'Review launch evidence.' }
  };
  return { ...base, ...overrides };
}

test('schema-valid production record passes its current-stage gate', async () => {
  const candidate = record();
  const validation = await validateGameStatus(candidate);
  assert.equal(validation.valid, true);
  assert.deepEqual(evaluateLifecycleStatus(candidate), {
    result: 'pass', currentStage: 'production', targetStage: 'production', blockers: []
  });
});

test('soft launch promotion blocks missing telemetry evidence instead of inferring pass', () => {
  const candidate = record({
    health: { ...record().health, telemetry: { status: 'unknown', evidence: null } }
  });
  const outcome = evaluateLifecycleStatus(candidate, 'soft-launch');
  assert.equal(outcome.result, 'blocked');
  assert.ok(outcome.blockers.includes('Telemetry is not healthy with evidence.'));
});

test('public release requires live release and publication-safe evidence', () => {
  const candidate = record({
    lifecycleStage: 'soft-launch',
    evidence: { ...record().evidence, publicationSafe: [] }
  });
  const outcome = evaluateLifecycleStatus(candidate, 'public-release');
  assert.equal(outcome.result, 'blocked');
  assert.ok(outcome.blockers.includes('No live release exists.'));
  assert.ok(outcome.blockers.includes('No publication-safe evidence is recorded.'));
});

test('public release passes when release and evidence are proven', () => {
  const candidate = record({
    lifecycleStage: 'soft-launch',
    releases: [{ platform: 'web', channel: 'production', status: 'live', version: '1.0.0', buildId: 'build-2', releasedAt: '2026-08-19T05:00:00Z' }]
  });
  const outcome = evaluateLifecycleStatus(candidate, 'public-release');
  assert.equal(outcome.result, 'pass');
  assert.deepEqual(outcome.blockers, []);
});

test('critical unresolved risks block every stage', () => {
  const candidate = record({
    maintenance: {
      ...record().maintenance,
      risks: [{ severity: 'P1', risk: 'Save corruption unresolved', status: 'mitigating', evidence: 'evidence/save-failure.md' }]
    }
  });
  const outcome = evaluateLifecycleStatus(candidate, 'production');
  assert.equal(outcome.result, 'blocked');
  assert.ok(outcome.blockers.some((blocker) => blocker.includes('Save corruption unresolved')));
});

test('gate rejects skipping more than one lifecycle stage', () => {
  const outcome = evaluateLifecycleStatus(record(), 'public-release');
  assert.equal(outcome.result, 'blocked');
  assert.ok(outcome.blockers.some((blocker) => blocker.startsWith('Cannot skip lifecycle stages')));
});

test('maintenance requires dated dependency and platform reviews', () => {
  const candidate = record({ lifecycleStage: 'liveops' });
  const outcome = evaluateLifecycleStatus(candidate, 'maintenance');
  assert.equal(outcome.result, 'blocked');
  assert.ok(outcome.blockers.includes('Dependency review date is missing.'));
  assert.ok(outcome.blockers.includes('Platform review date is missing.'));
});

test('maintenance can pass with paused releases once maintenance evidence is current', () => {
  const candidate = record({
    lifecycleStage: 'liveops',
    releases: [{ platform: 'web', channel: 'production', status: 'paused', version: '1.4.0', buildId: 'build-14', releasedAt: '2026-08-01T09:00:00Z' }],
    maintenance: {
      ...record().maintenance,
      lastDependencyReview: '2026-08-18',
      lastPlatformReview: '2026-08-18'
    }
  });
  const outcome = evaluateLifecycleStatus(candidate, 'maintenance');
  assert.equal(outcome.result, 'pass');
  assert.deepEqual(outcome.blockers, []);
});

test('retirement requires every release to be paused or retired', () => {
  const candidate = record({ lifecycleStage: 'maintenance' });
  const outcome = evaluateLifecycleStatus(candidate, 'retirement');
  assert.equal(outcome.result, 'blocked');
  assert.ok(outcome.blockers.some((blocker) => blocker.includes('is still testing')));
});
