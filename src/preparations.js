// ════════════════════════════════════════════════════════════════════════════
//  LES PUBLICATIONS EN PRÉPARATION (6 nov., « de vrais écrans de chargement »).
//
//  Un chiffre « publié » (§11 : `vrm_paires_dorment`, `vrm_colis_retirer`…) est
//  écrit par l'écran qui a toutes ses sources. Sur un appareil où il n'a jamais
//  été publié, la carte disait « pas lu »… pendant que l'écran ouvert était en
//  train de le calculer, puis le chiffre arrivait : un « pas su » qui devenait une
//  valeur (§5 : « pas su » seulement quand la lecture a VRAIMENT échoué).
//
//  L'écran qui publie DIT qu'il prépare : de son montage jusqu'à sa publication,
//  ou au plus `BORNE_MS` après que sa liste principale est lue (au-delà, il a
//  décidé de ne pas publier — une lecture partielle ne publie rien). Pendant ce
//  temps, une publication absente se lit « lecture… », jamais « pas lu ». Rien
//  n'est écrit ici, rien n'est deviné : c'est l'état de l'écran, en mémoire.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';

export const BORNE_MS = 8000;
const actifs = new Map();
const prevenir = () => { try { window.dispatchEvent(new Event('vrm:preparation')); } catch (_) {} };

export function commencer(cle) {
  actifs.set(cle, (actifs.get(cle) || 0) + 1);
  prevenir();
  let fini = false;
  return () => {
    if (fini) return; fini = true;
    const v = (actifs.get(cle) || 1) - 1;
    if (v > 0) actifs.set(cle, v); else actifs.delete(cle);
    prevenir();
  };
}
export const enPreparation = (cle) => (actifs.get(cle) || 0) > 0;

// L'écran qui publie `cle` : `actif` = il en est l'auteur ici ; `lu` = sa liste
// principale est lue (la borne part de là).
// (23 nov., latence-2) UNE préparation par écran monté : un écran GARDÉ (src/ecransGardes.jsx) qui se cache puis revient voit
// React détacher puis rattacher ses effets de mise en page — la préparation repartait à chaque retour (alors que rien n'était
// à recalculer) et chaque début / fin re-rendait tous les lecteurs (`Comptabilite` compris : 32 rendus par retour sur Achats,
// banc `_sonde-style.cjs QUI2=Comptabilite`). Une préparation par MONTAGE : finie (publiée, bornée, ou l'écran caché), elle ne
// recommence plus pour cette clé — l'écran revenu publie s'il a quelque chose à publier ; une clé qui change en relance une.
export function usePreparation(cle, actif, lu) {
  const fin = React.useRef(null);
  const terminee = React.useRef('');
  React.useLayoutEffect(() => {
    if (!actif || terminee.current === cle) return undefined;
    const f0 = commencer(cle);
    const f = () => { terminee.current = cle; f0(); };
    fin.current = f;
    const publie = (e) => { if (e && e.detail && e.detail.k === cle) f(); };
    window.addEventListener('vrm:save', publie);
    return () => { window.removeEventListener('vrm:save', publie); f(); fin.current = null; };
  }, [cle, actif]);
  React.useEffect(() => {
    if (!actif || !lu) return undefined;
    const t = setTimeout(() => { if (fin.current) fin.current(); }, BORNE_MS);
    return () => clearTimeout(t);
  }, [cle, actif, lu]);
}

// Le lecteur : l'ensemble des clés en préparation, relu à chaque changement.
export function useEnPreparation(cles) {
  const lire = () => cles.filter(enPreparation).join('|');
  const [v, setV] = React.useState(lire);
  // (23 nov., latence-2) Rien n'est posé quand l'ensemble n'a pas changé. Mesuré (banc fluidite-generale, build « profiling »,
  // `_sonde-style.cjs QUI2=Comptabilite`) : chaque préparation qui commence ou finit prévient TOUS les lecteurs, et
  // `setV(même valeur)` re-rendait quand même `Comptabilite` (≈ 200 ms à 390 ×4) — React ne court-circuite une valeur égale
  // que si le composant n'a aucune mise à jour en attente, jamais vrai pour un écran gardé qui revient. 112 poses par retour.
  const dernier = React.useRef(v); dernier.current = v;
  React.useEffect(() => {
    const f = () => { const n = lire(); if (n !== dernier.current) { dernier.current = n; setV(n); } };
    f();
    window.addEventListener('vrm:preparation', f);
    return () => window.removeEventListener('vrm:preparation', f);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cles.join('|')]);
  return React.useMemo(() => new Set(v ? v.split('|') : []), [v]);
}
