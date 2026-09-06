import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scrollAssembly,unstableAssembly,fragmentPosition} from '../depth-math.mjs';
test('scroll assembly is reversible and leaves the central reading band intact',()=>{
 for(const viewport of [640,900]){
  const card=350,top=viewport*.5-card/2;
  assert.equal(scrollAssembly(top,card,viewport),0);
  const route=[viewport,top,-card,top,viewport];
  const values=route.map(t=>scrollAssembly(t,card,viewport));
  assert.equal(values[0],1);assert.equal(values[2],1);
  assert.equal(values[0],values[4]);assert.equal(values[1],values[3]);
 }
});
test('logo continually reforms without becoming perfectly static',()=>{
 const values=Array.from({length:81},(_,i)=>unstableAssembly(i/10));
 assert.ok(Math.min(...values)>0);assert.ok(Math.min(...values)<.1);
 assert.ok(Math.max(...values)>.8);
 assert.ok(Math.abs(unstableAssembly(0)-unstableAssembly(8))<1e-9);
});
test('fragment positions remain finite and return to their source when assembled',()=>{
 const p={x:.2,y:-.3,dx:.8,dy:-.7,z:1.2,seed:3,size:.025};
 const rest=fragmentPosition(p,0,4);
 assert.equal(rest.x,p.x);assert.equal(rest.y,p.y);
 for(const d of [0,.5,1]){
  const v=fragmentPosition(p,d,10);
  assert.ok(Number.isFinite(v.x)&&Number.isFinite(v.y)&&v.size>0);
 }
});
