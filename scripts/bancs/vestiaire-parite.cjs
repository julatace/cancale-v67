// ═══════════════════════════════════════════════════════════════════════════
// BANC : VESTIAIRE COMME VINTED ET LEBONCOIN (2 novembre, soir)
//        (node scripts/bancs/vestiaire-parite.cjs — après la construction ;
//         BANC_PORT pour changer de port, 8063 par défaut ; SHOTS=dossier pour
//         garder les captures)
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « pour Vestiaire c'est bien, juste c'est beaucoup zoomé sur le
// produit ; et pour la vente je veux la même mise en page avec les mêmes
// fonctionnalités que Vinted, Leboncoin ; je veux un numéro attribué par annonce
// et je veux que le titre de l'annonce soit tamponné sur le bordereau. »
// Données INVENTÉES (dépôt public). L'extension a rangé : trois annonces
// Vestiaire (P1 et P2 au MÊME titre, P3 retirée), une vente à expédier (V1, du
// produit P1, Chronopost + suivi, bordereau PDF rapatrié), le pool porte 1 → 12.
// Exigé, à 390 px tactile (clair) et 1512 px (sombre) :
//   A. Annonces : la photo ENTIÈRE (object-fit: contain), un N° par annonce
//      (P1 ≠ P2 malgré le même titre, au-dessus de 12), aucun pour P3 ;
//      les N° donnés entrent dans le pool (append-only) ;
//   B. Ventes : la ligne de V1 est LA ligne de Vinted (`vrm-sale-row`, mêmes
//      data-* et mêmes cases : bouton, titre, état, montant, achat, bénéfice),
//      elle porte le N° de SON annonce (P1), le transporteur écrit UNE fois ;
//      le récapitulatif s'ouvre au toucher, avec ce N° ;
//   C. Colis → À envoyer : la carte de V1 = la carte d'un colis Vinted
//      (`vrm-colis-carte`, Imprimer · Imprimé · Colis fait), son N°, le
//      transporteur écrit UNE fois (il l'était deux fois) ;
//   D. « Imprimer » : le PDF produit porte le TITRE et le N° (lu par pdf.js) ;
//      la ligne rangée `vc_label_P1` n'est jamais réécrite ;
//   E. « Colis fait » : le colis sort de « à envoyer » (et y revient).
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const { pathToFileURL } = require('url');
const DIST = path.join(__dirname, '..', '..', 'dist');
const NM = path.join(__dirname, '..', '..', 'node_modules');
const PORT = Number(process.env.BANC_PORT) || 8063;
const SHOTS = process.env.SHOTS || '';
// Le tampon ne se pose qu'après avoir VÉRIFIÉ l'espace blanc, rendu par pdf.js
// (cdn.jsdelivr.net, 3.11.174, chargé au clic). Le banc sert pdf.js en local :
// BANC_PDFJS_DIR (la 3.11.174, comme `lbc-bordereau.cjs`) s'il est posé ; sinon
// la pdfjs-dist du dépôt (node_modules, ESM), chargée d'avance en
// `window.pdfjsLib` — l'app la prend telle quelle (`chargerPdfjs`) ; seul
// `document.destroy` (3.x) est rendu par la tâche de chargement (6.x). Réseau
// fermé ici : la 3.11 ne se télécharge pas.
const PDFJS_DIR = process.env.BANC_PDFJS_DIR && fs.existsSync(path.join(process.env.BANC_PDFJS_DIR, 'pdf.min.js')) ? process.env.BANC_PDFJS_DIR : '';
const MAINTENANT = Date.now(), H = 3600000, J = 24 * H;
const ilYaH = (h) => new Date(MAINTENANT - h * H).toISOString();
const dansJ = (j) => new Date(MAINTENANT + j * J).toISOString();
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: ilYaH(0) }];
const TITRE = 'Cabas toile beige';
const PHOTO = (n) => `https://images.vestiairecollective.com/produit/${n}-1_3.jpg`;
let LIGNES = null;
const ecritures = [];

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 160)); } };

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.onnx': 'application/octet-stream', '.mjs': 'text/javascript' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = f.startsWith('/__pdfjs/') ? path.join(NM, 'pdfjs-dist', 'build', path.basename(f)) : path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul (BANC_PORT=…)'); process.exit(1); });
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' ? String(v) : v);
  }
  return out;
};
// Un bordereau inventé (format 10×15) : de quoi tamponner, et rien du titre.
async function pdfInvente() {
  const { PDFDocument, StandardFonts } = require(path.join(NM, 'pdf-lib'));
  const d = await PDFDocument.create(); const p = d.addPage([288, 432]); const f = await d.embedFont(StandardFonts.Helvetica);
  p.drawText('ETIQUETTE TRANSPORTEUR', { x: 20, y: 400, size: 12, font: f });
  p.drawText('XW000000001FR', { x: 20, y: 380, size: 10, font: f });
  return Buffer.from(await d.save()).toString('base64');
}
async function texteDuPdf(b64) {
  const pdfjs = await import(pathToFileURL(path.join(NM, 'pdfjs-dist', 'legacy', 'build', 'pdf.mjs')).href);
  const doc = await pdfjs.getDocument({ data: new Uint8Array(Buffer.from(b64, 'base64')), verbosity: 0 }).promise;
  let t = '';
  for (let i = 1; i <= doc.numPages; i++) t += (await (await doc.getPage(i)).getTextContent()).items.map((x) => x.str).join(' ') + '\n';
  return t;
}

