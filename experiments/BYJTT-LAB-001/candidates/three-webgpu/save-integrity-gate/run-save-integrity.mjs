import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const candidateRoot = path.resolve('.');
const artifactsDir = path.join(candidateRoot, 'artifacts', 'save-integrity');
const port = 4188;
const url = `http://127.0.0.1:${port}`;
const saveKey = 'byjtt-lab-001-three-webgpu-v1';
const knownUpgrade = 'damage-up-1';
await mkdir(artifactsDir, { recursive: true });

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: candidateRoot,
  stdio: ['ignore', 'pipe', 'pipe']
});
let serverLog = '';
server.stdout.on('data', (chunk) => { serverLog += chunk.toString(); });
server.stderr.on('data', (chunk) => { serverLog += chunk.toString(); });

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt++) {
    if (server.exitCode !== null) throw new Error(`Vite preview exited early (${server.exitCode}):\n${serverLog}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Vite preview did not become ready:\n${serverLog}`);
}

const cases = [
  { id: 'absent', raw: null, mode: 'baseline' },
  { id: 'malformed-json', raw: '{not-json', mode: 'baseline' },
  { id: 'wrong-schema', raw: JSON.stringify({ schema_version: 999, reward_count: 1, selected_upgrades: [knownUpgrade] }), mode: 'baseline' },
  { id: 'non-numeric-reward', raw: JSON.stringify({ schema_version: 1, reward_count: 'not-a-number', selected_upgrades: [knownUpgrade] }), mode: 'invalid-reward' },
  { id: 'negative-reward', raw: JSON.stringify({ schema_version: 1, reward_count: -4, selected_upgrades: [] }), mode: 'invalid-reward' },
  { id: 'unknown-upgrade', raw: JSON.stringify({ schema_version: 1, reward_count: 1, selected_upgrades: ['unknown-upgrade'] }), mode: 'unknown-upgrade' }
];

let browser;
const results = [];
const failures = [];

async function waitForReady(page) {
  const started = Date.now();
  while (Date.now() - started < 12000) {
    const snapshot = await page.evaluate(() => window.__BYJTT_BENCHMARK__?.snapshot?.() ?? null).catch(() => null);
    if (snapshot?.['runtime.ready'] === true && snapshot?.['scene.gameplay_active'] === true) return snapshot;
    await page.waitForTimeout(80);
  }
  throw new Error('Timed out waiting for production observation bridge');
}

function evaluateCase(testCase, snapshot) {
  const localFailures = [];
  const reward = snapshot['reward.count'];
  const upgrades = Array.isArray(snapshot['upgrade.selected_ids']) ? snapshot['upgrade.selected_ids'] : [];
  const damage = snapshot['player.effective_attack_damage'];

  if (!Number.isFinite(reward) || !Number.isInteger(reward) || reward < 0) localFailures.push(`reward.count must be a finite non-negative integer; observed=${String(reward)}`);
  if (upgrades.some((id) => id !== knownUpgrade)) localFailures.push(`unknown upgrade identifiers imported: ${JSON.stringify(upgrades)}`);
  if (!Number.isFinite(damage) || damage < 34) localFailures.push(`effective attack damage is invalid: ${String(damage)}`);

  if (testCase.mode === 'baseline') {
    if (reward !== 0) localFailures.push(`baseline recovery expected reward.count=0; observed=${String(reward)}`);
    if (upgrades.length !== 0) localFailures.push(`baseline recovery expected no upgrades; observed=${JSON.stringify(upgrades)}`);
    if (damage !== 34) localFailures.push(`baseline recovery expected damage=34; observed=${String(damage)}`);
  }
  if (testCase.mode === 'invalid-reward') {
    if (reward !== 0) localFailures.push(`invalid reward document must fail closed to reward.count=0; observed=${String(reward)}`);
    if (upgrades.includes(knownUpgrade)) localFailures.push('invalid reward document retained damage-up-1');
    if (damage !== 34) localFailures.push(`invalid reward document elevated damage; observed=${String(damage)}`);
  }
  if (testCase.mode === 'unknown-upgrade') {
    if (upgrades.length !== 0) localFailures.push(`unknown upgrade must be discarded; observed=${JSON.stringify(upgrades)}`);
    if (damage !== 34) localFailures.push(`unknown upgrade changed damage; observed=${String(damage)}`);
  }
  return localFailures;
}

try {
  await waitForServer();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const testCase of cases) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript(({ key, raw }) => {
      if (raw === null) localStorage.removeItem(key);
      else localStorage.setItem(key, raw);
    }, { key: saveKey, raw: testCase.raw });
    const page = await context.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    page.on('pageerror', (error) => pageErrors.push(error.message));
    let snapshot = null;
    const localFailures = [];
    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
      if (!response?.ok()) localFailures.push(`navigation status=${response?.status() ?? 'none'}`);
      snapshot = await waitForReady(page);
      localFailures.push(...evaluateCase(testCase, snapshot));
      if (consoleErrors.length) localFailures.push(`console errors: ${consoleErrors.join(' | ')}`);
      if (pageErrors.length) localFailures.push(`page errors: ${pageErrors.join(' | ')}`);
      await page.screenshot({ path: path.join(artifactsDir, `${testCase.id}.png`), fullPage: true });
    } catch (error) {
      localFailures.push(error instanceof Error ? error.stack || error.message : String(error));
    }
    const normalizedSnapshot = snapshot ? {
      runtime_ready: snapshot['runtime.ready'],
      reward_count: Number.isFinite(snapshot['reward.count']) ? snapshot['reward.count'] : String(snapshot['reward.count']),
      selected_upgrades: snapshot['upgrade.selected_ids'],
      effective_attack_damage: Number.isFinite(snapshot['player.effective_attack_damage']) ? snapshot['player.effective_attack_damage'] : String(snapshot['player.effective_attack_damage']),
      save_schema_version: snapshot['save.schema_version']
    } : null;
    results.push({ id: testCase.id, mode: testCase.mode, snapshot: normalizedSnapshot, console_errors: consoleErrors, page_errors: pageErrors, failures: localFailures, passed: localFailures.length === 0 });
    for (const failure of localFailures) failures.push(`${testCase.id}: ${failure}`);
    await context.close();
  }
} catch (error) {
  failures.push(error instanceof Error ? error.stack || error.message : String(error));
} finally {
  if (browser) await browser.close().catch(() => {});
  server.kill('SIGTERM');
  await new Promise((resolve) => {
    if (server.exitCode !== null) return resolve();
    const timer = setTimeout(() => { server.kill('SIGKILL'); resolve(); }, 2000);
    server.once('exit', () => { clearTimeout(timer); resolve(); });
  });
}

const result = {
  schema_version: 1,
  benchmark_id: 'BYJTT-LAB-001',
  candidate_id: 'three-webgpu',
  proof: 'save-integrity',
  tested_revision: process.env.CANDIDATE_HEAD_SHA || process.env.GITHUB_SHA || 'local-unrecorded',
  production_source_modified_by_gate: false,
  persistence_fuzz_input_used: true,
  persistence_fuzz_counts_as_gameplay_progress: false,
  direct_gameplay_mutation_surface_exposed: false,
  human_tested: false,
  cases: results,
  failures,
  passed: failures.length === 0
};
await writeFile(path.join(artifactsDir, 'runtime-result.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
await writeFile(path.join(artifactsDir, 'server.log'), serverLog, 'utf8');
console.log(JSON.stringify(result, null, 2));
if (!result.passed) process.exitCode = 1;
