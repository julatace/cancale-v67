// Banc : COLIS PLUS (14 nov., propositions 96 à 101 validées par Julien — « fais tout »).
// Données INVENTÉES (dépôt public), formes réelles : 9 ventes Vinted au MÊME titre (`orders_sold`, prix objet
// `{amount}`), leur transaction (`harvest_111_txn_{tx}` → item → fiche N°), leurs bordereaux e-mail
// (`email_bord_{tx}` : PDF 4×6 qui porte « ETIQUETTE <tx> », `suivi`), le stock d'emballages (`vrm_emballages`).
// Exige (jugé sur data-* et sur ce qui est ÉCRIT, §6.4) :
//  A. 98 « 4 par page A4 » (Réglages → Imprimante = 'planche4') : « Tout imprimer » des 9 bordereaux ⇒ UN PDF de
//     3 pages A4, les 9 étiquettes dans l'ORDRE de l'aperçu (relu par pdf.js) ; l'aperçu dit « 3 feuilles » ; le
//     résultat dit 9 étiquettes / 3 feuilles / l'échelle ;
//  B. 96 Préparer : le format retenu pour ce modèle est PROPOSÉ (« Prendre »), RIEN n'est écrit avant son toucher,
//     « Prendre » écrit SON choix pour CE colis seulement ; 97 : la fourniture au seuil est dite (ambre) ;
//  C. 100 Mains libres (fausse reconnaissance du navigateur) : bouton ≥ 44 px ; « suivant » / « précédent »
//     naviguent ; « il fait froid » ne fait rien ; « fait » ⇒ « Annuler » visible, rien d'écrit avant 5 s,
//     « Annuler » ⇒ rien d'écrit ; « fait » ⇒ `vinted_ship_done` de CETTE vente seulement ; « stop » arrête ;
//     sans reconnaissance : la ligne dit pourquoi, puis disparaît (et ne revient pas) ;
//  D. 101 le temps : la séance est rangée sur l'appareil (le colis fait, mesuré ou « pas mesuré ») ; le
//     récapitulatif montre les tuiles des 30 jours (par colis, au moins, gain sur N colis au prix connu) ;
//  E. 99 la douchette (1512) : une rafale + Entrée hors champ ⇒ LA vente (par son n° de suivi ou de transaction)
//     s'ouvre, éclairée (`data-cible-notif`) ; code inconnu ⇒ rien d'ouvert, dit ; frappe lente, ou dans un champ ⇒ rien ;
//  PARTOUT : cibles ≥ 44 px dans Préparer, rien ne déborde, aucune erreur. Captures 390 tactile (clair, sombre) + 1512.
// Lancer : construire dist/, puis BANC_PORT=… node scripts/bancs/colis-plus.cjs   (SHOTS=dossier, CP_VUES=390,390-sombre,1512)
const path = require('path');
const fs = require('fs'), http = require('http');
const { pathToFileURL } = require('url');
const NM = path.join(__dirname, '..', '..', 'node_modules');
const PW = require(path.join(NM, 'playwright'));
const { lancer } = require('./_navigateur.cjs');
const { metaVersData } = require('./_meta.cjs');
const PDFJS = fs.existsSync(path.join(NM, 'pdfjs-dist')) ? path.join(NM, 'pdfjs-dist') : '/opt/npm-tools/node_modules/pdfjs-dist';
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || (4700 + Math.floor(Math.random() * 800)));
const SHOTS = process.env.SHOTS || '';
const VUES = process.env.CP_VUES ? process.env.CP_VUES.split(',') : ['390', '390-sombre', '1512'];
const MAINTENANT = Date.now(), H = 3600000, J = 24 * H;
const ilYaH = (h) => new Date(MAINTENANT - h * H).toISOString();
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: ilYaH(0) }];
const TITRE = 'Nike Air Force 1 blanche taille 42';
const V = Array.from({ length: 9 }, (_, k) => ({ tx: 8000000401 + k, suivi: `XA${100000401 + k}FR`, num: String(31 + k) }));

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
  for (let i = 1; i <= doc.numPages; i++) { const pg = await doc.getPage(i); const vp = pg.getViewport({ scale: 1 }); out.push({ w: vp.width, h: vp.height, texte: (await pg.getTextContent()).items.map((x) => x.str).join(' ').replace(/\s+/g, ' ') }); }
  return out;
}

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d && !c ? ' — ' + d : '')); };
const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = f.startsWith('/__pdfjs/') ? path.join(PDFJS, 'build', path.basename(f)) : path.join(DIST, f);
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
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' && typeof v !== 'object' ? String(v) : v);
  }
  return out;
};

