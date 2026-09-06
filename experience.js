import {clamp,smooth,scrollAssembly,unstableAssembly,fragmentPosition} from './depth-math.mjs';
// One bounded renderer for all visible layers, capped at 30 FPS on touch screens.
const hero=document.querySelector('.hero');
const mobile=matchMedia('(pointer:coarse)').matches;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const layer=document.createElement('div');
layer.className='scene-layer';layer.setAttribute('aria-hidden','true');hero.append(layer);
document.getElementById('memoryParticles')?.remove();
const atmosphere=document.createElement('canvas');atmosphere.className='depth-atmosphere';
atmosphere.setAttribute('aria-hidden','true');document.body.append(atmosphere);
const bg=atmosphere.getContext('2d');
let width=innerWidth,height=innerHeight,dpr=1,raf=0,last=0,time=0;
let scroll=scrollY,velocity=0,paused=false,dirty=true;
const pointer={x:.5,y:.5};
const scenes=[],panels=[];
const random=n=>{const x=Math.sin(n*78.233)*43758.5453;return x-Math.floor(x);};
const particles=Array.from({length:mobile?48:85},(_,i)=>({
 x:random(i+1),y:random(i+19),depth:i%3,
 speed:[.12,.46,1.1][i%3],size:[1.5,4,14][i%3]*(.6+random(i+5)),
 hue:i%2?'#f77de3':'#70edff',seed:i
}));
function sprite(color,blur){
 const c=document.createElement('canvas');c.width=c.height=64;
 const ctx=c.getContext('2d');ctx.fillStyle=color;ctx.filter='blur('+blur+'px)';
 ctx.fillRect(24,24,16,16);return c;
}
const sprites=[sprite('#70edff',0),sprite('#f77de3',0),sprite('#70edff',5),sprite('#f77de3',5)];
// Quantized masks remove real pieces of the panel; cached to avoid rebuilding SVG per frame.
const masks=Array.from({length:16},(_,level)=>{
 if(!level)return 'none';
 let blocks='';
 for(let y=0;y<16;y++)for(let x=0;x<12;x++){
  const edge=Math.abs(x-5.5)/5.5;
  if(random(x+y*12+130)>(level/15)*(.45+edge*.35))
   blocks+='<rect x="'+x+'" y="'+y+'" width="1.02" height="1.02" fill="white"/>';
 }
 return 'url("data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 16" preserveAspectRatio="none">'+blocks+'</svg>')+'")';
});
function fit(){
 width=innerWidth;height=innerHeight;dpr=Math.min(devicePixelRatio||1,mobile?1.25:1.5);
 atmosphere.width=width*dpr;atmosphere.height=height*dpr;bg?.setTransform(dpr,0,0,dpr,0,0);
 for(const s of scenes){
  const r=s.el.getBoundingClientRect();s.w=r.width;s.h=r.height;
  s.canvas.width=r.width*dpr;s.canvas.height=r.height*dpr;s.ctx.setTransform(dpr,0,0,dpr,0,0);
 }
 dirty=true;
}
function sample(source){
 const c=document.createElement('canvas');c.width=c.height=128;
 const ctx=c.getContext('2d',{willReadFrequently:true});source(ctx);
 const data=ctx.getImageData(0,0,128,128).data,points=[];
 for(let y=0;y<128;y+=3)for(let x=0;x<128;x+=3){
  const k=(y*128+x)*4;
  if(data[k+3]<60||data[k]+data[k+1]+data[k+2]<240)continue;
  const seed=x+y*128,r=random(seed);
  points.push({x:(x-64)/128,y:(y-64)/128,size:2.8/128,seed:r*6.28,
    dx:(random(seed+4)-.5)*1.8,dy:(random(seed+8)-.5)*1.7,
    z:random(seed+11)*1.7-.5,color:'rgb('+data[k]+','+data[k+1]+','+data[k+2]+')'});
 }
 return points;
}
function makeScene(el,points,kind){
 const canvas=el.querySelector('canvas'),ctx=canvas.getContext('2d');
 if(!ctx)return;
 const scene={el,canvas,ctx,points,kind,w:0,h:0,visible:true,rect:null};
 scenes.push(scene);el.classList.add('pixel-ready');
}
const logo=new Image();
logo.onload=()=>{
 try{makeScene(document.querySelector('.memory-core'),sample(ctx=>ctx.drawImage(logo,4,4,120,120)),'logo');fit();wake();}catch{/* SVG remains visible if sampling is unavailable. */}
};
logo.src='assets/pixel-memories-symbol.svg';
document.querySelectorAll('.journey-card').forEach((card,index)=>{
 const shell=document.createElement('div');shell.className='assembly-shell';card.before(shell);shell.append(card);
 const art=card.querySelector('.chapter-art'),fallback=document.createElement('span');
 fallback.className='chapter-fallback';fallback.textContent=art.textContent;art.replaceChildren(fallback);
 const canvas=document.createElement('canvas');canvas.className='core-pixel-canvas';art.append(canvas);
 const colors=['#98f7ff','#c6a0ff','#ffa2da'];
 const points=sample(ctx=>{
  ctx.strokeStyle=colors[index];ctx.fillStyle=colors[index];ctx.lineWidth=6;ctx.lineJoin='round';
  if(index===0){ctx.beginPath();ctx.arc(57,53,29,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(78,76);ctx.lineTo(108,106);ctx.stroke();}
  if(index===1){ctx.beginPath();ctx.moveTo(64,10);ctx.quadraticCurveTo(66,56,114,64);ctx.quadraticCurveTo(66,70,64,116);ctx.quadraticCurveTo(59,69,14,64);ctx.quadraticCurveTo(60,58,64,10);ctx.fill();}
  if(index===2){ctx.beginPath();ctx.moveTo(64,12);ctx.lineTo(116,64);ctx.lineTo(64,116);ctx.lineTo(12,64);ctx.closePath();ctx.stroke();ctx.fillRect(53,53,22,22);}
 });
 makeScene(art,points,'chapter');
 panels.push({shell,card,index,rect:null,scatter:0,tiles:Array.from({length:28},(_,i)=>({x:random(i+index*80),y:random(i+30),dx:(random(i+45)-.5)*230,dy:(random(i+70)-.5)*260,size:3+random(i+15)*10}))});
});
function measure(){
 const delta=scrollY-scroll;velocity=velocity*.65+delta*.35;scroll=scrollY;
 for(const p of panels){
  p.rect=p.shell.getBoundingClientRect();p.scatter=scrollAssembly(p.rect.top,p.rect.height,height);
 }
 for(const s of scenes){
  s.rect=s.el.getBoundingClientRect();s.visible=s.rect.bottom>0&&s.rect.top<height;
 }
 const r=hero.getBoundingClientRect();
 if(r.bottom>0){
  const progress=clamp(-r.top/r.height);
  layer.style.transform='translate3d('+((pointer.x-.5)*-32)+'px,'+(progress*170)+'px,0) scale('+(1.06+progress*.12)+')';
  const copy=hero.firstElementChild;
  copy.style.transform='translate3d(0,'+(-progress*68)+'px,0) rotateX('+(progress*6)+'deg)';
  copy.style.filter='blur('+Math.max(0,progress-.55)*5+'px)';
  const erosion=Math.floor(smooth((progress-.35)/.6)*15);
  copy.style.maskImage=masks[erosion];copy.style.webkitMaskImage=masks[erosion];
 }
 dirty=false;
}
function drawScene(s){
 const ctx=s.ctx,w=s.w,h=s.h;
 ctx.clearRect(0,0,w,h);if(!s.visible)return;
 const center=s.rect.top+s.rect.height*.5;
 const edge=clamp((height*.17-center)/(height*.22));
 let scatter=s.kind==='logo'?unstableAssembly(time,4):.05+scrollAssembly(s.rect.top,s.rect.height,height)*.85;
 scatter=clamp(scatter+edge*.6+Math.min(Math.abs(velocity)/170,.23));
 const scale=Math.min(w,h)*(s.kind==='logo'?.59:.58);
 const split=1.3+scatter*7+Math.sin(time*3)*.7;
 ctx.globalCompositeOperation='screen';
 for(const p of s.points){
  const pos=fragmentPosition(p,scatter,time);
  const x=w*.5+pos.x*scale+(pointer.x-.5)*p.z*12;
  const y=h*.5+pos.y*scale;
  const size=Math.max(1.2,pos.size*scale);
  // RGB channels separate along depth, never flash the whole frame.
  ctx.globalAlpha=.35;ctx.fillStyle='#00cfff';ctx.fillRect(x-split,y,size,size);
  ctx.fillStyle='#ff46b9';ctx.fillRect(x+split,y+scatter*2,size,size);
  ctx.globalAlpha=.8-scatter*.25;ctx.fillStyle=p.color;ctx.fillRect(x,y,size,size);
 }
 ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
}
function drawAtmosphere(){
 if(!bg)return;bg.clearRect(0,0,width,height);
 for(const p of particles){
  const x=p.x*width+Math.sin(time*.18+p.seed)*20+(pointer.x-.5)*p.depth*24;
  const y=((p.y*(height+250)-scroll*p.speed-time*(4+p.depth*3))%(height+250)+(height+250))%(height+250)-125;
  const stretch=1+Math.min(Math.abs(velocity)/90,.7)*p.depth;
  bg.globalAlpha=[.3,.21,.1][p.depth];
  const size=p.size*(p.depth===2?4:2.5);
  bg.drawImage(sprites[(p.seed%2)+(p.depth===2?2:0)],x-size*.5,y-size*.5,size,size*stretch);
 }
 // Edge fragments are tied to each panel's actual screen position.
 for(const p of panels){
  if(p.rect.bottom<0||p.rect.top>height)continue;
  const d=smooth(p.scatter);
  for(const t of p.tiles){
   bg.globalAlpha=.6*d;bg.fillStyle=p.index%2?'#de8ff6':'#70eaff';
   const x=p.rect.left+t.x*p.rect.width+t.dx*d;
   const y=p.rect.top+t.y*p.rect.height+t.dy*d;
   bg.fillRect(x,y,t.size*(.3+d),t.size*(.3+d));
  }
 }
 bg.globalAlpha=1;
}
function applyPanels(){
 for(const p of panels){
  if(p.rect.bottom<0||p.rect.top>height)continue;
  const d=smooth(p.scatter),side=p.index%2?-1:1;
  p.card.style.transform='translate3d('+(side*d*32)+'px,'+(d*22)+'px,'+(-d*110)+'px) rotateY('+(side*d*11)+'deg) rotateX('+(d*6)+'deg)';
  p.card.style.opacity=String(1-d*.65);p.card.style.filter='blur('+(d*3.5)+'px)';
  const mask=masks[Math.floor(d*15)];
  if(p.mask!==mask){p.card.style.maskImage=mask;p.card.style.webkitMaskImage=mask;p.mask=mask;}
  p.card.style.setProperty('--split',(d*4)+'px');
 }
}
function render(now){
 raf=0;if(paused||document.hidden)return;
 if(now-last<(mobile?32:16)){raf=requestAnimationFrame(render);return;}
 const dt=Math.min((now-last)/1000,.05);last=now;time+=dt;
 if(dirty||Math.abs(velocity)>.1)measure();
 applyPanels();drawAtmosphere();for(const s of scenes)drawScene(s);
 raf=requestAnimationFrame(render);
}
function wake(){if(!raf&&!paused&&!document.hidden){last=performance.now();raf=requestAnimationFrame(render);}}
function sync(){
 paused=reduced.matches||document.documentElement.classList.contains('motion-paused');
 if(paused){cancelAnimationFrame(raf);raf=0;bg?.clearRect(0,0,width,height);}
 else{dirty=true;wake();}
}
window.addEventListener('motionchange',sync);reduced.addEventListener('change',sync);
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else{dirty=true;wake();}});
window.addEventListener('resize',fit,{passive:true});
window.addEventListener('scroll',()=>{dirty=true;wake();},{passive:true});
window.addEventListener('pointermove',e=>{if(e.pointerType==='mouse'){pointer.x=e.clientX/width;pointer.y=e.clientY/height;dirty=true;}},{passive:true});
hero.addEventListener('pointerdown',()=>{if(!paused)time+=1.3;});
document.fonts?.ready.then(()=>{dirty=true;fit();});
fit();sync();measure();
