import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import process from 'node:process';

const evidenceDir = process.env.EVIDENCE_DIR ?? 'evidence';
await mkdir(evidenceDir, { recursive: true });

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4173'], {
  stdio: ['ignore', 'pipe', 'pipe'],
});
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
  const result = await page.evaluate(() => window.__BYJTT_OBSERVE__?.());
  await page.screenshot({ path: `${evidenceDir}/runtime.png`, fullPage: true });
  if (!result) throw new Error('Missing observation');
  if (result.babylonVersion !== '9.20.0') throw new Error(`Unexpected Babylon version ${result.babylonVersion}`);
  if (result.recastPlugin !== 'RecastJSPlugin') throw new Error(`Unexpected navigation plugin ${result.recastPlugin}`);
  if (result.arena.width !== 24 || result.arena.depth !== 32) throw new Error('Shared arena constants changed');
  if (result.pathPoints.length < 2) throw new Error('Native Recast path was not found');
  if (Math.abs(result.pathLength - 16) > 0.75) throw new Error(`Unexpected path length ${result.pathLength}`);
  if (result.startError > 0.5 || result.endError > 0.5) throw new Error(`Endpoint error too high ${result.startError}/${result.endError}`);
  if (!result.pathInsideArena) throw new Error('Path left arena bounds');
  if (!result.observationIsolation) throw new Error('Observation mutation isolation failed');
  if (result.postNavigationClamp) throw new Error('Post-navigation clamp is forbidden');
  if (result.externalInputExecuted || result.combatExecuted) throw new Error('Gate overclaimed input/combat execution');
  if (consoleErrors.length || pageErrors.length) throw new Error(`Browser errors: ${JSON.stringify({ consoleErrors, pageErrors })}`);

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
