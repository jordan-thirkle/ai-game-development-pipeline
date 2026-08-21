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
  let pipelinePosts = 0;
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (request.method() === 'POST' && /\/api\/pipeline\/(brief-runs|runs)$/.test(new URL(request.url()).pathname)) pipelinePosts += 1;
  });
  await page.route('**/favicon.ico', (route) => route.fulfill({ status: 204, body: '' }));
  const response = await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  assert(response?.ok(), `Studio HTTP ${response?.status()}`);
  await page.locator('[data-view="local-run"]').click();
  await page.locator('#brief-name').fill('Harbour Run');
  await page.locator('#brief-objective').fill('Build a small web-first arcade starter with a clear local verification trail.');
  assert.equal(await page.locator('#brief-target').isVisible(), false, 'Creator Mode target should start progressively disclosed');
  assert.equal(await page.locator('#brief-mechanic').isVisible(), false, 'Creator Mode mechanic should start progressively disclosed');
  await page.locator('#creator-advanced summary').click();
  await page.locator('#brief-target').selectOption('web');
  await page.locator('#brief-mechanic').selectOption('dodge');
  await page.locator('#run-brief').click();
  assert.equal(await page.locator('#run-brief').isDisabled(), true, 'brief control remained active during a visual run');
  assert.equal(await page.locator('#run-sample').isDisabled(), true, 'sample control remained active during a brief run');
  await page.waitForFunction(() => document.querySelector('#run-message')?.textContent.includes('opened below'), null, { timeout: 30000 });
  assert.equal(await page.locator('#run-brief').isEnabled(), true, 'brief control was not restored after the run');
  assert.equal(await page.locator('#run-sample').isEnabled(), true, 'sample control was not restored after a brief run');
  assert.equal(await page.locator('[data-run-step].pass').count(), 6, 'brief flow did not prove all six local stages');
  const evidence = await page.locator('#run-evidence').textContent();
  assert.match(evidence, /Applied brief/);
  assert.match(evidence, /Harbour Run/);
  assert.match(evidence, /Target: web/);
  assert.match(evidence, /Mechanic: dodge/);
  assert.match(evidence, /Project: brief-harbour-run/);
  assert.match(evidence, /Verified local starter/);
  assert.match(evidence, /Verification summary/);
  assert.match(evidence, /Publication executed: false/);
  assert.match(evidence, /Secrets used: false/);
  assert.match(evidence, /Dry-run only: true/);

  assert.equal(await page.locator('#play-result').isVisible(), true, 'playable result panel was not exposed');
  const playSrc = await page.locator('#play-frame').getAttribute('src');
  assert.match(playSrc, /\/play\/sample\/$/);
  const playResponse = await page.request.get(playSrc);
  assert.equal(playResponse.ok(), true, `playable result HTTP ${playResponse.status()}`);
  assert.match(playResponse.headers()['x-byjtt-artifact-sha256'], /^sha256:[a-f0-9]{64}$/);
  const playableHtml = await playResponse.text();
  assert.match(playableHtml, /<canvas id="game">/);
  assert.match(playableHtml, /Harbour Run/);
  assert.match(playableHtml, /Build a small web-first arcade starter with a clear local verification trail\./);
  assert.match(playableHtml, /Target: web/);
  assert.match(playableHtml, /Mechanic: dodge/);
  assert.match(playableHtml, /Reach the green exit while avoiding red hazards/);

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
  assert.equal(pipelinePosts, 1, 'initial brief flow should execute exactly one pipeline POST');

  const latestResponse = await page.request.get(new URL('/api/pipeline/runs/latest', baseURL).href);
  assert.equal(latestResponse.ok(), true, `latest run HTTP ${latestResponse.status()}`);
  const latestEnvelope = await latestResponse.json();
  assert.equal(latestEnvelope.available, true, 'latest run was not available for recovery checks');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#run-message')?.textContent.includes('Recovered the latest verified run'), null, { timeout: 10000 });
  assert.equal(pipelinePosts, 1, 'page refresh must not rebuild the project to recover the latest run');
  await page.locator('[data-view="local-run"]').click();
  assert.equal(await page.locator('#brief-name').inputValue(), 'Harbour Run', 'refresh recovery did not restore the Creator Mode name');
  assert.equal(await page.locator('#brief-objective').inputValue(), 'Build a small web-first arcade starter with a clear local verification trail.', 'refresh recovery did not restore the Creator Mode objective');
  assert.equal(await page.locator('#brief-target').inputValue(), 'web', 'refresh recovery did not restore the requested target');
  assert.equal(await page.locator('#brief-mechanic').inputValue(), 'dodge', 'refresh recovery did not restore the reviewed starter mechanic');
  assert.equal(await page.locator('#creator-advanced').getAttribute('open'), '', 'refresh recovery did not reveal restored fine-tune values');
  assert.match(await page.locator('#creator-suggestion').textContent(), /restored from the latest verified run/i);
  assert.match(await page.locator('#run-message').textContent(), /No rebuild or re-entry was needed/i);
  assert.equal(await page.locator('[data-run-step].pass').count(), 6, 'refresh recovery did not restore all six passing stages');
  assert.equal(await page.locator('#play-result').isVisible(), true, 'refresh recovery did not restore the playable result');
  const recoveredPlaySrc = await page.locator('#play-frame').getAttribute('src');
  const expectedPlayableUrl = new URL(playSrc, baseURL).href;
  assert.equal(recoveredPlaySrc, expectedPlayableUrl, 'refresh recovery changed the playable artifact handle');
  const recoveredPlayableResponse = await page.request.get(recoveredPlaySrc);
  assert.equal(recoveredPlayableResponse.ok(), true, `recovered playable result HTTP ${recoveredPlayableResponse.status()}`);
  assert.match(recoveredPlayableResponse.headers()['x-byjtt-artifact-sha256'], /^sha256:[a-f0-9]{64}$/);
  const popupPromise = page.waitForEvent('popup');
  await page.locator('#open-result').click();
  const popup = await popupPromise;
  try {
    await popup.waitForLoadState('domcontentloaded');
    assert.equal(popup.url(), expectedPlayableUrl, 'recovered open-result action targeted the wrong artifact');
  } finally {
    await popup.close();
  }
  assert.match(await page.locator('#run-evidence').textContent(), /Harbour Run/);
  assert.match(await page.locator('#run-evidence').textContent(), /Verification summary/);
  const recoveredDownload = page.getByRole('link', { name: 'Download starter bundle' });
  assert.equal(await recoveredDownload.count(), 1, 'refresh recovery did not restore the verified starter download');
  assert.equal(await recoveredDownload.getAttribute('href'), new URL(href, baseURL).href, 'refresh recovery changed the in-session artifact handle');
  assert.equal((await page.request.get(new URL(href, baseURL).href)).ok(), true, 'recovered starter handle was no longer usable');

  const newProject = page.getByRole('button', { name: 'Start new project' });
  assert.equal(await newProject.count(), 1, 'recovered result did not expose a Start new project action');
  const reloaded = page.waitForNavigation({ waitUntil: 'domcontentloaded' });
  await newProject.click();
  await reloaded;
  await page.locator('[data-view="local-run"]').click();
  assert.equal(pipelinePosts, 1, 'starting a new project must not execute another pipeline run');
  assert.equal(await page.locator('#play-result').isVisible(), false, 'starting a new project left the previous playable visible');
  assert.equal(await page.locator('#run-evidence-panel').isVisible(), false, 'starting a new project left previous evidence visible');
  assert.match(await page.locator('#run-message').textContent(), /Ready\. Nothing has run yet\./);
  assert.deepEqual(await (await page.request.get(new URL('/api/pipeline/runs/latest', baseURL).href)).json(), { available: false });
  assert.equal((await page.request.get(expectedPlayableUrl)).status(), 404, 'reset did not invalidate the prior playable handle');
  assert.equal((await page.request.get(new URL(href, baseURL).href)).status(), 404, 'reset did not invalidate the prior bundle handle');

  const unsafePage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    await unsafePage.route('**/favicon.ico', (route) => route.fulfill({ status: 204, body: '' }));
    await unsafePage.route('**/api/pipeline/runs/latest', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...latestEnvelope,
        run: {
          ...latestEnvelope.run,
          safety: {
            ...latestEnvelope.run.safety,
            destination: { kind: 'remote', target: 'https://example.invalid/publish' }
          }
        }
      })
    }));
    const unsafeResponse = await unsafePage.goto(baseURL, { waitUntil: 'domcontentloaded' });
    assert(unsafeResponse?.ok(), `unsafe recovery Studio HTTP ${unsafeResponse?.status()}`);
    await unsafePage.waitForFunction(() => document.querySelector('#run-message')?.textContent.includes('Latest run was not restored'), null, { timeout: 10000 });
    assert.match(await unsafePage.locator('#run-message').textContent(), /publishing safety evidence did not pass/i);
    assert.equal(await unsafePage.locator('#play-result').isVisible(), false, 'unsafe recovered destination exposed a playable result');
    assert.equal(await unsafePage.locator('#run-evidence-panel').isVisible(), false, 'unsafe recovered destination exposed recovered evidence');
  } finally {
    await unsafePage.close();
  }

  const malformedBriefPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    await malformedBriefPage.route('**/favicon.ico', (route) => route.fulfill({ status: 204, body: '' }));
    await malformedBriefPage.route('**/api/pipeline/runs/latest', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...latestEnvelope,
        run: {
          ...latestEnvelope.run,
          brief: { ...latestEnvelope.run.brief, targetPlatform: 'store' }
        }
      })
    }));
    const malformedResponse = await malformedBriefPage.goto(baseURL, { waitUntil: 'domcontentloaded' });
    assert(malformedResponse?.ok(), `malformed brief recovery Studio HTTP ${malformedResponse?.status()}`);
    await malformedBriefPage.waitForFunction(() => document.querySelector('#run-message')?.textContent.includes('Latest run was not restored'), null, { timeout: 10000 });
    assert.match(await malformedBriefPage.locator('#run-message').textContent(), /brief target is invalid/i);
    assert.equal(await malformedBriefPage.locator('#play-result').isVisible(), false, 'malformed recovered brief exposed a playable result');
    assert.equal(await malformedBriefPage.locator('#run-evidence-panel').isVisible(), false, 'malformed recovered brief exposed recovered evidence');
  } finally {
    await malformedBriefPage.close();
  }

  assert.deepEqual(errors, []);
  await page.screenshot({ path: `${artifacts}/desktop-brief-run-reset.png`, fullPage: true });
  console.log('Studio brief browser dogfood passed through Creator Mode, verified recovery, explicit zero-run Start new project reset with invalidated artifact handles, and fail-closed recovered destinations/briefs.');
} finally {
  await browser.close();
}
