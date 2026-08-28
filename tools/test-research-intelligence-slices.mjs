import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSignal, scoreSignal, clusterSignals, promoteCandidate } from './research-radar.mjs';
import { evaluateFreshness, detectEvidenceChange } from './check-research-freshness.mjs';

test('normalizes community signals without treating them as verified', () => {
  const signal = normalizeSignal({ sourceType:'reddit', sourceUrl:'https://reddit.com/r/gamedev/x', observedAt:'2026-08-27T12:00:00Z', title:'AI game workflow discussion', summary:'Developers discuss whether agent loops help game development.', topics:['AI Game Development'] });
  assert.equal(signal.isCommunityLead, true);
  assert.equal(signal.evidenceStatus, 'unverified');
  assert.equal(signal.topics[0], 'ai-game-development');
});

test('rejects malformed normalized signals instead of creating an invalid canonical graph entry', () => {
  assert.throws(() => normalizeSignal({ sourceType:'unknown', sourceUrl:'not-a-uri', observedAt:'not-a-date', title:'bad signal', summary:'invalid input' }), /valid URI|Unsupported signal sourceType/);
  assert.throws(() => normalizeSignal({ sourceType:'github', sourceUrl:'https://github.com/example', observedAt:'not-a-date', title:'bad signal', summary:'invalid input' }), /valid date-time/);
});

test('clusters signals deterministically and promotes candidates without asserting truth', () => {
  const signals = [
    { sourceType:'reddit', sourceUrl:'https://reddit.com/a', observedAt:'2026-08-27T12:00:00Z', title:'Vibe coding', summary:'Community discussion about game development.', topics:['vibe-coding'] },
    { sourceType:'official-docs', sourceUrl:'https://example.com/docs', observedAt:'2026-08-27T12:01:00Z', title:'Agent workflow', summary:'Official documentation describing an agent workflow.', topics:['vibe-coding'] }
  ];
  const cluster = clusterSignals(signals)[0];
  const candidate = promoteCandidate(cluster);
  assert.equal(cluster.topic, 'vibe-coding');
  assert.equal(candidate.evidenceStatus, 'unverified');
  assert.equal(candidate.publicationEligible, false);
});

test('scores signals and classifies freshness', () => {
  const score = scoreSignal({ sourceType:'official-docs', novelty:9, relevance:10, evidenceability:10, urgency:4 });
  assert.equal(score.score, 9.1);
  assert.equal(evaluateFreshness({ status:'verified', reviewBy:'2026-09-10T00:00:00Z' }, '2026-08-27T00:00:00Z').status, 'fresh');
  assert.equal(evaluateFreshness({ status:'verified', reviewBy:'2026-08-29T00:00:00Z' }, '2026-08-27T00:00:00Z').status, 'due');
  assert.equal(evaluateFreshness({ status:'verified', reviewBy:'2026-08-20T00:00:00Z' }, '2026-08-27T00:00:00Z').status, 'stale');
  assert.equal(evaluateFreshness({ status:'verified', reviewBy:'not-a-date' }, '2026-08-27T00:00:00Z').status, 'invalid');
});

test('detects evidence and claim changes without false positives from ordering', () => {
  const result = detectEvidenceChange({ sources:['a'], claims:['CLM-1','CLM-2'] }, { sources:['a'], claims:['CLM-2','CLM-1'] });
  assert.deepEqual(result, { sourceChanged:false, claimChanged:false, contradicted:false, changed:false });
});

test('detects substantive evidence changes', () => {
  const result = detectEvidenceChange({ sources:['a'], claims:['CLM-1'] }, { sources:['b'], claims:['CLM-1'] });
  assert.deepEqual(result, { sourceChanged:true, claimChanged:false, contradicted:false, changed:true });
});
