// ════════════════════════════════════════════════════════════════════════════
//  FAVORIS SUR LES AUTRES SITES (15 nov., lot favoris-sites, extension 5.392)
//
//  Julien : « est-ce que tu as lancé les messages aux favoris sur Vestiaire Collective
//  ou pas, et Leboncoin et eBay ? ». MESURÉ (lecture seule, 15 nov.) : Vestiaire NOMME
//  chaque personne qui aime un article (carte `custom_community` du fil des notifications,
//  conversation `{personne}-{article}`) et le vendeur peut lui faire la première offre
//  (`POST /products/{id}/negotiations`, vue le 2 nov.). Leboncoin ne dit jamais qui.
//  Les FORMES ci-dessous suivent ce qui a été mesuré ; toutes les VALEURS sont inventées.
//
//  VRAI vc-inject.js + VRAI vc.js + VRAI background.js (`_fond-vm.cjs`), reliés comme dans
//  Chrome. Ce qu'il exige :
//   A1  le fil des notifications : une carte « j'aime » ⇒ l'article et l'identifiant de la
//       personne vont au fond — jamais son pseudo ni le texte ; une autre carte : rien.
//   A2  le fond garde les personnes dans CE navigateur ; la base (`vc_aimes`) ne reçoit que
//       des NOMBRES (aucun identifiant de personne n'est écrit).
//   A3  SA première offre faite à la main ⇒ recette « favori » apprise ({produit},
//       {acheteur}, {prixCents}, NOMS d'en-têtes) ; une offre en réponse n'est pas « favori » ;
//       un texte libre dans le corps ⇒ pas rejouable.
//   A4  sans recette apprise, ou pas rejouable : RIEN ne part.
//   A5  sur SON clic : une offre par personne (son identifiant, ce prix), « faite » seulement
//       relue ; 40–90 s au hasard entre deux (le rythme des favoris, 5.410) ; une seule fois par personne ; 10 par toucher.
//   A6  l'offre ≥ le prix, ou un prix lu ≠ l'aperçu ⇒ rien ; autre compte ⇒ rien ;
//       45 actions/h ⇒ arrêt ; un 429 ⇒ pause, la suite ne part pas.
//   A7  l'app : capacité 5.392, l'écran Vestiaire, la règle (montant sous le prix), et
//       Leboncoin dit qu'il ne dit pas qui (aucun envoi).
//  `--prouve` : chaque règle réaffaiblie doit faire rougir l'audit.
// ════════════════════════════════════════════════════════════════════════════
require('./_source-app.cjs').brancher();
const { FauxCanal } = require('./_canal-faux.cjs');
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
  regle: arg('--regle', path.join(racine, 'src/aimesVestiaire.js')),
  ecran: arg('--ecran', path.join(racine, 'src/AimesVestiaire.jsx')),
  lbc: arg('--lbc', path.join(racine, 'src/ecrans/MessagesLeboncoin.jsx')),
};

