import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createStudioServer, executeSampleRun } from './studio-server.mjs';

async function withServer(options, callback) {
  const server = createStudioServer(options);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  try { return await callback(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

test('capabilities disclose the fail-closed publishing boundary', async () => {
  await withServer({}, async (base) => {
    const response = await fetch(`${base}/api/pipeline/capabilities`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { mode: 'local-sample', dryRunOnly: true, secretsRequired: false, publicationSupported: false });
  });
});

test('sample run scaffolds, builds, verifies, and emits a non-publishing receipt', async () => {
  const result = await executeSampleRun();
  assert.equal(result.status, 'pass');
  assert.equal(result.evidence.intake.validation.status, 'pass');
  assert.equal(result.evidence.registry.entries.length > 0, true);
  assert.equal(result.evidence.build.executed, true);
  assert.equal(result.evidence.build.status, 'pass');
  assert.equal(result.evidence.qa.executed, true);
  assert.equal(result.evidence.qa.status, 'pass');
  assert.equal(result.evidence.releaseCandidate.dryRunOnly, true);
  assert.deepEqual(result.safety, {
    dryRun: true,
    publicationExecuted: false,
    secretsUsed: false,
    destination: { kind: 'local', target: 'local://planned/sample-game' }
  });
});

test('run endpoint rejects other methods and concurrent execution', async () => {
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  await withServer({ execute: () => pending }, async (base) => {
    assert.equal((await fetch(`${base}/api/pipeline/runs`)).status, 405);
    const first = fetch(`${base}/api/pipeline/runs`, { method: 'POST' });
    await new Promise((resolve) => setTimeout(resolve, 20));
    const second = await fetch(`${base}/api/pipeline/runs`, { method: 'POST' });
    assert.equal(second.status, 409);
    release({ status: 'pass' });
    assert.equal((await first).status, 201);
  });
});

test('run endpoint rejects cross-origin and parameterized requests', async () => {
  await withServer({ execute: async () => ({ status: 'pass' }) }, async (base) => {
    const crossOrigin = await fetch(`${base}/api/pipeline/runs`, { method: 'POST', headers: { origin: 'https://example.com' } });
    assert.equal(crossOrigin.status, 403);
    const body = await fetch(`${base}/api/pipeline/runs`, { method: 'POST', body: JSON.stringify({ project: '/tmp/other' }) });
    assert.equal(body.status, 400);
    const port = new URL(base).port;
    const spoofed = await fetch(`${base}/api/pipeline/runs`, { method: 'POST', headers: { host: `evil.test:${port}`, origin: `http://evil.test:${port}` } });
    assert.equal(spoofed.status, 403);
  });
});

test('static serving does not escape the repository root', async () => {
  await withServer({}, async (base) => {
    assert.equal((await fetch(`${base}/apps/studio/`)).status, 200);
    assert.equal((await fetch(`${base}/../../../../etc/passwd`)).status, 404);
    assert.equal((await fetch(`${base}/package.json`)).status, 404);
    assert.equal((await fetch(`${base}/tools/run-pipeline.mjs`)).status, 404);
    assert.equal((await fetch(`${base}/api/pipeline/runs`, { method: 'PUT' })).status, 405);
  });
});
