// ════════════════════════════════════════════════════════════════════════════
//  OFFRES VESTIAIRE : LES VOIR ET Y RÉPONDRE SUR SON CLIC (4 nov., 5.319)
//
//  Julien a choisi « voir les offres reçues sur Vestiaire et y répondre depuis
//  VRM ». MESURÉ (lecture seule, 4 nov.) : `GET apiv2…/negotiations?role=seller
//  &withEvents=true` ⇒ `{ data: [ { id, type: 'negotiation', product, events:
//  [{ action, createdBy, price: { cents }, sellerPvnPrice, creationDate }],
//  isOpened, isClosed, isAccepted, initialPrice, minOffer, expirationDate,
//  buyer, seller } ] }`. La requête de RÉPONSE n'a jamais été vue : elle doit
//  s'APPRENDRE d'une réponse faite à la main (ici une forme INVENTÉE, puisque
//  la vraie est inconnue — c'est la règle d'apprentissage qu'on juge).
//
//  VRAI vc-inject.js + VRAI vc.js + VRAI background.js, reliés comme dans
//  Chrome (fenêtre partagée, `chrome.tabs.sendMessage` → vc.js → page) ;
//  données INVENTÉES (le dépôt est public).
//   O1  la liste ⇒ des fiches : article, prix, gestes datés, « à toi » ;
//       jamais l'acheteur (nom, pseudo, avatar, identifiant).
//   O2  une forme inconnue n'est pas une liste vide ; rôle acheteur écarté.
//   O3  TA réponse à la main ⇒ la recette de CE geste (trous {nego} {produit}
//       {acheteur} {prixCents}), jamais une valeur d'en-tête ; une valeur
//       inconnue ⇒ « pas rejouable » ; une offre jamais vue ⇒ « pas rejouable ».
//   O4  le fond range `vc_offres` (clés `n{id}`), compte page = onglet ;
//       lecture ratée ⇒ rien ; une offre ne change jamais de compte.
//   O5  répondre : sans recette ⇒ rien ne part ; avec ⇒ UNE requête, la même
//       que la page, au nom du compte de l'onglet ; « fait » seulement si
//       Vestiaire renvoie TON geste ; plafond 50/h ; pause 429 ; autre compte ;
//       plus à toi ; contre-offre hors bornes.
//   O6  l'app : `EXT_CAPACITES.vcoffres/vcoffrerepondre` = 5.319.0.
//  `--src`/`--inject`/`--relais` : une autre copie (preuve sur le code d'avant).
//  `--prouve` : chaque règle réaffaiblie doit faire rougir l'audit.
// ════════════════════════════════════════════════════════════════════════════
require('./_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os');
const { spawnSync } = require('child_process');
const { faireFond } = require('./_fond-vm.cjs');
const racine = path.join(__dirname, '..');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? path.resolve(process.argv[i + 1]) : d; };
const F = {
  src: arg('--src', path.join(racine, 'vinted-sync-extension/background.js')),
  inject: arg('--inject', path.join(racine, 'vinted-sync-extension/vc-inject.js')),
  relais: arg('--relais', path.join(racine, 'vinted-sync-extension/vc.js')),
  app: arg('--app', path.join(racine, 'src/App.jsx')),
};

