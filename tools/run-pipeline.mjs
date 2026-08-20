#!/usr/bin/env node

import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { execFile as execFileCallback } from 'node:child_process';
import { access, lstat, mkdir, readFile, readdir, realpath, writeFile, cp } from 'node:fs/promises';
import { accessSync } from 'node:fs';
import { promisify } from 'node:util';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const execFile = promisify(execFileCallback);
const THIS_FILE = fileURLToPath(import.meta.url);
const REPOSITORY_ROOT = resolve(dirname(THIS_FILE), '..');
const DEFAULT_MANIFEST_NAMES = ['project.manifest.json', 'manifest.json', 'project.json'];
const PHASE_FILES = {
  intake: 'intake.json',
  registry: 'registry-selection.json',
  build: 'build-result.json',
  qa: 'qa-result.json',
  releaseCandidate: 'release-candidate.json',
  publishing: 'publishing-receipt.json',
  run: 'pipeline-run.json'
};

export class PipelineError extends Error {
  constructor(message, code = 'PIPELINE_ERROR') {
    super(message);
    this.name = 'PipelineError';
    this.code = code;
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertNonEmptyString(value, label) {
  if (!nonEmptyString(value)) throw new PipelineError(`${label} must be a non-empty string`, 'INVALID_MANIFEST');
  return value;
}

function assertContained(basePath, candidatePath, label) {
  const base = resolve(basePath);
  const candidate = resolve(candidatePath);
  const rest = relative(base, candidate);
  if (rest === '..' || rest.startsWith(`..${sep}`) || isAbsolute(rest)) {
    throw new PipelineError(`${label} must remain inside ${base}`, 'PATH_CONTAINMENT');
  }
  return candidate;
}

export function resolveContained(basePath, candidatePath, label = 'path') {
  if (!nonEmptyString(candidatePath) || isAbsolute(candidatePath)) {
    throw new PipelineError(`${label} must be a relative path`, 'PATH_CONTAINMENT');
  }
  return assertContained(basePath, resolve(basePath, candidatePath), label);
}

async function ensureDirectory(directory, label) {
  try {
    const stat = await lstat(directory);
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new PipelineError(`${label} must be a real directory`, 'PATH_CONTAINMENT');
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    await mkdir(directory, { recursive: true });
  }
  return realpath(directory);
}

function jsonString(value) {
  return JSON.stringify(value, null, 2) + '\n';
}

async function writeJson(path, value) {
  await writeFile(path, jsonString(value), 'utf8');
}

async function readJson(path, label) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    throw new PipelineError(`Unable to read ${label}: ${error.message}`, 'INVALID_JSON');
  }
}

function safeId(value, label) {
  assertNonEmptyString(value, label);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)) {
    throw new PipelineError(`${label} may contain only letters, numbers, dots, underscores, and hyphens`, 'INVALID_MANIFEST');
  }
  return value;
}

function validateArgv(value, label) {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== 'string' || item.length === 0 || item.includes('\0'))) {
    throw new PipelineError(`${label} must be a non-empty argv array of strings`, 'INVALID_MANIFEST');
  }
  return [...value];
}

function validateRelativePath(value, label) {
  assertNonEmptyString(value, label);
  if (isAbsolute(value) || value.split(/[\\/]/).includes('..')) {
    throw new PipelineError(`${label} must be a relative path without traversal`, 'PATH_CONTAINMENT');
  }
  return value;
}

function forbiddenPublishKey(key) {
  return /secret|token|api[-_]?key|password|credential|store|upload/i.test(key);
}

