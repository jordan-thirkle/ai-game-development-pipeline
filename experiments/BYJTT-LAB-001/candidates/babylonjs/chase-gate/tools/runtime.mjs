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
  await page.waitForFunction(() => window.__BYJTT_BABYLON_CHASE__?.snapshot().ready === true, null, { timeout: 30_000 });
  await page.screenshot({ path: `${evidenceDir}/before-input.png`, fullPage: true });

  const initial = await page.evaluate(() => window.__BYJTT_BABYLON_CHASE__.snapshot());
  await page.keyboard.down('KeyS');
  try {
    await page.waitForFunction(() => window.__BYJTT_BABYLON_CHASE__.snapshot().acquired === true, null, { timeout: 10_000 });
  } finally {
    await page.keyboard.up('KeyS');
  }

  await page.waitForFunction(() => window.__BYJTT_BABYLON_CHASE__.snapshot().chase_steps >= 120, null, { timeout: 10_000 });
  await page.waitForTimeout(250);
  const result = await page.evaluate(() => window.__BYJTT_BABYLON_CHASE__.snapshot());
  await page.screenshot({ path: `${evidenceDir}/after-chase.png`, fullPage: true });

  if (result.babylon_version !== '9.20.0') throw new Error(`Unexpected Babylon version ${result.babylon_version}`);
  if (result.havok_plugin_version !== 2) throw new Error(`Unexpected Havok plugin version ${result.havok_plugin_version}`);
  if (result.navigation_plugin !== 'RecastNavigationJSPlugin') throw new Error(`Unexpected navigation plugin ${result.navigation_plugin}`);
  if (result.recast_version !== '0.43.1') throw new Error(`Unexpected Recast version ${result.recast_version}`);
  if (result.arena.width !== 24 || result.arena.depth !== 32) throw new Error('Shared arena constants changed');
  if (result.player_spawn.x !== 0 || result.player_spawn.y !== 0 || result.player_spawn.z !== 10) throw new Error('Player spawn changed');
  if (result.enemy_spawn.x !== 0 || result.enemy_spawn.y !== 0 || result.enemy_spawn.z !== -6) throw new Error('Enemy spawn changed');
  if (result.player_speed !== 3.5 || result.enemy_speed !== 2.7 || result.acquire_range !== 12) throw new Error('Shared movement/acquisition constants changed');
  if (Math.abs(result.initial_distance - 16) > 0.05 || Math.abs(initial.initial_distance - 16) > 0.05) throw new Error(`Unexpected initial distance ${result.initial_distance}`);
  if (!(result.last_distance_before_acquire > 12)) throw new Error(`Acquisition was not proven false above threshold: ${result.last_distance_before_acquire}`);
  if (!(result.acquisition_distance <= 12 && result.acquisition_distance >= 11.8)) throw new Error(`Acquisition threshold crossing invalid: ${result.acquisition_distance}`);
  if (!result.acquired) throw new Error('Enemy never acquired player');
  if (result.path_points.length < 2 || !result.path_inside_arena) throw new Error('Native Recast path invalid');
  if (!(result.path_length >= 11 && result.path_length <= 12.5)) throw new Error(`Unexpected acquired path length ${result.path_length}`);
  if (result.chase_steps < 120) throw new Error(`Insufficient chase steps ${result.chase_steps}`);
  if (result.max_enemy_step > (2.7 / 60) + 0.01) throw new Error(`Enemy exceeded movement bound ${result.max_enemy_step}`);
  if (!(result.current_distance < result.acquisition_distance - 4)) throw new Error(`Insufficient chase reduction ${result.acquisition_distance} -> ${result.current_distance}`);
  if (result.player_release_drift > 0.08) throw new Error(`Player release drift too high ${result.player_release_drift}`);
  if (Math.abs(result.player_position.x) > 12 || Math.abs(result.player_position.z) > 16) throw new Error('Player left arena');
  if (Math.abs(result.enemy_position.x) > 12 || Math.abs(result.enemy_position.z) > 16) throw new Error('Enemy left arena');
  if (result.key_down_callbacks < 1 || result.key_up_callbacks < 1 || !result.external_input_executed) throw new Error('Physical keyboard input was not observed');
  if (!result.observation_isolation) throw new Error('Observation isolation failed');
  if (result.post_navigation_clamp || result.post_physics_arena_clamp) throw new Error('Position clamp is forbidden');
  if (result.combat_executed) throw new Error('Gate overclaimed combat execution');
  if (result.render_frames < 1 || result.simulation_steps < 1) throw new Error('Rendered/simulation execution missing');
  if (consoleErrors.length || pageErrors.length) throw new Error(`Browser errors: ${JSON.stringify({ consoleErrors, pageErrors })}`);

  const payload = { ...result, consoleErrors, pageErrors, passed: true };
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
    snapshot: await page.evaluate(() => window.__BYJTT_BABYLON_CHASE__?.snapshot()).catch(() => null),
  };
  await page.screenshot({ path: `${evidenceDir}/runtime-failure.png`, fullPage: true }).catch(() => undefined);
  await writeFile(`${evidenceDir}/runtime-failure.json`, `${JSON.stringify(diagnostics, null, 2)}\n`);
  await writeFile(`${evidenceDir}/runtime.log`, serverLog);
  throw error;
} finally {
  await browser.close();
  server.kill('SIGTERM');
}
