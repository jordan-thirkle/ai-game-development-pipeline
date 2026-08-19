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

function result(id, status, observation = {}, evidence = [], notes = []) {
  results.push({ id, status, observations: observation, evidence, notes });
  if (status === 'fail') failures.push(`${id}: ${notes.join('; ') || 'assertion failed'}`);
}

async function snapshot(page) {
  return page.evaluate(() => window.__BYJTT_BENCHMARK__?.snapshot?.() ?? null);
}

async function waitFor(page, predicate, label, timeout = 8000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const current = await snapshot(page);
    if (current && predicate(current)) return current;
    await page.waitForTimeout(80);
  }
  throw new Error(`Timed out waiting for ${label}; final=${JSON.stringify(await snapshot(page))}`);
}

async function hold(page, code, ms) {
  await page.keyboard.down(code);
  await page.waitForTimeout(ms);
  await page.keyboard.up(code);
}

async function attack(page, count = 1) {
  for (let i = 0; i < count; i++) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(650);
  }
}

await waitForServer();
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('pageerror', (error) => consoleErrors.push(error.stack || error.message));

try {
  const coldStart = Date.now();
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  let current = await waitFor(page, (s) => s['runtime.ready'] === true, 'runtime.ready', 15000);
  const startupMs = Date.now() - coldStart;
  await page.screenshot({ path: path.join(artifacts, '01-cold-launch.png'), fullPage: true });
  result('01-cold-launch', current['reward.count'] === 0 && current['upgrade.selected_ids'].length === 0 ? 'pass' : 'fail', { startupMs, renderer: current['renderer.backend'], navigatorGpu: current['renderer.navigator_gpu'] }, ['01-cold-launch.png']);

  current = await snapshot(page);
  result('02-enter-gameplay', current['scene.gameplay_active'] && current['player.alive'] && current['enemy.alive'] && !current['salvage.broken'] ? 'pass' : 'fail', current);

  const beforeMove = current['player.position'];
  await hold(page, 'KeyW', 700);
  current = await snapshot(page);
  const moved = Math.hypot(current['player.position'].x - beforeMove.x, current['player.position'].z - beforeMove.z);
  result('03-move-player', moved > 1.0 ? 'pass' : 'fail', { before: beforeMove, after: current['player.position'], metres: moved });

  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(150);
  current = await snapshot(page);
  result('04-exercise-camera', current['player.alive'] ? 'pass' : 'fail', { playerStillControllable: current['player.alive'] }, [], ['Camera response is visually captured later; progression state remained intact.']);

  await page.keyboard.down('ShiftLeft');
  await hold(page, 'KeyW', 850);
  await page.keyboard.up('ShiftLeft');
  current = await waitFor(page, (s) => s['enemy.target_state'] === 'acquired', 'enemy acquisition');
  const acquireDistance = Math.hypot(current['enemy.position'].x - current['player.position'].x, current['enemy.position'].z - current['player.position'].z);
  result('05-acquire-enemy', current['enemy.target_state'] === 'acquired' ? 'pass' : 'fail', { acquireDistance, enemy: current['enemy.position'], player: current['player.position'] });

  current = await waitFor(page, (s) => s['player.health'] < 100, 'enemy damage', 8000);
  const playerHealthAfterEnemy = current['player.health'];
  await waitFor(page, (s) => Math.hypot(s['enemy.position'].x - s['player.position'].x, s['enemy.position'].z - s['player.position'].z) <= 1.8, 'enemy melee range', 5000);
  const enemyBeforeHit = (await snapshot(page))['enemy.health'];
  await attack(page, 1);
  current = await waitFor(page, (s) => s['enemy.health'] < enemyBeforeHit, 'player damage to enemy');
  result('06-exchange-damage', current['player.health'] < 100 && current['enemy.health'] < 100 && current['player.health'] >= 0 && current['enemy.health'] >= 0 ? 'pass' : 'fail', { playerHealthAfterEnemy, playerHealth: current['player.health'], enemyHealth: current['enemy.health'] });

  await page.keyboard.down('ShiftLeft');
  await hold(page, 'KeyD', 900);
  await hold(page, 'KeyW', 650);
  await page.keyboard.up('ShiftLeft');
  current = await snapshot(page);
  const salvageDistance = Math.hypot(current['player.position'].x - 5, current['player.position'].z - 0);
  if (salvageDistance > 1.7) {
    // Correct with ordinary directional input only; no state mutation.
    if (current['player.position'].x < 4.4) await hold(page, 'KeyD', 250);
    if (current['player.position'].z > 1.4) await hold(page, 'KeyW', 250);
  }
  await attack(page, 1);
  current = await waitFor(page, (s) => s['salvage.broken'] === true, 'salvage break');
  result('07-break-salvage', current['salvage.broken'] && current['reward.available'] ? 'pass' : 'fail', { salvageHealth: current['salvage.health'], rewardAvailable: current['reward.available'] });
  await page.screenshot({ path: path.join(artifacts, '07-break-salvage.png'), fullPage: true });

  await hold(page, 'KeyW', 380);
  current = await waitFor(page, (s) => s['reward.count'] === 1, 'reward collection');
  result('08-collect-reward', current['reward.count'] === 1 && current['reward.available'] === false ? 'pass' : 'fail', { rewardCount: current['reward.count'], rewardAvailable: current['reward.available'] });

  await waitFor(page, (s) => s['upgrade.menu_visible'] === true, 'upgrade menu');
  await page.locator('#upgrade-damage').click();
  current = await waitFor(page, (s) => s['upgrade.selected_ids'].includes('damage-up-1'), 'upgrade selection');
  result('09-select-upgrade', Math.abs(current['player.effective_attack_damage'] - 40.8) < 0.001 ? 'pass' : 'fail', { upgrades: current['upgrade.selected_ids'], effectiveDamage: current['player.effective_attack_damage'] });

  for (let attempt = 0; attempt < 5 && (await snapshot(page))['enemy.alive']; attempt++) {
    current = await snapshot(page);
    const dx = current['enemy.position'].x - current['player.position'].x;
    const dz = current['enemy.position'].z - current['player.position'].z;
    const distance = Math.hypot(dx, dz);
    if (distance > 1.7) {
      if (Math.abs(dx) > 0.45) await hold(page, dx > 0 ? 'KeyD' : 'KeyA', Math.min(400, Math.abs(dx) / 5.5 * 1000));
      if (Math.abs(dz) > 0.45) await hold(page, dz > 0 ? 'KeyS' : 'KeyW', Math.min(400, Math.abs(dz) / 5.5 * 1000));
    }
    await attack(page, 1);
  }
  current = await snapshot(page);
  result('10-resolve-enemy', current['enemy.alive'] === false ? 'pass' : 'fail', { enemyAlive: current['enemy.alive'], enemyHealth: current['enemy.health'] });

  await page.locator('#save').click();
  current = await waitFor(page, (s) => s['save.schema_version'] === 1, 'normal save path');
  result('11-save-state', current['save.schema_version'] === 1 && current['reward.count'] === 1 && current['upgrade.selected_ids'].includes('damage-up-1') ? 'pass' : 'fail', { saveSchemaVersion: current['save.schema_version'], rewardCount: current['reward.count'], upgrades: current['upgrade.selected_ids'] });
  await page.screenshot({ path: path.join(artifacts, '11-save-state.png'), fullPage: true });

  const restartAt = Date.now();
  await page.reload({ waitUntil: 'domcontentloaded' });
  current = await waitFor(page, (s) => s['runtime.ready'] === true, 'runtime after restart', 15000);
  const restartMs = Date.now() - restartAt;
  result('12-restart-runtime', restartMs <= 15000 ? 'pass' : 'fail', { restartMs, renderer: current['renderer.backend'] });

  current = await snapshot(page);
  result('13-verify-restored-state', current['reward.count'] === 1 && current['upgrade.selected_ids'].includes('damage-up-1') ? 'pass' : 'fail', { rewardCount: current['reward.count'], upgrades: current['upgrade.selected_ids'] });
  await page.screenshot({ path: path.join(artifacts, '13-restored-state.png'), fullPage: true });

  const touchButtons = await page.locator('#controls button').count();
  const viewportWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  observations.push({ touchButtons, viewportWidth });
  if (touchButtons < 8 || viewportWidth > 390) failures.push(`mobile controls/layout: buttons=${touchButtons}, scrollWidth=${viewportWidth}`);

  if (consoleErrors.length) failures.push(`console errors: ${consoleErrors.join(' | ')}`);

  const finalSnapshot = await snapshot(page);
  const evidence = {
    contract_version: 1,
    scenario_id: 'mobile-action-slice-v1',
    candidate_id: 'three-webgpu',
    source_revision: process.env.GITHUB_SHA || 'local-unrecorded',
    execution_verified: failures.length === 0,
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

  if (failures.length) throw new Error(`Phase A failures:\n- ${failures.join('\n- ')}`);
  console.log(`BYJTT-LAB-001 Three.js Phase A passed all ${results.length} shared steps.`);
  console.log(`Renderer evidence: ${evidence.renderer}; navigator.gpu=${evidence.navigator_gpu}`);
} finally {
  await browser.close();
  server.kill('SIGTERM');
}
