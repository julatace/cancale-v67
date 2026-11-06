// Banc : « REPUBLIER À LA MAIN » RÉGLÉ COMME L'ATELIER (6 nov., Julien : « je veux que on
// puisse régler comme quand c'est VRM qui fait, pareil améliore l'interface »).
//
// Données INVENTÉES (le dépôt est public), 390 px tactile et 1512 px, clair et sombre.
// Un faux pont d'extension (Chrome ouvert sur le compte 111) note ce qui part. Il exige :
//   R. régler dans l'ATELIER (Republier : −10 %, zoom 1,2, lettre) ⇒ la feuille « à la
//      main » s'ouvre avec CES réglages (une source) et le dit (« Mêmes réglages ») ;
//   E. cinq étapes numérotées, la progression en tête, « paire 1/2 » puis « Suivante » ;
//   P. les photos : l'aperçu porte le réglage (zoom 1,2) ;
//   T. le texte tel qu'il partira : prix 44,10 (49 € − 10 %), description avec le N°42
//      en bas (réglage `vrm_num_vinted`) puis la lettre ; « Copier » met CE texte dans le
//      presse-papiers et dit « Copié » ;
//   V. « Ouvrir Vinted » mène à « Relier » ; rien n'est parti chez Vinted ;
//   I. l'inverse : régler à la main (−20 %) ⇒ l'atelier s'ouvre à −20 % ; « Modifier prix
//      ou titre » reste neutre (des réglages à lui) ;
//   F. aucun débordement, cibles de 44 px dans la feuille, aucune erreur ; captures.
// §6.1 : sur le code d'avant, la feuille n'a ni étapes ni « Mêmes réglages » ⇒ rouge.
const path = require('path'), fs = require('fs'), http = require('http'), os = require('os');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT) || 9921;
const SHOTS = process.env.SHOTS || os.tmpdir();
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const auj = new Date(); const s = Math.floor(auj / 1000);
// Une vraie petite image (PNG 40×50, deux bandes inventées) servie pour les photos du CDN :
// l'aperçu réglé se mesure sur un <img> réel, comme chez lui.
const PNG = (() => {
  const zlib = require('zlib'); const W = 40, H = 50;
  const crc = (b) => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let x = 0xffffffff; for (const v of b) x = t[(x ^ v) & 255] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0; };
  const bloc = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
  const brut = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) { brut[y * (W * 3 + 1)] = 0; for (let x = 0; x < W; x++) { const o = y * (W * 3 + 1) + 1 + x * 3; const haut = y < H * 0.6; brut[o] = haut ? 214 : 60; brut[o + 1] = haut ? 222 : 64; brut[o + 2] = haut ? 230 : 72; } }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), bloc('IHDR', ihdr), bloc('IDAT', zlib.deflateSync(brut)), bloc('IEND', Buffer.alloc(0))]);
})();
const ann = (id, o) => Object.assign({ id, price: { amount: '49.0', currency_code: 'EUR' }, is_closed: false, is_draft: false, is_hidden: false, photo: null, brand_title: 'Nike', size_title: '42', status: 'Très bon état', view_count: 10, favourite_count: 1, nPhotos: 2, descLen: 60, color1: 'Blanc', catalog_id: 1242, created_at_ts: s - 40 * 86400 }, o);
const ITEMS_111 = [
  ann(9102, { title: 'Salomon XT-6 blanc taille 40', brand_title: 'Salomon', size_title: '40' }),
  ann(9103, { title: 'Adidas Spezial noir taille 38', brand_title: 'Adidas', size_title: '38', price: { amount: '60.0', currency_code: 'EUR' } }),
];
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];
const MAIN = { vinted_annonce_numeros: { 9102: { numero: '42' }, 9103: { numero: '43' } }, vrm_num_vinted: { place: 'desc_fin', forme: 'numero' } };
const lignes = () => [
  { id: 'main', data: MAIN },
  { id: 'harvest_111_listings', data: { capturedAt: auj.toISOString(), payload: { items: ITEMS_111, pagination: { total_entries: ITEMS_111.length } } } },
  { id: 'coffre_111_9102', data: { title: 'Salomon XT-6 blanc taille 40', desc: 'Salomon XT-6 portées deux fois, boîte d’origine.', brand: 'Salomon', size: '40', etat: 'Très bon état', price: 49, photos: ['https://images1.vinted.net/t/a/f800/1.jpeg', 'https://images1.vinted.net/t/a/f800/2.jpeg'] } },
  { id: 'coffre_111_9103', data: { title: 'Adidas Spezial noir taille 38', desc: 'Spezial noires, semelle propre.\n\nq', brand: 'Adidas', size: '38', etat: 'Bon état', price: 60, photos: ['https://images1.vinted.net/t/b/f800/1.jpeg'] } },
];
const VERSION = (/EXT_ATTENDUE = '([\d.]+)'/.exec(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'App.jsx'), 'utf8')) || [])[1] || '5.322.0';
const PONT = (o) => {
  const post = (m) => window.postMessage(m, '*');
  window.__envois = [];
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version: o.version });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version: o.version, code: o.version, ext: 'banc-ext', vrm: { ok: true, connecte: true, email: '' }, vinted: { uid: '111', login: 'compte_test' }, cmds: {} } });
    if (d.__vmr === 'cmd') {
      if (['republierVinted', 'recreerVinted', 'publierBrouillon'].includes(d.cmd)) window.__envois.push({ cmd: d.cmd, id: d.id || d.draftId });
      post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: true, etape: 'recent' } });
    }
  });
  post({ __vmr: 'ready', version: o.version });
};

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d !== undefined && d !== '' ? ' — ' + d : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance avec un autre BANC_PORT'); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^(data|meta)(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (src.includes('->>') && typeof v === 'object' ? JSON.stringify(v) : v);
  }
  return out;
};

