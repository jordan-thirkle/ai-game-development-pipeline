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
  if (!initial || Math.abs(initial.initialSeparation - 16) > 0.001 || initial.playerHealth !== 100 || initial.enemyAttackCount !== 0) throw new Error('Initial shared combat state changed');

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
    await page.waitForFunction(() => (window.__BYJTT_OBSERVE__?.().enemyAttackCount ?? 0) >= 1, null, { timeout: 30_000 });
  } catch (error) {
    await retainDiagnostic('first-attack-timeout');
    throw error;
  }
  const firstAttack = await page.evaluate(() => window.__BYJTT_OBSERVE__?.());
  if (!firstAttack || firstAttack.enemyAttackCount !== 1 || firstAttack.playerHealth !== 80) throw new Error(`First attack state invalid: ${JSON.stringify(firstAttack)}`);

  await page.waitForTimeout(350);
  const cooldownProbe = await page.evaluate(() => window.__BYJTT_OBSERVE__?.());
  if (!cooldownProbe || cooldownProbe.enemyAttackCount !== 1 || cooldownProbe.playerHealth !== 80) throw new Error(`Enemy attacked before 1.1 s cooldown: ${JSON.stringify(cooldownProbe)}`);

  try {
    await page.waitForFunction(() => (window.__BYJTT_OBSERVE__?.().enemyAttackCount ?? 0) >= 2, null, { timeout: 30_000 });
  } catch (error) {
    await retainDiagnostic('second-attack-timeout');
    throw error;
  }
  await page.waitForTimeout(100);

  const isolationPass = await page.evaluate(() => {
    const first = window.__BYJTT_OBSERVE__?.();
    if (!first?.pathPoints.length) return false;
    const expected = first.pathPoints[0]?.x;
    try { if (first.pathPoints[0]) first.pathPoints[0].x = 9999; } catch { /* frozen copy is expected */ }
    return window.__BYJTT_OBSERVE__?.().pathPoints[0]?.x === expected;
  });
  const result = await page.evaluate(() => window.__BYJTT_OBSERVE__?.());
  await page.screenshot({ path: `${evidenceDir}/runtime.png`, fullPage: true });
  if (!result) throw new Error('Missing observation');
  if (result.threeRevision !== '185' || result.joltVersion !== '1.1.0' || result.recastVersion !== '0.43.1') throw new Error('Runtime dependency version mismatch');
  if (!(result.lastOutsideAcquireDistance > 12 && result.acquiredDistance !== null && result.acquiredDistance <= 12)) throw new Error(`Acquisition threshold violated ${result.lastOutsideAcquireDistance}/${result.acquiredDistance}`);
  if (result.pathPoints.length < 2 || !result.pathInsideArena) throw new Error('Detour corridor missing or outside arena');
  const firstPoint = result.pathPoints[0];
  const lastPoint = result.pathPoints[result.pathPoints.length - 1];
  if (!firstPoint || !lastPoint) throw new Error('Detour corridor endpoints missing');
  const corridorSpan = Math.hypot(lastPoint.x - firstPoint.x, lastPoint.z - firstPoint.z);
  if (corridorSpan < 11.5 || corridorSpan > 12.5) throw new Error(`Detour same-poly corridor span invalid: ${corridorSpan}`);
  if (result.acquiredDistance === null || Math.abs(corridorSpan - result.acquiredDistance) > 0.05) throw new Error(`Corridor span does not match acquired engine separation: ${corridorSpan}/${result.acquiredDistance}`);
  if (result.finalSeparation > 1.6 + 0.03) throw new Error(`Enemy never entered shared 1.6 m attack range: ${result.finalSeparation}`);
  if (result.maxEnemyStep > 2.7 / 60 + 0.003) throw new Error(`Enemy exceeded 2.7 m/s step bound: ${result.maxEnemyStep}`);
  if (result.playerReleaseDrift > 0.03) throw new Error(`Player drifted after release: ${result.playerReleaseDrift}`);
  if (result.enemyAttackCount !== 2 || result.playerHealth !== 60) throw new Error(`Expected exactly two 20-damage attacks: ${result.enemyAttackCount}/${result.playerHealth}`);
  if (result.firstAttackDistance === null || result.firstAttackDistance > 1.6 + 0.001) throw new Error(`First attack outside 1.6 m range: ${result.firstAttackDistance}`);
  if (result.secondAttackDistance === null || result.secondAttackDistance > 1.6 + 0.001) throw new Error(`Second attack outside 1.6 m range: ${result.secondAttackDistance}`);
  if (result.firstAttackTime === null || result.secondAttackTime === null || result.secondAttackTime - result.firstAttackTime < 1.1 - 0.001) throw new Error(`Enemy cooldown violated: ${result.firstAttackTime}/${result.secondAttackTime}`);
  if (result.blockedCooldownSteps < 1) throw new Error('No in-range cooldown-blocked simulation steps observed');
  if (!result.observationIsolation || !isolationPass || !result.externalInputExecuted || !result.combatExecuted) throw new Error('Observation, external input, or combat execution proof failed');
  if (result.directHealthSetterExposed || result.postNavigationClamp || result.postPhysicsClamp) throw new Error('Gate exposed privileged health mutation or clamped state');
  if (consoleErrors.length || pageErrors.length) throw new Error(`Browser errors ${JSON.stringify({ consoleErrors, pageErrors })}`);

  const attackInterval = result.secondAttackTime - result.firstAttackTime;
  const payload = { ...result, corridorSpan, attackInterval, cooldownProbe, externalObservationIsolation: isolationPass, consoleErrors, pageErrors, passed: true };
  const json = `${JSON.stringify(payload, null, 2)}\n`;
  await writeFile(`${evidenceDir}/runtime-result.json`, json);
  await writeFile(`${evidenceDir}/runtime.log`, serverLog);
  await writeFile(`${evidenceDir}/runtime-result.sha256`, `${createHash('sha256').update(json).digest('hex')}  runtime-result.json\n`);
  console.log(json);
} finally {
  await browser.close();
  server.kill('SIGTERM');
}
