// ════════════════════════════════════════════════════════════════════════════
// Banc : « IMPRIMER » EN UN TOUCHER (14 nov., impression-simple)
// ════════════════════════════════════════════════════════════════════════════
// Julien : « le bouton imprimer […] c'est n'importe quoi ça marche pas du tout, tout le processus est horrible ».
// Le parcours RENDU, joué comme lui : Ventes → À expédier → « Imprimer (N) » → le PDF.
// Données INVENTÉES (dépôt public), formes réelles (celles de tout-imprimer.cjs) ; chaque bordereau est le VRAI
// PDF de test (`bordereau-test.b64`, A4) qui porte en plus « ETIQUETTE <n° de transaction> ».
//  A (390 tactile, iPhone, clair ET sombre) — la PREMIÈRE fois : 2 touchers jusqu'au PDF (« Imprimer (4) » ⇒ la
//    question du papier ⇒ « Classique · A4 ») ; la feuille de partage s'ouvre DANS le geste (`window.event` = le
//    toucher, comme Safari l'exige) ; le PDF a 4 pages, chacune SON « ETIQUETTE » et SON « N° » ; le papier est
//    retenu (`vrm_imprimante`) ; le bordereau Vestiaire sans PDF est DIT (raison) ; « Il en manque » ⇒ toucher le
//    N°22 ⇒ « Réimprimer (1) » ⇒ un PDF d'UNE page, la sienne, dans le geste ; « Oui » ferme et les 4 sont imprimés.
//  B (1512, clair ET sombre) — ENSUITE (papier déjà choisi) ; sur ordinateur AUCUN PDF lu avant le toucher (§4.4 : rien
//    n'oblige à préparer d'avance, la visionneuse de VRM attend le PDF) ; 1 toucher ⇒ la visionneuse s'ouvre et l'impression
//    part seule ; aucune question de papier ; changer de papier = un toucher discret (pas une étape) et retenu ;
//    le tampon d'UN bordereau se corrige APRÈS (sa vignette ⇒ « Rien » ⇒ « Réimprimer celui-ci ») : une page, son
//    étiquette, sans son N°.
//  C (390 tactile, iPhone) — §5 : un N° « à vérifier » DEMANDE avant tout PDF ; « Annuler » ⇒ rien n'est ouvert ;
//    « J'ai vérifié » ⇒ « Ouvrir le PDF » (SON toucher ouvre le partage, dans le geste).
//  D (1512, clair ET sombre — 16 nov., lot impression-directe) — « impression sans réfléchir » : VRM ouvert sur Ma
//    journée, des bordereaux prêts (le nombre PUBLIÉ par Ventes, `vrm_colis_prets.lot`) ⇒ la bannière « Imprimer les 5 » ;
//    UN clic ⇒ la visionneuse avec le PDF (papier déjà choisi, chaque bordereau SON N°), l'impression part seule, AUCUNE
//    feuille « Choisir » ni « Tout est sorti ? » ; « 4 imprimés · Annuler » ; les 4 marqués imprimés, « Annuler » les
//    retire. D1 (papier jamais choisi) : UNE question la première fois, puis le PDF. « Plus tard » range la bannière.
//  PARTOUT : aucune erreur d'app, rien ne déborde, cibles ≥ 44 px dans les feuilles (tactile), un seul bouton plein
//  par feuille. Captures (SHOTS=dossier).
// Lancer : construire dist/, puis BANC_PORT=… node scripts/bancs/impression-simple.cjs   (IS_VUES=A,A-sombre,B,B-sombre,C)
'use strict';
const path = require('path');
const fs = require('fs'), http = require('http');
const { pathToFileURL } = require('url');
const { lancer } = require('./_navigateur.cjs');
const PW = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const NM = path.join(__dirname, '..', '..', 'node_modules');
const PDFJS = fs.existsSync(path.join(NM, 'pdfjs-dist')) ? path.join(NM, 'pdfjs-dist') : '/opt/npm-tools/node_modules/pdfjs-dist';
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4611);
const SHOTS = process.env.SHOTS || '';
const VUES = process.env.IS_VUES ? process.env.IS_VUES.split(',') : ['A', 'A-sombre', 'B', 'B-sombre', 'C', 'D', 'D-sombre', 'D1'];
const MAINTENANT = Date.now(), H = 3600000, J = 24 * H;
const ilYaH = (h) => new Date(MAINTENANT - h * H).toISOString();
const dansJ = (j) => new Date(MAINTENANT + j * J).toISOString();
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: ilYaH(0) }];
const V = [
  { tx: 9301, titre: 'Alpha Nike taille 42', suivi: '41234567', num: '21' },
  { tx: 9302, titre: 'Bravo Adidas taille 40', suivi: 'XW123456789TS', num: '22' },
  { tx: 9303, titre: 'Charlie Asics taille 41', suivi: '42234567', num: '23' },
  { tx: 9304, titre: 'Delta Puma taille 39', suivi: 'XW223456789TS', num: '24' },
];
const VC_TITRE = 'Foxtrot Cabas cuir';
const TEST_B64 = fs.readFileSync(path.join(__dirname, 'bordereau-test.b64'), 'utf8').trim();

