// Banc : LE BOUTON « RELIER » RESTE DANS SA CARTE (11 nov., lot suivi-commandes — défaut vu par DJ3).
// Une vente « à expédier » dont le bordereau n'a pas de N° porte « Relier » (relier le bordereau à un article
// numéroté). À 1512 px il dépassait du bas de la carte. Jugé sur les rectangles : chaque bouton de la rangée
// d'actions est DANS sa carte [data-bord-card], à 390 tactile et 1512, clair et sombre. Données INVENTÉES.
// Lancer : construire dist/, puis node scripts/bancs/colis-relier-carte.cjs   (BANC_PORT 9072, SHOTS=dossier)
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT || 9072);
const SHOTS = process.env.SHOTS || '';
const maintenant = new Date('2026-11-11T11:00:00Z');   // midi à Paris
const MS = maintenant.getTime(), J = 864e5, H = 36e5;
const iso = (t) => new Date(t).toISOString();
const ilYa = (j) => iso(MS - j * J);
// « hier 18:02 » à Paris = 17:02 UTC le 10 nov.
const HIER_1802 = Date.parse('2026-11-10T17:02:00Z');
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: iso(MS) }];
const TITRE = 'Nike Dunk Low Panda 42';
const PDF_B64 = fs.readFileSync(path.join(__dirname, 'bordereau-test.b64'), 'utf8').trim();
// Deux ventes « à expédier » dont le bordereau n'a PAS de N° (rien de numéroté) ⇒ « Relier ».
const V = [{ tx: 9601, suivi: 'XW600000001TS' }, { tx: 9602, suivi: 'XW600000002TS' }];
const lignes = () => [
  { id: 'main', data: { vinted_used_numeros: [], vinted_annonce_numeros: {} } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: iso(MS - 600e3), payload: { my_orders: V.map((v) => ({ transaction_id: v.tx, title: TITRE, price: { amount: '80.0', currency_code: 'EUR' }, status: 'Bordereau d’envoi envoyé au vendeur', transaction_user_status: 'needs_action', date: ilYa(1) })) } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: iso(MS - 600e3), payload: { my_orders: [] } } },
  ...V.map((v) => ({ id: 'email_bord_' + v.tx, data: { transaction: String(v.tx), uid: '111', filename: `bordereau-${v.tx}.pdf`, modele: TITRE, article: TITRE, receivedAt: ilYa(0.8), pdfB64: PDF_B64, suivi: v.suivi } })),
];
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 160)); } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.mjs': 'text/javascript' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'updated_at') { out[alias] = iso(MS); continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' && typeof v !== 'object' ? String(v) : v);
  }
  return out;
};
async function ouvrir(b, vp, { panne = false, tab = 'cat_bord', sombre = false } = {}) {
  const tel = vp.width < 600;
  const ctx = await b.newContext({ viewport: vp, ...(tel ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}), colorScheme: sombre ? 'dark' : 'light' });
  try { await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: `http://localhost:${PORT}` }); } catch (_) {}
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const LIGNES = lignes();
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript(({ m, sombre, coche }) => {
    try {
      localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', JSON.stringify(true));
      localStorage.setItem('vinted_dark', JSON.stringify(!!sombre));
      localStorage.setItem('vinted_annonce_numeros', JSON.stringify(m.vinted_annonce_numeros)); localStorage.setItem('vinted_used_numeros', JSON.stringify(m.vinted_used_numeros));
      
    } catch (_) {}
  }, { m: LIGNES[0].data, sombre, coche: MS - 4 * J });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font', 'script'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const h = { 'access-control-allow-origin': '*' };
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: h, body: JSON.stringify(d) });
    if (req.method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: h, body: '[]' });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: h, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    if (panne && /id=like\.depart_/.test(u)) return route.fulfill({ status: 503, contentType: 'text/html', headers: h, body: '<html>503</html>' });
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: r.data.capturedAt || iso(MS), cap: r.data.capturedAt });
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(','); return j(LIGNES.filter((r) => ids.includes(r.id)).map(forme)); }
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  ctx.on('page', (p) => { if (p !== pg) p.close().catch(() => {}); });
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs, tel };
}
const onglet = async (pg, v) => {
  await pg.click(`[data-colis-onglet-choix="${v}"]`).catch(() => {});
  await pg.waitForFunction((x) => { const e = document.querySelector('[data-colis-onglet]'); return e && e.getAttribute('data-colis-onglet') === x; }, v, { timeout: 8000 }).catch(() => {});
  await pg.waitForTimeout(800);
};
const shot = async (pg, nom) => { if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, nom + '.png'), fullPage: true }); };
const sain = async (pg, ecran) => {
  const r = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, t: document.body.innerText }));
  dit(r.sw <= r.cw + 1, `${ecran} : aucun débordement horizontal`, `${r.sw} > ${r.cw}`);
  const m = /n'a pas pu s'afficher|n’a pas pu s’afficher|Cannot access|is not defined/.exec(r.t);
  dit(!m, `${ecran} : l'écran n'est pas tombé sur le garde-fou`, m && m[0]);
};
const lireSuivis = (pg) => pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-suivi-commande]')].map((x) => [x.getAttribute('data-suivi-commande'), {
  n: x.getAttribute('data-suivi-n'), src: x.getAttribute('data-suivi-source'), inc: x.getAttribute('data-suivi-incoherence') || '',
  texte: (x.querySelector('[data-suivi-texte]') || {}).innerText || '', lu: (x.querySelector('[data-suivi-lu]') || {}).innerText || '',
  lien: (x.querySelector('[data-suivi-lien]') || { getAttribute: () => '' }).getAttribute('href') || '',
}])));

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      for (const sombre of [false, true]) {
        const k = `${vp.width}-${sombre ? 'sombre' : 'clair'}`;
        console.log(`── ${k}`);
        const { ctx, pg, errs } = await ouvrir(b, vp, { sombre });
        await essaie('À envoyer', async () => {
          await pg.waitForSelector('[data-colis-onglet-choix]', { timeout: 30000 });
          await onglet(pg, 'envoyer');
          await pg.waitForSelector('[data-bord-card] [data-geste="relier"]', { timeout: 20000, state: 'visible' }).catch(() => {});
          await pg.waitForTimeout(800);
          const R = await pg.evaluate(() => [...document.querySelectorAll('[data-bord-card]')].map((c) => {
            const rc = c.getBoundingClientRect();
            const bs = [...c.querySelectorAll('button, a')].filter((x) => x.offsetParent && x.getBoundingClientRect().height > 0 && !x.closest('[data-plus-menu],.vrm-fu-plus-menu'));
            const hors = bs.filter((x) => { const r = x.getBoundingClientRect(); return r.bottom > rc.bottom + 0.5 || r.top < rc.top - 0.5 || r.right > rc.right + 0.5 || r.left < rc.left - 0.5; })
              .map((x) => `${(x.innerText || x.getAttribute('aria-label') || '').trim().slice(0, 20)} (${Math.round(x.getBoundingClientRect().bottom - rc.bottom)} px)`);
            const rel = c.querySelector('[data-geste="relier"]');
            return { id: c.getAttribute('data-colis-ident') || '', relier: !!(rel && rel.offsetParent), hors };
          }));
          dit(R.length >= 2 && R.every((x) => x.relier), 'chaque carte porte « Relier » (bordereau sans N°)', JSON.stringify(R.map((x) => [x.id, x.relier])));
          dit(R.length >= 2 && R.every((x) => x.hors.length === 0), 'aucun bouton ne dépasse de sa carte', JSON.stringify(R.filter((x) => x.hors.length)));
          await pg.evaluate(() => { const e = document.querySelector('[data-bord-card]'); if (e) e.scrollIntoView({ block: 'center' }); });
          if (process.env.DIAG) console.log(await pg.evaluate(() => { const c = document.querySelector('[data-bord-card]'); const a = c.querySelector('.vrm-colis-actions'); const r = c.querySelector('[data-geste="relier"]'); const cs = (e) => { const s = getComputedStyle(e); return { h: e.getBoundingClientRect().height, top: Math.round(e.getBoundingClientRect().top), bottom: Math.round(e.getBoundingClientRect().bottom), height: s.height, maxH: s.maxHeight, ov: s.overflow, disp: s.display, pos: s.position, mt: s.marginTop, mb: s.marginBottom, ai: s.alignItems }; }; return JSON.stringify({ carte: cs(c), actions: cs(a), relier: cs(r), parent: cs(r.parentElement), gridrows: getComputedStyle(c).gridTemplateRows, enfants: [...c.children].map((x) => x.className + ':' + Math.round(x.getBoundingClientRect().height)) }); }));
          await shot(pg, `colis-relier-carte-${k}`);
          await sain(pg, 'Ventes · À envoyer');
        });
        dit(errs.length === 0, 'aucune erreur de page', errs.join(' | ').slice(0, 200));
        await ctx.close();
      }
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ « Relier » dans sa carte : ${ko} rouge(s) sur ${ok + ko}` : `\n✅ « Relier » dans sa carte : ${ok} verts`);
  process.exit(ko ? 1 : 0);
})();
srv.listen(PORT);
