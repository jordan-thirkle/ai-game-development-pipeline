import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const readJson=async p=>JSON.parse(await readFile(p,'utf8'));
const git=(...args)=>{const r=spawnSync('git',args,{encoding:'utf8'});if(r.status!==0)throw new Error(r.stderr.trim()||`git ${args.join(' ')} failed`);return r.stdout.trim()};
export function evaluateGate({gate,evidence,changedPaths,postEvidenceSensitivePaths=[]}){
  const problems=[];
  if(!changedPaths.some(p=>gate.paths.some(prefix=>p.startsWith(prefix)))) return problems;
  if(!evidence) return [`${gate.id}: missing execution evidence at ${gate.evidencePath}`];
  if(evidence.gateId!==gate.id) problems.push(`${gate.id}: evidence gateId mismatch`);
  if(evidence.status!=='pass') problems.push(`${gate.id}: evidence status is not pass`);
  if(evidence.environment!==gate.environment) problems.push(`${gate.id}: wrong execution environment`);
  const checks=new Map((evidence.checks||[]).map(c=>[c.name,c.status]));
  for(const required of gate.requiredChecks||[]) if(checks.get(required)!=='pass') problems.push(`${gate.id}: required check ${required} did not pass`);
  if(postEvidenceSensitivePaths.length) problems.push(`${gate.id}: evidence is stale; sensitive paths changed after tested revision: ${postEvidenceSensitivePaths.join(', ')}`);
  return problems;
}

async function main(){
  const base=process.env.BASE_SHA, head=process.env.HEAD_SHA;
  if(!base||!head) throw new Error('BASE_SHA and HEAD_SHA are required');
  const [config,schema]=await Promise.all([readJson('config/execution-gates.json'),readJson('schemas/execution-evidence.schema.json')]);
  const ajv=new Ajv2020({allErrors:true,strict:false});addFormats(ajv);const validate=ajv.compile(schema);
  const changed=git('diff','--name-only',`${base}...${head}`).split('\n').filter(Boolean);const failures=[];
  for(const gate of config.gates){
    if(!changed.some(p=>gate.paths.some(prefix=>p.startsWith(prefix)))) continue;
    if(!existsSync(gate.evidencePath)){failures.push(`${gate.id}: missing execution evidence at ${gate.evidencePath}`);continue;}
    const evidence=await readJson(gate.evidencePath);
    if(!validate(evidence)){failures.push(`${gate.id}: invalid evidence schema: ${ajv.errorsText(validate.errors)}`);continue;}
    const anc=spawnSync('git',['merge-base','--is-ancestor',evidence.testedRevision,head]);
    if(anc.status!==0){failures.push(`${gate.id}: tested revision is not an ancestor of PR head`);continue;}
    const since=git('diff','--name-only',`${evidence.testedRevision}..${head}`).split('\n').filter(Boolean);
    const stale=since.filter(p=>gate.paths.some(prefix=>p.startsWith(prefix)));
    failures.push(...evaluateGate({gate,evidence,changedPaths:changed,postEvidenceSensitivePaths:stale}));
  }
  if(failures.length){console.error('Execution evidence gate failed:');for(const f of failures)console.error(`- ${f}`);process.exit(1)}
  console.log('Execution evidence gates satisfied for all runtime-sensitive changes.');
}
if(import.meta.url===`file://${process.argv[1]}`) main().catch(e=>{console.error(e);process.exit(1)});
