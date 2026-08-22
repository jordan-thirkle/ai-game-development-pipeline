import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';

const evidenceDir = process.env.EVIDENCE_DIR ?? 'evidence';
await mkdir(evidenceDir, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4173'], { stdio: ['ignore','pipe','pipe'] });
let serverLog=''; server.stdout.on('data',c=>{serverLog+=String(c)}); server.stderr.on('data',c=>{serverLog+=String(c)});
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
async function waitForServer(){for(let i=0;i<100;i+=1){try{const r=await fetch('http://127.0.0.1:4173/');if(r.ok)return;}catch{} await sleep(100);}throw new Error(`Vite server unavailable\n${serverLog}`);}

let browser;
try {
  await waitForServer();
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const errors={pageErrors:[],consoleErrors:[]};
  const attach=(page)=>{page.on('pageerror',e=>errors.pageErrors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.consoleErrors.push(m.text())});};
  let page=await context.newPage(); attach(page);
  await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__BYJTT_OBSERVATION__?.runtime_ready===true,undefined,{timeout:5000});
  const cold=await page.evaluate(()=>window.__BYJTT_OBSERVATION__);
  if(cold?.reward_count!==0 || cold?.selected_upgrades?.length!==0 || cold?.loaded_from_storage!==false) throw new Error(`Cold persistence not clean: ${JSON.stringify(cold)}`);

  await page.keyboard.down('KeyS');
  await page.waitForFunction(()=>window.__BYJTT_OBSERVATION__?.player_z_m<=0.35,undefined,{timeout:6000});
  await page.keyboard.up('KeyS');
  await page.keyboard.down('KeyD');
  await page.waitForFunction(()=>{const o=window.__BYJTT_OBSERVATION__;return !!o&&Math.hypot(5-o.player_x_m,o.player_z_m)<=1.7},undefined,{timeout:4000});
  await page.keyboard.up('KeyD');
  await page.keyboard.press('Space');
  await page.waitForFunction(()=>window.__BYJTT_OBSERVATION__?.salvage_health===0,undefined,{timeout:2000});
  await page.keyboard.down('KeyD');
  await page.waitForFunction(()=>window.__BYJTT_OBSERVATION__?.reward_count===1,undefined,{timeout:3000});
  await page.keyboard.up('KeyD');
  await page.waitForFunction(()=>window.__BYJTT_OBSERVATION__?.upgrade_menu_visible===true,undefined,{timeout:2000});
  await page.keyboard.press('KeyE');
  await page.waitForFunction(()=>window.__BYJTT_OBSERVATION__?.selected_upgrades?.includes('damage-up-1')===true,undefined,{timeout:2000});

  await page.keyboard.press('KeyP');
  await page.waitForFunction(()=>window.__BYJTT_SAVE_RESULT__?.passed===true,undefined,{timeout:3000});
  const saveResult=await page.evaluate(()=>window.__BYJTT_SAVE_RESULT__);
  const saveShape=await page.evaluate(()=>JSON.parse(localStorage.getItem('byjtt-lab-001-phaser-save-v1') ?? 'null'));
  await page.screenshot({path:`${evidenceDir}/before-restart.png`,fullPage:true});
  await writeFile(`${evidenceDir}/save-result.json`,`${JSON.stringify(saveResult,null,2)}\n`);
  await writeFile(`${evidenceDir}/save-shape.json`,`${JSON.stringify(saveShape,null,2)}\n`);
  if(saveShape?.schema_version!==1||saveShape?.reward_count!==1||saveShape?.selected_upgrades?.[0]!=='damage-up-1') throw new Error(`Save shape failed: ${JSON.stringify(saveShape)}`);

  await page.close();
  const restartStarted=Date.now();
  page=await context.newPage(); attach(page);
  await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__BYJTT_RESTORE_RESULT__?.passed===true,undefined,{timeout:15000});
  const restartDurationMs=Date.now()-restartStarted;
  const restoreResult=await page.evaluate(()=>window.__BYJTT_RESTORE_RESULT__);
  await page.screenshot({path:`${evidenceDir}/after-restart.png`,fullPage:true});
  await writeFile(`${evidenceDir}/restore-result.json`,`${JSON.stringify({...restoreResult,restart_duration_ms:restartDurationMs},null,2)}\n`);
  await writeFile(`${evidenceDir}/browser-errors.json`,`${JSON.stringify(errors,null,2)}\n`);

  if(errors.pageErrors.length||errors.consoleErrors.length) throw new Error(`Browser errors: ${JSON.stringify(errors)}`);
  for(const r of [saveResult,restoreResult]){
    if(!r?.passed||r.engine!=='Phaser 4.1.0'||r.schema_version!==1||r.reward_count!==1||r.selected_upgrades?.[0]!=='damage-up-1'||Math.abs(r.effective_attack_damage-40.8)>1e-9) throw new Error(`Persistence result failed: ${JSON.stringify(r)}`);
    if(r.direct_save_write_exposed||r.direct_position_setter_exposed||r.direct_salvage_health_setter_exposed||r.direct_reward_grant_exposed||r.direct_upgrade_grant_exposed||r.test_only_gameplay_mutation_shortcut||r.post_physics_arena_clamp) throw new Error(`Forbidden shortcut exposed: ${JSON.stringify(r)}`);
  }
  if(saveResult.phase!=='save'||saveResult.progression_earned_through_gameplay!==true||saveResult.save_count!==1||saveResult.pause_keydowns!==1) throw new Error('Normal save input path not proven');
  if(restoreResult.phase!=='restore'||restoreResult.loaded_from_storage!==true||restartDurationMs>15000) throw new Error('Restart restore not proven');
  console.log(JSON.stringify({saveResult,restoreResult,restartDurationMs}));
} finally {
  if(browser) await browser.close();
  server.kill('SIGTERM');
  await writeFile(`${evidenceDir}/vite.log`,serverLog);
}
