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
let currentUser = null;

const STORAGE_KEY = 'gamevault-played-v1';
const CATALOG_KEY = 'gamevault-catalog-v1';
const RAWG_KEY = 'gamevault-rawg-key';

const demoGames = [
  ['Cyberpunk 2077',2020,'RPG','PC'],['The Last of Us',2013,'Action','PS3'],['Resident Evil 4',2005,'Horreur','PS2'],['Assassin’s Creed II',2009,'Action','PS3'],['Interstellar: Space',2014,'Simulation','PC'],['The Legend of Zelda: Breath of the Wild',2017,'Aventure','Switch'],['Red Dead Redemption 2',2018,'Action','PS4'],['Minecraft',2011,'Sandbox','Multi'],['Mass Effect 2',2010,'RPG','Xbox 360'],['Star Wars Jedi: Fallen Order',2019,'Action','PS4'],['Dofus',2004,'MMORPG','PC'],['Silent Hill 2',2001,'Horreur','PS2'],['Final Fantasy VII',1997,'RPG','PS1'],['The Witcher 3: Wild Hunt',2015,'RPG','PC'],['God of War',2018,'Action','PS4'],['Portal 2',2011,'Puzzle','PC'],['Tomb Raider',1996,'Aventure','PS1'],['Hades',2020,'Roguelike','PC'],['Overwatch',2016,'FPS','PC'],['Beyond: Two Souls',2013,'Aventure','PS3'],['The Sims 4',2014,'Simulation','PC'],['Uncharted 4',2016,'Action','PS4'],['Celeste',2018,'Plateforme','PC'],['Detroit: Become Human',2018,'Aventure','PS4']
].map(([name,year,genre,platform], index) => ({id:`demo-${index}-${name.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`,name,year,genre,platform}));

let catalog = loadCatalog();
let played = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));
const $ = id => document.getElementById(id);

function authMessage(message, error = false){const el=$('authStatus');el.textContent=message;el.style.color=error?'var(--pink)':'var(--green)'}
function authCredentials(){return {email:$('authEmail').value.trim(),password:$('authPassword').value}}
function gameDocumentId(id){return id.replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,140)}
async function loadCloudPlayedGames(user){const snapshot=await getDocs(collection(db,'users',user.uid,'playedGames'));const cloudIds=new Set(snapshot.docs.map(item=>item.data().gameId||item.id));played=new Set([...played,...cloudIds]);saveState();for(const id of played){await setDoc(doc(db,'users',user.uid,'playedGames',gameDocumentId(id)),{gameId:id,updatedAt:serverTimestamp()},{merge:true})}render()}
async function syncPlayedGame(id,isPlayed){if(!currentUser)return;const reference=doc(db,'users',currentUser.uid,'playedGames',gameDocumentId(id));if(isPlayed)await setDoc(reference,{gameId:id,updatedAt:serverTimestamp()},{merge:true});else await deleteDoc(reference)}
async function createAccount(){const {email,password}=authCredentials();if(!email||password.length<6){authMessage('Entre un courriel et un mot de passe de 6 caractères minimum.',true);return}try{await createUserWithEmailAndPassword(auth,email,password)}catch(error){authMessage(error.code==='auth/email-already-in-use'?'Ce courriel possède déjà un compte.':error.message,true)}}
async function connectAccount(){const {email,password}=authCredentials();if(!email||!password){authMessage('Entre ton courriel et ton mot de passe.',true);return}try{await signInWithEmailAndPassword(auth,email,password)}catch(error){authMessage('Connexion impossible. Vérifie tes informations.',true)}}

