import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const registryDir = 'registry/reuse';
const now = new Date();
const defaultMaxAgeDays = Number.parseInt(process.env.REUSE_REGISTRY_MAX_AGE_DAYS ?? '90', 10);
const promotedMaxAgeDays = Number.parseInt(process.env.REUSE_PROMOTED_MAX_AGE_DAYS ?? '45', 10);

if (!Number.isFinite(defaultMaxAgeDays) || !Number.isFinite(promotedMaxAgeDays)) {
  console.error('Freshness thresholds must be finite integers');
  process.exit(2);
}

function ageDays(isoDate) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return Number.POSITIVE_INFINITY;
  return (now.getTime() - date.getTime()) / 86_400_000;
}

try {
  const files = (await readdir(registryDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => path.join(registryDir, entry.name))
    .sort();

  const failures = [];
  const warnings = [];

  for (const filePath of files) {
    const record = JSON.parse(await readFile(filePath, 'utf8'));
    const age = ageDays(record.lastVerified);
    const threshold = record.state === 'promoted' ? promotedMaxAgeDays : defaultMaxAgeDays;

    if (!Number.isFinite(age)) {
      failures.push(`${filePath}: invalid lastVerified '${record.lastVerified}'`);
      continue;
    }

    if (age < -1) {
      failures.push(`${filePath}: lastVerified is in the future`);
      continue;
    }

    if (['qualified', 'benchmarking', 'promoted'].includes(record.state) && age > threshold) {
      failures.push(`${filePath}: ${record.state} record is ${Math.floor(age)} days old (max ${threshold}); mark stale or reverify`);
    } else if (age > threshold) {
      warnings.push(`${filePath}: record is ${Math.floor(age)} days old; consider revalidation`);
    }

    const newestEvidenceAge = Math.min(...(record.evidence ?? []).map((item) => ageDays(item.checkedAt)));
    if (['qualified', 'benchmarking', 'promoted'].includes(record.state) && !Number.isFinite(newestEvidenceAge)) {
      failures.push(`${filePath}: protected state requires dated evidence`);
    } else if (Number.isFinite(newestEvidenceAge) && newestEvidenceAge > threshold) {
      failures.push(`${filePath}: newest evidence is ${Math.floor(newestEvidenceAge)} days old (max ${threshold})`);
    }
  }

  for (const warning of warnings) console.warn(`WARN: ${warning}`);

  if (failures.length) {
    console.error('Reuse registry freshness gate failed:');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log(`Reuse registry freshness valid: ${files.length} record(s)`);
} catch (error) {
  console.error(`Unable to check reuse registry freshness: ${error.message}`);
  process.exit(1);
}
