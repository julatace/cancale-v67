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
// Une panne ou un quota ne prouve jamais qu'un lien à usage unique a expiré.
export function erreurRecuperation(r,phase='verification'){
 if(r?.status===429)return 'Trop de demandes rapprochées. Patiente un instant avant de réessayer avec ce lien.';
 if(!r?.status||r.status>=500||r.ok)return phase==='enregistrement'
  ? 'L’enregistrement n’est pas confirmé. Essaie de te connecter avec ton nouveau mot de passe avant de recommencer.'
  : 'Le service sécurisé est momentanément indisponible. Réessaie avec ce même lien dans un instant.';
 if(phase==='enregistrement')return 'Le mot de passe n’a pas pu être enregistré. Essaie un autre mot de passe ou redemande un lien.';
 if(['otp_expired','token_expired'].includes(r.json?.error_code)||['otp_expired','token_expired'].includes(r.json?.code)||/expired|invalid.*(?:token|otp)|(?:token|otp).*invalid/i.test(r.json?.error_description||r.json?.msg||r.json?.message||''))
  return 'Ce lien a expiré ou a déjà été utilisé. Redemande un email depuis la connexion, puis ouvre le plus récent.';
 return 'Ce lien n’a pas pu être vérifié. Vérifie que tu as copié le lien complet du dernier email, puis réessaie.';
}
// AbortSignal.timeout n'existe pas sur certains Safari : même protection de
// délai via AbortController, sans rendre la récupération inutilisable.
export async function requeteRecuperation(url,options={},fetcher=fetch,delai=15000){
 const controle=new AbortController(),timer=setTimeout(()=>controle.abort(),delai);
 try{const r=await fetcher(url,{...options,signal:controle.signal});return {ok:r.ok,status:r.status,json:await r.json().catch(()=>({}))};}
 finally{clearTimeout(timer);}
}
if(typeof document!=='undefined'){
 const $=id=>document.getElementById(id),msg=(t,err=false)=>{$('message').textContent=t;$('message').toggleAttribute('data-erreur',err);};
 let config=null,jeton='',occupe=false;
 const brut=window.location.href;
 try{history.replaceState({},'',window.location.pathname);}catch(_){}
 const appel=async(path,body,method='POST',token='')=>{
  return requeteRecuperation(`${config.url}/auth/v1/${path}`,{method,cache:'no-store',referrerPolicy:'no-referrer',headers:{apikey:config.cle,...(token?{Authorization:`Bearer ${token}`} :{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 };
 async function ouvrir(raw){
  $('nouveau').hidden=true;jeton='';const p=preuveRecuperation(raw);
  if(!p){msg('Ce lien est incomplet. Colle le lien reçu par email ci-dessous, ou redemande un lien depuis la connexion.',true);$('secours').hidden=false;return;}
  try{
   if(!config){const r=await requeteRecuperation('/api/compte?mode=configuration-auth',{cache:'no-store',referrerPolicy:'no-referrer'});const c=r.json;if(!r.ok||!c.ok)throw Error();config=c;}
   if(p.token_hash){const r=await appel('verify',{type:'recovery',token_hash:p.token_hash});if(!r.ok||!r.json.access_token){msg(erreurRecuperation(r),true);$('secours').hidden=false;return;}jeton=r.json.access_token;}
   else{const r=await appel('user',null,'GET',p.access_token);if(!r.ok||!r.json.id){msg(erreurRecuperation(r),true);$('secours').hidden=false;return;}jeton=p.access_token;}
   $('secours').hidden=true;$('lien').value='';$('nouveau').hidden=false;msg('Lien vérifié. Choisis ton nouveau mot de passe pour VRM.');$('password').focus();
  }catch(_){msg('La connexion au service sécurisé est momentanément indisponible. Réessaie avec le lien ci-dessous.',true);$('secours').hidden=false;}
 }
 $('voir').onclick=()=>{const voir=$('password').type==='password';$('password').type=voir?'text':'password';$('voir').textContent=voir?'Masquer':'Voir';$('voir').setAttribute('aria-label',voir?'Masquer le mot de passe':'Afficher le mot de passe');};
 async function verifier(raw){
  if(occupe)return;occupe=true;
  const b=$('secours').querySelector('[type=submit]'),texte=b.textContent;
  b.disabled=true;b.textContent='Vérification…';$('secours').setAttribute('aria-busy','true');msg('Vérification de ton lien sécurisé…');
  try{await ouvrir(raw);}finally{occupe=false;b.disabled=false;b.textContent=texte;$('secours').removeAttribute('aria-busy');}
 }
 $('secours').onsubmit=e=>{e.preventDefault();verifier($('lien').value);};
 $('nouveau').onsubmit=async e=>{e.preventDefault();if(occupe||!jeton)return;const p=$('password').value;
  if(p.length<8||p.length>128||!/[\p{L}]/u.test(p)||!/[\p{N}]/u.test(p)){msg('Choisis au moins 8 caractères, avec des lettres et des chiffres.',true);return;}
  if(p!==$('confirmation').value){msg('Les deux mots de passe ne correspondent pas.',true);return;}
  occupe=true;const bouton=$('nouveau').querySelector('[type=submit]'),texte=bouton.textContent;bouton.disabled=true;bouton.textContent='Enregistrement…';$('nouveau').setAttribute('aria-busy','true');msg('Enregistrement du nouveau mot de passe…');
  try{const r=await appel('user',{password:p},'PUT',jeton);if(!r.ok||!r.json.id){msg(erreurRecuperation(r,'enregistrement'),true);return;}
   $('password').value='';$('confirmation').value='';$('nouveau').hidden=true;$('connexion').textContent='Se connecter à VRM';msg('Ton nouveau mot de passe est enregistré. Fermeture des anciennes sessions…');
   const fermeture=await appel('logout?scope=global',null,'POST',jeton).catch(()=>null);jeton='';msg('Ton nouveau mot de passe est enregistré. Tu peux maintenant te connecter à VRM.'+(!fermeture?.ok?' La fermeture des anciennes sessions n’a pas été confirmée.':''));
  }catch(_){msg('La connexion a été interrompue : l’enregistrement n’est pas confirmé. Essaie de te connecter avec ton nouveau mot de passe avant de recommencer.',true);}
  finally{occupe=false;bouton.disabled=false;bouton.textContent=texte;$('nouveau').removeAttribute('aria-busy');}
 };
 verifier(brut);
}
