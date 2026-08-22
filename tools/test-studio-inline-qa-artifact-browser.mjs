import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const baseURL = process.env.CONTROL_PLANE_URL || 'http://127.0.0.1:4173/apps/studio/';
const artifacts = process.env.BROWSER_ARTIFACTS || 'artifacts/control-plane-browser';
await mkdir(artifacts, { recursive: true });

const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;
const browser = await chromium.launch({ headless: true, channel: 'chrome' });

async function openStudioPage() {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrors = [];
  let latestGets = 0;
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  page.on('request', (request) => {
    const pathname = new URL(request.url()).pathname;
    if (request.method() === 'GET' && pathname === '/api/pipeline/runs/latest') latestGets += 1;
  });
  await page.route('**/favicon.ico', (route) => route.fulfill({ status: 204, body: '' }));
  const initialRecovery = page.waitForRequest((request) => request.method() === 'GET' && new URL(request.url()).pathname === '/api/pipeline/runs/latest');
  const response = await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  assert(response?.ok(), `Studio failed to load: HTTP ${response?.status()}`);
  await initialRecovery;
  await page.waitForFunction(() => document.querySelector('#name')?.textContent !== 'Loading…');
  await page.locator('[data-view="local-run"]').click();
  return { page, consoleErrors, latestGets: () => latestGets };
}

async function configureBrief(page, { name, objective, mechanic }) {
  await page.locator('#brief-name').fill(name);
  await page.locator('#brief-objective').fill(objective);
  await page.locator('#creator-advanced summary').click();
  await page.locator('#brief-target').selectOption('web');
  await page.locator('#brief-mechanic').selectOption(mechanic);
}

function artifactProof(result) {
  const buildHash = result?.evidence?.build?.artifactSha256;
  const qaHash = result?.evidence?.qa?.artifactSha256;
  const promotedHash = result?.evidence?.releaseCandidate?.build?.outputSha256;
  assert.match(buildHash || '', SHA256_PATTERN);
  assert.match(qaHash || '', SHA256_PATTERN);
  assert.match(promotedHash || '', SHA256_PATTERN);
  assert.equal(qaHash, buildHash, 'QA must prove the exact build artifact bytes');
  assert.equal(promotedHash, buildHash, 'release candidate must promote the exact QA-passed artifact bytes');
  return { buildHash, qaHash, promotedHash };
}

