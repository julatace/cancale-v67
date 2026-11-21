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
  // Ventes et achats LUS et vides : les vrais états vides (pas « pas su »).
  { id: 'harvest_111_orders_sold', data: { capturedAt: auj.toISOString(), payload: { my_orders: [] } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: auj.toISOString(), payload: { my_orders: [] } } },
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
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1|[^/]*vinted\.net)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) || /^https?:\/\/[^/]*vinted\.net\//i.test(r.request().url()) ? r.abort() : r.continue()));
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

// Mesures génériques : un élément (style calculé), les cibles d'un conteneur, le rouge.
const lire = (pg, quoi) => pg.evaluate(([M, quoi]) => {
  const { px, rgb, rouge, vis } = eval('(' + M + ')')();
  const st = (e) => (e ? getComputedStyle(e) : null);
  const boite = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return { l: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.left), y: Math.round(r.top) }; };
  const opaque = (c) => { const x = rgb(c); return !!x && x.a >= 0.99; };
  const lum = (c) => { const x = rgb(c); return x ? Math.round(0.2126 * x.r + 0.7152 * x.g + 0.0722 * x.b) : -1; };
  const cibles = (racine) => {
    const petits = [];
    for (const e of racine.querySelectorAll('button, [role="button"], a[href], select, summary')) {
      if (!vis(e)) continue; if (e.tagName === 'A' && getComputedStyle(e).display === 'inline') continue;
      const b = e.getBoundingClientRect();
      if (b.height < 43.5 || b.width < 43.5) petits.push(`${e.tagName.toLowerCase()}「${(e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 22)}」${Math.round(b.width)}×${Math.round(b.height)}`);
    }
    return petits;
  };
  const rouges = (racine) => [racine, ...racine.querySelectorAll('*')].filter((e) => vis(e) && !e.closest('[data-num-etat="doublon"]') && (rouge(st(e).color) || rouge(st(e).backgroundColor) || (rouge(st(e).borderTopColor) && px(st(e).borderTopWidth) > 0) || (rouge(st(e).borderLeftColor) && px(st(e).borderLeftWidth) > 0))).map((e) => String(e.className || e.tagName).slice(0, 30)).slice(0, 4);
  const R = {};
  if (quoi === 'atelier') {
    const f = document.querySelector('[data-republier]'); if (!f) return null;
    const voile = f.parentElement, tete = f.firstElementChild, titre = tete && tete.firstElementChild && tete.firstElementChild.firstElementChild;
    const croix = tete && tete.querySelector('button[aria-label="Fermer"]');
    const pied = f.lastElementChild;
    const blocs = [...f.querySelectorAll('[data-republier-photos],[data-republier-description],[data-republier-brouillon],[data-republier-esp],[data-republier-reductions]')].map((e) => (e.matches('[data-republier-reductions]') ? e.parentElement : e)).filter(vis);
    R.portail = voile.parentElement === document.body;
    R.fond = st(f).backgroundColor; R.fondOpaque = opaque(st(f).backgroundColor);
    R.rayon = px(st(f).borderTopLeftRadius); R.rayonBas = px(st(f).borderBottomLeftRadius); R.bas = Math.round(innerHeight - f.getBoundingClientRect().bottom);
    R.titre = titre ? [px(st(titre).fontSize), +st(titre).fontWeight] : null;
    R.croix = boite(croix);
    R.pied = pied ? { opaque: opaque(st(pied).backgroundColor), filet: px(st(pied).borderTopWidth) } : null;
    R.blocs = blocs.map((e) => ({ bord: px(st(e).borderTopWidth), fond: st(e).backgroundColor, ecart: Math.abs(lum(st(e).backgroundColor) - lum(st(f).backgroundColor)), opaque: opaque(st(e).backgroundColor) }));
    R.petits = cibles(f); R.rouges = rouges(f);
    const desac = f.querySelector('.vrm-b-primaire:disabled'); R.desactive = desac ? { fond: st(desac).backgroundColor, opaque: (rgb(st(desac).backgroundColor) || { a: 0 }).a >= 0.1 } : null;
  } else if (quoi === 'actions') {
    const f = document.querySelector('[data-actions-selection]'); if (!f) return null;
    const feuille = f.closest('.vrm-fs'); const cadre = f.closest('[data-feuille-cadre]');
    R.portail = !!cadre && cadre.parentElement === document.body;
    R.fond = st(feuille).backgroundColor;
    R.titre = (() => { const t = feuille.querySelector('.vrm-fs-titre'); return t ? [px(st(t).fontSize), +st(t).fontWeight] : null; })();
    R.croix = boite(feuille.querySelector('[data-feuille-croix]'));
    R.tuiles = [...f.querySelectorAll('.vrm-act-choix')].map((e) => ({ ecart: Math.abs(lum(st(e).backgroundColor) - lum(st(feuille).backgroundColor)), opaque: opaque(st(e).backgroundColor), bord: px(st(e).borderTopWidth), h: Math.round(e.getBoundingClientRect().height) }));
    R.paires = [...f.querySelectorAll('.vrm-act-paire')].map((e) => ({ trait: px(st(e).borderLeftWidth), ecart: Math.abs(lum(st(e).backgroundColor) - lum(st(feuille).backgroundColor)) }));
    R.petits = cibles(feuille); R.rouges = rouges(feuille);
  } else if (quoi === 'confirmation') {
    const feuilles = [...document.querySelectorAll('.vrm-fs')].filter(vis); const feuille = feuilles[feuilles.length - 1]; if (!feuille) return null;
    const cadre = feuille.closest('[data-feuille-cadre]');
    const corps = feuille.querySelector('.vrm-fs-corps');
    const titre = corps.firstElementChild, texte = titre && titre.nextElementSibling;
    const boutons = [...corps.querySelectorAll('.vrm-b')].filter(vis);
    R.portail = !!cadre && cadre.parentElement === document.body; R.z = cadre ? +st(cadre).zIndex : 0;
    R.titre = titre ? [px(st(titre).fontSize), +st(titre).fontWeight] : null;
    R.texte = texte ? [px(st(texte).fontSize), lum(st(texte).color)] : null;
    R.boutons = boutons.map(boite);
    R.boutonsFond = boutons.map((e) => { const x = rgb(st(e).backgroundColor); return !!x && x.a >= 0.1; });
    R.rouges = rouges(feuille);
  } else if (quoi === 'toast') {
    const t = [...document.querySelectorAll('.vrm-toast')].filter(vis).pop(); if (!t) return null;
    const txt = t.querySelector('span:last-child');
    R.rayon = px(st(t).borderTopLeftRadius); R.opaque = opaque(st(t).backgroundColor); R.bord = px(st(t).borderTopWidth);
    R.texte = txt ? px(st(txt).fontSize) : 0; R.h = Math.round(t.getBoundingClientRect().height);
    R.rouges = rouges(t);
  } else if (quoi === 'vide') {
    const v = document.querySelector('[data-ventes-vide], [data-toutes-vide]');
    if (v) { const t = v.querySelector('.vrm-toutes-vide-titre') || v.querySelector('p'); const ps = [t, [...v.querySelectorAll('p')].find((x) => x !== t)]; R.ventes = { centre: st(v).textAlign, titre: ps[0] ? [px(st(ps[0]).fontSize), +st(ps[0]).fontWeight, lum(st(ps[0]).color)] : null, phrase: ps[1] ? [px(st(ps[1]).fontSize), +st(ps[1]).fontWeight, lum(st(ps[1]).color)] : null }; }
    const panne = [...document.querySelectorAll('.vrm-etat-panne:not(.vrm-etat-panne-compact)')].filter(vis)[0];
    const main = document.querySelector('.vrm-main');
    if (panne) R.panne = { opaque: opaque(st(panne).backgroundColor), ecart: Math.abs(lum(st(panne).backgroundColor) - lum(st(document.body).backgroundColor)) };
    const le = document.querySelector('.vrm-erreur-chargement-bouton') || [...document.querySelectorAll('button')].find((e) => /Réessayer/.test(e.innerText) && e.parentElement && /Impossible de charger/.test(e.parentElement.innerText));
    if (le && vis(le)) R.erreurBouton = { bleu: (() => { const x = rgb(st(le).backgroundColor); return !!x && x.a > .5 && x.b > 180 && x.r < 60; })(), h: Math.round(le.getBoundingClientRect().height) };
    R.rouges = main ? rouges(main) : [];
  } else if (quoi === 'barre') {
    const n = document.querySelector('.vrm-tabbar'); if (!n || !vis(n)) return null;
    R.fond = st(n).backgroundColor; R.opaque = opaque(st(n).backgroundColor); R.flou = st(n).backdropFilter || st(n).webkitBackdropFilter || 'none';
    R.filet = px(st(n).borderTopWidth);
    R.entrees = [...n.querySelectorAll(':scope > .vrm-tab, :scope > .vrm-nav-more')].filter(vis).map((e) => { const b = e.getBoundingClientRect(); const l = e.querySelector('.vrm-nav-label'); const ic = e.querySelector('.vrm-tab-ic'); return { l: Math.round(b.width), h: Math.round(b.height), lib: l ? [px(st(l).fontSize), +st(l).fontWeight] : null, actif: e.getAttribute('aria-current') === 'page', ic: ic ? st(ic).color : '' }; });
  }
  return R;
}, [MESURES.toString(), quoi]);
const bleu = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c || ''); if (!m) return false; const [r, g, bb] = m[1].split(/[ ,/]+/).map(Number); return bb > 180 && r < 80 && g > 90 && g < 160; };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  try {
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) for (const sombre of [false, true]) {
      const nomV = `${vp.width}-${sombre ? 'sombre' : 'clair'}`;
      const tel = vp.width < 600;
      console.log(`\n── ${nomV}`);
      // B. La barre du bas (téléphone), sur Colis.
      await essaie(`${nomV} barre`, async () => {
        const { ctx, pg, errs } = await ouvrir(b, vp, sombre, 'cat_bord');
        await cap(pg, `${nomV}-colis`);
        if (tel) {
          const r = await lire(pg, 'barre');
          dit(!!r, `${nomV} B la barre du bas est là`);
          if (r) {
            dit(r.opaque && /none/.test(r.flou), `${nomV} B fond PLEIN, sans flou à travers`, `${r.fond} · ${r.flou}`);
            dit(r.filet > 0 && r.filet <= 1, `${nomV} B un filet fin en haut (≤ 1 px)`, String(r.filet));
            dit(r.entrees.length >= 4 && r.entrees.every((e) => e.l >= 44 && e.h >= 44), `${nomV} B chaque entrée ≥ 44 × 44`, r.entrees.map((e) => e.l + '×' + e.h).join(' '));
            dit(r.entrees.every((e) => e.lib && e.lib[0] === 10), `${nomV} B libellés 10 px (iOS)`, r.entrees.map((e) => e.lib && e.lib.join('/')).join(' '));
            const a = r.entrees.find((e) => e.actif), autres = r.entrees.filter((e) => !e.actif);
            dit(!!a && bleu(a.ic) && autres.every((e) => !bleu(e.ic)), `${nomV} B seule l'icône de l'écran ouvert est bleue`, r.entrees.map((e) => e.ic).join(' '));
          }
        }
        dit(errs.length === 0, `${nomV} aucune erreur de page`, errs.join(' | ').slice(0, 160));
        await ctx.close();
      });
      // F + T + R. Annonces → Sélectionner → Actions (feuille, toast) → Republier (l'atelier, trois étapes).
      await essaie(`${nomV} atelier`, async () => {
        const { ctx, pg } = await ouvrir(b, vp, sombre, 'cat_annonces');
        await pg.locator('[data-actions-ouvrir]').first().click();
        await pg.waitForSelector('[data-selection-vue]', { timeout: 8000 });
        await pg.locator('[data-selection-annonce="9102"] input').check();
        await pg.locator('[data-selection-annonce="9103"] input').check();
        await pg.locator('[data-actions-possibles]').click();
        await pg.waitForSelector('[data-actions-selection]', { timeout: 4000 });
        await pg.waitForTimeout(450);
        await cap(pg, `${nomV}-actions`);
        const a = await lire(pg, 'actions');
        dit(a.portail, `${nomV} F la feuille Actions est un portail sur <body>`);
        dit(a.titre && a.titre[0] === 20 && a.titre[1] >= 700, `${nomV} F titre de feuille 20/700`, JSON.stringify(a.titre));
        dit(a.croix && a.croix.l >= 44 && a.croix.h >= 44, `${nomV} F la croix 44 × 44`, JSON.stringify(a.croix));
        dit(a.tuiles.length === 4 && a.tuiles.every((t) => t.opaque && t.ecart >= 8 && t.bord === 0 && t.h >= 44), `${nomV} F les tuiles se détachent du sol de la feuille (groupe plein, sans cadre, ≥ 44)`, JSON.stringify(a.tuiles));
        dit(a.paires.every((p) => p.trait === 0 && p.ecart >= 8), `${nomV} F « Avant de lancer » : groupes pleins, plus de trait coloré à gauche`, JSON.stringify(a.paires));
        dit(a.rouges.length === 0, `${nomV} F aucun rouge dans la feuille`, a.rouges.join(','));
        // T. Un toast : la tuile « Mettre en ligne », pas permise, dit pourquoi.
        // Un toast vit quelques secondes : on le (re)fait dire juste avant chaque lecture.
        const direToast = async () => { if (await pg.locator('.vrm-toast').count() === 0) await pg.locator('[data-action-sel="enLigne"]').click({ force: true }); await pg.waitForSelector('.vrm-toast', { timeout: 3000 }); };
        await direToast();
        const t = await lire(pg, 'toast');
        await direToast(); await pg.waitForTimeout(300);
        await cap(pg, `${nomV}-toast`);
        await direToast();
        dit(!!t && t.rayon >= 12 && t.rayon <= 16, `${nomV} T toast rayon 12–16 (une carte, pas une pilule)`, t && String(t.rayon));
        dit(!!t && t.opaque && t.bord === 0, `${nomV} T toast fond plein, sans cadre`, t && JSON.stringify(t));
        dit(!!t && t.texte === 15 && t.h >= 44, `${nomV} T toast texte 15, ≥ 44 de haut`, t && `${t.texte} · ${t.h}`);
        dit(!!t && t.rouges.length === 0, `${nomV} T aucun rouge dans un toast`, t && t.rouges.join(','));
        // Le toast d'ÉCHEC (même composant, ton « err », dessiné en ligne comme le fait Toaster) :
        // on lit ce que la feuille de style en fait.
        const err = await pg.evaluate(() => { const t = document.querySelector('.vrm-toast'); t.setAttribute('data-tone', 'err'); const i = t.querySelector('.vrm-toast-icon'); i.style.color = '#C0392B'; t.style.border = '1px solid #C0392B66'; return { c: getComputedStyle(i).color, bd: getComputedStyle(t).borderTopWidth }; });
        dit(!/rgb\(192, 57, 43\)/.test(err.c) && err.bd === '0px', `${nomV} T un toast d'échec n'est jamais rouge (icône, cadre)`, JSON.stringify(err));
        await pg.locator('[data-action-sel="recreer"]').click();
        await pg.locator('[data-republier]').waitFor({ state: 'visible', timeout: 5000 });
        await pg.waitForTimeout(500);
        await cap(pg, `${nomV}-republier-reglages`);
        const r1 = await lire(pg, 'atelier');
        dit(r1.portail, `${nomV} R l'atelier est un portail sur <body> (jamais sous la barre du bas)`);
        dit(r1.fondOpaque && r1.rayon === 20, `${nomV} R fond plein, rayon 20 (la feuille unique)`, `${r1.fond} · ${r1.rayon}`);
        dit(tel ? r1.bas === 0 : (r1.bas > 0 && r1.rayonBas === 20), `${nomV} R ${tel ? 'collée en bas' : 'posée au milieu, quatre coins arrondis'}`, `bas ${r1.bas} · rayon bas ${r1.rayonBas}`);
        dit(r1.titre && r1.titre[0] === 20 && r1.titre[1] >= 700, `${nomV} R titre 20/700`, JSON.stringify(r1.titre));
        dit(r1.croix && r1.croix.l >= 44 && r1.croix.h >= 44, `${nomV} R croix 44 × 44`, JSON.stringify(r1.croix));
        dit(r1.pied && r1.pied.opaque && r1.pied.filet > 0 && r1.pied.filet <= 1, `${nomV} R pied collé : fond plein, filet fin`, JSON.stringify(r1.pied));
        dit(r1.blocs.length >= 4 && r1.blocs.every((x) => x.opaque && x.ecart >= 8 && x.bord === 0), `${nomV} R chaque réglage est un groupe plein sans cadre, détaché du sol`, JSON.stringify(r1.blocs.map((x) => x.ecart + '/' + x.bord)));
        dit(r1.petits.length === 0, `${nomV} R cibles ≥ 44`, r1.petits.join(' · '));
        dit(r1.rouges.length === 0, `${nomV} R aucun rouge`, r1.rouges.join(','));
        // (9 nov.) Un repli de l'atelier garde sa flèche « › » (la règle des replis vivait sous .vrm-main ; le portail l'avait perdue).
        const fl = await pg.evaluate(() => [...document.querySelectorAll('.vrm-atelier-voile details.vrm-repli > summary')].map((s) => parseFloat(getComputedStyle(s, '::after').borderRightWidth) || 0));
        dit(fl.length > 0 && fl.every((w) => w > 0), `${nomV} R chaque repli de l'atelier a sa flèche ›`, JSON.stringify(fl));
        await pg.locator('[data-republier] button', { hasText: /^Retour$/ }).first().click();
        await pg.waitForTimeout(400);
        await cap(pg, `${nomV}-republier-choix`);
        const r2 = await lire(pg, 'atelier');
        dit(r2.petits.length === 0, `${nomV} R (choisir) cibles ≥ 44`, r2.petits.join(' · '));
        await pg.locator('[data-republier-suivant]').click();
        await pg.waitForTimeout(300);
        await pg.locator('[data-republier-suivant]').click();
        await pg.waitForTimeout(400);
        await cap(pg, `${nomV}-republier-lancer`);
        const r3 = await lire(pg, 'atelier');
        dit(r3.petits.length === 0, `${nomV} R (lancer) cibles ≥ 44`, r3.petits.join(' · '));
        dit(!!r3.desactive && r3.desactive.opaque, `${nomV} R « Republier » pas encore permis reste un BOUTON (fond gris visible)`, JSON.stringify(r3.desactive));
        await ctx.close();
      });
      // V. États vides : Ventes (lues, vides), Messages (« pas su »), Achats.
      for (const tab of ['ventes', 'messages', 'achats']) await essaie(`${nomV} vide ${tab}`, async () => {
        const { ctx, pg } = await ouvrir(b, vp, sombre, tab);
        await pg.waitForTimeout(800);
        await cap(pg, `${nomV}-vide-${tab}`);
        const v = await lire(pg, 'vide');
        if (tab === 'ventes') {
          dit(!!v.ventes, `${nomV} V Ventes : l'état vide est là`);
          if (v.ventes) {
            dit(v.ventes.centre === 'center', `${nomV} V centré`, v.ventes.centre);
            dit(v.ventes.titre && v.ventes.titre[0] === 17 && v.ventes.titre[1] === 600, `${nomV} V titre 17/600`, JSON.stringify(v.ventes.titre));
            dit(v.ventes.phrase && v.ventes.phrase[0] === 15 && v.ventes.phrase[1] === 400, `${nomV} V phrase 15/400`, JSON.stringify(v.ventes.phrase));
          }
        }
        if (tab === 'messages') dit(!!v.panne && v.panne.opaque && v.panne.ecart >= 8, `${nomV} V « pas su » : une carte pleine, détachée du fond`, JSON.stringify(v.panne));
        if (v.erreurBouton) dit(!v.erreurBouton.bleu && v.erreurBouton.h >= 44, `${nomV} V « Réessayer » d'une lecture ratée : bouton gris de 44 (jamais le bleu de l'action principale)`, JSON.stringify(v.erreurBouton));
        dit(v.rouges.length === 0, `${nomV} V aucun rouge sur l'écran`, v.rouges.join(','));
        await ctx.close();
      });
      // C. Confirmation : mettre un brouillon en ligne (on n'y répond pas).
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
        const c = await lire(pg, 'confirmation');
        dit(c.portail && c.z >= 20000, `${nomV} C portail au-dessus de toute feuille (Z_CONFIRMATION)`, String(c.z));
        dit(c.titre && c.titre[0] === 17 && c.titre[1] === 600, `${nomV} C question 17/600`, JSON.stringify(c.titre));
        dit(c.texte && c.texte[0] === 15, `${nomV} C conséquence 15`, JSON.stringify(c.texte));
        dit(c.boutons.length === 2 && Math.abs(c.boutons[0].l - c.boutons[1].l) <= 1 && c.boutons.every((x) => x.h >= 44) && c.boutons[0].y === c.boutons[1].y, `${nomV} C deux gestes côte à côte, même taille, ≥ 44`, JSON.stringify(c.boutons));
        dit(c.boutonsFond.every(Boolean), `${nomV} C « Annuler » est un bouton à fond (pas un lien flottant)`, JSON.stringify(c.boutonsFond));
        dit(c.rouges.length === 0, `${nomV} C aucun rouge`, c.rouges.join(','));
        await ctx.close();
      });
    }
  } finally { await b.close(); srv.close(); }
  console.log(`\n${okN} OK · ${ko} KO`);
  process.exit(ko ? 1 : 0);
})();
