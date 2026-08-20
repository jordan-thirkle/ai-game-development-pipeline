import { readFile, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

const token = process.env.GITHUB_TOKEN ?? '';
const outputPath = process.argv[2] ?? '/tmp/bounded-discovery-result.json';
const registryPath = process.argv[3] ?? 'registry/open-source-game-reuse.v1.json';
const api = 'https://api.github.com';
const started = new Date();
const t0 = performance.now();
let searchActions = 0;
let sourceFetches = 0;

const capabilities = [
  { id: 'whole-starter-architecture', query: 'godot survival starter game', keywords: ['survival', 'starter', 'game'] },
  { id: 'controller-camera', query: 'godot 4 third person controller', keywords: ['third', 'person', 'controller'] },
  { id: 'combat-interactions', query: 'godot 4 combat interaction system', keywords: ['combat', 'interaction', 'shooter'] },
  { id: 'enemy-npc-ai', query: 'godot behavior tree state machine ai', keywords: ['behavior', 'tree', 'state', 'ai'] },
  { id: 'building-placement', query: 'godot building placement system', keywords: ['building', 'placement', 'build'] },
  { id: 'inventory-economy', query: 'godot inventory system', keywords: ['inventory', 'item'] },
  { id: 'crafting-recipes', query: 'godot crafting system', keywords: ['craft', 'crafting', 'recipe'] },
  { id: 'save-progression', query: 'godot save system plugin', keywords: ['save', 'savedata', 'persistence'] },
  { id: 'ui-touch-accessibility', query: 'godot mobile joystick accessibility', keywords: ['mobile', 'joystick', 'accessibility', 'touch'] },
  { id: 'environment-character-animation-assets', query: 'godot game assets low poly cc0', keywords: ['asset', 'low', 'poly', 'cc0'] },
  { id: 'audio-music', query: 'godot game audio music sfx cc0', keywords: ['audio', 'music', 'sfx', 'sound'] },
  { id: 'multiplayer-networking-social', query: 'godot multiplayer netcode addon', keywords: ['multiplayer', 'netcode', 'network'] },
];

const canonicalSeeds = {
  'controller-camera': ['reuse.kenney-starter-3d-platformer'],
  'enemy-npc-ai': ['reuse.limboai'],
  'environment-character-animation-assets': ['reuse.kenney-starter-3d-platformer'],
  'audio-music': ['reuse.kenney-starter-3d-platformer'],
};

function headers() {
  return {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'byjtt-bounded-external-discovery/0.1',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function github(path) {
  const response = await fetch(`${api}${path}`, { headers: headers() });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status} ${response.statusText}: ${text.slice(0, 500)}`);
  }
  return response.json();
}

function daysSince(dateString) {
  const ms = Date.now() - Date.parse(dateString);
  return Number.isFinite(ms) ? ms / 86_400_000 : Infinity;
}

function maintenance(pushedAt) {
  const days = daysSince(pushedAt);
  if (days <= 180) return 'active';
  if (days <= 730) return 'stable';
  return 'stale';
}

function licenseClass(spdx) {
  const value = (spdx ?? '').toUpperCase();
  if (!value || value === 'NOASSERTION') return 'unknown';
  if (value.startsWith('GPL') || value.startsWith('AGPL')) return 'strong_copyleft';
  if (value === 'MPL-2.0' || value.startsWith('LGPL')) return 'file_or_weak_copyleft';
  if (['MIT', 'APACHE-2.0', 'BSD-2-CLAUSE', 'BSD-3-CLAUSE', 'ISC', 'CC0-1.0', 'UNLICENSE'].includes(value)) return 'permissive';
  return 'other';
}

function textFor(repo) {
  return `${repo.name ?? ''} ${repo.description ?? ''} ${(repo.topics ?? []).join(' ')}`.toLowerCase();
}

function taskFit(repo, keywords) {
  const hay = textFor(repo);
  return keywords.reduce((score, keyword) => score + (hay.includes(keyword.toLowerCase()) ? 1 : 0), 0);
}

function score(repo, keywords) {
  const fit = taskFit(repo, keywords);
  const age = daysSince(repo.pushed_at);
  const maintenanceScore = age <= 180 ? 3 : age <= 730 ? 1 : -2;
  const licence = licenseClass(repo.license?.spdx_id);
  const licenceScore = licence === 'permissive' ? 3 : licence === 'file_or_weak_copyleft' ? 0 : licence === 'strong_copyleft' ? -5 : -1;
  const popularity = Math.min(2, Math.log10((repo.stargazers_count ?? 0) + 1) / 2);
  return fit * 6 + maintenanceScore * 2 + licenceScore * 2 + popularity;
}

function normalizeRepo(repo, capabilityId, revision) {
  const spdx = repo.license?.spdx_id ?? null;
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
    maintenance: maintenance(repo.pushed_at),
    screening_status: screeningStatus,
    asset_boundary: 'requires_review',
    dependency_boundary: 'requires_review',
    reason: `Selected deterministically for ${capabilityId}; repository metadata licence=${spdx ?? 'unknown'}, pushed=${repo.pushed_at ?? 'unknown'}. Source code/assets/dependencies remain review-required until canonical clearance.`,
  };
}

const registry = JSON.parse(await readFile(registryPath, 'utf8'));
const registryEntries = new Map(registry.entries.map((entry) => [entry.entry_id, entry]));
const queueByRepo = new Map();
const perCapability = {};
const queryLog = [];
const revisionCache = new Map();
let duplicateSelections = 0;

async function exactRevision(repo) {
  const key = repo.full_name.toLowerCase();
  if (revisionCache.has(key)) return revisionCache.get(key);
  const branch = await github(`/repos/${repo.full_name}/branches/${encodeURIComponent(repo.default_branch)}`);
  sourceFetches += 1;
  revisionCache.set(key, branch.commit.sha);
  return branch.commit.sha;
}

for (const capability of capabilities) {
  const searchUrl = `/search/repositories?q=${encodeURIComponent(`${capability.query} in:name,description,readme`)}&sort=stars&order=desc&per_page=10`;
  searchActions += 1;
  const result = await github(searchUrl);
  const candidates = (result.items ?? [])
    .filter((repo) => !repo.archived && !repo.disabled)
    .map((repo) => ({ repo, score: score(repo, capability.keywords) }))
    .sort((a, b) => b.score - a.score || (b.repo.stargazers_count ?? 0) - (a.repo.stargazers_count ?? 0));

  queryLog.push({ capability_id: capability.id, query: capability.query, returned: result.items?.length ?? 0 });
  const selected = candidates[0]?.repo ?? null;
  const selectedIds = [];

  for (const seedId of canonicalSeeds[capability.id] ?? []) {
    const entry = registryEntries.get(seedId);
    if (!entry) continue;
    const url = new URL(entry.canonical_url);
    if (url.hostname !== 'github.com') continue;
    const repository = url.pathname.replace(/^\//, '').replace(/\/$/, '');
    const fullyCleared =
      ['cleared', 'not_applicable'].includes(entry.licensing?.code_clearance_status) &&
      ['cleared', 'not_applicable'].includes(entry.licensing?.asset_clearance_status) &&
      ['cleared', 'not_applicable'].includes(entry.dependency_clearance_status);
    const seed = {
      candidate_id: `canonical.${entry.entry_id}`,
      capabilities: [capability.id],
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
    const key = seed.repository.toLowerCase();
    const existing = queueByRepo.get(key);
    if (existing) {
      duplicateSelections += 1;
      existing.capabilities = [...new Set([...existing.capabilities, capability.id])];
      selectedIds.push(existing.candidate_id);
    } else {
      queueByRepo.set(key, seed);
      selectedIds.push(seed.candidate_id);
    }
  }

  if (selected) {
    const revision = await exactRevision(selected);
    const candidate = normalizeRepo(selected, capability.id, revision);
    const key = candidate.repository.toLowerCase();
    const existing = queueByRepo.get(key);
    if (existing) {
      duplicateSelections += 1;
      existing.capabilities = [...new Set([...existing.capabilities, capability.id])];
      selectedIds.push(existing.candidate_id);
    } else {
      queueByRepo.set(key, candidate);
      selectedIds.push(candidate.candidate_id);
    }
  }

  perCapability[capability.id] = [...new Set(selectedIds)];
}

const queue = [...queueByRepo.values()].sort((a, b) => b.stars - a.stars || a.repository.localeCompare(b.repository));
const candidateCoverage = capabilities.filter((capability) => (perCapability[capability.id] ?? []).length > 0).length;
const fullyClearedCoverage = capabilities.filter((capability) =>
  (perCapability[capability.id] ?? []).some((id) => queue.find((candidate) => candidate.candidate_id === id)?.screening_status === 'reviewable')
).length;
const reviewableCandidateCount = queue.filter((candidate) => candidate.screening_status === 'reviewable').length;
const elapsedMinutes = (performance.now() - t0) / 60_000;

const output = {
  mode: 'bounded_discovery_worker',
  measurement_status: 'instrumented',
  started_at: started.toISOString(),
  ended_at: new Date().toISOString(),
  search_actions: searchActions,
  source_fetches: sourceFetches,
  distinct_sources_inspected: queue.length,
  candidate_count: queue.length,
  reviewable_candidate_count: reviewableCandidateCount,
  capability_candidate_coverage_pct: Math.round((candidateCoverage / capabilities.length) * 100),
  fully_cleared_capability_coverage_pct: Math.round((fullyClearedCoverage / capabilities.length) * 100),
  irrelevant_or_duplicate_filtered: duplicateSelections,
  human_interventions: 0,
  unsafe_promotions: 0,
  elapsed_minutes: Number(elapsedMinutes.toFixed(3)),
  cost_status: 'unknown',
  cost_value_usd: null,
  queue,
  query_log: queryLog,
  per_capability: perCapability,
  notes: 'Bounded on-demand prototype only. GitHub Search/API + local canonical external-reuse seeds; no repository execution, no scheduled operation, no production registry writes, and no automatic commercial clearance beyond inherited canonical evidence.',
};

await writeFile(outputPath, JSON.stringify(output, null, 2));
console.log(JSON.stringify({
  search_actions: output.search_actions,
  source_fetches: output.source_fetches,
  total_network_actions: output.search_actions + output.source_fetches,
  candidates: output.candidate_count,
  coverage_pct: output.capability_candidate_coverage_pct,
  fully_cleared_coverage_pct: output.fully_cleared_capability_coverage_pct,
  duplicates_filtered: output.irrelevant_or_duplicate_filtered,
  elapsed_minutes: output.elapsed_minutes,
}, null, 2));
