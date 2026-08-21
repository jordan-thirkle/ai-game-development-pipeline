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
  const response=await page.goto(baseURL,{waitUntil:'domcontentloaded'});
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
  for(const view of ['local-run','workstreams','agents','evidence','decisions','playtest','overview']){
    await page.locator(`[data-view="${view}"]`).click();
    const panel=page.locator(`#${view}`);
    await panel.waitFor({state:'visible'});
    assert.equal(await panel.evaluate(el=>el.classList.contains('hidden')),false,`${view} stayed hidden`);
  }
  await page.close();
});

await record('Creator Mode is idea-first with optional progressive disclosure',async()=>{
  const {page,consoleErrors}=await open({width:1280,height:800});
  await page.locator('[data-view="local-run"]').click();
  assert.match(await page.locator('#local-run').textContent(),/Creator Mode/i);
  assert.equal(await page.locator('#brief-name').isVisible(),true,'game-name input is not immediately visible');
  assert.equal(await page.locator('#brief-objective').isVisible(),true,'idea input is not immediately visible');
  assert.equal(await page.locator('#creator-advanced').getAttribute('open'),null,'advanced controls opened by default');
  assert.equal(await page.locator('#brief-target').isVisible(),false,'target leaked into the default beginner surface');
  assert.equal(await page.locator('#brief-mechanic').isVisible(),false,'mechanic leaked into the default beginner surface');
  assert.equal(await page.locator('#brief-target').inputValue(),'web','Creator Mode default target changed');
  assert.equal(await page.locator('#brief-mechanic').inputValue(),'collect','Creator Mode default mechanic changed');
  assert.match(await page.locator('#creator-suggestion').textContent(),/Collect a beacon.*No AI model is used/i);
  const summary=page.locator('#creator-advanced summary');
  await summary.focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('#brief-target').isVisible(),true,'advanced target was not keyboard-revealed');
  assert.equal(await page.locator('#brief-mechanic').isVisible(),true,'advanced mechanic was not keyboard-revealed');
  assert.deepEqual(consoleErrors,[]);
  await page.close();
});

await record('Creator Mode maps obvious idea language locally and preserves manual override',async()=>{
  const {page,consoleErrors}=await open({width:1280,height:800});
  await page.locator('[data-view="local-run"]').click();
  const idea=page.locator('#brief-objective');
  const mechanic=page.locator('#brief-mechanic');
  const suggestion=page.locator('#creator-suggestion');

  await idea.fill('Survive waves of enemies and stay alive for as long as possible.');
  assert.equal(await mechanic.inputValue(),'survive','survival language did not select the reviewed survive starter');
  assert.match(await suggestion.textContent(),/Survive 10 seconds.*suggested locally.*No AI model is used/i);

  await idea.fill('Dodge hazards and escape through the exit without touching obstacles.');
  assert.equal(await mechanic.inputValue(),'dodge','dodge/escape language did not select the reviewed dodge starter');
  assert.match(await suggestion.textContent(),/Dodge to an exit.*suggested locally/i);

  await idea.fill('Make a small arcade game with a simple clear goal.');
  assert.equal(await mechanic.inputValue(),'collect','neutral wording did not fall back to the reviewed collect starter');

  await page.locator('#creator-advanced summary').click();
  await mechanic.selectOption('survive');
  assert.match(await suggestion.textContent(),/Survive 10 seconds.*chosen in Fine-tune/i);
  await idea.fill('Dodge every obstacle and escape quickly.');
  assert.equal(await mechanic.inputValue(),'survive','idea remapping overrode an explicit Fine-tune choice');
  assert.match(await suggestion.textContent(),/chosen in Fine-tune/i);
  assert.deepEqual(consoleErrors,[]);
  await page.close();
});

await record('visual sample pipeline completes with safe publishing evidence',async()=>{
  const {page,consoleErrors}=await open({width:1440,height:900});
  await page.locator('[data-view="local-run"]').click();
  await page.locator('#run-sample').click();
  await page.waitForFunction(()=>document.querySelector('#run-message')?.textContent.includes('Release candidate ready'),null,{timeout:30000});
  assert.equal(await page.locator('[data-run-step].pass').count(),6,'not every visual stage passed');
  assert.equal(await page.locator('#run-evidence-panel').isVisible(),true,'run evidence stayed hidden');
  const evidence=await page.locator('#run-evidence').textContent();
  assert.match(evidence,/Publication executed: false/);
  assert.match(evidence,/Secrets used: false/);
  assert.match(evidence,/Dry-run only: true/);
  assert.deepEqual(consoleErrors,[]);
  await page.screenshot({path:`${artifacts}/desktop-local-run.png`,fullPage:true});
  await page.close();
});

await record('visual sample failure stays explicit and retryable without inventing stage failures',async()=>{
  const {page,consoleErrors}=await open({width:1280,height:800});
  await page.route('**/api/pipeline/runs',route=>route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:'Deliberate test failure'})}));
  await page.locator('[data-view="local-run"]').click();
  await page.locator('#run-sample').click();
  await page.waitForFunction(()=>document.querySelector('#run-message')?.textContent.includes('Deliberate test failure'));
  assert.equal(await page.locator('[data-run-step].fail').count(),0,'generic service failure was misattributed to pipeline stages');
  assert.equal(await page.locator('[data-run-step].blocked').count(),6,'unverified stages reverted to an idle-looking state');
  assert.equal(await page.locator('#run-sample').isEnabled(),true,'retry stayed disabled');
  assert.equal(await page.locator('#run-evidence-panel').isVisible(),false,'stale success evidence became visible');
  assert(consoleErrors.every(message=>/Failed to load resource.*500/.test(message)),`unexpected console errors: ${consoleErrors.join('; ')}`);
  await page.close();
});

