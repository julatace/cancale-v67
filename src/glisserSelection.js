// ═══════════════════════════════════════════════════════════════════════════
// SÉLECTIONNER EN GLISSANT LE DOIGT, COMME DANS PHOTOS (14 nov. 2026, chantier 93)
// ═══════════════════════════════════════════════════════════════════════════
// Dans une liste à cases (Annonces → Sélectionner), poser le doigt (ou la souris)
// sur une CASE puis glisser vers le haut ou le bas coche (ou décoche) toutes les
// lignes entre la première et celle sous le doigt :
//   · l'état voulu est celui de la PREMIÈRE case inversé (partir d'une case vide
//     coche, partir d'une case cochée décoche) ;
//   · revenir en arrière rend aux lignes quittées leur état d'AVANT le geste ;
//   · près du bord haut ou bas de la zone qui défile, la liste défile seule (plus
//     vite près du bord) ;
//   · une ligne qui ne peut pas être cochée (« en vérification », sa raison) reste
//     telle quelle ;
//   · le geste ne part QUE d'une case (`touch-action:none` sur elle seule) : ailleurs
//     le doigt fait défiler la liste comme avant. Les cases restent de vraies cases
//     (VoiceOver les coche une par une).
// Module PUR — scripts/audit-listes-recherche.cjs ; le geste : src/ui/useGlisserSelection.js.

// Les clés entre `ancre` et `cle` dans l'ORDRE AFFICHÉ (bornes comprises) ; [] si l'une manque.
export function plageGlissee(ordre, ancre, cle) {
  const l = Array.isArray(ordre) ? ordre : [];
  const i = l.indexOf(ancre), j = l.indexOf(cle);
  if (i < 0 || j < 0) return [];
  return i <= j ? l.slice(i, j + 1) : l.slice(j, i + 1);
}
// La sélection pendant le geste : `avant` (Set des clés cochées au départ), la plage,
// l'état voulu (`coche`) ; `exclues` (Set) ne bougent jamais. Rend un Set.
export function selectionGlissee(avant, plage, coche, exclues = new Set()) {
  const out = new Set(avant || []);
  for (const k of plage || []) { if (exclues.has(k)) continue; if (coche) out.add(k); else out.delete(k); }
  return out;
}
// La vitesse du défilement automatique (px par image) : 0 hors des bords, jusqu'à `max`
// tout contre le bord. `y` : le doigt ; `haut`/`bas` : la zone visible qui défile.
export function vitesseBord(y, haut, bas, { zone = 72, max = 22 } = {}) {
  if (!Number.isFinite(y)) return 0;
  if (y < haut + zone) return -Math.ceil(max * Math.min(1, (haut + zone - y) / zone));
  if (y > bas - zone) return Math.ceil(max * Math.min(1, (y - (bas - zone)) / zone));
  return 0;
}
