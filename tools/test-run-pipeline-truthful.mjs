import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { normalizeUnmeasuredTelemetry } from './run-pipeline-truthful.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const wrapper = join(repo, 'tools', 'run-pipeline-truthful.mjs');
const validator = join(repo, 'tools', 'validate-record.mjs');

function json(path) {
  return readFile(path, 'utf8').then(JSON.parse);
}

function assertUnknownTelemetry(record) {
  for (const field of ['toolCalls', 'failedToolCalls', 'humanInterventions', 'humanMinutes', 'iterations', 'bespokeLinesChanged']) {
    assert.equal(record.execution[field], null, `${field} must remain unknown until actually measured`);
  }
}

test('normalizer replaces fabricated counters but preserves measured fields', () => {
  const original = {
    execution: {
      toolCalls: 0,
      failedToolCalls: 1,
      humanInterventions: 0,
      humanMinutes: 0,
      iterations: 1,
      bespokeLinesChanged: 0,
      elapsedSeconds: 4.25,
      externalServiceCostUsd: 0,
      models: [],
      reusedComponents: []
    }
  };
  const normalized = normalizeUnmeasuredTelemetry(original);
  assertUnknownTelemetry(normalized);
  assert.equal(normalized.execution.elapsedSeconds, 4.25);
  assert.equal(normalized.execution.externalServiceCostUsd, 0);
  assert.equal(original.execution.toolCalls, 0, 'normalizer must not mutate the source object');
});

test('happy-path wrapper emits schema-valid truthful telemetry', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pipeline-truthful-'));
  const output = join(root, 'run');
  try {
    const run = spawnSync(process.execPath, [wrapper, '--project', 'examples/sample-game', '--output', output, '--dry-run'], {
      cwd: repo,
      encoding: 'utf8'
    });
    assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
    const record = await json(join(output, 'pipeline-run.json'));
    assert.equal(record.outcome.status, 'pass');
    assert.equal(record.evidence.executionVerified, true);
    assertUnknownTelemetry(record);

    const validation = spawnSync(process.execPath, [validator, 'pipeline-run', join(output, 'pipeline-run.json')], {
      cwd: repo,
      encoding: 'utf8'
    });
    assert.equal(validation.status, 0, `${validation.stdout}\n${validation.stderr}`);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('failed child run is normalized too and still fails closed', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pipeline-truthful-fail-'));
  const output = join(root, 'run');
  try {
    const run = spawnSync(process.execPath, [wrapper, '--project', 'examples/sample-game', '--output', output, '--dry-run', '--entry-id', 'missing.registry.entry'], {
      cwd: repo,
      encoding: 'utf8'
    });
    assert.notEqual(run.status, 0);
    const record = await json(join(output, 'pipeline-run.json'));
    assert.equal(record.outcome.status, 'fail');
    assertUnknownTelemetry(record);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('wrapper refuses ambiguous default output so it cannot normalize the wrong run', () => {
  const run = spawnSync(process.execPath, [wrapper, '--project', 'examples/sample-game', '--dry-run'], {
    cwd: repo,
    encoding: 'utf8'
  });
  assert.equal(run.status, 2);
  assert.match(`${run.stdout}\n${run.stderr}`, /explicit --output/i);
});
