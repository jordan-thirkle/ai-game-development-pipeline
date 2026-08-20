import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

const DEFAULT_API = 'https://api.github.com';
const QUALIFIED_STATES = new Set(['qualified', 'benchmarking', 'promoted']);

export function licenseClass(spdx) {
  const value = (spdx ?? '').toUpperCase();
  if (!value || value === 'NOASSERTION') return 'unknown';
  if (value.startsWith('GPL') || value.startsWith('AGPL')) return 'strong_copyleft';
  if (value === 'MPL-2.0' || value.startsWith('LGPL')) return 'weak_copyleft';
  if (['MIT', 'APACHE-2.0', 'BSD-2-CLAUSE', 'BSD-3-CLAUSE', 'ISC', 'CC0-1.0', 'UNLICENSE'].includes(value)) return 'permissive';
  return 'other';
}

export function isGenericIndex(repo) {
  const name = (repo?.name ?? '').toLowerCase();
  const description = (repo?.description ?? '').toLowerCase();
  return name.startsWith('awesome') || name.includes('awesome-') || /(^|[-_])resources?($|[-_])/.test(name) || /curated list|awesome list|collection of (links|resources)|list of (links|resources|tools|libraries)/.test(description);
}

function textFor(repo) { return `${repo?.name ?? ''} ${repo?.description ?? ''} ${(repo?.topics ?? []).join(' ')}`.toLowerCase(); }
function containsAny(text, needles = []) { return needles.some((needle) => text.includes(needle.toLowerCase())); }

export function taskEligibility(repo, capability) {
  const text = textFor(repo);
  for (const signal of capability.require_signals ?? []) if (!text.includes(signal.toLowerCase())) return { eligible: false, reason: `missing_required_signal:${signal}` };
  if (isGenericIndex(repo)) return { eligible: false, reason: 'generic_index_not_direct_component' };
  if (!containsAny(text, capability.required_any)) return { eligible: false, reason: 'missing_primary_task_signal' };
  if (!containsAny(text, capability.secondary_any)) return { eligible: false, reason: 'missing_secondary_task_signal' };
  return { eligible: true, reason: 'task_metadata_match' };
}

function daysSince(dateString, nowMs) { const parsed = Date.parse(dateString); return Number.isFinite(parsed) ? (nowMs - parsed) / 86_400_000 : Infinity; }
export function maintenanceClass(pushedAt, nowMs = Date.now()) { const days = daysSince(pushedAt, nowMs); return days <= 180 ? 'active' : days <= 730 ? 'stable' : 'stale'; }

function rankScore(repo, capability, nowMs) {
  const text = textFor(repo);
  const primary = (capability.required_any ?? []).filter((k) => text.includes(k.toLowerCase())).length;
  const secondary = (capability.secondary_any ?? []).filter((k) => text.includes(k.toLowerCase())).length;
  const required = (capability.require_signals ?? []).filter((k) => text.includes(k.toLowerCase())).length;
  const age = daysSince(repo?.pushed_at, nowMs);
  const maintenance = age <= 180 ? 3 : age <= 730 ? 1 : -2;
  const licence = licenseClass(repo?.license?.spdx_id);
  const licenceScore = licence === 'permissive' ? 3 : licence === 'strong_copyleft' ? -5 : licence === 'weak_copyleft' ? 0 : -1;
  const popularity = Math.min(2, Math.log10((repo?.stargazers_count ?? 0) + 1) / 2);
  return (primary * 3 + secondary + required) * 8 + maintenance * 2 + licenceScore * 2 + popularity;
}

export async function loadCanonicalReuseRegistry(registryDir = 'registry/reuse') {
  const files = (await readdir(registryDir, { withFileTypes: true })).filter((entry) => entry.isFile() && entry.name.endsWith('.json')).map((entry) => path.join(registryDir, entry.name)).sort();
  const records = [];
  for (const file of files) records.push(JSON.parse(await readFile(file, 'utf8')));
  return records;
}

