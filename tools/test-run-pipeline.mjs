import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { runPipeline, selectRegistryEntries } from './run-pipeline.mjs';

const repo = resolve(new URL('..', import.meta.url).pathname);
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
    assert.equal(record.outcome.status, 'pass');
    assert.equal(record.evidence.executionVerified, true);
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
    await assert.rejects(readFile(join(project, 'qa-ran')));
  } finally { await rm(project, { recursive: true, force: true }); await rm(resolve(output, '..'), { recursive: true, force: true }); }
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
