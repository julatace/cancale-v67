// ── eBAY COMPLET 3 : DE LA LECTURE AUX GESTES (15 nov., 2e tour) ─────────────────
// Julien : « tu peux encore faire mieux pour eBay ». Ce module ajoute :
//   · `diagnostic` (LECTURE) : pour chaque annonce qui ne se voit pas, les raisons MESURÉES —
//     caractéristiques manquantes (Compliance), peu de photos (GetItem), prix au-dessus des
//     annonces actives COMPARABLES (Browse API publique, jeton d'application : même produit par
//     son ePID, sinon mêmes caractéristiques Marque + Modèle + Pointure dans la même catégorie,
//     même état). C'est un CONSTAT sur une annonce existante, jamais un « prix conseillé » à la
//     mise en ligne (refusé le 11 oct.) ; moins de 5 comparables ⇒ rien n'est affirmé ;
//   · `corrigeraspects` (ÉCRITURE) : ajoute les caractéristiques manquantes, une valeur PROPOSÉE
//     par eBay pour CETTE annonce (relue chez eBay juste avant), jamais une caractéristique déjà
//     remplie écrasée ; toutes les autres caractéristiques renvoyées telles quelles ; RELU après ;
//   · `lierproduit` (ÉCRITURE) : relie l'annonce au produit du catalogue eBay (ePID) que eBay
//     PROPOSE pour elle (Compliance PRODUCT_ADOPTION, relu) — sans photo ni texte du catalogue ;
//   · `ajouterphotos` (ÉCRITURE) : ajoute des photos (adresses https de SA fiche) ; le nombre de
//     photos vu dans l'aperçu doit être celui d'eBay au moment d'écrire ; RELU après.
// Chaque écriture : `confirme:true` exigé AVANT tout appel (son clic), état relu avant (rien
// écrit si l'annonce a changé depuis l'aperçu), relu APRÈS (« fait » seulement si eBay le
// montre), journalisée par la route (« Ce que VRM a fait »). Rien de payant : une révision
// d'annonce est gratuite sur eBay ; aucune étiquette, aucune livraison touchée (§2.8).
// ⚠️ NON MESURÉ : GetItem/ReviseItem (Trading), getListingViolations (`listing_id`), Browse
// `item_summary/search` (`epid`, `aspect_filter`) : formes de la documentation officielle :
// developer.ebay.com/devzone/xml/docs/reference/ebay/ReviseItem.html, …/GetItem.html,
// developer.ebay.com/api-docs/sell/compliance/resources/listing_violation/methods/getListingViolations,
// developer.ebay.com/api-docs/buy/browse/resources/item_summary/methods/search.
import { fetchAvecDelai } from './fetch-delai.js';

const liste = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
const texte = (v) => (v == null ? '' : typeof v === 'object' ? String(v['#text'] ?? '') : String(v));
const ID = /^\d{1,19}$/;
const xml = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const echec = (error, status = 400, reason) => ({ status, body: { ok: false, error, ...(reason ? { reason } : {}) } });
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
export const PHOTOS_PEU = 4;          // moins de 4 photos : « peu de photos » (eBay en accepte 24)
export const PHOTOS_MAX = 24;
export const COMPARABLES_MIN = 5;     // moins de 5 annonces comparables : rien n'est affirmé
export const ECART_PRIX = 1.15;       // au-dessus de 115 % de la médiane : « plus cher que les comparables »

