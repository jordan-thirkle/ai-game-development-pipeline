import { createHash } from 'node:crypto';

const SOURCE_TYPES = new Set(['official-docs','github','reddit','x','research','standards','community','release']);
const EVIDENCE_STATUSES = new Set(['unverified','partially-verified','verified','contradicted']);
const slug = (value) => String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function normalizeSignal(input) {
  if (!input?.sourceUrl || !input?.title || !input?.summary || !input?.sourceType || !input?.observedAt) throw new Error('Signal requires sourceUrl, title, summary, sourceType and observedAt');
  try { new URL(input.sourceUrl); } catch { throw new Error('Signal sourceUrl must be a valid URI'); }
  if (!SOURCE_TYPES.has(input.sourceType)) throw new Error(`Unsupported signal sourceType: ${input.sourceType}`);
  if (Number.isNaN(Date.parse(input.observedAt))) throw new Error('Signal observedAt must be a valid date-time');
  if (input.evidenceStatus != null && !EVIDENCE_STATUSES.has(input.evidenceStatus)) throw new Error(`Unsupported signal evidenceStatus: ${input.evidenceStatus}`);
  const id = input.id ?? `SIG-${createHash('sha256').update(`${input.sourceUrl}|${input.observedAt}|${input.title}`).digest('hex').slice(0, 12).toUpperCase()}`;
  return { ...input, id, topics: [...new Set((input.topics ?? []).map(slug).filter(Boolean))], isCommunityLead: ['reddit','x','community'].includes(input.sourceType) || Boolean(input.isCommunityLead), evidenceStatus: input.evidenceStatus ?? 'unverified' };
}

export function scoreSignal(signal) {
  const novelty = Math.min(10, signal.novelty ?? (signal.sourceType === 'release' ? 8 : 5));
  const relevance = Math.min(10, signal.relevance ?? 5);
  const evidenceability = Math.min(10, signal.evidenceability ?? (signal.sourceType === 'official-docs' || signal.sourceType === 'standards' ? 9 : 5));
  const urgency = Math.min(10, signal.urgency ?? 3);
  const score = Number((novelty * 0.3 + relevance * 0.35 + evidenceability * 0.25 + urgency * 0.1).toFixed(2));
  return { novelty, relevance, evidenceability, urgency, score };
}

export function clusterSignals(signals) {
  const clusters = new Map();
  for (const raw of signals) {
    const signal = normalizeSignal(raw);
    const key = signal.topics[0] ?? slug(signal.title).split('-').slice(0, 4).join('-');
    if (!clusters.has(key)) clusters.set(key, []);
    clusters.get(key).push(signal);
  }
  return [...clusters.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([topic, items]) => ({ topic, signals: items.sort((a,b) => a.id.localeCompare(b.id)), score: Math.max(...items.map(s => scoreSignal(s).score)) }));
}

export function promoteCandidate(cluster) {
  if (!cluster?.signals?.length) throw new Error('Cannot promote an empty cluster');
  return { id: `CAND-${slug(cluster.topic).toUpperCase()}`, topic: cluster.topic, signalIds: cluster.signals.map(s => s.id), status: 'candidate', evidenceStatus: 'unverified', publicationEligible: false };
}