function canonicalCandidate(record, capabilityId) {
  const url = record.source?.canonicalUrl ?? record.source?.repositoryUrl;
  if (!url) return null;
  const repository = record.source?.repositoryUrl?.match(/^https:\/\/github\.com\/([^/]+\/[^/#]+)$/)?.[1] ?? null;
  const qualified = QUALIFIED_STATES.has(record.state);
  return {
    candidate_id: `canonical.${record.id}`,
    capabilities: [capabilityId],
    origin: 'canonical_registry',
    source_url: url,
    repository,
    revision: record.source?.commit ?? null,
    stars: null,
    forks: null,
    license_spdx: record.licence?.identifier ?? null,
    maintenance: record.maintenance?.status === 'active' ? 'active' : record.maintenance?.status === 'stable-static' ? 'stable' : record.maintenance?.status === 'not-applicable' ? 'not-applicable' : record.maintenance?.status === 'inactive' ? 'stale' : 'unknown',
    screening_status: qualified ? 'canonical_qualified' : 'canonical_unqualified',
    canonical_record_id: record.id,
    canonical_state: record.state,
    publication_eligible: record.publication?.safe === true && qualified,
    reason: `Existing canonical reuse record ${record.id}; worker preserves state=${record.state} and cannot promote it.`
  };
}

function discoveredCandidate(repo, capabilityId, revision, nowMs) {
  const spdx = repo?.license?.spdx_id ?? null;
  const cls = licenseClass(spdx);
  const screening = cls === 'strong_copyleft' ? 'reference_only' : cls === 'unknown' ? 'blocked_license' : 'discovered_review_required';
  return {
    candidate_id: `github.${repo.full_name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-')}`,
    capabilities: [capabilityId], origin: 'github_search', source_url: repo.html_url ?? `https://github.com/${repo.full_name}`, repository: repo.full_name, revision,
    stars: repo.stargazers_count ?? 0, forks: repo.forks_count ?? 0, license_spdx: spdx, maintenance: maintenanceClass(repo.pushed_at, nowMs),
    screening_status: screening, canonical_record_id: null, canonical_state: null, publication_eligible: false,
    reason: `New GitHub discovery for ${capabilityId}; repository metadata licence=${spdx ?? 'unknown'} is advisory only. Full #118 provenance/licence/maintenance/risk review remains required.`
  };
}

function githubHeaders(token) { return { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'byjtt-bounded-external-discovery-v2', ...(token ? { Authorization: `Bearer ${token}` } : {}) }; }
async function githubJson(fetchImpl, apiBase, apiPath, token) { const response = await fetchImpl(`${apiBase}${apiPath}`, { headers: githubHeaders(token) }); if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${(await response.text()).slice(0, 500)}`); return response.json(); }

export async function loadValidators({ briefSchemaPath = 'schemas/external-discovery-brief.schema.json', queueSchemaPath = 'schemas/external-discovery-queue.schema.json' } = {}) {
  const [briefSchema, queueSchema] = await Promise.all([readFile(briefSchemaPath, 'utf8').then(JSON.parse), readFile(queueSchemaPath, 'utf8').then(JSON.parse)]);
  const ajv = new Ajv2020({ allErrors: true, strict: false }); addFormats(ajv); return { brief: ajv.compile(briefSchema), queue: ajv.compile(queueSchema) };
}
export function formatValidationErrors(errors = []) { return errors.map((error) => `${error.instancePath || '/'} ${error.message}`).join('; '); }

export async function runExternalDiscoveryV2({ brief, canonicalRecords, fetchImpl = globalThis.fetch, token = '', apiBase = DEFAULT_API, now = () => new Date(), perfNow = () => performance.now() } = {}) {
  if (!brief || typeof brief !== 'object') throw new TypeError('brief is required');
  if (!Array.isArray(canonicalRecords)) throw new TypeError('canonicalRecords must be an array');
  const started = now(); const startedMs = started.getTime(); const t0 = perfNow();
  let searchActions = 0; let sourceFetches = 0; const queryLog = []; const queueByKey = new Map(); const perCapability = {}; const revisionCache = new Map();
  const canonicalById = new Map(canonicalRecords.map((record) => [record.id, record]));
  async function exactRevision(repo) { const key = repo.full_name.toLowerCase(); if (revisionCache.has(key)) return revisionCache.get(key); const branch = await githubJson(fetchImpl, apiBase, `/repos/${repo.full_name}/branches/${encodeURIComponent(repo.default_branch)}`, token); sourceFetches += 1; const sha = branch?.commit?.sha; if (!/^[0-9a-f]{40}$/.test(sha ?? '')) throw new Error(`Repository ${repo.full_name} returned invalid revision`); revisionCache.set(key, sha); return sha; }
  function add(candidate, capabilityId, ids) { if (!candidate) return; const key = `${candidate.origin}:${candidate.canonical_record_id ?? candidate.repository}`.toLowerCase(); const existing = queueByKey.get(key); if (existing) existing.capabilities = [...new Set([...existing.capabilities, capabilityId])]; else queueByKey.set(key, candidate); ids.push(candidate.candidate_id); }
  for (const capability of brief.capabilities) {
    const ids = [];
    for (const seedId of capability.canonical_seed_ids ?? []) add(canonicalCandidate(canonicalById.get(seedId), capability.id), capability.id, ids);
    searchActions += 1;
    const search = await githubJson(fetchImpl, apiBase, `/search/repositories?q=${encodeURIComponent(`${capability.query} in:name,description`)}&sort=stars&order=desc&per_page=${brief.max_results_per_query}`, token);
    const raw = (search.items ?? []).filter((repo) => !repo.archived && !repo.disabled);
    const screened = raw.map((repo) => ({ repo, eligibility: taskEligibility(repo, capability) }));
    const eligible = screened.filter((item) => item.eligibility.eligible).map(({ repo }) => ({ repo, score: rankScore(repo, capability, startedMs) })).sort((a, b) => b.score - a.score || (b.repo.stargazers_count ?? 0) - (a.repo.stargazers_count ?? 0));
    queryLog.push({ capability_id: capability.id, query: capability.query, returned: raw.length, eligible_after_metadata_screen: eligible.length, rejected_as_irrelevant_or_index: screened.length - eligible.length });
    if (eligible[0]) add(discoveredCandidate(eligible[0].repo, capability.id, await exactRevision(eligible[0].repo), startedMs), capability.id, ids);
    perCapability[capability.id] = [...new Set(ids)];
  }
  const queue = [...queueByKey.values()]; const byId = new Map(queue.map((candidate) => [candidate.candidate_id, candidate]));
  const covered = brief.capabilities.filter((capability) => (perCapability[capability.id] ?? []).length > 0).length;
  const canonicalQualified = brief.capabilities.filter((capability) => (perCapability[capability.id] ?? []).some((id) => byId.get(id)?.screening_status === 'canonical_qualified')).length;
  const gaps = brief.capabilities.filter((capability) => (perCapability[capability.id] ?? []).length === 0).map((capability) => capability.id);
  const ended = now();
  return { schema_version: '2.0.0', brief_id: brief.brief_id, mode: 'bounded_external_discovery_v2', measurement_status: 'instrumented', started_at: started.toISOString(), ended_at: ended.toISOString(), search_actions: searchActions, source_fetches: sourceFetches, candidate_count: queue.length, canonical_candidate_count: queue.filter((c) => c.origin === 'canonical_registry').length, new_discovery_count: queue.filter((c) => c.origin === 'github_search').length, capability_candidate_coverage_pct: Math.round(covered / brief.capabilities.length * 100), canonical_qualified_coverage_pct: Math.round(canonicalQualified / brief.capabilities.length * 100), unsafe_promotions: 0, elapsed_minutes: Number(((perfNow() - t0) / 60000).toFixed(3)), queue, query_log: queryLog, per_capability: perCapability, gaps, notes: 'On-demand advisory discovery only. Existing canonical states are preserved. New GitHub discoveries are never qualified or publication-eligible until #118 reviewer-controlled validation clears provenance, licence, maintenance, risk and execution requirements.' };
}
