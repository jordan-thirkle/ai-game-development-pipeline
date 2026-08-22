import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';

const port = 4173;
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port)], { stdio: ['ignore', 'pipe', 'pipe'] });
let viteLog = '';
server.stdout.on('data', (d) => { viteLog += d; });
server.stderr.on('data', (d) => { viteLog += d; });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitServer() {
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(base); if (r.ok) return; } catch {}
    await sleep(100);
  }
  throw new Error('vite server did not become ready');
}

let browser;
try {
  await waitServer();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__BYJTT_PROGRESSION__?.().ready === true);
  const observe = () => page.evaluate(() => window.__BYJTT_PROGRESSION__?.());

  async function driveUntil(code, predicate, timeoutMs = 6000) {
    await page.keyboard.down(code);
    const start = Date.now();
    try {
      while (Date.now() - start < timeoutMs) {
        const o = await observe();
        if (o && predicate(o)) return o;
        await sleep(30);
      }
      throw new Error(`drive timeout for ${code}`);
    } finally {
      await page.keyboard.up(code);
    }
  }

  await driveUntil('KeyS', (o) => o.player.z <= 0.8);
  const attackReady = await driveUntil('KeyD', (o) => o.distanceToSalvage <= 1.7);
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__BYJTT_PROGRESSION__?.().salvageBroken === true);
  const rewardReady = await driveUntil('KeyD', (o) => o.rewardCount === 1);
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__BYJTT_PROGRESSION__?.().selectedUpgrades.includes('damage-up-1'));

  const tamperResult = await page.evaluate(() => {
    const copy = window.__BYJTT_PROGRESSION__?.();
    if (!copy) return false;
    copy.selectedUpgrades.push('tamper');
    return window.__BYJTT_PROGRESSION__?.().selectedUpgrades.includes('tamper') === false;
  });
  const final = await observe();
  if (!final) throw new Error('missing final observation');
  await page.screenshot({ path: 'progression.png' });

  const passed =
    attackReady.distanceToSalvage <= 1.8 &&
    final.attackDistance !== null && final.attackDistance <= 1.8 &&
    final.salvageHealth === 0 && final.salvageBroken === true &&
    rewardReady.rewardCount === 1 &&
    final.pickupDistance !== null && final.pickupDistance <= 1.25 &&
    final.rewardCount === 1 &&
    final.selectedUpgrades[0] === 'damage-up-1' &&
    Math.abs(final.effectiveDamage - 40.8) < 1e-6 &&
    final.attackPresses === 1 && final.interactPresses === 1 &&
    final.movementKeydowns >= 2 && final.movementKeyups >= 2 &&
    tamperResult &&
    final.directPositionMutationSurface === false &&
    final.directSalvageHealthMutationSurface === false &&
    final.directRewardMutationSurface === false &&
    final.directUpgradeMutationSurface === false &&
    final.testOnlyGameplayMutationShortcut === false &&
    final.postPhysicsArenaClamp === false &&
    final.failures.length === 0 && pageErrors.length === 0 && consoleErrors.length === 0;

  const result = {
    passed,
    engine: 'playcanvas',
    engineVersion: '2.21.3',
    viewport: [390, 844],
    attackDistance: final.attackDistance,
    pickupDistance: final.pickupDistance,
    salvageHealth: final.salvageHealth,
    rewardCount: final.rewardCount,
    selectedUpgrades: final.selectedUpgrades,
    effectiveDamage: final.effectiveDamage,
    movementKeydowns: final.movementKeydowns,
    movementKeyups: final.movementKeyups,
    attackPresses: final.attackPresses,
    interactPresses: final.interactPresses,
    renderedFrames: final.renderedFrames,
    externalInputExecuted: true,
    observationMutationIsolation: tamperResult,
    directPositionMutationSurface: final.directPositionMutationSurface,
    directSalvageHealthMutationSurface: final.directSalvageHealthMutationSurface,
    directRewardMutationSurface: final.directRewardMutationSurface,
    directUpgradeMutationSurface: final.directUpgradeMutationSurface,
    testOnlyGameplayMutationShortcut: final.testOnlyGameplayMutationShortcut,
    postPhysicsArenaClamp: final.postPhysicsArenaClamp,
    pageErrors,
    consoleErrors,
  };
  await writeFile('runtime-result.json', JSON.stringify(result, null, 2));
  await writeFile('vite.log', viteLog);
  if (!passed) throw new Error(`runtime proof failed: ${JSON.stringify(result)}`);
  await page.close();
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
  await sleep(150);
  if (!server.killed) server.kill('SIGKILL');
  await writeFile('vite.log', viteLog);
}
