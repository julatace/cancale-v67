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
//   · aucun débordement horizontal, aucune erreur de page ;
//   · la relecture du 15 octobre, rendue : « Pourquoi » dit UNE fois (pas la
//     recherche recopiée sur chaque carte), aucune pastille répétée (vérifiée il
//     y a 8 h, vérification ratée), « 42,5 » et « 60 € » au clavier, le nom suit
//     « Modifier », « Je l'ai achetée » entre dans le budget, une note n'est pas
//     « Remise », un prix qui monte met la carte et le budget à jour, un modèle
//     hors liste (2002R) a sa fourchette, le geste « resserrer » ne propose jamais
//     la pointure, et les 7 onglets d'eBay tiennent sur UNE rangée à 390 px.
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
// Ce que le faux eBay rend AUJOURD'HUI : `ebayVoit` transforme la liste (prix
// qui monte, annonces qui ne reviennent pas), `ebayPanne` le fait répondre 503.
let ebayVoit = null, ebayPanne = false;
const rep = (corps, status = 200) => new Response(typeof corps === 'string' ? corps : JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } });
const fetchServeur = async (url, opts = {}) => {
  const u = String(url); const m = (opts.method || 'GET').toUpperCase();
  if (u.includes('ebay.com')) {
    ebayAppels.push(u);
    if (u.includes('/oauth2/token')) return rep({ access_token: 'jeton-application', expires_in: 7200 });
    if (u.includes('/buy/browse/v1/item_summary/search')) {
      if (ebayPanne) return new Response('<html>503</html>', { status: 503 });
      const q = decodeURIComponent((/[?&]q=([^&]*)/.exec(u) || [])[1] || '');
      const items = /samba/i.test(q) ? [item(120001, 'Adidas Samba OG 43 blanc', '48.00', '5.00', '3000')] : (ebayVoit ? ebayVoit(ITEMS()) : ITEMS());
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
  // Un modèle HORS de la liste des modèles connus de l'app (2002R) : sa
  // fourchette vient du nom tapé. Le lot (« x2 ») n'en est pas.
  vente(11, 'New balance 2002R protection pack gris taille 42', 95, 10), vente(12, 'New balance 2002R noir taille 42', 105, 20),
  vente(13, 'New balance 2002R gris taille 42', 110, 40), vente(14, 'Lot New balance 2002R x2 taille 42', 180, 4),
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
    // `BANC_RAPIDE=1` : une seule vue (390 px, clair) — pour les mutations.
    const RAPIDE = process.env.BANC_RAPIDE === '1';
    for (const sombre of (RAPIDE ? [false] : [false, true])) {
      for (const vp of (RAPIDE ? [{ width: 390, height: 844 }] : [{ width: 390, height: 844 }, { width: 1512, height: 950 }])) {
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
          const large = await pg.$eval(`[data-recherche="${rid}"] [data-trop-large]`, (e) => e.textContent).catch(() => '');
          dit(/eBay en a 2[\s ]?400/.test(large) && /précise le modèle/.test(large) && !/pointure/.test(large), 'trop large : eBay en a plus que ce qui est regardé, et le geste est dit — jamais « la pointure » (elle n\'est pas envoyée à eBay)', large);
          // Les 7 onglets d'eBay : UNE rangée sur téléphone (« Compte » ne tombe
          // plus seul dessous), aucun libellé coupé, l'onglet ouvert visible.
          if (vp.width < 600) {
            const nav = await pg.evaluate(() => {
              const n = document.querySelector('nav[aria-label="Sections de la plateforme"]'); if (!n) return null;
              const rn = n.getBoundingClientRect();
              const bs = [...n.querySelectorAll('button')].map((b) => { const r = b.getBoundingClientRect(); const sp = b.querySelector('span:last-child') || b; return { t: b.textContent.trim(), y: Math.round(r.top), g: r.left, d: r.right, on: b.getAttribute('aria-current') === 'page', coupe: sp.scrollWidth > sp.clientWidth + 1 }; });
              return { lignes: new Set(bs.map((b) => b.y)).size, n: bs.length, coupes: bs.filter((b) => b.coupe).map((b) => b.t), actif: bs.find((b) => b.on), g: rn.left, d: rn.right, page: document.documentElement.scrollWidth - document.documentElement.clientWidth };
            });
            dit(nav && nav.n === 7 && nav.lignes === 1 && !nav.coupes.length && nav.actif && nav.actif.t === 'Veille' && nav.actif.g >= nav.g - 1 && nav.actif.d <= nav.d + 1 && nav.page <= 1,
              'les 7 onglets d\'eBay sur UNE rangée à ' + vp.width + ' px, aucun libellé coupé, « Veille » ouvert et visible', JSON.stringify(nav && { lignes: nav.lignes, coupes: nav.coupes, actif: nav.actif && nav.actif.t, page: nav.page }));
          }
        });
        await essaie('annonces', async () => {
          const ids = await pg.$$eval('[data-annonce]', (els) => els.map((e) => e.getAttribute('data-annonce')).sort());
          dit(ids.join(',') === '110001,110005,110007,110008,110011', 'les 5 annonces que la route a retenues (pas le 42 2/3, ni le lot, ni le 64 €)', ids.join(','));
          const t5 = await pg.$eval('[data-annonce="110005"]', (e) => ({ c: e.getAttribute('data-total-confirme'), t: e.textContent }));
          dit(t5.c === '0' && /livraison inconnue — total non confirmé/.test(t5.t), 'livraison inconnue ⇒ « total non confirmé », aucun total inventé', t5.t.slice(0, 120));
          const t1 = await pg.$eval('[data-annonce="110001"]', (e) => e.textContent);
          const pq = await pg.$$eval(`[data-recherche="${rid}"] [data-pourquoi]`, (els) => els.map((e) => e.textContent));
          const commun = await pg.$$eval(`[data-recherche="${rid}"] [data-pourquoi-commun]`, (els) => els.map((e) => e.textContent));
          dit(/45,00 € \+ 6,50 € livraison = 51,50 €/.test(t1) && commun.length === 1 && /correspondent à la recherche, sauf ce qui est dit sur l'annonce/.test(commun[0]) && pq.length === 0,
            'le total connu ; le POURQUOI dit UNE fois pour la liste — pas la recherche recopiée sur chaque carte (§7)', `${commun.length} ligne(s) commune(s), ${pq.length} « Pourquoi » de carte`);
          const dits = (t5.t.match(/livraison inconnue/g) || []).length;
          dit(dits === 1, '« livraison inconnue » n\'est dit qu\'UNE fois sur l\'annonce (§7)', String(dits));
          const sansPhoto = await pg.$eval('[data-annonce="110011"]', (e) => (e.textContent.match(/sans photo/g) || []).length);
          await pg.locator('[data-annonce="110001"] img').scrollIntoViewIfNeeded().catch(() => {});
          const avecPhoto = await pg.waitForFunction(() => { const i = document.querySelector('[data-annonce="110001"] img'); return !!(i && i.complete && i.naturalWidth > 0); }, null, { timeout: 8000 }).then(() => true).catch(() => false);
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
          dit(ben === '3850' && /remise en état et frais de vente/.test(manque), 'revente moyenne 90 € − 51,50 € ⇒ 38,50 €, et ce qui manque est NOMMÉ', `${ben} · ${manque}`);
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
    // ── LA RELECTURE DU 15 OCTOBRE, RENDUE ────────────────────────────────────
    // Chaque bloc part d'un état préparé par la VRAIE route ; la page ne fait
    // que montrer ce qu'elle a rangé.
    console.log('── relecture : saisie au clavier, rentabilité libre (390 px)');
    {
      await preparer();
      const { ctx, pg, errs } = await ouvrir(b, { width: 390, height: 844 });
      await essaie('saisie', async () => {
        await ouvrirVeille(pg);
        await pg.click('[data-nouvelle]');
        await pg.fill('[data-champ="marque"]', 'Adidas');
        await pg.fill('[data-champ="modele"]', 'Spezial');
        await pg.fill('[data-champ="tailles"]', '42,5');
        await pg.fill('[data-champ="prix"]', '60 €');
        await pg.click('[data-tester]');
        await pg.waitForSelector('[data-veille-simulation], [data-veille-erreur]', { timeout: 10000 });
        const err = await pg.$eval('[data-veille-erreur]', (e) => e.textContent).catch(() => '');
        const env = envois.filter((x) => x.action === 'veilletester').pop() || {};
        dit(!err && (await pg.$('[data-veille-simulation]')) && JSON.stringify(env.recherche && env.recherche.tailles) === '["42,5"]',
          '« 42,5 » (pointure) et « 60 € » tapés au clavier : la simulation part, la pointure n\'est pas coupée en « 42 » et « 5 »', err || JSON.stringify(env.recherche && env.recherche.tailles));
        await pg.click('[data-veille-form] button:has-text("Annuler")');
      });
      await essaie('rentabilité libre', async () => {
        await pg.click('details:has(summary:text("Rentabilité avant achat")) summary');
        const L = '[data-rentabilite="libre"]';
        await pg.fill(`${L} [data-renta-champ="revente"]`, '100');
        await pg.fill(`${L} [data-renta-champ="marge"]`, '20');
        const t = await pg.$eval(L, (e) => e.innerText);
        const manque = await pg.$eval(`${L} [data-benefice-manque]`, (e) => e.getAttribute('data-manquants')).catch(() => '');
        dit(/Coût maximum, livraison comprise : 80,00 €/.test(t) && manque === 'remise en état,frais de vente' && !/—\s*—/.test(t),
          'un prix maximum dit les coûts NON comptés (remise en état, frais de vente) ; jamais « — — »', `${manque} · ${t.split('\n').filter((x) => /Bénéfice|maximum|Sans/.test(x)).join(' / ')}`);
        await pg.fill(`${L} [data-renta-champ="achat"]`, '45 €');
        const ben = await pg.$eval(`${L} [data-benefice]`, (e) => e.getAttribute('data-benefice'));
        dit(ben === '5500', '« 45 € » tapé avec son symbole est lu : bénéfice 100 − 45 = 55 €', ben);
        await pg.fill(`${L} [data-renta-champ="achat"]`, '45 €€');
        const ill = await pg.$eval(`${L} [data-renta-illisible]`, (e) => e.getAttribute('data-renta-illisible')).catch(() => '');
        const b2 = await pg.$eval(`${L} [data-benefice]`, (e) => e.textContent);
        dit(ill === 'achat' && /prix d'achat illisible/.test(b2), 'un montant illisible est DIT (jamais lu comme « pas saisi »)', `${ill} · ${b2}`);
        await pg.fill(`${L} [data-renta-champ="libre"]`, 'New Balance 2002R 42');
        const c = await pg.$eval(`${L} [data-comparables]`, (e) => ({ etat: e.getAttribute('data-comparables'), n: e.getAttribute('data-n'), cle: e.getAttribute('data-cle'), t: e.textContent }));
        dit(c.etat === 'assez' && c.n === '3' && c.cle === 'nom' && /New Balance 2002R en 42/.test(c.t), 'un modèle hors de la liste connue (2002R) : SES 3 ventes en 42 (le lot écarté), avec leur source', JSON.stringify(c));
        await photo(pg, L, 'veille-renta-libre-390');
        dit(errs.length === 0, 'aucune erreur de page', errs.join(' | ').slice(0, 160));
      });
      await ctx.close();
    }
    console.log('── relecture : modifier, budget, note, prix qui monte (1512 px)');
    {
      const rid = await preparer();
      const { ctx, pg, errs } = await ouvrir(b, { width: 1512, height: 950 });
      await essaie('budget', async () => {
        await ouvrirVeille(pg);
        await pg.click('[data-annonce="110001"] [data-decision="a-examiner"]');
        await pg.waitForSelector('[data-groupe="a-examiner"]', { timeout: 8000 });
        await pg.click('[data-groupe="a-examiner"]');
        await pg.click('[data-annonce="110001"] [data-decision="achetee"]');
        await pg.waitForSelector('[data-groupe="achetee"]', { timeout: 8000 });
        await pg.click('[data-veille-budget] summary');
        const bud = await pg.$eval('[data-veille-budget]', (e) => ({ r: (e.querySelector('[data-budget-reste]') || { getAttribute: () => null }).getAttribute('data-budget-reste'), v: (e.querySelector('[data-budget-reste]') || { getAttribute: () => null }).getAttribute('data-budget-veille'), t: e.innerText }));
        dit(bud.r === String(40000 - 31250 - 5150) && bud.v === '5150' && /reste 36,00 €/.test(bud.t) && /1 achat marqué dans la veille/.test(bud.t),
          '« Je l\'ai achetée » : la dépense (51,50 €) entre dans le budget — reste 87,50 → 36,00 €', bud.t.split('\n').slice(0, 2).join(' / '));
      });
      await essaie('note', async () => {
        await pg.click('[data-groupe="nouvelle"]');
        await pg.click('[data-annonce="110005"] [data-decision="note"]');
        await pg.fill('[data-annonce="110005"] [data-note-champ]', 'demander la boîte');
        await pg.click('[data-annonce="110005"] button:has-text("OK")');
        await pg.waitForSelector('[data-annonce="110005"] [data-note]', { timeout: 8000 });
        await ouvrirVeille(pg);
        await pg.click('[data-veille-historique] summary');
        const h = await pg.$$eval('[data-veille-historique] li', (els) => els.map((e) => ({ k: e.getAttribute('data-histo'), t: e.textContent })));
        const n = h.find((x) => /marron/.test(x.t));
        dit(n && n.k === 'note' && /· Note ·/.test(n.t) && !/Remise/.test(n.t), 'une note privée est « Note » dans l\'historique — jamais « Remise »', JSON.stringify(n));
      });
      await essaie('modifier', async () => {
        await pg.click(`[data-recherche="${rid}"] summary`);
        await pg.click(`[data-recherche="${rid}"] [data-modifier]`);
        await pg.fill('[data-champ="modele"]', 'Samba');
        await pg.fill('[data-champ="tailles"]', '44');
        await pg.click('[data-enregistrer]');
        await pg.waitForFunction(() => !document.querySelector('[data-veille-form]'), null, { timeout: 8000 });
        const h3 = await pg.$eval(`[data-recherche="${rid}"] h3`, (e) => e.textContent);
        const conf = (srvBase.find((x) => x.id === 'veille_recherches') || {}).data;
        dit(h3 === 'Adidas Samba 44' && conf.recherches[0].nom === 'Adidas Samba 44', 'modifiée en Samba 44 : la carte (et l\'alerte du matin) la nomment « Adidas Samba 44 »', `${h3} · rangé « ${conf.recherches[0].nom} »`);
        dit(errs.length === 0, 'aucune erreur de page', errs.join(' | ').slice(0, 160));
      });
      await ctx.close();
    }
    {
      const rid = await preparer();
      await V.actionVeille('veilledecision', { id: rid, itemId: '110001', statut: 'a-examiner' }, OWNER, { maintenant: T0 - 90 * 60000 });
      // eBay rend maintenant 110001 à 70 € (+ 6,50 € de livraison).
      ebayVoit = (l) => l.map((it) => (it.legacyItemId === '110001' ? { ...it, price: { value: '70.00', currency: 'EUR' } } : it));
      await V.actionVeille('veilleverifier', { id: rid }, OWNER, { maintenant: T0 - 60000 });
      ebayVoit = null;
      const { ctx, pg } = await ouvrir(b, { width: 390, height: 844 });
      await essaie('prix qui monte', async () => {
        await ouvrirVeille(pg);
        await pg.click('[data-groupe="a-examiner"]');
        const t = await pg.$eval('[data-annonce="110001"]', (e) => ({ p: e.querySelector('[data-prix]').textContent, h: (e.querySelector('[data-hors-criteres]') || {}).textContent || '', pr: !!e.querySelector('[data-drapeau="pas-revue"]'), all: e.textContent }));
        await pg.click('[data-veille-budget] summary');
        const prevu = await pg.$eval('[data-budget-prevu]', (e) => e.getAttribute('data-budget-prevu')).catch(() => '');
        dit(/70,00 € \+ 6,50 € livraison = 76,50 €/.test(t.p) && /Ne correspond plus à ta recherche : article à 70,00 €/.test(t.h) && !t.pr && !/≤ 60,00 €/.test(t.all) && prevu === '7650',
          '« à examiner » dont le prix a monté : le prix d\'AUJOURD\'HUI, la raison, le budget prévu à 76,50 € — jamais l\'ancien prix ni « ≤ 60 € »', `${t.p} · ${t.h} · prévu ${prevu}`);
        await photo(pg, '[data-annonce="110001"]', 'veille-prix-monte-390');
      });
      await ctx.close();
    }
    console.log('── relecture : pastilles (390 px)');
    {
      srvBase = []; envois = []; ebayAppels = [];
      const s0 = await V.actionVeille('veillesauver', { recherche: { marque: 'Adidas', noms: ['Spezial'], tailles: ['42'], etats: ['occasion'], prixMaxEuros: '60' } }, OWNER, { maintenant: T0 - 9 * 3600000 });
      const rid = s0.body.recherche && s0.body.recherche.id;
      await V.actionVeille('veilleverifier', { id: rid }, OWNER, { maintenant: T0 - 8 * 3600000 });
      const pastilles = async (quoi) => {
        const { ctx, pg } = await ouvrir(b, { width: 390, height: 844 });
        await ouvrirVeille(pg);
        const r = await pg.$eval(`[data-recherche="${rid}"]`, (e) => ({ pr: e.querySelectorAll('[data-drapeau="pas-revue"]').length, anc: e.querySelectorAll('[data-drapeau="ancien"]').length, n: e.querySelectorAll('[data-annonce]').length, entete: e.querySelectorAll('[data-pas-revues]').length, f: (e.querySelector('[data-fraicheur]') || {}).textContent || '' }));
        if (quoi) await pg.locator(`[data-recherche="${rid}"]`).screenshot({ path: path.join(CAPTURES, `veille-pastilles-${quoi}-390.png`) }).catch(() => {});
        await ctx.close();
        return r;
      };
      await essaie('pastilles', async () => {
        const a = await pastilles('8h');
        dit(a.n === 5 && a.pr === 0 && a.anc === 0 && /Vérifiée il y a 8 h/.test(a.f), 'vérifiée il y a 8 h : l\'âge est dit UNE fois (sur la ligne de la recherche), aucune pastille répétée sur les 5 annonces', JSON.stringify(a));
        ebayPanne = true;
        await V.actionVeille('veilleverifier', { id: rid }, OWNER, { maintenant: T0 - 20 * 60000 });
        ebayPanne = false;
        const e = await pastilles('echec');
        dit(e.n === 5 && e.pr === 0 && e.entete === 0 && /Dernière vérification ratée/.test(e.f) && !/\.\./.test(e.f) && /Dernière réussie il y a 8 h/.test(e.f),
          'eBay n\'a pas répondu : aucune annonce n\'est dite « pas revue » (c\'est eBay qui a raté), et pas de « .. »', JSON.stringify(e));
        // Une lecture réussie où 110005 n'est pas revenue : la pastille sur ELLE seule.
        ebayVoit = (l) => l.filter((it) => it.legacyItemId !== '110005');
        await V.actionVeille('veilleverifier', { id: rid }, OWNER, { maintenant: T0 - 10 * 60000 });
        const m = await pastilles('mixte');
        dit(m.pr === 1 && m.entete === 0, 'une seule annonce pas revenue : la pastille est sur elle seule', JSON.stringify(m));
        // Aucune n'est revenue : UNE phrase au-dessus de la liste, aucune pastille.
        ebayVoit = () => [];
        await V.actionVeille('veilleverifier', { id: rid }, OWNER, { maintenant: T0 });
        ebayVoit = null;
        const z = await pastilles('aucune');
        dit(z.n >= 2 && z.pr === 0 && z.entete === 1, 'aucune n\'est revenue : dit UNE fois au-dessus de la liste, pas sur chaque carte (§7)', JSON.stringify(z));
      });
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
