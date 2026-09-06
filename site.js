const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let paused=false;
try{paused=localStorage.getItem('pixel-memories-motion')==='paused';}catch{}
const toggle=document.createElement('button');toggle.className='site-motion';toggle.type='button';
document.querySelector('footer').append(toggle);
function syncMotion(){
  const off=paused||reduced.matches;
  document.documentElement.classList.toggle('motion-paused',off);
  toggle.textContent=off?'Animations en pause':'Mettre les animations en pause';
  toggle.setAttribute('aria-pressed',String(off));
}
toggle.addEventListener('click',()=>{
  if(reduced.matches){toggle.textContent='Mouvements réduits sur cet appareil';return;}
  paused=!paused;try{localStorage.setItem('pixel-memories-motion',paused?'paused':'active');}catch{}
  syncMotion();window.dispatchEvent(new Event('motionchange'));
});
window.addEventListener('motionchange',()=>{try{paused=localStorage.getItem('pixel-memories-motion')==='paused';}catch{}syncMotion();});
reduced.addEventListener('change',syncMotion);syncMotion();
const off=()=>document.documentElement.classList.contains('motion-paused');
const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
  if(entry.isIntersecting){entry.target.classList.remove('reveal-pending');entry.target.classList.add('reveal-in');observer.unobserve(entry.target);}
}),{threshold:.06});
const watched=new WeakSet();
function reveal(){
  document.querySelectorAll('.game-card,.account-panel').forEach(el=>{
    if(watched.has(el))return;watched.add(el);
    if(!off()){el.classList.add('reveal-pending');observer.observe(el);}
  });
}
reveal();
const grid=document.getElementById('gamesGrid');
if(grid)new MutationObserver(reveal).observe(grid,{childList:true});
let moveFrame=0;
document.addEventListener('pointermove',event=>{
  if(off()||event.pointerType!=='mouse'||moveFrame)return;
  const card=event.target.closest('.game-card');if(!card)return;
  const x=event.clientX,y=event.clientY;
  moveFrame=requestAnimationFrame(()=>{
    moveFrame=0;const r=card.getBoundingClientRect();const px=(x-r.left)/r.width,py=(y-r.top)/r.height;
    card.style.setProperty('--tilt-x',(0.5-py)*6+'deg');card.style.setProperty('--tilt-y',(px-.5)*8+'deg');
    card.style.setProperty('--light-x',px*100+'%');card.style.setProperty('--light-y',py*100+'%');
  });
},{passive:true});
document.addEventListener('pointerdown',event=>{
  if(off()||!event.target.closest('button,.hero-cta,.check-label'))return;
  const wave=document.createElement('i');wave.className='touch-wave';wave.setAttribute('aria-hidden','true');
  wave.style.left=event.clientX+'px';wave.style.top=event.clientY+'px';document.body.append(wave);
  setTimeout(()=>wave.remove(),700);
},{passive:true});
