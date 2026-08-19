import { readFile } from 'node:fs/promises';
import process from 'node:process';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const [workSchema, eventSchema, workUnit, events] = await Promise.all([
  readJson('schemas/work-unit.schema.json'),
  readJson('schemas/pipeline-event.schema.json'),
  readJson('fixtures/coordination/work-unit.claimed.valid.json'),
  readJson('fixtures/coordination/event-stream.valid.json')
]);

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validateWork = ajv.compile(workSchema);
const validateEvent = ajv.compile(eventSchema);
const failures = [];

if (!validateWork(workUnit)) failures.push(`work-unit schema: ${ajv.errorsText(validateWork.errors)}`);
for (const event of events) {
  if (!validateEvent(event)) failures.push(`event ${event.id} schema: ${ajv.errorsText(validateEvent.errors)}`);
}

function checkStream(stream) {
  const problems = [];
  const ids = new Set();
  const idempotency = new Set();
  const seen = new Set();
  let lastTime = 0;
  let activeClaim = false;
  let qaPassed = false;
  let qaFailedSincePass = false;
  let recoveryAfterFailure = false;
  let humanApproved = false;

  for (const event of stream) {
    const time = Date.parse(event.occurredAt);
    if (!Number.isFinite(time) || time < lastTime) problems.push(`non-monotonic timestamp at ${event.id}`);
    lastTime = time;
    if (ids.has(event.id)) problems.push(`duplicate event id ${event.id}`);
    ids.add(event.id);
    if (event.idempotencyKey) {
      if (idempotency.has(event.idempotencyKey)) problems.push(`duplicate idempotency key ${event.idempotencyKey}`);
      idempotency.add(event.idempotencyKey);
    }
    if (event.causationId && !seen.has(event.causationId)) problems.push(`causation ${event.causationId} is not an earlier event`);
    seen.add(event.id);

    if (event.type === 'work.claimed') {
      if (activeClaim) problems.push('second exclusive claim while work is already claimed');
      activeClaim = true;
    }
    if (event.type === 'work.released') {
      if (!activeClaim) problems.push('release without active claim');
      activeClaim = false;
      if (!humanApproved) problems.push('release before required human approval');
    }
    if (event.type === 'qa.failed') {
      qaPassed = false;
      qaFailedSincePass = true;
      recoveryAfterFailure = false;
    }
    if (event.type === 'recovery.attempted' && qaFailedSincePass) recoveryAfterFailure = true;
    if (event.type === 'qa.passed') {
      if (qaFailedSincePass && !recoveryAfterFailure) problems.push('qa passed after failure without a recorded recovery attempt');
      qaPassed = true;
      qaFailedSincePass = false;
    }
    if (event.type === 'human.verdict') {
      if (!qaPassed) problems.push('human verdict recorded before current candidate passed QA');
      if (event.payload?.decision === 'approved') humanApproved = true;
    }
  }
  return problems;
}

if (workUnit.status === 'claimed' && !workUnit.claim) failures.push('claimed work unit has no lease');
if (workUnit.claim) {
  if (Date.parse(workUnit.claim.expiresAt) <= Date.parse(workUnit.claim.claimedAt)) failures.push('claim expiry must be after claim time');
  if (workUnit.claim.role && workUnit.claim.role !== workUnit.role) failures.push('claim role does not match work-unit role');
}
if ((workUnit.contextPointers ?? []).some((pointer) => /chat|transcript|conversation/i.test(pointer))) {
  failures.push('context bundle must not depend on chat transcripts by default');
}
failures.push(...checkStream(events));

// Mutation tests: the checker must reject coordination failures, not just accept the fixture.
const duplicateClaim = structuredClone(events);
duplicateClaim.splice(1, 0, { ...structuredClone(events[0]), id: 'ev-duplicate-claim', occurredAt: '2026-08-19T00:21:00Z', idempotencyKey: 'claim-wu-001-second' });
if (!checkStream(duplicateClaim).some((p) => p.includes('second exclusive claim'))) failures.push('mutation test failed: duplicate claim was not rejected');

const prematureVerdict = [structuredClone(events[0]), structuredClone(events[5])];
prematureVerdict[1].causationId = 'ev-1';
if (!checkStream(prematureVerdict).some((p) => p.includes('before current candidate passed QA'))) failures.push('mutation test failed: premature human verdict was not rejected');

const missingRecovery = events.filter((event) => event.type !== 'recovery.attempted').map((event) => structuredClone(event));
const qaPass = missingRecovery.find((event) => event.type === 'qa.passed');
qaPass.causationId = 'ev-3';
if (!checkStream(missingRecovery).some((p) => p.includes('without a recorded recovery'))) failures.push('mutation test failed: missing recovery was not rejected');

if (failures.length) {
  console.error('Coordination kernel verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Coordination kernel contracts and adversarial invariants passed.');
