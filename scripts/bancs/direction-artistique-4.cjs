// ════════════════════════════════════════════════════════════════════════════
//  BANC « DIRECTION ARTISTIQUE 4 » (9 nov.) — la dernière étape du look :
//  les FEUILLES (l'atelier « Republier » : Annonces → Actions), les
//  CONFIRMATIONS, les TOASTS, les ÉTATS VIDES et la BARRE DU BAS (téléphone).
//
//  Données INVENTÉES (le dépôt est public), un faux pont d'extension (celui de
//  `republier.cjs`) pour que l'atelier ait des paires. 390 px tactile et 1512 px,
//  clair ET sombre. Il juge des VALEURS RENDUES (getComputedStyle, boîtes), jamais
//  un libellé :
//   F  feuille : fond opaque = la carte du thème ; rayon du haut 18 (téléphone,
//      collée en bas) ou 18 partout (ordinateur, centrée) ; titre 17/600 ; la croix
//      44 × 44 ; poignée 36 × 5 ; aucune bordure ; voile ≥ 30 % noir ; portail
//      (enfant direct de <body>) au-dessus de la barre du bas ;
//   R  atelier Republier : chaque bouton ≥ 44 px au doigt ; les blocs de réglage
//      sans bordure (le groupe blanc d'iOS sur le fond groupé de la feuille) ; le
//      pied collé garde un fond opaque ; les rangées de paires 44 de vignette ;
//   C  confirmation : titre 17/600 à l'encre, corps 15 gris, deux boutons de même
//      hauteur ≥ 44 et de MÊME largeur (Annuler | Confirmer), aucun rouge ;
//   T  toast : rayon 14, fond carte opaque, texte 15, aucun rouge (un échec est un
//      geste à refaire : ambre), aucune bordure colorée, ≥ 44 de haut ;
//   V  état vide : centré, titre 17/600 encre, phrase 15 grise ;
//   B  barre du bas : 49 px de contenu + la zone sûre, fond plein (pas de flou à
//      travers), filet 0,5 px en haut, libellés 10/500, icône 24, actif = bleu du
//      thème, autres = gris ; chaque entrée ≥ 44 × 44 ; compteur 18 px tabulaire.
//
//  Captures : SHOTS=<dossier> ; autre build : `node … <dist>` ; `BANC_PORT`.
//  Lancer : npm run build && node scripts/bancs/direction-artistique-4.cjs
// ════════════════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs'), http = require('http');
const RACINE = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(RACINE, 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const DIST = process.argv[2] || path.join(RACINE, 'dist');
const PORT = +(process.env.BANC_PORT || 9744);
const SHOTS = process.env.SHOTS || '';
const MESURER = process.env.MESURER !== '0';

const auj = new Date();
const ann = (id, o) => Object.assign({ id, price: { amount: '49.0', currency_code: 'EUR' }, is_closed: false, is_draft: false, photo: { url: `https://images1.vinted.net/t/b${id % 9}/f800/${id}.jpeg` }, brand_title: 'Nike', size_title: '42', status: 'Très bon état', view_count: 10, favourite_count: 1 }, o);
const ITEMS = [
  ann(9102, { title: 'Salomon XT-6 blanc taille 40', brand_title: 'Salomon', favourite_count: 6, created_at_ts: Math.floor(auj / 1000) - 30 * 86400 }),
  ann(9103, { title: 'Adidas Spezial noir taille 38', brand_title: 'Adidas', favourite_count: 0, created_at_ts: Math.floor(auj / 1000) - 60 * 86400 }),
  ann(9106, { title: 'Nike Dunk low panda taille 41', created_at_ts: Math.floor(auj / 1000) - 5 * 86400 }),
  ann(9107, { title: 'Asics Gel-Kayano 14 argent taille 43', brand_title: 'Asics', favourite_count: 0, created_at_ts: Math.floor(auj / 1000) - 2 * 86400 }),
  ann(9201, { title: 'Nike Air Max 1 dark teal', is_draft: true, price: { amount: '0.0', currency_code: 'EUR' } }),
];
const MAIN = (sombre) => ({ vinted_dark: sombre, vinted_annonce_numeros: { '9102': { numero: '42' }, '9103': { numero: '43' }, '9106': { numero: '45', buyPrice: '47' }, '9107': { numero: '46' } } });
const rowsDe = (sombre) => [
  { id: 'main', data: MAIN(sombre) },
  { id: 'harvest_111_listings', data: { capturedAt: auj.toISOString(), payload: { items: ITEMS, pagination: { total_entries: ITEMS.length } } } },
  { id: 'vinted_brouillon_9201', data: { id: '9201', uid: '111', titre: 'Nike Air Max 1 dark teal', prix: 65, nPhotos: 4, etat: 'brouillon' } },
  { id: 'vinted_item_details', data: { '9102': { photos: ['https://images1.vinted.net/t/b1/f800/1.jpeg', 'https://images1.vinted.net/t/b2/f800/2.jpeg'] } } },
];
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];
const VERSION = (/EXT_ATTENDUE = '([\d.]+)'/.exec(fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8')) || [])[1] || '5.335.0';
// Le faux pont (celui de republier.cjs) : l'extension répond, connectée au compte 111.
const PONT = (o) => {
  const post = (m) => window.postMessage(m, '*');
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version: o.version });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version: o.version, code: o.version, ext: 'banc-ext', vrm: { ok: true, connecte: true, email: '' }, vinted: { uid: '111', login: 'compte_test' }, cmds: {} } });
    if (d.__vmr === 'cmd') post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: false, code: 'banc', raison: 'banc : rien ne part' } });
  });
  post({ __vmr: 'ready', version: o.version });
};
const teintes = ['#d9d4cc', '#c9ced6', '#e2ddd4', '#cfd6cf', '#d8d0d6', '#d3d8de', '#ddd8cc', '#cdd2d8', '#d6d1c8'];
const photoSvg = (k) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${teintes[k % teintes.length]}"/><path d="M70 250 C90 190 150 180 190 200 C230 220 280 205 320 230 C345 245 340 280 300 282 L90 282 C70 282 62 268 70 250 Z" fill="rgba(30,34,40,.55)"/></svg>`;
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg.replace(/^"|"$/g, '')];
    out[alias] = v == null ? null : (src.includes('->>') && typeof v === 'object' ? JSON.stringify(v) : v);
  }
  return out;
};