function validateLocalPublishingPolicy(manifest, requestedDestination) {
  const publish = manifest.publish ?? {};
  if (!isPlainObject(publish)) throw new PipelineError('manifest.publish must be an object', 'PUBLISHING_REFUSED');

  for (const [key, value] of Object.entries(publish)) {
    if (forbiddenPublishKey(key) && value) {
      throw new PipelineError(`Publishing refused: manifest.publish.${key} is not allowed`, 'PUBLISHING_REFUSED');
    }
  }
  if (publish.provider && publish.provider !== 'local') {
    throw new PipelineError(`Publishing refused: provider ${publish.provider} is not a local dry-run target`, 'PUBLISHING_REFUSED');
  }
  if (publish.destination && !isLocalDestination(publish.destination)) {
    throw new PipelineError('Publishing refused: manifest destination is not local', 'PUBLISHING_REFUSED');
  }
  if (requestedDestination && !isLocalDestination(requestedDestination)) {
    throw new PipelineError('Publishing refused: destination is not local', 'PUBLISHING_REFUSED');
  }
  return requestedDestination || publish.destination || 'local://planned';
}

function isLocalDestination(value) {
  return value === 'local' || (typeof value === 'string' && value.startsWith('local://') && value.length > 'local://'.length);
}

export function validateProjectManifest(manifest) {
  if (!isPlainObject(manifest)) throw new PipelineError('Project manifest must be a JSON object', 'INVALID_MANIFEST');
  if (manifest.manifestVersion !== '1.0.0') throw new PipelineError('manifestVersion must be 1.0.0', 'INVALID_MANIFEST');
  const projectId = safeId(manifest.projectId, 'projectId');
  assertNonEmptyString(manifest.name, 'name');
  const build = manifest.build;
  const qa = manifest.qa;
  if (!isPlainObject(build)) throw new PipelineError('build must be an object', 'INVALID_MANIFEST');
  if (!isPlainObject(qa)) throw new PipelineError('qa must be an object', 'INVALID_MANIFEST');
  const buildArgv = validateArgv(build.argv, 'build.argv');
  const qaArgv = validateArgv(qa.argv, 'qa.argv');
  const artifact = validateRelativePath(build.artifact, 'build.artifact');

  const registry = manifest.registry ?? {};
  if (!isPlainObject(registry)) throw new PipelineError('registry must be an object', 'INVALID_MANIFEST');
  const entryIds = registry.entryIds ?? registry.toolIds ?? [];
  if (!Array.isArray(entryIds) || entryIds.some((id) => !nonEmptyString(id))) {
    throw new PipelineError('registry.entryIds must be an array of non-empty strings', 'INVALID_MANIFEST');
  }

  if (manifest.targetPlatforms !== undefined && (!Array.isArray(manifest.targetPlatforms) || manifest.targetPlatforms.some((item) => !nonEmptyString(item)))) {
    throw new PipelineError('targetPlatforms must be an array of non-empty strings', 'INVALID_MANIFEST');
  }
  validateLocalPublishingPolicy(manifest);
  return {
    ...manifest,
    projectId,
    build: { ...build, argv: buildArgv, artifact },
    qa: { ...qa, argv: qaArgv },
    registry: { ...registry, entryIds: [...new Set(entryIds)] }
  };
}

async function loadRegistry() {
  const indexPath = assertContained(REPOSITORY_ROOT, resolve(REPOSITORY_ROOT, 'registry/ai-game-dev-registry.v1.json'), 'registry index');
  const index = await readJson(indexPath, 'registry index');
  if (!Array.isArray(index.shards) || index.shards.length === 0) throw new PipelineError('Registry index has no shards', 'REGISTRY_ERROR');
  const loaded = [];
  const revisionHash = createHash('sha256');
  revisionHash.update(await readFile(indexPath));
  for (const shard of index.shards) {
    if (!isPlainObject(shard) || !nonEmptyString(shard.path) || shard.required !== true) {
      throw new PipelineError('Registry index contains an invalid required shard', 'REGISTRY_ERROR');
    }
    const shardPath = resolveContained(REPOSITORY_ROOT, shard.path, `registry shard ${shard.shard_id ?? '<unknown>'}`);
    const data = await readJson(shardPath, `registry shard ${shard.path}`);
    if (!Array.isArray(data.entries)) throw new PipelineError(`Registry shard ${shard.path} has no entries array`, 'REGISTRY_ERROR');
    revisionHash.update(await readFile(shardPath));
    loaded.push({ meta: shard, data });
  }
  return { index, shards: loaded, revision: `sha256:${revisionHash.digest('hex')}` };
}

