// ═══════════════════════════════════════════════════════════════════════════
// BANC : DOSSIER DE LITIGE EN PDF (BJ), VITESSE D'ENVOI (BM), AVIS VINTED (BN)
//        (node scripts/bancs/dossier-vitesse-avis.cjs — après `npm run build`)
//        BANC_PORT=… pour un autre port · BANC_DIST=… pour un autre build ·
//        BANC_SHOTS=<dossier> pour les captures et les PDF téléchargés
// ═══════════════════════════════════════════════════════════════════════════
// Données INVENTÉES (dépôt public) à la forme MESURÉE le 10 nov. :
//   · ventes Vinted (`harvest_111_orders_sold`), transaction 440 « Retour initié »,
//     bordereau e-mail `email_bord_9401` (PDF inventé, 2 pages), photo du carton
//     `colis_photo_v_9401` (PNG inventé), la vente porte un acheteur inventé
//     (« jeanne_m », une adresse) : RIEN ne doit en passer dans le PDF ;
//   · « Colis fait » (`vinted_ship_done`) daté pour 9408 (+20 h) et 9409 (+44 h),
//     9410 finalisée SANS preuve datée ;
//   · avis : `harvest_111_feedbacks` { id, rating, feedback } SANS date, 20 avis,
//     `pagination.total_entries` 120 ; profil `harvest_111_profile`.
// Il exige, à 390 px tactile et 1512 px, en clair ET en sombre :
//   BJ  Litiges : « Dossier PDF » (≥ 44 px) sur la carte ; le toucher TÉLÉCHARGE un
//       PDF (aucune requête ailleurs que la base), relu par pdfjs : N°21, le titre,
//       le n° de suivi, « Photo du carton », 1 page ; rien de l'acheteur ; case
//       « Joindre le bordereau » décochée ⇒ cochée : 3 pages, l'étiquette jointe ;
//   BM  Statistiques : « Vitesse d'envoi » 1 j 8 h, sur 2 colis, le manque nommé ;
//       Ma semaine : le widget avec la même médiane ;
//   BN  Statistiques : 20 avis lus, moyenne, évolution, 5 derniers sans date
//       inventée, jamais le pseudo ; sans ligne d'avis : « Avis pas encore lus :
//       ouvre ton profil Vinted » ;
//   aucun débordement, aucune erreur, aucun rouge.
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os'), zlib = require('zlib');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4433;
const SHOTS = process.env.BANC_SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), 'dossier-vitesse-avis-'));
fs.mkdirSync(SHOTS, { recursive: true });

