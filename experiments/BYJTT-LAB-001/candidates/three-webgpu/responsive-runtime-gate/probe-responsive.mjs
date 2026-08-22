import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const CANDIDATE_HEAD = process.env.CANDIDATE_HEAD_SHA || 'local-unrecorded';
const ARTIFACTS = path.resolve('artifacts/responsive-runtime');
const PORT = 4188;
const URL = `http://127.0.0.1:${PORT}`;
await mkdir(ARTIFACTS, { recursive: true });

const server = spawn(process.execPath, [
  path.resolve('node_modules/vite/bin/vite.js'),
  'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'
], { stdio: ['ignore', 'pipe', 'pipe'] });
let serverLog = '';
server.stdout.on('data', (chunk) => { serverLog += chunk.toString(); });
server.stderr.on('data', (chunk) => { serverLog += chunk.toString(); });

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const response = await fetch(URL);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Preview server failed to start:\n${serverLog}`);
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

async function runViewport(browser, spec) {
  const context = await browser.newContext({ viewport: spec.viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(`console:${message.text()}`); });
  page.on('pageerror', (error) => errors.push(`page:${error.stack || error.message}`));

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__BYJTT_BENCHMARK__?.snapshot?.()?.['runtime.ready'] === true, null, { timeout: 15000 });

  const before = await page.evaluate(() => window.__BYJTT_BENCHMARK__.snapshot());
  const layout = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const controls = document.querySelector('#controls');
    const actionable = [...document.querySelectorAll('#controls button')];
    const viewport = { width: innerWidth, height: innerHeight };
    const rect = (node) => {
      const r = node?.getBoundingClientRect();
      return r ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height } : null;
    };
    const controlRects = actionable.map((button) => ({ label: button.getAttribute('aria-label') || button.textContent?.trim() || button.id, rect: rect(button) }));
    return {
      viewport,
      documentScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      canvas: rect(canvas),
      controls: rect(controls),
      controlRects,
      visibleCanvas: Boolean(canvas && canvas.getClientRects().length && getComputedStyle(canvas).visibility !== 'hidden')
    };
  });

  const inside = (r) => r && r.left >= -1 && r.top >= -1 && r.right <= layout.viewport.width + 1 && r.bottom <= layout.viewport.height + 1;
  const clippedControls = layout.controlRects.filter(({ rect }) => !inside(rect));
  const noHorizontalOverflow = Math.max(layout.documentScrollWidth, layout.bodyScrollWidth) <= layout.viewport.width + 1;
  const canvasFillsViewport = layout.canvas && Math.abs(layout.canvas.width - layout.viewport.width) <= 2 && Math.abs(layout.canvas.height - layout.viewport.height) <= 2;

  await page.keyboard.down('KeyD');
  await page.waitForTimeout(700);
  await page.keyboard.up('KeyD');
  const afterMove = await page.evaluate(() => window.__BYJTT_BENCHMARK__.snapshot());
  await page.waitForTimeout(700);
  const afterRelease = await page.evaluate(() => window.__BYJTT_BENCHMARK__.snapshot());
  const movedMetres = distance(before['player.position'], afterMove['player.position']);
  const releaseDriftMetres = distance(afterMove['player.position'], afterRelease['player.position']);

  const copyIsolation = await page.evaluate(() => {
    const first = window.__BYJTT_BENCHMARK__.snapshot();
    first['player.position'].x = 9999;
    const second = window.__BYJTT_BENCHMARK__.snapshot();
    return second['player.position'].x !== 9999;
  });

  await page.screenshot({ path: path.join(ARTIFACTS, `${spec.id}.png`), fullPage: true });
  const result = {
    id: spec.id,
    viewport: layout.viewport,
    renderer: before['renderer.backend'],
    navigator_gpu: before['renderer.navigator_gpu'],
    visible_canvas: layout.visibleCanvas,
    canvas_fills_viewport: Boolean(canvasFillsViewport),
    no_horizontal_overflow: noHorizontalOverflow,
    controls_contained: clippedControls.length === 0,
    clipped_controls: clippedControls,
    moved_metres: movedMetres,
    release_drift_metres: releaseDriftMetres,
    observation_copy_isolated: copyIsolation,
    errors,
    passed: layout.visibleCanvas && Boolean(canvasFillsViewport) && noHorizontalOverflow && clippedControls.length === 0 && movedMetres > 1 && releaseDriftMetres <= 0.05 && copyIsolation && errors.length === 0
  };
  await context.close();
  return result;
}

let browser;
let finalResult;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const cases = [
    { id: 'portrait-390x844', viewport: { width: 390, height: 844 } },
    { id: 'landscape-844x390', viewport: { width: 844, height: 390 } }
  ];
  const results = [];
  for (const spec of cases) results.push(await runViewport(browser, spec));
  finalResult = {
    candidate_id: 'three-webgpu',
    candidate_head_revision: CANDIDATE_HEAD,
    execution_verified: results.every((entry) => entry.passed),
    responsive_browser_runtime_proven: results.every((entry) => entry.passed),
    physical_device_executed: false,
    human_tested: false,
    target_device_performance_proven: false,
    accessibility_conformance_claimed: false,
    publication_state: 'not-published',
    results,
    failures: results.flatMap((entry) => entry.passed ? [] : [`${entry.id} failed`])
  };
  await writeFile(path.join(ARTIFACTS, 'runtime-result.json'), JSON.stringify(finalResult, null, 2));
  if (!finalResult.execution_verified) throw new Error(`Responsive runtime proof failed: ${JSON.stringify(finalResult.failures)}`);
} finally {
  await writeFile(path.join(ARTIFACTS, 'server.log'), serverLog);
  await browser?.close().catch(() => {});
  server.kill('SIGTERM');
}

console.log(JSON.stringify(finalResult, null, 2));