if (process.argv.includes('--prouve')) {
  const MUT = [
    ['pseudoSort', 'inject', "        aimes.push({ produit: m[2], acheteur: m[1], at: dateMsg({ date: e.date }) || '' });", "        aimes.push({ produit: m[2], acheteur: m[1], at: dateMsg({ date: e.date }) || '', texte: String(e.textBody || '') });"],
    ['touteCarte', 'inject', "        if (!CARTE_AIME.test(dl) && !TEXTE_AIME.test(String(e.textBody || ''))) continue;   // une autre carte « communauté » : rien\n", ''],
    ['favoriSurReponse', 'inject', "      : (f.dernier.action === 'offer' && !avantAcheteur && f.evenements.every((e) => e.par === 'vendeur')) ? 'favori' : '';", "      : (f.dernier.action === 'offer') ? 'favori' : '';"],
    ['favoriSansPersonne', 'inject', "      if (!f._acheteur || (!modele.includes('{acheteur}') && !fixes.some((x) => x[1] === '{acheteur}'))) return non('personne-introuvable');\n", ''],
    ['pageConfirmeTout', 'inject', "          confirme = !!(f && f.produit === produit && f._acheteur === acheteur && f.dernier && f.dernier.par === 'vendeur' && f.dernier.action === 'offer' && f.dernier.cents === prix);", '          confirme = true;'],
    ['pageAutreCompte', 'inject', "    if (d.compte !== undefined && (!moiId || String(d.compte) !== moiId)) return fin({ statut: 0, erreur: moiId ? 'autre-compte' : 'compte-pas-su' });\n    if (moiId && acheteur === moiId)", '    if (moiId && acheteur === moiId)'],
    ['baseIdentifiants', 'src', "  const data = Object.assign({ v: 1, produits: resumeAimesVc(aimes, faits), compte: compte || '', capturedAt: now, ver: CODE_VERSION }, extra);", "  const data = Object.assign({ v: 1, produits: resumeAimesVc(aimes, faits), personnes: aimes, compte: compte || '', capturedAt: now, ver: CODE_VERSION }, extra);"],
    ['fondSansRecette', 'src', "    if (recette.rejouable !== true) return { accepte: false, code: 'pas-rejouable', raison: `la façon dont Vestiaire envoie cette offre", "    if (false) return { accepte: false, code: 'pas-rejouable', raison: `la façon dont Vestiaire envoie cette offre"],
    ['fondDeuxFois', 'src', "    const personnes = Object.keys(aimes[produit] || {}).filter((k) => k !== compte && !faits[produit + '|' + k]);", "    const personnes = Object.keys(aimes[produit] || {}).filter((k) => k !== compte);"],
    ['fondPrixHaut', 'src', "!(prix >= 100) || !(prix < avant) || avant > 1e8) return { accepte: false, code: 'invalide', raison: 'article ou montant invalide (l’offre doit être sous ton prix", "!(prix >= 100) || avant > 1e8) return { accepte: false, code: 'invalide', raison: 'article ou montant invalide (l’offre doit être sous ton prix"],
    ['fondPrixAvant', 'src', "    if (lu !== avant) return { accepte: false, code: 'prix-change', prixVu: lu / 100, raison: `le prix lu n'est plus celui de l'aperçu (${(lu / 100).toFixed(2).replace('.', ',')} €) — rien n'est parti` };\n    const compte = String(it.compte || '');\n    if (!compte) return { accepte: false, code: 'session', raison: \"je ne sais pas à quel compte Vestiaire appartient cet article", "    const compte = String(it.compte || '');\n    if (!compte) return { accepte: false, code: 'session', raison: \"je ne sais pas à quel compte Vestiaire appartient cet article"],
    ['fondSansEcart', 'src', "      const att = await tenirAttenteAimeVc(compte, f.prochain);", "      const att = { ok: true };"],
    ['delaiFixe', 'src', "      const s = await tirerSansRepeter(VC_AIMES_ECART_DERNIER, VC_AIMES_ECART_S[0], VC_AIMES_ECART_S[1]);", '      const s = 12;'],
    ['memeValeurDeuxFois', 'src', "  if (s === der) s = a + ((s - a + 1 + Math.floor(Math.random() * (b - a))) % (b - a + 1));\n", ''],
    ['fondPlafond', 'src', "      const cpt = await compterAction('vc:' + ot.compte, ACTIONS_MAX_HEURE - RESERVE_GESTES);\n      if (!cpt.ok) {", "      const cpt = { ok: true, at: Date.now() };\n      if (!cpt.ok) {"],
    ['plafondFavorisIgnore', 'src', "      const p = await porteDiscretion('vc:' + ot.compte, 'favori');\n      if (p) { await finir('arret', p.error); break; }", "      const p = null;\n      if (p) { await finir('arret', p.error); break; }"],
    ['porteAuToucherIgnoree', 'src', "    { const p = await porteDiscretion('vc:' + ot.compte, 'favori'); if (p) return", "    { const p = null; if (p) return"],
    ['ouvertureIgnoree', 'src', "  if (/^\\d{1,20}$/.test(String(id))) { try { await noterOuvertureVinted('vc:' + String(id)); } catch (_) {} }", ''],
    ['autreCompteIgnore', 'src', [["      const ot = await ongletVestiaire(compte);\n      if (!ot.ok) { await finir('arret', ot.raison); break; }\n      // Les MÊMES portes", "      const ot = await ongletVestiaire(null);\n      if (!ot.ok) { await finir('arret', ot.raison); break; }\n      // Les MÊMES portes"], ["  const ot = await ongletVestiaire(compte);\n  if (!ot.ok) return ot.raison;", "  const ot = await ongletVestiaire(null);\n  if (!ot.ok) return ot.raison;"]]],
    ['repriseAbsente', 'src', "lance('vcaimes', () => reprendreOffresAimesVc());", ''],
    ['fondPause429', 'src', "      if (statut === 429 || statut === 403) { await poserPauseVc(statut, rep.ra); await noter('refusee'); await finir('arret', `Vestiaire a refusé (${statut}) — pause de 30 min`); break; }", "      if (statut === 429 || statut === 403) { await noter('refusee'); continue; }"],
    ['journalAbsent', 'src', "f.suivi.faites++; n++; await noterJournal('vc:' + ot.compte, 'favori', {}); }", "f.suivi.faites++; n++; }"],
    ['fondParToucher', 'src', "    const lot = personnes.slice(0, VC_AIMES_PAR_TOUCHER);", '    const lot = personnes;'],
    ['regleMontant', 'regle', "  if (!(c >= 100) || !(Number.isInteger(prixCents) && c < prixCents)) return null;", '  if (!(c >= 100)) return null;'],
    ['regleNonLu', 'regle', "    if (!it) continue;                                   // pas lu dans « Mes articles » : rien proposé\n", "    if (!it) { lignes.push({ produit: String(x.produit), n, prevenues: 0, aPrevenir: n, dernier: '', titre: '', photo: '', prixCents: null, compte: '', numero: '' }); continue; }\n"],
  ];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-favoris-sites-'));
  let tous = true;
  for (const [nom, cle, avant, apres] of MUT) {
    let txt = fs.readFileSync(F[cle], 'utf8');
    const paires = Array.isArray(avant) ? avant : [[avant, apres]];
    if (paires.some(([a]) => !txt.includes(a))) { console.log(`❌ mutation ${nom} : texte introuvable`); tous = false; continue; }
    for (const [a, b] of paires) txt = txt.replace(a, b);
    fs.mkdirSync(path.join(tmp, nom), { recursive: true });
    const fichier = path.join(tmp, nom, path.basename(F[cle]));
    fs.writeFileSync(fichier, txt);
    const args = [__filename, '--' + cle, fichier];
    for (const k of Object.keys(F)) if (k !== cle) args.push('--' + k, F[k]);
    const r = spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 240000 });
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
const copie = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
const API = 'https://apiv2.vestiairecollective.com';
const ORIGINE = 'https://fr.vestiairecollective.com';
const Q = '?isoCountry=FR&x-siteid=1&x-language=fr&x-currency=EUR';
const MOI = '11112222', ART = '66668888', ART2 = '77770000';
const P1 = '30000001', P2 = '30000002', P3 = '30000003';
const SECRET = 'secret-entete-xyz';
const PSEUDO = 'pseudo_invente_zz';
const URL_NOTIFS = `${API}/notification-feed/v2${Q}&offset=0&limit=60&category=updates`;
const URL_LISTE = `${API}/users/me/product-listings${Q}&offset=0&limit=48`;
const URL_NEGO = `${API}/products/${ART}/negotiations${Q}`;
// La forme MESURÉE d'une carte « j'aime » (valeurs inventées).
const carteAime = (personne, article, jour = '2026-11-14T10:00:00') => ({ id: 'n' + personne + article, date: jour, type: 'notificationFeed', status: 'seen', tapped: false, cardType: 'profile_text_product', category: 'updates',
  textBody: `${PSEUDO} vient d’aimer votre pièce, envoyez lui un message !`, eventType: 'custom_community', cardTypeV2: 'default',
  productLink: { url: '', meta: { data: { id: `${personne}-${article}` }, type: 'chat' }, path: '/chat/', deeplink: `com.vestiairecollective.vestiaire://action?type=buyerSellerChat&productId=${article}&channelId=${personne}-${article}&utm_campaign=Community_like_item_NC_NEW` },
  profileLink: { url: '', path: '/chat/' }, productPicture: { url: '' }, profilePicture: { url: '' } });
const autreCarte = { id: 'nx', date: '2026-11-14T09:00:00', eventType: 'custom_activity', textBody: 'Votre article a été vendu', productLink: { url: '', meta: null, path: '/my-account/orders-sales/' } };
const communauteAutre = { id: 'ny', date: '2026-11-14T09:00:00', eventType: 'custom_community', textBody: 'Nouveau membre près de chez vous', productLink: { url: '', meta: { data: { id: `${P3}-${ART2}` }, type: 'chat' }, path: '/chat/', deeplink: 'com.vestiairecollective.vestiaire://action?type=buyerSellerChat&utm_campaign=Community_follow' } };
const annonce = (id, cents) => ({ type: 'published', published: { product: { id, headline: 'Nike', subHeadline: 'Dunk Low', price: { cents, currency: 'EUR', formatted: `${cents / 100} €` }, sellerEarnings: { cents: Math.round(cents * 0.8), currency: 'EUR' }, picturePath: `${id}-1_2.jpg`, path: `/x-${id}.shtml` }, listingDate: '2026-11-01T10:00:00Z' } });
const liste = (prix) => ({ data: [annonce(ART, prix[0]), annonce(ART2, prix[1] || 15000)], meta: { count: 2, offset: 0 } });
// La forme MESURÉE de la négociation renvoyée par `POST /products/{id}/negotiations` (valeurs inventées).
const nego = (id, personne, evenements) => ({ data: { id, type: 'negotiation', buyer: { id: personne }, seller: { id: MOI }, product: { id: ART, name: 'Dunk Low', brand: { name: 'Nike' }, pictures: [{ path: `${ART}-1_2.jpg` }], path: `/x-${ART}.shtml`, price: { cents: 24900, currency: 'EUR' } },
  events: evenements, isOpened: true, isClosed: false, isAccepted: false, initialPrice: { cents: 24900, currency: 'EUR' }, expirationDate: '2026-11-16T10:00:00Z', sellerRemainingOffers: 2 } });
