// ── UNE VENTE DE PLUSIEURS ARTICLES = UNE VENTE, CHAQUE ARTICLE À SA PLACE (11 nov., lot ventes-lot) ──
// Julien vend parfois un LOT sur Vinted (l'acheteur prend plusieurs annonces en une
// commande). Vinted en fait UNE transaction, UN colis, UN bordereau, UN versement.
//
// FORME MESURÉE (lecture du code et des relevés déjà faits, aucune base lue ici) :
//   · la ligne `harvest_{uid}_txn_{tx}` range la transaction sous `data.payload.transaction` ;
//     `order.items` = les articles du lot (« 206 articles sur 206 ont `id` », mesuré le
//     12 sept., cf. `fetchLotItems`), chacun avec `id` (l'IDENTIFIANT D'ANNONCE), `title`,
//     `price` (objet `{ amount, currency_code }` — le prix AFFICHÉ de l'annonce, cf.
//     src/statsOffres.js), `photos[]`, `size_title` ; `items_count` = leur nombre ;
//   · la liste des ventes (`my_orders`) n'a AUCUN champ de nombre : Vinted titre la
//     commande « Lot 3 articles » (mesuré sur 734 achats le 3 nov., src/suggestionsAchat.js).
//     Le titre ne sert qu'à savoir QUELLES transactions relire, jamais à relier un article.
//
// LES RÈGLES (toutes ici, exécutées par scripts/audit-ventes-lot.cjs ; le serveur en porte
// une COPIE refabriquée par `node scripts/audit-ventes-lot.cjs --recopie`, jamais à la main) :
//   1. Un article se relie par son IDENTITÉ seulement : l'identifiant d'annonce ⇒ sa fiche N°,
//      sinon la photo exacte (non ambiguë), sinon le N° que Julien a posé lui-même (« Relier »).
//      Jamais le titre. Deux articles du lot qui tomberaient sur le même N° ⇒ aucun des deux
//      (mieux vaut un blanc qu'un faux : deux paires sous un N° est le seul risque irréversible).
//   2. Le prix reçu se RÉPARTIT entre les articles : au prorata des prix affichés s'ils sont
//      tous lus (même devise), sinon à parts égales — et c'est DIT. La somme des parts vaut le
//      total au centime près (plus grand reste) : aucune perte, aucun double comptage.
//   3. Le CA reste celui de la TRANSACTION (une vente, datée au versement) : ce module ne
//      fabrique jamais de vente supplémentaire.
//   4. Le prix d'achat du lot = celui qu'IL a posé sur la vente, sinon la somme des articles
//      SEULEMENT si tous sont connus ; sinon `null` (« pas su » ≠ 0), le manque compté.
//   5. Le tampon du bordereau liste les N° : « 124 · 131 · 140 » ; un article non relié n'y
//      met rien de deviné (« + 1 sans N° »).
/* eslint-disable */

// Le prix d'un article en centimes (`{ amount }`, nombre, ou chaîne « 12,50 »). Rien de lisible ⇒ null.
export const centimesLot = (v) => {
  if (v == null) return null;
  const brut = typeof v === 'object' ? (v.amount ?? v.value) : v;
  if (brut == null || String(brut).trim() === '') return null;
  const s = String(brut).trim().replace(',', '.');
  if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(s)) return null;
  const [a, b = ''] = s.split('.');
  return Number(a) * 100 + Number(b.padEnd(2, '0'));
};
const deviseLot = (v) => (v && typeof v === 'object' && v.currency_code ? String(v.currency_code).toUpperCase() : null);
const photoLot = (it) => {
  const p = Array.isArray(it && it.photos) ? it.photos[0] : null;
  if (!p) return (it && typeof it.photo === 'string' && it.photo) || null;
  return typeof p === 'string' ? p : (p.url || p.full_size_url || null);
};

// Les articles d'une transaction Vinted. `undefined` ⇒ transaction pas lue ; [] ⇒ lue sans
// articles. Chaque article : { item, titre, prix (centimes|null), devise, photo, taille }.
export const articlesDeTransaction = (tr) => {
  if (tr == null || typeof tr !== 'object') return undefined;
  const t = tr.payload && tr.payload.transaction ? tr.payload.transaction : (tr.transaction || tr);
  const items = t && t.order && Array.isArray(t.order.items) ? t.order.items : (Array.isArray(t && t.items) ? t.items : null);
  if (!items) return undefined;
  return items.filter((it) => it && typeof it === 'object').map((it) => ({
    item: it.id != null && String(it.id).trim() !== '' ? String(it.id) : null,
    titre: String(it.title || it.name || '').trim(),
    prix: centimesLot(it.price),
    devise: deviseLot(it.price),
    photo: photoLot(it),
    taille: it.size_title ? String(it.size_title) : null,
  }));
};

