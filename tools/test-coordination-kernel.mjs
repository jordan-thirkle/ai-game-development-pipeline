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

if (!validateWork(workUnit)) failures.push(`work schema: ${ajv.errorsText(validateWork.errors)}`);
for (const event of events) if (!validateEvent(event)) failures.push(`event ${event.id}: ${ajv.errorsText(validateEvent.errors)}`);

const mutatingTypes = new Set(['work.claimed','work.released','decision.accepted','implementation.changed','build.ready','build.failed','qa.passed','qa.failed','human.verdict','component.promoted','release.shipped','recovery.attempted','coordination.conflict']);

function checkStream(stream, { requiresHuman = true } = {}) {
  const problems = [], ids = new Set(), keys = new Set(), seen = new Set();
  let lastTime = 0, activeClaim = false, qaPassed = false, failedSincePass = false, recoveryAfterFailure = false, humanApproved = false, correlationId = null, workUnitId = null;
  for (const event of stream) {
    const time = Date.parse(event.occurredAt);
    if (!Number.isFinite(time) || time < lastTime) problems.push(`non-monotonic timestamp ${event.id}`);
    lastTime = time;
    if (ids.has(event.id)) problems.push(`duplicate event id ${event.id}`); ids.add(event.id);
    if (mutatingTypes.has(event.type) && !event.idempotencyKey) problems.push(`missing idempotency key ${event.id}`);
    if (event.idempotencyKey) { if (keys.has(event.idempotencyKey)) problems.push(`duplicate idempotency key ${event.idempotencyKey}`); keys.add(event.idempotencyKey); }
    if (event.causationId && !seen.has(event.causationId)) problems.push(`future/missing causation ${event.causationId}`); seen.add(event.id);
    correlationId ??= event.correlationId; if (event.correlationId !== correlationId) problems.push(`correlation changed at ${event.id}`);
    workUnitId ??= event.workUnitId; if (event.workUnitId !== workUnitId) problems.push(`work unit changed at ${event.id}`);
    if (event.type !== 'work.claimed' && !event.repositoryRevision) problems.push(`missing repository revision ${event.id}`);
    if (event.type === 'work.claimed') { if (activeClaim) problems.push('second exclusive claim'); activeClaim = true; }
    if (event.type === 'qa.failed') { qaPassed = false; failedSincePass = true; recoveryAfterFailure = false; }
    if (event.type === 'recovery.attempted' && failedSincePass) recoveryAfterFailure = true;
    if (event.type === 'qa.passed') { if (failedSincePass && !recoveryAfterFailure) problems.push('qa pass without recovery evidence'); qaPassed = true; failedSincePass = false; }
    if (event.type === 'human.verdict') { if (!qaPassed) problems.push('human verdict before current QA pass'); humanApproved = event.payload?.decision === 'approved'; }
    if (event.type === 'work.released') { if (!activeClaim) problems.push('release without claim'); if (!qaPassed) problems.push('release before current QA pass'); if (requiresHuman && !humanApproved) problems.push('release before required approval'); activeClaim = false; }
  }
  if (activeClaim) problems.push('event stream ended with active claim');
  return problems;
}

if (workUnit.status === 'claimed' && !workUnit.claim) failures.push('claimed work has no lease');
if (workUnit.claim) {
  if (Date.parse(workUnit.claim.expiresAt) <= Date.parse(workUnit.claim.claimedAt)) failures.push('lease expiry is not after claim');
  if (workUnit.claim.role && workUnit.claim.role !== workUnit.role) failures.push('claim role differs from work-unit role');
}
if ((workUnit.contextPointers ?? []).some((pointer) => /chat|transcript|conversation/i.test(pointer))) failures.push('default context depends on chat history');
if (events.some((event) => event.projectId !== workUnit.projectId)) failures.push('event stream contains a different project id');
if (events.some((event) => event.workUnitId !== workUnit.id)) failures.push('event stream contains a different work-unit id');
if (events[0]?.repositoryRevision !== workUnit.startRevision) failures.push('claim event revision does not match work-unit start revision');

const requiresHuman = workUnit.approvalClass !== 'autonomous';
failures.push(...checkStream(events, { requiresHuman }));

const duplicateClaim = structuredClone(events);
duplicateClaim.splice(1, 0, { ...structuredClone(events[0]), id: 'ev-x', occurredAt: '2026-08-19T00:21:00Z', idempotencyKey: 'claim-x' });
if (!checkStream(duplicateClaim, { requiresHuman }).some((x) => x.includes('second exclusive claim'))) failures.push('mutation: duplicate claim accepted');

const prematureVerdict = [structuredClone(events[0]), structuredClone(events[5])]; prematureVerdict[1].causationId = 'ev-1';
if (!checkStream(prematureVerdict, { requiresHuman }).some((x) => x.includes('human verdict before'))) failures.push('mutation: premature verdict accepted');

const noRecovery = events.filter((event) => event.type !== 'recovery.attempted').map((event) => structuredClone(event)); noRecovery.find((event) => event.type === 'qa.passed').causationId = 'ev-3';
if (!checkStream(noRecovery, { requiresHuman }).some((x) => x.includes('without recovery'))) failures.push('mutation: missing recovery accepted');

const duplicateKey = structuredClone(events); duplicateKey[1].idempotencyKey = duplicateKey[0].idempotencyKey;
if (!checkStream(duplicateKey, { requiresHuman }).some((x) => x.includes('duplicate idempotency'))) failures.push('mutation: duplicate idempotency accepted');

const rejectedVerdict = structuredClone(events); rejectedVerdict.find((event) => event.type === 'human.verdict').payload.decision = 'needs-work';
if (!checkStream(rejectedVerdict, { requiresHuman: true }).some((x) => x.includes('release before required approval'))) failures.push('mutation: release after non-approved human verdict accepted');

const autonomous = events.filter((event) => event.type !== 'human.verdict').map((event) => structuredClone(event)); autonomous.find((event) => event.type === 'work.released').causationId = 'ev-5';
if (checkStream(autonomous, { requiresHuman: false }).length !== 0) failures.push('mutation: autonomous work incorrectly required a human verdict');

if (failures.length) { console.error('Coordination verification failed:'); for (const failure of failures) console.error(`- ${failure}`); process.exit(1); }
console.log('Coordination contracts and adversarial invariants passed.');
