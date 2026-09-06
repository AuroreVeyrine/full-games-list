// Home-only depth scene. Paused outside viewport or when the tab is hidden.
const hero=document.querySelector('.hero'),canvas=document.getElementById('memoryParticles');
const ctx=canvas.getContext('2d'),toggle=document.getElementById('motionToggle');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const layer=document.createElement('div');layer.className='scene-layer';layer.setAttribute('aria-hidden','true');hero.append(layer);
let manual=false,paused=false,visible=true,frame=0,last=0,w=1,h=1,age=0,scrollFrame=0;
const pointer={x:-999,y:-999};
const mobile=matchMedia('(max-width:600px)').matches;
const stars=Array.from({length:mobile?55:100},()=>({x:(Math.random()-.5)*2,y:(Math.random()-.5)*2,z:.15+Math.random()*1.85,size:Math.random()*1.4+.6,pink:Math.random()>.7}));
const sparks=[];
function burst(){
 if(paused)return;const r=document.querySelector('.memory-title em').getBoundingClientRect(),b=hero.getBoundingClientRect();
 for(let i=0;i<28;i++)sparks.push({x:r.right-b.left-Math.random()*r.width*.25,y:r.top-b.top+Math.random()*r.height,vx:20+Math.random()*50,vy:-20-Math.random()*45,life:1});
 if(sparks.length>84)sparks.splice(0,sparks.length-84);
}
function fit(){
 w=hero.clientWidth;h=hero.clientHeight;const dpr=Math.min(devicePixelRatio||1,1.5);
 canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx?.setTransform(dpr,0,0,dpr,0,0);
}
function draw(now){
 frame=0;if(paused||document.hidden||!visible||!ctx)return;
 const dt=Math.min((now-last)/1000,.035);last=now;age+=dt;ctx.clearRect(0,0,w,h);
 const cx=w*(mobile?.5:.7),cy=h*(mobile?.22:.4);
 for(const s of stars){
   const oldZ=s.z;s.z-=dt*(age<1.8?.3:.035);
   if(s.z<.12){s.z=2;s.x=(Math.random()-.5)*2;s.y=(Math.random()-.5)*2;}
   const x=cx+s.x*w*.45/s.z,y=cy+s.y*h*.4/s.z;
   if(x<0||x>w||y<0||y>h)continue;
   const distance=Math.hypot(x-pointer.x,y-pointer.y);
   ctx.fillStyle=s.pink?'#f1a1ff':'#9cefff';
   ctx.globalAlpha=Math.min(.65,.18+(2-s.z)*.18);
   const size=Math.min(4,s.size/s.z);
   ctx.fillRect(x,y,size,size);
   if(age<1.8&&oldZ>s.z){
     ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=.6;ctx.globalAlpha=.18;
     ctx.beginPath();ctx.moveTo(cx+s.x*w*.45/oldZ,cy+s.y*h*.4/oldZ);ctx.lineTo(x,y);ctx.stroke();
   }
   if(distance<90){
     ctx.strokeStyle=ctx.fillStyle;ctx.globalAlpha=.23*(1-distance/90);ctx.lineWidth=.5;
     ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(pointer.x,pointer.y);ctx.stroke();
   }
 }
 for(let i=sparks.length-1;i>=0;i--){
   const p=sparks[i];p.life-=dt*.6;p.x+=p.vx*dt;p.y+=p.vy*dt;
   if(p.life<=0){sparks.splice(i,1);continue;}
   ctx.globalAlpha=p.life;ctx.fillStyle=i%2?'#b6ffff':'#e8aaff';ctx.fillRect(p.x,p.y,3,3);
 }
 ctx.globalAlpha=1;frame=requestAnimationFrame(draw);
}
function start(){if(!frame&&!paused&&visible&&!document.hidden){last=performance.now();frame=requestAnimationFrame(draw);}}
function stop(){cancelAnimationFrame(frame);frame=0;}
function sync(){
 try{manual=localStorage.getItem('pixel-memories-motion')==='paused';}catch{}
 paused=manual||reduced.matches;document.documentElement.classList.toggle('motion-paused',paused);
 toggle.textContent=paused?'Animations : en pause':'Animations : actives';toggle.setAttribute('aria-pressed',String(paused));
 if(paused){stop();ctx?.clearRect(0,0,w,h);}else start();
}
toggle.addEventListener('click',()=>{
 if(reduced.matches){toggle.textContent='Mouvements réduits sur cet appareil';return;}
 manual=!manual;try{localStorage.setItem('pixel-memories-motion',manual?'paused':'active');}catch{}
 sync();window.dispatchEvent(new Event('motionchange'));
});
window.addEventListener('motionchange',sync);reduced.addEventListener('change',sync);
document.addEventListener('visibilitychange',()=>document.hidden?stop():start());
new ResizeObserver(fit).observe(hero);
new IntersectionObserver(([e])=>{visible=e.isIntersecting;hero.classList.toggle('scene-sleeping',!visible);visible?start():stop();}).observe(hero);
function parallax(){
 scrollFrame=0;if(paused||!visible)return;const r=hero.getBoundingClientRect();
 const offset=Math.max(-100,Math.min(160,-r.top));
 hero.style.setProperty('--scene-scroll',offset*.24+'px');
 hero.style.setProperty('--copy-scroll',offset*.055+'px');
 hero.style.setProperty('--orb-scroll',offset*-.15+'px');
}
window.addEventListener('scroll',()=>{if(!scrollFrame&&!paused&&visible)scrollFrame=requestAnimationFrame(parallax);},{passive:true});
hero.addEventListener('pointermove',e=>{
 if(paused)return;const r=hero.getBoundingClientRect();pointer.x=e.clientX-r.left;pointer.y=e.clientY-r.top;
 if(e.pointerType==='mouse'&&innerWidth>1250){
  hero.style.setProperty('--core-x',(pointer.x/r.width-.5)*22+'px');
  hero.style.setProperty('--core-y',(pointer.y/r.height-.5)*16+'px');
  hero.style.setProperty('--scene-x',(pointer.x/r.width-.5)*-12+'px');
 }
},{passive:true});
hero.addEventListener('pointerleave',()=>{pointer.x=-999;pointer.y=-999;hero.style.setProperty('--core-x','0px');hero.style.setProperty('--core-y','0px');hero.style.setProperty('--scene-x','0px');});
hero.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'){const r=hero.getBoundingClientRect();pointer.x=e.clientX-r.left;pointer.y=e.clientY-r.top;setTimeout(()=>{pointer.x=-999;pointer.y=-999;},700);}});
document.querySelector('.memory-title').addEventListener('pointerdown',burst);
document.querySelector('.memory-title').addEventListener('pointerenter',burst);
fit();sync();setTimeout(burst,900);
