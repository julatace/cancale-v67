// ══════════════════════════════════════════════════════════════════════════
//  LES ANNONCES DE CHAQUE SITE, DANS UNE SEULE FORME (19 nov. 2026)
//
//  `construireArticles` (src/articles/modele.js) ne connaît qu'UNE forme d'annonce. Ici, les
//  lectures de chaque site telles que l'app les a déjà (dressing Vinted, `lbc_listings`,
//  `ebay_listings`, `vc_listings`) y sont traduites — champ par champ, sans rien deviner :
//  un nombre absent reste `null` (jamais 0), un état pas su reste « à confirmer ».
//  L'IDENTITÉ (le N°, le lien vers Vinted) et l'ÉTAT ne sont PAS jugés ici : l'app les lit avec
//  SES règles (`numeroLbcIdentite`, `numEbayLu`, `numVcAnnonce`, `etatAnnonceLeboncoin`,
//  `etatAnnonceVcBrut`, <enligne-regle>) et les passe en fonctions. Module PUR.
// ══════════════════════════════════════════════════════════════════════════
const arr = (a) => (Array.isArray(a) ? a : []);
const str = (v) => (v == null ? '' : String(v).trim());
const nb = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);
const photoDe = (p) => (typeof p === 'string' ? p : (p && typeof p === 'object' && typeof p.url === 'string' ? p.url : '')) || null;

