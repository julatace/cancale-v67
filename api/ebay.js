// api/ebay.js — TOUTES les routes eBay en UNE seule fonction serverless.
//
// ⚠️ POURQUOI TOUT EN UN FICHIER : le plan Vercel Hobby limite à 12 fonctions
// serverless par déploiement. Le projet en a déjà 12 ; trois fichiers eBay
// séparés (auth + callback + deletion) faisaient passer à 15 → TOUT déploiement
// échouait (« exceeded_serverless_functions_per_deployment »), et la prod
// restait bloquée sur l'ancienne version. On route donc par `?mode=` :
//   • (défaut)        → pilotage par l'app : GET santé, POST authurl/apptoken/
//                       exchange/status/sync/finances/pubinfo/pubverify/publish/
//                       revise, et (5 octobre) sku · offreinfo · offre · retirer ;
//   • ?mode=callback  → retour de consentement eBay (redirige vers l'app) ;
//   • ?mode=deletion  → conformité : notification de suppression de compte.
// `vercel.json` redirige /api/ebay-callback et /api/ebay-deletion vers ici, pour
// que les URLs publiques restent stables (eBay les appelle telles quelles).
//
// La logique OAuth vit dans api/_lib/ebay.js (§11, partagée). Sécurité : clés
// dans les variables Vercel, jamais dans le dépôt ; jetons jamais renvoyés au
// navigateur ; échecs honnêtes (503 sans clés, un refus eBay remonte).

