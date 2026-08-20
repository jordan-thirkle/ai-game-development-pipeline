import { access, readFile } from 'node:fs/promises';

const requiredFiles = [
  'README.md','LICENSE','CONTRIBUTING.md','SECURITY.md','AGENTS.md',
  'docs/METHOD.md','docs/PUBLISHING.md','docs/PIPELINE.md','docs/MONETIZATION-AND-LIVEOPS.md','docs/GAME-REPOSITORY-CONTRACT.md',
  'agents/PIPELINE-GOVERNOR.md','workflows/commercial-game-lifecycle.md',
  'schemas/pipeline-run.schema.json','schemas/game-graduation.schema.json','schemas/game-status.schema.json',
  'tools/validate-record.mjs','tools/check-graduation-gate.mjs',
  'examples/records/pipeline-run.valid.json','examples/records/game-graduation.valid.json','examples/records/game-status.valid.json',
  'experiments/BYJTT-LAB-001/spec.md','experiments/BYJTT-LAB-001/preflight-2026-08-19.md',
  'experiments/BYJTT-LAB-001/shared/contract.json','experiments/BYJTT-LAB-001/shared/assets.md','experiments/BYJTT-LAB-001/shared/provenance.json',
  'registry/technologies.json','registry/ai-game-dev-systems.v1.json'
];

const failures = [];
for (const path of requiredFiles) {
  try { await access(path); } catch { failures.push(`Missing required file: ${path}`); }
}

for (const schemaPath of ['schemas/pipeline-run.schema.json','schemas/game-graduation.schema.json','schemas/game-status.schema.json']) {
  try {
    const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
    if (schema.$schema !== 'https://json-schema.org/draft/2020-12/schema') failures.push(`${schemaPath} must declare JSON Schema draft 2020-12`);
    if (!schema.$id || !schema.title || schema.type !== 'object') failures.push(`${schemaPath} requires $id, title, and object type`);
  } catch (error) { failures.push(`Unable to parse ${schemaPath}: ${error.message}`); }
}

try {
  const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
  if (packageJson.dependencies?.ajv !== '8.20.0') failures.push('Ajv must remain pinned to the verified 8.20.0 baseline until deliberately upgraded');
  if (packageJson.dependencies?.['ajv-formats'] !== '2.1.1') failures.push('ajv-formats must remain pinned to the verified 2.1.1 stable baseline until deliberately upgraded');
  for (const script of ['validate:record','gate:graduation']) if (!packageJson.scripts?.[script]) failures.push(`package.json requires ${script} script`);
} catch (error) { failures.push(`Unable to validate package.json lifecycle tooling: ${error.message}`); }

try {
  const contract = JSON.parse(await readFile('experiments/BYJTT-LAB-001/shared/contract.json','utf8'));
  if (contract.schema_version !== 1 || contract.experiment_id !== 'BYJTT-LAB-001') failures.push('Benchmark 001 shared contract must use schema_version 1 and experiment_id BYJTT-LAB-001');
  if (contract.viewport?.target_fps !== 60) failures.push('Benchmark 001 reference target must remain 60 FPS unless the experiment spec is deliberately revised');
  if (!Array.isArray(contract.repeatable_playthrough) || contract.repeatable_playthrough.length < 10) failures.push('Benchmark 001 requires a complete repeatable playthrough sequence');
} catch (error) { failures.push(`Unable to validate Benchmark 001 shared contract: ${error.message}`); }

try {
  const provenance = JSON.parse(await readFile('experiments/BYJTT-LAB-001/shared/provenance.json','utf8'));
  if (provenance.schema_version !== 1 || provenance.experiment_id !== 'BYJTT-LAB-001') failures.push('Benchmark 001 provenance ledger must use schema_version 1 and experiment_id BYJTT-LAB-001');
  if (!Array.isArray(provenance.assets) || provenance.assets.length < 3) failures.push('Benchmark 001 provenance ledger requires shared character, animation, and environment candidates');
  else for (const asset of provenance.assets) if (!asset.id || !asset.source || !asset.license) failures.push('Every Benchmark 001 provenance asset requires id, source, and license');
} catch (error) { failures.push(`Unable to validate Benchmark 001 provenance ledger: ${error.message}`); }

