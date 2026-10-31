import {normAdresse,estAdresseCollectrice,sansEtiquette} from './proprietaire-email.js';
// Une règle (§11) : à quel compte Vinted une adresse de réception appartient.
// Lue par la réception ET par le journal — l'adresse décide, jamais le texte.
function reglesComptes({registre,main,comptes,etats}){
 if(comptes.length>500)throw Error('comptes-trop-nombreux');
 const correspondances=main[0]?.emails||{},labels=main[0]?.labels||{};
 const declarees=[...new Set(Object.keys(registre[0]?.data?.adresses||{}).map(normAdresse))].filter(a=>!estAdresseCollectrice(a));
 const etatsComptes=etats[0]?.data?.comptes||{};
 const associes=adresse=>Object.entries(correspondances).filter(([,em])=>normAdresse(em)===adresse).map(([id])=>({id,nom:String(comptes.find(c=>String(c.vinted_user_id)===id)?.login||labels[id]||'Compte Vinted').slice(0,100),bloque:etatsComptes[id]?.etat==='banni',etatLuLe:etatsComptes[id]?.at||null}));
 const adresseSuivie=a=>declarees.includes(normAdresse(a))?normAdresse(a):declarees.includes(sansEtiquette(a))?sansEtiquette(a):normAdresse(a);
 return {correspondances,declarees,associes,adresseSuivie};
}
const lecteur=({url,headers,fetcher})=>async(query,table='app_data')=>{
 const r=await fetcher(`${url}/rest/v1/${table}?${query}`,{headers});
 if(!r.ok)throw Error('reception-indisponible');
 const j=await r.json();if(!Array.isArray(j))throw Error('reception-indisponible');return j;
};
const lectureComptes=(lire,owner)=>Promise.all([
 lire(`owner=eq.${encodeURIComponent(owner)}&id=eq.vrm_email_owners&select=data&limit=1`),
 lire(`owner=eq.${encodeURIComponent(owner)}&id=eq.main&select=emails:data->vinted_account_emails,labels:data->vinted_account_labels&limit=1`),
 lire(`owner=eq.${encodeURIComponent(owner)}&select=vinted_user_id,login&limit=501`,'vinted_accounts'),
 lire(`owner=eq.${encodeURIComponent(owner)}&id=eq.panel_comptes_etat&select=data&limit=1`),
]);

