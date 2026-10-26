// ═══════════════════════════════════════════════════════════════════════════
// BANC : RÉGLAGES → IMPRIMANTE ET BORDEREAUX
//        node scripts/bancs/imprimante.cjs            (port 6701, BANC_PORT pour changer)
// ═══════════════════════════════════════════════════════════════════════════
// Julien, 17 octobre : « dans les paramètres, imprimante thermique et normale ;
// tous les types de bordereau avec une visualisation pour chaque type collecté
// par l'app ; et la thermique au point ».
//
// Ce que ce banc exige, à 390 px (doigt) et 1512 px (souris) :
//   1. le choix thermique / normale écrit LE réglage `vrm_imprimante` (celui de
//      l'écran Colis, §11) ;
//   2. rien n'est lu avant le clic « Voir les aperçus » (des PDF de ~70 Ko,
//      §4.4), et jamais plus de 24 ;
//   3. chaque type reçu a son aperçu normal ET thermique, DESSINÉ (le canvas
//      n'est pas blanc), et un type jamais reçu est dit « pas encore vu » ;
//   4. les trois autres états : base muette ⇒ « pas pu lire » (jamais « aucun
//      bordereau ») · aucun PDF ⇒ la phrase du vide · lecteur PDF injoignable ⇒
//      « Ouvrir le PDF », pas un cadre vide ;
//   5. aucun débordement horizontal à 390 px.
//
// LES PDF : ses VRAIS bordereaux s'ils sont là (`fx/bordereaux`, copie locale
// GITIGNORÉE — vrais acheteurs, dépôt public, §6), sinon trois mises en page
// fabriquées ici avec pdf-lib. Le lecteur pdf.js est servi depuis une copie
// locale à la place de cdn.jsdelivr.net (déterminisme) : BANC_PDFJS_DIR, sinon
// téléchargé une fois depuis le registre npm.
const path = require('path');
const { cspBanc, bilanCsp } = require('./_vercel.cjs');   // CSP de vercel.json servie et observée (21 oct.)
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const PL = require(path.join(__dirname, '..', '..', 'node_modules', 'pdf-lib', 'cjs', 'index.js'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), os = require('os');
const { execFileSync } = require('child_process');

const DIST = path.join(__dirname, '..', '..', 'dist');   // ⚠️ jamais un chemin absolu (§6.1)
const PORT = Number(process.env.BANC_PORT || 6701);
const PDFJS_V = '3.11.174';
const CAPT = process.env.BANC_CAPTURES || '';
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml', '.zip':'application/zip', '.webmanifest':'application/manifest+json' };
const SESSION = { access_token: 'jeton-de-banc', refresh_token: 'r', expires_at: Date.now() + 3600e3,
  user: { id: '11111111-2222-3333-4444-555555555555', email: 'sophie@exemple.fr' } };

let ko = 0;
const dit = (bon, quoi, detail) => { if (!bon) ko++; console.log(`${bon ? '✅' : '❌'} ${quoi}${detail ? ' — ' + detail : ''}`); };

function dossierPdfjs() {
  if (process.env.BANC_PDFJS_DIR && fs.existsSync(path.join(process.env.BANC_PDFJS_DIR, 'pdf.min.js'))) return process.env.BANC_PDFJS_DIR;
  const base = path.join(os.tmpdir(), 'vrm-banc-pdfjs-' + PDFJS_V);
  const build = path.join(base, 'package', 'build');
  if (fs.existsSync(path.join(build, 'pdf.min.js'))) return build;
  fs.mkdirSync(base, { recursive: true });
  const tgz = path.join(base, 'pdfjs.tgz');
  execFileSync('curl', ['-sSL', '-m', '180', '-o', tgz, `https://registry.npmjs.org/pdfjs-dist/-/pdfjs-dist-${PDFJS_V}.tgz`]);
  execFileSync('tar', ['-xzf', tgz, '-C', base]);
  return build;
}

// ── Les bordereaux servis ────────────────────────────────────────────────────
async function synthetiques() {
  const A4 = [595.28, 841.89];
  const faire = async (quoi) => {
    const d = await PL.PDFDocument.create(); const p = d.addPage(A4);
    const f = await d.embedFont(PL.StandardFonts.Helvetica);
    if (quoi === 'chrono') {
      p.drawRectangle({ x: 20, y: 380, width: 260, height: 430, borderColor: PL.rgb(0, 0, 0), borderWidth: 1 });
      p.drawText('Chronopost Shop2Shop', { x: 28, y: 790, size: 12, font: f });
      for (let i = 0; i < 10; i++) p.drawText('ADRESSE DESTINATION 35260', { x: 28, y: 760 - i * 30, size: 9, font: f });
      p.drawRectangle({ x: 30, y: 420, width: 240, height: 60, color: PL.rgb(0, 0, 0) });
      p.drawText('Fiche destinataire', { x: 340, y: 700, size: 14, font: f });
      for (let i = 0; i < 8; i++) p.drawText('A glisser a l interieur du colis', { x: 340, y: 660 - i * 24, size: 9, font: f });
    } else if (quoi === 'mr') {
      for (let i = 0; i < 10; i++) p.drawText('Colissimo - comment utiliser votre etiquette', { x: 60, y: 780 - i * 22, size: 10, font: f });
      p.drawRectangle({ x: 60, y: 40, width: 470, height: 300, borderColor: PL.rgb(0, 0, 0), borderWidth: 1 });
      p.drawRectangle({ x: 80, y: 250, width: 300, height: 60, color: PL.rgb(0, 0, 0) });
      for (let i = 0; i < 6; i++) p.drawText('COLISSIMO 31360 BOUSSENS', { x: 80, y: 200 - i * 24, size: 9, font: f });
    }
    return Buffer.from(await d.save());
  };
  return { email_bord_100000000001: await faire('chrono'), email_bord_100000000002: await faire('mr') };
}
function vrais() {
  const FX = path.join(__dirname, 'fx', 'bordereaux');
  if (!fs.existsSync(FX)) return null;
  // un par type mesuré (les noms viennent de SA base : ils ne quittent pas cette machine)
  const pdfs = {};
  for (const f of fs.readdirSync(FX).filter((x) => x.endsWith('.pdf')).sort()) pdfs[f.replace(/\.pdf$/, '')] = fs.readFileSync(path.join(FX, f));
  return Object.keys(pdfs).length ? pdfs : null;
}

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0];
  if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end('nope'); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
  r.end(fs.readFileSync(p));
});
const ecouter = () => new Promise((res, rej) => {
  srv.once('error', (e) => rej(e.code === 'EADDRINUSE' ? new Error(`le port ${PORT} est déjà pris — relance ce banc seul (BANC_PORT=…).`) : e));
  srv.listen(PORT, () => res(srv));
});

