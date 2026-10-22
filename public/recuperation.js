// Les jetons vivent uniquement en mémoire. Aucun jeton dans le stockage,
// les logs, une URL de redirection ou un chargement d'image externe.
export function preuveRecuperation(raw,base='https://vrm.center'){
 try{const u=new URL(raw,base),q=new URLSearchParams(u.hash.slice(1)),s=u.searchParams;
  const type=q.get('type')||s.get('type');if(type!=='recovery')return null;
  const at=q.get('access_token'),rt=q.get('refresh_token');
  if(at&&at.split('.').length===3&&at.length<=8192)return{access_token:at,refresh_token:rt||''};
  const h=q.get('token_hash')||s.get('token_hash')||s.get('token');
  if(h&&/^[A-Za-z0-9_-]{20,1024}$/.test(h))return{token_hash:h};
 }catch(_){}return null;
}
if(typeof document!=='undefined'){
 const $=id=>document.getElementById(id),msg=(t,err=false)=>{$('message').textContent=t;$('message').toggleAttribute('data-erreur',err);};
 let config=null,jeton='',occupe=false;
 const brut=window.location.href;
 try{history.replaceState({},'',window.location.pathname);}catch(_){}
 const appel=async(path,body,method='POST',token='')=>{
  const r=await fetch(`${config.url}/auth/v1/${path}`,{method,cache:'no-store',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(15000),headers:{apikey:config.cle,...(token?{Authorization:`Bearer ${token}`} :{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  return{ok:r.ok,json:await r.json().catch(()=>({}))};
 };
 async function ouvrir(raw){
  $('nouveau').hidden=true;jeton='';const p=preuveRecuperation(raw);
  if(!p){msg('Ce lien est incomplet. Colle le lien reçu par email ci-dessous, ou redemande un lien depuis la connexion.',true);$('secours').hidden=false;return;}
  try{
   if(!config){const r=await fetch('/api/compte?mode=configuration-auth',{cache:'no-store',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(15000)});const c=await r.json();if(!r.ok||!c.ok)throw Error();config=c;}
   if(p.token_hash){const r=await appel('verify',{type:'recovery',token_hash:p.token_hash});if(!r.ok||!r.json.access_token){msg('Ce lien a expiré ou a déjà été utilisé. Redemande un email depuis la connexion, puis ouvre le plus récent.',true);$('secours').hidden=false;return;}jeton=r.json.access_token;}
   else{const r=await appel('user',null,'GET',p.access_token);if(!r.ok||!r.json.id){msg('Ce lien a expiré. Redemande un email depuis la connexion.',true);$('secours').hidden=false;return;}jeton=p.access_token;}
   $('secours').hidden=true;$('lien').value='';$('nouveau').hidden=false;msg('Lien vérifié. Choisis ton nouveau mot de passe pour VRM.');$('password').focus();
  }catch(_){msg('La connexion au service sécurisé est momentanément indisponible. Réessaie avec le lien ci-dessous.',true);$('secours').hidden=false;}
 }
 $('voir').onclick=()=>{const voir=$('password').type==='password';$('password').type=voir?'text':'password';$('voir').textContent=voir?'Masquer':'Voir';$('voir').setAttribute('aria-label',voir?'Masquer le mot de passe':'Afficher le mot de passe');};
 $('secours').onsubmit=async e=>{e.preventDefault();if(occupe)return;occupe=true;try{await ouvrir($('lien').value);}finally{occupe=false;}};
 $('nouveau').onsubmit=async e=>{e.preventDefault();if(occupe||!jeton)return;const p=$('password').value;
  if(p.length<8||p.length>128||!/[\p{L}]/u.test(p)||!/[\p{N}]/u.test(p)){msg('Choisis au moins 8 caractères, avec des lettres et des chiffres.',true);return;}
  if(p!==$('confirmation').value){msg('Les deux mots de passe ne correspondent pas.',true);return;}
  occupe=true;const bouton=$('nouveau').querySelector('[type=submit]');bouton.disabled=true;
  try{const r=await appel('user',{password:p},'PUT',jeton);if(!r.ok){msg('Le mot de passe n’a pas pu être enregistré. Essaie un autre mot de passe ou redemande un lien.',true);return;}
   await appel('logout?scope=global',null,'POST',jeton).catch(()=>null);jeton='';$('password').value='';$('confirmation').value='';$('nouveau').hidden=true;$('connexion').textContent='Se connecter à VRM';msg('Ton nouveau mot de passe est enregistré. Tu peux maintenant te connecter à VRM.');
  }catch(_){msg('La connexion a été interrompue : l’enregistrement n’est pas confirmé. Essaie de te connecter avec ton nouveau mot de passe avant de recommencer.',true);}
  finally{occupe=false;bouton.disabled=false;}
 };
 ouvrir(brut);
}
