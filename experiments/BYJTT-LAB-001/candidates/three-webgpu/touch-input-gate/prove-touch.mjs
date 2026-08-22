import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const PORT = 4181;
const URL = `http://127.0.0.1:${PORT}`;
const artifacts = path.resolve('artifacts/touch-input');
await mkdir(artifacts, { recursive: true });

const server = spawn(process.execPath, [
  path.resolve('node_modules/vite/bin/vite.js'),
  'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'
], { stdio: ['ignore', 'pipe', 'pipe'] });

let serverLog = '';
server.stdout.on('data', (chunk) => { serverLog += chunk.toString(); });
server.stderr.on('data', (chunk) => { serverLog += chunk.toString(); });

const consoleErrors = [];
const pageErrors = [];
const failures = [];
let browser;
let context;
let page;
let cdp;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const response = await fetch(URL);
      if (response.ok) return;
    } catch {}
    await sleep(200);
  }
  throw new Error(`preview server failed to start\n${serverLog}`);
}

async function snapshot() {
  return page.evaluate(() => window.__BYJTT_BENCHMARK__?.snapshot?.() ?? null);
}

async function waitFor(predicate, label, timeout = 10000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const current = await snapshot();
    if (current && predicate(current)) return current;
    await page.waitForTimeout(80);
  }
  throw new Error(`timed out waiting for ${label}; final=${JSON.stringify(await snapshot())}`);
}

async function touchPoint(locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error('touch target has no visible bounding box');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function touchDown(locator, pointerId = 1) {
  const point = await touchPoint(locator);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: point.x, y: point.y, id: pointerId, radiusX: 2, radiusY: 2, force: 1 }]
  });
}

