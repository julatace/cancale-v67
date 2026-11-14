// ═══════════════════════════════════════════════════════════════════════════
// BANC : PHOTOS ET FICHES (14 nov., propositions 102-107)
//        (node scripts/bancs/photos-fiches.cjs — après le build)
//        BANC_PORT=… · BANC_DIST=… (un autre build) · SHOTS=… (les captures, À REGARDER)
//        TOURS=390,1512,1512s (sous-ensemble) · MILLE=300 (paires en plus)
// ═══════════════════════════════════════════════════════════════════════════
// Données INVENTÉES (dépôt public) à la forme des lignes réelles : 50 paires au MÊME titre
// (N°201 à N°250, annonces 7200…7249) présentes chez lui, MILLE paires de plus ; le studio
// (`studio_photos_{N°}`, des images dessinées ici) : N°201 trois photos nettes, N°202 une photo
// FLOUE sans verdict rangé (calculé par le navigateur, dans le worker), N°205 trois photos
// dont une signalée floue ; un certificat PDF pour le N°204 ; six annonces dont la photo est
// bleue (trois) ou rouge (trois).
// Il exige, à 390 px tactile et 1512 px (clair et sombre) :
//   102 · la fiche du N°205 montre ses photos, « Floue ? » sur la bonne ; celle du N°202,
//         jamais mesurée avant, est jugée floue SUR LA PAGE (worker) ; le studio n'en refuse
//         aucune ;
//   103 · Séance photo : la liste = sans photo / < 3 / signalée, dans l'ordre des N° (le N°201,
//         3 photos nettes, n'y est pas ; le N°202 et le N°205 y sont) ; cocher le N°203 le coche
//         LUI (par identité), écrit `vrm_seance_photo` de la ligne `main` ;
//   104 · la loupe « bleu » propose « Photos : bleu » ; la feuille lit les photos (sur
//         l'appareil) et ne montre QUE les trois bleues, chacune avec son N° ; rien n'est écrit ;
//   105 · « Dicter une note » : avec la reconnaissance du navigateur (simulée), le texte
//         s'AJOUTE à la note de la paire (`vrm_notes_paires['n:207']`) ; sans reconnaissance,
//         le bouton dit pourquoi ;
//   106 · le certificat du N°204 se voit (PDF, lu en scalaires) ; ajouter un PDF au N°206
//         écrit `certificat_paire_n_206` (SA ligne), sans jamais `select=data` sur la liste ;
//   107 · fusionner les fiches N°211 et N°213 : aperçu, le N° du carton À CHOISIR (le bouton
//         reste éteint sans), puis l'alias « Même paire que N°213 » ; AUCUN N° changé parmi
//         les 50 + MILLE fiches ;
//   et : cibles ≥ 44 px au doigt, aucun débordement horizontal, aucune erreur de page.
// Rouge sur origin/main (rien de tout ça n'existe), vert après.
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const { dessiner, flouter } = require('../_images-inventees.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os'), zlib = require('zlib');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || (20000 + Math.floor(Math.random() * 20000));
const SHOTS = process.env.SHOTS || '';
const TOURS = (process.env.TOURS || '390,1512,1512s').split(',');
const MILLE = Number(process.env.MILLE || 300);

// ── Un PNG à partir de pixels RGBA (pour servir des « photos » dessinées) ─────
const CRC = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
const crc32 = (b) => { let c = -1; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const bloc = (type, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(type), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); };
const png = ({ px, w, h }) => {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(px.buffer, px.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6; ih[10] = 0; ih[11] = 0; ih[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), bloc('IHDR', ih), bloc('IDAT', zlib.deflateSync(raw)), bloc('IEND', Buffer.alloc(0))]);
};
const dataUrl = (img) => 'data:image/png;base64,' + png(img).toString('base64');
const W = 300, H = 400;
const NETTE = dataUrl(dessiner({ W, H, tige: '#1d4ed8', graine: 1 }));
const NETTE2 = dataUrl(dessiner({ W, H, tige: '#c8102e', col: '#111111', graine: 2 }));
const FLOUE = dataUrl(flouter(dessiner({ W, H, tige: '#15803d', graine: 3 }), 4));
const BLEUE = (g) => dataUrl(dessiner({ W: 160, H: 200, tige: '#1d4ed8', col: '#1d4ed8', semelle: '#1d4ed8', bande: '#1e40af', lacets: '#1d4ed8', fond: ['#e9dfcf', '#d8c8ae'], graine: g }));
const ROUGE = (g) => dataUrl(dessiner({ W: 160, H: 200, tige: '#c8102e', col: '#c8102e', semelle: '#c8102e', bande: '#a00d25', lacets: '#c8102e', fond: ['#e5e7eb', '#d1d5db'], graine: g }));
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');

