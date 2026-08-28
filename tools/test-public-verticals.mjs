import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVerticalIndex } from './build-public-verticals.mjs';

const publications = [
  { id: 'shared', status: 'published', verticals: ['games', 'development'], title: 'AI Agents', description: 'Shared research', type: 'research', canonicalUrl: 'https://byjtt.com/research/ai-agents', publishedAt: '2026-08-28T00:00:00Z', updatedAt: '2026-08-28T00:00:00Z', topics: ['agents'] },
  { id: 'draft', status: 'draft', verticals: ['games'], title: 'Draft', description: '', type: 'research', canonicalUrl: 'https://games.byjtt.com/research/draft', publishedAt: null, updatedAt: '2026-08-28T00:00:00Z', topics: ['draft'] },
];

test('shared article appears in each configured vertical without changing canonical URL', () => {
  const games = buildVerticalIndex(publications, { id: 'games' });
  const development = buildVerticalIndex(publications, { id: 'development' });
  assert.equal(games.length, 1);
  assert.equal(development.length, 1);
  assert.equal(games[0].canonicalUrl, development[0].canonicalUrl);
});

test('unpublished content is excluded from public indexes', () => {
  assert.equal(buildVerticalIndex(publications, { id: 'games' }).some((item) => item.id === 'draft'), false);
});
