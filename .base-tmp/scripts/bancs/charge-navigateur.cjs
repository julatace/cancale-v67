require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « CHARGE DU NAVIGATEUR » (6 novembre)
//
//  Julien, seul vendeur actif : ~14 000 lectures/jour vers la base depuis ses
//  navigateurs (Mac 7 144, iPhone 6 715, Firefox 841). Ce banc COMPTE ce que
//  l'app demande à la base, sur une fausse base (`_minipgrest`) et des données
//  INVENTÉES (le dépôt est public) :
//    · à l'OUVERTURE de Ma journée, Ventes, Colis, Messages (les 20 premières
//      secondes) — et combien de lectures IDENTIQUES partent en même temps ;
//    · AU REPOS, onglet visible : requêtes par minute (10 minutes jouées par
//      l'horloge de Playwright, puis ramenées à la minute) ;
//    · AU REPOS, onglet visible mais SANS GESTE depuis 10 min (un écran posé
//      sur un second moniteur) : requêtes par minute ;
//    · AU REPOS, onglet CACHÉ (`document.hidden`) : requêtes par minute.
//  Il écrit un bilan JSON (BANC_SORTIE) pour comparer avant / après.
//
//  Ce qu'il EXIGE (sauf BANC_MESURE=1, qui ne fait que mesurer) :
//    1. onglet caché : AUCUNE lecture de la base pendant 10 minutes de repos
//       (rien ne peut changer à l'écran que personne ne regarde) ;
//    2. onglet visible au repos : au plus PLAFOND_REPOS lectures/minute ;
//    2 bis. visible sans geste depuis 10 min : au plus 1 lecture/minute ;
//    3. à l'ouverture d'un écran, jamais deux lectures IDENTIQUES en vol en
//       même temps (une seule requête par clé) ;
//    4. revenir sur l'onglet après 10 min cachée RELIT (données fraîches) ;
//    5. aucune erreur d'app.
//  Lancer : node scripts/bancs/charge-navigateur.cjs  (BANC_PORT, défaut 9851)
// ════════════════════════════════════════════════════════════════════════════
const http = require('http'), fs = require('fs'), path = require('path');
const { servir } = require('./_minipgrest.cjs');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }

const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 9851;
const MESURE = process.env.BANC_MESURE === '1';
const SORTIE = process.env.BANC_SORTIE || '';
const ECRANS = (process.env.BANC_ECRANS || 'journee,ventes,cat_bord,messages').split(',');
const PLAFOND_REPOS = Number(process.env.BANC_PLAFOND_REPOS) || 3;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.onnx': 'application/octet-stream' };

