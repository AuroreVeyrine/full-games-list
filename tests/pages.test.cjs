const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
test('three pages have complete local links and one main heading',()=>{
 for(const file of ['index.html','catalogue.html','compte.html']){
  const html=fs.readFileSync(file,'utf8');
  assert.equal((html.match(/<h1\b/g)||[]).length,1,file);
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(ids.length,new Set(ids).size,'duplicate IDs in '+file);
  for(const [,url] of html.matchAll(/(?:href|src)="([^"]+)"/g)){
   if(/^(https?:|data:)/.test(url))continue;
   if(url.startsWith('#'))assert.ok(ids.includes(url.slice(1)),file+': '+url);
   else assert.ok(fs.existsSync(path.resolve(url)),file+': '+url);
  }
  assert.ok(html.includes('aria-current="page"'));
 }
});
test('account controls are isolated and each controller has its DOM targets',()=>{
 const home=fs.readFileSync('index.html','utf8');
 const catalog=fs.readFileSync('catalogue.html','utf8');
 assert.ok(!home.includes('authPassword')&&!catalog.includes('authPassword'));
 assert.ok(!home.includes('src="main.js"'));
 for(const [js,page] of [['main.js','catalogue.html'],['account.js','compte.html']]){
  const code=fs.readFileSync(js,'utf8'),html=fs.readFileSync(page,'utf8');
  for(const [,id] of code.matchAll(/\$\('([^']+)'\)/g))assert.ok(html.includes('id="'+id+'"'),js+' missing '+id);
 }
});