export async function selectRegistryEntries(requestedIds = []) {
  const registry = await loadRegistry();
  const entries = registry.shards.flatMap(({ meta, data }) => data.entries.map((entry) => ({ ...entry, shardId: meta.shard_id, namespace: meta.namespace })));
  const byId = new Map(entries.map((entry) => [entry.entry_id, entry]));
  const ids = [...new Set(requestedIds.filter(nonEmptyString))];
  const selected = ids.length > 0
    ? ids.map((id) => {
      const entry = byId.get(id);
      if (!entry) throw new PipelineError(`Requested registry entry was not found: ${id}`, 'REGISTRY_SELECTION_ERROR');
      return entry;
    })
    : [entries.filter((entry) => entry.execution_status === 'SOURCE-VERIFIED').sort((a, b) => a.entry_id.localeCompare(b.entry_id))[0]];
  if (!selected[0]) throw new PipelineError('Registry has no SOURCE-VERIFIED default entry', 'REGISTRY_SELECTION_ERROR');
  return {
    registrySchemaVersion: registry.index.schema_version,
    registryRevision: registry.revision,
    selectionMode: ids.length > 0 ? 'requested' : 'deterministic-source-verified-default',
    entries: selected.map((entry) => ({ ...entry, execution_status: entry.execution_status }))
  };
}

async function hashPath(path) {
  const stat = await lstat(path);
  const hash = createHash('sha256');
  async function visit(current, relativePath) {
    const currentStat = await lstat(current);
    if (currentStat.isSymbolicLink()) {
      throw new PipelineError(`Artifact contains a symbolic link: ${relativePath}`, 'ARTIFACT_ERROR');
    }
    if (currentStat.isDirectory()) {
      hash.update(`directory\0${relativePath}\0`);
      const names = (await readdir(current)).sort((a, b) => Buffer.from(a).compare(Buffer.from(b)));
      for (const name of names) await visit(resolve(current, name), relativePath ? `${relativePath}/${name}` : name);
      return;
    }
    if (currentStat.isFile()) {
      hash.update(`file\0${relativePath}\0${currentStat.size}\0`);
      hash.update(await readFile(current));
      return;
    }
    throw new PipelineError(`Artifact contains unsupported filesystem entry: ${current}`, 'ARTIFACT_ERROR');
  }
  await visit(path, stat.isDirectory() ? '' : 'artifact');
  return `sha256:${hash.digest('hex')}`;
}

function expandArgv(argv, replacements) {
  return argv.map((arg) => replacements[arg] ?? arg);
}

async function runArgv(argv, { cwd, stdoutPath, stderrPath, replacements = {} }) {
  const expanded = expandArgv(argv, replacements);
  const stdout = [];
  const stderr = [];
  let child;
  try {
    child = spawn(expanded[0], expanded.slice(1), { cwd, shell: false, windowsHide: true });
  } catch (error) {
    throw new PipelineError(`Unable to start ${expanded[0]}: ${error.message}`, 'COMMAND_ERROR');
  }
  child.stdout?.on('data', (chunk) => stdout.push(chunk));
  child.stderr?.on('data', (chunk) => stderr.push(chunk));
  const result = await new Promise((resolveResult) => {
    let settled = false;
    const finish = (value) => { if (!settled) { settled = true; resolveResult(value); } };
    child.on('error', (error) => finish({ error }));
    child.on('close', (status, signal) => finish({ status, signal }));
  });
  await writeFile(stdoutPath, Buffer.concat(stdout));
  await writeFile(stderrPath, Buffer.concat(stderr));
  if (result.error) return { argv: expanded, status: null, signal: null, error: result.error.message };
  return { argv: expanded, status: result.status, signal: result.signal, error: null };
}

