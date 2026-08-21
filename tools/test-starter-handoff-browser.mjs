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
  await mkdir(outputDir, { recursive: true });
  await mkdir(extractedDir, { recursive: true });
  const manifest = JSON.parse(await readFile(resolve(projectDir, 'project.manifest.json'), 'utf8'));

  const build = await execFile(process.execPath, ['build.mjs'], { cwd: projectDir });
  assert.match(build.stdout, /built /);
  const qa = await execFile(process.execPath, ['qa.mjs', 'dist'], { cwd: projectDir });
  assert.match(qa.stdout, /QA passed/);
  await writeFile(resolve(outputDir, 'release-candidate.json'), JSON.stringify({ dryRunOnly: true, dogfood: 'starter-handoff-browser' }, null, 2) + '\n');

  const bundle = await createStudioBundle({ projectDir, outputDir, projectId: manifest.projectId });
  const archivePath = resolve(workspace, bundle.filename);
  await writeFile(archivePath, bundle.bytes);
  await execFile('tar', ['-xzf', archivePath, '-C', extractedDir]);

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

  await page.goto(pathToFileURL(resolve(extractedDir, 'START_HERE.html')).href, { waitUntil: 'load' });
  await page.waitForURL((url) => url.protocol === 'file:' && url.pathname.endsWith('/starter/dist/index.html'));
  await page.waitForSelector('#game');
  assert.equal(await page.locator('#game').isVisible(), true, 'verified starter canvas did not become visible');
  assert.match(await page.locator('.hud').textContent(), new RegExp(manifest.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(await page.locator('#status').textContent(), /Ready to play/);
  assert.deepEqual(externalRequests, [], `offline handoff attempted network access: ${externalRequests.join(', ')}`);
  assert.deepEqual(consoleErrors, [], `offline handoff emitted browser errors: ${consoleErrors.join('; ')}`);

  await mkdir(artifacts, { recursive: true });
  const screenshotPath = resolve(artifacts, 'starter-handoff-offline.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  const screenshotSha256 = `sha256:${createHash('sha256').update(await readFile(screenshotPath)).digest('hex')}`;
  const evidence = {
    status: 'pass',
    sample: 'examples/sample-game',
    projectId: manifest.projectId,
    projectName: manifest.name,
    startEntry: 'START_HERE.html',
    verifiedPlayableEntry: 'starter/dist/index.html',
    browser: 'chrome',
    protocol: 'file:',
    externalNetworkRequests: externalRequests.length,
    bundleSha256: bundle.sha256,
    screenshotSha256
  };
  await writeFile(resolve(artifacts, 'starter-handoff-browser.json'), JSON.stringify(evidence, null, 2) + '\n');
  await page.close();
  console.log(`Starter handoff browser dogfood passed: ${JSON.stringify(evidence)}`);
} finally {
  if (browser) await browser.close();
  await rm(workspace, { recursive: true, force: true });
}
