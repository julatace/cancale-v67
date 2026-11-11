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
import { lireNumeroTexte, lectureRecue, cleNumero } from './numeroEcrit.js';
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
  lbc: { numero: 'Écris le N° à la fin de la description', enligne: 'Retire l’autre annonce, ou ne publie pas', taille: 'Ajoute la taille sur l’annonce Vinted', photos: 'Ouvre l’annonce sur Vinted : ses photos arrivent ici', prix: 'Corrige le prix dans la fiche', titre: 'Raccourcis le titre dans la fiche', marque: 'Ajoute la marque sur l’annonce Vinted', categorie: 'Précise le titre (le type d’article)' },
  ebay: { numero: 'Écris le N° à la fin de la description', enligne: 'Termine l’autre annonce eBay, ou ne publie pas', taille: 'Remplis la pointure dans les caractéristiques', photos: 'Ajoute des photos', prix: 'Corrige le prix', titre: 'Raccourcis le titre', marque: 'Remplis la marque dans les caractéristiques', categorie: 'Choisis la catégorie' },
  vestiaire: { numero: 'Écris le N° à la fin de la description Vinted', enligne: 'Retire l’autre annonce, ou ne publie pas', taille: 'Ajoute la taille sur l’annonce Vinted', photos: 'Ouvre l’annonce sur Vinted : ses photos arrivent ici', prix: 'Corrige le prix sur Vinted', titre: 'Raccourcis le titre sur Vinted', marque: 'Ajoute la marque sur l’annonce Vinted', categorie: 'Choisis la catégorie sur Vestiaire' },
  vinted: { numero: 'Écris le N° à la fin de la description', enligne: 'Une seule annonce par paire : vérifie l’autre', taille: 'Ajoute la taille sur Vinted', photos: 'Ajoute des photos sur Vinted', prix: 'Change le prix dans Republier', titre: 'Raccourcis le titre dans Republier', marque: 'Ajoute la marque sur Vinted', categorie: 'Choisis la catégorie sur Vinted', description: 'Écris la description sur Vinted', couleur: 'Choisis la couleur sur Vinted', etat: 'Choisis l’état sur Vinted', titreVide: 'Écris un titre sur Vinted', prixVide: 'Mets un prix sur Vinted' },
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

// ── LE N° ÉCRIT : CE QUI EST DIT (au plus 12 mots) ────────────────────────────
// `numero` : le N° que VRM connaît pour la paire ('' = aucun) ; `description` : le
// texte qui partira (string) ; `numeroLu` : sa lecture déjà faite (forme de
// `lireNumeroTexte`, ce que l'extension range) ; `ref` : la référence native.
export function numeroAJuger(x) {
  if (!x || x.numeroEcrit !== true) return '';
  // `ou` : les endroits qu'IL a cochés (« Où est ton numéro ? »). La description
  // décochée n'est pas jugée ; le bon N° dans le titre (coché) suffit.
  const ou = Array.isArray(x.ou) ? x.ou : null;
  if (ou && !ou.includes('description')) return '';
  const l = x.numeroLu !== undefined && x.numeroLu !== null ? lectureRecue(x.numeroLu)
    : (typeof x.description === 'string' ? lireNumeroTexte(x.description, 'description') : null);
  if (!l) return '';   // description pas sue : rien
  const attendu = x.numero != null && String(x.numero).trim() ? cleNumero(x.numero) : '';
  if (attendu && x.ref != null && String(x.ref).trim()) { const r = lireNumeroTexte(x.ref, 'ref'); if (r.etat === 'lu' && r.cle === attendu) return ''; }
  if (attendu && ou && ou.includes('titre') && typeof x.titre === 'string') { const t = lireNumeroTexte(x.titre, 'titre'); if (t.etat === 'lu' && t.cle === attendu) return ''; }
  if (l.etat === 'lu') return attendu && l.cle !== attendu ? `La description dit N°${l.cle}, pas N°${attendu}` : '';
  if (l.etat === 'ambigu') return 'Deux N° différents dans la description';
  return attendu ? `N°${attendu} absent de la fin de la description` : 'Aucun N° à la fin de la description';
}
// « L'habitude de l'écrire » (sans le réglage) : PROUVÉE sur ses annonces lues —
// au moins 5 descriptions sues, et 4 sur 5 portent un N° à la fin. Sinon `null`
// (pas su ⇒ rien n'est jugé), jamais `false` présenté comme un fait.
export const HABITUDE_MIN = 5;
export function habitudeNumeroEcrit(lectures) {
  const ls = (Array.isArray(lectures) ? lectures : []).map((l) => lectureRecue(l)).filter(Boolean);
  if (ls.length < HABITUDE_MIN) return null;
  const lus = ls.filter((l) => l.etat === 'lu').length;
  return lus * 5 >= ls.length * 4 ? true : null;
}
// `numeroEcrit` d'une vérification : le réglage allumé, sinon l'habitude prouvée.
export const numeroEcritAttendu = (reglageActif, lectures) => (reglageActif === true ? true : habitudeNumeroEcrit(lectures));

