// ── STATISTIQUES PAR CATÉGORIE (11 nov., lot stats-categories) ─────────────
// Julien : « des statistiques par catégorie (lunettes, vêtements…) pour les
// vendeurs qui ne font pas que des sneakers ». UNE règle, ici ; Statistiques la
// consomme (src/ecrans/Stats.jsx, carte « Par catégorie »).
//
// D'OÙ VIENT LA CATÉGORIE — une source PROUVÉE, jamais le titre (§5) :
//   1. la catégorie Vinted de l'annonce (`catalog_id`, lue par l'extension dans
//      le dressing ou sur la page de l'annonce), reliée à la vente par SA
//      transaction (`item_id`), traduite en famille par le CATALOGUE de Vinted
//      (`vinted_catalogue` : le chemin « Femmes > Accessoires > Lunettes de
//      soleil » que Vinted lui-même donne à ce numéro) ;
//   2. sinon, celle qu'IL a choisie à la main (`vrm_categories_main`, par
//      identifiant de vente : « vinted:tx », « lbc:id », « ebay:id »,
//      « vestiaire:id »). Une catégorie LUE gagne toujours sur la main.
//   Rien d'autre : ni le titre, ni la marque, ni la taille (`familleArticle`
//   devine par le titre : il n'est PAS utilisé ici).
//   Sans l'un ni l'autre ⇒ « Sans catégorie (N) », avec le geste pour la poser.
//
// LES CHIFFRES — chacun chez son propriétaire (§11) :
//   · ventes et chiffre vendu : les lignes du VENDU (`ventesFaites`, date de la
//     vente, non annulées) — les mêmes que la tuile « Vendu » ;
//   · bénéfice brut et délai : le relevé des ventes FINALISÉES (`vrm_stats_ventes`),
//     le brut des seules ventes au prix d'achat connu (`classementRapporte`), avec
//     sa couverture « N sur M » et le manque NOMMÉ — jamais « au moins » (une
//     vente au prix inconnu peut être à perte : règle de l'écran, 3 nov.) ;
//   · délai : la MÉDIANE mise en ligne → vente (Vinted), comme le reste de l'écran ;
//   · en ligne : le stock publié par l'écran Annonces (`vrm_stats_stock.parCatalogue`).
// Règles PURES : exécutées par scripts/audit-stats-categories.cjs.

import { classementRapporte } from './ceQuiRapporte.js';

export const CLE_CATEGORIES_MAIN = 'vrm_categories_main';

// Les familles lisibles. `tuile` : la tuile de « Tu vends quoi ? »
// (src/profilVendeur.js, CATEGORIES_VENDS) qui lui correspond — vérifié par l'audit.
// Luxe et Vintage n'ont pas de famille : Vinted ne range pas une annonce en
// « luxe » ou « vintage », ce n'est jamais une catégorie lue.
export const FAMILLES_STATS = [
  { v: 'chaussures', titre: 'Chaussures', tuile: 'sneakers' },
  { v: 'vetements', titre: 'Vêtements', tuile: 'vetements' },
  { v: 'sacs', titre: 'Sacs', tuile: 'sacs' },
  { v: 'lunettes', titre: 'Lunettes', tuile: 'lunettes' },
  { v: 'montres', titre: 'Montres', tuile: 'montres' },
  { v: 'bijoux', titre: 'Bijoux', tuile: 'montres' },
  { v: 'accessoires', titre: 'Accessoires', tuile: 'accessoires' },
  { v: 'beaute', titre: 'Beauté', tuile: 'beaute' },
  { v: 'enfants', titre: 'Enfants', tuile: 'enfants' },
  { v: 'jouets', titre: 'Jouets', tuile: 'jouets' },
  { v: 'jeux', titre: 'Jeux vidéo', tuile: 'jeux' },
  { v: 'hightech', titre: 'High-tech', tuile: 'hightech' },
  { v: 'livres', titre: 'Livres', tuile: 'livres' },
  { v: 'musique', titre: 'Musique', tuile: 'musique' },
  { v: 'cartes', titre: 'Cartes', tuile: 'cartes' },
  { v: 'maison', titre: 'Maison', tuile: 'maison' },
  { v: 'sport', titre: 'Sport', tuile: 'sport' },
  { v: 'autre', titre: 'Autre', tuile: 'autre' },
];
const IDS = FAMILLES_STATS.map((f) => f.v);
export const titreFamille = (v) => (FAMILLES_STATS.find((f) => f.v === v) || {}).titre || '';
export const estFamille = (v) => IDS.includes(v);

