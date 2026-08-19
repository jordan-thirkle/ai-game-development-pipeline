import { readFile } from 'node:fs/promises';

const fixturePath=process.argv[2]||'fixtures/control-plane/BYJTT-LAB-001.json';
const maxAgeHours=Number(process.env.CONTROL_PLANE_MAX_AGE_HOURS||6);
const nowInput=process.env.CONTROL_PLANE_NOW;

if(!Number.isFinite(maxAgeHours)||maxAgeHours<=0){
  console.error('CONTROL_PLANE_MAX_AGE_HOURS must be a positive number');
  process.exit(2);
}

const state=JSON.parse(await readFile(fixturePath,'utf8'));
const generatedAt=Date.parse(state.generatedAt);
if(!Number.isFinite(generatedAt)){
  console.error(`Control-plane snapshot ${fixturePath} has invalid generatedAt: ${state.generatedAt}`);
  process.exit(1);
}
const now=nowInput?Date.parse(nowInput):Date.now();
if(!Number.isFinite(now)){
  console.error(`CONTROL_PLANE_NOW is invalid: ${nowInput}`);
  process.exit(2);
}
const ageMs=now-generatedAt;
const ageHours=ageMs/3_600_000;
if(ageMs<0){
  console.error(`Control-plane snapshot ${fixturePath} is from the future by ${Math.abs(ageHours).toFixed(2)}h; refusing misleading state.`);
  process.exit(1);
}
if(ageHours>maxAgeHours){
  console.error(`Control-plane snapshot ${fixturePath} is stale: ${ageHours.toFixed(2)}h old (limit ${maxAgeHours}h). Refresh canonical projection before trusting Studio state.`);
  process.exit(1);
}
console.log(`Control-plane snapshot fresh: ${ageHours.toFixed(2)}h old (limit ${maxAgeHours}h).`);
