import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';

const PORT = 4186;
const URL = `http://127.0.0.1:${PORT}`;
const artifacts = path.resolve('artifacts/lifecycle-resume');
const expectedHead = process.env.CANDIDATE_HEAD_SHA || 'local-unrecorded';
await mkdir(artifacts, { recursive: true });

const server = spawn(process.execPath, [
  path.resolve('node_modules/vite/bin/vite.js'),
  'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'
], { stdio: ['ignore', 'pipe', 'pipe'] });

let serverLog = '';
server.stdout.on('data', (chunk) => { serverLog += chunk.toString(); });
server.stderr.on('data', (chunk) => { serverLog += chunk.toString(); });

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try {
      const response = await fetch(URL);
      if (response.ok) return;
    } catch {}
    await delay(200);
  }
  throw new Error(`preview server failed to start\n${serverLog}`);
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

let browser;
let page;
const consoleErrors = [];
const failures = [];
let result = null;

async function snapshot() {
  return page.evaluate(() => window.__BYJTT_BENCHMARK__?.snapshot?.() ?? null);
}

async function waitReady(timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const current = await snapshot();
    if (current?.['runtime.ready'] === true) return current;
    await delay(80);
  }
  throw new Error(`runtime.ready timeout; final=${JSON.stringify(await snapshot())}`);
}

async function stablePosition(waitMs = 850) {
  await delay(waitMs);
  return (await snapshot())['player.position'];
}

try {
  await waitForServer();
  browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  page = await context.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.stack || error.message));

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  const initial = await waitReady();

  const beforeMove = initial['player.position'];
  await page.keyboard.down('KeyD');
  await delay(700);
  await page.keyboard.up('KeyD');
  const afterMove = await snapshot();
  const movementBeforeFreeze = distance(beforeMove, afterMove['player.position']);
  const settledBeforeFreeze = await stablePosition();

  const observationCopy = await snapshot();
  observationCopy['player.position'].x = 99999;
  const observationFresh = await snapshot();
  const observationIsolated = observationFresh['player.position'].x !== 99999;

  const elapsedBeforeFreeze = observationFresh['elapsed_seconds'];
  const positionBeforeFreeze = observationFresh['player.position'];
  const cdp = await context.newCDPSession(page);
  const freezeStarted = Date.now();
  await cdp.send('Page.setWebLifecycleState', { state: 'frozen' });
  await delay(3000);
  const frozenWallMs = Date.now() - freezeStarted;
  await cdp.send('Page.setWebLifecycleState', { state: 'active' });
  await delay(350);
  const afterResume = await snapshot();
  const elapsedCatchup = afterResume['elapsed_seconds'] - elapsedBeforeFreeze;
  const passivePositionDrift = distance(positionBeforeFreeze, afterResume['player.position']);

  const beforePostMove = afterResume['player.position'];
  await page.keyboard.down('KeyD');
  await delay(700);
  await page.keyboard.up('KeyD');
  const afterPostMove = await snapshot();
  const movementAfterResume = distance(beforePostMove, afterPostMove['player.position']);
  const settledAfterRelease = await stablePosition();
  await delay(300);
  const final = await snapshot();
  const releaseDrift = distance(settledAfterRelease, final['player.position']);

  const p = final['player.position'];
  const finitePosition = [p.x, p.y, p.z].every(Number.isFinite);
  const insideArena = Math.abs(p.x) <= 12 && Math.abs(p.z) <= 16;
  const lifecycleCatchupBounded = elapsedCatchup >= 0 && elapsedCatchup <= 1.0;
  const freezeActuallyLong = frozenWallMs >= 2800;
  const noPassiveTeleport = passivePositionDrift <= 0.10;
  const releaseStable = releaseDrift <= 0.05;
  const movedBefore = movementBeforeFreeze > 1.0;
  const movedAfter = movementAfterResume > 1.0;
  const runtimeHealthy = final['runtime.ready'] === true && final['player.alive'] === true;
  const noClampClaim = final['physics.post_physics_arena_clamp'] !== true;

  if (!freezeActuallyLong) failures.push(`freeze wall interval too short: ${frozenWallMs}ms`);
  if (!lifecycleCatchupBounded) failures.push(`simulation catch-up exceeded bound: ${elapsedCatchup}s`);
  if (!noPassiveTeleport) failures.push(`passive position drift during freeze/resume: ${passivePositionDrift}m`);
  if (!movedBefore) failures.push(`pre-freeze KeyD movement too small: ${movementBeforeFreeze}m`);
  if (!movedAfter) failures.push(`post-resume KeyD movement too small: ${movementAfterResume}m`);
  if (!releaseStable) failures.push(`post-resume release drift too high: ${releaseDrift}m`);
  if (!observationIsolated) failures.push('observation copy mutation leaked into engine state');
  if (!finitePosition || !insideArena || !runtimeHealthy) failures.push('runtime/player state invalid after resume');
  if (!noClampClaim) failures.push('runtime reports a post-physics arena clamp');
  if (consoleErrors.length) failures.push(`browser/page errors: ${consoleErrors.join(' | ')}`);

  await page.screenshot({ path: path.join(artifacts, 'after-resume.png'), fullPage: true });
  result = {
    contract_version: 1,
    candidate_id: 'three-webgpu',
    gate_id: 'lifecycle-resume-v1',
    tested_revision: expectedHead,
    browser: 'Google Chrome via Playwright channel=chrome',
    lifecycle_control: 'CDP Page.setWebLifecycleState frozen -> active',
    frozen_wall_ms: frozenWallMs,
    elapsed_before_freeze: elapsedBeforeFreeze,
    elapsed_after_resume: afterResume['elapsed_seconds'],
    elapsed_catchup_seconds: elapsedCatchup,
    passive_position_drift_metres: passivePositionDrift,
    movement_before_freeze_metres: movementBeforeFreeze,
    movement_after_resume_metres: movementAfterResume,
    post_resume_release_drift_metres: releaseDrift,
    observation_isolated: observationIsolated,
    player_alive: final['player.alive'],
    player_position: final['player.position'],
    inside_arena: insideArena,
    post_physics_arena_clamp: final['physics.post_physics_arena_clamp'] === true,
    physical_device_backgrounding_proven: false,
    human_tested: false,
    release_ready: false,
    console_errors: consoleErrors,
    failures,
    passed: failures.length === 0
  };
} catch (error) {
  failures.push(error?.stack || error?.message || String(error));
  result = {
    contract_version: 1,
    candidate_id: 'three-webgpu',
    gate_id: 'lifecycle-resume-v1',
    tested_revision: expectedHead,
    physical_device_backgrounding_proven: false,
    human_tested: false,
    release_ready: false,
    console_errors: consoleErrors,
    failures,
    passed: false
  };
} finally {
  await writeFile(path.join(artifacts, 'runtime-result.json'), JSON.stringify(result, null, 2));
  await writeFile(path.join(artifacts, 'server.log'), serverLog);
  await page?.close().catch(() => {});
  await browser?.close().catch(() => {});
  server.kill('SIGTERM');
}

if (!result?.passed) {
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(result, null, 2));
}