const M = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const ilYa = (j) => iso(M - j * 86400000);
const TITRE = 'Nike Dunk Low Panda taille 42';
const photo = (id) => `https://images1.vinted.net/t/${id}/f800/photo.jpeg`;
const COULEURS = { 7230: BLEUE(1), 7231: BLEUE(2), 7232: BLEUE(3), 7233: ROUGE(4), 7234: ROUGE(5), 7235: ROUGE(6) };
const FICHES = {};
for (let i = 0; i < 50; i++) FICHES[7200 + i] = { numero: String(201 + i), title: TITRE, numberedAt: '2026-10-22T10:00:00Z', auto: false, accountId: '111', photo: COULEURS[7200 + i] || photo(7200 + i) };
FICHES[7210].buyPrice = '45';                      // N°211 : prix d'achat ; N°213 (7212) : aucun
for (let i = 0; i < MILLE; i++) FICHES[8000 + i] = { numero: String(301 + i), title: `Adidas Samba OG blanc ${36 + (i % 10)} lot ${i}`, numberedAt: '2026-09-01T10:00:00Z', auto: true, accountId: '111', photo: photo(8000 + i) };
const NUMS_AVANT = JSON.stringify(Object.fromEntries(Object.entries(FICHES).map(([id, f]) => [id, f.numero])));
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', updated_at: iso(M) }];
const item = (id, title) => ({ id: Number(id), title, price: { amount: '60.0', currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false, photo: { url: (FICHES[id] && FICHES[id].photo) || photo(id) }, brand_title: 'Nike', size_title: '42', status: 'Très bon état', created_at_ts: Math.floor((M - 20 * 864e5) / 1000) });
const LISTINGS = Array.from({ length: 50 }, (_, i) => item(7200 + i, TITRE)).concat(Array.from({ length: MILLE }, (_, i) => item(8000 + i, FICHES[8000 + i].title)));
const PRESENTS = Object.values(FICHES).map((f) => f.numero);
const ph = (id, img, at, qualite) => ({ id, at, img, cadre: 'fichier', ...(qualite ? { qualite } : {}) });
const OK = { v: 1, juge: 'ok', flou: false, sombre: false, n: 900, l: 200 };
const ROWS0 = () => [
  { id: 'main', data: { vinted_annonce_numeros: JSON.parse(JSON.stringify(FICHES)), vinted_used_numeros: PRESENTS, vinted_nums_physiques: PRESENTS } },
  { id: 'harvest_111_listings', data: { capturedAt: iso(M - 600e3), payload: { items: LISTINGS, pagination: { total_entries: LISTINGS.length } } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: iso(M), nItems: 0, payload: { my_orders: [] } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: iso(M), nItems: 0, payload: { my_orders: [] } } },
  { id: 'studio_photos_201', data: { numero: '201', cle: '201', photos: [ph('a1', NETTE, ilYa(3), OK), ph('a2', NETTE2, ilYa(3), OK), ph('a3', NETTE, ilYa(3), OK)] } },
  { id: 'studio_photos_202', data: { numero: '202', cle: '202', photos: [ph('b1', FLOUE, ilYa(2))] } },
  { id: 'studio_photos_205', data: { numero: '205', cle: '205', photos: [ph('c1', NETTE, ilYa(1), OK), ph('c2', FLOUE, ilYa(1), { v: 1, juge: 'flou', flou: true, sombre: false, n: 2, l: 205 }), ph('c3', NETTE2, ilYa(1), OK)] } },
  { id: 'certificat_paire_n_204', data: { b64: 'data:application/pdf;base64,' + PDF.toString('base64'), type: 'pdf', nom: 'legit-check-204.pdf', taille: PDF.length, numero: '204', at: ilYa(1) } },
];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d !== undefined && !c ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 400) : '')); };
let PAGE = null, ERRS = null;
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).replace(/\s+/g, ' ').slice(0, 300) + (ERRS && ERRS.length ? ' · erreurs : ' + ERRS.join(' | ').slice(0, 300) : '')); if (PAGE) { await capture(PAGE, 'echec-' + nom.replace(/[^a-z0-9]+/gi, '-').slice(0, 40)); try { await PAGE.context().close(); } catch (_) {} } } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.onnx': 'application/octet-stream' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!p.startsWith(DIST) || !fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul (BANC_PORT)'); process.exit(1); });
srv.listen(PORT);
const chemin = (row, src) => { let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg.replace(/"/g, '')]; return v; };
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop().replace(/"/g, '');
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    const v = chemin(row, src);
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v === 'object' ? JSON.stringify(v) : /->>/.test(src) ? String(v) : v);
  }
  return out;
};

