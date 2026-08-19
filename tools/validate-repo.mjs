import { access, readFile } from 'node:fs/promises';
import process from 'node:process';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const requiredPaths = [
  'AGENTS.md',
  'CONTEXT.md',
  'README.md',
  'agents/PIPELINE-GOVERNOR.md',
  'docs/AI-AGENT-CONFIG.md',
  'docs/CONTROL-PLANE.md',
  'docs/COORDINATION-KERNEL.md',
  'docs/MONETIZATION-AND-LIVEOPS.md',
  'docs/PIPELINE.md',
  'docs/agents/domain.md',
  'docs/agents/issue-tracker.md',
  'workflows/cross-session-work.md',
  'schemas/asset-record.schema.json',
  'schemas/control-plane-state.schema.json',
  'schemas/game-graduation.schema.json',
  'schemas/pipeline-event.schema.json',
  'schemas/pipeline-run.schema.json',
  'schemas/work-unit.schema.json',
  'fixtures/control-plane/BYJTT-LAB-001.json',
  'experiments/BYJTT-LAB-001/README.md',
  'experiments/BYJTT-LAB-001/spec.md',
  'experiments/BYJTT-LAB-001/shared/README.md',
  'experiments/BYJTT-LAB-001/shared/assets/provenance.json',
  'experiments/BYJTT-LAB-001/records/pipeline-run.example.json',
  'experiments/BYJTT-LAB-001/records/game-graduation.example.json',
  'tools/check-game-graduation.mjs',
  'tools/record-pipeline-run.mjs',
  'apps/studio/index.html',
  'CLAUDE.md',
  '.github/copilot-instructions.md'
];

for (const path of requiredPaths) {
  try {
    await access(path);
  } catch {
    console.error(`Missing required path: ${path}`);
    process.exitCode = 1;
  }
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    console.error(`Invalid JSON in ${path}: ${error.message}`);
    process.exitCode = 1;
    return null;
  }
}

const provenance = await readJson('experiments/BYJTT-LAB-001/shared/assets/provenance.json');
if (provenance && !Array.isArray(provenance.assets)) {
  console.error('Provenance file must contain an assets array.');
  process.exitCode = 1;
}

const requiredSchemas = [
  'schemas/asset-record.schema.json',
  'schemas/control-plane-state.schema.json',
  'schemas/game-graduation.schema.json',
  'schemas/pipeline-event.schema.json',
  'schemas/pipeline-run.schema.json',
  'schemas/work-unit.schema.json'
];

for (const path of requiredSchemas) {
  const schema = await readJson(path);
  if (schema && (!schema.$schema || !schema.title || !schema.type)) {
    console.error(`Schema ${path} is missing $schema, title, or type.`);
    process.exitCode = 1;
  }
}

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);

const recordChecks = [
  ['schemas/pipeline-run.schema.json', 'experiments/BYJTT-LAB-001/records/pipeline-run.example.json'],
  ['schemas/game-graduation.schema.json', 'experiments/BYJTT-LAB-001/records/game-graduation.example.json'],
  ['schemas/control-plane-state.schema.json', 'fixtures/control-plane/BYJTT-LAB-001.json']
];

for (const [schemaPath, recordPath] of recordChecks) {
  const schema = await readJson(schemaPath);
  const record = await readJson(recordPath);
  if (!schema || !record) continue;
  const validate = ajv.compile(schema);
  if (!validate(record)) {
    console.error(`${recordPath} does not satisfy ${schemaPath}:`);
    console.error(ajv.errorsText(validate.errors, { separator: '\n' }));
    process.exitCode = 1;
  }
}

if (!process.exitCode) {
  console.log('Repository structure and versioned record contracts look valid.');
}
