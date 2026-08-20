import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { runPipeline, selectRegistryEntries } from './run-pipeline.mjs';

const repo = resolve(fileURLToPath(new URL('..', import.meta.url)));
const runner = join(repo, 'tools', 'run-pipeline.mjs');

function assertPipelineRunShape(record) {
  assert.equal(record.schemaVersion, '1.0.0');
  assert.match(record.runId, /^run-/);
  assert.ok(Number.isFinite(Date.parse(record.startedAt)));
  assert.ok(Number.isFinite(Date.parse(record.endedAt)));
  assert.equal(record.scope.taskType, 'prototype');
  assert.equal(typeof record.inputs.sourceCommit, 'string');
  assert.ok(record.execution && Array.isArray(record.execution.models));
  assert.equal(typeof record.evidence.executionVerified, 'boolean');
  assert.ok(Array.isArray(record.evidence.artifacts));
  assert.equal(record.outcome.status, 'pass');
}

function assertUnknownTelemetry(record) {
  for (const field of ['toolCalls', 'failedToolCalls', 'humanInterventions', 'humanMinutes', 'iterations', 'bespokeLinesChanged']) {
    assert.equal(record.execution[field], null, `${field} must remain unknown until measured`);
  }
}

function sha256(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

async function makeProject({ buildCode, qaCode, entryIds = ['system.gdevelop'] }) {
  const root = await mkdtemp(join(tmpdir(), 'pipeline-project-'));
  await writeFile(join(root, 'project.manifest.json'), JSON.stringify({
    manifestVersion: '1.0.0', projectId: 'test-game', name: 'Test Game',
    registry: { entryIds }, build: { argv: [process.execPath, 'build.mjs'], artifact: 'dist' },
    qa: { argv: [process.execPath, 'qa.mjs', '{artifact}'] },
    publish: { provider: 'local', destination: 'local://planned/test-game' }
  }));
  await writeFile(join(root, 'build.mjs'), buildCode);
  await writeFile(join(root, 'qa.mjs'), qaCode);
  return root;
}

async function json(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

test('happy path writes all phases and a schema-valid pipeline run', async () => {
  const project = await makeProject({
    buildCode: "import { mkdir, writeFile } from 'node:fs/promises'; await mkdir('dist', { recursive: true }); await writeFile('dist/game.txt', 'ok\\n');",
    qaCode: "import { readFile } from 'node:fs/promises'; if ((await readFile(process.argv[2] + '/game.txt', 'utf8')) !== 'ok\\n') process.exit(2);"
  });
  const output = join(await mkdtemp(join(tmpdir(), 'pipeline-output-')), 'run');
  try {
    const result = await runPipeline({ projectDir: project, outputDir: output, dryRun: true });
    assert.equal(result.status, 'pass');
    for (const file of ['intake.json', 'registry-selection.json', 'build-result.json', 'qa-result.json', 'release-candidate.json', 'publishing-receipt.json', 'pipeline-run.json']) {
      await readFile(join(output, file));
    }
    const record = await json(join(output, 'pipeline-run.json'));
    const receipt = await json(join(output, 'publishing-receipt.json'));
    const candidate = await json(join(output, 'release-candidate.json'));
    assert.equal(candidate.starter.mechanic, null);
    assert.equal(record.outcome.status, 'pass');
    assert.equal(record.evidence.executionVerified, true);
    assertUnknownTelemetry(record);
    assert.equal(receipt.dryRun, true);
    assert.equal(receipt.executed, false);
    assert.equal(receipt.secretsUsed, false);
    assert.match(candidate.sourceTreeSha256, /^sha256:[a-f0-9]{64}$/);
    assert.deepEqual(candidate.intake, {
      resultPath: 'intake.json',
      resultSha256: sha256(await readFile(join(output, 'intake.json'))),
      manifestSha256: (await json(join(output, 'intake.json'))).manifestSha256
    });
    assert.deepEqual(candidate.registrySelection, {
      resultPath: 'registry-selection.json',
      resultSha256: sha256(await readFile(join(output, 'registry-selection.json'))),
      registryRevision: (await json(join(output, 'registry-selection.json'))).registryRevision
    });
    assertPipelineRunShape(record);
  } finally { await rm(project, { recursive: true, force: true }); await rm(resolve(output, '..'), { recursive: true, force: true }); }
});

test('build failure fails closed and does not execute QA', async () => {
  const project = await makeProject({
    buildCode: "console.error('build failed'); process.exit(7);",
    qaCode: "import { writeFile } from 'node:fs/promises'; await writeFile('qa-ran', 'bad');"
  });
  const output = join(await mkdtemp(join(tmpdir(), 'pipeline-output-')), 'run');
  try {
    const result = await runPipeline({ projectDir: project, outputDir: output, dryRun: true });
    assert.equal(result.status, 'fail');
    assert.equal((await json(join(output, 'build-result.json'))).status, 'fail');
    assert.equal((await json(join(output, 'qa-result.json'))).executed, false);
    assertUnknownTelemetry(await json(join(output, 'pipeline-run.json')));
    await assert.rejects(readFile(join(project, 'qa-ran')));
  } finally { await rm(project, { recursive: true, force: true }); await rm(resolve(output, '..'), { recursive: true, force: true }); }
});

test('missing build executable is recorded as not executed', async () => {
  const project = await makeProject({
    buildCode: "throw new Error('must not run');",
    qaCode: "throw new Error('must not run');"
  });
  const outputRoot = await mkdtemp(join(tmpdir(), 'pipeline-output-'));
  const output = join(outputRoot, 'run');
  try {
    const manifestPath = join(project, 'project.manifest.json');
    const manifest = await json(manifestPath);
    manifest.build.argv = [join(project, 'missing-build-command')];
    await writeFile(manifestPath, JSON.stringify(manifest));
    const result = await runPipeline({ projectDir: project, outputDir: output, dryRun: true });
    assert.equal(result.status, 'fail');
    const build = await json(join(output, 'build-result.json'));
    assert.equal(build.executed, false);
    assert.equal(build.exitStatus, null);
    assert.match(build.error, /ENOENT|not found/i);
    assert.equal((await json(join(output, 'qa-result.json'))).executed, false);
  } finally { await rm(project, { recursive: true, force: true }); await rm(outputRoot, { recursive: true, force: true }); }
});

test('missing QA executable is recorded as not executed', async () => {
  const project = await makeProject({
    buildCode: "import { mkdir, writeFile } from 'node:fs/promises'; await mkdir('dist', { recursive: true }); await writeFile('dist/game.txt', 'ok');",
    qaCode: "throw new Error('must not run');"
  });
  const outputRoot = await mkdtemp(join(tmpdir(), 'pipeline-output-'));
  const output = join(outputRoot, 'run');
  try {
    const manifestPath = join(project, 'project.manifest.json');
    const manifest = await json(manifestPath);
    manifest.qa.argv = [join(project, 'missing-qa-command')];
    await writeFile(manifestPath, JSON.stringify(manifest));
    const result = await runPipeline({ projectDir: project, outputDir: output, dryRun: true });
    assert.equal(result.status, 'fail');
    assert.equal((await json(join(output, 'build-result.json'))).executed, true);
    const qa = await json(join(output, 'qa-result.json'));
    assert.equal(qa.executed, false);
    assert.equal(qa.exitStatus, null);
    assert.match(qa.error, /ENOENT|not found/i);
  } finally { await rm(project, { recursive: true, force: true }); await rm(outputRoot, { recursive: true, force: true }); }
});

test('non-Git source identity changes when project source changes', async () => {
  const first = await makeProject({
    buildCode: "import { mkdir, writeFile } from 'node:fs/promises'; await mkdir('dist', { recursive: true }); await writeFile('dist/game.txt', 'same'); // source-a",
    qaCode: "process.exit(0);"
  });
  const second = await makeProject({
    buildCode: "import { mkdir, writeFile } from 'node:fs/promises'; await mkdir('dist', { recursive: true }); await writeFile('dist/game.txt', 'same'); // source-b",
    qaCode: "process.exit(0);"
  });
  const outputRoot = await mkdtemp(join(tmpdir(), 'pipeline-output-'));
  const firstOutput = join(outputRoot, 'first');
  const secondOutput = join(outputRoot, 'second');
  try {
    await runPipeline({ projectDir: first, outputDir: firstOutput, dryRun: true });
    await runPipeline({ projectDir: second, outputDir: secondOutput, dryRun: true });
    const firstCandidate = await json(join(firstOutput, 'release-candidate.json'));
    const secondCandidate = await json(join(secondOutput, 'release-candidate.json'));
    assert.equal(firstCandidate.sourceRevision, firstCandidate.sourceTreeSha256);
    assert.equal(secondCandidate.sourceRevision, secondCandidate.sourceTreeSha256);
    assert.notEqual(firstCandidate.sourceRevision, secondCandidate.sourceRevision);
    assert.notEqual(firstCandidate.sourceTreeSha256, secondCandidate.sourceTreeSha256);
  } finally {
    await rm(first, { recursive: true, force: true });
    await rm(second, { recursive: true, force: true });
    await rm(outputRoot, { recursive: true, force: true });
  }
});

test('QA failure fails closed after building the artifact', async () => {
  const project = await makeProject({
    buildCode: "import { mkdir, writeFile } from 'node:fs/promises'; await mkdir('dist', { recursive: true }); await writeFile('dist/game.txt', 'ok');",
    qaCode: "console.error('qa failed'); process.exit(9);"
  });
  const output = join(await mkdtemp(join(tmpdir(), 'pipeline-output-')), 'run');
  try {
    const result = await runPipeline({ projectDir: project, outputDir: output, dryRun: true });
    assert.equal(result.status, 'fail');
    const qa = await json(join(output, 'qa-result.json'));
    assert.equal(qa.status, 'fail');
    assert.equal(qa.executed, true);
    await assert.rejects(readFile(join(output, 'release-candidate.json')));
  } finally { await rm(project, { recursive: true, force: true }); await rm(resolve(output, '..'), { recursive: true, force: true }); }
});

test('registry selection preserves source evidence status and never upgrades it', async () => {
  const selected = await selectRegistryEntries(['system.rosebud', 'system.gdevelop']);
  assert.deepEqual(selected.entries.map((entry) => [entry.entry_id, entry.execution_status]), [
    ['system.rosebud', 'VENDOR-CLAIM'], ['system.gdevelop', 'SOURCE-VERIFIED']
  ]);
});

test('CLI refuses to run without --dry-run', async () => {
  const outputRoot = await mkdtemp(join(tmpdir(), 'pipeline-no-dry-run-'));
  const output = join(outputRoot, 'run');
  try {
    const result = spawnSync(process.execPath, [runner, '--project', join(repo, 'examples/sample-game'), '--output', output], { cwd: repo, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /dry-run/i);
    await assert.rejects(readFile(join(output, 'pipeline-run.json')));
  } finally { await rm(outputRoot, { recursive: true, force: true }); }
});

test('reruns refuse to mix evidence in a non-empty output directory', async () => {
  const project = await makeProject({
    buildCode: "import { mkdir, writeFile } from 'node:fs/promises'; await mkdir('dist', { recursive: true }); await writeFile('dist/game.txt', 'ok');",
    qaCode: "process.exit(0);"
  });
  const outputRoot = await mkdtemp(join(tmpdir(), 'pipeline-output-'));
  const output = join(outputRoot, 'run');
  try {
    await runPipeline({ projectDir: project, outputDir: output, dryRun: true });
    await assert.rejects(() => runPipeline({ projectDir: project, outputDir: output, dryRun: true }), { code: 'OUTPUT_NOT_EMPTY' });
  } finally { await rm(project, { recursive: true, force: true }); await rm(outputRoot, { recursive: true, force: true }); }
});

test('project root cannot be declared as the build artifact', async () => {
  const project = await makeProject({ buildCode: "process.exit(0);", qaCode: "process.exit(0);" });
  const outputRoot = await mkdtemp(join(tmpdir(), 'pipeline-output-'));
  const output = join(outputRoot, 'run');
  try {
    const manifestPath = join(project, 'project.manifest.json');
    const manifest = await json(manifestPath);
    manifest.build.artifact = '.';
    await writeFile(manifestPath, JSON.stringify(manifest));
    await assert.rejects(() => runPipeline({ projectDir: project, outputDir: output, dryRun: true }), { code: 'PATH_CONTAINMENT' });
  } finally { await rm(project, { recursive: true, force: true }); await rm(outputRoot, { recursive: true, force: true }); }
});

test('build timeout fails closed and records the timeout', async () => {
  const project = await makeProject({
    buildCode: "await new Promise((resolve) => setTimeout(resolve, 100000));",
    qaCode: "process.exit(0);"
  });
  await writeFile(join(project, 'project.manifest.json'), JSON.stringify({
    manifestVersion: '1.0.0', projectId: 'timeout-game', name: 'Timeout Game',
    registry: { entryIds: ['system.gdevelop'] }, build: { argv: [process.execPath, 'build.mjs'], artifact: 'dist', timeoutMs: 100 },
    qa: { argv: [process.execPath, 'qa.mjs', '{artifact}'] }, publish: { provider: 'local' }
  }));
  const outputRoot = await mkdtemp(join(tmpdir(), 'pipeline-output-'));
  const output = join(outputRoot, 'run');
  try {
    const result = await runPipeline({ projectDir: project, outputDir: output, dryRun: true });
    assert.equal(result.status, 'fail');
    const build = await json(join(output, 'build-result.json'));
    assert.equal(build.timedOut, true);
    assert.match(build.error, /timed out/i);
  } finally { await rm(project, { recursive: true, force: true }); await rm(outputRoot, { recursive: true, force: true }); }
});