let ko = 0, okN = 0;
const dit = (c, m, d) => { if (c) okN++; else ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d != null && d !== '' ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e && e.message || e).split('\n')[0].slice(0, 220)); } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);

async function ouvrir(b, vp, sombre, tab) {
  const tel = vp.width < 600;
  const ctx = await b.newContext({ serviceWorkers: 'block', viewport: vp, colorScheme: sombre ? 'dark' : 'light', ...(tel ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vrm_visite_bulles_vue', '1'); localStorage.setItem('vinted_dark', s ? 'true' : 'false'); } catch (_) {} }, sombre);
  await pg.addInitScript(PONT, { version: VERSION });
  await pg.route(/^https?:\/\/[^/]*vinted\.net\//i, (r) => { const m = /\/b(\d+)\//.exec(r.request().url()); return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: photoSvg(m ? Number(m[1]) : 0) }); });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1|[^/]*vinted\.net)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  const rows = rowsDe(sombre);
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data|^data$|^data,/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: auj.toISOString(), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => !document.getElementById('vrm-demarrage') && document.querySelector('.vrm-main'), null, { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(1500);
  return { ctx, pg, errs, tel };
}
const cap = async (pg, nom) => { if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, nom + '.png') }); };

// ── Les mesures, dans la page ────────────────────────────────────────────────
const MESURES = () => {
  const px = (v) => parseFloat(v) || 0;
  const rgb = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c || ''); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  // « Rouge » : teinte entre 340° et 15°, saturée — le rouge du doublon et ses cousins.
  const rouge = (c) => { const x = rgb(c); if (!x || x.a < 0.2) return false; const r = x.r / 255, g = x.g / 255, b = x.b / 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); if (mx - mn < 0.25) return false; let h; if (mx === r) h = ((g - b) / (mx - mn)) % 6; else if (mx === g) h = (b - r) / (mx - mn) + 2; else h = (r - g) / (mx - mn) + 4; h *= 60; if (h < 0) h += 360; return h >= 340 || h <= 15; };
  const vis = (e) => { if (!e) return false; const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; const s = getComputedStyle(e); return s.visibility !== 'hidden' && s.display !== 'none'; };
  return { px, rgb, rouge, vis };
};

