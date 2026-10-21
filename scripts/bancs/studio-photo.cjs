// ═══════════════════════════════════════════════════════════════════════════
// BANC : LE STUDIO PHOTO (fonction n°33 — cadre guide + détourage local)
//        node scripts/bancs/studio-photo.cjs        (port 4991, aucune fixture)
// ═══════════════════════════════════════════════════════════════════════════
// Données INVENTÉES (il vit dans le dépôt), une FAUSSE CAMÉRA (Chromium
// --use-fake-device-for-media-stream), aux deux tailles (390 tactile, 1512).
// Il exige :
//   1. le studio s'ouvre depuis Annonces → ⋯ Outils, et le CADRE est affiché
//      par-dessus l'image de la caméra ;
//   2. la photo prise est rangée pour la BONNE paire (`studio_photos_42`, et
//      rien sous un autre numéro), au format du cadre (3:4) ;
//   3. « Détourer ici » produit une image AVEC transparence (des pixels
//      transparents ET des pixels opaques), rangée à côté de l'originale ;
//   4. aucune requête vers un service payant (Photoroom, /api/ai, /api/detourage…)
//      et rien de ce moteur n'est chargé avant le clic (ni le modèle, ni le CDN) ;
//   5. l'autre sens : caméra REFUSÉE ⇒ repli fichier + la phrase qui le dit, et
//      la photo choisie est rangée pour sa paire, recadrée au même format.
// Le moteur (onnxruntime-web 1.22.0, MIT) est servi au banc depuis une copie
// locale à la place de cdn.jsdelivr.net (déterminisme) : BANC_ORT_DIR, sinon
// téléchargé une fois dans le dossier temporaire du système (curl).
const path = require('path');
const { cspBanc, bilanCsp } = require('./_vercel.cjs');   // CSP de vercel.json servie et observée (21 oct.)
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), os = require('os');
const { execFileSync } = require('child_process');

const DIST = path.join(__dirname, '..', '..', 'dist');   // ⚠️ jamais un chemin absolu (§6.1)
const PORT = Number(process.env.PORT || 4991);
const ORT_V = '1.22.0';

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };

function dossierOrt() {
  if (process.env.BANC_ORT_DIR && fs.existsSync(path.join(process.env.BANC_ORT_DIR, 'ort.wasm.min.js'))) return process.env.BANC_ORT_DIR;
  const base = path.join(os.tmpdir(), 'vrm-banc-ort-' + ORT_V);
  const dist = path.join(base, 'package', 'dist');
  if (fs.existsSync(path.join(dist, 'ort.wasm.min.js'))) return dist;
  fs.mkdirSync(base, { recursive: true });
  const tgz = path.join(base, 'ort.tgz');
  execFileSync('curl', ['-sSL', '-m', '180', '-o', tgz, `https://registry.npmjs.org/onnxruntime-web/-/onnxruntime-web-${ORT_V}.tgz`]);
  execFileSync('tar', ['-xzf', tgz, '-C', base]);
  return dist;
}

const ilYa = (j) => Math.floor((Date.now() - j * 86400000) / 1000);
const ann = (id, o) => Object.assign({ id, price: { amount: '49.0', currency_code: 'EUR' }, is_closed: false, is_draft: false, photo: null, brand_title: 'Nike', size_title: '42', status: 'Très bon état', view_count: 4, favourite_count: 1, nPhotos: 3, created_at_ts: ilYa(3) }, o);
const ITEMS = [
  ann(9101, { title: 'Nike Air Max 1 obsidian taille 42' }),
  ann(9102, { title: 'Salomon XT-6 blanc taille 40', brand_title: 'Salomon' }),
  ann(9103, { title: 'Adidas Spezial noir taille 38', brand_title: 'Adidas' }),
];
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: new Date().toISOString() }];
const departRows = () => new Map([
  ['main', { vinted_annonce_numeros: { '9101': { numero: '41' }, '9102': { numero: '42' }, '9103': { numero: '43' } } }],
  ['harvest_111_listings', { capturedAt: new Date().toISOString(), payload: { items: ITEMS } }],
]);

