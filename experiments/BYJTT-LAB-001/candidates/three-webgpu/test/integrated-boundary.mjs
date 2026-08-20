import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const PORT = 4176;
const URL = `http://127.0.0.1:${PORT}`;
const artifacts = path.resolve('artifacts/phase-a');
const resultPath = path.join(artifacts, 'integrated-native-boundary.json');
await mkdir(artifacts, { recursive: true });

const server = spawn(process.execPath, [
  path.resolve('node_modules/vite/bin/vite.js'),
  'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'
], { stdio: ['ignore', 'pipe', 'pipe'] });

let serverLog = '';
server.stdout.on('data', (chunk) => { serverLog += chunk.toString(); });
server.stderr.on('data', (chunk) => { serverLog += chunk.toString(); });

async function waitForServer() {
  for (let i = 0; i < 40; i++) {
    try {
      const response = await fetch(URL);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Preview server failed to start:\n${serverLog}`);
}

let browser;
let page;
const consoleErrors = [];
const evidence = {
  tested_revision: process.env.CANDIDATE_HEAD_SHA || process.env.GITHUB_SHA || 'local-unrecorded',
  execution: 'integrated Three.js candidate page in Google Chrome',
  input_path: 'Playwright physical keyboard KeyD -> production key handlers',
  arena_width_metres: 24,
  player_radius_metres: 0.42,
  wall_half_thickness_metres: 0.25,
  expected_east_wall_center_ceiling_metres: 11.33,
  before: null,
  at_wall: null,
  after_release: null,
  native_boundary_observed: false,
  post_physics_arena_clamp: null,
  release_drift_metres: null,
  console_errors: consoleErrors,
  passed: false
};

async function snapshot() {
  return page.evaluate(() => window.__BYJTT_BENCHMARK__?.snapshot?.() ?? null);
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
  await page.waitForFunction(() => window.__BYJTT_BENCHMARK__?.snapshot?.()['runtime.ready'] === true, null, { timeout: 15000 });

  evidence.before = await snapshot();
  if (evidence.before['physics.native_arena_boundary'] !== true) throw new Error('Integrated runtime did not report native arena boundary enabled.');
  if (evidence.before['physics.post_physics_arena_clamp'] !== false) throw new Error('Integrated runtime still reports a post-physics arena clamp.');
  evidence.post_physics_arena_clamp = evidence.before['physics.post_physics_arena_clamp'];

  await page.keyboard.down('KeyD');
  await page.waitForTimeout(4500);
  await page.keyboard.up('KeyD');
  await page.waitForTimeout(300);
  evidence.at_wall = await snapshot();

  const wallX = evidence.at_wall['player.position'].x;
  if (wallX < 10.5) throw new Error(`Player did not reach east wall through normal input; x=${wallX}`);
  if (wallX > 11.46) throw new Error(`Player penetrated native east-wall ceiling; x=${wallX}`);

  await page.waitForTimeout(700);
  evidence.after_release = await snapshot();
  evidence.release_drift_metres = Math.abs(evidence.after_release['player.position'].x - wallX);
  if (evidence.release_drift_metres > 0.12) throw new Error(`Player drifted after KeyD release; drift=${evidence.release_drift_metres}`);

  // Exercise the lost-focus safety path without mutating gameplay state directly.
  await page.keyboard.down('KeyA');
  await page.waitForTimeout(180);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  const afterBlurStart = await snapshot();
  await page.waitForTimeout(600);
  const afterBlur = await snapshot();
  await page.keyboard.up('KeyA');
  const blurDrift = Math.abs(afterBlur['player.position'].x - afterBlurStart['player.position'].x);
  if (blurDrift > 0.5) throw new Error(`Movement input remained latched after blur; drift=${blurDrift}`);

  if (consoleErrors.length) throw new Error(`Browser errors: ${consoleErrors.join(' | ')}`);
  evidence.native_boundary_observed = true;
  evidence.blur_release_drift_metres = blurDrift;
  evidence.passed = true;
  await page.screenshot({ path: path.join(artifacts, 'integrated-native-boundary.png'), fullPage: true });
  console.log(`Integrated Jolt wall stop observed at x=${wallX.toFixed(6)}; release drift=${evidence.release_drift_metres.toFixed(6)}.`);
} catch (error) {
  evidence.failure = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  throw error;
} finally {
  await writeFile(resultPath, JSON.stringify(evidence, null, 2));
  await writeFile(path.join(artifacts, 'integrated-native-boundary-server.log'), serverLog);
  await browser?.close();
  server.kill('SIGTERM');
}
