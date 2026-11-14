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
// (14 nov.) VIDE : le réseau du conteneur de la session a refusé les hôtes des
// sources permises (commons.wikimedia.org, upload.wikimedia.org,
// api.openverse.org, unsplash.com, images.unsplash.com, www.pexels.com,
// images.pexels.com — refus 403 du proxy au CONNECT). Rien n'a été mis à la
// place : pas de photo d'origine inconnue. Récit :
// docs/passation/2026-11-14-exemple-photos.md (« Pour ajouter les photos »).
//
// Forme d'une entrée :
//   { fichier: 'nike-air-max-90-blanche', marque: 'Nike', modele: 'Air Max 90', couleur: 'blanche' }
export const PHOTOS_EXEMPLE = [];

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