const UID = '11111111-2222-3333-4444-5555555555aa';
const JETON = (() => { const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url'); return b({ alg: 'HS256' }) + '.' + b({ sub: UID, aal: 'aal1', role: 'authenticated' }) + '.sig'; })();
const SESSION = { access_token: JETON, refresh_token: 'r', expires_at: Date.now() + 86400e3, user: { id: UID, email: 'vendeuse@exemple.fr' }, totp: [] };
const COMPTES = [
  { vinted_user_id: '900000001', login: 'compte-banc-un', owner: UID, access_token: 'x', refresh_token: 'x', csrf_token: 'x', updated_at: new Date().toISOString(), created_at: new Date().toISOString() },
  { vinted_user_id: '900000002', login: 'compte-banc-deux', owner: UID, access_token: 'x', refresh_token: 'x', csrf_token: 'x', updated_at: new Date().toISOString(), created_at: new Date().toISOString() },
];
const iso = (ms) => new Date(ms).toISOString();
const meta = (data) => { const m = {}; for (const [k, v] of Object.entries(data || {})) if (v == null || typeof v !== 'object') { if (String(v).length <= 600) m[k] = v; } return m; };
const ligne = (id, data) => ({ id, owner: UID, data, meta: meta(data), updated_at: iso(Date.now()) });
const vente = (n, cpt, statut) => ({ transaction_id: 70000 + n, item_id: 80000 + n, title: `Paire inventée ${n}`, status: statut, transaction_user_status: n % 3 ? 'completed' : 'needs_action',
  price: { amount: String(40 + n), currency_code: 'EUR' }, date: iso(Date.now() - n * 864e5), photo: null, user: { login: 'acheteur' + n } });
function lignes() {
  const out = [ligne('main', { vinted_room: [], vinted_entries: [] }), ligne('panel_colis_relais', {})];
  for (const c of COMPTES) {
    const u = c.vinted_user_id;
    out.push(ligne(`harvest_${u}_orders_sold`, { capturedAt: iso(Date.now() - 60e3), payload: { my_orders: Array.from({ length: 12 }, (_, i) => vente(i + (u.endsWith('2') ? 20 : 0), u, i % 4 ? 'Commande finalisée' : 'Le paiement a été validé')) } }));
    out.push(ligne(`harvest_${u}_orders_purchased`, { capturedAt: iso(Date.now() - 60e3), payload: { my_orders: [] } }));
    out.push(ligne(`harvest_${u}_wardrobe`, { capturedAt: iso(Date.now() - 60e3), complete: true, payload: { items: Array.from({ length: 15 }, (_, i) => ({ id: 90000 + i + (u.endsWith('2') ? 100 : 0), title: `Annonce inventée ${i}`, price: { amount: '50', currency_code: 'EUR' }, photos: [] })) } }));
    out.push(ligne(`harvest_${u}_inbox`, { capturedAt: iso(Date.now() - 60e3), payload: { conversations: Array.from({ length: 6 }, (_, i) => ({ id: 60000 + i, description: 'Bonjour, toujours dispo ?', unread: i < 2, updated_at: iso(Date.now() - i * 3600e3), opposite_user: { login: 'acheteur' + i }, item_count: 1 })) } }));
  }
  out.push(ligne('email_track_mondial_relay_MR999000111', { status: 'available', statusLabel: 'Arrivé au point de retrait', code: '4321', lieu: 'Tabac du Port', carrier: 'mondial_relay', suivi: 'MR999000111', receivedAt: iso(Date.now() - 3600e3) }));
  return out;
}
const ROWS = lignes();

const srv = http.createServer((q, r) => {
  let f = decodeURIComponent(q.url.split('?')[0]); if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!p.startsWith(DIST) || !fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});

let ko = 0;
const dit = (bon, quoi, detail) => { if (!bon && !MESURE) ko++; console.log(`  ${bon ? '✅' : (MESURE ? '·' : '❌')} ${quoi}${detail ? ' — ' + detail : ''}`); };

// La clé d'une requête : méthode + chemin + paramètres, valeurs d'horodatage
// et uuid neutralisées (deux lectures « identiques » = même clé).
const cleDe = (m, u) => {
  const x = new URL(u);
  const s = decodeURIComponent(x.search).replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '<uid>').replace(/\d{4}-\d\d-\d\dT[\d:.]+Z/g, '<date>');
  return `${m} ${x.pathname}${s}`;
};

async function brancher(ctx, journal) {
  const json = (route, d, extra) => route.fulfill({ status: 200, contentType: 'application/json', headers: Object.assign({ 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range' }, extra || {}), body: JSON.stringify(d) });
  await ctx.route(/supabase\.co\//, async (route) => {
    const req = route.request(); const u = req.url(); const h = req.headers(); const m = req.method();
    if (m === 'OPTIONS') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    const e = { cle: cleDe(m, u), t: Date.now(), fin: 0, phase: journal.phase };
    journal.req.push(e);
    // Une latence réaliste (60 ms) : sans elle, deux lectures identiques ne
    // seraient jamais « en vol en même temps ».
    await new Promise((ok) => setTimeout(ok, 60));
    const fini = (p) => { e.fin = Date.now(); return p; };
    if (/\/auth\/v1\//.test(u)) return fini(route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ access_token: JETON, refresh_token: 'r', expires_in: 86400, user: SESSION.user }) }));
    if (/select=owner/.test(u) && !/rpc/.test(u)) return fini(json(route, []));
    // Les écritures sont APPLIQUÉES (sinon l'app, qui écrit en comparer-et-
    // échanger, croirait à un conflit et relirait en boucle — une fiction).
    if (m === 'PATCH' && /\/rest\/v1\/app_data/.test(u)) {
      const x = new URL(u); x.searchParams.set('select', 'id');
      const vises = new Set(servir(ROWS, x.toString(), {}).body.map((r) => r.id));
      let corps = {}; try { corps = JSON.parse(req.postData() || '{}'); } catch (_) {}
      for (const r of ROWS) if (vises.has(r.id) && corps.data !== undefined) { r.data = corps.data; r.meta = meta(corps.data); }
      return fini(json(route, [...vises].map((id) => ({ id }))));
    }
    if (m === 'POST' && /\/rest\/v1\/app_data/.test(u)) {
      let corps = []; try { corps = JSON.parse(req.postData() || '[]'); } catch (_) {}
      for (const nv of [].concat(corps)) { if (!nv || !nv.id) continue; const ex = ROWS.find((r) => r.id === nv.id); if (ex) { ex.data = nv.data; ex.meta = meta(nv.data); } else ROWS.push(ligne(nv.id, nv.data)); }
      return fini(json(route, []));
    }
    if (m !== 'GET') return fini(json(route, []));
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return fini(json(route, COMPTES));
    if (/\/rest\/v1\/rpc\//.test(u)) return fini(json(route, null));
    if (!/\/rest\/v1\/app_data/.test(u)) return fini(json(route, [], { 'content-range': '*/0' }));
    const r = servir(ROWS, u, h);
    return fini(json(route, r.body, { 'content-range': r.range }));
  });
  await ctx.route(/\/api\//, (route) => { journal.api.push({ cle: cleDe(route.request().method(), route.request().url()), phase: journal.phase }); return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }); });
  await ctx.route(/vinted\.net|vinted\.fr|fonts\.(googleapis|gstatic)\.com|jsdelivr|cdnjs|tile|maplibre/, (route) => route.abort());
}

// Le nombre maximal de requêtes IDENTIQUES en vol au même instant, par clé.
function doublonsEnVol(liste) {
  const pire = {};
  const parCle = {};
  for (const e of liste) if (e.cle.startsWith('GET ')) (parCle[e.cle] = parCle[e.cle] || []).push(e);   // des LECTURES
  for (const [k, l] of Object.entries(parCle)) {
    let max = 1;
    for (const a of l) { const n = l.filter((b) => b.t <= a.t && (b.fin || Infinity) > a.t).length; if (n > max) max = n; }
    if (max > 1) pire[k] = max;
  }
  return pire;
}
const parCle = (l) => { const o = {}; for (const e of l) o[e.cle] = (o[e.cle] || 0) + 1; return Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1])); };
const cacher = (pg, cache) => pg.evaluate((c) => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => c });
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (c ? 'hidden' : 'visible') });
  document.dispatchEvent(new Event('visibilitychange'));
  window.dispatchEvent(new Event(c ? 'blur' : 'focus'));
}, cache);

