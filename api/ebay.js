// api/ebay.js — TOUTES les routes eBay en UNE seule fonction serverless.
//
// ⚠️ POURQUOI TOUT EN UN FICHIER : le plan Vercel Hobby limite à 12 fonctions
// serverless par déploiement. Le projet en a déjà 12 ; trois fichiers eBay
// séparés (auth + callback + deletion) faisaient passer à 15 → TOUT déploiement
// échouait (« exceeded_serverless_functions_per_deployment »), et la prod
// restait bloquée sur l'ancienne version. On route donc par `?mode=` :
//   • (défaut)        → pilotage par l'app : GET santé, POST authurl/apptoken/
//                       exchange/status/sync/finances/pubinfo/pubverify/publish/
//                       revise, et (5 octobre) sku · offreinfo · offre · retirer,
//                       puis programmer · programmees · deprogrammer ·
//                       reprogrammer · limites (le planificateur) ;
//   • ?mode=callback  → retour de consentement eBay (redirige vers l'app) ;
//   • ?mode=deletion  → conformité : notification de suppression de compte.
// `vercel.json` redirige /api/ebay-callback et /api/ebay-deletion vers ici, pour
// que les URLs publiques restent stables (eBay les appelle telles quelles).
//
// La logique OAuth vit dans api/_lib/ebay.js (§11, partagée). Sécurité : clés
// dans les variables Vercel, jamais dans le dépôt ; jetons jamais renvoyés au
// navigateur ; échecs honnêtes (503 sans clés, un refus eBay remonte).

import crypto from 'crypto';
import { vendeurExige, baseCloisonnee } from './_lib/session.js';
import { accesVendeur } from './_lib/abonnement.js';
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

// Une valeur XML lisible (eBay échappe les apostrophes, les guillemets…).
const dexml = (s) => String(s == null ? '' : s).replace(/<!\[CDATA\[|\]\]>/g, '')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#39;/g, "'").replace(/&amp;/g, '&');

// ── TOUTES LES ERREURS D'eBAY, PAS SEULEMENT LA PREMIÈRE (5 octobre) ─────────
// `tradingCall` ne gardait que le PREMIER <LongMessage> du XML : sur un Ack
// « Warning », ou avec plusieurs <Errors>, il montrait le mauvais message (un
// simple avertissement à la place du vrai refus) et perdait l'ErrorCode — or le
// 488 (« UUID déjà utilisé ») est précisément ce qui dit qu'une annonce
// programmée l'a DÉJÀ été. Chaque <Errors> est lu : son code, sa sévérité
// (Error ou Warning), son message (nettoyé de tout ce qui ressemble à un
// jeton) et les valeurs de ses <ErrorParameters>.
function erreursTrading(xml) {
  const out = []; const re = /<Errors>([\s\S]*?)<\/Errors>/g; let m;
  while ((m = re.exec(String(xml || ''))) && out.length < 20) {
    const b = m[1];
    const g = (t) => ((new RegExp('<' + t + '>([\\s\\S]*?)</' + t + '>').exec(b)) || [])[1] || '';
    const params = []; const pr = /<ErrorParameters\b[^>]*>([\s\S]*?)<\/ErrorParameters>/g; let p;
    while ((p = pr.exec(b)) && params.length < 6) { const v = (/<Value>([\s\S]*?)<\/Value>/.exec(p[1]) || [])[1]; if (v != null) params.push(messageEbaySur(dexml(v)).slice(0, 200)); }
    out.push({
      code: String(g('ErrorCode')).trim(),
      severite: /warning/i.test(g('SeverityCode')) ? 'Warning' : 'Error',
      message: messageEbaySur(dexml(g('LongMessage') || g('ShortMessage'))),
      params,
    });
  }
  return out;
}

// Appel Trading générique (XML) : le XML brut + l'Ack + TOUTES les erreurs.
//   `err`            : le premier message de sévérité ERROR (sinon, sur un
//                      échec, le premier message tout court) — c'est lui qu'on
//                      montre quand eBay refuse ;
//   `avertissements` : les messages de sévérité Warning (eBay a accepté, mais
//                      il a quelque chose à dire) ;
//   `erreurs`        : la liste complète `{code, severite, message, params}`.
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
    const ok = r.ok && /Success|Warning/i.test(ack);
    const erreurs = erreursTrading(xml);
    const premiereErreur = erreurs.find((e) => e.severite === 'Error' && e.message);
    const err = premiereErreur ? premiereErreur.message : (!ok && erreurs[0] ? erreurs[0].message : '');
    const avertissements = erreurs.filter((e) => e.severite === 'Warning' && e.message).map((e) => e.message);
    return { status: r.status, ok, ack, err, erreurs, avertissements, xml };
  } catch (e) { return { status: 0, ok: false, erreurs: [], avertissements: [], error: String((e && e.message) || '').slice(0, 140) }; }
}

// ── UNE ANNONCE LUE DANS GetMyeBaySelling ─────────────────────────────────────
function extraireItem(blk) {
  const g = (t, src) => { const x = new RegExp('<' + t + '[^>]*>([\\s\\S]*?)</' + t + '>').exec(src || blk); return x ? dexml(x[1].trim()) : ''; };
  // ⚠️ Le SKU de l'ANNONCE, pas celui d'une de ses variantes : une annonce à
  //    variantes porte un <SKU> par variante dans <Variations>, et le premier
  //    venu relierait l'annonce entière à une seule paire.
  const sansVariantes = blk.replace(/<Variations>[\s\S]*?<\/Variations>/g, '');
  // WatchCount = le nombre de personnes qui SUIVENT l'annonce (les
  // « observateurs » d'eBay). Ce n'était pas des « vues » : `vues` est gardé
  // pour les lecteurs d'avant, `observateurs` dit la chose par son nom.
  // Absent ⇒ null (« pas su »), jamais 0.
  const wc = g('WatchCount');
  return {
    itemId: g('ItemID'),
    title: g('Title'),
    price: g('CurrentPrice') || g('BuyItNowPrice') || g('StartPrice'),
    qty: g('QuantityAvailable') || g('Quantity'),
    vendus: g('QuantitySold'),
    vues: wc,
    observateurs: /^\d+$/.test(wc) ? Number(wc) : null,
    sku: g('SKU', sansVariantes),
    photo: g('GalleryURL') || g('PictureURL'),
    // Pour une annonce PROGRAMMÉE, StartTime est l'heure de mise en ligne
    // retenue par eBay (KB 1473) — la vérité, pas l'heure qu'on a demandée.
    depuis: g('StartTime'),
    fin: g('EndTime'),
    url: g('ViewItemURL'),
  };
}
// Le contenu d'un conteneur (<ActiveList>…</ActiveList>), ou null s'il est absent.
const conteneur = (xml, nom) => { const m = new RegExp('<' + nom + '>([\\s\\S]*?)</' + nom + '>').exec(String(xml || '')); return m ? m[1] : null; };
const itemsDe = (bloc) => { const out = []; const re = /<Item>([\s\S]*?)<\/Item>/g; let m; while ((m = re.exec(bloc || '')) && out.length < 400) out.push(extraireItem(m[1])); return out; };
const pagesDe = (bloc) => { const n = Number((/<TotalNumberOfPages>(\d+)<\/TotalNumberOfPages>/.exec(bloc || '') || [])[1]); return Number.isFinite(n) && n > 0 ? n : 1; };

