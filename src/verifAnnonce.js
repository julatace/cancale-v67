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
//   prix, achat : nombres (achat null = pas connu ⇒ pas jugé) ;
//   facultatifs : true ⇒ taille et marque jamais jugées (vendeur hors sneakers).
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
const eur = (v) => (Number.isInteger(v) ? `${v}\u00a0€` : `${v.toFixed(2).replace('.', ',')}\u00a0€`);

// Le geste, selon où l'annonce se corrige : sur la fiche de VRM (Leboncoin,
// eBay) ou à la source, sur Vinted (Vestiaire et Republier reprennent Vinted).
const GESTES = {
  lbc: { taille: 'Ajoute la taille sur l’annonce Vinted', photos: 'Ouvre l’annonce sur Vinted : ses photos arrivent ici', prix: 'Corrige le prix dans la fiche', titre: 'Raccourcis le titre dans la fiche', marque: 'Ajoute la marque sur l’annonce Vinted', categorie: 'Précise le titre (le type d’article)' },
  ebay: { taille: 'Remplis la pointure dans les caractéristiques', photos: 'Ajoute des photos', prix: 'Corrige le prix', titre: 'Raccourcis le titre', marque: 'Remplis la marque dans les caractéristiques', categorie: 'Choisis la catégorie' },
  vestiaire: { taille: 'Ajoute la taille sur l’annonce Vinted', photos: 'Ouvre l’annonce sur Vinted : ses photos arrivent ici', prix: 'Corrige le prix sur Vinted', titre: 'Raccourcis le titre sur Vinted', marque: 'Ajoute la marque sur l’annonce Vinted', categorie: 'Choisis la catégorie sur Vestiaire' },
  vinted: { taille: 'Ajoute la taille sur Vinted', photos: 'Ajoute des photos sur Vinted', prix: 'Change le prix dans Republier', titre: 'Raccourcis le titre dans Republier', marque: 'Ajoute la marque sur Vinted', categorie: 'Choisis la catégorie sur Vinted', description: 'Écris la description sur Vinted', couleur: 'Choisis la couleur sur Vinted', etat: 'Choisis l’état sur Vinted', titreVide: 'Écris un titre sur Vinted', prixVide: 'Mets un prix sur Vinted' },
};
// (5 nov., Julien : « avant de lancer une action, savoir s'il manque quelque
// chose pour la publication ») Ce que l'extension exige AVANT une mise en ligne
// (`champsManquantsAvant`, background.js) et que l'app peut juger sur ce qu'elle
// a lu : titre, prix, photos, description (5 caractères au moins, la borne
// `DESCRIPTION_MIN` de l'extension), couleur, état. Les champs PROPRES à Vinted
// ne sont jugés que pour `site === 'vinted'` ; ailleurs, rien ne change.
export const DESCRIPTION_MIN = 5;
// Les champs que VRM n'a PAS pu lire (`undefined`) : dits à part, « vérifiés par
// l'extension au lancement » — jamais présentés comme présents.
const NOMS_CHAMPS = { titre: 'le titre', prix: 'le prix', photos: 'les photos', taille: 'la taille', marque: 'la marque', categorie: 'la catégorie', description: 'la description', couleur: 'la couleur', etat: 'l’état' };
const CLES_LUES = { titre: 'titre', prix: 'prix', photos: 'nPhotos', taille: 'taille', marque: 'marque', categorie: 'categorie', description: 'descLen', couleur: 'couleur', etat: 'etat' };
export function champsNonJuges(a, site) {
  const x = a || {};
  if (site !== 'vinted') return [];
  return Object.keys(CLES_LUES).filter((k) => {
    if (k === 'taille' && SANS_TAILLE.has(String(x.famille || ''))) return false;
    // (8 nov.) Hors sneakers (`facultatifs`, src/profilVendeur.js) : taille et
    // marque ne sont pas « à vérifier » — un livre n'en a pas.
    if ((k === 'taille' || k === 'marque') && x.facultatifs === true) return false;
    return x[CLES_LUES[k]] === undefined || x[CLES_LUES[k]] === null;
  }).map((k) => NOMS_CHAMPS[k]);
}

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
  // (8 nov.) Hors sneakers (`facultatifs: true`, réglage « Je vends : Autre ») :
  // taille et marque sont FACULTATIVES — jamais « absente », jamais un geste.
  const fac = x.facultatifs === true;
  if (!fac && x.taille !== undefined && !SANS_TAILLE.has(String(x.famille || '')) && vide(x.taille)) pose('taille', 'Taille absente');
  // Prix sous le prix d'achat CONNU (jamais deviné, §2.5) — aucun prix proposé.
  const p = num(x.prix), ac = num(x.achat);
  if (p != null && ac != null && ac > 0 && p < ac) pose('prix', `Prix ${eur(p)} sous ton prix d’achat ${eur(ac)}`);
  // Titre trop long pour le site (limites mesurées ci-dessus).
  const max = TITRE_MAX[site];
  if (max && x.titre !== undefined) {
    const t = String(x.titre || '').replace(/\s+/g, ' ').trim();
    if (t.length > max) pose('titre', `Titre trop long : ${t.length}/${max}`);
  }
  if (!fac && x.marque !== undefined && vide(x.marque)) pose('marque', 'Marque absente');
  if (x.categorie !== undefined && vide(x.categorie)) pose('categorie', 'Catégorie absente');
  if (site === 'vinted') {
    // Ce que Vinted refuse à la mise en ligne (`champsManquantsAvant`), jugé
    // seulement sur ce qui a été lu (trois états, §5).
    // (revue du 5 nov.) `null` = pas lu (un prix illisible du dressing arrive en
    // `null` dans Republier) : jamais « Sans prix » ni « Sans titre » inventés.
    if (x.titre !== undefined && x.titre !== null && vide(x.titre)) out.unshift({ code: 'titreVide', texte: 'Sans titre', geste: g.titreVide });
    if (x.prix !== undefined && x.prix !== null && !(num(x.prix) > 0)) out.unshift({ code: 'prixVide', texte: 'Sans prix', geste: g.prixVide });
    if (x.descLen !== undefined && x.descLen !== null) {
      const d = num(x.descLen);
      if (d == null || d < DESCRIPTION_MIN) pose('description', !d ? 'Sans description' : `Description trop courte (${d} caractère${d > 1 ? 's' : ''})`);
    }
    if (x.couleur !== undefined && x.couleur !== null && vide(x.couleur)) pose('couleur', 'Couleur absente');
    if (x.etat !== undefined && x.etat !== null && vide(x.etat)) pose('etat', 'État absent');
  }
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
