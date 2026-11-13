// Banc (12 nov.) : « TOUT IMPRIMER (N) » ET LA FEUILLE DISENT LE MÊME NOMBRE, ET LA FEUILLE DIT POURQUOI.
// Julien : « Tout imprimer (15) » ouvrait « Imprimer (6) » sans dire pourquoi. Le bouton comptait TOUTES les
// lignes du lot (déjà imprimées, anciennes, sans bordereau, eBay) ; la feuille n'imprime que les cochées.
// Une seule source (`resumeLot`, src/lotSelection.js) : le nombre du bouton = « Imprimer (N) » à l'ouverture ;
// la feuille nomme ce qui n'y est pas (« 1 sans bordereau encore » + Tout générer, « 1 déjà imprimé »,
// « 1 vendue il y a plus de 14 j »). Données inventées. Ventes · À expédier, 1512 clair et 390 tactile sombre.
// BANC_PORT 9243.
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const RACINE = process.env.BANC_RACINE || path.join(__dirname, '..', '..');
const DIST = process.env.BANC_DIST || path.join(RACINE, 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT || 9243);
const SHOTS = process.env.SHOTS || '';
const maintenant = new Date(2026, 10, 11, 10, 0, 0);
const MS = maintenant.getTime(), J = 864e5;
const iso = (t) => new Date(t).toISOString();
const ilYa = (j) => iso(MS - j * J);
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: iso(MS) }];
const TITRE = 'Salomon XT-6 Black 42';
const PDF_B64 = fs.readFileSync(path.join(__dirname, 'bordereau-test.b64'), 'utf8').trim();
// [tx, vendue il y a j jours, date limite dans lim jours]
const PRETS = [[7201, 1, 4], [7202, 2, 3]], IMPRIME = [7204, 1, 4], ANCIENNE = [7205, 20, 1], SANS = [7206, 1, 4];
const AVEC_PDF = [...PRETS, IMPRIME, ANCIENNE];
const TITRES = { 7201: TITRE, 7202: 'Nike Air Max 95 Icons Yellow Stone taille 41', 7204: 'Asics Gel-Lyte III bleu 43', 7205: 'Adidas Samba OG blanche 40', 7206: 'New Balance 550 vert 44' };
const fmtLimite = (j) => { const d = new Date(MS + j * J); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} 23:59`; };
const LIGNES = [
  { id: 'main', data: { vrm_ville: 'Cancale', vinted_bords_printed: { [IMPRIME[0]]: ilYa(0.5) } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: iso(MS - 600e3), payload: { my_orders: [...AVEC_PDF, SANS].map(([tx, j]) => ({ transaction_id: tx, title: TITRES[tx], price: { amount: '80.0', currency_code: 'EUR' }, status: 'Bordereau d’envoi envoyé au vendeur', transaction_user_status: 'needs_action', date: ilYa(j) })) } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: iso(MS - 600e3), payload: { my_orders: [] } } },
  ...AVEC_PDF.map(([tx, j, lim]) => ({ id: 'email_bord_' + tx, data: { type: 'bordereau', transaction: String(tx), uid: '111', account: 'compte_a', filename: `Bordereau-Vinted-${tx}.pdf`, modele: TITRES[tx], article: TITRES[tx], receivedAt: ilYa(j - 0.1), pdfB64: PDF_B64, suivi: '', transporteur: '', dateLimite: fmtLimite(lim) } })),
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
async function ouvrir(b, vp, sombre, lien) {
  const tel = vp.width < 600;
  const ctx = await b.newContext({ viewport: vp, ...(tel ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript(() => { const o = URL.createObjectURL; URL.createObjectURL = function (x) { try { if (x && x.type === 'application/pdf') (window.__pdfs = window.__pdfs || []).push(x); } catch (_) {} return o.call(this, x); }; window.open = () => null; });
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', JSON.stringify(true)); localStorage.setItem('vinted_dark', JSON.stringify(s)); } catch (_) {} }, !!sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font', 'script'].includes(r.request().resourceType()) ? r.abort() : r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{}' })));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const h = { 'access-control-allow-origin': '*' };
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { ...h, 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: h, body: '[]' });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: h, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: r.data.capturedAt || iso(MS), cap: r.data.capturedAt });
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(',').map((x) => x.replace(/^"|"$/g, '')); return j(LIGNES.filter((r) => ids.includes(r.id)).map(forme)); }
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  ctx.on('page', (p) => { if (p !== pg) p.close().catch(() => {}); });
  await pg.goto(`http://localhost:${PORT}/${lien}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs, tel };
}
const attendre = async (pg, q) => { await pg.waitForSelector(q, { timeout: 30000 }); await pg.waitForTimeout(1500); };

