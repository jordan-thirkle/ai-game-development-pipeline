import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const telemetryFields = [
  'toolCalls',
  'failedToolCalls',
  'humanInterventions',
  'iterations',
  'bespokeLinesChanged'
];

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

test('pipeline-run scaffold preserves unmeasured counters as unknown', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pipeline-run-scaffold-'));
  const outputPath = join(directory, 'run.json');

  try {
    const result = spawnSync(process.execPath, ['tools/new-record.mjs', 'pipeline-run', outputPath, 'truthfulness-probe'], {
      cwd: process.cwd(),
      encoding: 'utf8'
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const record = await readJson(outputPath);

    for (const field of telemetryFields) {
      assert.equal(record.execution[field], null, `${field} must remain unknown until measured`);
    }
    assert.equal(record.evidence.executionVerified, false);
    assert.equal(record.outcome.status, 'blocked');
    assert.match(record.outcome.summary, /telemetry have not been collected/i);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('pipeline-run schema distinguishes unknown from a measured zero', async () => {
  const schema = await readJson('schemas/pipeline-run.schema.json');
  const execution = schema.properties.execution.properties;

  for (const field of telemetryFields) {
    assert.deepEqual(execution[field].type, ['integer', 'null'], `${field} must accept measured integers and unknown null`);
    assert.equal(execution[field].minimum, 0, `${field} must still reject negative measurements`);
  }
});
