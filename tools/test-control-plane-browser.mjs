import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const baseURL=process.env.CONTROL_PLANE_URL||'http://127.0.0.1:4173/apps/studio/';
const artifacts=process.env.BROWSER_ARTIFACTS||'artifacts/control-plane-browser';
await mkdir(artifacts,{recursive:true});

const browser=await chromium.launch({headless:true});
const failures=[];
const record=(name,fn)=>fn().then(()=>console.log(`PASS ${name}`)).catch(error=>{failures.push(`${name}: ${error.message}`);console.error(`FAIL ${name}: ${error.message}`)});

async function open(viewport){
  const page=await browser.newPage({viewport});
  const consoleErrors=[];
  page.on('console',msg=>{if(msg.type()==='error')consoleErrors.push(msg.text())});
  page.on('pageerror',error=>consoleErrors.push(error.message));
  const response=await page.goto(baseURL,{waitUntil:'networkidle'});
  assert(response?.ok(),`HTTP ${response?.status()}`);
  await page.waitForSelector('#name');
  await page.waitForFunction(()=>document.querySelector('#name')?.textContent!=='Loading…');
  return {page,consoleErrors};
}

await record('desktop page load and console',async()=>{
  const {page,consoleErrors}=await open({width:1440,height:900});
  assert.equal(await page.locator('#name').textContent(),'Mobile 3D Action Slice');
  assert.deepEqual(consoleErrors,[]);
  await page.screenshot({path:`${artifacts}/desktop-overview.png`,fullPage:true});
  await page.close();
});

await record('all navigation surfaces',async()=>{
  const {page}=await open({width:1280,height:800});
  for(const view of ['workstreams','agents','evidence','decisions','playtest','overview']){
    await page.locator(`[data-view="${view}"]`).click();
    const panel=page.locator(`#${view}`);
    await panel.waitFor({state:'visible'});
    assert.equal(await panel.evaluate(el=>el.classList.contains('hidden')),false,`${view} stayed hidden`);
  }
  await page.close();
});

await record('blocked human gate cannot be actioned',async()=>{
  const {page}=await open({width:1280,height:800});
  const actions=page.locator('#gate [data-verdict]');
  assert.equal(await actions.count(),3);
  for(let i=0;i<3;i++) assert.equal(await actions.nth(i).isDisabled(),true,`gate button ${i} enabled while blocked`);
  await page.close();
});

await record('no false playable build affordance',async()=>{
  const {page}=await open({width:1280,height:800});
  await page.locator('[data-view="playtest"]').click();
  assert.match(await page.locator('#playtest-copy').textContent(),/No verified playable build/i);
  assert.equal(await page.locator('#playtest-copy a').count(),0);
  await page.close();
});

await record('workstream coordination is legible',async()=>{
  const {page}=await open({width:1280,height:800});
  await page.locator('[data-view="workstreams"]').click();
  const cards=page.locator('#workstream-list .item');
  assert((await cards.count())>0,'no projected workstreams rendered');
  const fixture=await page.evaluate(async()=>fetch('../../fixtures/control-plane/BYJTT-LAB-001.json',{cache:'no-store'}).then(r=>r.json()));
  const expected=fixture.workstreams[0];
  const text=await cards.first().textContent();
  assert(text.includes(expected.branch),`missing current branch ${expected.branch}`);
  assert(text.includes(expected.environment),`missing current environment ${expected.environment}`);
  assert(text.includes('next:'),'missing next-safe-action label');
  assert(text.includes(expected.nextSafeAction),`missing current next safe action`);
  await page.close();
});

await record('mobile layout stays usable',async()=>{
  const {page}=await open({width:390,height:844});
  assert.equal(await page.locator('.sidebar').isVisible(),false,'desktop sidebar visible on mobile');
  const bodyWidth=await page.evaluate(()=>document.documentElement.scrollWidth);
  assert(bodyWidth<=390,`horizontal overflow ${bodyWidth}px`);
  await page.screenshot({path:`${artifacts}/mobile-overview.png`,fullPage:true});
  await page.close();
});

await record('keyboard basics',async()=>{
  const {page}=await open({width:1280,height:800});
  await page.keyboard.press('Tab');
  const tag=await page.evaluate(()=>document.activeElement?.tagName);
  assert.equal(tag,'BUTTON','first keyboard focus is not actionable');
  await page.keyboard.press('Enter');
  await page.close();
});

await browser.close();
if(failures.length){console.error('\nControl-plane browser QA failed:');for(const failure of failures)console.error(`- ${failure}`);process.exit(1)}
console.log('\nControl-plane direct browser QA passed.');
