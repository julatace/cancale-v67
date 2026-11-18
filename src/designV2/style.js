// ════════════════════════════════════════════════════════════════════════════
//  LE STYLE (18 nov., Julien trouve le design « atroce » ; l'app qu'il trouve belle : Apple — Wallet, Réglages).
//  Paramètres → Apparence → « Style » : « Studio bleu » (celui d'hier, le défaut) ou « Apple » (src/designV2/theme-apple.css).
//  Le choix vit sur CET appareil (`vrm_style`, localStorage) : un essai — Julien l'allume sur son iPhone, avec ses vraies
//  données, sans toucher ses autres appareils. Rien d'autre ne change : aucun écran, aucune règle, aucune donnée.
//  Allumé : `data-theme-style="apple"` sur <html> (toutes les règles de theme-apple.css en dépendent). Éteint (absent,
//  « studio », illisible, stockage bloqué) : aucun attribut, l'app est exactement celle d'avant.
//  Posé AVANT le premier rendu par public/demarrage-theme.js (même clé, même valeur) puis ici, à l'import.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import './theme-apple.css';

export const CLE_STYLE = 'vrm_style';
export const STYLES = ['apple', 'studio'];
const EVT = 'vrm:style';

export function styleActif() {
  try { return typeof localStorage !== 'undefined' && localStorage.getItem(CLE_STYLE) === 'apple' ? 'apple' : 'studio'; } catch (_) { return 'studio'; }
}

function appliquer(s) {
  try {
    const r = document.documentElement;
    if (s === 'apple') r.setAttribute('data-theme-style', 'apple'); else r.removeAttribute('data-theme-style');
    // La barre d'état d'iOS prend le fond de la page (plus le bleu du verre).
    const m = document.querySelector('meta[name="theme-color"]');
    if (m && s === 'apple') m.setAttribute('content', r.getAttribute('data-theme') === 'dark' ? '#000000' : '#F2F2F7');
  } catch (_) { /* sans document : rien */ }
}

export function poserStyle(s) {
  const v = s === 'apple' ? 'apple' : 'studio';
  try { localStorage.setItem(CLE_STYLE, v); } catch (_) { /* stockage bloqué : le choix ne tient que le temps de la page */ }
  appliquer(v);
  try { window.dispatchEvent(new Event(EVT)); } catch (_) {}
}

if (typeof document !== 'undefined') appliquer(styleActif());

function abonner(f) {
  const g = (e) => { if (!e || e.type === EVT || e.key === CLE_STYLE) { appliquer(styleActif()); f(); } };
  window.addEventListener(EVT, g); window.addEventListener('storage', g);
  return () => { window.removeEventListener(EVT, g); window.removeEventListener('storage', g); };
}

export function useStyle() {
  return React.useSyncExternalStore(abonner, styleActif, () => 'studio');
}
