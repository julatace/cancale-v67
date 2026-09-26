// api/ebay.js — TOUTES les routes eBay en UNE seule fonction serverless.
//
// ⚠️ POURQUOI TOUT EN UN FICHIER : le plan Vercel Hobby limite à 12 fonctions
// serverless par déploiement. Le projet en a déjà 12 ; trois fichiers eBay
// séparés (auth + callback + deletion) faisaient passer à 15 → TOUT déploiement
// échouait (« exceeded_serverless_functions_per_deployment »), et la prod
// restait bloquée sur l'ancienne version. On route donc par `?mode=` :
//   • (défaut)        → pilotage par l'app : GET santé, POST authurl/apptoken/
//                       exchange/status ;
//   • ?mode=callback  → retour de consentement eBay (redirige vers l'app) ;
//   • ?mode=deletion  → conformité : notification de suppression de compte.
// `vercel.json` redirige /api/ebay-callback et /api/ebay-deletion vers ici, pour
// que les URLs publiques restent stables (eBay les appelle telles quelles).
//
// La logique OAuth vit dans api/_lib/ebay.js (§11, partagée). Sécurité : clés
// dans les variables Vercel, jamais dans le dépôt ; jetons jamais renvoyés au
// navigateur ; échecs honnêtes (503 sans clés, un refus eBay remonte).

import crypto from 'crypto';
import { keysReady, canConsent, ruName, authUrl, appToken, exchangeCode, hasRefresh, accessToken, storeData } from './_lib/ebay.js';

// ── LECTURE des données eBay du vendeur (centraliser dans VRM) ───────────────
// Julien : « capte absolument tout d'eBay ». C'est une LECTURE (comme la moisson
// Vinted) : on ne publie rien. On mesure ce qu'eBay expose VRAIMENT pour son
// compte, on range, et on renvoie un résumé (comptes + échantillon) — pas de
// schéma inventé (§6).
const EBAY_API = 'https://api.ebay.com';
async function ebayJson(url, token, extra) {
  try {
    const r = await fetch(url, { headers: Object.assign({ Authorization: `Bearer ${token}`, Accept: 'application/json' }, extra || {}) });
    const txt = await r.text();
    let j = null; try { j = JSON.parse(txt); } catch (_) {}
    return { status: r.status, ok: r.ok, data: j, raw: txt.slice(0, 400) };
  } catch (e) { return { status: 0, ok: false, error: String((e && e.message) || '').slice(0, 120) }; }
}
// Trading API (XML) : le seul moyen fiable de récupérer les annonces créées sur
// le SITE eBay (l'Inventory API ne voit que celles créées par API).
async function tradingActiveList(token) {
  const body = '<?xml version="1.0" encoding="utf-8"?>'
    + '<GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">'
    + '<ActiveList><Include>true</Include><Pagination><EntriesPerPage>200</EntriesPerPage><PageNumber>1</PageNumber></Pagination></ActiveList>'
    + '</GetMyeBaySellingRequest>';
  try {
    const r = await fetch(`${EBAY_API}/ws/api.dll`, {
      method: 'POST',
      headers: {
        'X-EBAY-API-CALL-NAME': 'GetMyeBaySelling',
        'X-EBAY-API-SITEID': '71',                 // 71 = eBay France
        'X-EBAY-API-COMPATIBILITY-LEVEL': '1149',
        'X-EBAY-API-IAF-TOKEN': token,             // jeton OAuth
        'Content-Type': 'text/xml',
      },
      body,
    });
    const xml = await r.text();
    // Parsing minimal (pas de lib) : on compte et on extrait titre/id/prix.
    const items = [];
    const re = /<Item>([\s\S]*?)<\/Item>/g; let m;
    while ((m = re.exec(xml)) && items.length < 300) {
      const blk = m[1];
      const g = (t) => { const x = new RegExp('<' + t + '[^>]*>([\\s\\S]*?)</' + t + '>').exec(blk); return x ? x[1].trim() : ''; };
      items.push({
        itemId: g('ItemID'),
        title: g('Title'),
        price: g('CurrentPrice') || g('BuyItNowPrice') || g('StartPrice'),
        qty: g('QuantityAvailable') || g('Quantity'),
        vendus: g('QuantitySold'),
        vues: g('WatchCount'),
        photo: g('GalleryURL') || g('PictureURL'),
        depuis: g('StartTime'),
        url: g('ViewItemURL'),
      });
    }
    const ack = (/<Ack>([\s\S]*?)<\/Ack>/.exec(xml) || [])[1] || '';
    return { status: r.status, ok: r.ok && /Success|Warning/i.test(ack), ack, items, raw: xml.slice(0, 500) };
  } catch (e) { return { status: 0, ok: false, error: String((e && e.message) || '').slice(0, 120) }; }
}