async function ouvrir(b, vue, LIGNES, { sombre = false, voix = true, imprimante = 'normale', emballages = null, extra = {} } = {}) {
  const ctx = await b.newContext({ ...vue, acceptDownloads: true });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const consoleErrs = []; pg.on('console', (m) => { if (m.type() === 'error' || (process.env.CP_DIAG && /pdf|worker|warn/i.test(m.type() + m.text()))) consoleErrs.push(m.type() + ':' + m.text().slice(0, 200)); });
  const mainData = LIGNES.find((r) => r.id === 'main').data;
  await pg.addInitScript(({ m, sombre: s, voix: avecVoix, imprimante: impr, emballages: emb, extra: ex }) => {
    try {
      localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', 'true'); localStorage.setItem('vinted_dark', JSON.stringify(s));
      if (!sessionStorage.getItem('banc_init')) {
        sessionStorage.setItem('banc_init', '1');
        localStorage.setItem('vinted_annonce_numeros', JSON.stringify(m.vinted_annonce_numeros)); localStorage.setItem('vinted_used_numeros', JSON.stringify(m.vinted_used_numeros));
        localStorage.setItem('vrm_imprimante', JSON.stringify(impr));
        if (emb) localStorage.setItem('vrm_emballages', JSON.stringify(emb));
        for (const [k, v] of Object.entries(ex || {})) localStorage.setItem(k, JSON.stringify(v));
      }
    } catch (_) {}
    window.__pdfs = [];
    const o = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob) => { try { if (blob && blob.type === 'application/pdf') window.__pdfs.push(blob); } catch (_) {} return o(blob); };
    window.print = () => {};
    // La reconnaissance du NAVIGATEUR, simulée : `__dire(texte)` = une phrase finale entendue.
    try { delete window.SpeechRecognition; delete window.webkitSpeechRecognition; } catch (_) {}
    if (avecVoix) {
      window.__sr = [];
      class FausseSR { constructor() { window.__sr.push(this); } start() { this.parti = true; } stop() { this.fini = true; setTimeout(() => this.onend && this.onend(), 0); } abort() { this.stop(); } }
      Object.defineProperty(window, 'SpeechRecognition', { configurable: true, writable: true, value: FausseSR });
      window.__dire = (t) => { const r = window.__sr[window.__sr.length - 1]; if (!r || r.fini || !r.onresult) return false; r.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: t }], { isFinal: true })] }); return true; };
    } else {
      Object.defineProperty(window, 'SpeechRecognition', { configurable: true, writable: true, value: undefined });
      Object.defineProperty(window, 'webkitSpeechRecognition', { configurable: true, writable: true, value: undefined });
    }
  }, { m: mainData, sombre, voix, imprimante, emballages, extra });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) || /^https?:\/\/[^/]*vinted\.net\//i.test(r.request().url()) ? r.abort() : r.continue()));
  await pg.route('**://cdn.jsdelivr.net/npm/pdfjs-dist@*/**', (r) => {
    const n = path.basename(new URL(r.request().url()).pathname);
    const f = path.join(PDFJS, 'build', n.replace(/\.js$/, '.mjs'));
    if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ status: 200, contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(f) });
  });
  await pg.addInitScript((port) => { import(`http://localhost:${port}/__pdfjs/pdf.min.mjs`).then((m) => { m.GlobalWorkerOptions.workerSrc = `http://localhost:${port}/__pdfjs/pdf.worker.min.mjs`; /* le lecteur de pdf.js DE LA PAGE (même origine) ; l’app écrit son adresse CDN sur une copie, sans effet */ window.pdfjsLib = { ...m, GlobalWorkerOptions: { workerSrc: "" }, getDocument: (o) => { const t = m.getDocument(o); return { promise: t.promise.then((d) => { if (typeof d.destroy !== 'function') d.destroy = () => t.destroy(); return d; }), destroy: () => t.destroy() }; } }; }).catch(() => {}); }, PORT);
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
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
  await pg.goto(`http://localhost:${PORT}/?tab=cat_bord`, { waitUntil: 'domcontentloaded' });
  // Les N° arrivent avec les transactions (identité tx → annonce → fiche) : on attend qu'ils soient écrits.
  await pg.waitForFunction((n) => { const t = document.body.innerText; return n.every((x) => t.includes('N°' + x)); }, V.map((v) => v.num), { timeout: 45000 }).catch(() => {});
  await pg.waitForTimeout(600);
  return { ctx, pg, errs, consoleErrs };
}
const lire = (pg, k) => pg.evaluate((cle) => { try { return JSON.parse(localStorage.getItem(cle) || 'null'); } catch (_) { return 'illisible'; } }, k);
const shot = async (pg, nom) => { if (SHOTS) { try { await pg.screenshot({ path: path.join(SHOTS, `colis-plus-${nom}.png`), timeout: 60000 }); } catch (e) { console.log('  (capture ' + nom + ' manquée : ' + String(e.message).slice(0, 60) + ')'); } } };
const cliquer = (pg, s) => pg.evaluate((q) => { const e = document.querySelector(q); if (!e) return false; e.click(); return true; }, s);
const position = (pg) => pg.evaluate(() => { const f = document.querySelector('[data-preparer]'); return f ? f.getAttribute('data-preparer-position') : null; });
const cleColis = (pg) => pg.evaluate(() => { const e = document.querySelector('[data-preparer-cle]'); return e ? e.getAttribute('data-preparer-cle') : null; });
const deborde = (pg, racine) => pg.evaluate((r) => { const s = document.querySelector(r); const w = window.innerWidth; const hors = s ? [...s.querySelectorAll('*')].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.right > w + 1 || b.left < -1); }).map((e) => String(e.className).slice(0, 30)) : []; return { page: document.documentElement.scrollWidth - document.documentElement.clientWidth, hors: hors.slice(0, 4) }; }, racine);
const petites = (pg, racine) => pg.evaluate((r) => [...document.querySelectorAll(`${r} button, ${r} a, ${r} summary`)].filter((e) => e.getBoundingClientRect().width > 0 && !e.disabled).map((e) => ({ q: (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24), h: Math.round(e.getBoundingClientRect().height) })).filter((x) => x.h < 44), racine);

