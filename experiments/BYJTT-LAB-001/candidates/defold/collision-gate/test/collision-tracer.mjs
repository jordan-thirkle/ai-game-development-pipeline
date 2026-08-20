import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const gate = path.resolve(here, '..');
const bundleRoot = path.join(gate, 'bundle');
const artifacts = path.join(gate, 'artifacts', 'native-collision');
const port = 4179;
const url = `http://127.0.0.1:${port}`;
const EAST_WALL_INNER_FACE_X = 12.0;
const PLAYER_HALF_WIDTH_M = 0.4;
const EXPECTED_CENTER_CEILING_X = EAST_WALL_INNER_FACE_X - PLAYER_HALF_WIDTH_M;
await mkdir(artifacts, { recursive: true });

async function findIndex(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = await findIndex(full);
      if (found) return found;
    } else if (entry.name === 'index.html') return full;
  }
  return null;
}

const index = await findIndex(bundleRoot);
if (!index) throw new Error(`No index.html found below ${bundleRoot}`);
const webRoot = path.dirname(index);
await writeFile(path.join(webRoot, 'favicon.ico'), '');
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], {
  cwd: webRoot,
  stdio: ['ignore', 'pipe', 'pipe']
});
let serverLog = '';
server.stdout.on('data', c => { serverLog += c.toString(); });
server.stderr.on('data', c => { serverLog += c.toString(); });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(url)).ok) break; } catch {}
  if (i === 59) throw new Error(`Server did not start:\n${serverLog}`);
  await delay(100);
}

let browser;
const consoleLines = [];
const consoleErrors = [];
const pageErrors = [];
const snapshot = page => page.evaluate(() => globalThis.__BYJTT_DEFOLD_COLLISION ? structuredClone(globalThis.__BYJTT_DEFOLD_COLLISION) : null);
async function waitFor(page, predicate, label, timeout = 15000) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < timeout) {
    last = await snapshot(page);
    if (last && predicate(last)) return last;
    await page.waitForTimeout(50);
  }
  throw new Error(`Timed out waiting for ${label}; final=${JSON.stringify(last)}`);
}

try {
  browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.on('console', msg => {
    const line = `[${msg.type()}] ${msg.text()}`;
    consoleLines.push(line);
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', error => pageErrors.push(error.stack || error.message));

  const coldStarted = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const initial = await waitFor(page, value => value.runtime?.ready === true, 'runtime ready');
  const startupMs = Date.now() - coldStarted;
  const canvas = page.locator('canvas').first();
  if (await canvas.count()) await canvas.focus();

  await page.keyboard.down('KeyD');
  await page.waitForTimeout(4500);
  await page.keyboard.up('KeyD');
  const stopped = await waitFor(page, value => value.seq > initial.seq && value.player.collision_count > 0, 'native wall collision');
  const releaseStartX = stopped.player.position[0];
  await page.waitForTimeout(500);
  const released = await waitFor(page, value => value.seq > stopped.seq, 'released observation');
  const releaseDriftM = Math.abs(released.player.position[0] - releaseStartX);
  const centerCeilingErrorM = Math.abs(released.player.position[0] - EXPECTED_CENTER_CEILING_X);

  if (centerCeilingErrorM > 0.08) throw new Error(`Native stop missed expected x=${EXPECTED_CENTER_CEILING_X}: final=${released.player.position[0]}`);
  if (released.player.max_x > EXPECTED_CENTER_CEILING_X + 0.05) throw new Error(`Native physics exceeded collision tolerance: max_x=${released.player.max_x}`);
  if (releaseDriftM > 0.05) throw new Error(`Input release drifted ${releaseDriftM} m`);
  if (released.contract.post_physics_arena_clamp !== false) throw new Error('Gate reported a post-physics arena clamp');

  const seqBeforeMutation = released.seq;
  await page.evaluate(() => {
    globalThis.__BYJTT_DEFOLD_COLLISION.player.position[0] = 999;
    globalThis.__BYJTT_DEFOLD_COLLISION.contract.walk_speed_mps = 999;
  });
  const republished = await waitFor(page, value => value.seq > seqBeforeMutation, 'authoritative republish');
  const observationCopyIsolated = republished.player.position[0] !== 999 && republished.contract.walk_speed_mps === 3.5;
  if (!observationCopyIsolated) throw new Error('Browser mutation leaked into engine-owned state');
  if (pageErrors.length) throw new Error(`Page errors: ${pageErrors.join(' | ')}`);
  if (consoleErrors.length) throw new Error(`Console errors: ${consoleErrors.join(' | ')}`);

  await page.screenshot({ path: path.join(artifacts, 'native-wall-stop.png'), fullPage: true });
  const result = {
    contract_version: 1,
    scenario_id: 'mobile-action-slice-v1',
    candidate_id: 'defold',
    scope: 'native-3d-collision-gate',
    tested_revision: process.env.GITHUB_SHA || 'local-unrecorded',
    candidate_head_revision: process.env.CANDIDATE_HEAD_SHA || null,
    execution_verified: true,
    browser: 'Google Chrome via Playwright channel=chrome',
    viewport: { width: 390, height: 844 },
    startup_ms: startupMs,
    external_input_executed: true,
    input: 'KeyD held for 4500 ms then released',
    shared_walk_speed_mps: 3.5,
    arena_width_m: 24,
    east_wall_inner_face_x: EAST_WALL_INNER_FACE_X,
    player_half_width_m: PLAYER_HALF_WIDTH_M,
    expected_center_ceiling_x: EXPECTED_CENTER_CEILING_X,
    center_ceiling_error_m: centerCeilingErrorM,
    initial_x: initial.player.position[0],
    final_x: released.player.position[0],
    max_x: released.player.max_x,
    collision_count: released.player.collision_count,
    release_drift_m: releaseDriftM,
    native_wall_stop_observed: released.player.collision_count > 0 && centerCeilingErrorM <= 0.08 && released.player.max_x <= EXPECTED_CENTER_CEILING_X + 0.05,
    dynamic_collision_object_executed: true,
    post_physics_arena_clamp: false,
    observation_copy_isolated: observationCopyIsolated,
    page_errors: pageErrors,
    console_errors: consoleErrors,
    deviations: [
      'Bounded native-collision proof only; no full Phase A claim.',
      'Dynamic-body velocity steering is evaluated only as an engine-native collision feasibility path.',
      'Camera, enemy/navigation/combat, salvage/reward/upgrade, save/restart, Phase B assets and device evidence remain unknown.'
    ]
  };
  await writeFile(path.join(artifacts, 'result.json'), JSON.stringify(result, null, 2));
  await writeFile(path.join(artifacts, 'browser-console.log'), consoleLines.join('\n'));
  await writeFile(path.join(artifacts, 'server.log'), serverLog);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  await writeFile(path.join(artifacts, 'result.json'), JSON.stringify({
    candidate_id: 'defold', scope: 'native-3d-collision-gate', execution_verified: false,
    candidate_head_revision: process.env.CANDIDATE_HEAD_SHA || null,
    error: error.stack || error.message, page_errors: pageErrors, console_errors: consoleErrors
  }, null, 2));
  await writeFile(path.join(artifacts, 'browser-console.log'), consoleLines.join('\n'));
  await writeFile(path.join(artifacts, 'server.log'), serverLog);
  throw error;
} finally {
  await browser?.close().catch(() => {});
  server.kill('SIGTERM');
}