async function pdfDeTest(code) {
  const { PDFDocument, StandardFonts } = require(path.join(NM, 'pdf-lib'));
  const d = await PDFDocument.load(Buffer.from(TEST_B64, 'base64'));
  const f = await d.embedFont(StandardFonts.Helvetica);
  d.getPages()[0].drawText('ETIQUETTE ' + code, { x: 40, y: 760, size: 14, font: f });
  return Buffer.from(await d.save()).toString('base64');
}
async function lirePdf(b64) {
  const pdfjs = await import(pathToFileURL(path.join(PDFJS, 'legacy', 'build', 'pdf.mjs')).href);
  const doc = await pdfjs.getDocument({ data: new Uint8Array(Buffer.from(b64, 'base64')), verbosity: 0 }).promise;
  const out = [];
  for (let i = 1; i <= doc.numPages; i++) { const p = await doc.getPage(i); const v = p.getViewport({ scale: 1 }); out.push({ w: Math.round(v.width), h: Math.round(v.height), texte: (await p.getTextContent()).items.map((x) => x.str).join(' ').replace(/\s+/g, ' ') }); }
  return out;
}
// Une page « porte » un bordereau : son ETIQUETTE, et le N° (texte du tampon, `N° 21`) sur elle ou la fiche qui la suit.
const codesEtNums = (pages) => {
  const r = [];
  pages.forEach((p, i) => { const m = /ETIQUETTE (\d+)/.exec(p.texte); if (!m) return; const suite = pages[i + 1] && !/ETIQUETTE/.test(pages[i + 1].texte) ? pages[i + 1].texte : ''; const z = (p.texte + ' ' + suite).replace(/ETIQUETTE \d+/g, ''); const nums = [...z.matchAll(/N°\s*(\d+)/g)].map((x) => x[1]); r.push({ code: m[1], nums }); });
  return r;
};

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

async function donnees({ aVerifier = null } = {}) {
  return [
    { id: 'main', data: { vinted_used_numeros: [12, 21, 22, 23, 24], vinted_annonce_numeros: Object.fromEntries(V.map((v) => [`i${v.tx}`, { numero: v.num, title: v.titre, auto: v.num === aVerifier ? undefined : false, numberedAt: v.num === aVerifier ? '2026-10-15T10:00:00.000Z' : ilYaH(200) }])) } },
    { id: 'harvest_111_orders_sold', data: { capturedAt: ilYaH(0.2), payload: { my_orders: V.map((v, i) => ({ transaction_id: v.tx, title: v.titre, price: { amount: '50', currency_code: 'EUR' }, status: 'Le paiement a été validé', transaction_user_status: 'needs_action', date: ilYaH(20 + i) })) } } },
    ...V.map((v) => ({ id: `harvest_111_txn_${v.tx}`, data: { capturedAt: ilYaH(1), payload: { transaction: { id: v.tx, item_id: `i${v.tx}` } } } })),
    ...await Promise.all(V.map(async (v) => ({ id: 'email_bord_' + v.tx, data: { transaction: String(v.tx), uid: '111', filename: `bordereau-${v.tx}.pdf`, modele: v.titre, article: v.titre, receivedAt: ilYaH(2), pdfB64: await pdfDeTest(String(v.tx)), suivi: v.suivi } }))),
    // Le bordereau Vestiaire est ANNONCÉ (rangé) mais sa ligne n'a pas de PDF : il doit être DIT, jamais sauté.
    { id: 'vc_ventes', data: { lectures: { 'a-expedier': { at: ilYaH(0.3), complet: true }, ventes: { at: ilYaH(0.3) } }, ventes: {
      V1: { productId: '71000001', aExpedier: true, limite: dansJ(3), date: ilYaH(5), titre: VC_TITRE, etat: 'ACTION_NEEDED', num: '12',
        montant: { valeur: 180.5, devise: 'EUR', cle: 'sellerEarning' }, transporteur: 'Chronopost', suivi: 'XW000000001FR', etiquette: true, bordereau: { id: 'vc_label_71000001', at: ilYaH(1) } },
    } } },
  ];
}

