// ═══════════════════════════════════════════════════════════════════════════
// VÉRIFIER UNE ANNONCE AVANT DE LA PUBLIER (3 nov., choisie par Julien)
// ═══════════════════════════════════════════════════════════════════════════
// Au moment de « Publier sur Leboncoin », « Publier sur eBay », « Préparer sur
// Vestiaire » et « Republier », une liste COURTE des problèmes bloquants ou
// probables, une ligne par problème avec le geste qui le corrige. « Publier
// quand même » reste possible : c'est une vérification, jamais une garde.
// Aucun prix conseillé (refusé le 11 oct.) : sous le prix d'achat se DIT, on
// ne propose aucun montant.
//
// Règle PURE (aucune lecture), exécutée par scripts/audit-verif-annonce.cjs.
// Trois états partout (§5) : un champ `undefined` n'est pas jugé (le site ne
// le demande pas, ou VRM ne le lit pas) ; `''` / `null` explicite = ABSENT.
//   titre      : le titre qui partira (string) ;
//   taille     : la taille ; jugée seulement pour une famille qui en a une ;
//   famille    : 'chaussures' · 'vetements' · 'sacs' · 'accessoires' · 'bijoux' · '' ;
//   marque, categorie : string ;
//   nPhotos    : le nombre de photos qui partiront (number) ;
//   prix, achat : nombres (achat null = pas connu ⇒ pas jugé).
//
// Les limites de titre sont celles MESURÉES dans le code existant :
//   Leboncoin 50 (`LBC_TITRE_MAX`, app et extension) · eBay 80 (champ
//   `maxLength` de la mise en vente, `EBAY_TITRE_MAX` de l'extension) · Vinted
//   100 (refus de `recreerVinted`, « titre limité à 100 caractères »).
//   Vestiaire : aucune limite connue ⇒ pas jugé.
export const TITRE_MAX = { lbc: 50, ebay: 80, vinted: 100 };
export const PHOTOS_MIN = 3;
export const SITES_VERIF = { lbc: 'Leboncoin', ebay: 'eBay', vestiaire: 'Vestiaire', vinted: 'Vinted' };
const SANS_TAILLE = new Set(['sacs', 'accessoires', 'bijoux']);

const vide = (v) => v == null || String(v).trim() === '';
const num = (v) => { if (v == null || v === '') return null; const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };
const eur = (v) => (Number.isInteger(v) ? `${v} €` : `${v.toFixed(2).replace('.', ',')} €`);

// Le geste, selon où l'annonce se corrige : sur la fiche de VRM (Leboncoin,
// eBay) ou à la source, sur Vinted (Vestiaire et Republier reprennent Vinted).
const GESTES = {
  lbc: { taille: 'Ajoute la taille sur l’annonce Vinted', photos: 'Ouvre l’annonce sur Vinted : ses photos arrivent ici', prix: 'Corrige le prix dans la fiche', titre: 'Raccourcis le titre dans la fiche', marque: 'Ajoute la marque sur l’annonce Vinted', categorie: 'Précise le titre (le type d’article)' },
  ebay: { taille: 'Remplis la pointure dans les caractéristiques', photos: 'Ajoute des photos', prix: 'Corrige le prix', titre: 'Raccourcis le titre', marque: 'Remplis la marque dans les caractéristiques', categorie: 'Choisis la catégorie' },
  vestiaire: { taille: 'Ajoute la taille sur l’annonce Vinted', photos: 'Ouvre l’annonce sur Vinted : ses photos arrivent ici', prix: 'Corrige le prix sur Vinted', titre: 'Raccourcis le titre sur Vinted', marque: 'Ajoute la marque sur l’annonce Vinted', categorie: 'Choisis la catégorie sur Vestiaire' },
  vinted: { taille: 'Ajoute la taille sur Vinted', photos: 'Ajoute des photos sur Vinted', prix: 'Change le prix dans Republier', titre: 'Raccourcis le titre dans Republier', marque: 'Ajoute la marque sur Vinted', categorie: 'Choisis la catégorie sur Vinted' },
};

// → [{ code, texte, geste }] dans un ordre fixe (le plus bloquant d'abord).
export function problemesAnnonce(a, site) {
  const x = a || {};
  const g = GESTES[site] || GESTES.vinted;
  const out = [];
  const pose = (code, texte) => out.push({ code, texte, geste: g[code] });
  // Photos : moins de 3.
  if (x.nPhotos !== undefined) {
    const n = Number(x.nPhotos);
    if (!Number.isFinite(n) || n < PHOTOS_MIN) pose('photos', !Number.isFinite(n) || n <= 0 ? 'Aucune photo' : `${n} photo${n > 1 ? 's' : ''} seulement`);
  }
  // Taille : seulement pour une famille qui en porte une (un sac n'a pas de taille).
  if (x.taille !== undefined && !SANS_TAILLE.has(String(x.famille || '')) && vide(x.taille)) pose('taille', 'Taille absente');
  // Prix sous le prix d'achat CONNU (jamais deviné, §2.5) — aucun prix proposé.
  const p = num(x.prix), ac = num(x.achat);
  if (p != null && ac != null && ac > 0 && p < ac) pose('prix', `Prix ${eur(p)} sous ton prix d’achat ${eur(ac)}`);
  // Titre trop long pour le site (limites mesurées ci-dessus).
  const max = TITRE_MAX[site];
  if (max && x.titre !== undefined) {
    const t = String(x.titre || '').replace(/\s+/g, ' ').trim();
    if (t.length > max) pose('titre', `Titre trop long : ${t.length}/${max}`);
  }
  if (x.marque !== undefined && vide(x.marque)) pose('marque', 'Marque absente');
  if (x.categorie !== undefined && vide(x.categorie)) pose('categorie', 'Catégorie absente');
  return out;
}

// Plusieurs articles (Republier) : une ligne par problème, préfixée du N° (ou
// du titre court quand l'article n'a pas de N°).
export function problemesLot(articles, site) {
  const out = [];
  for (const a of articles || []) {
    const nom = a && a.numero ? `N°${a.numero}` : String((a && a.titre) || 'Sans titre').slice(0, 28);
    for (const pb of problemesAnnonce(a, site)) out.push({ ...pb, qui: nom });
  }
  return out;
}
