// ═══════════════════════════════════════════════════════════════════════════
//  BANC : « 0 € AUJOURD'HUI » ALORS QU'UNE VENTE EST FAITE (6 nov., onglets A)
//  npm run build && BANC_PORT=10501 node scripts/bancs/vendu-aujourdhui-relu.cjs
// ═══════════════════════════════════════════════════════════════════════════
// Julien (6 nov.) : une vente faite à 08 h 49, rangée dans `harvest_{uid}_orders_sold`
// (ligne RÉÉCRITE à 10 h 22 par l'extension, pendant que VRM était ouvert sur un autre
// appareil), apparaissait dans la liste de Ventes ; Ma journée disait « 0 € aujourd'hui ».
// La coque — propriétaire du « vendu » de toute l'app (`liveStats`) — ne relisait ses
// ventes que sur un signal de l'extension, qui n'arrive que dans SON navigateur.
//
// Données INVENTÉES, à la forme mesurée sur sa base (la liste des ventes en tête, la
// vente du jour au statut « Bordereau envoyé au vendeur » / `needs_action`, prix objet,
// `capturedAt` lu en `meta->>capturedAt`). L'horloge de la page est tenue (aucun délai
// réel attendu) : on RÉÉCRIT la ligne, puis on avance l'horloge d'une minute et quart.
// Jugé (attributs, jamais un libellé, §6.4) :
//   1. avant la réécriture : « vendu aujourd'hui » = 0 (`data-fu-vendu-jour`), aucun
//      point sous aujourd'hui ;
//   2. après : 50 € (5000 centimes), sans recharger, et le point du jour dit 1 vente ;
//   3. la MÊME valeur dans la carte de Ventes (« vendu » du mois +50 €) — un nombre ;
//   4. aucune erreur de page.
// Sur l'arbre d'avant : 2 et 3 sont rouges (la coque ne relit rien).
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs'), http = require('http');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const { servir } = require('./_minipgrest.cjs');
const DIST = process.env.DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 10501;
const CAPT = process.env.CAPTURES || '';

