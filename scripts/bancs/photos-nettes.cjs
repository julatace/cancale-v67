require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « PHOTOS NETTES » (23 nov., lot photos-nettes)
//
//  Julien (capture iPhone) : « toutes les photos sont floues » — en plein écran, la
//  photo d'un achat était la vignette 150x210 de « Mes achats » agrandie.
//  Règle (src/photoTaille.js) : chaque affichage prend, parmi les adresses DÉJÀ LUES du
//  même fichier, la plus petite qui donne ≥ 2 px réels par point affiché ; la visionneuse
//  la plus grande connue, chargée APRÈS la petite (progressif). Aucune adresse fabriquée.
//
//  Données INVENTÉES (dépôt public). Le CDN Vinted est SIMULÉ par le banc (une image SVG
//  dont la largeur est celle du répertoire de taille de l'adresse : 150x210 ⇒ 150 px,
//  f800 ⇒ 800, /tc/ ⇒ 1200) ; chaque taille a sa propre signature `?s=` (comme chez
//  Vinted) et une adresse jamais donnée par la base répond 403 (fabriquer est puni).
//  390 px tactile, deviceScaleFactor 3 :
//   N1 Achats : la vignette touchée (150x210, seule adresse de « Mes achats ») s'ouvre
//      en grand et, le détail de la transaction connaissant la f800 du même fichier,
//      l'image chargée a une largeur naturelle ≥ 2 × sa largeur affichée ;
//   N2 la visionneuse montre d'abord la petite (jamais un trou) : au moment où elle
//      s'ouvre, une image est déjà là ;
//   N3 Annonces (liste, 52 pt) : chaque photo a ≥ 2 px réels par point ; une vignette à qui
//      150 suffit ne télécharge pas la pleine taille (la plus petite qui suffit) ;
//   N4 aucune adresse Vinted demandée qui ne soit pas dans la base (rien de fabriqué) ;
//   N5 une photo sans plus grande taille connue reste la sienne (aucune erreur, chargée).
//  `SHOTS=dossier` range les captures (à REGARDER, §6.2). `BANC_DIST`, `BANC_PORT`.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), http = require('http'), fs = require('fs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const { servir } = require('./_minipgrest.cjs');
const DIST = process.env.BANC_DIST || process.argv[2] || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || (4000 + Math.floor(Math.random() * 4000));
const SHOTS = process.env.SHOTS || '';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const MAINTENANT = Date.now();
const iso = (j) => new Date(MAINTENANT - j * 86400000).toISOString();

let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) ok++; else ko++; console.log(`${bon ? '  ✅ ' : '  ❌ '}${quoi}${!bon && det ? ' — ' + String(det).slice(0, 300) : ''}`); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e && e.message || e).split('\n')[0]); } };

// ── Le CDN simulé : chaque (fichier, taille) a SA signature, comme chez Vinted ─────
const SIG = (seg, taille) => [...(seg + '|' + taille)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7).toString(16);
const VT = (seg, taille, fichier = '1785591495.webp') => taille === 'tc'
  ? `https://images1.vinted.net/tc/${seg}/${fichier}?s=${SIG(seg, 'tc')}`
  : `https://images1.vinted.net/t/${seg}/${taille}/${fichier}?s=${SIG(seg, taille)}`;
const LARG = (taille) => taille === 'tc' ? 1200 : /^f(\d+)$/.test(taille) ? Number(taille.slice(1)) : Number(taille.split('x')[0]);
const thumbs = (seg) => ['70x100', '150x210', '310x430'].map((t) => ({ url: VT(seg, t), type: 'thumb' + t, width: LARG(t), height: Math.round(LARG(t) * 1.39) }))
  .concat([{ url: VT(seg, 'f800'), type: 'thumb428x624', width: 321, height: 428, original_size: true }]);
const photoObj = (seg) => ({ id: 1, url: VT(seg, 'f800'), full_size_url: VT(seg, 'tc'), thumbnails: thumbs(seg) });