// Le nombre d'articles d'une vente : la transaction (articles lus, `items_count`), sinon null.
export const nombreArticlesVente = (tr) => {
  const a = articlesDeTransaction(tr);
  const t = tr && typeof tr === 'object' ? (tr.payload && tr.payload.transaction ? tr.payload.transaction : (tr.transaction || tr)) : null;
  const c = t && t.items_count != null ? Number(t.items_count) : NaN;
  const n = Math.max(Array.isArray(a) ? a.length : 0, Number.isInteger(c) ? c : 0);
  return n > 0 ? n : null;
};

// Une commande dont le TITRE dit « Lot … » (titre donné par Vinted) : seulement pour savoir
// quelles transactions relire. Jamais une identité.
export const titreDitLot = (titre) => /^\s*lot\b/i.test(String(titre || ''));

// Règle 1 — relier chaque article par identité.
//   numeroDeItem(item)   → N° de la fiche de CETTE annonce, ou null
//   numeroDePhoto(photo) → N° de la fiche à CETTE photo (non ambiguë), ou null
//   liens                → { [item]: N° } posés par SON clic « Relier »
//   cle(n)               → la clé d'un N° (`cleNum` de l'app : « 007 » = « 7 »)
export const relierArticlesLot = (articles, { numeroDeItem = () => null, numeroDePhoto = () => null, liens = null, cle = (n) => String(n).trim().toUpperCase() } = {}) => {
  const out = (articles || []).map((a) => {
    const parItem = a.item ? numeroDeItem(a.item) : null;
    if (parItem != null && String(parItem).trim() !== '') return { ...a, num: String(parItem).trim(), par: 'annonce' };
    const parPhoto = a.photo ? numeroDePhoto(a.photo) : null;
    if (parPhoto != null && String(parPhoto).trim() !== '') return { ...a, num: String(parPhoto).trim(), par: 'photo' };
    const main = a.item && liens && liens[a.item] != null ? String(liens[a.item]).trim() : '';
    if (main) return { ...a, num: main, par: 'main' };
    return { ...a, num: null, par: null };
  });
  // Deux articles du MÊME lot sous un même N° : ils ne peuvent pas être la même paire
  // (deux annonces). Aucun des deux n'est relié — le doute se dit, il ne se tranche pas.
  const compte = {};
  for (const a of out) if (a.num) { const k = cle(a.num); compte[k] = (compte[k] || 0) + 1; }
  return out.map((a) => (a.num && compte[cle(a.num)] > 1 ? { ...a, num: null, par: null, conflit: true } : a));
};

// Règle 2 — répartir le prix reçu (centimes) entre les articles, au centime près.
// → { mode: 'prorata' | 'egal' | null, parts: [centimes], phrase }
const plusGrandReste = (total, poids) => {
  const somme = poids.reduce((s, p) => s + p, 0);
  const bruts = poids.map((p) => (total * p) / somme);
  const parts = bruts.map((b) => Math.floor(b));
  let reste = total - parts.reduce((s, p) => s + p, 0);
  const ordre = bruts.map((b, i) => ({ i, f: b - Math.floor(b) })).sort((x, y) => (y.f - x.f) || (x.i - y.i));
  for (let k = 0; reste > 0 && k < ordre.length; k++, reste--) parts[ordre[k].i] += 1;
  return parts;
};
export const PHRASE_PART_EGALE = 'réparti également, prix par article pas lu';
export const PHRASE_PRORATA = 'réparti au prorata des prix affichés';
export const repartirPrixLot = (totalCentimes, articles) => {
  const n = Array.isArray(articles) ? articles.length : 0;
  if (!(Number.isSafeInteger(totalCentimes) && totalCentimes >= 0) || n === 0) return { mode: null, parts: [], phrase: '' };
  const devises = new Set(articles.map((a) => a.devise || 'EUR'));
  const tousLus = articles.every((a) => Number.isSafeInteger(a.prix) && a.prix > 0) && devises.size === 1;
  if (tousLus) return { mode: 'prorata', parts: plusGrandReste(totalCentimes, articles.map((a) => a.prix)), phrase: PHRASE_PRORATA };
  return { mode: 'egal', parts: plusGrandReste(totalCentimes, articles.map(() => 1)), phrase: PHRASE_PART_EGALE };
};

