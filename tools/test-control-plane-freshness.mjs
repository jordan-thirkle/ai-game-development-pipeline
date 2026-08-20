import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { evaluateControlPlaneFreshness } from './control-plane-freshness.mjs';

const fixedNow='2026-08-19T22:30:00+01:00';
const cases=[
  ['fresh','2026-08-19T20:00:00+01:00',true,'fresh'],
  ['boundary','2026-08-19T16:30:00+01:00',true,'fresh'],
  ['stale','2026-08-19T12:00:00+01:00',false,'stale'],
  ['invalid generatedAt','not-a-date',false,'invalid-generated-at'],
  ['impossible calendar date','2026-02-30T20:00:00Z',false,'invalid-generated-at'],
  ['invalid non-leap February date','0099-02-29T20:00:00Z',false,'invalid-generated-at'],
  ['invalid offset','2026-08-19T20:00:00+24:00',false,'invalid-generated-at'],
  ['future','2026-08-20T00:00:00+01:00',false,'future']
];
for(const [name,generatedAt,ok,status] of cases){
  const result=evaluateControlPlaneFreshness({generatedAt},{now:fixedNow,maxAgeHours:6});
  assert.equal(result.ok,ok,`${name} ok`);
  assert.equal(result.status,status,`${name} status`);
}
assert.equal(evaluateControlPlaneFreshness({generatedAt:'0099-01-01T00:00:00Z'},{now:'0099-01-01T01:00:00Z'}).status,'fresh');
assert.equal(evaluateControlPlaneFreshness({generatedAt:'2026-08-19T20:00:00+01:00'},{now:'not-a-date'}).status,'invalid-now');
assert.equal(evaluateControlPlaneFreshness({generatedAt:'2026-08-19T20:00:00+01:00'},{now:'2026-02-30T20:00:00Z'}).status,'invalid-now');
assert.equal(evaluateControlPlaneFreshness({generatedAt:'2026-08-19T20:00:00+01:00'},{now:fixedNow,maxAgeHours:0}).status,'invalid-config');

const dir=await mkdtemp(join(tmpdir(),'byjtt-freshness-'));
const fixture=join(dir,'state.json');
async function cli(generatedAt,now=fixedNow,limit='6'){
  await writeFile(fixture,JSON.stringify({generatedAt}));
  return spawnSync(process.execPath,['tools/check-control-plane-freshness.mjs',fixture],{cwd:new URL('..',import.meta.url),encoding:'utf8',env:{...process.env,CONTROL_PLANE_NOW:now,CONTROL_PLANE_MAX_AGE_HOURS:limit}});
}
let result=await cli('2026-08-19T20:00:00+01:00');
assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/snapshot .* is fresh/i);
result=await cli('2026-08-19T12:00:00+01:00');
assert.equal(result.status,1);assert.match(result.stderr,/stale/i);
result=await cli('not-a-date');
assert.equal(result.status,1);assert.match(result.stderr,/invalid generatedAt/i);
result=await cli('2026-02-30T20:00:00Z');
assert.equal(result.status,1);assert.match(result.stderr,/invalid generatedAt/i);
result=await cli('0099-02-29T20:00:00Z','0099-03-01T00:00:00Z');
assert.equal(result.status,1);assert.match(result.stderr,/invalid generatedAt/i);
result=await cli('0099-01-01T00:00:00Z','0099-01-01T01:00:00Z');
assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/snapshot .* is fresh/i);
result=await cli('2026-08-20T00:00:00+01:00');
assert.equal(result.status,1);assert.match(result.stderr,/future/i);
result=await cli('2026-08-19T20:00:00+01:00','not-a-date');
assert.equal(result.status,2);assert.match(result.stderr,/invalid comparison clock/i);
result=await cli('2026-08-19T20:00:00+01:00','2026-02-30T20:00:00Z');
assert.equal(result.status,2);assert.match(result.stderr,/invalid comparison clock/i);
result=await cli('2026-08-19T20:00:00+01:00',fixedNow,'0');
assert.equal(result.status,2);assert.match(result.stderr,/max age must be a positive number/i);
console.log('Control-plane freshness adversarial tests passed.');
