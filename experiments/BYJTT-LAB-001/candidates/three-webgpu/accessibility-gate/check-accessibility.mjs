import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const PORT = 4186;
const URL = `http://127.0.0.1:${PORT}`;
const artifacts = path.resolve('artifacts/accessibility');
await mkdir(artifacts, { recursive: true });

const server = spawn(process.execPath, [
  path.resolve('node_modules/vite/bin/vite.js'),
  'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'
], { stdio: ['ignore', 'pipe', 'pipe'] });

let serverLog = '';
server.stdout.on('data', (chunk) => { serverLog += chunk.toString(); });
server.stderr.on('data', (chunk) => { serverLog += chunk.toString(); });

const failures = [];
const consoleErrors = [];
let browser;
let page;

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const response = await fetch(URL);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`preview server failed to start: ${serverLog}`);
}

async function snapshot() {
  return page.evaluate(() => window.__BYJTT_BENCHMARK__?.snapshot?.() ?? null);
}

async function waitFor(predicate, label, timeout = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const current = await snapshot();
    if (current && predicate(current)) return current;
    await page.waitForTimeout(80);
  }
  throw new Error(`timed out waiting for ${label}; final=${JSON.stringify(await snapshot())}`);
}

function check(condition, message) {
  if (!condition) failures.push(message);
}

