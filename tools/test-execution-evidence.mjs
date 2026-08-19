import assert from 'node:assert/strict';
import { evaluateGate } from './check-execution-evidence.mjs';

const gate={id:'control-plane-browser',paths:['apps/studio/'],evidencePath:'evidence/execution/control-plane-browser.json',environment:'browser-automation',requiredChecks:['page-load','console-clean','navigation']};
const pass={gateId:gate.id,status:'pass',environment:'browser-automation',checks:[{name:'page-load',status:'pass'},{name:'console-clean',status:'pass'},{name:'navigation',status:'pass'}]};
const sensitive=['apps/studio/index.html'];

assert.deepEqual(evaluateGate({gate,evidence:null,changedPaths:['docs/README.md']}),[]);
assert.match(evaluateGate({gate,evidence:null,changedPaths:sensitive})[0],/missing execution evidence/);
assert.match(evaluateGate({gate,evidence:{...pass,environment:'source-review'},changedPaths:sensitive})[0],/wrong execution environment/);
assert.match(evaluateGate({gate,evidence:{...pass,checks:[{name:'page-load',status:'pass'}]},changedPaths:sensitive}).join('\n'),/required check console-clean did not pass/);
assert.match(evaluateGate({gate,evidence:pass,changedPaths:sensitive,postEvidenceSensitivePaths:['apps/studio/index.html']})[0],/evidence is stale/);
assert.deepEqual(evaluateGate({gate,evidence:pass,changedPaths:sensitive}),[]);
console.log('Execution evidence gate semantic tests passed.');
