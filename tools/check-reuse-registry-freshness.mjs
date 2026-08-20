import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const registryDir = process.env.REUSE_REGISTRY_DIR ?? 'registry/reuse';
const now = new Date();
const defaultMaxAgeDays = Number.parseInt(process.env.REUSE_REGISTRY_MAX_AGE_DAYS ?? '90', 10);
const promotedMaxAgeDays = Number.parseInt(process.env.REUSE_PROMOTED_MAX_AGE_DAYS ?? '45', 10);
const protectedStates = new Set(['qualified', 'benchmarking', 'promoted']);

if (!Number.isFinite(defaultMaxAgeDays) || !Number.isFinite(promotedMaxAgeDays)) {
  console.error('Freshness thresholds must be finite integers');
  process.exit(2);
}

function ageDays(isoDate) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return Number.POSITIVE_INFINITY;
  return (now.getTime() - date.getTime()) / 86_400_000;
}

function assessDatedEvidence({ filePath, label, value, threshold, protectedState, failures, warnings }) {
  const age = ageDays(value);
  if (!Number.isFinite(age)) {
    failures.push(`${filePath}: invalid ${label} '${value}'`);
    return;
  }
  if (age < -1) {
    failures.push(`${filePath}: ${label} is in the future`);
    return;
  }
  if (age > threshold) {
    const message = `${filePath}: ${label} is ${Math.floor(age)} days old (max ${threshold})`;
    if (protectedState) failures.push(`${message}; mark stale or reverify`);
    else warnings.push(message);
  }
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
    const threshold = record.state === 'promoted' ? promotedMaxAgeDays : defaultMaxAgeDays;
    const protectedState = protectedStates.has(record.state);

    assessDatedEvidence({ filePath, label: 'lastVerified', value: record.lastVerified, threshold, protectedState, failures, warnings });
    assessDatedEvidence({ filePath, label: 'licence.checkedAt', value: record.licence?.checkedAt, threshold, protectedState, failures, warnings });
    assessDatedEvidence({ filePath, label: 'maintenance.checkedAt', value: record.maintenance?.checkedAt, threshold, protectedState, failures, warnings });

    const evidence = record.evidence ?? [];
    if (protectedState && evidence.length === 0) failures.push(`${filePath}: protected state requires dated evidence`);

    for (const item of evidence) {
      const evidenceAge = ageDays(item.checkedAt);
      if (!Number.isFinite(evidenceAge)) {
        failures.push(`${filePath}: invalid evidence.checkedAt '${item.checkedAt}' for '${item.type}'`);
      } else if (evidenceAge < -1) {
        failures.push(`${filePath}: evidence.checkedAt for '${item.type}' is in the future`);
      }
    }

    const newestEvidenceAge = Math.min(...evidence.map((item) => ageDays(item.checkedAt)));
    if (protectedState && !Number.isFinite(newestEvidenceAge)) {
      failures.push(`${filePath}: protected state requires at least one valid dated evidence item`);
    } else if (Number.isFinite(newestEvidenceAge) && newestEvidenceAge > threshold) {
      const message = `${filePath}: newest evidence is ${Math.floor(newestEvidenceAge)} days old (max ${threshold})`;
      if (protectedState) failures.push(`${message}; mark stale or reverify`);
      else warnings.push(message);
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