async function contexte(b, vp, sombre) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: `http://localhost:${PORT}` }).catch(() => {});
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((sb) => { try { localStorage.setItem('vrm_acces_direct', '1'); if (sb && !localStorage.getItem('vinted_dark')) localStorage.setItem('vinted_dark', 'true'); } catch (_) {} }, sombre);
  await pg.addInitScript(PONT, { version: VERSION });
  await ctx.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const t = r.request().resourceType();
    if (t === 'document') return r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>vinted (banc)</title>' });
    if (t === 'image' && /vinted\.net/.test(r.request().url())) return r.fulfill({ status: 200, contentType: 'image/png', body: PNG });
    if (['image', 'media', 'font'].includes(t)) return r.abort();
    return r.continue();
  });
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const rows = lignes();
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data|^data$|^data,/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: auj.toISOString(), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs };
}
const clic = async (pg, sel) => { const l = pg.locator(sel).first(); await l.scrollIntoViewIfNeeded().catch(() => {}); await l.click({ timeout: 4000 }).catch(async () => { await pg.$eval(sel, (x) => x.click()); }); };
const ouvrirSelection = async (pg) => {
  await pg.goto(`http://localhost:${PORT}/?tab=cat_annonces`, { waitUntil: 'domcontentloaded' });
  await pg.locator('[data-vue-selection]').first().waitFor({ state: 'attached', timeout: 15000 });
  await clic(pg, '[data-vue-selection]');
  await pg.waitForSelector('[data-selection-vue]', { timeout: 6000 });
  for (let i = 0; i < 40; i++) { if (await pg.$('[data-selection-annonce="9103"]')) break; await pg.waitForTimeout(250); }
};
const cocher = async (pg, id) => clic(pg, `[data-selection-annonce="${id}"] input`);
// Une case cochée UNE fois (un clic qui « échoue » après avoir agi la décocherait au repli).
const cocherCase = (pg, sel) => pg.locator(sel).first().evaluate((el) => { if (!el.checked) el.click(); });
const actions = async (pg, n) => { await clic(pg, '[data-actions-possibles]'); await pg.waitForSelector(`[data-actions-selection="${n}"]`, { timeout: 4000 }); };
const curseur = (pg, sel, v) => pg.locator(sel).first().evaluate((el, val) => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, String(val)); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, v);
const reglagesStockes = (pg) => pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_republier_reglages') || 'null'); } catch (_) { return null; } });
const etapeVisible = (pg) => pg.evaluate(() => { const v = [...document.querySelectorAll('[data-main-section]')].filter((x) => !x.hidden && x.getClientRects().length); return v.map((x) => x.getAttribute('data-main-section')).join(','); });
const petitsDans = (pg, sel) => pg.$$eval(`${sel} button, ${sel} a[href], ${sel} input[type=checkbox], ${sel} select`, (l) => l.filter((x) => { if (x.closest('[hidden]')) return false; const r = x.getBoundingClientRect(); if (!r.height) return false; const z = x.closest('label') || x; const rz = z.getBoundingClientRect(); return Math.max(r.height, rz.height) < 43.5; }).map((x) => (x.getAttribute('aria-label') || x.textContent || x.tagName).trim().slice(0, 24)));

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: CHROMIUM, args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      for (const sombre of [false, true]) {
        const T = `${vp.width}${sombre ? ' sombre' : ' clair'}`;
        const nomF = (x) => path.join(SHOTS, `republier-main-${vp.width}-${sombre ? 'sombre' : 'clair'}-${x}.png`);
        console.log(`── ${T}`);
        const { ctx, pg, errs } = await contexte(b, vp, sombre);
        try {
          await ouvrirSelection(pg);
          // ── R : régler dans l'ATELIER ─────────────────────────────────────────
          await cocher(pg, '9102'); await cocher(pg, '9103');
          await actions(pg, 2);
          await clic(pg, '[data-action-sel="recreer"]');
          await pg.waitForSelector('[data-republier-apercu="9102"]', { timeout: 6000 });
          dit((await pg.getAttribute('[data-republier-memes-reglages]', 'data-republier-memes-reglages').catch(() => null)) === 'neutre', `R ${T} l’atelier dit « Mêmes réglages que Republier à la main » (neutres au départ)`);
          await clic(pg, '[data-republier-reduc="-10"]');
          await pg.locator('[data-republier-retouche]').evaluate((d) => { d.open = true; });
          await curseur(pg, '[data-republier-reglage="zoom"]', 1.2);
          await cocherCase(pg, '[data-republier-lettre]');
          await pg.waitForTimeout(300);
          const pA = await pg.getAttribute('[data-republier-apercu="9102"]', 'data-republier-nouveau-prix');
          dit(pA === '4410', `R ${T} atelier : −10 % sur 49 € ⇒ 44,10 €`, pA);
          let st = null; for (let i = 0; i < 20; i++) { st = await reglagesStockes(pg); if (st && st.prix && st.prix.delta === '-10' && st.lettre) break; await pg.waitForTimeout(150); }
          dit(st && st.prix && st.prix.base === 'pct' && st.prix.delta === '-10' && st.photo && st.photo.zoom === 1.2 && st.lettre === true, `R ${T} l’atelier écrit SES réglages dans la clé commune (synchronisée)`, JSON.stringify(st));
          const bandeau = await pg.getAttribute('[data-republier-memes-reglages]', 'data-republier-memes-reglages').catch(() => '');
          dit(/Prix −10 %/.test(bandeau) && /retouchées/.test(bandeau) && /Lettre/.test(bandeau), `R ${T} ce qui est gardé est dit (« Gardés : … »)`, bandeau);
          await pg.screenshot({ path: nomF('atelier') });
          dit((await pg.evaluate(() => window.__envois.length)) === 0, `R ${T} rien n’est parti (l’atelier attend sa confirmation)`);
          await clic(pg, '[data-republier] button[aria-label="Fermer"]');
          await pg.waitForTimeout(300);
          // ── E : « à la main » sur les deux paires ────────────────────────────
          if (!(await pg.locator('[data-actions-possibles]').count())) { await cocher(pg, '9102'); await cocher(pg, '9103'); }
          await actions(pg, 2);
          await clic(pg, '[data-action-sel="main"] button');
          await pg.waitForSelector('[data-repub-main="9102"]', { timeout: 6000 });
          for (let i = 0; i < 20; i++) { if (!(await pg.$('[data-main-lecture]'))) break; await pg.waitForTimeout(200); }
          const tete = await pg.evaluate(() => { const f = document.querySelector('[data-repub-main]'); return { rang: f.getAttribute('data-main-rang'), etapes: [...f.querySelectorAll('[data-main-aller]')].map((x) => x.getAttribute('data-main-aller')), courante: (f.querySelector('[aria-current="step"]') || {}).getAttribute ? f.querySelector('[aria-current="step"]').getAttribute('data-main-aller') : '', sous: (f.querySelector('.vrm-fs-sous-titre') || {}).textContent || '', num: (f.querySelector('[data-main-num]') || {}).textContent || '' }; });
          dit(tete.rang === '1/2' && /Paire 1\/2/.test(tete.sous), `E ${T} deux paires : « Paire 1/2 » en tête`, JSON.stringify(tete));
          dit(tete.etapes.join(',') === 'reglages,photos,texte,vinted,relier' && tete.courante === 'reglages' && tete.num === 'N°42', `E ${T} cinq étapes numérotées, la première en cours, le N° de la paire dit une fois`, JSON.stringify(tete));
          // R (suite) : les MÊMES réglages, lus à la main.
          const mm = await pg.getAttribute('[data-main-memes-reglages]', 'data-main-memes-reglages').catch(() => null);
          dit(mm && /Prix −10 %/.test(mm), `R ${T} « à la main » s’ouvre avec les réglages de l’atelier et le dit (« Mêmes réglages que Republier »)`, mm);
          const regM = await pg.evaluate(() => ({ reduc: (document.querySelector('[data-main-reduc="-10"]') || {}).getAttribute ? document.querySelector('[data-main-reduc="-10"]').getAttribute('aria-pressed') : null, zoom: (document.querySelector('[data-main-reglage="zoom"]') || {}).value, lettre: (document.querySelector('[data-main-lettre]') || {}).checked, prix: (document.querySelector('[data-main-prix-resultat]') || {}).getAttribute ? document.querySelector('[data-main-prix-resultat]').getAttribute('data-main-prix-resultat') : null }));
          dit(regM.reduc === 'true' && regM.zoom === '1.2' && regM.lettre === true && regM.prix === '4410', `R ${T} à la main : −10 %, zoom 1,2, lettre cochés ; prix 44,10 €`, JSON.stringify(regM));
          dit((await etapeVisible(pg)) === 'reglages', `E ${T} une étape à la fois`, await etapeVisible(pg));
          const p1 = await petitsDans(pg, '[data-repub-main]');
          dit(!p1.length, `F ${T} cibles ≥ 44 px (Réglages)`, p1.join(' | '));
          await pg.screenshot({ path: nomF('1-reglages') });
          // ── P : les photos ───────────────────────────────────────────────────
          await clic(pg, '[data-main-suivant="photos"]');
          await pg.waitForTimeout(250);
          const ph = await pg.evaluate(() => { const g = document.querySelector('[data-main-photos]'); const i = g && g.querySelector('img'); return { n: g && g.getAttribute('data-main-photos'), tf: i ? i.style.transform : '', vis: [...document.querySelectorAll('[data-main-section]')].filter((x) => !x.hidden).map((x) => x.getAttribute('data-main-section')).join(',') }; });
          dit(ph.vis === 'photos' && ph.n === '2' && /scale\(1\.2\)/.test(ph.tf), `P ${T} étape 2 : les 2 photos, avec le zoom 1,2 de l’atelier`, JSON.stringify(ph));
          const faitR = await pg.getAttribute('[data-main-aller="reglages"]', 'data-main-etape-fait').catch(() => null);
          dit(faitR === '1', `E ${T} l’étape passée est cochée dans la progression`, faitR);
          dit(await pg.locator('[data-main-telecharger="2"]').count() === 1, `P ${T} un bouton pour enregistrer les 2 photos réglées`);
          await pg.screenshot({ path: nomF('2-photos') });
          // ── T : le texte tel qu'il partira ────────────────────────────────────
          await clic(pg, '[data-main-suivant="texte"]');
          await pg.waitForTimeout(250);
          const tx = await pg.evaluate(() => { const v = (k) => ((document.querySelector(`[data-main-champ="${k}"] .vrm-main-valeur`) || {}).textContent || ''); return { titre: v('titre'), desc: v('description'), prix: v('prix'), marque: v('marque'), taille: v('taille'), etat: v('etat'), final: (document.querySelector('[data-main-apercu]') || {}).getAttribute ? document.querySelector('[data-main-apercu]').getAttribute('data-main-prix-final') : null, apDesc: (document.querySelector('[data-main-apercu-desc]') || {}).textContent || '' }; });
          dit(tx.prix === '44,10' && tx.final === '4410', `T ${T} le prix à copier est celui de l’atelier : 44,10`, JSON.stringify({ p: tx.prix, f: tx.final }));
          dit(/boîte d’origine\.\n\nN°42\n\n[a-z]$/.test(tx.desc) && tx.apDesc === tx.desc, `T ${T} description : le N°42 en bas (Réglages → Numéros), puis la lettre ; l’aperçu dit la même`, JSON.stringify(tx.desc.slice(-24)));
          dit(tx.titre === 'Salomon XT-6 blanc taille 40' && tx.marque === 'Salomon' && tx.taille === '40' && /Très bon état/.test(tx.etat), `T ${T} titre, marque, taille, état à recopier`, JSON.stringify([tx.titre, tx.marque, tx.taille, tx.etat]));
          dit(await pg.locator('[data-main-copier]').count() === 6, `T ${T} un « Copier » par champ (6)`, String(await pg.locator('[data-main-copier]').count()));
          await clic(pg, '[data-main-copier="prix"]');
          await pg.waitForTimeout(250);
          const cp = await pg.evaluate(async () => { let t = null; try { t = await navigator.clipboard.readText(); } catch (_) {} return { t, lib: (document.querySelector('[data-main-copier="prix"]') || {}).textContent || '', marque: (document.querySelector('[data-main-champ="prix"]') || {}).getAttribute ? document.querySelector('[data-main-champ="prix"]').getAttribute('data-main-copie') : null }; });
          dit(cp.t === '44,10' && /Copié/.test(cp.lib) && cp.marque === '1', `T ${T} « Copier » met 44,10 dans le presse-papiers et dit « Copié »`, JSON.stringify(cp));
          const p3 = await petitsDans(pg, '[data-repub-main]');
          dit(!p3.length, `F ${T} cibles ≥ 44 px (Texte)`, p3.join(' | '));
          await pg.screenshot({ path: nomF('3-texte') });
          // ── V : mettre en ligne, relier ──────────────────────────────────────
          await clic(pg, '[data-main-suivant="vinted"]');
          await pg.waitForTimeout(250);
          await pg.screenshot({ path: nomF('4-vinted') });
          // §7 : UN bouton principal par écran (ici « Ouvrir Vinted »), le reste en second.
          const prim = await pg.$$eval('[data-repub-main] .vrm-b-primaire', (l) => l.filter((x) => !x.closest('[hidden]') && x.getClientRects().length).map((x) => x.textContent.trim()));
          dit(prim.length === 1 && /Ouvrir Vinted/.test(prim[0]), `F ${T} étape 4 : un seul bouton principal (« Ouvrir Vinted »)`, prim.join(' | '));
          const lien = await pg.evaluate(() => { const a = document.querySelector('[data-main-ouvrir-vinted]'); return a ? { href: a.getAttribute('href'), cible: a.getAttribute('target') } : null; });
          const [pop] = await Promise.all([pg.context().waitForEvent('page', { timeout: 5000 }).catch(() => null), clic(pg, '[data-main-ouvrir-vinted]')]);
          if (pop) await pop.close().catch(() => {});
          await pg.waitForTimeout(300);
          dit((await etapeVisible(pg)) === 'relier' && lien && lien.href === 'https://www.vinted.fr/items/new' && lien.cible === '_blank', `V ${T} « Ouvrir Vinted » ouvre la page de dépôt Vinted (nouvel onglet) et mène à « Relier »`, JSON.stringify({ e: await etapeVisible(pg), lien, pop: !!pop }));
          dit(await pg.locator('[data-main-suivante="2/2"]').count() === 1, `E ${T} à la dernière étape : « Paire suivante · 2/2 »`);
          await pg.screenshot({ path: nomF('5-relier') });
          await clic(pg, '[data-main-suivante="2/2"]');
          await pg.waitForSelector('[data-repub-main="9103"]', { timeout: 5000 }).catch(() => {});
          for (let i = 0; i < 20; i++) { if (!(await pg.$('[data-main-lecture]'))) break; await pg.waitForTimeout(200); }
          const p2 = await pg.evaluate(() => { const f = document.querySelector('[data-repub-main]'); return { id: f && f.getAttribute('data-repub-main'), rang: f && f.getAttribute('data-main-rang'), et: f && f.getAttribute('data-main-etape'), prix: (document.querySelector('[data-main-prix-resultat]') || {}).getAttribute ? document.querySelector('[data-main-prix-resultat]').getAttribute('data-main-prix-resultat') : null, desc: (document.querySelector('[data-main-champ="description"] .vrm-main-valeur') || {}).textContent || '' }; });
          dit(p2.id === '9103' && p2.rang === '2/2' && p2.et === 'reglages' && p2.prix === '5400', `E ${T} paire 2/2 : la suivante repart de l’étape 1, mêmes réglages (60 € − 10 % = 54 €)`, JSON.stringify(p2));
          dit(/semelle propre\.\n\nN°43\n\n[a-z]$/.test(p2.desc) && !/\n\nq\n\n/.test(p2.desc), `T ${T} l’ancienne lettre (« q ») est retirée : jamais deux lettres`, JSON.stringify(p2.desc.slice(-22)));
          // ── I : l'inverse — régler à la main règle l'atelier ─────────────────
          await clic(pg, '[data-main-reduc="-20"]');
          await pg.waitForTimeout(200);
          dit((await pg.getAttribute('[data-main-prix-resultat]', 'data-main-prix-resultat')) === '4800', `I ${T} à la main : −20 % ⇒ 48 €`);
          await clic(pg, '[data-repub-main] button[aria-label="Fermer"]');
          await pg.waitForTimeout(400);
          if (!(await pg.locator('[data-actions-possibles]').count())) { await cocher(pg, '9102'); await cocher(pg, '9103'); }
          await actions(pg, 2);
          await clic(pg, '[data-action-sel="recreer"]');
          await pg.waitForSelector('[data-republier-apercu="9102"]', { timeout: 6000 });
          const inv = await pg.evaluate(() => ({ p: document.querySelector('[data-republier-reduc="-20"]').getAttribute('aria-pressed'), a: document.querySelector('[data-republier-apercu="9102"]').getAttribute('data-republier-nouveau-prix') }));
          dit(inv.p === 'true' && inv.a === '3920', `I ${T} l’atelier s’ouvre à −20 % (régler dans l’un règle l’autre) : 49 € ⇒ 39,20 €`, JSON.stringify(inv));
          await clic(pg, '[data-republier] button[aria-label="Fermer"]');
          await pg.waitForTimeout(300);
          if (!(await pg.locator('[data-actions-possibles]').count())) { await cocher(pg, '9102'); await cocher(pg, '9103'); }
          await actions(pg, 2);
          await clic(pg, '[data-action-sel="modifier"]');
          await pg.waitForSelector('[data-republier-action="modifier"] [data-republier-reduc]', { timeout: 6000 }).catch(() => {});
          dit((await pg.getAttribute('[data-republier-reduc="aucun"]', 'aria-pressed').catch(() => null)) === 'true' && !(await pg.$('[data-republier-memes-reglages]')), `I ${T} « Modifier prix ou titre » garde ses réglages à lui (neutres : la même annonce, sur place)`);
          dit((await pg.evaluate(() => window.__envois.length)) === 0, `V ${T} rien n’est parti chez Vinted (c’est lui qui publie)`);
          const deb = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          dit(deb <= 1, `F ${T} aucun débordement horizontal`, deb);
          dit(!errs.length, `F ${T} aucune erreur de page`, errs.slice(0, 2).join(' | '));
        } catch (e) { dit(false, `${T} le parcours s’arrête`, e.message.split('\n')[0]); await pg.screenshot({ path: nomF('erreur') }).catch(() => {}); }
        await ctx.close();
      }
    }
  } finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\nKO  ${ko} contrôle(s) rouge(s) — captures : ${SHOTS}` : `\nOK  republier à la main = réglages de l’atelier — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