// Vinted. `comptes` : [{ uid, pseudo, ok, enLigne, aConfirmer, masquees, vendues?, retirees? }] (la lecture de l'app).
export function annoncesVinted(comptes) {
  const out = [];
  for (const c of arr(comptes)) {
    if (!c || !c.ok) continue;
    const pousse = (it, etat) => { if (!it || it.id == null) return; out.push({ site: 'vinted', id: String(it.id), compte: str(c.uid), pseudo: str(c.pseudo), titre: str(it.title), photo: photoDe(it.photo),
      prix: it.price, taille: str(it.size), condition: str(it.condition), marque: str(it.brand), depuis: it.createdTs != null ? it.createdTs : (it.created_at_ts != null ? it.created_at_ts : null),
      favoris: nb(it.favourites), vues: nb(it.views), messages: null, etat, numero: '', vintedId: '', url: str(it.url) }); };
    arr(c.enLigne).forEach((it) => pousse(it, 'enligne'));
    arr(c.aConfirmer).forEach((it) => pousse(it, 'aconfirmer'));
    arr(c.masquees).forEach((it) => pousse(it, 'masquee'));
    arr(c.vendues).forEach((it) => pousse(it, 'vendue'));
    arr(c.retirees).forEach((it) => pousse(it, 'retiree'));
    // Ses brouillons (lus sous SA session : `fetchVintedListings` → `brouillons`) : « À publier ».
    arr(c.brouillons).forEach((it) => pousse(it, 'brouillon'));
  }
  return out;
}
// Leboncoin. `items` : `lbc_listings.items`. `etatDe(ad)` : 'active'|'aconfirmer'|'pause'|'vendue'|autre (la règle de l'écran
// Leboncoin) ; `numeroDe(ad)` : le N° par identité ('' = aucun) ; `vintedDe(ad)` : l'annonce Vinted reliée ('' sinon) ;
// `pseudoDe(ad)` : le nom du compte ; `propreDe(ad)` : déclarée « pas sur Vinted » (journal de liaison).
const ETAT_LBC = { active: 'enligne', aconfirmer: 'aconfirmer', pause: 'pause', vendue: 'vendue' };
export function annoncesLeboncoin(items, { etatDe, numeroDe, vintedDe = null, pseudoDe = null, propreDe = null, compteDe = null } = {}) {
  const out = [];
  for (const ad of Object.values(items && typeof items === 'object' ? items : {})) {
    if (!ad || ad.id == null) continue;
    const e = typeof etatDe === 'function' ? str(etatDe(ad)) : '';
    const s = ad.stats && typeof ad.stats === 'object' ? ad.stats : {};
    out.push({ site: 'leboncoin', id: String(ad.id), compte: str(compteDe ? compteDe(ad) : (ad.account || ad.lbcUser)).replace(/^lbc-account:/i, ''), pseudo: str(pseudoDe ? pseudoDe(ad) : ad.accountName),
      titre: str(ad.subject || ad.title), photo: photoDe(arr(ad.images)[0]), prix: ad.price, taille: str(ad.taille || ad.size), condition: str(ad.condition),
      depuis: ad.publieeLe || ad.first_publication_date || ad.indexeeLe || ad.index_date || null,
      favoris: nb(s.favoris), vues: nb(s.vues), messages: nb(s.messages), etat: ETAT_LBC[e] || 'retiree',
      numero: str(typeof numeroDe === 'function' ? numeroDe(ad) : ''), vintedId: str(vintedDe ? vintedDe(ad) : ''), url: str(ad.url), propre: !!(propreDe && propreDe(ad)) });
  }
  return out;
}
// eBay. `items` : `ebay_listings.items` (tableau). `frais` : la ligne de son compte a été lue il y a moins de 24 h.
export function annoncesEbay(items, { numeroDe, vintedDe = null, propreDe = null } = {}) {
  const out = [];
  for (const x of arr(items)) {
    if (!x || x.itemId == null) continue;
    const fini = !!x.fin && Number.isFinite(Date.parse(String(x.fin))) && Date.parse(String(x.fin)) < Date.now();
    const vendu = nb(x.vendus) != null && nb(x.qty) != null && x.vendus > 0 && x.qty - x.vendus <= 0;
    out.push({ site: 'ebay', id: String(x.itemId), compte: str(x._compte), pseudo: str(x._pseudo), titre: str(x.title), photo: photoDe(x.photo),
      prix: str(x.currency || 'EUR').toUpperCase() === 'EUR' ? (x.price != null ? x.price : x.prix) : null, taille: str(x.taille), condition: str(x.condition),
      depuis: x.depuis || null, favoris: nb(x.observateurs), vues: nb(x.vues), messages: null,
      etat: vendu ? 'vendue' : fini ? 'retiree' : (x.frais === false ? 'aconfirmer' : 'enligne'),
      numero: str(typeof numeroDe === 'function' ? numeroDe(x) : ''), vintedId: str(vintedDe ? vintedDe(x) : ''), url: str(x.url), propre: !!(propreDe && propreDe(x)) });
  }
  return out;
}
// Vestiaire. `items` : `vc_listings.items` ({ [productId]: it }). `etatDe(id, it)` : 'en-ligne'|'a-confirmer'|'vendue'|'retiree'|autre
// (`etatAnnonceVcBrut`) ; `numeroDe(id, it)` : `numVcAnnonce` ; `vintedDe(id)` : `vrm_vc_liens[id].item`.
const ETAT_VC = { 'en-ligne': 'enligne', 'a-confirmer': 'aconfirmer', vendue: 'vendue', retiree: 'retiree' };
export function annoncesVestiaire(items, { etatDe, numeroDe, vintedDe = null, vieille = false } = {}) {
  const out = [];
  for (const [id, it] of Object.entries(items && typeof items === 'object' ? items : {})) {
    if (!it || typeof it !== 'object') continue;
    const e = ETAT_VC[typeof etatDe === 'function' ? str(etatDe(id, it)) : ''] || 'aconfirmer';
    const p = it.prix && typeof it.prix === 'object' ? (it.prix.vente != null ? it.prix.vente : it.prix.valeur != null ? it.prix.valeur : it.prix.amount) : it.prix;
    out.push({ site: 'vestiaire', id: String(id), compte: str(it.compte), pseudo: str(it.pseudo || it.compte), titre: str(it.titre), photo: photoDe(it.photo),
      prix: p, taille: str(it.taille), condition: str(it.etat),
      // (20 nov., ext. 5.410) La date de mise en ligne LUE chez Vestiaire (`misEnLigne`, exacte) — jamais la borne basse
      // `vueDepuis` (« au moins »), qui ne se présente pas comme une date de mise en ligne (src/dateMiseVc.js).
      depuis: it.depuis || it.misEnLigne || null, favoris: nb(it.favoris), vues: null, messages: null,
      etat: e === 'enligne' && vieille ? 'aconfirmer' : e, numero: str(typeof numeroDe === 'function' ? numeroDe(id, it) : ''), vintedId: str(vintedDe ? vintedDe(id) : ''), url: str(it.url) });
  }
  return out;
}
