// ── LE PROFIL DU VENDEUR : AFFICHAGE SIMPLE / COMPLET, ET CE QU'IL VEND (8 nov.) ──
// Julien : « fais tout » — d'autres vendeurs vont payer. Deux réglages, rangés
// dans Paramètres → Affichage, synchronisés (SYNC_KEYS) :
//
//  · `vrm_affichage` = { choix: 'auto' | 'simple' | 'complet', at }
//    En SIMPLE, la navigation ne montre pas ce qui ne sert pas encore (Stock,
//    Republier, les sites jamais reliés) et Ma journée garde les seuls gestes
//    dus. RIEN n'est supprimé : chaque écran reste joignable par son lien et
//    revient d'un geste (« Complet »). Aucun total ne change : on ne cache que
//    des ENTRÉES de navigation et un conseil (« Prix à baisser »), jamais une
//    ligne d'un calcul.
//    Défaut automatique : Simple seulement si l'on SAIT qu'il a UN compte Vinted
//    et moins de 30 ventes lues sur 30 jours ; jamais pour le propriétaire de
//    l'installation (Julien) ; « pas su » ⇒ Complet (on ne cache rien sur un doute).
//
//  · `vrm_je_vends` = { choix: 'auto' | 'sneakers' | 'autre', at }
//    « Sneakers » garde le vocabulaire de Julien (« paire ») et juge taille et
//    marque avant une publication. « Autre » (vêtements, sacs, livres…) : taille
//    et marque sont FACULTATIVES — jamais un « manquante » ni un geste ambre — et
//    l'app dit « article ». Défaut : Sneakers pour le propriétaire, Autre sinon
//    (un mot neutre ne trompe personne ; un « taille absente » sur un livre, si).
//
// Règles PURES (aucune lecture) : exécutées par scripts/audit-vendeurs-differents.cjs.

export const CLE_AFFICHAGE = 'vrm_affichage';
export const CLE_JE_VENDS = 'vrm_je_vends';
export const SEUIL_VENTES_SIMPLE = 30;
export const JOURS_VENTES_SIMPLE = 30;

const choixDe = (r, permis) => {
  const c = r && typeof r === 'object' ? r.choix : r;
  return permis.includes(c) ? c : 'auto';
};
export const lireReglageAffichage = (r) => ({ choix: choixDe(r, ['auto', 'simple', 'complet']), at: (r && r.at) || null });
// `vu` (11 nov., lot DJ2) : la question « Tu vends quoi ? » a été montrée et mise de côté
// (src/configurationDepart.js `ecritureVendsVu`) ; elle ne revient pas.
export const lireReglageJeVends = (r) => ({ choix: choixDe(r, ['auto', 'sneakers', 'autre']), at: (r && r.at) || null, categories: categoriesDe(r), autre: autreDe(r), vu: r && typeof r === 'object' && typeof r.vu === 'string' ? r.vu : null });

