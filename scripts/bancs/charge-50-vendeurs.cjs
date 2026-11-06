require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « 50 VENDEURS EN MÊME TEMPS » (6 novembre, charge)
//
//  Julien : « l'appli bug, je suis tout seul… donc imagine avec beaucoup de
//  clients en simultané ». Ce banc fait ouvrir l'app à N vendeurs (défaut 50,
//  par vagues de BANC_PARALLELE pages ouvertes en même temps, défaut 10) sur
//  UNE fausse base (`_minipgrest`) qui applique la règle de la vraie
//  (RLS : chacun ne voit que ses lignes, d'après le `sub` de son jeton). Chaque
//  vendeur navigue 2 minutes (horloge de Playwright) : Ma journée → Ventes →
//  Colis → Messages. Données INVENTÉES (dépôt public).
//
//  Ce qu'il EXIGE :
//    1. chaque vendeur ne reçoit QUE ses lignes (jamais celles d'un autre) ;
//    2. ce qu'un vendeur demande ne dépend PAS du nombre de vendeurs : ses
//       requêtes et les lignes qu'on lui rend sont les mêmes seul (N=1) ou au
//       milieu de 50 (écart ≤ 20 %) ;
//    3. aucune requête d'un vendeur ne rend O(N) lignes (au plus ses propres
//       lignes) ;
//    4. aucune erreur d'app.
//  Le côté serveur (200 notifications eBay sur la vraie route, 200 vendeurs
//  eBay en base) est dans `scripts/audit-ebay-suppression.cjs` §7.
//  Lancer : node scripts/bancs/charge-50-vendeurs.cjs  (BANC_PORT, défaut 9853 ;
//  BANC_N, BANC_PARALLELE)
// ════════════════════════════════════════════════════════════════════════════
const http = require('http'), fs = require('fs'), path = require('path');
const { servir } = require('./_minipgrest.cjs');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }

const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 9853;
const N = Number(process.env.BANC_N) || 50;
const PARALLELE = Number(process.env.BANC_PARALLELE) || 10;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.onnx': 'application/octet-stream' };
const ECRANS = ['journee', 'ventes', 'cat_bord', 'messages'];

const iso = (ms) => new Date(ms).toISOString();
const meta = (data) => { const m = {}; for (const [k, v] of Object.entries(data || {})) if (v == null || typeof v !== 'object') { if (String(v).length <= 600) m[k] = v; } return m; };
const uidDe = (i) => `${String(i + 1).padStart(8, '0')}-2222-4333-8444-555555555555`;
const jeton = (uid) => { const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url'); return b({ alg: 'HS256' }) + '.' + b({ sub: uid, aal: 'aal1', role: 'authenticated' }) + '.sig'; };
const vente = (n) => ({ transaction_id: 70000 + n, item_id: 80000 + n, title: `Paire inventée ${n}`, status: n % 4 ? 'Commande finalisée' : 'Le paiement a été validé', transaction_user_status: n % 3 ? 'completed' : 'needs_action',
  price: { amount: String(40 + n), currency_code: 'EUR' }, date: iso(Date.now() - n * 864e5), user: { login: 'acheteur' + n } });

// La base : les lignes de TOUS les vendeurs, dans la même table.
const BASE = [];
const COMPTES = {};
function peupler(n) {
  BASE.length = 0;
  for (let i = 0; i < n; i++) {
    const uid = uidDe(i), vu = String(900000000 + i);
    COMPTES[uid] = [{ vinted_user_id: vu, login: 'compte-banc-' + i, owner: uid, access_token: 'x', refresh_token: 'x', csrf_token: 'x', updated_at: iso(Date.now()), created_at: iso(Date.now()) }];
    const l = (id, data) => BASE.push({ id, owner: uid, data, meta: meta(data), updated_at: iso(Date.now()) });
    l('main', { vinted_room: [], vinted_entries: [] });
    l(`harvest_${vu}_orders_sold`, { capturedAt: iso(Date.now() - 60e3), payload: { my_orders: Array.from({ length: 10 }, (_, k) => vente(k)) } });
    l(`harvest_${vu}_orders_purchased`, { capturedAt: iso(Date.now() - 60e3), payload: { my_orders: [] } });
    l(`harvest_${vu}_inbox`, { capturedAt: iso(Date.now() - 60e3), payload: { conversations: Array.from({ length: 4 }, (_, k) => ({ id: 60000 + k, description: 'Toujours dispo ?', unread: k < 1, updated_at: iso(Date.now() - k * 3600e3), opposite_user: { login: 'acheteur' + k } })) } });
    l('email_track_mondial_relay_MR' + String(100000 + i), { status: 'available', statusLabel: 'Arrivé au point de retrait', code: String(1000 + i), lieu: 'Relais inventé', carrier: 'mondial_relay', suivi: 'MR' + String(100000 + i), receivedAt: iso(Date.now() - 3600e3) });
  }
}
const lignesDe = (uid) => BASE.filter((r) => r.owner === uid);

const srv = http.createServer((q, r) => {
  let f = decodeURIComponent(q.url.split('?')[0]); if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!p.startsWith(DIST) || !fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});

let ko = 0;
const dit = (bon, quoi, detail) => { if (!bon) ko++; console.log(`  ${bon ? '✅' : '❌'} ${quoi}${detail ? ' — ' + detail : ''}`); };
const subDe = (h) => { try { const t = String(h.authorization || '').replace(/^Bearer /, ''); return JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString()).sub || ''; } catch (_) { return ''; } };

