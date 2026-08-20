import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const validator = path.resolve('tools/validate-reuse-registry.mjs');
const freshness = path.resolve('tools/check-reuse-registry-freshness.mjs');
const exporter = path.resolve('tools/export-public-reuse-registry.mjs');
const schema = path.resolve('schemas/reuse-candidate.schema.json');
const checkedAt = '2026-08-20T02:30:00Z';

const baseRecord = {
  id: 'fixture-candidate',
  name: 'Fixture Candidate',
  kind: 'controller',
  state: 'qualified',
  source: { canonicalUrl: 'https://example.com/controller', provider: 'Fixture' },
  licence: { status: 'verified', identifier: 'MIT', evidenceUrl: 'https://example.com/license', attributionRequired: true, checkedAt },
  commercialUse: 'verified-allowed',
  provenance: { confidence: 'high', notes: 'Fixture provenance.' },
  maintenance: { status: 'active', evidence: 'Fixture maintenance evidence.', checkedAt, notes: 'Maintained.' },
  compatibility: { engines: ['Fixture Engine'], platforms: ['desktop'], notes: 'Fixture compatibility.' },
  risk: { supplyChain: 'low', dependencyBurden: 'low', legalNotes: 'INTERNAL LEGAL DETAIL', securityNotes: 'INTERNAL SECURITY DETAIL' },
  assessment: { integrationEffort: 'low', lifecycleRisk: 'low', scores: { projectFit: 4 }, recommendation: 'benchmark', notes: 'INTERNAL ASSESSMENT DETAIL' },
  evidence: [{ type: 'official-repository', url: 'https://example.com/controller', checkedAt }],
  publication: { safe: false },
  usedIn: [],
  lastVerified: checkedAt
};

async function withRegistry(records, callback) {
  const dir = await mkdtemp(path.join(tmpdir(), 'reuse-registry-'));
  try {
    for (const [name, record] of Object.entries(records)) {
      await writeFile(path.join(dir, `${name}.json`), JSON.stringify(record, null, 2));
    }
    return await callback(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function validateRecord(record) {
  return withRegistry({ candidate: record }, async (dir) => spawnSync(process.execPath, [validator], {
    cwd: process.cwd(),
    env: { ...process.env, REUSE_REGISTRY_DIR: dir, REUSE_SCHEMA_PATH: schema },
    encoding: 'utf8'
  }));
}

function runFreshness(dir, extraEnv = {}) {
  return spawnSync(process.execPath, [freshness], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      REUSE_REGISTRY_DIR: dir,
      REUSE_FRESHNESS_NOW: '2026-08-20T12:00:00Z',
      REUSE_REGISTRY_MAX_AGE_DAYS: '90',
      REUSE_PROMOTED_MAX_AGE_DAYS: '45',
      ...extraEnv
    },
    encoding: 'utf8'
  });
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
  const result = await validateRecord({ ...baseRecord, state: 'promoted', assessment: { ...baseRecord.assessment, recommendation: 'reuse' } });
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

test('freshness fails a stale licence check even when the record and other evidence are recent', async () => {
  const staleLicence = {
    ...baseRecord,
    licence: { ...baseRecord.licence, checkedAt: '2026-04-01T00:00:00Z' },
    maintenance: { ...baseRecord.maintenance, checkedAt: '2026-08-20T02:30:00Z' },
    evidence: [{ ...baseRecord.evidence[0], checkedAt: '2026-08-20T02:30:00Z' }],
    lastVerified: '2026-08-20T02:30:00Z'
  };
  const result = await withRegistry({ stale: staleLicence }, async (dir) => runFreshness(dir));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /licence\.checkedAt is .* days old/);
});

test('freshness fails future-dated evidence', async () => {
  const futureEvidence = {
    ...baseRecord,
    evidence: [{ ...baseRecord.evidence[0], checkedAt: '2026-08-25T00:00:00Z' }]
  };
  const result = await withRegistry({ future: futureEvidence }, async (dir) => runFreshness(dir));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /evidence\.checkedAt .* is in the future/);
});

test('public exporter includes safe qualified records, excludes rejected records, and redacts internal detail', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'reuse-export-'));
  const output = path.join(dir, 'public.json');
  try {
    const safe = { ...baseRecord, id: 'safe-candidate', name: 'Safe Candidate', publication: { safe: true, slug: 'safe-candidate' } };
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
    const serialized = JSON.stringify(exported);
    assert.equal(exported.count, 1);
    assert.deepEqual(exported.records.map((record) => record.id), ['safe-candidate']);
    assert.equal(serialized.includes('Rejected Candidate'), false);
    assert.equal(serialized.includes('INTERNAL LEGAL DETAIL'), false);
    assert.equal(serialized.includes('INTERNAL SECURITY DETAIL'), false);
    assert.equal(serialized.includes('INTERNAL ASSESSMENT DETAIL'), false);
    assert.equal(Object.hasOwn(exported.records[0], 'risk'), false);
    assert.equal(Object.hasOwn(exported.records[0], 'provenance'), false);
    assert.equal(exported.records[0].licence.checkedAt, checkedAt);
    assert.equal(exported.records[0].maintenance.checkedAt, checkedAt);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
