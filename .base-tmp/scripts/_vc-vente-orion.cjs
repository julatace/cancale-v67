// ════════════════════════════════════════════════════════════════════════════
//  LA VENTE VESTIAIRE, DE LA PAGE À LA BASE — banc commun (13 nov., ext. 5.374)
//  (docs/passation/2026-11-13-vestiaire-vente-orion.md)
//
//  Le VRAI vc-inject.js (le capteur de la page) + le VRAI vc.js (le relais) + le
//  VRAI background.js (`_fond-vm.cjs`), reliés comme dans le navigateur. La page
//  est jouée de deux façons :
//   · « ordinateur » : le capteur posé AVANT la page (Chrome, monde MAIN) — il
//     voit passer chaque requête ;
//   · « orion » : le capteur posé APRÈS les premières requêtes (balise `src`,
//     Orion sur iPhone) — la liste des ventes est déjà passée ; seul le minutage
//     des ressources du navigateur (`performance`) dit qu'elle a été demandée.
//     Et `Date.parse` y refuse la forme « AAAA-MM-JJ HH:MM:SS » (WebKit ne la
//     garantit pas).
//  Les réponses ont la FORME mesurée chez Julien (vc_recon, vc_brut du 2 nov. :
//  `/ots/sales` → `data.products[]`, `/users/me/awaiting-shipping-items` →
//  `data[]`, `__NEXT_DATA__` → `props.pageProps.dehydratedState.queries[]`) ;
//  toutes les VALEURS sont INVENTÉES (le dépôt est public).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const { faireFond } = require('./_fond-vm.cjs');
const racine = path.join(__dirname, '..');
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const copie = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
const API = 'https://apiv2.vestiairecollective.com';
const ORIGINE = 'https://fr.vestiairecollective.com';
const Q = '?isoCountry=FR&x-siteid=1&x-language=fr&x-currency=EUR';
const URL_VENTES = `${API}/ots/sales?status=ACTION_NEEDED&isoCountry=FR&x-siteid=1&x-language=fr&x-currency=EUR`;
const URL_A_EXP = `${API}/users/me/awaiting-shipping-items${Q}&limit=10&offset=0`;
const URL_COMPTEUR = `${API}/notification-feed-counter/v2${Q}`;
const MOI = '40400404';                       // compte Vestiaire inventé
const ART = '79990001', ART2 = '79990002';    // articles inventés

// Une vente de « Mes ventes » (`/ots/sales`), la forme mesurée le 2 nov., valeurs inventées.
const venteOts = (id, { soldDate = '2026-11-13 00:41:07', conf = '2026-11-13 00:41:06', prix = '209,52 €', gain = '203,23 €', status = 'ACTION_NEEDED' } = {}) => ({
  productId: id, externalRef: 'R' + id, productName: 'Escarpins en cuir', brandName: 'Maison Inventée', imageUrl: `${id}-1_2.jpg`,
  orderConfirmationDate: conf, productPrice: prix, ezlink: '', currencyRate: '1', soldDate, sellerId: MOI,
  sellerEarning: gain, sellerPrice: prix, isDirectShipping: false, status, action: { title: 'Envoyer', message: '', type: 'timeline', context: { url: '/x' } },
});
// La même vente dans « à expédier » : `soldDate` y est l'HEURE DE LA LECTURE (mesuré : 21:00:32,
// la seconde de la visite), `orderConfirmationDate` le jour en anglais.
const venteAExp = (id, { lecture = '2026-11-13 21:35:09', jour = 'November 13, 2026', gain = '203,23 €', prix = '209,52 €' } = {}) => ({
  productId: id, externalRef: 'R' + id, productName: 'Escarpins en cuir', brandName: 'Maison Inventée', imageUrl: `${id}-1_2.jpg`,
  orderConfirmationDate: jour, productPrice: prix, ezlink: '', sold: '1', retired: '0', unreceived: '0', stock: '0', stock_vdc: '0',
  soldDate: lecture, currencyRate: '1', id_client: '1', sellerEarning: gain, sellerPrice: prix, isDirectShipping: false,
  cancelSaleUrl: '/x', shippingLabelUrl: 'https://exemple.invalid/label.pdf', shipByDate: '2026-11-20T23:59:59+01:00', daysToShip: 7,
});
const repVentes = (ventes) => ({ data: { products: ventes }, meta: { limit: 10, offset: 0, count: ventes.length } });
const repAExp = (ventes) => ({ data: ventes, meta: { limit: 10, offset: 0, count: ventes.length } });
// `__NEXT_DATA__` de la page : le compte (« user.user », mesuré) et, si donné, une requête de ventes
// (sa CLÉ et la forme de ses données sont INVENTÉES : jamais vues — c'est la règle qui est jugée).
const nextData = ({ moi = MOI, requetes = [], device = 'desktop' } = {}) => ({
  props: { pageProps: { deviceType: device, dehydratedState: { mutations: [], queries: [
    { queryKey: ['global.initialRequestUrl'], queryHash: 'x', state: { status: 'success', data: '/my-account/orders-sales/' } },
    ...(moi ? [{ queryKey: ['user.user'], queryHash: 'u', state: { status: 'success', data: { id: Number(moi), firstname: 'Prénom-Inventé', lastname: 'Nom-Inventé', email: 'invente@exemple.invalid', address: 'rue inventée' } } }] : []),
    ...requetes,
  ] } } }, page: '/my-account/orders-sales', query: { section: '2' }, buildId: 'banc',
});

