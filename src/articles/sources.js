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
    // (21 nov.) Une lecture ratée d'un compte bloqué garde ses traces (ses fiches) : « rien lu » n'efface pas ce qu'on connaissait.
    if (!c || (!c.ok && !arr(c.traces).length)) continue;
    // (21 nov., compte bloqué) `c.horsLigne` (en pause ou retiré par son choix) : TOUTES ses annonces passent « bloque » (hors de
    // « en ligne » et des totaux) ; `c.traces` = [{ it, le, par }] : ce que la lecture ne montre plus (absente, fermée sans vente,
    // sa fiche) — la dernière trace connue, datée, jamais en ligne. Un id n'est poussé qu'une fois.
    const vus = new Set();
    const pousse = (it, etat0, trace = null) => { if (!it || it.id == null || vus.has(String(it.id))) return; vus.add(String(it.id));
      const etat = trace || (c.horsLigne && !['vendue', 'retiree'].includes(etat0)) ? 'bloque' : etat0;
      const bloque = etat === 'bloque' ? (trace || { le: Number.isFinite(c.lu) ? c.lu : null, par: 'lecture' }) : null;
      out.push({ bloque, site: 'vinted', id: String(it.id), compte: str(c.uid), pseudo: str(c.pseudo), titre: str(it.title), photo: photoDe(it.photo),
      prix: it.price, taille: str(it.size), condition: str(it.condition), marque: str(it.brand), depuis: it.createdTs != null ? it.createdTs : (it.created_at_ts != null ? it.created_at_ts : null),
      favoris: nb(it.favourites), vues: nb(it.views), messages: null, etat, numero: '', vintedId: '', url: str(it.url),
      // (20 nov.) `lu` : l'heure du dressing qui fait foi pour CE compte (`fetchVintedListings().lu`) — le point daté des vues.
      lu: Number.isFinite(c.lu) ? c.lu : null }); };
    const lus = c.ok ? c : {};
    arr(lus.enLigne).forEach((it) => pousse(it, 'enligne'));
    arr(lus.aConfirmer).forEach((it) => pousse(it, 'aconfirmer'));
    arr(lus.masquees).forEach((it) => pousse(it, 'masquee'));
    arr(lus.vendues).forEach((it) => pousse(it, 'vendue'));
    arr(lus.retirees).forEach((it) => pousse(it, 'retiree'));
    // Ses brouillons (lus sous SA session : `fetchVintedListings` → `brouillons`) : « À publier ».
    arr(lus.brouillons).forEach((it) => pousse(it, 'brouillon'));
    arr(c.traces).forEach((t) => { if (t && t.it) pousse(t.it, 'bloque', { le: Number.isFinite(t.le) ? t.le : null, par: str(t.par) || 'lecture' }); });
  }
  return out;
}
// (22 nov., Julien : « j'ai fait 3 ventes mais pas que sur Leboncoin ») LES ANNONCES VINTED VENDUES. Une annonce vendue sort
// du dressing : elle n'était plus nulle part dans Annonces. Elle y revient, « vendue », seulement par la PREUVE et l'IDENTITÉ :
//   · `vendus` : les identifiants d'annonce prouvés vendus (`lirePreuvesVenteVinted().vendus`, <preuve-vente-regle>) — null
//     (pas lus) ⇒ RIEN (on ne dit pas « vendue » sans preuve) ;
//   · chaque vente lue (`ventes`, celles de la coque) est reliée à SON annonce par son n° de transaction (`txnItem` : transaction
//     → item_id lu chez Vinted) — jamais par le titre ; sa date de vente (`date`) est gardée (`venduLe`) ;
//   · une annonce prouvée vendue encore dans le dressing (`dressing` : uid → [items fermés « vendue »]) sert ses données.
// `comptes` : les comptes lus (uid → pseudo) ; une vente d'un autre compte n'entre pas. `photoDe(o)` : la photo d'une vente.
export function annoncesVintedVendues({ ventes, txnItem, vendus, comptes, dressing = {}, photoDe = () => null } = {}) {
  if (!(vendus instanceof Set) || !txnItem || typeof txnItem !== 'object' || !comptes || typeof comptes !== 'object') return [];
  const out = [], vus = new Set();
  const pousse = (uid, it, venduLe) => {
    const id = str(it && it.id); if (!id || vus.has(id) || !vendus.has(id) || !(uid in comptes)) return; vus.add(id);
    out.push({ bloque: null, site: 'vinted', id, compte: uid, pseudo: str(comptes[uid]), titre: str(it.title), photo: photoDe(it) || photoDe2(it.photo),
      prix: it.price, taille: str(it.size), condition: str(it.condition), marque: str(it.brand), depuis: it.createdTs != null ? it.createdTs : null,
      favoris: nb(it.favourites), vues: nb(it.views), messages: null, etat: 'vendue', numero: '', vintedId: '', url: str(it.url), lu: null,
      venduLe: Number.isFinite(venduLe) ? venduLe : null });
  };
  for (const o of arr(ventes)) {
    if (!o || o.transaction_id == null) continue;
    const uid = str(o._acc && o._acc.vinted_user_id != null ? o._acc.vinted_user_id : o._uid);
    const id = str(txnItem[str(o.transaction_id)]); if (!id) continue;
    const t = Date.parse(str(o.date));
    const enDressing = arr(dressing[uid]).find((x) => x && str(x.id) === id) || null;
    pousse(uid, enDressing ? { ...enDressing, id } : { id, title: o.title, photo: o.photo, price: o.price && typeof o.price === 'object' ? o.price.amount : o.price, size: o.size_title || o.size, url: '' }, t);
  }
  for (const [uid, l] of Object.entries(dressing || {})) for (const it of arr(l)) pousse(uid, it, null);
  return out;
}
const photoDe2 = (p) => photoDe(p);
// Leboncoin. `items` : `lbc_listings.items`. `etatDe(ad)` : 'active'|'aconfirmer'|'pause'|'vendue'|autre (la règle de l'écran
// Leboncoin) ; `numeroDe(ad)` : le N° par identité ('' = aucun) ; `vintedDe(ad)` : l'annonce Vinted reliée ('' sinon) ;
// `pseudoDe(ad)` : le nom du compte ; `propreDe(ad)` : déclarée « pas sur Vinted » (journal de liaison).
const ETAT_LBC = { active: 'enligne', aconfirmer: 'aconfirmer', pause: 'pause', vendue: 'vendue' };
// `aLui(ad)` : la règle de l'app `annonceLbcALui` (référence VRM, ou compte prouvé par une vente / une session vue).
export function annoncesLeboncoin(items, { etatDe, numeroDe, vintedDe = null, pseudoDe = null, propreDe = null, compteDe = null, aLui = null } = {}) {
  const out = [];
  for (const ad of Object.values(items && typeof items === 'object' ? items : {})) {
    if (!ad || ad.id == null) continue;
    // (20 nov., capture de Julien : appartements, box, cartes… dans SES annonces) Une annonce Leboncoin n'est la sienne que
    // si elle est PROUVÉE à l'un de ses comptes (lue sous « Mes annonces » : `account`/`lbcUser`) ou reliée par identité
    // (N°, annonce Vinted). Les annonces d'autres vendeurs relevées en naviguant (126 sur 194 mesurées) ne sont pas les siennes ;
    // un compte présent ne suffit pas (15 nov. : 49 sur 60 avec un compte étaient d'autres) — `aLui` juge le compte.
    const compteLu = str(compteDe ? compteDe(ad) : (ad.account || ad.lbcUser)).replace(/^lbc-account:/i, '');
    const numLu = str(typeof numeroDe === 'function' ? numeroDe(ad) : '');
    const vintedLu = str(vintedDe ? vintedDe(ad) : '');
    const sien = typeof aLui === 'function' ? !!aLui(ad) : !!compteLu;
    if (!sien && !numLu && !vintedLu) continue;
    const e = typeof etatDe === 'function' ? str(etatDe(ad)) : '';
    const s = ad.stats && typeof ad.stats === 'object' ? ad.stats : {};
    out.push({ site: 'leboncoin', id: String(ad.id), compte: str(compteDe ? compteDe(ad) : (ad.account || ad.lbcUser)).replace(/^lbc-account:/i, ''), pseudo: str(pseudoDe ? pseudoDe(ad) : ad.accountName),
      titre: str(ad.subject || ad.title), photo: photoDe(arr(ad.images)[0]), prix: ad.price, taille: str(ad.taille || ad.size), condition: str(ad.condition),
      depuis: ad.publieeLe || ad.first_publication_date || ad.indexeeLe || ad.index_date || null,
      favoris: nb(s.favoris), vues: nb(s.vues), messages: nb(s.messages), etat: ETAT_LBC[e] || 'retiree', lu: Number.isFinite(Date.parse(s.at || '')) ? Date.parse(s.at) : null,
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
// (22 nov.) + la modération de Vestiaire : en attente de validation · à corriger · refusée (présentes, pas en ligne).
const ETAT_VC = { 'en-ligne': 'enligne', 'a-confirmer': 'aconfirmer', vendue: 'vendue', retiree: 'retiree', attente: 'attente', corriger: 'corriger', refusee: 'refusee' };
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