const MAINTENANT = Date.now(), H = 3600000;
const ilYaH = (h) => new Date(MAINTENANT - h * H).toISOString();
function png(w, h, gris) {
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const bloc = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  const brut = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { brut[y * (w * 3 + 1)] = 0; for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; const v = (x + y) % 40 < 20 ? gris : gris + 40; brut[o] = v; brut[o + 1] = v; brut[o + 2] = v + 10; } }
  return 'data:image/png;base64,' + Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), bloc('IHDR', ih), bloc('IDAT', zlib.deflateSync(brut)), bloc('IEND', Buffer.alloc(0))]).toString('base64');
}
const PHOTO_ANNONCE = png(120, 120, 60), PHOTO_CARTON = png(160, 120, 140);
const T = 'Nike Dunk Low noir taille 42';
const fin = "Commande finalisée - l'acheteur a validé la commande";
const v = (tx, title, status, tus, h, extra = {}) => ({ transaction_id: tx, title, status, transaction_user_status: tus, conversation_id: '2461867' + tx, date: ilYaH(h), price: { amount: '70.0', currency_code: 'EUR' }, ...extra });
const VENTES = [
  v(9401, T, 'Retour initié', 'needs_action', 120, { photo: { url: PHOTO_ANNONCE }, user_login: 'jeanne_m', buyer: { login: 'jeanne_m', real_name: 'Jeanne Mouette' }, shipping_address: '12 rue des Mouettes 75011 Paris' }),
  v(9403, T, fin, 'completed', 300),
  v(9408, 'Nike Dunk Low panda 44', fin, 'completed', 240),
  v(9409, 'Nike Dunk Low panda 45', fin, 'completed', 290),
  v(9410, 'Nike Dunk Low panda 40', fin, 'completed', 400),
];
const SHIP = { 9408: MAINTENANT - 240 * H + 20 * H, 9409: MAINTENANT - 290 * H + 44 * H };
const TXN = [{ tx: 9401, item: 'i401', s: 440, ss: '' }, { tx: 9403, item: 'i403', s: 450, ss: 'Commande livrée ! ' }];
const NUMEROS = { i401: { numero: '21', title: T, auto: false }, i403: { numero: '22', title: T, auto: false } };
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: ilYaH(0) }];
const AVIS = Array.from({ length: 20 }, (_, i) => ({ id: String(9000000020 - i), rating: i < 10 ? 5 : (i % 2 ? 4 : 3), feedback: i === 0 ? 'Parfait, envoi rapide, paire impeccable et bien emballée, je recommande vivement ce vendeur sérieux et réactif !' : (i % 3 ? 'Très bien, merci' : 'Conforme') }));
let PDF_B64 = '';
const rowsDe = ({ sombre, avis = true }) => [
  { id: 'main', data: { vinted_dark: !!sombre, vinted_annonce_numeros: NUMEROS, vinted_used_numeros: [21, 22], vinted_ship_done: SHIP } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: ilYaH(0.2), payload: { my_orders: VENTES } } },
  { id: 'harvest_111_listings', data: { capturedAt: ilYaH(0.2), payload: { items: [], pagination: { total_entries: 0 } } } },
  ...TXN.map((t) => ({ id: `harvest_111_txn_${t.tx}`, data: { capturedAt: ilYaH(1), payload: { transaction: { id: t.tx, item_id: t.item || null, status: t.s, status_title: '', status_updated_at: ilYaH(5), shipment: { status_title: t.ss } } } } })),
  { id: 'email_bord_9401', data: { uid: '111', type: 'bordereau', suivi: '3SBXAA000401', transaction: '9401', receivedAt: ilYaH(110), filename: 'b9401.pdf', modele: T, transporteur: 'mondialrelay', pdfB64: PDF_B64 } },
  { id: 'colis_photo_v_9401', data: { b64: PHOTO_CARTON, at: ilYaH(100), site: 'vinted', tx: '9401', num: '21' } },
  { id: 'harvest_111_profile', data: { uid: '111', capturedAt: ilYaH(2), payload: { user: { login: 'compte_a', feedback_reputation: 0.96, feedback_count: 120, positive_feedback_count: 117, neutral_feedback_count: 2, negative_feedback_count: 1 } } } },
  ...(avis ? [{ id: 'harvest_111_feedbacks', data: { type: 'feedbacks', uid: '111', domain: 'www.vinted.fr', capturedAt: ilYaH(3), nItems: 20, payload: { user_feedbacks: AVIS, pagination: { total_entries: 120, total_pages: 6 } } } }] : []),
  // Un ENVOI d'avis (la forme `wreq` mesurée) : jamais pris pour une lecture.
  { id: 'harvest_111_wreq_api_v2_user_feedbacks', data: { uid: '111', url: '/api/v2/user_feedbacks', method: 'POST', capturedAt: ilYaH(50) } },
];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).replace(/\s+/g, ' ').slice(0, 600)); } };

const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul (BANC_PORT)'); process.exit(1); });
srv.listen(PORT);
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