const MAINTENANT = new Date('2026-11-06T11:10:00+01:00');
const UID = '3150001111';
const ACCOUNTS = [{ id: 1, vinted_user_id: UID, login: 'atelier_banc', domain: 'www.vinted.fr', updated_at: MAINTENANT.toISOString(), created_at: '2026-07-01T10:00:00Z' }];
const vente = (tx, titre, prix, status, tus, date) => ({ transaction_id: tx, conversation_id: String(tx + 1), title: titre, price: { amount: prix, currency_code: 'EUR' }, status, transaction_user_status: tus, date, photo: null });
const ANCIENNES = [
  vente(9000000002, 'Paire banc B taille 41', '64.00', 'Commande expédiée et en cours d\'acheminement ! ', 'waiting', '2026-11-04T19:22:01Z'),
  vente(9000000001, 'Paire banc A taille 40', '58.50', 'Commande finalisée - l\'acheteur a validé la commande', 'completed', '2026-11-02T09:00:00Z'),
];
const DU_JOUR = vente(9000000003, 'Paire banc C taille 38,5', '50.00', 'Bordereau envoyé au vendeur', 'needs_action', '2026-11-06T07:49:05Z');
const ligneVentes = (orders, cap) => ({ id: `harvest_${UID}_orders_sold`, data: { uid: UID, type: 'orders', domain: 'www.vinted.fr', nItems: orders.length, capturedAt: cap, payload: { my_orders: orders, pagination: { total_entries: orders.length } } } });
const base = {
  rows: [
    ligneVentes(ANCIENNES, '2026-11-05T14:11:36.974Z'),
    { id: `harvest_${UID}_orders_purchased`, data: { capturedAt: '2026-11-05T14:11:36.974Z', payload: { my_orders: [] } } },
    { id: `harvest_${UID}_listings`, data: { capturedAt: '2026-11-06T09:00:00Z', payload: { items: [], pagination: { total_entries: 0 } } } },
    { id: 'main', data: { vinted_accounts: ACCOUNTS } },
  ],
};
const reecrire = () => { base.rows[0] = ligneVentes([DU_JOUR, ...ANCIENNES], '2026-11-06T10:22:03.441Z'); };

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ port ' + PORT + ' pris (' + e.code + ') — BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const ctx = await b.newContext({ viewport: { width: 1512, height: 982 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: MAINTENANT });
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', 'true'); } catch (_) {} });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    if (/\/rest\/v1\/|\/auth\/v1\//.test(r.request().url())) return r.fallback();
    return ['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{}' });
  });
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const send = (body, h = {}) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', ...h }, body: JSON.stringify(body) });
    if (req.method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    const u = decodeURIComponent(req.url());
    if (/select=owner(&|$)/.test(u) && !/select=owner,/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', body: '{"message":"x"}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return send(ACCOUNTS);
    if (/\/rest\/v1\/app_data/.test(u)) { const { body, range } = servir(base.rows, metaVersData(req.url()).replace(/%3E/gi, '>'), req.headers()); return send(body, { 'content-range': range }); }
    return send([]);
  });
  await pg.route(/localhost:\d+\/api\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));

  const lire = () => pg.evaluate(() => {
    const v = document.querySelector('[data-fu-vendu-jour]');
    const auj = document.querySelector('.vrm-fu-jour[data-auj]');
    return { jour: v ? v.getAttribute('data-fu-vendu-jour') : null, point: auj ? auj.getAttribute('data-vendu') : null };
  });
  const attendre = async (pred, ms) => { const t0 = Date.now(); let x = await lire(); while (!pred(x) && Date.now() - t0 < ms) { await new Promise((r) => setTimeout(r, 400)); x = await lire(); } return x; };

  await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
  const avant = await attendre((x) => x.jour !== null && x.jour !== '' && x.point != null, 45000);
  dit(avant.jour === '0' && avant.point === '0', '1. avant la réécriture : vendu aujourd’hui = 0, aucun point sous aujourd’hui', JSON.stringify(avant));

  reecrire();
  // La sonde de la coque tourne à la minute, au rythme commun : on avance l'horloge tenue.
  await pg.clock.runFor(75000);
  const apres = await attendre((x) => x.jour === '5000', 15000);
  dit(apres.jour === '5000', '2. ligne réécrite pendant que l’app est ouverte : « vendu aujourd’hui » = 50 € sans recharger', JSON.stringify(apres));
  dit(apres.point === '1', '2b. le point d’aujourd’hui dit 1 vente (la même règle)', JSON.stringify(apres));
  if (CAPT) { fs.mkdirSync(CAPT, { recursive: true }); await pg.screenshot({ path: path.join(CAPT, 'vendu-aujourdhui-journee.png') }); }

  // 3. La carte de Ventes (même page, sans recharger) : « vendu » du mois = 58,50 + 64 + 50.
  await pg.evaluate(() => { const a = [...document.querySelectorAll('a,button')].find((x) => /^\s*Ventes\s*$/.test(x.textContent || '')); if (a) a.click(); });
  const carte = await (async () => { const t0 = Date.now(); for (;;) { const v = await pg.evaluate(() => { const e = document.querySelector('[data-carte-stats="ventes-toutes"] [data-carte-chiffre="vendu"]'); return e ? e.getAttribute('data-carte-valeur') : null; }); if (v || Date.now() - t0 > 20000) return v; await new Promise((r) => setTimeout(r, 400)); } })();
  dit(carte === '17250', '3. la carte de Ventes dit le même vendu (172,50 € dont la vente du jour)', String(carte));
  if (CAPT) await pg.screenshot({ path: path.join(CAPT, 'vendu-aujourdhui-ventes.png') });
  dit(errs.length === 0, '4. aucune erreur de page', errs.slice(0, 3).join(' | '));
  await b.close(); srv.close();
  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ banc', e.message); srv.close(); process.exit(1); });
