// ── LES PHOTOS DU MODE EXEMPLE (14 nov.) ─────────────────────────────────────
// Julien : « fais des exemples avec des photos pour les annonces ».
// ⚠️ Seulement de VRAIES photos de sneakers sous une licence qui permet de les
//    embarquer dans un dépôt PUBLIC et une app commerciale : CC0 / domaine public
//    (Wikimedia Commons, Openverse filtré CC0), Unsplash License, Pexels License.
//    Chaque photo a SA ligne dans public/exemple/CREDITS.md (auteur, page source,
//    licence vérifiée SUR la page source), et ses deux fichiers WebP
//    `public/exemple/{fichier}-400.webp` et `-120.webp` (< 40 Ko chacun).
//    Aucune photo d'une vraie annonce Vinted, aucune personne identifiable.
//    `scripts/audit-exemple-photos.cjs` refuse une photo sans crédit, une licence
//    hors liste, un fichier trop lourd ou une entrée ici sans ses fichiers.
// ⚠️ UNE photo = UNE paire. VRM tient deux fiches au même fichier photo pour la
//    MÊME paire (`jumellesParPhoto`, CLAUDE.md §5) : une photo n'est donc jamais
//    donnée à deux paires d'exemple différentes — sans photo propre, une paire
//    garde sa vignette neutre (src/exempleDonnees.js, `photoDeLaPaire`).
// ⚠️ La marque, le modèle et la couleur d'une entrée décrivent CE QU'ON VOIT sur
//    la photo : le titre de l'exemple en est tiré (titre ⇔ photo cohérents).
//
// (14 nov.) 21 photos de Wikimedia Commons (CC0 ou domaine public versé par
// l'auteur), recadrées en carré (la paire entière, sur un fond tiré de la photo).
// L'ORDRE compte : l'entrée n° k est la photo de la paire d'exemple n° k
// (annonces 0-11, ventes 12-15, achats 16-18) ; les deux dernières sont de
// réserve (pour remplacer une photo retirée sans en chercher une autre).
// Récit : docs/passation/2026-11-14-exemple-photos.md.
//
// Forme d'une entrée :
//   { fichier: 'nike-air-max-90-blanche', marque: 'Nike', modele: 'Air Max 90', couleur: 'blanche' }
export const PHOTOS_EXEMPLE = [
  { fichier: 'adidas-samba-og-blanche', marque: 'Adidas', modele: 'Samba OG', couleur: 'blanche' },
  { fichier: 'nike-air-force-1-blanche', marque: 'Nike', modele: 'Air Force 1', couleur: 'blanche' },
  { fichier: 'new-balance-574-grise', marque: 'New Balance', modele: '574', couleur: 'grise' },
  { fichier: 'adidas-sl-72-og-rouge', marque: 'Adidas', modele: 'SL 72 OG', couleur: 'rouge' },
  { fichier: 'nike-dunk-low-noire-blanche', marque: 'Nike', modele: 'Dunk Low', couleur: 'noire et blanche' },
  { fichier: 'puma-suede-noire', marque: 'Puma', modele: 'Suede', couleur: 'noire' },
  { fichier: 'new-balance-550-blanche-bordeaux', marque: 'New Balance', modele: '550', couleur: 'blanche et bordeaux' },
  { fichier: 'nike-air-tailwind-grise-bleue', marque: 'Nike', modele: 'Air Tailwind', couleur: 'grise et bleue' },
  { fichier: 'adidas-sl-72-rs-bleue', marque: 'Adidas', modele: 'SL 72 RS', couleur: 'bleue' },
  { fichier: 'nike-zoom-vomero-5-argent', marque: 'Nike', modele: 'Zoom Vomero 5', couleur: 'argent' },
  { fichier: 'new-balance-numeric-480-marron', marque: 'New Balance', modele: 'Numeric 480', couleur: 'marron et verte' },
  { fichier: 'adidas-superstar-blanche', marque: 'Adidas', modele: 'Superstar', couleur: 'blanche' },
  { fichier: 'nike-cortez-blanche-rouge', marque: 'Nike', modele: 'Cortez', couleur: 'blanche et rouge' },
  { fichier: 'new-balance-1906r-argent', marque: 'New Balance', modele: '1906R', couleur: 'argent' },
  { fichier: 'adidas-handball-spezial-noire', marque: 'Adidas', modele: 'Handball Spezial', couleur: 'noire' },
  { fichier: 'nike-air-max-90-blanche', marque: 'Nike', modele: 'Air Max 90', couleur: 'blanche' },
  { fichier: 'nike-terminator-low-rose-grise', marque: 'Nike', modele: 'Terminator Low', couleur: 'rose et grise' },
  { fichier: 'adidas-forum-low-blanche', marque: 'Adidas', modele: 'Forum Low', couleur: 'blanche' },
  { fichier: 'adidas-nmd-r1-bleu-marine', marque: 'Adidas', modele: 'NMD R1', couleur: 'bleu marine' },
  { fichier: 'adidas-campus-00s-marron', marque: 'Adidas', modele: 'Campus 00s', couleur: 'marron' },
  { fichier: 'nike-air-max-ltd-2-grise', marque: 'Nike', modele: 'Air Max LTD 2', couleur: 'grise' },
];

// Les licences permises (la même liste que l'audit) et la page source attendue.
export const LICENCES_PERMISES = {
  'CC0 1.0': /^https:\/\/(commons\.wikimedia\.org|openverse\.org|www\.openverse\.org)\//,
  'Domaine public': /^https:\/\/(commons\.wikimedia\.org|openverse\.org|www\.openverse\.org)\//,
  'Unsplash License': /^https:\/\/unsplash\.com\//,
  'Pexels License': /^https:\/\/www\.pexels\.com\//,
};

// La photo (forme Vinted : `{ url, thumbnails }`) de la paire d'exemple n° `k`,
// ou null. `origine` : l'origine de la page (les photos sont servies par
// `public/`, jamais par un autre hôte — CSP) ; sans origine, aucune photo.
export function photoDeLaPaire(k, origine) {
  if (!origine || !Number.isInteger(k) || k < 0 || k >= PHOTOS_EXEMPLE.length) return null;
  const p = PHOTOS_EXEMPLE[k];
  const base = String(origine).replace(/\/+$/, '') + '/exemple/' + p.fichier;
  return { url: base + '-400.webp', full_size_url: base + '-400.webp', thumbnails: [{ type: 'thumb150x150', url: base + '-120.webp' }], exemple: true };
}

// Ce que la photo montre, pour le titre : null sans photo propre.
export const descriptionDeLaPaire = (k) => (Number.isInteger(k) && k >= 0 && k < PHOTOS_EXEMPLE.length ? PHOTOS_EXEMPLE[k] : null);