async function preparer(b, vp, { sombre = false, sansVoix = false, voix = '' } = {}) {
  const tel = vp.width < 600;
  const ctx = await b.newContext({ viewport: vp, timezoneId: 'Europe/Paris', locale: 'fr-FR', ...(tel ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); PAGE = pg; ERRS = errs;
  const rows = ROWS0();
  const ecrits = [], lourdes = [];
  await pg.addInitScript(({ s, n, p, sv, vx }) => { try {
    localStorage.setItem('vrm_acces_direct', '1');
    localStorage.setItem('vinted_dark', JSON.stringify(s)); localStorage.setItem('vrm_apparence', JSON.stringify(s ? 'sombre' : 'clair'));
    localStorage.setItem('vinted_annonce_numeros', JSON.stringify(n)); localStorage.setItem('vinted_nums_physiques', JSON.stringify(p));
    localStorage.setItem('vrm_langue', JSON.stringify('fr'));
  } catch (_) {}
  // La reconnaissance du NAVIGATEUR, simulée (le banc n'a pas de micro) : elle « entend » `vx`.
  if (sv) { try { delete window.SpeechRecognition; delete window.webkitSpeechRecognition; } catch (_) {} window.SpeechRecognition = undefined; window.webkitSpeechRecognition = undefined; }
  else {
    window.SpeechRecognition = window.webkitSpeechRecognition = function FausseReco() { const r = this; r.lang = ''; window.__recoLang = () => r.lang;
      r.start = () => { setTimeout(() => { r.onresult && r.onresult({ results: [Object.assign([{ transcript: vx }], { isFinal: true })] }); setTimeout(() => r.onend && r.onend(), 30); }, 60); };
      r.stop = () => { r.onend && r.onend(); }; r.abort = () => {}; };
  } }, { s: sombre, n: FICHES, p: PRESENTS, sv: sansVoix, vx: voix || 'boîte abîmée' });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) || /vinted\.net/i.test(r.request().url()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') {
      let corps = null; try { corps = JSON.parse(req.postData() || 'null'); } catch (_) {}
      if (/\/rest\/v1\/app_data/.test(u) && req.method() === 'POST') {
        for (const l of (Array.isArray(corps) ? corps : [corps])) { if (!l || !l.id) continue; ecrits.push({ id: l.id, data: l.data }); const ex = rows.find((r) => r.id === l.id); if (ex) ex.data = l.data; else rows.push({ id: l.id, data: l.data }); }
      }
      if (/\/rest\/v1\/app_data/.test(u) && req.method() === 'PATCH') {
        const id = (/[?&]id=eq\.([^&]*)/.exec(u) || [])[1];
        const ex = id && rows.find((r) => r.id === id);
        if (ex && corps && corps.data !== undefined) { ecrits.push({ id, data: corps.data }); ex.data = corps.data; return j([{ id }]); }
      }
      return j([]);
    }
    if (/select=owner&limit=1/.test(u)) return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    // §4.4 : jamais `select=data` sur une LISTE de certificats ou de photos du studio.
    if ((/id=like\.(studio_photos|certificat_paire)/.test(u) || /id=in\.\(certificat_paire/.test(u)) && (!sel || /(^|,)data(,|$)/.test(sel) || /b64|->>img/.test(sel))) lourdes.push(u);
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data$/.test(sel) && sel !== 'data') ? projette(r, sel) : ({ ...r, updated_at: (r.data && r.data.capturedAt) || iso(M), cap: r.data && r.data.capturedAt });
    const inn = /[?&]id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(',').map((x) => x.replace(/"/g, '')); return j(rows.filter((r) => ids.includes(r.id)).map(forme)); }
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const lk = /[?&]id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); let l = rows.filter((r) => re.test(r.id)); const rg = req.headers()['range']; if (rg) { const mm = /(\d+)-(\d+)/.exec(rg); if (mm) l = l.slice(+mm[1], +mm[2] + 1); } return j(l.map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  const dernierMain = () => { const m = ecrits.filter((e) => e.id === 'main'); return m.length ? m[m.length - 1].data || {} : null; };
  return { ctx, pg, errs, ecrits, lourdes, rows, dernierMain };
}
const deborde = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const capture = async (pg, nom) => { if (!SHOTS) return; try { fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, 'pf-' + nom + '.png'), fullPage: false }); } catch (_) {} };
// Les cibles au doigt (≥ 44 px) de l'atelier et des feuilles.
const petites = (pg, sel) => pg.evaluate((s) => [...document.querySelectorAll(s)].filter((e) => e.getClientRects().length).map((e) => { const r = e.getBoundingClientRect(); return { t: (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 30), h: Math.round(r.height), w: Math.round(r.width) }; }).filter((x) => x.h < 44 || x.w < 44), sel);
const ouvrirFiche = async (pg, n) => {
  // L'app peut ne pas écouter encore (premier chargement sur une machine chargée) : on redemande.
  for (let k = 0; k < 15; k++) {
    await pg.evaluate((x) => window.dispatchEvent(new CustomEvent('vrm:fiche-paire', { detail: x })), n);
    if (await pg.waitForSelector(`[data-fiche-paire="${n}"]`, { timeout: 4000 }).then(() => true, () => false)) break;
  }
  await pg.waitForSelector(`[data-fiche-paire="${n}"]`, { timeout: 15000 });
  await pg.waitForSelector(`[data-atelier-paire="${n}"]`, { timeout: 15000 });
};

