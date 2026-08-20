import assert from 'node:assert/strict';
import { test } from 'node:test';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { request } from 'node:http';
import { resolve } from 'node:path';
import { createStudioServer, disposeSampleRun, executeSampleRun } from './studio-server.mjs';

async function withServer(options, callback) {
  const server = createStudioServer(options);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  try { return await callback(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value)}\n`, 'utf8');
}

async function failureRun(stage) {
  let removedOutput;
  const result = await executeSampleRun({
    scaffold: (projectDir) => mkdir(projectDir, { recursive: true }),
    run: async ({ outputDir }) => {
      removedOutput = outputDir;
      await mkdir(outputDir, { recursive: true });
      await writeJson(resolve(outputDir, 'intake.json'), { validation: { status: 'pass' } });
      await writeJson(resolve(outputDir, 'registry-selection.json'), { entries: [{}] });
      await writeJson(resolve(outputDir, 'build-result.json'), { executed: true, status: stage === 'build' ? 'fail' : 'pass' });
      await writeJson(resolve(outputDir, 'qa-result.json'), { executed: stage === 'qa', status: 'fail' });
      return { status: 'fail', record: { summary: `${stage} failed` } };
    }
  });
  await assert.rejects(access(removedOutput), { code: 'ENOENT' });
  return result;
}

async function chunkedPost(url) {
  const target = new URL(url);
  return new Promise((resolvePromise, reject) => {
    const outgoing = request({ hostname: target.hostname, port: target.port, path: target.pathname, method: 'POST', headers: { 'transfer-encoding': 'chunked' } }, (response) => {
      response.resume();
      response.once('end', () => resolvePromise(response.statusCode));
    });
    outgoing.once('error', reject);
    outgoing.write('unsafe-body');
    outgoing.end();
  });
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
  try {
    assert.equal(result.status, 'pass');
    assert.equal(result.evidence.intake.validation.status, 'pass');
    assert.equal(result.evidence.registry.entries.length > 0, true);
    assert.equal(result.evidence.build.executed, true);
    assert.equal(result.evidence.build.status, 'pass');
    assert.equal(result.evidence.qa.executed, true);
    assert.equal(result.evidence.qa.status, 'pass');
    assert.equal(result.evidence.releaseCandidate.dryRunOnly, true);
    assert.deepEqual(result.playable, { launchUrl: '/play/sample/', artifactSha256: result.evidence.build.artifactSha256 });
    assert.deepEqual(result.safety, {
      dryRun: true,
      publicationExecuted: false,
      secretsUsed: false,
      destination: { kind: 'local', target: 'local://planned/sample-game' }
    });
  } finally { await disposeSampleRun(result); }
});

test('a passing run exposes its exact playable artifact only through the local play route', async () => {
  await withServer({}, async (base) => {
    assert.equal((await fetch(`${base}/play/sample/`)).status, 404);
    const run = await fetch(`${base}/api/pipeline/runs`, { method: 'POST' });
    assert.equal(run.status, 201);
    const result = await run.json();
    assert.equal(result.playable.launchUrl, '/play/sample/');
    const playable = await fetch(`${base}${result.playable.launchUrl}`);
    assert.equal(playable.status, 200);
    assert.match(await playable.text(), /<canvas id="game">/);
    assert.equal((await fetch(`${base}/play/sample/../../../../etc/passwd`)).status, 404);
  });
});

test('expected build and QA failures preserve partial evidence and clean workspaces', async () => {
  const build = await failureRun('build');
  assert.equal(build.status, 'fail');
  assert.equal(build.evidence.build.status, 'fail');
  assert.equal(build.evidence.releaseCandidate, undefined);
  const qa = await failureRun('qa');
  assert.equal(qa.status, 'fail');
  assert.equal(qa.evidence.build.status, 'pass');
  assert.equal(qa.evidence.qa.status, 'fail');
  assert.equal(qa.evidence.publishing, undefined);
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
    assert.equal(await chunkedPost(`${base}/api/pipeline/runs`), 400);
  });
});

test('failed execution returns partial evidence as a non-success response', async () => {
  await withServer({ execute: () => failureRun('qa') }, async (base) => {
    const response = await fetch(`${base}/api/pipeline/runs`, { method: 'POST' });
    assert.equal(response.status, 422);
    const result = await response.json();
    assert.equal(result.status, 'fail');
    assert.equal(result.evidence.build.status, 'pass');
    assert.equal(result.evidence.qa.status, 'fail');
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
