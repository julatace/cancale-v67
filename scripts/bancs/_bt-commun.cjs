require('./_porte-banc.cjs');
// ═════════════════════════════════════════════════════════════════════════════
//  OUTILS COMMUNS DES BANCS « BUGS-TOTALE » (22 nov., Julien : « l'app bug beaucoup trop, corrige absolument tout »).
//  Un serveur du build (`BANC_DIST`), un vendeur inventé (base au volume, `_base-volume.cjs`), une vue
//  (tel = 390 tactile, tel-sombre, ordi = 1512, ordi-sombre), le moteur choisi (`NAVIGATEUR=webkit` : Safari).
//  `pire(base)` : la base au PIRE réaliste (break-ui) — titres très longs, emoji, sans photo, sans prix, pseudos
//  longs, montants énormes. Aucune donnée réelle : tout est fabriqué ici.
// ═════════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs'), http = require('http');
const pw = require('playwright');
const { lancer } = require('./_navigateur.cjs');
const { fabriquer, repondre } = require('./_base-volume.cjs');
const R = path.join(__dirname, '..', '..');
const DIST = process.env.BANC_DIST || path.join(R, 'dist');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.webp': 'image/webp', '.ico': 'image/x-icon', '.wasm': 'application/wasm', '.mjs': 'text/javascript' };
const VUES = {
  tel: { W: 390, H: 844, t: true, s: false }, 'tel-sombre': { W: 390, H: 844, t: true, s: true },
  ordi: { W: 1512, H: 950, t: false, s: false }, 'ordi-sombre': { W: 1512, H: 950, t: false, s: true },
};

function serveur() {
  const srv = http.createServer((q, r) => {
    let f = decodeURIComponent((q.url || '/').split('?')[0]); if (f === '/' || !path.extname(f)) f = '/index.html';
    const p = path.join(DIST, f);
    if (!p.startsWith(DIST) || !fs.existsSync(p)) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
  });
  return new Promise((ok) => srv.listen(Number(process.env.BANC_PORT) || 0, () => ok({ srv, ICI: `http://localhost:${srv.address().port}` })));
}

const navigateur = () => lancer(pw, { executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });

// Le pire RÉALISTE (break-ui) : appliqué aux lignes fabriquées, à la même forme.
const LONG = 'Nike Air Max 1 Patta Waves Monarch « The Wave » édition limitée 2021 — boîte d’origine, lacets de rechange';
function pire(base) {
  let i = 0;
  for (const r of base.rows) {
    const p = r.data && r.data.payload;
    const lots = [p && p.items, p && p.my_orders].filter(Array.isArray);
    for (const l of lots) for (const x of l.slice(0, 6)) {
      const k = i++ % 6;
      if (k === 0) x.title = LONG + ' taille 44,5';
      else if (k === 1) x.title = '👟🔥 Jordan 4 Retro « Military Black » 🖤 taille 42';
      else if (k === 2) { x.title = 'Vans'; }
      else if (k === 3) { delete x.photo; }
      else if (k === 4) { x.price = { amount: '12450.0', currency_code: 'EUR' }; }
      else if (k === 5) { x.title = 'Salomon XT-6 Advanced Mindful Ftw White Lunar Rock taille 38 2/3'; }
    }
  }
  for (const a of base.accounts.slice(0, 2)) a.login = 'aleksandra_wisniewska_kowalczyk_sneakers';
  return base;
}

