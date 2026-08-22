import { chromium } from 'playwright';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';

const execFileAsync = promisify(execFile);
const root = process.cwd();
const artifactDir = path.join(root, 'artifacts', 'focus-input');
await fs.mkdir(artifactDir, { recursive: true });
const testedRevision = process.env.CANDIDATE_HEAD_SHA || 'unknown';
const port = 4178;
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: process.env,
});
let serverLog = '';
server.stdout.on('data', (chunk) => { serverLog += chunk.toString(); });
server.stderr.on('data', (chunk) => { serverLog += chunk.toString(); });

async function waitForServer() {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(origin);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`preview server did not become ready: ${serverLog}`);
}

async function waitForWindow(name, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const { stdout } = await execFileAsync('xdotool', ['search', '--onlyvisible', '--name', name]);
      const id = stdout.trim().split(/\s+/).find(Boolean);
      if (id) return id;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`X11 focus sink window did not appear: ${name}`);
}

const errors = [];
let browser;
let page;
let focusSinkProcess;
const result = {
  tested_revision: testedRevision,
  proof_state: 'not-run',
  runtime_ready: false,
  movement_before_blur_m: null,
  movement_after_blur_m: null,
  focus_loss_drift_m: null,
  focus_transfer_method: 'x11-window-manager-xmessage',
  focus_before_transfer: null,
  focus_after_transfer: null,
  trusted_blur_observed: false,
  focus_sink_window_id: null,
  safe_focus_release_proven: false,
  production_source_modified: false,
  direct_input_state_mutation: false,
  failures: errors,
};

try {
  await waitForServer();
  browser = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome' });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  page = await context.newPage();
  page.on('console', (message) => { if (message.type() === 'error') errors.push(`console:${message.text()}`); });
  page.on('pageerror', (error) => errors.push(`page:${error.message}`));
  await page.goto(origin, { waitUntil: 'networkidle', timeout: 30_000 });
  await page.bringToFront();
  await page.waitForFunction(() => document.hasFocus() === true, null, { timeout: 5_000 });
  await page.waitForFunction(() => window.__BYJTT_BENCHMARK__?.snapshot?.()['runtime.ready'] === true, null, { timeout: 30_000 });
  result.runtime_ready = true;
  result.focus_before_transfer = await page.evaluate(() => document.hasFocus());

  await page.evaluate(() => {
    Object.defineProperty(window, '__BYJTT_FOCUS_PROBE__', {
      configurable: true,
      enumerable: false,
      writable: true,
      value: { blurCount: 0, trustedBlur: false, hasFocusDuringBlur: null },
    });
    window.addEventListener('blur', (event) => {
      window.__BYJTT_FOCUS_PROBE__.blurCount += 1;
      window.__BYJTT_FOCUS_PROBE__.trustedBlur ||= event.isTrusted === true;
      window.__BYJTT_FOCUS_PROBE__.hasFocusDuringBlur = document.hasFocus();
    }, { once: true });
  });

  const readX = () => page.evaluate(() => window.__BYJTT_BENCHMARK__.snapshot()['player.position'].x);
  const startX = await readX();
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(700);
  const beforeBlurX = await readX();
  result.movement_before_blur_m = Math.abs(beforeBlurX - startX);

  const sinkTitle = `BYJTT Focus Sink ${process.pid}`;
  focusSinkProcess = spawn('xmessage', ['-center', '-buttons', 'OK:0', '-title', sinkTitle, 'BYJTT focus-loss proof sink'], {
    stdio: ['ignore', 'ignore', 'pipe'],
    env: process.env,
  });
  const sinkWindowId = await waitForWindow(sinkTitle);
  result.focus_sink_window_id = sinkWindowId;
  await execFileAsync('xdotool', ['windowactivate', '--sync', sinkWindowId]);
  await page.waitForFunction(() => document.hasFocus() === false, null, { timeout: 5_000 });
  result.focus_after_transfer = await page.evaluate(() => document.hasFocus());
  const focusEvidence = await page.evaluate(() => ({ ...window.__BYJTT_FOCUS_PROBE__ }));
  result.trusted_blur_observed = focusEvidence.blurCount === 1
    && focusEvidence.trustedBlur === true
    && focusEvidence.hasFocusDuringBlur === false;

  await page.waitForTimeout(700);
  const afterBlurX = await readX();
  result.movement_after_blur_m = Math.abs(afterBlurX - startX);
  result.focus_loss_drift_m = Math.abs(afterBlurX - beforeBlurX);

  await page.keyboard.up('KeyD');
  await page.waitForTimeout(350);

  if (result.movement_before_blur_m < 0.5) errors.push(`pre-blur movement too small: ${result.movement_before_blur_m}`);
  if (result.focus_before_transfer !== true || result.focus_after_transfer !== false || result.trusted_blur_observed !== true) {
    result.proof_state = 'inconclusive-focus-transfer';
  } else if (errors.length === 0 && result.focus_loss_drift_m <= 0.15) {
    result.proof_state = 'focus-input-release-proven';
    result.safe_focus_release_proven = true;
  } else if (errors.length === 0) {
    result.proof_state = 'blocked-focus-input-stuck';
  } else {
    result.proof_state = 'execution-failed';
  }

  await page.screenshot({ path: path.join(artifactDir, 'after-focus-loss.png'), fullPage: true });
} catch (error) {
  errors.push(error instanceof Error ? error.stack || error.message : String(error));
  result.proof_state = 'execution-failed';
  try { if (page) await page.keyboard.up('KeyD'); } catch {}
} finally {
  if (focusSinkProcess && !focusSinkProcess.killed) focusSinkProcess.kill('SIGTERM');
  if (browser) await browser.close();
  server.kill('SIGTERM');
  await fs.writeFile(path.join(artifactDir, 'preview.log'), serverLog);
  await fs.writeFile(path.join(artifactDir, 'runtime-result.json'), `${JSON.stringify(result, null, 2)}\n`);
}

console.log(JSON.stringify(result, null, 2));
if (result.proof_state !== 'focus-input-release-proven') process.exitCode = 1;
