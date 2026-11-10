// ── BANC : LOT J (10 nov.) — IMPORT TABLEUR · PARTAGE DEPUIS PHOTOS · GESTES DU « ? » ──
// Données INVENTÉES (aucune fx/). Aux deux tailles (390 tactile, 1512), clair et sombre :
//  • Achats → « Nouvel achat » → « Importer un tableur » : un CSV de 5 lignes (une déjà
//    dans VRM par SA référence, une date illisible) ⇒ l'aperçu dit 3 à importer · 1 déjà là ·
//    1 écartée ; RIEN n'est écrit avant « Importer 3 achats » ; puis son clic écrit les
//    3 achats (prix du fichier) dans `vinted_offvinted_buys`, l'ancien gardé ;
//  • partage : une photo rangée dans la réserve de l'appareil (ce que fait public/sw.js)
//    + `?tab=achats&achat=1&photo=partage` ⇒ « Nouvel achat » ouvert AVEC la photo, rien
//    d'écrit ; la réserve est vidée ;
//  • le « ? » d'Achats ouvre 4 gestes numérotés en tête de la feuille.
// `BANC_PORT` (défaut 4691), `BANC_CAPTURES=dossier`.
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4691);
const CAPTURES = process.env.BANC_CAPTURES || '';

const MAINTENANT = Date.now();
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', updated_at: new Date(MAINTENANT).toISOString() }];
const ANCIEN = { id: 'ob_ancien', title: 'Achat banc déjà saisi', price: '12,00', date: '2026-10-02', source: 'Brocante', ref: 'CMD-555666', createdAt: '2026-10-02T10:00:00Z' };
const ROWS = [
  { id: 'main', data: { vinted_offvinted_buys: [ANCIEN] } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: new Date(MAINTENANT).toISOString(), payload: { my_orders: [] } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: new Date(MAINTENANT).toISOString(), payload: { my_orders: [] } } },
];
const CSV = '\uFEFFDate;Description;Prix payé;Où;N° de commande\r\n'
  + '03/11/2026;Nike Dunk Low banc 42;45,50;Vide-grenier;CMD-111222\r\n'
  + '04/11/2026;Adidas Samba banc 41;30;Magasin;\r\n'
  + '05/11/2026;New Balance 550 banc 43;;Fournisseur;\r\n'
  + '06/11/2026;Doublon banc;20;Brocante;cmd 555 666\r\n'
  + 'hier;Date illisible banc;10;;\r\n';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR42mP8z8BQz0AEYBxVSF8AAKIzB/kvKHJvAAAAAElFTkSuQmCC', 'base64');

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 160)); } };

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  if (f === '/sw.js') { r.writeHead(404); return r.end(); }   // le banc pose lui-même la réserve
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

async function preparer(b, vp, sombre) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const ecrits = [];
  const rows = ROWS.map((r) => ({ id: r.id, data: JSON.parse(JSON.stringify(r.data)) }));
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', s ? 'true' : 'false'); } catch (_) {} }, !!sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') {
      if (/\/rest\/v1\/app_data/.test(u) && req.method() === 'POST') {
        try {
          let corps = JSON.parse(req.postData() || '[]'); if (!Array.isArray(corps)) corps = [corps];
          for (const l of corps) {
            if (!l || !l.id) continue;
            ecrits.push({ id: l.id, data: l.data });
            const ex = rows.find((r) => r.id === l.id); if (ex) ex.data = l.data; else rows.push({ id: l.id, data: l.data });
          }
        } catch (_) {}
      }
      if (/\/rest\/v1\/app_data/.test(u) && req.method() === 'PATCH') {
        const id = (/[?&]id=eq\.([^&]*)/.exec(u) || [])[1];
        let corps = null; try { corps = JSON.parse(req.postData() || 'null'); } catch (_) {}
        const ex = id && rows.find((r) => r.id === id);
        if (ex && corps && corps.data !== undefined) { ecrits.push({ id, data: corps.data }); ex.data = corps.data; return j([{ id }]); }
      }
      return j([]);
    }
    if (/select=owner&limit=1/.test(u)) return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: new Date(MAINTENANT).toISOString(), cap: r.data && r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  const achatsMain = () => { const m = ecrits.filter((e) => e.id === 'main' && Array.isArray((e.data || {}).vinted_offvinted_buys)); return m.length ? m[m.length - 1].data.vinted_offvinted_buys : null; };
  return { ctx, pg, errs, ecrits, achatsMain };
}
const hauteur = (pg, sel) => pg.evaluate((s) => { const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().height) : 0; }, sel);
const deborde = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const capture = async (pg, nom) => { if (!CAPTURES) return; try { await pg.screenshot({ path: path.join(CAPTURES, nom + '.png'), fullPage: false }); } catch (_) {} };

