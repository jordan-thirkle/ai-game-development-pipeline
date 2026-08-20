import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const registryDir = 'registry/reuse';
const schemaPath = 'schemas/reuse-candidate.schema.json';
const protectedStates = new Set(['qualified', 'benchmarking', 'promoted']);

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

function semanticErrors(record, filePath) {
  const errors = [];

  if (protectedStates.has(record.state)) {
    if (record.licence?.status !== 'verified') {
      errors.push(`${filePath}: ${record.state} records require licence.status=verified`);
    }
    if (record.commercialUse !== 'verified-allowed' && record.commercialUse !== 'conditional') {
      errors.push(`${filePath}: ${record.state} records require verified/conditional commercial use`);
    }
    if (!['high', 'medium'].includes(record.provenance?.confidence)) {
      errors.push(`${filePath}: ${record.state} records require high/medium provenance confidence`);
    }
    if (!record.maintenance?.status || ['unclear', 'inactive'].includes(record.maintenance.status)) {
      errors.push(`${filePath}: ${record.state} records require active, stable-static, or not-applicable maintenance status`);
    }
    if (!record.risk?.supplyChain || record.risk.supplyChain === 'unknown') {
      errors.push(`${filePath}: ${record.state} records require a non-unknown supply-chain assessment`);
    }
    if (!record.risk?.dependencyBurden || record.risk.dependencyBurden === 'unknown') {
      errors.push(`${filePath}: ${record.state} records require a non-unknown dependency-burden assessment`);
    }
  }

  if (record.state === 'promoted') {
    if (record.assessment?.recommendation !== 'reuse') {
      errors.push(`${filePath}: promoted records require assessment.recommendation=reuse`);
    }
    if (!Array.isArray(record.evidence) || !record.evidence.some((item) => item.type === 'execution' || item.type === 'benchmark')) {
      errors.push(`${filePath}: promoted records require execution or benchmark evidence`);
    }
    if (!Array.isArray(record.usedIn) || record.usedIn.length === 0) {
      errors.push(`${filePath}: promoted records require at least one usedIn project/evaluation reference`);
    }
  }

  if (record.publication?.safe === true && ['quarantined', 'rejected'].includes(record.state)) {
    errors.push(`${filePath}: quarantined/rejected records cannot be publication.safe=true`);
  }

  return errors;
}

try {
  const schema = await readJson(schemaPath);
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);

  const entries = (await readdir(registryDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => path.join(registryDir, entry.name))
    .sort();

  if (entries.length === 0) {
    throw new Error(`No reuse registry records found in ${registryDir}`);
  }

  const ids = new Map();
  const slugs = new Map();
  const errors = [];

  for (const filePath of entries) {
    let record;
    try {
      record = await readJson(filePath);
    } catch (error) {
      errors.push(`${filePath}: invalid JSON (${error.message})`);
      continue;
    }

    if (!validate(record)) {
      for (const error of validate.errors ?? []) {
        errors.push(`${filePath}${error.instancePath || '/'}: ${error.message}`);
      }
    }

    if (record.id) {
      if (ids.has(record.id)) errors.push(`${filePath}: duplicate id '${record.id}' also used by ${ids.get(record.id)}`);
      ids.set(record.id, filePath);
    }

    const slug = record.publication?.slug;
    if (slug) {
      if (slugs.has(slug)) errors.push(`${filePath}: duplicate publication slug '${slug}' also used by ${slugs.get(slug)}`);
      slugs.set(slug, filePath);
    }

    errors.push(...semanticErrors(record, filePath));
  }

  if (errors.length) {
    console.error('Reuse registry validation failed:');
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log(`Reuse registry valid: ${entries.length} record(s)`);
} catch (error) {
  console.error(`Unable to validate reuse registry: ${error.message}`);
  process.exit(1);
}