// Règle 4 — le prix d'achat du lot.
//   achatDe(article relié) → centimes | null ; `achatPose` : centimes posés par LUI sur la vente.
// → { achat: centimes | null, connus, n, source: 'vente' | 'articles' | null, parArticle: [centimes|null] }
export const achatLot = (relies, achatDe = () => null, achatPose = null) => {
  const n = (relies || []).length;
  const parArticle = (relies || []).map((a) => { if (!a.num && !a.item) return null; const c = achatDe(a); return Number.isSafeInteger(c) && c >= 0 ? c : null; });
  const connus = parArticle.filter((c) => c != null).length;
  if (Number.isSafeInteger(achatPose) && achatPose >= 0) return { achat: achatPose, connus, n, source: 'vente', parArticle };
  if (n > 0 && connus === n) return { achat: parArticle.reduce((s, c) => s + c, 0), connus, n, source: 'articles', parArticle };
  return { achat: null, connus, n, source: null, parArticle };
};

// Règle 5 — le texte du tampon : « 124 · 131 · 140 » (+ « + 1 sans N° »). '' si aucun N°.
export const texteTamponLot = (relies) => {
  const nums = (relies || []).filter((a) => a.num).map((a) => String(a.num));
  const sans = (relies || []).length - nums.length;
  if (!nums.length) return '';
  return nums.join(' · ') + (sans > 0 ? ` + ${sans} sans N°` : '');
};

// La phrase du manque : « 1 article non relié » / « 2 articles non reliés ».
export const phraseNonRelies = (k) => (k > 0 ? `${k} article${k > 1 ? 's' : ''} non relié${k > 1 ? 's' : ''}` : '');

// Facture : une ligne par article (désignation + N° s'il est prouvé), à SA part du prix.
// La somme des lignes vaut le prix de la vente au centime près.
export const lignesFactureLot = (relies, parts) => (relies || []).map((a, i) => ({
  designation: `${a.titre || 'Article'}${a.taille && !String(a.titre || '').includes(a.taille) ? ` · ${a.taille}` : ''}${a.num ? ` · N°${a.num}` : ''}`.slice(0, 400),
  centimes: Number.isSafeInteger(parts && parts[i]) ? parts[i] : 0,
}));

// TOUT EN UN : le résumé d'une vente de plusieurs articles. `tr` = la transaction lue
// (undefined = pas lue). `total` = le prix de la vente (centimes, celui du CA).
// → null si ce n'est pas un lot (≤ 1 article lu) ; sinon
//   { n, lu, articles: [{ item, titre, prix, photo, taille, num, par, part, achat, benefice }],
//     mode, phrase, nonRelies, phraseManque, tampon, nums, achat }
export const resumeVenteLot = (tr, total, opts = {}) => {
  const articles = articlesDeTransaction(tr);
  const n = nombreArticlesVente(tr);
  if (!n || n < 2) return null;
  if (!Array.isArray(articles) || articles.length < 2) {
    // `items_count` dit un lot mais les articles ne sont pas lus : rien de relié, rien de réparti.
    return { n, lu: false, articles: [], mode: null, phrase: '', nonRelies: n, phraseManque: phraseNonRelies(n), tampon: '', nums: [], achat: { achat: Number.isSafeInteger(opts.achatPose) ? opts.achatPose : null, connus: 0, n, source: Number.isSafeInteger(opts.achatPose) ? 'vente' : null, parArticle: [] } };
  }
  const relies = relierArticlesLot(articles, opts);
  const rep = repartirPrixLot(Number.isSafeInteger(total) ? total : -1, relies);
  const ach = achatLot(relies, opts.achatDe, opts.achatPose);
  const nonRelies = relies.filter((a) => !a.num).length;
  return {
    n: relies.length, lu: true,
    articles: relies.map((a, i) => {
      const part = rep.parts[i] != null ? rep.parts[i] : null;
      const achat = ach.parArticle[i];
      return { ...a, part, achat, benefice: part != null && achat != null ? part - achat : null };
    }),
    mode: rep.mode, phrase: rep.phrase, nonRelies, phraseManque: phraseNonRelies(nonRelies),
    tampon: texteTamponLot(relies), nums: relies.filter((a) => a.num).map((a) => a.num), achat: ach,
  };
};