function loadCatalog(){try{return JSON.parse(localStorage.getItem(CATALOG_KEY)) || demoGames}catch{return demoGames}}
function saveState(){localStorage.setItem(STORAGE_KEY, JSON.stringify([...played])); localStorage.setItem(CATALOG_KEY, JSON.stringify(catalog));}
function normalizeGame(game){return {id:`rawg-${game.id}`,name:game.name,year:(game.released||'').slice(0,4)||'—',genre:game.genres?.[0]?.name||'Non classé',platform:game.platforms?.[0]?.platform?.name||'Multi'}}
function values(field){return [...new Set(catalog.map(g=>g[field]).filter(v=>v && v!=='—'))].sort((a,b)=>String(a).localeCompare(String(b),'fr',{numeric:true}))}
function populateFilters(){['genre','platform','year'].forEach(field=>{const select=$(field+'Filter'); const current=select.value; select.innerHTML=`<option value="all">${field==='genre'?'Tous les genres':field==='platform'?'Toutes les plateformes':'Toutes les années'}</option>`+values(field).map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join(''); if(values(field).includes(current)) select.value=current})}
function escapeHtml(text){return String(text).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function render(){const search=$('searchInput').value.toLowerCase().trim(), genre=$('genreFilter').value, platform=$('platformFilter').value, year=$('yearFilter').value, status=$('statusFilter').value; const filtered=catalog.filter(g=>(!search||g.name.toLowerCase().includes(search))&&(genre==='all'||g.genre===genre)&&(platform==='all'||g.platform===platform)&&(year==='all'||String(g.year)===year)&&(status==='all'||status==='played'&&played.has(g.id)||status==='unplayed'&&!played.has(g.id))); $('gamesGrid').innerHTML=filtered.map(gameCard).join(''); $('emptyState').hidden=filtered.length>0; $('visibleCount').textContent=filtered.length; $('totalCount').textContent=catalog.length; $('playedCount').textContent=played.size; $('resultSummary').textContent=`${filtered.length} résultat${filtered.length!==1?'s':''}`; const pct=catalog.length?Math.round(played.size/catalog.length*100):0; $('completionPercent').textContent=pct+'%'; $('completionBar').style.width=Math.min(pct,100)+'%'}
function gameCard(game){const isPlayed=played.has(game.id); return `<article class="game-card ${isPlayed?'played':''}"><div class="game-art"><span class="platform-chip">${escapeHtml(game.platform)}</span></div><div class="game-info"><h3 class="game-title">${escapeHtml(game.name)}</h3><div class="game-meta">${escapeHtml(game.genre)}</div><div class="game-actions"><label class="check-label"><input type="checkbox" data-id="${escapeHtml(game.id)}" ${isPlayed?'checked':''}> J’ai joué</label><span class="game-year">${escapeHtml(game.year)}</span></div></div></article>`}
function setMessage(message, error=false){const el=$('updateMessage');el.textContent=message;el.style.color=error?'var(--pink)':'var(--green)'; if(message) setTimeout(()=>{el.textContent=''},6000)}
async function updateFromRawg(){const key=localStorage.getItem(RAWG_KEY)||$('rawgKey').value.trim(); if(!key){setMessage('Mode démo actif — ajoute une clé RAWG pour charger le catalogue complet.',true);return} $('refreshButton').disabled=true;$('refreshButton').innerHTML='<span>↻</span> Chargement...'; try{let merged=[...catalog], page=1; for(;page<=3;page++){const response=await fetch(`https://api.rawg.io/api/games?key=${encodeURIComponent(key)}&page=${page}&page_size=40&ordering=-released`); if(!response.ok) throw new Error('API RAWG indisponible'); const data=await response.json(); merged.push(...(data.results||[]).map(normalizeGame)); if(!data.next) break} const unique=new Map(merged.map(g=>[g.name.toLowerCase()+'-'+g.year,g])); catalog=[...unique.values()]; saveState();populateFilters();render();setMessage(`${catalog.length} jeux disponibles — tes ${played.size} sélections ont été conservées.`)}catch(error){setMessage('Impossible de joindre RAWG. Vérifie ta clé ou ta connexion.',true)}finally{$('refreshButton').disabled=false;$('refreshButton').innerHTML='<span>↻</span> Mettre à jour'}}

$('gamesGrid').addEventListener('change', async event=>{if(!event.target.matches('input[type="checkbox"]'))return; const id=event.target.dataset.id; const isPlayed=event.target.checked; isPlayed?played.add(id):played.delete(id);saveState();render();try{await syncPlayedGame(id,isPlayed);if(currentUser)authMessage('✓ Inventaire synchronisé avec Firebase')}catch(error){authMessage('Jeu enregistré localement, mais la synchronisation a échoué.',true)}});
['searchInput','genreFilter','platformFilter','yearFilter','statusFilter'].forEach(id=>$(id).addEventListener('input',render));
$('resetFilters').addEventListener('click',()=>{$('filters').reset();render()}); $('refreshButton').addEventListener('click',updateFromRawg);
$('signUpButton').addEventListener('click',createAccount); $('signInButton').addEventListener('click',connectAccount); $('signOutButton').addEventListener('click',()=>signOut(auth));
onAuthStateChanged(auth,async user=>{currentUser=user;$('signOutButton').hidden=!user;$('signInButton').hidden=!!user;$('signUpButton').hidden=!!user;if(user){$('authEmail').value=user.email||'';$('authPassword').value='';authMessage(`Connectée : ${user.email}`);try{await loadCloudPlayedGames(user);authMessage(`✓ Inventaire synchronisé : ${played.size} jeu${played.size!==1?'x':''}`)}catch(error){authMessage('Connectée, mais impossible de charger Firestore.',true)}}else{authMessage('Non connecté — tes coches restent locales pour le moment.')}});
$('saveKey').addEventListener('click',async()=>{const key=$('rawgKey').value.trim(),status=$('keyStatus'),button=$('saveKey');if(!key){status.textContent='Colle une clé API avant de l’enregistrer.';status.className='key-status error';return}button.disabled=true;button.textContent='Vérification...';status.textContent='Vérification de la clé RAWG...';status.className='key-status';try{const response=await fetch(`https://api.rawg.io/api/games?key=${encodeURIComponent(key)}&page_size=1`);if(!response.ok)throw new Error('invalid');localStorage.setItem(RAWG_KEY,key);status.textContent='✓ API connectée — clé enregistrée dans ce navigateur.';status.className='key-status success';setMessage('Clé RAWG validée. Appuie sur « Mettre à jour » pour charger les jeux.')}catch(error){status.textContent='✕ Clé refusée ou API inaccessible. Vérifie ta clé et ta connexion.';status.className='key-status error'}finally{button.disabled=false;button.textContent='Enregistrer'}}); $('rawgKey').value=localStorage.getItem(RAWG_KEY)||'';
populateFilters();render();
