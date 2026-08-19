import { access, readFile } from 'node:fs/promises';

const requiredFiles = [
  'README.md','LICENSE','CONTRIBUTING.md','SECURITY.md','AGENTS.md',
  'docs/METHOD.md','docs/PUBLISHING.md','docs/PIPELINE.md','docs/MONETIZATION-AND-LIVEOPS.md','docs/GAME-REPOSITORY-CONTRACT.md',
  'agents/PIPELINE-GOVERNOR.md','workflows/commercial-game-lifecycle.md',
  'schemas/pipeline-run.schema.json','schemas/game-graduation.schema.json','schemas/game-status.schema.json',
  'tools/validate-record.mjs','tools/new-record.mjs','tools/check-graduation-gate.mjs',
  'examples/records/pipeline-run.valid.json','examples/records/game-graduation.valid.json','examples/records/game-status.valid.json',
  'experiments/BYJTT-LAB-001/spec.md','experiments/BYJTT-LAB-001/preflight-2026-08-19.md',
  'experiments/BYJTT-LAB-001/shared/contract.json','experiments/BYJTT-LAB-001/shared/assets.md','experiments/BYJTT-LAB-001/shared/provenance.json',
  'registry/technologies.json'
];

const failures = [];
for (const path of requiredFiles) { try { await access(path); } catch { failures.push(`Missing required file: ${path}`); } }
for (const schemaPath of ['schemas/pipeline-run.schema.json','schemas/game-graduation.schema.json','schemas/game-status.schema.json']) {
  try {
    const schema = JSON.parse(await readFile(schemaPath,'utf8'));
    if (schema.$schema !== 'https://json-schema.org/draft/2020-12/schema') failures.push(`${schemaPath} must declare JSON Schema draft 2020-12`);
    if (!schema.$id || !schema.title || schema.type !== 'object') failures.push(`${schemaPath} requires $id, title, and object type`);
  } catch (error) { failures.push(`Unable to parse ${schemaPath}: ${error.message}`); }
}
try {
  const p = JSON.parse(await readFile('package.json','utf8'));
  if (p.dependencies?.ajv !== '8.20.0') failures.push('Ajv must remain pinned to the verified 8.20.0 baseline until deliberately upgraded');
  if (p.dependencies?.['ajv-formats'] !== '2.1.1') failures.push('ajv-formats must remain pinned to the verified 2.1.1 stable baseline until deliberately upgraded');
  for (const script of ['validate:record','new:record','gate:graduation']) if (!p.scripts?.[script]) failures.push(`package.json requires ${script} script`);
} catch (error) { failures.push(`Unable to validate package.json lifecycle tooling: ${error.message}`); }
try {
  const c = JSON.parse(await readFile('experiments/BYJTT-LAB-001/shared/contract.json','utf8'));
  if (c.schema_version !== 1 || c.experiment_id !== 'BYJTT-LAB-001') failures.push('Benchmark 001 shared contract must use schema_version 1 and experiment_id BYJTT-LAB-001');
  if (c.viewport?.target_fps !== 60) failures.push('Benchmark 001 reference target must remain 60 FPS unless the experiment spec is deliberately revised');
  if (!Array.isArray(c.repeatable_playthrough) || c.repeatable_playthrough.length < 10) failures.push('Benchmark 001 requires a complete repeatable playthrough sequence');
} catch (error) { failures.push(`Unable to validate Benchmark 001 shared contract: ${error.message}`); }
try {
  const p = JSON.parse(await readFile('experiments/BYJTT-LAB-001/shared/provenance.json','utf8'));
  if (p.schema_version !== 1 || p.experiment_id !== 'BYJTT-LAB-001') failures.push('Benchmark 001 provenance ledger must use schema_version 1 and experiment_id BYJTT-LAB-001');
  if (!Array.isArray(p.assets) || p.assets.length < 3) failures.push('Benchmark 001 provenance ledger requires shared character, animation, and environment candidates');
  else for (const asset of p.assets) if (!asset.id || !asset.source || !asset.license) failures.push('Every Benchmark 001 provenance asset requires id, source, and license');
} catch (error) { failures.push(`Unable to validate Benchmark 001 provenance ledger: ${error.message}`); }
try {
  const r = JSON.parse(await readFile('registry/technologies.json','utf8'));
  if (r.schema_version !== 1) failures.push('registry/technologies.json must use schema_version 1');
  if (!Array.isArray(r.technologies) || r.technologies.length === 0) failures.push('Technology registry must contain at least one candidate');
  else {
    const ids = new Set(); const statuses = new Set(['candidate','verified','preferred','superseded']); const benchmark = new Set(['three-webgpu','playcanvas','babylonjs','godot','unity','defold']);
    for (const t of r.technologies) {
      if (!t.id || !t.name || !t.category) failures.push('Every technology requires id, name, and category');
      if (ids.has(t.id)) failures.push(`Duplicate technology id: ${t.id}`); ids.add(t.id);
      if (!statuses.has(t.status)) failures.push(`Invalid status for ${t.id}: ${t.status}`);
      if (!Array.isArray(t.evidence)) failures.push(`Technology ${t.id} must contain an evidence array`);
      if (benchmark.has(t.id) && !t.benchmark_pin) failures.push(`Benchmark candidate ${t.id} requires a verified benchmark_pin`);
    }
  }
} catch (error) { failures.push(`Unable to validate technology registry: ${error.message}`); }
if (failures.length) { console.error('Repository validation failed:\n'); for (const f of failures) console.error(`- ${f}`); process.exit(1); }
console.log('Repository structure, lifecycle scaffolds/tooling, production-game contract, schemas, Benchmark 001 contract/provenance, and technology registry are valid.');
