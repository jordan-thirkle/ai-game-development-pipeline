import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const baseURL = process.env.CONTROL_PLANE_URL || 'http://127.0.0.1:4173/apps/studio/';
const artifacts = process.env.BROWSER_ARTIFACTS || 'artifacts/control-plane-browser';
await mkdir(artifacts, { recursive: true });

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/favicon.ico', (route) => route.fulfill({ status: 204, body: '' }));
  const response = await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  assert(response?.ok(), `Studio HTTP ${response?.status()}`);
  await page.locator('[data-view="local-run"]').click();
  await page.locator('#brief-name').fill('Harbour Run');
  await page.locator('#brief-objective').fill('Build a small web-first arcade starter with a clear local verification trail.');
  await page.locator('#brief-target').selectOption('web');
  await page.locator('#run-brief').click();
  assert.equal(await page.locator('#run-brief').isDisabled(), true, 'brief control remained active during a visual run');
  assert.equal(await page.locator('#run-sample').isDisabled(), true, 'sample control remained active during a brief run');
  await page.waitForFunction(() => document.querySelector('#run-message')?.textContent.includes('verified local starter'), null, { timeout: 30000 });
  assert.equal(await page.locator('#run-brief').isEnabled(), true, 'brief control was not restored after the run');
  assert.equal(await page.locator('#run-sample').isEnabled(), true, 'sample control was not restored after the run');
  assert.equal(await page.locator('[data-run-step].pass').count(), 6, 'brief flow did not prove all six local stages');
  const evidence = await page.locator('#run-evidence').textContent();
  assert.match(evidence, /Applied brief/);
  assert.match(evidence, /Harbour Run/);
  assert.match(evidence, /Target: web/);
  assert.match(evidence, /Project: brief-harbour-run/);
  assert.match(evidence, /Verified local starter/);
  assert.match(evidence, /Publication executed: false/);
  assert.match(evidence, /Secrets used: false/);
  assert.match(evidence, /Dry-run only: true/);

  const downloadLink = page.getByRole('link', { name: 'Download starter bundle' });
  assert.equal(await downloadLink.count(), 1, 'verified starter download was not exposed in Studio');
  const href = await downloadLink.getAttribute('href');
  assert.match(href, /^\/api\/pipeline\/downloads\/[0-9a-f-]+$/i);
  assert.equal(await downloadLink.getAttribute('download'), 'brief-harbour-run-verified-local-starter.tar.gz');
  const bundleResponse = await page.request.get(new URL(href, baseURL).href);
  assert.equal(bundleResponse.ok(), true, `starter download HTTP ${bundleResponse.status()}`);
  assert.equal(bundleResponse.headers()['content-type'], 'application/gzip');
  assert.match(bundleResponse.headers()['x-byjtt-bundle-sha256'], /^sha256:[a-f0-9]{64}$/);
  const bundleBytes = await bundleResponse.body();
  assert.equal(bundleBytes[0], 0x1f);
  assert.equal(bundleBytes[1], 0x8b);

  assert.deepEqual(errors, []);
  await page.screenshot({ path: `${artifacts}/desktop-brief-run.png`, fullPage: true });
  console.log('Studio brief browser dogfood passed with serialized controls and verified starter download.');
} finally {
  await browser.close();
}