// ── SES ANNONCES EN LIGNE ET PROGRAMMÉES, EN UN APPEL (5 octobre) ────────────
// Trading `GetMyeBaySelling` : le seul moyen fiable de récupérer les annonces
// créées sur le SITE eBay (l'Inventory API ne voit que celles créées par API).
// ⚠️ Sans `<ScheduledList>`, une annonce PROGRAMMÉE est invisible : « pas vu »
//    n'est pas « aucune ». Et le XML est DÉCOUPÉ par conteneur avant d'en
//    extraire les <Item> : lire tout le document comptait une programmée comme
//    « en ligne ».
// Trois états : `{ok:true, actives, programmees, complet}` lu · `{ok:false}`
// pas su (réseau, Ack Failure). Un conteneur ABSENT d'une réponse « Success »
// est lu VIDE (eBay n'émet pas une liste qui n'a rien — non mesuré sur son
// compte : c'est la réponse d'eBay qui fait foi, pas notre supposition).
// Pagination : 200 par page, 5 pages au plus par liste ; au-delà
// `complet:false` (une identité absente d'une liste incomplète n'est PAS
// prouvée absente).
async function listeVendeur(token) {
  const actives = [], programmees = [];
  let pagesA = 1, pagesS = 1, ack = '', status = 0;
  for (let p = 1; p <= 5; p++) {
    const vouluA = p <= pagesA, vouluS = p <= pagesS;
    if (!vouluA && !vouluS) break;
    const pagination = `<Pagination><EntriesPerPage>200</EntriesPerPage><PageNumber>${p}</PageNumber></Pagination>`;
    const inner = (vouluA ? `<ActiveList><Include>true</Include>${pagination}</ActiveList>` : '')
      + (vouluS ? `<ScheduledList><Include>true</Include>${pagination}</ScheduledList>` : '');
    const r = await tradingCall(token, 'GetMyeBaySelling', inner);
    status = r.status; ack = r.ack || ack;
    if (r.status === 0) return { ok: false, status: 503, error: 'eBay injoignable' };
    if (!r.ok) return { ok: false, status: r.status >= 400 ? r.status : 502, error: r.err || 'eBay n\'a pas rendu tes annonces.' };
    if (vouluA) { const c = conteneur(r.xml, 'ActiveList'); if (c == null) pagesA = 0; else { actives.push(...itemsDe(c)); pagesA = pagesDe(c); } }
    if (vouluS) { const c = conteneur(r.xml, 'ScheduledList'); if (c == null) pagesS = 0; else { programmees.push(...itemsDe(c)); pagesS = pagesDe(c); } }
  }
  return { ok: true, status, ack, actives, programmees, complet: pagesA <= 5 && pagesS <= 5 };
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

async function handleRevise(b, owner) {
  const itemId = String(b.itemId || '').trim();
  if (!/^\d+$/.test(itemId)) return { status: 400, body: { ok: false, error: 'itemId invalide' } };
  if ((b.price == null || b.price === '') && (b.quantity == null || b.quantity === '')) return { status: 400, body: { ok: false, error: 'rien à modifier' } };
  const at = await accessToken(owner);
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
// Deux champs de la PROGRAMMATION, émis seulement quand la route les a validés
// (jamais recopiés du navigateur, voir `avecSku`) :
//   · `scheduleTime` → <ScheduleTime> (UTC ISO) : eBay met l'annonce en ligne
//     lui-même à cette heure ;
//   · `uuid` → <UUID> (32 hex) : à l'AJOUT SEULEMENT. Un second envoi après une
//     coupure réseau ne crée pas une seconde annonce (eBay répond 488). Jamais
//     à la vérification : on ne sait pas si une vérification « consomme »
//     l'UUID, et l'ajout qui suit sortirait alors en 488 à tort.
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
    (it.scheduleTime ? `<ScheduleTime>${esc(it.scheduleTime)}</ScheduleTime>` : '') +
    '<Currency>EUR</Currency><Country>FR</Country>' +
    `<Location>${esc(it.location || 'France')}</Location>` +
    `<ConditionID>${esc(it.conditionId || '3000')}</ConditionID>` +
    (pics ? `<PictureDetails>${pics}</PictureDetails>` : '') +
    (specs ? `<ItemSpecifics>${specs}</ItemSpecifics>` : '') +
    `<DispatchTimeMax>${parseInt(it.dispatchDays || 3, 10)}</DispatchTimeMax>` +
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
    (it.uuid ? `<UUID>${esc(it.uuid)}</UUID>` : '') +
    '</Item>';
}
const lireBalise = (xml, t) => dexml((new RegExp('<' + t + '[^>]*>([\\s\\S]*?)</' + t + '>').exec(String(xml || '')) || [])[1] || '').trim();
async function tradingAddFixedPriceItem(token, it) {
  const res = await tradingCall(token, 'AddFixedPriceItem', itemXml(it));
  return Object.assign(res, { itemId: lireBalise(res.xml, 'ItemID'), debut: lireBalise(res.xml, 'StartTime'), fin: lireBalise(res.xml, 'EndTime') });
}

// ── LES FRAIS, LUS PAR NOM — JAMAIS ADDITIONNÉS (5 octobre) ──────────────────
// `totalFrais` ADDITIONNAIT tous les <Fee> de la réponse. Or le guide Trading
// « Fees » le dit : `ListingFee` EST le total des options. Additionner
// `ListingFee` ET ses composantes doublait le montant de « Vérifier sans
// publier » dès qu'un frais n'était pas nul (0,35 € annoncés 0,70 €). Le banc
// `ebay-write.cjs` était vert dessus : sa fixture servait une forme irréaliste
// (ListingFee 0,35 + InsertionFee 0,00 — §6.3).
// ⇒ Chaque frais est rangé SOUS SON NOM. `total` = `ListingFee`, rien
//   d'autre ; ABSENT ⇒ `null` (« pas su »), jamais 0 — la doc dit que tous
//   les types sont renvoyés, même à 0.0. `programmation` = le frais d'option
//   de programmation (`SchedulingFee`, nom non mesuré sur eBay.fr : absent ⇒
//   null). Une remise éventuelle (`PromotionalDiscount`) est rendue À CÔTÉ,
//   jamais soustraite : rien ne prouve que le montant n'est pas déjà net.
const deux = (n) => Math.round(n * 100) / 100;
function fraisParNom(xml) {
  const bloc = (/<Fees>([\s\S]*?)<\/Fees>/.exec(String(xml || '')) || [])[1];
  const parNom = [];
  if (bloc != null) {
    const re = /<Name>([\s\S]*?)<\/Name>([\s\S]*?)(?=<Name>|$)/g; let m;
    while ((m = re.exec(bloc)) && parNom.length < 60) {
      const f = /<Fee\b[^>]*currencyID="([^"]*)"[^>]*>([\s\S]*?)<\/Fee>/.exec(m[2]);
      const d = /<PromotionalDiscount\b[^>]*>([\s\S]*?)<\/PromotionalDiscount>/.exec(m[2]);
      const v = f ? Number(f[2]) : NaN; const dv = d ? Number(d[1]) : NaN;
      parNom.push({ nom: dexml(m[1]).trim(), montant: Number.isFinite(v) ? deux(v) : null, devise: f ? f[1] : '', remise: Number.isFinite(dv) ? deux(dv) : null });
    }
  }
  const un = (re) => { const x = parNom.find((p) => re.test(p.nom)); return x ? x.montant : null; };
  const remises = parNom.filter((p) => p.remise != null);
  return {
    total: un(/^ListingFee$/i),
    insertion: un(/^InsertionFee$/i),
    programmation: un(/^Schedul/i),
    remises: remises.length ? deux(remises.reduce((s, p) => s + p.remise, 0)) : null,
    devise: (parNom.find((p) => /^ListingFee$/i.test(p.nom)) || parNom[0] || {}).devise || 'EUR',
    // Tous les frais NON NULS, par nom — ce que l'écran détaille. (Le total
    // `ListingFee` n'y est pas : c'est la somme de ces lignes, pas une de plus.)
    lignes: parNom.filter((p) => !/^ListingFee$/i.test(p.nom) && p.montant != null && p.montant !== 0),
  };
}
// VÉRIFIER À BLANC : eBay valide EXACTEMENT ce qu'on publierait (attributs,
// photos, expédition, heure de programmation) et renvoie les frais — SANS
// créer d'annonce. C'est le filet : les refus remontent AVANT d'engager.
// ⚠️ Jamais d'UUID ici (voir `itemXml`).
async function tradingVerifyAddFixedPriceItem(token, it) {
  const res = await tradingCall(token, 'VerifyAddFixedPriceItem', itemXml({ ...it, uuid: '' }));
  const frais = fraisParNom(res.xml);
  return Object.assign(res, { frais, fees: frais.total });
}
// Le SKU d'une annonce publiée vient du NUMÉRO de la paire (`item.numero`),
// jamais d'un `item.sku` fourni par le navigateur : c'est une identité, pas un
// champ libre. Numéro absent ⇒ pas de SKU (l'annonce se reliera plus tard, d'un
// clic). Numéro présent mais illisible ⇒ on refuse : publier avec un faux lien
// ferait un jour retirer la mauvaise annonce.
// ⚠️ Et une heure de programmation ou un UUID envoyés DANS `item` sont jetés :
// seule la route les pose, après les avoir validés.
function avecSku(it) {
  const brut = it && it.numero != null ? String(it.numero).trim() : '';
  const propre = { ...it, scheduleTime: '', uuid: '' };
  if (!brut) return { item: { ...propre, sku: '' } };
  const sku = skuDe(brut);
  if (!sku) return { err: 'Numéro de paire illisible : rien n\'a été envoyé à eBay.' };
  return { item: { ...propre, sku } };
}
async function handlePublish(b, owner) {
  const it0 = b.item || {};
  if (!it0.title || !it0.categoryId || it0.price == null || it0.price === '') return { status: 400, body: { ok: false, error: 'titre, catégorie et prix requis' } };
  const s = avecSku(it0);
  if (s.err) return { status: 400, body: { ok: false, reason: 'numero', error: s.err } };
  const it = s.item;
  const at = await accessToken(owner);
  if (!at.ok) return { status: at.status || 502, body: { ok: false, reason: at.reason, error: at.error } };
  const r = await tradingAddFixedPriceItem(at.token, it);
  // ⚠️ L'API Trading renvoie HTTP 200 même sur un refus (l'erreur est dans le
  // corps, Ack=Failure). On répond donc un vrai code d'échec (422) dans ce cas.
  if (!r.ok || !r.itemId) return { status: r.status >= 400 ? r.status : 422, body: { ok: false, error: r.err || 'eBay a refusé la publication', ack: r.ack } };
  return { status: 200, body: { ok: true, itemId: r.itemId, url: `https://www.ebay.fr/itm/${r.itemId}`, sku: it.sku || null, avertissements: r.avertissements } };
}