async function preparer(b, vp, { sombre = false, avis = true } = {}) {
  const ROWS = rowsDe({ sombre, avis });
  const ctx = await b.newContext({ viewport: vp, colorScheme: sombre ? 'dark' : 'light', acceptDownloads: true, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = [], ailleurs = [], selectData = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s)); localStorage.setItem('vrm_apparence', JSON.stringify(s ? 'sombre' : 'clair')); } catch (_) {} }, sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    if (!/supabase\.co/.test(u)) ailleurs.push(u);
    return ['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue();
  });
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return j([]);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    if (/feedbacks/.test(u) && sel && /(^|,)data(,|$)/.test(sel)) selectData.push(u);
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: r.data.capturedAt || ilYaH(0), cap: r.data.capturedAt });
    const typeEq = /[?&]data->>type=eq\.([^&]*)/.exec(u);
    const filtre = (r) => !typeEq || (r.data && String(r.data.type) === typeEq[1]);
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const ou = /[?&]or=\(([^)]*)\)/.exec(u);
    if (ou && /id\.like\./.test(ou[1])) { const res = ou[1].split(',').map((x) => /^id\.like\.(.+)$/.exec(x.trim())).filter(Boolean).map((m) => reDe(m[1])); return j(ROWS.filter((r) => res.some((re) => re.test(r.id)) && filtre(r)).map(forme)); }
    const lk = /[?&]id=like\.([^&]*)/.exec(u);
    if (lk) { const re = reDe(lk[1]); return j(ROWS.filter((r) => re.test(r.id) && filtre(r)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs, ailleurs, selectData };
}
async function sain(pg, ecran) {
  const r = await pg.evaluate(() => {
    const rgb = (c) => (/rgba?\(([^)]+)\)/.exec(c) || [, ''])[1].split(',').map((x) => parseFloat(x));
    const zone = document.querySelector('[data-litiges-ecran], [data-ma-semaine], [data-stats-carte="vitesse-envoi"]');
    const scope = zone ? (zone.closest('main') || document.body) : document.body;
    const sel = '[data-litige-dossier], [data-stats-carte="vitesse-envoi"], [data-stats-carte="notes"], [data-ms-chiffre="vitesse"]';
    const rouge = [...document.querySelectorAll(sel)].some((root) => [root, ...root.querySelectorAll('*')].some((x) => { const cs = getComputedStyle(x); return [cs.color, cs.backgroundColor].some((c) => { const [r, g, b2, a] = rgb(c); return a !== 0 && r > 190 && g < 90 && b2 < 90; }); }));
    void scope;
    return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, t: document.body.innerText, rouge };
  });
  dit(r.sw <= r.cw + 1, `${ecran} : aucun débordement horizontal`, `${r.sw} > ${r.cw}`);
  const m = /n'a pas pu s'afficher|n’a pas pu s’afficher|Cannot access|is not defined/.exec(r.t);
  dit(!m, `${ecran} : l'écran n'est pas tombé sur le garde-fou`, m && m[0]);
  dit(!r.rouge, `${ecran} : aucun rouge sur les nouveaux blocs (§7)`);
}
const attendre = async (pg, sel, ms = 20000) => { await pg.waitForSelector(sel, { timeout: ms }).catch(() => {}); };
let PJ = null;
const texteDe = async (u8) => {
  const doc = await PJ.getDocument({ data: new Uint8Array(u8), isEvalSupported: false, verbosity: 0 }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) { const p = await doc.getPage(i); const t = await p.getTextContent(); pages.push(t.items.map((x) => x.str).join(' ')); }
  return { n: doc.numPages, pages, tout: pages.join(' \n ') };
};
const telecharger = async (pg, clic) => {
  const [dl] = await Promise.all([pg.waitForEvent('download', { timeout: 20000 }), clic()]);
  const p = await dl.path();
  return { nom: dl.suggestedFilename(), octets: fs.readFileSync(p) };
};