async function getSourceRevision(projectDir, manifest, explicitRevision) {
  if (nonEmptyString(explicitRevision)) return explicitRevision;
  if (nonEmptyString(manifest.sourceRevision)) return manifest.sourceRevision;
  try {
    const result = await execFile('git', ['rev-parse', 'HEAD'], { cwd: projectDir, shell: false, encoding: 'utf8' });
    if (nonEmptyString(result.stdout)) return result.stdout.trim();
  } catch {
    // A standalone sample copy need not be a Git checkout. The manifest hash is an honest fallback.
  }
  return `sha256:${createHash('sha256').update(jsonString(manifest)).digest('hex')}`;
}

function relativeOutput(outputDir, path) {
  const rest = relative(outputDir, path);
  if (rest === '..' || rest.startsWith(`..${sep}`) || isAbsolute(rest)) throw new PipelineError('Evidence path escaped output directory', 'PATH_CONTAINMENT');
  return rest || '.';
}

function createPipelineRun({ runId, startedAt, endedAt, manifest, sourceRevision, outputDir, artifacts, logs, status, summary, nextAction, buildPassed, qaPassed }) {
  return {
    schemaVersion: '1.0.0',
    runId,
    experimentId: null,
    gameId: manifest.projectId,
    startedAt,
    endedAt,
    scope: {
      taskType: 'prototype',
      objective: manifest.objective || `Run the local pipeline for ${manifest.name}`,
      candidate: manifest.projectId,
      targetPlatforms: manifest.targetPlatforms || []
    },
    inputs: {
      sourceCommit: sourceRevision,
      technologyVersions: { pipelineRunner: 'local-node-builtins', registry: 'ai-game-dev-registry.v1' },
      sharedAssetSet: null,
      specVersion: manifest.manifestVersion
    },
    execution: {
      models: [],
      toolCalls: 0,
      failedToolCalls: status === 'pass' ? 0 : 1,
      humanInterventions: 0,
      humanMinutes: 0,
      elapsedSeconds: Math.max(0, (Date.parse(endedAt) - Date.parse(startedAt)) / 1000),
      iterations: 1,
      bespokeLinesChanged: null,
      reusedComponents: [],
      estimatedReuseRatio: null,
      externalServiceCostUsd: 0
    },
    evidence: {
      executionVerified: buildPassed && qaPassed,
      artifacts: artifacts.map((path) => relativeOutput(outputDir, path)),
      screenshots: [],
      videos: [],
      logs: logs.map((path) => relativeOutput(outputDir, path)),
      profiles: [],
      deviceResults: [],
      automatedTestsPassed: qaPassed ? 1 : 0,
      automatedTestsFailed: qaPassed ? 0 : 1
    },
    outcome: { status, summary, failures: status === 'pass' ? [] : [summary], nextAction }
  };
}

async function writeFailureRun({ outputDir, runId, startedAt, manifest, sourceRevision, artifacts, logs, summary, buildPassed = false, qaPassed = false }) {
  const endedAt = new Date().toISOString();
  const record = createPipelineRun({ runId, startedAt, endedAt, manifest, sourceRevision, outputDir, artifacts, logs, status: 'fail', summary, nextAction: 'Repair the failed phase and run the pipeline again.', buildPassed, qaPassed });
  const path = resolveContained(outputDir, PHASE_FILES.run, 'pipeline-run record');
  await writeJson(path, record);
  return { path, record };
}

