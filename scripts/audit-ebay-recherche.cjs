// ════════════════════════════════════════════════════════════════════════════
//  eBAY → ACHATS : LA RECHERCHE (API Browse), EXÉCUTÉE — 29 octobre.
//        node scripts/audit-ebay-recherche.cjs [--src dossier]
//
//  Julien : « Pour le côté achat je comprends pas à quoi ça sert ; je pense que
//  tu peux faire la recherche comme pour Vinted, avec un feed ; tout dépend si
//  ça utilisera beaucoup de données. »
//  La VRAIE route `api/ebay.js` (action `chercher`) contre un faux eBay et une
//  fausse base à état — données INVENTÉES (le dépôt est public). Formes tirées
//  de la documentation d'eBay (Browse API « search », OAuth client_credentials,
//  Developer Analytics « rate_limit ») : NON MESURÉES sur le vrai eBay.
//  Contrôles :
//    · sans session ⇒ 401, zéro appel à eBay ;
//    · le jeton est celui de L'APPLICATION (client_credentials), jamais le
//      jeton d'un vendeur (aucun refresh_token lu, aucun appel Trading) ;
//    · la requête : EBAY_FR, limit=30, tri plus récents, achat immédiat,
//      livrable en France, état, prix max ;
//    · résultats réduits : mot exclu et budget (port compris) écartés, port
//      inconnu jamais compté gratuit, photo i.ebayimg.com seulement ;
//    · plafond VRM par vendeur et par jour compté AVANT l'appel ; atteint ⇒ 429
//      et zéro appel ; compteur illisible ⇒ 503 et zéro appel ; nouveau jour ⇒
//      repart ; chaque vendeur son compteur ;
//    · eBay en panne ou illisible ⇒ 502 « pas pu chercher », jamais « aucun
//      résultat » ; une vraie réponse vide (total 0) ⇒ liste vide ;
//    · poids mesuré (octets eBay / VRM), quota eBay rendu quand eBay le dit ;
//    · les recherches enregistrées (metier.js) : pointure / achat immédiat /
//      livraison par défaut sur une recherche d'avant, 10 actives au plus.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path');
const iSrc = process.argv.indexOf('--src');
const RACINE = iSrc > 0 ? path.resolve(process.argv[iSrc + 1]) : path.join(__dirname, '..');

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'le contrôle a levé : ' + String((e && e.message) || e).slice(0, 160)); } };

const J = '11111111-1111-1111-1111-111111111111', B = '22222222-2222-2222-2222-222222222222';
const JWT_J = 'eyJh.jeton-de-J.sig', JWT_B = 'eyJh.jeton-de-B.sig';
process.env.VRM_OWNER_UID = J;
process.env.EBAY_APP_ID = 'app-de-banc';
process.env.EBAY_CERT_ID = 'secret-de-banc';
process.env.SUPABASE_SERVICE_KEY = 'cle-service-de-banc';

