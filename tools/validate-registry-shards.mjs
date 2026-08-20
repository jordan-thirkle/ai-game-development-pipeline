import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

const failures = [];
const indexPath = 'registry/ai-game-dev-registry.v1.json';

const timestampPattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-](\d{2}):(\d{2}))$/;
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

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    failures.push(`Unable to read ${path}: ${error.message}`);
    return null;
  }
}

const index = await readJson(indexPath);
if (!index) {
  process.exit(1);
}

if (!nonEmptyString(index.schema_version) || !/^\d+\.\d+\.\d+$/.test(index.schema_version)) failures.push(`${indexPath} requires a semantic-version schema_version`);
if (!isValidOffsetTimestamp(index.last_verified_at)) failures.push(`${indexPath} requires a calendar-valid offset-aware RFC3339 last_verified_at`);
if (!isValidIanaTimezone(index.verification_timezone)) failures.push(`${indexPath} requires a valid IANA verification_timezone`);
if (!nonEmptyString(index.policy_shard)) failures.push(`${indexPath} requires policy_shard`);
if (!Array.isArray(index.shards) || index.shards.length < 2) failures.push(`${indexPath} requires at least core and media shards`);

const shardIds = new Set();
const shardPaths = new Set();
for (const shard of index.shards ?? []) {
  if (!shard || typeof shard !== 'object') {
    failures.push(`${indexPath} shard records must be objects`);
    continue;
  }
  for (const field of ['shard_id', 'path', 'namespace']) {
    if (!nonEmptyString(shard[field])) failures.push(`${indexPath} shard requires non-empty string ${field}`);
  }
  if (shardIds.has(shard.shard_id)) failures.push(`Duplicate registry shard id: ${shard.shard_id}`);
  if (shardPaths.has(shard.path)) failures.push(`Duplicate registry shard path: ${shard.path}`);
  shardIds.add(shard.shard_id);
  shardPaths.add(shard.path);
  if (shard.required !== true) failures.push(`Registry shard ${shard.shard_id ?? '<missing>'} must currently be required`);
}
if (!shardPaths.has(index.policy_shard)) failures.push(`${indexPath} policy_shard must be listed in shards`);
if (index.rules?.repository_commit_is_the_atomic_registry_revision !== true) failures.push(`${indexPath} must declare repository commit as the atomic registry revision`);

const policy = await readJson(index.policy_shard);
const evidenceLabels = new Set(Array.isArray(policy?.evidence_labels) ? policy.evidence_labels : []);
const adoptionTokens = new Set(policy?.adoption_status_map && typeof policy.adoption_status_map === 'object' && !Array.isArray(policy.adoption_status_map) ? Object.values(policy.adoption_status_map) : []);
if (evidenceLabels.size === 0) failures.push(`Policy shard ${index.policy_shard} must expose evidence_labels`);
if (adoptionTokens.size === 0) failures.push(`Policy shard ${index.policy_shard} must expose adoption_status_map values`);

const loadedShards = [];
for (const shard of index.shards ?? []) {
  if (!nonEmptyString(shard?.path)) continue;
  const data = await readJson(shard.path);
  if (data) loadedShards.push({ meta: shard, data });
}

const benchmarkIds = new Set();
const entryIds = new Set();

