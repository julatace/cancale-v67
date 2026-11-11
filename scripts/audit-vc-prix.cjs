// ════════════════════════════════════════════════════════════════════════════
//  VESTIAIRE : BAISSER UN PRIX, APPRIS DE SON PROPRE GESTE (11 nov., ext. 5.364)
//
//  Julien : « baisser le prix en série sur Vestiaire, sur mon clic, prix lu avant
//  et relu après, compte de l'onglet, plafonds — seulement si la recette du geste
//  est APPRISE de mon propre geste sur vestiairecollective.com ; sinon « fais-le
//  une fois à la main, VRM apprendra » ». La requête qui change un prix n'a JAMAIS
//  été vue chez lui (vc_recon, 11 nov.) : sa forme ici est INVENTÉE — c'est la
//  règle d'apprentissage et les garde-fous qu'on juge.
//
//  VRAI vc-inject.js + VRAI vc.js + VRAI background.js (`_fond-vm.cjs`), reliés
//  comme dans Chrome (fenêtre partagée, `chrome.tabs.sendMessage` → vc.js → page) ;
//  données INVENTÉES (le dépôt est public).
//   P1  son changement de prix à la main ⇒ « pas encore relu », puis « Mes articles »
//       relu au NOUVEAU prix ⇒ recette apprise (trous {produit} {prixCents}, NOMS
//       d'en-têtes seulement) ; ou la réponse qui porte le nouveau prix ⇒ apprise.
//   P2  une annonce jamais montrée ⇒ rien ; une valeur inconnue ⇒ pas rejouable ;
//       un prix mal compris (centimes sous une clé « amount ») ⇒ JAMAIS appris.
//   P3  le fond : `vc_prix_recette` ; sans recette ⇒ rien ne part ; pas rejouable ⇒ rien.
//   P4  sur SA commande : UNE écriture (le corps de la page, ton prix) + la relecture
//       de « Mes articles » ; « fait » au prix RELU ; une action comptée.
//   P5  prix lu ≠ prix de l'aperçu ⇒ rien ne part (fond ET page).
//   P6  45 actions/h ⇒ refus ; 429 ⇒ pause, puis rien ne part.
//   P7  l'onglet sur un autre compte ⇒ rien ne part.
//   P8  2xx mais relu à un autre prix ⇒ « écart », jamais « fait ».
//   P9  l'app : `EXT_CAPACITES.vcprix` = 5.364.0 ; règles de la feuille.
//  `--prouve` : chaque règle réaffaiblie doit faire rougir l'audit.
// ════════════════════════════════════════════════════════════════════════════
require('./_source-app.cjs').brancher();
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const { faireFond } = require('./_fond-vm.cjs');
const racine = path.join(__dirname, '..');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? path.resolve(process.argv[i + 1]) : d; };
const F = {
  src: arg('--src', path.join(racine, 'vinted-sync-extension/background.js')),
  inject: arg('--inject', path.join(racine, 'vinted-sync-extension/vc-inject.js')),
  relais: arg('--relais', path.join(racine, 'vinted-sync-extension/vc.js')),
  app: arg('--app', path.join(racine, 'src/App.jsx')),
  regle: arg('--regle', path.join(racine, 'src/baissePrixVestiaire.js')),
};

