import {getStore} from '@netlify/blobs';
import {gzipSync} from 'node:zlib';

export function normalize(game){
 const genres=(game.genres||[]).map(g=>g.name);
 const platforms=(game.platforms||[]).map(p=>p.platform.name);
 return {id:'rawg-'+game.id,rawgId:game.id,name:game.name,year:(game.released||'').slice(0,4)||'—',
 released:game.released||'',genre:genres[0]||'Non classé',genres,platform:platforms[0]||'Multi',platforms,
 image:game.background_image||'',rating:game.rating||0,ratingsCount:game.ratings_count||0,
 metacritic:game.metacritic??null,playtime:game.playtime||0,esrb:game.esrb_rating?.name||'Non classé',
 stores:(game.stores||[]).map(s=>s.store?.name).filter(Boolean),screenshots:[]};
}
const empty=()=>({games:[],nextPage:1,exhausted:false,updatedAt:null});
export function createHandler({storeFactory,fetcher=fetch,key=()=>Netlify.env.get('RAWG_API_KEY')}){
 return async request=>{
  if(!['GET','POST'].includes(request.method))return Response.json({error:'Method not allowed'},{status:405});
  const send=(data,status=200)=>{
   const json=JSON.stringify(data);
   const zipped=/gzip/.test(request.headers.get('accept-encoding')||'');
   return new Response(zipped?gzipSync(json):json,{status,headers:{
    'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
    'Vary':'Accept-Encoding',...(zipped?{'Content-Encoding':'gzip'}:{})}});
  };
  try{
   const store=storeFactory();
   const saved=await store.getWithMetadata('snapshot',{type:'json'});
   let state=saved?.data||empty();
   if(request.method==='POST'&&!state.exhausted&&state.games.length<10000){
    const apiKey=key();if(!apiKey)return send({error:'La clé RAWG serveur est absente.'},503);
    const games=new Map(state.games.map(g=>[g.id,g]));
    let page=state.nextPage,exhausted=false;
    // One bounded server batch, shared by every browser; never accept client game data.
    for(let i=0;i<8&&games.size<10000;i++){
     const url=new URL('https://api.rawg.io/api/games');
     url.search=new URLSearchParams({key:apiKey,page:String(page),page_size:'40',ordering:'-added'}).toString();
     const response=await fetcher(url,{signal:AbortSignal.timeout(5000)});
     if(!response.ok)throw Error('RAWG indisponible ('+response.status+'). Réessaie.');
     const data=await response.json();
     if(!Array.isArray(data.results))throw Error('Réponse RAWG invalide.');
     for(const raw of data.results)if(raw.id&&raw.name)games.set('rawg-'+raw.id,normalize(raw));
     page++;if(!data.next){exhausted=true;break;}
    }
    const next={games:[...games.values()],nextPage:page,exhausted,updatedAt:new Date().toISOString()};
    const result=await store.setJSON('snapshot',next,saved?{onlyIfMatch:saved.etag}:{onlyIfNew:true});
    // Concurrent batches cannot rewind or overwrite a newer catalogue.
    state=result.modified?next:(await store.get('snapshot',{type:'json'}))||state;
   }
   return send({...state,count:state.games.length,complete:state.exhausted||state.games.length>=10000});
  }catch(error){return send({error:error.message==='The operation was aborted due to timeout'?'RAWG répond trop lentement. Réessaie.': 'Catalogue partagé temporairement indisponible. Réessaie.'},503);}
 };
}
export default createHandler({storeFactory:()=>getStore({name:'pixel-memories-catalogue-v1',consistency:'strong'})});
export const config={path:'/api/catalogue',rateLimit:{windowLimit:80,windowSize:60,aggregateBy:['domain']}};
