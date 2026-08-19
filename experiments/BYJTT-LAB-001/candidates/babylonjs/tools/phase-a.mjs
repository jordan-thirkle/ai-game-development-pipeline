import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const PORT = 4176;
const URL = `http://127.0.0.1:${PORT}`;
const artifacts = path.resolve('artifacts/phase-a');
await mkdir(artifacts, { recursive: true });

const server = spawn(process.execPath, [
  path.resolve('node_modules/vite/bin/vite.js'),
  'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort',
], { stdio: ['ignore', 'pipe', 'pipe'] });

let serverLog = '';
server.stdout.on('data', (chunk) => { serverLog += chunk.toString(); });
server.stderr.on('data', (chunk) => { serverLog += chunk.toString(); });

async function waitForServer() {
  for (let i = 0; i < 40; i += 1) {
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
let context = null;
let cdp = null;
let tracingStarted = false;
let feedbackBeforeRestart = null;

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
    if (current?.['runtime.errors']?.length) throw new Error(`Runtime failed while waiting for ${label}: ${current['runtime.errors'].join(' | ')}`);
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
  for (let i = 0; i < count; i += 1) {
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
  label = 'target',
} = {}) {
  let current = await ensurePlayerAlive();
  const simulationStart = current['elapsed_seconds'];
  const wallStart = Date.now();
  try {
    while (Date.now() - wallStart < maxWallMs && current['elapsed_seconds'] - simulationStart < maxSimulationSeconds) {
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
  return driveToward(() => ({ x: targetX, z: targetZ }), {
    tolerance, maxSimulationSeconds, stopPredicate, label: `target (${targetX}, ${targetZ})`,
  });
}

async function moveTowardEnemy(tolerance = 1.45, maxSimulationSeconds = 10) {
  return driveToward((current) => current['enemy.alive'] ? current['enemy.position'] : null, {
    tolerance,
    maxSimulationSeconds,
    stopPredicate: (current) => !current['enemy.alive'],
    label: 'moving enemy',
  });
}

async function breakSalvageThroughGameplay(maxAttempts = 4) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
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
        1800,
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
  const feedbackSource = feedbackBeforeRestart || finalSnapshot;
  const evidence = {
    contract_version: 1,
    scenario_id: 'mobile-action-slice-v1',
    candidate_id: 'babylonjs',
    tested_revision: process.env.GITHUB_SHA || 'local-unrecorded',
    candidate_head_revision: process.env.CANDIDATE_HEAD_SHA || null,
    execution_verified: failures.length === 0 && results.length === 13 && results.every((step) => step.status === 'pass'),
    browser: 'Google Chrome via Playwright channel=chrome',
    renderer: finalSnapshot?.['renderer.backend'] ?? 'unknown',
    navigator_gpu: finalSnapshot?.['renderer.navigator_gpu'] ?? null,
    havok_plugin_version: finalSnapshot?.['physics.plugin_version'] ?? null,
    performance: {
      startup_ms: finalSnapshot?.['startup.ms'] ?? null,
      render_frames: finalSnapshot?.['render.frames'] ?? null,
      simulation_steps: finalSnapshot?.['simulation.steps'] ?? null,
      dropped_simulation_seconds: finalSnapshot?.['simulation.dropped_seconds'] ?? null,
    },
    feedback_before_restart: {
      vfx_events: feedbackSource?.['feedback.vfx_events'] ?? null,
      hit_reactions: feedbackSource?.['feedback.hit_reactions'] ?? null,
      audio_supported: feedbackSource?.['audio.supported'] ?? null,
      audio_events: feedbackSource?.['audio.events'] ?? null,
      audio_context_state: feedbackSource?.['audio.context_state'] ?? null,
      audio_failures: feedbackSource?.['audio.failures'] ?? [],
    },
    capture: {
      trace: 'phase-a-trace.zip',
      screenshots: ['01-cold-launch.png', '04-exercise-camera.png', '07-break-salvage.png', '11-save-state.png', '13-restored-state.png'],
    },
    steps: results,
    failures,
    console_errors: consoleErrors,
    extra_observations: observations,
    final_snapshot: finalSnapshot,
    deviations: [
      'Phase A uses Babylon greybox primitives; frozen shared production assets remain Phase B.',
      'Havok Physics V2 owns the static arena environment while player/enemy locomotion uses a thin deterministic game-specific kinematic layer in the unobstructed arena.',
      'Enemy navigation uses direct steering; Recast is deferred until obstacle/pathfinding evidence requires it.',
      'Phase A animation and feedback use deterministic procedural transforms, mesh-spark VFX and synthesized WebAudio rather than production assets.',
    ],
  };
  await writeFile(path.join(artifacts, 'playtest-result.json'), JSON.stringify(evidence, null, 2));
  await writeFile(path.join(artifacts, 'server.log'), serverLog);
  return evidence;
}

try {
  await waitForServer();
  browser = await chromium.launch({ headless: true, channel: 'chrome' });
  context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: false });
  tracingStarted = true;
  page = await context.newPage();
  cdp = await context.newCDPSession(page);
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => consoleErrors.push(error.stack || error.message));

  const coldStart = Date.now();
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  let current = await waitFor((s) => s['runtime.ready'] === true, 'runtime.ready', 15000);
  const startupMs = Date.now() - coldStart;
  await page.screenshot({ path: path.join(artifacts, '01-cold-launch.png'), fullPage: true });
  result('01-cold-launch', current['reward.count'] === 0 && current['upgrade.selected_ids'].length === 0 ? 'pass' : 'fail', {
    startupMs, renderer: current['renderer.backend'], navigatorGpu: current['renderer.navigator_gpu'], havok: current['physics.plugin_version'],
  }, ['01-cold-launch.png']);

  current = await snapshot();
  result('02-enter-gameplay', current['scene.gameplay_active'] && current['player.alive'] && current['enemy.alive'] && !current['salvage.broken'] && current['player.animation_state'] === 'idle' ? 'pass' : 'fail', current);

  const beforeMove = current['player.position'];
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(300);
  const walkSnapshot = await snapshot();
  await page.keyboard.up('KeyW');
  await page.keyboard.down('ShiftLeft');
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(300);
  const runSnapshot = await snapshot();
  await page.keyboard.up('KeyW');
  await page.keyboard.up('ShiftLeft');
  current = await snapshot();
  const moved = Math.hypot(current['player.position'].x - beforeMove.x, current['player.position'].z - beforeMove.z);
  result('03-move-player', moved > 1.0 && walkSnapshot['player.animation_state'] === 'walk' && runSnapshot['player.animation_state'] === 'run' ? 'pass' : 'fail', {
    before: beforeMove,
    after: current['player.position'],
    metres: moved,
    idleAnimation: 'idle',
    walkAnimation: walkSnapshot['player.animation_state'],
    runAnimation: runSnapshot['player.animation_state'],
  });

  const touchBefore = current['player.position'];
  const touchRight = page.locator('[data-hold="KeyD"]');
  const touchBox = await touchRight.boundingBox();
  if (!touchBox) throw new Error('Touch movement control has no bounding box');
  const touchPoint = { x: touchBox.x + touchBox.width / 2, y: touchBox.y + touchBox.height / 2 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touchPoint] });
  await page.waitForTimeout(320);
  const touchDuring = await snapshot();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const touchMoved = Math.hypot(touchDuring['player.position'].x - touchBefore.x, touchDuring['player.position'].z - touchBefore.z);
  observations.push({ touchMovementMetres: touchMoved, touchAnimation: touchDuring['player.animation_state'], touchPoint });
  if (touchMoved <= 0.35) failures.push(`touch movement did not move player enough: ${touchMoved}`);

  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(150);
  current = await snapshot();
  await page.screenshot({ path: path.join(artifacts, '04-exercise-camera.png'), fullPage: true });
  result('04-exercise-camera', current['player.alive'] ? 'pass' : 'fail', { playerStillControllable: current['player.alive'] }, ['04-exercise-camera.png']);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(150);

  for (let attempt = 0; attempt < 12; attempt += 1) {
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
  result('06-exchange-damage', current['player.health'] < 100
    && current['enemy.health'] < 100
    && current['player.health'] >= 0
    && current['enemy.health'] >= 0
    && current['feedback.hit_reactions'] >= 2
    && current['feedback.vfx_events'] >= 2
    && current['audio.events'] >= 2 ? 'pass' : 'fail', {
    playerHealthAfterEnemy,
    playerHealth: current['player.health'],
    enemyHealth: current['enemy.health'],
    hitReactions: current['feedback.hit_reactions'],
    vfxEvents: current['feedback.vfx_events'],
    audioEvents: current['audio.events'],
  });

  current = await breakSalvageThroughGameplay();
  await page.screenshot({ path: path.join(artifacts, '07-break-salvage.png'), fullPage: true });
  result('07-break-salvage', current['salvage.broken'] && current['feedback.vfx_events'] >= 4 && current['audio.events'] >= 4 ? 'pass' : 'fail', {
    salvageHealth: current['salvage.health'],
    rewardAvailable: current['reward.available'],
    rewardCount: current['reward.count'],
    vfxEvents: current['feedback.vfx_events'],
    audioEvents: current['audio.events'],
  }, ['07-break-salvage.png']);

  current = await snapshot();
  if (current['reward.count'] !== 1) {
    if (!current['reward.available']) throw new Error(`Reward neither collected nor available after salvage; state=${JSON.stringify(current)}`);
    await moveToward(5, -1.7, 0.9, 12, (s) => s['reward.count'] === 1);
    current = await waitFor((s) => s['reward.count'] === 1, 'reward collection');
  }
  result('08-collect-reward', current['reward.count'] === 1 && current['reward.available'] === false ? 'pass' : 'fail', {
    rewardCount: current['reward.count'], rewardAvailable: current['reward.available'],
  });

  await waitFor((s) => s['upgrade.menu_visible'] === true, 'upgrade menu');
  await page.locator('#upgrade-damage').click();
  current = await waitFor((s) => s['upgrade.selected_ids'].includes('damage-up-1'), 'upgrade selection');
  result('09-select-upgrade', Math.abs(current['player.effective_attack_damage'] - 40.8) < 0.001 ? 'pass' : 'fail', {
    upgrades: current['upgrade.selected_ids'], effectiveDamage: current['player.effective_attack_damage'],
  });

  for (let attempt = 0; attempt < 6; attempt += 1) {
    current = await snapshot();
    if (!current['enemy.alive']) break;
    await ensurePlayerAlive();
    await moveTowardEnemy(1.5, 10);
    await attack(1);
  }
  current = await snapshot();
  result('10-resolve-enemy', current['enemy.alive'] === false ? 'pass' : 'fail', {
    enemyAlive: current['enemy.alive'], enemyHealth: current['enemy.health'], playerHealth: current['player.health'], playerAlive: current['player.alive'],
  });

  await page.locator('#save').click();
  current = await waitFor((s) => s['save.schema_version'] === 1, 'normal save path');
  result('11-save-state', current['save.schema_version'] === 1 && current['reward.count'] === 1 && current['upgrade.selected_ids'].includes('damage-up-1') ? 'pass' : 'fail', {
    saveSchemaVersion: current['save.schema_version'], rewardCount: current['reward.count'], upgrades: current['upgrade.selected_ids'],
  });
  feedbackBeforeRestart = current;
  observations.push({
    feedbackBeforeRestart: {
      vfxEvents: current['feedback.vfx_events'],
      hitReactions: current['feedback.hit_reactions'],
      audioSupported: current['audio.supported'],
      audioEvents: current['audio.events'],
      audioContextState: current['audio.context_state'],
      audioFailures: current['audio.failures'],
    },
  });
  await page.screenshot({ path: path.join(artifacts, '11-save-state.png'), fullPage: true });

  const restartAt = Date.now();
  await page.reload({ waitUntil: 'domcontentloaded' });
  current = await waitFor((s) => s['runtime.ready'] === true, 'runtime after restart', 15000);
  const restartMs = Date.now() - restartAt;
  result('12-restart-runtime', restartMs <= 15000 ? 'pass' : 'fail', { restartMs, renderer: current['renderer.backend'], havok: current['physics.plugin_version'] });

  current = await snapshot();
  result('13-verify-restored-state', current['reward.count'] === 1 && current['upgrade.selected_ids'].includes('damage-up-1') ? 'pass' : 'fail', {
    rewardCount: current['reward.count'], upgrades: current['upgrade.selected_ids'],
  });
  await page.screenshot({ path: path.join(artifacts, '13-restored-state.png'), fullPage: true });

  const touchButtons = await page.locator('#controls button').count();
  const viewport = await page.evaluate(() => ({
    innerWidth,
    innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
  }));
  const mutationIsolation = await page.evaluate(() => {
    const first = window.__BYJTT_BENCHMARK__.snapshot();
    const originalX = first['player.position'].x;
    const originalUpgrades = first['upgrade.selected_ids'].length;
    try {
      first['player.position'].x = 999;
      first['upgrade.selected_ids'].push('mutated-by-test');
    } catch {}
    const second = window.__BYJTT_BENCHMARK__.snapshot();
    return second['player.position'].x === originalX && second['upgrade.selected_ids'].length === originalUpgrades;
  });
  observations.push({ touchButtons, viewport, mutationIsolation });

  if (touchButtons < 8 || viewport.scrollWidth > 390 || viewport.innerWidth !== 390 || viewport.innerHeight !== 844) {
    failures.push(`mobile controls/layout: buttons=${touchButtons}, viewport=${JSON.stringify(viewport)}`);
  }
  if (!mutationIsolation) failures.push('snapshot mutation affected later observations');
  if (!feedbackBeforeRestart?.['audio.supported'] || feedbackBeforeRestart['audio.events'] < 1 || feedbackBeforeRestart['audio.failures'].length) {
    failures.push(`audio feedback unavailable or failed before restart: supported=${feedbackBeforeRestart?.['audio.supported']} events=${feedbackBeforeRestart?.['audio.events']} failures=${JSON.stringify(feedbackBeforeRestart?.['audio.failures'] ?? [])}`);
  }
  if ((feedbackBeforeRestart?.['feedback.vfx_events'] ?? 0) < 1 || (feedbackBeforeRestart?.['feedback.hit_reactions'] ?? 0) < 1) {
    failures.push(`visual feedback evidence missing before restart: vfx=${feedbackBeforeRestart?.['feedback.vfx_events']} hitReactions=${feedbackBeforeRestart?.['feedback.hit_reactions']}`);
  }
  if (consoleErrors.length) failures.push(`console errors: ${consoleErrors.join(' | ')}`);

  const evidence = await writeEvidence();
  if (failures.length) throw new Error(`Phase A failures:\n- ${failures.join('\n- ')}`);
  console.log(`BYJTT-LAB-001 Babylon.js Phase A passed all ${results.length} shared steps plus animation, touch, VFX, audio and observation-isolation gates.`);
  console.log(`Renderer evidence: ${evidence.renderer}; Havok plugin=${evidence.havok_plugin_version}; navigator.gpu=${evidence.navigator_gpu}`);
} catch (error) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  await writeEvidence(message);
  throw error;
} finally {
  await releaseMovementIntent().catch(() => {});
  if (context && tracingStarted) {
    await context.tracing.stop({ path: path.join(artifacts, 'phase-a-trace.zip') }).catch((error) => {
      failures.push(`trace capture failed: ${error instanceof Error ? error.message : String(error)}`);
    });
  }
  await browser?.close();
  server.kill('SIGTERM');
}