async function ouvrir(nav, nom, base, { erreursIgnorees = null } = {}) {
  const V = VUES[nom];
  const ctx = await nav.newContext({ viewport: { width: V.W, height: V.H }, isMobile: V.t && !/webkit/i.test(process.env.NAVIGATEUR || '') ? true : V.t, hasTouch: V.t, deviceScaleFactor: V.t ? 2 : 1, locale: 'fr-FR', colorScheme: V.s ? 'dark' : 'light', serviceWorkers: 'block' });
  const pg = await ctx.newPage();
  ctx.on('page', (p) => { if (p !== pg) p.close().catch(() => {}); });
  pg.on('dialog', (d) => d.dismiss().catch(() => {}));
  const J = { erreurs: [], lectures: [], ecritures: [] };
  const ign = erreursIgnorees || /Failed to load resource|ERR_INTERNET|net::ERR|favicon|status of 50[23]|preload|ERR_FAILED|Could not connect|access control checks/;
  pg.on('pageerror', (e) => J.erreurs.push('pageerror ' + String(e.message || e).slice(0, 300)));
  pg.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') { const t = m.text(); if (!ign.test(t)) J.erreurs.push(m.type() + ' ' + t.slice(0, 300)); } });
  await pg.addInitScript(([s]) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', s ? 'true' : 'false'); } catch (_) {}
    window.addEventListener('unhandledrejection', (e) => { try { console.error('unhandledrejection ' + String((e.reason && (e.reason.stack || e.reason.message)) || e.reason).slice(0, 240)); } catch (_) {} });
  }, [V.s]);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (/supabase\.co/.test(r.request().url()) ? r.fallback() : r.abort()));
  await pg.route('**/rest/v1/**', async (route) => {
    const rq = route.request(); const url = rq.url();
    J.lectures.push({ m: rq.method(), u: decodeURIComponent(url).replace(/^.*\/rest\/v1\//, ''), t: Date.now() });
    if (rq.method() !== 'GET' && rq.method() !== 'HEAD') { J.ecritures.push(decodeURIComponent(url).replace(/^.*\/rest\/v1\//, '').slice(0, 120)); return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' }).catch(() => {}); }
    const h = await rq.allHeaders().catch(() => ({}));
    const rep = repondre(url, h.range, base);
    return route.fulfill({ status: rep.status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', ...(rep.headers || {}) }, body: JSON.stringify(rep.body) }).catch(() => {});
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: /mode=abonnement/.test(r.request().url()) ? '{"ok":true,"acces":true,"statut":"active","configure":true}' : /mode=equipe/.test(r.request().url()) ? '{"ok":true,"equipe":[],"invitations":[],"membreDe":[],"aBoutique":true}' : '{"pret":true,"devices":1}' }));
  return { ctx, pg, J, V };
}

async function demarrer(pg, ICI, tab = 'journee') {
  await pg.goto(`${ICI}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('.vrm-main, main', { timeout: 60000 }).catch(() => {});
  await pg.waitForFunction(() => { const d = document.getElementById('vrm-demarrage'); return !d || d.hasAttribute('data-sortie') || getComputedStyle(d).opacity === '0'; }, null, { timeout: 60000 }).catch(() => {});
  await pg.waitForTimeout(2500);
}
const aller = async (pg, t, ms = 1800) => { await pg.evaluate((t) => { try { window.dispatchEvent(new CustomEvent('vrm:aller', { detail: '?tab=' + t })); } catch (_) {} }, t); await pg.waitForTimeout(ms); };
const ecranMonte = (pg) => pg.evaluate(() => document.querySelector('#vrm-contenu')?.dataset.ecran || '').catch(() => '');
// Une feuille / un dialogue VISIBLE (pas les hôtes cachés).
const feuilleOuverte = (pg) => pg.evaluate(() => [...document.querySelectorAll('.n-feuille, [role="dialog"], [aria-modal="true"]')].some((e) => { const b = e.getBoundingClientRect(); const s = getComputedStyle(e); return b.width > 40 && b.height > 40 && s.visibility !== 'hidden' && s.display !== 'none' && !e.closest('[hidden],[inert]'); })).catch(() => false);

// Le journal d'un banc : un geste = un verdict (vrai / faux + détail). Un banc ne meurt pas : il rapporte.
function journal(nomBanc) {
  const l = [];
  const dit = (vue, quoi, ok, detail) => { l.push({ vue, quoi, ok: !!ok, detail: detail == null ? '' : String(detail).slice(0, 500) }); console.log(`${ok ? '✅' : '❌'} [${vue}] ${quoi}${detail ? ' — ' + String(detail).slice(0, 300) : ''}`); };
  const fin = (sortie) => { const ko = l.filter((x) => !x.ok).length; if (sortie) fs.writeFileSync(path.join(sortie, `${nomBanc}.json`), JSON.stringify(l, null, 1)); console.log(`\n${nomBanc} : ${l.length - ko} OK / ${ko} KO`); return ko; };
  return { dit, fin, l };
}

module.exports = { VUES, serveur, navigateur, fabriquer, pire, ouvrir, demarrer, aller, ecranMonte, feuilleOuverte, journal, DIST, R };
