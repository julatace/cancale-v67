// ── src/natif/styleChoix.js — le STYLE choisi (Paramètres → Apparence → Style), 24 nov. 2026 ─────────────────────
// Julien : « propose un design un peu plus foncé […] améliore tous les boutons […] essaye un peu de changer de style
// pour l'iPhone » ; puis dix styles à essayer DANS l'app (docs/passation/2026-11-24-style-graphite.md).
// Un style = un attribut `data-style` sur la racine ; tout le reste est en CSS (src/natif/styles-choix*.css).
// '' (rien) = le style actuel, inchangé, par défaut. Rangé sur CET appareil (`vrm_style`), comme le mode sombre
// d'un iPhone : il essaie sur son téléphone sans changer son ordinateur. Posé AVANT le premier rendu par
// public/demarrage-theme.js (même clé, même liste), puis ici à l'import.
export const CLE_STYLE = 'vrm_style';
export const STYLES = Object.freeze(['graphite', 'ardoise', 'pierre', 'encre', 'papier', 'verre', 'nuit', 'menthe', 'studio', 'arcade']);

export function styleLu() {
  try { const v = JSON.parse(localStorage.getItem(CLE_STYLE) || 'null'); return STYLES.includes(v) ? v : ''; } catch (_) { return ''; }
}
export function poserStyleRacine(id) {
  try { const r = document.documentElement; if (STYLES.includes(id)) r.setAttribute('data-style', id); else r.removeAttribute('data-style'); } catch (_) { /* sans document */ }
}
// Le choix : appliqué tout de suite (aucun rechargement), rangé, annoncé aux autres écrans ouverts.
export function choisirStyle(id) {
  const v = STYLES.includes(id) ? id : '';
  poserStyleRacine(v);
  try { if (v) localStorage.setItem(CLE_STYLE, JSON.stringify(v)); else localStorage.removeItem(CLE_STYLE); } catch (_) { /* navigation privée */ }
  try { window.dispatchEvent(new CustomEvent('vrm-style', { detail: v })); } catch (_) {}
  return v;
}
if (typeof document !== 'undefined') poserStyleRacine(styleLu());