async function ouvrir(b, { tactile, sombre = false, imprimante = null, LIGNES, tab = 'cat_bord', local = {} }) {
  const vue = tactile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: IPHONE } : { viewport: { width: 1512, height: 950 } };
  const ctx = await b.newContext({ ...vue, colorScheme: sombre ? 'dark' : 'light' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const compte = { pdf: 0 };   // les lectures de PDF dans la base (la ligne lourde, §4.4)
  const mainData = LIGNES.find((r) => r.id === 'main').data;
  await pg.addInitScript(({ m, sombre: s, impr, loc }) => {
    try {
      localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', 'true'); localStorage.setItem('vinted_dark', JSON.stringify(s));
      if (!sessionStorage.getItem('banc_init')) {
        sessionStorage.setItem('banc_init', '1');
        localStorage.setItem('vinted_annonce_numeros', JSON.stringify(m.vinted_annonce_numeros)); localStorage.setItem('vinted_used_numeros', JSON.stringify(m.vinted_used_numeros));
        if (impr) localStorage.setItem('vrm_imprimante', JSON.stringify(impr)); else localStorage.removeItem('vrm_imprimante');
        for (const [k, v] of Object.entries(loc || {})) localStorage.setItem(k, v);
      }
    } catch (_) {}
    // Ce que le navigateur ouvre, et SI c'est dans le geste : `window.event` est le toucher en cours, ou rien (après
    // une attente). Safari d'iPhone n'ouvre la feuille de partage / une fenêtre que dans le geste.
    window.__ouvertures = []; window.__pdfs = [];
    const o = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob) => { const u = o(blob); try { if (blob && blob.type === 'application/pdf') window.__pdfs.push({ u, blob }); } catch (_) {} return u; };
    const geste = () => (window.event && /^(click|pointerup|touchend|keydown|keyup|mouseup)$/.test(window.event.type)) ? window.event.type : '';
    try { Object.defineProperty(navigator, 'canShare', { configurable: true, value: (d) => !!(d && d.files && d.files.length) }); } catch (_) {}
    try { Object.defineProperty(navigator, 'share', { configurable: true, value: (d) => { window.__ouvertures.push({ voie: 'partage', geste: geste(), at: Date.now(), blob: d && d.files && d.files[0] }); return Promise.resolve(); } }); } catch (_) {}
    window.open = (u) => { window.__ouvertures.push({ voie: 'onglet', geste: geste(), at: Date.now(), url: String(u) }); return null; };
    window.print = () => {};
  }, { m: mainData, sombre, impr: imprimante, loc: local });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) || /^https?:\/\/[^/]*vinted\.net\//i.test(r.request().url()) ? r.abort() : r.continue()));
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
    if (/select=(b:data->>pdfB64|b64:data->>b64)/.test(u)) { compte.pdf++; if (process.env.IS_DIAG) console.log('    (lecture) ' + u.slice(0, 200)); }
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: r.data.capturedAt || ilYaH(0), cap: r.data.capturedAt });
    const filtres = [...u.matchAll(/[?&]data->>([a-zA-Z_]+)=(not\.)?is\.null/g)].map((m) => ({ k: m[1], non: !!m[2] }));
    const passe = (r) => filtres.every((f) => (f.non ? r.data[f.k] != null : r.data[f.k] == null));
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(',').map((x) => x.replace(/^"|"$/g, '')); return j(LIGNES.filter((r) => ids.includes(r.id) && passe(r)).map(forme)); }
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1] && passe(r)).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id) && passe(r)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  ctx.on('page', (p) => { if (p !== pg) p.close().catch(() => {}); });
  await srvPret;
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  if (tab === 'cat_bord') await pg.waitForFunction((n) => { const t = document.body.innerText; return n.every((x) => t.includes('N°' + x)); }, V.map((v) => v.num), { timeout: 45000 }).catch(() => {});
  return { ctx, pg, errs, compte };
}
let nShot = 0;
const shot = async (pg, nom) => { if (SHOTS) { try { await pg.screenshot({ path: path.join(SHOTS, `impression-simple-${String(++nShot).padStart(2, '0')}-${nom}.png`), timeout: 60000 }); } catch (_) {} } };
// UN TOUCHER : au doigt (tap) en tactile, au clic sinon — compté.
const toucher = async (o, sel) => { const l = o.pg.locator(sel).first(); await l.waitFor({ state: 'visible', timeout: 15000 }); if (o.tactile) await l.tap(); else await l.click(); o.touchers++; };
// (16 nov., lot tampons-parametres — Julien : « je sélectionne ce que je veux imprimer, et après ça m'ouvre une vignette […] et
// quand je touche Imprimer, les réglages sont appliqués ») La sélection ouvre l'APERÇU AVANT IMPRESSION : un toucher de plus,
// son « Imprimer » ouvre le PDF (dans le geste : préparé pendant l'aperçu). Banc de l'aperçu lui-même : tampons-apercu.
const passerApercu = async (o) => { await o.pg.waitForSelector('[data-impr-apercu="pret"] [data-impr-apercu-imprimer]:not([disabled])', { timeout: 60000 }); await toucher(o, '[data-impr-apercu-imprimer]'); };
const attendre = (pg, f, arg, ms = 20000) => pg.waitForFunction(f, arg, { timeout: ms }).then(() => true).catch(() => false);
const ouvertures = (pg) => pg.evaluate(() => window.__ouvertures.map((x) => ({ voie: x.voie, geste: x.geste })));
const b64DePartage = (pg, i) => pg.evaluate(async (k) => { const x = window.__ouvertures[k]; if (!x || !x.blob) return null; const u = new Uint8Array(await x.blob.arrayBuffer()); let s = ''; for (let j = 0; j < u.length; j++) s += String.fromCharCode(u[j]); return btoa(s); }, i);
const b64DeVisionneuse = (pg) => pg.evaluate(async () => { const f = document.querySelector('[data-visionneuse-cadre]'); if (!f) return null; const r = await fetch(f.src); const u = new Uint8Array(await r.arrayBuffer()); let s = ''; for (let j = 0; j < u.length; j++) s += String.fromCharCode(u[j]); return btoa(s); });
const deborde = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const petitesDans = (pg, racine) => pg.evaluate((r) => [...document.querySelectorAll(`${r} button, ${r} a`)].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && !e.disabled; }).map((e) => ({ q: (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24), h: Math.round(e.getBoundingClientRect().height) })).filter((x) => x.h < 44), racine);
const pleinsDans = (pg, racine) => pg.evaluate((r) => [...document.querySelectorAll(`${r} .vrm-b-primaire`)].filter((e) => e.getBoundingClientRect().width > 0).length, racine);

