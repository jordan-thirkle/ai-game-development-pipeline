import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile as execFileCallback } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { chromium } from 'playwright';
import { createStudioBundle } from './studio-bundle.mjs';
import { runPipeline } from './run-pipeline.mjs';

const execFile = promisify(execFileCallback);
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = resolve(process.env.BROWSER_ARTIFACTS || 'artifacts/control-plane-browser');

const workspace = await mkdtemp(resolve(tmpdir(), 'byjtt-starter-handoff-browser-'));
let browser;
try {
  const projectDir = resolve(workspace, 'sample-game');
  const outputDir = resolve(workspace, 'evidence');
  const extractedDir = resolve(workspace, 'extracted');
  await cp(resolve(repositoryRoot, 'examples/sample-game'), projectDir, { recursive: true });
  await mkdir(extractedDir, { recursive: true });
  const manifest = JSON.parse(await readFile(resolve(projectDir, 'project.manifest.json'), 'utf8'));

  const pipeline = await runPipeline({ projectDir, outputDir, dryRun: true, sourceRevision: 'starter-handoff-browser-dogfood' });
  assert.equal(pipeline.status, 'pass', 'real sample pipeline did not pass before handoff packaging');

  const bundle = await createStudioBundle({ projectDir, outputDir, projectId: manifest.projectId });
  const archivePath = resolve(workspace, bundle.filename);
  await writeFile(archivePath, bundle.bytes);
  await execFile('tar', ['-xzf', archivePath, '-C', extractedDir]);

  const verificationText = await readFile(resolve(extractedDir, 'VERIFICATION.txt'), 'utf8');
  assert.match(verificationText, /Build executed: true/);
  assert.match(verificationText, /Build status: pass/);
  assert.match(verificationText, /QA executed: true/);
  assert.match(verificationText, /QA status: pass/);
  assert.match(verificationText, /Release candidate dry-run only: true/);
  assert.match(verificationText, /Publication executed: false/);
  assert.match(verificationText, /Secrets used: false/);
  assert.match(verificationText, /Destination kind: local/);
  assert.match(verificationText, /Destination: local:\/\//);

  browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const externalRequests = [];
  const consoleErrors = [];
  page.on('request', (request) => {
    if (/^https?:/i.test(request.url())) externalRequests.push(request.url());
  });
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto(pathToFileURL(resolve(extractedDir, 'VERIFICATION.html')).href, { waitUntil: 'load' });
  await page.waitForSelector('h1');
  assert.equal(await page.locator('h1').textContent(), 'Verified local starter');
  const facts = await page.locator('.fact').evaluateAll((nodes) => Object.fromEntries(nodes.map((node) => [
    node.querySelector('dt')?.textContent?.trim(),
    node.querySelector('dd')?.textContent?.trim()
  ])));
  assert.equal(facts.Build, 'pass · executed');
  assert.equal(facts.QA, 'pass · executed');
  assert.equal(facts['Release candidate'], 'dry-run only');
  assert.equal(facts.Publication, 'not executed');
  assert.equal(facts.Secrets, 'not used');
  assert.match(facts.Destination, /^local · local:\/\//);
  assert.match(await page.locator('.boundary').textContent(), /does not claim store\/provider publication/);
  const playableLink = page.getByRole('link', { name: 'Open verified starter' });
  const projectBriefLink = page.getByRole('link', { name: 'View project brief' });
  assert.equal(await playableLink.getAttribute('href'), 'starter/dist/index.html');
  assert.equal(await projectBriefLink.getAttribute('href'), 'PROJECT_BRIEF.html');
  assert.equal(await page.getByRole('link', { name: 'Open plain-text verification' }).getAttribute('href'), 'VERIFICATION.txt');
  assert.deepEqual(externalRequests, [], `verification page attempted network access: ${externalRequests.join(', ')}`);
  assert.deepEqual(consoleErrors, [], `verification page emitted browser errors: ${consoleErrors.join('; ')}`);

  await projectBriefLink.click();
  await page.waitForURL((url) => url.protocol === 'file:' && url.pathname.endsWith('/PROJECT_BRIEF.html'));
  assert.equal(await page.locator('h1').textContent(), manifest.name);
  assert.match(await page.locator('.lead').textContent(), new RegExp(manifest.objective.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(await page.locator('.panel').textContent(), new RegExp(manifest.starter.mechanic));
  assert.match(await page.locator('.panel').textContent(), new RegExp(`${manifest.starter.requestedTargetPlatform}.*${manifest.starter.executedTargetPlatform}`, 'i'));
  assert.equal(await page.getByRole('link', { name: 'Open verified starter' }).getAttribute('href'), 'START_HERE.html');
  assert.equal(await page.getByRole('link', { name: 'View verification' }).getAttribute('href'), 'VERIFICATION.html');
  assert.deepEqual(externalRequests, [], `project brief attempted network access: ${externalRequests.join(', ')}`);
  assert.deepEqual(consoleErrors, [], `project brief emitted browser errors: ${consoleErrors.join('; ')}`);

  await page.goto(pathToFileURL(resolve(extractedDir, 'VERIFICATION.html')).href, { waitUntil: 'load' });
  await page.getByRole('link', { name: 'Open verified starter' }).click();
  await page.waitForURL((url) => url.protocol === 'file:' && url.pathname.endsWith('/starter/dist/index.html'));
  await page.waitForSelector('#game');
  assert.equal(await page.locator('#game').isVisible(), true, 'verified starter canvas did not become visible from verification page');
  assert.match(await page.locator('.hud').textContent(), new RegExp(manifest.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(await page.locator('#status').textContent(), /Ready to play/);

  await page.goto(pathToFileURL(resolve(extractedDir, 'START_HERE.html')).href, { waitUntil: 'load' });
  await page.waitForURL((url) => url.protocol === 'file:' && url.pathname.endsWith('/starter/dist/index.html'));
  await page.waitForSelector('#game');
  assert.equal(await page.locator('#game').isVisible(), true, 'zero-terminal START_HERE handoff regressed');
  assert.deepEqual(externalRequests, [], `offline handoff attempted network access: ${externalRequests.join(', ')}`);
  assert.deepEqual(consoleErrors, [], `offline handoff emitted browser errors: ${consoleErrors.join('; ')}`);

  await mkdir(artifacts, { recursive: true });
  const screenshotPath = resolve(artifacts, 'starter-handoff-offline.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  const screenshotSha256 = `sha256:${createHash('sha256').update(await readFile(screenshotPath)).digest('hex')}`;
  const verificationScreenshotPath = resolve(artifacts, 'starter-verification-offline.png');
  await page.goto(pathToFileURL(resolve(extractedDir, 'VERIFICATION.html')).href, { waitUntil: 'load' });
  await page.screenshot({ path: verificationScreenshotPath, fullPage: true });
  const verificationScreenshotSha256 = `sha256:${createHash('sha256').update(await readFile(verificationScreenshotPath)).digest('hex')}`;
  const briefScreenshotPath = resolve(artifacts, 'starter-project-brief-offline.png');
  await page.goto(pathToFileURL(resolve(extractedDir, 'PROJECT_BRIEF.html')).href, { waitUntil: 'load' });
  await page.screenshot({ path: briefScreenshotPath, fullPage: true });
  const briefScreenshotSha256 = `sha256:${createHash('sha256').update(await readFile(briefScreenshotPath)).digest('hex')}`;
  const evidence = {
    status: 'pass',
    sample: 'examples/sample-game',
    projectId: manifest.projectId,
    projectName: manifest.name,
    pipelineStatus: pipeline.status,
    projectBriefEntry: 'PROJECT_BRIEF.html',
    projectBriefRendered: true,
    projectBriefRequestedTarget: manifest.starter.requestedTargetPlatform,
    projectBriefExecutedTarget: manifest.starter.executedTargetPlatform,
    verificationEntry: 'VERIFICATION.html',
    plainTextVerificationEntry: 'VERIFICATION.txt',
    verificationPageRendered: true,
    verificationToPlayable: true,
    startEntry: 'START_HERE.html',
    verifiedPlayableEntry: 'starter/dist/index.html',
    browser: 'chrome',
    protocol: 'file:',
    externalNetworkRequests: externalRequests.length,
    bundleSha256: bundle.sha256,
    screenshotSha256,
    verificationScreenshotSha256,
    briefScreenshotSha256
  };
  await writeFile(resolve(artifacts, 'starter-handoff-browser.json'), JSON.stringify(evidence, null, 2) + '\n');
  await page.close();
  console.log(`Starter handoff browser dogfood passed: ${JSON.stringify(evidence)}`);
} finally {
  if (browser) await browser.close();
  await rm(workspace, { recursive: true, force: true });
}