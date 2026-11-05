// Banc : « TOUT IMPRIMER » = UN PDF, TOUTES PLATEFORMES, TRIÉ PAR TRANSPORTEUR (3 nov., choix de Julien n° 2).
// Données INVENTÉES (dépôt public), formes réelles : ventes Vinted à expédier (`orders_sold`), leur
// transaction (`harvest_111_txn_{tx}` → item → fiche N°), leurs bordereaux e-mail (`email_bord_{tx}` :
// PDF + `suivi` ; la forme du n° dit le transporteur : 8 chiffres = Mondial Relay, 2 lettres + 9 chiffres +
// 2 lettres = Chronopost), une vente Vestiaire à envoyer avec son bordereau rapatrié (`vc_ventes`,
// `vc_label_*`). Chaque bordereau est un PDF fabriqué qui porte « ETIQUETTE <code> ».
// Le banc RELIT le PDF produit (pdf.js) et exige :
//  A. le bouton « Tout imprimer » est visible dans Colis → À envoyer (avant : caché derrière « … ») ;
//  B. l'aperçu groupe par transporteur dans l'ordre des groupes de l'ÉCRAN, toutes plateformes (Vestiaire compris) ;
//  C. le N° « à vérifier sur son carton » (fiche numérotée pendant la panne) DEMANDE avant le PDF ;
//  D. UN PDF : chaque bordereau dedans, dans l'ordre des groupes (tous ceux d'un transporteur à la suite) ;
//  E. chaque bordereau tamponné de SON titre et de SON N° (sur sa page, ou sur la fiche colis qui le suit) ;
//  F. aucune erreur ; rien ne déborde ; captures 390 tactile + 1512 (SHOTS=dossier).
// Lancer : construire dist/, puis node scripts/bancs/tout-imprimer.cjs   (BANC_PORT)
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const { pathToFileURL } = require('url');
const NM = path.join(__dirname, '..', '..', 'node_modules');
const PDFJS = fs.existsSync(path.join(NM, 'pdfjs-dist')) ? path.join(NM, 'pdfjs-dist') : '/opt/npm-tools/node_modules/pdfjs-dist';
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4491);
const SHOTS = process.env.SHOTS || '';
const MAINTENANT = Date.now(), H = 3600000, J = 24 * H;
const ilYaH = (h) => new Date(MAINTENANT - h * H).toISOString();
const dansJ = (j) => new Date(MAINTENANT + j * J).toISOString();
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: ilYaH(0) }];
// tx, titre, suivi (sa forme dit le transporteur), N°, PDF présent
const V = [
  { tx: 9201, titre: 'Alpha Nike taille 42', suivi: '41234567', num: '21' },
  { tx: 9202, titre: 'Bravo Adidas taille 40', suivi: 'XA123456789FR', num: '22' },
  { tx: 9203, titre: 'Charlie Asics taille 41', suivi: '42234567', num: '23', aVerifier: true },
  { tx: 9204, titre: 'Delta Puma taille 39', suivi: '', num: '24' },
  { tx: 9205, titre: 'Echo Vans taille 38', suivi: 'XB223456789FR', num: '25' },
];
const TR = { 9201: 'mondialrelay', 9202: 'chronopost', 9203: 'mondialrelay', 9204: 'autres', 9205: 'chronopost', V1: 'chronopost' };
const VC_TITRE = 'Foxtrot Cabas cuir';

