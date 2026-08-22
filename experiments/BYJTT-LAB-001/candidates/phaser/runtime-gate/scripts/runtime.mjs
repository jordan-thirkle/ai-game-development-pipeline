import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';

const evidenceDir = process.env.EVIDENCE_DIR ?? 'evidence';
await mkdir(evidenceDir, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4173'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: false
});
let serverLog = '';
server.stdout.on('data', (chunk) => { serverLog += String(chunk); });
server.stderr.on('data', (chunk) => { serverLog += String(chunk); });

async function waitForServer() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const response = await fetch('http://127.0.0.1:4173/');
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Vite server did not become ready\n${serverLog}`);
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(4200);
  await page.keyboard.up('KeyD');
  await page.waitForFunction(() => window.__BYJTT_RESULT__ !== undefined, undefined, { timeout: 5000 });
  const result = await page.evaluate(() => window.__BYJTT_RESULT__);
  await page.screenshot({ path: `${evidenceDir}/runtime.png`, fullPage: true });
  await writeFile(`${evidenceDir}/runtime-result.json`, `${JSON.stringify(result, null, 2)}\n`);
  await writeFile(`${evidenceDir}/browser-errors.json`, `${JSON.stringify({ pageErrors, consoleErrors }, null, 2)}\n`);
  if (pageErrors.length || consoleErrors.length) throw new Error(`Browser errors: ${JSON.stringify({ pageErrors, consoleErrors })}`);
  if (!result?.passed) throw new Error(`Runtime gate failed: ${JSON.stringify(result)}`);
  if (result.engine !== 'Phaser 4.1.0') throw new Error(`Unexpected engine: ${result.engine}`);
  if (result.arena_width_m !== 24 || result.arena_depth_m !== 32 || result.walk_speed_mps !== 3.5) throw new Error('Shared benchmark constants changed');
  if (result.post_physics_arena_clamp !== false) throw new Error('Post-physics clamp detected');
  console.log(JSON.stringify(result));
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
  await writeFile(`${evidenceDir}/vite.log`, serverLog);
}
