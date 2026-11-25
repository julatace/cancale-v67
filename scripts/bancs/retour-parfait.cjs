// ═══════════════════════════════════════════════════════════════════════════
// BANC : LE RETOUR D'UN ACHAT, PARFAIT (15 nov., lot retour-parfait — après `npm run build` ;
//        node scripts/bancs/retour-parfait.cjs ; BANC_PORT=…, BANC_DIST=…, BANC_SHOTS=…)
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « Tu as bien mis en place le retour de mon achat avec son bordereau ? Je veux que ce soit
// parfait et irréprochable. » Ses deux retours, en données INVENTÉES à la forme mesurée (dépôt public) :
//   · « Nike » (990048248) : bordereau Mondial Relay (n° de 8 chiffres, A4 portrait), limite DEMAIN 10 h,
//     DÉPOSÉ il y a 5 jours (l'e-mail Mondial Relay « en transit » du même n°, sortant) ;
//   · « Autry » (990051379) : bordereau Chronopost (`XU…JF`, A4 PAYSAGE 842×595), limite dans 8 jours
//     10 h (Paris), transporteur lu sur l'étiquette (`transporteurPdf`, rattrapé par le serveur), son
//     achat Vinted encore « colis déposé en bureau de Poste ou point relais ».
// Il exige (390 tactile iPhone et 1512, clair et sombre) :
//   · Ma journée : « À renvoyer » en tête avec l'Autry SEUL (Nike est déposé), la bande ambre « À déposer
//     avant <jour> <date> 10 h · dans 8 jours · sinon … », Imprimer, Déposé, logo Chronopost, n° copiable,
//     « Suivre ↗ » vers la page publique de Chronopost ;
//   · Achats : les deux cartes ; Nike « Déposé · <date> » coché, « En route vers le vendeur » ici, la source
//     « lu dans l'e-mail Mondial Relay », plus de bande ni d'Imprimer ; l'Autry « Bordereau reçu ·
//     Chronopost » coché, « À déposer » ici ; jamais « à retirer » ;
//   · « Imprimer le bordereau » ouvre LE PDF de CE retour (titre du PDF inventé relu), page 1 à sa taille
//     d'origine (842×595 : rien de réduit ni de rogné), sans `select=data` ; sur iPhone : la feuille de
//     partage dans le toucher (le PDF préparé à l'avance) ; sur ordinateur : la visionneuse ;
//   · l'AVANCEMENT : un faux e-mail Chronopost « en transit » du n° exact ⇒ « Déposé » coché, bande et
//     Imprimer partis, l'Autry quitte la tête de Ma journée ; puis livré + remboursé ⇒ tout coché, 34,32 € ;
//   · contraste de la bande ≥ 4,5:1, aucun rouge, rien ne déborde, aucune requête vers Vinted, aucune
//     erreur ; captures regardées.
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const NM = path.join(__dirname, '..', '..', 'node_modules');
const { PDFDocument, StandardFonts } = require(path.join(NM, 'pdf-lib'));
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4437;
const SHOTS = process.env.BANC_SHOTS || os.tmpdir();
const MAINTENANT = Date.now(), H = 3600000;
const ilYaH = (h) => new Date(MAINTENANT - h * H).toISOString();
const PH = (c) => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="${c}"/></svg>`);
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'banc_cancale', domain: 'www.vinted.fr', updated_at: ilYaH(0) }];
const TXN = '990048248', TXA = '990051379', SN = '81230048', SA = 'XU900051378JF';
const NIKE = 'Baskets banc Air Max. Blanc et rose. Pointure 42.5', AUTRY = 'Autry banc Medalist';
const STATUT_AUTRY = "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais";
const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';

const jourParis = (ms) => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(ms)).map((x) => [x.type, x.value])); return { y: +p.year, m: +p.month, d: +p.day }; };
const decalage = (ms) => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(ms)).map((x) => [x.type, x.value])); return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute) - ms) / 60000; };
const aDixHeures = (n) => { const j = jourParis(MAINTENANT + n * 86400000); const midi = Date.UTC(j.y, j.m - 1, j.d, 12); return { j, iso: new Date(Date.UTC(j.y, j.m - 1, j.d, 10) - decalage(midi) * 60000).toISOString(), txt: `${String(j.d).padStart(2, '0')}/${String(j.m).padStart(2, '0')}/${j.y} 10 h 00` }; };
const DEMAIN = aDixHeures(1), DANS8 = aDixHeures(8);
const motsJour = (j) => new Date(Date.UTC(j.y, j.m - 1, j.d, 12)).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Paris' });

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d && !c ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).replace(/\s+/g, ' ').slice(0, 500)); } };

async function pdfs() {
  const a = await PDFDocument.create(); const pa = a.addPage([842, 595]); const fa = await a.embedFont(StandardFonts.Helvetica);
  pa.drawText('FICHE DESTINATAIRE', { x: 43, y: 552, size: 9, font: fa }); pa.drawText('Chrono Relais Europe', { x: 516, y: 300, size: 12, font: fa });
  pa.drawText('Consignement : ' + SA, { x: 516, y: 290, size: 9, font: fa }); pa.drawRectangle({ x: 512, y: 94, width: 312, height: 408, borderWidth: 2 });
  pa.drawText('Chronopost 3 Boulevard Romain Rolland - 75014 Paris - France', { x: 43, y: 60, size: 7, font: fa });
  a.setTitle('BANC RETOUR ' + TXA);
  const n = await PDFDocument.create(); const pn = n.addPage([595, 842]); const fn = await n.embedFont(StandardFonts.Helvetica);
  pn.drawText('MONDIAL RELAY  Point Relais banc  N de suivi : ' + SN, { x: 40, y: 700, size: 12, font: fn });
  n.setTitle('BANC RETOUR ' + TXN);
  return { A: Buffer.from(await a.save()).toString('base64'), N: Buffer.from(await n.save()).toString('base64') };
}
async function lignes() {
  const P = await pdfs();
  const achat = (tx, title, eur, status, h, c) => ({ transaction_id: Number(tx), title, price: { amount: String(eur), currency_code: 'EUR' }, status, transaction_user_status: 'needs_action', conversation_id: 'conv-' + tx, date: ilYaH(h), photo: { url: PH(c) } });
  return [
    { id: 'main', data: {} },
    { id: 'harvest_111_orders_purchased', data: { capturedAt: ilYaH(0.2), payload: { my_orders: [achat(TXA, AUTRY, 34.32, STATUT_AUTRY, 260, '#B9A58C'), achat(TXN, NIKE, 55, 'Commande expédiée et en cours d’acheminement !', 380, '#E6B8C8')] } } },
    { id: 'harvest_111_orders_sold', data: { capturedAt: ilYaH(0.2), payload: { my_orders: [] } } },
    { id: 'harvest_111_listings', data: { capturedAt: ilYaH(0.2), payload: { items: [], pagination: { total_entries: 0 } } } },
    { id: `email_bordretour_${TXN}`, data: { type: 'bordereau-retour', sens: 'achat', transaction: TXN, suivi: SN, dateLimite: DEMAIN.txt, dateLimiteIso: DEMAIN.iso, article: NIKE, uid: '111', account: 'banc_cancale', filename: `Bon-Retour-Vinted-${TXN}.pdf`, pdfB64: P.N, receivedAt: ilYaH(170) } },
    { id: `email_bordretour_${TXA}`, data: { type: 'bordereau-retour', sens: 'achat', transaction: TXA, suivi: SA, transporteurPdf: 'chronopost', pdfLu: 'ok', dateLimite: DANS8.txt, dateLimiteIso: DANS8.iso, article: AUTRY, uid: '111', account: 'banc_cancale', filename: `Bon-Retour-Vinted-${TXA}.pdf`, pdfB64: P.A, receivedAt: ilYaH(6) } },
    { id: `email_track_mondialrelay_${SN}`, data: { type: 'suivi', carrier: 'mondialrelay', suivi: SN, status: 'transit', statusLabel: 'En transit', sens: 'sortant', subject: 'Votre colis est entre de bonnes mains', emailAt: ilYaH(120), receivedAt: ilYaH(120) } },
  ];
}

const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = f.startsWith('/pdfjs/') ? path.join(NM, 'pdfjs-dist', 'build', path.basename(f)) : path.join(DIST, f);
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
    if (seg_pdf(src) && row.data && row.data.pdfB64) x = true;
    out[alias] = x == null ? null : (/->>/.test(src) && typeof x !== 'object' ? String(x) : x);
  }
  return out;
};
const seg_pdf = (src) => /(^|->>|->)_pdf$/.test(src);
const reDe = (motif) => new RegExp('^' + motif.replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$');

async function preparer(b, vp, ROWS, { sombre = false } = {}) {
  const mobile = vp.width < 600;
  const ctx = await b.newContext({ locale: 'fr-FR', timezoneId: 'Europe/Paris', viewport: vp, colorScheme: sombre ? 'dark' : 'light', ...(mobile ? { isMobile: true, hasTouch: true, userAgent: UA_IPHONE } : {}) });
  const errs = [], versVinted = [], selectData = [];
  await ctx.addInitScript((s) => {
    try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vrm_visite_bulles_vue', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s)); localStorage.setItem('vrm_apparence', JSON.stringify(s ? 'sombre' : 'clair')); localStorage.setItem('vrm_reclasse_retours_at', String(Date.now())); } catch (_) {}
    // Ce que l'impression OUVRE : la feuille de partage (iPhone) et les PDF fabriqués (blob).
    window.__partages = []; window.__blobs = [];
    const cou = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (o) => { const u = cou(o); try { if (o && o.type === 'application/pdf') window.__blobs.push({ u, o }); } catch (_) {} return u; };
    try {
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: (d) => !!(d && Array.isArray(d.files) && d.files.length) });
      Object.defineProperty(navigator, 'share', { configurable: true, value: (d) => { window.__partages.push({ d, actif: navigator.userActivation ? navigator.userActivation.isActive : null }); return Promise.resolve(); } });
    } catch (_) {}
  }, sombre);
  await ctx.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    if (/vinted\.(fr|com)/i.test(u) && !/images\d*\.vinted\.net/.test(u)) versVinted.push(u);
    // pdf.js (celui que l'app charge du CDN) servi depuis node_modules : la recherche de zone blanche tourne vraiment.
    if (/pdfjs-dist@[^/]+\/build\/pdf\.worker\.min\.js/.test(u)) return r.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(path.join(NM, 'pdfjs-dist', 'build', 'pdf.worker.min.mjs')) });
    return ['image', 'media', 'font', 'script'].includes(r.request().resourceType()) ? r.abort() : r.continue();
  });
  await ctx.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return j([]);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    if (/email_bordretour_/.test(u) && /select=data(&|$)/.test(u)) selectData.push(u);
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
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: /mode=reclasser/.test(r.request().url()) ? '{"ok":true,"faits":[],"restes":[],"transporteurs":[]}' : '{"pret":true}' }));
  const page = async () => { const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message)); return p; };
  const pg = await page();
  return { ctx, pg, page, errs, versVinted, selectData };
}
// pdf.js local (module) posé AVANT le toucher : `chargerPdfjs` le trouve sur window.
const poserPdfjs = (pg) => pg.addScriptTag({ type: 'module', content: "import * as m from '/pdfjs/pdf.min.mjs'; window.pdfjsLib = { ...m, GlobalWorkerOptions: m.GlobalWorkerOptions, getDocument: (o) => { const t = m.getDocument(o); return { promise: t.promise.then((d) => { if (typeof d.destroy !== 'function') d.destroy = () => t.destroy(); return d; }), destroy: () => t.destroy() }; } }; m.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';" }).catch(() => {});
const rougeIci = (pg, sel) => pg.evaluate((s) => {
  const el = document.querySelector(s); if (!el) return null;
  const rgb = (c) => (/rgba?\(([^)]+)\)/.exec(c) || [, ''])[1].split(',').map((x) => parseFloat(x));
  return [...el.querySelectorAll('*')].some((x) => { const cs = getComputedStyle(x); return [cs.color, cs.backgroundColor].some((c) => { const [r, g, b2, a] = rgb(c); return a !== 0 && r > 190 && g < 90 && b2 < 90; }); });
}, sel);
const deborde = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const carte = (pg, racine, tx) => pg.evaluate(([rac, t]) => {
  const x = document.querySelector(`${rac} [data-retour-achat="${t}"]`); if (!x) return null;
  const q = (s) => x.querySelector(s);
  const bande = q('[data-retour-bande]');
  const etapes = [...x.querySelectorAll('[data-retour-et]')].map((e) => ({ cle: e.getAttribute('data-retour-et'), etat: e.getAttribute('data-retour-et-etat'), lib: (e.querySelector('b') || {}).innerText || '', det: (e.querySelector('[data-retour-et-detail]') || {}).innerText || '' }));
  const contraste = (b) => {
    if (!b) return null;
    const bande = b; const lum = (c) => { const v = (/rgba?\(([^)]+)\)/.exec(c) || [, '0,0,0'])[1].split(',').map(Number); const f = (u) => { u /= 255; return u <= 0.03928 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4); }; return [0.2126 * f(v[0]) + 0.7152 * f(v[1]) + 0.0722 * f(v[2]), v[3] == null ? 1 : v[3], v]; };
    // Le fond réel : les couches translucides recomposées jusqu'à une couche opaque (ou le bas du dégradé).
    let el = bande, couches = [];
    while (el) { const c = getComputedStyle(el).backgroundColor; const v = (/rgba?\(([^)]+)\)/.exec(c) || [, '0,0,0,0'])[1].split(',').map(Number); const a = v[3] == null ? 1 : v[3]; if (a > 0) couches.push([v, a]); if (a >= 0.999) break; el = el.parentElement; }
    const bas = document.documentElement.getAttribute('data-theme') === 'dark' ? [5, 14, 29] : [14, 44, 82];
    let fond = couches.length && couches[couches.length - 1][1] >= 0.999 ? couches.pop()[0].slice(0, 3) : bas;
    for (const [v, a] of couches.reverse()) fond = fond.map((k, i) => v[i] * a + k * (1 - a));
    const L = (v) => { const f = (u) => { u /= 255; return u <= 0.03928 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4); }; return 0.2126 * f(v[0]) + 0.7152 * f(v[1]) + 0.0722 * f(v[2]); };
    const t = lum(getComputedStyle(b).color);
    const l1 = t[0], l2 = L(fond);
    return Math.round(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)) * 100) / 100;
  };
  const ctr = bande ? contraste(bande.querySelector('b')) : null;
  // L'encre de la carte elle-même (titre, compte, n° de suivi, liens) : jamais une encre claire sur le verre clair.
  const ctrCarte = ['.vrm-ret-titre', '.vrm-ret-meta', '[data-retour-copier]', '[data-retour-suivre]', '[data-retour-vinted]'].map((s) => [s, contraste(q(s))]).filter(([, v]) => v != null);
  const copier = q('[data-retour-copier]'), suivre = q('[data-retour-suivre]'), logo = q('[data-retour-suivi-ligne] [data-transporteur-logo]');
  return { etape: x.getAttribute('data-retour-etape'), fait: x.getAttribute('data-retour-fait'), titre: (q('.vrm-ret-titre') || {}).innerText || '', meta: (q('.vrm-ret-meta') || {}).innerText || '', photo: !!q('.vrm-ret-photo'),
    bande: bande ? (bande.querySelector('b') || {}).innerText : null, sous: bande ? (bande.querySelector('[data-retour-bande-sous]') || {}).innerText || '' : null, contraste: ctr, ctrCarte,
    etapes, source: (q('[data-retour-source-fait]') || {}).innerText || '', imprimer: q('[data-retour-imprimer]') ? Math.round(q('[data-retour-imprimer]').getBoundingClientRect().height) : 0,
    depose: q('[data-retour-depose]') ? Math.round(q('[data-retour-depose]').getBoundingClientRect().height) : 0,
    copier: copier ? { txt: copier.innerText, h: Math.round(copier.getBoundingClientRect().height) } : null, suivre: suivre ? suivre.getAttribute('href') : null, logo: logo ? logo.getAttribute('data-marque') : (q('[data-retour-suivi-ligne]') || { getAttribute: () => null }).getAttribute('data-retour-transporteur') };
}, [racine, tx]);
// Le dernier PDF fabriqué (blob) ⇒ octets ⇒ son titre et sa première page (taille d'origine ?).
const dernierPdf = async (pg, viaPartage) => {
  const b64 = await pg.evaluate(async (part) => {
    const o = part ? (window.__partages.length ? window.__partages[window.__partages.length - 1].d.files[0] : null) : (window.__blobs.length ? window.__blobs[window.__blobs.length - 1].o : null);
    if (!o) return null;
    const a = new Uint8Array(await o.arrayBuffer()); let s = ''; for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return { b64: btoa(s), nom: o.name || '', actif: part && window.__partages.length ? window.__partages[window.__partages.length - 1].actif : null };
  }, viaPartage);
  if (!b64) return null;
  const d = await PDFDocument.load(Buffer.from(b64.b64, 'base64'));
  const p0 = d.getPages()[0].getSize();
  return { titre: d.getTitle() || '', pages: d.getPageCount(), w: Math.round(p0.width), h: Math.round(p0.height), nom: b64.nom, actif: b64.actif };
};

(async () => {
  let b;
  try {
    await new Promise((r) => srv.listen(PORT, r));
    const ROWS0 = await lignes();
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    const cas = [[{ width: 390, height: 844 }, false], [{ width: 1512, height: 950 }, false], [{ width: 390, height: 844 }, true], [{ width: 1512, height: 950 }, true]];
    for (const [vp, sombre] of cas) {
      const nom = `${vp.width} px ${sombre ? 'sombre' : 'clair'}`;
      const suff = `${vp.width}-${sombre ? 'sombre' : 'clair'}`;
      console.log(`── ${nom}`);
      const ROWS = ROWS0.map((r) => ({ ...r, data: { ...r.data } }));
      const P = await preparer(b, vp, ROWS, { sombre });
      let { pg } = P;
      // (16 nov., intégration vague B) Julien, 15 nov. (c8e526af, refonte-journee) : « Ma journée ne montre que ce qui
      // demande un geste » — les retours y passent par le bloc « Retours et litiges » (une ligne par article, la MÊME liste
      // classée qu'Achats) ; la carte « À renvoyer » complète (bande, gestes, suivi) vit dans Achats, jugée là plus bas.
      await essaie('Ma journée', async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector(`[data-retours-litiges] [data-rl-cle="a:r:${TXA}"]`, { timeout: 40000 }).catch(() => {});
        await pg.waitForTimeout(2500);
        const rl = await pg.evaluate(() => [...document.querySelectorAll('[data-retours-litiges] [data-rl-cle]')].map((x) => ({ cle: x.getAttribute('data-rl-cle'), imprimer: !!x.querySelector('[data-rl-imprimer]') })));
        const imp = rl.filter((x) => x.imprimer).map((x) => x.cle);
        dit(imp.join() === 'a:r:' + TXA && rl.some((x) => x.cle === 'a:r:' + TXN), `${nom} : Ma journée · Retours et litiges : l’Autry SEUL à déposer (Imprimer), Nike en route (déjà déposé)`, JSON.stringify(rl));
        await pg.locator('[data-retours-litiges]').first().scrollIntoViewIfNeeded().catch(() => {});
        await pg.locator('[data-retours-litiges]').first().screenshot({ path: path.join(SHOTS, `retour-parfait-journee-${suff}.png`) }).catch(() => {});
        dit((await rougeIci(pg, '[data-retours-litiges]')) === false, `${nom} : aucun rouge (Ma journée)`);
      });
      await essaie('Achats', async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=achats`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector(`[data-retours-achat] [data-retour-achat="${TXN}"][data-retour-fait]`, { timeout: 40000 }).catch(() => {});
        await pg.waitForTimeout(1500);
        const n = await carte(pg, '[data-retours-achat]', TXN), a = await carte(pg, '[data-retours-achat]', TXA);
        const etats = (c) => c ? c.etapes.map((e) => e.cle + ':' + e.etat).join(' ') : '';
        const reBande = new RegExp(`^À déposer avant ${motsJour(DANS8.j).replace(/\./g, '\\.')} 10 h$`);
        dit(a && reBande.test(a.bande || '') && /^dans 8 jours$/.test(a.sous || ''), `${nom} : l’état « ${a && a.bande} · ${a && a.sous} » (date en clair, heure de Paris ; « sinon… » sous « Pourquoi ? » depuis le 23 nov.)`, JSON.stringify(a && [a.bande, a.sous]));
        dit(a && a.contraste >= 4.5, `${nom} : la bande se lit (contraste ${a && a.contraste}:1 ≥ 4,5)`, JSON.stringify(a && a.contraste));
        dit(a && a.ctrCarte.length >= 4 && a.ctrCarte.every(([, v]) => v >= 4.5), `${nom} : la carte « À renvoyer » se lit (Achats) (titre, compte, n°, liens ≥ 4,5:1 : ${a && a.ctrCarte.map(([k, v]) => v).join(' · ')})`, JSON.stringify(a && a.ctrCarte));
        dit(a && a.titre === AUTRY && a.photo && /banc_cancale/.test(a.meta), `${nom} : photo + titre (par SON n° de transaction) + compte`, JSON.stringify(a && [a.titre, a.meta, a.photo]));
        dit(a && a.imprimer >= (vp.width < 600 ? 44 : 40) && a.depose >= (vp.width < 600 ? 44 : 40) && a.logo === 'chronopost' && a.copier && a.copier.txt.includes(SA) && a.copier.h >= 44 && a.suivre === null /* (23 nov., lot retours-suivi) une action par état : « Suivre » vient APRÈS le dépôt (Nike, plus bas) */,
          `${nom} : Imprimer, Déposé, logo Chronopost, n° copiable, « Suivre ↗ » vers la page publique de Chronopost`, JSON.stringify(a && { i: a.imprimer, d: a.depose, logo: a.logo, c: a.copier, s: a.suivre }));
        dit(n && n.etape === 'en-route' && etats(n) === 'bordereau:fait deposer:fait route:ici livre:avenir rembourse:avenir' && /^\d{1,2} \S+$/.test(n.etapes[1].det) && n.etapes[1].lib === 'Déposé' && n.etapes[2].lib === 'En route',
          `${nom} : Nike — « Déposé · ${n && n.etapes[1] && n.etapes[1].det} » ✓, « En route vers le vendeur » ici, puis livré, remboursé`, JSON.stringify(n && n.etapes));
        dit(n && /lu dans l’e-mail Mondial Relay/.test(n.source) && n.bande === null && !n.imprimer && !n.depose && n.logo === 'mondialrelay' && /^https:\/\/www\.mondialrelay\.fr\/suivi-de-colis\/\?numeroExpedition=81230048/.test(n.suivre || ''),
          `${nom} : Nike — source dite, plus de bande ni d’Imprimer ni de Déposé (le fait les remplace), logo et suivi Mondial Relay`, JSON.stringify(n && { s: n.source, b: n.bande, i: n.imprimer, d: n.depose, l: n.logo, u: n.suivre }));
        dit(n && a && [...n.ctrCarte, ...a.ctrCarte].every(([, v]) => v >= 4.5), `${nom} : les cartes d’Achats se lisent (≥ 4,5:1)`, JSON.stringify(n && a && [n.ctrCarte, a.ctrCarte]));
        dit(a && etats(a) === 'bordereau:fait deposer:ici route:avenir livre:avenir rembourse:avenir' && a.etapes[0].det === 'Chronopost' && a.etapes[0].lib === 'Bordereau',
          `${nom} : Autry — « Bordereau reçu · Chronopost » ✓, « À déposer » ici`, JSON.stringify(a && a.etapes));
        const txt = await pg.evaluate(() => (document.querySelector('[data-retours-achat]') || {}).innerText || '');
        dit(!/à retirer/i.test(txt), `${nom} : jamais « à retirer » sur un retour`, txt.slice(0, 200));
        await pg.locator(`[data-retours-achat] [data-retour-achat="${TXN}"]`).first().scrollIntoViewIfNeeded().catch(() => {});
        await pg.locator('[data-retours-achat]').first().screenshot({ path: path.join(SHOTS, `retour-parfait-achats-${suff}.png`) }).catch(() => {});
        dit((await rougeIci(pg, '[data-retours-achat]')) === false, `${nom} : aucun rouge (Achats)`);
        dit((await deborde(pg)) <= 1, `${nom} : rien ne déborde`);
      });
      await essaie('Imprimer', async () => {
        await poserPdfjs(pg);
        await pg.waitForTimeout(vp.width < 600 ? 6000 : 1000);   // iPhone : le PDF préparé dès l'affichage de la carte
        await pg.click(`[data-retours-achat] [data-retour-imprimer="${TXA}"]`);
        if (vp.width < 600) {
          await pg.waitForFunction(() => window.__partages.length > 0 || document.querySelector('[data-retour-pdf-pret]'), null, { timeout: 30000 }).catch(() => {});
          let p = await dernierPdf(pg, true);
          if (!p) {   // pas encore prêt au toucher : « Ouvrir le bordereau » (son second toucher)
            await pg.click(`[data-retours-achat] [data-retour-imprimer="${TXA}"]`).catch(() => {});
            await pg.waitForFunction(() => window.__partages.length > 0, null, { timeout: 15000 }).catch(() => {});
            p = await dernierPdf(pg, true);
          }
          dit(p && p.titre === 'BANC RETOUR ' + TXA && p.w === 842 && p.h === 595 && /^retour-.*990051379\.pdf$/.test(p.nom), `${nom} : iPhone — la feuille de partage reçoit LE PDF de l’Autry (« Imprimer » y est), page 1 à sa taille d’origine 842×595`, JSON.stringify(p));
          dit(p && p.actif !== false, `${nom} : … ouverte DANS le toucher (activation utilisateur encore active)`, JSON.stringify(p && p.actif));
        } else {
          await pg.waitForSelector('[data-visionneuse-pdf="pret"]', { timeout: 30000 }).catch(() => {});
          const p = await dernierPdf(pg, false);
          const vis = await pg.evaluate(() => !!document.querySelector('[data-visionneuse-pdf="pret"] [data-visionneuse-cadre]'));
          dit(vis && p && p.titre === 'BANC RETOUR ' + TXA && p.w === 842 && p.h === 595, `${nom} : ordinateur — la visionneuse ouvre LE PDF de l’Autry, page 1 à sa taille d’origine 842×595 (rien de réduit ni rogné) ; ${p ? p.pages : '?'} page(s)`, JSON.stringify({ vis, p }));
          if (!sombre) await pg.screenshot({ path: path.join(SHOTS, `retour-parfait-impression-${suff}.png`) }).catch(() => {});
          await pg.click('[data-visionneuse-fermer]').catch(() => {});
        }
        dit(P.selectData.length === 0, `${nom} : aucune lecture \`select=data\` d’un bordereau (le PDF seul, projeté)`, P.selectData.slice(0, 2).join(' '));
      });
      await essaie('Avancement', async () => {
        // Une page neuve (la visionneuse PDF de l'ordinateur reste à part).
        await pg.close().catch(() => {}); pg = await P.page();
        // Le faux e-mail Chronopost « en transit » du n° EXACT du retour (sortant).
        ROWS.push({ id: `email_track_chronopost_${SA}`, data: { type: 'suivi', carrier: 'chronopost', suivi: SA, status: 'transit', statusLabel: 'En cours d’acheminement', sens: 'sortant', subject: 'Votre colis est en cours d’acheminement', emailAt: ilYaH(2), receivedAt: ilYaH(2) } });
        await pg.goto(`http://localhost:${PORT}/?tab=achats`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector(`[data-retours-achat] [data-retour-achat="${TXA}"][data-retour-fait="email"]`, { timeout: 40000 }).catch(() => {});
        await pg.waitForTimeout(1000);
        let a = await carte(pg, '[data-retours-achat]', TXA);
        dit(a && a.etape === 'en-route' && a.etapes.map((e) => e.etat).join() === 'fait,fait,ici,avenir,avenir' && a.etapes[1].det === motsJour(jourParis(Date.parse(ilYaH(2)))).replace(/^\S+ /, '') && /lu dans l’e-mail Chronopost/.test(a.source) && a.bande === null && !a.imprimer && !a.depose,
          `${nom} : l’e-mail Chronopost fait avancer l’Autry SEUL — « Déposé · ${a && a.etapes[1] && a.etapes[1].det} » ✓, en route ici, bande et Imprimer partis`, JSON.stringify(a && { e: a.etape, et: a.etapes, s: a.source, b: a.bande }));
        await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        await pg.waitForTimeout(4500);
        const n = await pg.evaluate(() => document.querySelectorAll('[data-retours-litiges] [data-rl-imprimer]').length);
        dit(n === 0, `${nom} : plus rien « à déposer » dans Ma journée (les deux sont déposés)`, String(n));
        // Livré (lu chez Chronopost) puis remboursé (l'e-mail « … a été remboursée »).
        ROWS.push({ id: `depart_chronopost_${SA}`, data: { v: 1, sens: 'sortant', suivi: SA, carrier: 'chronopost', priseAt: ilYaH(2), etat: 'livre', etatAt: ilYaH(1), lu: ilYaH(0.5) } });
        ROWS.push({ id: `email_rembachat_${TXA}`, data: { type: 'remboursement-achat', transaction: TXA, montant: 34.32, article: AUTRY, receivedAt: ilYaH(0.3) } });
        await pg.goto(`http://localhost:${PORT}/?tab=achats`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector(`[data-retours-achat] [data-retour-achat="${TXA}"][data-retour-etape="rembourse"]`, { timeout: 40000 }).catch(() => {});
        await pg.waitForTimeout(1000);
        // (25 nov., achats-retours-design) Un retour remboursé est une rangée REPLIÉE : son toucher la déplie (frise, n°, gestes).
        await pg.evaluate(() => document.querySelectorAll('[data-retours-achat] details.vrm-rt-fini').forEach((d) => { d.open = true; }));
        a = await carte(pg, '[data-retours-achat]', TXA);
        dit(a && a.etape === 'rembourse' && a.etapes.every((e) => e.etat === 'fait') && /^34,32\s€$/.test(a.etapes[4].det), `${nom} : livré puis remboursé ⇒ toutes les étapes cochées, « Remboursé · ${a && a.etapes[4] && a.etapes[4].det} »`, JSON.stringify(a && a.etapes));
        await pg.locator(`[data-retours-achat] [data-retour-achat="${TXA}"]`).first().screenshot({ path: path.join(SHOTS, `retour-parfait-rembourse-${suff}.png`) }).catch(() => {});
      });
      dit(P.versVinted.length === 0, `${nom} : aucune requête vers Vinted`, P.versVinted.slice(0, 3).join(' '));
      dit(P.errs.length === 0, `${nom} : aucune erreur de page`, P.errs.join(' | ').slice(0, 300));
      await P.ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ retour parfait : ${ko} rouge(s)` : '\n✅ retour parfait : tout est vert');
  process.exit(ko ? 1 : 0);
})();
