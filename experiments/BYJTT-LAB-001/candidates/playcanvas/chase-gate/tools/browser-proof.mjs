import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';

const evidenceDir = process.env.EVIDENCE_DIR ?? 'evidence';
await mkdir(evidenceDir, { recursive: true });
const serverLog = [];
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4173'], { stdio: ['ignore', 'pipe', 'pipe'] });
server.stdout.on('data', (c) => serverLog.push(c.toString()));
server.stderr.on('data', (c) => serverLog.push(c.toString()));
async function waitForServer() {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try { const r = await fetch('http://127.0.0.1:4173/'); if (r.ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error('Vite preview did not become ready within 20 seconds');
}
let browser;
const consoleErrors = [];
const pageErrors = [];
let result;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle', timeout: 30_000 });
  await page.waitForFunction(() => window.__BYJTT_CHASE_OBSERVE__?.().ready === true, null, { timeout: 30_000 });
  const initial = await page.evaluate(() => window.__BYJTT_CHASE_OBSERVE__?.());
  if (!initial) throw new Error('Chase observation bridge missing');
  await page.keyboard.down('s');
  await page.waitForFunction(() => window.__BYJTT_CHASE_OBSERVE__?.().acquired === true, null, { timeout: 5_000 });
  await page.keyboard.up('s');
  await page.waitForFunction(() => {
    const o = window.__BYJTT_CHASE_OBSERVE__?.();
    return (o?.keyUpCount ?? 0) >= 1 && (o?.chaseSteps ?? 0) >= 180 && o?.separationAtProofStep !== null;
  }, null, { timeout: 8_000 });
  const before = await page.evaluate(() => window.__BYJTT_CHASE_OBSERVE__?.());
  if (!before) throw new Error('Chase observation unavailable after chase');
  await page.evaluate(() => {
    const copy = window.__BYJTT_CHASE_OBSERVE__?.();
    if (!copy) throw new Error('Chase observation missing during mutation probe');
    try { copy.enemyPosition.z = 9999; copy.path[0].z = 9999; } catch {}
  });
  const after = await page.evaluate(() => window.__BYJTT_CHASE_OBSERVE__?.());
  if (!after) throw new Error('Chase observation missing after mutation probe');
  const isolated = after.enemyPosition.z === before.enemyPosition.z && after.path[0]?.z === before.path[0]?.z;
  const checks = {
    initial_outside_acquisition: initial.initialSeparation > 12 && Math.abs(initial.initialSeparation - 16) < 0.001,
    external_input_delivered: after.keyDownCount >= 1 && after.keyUpCount >= 1,
    player_speed_bounded: after.maxPlayerSpeed <= 3.500001,
    acquisition_legitimate: after.acquired === true && after.acquisitionSeparation !== null && after.acquisitionSeparation <= 12.000001 && after.acquisitionSeparation >= 11.7 && (after.playerDistanceAtAcquisition ?? 0) >= 3.9,
    detour_path_found: after.pathFound === true && after.path.length >= 2,
    chase_executed: after.chaseSteps >= 180,
    enemy_step_bounded: after.maxEnemyStepDistance <= 2.7 / 60 + 0.000001,
    distance_reduced: (after.distanceReductionAtProofStep ?? 0) >= 7.8 && (after.separationAtProofStep ?? 999) < 4.3,
    points_inside_arena: after.pointsInsideArena === true,
    observation_mutation_isolation: isolated,
    post_navigation_clamp: after.postNavigationClamp,
    post_physics_arena_clamp: after.postPhysicsArenaClamp,
    console_errors: consoleErrors,
    page_errors: pageErrors
  };
  const passed = checks.initial_outside_acquisition && checks.external_input_delivered && checks.player_speed_bounded && checks.acquisition_legitimate && checks.detour_path_found && checks.chase_executed && checks.enemy_step_bounded && checks.distance_reduced && checks.points_inside_arena && checks.observation_mutation_isolation && checks.post_navigation_clamp === false && checks.post_physics_arena_clamp === false && consoleErrors.length === 0 && pageErrors.length === 0;
  result = { candidate_head: process.env.CANDIDATE_HEAD_SHA ?? 'unknown', runtime: 'chromium', viewport: { width: 390, height: 844 }, observation: after, checks, passed };
  await page.screenshot({ path: `${evidenceDir}/chase.png`, fullPage: true });
  await writeFile(`${evidenceDir}/runtime-result.json`, `${JSON.stringify(result, null, 2)}\n`);
  await writeFile(`${evidenceDir}/browser-console.json`, `${JSON.stringify({ consoleErrors, pageErrors }, null, 2)}\n`);
  if (!passed) throw new Error(`Chase proof failed: ${JSON.stringify(checks)}`);
} finally {
  await browser?.close();
  server.kill('SIGTERM');
  await writeFile(`${evidenceDir}/vite-preview.log`, serverLog.join(''));
}
console.log(JSON.stringify(result, null, 2));