for (const { meta, data } of loadedShards) {
  if (!Array.isArray(data.benchmarks)) failures.push(`${meta.path} requires a benchmarks array`);
  if (!Array.isArray(data.entries)) failures.push(`${meta.path} requires an entries array`);

  if (meta.path !== index.policy_shard) {
    if (!nonEmptyString(data.schema_version) || !/^\d+\.\d+\.\d+$/.test(data.schema_version)) failures.push(`${meta.path} requires semantic-version schema_version`);
    if (!isValidOffsetTimestamp(data.last_verified_at)) failures.push(`${meta.path} requires calendar-valid offset-aware last_verified_at`);
    if (!isValidIanaTimezone(data.verification_timezone)) failures.push(`${meta.path} requires valid IANA verification_timezone`);
    if (data.inherits_policy_from !== basename(index.policy_shard)) failures.push(`${meta.path} must inherit policy from ${basename(index.policy_shard)}`);
    if (!immutableRevision.test(data.research_revision ?? '')) failures.push(`${meta.path} requires immutable research_revision`);
  }

  for (const benchmark of data.benchmarks ?? []) {
    if (!benchmark || typeof benchmark !== 'object') {
      failures.push(`${meta.path} benchmark records must be objects`);
      continue;
    }
    for (const field of ['benchmark_id', 'name', 'category', 'canonical_url', 'revision']) {
      if (!nonEmptyString(benchmark[field])) failures.push(`${meta.path} benchmark ${benchmark.benchmark_id ?? '<missing>'} requires non-empty string ${field}`);
    }
    if (!immutableRevision.test(benchmark.revision ?? '')) failures.push(`${meta.path} benchmark ${benchmark.benchmark_id ?? '<missing>'} requires immutable Git SHA or sha256 revision`);
    if (benchmarkIds.has(benchmark.benchmark_id)) failures.push(`Duplicate global benchmark id: ${benchmark.benchmark_id}`);
    benchmarkIds.add(benchmark.benchmark_id);
  }
}

for (const { meta, data } of loadedShards) {
  for (const entry of data.entries ?? []) {
    if (!entry || typeof entry !== 'object') {
      failures.push(`${meta.path} entry records must be objects`);
      continue;
    }
    const id = entry.entry_id ?? '<missing>';
    for (const field of ['entry_id','name','category','canonical_url','source_type','source_revision_status','license','version_or_revision','last_verified_at','execution_status','benchmark_id','adoption_status','replacement_cost','lock_in_risk','license_review_status','redistribution_status']) {
      if (!nonEmptyString(entry[field])) failures.push(`${meta.path} entry ${id} requires non-empty string ${field}`);
    }
    if (entryIds.has(entry.entry_id)) failures.push(`Duplicate global entry id: ${entry.entry_id}`);
    entryIds.add(entry.entry_id);
    if (!evidenceLabels.has(entry.execution_status)) failures.push(`${meta.path} entry ${id} has invalid execution_status: ${entry.execution_status}`);
    if (!benchmarkIds.has(entry.benchmark_id)) failures.push(`${meta.path} entry ${id} joins unknown benchmark_id: ${entry.benchmark_id}`);
    const adoptionParts = nonEmptyString(entry.adoption_status) ? entry.adoption_status.split('+').filter(Boolean) : [];
    if (adoptionParts.length === 0 || adoptionParts.some((part) => !adoptionTokens.has(part))) failures.push(`${meta.path} entry ${id} has invalid adoption_status: ${entry.adoption_status}`);
    if (new Set(adoptionParts).size !== adoptionParts.length) failures.push(`${meta.path} entry ${id} repeats adoption status tokens`);
    if (adoptionParts.includes('rejected') && adoptionParts.length !== 1) failures.push(`${meta.path} entry ${id} cannot combine rejected with another adoption status`);
    if (!isValidOffsetTimestamp(entry.last_verified_at)) failures.push(`${meta.path} entry ${id} has invalid last_verified_at: ${entry.last_verified_at}`);
    if (/immutable.*commit/i.test(entry.source_revision_status ?? '') && !/^[0-9a-f]{40}$/i.test(entry.version_or_revision ?? '')) failures.push(`${meta.path} entry ${id} declares an immutable commit but version_or_revision is not a 40-character Git SHA`);
    if (meta.namespace === 'media' && entry.execution_status === 'EXECUTED') failures.push(`${meta.path} entry ${id} cannot be EXECUTED before a separate experiment record is materialized`);
  }
}

if (failures.length > 0) {
  console.error('Registry shard validation failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Registry index valid: ${loadedShards.length} shards, ${benchmarkIds.size} globally unique benchmarks, ${entryIds.size} globally unique entries.`);
