// ── BANC : UN ENDROIT = UN BLOC, ET UN CODE QUI N'EXISTE PAS N'EST PAS PROMIS (17 oct.)
// Julien : « des colis à Vinted Go et d'autres à Kusmi Tea (aussi Vinted Go) »,
// « des fois tu me mets juste un colis dans un point relais sans le code ».
// Formes MESURÉES sur sa base (lecture seule), valeurs INVENTÉES :
//   · email Vinted Go : lieu « *Consigne Vinted Go*, * Kusmi Tea *, * 13 Rue… » ;
//   · conversation (extension) : « Kusmi Tea, 13 Rue Saint-Vincent, 56000 Vannes, France » ;
//   · conversation Mondial Relay lue, lieu connu, code VIDE ;
//   · email Mondial Relay au lieu « ® juste ici ! ».
// Exige : la consigne Kusmi Tea en UN bloc (le colis email ET le colis vu par
// Vinted), Speed Queen dans un AUTRE, aucun astérisque ni slogan affiché, et
// pour le colis Mondial Relay sans code : ni « Voir mon code de retrait », ni
// silence — la phrase qui dit où arrive le code.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4387);

const MAINTENANT = Date.now();
const ilYa = (j) => new Date(MAINTENANT - j * 86400000).toISOString();
const dans = (j) => new Date(MAINTENANT + j * 86400000).toISOString().slice(0, 10);
const RELAIS_ST = "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais";
const ACHATS = [
  { transaction_id: 9401, conversation_id: 7101, title: 'Adidas Samba noire taille 40', price: { amount: '40', currency_code: 'EUR' }, status: RELAIS_ST, transaction_user_status: 'needs_action', date: ilYa(3) },
  { transaction_id: 9402, conversation_id: 7102, title: 'Salomon XT-6 grise taille 42', price: { amount: '70', currency_code: 'EUR' }, status: RELAIS_ST, transaction_user_status: 'needs_action', date: ilYa(3) },
];
const RELAIS = {
  '9401': { code: 'B11111', lieu: 'Kusmi Tea, 13 Rue Saint-Vincent, 56000 Vannes, France', at: new Date(MAINTENANT).toISOString(), url: 'https://www.vinted.fr/inbox/7101' },
  '9402': { code: '', qr: '', lieu: 'PHONE CASH, 17 RUE THIERS, 56000 VANNES', at: new Date(MAINTENANT).toISOString(), url: 'https://www.vinted.fr/inbox/7102' },
};
const track = (id, carrier, lieu, code, suivi) => ({ id, data: { type: 'suivi', carrier, suivi, status: 'available', statusLabel: 'Arrivé au point de retrait', subject: 'Ton colis t\'attend', receivedAt: ilYa(1), code, lieu, limite: dans(4), consigne: carrier === 'vinted' } });
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', updated_at: new Date(MAINTENANT).toISOString() }];
const ROWS = [
  { id: 'main', data: {} },
  { id: 'panel_colis_relais', data: RELAIS },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: new Date(MAINTENANT).toISOString(), payload: { my_orders: ACHATS } } },
  track('email_track_vinted_1790000000000001', 'vinted', '*Consigne Vinted Go*, * Kusmi Tea *, * 13 Rue Saint-Vincent', 'A22222', '1790000000000001'),
  track('email_track_vinted_1790000000000002', 'vinted', '*Consigne Vinted Go*, * Speed Queen - Vannes *, * 24 Rue Hoche', 'N33333', '1790000000000002'),
  track('email_track_mondialrelay_12345678', 'mondialrelay', '® juste ici !', '494400', '12345678'),
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
    for (const vp of [{ width: 390, height: 780 }, { width: 1512, height: 950 }]) {
      const T = vp.width + 'px';
      await essaie(T, async () => {
        const { ctx, pg, errs } = await preparer(b, vp);
        await pg.goto(`http://localhost:${PORT}/?tab=cat_achats`, { waitUntil: 'domcontentloaded' });
        await pg.locator('.vrm-pickup-point').first().waitFor({ timeout: 15000 });
        await pg.waitForTimeout(1500);
        const blocs = await pg.evaluate(() => [...document.querySelectorAll('.vrm-pickup-point')].map((e) => e.innerText));
        const kusmi = blocs.filter((t) => /kusmi tea/i.test(t));
        dit(kusmi.length === 1, `${T} la consigne Kusmi Tea est UN seul bloc (email et conversation)`, `${kusmi.length} bloc(s)`);
        dit(kusmi.length === 1 && /A22222/.test(kusmi[0]) && /B11111/.test(kusmi[0]), `${T} … qui porte les DEUX colis (le code de l'email et celui de la conversation)`);
        const sq = blocs.filter((t) => /speed queen/i.test(t));
        dit(sq.length === 1 && !/kusmi/i.test(sq[0]), `${T} la consigne Speed Queen est un AUTRE bloc`, sq.length + ' bloc(s)');
        const tout = blocs.join('\n');
        dit(!/\*/.test(tout), `${T} aucun astérisque de la version texte ne s'affiche`);
        dit(!/juste ici/i.test(tout), `${T} aucun slogan (« juste ici ») affiché comme lieu`);
        dit(/494400/.test(tout), `${T} … et le colis Mondial Relay au lieu inconnu garde son code`);
        const pc = await pg.evaluate(() => { const c = [...document.querySelectorAll('.vrm-pickup-card')].find((e) => /salomon xt-6 grise/i.test(e.innerText)); return c ? { t: c.innerText, n: !!c.querySelector('[data-colis-sans-code-conv]') } : null; });
        dit(pc && pc.n, `${T} colis lu dans la conversation SANS code : la phrase dit où arrive le code`, pc ? '' : 'carte introuvable');
        dit(pc && !/Voir mon code de retrait/i.test(pc.t), `${T} … et aucun bouton ne promet « Voir mon code de retrait »`, pc ? pc.t.slice(0, 120) : '');
        if (process.env.SHOTS) await pg.screenshot({ path: path.join(process.env.SHOTS, `retrait-lieux-${vp.width}.png`), fullPage: true });
        dit(!errs.length, `${T} aucune erreur d'app`, errs[0]);
        await ctx.close();
      });
    }
  } finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ lieux de retrait : ${ko} rouge(s).` : `\n✅ lieux de retrait : tout est vert`);
  process.exit(ko ? 1 : 0);
}
main();
