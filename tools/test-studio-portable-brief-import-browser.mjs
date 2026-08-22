import assert from 'node:assert/strict';
import { cp, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { createStudioBundle } from './studio-bundle.mjs';
import { runPipeline } from './run-pipeline.mjs';

const baseURL = process.env.CONTROL_PLANE_URL || 'http://127.0.0.1:4173/apps/studio/';
const artifacts = process.env.BROWSER_ARTIFACTS || 'artifacts/control-plane-browser';
const manifestPath = resolve('examples/sample-game/project.manifest.json');
const extractedStarter = resolve(artifacts, 'portable-starter-folder');
const workspace = await mkdtemp(resolve(tmpdir(), 'byjtt-portable-bundle-browser-'));
await mkdir(artifacts, { recursive: true });
await rm(extractedStarter, { recursive: true, force: true });
await mkdir(resolve(extractedStarter, 'starter', 'dist'), { recursive: true });
await copyFile(manifestPath, resolve(extractedStarter, 'starter', 'project.manifest.json'));
await writeFile(resolve(extractedStarter, 'OPEN_PROJECT.html'), '<!doctype html><title>Verified starter</title>\n');
await writeFile(resolve(extractedStarter, 'starter', 'dist', 'index.html'), '<!doctype html><title>Playable placeholder for folder selection dogfood</title>\n');

const projectDir = resolve(workspace, 'sample-game');
const outputDir = resolve(workspace, 'evidence');
await cp(resolve('examples/sample-game'), projectDir, { recursive: true });
const sampleManifest = JSON.parse(await readFile(resolve(projectDir, 'project.manifest.json'), 'utf8'));
const seedPipeline = await runPipeline({ projectDir, outputDir, dryRun: true, sourceRevision: 'portable-bundle-import-browser-dogfood' });
assert.equal(seedPipeline.status, 'pass', 'real sample pipeline did not pass before verified-bundle import dogfood');
const bundle = await createStudioBundle({ projectDir, outputDir, projectId: sampleManifest.projectId });
const archivePath = resolve(workspace, bundle.filename);
await writeFile(archivePath, bundle.bytes);
const seedBuild = JSON.parse(await readFile(resolve(outputDir, 'build-result.json'), 'utf8'));
const seedPublishing = JSON.parse(await readFile(resolve(outputDir, 'publishing-receipt.json'), 'utf8'));

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  const briefRequests = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/pipeline/brief-runs') briefRequests.push(request.postDataJSON());
  });
  await page.route('**/favicon.ico', (route) => route.fulfill({ status: 204, body: '' }));

  const response = await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  assert(response?.ok(), `Studio HTTP ${response?.status()}`);
  await page.locator('[data-view="local-run"]').click();

  assert.equal(await page.getByRole('button', { name: 'Continue from downloaded bundle' }).count(), 1, 'downloaded-bundle continuation control was not exposed');
  assert.equal(await page.getByRole('button', { name: 'Continue from extracted starter' }).count(), 1, 'extracted-starter continuation fallback was not preserved');
  assert.equal(await page.getByRole('button', { name: 'Choose starter manifest' }).count(), 1, 'direct manifest fallback was not preserved');

  const bundleInput = page.locator('#portable-starter-bundle');
  assert.equal(await bundleInput.count(), 1, 'portable starter bundle input was not exposed');
  await bundleInput.setInputFiles(archivePath);
  await page.waitForFunction(() => document.querySelector('#portable-starter-status')?.textContent.includes('Verified bundle checked locally before continuation'), null, { timeout: 5000 });
  assert.equal(briefRequests.length, 0, 'loading a downloaded verified bundle must not execute the pipeline');
  const bundleStatus = await page.locator('#portable-starter-status').textContent();
  assert.match(bundleStatus, /Build: executed-pass/i);
  assert.match(bundleStatus, /QA: executed-pass/i);
  assert.match(bundleStatus, /release candidate: dry-run-only/i);
  assert.match(bundleStatus, /publication: not-executed/i);
  assert.match(bundleStatus, /secrets: not-used/i);
  assert.match(bundleStatus, new RegExp(seedBuild.artifactSha256.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(bundleStatus, new RegExp(seedPublishing.destination.target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(bundleStatus, /historical evidence was not imported as execution authority/i);
  assert.match(bundleStatus, /Nothing was uploaded or executed/i);
  assert.equal(await page.locator('#brief-name').inputValue(), 'Pipeline Sample Game');
  assert.equal(await page.locator('#brief-objective').inputValue(), 'Prove a dependency-free build, QA, release-candidate, and publishing dry run.');
  assert.equal(await page.locator('#brief-target').inputValue(), 'web');
  assert.equal(await page.locator('#brief-mechanic').inputValue(), 'collect');
  assert.equal(await page.locator('#play-result').isVisible(), false);
  assert.equal(await page.locator('#run-evidence-panel').isVisible(), false);

  const folderInput = page.locator('#portable-starter-folder');
  await folderInput.setInputFiles(extractedStarter);
  await page.waitForFunction(() => document.querySelector('#portable-starter-status')?.textContent.includes('Planning intent loaded locally from the extracted starter folder'), null, { timeout: 5000 });
  assert.equal(briefRequests.length, 0, 'fallback folder import must also remain planning-only');
  assert.match(await page.locator('#run-message').textContent(), /Nothing has run for this imported brief/i);

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
  assert.equal(await page.getByRole('link', { name: 'Download starter bundle' }).count(), 1);
  const evidence = await page.locator('#run-evidence').textContent();
  assert.match(evidence, /Pipeline Sample Game/);
  assert.match(evidence, /Publication executed: false/);
  assert.match(evidence, /Secrets used: false/);
  assert.match(evidence, /Dry-run only: true/);

  await page.screenshot({ path: `${artifacts}/portable-starter-continuation.png`, fullPage: true });
  assert.deepEqual(errors, []);
  console.log(`Portable starter continuation dogfood passed: real verified ${bundle.filename} exposed build/QA/dry-run/non-publication/no-secret/artifact proof before continuation with zero Studio execution, extracted-folder fallback also remained zero-execution, then one explicit real local pipeline run produced passing build/QA/release evidence with no publication authority.`);
} finally {
  await browser.close();
  await rm(extractedStarter, { recursive: true, force: true });
  await rm(workspace, { recursive: true, force: true });
}
