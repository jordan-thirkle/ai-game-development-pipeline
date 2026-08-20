import assert from 'node:assert/strict';
import test from 'node:test';
import { isGenericIndex, loadValidators, runExternalDiscoveryV2, taskEligibility } from './lib/external-discovery-v2.mjs';

const SHA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const brief = {
  schema_version: '2.0.0', brief_id: 'TEST.V2', title: 'Sharded discovery test', platforms: ['web'], max_results_per_query: 10,
  capabilities: [
    { id: 'controller', query: 'godot controller', require_signals: ['godot'], required_any: ['controller'], secondary_any: ['character', 'camera'], canonical_seed_ids: ['existing-controller'] },
    { id: 'inventory', query: 'godot inventory system', require_signals: ['godot'], required_any: ['inventory'], secondary_any: ['item', 'system'], canonical_seed_ids: [] }
  ]
};
const canonicalRecords = [{
  id: 'existing-controller', name: 'Existing controller', kind: 'controller', state: 'qualified',
  source: { canonicalUrl: 'https://github.com/example/existing-controller', provider: 'Example', repositoryUrl: 'https://github.com/example/existing-controller', commit: SHA },
  licence: { status: 'verified', identifier: 'MIT', evidenceUrl: 'https://example.com/license', attributionRequired: true, checkedAt: '2026-08-20T00:00:00Z' },
  commercialUse: 'verified-allowed', provenance: { confidence: 'high', notes: 'test' }, maintenance: { status: 'active', evidence: 'test', checkedAt: '2026-08-20T00:00:00Z', notes: 'test' },
  compatibility: { engines: ['Godot'], platforms: ['web'], notes: 'test' }, risk: { supplyChain: 'low', dependencyBurden: 'low', legalNotes: '', securityNotes: '' },
  assessment: { integrationEffort: 'low', lifecycleRisk: 'low', scores: {}, recommendation: 'benchmark' }, evidence: [{ type: 'test', url: 'https://example.com', checkedAt: '2026-08-20T00:00:00Z' }], publication: { safe: true, slug: 'existing-controller' }, lastVerified: '2026-08-20T00:00:00Z'
}];

function repo(fullName, description, { stars = 1, spdx = 'MIT' } = {}) {
  const [owner, name] = fullName.split('/');
  return { name, full_name: fullName, html_url: `https://github.com/${fullName}`, description, topics: ['godot'], stargazers_count: stars, forks_count: 0, pushed_at: '2026-08-19T00:00:00Z', archived: false, disabled: false, default_branch: 'main', owner: { login: owner }, license: spdx ? { spdx_id: spdx } : null };
}
const awesome = repo('popular/awesome-godot-resources', 'Awesome list of Godot inventory system resources', { stars: 50000 });
const inventory = repo('example/inventory-direct', 'Godot inventory item system', { stars: 4 });
const controller = repo('example/controller-direct', 'Godot character controller camera', { stars: 3 });

function response(body, status = 200) { return { ok: status >= 200 && status < 300, status, statusText: status === 200 ? 'OK' : 'ERROR', async json() { return body; }, async text() { return JSON.stringify(body); } }; }
function fakeFetch(input) {
  const url = new URL(input);
  if (url.pathname === '/search/repositories') {
    const q = url.searchParams.get('q') ?? '';
    if (q.includes('inventory')) return Promise.resolve(response({ items: [awesome, inventory] }));
    if (q.includes('controller')) return Promise.resolve(response({ items: [controller] }));
  }
  if (url.pathname === '/repos/example/inventory-direct/branches/main' || url.pathname === '/repos/example/controller-direct/branches/main') return Promise.resolve(response({ commit: { sha: SHA } }));
  return Promise.resolve(response({ message: 'not found' }, 404));
}

async function result() {
  let clock = 0; const times = [new Date('2026-08-20T00:00:00Z'), new Date('2026-08-20T00:00:06Z')];
  let perf = 0; const perfTimes = [0, 6000];
  return runExternalDiscoveryV2({ brief, canonicalRecords, fetchImpl: fakeFetch, apiBase: 'https://api.github.test', now: () => times[Math.min(clock++, 1)], perfNow: () => perfTimes[Math.min(perf++, 1)] });
}

test('generic popularity cannot override direct task fit', () => {
  assert.equal(isGenericIndex(awesome), true);
  assert.equal(taskEligibility(awesome, brief.capabilities[1]).eligible, false);
  assert.equal(taskEligibility(inventory, brief.capabilities[1]).eligible, true);
});

test('new permissive discoveries cannot self-promote while canonical state is preserved', async () => {
  const queue = await result();
  assert.equal(queue.unsafe_promotions, 0);
  assert.equal(queue.capability_candidate_coverage_pct, 100);
  const seed = queue.queue.find((candidate) => candidate.candidate_id === 'canonical.existing-controller');
  assert.equal(seed.screening_status, 'canonical_qualified');
  assert.equal(seed.canonical_state, 'qualified');
  const discovered = queue.queue.filter((candidate) => candidate.origin === 'github_search');
  assert.ok(discovered.length >= 2);
  for (const candidate of discovered) {
    assert.equal(candidate.publication_eligible, false);
    assert.notEqual(candidate.screening_status, 'canonical_qualified');
    assert.match(candidate.revision, /^[0-9a-f]{40}$/);
  }
});

test('queue and brief satisfy v2 schemas', async () => {
  const validators = await loadValidators();
  assert.equal(validators.brief(brief), true, JSON.stringify(validators.brief.errors));
  const queue = await result();
  assert.equal(validators.queue(queue), true, JSON.stringify(validators.queue.errors));
});