// Jouer `ms` de temps à l'horloge de la page, par pas de 5 s, en laissant les
// réponses (réelles) arriver entre deux pas.
async function jouer(pg, ms) {
  for (let fait = 0; fait < ms; fait += 5000) { await pg.clock.runFor(5000); await pg.waitForTimeout(40); }
  await pg.waitForTimeout(400);
}

async function main() {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.log('❌ dist/ absent : npm run build d\'abord'); process.exit(1); }
  await new Promise((res, rej) => { srv.once('error', rej); srv.listen(PORT, res); });
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const bilan = { ecrans: {} };
  try {
    for (const ecran of ECRANS) {
      console.log(`\n── ${ecran}`);
      const ctx = await nav.newContext({ viewport: { width: 1512, height: 950 } });
      const journal = { req: [], api: [], phase: 'ouverture' };
      await brancher(ctx, journal);
      await ctx.addInitScript(([s, uid]) => { try { if (!localStorage.getItem('vrm_session')) localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_local_owner', uid); } catch (_) {} }, [SESSION, UID]);
      const pg = await ctx.newPage();
      const erreurs = []; pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 160)));
      await pg.clock.install({ time: Date.now() });
      await pg.goto(`http://localhost:${PORT}/?tab=${ecran}`, { waitUntil: 'domcontentloaded' });
      // Ouverture : 20 s jouées (en temps réel ET à l'horloge).
      for (let i = 0; i < 20; i++) { await pg.clock.runFor(1000); await pg.waitForTimeout(150); }
      const ouverture = journal.req.filter((e) => e.phase === 'ouverture');
      const enVol = doublonsEnVol(ouverture);
      const surEcran = await pg.evaluate(() => !!document.querySelector('main') && !document.querySelector('input[type="password"]')).catch(() => false);
      dit(surEcran, `${ecran} : l'écran est monté (pas l'écran de connexion)`);
      console.log(`     ouverture : ${ouverture.length} requête(s) vers la base`);
      // Repos visible : 10 minutes.
      journal.phase = 'visible';
      await jouer(pg, 10 * 60e3);
      const visibles = journal.req.filter((e) => e.phase === 'visible');
      // Repos visible, PERSONNE n'y touche depuis plus de 10 min : 10 minutes.
      journal.phase = 'inactif';
      await jouer(pg, 10 * 60e3);
      const inactifs = journal.req.filter((e) => e.phase === 'inactif');
      // Repos caché : 10 minutes.
      await cacher(pg, true);
      await pg.waitForTimeout(300);
      journal.phase = 'cache';
      await jouer(pg, 10 * 60e3);
      const caches = journal.req.filter((e) => e.phase === 'cache');
      // Retour : la page redevient visible ⇒ elle doit relire.
      journal.phase = 'retour';
      await cacher(pg, false);
      for (let i = 0; i < 10; i++) { await pg.clock.runFor(1000); await pg.waitForTimeout(150); }
      const retours = journal.req.filter((e) => e.phase === 'retour');
      const parMin = (l) => Math.round((l.length / 10) * 10) / 10;
      const b = {
        ouverture: ouverture.length, ouvertureDoublonsEnVol: enVol,
        visibleParMinute: parMin(visibles), inactifParMinute: parMin(inactifs), cacheParMinute: parMin(caches), retour: retours.length,
        detailVisible: parCle(visibles), detailCache: parCle(caches), detailOuverture: parCle(ouverture), detailRetour: parCle(retours), detailInactif: parCle(inactifs),
        detailApi: parCle(journal.api.filter((e) => e.phase !== 'ouverture')),
        api: { ouverture: journal.api.filter((e) => e.phase === 'ouverture').length, visible: journal.api.filter((e) => e.phase === 'visible').length, cache: journal.api.filter((e) => e.phase === 'cache').length },
        erreurs,
      };
      bilan.ecrans[ecran] = b;
      console.log(`     repos visible : ${b.visibleParMinute}/min · visible sans geste depuis 10 min : ${b.inactifParMinute}/min · repos caché : ${b.cacheParMinute}/min · retour : ${b.retour} · /api : ${JSON.stringify(b.api)}`);
      const top = (o) => Object.entries(o).slice(0, 6).map(([k, n]) => `${n}× ${k.slice(0, 150)}`).join('\n        ');
      if (visibles.length) console.log('     visible, les plus fréquentes :\n        ' + top(b.detailVisible));
      if (inactifs.length) console.log('     inactif, les plus fréquentes :\n        ' + top(b.detailInactif));
      if (caches.length) console.log('     caché, les plus fréquentes :\n        ' + top(b.detailCache));
      dit(caches.length === 0, `${ecran} : onglet caché 10 min ⇒ aucune lecture de la base`, `${caches.length} requête(s)`);
      dit(b.visibleParMinute <= PLAFOND_REPOS, `${ecran} : au repos, au plus ${PLAFOND_REPOS} lecture(s)/minute`, `${b.visibleParMinute}/min`);
      dit(Object.keys(enVol).length === 0, `${ecran} : jamais deux lectures identiques en vol en même temps à l'ouverture`, Object.entries(enVol).slice(0, 4).map(([k, n]) => `${n}× ${k.slice(0, 110)}`).join(' | '));
      dit(b.inactifParMinute <= 1, `${ecran} : visible mais personne n'y touche depuis 10 min ⇒ au plus 1 lecture/minute`, `${b.inactifParMinute}/min`);
      dit(retours.length > 0, `${ecran} : revenir sur l'onglet relit (données fraîches)`, `${retours.length} requête(s)`);
      dit(erreurs.length === 0, `${ecran} : aucune erreur d'app`, erreurs.join(' | '));
      await ctx.close();
    }
  } finally { await nav.close(); srv.close(); }
  if (SORTIE) fs.writeFileSync(SORTIE, JSON.stringify(bilan, null, 2));
  const somme = (k) => Object.values(bilan.ecrans).reduce((s, b) => s + b[k], 0);
  console.log(`\nTotal : ouverture ${somme('ouverture')} · visible ${Math.round(somme('visibleParMinute') * 10) / 10}/min · inactif ${Math.round(somme('inactifParMinute') * 10) / 10}/min · caché ${Math.round(somme('cacheParMinute') * 10) / 10}/min (somme des ${ECRANS.length} écrans)`);
  console.log(ko ? `❌ charge-navigateur : ${ko} contrôle(s) non conforme(s)` : (MESURE ? '· charge-navigateur : mesure seule' : '✅ charge-navigateur : rien ne tourne pour un onglet caché, une lecture par clé, repos borné'));
  process.exit(ko ? 1 : 0);
}
main().catch((e) => { console.log('❌ ' + (e && e.stack || e)); process.exit(1); });
