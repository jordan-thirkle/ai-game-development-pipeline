import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

const failures = [];
const indexPath = 'registry/ai-game-dev-registry.v1.json';

const timestampPattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-](\d{2}):(\d{2}))$/;
const gitRevision = /^[0-9a-f]{40}$/i;
const immutableRevision = /^(?:[0-9a-f]{40}|sha256:[0-9a-f]{64})$/i;

function isValidOffsetTimestamp(value) {
  if (typeof value !== 'string') return false;
  const match = value.match(timestampPattern);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = match[8] === undefined ? 0 : Number(match[8]);
  const offsetMinute = match[9] === undefined ? 0 : Number(match[9]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]) return false;
  if (hour > 23 || minute > 59 || second > 59 || offsetHour > 23 || offsetMinute > 59) return false;
  return !Number.isNaN(Date.parse(value));
}

function isValidIanaTimezone(value) {
  if (typeof value !== 'string' || value.length === 0) return false;
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: value }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function reportFailuresAndExit() {
  if (failures.length === 0) return false;
  console.error('Registry shard validation failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    failures.push(`Unable to read ${path}: ${error.message}`);
    return undefined;
  }
}

async function validateExecutedShardEntry(meta, entry, id) {
  if (meta.namespace === 'core' || entry.execution_status !== 'EXECUTED') return;
  const record = entry.execution_record;
  if (!isPlainObject(record)) {
    failures.push(`${meta.path} entry ${id} marked EXECUTED requires execution_record`);
    return;
  }
  if (!nonEmptyString(record.experiment_id)) {
    failures.push(`${meta.path} entry ${id} execution_record requires experiment_id`);
    return;
  }
  const pathMatch = nonEmptyString(record.path)
    ? record.path.match(/^experiments\/([A-Za-z0-9][A-Za-z0-9._-]*)\/experiment\.json$/)
    : null;
  if (!pathMatch) {
    failures.push(`${meta.path} entry ${id} execution_record.path must reference experiments/<id>/experiment.json without traversal segments`);
    return;
  }
  if (pathMatch[1] !== record.experiment_id) {
    failures.push(`${meta.path} entry ${id} execution_record.path directory must equal execution_record.experiment_id`);
    return;
  }
  const experiment = await readJson(record.path);
  if (experiment === undefined) return;
  if (!isPlainObject(experiment)) {
    failures.push(`${meta.path} entry ${id} execution evidence ${record.path} must contain a JSON object`);
    return;
  }
  if (experiment.experiment_id !== record.experiment_id) failures.push(`${meta.path} entry ${id} execution_record experiment_id does not match ${record.path}`);
  if (experiment.status !== 'completed') failures.push(`${meta.path} entry ${id} EXECUTED evidence experiment must have status=completed`);
  if (!Array.isArray(experiment.evidence) || experiment.evidence.length === 0) failures.push(`${meta.path} entry ${id} EXECUTED evidence experiment requires non-empty evidence`);
}

const index = await readJson(indexPath);
if (index === undefined) reportFailuresAndExit();
if (!isPlainObject(index)) {
  failures.push(`${indexPath} root must be a JSON object`);
  reportFailuresAndExit();
}

if (!nonEmptyString(index.schema_version) || !/^\d+\.\d+\.\d+$/.test(index.schema_version)) failures.push(`${indexPath} requires a semantic-version schema_version`);
if (!isValidOffsetTimestamp(index.last_verified_at)) failures.push(`${indexPath} requires a calendar-valid offset-aware RFC3339 last_verified_at`);
if (!isValidIanaTimezone(index.verification_timezone)) failures.push(`${indexPath} requires a valid IANA verification_timezone`);
if (!nonEmptyString(index.policy_shard)) failures.push(`${indexPath} requires policy_shard`);
if (!Array.isArray(index.shards) || index.shards.length < 2) failures.push(`${indexPath} requires core plus at least one non-core shard`);
const shards = Array.isArray(index.shards) ? index.shards : [];