const ev = (action, par, cents, at = '2026-11-15T10:00:00Z') => ({ action, createdBy: par, price: { cents, currency: 'EUR' }, creationDate: at });

function chrome2(bus) {
  const INJ = fs.readFileSync(F.inject, 'utf8'), REL = fs.readFileSync(F.relais, 'utf8');
  const posts = [], appels = [];
  const routes = {};
  const rep = (m, u, init) => { const r = routes[m + ' ' + u] || routes['* ' + u] || { status: 404, body: { message: 'introuvable' } }; return typeof r === 'function' ? r(init) : r; };
  const ecoutesPage = [], ecoutesRel = [];
  const winP = {}, winR = {};
  // 5.396 : `postMessage(m, origine, ports)` — le port du canal privé passe avec la lettre (livré
  // juste après, comme le navigateur) ; ce que le capteur poste sur SON port est noté dans `posts`.
  const diffuser = (m, o, ports) => { const d = copie(m); posts.push(d); if (ports) { setTimeout(() => { for (const f of ecoutesRel.slice()) f({ source: winR, origin: ORIGINE, data: copie(d), ports }); }, 0); return; } for (const f of ecoutesPage.slice()) f({ source: winP, origin: ORIGINE, data: copie(d) }); for (const f of ecoutesRel.slice()) f({ source: winR, origin: ORIGINE, data: copie(d) }); };
  const CanalEspion = function () { const c = new FauxCanal(); const pm = c.port1.postMessage; c.port1.postMessage = (x) => { posts.push(copie(x)); pm(x); }; return c; };
  Object.assign(winP, { postMessage: diffuser, addEventListener: (t, f) => { if (t === 'message') ecoutesPage.push(f); },
    fetch: async (u, init) => {
      const m = String((init && init.method) || 'GET').toUpperCase();
      appels.push({ u: String(u), m, h: copie((init && init.headers) || {}), b: init && init.body });
      const r = rep(m, String(u), init);
      const texte = r.body == null ? '' : typeof r.body === 'string' ? r.body : JSON.stringify(r.body);
      const ct = r.ct || 'application/json; charset=utf-8';
      return { status: r.status, ok: r.status >= 200 && r.status < 300, headers: { get: () => ct }, clone() { return this; }, text: async () => texte, arrayBuffer: async () => new ArrayBuffer(0) };
    } });
  winP.top = winP; winP.self = winP;
  const ctxP = { MessageChannel: CanalEspion, window: winP, document: { currentScript: {}, createElement: () => ({}), head: { appendChild() {} }, addEventListener() {}, getElementById: () => null, readyState: 'complete' },
    location: { origin: ORIGINE, hostname: 'fr.vestiairecollective.com', pathname: '/chat/', href: ORIGINE + '/chat/' }, history: { pushState() {}, replaceState() {} },
    URL, console: { log() {}, warn() {}, error() {} }, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {}, JSON, Date, Math, Map, Set, Promise, encodeURIComponent, btoa: (x) => Buffer.from(x, 'latin1').toString('base64'), Uint8Array, ArrayBuffer, String, Number };
  vm.createContext(ctxP); vm.runInContext(INJ, ctxP, { filename: 'vc-inject.js' });
  const ecouteOrdre = [];
  Object.assign(winR, { postMessage: diffuser, addEventListener: (t, f) => { if (t === 'message') ecoutesRel.push(f); } });
  winR.top = winR;
  const uuid = () => 'aaaaaaaa-bbbb-cccc-dddd-' + String(Math.floor(Math.random() * 1e12)).padStart(12, '0');
  const ctxR = { window: winR, self: { crypto: { randomUUID: uuid } }, crypto: { randomUUID: uuid },
    chrome: { runtime: { id: 'banc', sendMessage: (m, cb) => { if (bus) bus(copie(m)); if (cb) cb(); }, lastError: null, onMessage: { addListener(f) { ecouteOrdre.push(f); } } } },
    location: { origin: ORIGINE, href: ORIGINE + '/chat/' }, URL, console, setTimeout, clearTimeout, JSON, Date, Math, Map, Set, Number, String };
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
async function a1a3() {
  const p = chrome2();
  await p.appel('GET', `${API}/users/me${Q}`, { data: { id: MOI, type: 'user' } });
  const a = await p.appel('GET', URL_NOTIFS, { data: [carteAime(P1, ART), carteAime(P2, ART), carteAime(P3, ART2), autreCarte, communauteAutre, carteAime(MOI, ART)], meta: { count: 6 } });
  const x = de(a, 'vcaimes')[0];
  const l = x ? x.aimes.map((y) => `${y.acheteur}-${y.produit}`).sort() : [];
  dit(!!x && l.join(',') === [`${P1}-${ART}`, `${P2}-${ART}`, `${P3}-${ART2}`].join(','), 'A1 · trois cartes « j’aime » ⇒ trois personnes (article + identifiant) ; la carte vendue, une autre carte communauté et soi-même : rien', JSON.stringify(x));
  dit(!!x && !JSON.stringify(x).includes(PSEUDO) && x.aimes.every((y) => Object.keys(y).sort().join() === 'acheteur,at,produit'), 'A1 · ni le pseudo ni le texte de la carte ne sortent de la page', JSON.stringify(x && x.aimes[0]));
  // A3 — SA première offre à la main.
  const corps = JSON.stringify({ buyerId: Number(P1), price: { cents: 23700, currency: 'EUR' } });
  const b = await p.appel('POST', URL_NEGO, nego('900000001', P1, [ev('offer', 'seller', 23700)]), 200, corps);
  const r = de(b, 'vcoffreappris')[0];
  dit(!!r && r.recette.geste === 'favori' && r.recette.rejouable === true && r.recette.modele === '/products/{produit}/negotiations', 'A3 · SA première offre (aucune offre de la personne avant) ⇒ recette « favori » : POST /products/{produit}/negotiations', JSON.stringify(r));
  dit(!!r && JSON.stringify(r.recette.fixes) === JSON.stringify([[['buyerId'], '{acheteur}', 'number'], [['price', 'cents'], '{prixCents}', 'number'], [['price', 'currency'], 'EUR', 'string']]) && JSON.stringify(r.recette.entetes) === '["x-vc-auth"]', 'A3 · la personne et le prix en TROUS, les NOMS d’en-têtes seulement', JSON.stringify(r && [r.recette.fixes, r.recette.entetes]));
  dit(!JSON.stringify(b).includes(SECRET), 'A3 · la valeur d’un en-tête ne sort jamais');
  capt.rec = r && r.recette;
  const q = chrome2();
  await q.appel('GET', `${API}/users/me${Q}`, { data: { id: MOI, type: 'user' } });
  const c = await q.appel('POST', URL_NEGO, nego('900000002', P2, [ev('offer', 'buyer', 20000, '2026-11-15T09:00:00Z'), ev('offer', 'seller', 22000)]), 200, JSON.stringify({ buyerId: Number(P2), price: { cents: 22000 } }));
  dit(!de(c, 'vcoffreappris').some((y) => y.recette.geste === 'favori'), 'A3 · une contre-offre (la personne avait offert avant) n’est jamais la recette « favori »', JSON.stringify(de(c, 'vcoffreappris')));
  const d = await q.appel('POST', URL_NEGO, nego('900000003', P3, [ev('offer', 'seller', 21000)]), 200, JSON.stringify({ buyerId: Number(P3), price: { cents: 21000 }, message: 'Bonjour Jeanne, prix spécial !' }));
  const rd = de(d, 'vcoffreappris')[0];
  dit(!!rd && rd.recette.geste === 'favori' && rd.recette.rejouable === false && rd.recette.raison === 'valeur-inconnue', 'A3 · un texte libre dans le corps ⇒ « pas rejouable » (jamais un message rejoué)', JSON.stringify(rd));
  const g = await q.appel('POST', URL_NEGO, nego('900000005', P2, [ev('offer', 'seller', 22000, '2026-11-14T09:00:00Z'), ev('decline', 'buyer', null, '2026-11-14T12:00:00Z'), ev('offer', 'seller', 21000)]), 200, JSON.stringify({ buyerId: Number(P2), price: { cents: 21000 } }));
  dit(!de(g, 'vcoffreappris').some((y) => y.recette.geste === 'favori'), 'A3 · une nouvelle offre après un refus de la personne n’est pas la PREMIÈRE offre : jamais la recette « favori »', JSON.stringify(de(g, 'vcoffreappris')));
  const e = await q.appel('POST', URL_NEGO, nego('900000004', P3, [ev('offer', 'seller', 21000)]), 200, JSON.stringify({ price: { cents: 21000 } }));
  const re = de(e, 'vcoffreappris')[0];
  dit(!!re && re.recette.rejouable === false && re.recette.raison === 'personne-introuvable', 'A3 · la personne absente de la requête ⇒ « pas rejouable » (VRM ne devine pas à qui)', JSON.stringify(re));
}

function systeme() {
  let fond = null;
  const ch = chrome2((m) => { if (fond) fond.envoyer(m, { tab: { id: 41, url: ORIGINE + '/chat/' }, frameId: 0 }); });
  fond = faireFond({ src: F.src, onglets: [{ id: 41, url: ORIGINE + '/chat/', active: true, status: 'complete' }] });
  const ordres = [];
  // Une horloge VIRTUELLE dans le fond : chaque attente demandée (écart entre deux offres, espacement de la
  // sécurité des comptes…) avance l'heure de l'extension d'autant, sans faire attendre l'audit.
  let decal = 0; const RD = Date;
  class Dv extends RD { constructor(...a) { if (a.length) super(...a); else super(RD.now() + decal); } static now() { return RD.now() + decal; } }
  fond.ctx.Date = Dv;
  const st = fond.ctx.setTimeout;
  // Seules les ATTENTES voulues (l'écart entre deux offres, l'espacement de la sécurité) avancent l'heure —
  // pas les minuteurs de garde (`avecDelai` 25 s) qui ne font qu'attendre une réponse.
  const tenu = { ms: 0 };
  fond.ctx.setTimeout = (f, ms) => { const pile = String(new Error().stack); if (Number(ms) > 0 && /attendreVc|secuGeste|tenirAttenteAimeVc/.test(pile)) decal += Number(ms); if (Number(ms) > 0 && /tenirAttenteAimeVc/.test(pile)) tenu.ms += Number(ms); return st(f, ms); };
  // Les écarts TIRÉS entre deux offres (`vcaimes:ecart`, la même trace que les attentes des favoris Vinted).
  fond.ctx.__vrmPausesVues = [];
  const delais = { get vus() { return fond.ctx.__vrmPausesVues.filter((x) => x[0] === 'vcaimes:ecart').map((x) => x[1]); } };
  fond.ctx.chrome.tabs.sendMessage = (id, m, o, cb) => {
    if (m && m.__vmrEvt) { fond.j.evts.push(m.evt); if (typeof cb === 'function') cb(); return Promise.resolve(); }
    ordres.push({ id, m: copie(m) });
    return ch.ordre(m);
  };
  const cmd = (msg) => fond.envoyer(Object.assign({ from: 'vmr-bridge', action: 'cmd' }, msg), { origin: 'https://vrm.center', url: 'https://vrm.center/' });
  return { ch, fond, ordres, cmd, delais, tenu };
}
const pret = async (S, { personnes = [P1, P2, P3], prix = 24900, ouvert = true } = {}) => {
  await S.ch.appel('GET', `${API}/users/me${Q}`, { data: { id: MOI, type: 'user' } }); await attendre(30);
  await S.ch.appel('GET', URL_LISTE, liste([prix])); await attendre(60);
  await S.ch.appel('GET', URL_NOTIFS, { data: personnes.map((p) => carteAime(p, ART)), meta: { count: personnes.length } }); await attendre(60);
  if (ouvert) vieillirOuverture(S);
};
// vestiairecollective.com ouvert il y a 10 min (l'attente de 2 à 6 min après l'ouverture est passée).
const vieillirOuverture = (S) => { const o = S.fond.store.vrmOuverture && S.fond.store.vrmOuverture['vc:' + MOI]; if (o) { o.depuis = Date.now() - 10 * 60000; o.vu = Date.now(); } };
const apprendre = (S, rec = capt.rec) => S.fond.envoyer({ from: 'cancale-vc', action: 'vcOffreAppris', recette: rec }, { tab: { id: 41, url: ORIGINE + '/chat/' } });
// Vestiaire répond à une offre par la négociation de CETTE personne (sa forme mesurée).
const repondre = (S, statut = 200, toutes = null) => { let n = 0; S.heures = []; S.ch.routes[`POST ${URL_NEGO}`] = (init) => { n++; S.heures.push(S.fond.ctx.Date.now()); const b = JSON.parse(init.body || '{}'); const s = typeof statut === 'function' ? statut(n) : statut; return s >= 200 && s < 300 ? { status: s, body: nego('91' + String(n).padStart(7, '0'), String(b.buyerId), [ev('offer', 'seller', b.price && b.price.cents)]) } : { status: s, body: { message: 'non' } }; }; };
const finEnvoi = async (S, max = 400) => { for (let i = 0; i < max; i++) { const e = S.fond.lignes.vc_aimes && S.fond.lignes.vc_aimes.envoi; if (e && e.fin) return e; await attendre(10); } return S.fond.lignes.vc_aimes && S.fond.lignes.vc_aimes.envoi; };
const posts = (S) => S.ch.appels.filter((a) => a.m === 'POST' && a.u === URL_NEGO);

async function a2a6() {
  const S = systeme();
  await pret(S);
  const loc = S.fond.store.vrmVcAimes;
  dit(!!loc && loc[ART] && Object.keys(loc[ART]).sort().join() === [P1, P2, P3].sort().join(), 'A2 · les trois personnes gardées dans CE navigateur (stockage de l’extension)', JSON.stringify(loc));
  const ligne = S.fond.lignes.vc_aimes;
  dit(!!ligne && ligne.produits && ligne.produits['n' + ART] && ligne.produits['n' + ART].n === 3, 'A2 · la base reçoit le NOMBRE (3 personnes pour l’article)', JSON.stringify(ligne));
  dit(!!ligne && ![P1, P2, P3].some((p) => JSON.stringify(ligne).includes(p)) && !JSON.stringify(ligne).includes(PSEUDO), 'A2 · aucun identifiant de personne (ni pseudo) n’est écrit en base', JSON.stringify(ligne));
  // A4 — sans recette.
  const r0 = await S.cmd({ cmd: 'vcOffreAimes', produit: ART, avantCents: 24900, prixCents: 23700 });
  dit(r0 && r0.accepte === false && r0.code === 'pas-appris' && S.ordres.length === 0 && posts(S).length === 0, 'A4 · sans recette apprise de SON geste : RIEN ne part, le geste à faire est dit', JSON.stringify(r0));
  await apprendre(S, { geste: 'favori', methode: 'POST', hote: 'apiv2.vestiairecollective.com', chemin: '/products/{id}/negotiations', rejouable: false, raison: 'valeur-inconnue' });
  const r00 = await S.cmd({ cmd: 'vcOffreAimes', produit: ART, avantCents: 24900, prixCents: 23700 });
  dit(r00 && r00.accepte === false && r00.code === 'pas-rejouable' && posts(S).length === 0, 'A4 · recette « pas rejouable » : rien ne part', JSON.stringify(r00));
  await apprendre(S);
  const rec = S.fond.lignes.vc_offres_recette;
  dit(!!rec && rec.favori && rec.favori.appris === true && !JSON.stringify(rec).includes(SECRET), 'A4 · recette apprise ⇒ `vc_offres_recette.favori.appris` (aucune valeur d’en-tête)', JSON.stringify(rec));
  // A6 — l'offre au-dessus du prix, l'aperçu dépassé.
  const r6 = await S.cmd({ cmd: 'vcOffreAimes', produit: ART, avantCents: 24900, prixCents: 24900 });
  dit(r6 && r6.accepte === false && r6.code === 'invalide' && posts(S).length === 0, 'A6 · une « offre » au prix (ou au-dessus) est refusée', JSON.stringify(r6));
  const r7 = await S.cmd({ cmd: 'vcOffreAimes', produit: ART, avantCents: 26000, prixCents: 23700 });
  dit(r7 && r7.accepte === false && r7.code === 'prix-change' && posts(S).length === 0, 'A6 · le prix lu n’est plus celui de l’aperçu : rien ne part', JSON.stringify(r7));
  // A5 — sur SON clic.
  repondre(S);
  const r5 = await S.cmd({ cmd: 'vcOffreAimes', produit: ART, avantCents: 24900, prixCents: 23700 });
  dit(r5 && r5.accepte === true && r5.etape === 'encours' && r5.n === 3, 'A5 · sur son clic : la série part (3 personnes)', JSON.stringify(r5));
  const e5 = await finEnvoi(S);
  const env = posts(S).map((a) => JSON.parse(a.b));
  dit(env.length === 3 && env.map((b) => String(b.buyerId)).sort().join() === [P1, P2, P3].sort().join() && env.every((b) => b.price.cents === 23700), 'A5 · UNE offre par personne, à SON identifiant, à ce prix', JSON.stringify(env));
  dit(posts(S).every((a) => a.h['x-vc-auth'] === SECRET), 'A5 · les en-têtes repris DANS la page (le fond n’en connaît aucune valeur)');
  dit(!!e5 && e5.fin === 'fini' && e5.faites === 3 && e5.incertaines === 0, 'A5 · « 3 sur 3 » seulement parce que Vestiaire a renvoyé chaque offre', JSON.stringify(e5));
  // Les écarts tirés au hasard (jamais ronds, à la différence des délais fixes de l'extension : 8 000, 12 000…).
  const ecarts = S.delais.vus;
  dit(ecarts.length === 3 && ecarts.every((ms) => ms >= 40000 && ms <= 90000 && ms % 1000 === 0) && ecarts.every((ms, i) => i === 0 || ms !== ecarts[i - 1]), 'A5 · après chaque offre, 40 à 90 s tirées au hasard (le rythme des favoris), jamais deux fois de suite la même valeur (le tirage des favoris Vinted)', JSON.stringify(ecarts));
  dit(S.fond.store.vrmVcAimesEcartDernier && ecarts[ecarts.length - 1] === S.fond.store.vrmVcAimesEcartDernier.s * 1000, 'A5 · la dernière valeur est gardée dans le stockage de l’extension (un worker neuf ne la répète pas)', JSON.stringify(S.fond.store.vrmVcAimesEcartDernier));
  const serieV = [];
  for (let i = 0; i < 300; i++) serieV.push(await S.fond.ctx.tirerSansRepeter('banc', 8, 20));
  dit(serieV.every((x, i) => i === 0 || x !== serieV[i - 1]) && new Set(serieV).size >= 10, 'A5 · 300 tirages : jamais deux fois de suite la même valeur, et bien répartis', JSON.stringify(serieV.slice(0, 12)));
  const jr = ((S.fond.store.vrmJournal || {})['vc:' + MOI]) || [];
  dit(jr.filter((e) => e && e.s === 'favori').length === 3, 'A5 · chaque offre faite va au journal « Ce que VRM a fait » (vc:{compte}, sorte « favori »)', JSON.stringify(jr));
  const heures = S.heures || [];
  dit(heures.length === 3 && heures.every((h, i) => i === 0 || h - heures[i - 1] >= ecarts[i - 1]), 'A5 · l’offre suivante part APRÈS l’écart tiré (jamais avant)', JSON.stringify({ heures: heures.map((h) => h - heures[0]), ecarts }));
  dit(S.tenu.ms >= 0.8 * (ecarts[0] + ecarts[1]), 'A5 · l’écart est TENU par l’attente revérifiée (onglet, compte, Tout arrêter) — pas laissé à un autre délai', JSON.stringify({ tenu: S.tenu.ms, ecarts }));
  dit(((S.fond.store.vrmActions || {})['vc:' + MOI] || []).length === 3, 'A5 · trois actions comptées sous le compte Vestiaire', JSON.stringify(S.fond.store.vrmActions));
  const n5 = posts(S).length;
  const r52 = await S.cmd({ cmd: 'vcOffreAimes', produit: ART, avantCents: 24900, prixCents: 22000 });
  dit(r52 && r52.accepte === false && r52.code === 'personne' && posts(S).length === n5, 'A5 · une deuxième fois : personne n’est relancé (une offre par personne, une seule fois)', JSON.stringify(r52));
  dit(S.fond.lignes.vc_aimes.produits['n' + ART].prevenues === 3, 'A5 · la base dit « 3 déjà prévenues » (un nombre)', JSON.stringify(S.fond.lignes.vc_aimes.produits));
  // A5 bis — « faite » seulement relue.
  const R = systeme(); await pret(R); await apprendre(R);
  R.ch.routes[`POST ${URL_NEGO}`] = { status: 200, body: { data: { ok: true } } };
  await R.cmd({ cmd: 'vcOffreAimes', produit: ART, avantCents: 24900, prixCents: 23700 });
  const eR = await finEnvoi(R);
  dit(!!eR && eR.faites === 0 && eR.incertaines === 3, 'A5 · Vestiaire répond sans montrer l’offre : « à vérifier », jamais « faite »', JSON.stringify(eR));
  // A5 ter — 10 par toucher.
  const D = systeme(); const douze = Array.from({ length: 12 }, (_, i) => String(40000000 + i));
  await pret(D, { personnes: douze }); await apprendre(D); repondre(D);
  const rD = await D.cmd({ cmd: 'vcOffreAimes', produit: ART, avantCents: 24900, prixCents: 23700 });
  await finEnvoi(D);
  dit(rD && rD.n === 10 && rD.reste === 2 && posts(D).length === 10, 'A5 · 12 personnes : 10 au plus par toucher, les 2 autres attendent SON prochain toucher', JSON.stringify({ rD, n: posts(D).length }));
  // A6 — plafond.
  const P = systeme(); await pret(P); await apprendre(P); repondre(P);
  P.fond.store.vrmActions = { ['vc:' + MOI]: Array.from({ length: 44 }, () => Date.now()) };
  await P.cmd({ cmd: 'vcOffreAimes', produit: ART, avantCents: 24900, prixCents: 23700 });
  const eP = await finEnvoi(P);
  dit(posts(P).length === 1 && eP && eP.fin === 'arret', 'A6 · 44 actions dans l’heure : une offre part (la 45e), puis la série S’ARRÊTE', JSON.stringify({ n: posts(P).length, eP }));
  // A6 — 429.
  const T = systeme(); await pret(T); await apprendre(T); repondre(T, (n) => (n === 1 ? 429 : 200));
  await T.cmd({ cmd: 'vcOffreAimes', produit: ART, avantCents: 24900, prixCents: 23700 });
  const eT = await finEnvoi(T);
  const t2 = await T.cmd({ cmd: 'vcOffreAimes', produit: ART, avantCents: 24900, prixCents: 23700 });
  dit(posts(T).length === 1 && T.fond.store.vrmPauseVc && eT && eT.fin === 'arret' && t2 && t2.code === 'vc-pause', 'A6 · un 429 : la pause est posée, la suite ne part pas, et rien ne repart pendant la pause', JSON.stringify({ n: posts(T).length, eT, t2 }));
  // A6 — autre compte.
  const A = systeme(); await pret(A); await apprendre(A); repondre(A);
  await A.fond.ctx.noterSessionVc('77778888', 41, []);
  const a1 = await A.cmd({ cmd: 'vcOffreAimes', produit: ART, avantCents: 24900, prixCents: 23700 });
  dit(a1 && a1.accepte === false && a1.code === 'autre-compte' && posts(A).length === 0, 'A6 · l’onglet est sur un AUTRE compte : rien ne part', JSON.stringify(a1));
  // A6 — la PAGE montre un autre compte que celui que le fond attend : la page n'envoie rien.
  const B = systeme(); await pret(B); await apprendre(B); repondre(B);
  await B.ch.appel('GET', `${API}/users/me${Q}`, { data: { id: '55556666', type: 'user' } }); await attendre(30);
  await B.fond.ctx.noterSessionVc(MOI, 41, []);
  await B.cmd({ cmd: 'vcOffreAimes', produit: ART, avantCents: 24900, prixCents: 23700 });
  const eB = await finEnvoi(B);
  dit(posts(B).length === 0 && eB && eB.fin === 'arret' && eB.faites === 0, 'A6 · la page montre un autre compte que celui attendu : la PAGE n’envoie rien, la série s’arrête', JSON.stringify({ n: posts(B).length, eB }));
  // A8 — LES MÊMES PORTES QUE LES FAVORIS VINTED.
  // Ouverture : vestiairecollective.com vient d'être ouvert ⇒ 2 à 6 min avant d'agir seul.
  const O = systeme(); await pret(O, { ouvert: false }); await apprendre(O); repondre(O);
  const ouvO = O.fond.store.vrmOuverture && O.fond.store.vrmOuverture['vc:' + MOI];
  dit(!!ouvO && ouvO.attente >= 2 * 60000 && ouvO.attente <= 6 * 60000, 'A8 · l’ouverture de vestiairecollective.com est notée (attente tirée entre 2 et 6 min)', JSON.stringify(ouvO));
  if (ouvO) { ouvO.depuis = O.fond.ctx.Date.now(); ouvO.vu = ouvO.depuis; }   // ouvert à l'instant
  const o1 = await O.cmd({ cmd: 'vcOffreAimes', produit: ART, avantCents: 24900, prixCents: 23700 });
  dit(o1 && o1.accepte === false && o1.code === 'discretion' && /Vestiaire vient d’être ouvert/.test(o1.raison) && posts(O).length === 0, 'A8 · le site vient d’être ouvert : VRM attend (2 à 6 min, comme vinted.fr), rien ne part', JSON.stringify(o1));
  // 15/h messages aux favoris (le réglage commun) : la 16e ne part pas.
  const H = systeme(); await pret(H); await apprendre(H); repondre(H);
  H.fond.store.vrmSortes = { ['vc:' + MOI]: { favori: Array.from({ length: 15 }, () => Date.now() - 60000), at: Date.now() } };
  const h1 = await H.cmd({ cmd: 'vcOffreAimes', produit: ART, avantCents: 24900, prixCents: 23700 });
  dit(h1 && h1.accepte === false && /15 messages aux favoris cette heure/.test(h1.raison || '') && posts(H).length === 0, 'A8 · 15 favoris cette heure : refus (le plafond des favoris Vinted), rien ne part', JSON.stringify(h1));
  const H2 = systeme(); await pret(H2); await apprendre(H2); repondre(H2);
  H2.fond.store.vrmSortes = { ['vc:' + MOI]: { favori: Array.from({ length: 14 }, () => Date.now() - 60000), at: Date.now() } };
  await H2.cmd({ cmd: 'vcOffreAimes', produit: ART, avantCents: 24900, prixCents: 23700 });
  const eH2 = await finEnvoi(H2);
  dit(posts(H2).length === 1 && eH2 && eH2.fin === 'arret' && /15 messages aux favoris/.test(eH2.raison), 'A8 · 14 déjà cette heure : UNE offre part, puis la série s’arrête au 15e (dit)', JSON.stringify({ n: posts(H2).length, eH2 }));
  // « Tout arrêter » : rien ne part.
  const T2 = systeme(); await pret(T2); await apprendre(T2); repondre(T2);
  T2.fond.store.vrmToutArrete = { on: true, at: Date.now() };
  const t21 = await T2.cmd({ cmd: 'vcOffreAimes', produit: ART, avantCents: 24900, prixCents: 23700 });
  dit(t21 && t21.accepte === false && t21.code === 'tout-arrete' && posts(T2).length === 0, 'A8 · « Tout arrêter » : rien ne part', JSON.stringify(t21));
  const T3 = systeme(); await pret(T3); await apprendre(T3);
  repondre(T3, (n) => { if (n === 1) T3.fond.store.vrmToutArrete = { on: true, at: T3.fond.ctx.Date.now() }; return 200; });
  await T3.cmd({ cmd: 'vcOffreAimes', produit: ART, avantCents: 24900, prixCents: 23700 });
  const eT3 = await finEnvoi(T3);
  dit(posts(T3).length === 1 && eT3 && eT3.fin === 'arret' && /Tout est arrêté/.test(eT3.raison), 'A8 · « Tout arrêter » touché PENDANT la série : la suite ne part pas, dit', JSON.stringify({ n: posts(T3).length, eT3 }));
  // Un autre compte Vestiaire vient d'agir dans ce navigateur ⇒ un compte à la fois (et Vinted ne retient pas Vestiaire).
  const U = systeme(); await pret(U); await apprendre(U); repondre(U);
  U.fond.store.vrmVerrouCompteVc = { uid: 'vc:99990000', jusqua: Date.now() + 5 * 60000, at: Date.now() };
  U.fond.store.vrmVerrouCompte = { uid: '123456', jusqua: Date.now() + 5 * 60000, at: Date.now() };
  const u1 = await U.cmd({ cmd: 'vcOffreAimes', produit: ART, avantCents: 24900, prixCents: 23700 });
  dit(u1 && u1.accepte === false && /Un autre compte vient d’agir/.test(u1.raison || '') && posts(U).length === 0, 'A8 · un autre compte Vestiaire vient d’agir : un compte à la fois, rien ne part', JSON.stringify(u1));
  const U2 = systeme(); await pret(U2); await apprendre(U2); repondre(U2);
  U2.fond.store.vrmVerrouCompte = { uid: '123456', jusqua: Date.now() + 5 * 60000, at: Date.now() };
  await U2.cmd({ cmd: 'vcOffreAimes', produit: ART, avantCents: 24900, prixCents: 23700 });
  await finEnvoi(U2);
  dit(posts(U2).length === 3, 'A8 · … un compte VINTED qui vient d’agir ne retient pas Vestiaire (site par site)', String(posts(U2).length));
  // L'onglet passe sur un autre compte PENDANT la série : la suite ne part pas, c'est dit.
  const W = systeme(); await pret(W); await apprendre(W);
  // Dès la 1re offre partie, la page ET l'onglet passent sur le compte 77778888 (avant la 2e).
  repondre(W, (n) => { if (n === 1) { W.ch.appel('GET', `${API}/users/me${Q}`, { data: { id: '77778888', type: 'user' } }); W.fond.ctx.noterSessionVc('77778888', 41, []); } return 200; });
  await W.cmd({ cmd: 'vcOffreAimes', produit: ART, avantCents: 24900, prixCents: 23700 });
  const eW = await finEnvoi(W);
  dit(posts(W).length === 1 && eW && eW.fin === 'arret' && /autre compte/.test(eW.raison), 'A8 · l’onglet passe sur un AUTRE compte pendant la série : la suite ne part pas, dit', JSON.stringify({ n: posts(W).length, eW }));
  // Un worker NEUF reprend la file (§4.9) ; trop tard ⇒ rien ne part.
  const N = systeme(); await pret(N); await apprendre(N); repondre(N);
  N.fond.store.vrmVcAimesFile = { produit: ART, compte: MOI, cents: 23700, reste: [P2, P3], prochain: Date.now(), suivi: { produit: ART, at: new Date().toISOString(), cents: 23700, n: 3, faites: 1, incertaines: 0, fin: '', raison: '' }, v: '5.392.0' };
  const nN = await N.fond.ctx.reprendreOffresAimesVc();
  dit(nN === 2 && posts(N).length === 2 && !N.fond.store.vrmVcAimesFile && N.fond.lignes.vc_aimes.envoi.faites === 3 && N.fond.lignes.vc_aimes.envoi.fin === 'fini', 'A8 · un worker neuf REPREND la file (état dans le stockage de l’extension) : les 2 restantes partent, « 3 sur 3 »', JSON.stringify({ nN, n: posts(N).length, e: N.fond.lignes.vc_aimes && N.fond.lignes.vc_aimes.envoi }));
  const N2 = systeme(); await pret(N2); await apprendre(N2); repondre(N2);
  N2.fond.store.vrmVcAimesFile = { produit: ART, compte: MOI, cents: 23700, reste: [P2], prochain: Date.now() - 11 * 60000, suivi: { produit: ART, at: new Date().toISOString(), cents: 23700, n: 2, faites: 1, incertaines: 0, fin: '', raison: '' }, v: '5.392.0' };
  await N2.fond.ctx.reprendreOffresAimesVc();
  dit(posts(N2).length === 0 && N2.fond.lignes.vc_aimes.envoi.fin === 'arret' && /trop longtemps/.test(N2.fond.lignes.vc_aimes.envoi.raison), 'A8 · reprise 11 min trop tard : rien ne part, c’est dit', JSON.stringify(N2.fond.lignes.vc_aimes && N2.fond.lignes.vc_aimes.envoi));
  const srcFond = fs.readFileSync(F.src, 'utf8');
  dit(/lance\('vcaimes', \(\) => reprendreOffresAimesVc\(\)\)/.test(srcFond), 'A8 · le réveil `vrm-offres` (1 min) relance la reprise');
  const etat = await S.fond.envoyer({ from: 'vmr-bridge', action: 'etat' }, { origin: 'https://vrm.center', url: 'https://vrm.center/' });
  dit(etat && etat.vcOffreAimes === true, 'A6 · l’état de l’extension dit `vcOffreAimes: true`', JSON.stringify(etat && Object.keys(etat)));
  // L'ancienne réponse aux offres reçues n'accepte JAMAIS le geste « favori ».
  const v = await S.cmd({ cmd: 'vcOffre', nego: '900000001', geste: 'favori' });
  dit(v && v.accepte === false && v.code === 'invalide', 'A6 · `vcOffre` (répondre à une offre reçue) refuse le geste « favori »', JSON.stringify(v));
}

async function a7() {
  const APP = fs.readFileSync(F.app, 'utf8');
  const cap = /const EXT_CAPACITES\s*=\s*\{([^}]*)\}/.exec(APP);
  dit(!!cap && /\bvcaimes:\s*'5\.393\.0'/.test(cap[1]), 'A7 · `EXT_CAPACITES.vcaimes` = 5.393.0 (servie avec la vague C)');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-favoris-regle-'));
  fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
  fs.copyFileSync(F.regle, path.join(dir, 'aimesVestiaire.js'));
  const R = await import(pathToFileURL(path.join(dir, 'aimesVestiaire.js')).href);
  dit(R.montantOffre('237', 24900) === 23700 && R.montantOffre('249', 24900) === null && R.montantOffre('300', 24900) === null && R.montantOffre('0,50', 24900) === null && R.montantOffre('abc', 24900) === null, 'A7 · le montant : sous le prix, 1 € au moins, sinon le bouton se tait');
  const L = R.lignesAimes({ aimes: { produits: { ['n' + ART]: { produit: ART, n: 3, prevenues: 1 }, ['n' + ART2]: { produit: ART2, n: 2 } } }, items: { [ART]: { titre: 'Dunk', prix: { valeur: 249, cle: 'product.price.cents', devise: 'EUR' }, compte: MOI } } });
  dit(L.lignes.length === 1 && L.lignes[0].produit === ART && L.lignes[0].aPrevenir === 2 && L.lignes[0].prixCents === 24900 && L.total === 5, 'A7 · un article pas lu dans « Mes articles » n’est pas proposé (pas de prix ⇒ pas d’offre)', JSON.stringify(L));
  dit(R.lignesAimes({ aimes: null }).lu === false && R.lignesAimes({ aimes: undefined }).pret === false, 'A7 · « pas lu » et « en cours » ne sont pas « personne »');
  const ecran = fs.readFileSync(F.ecran, 'utf8').replace(/\/\/[^\n]*/g, '');
  const appels = ecran.match(/envoyer\(\{[^}]*\}/g) || [];
  // (20 nov., décision de Julien) L'offre aux personnes qui aiment se fait dans le PANNEAU de l'extension : l'écran n'envoie rien.
  // (25 nov., décision de Julien du 24 nov. — CLAUDE.md §3) l'offre aux personnes qui aiment part DEPUIS VRM par la porte, UNE
  // commande pour CET article (son identifiant), au nom de SON compte ; pas connecté ⇒ le bouton du panneau sur CET article.
  const rA = await require('./_porte-agir.cjs').regle({ code: ecran,
    porte: /const ok = usePeutAgir\('vestiaire', x\.compte \|\| '', 'favoris', 'file'\)\.ok;[\s\S]*envoyerGeste\(\{ site: 'vestiaire', compte: x\.compte \|\| '', geste: 'favoris', distGeste: 'aimes', args: \{ produit: String\(x\.produit\)/,
    repli: /if \(!ok\) return <BoutonExtension className="sb-touche avc-geste" action="favoris" site="vestiaire" compte=\{x\.compte \|\| '\*'\} ids=\{\[String\(x\.produit\)\]\}/ });
  dit(appels.length === 0 && rA.ok, 'A7 · (24 nov.) l’offre aux personnes qui aiment : DEPUIS VRM par la porte sur CET article ; sinon le panneau sur CET article', rA.detail);
  const VC = fs.readFileSync(path.join(racine, 'src/ecrans/Vestiaire.jsx'), 'utf8');
  dit(/<AimesVestiaire etat=\{lignesAimes\(/.test(VC) && /id=eq\.vc_aimes&select=produits:data->produits,envoi:data->envoi/.test(VC), 'A7 · Messages Vestiaire montre « Ont aimé tes articles » (des nombres, projetés)');
  const lbc = fs.readFileSync(F.lbc, 'utf8');
  const fav = lbc.slice(lbc.indexOf('function FavorisLeboncoin('), lbc.indexOf('function FavorisLeboncoin(') + 6000);
  dit(/data-favoris-lbc-qui="jamais">\{tr\('favorisSites\.lbcQui'\)\}/.test(fav) && /data-favoris-lbc-levier="baisse"/.test(fav) && !/vmrCmd|fetch\(\s*['"`]\/api/.test(fav), 'A7 · Leboncoin : « ne dit pas qui » à l’écran, le levier (baisser le prix) nommé, et AUCUN envoi');
  const fr = fs.readFileSync(path.join(racine, 'src/i18n/langues/fr/favorisSites.js'), 'utf8');
  dit(/Leboncoin ne dit pas qui a mis ton annonce en favori : VRM ne peut écrire à personne\./.test(fr), 'A7 · la phrase honnête est écrite telle quelle');
}

(async () => {
  for (const [nom, f] of [['A1-A3', a1a3], ['A2-A6', a2a6], ['A7', a7]]) {
    try { await f(); } catch (e) { dit(false, `${nom} : l’audit a tourné jusqu’au bout`, String((e && e.stack) || e).slice(0, 500)); }
  }
  console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s)` : '\n✅ favoris sur les autres sites : tout est vert');
  process.exit(ko ? 1 : 0);
})();
