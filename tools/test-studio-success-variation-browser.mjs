import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const baseURL = process.env.CONTROL_PLANE_URL || 'http://127.0.0.1:4173/apps/studio/';
const artifacts = process.env.BROWSER_ARTIFACTS || 'artifacts/control-plane-browser';
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
  await page.locator('#brief-name').fill('Harbour Run');
  await page.locator('#brief-objective').fill('Build a small verified local starter that can become a second variation without retyping the original brief.');
  await page.locator('#creator-advanced summary').click();
  await page.locator('#brief-target').selectOption('mobile');
  await page.locator('#brief-mechanic').selectOption('collect');
  await page.locator('#run-brief').click();
  await page.waitForFunction(() => document.querySelector('#run-message')?.textContent.includes('opened below'), null, { timeout: 30000 });
  await page.waitForFunction(() => document.querySelector('#make-verified-variation'), null, { timeout: 10000 });
  assert.equal(pipelinePosts, 1, 'initial verified project must execute exactly one pipeline POST');
  assert.equal(await page.locator('[data-run-step].pass').count(), 6, 'initial project did not complete all six local stages');
  assert.equal(await page.locator('#play-result').isVisible(), true, 'initial verified playable was not exposed');

  const latestBeforeVariation = await (await page.request.get(new URL('/api/pipeline/runs/latest', baseURL).href)).json();
  assert.equal(latestBeforeVariation.available, true, 'initial verified run was not retained');
  const oldPlayable = new URL(latestBeforeVariation.run.playable.launchUrl, baseURL).href;
  const oldDownload = new URL(latestBeforeVariation.run.download.url, baseURL).href;

  const makeVariation = page.getByRole('button', { name: 'Make a variation' });
  assert.equal(await makeVariation.count(), 1, 'verified result did not expose Make a variation');
  const variationReload = page.waitForNavigation({ waitUntil: 'domcontentloaded' });
  await makeVariation.click();
  await variationReload;
  await page.waitForFunction(() => document.querySelector('#run-message')?.textContent.includes('variation draft restored'), null, { timeout: 10000 });

  assert.equal(pipelinePosts, 1, 'preparing a variation must not execute the pipeline');
  assert.deepEqual(await (await page.request.get(new URL('/api/pipeline/runs/latest', baseURL).href)).json(), { available: false }, 'variation preparation must clear prior server-side success authority');
  assert.equal((await page.request.get(oldPlayable)).status(), 404, 'variation preparation did not invalidate the prior playable handle');
  assert.equal((await page.request.get(oldDownload)).status(), 404, 'variation preparation did not invalidate the prior bundle handle');
  assert.equal(await page.locator('#play-result').isVisible(), false, 'variation preparation left stale playable authority visible');
  assert.equal(await page.locator('#run-evidence-panel').isVisible(), false, 'variation preparation left stale evidence visible');
  assert.equal(await page.locator('#brief-name').inputValue(), 'Harbour Run');
  assert.equal(await page.locator('#brief-objective').inputValue(), 'Build a small verified local starter that can become a second variation without retyping the original brief.');
  assert.equal(await page.locator('#brief-target').inputValue(), 'mobile');
  assert.equal(await page.locator('#brief-mechanic').inputValue(), 'collect');
  assert.match(await page.locator('#run-message').textContent(), /Nothing has run for this variation/i);
  assert.notEqual(await page.evaluate((key) => sessionStorage.getItem(key), variationKey), null, 'variation handoff draft should remain available until explicit execution/reset/new verified authority');

  await page.locator('#brief-name').fill('Harbour Run Remix');
  await page.locator('#brief-objective').fill('Turn the same reviewed starter into a dodge-focused desktop-intent variation while keeping execution local and explicit.');
  await page.locator('#brief-target').selectOption('desktop');
  await page.locator('#brief-mechanic').selectOption('dodge');
  assert.equal(pipelinePosts, 1, 'editing the restored variation brief must not execute the pipeline');

  const savedDraftBeforeRefresh = JSON.parse(await page.evaluate((key) => sessionStorage.getItem(key), variationKey));
  assert.deepEqual(savedDraftBeforeRefresh.brief, {
    name: 'Harbour Run Remix',
    objective: 'Turn the same reviewed starter into a dodge-focused desktop-intent variation while keeping execution local and explicit.',
    targetPlatform: 'desktop',
    mechanic: 'dodge'
  }, 'valid unsent variation edits were not persisted before refresh');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#run-message')?.textContent.includes('variation draft restored'), null, { timeout: 10000 });
  await page.locator('[data-view="local-run"]').click();
  assert.equal(pipelinePosts, 1, 'refreshing an unsent variation draft must not execute the pipeline');
  assert.equal(await page.locator('#brief-name').inputValue(), 'Harbour Run Remix', 'variation name did not survive refresh');
  assert.equal(await page.locator('#brief-objective').inputValue(), 'Turn the same reviewed starter into a dodge-focused desktop-intent variation while keeping execution local and explicit.', 'variation objective did not survive refresh');
  assert.equal(await page.locator('#brief-target').inputValue(), 'desktop', 'variation target did not survive refresh');
  assert.equal(await page.locator('#brief-mechanic').inputValue(), 'dodge', 'variation mechanic did not survive refresh');
  assert.equal(await page.locator('#play-result').isVisible(), false, 'variation refresh recovery exposed stale playable authority');
  assert.equal(await page.locator('#run-evidence-panel').isVisible(), false, 'variation refresh recovery exposed stale evidence authority');

  await page.locator('#run-brief').click();
  await page.waitForFunction(() => document.querySelector('#run-message')?.textContent.includes('opened below'), null, { timeout: 30000 });
  await page.waitForFunction(() => document.querySelector('#run-evidence')?.textContent.includes('Verification summary'), null, { timeout: 10000 });
  assert.equal(pipelinePosts, 2, 'explicit variation submission must create exactly one additional pipeline POST');
  assert.equal(await page.evaluate((key) => sessionStorage.getItem(key), variationKey), null, 'explicit variation execution must clear the planning draft');
  assert.equal(await page.locator('[data-run-step].pass').count(), 6, 'variation did not complete the real local pipeline');
  const variationEvidence = await page.locator('#run-evidence').textContent();
  assert.match(variationEvidence, /Harbour Run Remix/);
  assert.match(variationEvidence, /Target: desktop/);
  assert.match(variationEvidence, /Mechanic: dodge/);
  assert.match(variationEvidence, /Publication executed: false/);
  assert.match(variationEvidence, /Secrets used: false/);
  assert.match(variationEvidence, /Dry-run only: true/);

  await page.evaluate((key) => {
    sessionStorage.setItem(key, JSON.stringify({
      brief: {
        name: 'Stale project',
        objective: 'This stale draft must never replace a newer verified run.',
        targetPlatform: 'web',
        mechanic: 'survive'
      }
    }));
  }, variationKey);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#run-message')?.textContent.includes('Recovered the latest verified run'), null, { timeout: 10000 });
  await page.locator('[data-view="local-run"]').click();
  assert.equal(await page.locator('#brief-name').inputValue(), 'Harbour Run Remix', 'stale variation draft replaced the newer verified run');
  assert.equal(await page.evaluate((key) => sessionStorage.getItem(key), variationKey), null, 'stale variation draft was not cleared when a verified run existed');
  assert.equal(pipelinePosts, 2, 'verified-run recovery must not execute another pipeline run');

  const finalReset = await page.request.delete(new URL('/api/pipeline/runs/latest', baseURL).href);
  assert(finalReset.ok(), `final latest-run reset HTTP ${finalReset.status()}`);
  await page.evaluate((key) => {
    sessionStorage.setItem(key, JSON.stringify({
      brief: {
        name: 'Unsafe variation',
        objective: 'Invalid target must fail closed.',
        targetPlatform: 'store',
        mechanic: 'collect'
      }
    }));
  }, variationKey);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('[data-view="local-run"]').click();
  assert.equal(await page.evaluate((key) => sessionStorage.getItem(key), variationKey), null, 'invalid variation draft was not discarded');
  assert.equal(await page.locator('#play-result').isVisible(), false, 'invalid variation draft exposed playable authority');
  assert.equal(await page.locator('#run-evidence-panel').isVisible(), false, 'invalid variation draft exposed evidence authority');
  assert.doesNotMatch(await page.locator('#run-message').textContent(), /variation draft restored/i);
  assert.equal(pipelinePosts, 2, 'invalid variation recovery must not execute the pipeline');

  await page.evaluate((key) => sessionStorage.setItem(key, '{not-json'), variationKey);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('[data-view="local-run"]').click();
  assert.equal(await page.evaluate((key) => sessionStorage.getItem(key), variationKey), null, 'malformed variation draft was not removed');
  assert.equal(await page.locator('#play-result').isVisible(), false, 'malformed variation draft exposed playable authority');
  assert.equal(await page.locator('#run-evidence-panel').isVisible(), false, 'malformed variation draft exposed evidence authority');
  assert.doesNotMatch(await page.locator('#run-message').textContent(), /variation draft restored/i);
  assert.equal(pipelinePosts, 2, 'malformed variation recovery must not execute the pipeline');

  await page.evaluate((key) => {
    const oversized = JSON.stringify({
      brief: {
        name: 'Oversized variation',
        objective: 'x'.repeat(5000),
        targetPlatform: 'web',
        mechanic: 'collect'
      }
    });
    sessionStorage.setItem(key, oversized);
  }, variationKey);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('[data-view="local-run"]').click();
  assert.equal(await page.evaluate((key) => sessionStorage.getItem(key), variationKey), null, 'oversized variation draft was not removed');
  assert.equal(await page.locator('#play-result').isVisible(), false, 'oversized variation draft exposed playable authority');
  assert.equal(await page.locator('#run-evidence-panel').isVisible(), false, 'oversized variation draft exposed evidence authority');
  assert.doesNotMatch(await page.locator('#run-message').textContent(), /variation draft restored/i);
  assert.equal(pipelinePosts, 2, 'oversized variation recovery must not execute the pipeline');

  assert.deepEqual(externalRequests, [], 'variation journey made external HTTP(S) requests');
  assert.deepEqual(errors, []);
  await page.screenshot({ path: `${artifacts}/verified-brief-variation.png`, fullPage: true });
  const evidence = {
    verifiedVariationBrowserVerified: true,
    unsentVariationRefreshRecoveryVerified: true,
    initialExecutionAttempts: 1,
    variationPreparationExecutionAttemptsAdded: 0,
    unsentVariationRefreshExecutionAttemptsAdded: 0,
    explicitVariationExecutionAttemptsAdded: 1,
    totalPipelinePosts: pipelinePosts,
    priorArtifactHandlesInvalidated: true,
    staleVariationDraftRejectedInFavorOfVerifiedRun: true,
    invalidVariationDraftRejected: true,
    malformedVariationDraftRejected: true,
    oversizedVariationDraftRejected: true,
    publicationExecuted: false,
    secretsUsed: false,
    externalHttpRequests: externalRequests.length
  };
  await writeFile(`${artifacts}/verified-brief-variation.json`, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log('Verified brief variation dogfood passed: valid unsent variation edits survived refresh with zero execution, stale/invalid drafts failed closed, prior success authority stayed invalidated, and only explicit submission created one new local dry-run pipeline execution.');
} finally {
  await browser.close();
}