async function preparer(b, vp, sombre) {
  const ctx = await b.newContext({ viewport: vp, colorScheme: sombre ? 'dark' : 'light', ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  if (process.env.BANC_DEBUG) pg.on('console', (m) => console.log('   [console] ' + m.text().slice(0, 200)));
  await pg.addInitScript((sombre) => {
    try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(!!sombre)); localStorage.setItem('vrm_visite_vue', 'true'); } catch (_) {}
    // Les PDF produits par la page (le bordereau tamponné), gardés pour le banc.
    window.__pdfs = [];
    window.__vus = [];
    try { new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) { const t = (n.textContent || '').trim(); if (t && t.length < 300) window.__vus.push(t); } }).observe(document, { childList: true, subtree: true }); } catch (_) {}
    const o = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob) => { try { if (blob && blob.type === 'application/pdf') window.__pdfs.push(blob); } catch (_) {} return o(blob); };
  }, sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    // La photo Vestiaire : une image PNG haute (portrait) servie, pour juger « contenue ».
    if (/images\.vestiairecollective\.com/.test(r.request().url())) return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect width="300" height="200" fill="#c8b08a"/></svg>' });
    return ['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue();
  });
  // Posée APRÈS le fourre-tout : Playwright essaie la dernière route d'abord.
  await pg.route('**://cdn.jsdelivr.net/npm/pdfjs-dist@*/**', (r) => {
    const nom = path.basename(new URL(r.request().url()).pathname);
    const f = PDFJS_DIR ? path.join(PDFJS_DIR, nom) : path.join(NM, 'pdfjs-dist', 'build', nom.replace(/\.js$/, '.mjs'));
    if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ status: 200, contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(f) });
  });
  if (!PDFJS_DIR) await pg.addInitScript((port) => { import(`http://localhost:${port}/__pdfjs/pdf.min.mjs`).then((m) => { window.pdfjsLib = { ...m, getDocument: (o) => { const t = m.getDocument(o); return { promise: t.promise.then((d) => { if (typeof d.destroy !== 'function') d.destroy = () => t.destroy(); return d; }), destroy: () => t.destroy() }; } }; }).catch(() => {}); }, PORT);
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') { ecritures.push({ m: req.method(), u, corps: req.postData() || '' }); return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' }); }
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: r.data.capturedAt || ilYaH(0), cap: r.data.capturedAt });
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(','); return j(LIGNES.filter((r) => ids.includes(r.id)).map(forme)); }
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs };
}
const capture = async (pg, nom) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, nom + '.png'), fullPage: false }); };
const sain = async (pg, ecran) => {
  const r = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, t: document.body.innerText }));
  dit(r.sw <= r.cw + 1, `${ecran} : aucun débordement horizontal`, `${r.sw} > ${r.cw}`);
  const m = /n'a pas pu s'afficher|n’a pas pu s’afficher|Cannot access|is not defined/.exec(r.t);
  dit(!m, `${ecran} : l'écran n'est pas tombé sur le garde-fou`, m && m[0]);
};
const compte = (t, mot) => (String(t).match(new RegExp(mot, 'g')) || []).length;