// ── A · la première fois, au doigt (iPhone) ──────────────────────────────────
async function scenarioA(b, nom, sombre) {
  const LIGNES = await donnees();
  const o = { ...(await ouvrir(b, { tactile: true, sombre, imprimante: null, LIGNES })), tactile: true, touchers: 0 };
  const { pg } = o;
  try {
    const pret = await attendre(pg, () => { const e = document.querySelector('[data-impr-lot]'); return e && e.getAttribute('data-impr-pret') === '1' && e.getAttribute('data-impr-lot') === '5'; }, null, 45000);
    const etat0 = await pg.evaluate(() => { const e = document.querySelector('[data-impr-lot]'); return e ? { n: e.getAttribute('data-impr-lot'), pret: e.getAttribute('data-impr-pret'), txt: e.innerText.trim() } : null; });
    // (version studio) le plein du Studio dit « Imprimer 5 » (sans parenthèses, la place du rond d'encre) : le nombre suffit.
    dit(pret && etat0 && /(^|\D)5(\D|$)/.test(etat0.txt), `${nom} : A0 « Imprimer (5) » est là, son PDF préparé d'avance (4 Vinted + 1 Vestiaire annoncé)`, JSON.stringify(etat0));
    dit(o.compte.pdf === 5, `${nom} : A0 au téléphone, seuls les 5 bordereaux qui PARTENT sont lus d'avance (une fois)`, String(o.compte.pdf));
    await shot(pg, `${nom}-ecran`);
    await toucher(o, '[data-impr-lot]');
    const q = await attendre(pg, () => !!document.querySelector('[data-impr-papier-feuille="premiere"]'), null, 8000);
    dit(q && (await ouvertures(pg)).length === 0, `${nom} : A1 la PREMIÈRE fois : la question du papier, rien d'ouvert encore`);
    await shot(pg, `${nom}-papier`);
    await toucher(o, '[data-impr-papier-choix="normale"]');
    dit((await ouvertures(pg)).length === 0, `${nom} : A1b l'aperçu avant impression d'abord : rien d'ouvert`);
    await passerApercu(o);
    await attendre(pg, () => window.__ouvertures.length > 0, null, 8000);
    const ouv = await ouvertures(pg);
    dit(ouv.length === 1 && ouv[0].voie === 'partage' && ouv[0].geste === 'click', `${nom} : A2 la feuille de partage s'ouvre DANS le toucher (window.event = ${ouv[0] && ouv[0].geste || '—'})`, JSON.stringify(ouv));
    dit(o.touchers === 3, `${nom} : A3 3 touchers jusqu'au PDF la première fois (Imprimer · papier · Imprimer de l'aperçu)`, String(o.touchers));
    const b64 = await b64DePartage(pg, 0);
    const pages = b64 ? await lirePdf(b64) : [];
    const cn = codesEtNums(pages);
    const attendu = Object.fromEntries(V.map((v) => [String(v.tx), v.num]));
    dit(cn.length === 4 && new Set(cn.map((x) => x.code)).size === 4, `${nom} : A4 le PDF porte les 4 bordereaux lisibles (${pages.length} pages)`, JSON.stringify(cn.map((x) => x.code)));
    dit(cn.length === 4 && cn.every((x) => x.nums.length === 1 && x.nums[0] === attendu[x.code]), `${nom} : A5 chaque bordereau tamponné de SON N° (et d'aucun autre)`, JSON.stringify(cn));
    dit(pages.length >= 4 && pages.every((p) => p.w === 595 && p.h === 842), `${nom} : A6 Classique : des pages A4`, JSON.stringify(pages.map((p) => [p.w, p.h])));
    await attendre(pg, () => /normale/.test(localStorage.getItem('vrm_imprimante') || ''), null, 5000);   // `save` écrit un instant après
    const retenu = await pg.evaluate(() => localStorage.getItem('vrm_imprimante'));
    const lien = await pg.evaluate(() => { const e = document.querySelector('[data-impr-format]'); return e ? e.getAttribute('data-impr-format') : null; });
    dit(/normale/.test(retenu || '') && lien === 'normale', `${nom} : A7 le papier est RETENU (réglage synchronisé \`vrm_imprimante\`) et dit à côté du bouton`, JSON.stringify({ retenu, lien }));
    await attendre(pg, () => !!document.querySelector('[data-impr-feuille="question"]'), null, 8000);
    const apres = await pg.evaluate(() => { const f = document.querySelector('[data-impr-feuille]'); return f ? { voie: f.getAttribute('data-impr-voie'), n: f.getAttribute('data-impr-n'), vign: [...f.querySelectorAll('[data-impr-vignette]')].map((e) => e.getAttribute('data-impr-vignette-num')), absent: [...f.querySelectorAll('[data-impr-absent]')].map((e) => e.getAttribute('data-impr-absent') + ':' + e.getAttribute('data-impr-absent-raison')), question: !!f.querySelector('[data-impr-question]') } : null; });
    dit(apres && apres.voie === 'partage' && apres.n === '4' && apres.question && JSON.stringify(apres.vign) === JSON.stringify(cn.map((x) => attendu[x.code])), `${nom} : A8 après : « Tout est sorti ? » et les 4 vignettes, dans l'ordre du PDF`, JSON.stringify(apres));
    dit(apres && apres.absent.length === 1 && /^vc:V1:sansPdf$/.test(apres.absent[0]), `${nom} : A9 le bordereau Vestiaire sans PDF est DIT, avec sa raison (jamais sauté en silence)`, JSON.stringify(apres && apres.absent));
    await pg.waitForTimeout(700);
    await shot(pg, `${nom}-apres`);
    const p44 = await petitesDans(pg, '[data-impr-feuille]');
    dit(!p44.length, `${nom} : A10 cibles ≥ 44 px dans la feuille d'après`, JSON.stringify(p44.slice(0, 5)));
    dit((await pleinsDans(pg, '[data-impr-feuille]')) === 1, `${nom} : A11 UN seul bouton plein dans la feuille d'après`);
    // « Il en manque » : le N°22 seul repart.
    await toucher(o, '[data-impr-manque]');
    await toucher(o, '[data-impr-vignette-num="22"]');
    const prM = await attendre(pg, () => { const e = document.querySelector('[data-impr-reimprimer]'); return e && e.getAttribute('data-impr-pret') === '1' && e.getAttribute('data-impr-reimprimer') === '1'; }, null, 10000);
    await shot(pg, `${nom}-il-en-manque`);
    await toucher(o, '[data-impr-reimprimer]');
    await attendre(pg, () => window.__ouvertures.length > 1, null, 8000);
    const ouv2 = await ouvertures(pg);
    const b2 = ouv2.length > 1 ? await b64DePartage(pg, 1) : null;
    const p2 = b2 ? await lirePdf(b2) : [];
    const cn2 = codesEtNums(p2);
    dit(prM && ouv2.length === 2 && ouv2[1].geste === 'click' && cn2.length === 1 && cn2[0].code === '9302' && cn2[0].nums[0] === '22', `${nom} : A12 « Il en manque » ⇒ seul le N°22 repart (une page, la sienne), dans le geste`, JSON.stringify({ prM, ouv2, cn2 }));
    await attendre(pg, () => !!document.querySelector('[data-impr-feuille="question"]'), null, 8000);
    await toucher(o, '[data-impr-oui]');
    await attendre(pg, () => !document.querySelector('[data-impr-feuille]'), null, 5000);
    const imprimes = await pg.evaluate(() => { try { return Object.keys(JSON.parse(localStorage.getItem('vinted_bords_printed') || '{}')); } catch (_) { return []; } });
    dit(V.every((v) => imprimes.includes(String(v.tx))) && !(await pg.$('[data-impr-feuille]')), `${nom} : A13 « Oui » ferme ; les 4 bordereaux ouverts sont notés imprimés`, JSON.stringify(imprimes));
    dit((await deborde(pg)) <= 1, `${nom} : rien ne déborde`);
    dit(o.errs.length === 0, `${nom} : aucune erreur d'app`, o.errs.join(' | ').slice(0, 200));
  } catch (e) { dit(false, `${nom} : le scénario A s'exécute`, String(e.message).slice(0, 200)); await shot(pg, `${nom}-erreur`); }
  await o.ctx.close();
}