// ── L'HEURE DE PROGRAMMATION, VALIDÉE PAR LE SERVEUR ─────────────────────────
// L'app convertit l'heure de PARIS en UTC (elle seule connaît le fuseau qu'il a
// choisi) ; le serveur ne convertit RIEN, il vérifie : ISO UTC strict, une date
// valide, au moins 15 min dans le futur (eBay arrondit au quart d'heure) et au
// plus 3 semaines (la limite d'eBay), moins une marge de 10 min. C'est une
// garde VRM : eBay reste juge.
const HEURE_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
const PROG_MIN_MS = 15 * 60 * 1000;
const PROG_MAX_MS = 21 * 86400 * 1000 - 10 * 60 * 1000;
function heureProgrammation(s) {
  const v = String(s == null ? '' : s).trim();
  if (!HEURE_ISO.test(v)) return '';
  const t = Date.parse(v);
  if (!Number.isFinite(t)) return '';
  const now = Date.now();
  if (t < now + PROG_MIN_MS || t > now + PROG_MAX_MS) return '';
  return new Date(t).toISOString();
}
// L'état de l'objet est EXIGÉ pour programmer : `itemXml` mettait « Occasion »
// (3000) en silence quand il manquait — une paire neuve serait partie
// « Occasion », à une heure où il ne regarde pas.
const ETAT_OK = /^\d{3,5}$/;

// VÉRIFIER sans publier : mêmes champs requis que publish, mais RIEN n'est créé.
// L'appel eBay ayant réussi, on répond toujours 200 : `ok:true` = « prête »
// (avec les frais LUS PAR NOM), `ok:false` = « eBay refuserait : <raison> » —
// une information à corriger, pas une panne. Réseau/jeton KO → vrai code
// d'échec. Avec `scheduleTime` : la même validation que `programmer`, et eBay
// annonce alors le frais de programmation.
async function handleVerify(b, owner) {
  const it0 = b.item || {};
  if (!it0.title || !it0.categoryId || it0.price == null || it0.price === '') return { status: 400, body: { ok: false, error: 'titre, catégorie et prix requis' } };
  // Le MÊME payload que la publication (§11) : SKU compris.
  const s = avecSku(it0);
  if (s.err) return { status: 400, body: { ok: false, reason: 'numero', error: s.err } };
  let quand = '';
  if (b.scheduleTime != null && b.scheduleTime !== '') {
    quand = heureProgrammation(b.scheduleTime);
    if (!quand) return { status: 400, body: { ok: false, reason: 'heure', error: 'Heure de mise en ligne refusée : entre 15 minutes et 3 semaines à l\'avance.' } };
  }
  const it = { ...s.item, scheduleTime: quand };
  const at = await accessToken(owner);
  if (!at.ok) return { status: at.status || 502, body: { ok: false, reason: at.reason, error: at.error } };
  const r = await tradingVerifyAddFixedPriceItem(at.token, it);
  if (r.status === 0) return { status: 503, body: { ok: false, error: r.error || 'eBay injoignable' } };
  if (!r.ok) return { status: 200, body: { ok: false, error: r.err || 'eBay refuserait cette annonce', ack: r.ack, erreurs: r.erreurs } };
  return { status: 200, body: { ok: true, fees: r.frais.total, frais: r.frais, programme: quand || null, avertissements: r.avertissements } };
}

