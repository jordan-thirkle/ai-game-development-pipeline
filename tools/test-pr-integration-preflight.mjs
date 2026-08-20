import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeIntegrationRisk,
  loadLiveState,
  mapWithConcurrency
} from './pr-integration-preflight.mjs';

const base = {
  currentPr: {
    number: 200,
    base: 'main',
    head: 'a'.repeat(40),
    mergeable: true,
    files: ['tools/example.mjs', 'docs/example.md'],
    changed_files: 2,
    files_complete: true,
    revision_consistent: true
  },
  compare: { behind_by: 0, ahead_by: 1 },
  peerFiles: []
};

function completePeer(overrides = {}) {
  const files = overrides.files ?? ['README.md'];
  return {
    number: 201,
    title: 'Peer',
    files,
    changed_files: files.length,
    files_complete: true,
    revision_consistent: true,
    ...overrides
  };
}

function headers(values = {}) {
  const normalized = new Map(Object.entries(values).map(([key, value]) => [key.toLowerCase(), String(value)]));
  return { get: (name) => normalized.get(name.toLowerCase()) ?? null };
}

function jsonResponse(data, { status = 200, headers: headerValues = {} } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: headers(headerValues),
    json: async () => data
  };
}

function prDetail(number, { head = 'a'.repeat(40), baseSha = 'b'.repeat(40), mergeable = true, changedFiles = 1 } = {}) {
  return {
    number,
    title: `PR ${number}`,
    state: 'open',
    mergeable,
    changed_files: changedFiles,
    base: { ref: 'main', sha: baseSha },
    head: { sha: head }
  };
}

test('fresh independent PR is safe', () => {
  const result = analyzeIntegrationRisk(base);
  assert.equal(result.safe_to_continue, true);
  assert.equal(result.stale_base, false);
  assert.deepEqual(result.blockers, []);
});

test('stale base is surfaced without inventing a conflict', () => {
  const result = analyzeIntegrationRisk({ ...base, compare: { behind_by: 7, ahead_by: 2 } });
  assert.equal(result.stale_base, true);
  assert.equal(result.behind_by, 7);
  assert.equal(result.safe_to_continue, true);
});

test('known GitHub merge conflict fails closed', () => {
  const result = analyzeIntegrationRisk({
    ...base,
    currentPr: { ...base.currentPr, mergeable: false }
  });
  assert.equal(result.safe_to_continue, false);
  assert.deepEqual(result.blockers, ['github-reports-merge-conflict']);
});

test('unknown GitHub mergeability fails closed', () => {
  const result = analyzeIntegrationRisk({
    ...base,
    currentPr: { ...base.currentPr, mergeable: null }
  });
  assert.equal(result.mergeable, null);
  assert.equal(result.safe_to_continue, false);
  assert.deepEqual(result.blockers, ['github-mergeability-unknown']);
});

test('exact changed-file overlap with another open PR fails closed', () => {
  const result = analyzeIntegrationRisk({
    ...base,
    peerFiles: [completePeer({ files: ['README.md', 'tools/example.mjs'], changed_files: 2 })]
  });
  assert.equal(result.safe_to_continue, false);
  assert.deepEqual(result.blockers, ['open-pr-file-overlap']);
  assert.deepEqual(result.overlaps, [{ number: 201, title: 'Peer', files: ['tools/example.mjs'] }]);
});

test('directory proximity is not misreported as file overlap', () => {
  const result = analyzeIntegrationRisk({
    ...base,
    peerFiles: [completePeer({ files: ['tools/example-helper.mjs'] })]
  });
  assert.equal(result.safe_to_continue, true);
  assert.deepEqual(result.overlaps, []);
});

test('duplicate peer filenames are normalized', () => {
  const result = analyzeIntegrationRisk({
    ...base,
    peerFiles: [completePeer({ files: ['tools/example.mjs', 'tools/example.mjs'], changed_files: 2 })]
  });
  assert.deepEqual(result.overlaps[0].files, ['tools/example.mjs']);
});

test('incomplete current PR file inventory fails closed', () => {
  const result = analyzeIntegrationRisk({
    ...base,
    currentPr: {
      ...base.currentPr,
      files: Array.from({ length: 3000 }, (_, index) => `generated/current-${index}.txt`),
      changed_files: 3001,
      files_complete: false
    }
  });
  assert.equal(result.safe_to_continue, false);
  assert.deepEqual(result.blockers, ['incomplete-pr-file-inventory']);
  assert.deepEqual(result.incomplete_file_inventories, [{ number: 200, expected: 3001, retrieved: 3000 }]);
});

