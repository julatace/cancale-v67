// Banc : eBay → VEILLE D'ACHAT (15 octobre) — l'écran RENDU, sur des données
// INVENTÉES (il vit dans le dépôt, qui est public : aucune fixture). Port 6001.
//
// Ce que la page demande à `/api/ebay` est exécuté par la VRAIE route
// (`api/_lib/veille.js`, dans ce processus) contre une fausse base à état et un
// faux eBay : l'écran montre ce que le serveur a vraiment jugé. Rendu à 390 et
// 1512 px, en clair et en sombre, et il exige — en jugeant les `data-*` posés
// par l'écran (§6.5) et ce qui part vers `/api/ebay` :
//   · un lien de notification `?tab=ebay_veille` ouvre eBay → Veille ;
//   · une phrase dit, UNE fois, que Vinted et Leboncoin ne sont pas surveillés ;
//   · chaque annonce dit POURQUOI elle correspond et ce qui n'est pas vérifiable ;
//     livraison inconnue ⇒ « total non confirmé », jamais un total inventé ;
//   · aucun bouton d'achat, de paiement, d'enchère ou d'offre ;
//   · « Refuser » demande un motif et range l'annonce dans « Refusées » ;
//   · la rentabilité d'une annonce : la fourchette vient de SES ventes du même
//     modèle et de la même pointure (3 ventes), le bénéfice nomme ce qui manque ;
//   · le budget : ce que l'écran Achats a publié, le reste juste ;
//   · « Tester sans enregistrer » ne range RIEN ; « Vérifier » repasse chez eBay ;
//   · ses recherches illisibles ⇒ « je n'ai pas pu lire », jamais « aucune » ;
//   · aucun débordement horizontal, aucune erreur de page.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const DIST = path.join(__dirname, '..', '..', 'dist');
const RACINE = path.join(__dirname, '..', '..');
const PORT = Number(process.env.PORT) || 6001;
const CAPTURES = process.env.BANC_CAPTURES || os.tmpdir();
const T0 = Date.parse('2026-10-15T08:00:00.000Z');   // jeudi 15 octobre, 10:00 à Paris
const OWNER = '11111111-1111-1111-1111-111111111111';
process.env.VRM_OWNER_UID = OWNER;
process.env.EBAY_APP_ID = 'app-de-banc';
process.env.EBAY_CERT_ID = 'secret-de-banc';
process.env.SUPABASE_SERVICE_KEY = 'cle-service-de-banc';

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { dit(false, quoi, 'a levé : ' + String((e && e.message) || e).split('\n')[0].slice(0, 180)); return null; } };