try {
  await waitForServer();
  browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  page = await context.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.stack || error.message));

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitFor((s) => s['runtime.ready'] === true, 'runtime.ready');

  const documentFacts = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    title: document.title,
    statsLive: document.querySelector('#stats')?.getAttribute('aria-live') ?? null,
    bannerRole: document.querySelector('#banner')?.getAttribute('role') ?? null,
    bannerLive: document.querySelector('#banner')?.getAttribute('aria-live') ?? null
  }));
  check(documentFacts.lang.trim().length > 0, 'document language is missing');
  check(documentFacts.title.trim().length > 0, 'document title is missing');

  const controls = await page.locator('button:visible').evaluateAll((buttons) => buttons.map((button) => {
    const rect = button.getBoundingClientRect();
    const label = button.getAttribute('aria-label')?.trim() || button.textContent?.trim() || '';
    return {
      id: button.id || null,
      hold: button.getAttribute('data-hold'),
      tap: button.getAttribute('data-tap'),
      label,
      width: rect.width,
      height: rect.height
    };
  }));
  check(controls.length >= 10, `expected at least 10 visible production controls, got ${controls.length}`);
  for (const control of controls) {
    check(control.label.length > 0, `visible button has no accessible name: ${JSON.stringify(control)}`);
    check(control.width >= 44 && control.height >= 44, `control target below 44x44 CSS px: ${JSON.stringify(control)}`);
  }

  await page.locator('body').focus();
  const tabTraversal = [];
  for (let i = 0; i < controls.length; i++) {
    await page.keyboard.press('Tab');
    tabTraversal.push(await page.evaluate(() => {
      const active = document.activeElement;
      return {
        tag: active?.tagName ?? null,
        id: active?.id || null,
        hold: active?.getAttribute?.('data-hold') ?? null,
        tap: active?.getAttribute?.('data-tap') ?? null,
        label: active?.getAttribute?.('aria-label')?.trim() || active?.textContent?.trim() || '',
        focusVisible: active instanceof Element ? active.matches(':focus-visible') : false
      };
    }));
  }
  check(tabTraversal.every((entry) => entry.tag === 'BUTTON'), `Tab traversal escaped visible button controls: ${JSON.stringify(tabTraversal)}`);
  check(tabTraversal.every((entry) => entry.focusVisible === true), `keyboard focus was not focus-visible for every traversed control: ${JSON.stringify(tabTraversal)}`);
  const traversalKeys = new Set(tabTraversal.map((entry) => `${entry.id}|${entry.hold}|${entry.tap}|${entry.label}`));
  check(traversalKeys.size === controls.length, `Tab traversal did not reach each visible button exactly once before cycling: ${JSON.stringify(tabTraversal)}`);

  await page.locator('#save').focus();
  await page.keyboard.press('Enter');
  const saved = await waitFor((s) => s['save.schema_version'] === 1, 'keyboard-activated save');
  check(saved['save.schema_version'] === 1, 'Save button was not keyboard operable');
  await page.waitForTimeout(100);
  const saveStatus = await page.evaluate(() => {
    const banner = document.querySelector('#banner');
    return {
      text: banner?.textContent?.trim() ?? '',
      role: banner?.getAttribute('role') ?? null,
      ariaLive: banner?.getAttribute('aria-live') ?? null
    };
  });
  check(saveStatus.text === 'Progress saved', `normal save status was not visibly published: ${JSON.stringify(saveStatus)}`);
  check(saveStatus.role === 'status' || ['polite', 'assertive'].includes(saveStatus.ariaLive), `save status is visual-only and not programmatically exposed as a status message: ${JSON.stringify(saveStatus)}`);

  const pauseButton = page.locator('[data-tap="Escape"]');
  await pauseButton.focus();
  await page.keyboard.press('Enter');
  let paused = await waitFor((s) => s['runtime.paused'] === true || s['player.paused'] === true || s['paused'] === true, 'keyboard pause', 3000).catch(() => snapshot());
  const pausedValue = paused['runtime.paused'] ?? paused['player.paused'] ?? paused['paused'] ?? null;
  check(pausedValue === true, `Pause button did not enter paused state through keyboard activation: ${JSON.stringify(paused)}`);
  await page.keyboard.press('Enter');
  paused = await page.waitForTimeout(120).then(() => snapshot());
  const resumedValue = paused['runtime.paused'] ?? paused['player.paused'] ?? paused['paused'] ?? null;
  check(resumedValue === false, `Pause button did not resume through keyboard activation: ${JSON.stringify(paused)}`);

  check(consoleErrors.length === 0, `browser/page errors observed: ${JSON.stringify(consoleErrors)}`);

  await page.screenshot({ path: path.join(artifacts, 'accessibility-runtime.png'), fullPage: true });

  const result = {
    schema_version: 1,
    candidate_id: 'three-webgpu',
    tested_revision: process.env.CANDIDATE_HEAD_SHA || process.env.GITHUB_SHA || 'local-unrecorded',
    browser: 'Google Chrome via Playwright channel=chrome',
    viewport: { width: 390, height: 844 },
    document: documentFacts,
    visible_controls: controls,
    tab_traversal: tabTraversal,
    save_status: saveStatus,
    failures,
    console_errors: consoleErrors,
    accessibility_state: failures.length === 0 ? 'accessibility-boundary-proven' : 'accessibility-blocked',
    passed: failures.length === 0,
    human_tested: false,
    physical_device_executed: false,
    target_device_performance_proven: false,
    production_source_modified_by_gate: false
  };
  await writeFile(path.join(artifacts, 'runtime-result.json'), JSON.stringify(result, null, 2));
  await writeFile(path.join(artifacts, 'server.log'), serverLog);
  console.log(JSON.stringify(result, null, 2));
  if (!result.passed) process.exitCode = 1;
} catch (error) {
  failures.push(error.stack || error.message);
  await writeFile(path.join(artifacts, 'runtime-result.json'), JSON.stringify({
    schema_version: 1,
    candidate_id: 'three-webgpu',
    tested_revision: process.env.CANDIDATE_HEAD_SHA || process.env.GITHUB_SHA || 'local-unrecorded',
    failures,
    console_errors: consoleErrors,
    accessibility_state: 'accessibility-blocked-execution-error',
    passed: false,
    human_tested: false,
    physical_device_executed: false,
    target_device_performance_proven: false,
    production_source_modified_by_gate: false
  }, null, 2));
  await writeFile(path.join(artifacts, 'server.log'), serverLog);
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser?.close().catch(() => {});
  server.kill('SIGTERM');
}