if (process.argv.includes('--prouve')) {
  const MUT = [
    ['apprisSansRelire', 'inject', "      prixEnAttente.set(r.pid, { cents: r.cents, recette: r.recette, at: Date.now() });\n      post({ kind: 'vcprixappris', recette: Object.assign({}, r.recette, { rejouable: false, raison: 'pas-encore-relu' }) });", "      post({ kind: 'vcprixappris', recette: r.recette });"],
    ['annonceNonVue', 'inject', "    if (!pid) return null;                               // pas une annonce que la page a montrée : rien à apprendre", "    if (!pid) pid = (segs.find((s) => /^\\d{3,15}$/.test(s)) || ''); if (!pid) return null; if (!annoncesVuesPrix.has(pid)) annoncesVuesPrix.set(pid, { cents: 0, url: '' });"],
    ['valeurInconnue', 'inject', "      return non('valeur-inconnue');\n    }\n    if (nPrix !== 1)", "      fixes.push([cles, v, typeof v]); continue;\n    }\n    if (nPrix !== 1)"],
    ['enteteValeur', 'inject', "const noms = Object.keys(nomsEntetes(entetes)).filter((k) => !ENTETES_INTERDITS.test(k)).slice(0, 20);\n    return { recette: { ...base, rejouable: true", "const noms = nomsEntetes(entetes);\n    return { recette: { ...base, rejouable: true"],
    ['pagePrixAvant', 'inject', "    if (vu.cents !== avant) return fin({ statut: 0, erreur: 'prix-change', prixVuCents: vu.cents });", ''],
    ['pageCompte', 'inject', "    if (d.compte !== undefined && (!moiId || String(d.compte) !== moiId)) return fin({ statut: 0, erreur: moiId ? 'autre-compte' : 'compte-pas-su' });\n    // Le prix LU AVANT", '    // Le prix LU AVANT'],
    ['pageSansRelire', 'inject', "        if (prixVuCents == null && vu.url) {", '        prixVuCents = apres; relu = \'liste\';\n        if (false) {'],
    ['fondPasAppris', 'src', "    if (recette.rejouable !== true) return { accepte: false, code: 'pas-rejouable', raison: `la façon dont Vestiaire change un prix", "    if (false) return { accepte: false, code: 'pas-rejouable', raison: `la façon dont Vestiaire change un prix"],
    ['fondPrixAvant', 'src', "    if (lu !== avant) return { accepte: false, code: 'prix-change',", "    if (false) return { accepte: false, code: 'prix-change',"],
    ['fondPlafond', 'src', "    const cpt = await compterAction('vc:' + ot.compte, ACTIONS_MAX_HEURE - RESERVE_GESTES);\n    if (!cpt.ok && cpt.code === 'stockage') return { accepte: false, code: 'stockage', raison: RAISON_STOCKAGE };\n    if (!cpt.ok) return { accepte: false, code: 'plafond', raison: `déjà ${ACTIONS_MAX_HEURE - RESERVE_GESTES} actions", "    const cpt = { ok: true, at: Date.now() };\n    if (!cpt.ok) return { accepte: false, code: 'plafond', raison: `déjà ${ACTIONS_MAX_HEURE - RESERVE_GESTES} actions"],
    ['fondPause', 'src', "    const pause = await pauseVc();\n    if (pause) return { accepte: false, code: 'vc-pause', raison: `Vestiaire a demandé de ralentir (${pause.statut || 'refus'}) — rien n'est parti, réessaie après ${new Date(pause.jusqua).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` };\n    let e;", '    let e;'],
    ['fondFaitSansRelu', 'src', "      if (vu === apres) return { accepte: true, etape: 'fait'", "      if (true) return { accepte: true, etape: 'fait'"],
    ['fondCompte', 'src', "    if (!compte) return { accepte: false, code: 'session',", "    if (false) return { accepte: false, code: 'session',"],
    ['relaisPrixVente', 'relais', "          ...(x && x.prixVente && isFinite(Number(x.prixVente.valeur)) ? { prixVente:", "          ...(false ? { prixVente:"],
    ['appRecette', 'regle', "  return recette.appris === true ? { etat: 'pret', raison: '' }", "  return recette ? { etat: 'pret', raison: '' }"],
    ['appCompte', 'regle', "    else if (String(compteOnglet) !== compte) bloque = 'autre-compte';", ''],
    ['appFaitSansPrix', 'regle', "  if (r.etape === 'fait' && vu != null) return { etat: 'fait', prixVu: vu, arret: false };", "  if (r.etape === 'fait') return { etat: 'fait', prixVu: vu, arret: false };"],
  ];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-vc-prix-'));
  let tous = true;
  for (const [nom, cle, avant, apres] of MUT) {
    const txt = fs.readFileSync(F[cle], 'utf8');
    if (!txt.includes(avant)) { console.log(`❌ mutation ${nom} : texte introuvable`); tous = false; continue; }
    let fichier = path.join(tmp, nom + '-' + path.basename(F[cle]));
    if (cle === 'regle') { fs.mkdirSync(path.join(tmp, nom), { recursive: true }); fichier = path.join(tmp, nom, path.basename(F[cle])); fs.copyFileSync(path.join(path.dirname(F.regle), 'baissePrix.js'), path.join(tmp, nom, 'baissePrix.js')); }
    fs.writeFileSync(fichier, txt.replace(avant, apres));
    const args = [__filename, '--' + cle, fichier];
    for (const k of Object.keys(F)) if (k !== cle) args.push('--' + k, F[k]);
    const r = spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 180000 });
    const rouges = ((r.stdout || '').match(/^❌/gm) || []).length;
    const ok = r.status !== 0 && rouges > 0;
    if (!ok) tous = false;
    console.log(`${ok ? '✅' : '❌'} mutation « ${nom} » ⇒ ${rouges} contrôle(s) rouge(s)${ok ? '' : ' — LA RÈGLE N’EST PAS PROTÉGÉE'}`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(tous ? '\n✅ chaque règle réaffaiblie fait rougir l’audit' : '\n❌ une mutation passe inaperçue');
  process.exit(tous ? 0 : 1);
}