// ── PROGRAMMER UNE ANNONCE (Trading AddFixedPriceItem + ScheduleTime) ────────
// Julien (5 octobre) : « tout doit être personnalisable […] ce qu'il veut
// mettre en ligne ». eBay met l'annonce en ligne LUI-MÊME à l'heure dite : ni
// file ni cron chez VRM (une publication VRM en son absence ressemblerait au
// motif refusé au §3). ⚠️ C'EST UNE ÉCRITURE QUI ENGAGE DE L'ARGENT (l'option
// de programmation est payante sur eBay.fr selon son aide, et non remboursée) :
// toutes les gardes passent AVANT le moindre appel à eBay.
// Requête : `{action:'programmer', confirme:true, uuid:'<32 HEX>',
//   fraisVus:<le total vu à la vérification>, scheduleTime:'…Z' | '' (tout de
//   suite), item:{title, categoryId, price, quantity, conditionId, description,
//   photos, aspects, ebayGere, numero}}`.
// Dans l'ordre : identité (une paire déjà en ligne ou déjà programmée sur eBay
// est REFUSÉE — eBay, lui, ne l'empêche pas) · vérification à blanc SANS UUID
// (frais par nom ; frais inconnus ⇒ refus ; plus chers que ce qu'il a vu ⇒
// refus) · ajout AVEC l'UUID. La réponse d'eBay (ItemID, StartTime, EndTime)
// est LA vérité qu'on rend — jamais l'heure qu'on a demandée.
const UUID_EBAY = /^[0-9A-F]{32}$/;
const PAS_SU_LISTE = 'Je n\'ai pas pu relire tes annonces eBay pour vérifier que cette paire n\'y est pas déjà — rien n\'a été envoyé.';
async function handleProgrammer(b, owner) {
  if (b.confirme !== true) return { status: 400, body: { ok: false, reason: 'confirmation', error: 'Confirme la programmation : rien n\'a été envoyé à eBay.' } };
  const it0 = b.item || {};
  if (!it0.title || !it0.categoryId || it0.price == null || it0.price === '' || !ETAT_OK.test(String(it0.conditionId || ''))) {
    return { status: 400, body: { ok: false, reason: 'champs', error: 'Titre, catégorie, prix et état sont nécessaires : rien n\'a été envoyé.' } };
  }
  const s = avecSku(it0);
  if (s.err || !s.item.sku) return { status: 400, body: { ok: false, reason: 'numero', error: 'Pour programmer, la paire doit avoir son N° : sans lui, VRM ne saurait pas la retrouver si elle se vend ailleurs avant l\'heure.' } };
  let quand = '';
  if (b.scheduleTime != null && b.scheduleTime !== '') {
    quand = heureProgrammation(b.scheduleTime);
    if (!quand) return { status: 400, body: { ok: false, reason: 'heure', error: 'Heure de mise en ligne refusée : entre 15 minutes et 3 semaines à l\'avance. Replanifie-la.' } };
  }
  const uuid = String(b.uuid || '');
  if (!UUID_EBAY.test(uuid)) return { status: 400, body: { ok: false, reason: 'uuid', error: 'Envoi mal formé (identifiant d\'envoi) : rien n\'a été envoyé.' } };
  const fraisVus = typeof b.fraisVus === 'number' ? b.fraisVus : NaN;
  if (!(Number.isFinite(fraisVus) && fraisVus >= 0)) return { status: 400, body: { ok: false, reason: 'frais-vus', error: 'Vérifie d\'abord les frais : rien n\'a été envoyé.' } };
  const it = { ...s.item, scheduleTime: quand };
  const at = await accessToken(owner);
  if (!at.ok) return { status: at.status || 502, body: { ok: false, reason: at.reason, error: at.error } };
  // ── UNE PAIRE, UNE ANNONCE : relue chez eBay, maintenant. ──
  const L = await listeVendeur(at.token);
  if (!L.ok) return { status: 503, body: { ok: false, reason: 'pas-su', error: PAS_SU_LISTE } };
  // Une liste INCOMPLÈTE ne prouve pas l'absence d'une paire : on ne programme pas.
  if (!L.complet) return { status: 503, body: { ok: false, reason: 'pas-su', error: 'Tu as plus de 1 000 annonces sur eBay : je n\'ai pas pu toutes les relire pour vérifier que cette paire n\'y est pas déjà — rien n\'a été envoyé.' } };
  const prog = L.programmees.find((x) => x.sku === it.sku);
  if (prog) return { status: 409, body: { ok: false, reason: 'deja-programmee', itemId: prog.itemId, debut: prog.depuis || null, error: `La paire ${it.sku} est déjà programmée sur eBay${prog.depuis ? ' (' + prog.depuis + ')' : ''} — rien n'a été envoyé.` } };
  const act = L.actives.find((x) => x.sku === it.sku);
  if (act) return { status: 409, body: { ok: false, reason: 'deja-en-ligne', itemId: act.itemId, error: `La paire ${it.sku} est déjà en vente sur eBay — rien n'a été envoyé.` } };
  // ── LES FRAIS, revérifiés juste avant (sans UUID). ──
  const v = await tradingVerifyAddFixedPriceItem(at.token, it);
  if (v.status === 0) return { status: 503, body: { ok: false, error: 'eBay injoignable — rien n\'a été envoyé.' } };
  if (!v.ok) return { status: 200, body: { ok: false, etape: 'verif', error: v.err || 'eBay refuserait cette annonce.', erreurs: v.erreurs } };
  if (v.frais.total == null) return { status: 502, body: { ok: false, reason: 'frais-pas-su', error: 'eBay n\'a pas annoncé ses frais — je ne programme rien sans les connaître. Revérifie.' } };
  if (v.frais.total > fraisVus + 0.005) return { status: 409, body: { ok: false, reason: 'frais', frais: v.frais, fraisVus, error: `Les frais ont changé depuis ta vérification (${v.frais.total.toFixed(2)} € au lieu de ${fraisVus.toFixed(2)} €) — rien n'a été envoyé.` } };
  // ── L'AJOUT, avec l'UUID (un second envoi ne crée pas une seconde annonce). ──
  const a = await tradingAddFixedPriceItem(at.token, { ...it, uuid });
  if (a.status === 0) return { status: 504, body: { ok: false, reason: 'incertain', uuid, error: 'eBay n\'a pas répondu à temps — je ne sais pas si elle est programmée. VRM relit tes annonces eBay avant de redemander quoi que ce soit.' } };
  if (!a.ok) {
    if ((a.erreurs || []).some((e) => e.code === '488')) return confirmerDoublon(at.token, a, it, quand);
    return { status: 422, body: { ok: false, error: a.err || 'eBay a refusé l\'annonce.', erreurs: a.erreurs } };
  }
  if (!ID_EBAY.test(a.itemId)) return { status: 502, body: { ok: false, reason: 'incertain', uuid, error: 'eBay a répondu sans numéro d\'annonce — je ne sais pas si elle est programmée. Rafraîchis depuis eBay avant de recommencer.' } };
  return { status: 200, body: resultatProgramme(a.itemId, it, quand, a.debut, a.fin, { frais: v.frais, avertissements: a.avertissements }) };
}
// La réponse commune d'une annonce programmée (ou mise en ligne).
// ⚠️ eBay PEUT ignorer l'heure : si le StartTime qu'il rend est antérieur de
// plus de 5 min à l'heure demandée, l'annonce est EN VENTE maintenant — l'écran
// doit le dire, jamais « programmée ».
function resultatProgramme(itemId, it, quand, debut, fin, plus) {
  const td = Date.parse(debut || ''), tq = Date.parse(quand || '');
  const enLigneMaintenant = !!quand && Number.isFinite(td) && Number.isFinite(tq) && td < tq - 5 * 60 * 1000;
  return { ok: true, itemId, sku: it.sku, demande: quand || null, debut: debut || null, fin: fin || null, enLigneMaintenant, url: `https://www.ebay.fr/itm/${itemId}`, ...plus };
}
// ── « UUID DÉJÀ UTILISÉ » (488) : eBay dit que cet envoi a DÉJÀ créé une
// annonce. On ne le croit pas sur parole : l'ItemID d'origine est lu (dans les
// paramètres d'erreur, sinon dans le message), puis l'annonce est relue
// (GetItem) et on EXIGE le même SKU. Pas de concordance ⇒ « incertain »,
// jamais « déjà programmée ».
async function confirmerDoublon(token, a, it, quand) {
  const e = (a.erreurs || []).find((x) => x.code === '488') || {};
  // Un paramètre qui n'est QUE des chiffres, sinon « item ID=… » du message.
  const id = (e.params || []).map((x) => String(x).trim()).find((x) => /^\d{6,19}$/.test(x))
    || (/item\s*ID\s*=\s*(\d{6,19})/i.exec(e.message || '') || [])[1] || '';
  const incertain = { status: 504, body: { ok: false, reason: 'incertain', error: 'eBay dit que cet envoi a déjà été fait, mais je n\'ai pas pu retrouver l\'annonce — rafraîchis depuis eBay avant de recommencer.' } };
  if (!ID_EBAY.test(id)) return incertain;
  const g = await tradingCall(token, 'GetItem', `<ItemID>${id}</ItemID><DetailLevel>ReturnAll</DetailLevel>`);
  if (!g.ok) return incertain;
  const blk = (/<Item>([\s\S]*)<\/Item>/.exec(g.xml || '') || [])[1] || '';
  const sku = lireBalise(blk.replace(/<Variations>[\s\S]*?<\/Variations>/g, ''), 'SKU');
  if (sku !== it.sku) return incertain;
  return { status: 200, body: resultatProgramme(id, it, quand, lireBalise(blk, 'StartTime'), lireBalise(blk, 'EndTime'), { deja: true }) };
}

