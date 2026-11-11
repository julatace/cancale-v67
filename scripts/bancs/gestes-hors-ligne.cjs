require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « TOUTE L'APP HORS LIGNE » — la file des gestes (11 nov., src/gestesHorsLigne.js)
//
//  Le réseau est VRAIMENT coupé (`context.setOffline(true)` : `navigator.onLine`
//  faux, le service worker sert la coquille) ET la base avorte chaque requête
//  comme un réseau absent. La base est à ÉTAT et à la vraie forme (`routeMain` :
//  PATCH conditionnel sur `data->>rev`, garde-fou 017). Gestes faits À L'ÉCRAN
//  (Annonces → Outils → Compléter les prix d'achat), sur un compte et dix paires
//  INVENTÉS (aucune `fx/`).
//   A  fermeture/réouverture hors ligne : Annonces rouvert SANS réseau se lit
//      depuis la copie (pas « Ma journée » à sa place), pastille « Hors ligne ·
//      vu à hh:mm » ; prix saisi ⇒ « 1 geste en attente », rangé dans IndexedDB ;
//      l'app FERMÉE puis rouverte hors ligne ⇒ toujours 1 ; le réseau revient ⇒
//      le prix arrive en base UNE fois, l'identifiant du geste dans
//      `vrm_gestes_faits`, « Envoyés ✓ ».
//   B  deux appareils : A (hors ligne) met 42 au N°2 et 43 au N°3 ; B (en ligne,
//      son propre navigateur) met 52 au N°2. Au retour de A : 43 arrive, 52
//      RESTE (jamais écrasé), « 1 geste à trancher » ; la feuille montre les deux
//      versions ; A affiche 52 ; « Garder la mienne » ⇒ 42 en base.
//   C  retour en pleine file : 3 gestes en attente, le réseau revient, la
//      première écriture est TENUE ; pendant ce temps un 4e prix est saisi ;
//      relâchée ⇒ les 4 arrivent, chacun une fois, dans l'ordre.
//   D  429 puis 503 au rejeu : rien n'est perdu ni sauté, le geste reste « en
//      attente » ; la panne finie, il arrive une fois.
//   E  coupure PENDANT un geste : l'écriture du prix est TENUE, le réseau coupe,
//      elle avorte ; un second prix est saisi hors ligne ; au retour les deux
//      arrivent, chacun une fois.
//   F  numéros : pool intact, aucun N° changé, aucun doublon ; aucune erreur JS.
//  §6.1 : rouge sur le build d'avant (`BANC_DIST=<dist d'avant>`).
//  Lancer : BANC_PORT=12345 node scripts/bancs/gestes-hors-ligne.cjs
//  (BANC_SEUL=A,B… ; BANC_TAILLES=390 ; captures dans BANC_CAPTURES)
// ════════════════════════════════════════════════════════════════════════════
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const { servir } = require('./_minipgrest.cjs');
const { routeMain, cleNum } = require('./_base-ecritures.cjs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));

const DIST = process.env.BANC_DIST ? path.resolve(process.env.BANC_DIST) : path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 12347;
const CAPT = process.env.BANC_CAPTURES || path.join(os.tmpdir(), 'vrm-bancs', 'gestes-hors-ligne');
fs.mkdirSync(CAPT, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.zip': 'application/zip', '.onnx': 'application/octet-stream', '.wasm': 'application/wasm' };

const UID = '22222222-3333-4444-5555-666666666666';
const JETON = (() => { const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url'); return b({ alg: 'HS256' }) + '.' + b({ sub: UID, aal: 'aal1', role: 'authenticated' }) + '.sig'; })();
const SESSION = { access_token: JETON, refresh_token: 'r', expires_at: Date.now() + 86400e3, user: { id: UID, email: 'vendeuse@exemple.fr' }, totp: [] };
const VID = '900000777';
const COMPTE = { vinted_user_id: VID, login: 'compte-de-banc', owner: UID, access_token: 'x', refresh_token: 'x', csrf_token: 'x', updated_at: new Date().toISOString(), created_at: new Date(Date.now() - 60 * 864e5).toISOString() };
const iso = (ms) => new Date(ms).toISOString();
const frais = (ms) => iso(Date.now() - ms);
const meta = (data) => { const m = {}; for (const [k, v] of Object.entries(data || {})) if (v == null || typeof v !== 'object') { if (String(v).length <= 600) m[k] = v; } return m; };
const ligne = (id, data) => ({ id, owner: UID, data, meta: meta(data), updated_at: iso(Date.now()) });

const N = 10;
const IDS = Array.from({ length: N }, (_, i) => String(7300000001 + i));
const ITEMS = IDS.map((id, i) => ({ id: Number(id), title: `Asics Gel banc ${i + 1} taille 4${i % 10}`, brand_title: 'Asics', size_title: '4' + (i % 10), status: 'Très bon état', price: { amount: String(70 + i) + '.0', currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false, favourite_count: 0, view_count: 2, created_at_ts: frais((i + 2) * 864e5), photo: { url: `https://images1.vinted.net/t/${id}/f800/p.jpeg` } }));
const FICHES = {}; IDS.forEach((id, i) => { FICHES[id] = { numero: String(i + 1), numberedAt: frais((i + 2) * 864e5), auto: false, manuelAt: frais((i + 2) * 864e5), title: ITEMS[i].title }; });
const MAIN0 = { vrm_prenom: 'Banc', vinted_dark: false, vinted_buyprice_by_num: {}, vinted_annonce_numeros: FICHES, vinted_used_numeros: IDS.map((_, i) => String(i + 1)), vrm_bienvenue_vue: { at: 'banc' }, vrm_visite_vue: { at: 'banc' }, rev: 3 };
const ROWS = [
  ligne(`harvest_${VID}_listings`, { capturedAt: frais(60e3), nItems: N, payload: { items: ITEMS, pagination: { total_entries: N } } }),
  ligne(`harvest_${VID}_enligne`, { capturedAt: frais(60e3), complet: true, n: N, ids: ITEMS.map((x) => x.id), items: ITEMS.map((x) => ({ id: x.id, title: x.title })) }),
  ligne(`harvest_${VID}_profile`, { capturedAt: frais(60e3), payload: { user: { id: Number(VID), login: 'compte-de-banc' } } }),
  ligne(`harvest_${VID}_orders_sold`, { capturedAt: frais(60e3), nItems: 0, payload: { my_orders: [] } }),
  ligne(`harvest_${VID}_orders_purchased`, { capturedAt: frais(60e3), nItems: 0, payload: { my_orders: [] } }),
];

const srv = http.createServer((q, r) => {
  let f = decodeURIComponent(q.url.split('?')[0]); if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!p.startsWith(DIST) || !fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});

let ko = 0, ok = 0;
const SEUL = (process.env.BANC_SEUL || '').split(',').filter(Boolean);
const joue = (x) => !SEUL.length || SEUL.includes(x);
const TAILLES = (process.env.BANC_TAILLES || '').split(',').filter(Boolean).map(Number);
const dit = (bon, quoi, detail) => { if (bon) ok++; else ko++; console.log(`  ${bon ? '✅' : '❌'} ${quoi}${detail ? ' — ' + detail : ''}`); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 200)); } };
const attendre = async (pred, ms = 8000, pas = 200) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await pred()) return true; } catch (_) {} await new Promise((r) => setTimeout(r, pas)); } return false; };

