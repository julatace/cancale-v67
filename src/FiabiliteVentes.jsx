import React from 'react';import {qualiteVentes} from './qualiteVentes.js';
export default function FiabiliteVentes({lignes,perimetre,partiel=false}){
 const r=qualiteVentes(lignes);if(!r.total&&!partiel)return null;
 return <details className="vrm-fiabilite-ventes" data-fiabilite-ventes="" data-calculables={r.calculables} data-total={r.total}>
 <summary>Fiabilité du bénéfice · {r.calculables} sur {r.total} calculable{r.calculables>1?'s':''}{partiel?' · lecture partielle':''}</summary>
 <p>{perimetre}. Les filtres sélectionnés s’appliquent à ce contrôle.</p>
 <ul><li>{r.achatManquant} prix d’achat manquant{r.achatManquant>1?'s':''}</li><li>{r.prixManquant} prix de vente manquant{r.prixManquant>1?'s':''}</li><li>{r.fraisAConfirmer} vente{r.fraisAConfirmer>1?'s':''} avec frais à confirmer</li>{r.fraisNonSuivis>0&&<li>Frais non suivis dans ce calcul pour {r.fraisNonSuivis} vente(s) : marge avant frais.</li>}{r.horsCalcul>0&&<li>{r.horsCalcul} commande(s) nécessitent une analyse séparée : plusieurs articles, remboursement ou données insuffisantes.</li>}</ul>
 {partiel&&<p>Certains comptes n’ont pas pu être lus. Ces nombres portent uniquement sur les lignes disponibles.</p>}
 <p>Calculable ne signifie pas définitif : un résultat reste estimé si des frais ne sont pas confirmés. Le bénéfice est distinct du chiffre d’affaires et des sommes effectivement versées.</p>
 </details>;
}
