import { readFile } from 'node:fs/promises';
import process from 'node:process';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const [recordPath] = process.argv.slice(2);

if (!recordPath) {
  console.error('Usage: npm run gate:graduation -- <game-graduation.json>');
  process.exit(2);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

try {
  const [schema, record] = await Promise.all([
    readJson('schemas/game-graduation.schema.json'),
    readJson(recordPath)
  ]);

  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);

  if (!validate(record)) {
    console.error('Graduation record does not satisfy the schema:');
    for (const error of validate.errors ?? []) {
      console.error(`- ${error.instancePath || '/'}: ${error.message}`);
    }
    process.exit(1);
  }

  if (record.decision !== 'graduate') {
    console.log(`Gate result: ${record.decision}. No production graduation requested.`);
    process.exit(0);
  }

  const blockers = [];

  if (!record.evidence.playableBuild) blockers.push('No verified playable build.');
  if ((record.evidence.references ?? []).length === 0) blockers.push('No reproducible evidence references.');
  if (!record.technical?.proposedRuntime) blockers.push('No proposed production runtime.');
  if (!record.technical?.runtimeDecisionEvidence) blockers.push('No evidence supporting the runtime decision.');
  if ((record.commercial.monetisationHypotheses ?? []).length === 0) blockers.push('No monetisation hypothesis.');
  if ((record.commercial.distributionHypotheses ?? []).length === 0) blockers.push('No distribution hypothesis.');
  if (!record.operations.telemetryRequired) blockers.push('Production telemetry is not required by the graduation plan.');
  if (!record.operations.releaseAutomationRequired) blockers.push('Release automation is not required by the graduation plan.');
  if ((record.nextActions ?? []).length === 0) blockers.push('No next actions defined.');

  for (const risk of record.risks ?? []) {
    if (risk.severity === 'P0' || risk.severity === 'P1') {
      blockers.push(`Unresolved ${risk.severity} risk: ${risk.risk}`);
    }
  }

  if (blockers.length > 0) {
    console.error('Graduation gate: BLOCKED');
    for (const blocker of blockers) console.error(`- ${blocker}`);
    process.exit(1);
  }

  console.log(`Graduation gate: PASS for ${record.candidateId}`);
} catch (error) {
  console.error(`Unable to evaluate graduation record: ${error.message}`);
  process.exit(1);
}