async function pdfInvente(code) {
  const { PDFDocument, StandardFonts } = require(path.join(NM, 'pdf-lib'));
  const d = await PDFDocument.create(); const p = d.addPage([288, 432]); const f = await d.embedFont(StandardFonts.Helvetica);
  p.drawText('ETIQUETTE ' + code, { x: 20, y: 400, size: 12, font: f });
  return Buffer.from(await d.save()).toString('base64');
}
async function pagesDuPdf(b64) {
  const pdfjs = await import(pathToFileURL(path.join(PDFJS, 'legacy', 'build', 'pdf.mjs')).href);
  const doc = await pdfjs.getDocument({ data: new Uint8Array(Buffer.from(b64, 'base64')), verbosity: 0 }).promise;
  const out = [];
  for (let i = 1; i <= doc.numPages; i++) out.push((await (await doc.getPage(i)).getTextContent()).items.map((x) => x.str).join(' ').replace(/\s+/g, ' '));
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

async function scenario(b, nom, vue, LIGNES) {
  const ctx = await b.newContext({ ...vue, acceptDownloads: true });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  // Les fiches N° sont DÉJÀ sur l'appareil (comme chez lui) : sans elles, une vente lue avant la ligne
  // `main` reçoit un numéro neuf (règle « une annonce sans numéro en reçoit un ») et le banc mesurerait la course.
  const mainData = LIGNES.find((r) => r.id === 'main').data;
  await pg.addInitScript((m) => {
    try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', 'true');
      if (!sessionStorage.getItem('banc_init')) { sessionStorage.setItem('banc_init', '1'); localStorage.setItem('vinted_annonce_numeros', JSON.stringify(m.vinted_annonce_numeros)); localStorage.setItem('vinted_used_numeros', JSON.stringify(m.vinted_used_numeros)); } } catch (_) {}
    window.__pdfs = [];
    const o = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob) => { try { if (blob && blob.type === 'application/pdf') window.__pdfs.push(blob); } catch (_) {} return o(blob); };
  }, mainData);
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
  await pg.waitForFunction(() => document.querySelectorAll('[data-groupe-transp]').length >= 3, null, { timeout: 15000 }).catch(() => {});
  // Les N° arrivent avec les transactions (identité tx → annonce → fiche) : on attend qu'ils soient écrits.
  // (Et le N° de la vente Vestiaire, donné à son passage : un N° qui change entre l'aperçu et l'impression
  // ARRÊTE le lot — « Un article, son numéro ou son état a changé », le garde-fou `verifierContexte`.)
  // ⚠️ Course de l'app (avant ce chantier, règle des ventes à poster) : une vente lue AVANT sa transaction reçoit
  // un N° auto (`autoAssigned`), remplacé par celui de son annonce dès que la transaction arrive. On attend la fin.
  const nums = await pg.waitForFunction(() => { const t = document.body.innerText; return ['N°21', 'N°22', 'N°23', 'N°24', 'N°25'].every((n) => t.includes(n)) && !['N°27', 'N°28', 'N°29', 'N°30'].some((n) => t.includes(n)) && /N°\d+ · Foxtrot/.test(t); }, null, { timeout: 45000 }).then(() => true).catch(() => false);
  dit(nums, `${nom} : les N° des ventes Vinted sont lus (transaction → annonce → fiche) avant le lot`);
  await pg.waitForTimeout(800);
  if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `tout-imprimer-${nom}-colis.png`) });
  const btn = await pg.$('button[data-lot-ouvrir="1"]');
  const vis = btn ? await btn.isVisible() : false;
  dit(vis, `${nom} : A « Tout imprimer » est VISIBLE dans À envoyer`);
  if (!vis) { await ctx.close(); return; }
  // L'ordre des groupes de l'écran, et les colis de chaque groupe.
  const ecran = await pg.evaluate(() => {
    const out = []; let g = null;
    for (const el of document.querySelectorAll('[data-groupe-transp], [data-bord-card][data-tx-colis], [data-vc-colis]')) {
      if (el.hasAttribute('data-groupe-transp')) { g = el.getAttribute('data-groupe-transp'); if (!out.includes(g)) out.push(g); }
    }
    return out;
  });
  await btn.click();
  await pg.waitForSelector('[data-lot-ligne]', { timeout: 8000 }).catch(() => {});
  const ap = await pg.evaluate(() => [...document.querySelectorAll('[data-lot-ligne]')].map((e) => ({ cle: e.getAttribute('data-lot-ligne'), site: e.getAttribute('data-lot-site'), num: e.getAttribute('data-lot-num'), tr: e.getAttribute('data-lot-transp'), coche: e.getAttribute('data-coche') === '1' })));
  const grAp = ap.map((x) => x.tr).filter((x, i, a) => a.indexOf(x) === i);
  dit(ap.length === 6 && ap.some((x) => x.site === 'vestiaire'), `${nom} : B l'aperçu porte les 6 bordereaux, Vestiaire compris`, JSON.stringify(ap.map((x) => x.cle + ':' + x.site)));
  dit(JSON.stringify(grAp) === JSON.stringify(ecran.filter((g) => grAp.includes(g))) && grAp.length === 3, `${nom} : B groupes de l'aperçu = ordre des groupes de l'écran`, JSON.stringify({ apercu: grAp, ecran }));
  const contigu = ap.every((x, i) => i === 0 || x.tr === ap[i - 1].tr || !ap.slice(0, i - 1).some((y) => y.tr === x.tr));
  dit(contigu, `${nom} : B chaque transporteur d'un seul tenant`, JSON.stringify(ap.map((x) => x.tr)));
  if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `tout-imprimer-${nom}-apercu.png`) });
  // Tout cocher et contrôler, puis imprimer.
  for (const x of ap) { if (!x.coche) await pg.locator(`[data-lot-ligne="${x.cle}"] input`).first().check(); await pg.locator(`[data-lot-ligne="${x.cle}"] input`).nth(1).check(); }
  await pg.click('button[data-lot-imprimer]');
  // C : le N° à vérifier DEMANDE.
  // (Si une case « Contrôlé » n'a pas pris, la question « Vérifier les articles » passe d'abord : on la franchit.)
  let q = false;
  for (let i = 0; i < 60 && !q; i++) {
    const t = await pg.evaluate(() => document.body.innerText);
    if (/N°23 n.est pas encore vérifié/.test(t)) q = true;
    else if (/Préparer quand même les PDF/.test(t)) await pg.evaluate(() => { const bs = [...document.querySelectorAll('button')].filter((x) => x.innerText.trim() === 'Préparer quand même les PDF'); if (bs.length) bs[bs.length - 1].click(); });
    if (!q) await pg.waitForTimeout(250);
  }
  if (!q && SHOTS) await pg.screenshot({ path: path.join(SHOTS, `tout-imprimer-${nom}-sans-question.png`) });
  dit(q, `${nom} : C le N° « à vérifier » (23) DEMANDE avant le PDF`, JSON.stringify(ap.map((x) => x.cle + "=" + x.num)));
  if (q) await pg.evaluate(() => { const bs = [...document.querySelectorAll('button')].filter((x) => /J'ai vérifié, imprimer/.test(x.innerText)); bs[bs.length - 1].click(); });
  // Jusqu'au PDF : une confirmation encore ouverte (animation, clic tombé à côté) est retouchée.
  for (let i = 0; i < 180; i++) {
    const etat = await pg.evaluate(() => {
      if (window.__pdfs && window.__pdfs.length) return 'pdf';
      const clic = (l) => { const bs = [...document.querySelectorAll('button')].filter((x) => x.innerText.trim() === l && x.offsetParent); if (bs.length) { bs[bs.length - 1].click(); return true; } return false; };
      if (clic("J'ai vérifié, imprimer") || clic('Préparer quand même les PDF')) return 'clic';
      // (4 nov.) La feuille du tampon (un type sans place gardée) : « Imprimer » à la place choisie par VRM.
      const f = document.querySelector('[data-placeur-tampon]:not([data-placeur-tampon="charge"]) [data-tampon-imprimer]'); if (f) { f.click(); return 'clic'; }
      return 'attente';
    });
    if (etat === 'pdf') break;
    await pg.waitForTimeout(250);
  }
  const b64 = await pg.evaluate(async () => { const bl = window.__pdfs[window.__pdfs.length - 1]; if (!bl) return null; const u = new Uint8Array(await bl.arrayBuffer()); let s = ''; for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); });
  const nPdf = await pg.evaluate(() => window.__pdfs.length);
  if (SHOTS && nPdf !== 1) await pg.screenshot({ path: path.join(SHOTS, `tout-imprimer-${nom}-pdf.png`) });
  const toastTxt = nPdf === 1 ? '' : await pg.evaluate(() => document.body.innerText.split('\n').filter((l) => /PDF|chang|Erreur|lecture|Préparation|sélectionn|imprim/i.test(l)).join(' | ').slice(0, 600));
  dit(!!b64 && nPdf === 1, `${nom} : D UN seul PDF`, String(nPdf) + ' ' + toastTxt);
  if (b64) {
    const pages = await pagesDuPdf(b64);
    const ordre = [];
    pages.forEach((t, i) => { const m = /ETIQUETTE (\S+)/.exec(t); if (m) ordre.push({ code: m[1], i }); });
    dit(ordre.length === 6, `${nom} : D les 6 bordereaux sont dans le PDF`, JSON.stringify(ordre.map((x) => x.code)));
    dit(JSON.stringify(ordre.map((x) => x.code)) === JSON.stringify(ap.map((x) => x.cle.replace(/^vc:/, ''))), `${nom} : D l'ordre du PDF = l'ordre de l'aperçu (groupes de l'écran)`, JSON.stringify({ pdf: ordre.map((x) => x.code), apercu: ap.map((x) => x.cle) }));
    const trPdf = ordre.map((x) => TR[x.code]);
    const contiguPdf = trPdf.every((x, i) => i === 0 || x === trPdf[i - 1] || !trPdf.slice(0, i - 1).includes(x));
    dit(contiguPdf, `${nom} : D tous les bordereaux d'un transporteur à la suite`, JSON.stringify(trPdf));
    const attendu = Object.fromEntries([...V.map((v) => [String(v.tx), { t: v.titre, n: v.num }]), ['V1', { t: VC_TITRE, n: ((ap.find((x) => x.cle === 'vc:V1') || {}).num) || '?' }]]);
    const tamp = ordre.map((x) => { const a = attendu[x.code]; const zone = pages[x.i] + ' ' + (pages[x.i + 1] && !/ETIQUETTE/.test(pages[x.i + 1]) ? pages[x.i + 1] : '');
      return { code: x.code, titre: zone.includes(a.t), num: new RegExp(`(^|\\D)${a.n}(\\D|$)`).test(zone.replace(/ETIQUETTE \S+/g, '')) }; });
    dit(tamp.every((x) => x.titre && x.num), `${nom} : E chaque bordereau porte SON titre et SON N° (sa page ou sa fiche colis)`, JSON.stringify(tamp.filter((x) => !x.titre || !x.num)));
  }
  const deb = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  dit(deb <= 1, `${nom} : F rien ne déborde`, String(deb));
  dit(errs.length === 0, `${nom} : F aucune erreur d'app`, errs.join(' | ').slice(0, 200));
  await ctx.close();
}
let srvPret;
(async () => {
  let b;
  try {
    srvPret = new Promise((r) => srv.listen(PORT, r));
    const LIGNES = [
      { id: 'main', data: { vinted_used_numeros: [12, 21, 22, 23, 24, 25], vinted_annonce_numeros: Object.fromEntries(V.map((v) => [`i${v.tx}`, { numero: v.num, title: v.titre, auto: v.aVerifier ? undefined : false, numberedAt: v.aVerifier ? '2026-10-15T10:00:00.000Z' : ilYaH(200) }])) } },
      { id: 'harvest_111_orders_sold', data: { capturedAt: ilYaH(0.2), payload: { my_orders: V.map((v, i) => ({ transaction_id: v.tx, title: v.titre, price: { amount: '50', currency_code: 'EUR' }, status: 'Le paiement a été validé', transaction_user_status: 'needs_action', date: ilYaH(20 + i) })) } } },
      ...V.map((v) => ({ id: `harvest_111_txn_${v.tx}`, data: { capturedAt: ilYaH(1), payload: { transaction: { id: v.tx, item_id: `i${v.tx}` } } } })),
      ...await Promise.all(V.map(async (v) => ({ id: 'email_bord_' + v.tx, data: { transaction: String(v.tx), uid: '111', filename: `bordereau-${v.tx}.pdf`, modele: v.titre, article: v.titre, receivedAt: ilYaH(2), pdfB64: await pdfInvente(String(v.tx)), suivi: v.suivi } }))),
      { id: 'vc_ventes', data: { lectures: { 'a-expedier': { at: ilYaH(0.3), complet: true }, ventes: { at: ilYaH(0.3) } }, ventes: {
        V1: { productId: '71000001', aExpedier: true, limite: dansJ(3), date: ilYaH(5), titre: VC_TITRE, etat: 'ACTION_NEEDED', num: '12',
          montant: { valeur: 180.5, devise: 'EUR', cle: 'sellerEarning' }, transporteur: 'Chronopost', suivi: 'XW000000001FR', etiquette: true, bordereau: { id: 'vc_label_71000001', at: ilYaH(1) } },
      } } },
      { id: 'vc_label_71000001', data: { b64: await pdfInvente('V1'), at: ilYaH(1) } },
    ];
    b = await chromium.launch({ executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    await scenario(b, '390', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, LIGNES);
    await scenario(b, '1512', { viewport: { width: 1512, height: 950 } }, LIGNES);
  } catch (e) { dit(false, 'le banc s’exécute', String(e.message || e).slice(0, 200)); }
  finally {
    if (b) await b.close(); srv.close();
    console.log(ko ? `\nKO tout-imprimer : ${ko} contrôle(s) non conforme(s), ${ok} conforme(s)` : `\nOK tout-imprimer : ${ok} conformes`);
    process.exit(ko ? 1 : 0);
  }
})();
