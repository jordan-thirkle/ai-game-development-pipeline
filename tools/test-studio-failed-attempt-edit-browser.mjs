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
  return executeSampleRun({ brief, scaffold: executionAttempts === 1 ? failingScaffold : scaffoldSampleProject });
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

const failedBrief = {
  name: 'Editable Recovery Dogfood',
  objective: 'Build a small mobile-intent collection game, preserve failed evidence, then revise the brief without retyping it.',
  targetPlatform: 'mobile',
  mechanic: 'collect'
};
const revisedBrief = {
  ...failedBrief,
  objective: 'Build a revised mobile-intent collection game after reviewing the retained local failure evidence.',
  targetPlatform: 'desktop'
};

try {
  await page.goto(studioUrl, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Run Pipeline' }).click();
  await page.locator('#brief-name').fill(failedBrief.name);
  await page.locator('#brief-objective').fill(failedBrief.objective);
  await page.locator('#creator-advanced summary').click();
  await page.locator('#brief-target').selectOption(failedBrief.targetPlatform);
  await page.locator('#brief-mechanic').selectOption(failedBrief.mechanic);
  await page.getByRole('button', { name: 'Create playable starter' }).click();
  await page.locator('#run-message.fail').waitFor({ state: 'visible' });
  await page.getByText('Failed attempt evidence', { exact: true }).waitFor({ state: 'visible' });
  assert.equal(pipelinePosts, 1);
  assert.equal(executionAttempts, 1);
  assert.deepEqual(briefBodies, [failedBrief]);

  await page.reload({ waitUntil: 'networkidle' });
  await page.getByText('Failed attempt evidence', { exact: true }).waitFor({ state: 'visible' });
  assert.equal(pipelinePosts, 1, 'refresh recovery must not execute the pipeline');

  const editButton = page.getByRole('button', { name: 'Edit before retry' });
  const retryButton = page.getByRole('button', { name: 'Retry same project' });
  await editButton.waitFor({ state: 'visible' });
  await retryButton.waitFor({ state: 'visible' });
  await editButton.click();

  assert.equal(pipelinePosts, 1, 'preparing a failed brief for editing must not execute the pipeline');
  assert.equal(executionAttempts, 1);
  assert.equal(await page.locator('#brief-name').inputValue(), failedBrief.name);
  assert.equal(await page.locator('#brief-objective').inputValue(), failedBrief.objective);
  assert.equal(await page.locator('#brief-target').inputValue(), failedBrief.targetPlatform);
  assert.equal(await page.locator('#brief-mechanic').inputValue(), failedBrief.mechanic);
  assert.match(await page.locator('#run-message').innerText(), /No pipeline stage was re-executed/);

  const preflight = page.locator('#failed-retry-preflight');
  await preflight.waitFor({ state: 'visible' });
  assert.match(await preflight.innerText(), /No brief changes yet/);
  assert.match(await preflight.innerText(), /Execution authority: none/);
  assert.match(await preflight.innerText(), /local dry-run only/);
  assert.equal(await preflight.locator('li').count(), 0, 'unchanged recovered brief must not invent a diff');

  await page.locator('#brief-objective').fill(revisedBrief.objective);
  await page.locator('#brief-target').selectOption(revisedBrief.targetPlatform);
  assert.equal(pipelinePosts, 1, 'editing recovered fields must remain non-executing until explicit submit');

  const preflightText = await preflight.innerText();
  assert.match(preflightText, /2 brief fields changed/);
  assert.match(preflightText, /Objective:/);
  assert.match(preflightText, new RegExp(`${failedBrief.objective.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} → ${revisedBrief.objective.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  assert.match(preflightText, /Requested target: mobile → desktop/);
  assert.doesNotMatch(preflightText, /Project name:/, 'unchanged name must not be presented as changed');
  assert.doesNotMatch(preflightText, /Mechanic:/, 'unchanged mechanic must not be presented as changed');
  assert.equal(await preflight.locator('li').count(), 2, 'preflight must enumerate exactly the two changed fields');
  assert.equal(pipelinePosts, 1, 'reviewing the preflight must not execute anything');

  await page.getByRole('button', { name: 'Create playable starter' }).click();
  await page.locator('#run-message.pass').waitFor({ state: 'visible', timeout: 30_000 });
  assert.equal(pipelinePosts, 2, 'explicit submit after editing must execute exactly one additional pipeline run');
  assert.equal(executionAttempts, 2);
  assert.deepEqual(briefBodies, [failedBrief, revisedBrief]);
  assert.equal(await page.locator('#failed-retry-preflight').count(), 0, 'preflight must clear once execution is explicitly submitted');
  assert.equal(await page.locator('#brief-name').inputValue(), revisedBrief.name);
  assert.equal(await page.locator('#brief-objective').inputValue(), revisedBrief.objective);
  assert.equal(await page.locator('#brief-target').inputValue(), revisedBrief.targetPlatform);
  assert.equal(await page.locator('#brief-mechanic').inputValue(), revisedBrief.mechanic);
  await page.getByRole('link', { name: 'Download starter bundle' }).waitFor({ state: 'visible' });
  assert.equal(await page.locator('#play-result').isVisible(), true);
  await page.getByText('Verification summary', { exact: true }).waitFor({ state: 'visible' });
  assert.equal(await page.getByRole('button', { name: 'Edit before retry' }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Retry same project' }).count(), 0);

  await page.reload({ waitUntil: 'networkidle' });
  assert.match(await page.locator('#run-message').innerText(), /Recovered the latest verified run/);
  assert.equal(pipelinePosts, 2, 'successful recovery after edited retry must not execute again');
  assert.equal(await page.getByRole('button', { name: 'Edit before retry' }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Retry same project' }).count(), 0);
  assert.deepEqual(externalRequests, []);

  const evidence = {
    studioUrl,
    realSampleScaffold: true,
    forcedFailure: 'first build command exits 17',
    editBeforeRetryVisible: true,
    editPreparationExecutedPipeline: false,
    fieldsRestored: ['name', 'objective', 'targetPlatform', 'mechanic'],
    preflightVisibleBeforeRetry: true,
    preflightChangedFields: ['objective', 'targetPlatform'],
    preflightExecutionAuthority: 'none until explicit submit',
    preflightExecutedPipeline: false,
    explicitSubmitRequired: true,
    editedBriefSubmitted: revisedBrief,
    originalBrief: failedBrief,
    successfulEditedRetryVerified: true,
    staleFailureActionsClearedAfterSuccess: true,
    executionAttempts,
    pipelinePosts,
    externalRequests
  };
  await writeFile(resolve(artifactsDir, 'studio-failed-attempt-edit-evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  await page.screenshot({ path: resolve(artifactsDir, 'studio-failed-attempt-edited-retry.png'), fullPage: true });
  console.log('Studio failed-attempt edit-before-retry browser dogfood passed.');
} finally {
  await browser.close();
  await new Promise((resolvePromise) => server.close(resolvePromise));
}