// La page : `tard` = Orion (capteur posé après les premières requêtes, readyState « complete »).
function pageVc(F, { tard = false, webkit = false, next = null, avant = [], bus = null } = {}) {
  const INJ = fs.readFileSync(F.inject, 'utf8'), REL = fs.readFileSync(F.relais, 'utf8');
  const posts = [], appels = [], routes = {};
  const ecoutesPage = [], ecoutesRel = [], ecoutesDoc = [];
  const winP = {}, winR = {};
  const diffuser = (m) => { const d = copie(m); posts.push(d); for (const f of ecoutesPage.slice()) f({ source: winP, data: copie(d) }); for (const f of ecoutesRel.slice()) f({ source: winR, data: copie(d) }); };
  const T0 = tard ? 4000 : 30;
  const entrees = avant.map((u, i) => ({ name: u, startTime: 900 + i * 50, initiatorType: 'fetch' }));
  const fausseFetch = async (u, init) => {
    const m = String((init && init.method) || 'GET').toUpperCase();
    appels.push({ u: String(u), m, h: copie((init && init.headers) || {}), cred: init && init.credentials });
    const r = routes[m + ' ' + String(u)] || { status: 404, body: { message: 'introuvable' } };
    const texte = r.body == null ? '' : typeof r.body === 'string' ? r.body : JSON.stringify(r.body);
    return { status: r.status, ok: r.status >= 200 && r.status < 300, headers: { get: () => 'application/json; charset=utf-8' }, clone() { return this; }, text: async () => texte };
  };
  Object.assign(winP, { postMessage: diffuser, addEventListener: (t, f) => { if (t === 'message') ecoutesPage.push(f); }, fetch: fausseFetch });
  winP.top = winP; winP.self = winP;
  // WebKit (Orion, Safari) : `Date.parse` ne garantit pas « AAAA-MM-JJ HH:MM:SS » — joué ici comme un refus.
  class DateWk extends Date {}
  DateWk.parse = (s) => (/^\d{4}-\d{2}-\d{2} \d/.test(String(s)) ? NaN : Date.parse(s));
  const nd = next ? { textContent: JSON.stringify(next) } : null;
  const doc = { currentScript: {}, createElement: () => ({}), head: { appendChild() {} }, readyState: tard ? 'complete' : 'loading',
    addEventListener: (t, f) => { if (t === 'DOMContentLoaded') ecoutesDoc.push(f); }, getElementById: (id) => (id === '__NEXT_DATA__' ? nd : null) };
  const ctxP = { window: winP, document: doc, performance: { now: () => T0, getEntriesByType: (t) => (t === 'resource' ? entrees.slice() : []) },
    location: { origin: ORIGINE, hostname: 'fr.vestiairecollective.com', pathname: '/my-account/orders-sales/', href: ORIGINE + '/my-account/orders-sales/?section=2' }, history: { pushState() {}, replaceState() {} },
    URL, console: { log() {}, warn() {}, error() {} }, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {}, JSON, Date: webkit ? DateWk : Date, Math, Map, Set, Promise, encodeURIComponent, btoa: (x) => Buffer.from(x, 'latin1').toString('base64'), Uint8Array, ArrayBuffer, String, Number, Object, Array };
  vm.createContext(ctxP); vm.runInContext(INJ, ctxP, { filename: 'vc-inject.js' });
  const ecouteOrdre = [];
  Object.assign(winR, { postMessage: diffuser, addEventListener: (t, f) => { if (t === 'message') ecoutesRel.push(f); } });
  winR.top = winR;
  const ctxR = { window: winR, self: {}, chrome: { runtime: { id: 'banc', sendMessage: (m, cb) => { if (bus) bus(copie(m)); if (cb) cb(); }, lastError: null, onMessage: { addListener(f) { ecouteOrdre.push(f); } } } },
    location: { href: ORIGINE + '/my-account/orders-sales/' }, URL, console, setTimeout, clearTimeout, JSON, Date, Math, Map, Set, Number, String };
  vm.createContext(ctxR); vm.runInContext(REL, ctxR, { filename: 'vc.js' });
  const servir = (m, url, body, status = 200) => { routes[m + ' ' + url] = { status, body }; };
  // La page charge (Chrome) : le document est là (`__NEXT_DATA__`), puis ses requêtes.
  const charge = async () => { doc.readyState = 'interactive'; for (const f of ecoutesDoc.splice(0)) f(); await attendre(20); };
  const demande = async (url, body, status = 200) => { servir('GET', url, body, status); const n = posts.length; await winP.fetch(url, { method: 'GET', headers: { accept: 'application/json', 'x-banc': 'entete-page' } }); await attendre(30); return posts.slice(n); };
  return { posts, appels, routes, servir, charge, demande, ctxP };
}

