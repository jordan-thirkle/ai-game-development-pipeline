import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createStudioServer, executeSampleRun } from './studio-server.mjs';
import { BriefError, normalizeStudioBrief } from './studio-brief.mjs';

async function withServer(callback) {
  const server = createStudioServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  try { return await callback(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

const goodBrief = {
  name: 'Harbour Run',
  objective: 'Build a small web-first arcade starter with a clear local verification trail.',
  targetPlatform: 'web'
};

test('normalizes the bounded brief without exposing build or publishing controls', () => {
  assert.deepEqual(normalizeStudioBrief(goodBrief), { ...goodBrief, projectId: 'brief-harbour-run' });
  for (const bad of [
    { ...goodBrief, command: 'rm -rf /' },
    { ...goodBrief, targetPlatform: 'store' },
    { ...goodBrief, name: '' },
    { ...goodBrief, objective: 'x'.repeat(501) },
    { ...goodBrief, objective: 'bad\u0000value' }
  ]) assert.throws(() => normalizeStudioBrief(bad), BriefError);
});

test('briefed sample executes the real build and QA while publication stays local and false', async () => {
  const result = await executeSampleRun({ brief: goodBrief });
  assert.equal(result.status, 'pass');
  assert.deepEqual(result.brief, { ...goodBrief, projectId: 'brief-harbour-run' });
  assert.equal(result.evidence.intake.name, goodBrief.name);
  assert.equal(result.evidence.run.scope.objective, goodBrief.objective);
  assert.deepEqual(result.evidence.run.scope.targetPlatforms, ['web']);
  assert.equal(result.evidence.registry.entries.length > 0, true);
  assert.equal(result.evidence.build.executed, true);
  assert.equal(result.evidence.build.status, 'pass');
  assert.equal(result.evidence.qa.executed, true);
  assert.equal(result.evidence.qa.status, 'pass');
  assert.equal(result.evidence.releaseCandidate.dryRunOnly, true);
  assert.equal(Buffer.isBuffer(result.bundle.bytes), true);
  assert.equal(result.bundle.bytes[0], 0x1f);
  assert.equal(result.bundle.bytes[1], 0x8b);
  assert.equal(result.bundle.filename, 'brief-harbour-run-verified-local-starter.tar.gz');
  assert.match(result.bundle.sha256, /^sha256:[a-f0-9]{64}$/);
  assert.deepEqual(result.safety, {
    dryRun: true,
    publicationExecuted: false,
    secretsUsed: false,
    destination: { kind: 'local', target: 'local://planned/brief-harbour-run' }
  });
});

test('brief endpoint returns a same-origin download with revision-bearing evidence', async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/api/pipeline/brief-runs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(goodBrief)
    });
    assert.equal(response.status, 201);
    const result = await response.json();
    assert.equal(result.brief.projectId, 'brief-harbour-run');
    assert.match(result.evidence.intake.sourceRevision, /^(sha256:)?[a-f0-9]{40,64}$/);
    assert.equal(result.evidence.publishing.executed, false);
    assert.equal(result.evidence.publishing.secretsUsed, false);
    assert.match(result.download.url, /^\/api\/pipeline\/downloads\/[0-9a-f-]+$/i);
    assert.equal(result.download.filename, 'brief-harbour-run-verified-local-starter.tar.gz');
    assert.match(result.download.sha256, /^sha256:[a-f0-9]{64}$/);

    const download = await fetch(`${base}${result.download.url}`);
    assert.equal(download.status, 200);
    assert.equal(download.headers.get('content-type'), 'application/gzip');
    assert.match(download.headers.get('content-disposition'), /attachment; filename="brief-harbour-run-verified-local-starter\.tar\.gz"/);
    assert.equal(download.headers.get('x-byjtt-bundle-sha256'), result.download.sha256);
    const bytes = Buffer.from(await download.arrayBuffer());
    assert.equal(bytes.length, result.download.sizeBytes);
    assert.equal(bytes[0], 0x1f);
    assert.equal(bytes[1], 0x8b);

    const crossOrigin = await fetch(`${base}${result.download.url}`, { headers: { origin: 'https://example.com' } });
    assert.equal(crossOrigin.status, 403);
  });
});

test('a newer successful run invalidates the previous in-memory download token', async () => {
  await withServer(async (base) => {
    const firstResponse = await fetch(`${base}/api/pipeline/brief-runs`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(goodBrief)
    });
    assert.equal(firstResponse.status, 201);
    const first = await firstResponse.json();

    const secondResponse = await fetch(`${base}/api/pipeline/brief-runs`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...goodBrief, name: 'Second Starter' })
    });
    assert.equal(secondResponse.status, 201);
    const second = await secondResponse.json();
    assert.notEqual(first.download.url, second.download.url);
    assert.equal((await fetch(`${base}${first.download.url}`)).status, 404);
    assert.equal((await fetch(`${base}${second.download.url}`)).status, 200);
  });
});

test('brief endpoint fails closed on hostile shape, origin, media type, and oversize input', async () => {
  await withServer(async (base) => {
    const hostile = await fetch(`${base}/api/pipeline/brief-runs`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...goodBrief, destination: 'https://store.example/upload' })
    });
    assert.equal(hostile.status, 400);

    const crossOrigin = await fetch(`${base}/api/pipeline/brief-runs`, {
      method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://example.com' }, body: JSON.stringify(goodBrief)
    });
    assert.equal(crossOrigin.status, 403);

    const wrongType = await fetch(`${base}/api/pipeline/brief-runs`, {
      method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify(goodBrief)
    });
    assert.equal(wrongType.status, 400);

    const oversize = await fetch(`${base}/api/pipeline/brief-runs`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...goodBrief, objective: 'x'.repeat(5000) })
    });
    assert.equal(oversize.status, 400);
  });
});