await record('visual partial evidence identifies a QA stop without failing later unexecuted stages',async()=>{
  const {page}=await open({width:1280,height:800});
  const partial={status:'fail',error:'QA failed',evidence:{intake:{validation:{status:'pass'}},registry:{entries:[{}]},build:{executed:true,status:'pass'},qa:{executed:true,status:'fail'}}};
  await page.route('**/api/pipeline/runs',route=>route.fulfill({status:422,contentType:'application/json',body:JSON.stringify(partial)}));
  await page.locator('[data-view="local-run"]').click();
  await page.locator('#run-sample').click();
  await page.waitForFunction(()=>document.querySelector('#run-message')?.textContent.includes('QA failed'));
  assert.equal(await page.locator('[data-run-step="intake"].pass').count(),1);
  assert.equal(await page.locator('[data-run-step="registry"].pass').count(),1);
  assert.equal(await page.locator('[data-run-step="build"].pass').count(),1);
  assert.equal(await page.locator('[data-run-step="qa"].fail').count(),1);
  assert.equal(await page.locator('[data-run-step="releaseCandidate"].blocked').count(),1);
  assert.equal(await page.locator('[data-run-step="publishing"].blocked').count(),1);
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
  assert.equal(await page.locator('#playtest-copy a').count(),0);
  await page.close();
});

await record('stale state stays readable but action surfaces fail closed',async()=>{
  const stale=structuredClone(fixtureData);
  stale.generatedAt=new Date(Date.now()-7*60*60*1000).toISOString();
  const gate=stale.gates.find(x=>x.kind==='human');
  gate.status='pending';
  stale.project.latestBuildId='stale-ready';
  stale.builds=[{id:'stale-ready',label:'Stale ready build',status:'ready',target:'web',revision:'stale-r1',launchUri:'https://example.com/play',evidenceIds:[]}];
  const {page,consoleErrors}=await open({width:1280,height:800},stale);
  assert.equal(await page.locator('#freshness').isVisible(),true,'stale warning is not visible');
  assert.match(await page.locator('#freshness').textContent(),/cannot be trusted.*stale/i);
  assert((await page.locator('#workstream-list .item').count())>0,'stale coordination state became unreadable');
  const actions=page.locator('#gate [data-verdict]');
  for(let i=0;i<3;i++) assert.equal(await actions.nth(i).isDisabled(),true,`stale gate button ${i} remained actionable`);
  await page.locator('[data-view="playtest"]').click();
  assert.equal(await page.locator('#playtest-copy a').count(),0,'stale playable build remained launchable');
  assert.match(await page.locator('#playtest-copy').textContent(),/launch is disabled until projection refresh/i);
  assert.deepEqual(consoleErrors,[]);
  await page.close();
});

await record('fresh state preserves eligible gate and safe playable build',async()=>{
  const fresh=structuredClone(fixtureData);
  fresh.generatedAt=new Date().toISOString();
  const gate=fresh.gates.find(x=>x.kind==='human');
  gate.status='pending';
  fresh.project.latestBuildId='fresh-ready';
  fresh.builds=[{id:'fresh-ready',label:'Fresh ready build',status:'ready',target:'web',revision:'fresh-r1',launchUri:'https://example.com/play',evidenceIds:[]}];
  const {page,consoleErrors}=await open({width:1280,height:800},fresh);
  assert.equal(await page.locator('#freshness').isVisible(),false,'fresh warning remained visible');
  const actions=page.locator('#gate [data-verdict]');
  for(let i=0;i<3;i++) assert.equal(await actions.nth(i).isDisabled(),false,`fresh eligible gate button ${i} stayed disabled`);
  await page.locator('[data-view="playtest"]').click();
  assert.equal(await page.locator('#playtest-copy a').count(),1,'fresh safe playable build is not launchable');
  assert.equal(await page.locator('#playtest-copy a').getAttribute('href'),'https://example.com/play');
  assert.deepEqual(consoleErrors,[]);
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
  hostile.generatedAt=new Date().toISOString();
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
  await page.locator('[data-view="local-run"]').click();
  assert.equal(await page.locator('#run-sample').isVisible(),true,'mobile sample runner is unreachable');
  assert.equal(await page.locator('#brief-name').isVisible(),true,'mobile Creator Mode name input is unreachable');
  assert.equal(await page.locator('#brief-objective').isVisible(),true,'mobile Creator Mode idea input is unreachable');
  assert.equal(await page.locator('#creator-suggestion').isVisible(),true,'mobile Creator Mode suggestion is unreachable');
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
  await page.locator('[data-view="local-run"]').focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('[data-view="local-run"]').getAttribute('aria-current'),'page');
  await page.locator('#run-sample').focus();
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'run-sample','sample run button is not keyboard focusable');
  await page.close();
});

await browser.close();
if(failures.length){console.error('\nControl-plane browser QA failed:');for(const failure of failures)console.error(`- ${failure}`);process.exit(1)}
console.log('\nControl-plane direct browser QA passed.');