const shardIds = new Set();
const shardPaths = new Set();
const shardNamespaces = new Set();
let policyMeta = null;
let nonCoreShardCount = 0;
for (const shard of shards) {
  if (!isPlainObject(shard)) {
    failures.push(`${indexPath} shard records must be objects`);
    continue;
  }
  for (const field of ['shard_id', 'path', 'namespace']) {
    if (!nonEmptyString(shard[field])) failures.push(`${indexPath} shard requires non-empty string ${field}`);
  }
  if (nonEmptyString(shard.shard_id)) {
    if (shardIds.has(shard.shard_id)) failures.push(`Duplicate registry shard id: ${shard.shard_id}`);
    shardIds.add(shard.shard_id);
  }
  if (nonEmptyString(shard.path)) {
    if (shardPaths.has(shard.path)) failures.push(`Duplicate registry shard path: ${shard.path}`);
    shardPaths.add(shard.path);
  }
  if (nonEmptyString(shard.namespace)) {
    if (shardNamespaces.has(shard.namespace)) failures.push(`Duplicate registry shard namespace: ${shard.namespace}`);
    shardNamespaces.add(shard.namespace);
    if (shard.namespace !== 'core') nonCoreShardCount += 1;
  }
  if (shard.path === index.policy_shard) policyMeta = shard;
  if (shard.required !== true) failures.push(`Registry shard ${shard.shard_id ?? '<missing>'} must currently be required`);
}
if (!shardPaths.has(index.policy_shard)) failures.push(`${indexPath} policy_shard must be listed in shards`);
if (policyMeta && policyMeta.namespace !== 'core') failures.push(`${indexPath} policy_shard must use namespace=core`);
if (nonCoreShardCount < 1) failures.push(`${indexPath} requires at least one non-core shard`);
// These flags document invariants that this validator enforces unconditionally; they are not runtime feature switches.
for (const rule of ['global_entry_ids_unique','global_benchmark_ids_unique','cross_shard_benchmark_joins_allowed','policy_enums_inherited_from_policy_shard','repository_commit_is_the_atomic_registry_revision','executed_non_core_entries_require_completed_evidence']) {
  if (index.rules?.[rule] !== true) failures.push(`${indexPath} must declare ${rule}=true`);
}

const policy = nonEmptyString(index.policy_shard) ? await readJson(index.policy_shard) : undefined;
if (policy !== undefined && !isPlainObject(policy)) failures.push(`Policy shard ${index.policy_shard} root must be a JSON object`);
const evidenceLabelsArray = isPlainObject(policy) && Array.isArray(policy.evidence_labels) && policy.evidence_labels.every(nonEmptyString);
const adoptionMapValid = isPlainObject(policy) && isPlainObject(policy.adoption_status_map) && Object.values(policy.adoption_status_map).every(nonEmptyString);
const evidenceLabels = new Set(evidenceLabelsArray ? policy.evidence_labels : []);
const adoptionTokens = new Set(adoptionMapValid ? Object.values(policy.adoption_status_map) : []);
if (!evidenceLabelsArray || evidenceLabels.size === 0) failures.push(`Policy shard ${index.policy_shard} must expose non-empty string evidence_labels`);
if (!adoptionMapValid || adoptionTokens.size === 0) failures.push(`Policy shard ${index.policy_shard} must expose non-empty string adoption_status_map values`);

const loadedShards = [];
for (const shard of shards) {
  if (!isPlainObject(shard) || !nonEmptyString(shard.path)) continue;
  const data = await readJson(shard.path);
  if (data === undefined) continue;
  if (!isPlainObject(data)) {
    failures.push(`${shard.path} root must be a JSON object`);
    continue;
  }
  loadedShards.push({ meta: shard, data });
}

const benchmarkIds = new Set();
const entryIds = new Set();

for (const { meta, data } of loadedShards) {
  const benchmarks = Array.isArray(data.benchmarks) ? data.benchmarks : [];
  if (!Array.isArray(data.benchmarks)) failures.push(`${meta.path} requires a benchmarks array`);
  if (!Array.isArray(data.entries)) failures.push(`${meta.path} requires an entries array`);
  if (!nonEmptyString(data.schema_version) || !/^\d+\.\d+\.\d+$/.test(data.schema_version)) failures.push(`${meta.path} requires semantic-version schema_version`);
  if (!isValidOffsetTimestamp(data.last_verified_at)) failures.push(`${meta.path} requires calendar-valid offset-aware last_verified_at`);
  if (!isValidIanaTimezone(data.verification_timezone)) failures.push(`${meta.path} requires valid IANA verification_timezone`);

  if (meta.path !== index.policy_shard) {
    if (data.inherits_policy_from !== basename(index.policy_shard)) failures.push(`${meta.path} must inherit policy from ${basename(index.policy_shard)}`);
    if (!immutableRevision.test(data.research_revision ?? '')) failures.push(`${meta.path} requires immutable research_revision`);
  }

  for (const benchmark of benchmarks) {
    if (!isPlainObject(benchmark)) {
      failures.push(`${meta.path} benchmark records must be objects`);
      continue;
    }
    for (const field of ['benchmark_id', 'name', 'category', 'canonical_url', 'revision']) {
      if (!nonEmptyString(benchmark[field])) failures.push(`${meta.path} benchmark ${benchmark.benchmark_id ?? '<missing>'} requires non-empty string ${field}`);
    }
    if (!immutableRevision.test(benchmark.revision ?? '')) failures.push(`${meta.path} benchmark ${benchmark.benchmark_id ?? '<missing>'} requires immutable Git SHA or sha256 revision`);
    if (nonEmptyString(benchmark.benchmark_id)) {
      if (benchmarkIds.has(benchmark.benchmark_id)) failures.push(`Duplicate global benchmark id: ${benchmark.benchmark_id}`);
      benchmarkIds.add(benchmark.benchmark_id);
    }
  }
}