async function rendre(nav, { largeur, pdfs, pdfjs, panne = false, vide = false, sansLecteur = false, nom }) {
  const doigt = largeur < 600;
  const ctx = await nav.newContext({ viewport: { width: largeur, height: doigt ? 844 : 1100 }, isMobile: doigt, hasTouch: doigt, deviceScaleFactor: 1 });
  await cspBanc(ctx, `http://localhost:${PORT}`, 'imprimante ' + nom);
  const pg = await ctx.newPage();
  await pg.addInitScript((s) => {
    try { localStorage.setItem('vrm_session', JSON.stringify(s)); } catch (_) {}
    try { localStorage.setItem('vrm_imprimante', JSON.stringify('normale')); } catch (_) {}
  }, SESSION);
  const lectures = { liste: 0, pdf: 0 };
  let cliqueA = Infinity, pdfAvantClic = 0;
  const ids = Object.keys(pdfs);
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ access_token: 'jeton-de-banc', refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
  await pg.route('**/rest/v1/**', (r) => {
    const u = decodeURIComponent(metaVersData(r.request().url()));
    const json = (b, st = 200) => r.fulfill({ status: st, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: JSON.stringify(b) });
    const pdf = u.match(/id=eq\.([^&]+)&select=b:data->>pdfB64/);
    if (pdf) {
      lectures.pdf++; if (Date.now() < cliqueA) pdfAvantClic++;
      const b = pdfs[pdf[1]];
      return json(b ? [{ b: b.toString('base64') }] : []);
    }
    const liste = u.match(/id=like\.(email_bord_\*|harvest_\*_label_\*)&data->>pdfB64=not\.is\.null&select=id,at:data->>(receivedAt|capturedAt)/);
    if (liste) {
      lectures.liste++;
      if (panne) return r.fulfill({ status: 522, contentType: 'text/html', body: '<html>522</html>' });
      if (vide) return json([]);
      const fam = liste[1].startsWith('email') ? /^email_bord_/ : /^harvest_/;
      return json(ids.filter((i) => fam.test(i)).map((id, k) => ({ id, at: new Date(Date.now() - k * 3600e3).toISOString() })));
    }
    return json([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await pg.route('**://cdn.jsdelivr.net/npm/pdfjs-dist@*/**', (r) => {
    if (sansLecteur) return r.abort();
    const f = path.join(pdfjs, path.basename(new URL(r.request().url()).pathname));
    if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ status: 200, contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(f) });
  });
  await pg.route('**://*.vinted.net/**', (r) => r.abort());
  const erreurs = [];
  pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 160)));
  await pg.goto(`http://localhost:${PORT}/?tab=settings`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(3500);
  // Au doigt, les panneaux sont des sous-écrans : on ouvre le nôtre.
  if (!(await pg.locator('[data-imprimante-reglage]').first().isVisible().catch(() => false))) {
    await pg.getByText('Imprimante et bordereaux', { exact: false }).first().click({ timeout: 4000 }).catch(() => {});
    await pg.waitForTimeout(800);
  }
  const res = { nom, erreurs, lectures };
  res.present = await pg.locator('[data-imprimante-reglage]').first().isVisible().catch(() => false);
  if (!res.present) { await ctx.close(); return res; }
  // 1. le choix
  await pg.locator('[data-imprimante-choix="thermique"]').first().click({ timeout: 3000 }).catch(() => {});
  await pg.waitForTimeout(1200);   // `save()` attend 500 ms
  res.ecrit = await pg.evaluate(() => localStorage.getItem('vrm_imprimante'));
  res.phrase = await pg.locator('[data-imprimante-phrase]').first().innerText().catch(() => '');
  // 2. rien n'est lu avant le clic
  res.pdfAvantClic = lectures.pdf;
  cliqueA = Date.now();
  await pg.locator('[data-apercus-voir]').first().click({ timeout: 3000 }).catch(() => {});
  await pg.waitForFunction(() => { const e = document.querySelector('[data-apercus]'); return e && e.getAttribute('data-apercus') !== 'charge'; }, null, { timeout: 60000 }).catch(() => {});
  res.etat = await pg.locator('[data-apercus]').first().getAttribute('data-apercus').catch(() => null);
  if (res.etat === 'lu') {
    await pg.waitForFunction(() => !document.querySelector('[data-apercu="charge"]'), null, { timeout: 60000 }).catch(() => {});
    res.types = await pg.$$eval('[data-apercu-type]', (els) => els.map((el) => ({
      type: el.getAttribute('data-apercu-type'), n: +el.getAttribute('data-apercu-n'), isoles: +el.getAttribute('data-apercu-isoles'),
      apercus: Array.from(el.querySelectorAll('[data-apercu]')).map((f) => {
        const c = f.querySelector('canvas'); let encre = 0;
        try { const g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height).data; for (let i = 0; i < d.length; i += 4) if (d[i] < 200) encre++; } catch (_) { encre = -1; }
        return { etat: f.getAttribute('data-apercu'), label: (f.querySelector('figcaption') || {}).innerText || '', encre, w: c ? c.width : 0, h: c ? c.height : 0 };
      }),
    })));
    res.jamais = await pg.locator('[data-apercus-jamais]').first().getAttribute('data-apercus-jamais').catch(() => null);
    res.compte = await pg.locator('[data-apercus-compte]').first().getAttribute('data-apercus-compte').catch(() => null);
  }
  res.texte = await pg.locator('[data-imprimante-reglage]').first().innerText().catch(() => '');
  res.deborde = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (CAPT) {
    fs.mkdirSync(CAPT, { recursive: true });
    await pg.locator('[data-imprimante-reglage]').first().screenshot({ path: path.join(CAPT, `imprimante-${nom}.png`) }).catch(() => {});
  }
  await ctx.close();
  return res;
}