// ── B · ensuite, à la souris (ordinateur) ────────────────────────────────────
async function scenarioB(b, nom, sombre) {
  const LIGNES = await donnees();
  const o = { ...(await ouvrir(b, { tactile: false, sombre, imprimante: 'normale', LIGNES })), tactile: false, touchers: 0 };
  const { pg } = o;
  try {
    // Sur ORDINATEUR rien n'est lu d'avance (§4.4 : la visionneuse de VRM attend le PDF, aucun geste à préserver).
    const pret = await attendre(pg, () => { const e = document.querySelector('[data-impr-lot]'); return e && !e.disabled && e.getAttribute('data-impr-lot') === '5'; }, null, 45000);
    await pg.waitForTimeout(2500);
    const luAvant = o.compte.pdf, pretAvant = await pg.evaluate(() => document.querySelector('[data-impr-lot]').getAttribute('data-impr-pret'));
    dit(pret && luAvant === 0 && pretAvant === '0', `${nom} : B0 sur ordinateur, AUCUN PDF n'est lu avant son toucher`, JSON.stringify({ luAvant, pretAvant }));
    await shot(pg, `${nom}-ecran`);
    await toucher(o, '[data-impr-lot]');
    await passerApercu(o);
    const vis = await attendre(pg, () => !!document.querySelector('[data-visionneuse-pdf="pret"]'), null, 30000);
    const papier = !!(await pg.$('[data-impr-papier-feuille]'));
    dit(pret && vis && !papier && o.touchers === 2, `${nom} : B1 papier déjà choisi : Imprimer puis l'aperçu ⇒ la visionneuse s'ouvre avec le PDF (aucune question de papier)`, JSON.stringify({ pret, vis, papier, touchers: o.touchers }));
    const auto = await attendre(pg, () => { const v = document.querySelector('[data-visionneuse-pdf]'); return v && v.getAttribute('data-visionneuse-auto') === 'lancee'; }, null, 8000);
    dit(auto, `${nom} : B2 l'impression part SEULE (la fenêtre d'impression du navigateur)`);
    const b64 = await b64DeVisionneuse(pg);
    const pages = b64 ? await lirePdf(b64) : [];
    const cn = codesEtNums(pages);
    const attendu = Object.fromEntries(V.map((v) => [String(v.tx), v.num]));
    dit(cn.length === 4 && cn.every((x) => x.nums.length === 1 && x.nums[0] === attendu[x.code]), `${nom} : B3 le PDF ouvert : 4 bordereaux, chacun SON N°`, JSON.stringify(cn));
    await shot(pg, `${nom}-visionneuse`);
    await toucher(o, '[data-visionneuse-fermer]');
    await attendre(pg, () => !!document.querySelector('[data-impr-feuille="question"]'), null, 5000);
    // Le tampon d'UN bordereau, APRÈS : sa vignette ⇒ « Rien » ⇒ « Réimprimer celui-ci ».
    await pg.waitForTimeout(600);
    await shot(pg, `${nom}-apres`);
    dit((await pleinsDans(pg, '[data-impr-feuille]')) === 1, `${nom} : B4 UN seul bouton plein dans la feuille d'après`);
    const avantCorr = await pg.evaluate(() => window.__pdfs.length);
    await toucher(o, '[data-impr-vignette-num="23"]');
    await toucher(o, '[data-impr-corrige] [data-impr-tampon-choix="rien"]');
    const prU = await attendre(pg, () => { const e = document.querySelector('[data-impr-reimprimer-un]'); return e && e.getAttribute('data-impr-pret') === '1'; }, null, 15000);
    await shot(pg, `${nom}-corriger`);
    // (Le bouton est ACTIF : une transition d'opacité peut rester figée dans Chromium sans tête après la visionneuse PDF — l'opacité n'est pas jugée.)
    const etatUn = await pg.evaluate(() => { const e = document.querySelector('[data-impr-reimprimer-un]'); return e ? { actif: !e.disabled } : null; });
    await toucher(o, '[data-impr-reimprimer-un]');
    await attendre(pg, (n) => { const v = document.querySelector('[data-visionneuse-cadre]'); return v && window.__pdfs.length > n; }, avantCorr, 8000);
    const b2 = await b64DeVisionneuse(pg);
    const p2 = b2 ? await lirePdf(b2) : [];
    const cn2 = codesEtNums(p2);
    dit(prU && etatUn && etatUn.actif && cn2.length === 1 && cn2[0].code === '9303' && cn2[0].nums.length === 0 && !/Charlie Asics/.test(p2.map((p) => p.texte).join(' ')), `${nom} : B5 le tampon d'UN bordereau se corrige APRÈS : N°23 ⇒ « Rien » ⇒ une page, son étiquette, sans N° ni titre`, JSON.stringify({ prU, etatUn, cn2 }));
    await toucher(o, '[data-visionneuse-fermer]');
    await attendre(pg, () => !!document.querySelector('[data-impr-feuille]'), null, 5000);
    await toucher(o, '[data-impr-oui]');
    // Changer de papier : un toucher discret à côté du bouton, jamais une étape ; retenu.
    await toucher(o, '[data-impr-format]');
    await toucher(o, '[data-impr-papier-feuille="changer"] [data-impr-papier-choix="planche4"]');
    const fm = await attendre(pg, () => { const e = document.querySelector('[data-impr-format]'); return e && e.getAttribute('data-impr-format') === 'planche4'; }, null, 5000);
    await attendre(pg, () => /planche4/.test(localStorage.getItem('vrm_imprimante') || ''), null, 5000);   // `save` écrit un instant après
    const retenu = await pg.evaluate(() => localStorage.getItem('vrm_imprimante'));
    const ouvAvant = await pg.evaluate(() => !!document.querySelector('[data-visionneuse-pdf]'));
    dit(fm && /planche4/.test(retenu || '') && !ouvAvant, `${nom} : B6 changer de papier (4 par page) : retenu, et rien ne s'imprime pour ça`, JSON.stringify({ retenu, ouvAvant }));
    await shot(pg, `${nom}-papier-change`);
    dit((await deborde(pg)) <= 1, `${nom} : rien ne déborde`);
    dit(o.errs.length === 0, `${nom} : aucune erreur d'app`, o.errs.join(' | ').slice(0, 200));
  } catch (e) { dit(false, `${nom} : le scénario B s'exécute`, String(e.message).slice(0, 200)); await shot(pg, `${nom}-erreur`); }
  await o.ctx.close();
}

