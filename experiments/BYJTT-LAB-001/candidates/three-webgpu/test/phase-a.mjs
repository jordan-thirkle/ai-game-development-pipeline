import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const PORT = 4174;
const URL = `http://127.0.0.1:${PORT}`;
const artifacts = path.resolve('artifacts/phase-a');
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

const results = [];
const failures = [];
const consoleErrors = [];
const observations = [];
const heldMovementKeys = new Set();
let page = null;
let browser = null;

function result(id, status, observation = {}, evidence = [], notes = []) {
  results.push({ id, status, observations: observation, evidence, notes });
  if (status === 'fail') failures.push(`${id}: ${notes.join('; ') || 'assertion failed'}`);
}

async function snapshot() {
  return page?.evaluate(() => window.__BYJTT_BENCHMARK__?.snapshot?.() ?? null) ?? null;
}

async function waitFor(predicate, label, timeout = 8000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const current = await snapshot();
    if (current && predicate(current)) return current;
    await page.waitForTimeout(80);
  }
  throw new Error(`Timed out waiting for ${label}; final=${JSON.stringify(await snapshot())}`);
}

async function hold(code, ms) {
  await page.keyboard.down(code);
  await page.waitForTimeout(ms);
  await page.keyboard.up(code);
}

async function sprint(code, ms) {
  await page.keyboard.down('ShiftLeft');
  await hold(code, ms);
  await page.keyboard.up('ShiftLeft');
}

async function applyMovementIntent(codes) {
  const next = new Set(codes.filter(Boolean));
  if (next.size) next.add('ShiftLeft');

  for (const code of [...heldMovementKeys]) {
    if (!next.has(code)) {
      await page.keyboard.up(code);
      heldMovementKeys.delete(code);
    }
  }
  for (const code of next) {
    if (!heldMovementKeys.has(code)) {
      await page.keyboard.down(code);
      heldMovementKeys.add(code);
    }
  }
}

async function releaseMovementIntent() {
  for (const code of [...heldMovementKeys]) {
    await page.keyboard.up(code);
    heldMovementKeys.delete(code);
  }
}

async function attack(count = 1) {
  for (let i = 0; i < count; i++) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(650);
  }
}

async function ensurePlayerAlive(label = 'normal player respawn') {
  let current = await snapshot();
  if (!current['player.alive']) {
    await releaseMovementIntent();
    current = await waitFor((s) => s['player.alive'] === true, label, 4000);
  }
  return current;
}

async function driveToward(targetProvider, {
  tolerance = 1.35,
  maxSimulationSeconds = 12,
  maxWallMs = 18000,
  stopPredicate = null,
  label = 'target'
} = {}) {
  let current = await ensurePlayerAlive();
  const simulationStart = current['elapsed_seconds'];
  const wallStart = Date.now();

  try {
    while (
      Date.now() - wallStart < maxWallMs &&
      current['elapsed_seconds'] - simulationStart < maxSimulationSeconds
    ) {
      current = await snapshot();
      if (stopPredicate?.(current)) return current;
      if (!current['player.alive']) {
        current = await ensurePlayerAlive(`normal respawn while driving toward ${label}`);
        continue;
      }

      const target = targetProvider(current);
      if (!target) return current;
      const p = current['player.position'];
      const dx = target.x - p.x;
      const dz = target.z - p.z;
      if (Math.hypot(dx, dz) <= tolerance) return current;

      const axisX = Math.abs(dx) >= 0.2 ? (dx > 0 ? 'KeyD' : 'KeyA') : null;
      const axisZ = Math.abs(dz) >= 0.2 ? (dz > 0 ? 'KeyS' : 'KeyW') : null;
      await applyMovementIntent([axisX, axisZ]);
      await page.waitForTimeout(90);
    }
  } finally {
    await releaseMovementIntent();
  }

  throw new Error(`Could not reach ${label} through continuous normal movement; final=${JSON.stringify(await snapshot())}`);
}

async function moveToward(targetX, targetZ, tolerance = 1.35, maxSimulationSeconds = 12, stopPredicate = null) {
  return driveToward(
    () => ({ x: targetX, z: targetZ }),
    { tolerance, maxSimulationSeconds, stopPredicate, label: `target (${targetX}, ${targetZ})` }
  );
}

async function moveTowardEnemy(tolerance = 1.45, maxSimulationSeconds = 10) {
  return driveToward(
    (current) => current['enemy.alive'] ? current['enemy.position'] : null,
    {
      tolerance,
      maxSimulationSeconds,
      stopPredicate: (current) => !current['enemy.alive'],
      label: 'moving enemy'
    }
  );
}