export async function scaffoldSampleProject(targetPath) {
  const target = resolve(targetPath);
  try {
    await lstat(target);
    throw new PipelineError(`Scaffold target already exists; refusing to overwrite: ${target}`, 'SCAFFOLD_REFUSED');
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const source = resolve(REPOSITORY_ROOT, 'examples/sample-game');
  await access(source);
  await cp(source, target, { recursive: true, errorOnExist: true, force: false });
  return target;
}

export async function runPipeline({ projectDir, manifestPath, outputDir, requestedEntryIds = [], destination, dryRun = false, sourceRevision } = {}) {
  if (dryRun !== true) throw new PipelineError('Publishing is disabled unless --dry-run is provided', 'DRY_RUN_REQUIRED');
  if (!nonEmptyString(projectDir)) throw new PipelineError('projectDir is required', 'USAGE');
  const project = await realpath(resolve(projectDir));
  const manifestCandidate = manifestPath ? resolve(manifestPath) : DEFAULT_MANIFEST_NAMES.map((name) => resolve(project, name)).find((candidate) => {
    try { return requireExists(candidate); } catch { return false; }
  });
  if (!manifestCandidate) throw new PipelineError(`No project manifest found in ${project}`, 'INVALID_MANIFEST');
  let manifestFile;
  try {
    manifestFile = await realpath(manifestCandidate);
  } catch (error) {
    throw new PipelineError(`Unable to resolve project manifest: ${error.message}`, 'INVALID_MANIFEST');
  }
  assertContained(project, manifestFile, 'project manifest');
  const manifest = validateProjectManifest(await readJson(manifestFile, 'project manifest'));
  const localDestination = validateLocalPublishingPolicy(manifest, destination);
  const output = await ensureDirectory(resolve(outputDir || resolve(REPOSITORY_ROOT, 'artifacts', manifest.projectId)), 'output directory');
  const declaredArtifactPath = resolveContained(project, manifest.build.artifact, 'build artifact');
  if (relative(declaredArtifactPath, output) === '' || !relative(declaredArtifactPath, output).startsWith(`..${sep}`)) {
    throw new PipelineError('output directory must not be inside the declared build artifact path', 'PATH_CONTAINMENT');
  }
  const runId = `run-${manifest.projectId}-${randomUUID()}`;
  const startedAt = new Date().toISOString();
  const source = await getSourceRevision(project, manifest, sourceRevision);
  const artifacts = [];
  const logs = [];

  const intakePath = resolveContained(output, PHASE_FILES.intake, 'intake record');
  const manifestBytes = await readFile(manifestFile);
  await writeJson(intakePath, {
    schemaVersion: '1.0.0',
    type: 'pipeline-intake',
    projectId: manifest.projectId,
    name: manifest.name,
    manifestPath: manifestFile,
    manifestSha256: `sha256:${createHash('sha256').update(manifestBytes).digest('hex')}`,
    sourceRevision: source,
    validation: { status: 'pass', checked: ['manifestVersion', 'projectId', 'build.argv', 'build.artifact', 'qa.argv', 'registry.entryIds', 'local-publishing-policy'] },
    createdAt: startedAt
  });
  artifacts.push(intakePath);

  const registrySelection = await selectRegistryEntries([...requestedEntryIds, ...(manifest.registry.entryIds || [])]);
  const registryPath = resolveContained(output, PHASE_FILES.registry, 'registry selection');
  await writeJson(registryPath, { schemaVersion: '1.0.0', type: 'registry-selection', selectedAt: new Date().toISOString(), ...registrySelection });
  artifacts.push(registryPath);

  const buildStdout = resolveContained(output, 'build.stdout.log', 'build stdout log');
  const buildStderr = resolveContained(output, 'build.stderr.log', 'build stderr log');
  logs.push(buildStdout, buildStderr);
  const buildResult = await runArgv(manifest.build.argv, { cwd: project, stdoutPath: buildStdout, stderrPath: buildStderr });
  let artifactPath;
  let artifactHash;
  try {
    artifactPath = resolveContained(project, manifest.build.artifact, 'build artifact');
    const artifactReal = await realpath(artifactPath);
    assertContained(project, artifactReal, 'build artifact');
    artifactPath = artifactReal;
    artifactHash = await hashPath(artifactPath);
  } catch (error) {
    if (!buildResult.error && buildResult.status === 0) buildResult.error = error.message;
  }
  const buildPassed = Boolean(buildResult.status === 0 && !buildResult.error && artifactHash);
  const buildPath = resolveContained(output, PHASE_FILES.build, 'build result');
  await writeJson(buildPath, {
    schemaVersion: '1.0.0', type: 'build-result', projectId: manifest.projectId, executed: true,
    status: buildPassed ? 'pass' : 'fail', argv: buildResult.argv, exitStatus: buildResult.status,
    signal: buildResult.signal, error: buildResult.error, artifactPath: artifactPath ? relative(project, artifactPath) : null,
    artifactSha256: artifactHash || null, stdoutPath: relativeOutput(output, buildStdout), stderrPath: relativeOutput(output, buildStderr), completedAt: new Date().toISOString()
  });
  artifacts.push(buildPath);

  if (!buildPassed) {
    const qaPath = resolveContained(output, PHASE_FILES.qa, 'QA result');
    await writeJson(qaPath, { schemaVersion: '1.0.0', type: 'qa-result', projectId: manifest.projectId, status: 'fail', passed: false, executed: false, reason: 'Build did not produce a usable artifact', evidencePaths: [relativeOutput(output, buildPath), relativeOutput(output, buildStdout), relativeOutput(output, buildStderr)] });
    artifacts.push(qaPath);
    const failure = await writeFailureRun({ outputDir: output, runId, startedAt, manifest, sourceRevision: source, artifacts, logs, summary: 'Build failed or did not produce a contained artifact.' });
    return { status: 'fail', outputDir: output, runPath: failure.path, record: failure.record };
  }

  const qaStdout = resolveContained(output, 'qa.stdout.log', 'QA stdout log');
  const qaStderr = resolveContained(output, 'qa.stderr.log', 'QA stderr log');
  logs.push(qaStdout, qaStderr);
  const qaResult = await runArgv(manifest.qa.argv, {
    cwd: project, stdoutPath: qaStdout, stderrPath: qaStderr,
    replacements: { '{artifact}': artifactPath, '{artifact-dir}': artifactPath, '{project-dir}': project, '{output-dir}': output }
  });
  const qaPassed = qaResult.status === 0 && !qaResult.error;
  const qaPath = resolveContained(output, PHASE_FILES.qa, 'QA result');
  await writeJson(qaPath, {
    schemaVersion: '1.0.0', type: 'qa-result', projectId: manifest.projectId, status: qaPassed ? 'pass' : 'fail', passed: qaPassed,
    executed: true, argv: qaResult.argv, exitStatus: qaResult.status, signal: qaResult.signal, error: qaResult.error,
    artifactPath: relative(project, artifactPath), artifactSha256: artifactHash,
    evidencePaths: [relativeOutput(output, qaStdout), relativeOutput(output, qaStderr), relativeOutput(output, buildPath)], completedAt: new Date().toISOString()
  });
  artifacts.push(qaPath);
  if (!qaPassed) {
    const failure = await writeFailureRun({ outputDir: output, runId, startedAt, manifest, sourceRevision: source, artifacts, logs, summary: 'QA failed against the built artifact.', buildPassed: true });
    return { status: 'fail', outputDir: output, runPath: failure.path, record: failure.record };
  }

  const qaHash = `sha256:${createHash('sha256').update(await readFile(qaPath)).digest('hex')}`;
  const candidatePath = resolveContained(output, PHASE_FILES.releaseCandidate, 'release candidate');
  await writeJson(candidatePath, {
    schemaVersion: '1.0.0', type: 'release-candidate', candidateId: `${manifest.projectId}-${runId}`,
    projectId: manifest.projectId, sourceRevision: source, build: { artifactPath: relative(project, artifactPath), outputSha256: artifactHash },
    qa: { resultPath: PHASE_FILES.qa, resultSha256: qaHash, status: 'pass' }, destination: { kind: 'local', target: localDestination }, dryRunOnly: true,
    createdAt: new Date().toISOString()
  });
  artifacts.push(candidatePath);

  const receiptPath = resolveContained(output, PHASE_FILES.publishing, 'publishing receipt');
  await writeJson(receiptPath, {
    schemaVersion: '1.0.0', type: 'publishing-receipt', projectId: manifest.projectId, releaseCandidatePath: PHASE_FILES.releaseCandidate,
    destination: { kind: 'local', target: localDestination }, dryRun: true, executed: false, provider: null, storeOperation: null, secretsUsed: false,
    plan: [`Would publish ${PHASE_FILES.releaseCandidate} to ${localDestination}`], createdAt: new Date().toISOString()
  });
  artifacts.push(receiptPath);

  const endedAt = new Date().toISOString();
  const record = createPipelineRun({ outputDir: output, runId, startedAt, endedAt, manifest, sourceRevision: source, artifacts, logs, status: 'pass', summary: 'Build, QA, release-candidate, and dry-run publishing plan completed.', nextAction: 'Review the local receipt; no store publication was performed.', buildPassed: true, qaPassed: true });
  const runPath = resolveContained(output, PHASE_FILES.run, 'pipeline-run record');
  await writeJson(runPath, record);
  return { status: 'pass', outputDir: output, runPath, record };
}

function requireExists(path) {
  // Used only while choosing a default manifest; synchronous access keeps the lookup simple.
  try { accessSync(path); return true; } catch { return false; }
}

function parseArgs(args) {
  const options = { entryIds: [] };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--dry-run') { options.dryRun = true; continue; }
    if (arg === '--help' || arg === '-h') { options.help = true; continue; }
    const match = arg.match(/^--([^=]+)(?:=(.*))?$/);
    if (!match) throw new PipelineError(`Unknown argument: ${arg}`, 'USAGE');
    const key = match[1];
    const value = match[2] ?? args[++index];
    if (!nonEmptyString(value)) throw new PipelineError(`--${key} requires a value`, 'USAGE');
    if (key === 'entry-id' || key === 'tool') options.entryIds.push(value);
    else if (key === 'project' || key === 'manifest' || key === 'output' || key === 'destination' || key === 'source-revision' || key === 'scaffold') options[key === 'source-revision' ? 'sourceRevision' : key] = value;
    else throw new PipelineError(`Unknown argument: --${key}`, 'USAGE');
  }
  return options;
}

