// ── COMPTE BLOQUÉ : LES DEUX LECTURES, PARTAGÉES PAR TOUTE L'APP (19 nov.) ───────
// La règle : src/compteBloque.js. Ici, la mémoire du module :
//   · `etats` : `panel_comptes_etat.comptes` (lecture projetée, partagée par
//     src/etatsComptesLecture.js) — undefined en cours · null pas su · objet lu ;
//   · `choix` : `main.vrm_comptes_bloques` (SYNC_KEYS), lu par `load`.
// Relu au montage, au retour sur l'onglet, quand l'extension dit « etatcompte »,
// au retour du nuage et toutes les 5 min. Les écrans qui calculent (Annonces, la
// coque) lisent `uidsEnPauseConnus()` / `uidsBloquesConnus()` sans attendre : pas su
// ⇒ Set vide (rien n'est retiré d'un total sur un doute).
import React from 'react';
import { load, onCloudReady } from './App.jsx';
import { lireEtatsComptes } from './etatsComptesLecture.js';
import { CLE_COMPTES_BLOQUES, uidsEnPause, uidsBloques } from './compteBloque.js';

let etats;              // undefined · null · objet
const abonnes = new Set();
let pause = new Set(), bloques = new Set(), signature = '';
const choixLu = () => { const c = load(CLE_COMPTES_BLOQUES, {}); return c && typeof c === 'object' ? c : {}; };
function recalculer() {
  const c = choixLu();
  const p = etats && typeof etats === 'object' ? uidsEnPause(c, etats) : new Set();
  const b = etats && typeof etats === 'object' ? uidsBloques(etats) : new Set();
  const sig = [...p].sort().join(',') + '|' + [...b].sort().join(',') + '|' + JSON.stringify(c) + '|' + (etats === undefined ? 'u' : etats === null ? 'n' : JSON.stringify(etats));
  if (sig === signature) return;
  signature = sig; pause = p; bloques = b;
  for (const f of abonnes) { try { f(); } catch (_) {} }
  try { window.dispatchEvent(new CustomEvent('vrm:comptes-bloques')); } catch (_) {}
}
let enCours = null;
export function relireComptesBloques() {
  if (enCours) return enCours;
  enCours = lireEtatsComptes().then((v) => { if (v !== null || etats === undefined) etats = v; recalculer(); }, () => { if (etats === undefined) etats = null; recalculer(); })
    .finally(() => { enCours = null; });
  return enCours;
}
export const uidsEnPauseConnus = () => pause;
export const uidsBloquesConnus = () => bloques;
export const etatsComptesConnus = () => etats;
// Après SON toucher (save de la clé) : recalcul tout de suite.
export const choixComptesBloquesChange = () => recalculer();

let ecoutes = false;
function ecouter() {
  if (ecoutes || typeof window === 'undefined') return;
  ecoutes = true;
  window.addEventListener('vrm:ext', (e) => { const d = e && e.detail; if (d && d.type === 'maj' && d.quoi === 'etatcompte') setTimeout(relireComptesBloques, 1500); });
  window.addEventListener('vrm:save', (e) => { if (e && e.detail && e.detail.k === CLE_COMPTES_BLOQUES) recalculer(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') relireComptesBloques(); });
  try { onCloudReady(recalculer); } catch (_) {}
  setInterval(() => { if (document.visibilityState === 'visible') relireComptesBloques(); }, 5 * 60 * 1000);
}

// Le crochet : { etats, choix, pause, bloques } — rerendu quand l'un change.
export function useComptesBloques() {
  const [, maj] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => {
    abonnes.add(maj);
    ecouter();
    if (etats === undefined) relireComptesBloques();
    return () => { abonnes.delete(maj); };
  }, []);
  return { etats, choix: choixLu(), pause, bloques };
}
