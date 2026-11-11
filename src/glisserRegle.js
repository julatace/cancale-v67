// ════════════════════════════════════════════════════════════════════════════
//  GLISSER POUR AGIR — LA RÈGLE (11 nov. 2026, lot « gestes-glisser »)
//  Module PUR (aucun DOM) : ce que décide un glisser vers la GAUCHE sur une
//  ligne, comme Mail sur iPhone. Exécuté tel quel par
//  `scripts/audit-ligne-glissable.cjs` ; le composant `src/LigneGlissable.jsx`
//  ne fait que l'appliquer.
//
//   · le geste ne part pas du BORD GAUCHE de l'écran (le retour arrière d'iOS
//     vit là) : un appui à moins de `BORD` px est ignoré ;
//   · la direction se décide après `AMORCE` px : franchement horizontal
//     (|dx| > 1,4 |dy|) ET vers la gauche ⇒ 'h' ; sinon 'v' et la ligne ne bouge
//     plus de tout le geste (le défilement reste au navigateur, `pan-y`) ;
//   · la ligne suit le doigt ; au-delà des actions elle résiste (élastique), au
//     seuil LONG elle s'offre entière à l'action principale ;
//   · relâchée : au-delà du seuil long ⇒ l'action PRINCIPALE (la même fonction
//     que son bouton, mêmes garde-fous) ; au-delà de la moitié des actions (ou un
//     coup de doigt rapide) ⇒ le tiroir reste ouvert ; sinon elle revient.
//     Rien d'autre : un glisser n'écrit rien de lui-même.
// ════════════════════════════════════════════════════════════════════════════

export const AMORCE = 10;          // px avant de décider la direction
export const BORD = 24;            // px : le bord gauche de l'écran est au retour arrière d'iOS
export const LARGEUR_ACTION = 76;  // px par action révélée (cible ≥ 44 px)
export const PART_LONG = 0.55;     // part de la largeur de la ligne pour l'action principale
export const MARGE_LONG = 64;      // … et au moins 64 px au-delà des actions révélées
export const VITESSE_OUVRE = 0.5;  // px/ms : un coup de doigt rapide ouvre le tiroir

export const largeurActions = (n) => Math.max(0, Number(n) || 0) * LARGEUR_ACTION;

// Le seuil (en px, positif) au-delà duquel le relâcher déclenche l'action principale.
export function seuilLong(largeur, nActions) {
  const w = Math.max(1, Number(largeur) || 360);
  return Math.max(w * PART_LONG, largeurActions(nActions) + MARGE_LONG);
}

// L'appui peut-il commencer un glisser ? (`x` : position dans la fenêtre)
export function departPermis(x, typePointeur) {
  if (typePointeur === 'mouse') return false;          // la souris sélectionne du texte, le clic a ses boutons
  return Number(x) >= BORD;
}

// Le sens d'un geste après l'amorce : 'h' (glisser à GAUCHE), 'v' (le reste) ou null (trop tôt).
// `ouvert` : le tiroir est déjà ouvert — un glisser vers la droite le referme (horizontal aussi).
export function sensGeste(dx, dy, ouvert = false) {
  if (Math.abs(dx) < AMORCE && Math.abs(dy) < AMORCE) return null;
  const horizontal = Math.abs(dx) > Math.abs(dy) * 1.4;
  if (!horizontal) return 'v';
  return dx < 0 || ouvert ? 'h' : 'v';
}

// La position affichée (px, ≤ 0) pour un déplacement `dx` depuis la position de départ `x0`.
// Linéaire jusqu'au seuil long, puis élastique (jamais un arrêt sec) ; jamais vers la droite.
export function positionGlisse(x0, dx, largeur, nActions) {
  const brut = Math.min(0, (Number(x0) || 0) + (Number(dx) || 0));
  const w = Math.max(1, Number(largeur) || 360);
  const s = seuilLong(w, nActions);
  const d = -brut;
  if (d <= s) return brut;
  const au = d - s, c = 0.55;
  return -(s + (au * w * c) / (w + c * au));
}

// Le relâcher : 'principale' | 'ouvrir' | 'fermer'.
// `pos` : la position (≤ 0) au relâcher ; `vitesse` : px/ms vers la gauche (> 0) ou la droite (< 0).
export function decision(pos, largeur, nActions, vitesse = 0) {
  const d = -Math.min(0, Number(pos) || 0);
  const wa = largeurActions(nActions);
  if (nActions > 0 && d >= seuilLong(largeur, nActions)) return 'principale';
  if (wa > 0 && vitesse <= -VITESSE_OUVRE) return 'fermer';
  if (wa > 0 && (d >= wa / 2 || (d > AMORCE * 2 && vitesse >= VITESSE_OUVRE))) return 'ouvrir';
  return 'fermer';
}

// Les actions retenues : au plus deux, chacune avec un libellé et un geste (fonction ou lien).
// La PRINCIPALE est la première : c'est elle qui est au bord droit et que le glisser long déclenche.
export function actionsRetenues(actions) {
  return (Array.isArray(actions) ? actions : [])
    .filter((a) => a && a.libelle && (typeof a.faire === 'function' || (typeof a.href === 'string' && a.href)))
    .slice(0, 2);
}
