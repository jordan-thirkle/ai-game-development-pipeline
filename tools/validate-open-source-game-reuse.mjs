import { readFile } from 'node:fs/promises';

const path = process.argv[2] ?? 'registry/open-source-game-reuse.v1.json';
const failures = [];
const sha40 = /^[0-9a-f]{40}$/i;
const timestampPattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-](\d{2}):(\d{2}))$/;
const allowedCategories = new Set(['official_template_collection', 'whole_game_reference', 'mechanic_framework', 'asset_library', 'discovery_index']);
const allowedSourceTypes = new Set(['github_repository', 'official_website']);
const allowedRevisionStates = new Set(['immutable_commit', 'mutable_web_snapshot']);
const allowedAdoption = new Set(['drop_in_candidate', 'asset_source_candidate', 'architecture_reference', 'discovery_source']);
const allowedLicenceClasses = new Set(['permissive', 'copyleft', 'public_domain', 'mixed', 'unknown']);
const allowedCommercial = new Set(['allowed_with_conditions', 'blocked_for_drop_in', 'per_item_review_required']);
const allowedBoundary = new Set(['single_code_licence_reviewed', 'single_asset_licence_reviewed', 'code_and_assets_separated', 'mixed_requires_per_item_review']);
const allowedMaintenance = new Set(['active', 'stable', 'unknown']);
const allowedEffort = new Set(['low', 'medium', 'high', 'reference_only']);
const allowedRisk = new Set(['low', 'medium', 'high', 'unknown']);

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validTimestamp(value) {
  if (!nonEmpty(value)) return false;
  const m = value.match(timestampPattern);
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const second = Number(m[6]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const dim = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= dim[month - 1] && hour <= 23 && minute <= 59 && second <= 59 && !Number.isNaN(Date.parse(value));
}

function validTimezone(value) {
  if (!nonEmpty(value)) return false;
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: value }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

function requireEnum(value, allowed, label) {
  if (!allowed.has(value)) failures.push(`${label} has unsupported value: ${String(value)}`);
}

let registry;
try {
  registry = JSON.parse(await readFile(path, 'utf8'));
} catch (error) {
  console.error(`Unable to read reuse registry ${path}: ${error.message}`);
  process.exit(1);
}

if (registry?.schema_version !== '1.0.0') failures.push('schema_version must be 1.0.0');
if (!validTimestamp(registry?.last_verified_at)) failures.push('last_verified_at must be a calendar-valid offset-aware RFC3339 timestamp');
if (!validTimezone(registry?.verification_timezone)) failures.push('verification_timezone must be a valid IANA timezone');
if (registry?.policy?.external_discovery_required_before_bespoke !== true) failures.push('policy must require external discovery before bespoke implementation');
if (registry?.policy?.popularity_never_overrides_fit_or_licence !== true) failures.push('policy must prevent popularity from overriding fit/licence');
if (registry?.policy?.code_and_asset_licences_are_separate !== true) failures.push('policy must separate code and asset licences');
if (!Number.isInteger(registry?.policy?.rechallenge_days) || registry.policy.rechallenge_days < 1 || registry.policy.rechallenge_days > 365) failures.push('policy.rechallenge_days must be an integer from 1 to 365');
if (!Array.isArray(registry?.entries) || registry.entries.length < 4) failures.push('entries must contain at least four seed records');

const ids = new Set();
for (const entry of Array.isArray(registry?.entries) ? registry.entries : []) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    failures.push('entry records must be objects');
    continue;
  }
  const id = entry.entry_id ?? '<missing>';
  for (const field of ['entry_id', 'name', 'canonical_url', 'source_type', 'source_revision_status', 'version_or_revision', 'last_verified_at', 'evidence_status', 'adoption_status', 'notes']) {
    if (!nonEmpty(entry[field])) failures.push(`${id} requires non-empty ${field}`);
  }
  if (ids.has(entry.entry_id)) failures.push(`duplicate entry_id: ${entry.entry_id}`);
  ids.add(entry.entry_id);
  requireEnum(entry.category, allowedCategories, `${id}.category`);
  requireEnum(entry.source_type, allowedSourceTypes, `${id}.source_type`);
  requireEnum(entry.source_revision_status, allowedRevisionStates, `${id}.source_revision_status`);
  requireEnum(entry.adoption_status, allowedAdoption, `${id}.adoption_status`);
  if (entry.evidence_status !== 'SOURCE-VERIFIED') failures.push(`${id}.evidence_status must remain SOURCE-VERIFIED until separate execution evidence exists`);
  if (!validTimestamp(entry.last_verified_at)) failures.push(`${id}.last_verified_at must be calendar-valid RFC3339`);

  if (entry.source_type === 'github_repository') {
    if (entry.source_revision_status !== 'immutable_commit') failures.push(`${id} GitHub repository must use immutable_commit provenance`);
    if (!sha40.test(entry.version_or_revision ?? '')) failures.push(`${id} GitHub repository requires a 40-character commit SHA`);
    if (!/^https:\/\/github\.com\//.test(entry.canonical_url ?? '')) failures.push(`${id} github_repository canonical_url must be github.com`);
  }

  const licensing = entry.licensing;
  if (!licensing || typeof licensing !== 'object' || Array.isArray(licensing)) {
    failures.push(`${id}.licensing must be an object`);
  } else {
    for (const field of ['code_license', 'asset_license', 'license_class', 'boundary_status', 'commercial_use_status']) {
      if (!nonEmpty(licensing[field])) failures.push(`${id}.licensing.${field} is required`);
    }
    requireEnum(licensing.license_class, allowedLicenceClasses, `${id}.licensing.license_class`);
    requireEnum(licensing.boundary_status, allowedBoundary, `${id}.licensing.boundary_status`);
    requireEnum(licensing.commercial_use_status, allowedCommercial, `${id}.licensing.commercial_use_status`);
  }

  const fit = entry.fit;
  if (!fit || typeof fit !== 'object' || Array.isArray(fit)) {
    failures.push(`${id}.fit must be an object`);
  } else {
    if (!nonEmpty(fit.engine_or_stack)) failures.push(`${id}.fit.engine_or_stack is required`);
    if (!Array.isArray(fit.platforms) || fit.platforms.length === 0 || fit.platforms.some((p) => !nonEmpty(p))) failures.push(`${id}.fit.platforms requires non-empty strings`);
    requireEnum(fit.maintenance_signal, allowedMaintenance, `${id}.fit.maintenance_signal`);
    requireEnum(fit.integration_effort, allowedEffort, `${id}.fit.integration_effort`);
  }

  const risk = entry.risk;
  if (!risk || typeof risk !== 'object' || Array.isArray(risk)) {
    failures.push(`${id}.risk must be an object`);
  } else {
    requireEnum(risk.dependency_burden, allowedRisk, `${id}.risk.dependency_burden`);
    requireEnum(risk.supply_chain, allowedRisk, `${id}.risk.supply_chain`);
    requireEnum(risk.licence, allowedRisk, `${id}.risk.licence`);
  }

  if (entry.adoption_status === 'drop_in_candidate') {
    if (licensing?.commercial_use_status !== 'allowed_with_conditions') failures.push(`${id} drop_in_candidate requires commercial_use_status=allowed_with_conditions`);
    if (!['permissive', 'public_domain'].includes(licensing?.license_class)) failures.push(`${id} drop_in_candidate requires permissive or public_domain licence class`);
    if (licensing?.boundary_status === 'mixed_requires_per_item_review') failures.push(`${id} drop_in_candidate cannot have unresolved mixed licence boundaries`);
  }

  if (entry.adoption_status === 'asset_source_candidate') {
    if (!['public_domain', 'permissive'].includes(licensing?.license_class)) failures.push(`${id} asset_source_candidate requires public_domain or permissive licence class`);
    if (licensing?.commercial_use_status !== 'allowed_with_conditions') failures.push(`${id} asset_source_candidate requires reviewed commercial-use status`);
  }

  if (['copyleft', 'mixed', 'unknown'].includes(licensing?.license_class) && entry.adoption_status === 'drop_in_candidate') {
    failures.push(`${id} copyleft/mixed/unknown licence cannot be silently promoted to drop_in_candidate`);
  }
}

const categories = new Set((registry?.entries ?? []).map((entry) => entry?.category));
for (const required of ['official_template_collection', 'whole_game_reference', 'mechanic_framework', 'asset_library']) {
  if (!categories.has(required)) failures.push(`seed registry must cover category: ${required}`);
}

if (failures.length > 0) {
  console.error('External open-source/game-reuse registry validation failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`External reuse registry valid: ${registry.entries.length} entries across ${categories.size} categories.`);
