const DAY = 86_400_000;

function canonicalList(value) {
  return [...new Set(Array.isArray(value) ? value : [])].map(String).sort();
}

export function evaluateFreshness(record, now = new Date()) {
  const reviewBy = new Date(record.reviewBy);
  if (Number.isNaN(reviewBy.getTime())) return { status: 'invalid', reviewBy: null, reason: 'Review deadline is not a valid date-time.' };
  if (record.status === 'superseded') return { status: 'superseded', reviewBy: reviewBy.toISOString(), reason: 'Finding is explicitly superseded.' };
  if (record.status === 'contradicted') return { status: 'stale', reviewBy: reviewBy.toISOString(), reason: 'Finding is contradicted and requires review.', contradicted: true };
  const delta = reviewBy.getTime() - new Date(now).getTime();
  if (delta < 0) return { status: 'stale', reviewBy: reviewBy.toISOString(), reason: 'Review deadline has passed.' };
  if (delta <= 7 * DAY) return { status: 'due', reviewBy: reviewBy.toISOString(), reason: 'Review deadline is within seven days.' };
  return { status: 'fresh', reviewBy: reviewBy.toISOString(), reason: 'Finding is outside its review window.' };
}

export function detectEvidenceChange(previous, current) {
  const sourceChanged = JSON.stringify(canonicalList(previous?.sources)) !== JSON.stringify(canonicalList(current?.sources));
  const claimChanged = JSON.stringify(canonicalList(previous?.claims)) !== JSON.stringify(canonicalList(current?.claims));
  const contradicted = current?.status === 'contradicted';
  return { sourceChanged, claimChanged, contradicted, changed: sourceChanged || claimChanged || contradicted };
}
