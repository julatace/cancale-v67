// ── BANC : LA CARTE D'UN COLIS À RETIRER (16 oct.) ─────────────────────────
// Julien : « le bouton À retirer rentre dans le code de retrait ». Mesuré : le
// bouton « J'ai retiré » était posé en absolu dans le coin de la carte et, sur
// ordinateur, le code (au bout de la ligne) passait dessous. Données
// INVENTÉES. Exige : aucun recouvrement aux trois largeurs, code copié tel quel
// avec son zéro de tête.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4381);

const MAINTENANT = Date.now();
const ilYa = (j) => new Date(MAINTENANT - j * 86400000).toISOString();

// Un achat déposé en point relais, son code (avec un ZÉRO DE TÊTE) et son lieu.
const ACHATS = [
  { transaction_id: 9301, conversation_id: 7001, title: 'Nike Air Max 90 blanche taille 43', price: { amount: '38', currency_code: 'EUR' },
    status: 'Colis déposé en point relais', transaction_user_status: 'needs_action', date: ilYa(4) },
];
const RELAIS = { '9301': { code: '012345', lieu: 'Phone Cash, 12 rue du Port, 35260 Cancale', transporteur: 'mondialrelay', at: new Date(MAINTENANT).toISOString() } };
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', updated_at: new Date(MAINTENANT).toISOString() }];
const ROWS = [
  { id: 'main', data: {} },
  { id: 'panel_colis_relais', data: RELAIS },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: new Date(MAINTENANT).toISOString(), payload: { my_orders: ACHATS } } },
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

async function preparer(b, vp, opts = {}) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}), permissions: opts.clavierRefuse ? [] : ['clipboard-read', 'clipboard-write'] });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  if (opts.clavierRefuse) await pg.addInitScript(() => { try { Object.defineProperty(navigator, 'clipboard', { configurable: true, get: () => ({ writeText: () => Promise.reject(new DOMException('refusé', 'NotAllowedError')) }) }); } catch (_) {} });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: new Date(MAINTENANT).toISOString(), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs };
}


async function main() {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 780 }, { width: 1512, height: 950 }, { width: 1024, height: 800 }]) {
      const T = vp.width + 'px';
      await essaie(T, async () => {
        const { ctx, pg, errs } = await preparer(b, vp);
        await pg.goto(`http://localhost:${PORT}/?tab=cat_achats`, { waitUntil: 'domcontentloaded' });
        await pg.locator('.vrm-pickup-code').first().waitFor({ timeout: 12000 });
        const m = await pg.evaluate(() => {
          const c = document.querySelector('.vrm-pickup-code'), k = document.querySelector('.vrm-pickup-collect');
          const r = (e) => e && e.getBoundingClientRect();
          const a = r(c), z = r(k);
          const croise = a && z && !(a.right <= z.left || z.right <= a.left || a.bottom <= z.top || z.bottom <= a.top);
          const carte = c && c.closest('.vrm-pickup-card'); const rc = carte && carte.getBoundingClientRect();
          const tr = document.querySelector('[data-relais-transporteur]'), ad = document.querySelector('[data-relais-adresse]');
          return { tr: tr ? tr.getAttribute('data-relais-transporteur') + '|' + tr.innerText : '', ad: ad ? ad.innerText : '', badgeV: !!document.querySelector('.vrm-pickup-point [title="Vinted Go"]'), code: c && c.querySelector('strong').textContent, croise, dedans: !!(rc && z && z.right <= rc.right + 1 && a.right <= rc.right + 1), txt: carte ? carte.innerText : '' };
        });
        dit(/^mondialrelay\|Mondial Relay/.test(m.tr) && !m.badgeV, `${T} le transporteur nommé par la conversation est dit (jamais « Vinted Go » en dur)`, m.tr);
        dit(/12 rue du Port, 35260 Cancale/.test(m.ad), `${T} l’adresse du point relais est écrite en entier`, m.ad);
        dit(m.code === '012345', `${T} le code garde son zéro de tête`, m.code);
        dit(m.croise === false, `${T} « J’ai retiré » ne recouvre pas le code de retrait`);
        dit(m.dedans, `${T} le code et le bouton restent dans la carte`);
        await pg.locator('.vrm-pickup-code').first().click();
        await pg.waitForTimeout(250);
        let presse = ''; try { presse = await pg.evaluate(() => navigator.clipboard.readText()); } catch (_) {}
        dit(presse === '012345', `${T} un tap sur le code le copie tel quel (zéro compris)`, presse);
        if (process.env.SHOTS) await pg.screenshot({ path: path.join(process.env.SHOTS, `retrait-carte-${vp.width}.png`) });
        dit(!errs.length, `${T} aucune erreur d’app`, errs[0]);
        await ctx.close();
      });
    }
  } finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ carte de retrait : ${ko} rouge(s).` : `\n✅ carte de retrait : tout est vert`);
  process.exit(ko ? 1 : 0);
}
main();
