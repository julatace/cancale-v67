// ════════════════════════════════════════════════════════════════════════════
//  LE DESIGN DU 17 NOV. EST LE SEUL (19 nov., décision « VRM natif », docs/design/NATIF.md) : le réglage « Ancien
//  design » (Paramètres → Apparence, `vrm_design_v2` = '0') a DISPARU. Un '0' rangé hier sur un appareil ne compte plus.
//  `data-design="v2"` reste posé sur <html> : les règles de src/designV2/*.css en dépendent encore.
//
//  ⚠️ ÉCHAFAUDAGE DE BANCS, PAS UN RÉGLAGE : les branches `!designV2` des écrans (le DOM d'avant le 17 nov.) vivent
//  encore dans src/App.jsx, et ~180 bancs jugent des règles MÉTIER (numéros, colis, chiffres) sur ce DOM-là. Tant que
//  ces écrans ne sont pas réécrits en natif (chacun retire alors sa branche et met son banc à jour), un banc peut
//  demander ce DOM par `vrm_banc_dom_ancien` = '1' (posé par scripts/bancs/_garde-reseau.cjs, jamais par l'app : aucun
//  écran, aucun lien, aucune synchronisation ne l'écrit). À retirer avec la dernière branche `!designV2`.
// ════════════════════════════════════════════════════════════════════════════
export const CLE_DOM_ANCIEN_BANC = 'vrm_banc_dom_ancien';

export function designV2Actif() {
  try { return typeof localStorage === 'undefined' || localStorage.getItem(CLE_DOM_ANCIEN_BANC) !== '1'; } catch (_) { return true; }
}

// Posé dès l'import (avant le premier rendu).
if (typeof document !== 'undefined') {
  try { const r = document.documentElement; if (designV2Actif()) r.setAttribute('data-design', 'v2'); else r.removeAttribute('data-design'); } catch (_) { /* sans document : rien */ }
}

// Le choix ne change pas pendant la vie de la page : une simple lecture (plus d'abonnement, plus d'événement).
const ACTIF = designV2Actif();
export function useDesignV2() { return ACTIF; }