// ── A · 98 : 4 bordereaux par page A4 ─────────────────────────────────────────
async function lot(b, nom, vue, LIGNES) { try { return await lotBrut(b, nom, vue, LIGNES); } catch (e) { dit(false, `${nom} : A le lot s’exécute`, String(e.message).slice(0, 200)); } }
async function lotBrut(b, nom, vue, LIGNES) {
  console.log(`\n— A. 4 par page A4 · ${nom}`);
  const { ctx, pg, errs, consoleErrs } = await ouvrir(b, vue, LIGNES, { imprimante: process.env.CP_IMPR || 'planche4' });
  try {
    await pg.waitForSelector('button[data-lot-ouvrir="1"]', { timeout: 20000 }).catch(() => {});
    const btn = await pg.$('button[data-lot-ouvrir="1"]');
    if (!btn) { dit(false, `${nom} : « Tout imprimer » est là`); return; }
    await btn.click();
    await pg.waitForSelector('[data-lot-ligne]', { timeout: 8000 }).catch(() => {});
    const ap = await pg.evaluate(() => [...document.querySelectorAll('[data-lot-ligne]')].map((e) => ({ cle: e.getAttribute('data-lot-ligne'), num: e.getAttribute('data-lot-num'), coche: e.getAttribute('data-coche') === '1' })));
    for (const x of ap) { if (!x.coche) await pg.locator(`[data-lot-ligne="${x.cle}"] input`).first().check().catch(() => {}); }
    await pg.waitForTimeout(300);
    const papier = await pg.evaluate(() => { const s = document.querySelector('[data-lot-section="apercu"]'); return s ? { p: s.getAttribute('data-lot-papier'), t: (s.querySelector('h3 span') || {}).textContent || '' } : null; });
    dit(ap.length === 9 && papier && papier.p === 'planche4' && /\b3\b/.test(papier.t), `${nom} : A1 l'aperçu des 9 bordereaux dit « 3 feuilles A4, 4 par page »`, JSON.stringify({ n: ap.length, papier }));
    // A8 · l'imprimante se choisit ICI, au moment d'imprimer (le réglage `vrm_imprimante`, mémorisé).
    const choix = await pg.evaluate(() => [...document.querySelectorAll('[data-lot-imprimante-choix]')].map((e) => e.getAttribute('data-lot-imprimante-choix')));
    await cliquer(pg, '[data-lot-imprimante-choix="thermique"]'); await pg.waitForTimeout(900);
    const apresTh = await pg.evaluate(() => ({ seg: (document.querySelector('[data-lot-imprimante]') || {}).getAttribute && document.querySelector('[data-lot-imprimante]').getAttribute('data-lot-imprimante'), papier: (document.querySelector('[data-lot-section="apercu"]') || { getAttribute: () => null }).getAttribute('data-lot-papier'), ls: localStorage.getItem('vrm_imprimante') }));
    await cliquer(pg, '[data-lot-imprimante-choix="planche4"]'); await pg.waitForTimeout(900);
    const apresPl = await pg.evaluate(() => localStorage.getItem('vrm_imprimante'));
    dit(JSON.stringify(choix) === JSON.stringify(['normale', 'thermique', 'planche4']) && apresTh.seg === 'thermique' && apresTh.papier === '10x15' && /thermique/.test(apresTh.ls || '') && /planche4/.test(apresPl || ''),
      `${nom} : A8 « Tout imprimer » montre le choix Classique · 4 par page · Thermique, et le retient`, JSON.stringify({ choix, apresTh, apresPl }));
    await shot(pg, `${nom}-lot-apercu`);
    await cliquer(pg, 'button[data-lot-imprimer]');
    for (let i = 0; i < 1000; i++) {   // (thermique : chaque étiquette est rendue par pdf.js ; jusqu’à 4 min sur une machine chargée)
      const etat = await pg.evaluate(() => {
        if (window.__pdfs && window.__pdfs.length) return 'pdf';
        const clic = (l) => { const bs = [...document.querySelectorAll('button')].filter((x) => x.innerText.trim() === l && x.offsetParent); if (bs.length) { bs[bs.length - 1].click(); return true; } return false; };
        if (clic("J'ai vérifié, imprimer") || clic('Préparer quand même les PDF')) return 'clic';
        const f = document.querySelector('[data-placeur-tampon]:not([data-placeur-tampon="charge"]) [data-tampon-imprimer]'); if (f) { f.click(); return 'clic'; }
        return 'attente';
      });
      if (etat === 'pdf') break;
      await pg.waitForTimeout(250);
    }
    const b64 = await pg.evaluate(async () => { const bl = window.__pdfs[window.__pdfs.length - 1]; if (!bl) return null; const u = new Uint8Array(await bl.arrayBuffer()); let s = ''; for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); });
    const diag = b64 ? '' : await pg.evaluate(() => JSON.stringify({ placeur: [...document.querySelectorAll('[data-placeur-tampon]')].map((e) => e.getAttribute('data-placeur-tampon')), dialogues: [...document.querySelectorAll('[role=dialog],[role=alertdialog]')].map((e) => (e.getAttribute('aria-label') || '') + ':' + (e.innerText || '').replace(/\s+/g, ' ').slice(0, 600)) }));
    dit(!!b64, `${nom} : A2 UN PDF est produit`, diag + ' ' + consoleErrs.slice(-4).join(' | '));
    if (b64) {
      const pages = await pagesDuPdf(b64);
      const a4 = pages.every((p) => Math.abs(p.w - 595.28) < 1 && Math.abs(p.h - 841.89) < 1);
      // L'étiquette isolée est une IMAGE noir et blanc (« noir pur », lot thermique) : on lit le TAMPON de chacune (« N° 31 »).
      const ordre = pages.flatMap((p) => [...p.texte.matchAll(/N°\s*(\d+)/g)].map((m) => m[1]));
      const attendu = ap.map((x) => x.num);
      dit(pages.length === 3 && a4, `${nom} : A3 9 bordereaux ⇒ 3 pages A4`, JSON.stringify(pages.map((p) => [Math.round(p.w), Math.round(p.h)])));
      dit(ordre.length === 9 && JSON.stringify(ordre) === JSON.stringify(attendu), `${nom} : A4 les 9 étiquettes, dans l'ordre de l'aperçu (4 + 4 + 1)`, JSON.stringify({ pdf: ordre, apercu: attendu }));
      const parPage = pages.map((p) => (p.texte.match(/N°\s*\d+/g) || []).length).join(',');
      dit(parPage === '4,4,1', `${nom} : A5 quatre par feuille, la dernière entamée (chacune tamponnée de SON N°)`, parPage);
    }
    await pg.waitForTimeout(500);
    const res = await pg.evaluate(() => { const e = document.querySelector('[data-planche-resultat]'); return e ? e.getAttribute('data-planche-resultat') : null; });
    dit(res && /^9\/3\/(9[0-9])$/.test(res), `${nom} : A6 le résultat dit ce qui a été posé (9 étiquettes, 3 feuilles, l'échelle)`, String(res));
    await shot(pg, `${nom}-lot-resultat`);
    dit(errs.length === 0, `${nom} : A7 aucune erreur d'app`, errs.join(' | ').slice(0, 200));
  } finally { await ctx.close(); }
}