// ── C · §5 : un N° « à vérifier » DEMANDE avant le PDF ────────────────────────
async function scenarioC(b, nom) {
  const LIGNES = await donnees({ aVerifier: '23' });
  const o = { ...(await ouvrir(b, { tactile: true, sombre: false, imprimante: 'normale', LIGNES })), tactile: true, touchers: 0 };
  const { pg } = o;
  try {
    await attendre(pg, () => { const e = document.querySelector('[data-impr-lot]'); return e && e.getAttribute('data-impr-pret') === '1'; }, null, 45000);
    await toucher(o, '[data-impr-lot]');
    await passerApercu(o);
    const q = await attendre(pg, () => /N°23 n.est pas encore vérifié/.test(document.body.innerText), null, 8000);
    dit(q && (await ouvertures(pg)).length === 0, `${nom} : C1 le N° « à vérifier » (23) DEMANDE, et rien n'est ouvert avant sa réponse`);
    await shot(pg, `${nom}-question`);
    await pg.evaluate(() => { const bs = [...document.querySelectorAll('button')].filter((x) => x.innerText.trim() === 'Annuler' && x.offsetParent); bs[bs.length - 1].click(); });
    await pg.waitForTimeout(1500);
    dit((await ouvertures(pg)).length === 0 && !(await pg.$('[data-impr-feuille]')), `${nom} : C2 « Annuler » ⇒ aucun PDF ouvert, aucune feuille`);
    await toucher(o, '[data-impr-lot]');
    await passerApercu(o);
    await attendre(pg, () => /N°23 n.est pas encore vérifié/.test(document.body.innerText), null, 8000);
    await pg.evaluate(() => { const bs = [...document.querySelectorAll('button')].filter((x) => /J'ai vérifié, imprimer/.test(x.innerText) && x.offsetParent); bs[bs.length - 1].click(); });
    const f = await attendre(pg, () => !!document.querySelector('[data-impr-feuille] [data-impr-ouvrir]'), null, 15000);
    await shot(pg, `${nom}-ouvrir`);
    const avant = (await ouvertures(pg)).length;
    await toucher(o, '[data-impr-ouvrir]');
    await attendre(pg, (n) => window.__ouvertures.length > n, avant, 5000);
    const ouv = await ouvertures(pg);
    dit(f && avant === 0 && ouv.length === 1 && ouv[0].voie === 'partage' && ouv[0].geste === 'click', `${nom} : C3 « J'ai vérifié » ⇒ « Ouvrir le PDF » : SON toucher ouvre le partage, dans le geste`, JSON.stringify({ f, avant, ouv }));
    const q2 = await attendre(pg, () => !!document.querySelector('[data-impr-question]'), null, 5000);
    dit(q2, `${nom} : C4 puis « Tout est sorti ? »`);
    dit(o.errs.length === 0, `${nom} : aucune erreur d'app`, o.errs.join(' | ').slice(0, 200));
  } catch (e) { dit(false, `${nom} : le scénario C s'exécute`, String(e.message).slice(0, 200)); await shot(pg, `${nom}-erreur`); }
  await o.ctx.close();
}

// ── D · « Imprimer les N » sur ordinateur, à l'ouverture (16 nov., lot impression-directe) ─────────────────
const PUBLIE = JSON.stringify({ prets: 5, aImprimer: 5, total: 5, lot: 5, at: Date.now() });
async function scenarioD(b, nom, sombre, { papier = 'normale' } = {}) {
  const LIGNES = await donnees();
  const o = { ...(await ouvrir(b, { tactile: false, sombre, imprimante: papier, LIGNES, tab: 'journee', local: { vrm_colis_prets: PUBLIE } })), tactile: false, touchers: 0 };
  const { pg } = o;
  try {
    // VISIBLE pour de vrai : le point au centre du bouton est le bouton (pas l'écran d'ouverture par-dessus).
    const vu = await attendre(pg, () => { const e = document.querySelector('[data-impression-directe-imprimer="5"]'); if (!e) return false; const r = e.getBoundingClientRect(); const x = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!(x && e.contains(x)); }, null, 45000);
    const t = await pg.evaluate(() => { const e = document.querySelector('[data-impression-directe-imprimer]'); return e ? { txt: e.innerText.trim(), h: Math.round(e.getBoundingClientRect().height), plein: getComputedStyle(e).backgroundColor } : null; });
    dit(vu && t && t.txt === 'Imprimer les 5' && t.h >= 44, `${nom} : D0 à l'ouverture (Ma journée), la bannière « Imprimer les 5 » (le nombre publié par Ventes), ≥ 44 px`, JSON.stringify(t));
    await shot(pg, `${nom}-banniere`);
    await toucher(o, '[data-impression-directe-imprimer]');
    if (!papier) {
      const q = await attendre(pg, () => !!document.querySelector('[data-impr-papier-feuille]'), null, 30000);
      dit(q, `${nom} : D1 papier jamais choisi : UNE question (le papier), la première fois`);
      await shot(pg, `${nom}-papier`);
      await toucher(o, '[data-impr-papier-feuille] [data-impr-papier-choix="normale"]');
    }
    const vis = await attendre(pg, () => !!document.querySelector('[data-visionneuse-pdf="pret"]'), null, 45000);
    const choisir = !!(await pg.$('[data-lot-etape="choix"]'));
    dit(vis && !choisir && o.touchers === (papier ? 1 : 2), `${nom} : D2 ${papier ? 'UN clic' : 'deux clics (la question la 1re fois)'} ⇒ la visionneuse avec le PDF, sans la feuille « Choisir »`, JSON.stringify({ vis, choisir, touchers: o.touchers }));
    const auto = await attendre(pg, () => { const v = document.querySelector('[data-visionneuse-pdf]'); return v && v.getAttribute('data-visionneuse-auto') === 'lancee'; }, null, 8000);
    dit(auto, `${nom} : D3 l'impression part SEULE`);
    const b64 = await b64DeVisionneuse(pg);
    const pages = b64 ? await lirePdf(b64) : [];
    const cn = codesEtNums(pages);
    const attendu = Object.fromEntries(V.map((v) => [String(v.tx), v.num]));
    dit(cn.length === 4 && cn.every((x) => x.nums.length === 1 && x.nums[0] === attendu[x.code]), `${nom} : D4 le PDF : 4 bordereaux, chacun SON N° tamponné (papier ${papier || 'choisi à la question'})`, JSON.stringify(cn));
    await shot(pg, `${nom}-visionneuse`);
    await toucher(o, '[data-visionneuse-fermer]');
    const fait = await attendre(pg, () => !!document.querySelector('[data-impression-faite="4"]'), null, 8000);
    const feuille = !!(await pg.$('[data-impr-feuille]'));
    const marques = await pg.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('vinted_bords_printed') || '{}')));
    dit(fait && !feuille && marques.length === 4, `${nom} : D5 « 4 imprimés · Annuler », aucune feuille d'après, les 4 marqués imprimés`, JSON.stringify({ fait, feuille, marques }));
    await shot(pg, `${nom}-imprimes`);
    await toucher(o, '[data-impression-annuler]');
    const vides = await attendre(pg, () => Object.keys(JSON.parse(localStorage.getItem('vinted_bords_printed') || '{}')).length === 0, null, 8000);
    dit(vides, `${nom} : D6 « Annuler » retire CES marques (plus aucun marqué imprimé)`);
    dit((await deborde(pg)) <= 1, `${nom} : rien ne déborde`);
    dit(o.errs.length === 0, `${nom} : aucune erreur d'app`, o.errs.join(' | ').slice(0, 200));
  } catch (e) { dit(false, `${nom} : le scénario D s'exécute`, String(e.message).slice(0, 200)); await shot(pg, `${nom}-erreur`); }
  await o.ctx.close();
}
// « Plus tard » range la bannière ; rien ne s'imprime sans son clic.
async function scenarioDPlusTard(b, nom) {
  const LIGNES = await donnees();
  const o = { ...(await ouvrir(b, { tactile: false, sombre: false, imprimante: 'normale', LIGNES, tab: 'journee', local: { vrm_colis_prets: PUBLIE } })), tactile: false, touchers: 0 };
  const { pg } = o;
  try {
    await attendre(pg, () => !!document.querySelector('[data-impression-directe-imprimer]'), null, 45000);
    await pg.waitForTimeout(3000);
    dit(o.compte.pdf === 0 && !(await pg.$('[data-visionneuse-pdf]')), `${nom} : D7 rien ne s'imprime (ni ne se lit) sans son clic`, JSON.stringify({ pdf: o.compte.pdf }));
    await toucher(o, '[data-impression-directe-plus-tard]');
    await pg.waitForTimeout(400);
    dit(!(await pg.$('[data-impression-directe]')), `${nom} : D8 « Plus tard » range la bannière`);
  } catch (e) { dit(false, `${nom} : le scénario D « Plus tard » s'exécute`, String(e.message).slice(0, 200)); }
  await o.ctx.close();
}

