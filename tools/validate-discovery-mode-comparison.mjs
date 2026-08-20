import { readFile } from 'node:fs/promises';

const comparisonPath = process.argv[2] ?? 'examples/creator-mode/discovery-comparison-001.json';
const allowPendingWorker = process.argv.includes('--allow-pending-worker');
const workerFlagIndex = process.argv.indexOf('--worker-result');
const workerPath = workerFlagIndex >= 0 ? process.argv[workerFlagIndex + 1] : null;

const comparison = JSON.parse(await readFile(comparisonPath, 'utf8'));
const errors = [];
const SHA40 = /^[0-9a-f]{40}$/;
const ZERO_SHA = /^0{40}$/;

function assert(condition, message) {
  if (!condition) errors.push(message);
}

function validateCandidate(candidate, owner) {
  assert(candidate && typeof candidate === 'object', `${owner} candidate must be an object`);
  if (!candidate || typeof candidate !== 'object') return;
  assert(typeof candidate.candidate_id === 'string' && candidate.candidate_id.length > 0, `${owner} candidate_id is required`);
  assert(typeof candidate.repository === 'string' && candidate.repository.includes('/'), `${owner} ${candidate.candidate_id} repository must be owner/name`);
  assert(typeof candidate.revision === 'string' && SHA40.test(candidate.revision), `${owner} ${candidate.candidate_id} revision must be an exact 40-character Git SHA`);
  assert(!ZERO_SHA.test(candidate.revision ?? ''), `${owner} ${candidate.candidate_id} revision may not use an all-zero placeholder SHA`);
  assert(Array.isArray(candidate.capabilities) && candidate.capabilities.length > 0, `${owner} ${candidate.candidate_id} must map to at least one capability`);
  for (const capability of candidate.capabilities ?? []) {
    assert(comparison.capabilities.includes(capability), `${owner} ${candidate.candidate_id} references unknown capability ${capability}`);
  }
  if (candidate.screening_status === 'reviewable') {
    assert(candidate.asset_boundary === 'cleared' || candidate.asset_boundary === 'not_applicable', `${owner} ${candidate.candidate_id} reviewable candidate must have a cleared/not-applicable asset boundary`);
    assert(candidate.dependency_boundary === 'cleared' || candidate.dependency_boundary === 'not_applicable', `${owner} ${candidate.candidate_id} reviewable candidate must have a cleared/not-applicable dependency boundary`);
  }
  if (!candidate.license_spdx) {
    assert(candidate.screening_status !== 'reviewable', `${owner} ${candidate.candidate_id} cannot be reviewable without an explicit licence identifier`);
  }
}

function recompute(mode) {
  const covered = new Set();
  const fullyCleared = new Set();
  for (const candidate of mode.queue ?? []) {
    for (const capability of candidate.capabilities ?? []) {
      covered.add(capability);
      if (candidate.screening_status === 'reviewable') fullyCleared.add(capability);
    }
  }
  return {
    candidateCount: mode.queue?.length ?? 0,
    reviewableCount: (mode.queue ?? []).filter((candidate) => candidate.screening_status === 'reviewable').length,
    coveragePct: Math.round((covered.size / comparison.capabilities.length) * 100),
    clearedCoveragePct: Math.round((fullyCleared.size / comparison.capabilities.length) * 100),
  };
}

assert(comparison.schema_version === '1.0.0', 'schema_version must remain 1.0.0');
assert(comparison.comparison_id === 'DISCOVERY-COMPARISON-001', 'comparison_id must remain DISCOVERY-COMPARISON-001');
assert(comparison.brief?.title === 'Mobile co-op survival-builder', 'comparison brief must remain frozen to Mobile co-op survival-builder');
assert(Array.isArray(comparison.capabilities) && comparison.capabilities.length === 12, 'comparison must contain exactly the frozen 12 capabilities');
assert(new Set(comparison.capabilities ?? []).size === 12, 'comparison capabilities must be unique');

