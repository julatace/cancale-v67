// ⚠️⚠️ BANC — LE TAMPON LIBRE, DE BOUT EN BOUT, DANS L'APP CONSTRUITE (3 nov.).
//
// Julien, 3 nov. 18 h 59 : « il faut améliorer le positionnement du tampon sur
// le bordereau : on doit pouvoir être LIBRE de le mettre où on veut, MÊME SUR
// DU TEXTE, si l'espace blanc choisi par VRM n'est pas au bon endroit ».
//
// L'app de `dist/` (npm run build), une vente INVENTÉE (le dépôt est public),
// un bordereau FABRIQUÉ ici (A4 Mondial Relay : code-barres, adresse, texte sur
// les deux tiers du haut, le bas blanc). pdf.js est servi depuis le dépôt (la
// version du réseau est injoignable ici). À 390 px tactile (gestes envoyés en
// vrais points de contact, CDP) et à 1512 px souris :
//   1. « Imprimer » ouvre l'aperçu (forme jamais vue) : la page rendue, le
//      tampon à la place choisie par VRM (dans le blanc), « Toujours ici » coché ;
//   2. glissé sur le code-barres ⇒ la puce « recouvre le code-barres », rien
//      n'est bloqué ; glissé SUR DU TEXTE ⇒ la puce s'en va ;
//   3. agrandi (poignée à la souris, pincement au doigt), jamais sous la
//      taille lisible ;
//   4. « Imprimer » ⇒ le PDF de la visionneuse porte le titre À CETTE PLACE
//      (pdf.js, ±2,5 pt), à la taille choisie, sur une seule page (pas de fiche) ;
//   5. la place est mémorisée pour la forme (`vrm_tampon_positions`) : le clic
//      suivant n'ouvre PAS l'aperçu et imprime au même endroit ;
//   6. « Déplacer le tampon » n'existe que dans la modale du résultat (iPhone) —
//      non jugé ici ; aucune erreur d'app, aucun débordement.
// Captures : CAPTURES=dossier (aperçu au téléphone et à l'ordinateur).
const path = require('path'), fs = require('fs'), http = require('http'), os = require('os');
const RACINE = path.join(__dirname, '..', '..');
const NM = path.join(RACINE, 'node_modules');
const { chromium } = require(path.join(NM, 'playwright'));
const PL = require(path.join(NM, 'pdf-lib'));
const { metaVersData } = require('./_meta.cjs');
const { monterTiroirs } = require('./_tiroirs.cjs');
const DIST = path.join(RACINE, 'dist');
const PORT = Number(process.env.BANC_PORT) || 4351;
const CAPT = process.env.CAPTURES || os.tmpdir();
const CHROME = process.env.VRM_CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };

// pdf.js du dépôt (ESM) remis en script classique `window.pdfjsLib`, comme le CDN.
let esbuild; try { esbuild = require(path.join(NM, 'esbuild')); } catch (_) { esbuild = require('/home/claude/cancale-v67/node_modules/esbuild'); }
const PDFJS = esbuild.buildSync({ entryPoints: [path.join(NM, 'pdfjs-dist', 'build', 'pdf.min.mjs')], bundle: true, format: 'iife', globalName: 'pdfjsLib', write: false, logLevel: 'error' }).outputFiles[0].text
  // pdf.js 3.11 (celui de l'app) a `doc.destroy()` ; la version du dépôt ne l'a plus : rendu par la tâche.
  + ';(function(){var g=pdfjsLib.getDocument,L=Object.assign({},pdfjsLib);L.getDocument=function(o){var t=g(o);return{promise:t.promise.then(function(d){if(typeof d.destroy!=="function")d.destroy=function(){return t.destroy();};return d;}),destroy:function(){return t.destroy();}};};window.pdfjsLib=L;})();';
const WORKER = fs.readFileSync(path.join(NM, 'pdfjs-dist', 'build', 'pdf.worker.min.mjs'));

const auj = new Date();
const jour = (d) => new Date(auj.getFullYear(), auj.getMonth(), d, 12).toISOString();
const J = Math.min(auj.getDate(), 28);
const TITRE = 'Nike Air Max 1 olive taille 42';
const VENTES = [{ transaction_id: 9001, title: TITRE, price: { amount: '80', currency_code: 'EUR' }, status: 'Le paiement a été validé', date: jour(Math.max(1, J - 1)) }];
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];

