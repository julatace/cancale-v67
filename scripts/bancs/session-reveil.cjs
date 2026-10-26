require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « SESSION AU RÉVEIL » et « MORCEAU PÉRIMÉ » (18 octobre).
//
//  Deux défauts MESURÉS en production, prouvés ici sans aucune fixture :
//   A. Une coupure réseau à l'ouverture (jeton expiré, renouvellement qui n'aboutit
//      pas) DÉCONNECTAIT le vendeur : « pas su » ne doit jamais déconnecter.
//   B. L'autre sens : un renouvellement REFUSÉ par le service (jeton révoqué)
//      ramène bien à l'écran de connexion.
//   C. Au réveil (retour au premier plan) avec un jeton qui expire, le
//      renouvellement part TOUT DE SUITE — pas au prochain tour de la minuterie
//      de 4 min (le 17 octobre : 104 lectures refusées en 5 min).
//   D. Après un déploiement, l'onglet demande un morceau de l'app qui n'existe
//      plus (« Unable to preload CSS ») : la page se recharge UNE fois et l'app
//      s'affiche, au lieu de tomber.
// ════════════════════════════════════════════════════════════════════════════
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const DIST = path.join(__dirname, '..', '..', 'dist');   // jamais un chemin absolu (§6.1)
const PORT = Number(process.env.BANC_PORT || process.env.PORT) || 4982;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml', '.webmanifest':'application/manifest+json' };
const USER = { id: '11111111-2222-3333-4444-555555555555', email: 'vendeur@exemple.fr' };
const COMPTE = { vinted_user_id: '900000001', login: 'compte-de-banc', access_token: 'x', refresh_token: 'x', csrf_token: 'x', updated_at: new Date().toISOString() };

