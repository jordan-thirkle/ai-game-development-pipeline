import { readFile } from 'node:fs/promises';
import process from 'node:process';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const [workSchema, eventSchema, workUnit, events] = await Promise.all([
  readJson('schemas/work-unit.schema.json'),
  readJson('schemas/pipeline-event.schema.json'),
  readJson('fixtures/coordination/work-unit.completed.valid.json'),
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

function checkStream(stream, { requiresHuman = true, expectedClaim = null } = {}) {
  const problems = [], ids = new Set(), keys = new Set(), seen = new Set();
  let lastTime = 0, activeClaim = false, activeLease = null, activeOwner = null;
  let currentRevision = null, qaRevision = null, approvalRevision = null;
  let failedSincePass = false, recoveryAfterFailure = false, correlationId = null, workUnitId = null, released = false;

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

    if (event.type === 'work.claimed') {
      if (activeClaim) problems.push('second exclusive claim');
      activeClaim = true; activeLease = event.payload?.leaseId ?? null; activeOwner = event.actor.id;
      if (expectedClaim) {
        if (activeLease !== expectedClaim.leaseId) problems.push('claim lease does not match work-unit lease');
        if (activeOwner !== expectedClaim.owner) problems.push('claim owner does not match work-unit owner');
      }
    }

    if (event.type === 'implementation.changed') {
      if (failedSincePass && !recoveryAfterFailure) problems.push('implementation changed after QA failure without recovery evidence');
      currentRevision = event.repositoryRevision;
      qaRevision = null; approvalRevision = null;
      failedSincePass = false; recoveryAfterFailure = false;
    }

    if (event.type === 'qa.failed') {
      if (currentRevision && event.repositoryRevision !== currentRevision) problems.push('QA failure targets a non-current revision');
      qaRevision = null; approvalRevision = null; failedSincePass = true; recoveryAfterFailure = false;
    }
    if (event.type === 'recovery.attempted' && failedSincePass) recoveryAfterFailure = true;
    if (event.type === 'qa.passed') {
      if (!currentRevision || event.repositoryRevision !== currentRevision) problems.push('QA pass does not match current implementation revision');
      qaRevision = event.repositoryRevision;
      failedSincePass = false; recoveryAfterFailure = false;
    }
    if (event.type === 'human.verdict') {
      if (event.actor.kind !== 'human') problems.push('human verdict was not authored by a human');
      if (!qaRevision || event.repositoryRevision !== currentRevision || event.repositoryRevision !== qaRevision) problems.push('human verdict does not match current QA-passed revision');
      approvalRevision = event.actor.kind === 'human' && event.payload?.decision === 'approved' ? event.repositoryRevision : null;
    }
    if (event.type === 'work.released') {
      if (!activeClaim) problems.push('release without claim');
      if (event.payload?.leaseId !== activeLease) problems.push('release lease does not match active claim');
      if (event.actor.id !== activeOwner) problems.push('release actor does not own active claim');
      if (!currentRevision || event.repositoryRevision !== currentRevision) problems.push('release does not match current implementation revision');
      if (qaRevision !== currentRevision) problems.push('release before QA of current revision');
      if (requiresHuman && approvalRevision !== currentRevision) problems.push('release before human approval of current revision');
      activeClaim = false; activeLease = null; activeOwner = null; released = true;
    }
  }
  if (activeClaim) problems.push('event stream ended with active claim');
  return { problems, final: { released, currentRevision, activeClaim, qaRevision, approvalRevision } };
}

const historicalClaim = workUnit.lastClaim ?? workUnit.claim;
if (!historicalClaim) failures.push('completed work unit lacks historical claim evidence');
if (historicalClaim) {
  if (Date.parse(historicalClaim.expiresAt) <= Date.parse(historicalClaim.claimedAt)) failures.push('lease expiry is not after claim');
  if (historicalClaim.role && historicalClaim.role !== workUnit.role) failures.push('claim role differs from work-unit role');
}
if ((workUnit.contextPointers ?? []).some((pointer) => /chat|transcript|conversation/i.test(pointer))) failures.push('default context depends on chat history');
if (events.some((event) => event.projectId !== workUnit.projectId)) failures.push('event stream contains a different project id');
if (events.some((event) => event.workUnitId !== workUnit.id)) failures.push('event stream contains a different work-unit id');
if (events[0]?.repositoryRevision !== workUnit.startRevision) failures.push('claim event revision does not match work-unit start revision');

const requiresHuman = workUnit.approvalClass !== 'autonomous';
const validResult = checkStream(events, { requiresHuman, expectedClaim: historicalClaim });
failures.push(...validResult.problems);
const terminal = events.at(-1);
if (terminal?.type === 'work.released') {
  if (workUnit.status !== 'complete') failures.push('released event stream requires completed work-unit status');
  if (workUnit.claim !== null) failures.push('released event stream requires no active work-unit claim');
  if (workUnit.resultRevision !== terminal.repositoryRevision) failures.push('work-unit result revision differs from released revision');
  if (!validResult.final.released || validResult.final.activeClaim) failures.push('terminal release did not clear active claim');
}

const expectMutation = (name, stream, needle, options = { requiresHuman, expectedClaim: historicalClaim }) => {
  const result = checkStream(stream, options).problems;
  if (!result.some((x) => x.includes(needle))) failures.push(`mutation: ${name} was accepted`);
};

const duplicateClaim = structuredClone(events);
duplicateClaim.splice(1, 0, { ...structuredClone(events[0]), id: 'ev-x', occurredAt: '2026-08-19T00:21:00Z', idempotencyKey: 'claim-x' });
expectMutation('duplicate claim', duplicateClaim, 'second exclusive claim');

const wrongLease = structuredClone(events); wrongLease[0].payload.leaseId = 'lease-other';
expectMutation('mismatched claim lease', wrongLease, 'claim lease does not match');

const wrongOwner = structuredClone(events); wrongOwner[0].actor.id = 'worker-other';
expectMutation('mismatched claim owner', wrongOwner, 'claim owner does not match');

const noRecovery = events.filter((event) => event.type !== 'recovery.attempted').map((event) => structuredClone(event));
const r2Change = noRecovery.find((event) => event.id === 'ev-5'); r2Change.causationId = 'ev-3';
expectMutation('missing recovery', noRecovery, 'without recovery evidence');

const agentVerdict = structuredClone(events); agentVerdict.find((event) => event.type === 'human.verdict').actor = { kind: 'agent', id: 'approval-bot', role: 'QA Critic' };
expectMutation('agent-authored human verdict', agentVerdict, 'not authored by a human');

const rejectedVerdict = structuredClone(events); rejectedVerdict.find((event) => event.type === 'human.verdict').payload.decision = 'needs-work';
expectMutation('release after non-approved verdict', rejectedVerdict, 'before human approval');

const changedAfterApproval = structuredClone(events);
const releaseIndex = changedAfterApproval.findIndex((event) => event.type === 'work.released');
changedAfterApproval.splice(releaseIndex, 0, { ...structuredClone(events[4]), id: 'ev-new-revision', occurredAt: '2026-08-19T00:55:30Z', repositoryRevision: 'candidate-r3', causationId: 'ev-7', idempotencyKey: 'impl-wu-001-r3' });
changedAfterApproval.at(-1).repositoryRevision = 'candidate-r3'; changedAfterApproval.at(-1).causationId = 'ev-new-revision';
expectMutation('release of changed revision without fresh QA/approval', changedAfterApproval, 'before QA of current revision');

const duplicateKey = structuredClone(events); duplicateKey[1].idempotencyKey = duplicateKey[0].idempotencyKey;
expectMutation('duplicate idempotency key', duplicateKey, 'duplicate idempotency');

const autonomous = events.filter((event) => event.type !== 'human.verdict').map((event) => structuredClone(event));
const autonomousRelease = autonomous.find((event) => event.type === 'work.released'); autonomousRelease.causationId = 'ev-6';
const autonomousResult = checkStream(autonomous, { requiresHuman: false, expectedClaim: historicalClaim });
if (autonomousResult.problems.length) failures.push(`mutation: autonomous flow incorrectly failed: ${autonomousResult.problems.join('; ')}`);

if (failures.length) {
  console.error('Coordination verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Coordination lease, revision, human-authority, recovery, idempotency and terminal-state invariants passed.');