// ── Une annonce lue par GetItem : ses caractéristiques, ses photos, son prix, son ePID.
export function annonceLue(root) {
  const it = root && root.Item;
  if (!it || !ID.test(texte(it.ItemID))) return null;
  const specs = {};
  for (const nv of liste(it.ItemSpecifics && it.ItemSpecifics.NameValueList)) {
    const n = texte(nv.Name).trim(); if (!n) continue;
    specs[n] = liste(nv.Value).map(texte).map((x) => x.trim()).filter(Boolean);
  }
  const prixNode = (it.SellingStatus && it.SellingStatus.CurrentPrice) || it.StartPrice;
  const prix = Number(texte(prixNode));
  return {
    itemId: texte(it.ItemID), titre: texte(it.Title).slice(0, 120),
    specs, photos: liste(it.PictureDetails && it.PictureDetails.PictureURL).map(texte).filter((u) => /^https:\/\//.test(u)),
    prix: Number.isFinite(prix) ? prix : null, devise: (prixNode && prixNode['@_currencyID']) || null,
    categorie: texte(it.PrimaryCategory && it.PrimaryCategory.CategoryID),
    etat: texte(it.ConditionID), epid: texte(it.ProductListingDetails && (it.ProductListingDetails.ProductReferenceID || it.ProductListingDetails.EPID)),
    statut: texte(it.SellingStatus && it.SellingStatus.ListingStatus), type: texte(it.ListingType), variantes: !!it.Variations,
  };
}
// Les caractéristiques (valeurs) en XML, TOUTES : ReviseItem remplace l'ensemble fourni.
export const xmlSpecs = (specs) => '<ItemSpecifics>' + Object.entries(specs).map(([n, vs]) => `<NameValueList><Name>${xml(n)}</Name>${liste(vs).map((v) => `<Value>${xml(v)}</Value>`).join('')}</NameValueList>`).join('') + '</ItemSpecifics>';

// ── Ce que eBay propose pour UNE annonce (Compliance relue) : caractéristiques et ePID.
export function propositions(violations, itemId) {
  const out = { manque: [], suggestions: {}, epid: '' };
  for (const l of liste(violations && violations.listingViolations)) {
    if (String((l && l.listingId) || '') !== String(itemId)) continue;
    for (const v of liste(l.violations)) {
      for (const x of liste(v && v.violationData)) { const n = String((x && (x.value || x.name)) || '').trim(); if (n && !/^MISSING/i.test(n)) out.manque.push(n); }
      const rec = (v && v.correctiveRecommendations) || {};
      for (const a of liste(rec.aspectRecommendations)) { const n = String((a && a.localizedAspectName) || '').trim(); if (n) out.suggestions[n] = liste(a.suggestedValues).map((s) => String(s).trim()).filter(Boolean); }
      const e = String((rec.productRecommendation && rec.productRecommendation.epid) || '').trim();
      if (/^\d{1,20}$/.test(e)) out.epid = e;
    }
  }
  for (const n of Object.keys(out.suggestions)) if (!out.manque.includes(n)) out.manque.push(n);
  out.manque = [...new Set(out.manque)];
  return out;
}
// « Évidente » : une caractéristique pour laquelle eBay ne propose QU'UNE valeur.
export const evidentes = (p) => Object.fromEntries(Object.entries((p && p.suggestions) || {}).filter(([, vs]) => vs.length === 1).map(([n, vs]) => [n, vs[0]]));

// ── Les comparables (Browse) : prix en euros des annonces actives à prix fixe, hors la sienne.
export function prixComparables(data, itemId, devise = 'EUR') {
  const l = liste(data && data.itemSummaries).filter((x) => x && String(x.legacyItemId || '') !== String(itemId) && x.price && x.price.currency === devise && Number.isFinite(Number(x.price.value)))
    .map((x) => Number(x.price.value)).sort((a, b) => a - b);
  if (!l.length) return { n: 0, mediane: null, min: null, max: null };
  const m = l.length % 2 ? l[(l.length - 1) / 2] : (l[l.length / 2 - 1] + l[l.length / 2]) / 2;
  return { n: l.length, mediane: Math.round(m * 100) / 100, min: l[0], max: l[l.length - 1] };
}
const NOMS_MARQUE = ['Marque', 'Brand', 'Marke', 'Marca'], NOMS_MODELE = ['Modèle', 'Model', 'Modell', 'Modello', 'Modelo'], NOMS_TAILLE = ['Pointure', 'US Shoe Size', 'EU Shoe Size', 'Pointure EU', 'Schuhgröße', 'Taglia', 'Talla', 'Taille'];
const premier = (specs, noms) => { for (const n of noms) if (specs[n] && specs[n][0]) return [n, specs[n][0]]; return null; };
export function requeteComparables(a, marketplace) {
  const base = `filter=${encodeURIComponent(`buyingOptions:{FIXED_PRICE},priceCurrency:${a.devise || 'EUR'}${/^\d{4}$/.test(a.etat) ? `,conditionIds:{${a.etat}}` : ''}`)}&limit=50`;
  if (/^\d{1,20}$/.test(a.epid || '')) return { base: 'epid', url: `/buy/browse/v1/item_summary/search?epid=${a.epid}&${base}` };
  const mq = premier(a.specs, NOMS_MARQUE), mo = premier(a.specs, NOMS_MODELE), tl = premier(a.specs, NOMS_TAILLE);
  if (!mq || !mo || !tl || !/^\d{1,10}$/.test(a.categorie)) return null;
  const af = `categoryId:${a.categorie},${mq[0]}:{${mq[1]}},${mo[0]}:{${mo[1]}},${tl[0]}:{${tl[1]}}`;
  return { base: 'caracteristiques', url: `/buy/browse/v1/item_summary/search?q=${encodeURIComponent(mq[1] + ' ' + mo[1])}&category_ids=${a.categorie}&aspect_filter=${encodeURIComponent(af)}&${base}`, marketplace };
}
// Les raisons d'une annonce qui ne se voit pas, dans l'ordre du geste le plus simple.
export function raisons(a, p, comp) {
  const r = [];
  if (p && p.manque.length) r.push({ cle: 'caracteristiques', manque: p.manque, suggestions: p.suggestions });
  if (a && a.photos.length < PHOTOS_PEU) r.push({ cle: 'photos', n: a.photos.length });
  if (a && comp && comp.n >= COMPARABLES_MIN && a.prix != null && comp.mediane != null && a.prix > comp.mediane * ECART_PRIX) r.push({ cle: 'prix', prix: a.prix, mediane: comp.mediane, n: comp.n });
  if (p && p.epid && !(a && a.epid)) r.push({ cle: 'catalogue', epid: p.epid });
  return r;
}

export function creerGestesEbay({ accessToken, tradingCall, lireXml, jetonApplication, apiOrigin = 'https://api.ebay.com', marketplace = 'EBAY_FR', fetcher = (...a) => fetchAvecDelai(...a) }) {
  const mk = () => (typeof marketplace === 'function' ? marketplace() : marketplace);
  const jeton = async (ctx) => { const r = await accessToken(ctx); return r && r.ok && r.token ? r : { ko: echec((r && r.error) || 'Compte eBay indisponible.', (r && r.status) || 502, r && r.reason) }; };
  async function json(url, token) {
    try {
      const r = await fetcher(url, { headers: { Authorization: 'Bearer ' + token, Accept: 'application/json', 'X-EBAY-C-MARKETPLACE-ID': mk() }, signal: AbortSignal.timeout(10000) });
      const raw = await r.text().catch(() => ''); let data = null; try { data = raw ? JSON.parse(raw) : {}; } catch (_) {}
      return { status: r.status, ok: r.status >= 200 && r.status < 300, data };
    } catch (_) { return { status: 0, ok: false, data: null }; }
  }
  const getItem = async (token, itemId) => {
    const r = await tradingCall(token, 'GetItem', `<ItemID>${itemId}</ItemID><DetailLevel>ReturnAll</DetailLevel><IncludeItemSpecifics>true</IncludeItemSpecifics>`);
    if (!r || !r.ok) return null;
    return annonceLue(lireXml(r.xml, 'GetItem'));
  };
  const lireViolations = async (token, itemId, type) => {
    const r = await json(`${apiOrigin}/sell/compliance/v1/listing_violation?compliance_type=${type}&listing_id=${itemId}&limit=50`, token);
    if (r.status === 204) return {};
    return r.ok ? r.data : null;
  };
  const revise = async (token, inner) => {
    const r = await tradingCall(token, 'ReviseItem', `<Item>${inner}</Item>`);
    if (!r || r.status === 0 || !r.ack) return { incertain: true };
    if (!r.ok) return { refus: (r.err || "eBay a refusé la modification.").slice(0, 300) };
    return { ok: true, avertissements: r.avertissements || [] };
  };
  const issueEcriture = (w, quoi) => (w.incertain ? echec(`eBay n'a pas répondu clairement — je ne sais pas si ${quoi}. Regarde l'annonce sur eBay avant de recommencer.`, 504, 'incertain') : echec(w.refus, 422, 'refus'));

  // ── LECTURE : les raisons des annonces qui ne se voient pas (10 au plus par appel).
  async function diagnostic(b, ctx) {
    const ids = [...new Set(liste(b.itemIds).map(String))].filter((x) => ID.test(x)).slice(0, 10);
    if (!ids.length) return echec('Aucune annonce à examiner.');
    const a = await jeton(ctx); if (a.ko) return a.ko;
    const app = jetonApplication ? await jetonApplication().catch(() => null) : null;
    const out = [];
    for (const id of ids) {
      const ann = await getItem(a.token, id);
      if (!ann) { out.push({ itemId: id, ko: 'annonce' }); continue; }
      const [va, vp] = await Promise.all([lireViolations(a.token, id, 'ASPECTS_ADOPTION'), lireViolations(a.token, id, 'PRODUCT_ADOPTION')]);
      const p = va == null && vp == null ? null : propositions({ listingViolations: [...liste(va && va.listingViolations), ...liste(vp && vp.listingViolations)] }, id);
      let comp = null; const q = requeteComparables(ann, mk());
      if (q && app) { const r = await json(apiOrigin + q.url, app); comp = r.ok ? { ...prixComparables(r.data, id, ann.devise || 'EUR'), base: q.base } : null; }
      out.push({ itemId: id, titre: ann.titre, prix: ann.prix, devise: ann.devise, photos: ann.photos.length, epid: ann.epid || '', propositions: p, evidentes: p ? evidentes(p) : {}, comparables: comp, comparablesBase: q ? q.base : null, raisons: raisons(ann, p, comp), conformiteLue: p != null });
    }
    return { status: 200, body: { ok: true, annonces: out } };
  }

  // ── ÉCRITURE : les caractéristiques manquantes, valeurs proposées par eBay pour CETTE annonce.
  async function corrigerAspects(b, ctx) {
    if (b.confirme !== true) return echec("Confirme l'ajout des caractéristiques : rien n'a été envoyé.", 400, 'confirmation');
    const itemId = String(b.itemId || '');
    const voulu = b.aspects && typeof b.aspects === 'object' ? Object.entries(b.aspects).filter(([n, v]) => typeof n === 'string' && n.trim() && typeof v === 'string' && v.trim()).slice(0, 15) : [];
    if (!ID.test(itemId) || !voulu.length) return echec('Annonce ou caractéristiques invalides.');
    const a = await jeton(ctx); if (a.ko) return a.ko;
    const v = await lireViolations(a.token, itemId, 'ASPECTS_ADOPTION');
    if (v == null) return echec("eBay n'a pas rendu ce qui manque à cette annonce — rien n'a été envoyé.", 503, 'pas-su');
    const p = propositions(v, itemId);
    for (const [n, val] of voulu) {
      const vs = p.suggestions[n];
      if (!vs || !vs.some((x) => norm(x) === norm(val))) return echec(`« ${val} » n'est pas une valeur proposée par eBay pour ${n} sur cette annonce — rien n'a été envoyé.`, 409, 'hors-proposition');
    }
    const avant = await getItem(a.token, itemId);
    if (!avant) return echec("eBay n'a pas rendu l'annonce — rien n'a été envoyé.", 503, 'pas-su');
    if (avant.statut && avant.statut !== 'Active') return echec("Cette annonce n'est plus en ligne — rien n'a été envoyé.", 409, 'pas-en-ligne');
    if (avant.variantes) return echec('Annonce à variantes : à compléter sur eBay.', 409, 'variantes');
    const deja = voulu.filter(([n]) => avant.specs[n] && avant.specs[n].length);
    if (deja.length) return echec(`${deja.map(([n]) => n).join(', ')} est déjà rempli sur eBay — VRM n'écrase rien. Actualise.`, 409, 'deja-rempli');
    const specs = { ...avant.specs };
    for (const [n, val] of voulu) specs[n] = [p.suggestions[n].find((x) => norm(x) === norm(val))];
    const w = await revise(a.token, `<ItemID>${itemId}</ItemID>${xmlSpecs(specs)}`);
    if (!w.ok) return issueEcriture(w, 'les caractéristiques ont été ajoutées');
    const apres = await getItem(a.token, itemId);
    const manquent = apres ? voulu.filter(([n]) => !(apres.specs[n] || []).some((x) => norm(x) === norm(specs[n][0]))) : voulu;
    const perdues = apres ? Object.keys(avant.specs).filter((n) => !(apres.specs[n] || []).length) : [];
    if (!apres || manquent.length || perdues.length) return { status: 200, body: { ok: false, reason: 'pas-relu', error: "eBay a accepté, mais l'annonce relue ne montre pas tout — regarde-la sur eBay.", manquent: manquent.map(([n]) => n), perdues } };
    return { status: 200, body: { ok: true, itemId, ajoutees: Object.fromEntries(voulu.map(([n]) => [n, specs[n][0]])), relu: true, avertissements: w.avertissements } };
  }

  // ── ÉCRITURE : relier l'annonce au produit du catalogue que eBay propose (ePID).
  async function lierProduit(b, ctx) {
    if (b.confirme !== true) return echec("Confirme le lien avec le produit eBay : rien n'a été envoyé.", 400, 'confirmation');
    const itemId = String(b.itemId || ''), epid = String(b.epid || '');
    if (!ID.test(itemId) || !/^\d{1,20}$/.test(epid)) return echec('Annonce ou produit invalide.');
    const a = await jeton(ctx); if (a.ko) return a.ko;
    const v = await lireViolations(a.token, itemId, 'PRODUCT_ADOPTION');
    if (v == null) return echec("eBay n'a pas rendu sa proposition de produit — rien n'a été envoyé.", 503, 'pas-su');
    const p = propositions(v, itemId);
    if (p.epid !== epid) return echec("eBay ne propose plus ce produit pour cette annonce — rien n'a été envoyé. Actualise.", 409, 'hors-proposition');
    const avant = await getItem(a.token, itemId);
    if (!avant) return echec("eBay n'a pas rendu l'annonce — rien n'a été envoyé.", 503, 'pas-su');
    if (avant.epid) return echec('Cette annonce est déjà reliée à un produit eBay.', 409, 'deja-relie');
    // Sans les photos ni la description du catalogue : l'annonce garde SES photos, SON texte.
    const w = await revise(a.token, `<ItemID>${itemId}</ItemID><ProductListingDetails><ProductReferenceID>${epid}</ProductReferenceID><IncludeStockPhotoURL>false</IncludeStockPhotoURL><UseStockPhotoURLAsGallery>false</UseStockPhotoURLAsGallery><IncludeeBayProductDetails>false</IncludeeBayProductDetails></ProductListingDetails>`);
    if (!w.ok) return issueEcriture(w, "l'annonce a été reliée");
    const apres = await getItem(a.token, itemId);
    if (!apres || apres.epid !== epid) return { status: 200, body: { ok: false, reason: 'pas-relu', error: "eBay a accepté, mais l'annonce relue ne porte pas ce produit — regarde-la sur eBay." } };
    if (apres.photos.length < avant.photos.length) return { status: 200, body: { ok: false, reason: 'photos-changees', error: "L'annonce relue a perdu des photos — regarde-la sur eBay." } };
    return { status: 200, body: { ok: true, itemId, epid, relu: true } };
  }

  // ── ÉCRITURE : ajouter des photos (adresses https de sa fiche), le nombre vu à l'aperçu exigé.
  async function ajouterPhotos(b, ctx) {
    if (b.confirme !== true) return echec("Confirme l'ajout des photos : rien n'a été envoyé.", 400, 'confirmation');
    const itemId = String(b.itemId || '');
    const neuves = [...new Set(liste(b.photos).map(String))].filter((u) => /^https:\/\/[^\s<>"']{8,500}$/.test(u)).slice(0, PHOTOS_MAX);
    if (!ID.test(itemId) || !neuves.length || !Number.isInteger(b.nVu) || b.nVu < 0) return echec('Annonce ou photos invalides.');
    const a = await jeton(ctx); if (a.ko) return a.ko;
    const avant = await getItem(a.token, itemId);
    if (!avant) return echec("eBay n'a pas rendu l'annonce — rien n'a été envoyé.", 503, 'pas-su');
    if (avant.photos.length !== b.nVu) return echec(`L'annonce a changé sur eBay (${avant.photos.length} photos au lieu de ${b.nVu}) — rien n'a été envoyé. Actualise.`, 409, 'photos-changees');
    const toutes = [...avant.photos, ...neuves.filter((u) => !avant.photos.includes(u))].slice(0, PHOTOS_MAX);
    if (toutes.length === avant.photos.length) return echec('Ces photos sont déjà sur l’annonce.', 409, 'deja');
    const w = await revise(a.token, `<ItemID>${itemId}</ItemID><PictureDetails>${toutes.map((u) => `<PictureURL>${xml(u)}</PictureURL>`).join('')}</PictureDetails>`);
    if (!w.ok) return issueEcriture(w, 'les photos ont été ajoutées');
    const apres = await getItem(a.token, itemId);
    if (!apres || apres.photos.length < toutes.length) return { status: 200, body: { ok: false, reason: 'pas-relu', error: "eBay a accepté, mais l'annonce relue n'a pas toutes les photos — regarde-la sur eBay.", n: apres ? apres.photos.length : null } };
    return { status: 200, body: { ok: true, itemId, n: apres.photos.length, ajoutees: apres.photos.length - avant.photos.length, relu: true } };
  }
  return { diagnostic, corrigerAspects, lierProduit, ajouterPhotos };
}