async function mesurerFeuille(pg, sel) {
  return pg.evaluate(([s, M]) => {
    const { px, rgb, rouge, vis } = eval('(' + M + ')')();
    const f = [...document.querySelectorAll(s)].filter(vis).pop(); if (!f) return null;
    const cs = getComputedStyle(f), cadre = f.closest('[data-feuille-cadre]');
    const voile = cadre && cadre.querySelector('[data-feuille-voile]');
    const titre = f.querySelector('.vrm-fs-titre'), croix = f.querySelector('[data-feuille-croix]'), poignee = f.querySelector('.vrm-fs-poignee');
    const r = f.getBoundingClientRect();
    const bg = rgb(cs.backgroundColor);
    // Les cibles au doigt : chaque bouton visible de la feuille.
    const petits = [];
    for (const e of f.querySelectorAll('button, [role="button"], a[href], select, input[type="checkbox"], input[type="radio"], summary')) {
      if (!vis(e)) continue; if (e.tagName === 'A' && getComputedStyle(e).display === 'inline') continue;
      if (e.matches('input[type="checkbox"], input[type="radio"]')) { const l = e.closest('label'); if (l && vis(l)) { const b = l.getBoundingClientRect(); if (b.height >= 43.5) continue; } }
      const b = e.getBoundingClientRect();
      if (b.height < 43.5 || b.width < 43.5) petits.push(`${e.tagName.toLowerCase()}「${(e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 24)}」${Math.round(b.width)}×${Math.round(b.height)}`);
    }
    const rouges = [...f.querySelectorAll('*')].filter((e) => vis(e) && !e.closest('[data-num-doublon],[data-doublon]') && (rouge(getComputedStyle(e).color) || rouge(getComputedStyle(e).backgroundColor) || rouge(getComputedStyle(e).borderTopColor) && px(getComputedStyle(e).borderTopWidth) > 0)).map((e) => (e.className && String(e.className).slice(0, 30)) || e.tagName).slice(0, 5);
    return {
      bg: cs.backgroundColor, opaque: !!bg && bg.a >= 0.99,
      rayonHaut: px(cs.borderTopLeftRadius), rayonBas: px(cs.borderBottomLeftRadius),
      bordure: px(cs.borderTopWidth) + px(cs.borderLeftWidth),
      basColle: Math.round(innerHeight - r.bottom), largeur: Math.round(r.width), gauche: Math.round(r.left),
      titre: titre ? { taille: px(getComputedStyle(titre).fontSize), graisse: +getComputedStyle(titre).fontWeight, couleur: getComputedStyle(titre).color } : null,
      croix: croix ? (() => { const b = croix.getBoundingClientRect(); return [Math.round(b.width), Math.round(b.height)]; })() : null,
      poignee: poignee && vis(poignee) ? (() => { const b = poignee.getBoundingClientRect(); return [Math.round(b.width), Math.round(b.height)]; })() : null,
      voileA: voile ? (rgb(getComputedStyle(voile).backgroundColor) || { a: 0 }).a * (+getComputedStyle(voile).opacity) : 0,
      portail: !!cadre && cadre.parentElement === document.body,
      zCadre: cadre ? +getComputedStyle(cadre).zIndex : 0,
      petits, rouges,
    };
  }, [sel, MESURES.toString()]);
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  try {
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) for (const sombre of [false, true]) {
      const nomV = `${vp.width}-${sombre ? 'sombre' : 'clair'}`;
      console.log(`\n── ${nomV}`);
      // 1. Barre du bas + état vide (Colis : rien à envoyer sur cette base).
      await essaie(`${nomV} barre et vide`, async () => {
        const { ctx, pg, errs, tel } = await ouvrir(b, vp, sombre, 'cat_bord');
        await cap(pg, `${nomV}-colis-vide`);
        await ctx.close();
      });
      // 2. Annonces → Sélectionner → Actions → Republier (l'atelier, trois étapes).
      await essaie(`${nomV} atelier`, async () => {
        const { ctx, pg, errs, tel } = await ouvrir(b, vp, sombre, 'cat_annonces');
        await cap(pg, `${nomV}-annonces`);
        await pg.locator('[data-actions-ouvrir]').first().click();
        await pg.waitForSelector('[data-selection-vue]', { timeout: 8000 });
        await pg.locator('[data-selection-annonce="9102"] input').check();
        await pg.locator('[data-selection-annonce="9103"] input').check();
        await pg.locator('[data-actions-possibles]').click();
        await pg.waitForSelector('[data-actions-selection]', { timeout: 4000 });
        await pg.waitForTimeout(450);
        await cap(pg, `${nomV}-actions`);
        await pg.locator('[data-action-sel="recreer"]').click();
        await pg.locator('[data-republier]').waitFor({ state: 'visible', timeout: 5000 });
        await pg.waitForTimeout(500);
        await cap(pg, `${nomV}-republier-reglages`);
        await pg.locator('[data-republier] button', { hasText: /^Retour$/ }).first().click().catch(() => {});
        await pg.waitForTimeout(400);
        await cap(pg, `${nomV}-republier-choix`);
        await pg.locator('[data-republier-suivant]').click().catch(() => {});
        await pg.waitForTimeout(300);
        await pg.locator('[data-republier-suivant]').click().catch(() => {});
        await pg.waitForTimeout(400);
        await cap(pg, `${nomV}-republier-lancer`);
        await ctx.close();
      });
      // 2 bis. États vides : Ventes, Achats, Messages (rien sur cette base).
      for (const tab of ['ventes', 'achats', 'messages', 'garage']) await essaie(`${nomV} vide ${tab}`, async () => {
        const { ctx, pg } = await ouvrir(b, vp, sombre, tab);
        await pg.waitForTimeout(800);
        await cap(pg, `${nomV}-vide-${tab}`);
        if (process.env.SONDE) console.log(tab, await pg.evaluate(() => [...document.querySelectorAll('[class*="vide"],[class*="empty"],[data-etat-panne]')].filter((e) => e.getBoundingClientRect().height > 0).map((e) => e.className + ' ' + Math.round(e.getBoundingClientRect().height)).slice(0, 8)));
        await ctx.close();
      });
      // 3. Confirmation : mettre un brouillon en ligne (on n'y répond pas).
      await essaie(`${nomV} confirmation`, async () => {
        const { ctx, pg } = await ouvrir(b, vp, sombre, 'cat_annonces');
        await pg.locator('[data-actions-ouvrir]').first().click();
        await pg.waitForSelector('[data-selection-vue]', { timeout: 8000 });
        await pg.locator('[data-vue-brouillons]').first().click();
        await pg.waitForSelector('[data-selection-vue="brouillon"]', { timeout: 6000 });
        await pg.locator('[data-brouillons-detail]').first().click();
        await pg.locator('[data-brouillon="9201"] [data-brouillon-publier]').click();
        await pg.waitForTimeout(500);
        await cap(pg, `${nomV}-confirmation`);
        await ctx.close();
      });
    }
  } finally { await b.close(); srv.close(); }
  console.log(`\n${okN} OK · ${ko} KO`);
  process.exit(ko ? 1 : 0);
})();
