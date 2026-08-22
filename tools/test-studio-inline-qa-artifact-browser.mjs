import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const baseURL = process.env.CONTROL_PLANE_URL || 'http://127.0.0.1:4173/apps/studio/';
const artifacts = process.env.BROWSER_ARTIFACTS || 'artifacts/control-plane-browser';
await mkdir(artifacts, { recursive: true });

const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrors = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  await page.route('**/favicon.ico', (route) => route.fulfill({ status: 204, body: '' }));

  const response = await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  assert(response?.ok(), `Studio failed to load: HTTP ${response?.status()}`);
  await page.waitForFunction(() => document.querySelector('#name')?.textContent !== 'Loading…');
  await page.locator('[data-view="local-run"]').click();
  await page.locator('#run-sample').click();
  await page.waitForFunction(() => document.querySelector('#run-message')?.textContent.includes('Release candidate ready'), null, { timeout: 30000 });

  const envelope = await page.evaluate(async () => {
    const latest = await fetch('/api/pipeline/runs/latest', { headers: { accept: 'application/json' }, cache: 'no-store' });
    if (!latest.ok) throw new Error(`latest-run fetch failed: ${latest.status}`);
    return latest.json();
  });
  assert.equal(envelope.available, true);
  const buildHash = envelope.run?.evidence?.build?.artifactSha256;
  const qaHash = envelope.run?.evidence?.qa?.artifactSha256;
  const promotedHash = envelope.run?.evidence?.releaseCandidate?.build?.outputSha256;
  assert.match(buildHash || '', SHA256_PATTERN);
  assert.match(qaHash || '', SHA256_PATTERN);
  assert.match(promotedHash || '', SHA256_PATTERN);
  assert.equal(qaHash, buildHash, 'QA must prove the exact build artifact bytes');
  assert.equal(promotedHash, buildHash, 'release candidate must promote the exact QA-passed artifact bytes');

  const expectedProof = `QA artifact proof: build ${buildHash} · QA ${qaHash} · promoted ${promotedHash} · same verified bytes`;
  await page.waitForFunction(
    (expected) => document.querySelector('[data-inline-verification="true"]')?.textContent?.includes(expected),
    expectedProof,
    { timeout: 10000 }
  );
  const summary = await page.locator('[data-inline-verification="true"]').textContent();
  assert.match(summary, /Verification summary/);
  assert(summary.includes(expectedProof), 'exact build→QA→promotion byte identity was not visible in Studio');
  assert(summary.includes(`Verified artifact: ${buildHash}`), 'verified artifact digest was not visible in Studio');
  assert.match(summary, /Publication: not executed/);
  assert.match(summary, /Secrets: not used/);
  assert.deepEqual(consoleErrors, []);

  await page.screenshot({ path: resolve(artifacts, 'studio-inline-qa-artifact-proof.png'), fullPage: true });
  console.log(`Studio inline QA artifact browser dogfood passed: ${JSON.stringify({ buildHash, qaHash, promotedHash, publicationExecuted: envelope.run?.safety?.publicationExecuted, secretsUsed: envelope.run?.safety?.secretsUsed })}`);
  await page.close();
} finally {
  await browser.close();
}