// ── SES ANNONCES PROGRAMMÉES, relues chez eBay (lecture) ────────────────────
// Rangées dans `ebay_programmees` SEULEMENT si eBay a répondu : une lecture
// ratée garde la dernière capture (« rien lu » ne vaut pas « rien »). La
// réponse rend aussi les identités EN LIGNE (ItemID + SKU) : c'est ce qui dit
// qu'une programmée est bien partie à l'heure.
const resumeProgrammee = (x) => ({ itemId: x.itemId, sku: x.sku, title: x.title, price: x.price, debut: x.depuis || null, fin: x.fin || null, photo: x.photo, url: x.url || (x.itemId ? `https://www.ebay.fr/itm/${x.itemId}` : '') });
async function handleProgrammees(owner) {
  const at = await accessToken(owner);
  if (!at.ok) return { status: at.status || 502, body: { ok: false, reason: at.reason, error: at.error } };
  const L = await listeVendeur(at.token);
  if (!L.ok) return { status: L.status || 502, body: { ok: false, error: L.error || 'eBay n\'a pas rendu tes annonces programmées.' } };
  const items = L.programmees.map(resumeProgrammee);
  const enLigne = L.actives.map((x) => ({ itemId: x.itemId, sku: x.sku }));
  const range = await storeData('ebay_programmees', { items, enLigne, complet: L.complet, capturedAt: Date.now() }, owner);
  return { status: 200, body: { ok: true, items, enLigne, complet: L.complet, range } };
}

// ── ANNULER UNE PROGRAMMATION (Trading EndFixedPriceItem) ────────────────────
// ⚠️⚠️ NON PROUVÉ : rien dans la doc d'eBay ne dit qu'EndFixedPriceItem accepte
// une annonce pas encore commencée. On ESSAIE, et on rend la réponse d'eBay
// TELLE QUELLE — sur un refus, l'écran envoie l'annuler dans le Seller Hub.
// Elle n'agit QUE sur une annonce présente dans la liste des programmées
// relue à l'instant : une annonce déjà en ligne va à « Retirer d'eBay ».
async function handleDeprogrammer(b, owner) {
  if (b.confirme !== true) return { status: 400, body: { ok: false, reason: 'confirmation', error: 'Confirme l\'annulation : rien n\'a été envoyé à eBay.' } };
  const itemId = String(b.itemId || '').trim();
  if (!ID_EBAY.test(itemId)) return { status: 400, body: { ok: false, error: 'annonce eBay invalide' } };
  const at = await accessToken(owner);
  if (!at.ok) return { status: at.status || 502, body: { ok: false, reason: at.reason, error: at.error } };
  const L = await listeVendeur(at.token);
  if (!L.ok) return { status: 503, body: { ok: false, reason: 'pas-su', error: 'Je n\'ai pas pu relire tes annonces programmées — rien n\'a été envoyé.' } };
  if (!L.programmees.some((x) => x.itemId === itemId)) {
    const enLigne = L.actives.some((x) => x.itemId === itemId);
    return { status: 409, body: { ok: false, reason: 'pas-programmee', enLigne, error: enLigne ? 'Elle n\'est plus programmée : elle est déjà en ligne — utilise « Retirer d\'eBay ».' : 'eBay ne la compte plus parmi tes annonces programmées.' } };
  }
  const r = await tradingCall(at.token, 'EndFixedPriceItem', `<ItemID>${itemId}</ItemID><EndingReason>NotAvailable</EndingReason>`);
  if (r.status === 0) return { status: 504, body: { ok: false, reason: 'incertain', error: 'eBay n\'a pas répondu — je ne sais pas si la programmation est annulée. Regarde sur eBay avant de recommencer.' } };
  if (!r.ok) return { status: 422, body: { ok: false, reason: 'refus', error: r.err || 'eBay a refusé l\'annulation.', erreurs: r.erreurs } };
  const L2 = await listeVendeur(at.token);
  if (!L2.ok) return { status: 200, body: { ok: true, verifie: null } };
  if (L2.programmees.some((x) => x.itemId === itemId)) return { status: 409, body: { ok: false, reason: 'toujours-programmee', error: 'eBay a répondu « fait », mais elle est toujours programmée chez lui. Annule-la dans le Seller Hub.' } };
  if (L2.actives.some((x) => x.itemId === itemId)) return { status: 409, body: { ok: false, reason: 'en-ligne', error: 'Elle est maintenant EN LIGNE sur eBay — retire-la avec « Retirer d\'eBay ».' } };
  return { status: 200, body: { ok: true, verifie: true } };
}