let ko = 0;
const dit = (bon, quoi, detail) => { if (!bon) ko++; console.log(`  ${bon ? '✅' : '❌'} ${quoi}${detail ? ' — ' + detail : ''}`); };
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const jwt = () => `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u({ sub: USER.id, email: USER.email, aal: 'aal1', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;

// Le serveur du build. `cssPerime` : la première demande du CSS de l'app répond
// 404 (le fichier d'un déploiement d'avant a disparu), les suivantes 200.
const etatSrv = { cssPerime: false, cssRefus: 0, pages: 0 };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) { f = '/index.html'; etatSrv.pages++; }
  if (etatSrv.cssPerime && /^\/assets\/App-.*\.css$/.test(f) && etatSrv.cssRefus === 0) { etatSrv.cssRefus++; r.writeHead(404); return r.end('disparu'); }
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end('nope'); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' }); r.end(fs.readFileSync(p));
});
const ecouter = () => new Promise((res, rej) => {
  srv.once('error', (e) => rej(e.code === 'EADDRINUSE' ? new Error(`le port ${PORT} est déjà pris — relance ce banc seul`) : e));
  srv.listen(PORT, () => res());
});

// mode du renouvellement : 'ok' · 'reseau' (coupure) · 'refus' (400 invalid_grant)
async function brancher(ctx, st) {
  await ctx.route('**/auth/v1/**', async (route) => {
    const rq = route.request(), u = new URL(rq.url()), chemin = u.pathname.replace(/^.*\/auth\/v1\//, '');
    const json = (status, d) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (rq.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (chemin === 'settings') return json(200, { external: {}, mailer_autoconfirm: true });
    if (chemin === 'token' && u.searchParams.get('grant_type') === 'refresh_token') {
      st.refresh++;
      if (st.mode === 'reseau') return route.abort('internetdisconnected');
      if (st.mode === 'refus') return json(400, { error: 'invalid_grant', error_description: 'Invalid Refresh Token: Refresh Token Not Found' });
      return json(200, { access_token: jwt(), refresh_token: 'r-neuf-' + st.refresh, expires_in: 3600, token_type: 'bearer', user: { id: USER.id, email: USER.email } });
    }
    if (chemin === 'user') return json(200, { id: USER.id, email: USER.email });
    if (chemin === 'logout') return route.fulfill({ status: 204 });
    return json(404, { msg: 'banc : ' + chemin });
  });
  await ctx.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(route.request().url());
    const json = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': '0-0/0' }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return json([]);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return json([COMPTE]);
    return json([]);
  });
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await ctx.route('**://*.vinted.net/**', (r) => r.abort());
}
const sessionRangee = (expiresAt) => ({ access_token: jwt(), refresh_token: 'r-ancien', expires_at: expiresAt, user: { id: USER.id, email: USER.email }, totp: [] });
const ecranConnexion = (pg) => pg.evaluate(() => !!document.querySelector('input[type=password]'));
const sessionPresente = (pg) => pg.evaluate(() => { try { return !!JSON.parse(localStorage.getItem('vrm_session') || 'null'); } catch (_) { return false; } });

async function main() {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.log('❌ dist/ absent — lance `npm run build` d\'abord'); process.exit(1); }
  await ecouter();
  const nav = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader'] });
  try {
    for (const taille of [390, 1512]) {
      console.log(`\n── ${taille} px`);
      const opts = taille === 390 ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1512, height: 950 } };
      // A / B : jeton expiré à l'ouverture.
      for (const mode of ['reseau', 'refus']) {
        const ctx = await nav.newContext(opts); const st = { mode, refresh: 0 };
        await brancher(ctx, st);
        await ctx.addInitScript((s) => { try { if (!sessionStorage.getItem('_banc')) { localStorage.setItem('vrm_session', s); localStorage.setItem('vrm_schema_cloisonne', '1'); sessionStorage.setItem('_banc', '1'); } } catch (_) {} }, JSON.stringify(sessionRangee(Date.now() - 3600 * 1000)));
        const pg = await ctx.newPage();
        await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        await pg.waitForTimeout(5000);
        const conn = await ecranConnexion(pg), garde = await sessionPresente(pg);
        if (mode === 'reseau') {
          dit(st.refresh >= 1 && st.refresh <= 3, 'A. jeton expiré : le renouvellement est tenté, sans rafale', `${st.refresh} demande(s) en 5 s`);
          dit(!conn && garde, 'A. coupure réseau au renouvellement : PAS déconnecté', `écran de connexion=${conn}, session gardée=${garde}`);
        } else {
          dit(conn && !garde, 'B. renouvellement REFUSÉ : retour à l\'écran de connexion', `écran de connexion=${conn}, session gardée=${garde}`);
        }
        await ctx.close();
      }
      // C : au réveil, un jeton qui expire est renouvelé tout de suite. Le VRAI
      // temps (une horloge simulée fait tourner la minuterie de 4 min et rend le
      // contrôle vert sur le code d'avant) : la session expire dans 95 s, on
      // attend qu'il en reste moins de 60, puis l'onglet revient au premier plan.
      {
        const ctx = await nav.newContext(opts); const st = { mode: 'ok', refresh: 0 };
        await brancher(ctx, st);
        await ctx.addInitScript((s) => { try { if (!sessionStorage.getItem('_banc')) { localStorage.setItem('vrm_session', s); localStorage.setItem('vrm_schema_cloisonne', '1'); sessionStorage.setItem('_banc', '1'); } } catch (_) {} }, JSON.stringify(sessionRangee(Date.now() + 95 * 1000)));
        const pg = await ctx.newPage();
        await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        await pg.waitForTimeout(37000);
        const avant = st.refresh;
        await pg.evaluate(() => { window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); });
        await pg.waitForTimeout(1500);
        dit(st.refresh >= 1, 'C. au réveil avec un jeton qui expire, le renouvellement part tout de suite (pas à la minuterie de 4 min)', `${avant} avant le réveil → ${st.refresh} après`);
        await ctx.close();
      }
      // D : morceau de l'app disparu après un déploiement.
      {
        const ctx = await nav.newContext(opts); const st = { mode: 'ok', refresh: 0 };
        await brancher(ctx, st);
        await ctx.addInitScript((s) => { try { localStorage.setItem('vrm_session', s); localStorage.setItem('vrm_schema_cloisonne', '1'); } catch (_) {} }, JSON.stringify(sessionRangee(Date.now() + 30 * 60 * 1000)));
        etatSrv.cssPerime = true; etatSrv.cssRefus = 0; etatSrv.pages = 0;
        const pg = await ctx.newPage();
        let navigations = 0;
        pg.on('domcontentloaded', () => { navigations++; });
        await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        await pg.waitForTimeout(7000);
        const txt = await pg.evaluate(() => document.body.innerText);
        console.log('     (texte rendu : ' + JSON.stringify(txt.slice(0, 160)) + ')');
        const tombe = /pas pu s'afficher|Unable to preload|Recharger/i.test(txt);
        dit(etatSrv.cssRefus === 1, 'D. le CSS d\'un ancien déploiement a bien été refusé une fois', `${etatSrv.cssRefus}`);
        dit(navigations === 2, 'D. la page s\'est rechargée UNE fois (pas zéro, pas en boucle)', `${navigations} chargement(s)`);
        const css = await pg.evaluate(() => [...document.styleSheets].some((f) => { try { return /\/assets\/App-.*\.css/.test(f.href || '') && f.cssRules.length > 0; } catch (_) { return false; } }));
        dit(!tombe && txt.length > 300 && css, 'D. l\'app s\'affiche AVEC sa feuille de style après le rechargement', `${txt.length} caractères, feuille de style ${css ? 'chargée' : 'ABSENTE (page sans mise en forme)'}`);
        etatSrv.cssPerime = false;
        await ctx.close();
      }
    }
  } finally { await nav.close(); srv.close(); }
  console.log(ko ? `\n❌ ${ko} contrôle(s) en échec` : '\n✅ tout est vert');
  process.exit(ko ? 1 : 0);
}
main().catch((e) => { console.error('❌ le banc est tombé :', e.message); process.exit(1); });