// ── LE CHEMIN DU CATALOGUE VINTED → UNE FAMILLE ────────────────────────────
// Le chemin est celui de Vinted (« Racine > … > Feuille »). Les motifs se
// testent DANS L'ORDRE sur tout le chemin (le plus précis d'abord : des
// lunettes rangées sous « Accessoires » sont des Lunettes). Puis la RACINE
// (Maison, Électronique, Sport, Enfants). Un chemin lu mais non reconnu ⇒
// « autre » (une catégorie connue, pas un blanc). Chemin vide ⇒ '' (pas su).
const sansAccent = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const MOTIFS = [
  ['lunettes', /lunette/],
  ['montres', /\bmontres?\b/],
  ['bijoux', /bijou/],
  ['jeux', /(jeux? video|console)/],
  ['cartes', /cartes? (a collectionner|de collection|a jouer|pokemon)|trading card/],
  ['livres', /(\blivres?\b|bande dessinee|\bbd\b|manga|magazine|comics)/],
  ['musique', /(vinyle|\bmusique\b|\bcd\b|instrument)/],
  ['jouets', /(jouet|figurine|peluche|jeux de societe|puzzle|lego|poupee)/],
  ['beaute', /(beaute|\bsoins?\b|parfum|maquillage|cosmetique)/],
  ['chaussures', /(chaussure|basket|sneaker)/],
  ['sacs', /(^|>\s*)(sacs?\b|sacoche|maroquinerie|bagage)/],
  ['vetements', /vetement/],
  ['accessoires', /accessoire/],
];
const RACINES = [
  ['maison', /^maison/],
  ['hightech', /^(electronique|high-?tech|informatique|telephon)/],
  ['sport', /^sports?\b/],
  ['enfants', /^enfants?\b/],
];
export function familleDeChemin(chemin) {
  const ch = sansAccent(chemin).trim();
  if (!ch) return '';
  const segs = ch.split('>').map((s) => s.trim()).filter(Boolean);
  const plat = segs.join(' > ');
  for (const [f, re] of MOTIFS) if (re.test(plat)) return f;
  for (const [f, re] of RACINES) if (re.test(segs[0] || '')) return f;
  return 'autre';
}
// Le catalogue entier en une table { catalog_id: famille } (petite, gardée sur
// l'appareil). Forme mesurée (28 oct., audit-categories-plateformes) :
// { catalogs: [{ id, title, path, catalogs: [...] }] }. Illisible ⇒ null.
export function tableFamilles(catalogue) {
  if (!catalogue || !Array.isArray(catalogue.catalogs)) return null;
  const out = {};
  const pile = catalogue.catalogs.map((c) => [c, '']);
  let n = 0;
  while (pile.length && n++ < 50000) {
    const [c, parent] = pile.pop();
    if (!c || typeof c !== 'object') continue;
    const chemin = c.path ? String(c.path) + ' > ' + String(c.title || '') : (parent ? parent + ' > ' : '') + String(c.title || '');
    if (c.id != null && c.id !== '') { const f = familleDeChemin(chemin); if (f) out[String(c.id)] = f; }
    if (Array.isArray(c.catalogs)) for (const s of c.catalogs) pile.push([s, chemin]);
  }
  return out;
}

// ── LA CATÉGORIE D'UNE VENTE ────────────────────────────────────────────────
// `cle` : « vinted:tx » … ; `catalogId` : la catégorie Vinted LUE de son annonce
// (ou null) ; `table` : tableFamilles ; `main` : vrm_categories_main.
// Rend { famille, source: 'vinted' | 'main' } ou null (sans catégorie).
export const cleVente = (plateforme, id) => {
  const p = String(plateforme || '');
  const pre = p === 'Vinted' ? 'vinted' : p === 'Leboncoin' ? 'lbc' : p === 'eBay' ? 'ebay' : p === 'Vestiaire' ? 'vestiaire' : '';
  const i = String(id == null ? '' : id).trim();
  if (!pre || !i) return '';
  // Le relevé range déjà « lbc:… », « ebay:… », « vestiaire:… » : même clé.
  return i.startsWith(pre + ':') ? i : pre + ':' + i;
};
export function familleDeVente({ catalogId, table, main, cle }) {
  const id = catalogId == null ? '' : String(catalogId).trim();
  if (id && table && table[id]) return { famille: table[id], source: 'vinted' };
  const m = main && cle && main[cle] && typeof main[cle] === 'object' ? main[cle].f : (main && cle ? main[cle] : null);
  if (typeof m === 'string' && estFamille(m)) return { famille: m, source: 'main' };
  return null;
}
// SON clic : range les ventes `cles` dans `famille`. Une catégorie LUE n'est
// jamais remplacée (`lues` : les clés dont la catégorie vient de Vinted).
// `famille` vide ⇒ retire le choix. Rend la NOUVELLE table (rien n'est muté).
export function ecritureCategoriesMain(avant, cles, famille, lues, at) {
  const out = { ...(avant && typeof avant === 'object' && !Array.isArray(avant) ? avant : {}) };
  const sauf = lues instanceof Set ? lues : new Set(lues || []);
  for (const k of (cles || [])) {
    if (!k || sauf.has(k)) continue;
    if (!famille) { delete out[k]; continue; }
    if (!estFamille(famille)) continue;
    out[k] = { f: famille, at: at || Date.now() };
  }
  return out;
}

