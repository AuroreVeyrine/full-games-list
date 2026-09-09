import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { getFirestore, collection, doc, getDocs, writeBatch, setDoc, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const firebaseApp = initializeApp({apiKey:'AIzaSyBXx0T71B7YBDidXtqSCrS-jTY8laCD8H8',authDomain:'gamevault-46985.firebaseapp.com',projectId:'gamevault-46985',storageBucket:'gamevault-46985.firebasestorage.app',messagingSenderId:'7861831338',appId:'1:7861831338:web:53cea16b93c678add2f2d3'});
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const DB_NAME = 'gamevault-catalog-db';
const STORE_NAME = 'games';
const RAWG_PAGE_KEY = 'gamevault-rawg-next-page-v2';
const TARGET_CATALOG_SIZE = 10000;
const MAX_REQUESTS_PER_IMPORT = 300;
const PAGE_SIZE = 32;
const $ = id => document.getElementById(id);

const demoGames = [
  ['Cyberpunk 2077',2020,'RPG','PC'],['The Last of Us',2013,'Action','PS3'],['Resident Evil 4',2005,'Horreur','PS2'],['Assassin’s Creed II',2009,'Action','PS3'],['The Legend of Zelda: Breath of the Wild',2017,'Aventure','Switch'],['Red Dead Redemption 2',2018,'Action','PS4'],['Minecraft',2011,'Sandbox','Multi'],['Mass Effect 2',2010,'RPG','Xbox 360'],['Star Wars Jedi: Fallen Order',2019,'Action','PS4'],['Dofus',2004,'MMORPG','PC'],['Silent Hill 2',2001,'Horreur','PS2'],['Final Fantasy VII',1997,'RPG','PS1'],['The Witcher 3: Wild Hunt',2015,'RPG','PC'],['God of War',2018,'Action','PS4'],['Portal 2',2011,'Puzzle','PC'],['Tomb Raider',1996,'Aventure','PS1'],['Hades',2020,'Roguelike','PC'],['Overwatch',2016,'FPS','PC'],['Beyond: Two Souls',2013,'Aventure','PS3'],['The Sims 4',2014,'Simulation','PC'],['Uncharted 4',2016,'Action','PS4'],['Celeste',2018,'Plateforme','PC'],['Detroit: Become Human',2018,'Aventure','PS4'],['Elden Ring',2022,'RPG','Multi']
].map(([name,year,genre,platform],index)=>({id:`demo-${index}-${name.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`,name,year,released:String(year),genre,genres:[genre],platform,platforms:[platform],image:'',rating:0,ratingsCount:0,metacritic:null,playtime:0,esrb:'Non classé',stores:[],screenshots:[]}));

let catalog = [];
let catalogById = new Map();
let played = new Set();
let seen = new Set();
let visiblePageIds = [];
let reviewSaving = false;
let inventoryReady = false;
let authEpoch = 0;
const pendingPlayed = new Set();
let currentUser = null;
let currentPage = 1;
let importing = false;
let cancelImport = false;

function openDatabase(){return new Promise((resolve,reject)=>{const request=indexedDB.open(DB_NAME,1);request.onupgradeneeded=()=>{const database=request.result;if(!database.objectStoreNames.contains(STORE_NAME))database.createObjectStore(STORE_NAME,{keyPath:'id'})};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})}
async function readCatalog(){const database=await openDatabase();return new Promise((resolve,reject)=>{const request=database.transaction(STORE_NAME,'readonly').objectStore(STORE_NAME).getAll();request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})}
async function saveGames(games){if(!games.length)return;const database=await openDatabase();return new Promise((resolve,reject)=>{const transaction=database.transaction(STORE_NAME,'readwrite');const store=transaction.objectStore(STORE_NAME);games.forEach(game=>store.put(game));transaction.oncomplete=resolve;transaction.onerror=()=>reject(transaction.error)})}
async function initializeCatalog(){let stored=await readCatalog();if(!stored.length){for(const key of ['gamevault-catalog-v2','gamevault-catalog-v1']){try{const legacy=JSON.parse(localStorage.getItem(key)||'[]');if(legacy.length){stored=legacy.map(upgradeGame);break}}catch{}}}if(!stored.length)stored=demoGames;catalog=stored.map(upgradeGame);rebuildCatalogIndex();await saveGames(catalog)}
function rebuildCatalogIndex(){catalogById=new Map(catalog.map(game=>[game.id,game]))}
function upgradeGame(game){const genre=game.genre||game.genres?.[0]?.name||game.genres?.[0]||'Non classé';const platform=game.platform||game.platforms?.[0]?.platform?.name||game.platforms?.[0]||'Multi';return{...game,genres:(game.genres||[genre]).map(item=>item?.name||item),platforms:(game.platforms||[platform]).map(item=>item?.platform?.name||item),genre,platform,image:game.image||game.background_image||'',rating:Number(game.rating)||0,ratingsCount:Number(game.ratingsCount||game.ratings_count)||0,metacritic:game.metacritic??null,playtime:Number(game.playtime)||0,esrb:game.esrb||game.esrb_rating?.name||'Non classé',stores:game.stores||[],screenshots:game.screenshots||game.short_screenshots||[]}}
function normalizeGame(game){return upgradeGame({id:`rawg-${game.id}`,rawgId:game.id,name:game.name,released:game.released||'',year:(game.released||'').slice(0,4)||'—',genres:(game.genres||[]).map(item=>item.name),platforms:(game.platforms||[]).map(item=>item.platform.name),image:game.background_image||'',rating:game.rating,ratingsCount:game.ratings_count,metacritic:game.metacritic,playtime:game.playtime,esrb:game.esrb_rating?.name||'Non classé',stores:(game.stores||[]).map(item=>item.store?.name).filter(Boolean),screenshots:(game.short_screenshots||[]).map(item=>item.image).filter(Boolean)})}
function escapeHtml(text){return String(text??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function safeUrl(url){try{const parsed=new URL(url);return['http:','https:'].includes(parsed.protocol)?parsed.href:''}catch{return''}}
function gameDocumentId(id){return id.replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,140)}
function authMessage(message,error=false){$('authStatus').textContent=message;$('authStatus').style.color=error?'var(--pink)':'var(--green)'}
function setMessage(message,error=false){$('updateMessage').textContent=message;$('updateMessage').style.color=error?'var(--pink)':'var(--green)'}
function uniqueValues(field){const source=field==='genres'?catalog.flatMap(game=>game.genres):field==='platforms'?catalog.flatMap(game=>game.platforms):catalog.map(game=>game[field]);return[...new Set(source.filter(value=>value&&value!=='—'))].sort((a,b)=>String(a).localeCompare(String(b),'fr',{numeric:true}))}
function populateFilters(){[['genreFilter','genres','Tous les genres'],['platformFilter','platforms','Toutes les plateformes'],['yearFilter','year','Toutes les années']].forEach(([id,field,label])=>{const select=$(id);const current=select.value;const options=uniqueValues(field);select.innerHTML=`<option value="all">${label}</option>`+options.map(value=>`<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');if(options.map(String).includes(current))select.value=current})}

function filteredAndSortedGames(){const search=$('searchInput').value.toLowerCase().trim();const genre=$('genreFilter').value;const platform=$('platformFilter').value;const year=$('yearFilter').value;const status=$('statusFilter').value;const sort=$('sortFilter').value;const games=catalog.filter(game=>($('showSeen').checked||!seen.has(game.id))&&(!search||game.name.toLowerCase().includes(search))&&(genre==='all'||game.genres.includes(genre))&&(platform==='all'||game.platforms.includes(platform))&&(year==='all'||String(game.year)===year)&&(status==='all'||status==='played'&&played.has(game.id)||status==='unplayed'&&!played.has(game.id)));const byName=(a,b)=>a.name.localeCompare(b.name,'fr',{sensitivity:'base'});const sorters={'name-asc':byName,'name-desc':(a,b)=>byName(b,a),'year-desc':(a,b)=>(Number(b.year)||0)-(Number(a.year)||0)||byName(a,b),'year-asc':(a,b)=>(Number(a.year)||9999)-(Number(b.year)||9999)||byName(a,b),'rating-desc':(a,b)=>b.rating-a.rating||byName(a,b),'metacritic-desc':(a,b)=>(b.metacritic||0)-(a.metacritic||0)||byName(a,b),'playtime-desc':(a,b)=>b.playtime-a.playtime||byName(a,b),'played-first':(a,b)=>Number(played.has(b.id))-Number(played.has(a.id))||byName(a,b)};return games.sort(sorters[sort]||byName)}
function coverMarkup(game){return game.image?`<img class="game-cover" src="${escapeHtml(safeUrl(game.image))}" alt="Jaquette de ${escapeHtml(game.name)}" loading="lazy">`:''}
function gameCard(game){const isPlayed=played.has(game.id);return`<article class="game-card ${isPlayed?'played':''}" data-game-id="${escapeHtml(game.id)}"><div class="game-art">${coverMarkup(game)}${seen.has(game.id)?'<span class="seen-badge">✓ VU</span>':''}<span class="platform-chip">${escapeHtml(game.platform)}</span></div><div class="game-info"><h3 class="game-title">${escapeHtml(game.name)}</h3><div class="game-meta">${escapeHtml(game.genres.slice(0,2).join(' • '))}</div><div class="game-badges">${game.rating?`<span class="game-badge">★ ${game.rating.toFixed(1)}</span>`:''}${game.metacritic?`<span class="game-badge">MC ${game.metacritic}</span>`:''}${game.playtime?`<span class="game-badge">${game.playtime} h</span>`:''}</div><button class="details-button" type="button" data-details-id="${escapeHtml(game.id)}">Voir la fiche +</button><div class="game-actions"><label class="check-label"><input type="checkbox" data-id="${escapeHtml(game.id)}" ${isPlayed?'checked':''} ${pendingPlayed.has(game.id)?'disabled':''}> J’ai joué</label><span class="game-year">${escapeHtml(game.year)}</span></div></div></article>`}

function render(){const connected=Boolean(currentUser)&&inventoryReady;const playedFilter=$('playedGamesFilter');$('catalogue').classList.toggle('is-locked',!connected);$('loginGate').hidden=connected;playedFilter.disabled=!connected;playedFilter.setAttribute('aria-pressed',String(connected&&$('statusFilter').value==='played'));if(!connected){visiblePageIds=[];$('reviewPanel').hidden=true;$('pagination').hidden=true;$('seenCount').textContent='0 jeu examiné';$('resultSummary').textContent='';$('gamesGrid').innerHTML='';['playedCount','visibleCount','totalCount'].forEach(id=>$(id).textContent='0');$('completionPercent').textContent='0%';$('completionBar').style.width='0%';return}const filtered=filteredAndSortedGames();const totalPages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));currentPage=Math.min(currentPage,totalPages);const pageGames=filtered.slice((currentPage-1)*PAGE_SIZE,currentPage*PAGE_SIZE);visiblePageIds=pageGames.map(game=>game.id);$('gamesGrid').innerHTML=pageGames.map(gameCard).join('');$('reviewPanel').hidden=!pageGames.length;$('markSeen').disabled=reviewSaving||pendingPlayed.size>0||!visiblePageIds.some(id=>!seen.has(id));$('markSeen').textContent=reviewSaving?'Sauvegarde…':'✓ Noter comme vu';$('seenCount').textContent=`${seen.size.toLocaleString('fr')} jeu${seen.size>1?'x':''} examiné${seen.size>1?'s':''}`;$('emptyState').hidden=filtered.length>0;$('pagination').hidden=!filtered.length;$('previousPage').disabled=currentPage===1;$('nextPage').disabled=currentPage===totalPages;$('pageInfo').textContent=`Page ${currentPage} / ${totalPages}`;$('resultSummary').textContent=`${filtered.length} résultat${filtered.length!==1?'s':''} • ${pageGames.length} affiché${pageGames.length!==1?'s':''}`;$('visibleCount').textContent=pageGames.length;$('totalCount').textContent=catalog.length;$('playedCount').textContent=played.size;const percent=catalog.length?Math.round(played.size/catalog.length*100):0;$('completionPercent').textContent=percent+'%';$('completionBar').style.width=Math.min(percent,100)+'%'}

function showPlayedGames(){
  if(!currentUser||!inventoryReady)return;
  $('filters').reset();
  $('statusFilter').value='played';
  $('showSeen').checked=true;
  currentPage=1;
  render();
  $('catalogue').scrollIntoView();
}

async function loadCloudPlayedGames(user,epoch){
  const snapshot=await getDocs(collection(db,'users',user.uid,'playedGames'));
  if(epoch!==authEpoch)return;
  const cloudGames=[];played=new Set();seen=new Set();
  snapshot.docs.forEach(item=>{
    const data=item.data();
    // Separate typed records preserve compatibility with the existing owner-only rules.
    if(data.kind==='seen'){seen.add(data.gameId);return;}
    played.add(data.gameId||item.id);
    if(data.game?.id)cloudGames.push(upgradeGame(data.game));
  });
  for(const game of cloudGames)if(!catalogById.has(game.id))catalog.push(game);
  rebuildCatalogIndex();inventoryReady=true;populateFilters();render();
  if(cloudGames.length)saveGames(cloudGames).catch(()=>{});
}
async function markPageSeen(){
  if(!currentUser||!inventoryReady||reviewSaving||pendingPlayed.size)return;
  const epoch=authEpoch,uid=currentUser.uid;
  const ids=visiblePageIds.filter(id=>!seen.has(id));
  if(!ids.length)return;
  reviewSaving=true;render();$('reviewMessage').textContent='Enregistrement de cette page…';
  try{
    const batch=writeBatch(db);
    ids.forEach(id=>batch.set(doc(db,'users',uid,'playedGames','seen--'+gameDocumentId(id)),{kind:'seen',gameId:id,updatedAt:serverTimestamp()}));
    await batch.commit();
    if(epoch!==authEpoch)return;
    ids.forEach(id=>seen.add(id));
    $('reviewMessage').textContent=`✓ ${ids.length} jeux marqués comme vus et sauvegardés sur ton compte.`;
    setMessage(`✓ Progression sauvegardée : ${seen.size} jeux examinés. Tes jeux joués sont conservés.`);
  }catch{
    if(epoch===authEpoch)$('reviewMessage').textContent='Sauvegarde impossible. Aucun jeu masqué : réessaie avec une connexion.';
  }finally{
    if(epoch===authEpoch){reviewSaving=false;render();if(ids.every(id=>seen.has(id)))$('catalogue').scrollIntoView();}
  }
}
async function syncPlayedGame(game,isPlayed,uid){const reference=doc(db,'users',uid,'playedGames',gameDocumentId(game.id));if(isPlayed){const snapshot={id:game.id,rawgId:game.rawgId||null,name:game.name,year:game.year,released:game.released||'',genre:game.genre,genres:game.genres,platform:game.platform,platforms:game.platforms,image:game.image||'',rating:game.rating||0,metacritic:game.metacritic??null,playtime:game.playtime||0,esrb:game.esrb||'Non classé'};await setDoc(reference,{gameId:game.id,game:snapshot,updatedAt:serverTimestamp()},{merge:true})}else await deleteDoc(reference)}

async function loadSharedCatalogue(extend=false){
 const response=await fetch('/api/catalogue',{method:extend?'POST':'GET',cache:'no-store'});
 const data=await response.json();
 if(!response.ok)throw Error(data.error||'Catalogue partagé indisponible.');
 const merged=new Map(catalog.map(game=>[game.id,game]));
 for(const game of data.games||[])merged.set(game.id,{...merged.get(game.id),...upgradeGame(game)});
 // Drop demo fillers only; preserve legacy metadata and every personal record.
 if(data.games?.length)for(const id of merged.keys())if(id.startsWith('demo-')&&!played.has(id))merged.delete(id);
 catalog=[...merged.values()];rebuildCatalogIndex();populateFilters();render();
 saveGames(catalog).catch(()=>{});
 return data;
}
async function updateFromRawg(){
 if(importing||!currentUser)return;
 importing=true;$('refreshButton').disabled=true;
 setMessage('Mise à jour du catalogue commun…');
 try{
  const data=await loadSharedCatalogue(true);
  setMessage(data.complete?'Catalogue commun synchronisé : '+data.count.toLocaleString('fr')+' jeux.':data.count.toLocaleString('fr')+' jeux disponibles pour tous. La prochaine mise à jour reprendra ici.');
  $('apiStatus').textContent='Catalogue partagé • progression personnelle privée.';
 }catch(error){setMessage(error.message,true);}
 finally{importing=false;$('refreshButton').disabled=false;$('refreshButton').textContent='Actualiser le catalogue';}
}

function modalHtml(game,details=null){const data=details||game;const image=safeUrl(data.background_image||game.image);const genres=(data.genres||game.genres||[]).map(item=>item?.name||item);const platforms=(data.platforms||game.platforms||[]).map(item=>item?.platform?.name||item);const developers=(data.developers||[]).map(item=>item.name).join(', ');const publishers=(data.publishers||[]).map(item=>item.name).join(', ');const description=data.description_raw||'Aucune description détaillée disponible.';const website=safeUrl(data.website);return`${image?`<img class="modal-cover" src="${escapeHtml(image)}" alt="Illustration de ${escapeHtml(game.name)}">`:''}<div class="modal-body"><span class="modal-meta">${escapeHtml((data.released||game.released||'Date inconnue'))} // ${escapeHtml(platforms.join(', ')||'Plateforme inconnue')}</span><h2>${escapeHtml(game.name)}</h2><div class="modal-grid"><div><b>GENRES</b>${escapeHtml(genres.join(', ')||'Non classé')}</div><div><b>NOTE RAWG</b>${Number(data.rating||game.rating||0).toFixed(1)} / 5</div><div><b>METACRITIC</b>${escapeHtml(data.metacritic??game.metacritic??'—')}</div><div><b>DURÉE MOYENNE</b>${escapeHtml(data.playtime||game.playtime||'—')} h</div><div><b>CLASSIFICATION</b>${escapeHtml(data.esrb_rating?.name||game.esrb||'Non classé')}</div><div><b>STUDIO</b>${escapeHtml(developers||publishers||'Non renseigné')}</div></div><p class="modal-description">${escapeHtml(description).replace(/\n/g,'<br>')}</p><div class="modal-links">${website?`<a class="button button-primary" href="${escapeHtml(website)}" target="_blank" rel="noreferrer">Site officiel ↗</a>`:''}<a class="button button-ghost" href="https://rawg.io/games/${encodeURIComponent(data.slug||game.rawgId||'')}" target="_blank" rel="noreferrer">Voir sur RAWG ↗</a></div></div>`}
async function openGameDetails(id){const game=catalogById.get(id);if(!game)return;$('gameModal').dataset.gameId=id;$('modalContent').innerHTML=modalHtml(game,game.details);$('gameModal').showModal();if(!game.rawgId||game.details)return;try{const response=await fetch(`/api/rawg?id=${encodeURIComponent(game.rawgId)}`);const data=await response.json();if(!response.ok)return;game.details={slug:data.slug||'',background_image:data.background_image||game.image,released:data.released||game.released,genres:data.genres||[],platforms:data.platforms||[],developers:data.developers||[],publishers:data.publishers||[],description_raw:data.description_raw||'',website:data.website||'',rating:data.rating||game.rating,metacritic:data.metacritic??game.metacritic,playtime:data.playtime||game.playtime,esrb_rating:data.esrb_rating||null};await saveGames([game]);if(currentUser&&$('gameModal').open&&$('gameModal').dataset.gameId===id)$('modalContent').innerHTML=modalHtml(game,game.details)}catch{}}

$('gamesGrid').addEventListener('change',async event=>{
  if(!event.target.matches('input[type="checkbox"]')||!currentUser||!inventoryReady)return;
  const game=catalogById.get(event.target.dataset.id);
  if(!game||pendingPlayed.has(game.id))return;
  const epoch=authEpoch,uid=currentUser.uid,isPlayed=event.target.checked;
  pendingPlayed.add(game.id);isPlayed?played.add(game.id):played.delete(game.id);render();
  try{await syncPlayedGame(game,isPlayed,uid);if(epoch===authEpoch)authMessage(`✓ Inventaire synchronisé : ${played.size} jeux`);}
  catch{if(epoch===authEpoch){isPlayed?played.delete(game.id):played.add(game.id);authMessage('La synchronisation a échoué. La modification a été annulée.',true);}}
  finally{if(epoch===authEpoch){pendingPlayed.delete(game.id);render();}}
});
$('gamesGrid').addEventListener('click',event=>{const button=event.target.closest('[data-details-id]');if(button)openGameDetails(button.dataset.detailsId)});
['searchInput','genreFilter','platformFilter','yearFilter','statusFilter','sortFilter'].forEach(id=>$(id).addEventListener('input',()=>{currentPage=1;render()}));
$('showSeen').addEventListener('change',()=>{currentPage=1;render()});
$('playedGamesFilter').addEventListener('click',showPlayedGames);
$('markSeen').addEventListener('click',markPageSeen);
$('filters').addEventListener('submit',event=>event.preventDefault());
$('previousPage').addEventListener('click',()=>{if(currentPage>1){currentPage-=1;render();$('catalogue').scrollIntoView()}});
$('nextPage').addEventListener('click',()=>{currentPage+=1;render();$('catalogue').scrollIntoView()});
$('resetFilters').addEventListener('click',()=>{$('filters').reset();$('showSeen').checked=false;currentPage=1;render()});
$('refreshButton').addEventListener('click',updateFromRawg);
$('closeModal').addEventListener('click',()=>$('gameModal').close());
$('gameModal').addEventListener('click',event=>{if(event.target===$('gameModal'))$('gameModal').close()});

async function initialize(){try{await initializeCatalog();}catch{catalog=[];rebuildCatalogIndex();}populateFilters();render();onAuthStateChanged(auth,async user=>{const epoch=++authEpoch;currentUser=user;inventoryReady=false;played=new Set();seen=new Set();pendingPlayed.clear();reviewSaving=false;currentPage=1;cancelImport=true;$('showSeen').checked=false;$('reviewMessage').textContent='';if($('gameModal').open)$('gameModal').close();render();$('syncStatus').className=`top-status ${user?'is-cloud':'is-offline'}`;$('syncStatus').innerHTML=`<span class="status-dot"></span> ${user?'FIREBASE SYNC ACTIVE':'CONNEXION REQUISE'}`;if(user){authMessage(`Connexion : ${user.email}`);try{await loadCloudPlayedGames(user,epoch);if(epoch!==authEpoch)return;authMessage(`✓ Inventaire privé synchronisé : ${played.size} jeu${played.size!==1?'x':''}`);try{const shared=await loadSharedCatalogue();if(epoch!==authEpoch)return;setMessage(shared.count?shared.count.toLocaleString('fr')+' jeux dans le catalogue commun.':'Le catalogue commun est en cours de préparation.');}catch(error){if(epoch===authEpoch)setMessage(error.message,true);}}catch{if(epoch!==authEpoch)return;authMessage('Connectée, mais Firestore refuse l’accès. Vérifie les règles.',true)}}else{if($('gameModal').open)$('gameModal').close();authMessage('Non connecté — aucun inventaire n’est affiché.');render()}})}

initialize().catch(()=>setMessage('Impossible d’ouvrir la base locale du catalogue.',true));