// ── LE JOURNAL « TES EMAILS, CE QUE VRM EN A FAIT » (31 oct.) ───────────────
// Une PAGE de 20 emails, du plus récent au plus ancien, en colonnes projetées
// (jamais `select=data`, §4.4) : ni corps, ni texte, ni pièce jointe. Le texte
// d'un email se lit à part (`lireTexteEmail`), un email à la fois.
// Les compteurs portent sur les JOURNAL_COMPTES derniers emails (deux
// scalaires par ligne) et le disent (`sur`).
export const JOURNAL_PAGE=20, JOURNAL_COMPTES=200;
export const JOURNAL_TYPES={colis:['suivi'],bordereau:['bordereau'],vente:['vente','finalisation'],achat:['achat'],messages:['offre','message','favori','action'],incompris:['ignoré'],autre:['connu-sans-action','information']};
const PROJECTION='id,at:data->>at,etat:data->>etat,type:data->>type,subject:data->>subject,from:data->>from,sourceDate:data->>sourceDate,adresses:data->adresses,resume:data->resume';
export async function lireJournalEmail({owner,url,headers,fetcher=fetch,page=0,etat='',type='',adresse='',compteSeul=false}){
 if(!owner || owner==='00000000-0000-0000-0000-000000000000')throw Error('connexion-requise');
 const lire=lecteur({url,headers,fetcher}),o=encodeURIComponent(owner);
 const p=Math.max(0,Math.min(50,Number.parseInt(page,10)||0));
 const filtres=[];
 if(etat==='a-verifier'||etat==='erreur'||etat==='integre')filtres.push(`data->>etat=eq.${etat}`);
 if(JOURNAL_TYPES[type])filtres.push(`data->>type=in.(${JOURNAL_TYPES[type].map(t=>encodeURIComponent(t)).join(',')})`);
 const adr=normAdresse(adresse);
 if(adr&&adr.includes('@')&&adr.length<=254)filtres.push(`data->adresses=cs.${encodeURIComponent(JSON.stringify([adr]))}`);
 const f=filtres.length?'&'+filtres.join('&'):'';
 const etats=lire(`owner=eq.${o}&id=like.email_reception_*&select=etat:data->>etat,type:data->>type&order=data->>at.desc,id.asc&limit=${JOURNAL_COMPTES+1}`);
 if(compteSeul){const l=await etats;return {ok:true,compteurs:compter(l)};}
 const [lignes,l,[registre,main,comptes,etatsC]]=await Promise.all([
  lire(`owner=eq.${o}&id=like.email_reception_*${f}&select=${PROJECTION}&order=data->>at.desc,id.asc&limit=${JOURNAL_PAGE+1}&offset=${p*JOURNAL_PAGE}`),
  etats,lectureComptes(lire,owner),
 ]);
 const {correspondances,declarees,associes,adresseSuivie}=reglesComptes({registre,main,comptes,etats:etatsC});
 const date=v=>Number.isFinite(Date.parse(v))?new Date(v).toISOString():null;
 const emails=lignes.slice(0,JOURNAL_PAGE).map(x=>{
  const adresses=[...new Set((Array.isArray(x.adresses)?x.adresses:[]).map(adresseSuivie))].slice(0,5);
  const lies=[...new Map(adresses.flatMap(associes).map(c=>[c.id,c])).values()];
  const r=x.resume&&typeof x.resume==='object'&&!Array.isArray(x.resume)?x.resume:null;
  return {id:String(x.id),at:date(x.at),sourceDate:date(x.sourceDate),etat:['integre','a-verifier','erreur'].includes(x.etat)?x.etat:'a-verifier',type:String(x.type||'information').slice(0,40),subject:String(x.subject||'').slice(0,200),from:String(x.from||'').slice(0,160),adresses,compte:lies.length===1?{id:lies[0].id,nom:lies[0].nom}:null,compteAmbigu:lies.length>1,resume:r&&JSON.stringify(r).length<=600?r:null};
 });
 const adresses=[...new Set([...declarees,...Object.values(correspondances).map(normAdresse).filter(a=>a.includes('@')&&!estAdresseCollectrice(a))])].map(a=>{const c=associes(a);return {adresse:a,nom:c.length===1?c[0].nom:''};});
 return {ok:true,page:p,parPage:JOURNAL_PAGE,suite:lignes.length>JOURNAL_PAGE,emails,compteurs:compter(l),adresses};
}
function compter(l){
 const lignes=l.slice(0,JOURNAL_COMPTES);
 const n=k=>lignes.filter(k).length;
 return {sur:lignes.length,plus:l.length>JOURNAL_COMPTES,integre:n(x=>x.etat==='integre'),aVerifier:n(x=>x.etat!=='integre'&&x.etat!=='erreur'),erreur:n(x=>x.etat==='erreur'),incompris:n(x=>x.type==='ignoré')};
}
// Le texte gardé d'UN email (sur son clic). L'id est celui de SA ligne de
// suivi ; la lecture est filtrée par son propriétaire. Absent ⇒ null (classé
// avant le 31 oct., ou email sans texte) — jamais un texte inventé.
export async function lireTexteEmail({owner,url,headers,fetcher=fetch,id}){
 if(!owner || owner==='00000000-0000-0000-0000-000000000000')throw Error('connexion-requise');
 const m=/^email_reception_([0-9a-f]{16,64})$/.exec(String(id||''));
 if(!m)throw Error('identifiant');
 const lire=lecteur({url,headers,fetcher});
 const r=await lire(`owner=eq.${encodeURIComponent(owner)}&id=eq.email_texte_${m[1]}&select=texte:data->>texte&limit=1`);
 const t=r[0]&&typeof r[0].texte==='string'?r[0].texte.slice(0,2000):null;
 return {ok:true,id:m[0],texte:t};
}