function usage() {
  return `Usage:\n  node tools/run-pipeline.mjs --project <dir> --output <dir> --dry-run [--entry-id <id>]\n  node tools/run-pipeline.mjs --scaffold <new-dir>\n\nQA argv may use the exact tokens {artifact}, {artifact-dir}, {project-dir}, and {output-dir}.`;
}

export async function main(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  if (options.help) { console.log(usage()); return 0; }
  if (options.scaffold) {
    const target = await scaffoldSampleProject(options.scaffold);
    console.log(`Scaffolded sample project at ${target}`);
    return 0;
  }
  if (!options.dryRun) throw new PipelineError('Refusing to run: --dry-run is mandatory and no store publication is supported.', 'DRY_RUN_REQUIRED');
  if (!options.project || !options.output) throw new PipelineError('Both --project and --output are required.', 'USAGE');
  const result = await runPipeline({ projectDir: options.project, manifestPath: options.manifest, outputDir: options.output, requestedEntryIds: options.entryIds, destination: options.destination, sourceRevision: options.sourceRevision, dryRun: true });
  console.log(`Pipeline ${result.status}: ${result.runPath}`);
  return result.status === 'pass' ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === THIS_FILE) {
  main().then((code) => { process.exitCode = code; }).catch((error) => {
    console.error(`${error.code || 'ERROR'}: ${error.message}`);
    if (error.code === 'USAGE' || error.code === 'DRY_RUN_REQUIRED') console.error(usage());
    process.exitCode = 1;
  });
}