test('incomplete peer PR file inventory fails closed even when retrieved paths do not overlap', () => {
  const result = analyzeIntegrationRisk({
    ...base,
    peerFiles: [
      completePeer({
        files: Array.from({ length: 3000 }, (_, index) => `generated/peer-${index}.txt`),
        changed_files: 3001,
        files_complete: false
      })
    ]
  });
  assert.equal(result.safe_to_continue, false);
  assert.deepEqual(result.blockers, ['incomplete-pr-file-inventory']);
  assert.deepEqual(result.overlaps, []);
  assert.deepEqual(result.incomplete_file_inventories, [{ number: 201, expected: 3001, retrieved: 3000 }]);
});

test('current PR revision changes during scan fail closed', () => {
  const result = analyzeIntegrationRisk({
    ...base,
    currentPr: { ...base.currentPr, revision_consistent: false }
  });
  assert.equal(result.safe_to_continue, false);
  assert.deepEqual(result.blockers, ['current-pr-state-changed-during-scan']);
});

test('peer revision changes during scan fail closed', () => {
  const result = analyzeIntegrationRisk({
    ...base,
    peerFiles: [completePeer({ revision_consistent: false })]
  });
  assert.equal(result.safe_to_continue, false);
  assert.deepEqual(result.blockers, ['peer-pr-state-changed-during-scan']);
});

test('multiple blockers remain distinct', () => {
  const result = analyzeIntegrationRisk({
    ...base,
    currentPr: { ...base.currentPr, mergeable: false },
    compare: { behind_by: 3, ahead_by: 1 },
    peerFiles: [completePeer({ files: ['docs/example.md'] })]
  });
  assert.equal(result.stale_base, true);
  assert.deepEqual(result.blockers, ['github-reports-merge-conflict', 'open-pr-file-overlap']);
});

test('unknown comparison remains explicitly unknown without inventing base freshness', () => {
  const result = analyzeIntegrationRisk({
    ...base,
    compare: {}
  });
  assert.equal(result.behind_by, null);
  assert.equal(result.stale_base, false);
  assert.equal(result.safe_to_continue, true);
  assert.match(result.evidence_boundary, /does not prove/);
});

test('mergeability polling accepts null followed by true', async () => {
  const repoRoot = 'https://api.test/repos/acme/repo';
  const prUrl = `${repoRoot}/pulls/200`;
  let prReads = 0;
  const sleeps = [];
  const fetchFn = async (url) => {
    if (url === prUrl) {
      prReads += 1;
      return jsonResponse(prDetail(200, { mergeable: prReads === 1 ? null : true }));
    }
    if (url === `${prUrl}/files?per_page=100`) return jsonResponse([{ filename: 'tools/example.mjs' }]);
    if (url === `${repoRoot}/pulls?state=open&per_page=100`) return jsonResponse([]);
    if (url.startsWith(`${repoRoot}/compare/`)) return jsonResponse({ behind_by: 0, ahead_by: 1 });
    throw new Error(`unexpected ${url}`);
  };

  const state = await loadLiveState({
    repository: 'acme/repo',
    prNumber: 200,
    token: 'token',
    apiBase: 'https://api.test',
    fetchFn,
    sleepFn: async (ms) => sleeps.push(ms),
    mergeabilityPollDelayMs: 7
  });

  assert.equal(state.currentPr.mergeable, true);
  assert.equal(state.currentPr.revision_consistent, true);
  assert.equal(prReads, 3);
  assert.deepEqual(sleeps, [7]);
});