let ko = 0;
const dit = (ok, nom, det) => { if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${ok || !det ? '' : ' — ' + String(det).slice(0, 500)}`); };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const copie = (x) => JSON.parse(JSON.stringify(x));
const API = 'https://apiv2.vestiairecollective.com';
const ORIGINE = 'https://fr.vestiairecollective.com';
const Q = '?isoCountry=FR&x-siteid=1&x-language=fr&x-currency=EUR';
const MOI = '11112222', ART = '66668888', ART2 = '77770000', INCONNU = '55551111';
const SECRET = 'secret-entete-xyz';
const URL_LISTE = `${API}/users/me/product-listings${Q}&offset=0&limit=48`;
// La forme MESURÉE de « Mes articles » (2 nov. : l'enveloppe `published.product`).
const annonce = (id, cents) => ({ type: 'published', published: { product: { id, headline: 'Nike', subHeadline: 'Dunk Low', price: { cents, currency: 'EUR', formatted: `${cents / 100} €` }, sellerEarnings: { cents: Math.round(cents * 0.8), currency: 'EUR' }, picturePath: `${id}-1_2.jpg`, path: `/x-${id}.shtml` }, listingDate: '2026-11-01T10:00:00Z' } });
const liste = (prix) => ({ data: [annonce(ART, prix[0]), annonce(ART2, prix[1] || 15000)], meta: { count: 2, offset: 0 } });

function chrome2(bus) {
  const INJ = fs.readFileSync(F.inject, 'utf8'), REL = fs.readFileSync(F.relais, 'utf8');
  const posts = [], appels = [];
  const routes = {};
  const rep = (m, u) => routes[m + ' ' + u] || routes['* ' + u] || { status: 404, body: { message: 'introuvable' } };
  const ecoutesPage = [], ecoutesRel = [];
  const winP = {}, winR = {};
  const diffuser = (m) => { const d = copie(m); posts.push(d); for (const f of ecoutesPage.slice()) f({ source: winP, data: copie(d) }); for (const f of ecoutesRel.slice()) f({ source: winR, data: copie(d) }); };
  Object.assign(winP, { postMessage: diffuser, addEventListener: (t, f) => { if (t === 'message') ecoutesPage.push(f); },
    fetch: async (u, init) => {
      const m = String((init && init.method) || 'GET').toUpperCase();
      appels.push({ u: String(u), m, h: copie((init && init.headers) || {}), b: init && init.body });
      const r = rep(m, String(u));
      const texte = r.body == null ? '' : typeof r.body === 'string' ? r.body : JSON.stringify(r.body);
      const ct = r.ct || 'application/json; charset=utf-8';
      return { status: r.status, ok: r.status >= 200 && r.status < 300, headers: { get: () => ct }, clone() { return this; }, text: async () => texte, arrayBuffer: async () => new ArrayBuffer(0) };
    } });
  winP.top = winP; winP.self = winP;
  const ctxP = { window: winP, document: { currentScript: {}, createElement: () => ({}), head: { appendChild() {} }, addEventListener() {}, getElementById: () => null, readyState: 'complete' },
    location: { origin: ORIGINE, hostname: 'fr.vestiairecollective.com', pathname: '/my-account/items/', href: ORIGINE + '/my-account/items/' }, history: { pushState() {}, replaceState() {} },
    URL, console: { log() {}, warn() {}, error() {} }, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {}, JSON, Date, Math, Map, Set, Promise, encodeURIComponent, btoa: (x) => Buffer.from(x, 'latin1').toString('base64'), Uint8Array, ArrayBuffer, String, Number };
  vm.createContext(ctxP); vm.runInContext(INJ, ctxP, { filename: 'vc-inject.js' });
  let ecouteOrdre = [];
  Object.assign(winR, { postMessage: diffuser, addEventListener: (t, f) => { if (t === 'message') ecoutesRel.push(f); } });
  winR.top = winR;
  const ctxR = { window: winR, self: { crypto: { randomUUID: () => 'aaaaaaaa-bbbb-cccc-dddd-' + String(Math.floor(Math.random() * 1e12)).padStart(12, '0') } }, crypto: { randomUUID: () => 'aaaaaaaa-bbbb-cccc-dddd-' + String(Math.floor(Math.random() * 1e12)).padStart(12, '0') },
    chrome: { runtime: { id: 'banc', sendMessage: (m, cb) => { if (bus) bus(copie(m)); if (cb) cb(); }, lastError: null, onMessage: { addListener(f) { ecouteOrdre.push(f); } } } },
    location: { href: ORIGINE + '/my-account/items/' }, URL, console, setTimeout, clearTimeout, JSON, Date, Math, Map, Set, Number, String };
  vm.createContext(ctxR); vm.runInContext(REL, ctxR, { filename: 'vc.js' });
  const ordre = (m) => new Promise((res) => {
    let rendu = false;
    for (const f of ecouteOrdre) { const r = f(copie(m), { id: 'banc' }, (x) => { rendu = true; res(copie(x)); }); if (r === true) return; }
    if (!rendu) res(undefined);
  });
  const appel = async (m, url, corps, status = 200, envoye, ct) => {
    routes[m + ' ' + url] = { status, body: corps, ct };
    const n = posts.length;
    await winP.fetch(url, { method: m, body: envoye, headers: { 'content-type': 'application/json', 'x-vc-auth': SECRET } });
    await attendre(25);
    return posts.slice(n);
  };
  return { appel, posts, appels, ordre, routes };
}
const de = (posts, k) => posts.filter((x) => x.kind === k);

const capt = {};
async function p1p2() {
  // P1 — 204 sans corps, puis « Mes articles » relu au nouveau prix.
  const p = chrome2();
  await p.appel('GET', URL_LISTE, liste([20000]));
  const a1 = await p.appel('PATCH', `${API}/products/${ART}${Q}`, null, 204, JSON.stringify({ price: { cents: 18500 } }), 'text/plain');
  const r1 = de(a1, 'vcprixappris')[0];
  dit(!!r1 && r1.recette.rejouable === false && r1.recette.raison === 'pas-encore-relu', 'P1 · son changement de prix (204) ⇒ noté, mais « pas encore relu » (jamais rejouable avant la relecture)', JSON.stringify(r1));
  const a2 = await p.appel('GET', URL_LISTE, liste([18500]));
  const r2 = de(a2, 'vcprixappris')[0];
  dit(!!r2 && r2.recette.rejouable === true && r2.recette.relu === 'liste' && r2.recette.modele === '/products/{produit}' && r2.recette.methode === 'PATCH', '« Mes articles » relu au NOUVEAU prix ⇒ recette apprise : PATCH /products/{produit}', JSON.stringify(r2));
  dit(!!r2 && JSON.stringify(r2.recette.fixes) === JSON.stringify([[['price', 'cents'], '{prixCents}', 'number']]) && JSON.stringify(r2.recette.entetes) === '["x-vc-auth"]', 'P1 · le corps en trous ({prixCents}), les NOMS des en-têtes seulement', JSON.stringify(r2 && [r2.recette.fixes, r2.recette.entetes]));
  dit(!JSON.stringify(a1.concat(a2).filter((x) => x.kind === 'vcprixappris')).includes(SECRET), 'P1 · la valeur d’un en-tête ne sort jamais dans la recette');
  capt.rec = r2 && r2.recette;
  // P1 bis — la réponse porte le nouveau prix.
  const q = chrome2();
  await q.appel('GET', URL_LISTE, liste([20000]));
  const b = await q.appel('PUT', `${API}/products/${ART}${Q}`, { data: { id: ART, type: 'product', price: { cents: 19000, currency: 'EUR' } } }, 200, JSON.stringify({ id: Number(ART), price: '190.00', currency: 'EUR' }));
  const rb = de(b, 'vcprixappris')[0];
  dit(!!rb && rb.recette.rejouable === true && rb.recette.relu === 'reponse' && JSON.stringify(rb.recette.fixes) === JSON.stringify([[['id'], '{produit}', 'number'], [['price'], '{prix}', 'string'], [['currency'], 'EUR', 'string']]), 'P1 · la réponse porte le nouveau prix ⇒ apprise tout de suite ({produit}, {prix} en euros, mots fixes)', JSON.stringify(rb));
  // P2 — annonce jamais vue, valeur inconnue, prix mal compris.
  const r = chrome2();
  await r.appel('GET', URL_LISTE, liste([20000]));
  const c1 = await r.appel('PATCH', `${API}/products/${INCONNU}${Q}`, null, 204, JSON.stringify({ price: { cents: 100 } }), 'text/plain');
  dit(!de(c1, 'vcprixappris').length, 'P2 · une annonce que la page n’a jamais montrée : rien n’est appris', JSON.stringify(c1));
  const c2 = await r.appel('PATCH', `${API}/products/${ART}${Q}`, null, 204, JSON.stringify({ price: { cents: 18000 }, note: 'Prix baissé pour Jeanne !' }), 'text/plain');
  const v2 = de(c2, 'vcprixappris')[0];
  dit(!!v2 && v2.recette.rejouable === false && v2.recette.raison === 'valeur-inconnue', 'P2 · une valeur qu’on ne sait pas refaire ⇒ « pas rejouable » (valeur-inconnue)', JSON.stringify(v2));
  const s = chrome2();
  await s.appel('GET', URL_LISTE, liste([20000]));
  await s.appel('PATCH', `${API}/products/${ART}${Q}`, null, 204, JSON.stringify({ amount: 18000 }), 'text/plain');
  const c3 = await s.appel('GET', URL_LISTE, liste([18000]));
  dit(!de(c3, 'vcprixappris').some((x) => x.recette.rejouable === true), 'P2 · des centimes sous une clé « amount » (lus en euros) : relu à un autre prix ⇒ JAMAIS appris', JSON.stringify(de(c3, 'vcprixappris')));
}

function systeme({ lectureKO } = {}) {
  let fond = null;
  const ch = chrome2((m) => { if (fond) fond.envoyer(m, { tab: { id: 41, url: ORIGINE + '/my-account/items/' }, frameId: 0 }); });
  fond = faireFond({ src: F.src, onglets: [{ id: 41, url: ORIGINE + '/my-account/items/', active: true, status: 'complete' }], lectureKO: lectureKO || (() => false) });
  const ordres = [];
  fond.ctx.chrome.tabs.sendMessage = (id, m, o, cb) => {
    if (m && m.__vmrEvt) { fond.j.evts.push(m.evt); if (typeof cb === 'function') cb(); return Promise.resolve(); }
    ordres.push({ id, m: copie(m) });
    return ch.ordre(m);
  };
  const cmd = (msg) => fond.envoyer(Object.assign({ from: 'vmr-bridge', action: 'cmd' }, msg), { origin: 'https://vrm.center', url: 'https://vrm.center/' });
  return { ch, fond, ordres, cmd };
}
const vues = async (S, prix = 20000) => {
  await S.ch.appel('GET', `${API}/users/me${Q}`, { data: { id: MOI, type: 'user' } });
  await attendre(30);
  await S.ch.appel('GET', URL_LISTE, liste([prix]));
  await attendre(80);
};
const apprendre = (S) => S.fond.envoyer({ from: 'cancale-vc', action: 'vcPrixAppris', recette: capt.rec }, { tab: { id: 41, url: ORIGINE + '/x' } });
async function p3p8() {
  const S = systeme();
  await vues(S);
  const it = S.fond.lignes.vc_listings && S.fond.lignes.vc_listings.items && S.fond.lignes.vc_listings.items[ART];
  dit(!!it && it.compte === MOI && it.prix && Math.round(it.prix.valeur * 100) === 20000, 'P3 · l’annonce rangée avec son compte et son prix lu', JSON.stringify(it));
  const r0 = await S.cmd({ cmd: 'vcPrix', produit: ART, avantCents: 20000, apresCents: 18000 });
  dit(r0 && r0.accepte === false && r0.code === 'pas-appris' && S.ordres.length === 0, 'P3 · sans recette apprise : RIEN ne part, le geste est dit', JSON.stringify(r0));
  await S.fond.envoyer({ from: 'cancale-vc', action: 'vcPrixAppris', recette: { methode: 'PATCH', hote: 'apiv2.vestiairecollective.com', chemin: '/products/{id}', rejouable: false, raison: 'pas-encore-relu' } }, { tab: { id: 41, url: ORIGINE + '/x' } });
  const r00 = await S.cmd({ cmd: 'vcPrix', produit: ART, avantCents: 20000, apresCents: 18000 });
  dit(r00 && r00.accepte === false && r00.code === 'pas-rejouable' && S.ordres.length === 0 && S.fond.lignes.vc_prix_recette && S.fond.lignes.vc_prix_recette.appris === false, 'P3 · « pas encore relu » : rien ne part, `vc_prix_recette.appris` = faux', JSON.stringify([r00, S.fond.lignes.vc_prix_recette]));
  await apprendre(S);
  dit(S.fond.lignes.vc_prix_recette && S.fond.lignes.vc_prix_recette.appris === true && !JSON.stringify(S.fond.lignes.vc_prix_recette).includes(SECRET), 'P3 · recette apprise ⇒ `vc_prix_recette.appris` vrai (aucune valeur d’en-tête)', JSON.stringify(S.fond.lignes.vc_prix_recette));
  // P5 — prix de l'aperçu ≠ prix lu.
  const r5 = await S.cmd({ cmd: 'vcPrix', produit: ART, avantCents: 21000, apresCents: 18000 });
  dit(r5 && r5.accepte === false && r5.code === 'prix-change' && S.ordres.length === 0, 'P5 · le prix lu n’est plus celui de l’aperçu : rien ne part', JSON.stringify(r5));
  // P4 — la baisse part.
  S.ch.routes[`PATCH ${API}/products/${ART}${Q}`] = { status: 204, body: null, ct: 'text/plain' };
  S.ch.routes[`GET ${URL_LISTE}`] = { status: 200, body: liste([18000]) };
  const n0 = S.ch.appels.length;
  const r4 = await S.cmd({ cmd: 'vcPrix', produit: ART, avantCents: 20000, apresCents: 18000 });
  const parti = S.ch.appels.slice(n0);
  const ecr = parti.filter((a) => a.m !== 'GET');
  dit(r4 && r4.accepte === true && r4.etape === 'fait' && r4.prixVu === 180 && r4.ancien === 200, 'P4 · « fait » au prix RELU (180 €), l’ancien dit (200 €)', JSON.stringify(r4));
  dit(ecr.length === 1 && ecr[0].m === 'PATCH' && ecr[0].u === `${API}/products/${ART}${Q}` && ecr[0].b === JSON.stringify({ price: { cents: 18000 } }) && ecr[0].h['x-vc-auth'] === SECRET, 'P4 · UNE écriture, exactement celle de la page (adresse, corps, en-tête repris DANS la page)', JSON.stringify(ecr));
  dit(parti.filter((a) => a.m === 'GET').length === 1 && parti.find((a) => a.m === 'GET').u === URL_LISTE, 'P4 · puis UNE relecture : « Mes articles » à la même adresse que la page', JSON.stringify(parti.map((a) => a.m + ' ' + a.u)));
  dit(((S.fond.store.vrmActions || {})['vc:' + MOI] || []).length === 1 && S.ordres.length === 1 && S.ordres[0].m.compte === MOI, 'P4 · une action comptée sous le compte Vestiaire ; l’ordre nomme le compte de l’onglet', JSON.stringify(S.fond.store.vrmActions));
  await attendre(80);
  const apres = S.fond.lignes.vc_listings.items[ART];
  dit(apres && Math.round(apres.prix.valeur * 100) === 18000, 'P4 · l’annonce rangée porte le prix RELU', JSON.stringify(apres && apres.prix));
  // P5 bis — la PAGE refuse si elle a vu un autre prix que celui que le fond croit.
  const T = systeme(); await vues(T, 20000); await apprendre(T);
  await T.ch.appel('GET', URL_LISTE, liste([19500]));   // la page voit 195 €
  await attendre(30);
  T.fond.lignes.vc_listings.items[ART].prix = { valeur: 200, devise: 'EUR', cle: 'product.price.cents' };   // la base croit encore 200 €
  const nT = T.ch.appels.length;
  const t5 = await T.cmd({ cmd: 'vcPrix', produit: ART, avantCents: 20000, apresCents: 18000 });
  dit(t5 && t5.accepte === false && t5.code === 'prix-change' && T.ch.appels.length === nT, 'P5 · la page a vu un autre prix que l’aperçu : la PAGE n’envoie rien', JSON.stringify(t5));
  // P8 — relu à un autre prix ⇒ écart ; relecture impossible ⇒ incertain.
  const E = systeme(); await vues(E); await apprendre(E);
  E.ch.routes[`PATCH ${API}/products/${ART}${Q}`] = { status: 204, body: null, ct: 'text/plain' };
  E.ch.routes[`GET ${URL_LISTE}`] = { status: 200, body: liste([20000]) };
  const e1 = await E.cmd({ cmd: 'vcPrix', produit: ART, avantCents: 20000, apresCents: 18000 });
  dit(e1 && e1.accepte === true && e1.etape === 'ecart' && e1.prixVu === 200, 'P8 · 2xx mais relu à l’ancien prix ⇒ « écart » (le prix relu dit), jamais « fait »', JSON.stringify(e1));
  const E2 = systeme(); await vues(E2); await apprendre(E2);
  E2.ch.routes[`PATCH ${API}/products/${ART}${Q}`] = { status: 204, body: null, ct: 'text/plain' };
  E2.ch.routes[`GET ${URL_LISTE}`] = { status: 500, body: { message: 'x' } };
  const e2 = await E2.cmd({ cmd: 'vcPrix', produit: ART, avantCents: 20000, apresCents: 18000 });
  dit(e2 && e2.accepte === true && e2.etape === 'incertain', 'P8 · relecture impossible ⇒ « je ne sais pas », jamais « fait »', JSON.stringify(e2));
  // P6 — plafond, pause.
  const P = systeme(); await vues(P); await apprendre(P);
  P.fond.store.vrmActions = { ['vc:' + MOI]: Array.from({ length: 45 }, () => Date.now()) };
  const p1 = await P.cmd({ cmd: 'vcPrix', produit: ART, avantCents: 20000, apresCents: 18000 });
  dit(p1 && p1.accepte === false && p1.code === 'plafond' && P.ordres.length === 0, 'P6 · 45 actions dans l’heure (réserve de 5 gardée) : refus, rien ne part', JSON.stringify(p1));
  P.fond.store.vrmActions = {};
  P.ch.routes[`PATCH ${API}/products/${ART}${Q}`] = { status: 429, body: { message: 'too many' } };
  const p2 = await P.cmd({ cmd: 'vcPrix', produit: ART, avantCents: 20000, apresCents: 18000 });
  const p3 = await P.cmd({ cmd: 'vcPrix', produit: ART, avantCents: 20000, apresCents: 17000 });
  dit(p2 && p2.etape === 'echec' && p2.statut === 429 && P.fond.store.vrmPauseVc && p3 && p3.code === 'vc-pause' && P.ordres.length === 1, 'P6 · un 429 pose la pause ; pendant la pause RIEN ne part', JSON.stringify({ p2, p3, n: P.ordres.length }));
  // P7 — autre compte.
  const A = systeme(); await vues(A); await apprendre(A);
  await A.fond.ctx.noterSessionVc('77778888', 41, []);
  const a1 = await A.cmd({ cmd: 'vcPrix', produit: ART, avantCents: 20000, apresCents: 18000 });
  dit(a1 && a1.accepte === false && a1.code === 'autre-compte' && A.ordres.length === 0, 'P7 · l’onglet est sur un AUTRE compte : rien ne part', JSON.stringify(a1));
  const B = systeme(); await vues(B); await apprendre(B);
  await B.ch.appel('GET', `${API}/users/me${Q}`, { data: { id: '55556666', type: 'user' } }); await attendre(30);
  await B.fond.ctx.noterSessionVc(MOI, 41, []);
  const nB = B.ch.appels.length;
  const b1 = await B.cmd({ cmd: 'vcPrix', produit: ART, avantCents: 20000, apresCents: 18000 });
  dit(b1 && b1.accepte === false && b1.code === 'autre-compte' && B.ch.appels.length === nB, 'P7 · la page montre un autre compte que celui que le fond attend : la PAGE n’envoie rien', JSON.stringify(b1));
  const Z = systeme();
  await Z.ch.appel('GET', URL_LISTE, liste([20000])); await attendre(60); await apprendre(Z);
  const z1 = await Z.cmd({ cmd: 'vcPrix', produit: ART, avantCents: 20000, apresCents: 18000 });
  dit(z1 && z1.accepte === false && z1.code === 'session' && Z.ordres.length === 0, 'P7 · une annonce dont le compte n’est pas su : rien ne part', JSON.stringify(z1));
  await Z.fond.ctx.noterSessionVc(MOI, 41, []);
  const z2 = await Z.cmd({ cmd: 'vcPrix', produit: ART, avantCents: 20000, apresCents: 18000 });
  dit(z2 && z2.accepte === false && z2.code === 'session' && Z.ordres.length === 0, 'P7 · … même si l’onglet dit un compte : l’annonce n’est jamais prêtée au compte de l’onglet', JSON.stringify(z2));
  const inv = await S.cmd({ cmd: 'vcPrix', produit: ART, avantCents: 18000, apresCents: 19000 });
  dit(inv && inv.accepte === false && inv.code === 'invalide', 'P4 · une « baisse » vers un prix plus haut est refusée', JSON.stringify(inv));
  const etat = await S.fond.envoyer({ from: 'vmr-bridge', action: 'etat' }, { origin: 'https://vrm.center', url: 'https://vrm.center/' });
  dit(etat && etat.vcPrix === true, 'P4 · l’état de l’extension dit `vcPrix: true`', JSON.stringify(etat && Object.keys(etat)));
}

// P10 — le PRIX DE VENTE (`sellerPrice`, 5.340) traverse page → vc.js → fond jusqu'à `vc_ventes`
// (défaut trouvé le 11 nov. : vc.js ne le relayait pas, la facture Pro Vestiaire ne l'avait jamais).
async function p10() {
  const S = systeme();
  await S.ch.appel('GET', `${API}/users/me${Q}`, { data: { id: MOI, type: 'user' } }); await attendre(30);
  await S.ch.appel('GET', `${API}/users/me/awaiting-shipping-items${Q}`, { data: [{ id: '72987282', productId: '72987282', brandName: 'Nike', productName: 'Dunk Low', sellerEarning: '203,23 €', sellerPrice: '250,00 €', shipByDate: '2026-11-20T23:59:59+01:00' }], meta: { count: 1 } });
  await attendre(120);
  const v = S.fond.lignes.vc_ventes && S.fond.lignes.vc_ventes.ventes && Object.values(S.fond.lignes.vc_ventes.ventes)[0];
  dit(!!v && v.prixVente && v.prixVente.valeur === 250 && v.prixVente.cle === 'sellerPrice' && v.montant && v.montant.cle === 'sellerEarning', 'P10 · le prix de vente (`sellerPrice` 250 €) arrive dans `vc_ventes` par le VRAI relais vc.js (le versé reste à part)', JSON.stringify(v && { prixVente: v.prixVente, montant: v.montant }));
}

async function p9() {
  const APP = fs.readFileSync(F.app, 'utf8');
  const cap = /const EXT_CAPACITES\s*=\s*\{([^}]*)\}/.exec(APP);
  dit(!!cap && /\bvcprix:\s*'5\.364\.0'/.test(cap[1]), 'P9 · `EXT_CAPACITES.vcprix` = 5.364.0');
  const R = await import(pathToFileURL(F.regle).href);
  const B = await import(pathToFileURL(path.join(path.dirname(F.regle), 'baissePrix.js')).href);
  dit(R.etatRecettePrixVc({ appris: true }, 'ok').etat === 'pret' && R.etatRecettePrixVc({ appris: false, raison: 'x' }, 'ok').etat === 'pas-sur' && R.etatRecettePrixVc({}, 'ok').etat === 'pas-appris' && R.etatRecettePrixVc(null, 'ok').etat === 'passu' && R.etatRecettePrixVc({ appris: true }, 'retard').etat === 'ext-retard', 'P9 · « prêt » seulement appris ET extension à jour ; sinon dit (pas appris · pas sûr · pas su · extension)');
  const it = (c) => ({ prix: { valeur: c / 100, devise: 'EUR', cle: 'product.price.cents' } });
  const L = R.lignesBaisseVc({ annonces: [{ id: '1001', compte: MOI, it: it(20000) }, { id: '1002', compte: '999', it: it(20000) }, { id: '1003', compte: '', it: it(20000) }, { id: '1004', compte: MOI, it: { prix: { valeur: 200, cle: 'sellerEarnings' } } }], baisse: B.baisseTapee('eur', '15'), compteOnglet: MOI });
  dit(L[0].apres === 18500 && L[0].coche && L[1].bloque === 'autre-compte' && L[2].bloque === 'compte-inconnu' && L[3].bloque === 'prix-pas-lu', 'P9 · l’aperçu : 200 € − 15 € ⇒ 185 € ; autre compte, compte pas su, prix pas lu (clé « earnings ») ⇒ ne part pas', JSON.stringify(L.map((x) => [x.id, x.apres, x.bloque])));
  dit(R.issueBaisseVc({ accepte: true, etape: 'fait' }).etat === 'incertain' && R.issueBaisseVc({ accepte: true, etape: 'fait', prixVu: 180 }).etat === 'fait' && R.issueBaisseVc({ accepte: false, code: 'plafond' }).arret === true && R.issueBaisseVc(null).etat === 'incertain', 'P9 · « fait » seulement avec le prix relu ; le plafond arrête la série ; pas de réponse ⇒ « pas relu »');
}

(async () => {
  for (const [nom, f] of [['P1-P2', p1p2], ['P3-P8', p3p8], ['P9', p9], ['P10', p10]]) {
    try { await f(); } catch (e) { dit(false, `${nom} : l’audit a tourné jusqu’au bout`, String((e && e.stack) || e).slice(0, 500)); }
  }
  console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s)` : '\n✅ baisse de prix Vestiaire : tout est vert');
  process.exit(ko ? 1 : 0);
})();
