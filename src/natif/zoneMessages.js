// ── src/natif/zoneMessages.js — où se posent les messages passagers (19 nov., fiche directe) ──────────────────────
// Julien, sur la planche de la fiche : le bandeau « 24 nouvelles paires numérotées » passait par-dessus la fiche. Une page
// qui ne doit RIEN laisser recouvrir (la fiche) pose ici une zone DANS son contenu : la pile des messages s'y range (dans
// le flux, elle pousse la page au lieu de la couvrir) ; sans zone posée, la pile reste en bas de l'écran comme avant.
import React from 'react';

let zone = null;
const abonnes = new Set();
export function poserZoneMessages(el) {
  if (zone === el) return;
  zone = el || null;
  for (const f of abonnes) { try { f(); } catch (_) {} }
}
// Retire la zone seulement si c'est encore la sienne (deux fiches qui se succèdent ne s'effacent pas l'une l'autre).
export function retirerZoneMessages(el) { if (zone && zone === el) poserZoneMessages(null); }
const abonner = (f) => { abonnes.add(f); return () => abonnes.delete(f); };
const lire = () => (zone && zone.isConnected ? zone : null);
export function useZoneMessages() { return React.useSyncExternalStore(abonner, lire, () => null); }

// (23 nov., style-clarte-4 — « les toasts courts au-dessus de la barre du bas sans couvrir de chiffre ») LA PLACE DU BAS, au
// téléphone : un emplacement DANS le flux de la coque, entre l'écran qui défile et la barre d'onglets. Un message s'y pose :
// l'écran raccourcit de sa hauteur le temps du message, rien n'est recouvert (ni chiffre, ni bouton). Sans place posée
// (ordinateur), le message flotte comme avant.
let bas = null;
const abonnesBas = new Set();
export function poserPlaceBas(el) {
  if (bas === el) return;
  bas = el || null;
  for (const f of abonnesBas) { try { f(); } catch (_) {} }
}
const abonnerBas = (f) => { abonnesBas.add(f); return () => abonnesBas.delete(f); };
const lireBas = () => (bas && bas.isConnected ? bas : null);
export function usePlaceBas() { return React.useSyncExternalStore(abonnerBas, lireBas, () => null); }
