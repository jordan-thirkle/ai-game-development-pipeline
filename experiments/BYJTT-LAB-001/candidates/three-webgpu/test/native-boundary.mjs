import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';

const cwd = new URL('..', import.meta.url).pathname;
const artifacts = new URL('../artifacts/phase-a/', import.meta.url).pathname;
await mkdir(artifacts, { recursive: true });

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4174'], {
  cwd,
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', (chunk) => { serverLog += chunk; });
server.stderr.on('data', (chunk) => { serverLog += chunk; });

const errors = [];
let browser;
try {
  await new Promise((resolve, reject) => {
    const deadline = setTimeout(() => reject(new Error(`vite did not start\n${serverLog}`)), 15000);
    const poll = async () => {
      try {
        const response = await fetch('http://127.0.0.1:4174/native-boundary/');
        if (response.ok) {
          clearTimeout(deadline);
          resolve();
          return;
        }
      } catch {}
      setTimeout(poll, 100);
    };
    poll();
  });

  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });

  await page.goto('http://127.0.0.1:4174/native-boundary/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__threeNativeBoundary?.observe().ready === true);
  const start = await page.evaluate(() => window.__threeNativeBoundary.observe());
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(1600);
  await page.keyboard.up('KeyD');
  await page.waitForTimeout(150);
  const stopped = await page.evaluate(() => window.__threeNativeBoundary.observe());

  const mutated = await page.evaluate(() => {
    const snapshot = window.__threeNativeBoundary.observe();
    try { snapshot.x = 999; } catch {}
    return { attempted: snapshot.x, fresh: window.__threeNativeBoundary.observe().x };
  });

  const expectedMaxX = stopped.eastWallX - 0.42 - 0.25 + 0.08;
  const result = {
    start,
    stopped,
    travelled: stopped.x - start.x,
    expectedMaxX,
    nativeBoundary: stopped.nativeBoundary,
    observationIsolation: mutated.fresh !== 999,
    errors,
  };

  await page.screenshot({ path: `${artifacts}/three-native-boundary.png`, fullPage: true });
  await writeFile(`${artifacts}/three-native-boundary.json`, `${JSON.stringify(result, null, 2)}\n`);
  await writeFile(`${artifacts}/three-native-boundary-server.log`, serverLog);

  if (errors.length) throw new Error(`browser errors: ${errors.join(' | ')}`);
  if (!stopped.nativeBoundary) throw new Error('native boundary marker missing');
  if (result.travelled < 2.5) throw new Error(`insufficient normal-input movement: ${result.travelled}`);
  if (stopped.x > expectedMaxX) throw new Error(`character crossed east native wall: x=${stopped.x}, max=${expectedMaxX}`);
  if (stopped.x < 11.0) throw new Error(`character did not reach east wall: x=${stopped.x}`);
  if (!result.observationIsolation) throw new Error('observation mutation leaked into engine state');

  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
