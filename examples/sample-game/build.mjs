import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = dirname(fileURLToPath(import.meta.url));
const output = resolve(project, 'dist');
const manifest = JSON.parse(await readFile(resolve(project, 'project.manifest.json'), 'utf8'));
const target = manifest.targetPlatforms?.[0] || 'web';
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const gameConfig = JSON.stringify({ name: manifest.name, objective: manifest.objective, target }).replaceAll('<', '\\u003c');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await writeFile(resolve(output, 'game.txt'), 'sample-game build artifact\n', 'utf8');
await writeFile(resolve(output, 'build.json'), JSON.stringify({ name: manifest.name, objective: manifest.objective, target, format: 'local-demo', version: 2 }, null, 2) + '\n', 'utf8');
await writeFile(resolve(output, 'index.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(manifest.name)}</title><style>
html,body{margin:0;height:100%;overflow:hidden;background:#0d1016;color:#fff;font-family:system-ui,sans-serif}canvas{display:block;width:100%;height:100%}.hud{position:fixed;inset:16px auto auto 16px;max-width:min(560px,calc(100vw - 32px));padding:10px 12px;border:1px solid #ffffff30;border-radius:10px;background:#0b0d11dd}.hud b{color:#d7ff64;font-size:17px}.objective{margin:5px 0;color:#cbd2da}.target{color:#86b7ff}.win{color:#79d99b}.touch{display:${target === 'mobile' ? 'grid' : 'none'};position:fixed;right:22px;bottom:22px;grid-template:". up ." 58px "left down right" 58px/58px 58px 58px;gap:6px}.touch button{border:1px solid #ffffff40;border-radius:14px;background:#151a24dd;color:#fff;font-size:24px;touch-action:none}.touch [data-key="w"]{grid-area:up}.touch [data-key="a"]{grid-area:left}.touch [data-key="s"]{grid-area:down}.touch [data-key="d"]{grid-area:right}
</style></head><body><canvas id="game"></canvas><div class="hud"><b>${escapeHtml(manifest.name)}</b><div class="objective">${escapeHtml(manifest.objective)}</div><span class="target">Target: ${escapeHtml(target)}</span><br>${target === 'mobile' ? 'Use the touch controls' : 'Move with WASD or arrow keys'} · collect the green beacon<br><span id="status">Ready to play</span></div><div class="touch" aria-label="Touch movement controls"><button data-key="w" aria-label="Move up">▲</button><button data-key="a" aria-label="Move left">◀</button><button data-key="s" aria-label="Move down">▼</button><button data-key="d" aria-label="Move right">▶</button></div><script>
const config=${gameConfig};
const canvas=document.querySelector('#game'),ctx=canvas.getContext('2d'),keys=new Set(),player={x:80,y:120,r:16},goal={x:520,y:300,r:22};let won=false,last=performance.now();
function size(){canvas.width=innerWidth*devicePixelRatio;canvas.height=innerHeight*devicePixelRatio;ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0)}addEventListener('resize',size);size();
addEventListener('keydown',e=>{keys.add(e.key.toLowerCase());if(['arrowup','arrowdown','arrowleft','arrowright'].includes(e.key.toLowerCase()))e.preventDefault()});addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
document.querySelectorAll('[data-key]').forEach(button=>{const key=button.dataset.key;button.addEventListener('pointerdown',event=>{event.preventDefault();button.setPointerCapture(event.pointerId);keys.add(key)});for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,()=>keys.delete(key))});
function frame(now){const dt=Math.min((now-last)/1000,.05);last=now;if(!won){let x=(keys.has('d')||keys.has('arrowright'))-(keys.has('a')||keys.has('arrowleft')),y=(keys.has('s')||keys.has('arrowdown'))-(keys.has('w')||keys.has('arrowup'));const n=Math.hypot(x,y)||1;player.x=Math.max(player.r,Math.min(innerWidth-player.r,player.x+x/n*220*dt));player.y=Math.max(player.r,Math.min(innerHeight-player.r,player.y+y/n*220*dt));if(Math.hypot(player.x-goal.x,player.y-goal.y)<player.r+goal.r){won=true;document.querySelector('#status').textContent='Playtest complete — beacon collected!';document.querySelector('#status').className='win'}}ctx.clearRect(0,0,innerWidth,innerHeight);ctx.fillStyle='#151a24';ctx.fillRect(0,0,innerWidth,innerHeight);ctx.strokeStyle='#252d3b';for(let x=0;x<innerWidth;x+=48){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,innerHeight);ctx.stroke()}for(let y=0;y<innerHeight;y+=48){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(innerWidth,y);ctx.stroke()}ctx.shadowBlur=25;ctx.shadowColor='#d7ff64';ctx.fillStyle='#d7ff64';ctx.beginPath();ctx.arc(goal.x,goal.y,goal.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#86b7ff';ctx.beginPath();ctx.arc(player.x,player.y,player.r,0,Math.PI*2);ctx.fill();requestAnimationFrame(frame)}requestAnimationFrame(frame);
</script></body></html>`, 'utf8');
console.log(`built ${output}`);
