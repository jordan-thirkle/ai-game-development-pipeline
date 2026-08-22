import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const PORT = 4178;
const URL = `http://127.0.0.1:${PORT}`;
const artifacts = path.resolve('artifacts/performance-attribution');
const sampleWindowMs = 8000;
await mkdir(artifacts, { recursive: true });

const server = spawn(process.execPath, [
  path.resolve('node_modules/vite/bin/vite.js'),
  'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'
], { stdio: ['ignore', 'pipe', 'pipe'], detached: false });

let serverLog = '';
server.stdout.on('data', (chunk) => { serverLog += chunk.toString(); });
server.stderr.on('data', (chunk) => { serverLog += chunk.toString(); });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch(URL);
      if (response.ok) return;
    } catch {}
    await sleep(200);
  }
  throw new Error(`Preview server failed to start:\n${serverLog}`);
}

function percentile(sorted, fraction) {
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1))];
}

function summarizeFrames(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const p50 = percentile(sorted, 0.50);
  return {
    samples: sorted.length,
    mean_frame_ms: sorted.reduce((sum, value) => sum + value, 0) / Math.max(1, sorted.length),
    p50_frame_ms: p50,
    p95_frame_ms: percentile(sorted, 0.95),
    p99_frame_ms: percentile(sorted, 0.99),
    median_fps: p50 ? 1000 / p50 : null,
    over_25ms_ratio: sorted.filter((value) => value > 25).length / Math.max(1, sorted.length),
    over_50ms_ratio: sorted.filter((value) => value > 50).length / Math.max(1, sorted.length)
  };
}

function metricMap(metrics) {
  return Object.fromEntries(metrics.map(({ name, value }) => [name, value]));
}

function metricDelta(before, after, name) {
  return Math.max(0, (after[name] ?? 0) - (before[name] ?? 0));
}

function summarizeMainThread(before, after) {
  const windowSeconds = sampleWindowMs / 1000;
  const task = metricDelta(before, after, 'TaskDuration');
  const script = metricDelta(before, after, 'ScriptDuration');
  const layout = metricDelta(before, after, 'LayoutDuration');
  return {
    task_seconds: task,
    script_seconds: script,
    layout_seconds: layout,
    task_window_ratio: task / windowSeconds,
    script_window_ratio: script / windowSeconds,
    layout_window_ratio: layout / windowSeconds
  };
}

let browser;
let context;
let page;
let cdp;
const consoleErrors = [];
const failures = [];

async function snapshot() {
  return page.evaluate(() => window.__BYJTT_BENCHMARK__?.snapshot?.() ?? null);
}

async function waitForReady(timeout = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const current = await snapshot();
    if (current?.['runtime.ready'] === true) return current;
    await page.waitForTimeout(80);
  }
  throw new Error(`Timed out waiting for runtime.ready; final=${JSON.stringify(await snapshot())}`);
}

