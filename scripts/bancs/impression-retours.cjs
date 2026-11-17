// ═══════════════════════════════════════════════════════════════════════════
// BANC : LES BORDEREAUX DE RETOUR DANS « IMPRIMER » (16 nov., lot impression-retours)
//        node scripts/bancs/impression-retours.cjs — après `npm run build`
//        (BANC_PORT=…, BANC_DIST=…, SHOTS=… pour garder les captures et le rendu du PDF)
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « Les colis imprimés tu peux mettre le retour, mais il faut bien préciser que c'est un retour et
// pas une vente. » Données INVENTÉES (dépôt public), à la forme mesurée (retours-litiges, 11 et 15 nov.) :
//   · une VENTE à poster 9420 (N°40, bordereau e-mail) ;
//   · un RETOUR 9501 : l'achat « Retour initié » (vendeur `vendeuse_dunk`), relié au N°31 par SON clic
//     (`buyFromId`), son bordereau de retour `email_bordretour_9501` (à déposer dans 30 h).
// Il exige, à 1512 px (clair) puis 390 px tactile (clair et sombre) :
//   R1 sous les ventes, la section « RETOUR · tu renvoies un achat » : la ligne 9501, N°31, « à renvoyer à
//      vendeuse_dunk », « À déposer … » ; pastille ambre (< 48 h), aucun rouge ;
//   R2 les compteurs des VENTES sont ceux d'un compte SANS retour (même banc joué sans la ligne de retour) :
//      bouton (`data-impr-lot`), `vrm_colis_prets.lot`, `vrm_colis_aposter` ; « + 1 retour » à part ;
//   R3 (1512) UN toucher ⇒ un PDF : la vente ET le retour ; la page de la vente porte « N° 40 » et JAMAIS
//      « RETOUR » ; celle du retour porte « RETOUR » et « N° 31 » (le cartouche RETOUR, pas celui d'une vente) ;
//      le PDF est RENDU en image (pdf.js dans Chromium) et gardé pour être regardé ;
//   R4 la feuille d'après dit « 2 bordereaux dans le PDF · dont 1 retour », la vignette du retour porte RETOUR.
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

