import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { createStudioServer, executeSampleRun } from './studio-server.mjs';
import { scaffoldSampleProject } from './run-pipeline.mjs';

const artifactsDir = process.env.BROWSER_ARTIFACTS || 'artifacts/control-plane-browser';
await mkdir(artifactsDir, { recursive: true });

async function failingScaffold(targetPath) {
  await scaffoldSampleProject(targetPath);
  const manifestPath = resolve(targetPath, 'project.manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.build.argv = [process.execPath, '-e', 'process.exit(17)'];
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return targetPath;
}

let executionAttempts = 0;
const execute = ({ brief } = {}) => {
  executionAttempts += 1;
  return executeSampleRun({ brief, scaffold: executionAttempts <= 2 ? failingScaffold : scaffoldSampleProject });
};
const server = createStudioServer({ execute });
await new Promise((resolvePromise, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolvePromise);
});
const address = server.address();
const studioUrl = `http://127.0.0.1:${address.port}/apps/studio/`;

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage();
const externalRequests = [];
const briefBodies = [];
let pipelinePosts = 0;
page.on('request', (request) => {
  const url = new URL(request.url());
  if (request.method() === 'POST' && url.pathname === '/api/pipeline/brief-runs') {
    pipelinePosts += 1;
    try { briefBodies.push(request.postDataJSON()); } catch {}
  }
  if (['http:', 'https:'].includes(url.protocol) && !['127.0.0.1', 'localhost'].includes(url.hostname)) {
    externalRequests.push(request.url());
  }
});

const briefA = {
  name: 'Editable Recovery A',
  objective: 'Build the first failed mobile-intent collection starter and preserve truthful local evidence.',
  targetPlatform: 'mobile',
  mechanic: 'collect'
};
const briefB = {
  name: 'Editable Recovery B',
  objective: 'Build the second failed desktop-intent collection starter without reusing the first retry baseline.',
  targetPlatform: 'desktop',
  mechanic: 'collect'
};
const briefC = {
  ...briefB,
  objective: 'Build the repaired desktop-intent collection starter after reviewing only the second failed brief.'
};