// ── F · Classique A4 : chaque bordereau se règle un par un (tampon, retirer) et le tampon est TOUJOURS là ──
async function lotClassique(b, nom, vue, LIGNES) { try { return await lotClassiqueBrut(b, nom, vue, LIGNES); } catch (e) { dit(false, `${nom} : F le lot classique s’exécute`, String(e.message).slice(0, 200)); } }
async function lotClassiqueBrut(b, nom, vue, LIGNES) {
  console.log(`\n— F. Imprimante classique, un par un · ${nom}`);
  const { ctx, pg, errs } = await ouvrir(b, vue, LIGNES, { imprimante: 'normale' });
  try {
    await pg.waitForSelector('button[data-lot-ouvrir="1"]', { timeout: 20000 }).catch(() => {});
    if (!(await cliquer(pg, 'button[data-lot-ouvrir="1"]'))) { dit(false, `${nom} : « Tout imprimer » est là`); return; }
    await pg.waitForSelector('[data-lot-ligne]', { timeout: 8000 }).catch(() => {});
    const ap = await pg.evaluate(() => [...document.querySelectorAll('[data-lot-ligne]')].map((e) => ({ cle: e.getAttribute('data-lot-ligne'), num: e.getAttribute('data-lot-num'), coche: e.getAttribute('data-coche') === '1' })));
    for (const x of ap) { if (!x.coche) await pg.locator(`[data-lot-ligne="${x.cle}"] input`).first().check().catch(() => {}); }
    await pg.waitForTimeout(300);
    const sansTampon = ap[1], titreTaille = ap[0], retire = ap[ap.length - 1];
    await pg.selectOption(`[data-lot-tampon-choix="${sansTampon.cle}"]`, 'rien');
    await pg.selectOption(`[data-lot-tampon-choix="${titreTaille.cle}"]`, 'num');
    await cliquer(pg, `[data-lot-retirer="${retire.cle}"]`);
    await pg.waitForTimeout(400);
    const etat = await pg.evaluate(([a, r]) => ({ apercuA: (document.querySelector(`[data-lot-apercu="${a}"]`) || { getAttribute: () => null }).getAttribute('data-lot-apercu-tampon'), retireCoche: (document.querySelector(`[data-lot-ligne="${r}"]`) || { getAttribute: () => null }).getAttribute('data-coche'), n: (document.querySelector('[data-lot-imprimer]') || { getAttribute: () => null }).getAttribute('data-lot-imprimer'), choisi: (document.querySelector('[data-lot-imprimante]') || { getAttribute: () => null }).getAttribute('data-lot-imprimante') }), [sansTampon.cle, retire.cle]);
    dit(etat.apercuA === 'rien' && etat.retireCoche === '0' && etat.n === String(ap.length - 1) && etat.choisi === 'normale', `${nom} : F1 dans l'aperçu, CE bordereau : « sans tampon » ; un autre retiré du lot (${ap.length - 1} restent) ; Classique choisi`, JSON.stringify(etat));
    await shot(pg, `${nom}-lot-classique`);
    await cliquer(pg, 'button[data-lot-imprimer]');
    for (let i = 0; i < 600; i++) {
      const e = await pg.evaluate(() => {
        if (window.__pdfs && window.__pdfs.length) return 'pdf';
        const clic = (l) => { const bs = [...document.querySelectorAll('button')].filter((x) => x.innerText.trim() === l && x.offsetParent); if (bs.length) { bs[bs.length - 1].click(); return true; } return false; };
        if (clic("J'ai vérifié, imprimer") || clic('Préparer quand même les PDF')) return 'clic';
        const f = document.querySelector('[data-placeur-tampon]:not([data-placeur-tampon="charge"]) [data-tampon-imprimer]'); if (f) { f.click(); return 'clic'; }
        return 'attente';
      });
      if (e === 'pdf') break;
      await pg.waitForTimeout(250);
    }
    const b64 = await pg.evaluate(async () => { const bl = window.__pdfs[window.__pdfs.length - 1]; if (!bl) return null; const u = new Uint8Array(await bl.arrayBuffer()); let s = ''; for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); });
    dit(!!b64, `${nom} : F2 UN PDF est produit`);
    if (!b64) return;
    const pages = await pagesDuPdf(b64);
    // Le bordereau et, s'il n'a pas de blanc sûr, sa fiche juste après : la « zone » de chaque bordereau.
    const zones = []; pages.forEach((p) => { const m = /ETIQUETTE (\d+)/.exec(p.texte); if (m) zones.push({ tx: m[1], t: p.texte }); else if (zones.length) zones[zones.length - 1].t += ' ' + p.texte; });
    const txs = zones.map((z) => z.tx), attendu = ap.slice(0, -1).map((x) => x.cle.replace(/^v:/, ''));
    dit(JSON.stringify(txs) === JSON.stringify(attendu), `${nom} : F3 le bordereau retiré n'est pas dans le PDF, les autres dans l'ordre`, JSON.stringify({ txs, attendu }));
    const nu = (c) => String(c).replace(/^v:/, ''); const num = (tx) => (ap.find((x) => nu(x.cle) === tx) || {}).num;
    const juge = zones.map((z) => ({ tx: z.tx, n: new RegExp(`N°\\s*${num(z.tx)}(\\D|$)`).test(z.t.replace(/ETIQUETTE \d+/g, '')), titre: /Nike Air Force/.test(z.t), taille: /\b42\b/.test(z.t.replace(/ETIQUETTE \d+/g, '')) }));
    const sans = juge.find((j) => j.tx === nu(sansTampon.cle)), tt = juge.find((j) => j.tx === nu(titreTaille.cle)), autres = juge.filter((j) => j !== sans && j !== tt);
    dit(autres.length === ap.length - 3 && autres.every((j) => j.n && j.titre), `${nom} : F4 CLASSIQUE A4 : chaque bordereau porte SON tampon (N° + titre, le réglage)`, JSON.stringify(autres.filter((j) => !j.n || !j.titre)).slice(0, 200) + " · pages : " + JSON.stringify(pages.map((p) => p.texte.slice(0, 160))).slice(0, 900));
    dit(sans && !sans.n && !sans.titre, `${nom} : F5 le bordereau réglé « sans tampon » n'a ni N° ni titre`, JSON.stringify(sans));
    dit(tt && tt.n && !tt.titre, `${nom} : F6 le bordereau réglé « N° seul » porte son N°, sans le titre`, JSON.stringify(tt));
    dit(errs.length === 0, `${nom} : F7 aucune erreur d'app`, errs.join(' | ').slice(0, 200));
  } finally { await ctx.close(); }
}

