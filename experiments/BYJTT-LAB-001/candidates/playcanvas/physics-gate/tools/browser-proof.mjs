import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.BYJTT_PHYSICS_URL ?? 'http://127.0.0.1:4174';
const candidateSha = process.env.CANDIDATE_SHA ?? 'unknown';
const evidenceDir = resolve('evidence');
await mkdir(evidenceDir, { recursive: true });

const failures = [];
const consoleErrors = [];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('pageerror', (error) => consoleErrors.push(error.stack ?? error.message));

const startedAt = Date.now();
let before = null;
let afterDrop = null;
let afterWall = null;
let mutationIsolation = false;
let provenance = null;

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 15_000 });
  await page.waitForFunction(() => window.__BYJTT_PLAYCANVAS_PHYSICS__?.snapshot().runtime.ready === true, null, { timeout: 12_000 });
  provenance = await page.evaluate(async () => (await fetch('/ammo/provenance.json')).json());
  await page.getByRole('button', { name: 'Start physics gate' }).click();
  await page.waitForFunction(() => window.__BYJTT_PLAYCANVAS_PHYSICS__?.snapshot().scene.gameplay_active === true);
  before = await page.evaluate(() => window.__BYJTT_PLAYCANVAS_PHYSICS__?.snapshot() ?? null);

  await page.waitForTimeout(1800);
  afterDrop = await page.evaluate(() => window.__BYJTT_PLAYCANVAS_PHYSICS__?.snapshot() ?? null);
  if (!afterDrop) throw new Error('Missing post-drop physics snapshot');
  if (!(afterDrop.probe.position[1] >= 0.2 && afterDrop.probe.position[1] <= 0.8)) {
    failures.push(`gravity/contact probe did not settle on floor: y=${afterDrop.probe.position[1]}`);
  }

  await page.keyboard.down('KeyD');
  await page.waitForTimeout(1800);
  await page.keyboard.up('KeyD');
  await page.waitForTimeout(250);
  afterWall = await page.evaluate(() => window.__BYJTT_PLAYCANVAS_PHYSICS__?.snapshot() ?? null);
  if (!before || !afterWall) throw new Error('Missing movement physics snapshot');
  const movement = afterWall.player.position[0] - before.player.position[0];
  if (movement <= 1.0) failures.push(`normal KeyD input moved only ${movement.toFixed(3)} m`);
  const eastWallStop = 12 - 0.175 - 0.4;
  if (afterWall.player.position[0] > eastWallStop + 0.2) {
    failures.push(`dynamic player penetrated east wall: x=${afterWall.player.position[0]}, expected <= ${(eastWallStop + 0.2).toFixed(3)}`);
  }

  mutationIsolation = await page.evaluate(() => {
    const first = window.__BYJTT_PLAYCANVAS_PHYSICS__?.snapshot();
    if (!first) return false;
    try { first.player.position[0] = -999; } catch {}
    const second = window.__BYJTT_PLAYCANVAS_PHYSICS__?.snapshot();
    return Boolean(second && second.player.position[0] !== -999);
  });
  if (!mutationIsolation) failures.push('read-only physics observation mutation isolation failed');

  await page.screenshot({ path: resolve(evidenceDir, 'physics-gate.png'), fullPage: true });
} catch (error) {
  failures.push(error instanceof Error ? (error.stack ?? error.message) : String(error));
} finally {
  await browser.close();
}

if (consoleErrors.length) failures.push(`browser console/page errors: ${consoleErrors.join(' | ')}`);

const result = {
  schema_version: 1,
  candidate_id: 'playcanvas',
  gate: 'native-ammo-physics',
  candidate_head_revision: candidateSha,
  execution_verified: failures.length === 0,
  browser: 'chromium',
  viewport: { width: 390, height: 844 },
  startup_ms: Date.now() - startedAt,
  observations: {
    before,
    after_drop: afterDrop,
    after_wall: afterWall,
    observation_mutation_isolation: mutationIsolation
  },
  ammo_provenance: provenance,
  console_errors: consoleErrors,
  failures
};

await writeFile(resolve(evidenceDir, 'physics-gate-result.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(result, null, 2));
if (!result.execution_verified) process.exitCode = 1;
