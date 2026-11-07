require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « TEMPS RÉELS DES VENDEURS » (6 nov., v36) — la vraie app, un vrai Chromium
//
//  L'audit (scripts/audit-mesures-terrain.cjs) exécute la règle, la collecte dans
//  un faux navigateur et le serveur. Ici, l'app BÂTIE, à 390 px tactile :
//   M1. ouverte avec une session : un lot part par `sendBeacon` vers
//       `/api/compte?mode=mesures` — corps {v, h, jeton}, `h` déjà filtré
//       (clés fermées), le premier écran utile de Ma journée mesuré, AUCUNE
//       donnée du vendeur affichée à l'écran dans le corps ;
//   M2. changer d'écran : la visite de Colis est mesurée, et rien ne repart dans
//       la minute (le lot attend sur l'appareil) ;
//   M3. le panneau du propriétaire (Réglages → Sécurité des données) lit les
//       agrégats et met en ambre un p75 qui monte de plus de 30 %.
//  Tout est inventé. Lancer : BANC_PORT=12255 node scripts/bancs/mesures-terrain.cjs
// ════════════════════════════════════════════════════════════════════════════
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const { servir } = require('./_minipgrest.cjs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const DIST = process.env.BANC_DIST ? path.resolve(process.env.BANC_DIST) : path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 12255;
const CAPT = process.env.BANC_CAPTURES || path.join(os.tmpdir(), 'vrm-bancs', 'mesures-terrain');
fs.mkdirSync(CAPT, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const UID = '11111111-2222-3333-4444-555555555555';
const JETON = (() => { const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url'); return b({ alg: 'HS256' }) + '.' + b({ sub: UID, aal: 'aal1', role: 'authenticated' }) + '.sig'; })();
const SESSION = { access_token: JETON, refresh_token: 'r', expires_at: Date.now() + 3600e3, user: { id: UID, email: 'vendeuse@exemple.fr' }, totp: [] };
const COMPTE = { vinted_user_id: '900000001', login: 'compte-de-banc', owner: UID, access_token: 'x', refresh_token: 'x', csrf_token: 'x', updated_at: new Date().toISOString(), created_at: new Date().toISOString() };
const iso = (ms) => new Date(ms).toISOString();
const VENTE = { transaction_id: 70001, title: 'Nike Air Max 1 banc', status: 'Le paiement a été validé', transaction_user_status: 'needs_action', price: { amount: '60.0', currency_code: 'EUR' }, date: iso(Date.now() - 2 * 864e5) };
const ROWS = [
  { id: 'main', owner: UID, data: {}, meta: {} },
  { id: `harvest_${COMPTE.vinted_user_id}_orders_sold`, owner: UID, data: { capturedAt: iso(Date.now()), payload: { my_orders: [VENTE] } }, meta: {} },
  { id: `harvest_${COMPTE.vinted_user_id}_orders_purchased`, owner: UID, data: { capturedAt: iso(Date.now()), payload: { my_orders: [] } }, meta: {} },
];
const PERSO = ['Nike Air Max 1 banc', 'vendeuse@exemple.fr', 'compte-de-banc', UID, '70001', '900000001'];
const ligne = (ecran, appareil, metrique, n, p50, p75, p95) => ({ ecran, appareil, metrique, n, p50, p75, p95 });
const JOURS = [
  { jour: '2026-11-05', lots: 40, mesures: 180, appareils: 3, lignes: [ligne('cat_bord', 'telephone', 'peu', 60, 900, 1500, 2600), ligne('cat_bord', 'telephone', 'inp', 30, 120, 180, 320), ligne('journee', 'telephone', 'peu', 70, 700, 950, 1800), { ecran: 'journee', appareil: 'telephone', metrique: 'morceau', n: 2 }] },
  { jour: '2026-11-04', lots: 38, mesures: 170, appareils: 3, lignes: [ligne('cat_bord', 'telephone', 'peu', 55, 800, 1000, 2000), ligne('journee', 'telephone', 'peu', 65, 650, 900, 1700)] },
];

const srv = http.createServer((q, r) => {
  let f = decodeURIComponent(q.url.split('?')[0]); if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!p.startsWith(DIST) || !fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
let ko = 0;
const dit = (bon, quoi, detail) => { if (!bon) ko++; console.log(`  ${bon ? '✅' : '❌'} ${quoi}${detail ? ' — ' + detail : ''}`); };
const attendre = async (pred, ms = 8000, pas = 200) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await pred()) return true; } catch (_) {} await new Promise((r) => setTimeout(r, pas)); } return false; };

(async () => {
  await new Promise((res, rej) => { srv.once('error', rej); srv.listen(PORT, res); });
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const lots = [];
  try {
    const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: 'Europe/Paris', locale: 'fr-FR' });
    const json = (route, d, st = 200) => route.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range' }, body: JSON.stringify(d) });
    await ctx.route(/supabase\.co\/rest\/v1\//, (route) => {
      const req = route.request(); const u = req.url();
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
      if (/\/vinted_accounts/.test(u)) return json(route, [COMPTE]);
      if (/\/rpc\//.test(u)) return json(route, null);
      if (req.method() !== 'GET') return json(route, []);
      const r = servir(ROWS, u, req.headers());
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range', 'content-range': r.range }, body: JSON.stringify(r.body) });
    });
    await ctx.route(/supabase\.co\/auth\/v1\//, (route) => json(route, { access_token: JETON, refresh_token: 'r', expires_in: 3600, user: SESSION.user }));
    await ctx.route(/\/api\//, async (route) => {
      const req = route.request(); const u = req.url();
      if (/mode=mesures/.test(u) && req.method() === 'POST') { lots.push({ at: Date.now(), corps: req.postData(), type: req.headers()['content-type'] }); return json(route, { ok: true }); }
      if (/mode=mesures/.test(u)) return json(route, { ok: true, jours: JOURS });
      if (/mode=abonnement/.test(u)) return json(route, { ok: true, proprietaire: true, acces: true, statut: 'active' });
      return json(route, {});
    });
    await ctx.route(/vinted\.net|fonts\.(googleapis|gstatic)\.com|jsdelivr|cdnjs/, (route) => route.abort());
    await ctx.addInitScript(([s, uid]) => { try { if (!localStorage.getItem('vrm_session')) localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_local_owner', uid); localStorage.setItem('vrm_bienvenue_vue', JSON.stringify({ at: 'banc' })); localStorage.setItem('vrm_visite_vue', JSON.stringify({ at: 'banc' })); } catch (_) {} }, [SESSION, UID]);
    const pg = await ctx.newPage();
    const erreurs = []; pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 160)));
    await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
    await attendre(() => lots.length > 0, 30000, 300);
    const l1 = lots[0];
    let c1 = null; try { c1 = JSON.parse(l1.corps); } catch (_) {}
    const sansJeton = c1 ? JSON.stringify({ v: c1.v, h: c1.h }) : '';
    dit(!!l1 && /text\/plain/.test(l1.type || ''), 'M1 un lot part (sendBeacon, texte) vers /api/compte?mode=mesures', l1 ? l1.type : 'aucun en 30 s');
    dit(!!c1 && Object.keys(c1).sort().join(',') === 'h,jeton,v' && c1.jeton === JETON, 'M1 le corps est {v, h, jeton} — le jeton de la session, rien d\'autre', c1 ? Object.keys(c1).join(',') : '');
    dit(!!c1 && Object.keys(c1.h || {}).every((k) => /^[a-z_]+\|(telephone|tablette|ordinateur)\|(peu|inp|cls|morceau)$/.test(k)) && !!(c1.h || {})['journee|telephone|peu'], 'M1 des clés fermées ; le premier écran utile de Ma journée sur téléphone est mesuré', c1 ? Object.keys(c1.h).join(' ') : '');
    dit(!!c1 && PERSO.every((p) => !sansJeton.includes(p)), 'M1 aucune donnée du vendeur affichée à l\'écran n\'est dans le lot', sansJeton.slice(0, 160));
    // M2 : changer d'écran ; rien ne repart dans la minute.
    const n0 = lots.length;
    await pg.locator('nav >> text=Colis').first().click({ timeout: 5000 }).catch(async () => { await pg.goto(`http://localhost:${PORT}/?tab=cat_bord`, { waitUntil: 'domcontentloaded' }); });
    await pg.waitForTimeout(4000);
    await pg.locator('nav >> text=Ventes').first().click({ timeout: 5000 }).catch(() => {});
    await pg.waitForTimeout(25000);
    const garde = await pg.evaluate(() => { try { return Object.keys((JSON.parse(localStorage.getItem('vrm_mesures_lot') || 'null') || {}).h || {}); } catch (_) { return null; } });
    dit(lots.length === n0, 'M2 dans la minute qui suit, aucun autre lot ne part', `${lots.length - n0} de plus`);
    dit(Array.isArray(garde) && garde.some((k) => /^cat_bord\|telephone\|/.test(k)), 'M2 la visite de Colis est mesurée et attend sur l\'appareil', JSON.stringify(garde));
    // M3 : le panneau du propriétaire.
    await pg.goto(`http://localhost:${PORT}/?tab=settings`, { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(2500);
    await pg.getByText('Sécurité des données', { exact: true }).first().click({ timeout: 8000 }).catch(() => {});
    await attendre(async () => (await pg.locator('[data-mesures]').count()) > 0, 10000);
    await pg.waitForTimeout(800);
    const p = await pg.evaluate(() => {
      const el = document.querySelector('[data-mesures]'); if (!el) return null;
      const ligneColis = el.querySelector('[data-mesures-ligne="cat_bord|telephone"]');
      const p75 = ligneColis && ligneColis.querySelector('[data-mesures-p75]');
      const ligneJ = el.querySelector('[data-mesures-ligne="journee|telephone"]');
      const p75j = ligneJ && ligneJ.querySelector('[data-mesures-p75]');
      return { etat: el.getAttribute('data-mesures'), jour: el.getAttribute('data-mesures-jour'), colis: ligneColis ? ligneColis.innerText.replace(/\s+/g, ' ') : null,
        ambreColis: p75 ? getComputedStyle(p75).fontWeight : null, ambreJournee: p75j ? getComputedStyle(p75j).fontWeight : null, debord: document.documentElement.scrollWidth > window.innerWidth + 1 };
    });
    await pg.screenshot({ path: path.join(CAPT, 'M3-panneau-390.png'), fullPage: false }).catch(() => {});
    dit(!!p && p.etat === 'lu' && p.jour === '2026-11-05' && /Colis/.test(p.colis || '') && /1,5 s/.test(p.colis || ''), 'M3 le panneau du propriétaire montre le dernier jour, Colis sur téléphone (p75 1,5 s)', JSON.stringify(p));
    dit(!!p && p.ambreColis === '700' && p.ambreJournee !== '700', 'M3 le p75 qui monte de plus de 30 % (1,0 → 1,5 s) est marqué, l\'autre (+6 %) non', p ? `${p.ambreColis} / ${p.ambreJournee}` : '');
    dit(!!p && !p.debord, 'M3 aucun débordement horizontal de la page');
    dit(erreurs.length === 0, 'aucune erreur d\'app', erreurs.join(' | '));
    await ctx.close();
  } catch (e) { dit(false, 'le banc a tourné jusqu\'au bout', String(e && e.message).slice(0, 200)); }
  finally { await nav.close(); srv.close(); }
  console.log(ko ? `\n❌ mesures-terrain : ${ko} rouge(s)` : '\n✅ mesures-terrain : tout est vert');
  process.exit(ko ? 1 : 0);
})();
