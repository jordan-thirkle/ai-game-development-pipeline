import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const evidenceDir = resolve(root, 'evidence');
await mkdir(evidenceDir, { recursive: true });

const serverLog = [];
const server = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '4173'], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe'],
});
server.stdout.on('data', chunk => serverLog.push(chunk.toString()));
server.stderr.on('data', chunk => serverLog.push(chunk.toString()));

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch('http://127.0.0.1:4173');
      if (response.ok) return;
    } catch {}
    await new Promise(resolveWait => setTimeout(resolveWait, 250));
  }
  throw new Error('Vite server did not become ready');
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', error => pageErrors.push(String(error)));

  await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => typeof window.__byjttCombatObservation === 'function');
  await page.screenshot({ path: resolve(evidenceDir, 'before-input.png') });

  const initial = await page.evaluate(() => window.__byjttCombatObservation?.());
  if (!initial?.ready) throw new Error('Combat observation did not become ready');
  if (initial.phaserVersion !== '4.1.0') throw new Error(`Unexpected Phaser version ${initial.phaserVersion}`);
  if (Math.abs(initial.separationM - 16) > 0.05) throw new Error(`Unexpected initial separation ${initial.separationM}`);

  await page.keyboard.down('w');
  await page.waitForTimeout(1500);
  await page.keyboard.up('w');

  await page.waitForFunction(() => (window.__byjttCombatObservation?.().enemyAttackCount ?? 0) >= 1, null, { timeout: 7000 });
  const firstAttack = await page.evaluate(() => window.__byjttCombatObservation?.());
  await page.waitForTimeout(400);
  const cooldownProbe = await page.evaluate(() => window.__byjttCombatObservation?.());
  if (cooldownProbe?.enemyAttackCount !== 1 || cooldownProbe.playerHealth !== 80) {
    throw new Error(`Cooldown failed closed: ${JSON.stringify(cooldownProbe)}`);
  }

  await page.waitForFunction(() => (window.__byjttCombatObservation?.().enemyAttackCount ?? 0) >= 2, null, { timeout: 3000 });
  const mutationIsolation = await page.evaluate(() => {
    const first = window.__byjttCombatObservation?.();
    if (!first) return false;
    try { first.playerHealth = 1; } catch {}
    const second = window.__byjttCombatObservation?.();
    return second?.playerHealth === 60;
  });
  const final = await page.evaluate(() => window.__byjttCombatObservation?.());
  await page.screenshot({ path: resolve(evidenceDir, 'after-combat.png') });

  if (!final?.passed) throw new Error(`Runtime result did not pass: ${JSON.stringify(final)}`);
  if (!mutationIsolation) throw new Error('Observation mutation isolation failed');
  if (consoleErrors.length > 0) throw new Error(`Browser console errors: ${consoleErrors.join(' | ')}`);
  if (pageErrors.length > 0) throw new Error(`Browser page errors: ${pageErrors.join(' | ')}`);

  const result = {
    ...final,
    initialSeparationM: initial.separationM,
    firstAttackProbe: firstAttack,
    cooldownProbeAttackCount: cooldownProbe.enemyAttackCount,
    cooldownProbePlayerHealth: cooldownProbe.playerHealth,
    observationMutationIsolation: mutationIsolation,
    browserConsoleErrors: consoleErrors,
    browserPageErrors: pageErrors,
    browser: await browser.version(),
  };
  await writeFile(resolve(evidenceDir, 'runtime-result.json'), `${JSON.stringify(result, null, 2)}\n`);
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
  await new Promise(resolveExit => {
    const timeout = setTimeout(resolveExit, 2000);
    server.once('exit', () => { clearTimeout(timeout); resolveExit(); });
  });
  await writeFile(resolve(evidenceDir, 'vite.log'), serverLog.join(''));
}
