import React from 'react';
import {resumeSelection,lireParcours} from './parcoursQuotidien.js';
import './styles-parcours.css';
import { cleNum } from '../api/_lib/numerotation.js';   // (11 nov.) deux N° se comparent par cleNum
export function RecapSelection({lignes,coches}){
 const r=resumeSelection(lignes,coches);
 return <section className="vrm-parcours-recap" aria-label="Récapitulatif avant impression" data-recap-selection={r.total}>
  <strong>{r.total} colis sélectionné{r.total>1?'s':''}</strong>
  <span>{r.sites.join(' · ')}{r.comptes>0?` · ${r.comptes} compte(s) identifié(s)`:''}</span>
  <div><span>{r.prets} avec bordereau</span><span>{r.sansPdf} sans bordereau</span><span>{r.dejaImprimes} déjà imprimé(s)</span></div>
  {r.exclus>0&&<small role="status">{r.exclus} sélection(s) exclue(s) : colis absent de cette liste ou non sélectionnable. Seuls les {r.total} colis ci-dessus seront préparés.</small>}
  <details><summary>Vérifier les {r.total} colis avant impression</summary><ul>{r.lignes.map(l=><li key={l.cle}>{l.num ? `N°${l.num} · ` : ''}{l.titre || l.e?.o?.title || l.lo?.title || l.v?.titre || 'Colis'}{l.site ? ` · ${l.site}` : ''}{l.pdf===false ? ' · bordereau manquant' : ''}</li>)}</ul></details>
  {r.dejaImprimes>0&&<small>Les bordereaux déjà imprimés restent dans ta sélection : vérifie avant de relancer.</small>}
 </section>;
}
export function HistoriqueModifications({owner,numero}){
 const [revision,reviser]=React.useReducer(n=>n+1,0);
 React.useEffect(()=>{const fn=()=>reviser();window.addEventListener('vrm:modification-notee',fn);return()=>window.removeEventListener('vrm:modification-notee',fn)},[]);
 let storage=null;try{storage=sessionStorage;}catch{}
 const liste=lireParcours(storage,owner,'modifications',[]);
 const lignes=(Array.isArray(liste)?liste:[]).filter(l=>!numero||cleNum(l.numero)===cleNum(numero)).slice(0,30);
 return <details className="vrm-parcours-historique" key={owner} data-historique-local={revision}>
  <summary>Modifications enregistrées sur cet appareil ({lignes.length})</summary>
  <p>Depuis ce navigateur, sur les sept derniers jours. Ce journal ne confirme pas la synchronisation et ne reconstitue pas les changements antérieurs.</p>
  {!lignes.length?<p>Aucune modification enregistrée ici.</p>:<ol>{lignes.map((l,i)=><li key={i}><time dateTime={l.at}>{new Date(l.at).toLocaleString('fr-FR')}</time><b>{l.label}{l.numero?` · N°${l.numero}`:''}</b><span className={l.label==='Prix d’achat'?'vrm-sensible':undefined}>{l.avant===''?'Non renseigné':String(l.avant)+(l.label==='Prix d’achat'?' €':'')} → {l.apres===''?'Non renseigné':String(l.apres)+(l.label==='Prix d’achat'?' €':'')}</span></li>)}</ol>}
 </details>;
}
export function CompteurListe({affiches,total}){return <p className="vrm-parcours-compteur" role="status">{Math.min(affiches,total)} sur {total} résultat{total>1?'s':''} affiché{total>1?'s':''}</p>}
