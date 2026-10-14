import {creerLectureCommandesEbay} from './_lib/ebay-commandes-pages.js';
import {fusionCommandesEbay} from './_lib/ebay-synchronisation.js';
import {preparerAgentEbay,executerAvecJournal} from './_lib/ebay-agent.js';
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
import {creerGestionEbay,lireXmlEbay} from './_lib/ebay-gestion.js';
import { vendeurExige, baseCloisonnee } from './_lib/session.js';
import { accesVendeur } from './_lib/abonnement.js';
import { keysReady, canConsent, ruName, authUrl, appToken, hasRefresh, accessToken, storeData, lireReglageVendeur, lireDonnee, modifierDonnee,
  lireComptes, comptesActifs, rangerConnexion, apprendrePrincipal, resoudreCompte, deconnecterCompte, suffixeCompte,
  montantOk, valideRegleOffre, seuilTropBas } from './_lib/ebay.js';

// ── LE CONTEXTE D'UNE ACTION : QUI (le vendeur de la session) ET SUR QUEL
// COMPTE eBAY (9 octobre, plusieurs comptes par vendeur). `ctx.compte.suffixe`
// désigne SES lignes : '' pour le principal, `_{cle}` pour les suivants. Les
// jetons et les lignes de données sont ceux de CE compte, jamais d'un autre.
const jetonDe = (ctx) => accessToken(ctx.owner, ctx.compte.suffixe);
const ligneDe = (base, ctx) => base + (ctx.compte.suffixe || '');
const nomCompte = (c) => (c && c.pseudo) ? `« ${c.pseudo} »` : (c && c.principal ? 'principal' : '');
import { numeroExterne } from './_lib/numerotation.js';

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
// Le N° que désigne un SKU LU chez eBay — la MÊME lecture stricte que
// `numDeSkuEbay` de l'app : « VRM-030 », « vrm-30 », « VRM 30 » désignent la
// N°30 (il a pu le retaper dans le Seller Hub). Comparer la chaîne brute
// laissait programmer — ou publier — une seconde annonce pour la même paire.
const numDeSku = (sku) => { const m = /^\s*VRM[-\s]?((?:[A-Z]{1,3})?\d{1,6})\s*$/i.exec(String(sku == null ? '' : sku)); const c = m ? cleNum(m[1]) : ''; return c && NUM_OK.test(c) ? c : ''; };
// (`memePaire` est retiré : deux SKU se comparent par le N° QU'ILS DÉSIGNENT,
// lu avec le marqueur de la remise à zéro — `numeroExterne`, dans `dejaChezEbay`.)
// Une écriture chez eBay SANS <Ack> (réseau coupé, passerelle 5xx en HTML) :
// eBay n'a rien dit de ce qu'il a fait ⇒ « incertain », jamais « refusé ».
// Mesuré (revue du 6 octobre) : un 503 HTML APRÈS création de l'annonce était
// rendu « eBay a refusé l'annonce » — le brouillon restait à republier, et
// « Publier » en créait une seconde.
const sansAck = (r) => !r || r.status === 0 || !r.ack;
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
      // (9 octobre) La CLASSE de l'erreur : `RequestError` = eBay a refusé la
      // requête (rien n'est appliqué) · `SystemError` = panne d'eBay (rien
      // n'est prouvé, il a pu écrire avant de tomber) · '' = pas dit.
      classe: String(g('ErrorClassification')).trim(),
    });
  }
  return out;
}
// La CLASSE d'un échec : 'refus' seulement si TOUTES les erreurs de sévérité
// Error sont des RequestError (eBay a refusé la requête : rien n'est appliqué).
// Une SystemError, une classe absente, ou pas d'erreur lisible : 'incertain'
// (eBay est peut-être tombé APRÈS avoir écrit) — jamais « rien n'a changé ».
function classeEchec(r) {
  const errs = (r && Array.isArray(r.erreurs) ? r.erreurs : []).filter((e) => e.severite === 'Error');
  return errs.length && errs.every((e) => e.classe === 'RequestError') ? 'refus' : 'incertain';
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
    currency:(/<(?:CurrentPrice|BuyItNowPrice|StartPrice)[^>]*currencyID=["']([A-Z]{3})["']/.exec(blk) || [])[1] || null,
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
  // (11 octobre, revue) L'heure de la lecture est celle où la question PART
  // chez eBay, jamais celle où la réponse arrive : une réponse lente ne doit pas
  // se croire plus fraîche qu'une pose faite pendant qu'elle voyageait.
  const t0 = Date.now();
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
    // (9 octobre) La règle d'offre lue dans LA MÊME réponse (zéro appel de
    // plus). ⚠️ Elle ne va JAMAIS dans `ebay_listings` : la synchro la retire
    // du détail et la range dans `ebay_offres` (une ligne, un propriétaire).
    _regle: lectureRegleDe(xml, itemId, t0),
  };
}

// ════════════════════════════════════════════════════════════════════════════
// LA RÈGLE D'OFFRE (9 octobre) — « au-dessus, ça accepte » : c'est eBAY qui
// accepte, au seuil que Julien fixe, annonce par annonce, sur SON clic.
// Julien : « je veux juste définir une règle sur chaque annonce et à chaque
// offre au-dessus ça accepte ». Le réglage NATIF d'eBay (Offre directe) :
// `ListingDetails.BestOfferAutoAcceptPrice` (eBay accepte toute offre ≥ X) et,
// en option, `ListingDetails.MinimumBestOfferPrice` (eBay refuse toute offre
// < Y). VRM n'appelle JAMAIS une route d'acceptation : il pose un seuil sur
// l'annonce, par `ReviseFixedPriceItem` (ou à la création, dans `itemXml`).
// Vinted n'est pas touché (§3 du dossier : retiré le 5 octobre).
// ⚠️ Rien de ceci n'a été envoyé à eBay pour de vrai : noms et places des
// éléments viennent de la doc d'eBay. C'est la RELECTURE après chaque écriture
// qui dit ce qu'eBay tient — jamais l'écran qui le suppose.
// ════════════════════════════════════════════════════════════════════════════
const eur = (n) => Number(n).toFixed(2).replace('.', ',') + ' €';
const montantXml = (v) => (Math.round(v * 100) / 100).toFixed(2);
// La règle lue, en clair — UNE fonction pour les messages d'écart, de 409 et
// d'incertain (la même que l'app, §11).
function etatEnClair(l) {
  if (!l) return 'pas lue';
  if (l.offresActives === false) return 'offres coupées';
  if (l.accepte != null) return `eBay accepte dès ${eur(l.accepte)}` + (l.refuse != null ? ` · refuse sous ${eur(l.refuse)}` : '') + (l.offresActives == null ? ' (offres activées ou non : pas lu)' : '');
  if (l.refuse != null) return `eBay refuse sous ${eur(l.refuse)}, sans montant d'acceptation`;
  if (l.offresActives === true) return 'offres activées, sans montant d\'acceptation';
  return 'aucune règle';
}
// LA RÈGLE D'OFFRE D'UNE ANNONCE, lue dans la réponse d'un GetItem fait avec le
// jeton DU VENDEUR (seul lui voit les seuils — doc eBay). UNE lecture pour la
// synchro, la relecture après une pose, « Relire chez eBay », la relecture
// après un changement de prix et après une publication (§11).
// Rend null quand la réponse ne prouve pas qu'on a lu L'annonce entière (pas
// d'<Item>, autre ItemID, pas de prix, montant illisible) : « pas su », jamais
// « aucune ».
// ⚠️⚠️ (11 octobre, revue) `lueA` = l'heure où la question est PARTIE chez eBay
// (`t0`), jamais celle de la réponse. Datée à l'arrivée, une lecture partie
// AVANT une pose et revenue APRÈS se croyait plus récente que la relecture de
// la pose, et la réécrivait : la base disait « aucune » sur une annonce qu'eBay
// vendait dès 72 € (reproduit sur la synchro ET « Relire chez eBay »). Ce
// qu'elle dit d'eBay date du départ de la question, pas de son retour.
function montantXmlLu(src, t) {
  const m = new RegExp('<' + t + '(\\s[^>]*)?>([^<]*)</' + t + '>').exec(String(src || ''));
  if (!m) return { v: null, dev: '' };
  const n = Number(String(m[2]).trim());
  return { v: Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN, dev: ((/currencyID="([A-Z]{3})"/.exec(m[1] || '') || [])[1]) || '' };
}
function lectureRegleDe(xml,itemId,t0){
 const item=lireXmlEbay(xml,'GetItem')?.Item;
 const text=v=>v && typeof v==='object'?String(v['#text'] ?? ''):String(v ?? '');
 if(!item || text(item.ItemID)!==String(itemId))return null;
 const amount=v=>v==null?{v:null,dev:''}:{v:text(v).trim() && Number.isFinite(Number(text(v)))?Math.round(Number(text(v))*100)/100:NaN,dev:typeof v==='object'?v['@_currencyID'] || '':''};
 const ss=item.SellingStatus || {},ld=item.ListingDetails || {},bo=item.BestOfferDetails;
 let price=amount(ss.CurrentPrice);if(price.v==null)price=amount(item.StartPrice);
 const accept=amount(ld.BestOfferAutoAcceptPrice),refuse=amount(ld.MinimumBestOfferPrice);
 if(!(price.v>0) || Number.isNaN(accept.v) || Number.isNaN(refuse.v))return null;
 const enabled=text(bo?.BestOfferEnabled).toLowerCase(),count=text(bo?.BestOfferCount);
 const currency=price.dev || text(item.Currency);
 return {lecture:{lu:true,offresActives:enabled==='true'?true:enabled==='false'?false:null,accepte:accept.v,refuse:refuse.v,devise:accept.dev || refuse.dev || currency,prix:price.v,offresFaites:/^\d+$/.test(count)?Number(count):null,lueA:Number.isFinite(t0)?t0:Date.now()},annonce:{prix:price.v,devise:currency,type:text(item.ListingType),statut:text(ss.ListingStatus),sku:text(item.SKU)}};
}
// GetItem SANS DetailLevel ni OutputSelector : la doc dit que les seuils sont
// rendus dès « DetailLevel none » ; un OutputSelector mal écrit rendrait une
// annonce tronquée qu'on lirait « aucune règle » — on ne prend pas ce risque.
async function lireRegleOffre(token, itemId) {
  const t0 = Date.now();
  const r = await tradingCall(token, 'GetItem', `<ItemID>${itemId}</ItemID>`);
  if (sansAck(r) || !r.ok) return { ok: false };
  const l = lectureRegleDe(r.xml, itemId, t0);
  return l ? { ok: true, ...l } : { ok: false };
}
// La relecture APRÈS une écriture : eBay peut mettre un instant à montrer la
// révision [non mesuré]. Si la première relecture ne montre pas ce qui a été
// demandé, on attend puis on relit UNE fois. Délai lu dans
// process.env.EBAY_RELECTURE_MS (défaut 2000 ; l'audit le met à 20).
const cents = (v) => (v == null ? null : Math.round(Number(v) * 100));
// Trois issues : true (eBay montre la demande) · false (eBay montre autre chose)
// · null (montants conformes mais on ne sait pas si les offres sont actives).
function memeRegle(lu, demande, pre) {
  if (!lu) return null;
  if (demande.accepte === null) return lu.accepte == null && lu.refuse == null;
  const refAttendu = ('refuse' in demande) ? (demande.refuse == null ? null : demande.refuse) : (pre ? pre.refuse : null);
  if (cents(lu.accepte) !== cents(demande.accepte) || cents(lu.refuse) !== cents(refAttendu)) return false;
  if (lu.offresActives === true) return true;
  return lu.offresActives === false ? false : null;
}
async function relireApres(token, itemId, demande, pre) {
  let post = await lireRegleOffre(token, itemId);
  if (post.ok && memeRegle(post.lecture, demande, pre) === false) {
    await new Promise((ok) => setTimeout(ok, Number(process.env.EBAY_RELECTURE_MS) || 2000));
    const p2 = await lireRegleOffre(token, itemId);
    if (p2.ok) post = p2;
  }
  return post;
}
// ── LE RANGEMENT : `ebay_offres{suffixe}`, une ligne DÉDIÉE par compte eBay ──
// Jamais `main`, jamais dans `ebay_listings` (la synchro réécrit
// `ebay_listings` en entier : une règle rangée là serait écrasée).
// Trois issues : true écrit · false écriture ratée · null pas su (la LECTURE de
// la ligne a échoué ⇒ RIEN n'est écrit : repartir d'un objet vide effacerait
// les règles lues des autres annonces — la famille « lecture KO, écriture OK »).
// ⚠️ Une entrée n'en remplace une autre que si elle est au moins aussi RÉCENTE
// (`lueA` = l'heure où la question est PARTIE chez eBay, `lectureRegleDe`) :
// une synchro lancée avant une pose ne réécrit pas, après elle, la lecture
// d'avant. Seule exception : `_force: true` (jamais rangé), posé par la requête
// qui a écrit le marqueur « en-cours » pour le remplacer.
// ⚠️⚠️ (11 octobre, revue) UNE LECTURE RATÉE NE REMPLACE RIEN. Un GetItem qui
// hoquette pendant la synchro ou « Relire chez eBay » rangeait « pas lue » par
// -dessus une règle CONNUE (plus récente, donc gagnante) : VRM oubliait une
// règle qu'eBay appliquait toujours — la ligne « pas su » passait en gris,
// l'annonce sortait de « ce que ça engage », et les ventes eBay n'étaient plus
// relues à l'ouverture pour ce compte, pendant qu'eBay vendait au seuil. Rien
// lu ne vaut pas rien : « lecture ratée » ne remplit qu'une place VIDE.
// (Une écriture incertaine — « en-cours », « incertain », « apres-ecriture » —
// n'est PAS une lecture ratée : elle dit qu'eBay a peut-être changé.)
// ⚠️ `garder` = { ids, a } : les annonces d'une liste COMPLÈTE, lue à l'heure
// `a`. Une entrée absente de la liste n'en sort que si elle est PLUS ANCIENNE
// que la liste : une annonce publiée (ou une règle posée) pendant que la
// synchro relisait n'était pas dans une liste lue avant elle, et sa règle
// était effacée — l'annonce redevenait « jamais lue ».
// ⚠️⚠️ (11 octobre) Et l'écriture ne réécrit plus une copie PÉRIMÉE des autres
// annonces : deux gestes sur deux cartes du même compte (poser sur la Nike,
// retirer sur la Samba, à 50 ms) relisaient la même version, et le second
// écrit remettait la Nike à « aucune » — eBay la vendait dès 72 €, VRM ne la
// comptait plus dans « ce que ça engage » ni dans la relecture des ventes.
// `modifierDonnee` compare-et-échange : une écriture concurrente fait relire
// et refaire la fusion sur ce que l'autre a écrit.
const REGLES_MAX = 300;
async function rangerReglesOffre(ctx, lectures, garder) {
  return modifierDonnee(ligneDe('ebay_offres', ctx), ctx.owner, (d) => {
    const items = { ...((d && d.items && typeof d.items === 'object' && !Array.isArray(d.items)) ? d.items : {}) };
    for (const [k, v0] of Object.entries(lectures || {})) {
      if (!ID_EBAY.test(k) || !v0 || typeof v0 !== 'object') continue;
      const { _force, ...v } = v0;
      const avant = items[k];
      if (!_force && avant && v.lu !== true && v.raison === 'lecture-ratee') continue;
      if (!_force && avant && (Number(avant.lueA) || 0) > (Number(v.lueA) || 0)) continue;
      items[k] = v;
    }
    if (garder && garder.ids instanceof Set && Number.isFinite(garder.a)) {
      for (const k of Object.keys(items)) if (!garder.ids.has(k) && !(lectures && lectures[k]) && (Number(items[k] && items[k].lueA) || 0) < garder.a) delete items[k];
    }
    const cles = Object.keys(items).sort((x, y) => (Number(items[y].lueA) || 0) - (Number(items[x].lueA) || 0)).slice(0, REGLES_MAX);
    return { items: Object.fromEntries(cles.map((k) => [k, items[k]])), capturedAt: Date.now() };
  });
}
// Une règle « attendue » envoyée par l'écran (ce que Julien VOYAIT) :
// 'inconnu' (état « pas su »), ou { accepte: null|montant, refuse: null|montant }.
const attenduOk = (a) => a === 'inconnu' || (!!a && typeof a === 'object' && !Array.isArray(a)
  && (a.accepte === null || montantOk(a.accepte)) && (a.refuse === null || montantOk(a.refuse)));

// ── POSER, CHANGER, RETIRER LA RÈGLE D'OFFRE D'UNE ANNONCE EN LIGNE ─────────
// Requêtes (le navigateur n'envoie JAMAIS de prix à appliquer ; `prixVu` et
// `attendu` sont des GARDES : ce que Julien a vu quand il a confirmé) :
//   pose    : { action:'regleoffre', itemId, accepte, [refuse], prixVu, attendu, [sousMoitie:true], confirme:true, [compte] }
//   retrait : { action:'regleoffre', itemId, accepte:null, refuse:null, confirme:true, [compte] }
// `refuse` nombre ⇒ poser/changer le refus ; `null` ⇒ le retirer ; clé ABSENTE
// ⇒ garder celui d'eBay (il est RENVOYÉ dans le même appel : un ListingDetails
// envoyé sans lui peut le faire sauter, article 880 d'eBay, avertissement 21992).
// Toutes les gardes passent AVANT le moindre appel d'écriture chez eBay, et la
// base est marquée « en cours » AVANT d'écrire chez eBay : elle ne garde
// jamais l'ancien état d'une annonce qu'eBay a peut-être changée.
async function handleRegleOffre(b, ctx) {
  if (b.confirme !== true) return { status: 400, body: { ok: false, reason: 'confirmation', error: 'Confirme la règle d\'offre : rien n\'a été envoyé à eBay.' } };
  const itemId = String(b.itemId || '').trim();
  if (!ID_EBAY.test(itemId)) return { status: 400, body: { ok: false, error: 'annonce eBay invalide' } };
  if (b.accepte === undefined) return { status: 400, body: { ok: false, reason: 'montant', error: 'Un montant en euros, par exemple 72 ou 72,50.' } };
  const pose = b.accepte !== null;
  const aRefuse = Object.prototype.hasOwnProperty.call(b, 'refuse');
  // Un retrait retire TOUT (acceptation ET refus) : retirer réduit le risque.
  // (Un refus SANS acceptation est refusé par `valideRegleOffre`.)
  const refuseB = aRefuse ? b.refuse : (pose ? undefined : null);
  const v = valideRegleOffre({ accepte: b.accepte, refuse: refuseB, prix: null });
  if (!v.ok) return { status: 400, body: { ok: false, reason: v.code, error: v.err } };
  const accepte = v.accepte, refuse = v.refuse;
  const prixVu = b.prixVu;
  if (pose) {
    if (!(typeof prixVu === 'number' && Number.isFinite(prixVu) && prixVu > 0)) return { status: 400, body: { ok: false, reason: 'prix-vu', error: 'Le prix affiché manque : rouvre l\'écran — rien n\'a été envoyé.' } };
    if (!attenduOk(b.attendu)) return { status: 400, body: { ok: false, reason: 'attendu', error: 'Je ne sais pas quelle règle tu voyais : rouvre l\'écran — rien n\'a été envoyé.' } };
    if (seuilTropBas(accepte, prixVu) && b.sousMoitie !== true) return { status: 400, body: { ok: false, reason: 'sous-moitie', prix: prixVu, error: `${eur(accepte)}, c'est moins de la moitié du prix (${eur(prixVu)}) : confirme-le explicitement — rien n'a été envoyé.` } };
  }
  const demande = pose ? { accepte, ...(refuse !== undefined ? { refuse } : {}) } : { accepte: null, refuse: null };
  const at = await jetonDe(ctx);
  if (!at.ok) return { status: at.status || 502, body: { ok: false, reason: at.reason, error: at.error } };
  // ── L'annonce est-elle EN VENTE SUR CE COMPTE ? Relue chez eBay, avec SON
  // jeton : une annonce d'un autre compte ne désigne rien ici.
  const L = await listeVendeur(at.token);
  if (!L.ok) return { status: 503, body: { ok: false, reason: 'pas-su', error: 'Je n\'ai pas pu relire tes annonces eBay — rien n\'a été envoyé.' } };
  if (L.programmees.some((x) => x.itemId === itemId)) return { status: 409, body: { ok: false, reason: 'programmee', error: pose
    ? 'Elle n\'est pas encore en ligne : pose la règle dans son brouillon avant de la programmer, ou quand elle sera en ligne.'
    : 'Elle n\'est pas encore en ligne : annule sa programmation (le brouillon garde la règle, tu pourras la changer), ou retire la règle dès qu\'elle sera en ligne.' } };
  if (!L.actives.some((x) => x.itemId === itemId)) {
    if (L.complet) return { status: 409, body: { ok: false, reason: 'pas-sur-ce-compte', compte: ctx.compte.pseudo || '', error: `Cette annonce n'est pas en vente sur ton compte eBay ${nomCompte(ctx.compte) || 'principal'} — rien n'a été envoyé.` } };
    return { status: 503, body: { ok: false, reason: 'pas-su', error: 'Tu as plus de 1 000 annonces sur ce compte eBay : je n\'ai pas pu vérifier que celle-ci y est — rien n\'a été envoyé.' } };
  }
  // ── L'annonce telle qu'eBay la tient MAINTENANT (prix, état, règle). ──
  const pre = await lireRegleOffre(at.token, itemId);
  if (!pre.ok) return { status: 503, body: { ok: false, reason: 'pas-su', error: 'Je n\'ai pas pu relire l\'annonce chez eBay (prix, état) — rien n\'a été envoyé.' } };
  if (!/^(FixedPriceItem|StoresFixedPrice)$/.test(pre.annonce.type)) return { status: 409, body: { ok: false, reason: 'format', error: 'Ce n\'est pas une annonce à prix fixe : eBay n\'y propose pas d\'offres.' } };
  if (pre.annonce.statut && pre.annonce.statut !== 'Active') return { status: 409, body: { ok: false, reason: 'plus-en-vente', error: 'Elle n\'est plus en vente sur eBay — rien n\'a été envoyé.' } };
  if (pre.annonce.devise !== 'EUR') return { status: 409, body: { ok: false, reason: 'devise', error: 'Annonce dans une autre devise que l\'euro : VRM ne pose pas de règle dessus.' } };
  const P = pre.lecture;
  const rangerPre = () => rangerReglesOffre(ctx, { [itemId]: { ...P, par: 'regle' } });
  // Le prix que Julien a VU n'est plus celui d'eBay : rien ne part.
  if (pose && cents(prixVu) !== cents(pre.annonce.prix)) {
    await rangerPre();
    return { status: 409, body: { ok: false, reason: 'prix-change', prix: pre.annonce.prix, lecture: P, error: `Le prix sur eBay est maintenant de ${eur(pre.annonce.prix)} (VRM affichait ${eur(prixVu)}) : rien n'a été envoyé. Revois le montant.` } };
  }
  // Contre LE PRIX D'eBAY, maintenant (eBay refuse un seuil égal ou supérieur).
  const v2 = valideRegleOffre({ accepte, refuse, prix: pre.annonce.prix });
  if (!v2.ok) return { status: 409, body: { ok: false, reason: v2.code, prix: pre.annonce.prix, error: v2.err } };
  // Idempotence : aucune révision inutile (eBay en compte 250 par jour et par annonce).
  const inchange = pose
    ? (P.offresActives === true && cents(P.accepte) === cents(accepte) && (refuse === undefined || cents(P.refuse) === cents(refuse)))
    : (P.accepte == null && P.refuse == null);
  if (inchange) {
    const range = await rangerPre();
    return { status: 200, body: { ok: true, inchange: true, verifie: true, lecture: P, avertissements: [], range } };
  }
  // La règle a changé chez eBay depuis ce que Julien a VU : rien ne part.
  if (pose) {
    const a = b.attendu;
    if (a && typeof a === 'object' && (cents(a.accepte) !== cents(P.accepte) || cents(a.refuse) !== cents(P.refuse))) {
      await rangerPre();
      return { status: 409, body: { ok: false, reason: 'regle-changee', lecture: P, error: `La règle sur eBay a changé depuis : ${etatEnClair(P)}. Rien n'a été envoyé — revois-la.` } };
    }
    if (a === 'inconnu' && (P.accepte != null || P.refuse != null)) {
      await rangerPre();
      return { status: 409, body: { ok: false, reason: 'regle-existante', lecture: P, error: `eBay a déjà une règle sur cette annonce : ${etatEnClair(P)}. Rien n'a été envoyé — dis-moi si tu la remplaces.` } };
    }
    if (refuse === undefined && P.refuse != null && cents(P.refuse) >= cents(accepte)) {
      return { status: 409, body: { ok: false, reason: 'refuse-existant', refuse: P.refuse, lecture: P, error: `eBay refuse déjà les offres sous ${eur(P.refuse)} : la règle doit être au-dessus. Rien n'a été envoyé.` } };
    }
  }
  // ── LE MARQUEUR, AVANT d'écrire chez eBay. ──
  const m = await rangerReglesOffre(ctx, { [itemId]: { lu: false, raison: 'en-cours', lueA: Date.now(), par: 'regle', _force: true } });
  if (m !== true) return { status: 503, body: { ok: false, reason: 'note', error: 'Je n\'ai pas pu le noter dans VRM — rien n\'a été envoyé à eBay. Réessaie dans un moment.' } };
  // ── L'ÉCRITURE ──
  let inner;
  if (pose) {
    const yRefus = refuse != null ? refuse : (refuse === undefined && P.refuse != null ? P.refuse : null);
    inner = `<Item><ItemID>${itemId}</ItemID>`
      + (P.offresActives !== true ? '<BestOfferDetails><BestOfferEnabled>true</BestOfferEnabled></BestOfferDetails>' : '')
      + `<ListingDetails><BestOfferAutoAcceptPrice currencyID="EUR">${montantXml(accepte)}</BestOfferAutoAcceptPrice>`
      + (yRefus != null ? `<MinimumBestOfferPrice currencyID="EUR">${montantXml(yRefus)}</MinimumBestOfferPrice>` : '')
      + '</ListingDetails></Item>'
      + (refuse === null && P.refuse != null ? '<DeletedField>Item.ListingDetails.MinimumBestOfferPrice</DeletedField>' : '');
  } else {
    // Retirer la règle, c'est « les offres t'arrivent, c'est toi qui décides » :
    // on ne touche PAS à BestOfferEnabled.
    inner = `<Item><ItemID>${itemId}</ItemID></Item>`
      + (P.accepte != null ? '<DeletedField>Item.ListingDetails.BestOfferAutoAcceptPrice</DeletedField>' : '')
      + (P.refuse != null ? '<DeletedField>Item.ListingDetails.MinimumBestOfferPrice</DeletedField>' : '');
  }
  const r = await tradingCall(at.token, 'ReviseFixedPriceItem', inner);
  const lectureApres=(post,raison)=>post.ok && memeRegle(post.lecture,demande,P)!==false?post.lecture:{lu:false,raison,lueA:Date.now(),observee:post.ok?post.lecture:null};
  const rangerPost=(post,raison)=>rangerReglesOffre(ctx,{[itemId]:{...lectureApres(post,raison),par:'regle',_force:true}});
  if (r.ok) {
    const post = await relireApres(at.token, itemId, demande, P);
    const range = await rangerPost(post, 'apres-ecriture');
    if (!post.ok) return { status: 200, body: { ok: true, verifie: null, lecture: null, avertissements: r.avertissements, erreurs: r.erreurs, range } };
    return { status: 200, body: { ok: true, verifie: memeRegle(post.lecture, demande, P), lecture: lectureApres(post,'apres-ecriture'), avertissements: r.avertissements, erreurs: r.erreurs, range, compte: ctx.compte.pseudo || '' } };
  }
  if (sansAck(r) || classeEchec(r) === 'incertain') {
    // Pas de réponse claire, ou panne d'eBay : il a peut-être écrit. On relit.
    const post = await relireApres(at.token, itemId, demande, P);
    const range = await rangerPost(post, 'incertain');
    if (post.ok && memeRegle(post.lecture, demande, P) === true) return { status: 200, body: { ok: true, verifie: true, apresIncertain: true, lecture: post.lecture, avertissements: r.avertissements || [], range } };
    if (post.ok) return { status: 504, body: { ok: false, reason: 'incertain', lecture: lectureApres(post,'incertain'), erreurs: r.erreurs, range, error: `eBay n'a pas répondu clairement. L'annonce montre aujourd'hui : ${etatEnClair(post.lecture)}. Relis-la dans un moment avant de recommencer.` } };
    return { status: 504, body: { ok: false, reason: 'incertain', erreurs: r.erreurs, range, error: 'eBay n\'a pas répondu clairement — je ne sais pas si la règle est posée. « Relire chez eBay » avant de recommencer.' } };
  }
  // RequestError : la requête est refusée, rien n'est appliqué. Une relecture
  // (sans attente) remplace le marqueur ; ratée ⇒ ce qu'on a lu avant.
  const post = await lireRegleOffre(at.token, itemId);
  await rangerReglesOffre(ctx, { [itemId]: { ...(post.ok ? post.lecture : P), par: 'regle', _force: true } });
  return { status: 422, body: { ok: false, reason: 'refus', error: messageEbaySur(r.err) || 'eBay a refusé la règle — rien n\'a changé.', erreurs: r.erreurs, lecture: post.ok ? post.lecture : P } };
}

// ── « RELIRE CHEZ eBAY » : la règle de 1 à 20 annonces, l'une après l'autre ─
async function handleRegleOffreLire(b, ctx) {
  const brut = b.itemIds;
  const ids = Array.isArray(brut) ? [...new Set(brut.map((x) => String(x == null ? '' : x).trim()))] : null;
  if (!ids || !ids.length || ids.length > 20 || ids.some((x) => !ID_EBAY.test(x))) return { status: 400, body: { ok: false, reason: 'annonces', error: 'Liste d\'annonces eBay invalide (1 à 20).' } };
  const at = await jetonDe(ctx);
  if (!at.ok) return { status: at.status || 502, body: { ok: false, reason: at.reason, error: at.error } };
  const tListe = Date.now();
  const L = await listeVendeur(at.token);
  if (!L.ok) return { status: 503, body: { ok: false, reason: 'pas-su', error: 'Je n\'ai pas pu relire tes annonces eBay — rien n\'a été relu.' } };
  const aMoi = new Set([...L.actives, ...L.programmees].map((x) => x.itemId));
  const rendu = {}, lectures = {};
  for (const id of ids) {
    if (!aMoi.has(id)) { rendu[id] = { lu: false, raison: L.complet ? 'pas-sur-ce-compte' : 'pas-su' }; continue; }
    const g = await lireRegleOffre(at.token, id);
    const attendue=b.attendues?.[id];
    const discordant=attendue && attenduOk(attendue) && g.ok && memeRegle(g.lecture,attendue,null)===false;
    const lecture=g.ok && !discordant?{...g.lecture,par:'relire'}:{lu:false,raison:discordant?'apres-ecriture':'lecture-ratee',lueA:Date.now(),par:'relire',...(discordant?{observee:g.lecture}:{})};
    rendu[id] = lectures[id] = lecture;
  }
  // (11 octobre, revue — tour 3) Une liste COMPLÈTE dit aussi quelles annonces
  // ne sont plus sur ce compte (terminées, vendues, déplacées) : leurs règles
  // sortent, avec la règle de la synchro (`garder` : seulement une entrée PLUS
  // ANCIENNE que la liste). Elles restaient rangées — l'écran les montrait « en
  // ligne », relisait sans fin, et la déconnexion les comptait encore.
  const garder = L.complet ? { ids: aMoi, a: tListe } : null;
  const range = (Object.keys(lectures).length || garder) ? await rangerReglesOffre(ctx, lectures, garder) : true;
  return { status: 200, body: { ok: true, lectures: rendu, range } };
}

// MODIFIER prix / stock d'une annonce existante (léger et sûr, prévu pour ça).
async function tradingReviseInventoryStatus(token, itemId, price, qty) {
  let inv = `<ItemID>${itemId}</ItemID>`;
  if (price != null && price !== '') inv += `<StartPrice>${Number(String(price).replace(',', '.')).toFixed(2)}</StartPrice>`;
  if (qty != null && qty !== '') inv += `<Quantity>${parseInt(qty, 10)}</Quantity>`;
  return tradingCall(token, 'ReviseInventoryStatus', `<InventoryStatus>${inv}</InventoryStatus>`);
}

// (9 octobre) Un changement de PRIX dit ce qu'il advient de la règle d'offre.
// `ReviseInventoryStatus` ne peut pas porter les seuils, et ce qu'eBay en fait
// n'est pas documenté (les effacer, les garder, ou refuser le prix : 23004).
// On relit après, et on dit ce qu'on voit — jamais d'avance « eBay la retire ».
// Une modification de stock seul ne touche à rien de tout ça.
async function handleRevise(b, ctx) {
  const itemId = String(b.itemId || '').trim();
  if (!/^\d+$/.test(itemId)) return { status: 400, body: { ok: false, error: 'itemId invalide' } };
  if ((b.price == null || b.price === '') && (b.quantity == null || b.quantity === '')) return { status: 400, body: { ok: false, error: 'rien à modifier' } };
  const at = await jetonDe(ctx);
  if (!at.ok) return { status: at.status || 502, body: { ok: false, reason: at.reason, error: at.error } };
  const prixChange = !(b.price == null || b.price === '');
  let avant = undefined, aRegle = false;
  if (prixChange) {
    const ligne = await lireDonnee(ligneDe('ebay_offres', ctx), ctx.owner);
    avant = ligne === undefined ? undefined : ((ligne && ligne.items && ligne.items[itemId]) || null);
    aRegle = !!(avant && avant.lu === true && (avant.accepte != null || avant.refuse != null));
    // Une annonce à règle connue : le marqueur AVANT de toucher au prix.
    if (aRegle) {
      const m = await rangerReglesOffre(ctx, { [itemId]: { lu: false, raison: 'en-cours', lueA: Date.now(), par: 'revise', _force: true } });
      if (m !== true) return { status: 503, body: { ok: false, reason: 'note', error: 'Je n\'ai pas pu le noter dans VRM — rien n\'a été envoyé à eBay. Réessaie dans un moment.' } };
    }
  }
  const r = await tradingReviseInventoryStatus(at.token, itemId, b.price, b.quantity);
  // Sans <Ack> (réseau coupé, passerelle 5xx), eBay n'a rien dit : le prix a pu
  // changer. « Incertain », jamais « refusé » (revue du 6 octobre — le reste
  // de la route l'avait appris, `revise` non).
  if (sansAck(r)) {
    if (prixChange && avant && typeof avant === 'object') await rangerReglesOffre(ctx, { [itemId]: { lu: false, raison: 'incertain', lueA: Date.now(), par: 'revise', _force: aRegle } });
    return { status: 504, body: { ok: false, reason: 'incertain', error: 'eBay n\'a pas répondu clairement — je ne sais pas si le prix a changé. Regarde l\'annonce sur eBay avant de recommencer.' } };
  }
  // Trading renvoie HTTP 200 même sur refus (erreur dans le corps) → vrai code 422.
  if (!r.ok) {
    if (aRegle) {
      const post = await lireRegleOffre(at.token, itemId);
      await rangerReglesOffre(ctx, { [itemId]: post.ok ? { ...post.lecture, par: 'revise', _force: true } : (classeEchec(r) === 'refus' ? { ...avant, _force: true } : { lu: false, raison: 'incertain', lueA: Date.now(), par: 'revise', _force: true }) });
    }
    return { status: r.status >= 400 ? r.status : 422, body: { ok: false, error: r.err || 'eBay a refusé la modification', ack: r.ack, erreurs: r.erreurs } };
  }
  if (!prixChange) return { status: 200, body: { ok: true, ack: r.ack } };
  const post = await lireRegleOffre(at.token, itemId);
  await rangerReglesOffre(ctx, { [itemId]: post.ok ? { ...post.lecture, par: 'revise', _force: aRegle } : (!aRegle && avant?.lu===true?{...avant,par:'revise'}:{lu:false,raison:'apres-ecriture',lueA:Date.now(),par:'revise',_force:aRegle}) });
  return { status: 200, body: { ok: true, ack: r.ack, avertissements: r.avertissements, erreurs: r.erreurs,
    regle: {
      lecture: post.ok ? post.lecture : null,
      // « pas su » ne devient jamais « pas tombée ».
      tombee: aRegle ? (post.ok ? (avant.accepte!=null && post.lecture.accepte==null) || (avant.refuse!=null && post.lecture.refuse==null) : null) : ((avant && avant.lu === true) ? false : null),
      avant: aRegle ? { accepte: avant.accepte, refuse: avant.refuse } : null,
    } } };
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
    // (9 octobre) La RÈGLE D'OFFRE d'une nouvelle annonce : c'est eBay qui
    // accepte au seuil fixé. ⚠️ Posée par la route (`regleDeItem`), validée
    // contre le prix — jamais recopiée du navigateur (`avecSku` la jette).
    // Sans règle : RIEN n'est émis, le XML est celui d'avant au caractère près.
    (it.regleOffre
      ? '<BestOfferDetails><BestOfferEnabled>true</BestOfferEnabled></BestOfferDetails>'
        + `<ListingDetails><BestOfferAutoAcceptPrice currencyID="EUR">${montantXml(it.regleOffre.accepte)}</BestOfferAutoAcceptPrice>`
        + (it.regleOffre.refuse != null ? `<MinimumBestOfferPrice currencyID="EUR">${montantXml(it.regleOffre.refuse)}</MinimumBestOfferPrice>` : '')
        + '</ListingDetails>'
      : '') +
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
  const propre = { ...it, scheduleTime: '', uuid: '', regleOffre: null };
  if (!brut) return { item: { ...propre, sku: '' } };
  const sku = skuDe(brut);
  if (!sku) return { err: 'Numéro de paire illisible : rien n\'a été envoyé à eBay.' };
  return { item: { ...propre, sku } };
}
// La règle d'offre d'une NOUVELLE annonce (`item.offre`), validée par la
// route contre le prix de l'item (l'annonce n'existe pas encore chez eBay).
// Rend `{regle}` (null = aucune) ou `{err, reason?}` : rien ne part.
function regleDeItem(it0) {
  const o = it0 ? it0.offre : undefined;
  if (o === undefined || o === null) return { regle: null };
  if (typeof o !== 'object' || Array.isArray(o)) return { err: 'Règle d\'offre mal formée : rien n\'a été envoyé à eBay.' };
  const prix = Number(String(it0.price).replace(',', '.'));
  if (!Number.isFinite(prix) || !(prix > 0)) return { err: 'Règle d\'offre : le prix de l\'annonce est illisible. Rien n\'a été envoyé à eBay.' };
  const v = valideRegleOffre({ accepte: o.accepte === undefined ? null : o.accepte, refuse: o.refuse === undefined ? null : o.refuse, prix });
  if (!v.ok) return { err: 'Règle d\'offre : ' + v.err + ' Rien n\'a été envoyé à eBay.' };
  if (v.accepte != null && seuilTropBas(v.accepte, prix) && o.sousMoitie !== true) return { err: 'Règle d\'offre : moins de la moitié du prix, et pas confirmé. Rien n\'a été envoyé à eBay.', reason: 'sous-moitie' };
  return { regle: v.accepte == null ? null : { accepte: v.accepte, refuse: v.refuse == null ? null : v.refuse } };
}
// La paire (son SKU) est-elle DÉJÀ sur eBay, en ligne ou programmée ? Rend la
// réponse de refus à renvoyer, ou null si elle n'y est pas. Liste illisible ou
// incomplète ⇒ refus « pas su » : une absence non prouvée ne laisse rien partir.
// ⚠️⚠️ SUR TOUS SES COMPTES eBAY (9 octobre) : une paire en vente — ou
// programmée — sur N'IMPORTE lequel de ses comptes ne part pas sur un autre.
// Chaque compte actif est relu CHEZ eBAY, avec SON jeton ; « pas su » sur UN
// seul (jeton mort, eBay muet, registre illisible) ⇒ rien ne part, et la
// réponse nomme le compte qui manque.
async function comptesAVerifier(ctx, tokenCourant) {
  const cloison = await baseCloisonnee();
  if (!cloison) return { ok: true, liste: [{ compte: ctx.compte, token: tokenCourant }] };
  const reg = await lireComptes(ctx.owner);
  if (reg === undefined) return { ok: false, err: { status: 503, body: { ok: false, reason: 'pas-su', error: 'Je n\'ai pas pu relire la liste de tes comptes eBay pour vérifier que cette paire n\'y est pas déjà — rien n\'a été envoyé.' } } };
  const liste = [];
  for (const c of comptesActifs(reg)) {
    const memeQueCourant = c.suffixe === (ctx.compte.suffixe || '');
    if (memeQueCourant) { liste.push({ compte: { ...ctx.compte, pseudo: ctx.compte.pseudo || c.pseudo }, token: tokenCourant }); continue; }
    // Le principal sous-entendu n'est un compte que s'il est relié.
    if (c.implicite) {
      const has = await hasRefresh(ctx.owner, '');
      if (has === null) return { ok: false, err: { status: 503, body: { ok: false, reason: 'pas-su', error: PAS_SU_LISTE } } };
      if (!has) continue;
    }
    const at = await accessToken(ctx.owner, c.suffixe);
    if (!at.ok) return { ok: false, err: { status: 503, body: { ok: false, reason: 'pas-su', compte: c.pseudo || '', error: `Je n'ai pas pu relire ton compte eBay ${nomCompte(c) || 'principal'} pour vérifier que cette paire n'y est pas déjà — rien n'a été envoyé. Reconnecte-le, ou déconnecte-le s'il n'est plus à toi.` } } };
    liste.push({ compte: c, token: at.token });
  }
  return { ok: true, liste };
}
async function dejaChezEbay(ctx, tokenCourant, sku, verbe, mk) {
  const v = await comptesAVerifier(ctx, tokenCourant);
  if (!v.ok) return v.err;
  const plusieurs = v.liste.length > 1;
  const voulu=numDeSku(sku);
  const meme=x=>!!voulu && numeroExterne(numDeSku(x.sku),x.itemId,'ebayAnnonces',null,mk)===voulu;
  for (const { compte, token } of v.liste) {
    const ou = plusieurs && nomCompte(compte) ? ` (compte eBay ${nomCompte(compte)})` : '';
    const L = await listeVendeur(token);
    if (!L.ok) return { status: 503, body: { ok: false, reason: 'pas-su', compte: compte.pseudo || '', error: plusieurs ? `Je n'ai pas pu relire tes annonces du compte eBay ${nomCompte(compte) || 'principal'} pour vérifier que cette paire n'y est pas déjà — rien n'a été envoyé.` : PAS_SU_LISTE } };
    if (!L.complet) return { status: 503, body: { ok: false, reason: 'pas-su', compte: compte.pseudo || '', error: `Tu as plus de 1 000 annonces sur eBay${ou} : je n'ai pas pu toutes les relire pour vérifier que cette paire n'y est pas déjà — rien n'a été envoyé.` } };
    const prog = L.programmees.find(meme);
    if (prog) return { status: 409, body: { ok: false, reason: 'deja-programmee', itemId: prog.itemId, compte: compte.pseudo || '', autreCompte: compte.suffixe !== (ctx.compte.suffixe || ''), debut: prog.depuis || null, error: `La paire ${sku} est déjà programmée sur eBay${ou}${prog.depuis ? ' (' + prog.depuis + ')' : ''} — rien n'a été ${verbe}.` } };
    const act = L.actives.find(meme);
    if (act) return { status: 409, body: { ok: false, reason: 'deja-en-ligne', itemId: act.itemId, compte: compte.pseudo || '', autreCompte: compte.suffixe !== (ctx.compte.suffixe || ''), error: `La paire ${sku} est déjà en vente sur eBay${ou} — rien n'a été ${verbe}.` } };
  }
  return null;
}
// LA NUMÉROTATION DE CE VENDEUR (migration 013), relue au moment d'écrire chez
// eBay. Trois états : `{ok:true, mk:null}` aucune remise à zéro · `{ok:true, mk}`
// · `{ok:false}` pas su (on n'écrit rien : la paire « 22 » n'a pas le même sens
// avant et après la coupure).
async function numerotationVendeur(owner) {
  const t = await lireReglageVendeur('vrm_numerotation', owner);
  if (t === undefined) return { ok: false };
  if (!t) return { ok: true, mk: null };
  try { const o = JSON.parse(t); return o && typeof o === 'object' && !Array.isArray(o) ? { ok: true, mk: o } : { ok: false }; } catch (_) { return { ok: false }; }
}
// Un écran ouvert AVANT la remise à zéro publie sous ses numéros d'avant
// (« 553 », devenu 3) : le SKU désignerait une AUTRE paire. L'app envoie la
// version de numérotation qu'elle a lue ; celle de la base fait foi.
function numerotationRefus(b, num) {
  if (!num.ok) return { status: 503, body: { ok: false, reason: 'numerotation-pas-su', error: 'Je n\'ai pas pu relire ta numérotation — rien n\'a été envoyé à eBay.' } };
  const v = num.mk && Number.isFinite(Number(num.mk.version)) ? Number(num.mk.version) : null;
  if (v != null && Number(b.numerotation) !== v) return { status: 409, body: { ok: false, reason: 'numerotation-perimee', error: 'Cet écran a été ouvert avant la remise à zéro de tes numéros : recharge-le — rien n\'a été envoyé à eBay.' } };
  return null;
}
async function handlePublish(b, ctx) {
  const it0 = b.item || {};
  if (!it0.title || !it0.categoryId || it0.price == null || it0.price === '') return { status: 400, body: { ok: false, error: 'titre, catégorie et prix requis' } };
  const s = avecSku(it0);
  if (s.err) return { status: 400, body: { ok: false, reason: 'numero', error: s.err } };
  const ro = regleDeItem(it0);
  if (ro.err) return { status: 400, body: { ok: false, reason: ro.reason || 'offre', error: ro.err } };
  const it = { ...s.item, regleOffre: ro.regle };
  let num={ok:true,mk:null};
  if(it.sku){num=await numerotationVendeur(ctx.owner);const ref=numerotationRefus(b,num);if(ref)return ref;}
  const at = await jetonDe(ctx);
  if (!at.ok) return { status: at.status || 502, body: { ok: false, reason: at.reason, error: at.error } };
  // ── UNE PAIRE, UNE ANNONCE (la règle de `programmer`, 6 octobre). Publier
  // n'avait AUCUNE garde : une paire déjà en vente, ou programmée pour ce
  // soir, repartait en seconde annonce (prouvé : deux annonces VRM-30). Relue
  // chez eBay, en ligne ET programmées ; sans SKU, rien à comparer.
  if (it.sku) {
    const deja = await dejaChezEbay(ctx, at.token, it.sku, 'publié', num.mk);
    if (deja) return deja;
  }
  const r = await tradingAddFixedPriceItem(at.token, it);
  if (sansAck(r)) return { status: 504, body: { ok: false, reason: 'incertain', error: 'eBay n\'a pas répondu clairement — je ne sais pas si l\'annonce a été créée. Rafraîchis depuis eBay avant de recommencer.' } };
  // ⚠️ L'API Trading renvoie HTTP 200 même sur un refus (l'erreur est dans le
  // corps, Ack=Failure). On répond donc un vrai code d'échec (422) dans ce cas.
  if (!r.ok || !r.itemId) return { status: r.status >= 400 ? r.status : 422, body: { ok: false, error: r.err || 'eBay a refusé la publication', ack: r.ack } };
  // (9 octobre) Publiée AVEC une règle d'offre : on relit chez eBay ce qu'il en
  // a gardé (une catégorie qui n'accepte pas le seuil le perd sans refuser
  // l'annonce [non mesuré]). Sans règle : aucun appel de plus.
  let offre;
  if (it.regleOffre && ID_EBAY.test(String(r.itemId))) {
    const demande = { accepte: it.regleOffre.accepte, refuse: it.regleOffre.refuse };
    const post = await lireRegleOffre(at.token, String(r.itemId));
    const range = await rangerReglesOffre(ctx, { [String(r.itemId)]: post.ok && memeRegle(post.lecture,demande,null)!==false?{...post.lecture,par:'publication'}:{lu:false,raison:'apres-ecriture',lueA:Date.now(),par:'publication',observee:post.ok?post.lecture:null} });
    offre = { envoyee: demande, verifie: post.ok ? memeRegle(post.lecture, demande, null) : null, lecture: post.ok ? post.lecture : null, range: range === true };
  }
  return { status: 200, body: { ok: true, itemId: r.itemId, url: `https://www.ebay.fr/itm/${r.itemId}`, sku: it.sku || null, compte: ctx.compte.pseudo || '', avertissements: r.avertissements, ...(offre ? { offre } : {}) } };
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
async function handleVerify(b, ctx) {
  const it0 = b.item || {};
  if (!it0.title || !it0.categoryId || it0.price == null || it0.price === '') return { status: 400, body: { ok: false, error: 'titre, catégorie et prix requis' } };
  // Le MÊME payload que la publication (§11) : SKU compris.
  const s = avecSku(it0);
  if (s.err) return { status: 400, body: { ok: false, reason: 'numero', error: s.err } };
  const ro = regleDeItem(it0);
  if (ro.err) return { status: 400, body: { ok: false, reason: ro.reason || 'offre', error: ro.err } };
  let quand = '';
  if (b.scheduleTime != null && b.scheduleTime !== '') {
    quand = heureProgrammation(b.scheduleTime);
    if (!quand) return { status: 400, body: { ok: false, reason: 'heure', error: 'Heure de mise en ligne refusée : entre 15 minutes et 3 semaines à l\'avance.' } };
  }
  const it = { ...s.item, regleOffre: ro.regle, scheduleTime: quand };
  const at = await jetonDe(ctx);
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
async function handleProgrammer(b, ctx) {
  if (b.confirme !== true) return { status: 400, body: { ok: false, reason: 'confirmation', error: 'Confirme la programmation : rien n\'a été envoyé à eBay.' } };
  const it0 = b.item || {};
  if (!it0.title || !it0.categoryId || it0.price == null || it0.price === '' || !ETAT_OK.test(String(it0.conditionId || ''))) {
    return { status: 400, body: { ok: false, reason: 'champs', error: 'Titre, catégorie, prix et état sont nécessaires : rien n\'a été envoyé.' } };
  }
  const s = avecSku(it0);
  if (s.err || !s.item.sku) return { status: 400, body: { ok: false, reason: 'numero', error: 'Pour programmer, la paire doit avoir son N° : sans lui, VRM ne saurait pas la retrouver si elle se vend ailleurs avant l\'heure.' } };
  const ro = regleDeItem(it0);
  if (ro.err) return { status: 400, body: { ok: false, reason: ro.reason || 'offre', error: ro.err } };
  let quand = '';
  if (b.scheduleTime != null && b.scheduleTime !== '') {
    quand = heureProgrammation(b.scheduleTime);
    if (!quand) return { status: 400, body: { ok: false, reason: 'heure', error: 'Heure de mise en ligne refusée : entre 15 minutes et 3 semaines à l\'avance. Replanifie-la.' } };
  }
  const uuid = String(b.uuid || '');
  if (!UUID_EBAY.test(uuid)) return { status: 400, body: { ok: false, reason: 'uuid', error: 'Envoi mal formé (identifiant d\'envoi) : rien n\'a été envoyé.' } };
  const fraisVus = typeof b.fraisVus === 'number' ? b.fraisVus : NaN;
  if (!(Number.isFinite(fraisVus) && fraisVus >= 0)) return { status: 400, body: { ok: false, reason: 'frais-vus', error: 'Vérifie d\'abord les frais : rien n\'a été envoyé.' } };
  const it = { ...s.item, regleOffre: ro.regle, scheduleTime: quand };
  const num=await numerotationVendeur(ctx.owner);
  {const ref=numerotationRefus(b,num);if(ref)return ref;}
  const at = await jetonDe(ctx);
  if (!at.ok) return { status: at.status || 502, body: { ok: false, reason: at.reason, error: at.error } };
  // ── UNE PAIRE, UNE ANNONCE : relue chez eBay, maintenant, sur TOUS ses
  // comptes (une liste INCOMPLÈTE ne prouve pas l'absence : on ne programme pas).
  const deja = await dejaChezEbay(ctx, at.token, it.sku, 'envoyé', num.mk);
  if (deja) return deja;
  // ── LES FRAIS, revérifiés juste avant (sans UUID). ──
  const v = await tradingVerifyAddFixedPriceItem(at.token, it);
  if (v.status === 0) return { status: 503, body: { ok: false, error: 'eBay injoignable — rien n\'a été envoyé.' } };
  if (!v.ok) return { status: 200, body: { ok: false, etape: 'verif', error: v.err || 'eBay refuserait cette annonce.', erreurs: v.erreurs } };
  if (v.frais.total == null) return { status: 502, body: { ok: false, reason: 'frais-pas-su', error: 'eBay n\'a pas annoncé ses frais — je ne programme rien sans les connaître. Revérifie.' } };
  if (v.frais.total > fraisVus + 0.005) return { status: 409, body: { ok: false, reason: 'frais', frais: v.frais, fraisVus, error: `Les frais ont changé depuis ta vérification (${v.frais.total.toFixed(2)} € au lieu de ${fraisVus.toFixed(2)} €) — rien n'a été envoyé.` } };
  // ── L'AJOUT, avec l'UUID (un second envoi ne crée pas une seconde annonce). ──
  const a = await tradingAddFixedPriceItem(at.token, { ...it, uuid });
  if (sansAck(a)) return { status: 504, body: { ok: false, reason: 'incertain', uuid, error: 'eBay n\'a pas répondu à temps — je ne sais pas si elle est programmée. VRM relit tes annonces eBay avant de redemander quoi que ce soit.' } };
  if (!a.ok) {
    if ((a.erreurs || []).some((e) => e.code === '488')) {
      // Le même envoi a DÉJÀ créé l'annonce (un premier essai resté sans
      // réponse) : sa règle n'a donc jamais été rangée — on la range maintenant.
      const d = await confirmerDoublon(at.token, a, it, quand);
      if (d.status === 200 && d.body && d.body.ok && it.regleOffre) d.body.offre = await rangerRegleProgrammee(ctx, at.token, d.body, it, quand);
      return d;
    }
    return { status: 422, body: { ok: false, error: a.err || 'eBay a refusé l\'annonce.', erreurs: a.erreurs } };
  }
  if (!ID_EBAY.test(a.itemId)) return { status: 502, body: { ok: false, reason: 'incertain', uuid, error: 'eBay a répondu sans numéro d\'annonce — je ne sais pas si elle est programmée. Rafraîchis depuis eBay avant de recommencer.' } };
  const corps = resultatProgramme(a.itemId, it, quand, a.debut, a.fin, { frais: v.frais, compte: ctx.compte.pseudo || '', avertissements: a.avertissements });
  if (it.regleOffre) corps.offre = await rangerRegleProgrammee(ctx, at.token, corps, it, quand);
  return { status: 200, body: corps };
}
// ⚠️⚠️ (11 octobre, revue — tour 3) UNE ANNONCE PROGRAMMÉE PART AVEC SA RÈGLE
// D'OFFRE : VRM la RANGE comme une publication. Elle n'était ni rangée ni
// relue — même mise en ligne « Maintenant » : une fois partie, l'annonce
// sortait des programmées sans entrer dans Annonces, son seuil (que VRM venait
// lui-même d'envoyer) n'était plus visible nulle part, et les ventes eBay
// n'étaient pas relues à l'ouverture (aucune règle connue). Deux cas :
//   · en ligne MAINTENANT (pas d'heure, ou eBay a ignoré l'heure) : relue
//     chez eBay et rangée, exactement comme `publish` (`par: 'programmation'`) ;
//   · programmée pour plus tard : rangée « programmee » avec ce qui a été
//     ENVOYÉ — l'app la compte comme une règle que eBay tiendra peut-être
//     (relecture des ventes, déconnexion, fermeture) ; la synchro qui suit son
//     départ la relit (lecture plus récente : elle remplace).
// Rend l'objet `offre` de la réponse : `envoyee`, et `verifie`/`lecture` (en
// ligne) ou `programmee: true` ; `range` dit si VRM a pu le noter.
async function rangerRegleProgrammee(ctx, token, corps, it, quand) {
  const envoyee = { accepte: it.regleOffre.accepte, refuse: it.regleOffre.refuse };
  const id = String(corps.itemId);
  if (!ID_EBAY.test(id)) return { envoyee };
  if (!quand || corps.enLigneMaintenant) {
    const post = await lireRegleOffre(token, id);
    const range = await rangerReglesOffre(ctx, { [id]: post.ok && memeRegle(post.lecture,envoyee,null)!==false?{...post.lecture,par:'programmation'}:{lu:false,raison:'apres-ecriture',lueA:Date.now(),par:'programmation',observee:post.ok?post.lecture:null} });
    return { envoyee, verifie: post.ok ? memeRegle(post.lecture, envoyee, null) : null, lecture: post.ok ? post.lecture : null, range: range === true };
  }
  const range = await rangerReglesOffre(ctx, { [id]: { lu: false, raison: 'programmee', accepte: envoyee.accepte, refuse: envoyee.refuse == null ? null : envoyee.refuse, debut: corps.debut || quand, lueA: Date.now(), par: 'programmation' } });
  return { envoyee, programmee: true, range: range === true };
}
// Une annonce TERMINÉE (retirée, programmation annulée) sort aussi des règles
// rangées : sinon, jusqu'à la prochaine synchro, la déconnexion et « Fermer mon
// compte » comptaient une règle qu'eBay n'applique plus. Lire-fusionner-réécrire
// gardé (compare-et-échange) : une lecture ratée n'écrit rien — true · false · null.
async function sortirDesRegles(itemId, ctx) {
  return modifierDonnee(ligneDe('ebay_offres', ctx), ctx.owner, (d) => {
    const items = (d && d.items && typeof d.items === 'object' && !Array.isArray(d.items)) ? d.items : null;
    if (!items || !Object.prototype.hasOwnProperty.call(items, itemId)) return undefined;
    const { [itemId]: _parti, ...reste } = items;
    return { ...d, items: reste, capturedAt: Date.now() };
  });
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
async function handleProgrammees(ctx) {
  const at = await jetonDe(ctx);
  if (!at.ok) return { status: at.status || 502, body: { ok: false, reason: at.reason, error: at.error } };
  const L = await listeVendeur(at.token);
  if (!L.ok) return { status: L.status || 502, body: { ok: false, error: L.error || 'eBay n\'a pas rendu tes annonces programmées.' } };
  const items = L.programmees.map(resumeProgrammee);
  const enLigne = L.actives.map((x) => ({ itemId: x.itemId, sku: x.sku }));
  const range = await storeData(ligneDe('ebay_programmees', ctx), { items, enLigne, complet: L.complet, capturedAt: Date.now() }, ctx.owner);
  return { status: 200, body: { ok: true, items, enLigne, complet: L.complet, range } };
}

// ── ANNULER UNE PROGRAMMATION (Trading EndFixedPriceItem) ────────────────────
// ⚠️⚠️ NON PROUVÉ : rien dans la doc d'eBay ne dit qu'EndFixedPriceItem accepte
// une annonce pas encore commencée. On ESSAIE, et on rend la réponse d'eBay
// TELLE QUELLE — sur un refus, l'écran envoie l'annuler dans le Seller Hub.
// Elle n'agit QUE sur une annonce présente dans la liste des programmées
// relue à l'instant : une annonce déjà en ligne va à « Retirer d'eBay ».
async function handleDeprogrammer(b, ctx) {
  if (b.confirme !== true) return { status: 400, body: { ok: false, reason: 'confirmation', error: 'Confirme l\'annulation : rien n\'a été envoyé à eBay.' } };
  const itemId = String(b.itemId || '').trim();
  if (!ID_EBAY.test(itemId)) return { status: 400, body: { ok: false, error: 'annonce eBay invalide' } };
  const at = await jetonDe(ctx);
  if (!at.ok) return { status: at.status || 502, body: { ok: false, reason: at.reason, error: at.error } };
  const L = await listeVendeur(at.token);
  if (!L.ok) return { status: 503, body: { ok: false, reason: 'pas-su', error: 'Je n\'ai pas pu relire tes annonces programmées — rien n\'a été envoyé.' } };
  if (!L.programmees.some((x) => x.itemId === itemId)) {
    const enLigne = L.actives.some((x) => x.itemId === itemId);
    return { status: 409, body: { ok: false, reason: 'pas-programmee', enLigne, error: enLigne ? 'Elle n\'est plus programmée : elle est déjà en ligne — utilise « Retirer d\'eBay ».' : 'eBay ne la compte plus parmi tes annonces programmées.' } };
  }
  const r = await tradingCall(at.token, 'EndFixedPriceItem', `<ItemID>${itemId}</ItemID><EndingReason>NotAvailable</EndingReason>`);
  if (sansAck(r)) return { status: 504, body: { ok: false, reason: 'incertain', error: 'eBay n\'a pas répondu — je ne sais pas si la programmation est annulée. Regarde sur eBay avant de recommencer.' } };
  if (!r.ok) return { status: 422, body: { ok: false, reason: 'refus', error: r.err || 'eBay a refusé l\'annulation.', erreurs: r.erreurs } };
  const L2 = await listeVendeur(at.token);
  if (!L2.ok) return { status: 200, body: { ok: true, verifie: null } };
  if (L2.programmees.some((x) => x.itemId === itemId)) return { status: 409, body: { ok: false, reason: 'toujours-programmee', error: 'eBay a répondu « fait », mais elle est toujours programmée chez lui. Annule-la dans le Seller Hub.' } };
  if (L2.actives.some((x) => x.itemId === itemId)) return { status: 409, body: { ok: false, reason: 'en-ligne', error: 'Elle est maintenant EN LIGNE sur eBay — retire-la avec « Retirer d\'eBay ».' } };
  // Plus programmée, pas en ligne : sa règle (rangée « programmee ») sort aussi.
  const regles = await sortirDesRegles(itemId, ctx);
  return { status: 200, body: { ok: true, verifie: true, regles: regles === true } };
}

// ── DÉPLACER UNE PROGRAMMATION (Trading ReviseFixedPriceItem + ScheduleTime) ─
// Documenté pour ReviseItem « tant que l'heure prévue est dans le futur » ;
// le Seller Hub verrouille la DERNIÈRE HEURE : on refuse donc à moins d'1 h du
// départ (relu chez eBay, pas d'après l'écran). L'heure retenue est relue.
const DERNIERE_HEURE_MS = 60 * 60 * 1000;
async function handleReprogrammer(b, ctx) {
  if (b.confirme !== true) return { status: 400, body: { ok: false, reason: 'confirmation', error: 'Confirme le changement d\'heure : rien n\'a été envoyé à eBay.' } };
  const itemId = String(b.itemId || '').trim();
  if (!ID_EBAY.test(itemId)) return { status: 400, body: { ok: false, error: 'annonce eBay invalide' } };
  const quand = heureProgrammation(b.scheduleTime);
  if (!quand) return { status: 400, body: { ok: false, reason: 'heure', error: 'Nouvelle heure refusée : entre 15 minutes et 3 semaines à l\'avance.' } };
  const at = await jetonDe(ctx);
  if (!at.ok) return { status: at.status || 502, body: { ok: false, reason: at.reason, error: at.error } };
  const L = await listeVendeur(at.token);
  if (!L.ok) return { status: 503, body: { ok: false, reason: 'pas-su', error: 'Je n\'ai pas pu relire tes annonces programmées — rien n\'a été envoyé.' } };
  const p = L.programmees.find((x) => x.itemId === itemId);
  if (!p) return { status: 409, body: { ok: false, reason: 'pas-programmee', error: 'eBay ne la compte plus parmi tes annonces programmées.' } };
  const debut = Date.parse(p.depuis || '');
  if (!Number.isFinite(debut)) return { status: 409, body: { ok: false, reason: 'heure-inconnue', error: 'eBay ne dit pas à quelle heure elle part — je ne la déplace pas.' } };
  if (debut - Date.now() < DERNIERE_HEURE_MS) return { status: 409, body: { ok: false, reason: 'derniere-heure', error: 'Elle part dans moins d\'une heure : eBay ne permet plus de la déplacer.' } };
  const r = await tradingCall(at.token, 'ReviseFixedPriceItem', `<Item><ItemID>${itemId}</ItemID><ScheduleTime>${quand}</ScheduleTime></Item>`);
  if (sansAck(r)) return { status: 504, body: { ok: false, reason: 'incertain', error: 'eBay n\'a pas répondu — je ne sais pas si l\'heure a changé. Rafraîchis avant de recommencer.' } };
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
async function handleLimites(ctx) {
  const at = await jetonDe(ctx);
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
async function handleSku(b, ctx) {
  const itemId = String(b.itemId || '').trim();
  if (!ID_EBAY.test(itemId)) return { status: 400, body: { ok: false, error: 'annonce eBay invalide' } };
  const sku = skuDe(b.numero);
  if (!sku) return { status: 400, body: { ok: false, reason: 'numero', error: 'Numéro de paire illisible (125, ou B125) : rien n\'a été envoyé à eBay.' } };
  // (relecture du 11 octobre) Une annonce qui portait « VRM-12 » à la remise à
  // zéro désigne l'ANCIENNE paire B12 tant qu'elle porte ce SKU. La relier à la
  // NOUVELLE 12 réécrirait le MÊME texte : rien ne permettrait plus de les
  // distinguer, et le retrait automatique terminerait l'annonce d'une paire
  // qu'il a encore (ou celle d'une autre). On refuse, et on dit pourquoi.
  { const num = await numerotationVendeur(ctx.owner);
    if (!num.ok) return { status: 503, body: { ok: false, reason: 'numerotation-pas-su', error: 'Je n\'ai pas pu relire ta numérotation — rien n\'a été envoyé à eBay.' } };
    const voulu = numDeSku(sku);
    if (num.mk && /^\d+$/.test(voulu) && numeroExterne(voulu, itemId, 'ebayAnnonces', null, num.mk) !== voulu) {
      return { status: 409, body: { ok: false, reason: 'numero-ambigu', error: `Cette annonce eBay portait déjà « ${sku} » à la remise à zéro de tes numéros : elle désigne l'ANCIENNE paire. Pour la nouvelle ${voulu}, termine cette annonce et republie la paire — rien n'a été envoyé à eBay.` } };
    } }
  const at = await jetonDe(ctx);
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
async function handleOffreInfo(ctx) {
  const at = await jetonDe(ctx);
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
async function handleOffre(b, ctx) {
  // ⚠️ Une offre acceptée VEND la paire : sans confirmation explicite, rien ne
  //    part — pas même la vérification chez eBay.
  if (b.confirme !== true) return { status: 400, body: { ok: false, reason: 'confirmation', error: 'Confirme l\'envoi de l\'offre : rien n\'a été envoyé.' } };
  const listingId = String(b.listingId || '').trim();
  if (!ID_EBAY.test(listingId)) return { status: 400, body: { ok: false, error: 'annonce eBay invalide' } };
  const remise = Number(b.remise);
  if (!Number.isInteger(remise) || remise < 5 || remise > 50) return { status: 400, body: { ok: false, reason: 'remise', error: 'La remise doit être un nombre entier entre 5 et 50 %.' } };
  const message = texteOffre(b.message);
  if (message === null) return { status: 400, body: { ok: false, reason: 'message', error: 'Message trop long (2 000 caractères au plus).' } };
  const at = await jetonDe(ctx);
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
// ── RETRAIT AUTOMATIQUE (proposition 8, 6 octobre) ─────────────────────────
// Julien l'a accepté « à activer toi-même ». L'app ne l'envoie (`auto:true`)
// que si son interrupteur est allumé ; la route le RE-VÉRIFIE dans SA ligne
// `main` (« pas su » ⇒ rien n'est envoyé), puis demande à eBay le SKU de
// l'annonce : il doit être EXACTEMENT celui de la paire vendue (`VRM-{n°}`,
// une identité, §5). Un SKU changé entre-temps ⇒ rien n'est retiré.
// Chaque retrait automatique est noté (`ebay_retraits_auto`) : il peut relire
// ce qui a été fait en son nom.
const SKU_PAIRE = /^VRM[-\s]?[A-Z]{0,3}\d{1,6}$/i;
// Retire une annonce de la liste rangée `ebay_listings`. Trois issues : true
// (retirée), false (l'écriture a échoué), null (pas su : lecture ratée, ou
// aucune liste rangée) — on n'écrit jamais depuis une lecture ratée.
async function sortirDesAnnonces(itemId, ctx) {
  const id = ligneDe('ebay_listings', ctx);
  const d = await lireDonnee(id, ctx.owner);
  if (d === undefined || !d || !Array.isArray(d.items)) return null;
  if (!d.items.some((x) => x && String(x.itemId) === itemId)) return true;
  return storeData(id, { ...d, items: d.items.filter((x) => !(x && String(x.itemId) === itemId)) }, ctx.owner);
}
async function handleRetirer(b, ctx) {
  if (b.confirme !== true) return { status: 400, body: { ok: false, reason: 'confirmation', error: 'Confirme le retrait : rien n\'a été envoyé à eBay.' } };
  const itemId = String(b.itemId || '').trim();
  if (!ID_EBAY.test(itemId)) return { status: 400, body: { ok: false, error: 'annonce eBay invalide' } };
  const auto = b.auto === true;
  const skuAttendu = String(b.sku || '').trim();
  let marqueur = null;
  if (auto) {
    if (!SKU_PAIRE.test(skuAttendu)) return { status: 400, body: { ok: false, reason: 'sku', error: 'Retrait automatique : la paire n\'est pas identifiée par son SKU (VRM-n°) — rien n\'a été envoyé à eBay.' } };
    const v = await lireReglageVendeur('vrm_ebay_retrait_auto', ctx.owner);
    if (v === undefined) return { status: 503, body: { ok: false, reason: 'reglage-pas-su', error: 'Je n\'ai pas pu relire ton réglage de retrait automatique — rien n\'a été envoyé à eBay.' } };
    if (v !== 'true') return { status: 403, body: { ok: false, reason: 'auto-eteint', error: 'Le retrait automatique est éteint — rien n\'a été envoyé à eBay.' } };
    // La remise à zéro des numéros (migration 013) : l'annonce qui portait un
    // ancien numéro à la coupure parle de l'ANCIENNE paire. Le marqueur est relu
    // chez CE vendeur ; illisible ⇒ rien n'est retiré (pas su ne vaut pas
    // « aucune coupure » : la vente de la nouvelle 230 retirerait l'annonce de
    // l'ancienne 230).
    const mkTxt = await lireReglageVendeur('vrm_numerotation', ctx.owner);
    if (mkTxt === undefined) return { status: 503, body: { ok: false, reason: 'numerotation-pas-su', error: 'Je n\'ai pas pu relire ta numérotation — rien n\'a été envoyé à eBay.' } };
    if (mkTxt) { try { marqueur = JSON.parse(mkTxt); } catch (_) { return { status: 503, body: { ok: false, reason: 'numerotation-pas-su', error: 'Ta numérotation est illisible — rien n\'a été envoyé à eBay.' } }; } }
  }
  const at = await jetonDe(ctx);
  if (!at.ok) return { status: at.status || 502, body: { ok: false, reason: at.reason, error: at.error } };
  if (auto) {
    const g = await tradingCall(at.token, 'GetItem', `<ItemID>${itemId}</ItemID>`);
    if (g.status === 0 || !g.ok) return { status: 503, body: { ok: false, reason: 'sku-pas-su', error: 'eBay n\'a pas dit quelle paire porte cette annonce — rien n\'a été retiré.' } };
    const skuEbay = lireBalise(String(g.xml || '').replace(/<Variations>[\s\S]*?<\/Variations>/g, ''), 'SKU');
    const lu = numeroExterne(numDeSku(skuEbay), itemId, 'ebayAnnonces', null, marqueur);
    if (!lu || lu !== numDeSku(skuAttendu)) return { status: 409, body: { ok: false, reason: 'sku-change', error: `L'annonce eBay ne porte plus ${skuAttendu} — rien n'a été retiré.` } };
  }
  const r = await tradingCall(at.token, 'EndFixedPriceItem', `<ItemID>${itemId}</ItemID><EndingReason>NotAvailable</EndingReason>`);
  if (sansAck(r)) return { status: 504, body: { ok: false, reason: 'incertain', error: 'eBay n\'a pas répondu — je ne sais pas si l\'annonce a été retirée. Regarde sur eBay avant de recommencer.' } };
  if (!r.ok) return { status: r.status >= 400 ? r.status : 422, body: { ok: false, error: messageEbaySur(r.err) || 'eBay a refusé le retrait.', ack: r.ack } };
  const fin = (/<EndTime>([\s\S]*?)<\/EndTime>/.exec(r.xml || '') || [])[1] || null;
  // L'annonce terminée SORT de sa liste rangée (`ebay_listings`) tout de suite :
  // sinon, jusqu'à la prochaine synchro, l'alerte « à retirer d'eBay » restait
  // affichée et le retrait automatique reprenait la même annonce à chaque
  // ouverture — en occupant les places d'une vraie vente (revue du 6 octobre).
  // Lire-fusionner-réécrire GARDÉ : une lecture ratée n'écrit rien.
  const listes = await sortirDesAnnonces(itemId, ctx);
  // (11 octobre, revue — tour 3) …et des règles rangées : une annonce terminée
  // n'a plus de règle qu'eBay applique.
  const regles = await sortirDesRegles(itemId, ctx);
  let journal = null;
  if (auto) {
    // Le journal ne se réécrit QUE sur une lecture réussie (« rien lu » ne vaut
    // pas « rien », sinon un hoquet effacerait l'historique de ses retraits).
    const j = await lireDonnee(ligneDe('ebay_retraits_auto', ctx), ctx.owner);
    journal = false;
    if (j !== undefined) {
      const l = (j && Array.isArray(j.items)) ? j.items : [];
      journal = await storeData(ligneDe('ebay_retraits_auto', ctx), { items: [{ itemId, sku: skuAttendu, titre: String(b.titre || '').slice(0, 140), at: Date.now() }, ...l].slice(0, 50) }, ctx.owner);
    }
  }
  return { status: 200, body: { ok: true, fin, listes, regles: regles === true, ...(auto ? { auto: true, journal } : {}) } };
}

// ── SOLDE eBay À VIRER (getSellerFundsSummary, lecture seule) ────────────────
// Les MÊMES mots que Vinted (§5.14) : « disponible » et « en attente/retenu »
// ne se confondent jamais. Chaque montant est celui qu'eBay renvoie
// (availableFunds / processingFunds / fundsOnHold), jamais un calcul de notre
// part. Absent ⇒ `null` (l'app écrit « — »), jamais 0. Nécessite le droit
// `sell.finances` : un jeton accordé avant que ce droit existe répond 403 →
// on dit « reconnecte-toi », on n'invente rien.
async function handleFinances(ctx) {
  const at = await jetonDe(ctx);
  if (!at.ok) return { status: at.status || 502, body: { ok: false, reason: at.reason, error: at.error } };
  const r = await ebayJson(`${EBAY_API}/sell/finances/v1/seller_funds_summary`, at.token, { 'Accept-Language': 'fr-FR' });
  if (r.status === 403) return { status: 200, body: { ok: false, reason: 'scope', error: 'Reconnecte-toi à eBay pour voir ton solde à virer (l\'accès « paiements » n\'a pas encore été autorisé).' } };
  if (r.status === 0) return { status: 503, body: { ok: false, error: 'eBay injoignable' } };
  if (!r.ok || !r.data) return { status: r.status >= 400 ? r.status : 502, body: { ok: false, error: 'eBay n\'a pas renvoyé le solde.' } };
  const amt = (o) => (o && o.value != null && isFinite(Number(o.value))) ? Number(o.value) : null;
  const d = r.data;
  const out = { ok: true, dispo: amt(d.availableFunds), enAttente: amt(d.processingFunds), retenu: amt(d.fundsOnHold), total: amt(d.totalFunds), devise: (d.totalFunds && d.totalFunds.currency) || (d.availableFunds && d.availableFunds.currency) || 'EUR', capturedAt: Date.now() };
  await storeData(ligneDe('ebay_finances', ctx), out, ctx.owner);
  return { status: 200, body: out };
}

// ── MESURE pour la PUBLICATION (lecture seule) : ce qu'eBay EXIGE pour créer
//    une annonce — la catégorie, ses attributs obligatoires, et les règles/
//    emplacements du compte. On mesure AVANT d'écrire le publieur (§6).
async function handlePubInfo(b, ctx) {
  const at = await jetonDe(ctx);
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

async function handleSync(ctx) {
  const at = await jetonDe(ctx);
  if (!at.ok) return { status: at.status || 502, body: { ok: false, reason: at.reason, error: at.error, detail: at.detail || '' } };
  const token = at.token;
  // On appelle chaque source séparément : un échec n'empêche pas les autres.
  // Les annonces EN LIGNE et PROGRAMMÉES viennent d'UN SEUL GetMyeBaySelling,
  // découpé par conteneur (`listeVendeur`) : une programmée n'est jamais
  // comptée « en ligne ».
  const tListe = Date.now();   // la liste parle d'eBay À CETTE HEURE (`garder`)
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
  // (9 octobre) La règle d'offre de chaque annonce, lue dans CE MÊME GetItem
  // (zéro appel de plus) et rangée dans `ebay_offres` — jamais dans
  // `ebay_listings` (§11 : une ligne, un propriétaire).
  const lecturesRegle = {};
  for (const it of lst.slice(0, 20)) {
    if (!it.itemId) continue;
    const d = await tradingGetItem(token, it.itemId);
    if (d && !d._err) {
      const { _regle, ...detail } = d;
      it.detail = detail; if (!it.photo && detail.photos && detail.photos[0]) it.photo = detail.photos[0];
      lecturesRegle[it.itemId] = _regle ? { ..._regle.lecture, par: 'sync' } : { lu: false, raison: 'lecture-ratee', lueA: Date.now(), par: 'sync' };
    } else {
      lecturesRegle[it.itemId] = { lu: false, raison: 'lecture-ratee', lueA: Date.now(), par: 'sync' };
      if (d && d._err && detailDiag.length < 3) detailDiag.push({ itemId: it.itemId, err: d._err });
    }
  }
  // Range ce qu'on a (fusion par id).
  // ⚠️⚠️ « RIEN LU » NE VAUT PAS « RIEN » (5 octobre). Chaque lecture ratée
  //    réécrivait sa ligne avec une liste VIDE : un hoquet d'eBay effaçait ses
  //    annonces de l'app (« Pas encore d'annonce eBay en ligne »), et l'anti
  //    double vente ne voyait plus qu'une paire vendue sur Vinted était encore
  //    en vente sur eBay. Une source qui n'a pas répondu garde sa dernière
  //    capture.
  const at2 = Date.now();
  let rangeRegles = null;
  let annoncesRange=false,commandesRange=false,programmeesRange=false,stockRange=false;
  if (liste.ok) {
    annoncesRange=await storeData(ligneDe('ebay_listings', ctx), { items: lst, ack: liste.ack, status: liste.status, complet: liste.complet, capturedAt: at2 }, ctx.owner)===true;
    programmeesRange=await storeData(ligneDe('ebay_programmees', ctx), { items: liste.programmees.map(resumeProgrammee), enLigne: lst.map((x) => ({ itemId: x.itemId, sku: x.sku })), complet: liste.complet, capturedAt: at2 }, ctx.owner)===true;
    // Les règles : lire-fusionner-réécrire GARDÉ (une lecture ratée de la ligne
    // n'écrit rien). Une liste COMPLÈTE dit quelles annonces n'existent plus :
    // leurs règles sortent ; une liste incomplète ne prouve aucune absence.
    const garder = liste.complet ? { ids: new Set([...lst, ...liste.programmees].map((x) => String(x.itemId))), a: tListe } : null;
    rangeRegles = (Object.keys(lecturesRegle).length || garder) ? await rangerReglesOffre(ctx, lecturesRegle, garder) : true;
  }
  const lectureCommandesId=crypto.randomUUID();
  const captureCommandes=orders.ok?fusionCommandesEbay(null,orders.data,at2,lectureCommandesId):null;
  if(captureCommandes)commandesRange=await modifierDonnee(ligneDe('ebay_orders',ctx),ctx.owner,d=>({...fusionCommandesEbay(d,orders.data,at2,lectureCommandesId),status:orders.status}))===true;
  if (inv.ok && Array.isArray(inv.data?.inventoryItems))stockRange=await storeData(ligneDe('ebay_inventory', ctx), { items: inv.data.inventoryItems, status: inv.status, capturedAt: at2 }, ctx.owner)===true;
  // Le principal dont l'identité n'est pas encore apprise : on la demande à
  // eBay maintenant (on a déjà un jeton frais) — c'est ce qui donne son pseudo
  // au sélecteur, et ce qui permet d'ajouter un second compte sans mélange.
  if (ctx.compte.principal) await apprendrePrincipal(ctx.owner, token).catch(() => null);
  // Résumé de MESURE : comptes + statuts + petits échantillons (pour voir la forme).
  return { status: 200, body: {
    ok: true,
    // Ce qui a VRAIMENT été lu (et donc rangé) — le reste garde sa dernière capture.
    lu: { annonces: annoncesRange, programmees: programmeesRange, commandes: commandesRange, stock: stockRange, regles: rangeRegles === true },
    complet: {annonces:annoncesRange && liste.complet===true,commandes:commandesRange && captureCommandes?.complet===true},
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
function retour(res, statut, reason, plus) {
  const q = 'ebay=' + statut + (reason ? '&raison=' + encodeURIComponent(reason) : '')
    + (plus && plus.compte ? '&compte=' + encodeURIComponent(String(plus.compte).slice(0, 64)) : '')
    + (plus && plus.nouveau ? '&nouveau=1' : '');
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
// ⚠️⚠️ ET LE `state` NE DISAIT PAS QUI CONSENT (revue du 6 octobre, prouvé en
// exécutant la route). Signé, il prouvait QUI L'AVAIT DEMANDÉ — pas que le
// retour arrivait dans SON navigateur. Le vendeur B demandait un lien, l'envoyait
// à quelqu'un (« reconnecte ton eBay à VRM » : c'est une vraie page eBay, au
// nom de VRM) ; la victime acceptait, et SON compte eBay était rangé chez B —
// ses commandes, ses acheteurs, ses annonces. Et le même lien servait 30 min,
// pour plusieurs victimes. (RFC 6749 §10.12 : le state se lie au NAVIGATEUR.)
// ⇒ `authurl` pose un NONCE aléatoire dans un cookie HttpOnly (`SameSite=Lax`
//   le laisse revenir sur la navigation GET d'eBay vers nous), le nonce entre
//   dans la signature, et le retour l'exige puis l'EFFACE quoi qu'il arrive :
//   le lien ne marche que dans le navigateur qui l'a demandé, et une seule fois.
const ETAT_VALIDITE_MS = 30 * 60 * 1000;
const COOKIE_ETAT = 'vrm_ebay_etat';
const NONCE_ETAT = /^[0-9a-f]{32}$/;
const cookieEtat = (v, age) => `${COOKIE_ETAT}=${v}; Path=/api/; Max-Age=${age}; HttpOnly; Secure; SameSite=Lax`;
const lireCookieEtat = (req) => {
  const m = new RegExp('(?:^|;\\s*)' + COOKIE_ETAT + '=([^;]*)').exec(String(((req && req.headers) || {}).cookie || ''));
  const v = m ? m[1].trim() : '';
  return NONCE_ETAT.test(v) ? v : '';
};
// (9 octobre) Le state porte aussi l'INTENTION : « Connecter un AUTRE compte »
// (`.a` en fin de state). Elle entre dans la signature — on ne la change pas
// en route ; un state sans elle est exactement celui d'avant.
const macEtat = (owner, ts, nonce, ajout) => crypto.createHmac('sha256', 'vrm-ebay-consentement|' + (process.env.EBAY_CERT_ID || ''))
  .update(String(owner) + '|' + String(ts) + '|' + String(nonce) + (ajout ? '|ajout' : '')).digest('hex').slice(0, 40);
function signerEtat(owner, nonce, ajout) { const o = String(owner).toLowerCase(); const ts = Date.now().toString(36); return ts + '.' + o + '.' + macEtat(o, ts, nonce, !!ajout) + (ajout ? '.a' : ''); }
// Le vendeur porté par un `state` valide POUR CE NAVIGATEUR (son nonce), et son
// intention — `{ vendeur, ajout }`, ou null (nonce absent, forme, âge ou
// signature faux).
function lireEtat(state, nonce) {
  if (!NONCE_ETAT.test(String(nonce || ''))) return null;
  const m = /^([0-9a-z]{6,12})\.([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([0-9a-f]{40})(\.a)?$/.exec(String(state || ''));
  if (!m || !process.env.EBAY_CERT_ID) return null;
  const age = Date.now() - parseInt(m[1], 36);
  if (!(age >= -60000 && age <= ETAT_VALIDITE_MS)) return null;
  const ajout = !!m[4];
  const attendu = Buffer.from(macEtat(m[2], m[1], nonce, ajout)), recu = Buffer.from(m[3]);
  return (attendu.length === recu.length && crypto.timingSafeEqual(attendu, recu)) ? { vendeur: m[2], ajout } : null;
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
  // Le nonce est consommé QUOI QU'IL ARRIVE : un retour, un seul.
  const nonce = lireCookieEtat(req);
  res.setHeader('Set-Cookie', cookieEtat('', 0));
  const etat = lireEtat(q.state, nonce);
  if (!etat) { retour(res, 'erreur', 'demande expirée ou faite dans un autre navigateur — relance la connexion eBay depuis VRM, dans ce navigateur'); return; }
  try {
    // (9 octobre) QUEL compte eBay vient de se connecter : même identité ⇒ ses
    // jetons sont rafraîchis ; nouvelle ⇒ ajoutée ; illisible ⇒ refus (sauf le
    // tout premier compte). Voir `rangerConnexion`.
    const r = await rangerConnexion(code, etat.vendeur, { ajout: etat.ajout });
    if (r.ok) retour(res, 'connecte', '', { compte: r.compte && r.compte.pseudo, nouveau: r.nouveau && !(r.compte && r.compte.principal) });
    else retour(res, 'erreur', r.reason || (r.error || '').slice(0, 60));
  } catch (_) { retour(res, 'erreur', 'echange impossible'); }
}

// L'édition complète garde les contrôles de stock/identité et relit les règles natives.
async function handleModifierAnnonceGestion(b,ctx){
 if(b.price==null)return gestionEbay.modifierAnnonce(b,ctx);
 if(!ID_EBAY.test(String(b.itemId || '')) || !/^\d+(?:[.,]\d{1,2})?$/.test(String(b.price)) || !(Number(String(b.price).replace(',','.'))>0))return {status:400,body:{ok:false,error:'Annonce ou prix invalide.'}};
 if(b.confirme!==true)return {status:400,body:{ok:false,reason:'confirmation',error:'Confirme la modification.'}};
 const at=await jetonDe(ctx);if(!at.ok)return {status:at.status || 502,body:{ok:false,error:at.error,reason:at.reason}};
 const pre=await lireRegleOffre(at.token,String(b.itemId));if(!pre.ok)return {status:503,body:{ok:false,error:'La règle d’offre de cette annonce n’a pas pu être relue. Rien n’a été modifié.'}};
 const P=pre.lecture,active=P.accepte!=null || P.refuse!=null;
 if(P.offresActives===true && P.accepte!=null && Number(String(b.price).replace(',','.'))<=P.accepte)return {status:409,body:{ok:false,error:'Le prix doit rester au-dessus du seuil d’offre existant. Modifie ou retire la règle avant de baisser le prix.'}};
 if(active && await rangerReglesOffre(ctx,{[b.itemId]:{lu:false,raison:'en-cours',lueA:Date.now(),par:'revise',_force:true}})!==true)return {status:503,body:{ok:false,error:'La modification n’a pas pu être préparée dans VRM. Rien n’a été envoyé.'}};
 const r=await gestionEbay.modifierAnnonce(b,ctx);
 if(!r.body?.ok){
  if(active){const incertain=r.body?.reason==='incertain';await rangerReglesOffre(ctx,{[b.itemId]:incertain?{lu:false,raison:'incertain',lueA:Date.now(),par:'revise',_force:true}:{...P,par:'revise',_force:true}});}
  return r;
 }
 const post=await lireRegleOffre(at.token,String(b.itemId));
 const lecture=post.ok?post.lecture:active?{lu:false,raison:'apres-ecriture',lueA:Date.now()}:P;
 await rangerReglesOffre(ctx,{[b.itemId]:{...lecture,par:'revise',_force:active}});
 r.body.regle={lecture:post.ok?post.lecture:null,avant:active?{accepte:P.accepte,refuse:P.refuse}:null,tombee:active?(post.ok?((P.accepte!=null && post.lecture.accepte==null)||(P.refuse!=null && post.lecture.refuse==null)):null):false};
 return r;
}

// ── PILOTAGE PAR L'APP (défaut) ─────────────────────────────────────────────
const chargerCommandesSuivantes=creerLectureCommandesEbay({lire:lireDonnee,modifier:modifierDonnee,jeton:jetonDe,json:ebayJson,apiOrigin:EBAY_API});
const gestionEbay=creerGestionEbay({accessToken:jetonDe,ebayJson,tradingCall,apiOrigin:EBAY_API});

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
      // « Connecter un AUTRE compte eBay » : `prompt=login` (sinon eBay
      // reconnecterait en silence le compte déjà ouvert dans ce navigateur), et
      // l'intention signée dans le state. Base pas encore cloisonnée : un seul
      // compte, comme avant.
      const ajout = b.ajout === true;
      if (ajout && !cloison) { res.status(409).json({ ok: false, reason: 'un-seul-compte', error: 'Un seul compte eBay tant que la base n\'est pas cloisonnée.' }); return; }
      const nonce = crypto.randomBytes(16).toString('hex');
      res.setHeader('Set-Cookie', cookieEtat(nonce, Math.round(ETAT_VALIDITE_MS / 1000)));
      res.status(200).json({ ok: true, url: authUrl(signerEtat(owner, nonce, ajout), { ajout }) });
      return;
    }
    if (action === 'apptoken') {
      const r = await appToken();
      res.status(r.status).json(r.ok ? { ok: true, works: true, expires_in: r.expires_in || null } : { ok: false, error: r.error, detail: r.detail || '' });
      return;
    }
    if (action === 'exchange') {
      const r = await rangerConnexion(String(b.code || '').trim(), owner, { ajout: b.ajout === true });
      res.status(r.status).json(r.ok ? { ok: true, connected: true, compte: r.compte || null, nouveau: !!r.nouveau } : { ok: false, reason: r.reason, error: r.error, detail: r.detail || '' });
      return;
    }
    if (action === 'status') {
      const has = await hasRefresh(owner, '');
      if (has === null) { res.status(503).json({ ok: false, reason: 'store-unreachable', error: 'Impossible de lire l\'état (base injoignable).' }); return; }
      if (!cloison) { res.status(200).json({ ok: true, connected: !!has }); return; }
      // (9 octobre) Ses comptes eBay, chacun avec son état — jamais un jeton.
      // Le principal relié dont l'identité n'est pas encore apprise : on la
      // demande à eBay maintenant (une fois ; ensuite elle est rangée).
      let reg = await lireComptes(owner);
      if (reg && has && !reg.comptes.some((x) => x.principal)) {
        if ((await apprendrePrincipal(owner).catch(() => null)) === true) reg = await lireComptes(owner);
      }
      if (reg === undefined) { res.status(503).json({ ok: false, reason: 'store-unreachable', error: 'Impossible de lire tes comptes eBay (base injoignable).' }); return; }
      const comptes = [];
      for (const c of comptesActifs(reg)) {
        const relie = c.suffixe ? await hasRefresh(owner, c.suffixe) : has;
        if (c.implicite && !relie) continue;
        comptes.push({ cle: c.principal ? (c.cle || '') : c.cle, pseudo: c.pseudo || '', principal: !!c.principal, relie, ajouteLe: c.ajouteLe || null });
      }
      res.status(200).json({ ok: true, connected: comptes.some((c) => c.relie === true), comptes });
      return;
    }
    if (action === 'deconnecter') {
      // ⚠️ Ses jetons partent : confirmation exigée ICI (pas seulement à
      // l'écran). Les autres comptes ne sont pas touchés.
      if (b.confirme !== true) { res.status(400).json({ ok: false, reason: 'confirmation', error: 'Confirme la déconnexion : rien n\'a changé.' }); return; }
      if (!cloison) { res.status(409).json({ ok: false, reason: 'un-seul-compte', error: 'Un seul compte eBay tant que la base n\'est pas cloisonnée.' }); return; }
      const rc = await resoudreCompte(b.compte, owner);
      if (!rc.ok) { res.status(rc.status).json(rc.body); return; }
      const r = await deconnecterCompte(rc.compte, owner);
      res.status(r.status).json(r.ok ? { ok: true, compte: rc.compte.pseudo || '', registre: r.registre } : { ok: false, reason: r.reason, error: r.error });
      return;
    }
    // Toutes les autres actions agissent sur UN compte eBay de CE vendeur —
    // `compte` (absent ⇒ le principal), VALIDÉ contre SON registre AVANT tout
    // appel à eBay : un compte inconnu, déconnecté ou d'un autre vendeur ne
    // désigne rien. Ce qui engage (offre, retrait, programmation, annulation,
    // déplacement) exige en plus `confirme:true` — vérifié AVANT eBay aussi.
    const ACTIONS = {
      agent:async(ctx)=>preparerAgentEbay({
        orders:await lireDonnee(ligneDe('ebay_orders',ctx),ctx.owner),
        messages:await gestionEbay.messages({page:1},ctx),
        offres:await gestionEbay.offres({page:1},ctx),
        journal:await lireDonnee(ligneDe('ebay_agent_journal',ctx),ctx.owner),
      }),
      commande:(ctx)=>gestionEbay.commande(b,ctx),
      transporteurs:(ctx)=>gestionEbay.transporteurs(b,ctx),
      expedier:(ctx)=>gestionEbay.expedier(b,ctx),
      messageacheteur:(ctx)=>gestionEbay.contacterAcheteur(b,ctx),
      messages:(ctx)=>gestionEbay.messages(b,ctx),
      message:(ctx)=>gestionEbay.message(b,ctx),
      offredetail:(ctx)=>gestionEbay.offre(b,ctx),
      repondre:(ctx)=>gestionEbay.repondre(b,ctx),
      offresrecues:(ctx)=>gestionEbay.offres(b,ctx),
      repondreoffre:(ctx)=>gestionEbay.repondreOffre(b,ctx),
      modifierannonce:(ctx)=>handleModifierAnnonceGestion(b,ctx),
      terminerannonce:async(ctx)=>{const r=await gestionEbay.terminerAnnonce(b,ctx);if(r.body?.ok)r.body.reglesRange=await sortirDesRegles(String(b.itemId),ctx);return r;},
      sync: (ctx) => handleSync(ctx),
      commandessuite:(ctx)=>chargerCommandesSuivantes(ctx),
      revise: (ctx) => handleRevise(b, ctx),
      pubinfo: (ctx) => handlePubInfo(b, ctx),
      pubverify: (ctx) => handleVerify(b, ctx),
      finances: (ctx) => handleFinances(ctx),
      publish: (ctx) => handlePublish(b, ctx),
      sku: (ctx) => handleSku(b, ctx),
      offreinfo: (ctx) => handleOffreInfo(ctx),
      offre: (ctx) => handleOffre(b, ctx),
      retirer: (ctx) => handleRetirer(b, ctx),
      programmer: (ctx) => handleProgrammer(b, ctx),
      programmees: (ctx) => handleProgrammees(ctx),
      deprogrammer: (ctx) => handleDeprogrammer(b, ctx),
      reprogrammer: (ctx) => handleReprogrammer(b, ctx),
      limites: (ctx) => handleLimites(ctx),
      // (9 octobre) La règle d'offre : c'est eBay qui accepte, au seuil fixé.
      regleoffre: (ctx) => handleRegleOffre(b, ctx),
      regleoffrelire: (ctx) => handleRegleOffreLire(b, ctx),
    };
    if (!Object.prototype.hasOwnProperty.call(ACTIONS, action)) { res.status(400).json({ ok: false, error: 'action inconnue' }); return; }
    const rc = await resoudreCompte(b.compte, owner);
    if (!rc.ok) { res.status(rc.status).json(rc.body); return; }
    const ctx={owner,compte:rc.compte};
    const commerciales=new Set(['expedier','messageacheteur','repondre','repondreoffre','modifierannonce','terminerannonce']);
    const r = commerciales.has(action) && b.confirme===true
      ? await executerAvecJournal({action,b,execute:()=>ACTIONS[action](ctx),modifier:fn=>modifierDonnee(ligneDe('ebay_agent_journal',ctx),owner,fn)})
      : await ACTIONS[action](ctx);
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
