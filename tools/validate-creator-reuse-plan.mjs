import { readFile } from 'node:fs/promises';

const planPath = process.argv[2] ?? 'examples/creator-mode/reuse-plan-001.json';
const registryPath = process.argv[3] ?? 'registry/open-source-game-reuse.v1.json';
const failures = [];
const sha40 = /^[0-9a-f]{40}$/i;

function fail(message) {
  failures.push(message);
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function sameClearance(planSnapshot, entry) {
  const licensing = entry?.licensing ?? {};
  return (
    planSnapshot?.evidence_status === entry?.evidence_status &&
    planSnapshot?.code === licensing.code_clearance_status &&
    planSnapshot?.assets === licensing.asset_clearance_status &&
    planSnapshot?.dependencies === entry?.dependency_clearance_status
  );
}

function eligibleForPlanReuse(entry, decision) {
  if (!entry) return false;
  if (!['reuse_unchanged', 'adapt'].includes(decision)) return false;

  const licensing = entry.licensing ?? {};
  const allClear =
    ['cleared', 'not_applicable'].includes(licensing.code_clearance_status) &&
    ['cleared', 'not_applicable'].includes(licensing.asset_clearance_status) &&
    ['cleared', 'not_applicable'].includes(entry.dependency_clearance_status);

  if (!allClear) return false;
  if (licensing.commercial_use_status !== 'allowed_with_conditions') return false;
  if (['copyleft', 'mixed', 'unknown'].includes(licensing.license_class)) return false;

  if (entry.adoption_status === 'drop_in_candidate') return true;
  if (entry.adoption_status === 'asset_source_candidate' && ['asset', 'audio'].includes(entry.__capabilityKind)) return true;
  return false;
}

let plan;
let registry;
try {
  plan = JSON.parse(await readFile(planPath, 'utf8'));
} catch (error) {
  console.error(`Unable to read creator reuse plan ${planPath}: ${error.message}`);
  process.exit(1);
}
try {
  registry = JSON.parse(await readFile(registryPath, 'utf8'));
} catch (error) {
  console.error(`Unable to read external reuse registry ${registryPath}: ${error.message}`);
  process.exit(1);
}

if (plan?.schema_version !== '1.0.0') fail('schema_version must be 1.0.0');
if (!nonEmpty(plan?.plan_id)) fail('plan_id is required');
if (!nonEmpty(plan?.created_at) || Number.isNaN(Date.parse(plan.created_at))) fail('created_at must be a valid timestamp');
if (!asObject(plan?.brief)) fail('brief must be an object');
if (!asObject(plan?.source_registry)) fail('source_registry must be an object');
if (plan?.source_registry?.path !== 'registry/open-source-game-reuse.v1.json') fail('source_registry.path must use the canonical external reuse registry');
if (!sha40.test(plan?.source_registry?.revision ?? '')) fail('source_registry.revision must be a 40-character commit SHA');
if (plan?.source_registry?.dependency_pr !== 110) fail('source_registry.dependency_pr must point to PR #110 for dogfood 001');

for (const key of ['whole_starter_search_completed', 'mechanic_search_completed', 'free_asset_search_completed', 'internal_incumbent_checked_after_external']) {
  if (plan?.discovery?.[key] !== true) fail(`discovery.${key} must be true before the plan can pass`);
}

const entries = new Map((registry?.entries ?? []).map((entry) => [entry.entry_id, entry]));
const capabilities = Array.isArray(plan?.capabilities) ? plan.capabilities : [];
if (capabilities.length < 6) fail('plan must cover at least six generic capabilities');

const ids = new Set();
for (const capability of capabilities) {
  const id = capability?.capability_id ?? '<missing>';
  if (!nonEmpty(capability?.capability_id)) fail('every capability requires capability_id');
  if (ids.has(capability?.capability_id)) fail(`duplicate capability_id: ${capability.capability_id}`);
  ids.add(capability?.capability_id);

  if (capability?.external_search_completed !== true) fail(`${id} cannot make a decision before external_search_completed=true`);
  if (!Array.isArray(capability?.candidates_considered)) fail(`${id}.candidates_considered must be an array`);

  for (const candidateId of capability?.candidates_considered ?? []) {
    if (!entries.has(candidateId)) fail(`${id} references unknown candidate ${candidateId}`);
  }

  const selectedId = capability?.selected_entry_id;
  const selected = selectedId ? entries.get(selectedId) : null;
  if (selectedId && !selected) fail(`${id} selected_entry_id ${selectedId} is not in the registry`);
  if (selectedId && !(capability.candidates_considered ?? []).includes(selectedId)) fail(`${id} selected_entry_id must appear in candidates_considered`);

  if (selected) {
    selected.__capabilityKind = capability.kind;
    if (!sameClearance(capability.clearance_snapshot, selected)) {
      fail(`${id} clearance_snapshot must exactly match the selected registry entry; plan snapshots may not soften source evidence`);
    }
    delete selected.__capabilityKind;
  } else if (capability?.clearance_snapshot?.evidence_status !== 'UNKNOWN') {
    fail(`${id} with no selected source must keep evidence_status=UNKNOWN`);
  }

  if (['reuse_unchanged', 'adapt'].includes(capability?.decision)) {
    if (!selected) fail(`${id} ${capability.decision} requires selected_entry_id`);
    if (selected) {
      selected.__capabilityKind = capability.kind;
      if (!eligibleForPlanReuse(selected, capability.decision)) {
        fail(`${id} ${capability.decision} cannot use ${selected.entry_id}: source is not fully cleared and eligible for this capability kind`);
      }
      delete selected.__capabilityKind;
    }
  }

  if (capability?.decision === 'blocked_review') {
    if (!selected) fail(`${id} blocked_review requires a selected source under review`);
    if (selected) {
      const unresolved = [
        selected.licensing?.code_clearance_status,
        selected.licensing?.asset_clearance_status,
        selected.dependency_clearance_status,
      ].includes('requires_review');
      if (!unresolved) fail(`${id} blocked_review requires at least one machine-readable requires_review clearance`);
    }
  }

  if (capability?.decision === 'reference_only') {
    if (!selected) fail(`${id} reference_only requires selected_entry_id`);
    if (selected && !['architecture_reference', 'discovery_source'].includes(selected.adoption_status)) {
      fail(`${id} reference_only must select an architecture_reference or discovery_source`);
    }
  }

  if (capability?.decision === 'discovery_gap') {
    if (selectedId !== null) fail(`${id} discovery_gap must not select a production source`);
    if (!nonEmpty(capability?.gap_reason)) fail(`${id} discovery_gap requires gap_reason`);
    if (capability?.estimated_generic_work_avoided !== 'none') fail(`${id} discovery_gap cannot claim generic work avoided`);
  }

  if (capability?.decision === 'generate_gap') {
    if (selectedId !== null) fail(`${id} generate_gap must not select an external source`);
    if (!nonEmpty(capability?.gap_reason)) fail(`${id} generate_gap requires a documented external discovery gap`);
    if (capability?.kind === 'asset' || capability?.kind === 'audio') {
      if (plan?.discovery?.free_asset_search_completed !== true) fail(`${id} generation requires free asset discovery first`);
    }
  }

  if (capability?.decision === 'bespoke_last_resort') {
    if (selectedId !== null) fail(`${id} bespoke_last_resort must not select an external source`);
    if (!nonEmpty(capability?.gap_reason)) fail(`${id} bespoke_last_resort requires a documented discovery gap`);
    if ((capability?.candidates_considered ?? []).length === 0) fail(`${id} bespoke_last_resort requires at least one external candidate/search path to have been considered`);
    if ((capability?.remaining_evidence ?? []).length === 0) fail(`${id} bespoke_last_resort requires evidence explaining why external candidates were rejected`);
  }
}

const counts = {
  generic_capabilities: capabilities.length,
  planned_reuse_or_adapt: capabilities.filter((c) => ['reuse_unchanged', 'adapt'].includes(c.decision)).length,
  blocked_review: capabilities.filter((c) => c.decision === 'blocked_review').length,
  discovery_gaps: capabilities.filter((c) => c.decision === 'discovery_gap').length,
  generation_decisions: capabilities.filter((c) => c.decision === 'generate_gap').length,
  bespoke_decisions: capabilities.filter((c) => c.decision === 'bespoke_last_resort').length,
};

for (const [key, expected] of Object.entries(counts)) {
  if (plan?.metrics?.[key] !== expected) fail(`metrics.${key} must equal recomputed value ${expected}`);
}
if (!Number.isInteger(plan?.metrics?.whole_starters_considered) || plan.metrics.whole_starters_considered < 1) fail('metrics.whole_starters_considered must be >= 1');
if (plan?.metrics?.realized_time_savings_claimed !== false) fail('realized_time_savings_claimed must remain false until implementation evidence exists');

const externalCoverage = capabilities.filter((c) => (c.candidates_considered ?? []).length > 0).length / Math.max(capabilities.length, 1);
const plannedReuseRate = counts.planned_reuse_or_adapt / Math.max(capabilities.length, 1);
if (plan?.metrics?.external_candidate_coverage_pct !== undefined && plan.metrics.external_candidate_coverage_pct !== Math.round(externalCoverage * 100)) {
  fail(`metrics.external_candidate_coverage_pct must equal recomputed value ${Math.round(externalCoverage * 100)}`);
}
if (plan?.metrics?.planned_reuse_or_adapt_pct !== undefined && plan.metrics.planned_reuse_or_adapt_pct !== Math.round(plannedReuseRate * 100)) {
  fail(`metrics.planned_reuse_or_adapt_pct must equal recomputed value ${Math.round(plannedReuseRate * 100)}`);
}

if (!nonEmpty(plan?.evidence_boundary) || !/no realized|claims no realized|no realised|claims no realised/i.test(plan.evidence_boundary)) {
  fail('evidence_boundary must explicitly deny realized time/quality improvement claims');
}

if (failures.length > 0) {
  console.error('Creator Mode reuse plan validation failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Creator reuse plan valid: ${capabilities.length} capabilities; ${counts.planned_reuse_or_adapt} reuse/adapt; ${counts.blocked_review} blocked; ${counts.discovery_gaps} discovery gaps; external candidate coverage=${Math.round(externalCoverage * 100)}%.`);
