import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const registryDir = process.env.REUSE_REGISTRY_DIR ?? 'registry/reuse';
const outputPath = process.env.PUBLIC_REUSE_OUTPUT ?? 'generated/public-reuse-registry.json';
const allowedStates = new Set(['qualified', 'benchmarking', 'promoted']);

function publicRecord(record) {
  return {
    id: record.id,
    name: record.name,
    description: record.description ?? '',
    kind: record.kind,
    state: record.state,
    source: {
      canonicalUrl: record.source.canonicalUrl,
      provider: record.source.provider,
      repositoryUrl: record.source.repositoryUrl,
      version: record.source.version,
      commit: record.source.commit
    },
    licence: {
      status: record.licence.status,
      identifier: record.licence.identifier,
      evidenceUrl: record.licence.evidenceUrl,
      attributionRequired: record.licence.attributionRequired,
      notice: record.licence.notice
    },
    commercialUse: record.commercialUse,
    maintenance: {
      status: record.maintenance.status,
      notes: record.maintenance.notes
    },
    compatibility: record.compatibility,
    recommendation: record.assessment.recommendation,
    publication: {
      slug: record.publication.slug,
      notes: record.publication.notes
    },
    lastVerified: record.lastVerified
  };
}

try {
  const entries = (await readdir(registryDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => path.join(registryDir, entry.name))
    .sort();

  const published = [];
  for (const filePath of entries) {
    const record = JSON.parse(await readFile(filePath, 'utf8'));
    if (record.publication?.safe !== true) continue;
    if (!allowedStates.has(record.state)) continue;
    if (!record.publication?.slug) throw new Error(`${filePath}: publication-safe record requires a slug`);
    published.push(publicRecord(record));
  }

  published.sort((a, b) => a.name.localeCompare(b.name));

  const output = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceOfTruth: 'registry/reuse',
    publicationRule: 'publication.safe=true and state in qualified|benchmarking|promoted',
    count: published.length,
    records: published
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Public reuse registry exported: ${published.length} record(s) -> ${outputPath}`);
} catch (error) {
  console.error(`Unable to export public reuse registry: ${error.message}`);
  process.exit(1);
}