try {
  await page.goto(studioUrl, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Run Pipeline' }).click();
  await page.locator('#brief-name').fill(briefA.name);
  await page.locator('#brief-objective').fill(briefA.objective);
  await page.locator('#creator-advanced summary').click();
  await page.locator('#brief-target').selectOption(briefA.targetPlatform);
  await page.locator('#brief-mechanic').selectOption(briefA.mechanic);
  await page.getByRole('button', { name: 'Create playable starter' }).click();
  await page.locator('#run-message.fail').waitFor({ state: 'visible' });
  await page.getByText('Failed attempt evidence', { exact: true }).waitFor({ state: 'visible' });
  assert.equal(pipelinePosts, 1);
  assert.equal(executionAttempts, 1);
  assert.deepEqual(briefBodies, [briefA]);

  await page.reload({ waitUntil: 'networkidle' });
  await page.getByText('Failed attempt evidence', { exact: true }).waitFor({ state: 'visible' });
  assert.equal(pipelinePosts, 1, 'refresh recovery must not execute the pipeline');

  await page.getByRole('button', { name: 'Edit before retry' }).click();
  const preflight = page.locator('#failed-retry-preflight');
  await preflight.waitFor({ state: 'visible' });
  assert.match(await preflight.innerText(), /No brief changes yet/);
  assert.equal(await preflight.locator('li').count(), 0);
  assert.equal(pipelinePosts, 1, 'preparing brief A for editing must not execute');

  await page.locator('#brief-name').fill(briefB.name);
  await page.locator('#brief-objective').fill(briefB.objective);
  await page.locator('#brief-target').selectOption(briefB.targetPlatform);
  const firstPreflightText = await preflight.innerText();
  assert.match(firstPreflightText, /3 brief fields changed/);
  assert.match(firstPreflightText, /Project name: Editable Recovery A → Editable Recovery B/);
  assert.match(firstPreflightText, /Requested target: mobile → desktop/);
  assert.equal(await preflight.locator('li').count(), 3);
  assert.equal(pipelinePosts, 1, 'reviewing brief A changes must remain non-executing');

  await page.getByRole('button', { name: 'Create playable starter' }).click();
  await page.locator('#run-message.fail').waitFor({ state: 'visible' });
  await page.getByText('Failed attempt evidence', { exact: true }).waitFor({ state: 'visible' });
  assert.equal(pipelinePosts, 2, 'submitting brief B must create exactly one second attempt');
  assert.equal(executionAttempts, 2);
  assert.deepEqual(briefBodies, [briefA, briefB]);
  assert.equal(await page.locator('#failed-retry-preflight').count(), 0, 'submitting brief A edits must clear its preflight');

  const editB = page.getByRole('button', { name: 'Edit before retry' });
  await editB.waitFor({ state: 'visible' });
  await editB.click();
  await preflight.waitFor({ state: 'visible' });
  assert.match(await preflight.innerText(), /No brief changes yet/, 'brief B must become the new retry baseline');
  assert.equal(await preflight.locator('li').count(), 0);
  assert.equal(await page.locator('#brief-name').inputValue(), briefB.name);
  assert.equal(await page.locator('#brief-objective').inputValue(), briefB.objective);
  assert.equal(await page.locator('#brief-target').inputValue(), briefB.targetPlatform);
  assert.equal(await page.locator('#brief-mechanic').inputValue(), briefB.mechanic);
  assert.equal(pipelinePosts, 2, 'opening edit mode for brief B must not execute');

  await page.locator('#brief-objective').fill(briefC.objective);
  const secondPreflightText = await preflight.innerText();
  assert.match(secondPreflightText, /1 brief field changed/);
  assert.match(secondPreflightText, /Objective:/);
  assert.match(secondPreflightText, new RegExp(`${briefB.objective.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} → ${briefC.objective.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  assert.doesNotMatch(secondPreflightText, /Editable Recovery A/, 'second retry must not compare against stale brief A');
  assert.doesNotMatch(secondPreflightText, /Requested target:/, 'unchanged brief B target must not be shown as changed');
  assert.doesNotMatch(secondPreflightText, /Project name:/, 'unchanged brief B name must not be shown as changed');
  assert.equal(await preflight.locator('li').count(), 1, 'second preflight must compare only against brief B');
  assert.equal(pipelinePosts, 2, 'reviewing second-cycle preflight must not execute');

  await page.getByRole('button', { name: 'Create playable starter' }).click();
  await page.locator('#run-message.pass').waitFor({ state: 'visible', timeout: 30_000 });
  assert.equal(pipelinePosts, 3, 'explicit submit after second edit must execute exactly one additional run');
  assert.equal(executionAttempts, 3);
  assert.deepEqual(briefBodies, [briefA, briefB, briefC]);
  assert.equal(await page.locator('#failed-retry-preflight').count(), 0);
  await page.getByRole('link', { name: 'Download starter bundle' }).waitFor({ state: 'visible' });
  assert.equal(await page.locator('#play-result').isVisible(), true);
  await page.getByText('Verification summary', { exact: true }).waitFor({ state: 'visible' });
  assert.equal(await page.getByRole('button', { name: 'Edit before retry' }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Retry same project' }).count(), 0);

  await page.reload({ waitUntil: 'networkidle' });
  assert.match(await page.locator('#run-message').innerText(), /Recovered the latest verified run/);
  assert.equal(pipelinePosts, 3, 'successful recovery after repeated failed edits must not execute again');
  assert.deepEqual(externalRequests, []);

  const evidence = {
    studioUrl,
    realSampleScaffold: true,
    forcedFailures: ['attempt 1 build exits 17', 'attempt 2 build exits 17'],
    repeatedRetryBaselineVerified: true,
    firstFailedBrief: briefA,
    secondFailedBrief: briefB,
    successfulBrief: briefC,
    secondCycleChangedFields: ['objective'],
    staleFirstBaselineRejected: true,
    preflightExecutionAuthority: 'none until explicit submit',
    executionAttempts,
    pipelinePosts,
    externalRequests
  };
  await writeFile(resolve(artifactsDir, 'studio-failed-attempt-edit-evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  await page.screenshot({ path: resolve(artifactsDir, 'studio-failed-attempt-edited-retry.png'), fullPage: true });
  console.log('Studio repeated failed-attempt edit-before-retry browser dogfood passed.');
} finally {
  await browser.close();
  await new Promise((resolvePromise) => server.close(resolvePromise));
}
