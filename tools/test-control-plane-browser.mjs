import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const baseURL=process.env.CONTROL_PLANE_URL||'http://127.0.0.1:4173/apps/studio/';
const artifacts=process.env.BROWSER_ARTIFACTS||'artifacts/control-plane-browser';
const fixturePath='fixtures/control-plane/BYJTT-LAB-001.json';
const fixtureData=JSON.parse(await readFile(fixturePath,'utf8'));
await mkdir(artifacts,{recursive:true});

const browser=await chromium.launch({headless:true,channel:'chrome'});
const failures=[];
const record=(name,fn)=>fn().then(()=>console.log(`PASS ${name}`)).catch(error=>{failures.push(`${name}: ${error.message}`);console.error(`FAIL ${name}: ${error.message}`)});

async function open(viewport,overrideFixture=null){
  const page=await browser.newPage({viewport});
  const consoleErrors=[];
  page.on('console',msg=>{if(msg.type()==='error')consoleErrors.push(msg.text())});
  page.on('pageerror',error=>consoleErrors.push(error.message));
  await page.route('**/favicon.ico',route=>route.fulfill({status:204,body:''}));
  if(overrideFixture){
    await page.route('**/fixtures/control-plane/BYJTT-LAB-001.json',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(overrideFixture)}));
  }
  const response=await page.goto(baseURL,{waitUntil:'networkidle'});
  assert(response?.ok(),`HTTP ${response?.status()}`);
  await page.waitForSelector('#name');
  await page.waitForFunction(()=>document.querySelector('#name')?.textContent!=='Loading…');
  return {page,consoleErrors};
}

await record('desktop page load and console',async()=>{
  const {page,consoleErrors}=await open({width:1440,height:900});
  assert.equal(await page.locator('#name').textContent(),fixtureData.project.name);
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
  const expected=fixtureData.workstreams[0];
  const text=await cards.first().textContent();
  assert(text.includes(expected.branch),`missing current branch ${expected.branch}`);
  assert(text.includes(expected.environment),`missing current environment ${expected.environment}`);
  assert(text.includes('next:'),'missing next-safe-action label');
  assert(text.includes(expected.nextSafeAction),`missing current next safe action`);
  await page.close();
});

await record('hostile fixture content is inert and unsafe launch URLs are rejected',async()=>{
  const hostile=structuredClone(fixtureData);
  hostile.project.name='<img id="fixture-xss" src=x onerror="window.__fixtureXss=1">';
  hostile.project.latestBuildId='hostile-build';
  hostile.builds=[{id:'hostile-build',label:'Unsafe <b>build</b>',status:'ready',target:'web',revision:'hostile-r1',launchUri:'javascript:window.__fixtureXss=2',evidenceIds:[]}];
  const {page,consoleErrors}=await open({width:1280,height:800},hostile);
  assert.equal(await page.locator('#name').textContent(),hostile.project.name,'hostile project name was not rendered literally');
  assert.equal(await page.locator('#fixture-xss').count(),0,'fixture markup became executable DOM');
  await page.locator('[data-view="playtest"]').click();
  assert.equal(await page.locator('#playtest-copy a').count(),0,'unsafe launch URL became a clickable link');
  assert.match(await page.locator('#playtest-copy').textContent(),/launch URL is not permitted/i);
  assert.equal(await page.evaluate(()=>window.__fixtureXss),undefined,'hostile fixture code executed');
  assert.deepEqual(consoleErrors,[]);
  await page.close();
});

await record('reload re-fetches canonical state predictably',async()=>{
  const {page,consoleErrors}=await open({width:1280,height:800});
  const nextResponse=page.waitForResponse(response=>response.url().includes('/fixtures/control-plane/BYJTT-LAB-001.json')&&response.request().resourceType()==='fetch');
  await page.locator('#reload').click();
  const response=await nextResponse;
  assert.equal(response.ok(),true,'reload fixture request failed');
  await page.waitForFunction(expected=>document.querySelector('#name')?.textContent===expected,fixtureData.project.name);
  assert.equal(await page.locator('#name').textContent(),fixtureData.project.name);
  assert.deepEqual(consoleErrors,[]);
  await page.close();
});

await record('mobile layout and navigation stay usable',async()=>{
  const {page}=await open({width:390,height:844});
  const nav=page.locator('.nav');
  assert.equal(await nav.isVisible(),true,'mobile navigation is not visible');
  assert.equal(await page.locator('[data-view="workstreams"]').isVisible(),true,'Workstreams is unreachable on mobile');
  await page.locator('[data-view="workstreams"]').click();
  await page.locator('#workstreams').waitFor({state:'visible'});
  assert((await page.locator('#workstream-list .item').count())>0,'mobile Workstreams view did not render');
  await page.locator('[data-view="overview"]').click();
  await page.screenshot({path:`${artifacts}/mobile-overview.png`,fullPage:true});
  const bodyWidth=await page.evaluate(()=>document.documentElement.scrollWidth);
  assert(bodyWidth<=390,`horizontal page overflow ${bodyWidth}px`);
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
