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

const execute = ({ brief } = {}) => executeSampleRun({ brief, scaffold: failingScaffold });
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
page.on('request', (request) => {
  const url = new URL(request.url());
  if (!['127.0.0.1', 'localhost'].includes(url.hostname)) externalRequests.push(request.url());
});

try {
  await page.goto(studioUrl, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Run Pipeline' }).click();
  await page.getByRole('button', { name: 'Run known sample' }).click();
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
  assert.deepEqual(externalRequests, []);

  const evidence = {
    studioUrl,
    realSampleScaffold: true,
    forcedFailure: 'build command exits 17',
    failedAttemptVisible: true,
    failedReceiptDownloadable: true,
    partialEvidence: {
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
  await writeFile(resolve(artifactsDir, 'studio-failed-attempt-evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  await page.screenshot({ path: resolve(artifactsDir, 'studio-failed-attempt-evidence.png'), fullPage: true });
  console.log('Studio failed-attempt browser dogfood passed.');
} finally {
  await browser.close();
  await new Promise((resolvePromise) => server.close(resolvePromise));
}