(async () => {
  let b;
  try {
    const PDF = await pdfInvente();
    srv.listen(PORT);
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const [vp, sombre] of [[{ width: 390, height: 844 }, false], [{ width: 1512, height: 950 }, true]]) {
      const nomVp = `${vp.width}${sombre ? '-sombre' : ''}`;
      console.log(`── ${nomVp}`);
      LIGNES = [
        { id: 'main', data: { vinted_ship_done: {}, vinted_used_numeros: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], vinted_annonce_numeros: {} } },
        { id: 'harvest_111_orders_sold', data: { capturedAt: ilYaH(0.2), payload: { my_orders: [] } } },
        { id: 'vc_listings', data: { capturedAt: ilYaH(0.3), complet: true, liens: {}, items: {
          71000001: { titre: TITRE, photo: PHOTO(71000001), statut: 'published', vuAt: ilYaH(0.3), prix: { valeur: 220, devise: 'EUR', cle: 'price' } },
          71000002: { titre: TITRE, photo: PHOTO(71000002), statut: 'published', vuAt: ilYaH(0.3), prix: { valeur: 230, devise: 'EUR', cle: 'price' } },
          71000003: { titre: 'Escarpins tressés', photo: PHOTO(71000003), statut: 'deleted', vuAt: ilYaH(0.3) },
        } } },
        { id: 'vc_ventes', data: { lectures: { 'a-expedier': { at: ilYaH(0.3), complet: true }, ventes: { at: ilYaH(0.3) } }, ventes: {
          V1: { productId: '71000001', aExpedier: true, limite: dansJ(3), date: ilYaH(5), titre: TITRE, photo: PHOTO(71000001), etat: 'ACTION_NEEDED',
            montant: { valeur: 180.5, devise: 'EUR', cle: 'sellerEarning' }, transporteur: 'Chronopost', suivi: 'XW000000001FR', etiquette: true, bordereau: { id: 'vc_label_71000001', at: ilYaH(1) } },
        } } },
        { id: 'vc_label_71000001', data: { b64: PDF, at: ilYaH(1) } },
      ];
      ecritures.length = 0;
      const { ctx, pg, errs } = await preparer(b, vp, sombre);
      let n1 = '', n2 = '';
      await essaie('A. Annonces', async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=annonces&site=vestiaire`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('[data-vc-annonces="lu"]', { timeout: 20000 });
        await pg.waitForFunction(() => document.querySelectorAll('[data-vc-annonce-num]:not([data-vc-annonce-num=""])').length >= 2, null, { timeout: 15000 }).catch(() => {});
        await pg.waitForTimeout(800);
        const a = await pg.evaluate(() => [...document.querySelectorAll('[data-vc-annonce]')].map((li) => {
          const img = li.querySelector('img'); const cs = img ? getComputedStyle(img) : null;
          return { id: li.getAttribute('data-vc-annonce'), num: li.getAttribute('data-vc-annonce-num'), fit: cs ? cs.objectFit : '', h: img ? img.getBoundingClientRect().height : 0, w: img ? img.getBoundingClientRect().width : 0 };
        }));
        const p1 = a.find((x) => x.id === '71000001') || {}, p2 = a.find((x) => x.id === '71000002') || {}, p3 = a.find((x) => x.id === '71000003') || {};
        n1 = p1.num || ''; n2 = p2.num || '';
        dit(n1 && n2 && n1 !== n2, 'A · un N° par annonce : deux annonces au MÊME titre, deux N° distincts', `${n1} / ${n2}`);
        dit(Number(n1) > 12 && Number(n2) > 12, 'A · N° neufs au-dessus du plus haut du pool (12), jamais un N° déjà servi', `${n1} / ${n2}`);
        dit(!p3.num, 'A · l’annonce retirée ne reçoit pas de N°', p3.num);
        dit(a.length === 3 && a.every((x) => x.fit === 'contain'), 'A · la photo ENTIÈRE (object-fit: contain), pas un gros plan', a.map((x) => x.fit).join(','));
        dit(p1.h > 0 && Math.abs(p1.w / p1.h - 0.8) < 0.05, 'A · aux proportions des fiches (4/5)', `${Math.round(p1.w)}×${Math.round(p1.h)}`);
        const ls = await pg.evaluate(() => ({ pool: JSON.parse(localStorage.getItem('vinted_used_numeros') || '[]'), vc: JSON.parse(localStorage.getItem('vrm_vc_numeros') || '{}') }));
        await pg.waitForTimeout(800);
        const ls2 = await pg.evaluate(() => ({ pool: JSON.parse(localStorage.getItem('vinted_used_numeros') || '[]'), vc: JSON.parse(localStorage.getItem('vrm_vc_numeros') || '{}') }));
        dit(ls2.pool.map(String).includes(n1) && ls2.pool.map(String).includes(n2) && [1, 12].every((x) => ls2.pool.includes(x)), 'A · les N° donnés entrent dans le pool (append-only, rien retiré)', JSON.stringify(ls2.pool));
        dit(ls2.vc['71000001'] && ls2.vc['71000001'].numero === n1, 'A · rangé par productId (vrm_vc_numeros)', JSON.stringify(ls2.vc));
        await capture(pg, `annonces-${nomVp}`);
        await sain(pg, 'Annonces');
      });
      await essaie('B. Ventes', async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=ventes&site=vestiaire`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('[data-vc-vente="V1"]', { timeout: 20000 });
        await pg.waitForTimeout(600);
        const r = await pg.evaluate(() => {
          const l = document.querySelector('[data-vc-vente="V1"]');
          const q = (s) => !!l.querySelector(s);
          return {
            classe: l.className, plateforme: l.getAttribute('data-plateforme-vente'), num: l.getAttribute('data-vc-vente-num'), tx: l.getAttribute('data-tx'), ouverte: l.getAttribute('data-ligne-ouverte'),
            cases: { bouton: q('button.vrm-ledger-sale-toggle'), titre: q('.vrm-ledger-sale-title'), etat: q('.vrm-ledger-sale-state'), montant: q('.vrm-ledger-sale-amount[data-prix-vente]'), achat: q('.vrm-ledger-sale-achat[data-achat-ligne]'), benef: q('.vrm-ledger-sale-benef[data-benef-ligne]') },
            prix: (l.querySelector('[data-prix-vente]') || {}).getAttribute ? l.querySelector('[data-prix-vente]').getAttribute('data-prix-vente') : '',
            titre: (l.querySelector('.vrm-ledger-sale-nom') || {}).textContent || '', etatTxt: (l.querySelector('.vrm-ledger-sale-state') || {}).textContent || '',
            t: l.innerText, liste: !!l.closest('.vrm-ventes-liste'),
          };
        });
        dit(/vrm-sale-row/.test(r.classe) && r.plateforme === 'vestiaire' && r.tx === 'vc:V1' && r.ouverte != null && r.liste, 'B · la ligne de Vinted (`vrm-sale-row`, data-tx, data-plateforme-vente, data-ligne-ouverte, dans `vrm-ventes-liste`)', JSON.stringify({ c: r.classe, p: r.plateforme, tx: r.tx }));
        dit(Object.values(r.cases).every(Boolean), 'B · mêmes cases que Vinted : bouton, titre, état, montant, achat, bénéfice', JSON.stringify(r.cases));
        dit(r.num === n1 && r.titre.startsWith(`N°${n1} · `), 'B · la vente porte le N° de SON annonce (productId), écrit comme sur Vinted « N° · titre »', `${r.num} · ${r.titre}`);
        dit(r.prix === '18050' && /À expédier/.test(r.etatTxt), 'B · ce que Vestiaire verse (180,50 €) et « À expédier »', `${r.prix} · ${r.etatTxt}`);
        dit(compte(r.t, 'Chronopost') <= 1, 'B · le transporteur jamais écrit deux fois sur la ligne', String(compte(r.t, 'Chronopost')));
        await capture(pg, `ventes-${nomVp}`);
        await pg.click('[data-vc-vente="V1"] .vrm-ledger-sale-toggle');
        const rec = await pg.waitForSelector('[data-recap-vente]:visible', { timeout: 8000 }).then(() => pg.evaluate(() => { const d = [...document.querySelectorAll('[data-recap-vente]')].find((x) => x.offsetParent !== null); return d ? { num: (d.querySelector('[data-recap-num]') || {}).getAttribute('data-recap-num'), imp: !!d.querySelector('[data-vc-imprimer]'), tr: (d.querySelector('.vrm-recap-principal [data-transporteur]') || { getAttribute: () => '' }).getAttribute('data-transporteur'), fait: !!d.querySelector('[data-vc-fait]'), t: d.innerText } : null; })).catch(() => null);
        dit(rec && rec.num === n1 && rec.imp && rec.fait, 'B · le récapitulatif au toucher (N°, Imprimer, Colis fait)', JSON.stringify(rec && { num: rec.num, imp: rec.imp, fait: rec.fait }));
        dit(rec && rec.tr === 'chronopost' && compte(rec.t, 'Chronopost') === 1, 'B · le transporteur (pastille) à côté du bouton bordereau, écrit une fois', JSON.stringify(rec && { tr: rec.tr, n: compte(rec.t, 'Chronopost') }));
        await capture(pg, `ventes-recap-${nomVp}`);
        await sain(pg, 'Ventes');
      });
      await essaie('C. Colis', async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=cat_bord`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('[data-colis-onglet-choix="envoyer"]', { timeout: 15000 }).then(() => pg.click('[data-colis-onglet-choix="envoyer"]')).catch(() => {});
        await pg.waitForSelector('[data-vc-colis="V1"]', { timeout: 15000 });
        await pg.waitForTimeout(500);
        const c = await pg.evaluate(() => { const x = document.querySelector('[data-vc-colis="V1"]'); return { classe: x.className, bord: x.hasAttribute('data-bord-card'), num: x.getAttribute('data-vc-colis-num'), chip: (x.querySelector('.vrm-colis-num') || {}).textContent || '', t: x.innerText,
          gestes: [...x.querySelectorAll('[data-geste]')].map((g) => g.getAttribute('data-geste')), imprimer: !!x.querySelector('[data-imprime].vrm-colis-primaire'), titre: !!x.querySelector('.vrm-colis-titre'), h: Math.min(...[...x.querySelectorAll('button')].map((b) => b.getBoundingClientRect().height)) }; });
        dit(/vrm-colis-carte/.test(c.classe) && c.bord && c.titre && c.imprimer, 'C · la carte d’un colis Vinted (vrm-colis-carte, data-bord-card, Imprimer en tête)', c.classe);
        dit(c.num === n1 && c.chip === `N°${n1}`, 'C · le N° de son annonce sur la carte', `${c.num} · ${c.chip}`);
        dit(c.gestes.join() === 'imprime,fait', 'C · Imprimé · Colis fait, comme Vinted', c.gestes.join());
        dit(compte(c.t, 'Chronopost') === 1 && compte(c.t, 'XW000000001FR') === 1, 'C · « Chronopost · suivi … » écrit UNE fois (il l’était deux fois)', `${compte(c.t, 'Chronopost')} / ${compte(c.t, 'XW000000001FR')}`);
        dit(c.h >= 44, 'C · gestes à 44 px', String(c.h));
        const tr = await pg.evaluate(() => { const x = document.querySelector('[data-vc-colis="V1"] .vrm-colis-actions [data-colis-transporteur]'); return x ? x.getAttribute('data-transporteur') : ''; });
        dit(tr === 'chronopost', 'C · la pastille transporteur à côté du bouton bordereau, comme Vinted', tr);
        await capture(pg, `colis-${nomVp}`);
        await sain(pg, 'Colis');
      });
      await essaie('D. Bordereau tamponné', async () => {
        const avant = ecritures.length;
        await pg.click('[data-vc-imprimer="V1"]');
        await pg.waitForFunction(() => window.__pdfs && window.__pdfs.length > 0, null, { timeout: 15000 }).catch(async (e) => { if (process.env.BANC_DEBUG) console.log(await pg.evaluate(() => window.__vus.slice(-15).join(' | '))); throw e; });
        const b64 = await pg.evaluate(async () => { const bl = window.__pdfs[window.__pdfs.length - 1]; const u = new Uint8Array(await bl.arrayBuffer()); let s = ''; for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); });
        const t = await texteDuPdf(b64);
        dit(t.includes(TITRE), 'D · le TITRE de l’annonce est tamponné sur le bordereau', t.replace(/\s+/g, ' ').slice(0, 160));
        dit(new RegExp(`(^|\\D)${n1}(\\D|$)`).test(t.replace(/XW\d+FR/g, '')), `D · le N°${n1} est tamponné`, t.replace(/\s+/g, ' ').slice(0, 160));
        dit(t.includes('ETIQUETTE TRANSPORTEUR'), 'D · le bordereau d’origine est dedans');
        const ecritLabel = ecritures.slice(avant).some((e) => /vc_label_/.test(e.u + e.corps));
        dit(!ecritLabel, 'D · la ligne rangée vc_label_… n’est jamais réécrite');
        await pg.waitForTimeout(1000);   // `save` écrit 500 ms après le geste
        const imp = await pg.evaluate(() => JSON.parse(localStorage.getItem('vrm_vc_imprimes') || '{}'));
        const visible = await pg.evaluate(() => { const g = document.querySelector('[data-vc-imprime="V1"]'); return g ? g.textContent : ''; });
        dit(imp.V1 && /Imprimé/.test(visible), 'D · imprimer marque « ✓ Imprimé »', visible);
        await capture(pg, `bordereau-${nomVp}`);
        await pg.keyboard.press('Escape').catch(() => {});
      });
      await essaie('E. Colis fait', async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=cat_bord`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('[data-colis-onglet-choix="envoyer"]', { timeout: 15000 }).then(() => pg.click('[data-colis-onglet-choix="envoyer"]')).catch(() => {});
        await pg.waitForSelector('[data-vc-fait="V1"]', { timeout: 15000 });
        await pg.click('[data-vc-fait="V1"]');
        await pg.waitForTimeout(500);
        const e = await pg.evaluate(() => { const b = document.querySelector('[data-colis-vestiaire]'); return { n: b && b.getAttribute('data-colis-vestiaire'), f: b && b.getAttribute('data-colis-vestiaire-faits'), txt: (document.querySelector('[data-vc-fait="V1"]') || {}).textContent || '' }; });
        dit(e.n === '0' && e.f === '1' && /Pas encore/.test(e.txt), 'E · « Colis fait » : il sort de « à envoyer », annulable', JSON.stringify(e));
        await pg.click('[data-vc-fait="V1"]');
        await pg.waitForTimeout(400);
        const e2 = await pg.evaluate(() => (document.querySelector('[data-colis-vestiaire]') || { getAttribute: () => null }).getAttribute('data-colis-vestiaire'));
        dit(e2 === '1', 'E · « ↺ Pas encore » le remet à envoyer', e2);
      });
      dit(errs.length === 0, 'aucune erreur de page', errs.join(' | ').slice(0, 200));
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ Vestiaire comme Vinted : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ Vestiaire comme Vinted : ${ok} verts`);
  process.exit(ko ? 1 : 0);
})();