const SEG_ACHAT = '05_00a97_BancAchat01', SEG_ACHAT2 = '05_00a97_BancAchatSeul', SEG_ANN = '02_015b3_BancAnnonce1';
const ACHATS = [
  { transaction_id: 73000, conversation_id: 84000, title: 'Jordan 1 Mid chicago taille 42', price: { amount: '45', currency_code: 'EUR' }, status: 'Le vendeur a expédié la commande', transaction_user_status: 'waiting', date: iso(1), photo: { url: VT(SEG_ACHAT, '150x210') } },
  { transaction_id: 73001, conversation_id: 84001, title: 'Salomon XT-6 grise taille 43', price: { amount: '52', currency_code: 'EUR' }, status: 'Commande finalisée', transaction_user_status: 'completed', date: iso(9), photo: { url: VT(SEG_ACHAT2, '150x210') } },
];
const LISTINGS = [{ id: 51000, title: 'Nike Air Max 90 blanche taille 41', price: { amount: '65.0', currency_code: 'EUR' }, is_closed: false, is_draft: false, is_hidden: false,
  photo: { url: VT(SEG_ANN, '150x210') }, photos: [photoObj(SEG_ANN)], brand_title: 'Nike', size_title: '41', status: 'Très bon état', view_count: 3, favourite_count: 1, created_at_ts: Math.floor((MAINTENANT - 86400000) / 1000) }];
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'vendeuse_a', domain: 'www.vinted.fr', updated_at: iso(0), created_at: iso(30) }];
const base = () => [
  { id: 'main', data: { vrm_bienvenue_vue: { at: iso(0) }, vrm_visite_vue: { at: iso(0) }, vinted_annonce_numeros: { 51000: { numero: '1' } } } },
  { id: 'harvest_111_listings', data: { capturedAt: iso(0.01), payload: { items: LISTINGS } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: iso(0.01), payload: { my_orders: [] } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: iso(0.01), payload: { my_orders: ACHATS } } },
  // Le détail de la transaction du 1er achat (forme MESURÉE le 23 nov. : order.items[].photos[] f800 + thumbnails).
  { id: 'harvest_111_txn_73000', meta: { id: '73000' }, data: { capturedAt: iso(0.5), payload: { transaction: { id: 73000, user_side: 'buyer', items_count: 1, seller: { login: 'vendeur_b' },
    order: { items: [{ id: 99001, title: ACHATS[0].title, size_title: '42', status: 'Très bon état', photos: [photoObj(SEG_ACHAT)] }] } } } } },
];
const CONNUES = new Set();
(function recense(v) { if (typeof v === 'string') { if (/vinted\.net/.test(v)) CONNUES.add(v); } else if (v && typeof v === 'object') Object.values(v).forEach(recense); })(base());

