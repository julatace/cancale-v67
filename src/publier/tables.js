// ════════════════════════════════════════════════════════════════════════════
//  LES TABLES PAR CHAMP ET PAR SITE, DANS LES DEUX SENS (19 nov. 2026, publier-agent)
// ════════════════════════════════════════════════════════════════════════════
// Julien : « je veux être sûr que pour chaque article, peu importe ce que c'est, ça publie au bon
// endroit dans la bonne catégorie, même si les catégories ne sont pas les mêmes » ; « tu n'intègres
// pas d'IA, mais tu fais un agent 100 % autonome, sans IA ».
//
// UNE CATÉGORIE VRM NEUTRE (« chaussures/baskets/homme ») — aucune plateforme n'est la principale.
//   ENTRANT (site → VRM) : ce qu'une annonce LUE dit d'elle-même :
//     · Vinted : son `catalog_id` (lu sur la page de l'annonce) — table exacte, une catégorie VRM par id ;
//     · eBay : le chemin de catégorie que l'API rend (`detail.categoryName`) — seulement un chemin VU ;
//     · Leboncoin : la catégorie de l'annonce (« Chaussures ») ne dit ni le type ni le genre ⇒ la
//       FAMILLE seulement, le reste est demandé (jamais déduit du titre) ;
//     · Vestiaire : ses annonces lues ne portent pas la catégorie ⇒ rien.
//   SORTANT (VRM → site) : la table vérifiée de src/correspondances.js (Leboncoin, eBay), et pour
//     Vestiaire le catalogue de dépôt COMPLET (src/publier/listes.js).
//   Le chemin inverse d'une table sortante n'est « sûr » que s'il désigne UNE seule catégorie VRM ;
//   sinon les candidates sont proposées et SA réponse est retenue.
// Module PUR (aucune lecture, aucune écriture).
import { TABLE_VINTED, LBC_VALEURS, ETAT_VERS_LBC, ETAT_VERS_EBAY, couleurLbc } from '../correspondances.js';
import { LBC_MARQUES_CHAUSSURES, VC_DEPOT, VC_MARQUES_RELEVEES } from './listes.js';

