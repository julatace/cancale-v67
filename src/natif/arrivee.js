// ── src/natif/arrivee.js — « sans latence » (24 nov., Julien : « fais quelque chose sans latence ») ─────────────────────
// Une seule question : ce contenu ARRIVE-t-il pour la première fois sous les yeux, ou est-il déjà connu ?
//   · déjà connu au premier rendu (cache, visite d'avant, retour sur l'écran) ⇒ `false` : il s'affiche tel quel, à la
//     première image, sans fondu ni pousse ;
//   · pas encore là au premier rendu, puis là, et jamais vu dans cette session ⇒ `true` le temps de ce montage : l'appelant
//     pose alors une apparition COURTE (≤ 200 ms, décalage ≤ 15 ms par élément, ≤ 120 ms au total — jeu.css / argent-visuel.css).
// Rien n'attend jamais : la donnée est rendue dès qu'elle existe, l'animation se joue PENDANT, jamais avant.
// `prefers-reduced-motion` est traité par le CSS (aucune animation).
import React from 'react';

const VUS = new Set();
const CLE = 'vrm_vu_arrivee';
const lireVus = () => { try { const s = sessionStorage.getItem(CLE); return s ? JSON.parse(s) : []; } catch (_) { return []; } };
const dejaVu = (cle) => VUS.has(cle) || lireVus().includes(cle);
const marquer = (cle) => {
  if (VUS.has(cle)) return; VUS.add(cle);
  try { const l = lireVus(); if (!l.includes(cle)) { l.push(cle); sessionStorage.setItem(CLE, JSON.stringify(l.slice(-60))); } } catch (_) { /* sans stockage : la mémoire du module suffit */ }
};

// `cle` : un nom stable du bloc (« argent-mois6 ») ; `pret` : la donnée est là (lue OU « pas su » : les deux sont une réponse).
export function useArriveeNeuve(cle, pret) {
  const [attendait] = React.useState(() => !pret && !dejaVu(cle));
  React.useEffect(() => { if (pret) marquer(cle); }, [cle, pret]);
  return attendait && !!pret;
}

// Le décalage d'un élément de liste : 15 ms par rang, plafonné à 8 rangs (120 ms au total).
export const RETARD_PAS = 15, RETARD_MAX = 8;
export const retard = (i) => Math.min(Math.max(0, i | 0), RETARD_MAX) * RETARD_PAS;
