import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const exporter = path.resolve('tools/export-public-reuse-registry.mjs');
const publicSchemaPath = path.resolve('schemas/public-reuse-registry.schema.json');

async function loadValidator() {
  const schema = JSON.parse(await readFile(publicSchemaPath, 'utf8'));
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  return ajv.compile(schema);
}

test('actual public reuse export conforms to the website feed schema', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'reuse-public-schema-'));
  const output = path.join(dir, 'public.json');
  try {
    const result = spawnSync(process.execPath, [exporter], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        REUSE_REGISTRY_DIR: path.resolve('registry/reuse'),
        PUBLIC_REUSE_OUTPUT: output
      },
      encoding: 'utf8'
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);

    const exported = JSON.parse(await readFile(output, 'utf8'));
    const validate = await loadValidator();
    assert.equal(validate(exported), true, JSON.stringify(validate.errors, null, 2));
    assert.equal(exported.count, exported.records.length);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('public schema rejects internal risk/provenance leakage', async () => {
  const validate = await loadValidator();
  const leaked = {
    schemaVersion: 1,
    generatedAt: '2026-08-20T04:00:00Z',
    sourceOfTruth: 'registry/reuse',
    publicationRule: 'fixture',
    count: 1,
    records: [{
      id: 'fixture',
      name: 'Fixture',
      description: '',
      kind: 'controller',
      state: 'qualified',
      source: { canonicalUrl: 'https://example.com', provider: 'Fixture' },
      licence: {
        status: 'verified',
        identifier: 'MIT',
        evidenceUrl: 'https://example.com/license',
        attributionRequired: true,
        checkedAt: '2026-08-20T04:00:00Z'
      },
      commercialUse: 'verified-allowed',
      maintenance: { status: 'active', checkedAt: '2026-08-20T04:00:00Z' },
      compatibility: {},
      recommendation: 'benchmark',
      publication: { slug: 'fixture' },
      lastVerified: '2026-08-20T04:00:00Z',
      risk: { legalNotes: 'must never be public' }
    }]
  };

  assert.equal(validate(leaked), false);
  assert.match(JSON.stringify(validate.errors), /additionalProperties/);
});
