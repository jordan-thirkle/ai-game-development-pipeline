import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const baseURL = process.env.PLAYCANVAS_URL || 'http://127.0.0.1:4175/';
const artifacts = process.env.PLAYCANVAS_ARTIFACTS || 'artifacts/browser-tracer';
await mkdir(artifacts, { recursive: true });

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const consoleErrors = [];
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('pageerror', (error) => consoleErrors.push(error.message));
await page.route('**/favicon.ico', (route) => route.fulfill({ status: 204, body: '' }));

const startedAt = performance.now();
const response = await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
assert(response?.ok(), `candidate HTTP ${response?.status()}`);
await page.waitForFunction(() => typeof window.__BYJTT_OBSERVE__ === 'function');
const readyMs = performance.now() - startedAt;

const initial = await page.evaluate(() => window.__BYJTT_OBSERVE__());
assert.equal(initial.runtime.ready, true);
assert(['webgpu', 'webgl2'].includes(initial.runtime.backend), `unexpected renderer backend ${initial.runtime.backend}`);
assert.deepEqual(initial.player.position, [0, 1, 10]);
assert.deepEqual(initial.enemy.position, [0, 1, -6]);
assert.equal(initial.scene.gameplay_active, false);
assert.equal(initial.reward.count, 0);
assert.deepEqual(initial.upgrade.selected_ids, []);

await page.locator('#start').click();
await page.waitForFunction(() => window.__BYJTT_OBSERVE__().scene.gameplay_active === true);

const beforeMove = await page.evaluate(() => window.__BYJTT_OBSERVE__().player.position);
await page.keyboard.down('w');
await page.waitForTimeout(1100);
await page.keyboard.up('w');
const afterMove = await page.evaluate(() => window.__BYJTT_OBSERVE__().player.position);
const moved = Math.hypot(afterMove[0] - beforeMove[0], afterMove[2] - beforeMove[2]);
assert(moved > 1, `player moved only ${moved.toFixed(3)}m`);
assert(Math.abs(afterMove[0]) <= 11.4 && Math.abs(afterMove[2]) <= 15.4, 'player left arena bounds');

const progressionBeforeCamera = await page.evaluate(() => {
  const state = window.__BYJTT_OBSERVE__();
  return { reward: state.reward.count, upgrades: state.upgrade.selected_ids };
});
const canvas = page.locator('#application');
const box = await canvas.boundingBox();
assert(box, 'canvas has no layout box');
await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.4);
await page.mouse.down();
await page.mouse.move(box.x + box.width * 0.72, box.y + box.height * 0.34, { steps: 5 });
await page.mouse.up();
const progressionAfterCamera = await page.evaluate(() => {
  const state = window.__BYJTT_OBSERVE__();
  return { reward: state.reward.count, upgrades: state.upgrade.selected_ids };
});
assert.deepEqual(progressionAfterCamera, progressionBeforeCamera, 'camera input mutated progression');

const mutationProbe = await page.evaluate(() => {
  const first = window.__BYJTT_OBSERVE__();
  first.player.health = -999;
  first.reward.count = 999;
  const second = window.__BYJTT_OBSERVE__();
  return { health: second.player.health, reward: second.reward.count };
});
assert.equal(mutationProbe.health, 100, 'observation snapshot mutated internal player health');
assert.equal(mutationProbe.reward, 0, 'observation snapshot mutated internal reward count');

const forbiddenGlobals = await page.evaluate(() => [
  '__BYJTT_TELEPORT__',
  '__BYJTT_SET_HEALTH__',
  '__BYJTT_GRANT_REWARD__',
  '__BYJTT_WRITE_SAVE__'
].filter((name) => name in window));
assert.deepEqual(forbiddenGlobals, [], `forbidden mutation shortcuts exposed: ${forbiddenGlobals.join(', ')}`);

await page.screenshot({ path: `${artifacts}/portrait-tracer.png`, fullPage: true });
const width = await page.evaluate(() => document.documentElement.scrollWidth);
assert(width <= 390, `portrait layout overflows: ${width}px`);
assert.deepEqual(consoleErrors, [], `console/page errors: ${consoleErrors.join(' | ')}`);

const final = await page.evaluate(() => window.__BYJTT_OBSERVE__());
console.log(JSON.stringify({
  result: 'pass',
  ready_ms: Number(readyMs.toFixed(1)),
  renderer_backend: final.runtime.backend,
  player_distance_m: Number(moved.toFixed(3)),
  viewport: [390, 844],
  observation_mutation_isolated: true
}, null, 2));

await browser.close();
