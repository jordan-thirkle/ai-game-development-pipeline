import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import process from 'node:process';

const evidenceDir = process.env.EVIDENCE_DIR ?? 'evidence';
await mkdir(evidenceDir, { recursive: true });

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4173'], {
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', (chunk) => { serverLog += chunk; });
server.stderr.on('data', (chunk) => { serverLog += chunk; });

const serverDeadline = Date.now() + 30_000;
while (!serverLog.includes('4173') && Date.now() < serverDeadline) await new Promise((resolve) => setTimeout(resolve, 100));
if (Date.now() >= serverDeadline) throw new Error(`Vite server did not become ready:\n${serverLog}`);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const consoleErrors = [];
const consoleMessages = [];
const pageErrors = [];
page.on('console', (message) => {
  consoleMessages.push(`[${message.type()}] ${message.text()}`);
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('pageerror', (error) => pageErrors.push(String(error)));

try {
  await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle', timeout: 30_000 });
  await page.waitForFunction(() => window.__BYJTT_BABYLON_COMBAT__?.snapshot().ready === true, null, { timeout: 30_000 });
  await page.screenshot({ path: `${evidenceDir}/before-input.png`, fullPage: true });

  const initial = await page.evaluate(() => window.__BYJTT_BABYLON_COMBAT__.snapshot());
  await page.keyboard.down('KeyS');
  try {
    await page.waitForFunction(() => window.__BYJTT_BABYLON_COMBAT__.snapshot().acquired === true, null, { timeout: 10_000 });
  } finally {
    await page.keyboard.up('KeyS');
  }

  await page.waitForFunction(() => window.__BYJTT_BABYLON_COMBAT__.snapshot().enemy_attack_count >= 1, null, { timeout: 12_000 });
  await page.waitForTimeout(350);
  const beforeCooldown = await page.evaluate(() => window.__BYJTT_BABYLON_COMBAT__.snapshot());
  if (beforeCooldown.enemy_attack_count !== 1 || beforeCooldown.player_health !== 80) {
    throw new Error(`Enemy repeated before cooldown: ${JSON.stringify({ count: beforeCooldown.enemy_attack_count, health: beforeCooldown.player_health })}`);
  }

  await page.waitForFunction(() => window.__BYJTT_BABYLON_COMBAT__.snapshot().enemy_attack_count >= 2, null, { timeout: 5_000 });
  const result = await page.evaluate(() => window.__BYJTT_BABYLON_COMBAT__.snapshot());
  await page.screenshot({ path: `${evidenceDir}/after-combat.png`, fullPage: true });

  if (result.babylon_version !== '9.20.0') throw new Error(`Unexpected Babylon version ${result.babylon_version}`);
  if (result.havok_plugin_version !== 2) throw new Error(`Unexpected Havok plugin version ${result.havok_plugin_version}`);
  if (result.navigation_plugin !== 'RecastNavigationJSPlugin') throw new Error(`Unexpected navigation plugin ${result.navigation_plugin}`);
  if (result.recast_version !== '0.43.1') throw new Error(`Unexpected Recast version ${result.recast_version}`);
  if (result.arena.width !== 24 || result.arena.depth !== 32) throw new Error('Shared arena constants changed');
  if (result.player_spawn.x !== 0 || result.player_spawn.y !== 0 || result.player_spawn.z !== 10) throw new Error('Player spawn changed');
  if (result.enemy_spawn.x !== 0 || result.enemy_spawn.y !== 0 || result.enemy_spawn.z !== -6) throw new Error('Enemy spawn changed');
  if (result.player_speed !== 3.5 || result.enemy_speed !== 2.7 || result.acquire_range !== 12) throw new Error('Shared movement/acquisition constants changed');
  if (result.player_max_health !== 100 || result.enemy_attack_range !== 1.6 || result.enemy_attack_damage !== 20 || result.enemy_attack_cooldown !== 1.1) throw new Error('Shared enemy combat constants changed');
  if (Math.abs(result.initial_distance - 16) > 0.05 || Math.abs(initial.initial_distance - 16) > 0.05) throw new Error(`Unexpected initial distance ${result.initial_distance}`);
  if (!(result.last_distance_before_acquire > 12)) throw new Error(`Acquisition not proven false above threshold: ${result.last_distance_before_acquire}`);
  if (!(result.acquisition_distance <= 12 && result.acquisition_distance >= 11.8)) throw new Error(`Acquisition threshold crossing invalid: ${result.acquisition_distance}`);
  if (!result.acquired || result.path_points.length < 2 || !result.path_inside_arena) throw new Error('Native Recast acquisition/path invalid');
  if (result.max_enemy_step > (2.7 / 60) + 0.01) throw new Error(`Enemy exceeded movement bound ${result.max_enemy_step}`);
  if (!(result.first_attack_distance <= 1.6 && result.first_attack_distance >= 1.35)) throw new Error(`First attack range invalid: ${result.first_attack_distance}`);
  if (result.health_after_first_attack !== 80) throw new Error(`First attack damage invalid: ${result.health_after_first_attack}`);
  if (result.enemy_attack_count !== 2 || result.player_health !== 60) throw new Error(`Second attack result invalid: ${JSON.stringify({ count: result.enemy_attack_count, health: result.player_health })}`);
  if (!(result.second_attack_time - result.first_attack_time >= 1.1 - (1 / 60) - 0.001)) throw new Error(`Enemy cooldown violated: ${result.second_attack_time - result.first_attack_time}`);
  if (result.cooldown_blocked_steps < 1) throw new Error('No in-range cooldown-blocked simulation step observed');
  if (result.player_release_drift > 0.08) throw new Error(`Player release drift too high ${result.player_release_drift}`);
  if (Math.abs(result.player_position.x) > 12 || Math.abs(result.player_position.z) > 16) throw new Error('Player left arena');
  if (Math.abs(result.enemy_position.x) > 12 || Math.abs(result.enemy_position.z) > 16) throw new Error('Enemy left arena');
  if (result.key_down_callbacks < 1 || result.key_up_callbacks < 1 || !result.external_input_executed) throw new Error('Physical keyboard input not observed');
  if (!result.enemy_combat_executed) throw new Error('Enemy combat did not execute');
  if (result.player_attack_executed) throw new Error('Gate overclaimed player attack');
  if (result.direct_health_setter_exposed) throw new Error('Privileged health mutation surface exposed');
  if (!result.observation_isolation) throw new Error('Observation isolation failed');
  if (result.post_navigation_clamp || result.post_physics_arena_clamp) throw new Error('Position clamp is forbidden');
  if (result.render_frames < 1 || result.simulation_steps < 1) throw new Error('Rendered/simulation execution missing');
  if (consoleErrors.length || pageErrors.length) throw new Error(`Browser errors: ${JSON.stringify({ consoleErrors, pageErrors })}`);

  const payload = { ...result, cooldown_probe: beforeCooldown, consoleErrors, pageErrors, passed: true };
  const json = `${JSON.stringify(payload, null, 2)}\n`;
  await writeFile(`${evidenceDir}/runtime-result.json`, json);
  await writeFile(`${evidenceDir}/runtime.log`, serverLog);
  await writeFile(`${evidenceDir}/browser-console.log`, `${consoleMessages.join('\n')}\n`);
  await writeFile(`${evidenceDir}/runtime-result.sha256`, `${createHash('sha256').update(json).digest('hex')}  runtime-result.json\n`);
  console.log(json);
} catch (error) {
  const diagnostics = {
    error: String(error),
    consoleErrors,
    consoleMessages,
    pageErrors,
    snapshot: await page.evaluate(() => window.__BYJTT_BABYLON_COMBAT__?.snapshot()).catch(() => null),
  };
  await page.screenshot({ path: `${evidenceDir}/runtime-failure.png`, fullPage: true }).catch(() => undefined);
  await writeFile(`${evidenceDir}/runtime-failure.json`, `${JSON.stringify(diagnostics, null, 2)}\n`);
  await writeFile(`${evidenceDir}/runtime.log`, serverLog);
  throw error;
} finally {
  await browser.close();
  server.kill('SIGTERM');
}
