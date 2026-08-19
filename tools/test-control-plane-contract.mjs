import { readFile } from 'node:fs/promises';
import process from 'node:process';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const readJson=async p=>JSON.parse(await readFile(p,'utf8'));
const [schema,state]=await Promise.all([readJson('schemas/control-plane-state.schema.json'),readJson('fixtures/control-plane/BYJTT-LAB-001.json')]);
const ajv=new Ajv2020({allErrors:true,strict:false});addFormats(ajv);const validate=ajv.compile(schema);const failures=[];
if(!validate(state)) failures.push(ajv.errorsText(validate.errors,{separator:'\n'}));
const evidenceIds=new Set(state.evidence.map(x=>x.id));const stageIds=new Set(state.stages.map(x=>x.id));
for(const stage of state.stages){for(const dep of stage.dependsOn||[])if(!stageIds.has(dep))failures.push(`stage ${stage.id} depends on missing stage ${dep}`);for(const id of stage.evidenceIds||[])if(!evidenceIds.has(id))failures.push(`stage ${stage.id} references missing evidence ${id}`)}
for(const gate of state.gates){if(!stageIds.has(gate.stageId))failures.push(`gate ${gate.id} references missing stage ${gate.stageId}`);for(const id of gate.evidenceIds||[])if(!evidenceIds.has(id))failures.push(`gate ${gate.id} references missing evidence ${id}`)}
for(const decision of state.decisions)for(const id of decision.evidenceIds||[])if(!evidenceIds.has(id))failures.push(`decision ${decision.id} references missing evidence ${id}`);
for(const workstream of state.workstreams){if(!workstream.branch||!workstream.base)failures.push(`workstream ${workstream.id} lacks branch/base`);if(!Array.isArray(workstream.ownedPaths)||workstream.ownedPaths.length===0)failures.push(`workstream ${workstream.id} lacks owned paths`)}
const humanGate=state.gates.find(x=>x.kind==='human');if(humanGate?.status==='blocked'&&humanGate.verdict)failures.push('blocked human gate must not already contain a verdict');
if(state.project.latestBuildId!==null&&!state.builds.some(x=>x.id===state.project.latestBuildId))failures.push('latestBuildId does not identify a build');
if(failures.length){console.error('Control-plane contract failed:');for(const f of failures)console.error(`- ${f}`);process.exit(1)}
console.log('Control-plane schema and semantic fixture invariants passed.');
