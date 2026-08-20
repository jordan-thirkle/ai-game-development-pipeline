import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile as execFileCallback } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { gunzipSync } from 'node:zlib';
import { chromium } from 'playwright';
import { createStudioBundle } from './studio-bundle.mjs';

const execFile = promisify(execFileCallback);
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = resolve(process.env.BROWSER_ARTIFACTS || 'artifacts/control-plane-browser');

function readTarEntries(bytes) {
  const tar = gunzipSync(bytes);
  const entries = new Map();
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '');
    const sizeText = header.subarray(124, 136).toString('ascii').replace(/\0.*$/, '').trim();
    const size = Number.parseInt(sizeText || '0', 8);
    assert(Number.isSafeInteger(size) && size >= 0, `invalid TAR size for ${name}`);
    const bodyStart = offset + 512;
    entries.set(name, Buffer.from(tar.subarray(bodyStart, bodyStart + size)));
    offset = bodyStart + Math.ceil(size / 512) * 512;
  }
  return entries;
}

const workspace = await mkdtemp(resolve(tmpdir(), 'byjtt-starter-handoff-browser-'));
let browser;
try {
  const projectDir = resolve(workspace, 'sample-game');
  const outputDir = resolve(workspace, 'evidence');
  const extractedDir = resolve(workspace, 'extracted');
  await cp(resolve(repositoryRoot, 'examples/sample-game'), projectDir, { recursive: true });
  await mkdir(outputDir, { recursive: true });
  await mkdir(extractedDir, { recursive: true });

  const build = await execFile(process.execPath, ['build.mjs'], { cwd: projectDir });
  assert.match(build.stdout, /built /);
  const qa = await execFile(process.execPath, ['qa.mjs', 'dist'], { cwd: projectDir });
  assert.match(qa.stdout, /QA passed/);
  await writeFile(resolve(outputDir, 'release-candidate.json'), JSON.stringify({ dryRunOnly: true, dogfood: 'starter-handoff-browser' }, null, 2) + '\n');

  const bundle = await createStudioBundle({ projectDir, outputDir, projectId: 'harbour-run' });
  const entries = readTarEntries(bundle.bytes);
  for (const name of ['START_HERE.html', 'starter/dist/index.html']) {
    const body = entries.get(name);
    assert(body, `bundle missing ${name}`);
    const destination = resolve(extractedDir, name);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, body);
  }

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
  assert.match(await page.locator('.hud').textContent(), /Harbour Run/);
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
