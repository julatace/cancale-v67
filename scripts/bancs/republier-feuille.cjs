// Banc : LA FEUILLE « REPUBLIER À LA MAIN » REFAITE (23 nov.).
// Julien, trois captures iPhone : « ça doit être beaucoup mieux, plus pratique » ; puis « trop de texte, pas assez de beaux
// boutons ». Données INVENTÉES (dépôt public). 390 px tactile (partage de fichiers simulé) et 1512 px, clair et sombre.
//   H1 une annonce MASQUÉE (toujours chez lui) : à l'étape Photos, « Supprimer » n'est pas cochée (avant : cochée) ;
//   H2 13 photos : LE bouton plein est en bas (« Enregistrer les 13 photos »), seul plein ; enregistrées ⇒ « Suivant » plein ;
//   H3 chaque tuile : la photo, son rang, la case — aucun bouton posé dessus, rien ne chevauche ni ne déborde ;
//   H4 aucune couleur orange dans la feuille, à chaque étape ;
//   H5 chaque texte visible ≤ 8 mots (le détail sous « Pourquoi ? ») ;
//   H6 la retouche repliée : avant / après, 5 curseurs (nom à gauche, UNE piste fine, valeur à droite, 44 px), double-toucher = zéro ;
//   H7 l'ordre au glisser (souris ; doigt : maintenir puis glisser) : la 4e photo passe en couverture ;
//   H8 il manque des photos : une ligne, UN bouton ; la fiche lue arrive ⇒ VRM relit tout seul au retour (aucun « Relire ») ;
//   H9 une barre de progression fine ; H10 44 px au doigt, aucun débordement, aucune erreur.
// §6.1 : sur le code d'avant, H1 (masquée ⇒ « partie »), H2 (pas de pied), H3 (↓/✓ sur la tuile), H5, H6, H8 sont rouges.
require('../_source-app.cjs').brancher();
const path = require('path'), fs = require('fs'), http = require('http'), os = require('os');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT) || 9947;
const SHOTS = process.env.SHOTS || os.tmpdir();
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const auj = new Date(); const s = Math.floor(auj / 1000);
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
// 13 photos connues (la fiche lue sur la page), la vignette seule au dressing — la capture de Julien.
const TREIZE = Array.from({ length: 13 }, (_, i) => `https://images1.vinted.net/t/t/f800/${i + 1}.jpeg`);
const A13 = ann(9110, { title: 'Nike Dunk Low panda taille 42', photo: TREIZE[0], photoCount: 13, nPhotos: 13 });
// Une annonce MASQUÉE (toujours chez lui, hors de la liste « en ligne ») : « Supprimer » ne doit pas se cocher.
const MASQ = ann(9105, { title: 'Asics Gel-Kayano 14 argent taille 41', brand_title: 'Asics', size_title: '41', is_hidden: true, photo: 'https://images1.vinted.net/t/m/f800/1.jpeg' });
// Une annonce dont VRM n'a d'abord que la vignette : la fiche arrive (l'extension la lit), VRM la relit tout seul.
const CINQ = Array.from({ length: 5 }, (_, i) => `https://images1.vinted.net/t/c/f800/${i + 1}.jpeg`);
const A5 = ann(9106, { title: 'New Balance 550 blanc vert taille 43', brand_title: 'New Balance', size_title: '43', photo: CINQ[0], photoCount: 5, nPhotos: 5 });
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];
const MAIN = { vinted_annonce_numeros: { 9110: { numero: '12' }, 9105: { numero: '13' }, 9106: { numero: '14' } }, vinted_used_numeros: [12, 13, 14], vrm_num_vinted: { place: 'desc_fin', forme: 'numero' } };
const etat = { ficheCinq: false };
const lignes = () => [
  { id: 'main', data: MAIN },
  { id: 'harvest_111_listings', data: { capturedAt: new Date().toISOString(), payload: { items: [A13, MASQ, A5], pagination: { total_entries: 3 } } } },
  { id: 'vinted_item_details', data: { 9110: { description: 'Dunk Low portées deux fois, très propres.', photos: TREIZE }, ...(etat.ficheCinq ? { 9106: { description: 'NB 550 jamais portées.', photos: CINQ } } : {}) } },
  { id: 'coffre_111_9105', data: { title: 'Asics Gel-Kayano 14 argent taille 41', desc: 'Kayano 14 portées une fois.', brand: 'Asics', size: '41', price: 49, photos: ['https://images1.vinted.net/t/m/f800/1.jpeg', 'https://images1.vinted.net/t/m/f800/2.jpeg'] } },
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
      window.__envois.push({ cmd: d.cmd, id: d.id || d.draftId || d.itemId });
      post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: true, etape: 'recent' } });
    }
  });
  post({ __vmr: 'ready', version: o.version });
};

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d !== undefined && d !== '' ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); };
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
    let v = row.data; for (const seg of src.replace(/^(data|meta)(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg.replace(/^"|"$/g, '')];
    out[alias] = v == null ? null : (src.includes('->>') && typeof v === 'object' ? JSON.stringify(v) : v);
  }
  return out;
};

