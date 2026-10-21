// ── BANC : CODES DE RETRAIT HORS LIGNE (G9) ─────────────────────────────────
// Au point relais, le réseau passe mal. Si la base ne répond pas, l'app bascule
// sur BaseInjoignable — et sans ce chantier, il ne voit plus SES codes. On en
// garde une copie LOCALE : phase 1 (base up) les lit → cache écrit ; phase 2
// (base KO) les affiche depuis le cache. Données INVENTÉES (vit dans le dépôt).
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4376);
const auj = new Date();

const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];
// Un colis à retirer, vu par email transporteur : code 1234, Mondial Relay.
const TRACK = { status: 'available', statusLabel: 'Arrivé au point de retrait', code: '1234',
  lieu: 'Phone Cash Cancale', carrier: 'mondial_relay', suivi: 'MR123456', artTitle: 'Nike Air Max 1',
  receivedAt: auj.toISOString() };
const rows = [
  { id: 'main', data: {} },
  { id: 'email_track_mondial_relay_MR123456', data: TRACK },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: auj.toISOString(), payload: { my_orders: [] } } },
];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 140)); } };

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
srv.listen(PORT);

const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : v;
  }
  return out;
};

async function main() {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      const T = vp.width < 600 ? '📱' : '🖥️';
      await essaie(`${T} hors ligne`, async () => {
        const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
        const pg = await ctx.newPage();
        let baseDown = false;
        await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
        await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
        await pg.route('**/rest/v1/**', (route) => {
          if (baseDown) return route.fulfill({ status: 522, contentType: 'text/html', headers: { 'access-control-allow-origin': '*' }, body: '<html>error</html>' });
          const u = decodeURIComponent(metaVersData(route.request().url()));
          const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
          if (route.request().method() !== 'GET') return j([]);
          if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
          if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
          const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
          const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: auj.toISOString(), cap: r.data.capturedAt });
          const eq = /id=eq\.([^&]*)/.exec(u);
          if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
          const lk = /id=like\.([^&]*)/.exec(u);
          if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
          return j([]);
        });
        await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));

        // ── Phase 1 : base UP, on ouvre « À retirer » → le cache s'écrit ───────
        await pg.goto(`http://localhost:${PORT}/?tab=cat_achats`, { waitUntil: 'domcontentloaded' });
        await pg.waitForTimeout(2500);
        const cache = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_codes_hors_ligne') || 'null'); } catch (_) { return null; } });
        dit(cache && Array.isArray(cache.codes) && cache.codes.some((x) => x.code === '1234'), `${T} phase 1 (base up) : le code 1234 est gardé en local`, cache ? JSON.stringify(cache.codes) : 'pas de cache');

        // ── Phase 2 : base KO, on recharge → BaseInjoignable montre le code ────
        baseDown = true;
        await pg.goto(`http://localhost:${PORT}/?tab=cat_achats`, { waitUntil: 'domcontentloaded' });
        // On attend l'ÉTAT (la panne dite), jamais un délai fixe : sous charge,
        // les trois essais de la sonde de schéma dépassent 2,5 s.
        await pg.waitForFunction(() => /joindre tes données/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
        await pg.waitForTimeout(500);
        const vu = await pg.evaluate(() => {
          const bloc = document.querySelector('[data-codes-hors-ligne]');
          return { base: /Je n’arrive pas à joindre tes données|joindre tes données/.test(document.body.innerText), aBloc: !!bloc, texte: bloc ? bloc.innerText : '' };
        });
        dit(vu.base, `${T} phase 2 : la base est bien injoignable (BaseInjoignable rendu)`);
        dit(vu.aBloc && /1234/.test(vu.texte), `${T} phase 2 : le code 1234 reste affiché HORS LIGNE`, vu.aBloc ? vu.texte.replace(/\s+/g, ' ').slice(0, 90) : 'bloc absent');
        await ctx.close();
      });
    }
  } finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ codes hors ligne : ${ko} rouge(s).` : `\n✅ codes hors ligne : tout est vert`);
  process.exit(ko ? 1 : 0);
}
main();
