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
  if (request.method() === 'POST' && ['/api/pipeline/runs', '/api/pipeline/brief-runs'].includes(url.pathname)) {
    pipelinePosts += 1;
    if (url.pathname === '/api/pipeline/brief-runs') {
      try { briefBodies.push(request.postDataJSON()); } catch {}
    }
  }
  if (['http:', 'https:'].includes(url.protocol) && !['127.0.0.1', 'localhost'].includes(url.hostname)) {
    externalRequests.push(request.url());
  }
});

const retryBrief = {
  name: 'Retry Recovery Dogfood',
  objective: 'Build a small mobile-intent collection game and safely retry the same reviewed starter after a failed local build.',
  targetPlatform: 'mobile',
  mechanic: 'collect'
};

try {
  await page.goto(studioUrl, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Run Pipeline' }).click();
  await page.locator('#brief-name').fill(retryBrief.name);
  await page.locator('#brief-objective').fill(retryBrief.objective);
  await page.locator('#creator-advanced summary').click();
  await page.locator('#brief-target').selectOption(retryBrief.targetPlatform);
  await page.locator('#brief-mechanic').selectOption(retryBrief.mechanic);
  await page.getByRole('button', { name: 'Create playable starter' }).click();
  await page.locator('#run-message.fail').waitFor({ state: 'visible' });
  await page.getByText('Failed attempt evidence', { exact: true }).waitFor({ state: 'visible' });

  const message = await page.locator('#run-message').innerText();
  assert.equal(message, 'Run stopped safely: Pipeline evidence did not pass.');

  const evidencePanel = page.locator('#run-evidence-panel');
  await assert.doesNotReject(() => evidencePanel.waitFor({ state: 'visible' }));
  const evidenceText = await evidencePanel.innerText();
  assert.match(evidenceText, /Build failed or did not produce a contained artifact/i);
  assert.match(evidenceText, /Partial evidence is retained exactly as returned by the local pipeline/);
  assert.match(evidenceText, /Intake & scaffold/);
  assert.match(evidenceText, /Tool selection/);
  assert.match(evidenceText, /Build/);
  assert.match(evidenceText, /QA evidence/);
  assert.match(evidenceText, /Pipeline run record/);
  assert.doesNotMatch(evidenceText, /Verified local starter/);

  const stages = await page.locator('[data-run-step]').evaluateAll((nodes) => Object.fromEntries(nodes.map((node) => [node.dataset.runStep, node.className])));
  assert.match(stages.intake, /pass/);
  assert.match(stages.registry, /pass/);
  assert.match(stages.build, /fail/);
  assert.match(stages.qa, /fail/);
  assert.match(stages.releaseCandidate, /blocked/);
  assert.match(stages.publishing, /blocked/);

  assert.equal(await page.locator('#play-result').isVisible(), false);
  assert.equal(await page.getByRole('link', { name: 'Download starter bundle' }).count(), 0);

  const receiptLink = page.getByRole('link', { name: 'Download failed-attempt evidence' });
  await receiptLink.waitFor({ state: 'visible' });
  const receipt = await receiptLink.evaluate(async (link) => JSON.parse(await (await fetch(link.href)).text()));
  assert.equal(receipt.kind, 'byjtt-local-failed-attempt-evidence');
  assert.equal(receipt.status, 'failed');
  assert.equal(receipt.authority.playable, false);
  assert.equal(receipt.authority.downloadableStarter, false);
  assert.equal(receipt.authority.publication, false);
  assert.equal(receipt.authority.secrets, false);
  assert.deepEqual(
    { name: receipt.brief.name, objective: receipt.brief.objective, targetPlatform: receipt.brief.targetPlatform, mechanic: receipt.brief.mechanic },
    retryBrief
  );
  assert.equal(receipt.evidence.intake.validation.status, 'pass');
  assert.ok(Array.isArray(receipt.evidence.registry.entries) && receipt.evidence.registry.entries.length > 0);
  assert.equal(receipt.evidence.build.executed, true);
  assert.equal(receipt.evidence.build.status, 'fail');
  assert.equal(receipt.evidence.qa.executed, false);
  assert.equal(receipt.evidence.qa.status, 'fail');
  assert.equal(receipt.evidence.releaseCandidate, undefined);
  assert.equal(receipt.evidence.publishing, undefined);
  assert.equal('download' in receipt, false);
  assert.equal('playable' in receipt, false);
  assert.equal(pipelinePosts, 1);
  assert.deepEqual(briefBodies, [retryBrief]);

  await page.reload({ waitUntil: 'networkidle' });
  await page.getByText('Failed attempt evidence', { exact: true }).waitFor({ state: 'visible' });
  const recoveredMessage = await page.locator('#run-message').innerText();
  assert.equal(recoveredMessage, 'Recovered the latest failed attempt from this browser tab. No rebuild was run.');
  const recoveredEvidenceText = await page.locator('#run-evidence-panel').innerText();
  assert.match(recoveredEvidenceText, /Recovered from this browser tab after refresh\. No pipeline stage was re-executed\./);
  assert.match(recoveredEvidenceText, /Build failed or did not produce a contained artifact/i);
  assert.doesNotMatch(recoveredEvidenceText, /Verified local starter/);

  const recoveredStages = await page.locator('[data-run-step]').evaluateAll((nodes) => Object.fromEntries(nodes.map((node) => [node.dataset.runStep, node.className])));
  assert.match(recoveredStages.intake, /pass/);
  assert.match(recoveredStages.registry, /pass/);
  assert.match(recoveredStages.build, /fail/);
  assert.match(recoveredStages.qa, /fail/);
  assert.match(recoveredStages.releaseCandidate, /blocked/);
  assert.match(recoveredStages.publishing, /blocked/);
  assert.equal(await page.locator('#play-result').isVisible(), false);
  assert.equal(await page.getByRole('link', { name: 'Download starter bundle' }).count(), 0);
  assert.equal(pipelinePosts, 1, 'refresh recovery must not re-run the pipeline');

  const retryButton = page.getByRole('button', { name: 'Retry same project' });
  await retryButton.waitFor({ state: 'visible' });
  await retryButton.click();
  await page.locator('#run-message.pass').waitFor({ state: 'visible', timeout: 30_000 });
  assert.equal(pipelinePosts, 2, 'retry should execute exactly one additional brief run');
  assert.equal(executionAttempts, 2);
  assert.deepEqual(briefBodies, [retryBrief, retryBrief], 'retry must submit the exact validated failed brief');
  assert.equal(await page.locator('#brief-name').inputValue(), retryBrief.name);
  assert.equal(await page.locator('#brief-objective').inputValue(), retryBrief.objective);
  assert.equal(await page.locator('#brief-target').inputValue(), retryBrief.targetPlatform);
  assert.equal(await page.locator('#brief-mechanic').inputValue(), retryBrief.mechanic);
  await page.getByRole('link', { name: 'Download starter bundle' }).waitFor({ state: 'visible' });
  assert.equal(await page.locator('#play-result').isVisible(), true);
  await page.getByText('Verification summary', { exact: true }).waitFor({ state: 'visible' });
  const successEvidence = await page.locator('#run-evidence-panel').innerText();
  assert.match(successEvidence, /Verified local starter/);
  assert.match(successEvidence, /Verification summary/);
  assert.match(successEvidence, /Publication: not executed/);
  assert.match(successEvidence, /Secrets: not used/);
  assert.equal(await page.getByRole('button', { name: 'Retry same project' }).count(), 0);

  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('#run-message.pass').waitFor({ state: 'attached' });
  assert.match(await page.locator('#run-message').innerText(), /Recovered the latest verified run/);
  assert.equal(await page.getByRole('button', { name: 'Retry same project' }).count(), 0, 'successful retry must clear stale failed-run retry state');
  assert.equal(pipelinePosts, 2, 'success recovery after retry must not execute a third run');

  const evidence = {
    studioUrl,
    realSampleScaffold: true,
    forcedFailure: 'first build command exits 17',
    failedAttemptVisible: true,
    failedReceiptDownloadable: true,
    refreshRecoveryVerified: true,
    oneClickRetryVerified: true,
    exactBriefReused: true,
    successfulRetryVerified: true,
    staleFailureClearedAfterSuccess: true,
    executionAttempts,
    pipelinePosts,
    briefBodies,
    originalPartialEvidence: {
      intake: 'pass',
      registry: 'pass',
      build: 'fail',
      qa: 'fail',
      releaseCandidate: 'blocked',
      publishing: 'blocked'
    },
    authority: receipt.authority,
    externalRequests
  };
  assert.deepEqual(externalRequests, []);
  await writeFile(resolve(artifactsDir, 'studio-failed-attempt-evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  await page.screenshot({ path: resolve(artifactsDir, 'studio-failed-attempt-retry.png'), fullPage: true });
  console.log('Studio failed-attempt recovery and one-click retry browser dogfood passed.');
} finally {
  await browser.close();
  await new Promise((resolvePromise) => server.close(resolvePromise));
}