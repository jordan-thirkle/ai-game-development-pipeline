import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const dir=await mkdtemp(join(tmpdir(),'byjtt-freshness-'));
const fixture=join(dir,'state.json');

async function check(generatedAt,now='2026-08-19T22:30:00+01:00',limit='6'){
  await writeFile(fixture,JSON.stringify({generatedAt}));
  return spawnSync(process.execPath,['tools/check-control-plane-freshness.mjs',fixture],{encoding:'utf8',env:{...process.env,CONTROL_PLANE_NOW:now,CONTROL_PLANE_MAX_AGE_HOURS:limit}});
}
let result=await check('2026-08-19T20:00:00+01:00');
assert.equal(result.status,0,result.stderr);
assert.match(result.stdout,/snapshot fresh/i);

result=await check('2026-08-19T12:00:00+01:00');
assert.equal(result.status,1);
assert.match(result.stderr,/stale/i);

result=await check('not-a-date');
assert.equal(result.status,1);
assert.match(result.stderr,/invalid generatedAt/i);

result=await check('2026-08-20T00:00:00+01:00');
assert.equal(result.status,1);
assert.match(result.stderr,/future/i);

result=await check('2026-08-19T20:00:00+01:00','not-a-date');
assert.equal(result.status,2);
assert.match(result.stderr,/CONTROL_PLANE_NOW is invalid/i);

console.log('Control-plane freshness adversarial tests passed.');