(async () => {
  try { srv.listen(PORT); } catch (_) {}
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] }).catch(() => chromium.launch());
  try {
    for (const [vp, sombre, nom] of [[{ width: 1512, height: 982 }, false, '1512-clair'], [{ width: 390, height: 844 }, true, '390-sombre']]) {
      console.log(`\n— ${nom}`);
      const { ctx, pg, errs, tel } = await ouvrir(b, vp, sombre, '?tab=ventes');
      await essaie('L ' + nom, async () => {
        await attendre(pg, '[data-colis-barre-btn="imprimer"]:not([disabled])');
        const bouton = await pg.evaluate(() => { const e = document.querySelector('[data-colis-barre-btn="imprimer"]'); return { n: Number(e.getAttribute('data-imprimer-prets')), txt: e.innerText.trim() }; });
        dit(bouton.n === 2 && /Tout imprimer \(2\)/.test(bouton.txt), 'L le bouton compte ce qui PART : « Tout imprimer (2) » (2 prêts, pas les 4 lignes du lot)', JSON.stringify(bouton));
        const btn = pg.locator('[data-colis-barre-btn="imprimer"]').first();
        if (tel) await btn.tap(); else await btn.click();
        await pg.waitForSelector('[data-lot-etape="choix"]', { timeout: 12000 });
        await pg.waitForTimeout(400);
        const f = await pg.evaluate(() => {
          const imp = document.querySelector('[data-lot-imprimer]'), p = document.querySelector('[data-lot-pourquoi]');
          const r = (k) => { const e = p && p.querySelector(`[data-lot-pourquoi-${k}]`); return e ? Number(e.getAttribute(`data-lot-pourquoi-${k}`)) : 0; };
          const gen = p && p.querySelector('[data-tout-generer]');
          return { imprimer: imp ? Number(imp.getAttribute('data-lot-imprimer')) : null, txt: imp ? imp.innerText.trim() : '', pourquoi: !!p, texte: p ? p.innerText.replace(/\s+/g, ' ').trim() : '',
            sans: r('sans-bordereau'), imprimes: r('imprimes'), anciennes: r('anciennes'), generer: gen ? gen.innerText.replace(/\s+/g, ' ').trim() : null,
            avantListe: p ? !!(p.compareDocumentPosition(document.querySelector('[data-lot-section="partent"]')) & Node.DOCUMENT_POSITION_FOLLOWING) : false };
        });
        dit(f.imprimer === bouton.n && /Imprimer \(2\)/.test(f.txt), 'L la feuille imprime le nombre du bouton : « Imprimer (2) »', JSON.stringify({ bouton: bouton.n, feuille: f.imprimer, txt: f.txt }));
        dit(f.pourquoi && f.avantListe, 'L la feuille dit POURQUOI les autres n’y sont pas, en haut (avant la liste)', f.texte);
        dit(f.sans === 1 && /Tout générer \(1\)/.test(f.generer || ''), 'L « 1 sans bordereau encore » avec son geste (Tout générer)', JSON.stringify({ sans: f.sans, generer: f.generer }));
        dit(f.imprimes === 1 && f.anciennes === 1, 'L « 1 déjà imprimé » et « 1 vendue il y a plus de 14 j » nommés', JSON.stringify(f));
        // Cocher une ligne « à vérifier » : « Imprimer (3) », et la raison sort du « pourquoi » (même règle, même source).
        await pg.locator('[data-lot-ligne="7204"] input[type=checkbox]').first().click();
        await pg.waitForTimeout(200);
        const g = await pg.evaluate(() => { const imp = document.querySelector('[data-lot-imprimer]'), e = document.querySelector('[data-lot-pourquoi-imprimes]'); return { imprimer: Number(imp.getAttribute('data-lot-imprimer')), imprimes: e ? Number(e.getAttribute('data-lot-pourquoi-imprimes')) : 0 }; });
        dit(g.imprimer === 3 && g.imprimes === 0, 'L cocher le déjà imprimé ⇒ « Imprimer (3) », il n’est plus dans le « pourquoi »', JSON.stringify(g));
        const deb = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        dit(deb <= 0, 'L aucun débordement horizontal', String(deb));
        if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, `tout-imprimer-compte-${nom}.png`) }); }
      });
      dit(errs.length === 0, 'U aucune erreur', errs.slice(0, 2).join(' | '));
      await ctx.close();
    }
  } finally { await b.close(); srv.close(); }
  console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s), ${ok} vert(s)` : `\n✅ Tout imprimer, un seul nombre : ${ok} verts`);
  process.exit(ko ? 1 : 0);
})();
