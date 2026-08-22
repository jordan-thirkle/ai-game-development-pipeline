import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const baseURL = process.env.CONTROL_PLANE_URL || 'http://127.0.0.1:4173/apps/studio/';
const artifacts = process.env.BROWSER_ARTIFACTS || 'artifacts/control-plane-browser';
const manifestPath = resolve('examples/sample-game/project.manifest.json');
await mkdir(artifacts, { recursive: true });

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  const briefRequests = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/pipeline/brief-runs') {
      briefRequests.push(request.postDataJSON());
    }
  });
  await page.route('**/favicon.ico', (route) => route.fulfill({ status: 204, body: '' }));

  const response = await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  assert(response?.ok(), `Studio HTTP ${response?.status()}`);
  await page.locator('[data-view="local-run"]').click();

  const importButton = page.getByRole('button', { name: 'Continue from starter manifest' });
  assert.equal(await importButton.count(), 1, 'portable starter continuation control was not exposed');
  const input = page.locator('#portable-starter-manifest');
  assert.equal(await input.count(), 1, 'portable starter file input was not exposed');
  await input.setInputFiles(manifestPath);
  await page.waitForFunction(() => document.querySelector('#portable-starter-status')?.textContent.includes('Planning intent loaded locally'), null, { timeout: 5000 });

  assert.equal(briefRequests.length, 0, 'loading a starter manifest must not execute the pipeline');
  assert.equal(await page.locator('#brief-name').inputValue(), 'Pipeline Sample Game');
  assert.equal(await page.locator('#brief-objective').inputValue(), 'Prove a dependency-free build, QA, release-candidate, and publishing dry run.');
  assert.equal(await page.locator('#brief-target').inputValue(), 'web');
  assert.equal(await page.locator('#brief-mechanic').inputValue(), 'collect');
  assert.equal(await page.locator('#creator-advanced').getAttribute('open'), '', 'imported target/mechanic were not revealed for review');
  assert.match(await page.locator('#portable-starter-status').textContent(), /No file was uploaded and no execution evidence was imported/i);
  assert.match(await page.locator('#run-message').textContent(), /Nothing has run for this imported brief/i);
  assert.equal(await page.locator('#play-result').isVisible(), false);
  assert.equal(await page.locator('#run-evidence-panel').isVisible(), false);

  await page.locator('#run-brief').click();
  await page.waitForFunction(() => document.querySelector('#run-message')?.textContent.includes('opened below'), null, { timeout: 30000 });
  assert.equal(briefRequests.length, 1, 'explicit Create playable starter should execute exactly one brief run');
  assert.deepEqual(Object.keys(briefRequests[0]).sort(), ['mechanic', 'name', 'objective', 'targetPlatform']);
  assert.deepEqual(briefRequests[0], {
    name: 'Pipeline Sample Game',
    objective: 'Prove a dependency-free build, QA, release-candidate, and publishing dry run.',
    targetPlatform: 'web',
    mechanic: 'collect'
  });
  assert.equal(await page.locator('[data-run-step].pass').count(), 6, 'continued starter did not complete the real local pipeline');
  assert.equal(await page.locator('#play-result').isVisible(), true, 'continued starter did not expose the verified playable');
  assert.equal(page.getByRole('link', { name: 'Download starter bundle' }) ? await page.getByRole('link', { name: 'Download starter bundle' }).count() : 0, 1);
  const evidence = await page.locator('#run-evidence').textContent();
  assert.match(evidence, /Pipeline Sample Game/);
  assert.match(evidence, /Publication executed: false/);
  assert.match(evidence, /Secrets used: false/);
  assert.match(evidence, /Dry-run only: true/);

  await page.screenshot({ path: `${artifacts}/portable-starter-continuation.png`, fullPage: true });
  assert.deepEqual(errors, []);
  console.log('Portable starter continuation dogfood passed: manifest intent loaded with zero execution, then one explicit real local pipeline run produced passing build/QA/release evidence and no publication authority.');
} finally {
  await browser.close();
}