// ── LE FAUX eBAY ET LA FAUSSE BASE DU SERVEUR (données inventées) ─────────────
const item = (id, title, prix, livraison, cond, extra) => ({
  itemId: `v1|${id}|0`, legacyItemId: String(id), title, price: { value: prix, currency: 'EUR' },
  ...(livraison === undefined ? {} : { shippingOptions: [{ shippingCostType: 'FIXED', shippingCost: { value: livraison, currency: 'EUR' } }] }),
  condition: cond === '1750' ? 'Neuf avec défauts' : 'Occasion', conditionId: cond,
  image: { imageUrl: `https://i.ebayimg.com/images/g/x${id}/s-l500.jpg` },
  itemLocation: { country: 'FR' }, buyingOptions: ['FIXED_PRICE'], seller: { username: 'pseudo_invente', feedbackPercentage: '99.1', feedbackScore: 812 },
  itemCreationDate: new Date(T0 - (id % 9) * 3600000).toISOString(), ...(extra || {}),
});
const ITEMS = () => [
  item(110001, 'Adidas Spezial Handball 42 bleu', '45.00', '6.50', '3000'),
  item(110002, 'Adidas Spezial 42 2/3 noir', '40.00', '5.00', '3000'),
  item(110003, 'Lot de 2 paires Adidas Spezial 42', '50.00', '5.00', '3000'),
  item(110005, 'Adidas Spezial EU 42 marron', '50.00', undefined, '3000'),
  item(110006, 'Adidas Spezial 42 rouge', '55.00', '9.00', '3000'),
  item(110007, 'Adidas Spezial 42/43 gris', '30.00', '5.00', '3000'),
  item(110008, 'Adidas Spezial UK 8 vert', '35.00', '4.00', '3000'),
  item(110011, 'Adidas Spezial 42 blanc semelle neuve', '52.00', '0.00', '3000', { image: undefined }),
];
let srvBase = [], envois = [], ebayAppels = [], panneVeille = false;
const rep = (corps, status = 200) => new Response(typeof corps === 'string' ? corps : JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } });
const fetchServeur = async (url, opts = {}) => {
  const u = String(url); const m = (opts.method || 'GET').toUpperCase();
  if (u.includes('ebay.com')) {
    ebayAppels.push(u);
    if (u.includes('/oauth2/token')) return rep({ access_token: 'jeton-application', expires_in: 7200 });
    if (u.includes('/buy/browse/v1/item_summary/search')) {
      const q = decodeURIComponent((/[?&]q=([^&]*)/.exec(u) || [])[1] || '');
      const items = /samba/i.test(q) ? [item(120001, 'Adidas Samba OG 43 blanc', '48.00', '5.00', '3000')] : ITEMS();
      return rep({ total: /samba/i.test(q) ? 1 : 2400, itemSummaries: items });
    }
    return rep({}, 404);
  }
  if (u.includes('/rest/v1/app_data')) {
    const q = decodeURIComponent(u);
    if (/select=owner&limit=1/.test(q)) return rep([]);
    const id = (/[?&]id=eq\.([^&]*)/.exec(q) || [])[1];
    if (m === 'GET') {
      if (panneVeille && /^veille_/.test(id || '')) return rep('<html>522</html>', 522);
      return rep(srvBase.filter((r) => r.id === id).map((r) => ({ data: r.data })));
    }
    let rows = []; try { rows = [].concat(JSON.parse(opts.body || '[]')); } catch (_) {}
    if (m === 'PATCH') {
      const revEq = (/[?&]data->>rev=eq\.([^&]*)/.exec(q) || [])[1], revNul = /data->>rev=is\.null/.test(q);
      const t = srvBase.filter((x) => x.id === id && (revNul ? x.data.rev == null : String(x.data.rev) === revEq));
      for (const x of t) x.data = rows[0].data;
      return rep(t.map((x) => ({ id: x.id })));
    }
    for (const r of rows) { if (srvBase.some((x) => x.id === r.id)) return rep({ code: '23505' }, 409); srvBase.push({ id: r.id, data: r.data }); }
    return rep('', 201);
  }
  if (u.includes('/rest/v1/rpc/')) return rep(true);
  return rep({});
};
global.fetch = fetchServeur;

// ── LES DONNÉES DE L'APP (navigateur) ────────────────────────────────────────
const vente = (k, titre, prix, jours) => ({ transaction_id: 900000 + k, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, status: 'Commande finalisée', date: new Date(T0 - jours * 86400000).toISOString() });
const VENTES = { capturedAt: new Date(T0).toISOString(), payload: { my_orders: [
  vente(1, 'Adidas Spezial bleu taille 42', 80, 12), vente(2, 'Adidas Spezial noir taille 42', 90, 30), vente(3, 'Adidas Spezial vert taille 42', 100, 64),
  vente(4, 'Adidas Spezial taille 43', 150, 3), vente(5, 'Nike Dunk Low taille 42', 95, 5),
] } };
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: new Date(T0).toISOString() }];

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
srv.listen(PORT);