// ── B, C, D · Préparer : format proposé, fournitures, mains libres, temps ─────────
const EMB = (t0) => ({ v: 1, defaut: 't1', choix: {}, types: [
  { id: 't1', nom: 'Petit carton', cout: '', compte: { n: 20, at: t0 }, seuil: 2 },
  { id: 't2', nom: 'Grand carton', cout: '', compte: { n: 20, at: t0 }, seuil: 2 },
  { id: 't3', nom: 'Scotch', cout: '', compte: { n: 1, at: t0 }, seuil: 1, tous: true, pour: 25 },
], parModele: { 'nike|air force 1': { id: 't2', at: t0, nom: 'Nike Air Force 1' } } });

async function preparer(b, nom, vue, LIGNES, sombre) {
  console.log(`\n— B·C·D. Préparer mes colis · ${nom}`);
  const t0 = MAINTENANT - 10 * J;
  const { ctx, pg, errs } = await ouvrir(b, vue, LIGNES, { sombre, emballages: EMB(t0) });
  try {
    await pg.waitForSelector('[data-preparer-ouvrir]', { timeout: 20000 }).catch(() => {});
    const avant = await lire(pg, 'vrm_emballages');
    if (!(await cliquer(pg, '[data-preparer-ouvrir]'))) { dit(false, `${nom} : « Préparer mes colis » est là`); return; }
    await pg.waitForSelector('[data-preparer-cle]', { timeout: 8000 }).catch(() => {});
    const c1 = await cleColis(pg);
    // B · 96 / 97
    const prop = await pg.evaluate(() => { const e = document.querySelector('[data-emb-propose]'); return e ? { id: e.getAttribute('data-emb-propose'), m: e.getAttribute('data-emb-propose-modele') } : null; });
    dit(prop && prop.id === 't2' && prop.m === 'nike|air force 1', `${nom} : B1 le format retenu pour ce modèle est PROPOSÉ (« Grand carton »)`, JSON.stringify(prop));
    const choix0 = await pg.evaluate(() => { const e = document.querySelector('[data-emb-choix-colis]'); return e ? e.getAttribute('data-emb-choix') : null; });
    const apres0 = await lire(pg, 'vrm_emballages');
    dit(choix0 === 't1' && JSON.stringify(apres0.choix || {}) === JSON.stringify(avant.choix || {}), `${nom} : B2 rien n'est posé tout seul (le défaut reste choisi, rien d'écrit)`, JSON.stringify({ choix0, c: apres0 && apres0.choix }));
    const alerte = await pg.evaluate(() => { const e = document.querySelector('[data-emb-alerte-prep]'); return e ? { ids: e.getAttribute('data-emb-alerte-prep'), c: getComputedStyle(e).color } : null; });
    dit(alerte && /t3/.test(alerte.ids) && !/rgb\(2(1[5-9]|[2-5]\d), (0|[1-5]\d), (0|[1-5]\d)\)/.test(alerte.c), `${nom} : B3 la fourniture au seuil (Scotch) est dite, en ambre (jamais rouge)`, JSON.stringify(alerte));
    await shot(pg, `${nom}-preparer`);
    await cliquer(pg, '[data-emb-prendre]');
    await pg.waitForTimeout(1200);
    const apres1 = await lire(pg, 'vrm_emballages');
    const choix1 = await pg.evaluate(() => { const e = document.querySelector('[data-emb-choix-colis]'); return e ? e.getAttribute('data-emb-choix') : null; });
    dit(apres1 && apres1.choix && apres1.choix[c1] === 't2' && Object.keys(apres1.choix).length === 1 && choix1 === 't2' && !(await pg.$('[data-emb-propose]')), `${nom} : B4 « Prendre » écrit SON choix pour CE colis seulement`, JSON.stringify({ c1, choix1, ls: apres1 }).slice(0, 400));
    // C · 100 Mains libres
    const bouton = await pg.evaluate(() => { const e = document.querySelector('[data-mains-libres-bouton]'); return e ? Math.round(e.getBoundingClientRect().height) : 0; });
    dit(bouton >= 44, `${nom} : C1 « Mains libres » est là (≥ 44 px)`, String(bouton));
    await cliquer(pg, '[data-mains-libres-bouton]');
    await pg.waitForTimeout(200);
    const pr = await pg.evaluate(() => (document.querySelector('[data-mains-libres-bouton]') || {}).getAttribute && document.querySelector('[data-mains-libres-bouton]').getAttribute('aria-pressed'));
    const p1 = await position(pg);
    await pg.evaluate(() => window.__dire('suivant')); await pg.waitForTimeout(250);
    const p2 = await position(pg);
    await pg.evaluate(() => window.__dire('précédent')); await pg.waitForTimeout(250);
    const p3 = await position(pg);
    dit(pr === 'true' && p1 === '1/9' && p2 === '2/9' && p3 === '1/9', `${nom} : C2 « suivant » puis « précédent » à la voix (1/9 → 2/9 → 1/9)`, JSON.stringify({ pr, p1, p2, p3 }));
    const ship0 = await lire(pg, 'vinted_ship_done');
    await pg.evaluate(() => window.__dire('il fait froid')); await pg.waitForTimeout(250);
    const ligneFroid = await pg.evaluate(() => { const e = document.querySelector('[data-mains-libres-ligne]'); return e ? e.getAttribute('data-mains-libres-ligne') : null; });
    dit((await position(pg)) === '1/9' && ligneFroid === '' && !(await pg.$('[data-preparer-annuler]')), `${nom} : C3 « il fait froid » ne fait rien (dit : pas une commande)`, String(ligneFroid));
    await pg.evaluate(() => window.__dire('fait')); await pg.waitForTimeout(300);
    const annul = !!(await pg.$('[data-preparer-annuler]'));
    const ligneFait = await pg.evaluate(() => { const e = document.querySelector('[data-mains-libres-ligne]'); return e ? e.getAttribute('data-mains-libres-ligne') : null; });
    const shipVite = await lire(pg, 'vinted_ship_done');
    dit(annul && ligneFait === 'fait' && JSON.stringify(shipVite) === JSON.stringify(ship0), `${nom} : C4 « fait » ⇒ confirmation visible et « Annuler », rien d'écrit avant 5 s`, JSON.stringify({ annul, ligneFait }));
    await cliquer(pg, '[data-preparer-annuler]');
    await pg.waitForTimeout(6000);
    const shipAnnule = await lire(pg, 'vinted_ship_done');
    dit(JSON.stringify(shipAnnule) === JSON.stringify(ship0), `${nom} : C5 « Annuler » ⇒ rien d'écrit`);
    await pg.evaluate(() => window.__dire('fait'));
    await shot(pg, `${nom}-voix-fait`);   // (la capture APRÈS « Annuler » : elle peut prendre plus de 5 s sur une machine chargée)
    await pg.waitForFunction((t) => { try { return !!(JSON.parse(localStorage.getItem("vinted_ship_done") || "{}") || {})[t]; } catch (_) { return false; } }, String(c1 || "").replace(/^v:/, ""), { timeout: 20000 }).catch(() => {});
    const ship1 = (await lire(pg, 'vinted_ship_done')) || {};
    const tx1 = String(c1 || '').replace(/^v:/, '');
    const nouveaux = Object.keys(ship1).filter((k) => !(ship0 || {})[k]);
    dit(nouveaux.length === 1 && nouveaux[0] === tx1, `${nom} : C6 « fait » ⇒ \`vinted_ship_done\` de CETTE vente seulement`, JSON.stringify(nouveaux));
    await pg.evaluate(() => window.__dire('stop')); await pg.waitForTimeout(300);
    const pr2 = await pg.evaluate(() => document.querySelector('[data-mains-libres-bouton]') && document.querySelector('[data-mains-libres-bouton]').getAttribute('aria-pressed'));
    dit(pr2 === 'false', `${nom} : C7 « stop » arrête l'écoute`, String(pr2));
    // D · 101 le temps
    const jr = await pg.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('vrm_temps_colis')).map((k) => [k, JSON.parse(localStorage.getItem(k))]));
    const sc = jr.length === 1 && jr[0][1].seances.length === 1 ? jr[0][1].seances[0] : null;
    dit(sc && sc.colis.length === 1 && sc.colis[0].cle === c1 && (sc.colis[0].ms === null || (sc.colis[0].ms >= 15000 && sc.colis[0].ms <= 900000)), `${nom} : D1 la séance est rangée sur l'appareil (CE colis, mesuré ou « pas mesuré »)`, JSON.stringify(jr.map((x) => [x[0], x[1].seances])));
    const msBanc = sc && sc.colis[0] && Number.isFinite(sc.colis[0].ms) ? sc.colis[0].ms : null;
    if (jr.length === 1) {
      const o = MAINTENANT - 2 * J;
      await pg.evaluate(([k, s]) => { const j = JSON.parse(localStorage.getItem(k)); j.seances.unshift(s); localStorage.setItem(k, JSON.stringify(j)); }, [jr[0][0], { ouverture: o, colis: [{ cle: 'v:7000000001', at: o + 240000, ms: 240000 }, { cle: 'v:7000000002', at: o + 420000, ms: 180000 }, { cle: 'v:7000000003', at: o + 3600000, ms: null }] }]);
      await pg.evaluate(() => localStorage.setItem('vrm_stats_ventes', JSON.stringify({ v: 1, at: Date.now(), l: [['vinted', 'compte_a', '7000000001', Date.now() - 2 * 864e5, 90, 40, 5, 'x'], ['vinted', 'compte_a', '7000000002', Date.now() - 2 * 864e5, 60, null, null, 'x']] })));
    }
    await cliquer(pg, '[data-preparer-fermer]'); await pg.waitForTimeout(400);
    await cliquer(pg, '[data-preparer-ouvrir]'); await pg.waitForSelector('[data-preparer-liste]', { timeout: 6000 }).catch(() => {});
    await cliquer(pg, '[data-preparer-liste]'); await pg.waitForSelector('[data-temps-colis]', { timeout: 6000 }).catch(() => {});
    const t = await pg.evaluate(() => { const e = document.querySelector('[data-temps-quand="mois"] [data-temps-par-colis]'); return e ? Object.fromEntries([...e.attributes].filter((a) => a.name.startsWith('data-temps')).map((a) => [a.name.replace('data-temps-', ''), a.value])) : null; });
    const nM = 2 + (msBanc != null ? 1 : 0), tot = 420000 + (msBanc || 0);
    dit(t && t['mesures'] === String(nM) && t['par-colis'] === String(Math.round(tot / nM)) && t['total'] === String(tot) && t['n-gain'] === '1' && t['gain'] === String(Math.round(45 / (4 / 60) * 100) / 100) && t['colis'] === '4',
      `${nom} : D2 le récapitulatif : 3 min 30 par colis sur 2 mesurés, au moins 7 min, gain sur 1 colis au prix connu (675 €/h)`, JSON.stringify(t));
    const replis = await pg.evaluate(() => !!document.querySelector('[data-temps-colis] details'));
    dit(replis, `${nom} : D3 « comment c'est mesuré » est replié (pas un mur de texte)`);
    await pg.evaluate(() => { const f = document.querySelector('[data-preparer]'); if (f) f.scrollTop = f.scrollHeight; });
    await shot(pg, `${nom}-temps`);
    const db = await deborde(pg, '[data-preparer]');
    dit(db.page <= 1 && !db.hors.length, `${nom} : rien ne déborde`, JSON.stringify(db));
    const pt = await petites(pg, '[data-preparer]');
    dit(!pt.length, `${nom} : cibles ≥ 44 px dans Préparer`, JSON.stringify(pt.slice(0, 5)));
    dit(errs.length === 0, `${nom} : aucune erreur d'app`, errs.join(' | ').slice(0, 200));
  } finally { await ctx.close(); }
}