try {
  const registry = JSON.parse(await readFile('registry/technologies.json','utf8'));
  if (registry.schema_version !== 1) failures.push('registry/technologies.json must use schema_version 1');
  if (!Array.isArray(registry.technologies) || registry.technologies.length === 0) failures.push('Technology registry must contain at least one candidate');
  else {
    const ids = new Set();
    const allowedStatuses = new Set(['candidate','verified','preferred','superseded']);
    const benchmarkCandidates = new Set(['three-webgpu','playcanvas','babylonjs','godot','unity','defold']);
    for (const technology of registry.technologies) {
      if (!technology.id || !technology.name || !technology.category) failures.push('Every technology requires id, name, and category');
      if (ids.has(technology.id)) failures.push(`Duplicate technology id: ${technology.id}`);
      ids.add(technology.id);
      if (!allowedStatuses.has(technology.status)) failures.push(`Invalid status for ${technology.id}: ${technology.status}`);
      if (!Array.isArray(technology.evidence)) failures.push(`Technology ${technology.id} must contain an evidence array`);
      if (benchmarkCandidates.has(technology.id) && !technology.benchmark_pin) failures.push(`Benchmark candidate ${technology.id} requires a verified benchmark_pin`);
    }
  }
} catch (error) { failures.push(`Unable to validate technology registry: ${error.message}`); }