// Appel Trading générique (XML) : renvoie le XML brut + l'Ack + le 1er message
// d'erreur eBay le cas échéant.
async function tradingCall(token, callName, inner) {
  const body = '<?xml version="1.0" encoding="utf-8"?>'
    + `<${callName}Request xmlns="urn:ebay:apis:eBLBaseComponents">${inner}</${callName}Request>`;
  try {
    const r = await fetch(`${EBAY_API}/ws/api.dll`, {
      method: 'POST',
      headers: { 'X-EBAY-API-CALL-NAME': callName, 'X-EBAY-API-SITEID': '71', 'X-EBAY-API-COMPATIBILITY-LEVEL': '1149', 'X-EBAY-API-IAF-TOKEN': token, 'Content-Type': 'text/xml' },
      body,
    });
    const xml = await r.text();
    const ack = (/<Ack>([\s\S]*?)<\/Ack>/.exec(xml) || [])[1] || '';
    const err = (/<Errors>[\s\S]*?<(?:LongMessage|ShortMessage)>([\s\S]*?)<\/(?:LongMessage|ShortMessage)>/.exec(xml) || [])[1] || '';
    return { status: r.status, ok: r.ok && /Success|Warning/i.test(ack), ack, err, xml };
  } catch (e) { return { status: 0, ok: false, error: String((e && e.message) || '').slice(0, 140) }; }
}

// Détail COMPLET d'une annonce (description, catégorie, état, photos,
// caractéristiques). Pour capter « tout ».
async function tradingGetItem(token, itemId) {
  const res = await tradingCall(token, 'GetItem', `<ItemID>${itemId}</ItemID><DetailLevel>ReturnAll</DetailLevel><IncludeItemSpecifics>true</IncludeItemSpecifics>`);
  if (!res.ok) return { _err: res.err || res.ack || res.error || ('status ' + res.status) };
  const xml = res.xml;
  const g = (t) => { const x = new RegExp('<' + t + '[^>]*>([\\s\\S]*?)</' + t + '>').exec(xml); return x ? x[1].trim() : ''; };
  const photos = []; const pre = /<PictureURL[^>]*>([\s\S]*?)<\/PictureURL>/g; let pm;
  while ((pm = pre.exec(xml)) && photos.length < 24) photos.push(pm[1].trim());
  const specs = {}; const sre = /<NameValueList>([\s\S]*?)<\/NameValueList>/g; let sm;
  while ((sm = sre.exec(xml))) { const n = (/<Name>([\s\S]*?)<\/Name>/.exec(sm[1]) || [])[1]; const v = (/<Value>([\s\S]*?)<\/Value>/.exec(sm[1]) || [])[1]; if (n) specs[n.trim()] = (v || '').trim(); }
  return {
    description: g('Description').replace(/<!\[CDATA\[|\]\]>/g, '').slice(0, 4000),
    categoryId: (/<PrimaryCategory>[\s\S]*?<CategoryID>([\s\S]*?)<\/CategoryID>/.exec(xml) || [])[1] || '',
    categoryName: (/<PrimaryCategory>[\s\S]*?<CategoryName>([\s\S]*?)<\/CategoryName>/.exec(xml) || [])[1] || '',
    condition: g('ConditionDisplayName'),
    photos,
    specifics: specs,
  };
}

// MODIFIER prix / stock d'une annonce existante (léger et sûr, prévu pour ça).
async function tradingReviseInventoryStatus(token, itemId, price, qty) {
  let inv = `<ItemID>${itemId}</ItemID>`;
  if (price != null && price !== '') inv += `<StartPrice>${Number(String(price).replace(',', '.')).toFixed(2)}</StartPrice>`;
  if (qty != null && qty !== '') inv += `<Quantity>${parseInt(qty, 10)}</Quantity>`;
  return tradingCall(token, 'ReviseInventoryStatus', `<InventoryStatus>${inv}</InventoryStatus>`);
}

