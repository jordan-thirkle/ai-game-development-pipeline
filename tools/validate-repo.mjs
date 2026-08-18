import { access, readFile } from 'node:fs/promises';

const requiredFiles = [
  'README.md',
  'LICENSE',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'AGENTS.md',
  'docs/METHOD.md',
  'docs/PUBLISHING.md',
  'docs/PIPELINE.md',
  'docs/MONETIZATION-AND-LIVEOPS.md',
  'agents/PIPELINE-GOVERNOR.md',
  'workflows/commercial-game-lifecycle.md',
  'schemas/pipeline-run.schema.json',
  'schemas/game-graduation.schema.json',
  'experiments/BYJTT-LAB-001/spec.md',
  'registry/technologies.json'
];

const failures = [];

for (const path of requiredFiles) {
  try {
    await access(path);
  } catch {
    failures.push(`Missing required file: ${path}`);
  }
}

for (const schemaPath of [
  'schemas/pipeline-run.schema.json',
  'schemas/game-graduation.schema.json'
]) {
  try {
    const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
    if (schema.$schema !== 'https://json-schema.org/draft/2020-12/schema') {
      failures.push(`${schemaPath} must declare JSON Schema draft 2020-12`);
    }
    if (!schema.$id || !schema.title || schema.type !== 'object') {
      failures.push(`${schemaPath} requires $id, title, and object type`);
    }
  } catch (error) {
    failures.push(`Unable to parse ${schemaPath}: ${error.message}`);
  }
}

try {
  const raw = await readFile('registry/technologies.json', 'utf8');
  const registry = JSON.parse(raw);

  if (registry.schema_version !== 1) {
    failures.push('registry/technologies.json must use schema_version 1');
  }

  if (!Array.isArray(registry.technologies) || registry.technologies.length === 0) {
    failures.push('Technology registry must contain at least one candidate');
  } else {
    const ids = new Set();
    const allowedStatuses = new Set(['candidate', 'verified', 'preferred', 'superseded']);

    for (const technology of registry.technologies) {
      if (!technology.id || !technology.name || !technology.category) {
        failures.push('Every technology requires id, name, and category');
      }
      if (ids.has(technology.id)) {
        failures.push(`Duplicate technology id: ${technology.id}`);
      }
      ids.add(technology.id);
      if (!allowedStatuses.has(technology.status)) {
        failures.push(`Invalid status for ${technology.id}: ${technology.status}`);
      }
      if (!Array.isArray(technology.evidence)) {
        failures.push(`Technology ${technology.id} must contain an evidence array`);
      }
    }
  }
} catch (error) {
  failures.push(`Unable to validate technology registry: ${error.message}`);
}

if (failures.length > 0) {
  console.error('Repository validation failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Repository structure, lifecycle contracts, schemas, and technology registry are valid.');
