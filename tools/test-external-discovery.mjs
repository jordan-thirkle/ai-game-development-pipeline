import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import test from 'node:test';
import {
  isGenericIndex,
  loadDiscoveryValidators,
  runExternalDiscovery,
  taskEligibility,
} from './lib/external-discovery.mjs';

const SHA = {
  inventory: '1111111111111111111111111111111111111111',
  touch: '2222222222222222222222222222222222222222',
  controller: '3333333333333333333333333333333333333333',
  seed: '4444444444444444444444444444444444444444',
};

function repo({ fullName, description, stars = 0, forks = 0, spdx = 'MIT', topics = ['godot'], pushedAt = '2026-08-01T00:00:00Z' }) {
  const [owner, name] = fullName.split('/');
  return { name, full_name: fullName, description, topics, stargazers_count: stars, forks_count: forks, pushed_at: pushedAt, archived: false, disabled: false, default_branch: 'main', owner: { login: owner }, license: spdx ? { spdx_id: spdx } : null };
}

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, statusText: status === 200 ? 'OK' : 'ERROR', async json() { return body; }, async text() { return JSON.stringify(body); } };
}

const brief = {
  schema_version: '1.0.0', brief_id: 'TEST-BRIEF', title: 'Test bounded discovery', platforms: ['web'], max_results_per_query: 10,
  capabilities: [
    { id: 'inventory', query: 'godot inventory system', require_signals: ['godot'], required_any: ['inventory'], secondary_any: ['system', 'item'], canonical_seed_ids: [] },
    { id: 'touch', query: 'godot virtual joystick', require_signals: ['godot'], required_any: ['joystick', 'touch'], secondary_any: ['virtual', 'input'], canonical_seed_ids: [] },
    { id: 'controller', query: 'godot controller', require_signals: ['godot'], required_any: ['controller'], secondary_any: ['character', 'camera'], canonical_seed_ids: ['reuse.seed'] },
  ],
};

const registry = { entries: [{ entry_id: 'reuse.seed', canonical_url: 'https://github.com/example/cleared-controller', version_or_revision: SHA.seed, evidence_status: 'SOURCE-VERIFIED', popularity_snapshot: { stars: 8, forks: 1 }, fit: { maintenance_signal: 'active' }, dependency_clearance_status: 'cleared', licensing: { code_license: 'MIT', code_clearance_status: 'cleared', asset_clearance_status: 'cleared', commercial_use_status: 'allowed_with_conditions' } }] };

const awesome = repo({ fullName: 'popular/awesome-godot-resources', description: 'Awesome list and curated list of Godot inventory system resources', stars: 50000 });
const inventory = repo({ fullName: 'example/inventory-direct', description: 'Direct Godot inventory system with item containers', stars: 4 });
const touchNoLicense = repo({ fullName: 'example/touch-direct', description: 'Godot virtual joystick touch input addon', stars: 2, spdx: null });
const controller = repo({ fullName: 'example/controller-direct', description: 'Godot modular character controller and camera', stars: 3 });

function makeFetch() {
  return async (input) => {
    const url = new URL(input);
    if (url.pathname === '/search/repositories') {
      const query = url.searchParams.get('q') ?? '';
      if (query.includes('inventory')) return jsonResponse({ items: [awesome, inventory] });
      if (query.includes('joystick')) return jsonResponse({ items: [touchNoLicense] });
      if (query.includes('controller')) return jsonResponse({ items: [controller] });
      return jsonResponse({ items: [] });
    }
    if (url.pathname === '/repos/example/inventory-direct/branches/main') return jsonResponse({ commit: { sha: SHA.inventory } });
    if (url.pathname === '/repos/example/touch-direct/branches/main') return jsonResponse({ commit: { sha: SHA.touch } });
    if (url.pathname === '/repos/example/controller-direct/branches/main') return jsonResponse({ commit: { sha: SHA.controller } });
    return jsonResponse({ message: `Unhandled ${url.pathname}` }, 404);
  };
}

async function deterministicResult() {
  let perfCall = 0;
  const perfValues = [0, 6000];
  let nowCall = 0;
  const nowValues = [new Date('2026-08-20T00:00:00Z'), new Date('2026-08-20T00:00:06Z')];
  return runExternalDiscovery({ brief, registry, fetchImpl: makeFetch(), apiBase: 'https://api.github.test', now: () => nowValues[Math.min(nowCall++, nowValues.length - 1)], perfNow: () => perfValues[Math.min(perfCall++, perfValues.length - 1)] });
}

test('generic indexes are rejected even when they dominate popularity', () => {
  assert.equal(isGenericIndex(awesome), true);
  assert.deepEqual(taskEligibility(awesome, brief.capabilities[0]), { eligible: false, reason: 'generic_index_not_direct_component' });
  assert.equal(taskEligibility(inventory, brief.capabilities[0]).eligible, true);
});

test('on-demand worker emits only advisory new discoveries and preserves canonical clearance', async () => {
  const result = await deterministicResult();
  assert.equal(result.search_actions, 3);
  assert.equal(result.source_fetches, 3);
  assert.equal(result.search_hits_seen, 4);
  assert.equal(result.rejected_search_hits, 1);
  assert.equal(result.unsafe_promotions, 0);
  assert.deepEqual(result.gaps, []);
  assert.equal(result.capability_candidate_coverage_pct, 100);
  assert.equal(result.fully_cleared_capability_coverage_pct, 33);
  assert.equal(result.elapsed_minutes, 0.1);
  assert.equal(result.queue.some((candidate) => candidate.repository === awesome.full_name), false);
  const inventoryCandidate = result.queue.find((candidate) => candidate.repository === inventory.full_name);
  assert.ok(inventoryCandidate);
  assert.equal(inventoryCandidate.revision, SHA.inventory);
  assert.equal(inventoryCandidate.license_spdx, 'MIT');
  assert.equal(inventoryCandidate.screening_status, 'needs_deeper_review');
  assert.equal(inventoryCandidate.asset_boundary, 'requires_review');
  assert.equal(inventoryCandidate.dependency_boundary, 'requires_review');
  const touchCandidate = result.queue.find((candidate) => candidate.repository === touchNoLicense.full_name);
  assert.ok(touchCandidate);
  assert.equal(touchCandidate.revision, SHA.touch);
  assert.equal(touchCandidate.screening_status, 'blocked_license');
  const canonical = result.queue.find((candidate) => candidate.candidate_id === 'canonical.reuse.seed');
  assert.ok(canonical);
  assert.equal(canonical.revision, SHA.seed);
  assert.equal(canonical.screening_status, 'reviewable');
  assert.equal(canonical.asset_boundary, 'cleared');
  assert.equal(canonical.dependency_boundary, 'cleared');
});

test('brief and generated queue satisfy reusable JSON contracts', async () => {
  const validators = await loadDiscoveryValidators();
  assert.equal(validators.brief(brief), true, JSON.stringify(validators.brief.errors));
  const result = await deterministicResult();
  assert.equal(validators.queue(result), true, JSON.stringify(validators.queue.errors));
});

const fixtureFlag = process.argv.indexOf('--write-fixture');
if (fixtureFlag !== -1) {
  const outputPath = process.argv[fixtureFlag + 1];
  if (!outputPath) throw new Error('--write-fixture requires an output path');
  const result = await deterministicResult();
  const validators = await loadDiscoveryValidators();
  if (!validators.queue(result)) throw new Error(`fixture queue failed schema validation: ${JSON.stringify(validators.queue.errors)}`);
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
}
