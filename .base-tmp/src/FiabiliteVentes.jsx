import React from 'react';import {qualiteVentes} from './qualiteVentes.js';
// (5 nov., chantier E2) Le titre dit ce qui manque, pas « 0 sur N calculable » ; une
// cause à zéro ne s'écrit pas (revue 3.5) ; le geste vient en premier.
const pl=(n,un,plusieurs)=>`${n} ${n>1?(plusieurs||un+'s'):un}`;
export default function FiabiliteVentes({lignes,perimetre,partiel=false}){
 const r=qualiteVentes(lignes);if(!r.total&&!partiel)return null;
 const titre=!r.total?'Bénéfice : lecture partielle':r.calculables===r.total?`Bénéfice calculable sur ${r.total>1?`les ${r.total} ventes`:'la vente'}`:r.calculables===0?`Bénéfice : aucune des ${pl(r.total,'vente')} n’est calculable`:`Bénéfice calculable sur ${r.calculables} des ${pl(r.total,'vente')}`;
 const causes=[r.achatManquant>0&&`${pl(r.achatManquant,'prix d’achat manquant','prix d’achat manquants')} (à saisir sur la vente)`,r.prixManquant>0&&pl(r.prixManquant,'prix de vente manquant','prix de vente manquants'),r.fraisAConfirmer>0&&`${pl(r.fraisAConfirmer,'vente')} avec frais à confirmer`,r.fraisNonSuivis>0&&`Frais non suivis pour ${pl(r.fraisNonSuivis,'vente')} : marge avant frais`,r.horsCalcul>0&&`${pl(r.horsCalcul,'commande')} à part (plusieurs articles, remboursement ou données insuffisantes)`].filter(Boolean);
 return <details className="vrm-fiabilite-ventes" data-fiabilite-ventes="" data-calculables={r.calculables} data-total={r.total}>
 <summary>{titre}{partiel&&r.total?' · lecture partielle':''}</summary>
 {causes.length>0&&<ul>{causes.map(c=><li key={c}>{c}</li>)}</ul>}
 {partiel&&<p>Certains comptes n’ont pas pu être lus : ces nombres portent seulement sur les ventes lues.</p>}
 <p>{perimetre}, avec les filtres choisis. Un bénéfice reste estimé tant que des frais ne sont pas confirmés ; il n’est ni le chiffre d’affaires ni l’argent versé.</p>
 </details>;
}