// Le bordereau fabriqué : A4 portrait, étiquette en haut (code-barres, n° de
// suivi, adresse), du texte jusqu'au tiers bas, le bas blanc.
const ZONES = {};   // en points, page affichée (origine en haut à gauche)
async function fabriquer() {
  const d = await PL.PDFDocument.create(), p = d.addPage([595.28, 841.89]);
  const f = await d.embedFont(PL.StandardFonts.Helvetica), fb = await d.embedFont(PL.StandardFonts.HelveticaBold), N = PL.rgb(0, 0, 0);
  let g = 11; const a = () => { g = (g * 16807) % 2147483647; return g / 2147483647; };
  p.drawText('Mondial Relay', { x: 40, y: 800, size: 14, font: fb, color: N });
  for (let cx = 40; cx < 330;) { const b = 0.8 + a() * 2.2; p.drawRectangle({ x: cx, y: 700, width: b, height: 70, color: N }); cx += b + 0.8 + a() * 2; }
  ZONES.code = { x: 40, y: 841.89 - 770, w: 290, h: 70 };
  p.drawText('XW 1234 5678 9FR', { x: 40, y: 680, size: 12, font: fb, color: N });
  ['Destinataire', 'Jeanne Exemple', '12 rue Imaginaire', '75000 PARIS'].forEach((l, i) => p.drawText(l, { x: 360, y: 760 - i * 13, size: 11, font: f, color: N }));
  const t = 'Poids 0,5 kg · Agence 24R · Tournée 12 · Réf 000123 · Colis 1/1 · ';
  for (let y = 660; y >= 300; y -= 9) { let s = t; while (f.widthOfTextAtSize(s + t, 7) < 515) s += t; p.drawText(s, { x: 40, y, size: 7, font: f, color: N }); }
  ZONES.texte = { x: 40, y: 841.89 - 660, w: 515, h: 360 };
  return Buffer.from(await d.save()).toString('base64');
}

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — BANC_PORT=…'); process.exit(1); });
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : v;
  }
  return out;
};
async function ouvrirVente(pg, tx) {
  const sel = `[data-bouton-bord][data-tx="${tx}"]`;
  const ouverte = await pg.evaluate((sel) => { const b = document.querySelector(sel); if (!b) return null;
    const tiroir = b.closest('.vrm-ledger-drawer');
    if (tiroir) { const host = tiroir.closest('.vrm-ledger-drawer-host'); if (host && !host.hidden) return true;
      const t = document.querySelector(`.vrm-ledger-sale-toggle[aria-controls="${tiroir.id}"]`); if (!t) return false; t.setAttribute('data-banc-ouvrir', '1'); return false; }
    const ligne = b.closest('[data-ligne-ouverte]'); if (!ligne || ligne.getAttribute('data-ligne-ouverte') === 'true') return true;
    const t = ligne.querySelector('.vrm-ledger-sale-toggle'); if (!t) return false; t.setAttribute('data-banc-ouvrir', '1'); return false; }, sel);
  if (ouverte === null) return false;
  if (!ouverte) await pg.click('[data-banc-ouvrir="1"]').catch(() => {});
  return pg.waitForFunction((sel) => [...document.querySelectorAll(sel)].some((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0; }), sel, { timeout: 5000 }).then(() => true, () => false);
}

