import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMetadata, generateShareCopy, renderArticle } from './research-publication.mjs';

const publication = {
  title: 'AI Agents in Game Development',
  description: 'Evidence-backed research into agentic game development.',
  type: 'research',
  canonicalUrl: 'https://games.byjtt.com/research/ai-agents-game-development',
  topics: ['ai-game-development', 'agents', 'mcp'],
  publishedAt: '2026-08-28T00:00:00Z',
  updatedAt: '2026-08-28T00:30:00Z',
  lastVerifiedAt: '2026-08-28T00:20:00Z',
  nextReviewAt: '2026-09-27T00:20:00Z',
  imageManifest: [{ id: 'hero', role: 'hero', alt: 'Agent workflow diagram', pathOrUrl: '/images/hero.webp', caption: null, sourceKind: 'first-party' }],
  claims: [{ id: 'C1', statement: 'Agents can orchestrate repeatable development workflows.', confidence: 'high', status: 'verified', evidenceIds: ['E1'], sourceIds: ['S1'] }],
  sources: [{ id: 'S1', kind: 'official', title: 'Example official documentation', url: 'https://example.com/docs', accessedAt: '2026-08-28T00:10:00Z' }],
  relatedContent: [{ id: 'ai-game-dev', relationship: 'related' }],
};

test('generateMetadata returns canonical, date and machine-readable metadata', () => {
  const metadata = generateMetadata(publication);
  assert.equal(metadata.canonical, publication.canonicalUrl);
  assert.equal(metadata.openGraph.modifiedTime, publication.updatedAt);
  assert.equal(metadata.jsonLd.datePublished, publication.publishedAt);
});

test('generateShareCopy creates citation and channel variants', () => {
  const share = generateShareCopy(publication);
  assert.match(share.x, /AI Agents in Game Development/);
  assert.match(share.citation, /games\.byjtt\.com/);
});

test('renderArticle exposes dates, claim evidence, source and hero media', () => {
  const article = renderArticle(publication);
  assert.match(article, /Last updated/);
  assert.match(article, /E1/);
  assert.match(article, /https:\/\/example\.com\/docs/);
  assert.match(article, /Agent workflow diagram/);
});