async function touchUp() {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

async function touchTap(locator) {
  const point = await touchPoint(locator);
  await page.touchscreen.tap(point.x, point.y);
  await page.waitForTimeout(50);
}

async function touchHoldUntil(locator, predicate, label, pointerId, timeout = 5000) {
  const started = Date.now();
  await touchDown(locator, pointerId);
  try {
    while (Date.now() - started < timeout) {
      const current = await snapshot();
      if (predicate(current)) return current;
      await page.waitForTimeout(80);
    }
    throw new Error(`timed out holding touch for ${label}; final=${JSON.stringify(await snapshot())}`);
  } finally {
    await touchUp();
  }
}

async function main() {
  await waitForServer();
  browser = await chromium.launch({ headless: true, channel: 'chrome' });
  context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  page = await context.newPage();
  cdp = await context.newCDPSession(page);
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(error.stack || error.message));

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  let current = await waitFor((state) => state['runtime.ready'] === true, 'runtime.ready', 15000);

  await page.evaluate(() => {
    window.__TOUCH_GATE_EVENTS__ = Object.create(null);
    for (const element of document.querySelectorAll('[data-hold], [data-tap], #save')) {
      const key = element.getAttribute('aria-label') || element.id || element.textContent?.trim() || 'unknown';
      window.__TOUCH_GATE_EVENTS__[key] = { pointerdown: 0, pointerup: 0, click: 0, pointerTypes: [] };
      for (const type of ['pointerdown', 'pointerup', 'click']) {
        element.addEventListener(type, (event) => {
          const record = window.__TOUCH_GATE_EVENTS__[key];
          record[type] += 1;
          if ('pointerType' in event && event.pointerType) record.pointerTypes.push(event.pointerType);
        }, { capture: true });
      }
    }
  });

  await page.screenshot({ path: path.join(artifacts, '01-touch-controls.png'), fullPage: true });

  const moveRight = page.getByRole('button', { name: 'Move right' });
  const beforeMove = current['player.position'];
  await touchDown(moveRight, 11);
  await page.waitForTimeout(850);
  await touchUp();
  current = await snapshot();
  const movedMetres = Math.hypot(current['player.position'].x - beforeMove.x, current['player.position'].z - beforeMove.z);
  if (!(movedMetres > 1)) failures.push(`touch movement too small: ${movedMetres}`);

  await page.waitForTimeout(650);
  const releaseStart = (await snapshot())['player.position'];
  await page.waitForTimeout(500);
  current = await snapshot();
  const releaseDrift = Math.hypot(current['player.position'].x - releaseStart.x, current['player.position'].z - releaseStart.z);
  if (!(releaseDrift <= 0.03)) failures.push(`release drift ${releaseDrift} exceeded 0.03m`);

  const pause = page.getByRole('button', { name: 'Pause' });
  await touchTap(pause);
  current = await waitFor((state) => state['paused'] === true, 'pause through touch');
  await touchTap(pause);
  current = await waitFor((state) => state['paused'] === false, 'resume through touch');

  // Put the engine-owned player in legitimate salvage attack range using only the production touch movement controls.
  current = await snapshot();
  if (current['player.position'].x < 4.15) {
    current = await touchHoldUntil(moveRight, (state) => state['player.position'].x >= 4.15, 'x approach to salvage', 21, 2500);
  }
  const moveForward = page.getByRole('button', { name: 'Move forward' });
  current = await touchHoldUntil(moveForward, (state) => state['player.position'].z <= 1.0, 'z approach to salvage', 22, 5000);
  await page.waitForTimeout(300);
  current = await snapshot();
  const salvageDistanceBeforeAttack = Math.hypot(current['player.position'].x - 5, current['player.position'].z);
  if (!(salvageDistanceBeforeAttack <= 1.8)) failures.push(`touch route did not reach salvage attack range: ${salvageDistanceBeforeAttack}`);

  const salvageHealthBeforeAttack = current['salvage.health'];
  const attack = page.getByRole('button', { name: 'Attack' });
  await touchTap(attack);
  current = await waitFor((state) => state['salvage.health'] < salvageHealthBeforeAttack, 'salvage damage through touch attack', 2000);
  const salvageHealthAfterAttack = current['salvage.health'];

  await touchTap(page.getByRole('button', { name: 'Camera left' }));
  await touchTap(page.getByRole('button', { name: 'Camera right' }));
  await touchTap(page.getByRole('button', { name: 'Interact' }));

  const save = page.locator('#save');
  await touchTap(save);
  current = await waitFor((state) => state['save.schema_version'] === 1, 'save through touch');

  const isolation = await page.evaluate(() => {
    const first = window.__BYJTT_BENCHMARK__.snapshot();
    first['player.position'].x = 999;
    const second = window.__BYJTT_BENCHMARK__.snapshot();
    return second['player.position'].x !== 999;
  });
  if (!isolation) failures.push('benchmark observation mutation leaked into engine-owned state');

  const events = await page.evaluate(() => window.__TOUCH_GATE_EVENTS__);
  for (const required of ['Move right', 'Move forward', 'Pause', 'Attack', 'Camera left', 'Camera right', 'Interact', 'save']) {
    const record = events[required];
    if (!record || record.pointerdown < 1 || record.pointerup < 1) failures.push(`missing touch pointer delivery for ${required}`);
    else if (!record.pointerTypes.includes('touch')) failures.push(`pointerType touch not observed for ${required}`);
  }

  if (consoleErrors.length) failures.push(`console errors: ${consoleErrors.join(' | ')}`);
  if (pageErrors.length) failures.push(`page errors: ${pageErrors.join(' | ')}`);

  await page.screenshot({ path: path.join(artifacts, '02-after-touch-input.png'), fullPage: true });
  current = await snapshot();

  const result = {
    candidate_id: 'three-webgpu',
    gate: 'integrated-touch-input',
    tested_revision: process.env.CANDIDATE_HEAD_SHA || process.env.GITHUB_SHA || 'local-unrecorded',
    execution_verified: failures.length === 0,
    passed: failures.length === 0,
    browser: 'Google Chrome via Playwright channel=chrome',
    viewport: { width: 390, height: 844 },
    has_touch: true,
    mobile_emulation: true,
    input_transport: 'CDP held touch + Playwright touchscreen taps',
    touch_pointer_events_executed: true,
    physical_device_executed: false,
    target_device_performance_proven: false,
    human_tested: false,
    moved_metres: movedMetres,
    release_drift_metres: releaseDrift,
    salvage_distance_before_attack_metres: salvageDistanceBeforeAttack,
    salvage_health_before_attack: salvageHealthBeforeAttack,
    salvage_health_after_attack: salvageHealthAfterAttack,
    observation_isolation: isolation,
    event_counts: events,
    final_snapshot: current,
    console_errors: consoleErrors,
    page_errors: pageErrors,
    failures
  };

  await writeFile(path.join(artifacts, 'runtime-result.json'), JSON.stringify(result, null, 2));
  await writeFile(path.join(artifacts, 'server.log'), serverLog);
  if (failures.length) throw new Error(`touch input proof failed: ${failures.join('; ')}`);
}

try {
  await main();
} catch (error) {
  failures.push(error.stack || error.message);
  const result = {
    candidate_id: 'three-webgpu',
    gate: 'integrated-touch-input',
    tested_revision: process.env.CANDIDATE_HEAD_SHA || process.env.GITHUB_SHA || 'local-unrecorded',
    execution_verified: false,
    passed: false,
    physical_device_executed: false,
    target_device_performance_proven: false,
    human_tested: false,
    console_errors: consoleErrors,
    page_errors: pageErrors,
    failures
  };
  await writeFile(path.join(artifacts, 'runtime-result.json'), JSON.stringify(result, null, 2));
  await writeFile(path.join(artifacts, 'server.log'), serverLog);
  throw error;
} finally {
  await context?.close().catch(() => {});
  await browser?.close().catch(() => {});
  server.kill('SIGTERM');
}