async function handleRevise(b) {
  const itemId = String(b.itemId || '').trim();
  if (!/^\d+$/.test(itemId)) return { status: 400, body: { ok: false, error: 'itemId invalide' } };
  if ((b.price == null || b.price === '') && (b.quantity == null || b.quantity === '')) return { status: 400, body: { ok: false, error: 'rien à modifier' } };
  const at = await accessToken();
  if (!at.ok) return { status: at.status || 502, body: { ok: false, reason: at.reason, error: at.error } };
  const r = await tradingReviseInventoryStatus(at.token, itemId, b.price, b.quantity);
  if (!r.ok) return { status: r.status >= 500 ? 502 : (r.status || 502), body: { ok: false, error: r.err || 'eBay a refusé la modification', ack: r.ack } };
  return { status: 200, body: { ok: true, ack: r.ack } };
}

// ── MESURE pour la PUBLICATION (lecture seule) : ce qu'eBay EXIGE pour créer
//    une annonce — la catégorie, ses attributs obligatoires, et les règles/
//    emplacements du compte. On mesure AVANT d'écrire le publieur (§6).
async function handlePubInfo(b) {
  const at = await accessToken();
  if (!at.ok) return { status: at.status || 502, body: { ok: false, reason: at.reason, error: at.error } };
  const token = at.token;
  const MKT = 'EBAY_FR';
  const H = { 'Accept-Language': 'fr-FR', 'Content-Language': 'fr-FR' };
  const title = String(b.title || 'Nike Air Max baskets').slice(0, 80);
  // 1) Arbre de catégories FR + suggestion de catégorie pour un titre.
  const tree = await ebayJson(`${EBAY_API}/commerce/taxonomy/v1/get_default_category_tree_id?marketplace_id=${MKT}`, token, H);
  const treeId = (tree.data && tree.data.categoryTreeId) || '';
  let sugg = { status: 0 }, aspects = { status: 0 }, categoryId = String(b.categoryId || '');
  if (treeId) {
    sugg = await ebayJson(`${EBAY_API}/commerce/taxonomy/v1/category_tree/${treeId}/get_category_suggestions?q=${encodeURIComponent(title)}`, token, H);
    const s0 = sugg.data && sugg.data.categorySuggestions && sugg.data.categorySuggestions[0];
    if (!categoryId && s0 && s0.category) categoryId = s0.category.categoryId || '';
    if (categoryId) aspects = await ebayJson(`${EBAY_API}/commerce/taxonomy/v1/category_tree/${treeId}/get_item_aspects_for_category?category_id=${categoryId}`, token, H);
  }
  // 2) Règles du compte (paiement / retour / expédition) + emplacements.
  const [pay, ret, ful, loc] = await Promise.all([
    ebayJson(`${EBAY_API}/sell/account/v1/payment_policy?marketplace_id=${MKT}`, token, H),
    ebayJson(`${EBAY_API}/sell/account/v1/return_policy?marketplace_id=${MKT}`, token, H),
    ebayJson(`${EBAY_API}/sell/account/v1/fulfillment_policy?marketplace_id=${MKT}`, token, H),
    ebayJson(`${EBAY_API}/sell/inventory/v1/location`, token, H),
  ]);
  const pol = (r, key) => ({ status: r.status, count: ((r.data && r.data[key]) || []).length, ids: ((r.data && r.data[key]) || []).slice(0, 3).map(p => ({ id: p[Object.keys(p).find(k => /PolicyId$/.test(k))] || p.paymentPolicyId || p.returnPolicyId || p.fulfillmentPolicyId, name: p.name })) });
  const asp = (aspects.data && aspects.data.aspects) || [];
  return { status: 200, body: {
    ok: true,
    treeId,
    categorie: { suggeree: (sugg.data && sugg.data.categorySuggestions && sugg.data.categorySuggestions[0] && sugg.data.categorySuggestions[0].category) || null, status: sugg.status, categoryId },
    attributsObligatoires: asp.filter(a => a.aspectConstraint && a.aspectConstraint.aspectRequired).map(a => a.localizedAspectName),
    attributsCount: asp.length,
    reglePaiement: pol(pay, 'paymentPolicies'),
    regleRetour: pol(ret, 'returnPolicies'),
    regleExpedition: pol(ful, 'fulfillmentPolicies'),
    emplacements: { status: loc.status, count: ((loc.data && loc.data.locations) || []).length },
    // Bruts en cas d'erreur, pour diagnostiquer sans deviner.
    diag: { tree: tree.ok ? undefined : tree.raw, sugg: sugg.ok ? undefined : sugg.raw, aspects: aspects.ok ? undefined : aspects.raw, pay: pay.ok ? undefined : pay.raw, loc: loc.ok ? undefined : loc.raw },
  } };
}