// ── DÉPLACER UNE PROGRAMMATION (Trading ReviseFixedPriceItem + ScheduleTime) ─
// Documenté pour ReviseItem « tant que l'heure prévue est dans le futur » ;
// le Seller Hub verrouille la DERNIÈRE HEURE : on refuse donc à moins d'1 h du
// départ (relu chez eBay, pas d'après l'écran). L'heure retenue est relue.
const DERNIERE_HEURE_MS = 60 * 60 * 1000;
async function handleReprogrammer(b, owner) {
  if (b.confirme !== true) return { status: 400, body: { ok: false, reason: 'confirmation', error: 'Confirme le changement d\'heure : rien n\'a été envoyé à eBay.' } };
  const itemId = String(b.itemId || '').trim();
  if (!ID_EBAY.test(itemId)) return { status: 400, body: { ok: false, error: 'annonce eBay invalide' } };
  const quand = heureProgrammation(b.scheduleTime);
  if (!quand) return { status: 400, body: { ok: false, reason: 'heure', error: 'Nouvelle heure refusée : entre 15 minutes et 3 semaines à l\'avance.' } };
  const at = await accessToken(owner);
  if (!at.ok) return { status: at.status || 502, body: { ok: false, reason: at.reason, error: at.error } };
  const L = await listeVendeur(at.token);
  if (!L.ok) return { status: 503, body: { ok: false, reason: 'pas-su', error: 'Je n\'ai pas pu relire tes annonces programmées — rien n\'a été envoyé.' } };
  const p = L.programmees.find((x) => x.itemId === itemId);
  if (!p) return { status: 409, body: { ok: false, reason: 'pas-programmee', error: 'eBay ne la compte plus parmi tes annonces programmées.' } };
  const debut = Date.parse(p.depuis || '');
  if (!Number.isFinite(debut)) return { status: 409, body: { ok: false, reason: 'heure-inconnue', error: 'eBay ne dit pas à quelle heure elle part — je ne la déplace pas.' } };
  if (debut - Date.now() < DERNIERE_HEURE_MS) return { status: 409, body: { ok: false, reason: 'derniere-heure', error: 'Elle part dans moins d\'une heure : eBay ne permet plus de la déplacer.' } };
  const r = await tradingCall(at.token, 'ReviseFixedPriceItem', `<Item><ItemID>${itemId}</ItemID><ScheduleTime>${quand}</ScheduleTime></Item>`);
  if (r.status === 0) return { status: 504, body: { ok: false, reason: 'incertain', error: 'eBay n\'a pas répondu — je ne sais pas si l\'heure a changé. Rafraîchis avant de recommencer.' } };
  if (!r.ok) return { status: 422, body: { ok: false, error: r.err || 'eBay a refusé le changement d\'heure.', erreurs: r.erreurs } };
  const L2 = await listeVendeur(at.token);
  const p2 = L2.ok ? L2.programmees.find((x) => x.itemId === itemId) : null;
  return { status: 200, body: { ok: true, demande: quand, debut: (p2 && p2.depuis) || null, verifie: L2.ok ? !!p2 : null, avertissements: r.avertissements } };
}

// ── SES LIMITES DE VENTE (GET /sell/account/v1/privilege, lecture) ───────────
// Un nouveau vendeur est plafonné par eBay, en nombre et en montant, par mois.
// Un lot peut buter dessus : on lit la limite AVANT de proposer un lot. Ce que
// la réponse dit est une LIMITE, pas ce qu'il reste ce mois-ci (non exposé
// ici) : l'écran le dit comme tel. Absent ⇒ null, jamais 0.
async function handleLimites(owner) {
  const at = await accessToken(owner);
  if (!at.ok) return { status: at.status || 502, body: { ok: false, reason: at.reason, error: at.error } };
  const r = await ebayJson(`${EBAY_API}/sell/account/v1/privilege`, at.token);
  if (r.status === 403) return { status: 200, body: { ok: false, reason: 'scope', error: 'eBay n\'a pas autorisé VRM à lire tes limites de vente.' } };
  if (r.status === 0) return { status: 503, body: { ok: false, error: 'eBay injoignable' } };
  if (!r.ok || !r.data || typeof r.data !== 'object') return { status: r.status >= 400 ? r.status : 502, body: { ok: false, error: 'eBay n\'a pas rendu tes limites de vente.' } };
  const sl = r.data.sellingLimit || {};
  const q = Number(sl.quantity), m = sl.amount && Number(sl.amount.value);
  return { status: 200, body: {
    ok: true,
    quantite: sl.quantity != null && Number.isFinite(q) ? q : null,
    montant: sl.amount && sl.amount.value != null && Number.isFinite(m) ? m : null,
    devise: (sl.amount && sl.amount.currency) || 'EUR',
    inscrit: typeof r.data.sellerRegistrationCompleted === 'boolean' ? r.data.sellerRegistrationCompleted : null,
  } };
}