async function contexte(b, vp, sombre) {
  const ctx = await b.newContext({ acceptDownloads: true, serviceWorkers: 'block', viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: `http://localhost:${PORT}` }).catch(() => {});
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((sb) => { try { localStorage.setItem('vrm_acces_direct', '1'); if (sb && !localStorage.getItem('vinted_dark')) localStorage.setItem('vinted_dark', 'true'); } catch (_) {} }, sombre);
  await pg.addInitScript(PONT, { version: VERSION, png: 'data:image/png;base64,' + PNG.toString('base64') });
  // 390 tactile = iPhone : le menu de partage avec FICHIERS, chaque appel noté (noms + activation du geste).
  await pg.addInitScript((tel) => {
    window.__partages = [];
    if (tel) {
      navigator.canShare = (o) => !!(o && Array.isArray(o.files) && o.files.length);
      navigator.share = async (o) => { window.__partages.push({ noms: (o.files || []).map((f) => f.name), types: (o.files || []).map((f) => f.type), geste: !!(navigator.userActivation && navigator.userActivation.isActive) }); };
    } else { try { delete Navigator.prototype.share; delete Navigator.prototype.canShare; } catch (_) {} }
  }, vp.width < 600);
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
    const forme = (r) => (sel && !/^id,data|^data$|^data,/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: new Date().toISOString(), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs };
}
let touchers = 0;
const clic = async (pg, sel, compte = true) => { if (compte) touchers++; const l = pg.locator(sel).first(); await l.scrollIntoViewIfNeeded().catch(() => {}); await l.click({ timeout: 4000 }).catch(async () => { await pg.$eval(sel, (x) => x.click()).catch(() => {}); }); };
const clicPopup = async (pg, sel) => { const [pop] = await Promise.all([pg.context().waitForEvent('page', { timeout: 5000 }).catch(() => null), clic(pg, sel)]); if (pop) await pop.close().catch(() => {}); return pop; };
const attendre = async (pg, f, ms = 8000, arg) => { const t = Date.now(); let v; while (Date.now() - t < ms) { v = await pg.evaluate(f, arg).catch(() => null); if (v) return v; await pg.waitForTimeout(200); } return v; };
const pressePapier = (pg) => pg.evaluate(async () => { try { return await navigator.clipboard.readText(); } catch (_) { return null; } });
const petitsDans = (pg, sel) => pg.$$eval(`${sel} button, ${sel} a[href], ${sel} summary`, (l) => l.filter((x) => { if (x.closest('[hidden]')) return false; const r = x.getBoundingClientRect(); return r.height && r.height < 43.5; }).map((x) => (x.getAttribute('aria-label') || x.textContent || x.tagName).trim().slice(0, 24)));
// Les pleins VISIBLES dans la feuille (Studio : un par écran au plus).
const pleins = (pg, sel) => pg.$$eval(`${sel} .vrm-b-primaire`, (l) => l.filter((x) => !x.closest('[hidden]') && !x.closest('details:not([open])') && x.getBoundingClientRect().height > 0).map((x) => x.textContent.trim().slice(0, 30)));
const poseeLa = (pg, sel) => attendre(pg, `(() => { const f = document.querySelector(${JSON.stringify(sel)}); if (!f) return null; const r = f.getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight - 150 && !document.getAnimations().some((a) => a.playState === 'running') ? 1 : null; })()`, 12000);
const ls = (pg, k) => pg.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } }, k);
const premierPlan = (pg) => pg.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
// Ouvre « Republier à la main » sur UNE annonce, comme lui au téléphone et à l'ordinateur : Annonces, le « ⋯ » de la
// rangée (les gestes de CETTE annonce), « Republier à la main ».
const ouvrir = async (pg, id) => {
  await pg.goto(`http://localhost:${PORT}/?tab=annonces`, { waitUntil: 'domcontentloaded' });
  const g = `[data-ad-gestes="vinted#${id}"]`;
  await pg.waitForSelector(`${g}, [data-eg-actions], [data-tt-ouvre="action"]`, { timeout: 25000 });
  await pg.waitForTimeout(400);
  if (await pg.$(g)) {
    // Téléphone : le « ⋯ » de la rangée, puis « Republier à la main ».
    await clic(pg, g);
    const r = pg.locator('button.n-rangee-corps', { hasText: 'Republier à la main' }).first();
    await r.waitFor({ timeout: 8000 }).catch(() => {});
    touchers++; await r.click({ timeout: 5000 }).catch(() => {});
  } else if (await pg.$('[data-tt-ouvre="action"]')) {
    // Ordinateur (tableau de travail) : cocher la ligne, « Choisir une action » → « Republier à la main », lancer.
    await clic(pg, '[data-tt-ouvre="action"]');
    await pg.waitForSelector('[data-tt-action="main"]', { timeout: 8000 }).catch(() => {});
    await clic(pg, '[data-tt-action="main"]');
    await pg.waitForTimeout(300);
    await clic(pg, `[data-tt-ligne^="vinted#${id}|"] input.n-tt-coche, [data-tt-ligne="vinted#${id}"] input.n-tt-coche`);
    await attendre(pg, () => (document.querySelector('[data-tt-lancer="main"][data-tt-lancer-n="1"]') ? 1 : null), 6000);
    await clic(pg, '[data-tt-lancer="main"]');
  } else {
    // Ordinateur sans tableau : « Actions » → « Republier à la main » → cocher l'annonce → lancer.
    await clic(pg, '[data-eg-actions]');
    await pg.waitForSelector('[data-eg-action="main"]', { timeout: 8000 }).catch(() => {});
    await clic(pg, '[data-eg-action="main"] button, [data-eg-action="main"]');
    await pg.waitForSelector(`[data-eg-article="vinted#${id}"]`, { timeout: 8000 }).catch(() => {});
    await clic(pg, `[data-eg-article="vinted#${id}"] button, [data-eg-article="vinted#${id}"]`);
    await attendre(pg, () => (document.querySelector('[data-eg-lancer="main"][data-eg-n="1"]') ? 1 : null), 6000);
    await clic(pg, '[data-eg-lancer="main"]');
  }
  const F = `[data-repub-main="${id}"]`;
  const ok = await attendre(pg, (f) => (document.querySelector(f) ? 1 : null), 8000, F);
  if (ok) await poseeLa(pg, F);
  return ok ? F : null;
};
// Les textes VISIBLES de l'étape à l'écran (hors « Pourquoi ? », hors valeurs à copier) : leur nombre de mots.
const textesVisibles = (pg, F) => pg.evaluate((f) => {
  const sec = document.querySelector(`${f} [data-main-section]:not([hidden])`); if (!sec) return null;
  const l = [];
  for (const el of sec.querySelectorAll('p, span, div, summary, h3, figcaption, label, output')) {
    if (el.closest('details[data-pourquoi], .vrm-pourquoi, [data-main-champ] .vrm-main-valeur, details:not([open]) > :not(summary), .vrm-sel-liste')) continue;
    if ([...el.childNodes].every((n) => n.nodeType !== 3 || !n.textContent.trim())) continue;   // seulement les nœuds qui portent du texte à eux
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const t = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ').replace(/\s+/g, ' ').trim();
    if (t) l.push(t);
  }
  return l;
}, F);
const mots = (t) => String(t).split(/\s+/).filter((w) => /[\p{L}\d]/u.test(w)).length;
// Une couleur orange visible (teinte 15–50°, saturée) n'importe où dans la feuille : interdite (gris + accent seulement).
const orangesDans = (pg, F) => pg.evaluate((f) => {
  const racine = document.querySelector(f); if (!racine) return ['feuille absente'];
  const rgb = (c) => { const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/.exec(c || ''); return m && (m[4] == null || Number(m[4]) > 0.15) ? [Number(m[1]) / 255, Number(m[2]) / 255, Number(m[3]) / 255] : null; };
  const orange = (c) => { const v = rgb(c); if (!v) return false; const [r, g, b] = v; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (d < 0.25 || mx !== r) return false; const h = 60 * (((g - b) / d) % 6); const hh = h < 0 ? h + 360 : h; return hh >= 15 && hh <= 50; };
  const out = [];
  for (const el of [racine, ...racine.querySelectorAll('*')]) {
    const r = el.getBoundingClientRect(); if (!r.width || !r.height || el.closest('[hidden]')) continue;
    const cs = getComputedStyle(el);
    for (const k of ['color', 'backgroundColor', 'borderTopColor', 'fill']) if (orange(cs[k]) && (k !== 'borderTopColor' || parseFloat(cs.borderTopWidth) > 0) && (k !== 'color' || (el.textContent || '').trim())) out.push(`${el.tagName.toLowerCase()}.${String(el.className && el.className.baseVal != null ? el.className.baseVal : el.className).split(' ')[0]} ${k}=${cs[k]}`);
  }
  return [...new Set(out)].slice(0, 6);
}, F);
// Les pleins VISIBLES dans la feuille.
const pleinsVus = (pg, F) => pg.$$eval(`${F} [data-n-variante="plein"], ${F} .vrm-b-primaire`, (l) => l.filter((x) => !x.closest('[hidden]') && !x.closest('details:not([open])') && x.getBoundingClientRect().height > 0).map((x) => ({ t: x.textContent.trim().slice(0, 40), pied: !!x.closest('[data-rg-pied]') })));

