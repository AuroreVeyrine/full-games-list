const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function setup(){
  const elements=new Map();
  const writes=[];let rejectCommit=false;let docs=[];
  const el=id=>{if(!elements.has(id))elements.set(id,{value:['genreFilter','platformFilter','yearFilter','statusFilter'].includes(id)?'all':id==='sortFilter'?'name-asc':'',checked:false,hidden:false,style:{},dataset:{},classList:{toggle(){}},addEventListener(){},scrollIntoView(){},close(){},textContent:'',innerHTML:''});return elements.get(id)};
  const context=vm.createContext({document:{getElementById:el},initializeApp:()=>({}),getAuth:()=>({}),getFirestore:()=>({}),collection:(...a)=>a,doc:(...a)=>a,serverTimestamp:()=>123,getDocs:async()=>({docs}),writeBatch:()=>{const pending=[];return{set:(ref,data)=>pending.push({ref,data}),commit:async()=>{if(rejectCommit)throw Error('offline');writes.push(...pending)}}},setDoc:async()=>{},deleteDoc:async()=>{},URL,console,Set,Map,setTimeout});
  const source=fs.readFileSync('main.js','utf8').replace(/^import .*;\n/gm,'').replace(/initialize\(\)\.catch\(.*\);\s*$/,'');
  vm.runInContext(source,context);
  const run=code=>vm.runInContext(code,context);
  run("catalog=Array.from({length:65},(_,i)=>upgradeGame({id:'rawg-'+i,name:'Game '+String(i).padStart(3,'0'),year:2000,genres:['Action'],platforms:['PC']}));rebuildCatalogIndex();currentUser={uid:'alice'};inventoryReady=true;");
  return{el,run,writes,fail:()=>rejectCommit=true,docs:value=>docs=value};
}
test('30 games per page, last page clamp, previous/next state',()=>{
  const h=setup();h.run('render()');assert.equal(h.run('visiblePageIds.length'),30);assert.equal(h.el('pageInfo').textContent,'Page 1 / 3');
  h.run('currentPage=3;render()');assert.equal(h.run('visiblePageIds.length'),5);assert.equal(h.el('nextPage').disabled,true);
});
test('mark visible page only, preserve played, hide seen, include on demand',async()=>{
  const h=setup();h.run("played.add('rawg-0');render()");await h.run('markPageSeen()');
  assert.equal(h.writes.length,30);assert.equal(h.writes[0].ref[2],'alice');assert.equal(h.writes[0].data.kind,'seen');
  assert.equal(h.run('played.size'),1);assert.equal(h.run('seen.size'),30);assert.equal(h.run('visiblePageIds[0]'),'rawg-30');
  h.el('showSeen').checked=true;h.run('render()');assert.equal(h.run('visiblePageIds[0]'),'rawg-0');assert.equal(h.el('markSeen').disabled,true);
});
test('failed batch never hides games',async()=>{
  const h=setup();h.run('render()');h.fail();await h.run('markPageSeen()');assert.equal(h.run('seen.size'),0);assert.equal(h.writes.length,0);assert.equal(h.run('reviewSaving'),false);
});
test('signed-out view clears private content and review controls',()=>{
  const h=setup();h.run('render();currentUser=null;render()');assert.equal(h.el('gamesGrid').innerHTML,'');assert.equal(h.el('reviewPanel').hidden,true);assert.equal(h.el('pagination').hidden,true);assert.equal(h.el('playedCount').textContent,'0');
});
test('restores typed seen records separately from legacy played records',async()=>{
  const h=setup();h.docs([{id:'rawg-4',data:()=>({gameId:'rawg-4'})},{id:'seen--rawg-0',data:()=>({kind:'seen',gameId:'rawg-0'})}]);
  await h.run("loadCloudPlayedGames({uid:'alice'},authEpoch)");assert.equal(h.run('played.size'),1);assert.equal(h.run('seen.size'),1);assert.equal(h.run("played.has('rawg-0')"),false);
});
test('stale account reads and in-flight writes cannot populate next account',async()=>{
  const h=setup();h.docs([{id:'rawg-4',data:()=>({gameId:'rawg-4'})}]);
  const read=h.run("loadCloudPlayedGames({uid:'alice'},authEpoch)");h.run('authEpoch++');await read;assert.equal(h.run('played.size'),0);
  h.run('render()');const write=h.run('markPageSeen()');h.run("authEpoch++;currentUser={uid:'bob'};seen=new Set()");await write;assert.equal(h.run('seen.size'),0);assert.equal(h.writes[0].ref[2],'alice');
});