// LA BASE, partagée par les deux appareils (un seul Supabase). `app.hors` coupe
// CET appareil ; `base.faute(meth, u)` injecte 429/503 ; `base.tenir` tient une écriture.
const nouvelleBase = () => ({ main: { main: JSON.parse(JSON.stringify(MAIN0)), maj: frais(864e5), ecritures: [] }, faute: null, tenir: null, tenues: [] });
async function brancher(ctx, base, app) {
  const json = (route, d, extra, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: Object.assign({ 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range' }, extra || {}), body: typeof d === 'string' ? d : JSON.stringify(d) }).catch(() => {});
  await ctx.route(/supabase\.co\/rest\/v1\//, async (route) => {
    const req = route.request(); const u = req.url(); const meth = req.method();
    if (app.hors) return route.abort('internetdisconnected').catch(() => {});
    if (meth === 'OPTIONS') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    const surMain = /[?&]id=eq\.main(&|$)/.test(decodeURIComponent(u));
    if (meth === 'PATCH' && surMain) {
      if (base.tenir) {
        const t = base.tenir; base.tenir = null;
        const issue = await new Promise((res) => { base.tenues.push({ app: app.nom, relacher: res, at: Date.now() }); t(); });
        if (issue === 'coupe') return route.abort('internetdisconnected').catch(() => {});
      }
      const f = base.faute ? base.faute(meth, u) : null;
      if (f) { base.main.ecritures.push({ meth, data: null, resultat: f, app: app.nom }); return json(route, { message: 'banc ' + f }, {}, f); }
    }
    if (/select=owner/.test(u) && !/rpc/.test(u) && !surMain) return json(route, []);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return meth === 'GET' ? json(route, [COMPTE]) : json(route, []);
    if (/\/rest\/v1\/rpc\//.test(u)) return json(route, null);
    if (!/\/rest\/v1\/app_data/.test(u)) return json(route, [], { 'content-range': '*/0' });
    const avant = base.main.ecritures.length;
    const m = routeMain(req, base.main);
    if (m) { for (let i = avant; i < base.main.ecritures.length; i++) base.main.ecritures[i].app = app.nom; return json(route, m.body, {}, m.status); }
    if (meth !== 'GET') return json(route, []);
    const r = servir(ROWS, u, req.headers());
    return json(route, r.body, { 'content-range': r.range });
  });
  await ctx.route(/supabase\.co\/auth\/v1\//, (route) => (app.hors ? route.abort('internetdisconnected') : route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(/\/user/.test(route.request().url()) ? SESSION.user : { access_token: JETON, refresh_token: 'r', expires_in: 86400, user: SESSION.user }) })));
  await ctx.route(/\/api\//, (route) => (app.hors ? route.abort('internetdisconnected') : route.fulfill({ status: 200, contentType: 'application/json', body: /mode=confidentialite/.test(route.request().url()) ? JSON.stringify({ ok: true, uid: UID }) : '{"ok":true}' })));
  await ctx.route(/vinted\.net|fonts\.(googleapis|gstatic)\.com|jsdelivr|cdnjs/, (route) => route.abort().catch(() => {}));
}
async function appareil(nav, base, vp, nom) {
  const ctx = await nav.newContext(Object.assign({ viewport: vp, timezoneId: 'Europe/Paris', locale: 'fr-FR' }, vp.width < 600 ? { isMobile: true, hasTouch: true } : {}));
  const app = { nom, hors: false, ctx, erreurs: [] };
  await brancher(ctx, base, app);
  await ctx.addInitScript(([s, uid]) => { try { if (!localStorage.getItem('vrm_session')) localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_local_owner', uid); localStorage.setItem('schema_cloisonne', '1'); localStorage.setItem('vrm_bienvenue_vue', JSON.stringify({ at: 'banc' })); localStorage.setItem('vrm_visite_vue', JSON.stringify({ at: 'banc' })); } catch (_) {} }, [SESSION, UID]);
  app.page = async () => { const pg = await ctx.newPage(); pg.on('pageerror', (e) => app.erreurs.push(String(e).slice(0, 200))); app.pg = pg; return pg; };
  app.couper = async () => { app.hors = true; await ctx.setOffline(true); };
  app.rebrancher = async () => { app.hors = false; await ctx.setOffline(false); };
  return app;
}
const URL0 = () => `http://localhost:${PORT}`;
async function ouvrirAnnonces(pg) {
  await pg.goto(URL0() + '/?tab=cat_annonces', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await pg.evaluate(() => navigator.serviceWorker && navigator.serviceWorker.ready).catch(() => {});
  if (!(await pg.evaluate(() => !!(navigator.serviceWorker && navigator.serviceWorker.controller)).catch(() => false))) await pg.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
}
async function ouvrirSaisie(pg) {
  await attendre(async () => (await pg.getByRole('button', { name: /Outils/ }).count()) > 0, 15000);
  await pg.getByRole('button', { name: /Outils/ }).first().click().catch(() => {});
  await attendre(async () => (await pg.getByText(/Compl[ée]ter les prix d'achat/).count()) > 0, 5000);
  await pg.getByText(/Compl[ée]ter les prix d'achat/).first().click().catch(() => {});
  return attendre(async () => (await pg.locator('[data-fillbuy]').count()) > 0, 8000);
}
const saisirPrix = async (pg, numero, prix) => {
  const i = await pg.evaluate((n) => { const champs = [...document.querySelectorAll('[data-fillbuy]')]; const c = champs.find((x) => { let p = x; for (let k = 0; k < 8 && p; k++) { const m = (p.innerText || '').match(/N°\s*(\d+)/); if (m && m[1] === n) return true; if (m) return false; p = p.parentElement; } return false; }); return c ? c.getAttribute('data-fillbuy') : null; }, String(numero));
  if (i == null) return false;
  const champ = pg.locator(`[data-fillbuy="${i}"]`);
  await champ.click(); await champ.fill(String(prix)); await champ.press('Enter');
  return true;
};
const prixBase = (base, n) => String(((base.main.main || {}).vinted_annonce_numeros || {})[IDS[n - 1]]?.buyPrice || '');
const prixLocal = (pg, n) => pg.evaluate((id) => { try { return String((JSON.parse(localStorage.getItem('vinted_annonce_numeros') || '{}')[id] || {}).buyPrice || ''); } catch (_) { return 'illisible'; } }, IDS[n - 1]).catch(() => '?');
const pastille = (pg) => pg.evaluate(() => { const el = document.querySelector('[data-gestes-hl]'); return el ? { etat: el.getAttribute('data-gestes-hl'), attente: Number(el.getAttribute('data-gestes-attente')), atrancher: Number(el.getAttribute('data-gestes-atrancher')), texte: (el.innerText || '').trim() } : null; }).catch(() => null);
const registre = (pg) => pg.evaluate((uid) => new Promise((ok) => { try { const rq = indexedDB.open('vrm-gestes', 1); rq.onupgradeneeded = () => { try { rq.result.createObjectStore('registres', { keyPath: 'uid' }); } catch (_) {} }; rq.onsuccess = () => { try { const g = rq.result.transaction('registres', 'readonly').objectStore('registres').get(uid); g.onsuccess = () => ok((g.result && g.result.gestes) || []); g.onerror = () => ok(null); } catch (_) { ok(null); } }; rq.onerror = () => ok(null); } catch (_) { ok(null); } }), UID).catch(() => null);
const enAttente = async (pg) => { const r = await registre(pg); return r ? r.filter((g) => g.etat === 'attente').length : -1; };
// Les écritures ACCEPTÉES qui ont fait passer le prix du N°n à `p` (de « autre chose » à p) : UNE seule.
const posees = (base, n, p) => { let prec = String((MAIN0.vinted_annonce_numeros[IDS[n - 1]] || {}).buyPrice || ''); let k = 0; for (const e of base.main.ecritures) { if (!(e.resultat === 1 || e.resultat === 201) || !e.data) continue; const v = String(((e.data.vinted_annonce_numeros || {})[IDS[n - 1]] || {}).buyPrice || ''); if (v === p && prec !== p) k++; prec = v; } return k; };
const faits = (base) => ((base.main.main || {}).vrm_gestes_faits) || [];
const doublonsFaits = (base) => { const l = faits(base); return l.length - new Set(l).size; };
const numerosIntacts = (d) => {
  const pa = new Set(MAIN0.vinted_used_numeros.map(cleNum)), pb = new Set((d.vinted_used_numeros || []).map(cleNum));
  const perdus = [...pa].filter((c) => !pb.has(c));
  const fb = d.vinted_annonce_numeros || {};
  const changes = IDS.filter((id) => cleNum(FICHES[id].numero) !== cleNum((fb[id] || {}).numero));
  const par = {}; for (const [id, e] of Object.entries(fb)) { const c = e && e.numero != null && String(e.numero).trim() ? cleNum(e.numero) : ''; if (c) (par[c] = par[c] || []).push(id); }
  return { perdus, changes, doublons: Object.entries(par).filter(([, l]) => l.length > 1).map(([c]) => c) };
};
// Le banc attend que l'app ait fini ses envois d'ouverture avant de mesurer SES gestes.
const calme = async (pg) => { await attendre(async () => (await pg.evaluate(() => localStorage.getItem('vrm_file_envoi')).catch(() => 'x')) == null, 15000); await pg.waitForTimeout(800); };

async function main() {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.log('dist absent : npm run build'); process.exit(2); }
  await new Promise((res, rej) => { srv.once('error', rej); srv.listen(PORT, res); });
  const nav = await chromium.launch({ executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const erreurs = [];
  try {
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }].filter((v) => !TAILLES.length || TAILLES.includes(v.width))) {
      const T = vp.width < 600 ? '390' : '1512';
      const base = nouvelleBase();
      const A = await appareil(nav, base, vp, 'A');
      let pg = await A.page();
      await ouvrirAnnonces(pg);
      dit(await ouvrirSaisie(pg), `${T} : en ligne, Annonces → « Compléter les prix d'achat » s'ouvre`);
      await calme(pg);

      // ── A. fermeture / réouverture hors ligne ──────────────────────────────
      if (joue('A')) await essaie(`${T} A`, async () => {
        console.log(`\n── ${T} · A. fermeture et réouverture hors ligne`);
        await A.couper();
        await pg.goto(URL0() + '/?tab=cat_annonces', { waitUntil: 'domcontentloaded' }).catch(() => {});
        await pg.waitForTimeout(2500);
        const journee = await pg.locator('[data-hors-ligne="journee"], [data-journee-hors-ligne]').count();
        dit(await ouvrirSaisie(pg), `${T} A : rouvert SANS réseau, Annonces se lit depuis la copie (la saisie en série s'ouvre)`, `vue dédiée=${journee}`);
        const p0 = await pastille(pg);
        dit(!!p0 && p0.etat === 'hors' && /\d{2}:\d{2}/.test(p0.texte), `${T} A : pastille « Hors ligne · vu à hh:mm »`, JSON.stringify(p0));
        await pg.screenshot({ path: path.join(CAPT, `A-hors-ligne-${T}.png`) });
        dit(await saisirPrix(pg, 1, '41'), `${T} A : prix du N°1 saisi hors ligne`);
        await attendre(async () => (await pastille(pg))?.attente === 1, 5000);
        const p1 = await pastille(pg);
        dit(p1 && p1.attente === 1 && /1/.test(p1.texte), `${T} A : « Hors ligne · 1 geste en attente »`, JSON.stringify(p1));
        dit(await enAttente(pg) === 1, `${T} A : le geste est rangé dans IndexedDB (au nom du compte)`);
        dit(prixBase(base, 1) === '', `${T} A : rien n'est arrivé en base pendant la coupure`);
        await pg.screenshot({ path: path.join(CAPT, `A-attente-${T}.png`) });
        // L'app est FERMÉE puis rouverte, toujours sans réseau.
        await pg.close(); pg = await A.page();
        await pg.goto(URL0() + '/?tab=cat_annonces', { waitUntil: 'domcontentloaded' }).catch(() => {});
        await attendre(async () => (await pastille(pg))?.attente === 1, 10000);
        dit((await pastille(pg))?.attente === 1 && await enAttente(pg) === 1, `${T} A : rouverte hors ligne, le geste attend toujours (survit à la fermeture)`, JSON.stringify(await pastille(pg)));
        dit(await prixLocal(pg, 1) === '41', `${T} A : et le prix est sur l'appareil`);
        const t0 = base.main.ecritures.length;
        await A.rebrancher();
        await attendre(() => prixBase(base, 1) === '41', 20000);
        dit(prixBase(base, 1) === '41', `${T} A : le réseau revient ⇒ le prix arrive en base`);
        dit(posees(base, 1, '41') === 1, `${T} A : posé UNE fois`, String(posees(base, 1, '41')));
        const r = await registre(pg); const g = r && r.find((x) => x.k === 'vinted_annonce_numeros');
        dit(!!g && faits(base).includes(g.id), `${T} A : l'identifiant du geste est dans vrm_gestes_faits`);
        const vuEnvoyes = await attendre(async () => (await pastille(pg))?.etat === 'envoyes', 6000, 100);
        dit(vuEnvoyes, `${T} A : « Envoyés ✓ »`);
        await pg.screenshot({ path: path.join(CAPT, `A-envoyes-${T}.png`) });
        await attendre(async () => !(await pastille(pg)), 8000);
        dit(!(await pastille(pg)), `${T} A : puis la pastille s'efface`);
        dit(base.main.ecritures.slice(t0).every((e) => e.resultat !== 'vrm_pool_retreci' && e.resultat !== 'vrm_fiche_perdue'), `${T} A : aucun refus du garde-fou des numéros`);
      });

      // ── B. deux appareils ──────────────────────────────────────────────────
      if (joue('B')) await essaie(`${T} B`, async () => {
        console.log(`\n── ${T} · B. deux appareils`);
        await ouvrirAnnonces(pg); await ouvrirSaisie(pg); await calme(pg);
        await A.couper();
        dit(await saisirPrix(pg, 2, '42'), `${T} B : A (hors ligne) met 42 au N°2`);
        await pg.waitForTimeout(400);
        dit(await saisirPrix(pg, 3, '43'), `${T} B : A (hors ligne) met 43 au N°3`);
        await attendre(async () => (await pastille(pg))?.attente === 2, 5000);
        const B = await appareil(nav, base, vp, 'B');
        const pb = await B.page();
        await ouvrirAnnonces(pb);
        dit(await ouvrirSaisie(pb), `${T} B : B (en ligne) ouvre la saisie`);
        await calme(pb);
        dit(await saisirPrix(pb, 2, '52'), `${T} B : B met 52 au N°2`);
        await attendre(() => prixBase(base, 2) === '52', 15000);
        dit(prixBase(base, 2) === '52', `${T} B : 52 est en base`);
        await B.ctx.close();
        await A.rebrancher();
        await attendre(() => prixBase(base, 3) === '43', 20000);
        await attendre(async () => (await pastille(pg))?.atrancher === 1, 8000);
        dit(prixBase(base, 3) === '43', `${T} B : au retour de A, 43 arrive au N°3`);
        dit(prixBase(base, 2) === '52', `${T} B : 52 RESTE au N°2 (jamais écrasé)`, prixBase(base, 2));
        const p = await pastille(pg);
        dit(p && p.atrancher === 1, `${T} B : « 1 geste à trancher »`, JSON.stringify(p));
        await attendre(async () => (await prixLocal(pg, 2)) === '52', 5000);
        dit(await prixLocal(pg, 2) === '52', `${T} B : A affiche la version de la base (52)`, await prixLocal(pg, 2));
        await pg.locator('[data-gestes-hl-trancher]').click();
        await pg.locator('[data-geste-atrancher]').first().waitFor({ timeout: 5000 });
        const mien = await pg.locator('[data-geste-mien]').first().innerText(), autre = await pg.locator('[data-geste-autre]').first().innerText();
        dit(/42/.test(mien) && /52/.test(autre), `${T} B : la feuille montre les deux versions`, `ici=${mien} · ailleurs=${autre}`);
        await pg.screenshot({ path: path.join(CAPT, `B-trancher-${T}.png`) });
        await pg.locator('[data-geste-garder="mien"]').first().click();
        await attendre(() => prixBase(base, 2) === '42', 15000);
        dit(prixBase(base, 2) === '42', `${T} B : « Garder la mienne » ⇒ 42 en base`, prixBase(base, 2));
        await pg.keyboard.press('Escape').catch(() => {});
        await attendre(async () => { const q = await pastille(pg); return !q || (!q.atrancher && !q.attente); }, 8000);
        const q = await pastille(pg);
        dit(!q || (!q.atrancher && !q.attente), `${T} B : plus rien à trancher ni en attente`, JSON.stringify(q));
      });

      // ── C. retour en pleine file ───────────────────────────────────────────
      if (joue('C')) await essaie(`${T} C`, async () => {
        console.log(`\n── ${T} · C. retour en pleine file`);
        await ouvrirAnnonces(pg); await ouvrirSaisie(pg); await calme(pg);
        await A.couper();
        for (const [n, p] of [[4, '44'], [5, '45'], [6, '46']]) { dit(await saisirPrix(pg, n, p), `${T} C : N°${n} = ${p} hors ligne`); await pg.waitForTimeout(300); }
        await attendre(async () => (await pastille(pg))?.attente === 3, 5000);
        dit((await pastille(pg))?.attente === 3, `${T} C : « 3 gestes en attente »`, JSON.stringify(await pastille(pg)));
        let tenue = false;
        base.tenir = () => { tenue = true; };
        await A.rebrancher();
        await attendre(() => tenue, 15000);
        dit(tenue, `${T} C : le rejeu commence (première écriture tenue)`);
        const pe = await pastille(pg);
        dit(pe && (pe.etat === 'envoi' || pe.etat === 'attente'), `${T} C : pendant l'envoi, la pastille le dit`, JSON.stringify(pe));
        dit(await saisirPrix(pg, 7, '47'), `${T} C : pendant le rejeu, N°7 = 47 saisi`);
        await pg.waitForTimeout(600);
        base.tenues.splice(0).forEach((t) => t.relacher('ok'));
        await attendre(() => ['44', '45', '46', '47'].every((p, i) => prixBase(base, 4 + i) === p), 25000);
        const vus = [4, 5, 6, 7].map((n) => prixBase(base, n));
        dit(JSON.stringify(vus) === '["44","45","46","47"]', `${T} C : les 4 arrivent`, JSON.stringify(vus));
        const fois = [4, 5, 6, 7].map((n) => posees(base, n, String(40 + n)));
        dit(fois.every((x) => x === 1), `${T} C : chacun posé UNE fois`, JSON.stringify(fois));
        const ordre = [4, 5, 6].map((n) => base.main.ecritures.findIndex((e) => (e.resultat === 1) && e.data && String(((e.data.vinted_annonce_numeros || {})[IDS[n - 1]] || {}).buyPrice || '') === String(40 + n)));
        dit(ordre[0] >= 0 && ordre[0] <= ordre[1] && ordre[1] <= ordre[2], `${T} C : dans l'ordre des gestes`, JSON.stringify(ordre));
        dit(doublonsFaits(base) === 0, `${T} C : aucun identifiant de geste deux fois dans vrm_gestes_faits`);
        await attendre(async () => (await enAttente(pg)) === 0, 8000);
        dit(await enAttente(pg) === 0, `${T} C : la file est vide`);
      });

      // ── D. 429 puis 503 au rejeu ───────────────────────────────────────────
      if (joue('D')) await essaie(`${T} D`, async () => {
        console.log(`\n── ${T} · D. 429 puis 503 au rejeu`);
        await ouvrirAnnonces(pg); await ouvrirSaisie(pg); await calme(pg);
        await A.couper();
        dit(await saisirPrix(pg, 8, '48'), `${T} D : N°8 = 48 hors ligne`);
        await attendre(async () => (await pastille(pg))?.attente === 1, 5000);
        const suite = [429, 503]; const vus = [];
        base.faute = () => { const f = suite.shift(); if (f) vus.push(f); return f || null; };
        await A.rebrancher();
        await attendre(() => vus.length === 2, 25000);
        dit(JSON.stringify(vus) === '[429,503]', `${T} D : le rejeu a reçu 429 puis 503`, JSON.stringify(vus));
        dit(await enAttente(pg) >= 0, `${T} D : le registre se lit`);
        await attendre(() => prixBase(base, 8) === '48', 40000);
        base.faute = null;
        dit(prixBase(base, 8) === '48', `${T} D : la panne finie, le prix arrive`);
        dit(posees(base, 8, '48') === 1, `${T} D : une fois`, String(posees(base, 8, '48')));
        dit(doublonsFaits(base) === 0, `${T} D : aucun geste appliqué deux fois`);
      });

      // ── E. coupure pendant un geste ────────────────────────────────────────
      if (joue('E')) await essaie(`${T} E`, async () => {
        console.log(`\n── ${T} · E. coupure pendant un geste`);
        await ouvrirAnnonces(pg); await ouvrirSaisie(pg); await calme(pg);
        let tenue = false;
        base.tenir = () => { tenue = true; };
        dit(await saisirPrix(pg, 9, '49'), `${T} E : N°9 = 49 saisi en ligne`);
        await attendre(() => tenue, 15000);
        dit(tenue, `${T} E : son écriture est en vol (tenue)`);
        await A.couper();
        base.tenues.splice(0).forEach((t) => t.relacher('coupe'));
        await pg.waitForTimeout(1200);
        dit(prixBase(base, 9) === '', `${T} E : l'écriture a avorté (rien en base)`);
        dit(await saisirPrix(pg, 10, '50'), `${T} E : N°10 = 50 saisi hors ligne`);
        await pg.waitForTimeout(1500);
        dit(await prixLocal(pg, 9) === '49' && await prixLocal(pg, 10) === '50', `${T} E : les deux sont gardés sur l'appareil`);
        await A.rebrancher();
        await attendre(() => prixBase(base, 9) === '49' && prixBase(base, 10) === '50', 30000);
        dit(prixBase(base, 9) === '49' && prixBase(base, 10) === '50', `${T} E : au retour, les deux arrivent`, JSON.stringify([prixBase(base, 9), prixBase(base, 10)]));
        dit(posees(base, 9, '49') === 1 && posees(base, 10, '50') === 1, `${T} E : chacun une fois`, JSON.stringify([posees(base, 9, '49'), posees(base, 10, '50')]));
      });

      // ── F ──────────────────────────────────────────────────────────────────
      {
        const r = numerosIntacts(base.main.main || {});
        dit(!r.perdus.length && !r.changes.length && !r.doublons.length, `${T} F : pool intact, aucun N° changé, aucun doublon`, JSON.stringify(r));
        const prix = IDS.map((_, i) => prixBase(base, i + 1));
        console.log('    prix en base :', JSON.stringify(prix));
      }
      erreurs.push(...A.erreurs);
      await A.ctx.close();
    }
  } finally { await nav.close(); srv.close(); }
  const js = erreurs.filter((m) => !/ResizeObserver|Failed to fetch|NetworkError|internet|vrm-hors-ligne/i.test(m));
  dit(js.length === 0, 'aucune erreur JS', js.slice(0, 3).join(' | '));
  console.log(`\n${ok} OK, ${ko} KO`);
  process.exit(ko ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
