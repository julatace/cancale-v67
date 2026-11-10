// Banc : « REPUBLIER À LA MAIN » CONSEILLÉ + LE KIT DE PLUSIEURS ANNONCES (10 nov., lot AP).
// Julien (9 nov., demande 17) : « la conseiller (moins risquée) et la rendre attirante ;
// transmettre les photos retouchées à la galerie du téléphone ; … les descriptions en
// sélection multiple ».
// Données INVENTÉES (dépôt public), 390 px tactile (iPhone : menu de partage avec fichiers,
// noté) et 1512 px (téléchargement), clair et sombre. Il exige :
//   C. la vue Republier d'Annonces : le conseil « À la main » en tête ; deux paires cochées ⇒
//      « À la main · 2 » en bouton PRINCIPAL, « Par VRM · 2 » en second ;
//   K. le kit : une carte par paire (N°, titre, description telle qu'elle partira avec le
//      N°42 en bas) ; « Copier » le N° ⇒ « N°42 » ; la description ⇒ son texte ; « Tout
//      copier » ⇒ les deux blocs dans l'ordre de ses clics ; « Photos » ⇒ les 2 photos
//      réglées envoyées à la galerie (iPhone) ou téléchargées (ordinateur) ;
//   P. « Pas à pas » ouvre la feuille en cinq étapes (« Paire 1/2 ») ; à l'étape Photos,
//      une photo préparée s'enregistre SEULE (VRM-42-02.jpg) ;
//   N. « Ouvrir Vinted » (kit) note le suivi des deux paires : la vue demande de désigner
//      la nouvelle annonce (« Reprendre ») — le N° ne suit que par son clic ;
//   F. rien n'est parti chez Vinted ; cibles de 44 px ; aucun débordement ; aucune erreur.
// §6.1 : sur le code d'avant, la vue n'a ni conseil ni « À la main » ⇒ rouge.
require('../_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const path = require('path'), fs = require('fs'), http = require('http'), os = require('os');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT) || 9937;
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
    if (d.__vmr === 'photo') post({ __vmr: 'photo:result', reqId: d.reqId, dataUrl: o.png });
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
  const ctx = await b.newContext({ acceptDownloads: true, viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: `http://localhost:${PORT}` }).catch(() => {});
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((sb) => { try { localStorage.setItem('vrm_acces_direct', '1'); if (sb && !localStorage.getItem('vinted_dark')) localStorage.setItem('vinted_dark', 'true'); } catch (_) {} }, sombre);
  await pg.addInitScript(PONT, { version: VERSION, png: 'data:image/png;base64,' + PNG.toString('base64') });
  // 390 tactile = iPhone : le menu de partage avec fichiers (noté) ; 1512 : aucun partage => téléchargement.
  await pg.addInitScript((tel) => { window.__partages = []; if (tel) { navigator.canShare = () => true; navigator.share = async (o) => { window.__partages.push((o.files || []).map((f) => f.name)); }; } else { try { delete Navigator.prototype.share; delete Navigator.prototype.canShare; } catch (_) {} } }, vp.width < 600);
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
const clic = async (pg, sel) => { const l = pg.locator(sel).first(); await l.scrollIntoViewIfNeeded().catch(() => {}); await l.click({ timeout: 4000 }).catch(async () => { await pg.$eval(sel, (x) => x.click()).catch(() => {}); }); };
const attendre = async (pg, f, ms = 8000) => { const t = Date.now(); let v; while (Date.now() - t < ms) { v = await pg.evaluate(f).catch(() => null); if (v) return v; await pg.waitForTimeout(200); } return v; };
const pressePapier = (pg) => pg.evaluate(async () => { try { return await navigator.clipboard.readText(); } catch (_) { return null; } });
const petitsDans = (pg, sel) => pg.$$eval(`${sel} button, ${sel} a[href]`, (l) => l.filter((x) => { if (x.closest('[hidden]')) return false; const r = x.getBoundingClientRect(); return r.height && r.height < 43.5; }).map((x) => (x.getAttribute('aria-label') || x.textContent || x.tagName).trim().slice(0, 24)));
const poseeLa = (pg, sel) => attendre(pg, `(() => { const f = document.querySelector(${JSON.stringify(sel)}); if (!f) return null; const r = f.getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight - 150 && !document.getAnimations().some((a) => a.playState === 'running') ? 1 : null; })()`, 12000);

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: CHROMIUM, args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      for (const sombre of [false, true]) {
        const T = `${vp.width}${sombre ? ' sombre' : ' clair'}`;
        if (process.env.VUES && !process.env.VUES.split(',').includes(T.replace(' ', '-'))) continue;
        const tel = vp.width < 600;
        const nomF = (x) => path.join(SHOTS, `republier-kit-${vp.width}-${sombre ? 'sombre' : 'clair'}-${x}.png`);
        console.log(`── ${T}`);
        const { ctx, pg, errs } = await contexte(b, vp, sombre);
        try {
          // ── C : la vue Republier ──
          await pg.goto(`http://localhost:${PORT}/?tab=cat_annonces&vue=republier`, { waitUntil: 'domcontentloaded' });
          await pg.waitForSelector('[data-selection-vue="republier"]', { timeout: 20000 });
          for (let i = 0; i < 40; i++) { if (await pg.$('[data-selection-annonce="9103"]')) break; await pg.waitForTimeout(250); }
          dit(await pg.locator('[data-republier-conseil="main"]').count() === 1, `C ${T} le conseil « À la main » est en tête de la vue Republier`);
          await clic(pg, '[data-selection-annonce="9102"] input'); await clic(pg, '[data-selection-annonce="9103"] input');
          const barre = await attendre(pg, () => { const m = document.querySelector('[data-republier-main-lancer]'); const v = document.querySelector('[data-republier-lancer]'); return m && v ? { m: m.getAttribute('data-republier-main-lancer'), mP: m.classList.contains('vrm-b-primaire'), v: v.getAttribute('data-republier-lancer'), vP: v.classList.contains('vrm-b-primaire') } : null; });
          dit(barre && barre.m === '2' && barre.mP && barre.v === '2' && !barre.vP, `C ${T} deux paires cochées : « À la main · 2 » principal, « Par VRM · 2 » en second`, JSON.stringify(barre));
          await pg.waitForTimeout(600); await pg.screenshot({ path: nomF('1-vue') });
          // ── K : le kit ──
          await clic(pg, '[data-republier-main-lancer]');
          await pg.waitForSelector('[data-kit-main="2"]', { timeout: 8000 });
          await poseeLa(pg, '[data-kit-main]');
          const lu = await attendre(pg, () => { const l = [...document.querySelectorAll('[data-kit-paire]')]; return l.length === 2 && l.every((x) => x.getAttribute('data-kit-lue') === '1') ? l.map((x) => x.getAttribute('data-kit-paire')).join(',') : null; });
          dit(lu === '9102,9103', `K ${T} une carte par paire, dans l’ordre de ses clics, fiches lues`, lu);
          const desc1 = await pg.evaluate(() => (document.querySelector('[data-kit-paire="9102"] [data-kit-desc]') || {}).textContent || '');
          dit(/boîte d’origine\.\s+N°42$/.test(desc1), `K ${T} la description telle qu’elle partira (N°42 en bas, Réglages → Numéros)`, JSON.stringify(desc1.slice(-30)));
          await clic(pg, '[data-kit-copier-num="9102"]'); await pg.waitForTimeout(250);
          const cN = await pressePapier(pg);
          dit(cN === 'N°42', `K ${T} « Copier » le N° ⇒ « N°42 »`, JSON.stringify(cN));
          await clic(pg, '[data-kit-copier-desc="9103"]'); await pg.waitForTimeout(250);
          const cD = await pressePapier(pg);
          dit(/^Spezial noires, semelle propre\.\n\nN°43$/.test(cD || ''), `K ${T} « Copier » la description ⇒ son texte, l’ancienne lettre retirée, le N°43 en bas`, JSON.stringify(cD));
          await clic(pg, '[data-kit-tout-copier]'); await pg.waitForTimeout(250);
          const cT = await pressePapier(pg) || '';
          dit(cT.indexOf('N°42 · Salomon') === 0 && cT.indexOf('N°43 · Adidas') > cT.indexOf('boîte d’origine'), `K ${T} « Tout copier » : N° + titre + description de chacune, dans l’ordre`, JSON.stringify(cT.slice(0, 40)));
          // Photos : préparer puis enregistrer (iPhone) ; ordinateur : téléchargées d'un coup.
          const dl = []; pg.on('download', (d) => dl.push(d.suggestedFilename()));
          await clic(pg, '[data-kit-photos="9102"]');
          if (tel) { await attendre(pg, () => /Enregistrer les 2/.test((document.querySelector('[data-kit-photos="9102"]') || {}).textContent || '') || null); await clic(pg, '[data-kit-photos="9102"]'); }
          const fait = await attendre(pg, () => (document.querySelector('[data-kit-photos="9102"]') || {}).getAttribute ? document.querySelector('[data-kit-photos="9102"]').getAttribute('data-kit-photos-fait') : null);
          const partages = await pg.evaluate(() => window.__partages);
          if (tel) dit(fait === 'partage' && partages.length === 1 && partages[0].join(',') === 'VRM-42-01.jpg,VRM-42-02.jpg', `K ${T} iPhone : les 2 photos réglées partent au menu de partage (« Enregistrer les images » ⇒ Photos)`, JSON.stringify({ fait, partages }));
          else { await pg.waitForTimeout(500); dit(fait === 'telecharge' && dl.join(',') === 'VRM-42-01.jpg,VRM-42-02.jpg', `K ${T} ordinateur : les 2 photos réglées téléchargées`, JSON.stringify({ fait, dl })); }
          const p1 = await petitsDans(pg, '[data-kit-main]');
          dit(!p1.length, `F ${T} cibles ≥ 44 px (kit)`, p1.join(' | '));
          await pg.waitForTimeout(400); await pg.screenshot({ path: nomF('2-kit') });
          // ── N : « Ouvrir Vinted » note le suivi ──
          const [pop] = await Promise.all([pg.context().waitForEvent('page', { timeout: 5000 }).catch(() => null), clic(pg, '[data-kit-ouvrir-vinted]')]);
          if (pop) await pop.close().catch(() => {});
          const suivi = await attendre(pg, () => { try { const v = JSON.parse(localStorage.getItem('vrm_repub_main') || '{}'); return v['9102'] && v['9103'] ? Object.keys(v).sort().join(',') : null; } catch (_) { return null; } });
          dit(suivi === '9102,9103', `N ${T} « Ouvrir Vinted » note le suivi des deux paires (par leur identifiant)`, suivi);
          // ── P : pas à pas, une photo seule ──
          await clic(pg, '[data-kit-pas-a-pas]');
          await pg.waitForSelector('[data-repub-main="9102"]', { timeout: 8000 });
          await poseeLa(pg, '[data-repub-main]');
          dit((await pg.getAttribute('[data-repub-main]', 'data-main-rang')) === '1/2' && !(await pg.$('[data-kit-main]')), `P ${T} « Pas à pas » : la feuille en cinq étapes, « Paire 1/2 », le kit fermé`);
          await clic(pg, '[data-main-aller="photos"]');
          await clic(pg, '[data-main-telecharger]');
          await attendre(pg, () => document.querySelector('[data-main-photo-une="1"]') ? 1 : null);
          const avant = dl.length, avantP = (await pg.evaluate(() => window.__partages.length));
          await clic(pg, '[data-main-photo-une="1"]');
          await pg.waitForTimeout(600);
          const une = await pg.evaluate(() => ({ p: window.__partages.slice(-1)[0] || [], fait: (document.querySelector('[data-main-photo-une="1"]') || {}).getAttribute ? document.querySelector('[data-main-photo-une="1"]').getAttribute('data-main-photo-une-fait') : null }));
          const seule = tel ? (await pg.evaluate(() => window.__partages.length)) === avantP + 1 && une.p.join(',') === 'VRM-42-02.jpg' : dl.slice(avant).join(',') === 'VRM-42-02.jpg';
          dit(seule && une.fait === '1', `P ${T} une photo préparée s’enregistre SEULE (VRM-42-02.jpg)`, JSON.stringify({ une, dl: dl.slice(avant) }));
          const p2 = await petitsDans(pg, '[data-repub-main]');
          dit(!p2.length, `F ${T} cibles ≥ 44 px (photos)`, p2.join(' | '));
          await pg.screenshot({ path: nomF('3-photo-seule') });
          await clic(pg, '[data-repub-main] button[aria-label="Fermer"]');
          await pg.waitForTimeout(400);
          const rep = await attendre(pg, () => document.querySelectorAll('[data-suivi-main-reprendre]').length || null);
          dit(rep === 2, `N ${T} la vue demande de désigner les deux nouvelles annonces (« Reprendre ») : le N° suit par son clic`, String(rep));
          await pg.screenshot({ path: nomF('4-suivis') });
          dit((await pg.evaluate(() => window.__envois.length)) === 0, `F ${T} rien n’est parti chez Vinted (c’est lui qui publie)`);
          const deb = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          dit(deb <= 1, `F ${T} aucun débordement horizontal`, deb);
          dit(!errs.length, `F ${T} aucune erreur de page`, errs.slice(0, 2).join(' | '));
        } catch (e) { dit(false, `${T} le parcours s’arrête`, e.message.split('\n')[0]); await pg.screenshot({ path: nomF('erreur') }).catch(() => {}); }
        await ctx.close();
      }
    }
  } finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\nKO  ${ko} contrôle(s) rouge(s) — captures : ${SHOTS}` : `\nOK  à la main conseillé, kit de plusieurs annonces — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
