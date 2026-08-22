import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';

const evidenceDir = process.env.EVIDENCE_DIR ?? 'evidence';
await mkdir(evidenceDir, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4173'], {
  stdio: ['ignore', 'pipe', 'pipe']
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
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__BYJTT_OBSERVATION__?.ready === true, undefined, { timeout: 8000 });

  await page.keyboard.down('KeyS');
  await page.waitForFunction(() => window.__BYJTT_OBSERVATION__?.player_z_m <= 0.35, undefined, { timeout: 6000 });
  await page.keyboard.up('KeyS');

  await page.keyboard.down('KeyD');
  await page.waitForFunction(() => (window.__BYJTT_OBSERVATION__?.player_to_salvage_m ?? 999) <= 1.7, undefined, { timeout: 5000 });
  await page.keyboard.up('KeyD');

  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__BYJTT_OBSERVATION__?.salvage_broken === true, undefined, { timeout: 2000 });

  await page.keyboard.down('KeyD');
  await page.waitForFunction(() => window.__BYJTT_OBSERVATION__?.reward_count === 1, undefined, { timeout: 3000 });
  await page.keyboard.up('KeyD');

  await page.waitForFunction(() => window.__BYJTT_OBSERVATION__?.upgrade_menu_visible === true, undefined, { timeout: 2000 });
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__BYJTT_RESULT__ !== undefined, undefined, { timeout: 3000 });

  const result = await page.evaluate(() => window.__BYJTT_RESULT__);
  await page.screenshot({ path: `${evidenceDir}/runtime.png`, fullPage: true });
  await writeFile(`${evidenceDir}/runtime-result.json`, `${JSON.stringify(result, null, 2)}\n`);
  await writeFile(`${evidenceDir}/browser-errors.json`, `${JSON.stringify({ pageErrors, consoleErrors }, null, 2)}\n`);

  if (pageErrors.length || consoleErrors.length) throw new Error(`Browser errors: ${JSON.stringify({ pageErrors, consoleErrors })}`);
  if (!result?.passed) throw new Error(`Progression gate failed: ${JSON.stringify(result)}`);
  if (result.engine !== 'Three.js 0.185.1' || result.jolt_version !== '1.1.0') throw new Error('Unexpected engine versions');
  if (result.arena_width_m !== 24 || result.arena_depth_m !== 32 || result.walk_speed_mps !== 3.5) throw new Error('Shared benchmark constants changed');
  if (result.attack_damage !== 34 || result.attack_range_m !== 1.8 || result.attack_cooldown_s !== 0.55) throw new Error('Attack contract changed');
  if (result.salvage_max_health !== 34 || result.pickup_radius_m !== 1.25) throw new Error('Salvage contract changed');
  if (result.reward_count !== 1 || result.selected_upgrade !== 'damage-up-1' || Math.abs(result.effective_attack_damage - 40.8) > 1e-9) throw new Error('Progression contract failed');
  if (!result.external_movement_input_executed || !result.external_attack_input_executed || !result.external_interact_input_executed) throw new Error('Physical input proof incomplete');
  if (!result.gameplay_attack_action_executed || !result.gameplay_interact_action_executed || !result.observation_isolation) throw new Error('Gameplay/observation proof incomplete');
  if (result.direct_position_setter_exposed || result.direct_salvage_health_setter_exposed || result.direct_reward_grant_exposed || result.direct_upgrade_grant_exposed) throw new Error('Forbidden mutation surface exposed');
  if (result.post_physics_arena_clamp !== false) throw new Error('Post-physics clamp detected');
  console.log(JSON.stringify(result));
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
  await writeFile(`${evidenceDir}/vite.log`, serverLog);
}
