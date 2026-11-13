import React, {useState} from 'react';
import './recus-email.css';
import { tr } from './i18n/index.js';
import { trj } from './i18n/react.js';
// (revue du 29 oct.) Ce que l'archive dit de ses reçus vient de `bilanRecusAchat`
// (api/_lib/recu-achat.js) : des ACHATS reliés (n° distincts), et pour les autres
// ce qui est mesuré — sans n° · n° qu'aucun achat affiché ne porte · pas comparés
// parce que les achats d'un compte n'ont pas pu être lus (le compte est nommé).
// Aucune cause devinée (« compte pas capté ou masqué » ne l'était pas).
const phraseRelies=(b,nom)=>{
 const pl=(k,un,plusieurs)=>k===1?un:plusieurs;
 const morceaux=[];
 if(b.achats>0) morceaux.push(`${pl(b.achats,'1 achat a son reçu',`${b.achats} achats ont leur reçu`)}, relié par le n° de transaction : « ${nom} » sur ${pl(b.achats,'sa','leur')} ligne.${b.lignes>b.achats?` (${b.lignes} e-mails pour ${pl(b.achats,'lui','eux')} : un même reçu peut arriver deux fois.)`:''}`);
 else if(b.passu===0) morceaux.push(tr('emails.aucunAchatAffiche'));
 const reste=[];
 if(b.absents>0) reste.push(`${pl(b.absents,'1 reçu porte un n° de transaction qu’aucun achat affiché ne porte',`${b.absents} reçus portent des n° de transaction qu’aucun achat affiché ne porte`)}`);
 if(b.sansTx>0) reste.push(`${pl(b.sansTx,'1 reçu n’a pas de n° de transaction (il ne désigne aucun achat)',`${b.sansTx} reçus n’ont pas de n° de transaction (ils ne désignent aucun achat)`)}`);
 if(reste.length) morceaux.push(`${reste.join(' ; ')} : ${pl(b.absents+b.sansTx,'il reste','ils restent')} dans cette liste.`);
 if(b.passu>0) morceaux.push(`${pl(b.passu,'1 reçu n’a pas pu être comparé',`${b.passu} reçus n’ont pas pu être comparés`)} : les achats de ${(b.nomsKo&&b.nomsKo.length?b.nomsKo:['un de tes comptes']).join(', ')} n’ont pas pu être lus.`);
 return morceaux.join(' ');
};
export default function RecusEmail({recus,autres=0,relies=null,nom='Reçu d’achat',onOuvrir,onActualiser}) {
 const [recherche,setRecherche]=useState(''),[max,setMax]=useState(10);
 const q=recherche.trim().toLocaleLowerCase('fr');
 const liste=Array.isArray(recus)?recus.filter(r=>[r.article,r.subject,r.account,r.transaction].some(v=>String(v||'').toLocaleLowerCase('fr').includes(q))).slice().sort((a,b)=>(Date.parse(b.receivedAt)||0)-(Date.parse(a.receivedAt)||0)):[];
 return <details className="vrm-recus-email" data-recus-email=""><summary>{tr('emails.recusAchatE')}{Array.isArray(recus)?` · ${recus.length}`:''}</summary>
 <p>{tr('emails.tousComptesCes')}</p>
 {recus===undefined ? <p role="status">{tr('emails.lectureRecus')}</p> : recus===null ? <div role="status">{tr('emails.recusOntPu')}<button type="button" onClick={onActualiser}>{tr('commun.reessayer')}</button></div> : <>
 <button type="button" onClick={onActualiser}>{tr('emails.actualiserRecus')}</button>
 {recus.length>0&&<input type="search" aria-label={tr('emails.rechercherRecuE')} value={recherche} onChange={e=>{setRecherche(e.target.value);setMax(10);}} placeholder={tr('emails.articleCompteTransaction')}/>}
 {!liste.length&&<p>{recus.length?tr('emails.aucunRecuRecherche'):tr('emails.aucunRecuAchat')}</p>}
 {/* (29 oct.) Ce qui se relie à un achat, par le n° de transaction seulement (§5) ; le reste reste ici, jamais rattaché au hasard. */}
 {relies&&recus.length>0&&<p data-recus-relies={relies.achats} data-recus-lignes={relies.lignes} data-recus-sans-tx={relies.sansTx} data-recus-absents={relies.absents} data-recus-passu={relies.passu} data-recus-comptes-ko={(relies.ko||[]).join(',')}>{phraseRelies(relies,nom)}</p>}
 {relies&&<p data-recus-geste="">{trj('emails.achatSansLigne', { nom: nom })}</p>}
 {autres>0&&<p data-recus-autres={autres}>{autres===1?tr('emails.1AutreE'):tr('emails.autresEMails', { autres: String(autres) })}</p>}
 <ul>{liste.slice(0,max).map((r,i)=><li key={r._emailId||i}><button type="button" onClick={()=>onOuvrir(r)}><span><strong>{r.article||r.subject||tr('emails.recuAchatVinted')}</strong><small>{[r.account,r.receivedAt&&Number.isFinite(Date.parse(r.receivedAt))?new Date(r.receivedAt).toLocaleDateString('fr-FR'):'',r.transaction?`Transaction ${r.transaction}`:''].filter(Boolean).join(' · ')||tr('emails.compteNonIdentifie')}</small></span><span aria-hidden="true">{tr('stock.voir')}</span></button></li>)}</ul>
 {liste.length>max&&<button type="button" onClick={()=>setMax(n=>n+10)}>{trj('emails.afficherRecusSuivants', { x: liste.length-max })}</button>}
 </>}
 </details>;
}
