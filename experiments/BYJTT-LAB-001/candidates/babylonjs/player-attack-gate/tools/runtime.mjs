import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const port = 4178;
const evidenceDir = process.env.EVIDENCE_DIR ?? 'evidence';
await mkdir(evidenceDir, { recursive: true });
const server = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', '--host', '127.0.0.1', '--port', String(port)], { stdio: ['ignore', 'pipe', 'pipe'] });
let serverLog = '';
server.stdout.on('data', (chunk) => { serverLog += chunk; });
server.stderr.on('data', (chunk) => { serverLog += chunk; });

async function waitForServer() {
  for (let i = 0; i < 100; i += 1) {
    try { const response = await fetch(`http://127.0.0.1:${port}`); if (response.ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('vite server did not become ready');
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(`http://127.0.0.1:${port}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__BYJTT_BABYLON_PLAYER_ATTACK__?.snapshot().ready === true, null, { timeout: 30000 });

  const snap = () => page.evaluate(() => window.__BYJTT_BABYLON_PLAYER_ATTACK__.snapshot());
  const initial = await snap();
  if (Math.abs(initial.current_distance - 16) > 0.05) throw new Error(`initial distance ${initial.current_distance}`);

  await page.keyboard.down('s');
  await page.waitForFunction(() => window.__BYJTT_BABYLON_PLAYER_ATTACK__.snapshot().current_distance <= 1.72, null, { timeout: 12000 });
  await page.keyboard.up('s');
  await page.waitForTimeout(150);
  const inRange = await snap();
  if (inRange.current_distance > 1.8) throw new Error(`player failed to enter attack range: ${inRange.current_distance}`);

  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__BYJTT_BABYLON_PLAYER_ATTACK__.snapshot().valid_attacks === 1);
  const afterFirst = await snap();
  await page.keyboard.press('Space');
  await page.waitForTimeout(120);
  const afterEarly = await snap();
  await page.waitForTimeout(520);
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__BYJTT_BABYLON_PLAYER_ATTACK__.snapshot().valid_attacks === 2);
  await page.waitForTimeout(120);
  const final = await snap();

  const checks = {
    exact_constants: final.arena.width === 24 && final.arena.depth === 32 && final.player_speed === 3.5 && final.attack_damage === 34 && final.attack_range === 1.8 && final.attack_cooldown === 0.55,
    first_attack_damage: afterFirst.enemy_health === 66 && afterFirst.health_after_first_attack === 66,
    early_attack_blocked: afterEarly.enemy_health === 66 && afterEarly.valid_attacks === 1 && afterEarly.blocked_cooldown_presses >= 1,
    second_attack_damage: final.enemy_health === 32 && final.valid_attacks === 2,
    cooldown_elapsed: Number.isFinite(final.second_attack_time) && Number.isFinite(final.first_attack_time) && final.second_attack_time - final.first_attack_time + 1e-6 >= 0.55,
    attacks_in_range: final.first_attack_distance <= 1.8 && final.second_attack_distance <= 1.8,
    physical_browser_input: final.move_key_down_callbacks >= 1 && final.move_key_up_callbacks >= 1 && final.attack_key_down_callbacks >= 3 && final.attack_key_up_callbacks >= 3 && final.external_input_executed,
    native_attack_path: final.player_attack_executed && !final.direct_position_setter_exposed && !final.direct_health_setter_exposed && !final.post_physics_arena_clamp,
    release_stable: final.release_drift <= 0.01,
    observation_isolated: final.observation_isolation,
    browser_clean: consoleErrors.length === 0 && pageErrors.length === 0,
  };
  const passed = Object.values(checks).every(Boolean);
  const result = { candidate_head: process.env.CANDIDATE_HEAD_SHA ?? 'unknown', passed, checks, initial, in_range: inRange, after_first: afterFirst, after_early: afterEarly, final, console_errors: consoleErrors, page_errors: pageErrors };
  const json = `${JSON.stringify(result, null, 2)}\n`;
  await writeFile(`${evidenceDir}/runtime-result.json`, json);
  await page.screenshot({ path: `${evidenceDir}/runtime.png`, fullPage: true });
  await writeFile(`${evidenceDir}/runtime-result.sha256`, `${createHash('sha256').update(json).digest('hex')}  runtime-result.json\n`);
  if (!passed) throw new Error(`runtime checks failed: ${JSON.stringify(checks)}`);
  console.log(json);
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
  await writeFile(`${evidenceDir}/vite.log`, serverLog);
}