let srvPret;
(async () => {
  let b;
  try {
    srvPret = new Promise((r) => srv.listen(PORT, r));
    b = await lancer(PW, { executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const v of VUES) {
      console.log('\n— ' + v);
      if (v === 'A') await scenarioA(b, '390', false);
      else if (v === 'A-sombre') await scenarioA(b, '390-sombre', true);
      else if (v === 'B') await scenarioB(b, '1512', false);
      else if (v === 'B-sombre') await scenarioB(b, '1512-sombre', true);
      else if (v === 'C') await scenarioC(b, '390-verifier');
      else if (v === 'D') { await scenarioD(b, '1512-direct', false); await scenarioDPlusTard(b, '1512-plus-tard'); }
      else if (v === 'D-sombre') await scenarioD(b, '1512-direct-sombre', true);
      else if (v === 'D1') await scenarioD(b, '1512-direct-premiere', false, { papier: null });
    }
  } catch (e) { dit(false, 'le banc s’exécute', String(e.stack || e.message || e).slice(0, 300)); }
  finally {
    if (b) await b.close(); srv.close();
    console.log(ko ? `\nKO impression-simple : ${ko} contrôle(s) non conforme(s), ${ok} conforme(s)` : `\nOK impression-simple : ${ok} conformes`);
    process.exit(ko ? 1 : 0);
  }
})();
