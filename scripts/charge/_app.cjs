// ════════════════════════════════════════════════════════════════════════════
//  LE DÉMARRAGE DE L'APP, k VENDEURS EN MÊME TEMPS (scripts/charge/banc-charge.cjs)
//  `dist/` servi en local (gzip), Chromium headless (/opt/pw-browsers), un
//  contexte par vendeur avec SA session (`jeton-<owner>` : la base ne lui rend
//  que ses lignes, RLS). Les lectures `/rest/v1/` et `/auth/v1/` vont au faux
//  PostgREST (dans le processus) ; `/api/**` répond `{}` sauf la porte de
//  confidentialité (`{ok:true, uid}`, ce que répond un serveur sain) ; TOUTE
//  autre URL qui n'est pas locale est coupée (aucun appel ne sort).
//  Mesuré par vendeur : « prêt » (`[data-attente]` = pret|plafond, écran de
//  démarrage parti), lectures, écritures, Ko lus, puis « calme » (3 s sans lecture).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), http = require('http'), zlib = require('zlib');
const RACINE = process.env.AUDIT_RACINE || path.join(__dirname, '..', '..');
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

function servirDist(dist) {
  const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/json', '.json': 'application/json', '.woff2': 'font/woff2' };
  const srv = http.createServer((q, r) => {
    let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
    const p = path.join(dist, path.normalize(f).replace(/^(\.\.[/\\])+/, ''));
    if (!p.startsWith(dist) || !fs.existsSync(p)) { r.writeHead(404); return r.end(); }
    const t = types[path.extname(p)] || 'application/octet-stream'; const b = fs.readFileSync(p);
    if (/javascript|css|html|json|svg/.test(t)) { r.writeHead(200, { 'content-type': t, 'content-encoding': 'gzip' }); r.end(zlib.gzipSync(b)); }
    else { r.writeHead(200, { 'content-type': t }); r.end(b); }
  });
  return new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok({ srv, port: srv.address().port })));
}

