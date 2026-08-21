import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';

const server = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', '--host', '127.0.0.1', '--port', '4173'], { stdio: ['ignore', 'pipe', 'pipe'] });
let serverLog = '';
server.stdout.on('data', d => serverLog += d.toString());
server.stderr.on('data', d => serverLog += d.toString());

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch('http://127.0.0.1:4173'); if (r.ok) return; } catch {}
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error('vite server did not become ready');
}

const errors = [];
let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('console', m => { if (m.type() === 'error') errors.push(`console:${m.text()}`); });
  page.on('pageerror', e => errors.push(`page:${e.message}`));
  await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__BYJTT_PROGRESS__?.().ready === true);

  const obs = () => page.evaluate(() => window.__BYJTT_PROGRESS__());
  const driveUntil = async (code, predicate, timeoutMs = 6000) => {
    const start = Date.now();
    await page.keyboard.down(code);
    try {
      while (Date.now() - start < timeoutMs) {
        const o = await obs();
        if (predicate(o)) return o;
        await page.waitForTimeout(50);
      }
      throw new Error(`drive ${code} timed out`);
    } finally { await page.keyboard.up(code); }
  };

  await driveUntil('KeyW', o => o.player.z <= 1.15);
  await driveUntil('KeyD', o => o.player.x >= 4.0);
  let beforeAttack = await obs();
  const attackDistance = Math.hypot(beforeAttack.player.x - 5, beforeAttack.player.z);
  if (attackDistance > 1.8) throw new Error(`not in attack range: ${attackDistance}`);
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__BYJTT_PROGRESS__?.().salvageBroken === true);

  let afterAttack = await obs();
  if (afterAttack.rewardCount === 0) {
    if (afterAttack.player.z > 0.5) await driveUntil('KeyW', o => o.rewardCount === 1 || o.player.z <= 0.5);
    afterAttack = await obs();
    if (afterAttack.rewardCount === 0 && afterAttack.player.x < 4.5) await driveUntil('KeyD', o => o.rewardCount === 1 || o.player.x >= 4.5);
  }
  await page.waitForFunction(() => window.__BYJTT_PROGRESS__?.().rewardCount === 1);
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__BYJTT_PROGRESS__?.().selectedUpgrades.includes('damage-up-1'));

  const result = await obs();
  const mutationProbe = await page.evaluate(() => {
    const first = window.__BYJTT_PROGRESS__();
    try { first.player.x = 999; } catch {}
    try { first.selectedUpgrades.push('forged'); } catch {}
    const second = window.__BYJTT_PROGRESS__();
    return second.player.x !== 999 && !second.selectedUpgrades.includes('forged');
  });

  const passed = result.salvageHealth === 0 && result.salvageBroken && result.rewardCount === 1 && result.selectedUpgrades.length === 1 && result.selectedUpgrades[0] === 'damage-up-1' && Math.abs(result.effectiveDamage - 40.8) < 1e-6 && result.attackPresses === 1 && result.interactPresses === 1 && result.attackExecuted && result.interactExecuted && result.attackDistance !== null && result.attackDistance <= 1.8 && result.pickupDistance !== null && result.pickupDistance <= 1.25 && mutationProbe && result.renderedFrames > 0 && errors.length === 0;
  const evidence = { ...result, observationMutationIsolation: mutationProbe, browserErrors: errors, passed, externalInputExecuted: true, directGameplayMutationShortcut: false, postPhysicsArenaClampClaim: false };
  await writeFile('runtime-result.json', JSON.stringify(evidence, null, 2));
  await page.screenshot({ path: 'progression.png', fullPage: true });
  if (!passed) throw new Error(`progression proof failed: ${JSON.stringify(evidence)}`);
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
  await writeFile('vite.log', serverLog);
}
