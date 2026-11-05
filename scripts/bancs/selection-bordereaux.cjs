// Banc : LE LOT DE BORDEREAUX, TOUTES PLATEFORMES COCHABLES, ET LE TAMPON SUR UNE SÉLECTION (4 nov., Julien, 21 h 08 :
// « je n'ai pas la possibilité de sélectionner la vente de Vestiaire Co et de Leboncoin quand je veux imprimer les
// bordereaux » ; « pareil pour le tamponnage, on doit pouvoir le faire quand tous les bordereaux sont sélectionnés »).
// Données INVENTÉES, formes réelles : ventes Vinted à expédier + bordereaux e-mail (2 Mondial Relay 10×15, 1 Chronopost
// A4), ventes Vestiaire (V1 : bordereau rangé Chronopost A4 ; V2 : pas encore de bordereau), une vente Leboncoin à
// poster (lien de bordereau lu, mais AUCUNE extension dans ce navigateur), une commande eBay payée.
// Exige (data-*, nombres, PDF relu par pdf.js) :
//  A. Vestiaire (V1, V2) et Leboncoin ont leur case, cochable ; eBay a sa ligne grisée « eBay », jamais cochable ;
//  B. cochées d'office : celles qui ont leur bordereau ; « Sans bordereau » sur V2 et Leboncoin ;
//  C. « Tout sélectionner » coche tout sauf eBay ;
//  D. tout sélectionné ⇒ la feuille du tampon s'ouvre UNE fois par TYPE (Mondial Relay 10×15, Chronopost A4), sur le
//     premier bordereau de ce type ; la place posée (« Toujours ici ») est gardée () et les autres
//     bordereaux du même type sont tamponnés AU MÊME ENDROIT ; eBay jamais dans le PDF ;
//  E. le lot NOMME « 2 sans bordereau » (V2 et Leboncoin) ;
//  F. second lot : le type gardé ne redemande pas ; « Placer le tampon » redemande chaque type ;
//  G. « Annuler » dans la feuille ⇒ aucun PDF ;
//  H. aucune erreur ; rien ne déborde ; 390 tactile clair, 1512 clair, 1512 sombre (SHOTS=dossier).
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const { pathToFileURL } = require('url');
const NM = path.join(__dirname, '..', '..', 'node_modules');
const PDFJS = fs.existsSync(path.join(NM, 'pdfjs-dist')) ? path.join(NM, 'pdfjs-dist') : '/opt/npm-tools/node_modules/pdfjs-dist';
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4811);
const SHOTS = process.env.SHOTS || '';
const MUT = process.env.BANC_MUTATION || '';
const MAINTENANT = Date.now(), H = 3600000, J = 24 * H;
const ilYaH = (h) => new Date(MAINTENANT - h * H).toISOString();
const dansJ = (j) => new Date(MAINTENANT + j * J).toISOString();
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: ilYaH(0) }];
const V = [
  { tx: 9401, titre: 'Alpha Nike taille 42', suivi: '41234567', num: '21', forme: 'mr' },
  { tx: 9402, titre: 'Bravo Adidas taille 40', suivi: '42234567', num: '22', forme: 'mr' },
  { tx: 9403, titre: 'Charlie Asics taille 41', suivi: 'XA123456789FR', num: '23', forme: 'chrono' },
];
const VC1 = 'Delta Cabas cuir', VC2 = 'Echo Pochette', LBC = 'Foxtrot Vans taille 38', EB = 'eBay Golf taille 43';
async function pdfInvente(code, forme) {
  const { PDFDocument, StandardFonts } = require(path.join(NM, 'pdf-lib'));
  const d = await PDFDocument.create();
  const p = forme === 'mr' ? d.addPage([283.46, 425.2]) : d.addPage([595.28, 841.89]);
  const f = await d.embedFont(StandardFonts.Helvetica);
  p.drawText((forme === 'mr' ? 'MONDIAL RELAY' : 'CHRONOPOST') + ' ETIQUETTE ' + code, { x: 20, y: p.getHeight() - 30, size: 10, font: f });
  return Buffer.from(await d.save()).toString('base64');
}
async function pagesDuPdf(b64) {
  const pdfjs = await import(pathToFileURL(path.join(PDFJS, 'legacy', 'build', 'pdf.mjs')).href);
  const doc = await pdfjs.getDocument({ data: new Uint8Array(Buffer.from(b64, 'base64')), verbosity: 0 }).promise;
  const out = [];
  for (let i = 1; i <= doc.numPages; i++) { const pg = await doc.getPage(i); const items = (await pg.getTextContent()).items; out.push({ t: items.map((x) => x.str).join(' ').replace(/\s+/g, ' '), items: items.map((x) => ({ s: x.str, x: x.transform[4], y: x.transform[5] })) }); }
  return out;
}
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.mjs': 'text/javascript' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
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
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' && typeof v !== 'object' ? String(v) : v);
  }
  return out;
};
const shot = async (pg, nom) => { if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, nom + '.png') }).catch(() => {}); };
async function scenario(b, nom, vue, LIGNES, sombre) {
  const ctx = await b.newContext({ ...vue, colorScheme: sombre ? 'dark' : 'light' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const mainData = LIGNES.find((r) => r.id === 'main').data;
  await pg.addInitScript(({ m, sombre }) => {
    try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', 'true'); localStorage.setItem('vinted_dark', JSON.stringify(!!sombre));
      if (!sessionStorage.getItem('banc_init')) { sessionStorage.setItem('banc_init', '1'); localStorage.setItem('vinted_annonce_numeros', JSON.stringify(m.vinted_annonce_numeros)); localStorage.setItem('vinted_used_numeros', JSON.stringify(m.vinted_used_numeros)); localStorage.setItem('vinted_sale_overrides', JSON.stringify(m.vinted_sale_overrides)); localStorage.removeItem('vrm_tampon_positions'); } } catch (_) {}
    window.__pdfs = [];
    const o = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob) => { try { if (blob && blob.type === 'application/pdf') window.__pdfs.push(blob); } catch (_) {} return o(blob); };
  }, { m: mainData, sombre });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**://cdn.jsdelivr.net/npm/pdfjs-dist@*/**', (r) => {
    const n = path.basename(new URL(r.request().url()).pathname);
    const f = path.join(PDFJS, 'build', n.replace(/\.js$/, '.mjs'));
    if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ status: 200, contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(f) });
  });
  await pg.addInitScript((port) => { import(`http://localhost:${port}/__pdfjs/pdf.min.mjs`).then((m) => { window.pdfjsLib = { ...m, getDocument: (o) => { const t = m.getDocument(o); return { promise: t.promise.then((d) => { if (typeof d.destroy !== 'function') d.destroy = () => t.destroy(); return d; }), destroy: () => t.destroy() }; } }; }).catch(() => {}); }, PORT);
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: r.data.capturedAt || ilYaH(0), cap: r.data.capturedAt });
    const filtres = [...u.matchAll(/[?&]data->>([a-zA-Z]+)=(not\.)?is\.null/g)].map((m) => ({ k: m[1], non: !!m[2] }));
    const passe = (r) => filtres.every((f) => (f.non ? r.data[f.k] != null : r.data[f.k] == null));
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(','); return j(LIGNES.filter((r) => ids.includes(r.id) && passe(r)).map(forme)); }
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1] && passe(r)).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id) && passe(r)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  ctx.on('page', (p) => { if (p !== pg) p.close().catch(() => {}); });
  await srvPret;
  await pg.goto(`http://localhost:${PORT}/?tab=cat_bord`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('button[data-lot-ouvrir="1"]', { timeout: 20000 }).catch(() => {});
  const stable = await pg.waitForFunction(() => { const t = document.body.innerText; return ['N°21', 'N°22', 'N°23'].every((n) => t.includes(n)) && /N°\d+\s+(· )?Delta/.test(t) && /N°\d+\s+(· )?Echo/.test(t) && /Foxtrot/.test(t) && /eBay Golf/.test(t); }, null, { timeout: 45000 }).then(() => true).catch(() => false);
  dit(stable, `${nom} : les colis des 4 sites sont à l'écran (N° lus)`);
  await pg.waitForTimeout(600);
  await shot(pg, `selection-${nom}-colis`);
  const ouvrir = async () => { await pg.click('button[data-lot-ouvrir="1"]'); await pg.waitForSelector('[data-lot-ligne]', { timeout: 8000 }).catch(() => {}); await pg.waitForTimeout(300); };
  const lignes = () => pg.evaluate(() => [...document.querySelectorAll('[data-lot-ligne]')].map((e) => { const cb = e.querySelector('input[type=checkbox]'); return { cle: e.getAttribute('data-lot-ligne'), site: e.getAttribute('data-lot-site'), coche: e.getAttribute('data-coche') === '1', pdf: e.getAttribute('data-lot-pdf'), cochable: e.getAttribute('data-lot-cochable'), dis: !!(cb && cb.disabled), sans: !!e.querySelector('[data-lot-sans-bordereau]'), ebay: !!e.querySelector('[data-lot-ebay]'), t: e.innerText }; }));
  await ouvrir();
  let L = await lignes();
  const de = (s) => L.filter((l) => l.site === s);
  dit(de('vestiaire').length === 2 && de('vestiaire').every((l) => l.cochable === '1' && !l.dis), `${nom} : A les 2 ventes Vestiaire sont cochables`, JSON.stringify(de('vestiaire')));
  dit(de('leboncoin').length === 1 && de('leboncoin')[0].cochable === '1' && !de('leboncoin')[0].dis, `${nom} : A la vente Leboncoin est cochable`, JSON.stringify(de('leboncoin')));
  dit(de('ebay').length === 1 && de('ebay')[0].dis && de('ebay')[0].ebay && /eBay/.test(de('ebay')[0].t), `${nom} : A eBay : ligne grisée « eBay », jamais cochable`, JSON.stringify(de('ebay')));
  const coches0 = L.filter((l) => l.coche).map((l) => l.cle).sort();
  const attendus0 = [...V.map((v) => String(v.tx)), 'vc:V1'].sort();
  dit(JSON.stringify(coches0) === JSON.stringify(attendus0), `${nom} : B cochées d'office = celles qui ont leur bordereau`, JSON.stringify(coches0));
  const sans = L.filter((l) => l.sans).map((l) => l.cle).sort();
  dit(JSON.stringify(sans) === JSON.stringify(['l:77001', 'vc:V2']), `${nom} : B « Sans bordereau » sur V2 et Leboncoin`, JSON.stringify(sans));
  await shot(pg, `selection-${nom}-apercu`);
  await pg.evaluate(() => { const b = [...document.querySelectorAll('[data-lot] button')].find((x) => x.innerText.trim() === 'Tout sélectionner'); if (b) b.click(); });
  await pg.waitForTimeout(300);
  L = await lignes();
  const tous = L.filter((l) => l.coche).map((l) => l.site);
  dit(L.filter((l) => l.coche).length === 6 && !tous.includes('ebay'), `${nom} : C « Tout sélectionner » coche tout sauf eBay`, JSON.stringify(L.map((l) => l.cle + ':' + l.coche)));
  for (const l of L.filter((x) => x.coche)) await pg.locator(`[data-lot-ligne="${l.cle}"] input`).nth(1).check().catch(() => {});
  // D : imprimer ; une feuille par type.
  const imprimer = async (bouton, { annuler = false, deplacer = false } = {}) => {
    const avant = await pg.evaluate(() => window.__pdfs.length);
    await pg.waitForSelector(bouton + ':not([disabled])', { timeout: 20000 }).catch(() => {});
    await pg.evaluate((b) => { const x = document.querySelector(b); if (x) x.click(); }, bouton);
    const formes = [];
    for (let i = 0; i < 240; i++) {
      const e = await pg.evaluate(({ annuler }) => {
        if (window.__pdfs.length > window.__avant) return { fin: 'pdf' };
        const clic = (l) => { const bs = [...document.querySelectorAll('button')].filter((x) => x.innerText.trim() === l && x.offsetParent); if (bs.length) { bs[bs.length - 1].click(); return true; } return false; };
        if (clic("J'ai vérifié, imprimer") || clic('Préparer quand même les PDF')) return { clic: 1 };
        const f = document.querySelector('[data-placeur-tampon]:not([data-placeur-tampon="charge"])');
        if (f && !f.__vu) { f.__vu = 1; return { feuille: f.getAttribute('data-forme') }; }
        if (!document.querySelector('[data-lot]')) return { fin: 'ferme' };
        return { attente: 1 };
      }, { annuler });
      if (e.feuille) {
        formes.push(e.feuille);
        if (annuler) { await pg.click('[data-tampon-annuler]'); await pg.waitForTimeout(1200); return { formes, pdf: (await pg.evaluate(() => window.__pdfs.length)) - avant }; }
        if (deplacer && /mondialrelay/.test(e.feuille)) { await pg.focus('[data-tampon-boite]'); for (let k = 0; k < 6; k++) await pg.keyboard.press('Shift+ArrowRight'); for (let k = 0; k < 4; k++) await pg.keyboard.press('Shift+ArrowDown'); }
        if (formes.length === 1) await shot(pg, `selection-${nom}-feuille`);
        await pg.click('[data-tampon-imprimer]');
      }
      if (e.fin) break;
      await pg.waitForTimeout(250);
    }
    return { formes, pdf: (await pg.evaluate(() => window.__pdfs.length)) - avant };
  };
  await pg.evaluate(() => { window.__avant = window.__pdfs.length; });
  // G d'abord : « Annuler » ⇒ aucun PDF, le lot reste.
  const g = await imprimer('button[data-lot-imprimer]', { annuler: true });
  dit(g.formes.length === 1 && g.pdf === 0 && !!(await pg.$('[data-lot]')), `${nom} : G « Annuler » dans la feuille ⇒ aucun PDF, la sélection reste`, JSON.stringify(g));
  await pg.evaluate(() => { window.__avant = window.__pdfs.length; });
  const d1 = await imprimer('button[data-lot-imprimer]', { deplacer: true });
  dit(d1.formes.length === 2 && new Set(d1.formes).size === 2 && /mondialrelay/.test(d1.formes[0] + d1.formes[1]) && /chronopost/.test(d1.formes[0] + d1.formes[1]), `${nom} : D une feuille par TYPE (Mondial Relay 10×15, Chronopost A4), une fois chacun`, JSON.stringify(d1.formes));
  dit(d1.pdf === 1, `${nom} : D un PDF`, String(d1.pdf));
  await pg.waitForFunction(() => { try { return Object.keys(JSON.parse(localStorage.getItem('vrm_tampon_positions') || '{}')).length > 0; } catch (_) { return false; } }, null, { timeout: 8000 }).catch(() => {});
  const pos = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_tampon_positions') || '{}'); } catch (_) { return null; } });
  const kMr = Object.keys(pos || {}).filter((k) => /^mondialrelay/.test(k));
  dit(kMr.length === 1, `${nom} : D « Toujours ici » garde la place du type déplacé (\`vrm_tampon_positions\`)`, JSON.stringify(Object.keys(pos || {})));
  const toast = await pg.evaluate(() => document.body.innerText.split('\n').filter((l) => /sans bordereau/.test(l)).join(' | '));
  dit(/2 sans bordereau/.test(toast) && /Echo Pochette/.test(toast) && /Foxtrot/.test(toast), `${nom} : E « 2 sans bordereau » nommés`, toast);
  if (d1.pdf) {
    const b64 = await pg.evaluate(async () => { const bl = window.__pdfs[window.__pdfs.length - 1]; const u = new Uint8Array(await bl.arrayBuffer()); let s = ''; for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); });
    const pages = await pagesDuPdf(b64);
    const codes = pages.map((p) => (/ETIQUETTE (\S+)/.exec(p.t) || [])[1]).filter(Boolean);
    dit(codes.length === 4 && !pages.some((p) => /eBay Golf/.test(p.t)), `${nom} : D 4 bordereaux (3 Vinted + Vestiaire), eBay jamais`, JSON.stringify(codes));
    // Le N° de chaque Mondial Relay au MÊME endroit (même type ⇒ même place).
    const ou = (code, num) => { const p = pages.find((x) => x.t.includes('ETIQUETTE ' + code)); const it = p && p.items.find((i) => i.s.replace(/\s/g, '') === 'N°' + num || i.s.trim() === num); return it ? [Math.round(it.x), Math.round(it.y)] : null; };
    const a = ou('9401', '21'), c = ou('9402', '22');
    dit(a && c && Math.abs(a[0] - c[0]) <= 3 && Math.abs(a[1] - c[1]) <= 3 && (Math.abs(a[0] - 17) > 10 || Math.abs(a[1] - 368) > 10), `${nom} : D les deux Mondial Relay ont leur N° au même endroit (la place posée, ±3 pt ; pas la place de VRM)`, JSON.stringify({ a, c }));
  }
  // F : second lot — le type gardé ne redemande pas ; « Placer le tampon » redemande tout.
  if (!(await pg.$('[data-lot]'))) await ouvrir();
  await pg.evaluate(() => { const b = [...document.querySelectorAll('[data-lot] button')].find((x) => x.innerText.trim() === 'Tout sélectionner'); if (b) b.click(); });
  for (const l of (await lignes()).filter((x) => x.coche)) await pg.locator(`[data-lot-ligne="${l.cle}"] input`).nth(1).check().catch(() => {});
  await pg.evaluate(() => { window.__avant = window.__pdfs.length; });
  const f1 = await imprimer('button[data-lot-imprimer]');
  dit(f1.formes.length === 1 && /chronopost/.test(f1.formes[0]), `${nom} : F le type gardé (Mondial Relay) ne redemande pas`, JSON.stringify(f1.formes));
  if (!(await pg.$('[data-lot]'))) await ouvrir();
  await pg.evaluate(() => { const b = [...document.querySelectorAll('[data-lot] button')].find((x) => x.innerText.trim() === 'Tout sélectionner'); if (b) b.click(); });
  for (const l of (await lignes()).filter((x) => x.coche)) await pg.locator(`[data-lot-ligne="${l.cle}"] input`).nth(1).check().catch(() => {});
  await pg.evaluate(() => { window.__avant = window.__pdfs.length; });
  const f2 = await imprimer('button[data-lot-placer]');
  dit(f2.formes.length === 2, `${nom} : F « Placer le tampon » rouvre la feuille de chaque type`, JSON.stringify(f2.formes));
  const deb = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  dit(deb <= 1, `${nom} : H rien ne déborde`, String(deb));
  dit(errs.length === 0, `${nom} : H aucune erreur d'app`, errs.join(' | ').slice(0, 200));
  await ctx.close();
}
let srvPret;
(async () => {
  let b;
  try {
    srvPret = new Promise((r) => srv.listen(PORT, r));
    const LIGNES = [
      { id: 'main', data: { vinted_used_numeros: [21, 22, 23], vinted_sale_overrides: Object.fromEntries(V.map((v) => [String(v.tx), { numero: v.num }])), vinted_annonce_numeros: Object.fromEntries(V.map((v) => [`i${v.tx}`, { numero: v.num, title: v.titre, auto: false, numberedAt: ilYaH(200) }])) } },
      { id: 'harvest_111_orders_sold', data: { capturedAt: ilYaH(0.2), payload: { my_orders: V.map((v, i) => ({ transaction_id: v.tx, title: v.titre, price: { amount: '50', currency_code: 'EUR' }, status: 'Le paiement a été validé', transaction_user_status: 'needs_action', date: ilYaH(20 + i) })) } } },
      ...V.map((v) => ({ id: `harvest_111_txn_${v.tx}`, data: { capturedAt: ilYaH(1), payload: { transaction: { id: v.tx, item_id: `i${v.tx}` } } } })),
      ...await Promise.all(V.map(async (v) => ({ id: 'email_bord_' + v.tx, data: { transaction: String(v.tx), uid: '111', filename: `bordereau-${v.tx}.pdf`, modele: v.titre, article: v.titre, receivedAt: ilYaH(2), pdfB64: await pdfInvente(String(v.tx), v.forme), suivi: v.suivi } }))),
      { id: 'vc_ventes', data: { lectures: { 'a-expedier': { at: ilYaH(0.3), complet: true }, ventes: { at: ilYaH(0.3) } }, ventes: {
        V1: { productId: '71000001', aExpedier: true, limite: dansJ(3), date: ilYaH(5), titre: VC1, etat: 'ACTION_NEEDED', montant: { valeur: 180.5, devise: 'EUR', cle: 'sellerEarning' }, transporteur: 'Chronopost', suivi: 'XW000000001FR', etiquette: true, bordereau: { id: 'vc_label_71000001', at: ilYaH(1) } },
        V2: { productId: '71000002', aExpedier: true, limite: dansJ(4), date: ilYaH(4), titre: VC2, etat: 'ACTION_NEEDED', montant: { valeur: 90, devise: 'EUR', cle: 'sellerEarning' }, transporteur: 'Chronopost', etiquette: false },
      } } },
      { id: 'vc_label_71000001', data: { b64: await pdfInvente('V1', 'chrono'), at: ilYaH(1) } },
      { id: 'lbc_ventes', data: { ventes: { 77001: { txId: 77001, itemId: '880001', title: LBC, isSeller: true, stepLabel: 'Colis à envoyer', stepStatus: 'validation', parcelColor: 'pending', parcelStatus: 'waiting', deliveryMethod: 'mondial_relay', price: 40, dateVente: ilYaH(10), label: { reference: 'R1', voucherUrl: 'https://www.leboncoin.fr/inventé/voucher.pdf', trackingUrl: 'https://example.invalid/t' } } } } },
      { id: 'ebay_orders', data: { capturedAt: MAINTENANT - 2 * H, orders: [{ orderId: 'E-9', creationDate: ilYaH(30), orderPaymentStatus: 'PAID', orderFulfillmentStatus: 'NOT_STARTED', cancelStatus: { cancelState: 'NONE_REQUESTED' }, fulfillmentStartInstructions: [{ fulfillmentInstructionsType: 'SHIP_TO' }], pricingSummary: { total: { value: '80.00', currency: 'EUR' } }, buyer: { username: 'acheteur_e9' }, lineItems: [{ lineItemId: '19', title: EB, sku: '', legacyItemId: '559', quantity: 1, lineItemCost: { value: '80.00', currency: 'EUR' }, lineItemFulfillmentInstructions: { shipByDate: dansJ(3) } }] }] } },
    ];
    b = await chromium.launch({ executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    const quoi = process.env.BANC_SEUL ? process.env.BANC_SEUL.split(',') : ['390', '1512', '1512s'];
    if (quoi.includes('390')) await scenario(b, '390', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, LIGNES, false);
    if (quoi.includes('1512')) await scenario(b, '1512', { viewport: { width: 1512, height: 950 } }, LIGNES, false);
    if (quoi.includes('1512s')) await scenario(b, '1512-sombre', { viewport: { width: 1512, height: 950 } }, LIGNES, true);
  } catch (e) { dit(false, 'le banc s’exécute', String(e.message || e).slice(0, 200)); }
  finally {
    if (b) await b.close(); srv.close();
    console.log(ko ? `\nKO selection-bordereaux : ${ko} contrôle(s) non conforme(s), ${ok} conforme(s)` : `\nOK selection-bordereaux : ${ok} conformes`);
    process.exit(ko ? 1 : 0);
  }
})();