// Les gestes : souris (ordinateur) ou VRAIS points de contact (téléphone, CDP).
async function gestes(pg, ctx, tactile) {
  const cdp = tactile ? await ctx.newCDPSession(pg) : null;
  const toucher = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p.x, y: p.y, id: i + 1, radiusX: 2, radiusY: 2, force: 1 })) });
  return {
    async glisser(de, a, n = 12) {
      if (!tactile) { await pg.mouse.move(de.x, de.y); await pg.mouse.down(); for (let i = 1; i <= n; i++) await pg.mouse.move(de.x + (a.x - de.x) * i / n, de.y + (a.y - de.y) * i / n); await pg.mouse.up(); return; }
      await toucher('touchStart', [de]);
      for (let i = 1; i <= n; i++) await toucher('touchMove', [{ x: de.x + (a.x - de.x) * i / n, y: de.y + (a.y - de.y) * i / n }]);
      await toucher('touchEnd', []);
    },
    async pincer(c, d0, d1, n = 10) {
      const pts = (d) => [{ x: c.x - d / 2, y: c.y }, { x: c.x + d / 2, y: c.y }];
      await toucher('touchStart', [pts(d0)[0]]); await toucher('touchStart', pts(d0));
      for (let i = 1; i <= n; i++) await toucher('touchMove', pts(d0 + (d1 - d0) * i / n));
      await toucher('touchEnd', [pts(d1)[0]]); await toucher('touchEnd', []);
    },
  };
}
const lireBoite = (pg) => pg.evaluate(() => {
  const b = document.querySelector('[data-tampon-boite]'), sc = document.querySelector('[data-tampon-scene]'), cv = sc && sc.querySelector('canvas');
  if (!b || !cv) return null; const r = cv.getBoundingClientRect(), rb = b.getBoundingClientRect();
  return { v: +b.dataset.variante || 0, x: +b.dataset.x, y: +b.dataset.y, w: +b.dataset.w, h: +b.dataset.h, libre: b.dataset.libre, ppt: +sc.dataset.ppt, gauche: r.left, haut: r.top, cx: rb.left + rb.width / 2, cy: rb.top + rb.height / 2, droite: rb.right, bas: rb.bottom,
    code: !!document.querySelector('[data-tampon-code]'), toujours: !!(document.querySelector('[data-tampon-toujours]') || {}).checked };
});
// Le PDF de la visionneuse : où le titre est écrit (page affichée, points).
const lirePdf = (pg) => pg.evaluate(async () => {
  const f = document.querySelector('[data-visionneuse-cadre]'); if (!f) return null;
  const o = new Uint8Array(await (await fetch(f.getAttribute('src'))).arrayBuffer());
  const d = await window.pdfjsLib.getDocument({ data: o, isEvalSupported: false }).promise;
  try {
    const pg = await d.getPage(1), v = pg.getViewport({ scale: 1 });
    const items = (await pg.getTextContent()).items.map((it) => { const m = window.pdfjsLib.Util.transform(v.transform, it.transform); return { s: it.str, x: m[4], y: m[5], t: Math.hypot(m[2], m[3]) }; });
    return { pages: d.numPages, items };
  } finally { await d.destroy(); }
});
// Les variantes de cartouche (CARTOUCHES d'App.jsx) : corps du N° et du titre.
const VARIANTES = [{ tn: 18, tt: 8 }, { tn: 15, tt: 7 }, { tn: 12, tt: 6.5 }];

