// Run with node tests/gpu-precision.mjs, then open the printed URL in a WebGL 2 browser.
// The browser checks the actual production shader and posts its result back here.
import fs from 'node:fs';
import http from 'node:http';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const shader=id=>html.match(new RegExp(`<script id="${id}"[^>]*>([\\s\\S]*?)<\\/script>`))[1];
const source=shader('sceneShader').replace('precision highp int;',
  'precision highp int;\nconst int world=2;const bool preciseMode=true;const int coneBlock=8;const int mengerSlots=16;');

// Independent spherical float64 reference (the production CPU formula).
function distance(p,iterations=48){
  let z=[...p],dr=1;
  for(let i=0;i<iterations;i++){
    const r=Math.hypot(...z);if(r>3)break;if(r<1e-8){z=[...p];continue;}
    const theta=Math.acos(Math.max(-1,Math.min(1,z[2]/r)))*8,phi=Math.atan2(z[1],z[0])*8,r7=r**7;
    dr=r7*8*dr+1;
    z=[Math.sin(theta)*Math.cos(phi),Math.sin(theta)*Math.sin(phi),Math.cos(theta)].map((x,j)=>x*r7*r+p[j]);
  }
  const r=Math.hypot(...z);return .5*Math.log(Math.max(r,1.00001))*r/dr;
}
const samples=[];
for(const start of [[2.1,1.15,2.3],[-2,.7,1.4],[1.6,-1.1,-2.1]]){
  const dir=start.map(x=>-x/Math.hypot(...start));let point=[...start];
  for(const threshold of [1e-4,1e-6,1e-8,1e-10]){
    for(let i=0;i<20000&&distance(point)>threshold;i++)point=point.map((x,j)=>x+dir[j]*distance(point)*.7);
    if(distance(point)>threshold)throw Error('Reference ray did not reach test depth');
    for(const offset of [[0,0,0],[threshold*.4,-threshold*.3,threshold*.2]]){
      for(const repeating of [false,true]){
        const eye=point.map((x,j)=>x+(repeating?[4.8,-4.8,4.8][j]:0));
        const p=eye.map((x,j)=>x+Math.fround(offset[j]));
        const wrapped=repeating?p.map(x=>((x+2.4)%4.8+4.8)%4.8-2.4):p;
        samples.push({eye,offset,repeating,expected:distance(wrapped),threshold});
      }
    }
  }
}
for(const eye of [[0,0,0],[0,0,1.1],[0,0,-1.1],[1e-12,-1e-12,1.1],[1.1,0,0],[0,-1.1,0]])
  samples.push({eye,offset:[0,0,0],repeating:false,expected:distance(eye),threshold:1});

