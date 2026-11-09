// Page « nouveau mot de passe ». Les jetons vivent uniquement en mémoire :
// aucun jeton de récupération dans le stockage, les logs, une URL de
// redirection ou un chargement externe. Seule la session OUVERTE avec le
// nouveau mot de passe est rangée (`vrm_session`, la clé de l'app), pour que
// « Ouvrir VRM » arrive connecté.
//
// (8 nov.) Toutes les formes qu'un lien Supabase peut amener ici :
//   #token_hash=…&type=recovery      notre modèle d'e-mail (vérifié par la page)
//   ?token_hash=… / ?token=…         la même chose en paramètre, ou collée
//   #access_token=…&type=recovery    le modèle PAR DÉFAUT (flux implicite)
//   ?code=…                          flux PKCE (échangé avec le vérificateur
//                                    rangé sur CET appareil, sinon dit)
//   #error=…&error_code=otp_expired  lien expiré / déjà servi ⇒ dit + renvoi
export function preuveRecuperation(raw,base='https://vrm.center'){
 try{const u=new URL(String(raw||'').trim(),base);if(!/^https?:$/.test(u.protocol))return null;
  const q=new URLSearchParams(u.hash.slice(1)),s=u.searchParams,lire=k=>q.get(k)??s.get(k);
  const code_erreur=lire('error_code'),erreur=lire('error');
  if(code_erreur||erreur)return{erreur:String(code_erreur||erreur).slice(0,64),description:String(lire('error_description')||'').slice(0,300)};
  const type=lire('type');
  const c=s.get('code')||q.get('code');
  if(c&&(!type||type==='recovery')&&/^[A-Za-z0-9_-]{8,512}$/.test(c))return{code:c};
  if(type!=='recovery')return null;
  const at=q.get('access_token');
  if(at&&at.split('.').length===3&&at.length<=8192)return{access_token:at,refresh_token:q.get('refresh_token')||''};
  const h=lire('token_hash')||s.get('token');
  if(h&&/^[A-Za-z0-9_-]{20,1024}$/.test(h))return{token_hash:h};
 }catch(_){}return null;
}
// Le genre d'échec, jamais deviné : une panne ou un quota ne prouve pas
// qu'un lien à usage unique a expiré.
export function genreErreur(r){
 if(r?.status===429)return 'quota';
 if(!r?.status||r.status>=500||r.ok)return 'panne';
 const j=r.json||{},texte=j.error_description||j.msg||j.message||j.description||'';
 if(['otp_expired','token_expired','flow_state_expired','flow_state_not_found'].includes(j.error_code||j.code||j.erreur)||/expired|invalid.*(?:token|otp|code)|(?:token|otp|code).*invalid|not found/i.test(texte))return 'expire';
 return 'invalide';
}
export const TEXTES={
 expire:'Ce lien a expiré ou a déjà servi. Redemande un e-mail ci-dessous, puis ouvre le plus récent.',
 invalide:'Ce lien ne marche pas. Redemande un e-mail ci-dessous, puis ouvre le plus récent.',
 quota:'Trop d’essais rapprochés. Attends une minute, puis réessaie.',
 panne:'Le service ne répond pas pour l’instant. Réessaie dans un instant avec ce même lien.',
 appareil:'Ce lien doit s’ouvrir sur l’appareil où tu as demandé l’e-mail. Ouvre-le là-bas, ou redemande un e-mail ici.',
 vide:'Pour changer ton mot de passe, demande un e-mail : son bouton ouvre cette page.',
};
export function erreurRecuperation(r,phase='verification'){
 const g=genreErreur(r);
 if(phase==='enregistrement'){
  if(g==='quota')return TEXTES.quota;
  if(g==='panne')return 'L’enregistrement n’est pas confirmé. Essaie de te connecter avec ton nouveau mot de passe avant de recommencer.';
  return 'Ce mot de passe a été refusé. Essaie-en un autre, plus long.';
 }
 return TEXTES[g];
}
// « only request this after N seconds » (Supabase, renvoi trop tôt).
export const attenteDemande=(r)=>{const m=/after\s+(\d{1,4})\s*seconds?/i.exec(String(r?.json?.msg||r?.json?.message||r?.json?.error_description||''));const n=m?Number(m[1]):0;return n>0&&n<=3600?n:(r?.status===429?60:0);};
// AbortSignal.timeout n'existe pas sur certains Safari : même protection de
// délai via AbortController.
export async function requeteRecuperation(url,options={},fetcher=fetch,delai=15000){
 const controle=new AbortController(),timer=setTimeout(()=>controle.abort(),delai);
 try{const r=await fetcher(url,{...options,signal:controle.signal});return {ok:r.ok,status:r.status,json:await r.json().catch(()=>({}))};}
 finally{clearTimeout(timer);}
}
// Le vérificateur PKCE rangé sur CET appareil (app VRM ou client supabase-js).
export function verificateurPkce(stockages){
 for(const st of stockages){try{
  for(let i=0;i<st.length;i++){const k=st.key(i);if(!k)continue;
   if(k==='vrm_pkce'){const v=st.getItem(k);try{const o=JSON.parse(v);if(typeof o?.v==='string')return{cle:k,st,v:o.v};}catch(_){}if(v)return{cle:k,st,v};}
   if(/^sb-.*-code-verifier$/.test(k)){let v=st.getItem(k);try{v=JSON.parse(v);}catch(_){}if(typeof v==='string'&&v)return{cle:k,st,v:v.split('/')[0]};}
  }
 }catch(_){}}
 return null;
}
export const motDePasseValide=p=>typeof p==='string'&&p.length>=8&&p.length<=128&&/[\p{L}]/u.test(p)&&/[\p{N}]/u.test(p);