import crypto from 'crypto';
import { vendeurExige } from './_lib/session.js';
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
// ── L'IDENTITÉ D'UNE ANNONCE eBAY : SON SKU « VRM-{n°} » (§5, 5 octobre) ────
// Julien : « tu as accès à mon compte et tu ne fais rien de ouf ». Mesuré le
// 5 octobre : ses 2 annonces eBay actives n'ont AUCUN SKU, et rien ne les relie
// à une paire. Sans ce lien, une paire vendue sur Vinted reste en vente sur
// eBay sans que VRM puisse le voir — sauf à rapprocher par le titre, ce que §5
// interdit (22 % des ventes portent un titre en double).
// ⇒ Le champ SKU d'eBay (« étiquette personnalisée ») porte `VRM-{n°}`. Le
//   numéro passe par la MÊME règle que `cleNum` dans l'app (majuscules, sans
//   espace ni tiret, « 007 » = « 7 ») — `audit-ebay-route.cjs` compare leurs
//   sorties : une seule des deux modifiée, et le lien ne se refait plus.
const cleNum = (v) => {
  let s = String(v == null ? '' : v).trim().toUpperCase().replace(/[\s\-_.]/g, '');
  if (/^\d+$/.test(s)) s = String(parseInt(s, 10));
  return s;
};
const NUM_OK = /^([A-Z]{1,3})?\d{1,6}$/;
// Le SKU d'un numéro, ou '' quand le numéro n'en est pas un (on n'écrit JAMAIS
// un SKU approximatif : un faux lien ferait retirer la mauvaise annonce).
const skuDe = (numero) => { const c = cleNum(numero); return (c && NUM_OK.test(c)) ? 'VRM-' + c : ''; };
// Un identifiant d'annonce eBay : des chiffres, rien d'autre (il part dans du
// XML et dans un corps JSON envoyés à eBay).
const ID_EBAY = /^\d{1,19}$/;
// Le message d'erreur d'eBay, rendu tel quel mais SANS rien qui ressemble à un
// jeton (eBay ne devrait pas en renvoyer ; on ne le parie pas).
function messageEbaySur(m) {
  return String(m || '').replace(/Bearer\s+\S+/gi, '').replace(/v\^1\.1#\S+/g, '')
    .replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
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
      const g = (t, src) => { const x = new RegExp('<' + t + '[^>]*>([\\s\\S]*?)</' + t + '>').exec(src || blk); return x ? x[1].trim() : ''; };
      // ⚠️ Le SKU de l'ANNONCE, pas celui d'une de ses variantes : une annonce à
      //    variantes porte un <SKU> par variante dans <Variations>, et le premier
      //    venu relierait l'annonce entière à une seule paire.
      const sansVariantes = blk.replace(/<Variations>[\s\S]*?<\/Variations>/g, '');
      // WatchCount = le nombre de personnes qui SUIVENT l'annonce (les
      // « observateurs » d'eBay). Ce n'était pas des « vues » : `vues` est gardé
      // pour les lecteurs d'avant, `observateurs` dit la chose par son nom.
      // Absent ⇒ null (« pas su »), jamais 0.
      const wc = g('WatchCount');
      items.push({
        itemId: g('ItemID'),
        title: g('Title'),
        price: g('CurrentPrice') || g('BuyItNowPrice') || g('StartPrice'),
        qty: g('QuantityAvailable') || g('Quantity'),
        vendus: g('QuantitySold'),
        vues: wc,
        observateurs: /^\d+$/.test(wc) ? Number(wc) : null,
        sku: g('SKU', sansVariantes),
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
    const err = ((/<LongMessage>([\s\S]*?)<\/LongMessage>/.exec(xml)) || (/<ShortMessage>([\s\S]*?)<\/ShortMessage>/.exec(xml)) || [])[1] || '';
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
  // Trading renvoie HTTP 200 même sur refus (erreur dans le corps) → vrai code 422.
  if (!r.ok) return { status: r.status >= 400 ? r.status : 422, body: { ok: false, error: r.err || 'eBay a refusé la modification', ack: r.ack } };
  return { status: 200, body: { ok: true, ack: r.ack } };
}

// ── PUBLIER une nouvelle annonce (Trading AddFixedPriceItem) ────────────────
// MESURÉ : le compte n'est pas éligible aux Business Policies → on met
// l'expédition / le retour EN LIGNE dans l'appel (pas d'IDs de règles). Catégorie
// + attributs obligatoires viennent de `pubinfo`. Rien n'est deviné : l'app
// fournit un payload explicite (l'humain confirme avant d'envoyer).
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
// ── Le corps <Item> d'une annonce, construit UNE fois (§11) : partagé par la
//    publication réelle (AddFixedPriceItem) ET la vérification à blanc
//    (VerifyAddFixedPriceItem). Deux appels, un seul payload — impossible de
//    vérifier autre chose que ce qu'on publie.
function itemXml(it) {
  const pics = (it.photos || []).slice(0, 24).map(u => `<PictureURL>${esc(u)}</PictureURL>`).join('');
  const specs = Object.entries(it.aspects || {}).filter(([, v]) => v != null && String(v).trim())
    .map(([n, v]) => `<NameValueList><Name>${esc(n)}</Name><Value>${esc(v)}</Value></NameValueList>`).join('');
  return '<Item>' +
    `<Title>${esc(String(it.title || '').slice(0, 80))}</Title>` +
    // L'identité de la paire (`VRM-{n°}`). ⚠️ Posée par `avecSku` à partir du
    // NUMÉRO, jamais recopiée d'un `sku` envoyé par le navigateur.
    (it.sku ? `<SKU>${esc(it.sku)}</SKU>` : '') +
    `<Description><![CDATA[${String(it.description || it.title || '')}]]></Description>` +
    `<PrimaryCategory><CategoryID>${esc(it.categoryId)}</CategoryID></PrimaryCategory>` +
    `<StartPrice>${Number(String(it.price).replace(',', '.')).toFixed(2)}</StartPrice>` +
    `<Quantity>${parseInt(it.quantity || 1, 10)}</Quantity>` +
    '<ListingType>FixedPriceItem</ListingType><ListingDuration>GTC</ListingDuration>' +
    '<Currency>EUR</Currency><Country>FR</Country>' +
    `<Location>${esc(it.location || 'France')}</Location>` +
    `<ConditionID>${esc(it.conditionId || '3000')}</ConditionID>` +
    (pics ? `<PictureDetails>${pics}</PictureDetails>` : '') +
    (specs ? `<ItemSpecifics>${specs}</ItemSpecifics>` : '') +
    `<DispatchTimeMax>${parseInt(it.dispatchDays || 3, 10)}</DispatchTimeMax>` +
    // ⚠️ LIVRAISON GÉRÉE PAR eBay (« Simple Delivery », mesuré le 27 sept.). Son
    // compte laisse eBay PROPOSER et encaisser le port : eBay REFUSE alors un
    // <ShippingDetails> à prix fixe (« Item.ShippingDetails manquantes ou non
    // valides », mesuré à blanc). Quand `ebayGere` est vrai, on N'IMPOSE aucun
    // tarif — eBay applique sa livraison gérée. Sinon (compte à tarif fixe), on
    // envoie le mode + le coût choisis, à la charge de l'acheteur.
    // ⚠️ LIVRAISON GÉRÉE PAR eBay. MESURÉ 3 fois à blanc sur son compte (27 sept.) :
    // eBay REFUSE tout <ShippingDetails> que VRM envoie — transporteur + coût ET
    // transporteur seul sortent « Item.ShippingDetails non valides ». Seul un item
    // SANS aucun bloc livraison est accepté (ok:true) : eBay gère alors transporteur
    // ET prix (Julien : « c'est eBay qui propose »). VRM ne peut donc PAS laisser
    // choisir le transporteur via l'API — c'est le geste de l'appli eBay, pas du
    // nôtre. `ebayGere` (vrai par défaut) ⇒ on n'émet rien. Le mode tarif-fixe
    // reste possible pour un compte NON géré (rétro-compat).
    (it.ebayGere
      ? ''
      : '<ShippingDetails><ShippingType>Flat</ShippingType>' +
        '<ShippingServiceOptions><ShippingServicePriority>1</ShippingServicePriority>' +
        `<ShippingService>${esc(it.shippingService || 'FR_ColissimoLabelPointRetrait')}</ShippingService>` +
        `<ShippingServiceCost>${Number(String(it.shippingCost != null ? it.shippingCost : 0).replace(',', '.')).toFixed(2)}</ShippingServiceCost>` +
        '</ShippingServiceOptions></ShippingDetails>') +
    '<ReturnPolicy><ReturnsAcceptedOption>ReturnsAccepted</ReturnsAcceptedOption>' +
    '<ReturnsWithinOption>Days_14</ReturnsWithinOption><ShippingCostPaidByOption>Buyer</ShippingCostPaidByOption></ReturnPolicy>' +
    '</Item>';
}
async function tradingAddFixedPriceItem(token, it) {
  const res = await tradingCall(token, 'AddFixedPriceItem', itemXml(it));
  const itemId = (/<ItemID>([\s\S]*?)<\/ItemID>/.exec(res.xml || '') || [])[1] || '';
  return Object.assign(res, { itemId });
}
// Somme des frais eBay renvoyés (le <Fees> de la réponse) : chaque <Fee> porte
// un <Fee> montant. On additionne — le vendeur voit ce que ça lui coûtera.
function totalFrais(xml) {
  let t = 0, found = false; const re = /<Fee>[\s\S]*?<Fee currencyID="[^"]*">([\s\S]*?)<\/Fee>[\s\S]*?<\/Fee>/g; let m;
  // La structure est <Fees><Fee><Name>…</Name><Fee currencyID="EUR">0.0</Fee></Fee>…</Fees>.
  const bloc = (/<Fees>([\s\S]*?)<\/Fees>/.exec(xml || '') || [])[1] || '';
  const fre = /<Fee currencyID="[^"]*">([\s\S]*?)<\/Fee>/g;
  while ((m = fre.exec(bloc))) { const v = Number(m[1]); if (isFinite(v)) { t += v; found = true; } }
  return found ? Math.round(t * 100) / 100 : null;
}
// VÉRIFIER À BLANC : eBay valide EXACTEMENT ce qu'on publierait (attributs,
// photos, expédition) et renvoie les frais — SANS créer d'annonce. C'est le
// filet de sécurité pour la première publication : les erreurs (attribut
// manquant, photo refusée) remontent AVANT d'engager quoi que ce soit.
async function tradingVerifyAddFixedPriceItem(token, it) {
  const res = await tradingCall(token, 'VerifyAddFixedPriceItem', itemXml(it));
  return Object.assign(res, { fees: totalFrais(res.xml) });
}
// Le SKU d'une annonce publiée vient du NUMÉRO de la paire (`item.numero`),
// jamais d'un `item.sku` fourni par le navigateur : c'est une identité, pas un
// champ libre. Numéro absent ⇒ pas de SKU (l'annonce se reliera plus tard, d'un
// clic). Numéro présent mais illisible ⇒ on refuse : publier avec un faux lien
// ferait un jour retirer la mauvaise annonce.
function avecSku(it) {
  const brut = it && it.numero != null ? String(it.numero).trim() : '';
  if (!brut) return { item: { ...it, sku: '' } };
  const sku = skuDe(brut);
  if (!sku) return { err: 'Numéro de paire illisible : rien n\'a été envoyé à eBay.' };
  return { item: { ...it, sku } };
}
async function handlePublish(b) {
  const it0 = b.item || {};
  if (!it0.title || !it0.categoryId || it0.price == null || it0.price === '') return { status: 400, body: { ok: false, error: 'titre, catégorie et prix requis' } };
  const s = avecSku(it0);
  if (s.err) return { status: 400, body: { ok: false, reason: 'numero', error: s.err } };
  const it = s.item;
  const at = await accessToken();
  if (!at.ok) return { status: at.status || 502, body: { ok: false, reason: at.reason, error: at.error } };
  const r = await tradingAddFixedPriceItem(at.token, it);
  // ⚠️ L'API Trading renvoie HTTP 200 même sur un refus (l'erreur est dans le
  // corps, Ack=Failure). On répond donc un vrai code d'échec (422) dans ce cas.
  if (!r.ok || !r.itemId) return { status: r.status >= 400 ? r.status : 422, body: { ok: false, error: r.err || 'eBay a refusé la publication', ack: r.ack } };
  return { status: 200, body: { ok: true, itemId: r.itemId, url: `https://www.ebay.fr/itm/${r.itemId}`, sku: it.sku || null } };
}

// VÉRIFIER sans publier : mêmes champs requis que publish, mais RIEN n'est créé.
// L'appel eBay ayant réussi, on répond toujours 200 : `ok:true` = « prête »
// (avec les frais estimés), `ok:false` = « eBay refuserait : <raison> » — une
// information à corriger, pas une panne. Réseau/jeton KO → vrai code d'échec.
async function handleVerify(b) {
  const it0 = b.item || {};
  if (!it0.title || !it0.categoryId || it0.price == null || it0.price === '') return { status: 400, body: { ok: false, error: 'titre, catégorie et prix requis' } };
  // Le MÊME payload que la publication (§11) : SKU compris.
  const s = avecSku(it0);
  if (s.err) return { status: 400, body: { ok: false, reason: 'numero', error: s.err } };
  const it = s.item;
  const at = await accessToken();
  if (!at.ok) return { status: at.status || 502, body: { ok: false, reason: at.reason, error: at.error } };
  const r = await tradingVerifyAddFixedPriceItem(at.token, it);
  if (r.status === 0) return { status: 503, body: { ok: false, error: r.error || 'eBay injoignable' } };
  if (!r.ok) return { status: 200, body: { ok: false, error: r.err || 'eBay refuserait cette annonce', ack: r.ack } };
  return { status: 200, body: { ok: true, fees: r.fees } };
}

// ── RELIER UNE ANNONCE eBAY EXISTANTE À SA PAIRE (Trading ReviseFixedPriceItem) ─
// Pour les annonces publiées AVANT le SKU (ses 2 annonces actives, mesuré le
// 5 octobre). C'est SON clic qui choisit le numéro, jamais une suggestion
// appliquée toute seule (§5). Réversible : il peut la relier à un autre numéro.
async function handleSku(b) {
  const itemId = String(b.itemId || '').trim();
  if (!ID_EBAY.test(itemId)) return { status: 400, body: { ok: false, error: 'annonce eBay invalide' } };
  const sku = skuDe(b.numero);
  if (!sku) return { status: 400, body: { ok: false, reason: 'numero', error: 'Numéro de paire illisible (125, ou B125) : rien n\'a été envoyé à eBay.' } };
  const at = await accessToken();
  if (!at.ok) return { status: at.status || 502, body: { ok: false, reason: at.reason, error: at.error } };
  const r = await tradingCall(at.token, 'ReviseFixedPriceItem', `<Item><ItemID>${itemId}</ItemID><SKU>${esc(sku)}</SKU></Item>`);
  if (r.status === 0) return { status: 503, body: { ok: false, error: 'eBay injoignable — la référence n\'a pas été posée, réessaie.' } };
  if (!r.ok) return { status: r.status >= 400 ? r.status : 422, body: { ok: false, error: messageEbaySur(r.err) || 'eBay a refusé la référence.', ack: r.ack } };
  return { status: 200, body: { ok: true, sku } };
}

// ── OFFRE AUX OBSERVATEURS (Negotiation API) ────────────────────────────────
// L'équivalent eBay de la remise aux favoris de Vinted : c'est eBay qui choisit
// les destinataires (les personnes qui suivent l'annonce) et l'envoi part sur
// SON clic — VRM ne nomme personne et n'écrit à personne (§3 : la remise
// native touche tout le monde en un clic, pas un envoi en série). Droit
// `sell.inventory`, déjà accordé.
const NEGO = `${EBAY_API}/sell/negotiation/v1`;
const MARCHE_FR = { 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_FR' };
// Les annonces pour lesquelles eBay ACCEPTE une offre (au moins un observateur
// éligible). Trois états, jamais deux : `{ok:true, ids, complet}` lu ·
// `{ok:false}` pas su. ⚠️ eBay répond 204 (sans corps) quand AUCUNE annonce
// n'est éligible — c'est « lu, aucune », pas une panne.
async function eligiblesOffre(token) {
  const ids = []; let url = `${NEGO}/find_eligible_items?limit=200`;
  for (let p = 0; p < 5 && url; p++) {
    const r = await ebayJson(url, token, MARCHE_FR);
    if (r.status === 204) return { ok: true, ids, complet: true };
    if (r.status === 403) return { ok: false, status: 200, reason: 'scope', error: 'Reconnecte-toi à eBay pour envoyer des offres (l\'accès n\'a pas été autorisé).' };
    if (r.status === 0) return { ok: false, status: 503, error: 'eBay injoignable' };
    if (!r.ok || !r.data) return { ok: false, status: r.status >= 400 ? r.status : 502, error: messageEbaySur(r.data && r.data.errors && r.data.errors[0] && (r.data.errors[0].longMessage || r.data.errors[0].message)) || 'eBay n\'a pas dit quelles annonces ont des observateurs.' };
    for (const e of (r.data.eligibleItems || [])) if (e && e.listingId != null && ID_EBAY.test(String(e.listingId))) ids.push(String(e.listingId));
    // La page suivante : seulement chez eBay (on y envoie le jeton).
    url = (typeof r.data.next === 'string' && /^https:\/\/api\.ebay\.com\//.test(r.data.next)) ? r.data.next : '';
  }
  return { ok: true, ids, complet: !url };
}
async function handleOffreInfo() {
  const at = await accessToken();
  if (!at.ok) return { status: at.status || 502, body: { ok: false, reason: at.reason, error: at.error } };
  const e = await eligiblesOffre(at.token);
  if (!e.ok) return { status: e.status || 502, body: { ok: false, reason: e.reason, error: e.error } };
  return { status: 200, body: { ok: true, eligibles: e.ids, complet: e.complet } };
}
// Le message joint à l'offre : du texte, 2 000 caractères au plus (limite
// d'eBay). `null` = trop long (on refuse plutôt que de couper sa phrase).
function texteOffre(m) {
  const t = String(m == null ? '' : m).replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, ' ').trim();
  return t.length > 2000 ? null : t;
}
async function handleOffre(b) {
  // ⚠️ Une offre acceptée VEND la paire : sans confirmation explicite, rien ne
  //    part — pas même la vérification chez eBay.
  if (b.confirme !== true) return { status: 400, body: { ok: false, reason: 'confirmation', error: 'Confirme l\'envoi de l\'offre : rien n\'a été envoyé.' } };
  const listingId = String(b.listingId || '').trim();
  if (!ID_EBAY.test(listingId)) return { status: 400, body: { ok: false, error: 'annonce eBay invalide' } };
  const remise = Number(b.remise);
  if (!Number.isInteger(remise) || remise < 5 || remise > 50) return { status: 400, body: { ok: false, reason: 'remise', error: 'La remise doit être un nombre entier entre 5 et 50 %.' } };
  const message = texteOffre(b.message);
  if (message === null) return { status: 400, body: { ok: false, reason: 'message', error: 'Message trop long (2 000 caractères au plus).' } };
  const at = await accessToken();
  if (!at.ok) return { status: at.status || 502, body: { ok: false, reason: at.reason, error: at.error } };
  // On REVÉRIFIE chez eBay, au moment d'envoyer : l'écran a pu être ouvert il y
  // a une heure. « Pas su » ⇒ on n'envoie pas.
  const e = await eligiblesOffre(at.token);
  if (!e.ok) return { status: e.status || 502, body: { ok: false, reason: e.reason, error: 'Je n\'ai pas pu vérifier chez eBay que cette annonce a des observateurs — rien n\'a été envoyé.' } };
  if (!e.ids.includes(listingId)) return { status: 409, body: { ok: false, reason: 'non-eligible', error: 'eBay n\'a personne à qui envoyer une offre pour cette annonce en ce moment — rien n\'a été envoyé.' } };
  const corps = { allowCounterOffer: false, offerDuration: { unit: 'DAY', value: 2 }, offeredItems: [{ listingId, discountPercentage: String(remise), quantity: 1 }] };
  if (message) corps.message = message;
  let r;
  try {
    r = await fetch(`${NEGO}/send_offer_to_interested_buyers`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${at.token}`, Accept: 'application/json', 'Content-Type': 'application/json', 'Content-Language': 'fr-FR', ...MARCHE_FR },
      body: JSON.stringify(corps),
    });
  } catch (_) {
    // La requête a pu ARRIVER chez eBay avant la coupure : on ne dit ni
    // « envoyée » ni « pas envoyée ».
    return { status: 504, body: { ok: false, reason: 'incertain', error: 'eBay n\'a pas répondu — je ne sais pas si l\'offre est partie. Regarde sur eBay avant de la renvoyer.' } };
  }
  const txt = await r.text().catch(() => '');
  let j = null; try { j = JSON.parse(txt); } catch (_) {}
  if (!r.ok) {
    const e0 = j && Array.isArray(j.errors) && j.errors[0];
    return { status: r.status >= 400 ? r.status : 502, body: { ok: false, error: messageEbaySur(e0 && (e0.longMessage || e0.message)) || 'eBay a refusé l\'offre.' } };
  }
  const offres = (j && Array.isArray(j.offers)) ? j.offers : [];
  return { status: 200, body: { ok: true, remise, envoyees: offres.length } };
}

// ── RETIRER UNE ANNONCE eBAY (Trading EndFixedPriceItem) ────────────────────
// Pour la paire VENDUE AILLEURS (anti double vente). Sans retour côté eBay : il
// faudrait republier. D'où la confirmation exigée ICI, et pas seulement à
// l'écran.
async function handleRetirer(b) {
  if (b.confirme !== true) return { status: 400, body: { ok: false, reason: 'confirmation', error: 'Confirme le retrait : rien n\'a été envoyé à eBay.' } };
  const itemId = String(b.itemId || '').trim();
  if (!ID_EBAY.test(itemId)) return { status: 400, body: { ok: false, error: 'annonce eBay invalide' } };
  const at = await accessToken();
  if (!at.ok) return { status: at.status || 502, body: { ok: false, reason: at.reason, error: at.error } };
  const r = await tradingCall(at.token, 'EndFixedPriceItem', `<ItemID>${itemId}</ItemID><EndingReason>NotAvailable</EndingReason>`);
  if (r.status === 0) return { status: 504, body: { ok: false, reason: 'incertain', error: 'eBay n\'a pas répondu — je ne sais pas si l\'annonce a été retirée. Regarde sur eBay avant de recommencer.' } };
  if (!r.ok) return { status: r.status >= 400 ? r.status : 422, body: { ok: false, error: messageEbaySur(r.err) || 'eBay a refusé le retrait.', ack: r.ack } };
  return { status: 200, body: { ok: true, fin: (/<EndTime>([\s\S]*?)<\/EndTime>/.exec(r.xml || '') || [])[1] || null } };
}

// ── SOLDE eBay À VIRER (getSellerFundsSummary, lecture seule) ────────────────
// Les MÊMES mots que Vinted (§5.14) : « disponible » et « en attente/retenu »
// ne se confondent jamais. Chaque montant est celui qu'eBay renvoie
// (availableFunds / processingFunds / fundsOnHold), jamais un calcul de notre
// part. Absent ⇒ `null` (l'app écrit « — »), jamais 0. Nécessite le droit
// `sell.finances` : un jeton accordé avant que ce droit existe répond 403 →
// on dit « reconnecte-toi », on n'invente rien.
async function handleFinances() {
  const at = await accessToken();
  if (!at.ok) return { status: at.status || 502, body: { ok: false, reason: at.reason, error: at.error } };
  const r = await ebayJson(`${EBAY_API}/sell/finances/v1/seller_funds_summary`, at.token, { 'Accept-Language': 'fr-FR' });
  if (r.status === 403) return { status: 200, body: { ok: false, reason: 'scope', error: 'Reconnecte-toi à eBay pour voir ton solde à virer (l\'accès « paiements » n\'a pas encore été autorisé).' } };
  if (r.status === 0) return { status: 503, body: { ok: false, error: 'eBay injoignable' } };
  if (!r.ok || !r.data) return { status: r.status >= 400 ? r.status : 502, body: { ok: false, error: 'eBay n\'a pas renvoyé le solde.' } };
  const amt = (o) => (o && o.value != null && isFinite(Number(o.value))) ? Number(o.value) : null;
  const d = r.data;
  const out = { ok: true, dispo: amt(d.availableFunds), enAttente: amt(d.processingFunds), retenu: amt(d.fundsOnHold), total: amt(d.totalFunds), devise: (d.totalFunds && d.totalFunds.currency) || (d.availableFunds && d.availableFunds.currency) || 'EUR', capturedAt: Date.now() };
  await storeData('ebay_finances', out);
  return { status: 200, body: out };
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
  // Les ÉTATS qu'eBay autorise pour CETTE catégorie (Sell Metadata) — comme sur
  // son site. Échec/scope manquant ⇒ on n'en renvoie pas, l'app garde sa liste
  // standard (Occasion / Neuf…). Jamais bloquant.
  let conditions = [];
  if (categoryId) {
    const cp = await ebayJson(`${EBAY_API}/sell/metadata/v1/marketplace/${MKT}/get_item_condition_policies?filter=categoryIds:%7B${categoryId}%7D`, token, H);
    const p0 = cp.data && Array.isArray(cp.data.itemConditionPolicies) && cp.data.itemConditionPolicies[0];
    conditions = (p0 && Array.isArray(p0.itemConditions) ? p0.itemConditions : [])
      .map(c => ({ id: String(c.conditionId), label: c.conditionDescription || '' })).filter(c => c.id && c.label);
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
  // ── LA MÊME INTERFACE QU'eBAY : on retranscrit, pour chaque caractéristique,
  //    ce qu'eBay dit lui-même — est-elle obligatoire, est-ce une liste à choix
  //    (SELECTION_ONLY) ou du texte libre, et SES valeurs autorisées. C'est ce
  //    qui rend le formulaire eBay « intelligent » ; VRM le rend à l'identique.
  //    Rien n'est inventé : ce sont les listes d'eBay (§5). ──
  const attributs = asp.map(a => ({
    nom: a.localizedAspectName,
    requis: !!(a.aspectConstraint && a.aspectConstraint.aspectRequired),
    mode: (a.aspectConstraint && a.aspectConstraint.aspectMode) || 'FREE_TEXT',   // SELECTION_ONLY | FREE_TEXT
    valeurs: ((a.aspectValues) || []).map(v => v.localizedValue).filter(Boolean).slice(0, 80),
  }));
  // Les catégories qu'eBay PROPOSE pour ce titre (jusqu'à 5) — on laisse choisir
  // si la première n'est pas la bonne, comme sur eBay. Rien n'est deviné.
  const categories = ((sugg.data && sugg.data.categorySuggestions) || [])
    .map(s => s && s.category).filter(c => c && c.categoryId)
    .map(c => ({ categoryId: c.categoryId, categoryName: c.categoryName }))
    .slice(0, 5);
  return { status: 200, body: {
    ok: true,
    treeId,
    categorie: { suggeree: (sugg.data && sugg.data.categorySuggestions && sugg.data.categorySuggestions[0] && sugg.data.categorySuggestions[0].category) || null, status: sugg.status, categoryId },
    categories,
    conditions,
    attributs,
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
  // ⚠️⚠️ « RIEN LU » NE VAUT PAS « RIEN » (5 octobre). Chaque lecture ratée
  //    réécrivait sa ligne avec une liste VIDE : un hoquet d'eBay effaçait ses
  //    annonces de l'app (« Pas encore d'annonce eBay en ligne »), et l'anti
  //    double vente ne voyait plus qu'une paire vendue sur Vinted était encore
  //    en vente sur eBay. Une source qui n'a pas répondu garde sa dernière
  //    capture.
  const at2 = Date.now();
  if (listings.ok) await storeData('ebay_listings', { items: lst, ack: listings.ack, status: listings.status, capturedAt: at2 });
  if (orders.ok && orders.data) await storeData('ebay_orders', { orders: orders.data.orders || [], status: orders.status, capturedAt: at2 });
  if (inv.ok && inv.data) await storeData('ebay_inventory', { items: inv.data.inventoryItems || [], status: inv.status, capturedAt: at2 });
  // Résumé de MESURE : comptes + statuts + petits échantillons (pour voir la forme).
  return { status: 200, body: {
    ok: true,
    // Ce qui a VRAIMENT été lu (et donc rangé) — le reste garde sa dernière capture.
    lu: { annonces: !!listings.ok, commandes: !!(orders.ok && orders.data), stock: !!(inv.ok && inv.data) },
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
// ⚠️⚠️ QUI A DEMANDÉ CE CONSENTEMENT ? (sécurité, 5 octobre)
// Le retour d'eBay arrive SANS session (une navigation du navigateur), et il
// rangeait le jeton de n'importe quel code reçu. N'importe qui pouvait donc
// ouvrir lui-même la page de consentement d'eBay (l'adresse ne contient rien de
// secret), se connecter avec SON compte eBay, et remplacer la connexion eBay de
// Julien par la sienne : ses publications partaient alors sur le compte d'un
// inconnu, et ses acheteurs payaient l'inconnu.
// ⇒ `authurl` (réservé au propriétaire connecté) fabrique un `state` SIGNÉ par
// le serveur, daté ; eBay le renvoie tel quel au retour, qui le vérifie avant
// de ranger quoi que ce soit. La clé de signature est un secret serveur
// (EBAY_CERT_ID), jamais envoyé au navigateur.
const ETAT_VALIDITE_MS = 30 * 60 * 1000;
const macEtat = (owner, ts) => crypto.createHmac('sha256', 'vrm-ebay-consentement|' + (process.env.EBAY_CERT_ID || ''))
  .update(String(owner) + '|' + String(ts)).digest('hex').slice(0, 40);
function signerEtat(owner) { const ts = Date.now().toString(36); return ts + '.' + macEtat(owner, ts); }
function etatValide(state, owner) {
  const m = /^([0-9a-z]{6,12})\.([0-9a-f]{40})$/.exec(String(state || ''));
  if (!m || !process.env.EBAY_CERT_ID) return false;
  const age = Date.now() - parseInt(m[1], 36);
  if (!(age >= -60000 && age <= ETAT_VALIDITE_MS)) return false;
  const attendu = Buffer.from(macEtat(owner, m[1])), recu = Buffer.from(m[2]);
  return attendu.length === recu.length && crypto.timingSafeEqual(attendu, recu);
}
// Les jetons eBay sont ceux de l'INSTALLATION (une ligne `ebay_tokens`, rangée
// au nom de VRM_OWNER_UID) : seul ce vendeur-là pilote eBay.
const proprioEbay = () => process.env.VRM_OWNER_UID || '';

async function handleCallback(req, res) {
  const q = req.query || {};
  if (q.error) { retour(res, 'refus', String(q.error).slice(0, 60)); return; }
  const code = String(q.code || '').trim();
  if (!code) { retour(res, 'erreur', 'aucun code'); return; }
  if (!keysReady()) { retour(res, 'erreur', 'clés absentes'); return; }
  if (!etatValide(q.state, proprioEbay())) { retour(res, 'erreur', 'demande expirée ou inconnue — relance la connexion eBay depuis VRM'); return; }
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
  // ⚠️⚠️ SESSION OBLIGATOIRE (sécurité, 5 octobre). Cette route n'en exigeait
  // AUCUNE : n'importe qui sur Internet pouvait lister ses commandes eBay (avec
  // les acheteurs), lire ses finances, publier ou modifier une annonce sur SON
  // compte eBay. Et seul le propriétaire de l'installation (à qui appartiennent
  // les jetons) pilote eBay — un autre vendeur connecté n'y touche pas.
  const u = await vendeurExige(req, res);
  if (!u) return;
  if (proprioEbay() && u.id !== proprioEbay()) { res.status(403).json({ ok: false, reason: 'pas-proprietaire', error: "Ce compte eBay n'est pas relié à ton compte VRM." }); return; }
  const b = req.body || {};
  const action = String(b.action || '');
  if (!keysReady()) { res.status(503).json({ ok: false, reason: 'no-key', error: 'eBay indisponible : EBAY_APP_ID / EBAY_CERT_ID ne sont pas configurés sur Vercel.' }); return; }
  try {
    if (action === 'authurl') {
      if (!ruName()) { res.status(503).json({ ok: false, reason: 'no-runame', error: 'Le RuName (EBAY_RUNAME) n\'est pas configuré.' }); return; }
      res.status(200).json({ ok: true, url: authUrl(signerEtat(u.id)) });
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
    if (action === 'pubverify') {
      const r = await handleVerify(b);
      res.status(r.status).json(r.body);
      return;
    }
    if (action === 'finances') {
      const r = await handleFinances();
      res.status(r.status).json(r.body);
      return;
    }
    if (action === 'publish') {
      const r = await handlePublish(b);
      res.status(r.status).json(r.body);
      return;
    }
    // Relier une annonce à sa paire · l'offre aux observateurs · retirer une
    // annonce vendue ailleurs. Mêmes gardes que tout le reste (session du
    // propriétaire, plus haut) ; `offre` et `retirer` exigent en plus
    // `confirme:true` — vérifié AVANT tout appel à eBay.
    if (action === 'sku') { const r = await handleSku(b); res.status(r.status).json(r.body); return; }
    if (action === 'offreinfo') { const r = await handleOffreInfo(); res.status(r.status).json(r.body); return; }
    if (action === 'offre') { const r = await handleOffre(b); res.status(r.status).json(r.body); return; }
    if (action === 'retirer') { const r = await handleRetirer(b); res.status(r.status).json(r.body); return; }
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