// Lecture exclusivement sous le propriétaire authentifié. Aucun corps d’email,
// document ou compteur d’un autre utilisateur ne quitte cette projection.
export async function lireReceptionEmail({owner,url,headers,fetcher=fetch}) {
 if(!owner || owner==='00000000-0000-0000-0000-000000000000')throw Error('connexion-requise');
 const lire=async(query,table='app_data')=>{
  const r=await fetcher(`${url}/rest/v1/${table}?${query}`,{headers});
  if(!r.ok)throw Error('reception-indisponible');
  const j=await r.json();if(!Array.isArray(j))throw Error('reception-indisponible');return j;
 };
 const [lignes,journal,passages,registre,main,comptes,etats]=await Promise.all([
  lire(`owner=eq.${encodeURIComponent(owner)}&id=like.email_reception_*&select=id,data&order=data->>at.desc,id.asc&limit=101`),
  lire(`owner=eq.${encodeURIComponent(owner)}&id=eq.email_journal&select=data&limit=1`),
  lire('owner=eq.00000000-0000-0000-0000-000000000000&id=in.(vrm_email_collecteur_passage,vrm_email_collecteur_succes)&select=id,data&limit=2'),
  lire(`owner=eq.${encodeURIComponent(owner)}&id=eq.vrm_email_owners&select=data&limit=1`),
  lire(`owner=eq.${encodeURIComponent(owner)}&id=eq.main&select=emails:data->vinted_account_emails,labels:data->vinted_account_labels&limit=1`),
  lire(`owner=eq.${encodeURIComponent(owner)}&select=vinted_user_id,login&limit=501`,'vinted_accounts'),
  lire(`owner=eq.${encodeURIComponent(owner)}&id=eq.panel_comptes_etat&select=data&limit=1`),
 ]);
 const {correspondances,declarees,associes,adresseSuivie}=reglesComptes({registre,main,comptes,etats});
 const date=v=>Number.isFinite(Date.parse(v))?new Date(v).toISOString():null;
 const emails=lignes.slice(0,100).map(({id,data:d={}})=>({id,adresses:[...new Set((Array.isArray(d.adresses)?d.adresses:[]).map(adresseSuivie))],subject:String(d.subject||'Email sans objet').slice(0,300),from:String(d.from||'').slice(0,200),at:date(d.at),sourceDate:date(d.sourceDate),etat:['integre','a-verifier','erreur'].includes(d.etat)?d.etat:'a-verifier',type:String(d.type||'information').slice(0,60),raison:String(d.raison||'').slice(0,300),documentsVerifies:false,suppressionAutorisee:false}));
 for(const email of emails){const associesMail=[...new Map(email.adresses.flatMap(associes).map(c=>[c.id,c])).values()];email.compte=associesMail.length===1?associesMail[0]:null;email.compteAmbigu=associesMail.length>1;}
 const dates=(journal[0]?.data?.entries||[]).map(e=>date(e.at)).filter(Boolean).sort().reverse();
 const adresses=[...new Set([...declarees,...Object.values(correspondances).map(normAdresse).filter(a=>a.includes('@')&&!estAdresseCollectrice(a))])].map(adresse=>({adresse,declaree:declarees.includes(adresse),comptes:associes(adresse),derniereReception:emails.filter(x=>x.adresses.includes(adresse)).map(x=>date(x.at)).filter(Boolean).sort().at(-1)||null}));
 const succes=passages.find(p=>p.id==='vrm_email_collecteur_succes')?.data;
 const passage=passages.find(p=>p.id==='vrm_email_collecteur_passage')?.data;
 return {ok:true,emails,adresses,plus:lignes.length>100,limite:100,dernierEmail:[emails[0]?.at,dates[0]].filter(Boolean).sort().at(-1)||null,collecteur:{dernierSucces:date(succes?.at),dernierPassage:date(passage?.at),etat:['debut','succes','erreur'].includes(passage?.etat)?passage.etat:null},attenteMesurable:false};
}