(async () => {
  let b;
  try {
    PJ = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const PL = await import('pdf-lib');
    { const d = await PL.PDFDocument.create(); const f = await d.embedFont(PL.StandardFonts.Helvetica); const p = d.addPage([283, 425]); p.drawText('ETIQUETTE INVENTEE 3SBXAA000401', { x: 16, y: 380, size: 11, font: f }); p.drawRectangle({ x: 16, y: 40, width: 250, height: 300, borderWidth: 2 }); d.addPage([283, 425]); PDF_B64 = Buffer.from(await d.save()).toString('base64'); }
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      for (const sombre of [false, true]) {
        const nom = `${vp.width} px ${sombre ? 'sombre' : 'clair'}`;
        const suf = `${vp.width}-${sombre ? 'sombre' : 'clair'}`;
        console.log(`── ${nom}`);
        const { ctx, pg, errs, ailleurs, selectData } = await preparer(b, vp, { sombre });
        // ── BJ ──
        await essaie('BJ dossier', async () => {
          await pg.goto(`http://localhost:${PORT}/?tab=litiges`, { waitUntil: 'domcontentloaded' });
          await attendre(pg, '[data-litige-carte="v:9401"] [data-litige-dossier-b]');
          await pg.waitForTimeout(2500);
          const bt = await pg.evaluate(() => { const x = document.querySelector('[data-litige-carte="v:9401"] [data-litige-dossier-b]'); if (!x) return null; const r = x.getBoundingClientRect(); const c = document.querySelector('[data-litige-carte="v:9401"] [data-litige-dossier-bordereau]'); return { h: r.height, w: r.width, t: x.innerText, case: c ? c.checked : null }; });
          dit(bt && bt.h >= 44 && /Dossier PDF/.test(bt.t), 'BJ « Dossier PDF » sur la carte, 44 px et plus', JSON.stringify(bt));
          dit(bt && bt.case === false, 'BJ « Joindre le bordereau » proposé (bordereau rangé) et DÉCOCHÉ par défaut', JSON.stringify(bt));
          const carte = await pg.$('[data-litige-carte="v:9401"]'); if (carte) await carte.screenshot({ path: path.join(SHOTS, `bj-carte-${suf}.png`) }).catch(() => {});
          const avant = ailleurs.length;
          const d1 = await telecharger(pg, () => pg.click('[data-litige-carte="v:9401"] [data-litige-dossier-b]'));
          fs.writeFileSync(path.join(SHOTS, `bj-dossier-${suf}.pdf`), d1.octets);
          const t1 = await texteDe(d1.octets);
          dit(/^dossier-litige-21-\d{4}-\d{2}-\d{2}\.pdf$/.test(d1.nom), 'BJ le fichier téléchargé porte le N° et la date', d1.nom);
          dit(/N°21/.test(t1.tout) && /Nike Dunk Low noir taille 42/.test(t1.tout) && /3SBXAA000401/.test(t1.tout) && /9401/.test(t1.tout) && /compte_a/.test(t1.tout) && /Photo du carton/.test(t1.tout), 'BJ le PDF : N°21 (identité), titre, compte, transaction, n° de suivi, photo du carton', t1.tout.slice(0, 400));
          dit(/Vendue/.test(t1.tout) && !/pas r[ée]cup[ée]r[ée]e/.test(t1.tout), 'BJ les photos (annonce, carton) sont posées ; la vente prouvée est au suivi', t1.tout.slice(0, 600));
          dit(!/jeanne|Mouette|75011|rue des/i.test(t1.tout), 'BJ rien de l’acheteur dans le PDF (la vente le portait)', t1.tout);
          dit(t1.n === 1, 'BJ case décochée : 1 page, l’étiquette (adresse) n’est pas jointe', t1.n + ' pages');
          dit(ailleurs.length === avant, 'BJ rien n’est envoyé : aucune requête hors de la base', ailleurs.slice(avant).join(' '));
          const ok = await pg.evaluate(() => !!document.querySelector('[data-litige-carte="v:9401"] [data-litige-dossier-ok]'));
          dit(ok, 'BJ « PDF téléchargé ✓ » dit sur la carte');
          await pg.check('[data-litige-carte="v:9401"] [data-litige-dossier-bordereau]');
          const d2 = await telecharger(pg, () => pg.click('[data-litige-carte="v:9401"] [data-litige-dossier-b]'));
          const t2 = await texteDe(d2.octets);
          dit(t2.n === 3 && /ETIQUETTE INVENTEE/.test(t2.pages[1] || ''), 'BJ case cochée : le bordereau est joint (3 pages)', t2.n + ' pages');
          // La carte entière tient dans son cadre (rien de coupé sous la case).
          const cadre = await pg.evaluate(() => { const c = document.querySelector('[data-litige-carte="v:9401"]'), d = c && c.querySelector('[data-litige-dossier]'); if (!c || !d) return null; const a = c.getBoundingClientRect(), b2 = d.getBoundingClientRect(); return { carte: Math.round(a.bottom), dossier: Math.round(b2.bottom) }; });
          dit(cadre && cadre.dossier <= cadre.carte + 1, 'BJ le geste et la case tiennent DANS la carte', JSON.stringify(cadre));
          await pg.screenshot({ path: path.join(SHOTS, `bj-ecran-${suf}.png`), fullPage: true }).catch(() => {});
          await sain(pg, 'Litiges');
        });
        // ── BM (publication par Ventes, lue par Statistiques et Ma semaine) + BN ──
        await essaie('BM BN statistiques', async () => {
          await pg.goto(`http://localhost:${PORT}/?tab=ventes`, { waitUntil: 'domcontentloaded' });
          await pg.waitForFunction(() => { try { return !!localStorage.getItem('vrm_vitesse_envoi'); } catch (_) { return false; } }, null, { timeout: 25000 }).catch(() => {});
          await pg.goto(`http://localhost:${PORT}/?tab=dashboard`, { waitUntil: 'domcontentloaded' });
          await attendre(pg, '[data-stats-carte="vitesse-envoi"] [data-ve-etat]', 25000);
          await pg.waitForFunction(() => { const n = document.querySelector('[data-sv-carte="notes"]'); return n && n.getAttribute('data-sv-etat') !== 'encours'; }, null, { timeout: 25000 }).catch(() => {});
          await pg.waitForTimeout(1200);
          const s = await pg.evaluate(() => {
            const ve = document.querySelector('[data-stats-carte="vitesse-envoi"]');
            const corps = ve && ve.querySelector('[data-ve-etat]');
            const ligne = ve && ve.querySelector('[data-ve-compte="111"]');
            const av = document.querySelector('[data-av-compte="111"]');
            return {
              etat: corps && corps.getAttribute('data-ve-etat'), n: corps && corps.getAttribute('data-ve-n'), med: corps && corps.getAttribute('data-ve-mediane'), sans: corps && corps.getAttribute('data-ve-sans-date'),
              ligne: ligne ? ligne.innerText.replace(/\s+/g, ' ') : '',
              av: av ? { lus: av.getAttribute('data-av-lus'), moy: av.getAttribute('data-av-moyenne'), total: av.getAttribute('data-av-total'), txt: av.innerText.replace(/\s+/g, ' '), avis: [...av.querySelectorAll('[data-av-avis]')].map((x) => [x.getAttribute('data-av-avis'), x.getAttribute('data-av-date')]), evol: (av.querySelector('[data-av-evolution]') || { getAttribute: () => null }).getAttribute('data-av-evolution') } : null,
              liste: (document.querySelector('[data-sv-notes-liste]') || { getAttribute: () => null }).getAttribute('data-sv-notes-liste'),
            };
          });
          dit(s.etat === 'lu' && s.n === '2' && s.med === String(32 * 3600000), 'BM vitesse : médiane 32 h sur 2 colis (dates prouvées : « Colis fait »)', JSON.stringify(s));
          dit(/1 j 8 h/.test(s.ligne) && /sur 2 colis/.test(s.ligne) && /sans date de dépôt prouvée/.test(s.ligne), 'BM « 1 j 8 h · sur 2 colis · N sans date de dépôt prouvée » (le manque nommé)', s.ligne);
          dit(Number(s.sans) >= 1, 'BM la finalisée sans preuve datée n’est pas comptée à 0 : elle est « sans date »', s.sans);
          dit(s.av && s.av.lus === '20' && s.av.total === '120' && s.av.moy === '4.3', 'BN 20 avis lus (forme sans date), moyenne 4,3, « 120 en tout »', JSON.stringify(s.av));
          dit(s.av && s.av.avis.length === 5 && s.av.avis[0][0] === '9000000020' && s.av.avis.every((x) => x[1] === ''), 'BN les 5 derniers, le plus récent d’abord, AUCUNE date inventée', JSON.stringify(s.av && s.av.avis));
          dit(s.av && s.av.evol === 'hausse' && /10 derniers 5 · avant 3,5/.test(s.av.txt), 'BN évolution : 10 derniers 5 · avant 3,5', s.av && s.av.txt);
          dit(s.av && !/jeanne|compte_b/i.test(s.av.txt) && /Parfait, envoi rapide/.test(s.av.txt) && /…/.test(s.av.txt), 'BN texte court, jamais un pseudo', s.av && s.av.txt);
          dit(selectData.length === 0, 'BN avis lus en projection (jamais `select=data`)', selectData.join(' '));
          for (const [sel, n] of [['[data-stats-carte="vitesse-envoi"]', 'bm-stats'], ['[data-sv-carte="notes"]', 'bn-notes']]) {
            const el = await pg.$(sel); if (el) { await el.scrollIntoViewIfNeeded(); await pg.waitForTimeout(250); await el.screenshot({ path: path.join(SHOTS, `${n}-${suf}.png`) }).catch(() => {}); }
          }
          await sain(pg, 'Statistiques');
        });
        await essaie('BM Ma semaine', async () => {
          await pg.goto(`http://localhost:${PORT}/?tab=semaine`, { waitUntil: 'domcontentloaded' });
          await attendre(pg, '[data-ms-chiffre="vitesse"]', 20000);
          const w = await pg.evaluate(() => { const x = document.querySelector('[data-ms-chiffre="vitesse"]'); return x ? { med: x.getAttribute('data-ve-semaine'), t: x.innerText.replace(/\s+/g, ' ') } : null; });
          dit(w && w.med === String(32 * 3600000) && /1 j 8 h/.test(w.t) && /sur 2 colis/.test(w.t), 'BM Ma semaine : le widget « Vitesse d’envoi », la même médiane', JSON.stringify(w));
          await pg.waitForTimeout(1200);
          const wEl = await pg.$('[data-ms-chiffre="vitesse"]'); if (wEl) await wEl.scrollIntoViewIfNeeded().catch(() => {});
          await pg.screenshot({ path: path.join(SHOTS, `bm-semaine-${suf}.png`) }).catch(() => {});
          await sain(pg, 'Ma semaine');
        });
        dit(errs.length === 0, `${nom} : aucune erreur de page`, errs.join(' | ').slice(0, 300));
        await ctx.close();
      }
      // Sans ligne d'avis : « Avis pas encore lus : ouvre ton profil Vinted ».
      const p2 = await preparer(b, vp, { avis: false });
      await essaie('BN pas captés', async () => {
        await p2.pg.goto(`http://localhost:${PORT}/?tab=dashboard`, { waitUntil: 'domcontentloaded' });
        await attendre(p2.pg, '[data-sv-notes-liste]', 25000);
        const t = await p2.pg.evaluate(() => { const x = document.querySelector('[data-sv-notes-liste]'); return x ? [x.getAttribute('data-sv-notes-liste'), x.innerText] : null; });
        dit(t && t[0] === 'pas-lue' && /Avis pas encore lus : ouvre ton profil Vinted/.test(t[1]), 'BN rien capté ⇒ « Avis pas encore lus : ouvre ton profil Vinted »', JSON.stringify(t));
        if (vp.width === 390) { const el = await p2.pg.$('[data-sv-carte="notes"]'); if (el) await el.screenshot({ path: path.join(SHOTS, 'bn-pas-lus-390.png') }).catch(() => {}); }
      });
      await p2.ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.stack).slice(0, 400)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(`\nCaptures et PDF : ${SHOTS}`);
  console.log(ko ? `\n❌ dossier · vitesse · avis : ${ko} rouge(s)` : '\n✅ dossier · vitesse · avis : tout est vert');
  process.exit(ko ? 1 : 0);
})();
