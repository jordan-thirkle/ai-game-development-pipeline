import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const PORT = 4187;
const URL = `http://127.0.0.1:${PORT}`;
const artifacts = path.resolve('artifacts/orientation-resize');
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
  for (let attempt = 0; attempt < 50; attempt += 1) {
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

async function waitFor(predicate, label, timeout = 12000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const current = await snapshot();
    if (current && predicate(current)) return current;
    await page.waitForTimeout(80);
  }
  throw new Error(`timed out waiting for ${label}; final=${JSON.stringify(await snapshot())}`);
}

async function layoutMetrics(label) {
  return page.evaluate((stage) => {
    const finiteRect = (rect) => [rect.x, rect.y, rect.width, rect.height, rect.right, rect.bottom].every(Number.isFinite);
    const rect = (element) => {
      const value = element.getBoundingClientRect();
      return {
        x: value.x,
        y: value.y,
        width: value.width,
        height: value.height,
        right: value.right,
        bottom: value.bottom,
        finite: finiteRect(value),
        visible: value.width > 0 && value.height > 0
      };
    };
    const viewport = { width: innerWidth, height: innerHeight };
    const canvas = document.querySelector('canvas');
    const controls = document.querySelector('#controls');
    const buttons = [...document.querySelectorAll('#controls button')];
    const buttonMetrics = buttons.map((button) => ({
      label: button.getAttribute('aria-label') || button.id || button.textContent?.trim() || 'unknown',
      ...rect(button)
    }));
    const canvasRect = rect(canvas);
    const controlsRect = rect(controls);
    const tolerance = 2;
    const withinViewport = (value) => value.finite && value.visible
      && value.x >= -tolerance
      && value.y >= -tolerance
      && value.right <= viewport.width + tolerance
      && value.bottom <= viewport.height + tolerance;
    return {
      stage,
      viewport,
      screen_orientation_type: screen.orientation?.type ?? null,
      screen_orientation_angle: screen.orientation?.angle ?? null,
      document_scroll_width: document.documentElement.scrollWidth,
      document_scroll_height: document.documentElement.scrollHeight,
      body_scroll_width: document.body.scrollWidth,
      body_scroll_height: document.body.scrollHeight,
      canvas: canvasRect,
      controls: controlsRect,
      buttons: buttonMetrics,
      canvas_matches_viewport: Math.abs(canvasRect.width - viewport.width) <= tolerance
        && Math.abs(canvasRect.height - viewport.height) <= tolerance,
      controls_inside_viewport: withinViewport(controlsRect),
      buttons_inside_viewport: buttonMetrics.every(withinViewport),
      touch_targets_at_least_44px: buttonMetrics.every((button) => button.width >= 44 && button.height >= 44),
      no_horizontal_overflow: document.documentElement.scrollWidth <= viewport.width + tolerance
        && document.body.scrollWidth <= viewport.width + tolerance,
      no_vertical_overflow: document.documentElement.scrollHeight <= viewport.height + tolerance
        && document.body.scrollHeight <= viewport.height + tolerance
    };
  }, label);
}

function validateLayout(metrics) {
  for (const [key, value] of Object.entries({
    canvas_matches_viewport: metrics.canvas_matches_viewport,
    controls_inside_viewport: metrics.controls_inside_viewport,
    buttons_inside_viewport: metrics.buttons_inside_viewport,
    touch_targets_at_least_44px: metrics.touch_targets_at_least_44px,
    no_horizontal_overflow: metrics.no_horizontal_overflow,
    no_vertical_overflow: metrics.no_vertical_overflow
  })) {
    if (value !== true) failures.push(`${metrics.stage}: ${key} failed (${JSON.stringify(metrics)})`);
  }
}

async function touchPoint(locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error('touch target has no visible bounding box');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function touchHold(locator, durationMs, pointerId) {
  const point = await touchPoint(locator);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: point.x, y: point.y, id: pointerId, radiusX: 2, radiusY: 2, force: 1 }]
  });
  await page.waitForTimeout(durationMs);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

async function proveMovement(locator, label, pointerId) {
  const before = await snapshot();
  await touchHold(locator, 650, pointerId);
  const after = await snapshot();
  const moved = Math.hypot(
    after['player.position'].x - before['player.position'].x,
    after['player.position'].z - before['player.position'].z
  );
  if (!(moved > 0.5)) failures.push(`${label}: touch movement too small: ${moved}`);

  await page.waitForTimeout(650);
  const releaseStart = await snapshot();
  await page.waitForTimeout(450);
  const releaseEnd = await snapshot();
  const drift = Math.hypot(
    releaseEnd['player.position'].x - releaseStart['player.position'].x,
    releaseEnd['player.position'].z - releaseStart['player.position'].z
  );
  if (!(drift <= 0.03)) failures.push(`${label}: release drift ${drift} exceeded 0.03m`);
  return { moved_metres: moved, release_drift_metres: drift };
}

