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
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pageErrors = [];
  const consoleErrors = [];
  const attachErrors = (page) => {
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  };

  const page = await context.newPage();
  attachErrors(page);
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__BYJTT_PERSIST__?.().ready === true);
  const observe = () => page.evaluate(() => window.__BYJTT_PERSIST__?.());

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
  await page.waitForFunction(() => window.__BYJTT_PERSIST__?.().salvageBroken === true);
  const rewardReady = await driveUntil('KeyD', (o) => o.rewardCount === 1);
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__BYJTT_PERSIST__?.().selectedUpgrades.includes('damage-up-1'));

  const beforeSave = await observe();
  if (!beforeSave) throw new Error('missing before-save observation');
  const tamperResult = await page.evaluate(() => {
    const copy = window.__BYJTT_PERSIST__?.();
    if (!copy) return false;
    copy.selectedUpgrades.push('tamper');
    return window.__BYJTT_PERSIST__?.().selectedUpgrades.includes('tamper') === false;
  });
  await page.screenshot({ path: 'before-restart.png' });

  await page.keyboard.press('KeyP');
  await page.waitForFunction(() => window.__BYJTT_PERSIST__?.().successfulSaves === 1);
  const afterSave = await observe();
  if (!afterSave) throw new Error('missing post-save observation');
  const savedDocument = await page.evaluate(() => localStorage.getItem('byjtt-lab-001-playcanvas-save'));
  if (!savedDocument) throw new Error('normal save path did not create persistence');
  await writeFile('saved-document.json', `${savedDocument}\n`);

  await page.close();
  const restartStarted = Date.now();
  const restarted = await context.newPage();
  attachErrors(restarted);
  await restarted.goto(base, { waitUntil: 'networkidle' });
  await restarted.waitForFunction(() => window.__BYJTT_PERSIST__?.().ready === true && window.__BYJTT_PERSIST__?.().loadedFromDisk === true);
  const restartReadyMs = Date.now() - restartStarted;
  const restored = await restarted.evaluate(() => window.__BYJTT_PERSIST__?.());
  if (!restored) throw new Error('missing restored observation');
  await restarted.screenshot({ path: 'after-restart.png' });

  const passed =
    attackReady.distanceToSalvage <= 1.8 &&
    rewardReady.rewardCount === 1 &&
    beforeSave.rewardCount === 1 &&
    beforeSave.selectedUpgrades[0] === 'damage-up-1' &&
    Math.abs(beforeSave.effectiveDamage - 40.8) < 1e-6 &&
    beforeSave.attackPresses === 1 &&
    beforeSave.interactPresses === 1 &&
    afterSave.savePresses === 1 &&
    afterSave.successfulSaves === 1 &&
    tamperResult &&
    restored.loadedFromDisk &&
    restored.schemaVersion === 1 &&
    restored.rewardCount === 1 &&
    restored.selectedUpgrades[0] === 'damage-up-1' &&
    Math.abs(restored.effectiveDamage - 40.8) < 1e-6 &&
    restored.directSaveWriteSurface === false &&
    restored.directPositionMutationSurface === false &&
    restored.directRewardMutationSurface === false &&
    restored.directUpgradeMutationSurface === false &&
    restored.testOnlyGameplayMutationShortcut === false &&
    restartReadyMs <= 15000 &&
    pageErrors.length === 0 && consoleErrors.length === 0;

  const result = {
    passed,
    engine: 'playcanvas',
    engineVersion: '2.21.3',
    viewport: [390, 844],
    schemaVersion: restored.schemaVersion,
    rewardCount: restored.rewardCount,
    selectedUpgrades: restored.selectedUpgrades,
    effectiveDamage: restored.effectiveDamage,
    attackDistance: attackReady.distanceToSalvage,
    pickupDistance: rewardReady.distanceToSalvage,
    savePresses: afterSave.savePresses,
    successfulSaves: afterSave.successfulSaves,
    normalSaveInputExecuted: afterSave.savePresses === 1 && afterSave.successfulSaves === 1,
    progressionEarnedThroughExternalInput: true,
    observationMutationIsolation: tamperResult,
    fullRuntimeRestartExecuted: true,
    restartReadyMs,
    directSaveWriteSurface: restored.directSaveWriteSurface,
    directPositionMutationSurface: restored.directPositionMutationSurface,
    directRewardMutationSurface: restored.directRewardMutationSurface,
    directUpgradeMutationSurface: restored.directUpgradeMutationSurface,
    testOnlyGameplayMutationShortcut: restored.testOnlyGameplayMutationShortcut,
    pageErrors,
    consoleErrors,
  };
  await writeFile('runtime-result.json', JSON.stringify(result, null, 2));
  await writeFile('vite.log', viteLog);
  if (!passed) throw new Error(`runtime proof failed: ${JSON.stringify(result)}`);
  await context.close();
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
  await sleep(150);
  if (!server.killed) server.kill('SIGKILL');
  await writeFile('vite.log', viteLog);
}
