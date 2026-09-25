import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const elements = new Map(), events = new Map();
class Element {
  constructor(id) { this.id=id; this.value=''; this.checked=false; this.children=[]; this.style={setProperty(){}}; this.attributes={}; this.listeners={}; this.classList={add(){},remove(){},toggle(){},contains(){return false;}}; }
  addEventListener(name, fn) { this.listeners[name]=fn; }
  append(x) { this.children.push(x); }
  setAttribute(k,v) { this.attributes[k]=v; }
  removeAttribute(k) { delete this.attributes[k]; }
  getContext() { return {createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}}; }
  focus() {} setPointerCapture() {} click() {}
  showModal() { this.open=true; }
  close() { this.open=false; this.listeners.close?.(); }
}
const element = id => { if(!elements.has(id)) elements.set(id,new Element(id)); return elements.get(id); };
for(const m of html.matchAll(/<script id="([^"]+)"[^>]*>([\s\S]*?)<\/script>/g)) element(m[1]).textContent=m[2];
for(const [id,value] of Object.entries({quality:'auto',speed:'1',detail:'1'})) element(id).value=value;
element('repeat').checked=true;
let textures=0, framebuffers=0, draws=0, queue;
const gl = new Proxy({
  createTexture(){textures++;return {};}, deleteTexture(){textures--;},
  createFramebuffer(){framebuffers++;return {};}, deleteFramebuffer(){framebuffers--;},
  getShaderParameter(){return true;},getProgramParameter(){return true;},
  checkFramebufferStatus(){return 1;},FRAMEBUFFER_COMPLETE:1,
  isContextLost(){return false;},getError(){return 0;},drawArrays(){draws++;}
}, {get(target,key){return key in target?target[key]:key===key.toUpperCase()?0:()=>({});}});
element('view').getContext=()=>gl;
const document={getElementById:element,createElement:()=>new Element(),documentElement:new Element(),body:new Element(),hidden:false,querySelectorAll:s=>s==='.world'?element('worlds').children:[],addEventListener:(name,fn)=>events.set('document:'+name,fn)};
const savedSettings=new Map();const localStorage={setItem:(k,v)=>savedSettings.set(k,v),getItem:k=>savedSettings.get(k)||null};
const context={localStorage,document,console,Math,Set,Map,URL,innerWidth:1440,innerHeight:900,devicePixelRatio:1,performance:{now:()=>0},setTimeout:()=>0,clearTimeout(){},requestAnimationFrame(fn){queue=fn;return 1;},cancelAnimationFrame(){},addEventListener:(name,fn)=>events.set(name,fn)};
context.window=context;
// Test-only instrumentation; the distributed HTML has no mutable test API.
const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)[1].replace('// Expose read-only diagnostics', 'window.testAPI={saveSettings,restoreSettings,renderImage,distance,basis,move,reset,selectWorld,draw,tick,getPos:()=>pos,setPos:p=>pos=p,setIterations:n=>iterations=n};\n// Expose read-only diagnostics');
vm.runInNewContext(script,context,{timeout:5000});
await context.foldspaceReady;
const api=context.testAPI, diag=context.foldspaceDiagnostics;
assert.ok(api, 'Application boots');
assert.equal(element('worlds').children.length,5);
const press=(code)=>events.get('keydown')({code,key:'',target:{tagName:'CANVAS'},preventDefault(){}});
const release=code=>events.get('keyup')({code});
const separation=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
for(let i=0;i<5;i++){
  api.selectWorld(i); const start=diag();
  assert.ok(api.distance(start.position)>0,`${start.world} starts in open space`);
  let hits=0;
  const {f,r,u}=api.basis();
  for(let y=-4;y<=4;y++)for(let x=-4;x<=4;x++){
    let ray=f.map((v,j)=>v+x*.13*r[j]+y*.13*u[j]);const length=Math.hypot(...ray);ray=ray.map(v=>v/length);let t=0;
    for(let n=0;n<150;n++){
      const d=api.distance(start.position.map((v,j)=>v+ray[j]*t));
      assert.ok(Number.isFinite(d),`${start.world} has finite distances`);
      if(d<Math.max(.0007,t*.65/900)){hits++;break;}
      t+=Math.max(d*.7,.0002);if(t>40)break;
    }
  }
  assert.ok(hits>4,`${start.world} has visible geometry in opening view`);
  press('KeyW');api.move(.033);release('KeyW');
  assert.ok(separation(diag().position,start.position)>0,`${start.world} forward movement`);
  for(let n=0;n<600;n++){press('KeyW');api.move(.033);}release('KeyW');
  assert.ok(diag().position.every(Number.isFinite));
  assert.ok(Number.isFinite(diag().nearest));
  api.draw();assert.equal(textures,3);assert.equal(framebuffers,3);
  console.log(`${start.world}: ${hits}/81 sample rays hit geometry; sustained flight remains finite`);
}
// Adaptive depth must stay stable while stationary, without iteration feedback.
api.selectWorld(3);
for(const level of ['0','1','2','3','4']){
  element('detail').value=level;api.move(.033);
  const stable=diag();
  for(let i=0;i<120;i++){
    api.move(.033);
    assert.equal(diag().iterations,stable.iterations,'Blockworld depth stays fixed while stationary');
    assert.equal(diag().nearest,stable.nearest,'Blockworld surface distance must not oscillate');
  }
}
element('detail').value='1';
// Blockworld tiles horizontally but keeps a single terrain layer vertically.
api.selectWorld(3);
assert.equal(diag().world,'Blockworld');
element('repeat').checked=false;
for(const point of [[0,0,0],[0,1.9,0],[2,0,0],[1e-10,0,0]])assert.ok(Number.isFinite(api.distance(point)),'Blockworld has finite axis and interior distances');
element('repeat').checked=true;
assert.ok(Math.abs(api.distance([.3,2.2,.7])-api.distance([4.3,2.2,-7.3]))<1e-10,'Blockworld repeats horizontally at its cell period');
assert.ok(api.distance([.3,6.2,.7])>api.distance([.3,2.2,.7])+3,'Blockworld does not repeat vertically');
api.reset();
const blockStart=diag().position;
for(let i=0;i<200;i++){press('KeyQ');api.move(.05);}release('KeyQ');
assert.ok(diag().position[1]>blockStart[1]+2,'Flying up in Blockworld is never wrapped back down');
api.reset();
savedSettings.set('foldspace-settings-v1',JSON.stringify({world:3,camera:{pos:[.3,.45,.3],yaw:1,pitch:0}}));
api.restoreSettings();
assert.ok(separation(diag().position,blockStart)<1e-12,'Legacy world camera resets to the new starting view');
api.setPos([2,3,1]);api.saveSettings();api.reset();api.restoreSettings();
assert.ok(separation(diag().position,[2,3,1])<1e-12,'New Blockworld camera persists');
api.selectWorld(0);let before=diag().position;
press('KeyQ');api.move(.05);release('KeyQ');let after=diag().position;
assert.ok(after[1]>before[1],'Q flies up');assert.ok(Math.abs(after[0]-before[0])<1e-10&&Math.abs(after[2]-before[2])<1e-10,'Q is world-vertical');
api.reset();before=diag().position;press('KeyE');api.move(.05);release('KeyE');assert.ok(diag().position[1]<before[1],'E flies down');
api.reset();before=diag().position;element('view').listeners.wheel({deltaY:-120,deltaMode:0,preventDefault(){}});api.move(.033);assert.ok(separation(before,diag().position)<1e-10,'Scroll does not move the camera');assert.ok(Number(element('speed').value)>1,'Scroll increases speed');for(let i=0;i<80;i++)element('view').listeners.wheel({deltaY:-120,deltaMode:0,preventDefault(){}});assert.equal(Number(element('speed').value),10,'Speed caps at 10x');for(let i=0;i<80;i++)element('view').listeners.wheel({deltaY:120,deltaMode:0,preventDefault(){}});assert.equal(Number(element('speed').value),.1,'Speed floors at 0.1x');element('speed').value='1';
api.reset();element('detail').value='0';api.move(.033);const shallow=diag().iterations;element('detail').value='4';api.move(.033);assert.ok(diag().iterations>shallow,'Depth increases iteration budget');element('detail').value='1';
const priorYaw=diag().yaw;element('view').listeners.pointerdown({button:0,pointerId:1,clientX:100,clientY:100});element('view').listeners.pointermove({clientX:200,clientY:120});assert.notEqual(diag().yaw,priorYaw);element('view').listeners.pointerup();
press('KeyW');events.get('blur')();before=diag().position;api.move(.033);assert.ok(separation(before,diag().position)<1e-10,'Window blur releases flight input');
element('help').onclick();assert.equal(element('guide').open,true);const oldDraws=draws;api.tick(1000);assert.equal(draws,oldDraws,'Help pauses rendering');element('closeGuide').onclick();assert.equal(element('guide').open,false);
for(const quality of ['low','high','ultra','auto']){element('quality').value=quality;api.draw();assert.equal(textures,3,'Resize releases textures');assert.equal(framebuffers,3,'Resize releases framebuffers');}
document.hidden=true;const hiddenDraws=draws;api.tick(2000);assert.equal(draws,hiddenDraws,'Hidden tab pauses rendering');document.hidden=false;
for(let t=2034;t<6034;t+=1000/75)api.tick(t);
assert.ok(diag().fps>27&&diag().fps<33,'Frame pacing remains near 30 on a 75 Hz display');
const idleDraws=draws;for(let t=6034;t<7034;t+=1000/60)api.tick(t);assert.equal(draws,idleDraws,'A stationary view is not redrawn');
press('KeyW');api.tick(7100);release('KeyW');assert.ok(draws>idleDraws,'Movement wakes the renderer');
element('fog').value='2.4';api.saveSettings();element('fog').value='1';api.restoreSettings();assert.equal(element('fog').value,'2.4','Fog distance persists');element('fog').value='1';
assert.ok(!/<script[^>]+src=|<link[^>]+rel=["']stylesheet["'][^>]+href=/i.test(html),'Standalone with no external scripts or styles');
context.setTimeout=fn=>{queueMicrotask(fn);return 0;};
const render=api.renderImage();assert.equal(element('renderDialog').open,true);element('cancelRender').onclick();await render;assert.equal(element('renderDialog').open,false,'Cancel closes render dialog');assert.equal(textures,3,'Cancelled render releases temporary textures');assert.equal(framebuffers,3,'Cancelled render releases temporary framebuffers');
api.selectWorld(4);element('speed').value='2.3';element('speed').oninput();element('detail').value='3';element('quality').value='high';element('repeat').checked=false;api.setPos([.1,.2,.3]);api.saveSettings();api.selectWorld(0);element('detail').value='0';element('quality').value='auto';element('repeat').checked=true;api.restoreSettings();assert.equal(diag().world,'Kleinian tunnels');assert.equal(Number(element('speed').value),2.3);assert.equal(element('detail').value,'3');assert.equal(element('quality').value,'high');assert.equal(element('repeat').checked,false);assert.ok(separation(diag().position,[.1,.2,.3])<1e-12,'Camera is restored');assert.ok(!html.includes("button.textContent='Done';link.click()"),'Export does not automatically download');
console.log('PASS: five worlds, flight, vertical pans, scroll speed and bounds, depth budget, mouse look, blur recovery, pause/resume, 75 Hz frame pacing, fixed render-target count, export cancellation and GPU cleanup, settings and camera persistence, offline delivery.');
console.log('GPU compilation, visual appearance, and real hardware frame rate are not covered by these simulated-interface checks.');
