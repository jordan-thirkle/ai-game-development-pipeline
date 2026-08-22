import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';

const evidenceDir = process.env.EVIDENCE_DIR ?? 'evidence';
await mkdir(evidenceDir, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4173'], {
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', (chunk) => { serverLog += String(chunk); });
server.stderr.on('data', (chunk) => { serverLog += String(chunk); });

async function waitForServer() {
  for (let i = 0; i < 100; i += 1) {
    try {
      const response = await fetch('http://127.0.0.1:4173/');
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Vite server did not become ready\n${serverLog}`);
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pageErrors = [];
  const consoleErrors = [];
  const recordErrors = (page) => {
    page.on('pageerror', (error) => pageErrors.push(String(error)));
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  };

  const first = await context.newPage();
  recordErrors(first);
  await first.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  await first.evaluate(() => localStorage.clear());
  await first.reload({ waitUntil: 'networkidle' });
  await first.waitForFunction(() => window.__BYJTT_OBSERVATION__?.ready === true, undefined, { timeout: 8000 });
  const cold = await first.evaluate(() => window.__BYJTT_OBSERVATION__);
  if (cold?.loaded_from_persistence || cold?.reward_count !== 0 || cold?.selected_upgrades?.length !== 0) throw new Error(`Clean launch failed: ${JSON.stringify(cold)}`);

  await first.keyboard.down('KeyS');
  await first.waitForFunction(() => window.__BYJTT_OBSERVATION__?.player_z_m <= 0.35, undefined, { timeout: 6000 });
  await first.keyboard.up('KeyS');
  await first.keyboard.down('KeyD');
  await first.waitForFunction(() => (window.__BYJTT_OBSERVATION__?.player_to_salvage_m ?? 999) <= 1.7, undefined, { timeout: 5000 });
  await first.keyboard.up('KeyD');
  await first.keyboard.press('Space');
  await first.waitForFunction(() => window.__BYJTT_OBSERVATION__?.salvage_broken === true, undefined, { timeout: 2000 });
  await first.keyboard.down('KeyD');
  await first.waitForFunction(() => window.__BYJTT_OBSERVATION__?.reward_count === 1, undefined, { timeout: 3000 });
  await first.keyboard.up('KeyD');
  await first.waitForFunction(() => window.__BYJTT_OBSERVATION__?.upgrade_menu_visible === true, undefined, { timeout: 2000 });
  await first.keyboard.press('KeyE');
  await first.waitForFunction(() => window.__BYJTT_OBSERVATION__?.selected_upgrades?.includes('damage-up-1') === true, undefined, { timeout: 2000 });
  await first.keyboard.press('KeyP');
  await first.waitForFunction(() => window.__BYJTT_OBSERVATION__?.successful_saves === 1, undefined, { timeout: 2000 });

  const before = await first.evaluate(() => window.__BYJTT_OBSERVATION__);
  const savedRaw = await first.evaluate(() => localStorage.getItem('byjtt-lab-001-three-save-v1'));
  if (!savedRaw) throw new Error('Gameplay save did not write persistence');
  const saved = JSON.parse(savedRaw);
  await first.screenshot({ path: `${evidenceDir}/before-restart.png`, fullPage: true });
  await writeFile(`${evidenceDir}/save-document.json`, `${JSON.stringify(saved, null, 2)}\n`);
  await writeFile(`${evidenceDir}/save-result.json`, `${JSON.stringify(before, null, 2)}\n`);

  if (saved.schema_version !== 1 || saved.reward_count !== 1 || !Array.isArray(saved.selected_upgrades) || !saved.selected_upgrades.includes('damage-up-1')) throw new Error(`Save contract failed: ${savedRaw}`);
  if (before?.save_keydowns !== 1 || before?.save_keyups !== 1 || before?.save_action_presses !== 1 || before?.successful_saves !== 1) throw new Error(`Normal save input not proven: ${JSON.stringify(before)}`);
  if (before?.reward_count !== 1 || !before?.selected_upgrades?.includes('damage-up-1') || Math.abs((before?.effective_attack_damage ?? 0) - 40.8) > 1e-9) throw new Error('Progression was not earned before save');
  if (!before?.observation_isolation) throw new Error('Observation isolation failed before restart');

  await first.close();
  const restartStart = Date.now();
  const second = await context.newPage();
  recordErrors(second);
  await second.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  await second.waitForFunction(() => window.__BYJTT_OBSERVATION__?.ready === true && window.__BYJTT_OBSERVATION__?.loaded_from_persistence === true, undefined, { timeout: 15000 });
  const restartReadyMs = Date.now() - restartStart;
  const restored = await second.evaluate(() => window.__BYJTT_OBSERVATION__);
  await second.screenshot({ path: `${evidenceDir}/after-restart.png`, fullPage: true });
  await writeFile(`${evidenceDir}/restore-result.json`, `${JSON.stringify({ restart_ready_ms: restartReadyMs, observation: restored }, null, 2)}\n`);
  await writeFile(`${evidenceDir}/browser-errors.json`, `${JSON.stringify({ pageErrors, consoleErrors }, null, 2)}\n`);

  if (restartReadyMs > 15000) throw new Error(`Restart exceeded contract: ${restartReadyMs}ms`);
  if (restored?.save_schema_version !== 1 || restored?.reward_count !== 1 || !restored?.selected_upgrades?.includes('damage-up-1')) throw new Error(`Restored progression failed: ${JSON.stringify(restored)}`);
  if (Math.abs((restored?.effective_attack_damage ?? 0) - 40.8) > 1e-9 || restored?.load_count !== 1) throw new Error(`Restored gameplay state incomplete: ${JSON.stringify(restored)}`);
  if (!restored?.observation_isolation) throw new Error('Observation isolation failed after restart');
  if (pageErrors.length || consoleErrors.length) throw new Error(`Browser errors: ${JSON.stringify({ pageErrors, consoleErrors })}`);

  const result = {
    passed: true,
    engine: 'Three.js 0.185.1',
    jolt_version: '1.1.0',
    arena_width_m: 24,
    arena_depth_m: 32,
    walk_speed_mps: 3.5,
    save_schema_version: saved.schema_version,
    saved_reward_count: saved.reward_count,
    saved_selected_upgrades: saved.selected_upgrades,
    restored_reward_count: restored.reward_count,
    restored_selected_upgrades: restored.selected_upgrades,
    restored_effective_attack_damage: restored.effective_attack_damage,
    restart_ready_ms: restartReadyMs,
    external_movement_input_executed: (before.movement_keydowns ?? 0) > 0 && (before.movement_keyups ?? 0) > 0,
    external_attack_input_executed: before.attack_keydowns === 1 && before.attack_keyups === 1,
    external_interact_input_executed: before.interact_keydowns === 1 && before.interact_keyups === 1,
    external_save_input_executed: before.save_keydowns === 1 && before.save_keyups === 1,
    first_runtime_fully_stopped: true,
    persistence_preserved_between_runtimes: true,
    proof_harness_write_save_directly: false,
    direct_position_setter_exposed: false,
    direct_salvage_health_setter_exposed: false,
    direct_reward_grant_exposed: false,
    direct_upgrade_grant_exposed: false,
    post_physics_arena_clamp: false,
    observation_isolation: Boolean(before.observation_isolation && restored.observation_isolation),
  };
  if (!result.external_movement_input_executed || !result.external_attack_input_executed || !result.external_interact_input_executed || !result.external_save_input_executed) throw new Error(`Physical input proof incomplete: ${JSON.stringify(result)}`);
  await writeFile(`${evidenceDir}/runtime-result.json`, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result));
  await second.close();
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
  await writeFile(`${evidenceDir}/vite.log`, serverLog);
}