async function lignes({ avecRetour = true } = {}) {
  const { PDFDocument, StandardFonts, rgb } = require(path.join(NM, 'pdf-lib'));
  const pdf = async (t) => { const d = await PDFDocument.create(); const p = d.addPage([595.28, 841.89]); const f = await d.embedFont(StandardFonts.Helvetica);
    p.drawRectangle({ x: 300, y: 430, width: 260, height: 380, borderWidth: 1, borderColor: rgb(0, 0, 0), color: rgb(1, 1, 1) }); p.drawText('ETIQUETTE ' + t, { x: 320, y: 780, size: 14, font: f }); p.drawText('Mondial Relay', { x: 320, y: 760, size: 10, font: f });
    return Buffer.from(await d.save()).toString('base64'); };
  const achat = (tx, title, eur, status, h, extra = {}) => ({ transaction_id: tx, title, price: { amount: String(eur), currency_code: 'EUR' }, status, transaction_user_status: 'completed', date: ilYaH(h), photo: { url: PH('#636366') }, ...extra });
  const vente = (tx, title, status, tus, h) => ({ transaction_id: tx, title, status, transaction_user_status: tus, conversation_id: '2461867' + tx, date: ilYaH(h), price: { amount: '70.0', currency_code: 'EUR' } });
  const L = [
    { id: 'main', data: { vinted_annonce_numeros: { i420: { numero: '40', title: TV, auto: false }, i9501: { numero: '31', title: T, auto: false, buyFromId: '9501' } }, vinted_used_numeros: [31, 40] } },
    { id: 'harvest_111_orders_purchased', data: { capturedAt: ilYaH(0.2), payload: { my_orders: [achat(9501, T, 45.9, avecRetour ? 'Retour initié' : 'Commande finalisée', 120, { seller: 'vendeuse_dunk' })] } } },
    { id: 'harvest_111_orders_sold', data: { capturedAt: ilYaH(0.2), payload: { my_orders: [vente(9420, TV, 'Le paiement a été validé', 'needs_action', 10)] } } },
    { id: 'harvest_111_listings', data: { capturedAt: ilYaH(0.2), payload: { items: [], pagination: { total_entries: 0 } } } },
    { id: 'harvest_111_txn_9420', data: { capturedAt: ilYaH(1), payload: { transaction: { id: 9420, item_id: 'i420' } } } },
    { id: 'email_bord_9420', data: { transaction: '9420', uid: '111', filename: 'bordereau-9420.pdf', modele: TV, article: TV, receivedAt: ilYaH(2), pdfB64: await pdf('9420'), suivi: '81000420' } },
  ];
  if (avecRetour) L.push(
    { id: 'email_bordretour_9501', data: { type: 'bordereau-retour', sens: 'achat', transaction: '9501', suivi: '82000501', dateLimite: '', dateLimiteIso: dansH(30), article: T, uid: '111', account: 'compte_a', filename: 'Bon-Retour-Vinted-9501.pdf', pdfB64: await pdf('RETOUR9501'), receivedAt: ilYaH(20) } },
    { id: 'transp_mondialrelay_82000501', data: { suivi: '82000501', carrier: 'mondialrelay', etat: 'en_route', libelle: 'Étiquette créée', etatAt: ilYaH(3), lu: ilYaH(2) } },
  );
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

async function ouvrir(b, { vp, sombre = false, ROWS }) {
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
  await pg.goto(`http://localhost:${PORT}/?tab=ventes`, { waitUntil: 'domcontentloaded', timeout: 120000 });   // machine chargée : une ouverture lente n'est pas un défaut
  await pg.waitForFunction(() => document.body.innerText.includes('N°40'), null, { timeout: 45000 }).catch(() => {});
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
const shot = async (pg, nom) => { if (SHOTS) { try { await pg.screenshot({ path: path.join(SHOTS, `impression-retours-${nom}.png`), fullPage: false, timeout: 60000 }); } catch (_) {} } };

(async () => {
  let b;
  try {
    await new Promise((r) => srv.listen(PORT, r));
    if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
    b = await lancer(PW, { executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    const AVEC = await lignes({ avecRetour: true }), SANS = await lignes({ avecRetour: false });
    for (const [vp, sombre] of [[{ width: 1512, height: 950 }, false], [{ width: 390, height: 844 }, false], [{ width: 390, height: 844 }, true]]) {
      const nom = `${vp.width} ${sombre ? 'sombre' : 'clair'}`;
      if (process.env.IR_VUES && !process.env.IR_VUES.split(',').includes(nom.replace(' ', '-'))) continue;   // ex. IR_VUES=390-clair
      console.log('── ' + nom);
      // Le témoin : le MÊME compte sans retour ⇒ les compteurs des ventes.
      const t = await ouvrir(b, { vp, sombre, ROWS: SANS });
      const cSans = await compteurs(t.pg);
      const sansSection = await t.pg.$('[data-retours-lot]');
      await t.ctx.close();
      const o = await ouvrir(b, { vp, sombre, ROWS: AVEC });
      const { pg } = o;
      await essaie('R1 la section des retours', async () => {
        await pg.waitForSelector('[data-retours-lot]', { timeout: 20000 }).catch(() => {});
        const r = await pg.evaluate(() => {
          const s = document.querySelector('[data-retours-lot]'); if (!s) return null;
          const l = s.querySelector('[data-lot-retour]');
          const past = l && l.querySelector('[data-retour-pastille]');
          return { titre: (s.querySelector('h3') || {}).innerText || '', tx: l && l.getAttribute('data-lot-retour'), coche: l && l.getAttribute('data-coche'), num: l && (l.querySelector('[data-retour-num]') || {}).innerText,
            vendeur: l && (l.querySelector('[data-retour-vendeur]') || {}).innerText, limite: l && (l.querySelector('[data-retour-limite]') || {}).innerText, pastille: past && past.innerText, ambre: past ? getComputedStyle(past).color : '', encre: getComputedStyle(s.querySelector('h3')).color,
            dansVentes: !!l && !!document.querySelector('[data-vv-coche="9501"], [data-lot-ligne="9501"]') };
        });
        if (process.env.IR_SONDE) console.log(await pg.evaluate(() => { const out = []; let e = document.querySelector('[data-retours-lot] .vrm-ret-titre'); while (e && out.length < 8) { const c = getComputedStyle(e); out.push(`${e.tagName}.${String(e.className).slice(0, 40)} color=${c.color} sv=${c.getPropertyValue('--sv-encre')} sv2=${c.getPropertyValue('--sv-encre-2')} sb=${c.getPropertyValue('--sb-encre')} ret=${c.getPropertyValue('--ret-encre')} amb=${c.getPropertyValue('--sv-ambre')}`); e = e.parentElement; } return out.join('\n'); }));
        dit(!sansSection, `${nom} : sans bordereau de retour, aucune section « RETOUR » (rien d’inventé)`);
        dit(r && /RETOUR/.test(r.titre) && /tu renvoies un achat/.test(r.titre), `${nom} : R1 la section « RETOUR · tu renvoies un achat »`, JSON.stringify(r));
        dit(r && r.tx === '9501' && r.coche === '1' && /N°\s*31/.test(r.num || '') && /RETOUR/.test(r.pastille || ''), `${nom} : R1 la ligne 9501, N°31 (par l’achat), pastille RETOUR, cochée d’office`, JSON.stringify(r));
        dit(r && /vendeuse_dunk/.test(r.vendeur || '') && /^À déposer/.test(r.limite || ''), `${nom} : R1 le vendeur à qui on renvoie et « À déposer … » (date lue)`, JSON.stringify(r && [r.vendeur, r.limite]));
        dit(r && r.ambre && r.ambre !== r.encre, `${nom} : R1 la date limite approche (< 48 h) ⇒ la pastille passe en ambre`, JSON.stringify(r && [r.ambre, r.encre]));
        dit(r && !r.dansVentes, `${nom} : R1 le retour n’est pas une ligne de vente (aucune case de vente 9501)`);
        dit((await rougeIci(pg, '[data-retours-lot]')) === false, `${nom} : R1 aucun rouge sur la section des retours (§7)`);
        await pg.locator('[data-retours-lot]').scrollIntoViewIfNeeded().catch(() => {});
        await pg.waitForTimeout(500);
        await shot(pg, `${vp.width}-${sombre ? 'sombre' : 'clair'}-section`);
        dit((await deborde(pg)) <= 1, `${nom} : rien ne déborde`);
      });
      await essaie('R2 les compteurs des ventes', async () => {
        const c = await compteurs(pg);
        dit(c.boutons && c.boutons === cSans.boutons && c.lot === cSans.lot && c.prets === cSans.prets && c.total === cSans.total && c.aposter === cSans.aposter,
          `${nom} : R2 « à envoyer », le bouton et \`vrm_colis_prets\` sont ceux du même compte SANS retour`, JSON.stringify({ avec: c, sans: cSans }));
        const p = await pg.evaluate(() => [...document.querySelectorAll('[data-impr-retours]')].map((x) => x.getAttribute('data-impr-retours') + ':' + x.innerText.trim()));
        dit(p.length >= 1 && p.every((x) => /^1:\+ 1 retour$/.test(x)), `${nom} : R2 le retour est compté À PART (« + 1 retour »)`, JSON.stringify(p));
      });
      if (vp.width > 600) await essaie('R3 un toucher, un PDF : la vente et le retour', async () => {
        const bt = pg.locator('[data-vv-pied] [data-colis-barre-btn="imprimer"]').first();
        await bt.scrollIntoViewIfNeeded().catch(() => {});
        await bt.click();
        // (17 nov., lot tampons-parametres) la sélection ouvre d'abord l'APERÇU AVANT IMPRESSION (la vente et le retour en
        // vignettes) ; rien ne part avant son « Imprimer ».
        const ap = await pg.waitForSelector('[data-impr-apercu="pret"] [data-impr-apercu-imprimer]:not([disabled])', { timeout: 60000 }).then(() => true).catch(() => false);
        dit(ap, `${nom} : R3 l’aperçu avant impression s’ouvre d’abord`);
        if (ap) await pg.click('[data-impr-apercu-imprimer]');
        await pg.waitForSelector('[data-visionneuse-pdf="pret"]', { timeout: 30000 }).catch(() => {});
        const b64 = await pg.evaluate(async () => { const f = document.querySelector('[data-visionneuse-cadre]'); if (!f) return null; const r = await fetch(f.src); const u = new Uint8Array(await r.arrayBuffer()); let s = ''; for (let j = 0; j < u.length; j++) s += String.fromCharCode(u[j]); return btoa(s); });
        dit(!!b64, `${nom} : R3 le PDF du lot s’ouvre dans la visionneuse`);
        if (!b64) return;
        const pages = await lirePdf(b64);
        const v = blocDe(pages, '9420'), r = blocDe(pages, 'RETOUR9501');
        dit(v != null && r != null, `${nom} : R3 les DEUX bordereaux sont dans le même PDF (vente 9420 et retour 9501)`, JSON.stringify(pages));
        dit(v != null && /N°\s*40/.test(v) && !/RETOUR/i.test(v) && !/pas une vente/.test(v), `${nom} : R3 la vente porte « N° 40 » et JAMAIS « RETOUR »`, v);
        dit(r != null && /RETOUR/.test(r) && /N°\s*31/.test(r) && r.indexOf('RETOUR') < r.search(/N°\s*31/) && /pas une vente/.test(r), `${nom} : R3 le retour porte le cartouche RETOUR (« RETOUR » avant « N° 31 », « pas une vente »)`, r);
        if (SHOTS) fs.writeFileSync(path.join(SHOTS, 'impression-retours-lot.pdf'), Buffer.from(b64, 'base64'));
        // Le PDF RENDU en image (pdf.js dans Chromium) — la capture se regarde.
        const pr = await b.newPage({ viewport: { width: 1500, height: 1000 } });
        await pr.goto(`http://localhost:${PORT}/__rendu`); await pr.waitForFunction(() => window.pret === true, null, { timeout: 15000 });
        const n = await pr.evaluate((x) => window.rendre(x), b64);
        dit(n === pages.length && n >= 2, `${nom} : R3 le PDF est rendu en image (${n} pages)`);
        if (SHOTS) await pr.screenshot({ path: path.join(SHOTS, 'impression-retours-pdf-rendu.png'), fullPage: true });
        await pr.close();
        await pg.click('[data-visionneuse-fermer]').catch(() => {});
        await pg.waitForSelector('[data-impr-feuille]', { timeout: 10000 }).catch(() => {});
        const f = await pg.evaluate(() => { const x = document.querySelector('[data-impr-feuille]'); if (!x) return null; const v2 = x.querySelector('[data-impr-vignette-retour="1"]');
          return { n: x.getAttribute('data-impr-n'), ret: x.getAttribute('data-impr-retours'), titre: (x.closest('[role="dialog"]') || x).innerText.split('\n').slice(0, 4).join(' | '), vignette: v2 ? v2.innerText : '' }; });
        dit(f && f.n === '2' && f.ret === '1' && /dont 1 retour/.test(f.titre), `${nom} : R4 « 2 bordereaux dans le PDF · dont 1 retour »`, JSON.stringify(f));
        dit(f && /RETOUR/.test(f.vignette) && /N°31/.test(f.vignette), `${nom} : R4 la vignette du retour porte RETOUR et son N°`, JSON.stringify(f));
        await pg.waitForTimeout(800);
        await shot(pg, `${vp.width}-apres`);
        const c2 = await compteurs(pg);
        // Après l'impression, la vente imprimée n'est plus « à imprimer » (lot 0) ; « à envoyer » ne bouge pas.
        dit(c2.total === cSans.total && c2.prets === cSans.prets && c2.aposter === cSans.aposter && c2.lot === 0, `${nom} : R2 après l’impression, « à envoyer » est inchangé (le retour n’y entre pas) ; la vente imprimée sort du lot`, JSON.stringify({ c2, cSans }));
      });
      dit(!o.errs.length, `${nom} : aucune erreur de page`, o.errs.join(' | ').slice(0, 300));
      await o.ctx.close();
    }
  } catch (e) { dit(false, 'le banc a pu tourner', String(e && e.stack || e).slice(0, 500)); }
  finally { if (b) await b.close().catch(() => {}); srv.close(); }
  console.log(`\n${ko ? 'KO' : 'OK'} impression-retours : ${ok} verts, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
})();
