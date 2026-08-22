import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const candidateDir = path.resolve(import.meta.dirname, '..');
const artifactDir = path.join(candidateDir, 'artifacts', 'fallback-runtime');
fs.mkdirSync(artifactDir, { recursive: true });

const testedRevision = process.env.CANDIDATE_HEAD_SHA || 'unknown';
const server = spawn(process.execPath, [
  path.join(candidateDir, 'node_modules', 'vite', 'bin', 'vite.js'),
  'preview', '--host', '127.0.0.1', '--port', '4173', '--strictPort'
], {
  cwd: candidateDir,
  stdio: ['ignore', 'pipe', 'pipe']
});

let serverLog = '';
server.stdout.on('data', chunk => { serverLog += chunk.toString(); });
server.stderr.on('data', chunk => { serverLog += chunk.toString(); });

async function waitForServer() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch('http://127.0.0.1:4173/');
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error(`Vite preview did not become ready. Log:\n${serverLog}`);
}

const result = {
  tested_revision: testedRevision,
  proof_state: 'blocked-no-rendering-fallback',
  passed: false,
  navigator_gpu: null,
  renderer_backend: null,
  gameplay_active: null,
  canvas_visible: false,
  webgl_renderer: null,
  webgl_vendor: null,
  movement_meters: 0,
  release_drift_meters: null,
  observation_isolation: false,
  console_errors: [],
  page_errors: [],
  failures: []
};

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-features=WebGPU,WebGPUService,UnsafeWebGPU',
      '--enable-webgl',
      '--ignore-gpu-blocklist'
    ]
  });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.on('console', message => {
    if (message.type() === 'error') result.console_errors.push(message.text());
  });
  page.on('pageerror', error => result.page_errors.push(String(error)));

  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForFunction(() => window.__BYJTT_BENCHMARK__?.snapshot?.()['runtime.ready'] === true, null, { timeout: 30_000 });

  const initial = await page.evaluate(() => {
    const snapshot = window.__BYJTT_BENCHMARK__.snapshot();
    const canvas = document.querySelector('canvas');
    const rect = canvas?.getBoundingClientRect();
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    const debug = gl?.getExtension('WEBGL_debug_renderer_info');
    return {
      snapshot,
      navigatorGpu: Boolean(navigator.gpu),
      canvasVisible: Boolean(canvas && rect && rect.width > 0 && rect.height > 0),
      webglRenderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null,
      webglVendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : null
    };
  });

  result.navigator_gpu = initial.navigatorGpu;
  result.renderer_backend = initial.snapshot['renderer.backend'];
  result.gameplay_active = initial.snapshot['scene.gameplay_active'];
  result.canvas_visible = initial.canvasVisible;
  result.webgl_renderer = initial.webglRenderer;
  result.webgl_vendor = initial.webglVendor;

  const startX = initial.snapshot['player.position'].x;
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(900);
  await page.keyboard.up('KeyD');
  await page.waitForTimeout(500);
  const stopped = await page.evaluate(() => window.__BYJTT_BENCHMARK__.snapshot());
  result.movement_meters = Math.abs(stopped['player.position'].x - startX);
  await page.waitForTimeout(450);
  const release = await page.evaluate(() => window.__BYJTT_BENCHMARK__.snapshot());
  result.release_drift_meters = Math.abs(release['player.position'].x - stopped['player.position'].x);

  result.observation_isolation = await page.evaluate(() => {
    const first = window.__BYJTT_BENCHMARK__.snapshot();
    first['player.position'].x = 9999;
    const second = window.__BYJTT_BENCHMARK__.snapshot();
    return second['player.position'].x !== 9999;
  });

  await page.screenshot({ path: path.join(artifactDir, 'fallback-runtime.png'), fullPage: true });

  if (result.navigator_gpu) result.proof_state = 'blocked-webgpu-still-exposed';
  else if (String(result.renderer_backend).toLowerCase().includes('webgl')) result.proof_state = 'webgl-fallback-proven';
  else result.proof_state = 'blocked-no-rendering-fallback';

  if (result.proof_state !== 'webgl-fallback-proven') result.failures.push(`fallback classification: ${result.proof_state}`);
  if (result.gameplay_active !== true) result.failures.push('gameplay did not become active');
  if (!result.canvas_visible) result.failures.push('renderer canvas was not visible');
  if (result.movement_meters < 0.5) result.failures.push(`normal KeyD movement too small: ${result.movement_meters}`);
  if (!(result.release_drift_meters <= 0.03)) result.failures.push(`release drift too high: ${result.release_drift_meters}`);
  if (!result.observation_isolation) result.failures.push('observation bridge mutation isolation failed');
  if (result.console_errors.length) result.failures.push(`console errors: ${result.console_errors.join(' | ')}`);
  if (result.page_errors.length) result.failures.push(`page errors: ${result.page_errors.join(' | ')}`);

  result.passed = result.failures.length === 0;
  await context.close();
} catch (error) {
  result.failures.push(String(error?.stack || error));
} finally {
  if (browser) await browser.close().catch(() => {});
  server.kill('SIGTERM');
  await new Promise(resolve => setTimeout(resolve, 250));
  if (!server.killed) server.kill('SIGKILL');
  fs.writeFileSync(path.join(artifactDir, 'server.log'), serverLog);
  fs.writeFileSync(path.join(artifactDir, 'runtime-result.json'), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
}

if (!result.passed) process.exitCode = 1;