// La page + le fond : ce que la base reçoit.
function systeme(F, opts = {}) {
  let fond = null;
  const p = pageVc(F, Object.assign({}, opts, { bus: (m) => { if (fond) fond.envoyer(m, { tab: { id: 41, url: ORIGINE + '/my-account/orders-sales/' }, frameId: 0 }); } }));
  fond = faireFond({ src: F.src, lignes: copie(opts.lignes || {}), onglets: [{ id: 41, url: ORIGINE + '/my-account/orders-sales/', active: true, status: 'complete' }] });
  return { p, fond, lignes: fond.lignes, envoyer: (m) => fond.envoyer(Object.assign({ from: 'cancale-vc' }, m), { tab: { id: 41, url: ORIGINE + '/my-account/orders-sales/' }, frameId: 0 }) };
}

// Le scénario de la plainte : Orion sur iPhone, « Mes ventes » ouvert, capteur posé APRÈS la page.
// Rend les lignes `vc_ventes` et `vc_session` que la base reçoit (le banc d'écran les sert à l'app).
async function scenarioOrion(F) {
  const S = systeme(F, { tard: true, webkit: true, next: nextData({ device: 'mobile' }), avant: [URL_VENTES, URL_A_EXP] });
  S.p.servir('GET', URL_VENTES, repVentes([venteOts(ART)]));
  S.p.servir('GET', URL_A_EXP, repAExp([venteAExp(ART)]));
  await attendre(20);
  await S.p.demande(URL_COMPTEUR, { data: { messages: 0 } });   // la page relève son compteur (au fil de l'eau)
  await attendre(1900);
  await attendre(150);
  return { S, vc_ventes: copie(S.lignes.vc_ventes), vc_session: copie(S.lignes.vc_session) };
}
const fichiers = (arg = () => undefined) => ({
  src: arg('--src') || path.join(racine, 'vinted-sync-extension/background.js'),
  inject: arg('--inject') || path.join(racine, 'vinted-sync-extension/vc-inject.js'),
  relais: arg('--relais') || path.join(racine, 'vinted-sync-extension/vc.js'),
});
module.exports = { pageVc, systeme, scenarioOrion, fichiers, nextData, venteOts, venteAExp, repVentes, repAExp, attendre, copie,
  API, ORIGINE, Q, URL_VENTES, URL_A_EXP, URL_COMPTEUR, MOI, ART, ART2 };
