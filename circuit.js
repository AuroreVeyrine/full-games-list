// A printed circuit whose energized length follows the reading position.
const NS='http://www.w3.org/2000/svg';
const svg=document.createElementNS(NS,'svg');
svg.classList.add('energy-circuit');svg.setAttribute('aria-hidden','true');
svg.setAttribute('preserveAspectRatio','none');
document.body.append(svg);
let rail,head,clip,nodes=[],length=0,frame=0,target=0,current=0,pageHeight=1,needsLayout=true;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const off=()=>reduced.matches||document.documentElement.classList.contains('motion-paused');
function el(tag,attrs,parent=svg){
 const node=document.createElementNS(NS,tag);
 for(const [key,value] of Object.entries(attrs))node.setAttribute(key,String(value));
 parent.append(node);return node;
}
function layout(){
 const w=document.documentElement.clientWidth;
 pageHeight=document.body.offsetHeight;
 svg.setAttribute('viewBox','0 0 '+w+' '+pageHeight);
 svg.replaceChildren();nodes=[];
 const main=document.querySelector('main'),rect=main.getBoundingClientRect();
 const x=w<600?7:Math.max(14,rect.left+5),bend=w<600?8:18;
 const anchors=[...main.querySelectorAll('.hero,.journey-section,.assembly-shell,.portal-section,.page-intro,#catalogue,.account-panel')];
 const ys=[...new Set(anchors.map(a=>Math.round(a.getBoundingClientRect().top+scrollY+12)))].sort((a,b)=>a-b).filter(y=>y>80);
 const start=76,end=pageHeight-25;
 let d='M '+(x+bend)+' '+start+' L '+(x+bend)+' 98 L '+x+' '+(98+bend);
 let last=98+bend;
 for(const y of ys){
  if(y<last+50||y>end-40)continue;
  d+=' L '+x+' '+(y-20)+' L '+(x+bend)+' '+(y-20+bend)+' L '+(x+bend)+' '+(y+24)+' L '+x+' '+(y+24+bend);
  last=y+24+bend;
 }
 d+=' L '+x+' '+Math.max(end,last);
 const defs=el('defs',{});
 const mask=el('clipPath',{id:'energy-reveal'},defs);
 clip=el('rect',{x:0,y:0,width:w,height:current},mask);
 rail=el('path',{d,class:'circuit-track'});
 el('path',{d,class:'circuit-companion',transform:'translate(5 0)'});
 const energized=el('g',{'clip-path':'url(#energy-reveal)'});
 el('path',{d,class:'circuit-bloom'},energized);
 el('path',{d,class:'circuit-current'},energized);
 for(const y of ys){
  const reach=w<600?24:55;
  const branch='M '+x+' '+y+' L '+(x+reach*.45)+' '+y+' L '+(x+reach*.7)+' '+(y+reach*.25)+' L '+(x+reach)+' '+(y+reach*.25);
  el('path',{d:branch,class:'circuit-track'});
  el('path',{d:branch,class:'circuit-current'},energized);
  const node=el('circle',{cx:x+reach,cy:y+reach*.25,r:w<600?2.5:3.5,class:'circuit-node'});
  nodes.push({el:node,y:y+reach*.25});
 }
 head=el('g',{class:'circuit-head'});
 el('circle',{r:10,class:'circuit-head-glow'},head);
 el('circle',{r:2.6,fill:'#e2ffff'},head);
 length=rail.getTotalLength();needsLayout=false;
}
function draw(){
 frame=0;if(document.hidden)return;
 if(needsLayout)layout();
 const maxScroll=Math.max(1,pageHeight-innerHeight);
 target=scrollY<2?120:Math.min(pageHeight-25,scrollY+innerHeight*.65+(scrollY/maxScroll)*innerHeight*.35);
 if(off()){current=target;head.style.display='none';}
 else{current+=(target-current)*.2;head.style.display='';}
 clip.setAttribute('height',String(current));
 // Locate the pulse by vertical position, including the diagonal circuit bends.
 let lo=0,hi=length;
 for(let i=0;i<13;i++){const mid=(lo+hi)/2;if(rail.getPointAtLength(mid).y<current)lo=mid;else hi=mid;}
 const p=rail.getPointAtLength((lo+hi)/2);head.setAttribute('transform','translate('+p.x+' '+p.y+')');
 for(const n of nodes)n.el.classList.toggle('powered',n.y<=current);
 if(!off()&&Math.abs(target-current)>.5)frame=requestAnimationFrame(draw);
}
function queue(){if(!frame)frame=requestAnimationFrame(draw);}
window.addEventListener('scroll',queue,{passive:true});
window.addEventListener('resize',()=>{needsLayout=true;queue();},{passive:true});
window.addEventListener('motionchange',queue);reduced.addEventListener('change',queue);
document.addEventListener('visibilitychange',queue);
const observer=new ResizeObserver(()=>{needsLayout=true;queue();});
observer.observe(document.querySelector('main'));observer.observe(document.querySelector('footer'));
document.fonts?.ready.then(()=>{needsLayout=true;queue();});
queue();