for (const { meta, data } of loadedShards) {
  const entries = Array.isArray(data.entries) ? data.entries : [];
  for (const entry of entries) {
    if (!isPlainObject(entry)) {
      failures.push(`${meta.path} entry records must be objects`);
      continue;
    }
    const id = nonEmptyString(entry.entry_id) ? entry.entry_id : '<missing>';
    for (const field of ['entry_id','name','category','canonical_url','source_type','source_revision_status','license','version_or_revision','last_verified_at','execution_status','benchmark_id','adoption_status','replacement_cost','lock_in_risk','license_review_status','redistribution_status']) {
      if (!nonEmptyString(entry[field])) failures.push(`${meta.path} entry ${id} requires non-empty string ${field}`);
    }
    if (nonEmptyString(entry.entry_id)) {
      if (entryIds.has(entry.entry_id)) failures.push(`Duplicate global entry id: ${entry.entry_id}`);
      entryIds.add(entry.entry_id);
    }
    if (!evidenceLabels.has(entry.execution_status)) failures.push(`${meta.path} entry ${id} has invalid execution_status: ${entry.execution_status}`);
    if (!nonEmptyString(entry.benchmark_id) || !benchmarkIds.has(entry.benchmark_id)) failures.push(`${meta.path} entry ${id} joins unknown benchmark_id: ${entry.benchmark_id}`);
    const adoptionParts = nonEmptyString(entry.adoption_status) ? entry.adoption_status.split('+').filter(Boolean) : [];
    if (adoptionParts.length === 0 || adoptionParts.some((part) => !adoptionTokens.has(part))) failures.push(`${meta.path} entry ${id} has invalid adoption_status: ${entry.adoption_status}`);
    if (new Set(adoptionParts).size !== adoptionParts.length) failures.push(`${meta.path} entry ${id} repeats adoption status tokens`);
    if (adoptionParts.includes('rejected') && adoptionParts.length !== 1) failures.push(`${meta.path} entry ${id} cannot combine rejected with another adoption status`);
    if (!isValidOffsetTimestamp(entry.last_verified_at)) failures.push(`${meta.path} entry ${id} has invalid last_verified_at: ${entry.last_verified_at}`);

    const revisionStatus = entry.source_revision_status ?? '';
    if (/immutable.*commit/i.test(revisionStatus) && !gitRevision.test(entry.version_or_revision ?? '')) failures.push(`${meta.path} entry ${id} declares an immutable commit but version_or_revision is not a 40-character Git SHA`);
    if (/immutable_commit_and_model_revision/i.test(revisionStatus)) {
      if (!isPlainObject(entry.source_revisions)) failures.push(`${meta.path} entry ${id} requires source_revisions for composite immutable code/model provenance`);
      else {
        if (!gitRevision.test(entry.source_revisions.code_commit ?? '')) failures.push(`${meta.path} entry ${id} requires source_revisions.code_commit as a 40-character Git SHA`);
        if (!gitRevision.test(entry.source_revisions.model_revision ?? '')) failures.push(`${meta.path} entry ${id} requires source_revisions.model_revision as a 40-character Git SHA`);
        if (entry.source_revisions.code_commit !== entry.version_or_revision) failures.push(`${meta.path} entry ${id} version_or_revision must equal source_revisions.code_commit`);
      }
    }
    await validateExecutedShardEntry(meta, entry, id);
  }
}

reportFailuresAndExit();
console.log(`Registry index valid: ${loadedShards.length} shards, ${benchmarkIds.size} globally unique benchmarks, ${entryIds.size} globally unique entries.`);
