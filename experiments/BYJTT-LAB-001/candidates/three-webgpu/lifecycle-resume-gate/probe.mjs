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

async function waitForDebuggerPause(cdp, timeoutMs = 3000) {
  return await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cdp.off('Debugger.paused', onPaused);
      reject(new Error('Debugger.paused event was not observed'));
    }, timeoutMs);
    const onPaused = (event) => {
      clearTimeout(timer);
      cdp.off('Debugger.paused', onPaused);
      resolve(event);
    };
    cdp.on('Debugger.paused', onPaused);
    cdp.send('Debugger.pause').catch((error) => {
      clearTimeout(timer);
      cdp.off('Debugger.paused', onPaused);
      reject(error);
    });
  });
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
  const movementBeforeSuspend = distance(beforeMove, afterMove['player.position']);
  await stablePosition();

  const observationCopy = await snapshot();
  observationCopy['player.position'].x = 99999;
  const observationFresh = await snapshot();
  const observationIsolated = observationFresh['player.position'].x !== 99999;

  const elapsedBeforeSuspend = observationFresh['elapsed_seconds'];
  const droppedBeforeSuspend = observationFresh['simulation.dropped_seconds'];
  const stepsBeforeSuspend = observationFresh['simulation.steps'];
  const positionBeforeSuspend = observationFresh['player.position'];

  const cdp = await context.newCDPSession(page);
  await cdp.send('Debugger.enable');
  const suspendStarted = Date.now();
  const pausedEvent = await waitForDebuggerPause(cdp);
  const pauseObservedAt = Date.now();
  await delay(3000);
  const suspensionWallMs = Date.now() - pauseObservedAt;
  await cdp.send('Debugger.resume');
  await delay(350);

  const afterResume = await snapshot();
  const elapsedCatchup = afterResume['elapsed_seconds'] - elapsedBeforeSuspend;
  const droppedDelta = afterResume['simulation.dropped_seconds'] - droppedBeforeSuspend;
  const stepsDelta = afterResume['simulation.steps'] - stepsBeforeSuspend;
  const passivePositionDrift = distance(positionBeforeSuspend, afterResume['player.position']);

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
  const suspensionActuallyLong = suspensionWallMs >= 2800;
  const pauseConfirmed = Boolean(pausedEvent?.reason);
  const lifecycleCatchupBounded = elapsedCatchup >= 0 && elapsedCatchup <= 0.80;
  const simulationStepCatchupBounded = stepsDelta >= 0 && stepsDelta <= 48;
  const noPassiveTeleport = passivePositionDrift <= 0.10;
  const releaseStable = releaseDrift <= 0.05;
  const movedBefore = movementBeforeSuspend > 1.0;
  const movedAfter = movementAfterResume > 1.0;
  const runtimeHealthy = final['runtime.ready'] === true && final['player.alive'] === true;
  const noClampClaim = final['physics.post_physics_arena_clamp'] !== true;

  if (!pauseConfirmed) failures.push('CDP Debugger.paused event did not provide a pause reason');
  if (!suspensionActuallyLong) failures.push(`confirmed suspension wall interval too short: ${suspensionWallMs}ms`);
  if (!lifecycleCatchupBounded) failures.push(`simulation catch-up exceeded bound: ${elapsedCatchup}s`);
  if (!simulationStepCatchupBounded) failures.push(`simulation-step catch-up exceeded bound: ${stepsDelta} steps`);
  if (!noPassiveTeleport) failures.push(`passive position drift during suspend/resume: ${passivePositionDrift}m`);
  if (!movedBefore) failures.push(`pre-suspend KeyD movement too small: ${movementBeforeSuspend}m`);
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
    gate_id: 'execution-suspend-resume-v2',
    tested_revision: expectedHead,
    browser: 'Google Chrome via Playwright channel=chrome',
    suspension_control: 'CDP Debugger.pause -> confirmed Debugger.paused -> Debugger.resume',
    debugger_pause_reason: pausedEvent?.reason ?? null,
    pause_command_to_event_ms: pauseObservedAt - suspendStarted,
    suspension_wall_ms: suspensionWallMs,
    elapsed_before_suspend: elapsedBeforeSuspend,
    elapsed_after_resume: afterResume['elapsed_seconds'],
    elapsed_catchup_seconds: elapsedCatchup,
    simulation_steps_before_suspend: stepsBeforeSuspend,
    simulation_steps_after_resume: afterResume['simulation.steps'],
    simulation_steps_delta: stepsDelta,
    dropped_simulation_seconds_delta: droppedDelta,
    passive_position_drift_metres: passivePositionDrift,
    movement_before_suspend_metres: movementBeforeSuspend,
    movement_after_resume_metres: movementAfterResume,
    post_resume_release_drift_metres: releaseDrift,
    observation_isolated: observationIsolated,
    player_alive: final['player.alive'],
    player_position: final['player.position'],
    inside_arena: insideArena,
    post_physics_arena_clamp: final['physics.post_physics_arena_clamp'] === true,
    physical_device_backgrounding_proven: false,
    browser_lifecycle_backgrounding_proven: false,
    deterministic_execution_suspension_proven: true,
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
    gate_id: 'execution-suspend-resume-v2',
    tested_revision: expectedHead,
    physical_device_backgrounding_proven: false,
    browser_lifecycle_backgrounding_proven: false,
    deterministic_execution_suspension_proven: false,
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
