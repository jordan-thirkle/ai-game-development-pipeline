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

try {
  await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle', timeout: 30_000 });
  await page.waitForFunction(() => window.__BYJTT_OBSERVE__?.().ready === true, null, { timeout: 30_000 });
  const initial = await page.evaluate(() => window.__BYJTT_OBSERVE__?.());
  if (!initial || Math.abs(initial.initialSeparation - 16) > 0.001) throw new Error('Initial shared separation changed');
  await page.keyboard.down('s');
  try {
    await page.waitForFunction(() => window.__BYJTT_OBSERVE__?.().acquired === true, null, { timeout: 30_000 });
  } catch (error) {
    const diagnostic = await page.evaluate(() => window.__BYJTT_OBSERVE__?.());
    await writeFile(`${evidenceDir}/acquisition-timeout.json`, `${JSON.stringify(diagnostic, null, 2)}\n`);
    throw error;
  } finally {
    await page.keyboard.up('s');
  }
  await page.waitForFunction(() => (window.__BYJTT_OBSERVE__?.().chaseSteps ?? 0) >= 180, null, { timeout: 30_000 });
  await page.waitForTimeout(250);
  const result = await page.evaluate(() => window.__BYJTT_OBSERVE__?.());
  await page.screenshot({ path: `${evidenceDir}/runtime.png`, fullPage: true });
  if (!result) throw new Error('Missing observation');
  if (result.threeRevision !== '185' || result.joltVersion !== '1.1.0' || result.recastVersion !== '0.43.1') throw new Error('Runtime dependency version mismatch');
  if (!(result.lastOutsideAcquireDistance > 12 && result.acquiredDistance !== null && result.acquiredDistance <= 12)) throw new Error(`Acquisition threshold violated ${result.lastOutsideAcquireDistance}/${result.acquiredDistance}`);
  if (result.pathPoints.length < 2 || !result.pathInsideArena) throw new Error('Detour path missing or outside arena');
  if (result.finalSeparation >= 7.5) throw new Error(`Enemy chase did not materially reduce separation: ${result.finalSeparation}`);
  if (result.maxEnemyStep > 2.7 / 60 + 0.003) throw new Error(`Enemy exceeded 2.7 m/s step bound: ${result.maxEnemyStep}`);
  if (result.playerReleaseDrift > 0.03) throw new Error(`Player drifted after release: ${result.playerReleaseDrift}`);
  if (!result.observationIsolation || !result.externalInputExecuted) throw new Error('Observation isolation or external input proof failed');
  if (result.postNavigationClamp || result.postPhysicsClamp || result.combatExecuted) throw new Error('Gate clamped state or overclaimed combat');
  if (consoleErrors.length || pageErrors.length) throw new Error(`Browser errors ${JSON.stringify({ consoleErrors, pageErrors })}`);
  const payload = { ...result, consoleErrors, pageErrors, passed: true };
  const json = `${JSON.stringify(payload, null, 2)}\n`;
  await writeFile(`${evidenceDir}/runtime-result.json`, json);
  await writeFile(`${evidenceDir}/runtime.log`, serverLog);
  await writeFile(`${evidenceDir}/runtime-result.sha256`, `${createHash('sha256').update(json).digest('hex')}  runtime-result.json\n`);
  console.log(json);
} finally {
  await browser.close();
  server.kill('SIGTERM');
}
