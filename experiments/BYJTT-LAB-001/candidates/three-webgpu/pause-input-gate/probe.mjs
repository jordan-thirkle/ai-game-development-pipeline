import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const gateDir = path.dirname(new URL(import.meta.url).pathname);
const candidateDir = path.resolve(gateDir, '..');
const artifactsDir = path.join(candidateDir, 'artifacts', 'pause-input');
fs.mkdirSync(artifactsDir, { recursive: true });

const expectedHead = process.env.CANDIDATE_HEAD_SHA || '';
const url = 'http://127.0.0.1:4178';
const errors = [];

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function waitForServer() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await sleep(125);
  }
  throw new Error('Vite preview did not become ready');
}

const server = spawn(process.execPath, [path.join(candidateDir, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--host', '127.0.0.1', '--port', '4178', '--strictPort'], {
  cwd: candidateDir,
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: true
});
let serverLog = '';
server.stdout.on('data', (chunk) => { serverLog += chunk.toString(); });
server.stderr.on('data', (chunk) => { serverLog += chunk.toString(); });

let browser;
let result;
try {
  await waitForServer();
  browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--enable-unsafe-webgpu', '--use-angle=swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('console', (message) => { if (message.type() === 'error') errors.push(`console:${message.text()}`); });
  page.on('pageerror', (error) => errors.push(`page:${error.message}`));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__BYJTT_BENCHMARK__?.snapshot?.()['runtime.ready'] === true, null, { timeout: 30000 });

  const snapshot = () => page.evaluate(() => window.__BYJTT_BENCHMARK__.snapshot());
  const initial = await snapshot();

  // Enter legitimate salvage attack range through normal held movement only.
  await page.keyboard.down('KeyS');
  await sleep(2500);
  await page.keyboard.up('KeyS');
  await sleep(300);
  await page.keyboard.down('KeyD');
  await sleep(1200);
  await page.keyboard.up('KeyD');
  await sleep(500);

  const beforePause = await snapshot();
  const position = beforePause['player.position'];
  const salvageDistance = Math.hypot(position.x - 5, position.z - 0);

  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__BYJTT_BENCHMARK__.snapshot().paused === true, null, { timeout: 3000 });
  const pausedBeforeAttack = await snapshot();

  await page.keyboard.press('Space');
  await sleep(350);
  const pausedAfterAttack = await snapshot();

  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__BYJTT_BENCHMARK__.snapshot().paused === false, null, { timeout: 3000 });
  await sleep(350);
  const afterResume = await snapshot();

  await page.screenshot({ path: path.join(artifactsDir, 'after-resume.png'), fullPage: true });

  const enteredRange = salvageDistance <= 1.8;
  const unchangedWhilePaused = pausedAfterAttack['salvage.health'] === pausedBeforeAttack['salvage.health'];
  const unchangedAfterResume = afterResume['salvage.health'] === pausedBeforeAttack['salvage.health'];
  const blockerReproduced = enteredRange && unchangedWhilePaused && !unchangedAfterResume;
  const passed = enteredRange && unchangedWhilePaused && unchangedAfterResume && errors.length === 0;

  result = {
    tested_revision: expectedHead,
    proof_state: passed ? 'pause-input-release-proven' : blockerReproduced ? 'blocked-paused-attack-leak' : 'pause-input-proof-failed',
    passed,
    human_tested: false,
    physical_device_executed: false,
    production_source_modified_by_gate: false,
    direct_gameplay_mutation_surface_exposed: false,
    attack_input_transport: 'physical-browser-keyboard',
    salvage_attack_range_m: 1.8,
    salvage_distance_before_pause_m: salvageDistance,
    salvage_health_before_pause: pausedBeforeAttack['salvage.health'],
    salvage_health_while_paused_after_space: pausedAfterAttack['salvage.health'],
    salvage_health_after_resume: afterResume['salvage.health'],
    paused_before_attack: pausedBeforeAttack.paused,
    paused_after_attack: pausedAfterAttack.paused,
    resumed: afterResume.paused === false,
    initial_runtime_ready: initial['runtime.ready'],
    observation_copy_only: true,
    browser_errors: errors,
    failures: [
      ...(enteredRange ? [] : [`did not enter salvage attack range: ${salvageDistance}`]),
      ...(unchangedWhilePaused ? [] : ['salvage changed while paused']),
      ...(unchangedAfterResume ? [] : ['paused attack was replayed after resume']),
      ...errors
    ]
  };
  fs.writeFileSync(path.join(artifactsDir, 'runtime-result.json'), `${JSON.stringify(result, null, 2)}\n`);
  if (!passed) process.exitCode = 1;
} catch (error) {
  result = {
    tested_revision: expectedHead,
    proof_state: 'pause-input-proof-failed',
    passed: false,
    human_tested: false,
    production_source_modified_by_gate: false,
    failures: [error?.stack || String(error), ...errors]
  };
  fs.writeFileSync(path.join(artifactsDir, 'runtime-result.json'), `${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = 1;
} finally {
  fs.writeFileSync(path.join(artifactsDir, 'vite-preview.log'), serverLog);
  if (browser) await browser.close();
  try { process.kill(-server.pid, 'SIGTERM'); } catch {}
}