// ── LES CHIFFRES PAR CATÉGORIE ──────────────────────────────────────────────
// vendu   : lignes du VENDU de la période { plateforme, tx, eur, ts } ;
// releve  : relevé FINALISÉ de la période { plateforme, id, eur, achat, ts, enLigne } ;
// famDe   : (plateforme, id) → { famille, source } | null ;
// stock   : { [famille]: n, '': n sans catégorie } | null (pas su).
// Rend { groupes, sans, familles, n, eur } ; `sans` = les ventes sans catégorie
// ({ n, eur, cles }) ; chaque groupe :
//   { v, titre, n, eur, fin, nCout, brut, mediane, nDelai, stock, main }.
export function statsParCategorie({ vendu, releve, famDe, stock }) {
  if (!Array.isArray(vendu)) return null;
  const G = new Map();
  const g = (v) => G.get(v) || (G.set(v, { v, titre: titreFamille(v), n: 0, eur: 0, fin: 0, nCout: 0, brut: null, mediane: null, nDelai: 0, stock: null, main: 0 }), G.get(v));
  const sans = { n: 0, eur: 0, cles: [] };
  let n = 0, eur = 0;
  for (const l of vendu) {
    if (!l) continue;
    const e = Number(l.eur); if (!isFinite(e)) continue;
    n += 1; eur += Math.round(e * 100);
    const cle = cleVente(l.plateforme, l.tx);
    const f = famDe ? famDe(l.plateforme, l.tx) : null;
    if (!f) { sans.n += 1; sans.eur += Math.round(e * 100); if (cle) sans.cles.push(cle); continue; }
    const x = g(f.famille); x.n += 1; x.eur += Math.round(e * 100); if (f.source === 'main') x.main += 1;
  }
  // Le brut et le délai : LA règle de « Ce qui rapporte » (`classementRapporte`),
  // sur le relevé finalisé, groupé par famille (la clé posée sur une copie).
  if (Array.isArray(releve)) {
    const par = new Map();
    for (const l of releve) {
      if (!l) continue;
      const f = famDe ? famDe(l.plateforme, l.id) : null;
      if (!f) continue;
      (par.get(f.famille) || (par.set(f.famille, []), par.get(f.famille))).push(l);
    }
    for (const [v, ls] of par) {
      const C = classementRapporte(ls.map((l) => ({ ...l, plateforme: 'tous' })), 'site');
      const t = C && C.groupes && C.groupes[0];
      if (!t) continue;
      const x = g(v); x.fin = t.n; x.nCout = t.nCout; x.brut = t.brut; x.mediane = t.mediane; x.nDelai = t.nDelai;
    }
  }
  if (stock && typeof stock === 'object') for (const [v, k] of Object.entries(stock)) { if (v && estFamille(v) && Number(k) > 0) g(v).stock = Number(k); }
  const groupes = [...G.values()].map((x) => ({ ...x, eur: x.eur / 100 }))
    .sort((a, b) => b.n - a.n || b.eur - a.eur || (b.stock || 0) - (a.stock || 0) || IDS.indexOf(a.v) - IDS.indexOf(b.v));
  return { groupes, sans: { ...sans, eur: sans.eur / 100 }, stockSans: stock && Number(stock['']) > 0 ? Number(stock['']) : 0, familles: groupes.length, n, eur: eur / 100 };
}
// Le stock en ligne par famille, depuis le compte par catégorie Vinted publié
// par l'écran Annonces ({ [catalog_id | '']: n }). Table absente ⇒ null (pas su).
export function stockParFamille(parCatalogue, table) {
  if (!parCatalogue || typeof parCatalogue !== 'object' || !table) return null;
  const out = {};
  for (const [id, n] of Object.entries(parCatalogue)) {
    const k = Number(n); if (!(k > 0)) continue;
    const f = id ? table[String(id)] || '' : '';
    out[f] = (out[f] || 0) + k;
  }
  return out;
}
// Le bloc se montre-t-il ? Un vendeur d'UNE seule catégorie ne le voit pas
// (rien d'inutile). Il paraît dès que DEUX familles sont connues (ventes de la
// période ou stock en ligne), ou s'il a dit vendre autre chose que des
// sneakers (`jeVends` = 'autre') et qu'il reste des ventes sans catégorie.
export function afficherCategories(S, jeVends) {
  if (!S) return false;
  if (S.familles >= 2) return true;
  return jeVends === 'autre' && S.sans.n > 0;
}