// `reprise` : l'onglet est ouvert DEUX fois dans le même navigateur (le cas de
// tous les jours : un appareil où il a déjà ouvert VRM) ; la 2e ouverture est rendue.
async function unDemarrage(navigateur, B, owner, port, onglet, reprise) {
  const ctx = await navigateur.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  if (reprise) await ouvrir(ctx, B, owner, port, onglet, false);
  const r = await ouvrir(ctx, B, owner, port, onglet, !!reprise);
  await ctx.close();
  return r;
}
async function ouvrir(ctx, B, owner, port, onglet, deja) {
  const session = { access_token: B.jeton(owner), refresh_token: 'r', expires_at: Date.now() + 864e5, totp: [], user: { id: owner, email: `vendeur-${owner.slice(0, 8)}@exemple.invalid`, totp: [] } };
  if (!deja) await ctx.addInitScript(([s]) => {
    try {
      if (localStorage.getItem('vrm_session')) return;
      localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_local_owner', s.user.id);
      localStorage.setItem('vrm_bienvenue_vue', '{"at":"banc"}'); localStorage.setItem('vrm_visite_vue', '{"at":"banc"}');
      localStorage.setItem('vrm_visite_bulles_vue', '1'); localStorage.setItem('vrm_conseils_appareil', 'coupes');
    } catch (_) {}
  }, [session]);
  const pg = await ctx.newPage();
  const reqs = []; const t0 = Date.now();
  // Ordre : la DERNIÈRE route enregistrée passe la première (§6.6).
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => { reqs.push({ t: Date.now() - t0, m: 'EXT', u: r.request().url(), o: 0 }); return r.abort(); });
  await pg.route('**/api/**', (r) => {
    const u = r.request().url();
    if (/mode=confidentialite/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, uid: owner }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  const servir = async (route) => {
    const rq = route.request();
    const u = rq.url().replace(/^https?:\/\/[^/]+/, '');
    const h = await rq.allHeaders();
    const rep = await B.repondre({ url: u, method: rq.method(), headers: h, body: rq.postData(), route: 'app' });
    reqs.push({ t: Date.now() - t0, m: rq.method(), u, o: Buffer.byteLength(rep.texte) });
    return route.fulfill({ status: rep.status, contentType: 'application/json', headers: { ...rep.headers, 'access-control-expose-headers': 'content-range' }, body: rep.texte });
  };
  await pg.route('**/rest/v1/**', servir);
  await pg.route('**/auth/v1/**', servir);
  await pg.goto(`http://127.0.0.1:${port}/?tab=${onglet}`, { waitUntil: 'commit' });
  let tPret = null, etat = '';
  const fin = t0 + 90000;
  while (Date.now() < fin) {
    etat = await pg.evaluate(() => { const d = document.getElementById('vrm-demarrage'); const ae = document.querySelector('[data-attente]'); return (d ? 'D' : '') + (ae ? ae.getAttribute('data-attente') : '-'); }).catch(() => '?');
    if (etat === 'pret' || etat === 'plafond') { tPret = Date.now() - t0; break; }
    await attendre(100);
  }
  let n = reqs.length, tCalme = Date.now();
  while (Date.now() - tCalme < 3000 && Date.now() < fin + 30000) { await attendre(250); if (reqs.length !== n) { n = reqs.length; tCalme = Date.now(); } }
  const lec = reqs.filter((r) => r.m === 'GET');
  if (process.env.CHARGE_SONDE) console.log('SONDE', await pg.evaluate(() => JSON.stringify({ lies: localStorage.getItem('vrm_comptes_lies'), proprio: localStorage.getItem('vrm_local_owner'), cles: Object.keys(localStorage).length })).catch((e) => String(e)));
  const res = { owner: owner.slice(0, 8), etat, pret_ms: tPret, calme_ms: tCalme - t0, lectures: lec.length, ecritures: reqs.filter((r) => r.m !== 'GET' && r.m !== 'EXT').length,
    Ko: Math.round(lec.reduce((a, r) => a + r.o, 0) / 1024), externes_coupes: reqs.filter((r) => r.m === 'EXT').length };
  await pg.close();
  return res;
}

async function demarrages(B, k, { onglet = 'journee', reprise = true } = {}) {
  const dist = path.join(RACINE, 'dist');
  if (!fs.existsSync(path.join(dist, 'index.html'))) return { scenario: 'app', saute: 'dist/ absent — lancer `npm run build`' };
  const { chromium } = require(path.join(RACINE, 'node_modules', 'playwright'));
  const exe = ['/opt/pw-browsers/chromium', process.env.VRM_CHROMIUM_PATH].filter(Boolean).find((x) => { try { return fs.statSync(x).isFile() || fs.statSync(x).isDirectory(); } catch (_) { return false; } });
  const navigateur = await chromium.launch({ executablePath: exe && fs.statSync(exe).isFile() ? exe : undefined, args: ['--no-sandbox', '--use-angle=swiftshader'] });
  const { srv, port } = await servirDist(dist);
  try {
    const owners = B.owners.slice(0, k);
    const res = await Promise.all(owners.map((o) => unDemarrage(navigateur, B, o, port, onglet, reprise)));
    const pr = res.map((r) => r.pret_ms).filter((x) => x != null).sort((a, b) => a - b);
    return { scenario: `app (${onglet}, ${reprise ? '2e ouverture' : '1re ouverture'}, ${k} en même temps)`, appels: k, erreurs: res.filter((r) => r.pret_ms == null).length,
      p50_ms: pr[Math.floor(pr.length / 2)] ?? null, max_ms: pr[pr.length - 1] ?? null,
      lectures_par_ouverture: +(res.reduce((a, r) => a + r.lectures, 0) / k).toFixed(1), ecritures_par_ouverture: +(res.reduce((a, r) => a + r.ecritures, 0) / k).toFixed(1),
      Ko_par_ouverture: Math.round(res.reduce((a, r) => a + r.Ko, 0) / k), externes_coupes: res.reduce((a, r) => a + r.externes_coupes, 0), detail: res,
      familles: Object.entries(B.compteurs.parFamille).sort((a, b) => b[1].sortis - a[1].sortis).slice(0, 8).map(([f, v]) => `${f} ${v.n}× ${Math.round(v.sortis / 1024)} Ko`) };
  } finally { await navigateur.close(); srv.close(); }
}
module.exports = { demarrages };
