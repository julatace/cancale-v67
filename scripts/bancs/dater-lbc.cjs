// Banc : dater une vente Leboncoin à la main (29 octobre).
// Données INVENTÉES. Exige, à 390 px (tactile) et à 1512 px :
//   1. une vente Leboncoin finalisée SANS date de vente est proposée à dater
//      (`data-dater-lbc`) ; celle que l'extension a datée ne l'est pas ;
//   2. avant : elle n'est dans aucune période (Vendu et Finalisé du mois = 0) ;
//   3. la date tapée (aujourd'hui) est rangée dans `vrm_lbc_dates` et la vente
//      entre dans son mois : Vendu et Finalisé du mois = 60 € ;
//   4. une date tapée pour une vente DÉJÀ datée par l'extension ne la déplace
//      jamais (l'extension gagne) : la vente du mois dernier reste au mois dernier ;
//   5. une date dans l'avenir est refusée, et dite.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4581;
const CAPT = process.env.CAPTURES || os.tmpdir();
const auj = new Date();
const p2 = (n) => String(n).padStart(2, '0');
const AUJ = `${auj.getFullYear()}-${p2(auj.getMonth() + 1)}-${p2(auj.getDate())}`;
const moisDernier = new Date(auj.getFullYear(), auj.getMonth() - 1, 15, 12).toISOString();
const DEMAIN = (() => { const d = new Date(auj.getTime() + 86400000); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; })();
const LBC = { ventes: {
  L1: { txId: 'L1', itemId: '501', isSeller: true, price: 6000, stepStatus: 'done', title: 'Samba à dater' },
  L2: { txId: 'L2', itemId: '502', isSeller: true, price: 8000, stepStatus: 'done', dateVente: moisDernier, title: 'Gazelle datée par extension' },
} };
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];
const rows = [
  { id: 'lbc_ventes', data: LBC },
  { id: 'ebay_orders', data: { orders: [] } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: auj.toISOString(), payload: { my_orders: [] } } },
];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);

const ecritures = [];
const brancher = async (pg) => {
  await pg.route('**/rest/v1/**', async (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) }).catch(() => {});
    if (req.method() === 'POST' || req.method() === 'PATCH') { try { ecritures.push(JSON.parse(req.postData() || 'null')); } catch (_) {} return j([]); }
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || '';
    const forme = (r) => {
      if (/^[a-z]+:data->[a-z]+$/i.test(sel)) { const [al, src] = sel.split(':'); return { [al]: (r.data || {})[src.split('->')[1]] }; }
      if (/^[a-z]+:data->/i.test(sel)) {
        const o = {};
        for (const champ of sel.split(',')) { const m = /^([a-z]+):data->(.+)$/i.exec(champ); if (!m) continue; let v = r.data; for (const p of m[2].split(/->>?/)) v = v == null ? v : v[p]; o[m[1]] = (v != null && /->>/.test(m[2])) ? String(v) : v; }
        return o;
      }
      return { ...r, updated_at: auj.toISOString(), cap: r.data.capturedAt };
    };
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
};

const lire = (pg) => pg.evaluate(() => {
  const num = (v) => (v == null || v === '') ? null : Number(v);
  const ca = {}; for (const e of document.querySelectorAll('[data-ca-cur]')) ca[e.getAttribute('data-ca-cur')] = num(e.getAttribute('data-ca-eur'));
  const d = document.querySelector('[data-dater-lbc]');
  const al = document.querySelector('[data-dater-lbc] [role="alert"]');
  return { etat: (document.querySelector('[data-ca-periode]') || { getAttribute: () => null }).getAttribute('data-ca-etat'), ca,
    n: d ? Number(d.getAttribute('data-dater-lbc')) : 0,
    txs: [...document.querySelectorAll('[data-dater-lbc-tx]')].map((e) => e.getAttribute('data-dater-lbc-tx')),
    alerte: al ? al.innerText : '',
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
});
const attendre = async (pg, f, ms = 8000) => { const t0 = Date.now(); for (;;) { const r = await lire(pg); if (f(r) || Date.now() - t0 > ms) return r; await pg.waitForTimeout(250); } };
(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      console.log(`── ${vp.width} px`);
      const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
      const pg = await ctx.newPage();
      const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
      // L2 porte déjà une date tapée (aujourd'hui) : l'extension (mois dernier) doit gagner.
      await pg.addInitScript((a) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_lbc_dates', JSON.stringify({ L2: a })); } catch (_) {} }, AUJ);
      await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
      await brancher(pg);
      await pg.goto(`http://localhost:${PORT}/?tab=compta`, { waitUntil: 'domcontentloaded' });
      const r0 = await attendre(pg, (r) => r.etat === 'lu' && r.n > 0);
      dit(r0.n === 1 && r0.txs.join() === 'L1', 'seule la vente sans date est proposée à dater', JSON.stringify(r0.txs));
      dit(r0.ca.vendu === 0 && r0.ca.finalise === 0, 'avant : elle n’est dans aucune période, la vente datée par l’extension reste au mois dernier', JSON.stringify(r0.ca));
      await pg.fill('[data-dater-lbc-tx="L1"] input[type="date"]', DEMAIN);
      await pg.click('[data-dater-lbc-ok="L1"]');
      const r1 = await attendre(pg, (r) => !!r.alerte, 2000);
      dit(/2015/.test(r1.alerte) && r1.ca.vendu === 0, 'une date dans l’avenir est refusée, et dite', r1.alerte);
      await pg.fill('[data-dater-lbc-tx="L1"] input[type="date"]', AUJ);
      await pg.click('[data-dater-lbc-ok="L1"]');
      const r2 = await attendre(pg, (r) => r.ca.vendu === 60, 5000);
      dit(r2.ca.vendu === 60 && r2.ca.finalise === 60, 'après : la vente entre dans son mois (Vendu et Finalisé = 60 €), la Gazelle n’a pas bougé', JSON.stringify(r2.ca));
      await pg.waitForTimeout(1500);
      const st = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_lbc_dates') || 'null'); } catch (_) { return null; } });
      dit(st && st.L1 === AUJ, 'la date est rangée dans `vrm_lbc_dates` (synchronisé)', JSON.stringify(st));
      dit(r2.sw <= r2.cw + 1, 'aucun débordement horizontal', `${r2.sw} / ${r2.cw}`);
      dit(!errs.length, 'aucune erreur d’app', errs.join(' | ').slice(0, 200));
      await pg.screenshot({ path: path.join(CAPT, `dater-lbc-${vp.width}.png`), fullPage: true });
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc s’est déroulé', String(e.message).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `KO  dater-lbc : ${ko} rouge(s)` : 'OK  dater-lbc : tout vert');
  process.exit(ko ? 1 : 0);
})();
