import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const candidateRoot = path.resolve('.');
const artifactsDir = path.join(candidateRoot, 'artifacts', 'human-alpha');
const packageDir = path.join(artifactsDir, 'package');
const port = 4175;
const url = `http://127.0.0.1:${port}`;
await mkdir(artifactsDir, { recursive: true });

const server = spawn(process.execPath, ['serve.mjs', '--host', '127.0.0.1', '--port', String(port)], {
  cwd: packageDir,
  stdio: ['ignore', 'pipe', 'pipe']
});
let serverLog = '';
server.stdout.on('data', (chunk) => { serverLog += chunk.toString(); });
server.stderr.on('data', (chunk) => { serverLog += chunk.toString(); });

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) throw new Error(`Packaged server exited early (${server.exitCode}):\n${serverLog}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Packaged server did not become ready:\n${serverLog}`);
}

let browser;
let page;
const consoleErrors = [];
const pageErrors = [];
const failures = [];
const observations = {};

async function snapshot() {
  return page.evaluate(() => window.__BYJTT_BENCHMARK__?.snapshot?.() ?? null);
}

async function waitForSnapshot(predicate, label, timeoutMs = 10000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const current = await snapshot().catch(() => null);
    if (current && predicate(current)) return current;
    await page.waitForTimeout(80);
  }
  throw new Error(`Timed out waiting for ${label}; final=${JSON.stringify(await snapshot().catch(() => null))}`);
}

try {
  await waitForServer();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
  if (!response?.ok()) failures.push(`initial navigation status=${response?.status() ?? 'none'}`);

  const initial = await waitForSnapshot(
    (value) => value['player.position'] && value['renderer.backend'] && value['elapsed_seconds'] >= 0,
    'candidate observation bridge'
  );
  observations.renderer_backend = initial['renderer.backend'];
  observations.navigator_gpu = initial['renderer.navigator_gpu'] ?? null;
  observations.initial_position = initial['player.position'];
  observations.initial_elapsed_seconds = initial['elapsed_seconds'];
  observations.canvas_count = await page.locator('canvas').count();
  observations.canvas_visible = observations.canvas_count > 0
    ? await page.locator('canvas').first().isVisible()
    : false;

  await page.screenshot({ path: path.join(artifactsDir, 'human-alpha-before.png'), fullPage: true });

  const startX = Number(initial['player.position'].x);
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(700);
  await page.keyboard.up('KeyD');
  const moved = await waitForSnapshot(
    (value) => Math.abs(Number(value['player.position']?.x) - startX) >= 0.25,
    'normal KeyD movement'
  );
  observations.moved_position = moved['player.position'];
  observations.movement_delta_x = Number(moved['player.position'].x) - startX;

  await page.waitForTimeout(600);
  const released = await snapshot();
  await page.waitForTimeout(600);
  const stable = await snapshot();
  observations.release_position = released['player.position'];
  observations.stable_position = stable['player.position'];
  observations.release_drift = Math.hypot(
    Number(stable['player.position'].x) - Number(released['player.position'].x),
    Number(stable['player.position'].z) - Number(released['player.position'].z)
  );
  observations.final_elapsed_seconds = stable['elapsed_seconds'];

  await page.screenshot({ path: path.join(artifactsDir, 'human-alpha-after.png'), fullPage: true });

  if (!observations.canvas_visible) failures.push('render canvas is not visible');
  if (!observations.renderer_backend || observations.renderer_backend === 'unknown') failures.push('renderer backend is unknown');
  if (Math.abs(observations.movement_delta_x) < 0.25) failures.push('normal KeyD input did not move engine-owned player state');
  if (observations.release_drift > 0.12) failures.push(`release drift ${observations.release_drift} exceeds 0.12 m`);
  if (consoleErrors.length) failures.push(`console errors: ${consoleErrors.join(' | ')}`);
  if (pageErrors.length) failures.push(`page errors: ${pageErrors.join(' | ')}`);
} catch (error) {
  failures.push(error instanceof Error ? error.stack || error.message : String(error));
} finally {
  if (browser) await browser.close().catch(() => {});
  server.kill('SIGTERM');
  await new Promise((resolve) => {
    if (server.exitCode !== null) return resolve();
    const timer = setTimeout(() => { server.kill('SIGKILL'); resolve(); }, 2000);
    server.once('exit', () => { clearTimeout(timer); resolve(); });
  });
}

const packageResult = JSON.parse(await readFile(path.join(artifactsDir, 'package-result.json'), 'utf8'));
const result = {
  schema_version: 1,
  benchmark_id: 'BYJTT-LAB-001',
  candidate_id: 'three-webgpu',
  tested_revision: process.env.CANDIDATE_HEAD_SHA || process.env.GITHUB_SHA || 'local-unrecorded',
  package_source_revision: packageResult.source_revision,
  package_ready: packageResult.package_ready === true,
  packaged_runtime_executed: observations.initial_position != null,
  physical_keyboard_input_executed: observations.moved_position != null,
  human_tested: false,
  publication_state: 'not-published',
  observations,
  console_errors: consoleErrors,
  page_errors: pageErrors,
  failures,
  passed: failures.length === 0
};
await writeFile(path.join(artifactsDir, 'runtime-result.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
await writeFile(path.join(artifactsDir, 'packaged-server.log'), serverLog, 'utf8');
console.log(JSON.stringify(result, null, 2));
if (!result.passed) process.exitCode = 1;
