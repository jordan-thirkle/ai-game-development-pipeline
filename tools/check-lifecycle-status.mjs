import { readFile } from 'node:fs/promises';
import process from 'node:process';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const stageOrder = [
  'production',
  'soft-launch',
  'public-release',
  'operate-iterate',
  'liveops',
  'maintenance',
  'retirement'
];

function isHealthy(state) {
  return state?.status === 'healthy' && Boolean(state?.evidence);
}

function unresolvedCriticalRisks(record) {
  return (record.maintenance?.risks ?? []).filter(
    (risk) => (risk.severity === 'P0' || risk.severity === 'P1') && !['resolved', 'accepted'].includes(risk.status)
  );
}

export function evaluateLifecycleStatus(record, targetStage = record.lifecycleStage) {
  if (!stageOrder.includes(targetStage)) {
    throw new Error(`Unknown lifecycle stage: ${targetStage}`);
  }

  const currentIndex = stageOrder.indexOf(record.lifecycleStage);
  const targetIndex = stageOrder.indexOf(targetStage);
  const blockers = [];

  if (targetIndex > currentIndex + 1) {
    blockers.push(`Cannot skip lifecycle stages from ${record.lifecycleStage} directly to ${targetStage}.`);
  }

  if (!record.runtime?.decisionEvidence) blockers.push('Runtime decision evidence is missing.');
  if ((record.evidence?.pipelineRuns ?? []).length === 0) blockers.push('No pipeline-run evidence is recorded.');

  for (const risk of unresolvedCriticalRisks(record)) {
    blockers.push(`Unresolved ${risk.severity} risk: ${risk.risk}`);
  }

  const requiresSoftLaunch = targetIndex >= stageOrder.indexOf('soft-launch') && targetStage !== 'retirement';
  if (requiresSoftLaunch) {
    if (!isHealthy(record.health?.telemetry)) blockers.push('Telemetry is not healthy with evidence.');
    if (!isHealthy(record.health?.crashReporting)) blockers.push('Crash reporting is not healthy with evidence.');
    if (!isHealthy(record.health?.releasePipeline)) blockers.push('Release pipeline is not healthy with evidence.');
    if (!(record.releases ?? []).some((release) => ['testing', 'live'].includes(release.status))) {
      blockers.push('No testing or live release exists.');
    }
    if ((record.evidence?.releaseEvidence ?? []).length === 0) blockers.push('No release evidence is recorded.');
  }

  const requiresPublicRelease = targetIndex >= stageOrder.indexOf('public-release') && targetStage !== 'retirement';
  if (requiresPublicRelease) {
    if (!isHealthy(record.health?.support)) blockers.push('Support health is not healthy with evidence.');
    if (!(record.releases ?? []).some((release) => release.status === 'live')) blockers.push('No live release exists.');
    if ((record.evidence?.publicationSafe ?? []).length === 0) blockers.push('No publication-safe evidence is recorded.');
    if (record.monetisation?.state !== 'none' && !record.monetisation?.economicsEvidence) {
      blockers.push('Monetisation economics evidence is missing.');
    }
    if (record.monetisation?.state === 'live' && !isHealthy(record.health?.commerce)) {
      blockers.push('Commerce is not healthy with evidence for live monetisation.');
    }
  }

  const requiresOperationsReview = ['operate-iterate', 'liveops', 'maintenance'].includes(targetStage);
  if (requiresOperationsReview && !record.nextReview?.date) blockers.push('Next lifecycle review date is missing.');

  if (targetStage === 'maintenance') {
    if (!record.maintenance?.lastDependencyReview) blockers.push('Dependency review date is missing.');
    if (!record.maintenance?.lastPlatformReview) blockers.push('Platform review date is missing.');
  }

  if (targetStage === 'retirement') {
    const unsafeRelease = (record.releases ?? []).find((release) => !['paused', 'retired'].includes(release.status));
    if (unsafeRelease) blockers.push(`Release ${unsafeRelease.platform}/${unsafeRelease.channel} is still ${unsafeRelease.status}.`);
    if (!record.nextReview?.date) blockers.push('Retirement review date is missing.');
  }

  return {
    result: blockers.length === 0 ? 'pass' : 'blocked',
    currentStage: record.lifecycleStage,
    targetStage,
    blockers
  };
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export async function validateGameStatus(record) {
  const schema = await readJson('schemas/game-status.schema.json');
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const valid = validate(record);
  return { valid, errors: validate.errors ?? [] };
}

async function main() {
  const [recordPath, requestedStage] = process.argv.slice(2);
  if (!recordPath) {
    console.error('Usage: npm run gate:lifecycle -- <game-status.json> [target-stage]');
    process.exit(2);
  }

  try {
    const record = await readJson(recordPath);
    const validation = await validateGameStatus(record);
    if (!validation.valid) {
      console.error('Game status record does not satisfy the schema:');
      for (const error of validation.errors) console.error(`- ${error.instancePath || '/'}: ${error.message}`);
      process.exit(1);
    }

    const outcome = evaluateLifecycleStatus(record, requestedStage ?? record.lifecycleStage);
    console.log(JSON.stringify(outcome, null, 2));
    if (outcome.result !== 'pass') process.exit(1);
  } catch (error) {
    console.error(`Unable to evaluate lifecycle status: ${error.message}`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