let lignes = [], journal = [], mode = {};
// L'id du compteur est lu dans la route (il a changé le 30 oct. : sous le
// préfixe gardé `ebay_tokens`) ; un ancien id ne serait jamais servi.
let CPT = 'ebay_tokens_recherches_jour';
const rep = (corps, status = 200) => new Response(typeof corps === 'string' ? corps : JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } });
const ITEMS = () => ([
  { itemId: 'v1|1001|0', title: 'Salomon XT-6 noir taille 43', price: { value: '60.00', currency: 'EUR' }, shippingOptions: [{ shippingCostType: 'FIXED', shippingCost: { value: '6.50', currency: 'EUR' } }], condition: 'Occasion', seller: { username: 'vendeur_a', feedbackPercentage: '99.5' }, image: { imageUrl: 'https://i.ebayimg.com/images/g/a/s-l225.jpg' }, itemWebUrl: 'https://www.ebay.fr/itm/1001', buyingOptions: ['FIXED_PRICE'], itemCreationDate: '2026-10-29T08:00:00.000Z', itemLocation: { country: 'FR' } },
  { itemId: 'v1|1002|0', title: 'Salomon XT-6 replica copie', price: { value: '30.00', currency: 'EUR' }, shippingOptions: [{ shippingCostType: 'FIXED', shippingCost: { value: '5.00', currency: 'EUR' } }], buyingOptions: ['FIXED_PRICE'] },
  { itemId: 'v1|1003|0', title: 'Salomon XT-6 blanc taille 43', price: { value: '78.00', currency: 'EUR' }, shippingOptions: [{ shippingCostType: 'FIXED', shippingCost: { value: '6.00', currency: 'EUR' } }], buyingOptions: ['FIXED_PRICE'] },
  { itemId: 'v1|1004|0', title: 'Salomon XT-6 gris 43', price: { value: '70.00', currency: 'EUR' }, shippingOptions: [{ shippingCostType: 'CALCULATED' }], image: { imageUrl: 'https://pirate.example/x.jpg' }, itemWebUrl: 'javascript:alert(1)', buyingOptions: ['FIXED_PRICE'] },
]);
global.fetch = async (url, opts = {}) => {
  const u = String(url), m = (opts.method || 'GET').toUpperCase(), h = opts.headers || {};
  if (u.includes('/auth/v1/user')) {
    const a = String(h.Authorization || h.authorization || '');
    if (a === 'Bearer ' + JWT_J) return rep({ id: J, email: 'j@exemple.test' });
    if (a === 'Bearer ' + JWT_B) return rep({ id: B, email: 'b@exemple.test' });
    return rep({ msg: 'invalid' }, 401);
  }
  if (u.includes('ebay.com')) {
    const corps = String(opts.body || '');
    journal.push({ ou: 'ebay', m, u, corps, auth: String(h.Authorization || ''), marche: h['X-EBAY-C-MARKETPLACE-ID'] || '', appel: h['X-EBAY-API-CALL-NAME'] || '' });
    if (u.includes('/identity/v1/oauth2/token')) {
      if (mode.token === 'ko') return rep({ error: 'invalid_client' }, 401);
      if (/grant_type=client_credentials/.test(corps) && /^Basic /.test(String(h.Authorization || ''))) return rep({ access_token: 'jeton-app', expires_in: 7200, token_type: 'Application Access Token' });
      return rep({ access_token: 'jeton-utilisateur', expires_in: 7200 });
    }
    if (u.includes('/buy/browse/v1/item_summary/search')) {
      if (mode.browse === 'panne') return rep({ errors: [{ errorId: 10001 }] }, 500);
      if (mode.browse === 'html') return new Response('<html>maintenance</html>', { status: 200, headers: { 'content-type': 'text/html' } });
      if (mode.browse === 'vide') return rep({ href: u, total: 0, limit: 30, offset: 0 });
      if (mode.browse === 'reseau') throw new Error('ECONNRESET');
      if (mode.browse === '401') return rep({ errors: [{ errorId: 1001, message: 'Invalid access token' }] }, 401);
      return rep({ href: u, total: 4, limit: 30, offset: 0, itemSummaries: ITEMS() });
    }
    if (u.includes('/developer/analytics/v1_beta/rate_limit')) return rep({ rateLimits: [{ apiContext: 'buy', apiName: 'browse', resources: [{ name: 'buy.browse', rates: [{ count: 120, limit: 5000, remaining: 4880, reset: '2026-10-30T07:00:00.000Z', timeWindow: 86400 }] }] }] });
    return rep({});
  }
  if (u.includes('/rest/v1/rpc/vrm_acces_pour')) return rep(true);
  if (u.includes('/rest/v1/app_data')) {
    const q = decodeURIComponent(u);
    if (/select=owner&limit=1/.test(q)) return rep([]);
    const id = (/[?&]id=eq\.([^&]*)/.exec(q) || [])[1];
    const owner = (/[?&]owner=eq\.([^&]*)/.exec(q) || [])[1];
    if (m === 'GET') {
      journal.push({ ou: 'lecture', u: q });
      if (id === CPT && mode.compteur === 'ko') return rep({ message: 'boom' }, 500);
      return rep(lignes.filter((r) => (!id || r.id === id) && (!owner || r.owner === owner)).map((r) => ({ data: r.data })));
    }
    let rows = []; try { rows = [].concat(JSON.parse(opts.body || '[]')); } catch (_) {}
    journal.push({ ou: 'ecriture', m, u: q, corps: String(opts.body || '') });
    if (m === 'PATCH') {
      const revEq = (/[?&]data->>rev=eq\.([^&]*)/.exec(q) || [])[1], revNul = /data->>rev=is\.null/.test(q);
      const touche = lignes.filter((x) => x.id === id && x.owner === owner && (revNul ? (x.data == null || x.data.rev == null) : (revEq === undefined || String(x.data && x.data.rev) === revEq)));
      for (const x of touche) x.data = rows[0] && rows[0].data;
      return rep(touche.map((x) => ({ id: x.id })));
    }
    for (const r of rows) {
      if (lignes.some((x) => x.id === r.id && x.owner === r.owner) && !/on_conflict=/.test(q)) return rep({ code: '23505' }, 409);
      const i = lignes.findIndex((x) => x.id === r.id && x.owner === r.owner);
      if (i >= 0) lignes[i] = { ...lignes[i], ...r }; else lignes.push({ ...r });
    }
    return rep([{ id: rows[0] && rows[0].id }], 201);
  }
  return rep({});
};
const faireRes = () => { const x = { code: null, corps: null, entetes: {} }; x.status = (n) => { x.code = n; return x; }; x.json = (o) => { x.corps = o; return x; }; x.setHeader = (k, v) => { x.entetes[String(k).toLowerCase()] = v; }; x.end = () => x; return x; };

