import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSolvedSystemFacts } from '../apps/studio/latest-run-recovery.mjs';
import { executeSampleRun } from './studio-server.mjs';

const REVISION = `sha256:${'a'.repeat(64)}`;

function registryEvidence(overrides = {}) {
  return {
    registryRevision: REVISION,
    selectionMode: 'requested',
    entries: [{
      entry_id: 'system.reviewed-starter',
      name: 'Reviewed Starter',
      execution_status: 'SOURCE-VERIFIED',
      license_review_status: 'repository_only_verified'
    }],
    ...overrides
  };
}

test('dogfoods the real sample and surfaces its selected solved system without claiming runtime execution', async () => {
  const result = await executeSampleRun();
  assert.equal(result.status, 'pass');
  const facts = Object.fromEntries(buildSolvedSystemFacts(result.evidence.registry));
  assert.match(facts['Solved-system selection'], /GDevelop \(system\.gdevelop\)/);
  assert.match(facts['Solved-system selection'], /registry evidence SOURCE-VERIFIED/);
  assert.match(facts['Solved-system selection'], /licence review partial/);
  assert.match(facts['Solved-system selection'], /selection is not this run's runtime execution/);
  assert.match(facts['Registry provenance'], /^requested · sha256:[a-f0-9]{64}$/);
  assert.equal(result.evidence.build.executed, true);
  assert.equal(result.evidence.build.status, 'pass');
  assert.equal(result.evidence.qa.executed, true);
  assert.equal(result.evidence.qa.status, 'pass');
  assert.equal(result.safety.publicationExecuted, false);
  assert.equal(result.safety.secretsUsed, false);
});

test('rejects malformed or duplicated registry identities', () => {
  const missingId = registryEvidence({ entries: [{ name: 'Missing id', execution_status: 'SOURCE-VERIFIED', license_review_status: 'partial' }] });
  assert.throws(() => buildSolvedSystemFacts(missingId), /entry id/i);

  const duplicated = registryEvidence({ entries: [
    { entry_id: 'system.same', name: 'First', execution_status: 'SOURCE-VERIFIED', license_review_status: 'partial' },
    { entry_id: 'system.same', name: 'Second', execution_status: 'SOURCE-VERIFIED', license_review_status: 'partial' }
  ] });
  assert.throws(() => buildSolvedSystemFacts(duplicated), /duplicated/i);
});

test('rejects unknown evidence labels, missing licence review, mutable provenance shapes, and oversized selections', () => {
  const badStatus = registryEvidence();
  badStatus.entries[0].execution_status = 'VERIFIED';
  assert.throws(() => buildSolvedSystemFacts(badStatus), /evidence label/i);

  const noLicence = registryEvidence();
  delete noLicence.entries[0].license_review_status;
  assert.throws(() => buildSolvedSystemFacts(noLicence), /licence review status/i);

  assert.throws(() => buildSolvedSystemFacts(registryEvidence({ registryRevision: 'main' })), /registry revision/i);
  assert.throws(() => buildSolvedSystemFacts(registryEvidence({ selectionMode: 'manual-guess' })), /selection mode/i);
  assert.throws(() => buildSolvedSystemFacts(registryEvidence({ entries: Array.from({ length: 17 }, (_, index) => ({
    entry_id: `system.${index}`,
    name: `System ${index}`,
    execution_status: 'SOURCE-VERIFIED',
    license_review_status: 'partial'
  })) })), /incomplete/i);
});

test('keeps registry EXECUTED evidence explicitly distinct from execution in this pipeline run', () => {
  const registry = registryEvidence();
  registry.entries[0].execution_status = 'EXECUTED';
  const facts = Object.fromEntries(buildSolvedSystemFacts(registry));
  assert.match(facts['Solved-system selection'], /registry evidence EXECUTED/);
  assert.match(facts['Solved-system selection'], /selection is not this run's runtime execution/);
});