async function handleSync() {
  const at = await accessToken();
  if (!at.ok) return { status: at.status || 502, body: { ok: false, reason: at.reason, error: at.error, detail: at.detail || '' } };
  const token = at.token;
  // On appelle chaque source séparément : un échec n'empêche pas les autres.
  const [orders, inv, listings] = await Promise.all([
    ebayJson(`${EBAY_API}/sell/fulfillment/v1/order?limit=50`, token),
    // L'Inventory API exige un Accept-Language (sinon 400 « Invalid value for
    // header Accept-Language »). Ne concerne que les annonces créées par API.
    ebayJson(`${EBAY_API}/sell/inventory/v1/inventory_item?limit=100`, token, { 'Accept-Language': 'fr-FR', 'Content-Language': 'fr-FR' }),
    tradingActiveList(token),
  ]);
  // ── DÉTAIL COMPLET par annonce (photos, description, catégorie, état,
  //    caractéristiques) : « capter tout ». On borne à 20 GetItem par sync
  //    (limites d'API) — largement assez pour son stock, et extensible.
  const lst = listings.items || [];
  const detailDiag = [];
  for (const it of lst.slice(0, 20)) {
    if (!it.itemId) continue;
    const d = await tradingGetItem(token, it.itemId);
    if (d && !d._err) { it.detail = d; if (!it.photo && d.photos && d.photos[0]) it.photo = d.photos[0]; }
    else if (d && d._err && detailDiag.length < 3) detailDiag.push({ itemId: it.itemId, err: d._err });
  }
  // Range ce qu'on a (fusion par id). On garde le brut pour mesurer la forme.
  const at2 = Date.now();
  await storeData('ebay_listings', { items: lst, ack: listings.ack, status: listings.status, capturedAt: at2 });
  await storeData('ebay_orders', { orders: (orders.data && orders.data.orders) || [], status: orders.status, capturedAt: at2 });
  await storeData('ebay_inventory', { items: (inv.data && inv.data.inventoryItems) || [], status: inv.status, capturedAt: at2 });
  // Résumé de MESURE : comptes + statuts + petits échantillons (pour voir la forme).
  return { status: 200, body: {
    ok: true,
    listings: { status: listings.status, ack: listings.ack, count: (listings.items || []).length, sample: (listings.items || []).slice(0, 3), detailDiag, raw: listings.raw, error: listings.error },
    orders: { status: orders.status, count: ((orders.data && orders.data.orders) || []).length, total: (orders.data && orders.data.total), sample: (((orders.data && orders.data.orders) || []).slice(0, 1)), raw: orders.ok ? undefined : orders.raw },
    inventory: { status: inv.status, count: ((inv.data && inv.data.inventoryItems) || []).length, total: (inv.data && inv.data.total), raw: inv.ok ? undefined : inv.raw },
  } };
}