try {
  const registryPath = 'registry/ai-game-dev-systems.v1.json';
  const registry = JSON.parse(await readFile(registryPath, 'utf8'));
  const timestampPattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-](\d{2}):(\d{2}))$/;
  const immutableRevision = /^(?:[0-9a-f]{40}|sha256:[0-9a-f]{64})$/i;

  const isValidOffsetTimestamp = (value) => {
    if (typeof value !== 'string') return false;
    const match = value.match(timestampPattern);
    if (!match) return false;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const hour = Number(match[4]);
    const minute = Number(match[5]);
    const second = Number(match[6]);
    const offsetHour = match[8] === undefined ? 0 : Number(match[8]);
    const offsetMinute = match[9] === undefined ? 0 : Number(match[9]);
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]) return false;
    if (hour > 23 || minute > 59 || second > 59 || offsetHour > 23 || offsetMinute > 59) return false;
    return !Number.isNaN(Date.parse(value));
  };

  const isValidIanaTimezone = (value) => {
    if (typeof value !== 'string' || value.length === 0) return false;
    try {
      new Intl.DateTimeFormat('en-GB', { timeZone: value }).format(new Date(0));
      return true;
    } catch {
      return false;
    }
  };

  const evidenceLabelsValid = Array.isArray(registry.evidence_labels);
  if (!evidenceLabelsValid) failures.push(`${registryPath} evidence_labels must be an array`);
  const evidenceLabels = new Set(evidenceLabelsValid ? registry.evidence_labels : []);

  const adoptionMapValid = registry.adoption_status_map !== null && typeof registry.adoption_status_map === 'object' && !Array.isArray(registry.adoption_status_map);
  if (!adoptionMapValid) failures.push(`${registryPath} adoption_status_map must be a non-null object`);
  const adoptionTokens = new Set(adoptionMapValid ? Object.values(registry.adoption_status_map) : []);

  if (typeof registry.schema_version !== 'string' || !/^\d+\.\d+\.\d+$/.test(registry.schema_version)) failures.push(`${registryPath} requires a semantic-version schema_version`);
  if (!isValidIanaTimezone(registry.verification_timezone)) failures.push(`${registryPath} requires a valid IANA verification_timezone`);
  if (!isValidOffsetTimestamp(registry.last_verified_at)) failures.push(`${registryPath} requires a calendar-valid offset-aware RFC3339 last_verified_at timestamp`);
  if (evidenceLabels.size === 0) failures.push(`${registryPath} requires evidence_labels`);
  if (adoptionTokens.size === 0) failures.push(`${registryPath} requires adoption_status_map values`);

  const benchmarkIds = new Set();
  if (!Array.isArray(registry.benchmarks) || registry.benchmarks.length === 0) {
    failures.push(`${registryPath} requires at least one benchmark`);
  } else {
    for (const benchmark of registry.benchmarks) {
      const benchmarkId = benchmark?.benchmark_id ?? '<missing-benchmark-id>';
      if (!benchmark || typeof benchmark !== 'object' || !benchmark.benchmark_id || !benchmark.name || !benchmark.category || !benchmark.canonical_url || !benchmark.revision) failures.push('Every AI game-dev benchmark requires benchmark_id, name, category, canonical_url, and revision');
      if (benchmarkIds.has(benchmark?.benchmark_id)) failures.push(`Duplicate AI game-dev benchmark id: ${benchmark?.benchmark_id}`);
      benchmarkIds.add(benchmark?.benchmark_id);
      if (!immutableRevision.test(String(benchmark?.revision ?? ''))) failures.push(`AI game-dev benchmark ${benchmarkId} requires an immutable Git SHA or sha256 content hash revision`);
    }
  }

  const entryIds = new Set();
  if (!Array.isArray(registry.entries) || registry.entries.length === 0) {
    failures.push(`${registryPath} requires at least one entry`);
  } else {
    for (const entry of registry.entries) {
      const id = entry?.entry_id ?? '<missing-entry-id>';
      if (!entry || typeof entry !== 'object') {
        failures.push('Every AI game-dev entry must be an object');
        continue;
      }
      for (const field of ['entry_id','name','category','canonical_url','source_type','source_revision_status','license','version_or_revision','last_verified_at','execution_status','benchmark_id','adoption_status','replacement_cost','lock_in_risk','license_review_status','redistribution_status']) {
        if (entry[field] === undefined || entry[field] === null || entry[field] === '') failures.push(`AI game-dev entry ${id} requires ${field}`);
      }
      if (entryIds.has(entry.entry_id)) failures.push(`Duplicate AI game-dev entry id: ${entry.entry_id}`);
      entryIds.add(entry.entry_id);
      if (!evidenceLabels.has(entry.execution_status)) failures.push(`Invalid evidence status for ${id}: ${entry.execution_status}`);
      if (!benchmarkIds.has(entry.benchmark_id)) failures.push(`Unknown benchmark_id for ${id}: ${entry.benchmark_id}`);
      const adoptionParts = typeof entry.adoption_status === 'string' ? entry.adoption_status.split('+').filter(Boolean) : [];
      if (adoptionParts.length === 0 || adoptionParts.some((part) => !adoptionTokens.has(part))) failures.push(`Invalid adoption_status for ${id}: ${entry.adoption_status}`);
      if (new Set(adoptionParts).size !== adoptionParts.length) failures.push(`Duplicate adoption_status token for ${id}: ${entry.adoption_status}`);
      if (adoptionParts.includes('rejected') && adoptionParts.length !== 1) failures.push(`Rejected AI game-dev entry ${id} cannot combine rejected with another adoption status`);
      if (!isValidOffsetTimestamp(entry.last_verified_at)) failures.push(`Invalid calendar-valid offset-aware last_verified_at for ${id}: ${entry.last_verified_at}`);
      if (/immutable.*commit/i.test(String(entry.source_revision_status)) && !/^[0-9a-f]{40}$/i.test(String(entry.version_or_revision))) failures.push(`AI game-dev entry ${id} declares an immutable commit but revision is not a 40-character Git SHA`);
      if (adoptionParts.includes('rejected') && (!entry.notes || !/(block|reject|restrict|licen|territor|incompat)/i.test(entry.notes))) failures.push(`Rejected AI game-dev entry ${id} requires an explanatory blocking reason in notes`);
    }
  }
} catch (error) { failures.push(`Unable to validate AI game-development systems registry: ${error.message}`); }

if (failures.length > 0) {
  console.error('Repository validation failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Repository structure, lifecycle tooling, production-game contract, schemas, Benchmark 001 contract/provenance, technology registry, and AI game-development systems registry are valid.');
