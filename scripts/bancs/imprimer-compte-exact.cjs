// ═══════════════════════════════════════════════════════════════════════════
// BANC : LE BOUTON « IMPRIMER » COMPTE EXACTEMENT CE QUI EST COCHÉ ET CE QUI PART (17 nov., chasse-bugs)
//        node scripts/bancs/imprimer-compte-exact.cjs — après `npm run build` (BANC_PORT, BANC_DIST, SHOTS)
// ═══════════════════════════════════════════════════════════════════════════
// Julien, capture de Ventes à l'ordinateur : « regarde ici il y a 4 bordereaux de sélectionné » — trois ventes
// et un RETOUR cochés, le bouton disait « Imprimer les 3 bordereaux » (+ une pastille « + 1 retour ») et
// « 2 colis n'y sont pas · Choisir » sans dire lesquels. Les quatre partaient dans le même PDF.
// Données INVENTÉES (dépôt public), forme du banc impression-retours :
//   · 3 ventes à poster AVEC bordereau (N°40, 41, 42), 1 vente SANS bordereau (N°43, décochée d'office) ;
//   · 1 retour d'achat (9501, N°31) avec son bordereau, coché d'office.
// Exige, à 1512 (clair) et 390 tactile (clair) :
//   C1 le nombre écrit sur le bouton « Imprimer » = ventes cochées + retours cochés (4), et « dont 1 retour » ;
//   C2 (1512) ce nombre = les cases cochées à l'écran ;
//   C3 le lien « Choisir » NOMME ce qui n'y est pas : « N°43 attend son bordereau » ;
//   C4 un toucher ⇒ le PDF porte exactement ce nombre d'étiquettes (4) ;
//   C5 Ma journée (même base) : « Imprimer les 4 bordereaux · dont 1 retour ».
const path = require('path');
const fs = require('fs'), http = require('http'), os = require('os');
const { pathToFileURL } = require('url');
const PW = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { lancer } = require('./_navigateur.cjs');
const { metaVersData } = require('./_meta.cjs');
const NM = path.join(__dirname, '..', '..', 'node_modules');
const PDFJS = fs.existsSync(path.join(NM, 'pdfjs-dist')) ? path.join(NM, 'pdfjs-dist') : '/opt/npm-tools/node_modules/pdfjs-dist';
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || (4700 + Math.floor(Math.random() * 600));
const SHOTS = process.env.SHOTS || '';
const MAINTENANT = Date.now(), H = 3600000;
const ilYaH = (h) => new Date(MAINTENANT - h * H).toISOString();
const dansH = (h) => new Date(MAINTENANT + h * H).toISOString();
const PH = (c) => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="${c}"/></svg>`);
const T = 'Nike Dunk Low noir taille 42', TV = 'Asics Gel 1130 43';
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: ilYaH(0) }];

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d && !c ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).replace(/\s+/g, ' ').slice(0, 400)); } };

async function lignes() {
  const { PDFDocument, StandardFonts, rgb } = require(path.join(NM, 'pdf-lib'));
  const pdf = async (t) => { const d = await PDFDocument.create(); const p = d.addPage([595.28, 841.89]); const f = await d.embedFont(StandardFonts.Helvetica);
    p.drawRectangle({ x: 300, y: 430, width: 260, height: 380, borderWidth: 1, borderColor: rgb(0, 0, 0), color: rgb(1, 1, 1) }); p.drawText('ETIQUETTE ' + t, { x: 320, y: 780, size: 14, font: f }); p.drawText('Mondial Relay', { x: 320, y: 760, size: 10, font: f });
    return Buffer.from(await d.save()).toString('base64'); };
  const achat = (tx, title, eur, status, h, extra = {}) => ({ transaction_id: tx, title, price: { amount: String(eur), currency_code: 'EUR' }, status, transaction_user_status: 'completed', date: ilYaH(h), photo: { url: PH('#636366') }, ...extra });
  const vente = (tx, title, h) => ({ transaction_id: tx, title, status: 'Le paiement a été validé', transaction_user_status: 'needs_action', conversation_id: '2461867' + tx, date: ilYaH(h), price: { amount: '70.0', currency_code: 'EUR' } });
  const V = [[9420, 'Asics Gel 1130 43', '40'], [9421, 'Puma Suede bleu 41', '41'], [9422, 'Converse Chuck 70 noir 40', '42'], [9423, 'Vans Old Skool 39', '43']];
  const nums = { i9501: { numero: '31', title: T, auto: false, buyFromId: '9501' } };
  for (const [tx, ti, n] of V) nums['i' + tx] = { numero: n, title: ti, auto: false };
  const L = [
    { id: 'main', data: { vinted_annonce_numeros: nums, vinted_used_numeros: [31, 40, 41, 42, 43] } },
    { id: 'harvest_111_orders_purchased', data: { capturedAt: ilYaH(0.2), payload: { my_orders: [achat(9501, T, 45.9, 'Retour initié', 120, { seller: 'vendeuse_dunk' })] } } },
    { id: 'harvest_111_orders_sold', data: { capturedAt: ilYaH(0.2), payload: { my_orders: V.map(([tx, ti], i) => vente(tx, ti, 10 + i)) } } },
    { id: 'harvest_111_listings', data: { capturedAt: ilYaH(0.2), payload: { items: [], pagination: { total_entries: 0 } } } },
    { id: 'email_bordretour_9501', data: { type: 'bordereau-retour', sens: 'achat', transaction: '9501', suivi: '82000501', dateLimite: '', dateLimiteIso: dansH(30), article: T, uid: '111', account: 'compte_a', filename: 'Bon-Retour-Vinted-9501.pdf', pdfB64: await pdf('RETOUR9501'), receivedAt: ilYaH(20) } },
    { id: 'transp_mondialrelay_82000501', data: { suivi: '82000501', carrier: 'mondialrelay', etat: 'en_route', libelle: 'Étiquette créée', etatAt: ilYaH(3), lu: ilYaH(2) } },
  ];
  for (const [tx, ti] of V) {
    L.push({ id: 'harvest_111_txn_' + tx, data: { capturedAt: ilYaH(1), payload: { transaction: { id: tx, item_id: 'i' + tx } } } });
    if (tx !== 9423) L.push({ id: 'email_bord_' + tx, data: { transaction: String(tx), uid: '111', filename: `bordereau-${tx}.pdf`, modele: ti, article: ti, receivedAt: ilYaH(2), pdfB64: await pdf(String(tx)), suivi: '81000' + String(tx).slice(1) } });
  }
  return L;
}

async function lirePdf(b64) {
  const pdfjs = await import(pathToFileURL(path.join(PDFJS, 'legacy', 'build', 'pdf.mjs')).href);
  const doc = await pdfjs.getDocument({ data: new Uint8Array(Buffer.from(b64, 'base64')), verbosity: 0 }).promise;
  const out = [];
  for (let i = 1; i <= doc.numPages; i++) { const p = await doc.getPage(i); out.push((await p.getTextContent()).items.map((x) => x.str).join(' ').replace(/\s+/g, ' ')); }
  return out;
}
// Le texte qui accompagne une étiquette : sa page, et la fiche qui la suit (une page sans ETIQUETTE).
const blocDe = (pages, code) => { const i = pages.findIndex((t) => t.includes('ETIQUETTE ' + code)); if (i < 0) return null; const suite = pages[i + 1] && !/ETIQUETTE/.test(pages[i + 1]) ? pages[i + 1] : ''; return (pages[i] + ' ' + suite).replace(/ETIQUETTE \S+/g, ''); };

const RENDU = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#888"><div id="p" style="display:flex;gap:12px;padding:12px;flex-wrap:wrap"></div>
<script type="module">import * as m from '/__pdfjs/pdf.min.mjs'; m.GlobalWorkerOptions.workerSrc='/__pdfjs/pdf.worker.min.mjs';
window.rendre = async (b64) => { const o = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)); const d = await m.getDocument({ data: o }).promise;
for (let i = 1; i <= d.numPages; i++) { const pg = await d.getPage(i); const v = pg.getViewport({ scale: 1.1 }); const c = document.createElement('canvas'); c.width = v.width; c.height = v.height; c.style.background = '#fff';
document.getElementById('p').appendChild(c); await pg.render({ canvasContext: c.getContext('2d'), viewport: v }).promise; } return d.numPages; }; window.pret = true;</script>`;
const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0];
  if (f === '/__rendu') { r.writeHead(200, { 'content-type': 'text/html' }); return r.end(RENDU); }
  if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = f.startsWith('/__pdfjs/') ? path.join(PDFJS, 'build', path.basename(f)) : path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ')'); process.exit(1); });
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let x = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) x = x == null ? null : x[seg];
    out[alias] = x == null ? null : (/->>/.test(src) && typeof x !== 'object' ? String(x) : x);
  }
  return out;
};
const reDe = (motif) => new RegExp('^' + motif.replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$');

async function ouvrir(b, { vp, sombre = false, ROWS, tab = 'ventes' }) {
  const ctx = await b.newContext({ locale: 'fr-FR', viewport: vp, colorScheme: sombre ? 'dark' : 'light', ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const main = ROWS.find((r) => r.id === 'main').data;
  await pg.addInitScript(({ s, m }) => {
    try {
      localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', 'true'); localStorage.setItem('vinted_dark', JSON.stringify(s)); localStorage.setItem('vrm_apparence', JSON.stringify(s ? 'sombre' : 'clair'));
      if (!sessionStorage.getItem('banc_init')) { sessionStorage.setItem('banc_init', '1'); localStorage.setItem('vrm_imprimante', JSON.stringify('normale'));
        localStorage.setItem('vinted_annonce_numeros', JSON.stringify(m.vinted_annonce_numeros)); localStorage.setItem('vinted_used_numeros', JSON.stringify(m.vinted_used_numeros)); }
    } catch (_) {}
    window.open = () => null; window.print = () => {};
  }, { s: sombre, m: main });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) || /vinted\.(net|fr|com)/i.test(r.request().url()) ? r.abort() : r.continue()));
  await pg.route('**://cdn.jsdelivr.net/npm/pdfjs-dist@*/**', (r) => {
    const n = path.basename(new URL(r.request().url()).pathname);
    const f = path.join(PDFJS, 'build', n.replace(/\.js$/, '.mjs'));
    if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ status: 200, contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(f) });
  });
  await pg.addInitScript((port) => { import(`http://localhost:${port}/__pdfjs/pdf.min.mjs`).then((m) => { m.GlobalWorkerOptions.workerSrc = `http://localhost:${port}/__pdfjs/pdf.worker.min.mjs`; window.pdfjsLib = { ...m, GlobalWorkerOptions: { workerSrc: '' }, getDocument: (o) => { const t = m.getDocument(o); return { promise: t.promise.then((d) => { if (typeof d.destroy !== 'function') d.destroy = () => t.destroy(); return d; }), destroy: () => t.destroy() }; } }; }).catch(() => {}); }, PORT);
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    if (/select=owner/.test(u)) return j([]);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: r.data.capturedAt || ilYaH(0), cap: r.data.capturedAt });
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const inn = /[?&]id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(',').map((x) => x.replace(/^"|"$/g, '')); return j(ROWS.filter((r) => ids.includes(r.id)).map(forme)); }
    const ou = /[?&]or=\(([^)]*)\)/.exec(u);
    if (ou && /id\.like\./.test(ou[1])) { const res = ou[1].split(',').map((x) => /^id\.like\.(.+)$/.exec(x.trim())).filter(Boolean).map((m) => reDe(m[1])); return j(ROWS.filter((r) => res.some((re) => re.test(r.id))).map(forme)); }
    const lk = /[?&]id=like\.([^&]*)/.exec(u);
    if (lk) { const re = reDe(lk[1]); return j(ROWS.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  ctx.on('page', (p) => { if (p !== pg) p.close().catch(() => {}); });
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded', timeout: 120000 });   // machine chargée : une ouverture lente n'est pas un défaut
  if (tab === 'ventes') await pg.waitForFunction(() => document.body.innerText.includes('N°40'), null, { timeout: 45000 }).catch(() => {});
  // Les compteurs publiés par l'écran (`vrm_colis_prets`, `vrm_colis_aposter`) et le bouton : attendus, jamais lus trop tôt.
  await pg.waitForFunction(() => !!localStorage.getItem('vrm_colis_prets') && !!localStorage.getItem('vrm_colis_aposter') && !!document.querySelector('[data-colis-barre-btn="imprimer"]'), null, { timeout: 30000 }).catch(() => {});
  await pg.waitForTimeout(1500);
  return { ctx, pg, errs };
}
const compteurs = (pg) => pg.evaluate(() => {
  const lis = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } };
  const b = [...document.querySelectorAll('[data-colis-barre-btn="imprimer"]')].map((x) => x.getAttribute('data-impr-lot'));
  const p = lis('vrm_colis_prets'), a = lis('vrm_colis_aposter');
  return { boutons: b.join(','), lot: p && p.lot, prets: p && p.prets, total: p && p.total, aposter: a == null ? null : JSON.stringify(a && (a.n != null ? a.n : a.total != null ? a.total : a)) };
});
const rougeIci = (pg, sel) => pg.evaluate((s) => {
  const el = document.querySelector(s); if (!el) return null;
  const rgb = (c) => (/rgba?\(([^)]+)\)/.exec(c) || [, ''])[1].split(',').map((x) => parseFloat(x));
  return [...el.querySelectorAll('*'), el].some((x) => { const cs = getComputedStyle(x); return [cs.color, cs.backgroundColor, cs.borderTopColor].some((c) => { const [r, g, b2, a] = rgb(c); return a !== 0 && r > 190 && g < 90 && b2 < 90; }); });
}, sel);
const deborde = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const shot = async (pg, nom) => { if (SHOTS) { try { await pg.screenshot({ path: path.join(SHOTS, `imprimer-compte-${nom}.png`), fullPage: false, timeout: 60000 }); } catch (_) {} } };

