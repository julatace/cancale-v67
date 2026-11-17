// ── src/design/maquette.js — le RÉGLAGE DE BANC des maquettes d'onglets (17 nov.) ──
// Julien (17 nov.) : « améliore la disposition des onglets et le design, ce n'est pas optimal » ;
// « lance des agents qui vont faire des maquettes ». Une maquette est rendue dans la VRAIE app,
// sur une base inventée, derrière ce réglage : `localStorage.vrm_maquette` (« c » = proposition C
// « Studio » ; « c2 » = C2 « Studio compact », qui garde tout C et ajoute src/design/maquette-c2.css).
// Seul un banc l'écrit (scripts/bancs/_maquette-c-captures.cjs) : aucun écran, aucun
// lien, aucun paramètre de VRM ne le pose — pour un vendeur, rien ne change.
// Lu UNE fois au chargement du module (avant le premier rendu) et estampillé sur la racine
// (`html[data-maquette="c"]`, et en plus `html[data-maquette-c2]` pour C2) : les feuilles de la
// maquette sont toutes visées par ces sélecteurs.
const VALEURS = new Set(['c', 'c2']);
function lue() {
  try { const v = String(localStorage.getItem('vrm_maquette') || ''); return VALEURS.has(v) ? v : ''; } catch (_) { return ''; }
}
export function maquetteActive() { const v = lue(); return v === 'c2' ? 'c' : v; }
export const MAQUETTE = maquetteActive();
export const MAQUETTE_C2 = lue() === 'c2';
try {
  if (MAQUETTE && typeof document !== 'undefined') document.documentElement.setAttribute('data-maquette', MAQUETTE);
  if (MAQUETTE_C2 && typeof document !== 'undefined') document.documentElement.setAttribute('data-maquette-c2', '');
} catch (_) {}
