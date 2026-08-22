import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const PORT = 4177;
const URL = `http://127.0.0.1:${PORT}`;
const artifacts = path.resolve('artifacts/performance');
await mkdir(artifacts, { recursive: true });

const server = spawn(process.execPath, [
  path.resolve('node_modules/vite/bin/vite.js'),
  'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'
], { stdio: ['ignore', 'pipe', 'pipe'], detached: false });

let serverLog = '';
server.stdout.on('data', (chunk) => { serverLog += chunk.toString(); });
server.stderr.on('data', (chunk) => { serverLog += chunk.toString(); });

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try {
      const response = await fetch(URL);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Preview server failed to start:\n${serverLog}`);
}

function percentile(sorted, fraction) {
  if (!sorted.length) return null;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1));
  return sorted[index];
}

function summarize(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const p50 = percentile(sorted, 0.50);
  const p95 = percentile(sorted, 0.95);
  const p99 = percentile(sorted, 0.99);
  const mean = sorted.reduce((sum, value) => sum + value, 0) / Math.max(1, sorted.length);
  return {
    samples: sorted.length,
    mean_frame_ms: mean,
    p50_frame_ms: p50,
    p95_frame_ms: p95,
    p99_frame_ms: p99,
    median_fps: p50 ? 1000 / p50 : null,
    over_25ms_ratio: sorted.filter((value) => value > 25).length / Math.max(1, sorted.length),
    over_50ms_ratio: sorted.filter((value) => value > 50).length / Math.max(1, sorted.length)
  };
}

let browser;
let page;
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

try {
  await waitForServer();
  browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  page = await context.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.stack || error.message));

  const launchStarted = Date.now();
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  const ready = await waitForReady();
  const startupMs = Date.now() - launchStarted;
  await page.screenshot({ path: path.join(artifacts, '01-ready.png'), fullPage: true });

  const sampleWindowMs = 8000;
  const idleSamples = await collectFrameIntervals(sampleWindowMs);

  const before = await snapshot();
  const beforePosition = before['player.position'];
  await page.keyboard.down('KeyD');
  await page.keyboard.down('ArrowLeft');
  const activeSamplesPromise = collectFrameIntervals(sampleWindowMs);
  await page.waitForTimeout(sampleWindowMs);
  await page.keyboard.up('ArrowLeft');
  await page.keyboard.up('KeyD');
  const activeSamples = await activeSamplesPromise;

  const keyReleaseSnapshot = await snapshot();
  const keyReleasePosition = keyReleaseSnapshot['player.position'];
  const moved = Math.hypot(
    keyReleasePosition.x - beforePosition.x,
    keyReleasePosition.z - beforePosition.z
  );

  // The shared movement contract includes finite deceleration (22 m/s²), so
  // immediate post-keyup travel is expected gameplay. Measure stability only
  // after a bounded 600 ms settle interval, matching the existing human-alpha
  // proof pattern, then observe a second 600 ms no-input window.
  await page.waitForTimeout(600);
  const releaseBaseline = await snapshot();
  const releasePosition = releaseBaseline['player.position'];
  await page.waitForTimeout(600);
  const stable = await snapshot();
  const settledPosition = stable['player.position'];
  const releaseDrift = Math.hypot(
    settledPosition.x - releasePosition.x,
    settledPosition.z - releasePosition.z
  );

  await page.screenshot({ path: path.join(artifacts, '02-after-load.png'), fullPage: true });

  const idle = summarize(idleSamples);
  const active = summarize(activeSamples);
  if (ready['renderer.backend'] === 'unknown' || !ready['renderer.backend']) failures.push('renderer backend unknown');
  if (idle.samples < 60) failures.push(`insufficient idle frame samples: ${idle.samples}`);
  if (active.samples < 60) failures.push(`insufficient active frame samples: ${active.samples}`);
  if (!(moved > 0.5)) failures.push(`normal input did not move engine-owned player enough: ${moved}`);
  if (releaseDrift > 0.05) failures.push(`post-deceleration release drift exceeded 0.05 m: ${releaseDrift}`);
  if (consoleErrors.length) failures.push(`browser errors: ${consoleErrors.join(' | ')}`);

  const result = {
    contract_version: 1,
    scenario_id: 'three-webgpu-performance-v1',
    candidate_id: 'three-webgpu',
    tested_revision: process.env.CANDIDATE_HEAD_SHA || process.env.GITHUB_SHA || 'local-unrecorded',
    execution_valid: failures.length === 0,
    passed: failures.length === 0,
    reference_viewport: { width: 390, height: 844, target_fps: 60 },
    environment_class: 'github-hosted-linux-chrome',
    renderer_backend: ready['renderer.backend'],
    navigator_gpu: ready['renderer.navigator_gpu'] ?? null,
    startup_ms: startupMs,
    sample_window_ms: sampleWindowMs,
    idle,
    active_input: active,
    player_movement_metres: moved,
    post_keyup_deceleration_metres: Math.hypot(
      releasePosition.x - keyReleasePosition.x,
      releasePosition.z - keyReleasePosition.z
    ),
    release_settle_ms: 600,
    release_observation_ms: 600,
    release_drift_metres: releaseDrift,
    target_comparison: {
      idle_median_meets_60fps_target: (idle.median_fps ?? 0) >= 60,
      active_median_meets_60fps_target: (active.median_fps ?? 0) >= 60
    },
    console_errors: consoleErrors,
    failures,
    performance_readiness_claim: false,
    device_profile_claim: false,
    human_tested: false,
    phase_b_assets_claim: false,
    notes: [
      'Measurements are execution evidence from a GitHub-hosted Linux Chrome runner at the shared 390x844 viewport.',
      'The shared 60 FPS target is compared but not promoted into a device/mobile performance-readiness claim.',
      'Normal physical keyboard movement and camera input are used during the active sampling window; no gameplay mutation shortcut is exposed.',
      'Release stability is measured after a 600 ms no-input deceleration interval because the unchanged shared player contract specifies finite 22 m/s² deceleration.',
      'Eight-second idle and active windows preserve the >=60-sample evidence-quality gate even when the hosted runner operates well below the shared 60 FPS target.'
    ]
  };

  await writeFile(path.join(artifacts, 'runtime-result.json'), JSON.stringify(result, null, 2));
  await writeFile(path.join(artifacts, 'server.log'), serverLog);
  if (!result.passed) throw new Error(`Performance measurement gate failed: ${JSON.stringify(failures)}`);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
  const result = {
    contract_version: 1,
    scenario_id: 'three-webgpu-performance-v1',
    candidate_id: 'three-webgpu',
    tested_revision: process.env.CANDIDATE_HEAD_SHA || process.env.GITHUB_SHA || 'local-unrecorded',
    execution_valid: false,
    passed: false,
    failures,
    console_errors: consoleErrors,
    performance_readiness_claim: false,
    device_profile_claim: false,
    human_tested: false
  };
  await writeFile(path.join(artifacts, 'runtime-result.json'), JSON.stringify(result, null, 2));
  await writeFile(path.join(artifacts, 'server.log'), serverLog);
  throw error;
} finally {
  if (browser) await browser.close().catch(() => {});
  if (!server.killed) server.kill('SIGTERM');
}
