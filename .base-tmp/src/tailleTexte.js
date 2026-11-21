// ════════════════════════════════════════════════════════════════════════════
//  LA TAILLE DU TEXTE CHOISIE DANS VRM (15 nov., Paramètres → Taille du texte)
// ════════════════════════════════════════════════════════════════════════════
// Quatre tailles : Normal · Grand · Plus grand · Très grand. Elles passent par LE
// mécanisme du « texte en grand » de l'appareil (src/grandTexte.js, `applyZoom`) :
// l'app dessine ses tailles en PIXELS (~3 000 `fontSize` en ligne, ~3 000 en CSS) —
// une famille de jetons ne toucherait qu'un tiers des textes, le reste resterait petit.
// L'échelle grossit textes, marges, cibles et photos ENSEMBLE et la mise en page se
// refait sur une largeur plus étroite : rien ne déborde, rien ne se coupe. La couche
// CSS `html[data-grand-texte]` (src/styles-lisible.css) porte ce qui doit changer
// alors (cases empilées, titres qui passent à la ligne, barre du bas à sa taille).
//
// Le choix de VRM S'AJOUTE à celui de l'appareil (iPhone : Taille du texte) : les deux
// se multiplient, bornés à `ECHELLE_MAX` (1,6 : au-delà, une colonne ne porte plus une
// carte). Rangé sur CET appareil (`vrm_taille_texte`, comme la densité `vrm_zoom`) :
// un iPhone et un grand écran ne veulent pas la même taille.
// Module PUR : exécuté par scripts/audit-atelier-arrivee.cjs (partie T).
// ════════════════════════════════════════════════════════════════════════════
import { ECHELLE_MAX } from './grandTexte.js';

export const CLE_TAILLE_TEXTE = 'vrm_taille_texte';
export const TAILLES_TEXTE = [
  { id: 'normal', f: 1 },
  { id: 'grand', f: 1.12 },
  { id: 'plusGrand', f: 1.24 },
  { id: 'tresGrand', f: 1.36 },
];
export const tailleValide = (v) => (TAILLES_TEXTE.some((t) => t.id === v) ? v : 'normal');
export const facteurTaille = (v) => (TAILLES_TEXTE.find((t) => t.id === tailleValide(v)) || TAILLES_TEXTE[0]).f;
// L'échelle totale : appareil × choix de VRM, au 0,01 près, bornée [1, ECHELLE_MAX].
export function echelleTotale(appareil, choix) {
  const a = Number.isFinite(Number(appareil)) && Number(appareil) >= 1 ? Number(appareil) : 1;
  const e = Math.round(a * facteurTaille(choix) * 100) / 100;
  return Math.min(ECHELLE_MAX, Math.max(1, e));
}
export function lireTailleTexte(stockage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  try { return tailleValide(stockage ? stockage.getItem(CLE_TAILLE_TEXTE) : null); } catch (_) { return 'normal'; }
}
export function ecrireTailleTexte(v, stockage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  const t = tailleValide(v);
  try { if (stockage) { if (t === 'normal') stockage.removeItem(CLE_TAILLE_TEXTE); else stockage.setItem(CLE_TAILLE_TEXTE, t); } } catch (_) {}
  return t;
}