async function main() {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const tour of TOURS) {
      const vp = tour.startsWith('390') ? { width: 390, height: 844 } : { width: 1512, height: 950 };
      const sombre = tour.endsWith('s');
      const T = (vp.width < 600 ? '📱' : '🖥️') + (sombre ? '🌙' : '');
      const nomC = `${vp.width}${sombre ? '-sombre' : ''}`;
      // Une feuille qui finit d'entrer peut ne pas être « stable » pour Playwright sur la machine de banc chargée :
      // on retente le même geste (un vrai clic à l'endroit de l'élément) sans l'attente de stabilité.
      const tap = async (pg, loc) => { const l = typeof loc === 'string' ? pg.locator(loc).first() : loc;
        try { await l.scrollIntoViewIfNeeded({ timeout: 6000 }); if (vp.width < 600) await l.tap({ timeout: 6000 }); else await l.click({ timeout: 6000 }); }
        catch (_) { if (vp.width < 600) await l.tap({ force: true }); else await l.click({ force: true }); } };

      // ── 102 · 105 · 106 : la fiche du N°205, puis du N°202 ──────────────────
      await essaie(`${T} fiche : photos, avis, dictée, certificat`, async () => {
        const { ctx, pg, errs, ecrits, lourdes, dernierMain } = await preparer(b, vp, { sombre, voix: 'boîte abîmée sur un côté' });
        await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        await pg.waitForTimeout(2500);
        await ouvrirFiche(pg, '205');
        await pg.waitForSelector('[data-atelier-photos="3"]', { timeout: 10000 });
        await pg.waitForFunction(() => document.querySelectorAll('[data-atelier-photo] [data-avis-photo]').length === 3 && document.querySelector('[data-atelier-photo] [data-avis-photo="flou"]'), null, { timeout: 15000 }).catch(() => {});
        const avis = await pg.$$eval('[data-atelier-photo] [data-avis-photo]', (l) => l.map((x) => x.getAttribute('data-avis-photo')));
        dit(avis.filter((x) => x === 'flou').length === 1 && avis.length === 3, `${T} 102 · N°205 : trois photos, « Floue ? » sur UNE (la signalée)`, JSON.stringify(avis));
        dit(await pg.waitForSelector('[data-atelier-douteuses="1"]', { timeout: 5000 }).then(() => true, () => false), `${T} 102 · l’en-tête dit « 1 à revoir »`);
        await pg.locator('[data-atelier-photos]').scrollIntoViewIfNeeded();
        await capture(pg, `fiche-photos-${nomC}`);
        // 105 · dicter
        const dicter = pg.locator('[data-atelier-dicter="205"]');
        await dicter.waitFor({ timeout: 8000 });
        dit((await pg.locator('[data-atelier-dictee="pret"]').count()) === 1, `${T} 105 · « Dicter une note » est prêt (reconnaissance du navigateur)`);
        // 106 · certificat absent au N°205 : le bouton d'ajout
        dit((await pg.locator('[data-atelier-certificat="aucun"]').count()) === 1 && (await pg.locator('[data-atelier-certificat-ajouter="n_205"]').count()) === 1, `${T} 106 · N°205 : aucun certificat, « Ajouter un certificat »`);
        const p44 = await petites(pg, '[data-atelier-paire] button, [data-atelier-dicter]');
        dit(vp.width >= 600 || p44.length === 0, `${T} cibles de l’atelier ≥ 44 px au doigt`, p44);
        dit((await deborde(pg)) <= 1, `${T} fiche : aucun débordement horizontal`);
        // Fermer, ouvrir le N°207 (aucune note) et dicter.
        await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
        await ouvrirFiche(pg, '207');
        await tap(pg, '[data-atelier-dicter="207"]');
        await pg.waitForSelector('[data-fiche-paire="207"] [data-note-texte]', { timeout: 8000 });
        const nt = await pg.locator('[data-fiche-paire="207"] [data-note-texte]').innerText();
        dit(/Boîte abîmée sur un côté/.test(nt), `${T} 105 · la dictée devient la note du N°207`, nt);
        dit(await pg.evaluate(() => (window.__recoLang ? window.__recoLang() : '')) === 'fr-FR', `${T} 105 · la reconnaissance écoute dans la langue de VRM (fr-FR)`);
        await pg.waitForTimeout(6000);
        const m = dernierMain() || {};
        dit(m.vrm_notes_paires && m.vrm_notes_paires['n:207'] && /Boîte abîmée/.test(m.vrm_notes_paires['n:207'].t), `${T} 105 · écrite sous vrm_notes_paires['n:207'] de la ligne main (par le geste annulable)`, JSON.stringify(m.vrm_notes_paires || null));
        // Une deuxième dictée s'AJOUTE.
        await tap(pg, '[data-atelier-dicter="207"]');
        await pg.waitForFunction(() => { const e = document.querySelector('[data-fiche-paire="207"] [data-note-texte]'); return e && (e.textContent.match(/Boîte abîmée/g) || []).length === 2; }, null, { timeout: 8000 });
        dit(true, `${T} 105 · une seconde dictée s’AJOUTE à la note (jamais n’écrase)`);
        await capture(pg, `fiche-dictee-${nomC}`);
        // 106 · le N°204 : certificat rangé, lu en scalaires ; ajouter au N°206
        await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
        await ouvrirFiche(pg, '204');
        await pg.waitForSelector('[data-atelier-certificat="pdf"]', { timeout: 10000 });
        dit((await pg.locator('[data-atelier-certificat-envoyer]').count()) === 1 && (await pg.locator('[data-atelier-certificat-voir]').count()) === 1, `${T} 106 · N°204 : le certificat est là, « Voir » et « Envoyer »`);
        await pg.locator('[data-atelier-certificat]').scrollIntoViewIfNeeded();
        await capture(pg, `fiche-certificat-${nomC}`);
        await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
        await ouvrirFiche(pg, '206');
        await pg.waitForSelector('[data-atelier-certificat="aucun"]', { timeout: 10000 });
        await pg.setInputFiles('[data-atelier-certificat-fichier]', { name: 'certificat.pdf', mimeType: 'application/pdf', buffer: PDF });
        await pg.waitForSelector('[data-atelier-certificat="pdf"]', { timeout: 10000 });
        const ec = ecrits.find((e) => e.id === 'certificat_paire_n_206');
        dit(!!ec && ec.data && /^data:application\/pdf;base64,JVBER/.test(ec.data.b64) && ec.data.numero === '206', `${T} 106 · ajouter un PDF au N°206 écrit SA ligne certificat_paire_n_206`, JSON.stringify(ec ? { ...ec.data, b64: String(ec.data.b64).slice(0, 40) } : null));
        dit(lourdes.length === 0, `${T} 106 · aucune liste lue avec select=data ni contenu (§4.4)`, lourdes.join(' | '));
        // 102 · N°202 : une photo sans verdict rangé, jugée floue sur la page (worker)
        await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
        await ouvrirFiche(pg, '202');
        await pg.waitForSelector('[data-atelier-photo] [data-avis-photo="flou"]', { timeout: 15000 });
        dit(true, `${T} 102 · N°202 : la photo jamais mesurée est jugée « floue » sur l’appareil`);
        dit(errs.length === 0, `${T} fiche : aucune erreur de page`, errs.join(' | ').slice(0, 300));
        await ctx.close();
      });

      // ── 105 · sans reconnaissance ───────────────────────────────────────────
      await essaie(`${T} dictée sans reconnaissance`, async () => {
        const { ctx, pg, errs } = await preparer(b, vp, { sombre, sansVoix: true });
        await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        await pg.waitForTimeout(2500);
        await ouvrirFiche(pg, '208');
        await pg.waitForSelector('[data-atelier-dictee="navigateur"]', { timeout: 8000 });
        const r = await pg.locator('[data-atelier-dictee-raison="navigateur"]').innerText();
        dit(/navigateur/i.test(r), `${T} 105 · sans reconnaissance : le bouton reste et dit pourquoi`, r);
        dit(errs.length === 0, `${T} sans reconnaissance : aucune erreur de page`, errs.join(' | ').slice(0, 300));
        await ctx.close();
      });

      // ── 107 · fusion ────────────────────────────────────────────────────────
      await essaie(`${T} fusion de deux fiches`, async () => {
        const { ctx, pg, errs, dernierMain } = await preparer(b, vp, { sombre });
        await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        await pg.waitForTimeout(2500);
        await ouvrirFiche(pg, '211');
        await tap(pg, '[data-atelier-fusionner="211"]');
        await pg.waitForSelector('[data-fusion-feuille="choix"]', { timeout: 8000 });
        await pg.fill('[data-fusion-chercher]', '213');
        await tap(pg, '[data-fusion-candidat="7212"]');
        await pg.waitForSelector('[data-fusion-feuille="apercu"] [data-fusion-carton-choix]', { timeout: 8000 });
        dit(await pg.locator('[data-fusion-valider]').isDisabled(), `${T} 107 · deux N° différents : « Fusionner » éteint tant que le N° du carton n’est pas choisi`);
        dit((await pg.locator('[data-fusion-champ="buyPrice"][data-fusion-action="copier"]').count()) === 1, `${T} 107 · l’aperçu dit ce qui sera gardé (prix d’achat recopié sur le N°213)`);
        await capture(pg, `fusion-apercu-${nomC}`);
        await tap(pg, '[data-fusion-carton="211"]');
        await tap(pg, '[data-fusion-valider]');
        await pg.waitForSelector('[data-atelier-alias="213"][data-atelier-carton="211"]', { timeout: 8000 });
        dit(true, `${T} 107 · après la fusion : « Même paire que N°213 », le carton porte le N°211`);
        await pg.waitForTimeout(6000);
        const m = dernierMain() || {};
        const reg = m.vrm_fusions_fiches || {};
        const rec = Object.values(reg)[0];
        dit(rec && rec.carton === '211' && rec.ids.sort().join() === '7210,7212', `${T} 107 · la fusion est rangée dans vrm_fusions_fiches (ligne main), carton = SON choix`, JSON.stringify(reg));
        const fiches = m.vinted_annonce_numeros || JSON.parse(await pg.evaluate(() => localStorage.getItem('vinted_annonce_numeros')));
        const apres = JSON.stringify(Object.fromEntries(Object.entries(fiches).map(([id, f]) => [id, f.numero])));
        dit(apres === NUMS_AVANT, `${T} 107 · AUCUN N° changé parmi les ${Object.keys(FICHES).length} fiches`);
        dit(fiches['7212'] && fiches['7212'].buyPrice === '45' && fiches['7210'].buyPrice === '45', `${T} 107 · le prix d’achat manquant du N°213 est complété (rien d’écrasé)`);
        await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
        await ouvrirFiche(pg, '213');
        await pg.waitForSelector('[data-atelier-alias="211"]', { timeout: 8000 });
        dit((await pg.locator('[data-atelier-defaire]').count()) === 1, `${T} 107 · le N°213 nomme le N°211, et « Défaire la fusion » (30 jours) est là`);
        await pg.locator('[data-atelier-fusion]').scrollIntoViewIfNeeded();
        await capture(pg, `fusion-alias-${nomC}`);
        dit(errs.length === 0, `${T} fusion : aucune erreur de page`, errs.join(' | ').slice(0, 300));
        await ctx.close();
      });

      // ── 103 · séance photo ──────────────────────────────────────────────────
      await essaie(`${T} séance photo`, async () => {
        const { ctx, pg, errs, dernierMain, lourdes } = await preparer(b, vp, { sombre });
        await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        await pg.waitForTimeout(2500);
        for (let k = 0; k < 15; k++) { await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:atelier', { detail: { quoi: 'seance' } }))); if (await pg.waitForSelector('[data-seance-photo]', { timeout: 2000 }).then(() => true, () => false)) break; }
        await pg.waitForSelector('[data-seance-photo="depart"] [data-seance-commencer]:not([disabled])', { timeout: 15000 });
        await capture(pg, `seance-depart-${nomC}`);
        await tap(pg, '[data-seance-commencer]');
        await pg.waitForSelector('[data-seance-photo="en-cours"] [data-seance-ligne]', { timeout: 10000 });
        const lignes = await pg.$$eval('[data-seance-ligne]', (l) => l.map((x) => [x.getAttribute('data-seance-ligne'), x.getAttribute('data-seance-raison')]));
        const cles = lignes.map((x) => x[0]);
        const r = Object.fromEntries(lignes);
        dit(!cles.includes('201') && r['202'] === 'peu' && r['205'] === 'douteuse' && r['203'] === 'aucune', `${T} 103 · N°201 (3 nettes) dehors ; N°202 « 1 sur 3 » ; N°205 « floue » ; N°203 « aucune »`, JSON.stringify(lignes.slice(0, 6)));
        dit(cles.slice(0, 4).join() === '202,203,204,205' && cles.length === 49 + MILLE, `${T} 103 · dans l’ordre des N°, toutes les autres paires présentes (${cles.length})`, cles.slice(0, 6).join());
        await tap(pg, '[data-seance-cocher="203"]');
        await pg.waitForSelector('[data-seance-ligne="203"][data-seance-coche="1"]', { timeout: 5000 });
        const coches = await pg.$$eval('[data-seance-coche="1"]', (l) => l.map((x) => x.getAttribute('data-seance-ligne')));
        dit(coches.join() === '203', `${T} 103 · cocher le N°203 coche LUI seul (par identité)`, coches.join());
        dit(await pg.locator('[data-seance-compte="1/' + (49 + MILLE) + '"]').count() === 1, `${T} 103 · « 1 sur ${49 + MILLE} »`);
        await capture(pg, `seance-${nomC}`);
        await pg.waitForTimeout(6000);
        const m = dernierMain() || {};
        dit(m.vrm_seance_photo && m.vrm_seance_photo['c:203'] && m.vrm_seance_photo.seance && m.vrm_seance_photo.seance.cles.length === 49 + MILLE, `${T} 103 · la séance et sa coche sont dans vrm_seance_photo (ligne main)`, JSON.stringify(m.vrm_seance_photo ? Object.keys(m.vrm_seance_photo) : null));
        dit(lourdes.length === 0, `${T} 103 · les photos du studio sont lues PROJETÉES (jamais les images)`, lourdes.join(' | '));
        const p44 = await petites(pg, '[data-seance-photo] button');
        dit(vp.width >= 600 || p44.length === 0, `${T} 103 · cibles ≥ 44 px au doigt`, p44.slice(0, 4));
        // Toucher une rangée ouvre le studio sur CETTE paire.
        await tap(pg, '[data-seance-photographier="204"]');
        await pg.waitForSelector('[data-studio]', { timeout: 10000 });
        const titre = await pg.locator('[data-studio]').innerText();
        dit(/N°204/.test(titre) && (await pg.locator('[data-studio-choix]').count()) === 0, `${T} 103 · toucher la rangée ouvre le studio sur le N°204`);
        dit(errs.length === 0, `${T} séance : aucune erreur de page`, errs.join(' | ').slice(0, 300));
        await ctx.close();
      });

      // ── 104 · couleur ───────────────────────────────────────────────────────
      await essaie(`${T} recherche par couleur`, async () => {
        const { ctx, pg, errs, ecrits } = await preparer(b, vp, { sombre });
        await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        await pg.waitForTimeout(2500);
        for (let k = 0; k < 15; k++) { await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:fiche-article', { detail: 'bleu' }))); if (await pg.waitForSelector('[data-recherche-couleur="bleu"]', { timeout: 2000 }).then(() => true, () => false)) break; }
        await pg.waitForSelector('[data-recherche-couleur="bleu"]', { timeout: 5000 });
        dit(true, `${T} 104 · la loupe « bleu » propose « Photos : bleu »`);
        await capture(pg, `loupe-bleu-${nomC}`);
        const avant = ecrits.length;
        await tap(pg, 'button[data-recherche-couleur="bleu"]');
        await pg.waitForSelector('[data-couleur-lire]', { timeout: 15000 });
        await tap(pg, '[data-couleur-lire]');
        await pg.waitForSelector('[data-couleur-a-lire]', { state: 'detached', timeout: 120000 });
        await pg.waitForSelector('[data-couleur-photo]', { timeout: 10000 });
        const bleues = await pg.$$eval('[data-couleur-photo]', (l) => l.map((x) => x.getAttribute('data-couleur-num')).sort());
        dit(bleues.join() === '231,232,233', `${T} 104 · « bleu » : les trois paires bleues, chacune son N° (jamais les rouges)`, bleues.join());
        await capture(pg, `couleur-bleu-${nomC}`);
        await tap(pg, '[data-couleur-famille="rouge"]');
        await pg.waitForFunction(() => [...document.querySelectorAll('[data-couleur-photo]')].map((x) => x.getAttribute('data-couleur-num')).sort().join() === '234,235,236', null, { timeout: 5000 });
        dit(true, `${T} 104 · « rouge » : les trois rouges`);
        // L'app écrit ses lignes habituelles en fond (synchro `main`, diagnostic des photos) : la recherche, elle,
        // n'écrit aucune couleur ni aucun lien (aucune ligne, aucune clé « couleur », aucune fiche changée).
        const apresC = ecrits.slice(avant);
        const fichesEcrites = apresC.filter((e) => e.id === 'main' && e.data && e.data.vinted_annonce_numeros).map((e) => JSON.stringify(Object.fromEntries(Object.entries(e.data.vinted_annonce_numeros).map(([id, f]) => [id, [f.numero, f.buyPrice || null]]))));
        const ref = JSON.stringify(Object.fromEntries(Object.entries(FICHES).map(([id, f]) => [id, [f.numero, f.buyPrice || null]])));
        dit(apresC.every((e) => /^(main|diag_photos|restore_\d+)$/.test(e.id)) && !apresC.some((e) => /"part":|vrm_couleurs|couleurs_photos/.test(JSON.stringify(e.data || {}))) && fichesEcrites.every((x) => x === ref), `${T} 104 · une recherche : aucune couleur ni aucun lien écrit, aucune fiche changée`, JSON.stringify(apresC.map((e) => e.id)));
        await tap(pg, '[data-couleur-photo][data-couleur-num="234"]');
        await pg.waitForSelector('[data-fiche-paire="234"]', { timeout: 10000 });
        dit(true, `${T} 104 · SON toucher ouvre la fiche du N°234`);
        dit((await deborde(pg)) <= 1, `${T} 104 · aucun débordement horizontal`);
        dit(errs.length === 0, `${T} couleur : aucune erreur de page`, errs.join(' | ').slice(0, 300));
        await ctx.close();
      });
    }
  } finally {
    if (b) await b.close().catch(() => {});
    srv.close();
  }
  console.log(ko ? `\n❌ banc photos-fiches : ${ko} rouge(s)` : '\n✅ banc photos-fiches : tout est vert');
  process.exit(ko ? 1 : 0);
}
main().catch((e) => { console.log('KO  exception : ' + (e && e.stack || e)); process.exit(1); });
