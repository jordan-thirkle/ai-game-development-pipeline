import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMetadata, generateShareCopy, renderArticle } from './research-publication.mjs';

const base = {
  schemaVersion: '0.1', id: 'ci-fixture', canonicalUrl: 'https://games.byjtt.com/research/ci-fixture', title: 'Verified AI Game Development Fixture', type: 'research',
  verticals: ['games'], topics: ['ai-game-development'], audience: ['developer'], status: 'published',
  publishedAt: '2026-08-28T00:00:00Z', updatedAt: '2026-08-28T00:10:00Z', lastVerifiedAt: '2026-08-28T00:05:00Z', nextReviewAt: '2026-09-28T00:05:00Z',
  claims: [{ id: 'C1', statement: 'A verified statement', confidence: 'high', status: 'verified', evidenceIds: ['E1'], sourceIds: ['S1'] }],
  sources: [{ id: 'S1', kind: 'first-party', title: 'By JTT evidence', url: 'https://byjtt.com/research', accessedAt: '2026-08-28T00:05:00Z' }],
  evidenceIds: ['E1'], imageManifest: [], shareVariants: {}, relatedContent: []
};

test('publication pipeline produces deterministic public artifacts', () => {
  const metadata = generateMetadata(base);
  const share = generateShareCopy(base);
  const article = renderArticle(base);
  assert.equal(metadata.canonical, base.canonicalUrl);
  assert.match(article, /Verified AI Game Development Fixture/);
  assert.match(share.x, /games\.byjtt\.com/);
});
