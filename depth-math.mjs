export const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export const smooth=x=>{const t=clamp(x);return t*t*(3-2*t);};
// Fully assembled throughout the central reading band; reversible at both edges.
export function scrollAssembly(top,height,viewport){
  const center=top+height*.5;
  const entering=1-smooth((viewport*.98-center)/(viewport*.32));
  const leaving=smooth((viewport*.24-center)/(viewport*.32));
  return Math.max(entering,leaving);
}
export function unstableAssembly(seconds,seed=0){
  const cycle=(seconds+seed)%8;
  return .07+.77*smooth((Math.sin(cycle*Math.PI/4)+1)*.5);
}
export function fragmentPosition(p,scatter,time){
  const spread=smooth(scatter);
  const depth=1+spread*p.z*.8;
  return {x:p.x*depth+p.dx*spread+Math.sin(time*1.8+p.seed)*scatter*.025,
    y:p.y*depth+p.dy*spread+Math.cos(time*1.2+p.seed)*scatter*.025,
    size:p.size*(1+spread*p.z*.65)};
}
