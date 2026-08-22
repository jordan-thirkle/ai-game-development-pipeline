import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import process from 'node:process';

const evidenceDir = process.env.EVIDENCE_DIR ?? 'evidence';
await mkdir(evidenceDir, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
let serverLog = '';
server.stdout.on('data', (chunk) => { serverLog += chunk; });
server.stderr.on('data', (chunk) => { serverLog += chunk; });
const deadline = Date.now() + 30_000;
while (!serverLog.includes('4173') && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 100));
if (Date.now() >= deadline) throw new Error(`Vite server did not become ready:\n${serverLog}`);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const consoleErrors = [];
const pageErrors = [];
page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
page.on('pageerror', (error) => pageErrors.push(String(error)));

async function retainDiagnostic(name) {
  const observation = await page.evaluate(() => window.__BYJTT_OBSERVE__?.());
  await writeFile(`${evidenceDir}/${name}.json`, `${JSON.stringify({ observation, consoleErrors, pageErrors }, null, 2)}\n`);
}

async function tapSpace() {
  await page.keyboard.down('Space');
  await page.waitForTimeout(35);
  await page.keyboard.up('Space');
  await page.waitForTimeout(60);
}

try {
  await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle', timeout: 30_000 });
  await page.waitForFunction(() => window.__BYJTT_OBSERVE__?.().ready === true, null, { timeout: 30_000 });
  const initial = await page.evaluate(() => window.__BYJTT_OBSERVE__?.());
  if (!initial || Math.abs(initial.initialSeparation - 16) > 0.001 || initial.enemyHealth !== 100 || initial.playerHealth !== 100) throw new Error('Initial shared player-attack state changed');

  await page.keyboard.down('s');
  try {
    await page.waitForFunction(() => (window.__BYJTT_OBSERVE__?.().separation ?? 99) <= 1.75, null, { timeout: 30_000 });
  } catch (error) {
    await retainDiagnostic('approach-timeout');
    throw error;
  } finally {
    await page.keyboard.up('s');
  }
  await page.waitForTimeout(120);

  await tapSpace();
  await page.waitForFunction(() => (window.__BYJTT_OBSERVE__?.().validPlayerAttacks ?? 0) === 1, null, { timeout: 3_000 });
  const firstAttack = await page.evaluate(() => window.__BYJTT_OBSERVE__?.());
  if (!firstAttack || firstAttack.enemyHealth !== 66) throw new Error(`First player attack did not produce 100→66: ${firstAttack?.enemyHealth}`);

  await tapSpace();
  const blocked = await page.evaluate(() => window.__BYJTT_OBSERVE__?.());
  if (!blocked || blocked.validPlayerAttacks !== 1 || blocked.enemyHealth !== 66 || blocked.blockedPlayerAttacks < 1) throw new Error('Immediate second attack was not blocked by cooldown');

  await page.waitForTimeout(600);
  await tapSpace();
  await page.waitForFunction(() => (window.__BYJTT_OBSERVE__?.().validPlayerAttacks ?? 0) === 2, null, { timeout: 3_000 });
  const secondAttack = await page.evaluate(() => window.__BYJTT_OBSERVE__?.());
  if (!secondAttack || secondAttack.enemyHealth !== 32) throw new Error(`Second valid player attack did not produce 66→32: ${secondAttack?.enemyHealth}`);

  await page.keyboard.down('s');
  try {
    await page.waitForFunction(() => (window.__BYJTT_OBSERVE__?.().separation ?? 99) <= 1.58, null, { timeout: 5_000 });
  } finally {
    await page.keyboard.up('s');
  }
  await page.waitForFunction(() => (window.__BYJTT_OBSERVE__?.().enemyAttackCount ?? 0) >= 1, null, { timeout: 3_000 });
  await page.waitForTimeout(100);

  const isolationPass = await page.evaluate(() => {
    const first = window.__BYJTT_OBSERVE__?.();
    if (!first) return false;
    const expectedHealth = first.enemyHealth;
    try { first.enemyHealth = 9999; } catch { /* frozen copy */ }
    return window.__BYJTT_OBSERVE__?.().enemyHealth === expectedHealth;
  });
  const result = await page.evaluate(() => window.__BYJTT_OBSERVE__?.());
  await page.screenshot({ path: `${evidenceDir}/runtime.png`, fullPage: true });
  if (!result) throw new Error('Missing observation');
  if (result.threeRevision !== '185' || result.joltVersion !== '1.1.0') throw new Error('Runtime dependency version mismatch');
  if (result.validPlayerAttacks !== 2 || result.enemyHealth !== 32) throw new Error(`Expected exactly two 34-damage player attacks: ${result.validPlayerAttacks}/${result.enemyHealth}`);
  if (result.blockedPlayerAttacks < 1) throw new Error('No player attack was blocked by 0.55 s cooldown');
  if (result.playerAttackDistances.length !== 2 || result.playerAttackDistances.some((distance) => distance > 1.8 + 0.001)) throw new Error(`Player attack range violation: ${JSON.stringify(result.playerAttackDistances)}`);
  if (result.playerAttackTimes.length !== 2 || result.playerAttackTimes[1] - result.playerAttackTimes[0] + 1e-6 < 0.55) throw new Error(`Player attack cooldown violation: ${JSON.stringify(result.playerAttackTimes)}`);
  if (result.attackKeyDowns !== 3 || result.attackKeyUps !== 3 || result.attackActionPresses !== 3) throw new Error(`Physical attack input/action mismatch: ${result.attackKeyDowns}/${result.attackKeyUps}/${result.attackActionPresses}`);
  if (result.movementKeyDowns < 2 || result.movementKeyUps < 2) throw new Error('Physical movement input was not observed');
  if (result.enemyAttackCount !== 1 || result.playerHealth !== 80 || result.enemyAttackDistances.some((distance) => distance > 1.6 + 0.001)) throw new Error(`Enemy response contract failed: ${result.enemyAttackCount}/${result.playerHealth}/${JSON.stringify(result.enemyAttackDistances)}`);
  if (result.playerReleaseDrift > 0.03) throw new Error(`Player drifted after release: ${result.playerReleaseDrift}`);
  if (!result.observationIsolation || !isolationPass || !result.externalMovementInputExecuted || !result.externalAttackInputExecuted || !result.gameplayAttackActionExecuted) throw new Error('Observation/input/action proof failed');
  if (result.directHealthSetterExposed || result.directPositionSetterExposed || result.postPhysicsClamp) throw new Error('Gate exposed mutation shortcut or clamp');
  if (result.renderedFrames < 1) throw new Error('No rendered frames observed');
  if (consoleErrors.length || pageErrors.length) throw new Error(`Browser errors ${JSON.stringify({ consoleErrors, pageErrors })}`);

  const payload = { ...result, externalObservationIsolation: isolationPass, consoleErrors, pageErrors, passed: true };
  const json = `${JSON.stringify(payload, null, 2)}\n`;
  await writeFile(`${evidenceDir}/runtime-result.json`, json);
  await writeFile(`${evidenceDir}/runtime.log`, serverLog);
  await writeFile(`${evidenceDir}/runtime-result.sha256`, `${createHash('sha256').update(json).digest('hex')}  runtime-result.json\n`);
  console.log(json);
} finally {
  await browser.close();
  server.kill('SIGTERM');
}