const svg = (w, nom) => { const h = Math.round(w * 1.4); return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#3a6ea5"/><circle cx="${w / 2}" cy="${h / 2}" r="${w / 3}" fill="rgba(255,255,255,.25)"/><text x="${w / 2}" y="${h / 2 + w / 16}" font-family="sans-serif" font-size="${Math.max(8, w / 6)}" font-weight="700" text-anchor="middle" fill="#fff">${nom}</text></svg>`; };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0];
  if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!p.startsWith(DIST) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — BANC_PORT=…'); process.exit(1); });

async function ouvrir(nav, tab, grille = false) {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3, colorScheme: 'light', locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  const pg = await ctx.newPage();
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(String(e.message || e).slice(0, 200)));
  await pg.addInitScript(() => { try { if (!sessionStorage.getItem('banc_init')) { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', 'false'); sessionStorage.setItem('banc_init', '1'); } } catch (_) {} });
  if (grille) await pg.addInitScript(() => { try { localStorage.setItem('vrm_paires_vue', 'grille'); } catch (_) {} });
  const lignes = base();
  const etat = { cdn: [], inventees: [] };
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
  await pg.route(/^https:\/\/images1\.vinted\.net\//, (route) => {
    const u = route.request().url(); etat.cdn.push(u);
    if (!CONNUES.has(u)) { etat.inventees.push(u); return route.fulfill({ status: 403, body: '' }); }
    const m = /\/t\/[^/]+\/([^/]+)\//.exec(u); const taille = /\/tc\//.test(u) ? 'tc' : m ? m[1] : '150x210';
    return route.fulfill({ status: 200, contentType: 'image/svg+xml', headers: { 'access-control-allow-origin': '*', 'cache-control': 'max-age=3600' }, body: svg(LARG(taille), taille) });
  });
  await pg.route('**/rest/v1/**', async (route) => {
    const req = route.request(), m = req.method(); const u = decodeURIComponent(metaVersData(req.url()));
    const json = (d, st = 200, rg) => route.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': rg || `0-${Math.max(0, (Array.isArray(d) ? d.length : 1) - 1)}/${Array.isArray(d) ? d.length : 1}` }, body: JSON.stringify(d) });
    if (/\/rest\/v1\/rpc\//.test(u)) return json(null);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return json(m === 'GET' ? ACCOUNTS : []);
    if (!/\/rest\/v1\/app_data/.test(u) || m !== 'GET') return json([], m === 'GET' ? 200 : 201);
    const r = servir(lignes.map((l) => ({ updated_at: iso(0), ...l })), u, req.headers()); return json(r.body, 200, r.range);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('.vrm-main', { timeout: 60000 }).catch(() => {});
  await pg.waitForTimeout(2500);
  return { ctx, pg, erreurs, etat };
}
const capture = async (pg, nom) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, nom + '.png') }); };
// La netteté d'une image : largeur naturelle / largeur réellement occupée à l'écran (contenue ou rognée).
const NETTETE = `(img) => { const r = img.getBoundingClientRect(); const fit = getComputedStyle(img).objectFit; const nw = img.naturalWidth, nh = img.naturalHeight; if (!(nw > 0) || !(r.width > 0)) return null;
  const k = fit === 'contain' ? Math.min(r.width / nw, r.height / nh) : fit === 'cover' ? Math.max(r.width / nw, r.height / nh) : r.width / nw;
  return { nw, affichee: Math.round(nw * k), rapport: Math.round(100 / k) / 100, src: img.currentSrc || img.src }; }`;

async function toucherSegment(pg, seg) {
  await pg.waitForFunction((seg) => [...document.querySelectorAll('.vrm-main img[data-vrm-vignette]')].some((i) => (i.getAttribute('data-photo-origine') || i.getAttribute('src') || '').includes(seg) && i.naturalWidth > 0), seg, { timeout: 60000 }).catch(() => {});
  for (let essai = 0; essai < 10; essai++) {
    const pos = await pg.evaluate(async (seg) => {
      const img = [...document.querySelectorAll('.vrm-main img[data-vrm-vignette]')].find((i) => (i.getAttribute('data-photo-origine') || i.getAttribute('src') || '').includes(seg) && i.getBoundingClientRect().width >= 32);
      if (!img) return null;
      img.scrollIntoView({ block: 'center' }); await new Promise((o) => setTimeout(o, 700));
      const r = img.getBoundingClientRect(); const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, charge: img.naturalWidth > 0, libre: !!(at && (at === img || img.contains(at))) };
    }, seg);
    if (!pos) return null;
    if (!pos.libre || !pos.charge) { await pg.waitForTimeout(600); continue; }
    await pg.touchscreen.tap(pos.x, pos.y);
    await pg.waitForTimeout(300);
    if (await pg.$('[data-visionneuse]')) return pos;
  }
  return { charge: true, ouverte: false };
}
const imgVisionneuse = (pg) => pg.evaluate(`(() => { const f = ${NETTETE}; const i = document.querySelector('[data-visionneuse] img[data-visionneuse-img]'); return i ? f(i) : (document.querySelector('[data-visionneuse]') ? 'sans-image' : null); })()`);

(async () => {
  await new Promise((ok) => srv.listen(PORT, ok));
  const nav = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  try {
    await essaie('N1/N2 Achats', async () => {
      const { ctx, pg, erreurs, etat } = await ouvrir(nav, 'cat_achats&vue=achats');
      const t = await toucherSegment(pg, SEG_ACHAT);
      dit(!!t && t.charge, 'N1 Achats : la vignette 150x210 de l’achat est à l’écran, chargée');
      if (!t) { await capture(pg, 'N1-achats-sans-vignette'); await ctx.close(); return; }
      const tot = await imgVisionneuse(pg);
      dit(tot && tot !== 'sans-image', 'N2 la visionneuse montre une image dès l’ouverture (la petite d’abord, jamais un trou)', JSON.stringify(tot));
      await pg.waitForTimeout(2500);
      const v = await imgVisionneuse(pg);
      await capture(pg, 'N1-visionneuse-achat-390x3');
      dit(v && v.rapport >= 2, `N1 plein écran : largeur naturelle ≥ 2 × la largeur affichée (${v && v.nw} px pour ${v && v.affichee} pt, ×${v && v.rapport})`, JSON.stringify(v));
      dit(!etat.inventees.length, `N4 aucune adresse Vinted fabriquée (${etat.cdn.length} demandées, toutes lues dans la base)`, etat.inventees.join(' | '));
      // (préexistant sur main, mesuré avec le banc sur l'arbre d'avant : pas de ce lot) l'accès au localStorage refusé d'un document.
      const neuves = erreurs.filter((e) => !/localStorage' property from 'Window': Access is denied/.test(e));
      dit(!neuves.length, 'Achats : aucune erreur nouvelle', neuves.join(' | '));
      await ctx.close();
    });
    await essaie('N5 Achat sans grande taille', async () => {
      const { ctx, pg, etat } = await ouvrir(nav, 'cat_achats&vue=achats');
      const t2 = await toucherSegment(pg, SEG_ACHAT2);
      await pg.waitForTimeout(2500);
      const v2 = t2 ? await imgVisionneuse(pg) : null;
      dit(v2 && v2.nw === 150 && /150x210/.test(v2.src), 'N5 un achat sans plus grande taille connue garde sa photo (chargée, rien d’inventé)', JSON.stringify(v2));
      dit(!etat.inventees.length, 'N4 (N5) aucune adresse Vinted fabriquée', etat.inventees.join(' | '));
      await ctx.close();
    });
    await essaie('N3 Annonces', async () => {
      const { ctx, pg, erreurs, etat } = await ouvrir(nav, 'cat_annonces', true);
      await pg.waitForFunction(() => [...document.querySelectorAll('.vrm-main img[data-vrm-vignette]')].some((i) => i.getBoundingClientRect().width >= 32 && i.naturalWidth > 0), null, { timeout: 60000 }).catch(() => {});
      await pg.waitForTimeout(3000);
      const L = await pg.evaluate(`(() => { const f = ${NETTETE}; return [...document.querySelectorAll('.vrm-main img[data-vrm-vignette]')].filter((i) => i.getBoundingClientRect().width >= 32 && /vinted\\.net/.test(i.getAttribute('data-photo-origine') || i.getAttribute('src') || '')).map(f).filter(Boolean); })()`);
      await capture(pg, 'N3-annonces-390x3');
      dit(L.length > 0, `N3 Annonces : ${L.length} photo(s) de carte Vinted à l’écran`);
      const flous = L.filter((x) => x.rapport < 2);
      dit(L.length > 0 && !flous.length && L.every((x) => x.affichee * 2 > 150 || /150x210/.test(x.src)), `N3 chaque photo d’annonce a ≥ 2 px réels par point, sans pleine taille inutile (une vignette de liste qui a assez de 150 la garde) (${L.map((x) => `${x.nw}/${x.affichee}`).join(', ')})`, JSON.stringify(flous));
      dit(!etat.inventees.length, 'N4 Annonces : aucune adresse Vinted fabriquée', etat.inventees.join(' | '));
      dit(!erreurs.length, 'Annonces : aucune erreur', erreurs.join(' | '));
      await ctx.close();
    });
  } finally { await nav.close(); srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} photos-nettes : ${ok} bon(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
