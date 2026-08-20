import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeIntegrationRisk } from './pr-integration-preflight.mjs';

const base = {
  currentPr: {
    number: 200,
    base: 'main',
    head: 'a'.repeat(40),
    mergeable: true,
    files: ['tools/example.mjs', 'docs/example.md'],
    changed_files: 2,
    files_complete: true
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
    ...overrides
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
