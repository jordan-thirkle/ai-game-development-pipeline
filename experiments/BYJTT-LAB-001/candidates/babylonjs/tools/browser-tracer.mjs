import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const url = process.env.BABYLON_URL || 'http://127.0.0.1:4176/';
const artifacts = path.resolve(process.env.BABYLON_ARTIFACTS || 'artifacts/browser-tracer');
await mkdir(artifacts, { recursive: true });

const consoleErrors = [];
let browser;
let page;
let evidence = {
  candidate_id: 'babylonjs',
  phase: 'A-tracer',
  tested_revision: process.env.CANDIDATE_HEAD_SHA || process.env.GITHUB_SHA || 'local-unrecorded',
  execution_verified: false,
  failures: [],
  console_errors: consoleErrors,
};

async function snapshot() {
  return page?.evaluate(() => window.__BYJTT_BENCHMARK__?.snapshot?.() ?? null) ?? null;
}

async function waitForReady(timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const current = await snapshot();
    if (current?.['runtime.errors']?.length) {
      throw new Error(`runtime initialization failed: ${current['runtime.errors'].join(' | ')}`);
    }
    if (current?.['runtime.ready'] === true) return { current, readyMs: Date.now() - started };
    await page.waitForTimeout(100);
  }
  throw new Error(`runtime.ready timeout; final=${JSON.stringify(await snapshot())}; console=${consoleErrors.join(' | ')}`);
}

try {
  browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  page = await context.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.stack || error.message));

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const { current, readyMs } = await waitForReady();
  await page.waitForTimeout(300);
  const afterFrames = await snapshot();
  await page.screenshot({ path: path.join(artifacts, 'tracer.png'), fullPage: true });

  const mutationIsolation = await page.evaluate(() => {
    const first = window.__BYJTT_BENCHMARK__.snapshot();
    const original = first['renderer.backend'];
    try { first['renderer.backend'] = 'mutated-by-test'; } catch {}
    const second = window.__BYJTT_BENCHMARK__.snapshot();
    return second['renderer.backend'] === original;
  });

  const layout = await page.evaluate(() => ({
    innerWidth,
    innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
  }));

  const failures = [];
  if (!current['physics.havok_ready']) failures.push('Havok did not initialize');
  if (!['webgpu', 'webgl2-fallback'].includes(current['renderer.backend'])) failures.push(`unexpected renderer backend: ${current['renderer.backend']}`);
  if ((afterFrames['render.frames'] ?? 0) <= (current['render.frames'] ?? 0)) failures.push('render frames did not advance');
  if (!mutationIsolation) failures.push('snapshot mutation affected subsequent observation');
  if (layout.scrollWidth > 390 || layout.innerWidth !== 390 || layout.innerHeight !== 844) failures.push(`portrait layout mismatch: ${JSON.stringify(layout)}`);
  if (current['runtime.errors']?.length) failures.push(`runtime errors: ${current['runtime.errors'].join(' | ')}`);
  if (consoleErrors.length) failures.push(`console errors: ${consoleErrors.join(' | ')}`);

  evidence = {
    ...evidence,
    execution_verified: failures.length === 0,
    ready_ms: readyMs,
    renderer_backend: current['renderer.backend'],
    webgpu_supported: current['renderer.webgpu_supported'],
    havok_ready: current['physics.havok_ready'],
    havok_plugin_version: current['physics.plugin_version'],
    app_startup_ms: current['startup.ms'],
    frames_before: current['render.frames'],
    frames_after: afterFrames['render.frames'],
    mutation_isolation: mutationIsolation,
    layout,
    failures,
    final_snapshot: afterFrames,
  };
  await writeFile(path.join(artifacts, 'tracer-result.json'), JSON.stringify(evidence, null, 2));

  if (failures.length) throw new Error(`Babylon tracer failures:\n- ${failures.join('\n- ')}`);
  console.log(`Babylon tracer passed: backend=${evidence.renderer_backend}, Havok=${evidence.havok_plugin_version}, ready=${readyMs}ms`);
} catch (error) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const finalSnapshot = await snapshot().catch(() => null);
  evidence = {
    ...evidence,
    final_snapshot: finalSnapshot,
    console_errors: consoleErrors,
    failures: [...new Set([...(evidence.failures || []), message])],
    execution_verified: false,
  };
  await writeFile(path.join(artifacts, 'tracer-result.json'), JSON.stringify(evidence, null, 2));
  throw error;
} finally {
  await browser?.close();
}
