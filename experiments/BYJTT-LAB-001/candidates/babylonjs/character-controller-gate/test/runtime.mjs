import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const evidenceDir = path.resolve(process.env.EVIDENCE_DIR || 'artifacts/babylon-character-controller');
await mkdir(evidenceDir, { recursive: true });

const serverLog = [];
const server = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['exec', '--', 'vite', '--host', '127.0.0.1', '--port', '4173'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: process.env,
});
server.stdout.on('data', (chunk) => serverLog.push(chunk.toString()));
server.stderr.on('data', (chunk) => serverLog.push(chunk.toString()));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let browser;
const browserErrors = [];
let result;
try {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch('http://127.0.0.1:4173');
      if (response.ok) break;
    } catch {}
    if (attempt === 59) throw new Error('Vite server did not become ready');
    await sleep(250);
  }

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', (error) => browserErrors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`);
  });

  await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__BYJTT_BABYLON_CC__?.snapshot().ready === true, null, { timeout: 30_000 });
  const start = await page.evaluate(() => window.__BYJTT_BABYLON_CC__.snapshot());
  await page.screenshot({ path: path.join(evidenceDir, 'before-input.png'), fullPage: true });

  await page.keyboard.down('KeyD');
  await sleep(4200);
  await page.keyboard.up('KeyD');
  await sleep(250);
  const release = await page.evaluate(() => window.__BYJTT_BABYLON_CC__.snapshot());
  await sleep(1000);
  const final = await page.evaluate(() => window.__BYJTT_BABYLON_CC__.snapshot());

  const isolation = await page.evaluate(() => {
    const copy = window.__BYJTT_BABYLON_CC__.snapshot();
    copy.position.x = 999;
    copy.logical_ground_position.x = 999;
    const authoritative = window.__BYJTT_BABYLON_CC__.snapshot();
    return authoritative.position.x !== 999 && authoritative.logical_ground_position.x !== 999;
  });
  await page.screenshot({ path: path.join(evidenceDir, 'after-release.png'), fullPage: true });

  const expected = final.expected_east_center_x;
  const releaseDrift = Math.abs(final.position.x - release.position.x);
  const stopError = Math.abs(final.position.x - expected);
  const nonPenetrating = final.max_x <= expected + 0.12;
  const nativeWallStop = final.position.x >= expected - 0.18 && final.position.x <= expected + 0.12;
  const externalInput = final.key_down_callbacks >= 1 && final.key_up_callbacks >= 1 && final.external_input_executed === true;
  const passed = browserErrors.length === 0
    && nativeWallStop
    && nonPenetrating
    && releaseDrift <= 0.03
    && isolation
    && externalInput
    && final.post_physics_arena_clamp === false
    && final.controller === 'PhysicsCharacterController'
    && final.render_frames > 0
    && final.simulation_steps > 0;

  result = {
    status: passed ? 'pass' : 'runtime-failed',
    passed,
    controller: final.controller,
    start,
    release,
    final,
    expected_east_center_x: expected,
    stop_error_m: stopError,
    release_drift_m: releaseDrift,
    native_wall_stop: nativeWallStop,
    non_penetrating: nonPenetrating,
    observation_copy_isolation: isolation,
    external_input: externalInput,
    browser_errors: browserErrors,
  };
  await writeFile(path.join(evidenceDir, 'runtime-result.json'), `${JSON.stringify(result, null, 2)}\n`);
  if (!passed) throw new Error(`runtime assertions failed: ${JSON.stringify(result)}`);
} catch (error) {
  if (!result) {
    result = { status: 'execution-error', passed: false, error: error instanceof Error ? error.stack || error.message : String(error), browser_errors: browserErrors };
    await writeFile(path.join(evidenceDir, 'runtime-result.json'), `${JSON.stringify(result, null, 2)}\n`);
  }
  throw error;
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
  await writeFile(path.join(evidenceDir, 'vite.log'), serverLog.join(''));
}
