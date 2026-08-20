import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

const DEFAULT_API = 'https://api.github.com';

export function licenseClass(spdx) {
  const value = (spdx ?? '').toUpperCase();
  if (!value || value === 'NOASSERTION') return 'unknown';
  if (value.startsWith('GPL') || value.startsWith('AGPL')) return 'strong_copyleft';
  if (value === 'MPL-2.0' || value.startsWith('LGPL')) return 'file_or_weak_copyleft';
  if (['MIT', 'APACHE-2.0', 'BSD-2-CLAUSE', 'BSD-3-CLAUSE', 'ISC', 'CC0-1.0', 'UNLICENSE'].includes(value)) return 'permissive';
  return 'other';
}

export function isGenericIndex(repo) {
  const name = (repo?.name ?? '').toLowerCase();
  const description = (repo?.description ?? '').toLowerCase();
  return (
    name.startsWith('awesome') ||
    name.includes('awesome-') ||
    /(^|[-_])resources?($|[-_])/.test(name) ||
    /curated list|awesome list|collection of (links|resources)|list of (links|resources|tools|libraries)/.test(description) ||
    name.includes('mcp-server') ||
    name.includes('agency-agents')
  );
}

function textFor(repo) {
  return `${repo?.name ?? ''} ${repo?.description ?? ''} ${(repo?.topics ?? []).join(' ')}`.toLowerCase();
}

function containsAny(haystack, needles) {
  return needles.some((needle) => haystack.includes(needle.toLowerCase()));
}

export function taskEligibility(repo, capability) {
  const haystack = textFor(repo);
  for (const signal of capability.require_signals ?? []) {
    if (!haystack.includes(signal.toLowerCase())) {
      return { eligible: false, reason: `missing_required_signal:${signal}` };
    }
  }
  if (isGenericIndex(repo)) return { eligible: false, reason: 'generic_index_not_direct_component' };
  if (!containsAny(haystack, capability.required_any ?? [])) return { eligible: false, reason: 'missing_primary_task_signal' };
  if (!containsAny(haystack, capability.secondary_any ?? [])) return { eligible: false, reason: 'missing_secondary_task_signal' };
  return { eligible: true, reason: 'task_metadata_match' };
}

function daysSince(dateString, nowMs) {
  const parsed = Date.parse(dateString);
  if (!Number.isFinite(parsed)) return Infinity;
  return (nowMs - parsed) / 86_400_000;
}

export function maintenanceClass(pushedAt, nowMs = Date.now()) {
  const days = daysSince(pushedAt, nowMs);
  if (days <= 180) return 'active';
  if (days <= 730) return 'stable';
  return 'stale';
}

function taskFit(repo, capability) {
  const haystack = textFor(repo);
  const primary = (capability.required_any ?? []).reduce((score, keyword) => score + (haystack.includes(keyword.toLowerCase()) ? 1 : 0), 0);
  const secondary = (capability.secondary_any ?? []).reduce((score, keyword) => score + (haystack.includes(keyword.toLowerCase()) ? 1 : 0), 0);
  const requiredSignals = (capability.require_signals ?? []).reduce((score, signal) => score + (haystack.includes(signal.toLowerCase()) ? 1 : 0), 0);
  return primary * 3 + secondary + requiredSignals;
}

export function rankScore(repo, capability, nowMs = Date.now()) {
  const fit = taskFit(repo, capability);
  const age = daysSince(repo?.pushed_at, nowMs);
  const maintenanceScore = age <= 180 ? 3 : age <= 730 ? 1 : -2;
  const licence = licenseClass(repo?.license?.spdx_id);
  const licenceScore = licence === 'permissive' ? 3 : licence === 'file_or_weak_copyleft' ? 0 : licence === 'strong_copyleft' ? -5 : -1;
  const popularity = Math.min(2, Math.log10((repo?.stargazers_count ?? 0) + 1) / 2);
  return fit * 8 + maintenanceScore * 2 + licenceScore * 2 + popularity;
}

function normalizeRepositoryCandidate(repo, capabilityId, revision, nowMs) {
  const spdx = repo?.license?.spdx_id ?? null;
  const licence = licenseClass(spdx);
  let screeningStatus = 'needs_deeper_review';
  if (licence === 'strong_copyleft') screeningStatus = 'reference_only';
  if (licence === 'unknown') screeningStatus = 'blocked_license';

  return {
    candidate_id: `github.${repo.full_name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-')}`,
    capabilities: [capabilityId],
    repository: repo.full_name,
    revision,
    stars: repo.stargazers_count ?? 0,
    forks: repo.forks_count ?? 0,
    license_spdx: spdx,
    maintenance: maintenanceClass(repo.pushed_at, nowMs),
    screening_status: screeningStatus,
    asset_boundary: 'requires_review',
    dependency_boundary: 'requires_review',
    reason: `Selected after direct-component metadata screening for ${capabilityId}; repository metadata licence=${spdx ?? 'unknown'}, pushed=${repo.pushed_at ?? 'unknown'}. Source code/assets/dependencies remain review-required until canonical clearance.`,
  };
}

