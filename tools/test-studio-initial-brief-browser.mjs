import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const baseURL = process.env.CONTROL_PLANE_URL || 'http://127.0.0.1:4173/apps/studio/';
const artifacts = process.env.BROWSER_ARTIFACTS || 'artifacts/control-plane-browser';
const draftKey = 'byjtt:studio:initial-brief:v1';
const variationKey = 'byjtt:studio:verified-variation:v1';
const baseOrigin = new URL(baseURL).origin;
await mkdir(artifacts, { recursive: true });

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  const externalRequests = [];
  let pipelinePosts = 0;
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (request.method() === 'POST' && /\/api\/pipeline\/(brief-runs|runs)$/.test(url.pathname)) pipelinePosts += 1;
    if ((url.protocol === 'http:' || url.protocol === 'https:') && url.origin !== baseOrigin) externalRequests.push(request.url());
  });
  await page.route('**/favicon.ico', (route) => route.fulfill({ status: 204, body: '' }));

  const reset = await page.request.delete(new URL('/api/pipeline/runs/latest', baseURL).href);
  assert(reset.ok(), `initial latest-run reset HTTP ${reset.status()}`);

  const response = await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  assert(response?.ok(), `Studio HTTP ${response?.status()}`);
  await page.locator('[data-view="local-run"]').click();
  await page.locator('#brief-name').fill('Harbour Draft');
  await page.locator('#brief-objective').fill('Build a small dodge-focused starter whose unsent Creator brief survives an accidental refresh before I explicitly run it.');
  await page.locator('#creator-advanced summary').click();
  await page.locator('#brief-target').selectOption('mobile');
  await page.locator('#brief-mechanic').selectOption('dodge');

  assert.equal(pipelinePosts, 0, 'editing a first-time Creator brief must not execute the pipeline');
  assert.equal(await page.locator('#play-result').isVisible(), false, 'unsent draft exposed playable authority');
  assert.equal(await page.locator('#run-evidence-panel').isVisible(), false, 'unsent draft exposed evidence authority');
  const saved = JSON.parse(await page.evaluate((key) => sessionStorage.getItem(key), draftKey));
  assert.deepEqual(saved.brief, {
    name: 'Harbour Draft',
    objective: 'Build a small dodge-focused starter whose unsent Creator brief survives an accidental refresh before I explicitly run it.',
    targetPlatform: 'mobile',
    mechanic: 'dodge'
  });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#run-message')?.textContent.includes('Recovered your unsent Creator brief'), null, { timeout: 5000 });
  assert.equal(pipelinePosts, 0, 'refresh recovery must not execute the pipeline');
  assert.equal(await page.locator('#local-run').isVisible(), true, 'initial brief recovery did not return to Creator Mode');
  assert.equal(await page.locator('#brief-name').inputValue(), 'Harbour Draft');
  assert.equal(await page.locator('#brief-objective').inputValue(), 'Build a small dodge-focused starter whose unsent Creator brief survives an accidental refresh before I explicitly run it.');
  assert.equal(await page.locator('#brief-target').inputValue(), 'mobile');
  assert.equal(await page.locator('#brief-mechanic').inputValue(), 'dodge');
  assert.match(await page.locator('#run-message').textContent(), /Nothing has run yet/i);
  assert.equal(await page.locator('#play-result').isVisible(), false);
  assert.equal(await page.locator('#run-evidence-panel').isVisible(), false);

  await page.evaluate((key) => sessionStorage.setItem(key, '{not-json'), draftKey);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('[data-view="local-run"]').click();
  assert.equal(await page.evaluate((key) => sessionStorage.getItem(key), draftKey), null, 'malformed initial draft was not discarded');
  assert.doesNotMatch(await page.locator('#run-message').textContent(), /Recovered your unsent Creator brief/i);
  assert.equal(pipelinePosts, 0, 'discarding malformed initial draft must not execute the pipeline');

  const oversized = JSON.stringify({
    brief: {
      name: 'Oversized draft',
      objective: `oversized ${'x'.repeat(5000)}`,
      targetPlatform: 'web',
      mechanic: 'collect'
    }
  });
  assert(oversized.length > 4096);
  await page.evaluate(({ key, value }) => sessionStorage.setItem(key, value), { key: draftKey, value: oversized });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('[data-view="local-run"]').click();
  assert.equal(await page.evaluate((key) => sessionStorage.getItem(key), draftKey), null, 'oversized initial draft was not discarded');
  assert.doesNotMatch(await page.locator('#run-message').textContent(), /Recovered your unsent Creator brief/i);
  assert.equal(pipelinePosts, 0, 'discarding oversized initial draft must not execute the pipeline');

  await page.locator('#brief-name').fill('Harbour Draft');
  await page.locator('#brief-objective').fill('Build a small dodge-focused starter whose unsent Creator brief survives refresh and then executes only after explicit submission.');
  if (!(await page.locator('#creator-advanced').evaluate((element) => element.open))) {
    await page.locator('#creator-advanced summary').click();
  }
  await page.locator('#brief-target').selectOption('mobile');
  await page.locator('#brief-mechanic').selectOption('dodge');
  assert.notEqual(await page.evaluate((key) => sessionStorage.getItem(key), draftKey), null, 'valid initial draft was not persisted before explicit run');

  await page.locator('#run-brief').click();
  await page.waitForFunction(() => document.querySelector('#run-message')?.textContent.includes('opened below'), null, { timeout: 30000 });
  await page.waitForFunction(() => document.querySelector('#run-evidence')?.textContent.includes('Verification summary'), null, { timeout: 10000 });
  assert.equal(pipelinePosts, 1, 'explicit initial brief submission must create exactly one pipeline POST');
  assert.equal(await page.evaluate((key) => sessionStorage.getItem(key), draftKey), null, 'explicit execution must clear the initial planning draft before the run');
  assert.equal(await page.locator('[data-run-step].pass').count(), 6, 'explicit recovered brief did not complete all six local stages');
  const evidence = await page.locator('#run-evidence').textContent();
  assert.match(evidence, /Harbour Draft/);
  assert.match(evidence, /Target: mobile/);
  assert.match(evidence, /Mechanic: dodge/);
  assert.match(evidence, /Publication executed: false/);
  assert.match(evidence, /Secrets used: false/);
  assert.match(evidence, /Dry-run only: true/);

  await page.evaluate(({ draftKey, variationKey }) => {
    sessionStorage.setItem(draftKey, JSON.stringify({ brief: { name: 'Stale first draft', objective: 'Must not override a verified variation handoff.', targetPlatform: 'web', mechanic: 'collect' } }));
    sessionStorage.setItem(variationKey, JSON.stringify({ brief: { name: 'Verified variation', objective: 'Variation recovery has higher authority than a first-time draft.', targetPlatform: 'desktop', mechanic: 'survive' } }));
  }, { draftKey, variationKey });
  const finalReset = await page.request.delete(new URL('/api/pipeline/runs/latest', baseURL).href);
  assert(finalReset.ok(), `final latest-run reset HTTP ${finalReset.status()}`);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#run-message')?.textContent.includes('variation draft restored'), null, { timeout: 5000 });
  assert.equal(await page.evaluate((key) => sessionStorage.getItem(key), draftKey), null, 'lower-authority initial draft was not cleared when verified variation recovery existed');
  assert.equal(await page.locator('#brief-name').inputValue(), 'Verified variation');
  assert.equal(pipelinePosts, 1, 'variation precedence recovery must not execute the pipeline');

  assert.deepEqual(externalRequests, [], 'initial brief recovery journey made external HTTP(S) requests');
  assert.deepEqual(errors, []);
  await page.screenshot({ path: `${artifacts}/initial-brief-refresh-recovery.png`, fullPage: true });
  const machineEvidence = {
    initialBriefRefreshRecoveryVerified: true,
    refreshExecutionAttemptsAdded: 0,
    explicitExecutionAttemptsAdded: 1,
    malformedDraftRejected: true,
    oversizedDraftRejected: true,
    higherAuthorityVariationPrecedenceVerified: true,
    totalPipelinePosts: pipelinePosts,
    publicationExecuted: false,
    secretsUsed: false,
    externalHttpRequests: externalRequests.length
  };
  await writeFile(`${artifacts}/initial-brief-refresh-recovery.json`, `${JSON.stringify(machineEvidence, null, 2)}\n`);
  console.log('Initial Creator brief recovery dogfood passed: unsent planning intent survived refresh with zero execution, malformed/oversized state failed closed, higher-authority variation recovery won, and only explicit submission executed the real local pipeline.');
} finally {
  await browser.close();
}
