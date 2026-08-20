import { readFile } from 'node:fs/promises';
import { evaluateControlPlaneFreshness } from './control-plane-freshness.mjs';

const fixturePath=process.argv[2]||'fixtures/control-plane/BYJTT-LAB-001.json';
const maxAgeHours=process.env.CONTROL_PLANE_MAX_AGE_HOURS||6;
const nowInput=process.env.CONTROL_PLANE_NOW;
const state=JSON.parse(await readFile(fixturePath,'utf8'));
const result=evaluateControlPlaneFreshness(state,{now:nowInput||Date.now(),maxAgeHours});

if(result.ok){
  console.log(`Control-plane snapshot ${fixturePath} ${result.message}.`);
  process.exit(0);
}
console.error(`Control-plane snapshot ${fixturePath} ${result.message}; refusing misleading state.`);
process.exit(result.classification==='configuration'?2:1);
