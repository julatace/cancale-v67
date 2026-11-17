// ── src/design/maquette.js — le RÉGLAGE DE BANC des maquettes d'onglets (17 nov.) ──
// Julien (17 nov.) : « améliore la disposition des onglets et le design, ce n'est pas optimal » ;
// « lance des agents qui vont faire des maquettes ». Une maquette est rendue dans la VRAIE app,
// sur une base inventée, derrière ce réglage : `localStorage.vrm_maquette` (« c » = proposition C
// « Studio »). Seul un banc l'écrit (scripts/bancs/_maquette-c-captures.cjs) : aucun écran, aucun
// lien, aucun paramètre de VRM ne le pose — pour un vendeur, rien ne change.
// Lu UNE fois au chargement du module (avant le premier rendu) et estampillé sur la racine
// (`html[data-maquette="c"]`) : les feuilles de la maquette sont toutes visées par ce sélecteur.
// (17 nov.) « c3 » = proposition C3 « Studio × iOS » : la C (même attribut `data-maquette="c"`) + les gestes de B,
// posés par `data-maquette-c3` (src/design/maquette-c3.css).
const VALEURS = new Set(['c', 'c3']);
export function maquetteActive() {
  try { const v = String(localStorage.getItem('vrm_maquette') || ''); return VALEURS.has(v) ? v : ''; } catch (_) { return ''; }
}
const BRUTE = maquetteActive();
export const MAQUETTE = BRUTE === 'c3' ? 'c' : BRUTE;
export const MAQUETTE_C3 = BRUTE === 'c3';
try {
  if (MAQUETTE && typeof document !== 'undefined') document.documentElement.setAttribute('data-maquette', MAQUETTE);
  if (MAQUETTE_C3 && typeof document !== 'undefined') document.documentElement.setAttribute('data-maquette-c3', '');
} catch (_) {}
