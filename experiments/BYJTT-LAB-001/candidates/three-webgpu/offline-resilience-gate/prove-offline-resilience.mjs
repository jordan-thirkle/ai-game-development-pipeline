import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const PORT = 4193;
const URL = `http://127.0.0.1:${PORT}`;
const artifacts = path.resolve('artifacts/offline-resilience');
await mkdir(artifacts, { recursive: true });

const server = spawn(process.execPath, [
  path.resolve('node_modules/vite/bin/vite.js'),
  'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'
], { stdio: ['ignore', 'pipe', 'pipe'] });

let serverLog = '';
server.stdout.on('data', (chunk) => { serverLog += chunk.toString(); });
server.stderr.on('data', (chunk) => { serverLog += chunk.toString(); });

const failures = [];
const consoleErrors = [];
const pageErrors = [];
const requestsAfterOffline = [];
let browser;
let context;
let page;
let offlineStarted = false;

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try {
      const response = await fetch(URL);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Preview server failed to start:\n${serverLog}`);
}

async function snapshot() {
  return page.evaluate(() => window.__BYJTT_BENCHMARK__?.snapshot?.() ?? null);
}

async function waitFor(predicate, label, timeout = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const current = await snapshot();
    if (current && predicate(current)) return current;
    await page.waitForTimeout(80);
  }
  throw new Error(`Timed out waiting for ${label}; final=${JSON.stringify(await snapshot())}`);
}

function distance2d(a, b) {
  return Math.hypot(b.x - a.x, b.z - a.z);
}

async function writeResult(extraFailure = null) {
  if (extraFailure && !failures.includes(extraFailure)) failures.push(extraFailure);
  const finalSnapshot = page ? await snapshot().catch(() => null) : null;
  const result = {
    contract_version: 1,
    candidate_id: 'three-webgpu',
    gate: 'loaded-runtime-offline-resilience',
    tested_revision: process.env.CANDIDATE_HEAD_SHA || 'local-unrecorded',
    execution_verified: failures.length === 0,
    passed: failures.length === 0,
    offline_transition_executed: offlineStarted,
    first_launch_offline_proven: false,
    pwa_installability_proven: false,
    physical_device_executed: false,
    target_device_performance_proven: false,
    human_tested: false,
    console_errors: consoleErrors,
    page_errors: pageErrors,
    requests_after_offline: requestsAfterOffline,
    final_snapshot: finalSnapshot,
    failures
  };
  await writeFile(path.join(artifacts, 'runtime-result.json'), JSON.stringify(result, null, 2));
  await writeFile(path.join(artifacts, 'server.log'), serverLog);
  return result;
}

try {
  await waitForServer();
  browser = await chromium.launch({ headless: true, channel: 'chrome' });
  context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  page = await context.newPage();

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.stack || error.message));
  page.on('request', (request) => {
    if (offlineStarted) requestsAfterOffline.push({ url: request.url(), method: request.method(), resource_type: request.resourceType() });
  });

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  let current = await waitFor((s) => s['runtime.ready'] === true, 'runtime.ready');
  await page.screenshot({ path: path.join(artifacts, '01-online-ready.png'), fullPage: true });

  const beforeOffline = current['player.position'];
  await context.setOffline(true);
  offlineStarted = true;
  await page.waitForTimeout(250);

  const offlineNavigator = await page.evaluate(() => navigator.onLine);
  if (offlineNavigator !== false) failures.push('navigator.onLine did not become false after browser offline transition');

  const beforeMove = (await snapshot())['player.position'];
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(900);
  await page.keyboard.up('KeyD');
  await page.waitForTimeout(650);
  current = await snapshot();
  const movedMetres = distance2d(beforeMove, current['player.position']);
  if (!(movedMetres > 1.0)) failures.push(`offline physical movement too small: ${movedMetres}`);

  const releaseStart = current['player.position'];
  await page.waitForTimeout(700);
  current = await snapshot();
  const releaseDriftMetres = distance2d(releaseStart, current['player.position']);
  if (!(releaseDriftMetres <= 0.03)) failures.push(`offline release drift exceeded 0.03m: ${releaseDriftMetres}`);

  await page.locator('#save').click();
  current = await waitFor((s) => s['save.schema_version'] === 1, 'offline normal save path', 5000);
  if (current['save.schema_version'] !== 1) failures.push('normal save path did not complete while offline');

  const observationIsolation = await page.evaluate(() => {
    const first = window.__BYJTT_BENCHMARK__.snapshot();
    const original = first['player.position'].x;
    first['player.position'].x = 999999;
    const second = window.__BYJTT_BENCHMARK__.snapshot();
    return second['player.position'].x !== 999999 && Number.isFinite(second['player.position'].x) && second['player.position'].x !== undefined && original !== 999999;
  });
  if (!observationIsolation) failures.push('observation copy isolation failed while offline');

  const externalRequestsAfterOffline = requestsAfterOffline.filter(({ url }) => /^https?:/i.test(url) && !url.startsWith(URL));
  if (externalRequestsAfterOffline.length) failures.push(`external HTTP(S) requests attempted after offline transition: ${JSON.stringify(externalRequestsAfterOffline)}`);
  if (consoleErrors.length) failures.push(`console errors: ${JSON.stringify(consoleErrors)}`);
  if (pageErrors.length) failures.push(`page errors: ${JSON.stringify(pageErrors)}`);

  await page.screenshot({ path: path.join(artifacts, '02-offline-gameplay.png'), fullPage: true });
  const result = await writeResult();
  result.online_ready_position = beforeOffline;
  result.offline_movement = { before: beforeMove, after: current['player.position'], moved_metres: movedMetres, release_drift_metres: releaseDriftMetres };
  result.offline_save = { schema_version: current['save.schema_version'] };
  result.observation_isolation = observationIsolation;
  result.external_http_requests_after_offline = externalRequestsAfterOffline;
  result.execution_verified = failures.length === 0;
  result.passed = failures.length === 0;
  await writeFile(path.join(artifacts, 'runtime-result.json'), JSON.stringify(result, null, 2));

  if (failures.length) throw new Error(`Offline resilience gate failed: ${failures.join('; ')}`);
} catch (error) {
  const message = error?.stack || error?.message || String(error);
  await writeResult(message).catch(() => {});
  throw error;
} finally {
  await context?.setOffline(false).catch(() => {});
  await browser?.close().catch(() => {});
  server.kill('SIGTERM');
  await new Promise((resolve) => setTimeout(resolve, 150));
  if (!server.killed) server.kill('SIGKILL');
}
