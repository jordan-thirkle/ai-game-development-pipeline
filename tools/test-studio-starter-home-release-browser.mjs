import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile as execFileCallback } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { chromium } from 'playwright';
import { createStudioBundle } from './studio-bundle.mjs';
import { runPipeline } from './run-pipeline.mjs';

const execFile = promisify(execFileCallback);
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = resolve(process.env.BROWSER_ARTIFACTS || 'artifacts/control-plane-browser');
const workspace = await mkdtemp(resolve(tmpdir(), 'byjtt-starter-home-release-browser-'));
let browser;

try {
  const projectDir = resolve(workspace, 'sample-game');
  const outputDir = resolve(workspace, 'evidence');
  const extractedDir = resolve(workspace, 'extracted');
  await cp(resolve(repositoryRoot, 'examples/sample-game'), projectDir, { recursive: true });
  await mkdir(extractedDir, { recursive: true });
  const manifest = JSON.parse(await readFile(resolve(projectDir, 'project.manifest.json'), 'utf8'));

  const pipeline = await runPipeline({ projectDir, outputDir, dryRun: true, sourceRevision: 'starter-home-release-browser-dogfood' });
  assert.equal(pipeline.status, 'pass');
  const buildResult = JSON.parse(await readFile(resolve(outputDir, 'build-result.json'), 'utf8'));
  const qaResult = JSON.parse(await readFile(resolve(outputDir, 'qa-result.json'), 'utf8'));
  const releaseCandidate = JSON.parse(await readFile(resolve(outputDir, 'release-candidate.json'), 'utf8'));
  const publishingReceipt = JSON.parse(await readFile(resolve(outputDir, 'publishing-receipt.json'), 'utf8'));
  assert.equal(buildResult.executed, true);
  assert.equal(buildResult.status, 'pass');
  assert.equal(qaResult.executed, true);
  assert.equal(qaResult.status, 'pass');
  assert.equal(buildResult.artifactSha256, qaResult.artifactSha256);
  assert.equal(qaResult.artifactSha256, releaseCandidate.build.outputSha256);
  assert.equal(releaseCandidate.dryRunOnly, true);
  assert.equal(releaseCandidate.destination?.kind, 'local');
  assert.equal(releaseCandidate.destination?.target, publishingReceipt.destination?.target);
  assert.equal(publishingReceipt.executed, false);
  assert.equal(publishingReceipt.secretsUsed, false);

  const bundle = await createStudioBundle({ projectDir, outputDir, projectId: manifest.projectId });
  const archivePath = resolve(workspace, bundle.filename);
  await writeFile(archivePath, bundle.bytes);
  await execFile('tar', ['-xzf', archivePath, '-C', extractedDir]);

  browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const externalRequests = [];
  const browserErrors = [];
  page.on('request', (request) => { if (/^https?:/i.test(request.url())) externalRequests.push(request.url()); });
  page.on('console', (message) => { if (message.type() === 'error') browserErrors.push(message.text()); });
  page.on('pageerror', (error) => browserErrors.push(error.message));

  await page.goto(pathToFileURL(resolve(extractedDir, 'OPEN_PROJECT.html')).href, { waitUntil: 'load' });
  const qaPanel = page.locator('[aria-label="QA artifact proof"]');
  await qaPanel.waitFor({ state: 'visible' });
  const qaText = (await qaPanel.textContent()) ?? '';
  assert.match(qaText, /The same bytes passed build, QA, and promotion/);
  assert.match(qaText, /Build.*executed · pass/s);
  assert.match(qaText, /QA.*executed · pass/s);
  assert.match(qaText, new RegExp(buildResult.artifactSha256.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(qaText, new RegExp(qaResult.artifactSha256.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(qaText, new RegExp(releaseCandidate.build.outputSha256.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(qaText, /fails closed if those artifact identities disagree/);

  const panel = page.locator('[aria-label="Release candidate"]');
  await panel.waitFor({ state: 'visible' });
  const text = (await panel.textContent()) ?? '';
  assert.match(text, /What QA actually promoted/);
  assert.match(text, new RegExp(releaseCandidate.candidateId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(text, /dry-run only/);
  assert.match(text, new RegExp(releaseCandidate.build.artifactPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(text, new RegExp(releaseCandidate.destination.target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(text, new RegExp(releaseCandidate.build.outputSha256.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(text, /does not grant publishing authority/);
  assert.deepEqual(externalRequests, []);
  assert.deepEqual(browserErrors, []);

  await mkdir(artifacts, { recursive: true });
  const screenshotPath = resolve(artifacts, 'starter-home-release-candidate.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  const screenshotSha256 = `sha256:${createHash('sha256').update(await readFile(screenshotPath)).digest('hex')}`;
  const evidence = {
    status: 'pass',
    sample: 'examples/sample-game',
    projectId: manifest.projectId,
    pipelineStatus: pipeline.status,
    qaArtifactProofBrowserVerified: true,
    buildArtifactSha256: buildResult.artifactSha256,
    qaArtifactSha256: qaResult.artifactSha256,
    releaseCandidateBrowserVerified: true,
    candidateId: releaseCandidate.candidateId,
    artifactPath: releaseCandidate.build.artifactPath,
    destination: releaseCandidate.destination.target,
    candidateSha256: releaseCandidate.build.outputSha256,
    dryRunOnly: releaseCandidate.dryRunOnly,
    publicationExecuted: publishingReceipt.executed,
    secretsUsed: publishingReceipt.secretsUsed,
    externalNetworkRequests: externalRequests.length,
    bundleSha256: bundle.sha256,
    screenshotSha256
  };
  await writeFile(resolve(artifacts, 'starter-home-release-candidate.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log(`Starter-home release candidate dogfood passed: ${JSON.stringify(evidence)}`);
} finally {
  if (browser) await browser.close();
  await rm(workspace, { recursive: true, force: true });
}