try {
  const first = await openStudioPage();
  const second = await openStudioPage();
  const pageA = first.page;
  const pageB = second.page;

  await configureBrief(pageA, {
    name: 'First Session',
    objective: 'Build a dodge starter whose evidence must stay bound to this first browser session.',
    mechanic: 'dodge'
  });
  await configureBrief(pageB, {
    name: 'Second Session',
    objective: 'Build a survival starter that deliberately replaces the server latest-run pointer.',
    mechanic: 'survive'
  });

  let releaseFirstResponse;
  const allowFirstResponse = new Promise((resolvePromise) => { releaseFirstResponse = resolvePromise; });
  let firstPayload;
  let signalFirstBackend;
  const firstBackendComplete = new Promise((resolvePromise) => { signalFirstBackend = resolvePromise; });

  await pageA.route('**/api/pipeline/brief-runs', async (route) => {
    const upstream = await route.fetch();
    const body = await upstream.text();
    firstPayload = JSON.parse(body);
    signalFirstBackend();
    await allowFirstResponse;
    await route.fulfill({ status: upstream.status(), headers: upstream.headers(), body });
  });

  const firstLatestBaseline = first.latestGets();
  await pageA.locator('#run-brief').click();
  await firstBackendComplete;
  assert(firstPayload, 'first session backend response was not captured');
  assert.equal(firstPayload.status, 'pass');
  assert.equal(firstPayload.brief?.projectId, 'brief-first-session');
  const firstProof = artifactProof(firstPayload);
  const firstRunId = firstPayload.evidence?.run?.runId;
  assert.equal(typeof firstRunId, 'string');
  assert(firstRunId.length > 0, 'first run identity was missing');

  await pageB.locator('#run-brief').click();
  await pageB.waitForFunction(() => document.querySelector('#run-message')?.textContent.includes('opened below'), null, { timeout: 30000 });
  await pageB.waitForFunction(() => document.querySelector('[data-inline-verification="true"]'), null, { timeout: 10000 });
  const latestResponse = await pageB.request.get(new URL('/api/pipeline/runs/latest', baseURL).href);
  assert.equal(latestResponse.ok(), true, `latest run HTTP ${latestResponse.status()}`);
  const latestEnvelope = await latestResponse.json();
  assert.equal(latestEnvelope.available, true);
  assert.equal(latestEnvelope.run?.brief?.projectId, 'brief-second-session');
  const secondProof = artifactProof(latestEnvelope.run);
  const secondRunId = latestEnvelope.run?.evidence?.run?.runId;
  assert.equal(typeof secondRunId, 'string');
  assert.notEqual(secondRunId, firstRunId, 'serialized Studio sessions did not produce distinct run identities');
  assert.notEqual(secondProof.buildHash, firstProof.buildHash, 'interleaving regression needs distinct artifact bytes');

  const secondSummary = await pageB.locator('[data-inline-verification="true"]').textContent();
  assert(secondSummary.includes(secondProof.buildHash), 'second session did not display its own artifact identity');
  assert.match(secondSummary, /Publication: not executed/);
  assert.match(secondSummary, /Secrets: not used/);

  // Only after run B has replaced the server-global latest pointer do we allow
  // run A's HTTP response to reach its page and trigger inline verification.
  releaseFirstResponse();
  await pageA.waitForFunction(() => document.querySelector('#run-message')?.textContent.includes('opened below'), null, { timeout: 30000 });
  const expectedFirstProof = `QA artifact proof: build ${firstProof.buildHash} · QA ${firstProof.qaHash} · promoted ${firstProof.promotedHash} · same verified bytes`;
  await pageA.waitForFunction(
    (expected) => document.querySelector('[data-inline-verification="true"]')?.textContent?.includes(expected),
    expectedFirstProof,
    { timeout: 10000 }
  );
  const firstSummary = await pageA.locator('[data-inline-verification="true"]').textContent();
  const firstEvidence = await pageA.locator('#run-evidence').textContent();
  assert(firstSummary.includes(expectedFirstProof), 'first session proof was not bound to its own response');
  assert(firstSummary.includes(`Verified artifact: ${firstProof.buildHash}`), 'first session verified artifact was not visible');
  assert(!firstSummary.includes(secondProof.buildHash), 'first session proof leaked the mutable latest run artifact');
  assert.match(firstEvidence, /First Session/);
  assert.match(firstEvidence, /Project: brief-first-session/);
  assert.doesNotMatch(firstEvidence, /Second Session/);
  assert.doesNotMatch(firstEvidence, /brief-second-session/);
  assert.equal(first.latestGets(), firstLatestBaseline, 'fresh-run verification consulted the mutable latest-run endpoint');
  assert.match(firstSummary, /Publication: not executed/);
  assert.match(firstSummary, /Secrets: not used/);
  assert.deepEqual(first.consoleErrors, []);
  assert.deepEqual(second.consoleErrors, []);

  await pageA.screenshot({ path: resolve(artifacts, 'studio-inline-qa-artifact-proof.png'), fullPage: true });
  const cleanup = await pageB.request.delete(new URL('/api/pipeline/runs/latest', baseURL).href);
  assert.equal(cleanup.ok(), true, `session-binding dogfood cleanup HTTP ${cleanup.status()}`);
  assert.deepEqual(await cleanup.json(), { reset: true });
  console.log(`Studio inline QA artifact browser dogfood passed with serialized session binding: ${JSON.stringify({ firstRunId, secondRunId, firstBuildHash: firstProof.buildHash, secondBuildHash: secondProof.buildHash, firstLatestGets: first.latestGets(), secondLatestGets: second.latestGets(), publicationExecuted: firstPayload.safety?.publicationExecuted, secretsUsed: firstPayload.safety?.secretsUsed, cleanupReset: true })}`);
  await pageA.close();
  await pageB.close();
} finally {
  await browser.close();
}