async function main() {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      for (const sombre of [false, true]) {
        const T = (vp.width < 600 ? '📱' : '🖥️') + (sombre ? '🌙' : '☀️');
        const tap = async (pg, sel) => { if (vp.width < 600) await pg.locator(sel).first().tap(); else await pg.locator(sel).first().click(); };
        const suffixe = `${vp.width}-${sombre ? 'sombre' : 'clair'}`;

        // ── Import d'un tableur ────────────────────────────────────────────────
        await essaie(`${T} import`, async () => {
          const { ctx, pg, errs, achatsMain } = await preparer(b, vp, sombre);
          await pg.goto(`http://localhost:${PORT}/?tab=achats&achat=1`, { waitUntil: 'domcontentloaded' });
          await pg.locator('[data-achat-hors-importer]').first().waitFor({ timeout: 15000 });
          dit((await hauteur(pg, '[data-achat-hors-importer]')) >= 44, `${T} « Importer un tableur » ≥ 44 px`);
          await tap(pg, '[data-achat-hors-importer]');
          await pg.locator('[data-import-achats="choisir"]').first().waitFor({ timeout: 5000 });
          dit((await pg.locator('[data-imp-colonne-attendue]').count()) === 6, `${T} les 6 colonnes lues sont montrées`);
          await capture(pg, `import-choisir-${suffixe}`);
          await pg.setInputFiles('[data-imp-fichier]', { name: 'mes-achats.csv', mimeType: 'text/csv', buffer: Buffer.from(CSV, 'utf8') });
          await pg.locator('[data-imp-lignes]').first().waitFor({ timeout: 5000 });
          const r = await pg.evaluate(() => { const e = document.querySelector('[data-imp-ok]'); return e ? [e.dataset.impOk, e.dataset.impDoubles, e.dataset.impEcartees].join('/') : ''; });
          dit(r === '3/1/1', `${T} aperçu : 3 à importer · 1 déjà là (même référence) · 1 écartée`, r);
          const champs = await pg.evaluate(() => [...document.querySelectorAll('[data-imp-col]')].map((s) => s.value).join(','));
          dit(champs === 'date,titre,prix,ou,ref', `${T} colonnes reconnues (« N° de commande » = référence)`, champs);
          dit((await pg.locator('[data-imp-ligne="4"] [data-imp-prix]').getAttribute('data-imp-prix')) === '', `${T} prix vide gardé vide (jamais 0)`);
          dit((await pg.locator('[data-imp-ligne="6"]').getAttribute('data-imp-etat')) === 'ecartee', `${T} date illisible ⇒ écartée`);
          dit((await deborde(pg)) <= 1, `${T} aucun débordement horizontal`);
          await pg.waitForTimeout(1500);
          dit(!((achatsMain() || []).length > 1), `${T} rien n’est écrit avant « Importer »`, String((achatsMain() || []).length));
          await capture(pg, `import-apercu-${suffixe}`);
          dit((await hauteur(pg, '[data-imp-importer]')) >= 44, `${T} « Importer 3 achats » ≥ 44 px`);
          await tap(pg, '[data-imp-importer]');
          await pg.locator('[data-import-achats]').first().waitFor({ state: 'detached', timeout: 5000 });
          await pg.waitForTimeout(1800);
          const L = achatsMain() || [];
          const titres = L.map((a) => a.title + ':' + a.price).sort().join(' | ');
          dit(L.length === 4 && /Nike Dunk Low banc 42:45,50/.test(titres) && /Adidas Samba banc 41:30,00/.test(titres) && /New Balance 550 banc 43: \|/.test(titres) && L.some((a) => a.id === 'ob_ancien'),
            `${T} son clic écrit les 3 achats (prix du fichier), l’ancien gardé`, titres);
          await capture(pg, `import-fait-${suffixe}`);
          dit(errs.length === 0, `${T} aucune erreur de page`, errs.join(' | ').slice(0, 160));
          await ctx.close();
        });

        // ── Partage depuis Photos ──────────────────────────────────────────────
        await essaie(`${T} partage`, async () => {
          const { ctx, pg, errs, ecrits } = await preparer(b, vp, sombre);
          await pg.goto(`http://localhost:${PORT}/manifest.webmanifest`, { waitUntil: 'domcontentloaded' });
          await pg.evaluate(async (b64) => {
            const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
            const c = await caches.open('vrm-hl-partage');
            await c.put('/__vrm_partage_photo', new Response(new Blob([u], { type: 'image/png' }), { headers: { 'content-type': 'image/png', 'x-vrm-partage-at': String(Date.now()) } }));
          }, PNG.toString('base64'));
          await pg.goto(`http://localhost:${PORT}/?tab=achats&achat=1&photo=partage`, { waitUntil: 'domcontentloaded' });
          await pg.locator('[data-achat-hors-form]').first().waitFor({ timeout: 15000 });
          await pg.locator('[data-achat-hors-apercu]').first().waitFor({ timeout: 6000 });
          const src = await pg.locator('[data-achat-hors-apercu]').getAttribute('src');
          dit(/^data:image\/jpeg/.test(src || ''), `${T} « Nouvel achat » s’ouvre avec la photo partagée`);
          dit((await pg.evaluate(() => window.location.search)) === '', `${T} adresse effacée`);
          const reste = await pg.evaluate(async () => !!(await (await caches.open('vrm-hl-partage')).match('/__vrm_partage_photo')));
          dit(!reste, `${T} la photo quitte la réserve une fois lue`);
          await pg.waitForTimeout(1500);
          dit(!ecrits.some((e) => /^achat_hors_photo_/.test(e.id)) && !ecrits.some((e) => e.id === 'main' && ((e.data || {}).vinted_offvinted_buys || []).length > 1), `${T} rien n’est écrit sans son clic`);
          await capture(pg, `partage-${suffixe}`);
          dit(errs.length === 0, `${T} aucune erreur de page`, errs.join(' | ').slice(0, 160));
          await ctx.close();
        });

        // ── Le « ? » d'Achats : les gestes ────────────────────────────────────
        await essaie(`${T} aide`, async () => {
          const { ctx, pg, errs } = await preparer(b, vp, sombre);
          await pg.goto(`http://localhost:${PORT}/?tab=achats`, { waitUntil: 'domcontentloaded' });
          await pg.locator('[data-aide-ouvrir="achats"]').first().waitFor({ timeout: 15000 });
          await tap(pg, '[data-aide-ouvrir="achats"]');
          await pg.locator('[data-aide-etapes]').first().waitFor({ timeout: 5000 });
          const n = await pg.locator('[data-aide-etapes] [data-aide-etape]').count();
          dit(n === 4, `${T} le « ? » d’Achats ouvre 4 gestes numérotés`, String(n));
          const avant = await pg.evaluate(() => { const e = document.querySelector('[data-aide-etapes]'), q = document.querySelector('[data-aide-questions]'); return !!(e && q && (e.compareDocumentPosition(q) & Node.DOCUMENT_POSITION_FOLLOWING)); });
          dit(avant, `${T} les gestes viennent AVANT les questions`);
          dit((await deborde(pg)) <= 1, `${T} aucun débordement horizontal`);
          await pg.waitForTimeout(500);
          await capture(pg, `aide-${suffixe}`);
          dit(errs.length === 0, `${T} aucune erreur de page`, errs.join(' | ').slice(0, 160));
          await ctx.close();
        });
      }
    }
  } finally {
    if (b) await b.close();
    srv.close();
  }
  console.log(ko ? `\n❌ import-partage-aide : ${ko} rouge(s)` : '\n✅ import-partage-aide : tout vert');
  process.exit(ko ? 1 : 0);
}
main().catch((e) => { console.log('KO  ' + (e && e.message)); process.exit(1); });