const str = (v) => String(v == null ? '' : v).trim();
export const norm = (v) => str(v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
export const chercheExact = (liste, v) => { const n = norm(v); return n ? (liste || []).find((x) => norm(x) === n) || null : null; };

// ── LES CATÉGORIES VRM ─────────────────────────────────────────────────────
// famille · type · genre (homme | femme | fille | garcon | '' quand le site n'en a pas) ;
// `vinted` : l'identifiant Vinted équivalent (le même objet, dans l'autre sens).
const C = (famille, type, genre, vinted) => Object.freeze({ famille, type, genre, vinted: String(vinted) });
export const CATEGORIES_VRM = Object.freeze({
  'chaussures/baskets/homme': C('chaussures', 'baskets', 'homme', 1242),
  'chaussures/baskets/femme': C('chaussures', 'baskets', 'femme', 2632),
  'chaussures/randonnee/homme': C('chaussures', 'randonnee', 'homme', 2678),
  'chaussures/randonnee/femme': C('chaussures', 'randonnee', 'femme', 2645),
  'chaussures/course/homme': C('chaussures', 'course', 'homme', 1453),
  'chaussures/course/femme': C('chaussures', 'course', 'femme', 2651),
  'chaussures/tennis/homme': C('chaussures', 'tennis', 'homme', 2686),
  'chaussures/basket/homme': C('chaussures', 'basket', 'homme', 2672),
  'chaussures/bottines/femme': C('chaussures', 'bottines', 'femme', 2618),
  'chaussures/habillees/homme': C('chaussures', 'habillees', 'homme', 1238),
  'chaussures/mocassins/homme': C('chaussures', 'mocassins', 'homme', 2656),
  'chaussures/mocassins/femme': C('chaussures', 'mocassins', 'femme', 2954),
  'chaussures/bottes-travail/homme': C('chaussures', 'bottes-travail', 'homme', 2664),
  'chaussures/bottes-travail/femme': C('chaussures', 'bottes-travail', 'femme', 2622),
  'chaussures/baskets/fille': C('chaussures', 'baskets', 'fille', 2719),
  'chaussures/baskets-sans-lacets/garcon': C('chaussures', 'baskets-sans-lacets', 'garcon', 2752),
  'vetements/tshirt/garcon': C('vetements', 'tshirt', 'garcon', 1662),
  'vetements/jean-slim/garcon': C('vetements', 'jean-slim', 'garcon', 1697),
  'sacs/sac-a-main/femme': C('sacs', 'sac-a-main', 'femme', 156),
  'vetements/doudoune/femme': C('vetements', 'doudoune', 'femme', 2614),
  'vetements/blouse/femme': C('vetements', 'blouse', 'femme', 1043),
  'livres/manuel-scolaire/': C('livres', 'manuel-scolaire', '', 5426),
  'jouets/pate-a-modeler/': C('jouets', 'pate-a-modeler', '', 3317),
});
export const CLES_VRM = Object.freeze(Object.keys(CATEGORIES_VRM));
export const FAMILLES = Object.freeze([...new Set(CLES_VRM.map((k) => CATEGORIES_VRM[k].famille))]);
export const GENRES = Object.freeze(['homme', 'femme', 'fille', 'garcon']);
export const estCleVrm = (k) => Object.prototype.hasOwnProperty.call(CATEGORIES_VRM, str(k));

// ── ENTRANT ────────────────────────────────────────────────────────────────
// Rend { cle } (sûre) · { famille, candidates: [cle] } (partielle) · null (rien lu).
const VINTED_VERS_VRM = Object.freeze(Object.fromEntries(CLES_VRM.map((k) => [CATEGORIES_VRM[k].vinted, k])));
export function depuisVinted(catalogId) {
  const id = str(catalogId);
  if (!/^\d{1,7}$/.test(id)) return null;
  return VINTED_VERS_VRM[id] ? { cle: VINTED_VERS_VRM[id] } : { inconnue: id };
}
// Leboncoin : le libellé de la catégorie de l'annonce. La famille seulement (jamais le type).
const LBC_FAMILLE = Object.freeze({ 'Chaussures': ['chaussures', ['homme', 'femme']], 'Chaussures enfants': ['chaussures', ['fille', 'garcon']], 'Vêtements': ['vetements', ['homme', 'femme']],
  'Vêtements enfants': ['vetements', ['fille', 'garcon']], 'Accessoires & Bagagerie': ['sacs', ['homme', 'femme']], 'Livres': ['livres', ['']] });
export function depuisLeboncoin(categorie) {
  const c = str(categorie);
  if (!c) return null;
  const f = LBC_FAMILLE[c];
  if (!f) return { horsTable: c };
  const candidates = CLES_VRM.filter((k) => CATEGORIES_VRM[k].famille === f[0] && f[1].includes(CATEGORIES_VRM[k].genre));
  // ⚠️ Jamais « sûre » même s'il ne reste qu'une candidate : la table ne connaît que les catégories
  //    vues chez lui ; un accessoire Leboncoin n'est pas forcément un sac à main. Il choisit.
  return { famille: f[0], candidates };
}
// eBay : seulement les chemins VUS (API eBay, `detail.categoryName`, séparateur « : »).
export const EBAY_CHEMINS_VUS = Object.freeze({
  'Vêtements, accessoires:Homme : vêtements, accessoires:Homme : chaussures:Baskets': 'chaussures/baskets/homme',
});
export function depuisEbay(categoryName) {
  const c = str(categoryName);
  if (!c) return null;
  return EBAY_CHEMINS_VUS[c] ? { cle: EBAY_CHEMINS_VUS[c] } : { horsTable: c };
}

// ── SORTANT : VESTIAIRE (catalogue de dépôt complet) ───────────────────────
export const UNIVERS_VC = Object.freeze({ homme: 'Mode homme', femme: 'Mode femme', fille: 'Mode fille', garcon: 'Mode garçon' });
const CAT_VC = Object.freeze({ chaussures: 'Chaussures', vetements: 'Vêtements', sacs: 'Sacs' });
// La sous-catégorie EXACTE quand elle ne fait aucun doute ; absente ⇒ demandée (parmi la liste du site).
const SOUS_VC = Object.freeze({ 'baskets': 'Baskets', 'baskets-sans-lacets': 'Baskets', 'mocassins': 'Mocassins', 'sac-a-main': 'Sacs à main', 'blouse': 'Tops', 'tshirt': 'Tops' });
export const VC_HORS = Object.freeze(['livres', 'jouets']);
export function choixVc(champ, ctx = {}) {
  if (champ === 'univers') return Object.keys(VC_DEPOT);
  if (champ === 'categorie') { const u = VC_DEPOT[ctx.univers || '']; return u ? Object.keys(u) : []; }
  if (champ === 'sous') { const u = VC_DEPOT[ctx.univers || '']; return u && u[ctx.categorie || ''] ? u[ctx.categorie].slice() : []; }
  return [];
}
// Rend { hors } · { valeurs: {univers?, categorie?, sous?}, demandes: [champ] } — chaque valeur EXISTE dans la liste.
export function vcDepuisVrm(cle) {
  const c = CATEGORIES_VRM[str(cle)];
  if (!c) return { valeurs: {}, demandes: ['univers', 'categorie', 'sous'] };
  if (VC_HORS.includes(c.famille)) return { hors: true };
  const v = {}; const d = [];
  const u = UNIVERS_VC[c.genre]; if (u && VC_DEPOT[u]) v.univers = u; else d.push('univers');
  const cat = CAT_VC[c.famille]; if (v.univers && cat && VC_DEPOT[v.univers][cat]) v.categorie = cat; else d.push('categorie');
  const s = SOUS_VC[c.type]; if (v.categorie && s && chercheExact(VC_DEPOT[v.univers][v.categorie], s)) v.sous = chercheExact(VC_DEPOT[v.univers][v.categorie], s); else d.push('sous');
  return { valeurs: v, demandes: d };
}

// ── LES AUTRES CHAMPS ──────────────────────────────────────────────────────
// État : le vocabulaire neutre = les cinq mots de Vinted (le plus fin des quatre sites).
export const ETATS = Object.freeze(['Neuf avec étiquette', 'Neuf sans étiquette', 'Très bon état', 'Bon état', 'Satisfaisant']);
export const etatNeutre = (v) => chercheExact(ETATS, v);
// eBay → neutre : seulement les libellés VUS sur ses annonces eBay (« Occasion » seul ne dit pas lequel).
export const EBAY_ETAT_LU = Object.freeze({ 'Occasion - Très bon état': 'Très bon état', 'Neuf avec étiquettes': 'Neuf avec étiquette', 'Neuf sans étiquette': 'Neuf sans étiquette' });
export const etatDepuisEbay = (t) => EBAY_ETAT_LU[str(t)] || null;
export const etatVersLbc = (e) => ETAT_VERS_LBC[str(e)] || null;
export const etatVersEbay = (e) => ETAT_VERS_EBAY[str(e)] || null;
// Pointure : EU, jamais convertie (« 42.5 » ⇒ « 42,5 »). Une taille qui n'est pas une pointure reste telle quelle.
export function pointureEU(v) {
  const t = str(v).replace(/\s+/g, '');
  const m = /^(\d{2})(?:[.,](5))?$/.exec(t);
  return m ? (m[2] ? `${m[1]},5` : m[1]) : null;
}
// Marque → Leboncoin (chaussures : les 793 libellés du site ; autre famille : la liste n'est pas
// relevée ⇒ « à lire sur le formulaire », l'extension clique le libellé exact ou rien).
export function marqueVersLbc(marque, famille) {
  if (!str(marque)) return { etat: 'pas-lue' };
  if (famille !== 'chaussures') return { etat: 'a-lire', valeur: str(marque) };
  const m = chercheExact(LBC_MARQUES_CHAUSSURES, marque);
  return m ? { etat: 'sure', valeur: m } : { etat: 'hors-liste' };
}
// Marque → Vestiaire (obligatoire chez Vestiaire) : relevée présente ⇒ sûre ; relevée absente ⇒
// pas vendable sous ce nom ; jamais vue ⇒ l'extension la cherche dans la liste entière à l'envoi.
export function marqueVersVc(marque) {
  if (!str(marque)) return { etat: 'pas-lue' };
  const p = chercheExact(VC_MARQUES_RELEVEES.presentes, marque);
  if (p) return { etat: 'sure', valeur: p };
  if (chercheExact(VC_MARQUES_RELEVEES.absentes, marque)) return { etat: 'hors-liste' };
  return { etat: 'a-lire', valeur: str(marque) };
}
export const marquesVcPermises = () => VC_MARQUES_RELEVEES.presentes.slice();
export const marquesLbcPermises = () => LBC_MARQUES_CHAUSSURES.slice();
export const couleurVersLbc = (c) => couleurLbc(c);
export const couleursLbc = () => LBC_VALEURS.clothing_color_a.slice();
// Le chemin Vinted d'une catégorie VRM (pour le dire en clair).
export const cheminVinted = (cle) => { const c = CATEGORIES_VRM[str(cle)]; return c && TABLE_VINTED[c.vinted] ? TABLE_VINTED[c.vinted].chemin : ''; };