function normalizeCanonicalSeed(entry, capabilityId) {
  let repository = null;
  try {
    const url = new URL(entry.canonical_url);
    if (url.hostname === 'github.com') repository = url.pathname.replace(/^\//, '').replace(/\/$/, '');
  } catch {
    return null;
  }
  if (!repository || repository.split('/').length !== 2) return null;

  const fullyCleared =
    ['cleared', 'not_applicable'].includes(entry.licensing?.code_clearance_status) &&
    ['cleared', 'not_applicable'].includes(entry.licensing?.asset_clearance_status) &&
    ['cleared', 'not_applicable'].includes(entry.dependency_clearance_status);

  return {
    candidate_id: `canonical.${entry.entry_id}`,
    capabilities: [capabilityId],
    repository,
    revision: entry.version_or_revision,
    stars: entry.popularity_snapshot?.stars ?? 0,
    forks: entry.popularity_snapshot?.forks ?? 0,
    license_spdx: entry.licensing?.code_license === 'MIT' ? 'MIT' : null,
    maintenance: entry.fit?.maintenance_signal === 'active' ? 'active' : entry.fit?.maintenance_signal === 'stale' ? 'stale' : 'stable',
    screening_status: fullyCleared && entry.licensing?.commercial_use_status === 'allowed_with_conditions' ? 'reviewable' : 'needs_deeper_review',
    asset_boundary: entry.licensing?.asset_clearance_status === 'cleared' ? 'cleared' : entry.licensing?.asset_clearance_status === 'not_applicable' ? 'not_applicable' : 'requires_review',
    dependency_boundary: entry.dependency_clearance_status === 'cleared' ? 'cleared' : entry.dependency_clearance_status === 'not_applicable' ? 'not_applicable' : 'requires_review',
    reason: `Canonical external-reuse seed ${entry.entry_id}; evidence remains ${entry.evidence_status}.`,
  };
}

function githubHeaders(token) {
  return {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'byjtt-bounded-external-discovery/1.0',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function githubJson(fetchImpl, apiBase, path, token) {
  const response = await fetchImpl(`${apiBase}${path}`, { headers: githubHeaders(token) });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status} ${response.statusText}: ${text.slice(0, 500)}`);
  }
  return response.json();
}

export async function loadDiscoveryValidators({
  briefSchemaPath = 'schemas/external-discovery-brief.schema.json',
  queueSchemaPath = 'schemas/external-discovery-queue.schema.json',
} = {}) {
  const [briefSchema, queueSchema] = await Promise.all([
    readFile(briefSchemaPath, 'utf8').then(JSON.parse),
    readFile(queueSchemaPath, 'utf8').then(JSON.parse),
  ]);
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return {
    brief: ajv.compile(briefSchema),
    queue: ajv.compile(queueSchema),
  };
}

export function formatValidationErrors(errors = []) {
  return errors.map((error) => `${error.instancePath || '/'} ${error.message}`).join('; ');
}

export async function runExternalDiscovery({
  brief,
  registry,
  fetchImpl = globalThis.fetch,
  token = '',
  apiBase = DEFAULT_API,
  now = () => new Date(),
  perfNow = () => performance.now(),
} = {}) {
  if (!brief || typeof brief !== 'object') throw new TypeError('brief is required');
  if (!registry || !Array.isArray(registry.entries)) throw new TypeError('registry.entries is required');
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');

  const started = now();
  const startedMs = started.getTime();
  const t0 = perfNow();
  let searchActions = 0;
  let sourceFetches = 0;
  let totalSearchHits = 0;
  let rejectedSearchHits = 0;
  let duplicateSelections = 0;

  const registryEntries = new Map(registry.entries.map((entry) => [entry.entry_id, entry]));
  const queueByRepo = new Map();
  const perCapability = {};
  const queryLog = [];
  const revisionCache = new Map();

  async function exactRevision(repo) {
    const key = repo.full_name.toLowerCase();
    if (revisionCache.has(key)) return revisionCache.get(key);
    const branch = await githubJson(fetchImpl, apiBase, `/repos/${repo.full_name}/branches/${encodeURIComponent(repo.default_branch)}`, token);
    sourceFetches += 1;
    const revision = branch?.commit?.sha;
    if (!/^[0-9a-f]{40}$/.test(revision ?? '')) throw new Error(`Repository ${repo.full_name} returned an invalid branch revision`);
    revisionCache.set(key, revision);
    return revision;
  }

  function addCandidate(candidate, capabilityId, selectedIds) {
    const key = candidate.repository.toLowerCase();
    const existing = queueByRepo.get(key);
    if (existing) {
      duplicateSelections += 1;
      existing.capabilities = [...new Set([...existing.capabilities, capabilityId])];
      selectedIds.push(existing.candidate_id);
      return;
    }
    queueByRepo.set(key, candidate);
    selectedIds.push(candidate.candidate_id);
  }

  for (const capability of brief.capabilities) {
    const searchQuery = `${capability.query} in:name,description`;
    const searchPath = `/search/repositories?q=${encodeURIComponent(searchQuery)}&sort=stars&order=desc&per_page=${brief.max_results_per_query}`;
    searchActions += 1;
    const result = await githubJson(fetchImpl, apiBase, searchPath, token);
    const rawItems = (result.items ?? []).filter((repo) => !repo.archived && !repo.disabled);
    totalSearchHits += rawItems.length;

    const screened = rawItems.map((repo) => ({ repo, eligibility: taskEligibility(repo, capability) }));
    const rejectedCount = screened.filter((entry) => !entry.eligibility.eligible).length;
    rejectedSearchHits += rejectedCount;
    const candidates = screened
      .filter((entry) => entry.eligibility.eligible)
      .map(({ repo }) => ({ repo, score: rankScore(repo, capability, startedMs) }))
      .sort((a, b) => b.score - a.score || (b.repo.stargazers_count ?? 0) - (a.repo.stargazers_count ?? 0));

    queryLog.push({
      capability_id: capability.id,
      query: capability.query,
      returned: result.items?.length ?? 0,
      eligible_after_metadata_screen: candidates.length,
      rejected_as_irrelevant_or_index: rejectedCount,
    });

    const selectedIds = [];
    for (const seedId of capability.canonical_seed_ids ?? []) {
      const entry = registryEntries.get(seedId);
      if (!entry) continue;
      const seed = normalizeCanonicalSeed(entry, capability.id);
      if (seed) addCandidate(seed, capability.id, selectedIds);
    }

    const selected = candidates[0]?.repo ?? null;
    if (selected) {
      const revision = await exactRevision(selected);
      addCandidate(normalizeRepositoryCandidate(selected, capability.id, revision, startedMs), capability.id, selectedIds);
    }

    perCapability[capability.id] = [...new Set(selectedIds)];
  }

  const queue = [...queueByRepo.values()].sort((a, b) => b.stars - a.stars || a.repository.localeCompare(b.repository));
  const coveredCount = brief.capabilities.filter((capability) => (perCapability[capability.id] ?? []).length > 0).length;
  const clearedCount = brief.capabilities.filter((capability) =>
    (perCapability[capability.id] ?? []).some((candidateId) => queue.find((candidate) => candidate.candidate_id === candidateId)?.screening_status === 'reviewable')
  ).length;
  const gaps = brief.capabilities.filter((capability) => (perCapability[capability.id] ?? []).length === 0).map((capability) => capability.id);
  const ended = now();
  const elapsedMinutes = (perfNow() - t0) / 60_000;

  return {
    schema_version: '1.0.0',
    brief_id: brief.brief_id,
    mode: 'bounded_discovery_worker',
    measurement_status: 'instrumented',
    started_at: started.toISOString(),
    ended_at: ended.toISOString(),
    search_actions: searchActions,
    source_fetches: sourceFetches,
    distinct_sources_inspected: queue.length,
    candidate_count: queue.length,
    reviewable_candidate_count: queue.filter((candidate) => candidate.screening_status === 'reviewable').length,
    capability_candidate_coverage_pct: Math.round((coveredCount / brief.capabilities.length) * 100),
    fully_cleared_capability_coverage_pct: Math.round((clearedCount / brief.capabilities.length) * 100),
    irrelevant_or_duplicate_filtered: rejectedSearchHits + duplicateSelections,
    search_hits_seen: totalSearchHits,
    rejected_search_hits: rejectedSearchHits,
    duplicate_selections_filtered: duplicateSelections,
    human_interventions: 0,
    unsafe_promotions: 0,
    elapsed_minutes: Number(elapsedMinutes.toFixed(3)),
    cost_status: 'unknown',
    cost_value_usd: null,
    queue,
    query_log: queryLog,
    per_capability: perCapability,
    gaps,
    notes: 'Bounded on-demand discovery only. GitHub repository search plus canonical read-only seeds; direct-component metadata screening rejects generic indexes. New discoveries remain review-required or blocked until canonical code/asset/dependency and execution gates clear them.',
  };
}