(async () => {
  let route;
  await essaie('chargement de la route', async () => { route = await import('file://' + path.join(RACINE, 'api', 'ebay.js')); });
  if (!route) { console.log('\n❌ audit-ebay-recherche : la route n\'a pas pu être chargée'); process.exit(1); }
  let lib = null;
  await essaie('chargement de la règle', async () => { lib = await import('file://' + path.join(RACINE, 'api', '_lib', 'ebay-recherche.js')); if (lib.ID_COMPTEUR) CPT = lib.ID_COMPTEUR; });
  const app = async (jwt, corps) => { journal = []; const res = faireRes(); await route.default({ method: 'POST', query: {}, headers: jwt ? { authorization: 'Bearer ' + jwt } : {}, body: corps }, res); return { code: res.code, corps: res.corps || {}, journal: journal.slice() }; };
  const browse = (j) => j.filter((x) => x.ou === 'ebay' && /item_summary\/search/.test(x.u));
  const criteres = { action: 'chercher', mots: 'salomon xt-6', pointure: '43', maximum: 8000, etat: 'occasion', achatImmediat: true, livraisonFR: true, exclus: 'replica, copie' };
  const compteur = (o) => { const l = lignes.find((x) => x.id === CPT && x.owner === o); return l && l.data; };

  await essaie('A. sans session', async () => {
    const r = await app(null, criteres);
    dit(r.code === 401, 'A. sans session ⇒ 401', 'code ' + r.code);
    dit(!r.journal.some((x) => x.ou === 'ebay'), 'A. sans session ⇒ zéro appel à eBay');
  });

  await essaie('B. critères refusés', async () => {
    lignes = [];
    const r = await app(JWT_J, { action: 'chercher', mots: 'x' });
    dit(r.code === 400, 'B. mots trop courts ⇒ 400', 'code ' + r.code);
    const r2 = await app(JWT_J, { ...criteres, pointure: '43abc' });
    dit(r2.code === 400 && !browse(r2.journal).length, 'B. pointure illisible ⇒ 400, rien envoyé à eBay', 'code ' + r2.code);
    dit(!compteur(J), 'B. un refus de critères ne consomme pas le plafond');
  });

  await essaie('C. recherche normale', async () => {
    lignes = []; mode = {};
    const r = await app(JWT_J, criteres);
    dit(r.code === 200 && r.corps.ok === true, 'C. la recherche répond 200', 'code ' + r.code + ' ' + JSON.stringify(r.corps).slice(0, 160));
    const tok = r.journal.filter((x) => x.ou === 'ebay' && /oauth2\/token/.test(x.u));
    dit(tok.length >= 1 && tok.every((x) => /grant_type=client_credentials/.test(x.corps) && !/refresh_token/.test(x.corps)), 'C. jeton d\'APPLICATION (client_credentials), jamais un refresh_token de vendeur');
    dit(!r.journal.some((x) => x.ou === 'lecture' && /id=eq\.ebay_tokens(&|$|_[0-9a-f]{16}(&|$))/.test(x.u)), 'C. aucun jeton de vendeur lu en base');
    dit(!r.journal.some((x) => x.appel), 'C. aucun appel Trading (rien au nom du vendeur)');
    const b = browse(r.journal)[0] || { u: '', auth: '' };
    const q = decodeURIComponent(b.u);
    dit(b.auth === 'Bearer jeton-app', 'C. Browse appelé avec le jeton d\'application', b.auth);
    dit(b.marche === 'EBAY_FR', 'C. marché EBAY_FR', b.marche);
    dit(/limit=30\b/.test(q) && /sort=newlyListed/.test(q), 'C. 30 annonces au plus, les plus récentes d\'abord', q.slice(0, 200));
    dit(/buyingOptions:\{FIXED_PRICE\}/.test(q) && /deliveryCountry:FR/.test(q) && /conditions:\{USED\}/.test(q), 'C. filtres achat immédiat, livrable en France, occasion');
    dit(/price:\[\.\.80\.00\]/.test(q) && /priceCurrency:EUR/.test(q) && /q=salomon\+xt-6\+43/.test(b.u.replace(/%20/g, '+')), 'C. prix max 80,00 € et pointure dans la recherche', q.slice(0, 260));
    const ids = (r.corps.items || []).map((x) => x.itemId);
    dit(ids.includes('v1|1001|0') && !ids.includes('v1|1002|0'), 'C. le mot exclu (« replica ») écarte l\'annonce', ids.join(','));
    dit(!ids.includes('v1|1003|0') && r.corps.horsBudget === 1, 'C. 78 € + 6 € de port = 84 € > 80 € : écartée (budget port compris)', 'horsBudget=' + r.corps.horsBudget);
    const inconnu = (r.corps.items || []).find((x) => x.itemId === 'v1|1004|0');
    dit(!!inconnu && inconnu.port === null && inconnu.total === null, 'C. port « calculé » = inconnu, jamais 0', JSON.stringify(inconnu || {}).slice(0, 120));
    dit(!!inconnu && inconnu.photo === null && /^https:\/\/www\.ebay\.fr\/itm\//.test(inconnu.url), 'C. photo hors i.ebayimg.com et lien non eBay refusés');
    const p1 = (r.corps.items || []).find((x) => x.itemId === 'v1|1001|0') || {};
    dit(p1.prix === 6000 && p1.port === 650 && p1.total === 6650 && p1.vendeur === 'vendeur_a', 'C. prix, port, total en centimes ; vendeur', JSON.stringify(p1).slice(0, 160));
    dit(r.corps.appels && r.corps.appels.aujourdhui === 1 && r.corps.appels.plafond === 200, 'C. 1 recherche comptée sur 200', JSON.stringify(r.corps.appels));
    const c = compteur(J);
    dit(!!c && c.n === 1 && /^\d{4}-\d{2}-\d{2}$/.test(c.jour), 'C. compteur rangé chez CE vendeur', JSON.stringify(c));
    dit(r.corps.octets && r.corps.octets.ebay > 0 && r.corps.octets.vrm > 0, 'C. poids mesuré (octets reçus d\'eBay, envoyés à l\'app)', JSON.stringify(r.corps.octets));
    dit(r.corps.quotaEbay && r.corps.quotaEbay.limite === 5000 && r.corps.quotaEbay.restant === 4880, 'C. quota d\'eBay rendu quand eBay le dit', JSON.stringify(r.corps.quotaEbay));
    dit(!/jeton-app|secret-de-banc/.test(JSON.stringify(r.corps)), 'C. aucun jeton ni secret dans la réponse');
  });

  await essaie('D. plafond', async () => {
    const auj = (compteur(J) || {}).jour;
    lignes = [{ owner: J, id: CPT, data: { jour: auj, n: 200, rev: 7 } }];
    const r = await app(JWT_J, criteres);
    dit(r.code === 429 && r.corps.reason === 'plafond', 'D. 200 recherches faites ⇒ 429 plafond', 'code ' + r.code);
    dit(!browse(r.journal).length, 'D. plafond atteint ⇒ zéro appel à Browse');
    dit((compteur(J) || {}).n === 200, 'D. le compteur ne monte pas au-delà');
    lignes = [{ owner: J, id: CPT, data: { jour: '2020-01-01', n: 200, rev: 3 } }];
    const r2 = await app(JWT_J, criteres);
    dit(r2.code === 200 && (compteur(J) || {}).n === 1, 'D. un nouveau jour (Paris) ⇒ le compteur repart à 1', 'code ' + r2.code + ' ' + JSON.stringify(compteur(J)));
    lignes = [{ owner: J, id: CPT, data: { jour: auj, n: 200, rev: 3 } }];
    const r3 = await app(JWT_B, criteres);
    dit(r3.code === 200 && (compteur(B) || {}).n === 1 && (compteur(J) || {}).n === 200, 'D. chaque vendeur son compteur (B n\'est pas bloqué par J)');
  });

  await essaie('E. compteur illisible', async () => {
    lignes = []; mode = { compteur: 'ko' };
    const r = await app(JWT_J, criteres);
    dit(r.code === 503 && r.corps.reason === 'pas-su', 'E. compteur illisible ⇒ 503 pas su', 'code ' + r.code);
    dit(!browse(r.journal).length, 'E. compteur illisible ⇒ zéro appel à Browse');
  });

  for (const [m, nom] of [['panne', 'eBay répond 500'], ['html', 'eBay répond du HTML'], ['reseau', 'eBay injoignable']]) {
    await essaie('F. ' + nom, async () => {
      lignes = []; mode = { browse: m };
      const r = await app(JWT_J, criteres);
      dit(r.code === 502 && r.corps.reason === 'ebay' && !Array.isArray(r.corps.items), 'F. ' + nom + ' ⇒ 502 « pas pu chercher », jamais une liste vide', 'code ' + r.code + ' ' + JSON.stringify(r.corps).slice(0, 120));
      dit(/pas « aucun résultat »/.test(String(r.corps.error || '')), 'F. ' + nom + ' : la phrase dit que ce n\'est pas « aucun résultat »');
    });
  }
  await essaie('F. jeton refusé', async () => {
    lignes = []; mode = { token: 'ko' };
    const lib = await import('file://' + path.join(RACINE, 'api', '_lib', 'ebay.js'));
    // le jeton d'application peut être gardé par l'instance : la panne ne se
    // voit que sans jeton gardé — on vérifie la règle de la fonction elle-même.
    const j = lib.jetonApplication ? await lib.jetonApplication(Date.now() + 10 * 24 * 3600 * 1000) : 'absent';
    dit(j === null, 'F. clés refusées par eBay ⇒ pas de jeton (null), jamais une chaîne vide', String(j));
  });

  await essaie('F. jeton refusé par Browse (401)', async () => {
    lignes = []; mode = { browse: '401' };
    await app(JWT_J, criteres);
    mode = {};
    const r = await app(JWT_J, criteres);
    const tok = r.journal.filter((x) => x.ou === 'ebay' && /oauth2\/token/.test(x.u));
    dit(r.code === 200 && tok.length === 1, 'F. après un 401 de Browse, le jeton d\'application est redemandé (pas gardé)', 'code ' + r.code + ', jetons demandés : ' + tok.length);
  });
  await essaie('G. réponse vide', async () => {
    lignes = []; mode = { browse: 'vide' };
    const r = await app(JWT_J, criteres);
    dit(r.code === 200 && Array.isArray(r.corps.items) && r.corps.items.length === 0 && r.corps.total === 0, 'G. eBay dit total 0 ⇒ liste vide (une vraie réponse)', 'code ' + r.code);
  });

  await essaie('H. recherches enregistrées (metier.js)', async () => {
    const met = await import('file://' + path.join(RACINE, 'src', 'operations', 'metier.js'));
    const ancien = met.criteresVeille({ titre: 'XT-6', mots: 'salomon xt-6', exclus: '', categorie: '', etatArticle: 'tous', minimum: null, maximum: 2000, pays: 'FR' });
    dit(ancien.pointure === '' && ancien.achatImmediat === true && ancien.livraisonFR === true, 'H. une recherche d\'avant reçoit les défauts (pas de pointure, achat immédiat, livrable en France)', JSON.stringify(ancien));
    let refus = '';
    try { met.criteresVeille({ titre: 'a', mots: 'ab', etatArticle: 'tous', minimum: null, maximum: 100, pays: 'FR', pointure: '4x' }); } catch (e) { refus = e.message; }
    dit(/Pointure/.test(refus), 'H. pointure illisible refusée', refus);
    const base = met.VIDE();
    const cmd = (i) => ({ id: '00000000-0000-4000-8000-' + String(i).padStart(12, '0'), type: 'veille.creer', revision: 0, donnees: { titre: 'r' + i, mots: 'nike ' + i, etatArticle: 'tous', minimum: null, maximum: 5000, pays: 'FR' } });
    let d = base, err = '';
    for (let i = 0; i < 11; i++) { try { d = met.appliquer(d, cmd(i), { acteur: J, maintenant: new Date().toISOString() }); } catch (e) { err = e.message; } }
    dit(d.veilles.length === 10 && /10 recherches actives/.test(err), 'H. 10 recherches actives au plus (la 11ᵉ est refusée)', d.veilles.length + ' · ' + err);
  });

  // ── I. (30 oct., revue) LE COMPTEUR NE S'ÉCRIT PAS PAR UN NAVIGATEUR ─────────
  // Sous `ebay_recherches_jour`, une ligne app_data ordinaire, un vendeur
  // effaçait sa propre ligne (RLS le lui permet) et repartait de zéro : le
  // plafond ne protégeait pas le quota d'eBay commun. La garde de la base
  // (`vrm_garde_ebay_tokens`, migration 014, en place en production) couvre
  // tout id qui COMMENCE par `ebay_tokens`.
  await essaie('I. compteur gardé', async () => {
    const fs = require('fs');
    dit(CPT.startsWith('ebay_tokens') && CPT !== 'ebay_tokens' && !/_[0-9a-f]{16}$/.test(CPT), 'I. le compteur vit sous le préfixe gardé `ebay_tokens…`, sans pouvoir être pris pour les jetons d\'un compte', CPT);
    const m14 = fs.readFileSync(path.join(RACINE, 'supabase', 'migrations', '014-agent.sql'), 'utf8');
    const garde = ['before insert', 'before update', 'before delete'].every((ev) => new RegExp(ev + "[^;]*starts_with\\((new|old)\\.id, 'ebay_tokens'\\)", 'i').test(m14));
    dit(garde, 'I. la garde de la base couvre ce préfixe en création, réécriture et effacement (migration 014)');
    const lire = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? (e.name === 'node_modules' ? [] : lire(path.join(d, e.name))) : [path.join(d, e.name)]);
    const ecrivains = [...lire(path.join(RACINE, 'src')), ...lire(path.join(RACINE, 'vinted-sync-extension'))].filter((f) => /\.(jsx?|mjs)$/.test(f) && fs.readFileSync(f, 'utf8').includes(CPT));
    dit(ecrivains.length === 0, 'I. ni l\'app ni l\'extension ne nomment le compteur (seule la route l\'écrit, clé de service)', ecrivains.join(', '));
    const balayages = [...lire(path.join(RACINE, 'api')), ...lire(path.join(RACINE, 'src'))].filter((f) => /\.(jsx?|mjs)$/.test(f) && /like\.ebay_tokens/.test(fs.readFileSync(f, 'utf8')));
    dit(balayages.length === 0, 'I. aucun balayage `ebay_tokens*` ne prendrait le compteur pour un compte', balayages.join(', '));
  });

  // ── J. (30 oct., revue) UNE RÈGLE DE CRITÈRES (§11) ─────────────────────────
  // Une recherche qu'Organisation enregistre doit être une recherche que la
  // route accepte : sinon elle reste « pas pu chercher » pour toujours.
  await essaie('J. une règle de critères', async () => {
    const met = await import('file://' + path.join(RACINE, 'src', 'operations', 'metier.js'));
    const base = { titre: 't', etatArticle: 'tous', minimum: null, maximum: 5000, pays: 'FR' };
    const cas = [{ mots: 'x' }, { mots: 'x  ' }, { mots: 'salomon', categorie: 'baskets' }, { mots: 'salomon', categorie: '15709' }, { mots: 'ab', pointure: '42,5' }, { mots: 'nike', pointure: '4x' }, { mots: 'nike', categorie: '12a' }, { mots: ' a b ' }];
    const ecarts = [];
    for (const c of cas) {
      let veille = true; try { met.criteresVeille({ ...base, ...c }); } catch (_) { veille = false; }
      const routeOk = !!(lib && lib.criteresRecherche({ ...c }).ok);
      if (veille !== routeOk) ecarts.push(JSON.stringify(c) + ' → Organisation ' + (veille ? 'accepte' : 'refuse') + ', la route ' + (routeOk ? 'accepte' : 'refuse'));
    }
    dit(ecarts.length === 0, 'J. Organisation et la route acceptent et refusent les MÊMES critères', ecarts.join(' · '));
    lignes = []; mode = {};
    const r = await app(JWT_J, { action: 'chercher', mots: 'salomon', categorie: 'baskets' });
    dit(r.code === 400 && r.corps.reason === 'criteres' && !browse(r.journal).length && !compteur(J), 'J. critères refusés ⇒ 400 « criteres », zéro appel, rien compté', 'code ' + r.code);
  });

  // ── K. (30 oct., dernier tour) UNE PART DU PLAFOND POUR LA MAIN ─────────────
  // Le fil (10 recherches × 4 par heure) épuisait seul les 200 du jour : après
  // une matinée d'onglet ouvert, plus une seule recherche à la main. Le fil
  // s'arrête à 150 ; les 50 restantes sont gardées pour « Chercher ».
  await essaie('K. part du fil', async () => {
    lignes = []; mode = {};
    const r0 = await app(JWT_J, { ...criteres, source: 'fil' });
    const auj = (compteur(J) || {}).jour;
    dit(r0.code === 200 && (compteur(J) || {}).fil === 1 && (compteur(J) || {}).n === 1, 'K. une relecture du fil est comptée dans le total ET dans la part du fil', JSON.stringify(compteur(J)));
    lignes = [{ owner: J, id: CPT, data: { jour: auj, n: 150, fil: 150, rev: 4 } }];
    const r = await app(JWT_J, { ...criteres, source: 'fil' });
    dit(r.code === 429 && r.corps.reason === 'plafond-fil' && !browse(r.journal).length, 'K. 150 relectures du fil ⇒ le fil s’arrête (429 « plafond-fil »), zéro appel à Browse', 'code ' + r.code + ' ' + (r.corps.reason || ''));
    dit(/il te reste 50 recherches à la main/i.test(String(r.corps.error || '')), 'K. la phrase dit ce qui reste pour chercher à la main', String(r.corps.error || ''));
    const r2 = await app(JWT_J, criteres);
    dit(r2.code === 200 && (compteur(J) || {}).n === 151 && (compteur(J) || {}).fil === 150, 'K. une recherche à la main passe encore (comptée dans le total, pas dans le fil)', 'code ' + r2.code + ' ' + JSON.stringify(compteur(J)));
    lignes = [{ owner: J, id: CPT, data: { jour: auj, n: 200, fil: 150, rev: 5 } }];
    const r3 = await app(JWT_J, criteres);
    dit(r3.code === 429 && r3.corps.reason === 'plafond', 'K. le total de 200 reste le plafond de la main', 'code ' + r3.code);
  });

  // ── L. (30 oct., dernier tour) UNE RECHERCHE D'AVANT LA RÈGLE SE CORRIGE ────
  // Enregistrée avant la règle commune (catégorie en lettres), elle était
  // refusée par le fil (« modifie-la ») ET par « Modifier » (l'ANCIENNE était
  // revalidée) : seule issue, archiver et recréer.
  await essaie('L. recherche d’avant', async () => {
    const met = await import('file://' + path.join(RACINE, 'src', 'operations', 'metier.js'));
    const id = '00000000-0000-4000-8000-0000000000aa';
    const vieille = { id, titre: 'XT-6', mots: 'salomon xt-6', exclus: '', categorie: 'baskets', etatArticle: 'tous', minimum: null, maximum: 9000, pays: 'FR', pointure: '', achatImmediat: true, livraisonFR: true, etat: 'preparee', version: 1, cree: '2026-10-01T10:00:00.000Z', evenements: [] };
    const src = { ...met.VIDE(), revision: 3, veilles: [vieille] };
    const m = new Date().toISOString();
    let d = null, err = '';
    try { d = met.appliquer(src, { id: '00000000-0000-4000-8000-0000000000b1', type: 'veille.modifier', revision: 3, donnees: { cible: id, versionAttendue: 1, titre: 'XT-6', mots: 'salomon xt-6', exclus: '', categorie: '', etatArticle: 'tous', minimum: null, maximum: 9000, pays: 'FR', pointure: '43' } }, { acteur: J, maintenant: m }); } catch (e) { err = e.message; }
    const x = d && d.veilles.find((v) => v.id === id);
    dit(!!x && x.categorie === '' && x.version === 2, 'L. une recherche enregistrée avant la règle (catégorie « baskets ») peut être corrigée', err || JSON.stringify(x && { categorie: x.categorie, version: x.version }));
    const ev = x && x.evenements && x.evenements[0];
    dit(!!ev && ev.avant && ev.avant.categorie === 'baskets' && ev.apres.categorie === '', 'L. l’historique garde l’ancienne recherche telle qu’elle était', JSON.stringify(ev && ev.avant));
    let err2 = '';
    try { met.appliquer(src, { id: '00000000-0000-4000-8000-0000000000b2', type: 'veille.modifier', revision: 3, donnees: { cible: id, versionAttendue: 1, titre: 'XT-6', mots: 'salomon xt-6', categorie: 'chaussures', etatArticle: 'tous', minimum: null, maximum: 9000, pays: 'FR' } }, { acteur: J, maintenant: m }); } catch (e) { err2 = e.message; }
    dit(/catégorie/i.test(err2), 'L. la NOUVELLE recherche reste jugée par la règle commune', err2);
    let err3 = '';
    try { met.appliquer(src, { id: '00000000-0000-4000-8000-0000000000b3', type: 'veille.dupliquer', revision: 3, donnees: { cible: id, titre: 'copie' } }, { acteur: J, maintenant: m }); } catch (e) { err3 = e.message; }
    dit(/modifie-la d’abord/.test(err3), 'L. dupliquer une recherche refusée dit quoi changer', err3);
  });

  // ── M. (30 oct., dernier tour) « AIR MAX 1 » N'EST PAS DANS « AIR MAX 180 » ──
  // Le modèle était trouvé par une sous-chaîne : l'Air Max 180 (une autre paire,
  // un autre prix) recevait le repère de l'Air Max 1, côté ventes et côté eBay.
  await essaie('M. modèle sur une frontière', async () => {
    const fs = require('fs');
    const SRC = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
    const prendre = (nom) => { const i = SRC.search(new RegExp('(^|\\n)(const ' + nom + ' ?=|function ' + nom + '\\()')); if (i < 0) return ''; let j = SRC.indexOf('{', SRC.indexOf(nom, i)), p = 0; if (/^\s*const /.test(SRC.slice(i, i + 12)) && SRC.slice(i).search(/=\s*\[/) < 40) { j = SRC.indexOf('[', i); for (let k = j; k < SRC.length; k++) { if (SRC[k] === '[') p++; if (SRC[k] === ']') { p--; if (!p) return SRC.slice(i, k + 2); } } } for (let k = j; k < SRC.length; k++) { if (SRC[k] === '{') p++; if (SRC[k] === '}') { p--; if (!p) return SRC.slice(i, k + 1); } } return ''; };
    const code = [prendre('KNOWN_MODELS'), prendre('extractModel'), prendre('contientModele')].join('\n');
    const em = new Function(code + '\nreturn extractModel;')();
    const cas = [['Nike Air Max 180 blanc 43', 'air max'], ['Nike Air Max 1000 noir', 'air max'], ['Nike Air Max 1 blanc 43', 'air max 1'], ['Nike air max 1 86 OG', 'air max 1'], ['Salomon XT-6 noir', 'xt 6'], ['Salomon XT-60 test', null]];
    const faux = cas.filter(([t, m]) => em(t) !== m).map(([t, m]) => t + ' → ' + em(t) + ' (attendu ' + m + ')');
    dit(faux.length === 0, 'M. un modèle qui finit par un chiffre ne se lit pas dans un nombre plus long (Air Max 180 ≠ Air Max 1)', faux.join(' · '));
  });

  console.log(`\n${ko ? '❌' : '✅'} audit-ebay-recherche : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
