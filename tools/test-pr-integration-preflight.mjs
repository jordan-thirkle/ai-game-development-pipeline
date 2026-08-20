import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeIntegrationRisk } from './pr-integration-preflight.mjs';

const base = {
  currentPr: {
    number: 200,
    base: 'main',
    head: 'a'.repeat(40),
    mergeable: true,
    files: ['tools/example.mjs', 'docs/example.md']
  },
  compare: { behind_by: 0, ahead_by: 1 },
  peerFiles: []
};

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

test('exact changed-file overlap with another open PR fails closed', () => {
  const result = analyzeIntegrationRisk({
    ...base,
    peerFiles: [{ number: 201, title: 'Peer', files: ['README.md', 'tools/example.mjs'] }]
  });
  assert.equal(result.safe_to_continue, false);
  assert.deepEqual(result.blockers, ['open-pr-file-overlap']);
  assert.deepEqual(result.overlaps, [{ number: 201, title: 'Peer', files: ['tools/example.mjs'] }]);
});

test('directory proximity is not misreported as file overlap', () => {
  const result = analyzeIntegrationRisk({
    ...base,
    peerFiles: [{ number: 201, title: 'Peer', files: ['tools/example-helper.mjs'] }]
  });
  assert.equal(result.safe_to_continue, true);
  assert.deepEqual(result.overlaps, []);
});

test('duplicate peer filenames are normalized', () => {
  const result = analyzeIntegrationRisk({
    ...base,
    peerFiles: [{ number: 201, title: 'Peer', files: ['tools/example.mjs', 'tools/example.mjs'] }]
  });
  assert.deepEqual(result.overlaps[0].files, ['tools/example.mjs']);
});

test('multiple blockers remain distinct', () => {
  const result = analyzeIntegrationRisk({
    ...base,
    currentPr: { ...base.currentPr, mergeable: false },
    compare: { behind_by: 3, ahead_by: 1 },
    peerFiles: [{ number: 201, title: 'Peer', files: ['docs/example.md'] }]
  });
  assert.equal(result.stale_base, true);
  assert.deepEqual(result.blockers, ['github-reports-merge-conflict', 'open-pr-file-overlap']);
});

test('unknown comparison/mergeability stays unknown instead of becoming a pass claim', () => {
  const result = analyzeIntegrationRisk({
    currentPr: { ...base.currentPr, mergeable: null },
    compare: {},
    peerFiles: []
  });
  assert.equal(result.behind_by, null);
  assert.equal(result.mergeable, null);
  assert.equal(result.stale_base, false);
  assert.match(result.evidence_boundary, /does not prove/);
});
