import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const schemaPath = path.resolve('schemas/mode-transition.schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);

const revisionA = 'a'.repeat(40);
const revisionB = 'b'.repeat(40);

function validRecord(overrides = {}) {
  return {
    schemaVersion: '0.1',
    id: 'transition-1',
    projectId: 'project-1',
    sourceMode: 'creator',
    targetMode: 'pro',
    sourceRevision: revisionA,
    targetRevision: revisionB,
    transitionClass: 'one_way_handoff',
    actor: { kind: 'system', id: 'test' },
    recordedAt: '2026-08-28T00:00:00Z',
    capabilities: { preserved: [], added: [], removed: [], transformed: [], unavailable: [] },
    provenanceStatus: { code: 'preserved', losses: [] },
    evidenceMapping: { carriedForward: ['evidence-1'], superseded: [], unmapped: [] },
    ...overrides,
  };
}

test('valid transition record passes', () => {
  assert.equal(validate(validRecord()), true);
});

test('branch names and placeholders cannot satisfy exact revisions', () => {
  for (const value of ['main', 'latest', 'unknown', 'a'.repeat(39), 'a'.repeat(41)]) {
    assert.equal(validate(validRecord({ sourceRevision: value })), false, value);
  }
});

test('reversible transition requires executed passing verification with evidence', () => {
  assert.equal(validate(validRecord({ transitionClass: 'reversible' })), false);
  assert.equal(validate(validRecord({
    transitionClass: 'reversible',
    verification: { status: 'fail', evidenceIds: ['evidence-1'] },
  })), false);
  assert.equal(validate(validRecord({
    transitionClass: 'reversible',
    verification: { status: 'pass', evidenceIds: [] },
  })), false);
  assert.equal(validate(validRecord({
    transitionClass: 'reversible',
    verification: { status: 'pass', evidenceIds: ['evidence-1'] },
  })), true);
});

test('checkpoint cannot claim not-created', () => {
  assert.equal(validate(validRecord({ checkpoint: { created: false, revision: revisionA } })), false);
  assert.equal(validate(validRecord({ checkpoint: { created: true, revision: revisionA } })), true);
});

test('unexpected top-level fields are rejected', () => {
  assert.equal(validate({ ...validRecord(), forgedAuthority: true }), false);
});