const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.wasm': 'application/wasm' };
const srv = http.createServer((q, r) => {
  let f = decodeURIComponent(q.url.split('?')[0]); if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!p.startsWith(DIST) || !fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});

async function preparer(ctx, rows, ort, journal, opts = {}) {
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  pg.on('request', (q) => journal.push({ url: q.url(), m: q.method(), t: Date.now() }));
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', async (route) => {
    const q = route.request();
    const u = decodeURIComponent(metaVersData(q.url()));
    const j = (d, s = 200) => route.fulfill({ status: s, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    if (q.method() === 'POST' && /\/rest\/v1\/app_data/.test(u)) {
      let b = null; try { b = JSON.parse(q.postData() || 'null'); } catch (_) {}
      for (const row of (Array.isArray(b) ? b : [b])) if (row && row.id) rows.set(row.id, row.data);
      return route.fulfill({ status: 201, body: '' });
    }
    if (q.method() !== 'GET') return route.fulfill({ status: 204, body: '' });
    if (opts.studioKO && /id=eq\.studio_photos_/.test(u)) return route.fulfill({ status: 522, contentType: 'text/html', body: '<html>522</html>' });
    const eq = /id=eq\.([^&]*)/.exec(u);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || '';
    const forme = (id, data) => (sel === 'data' || /^id,data|^data,/.test(sel) || !sel) ? { id, data, updated_at: new Date().toISOString() }
      : Object.fromEntries(sel.split(',').map((part) => { const m = /^(?:([^:]+):)?(.+)$/.exec(part); const src = m[2]; const al = m[1] || src.split(/->>|->/).pop();
        if (src === 'id') return [al, id]; let v = data; for (const s of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[s];
        return [al, v == null ? null : (src.includes('->>') && typeof v === 'object' ? JSON.stringify(v) : v)]; }));
    if (eq) return j(rows.has(eq[1]) ? [forme(eq[1], rows.get(eq[1]))] : []);
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j([...rows].filter(([id]) => re.test(id)).map(([id, d]) => forme(id, d))); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.route(`**/cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_V}/dist/**`, (r) => {
    const f = path.join(ort, path.basename(new URL(r.request().url()).pathname));
    if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ status: 200, headers: { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'access-control-allow-origin': '*' }, body: fs.readFileSync(f) });
  });
  return { pg, errs };
}

async function ouvrirStudio(pg) {
  await pg.goto(`http://localhost:${PORT}/?tab=cat_annonces`, { waitUntil: 'domcontentloaded' });
  const outils = pg.locator('button', { hasText: '⋯ Outils' }).first();
  try { await outils.waitFor({ state: 'visible', timeout: 15000 }); } catch (_) { return false; }
  await pg.waitForTimeout(1500);
  for (let essai = 0; essai < 3; essai++) {
    if (await pg.locator('[data-studio]').count()) return true;
    const entree = pg.locator('button', { hasText: 'Studio photo' }).first();
    if (!(await entree.isVisible().catch(() => false))) await outils.click({ timeout: 6000 }).catch(() => {});
    try { await entree.waitFor({ state: 'visible', timeout: 4000 }); } catch (_) { return false; }   // build d'avant : pas d'entrée
    await entree.click({ timeout: 8000 }).catch(() => {});
    try { await pg.waitForSelector('[data-studio]', { timeout: 5000 }); return true; } catch (_) {}
  }
  return false;
}

// Lit une image (data URL) dans la page : dimensions + part de pixels transparents/opaques.
const lireImage = (pg, url) => pg.evaluate(async (src) => {
  const im = new Image(); await new Promise((ok, ko) => { im.onload = ok; im.onerror = ko; im.src = src; });
  const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
  const x = c.getContext('2d'); x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data;
  let tr = 0, op = 0; for (let i = 3; i < d.length; i += 4) { if (d[i] < 32) tr++; else if (d[i] > 223) op++; }
  const n = d.length / 4; return { w: c.width, h: c.height, transparent: tr / n, opaque: op / n };
}, url).catch((e) => ({ erreur: String(e) }));

// Payant : Photoroom et consorts, le mode `detourage` de /api/ai (sa clé), et tout
// POST à /api/ai (l'IA facturée). Le GET nu de /api/ai ne fait que demander si
// l'IA est branchée (gratuit) : l'app le fait déjà au chargement, hors studio.
const PAYANT_HOTE = /photoroom|remove\.bg|clipdrop|anthropic|openai|replicate\.com/i;
const estPayant = (r) => PAYANT_HOTE.test(r.url) || /\/api\/detourage|\/api\/ai\?[^#]*mode=detourage/.test(r.url) || (/\/api\/ai(\?|$)/.test(r.url) && r.m !== 'GET');

(async () => {
  try { await new Promise((ok, ko) => { srv.once('error', ko); srv.listen(PORT, ok); }); }
  catch (e) { console.log(`KO  le port ${PORT} est pris (${e.code}) — relance le banc seul`); process.exit(1); }
  let ort;
  try { ort = dossierOrt(); } catch (e) { console.log('KO  moteur onnxruntime-web introuvable (BANC_ORT_DIR ?) — ' + e.message); srv.close(); process.exit(1); }
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
      args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      console.log(`── ${vp.width} px — caméra accordée`);
      const ctx = await b.newContext({ viewport: vp, permissions: ['camera'], ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
      await cspBanc(ctx, `http://localhost:${PORT}`, 'studio '+vp.width);
      const rows = departRows(), journal = [];
      try {
        const { pg, errs } = await preparer(ctx, rows, ort, journal);
        const ouvert = await ouvrirStudio(pg);
        dit(ouvert, 'le studio s’ouvre depuis Annonces → ⋯ Outils → Studio photo');
        if (!ouvert) { if (process.env.BANC_CAPTURES) await pg.screenshot({ path: path.join(process.env.BANC_CAPTURES, `studio-ko-${vp.width}.png`) }); continue; }
        const avantClic = journal.length;
        dit(!journal.some((r) => /u2netp|onnxruntime/.test(r.url)), 'rien du moteur de détourage n’est chargé à l’ouverture (ni modèle, ni CDN)');
        await pg.locator('[data-studio-paire="42"]').click();
        await pg.locator('[data-studio-ouvrir]').click();
        const video = await pg.waitForFunction(() => { const v = document.querySelector('[data-studio-video]'); return v && v.videoWidth > 0; }, null, { timeout: 10000 }).then(() => true).catch(() => false);
        dit(video, 'la (fausse) caméra envoie son image');
        const cadre = await pg.evaluate(() => {
          const c = document.querySelector('[data-studio-cadre]'), v = document.querySelector('[data-studio-video]');
          if (!c || !v) return null; const a = c.getBoundingClientRect(), z = v.getBoundingClientRect();
          return { visible: a.width > 50 && a.height > 50, dessus: Math.abs(a.left - z.left) < 2 && Math.abs(a.top - z.top) < 2 && Math.abs(a.width - z.width) < 2, ratio: z.width / z.height };
        });
        dit(cadre && cadre.visible && cadre.dessus, 'le CADRE est affiché par-dessus l’image de la caméra', JSON.stringify(cadre));
        dit(cadre && Math.abs(cadre.ratio - 0.75) < 0.02, 'la zone de prise de vue est au format des annonces (3:4)', cadre && cadre.ratio.toFixed(3));
        await pg.locator('[data-studio-declencher]').click();
        await pg.waitForSelector('[data-studio-photo]', { timeout: 8000 }).catch(() => {});
        const ligne = rows.get('studio_photos_42');
        const autres = [...rows.keys()].filter((k) => /^studio_photos_/.test(k) && k !== 'studio_photos_42');
        dit(!!ligne && ligne.numero === '42' && Array.isArray(ligne.photos) && ligne.photos.length === 1 && /^data:image\/jpeg/.test(ligne.photos[0].img),
          'la photo est rangée pour la BONNE paire (studio_photos_42, N°42, un JPEG)', ligne ? `${ligne.photos && ligne.photos.length} photo(s), n° ${ligne.numero}` : '(aucune ligne)');
        dit(autres.length === 0, 'rien n’est rangé sous un autre numéro', autres.join(','));
        if (ligne && ligne.photos && ligne.photos[0]) {
          const im = await lireImage(pg, ligne.photos[0].img);
          dit(im.w > 0 && Math.abs(im.w / im.h - 0.75) < 0.01, 'la photo rangée est recadrée au format du cadre (3:4)', `${im.w}×${im.h}`);
        }
        const msg = await pg.locator('[data-studio-msg]').innerText().catch(() => '');
        dit(/N°42/.test(msg), 'l’écran dit pour quelle paire la photo est rangée', msg);

        // Détourage local.
        console.log(`── ${vp.width} px — détourage local`);
        await pg.locator('[data-studio-detourer]').first().click();
        const det = await pg.waitForSelector('[data-studio-detoure]', { timeout: 120000 }).then(() => true).catch(() => false);
        const msg2 = await pg.locator('[data-studio-msg]').innerText().catch(() => '');
        dit(det, 'la photo détourée apparaît à côté de l’originale', det ? '' : msg2);
        const l2 = rows.get('studio_photos_42');
        const ph = l2 && l2.photos && l2.photos[0];
        dit(!!(ph && ph.img && ph.detoure), 'la détourée est RANGÉE avec la paire, l’originale gardée');
        if (ph && ph.detoure) {
          const im = await lireImage(pg, ph.detoure);
          dit(/^data:image\/(webp|png)/.test(ph.detoure) && im.transparent > 0.01 && im.opaque > 0.01,
            'l’image détourée porte de la TRANSPARENCE (pixels transparents ET opaques)', `transparent ${(im.transparent * 100).toFixed(1)} % · opaque ${(im.opaque * 100).toFixed(1)} %`);
        }
        const payants = journal.filter(estPayant).map((r) => r.m + ' ' + r.url);
        dit(payants.length === 0, 'aucune requête vers un service payant', payants.slice(0, 3).join(' '));
        const externes = [...new Set(journal.slice(avantClic).map((r) => { try { return new URL(r.url).host; } catch (_) { return ''; } }))]
          .filter((h) => h && !/^localhost|^127\./.test(h) && !/supabase\.co$/.test(h));
        dit(externes.every((h) => h === 'cdn.jsdelivr.net'), 'le seul hôte extérieur contacté est le CDN du moteur (cdn.jsdelivr.net)', externes.join(', '));
        dit(journal.some((r) => /\/modeles\/u2netp\.onnx/.test(r.url)), 'le modèle vient de VRM lui-même (/modeles/u2netp.onnx)');
        dit(!errs.length, 'aucune erreur de page', errs[0]);
        const sw = await pg.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
        dit(sw[0] <= sw[1] + 1, 'aucun débordement horizontal', sw.join(' > '));
        if (process.env.BANC_CAPTURES) { fs.mkdirSync(process.env.BANC_CAPTURES, { recursive: true }); await pg.screenshot({ path: path.join(process.env.BANC_CAPTURES, `studio-${vp.width}.png`) }); }
      } finally { await ctx.close(); }

      console.log(`── ${vp.width} px — caméra REFUSÉE`);
      const ctx2 = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
      await cspBanc(ctx2, `http://localhost:${PORT}`, 'studio refusé '+vp.width);
      const rows2 = departRows(), journal2 = [];
      try {
        const { pg, errs } = await preparer(ctx2, rows2, ort, journal2);
        await pg.addInitScript(() => {
          if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('refusée', 'NotAllowedError'));
        });
        const ouvert = await ouvrirStudio(pg);
        dit(ouvert, 'le studio s’ouvre (caméra refusée)');
        if (!ouvert) { await ctx2.close(); continue; }
        await pg.locator('[data-studio-paire="43"]').click();
        await pg.locator('[data-studio-ouvrir]').click();
        const repli = await pg.waitForSelector('[data-studio-repli]', { timeout: 5000 }).then((h) => h.evaluate((e) => ({ r: e.getAttribute('data-studio-repli'), t: e.innerText }))).catch(() => null);
        dit(repli && repli.r === 'refusee' && /refus/i.test(repli.t) && /appareil photo/i.test(repli.t), 'caméra refusée ⇒ la phrase le dit et donne le repli', repli ? repli.t : '(rien)');
        dit(await pg.locator('[data-studio-cadre]').count() === 0, 'pas de cadre promis sans caméra');
        const champ = pg.locator('[data-studio-fichier]');
        dit(await champ.count() === 1 && (await champ.getAttribute('capture')) === 'environment', 'repli : le champ fichier ouvre l’appareil photo (capture)');
        await champ.setInputFiles(path.join(__dirname, '..', '..', 'public', 'icon-512.png'));
        await pg.waitForSelector('[data-studio-photo]', { timeout: 8000 }).catch(() => {});
        const l = rows2.get('studio_photos_43');
        dit(!!l && l.photos && l.photos.length === 1 && l.photos[0].cadre === 'fichier', 'la photo choisie est rangée pour SA paire (studio_photos_43)', l ? JSON.stringify({ n: l.photos.length, c: l.photos[0] && l.photos[0].cadre }) : '(aucune)');
        if (l && l.photos && l.photos[0]) { const im = await lireImage(pg, l.photos[0].img); dit(Math.abs(im.w / im.h - 0.75) < 0.01, 'recadrée au même format que le cadre (3:4)', `${im.w}×${im.h}`); }
        dit(!rows2.has('studio_photos_42'), 'rien sous une autre paire');
        dit(!journal2.some(estPayant), 'aucune requête vers un service payant');
        dit(!errs.length, 'aucune erreur de page', errs[0]);
      } finally { await ctx2.close(); }
    }
    // Lecture KO, écriture OK (le cas qui détruit, §5) : la ligne de la paire
    // ne se lit pas ⇒ on ne range RIEN (sinon elle repartirait avec la seule
    // photo du moment) — et l'écran le dit.
    console.log('── 390 px — la ligne de la paire ne se lit pas (522)');
    const ctx3 = await b.newContext({ viewport: { width: 390, height: 844 }, permissions: ['camera'], isMobile: true, hasTouch: true });
    await cspBanc(ctx3, `http://localhost:${PORT}`, 'studio 522');
    const rows3 = departRows(); rows3.set('studio_photos_42', { numero: '42', photos: [{ id: 'ancienne', img: 'data:image/jpeg;base64,AAAA' }] });
    try {
      const { pg } = await preparer(ctx3, rows3, ort, [], { studioKO: true });
      if (await ouvrirStudio(pg)) {
        await pg.locator('[data-studio-paire="42"]').click();
        const passu = await pg.waitForSelector('[data-studio-passu]', { timeout: 6000 }).then(() => true).catch(() => false);
        dit(passu, 'lecture ratée ⇒ « je ne sais pas encore », jamais « aucune photo »');
        await pg.locator('[data-studio-ouvrir]').click();
        await pg.waitForFunction(() => { const v = document.querySelector('[data-studio-video]'); return v && v.videoWidth > 0; }, null, { timeout: 10000 }).catch(() => {});
        await pg.locator('[data-studio-declencher]').click();
        await pg.waitForTimeout(1500);
        const l = rows3.get('studio_photos_42');
        dit(l && l.photos.length === 1 && l.photos[0].id === 'ancienne', 'lecture ratée ⇒ rien n’est écrit, la photo déjà rangée reste', JSON.stringify(l && l.photos.map((x) => x.id)));
        const m = await pg.locator('[data-studio-msg]').innerText().catch(() => '');
        dit(/n.a pas répondu/.test(m) && /rien rangé/.test(m), 'et l’écran le dit', m);
      } else dit(false, 'le studio s’ouvre (lecture ratée)');
    } finally { await ctx3.close(); }
  } catch (e) { dit(false, 'le banc a levé', String(e && e.stack || e).slice(0, 300)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n${ko} échec(s)` : '\nTout est vert.');
  ko += bilanCsp();
  process.exit(ko ? 1 : 0);
})();
