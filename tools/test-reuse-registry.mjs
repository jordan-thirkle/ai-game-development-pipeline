import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const validator = path.resolve('tools/validate-reuse-registry.mjs');
const exporter = path.resolve('tools/export-public-reuse-registry.mjs');
const schema = path.resolve('schemas/reuse-candidate.schema.json');

const baseRecord = {
  id: 'fixture-candidate',
  name: 'Fixture Candidate',
  kind: 'controller',
  state: 'qualified',
  source: { canonicalUrl: 'https://example.com/controller', provider: 'Fixture' },
  licence: { status: 'verified', identifier: 'MIT', evidenceUrl: 'https://example.com/license', attributionRequired: true },
  commercialUse: 'verified-allowed',
  provenance: { confidence: 'high', notes: 'Fixture provenance.' },
  maintenance: { status: 'active', evidence: 'Fixture maintenance evidence.', notes: 'Maintained.' },
  compatibility: { engines: ['Fixture Engine'], platforms: ['desktop'], notes: 'Fixture compatibility.' },
  risk: { supplyChain: 'low', dependencyBurden: 'low', legalNotes: 'No known fixture issue.', securityNotes: 'No known fixture issue.' },
  assessment: { integrationEffort: 'low', lifecycleRisk: 'low', scores: { projectFit: 4 }, recommendation: 'benchmark' },
  evidence: [{ type: 'official-repository', url: 'https://example.com/controller', checkedAt: '2026-08-20T02:30:00Z' }],
  publication: { safe: false },
  usedIn: [],
  lastVerified: '2026-08-20T02:30:00Z'
};

async function validateRecord(record) {
  const dir = await mkdtemp(path.join(tmpdir(), 'reuse-registry-'));
  try {
    await writeFile(path.join(dir, 'candidate.json'), JSON.stringify(record, null, 2));
    return spawnSync(process.execPath, [validator], {
      cwd: process.cwd(),
      env: { ...process.env, REUSE_REGISTRY_DIR: dir, REUSE_SCHEMA_PATH: schema },
      encoding: 'utf8'
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('qualified candidate with verified evidence passes', async () => {
  const result = await validateRecord(baseRecord);
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('qualified candidate fails closed on unknown supply-chain risk', async () => {
  const result = await validateRecord({ ...baseRecord, risk: { ...baseRecord.risk, supplyChain: 'unknown' } });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /non-unknown supply-chain assessment/);
});

test('qualified candidate fails closed on inactive maintenance', async () => {
  const result = await validateRecord({ ...baseRecord, maintenance: { ...baseRecord.maintenance, status: 'inactive' } });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /require active, stable-static, or not-applicable maintenance status/);
});

test('promoted candidate requires execution evidence and a usedIn reference', async () => {
  const result = await validateRecord({
    ...baseRecord,
    state: 'promoted',
    assessment: { ...baseRecord.assessment, recommendation: 'reuse' }
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /execution or benchmark evidence/);
  assert.match(result.stderr, /usedIn project\/evaluation reference/);
});

test('quarantined candidate cannot be publication safe', async () => {
  const result = await validateRecord({
    ...baseRecord,
    state: 'quarantined',
    licence: { ...baseRecord.licence, status: 'ambiguous' },
    commercialUse: 'unknown',
    provenance: { ...baseRecord.provenance, confidence: 'low' },
    publication: { safe: true, slug: 'unsafe-fixture' }
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /cannot be publication.safe=true/);
});

test('public exporter includes safe qualified records and excludes rejected records even if misflagged safe', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'reuse-export-'));
  const output = path.join(dir, 'public.json');
  try {
    const safe = {
      ...baseRecord,
      id: 'safe-candidate',
      name: 'Safe Candidate',
      publication: { safe: true, slug: 'safe-candidate' }
    };
    const rejected = {
      ...baseRecord,
      id: 'rejected-candidate',
      name: 'Rejected Candidate',
      state: 'rejected',
      assessment: { ...baseRecord.assessment, recommendation: 'reject' },
      publication: { safe: true, slug: 'should-never-export' },
      rejectionReason: 'Fixture rejection.'
    };
    await writeFile(path.join(dir, 'safe.json'), JSON.stringify(safe, null, 2));
    await writeFile(path.join(dir, 'rejected.json'), JSON.stringify(rejected, null, 2));

    const result = spawnSync(process.execPath, [exporter], {
      cwd: process.cwd(),
      env: { ...process.env, REUSE_REGISTRY_DIR: dir, PUBLIC_REUSE_OUTPUT: output },
      encoding: 'utf8'
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);

    const exported = JSON.parse(await readFile(output, 'utf8'));
    assert.equal(exported.count, 1);
    assert.deepEqual(exported.records.map((record) => record.id), ['safe-candidate']);
    assert.equal(JSON.stringify(exported).includes('Rejected Candidate'), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