async function unVendeur(nav, i, stats) {
  const uid = uidDe(i), JET = jeton(uid);
  const s = stats[uid] = { requetes: 0, lignes: 0, maxLignes: 0, etrangeres: 0, erreurs: [] };
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 860 } });
  const json = (route, d, extra) => route.fulfill({ status: 200, contentType: 'application/json', headers: Object.assign({ 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range' }, extra || {}), body: JSON.stringify(d) });
  await ctx.route(/supabase\.co\//, async (route) => {
    const req = route.request(); const u = req.url(); const h = req.headers(); const m = req.method();
    if (m === 'OPTIONS') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    s.requetes++;
    if (/\/auth\/v1\//.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ access_token: JET, refresh_token: 'r', expires_in: 86400, user: { id: uid, email: `v${i}@exemple.fr` } }) });
    const sub = subDe(h);
    if (/select=owner/.test(u) && !/rpc/.test(u)) return json(route, []);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return json(route, COMPTES[sub] || []);
    if (/\/rest\/v1\/rpc\//.test(u)) return json(route, null);
    if (!/\/rest\/v1\/app_data/.test(u)) return json(route, [], { 'content-range': '*/0' });
    // La RLS : seules les lignes du `sub` du jeton existent pour cette requête.
    const visibles = lignesDe(sub);
    if (m === 'PATCH') {
      const x = new URL(u); x.searchParams.set('select', 'id');
      const vises = new Set(servir(visibles, x.toString(), {}).body.map((r) => r.id));
      let corps = {}; try { corps = JSON.parse(req.postData() || '{}'); } catch (_) {}
      for (const r of visibles) if (vises.has(r.id) && corps.data !== undefined) { r.data = corps.data; r.meta = meta(corps.data); }
      return json(route, [...vises].map((id) => ({ id })));
    }
    if (m === 'POST') {
      let corps = []; try { corps = JSON.parse(req.postData() || '[]'); } catch (_) {}
      for (const nv of [].concat(corps)) { if (!nv || !nv.id) continue; const ex = visibles.find((r) => r.id === nv.id); if (ex) { ex.data = nv.data; ex.meta = meta(nv.data); } else BASE.push({ id: nv.id, owner: sub, data: nv.data, meta: meta(nv.data), updated_at: iso(Date.now()) }); }
      return json(route, []);
    }
    if (m !== 'GET') return json(route, []);
    const r = servir(visibles, u, h);
    s.lignes += r.body.length; s.maxLignes = Math.max(s.maxLignes, r.body.length);
    // Une ligne rendue qui n'est pas à lui (vérifiée par l'owner servi quand il est projeté).
    for (const x of r.body) if (x && x.owner && x.owner !== uid) s.etrangeres++;
    if (sub !== uid) s.etrangeres++;
    return json(route, r.body, { 'content-range': r.range });
  });
  await ctx.route(/\/api\//, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await ctx.route(/vinted\.net|vinted\.fr|fonts\.(googleapis|gstatic)\.com|jsdelivr|cdnjs|tile|maplibre/, (route) => route.abort());
  await ctx.addInitScript(([sess, u]) => { try { if (!localStorage.getItem('vrm_session')) localStorage.setItem('vrm_session', JSON.stringify(sess)); localStorage.setItem('vrm_local_owner', u); } catch (_) {} },
    [{ access_token: JET, refresh_token: 'r', expires_at: Date.now() + 86400e3, user: { id: uid, email: `v${i}@exemple.fr` }, totp: [] }, uid]);
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => s.erreurs.push(String(e).slice(0, 140)));
  await pg.clock.install({ time: Date.now() });
  await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
  // 2 minutes de navigation : 30 s par écran.
  for (const e of ECRANS) {
    if (e !== 'journee') await pg.evaluate((q) => window.dispatchEvent(new CustomEvent('vrm:aller', { detail: q })), '?tab=' + e).catch(() => {});
    for (let k = 0; k < 6; k++) { await pg.clock.runFor(5000); await pg.waitForTimeout(250); await pg.mouse.move(100 + k, 200).catch(() => {}); }
  }
  s.monte = await pg.evaluate(() => !!document.querySelector('main') && !document.querySelector('input[type="password"]')).catch(() => false);
  await ctx.close();
}

async function passe(nav, n) {
  peupler(n);
  const stats = {};
  for (let d = 0; d < n; d += PARALLELE) {
    await Promise.all(Array.from({ length: Math.min(PARALLELE, n - d) }, (_, k) => unVendeur(nav, d + k, stats).catch((e) => { stats[uidDe(d + k)] = { erreurs: [String(e && e.message || e).slice(0, 140)], requetes: 0, lignes: 0, maxLignes: 0, etrangeres: 0 }; })));
  }
  return stats;
}

async function main() {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.log('❌ dist/ absent : npm run build d\'abord'); process.exit(1); }
  await new Promise((res, rej) => { srv.once('error', rej); srv.listen(PORT, res); });
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    console.log('── un vendeur seul');
    const seul = Object.values(await passe(nav, 1))[0];
    console.log(`     ${seul.requetes} requêtes, ${seul.lignes} lignes rendues (au plus ${seul.maxLignes} pour une requête)`);
    console.log(`\n── ${N} vendeurs (par vagues de ${PARALLELE})`);
    const t0 = Date.now();
    const st = Object.values(await passe(nav, N));
    const moy = (k) => st.reduce((a, s) => a + (s[k] || 0), 0) / st.length;
    console.log(`     en ${Math.round((Date.now() - t0) / 1000)} s : ${Math.round(moy('requetes'))} requêtes et ${Math.round(moy('lignes'))} lignes rendues par vendeur en moyenne · total ${st.reduce((a, s) => a + s.requetes, 0)} requêtes`);
    dit(st.every((s) => s.monte), `les ${N} vendeurs ont ouvert l'app (pas l'écran de connexion)`, `${st.filter((s) => !s.monte).length} non monté(s)`);
    dit(st.every((s) => s.etrangeres === 0), 'chaque vendeur ne reçoit que SES lignes', `${st.reduce((a, s) => a + s.etrangeres, 0)} ligne(s) étrangère(s)`);
    const ecart = (a, b) => Math.abs(a - b) / Math.max(1, b);
    dit(ecart(moy('requetes'), seul.requetes) <= 0.2, 'ses requêtes ne dépendent pas du nombre de vendeurs (écart ≤ 20 % avec le vendeur seul)', `seul ${seul.requetes} · parmi ${N} : ${Math.round(moy('requetes'))}`);
    dit(ecart(moy('lignes'), seul.lignes) <= 0.2, 'les lignes qu\'on lui rend non plus', `seul ${seul.lignes} · parmi ${N} : ${Math.round(moy('lignes'))}`);
    const maxL = Math.max(...st.map((s) => s.maxLignes));
    dit(maxL <= lignesDe(uidDe(0)).length + 5, 'aucune requête d\'un vendeur ne rend O(N) lignes', `au plus ${maxL} ligne(s) pour une requête (base : ${BASE.length} lignes)`);
    const err = st.flatMap((s) => s.erreurs || []);
    dit(err.length === 0, 'aucune erreur d\'app', err.slice(0, 3).join(' | '));
  } finally { await nav.close(); srv.close(); }
  console.log(ko ? `\n❌ charge-50-vendeurs : ${ko} non conforme(s)` : `\n✅ charge-50-vendeurs : ${N} vendeurs, chacun ses lignes, rien en O(N) par vendeur`);
  process.exit(ko ? 1 : 0);
}
main().catch((e) => { console.log('❌ ' + (e && e.stack || e)); process.exit(1); });