// Les gestes du pied dont le libellé passe sur plusieurs lignes (le texte rendu en plus d'une ligne : Range.getClientRects).
const piedCoupe = (pg, F) => pg.evaluate((f) => [...document.querySelectorAll(`${f} [data-rg-pied] button, ${f} [data-rg-pied] a`)].filter((x) => x.getBoundingClientRect().height > 0).map((x) => {
  // chaque nœud de TEXTE du libellé : ses morceaux rendus à des hauteurs différentes = des lignes (l'icône n'entre pas).
  let lignes = 1; const w = document.createTreeWalker(x, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (!n.textContent.trim()) continue;
    const r = document.createRange(); r.selectNodeContents(n);
    const tops = [...r.getClientRects()].filter((q) => q.width > 0.5).map((q) => q.top).sort((a, b) => a - b);
    let k = tops.length ? 1 : 0; for (let i = 1; i < tops.length; i++) if (tops[i] - tops[i - 1] > 4) k++;
    lignes = Math.max(lignes, k);
  }
  return { t: x.textContent.trim().slice(0, 30), lignes, html: x.outerHTML.slice(0, 160) };
}).filter((x) => x.lignes > 1).map((x) => ({ t: x.t, lignes: x.lignes, html: x.html })), F);

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: CHROMIUM, args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      for (const sombre of [false, true]) {
        const T = `${vp.width}${sombre ? ' sombre' : ' clair'}`;
        if (process.env.VUES && !process.env.VUES.split(',').includes(T.replace(' ', '-'))) continue;
        const tel = vp.width < 600;
        const nomF = (x) => path.join(SHOTS, `republier-feuille-${vp.width}-${sombre ? 'sombre' : 'clair'}-${x}.png`);
        console.log(`── ${T}`);
        etat.ficheCinq = false;
        const { ctx, pg, errs } = await contexte(b, vp, sombre);
        try {
          // ── H1 : une annonce masquée (toujours chez lui) : « Supprimer » n'est PAS cochée à l'étape 1 ──
          const FM = await ouvrir(pg, 9105);
          dit(!!FM, `H1 ${T} « À la main » s’ouvre sur l’annonce masquée`);
          if (FM) {
            await pg.waitForTimeout(600);
            const s = await pg.evaluate((f) => { const b = document.querySelector(`${f} [data-main-aller="supprimer"]`); return b ? { etat: b.getAttribute('data-rg-etat'), fait: b.getAttribute('data-main-etape-fait'), coche: !!b.querySelector('svg'), etape: document.querySelector(f).getAttribute('data-main-etape') } : null; }, FM);
            dit(s && s.etape === 'photos' && s.etat !== 'fait' && !s.fait && !s.coche, `H1 ${T} à l’étape Photos, « Supprimer » n’est pas cochée (masquée ≠ supprimée : pas su)`, s);
            await pg.screenshot({ path: nomF('1-masquee') });
            await clic(pg, `${FM} button[aria-label="Fermer"]`, false); await pg.waitForTimeout(300);
          }
          // ── H2–H7 : 13 photos ──
          const F = await ouvrir(pg, 9110);
          dit(!!F, `H2 ${T} « À la main » s’ouvre sur l’annonce de 13 photos`);
          if (!F) throw new Error('feuille absente');
          const pret = await attendre(pg, (f) => { const x = document.querySelector(`${f} [data-main-telecharger]`); return x && x.getAttribute('data-rg-photos-pretes') === '13' ? 13 : null; }, 90000, F);
          const pied = await pg.evaluate((f) => { const p = document.querySelector(`${f} [data-rg-pied]`); const t = p && p.querySelector('[data-main-telecharger]'); return p ? { geste: t ? t.textContent.trim() : '', plein: t ? t.getAttribute('data-n-variante') === 'plein' || /vrm-b-primaire/.test(t.className) : false, bas: Math.round(innerHeight - p.getBoundingClientRect().bottom) } : null; }, F);
          dit(pret === 13 && pied && pied.plein && (tel ? /Enregistrer les 13 photos/.test(pied.geste) : /Télécharger les 13 photos/.test(pied.geste)), `H2 ${T} LE bouton plein, en bas : « ${tel ? 'Enregistrer' : 'Télécharger'} les 13 photos »`, pied);
          // H2 une fois prêtes, les photos ne se REpréparent pas toutes seules (le plein ne se grise pas sous le doigt) : 4 s observées.
          const flic = await pg.evaluate((f) => new Promise((ok) => { const vus = []; const t0 = Date.now(); const tick = () => { const x = document.querySelector(`${f} [data-main-telecharger]`); const g = document.querySelector(`${f} [data-main-photos]`); const v = (x ? x.getAttribute('data-rg-photos-pretes') + (x.getAttribute('aria-disabled') ? 'D' : '') : '-') + '/' + (g ? g.getAttribute('data-main-photos') : '-'); if (vus[vus.length - 1] !== v) vus.push(v); if (Date.now() - t0 < 4000) requestAnimationFrame(tick); else ok(vus); }; tick(); }), F);
          dit(flic.length === 1, `H2 ${T} prêtes, elles le restent (le plein ne se grise pas tout seul)`, flic);
          const pl = await pleinsVus(pg, F);
          dit(pl.length === 1 && pl[0].pied, `H2 ${T} un seul plein dans la feuille, et il est dans le pied`, pl);
          // H10 le pied : chaque geste sur UNE ligne (« Pass / er » coupé en deux à 390 et 1512, vu sur la capture).
          const coupes = await piedCoupe(pg, F);
          dit(!coupes.length, `H10 ${T} pied : chaque geste sur une ligne (aucun « Pass / er »)`, coupes);
          // H9 la barre de progression : 4 segments fins, l'étape courante marquée.
          const prog = await pg.evaluate((f) => { const n = document.querySelector(`${f} .rg2-progres`); if (!n) return null; const t = [...n.querySelectorAll('.rg2-trait')]; return { n: t.length, h: Math.max(...t.map((x) => x.getBoundingClientRect().height)), ici: (n.querySelector('[aria-current="step"]') || {}).getAttribute ? n.querySelector('[aria-current="step"]').getAttribute('data-main-aller') : null }; }, F);
          dit(prog && prog.n === 4 && prog.h > 0 && prog.h <= 4 && prog.ici === 'photos', `H9 ${T} une barre de progression fine (4 traits ≤ 4 px), l’étape Photos marquée`, prog);
          // H3 les tuiles : la photo, son rang et la case — rien d'autre, rien qui se chevauche ni ne déborde.
          const tuiles = await pg.evaluate((f) => [...document.querySelectorAll(`${f} [data-rg-photo]`)].map((t) => {
            const autres = [...t.querySelectorAll('button, a, [role="button"]')].filter((x) => !x.matches('[data-rg-photo-choix]'));
            const rang = t.querySelector('.rg2-rang'), coche = t.querySelector('.rg2-coche');
            const R = (x) => x && x.getBoundingClientRect(); const a = R(rang), c = R(coche), tt = t.getBoundingClientRect();
            const chev = a && c && !(a.right <= c.left || c.right <= a.left || a.bottom <= c.top || c.bottom <= a.top);
            const dehors = [a, c].filter(Boolean).some((r) => r.left < tt.left - 0.5 || r.right > tt.right + 0.5 || r.top < tt.top - 0.5 || r.bottom > tt.bottom + 0.5);
            return { autres: autres.length, chev: !!chev, dehors, coupe: rang ? rang.scrollWidth > rang.clientWidth + 1 : false, txt: rang ? rang.textContent : '' };
          }), F);
          const malT = tuiles.filter((x) => x.autres || x.chev || x.dehors || x.coupe);
          dit(tuiles.length === 13 && !malT.length && tuiles[0].txt === 'Couverture', `H3 ${T} 13 tuiles : la photo, son rang (« Couverture » sur la 1re) et la case — aucun bouton posé dessus, rien ne chevauche ni ne déborde`, malT.slice(0, 3));
          // H5 les textes de l'étape : une phrase courte (≤ 8 mots) chacun.
          const tx = await textesVisibles(pg, F);
          const longs = (tx || []).filter((t) => mots(t) > 8);
          dit(tx && !longs.length, `H5 ${T} étape Photos : chaque texte visible ≤ 8 mots (le reste sous « Pourquoi ? »)`, longs.slice(0, 3));
          // H4 aucun orange.
          const or1 = await orangesDans(pg, F);
          dit(!or1.length, `H4 ${T} aucune couleur orange dans la feuille (étape Photos)`, or1);
          // H2 le plein reste DISPONIBLE (pas grisé) une fois les photos prêtes — mesuré au moment de la capture.
          const etatPlein = await pg.evaluate((f) => { const x = document.querySelector(`${f} [data-rg-pied] [data-main-telecharger]`); if (!x) return null; const cs = getComputedStyle(x); return { dis: x.getAttribute('aria-disabled') || (x.disabled ? 'true' : null), busy: x.getAttribute('aria-busy'), fond: cs.backgroundColor, op: cs.opacity, t: x.textContent.trim() }; }, F);
          console.log('    (capture 2) ' + JSON.stringify(etatPlein));
          await pg.screenshot({ path: nomF('2-photos') });
          // H7 l'ordre au glisser : la 4e photo amenée en 1re (couverture).
          const box = async (i) => pg.evaluate(([f, i]) => { const r = document.querySelector(`${f} [data-rg-photo="${i}"]`).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, [F, i]);
          await pg.evaluate((f) => document.querySelector(`${f} [data-rg-photo="3"]`).scrollIntoView({ block: 'center' }), F); await pg.waitForTimeout(200);
          const a3 = await box(3), a0 = await box(0);
          if (tel) {
            const cdp = await ctx.newCDPSession(pg);
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a3.x, y: a3.y }] });
            await pg.waitForTimeout(450);
            for (let k = 1; k <= 6; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a3.x + (a0.x - a3.x) * k / 6, y: a3.y + (a0.y - a3.y) * k / 6 }] }); await pg.waitForTimeout(40); }
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
          } else {
            await pg.mouse.move(a3.x, a3.y); await pg.mouse.down();
            for (let k = 1; k <= 8; k++) { await pg.mouse.move(a3.x + (a0.x - a3.x) * k / 8, a3.y + (a0.y - a3.y) * k / 8); await pg.waitForTimeout(30); }
            await pg.mouse.up();
          }
          await pg.waitForTimeout(400);
          const ordre = await pg.evaluate((f) => { const g = document.querySelector(`${f} [data-rg-ordre]`); return g ? { o: g.getAttribute('data-rg-ordre').split(',').slice(0, 5).join(','), n: g.getAttribute('data-rg-photos-choisies') } : null; }, F);
          dit(ordre && ordre.o === '4.jpeg,1.jpeg,2.jpeg,3.jpeg,5.jpeg' && ordre.n === '13', `H7 ${T} ${tel ? 'maintenir puis glisser' : 'glisser'} : la 4e photo passe en couverture, aucune retirée`, ordre);
          // Le fichier partagé n°1 est la photo déplacée (les noms suivent SON ordre) : vérifié par les adresses rangées.
          const prets2 = await attendre(pg, (f) => { const x = document.querySelector(`${f} [data-main-telecharger]`); return x && x.getAttribute('data-rg-photos-pretes') === '13' ? 1 : null; }, 90000, F);
          dit(prets2 === 1, `H7 ${T} les 13 photos repréparées dans le nouvel ordre`);
          // H6 la retouche : repliée, avant/après, de vrais curseurs.
          await clic(pg, `${F} [data-main-reglages] > summary`, false); await pg.waitForTimeout(300);
          const poser = (cle, v) => pg.evaluate(([f, cle, v]) => { const i = document.querySelector(`${f} [data-main-reglage="${cle}"]`); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, String(v)); i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); }, [F, cle, v]);
          await poser('bright', 1.1); await pg.waitForTimeout(250);
          const cur = await pg.evaluate((f) => [...document.querySelectorAll(`${f} [data-rg-curseur]`)].map((c) => {
            const pistes = c.querySelectorAll('[data-rg-piste]'); const p = pistes[0]; const i = c.querySelector('input[type=range]'); const o = c.querySelector('output'); const lb = c.querySelector('label');
            const rp = p && p.getBoundingClientRect(), ro = o && o.getBoundingClientRect(), rl = lb && lb.getBoundingClientRect(), ri = i && i.getBoundingClientRect();
            const rem = p && p.querySelector('.rg2-rempli'); const rr = rem && rem.getBoundingClientRect();
            return { cle: c.getAttribute('data-rg-curseur'), pistes: pistes.length, natifCache: i ? Number(getComputedStyle(i).opacity) === 0 : false, h: ri ? Math.round(ri.height) : 0, valeurADroite: !!(rp && ro && ro.left >= rp.right - 1), nomAGauche: !!(rp && rl && rl.right <= rp.left + 1), une: !!(rp && rp.height <= 6 && rp.height > 0), rempli: rr ? Math.round(rr.width) : 0, v: o ? o.textContent : '' };
          }), F);
          const malC = cur.filter((c) => c.pistes !== 1 || !c.natifCache || c.h < 44 || !c.valeurADroite || !c.nomAGauche || !c.une);
          const br = cur.find((c) => c.cle === 'bright');
          dit(cur.length === 5 && !malC.length, `H6 ${T} 5 curseurs : nom à gauche, UNE piste fine, valeur à droite, prise de 44 px`, malC.slice(0, 2));
          dit(br && br.v === '+10 %' && br.rempli > 0, `H6 ${T} Luminosité +10 % : le trait plein part du zéro, la valeur dite`, br);
          const ap = await pg.evaluate((f) => { const z = document.querySelector(`${f} [data-rg-avant-apres]`); if (!z) return null; const im = [...z.querySelectorAll('img')]; return { n: im.length, avant: im[0] ? im[0].style.filter : '', apres: im[1] ? im[1].style.filter : '' }; }, F);
          dit(ap && ap.n === 2 && /brightness\(1\.1\)/.test(ap.apres) && !/brightness\(1\.1\)/.test(ap.avant), `H6 ${T} avant / après sur la couverture`, ap);
          await pg.dblclick(`${F} [data-main-reglage="bright"]`).catch(() => {}); await pg.waitForTimeout(250);
          await poser('bright', 1.1); await pg.waitForTimeout(150);
          await pg.screenshot({ path: nomF('3-retouche') });
          await pg.dblclick(`${F} [data-main-reglage="bright"]`).catch(() => {}); await pg.waitForTimeout(250);
          dit((await pg.evaluate((f) => (document.querySelector(`${f} [data-rg-valeur="bright"]`) || {}).textContent, F)) === '0 %', `H6 ${T} double-toucher = zéro`);
          const or2 = await orangesDans(pg, F);
          dit(!or2.length, `H4 ${T} aucune couleur orange (retouche ouverte)`, or2);
          await clic(pg, `${F} [data-main-reglages] > summary`, false); await pg.waitForTimeout(200);
          // H2 enregistrer, puis « Suivant » devient LE plein.
          await attendre(pg, (f) => { const x = document.querySelector(`${f} [data-main-telecharger]`); return x && x.getAttribute('data-rg-photos-pretes') === '13' ? 1 : null; }, 90000, F);
          await clic(pg, `${F} [data-rg-pied] [data-main-telecharger]`);
          const ap2 = await attendre(pg, (f) => { const a = document.querySelector(`${f} [data-acc-apres="republier.main"]`); return a ? a.textContent : null; }, 30000, F);
          const suiv = await pg.evaluate((f) => { const s = document.querySelector(`${f} [data-rg-pied] [data-main-suivant]`); return s ? { t: s.textContent.trim(), plein: s.getAttribute('data-n-variante') === 'plein' || /vrm-b-primaire/.test(s.className) } : null; }, F);
          dit(ap2 && /13 photos/.test(ap2) && mots(ap2) <= 8 && suiv && suiv.plein && /Suivant/.test(suiv.t), `H2 ${T} enregistrées : « 13 photos… » (court), puis « Suivant » devient LE plein du pied`, { ap2, suiv });
          if (tel) { const p = await pg.evaluate(() => window.__partages.slice(-1)[0] || null); dit(p && p.noms.length === 13 && p.geste, `H2 ${T} iPhone : UN partage de 13 fichiers, dans le geste`, p && p.noms.length); }
          await pg.screenshot({ path: nomF('4-photos-enregistrees') });
          // Les autres étapes : textes courts, aucun orange.
          for (const k of ['supprimer', 'creer', 'fini']) {
            await clic(pg, `${F} [data-main-aller="${k}"]`, false); await pg.waitForTimeout(300);
            const t = await textesVisibles(pg, F); const lg = (t || []).filter((x) => mots(x) > 8);
            dit(t && !lg.length, `H5 ${T} étape ${k} : chaque texte visible ≤ 8 mots`, lg.slice(0, 3));
            const o = await orangesDans(pg, F); dit(!o.length, `H4 ${T} étape ${k} : aucun orange`, o);
            const ck = await piedCoupe(pg, F); dit(!ck.length, `H10 ${T} étape ${k} : pied, chaque geste sur une ligne`, ck);
            const plk = await pleinsVus(pg, F); dit(plk.length <= 1 && plk.every((x) => x.pied), `H2 ${T} étape ${k} : au plus un plein, dans le pied`, plk);
            await pg.screenshot({ path: nomF(`5-${k}`) });
          }
          const pt = await petitsDans(pg, F);
          if (tel) dit(!pt.length, `H10 ${T} cibles au doigt ≥ 44 px`, pt.join(' | '));
          await clic(pg, `${F} button[aria-label="Fermer"]`, false); await pg.waitForTimeout(300);
          // ── H8 : il manque des photos ⇒ UNE ligne, UN bouton ; la fiche arrive, VRM relit tout seul (aucun « Relire ») ──
          const F5 = await ouvrir(pg, 9106);
          dit(!!F5, `H8 ${T} « À la main » s’ouvre sur l’annonce dont VRM n’a que la vignette`);
          if (F5) {
            const m = await attendre(pg, (f) => { const x = document.querySelector(`${f} [data-rg-photos-manque]`); return x ? { t: x.textContent.trim(), boutons: x.querySelectorAll('a, button').length, ouvrir: !!x.querySelector('[data-rg-ouvrir-annonce]'), relire: !!document.querySelector(`${f} [data-rg-relire-photos]`) } : null; }, 12000, F5);
            dit(m && m.boutons === 1 && m.ouvrir && !m.relire && mots(m.t.replace(/Ouvrir sur Vinted/, '')) <= 8, `H8 ${T} il en manque : une ligne courte et UN bouton « Ouvrir sur Vinted » (plus de « Relire les photos »)`, m);
            const or3 = await orangesDans(pg, F5); dit(!or3.length, `H4 ${T} il en manque : en gris, pas en orange`, or3);
            await pg.screenshot({ path: nomF('6-manque') });
            etat.ficheCinq = true;
            await premierPlan(pg);
            const cinq = await attendre(pg, (f) => { const g = document.querySelector(`${f} [data-main-photos]`); return g && g.getAttribute("data-main-photos") === "5" && !document.querySelector(`${f} [data-rg-photos-manque]`) ? 5 : null; }, 30000, F5);
            dit(cinq === 5, `H8 ${T} de retour dans VRM, sans toucher : les 5 photos sont là`, cinq || await pg.evaluate((f) => { const g = document.querySelector(`${f} [data-main-photos]`); const m = document.querySelector(`${f} [data-rg-photos-manque]`); return { n: g && g.getAttribute('data-main-photos'), manque: m && m.getAttribute('data-rg-photos-manque') }; }, F5));
            await pg.screenshot({ path: nomF('7-manque-relu') });
          }
          const deb = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          dit(deb <= 1, `H10 ${T} aucun débordement horizontal`, deb);
          dit(!errs.length, `H10 ${T} aucune erreur de page`, errs.slice(0, 2).join(' | '));
        } catch (e) { dit(false, `${T} le parcours s’arrête`, e.message.split('\n')[0]); await pg.screenshot({ path: nomF('erreur') }).catch(() => {}); }
        await ctx.close();
      }
    }
  } finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\nKO  ${ko} contrôle(s) rouge(s) — captures : ${SHOTS}` : `\nOK  la feuille « Republier à la main » refaite — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
