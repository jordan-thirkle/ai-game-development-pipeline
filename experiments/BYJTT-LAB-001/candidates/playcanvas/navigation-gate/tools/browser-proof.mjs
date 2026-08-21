import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';

const evidenceDir = process.env.EVIDENCE_DIR ?? 'evidence';
await mkdir(evidenceDir, { recursive: true });

const serverLog = [];
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4173'], {
  stdio: ['ignore', 'pipe', 'pipe']
});
server.stdout.on('data', (chunk) => serverLog.push(chunk.toString()));
server.stderr.on('data', (chunk) => serverLog.push(chunk.toString()));

async function waitForServer() {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch('http://127.0.0.1:4173/');
      if (response.ok) return;
    } catch {
      // Retry until the bounded deadline.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error('Vite preview did not become ready within 20 seconds');
}

let browser;
const consoleErrors = [];
const pageErrors = [];
let result;

try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(String(error)));

  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle', timeout: 30_000 });
  await page.waitForFunction(() => window.__BYJTT_NAV_OBSERVE__?.().ready === true, null, { timeout: 30_000 });

  const before = await page.evaluate(() => window.__BYJTT_NAV_OBSERVE__?.());
  if (!before) throw new Error('Navigation observation bridge missing');

  await page.evaluate(() => {
    const copy = window.__BYJTT_NAV_OBSERVE__?.();
    if (!copy) throw new Error('Navigation observation bridge missing during mutation probe');
    try {
      copy.path[0].x = 9999;
    } catch {
      // Frozen snapshots may reject writes; authoritative state must still be unchanged below.
    }
  });
  const after = await page.evaluate(() => window.__BYJTT_NAV_OBSERVE__?.());
  if (!after) throw new Error('Navigation observation bridge missing after mutation probe');

  const isolationPassed = after.path[0]?.x === before.path[0]?.x && after.pathLength === before.pathLength;
  const startError = Math.hypot((after.path[0]?.x ?? 999) - after.start.x, (after.path[0]?.z ?? 999) - after.start.z);
  const last = after.path.at(-1);
  const endError = last ? Math.hypot(last.x - after.end.x, last.z - after.end.z) : Number.POSITIVE_INFINITY;

  result = {
    candidate_head: process.env.CANDIDATE_HEAD_SHA ?? 'unknown',
    runtime: 'chromium',
    viewport: { width: 390, height: 844 },
    observation: after,
    checks: {
      nav_mesh_generated: after.navMeshGenerated === true,
      path_found: after.pathFound === true && after.path.length >= 2,
      path_points_inside_arena: after.pointsInsideArena === true,
      path_length_finite: Number.isFinite(after.pathLength) && after.pathLength >= 15 && after.pathLength <= 24,
      start_endpoint_error_m: startError,
      end_endpoint_error_m: endError,
      endpoints_match: startError <= 0.5 && endError <= 0.5,
      observation_mutation_isolation: isolationPassed,
      post_navigation_clamp: after.postNavigationClamp,
      external_input_executed: after.externalInputExecuted,
      console_errors: consoleErrors,
      page_errors: pageErrors
    }
  };

  const passed =
    result.checks.nav_mesh_generated &&
    result.checks.path_found &&
    result.checks.path_points_inside_arena &&
    result.checks.path_length_finite &&
    result.checks.endpoints_match &&
    result.checks.observation_mutation_isolation &&
    result.checks.post_navigation_clamp === false &&
    result.checks.external_input_executed === false &&
    consoleErrors.length === 0 &&
    pageErrors.length === 0;

  result.passed = passed;
  await page.screenshot({ path: `${evidenceDir}/navigation.png`, fullPage: true });
  await writeFile(`${evidenceDir}/runtime-result.json`, `${JSON.stringify(result, null, 2)}\n`);
  await writeFile(`${evidenceDir}/browser-console.json`, `${JSON.stringify({ consoleErrors, pageErrors }, null, 2)}\n`);
  if (!passed) throw new Error(`Navigation proof failed: ${JSON.stringify(result.checks)}`);
} finally {
  await browser?.close();
  server.kill('SIGTERM');
  await writeFile(`${evidenceDir}/vite-preview.log`, serverLog.join(''));
}

console.log(JSON.stringify(result, null, 2));