async function run({vertex,source,samples}){
  const output=document.querySelector('pre');
  try{
    const canvas=document.querySelector('canvas'),gl=canvas.getContext('webgl2');
    if(!gl)throw Error('WebGL 2 unavailable');
    async function program(fragment){
      const p=gl.createProgram();
      for(const [type,text] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){
        const s=gl.createShader(type);gl.shaderSource(s,text);gl.compileShader(s);gl.attachShader(p,s);gl.deleteShader(s);
      }
      gl.linkProgram(p);const ext=gl.getExtension('KHR_parallel_shader_compile');
      if(ext)while(!gl.getProgramParameter(p,ext.COMPLETION_STATUS_KHR))await new Promise(r=>setTimeout(r,20));
      if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));
      return p;
    }
    output.textContent='Compiling full Mandelbulb renderer…';
    const full=await program(source);
    const packed=source.split('void main(){')[0]+`uniform vec3 testOffset;
void main(){float d=field(testOffset).x;uint bits=floatBitsToUint(d);frag=vec4(float(bits&255u),float((bits>>8)&255u),float((bits>>16)&255u),float((bits>>24)&255u))/255.;}`;
    const p=await program(packed);gl.useProgram(p);gl.disable(gl.DITHER);gl.viewport(0,0,1,1);
    const uniform=(name,type,...args)=>gl['uniform'+type](gl.getUniformLocation(p,name),...args);
    uniform('roundMask','1ui',4294967295);uniform('iterations','1i',48);
    uniform('period','1f',4.8);uniform('periodLow','1f',4.8-Math.fround(4.8));
    const bytes=new Uint8Array(4),data=new DataView(bytes.buffer),results=[];
    for(const sample of samples){
      uniform('eye','3fv',sample.eye);uniform('eyeLow','3fv',sample.eye.map(x=>x-Math.fround(x)));
      uniform('testOffset','3fv',sample.offset);uniform('repeating','1i',Number(sample.repeating));
      gl.drawArrays(gl.TRIANGLES,0,3);gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,bytes);
      const actual=data.getFloat32(0,true),error=Math.abs(actual-sample.expected)/Math.max(sample.expected,1e-12);
      results.push({...sample,actual,error});
    }
    // Render an actual deep view as well as checking scalar distances.
    gl.deleteProgram(p);gl.useProgram(full);canvas.width=384;canvas.height=256;gl.viewport(0,0,384,256);
    const view=samples.find(s=>s.threshold===1e-6&&!s.repeating),eye=view.eye;
    const normalize=a=>a.map(x=>x/Math.hypot(...a)),forward=normalize(eye.map(x=>-x));
    const right=normalize([forward[2],0,-forward[0]]),up=[right[1]*forward[2]-right[2]*forward[1],right[2]*forward[0]-right[0]*forward[2],right[0]*forward[1]-right[1]*forward[0]];
    const set=(name,type,...args)=>gl['uniform'+type](gl.getUniformLocation(full,name),...args);
    for(const [name,value] of Object.entries({eye,eyeLow:eye.map(x=>x-Math.fround(x)),forward,right,up,colorA:[.005,.17,.22],colorB:[.008,.025,.13],fogColor:[.018,.05,.13],glowColor:[.01,.15,.14]}))set(name,'3fv',value);
    set('resolution','2f',384,256);set('roundMask','1ui',4294967295);set('iterations','1i',48);set('steps','1i',320);set('shadingSamples','1i',4);
    for(const [name,value] of Object.entries({epsilon:2e-12,period:4.8,periodLow:4.8-Math.fround(4.8),detailBias:.5,fogScale:1,lengthScale:1,invViewScale:1}))set(name,'1f',value);
    gl.drawArrays(gl.TRIANGLES,0,3);
    const pixels=new Uint8Array(384*256*4);gl.readPixels(0,0,384,256,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    const shades=new Set();for(let i=0;i<pixels.length;i+=4)shades.add(pixels[i]*65536+pixels[i+1]*256+pixels[i+2]);
    const glError=gl.getError();gl.deleteProgram(full);
    const failures=results.filter(r=>!Number.isFinite(r.actual)||r.error>.05);
    const report={passed:!failures.length&&glError===0&&shades.size>100,samples:results.length,maxRelativeError:Math.max(...results.map(r=>r.error)),renderedColors:shades.size,glError,failures};
    output.textContent=JSON.stringify(report,null,2);
    await fetch('/result',{method:'POST',body:JSON.stringify(report)});
  }catch(e){output.textContent='FAIL: '+e.message;await fetch('/result',{method:'POST',body:JSON.stringify({passed:false,error:e.message})});}
}
const payload={vertex:shader('vertex'),source,samples};
const page=`<!doctype html><meta charset="utf-8"><title>Mandelbulb GPU precision test</title><canvas width="1" height="1"></canvas><pre>Starting…</pre><script>(${run.toString()})(${JSON.stringify(payload).replaceAll('<','\\u003c')})</script>`;
const server=http.createServer((req,res)=>{
  if(req.url==='/result'&&req.method==='POST'){
    let body='';req.on('data',chunk=>body+=chunk);req.on('end',()=>{
      const report=JSON.parse(body);console.log(JSON.stringify(report,null,2));res.end('OK');
      process.exitCode=report.passed?0:1;server.close();
    });return;
  }
  if(req.url!=='/'){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type','text/html; charset=utf-8');res.end(page);
});
server.listen(8001,'127.0.0.1',()=>console.log('Open http://127.0.0.1:8001 for the Mandelbulb GPU precision regression.'));