if (process.argv.includes('--prouve')) {
  const MUT = [
    ['acheteurSort', 'inject', "const ficheSortie = (f) => { const o = Object.assign({}, f); delete o._acheteur; delete o._vendeur; return o; };", 'const ficheSortie = (f) => Object.assign({}, f);'],
    ['aToiDevine', 'inject', "aToi: !!(ouverte && der && der.action === 'offer' && der.par === 'acheteur'),", 'aToi: ouverte,'],
    ['roleAcheteur', 'inject', "if (/(^|[?&])role=buyer(&|$)/i.test(u.search)) return;", ''],
    ['inconnuVide', 'inject', "if (fiches.some((f) => !f)) { post({ kind: 'vcoffres', offres: [], liste: false, inconnu: cheminsDeCles(obj).map(sansId).slice(0, 60), page: pageIci(), moi: moiId }); return; }", 'if (fiches.some((f) => !f)) { post({ kind: \'vcoffres\', offres: [], liste: true, page: pageIci(), moi: moiId }); return; }'],
    ['valeurInconnue', 'inject', "        return non('valeur-inconnue');\n      }\n    }\n    if (geste === 'contre'", "        fixes.push([cles, v, typeof v]); continue;\n      }\n    }\n    if (geste === 'contre'"],
    ['nonVue', 'inject', "if (!negosVues.has(f.id)) return non('offre-non-vue');", ''],
    ['pageCompte', 'inject', "if (d.compte !== undefined && (!moiId || String(d.compte) !== moiId)) return fin({ statut: 0, erreur: moiId ? 'autre-compte' : 'compte-pas-su' });\n    const mem = negosVues.get(nego);", 'const mem = negosVues.get(nego);'],
    ['plusAToiPage', 'inject', "if (!mem.aToi) return fin({ statut: 0, erreur: 'plus-a-toi' });", ''],
    ['fondPasAppris', 'src', "if (recette.rejouable !== true) return { accepte: false, code: 'pas-rejouable', raison: `la façon dont Vestiaire enregistre ce geste", "if (false) return { accepte: false, code: 'pas-rejouable', raison: `la façon dont Vestiaire enregistre ce geste"],
    ['fondPlafond', 'src', "    const cpt = await compterAction('vc:' + ot.compte, ACTIONS_MAX_HEURE);\n    if (!cpt.ok && cpt.code === 'stockage') return { accepte: false, code: 'stockage', raison: RAISON_STOCKAGE };\n    if (!cpt.ok) return { accepte: false, code: 'plafond', raison: `déjà ${ACTIONS_MAX_HEURE} actions sur ce compte Vestiaire", "    const cpt = { ok: true, at: Date.now() };\n    if (!cpt.ok) return { accepte: false, code: 'plafond', raison: `déjà ${ACTIONS_MAX_HEURE} actions sur ce compte Vestiaire"],
    ['fondPause', 'src', "    const pause = await pauseVc();\n    if (pause) return { accepte: false, code: 'vc-pause', raison: `Vestiaire a demandé de ralentir (${pause.statut || 'refus'}) — rien n'est parti, réessaie après ${new Date(pause.jusqua).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` };\n    let tout;", '    let tout;'],
    ['fondConfirme', 'src', "if (rep.confirme !== true) return { accepte: true, etape: 'incertain'", "if (false) return { accepte: true, etape: 'incertain'"],
    ['fondCompte', 'src', "if (p && p.compte && o.compte && p.compte !== o.compte) continue;", ''],
    ['fondExpiree', 'src', "if (o.expire && Date.parse(o.expire) < Date.now()) return { accepte: false, code: 'expiree',", "if (false) return { accepte: false, code: 'expiree',"],
    ['fondPlusAToi', 'src', "if (o.aToi !== true) return { accepte: false, code: 'plus-a-toi',", "if (false) return { accepte: false, code: 'plus-a-toi',"],
    ['fondBornes', 'src', "if (geste === 'contre' && ((o.offre != null && prixCents <= o.offre) || (o.initial != null && prixCents >= o.initial))) return", 'if (false) return'],
    ['fondSansCompte', 'src', "if (!compteOffre) return { accepte: false, code: 'session',", "if (false) return { accepte: false, code: 'session',"],
  ];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-vc-offres-'));
  let tous = true;
  for (const [nom, cle, avant, apres] of MUT) {
    const txt = fs.readFileSync(F[cle], 'utf8');
    if (!txt.includes(avant)) { console.log(`❌ mutation ${nom} : texte introuvable`); tous = false; continue; }
    const fichier = path.join(tmp, nom + '-' + path.basename(F[cle]));
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
const dit = (ok, nom, det) => { if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${ok || !det ? '' : ' — ' + String(det).slice(0, 400)}`); };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const copie = (x) => JSON.parse(JSON.stringify(x));
const API = 'https://apiv2.vestiairecollective.com';
const ORIGINE = 'https://fr.vestiairecollective.com';
const Q = '?isoCountry=FR&x-siteid=1&x-language=fr&x-currency=EUR';

// Tout est INVENTÉ — seules les FORMES de la liste suivent la mesure.
const MOI = '11112222', ACH = '33334444', ART1 = '66668888', ART2 = '99990000', N1 = '170000001', N2 = '170000002', N3 = '170000003';
const PERSO = ['jeanne33334444', 'Jeanne', 'avatar-jeanne', ACH, 'secret-entete'];
const fuite = (o) => { const s = JSON.stringify(o == null ? null : o); return PERSO.filter((x) => s.includes(x)); };
const eur = (c) => ({ cents: c, currency: 'EUR', formatted: `${c / 100} €` });
// (5 nov.) L'échéance de l'offre ouverte est posée SEPT JOURS après l'heure du
// banc, plus une date écrite en dur : le 5 nov. à 19 h 23 UTC, « 2026-11-05T19:23:33Z »
// est passée et le fond refusait, à juste titre, une offre EXPIRÉE — toute la
// suite O5 virait au rouge avec l'horloge. La règle « expirée ⇒ rien ne part »
// est jugée À PART (O5, plus bas), avec une échéance passée.
const EXPIRE = new Date(Date.now() + 7 * 864e5).toISOString().replace(/\.\d{3}Z$/, 'Z');
const EXPIREE = new Date(Date.now() - 3600e3).toISOString().replace(/\.\d{3}Z$/, 'Z');
const user = (id, nom) => ({ id, type: 'user', username: nom + id, firstname: nom, picture: { path: '/profil/avatar-jeanne.gif' }, hasWallet: false });
const ev = (action, par, c, at) => ({ id: String(Math.floor(Math.random() * 1e9)), type: 'negotiationEvent', price: eur(c), action, createdBy: par, userMessage: 'x', creationDate: at, sellerPvnPrice: eur(Math.round(c * 0.8)) });
const nego = (id, art, events, o) => Object.assign({ id, type: 'negotiation', buyer: user(ACH, 'Jeanne'), seller: user(MOI, 'Julien'), price: events[0].price, events,
  product: { id: art, name: 'Baskets Dunk Low', brand: { name: 'Nike' }, pictures: [{ alt: 'Baskets', path: `${art}-1_2.jpg` }], path: `/men-shoes/trainers/nike/baskets-nike-${art}.shtml`, price: eur(26200) },
  isClosed: false, isOpened: true, isAccepted: false, initialPrice: eur(24900), minOffer: eur(17500), maxOffer: eur(24900), expirationDate: EXPIRE, sellerRemainingOffers: 2, buyerRemainingOffers: 3 }, o || {});
const NA = nego(N1, ART1, [ev('offer', 'buyer', 20000, '2026-11-04T08:00:00Z')]);                                   // à toi
const NB = nego(N2, ART2, [ev('offer', 'seller', 23700, '2026-11-03T19:23:33Z')]);                                  // ton offre à un favori
const NC = nego(N3, ART1, [ev('accept', 'seller', 22000, '2026-10-31T12:00:01Z'), ev('offer', 'buyer', 22000, '2026-10-31T11:59:39Z')], { isClosed: true, isOpened: false, isAccepted: true, expirationDate: null });
const LISTE = { data: [NA, NB, NC], meta: null };

// ── Le VRAI vc-inject.js + le VRAI vc.js, sur une fenêtre partagée ───────────
function chrome2(bus) {
  const INJ = fs.readFileSync(F.inject, 'utf8'), REL = fs.readFileSync(F.relais, 'utf8');
  const posts = [], appels = [], envois = [];
  const routes = {};
  const rep = (m, u) => routes[m + ' ' + u] || routes['* ' + u] || { status: 404, body: { message: 'introuvable' } };
  const ecoutesPage = [], ecoutesRel = [];
  const winP = {}, winR = {};
  const diffuser = (m) => { const d = copie(m); posts.push(d); for (const f of ecoutesPage.slice()) f({ source: winP, data: copie(d) }); for (const f of ecoutesRel.slice()) f({ source: winR, data: copie(d) }); };
  Object.assign(winP, { postMessage: diffuser, addEventListener: (t, f) => { if (t === 'message') ecoutesPage.push(f); },
    fetch: async (u, init) => {
      const m = String((init && init.method) || 'GET').toUpperCase();
      appels.push({ u: String(u), m, h: copie((init && init.headers) || {}), b: init && init.body });
      const r = rep(m, String(u).replace(/^https:\/\/[^/]+/, (x) => x));
      const texte = typeof r.body === 'string' ? r.body : JSON.stringify(r.body);
      return { status: r.status, ok: r.status >= 200 && r.status < 300, headers: { get: () => 'application/json; charset=utf-8' }, clone() { return this; }, text: async () => texte, arrayBuffer: async () => new ArrayBuffer(0) };
    } });
  winP.top = winP; winP.self = winP;
  const ctxP = { window: winP, document: { currentScript: {}, createElement: () => ({}), head: { appendChild() {} }, addEventListener() {}, getElementById: () => null, readyState: 'complete' },
    location: { origin: ORIGINE, hostname: 'fr.vestiairecollective.com', pathname: '/my-account/offers/', href: ORIGINE + '/my-account/offers/' }, history: { pushState() {}, replaceState() {} },
    URL, console: { log() {}, warn() {}, error() {} }, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {}, JSON, Date, Math, Map, Set, Promise, encodeURIComponent, btoa: (x) => Buffer.from(x, 'latin1').toString('base64'), Uint8Array, ArrayBuffer, String, Number };
  vm.createContext(ctxP); vm.runInContext(INJ, ctxP, { filename: 'vc-inject.js' });
  let ecouteOrdre = null;
  Object.assign(winR, { postMessage: diffuser, addEventListener: (t, f) => { if (t === 'message') ecoutesRel.push(f); } });
  winR.top = winR;
  const ctxR = { window: winR, self: { crypto: { randomUUID: () => 'aaaaaaaa-bbbb-cccc-dddd-' + String(Date.now()).padStart(12, '0') } }, crypto: { randomUUID: () => 'aaaaaaaa-bbbb-cccc-dddd-' + String(Math.floor(Math.random() * 1e12)).padStart(12, '0') },
    chrome: { runtime: { id: 'banc', sendMessage: (m, cb) => { envois.push(copie(m)); if (bus) bus(copie(m)); if (cb) cb(); }, lastError: null, onMessage: { addListener(f) { if (!ecouteOrdre || true) ecouteOrdre = ecouteOrdre ? [].concat(ecouteOrdre, f) : f; } } } },
    location: { href: ORIGINE + '/my-account/offers/' }, URL, console, setTimeout, clearTimeout, JSON, Date, Math, Map, Set, Number, String };
  vm.createContext(ctxR); vm.runInContext(REL, ctxR, { filename: 'vc.js' });
  // Ce que fait Chrome : l'ordre du fond arrive aux écouteurs de vc.js.
  const ordre = (m) => new Promise((res) => {
    const ls = [].concat(ecouteOrdre || []);
    let rendu = false;
    for (const f of ls) { const r = f(copie(m), { id: 'banc' }, (x) => { rendu = true; res(copie(x)); }); if (r === true) return; }
    if (!rendu) res(undefined);
  });
  const appel = async (m, url, corps, status = 200, envoye, entetes) => {
    routes[m + ' ' + url] = { status, body: corps };
    const n = posts.length;
    await winP.fetch(url, { method: m, body: envoye, headers: entetes || { 'content-type': 'application/json', 'x-vc-auth': 'secret-entete' } });
    await attendre(25);
    return posts.slice(n);
  };
  return { appel, posts, appels, envois, ordre, routes };
}
const de = (posts, k) => posts.filter((x) => x.kind === k);
const URL_LISTE = `${API}/negotiations${Q}&role=seller&withEvents=true`;

let capt = {};
async function o1a3() {
  const p = chrome2();
  const l = await p.appel('GET', URL_LISTE, LISTE);
  const o = de(l, 'vcoffres')[0];
  const a = o && o.offres.find((x) => x.id === N1), b = o && o.offres.find((x) => x.id === N2), c = o && o.offres.find((x) => x.id === N3);
  dit(!!o && o.liste === true && o.offres.length === 3, 'O1 · la liste des négociations (rôle vendeur) ⇒ trois fiches', JSON.stringify(o && o.offres.map((x) => x.id)));
  dit(!!a && a.aToi === true && a.offre === 20000 && a.initial === 24900 && a.min === 17500 && a.net === 16000 && a.produit === ART1 && a.expire === EXPIRE, 'O1 · l’offre de l’acheteur, ouverte, dernier geste à lui ⇒ « à toi de répondre », prix en centimes, ce que tu touches, expiration', JSON.stringify(a));
  dit(!!a && a.titre === 'Nike Baskets Dunk Low' && a.photo === `https://images.vestiairecollective.com/produit/${ART1}-1_2.jpg` && /baskets-nike-66668888\.shtml$/.test(a.lien), 'O1 · l’article : titre, photo, lien Vestiaire', JSON.stringify(a && [a.titre, a.photo, a.lien]));
  dit(!!b && b.aToi === false && b.dernier.par === 'vendeur' && !!c && c.aToi === false && c.acceptee === true && c.fermee === true, 'O1 · ta propre offre (en attente de l’acheteur) et une offre acceptée ne sont pas « à toi »', JSON.stringify([b && b.aToi, c && [c.aToi, c.acceptee]]));
  dit(!!c && c.evenements.map((e) => e.action + '/' + e.par).join() === 'offer/acheteur,accept/vendeur', 'O1 · les gestes, du plus ancien au plus récent', JSON.stringify(c && c.evenements));
  // (La capture BRUTE de la 5.315 — `vcbrut`, voulue par Julien — garde la réponse entière ; elle n'est pas jugée ici.)
  dit(fuite(l.filter((x) => x.kind !== 'vcbrut')).length === 0, 'O1 · jamais l’acheteur : ni nom, ni pseudo, ni avatar, ni identifiant', fuite(l.filter((x) => x.kind !== 'vcbrut')).join(','));
  capt.liste = l;
  // O2 : forme inconnue, rôle acheteur.
  const inc = await p.appel('GET', `${API}/negotiations${Q}&role=seller&x=1`, { data: [{ id: '1', type: 'autre' }] });
  const im = de(inc, 'vcoffres')[0];
  dit(!!im && Array.isArray(im.inconnu) && im.offres.length === 0 && im.liste === false, 'O2 · une forme inconnue part comme « forme inconnue », jamais comme une liste vide', JSON.stringify(im));
  const ach = await p.appel('GET', `${API}/negotiations${Q}&role=buyer&withEvents=true`, LISTE);
  dit(!de(ach, 'vcoffres').length, 'O2 · tes offres d’ACHETEUR (role=buyer) ne sont pas des offres à trancher', JSON.stringify(ach.map((x) => x.kind)));
  const cond = await p.appel('GET', `${API}/products/${ART1}/negotiation-initial-conditions-view${Q}&buyer_id=${ACH}`, { data: { minOffer: eur(17500) } });
  dit(!de(cond, 'vcoffres').length, 'O2 · les conditions d’une offre ne sont pas une offre', JSON.stringify(cond.map((x) => x.kind)));

  // O3 : TES réponses à la main (forme INVENTÉE) ⇒ les recettes.
  const acc = nego(N1, ART1, [ev('accept', 'seller', 20000, '2026-11-04T09:00:00Z'), NA.events[0]], { isAccepted: true, isOpened: false, isClosed: true });
  const ra = await p.appel('PUT', `${API}/negotiations/${N1}${Q}`, { data: acc }, 200, JSON.stringify({ action: 'accept', price: { cents: 20000 } }));
  const recA = de(ra, 'vcoffreappris')[0];
  dit(!!recA && recA.recette.geste === 'accepter' && recA.recette.rejouable === true && recA.recette.modele === '/negotiations/{nego}' && recA.recette.methode === 'PUT', 'O3 · ton « Accepter » à la main ⇒ la recette « accepter » : PUT /negotiations/{nego}', JSON.stringify(recA));
  dit(!!recA && JSON.stringify(recA.recette.fixes) === JSON.stringify([[['action'], 'accept', 'string'], [['price', 'cents'], '{prixCents}', 'number']]) && JSON.stringify(recA.recette.entetes) === '["x-vc-auth"]', 'O3 · le corps en trous (le prix ⇒ {prixCents}), les NOMS des en-têtes seulement', JSON.stringify(recA && [recA.recette.fixes, recA.recette.entetes]));
  dit(fuite(ra.filter((x) => x.kind === 'vcoffreappris')).length === 0, 'O3 · ni la valeur d’un en-tête ni l’acheteur ne sortent dans la recette', fuite(ra).join(','));
  const ac = de(ra, 'vcoffres')[0];
  dit(!!ac && ac.offres[0].id === N1 && ac.offres[0].aToi === false && ac.offres[0].acceptee === true, 'O3 · la réponse range aussi l’offre à jour (acceptée, plus à toi)', JSON.stringify(ac && ac.offres[0]));
  // La contre-offre : sur une autre offre ouverte.
  const p2 = chrome2();
  await p2.appel('GET', URL_LISTE, LISTE);
  const ctr = nego(N1, ART1, [ev('offer', 'seller', 23000, '2026-11-04T09:10:00Z'), NA.events[0]]);
  const rc = await p2.appel('POST', `${API}/products/${ART1}/negotiations/${N1}/events${Q}`, { data: ctr }, 201, JSON.stringify({ type: 'offer', buyerId: Number(ACH), amount: '230.00' }));
  const recC = de(rc, 'vcoffreappris')[0];
  dit(!!recC && recC.recette.geste === 'contre' && recC.recette.rejouable === true && recC.recette.modele === '/products/{produit}/negotiations/{nego}/events' && JSON.stringify(recC.recette.fixes) === JSON.stringify([[['type'], 'offer', 'string'], [['buyerId'], '{acheteur}', 'number'], [['amount'], '{prix}', 'string']]), 'O3 · ta contre-offre ⇒ la recette « contre » ({produit}, {nego}, {acheteur}, {prix})', JSON.stringify(recC));
  const ref = nego(N1, ART1, [ev('decline', 'seller', 20000, '2026-11-04T09:20:00Z'), NA.events[0]], { isClosed: true, isOpened: false });
  const p3 = chrome2(); await p3.appel('GET', URL_LISTE, LISTE);
  const rr = await p3.appel('POST', `${API}/negotiations/${N1}/decline${Q}`, { data: ref }, 200, JSON.stringify({ reason: 'Trop bas, 150 € mini' }));
  const recR = de(rr, 'vcoffreappris')[0];
  dit(!!recR && recR.recette.geste === 'refuser' && recR.recette.rejouable === false && recR.recette.raison === 'valeur-inconnue', 'O3 · un corps avec une valeur qu’on ne sait pas refaire ⇒ « pas rejouable » (valeur-inconnue)', JSON.stringify(recR));
  const p4 = chrome2();
  const rv = await p4.appel('PUT', `${API}/negotiations/${N1}${Q}`, { data: acc }, 200, JSON.stringify({ action: 'accept' }));
  const recV = de(rv, 'vcoffreappris')[0];
  dit(!!recV && recV.recette.rejouable === false && recV.recette.raison === 'offre-non-vue', 'O3 · une offre que la page n’avait jamais montrée ⇒ « pas rejouable » (offre-non-vue)', JSON.stringify(recV));
  // Une offre que TU fais à un favori (pas une réponse) : aucune recette.
  const p5 = chrome2();
  const rf = await p5.appel('POST', `${API}/products/${ART2}/negotiations${Q}`, { data: NB }, 200, JSON.stringify({ buyerId: Number(ACH), price: { cents: 23700 } }));
  dit(!de(rf, 'vcoffreappris').length && de(rf, 'vcoffres').length === 1, 'O3 · ton offre spontanée à un favori n’est pas une réponse : aucune recette (l’offre est rangée)', JSON.stringify(rf.map((x) => x.kind)));
  capt.recA = recA && recA.recette; capt.recC = recC && recC.recette; capt.recR = recR && recR.recette;
}

// ── Le fond, relié à la page par chrome.tabs.sendMessage ───────────────────
function systeme({ lectureKO, rep } = {}) {
  let fond = null;
  const ch = chrome2((m) => { if (fond) fond.envoyer(m, { tab: { id: 41, url: ORIGINE + '/my-account/offers/' }, frameId: 0 }); });
  fond = faireFond({ src: F.src, onglets: [{ id: 41, url: ORIGINE + '/my-account/offers/', active: true, status: 'complete' }], lectureKO: lectureKO || (() => false) });
  const ordres = [];
  fond.ctx.chrome.tabs.sendMessage = (id, m, o, cb) => {
    if (m && m.__vmrEvt) { fond.j.evts.push(m.evt); if (typeof cb === 'function') cb(); return Promise.resolve(); }
    ordres.push({ id, m: copie(m) });
    return rep ? Promise.resolve(rep(m)) : ch.ordre(m);
  };
  const cmd = (msg) => fond.envoyer(Object.assign({ from: 'vmr-bridge', action: 'cmd' }, msg), { origin: 'https://vrm.center', url: 'https://vrm.center/' });
  return { ch, fond, ordres, cmd };
}
const vuesDeLaPage = async (S) => {
  // La page dit son compte (Stream ou /users/me), puis montre ses offres.
  S.ch.routes[`GET ${API}/users/me${Q}`] = { status: 200, body: { data: { id: MOI, type: 'user' } } };
  await S.ch.appel('GET', `${API}/users/me${Q}`, { data: { id: MOI, type: 'user' } });
  await attendre(30);
  await S.ch.appel('GET', URL_LISTE, LISTE);
  await attendre(60);
};
async function o4o5() {
  const S = systeme();
  await vuesDeLaPage(S);
  const ln = S.fond.lignes.vc_offres;
  const o = ln && ln.offres && ln.offres['n' + N1];
  dit(!!o && o.aToi === true && o.compte === MOI && o.offre === 20000 && !!ln.offres['n' + N2] && !!ln.offres['n' + N3], 'O4 · `vc_offres` rangé (clés `n{id}`), le compte = celui de la page ET de l’onglet', JSON.stringify(ln && Object.keys(ln.offres)));
  const sansBrut = Object.fromEntries(Object.entries(S.fond.lignes).filter(([k]) => !/^vc_brut_/.test(k)));
  dit(fuite(sansBrut).length === 0 && !!sansBrut.vc_offres, 'O4 · aucun acheteur dans ce que le fond écrit (hors capture brute 5.315)', fuite(sansBrut).join(','));
  // Répondre sans recette : rien ne part.
  const r0 = await S.cmd({ cmd: 'vcOffre', nego: N1, geste: 'accepter' });
  dit(r0 && r0.accepte === false && r0.code === 'pas-appris' && S.ordres.length === 0, 'O5 · sans recette apprise : RIEN ne part, le geste est dit', JSON.stringify(r0));
  // Une recette « pas rejouable » ne permet rien.
  if (capt.recR) await S.fond.envoyer({ from: 'cancale-vc', action: 'vcOffreAppris', recette: capt.recR }, { tab: { id: 41, url: ORIGINE + '/x' } });
  const r00 = await S.cmd({ cmd: 'vcOffre', nego: N1, geste: 'refuser' });
  dit(r00 && r00.accepte === false && r00.code === 'pas-rejouable' && S.ordres.length === 0, 'O5 · une recette « pas rejouable » : RIEN ne part', JSON.stringify(r00));
  dit(S.fond.lignes.vc_offres_recette && S.fond.lignes.vc_offres_recette.refuser && S.fond.lignes.vc_offres_recette.refuser.appris === false && S.fond.lignes.vc_offres_recette.refuser.raison === 'valeur-inconnue', 'O5 · `vc_offres_recette` dit à l’app : « refuser » pas appris (valeur-inconnue)', JSON.stringify(S.fond.lignes.vc_offres_recette));
  // Les recettes apprises.
  for (const r of [capt.recA, capt.recC]) if (r) await S.fond.envoyer({ from: 'cancale-vc', action: 'vcOffreAppris', recette: r }, { tab: { id: 41, url: ORIGINE + '/x' } });
  dit(S.fond.lignes.vc_offres_recette && S.fond.lignes.vc_offres_recette.accepter && S.fond.lignes.vc_offres_recette.accepter.appris === true && S.fond.lignes.vc_offres_recette.contre.appris === true, 'O5 · « accepter » et « contre » appris', JSON.stringify(S.fond.lignes.vc_offres_recette));
  // Contre-offre hors bornes.
  const rb = await S.cmd({ cmd: 'vcOffre', nego: N1, geste: 'contre', prixCents: 19000 });
  const rb2 = await S.cmd({ cmd: 'vcOffre', nego: N1, geste: 'contre', prixCents: 24900 });
  dit(rb && rb.code === 'invalide' && rb2 && rb2.code === 'invalide' && S.ordres.length === 0, 'O5 · contre-offre sous son offre ou au prix affiché : refusée, rien ne part', JSON.stringify([rb, rb2]));
  // Une offre dont l'échéance est PASSÉE : rien ne part, quel que soit le geste.
  { const off = S.fond.lignes.vc_offres && S.fond.lignes.vc_offres.offres && S.fond.lignes.vc_offres.offres['n' + N1];
    const avant = off ? off.expire : undefined; if (off) off.expire = EXPIREE;
    const nE = S.ch.appels.length;
    const re = await S.cmd({ cmd: 'vcOffre', nego: N1, geste: 'contre', prixCents: 22500 });
    const re2 = await S.cmd({ cmd: 'vcOffre', nego: N1, geste: 'accepter' });
    if (off) off.expire = avant;
    dit(!!off && re && re.accepte === false && re.code === 'expiree' && re2 && re2.code === 'expiree' && S.ordres.length === 0 && S.ch.appels.length === nE, 'O5 · une offre EXPIRÉE (échéance passée) : refusée, rien ne part', JSON.stringify([re, re2])); }
  // La contre-offre part : UNE requête, la même que la page.
  const accRep = nego(N1, ART1, [ev('offer', 'seller', 22500, '2026-11-04T10:00:00Z'), NA.events[0]]);
  S.ch.routes[`POST ${API}/products/${ART1}/negotiations/${N1}/events${Q}`] = { status: 201, body: { data: accRep } };
  const n0 = S.ch.appels.length;
  const r1 = await S.cmd({ cmd: 'vcOffre', nego: N1, geste: 'contre', prixCents: 22500 });
  const parti = S.ch.appels.slice(n0);
  dit(r1 && r1.accepte === true && r1.etape === 'fait' && parti.length === 1, 'O5 · sur SA commande : UNE requête part de l’onglet, « fait » (Vestiaire renvoie ton geste)', JSON.stringify({ r1, parti }));
  const a = parti[0] || {};
  dit(a.m === 'POST' && a.u === `${API}/products/${ART1}/negotiations/${N1}/events${Q}` && a.b === JSON.stringify({ type: 'offer', buyerId: Number(ACH), amount: '225' }) && a.h['x-vc-auth'] === 'secret-entete', 'O5 · exactement la requête de la page : adresse, corps (acheteur gardé dans la page, ton prix), en-tête repris de la page', JSON.stringify(a));
  dit(S.ordres.length === 1 && S.ordres[0].m.compte === MOI && !JSON.stringify(S.ordres[0].m).includes(ACH), 'O5 · l’ordre du fond nomme le compte de l’onglet, jamais l’acheteur', JSON.stringify(S.ordres[0] && S.ordres[0].m));
  dit(((S.fond.store.vrmActions || {})['vc:' + MOI] || []).length === 1, 'O5 · UNE action comptée dans le plafond de l’heure du compte Vestiaire', JSON.stringify(S.fond.store.vrmActions));
  await attendre(60);
  const apres = S.fond.lignes.vc_offres.offres['n' + N1];
  dit(apres && apres.aToi === false && apres.dernier.par === 'vendeur' && apres.dernier.cents === 22500, 'O5 · l’offre rangée est à jour : ta contre-offre, plus « à toi »', JSON.stringify(apres && apres.dernier));
  const r2 = await S.cmd({ cmd: 'vcOffre', nego: N1, geste: 'accepter' });
  dit(r2 && r2.accepte === false && r2.code === 'plus-a-toi' && S.ordres.length === 1, 'O5 · une offre qui n’attend plus ta réponse : rien ne part', JSON.stringify(r2));

  // « Fait » seulement si Vestiaire renvoie TON geste.
  const T = systeme(); await vuesDeLaPage(T);
  await T.fond.envoyer({ from: 'cancale-vc', action: 'vcOffreAppris', recette: capt.recA }, { tab: { id: 41, url: ORIGINE + '/x' } });
  T.ch.routes[`PUT ${API}/negotiations/${N1}${Q}`] = { status: 200, body: { data: NA } };
  const t1 = await T.cmd({ cmd: 'vcOffre', nego: N1, geste: 'accepter' });
  dit(t1 && t1.accepte === true && t1.etape === 'incertain', 'O5 · Vestiaire répond 2xx sans montrer ton geste ⇒ « je ne sais pas », jamais « fait »', JSON.stringify(t1));
  const acc = nego(N1, ART1, [ev('accept', 'seller', 20000, '2026-11-04T09:00:00Z'), NA.events[0]], { isAccepted: true, isOpened: false, isClosed: true });
  const T2 = systeme(); await vuesDeLaPage(T2);
  await T2.fond.envoyer({ from: 'cancale-vc', action: 'vcOffreAppris', recette: capt.recA }, { tab: { id: 41, url: ORIGINE + '/x' } });
  T2.ch.routes[`PUT ${API}/negotiations/${N1}${Q}`] = { status: 200, body: { data: acc } };
  const n2 = T2.ch.appels.length;
  const t2 = await T2.cmd({ cmd: 'vcOffre', nego: N1, geste: 'accepter' });
  const b2 = T2.ch.appels.slice(n2)[0] || {};
  dit(t2 && t2.etape === 'fait' && b2.b === JSON.stringify({ action: 'accept', price: { cents: 20000 } }), 'O5 · « Accepter » : le prix envoyé est celui de SON offre (lu dans la page), « fait » confirmé', JSON.stringify({ t2, b: b2.b }));

  // Plafond, pause, autre compte, compte pas su.
  const P = systeme(); await vuesDeLaPage(P);
  await P.fond.envoyer({ from: 'cancale-vc', action: 'vcOffreAppris', recette: capt.recA }, { tab: { id: 41, url: ORIGINE + '/x' } });
  P.fond.store.vrmActions = { ['vc:' + MOI]: Array.from({ length: 50 }, () => Date.now()) };
  const p1 = await P.cmd({ cmd: 'vcOffre', nego: N1, geste: 'accepter' });
  dit(p1 && p1.accepte === false && p1.code === 'plafond' && P.ordres.length === 0, 'O5 · 50 actions dans l’heure sur ce compte : refus, rien ne part', JSON.stringify(p1));
  P.fond.store.vrmActions = {};
  P.ch.routes[`PUT ${API}/negotiations/${N1}${Q}`] = { status: 429, body: { message: 'too many' } };
  const p2 = await P.cmd({ cmd: 'vcOffre', nego: N1, geste: 'accepter' });
  const p3 = await P.cmd({ cmd: 'vcOffre', nego: N1, geste: 'accepter' });
  dit(p2 && p2.etape === 'refuse' && p2.statut === 429 && P.fond.store.vrmPauseVc && p3 && p3.code === 'vc-pause' && P.ordres.length === 1, 'O5 · un 429 pose la pause ; pendant la pause, RIEN ne part', JSON.stringify({ p2, p3, n: P.ordres.length }));
  const A = systeme(); await vuesDeLaPage(A);
  await A.fond.envoyer({ from: 'cancale-vc', action: 'vcOffreAppris', recette: capt.recA }, { tab: { id: 41, url: ORIGINE + '/x' } });
  await A.fond.ctx.noterSessionVc('77778888', 41, []);
  const a1 = await A.cmd({ cmd: 'vcOffre', nego: N1, geste: 'accepter' });
  dit(a1 && a1.accepte === false && a1.code === 'autre-compte' && A.ordres.length === 0, 'O5 · l’onglet est passé sur un AUTRE compte : rien ne part', JSON.stringify(a1));
  // L'onglet dit le bon compte au fond, mais la page en montre un autre ⇒ la PAGE refuse.
  const B = systeme(); await vuesDeLaPage(B);
  await B.fond.envoyer({ from: 'cancale-vc', action: 'vcOffreAppris', recette: capt.recA }, { tab: { id: 41, url: ORIGINE + '/x' } });
  await B.ch.appel('GET', `${API}/users/me${Q}`, { data: { id: '55556666', type: 'user' } });
  await attendre(30);
  await B.fond.ctx.noterSessionVc(MOI, 41, []);
  const nB = B.ch.appels.length;
  const b1 = await B.cmd({ cmd: 'vcOffre', nego: N1, geste: 'accepter' });
  dit(b1 && b1.accepte === false && b1.code === 'autre-compte' && B.ch.appels.length === nB, 'O5 · la page est sur un autre compte que celui que le fond attend : la PAGE n’envoie rien', JSON.stringify(b1));
  // Une offre rangée sans compte (page muette) ne parle pour personne.
  const Z = systeme();
  await Z.ch.appel('GET', URL_LISTE, LISTE); await attendre(60);
  await Z.fond.envoyer({ from: 'cancale-vc', action: 'vcOffreAppris', recette: capt.recA }, { tab: { id: 41, url: ORIGINE + '/x' } });
  const z1 = await Z.cmd({ cmd: 'vcOffre', nego: N1, geste: 'accepter' });
  dit(z1 && z1.accepte === false && z1.code === 'session' && Z.ordres.length === 0, 'O5 · une offre dont le compte n’est pas su : rien ne part', JSON.stringify(z1));
  // … même quand l'onglet, lui, dit un compte (on ne prête pas l'offre au compte de l'onglet).
  await Z.fond.ctx.noterSessionVc(MOI, 41, []);
  const z2 = await Z.cmd({ cmd: 'vcOffre', nego: N1, geste: 'accepter' });
  dit(z2 && z2.accepte === false && z2.code === 'session' && Z.ordres.length === 0, 'O5 · … même si l’onglet dit un compte : l’offre n’est jamais prêtée au compte de l’onglet', JSON.stringify(z2));
  // La PAGE refuse seule une offre qui n'est plus à toi (même si le fond la croyait à toi).
  const nZ = Z.ch.appels.length;
  const pz = await Z.ch.ordre({ from: 'vrm-fond', action: 'vcOffre', nego: N2, geste: 'accepter', prixCents: 0, recette: Object.assign({}, capt.recA) });
  dit(pz && pz.ok === true && pz.statut === 0 && pz.erreur === 'plus-a-toi' && Z.ch.appels.length === nZ, 'O5 · la PAGE refuse une offre qui n’attend pas ta réponse (ta propre offre en attente) : rien ne part', JSON.stringify(pz));
  // Une offre ne change jamais de compte ; lecture ratée ⇒ rien.
  const W = systeme(); await vuesDeLaPage(W);
  const avant = copie(W.fond.lignes.vc_offres.offres['n' + N1]);
  await W.fond.ctx.noterSessionVc('77778888', 41, []);
  await W.fond.envoyer({ from: 'cancale-vc', action: 'vcOffres', offres: [Object.assign({}, avant, { dernier: { action: 'accept', par: 'vendeur', cents: 1, at: '2026-12-01T00:00:00Z' } })], liste: false, moi: '77778888' }, { tab: { id: 41, url: ORIGINE + '/x' } });
  dit(W.fond.lignes.vc_offres.offres['n' + N1].compte === MOI && W.fond.lignes.vc_offres.offres['n' + N1].dernier.cents === 20000, 'O4 · une offre rangée sous un compte n’est jamais réécrite par un autre compte', JSON.stringify(W.fond.lignes.vc_offres.offres['n' + N1].dernier));
  const K = systeme({ lectureKO: (u) => /vc_offres&|id=eq\.vc_offres&select=data/.test(u) });
  K.fond.lignes.vc_offres = { v: 1, offres: { n1: { id: '1', aToi: true } }, capturedAt: '2026-11-01T00:00:00Z' };
  await vuesDeLaPage(K);
  dit(JSON.stringify(K.fond.lignes.vc_offres) === JSON.stringify({ v: 1, offres: { n1: { id: '1', aToi: true } }, capturedAt: '2026-11-01T00:00:00Z' }), 'O4 · une lecture ratée de `vc_offres` n’écrit RIEN', JSON.stringify(K.fond.lignes.vc_offres).slice(0, 200));
  const etat = await S.fond.envoyer({ from: 'vmr-bridge', action: 'etat' }, { origin: 'https://vrm.center', url: 'https://vrm.center/' });
  dit(etat && etat.vcOffre === true, 'O5 · l’état de l’extension dit `vcOffre: true`', JSON.stringify(etat && Object.keys(etat)));
}

function o6() {
  const APP = fs.readFileSync(F.app, 'utf8');
  const cap = /const EXT_CAPACITES\s*=\s*\{([^}]*)\}/.exec(APP);
  dit(!!cap && /\bvcoffres:\s*'5\.319\.0'/.test(cap[1]) && /\bvcoffrerepondre:\s*'5\.319\.0'/.test(cap[1]), 'O6 · `EXT_CAPACITES.vcoffres` et `vcoffrerepondre` = 5.319.0');
}

(async () => {
  for (const [nom, f] of [['O1-O3', o1a3], ['O4-O5', o4o5], ['O6', o6]]) {
    try { await f(); } catch (e) { dit(false, `${nom} : l’audit a tourné jusqu’au bout`, String((e && e.stack) || e).slice(0, 400)); }
  }
  console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s)` : '\n✅ offres Vestiaire : tout est vert');
  process.exit(ko ? 1 : 0);
})();