// ── CE QU'IL VEND, EN DÉTAIL (9 nov., soir) ─────────────────────────────────
// Julien : « tout le monde ne vend pas des sneakers ; la première question c'est
// sneakers ou autre chose, fais plein de propositions. » « Ma configuration » pose la
// question en tuiles à choix MULTIPLE ; la réponse est rangée DANS `vrm_je_vends`,
// sans casser ses lecteurs : `choix` reste 'sneakers' | 'autre' | 'auto' (tout ce qui
// lit le mot et les champs obligatoires ne lit que lui) et s'en DÉDUIT :
//   `categories` = ['sneakers'] seul ⇒ 'sneakers' (« paire », taille et marque jugées) ;
//   n'importe quoi d'autre (sneakers + vêtements, livres…) ⇒ 'autre' (« article »,
//   taille et marque facultatives).
// `autre` : le texte libre de la tuile « Autre chose » (80 caractères, jamais lu par une règle).
export const CATEGORIES_VENDS = [
  { v: 'sneakers', titre: 'Sneakers' },
  { v: 'vetements', titre: 'Vêtements' },
  { v: 'luxe', titre: 'Luxe & créateurs' },
  { v: 'sacs', titre: 'Sacs & maroquinerie' },
  { v: 'montres', titre: 'Montres & bijoux' },
  { v: 'lunettes', titre: 'Lunettes' },   // (11 nov., lot DJ2) « il y a des personnes qui vendent des lunettes »
  { v: 'accessoires', titre: 'Accessoires' },
  { v: 'vintage', titre: 'Vintage' },
  { v: 'enfants', titre: 'Enfants & puériculture' },
  { v: 'livres', titre: 'Livres & BD' },
  { v: 'jeux', titre: 'Jeux vidéo & consoles' },
  { v: 'hightech', titre: 'High-tech' },
  { v: 'cartes', titre: 'Cartes à collectionner' },
  { v: 'jouets', titre: 'Jouets & figurines' },
  { v: 'maison', titre: 'Maison & déco' },
  { v: 'sport', titre: 'Sport & outdoor' },
  { v: 'beaute', titre: 'Beauté' },
  { v: 'musique', titre: 'Vinyles & musique' },
  { v: 'autre', titre: 'Autre chose' },
];
const IDS_CATEGORIES = CATEGORIES_VENDS.map((c) => c.v);
export const AUTRE_MAX = 80;
function categoriesDe(r) {
  const c = r && typeof r === 'object' && Array.isArray(r.categories) ? r.categories : null;
  if (!c) return null;
  const v = IDS_CATEGORIES.filter((id) => c.includes(id));
  return v.length ? v : null;
}
const autreDe = (r) => (r && typeof r === 'object' && typeof r.autre === 'string' ? r.autre.replace(/\s+/g, ' ').trim().slice(0, AUTRE_MAX) : '');
// Le `choix` que des catégories imposent : sneakers SEUL ⇒ 'sneakers', sinon 'autre'.
export const choixDeCategories = (cats) => (Array.isArray(cats) && cats.length === 1 && cats[0] === 'sneakers' ? 'sneakers' : 'autre');
// Les catégories à PRÉ-COCHER d'après ce qui est enregistré (rien de deviné) :
//  · catégories rangées ET cohérentes avec `choix` ⇒ elles ;
//  · ancien réglage « sneakers » ⇒ ['sneakers'] ; ancien « autre » ⇒ ['autre'] (« Autre chose ») ;
//  · rien choisi (ou automatique) ⇒ [].
export function categoriesAPreCocher(r) {
  const l = lireReglageJeVends(r);
  if (l.categories && (l.choix === 'auto' || choixDeCategories(l.categories) === l.choix)) return l.choix === 'auto' ? [] : l.categories;
  if (l.choix === 'sneakers') return ['sneakers'];
  if (l.choix === 'autre') return ['autre'];
  return [];
}
// La valeur à ranger pour des catégories cochées (jamais vide : rien coché ⇒ null, on n'écrit rien).
export function reglageJeVendsDe(categories, autre, at = new Date().toISOString()) {
  const cats = IDS_CATEGORIES.filter((id) => (categories || []).includes(id));
  if (!cats.length) return null;
  const txt = cats.includes('autre') ? String(autre || '').replace(/\s+/g, ' ').trim().slice(0, AUTRE_MAX) : '';
  return { choix: choixDeCategories(cats), categories: cats, ...(txt ? { autre: txt } : {}), at };
}
// Réglages → Je vends (Automatique / Sneakers / Autre) : garde les catégories si elles
// disent la même chose, sinon les met en accord (jamais un `choix` qui les contredit).
export function reglageJeVendsDepuisChoix(avant, choix, at = new Date().toISOString()) {
  const l = lireReglageJeVends(avant);
  if (choix === 'sneakers') return { choix, categories: ['sneakers'], at };
  if (choix === 'autre' && l.categories && choixDeCategories(l.categories) === 'autre') return { choix, categories: l.categories, ...(l.autre ? { autre: l.autre } : {}), at };
  // (11 nov.) Un choix fait ici vaut réponse : la question « Tu vends quoi ? » ne revient pas (`vu`).
  return { choix: choix === 'autre' ? 'autre' : 'auto', at, ...(choix === 'autre' ? {} : { vu: at }) };
}
export const nomsCategories = (cats, autre = '') => (cats || []).map((v) => (v === 'autre' && autre ? autre : (CATEGORIES_VENDS.find((c) => c.v === v) || {}).titre)).filter(Boolean);

// Le défaut automatique. `proprietaire` : true · false · null (pas su).
// `nComptesVinted` : nombre de comptes Vinted reliés (null = pas su).
// `nVentes30j` : ventes lues sur les 30 derniers jours (null = pas su / partiel).
export function affichageAuto({ proprietaire, nComptesVinted, nVentes30j } = {}) {
  if (proprietaire !== false) return 'complet';
  if (nComptesVinted !== 1) return 'complet';
  if (typeof nVentes30j !== 'number' || !Number.isFinite(nVentes30j)) return 'complet';
  return nVentes30j < SEUIL_VENTES_SIMPLE ? 'simple' : 'complet';
}
// → { mode: 'simple' | 'complet', auto: boolean }
export function affichageEffectif(reglage, contexte) {
  const r = lireReglageAffichage(reglage);
  if (r.choix === 'simple' || r.choix === 'complet') return { mode: r.choix, auto: false };
  return { mode: affichageAuto(contexte), auto: true };
}
// → { vend: 'sneakers' | 'autre', auto: boolean }
export function jeVendsEffectif(reglage, { proprietaire } = {}) {
  const r = lireReglageJeVends(reglage);
  if (r.choix === 'sneakers' || r.choix === 'autre') return { vend: r.choix, auto: false };
  return { vend: proprietaire === true ? 'sneakers' : 'autre', auto: true };
}

