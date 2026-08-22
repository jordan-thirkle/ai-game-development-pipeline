import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const candidate = resolve(process.env.CANDIDATE || '.');
const artifacts = resolve(candidate, 'artifacts/gamepad-input');
await mkdir(artifacts, { recursive: true });

const server = spawn(process.execPath, [resolve(candidate, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', '4173'], {
  cwd: candidate,
  stdio: ['ignore', 'pipe', 'pipe']
});
let serverLog = '';
server.stdout.on('data', chunk => { serverLog += chunk; });
server.stderr.on('data', chunk => { serverLog += chunk; });

const sleep = ms => new Promise(resolvePromise => setTimeout(resolvePromise, ms));
let browser;
let result;
try {
  for (let i = 0; i < 60; i++) {
    try {
      const response = await fetch('http://127.0.0.1:4173/');
      if (response.ok) break;
    } catch {}
    await sleep(250);
    if (i === 59) throw new Error('production preview did not become ready');
  }

  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', error => pageErrors.push(String(error)));
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  await page.waitForSelector('canvas', { state: 'visible', timeout: 15000 });
  await sleep(1000);

  const browserEvidence = await page.evaluate(() => {
    const pads = typeof navigator.getGamepads === 'function' ? Array.from(navigator.getGamepads()) : [];
    const connected = pads.filter(Boolean).map(pad => ({
      index: pad.index,
      id: pad.id,
      mapping: pad.mapping,
      connected: pad.connected,
      axes: pad.axes.length,
      buttons: pad.buttons.length,
      timestamp: pad.timestamp
    }));
    const canvas = document.querySelector('canvas');
    return {
      gamepad_api_available: typeof navigator.getGamepads === 'function',
      connected_gamepads: connected,
      visible_canvas: Boolean(canvas && canvas.getBoundingClientRect().width > 0 && canvas.getBoundingClientRect().height > 0),
      user_agent: navigator.userAgent
    };
  });

  const hardwareObserved = browserEvidence.connected_gamepads.length > 0;
  result = {
    candidate_head_revision: process.env.CANDIDATE_HEAD_SHA || null,
    proof_state: hardwareObserved ? 'hardware-gamepad-enumerated' : 'blocked-no-hardware-gamepad',
    hardware_gamepad_observed: hardwareObserved,
    gamepad_gameplay_mapping_proven: false,
    human_tested: false,
    target_device_performance_proven: false,
    ...browserEvidence,
    console_errors: consoleErrors,
    page_errors: pageErrors,
    passed_environment_probe: browserEvidence.visible_canvas && consoleErrors.length === 0 && pageErrors.length === 0
  };
  if (!result.passed_environment_probe) process.exitCode = 1;
} catch (error) {
  result = {
    candidate_head_revision: process.env.CANDIDATE_HEAD_SHA || null,
    proof_state: 'failed-environment-probe',
    hardware_gamepad_observed: false,
    gamepad_gameplay_mapping_proven: false,
    human_tested: false,
    target_device_performance_proven: false,
    error: String(error),
    passed_environment_probe: false
  };
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
  await sleep(250);
  if (!server.killed) server.kill('SIGKILL');
  await writeFile(resolve(artifacts, 'preview.log'), serverLog);
  await writeFile(resolve(artifacts, 'runtime-result.json'), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
}
