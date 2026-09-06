// Independent visual layer: never reads or writes the user's game inventory.
const hero = document.querySelector('.hero');
const canvas = document.getElementById('memoryParticles');
const context = canvas.getContext('2d');
const toggle = document.getElementById('motionToggle');
const preference = matchMedia('(prefers-reduced-motion: reduce)');
let manualPause = false;
try { manualPause = localStorage.getItem('pixel-memories-motion') === 'paused'; } catch {}
let paused = manualPause || preference.matches;
let frame = 0, inView = true, last = 0, width = 1, height = 1;
const pointer = {x:-1000,y:-1000};
const sparks = [];
function disperseTitle(){
  if(paused)return;
  const title=document.querySelector('.memory-title em').getBoundingClientRect();
  const area=hero.getBoundingClientRect();
  for(let i=0;i<24;i++)sparks.push({x:title.right-area.left-Math.random()*title.width*.3,y:title.top-area.top+Math.random()*title.height,vx:18+Math.random()*45,vy:-15-Math.random()*45,life:1,size:2+Math.random()*3});
  if(sparks.length>72)sparks.splice(0,sparks.length-72);
}
document.querySelector('.memory-title').addEventListener('pointerdown',disperseTitle);
document.querySelector('.memory-title').addEventListener('pointerenter',disperseTitle);
const particles = Array.from({length:matchMedia('(max-width:600px)').matches?34:65},()=>({
  x:Math.random(),y:Math.random(),speed:.008+Math.random()*.015,
  size:1+Math.random()*3,phase:Math.random()*6.28,color:Math.random()>.6?'#e895ff':'#89f4ff'
}));
function fit(){
  width=hero.clientWidth;height=hero.clientHeight;
  const dpr=Math.min(devicePixelRatio||1,1.5);
  canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
  context?.setTransform(dpr,0,0,dpr,0,0);
}
function draw(time){
  frame=0;
  if(paused||document.hidden||!inView||!context)return;
  const delta=Math.min((time-last)/1000,.04);last=time;
  context.clearRect(0,0,width,height);
  for(const p of particles){
    p.y-=p.speed*delta;if(p.y<0)p.y=1;
    const x=p.x*width+Math.sin(time*.0003+p.phase)*14,y=p.y*height;
    const distance=Math.hypot(x-pointer.x,y-pointer.y);
    context.globalAlpha=distance<100?.8:.18+(Math.sin(time*.001+p.phase)+1)*.16;
    context.fillStyle=p.color;
    context.fillRect(x,y,p.size,p.size);
    if(distance<100){
      context.strokeStyle=p.color;context.lineWidth=.4;context.globalAlpha=.15*(1-distance/100);
      context.beginPath();context.moveTo(x,y);context.lineTo(pointer.x,pointer.y);context.stroke();
    }
  }
  context.globalAlpha=1;
  for(let i=sparks.length-1;i>=0;i--){
    const p=sparks[i];p.life-=delta*.65;p.x+=p.vx*delta;p.y+=p.vy*delta;
    if(p.life<=0){sparks.splice(i,1);continue;}
    context.globalAlpha=p.life;context.fillStyle=i%2?'#a5ffff':'#efaaff';
    context.fillRect(p.x,p.y,p.size,p.size);
  }
  context.globalAlpha=1;
  frame=requestAnimationFrame(draw);
}
function start(){if(!frame&&!paused&&inView&&!document.hidden){last=performance.now();frame=requestAnimationFrame(draw);}}
function stop(){cancelAnimationFrame(frame);frame=0;}
function updateMotion(){
  paused=manualPause||preference.matches;
  document.documentElement.classList.toggle('motion-paused',paused);
  toggle.textContent=paused?'Animations : en pause':'Animations : actives';
  toggle.setAttribute('aria-pressed',String(paused));
  if(paused){stop();context?.clearRect(0,0,width,height);}else start();
}
toggle.addEventListener('click',()=>{
  if(preference.matches){toggle.textContent='Mouvements réduits sur cet appareil';return;}
  manualPause=!manualPause;
  try{localStorage.setItem('pixel-memories-motion',manualPause?'paused':'active');}catch{}
  updateMotion();
});
preference.addEventListener('change',updateMotion);
document.addEventListener('visibilitychange',()=>document.hidden?stop():start());
new ResizeObserver(fit).observe(hero);
new IntersectionObserver(([entry])=>{inView=entry.isIntersecting;inView?start():stop();}).observe(hero);
hero.addEventListener('pointermove',event=>{
  if(paused)return;
  const rect=hero.getBoundingClientRect();
  pointer.x=event.clientX-rect.left;pointer.y=event.clientY-rect.top;
  if(event.pointerType==='mouse'&&innerWidth>1250){
    const x=(pointer.x/rect.width-.5)*16,y=(pointer.y/rect.height-.5)*12;
    hero.style.setProperty('--core-x',x+'px');hero.style.setProperty('--core-y',y+'px');
    hero.style.setProperty('--scene-x',-x*.5+'px');
  }
});
hero.addEventListener('pointerleave',()=>{
  pointer.x=-1000;pointer.y=-1000;
  hero.style.setProperty('--core-x','0px');hero.style.setProperty('--core-y','0px');
  hero.style.setProperty('--scene-x','0px');
});
// Observe new cards as pagination and filters replace the grid.
const revealed=new WeakSet();
const reveal=new IntersectionObserver(entries=>{
  for(const entry of entries)if(entry.isIntersecting){
    entry.target.classList.remove('reveal-pending');entry.target.classList.add('reveal-in');
    reveal.unobserve(entry.target);
  }
},{threshold:.06});
function observeElements(){
  document.querySelectorAll('.game-card,.stats-grid,.section-heading,.filters,.review-panel,.settings').forEach(el=>{
    if(revealed.has(el)||el.hidden)return;
    revealed.add(el);
    if(!paused){el.classList.add('reveal-pending');reveal.observe(el);}
  });
}
const grid=document.getElementById('gamesGrid');
new MutationObserver(observeElements).observe(grid,{childList:true});
new MutationObserver(observeElements).observe(document.getElementById('reviewPanel'),{attributes:true,attributeFilter:['hidden']});
grid.addEventListener('pointermove',event=>{
  if(paused||event.pointerType!=='mouse')return;
  const card=event.target.closest('.game-card');if(!card)return;
  const rect=card.getBoundingClientRect();
  const x=(event.clientX-rect.left)/rect.width,y=(event.clientY-rect.top)/rect.height;
  card.style.setProperty('--tilt-x',(0.5-y)*5+'deg');card.style.setProperty('--tilt-y',(x-.5)*7+'deg');
  card.style.setProperty('--light-x',x*100+'%');card.style.setProperty('--light-y',y*100+'%');
});
document.addEventListener('pointerdown',event=>{
  if(paused||!event.target.closest('button,.hero-cta,.check-label'))return;
  const wave=document.createElement('i');wave.className='touch-wave';wave.setAttribute('aria-hidden','true');
  wave.style.left=event.clientX+'px';wave.style.top=event.clientY+'px';document.body.append(wave);
  wave.addEventListener('animationend',()=>wave.remove(),{once:true});setTimeout(()=>wave.remove(),800);
});
grid.addEventListener('change',event=>{
  if(paused||!event.target.checked)return;
  const id=event.target.dataset.id;
  requestAnimationFrame(()=>{
    const card=Array.from(grid.children).find(el=>el.dataset.gameId===id);
    card?.classList.add('confirmed');
  });
});
fit();updateMotion();observeElements();
setTimeout(disperseTitle,800);
