import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const gateDir = path.dirname(new URL(import.meta.url).pathname);
const candidateDir = path.resolve(gateDir, '..');
const artifactsDir = path.join(candidateDir, 'artifacts', 'pause-interact');
fs.mkdirSync(artifactsDir, { recursive: true });

const expectedHead = process.env.CANDIDATE_HEAD_SHA || '';
const url = 'http://127.0.0.1:4179';
const errors = [];
const heldMovementKeys = new Set();

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function waitForServer() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await sleep(125);
  }
  throw new Error('Vite preview did not become ready');
}

const server = spawn(process.execPath, [path.join(candidateDir, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--host', '127.0.0.1', '--port', '4179', '--strictPort'], {
  cwd: candidateDir,
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: true
});
let serverLog = '';
server.stdout.on('data', (chunk) => { serverLog += chunk.toString(); });
server.stderr.on('data', (chunk) => { serverLog += chunk.toString(); });

let browser;
let result;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.on('console', (message) => { if (message.type() === 'error') errors.push(`console:${message.text()}`); });
  page.on('pageerror', (error) => errors.push(`page:${error.message}`));
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__BYJTT_BENCHMARK__?.snapshot?.()['runtime.ready'] === true, null, { timeout: 30000 });

  const snapshot = () => page.evaluate(() => window.__BYJTT_BENCHMARK__.snapshot());

  async function applyMovementIntent(codes) {
    const next = new Set(codes.filter(Boolean));
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

  async function driveToward(targetX, targetZ, stopDistance, timeoutMs = 15000) {
    const started = Date.now();
    let current = await snapshot();
    while (Date.now() - started < timeoutMs) {
      current = await snapshot();
      if (!current['player.alive']) throw new Error('player died during pause-interact proof routing');
      const p = current['player.position'];
      const dx = targetX - p.x;
      const dz = targetZ - p.z;
      if (Math.hypot(dx, dz) <= stopDistance) break;
      const axisX = Math.abs(dx) >= 0.2 ? (dx > 0 ? 'KeyD' : 'KeyA') : null;
      const axisZ = Math.abs(dz) >= 0.2 ? (dz > 0 ? 'KeyS' : 'KeyW') : null;
      await applyMovementIntent([axisX, axisZ]);
      await sleep(90);
    }
    await releaseMovementIntent();
    await sleep(300);
    return snapshot();
  }

  const nearSalvage = await driveToward(5, 0, 1.35);
  const salvagePos = nearSalvage['player.position'];
  const salvageDistance = Math.hypot(salvagePos.x - 5, salvagePos.z);
  if (salvageDistance > 1.8) throw new Error(`did not enter salvage attack range: ${salvageDistance}`);

  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__BYJTT_BENCHMARK__.snapshot()['salvage.health'] === 0, null, { timeout: 3000 });

  let beforePause = await driveToward(5, -1.7, 1.0);
  if (beforePause['reward.count'] !== 1) {
    await page.waitForFunction(() => window.__BYJTT_BENCHMARK__.snapshot()['reward.count'] === 1, null, { timeout: 3000 });
    beforePause = await snapshot();
  }

  const upgradePanelVisible = await page.locator('#upgrade').isVisible();
  const damageBeforePause = beforePause['player.effective_attack_damage'];

  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__BYJTT_BENCHMARK__.snapshot().paused === true, null, { timeout: 3000 });
  const pausedBeforeInteract = await snapshot();

  await page.keyboard.press('KeyE');
  await sleep(350);
  const pausedAfterInteract = await snapshot();

  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__BYJTT_BENCHMARK__.snapshot().paused === false, null, { timeout: 3000 });
  await sleep(450);
  const afterResume = await snapshot();

  await page.screenshot({ path: path.join(artifactsDir, 'after-resume.png'), fullPage: true });

  const rewardEarned = beforePause['reward.count'] === 1;
  const baselineDamage = Math.abs(damageBeforePause - 34) < 0.001;
  const unchangedWhilePaused = Math.abs(pausedAfterInteract['player.effective_attack_damage'] - damageBeforePause) < 0.001;
  const unchangedAfterResume = Math.abs(afterResume['player.effective_attack_damage'] - damageBeforePause) < 0.001;
  const blockerReproduced = rewardEarned && upgradePanelVisible && baselineDamage && unchangedWhilePaused && !unchangedAfterResume;
  const passed = rewardEarned && upgradePanelVisible && baselineDamage && unchangedWhilePaused && unchangedAfterResume && errors.length === 0;

  result = {
    tested_revision: expectedHead,
    proof_state: passed ? 'pause-interact-release-proven' : blockerReproduced ? 'blocked-paused-interact-leak' : 'pause-interact-proof-failed',
    passed,
    human_tested: false,
    physical_device_executed: false,
    production_source_modified_by_gate: false,
    direct_gameplay_mutation_surface_exposed: false,
    interact_input_transport: 'physical-browser-keyboard',
    salvage_attack_range_m: 1.8,
    salvage_distance_before_attack_m: salvageDistance,
    reward_count_before_pause: beforePause['reward.count'],
    upgrade_panel_visible_before_pause: upgradePanelVisible,
    effective_attack_damage_before_pause: damageBeforePause,
    effective_attack_damage_while_paused_after_interact: pausedAfterInteract['player.effective_attack_damage'],
    effective_attack_damage_after_resume: afterResume['player.effective_attack_damage'],
    paused_before_interact: pausedBeforeInteract.paused,
    paused_after_interact: pausedAfterInteract.paused,
    resumed: afterResume.paused === false,
    observation_copy_only: true,
    browser_errors: errors,
    failures: [
      ...(rewardEarned ? [] : ['reward was not earned through gameplay before pause']),
      ...(upgradePanelVisible ? [] : ['upgrade panel was not visible after legitimate reward pickup']),
      ...(baselineDamage ? [] : [`unexpected pre-interact damage: ${damageBeforePause}`]),
      ...(unchangedWhilePaused ? [] : ['upgrade changed while paused']),
      ...(unchangedAfterResume ? [] : ['paused interact was replayed after resume']),
      ...errors
    ]
  };
  fs.writeFileSync(path.join(artifactsDir, 'runtime-result.json'), `${JSON.stringify(result, null, 2)}\n`);
  if (!passed) process.exitCode = 1;
} catch (error) {
  result = {
    tested_revision: expectedHead,
    proof_state: 'pause-interact-proof-failed',
    passed: false,
    human_tested: false,
    production_source_modified_by_gate: false,
    failures: [error?.stack || String(error), ...errors]
  };
  fs.writeFileSync(path.join(artifactsDir, 'runtime-result.json'), `${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = 1;
} finally {
  fs.writeFileSync(path.join(artifactsDir, 'vite-preview.log'), serverLog);
  if (browser) await browser.close();
  try { process.kill(-server.pid, 'SIGTERM'); } catch {}
}