async function sansVoix(b, nom, vue, LIGNES) {
  console.log(`\n— C'. Sans reconnaissance dans le navigateur · ${nom}`);
  const { ctx, pg, errs } = await ouvrir(b, vue, LIGNES, { voix: false });
  try {
    await pg.waitForSelector('[data-preparer-ouvrir]', { timeout: 20000 }).catch(() => {});
    await cliquer(pg, '[data-preparer-ouvrir]'); await pg.waitForSelector('[data-preparer-cle]', { timeout: 8000 }).catch(() => {});
    const dit1 = await pg.evaluate(() => { const e = document.querySelector('[data-mains-libres="absent"] [data-mains-libres-pourquoi]'); return e ? e.textContent.length : 0; });
    const bouton = !!(await pg.$('[data-mains-libres-bouton]'));
    await shot(pg, `${nom}-sans-voix`);
    dit(dit1 > 20 && !bouton, `${nom} : C8 sans reconnaissance : pas de bouton mort, la ligne dit pourquoi`);
    await pg.waitForTimeout(8600);
    const encore = !!(await pg.$('[data-mains-libres]'));
    await cliquer(pg, '[data-preparer-fermer]'); await pg.waitForTimeout(300);
    await cliquer(pg, '[data-preparer-ouvrir]'); await pg.waitForSelector('[data-preparer-cle]', { timeout: 8000 }).catch(() => {});
    const revient = !!(await pg.$('[data-mains-libres]'));
    dit(!encore && !revient, `${nom} : C9 puis elle disparaît, et ne revient pas`, JSON.stringify({ encore, revient }));
    dit(errs.length === 0, `${nom} : aucune erreur d'app`, errs.join(' | ').slice(0, 200));
  } finally { await ctx.close(); }
}