// Le nombre de ventes des 30 derniers jours, depuis les lignes de « Vendu »
// (`ventesFaites` : lignes comptées + non comptées datées). `null` si la lecture
// est partielle ou en cours : « pas su » ne vaut pas « peu ».
export function ventesSur30j({ lignes, nonComptees, partiel, maintenant = Date.now() } = {}) {
  if (partiel || !Array.isArray(lignes)) return null;
  const depuis = maintenant - JOURS_VENTES_SIMPLE * 86400000;
  let n = 0;
  for (const l of lignes) if (l && l.ts >= depuis) n += 1;
  for (const l of (Array.isArray(nonComptees) ? nonComptees : [])) if (l && l.ts && l.ts >= depuis) n += 1;
  return n;
}

// ── LA NAVIGATION EN SIMPLE ────────────────────────────────────────────────
// Une entrée (cle = `t.cle || t.id`, celle de GROUPES_PLUS) est-elle montrée ?
//  · Complet : toujours (la règle d'avant, inchangée).
//  · Simple  : Stock (`garage`) seulement s'il a déjà des meubles ; Republier
//    seulement s'il a déjà republié ; un site (eBay, Leboncoin, Vestiaire)
//    seulement s'il est RELIÉ ou pas su (`relies[site]` : true · false · null).
// `usage` : { stock: bool|null, republier: bool|null } — null = pas su ⇒ montré.
export const ENTREES_SIMPLE = { garage: 'stock', republier: 'republier' };
export function entreeMontree(t, { mode, usage = {}, relies = {} } = {}) {
  if (mode !== 'simple' || !t) return true;
  const cle = t.cle || t.id;
  const u = ENTREES_SIMPLE[cle];
  if (u) return usage[u] !== false;
  if (t.site) return relies[t.site] !== false;
  return true;
}
// Les filtres de site (Ventes, Annonces, Messages, Achats) en Simple : Vinted,
// le site choisi, et ceux qui ne sont pas PROUVÉS absents.
export function siteMontre(site, { mode, relies = {}, choisi = '', plateformes = null } = {}) {
  if (Array.isArray(plateformes)) return site === 'toutes' || plateformes.includes(site);
  if (mode !== 'simple') return true;
  if (site === 'vinted' || site === 'toutes' || site === choisi) return true;
  return relies[site] !== false;
}
// Ma journée en Simple : les gestes DUS restent tous (colis, retraits, messages,
// litiges, numéros…) ; seul le CONSEIL « Prix à baisser » se tait. Son compteur
// reste publié (même nombre pour les autres écrans).
export const CASES_JOURNEE_CONSEIL = ['prix'];
export const caseJourneeMontree = (id, mode) => mode !== 'simple' || !CASES_JOURNEE_CONSEIL.includes(id);