// ── RELIER UNE ANNONCE eBAY EXISTANTE À SA PAIRE (Trading ReviseFixedPriceItem) ─
// Pour les annonces publiées AVANT le SKU (ses 2 annonces actives, mesuré le
// 5 octobre). C'est SON clic qui choisit le numéro, jamais une suggestion
// appliquée toute seule (§5). Réversible : il peut la relier à un autre numéro.
async function handleSku(b, owner) {
  const itemId = String(b.itemId || '').trim();
  if (!ID_EBAY.test(itemId)) return { status: 400, body: { ok: false, error: 'annonce eBay invalide' } };
  const sku = skuDe(b.numero);
  if (!sku) return { status: 400, body: { ok: false, reason: 'numero', error: 'Numéro de paire illisible (125, ou B125) : rien n\'a été envoyé à eBay.' } };
  const at = await accessToken(owner);
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
async function handleOffreInfo(owner) {
  const at = await accessToken(owner);
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
async function handleOffre(b, owner) {
  // ⚠️ Une offre acceptée VEND la paire : sans confirmation explicite, rien ne
  //    part — pas même la vérification chez eBay.
  if (b.confirme !== true) return { status: 400, body: { ok: false, reason: 'confirmation', error: 'Confirme l\'envoi de l\'offre : rien n\'a été envoyé.' } };
  const listingId = String(b.listingId || '').trim();
  if (!ID_EBAY.test(listingId)) return { status: 400, body: { ok: false, error: 'annonce eBay invalide' } };
  const remise = Number(b.remise);
  if (!Number.isInteger(remise) || remise < 5 || remise > 50) return { status: 400, body: { ok: false, reason: 'remise', error: 'La remise doit être un nombre entier entre 5 et 50 %.' } };
  const message = texteOffre(b.message);
  if (message === null) return { status: 400, body: { ok: false, reason: 'message', error: 'Message trop long (2 000 caractères au plus).' } };
  const at = await accessToken(owner);
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
async function handleRetirer(b, owner) {
  if (b.confirme !== true) return { status: 400, body: { ok: false, reason: 'confirmation', error: 'Confirme le retrait : rien n\'a été envoyé à eBay.' } };
  const itemId = String(b.itemId || '').trim();
  if (!ID_EBAY.test(itemId)) return { status: 400, body: { ok: false, error: 'annonce eBay invalide' } };
  const at = await accessToken(owner);
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
async function handleFinances(owner) {
  const at = await accessToken(owner);
  if (!at.ok) return { status: at.status || 502, body: { ok: false, reason: at.reason, error: at.error } };
  const r = await ebayJson(`${EBAY_API}/sell/finances/v1/seller_funds_summary`, at.token, { 'Accept-Language': 'fr-FR' });
  if (r.status === 403) return { status: 200, body: { ok: false, reason: 'scope', error: 'Reconnecte-toi à eBay pour voir ton solde à virer (l\'accès « paiements » n\'a pas encore été autorisé).' } };
  if (r.status === 0) return { status: 503, body: { ok: false, error: 'eBay injoignable' } };
  if (!r.ok || !r.data) return { status: r.status >= 400 ? r.status : 502, body: { ok: false, error: 'eBay n\'a pas renvoyé le solde.' } };
  const amt = (o) => (o && o.value != null && isFinite(Number(o.value))) ? Number(o.value) : null;
  const d = r.data;
  const out = { ok: true, dispo: amt(d.availableFunds), enAttente: amt(d.processingFunds), retenu: amt(d.fundsOnHold), total: amt(d.totalFunds), devise: (d.totalFunds && d.totalFunds.currency) || (d.availableFunds && d.availableFunds.currency) || 'EUR', capturedAt: Date.now() };
  await storeData('ebay_finances', out, owner);
  return { status: 200, body: out };
}

// ── MESURE pour la PUBLICATION (lecture seule) : ce qu'eBay EXIGE pour créer
//    une annonce — la catégorie, ses attributs obligatoires, et les règles/
//    emplacements du compte. On mesure AVANT d'écrire le publieur (§6).
async function handlePubInfo(b, owner) {
  const at = await accessToken(owner);
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

async function handleSync(owner) {
  const at = await accessToken(owner);
  if (!at.ok) return { status: at.status || 502, body: { ok: false, reason: at.reason, error: at.error, detail: at.detail || '' } };
  const token = at.token;
  // On appelle chaque source séparément : un échec n'empêche pas les autres.
  // Les annonces EN LIGNE et PROGRAMMÉES viennent d'UN SEUL GetMyeBaySelling,
  // découpé par conteneur (`listeVendeur`) : une programmée n'est jamais
  // comptée « en ligne ».
  const [orders, inv, liste] = await Promise.all([
    ebayJson(`${EBAY_API}/sell/fulfillment/v1/order?limit=50`, token),
    // L'Inventory API exige un Accept-Language (sinon 400 « Invalid value for
    // header Accept-Language »). Ne concerne que les annonces créées par API.
    ebayJson(`${EBAY_API}/sell/inventory/v1/inventory_item?limit=100`, token, { 'Accept-Language': 'fr-FR', 'Content-Language': 'fr-FR' }),
    listeVendeur(token),
  ]);
  // ── DÉTAIL COMPLET par annonce (photos, description, catégorie, état,
  //    caractéristiques) : « capter tout ». On borne à 20 GetItem par sync
  //    (limites d'API) — largement assez pour son stock, et extensible.
  const lst = liste.ok ? liste.actives : [];
  const detailDiag = [];
  for (const it of lst.slice(0, 20)) {
    if (!it.itemId) continue;
    const d = await tradingGetItem(token, it.itemId);
    if (d && !d._err) { it.detail = d; if (!it.photo && d.photos && d.photos[0]) it.photo = d.photos[0]; }
    else if (d && d._err && detailDiag.length < 3) detailDiag.push({ itemId: it.itemId, err: d._err });
  }
  // Range ce qu'on a (fusion par id).
  // ⚠️⚠️ « RIEN LU » NE VAUT PAS « RIEN » (5 octobre). Chaque lecture ratée
  //    réécrivait sa ligne avec une liste VIDE : un hoquet d'eBay effaçait ses
  //    annonces de l'app (« Pas encore d'annonce eBay en ligne »), et l'anti
  //    double vente ne voyait plus qu'une paire vendue sur Vinted était encore
  //    en vente sur eBay. Une source qui n'a pas répondu garde sa dernière
  //    capture.
  const at2 = Date.now();
  if (liste.ok) {
    await storeData('ebay_listings', { items: lst, ack: liste.ack, status: liste.status, complet: liste.complet, capturedAt: at2 }, owner);
    await storeData('ebay_programmees', { items: liste.programmees.map(resumeProgrammee), enLigne: lst.map((x) => ({ itemId: x.itemId, sku: x.sku })), complet: liste.complet, capturedAt: at2 }, owner);
  }
  if (orders.ok && orders.data) await storeData('ebay_orders', { orders: orders.data.orders || [], status: orders.status, capturedAt: at2 }, owner);
  if (inv.ok && inv.data) await storeData('ebay_inventory', { items: inv.data.inventoryItems || [], status: inv.status, capturedAt: at2 }, owner);
  // Résumé de MESURE : comptes + statuts + petits échantillons (pour voir la forme).
  return { status: 200, body: {
    ok: true,
    // Ce qui a VRAIMENT été lu (et donc rangé) — le reste garde sa dernière capture.
    lu: { annonces: !!liste.ok, programmees: !!liste.ok, commandes: !!(orders.ok && orders.data), stock: !!(inv.ok && inv.data) },
    listings: { status: liste.status, ack: liste.ack, count: lst.length, sample: lst.slice(0, 3), detailDiag, error: liste.ok ? undefined : liste.error },
    programmees: { count: liste.ok ? liste.programmees.length : null, complet: liste.ok ? liste.complet : null },
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
// Julien par la sienne.
// ⇒ `authurl` (vendeur connecté) fabrique un `state` SIGNÉ par le serveur,
// daté, qui PORTE le vendeur : `ts.vendeur.mac`. eBay le renvoie tel quel ; le
// retour le vérifie (temps constant, 30 min) et range les jetons chez CE
// vendeur-là — chaque vendeur relie SON eBay, et personne ne peut faire ranger
// un jeton chez un autre (le vendeur fait partie de ce qui est signé). La clé
// de signature est un secret serveur (EBAY_CERT_ID), jamais envoyé au
// navigateur.
const ETAT_VALIDITE_MS = 30 * 60 * 1000;
const macEtat = (owner, ts) => crypto.createHmac('sha256', 'vrm-ebay-consentement|' + (process.env.EBAY_CERT_ID || ''))
  .update(String(owner) + '|' + String(ts)).digest('hex').slice(0, 40);
function signerEtat(owner) { const o = String(owner).toLowerCase(); const ts = Date.now().toString(36); return ts + '.' + o + '.' + macEtat(o, ts); }
// Le vendeur porté par un `state` valide, ou '' (forme, âge ou signature faux).
function vendeurDeEtat(state) {
  const m = /^([0-9a-z]{6,12})\.([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([0-9a-f]{40})$/.exec(String(state || ''));
  if (!m || !process.env.EBAY_CERT_ID) return '';
  const age = Date.now() - parseInt(m[1], 36);
  if (!(age >= -60000 && age <= ETAT_VALIDITE_MS)) return '';
  const attendu = Buffer.from(macEtat(m[2], m[1])), recu = Buffer.from(m[3]);
  return (attendu.length === recu.length && crypto.timingSafeEqual(attendu, recu)) ? m[2] : '';
}
// Le propriétaire de l'INSTALLATION. Ne sert plus qu'à une base PAS ENCORE
// cloisonnée : il n'y a alors qu'un jeu de données (les jetons eBay de
// l'installation), et seul ce vendeur-là y touche — exactement comme avant.
const proprioEbay = () => process.env.VRM_OWNER_UID || '';

async function handleCallback(req, res) {
  const q = req.query || {};
  if (q.error) { retour(res, 'refus', String(q.error).slice(0, 60)); return; }
  const code = String(q.code || '').trim();
  if (!code) { retour(res, 'erreur', 'aucun code'); return; }
  if (!keysReady()) { retour(res, 'erreur', 'clés absentes'); return; }
  const vendeur = vendeurDeEtat(q.state);
  if (!vendeur) { retour(res, 'erreur', 'demande expirée ou inconnue — relance la connexion eBay depuis VRM'); return; }
  try {
    const r = await exchangeCode(code, vendeur);
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
  // compte eBay.
  const u = await vendeurExige(req, res);
  if (!u) return;
  // ── CHAQUE VENDEUR SON eBAY (5 octobre). Base cloisonnée : tout ce qui suit
  // (jetons, annonces, programmées, finances) est lu et écrit AU NOM de
  // `u.id` — un vendeur ne touche jamais les jetons ni les lignes d'un autre.
  // Base PAS encore cloisonnée : un seul jeu de données, celui de
  // l'installation — seul son propriétaire y touche, comme avant.
  // (« Pas su » sur la base = on la suppose cloisonnée : filtrer sur le vendeur
  // fait au pire échouer la lecture ; ne pas filtrer mélangerait les boutiques.)
  const owner = u.id;
  const cloison = await baseCloisonnee();
  if (!cloison && proprioEbay() && owner !== proprioEbay()) { res.status(403).json({ ok: false, reason: 'pas-proprietaire', error: "Ce compte eBay n'est pas relié à ton compte VRM." }); return; }
  // Un vendeur dont l'abonnement est coupé ne pilote plus eBay par VRM — la
  // MÊME règle que la base (`vrm_acces_pour`) et que les autres routes. « Pas
  // su » ne coupe pas (couper un vendeur qui paie sur un hoquet lui ferait
  // rater une vente) ; ses DONNÉES, elles, sont tenues par la base.
  if ((await accesVendeur(owner)) === false) { res.status(402).json({ ok: false, reason: 'abonnement', error: "Ton abonnement VRM n'est plus actif." }); return; }
  const b = req.body || {};
  const action = String(b.action || '');
  if (!keysReady()) { res.status(503).json({ ok: false, reason: 'no-key', error: 'eBay indisponible : EBAY_APP_ID / EBAY_CERT_ID ne sont pas configurés sur Vercel.' }); return; }
  try {
    if (action === 'authurl') {
      if (!ruName()) { res.status(503).json({ ok: false, reason: 'no-runame', error: 'Le RuName (EBAY_RUNAME) n\'est pas configuré.' }); return; }
      res.status(200).json({ ok: true, url: authUrl(signerEtat(owner)) });
      return;
    }
    if (action === 'apptoken') {
      const r = await appToken();
      res.status(r.status).json(r.ok ? { ok: true, works: true, expires_in: r.expires_in || null } : { ok: false, error: r.error, detail: r.detail || '' });
      return;
    }
    if (action === 'exchange') {
      const r = await exchangeCode(String(b.code || '').trim(), owner);
      res.status(r.status).json(r.ok ? { ok: true, connected: true } : { ok: false, reason: r.reason, error: r.error, detail: r.detail || '' });
      return;
    }
    if (action === 'status') {
      const has = await hasRefresh(owner);
      if (has === null) { res.status(503).json({ ok: false, reason: 'store-unreachable', error: 'Impossible de lire l\'état (base injoignable).' }); return; }
      res.status(200).json({ ok: true, connected: !!has });
      return;
    }
    // Toutes les autres actions agissent sur le compte eBay de CE vendeur. Ce
    // qui engage (offre, retrait, programmation, annulation, déplacement) exige
    // en plus `confirme:true` — vérifié AVANT tout appel à eBay.
    const ACTIONS = {
      sync: () => handleSync(owner),
      revise: () => handleRevise(b, owner),
      pubinfo: () => handlePubInfo(b, owner),
      pubverify: () => handleVerify(b, owner),
      finances: () => handleFinances(owner),
      publish: () => handlePublish(b, owner),
      sku: () => handleSku(b, owner),
      offreinfo: () => handleOffreInfo(owner),
      offre: () => handleOffre(b, owner),
      retirer: () => handleRetirer(b, owner),
      programmer: () => handleProgrammer(b, owner),
      programmees: () => handleProgrammees(owner),
      deprogrammer: () => handleDeprogrammer(b, owner),
      reprogrammer: () => handleReprogrammer(b, owner),
      limites: () => handleLimites(owner),
    };
    if (!Object.prototype.hasOwnProperty.call(ACTIONS, action)) { res.status(400).json({ ok: false, error: 'action inconnue' }); return; }
    const r = await ACTIONS[action]();
    res.status(r.status).json(r.body);
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