if(typeof document!=='undefined'){
 const $=id=>document.getElementById(id);
 const msg=(t,etat='')=>{const m=$('message');m.textContent=t;m.toggleAttribute('data-erreur',etat==='erreur');m.toggleAttribute('data-fait',etat==='fait');};
 const titre=t=>{$('titre').textContent=t;};
 const montrer=(...ids)=>{for(const id of ['nouveau','fait','reessayer','renvoi','autre'])$(id).hidden=!ids.includes(id);};
 let config=null,jeton='',occupe=false,dernier='',finAttente=0,minuterie=0;
 const brut=window.location.href;
 try{history.replaceState({},'',window.location.pathname);}catch(_){}
 const chargerConfig=async()=>{if(config)return config;const r=await requeteRecuperation('/api/compte?mode=configuration-auth',{cache:'no-store',referrerPolicy:'no-referrer'});if(!r.ok||!r.json.ok)throw Error('config');config=r.json;return config;};
 const appel=async(path,body,method='POST',token='')=>{
  await chargerConfig();
  return requeteRecuperation(`${config.url}/auth/v1/${path}`,{method,cache:'no-store',referrerPolicy:'no-referrer',headers:{apikey:config.cle,...(token?{Authorization:`Bearer ${token}`}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 };
 // Échec du lien : la phrase dit quoi faire, le renvoi est là, et la voie
 // « coller un lien » n'existe qu'ici (repliée).
 const echec=(genre)=>{
  jeton='';
  if(genre==='panne'||genre==='quota'){titre('Choisis un nouveau mot de passe');msg(TEXTES[genre],'erreur');montrer('reessayer');return;}
  titre(genre==='vide'?'Mot de passe oublié':genre==='appareil'?'Ouvre le lien sur ton autre appareil':'Ce lien ne marche plus');
  msg(TEXTES[genre],genre==='vide'?'':'erreur');montrer('renvoi','autre');
 };
 async function ouvrir(raw){
  dernier=raw;const p=preuveRecuperation(raw);
  if(!p)return echec('vide');
  if(p.erreur)return echec(/expired|denied|invalid/i.test(p.erreur+' '+p.description)?'expire':'invalide');
  try{
   if(p.token_hash){const r=await appel('verify',{type:'recovery',token_hash:p.token_hash});if(!r.ok||!r.json.access_token)return echec(genreErreur(r));jeton=r.json.access_token;}
   else if(p.code){
    const v=verificateurPkce([sessionStorage,localStorage]);if(!v)return echec('appareil');
    const r=await appel('token?grant_type=pkce',{auth_code:p.code,code_verifier:v.v});
    if(r.ok&&r.json.access_token){try{v.st.removeItem(v.cle);}catch(_){}}
    if(!r.ok||!r.json.access_token)return echec(genreErreur(r));jeton=r.json.access_token;}
   else{const r=await appel('user',null,'GET',p.access_token);if(!r.ok||!r.json.id)return echec(genreErreur(r));jeton=p.access_token;}
   titre('Choisis un nouveau mot de passe');msg('Il remplacera l’ancien sur tous tes appareils.');montrer('nouveau');$('lien').value='';$('password').focus();
  }catch(_){echec('panne');}
 }
 async function verifier(raw){
  if(occupe)return;occupe=true;msg('Ouverture de ton lien…');
  try{await ouvrir(raw);}finally{occupe=false;}
 }
 const regles=()=>{const p=$('password').value;$('r-longueur').dataset.valide=String(p.length>=8);$('r-melange').dataset.valide=String(/[\p{L}]/u.test(p)&&/[\p{N}]/u.test(p));};
 $('password').addEventListener('input',regles);
 $('voir').onclick=()=>{const voir=$('password').type==='password';for(const id of ['password','confirmation'])$(id).type=voir?'text':'password';$('voir').textContent=voir?'Masquer':'Afficher';$('voir').setAttribute('aria-label',voir?'Masquer le mot de passe':'Afficher le mot de passe');$('voir').setAttribute('aria-pressed',String(voir));};
 $('reessayer').onclick=()=>verifier(dernier);
 $('secours').onsubmit=e=>{e.preventDefault();const v=$('lien').value.trim();if(!v){$('lien').focus();return;}verifier(v);};
 // Renvoi : même route que l'écran « Mot de passe oublié » de l'app, même
 // réponse que le compte existe ou non, et l'intervalle de Supabase respecté.
 const bouton=()=>$('renvoi').querySelector('[type=submit]');
 const tic=()=>{const reste=Math.ceil((finAttente-Date.now())/1000),b=bouton();
  if(reste>0){b.disabled=true;b.textContent=`Renvoyer dans ${reste} s`;minuterie=setTimeout(tic,1000);}
  else{b.disabled=false;b.textContent=b.dataset.envoye?'Renvoyer l’e-mail':'M’envoyer un nouvel e-mail';}};
 const attendre=n=>{finAttente=Date.now()+n*1000;clearTimeout(minuterie);tic();};
 $('renvoi').onsubmit=async e=>{e.preventDefault();if(occupe||finAttente>Date.now())return;
  const email=$('email').value.trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){msg('Écris l’adresse e-mail de ton compte VRM.','erreur');$('email').focus();return;}
  occupe=true;const b=bouton();b.disabled=true;b.textContent='Envoi…';$('renvoi').setAttribute('aria-busy','true');
  try{const retour=encodeURIComponent(window.location.origin+'/recuperation.html');
   const r=await appel(`recover?redirect_to=${retour}`,{email});
   const n=attenteDemande(r);
   if(r.ok){b.dataset.envoye='1';titre('Regarde ta boîte mail');msg(`On t’a envoyé un e-mail à ${email}. Ouvre-le sur cet appareil.`,'fait');$('autre').hidden=true;attendre(60);}
   else if(n){msg('Un e-mail vient déjà de partir. Regarde ta boîte (et les indésirables) ; tu pourras en redemander un dans un instant.','erreur');attendre(n);}
   else if(/captcha/i.test(JSON.stringify(r.json||{}))){msg('Redemande l’e-mail depuis l’écran de connexion de VRM.','erreur');$('connexion').href='/?mot-de-passe-oublie';$('connexion').textContent='Mot de passe oublié dans VRM';}
   else msg('L’envoi n’est pas confirmé. Réessaie dans quelques minutes.','erreur');
  }catch(_){msg('L’envoi n’est pas confirmé. Vérifie ta connexion, puis réessaie.','erreur');}
  finally{occupe=false;$('renvoi').removeAttribute('aria-busy');if(!(finAttente>Date.now()))tic();}
 };
 $('nouveau').onsubmit=async e=>{e.preventDefault();if(occupe||!jeton)return;const p=$('password').value;
  if(!motDePasseValide(p)){msg('Choisis au moins 8 caractères, avec des lettres et des chiffres.','erreur');$('password').focus();return;}
  if(p!==$('confirmation').value){msg('Les deux mots de passe ne sont pas les mêmes.','erreur');$('confirmation').focus();return;}
  occupe=true;const b=$('nouveau').querySelector('[type=submit]'),texte=b.textContent;b.disabled=true;b.textContent='Enregistrement…';$('nouveau').setAttribute('aria-busy','true');msg('Enregistrement…');
  try{const r=await appel('user',{password:p},'PUT',jeton);if(!r.ok||!r.json.id){msg(erreurRecuperation(r,'enregistrement'),'erreur');return;}
   const email=r.json.email||'';
   $('password').value='';$('confirmation').value='';regles();
   // Les autres appareils (et un éventuel intrus) sont déconnectés, puis CET
   // appareil se connecte avec le nouveau mot de passe.
   const fermeture=await appel('logout?scope=global',null,'POST',jeton).catch(()=>null);jeton='';
   let session=null;
   if(email){const c=await appel('token?grant_type=password',{email,password:p}).catch(()=>null);
    if(c?.ok&&typeof c.json?.access_token==='string'&&c.json.user?.id){session={access_token:c.json.access_token,refresh_token:c.json.refresh_token||'',expires_at:Date.now()+(Number(c.json.expires_in)||3600)*1000,user:{id:c.json.user.id,email:c.json.user.email||email}};
     try{localStorage.setItem('vrm_session',JSON.stringify(session));}catch(_){session=null;}}}
   const autres=fermeture?.ok?'':' Tes autres appareils n’ont peut-être pas été déconnectés : la fermeture des anciennes sessions n’a pas été confirmée.';
   titre('C’est fait');montrer('fait');$('connexion').hidden=true;
   if(session){msg('Ton mot de passe est changé. Tu es connecté.'+autres,'fait');$('ouvrir').textContent='Ouvrir VRM';$('ouvrir').href='/';}
   else{msg('Ton mot de passe est changé. Connecte-toi avec lui.'+autres,'fait');$('ouvrir').textContent='Se connecter';$('ouvrir').href='/?connexion';}
   $('ouvrir').focus();
  }catch(_){msg('La connexion a été coupée : l’enregistrement n’est pas confirmé. Essaie de te connecter avec ton nouveau mot de passe avant de recommencer.','erreur');}
  finally{occupe=false;b.disabled=false;b.textContent=texte;$('nouveau').removeAttribute('aria-busy');}
 };
 verifier(brut);
}