const nombreDe = (s) => { const m = /(\d+)/.exec(String(s || '')); return m ? Number(m[1]) : null; };
(async () => {
  let b;
  try {
    await new Promise((r) => srv.listen(PORT, r));
    if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
    b = await lancer(PW, { executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    const ROWS = await lignes();
    for (const vp of [{ width: 1512, height: 950 }, { width: 390, height: 844 }]) {
      const nom = String(vp.width);
      if (process.env.IC_VUES && !process.env.IC_VUES.split(',').includes(nom)) continue;
      console.log('── ' + nom);
      const o = await ouvrir(b, { vp, ROWS });
      const { pg } = o;
      await pg.waitForSelector('[data-lot-retour]', { timeout: 20000 }).catch(() => {});
      await pg.waitForTimeout(1200);
      await shot(pg, `${nom}-avant`);
      const sel = vp.width > 600 ? '[data-vv-pied] [data-colis-barre-btn="imprimer"]' : '[data-colis-barre-btn="imprimer"]';
      const m = await pg.evaluate((s) => {
        const vis = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
        const bt = [...document.querySelectorAll(s)].find(vis);
        const choisir = [...document.querySelectorAll('[data-lot-ouvrir]')].find(vis);
        return { texte: bt ? bt.innerText.replace(/\s+/g, ' ').trim() : null, ventesCochees: [...document.querySelectorAll('[data-vv-coche-on="1"]')].filter(vis).length,
          retoursCoches: [...document.querySelectorAll('[data-lot-retour][data-coche="1"]')].filter(vis).length, cases: document.querySelectorAll('[data-vv-coche]').length,
          choisir: choisir ? choisir.innerText.replace(/\s+/g, ' ').trim() : null };
      }, sel);
      const n = nombreDe(m.texte);
      dit(n === 4 && /dont 1 retour/.test(m.texte || ''), `${nom} : C1 le bouton compte les 3 ventes ET le retour cochés (« 4 … dont 1 retour »)`, JSON.stringify(m));
      if (m.cases) dit(n === m.ventesCochees + m.retoursCoches, `${nom} : C2 le nombre du bouton = les cases cochées à l’écran (${m.ventesCochees} + ${m.retoursCoches})`, JSON.stringify(m));
      if (vp.width > 600) dit(/N°43 attend son bordereau/.test(m.choisir || ''), `${nom} : C3 « Choisir » nomme ce qui n’y est pas (N°43 attend son bordereau)`, JSON.stringify(m.choisir));
      await essaie(`${nom} : C4 ce qui part`, async () => {
        const bt = pg.locator(sel).filter({ visible: true }).first();
        await bt.scrollIntoViewIfNeeded().catch(() => {});
        if (vp.width < 600) await bt.tap(); else await bt.click();
        const ap = await pg.waitForSelector('[data-impr-apercu="pret"] [data-impr-apercu-imprimer]:not([disabled])', { timeout: 60000 }).then(() => true).catch(() => false);
        if (ap) await pg.click('[data-impr-apercu-imprimer]');
        await pg.waitForSelector('[data-visionneuse-pdf="pret"]', { timeout: 30000 }).catch(() => {});
        const b64 = await pg.evaluate(async () => { const f = document.querySelector('[data-visionneuse-cadre]'); if (!f) return null; const r = await fetch(f.src); const u = new Uint8Array(await r.arrayBuffer()); let s = ''; for (let j = 0; j < u.length; j++) s += String.fromCharCode(u[j]); return btoa(s); });
        dit(!!b64, `${nom} : C4 le PDF du lot s’ouvre`);
        if (!b64) return;
        const pages = await lirePdf(b64);
        const etiquettes = pages.filter((t) => /ETIQUETTE \S+/.test(t)).length;
        dit(etiquettes === n, `${nom} : C4 le PDF porte autant d’étiquettes que le bouton le disait (${etiquettes} pour ${n})`, JSON.stringify(pages.map((t) => (/ETIQUETTE \S+/.exec(t) || [''])[0])));
        await shot(pg, `${nom}-pdf`);
      });
      dit(!o.errs.length, `${nom} : aucune erreur de page`, o.errs.join(' | ').slice(0, 300));
      await o.ctx.close();
      // C5 Ma journée (même base, le même nombre).
      const j = await ouvrir(b, { vp, ROWS, tab: 'journee' });
      await j.pg.waitForSelector('[data-sj-imprimer]', { timeout: 30000 }).catch(() => {});
      await j.pg.waitForTimeout(1500);
      const tj = await j.pg.evaluate(() => { const e = [...document.querySelectorAll('[data-sj-imprimer]')].find((x) => x.getClientRects().length); return e ? e.innerText.replace(/\s+/g, ' ').trim() : null; });
      dit(nombreDe(tj) === 4 && /dont 1 retour/.test(tj || ''), `${nom} : C5 Ma journée dit le même nombre (« Imprimer les 4 bordereaux · dont 1 retour »)`, JSON.stringify(tj));
      await shot(j.pg, `${nom}-journee`);
      await j.ctx.close();
    }
  } catch (e) { dit(false, 'le banc a pu tourner', String(e && e.stack || e).slice(0, 500)); }
  finally { if (b) await b.close().catch(() => {}); srv.close(); }
  console.log(`\n${ko ? 'KO' : 'OK'} imprimer-compte-exact : ${ok} verts, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
})();
