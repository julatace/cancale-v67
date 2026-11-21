// ── LES ACTIONS D'UNE LIGNE, DANS LA FICHE DE LA PAIRE (14 nov., proposition 62) ─
// Une rangée de liste garde SES gestes (imprimer, relier un achat, changer le
// prix, marquer retiré, code de retrait…) : ce sont les MÊMES éléments, les mêmes
// fonctions, les mêmes data-*. Quand la fiche est ouverte DEPUIS cette ligne
// (src/ficheLigne.js), ils sont rendus DANS la fiche (un portail vers sa place
// « contexte » ou « actions ») ; sinon, à leur place d'avant.
//   · `seulementFiche` : ce qui vivait dans une feuille propre à la liste (le
//     récapitulatif d'une vente) — rendu nulle part tant que la fiche est fermée.
//   · sans : ce qui était sur la ligne (les boutons d'un colis) — DÉPLACÉ dans la
//     fiche le temps qu'elle est ouverte (la liste est dessous, cachée), jamais
//     en double.
import React from 'react';
import { createPortal } from 'react-dom';
import { abonner, ligneOuverte, slotFiche } from './ficheLigne.js';

const instant = () => ({ l: ligneOuverte(), c: slotFiche('contexte'), a: slotFiche('actions') });
let _dernier = instant();
const lire = () => { const n = instant(); if (n.l !== _dernier.l || n.c !== _dernier.c || n.a !== _dernier.a) _dernier = n; return _dernier; };

export function useFicheOuverte() {
  return React.useSyncExternalStore(abonner, lire, lire);
}

// La place de CETTE ligne seulement (un élément du DOM, ou null) : à 1 000 rangées, ouvrir
// une fiche ne redessine que la rangée ouverte (les autres lisent toujours `null`).
const placeDe = (cle, place) => { const l = ligneOuverte(); return cle && l && l.cle === cle ? slotFiche(place === 'contexte' ? 'contexte' : 'actions') : null; };

// `aussiIci` : rendu À SA PLACE AUSSI pendant que la fiche est ouverte (une rangée de boutons sans état, ceux d'un
// colis) — la carte garde sa hauteur dessous : rien ne bouge dans la liste, le retour la retrouve au même défilement.
export default function DansFiche({ cle, place = 'actions', seulementFiche = false, aussiIci = false, children }) {
  const lireIci = React.useCallback(() => placeDe(cle, place), [cle, place]);
  const slot = React.useSyncExternalStore(abonner, lireIci, lireIci);
  if (slot) { const p = createPortal(<div className="vrm-fp-depuis-ligne" data-fiche-depuis-ligne={cle} data-fl-place={place}>{children}</div>, slot); return aussiIci ? <>{children}{p}</> : p; }
  if (seulementFiche) return null;
  return <>{children}</>;
}

// Vrai quand la fiche est ouverte DEPUIS cette ligne (seule la rangée concernée se redessine).
export function useLigneIci(cle) {
  const lire = React.useCallback(() => { const l = ligneOuverte(); return !!(cle && l && l.cle === cle); }, [cle]);
  return React.useSyncExternalStore(abonner, lire, lire);
}