(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.log('KO  dist/ absent : construire l\'app d\'abord'); process.exit(1); }
  const PDF_B64 = await fabriquer();
  const rows = [
    { id: 'email_bord_test1', data: { transaction: '9001', filename: 'bordereau.pdf', modele: TITRE, receivedAt: auj.toISOString(), pdfB64: PDF_B64 } },
    { id: 'harvest_111_orders_sold', data: { capturedAt: auj.toISOString(), payload: { my_orders: VENTES } } },
  ];
  await new Promise((o) => srv.listen(PORT, o));
  const nav = await chromium.launch({ executablePath: CHROME, args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    for (const vp of [{ width: 390, height: 844, tactile: true }, { width: 1512, height: 950, tactile: false }].filter((v) => !process.env.BANC_VP || String(v.width) === process.env.BANC_VP)) {
      console.log(`── ${vp.width} px ${vp.tactile ? '(doigt)' : '(souris)'}`);
      const ctx = await nav.newContext({ viewport: { width: vp.width, height: vp.height }, ...(vp.tactile ? { isMobile: true, hasTouch: true } : {}) });
      const pg = await ctx.newPage();
      const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
      await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
      await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
        const u = r.request().url();
        if (/pdfjs-dist@[^/]+\/build\/pdf\.min\.js/.test(u)) return r.fulfill({ status: 200, contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' }, body: PDFJS });
        if (/pdfjs-dist@[^/]+\/build\/pdf\.worker\.min\.js/.test(u)) return r.fulfill({ status: 200, contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' }, body: WORKER });
        return ['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue();
      });
      await pg.route('**/rest/v1/**', (route) => {
        const u = decodeURIComponent(metaVersData(route.request().url()));
        const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
        if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
        if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
        const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
        const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: auj.toISOString(), cap: r.data.capturedAt });
        const eq = /id=eq\.([^&]*)/.exec(u);
        if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
        const lk = /id=like\.([^&]*)/.exec(u);
        if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
        return j([]);
      });
      await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
      await pg.goto(`http://localhost:${PORT}/?tab=cat_ventes`, { waitUntil: 'domcontentloaded' });
      await pg.waitForTimeout(3500);
      try { await pg.getByText('Toutes', { exact: true }).first().click({ timeout: 3000 }); await pg.waitForTimeout(800); } catch (_) {}
      await monterTiroirs(pg);
      const G = await gestes(pg, ctx, vp.tactile);
      const cliquerImprimer = async () => { await ouvrirVente(pg, '9001'); await pg.locator('[data-bouton-bord="pdf"][data-tx="9001"]:visible').first().click({ timeout: 5000 }); };
      try { await cliquerImprimer(); } catch (e) { dit(false, 'le bouton « Imprimer » de la vente se clique', String(e.message).slice(0, 100)); await ctx.close(); continue; }
      // 1. L'aperçu.
      const pret = await pg.waitForSelector('[data-placeur-tampon="pret"]', { timeout: 25000 }).then(() => true, () => false);
      dit(pret, 'forme jamais vue : « Imprimer » ouvre l\'aperçu du tampon (page rendue)', await pg.evaluate(() => (document.querySelector('[data-placeur-tampon]') || {}).outerHTML ? document.querySelector('[data-placeur-tampon]').getAttribute('data-placeur-tampon') + ' ' + (document.querySelector('[data-placeur-tampon]').getAttribute('data-raison') || '') : 'absent'));
      if (!pret) { await pg.screenshot({ path: path.join(CAPT, `tampon-libre-${vp.width}-ko.png`) }); await ctx.close(); continue; }
      const forme = await pg.evaluate(() => document.querySelector('[data-placeur-tampon]').getAttribute('data-forme'));
      dit(/^mondialrelay·A4·portrait$/.test(forme || ''), 'la forme est nommée : transporteur + format + orientation', forme);
      await pg.waitForTimeout(300);
      await pg.screenshot({ path: path.join(CAPT, `tampon-libre-${vp.width}-auto.png`) });
      let b = await lireBoite(pg);
      const sur = (z) => b && b.x < z.x + z.w && b.x + b.w > z.x && b.y < z.y + z.h && b.y + b.h > z.y;
      dit(b && b.libre === '0' && !sur(ZONES.code) && !sur(ZONES.texte) && !b.code, 'le tampon est d\'abord à la place choisie par VRM (un blanc : ni le texte, ni le code-barres)', JSON.stringify(b && { x: b.x, y: b.y, w: b.w, h: b.h }));
      dit(b && b.toujours, '« Toujours ici » est coché par défaut');
      const txt = await pg.evaluate(() => document.querySelector('[data-placeur-tampon]').innerText);
      dit(!/touche|glisse|déplace|choisis|vérifie|espace blanc/i.test(txt), 'aucun texte explicatif dans l\'aperçu', txt.replace(/\s+/g, ' ').slice(0, 160));
      const cibles = await pg.evaluate(() => [...document.querySelectorAll('[data-placeur-tampon] button, [data-placeur-tampon] label, [data-tampon-poignee]')].map((e) => { const r = e.getBoundingClientRect(); return [e.textContent.trim().slice(0, 20) || e.getAttribute('aria-label') || e.className, Math.round(r.width), Math.round(r.height)]; }).filter((x) => x[1] > 0 && (x[1] < 44 || x[2] < 44)));
      dit(!cibles.length, 'chaque cible au doigt fait 44 px', JSON.stringify(cibles));
      const deb = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      dit(deb.sw <= deb.cw + 1, 'aucun débordement horizontal', `${deb.sw} > ${deb.cw}`);
      const ecran = (x, y) => ({ x: b.gauche + x * b.ppt, y: b.haut + y * b.ppt });
      // 2. Sur le code-barres : une puce, rien de bloqué.
      await G.glisser({ x: b.cx, y: b.cy }, ecran(ZONES.code.x + ZONES.code.w / 2, ZONES.code.y + ZONES.code.h / 2));
      b = await lireBoite(pg);
      dit(b.libre === '1' && b.code, 'glissé sur le code-barres : posé (libre), la puce « recouvre le code-barres » s\'affiche', JSON.stringify({ x: b.x, y: b.y, code: b.code }));
      // 2b. Sur du TEXTE, loin des bords (aucune aimantation).
      const T = { x: 150, y: 400 };
      await G.glisser({ x: b.cx, y: b.cy }, ecran(T.x + b.w / 2, T.y + b.h / 2));
      b = await lireBoite(pg);
      const tolG = 2 / b.ppt + 0.5;
      dit(Math.abs(b.x - T.x) <= tolG && Math.abs(b.y - T.y) <= tolG && !b.code, 'glissé SUR DU TEXTE : il y reste, la puce s\'en va', `(${b.x}, ${b.y}) visé (${T.x}, ${T.y}) ±${tolG.toFixed(1)}`);
      // 2c. Aimantation douce : lâché à 4 px du bord gauche ⇒ collé au bord.
      await G.glisser({ x: b.cx, y: b.cy }, { x: b.cx - (b.x * b.ppt) + 4, y: b.cy });
      const bA = await lireBoite(pg);
      dit(bA.x === 0, 'aimantation douce : lâché à 4 px du bord, il s\'y colle', `x = ${bA.x}`);
      await G.glisser({ x: bA.cx, y: bA.cy }, { x: bA.cx + T.x * bA.ppt, y: bA.cy });
      b = await lireBoite(pg);
      // 3. Agrandir : poignée (souris) ou pincement (doigt).
      const w0 = b.w;
      if (vp.tactile) await G.pincer({ x: b.cx, y: b.cy }, 40, 80);
      else await G.glisser({ x: b.droite - 4, y: b.bas - 4 }, { x: b.droite - 4 + 60, y: b.bas - 4 + 10 });
      b = await lireBoite(pg);
      const att = vp.tactile ? w0 * 2 : w0 + 60 / b.ppt;
      dit(Math.abs(b.w - att) <= Math.max(3, att * 0.05), `agrandi (${vp.tactile ? 'pincement' : 'poignée'}) : la taille suit le geste`, `${w0.toFixed(1)} → ${b.w.toFixed(1)} pt, attendu ≈ ${att.toFixed(1)}`);
      // Rétréci très fort : jamais sous la taille lisible (titre ≥ 5 pt ⇒ k ≥ 0,625).
      if (vp.tactile) await G.pincer({ x: b.cx, y: b.cy }, 200, 10);
      else await G.glisser({ x: b.droite - 4, y: b.bas - 4 }, { x: b.droite - 4 - 400, y: b.bas - 4 });
      const bMin = await lireBoite(pg);
      const V = VARIANTES[bMin.v] || VARIANTES[0], kMin = Math.max(9 / V.tn, 5 / V.tt);
      dit(Math.abs(bMin.w - w0 * kMin) <= 0.6 && bMin.w < w0, 'rétréci : bloqué à la taille lisible (N° ≥ 9 pt, titre ≥ 5 pt)', `${bMin.w.toFixed(1)} pt (k = ${(bMin.w / w0).toFixed(3)}, mini ${kMin.toFixed(3)})`);
      if (vp.tactile) await G.pincer({ x: bMin.cx, y: bMin.cy }, 50, 75); else await G.glisser({ x: bMin.droite - 4, y: bMin.bas - 4 }, { x: bMin.droite - 4 + 0.5 * w0 * bMin.ppt, y: bMin.bas - 4 });
      b = await lireBoite(pg);
      await G.glisser({ x: b.cx, y: b.cy }, ecran(T.x + b.w / 2, T.y + b.h / 2));
      b = await lireBoite(pg);
      await pg.screenshot({ path: path.join(CAPT, `tampon-libre-${vp.width}-texte.png`) });
      const k = b.w / w0;   // l'aperçu part de la variante 0 à l'échelle 1 (w0) : k = l'échelle choisie
      // 4. Imprimer.
      await pg.locator('[data-tampon-imprimer]').click();
      const vis = await pg.waitForSelector('[data-visionneuse-pdf="pret"]', { timeout: 20000 }).then(() => true, () => false);
      dit(vis && !(await pg.locator('[data-placeur-tampon]').count()), '« Imprimer » referme l\'aperçu et ouvre le PDF dans la visionneuse');
      const pdf = vis ? await lirePdf(pg) : null;
      const l1 = pdf && pdf.items.find((x) => /^Nike Air Max/.test(x.s));
      const tt = (VARIANTES[b.v] || VARIANTES[0]).tt, eX = b.x + 3 * k, eY = b.y + (3 + tt * 1.05) * k;
      dit(!!l1 && Math.abs(l1.x - eX) <= 2.5 && Math.abs(l1.y - eY) <= 2.5 && Math.abs(l1.t - tt * k) <= 0.6, 'le PDF imprimé porte le titre À LA PLACE ET À LA TAILLE choisies (±2,5 pt)', l1 ? `(${l1.x.toFixed(1)}, ${l1.y.toFixed(1)}) ${l1.t.toFixed(1)} pt, attendu (${eX.toFixed(1)}, ${eY.toFixed(1)}) ${(tt * k).toFixed(1)} pt` : JSON.stringify(pdf && pdf.items.slice(-3)));
      dit(pdf && pdf.pages === 1, 'une seule page : pas de fiche colis', pdf && `${pdf.pages} p.`);
      // 5. Mémorisé pour la forme : le clic suivant imprime directement au même endroit.
      const memo = await pg.evaluate((f) => { try { return (JSON.parse(localStorage.getItem('vrm_tampon_positions') || '{}') || {})[f] || null; } catch (_) { return null; } }, forme);
      dit(memo && Math.abs(memo.vx * 595.28 - b.x) < 0.5 && Math.abs(memo.vy * 841.89 - b.y) < 0.5, '« Toujours ici » : la place est rangée pour la forme (`vrm_tampon_positions`)', JSON.stringify(memo));
      try { await pg.locator('[data-visionneuse-fermer]').click({ timeout: 3000 }); } catch (_) {}
      try { await pg.locator('[data-bord-fermer]:visible').first().click({ timeout: 3000 }); } catch (_) {}
      await pg.waitForTimeout(500);
      try { await cliquerImprimer(); } catch (e) { dit(false, 'le second clic « Imprimer »', String(e.message).slice(0, 100)); await pg.screenshot({ path: path.join(CAPT, `tampon-libre-${vp.width}-second.png`) }); }
      const vis2 = await pg.waitForSelector('[data-visionneuse-pdf="pret"]', { timeout: 20000 }).then(() => true, () => false);
      const sansApercu = !(await pg.locator('[data-placeur-tampon]').count());
      dit(vis2 && sansApercu, 'même forme ensuite : aucun aperçu, le PDF s\'ouvre directement');
      const pdf2 = vis2 ? await lirePdf(pg) : null;
      const l2 = pdf2 && pdf2.items.find((x) => /^Nike Air Max/.test(x.s));
      dit(!!l2 && !!l1 && Math.abs(l2.x - l1.x) <= 0.5 && Math.abs(l2.y - l1.y) <= 0.5 && Math.abs(l2.t - l1.t) <= 0.2, 'et le tampon retombe au même endroit, à la même taille', l2 ? `(${l2.x.toFixed(1)}, ${l2.y.toFixed(1)})` : 'absent');
      dit(errs.length === 0, 'aucune erreur d\'app', errs.join(' | ').slice(0, 200));
      await ctx.close();
    }
  } finally { await nav.close(); srv.close(); }
  console.log(`\n${ok} vert${ok > 1 ? 's' : ''}, ${ko} rouge${ko > 1 ? 's' : ''}`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