// ── LES MOTS ────────────────────────────────────────────────────────────────
// « paire » pour un vendeur de sneakers (Julien), « article » sinon. Chaque
// forme est écrite en entier (le genre change l'accord : « une paire vendue »,
// « un article vendu ») : jamais un remplacement de mot dans une phrase.
const MOTS = {
  sneakers: { nom: 'paire', noms: 'paires', un: 'une paire', Un: 'Une paire', le: 'la paire', Le: 'La paire', ce: 'cette paire', tes: 'tes paires', e: 'e', es: 'es', chaque: 'Chaque paire', elle: 'elle', Elle: 'Elle', une: 'une',
    // (11 nov., lot vocabulaire-article) les formes des écrans secondaires, des notifications et de l'extension.
    Nom: 'Paire', Noms: 'Paires', sa: 'sa paire', la: 'la', La: 'La', de: 'de la paire', a: 'à la paire', Ce: 'Cette paire', aucune: 'aucune paire', Aucune: 'Aucune paire',
    celle: 'celle', celles: 'celles', toutes: 'toutes', Toutes: 'Toutes', laquelle: 'laquelle', autre: 'une autre paire', meme: 'la même paire', Meme: 'La même paire', lui: 'elle', eux: 'elles', deNom: 'de paire', deNoms: 'de paires', Tes: 'Tes paires', quelle: 'quelle paire', bonne: 'la bonne paire', AucuneDe: 'Aucune de ces paires', mes: 'mes paires', deMeme: 'de la même paire', quelles: 'quelles paires', ancienne: 'ANCIENNE paire', nouvelle: 'la nouvelle' },
  autre:    { nom: 'article', noms: 'articles', un: 'un article', Un: 'Un article', le: 'l’article', Le: 'L’article', ce: 'cet article', tes: 'tes articles', e: '', es: 's', chaque: 'Chaque article', elle: 'il', Elle: 'Il', une: 'un',
    Nom: 'Article', Noms: 'Articles', sa: 'son article', la: 'le', La: 'Le', de: 'de l’article', a: 'à l’article', Ce: 'Cet article', aucune: 'aucun article', Aucune: 'Aucun article',
    celle: 'celui', celles: 'ceux', toutes: 'tous', Toutes: 'Tous', laquelle: 'lequel', autre: 'un autre article', meme: 'le même article', Meme: 'Le même article', lui: 'lui', eux: 'eux', deNom: 'd’article', deNoms: 'd’articles', Tes: 'Tes articles', quelle: 'quel article', bonne: 'le bon article', AucuneDe: 'Aucun de ces articles', mes: 'mes articles', deMeme: 'du même article', quelles: 'quels articles', ancienne: 'ANCIEN article', nouvelle: 'le nouvel article' },
};
export const motsArticle = (vend) => MOTS[vend === 'sneakers' ? 'sneakers' : 'autre'];
// « 3 paires » / « 1 article » (le nombre et le nom accordé).
export const nArticles = (n, vend) => { const m = motsArticle(vend); return `${n} ${n > 1 ? m.noms : m.nom}`; };
// (11 nov., lot vocabulaire-article) Le vocabulaire du vendeur CONNECTÉ, pour tout module
// (écrans découpés, règles qui écrivent une phrase) sans faire descendre `vend` partout.
// L'app pose la source une fois (`poserSourceVend(() => vendActuel())`, src/App.jsx) ;
// sans source (audits, bancs d'une règle seule) ⇒ « sneakers », les textes d'avant mot pour mot.
let sourceVend = null;
export const poserSourceVend = (f) => { sourceVend = typeof f === 'function' ? f : null; };
export const vendCourant = () => { try { const v = sourceVend ? sourceVend() : 'sneakers'; return v === 'sneakers' ? 'sneakers' : 'autre'; } catch (_) { return 'sneakers'; } };
export const motsVendeur = () => motsArticle(vendCourant());
// Les PHRASES écrites d'avance pour Sneakers dans une table de données (aide du « ? »,
// étapes) : leur version « article », écrite EN ENTIER (jamais un mot remplacé dans la
// phrase). Une phrase absente de la table ne parle pas de paire : elle sort telle quelle.
export const PHRASES_ARTICLE = {
  'À retrouver la paire sur ton étagère, sur Leboncoin et sur eBay. Il suit l’ordre de mise en ligne et n’est jamais redonné à une autre paire.': 'À retrouver l’article sur ton étagère, sur Leboncoin et sur eBay. Il suit l’ordre de mise en ligne et n’est jamais redonné à un autre article.',
  'Un colis « prêt » a son bordereau : ouvre-le et imprime. Le numéro de rangement y est tamponné, pour emballer la bonne paire.': 'Un colis « prêt » a son bordereau : ouvre-le et imprime. Le numéro de rangement y est tamponné, pour emballer le bon article.',
  'Comment retrouver une paire ?': 'Comment retrouver un article ?',
  'Deux paires présentes sous le même numéro : c’est le seul risque d’envoyer le mauvais article. Vérifie les deux là où ils sont rangés.': 'Deux articles présents sous le même numéro : c’est le seul risque d’envoyer le mauvais article. Vérifie les deux là où ils sont rangés.',
  'Emballe la paire du N° tamponné.': 'Emballe l’article du N° tamponné.',
  'Donne le N° de la paire : son prix devient son coût.': 'Donne le N° de l’article : son prix devient son coût.',
  'Range chaque paire là où VRM l’indique.': 'Range chaque article là où VRM l’indique.',
  'Un N° en rouge : deux paires dessous, vérifie les deux.': 'Un N° en rouge : deux articles dessous, vérifie les deux.',
};
export const phraseVendeur = (t, vend = vendCourant()) => (vend === 'sneakers' || typeof t !== 'string' ? t : (PHRASES_ARTICLE[t] || t));
// « 3 paires » / « 1 article », pour le vendeur connecté (ou `vend` donné).
export const motArticle = (n, { vend } = {}) => nArticles(n, vend === undefined ? vendCourant() : vend);

// ── TAILLE ET MARQUE : FACULTATIVES HORS SNEAKERS ───────────────────────────
// Ce qu'on passe à `problemesAnnonce` (src/verifAnnonce.js) : `facultatifs: true`
// ⇒ taille et marque ne sont ni jugées ni dites « pas lues ».
export const champsFacultatifs = (vend) => vend !== 'sneakers';
