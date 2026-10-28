import {decoderEntitesHtml} from '../api/_lib/entites-html.js';

const texte = v => typeof v === 'string' ? decoderEntitesHtml(v.replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim().slice(0,2000) : '';
export function preparerMessageFavori(message,pourcentage='') {
  const base=typeof message==='string'?message.trim():'';
  const brut=String(pourcentage??'').trim();
  if(brut&&(!/^\d{1,6}$/.test(brut)||Number(brut)<1||Number(brut)>99))return {message:'',pourcentage:null,erreur:'Saisis un pourcentage entier entre 1 et 99, ou laisse ce champ vide.'};
  const p=brut?Number(brut):null;
  const resultat=p?(base?`${base}\n\nJe te propose une réduction de ${p} % sur cet article.`:`Bonjour ! Je te propose une réduction de ${p} % sur cet article.`):base;
  if(resultat.length>2000)return {message:'',pourcentage:p,erreur:'Raccourcis ton message : le texte avec la réduction doit tenir en 2 000 caractères.'};
  return {message:resultat,pourcentage:p,erreur:''};
}
export function lienFavoriVinted(v,domain='www.vinted.fr') {
  if (typeof v !== 'string' || v.length>2000) return null;
  try {
    // Domaine illisible : aucune base, une adresse relative est alors refusée.
    const origine=typeof domain==='string'&&/^(?:www\.)?vinted\.(?:fr|com|it|de)$/i.test(domain)?`https://${domain}`:null;
    const u=origine?new URL(v,origine):new URL(v);
    if(u.protocol!=='https:'||u.username||u.password||!/^(?:www\.)?vinted\.(?:fr|com|it|de)$/i.test(u.hostname))return null;
    if(!/^\/(?:inbox|member|items|conversations)(?:\/|$)/i.test(u.pathname))return null;
    return u.href;
  }catch{return null;}
}
export function formesLiensNotifications(payload,uid=null) {
  const formes=new Map(),segments=new Set(['inbox','member','items','conversations','conversation','messages','message','new','offers','offer','offer_request','offer_requests','suggested_price','suggested_prices','price_offer','price_offers','create']);
  const parametres=new Set(['conversation_id','conversation','item_id','receiver_id','recipient_id','user_id','transaction_id','id','type','offer_id','notification_id','receiver','recipient','user','opposite_user_id','receiver_user_id','recipient_user_id','sender_id','seller_id','buyer_id','item','thread_id']);
  for(const n of (Array.isArray(payload?.notifications)?payload.notifications:[]).slice(0,100)){
    const lien=lienFavoriVinted(n?.link);if(!lien)continue;
    const u=new URL(lien),chemin='/'+u.pathname.split('/').filter(Boolean).map(s=>segments.has(s)?s:/^\d+$/.test(s)?'{identifiant}':'{segment}').join('/');
    const params=[...new Set([...u.searchParams.keys()].slice(0,30).map(k=>parametres.has(k)?k:'parametre_masque'))].sort();
    const mentionFavori=/favori|favourit/i.test(texte(n.body));
    const user=typeof n.user_id==='string'&&/^\d{1,20}$/.test(n.user_id)?n.user_id:Number.isSafeInteger(n.user_id)&&n.user_id>0?String(n.user_id):null;
    const userIdCorrespondAuCompte=user&&/^\d{1,20}$/.test(String(uid||''))?user===String(uid):null;
    const parametresUserId=user?[...new Set([...u.searchParams.entries()].filter(([k,v])=>parametres.has(k)&&v===user).map(([k])=>k))].sort():[];
    const forme={mentionFavori,chemin,parametres:params,userIdCorrespondAuCompte,parametresUserId},cle=JSON.stringify(forme);
    if(!formes.has(cle))formes.set(cle,{...forme,nombre:0});formes.get(cle).nombre++;
  }
  return {formes:[...formes.values()],echantillonLimite:Array.isArray(payload?.notifications)&&payload.notifications.length>100};
}
function photoNotification(n) {
  let visites=0;const vus=new WeakSet();
  const photo=v=>{if(typeof v!=='string'||v.length>2000)return null;try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password&&/^images\d*\.vinted\.net$/i.test(u.hostname)?u.href:null;}catch{return null;}};
  const lire=(v,p=0)=>{
    if(++visites>80||p>4||!v||typeof v!=='object'||vus.has(v))return null;
    vus.add(v);
    if(!Array.isArray(v)){
      for(const k of ['photo','image','avatar','thumbnail','icon','photo_url','image_url','url']){const u=photo(v[k]);if(u)return u;}
    }
    for(const enfant of Object.values(v).slice(0,20)){const u=lire(enfant,p+1);if(u)return u;}
    return null;
  };
  return lire(n);
}
export function favorisDepuisNotifications(payload,domain='www.vinted.fr') {
  if(!Array.isArray(payload?.notifications))throw Error('La capture reçue ne contient pas de liste de notifications reconnue.');
  const parId=new Map();let autres=0;
  for(const n of payload.notifications.slice(0,5000)){
    if(!n||typeof n.id!=='string'||!n.id||n.id.length>160){autres++;continue;}
    const body=texte(n.body), simple=body.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    // On exige une formulation d'ajout en favori, pas le mot « favori »
    // dans un pseudo ou le titre d'un article. Aucune identité déduite du texte.
    if(!/\b(?:ajoute|ajouter|mis|marque|enregistre|added|marked|saved)\b.{0,1500}\b(?:favoris|favori|favourites?|favorites?)\b|\b(?:favourited|favorited)\b.{0,500}\b(?:item|article)\b/i.test(simple)){autres++;continue;}
    const acteur=n.actor||n.from_user;
    const nom=acteur&&typeof acteur==='object'?texte(acteur.login||acteur.username||acteur.name):'';
    const date=dateNotificationFavori(n);
    const lien=lienFavoriVinted(n.link,domain),article=lien&&/^\/items\/([1-9]\d{0,19})\//.exec(new URL(lien).pathname)?.[1];
    const userId=Number.isSafeInteger(n.user_id)&&n.user_id>0?String(n.user_id):typeof n.user_id==='string'&&/^[1-9]\d{0,19}$/.test(n.user_id)?n.user_id:null;
    const ligne={id:n.id,body,nom,photo:photoNotification(n),lien,date,...(article&&userId?{identiteNotification:article+':'+userId}:{})};
    const avant=parId.get(n.id);
    if(!avant)parId.set(n.id,ligne);
    else {const dates=[avant.date,date].filter(Boolean).map(Date.parse);parId.set(n.id,{...avant,...ligne,date:dates.length?new Date(Math.min(...dates)).toISOString():null});}
  }
  const totalPages=payload.pagination?.total_pages;
  return {lignes:[...parId.values()].sort((a,b)=>(Date.parse(b.date)||0)-(Date.parse(a.date)||0)),autres,limite:payload.notifications.length>5000,totalPages:Number.isSafeInteger(totalPages)&&totalPages>0?totalPages:null};
}
export function dateNotificationFavori(n){
  for(const v of [n.created_at,n.created_at_ts,n.dateAjoutObservee,n.updated_at]){
    if(v==null||v==='')continue;const nombre=typeof v==='number'||typeof v==='string'&&/^\d{10,13}$/.test(v)?Number(v):null;
    const t=nombre==null?Date.parse(v):nombre<1e12?nombre*1000:nombre;
    if(Number.isFinite(t)&&t>0&&Number.isFinite(new Date(t).getTime()))return new Date(t).toISOString();
  }return null;
}
export function ageFavori(date,maintenant=Date.now()){
  const t=Date.parse(date||'');if(!Number.isFinite(t))return 'Date indisponible';
  const s=Math.floor((maintenant-t)/1000);if(s< -120)return 'Heure à vérifier';if(s<60)return 'à l’instant';
  if(s<3600)return `il y a ${Math.floor(s/60)} min`;if(s<86400)return `il y a ${Math.floor(s/3600)} h`;return `il y a ${Math.floor(s/86400)} j`;
}
const PRIORITE_CONTACT=['envoye','incertain','ignore','reserve','attente','verifie','refuse','annule'];
export function indexerContactsFavoris(jobs){
  const notifications=new Map(),identites=new Map();
  const rang=j=>{const n=PRIORITE_CONTACT.indexOf(j.etat);return n<0?999:n;};
  const meilleur=(a,b)=>!a?b:!b?a:rang(a.job)<rang(b.job)||rang(a.job)===rang(b.job)&&a.index<b.index?a:b;
  if(Array.isArray(jobs))jobs.forEach((job,index)=>{
    if(!job||typeof job!=='object')return;
    const candidat={job,index};
    if(job.notificationId!=null)notifications.set(job.notificationId,meilleur(notifications.get(job.notificationId),candidat));
    if(job.id!=null)identites.set(job.id,meilleur(identites.get(job.id),candidat));
  });
  return ligne=>meilleur(notifications.get(ligne?.id),ligne?.identiteNotification?identites.get(ligne.identiteNotification):null)?.job||null;
}
export function contactFavori(ligne,jobs){return indexerContactsFavoris(jobs)(ligne);}
export async function lireFavorisVinted({uid,owner,ownerActuel,base,headers,fetcher=fetch}) {
  if(!owner||ownerActuel()!==owner||!/^\d{1,20}$/.test(String(uid||'')))throw Error('Choisis un compte Vinted dans ta session VRM.');
  const r=await fetcher(`${base}/rest/v1/app_data?id=eq.harvest_${uid}_notifications&owner=eq.${encodeURIComponent(owner)}&select=owner,data`,{headers,cache:'no-store'});
  if(!r.ok)throw Error('La capture des notifications n’a pas pu être lue. Réessaie.');
  const rows=await r.json();
  if(ownerActuel()!==owner)throw Error('La session a changé. Recharge les favoris.');
  if(!Array.isArray(rows)||rows.length>1||rows.some(x=>x?.owner!==owner))throw Error('Le compte de la capture n’a pas été confirmé.');
  const d=rows[0]?.data;
  if(d&&(d.type!=='notifications'||String(d.uid)!==String(uid)||!Array.isArray(d.payload?.notifications)))throw Error('La capture ne correspond pas au compte demandé.');
  const a=await fetcher(`${base}/rest/v1/app_data?id=eq.harvest_${uid}_favoris_archive&owner=eq.${encodeURIComponent(owner)}&select=owner,data`,{headers,cache:'no-store'});
  if(!a.ok)throw Error('L’historique des favoris n’a pas pu être lu. Réessaie pour éviter une liste incomplète.');
  const ars=await a.json();if(ownerActuel()!==owner)throw Error('La session a changé. Recharge les favoris.');
  if(!Array.isArray(ars)||ars.length>1||ars.some(x=>x?.owner!==owner||x.data?.archiveVersion!==1||String(x.data?.uid)!==String(uid)||!Array.isArray(x.data?.payload?.notifications)))throw Error('L’historique ne confirme pas le compte attendu.');
  const archive=ars[0]?.data;
  if(!d&&!archive)return {reception:'absente',lignes:[]};
  const notifications=[...(archive?.payload?.notifications||[]),...(d?.payload?.notifications||[])];
  return {reception:'recue',...favorisDepuisNotifications({...d?.payload,notifications},d?.domain||archive?.domain||null),archive:archive?{sync:archive.sync,limite:archive.limite,capturedAt:archive.capturedAt}:null};
}