// ── CONFORMITÉ : notification de suppression de compte ──────────────────────
const verifToken = () => process.env.EBAY_VERIF_TOKEN || '';
function deletionUrl(req) {
  if (process.env.EBAY_DELETION_URL) return process.env.EBAY_DELETION_URL;
  const host = (req.headers && (req.headers['x-forwarded-host'] || req.headers.host)) || 'vrm.center';
  return `https://${host}/api/ebay-deletion`;   // l'URL publique stable, pas le chemin interne
}
async function handleDeletion(req, res) {
  if (req.method === 'GET') {
    const code = (req.query && (req.query.challenge_code || req.query.challengeCode)) || '';
    if (!code) { res.status(200).json({ ok: true, ready: !!verifToken() }); return; }
    if (!verifToken()) { res.status(503).json({ ok: false, reason: 'no-verif-token', error: 'EBAY_VERIF_TOKEN non configuré sur Vercel.' }); return; }
    const hash = crypto.createHash('sha256');
    hash.update(String(code)); hash.update(verifToken()); hash.update(deletionUrl(req));  // ordre imposé par eBay
    res.status(200).json({ challengeResponse: hash.digest('hex') });
    return;
  }
  if (req.method === 'POST') { res.status(200).json({ ok: true }); return; }
  res.status(405).json({ ok: false, error: 'GET/POST' });
}

// ── RETOUR DE CONSENTEMENT (eBay renvoie le navigateur ici) ─────────────────
function retour(res, statut, reason) {
  const q = 'ebay=' + statut + (reason ? '&raison=' + encodeURIComponent(reason) : '');
  res.setHeader('Location', '/?' + q);
  res.status(302).end();
}
async function handleCallback(req, res) {
  const q = req.query || {};
  if (q.error) { retour(res, 'refus', String(q.error).slice(0, 60)); return; }
  const code = String(q.code || '').trim();
  if (!code) { retour(res, 'erreur', 'aucun code'); return; }
  if (!keysReady()) { retour(res, 'erreur', 'clés absentes'); return; }
  try {
    const r = await exchangeCode(code);
    retour(res, r.ok ? 'connecte' : 'erreur', r.ok ? '' : (r.reason || (r.error || '').slice(0, 60)));
  } catch (_) { retour(res, 'erreur', 'echange impossible'); }
}

// ── PILOTAGE PAR L'APP (défaut) ─────────────────────────────────────────────
async function handleApp(req, res) {
  if (req.method === 'GET') {
    res.status(200).json({ ok: true, ready: keysReady(), canConsent: canConsent(), env: 'production' });
    return;
  }
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'POST' }); return; }
  const b = req.body || {};
  const action = String(b.action || '');
  if (!keysReady()) { res.status(503).json({ ok: false, reason: 'no-key', error: 'eBay indisponible : EBAY_APP_ID / EBAY_CERT_ID ne sont pas configurés sur Vercel.' }); return; }
  try {
    if (action === 'authurl') {
      if (!ruName()) { res.status(503).json({ ok: false, reason: 'no-runame', error: 'Le RuName (EBAY_RUNAME) n\'est pas configuré.' }); return; }
      res.status(200).json({ ok: true, url: authUrl(b.state) });
      return;
    }
    if (action === 'apptoken') {
      const r = await appToken();
      res.status(r.status).json(r.ok ? { ok: true, works: true, expires_in: r.expires_in || null } : { ok: false, error: r.error, detail: r.detail || '' });
      return;
    }
    if (action === 'exchange') {
      const r = await exchangeCode(String(b.code || '').trim());
      res.status(r.status).json(r.ok ? { ok: true, connected: true } : { ok: false, reason: r.reason, error: r.error, detail: r.detail || '' });
      return;
    }
    if (action === 'status') {
      const has = await hasRefresh();
      if (has === null) { res.status(503).json({ ok: false, reason: 'store-unreachable', error: 'Impossible de lire l\'état (base injoignable).' }); return; }
      res.status(200).json({ ok: true, connected: !!has });
      return;
    }
    if (action === 'sync') {
      const r = await handleSync();
      res.status(r.status).json(r.body);
      return;
    }
    if (action === 'revise') {
      const r = await handleRevise(b);
      res.status(r.status).json(r.body);
      return;
    }
    if (action === 'pubinfo') {
      const r = await handlePubInfo(b);
      res.status(r.status).json(r.body);
      return;
    }
    res.status(400).json({ ok: false, error: 'action inconnue' });
  } catch (e) {
    res.status(502).json({ ok: false, error: 'eBay injoignable', detail: String((e && e.message) || '').slice(0, 200) });
  }
}

export default async function handler(req, res) {
  const mode = (req.query && req.query.mode) || '';
  if (mode === 'deletion') return handleDeletion(req, res);
  if (mode === 'callback') return handleCallback(req, res);
  return handleApp(req, res);
}
