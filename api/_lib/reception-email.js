import {normAdresse,estAdresseCollectrice,sansEtiquette} from './proprietaire-email.js';
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
 if(comptes.length>500)throw Error('comptes-trop-nombreux');
 const correspondances=main[0]?.emails||{},labels=main[0]?.labels||{};
 const declarees=[...new Set(Object.keys(registre[0]?.data?.adresses||{}).map(normAdresse))].filter(a=>!estAdresseCollectrice(a));
 const etatsComptes=etats[0]?.data?.comptes||{};
 const associes=adresse=>Object.entries(correspondances).filter(([,em])=>normAdresse(em)===adresse).map(([id])=>({id,nom:String(comptes.find(c=>String(c.vinted_user_id)===id)?.login||labels[id]||'Compte Vinted').slice(0,100),bloque:etatsComptes[id]?.etat==='banni',etatLuLe:etatsComptes[id]?.at||null}));
 const adresseSuivie=a=>declarees.includes(normAdresse(a))?normAdresse(a):declarees.includes(sansEtiquette(a))?sansEtiquette(a):normAdresse(a);
 const date=v=>Number.isFinite(Date.parse(v))?new Date(v).toISOString():null;
 const emails=lignes.slice(0,100).map(({id,data:d={}})=>({id,adresses:[...new Set((Array.isArray(d.adresses)?d.adresses:[]).map(adresseSuivie))],subject:String(d.subject||'Email sans objet').slice(0,300),from:String(d.from||'').slice(0,200),at:date(d.at),sourceDate:date(d.sourceDate),etat:['integre','a-verifier','erreur'].includes(d.etat)?d.etat:'a-verifier',type:String(d.type||'information').slice(0,60),raison:String(d.raison||'').slice(0,300),documentsVerifies:false,suppressionAutorisee:false}));
 for(const email of emails){const associesMail=[...new Map(email.adresses.flatMap(associes).map(c=>[c.id,c])).values()];email.compte=associesMail.length===1?associesMail[0]:null;email.compteAmbigu=associesMail.length>1;}
 const dates=(journal[0]?.data?.entries||[]).map(e=>date(e.at)).filter(Boolean).sort().reverse();
 const adresses=[...new Set([...declarees,...Object.values(correspondances).map(normAdresse).filter(a=>a.includes('@')&&!estAdresseCollectrice(a))])].map(adresse=>({adresse,declaree:declarees.includes(adresse),comptes:associes(adresse),derniereReception:emails.filter(x=>x.adresses.includes(adresse)).map(x=>date(x.at)).filter(Boolean).sort().at(-1)||null}));
 const succes=passages.find(p=>p.id==='vrm_email_collecteur_succes')?.data;
 const passage=passages.find(p=>p.id==='vrm_email_collecteur_passage')?.data;
 return {ok:true,emails,adresses,plus:lignes.length>100,limite:100,dernierEmail:[emails[0]?.at,dates[0]].filter(Boolean).sort().at(-1)||null,collecteur:{dernierSucces:date(succes?.at),dernierPassage:date(passage?.at),etat:['debut','succes','erreur'].includes(passage?.etat)?passage.etat:null},attenteMesurable:false};
}