const baseline = comparison.interactive_baseline;
assert(baseline?.mode === 'interactive_manual_agent', 'interactive baseline mode must be interactive_manual_agent');
assert(baseline?.measurement_status === 'action_counts_only', 'interactive baseline must remain action_counts_only');
assert(baseline?.search_actions === 17, 'interactive baseline search_actions must remain frozen at 17');
assert(baseline?.source_fetches === 21, 'interactive baseline source_fetches must remain frozen at 21 after provenance correction');
assert(baseline?.unsafe_promotions === 0, 'interactive baseline unsafe_promotions must remain zero');
for (const candidate of baseline?.queue ?? []) validateCandidate(candidate, 'interactive_baseline');
const baselineMetrics = recompute(baseline);
assert(baseline.candidate_count === baselineMetrics.candidateCount, `interactive baseline candidate_count must equal recomputed ${baselineMetrics.candidateCount}`);
assert(baseline.reviewable_candidate_count === baselineMetrics.reviewableCount, `interactive baseline reviewable_candidate_count must equal recomputed ${baselineMetrics.reviewableCount}`);
assert(baseline.capability_candidate_coverage_pct === baselineMetrics.coveragePct, `interactive baseline capability_candidate_coverage_pct must equal recomputed ${baselineMetrics.coveragePct}`);
assert(baseline.fully_cleared_capability_coverage_pct === baselineMetrics.clearedCoveragePct, `interactive baseline fully_cleared_capability_coverage_pct must equal recomputed ${baselineMetrics.clearedCoveragePct}`);

const pending = comparison.bounded_worker;
assert(pending?.mode === 'bounded_discovery_worker', 'bounded worker mode must be bounded_discovery_worker');
if (allowPendingWorker) {
  assert(pending.measurement_status === 'pending', 'pre-execution bounded worker state must remain pending');
  assert((pending.queue ?? []).length === 0, 'pre-execution bounded worker queue must be empty');
}

if (workerPath) {
  const worker = JSON.parse(await readFile(workerPath, 'utf8'));
  assert(worker.mode === 'bounded_discovery_worker', 'worker result mode must be bounded_discovery_worker');
  assert(worker.measurement_status === 'instrumented', 'worker result must be instrumented');
  assert(Number.isInteger(worker.search_actions) && worker.search_actions === 12, 'worker must execute exactly 12 capability searches');
  assert(Number.isInteger(worker.source_fetches) && worker.source_fetches >= 0 && worker.source_fetches <= 12, 'worker source_fetches must be bounded to at most one revision fetch per capability');
  assert(worker.human_interventions === 0, 'bounded worker must require zero human interventions during execution');
  assert(worker.unsafe_promotions === 0, 'bounded worker must report zero unsafe promotions');
  assert(typeof worker.elapsed_minutes === 'number' && worker.elapsed_minutes >= 0, 'worker elapsed_minutes must be instrumented');
  for (const candidate of worker.queue ?? []) validateCandidate(candidate, 'bounded_worker');
  const workerMetrics = recompute(worker);
  assert(worker.candidate_count === workerMetrics.candidateCount, `worker candidate_count must equal recomputed ${workerMetrics.candidateCount}`);
  assert(worker.reviewable_candidate_count === workerMetrics.reviewableCount, `worker reviewable_candidate_count must equal recomputed ${workerMetrics.reviewableCount}`);
  assert(worker.capability_candidate_coverage_pct === workerMetrics.coveragePct, `worker capability_candidate_coverage_pct must equal recomputed ${workerMetrics.coveragePct}`);
  assert(worker.fully_cleared_capability_coverage_pct === workerMetrics.clearedCoveragePct, `worker fully_cleared_capability_coverage_pct must equal recomputed ${workerMetrics.clearedCoveragePct}`);
  const totalActions = worker.search_actions + worker.source_fetches;
  assert(totalActions < baseline.search_actions + baseline.source_fetches, `worker must use fewer external actions than frozen baseline (${baseline.search_actions + baseline.source_fetches})`);
}

assert(comparison.decision?.agent_deployment_approved === false, 'comparison may not pre-approve agent deployment');
assert(comparison.decision?.public_library_deployment_approved === false, 'comparison may not pre-approve public library deployment');

if (errors.length) {
  console.error('Discovery mode comparison validation failed:\n');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Discovery mode comparison valid: baseline=${baseline.search_actions + baseline.source_fetches} actions; worker=${workerPath ? 'instrumented result validated' : 'pending'}; deployment gates remain closed.`);