async function setDeviceMetrics(width, height, type, angle) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: true,
    screenWidth: width,
    screenHeight: height,
    screenOrientation: { type, angle }
  });
  await page.waitForTimeout(600);
}

async function main() {
  await waitForServer();
  browser = await chromium.launch({ headless: true, channel: 'chrome' });
  context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 1
  });
  page = await context.newPage();
  cdp = await context.newCDPSession(page);
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(error.stack || error.message));

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitFor((state) => state['runtime.ready'] === true && state['scene.gameplay_active'] === true, 'ready production runtime', 15000);

  await page.evaluate(() => {
    window.__ORIENTATION_RESIZE_GATE__ = { resize_events: 0, orientation_events: 0 };
    addEventListener('resize', () => { window.__ORIENTATION_RESIZE_GATE__.resize_events += 1; });
    screen.orientation?.addEventListener?.('change', () => { window.__ORIENTATION_RESIZE_GATE__.orientation_events += 1; });
  });

  const portraitBefore = await layoutMetrics('portrait-before');
  validateLayout(portraitBefore);
  await page.screenshot({ path: path.join(artifacts, '01-portrait-before.png'), fullPage: true });

  await setDeviceMetrics(844, 390, 'landscapePrimary', 90);
  const landscape = await layoutMetrics('landscape');
  validateLayout(landscape);
  if (landscape.viewport.width !== 844 || landscape.viewport.height !== 390) {
    failures.push(`landscape viewport mismatch: ${JSON.stringify(landscape.viewport)}`);
  }
  await page.screenshot({ path: path.join(artifacts, '02-landscape.png'), fullPage: true });
  const landscapeMovement = await proveMovement(page.getByRole('button', { name: 'Move right' }), 'landscape', 41);

  await setDeviceMetrics(390, 844, 'portraitPrimary', 0);
  const portraitAfter = await layoutMetrics('portrait-after');
  validateLayout(portraitAfter);
  if (portraitAfter.viewport.width !== 390 || portraitAfter.viewport.height !== 844) {
    failures.push(`portrait return viewport mismatch: ${JSON.stringify(portraitAfter.viewport)}`);
  }
  await page.screenshot({ path: path.join(artifacts, '03-portrait-after.png'), fullPage: true });
  const portraitMovement = await proveMovement(page.getByRole('button', { name: 'Move backward' }), 'portrait-after', 42);

  const lifecycleEvents = await page.evaluate(() => ({ ...window.__ORIENTATION_RESIZE_GATE__ }));
  if (!(lifecycleEvents.resize_events >= 2)) failures.push(`expected >=2 resize events, observed ${lifecycleEvents.resize_events}`);

  const isolation = await page.evaluate(() => {
    const first = window.__BYJTT_BENCHMARK__.snapshot();
    first['player.position'].x = 999;
    const second = window.__BYJTT_BENCHMARK__.snapshot();
    return second['player.position'].x !== 999;
  });
  if (!isolation) failures.push('benchmark observation mutation leaked into engine-owned state');

  if (consoleErrors.length) failures.push(`console errors: ${consoleErrors.join(' | ')}`);
  if (pageErrors.length) failures.push(`page errors: ${pageErrors.join(' | ')}`);

  const result = {
    candidate_id: 'three-webgpu',
    gate: 'integrated-orientation-resize',
    tested_revision: process.env.CANDIDATE_HEAD_SHA || process.env.GITHUB_SHA || 'local-unrecorded',
    execution_verified: failures.length === 0,
    passed: failures.length === 0,
    browser: 'Google Chrome via Playwright channel=chrome',
    runtime_reloaded_during_resize_sequence: false,
    input_transport: 'CDP touch events on production controls',
    has_touch: true,
    mobile_emulation: true,
    physical_device_executed: false,
    target_device_performance_proven: false,
    human_tested: false,
    portrait_before: portraitBefore,
    landscape,
    portrait_after: portraitAfter,
    landscape_movement: landscapeMovement,
    portrait_after_movement: portraitMovement,
    lifecycle_events: lifecycleEvents,
    observation_isolation: isolation,
    final_snapshot: await snapshot(),
    console_errors: consoleErrors,
    page_errors: pageErrors,
    failures
  };

  await writeFile(path.join(artifacts, 'runtime-result.json'), JSON.stringify(result, null, 2));
  await writeFile(path.join(artifacts, 'server.log'), serverLog);
  if (failures.length) throw new Error(`orientation-resize proof failed: ${failures.join('; ')}`);
}

try {
  await main();
} catch (error) {
  failures.push(error.stack || error.message);
  const result = {
    candidate_id: 'three-webgpu',
    gate: 'integrated-orientation-resize',
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