let V = null;
async function ouvrir(b, vp, opts = {}) {
  const ctx = await b.newContext({ viewport: vp, locale: 'fr-FR', timezoneId: 'Europe/Paris', colorScheme: opts.sombre ? 'dark' : 'light', ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.setFixedTime(new Date(T0));
  await pg.addInitScript(([sombre, achats]) => {
    try {
      localStorage.setItem('vrm_acces_direct', '1');
      localStorage.setItem('vinted_dark', sombre ? 'true' : 'false');
      // La bascule « Minéral » remet le sombre à zéro une fois : déjà faite ici.
      localStorage.setItem('vrm_bascule_mineral_v1', '1');
      if (achats) localStorage.setItem('vrm_achats_mois', JSON.stringify(achats));
    } catch (_) {}
  }, [!!opts.sombre, opts.achats === undefined ? { mois: '2026-10', depense: 31250, n: 12, complet: true, manque: [], at: T0 } : opts.achats]);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  // Les photos d'eBay : une image locale (aucun réseau), pour voir la mise en page vraie.
  await pg.route(/^https:\/\/i\.ebayimg\.com\//, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8/+F9PQAI4wN/1zv0OgAAAABJRU5ErkJggg==', 'base64') }));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(route.request().url());
    const j = (d, st) => route.fulfill({ status: st || 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return j({ m: 1 }, 400);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    if (/harvest_\*_orders_sold/.test(u) || /harvest_%_orders_sold/.test(u)) return j([{ id: 'harvest_111_orders_sold', data: VENTES }]);
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  // ⚠️ enregistré APRÈS le fourre-tout → Playwright le prend en PREMIER (§6.6).
  await pg.route('**/api/ebay**', async (route) => {
    const req = route.request();
    const j = (d, st) => route.fulfill({ status: st || 200, contentType: 'application/json', body: JSON.stringify(d) });
    if (req.method() !== 'POST') return j({ ok: true, ready: true, canConsent: true });
    let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch (_) {}
    envois.push(JSON.parse(JSON.stringify(body)));
    if (!/^veille/.test(body.action || '')) return j({ ok: true, connected: false, comptes: [] });
    if (!V || !V.actionVeille) return j({ ok: false, error: 'action inconnue' }, 400);
    const r = await V.actionVeille(body.action, body, OWNER, { maintenant: T0 });
    return j(r.body, r.status);
  });
  return { ctx, pg, errs };
}
const deborde = (pg) => pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
const photo = async (pg, sel, nom) => {
  try { await pg.locator(sel).first().evaluate((e) => e.scrollIntoView({ block: 'start' })); await pg.waitForTimeout(250); await pg.screenshot({ path: path.join(CAPTURES, nom + '.png') }); } catch (_) {}
};

// Une recherche déjà enregistrée et déjà vérifiée il y a 2 h (par la VRAIE route).
async function preparer() {
  srvBase = []; envois = []; ebayAppels = [];
  if (!V || !V.actionVeille) return null;
  const s = await V.actionVeille('veillesauver', { recherche: { marque: 'Adidas', noms: ['Spezial'], tailles: ['42'], etats: ['occasion'], prixMaxEuros: '60', lots: 'exclure', encheres: 'non' } }, OWNER, { maintenant: T0 - 3 * 3600000 });
  const id = s.body.recherche && s.body.recherche.id;
  await V.actionVeille('veilleverifier', { id }, OWNER, { maintenant: T0 - 2 * 3600000 });
  await V.actionVeille('veillereglages', { budgetEuros: '400' }, OWNER, { maintenant: T0 - 2 * 3600000 });
  ebayAppels = []; envois = [];
  return id;
}
const ouvrirVeille = async (pg) => {
  await pg.goto(`http://localhost:${PORT}/?tab=ebay_veille`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('[data-veille]:not([data-veille="chargement"])', { timeout: 20000 });
};

(async () => {
  let b;
  try {
    try { V = await import(pathToFileURL(path.join(RACINE, 'api', '_lib', 'veille.js')).href); } catch (e) { dit(false, 'la route de la veille existe (api/_lib/veille.js)', String(e.message).slice(0, 100)); }
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const sombre of [false, true]) {
      for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
        const nom = `${vp.width} px${sombre ? ' · sombre' : ''}`;
        console.log(`── ${nom}`);
        const rid = await preparer();
        const { ctx, pg, errs } = await ouvrir(b, vp, { sombre });
        await essaie('écran', async () => {
          await ouvrirVeille(pg);
          const etat = await pg.$eval('[data-veille]', (e) => e.getAttribute('data-veille'));
          dit(etat === 'lu', '`?tab=ebay_veille` ouvre eBay → Veille, lue', etat);
          const plat = await pg.$$eval('[data-veille-plateformes]', (els) => els.map((e) => e.textContent));
          dit(plat.length === 1 && /Vinted et Leboncoin non surveillés/.test(plat[0]) && /rien n'est acheté sans toi/.test(plat[0]), 'UNE phrase dit que Vinted et Leboncoin ne sont pas surveillés', plat.join(' | '));
          const carte = await pg.$eval(`[data-recherche="${rid}"]`, (e) => ({ v: e.getAttribute('data-verif'), t: e.textContent }));
          dit(carte.v === 'ok' && /Vérifiée il y a 2 h/.test(carte.t) && /écartées/.test(carte.t), 'la recherche dit sa fraîcheur et ce qui a été écarté', carte.t.slice(0, 160));
          dit(/eBay en a 2[\s ]?400/.test(carte.t), 'trop large : eBay en a plus que ce qui est regardé, et le geste est dit');
        });
        await essaie('annonces', async () => {
          const ids = await pg.$$eval('[data-annonce]', (els) => els.map((e) => e.getAttribute('data-annonce')).sort());
          dit(ids.join(',') === '110001,110005,110007,110008,110011', 'les 5 annonces que la route a retenues (pas le 42 2/3, ni le lot, ni le 64 €)', ids.join(','));
          const t5 = await pg.$eval('[data-annonce="110005"]', (e) => ({ c: e.getAttribute('data-total-confirme'), t: e.textContent }));
          dit(t5.c === '0' && /livraison inconnue — total non confirmé/.test(t5.t), 'livraison inconnue ⇒ « total non confirmé », aucun total inventé', t5.t.slice(0, 120));
          const t1 = await pg.$eval('[data-annonce="110001"]', (e) => e.textContent);
          dit(/45,00 € \+ 6,50 € livraison = 51,50 €/.test(t1) && /Pourquoi : « Spezial » · Adidas · pointure 42 · Occasion · ≤ 60,00 € livraison comprise/.test(t1), 'le total connu et le POURQUOI, en faits courts', t1.slice(0, 160));
          const dits = (t5.t.match(/livraison inconnue/g) || []).length;
          dit(dits === 1, '« livraison inconnue » n\'est dit qu\'UNE fois sur l\'annonce (§7)', String(dits));
          const sansPhoto = await pg.$eval('[data-annonce="110011"]', (e) => (e.textContent.match(/sans photo/g) || []).length);
          const avecPhoto = await pg.$eval('[data-annonce="110001"] img', (e) => e.naturalWidth > 0).catch(() => false);
          dit(sansPhoto === 1 && avecPhoto, 'la photo s\'affiche ; une annonce sans photo le dit UNE fois', `${sansPhoto} · ${avecPhoto}`);
          const t8 = await pg.$eval('[data-annonce="110008"]', (e) => e.textContent);
          dit(/Non vérifié : pointure en UK 8 : non comparée/.test(t8), 'ce qui n\'est pas vérifiable est dit (pointure UK)');
          const t7 = await pg.$eval('[data-annonce="110007"] [data-drapeau="plusieurs-pointures"]', (e) => e.textContent).catch(() => '');
          dit(/plusieurs pointures/.test(t7), 'deux pointures dans un titre sont signalées');
          const achat = await pg.$$eval('button, a', (els) => els.map((e) => e.textContent.trim()).filter((t) => /^(Acheter|Payer|Enchérir|Faire une offre)/i.test(t)));
          dit(achat.length === 0, 'aucun bouton d\'achat, de paiement, d\'enchère ou d\'offre', achat.join(','));
          const liens = await pg.$$eval('[data-lien-ebay]', (els) => els.map((e) => e.getAttribute('href')));
          dit(liens.length === 5 && liens.every((h) => /^https:\/\/www\.ebay\.fr\/itm\/\d+$/.test(h)), 'le seul geste vers eBay : « voir l\'annonce » (lien propre)');
          const brut = await pg.content();
          dit(!/pseudo_invente/.test(brut), 'le pseudo d\'un vendeur eBay n\'est ni gardé ni affiché');
          await photo(pg, '[data-veille]', `veille-${vp.width}${sombre ? '-sombre' : ''}`);
        });
        await essaie('rentabilité', async () => {
          await pg.click('[data-annonce="110001"] [data-ouvrir-renta]');
          await pg.waitForSelector('[data-annonce="110001"] [data-comparables="assez"]', { timeout: 8000 });
          const n = await pg.$eval('[data-annonce="110001"] [data-comparables]', (e) => ({ n: e.getAttribute('data-n'), t: e.textContent }));
          dit(n.n === '3' && /la plus récente il y a 12 j/.test(n.t), 'fourchette : SES 3 ventes de Spezial en 42 (pas la 43, pas la Dunk), avec leur ancienneté', n.t.slice(0, 160));
          await pg.click('[data-annonce="110001"] [data-scenario="moyenne"]');
          const ben = await pg.$eval('[data-annonce="110001"] [data-benefice]', (e) => e.getAttribute('data-benefice'));
          const manque = await pg.$eval('[data-annonce="110001"] [data-benefice-manque]', (e) => e.textContent).catch(() => '');
          dit(ben === '3850' && /remise en état, frais de vente/.test(manque), 'revente moyenne 90 € − 51,50 € ⇒ 38,50 €, et ce qui manque est NOMMÉ', `${ben} · ${manque}`);
          await pg.fill('[data-annonce="110001"] [data-renta-champ="marge"]', '30');
          const pm = await pg.$eval('[data-annonce="110001"] [data-prix-max]', (e) => ({ v: e.getAttribute('data-prix-max'), p: e.getAttribute('data-prix-max-porte') }));
          dit(pm.v === '5350' && pm.p === 'article', 'bénéfice voulu 30 € ⇒ prix d\'achat maximum 53,50 €', JSON.stringify(pm));
          await photo(pg, '[data-annonce="110001"] [data-rentabilite]', `veille-renta-${vp.width}${sombre ? '-sombre' : ''}`);
          // Livraison INCONNUE : le bénéfice la nomme, et le maximum porte sur le TOTAL.
          await pg.click('[data-annonce="110005"] [data-ouvrir-renta]');
          await pg.waitForSelector('[data-annonce="110005"] [data-comparables="assez"]', { timeout: 8000 });
          await pg.click('[data-annonce="110005"] [data-scenario="moyenne"]');
          await pg.fill('[data-annonce="110005"] [data-renta-champ="marge"]', '30');
          const r5 = await pg.$eval('[data-annonce="110005"]', (e) => ({ b: e.querySelector('[data-benefice]').getAttribute('data-benefice'), m: (e.querySelector('[data-benefice-manque]') || {}).textContent || '', p: e.querySelector('[data-prix-max]').getAttribute('data-prix-max-porte'), t: e.querySelector('[data-prix-max]').textContent }));
          dit(r5.b === '4000' && /^Sans livraison/.test(r5.m) && r5.p === 'total' && /Coût maximum, livraison comprise : 60,00 €/.test(r5.t),
            'livraison inconnue : « sans livraison » dit, et le maximum porte sur le coût TOTAL (60 €)', JSON.stringify(r5));
        });
        await essaie('refuser', async () => {
          await pg.click('[data-annonce="110011"] [data-decision="refuser"]');
          await pg.click('[data-annonce="110011"] [data-motif="trop-cher"]');
          await pg.waitForSelector('[data-groupe="refusee"]', { timeout: 8000 });
          const env = envois.filter((x) => x.action === 'veilledecision').pop() || {};
          dit(env.statut === 'refusee' && env.motif === 'trop-cher' && env.itemId === '110011', 'Refuser demande un motif, et c\'est lui qui part', JSON.stringify(env));
          const g = await pg.$eval('[data-groupe="refusee"]', (e) => e.textContent);
          const srvAnn = ((srvBase.find((x) => x.id === 'veille_resultats') || {}).data || {}).parRecherche;
          dit(/Refusées · 1/.test(g) && srvAnn && srvAnn[rid].annonces['110011'].statut === 'refusee', 'rangée dans « Refusées », chez lui');
        });
        await essaie('budget', async () => {
          await pg.click('[data-veille-budget] summary');
          const bud = await pg.$eval('[data-veille-budget]', (e) => ({ etat: e.getAttribute('data-veille-budget'), t: e.textContent, r: (e.querySelector('[data-budget-reste]') || {}).getAttribute ? e.querySelector('[data-budget-reste]').getAttribute('data-budget-reste') : null }));
          dit(bud.etat === 'lu' && bud.r === '8750' && /reste 87,50 €/.test(bud.t), 'budget 400 € − 312,50 € publiés par l\'écran Achats ⇒ reste 87,50 €', bud.t.slice(0, 140));
        });
        await essaie('tester', async () => {
          const avant = JSON.stringify(srvBase);
          await pg.click('[data-nouvelle]');
          await pg.fill('[data-champ="marque"]', 'Adidas');
          await pg.fill('[data-champ="modele"]', 'Samba');
          await pg.fill('[data-champ="tailles"]', '43');
          await pg.fill('[data-champ="prix"]', '60');
          await pg.click('[data-tester]');
          await pg.waitForSelector('[data-veille-simulation]', { timeout: 10000 });
          const s = await pg.$eval('[data-veille-simulation]', (e) => e.textContent);
          const apres = JSON.stringify(srvBase);
          const sansQuota = (x) => x.replace(/"quota":\{[^}]*\}/g, '').replace(/"rev":\d+/g, '');
          dit(/rien n'est enregistré, aucune alerte/.test(s) && /Samba OG 43/.test(s) && sansQuota(avant) === sansQuota(apres), 'Tester : des résultats, et RIEN n\'est rangé (hors le compteur du jour)', s.slice(0, 120));
          await photo(pg, '[data-veille-simulation]', `veille-tester-${vp.width}${sombre ? '-sombre' : ''}`);
          await pg.click('[data-veille-form] button:has-text("Annuler")');
        });
        await essaie('vérifier', async () => {
          ebayAppels = [];
          await pg.click(`[data-recherche="${rid}"] [data-verifier]`);
          await pg.waitForSelector('[data-veille-message]', { timeout: 10000 });
          const m = await pg.$eval('[data-veille-message]', (e) => e.textContent);
          dit(ebayAppels.some((u) => /\/buy\/browse\//.test(u)) && /rien de nouveau|nouvelle/.test(m), '« Vérifier » repasse chez eBay et dit ce qu\'il a trouvé', m);
          const q = await pg.$eval('[data-veille-quota]', (e) => e.getAttribute('data-veille-quota'));
          dit(Number(q) >= 2, 'le compteur du jour suit', q);
        });
        await essaie('mise en page', async () => {
          const d = await deborde(pg);
          dit(d.sw <= d.cw + 1, 'aucun débordement horizontal', `${d.sw} > ${d.cw}`);
          dit(errs.length === 0, 'aucune erreur de page', errs.join(' | ').slice(0, 160));
        });
        await ctx.close();
      }
    }
    // ── SES RECHERCHES ILLISIBLES : « pas su », jamais « aucune » ──────────────
    console.log('── base illisible (390 px)');
    {
      await preparer(); panneVeille = true;
      const { ctx, pg, errs } = await ouvrir(b, { width: 390, height: 844 });
      await essaie('pas su', async () => {
        await ouvrirVeille(pg);
        const etat = await pg.$eval('[data-veille]', (e) => e.getAttribute('data-veille'));
        const t = await pg.$eval('[data-veille]', (e) => e.textContent);
        dit(etat === 'panne' && /pas pu lire ta veille/.test(t) && !/Aucune recherche/.test(t), 'lecture ratée ⇒ « je n\'ai pas pu lire ta veille », jamais « aucune recherche »', etat);
        dit(errs.length === 0, 'aucune erreur de page', errs.join(' | ').slice(0, 160));
      });
      panneVeille = false;
      await ctx.close();
    }
    // ── AUCUNE RECHERCHE, BUDGET JAMAIS PUBLIÉ ─────────────────────────────────
    console.log('── première visite (1512 px)');
    {
      srvBase = []; envois = [];
      const { ctx, pg, errs } = await ouvrir(b, { width: 1512, height: 950 }, { achats: null });
      await essaie('vide', async () => {
        await ouvrirVeille(pg);
        dit(await pg.$('[data-veille-vide]') != null, 'aucune recherche : l\'écran le dit et propose d\'en créer une');
        await pg.click('[data-veille-budget] summary');
        const e = await pg.$eval('[data-veille-budget]', (x) => x.getAttribute('data-veille-budget'));
        dit(e === 'sans-budget', 'pas de budget : aucun « reste » inventé', e);
        dit(errs.length === 0, 'aucune erreur de page', errs.join(' | ').slice(0, 160));
      });
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ eBay → Veille d'achat : ${ko} rouge(s)` : '\n✅ eBay → Veille d\'achat : ce qui correspond, pourquoi, ce qui n\'est pas vérifiable — et rien n\'est jamais acheté');
  process.exit(ko ? 1 : 0);
})();