async function breakSalvageThroughGameplay(maxAttempts = 4) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let current = await snapshot();
    if (current['salvage.broken']) return current;

    await ensurePlayerAlive('normal respawn before salvage attempt');
    await moveToward(5, 0, 1.2, 12, (s) => s['salvage.broken']);
    current = await ensurePlayerAlive('normal respawn at salvage');
    if (current['salvage.broken']) return current;

    const healthBefore = current['salvage.health'];
    await attack(1);
    try {
      current = await waitFor(
        (s) => s['salvage.broken'] || s['salvage.health'] < healthBefore || !s['player.alive'],
        `salvage attack outcome ${attempt + 1}`,
        1800
      );
    } catch {
      current = await snapshot();
    }
    if (current['salvage.broken']) return current;
  }
  throw new Error(`Could not break salvage through bounded normal gameplay; final=${JSON.stringify(await snapshot())}`);
}

async function writeEvidence(extraFailure = null) {
  const finalSnapshot = await snapshot().catch(() => null);
  if (extraFailure && !failures.includes(extraFailure)) failures.push(extraFailure);
  const evidence = {
    contract_version: 1,
    scenario_id: 'mobile-action-slice-v1',
    candidate_id: 'three-webgpu',
    tested_revision: process.env.GITHUB_SHA || 'local-unrecorded',
    candidate_head_revision: process.env.CANDIDATE_HEAD_SHA || null,
    execution_verified: failures.length === 0 && results.length === 13 && results.every((step) => step.status === 'pass'),
    browser: 'Google Chrome via Playwright channel=chrome',
    renderer: finalSnapshot?.['renderer.backend'] ?? 'unknown',
    navigator_gpu: finalSnapshot?.['renderer.navigator_gpu'] ?? null,
    steps: results,
    failures,
    console_errors: consoleErrors,
    extra_observations: observations,
    final_snapshot: finalSnapshot,
    deviations: [
      'Phase A uses greybox primitives; shared production assets are intentionally deferred to Phase B.',
      'Enemy navigation uses direct steering in the unobstructed arena; no navmesh dependency is added until obstacle/pathfinding evidence requires it.'
    ]
  };
  await writeFile(path.join(artifacts, 'playtest-result.json'), JSON.stringify(evidence, null, 2));
  await writeFile(path.join(artifacts, 'server.log'), serverLog);
  return evidence;
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

  const coldStart = Date.now();
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  let current = await waitFor((s) => s['runtime.ready'] === true, 'runtime.ready', 15000);
  const startupMs = Date.now() - coldStart;
  await page.screenshot({ path: path.join(artifacts, '01-cold-launch.png'), fullPage: true });
  result('01-cold-launch', current['reward.count'] === 0 && current['upgrade.selected_ids'].length === 0 ? 'pass' : 'fail', { startupMs, renderer: current['renderer.backend'], navigatorGpu: current['renderer.navigator_gpu'] }, ['01-cold-launch.png']);

  current = await snapshot();
  result('02-enter-gameplay', current['scene.gameplay_active'] && current['player.alive'] && current['enemy.alive'] && !current['salvage.broken'] ? 'pass' : 'fail', current);

  const beforeMove = current['player.position'];
  await hold('KeyW', 700);
  current = await snapshot();
  const moved = Math.hypot(current['player.position'].x - beforeMove.x, current['player.position'].z - beforeMove.z);
  result('03-move-player', moved > 1.0 ? 'pass' : 'fail', { before: beforeMove, after: current['player.position'], metres: moved });

  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(150);
  current = await snapshot();
  await page.screenshot({ path: path.join(artifacts, '04-exercise-camera.png'), fullPage: true });
  result('04-exercise-camera', current['player.alive'] ? 'pass' : 'fail', { playerStillControllable: current['player.alive'] }, ['04-exercise-camera.png'], ['Post-camera-input screenshot captured; progression state remained intact.']);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(150);

  for (let attempt = 0; attempt < 12; attempt++) {
    current = await snapshot();
    if (current['enemy.target_state'] === 'acquired') break;
    await sprint('KeyW', 300);
  }
  current = await waitFor((s) => s['enemy.target_state'] === 'acquired', 'enemy acquisition', 2500);
  const acquireDistance = Math.hypot(current['enemy.position'].x - current['player.position'].x, current['enemy.position'].z - current['player.position'].z);
  result('05-acquire-enemy', current['enemy.target_state'] === 'acquired' ? 'pass' : 'fail', { acquireDistance, enemy: current['enemy.position'], player: current['player.position'] });

  await moveTowardEnemy(1.35, 10);
  current = await waitFor((s) => s['player.health'] < 100, 'enemy damage', 3500);
  const playerHealthAfterEnemy = current['player.health'];
  const enemyBeforeHit = current['enemy.health'];
  await attack(1);
  current = await waitFor((s) => s['enemy.health'] < enemyBeforeHit, 'player damage to enemy', 3500);
  result('06-exchange-damage', current['player.health'] < 100 && current['enemy.health'] < 100 && current['player.health'] >= 0 && current['enemy.health'] >= 0 ? 'pass' : 'fail', { playerHealthAfterEnemy, playerHealth: current['player.health'], enemyHealth: current['enemy.health'] });

  current = await breakSalvageThroughGameplay();
  result('07-break-salvage', current['salvage.broken'] ? 'pass' : 'fail', { salvageHealth: current['salvage.health'], rewardAvailable: current['reward.available'], rewardCount: current['reward.count'] }, ['07-break-salvage.png'], current['reward.count'] === 1 ? ['Reward auto-collected through normal proximity before step 7 capture completed.'] : []);
  await page.screenshot({ path: path.join(artifacts, '07-break-salvage.png'), fullPage: true });

  current = await snapshot();
  if (current['reward.count'] !== 1) {
    if (!current['reward.available']) throw new Error(`Reward neither collected nor available after salvage; state=${JSON.stringify(current)}`);
    await moveToward(5, -1.7, 0.9, 12, (s) => s['reward.count'] === 1);
    current = await waitFor((s) => s['reward.count'] === 1, 'reward collection');
  }
  result('08-collect-reward', current['reward.count'] === 1 && current['reward.available'] === false ? 'pass' : 'fail', { rewardCount: current['reward.count'], rewardAvailable: current['reward.available'] });

  await waitFor((s) => s['upgrade.menu_visible'] === true, 'upgrade menu');
  await page.locator('#upgrade-damage').click();
  current = await waitFor((s) => s['upgrade.selected_ids'].includes('damage-up-1'), 'upgrade selection');
  result('09-select-upgrade', Math.abs(current['player.effective_attack_damage'] - 40.8) < 0.001 ? 'pass' : 'fail', { upgrades: current['upgrade.selected_ids'], effectiveDamage: current['player.effective_attack_damage'] });

  for (let attempt = 0; attempt < 6; attempt++) {
    current = await snapshot();
    if (!current['enemy.alive']) break;
    await ensurePlayerAlive();
    await moveTowardEnemy(1.5, 10);
    await attack(1);
  }
  current = await snapshot();
  result('10-resolve-enemy', current['enemy.alive'] === false ? 'pass' : 'fail', { enemyAlive: current['enemy.alive'], enemyHealth: current['enemy.health'], playerHealth: current['player.health'], playerAlive: current['player.alive'] });

  await page.locator('#save').click();
  current = await waitFor((s) => s['save.schema_version'] === 1, 'normal save path');
  result('11-save-state', current['save.schema_version'] === 1 && current['reward.count'] === 1 && current['upgrade.selected_ids'].includes('damage-up-1') ? 'pass' : 'fail', { saveSchemaVersion: current['save.schema_version'], rewardCount: current['reward.count'], upgrades: current['upgrade.selected_ids'] });
  await page.screenshot({ path: path.join(artifacts, '11-save-state.png'), fullPage: true });

  const restartAt = Date.now();
  await page.reload({ waitUntil: 'domcontentloaded' });
  current = await waitFor((s) => s['runtime.ready'] === true, 'runtime after restart', 15000);
  const restartMs = Date.now() - restartAt;
  result('12-restart-runtime', restartMs <= 15000 ? 'pass' : 'fail', { restartMs, renderer: current['renderer.backend'] });

  current = await snapshot();
  result('13-verify-restored-state', current['reward.count'] === 1 && current['upgrade.selected_ids'].includes('damage-up-1') ? 'pass' : 'fail', { rewardCount: current['reward.count'], upgrades: current['upgrade.selected_ids'] });
  await page.screenshot({ path: path.join(artifacts, '13-restored-state.png'), fullPage: true });

  const touchButtons = await page.locator('#controls button').count();
  const viewportWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  observations.push({ touchButtons, viewportWidth });
  if (touchButtons < 8 || viewportWidth > 390) failures.push(`mobile controls/layout: buttons=${touchButtons}, scrollWidth=${viewportWidth}`);
  if (consoleErrors.length) failures.push(`console errors: ${consoleErrors.join(' | ')}`);

  const evidence = await writeEvidence();
  if (failures.length) throw new Error(`Phase A failures:\n- ${failures.join('\n- ')}`);
  console.log(`BYJTT-LAB-001 Three.js Phase A passed all ${results.length} shared steps.`);
  console.log(`Renderer evidence: ${evidence.renderer}; navigator.gpu=${evidence.navigator_gpu}`);
} catch (error) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  await writeEvidence(message);
  throw error;
} finally {
  await releaseMovementIntent().catch(() => {});
  await browser?.close();
  server.kill('SIGTERM');
}