test('live scan detects current revision changes after inventories are collected', async () => {
  const repoRoot = 'https://api.test/repos/acme/repo';
  const prUrl = `${repoRoot}/pulls/200`;
  let prReads = 0;
  const fetchFn = async (url) => {
    if (url === prUrl) {
      prReads += 1;
      return jsonResponse(prDetail(200, { head: prReads === 1 ? 'a'.repeat(40) : 'c'.repeat(40) }));
    }
    if (url === `${prUrl}/files?per_page=100`) return jsonResponse([{ filename: 'tools/example.mjs' }]);
    if (url === `${repoRoot}/pulls?state=open&per_page=100`) return jsonResponse([]);
    if (url.startsWith(`${repoRoot}/compare/`)) return jsonResponse({ behind_by: 0, ahead_by: 1 });
    throw new Error(`unexpected ${url}`);
  };

  const state = await loadLiveState({
    repository: 'acme/repo',
    prNumber: 200,
    token: 'token',
    apiBase: 'https://api.test',
    fetchFn
  });
  const result = analyzeIntegrationRisk(state);
  assert.equal(state.currentPr.revision_consistent, false);
  assert.deepEqual(result.blockers, ['current-pr-state-changed-during-scan']);
});

test('peer inspections respect bounded concurrency', async () => {
  const repoRoot = 'https://api.test/repos/acme/repo';
  const currentUrl = `${repoRoot}/pulls/200`;
  const peers = [201, 202, 203, 204, 205].map((number) => prDetail(number));
  let activePeerRequests = 0;
  let maxActivePeerRequests = 0;
  const fetchFn = async (url) => {
    const peerMatch = url.match(/\/pulls\/(20[1-5])(?:\/files\?per_page=100)?$/);
    if (peerMatch) {
      activePeerRequests += 1;
      maxActivePeerRequests = Math.max(maxActivePeerRequests, activePeerRequests);
      await new Promise((resolve) => setTimeout(resolve, 5));
      activePeerRequests -= 1;
      if (url.includes('/files?')) return jsonResponse([{ filename: `peer-${peerMatch[1]}.txt` }]);
      return jsonResponse(prDetail(Number(peerMatch[1])));
    }
    if (url === currentUrl) return jsonResponse(prDetail(200));
    if (url === `${currentUrl}/files?per_page=100`) return jsonResponse([{ filename: 'tools/example.mjs' }]);
    if (url === `${repoRoot}/pulls?state=open&per_page=100`) return jsonResponse([prDetail(200), ...peers]);
    if (url.startsWith(`${repoRoot}/compare/`)) return jsonResponse({ behind_by: 0, ahead_by: 1 });
    throw new Error(`unexpected ${url}`);
  };

  const state = await loadLiveState({
    repository: 'acme/repo',
    prNumber: 200,
    token: 'token',
    apiBase: 'https://api.test',
    fetchFn,
    concurrency: 2
  });

  assert.equal(state.peerFiles.length, 5);
  assert.ok(maxActivePeerRequests <= 2, `expected <=2 peer requests, saw ${maxActivePeerRequests}`);
  assert.ok(maxActivePeerRequests >= 2, 'test should exercise parallel peer requests');
});

test('rate limited requests honor Retry-After before retrying', async () => {
  const repoRoot = 'https://api.test/repos/acme/repo';
  const prUrl = `${repoRoot}/pulls/200`;
  let fileAttempts = 0;
  const sleeps = [];
  const fetchFn = async (url) => {
    if (url === prUrl) return jsonResponse(prDetail(200));
    if (url === `${prUrl}/files?per_page=100`) {
      fileAttempts += 1;
      if (fileAttempts === 1) return jsonResponse({}, { status: 429, headers: { 'Retry-After': '0.01' } });
      return jsonResponse([{ filename: 'tools/example.mjs' }]);
    }
    if (url === `${repoRoot}/pulls?state=open&per_page=100`) return jsonResponse([]);
    if (url.startsWith(`${repoRoot}/compare/`)) return jsonResponse({ behind_by: 0, ahead_by: 1 });
    throw new Error(`unexpected ${url}`);
  };

  const state = await loadLiveState({
    repository: 'acme/repo',
    prNumber: 200,
    token: 'token',
    apiBase: 'https://api.test',
    fetchFn,
    sleepFn: async (ms) => sleeps.push(ms)
  });

  assert.equal(state.currentPr.files_complete, true);
  assert.equal(fileAttempts, 2);
  assert.deepEqual(sleeps, [10]);
});

test('generic concurrency helper preserves order while bounding work', async () => {
  let active = 0;
  let maxActive = 0;
  const result = await mapWithConcurrency([1, 2, 3, 4], 2, async (value) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, 2));
    active -= 1;
    return value * 2;
  });
  assert.deepEqual(result, [2, 4, 6, 8]);
  assert.equal(maxActive, 2);
});