(async () => {
  try { await ecouter(); } catch (e) { console.log('❌ ' + e.message); process.exit(1); }
  let pdfjs; try { pdfjs = dossierPdfjs(); } catch (e) { console.log('❌ lecteur pdf.js introuvable (BANC_PDFJS_DIR) — ' + e.message); process.exit(1); }
  const reels = vrais();
  const pdfs = reels || await synthetiques();
  console.log(`ℹ︎  ${reels ? `${Object.keys(pdfs).length} vrais bordereaux (copie locale)` : 'bordereaux fabriqués (pas de copie locale)'}`);
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    for (const largeur of [1512, 390]) {
      console.log(`\n── ${largeur} px`);
      const x = await rendre(nav, { largeur, pdfs, pdfjs, nom: String(largeur) });
      dit(!x.erreurs.length, 'l’écran se rend sans erreur', x.erreurs[0] || '');
      dit(x.present, 'le panneau « Imprimante et bordereaux » est dans Réglages');
      if (!x.present) continue;
      dit(x.ecrit === '"thermique"', 'choisir « Thermique » écrit LE réglage `vrm_imprimante`', x.ecrit);
      dit(/10\s*×\s*15/.test(x.phrase) && /entière/.test(x.phrase), 'la phrase dit ce que fait la thermique (10×15, page entière si inconnue)', x.phrase.slice(0, 90));
      dit(x.pdfAvantClic === 0, 'aucun PDF lu avant « Voir les aperçus »', String(x.pdfAvantClic));
      dit(x.lectures.pdf <= 24, 'jamais plus de 24 PDF lus', String(x.lectures.pdf));
      dit(x.etat === 'lu', 'les aperçus se calculent', x.etat || '(rien)');
      const types = x.types || [];
      dit(types.length >= 2, 'plusieurs types reconnus', types.map((t) => `${t.type}:${t.n}`).join(' '));
      for (const t of types) {
        const dessines = t.apercus.filter((a) => a.etat === 'ok' && a.encre > 200);
        dit(t.apercus.length >= 2 && dessines.length === t.apercus.length, `${t.type} : aperçu normal ET thermique, dessinés`, t.apercus.map((a) => `${a.label.split('·')[0].trim()}=${a.etat}/${a.encre}`).join(' · '));
        const th = t.apercus.filter((a) => /^Thermique · 10×15/.test(a.label));
        if (t.isoles > 0) dit(th.length >= 1 && th.every((a) => Math.abs(a.w / a.h - 100 / 150) < 0.02), `${t.type} : l’aperçu thermique est au format 10×15`, th.map((a) => `${a.w}×${a.h}`).join(' '));
      }
      dit(!!x.jamais && /vintedgo/.test(x.jamais), 'un type jamais reçu est dit « pas encore vu »', x.jamais || '(rien)');
      dit(x.deborde <= 1, 'aucun débordement horizontal', `${x.deborde} px`);
    }

    console.log('\n── LES AUTRES ÉTATS (1512 px)');
    const p = await rendre(nav, { largeur: 1512, pdfs, pdfjs, panne: true, nom: 'panne' });
    dit(p.etat === 'passu' && /pas pu lire/.test(p.texte) && !/aucun bordereau/i.test(p.texte), 'base muette ⇒ « pas pu lire », jamais « aucun bordereau »', p.etat);
    const v = await rendre(nav, { largeur: 1512, pdfs, pdfjs, vide: true, nom: 'vide' });
    dit(v.etat === 'vide' && /prochaine vente/.test(v.texte), 'aucun PDF ⇒ la phrase du vide', v.etat);
    const s = await rendre(nav, { largeur: 1512, pdfs, pdfjs, sansLecteur: true, nom: 'sanslecteur' });
    const tous = (s.types || []).flatMap((t) => t.apercus);
    dit(s.etat === 'lu' && tous.length > 0 && tous.every((a) => a.etat === 'ko') && /Ouvrir le PDF/.test(s.texte), 'lecteur PDF injoignable ⇒ « Ouvrir le PDF », pas un cadre vide', `${tous.filter((a) => a.etat === 'ko').length}/${tous.length}`);
  } finally { await nav.close(); srv.close(); }
  console.log(`\n${ko ? `${ko} contrôle(s) au rouge.` : 'Le réglage d’imprimante dit et montre ce qui sortira.'}`);
  ko += bilanCsp();
  process.exit(ko ? 1 : 0);
})();
