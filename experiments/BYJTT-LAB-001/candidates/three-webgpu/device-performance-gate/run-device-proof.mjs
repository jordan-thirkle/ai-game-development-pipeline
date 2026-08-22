import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const root = path.resolve('.');
const artifactsDir = path.join(root, 'artifacts', 'device-performance');
const port = Number(process.env.BYJTT_DEVICE_PORT || 4187);
const url = `http://127.0.0.1:${port}`;
const requireHardware = process.env.BYJTT_REQUIRE_HARDWARE === '1';
const headless = process.env.BYJTT_CHROME_HEADLESS !== '0';
const testedRevision = process.env.CANDIDATE_HEAD_SHA || process.env.GITHUB_SHA || 'local-unrecorded';
await mkdir(artifactsDir, { recursive: true });

const viteBin = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'vite.cmd' : 'vite');
const server = spawn(viteBin, ['preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe']
});
let serverLog = '';
server.stdout.on('data', (chunk) => { serverLog += chunk.toString(); });
server.stderr.on('data', (chunk) => { serverLog += chunk.toString(); });

async function waitForServer() {
  for (let i = 0; i < 80; i++) {
    if (server.exitCode !== null) throw new Error(`preview server exited ${server.exitCode}:\n${serverLog}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`preview server did not become ready:\n${serverLog}`);
}

const failures = [];
const consoleErrors = [];
const pageErrors = [];
const observations = {};
let browser;
let page;
let classification = 'unexecuted';
let exitCode = 1;

async function snapshot() {
  return page.evaluate(() => window.__BYJTT_BENCHMARK__?.snapshot?.() ?? null);
}

async function waitForSnapshot(timeoutMs = 12000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = await snapshot().catch(() => null);
    if (value?.['player.position'] && value?.['renderer.backend']) return value;
    await page.waitForTimeout(80);
  }
  throw new Error('candidate observation bridge did not become ready');
}

try {
  await waitForServer();
  const launchStarted = performance.now();
  browser = await chromium.launch({ channel: 'chrome', headless });
  const cdp = await browser.newBrowserCDPSession();
  const systemInfo = await cdp.send('SystemInfo.getInfo');
  const gpuDevices = systemInfo?.gpu?.devices ?? [];
  observations.gpu_devices = gpuDevices.map((device) => ({
    vendor_id: device.vendorId,
    device_id: device.deviceId,
    vendor_string: device.vendorString,
    device_string: device.deviceString,
    driver_vendor: device.driverVendor,
    driver_version: device.driverVersion
  }));
  const gpuText = JSON.stringify(observations.gpu_devices);
  const softwareRenderer = /swiftshader|llvmpipe|software raster|software renderer/i.test(gpuText);
  observations.software_renderer_detected = softwareRenderer;

  page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
  if (!response?.ok()) failures.push(`navigation status=${response?.status() ?? 'none'}`);
  const initial = await waitForSnapshot();
  observations.startup_ms = performance.now() - launchStarted;
  observations.renderer_backend = initial['renderer.backend'];
  observations.navigator_gpu = initial['renderer.navigator_gpu'] ?? null;
  observations.canvas_visible = await page.locator('canvas').first().isVisible().catch(() => false);
  observations.initial_position = initial['player.position'];

  const startX = Number(initial['player.position'].x);
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(700);
  await page.keyboard.up('KeyD');
  await page.waitForTimeout(650);
  const released = await snapshot();
  await page.waitForTimeout(650);
  const stable = await snapshot();
  observations.movement_delta_x = Number(released['player.position'].x) - startX;
  observations.release_drift = Math.hypot(
    Number(stable['player.position'].x) - Number(released['player.position'].x),
    Number(stable['player.position'].z) - Number(released['player.position'].z)
  );
  await page.screenshot({ path: path.join(artifactsDir, 'device-proof.png'), fullPage: true });

  if (!observations.canvas_visible) failures.push('render canvas is not visible');
  if (!observations.navigator_gpu) failures.push('navigator.gpu unavailable');
  if (Math.abs(observations.movement_delta_x) < 0.25) failures.push('normal KeyD did not move engine-owned player state');
  if (observations.release_drift > 0.12) failures.push(`release drift ${observations.release_drift} exceeds 0.12 m`);
  if (consoleErrors.length) failures.push(`console errors: ${consoleErrors.join(' | ')}`);
  if (pageErrors.length) failures.push(`page errors: ${pageErrors.join(' | ')}`);

  if (softwareRenderer) {
    classification = 'blocked-software-renderer';
    exitCode = requireHardware ? 2 : (failures.length ? 1 : 2);
  } else {
    const frameIntervals = await page.evaluate(async () => {
      const samples = [];
      let previous = performance.now();
      await new Promise((resolve) => {
        function tick(now) {
          samples.push(now - previous);
          previous = now;
          if (samples.length >= 180) resolve(); else requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      });
      return samples.slice(1);
    });
    frameIntervals.sort((a, b) => a - b);
    const percentile = (p) => frameIntervals[Math.min(frameIntervals.length - 1, Math.floor(frameIntervals.length * p))];
    observations.frame_samples = frameIntervals.length;
    observations.frame_ms_p50 = percentile(0.50);
    observations.frame_ms_p95 = percentile(0.95);
    observations.frame_ms_p99 = percentile(0.99);
    observations.median_fps = 1000 / observations.frame_ms_p50;
    if (frameIntervals.length < 120) failures.push(`only ${frameIntervals.length} frame samples`);
    classification = failures.length ? 'hardware-renderer-runtime-failed' : 'hardware-renderer-measured';
    exitCode = failures.length ? 1 : 0;
  }
} catch (error) {
  failures.push(error instanceof Error ? error.stack || error.message : String(error));
  classification = 'execution-failed';
  exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  server.kill('SIGTERM');
  await new Promise((resolve) => {
    if (server.exitCode !== null) return resolve();
    const timer = setTimeout(() => { server.kill('SIGKILL'); resolve(); }, 1500);
    server.once('exit', () => { clearTimeout(timer); resolve(); });
  });
}

const result = {
  schema_version: 1,
  benchmark_id: 'BYJTT-LAB-001',
  candidate_id: 'three-webgpu',
  tested_revision: testedRevision,
  classification,
  require_hardware_renderer: requireHardware,
  target_device_performance_proven: classification === 'hardware-renderer-measured' && failures.length === 0,
  human_tested: false,
  release_ready: false,
  observations,
  console_errors: consoleErrors,
  page_errors: pageErrors,
  failures
};
await writeFile(path.join(artifactsDir, 'runtime-result.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
await writeFile(path.join(artifactsDir, 'preview-server.log'), serverLog, 'utf8');
console.log(JSON.stringify(result, null, 2));
process.exitCode = exitCode;
