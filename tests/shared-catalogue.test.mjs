import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHandler} from '../netlify/functions/shared-catalogue.mjs';
function fixture(){
 let data=null,etag=0,calls=0,fail=false;
 const store={
  getWithMetadata:async()=>data?{data:structuredClone(data),etag:String(etag)}:null,
  get:async()=>structuredClone(data),
  setJSON:async(k,value,options)=>{
   if(options.onlyIfNew&&data||options.onlyIfMatch&&options.onlyIfMatch!==String(etag))return {modified:false};
   data=structuredClone(value);etag++;return {modified:true};
  }
 };
 const handler=createHandler({storeFactory:()=>store,key:()=> 'test-key',fetcher:async url=>{
  calls++;if(fail)throw Error('offline');
  const page=Number(url.searchParams.get('page'));
  return Response.json({next:true,results:Array.from({length:40},(_,i)=>({id:(page-1)*40+i+1,name:'Game '+((page-1)*40+i+1),genres:[],platforms:[]}))});
 }});
 return {handler,get calls(){return calls;},get data(){return data;},fail:()=>{fail=true;}};
}
test('every new client reads the same shared catalogue without reimporting',async()=>{
 const f=fixture();await f.handler(new Request('https://test/api/catalogue',{method:'POST'}));
 assert.equal(f.calls,8);
 for(let i=0;i<3;i++){
  const res=await f.handler(new Request('https://test/api/catalogue'));
  assert.equal((await res.json()).count,320);
 }
 assert.equal(f.calls,8);
 await f.handler(new Request('https://test/api/catalogue',{method:'POST'}));
 assert.equal(f.data.games.length,640);assert.equal(f.data.nextPage,17);
});
test('failed batches preserve the last complete snapshot and shared cursor',async()=>{
 const f=fixture();await f.handler(new Request('https://test/api/catalogue',{method:'POST'}));f.fail();
 const res=await f.handler(new Request('https://test/api/catalogue',{method:'POST'}));
 assert.equal(res.status,503);assert.equal(f.data.nextPage,9);assert.equal(f.data.games.length,320);
});
test('concurrent requests cannot lose games or corrupt the cursor',async()=>{
 const f=fixture();
 await Promise.all([f.handler(new Request('https://test/api/catalogue',{method:'POST'})),f.handler(new Request('https://test/api/catalogue',{method:'POST'}))]);
 assert.equal(f.data.games.length,320);assert.equal(f.data.nextPage,9);
 assert.equal(new Set(f.data.games.map(g=>g.id)).size,320);
 assert.ok(f.data.games.every(g=>!('played' in g)&&!('seen' in g)));
});