// ── LES ALERTES QU'IL A COUPÉES (« Ne plus me le dire ») ─────────────────────
// Un réglage SYNCHRONISÉ (`vrm_verif_coupees` : { codes: [...] }), écrit sur SON
// clic seulement. Une alerte coupée ne revient plus nulle part ; Paramètres les
// rallume. Les codes inconnus sont ignorés (jamais une coupure inventée).
export const CLE_VERIF_COUPEES = 'vrm_verif_coupees';
export const NOMS_ALERTES = { photos: 'Peu de photos', numero: 'N° absent de la description', prix: 'Prix sous le prix d’achat', enligne: 'Déjà en ligne', taille: 'Taille absente', marque: 'Marque absente', categorie: 'Catégorie absente', titre: 'Titre trop long', description: 'Description absente ou courte', couleur: 'Couleur absente', etat: 'État absent', titreVide: 'Sans titre', prixVide: 'Sans prix' };
// Pourquoi chaque alerte est là (une phrase courte, montrée sous la ligne).
export const POURQUOI_ALERTE = {
  numero: 'Tu numérotes toi-même : sans N°, VRM ne retrouve pas la paire.',
  enligne: 'Deux annonces pour une paire : risque de la vendre deux fois.',
  prix: 'Tu vendrais moins cher que ce que tu l’as payée.',
  photos: 'Une annonce avec peu de photos inspire moins confiance.',
};
export function lireCoupees(brut) {
  const c = brut && typeof brut === 'object' && Array.isArray(brut.codes) ? brut.codes : [];
  return new Set(c.filter((k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(NOMS_ALERTES, k)));
}
export const couperAlerte = (brut, code) => ({ codes: [...new Set([...lireCoupees(brut), code])].filter((k) => NOMS_ALERTES[k]), at: new Date().toISOString() });
export const rallumerAlerte = (brut, code) => ({ codes: [...lireCoupees(brut)].filter((k) => code != null && k !== code), at: new Date().toISOString() });
export const sansCoupees = (lignes, brut) => { const c = lireCoupees(brut); return (Array.isArray(lignes) ? lignes : []).filter((l) => !(l && c.has(l.code))); };

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
  // (11 nov., lot verif-publication) LE N° QU'IL ÉCRIT LUI-MÊME (src/numeroEcrit.js).
  // Jugé seulement quand il numérote dans ses annonces (`numeroEcrit === true` :
  // le réglage allumé, ou l'habitude PROUVÉE par `habitudeNumeroEcrit`) ET que la
  // description qui partira est SUE (son texte, ou sa lecture `numeroLu`). Pas su ⇒
  // rien. La référence native (SKU eBay « VRM-12 ») qui porte le bon N° suffit.
  const nl = numeroAJuger(x);
  if (nl) pose('numero', nl);
  // (11 nov.) LA MÊME PAIRE DÉJÀ EN LIGNE (même N° ou même identité) : seulement
  // `dejaEnLigne === true`, posé par l'appelant sur une lecture COMPLÈTE de moins
  // de 24 h (`<enligne-regle>`, `etatEnLigneLbc`…). `null`/absent = pas su ⇒ rien.
  if (x.dejaEnLigne === true) pose('enligne', `Déjà en ligne ${String(x.dejaEnLigneOu || 'sur ce compte')}`.slice(0, 60));
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
