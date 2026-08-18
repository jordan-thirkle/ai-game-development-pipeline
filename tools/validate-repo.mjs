import { access, readFile } from 'node:fs/promises';

const requiredFiles = [
  'README.md',
  'LICENSE',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'AGENTS.md',
  'docs/METHOD.md',
  'docs/PUBLISHING.md',
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

console.log('Repository structure and technology registry are valid.');
