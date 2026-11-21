// ══════════════════════════════════════════════════════════════════════════════
//  ANNONCES EN GRILLE, RANGÉES PAR COMPTE (10 nov., lot AM)
// ══════════════════════════════════════════════════════════════════════════════
// Julien (9 nov., 21 h, demande 15) : « la disposition par compte de Vinted me
// plaît (grille de cartes : case, photo, N°, titre, état, prix) ⇒ la même pour
// Toutes, en gardant toutes les fonctions ; les propositions collées entre elles
// cachent le produit ».
//
// AFFICHAGE SEULEMENT. Ce module ne décide ni ce qui est « en ligne » (§5,
// `<enligne-regle>`), ni l'ordre : il REÇOIT la liste déjà triée de l'écran
// (`annShown`) et la range par compte en gardant l'ordre de chaque annonce
// (tri STABLE) ; un compte apparaît à la place de sa PREMIÈRE annonce (le compte
// de l'onglet, mis en tête par l'écran, reste donc en tête). Aucune annonce
// n'est ajoutée, retirée ou dédoublonnée ici : n en entrée = n en sortie.
// Exécuté par scripts/bancs/annonces-grille.cjs (rendu) — pur, sans React.
// ══════════════════════════════════════════════════════════════════════════════

// `liste` : les annonces dans l'ordre de l'écran ; `uidDe(it)` : le compte (chaîne).
// Rend [{ uid, items }] — chaque annonce une fois, dans son ordre d'origine.
export function groupesParCompte(liste, uidDe) {
  const groupes = [];
  const par = new Map();
  for (const it of Array.isArray(liste) ? liste : []) {
    const u = String((uidDe ? uidDe(it) : '') || '');
    let g = par.get(u);
    if (!g) { g = { uid: u, items: [] }; par.set(u, g); groupes.push(g); }
    g.items.push(it);
  }
  return groupes;
}

// L'initiale d'un compte, comme la carte du compte de la colonne (une lettre ou un
// chiffre, en majuscule) ; rien de lisible ⇒ « ? » (jamais une lettre inventée).
export function initialeCompte(nom) {
  const m = String(nom || '').trim().match(/[\p{L}\p{N}]/u);
  return m ? m[0].toUpperCase() : '?';
}

// Les propositions « Même paire ? » qui vivent SUR leur vignette : celles dont la
// nouvelle annonce est dans la grille montrée. Les autres restent en tête (rien
// n'est perdu : une proposition dont l'annonce est filtrée reste atteignable).
export function remisesSurVignettes(remises, idsGrille) {
  const ids = idsGrille instanceof Set ? idsGrille : new Set();
  const sur = new Map(); const tete = [];
  for (const r of Array.isArray(remises) ? remises : []) {
    if (!r) continue;
    const k = String(r.nouvelle);
    if (ids.has(k) && !sur.has(k)) sur.set(k, r); else tete.push(r);
  }
  return { sur, tete };
}