// ── E · 99 la douchette ──────────────────────────────────────────────────────
async function douchette(b, nom, vue, LIGNES) { try { return await douchetteBrut(b, nom, vue, LIGNES); } catch (e) { dit(false, `${nom} : E la douchette s’exécute`, String(e.message).slice(0, 200)); } }
async function douchetteBrut(b, nom, vue, LIGNES) {
  console.log(`\n— E. La douchette · ${nom}`);
  const { ctx, pg, errs } = await ouvrir(b, vue, LIGNES);
  try {
    await pg.waitForSelector('[data-preparer-ouvrir]', { timeout: 20000 }).catch(() => {});
    // Les bordereaux lus (leur n° de suivi est une identité) : « Tout imprimer » n'apparaît qu'avec eux.
    await pg.waitForSelector('button[data-lot-ouvrir="1"]', { timeout: 30000 }).catch(() => {});
    await pg.waitForTimeout(800);
    const etat = () => pg.evaluate(() => document.documentElement.getAttribute('data-douchette'));
    // Une douchette envoie ses touches d'un trait : elles sont posées dans la même tâche (≈ 0 ms d'écart) ;
    // `lent` : une touche toutes les 160 ms (une frappe humaine).
    const bip = async (code, lent = 0) => {
      await pg.evaluate(async ({ c, l }) => {
        try { document.activeElement && document.activeElement.blur && document.activeElement.blur(); } catch (_) {}
        const cible = document.activeElement || document.body;
        const t = (k) => cible.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
        for (const ch of c) { t(ch); if (l) await new Promise((r) => setTimeout(r, l)); }
        t('Enter');
      }, { c: code, l: lent });
      await pg.waitForTimeout(500);
    };
    const cible = V[4];
    await bip(cible.suivi);
    // Bipé avant que les ventes soient prêtes, le code ATTEND (une minute) et la vente s'ouvre dès qu'elles le sont.
    await pg.waitForFunction(() => document.documentElement.getAttribute('data-douchette'), null, { timeout: 15000 }).catch(() => {});
    const e1 = await etat();
    let eclaire = null;
    for (let i = 0; i < 30 && !eclaire; i++) { await pg.waitForTimeout(300); eclaire = await pg.evaluate((tx) => { const e = document.querySelector(`[data-cible~="vente:${tx}"][data-cible-notif]`); return e ? e.getAttribute('data-cible-notif') : null; }, String(cible.tx)); }
    await shot(pg, `${nom}-douchette-trouve`);
    dit(e1 === `trouve:v:${cible.tx}`, `${nom} : E1 le n° de suivi bipé désigne LA vente (9 au même titre)`, String(e1));
    dit(eclaire === 'vente', `${nom} : E2 elle s'ouvre dans Ventes, éclairée (la cible des notifications)`, String(eclaire));
    await pg.goto(`http://localhost:${PORT}/?tab=cat_bord`, { waitUntil: 'domcontentloaded' });
    await pg.waitForSelector('[data-preparer-ouvrir]', { timeout: 20000 }).catch(() => {}); await pg.waitForTimeout(800);
    await bip(String(V[6].tx));
    dit((await etat()) === `trouve:v:${V[6].tx}`, `${nom} : E3 son n° de transaction aussi`, String(await etat()));
    await pg.evaluate(() => document.documentElement.setAttribute('data-douchette', 'avant'));
    const marquesAvant = await pg.evaluate(() => document.querySelectorAll('[data-cible-notif]').length);
    await bip('XA999999999FR');
    await pg.waitForFunction(() => document.documentElement.getAttribute('data-douchette') !== 'avant', null, { timeout: 8000 }).catch(() => {});   // « inconnu » est dit après UNE relecture (2 s)
    const e4 = await etat();
    const toast = await pg.evaluate(() => document.body.innerText.includes('XA999999999FR'));
    await shot(pg, `${nom}-douchette-inconnu`);
    dit(e4 === 'inconnu' && toast && (await pg.evaluate(() => document.querySelectorAll('[data-cible-notif]').length)) === marquesAvant, `${nom} : E4 un code inconnu ⇒ rien d'ouvert, et c'est dit`, String(e4));
    await pg.evaluate(() => document.documentElement.setAttribute('data-douchette', 'avant'));
    await bip(V[2].suivi, 160);
    dit((await etat()) === 'avant', `${nom} : E5 une frappe lente (160 ms) n'est pas une douchette`, String(await etat()));
    const champ = await pg.$('input[type="search"], input[type="text"]');
    if (champ) {
      await champ.focus(); await pg.evaluate((c) => { const el = document.activeElement; const t = (k) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); for (const ch of c) t(ch); t('Enter'); }, V[3].suivi); await pg.waitForTimeout(400);
      dit((await etat()) === 'avant', `${nom} : E6 dans un champ de saisie, rien (la douchette y tape comme un clavier)`, String(await etat()));
    } else dit(false, `${nom} : E6 un champ de saisie pour l'essai`);
    dit(errs.length === 0, `${nom} : aucune erreur d'app`, errs.join(' | ').slice(0, 200));
  } finally { await ctx.close(); }
}