async function collectFrameIntervals(durationMs) {
  return page.evaluate(async (duration) => {
    const intervals = [];
    const start = performance.now();
    let previous = null;
    await new Promise((resolve) => {
      function step(now) {
        if (previous !== null) intervals.push(now - previous);
        previous = now;
        if (now - start >= duration) resolve();
        else requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
    return intervals;
  }, durationMs);
}

async function getPerformanceMetrics() {
  const result = await cdp.send('Performance.getMetrics');
  return metricMap(result.metrics);
}

async function getGpuEvidence() {
  return page.evaluate(async () => {
    const evidence = {
      navigator_gpu: Boolean(navigator.gpu),
      webgpu_adapter: null,
      webgl_vendor: null,
      webgl_renderer: null,
      webgl_unmasked_vendor: null,
      webgl_unmasked_renderer: null
    };

    try {
      const adapter = await navigator.gpu?.requestAdapter();
      const info = adapter?.info;
      if (info) {
        evidence.webgpu_adapter = {
          vendor: info.vendor ?? null,
          architecture: info.architecture ?? null,
          device: info.device ?? null,
          description: info.description ?? null
        };
      }
    } catch {}

    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (gl) {
        evidence.webgl_vendor = gl.getParameter(gl.VENDOR);
        evidence.webgl_renderer = gl.getParameter(gl.RENDERER);
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        if (ext) {
          evidence.webgl_unmasked_vendor = gl.getParameter(ext.UNMASKED_VENDOR_WEBGL);
          evidence.webgl_unmasked_renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
        }
      }
    } catch {}

    return evidence;
  });
}

function rendererText(gpuEvidence) {
  return JSON.stringify(gpuEvidence).toLowerCase();
}

try {
  await waitForServer();
  browser = await chromium.launch({ headless: true, channel: 'chrome' });
  context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  page = await context.newPage();
  cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.stack || error.message));

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  const ready = await waitForReady();
  await page.screenshot({ path: path.join(artifacts, '01-ready.png'), fullPage: true });

  const gpuEvidence = await getGpuEvidence();
  const browserVersion = await cdp.send('Browser.getVersion');

  const idleBefore = await getPerformanceMetrics();
  const idleSamples = await collectFrameIntervals(sampleWindowMs);
  const idleAfter = await getPerformanceMetrics();

  const before = await snapshot();
  const beforePosition = before['player.position'];
  const activeBefore = await getPerformanceMetrics();
  await page.keyboard.down('KeyD');
  await page.keyboard.down('ArrowLeft');
  const activeSamples = await collectFrameIntervals(sampleWindowMs);
  await page.keyboard.up('ArrowLeft');
  await page.keyboard.up('KeyD');
  const activeAfter = await getPerformanceMetrics();

  const released = await snapshot();
  const releasedPosition = released['player.position'];
  const movementMeters = Math.hypot(
    releasedPosition.x - beforePosition.x,
    releasedPosition.z - beforePosition.z
  );

  await page.waitForTimeout(600);
  const settledA = await snapshot();
  await page.waitForTimeout(400);
  const settledB = await snapshot();
  const releaseDrift = Math.hypot(
    settledB['player.position'].x - settledA['player.position'].x,
    settledB['player.position'].z - settledA['player.position'].z
  );

  await page.screenshot({ path: path.join(artifacts, '02-after-load.png'), fullPage: true });

  const idleFrames = summarizeFrames(idleSamples);
  const activeFrames = summarizeFrames(activeSamples);
  const idleMainThread = summarizeMainThread(idleBefore, idleAfter);
  const activeMainThread = summarizeMainThread(activeBefore, activeAfter);
  const maxTaskRatio = Math.max(idleMainThread.task_window_ratio, activeMainThread.task_window_ratio);
  const gpuText = rendererText(gpuEvidence);
  const softwareRendererMarker = /swiftshader|llvmpipe|software raster|software renderer/.test(gpuText);

  let hostedAttribution = 'mixed-or-unresolved-hosted-bottleneck';
  if (softwareRendererMarker && maxTaskRatio < 0.5) {
    hostedAttribution = 'hosted-software-renderer-without-main-thread-saturation';
  } else if (maxTaskRatio >= 0.8) {
    hostedAttribution = 'main-thread-saturation-observed';
  }

  if (idleFrames.samples < 60) failures.push(`idle sample count ${idleFrames.samples} < 60`);
  if (activeFrames.samples < 60) failures.push(`active sample count ${activeFrames.samples} < 60`);
  if (movementMeters <= 1) failures.push(`physical input movement ${movementMeters.toFixed(6)}m <= 1m`);
  if (releaseDrift > 0.03) failures.push(`release drift ${releaseDrift.toFixed(6)}m > 0.03m`);
  if (!ready['renderer.backend']) failures.push('renderer backend observation missing');
  if (!gpuEvidence.navigator_gpu && !gpuEvidence.webgl_renderer) failures.push('no browser GPU/renderer evidence available');
  if (consoleErrors.length) failures.push(`browser errors: ${consoleErrors.join(' | ')}`);

  const result = {
    tested_revision: process.env.CANDIDATE_HEAD_SHA ?? null,
    execution_valid: failures.length === 0,
    passed: failures.length === 0,
    viewport: { width: 390, height: 844 },
    sample_window_ms: sampleWindowMs,
    renderer_backend: ready['renderer.backend'],
    browser_product: browserVersion.product,
    browser_user_agent: browserVersion.userAgent,
    gpu_evidence: gpuEvidence,
    software_renderer_marker: softwareRendererMarker,
    idle_frames: idleFrames,
    active_frames: activeFrames,
    idle_main_thread: idleMainThread,
    active_main_thread: activeMainThread,
    hosted_attribution: hostedAttribution,
    movement_meters: movementMeters,
    release_drift_meters: releaseDrift,
    console_errors: consoleErrors,
    failures,
    attribution_scope: 'github-hosted-linux-chrome-only',
    optimization_recommendation_claim: false,
    device_profile_claim: false,
    performance_readiness_claim: false,
    human_tested: false
  };

  await writeFile(path.join(artifacts, 'runtime-result.json'), `${JSON.stringify(result, null, 2)}\n`);
  await writeFile(path.join(artifacts, 'gpu-evidence.json'), `${JSON.stringify(gpuEvidence, null, 2)}\n`);
  await writeFile(path.join(artifacts, 'browser-errors.json'), `${JSON.stringify(consoleErrors, null, 2)}\n`);
  if (failures.length) throw new Error(`Performance attribution gate failed: ${failures.join('; ')}`);
} catch (error) {
  failures.push(error?.stack || String(error));
  try {
    await writeFile(path.join(artifacts, 'failure.json'), `${JSON.stringify({ failures, consoleErrors }, null, 2)}\n`);
  } catch {}
  throw error;
} finally {
  try { await cdp?.send('Performance.disable'); } catch {}
  try { await context?.close(); } catch {}
  try { await browser?.close(); } catch {}
  server.kill('SIGTERM');
  await sleep(150);
  if (!server.killed) server.kill('SIGKILL');
  await writeFile(path.join(artifacts, 'preview-server.log'), serverLog);
}
