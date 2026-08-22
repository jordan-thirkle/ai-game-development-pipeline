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

try {
  await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle', timeout: 30_000 });
  await page.waitForFunction(() => window.__BYJTT_OBSERVE__?.().ready === true, null, { timeout: 30_000 });
  const initial = await page.evaluate(() => window.__BYJTT_OBSERVE__?.());
  if (!initial || Math.abs(initial.initialSeparation - 16) > 0.001 || initial.playerHealth !== 100) throw new Error('Initial shared combat state changed');

  await page.keyboard.down('s');
  try {
    await page.waitForFunction(() => window.__BYJTT_OBSERVE__?.().acquired === true, null, { timeout: 30_000 });
  } catch (error) {
    await retainDiagnostic('acquisition-timeout');
    throw error;
  } finally {
    await page.keyboard.up('s');
  }

  try {
    await page.waitForFunction(() => (window.__BYJTT_OBSERVE__?.().attackCount ?? 0) >= 1, null, { timeout: 30_000 });
  } catch (error) {
    await retainDiagnostic('first-attack-timeout');
    throw error;
  }
  const firstAttack = await page.evaluate(() => window.__BYJTT_OBSERVE__?.());
  if (!firstAttack || firstAttack.playerHealth !== 80 || firstAttack.attackCount !== 1) throw new Error('First enemy attack did not produce 100→80');

  await page.waitForTimeout(350);
  const cooldownProbe = await page.evaluate(() => window.__BYJTT_OBSERVE__?.());
  if (!cooldownProbe || cooldownProbe.attackCount !== 1 || cooldownProbe.playerHealth !== 80) throw new Error('Enemy attacked again before 1.1 s cooldown');

  try {
    await page.waitForFunction(() => (window.__BYJTT_OBSERVE__?.().attackCount ?? 0) >= 2, null, { timeout: 5_000 });
  } catch (error) {
    await retainDiagnostic('second-attack-timeout');
    throw error;
  }
  await page.waitForTimeout(100);

  const isolationPass = await page.evaluate(() => {
    const first = window.__BYJTT_OBSERVE__?.();
    if (!first) return false;
    const expectedHealth = first.playerHealth;
    try { first.playerHealth = 9999; } catch { /* frozen copy */ }
    return window.__BYJTT_OBSERVE__?.().playerHealth === expectedHealth;
  });
  const result = await page.evaluate(() => window.__BYJTT_OBSERVE__?.());
  await page.screenshot({ path: `${evidenceDir}/runtime.png`, fullPage: true });
  if (!result) throw new Error('Missing observation');
  if (result.threeRevision !== '185' || result.joltVersion !== '1.1.0' || result.recastVersion !== '0.43.1') throw new Error('Runtime dependency version mismatch');
  if (!(result.lastOutsideAcquireDistance > 12 && result.acquiredDistance !== null && result.acquiredDistance <= 12)) throw new Error(`Acquisition threshold violated ${result.lastOutsideAcquireDistance}/${result.acquiredDistance}`);
  if (result.pathPoints.length < 2 || !result.pathInsideArena) throw new Error('Detour corridor missing or outside arena');
  if (result.maxEnemyStep > 2.7 / 60 + 0.003) throw new Error(`Enemy exceeded 2.7 m/s step bound: ${result.maxEnemyStep}`);
  if (result.firstAttackDistance === null || result.firstAttackDistance > 1.6 + 0.001) throw new Error(`First attack outside 1.6 m: ${result.firstAttackDistance}`);
  if (result.attackCount !== 2 || result.playerHealth !== 60) throw new Error(`Expected exactly two 20-damage attacks: ${result.attackCount}/${result.playerHealth}`);
  if (result.attackDistances.some((distance) => distance > 1.6 + 0.001)) throw new Error(`Attack range violation: ${JSON.stringify(result.attackDistances)}`);
  if (result.attackTimes.length !== 2 || result.attackTimes[1] - result.attackTimes[0] + 1e-6 < 1.1) throw new Error(`Attack cooldown violated: ${JSON.stringify(result.attackTimes)}`);
  if (result.cooldownBlockedSteps <= 0) throw new Error('No in-range attack steps were blocked by cooldown');
  if (result.playerReleaseDrift > 0.03) throw new Error(`Player drifted after release: ${result.playerReleaseDrift}`);
  if (!result.observationIsolation || !isolationPass || !result.externalInputExecuted || !result.combatExecuted) throw new Error('Observation/input/combat proof failed');
  if (result.directHealthSetterExposed || result.directPositionSetterExposed || result.postNavigationClamp || result.postPhysicsClamp) throw new Error('Gate exposed mutation shortcut or clamp');
  if (consoleErrors.length || pageErrors.length) throw new Error(`Browser errors ${JSON.stringify({ consoleErrors, pageErrors })}`);

  const payload = { ...result, cooldownProbeAttackCount: cooldownProbe.attackCount, cooldownProbePlayerHealth: cooldownProbe.playerHealth, externalObservationIsolation: isolationPass, consoleErrors, pageErrors, passed: true };
  const json = `${JSON.stringify(payload, null, 2)}\n`;
  await writeFile(`${evidenceDir}/runtime-result.json`, json);
  await writeFile(`${evidenceDir}/runtime.log`, serverLog);
  await writeFile(`${evidenceDir}/runtime-result.sha256`, `${createHash('sha256').update(json).digest('hex')}  runtime-result.json\n`);
  console.log(json);
} finally {
  await browser.close();
  server.kill('SIGTERM');
}
