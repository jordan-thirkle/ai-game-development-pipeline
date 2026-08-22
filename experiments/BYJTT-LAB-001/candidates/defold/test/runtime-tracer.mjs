import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const candidate = path.resolve(here, '..');
const bundleRoot = path.join(candidate, 'bundle');
const artifacts = path.join(candidate, 'artifacts', 'runtime-tracer');
const port = 4178;
const url = `http://127.0.0.1:${port}`;

await mkdir(artifacts, { recursive: true });

async function findIndex(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = await findIndex(full);
      if (found) return found;
    } else if (entry.name === 'index.html') {
      return full;
    }
  }
  return null;
}

const index = await findIndex(bundleRoot);
if (!index) throw new Error(`No index.html found under ${bundleRoot}`);
const webRoot = path.dirname(index);
// Chrome requests /favicon.ico independently of gameplay. Supply a local empty
// file so an incidental HTTP 404 cannot pollute the runtime error channel.
await writeFile(path.join(webRoot, 'favicon.ico'), '');

const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], {
  cwd: webRoot,
  stdio: ['ignore', 'pipe', 'pipe']
});
let serverLog = '';
server.stdout.on('data', (chunk) => { serverLog += chunk.toString(); });
server.stderr.on('data', (chunk) => { serverLog += chunk.toString(); });

async function delay(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await delay(100);
  }
  throw new Error(`Defold bundle server did not start:\n${serverLog}`);
}

let browser;
const consoleLines = [];
const consoleErrors = [];
const pageErrors = [];

async function snapshot(page) {
  return page.evaluate(() => globalThis.__BYJTT_DEFOLD ? structuredClone(globalThis.__BYJTT_DEFOLD) : null);
}

async function waitForSnapshot(page, predicate, label, timeoutMs = 15000) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < timeoutMs) {
    last = await snapshot(page);
    if (last && predicate(last)) return last;
    await page.waitForTimeout(50);
  }
  throw new Error(`Timed out waiting for ${label}; final=${JSON.stringify(last)}`);
}

try {
  await waitForServer();
  browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.on('console', (message) => {
    const line = `[${message.type()}] ${message.text()}`;
    consoleLines.push(line);
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.stack || error.message));

  const coldStarted = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const initial = await waitForSnapshot(page, (value) => value.runtime?.ready === true, 'runtime.ready');
  const startupMs = Date.now() - coldStarted;
  if (startupMs > 15000) throw new Error(`Cold start exceeded contract ceiling: ${startupMs} ms`);

  const canvas = page.locator('canvas').first();
  if (await canvas.count()) await canvas.focus();

  const before = await snapshot(page);
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1000);
  await page.keyboard.up('KeyW');
  const after = await waitForSnapshot(page, (value) => value.seq > before.seq, 'post-input observation');

  const beforePosition = before.player.position;
  const afterPosition = after.player.position;
  const movedMetres = Math.hypot(
    afterPosition[0] - beforePosition[0],
    afterPosition[1] - beforePosition[1],
    afterPosition[2] - beforePosition[2]
  );
  if (!(movedMetres > 1.0)) throw new Error(`Normal W input moved only ${movedMetres.toFixed(3)} m`);
  if (Math.abs(afterPosition[2]) > 16.0001) throw new Error(`Player left shared arena depth bound: z=${afterPosition[2]}`);

  const sequenceBeforeMutation = after.seq;
  await page.evaluate(() => {
    globalThis.__BYJTT_DEFOLD.player.position[2] = 999;
    globalThis.__BYJTT_DEFOLD.player.health = -999;
  });
  const republished = await waitForSnapshot(page, (value) => value.seq > sequenceBeforeMutation, 'engine republish after observation mutation');
  const observationIsolation = republished.player.position[2] !== 999 && republished.player.health === 100;
  if (!observationIsolation) throw new Error(`Browser observation mutation leaked into engine state: ${JSON.stringify(republished)}`);

  await page.screenshot({ path: path.join(artifacts, 'runtime-after-normal-input.png'), fullPage: true });

  if (pageErrors.length) throw new Error(`Browser page errors: ${pageErrors.join(' | ')}`);
  if (consoleErrors.length) throw new Error(`Browser console errors: ${consoleErrors.join(' | ')}`);

  const result = {
    contract_version: 1,
    scenario_id: 'mobile-action-slice-v1',
    candidate_id: 'defold',
    scope: 'runtime-toolchain-locomotion-tracer',
    tested_revision: process.env.GITHUB_SHA || 'local-unrecorded',
    candidate_head_revision: process.env.CANDIDATE_HEAD_SHA || null,
    execution_verified: true,
    browser: 'Google Chrome via Playwright channel=chrome',
    viewport: { width: 390, height: 844 },
    startup_ms: startupMs,
    initial,
    movement: {
      input: 'KeyW held for 1000 ms',
      before: beforePosition,
      after: afterPosition,
      metres: movedMetres,
      shared_walk_speed_mps: 3.5,
      shared_acceleration_mps2: 18,
      shared_deceleration_mps2: 22
    },
    observation_mutation_isolation: observationIsolation,
    page_errors: pageErrors,
    console_errors: consoleErrors,
    console_lines: consoleLines,
    deviations: [
      'Bounded tracer only: shared steps 04-13 are not claimed.',
      'Native 3D collision response is intentionally deferred to the next independent Defold slice.',
      'Greybox/no shared production assets; Phase B content fidelity is not claimed.'
    ]
  };

  await writeFile(path.join(artifacts, 'runtime-result.json'), JSON.stringify(result, null, 2));
  await writeFile(path.join(artifacts, 'browser-console.log'), consoleLines.join('\n'));
  await writeFile(path.join(artifacts, 'server.log'), serverLog);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const failure = {
    candidate_id: 'defold',
    scope: 'runtime-toolchain-locomotion-tracer',
    tested_revision: process.env.GITHUB_SHA || 'local-unrecorded',
    candidate_head_revision: process.env.CANDIDATE_HEAD_SHA || null,
    execution_verified: false,
    error: error.stack || error.message,
    page_errors: pageErrors,
    console_errors: consoleErrors,
    console_lines: consoleLines
  };
  await writeFile(path.join(artifacts, 'runtime-result.json'), JSON.stringify(failure, null, 2));
  await writeFile(path.join(artifacts, 'browser-console.log'), consoleLines.join('\n'));
  await writeFile(path.join(artifacts, 'server.log'), serverLog);
  throw error;
} finally {
  await browser?.close().catch(() => {});
  server.kill('SIGTERM');
}