(async () => {
  let b;
  try {
    await new Promise((r) => srv.listen(PORT, r));
    const LIGNES = [
      { id: 'main', data: { vinted_used_numeros: V.map((v) => Number(v.num)), vinted_annonce_numeros: Object.fromEntries(V.map((v) => [`i${v.tx}`, { numero: v.num, title: TITRE, auto: false, numberedAt: ilYaH(200) }])) } },
      { id: 'harvest_111_orders_sold', data: { capturedAt: ilYaH(0.2), payload: { my_orders: V.map((v, i) => ({ transaction_id: v.tx, title: TITRE, size_title: '42', price: { amount: '50', currency_code: 'EUR' }, status: 'Le paiement a été validé', transaction_user_status: 'needs_action', date: ilYaH(20 + i) })) } } },
      ...V.map((v) => ({ id: `harvest_111_txn_${v.tx}`, data: { capturedAt: ilYaH(1), payload: { transaction: { id: v.tx, item_id: `i${v.tx}` } } } })),
      ...await Promise.all(V.map(async (v) => ({ id: 'email_bord_' + v.tx, data: { transaction: String(v.tx), uid: '111', filename: `bordereau-${v.tx}.pdf`, modele: TITRE, article: TITRE, receivedAt: ilYaH(2), pdfB64: await pdfInvente(String(v.tx)), suivi: v.suivi } }))),
    ];
    b = await lancer(PW, { executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    const tel = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
    const ordi = { viewport: { width: 1512, height: 950 } };
    if (VUES.includes('390')) { await preparer(b, '390', tel, LIGNES, false); await sansVoix(b, '390', tel, LIGNES); }
    if (VUES.includes('390-sombre')) await preparer(b, '390-sombre', tel, LIGNES, true);
    if (VUES.includes('1512') || VUES.includes('lot')) await lot(b, '1512', ordi, LIGNES);
    if (VUES.includes('1512') || VUES.includes('classique')) await lotClassique(b, '1512', ordi, LIGNES);
    if (VUES.includes('1512') || VUES.includes('douchette')) await douchette(b, '1512', ordi, LIGNES);
    if (VUES.includes('1512')) await preparer(b, '1512', ordi, LIGNES, false);
    if (VUES.includes('390-lot')) await lot(b, '390', tel, LIGNES);
  } catch (e) { dit(false, 'le banc s’exécute', String(e.stack || e.message || e).slice(0, 300)); }
  finally {
    if (b) await b.close(); srv.close();
    console.log(ko ? `\n❌ colis-plus : ${ko} contrôle(s) non conforme(s), ${ok} conforme(s)` : `\n✅ colis-plus : ${ok} conformes`);
    process.exit(ko ? 1 : 0);
  }
})();
