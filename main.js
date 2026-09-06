import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { getFirestore, collection, doc, getDocs, setDoc, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyBXx0T71B7YBDidXtqSCrS-jTY8laCD8H8',
  authDomain: 'gamevault-46985.firebaseapp.com',
  projectId: 'gamevault-46985',
  storageBucket: 'gamevault-46985.firebasestorage.app',
  messagingSenderId: '7861831338',
  appId: '1:7861831338:web:53cea16b93c678add2f2d3'
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const CATALOG_KEY = 'gamevault-catalog-v2';
const RAWG_PAGE_KEY = 'gamevault-rawg-next-page-v1';
const IMPORT_BATCH_PAGES = 10;
const $ = id => document.getElementById(id);

const demoGames = [
  ['Cyberpunk 2077',2020,'RPG','PC'],['The Last of Us',2013,'Action','PS3'],['Resident Evil 4',2005,'Horreur','PS2'],['Assassin’s Creed II',2009,'Action','PS3'],['The Legend of Zelda: Breath of the Wild',2017,'Aventure','Switch'],['Red Dead Redemption 2',2018,'Action','PS4'],['Minecraft',2011,'Sandbox','Multi'],['Mass Effect 2',2010,'RPG','Xbox 360'],['Star Wars Jedi: Fallen Order',2019,'Action','PS4'],['Dofus',2004,'MMORPG','PC'],['Silent Hill 2',2001,'Horreur','PS2'],['Final Fantasy VII',1997,'RPG','PS1'],['The Witcher 3: Wild Hunt',2015,'RPG','PC'],['God of War',2018,'Action','PS4'],['Portal 2',2011,'Puzzle','PC'],['Tomb Raider',1996,'Aventure','PS1'],['Hades',2020,'Roguelike','PC'],['Overwatch',2016,'FPS','PC'],['Beyond: Two Souls',2013,'Aventure','PS3'],['The Sims 4',2014,'Simulation','PC'],['Uncharted 4',2016,'Action','PS4'],['Celeste',2018,'Plateforme','PC'],['Detroit: Become Human',2018,'Aventure','PS4'],['Elden Ring',2022,'RPG','Multi']
].map(([name,year,genre,platform],index)=>({id:`demo-${index}-${name.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`,name,year,genre,platform}));

let catalog = loadCatalog();
let played = new Set();
let currentUser = null;
let currentPage = 1;

function loadCatalog(){try{return JSON.parse(localStorage.getItem(CATALOG_KEY))||demoGames}catch{return demoGames}}
function saveCatalog(){localStorage.setItem(CATALOG_KEY,JSON.stringify(catalog))}
function normalizeGame(game){return{id:`rawg-${game.id}`,name:game.name,year:(game.released||'').slice(0,4)||'—',genre:game.genres?.[0]?.name||'Non classé',platform:game.platforms?.[0]?.platform?.name||'Multi'}}
function escapeHtml(text){return String(text).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function values(field){return[...new Set(catalog.map(game=>game[field]).filter(value=>value&&value!=='—'))].sort((a,b)=>String(a).localeCompare(String(b),'fr',{numeric:true}))}
function gameDocumentId(id){return id.replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,140)}
function authMessage(message,error=false){$('authStatus').textContent=message;$('authStatus').style.color=error?'var(--pink)':'var(--green)'}
function setMessage(message,error=false){$('updateMessage').textContent=message;$('updateMessage').style.color=error?'var(--pink)':'var(--green)'}

function populateFilters(){['genre','platform','year'].forEach(field=>{const select=$(field+'Filter');const current=select.value;select.innerHTML=`<option value="all">${field==='genre'?'Tous les genres':field==='platform'?'Toutes les plateformes':'Toutes les années'}</option>`+values(field).map(value=>`<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');if(values(field).includes(current))select.value=current})}

function filteredGames(){const search=$('searchInput').value.toLowerCase().trim();const genre=$('genreFilter').value;const platform=$('platformFilter').value;const year=$('yearFilter').value;const status=$('statusFilter').value;return catalog.filter(game=>(!search||game.name.toLowerCase().includes(search))&&(genre==='all'||game.genre===genre)&&(platform==='all'||game.platform===platform)&&(year==='all'||String(game.year)===year)&&(status==='all'||status==='played'&&played.has(game.id)||status==='unplayed'&&!played.has(game.id)))}

function gameCard(game){const isPlayed=played.has(game.id);return`<article class="game-card ${isPlayed?'played':''}"><div class="game-art"><span class="platform-chip">${escapeHtml(game.platform)}</span></div><div class="game-info"><h3 class="game-title">${escapeHtml(game.name)}</h3><div class="game-meta">${escapeHtml(game.genre)}</div><div class="game-actions"><label class="check-label"><input type="checkbox" data-id="${escapeHtml(game.id)}" ${isPlayed?'checked':''}> J’ai joué</label><span class="game-year">${escapeHtml(game.year)}</span></div></div></article>`}

function render(){const section=$('catalogue');const connected=Boolean(currentUser);section.classList.toggle('is-locked',!connected);$('loginGate').hidden=connected;if(!connected){$('gamesGrid').innerHTML='';$('playedCount').textContent='0';$('visibleCount').textContent='0';$('totalCount').textContent='0';$('completionPercent').textContent='0%';$('completionBar').style.width='0%';return}const filtered=filteredGames();const pageSize=Number($('pageSize').value);const totalPages=Math.max(1,Math.ceil(filtered.length/pageSize));currentPage=Math.min(currentPage,totalPages);const pageGames=filtered.slice((currentPage-1)*pageSize,currentPage*pageSize);$('gamesGrid').innerHTML=pageGames.map(gameCard).join('');$('emptyState').hidden=filtered.length>0;$('pagination').hidden=filtered.length<=pageSize;$('previousPage').disabled=currentPage===1;$('nextPage').disabled=currentPage===totalPages;$('pageInfo').textContent=`Page ${currentPage} / ${totalPages}`;$('resultSummary').textContent=`${filtered.length} résultat${filtered.length!==1?'s':''} • ${pageGames.length} affiché${pageGames.length!==1?'s':''}`;$('visibleCount').textContent=pageGames.length;$('totalCount').textContent=catalog.length;$('playedCount').textContent=played.size;const percent=catalog.length?Math.round(played.size/catalog.length*100):0;$('completionPercent').textContent=percent+'%';$('completionBar').style.width=Math.min(percent,100)+'%'}

async function loadCloudPlayedGames(user){const snapshot=await getDocs(collection(db,'users',user.uid,'playedGames'));played=new Set(snapshot.docs.map(item=>item.data().gameId||item.id));render()}
async function syncPlayedGame(id,isPlayed){const reference=doc(db,'users',currentUser.uid,'playedGames',gameDocumentId(id));if(isPlayed)await setDoc(reference,{gameId:id,updatedAt:serverTimestamp()},{merge:true});else await deleteDoc(reference)}

async function updateFromRawg(){if(!currentUser){setMessage('Connecte-toi avant d’importer des jeux.',true);return}const button=$('refreshButton');button.disabled=true;button.innerHTML='<span>↻</span> Import en cours...';let page=Math.max(1,Number(localStorage.getItem(RAWG_PAGE_KEY))||1);let imported=0;try{for(let batch=0;batch<IMPORT_BATCH_PAGES;batch++){setMessage(`Import RAWG : page ${page}...`);const response=await fetch(`/.netlify/functions/rawg-games?page=${page}&page_size=40`);const data=await response.json();if(!response.ok)throw new Error(data.error||'API indisponible');const games=(data.results||[]).map(normalizeGame);imported+=games.length;const unique=new Map(catalog.map(game=>[game.name.toLowerCase()+'-'+game.year,game]));games.forEach(game=>unique.set(game.name.toLowerCase()+'-'+game.year,game));catalog=[...unique.values()];page+=1;localStorage.setItem(RAWG_PAGE_KEY,String(page));if(!data.next)break}saveCatalog();populateFilters();currentPage=1;render();$('apiStatus').textContent='✓ Clé RAWG active dans Netlify.';$('apiStatus').style.color='var(--green)';setMessage(`${imported} jeux importés. Catalogue actuel : ${catalog.length} jeux.`)}catch(error){$('apiStatus').textContent='✕ Configure RAWG_API_KEY dans Netlify, puis redéploie le site.';$('apiStatus').style.color='var(--pink)';setMessage(error.message,true)}finally{button.disabled=false;button.innerHTML='<span>↻</span> Importer plus de jeux'}}

function credentials(){return{email:$('authEmail').value.trim(),password:$('authPassword').value}}
async function createAccount(){const{email,password}=credentials();if(!email||password.length<6){authMessage('Entre un courriel et un mot de passe de 6 caractères minimum.',true);return}try{await createUserWithEmailAndPassword(auth,email,password)}catch(error){authMessage(error.code==='auth/email-already-in-use'?'Ce courriel possède déjà un compte.':'Création du compte impossible.',true)}}
async function connectAccount(){const{email,password}=credentials();if(!email||!password){authMessage('Entre ton courriel et ton mot de passe.',true);return}try{await signInWithEmailAndPassword(auth,email,password)}catch{authMessage('Connexion impossible. Vérifie tes informations.',true)}}

$('gamesGrid').addEventListener('change',async event=>{if(!event.target.matches('input[type="checkbox"]')||!currentUser)return;const id=event.target.dataset.id;const isPlayed=event.target.checked;isPlayed?played.add(id):played.delete(id);render();try{await syncPlayedGame(id,isPlayed);authMessage(`✓ Inventaire synchronisé : ${played.size} jeu${played.size!==1?'x':''}`)}catch{isPlayed?played.delete(id):played.add(id);render();authMessage('La synchronisation a échoué. La modification a été annulée.',true)}});
['searchInput','genreFilter','platformFilter','yearFilter','statusFilter'].forEach(id=>$(id).addEventListener('input',()=>{currentPage=1;render()}));
$('pageSize').addEventListener('change',()=>{currentPage=1;render()});
$('previousPage').addEventListener('click',()=>{if(currentPage>1){currentPage-=1;render();$('catalogue').scrollIntoView()}});
$('nextPage').addEventListener('click',()=>{currentPage+=1;render();$('catalogue').scrollIntoView()});
$('resetFilters').addEventListener('click',()=>{$('filters').reset();currentPage=1;render()});
$('refreshButton').addEventListener('click',updateFromRawg);
$('signUpButton').addEventListener('click',createAccount);
$('signInButton').addEventListener('click',connectAccount);
$('signOutButton').addEventListener('click',()=>signOut(auth));

onAuthStateChanged(auth,async user=>{currentUser=user;played=new Set();$('signOutButton').hidden=!user;$('signInButton').hidden=Boolean(user);$('signUpButton').hidden=Boolean(user);$('authEmail').disabled=Boolean(user);$('authPassword').disabled=Boolean(user);$('syncStatus').className=`top-status ${user?'is-cloud':'is-offline'}`;$('syncStatus').innerHTML=`<span class="status-dot"></span> ${user?'FIREBASE SYNC ACTIVE':'CONNEXION REQUISE'}`;if(user){$('authEmail').value=user.email||'';$('authPassword').value='';authMessage(`Connexion : ${user.email}`);try{await loadCloudPlayedGames(user);authMessage(`✓ Inventaire privé synchronisé : ${played.size} jeu${played.size!==1?'x':''}`)}catch{authMessage('Connectée, mais Firestore refuse l’accès. Vérifie les règles.',true)}}else{authMessage('Non connecté — aucun inventaire n’est affiché.');render()}});

populateFilters();
render();
