import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const protocol = fs.readFileSync(new URL('../docs/EDITORIAL-AND-SEO-REVIEW-PROTOCOL.md', import.meta.url), 'utf8');

test('editorial protocol separates evidence from presentation review', () => {
  assert.match(protocol, /evidence gate → writer\/editor critique → SEO\/search critique/);
  assert.match(protocol, /vendor claim/);
  assert.match(protocol, /community report/);
  assert.match(protocol, /By JTT execution/);
});

test('SEO protocol covers canonical, structured data, dates, links and indexability', () => {
  for (const term of ['canonical URL', 'structured data', 'publication and modification dates', 'internal links', 'indexable']) {
    assert.match(protocol, new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  }
});

test('human escalation is reserved for material exceptions', () => {
  assert.match(protocol, /legal\/licensing ambiguity/);
  assert.match(protocol, /unsupported material claims/);
  assert.match(protocol, /contradictory evidence/);
});
