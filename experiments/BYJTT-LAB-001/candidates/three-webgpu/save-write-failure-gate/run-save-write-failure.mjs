import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const PORT = 4187;
const URL = `http://127.0.0.1:${PORT}`;
const SAVE_KEY = 'byjtt-lab-001-three-webgpu-v1';
const artifacts = path.resolve('artifacts/save-write-failure');
await mkdir(artifacts, { recursive: true });

const server = spawn(process.execPath, [path.resolve('node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
let serverLog = '';
server.stdout.on('data', c => { serverLog += c.toString(); });
server.stderr.on('data', c => { serverLog += c.toString(); });

async function waitServer() {
  for (let i = 0; i < 40; i++) {
    try { const r = await fetch(URL); if (r.ok) return; } catch {}
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error(`preview server failed: ${serverLog}`);
}

const cases = [];
const failures = [];
const consoleErrors = [];
let browser;

async function runCase(name, domExceptionName) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(({ key, exceptionName }) => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(k, v) {
      if (k === key) throw new DOMException('Injected persistence write failure', exceptionName);
      return original.call(this, k, v);
    };
  }, { key: SAVE_KEY, exceptionName: domExceptionName });
  const page = await context.newPage();
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(`${name}: ${m.text()}`); });
  page.on('pageerror', e => consoleErrors.push(`${name}: ${e.stack || e.message}`));
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__BYJTT_BENCHMARK__?.snapshot?.()?.['runtime.ready'] === true, null, { timeout: 15000 });
  const snap = () => page.evaluate(() => window.__BYJTT_BENCHMARK__.snapshot());
  const before = await snap();
  await page.locator('#save').click();
  await page.waitForTimeout(120);
  const banner = await page.locator('#banner').textContent();
  const persisted = await page.evaluate(key => localStorage.getItem(key), SAVE_KEY);
  const afterSave = await snap();

  const start = afterSave['player.position'];
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(700);
  await page.keyboard.up('KeyD');
  await page.waitForTimeout(800);
  const stopped = await snap();
  const stopPos = stopped['player.position'];
  await page.waitForTimeout(350);
  const stable = await snap();
  const stablePos = stable['player.position'];
  const movement = Math.hypot(stopPos.x - start.x, stopPos.z - start.z);
  const releaseDrift = Math.hypot(stablePos.x - stopPos.x, stablePos.z - stopPos.z);
  const result = {
    name,
    exception: domExceptionName,
    runtime_ready_before: before['runtime.ready'] === true,
    banner,
    persisted_value: persisted,
    save_schema_after_failure: afterSave['save.schema_version'] ?? null,
    movement_metres_after_failure: movement,
    release_drift_metres: releaseDrift,
    runtime_ready_after: stable['runtime.ready'] === true,
    player_alive_after: stable['player.alive'] === true
  };
  result.passed = result.runtime_ready_before && banner === 'Save unavailable' && persisted === null && result.save_schema_after_failure === null && movement > 0.5 && releaseDrift <= 0.03 && result.runtime_ready_after && result.player_alive_after;
  if (!result.passed) failures.push(`${name}: ${JSON.stringify(result)}`);
  await page.screenshot({ path: path.join(artifacts, `${name}.png`), fullPage: true });
  cases.push(result);
  await context.close();
}

try {
  await waitServer();
  browser = await chromium.launch({ headless: true, channel: 'chrome' });
  await runCase('quota-exceeded', 'QuotaExceededError');
  await runCase('security-error', 'SecurityError');
} catch (error) {
  failures.push(error.stack || error.message);
} finally {
  await browser?.close().catch(() => {});
  server.kill('SIGTERM');
  await writeFile(path.join(artifacts, 'server.log'), serverLog);
}

const result = {
  candidate_id: 'three-webgpu',
  tested_revision: process.env.CANDIDATE_HEAD_SHA || process.env.GITHUB_SHA || 'local-unrecorded',
  production_source_modified_by_gate: false,
  storage_fault_injection_counts_as_gameplay_progress: false,
  direct_gameplay_mutation_surface_exposed: false,
  human_tested: false,
  cases,
  console_errors: consoleErrors,
  failures,
  passed: failures.length === 0 && consoleErrors.length === 0 && cases.length === 2 && cases.every(c => c.passed)
};
await writeFile(path.join(artifacts, 'runtime-result.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
if (!result.passed) process.exitCode = 1;
