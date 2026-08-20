import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const baseURL = process.env.PLAYCANVAS_URL || 'http://127.0.0.1:4175/';
const artifacts = process.env.PLAYCANVAS_ARTIFACTS || 'artifacts/integrated-ammo';
await mkdir(artifacts, { recursive: true });

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
await page.route('**/favicon.ico', (route) => route.fulfill({ status: 204, body: '' }));

const response = await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
assert(response?.ok(), `candidate HTTP ${response?.status()}`);
await page.waitForFunction(() => typeof window.__BYJTT_OBSERVE__ === 'function');

const initial = await page.evaluate(() => window.__BYJTT_OBSERVE__());
assert.equal(initial.runtime.ready, true);
assert.equal(initial.runtime.physics_backend, 'ammo');
assert.deepEqual(initial.player.position, [0, 1, 10]);

await page.locator('#start').click();
await page.waitForFunction(() => window.__BYJTT_OBSERVE__().scene.gameplay_active === true);

const before = await page.evaluate(() => window.__BYJTT_OBSERVE__().player.position);
await page.keyboard.down('d');
await page.waitForTimeout(4000);
await page.keyboard.up('d');
await page.waitForTimeout(250);
const wallStop = await page.evaluate(() => window.__BYJTT_OBSERVE__().player.position);
const movement = Math.hypot(wallStop[0] - before[0], wallStop[2] - before[2]);
assert(movement > 10, `normal KeyD movement was only ${movement.toFixed(3)}m`);
assert(wallStop[0] >= 11.2, `player did not reach east native wall: x=${wallStop[0]}`);
assert(wallStop[0] <= 11.43, `player penetrated east native wall: x=${wallStop[0]}`);
assert(Math.abs(wallStop[2] - 10) < 0.08, `unexpected Z drift while driving wall: z=${wallStop[2]}`);

await page.waitForTimeout(500);
const released = await page.evaluate(() => window.__BYJTT_OBSERVE__().player.position);
const releaseDrift = Math.hypot(released[0] - wallStop[0], released[2] - wallStop[2]);
assert(releaseDrift < 0.06, `player drifted ${releaseDrift.toFixed(3)}m after key release`);

await page.keyboard.down('a');
await page.waitForTimeout(350);
const beforeBlur = await page.evaluate(() => window.__BYJTT_OBSERVE__().player.position);
await page.evaluate(() => window.dispatchEvent(new Event('blur')));
await page.waitForTimeout(700);
const afterBlur = await page.evaluate(() => window.__BYJTT_OBSERVE__().player.position);
await page.keyboard.up('a');
const blurDrift = Math.hypot(afterBlur[0] - beforeBlur[0], afterBlur[2] - beforeBlur[2]);
assert(blurDrift < 0.8, `blur did not release movement state; drift=${blurDrift.toFixed(3)}m`);

const mutationProbe = await page.evaluate(() => {
  const first = window.__BYJTT_OBSERVE__();
  first.player.health = -999;
  first.player.position[0] = -999;
  const second = window.__BYJTT_OBSERVE__();
  return { health: second.player.health, x: second.player.position[0] };
});
assert.equal(mutationProbe.health, 100, 'observation snapshot mutated engine-owned health');
assert.notEqual(mutationProbe.x, -999, 'observation snapshot mutated engine-owned position');

const forbiddenGlobals = await page.evaluate(() => [
  '__BYJTT_TELEPORT__',
  '__BYJTT_SET_HEALTH__',
  '__BYJTT_GRANT_REWARD__',
  '__BYJTT_WRITE_SAVE__'
].filter((name) => name in window));
assert.deepEqual(forbiddenGlobals, [], `forbidden mutation shortcuts exposed: ${forbiddenGlobals.join(', ')}`);
assert.deepEqual(errors, [], `browser errors: ${errors.join(' | ')}`);

await page.screenshot({ path: `${artifacts}/native-wall.png`, fullPage: true });
const result = {
  passed: true,
  physics_backend: 'ammo',
  normal_input_executed: true,
  arena_width_m: 24,
  arena_depth_m: 32,
  walk_speed_mps: 3.5,
  east_wall_stop_x_m: wallStop[0],
  movement_to_wall_m: Number(movement.toFixed(3)),
  release_drift_m: Number(releaseDrift.toFixed(3)),
  blur_release_drift_m: Number(blurDrift.toFixed(3)),
  post_physics_arena_clamp: false,
  observation_copy_isolated: true,
  browser_error_count: 0,
  viewport: [390, 844]
};
await writeFile(`${artifacts}/result.json`, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(result, null, 2));

await browser.close();
