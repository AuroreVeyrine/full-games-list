import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
const auth=getAuth(initializeApp({apiKey:'AIzaSyBXx0T71B7YBDidXtqSCrS-jTY8laCD8H8',authDomain:'gamevault-46985.firebaseapp.com',projectId:'gamevault-46985',storageBucket:'gamevault-46985.firebasestorage.app',messagingSenderId:'7861831338',appId:'1:7861831338:web:53cea16b93c678add2f2d3'}));
const $=id=>document.getElementById(id);
let busy=false;
function message(text,error=false){$('authStatus').textContent=text;$('authStatus').classList.toggle('error',error);}
async function perform(action){
  if(busy)return;
  busy=true;document.querySelectorAll('#accountForm button,#signOutButton').forEach(b=>b.disabled=true);
  message('Un instant…');
  try{await action();}catch(error){
    const messages={'auth/invalid-credential':'Courriel ou mot de passe incorrect.','auth/email-already-in-use':'Ce courriel possède déjà un compte. Connecte-toi.','auth/weak-password':'Choisis un mot de passe de 6 caractères minimum.','auth/too-many-requests':'Trop de tentatives. Réessaie un peu plus tard.','auth/network-request-failed':'Connexion réseau indisponible. Réessaie.'};
    message(messages[error.code]||'Action impossible. Vérifie tes informations et réessaie.',true);
  }finally{busy=false;document.querySelectorAll('#accountForm button,#signOutButton').forEach(b=>b.disabled=false);}
}
$('accountForm').addEventListener('submit',event=>{event.preventDefault();perform(()=>signInWithEmailAndPassword(auth,$('authEmail').value.trim(),$('authPassword').value));});
$('signUpButton').addEventListener('click',()=>{if($('accountForm').reportValidity())perform(()=>createUserWithEmailAndPassword(auth,$('authEmail').value.trim(),$('authPassword').value));});
$('signOutButton').addEventListener('click',()=>perform(()=>signOut(auth)));
$('resetPassword').addEventListener('click',()=>{
  if(!$('authEmail').reportValidity())return;
  perform(async()=>{await sendPasswordResetEmail(auth,$('authEmail').value.trim());message('Si un compte correspond à cette adresse, un lien de réinitialisation sera envoyé. Vérifie aussi les indésirables.');});
});
$('showPassword').addEventListener('click',()=>{
  const show=$('authPassword').type==='password';$('authPassword').type=show?'text':'password';
  $('showPassword').textContent=show?'Masquer':'Voir';$('showPassword').setAttribute('aria-pressed',String(show));
  $('showPassword').setAttribute('aria-label',show?'Masquer le mot de passe':'Afficher le mot de passe');
});
onAuthStateChanged(auth,user=>{
  $('accountForm').hidden=Boolean(user);$('connectedPanel').hidden=!user;
  $('accountHeading').textContent=user?'Ta partie est sauvegardée':'Reprendre ma partie';
  $('accountEmail').textContent=user?.email||'';$('authPassword').value='';
  message(user?'✓ Connectée à ton espace personnel.':'Connecte-toi ou crée ton compte pour commencer.');
});
