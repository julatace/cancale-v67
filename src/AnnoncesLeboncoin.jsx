import BilanSynchronisation from './BilanSynchronisation.jsx';
import React,{useMemo,useState} from 'react';
import {etatAnnonceLeboncoin,lienAnnonceLeboncoin} from './etatAnnonceLeboncoin.js';
import './annonces-leboncoin.css';
import {STYLE_FLOU} from './flouCompte.js';
import {ListeParCompte} from './GroupesComptes.jsx'; // (11 nov.) annonces des autres comptes regroupées, repliées
import {montant} from './format.js';
import {BarreOutils,Filtres} from './ui/index.js';   // (14 nov.) les briques communes des listes
// (6 nov., v36-visuel-2) La règle unique des euros (`montant`) : « 90 € », jamais « 90,00 € ».
const euros = n => n != null && n !== '' && /^\d+(\.\d+)?$/.test(String(n)) && Number.isFinite(Number(n)) ? montant(Number(n)) : '—';
function Photo({src}) {
 const [ko,setKo]=useState(false);
 let url='';try {const u=new URL(src);if(u.protocol==='https:'&&!u.username&&!u.password)url=u.href;}catch{}
 return url&&!ko ? <img src={url} alt="" data-vrm-vignette="" loading="lazy" onError={()=>setKo(true)}/> : <span aria-label="Photo indisponible" className="vrm-lbc-catalog-photo-empty">—</span>;
}
// (28 oct.) Le N° d'une annonce est celui de la règle de tout l'écran
// (`numeroLbcIdentite` : lien posé à la main, sinon référence VRM traduite par la
// remise à zéro 013) — passé par le parent. La référence BRUTE (« 493 ») n'est
// jamais affichée : avant la 013 elle désignait une autre paire.
// (29 oct.) « Supprimer de Leboncoin » : seulement quand le parent le permet
// (`onSupprimer` : l'extension de ce Chrome sait le faire), sur une annonce
// encore en ligne ou en pause — jamais sur une vendue ou déjà retirée. Le parent
// confirme (« sans retour ») et envoie ; ici on ne fait que proposer le geste.
const SUPPRIMABLE = new Set(['active','aconfirmer','pause','inconnu']);
// (29 oct., « mêmes méthodes d'affichage que Vinted ») Sous le titre, les
// CHIFFRES de l'annonce quand Leboncoin les a donnés (statistiques lues par
// l'extension sur sa page de statistiques : favoris, vues, messages) et depuis
// quand elle est en ligne — jamais un chiffre inventé, jamais 0 pour « pas su ».
const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;
const dateCourte = (iso) => { const t = Date.parse(String(iso || '')); if (!Number.isFinite(t)) return ''; const d = new Date(t); return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', ...(d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) }); };
export function chiffresAnnonceLbc(ad) {
 const s = (ad && ad.stats) || {};
 const out = [];
 if (Number.isFinite(s.favoris)) out.push(pluriel(s.favoris, 'favori'));
 if (Number.isFinite(s.vues)) out.push(pluriel(s.vues, 'vue') + (Number.isFinite(s.jours) && s.jours > 0 ? ` en ${s.jours} j` : ''));
 if (Number.isFinite(s.messages)) out.push(pluriel(s.messages, 'message'));
 return out.join(' · ');
}
// (6 nov.) `aConfirmerDe(ad)` : la règle « en ligne » de Leboncoin
// (src/enLigneLbc.js) ; `confirmer` : la raison et le geste (rendus par l'écran,
// qui sait l'état de l'extension), dits UNE fois en tête de la liste (§7).
export default function AnnoncesLeboncoin({outils=null,annonces=[],ventes={},lectureKO=false,numeroDe=null,owner='',sortieDe=null,onSupprimer=null,enVol=null,floute=null,aConfirmerDe=null,confirmer=null,compteOuvert=''}) {
 // (31 oct.) `floute(ad)` : l'annonce d'un AUTRE compte que le compte Leboncoin
 // ouvert reste visible, estompée (le même STYLE_FLOU que Vinted, §11).
 const estFloute=ad=>typeof floute==='function'&&!!floute(ad);
 // (11 nov.) Le compte d'une annonce (identité, « lbc-account:X » = X) et son nom lu sur l'annonce, pour les groupes par compte.
 const idCompteAnn=ad=>String(ad?.account||ad?.lbcUser||'').replace(/^lbc-account:/i,'');
 const nomCompte=id=>{const a=annonces.find(x=>idCompteAnn(x)===id&&x.accountName);return a?String(a.accountName):(id?`n° ${id.slice(0,8)}`:'');};
 const [recherche,setRecherche]=useState(''),[filtre,setFiltre]=useState('toutes');
 const lignes=useMemo(()=>annonces.map(ad=>({ad,num:(numeroDe&&numeroDe(ad))||'',...etatAnnonceLeboncoin(ad,ventes,sortieDe,aConfirmerDe)})),[annonces,ventes,numeroDe,sortieDe,aConfirmerDe]);
 const choix=[['toutes','Toutes'],['active','En ligne'],['aconfirmer','À confirmer'],['pause','En pause'],['vendue','Vendues'],['autres','Retirées et autres']];
 const CONNUS=['active','aconfirmer','pause','vendue'];
 const visibles=lignes.filter(l=>(filtre==='toutes'||(filtre==='autres'?!CONNUS.includes(l.etat):l.etat===filtre))
  && [l.ad.subject,l.ad.title,l.ad.accountName,l.num?'N°'+l.num:''].join(' ').toLocaleLowerCase('fr').includes(recherche.trim().toLocaleLowerCase('fr')));
 const compteDe=ad=>String(ad?.account||ad?.lbcUser||'non-attribue');
 const comptesBilan=[...new Map(annonces.map(ad=>[compteDe(ad),{uid:compteDe(ad),nom:ad.accountName||(compteDe(ad)==='non-attribue'?'Compte Leboncoin non attribué':compteDe(ad))}])).values()];
 const bilan=[{id:'lbc-annonces',libelle:'Annonces Leboncoin',comptes:comptesBilan,items:annonces.map(ad=>({id:ad.id,compte:compteDe(ad),titre:ad.subject||ad.title,valeurs:[ad.price,ad.status,ad.pauseAt,ad.plusVueAt,ad.images?.[0],ad.images?.length]})),erreur:lectureKO,partiel:true,revision:annonces.map(ad=>ad.seenAt)}];
 // (14 nov., refonte visible — Julien : « la liste arrive après un écran et demi ») LA LISTE D'ABORD :
 // une barre (le champ de recherche + les outils de l'écran, `outils`), de petites capsules de filtre,
 // puis des RANGÉES denses (photo 52, le N° et le nom, une ligne d'état, le prix) au lieu de grandes
 // cartes photo de 300 px. Les briques communes (`src/ui`) : la même forme que Annonces · Vinted.
 // « Mes annonces » et « N reçues » ne prennent plus une ligne : le nombre est dans « Toutes »,
 // la note « D'où viennent ces états ? » et « Données » passent sous la liste. Rien de retiré.
 const nDe=id=>id==='toutes'?lignes.length:lignes.filter(l=>id==='autres'?!CONNUS.includes(l.etat):l.etat===id).length;
 return <section className="vrm-pf-liste" aria-label="Mes annonces Leboncoin" data-pf-liste="leboncoin">
  <h2 className="vrm-sr">Mes annonces</h2>
  {lectureKO?<p role="status" className="vrm-pf-note">Impossible de relire tes annonces. L’historique reste conservé.</p>:<>
   {confirmer&&lignes.some(l=>l.etat==='aconfirmer')&&<p className="vrm-lbc-catalog-confirmer vrm-pf-note" data-lbc-confirmer-phrase="">{confirmer}</p>}
   <div className="vrm-pf-collant" data-pf-outils="leboncoin">
    <BarreOutils valeur={recherche} onChange={setRecherche} placeholder="Rechercher un article, un compte…" label="Rechercher une annonce Leboncoin">{outils}</BarreOutils>
    <Filtres label="État des annonces Leboncoin" valeur={filtre} onChange={setFiltre}
     options={choix.filter(([id])=>(id!=='aconfirmer'||lignes.some(l=>l.etat==='aconfirmer'))&&(id==='toutes'||id===filtre||nDe(id)>0)).map(([id,nom])=>({v:id,l:nom,n:nDe(id)}))}/>
   </div>
   {!visibles.length?<p className="vrm-lbc-catalog-vide vrm-pf-vide">{lignes.length?'Aucune annonce dans cette sélection.':'Aucune annonce'}</p>:
    <ul className="vrm-pf-rangees"><ListeParCompte enLi unite="annonce" libelle="Compte ouvert sur Leboncoin" lignes={visibles} ouvert={compteOuvert} floute={(l)=>estFloute(l.ad)} compteDe={(l)=>idCompteAnn(l.ad)} nomDe={nomCompte} rendre={({ad,num,etat,label,livraison,suivi})=>{const lien=lienAnnonceLeboncoin(ad);const ch=chiffresAnnonceLbc(ad);const depuis=etat==='active'&&dateCourte(ad.publieeLe);return <li key={ad.id} className="vrm-ui-ligne vrm-pf-rangee" data-lbc-catalog-id={ad.id} data-lbc-catalog-etat={etat} data-flou={estFloute(ad)?'1':'0'} style={estFloute(ad)?STYLE_FLOU:undefined}>
     <span className="vrm-ui-ligne-photo" aria-hidden="true"><Photo key={ad.images?.[0]||ad.id} src={ad.images?.[0]}/></span>
     <span className="vrm-ui-ligne-textes vrm-pf-textes">
      <strong className="vrm-ui-ligne-titre">{num?<span className="vrm-pf-num" data-lbc-catalog-num={num}>{`N°${num}`}</span>:null}<span>{ad.subject||ad.title||'Annonce sans titre'}</span></strong>
      <span className="vrm-ui-ligne-sous"><span data-etat={etat}>{label}</span>{` · ${ad.accountName||'Compte sans nom'}`}{depuis?<span data-lbc-catalog-depuis="">{` · en ligne depuis le ${depuis}`}</span>:''}{suivi?<span>{` · ${livraison?'Livraison':'Vente'} · ${suivi}`}</span>:null}{ch?<span data-lbc-catalog-chiffres="">{` · ${ch}`}</span>:null}</span>
     </span>
     <b className="vrm-ui-ligne-valeur">{euros(ad.price)}</b>
     <span className="vrm-pf-gestes">{lien&&<a href={lien} target="_blank" rel="noreferrer" aria-label={`Gérer l’annonce : ${ad.subject||ad.title||ad.id}`} title="Gérer sur Leboncoin"><svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17 17 7M7 7h10v10"/></svg></a>}
     {typeof onSupprimer==='function'&&SUPPRIMABLE.has(etat)&&ad.status!=='deleted'&&<button type="button" data-lbc-supprimer={ad.id} disabled={!!enVol} onClick={()=>onSupprimer({id:String(ad.id),numero:num,title:ad.subject||ad.title||'',prix:ad.price})} aria-label={`Supprimer de Leboncoin : ${ad.subject||ad.title||ad.id}`}>{enVol===String(ad.id)?'Suppression…':'Supprimer'}</button>}</span>
    </li>;}}/></ul>}
   <div className="vrm-pf-pied"><span>{`${lignes.length} reçue${lignes.length>1?'s':''}`}</span><details className="vrm-pourquoi vrm-lbc-catalog-note" data-pourquoi><summary aria-label="D’où viennent ces états ?" title="D’où viennent ces états ?">ⓘ</summary><div>Les états reflètent la dernière lecture. « Gérer » ouvre l’annonce sur Leboncoin ; une annonce absente d’une page n’est pas supprimée de ton historique.</div></details></div>
  </>}
  <BilanSynchronisation owner={owner} sources={bilan}/>
 </section>;
}
