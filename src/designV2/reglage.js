// ════════════════════════════════════════════════════════════════════════════
//  LE NOUVEAU DESIGN « STUDIO PREMIUM » (17 nov.) — ALLUMÉ PAR DÉFAUT pour tous (Julien, 17 nov. soir : « publie le
//  design »). Paramètres → Apparence → « Ancien design » le ramène sur cet appareil (`vrm_design_v2` = '0') : l'app
//  est alors EXACTEMENT celle d'avant (rien de ce module ne rend quoi que ce soit, aucun attribut posé).
//  Le choix vit sur CET appareil (`vrm_design_v2`, localStorage) : c'est un essai — Julien l'allume
//  sur son iPhone, avec ses vraies photos, sans toucher ses autres appareils. Une lecture qui échoue
//  (navigation privée, stockage bloqué) vaut le défaut : allumé.
//  Allumé : `data-design="v2"` sur <html> (toutes les règles de src/designV2/design-v2.css en dépendent)
//  et les composants de src/designV2/ prennent la place des anciens, avec les MÊMES sources et règles.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';

export const CLE_DESIGN_V2 = 'vrm_design_v2';
const EVT = 'vrm:design-v2';

export function designV2Actif() {
  // Seul un « 0 » posé par SON geste (« Ancien design ») l'éteint ; absent ou illisible ⇒ allumé.
  try { return typeof localStorage === 'undefined' || localStorage.getItem(CLE_DESIGN_V2) !== '0'; } catch (_) { return true; }
}

function appliquer(on) {
  try {
    const r = document.documentElement;
    if (on) r.setAttribute('data-design', 'v2'); else r.removeAttribute('data-design');
  } catch (_) { /* sans document : rien */ }
}

export function poserDesignV2(on) {
  try { localStorage.setItem(CLE_DESIGN_V2, on ? '1' : '0'); } catch (_) { /* stockage bloqué : le choix ne tient que le temps de la page */ }
  appliquer(!!on);
  try { window.dispatchEvent(new Event(EVT)); } catch (_) {}
}

// Posé dès l'import (avant le premier rendu) : aucun éclair de l'ancien design.
if (typeof document !== 'undefined') appliquer(designV2Actif());

function abonner(f) {
  const g = (e) => { if (!e || e.type === EVT || e.key === CLE_DESIGN_V2) { appliquer(designV2Actif()); f(); } };
  window.addEventListener(EVT, g); window.addEventListener('storage', g);
  return () => { window.removeEventListener(EVT, g); window.removeEventListener('storage', g); };
}

export function useDesignV2() {
  return React.useSyncExternalStore(abonner, designV2Actif, () => true);
}
