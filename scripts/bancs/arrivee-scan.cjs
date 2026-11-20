require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « L'ARRIVÉE D'UN ACHAT » (20 nov., lot arrivee-scan) — src/ArriveeAchat.jsx, src/arriveeAchat.js
//  Julien : « tu scannes le code-barres de l'étiquette du colis reçu, la paire est reconnue par son n° de suivi, l'app
//  lui donne son N°, te dit dans quelle case la ranger, et imprime l'étiquette si tu imprimes les tiennes » ; précision :
//  « l'app sait déjà quel article est arrivé » ⇒ la porte principale est « J'ai retiré », le scan un raccourci.
//
//  L'app BÂTIE, base INVENTÉE de la forme réelle (commandes `orders_purchased`, suivis `harvest_{uid}_suivi_{tx}`,
//  transaction `harvest_{uid}_txn_{tx}`, `panel_colis_relais`, `main` : meubles, cases, pool) :
//   P  la PORTE : « J'ai retiré » d'un colis à retirer ⇒ l'écran d'arrivée de CET achat, N°13 (après 12, jamais le trou
//      5), la première case LIBRE qui respire, RIEN d'écrit ; « Ranger ici » ⇒ fiche liée à l'achat, case, N° au pool,
//      un seul geste « Annuler » ; « Déjà rangé » si on y revient (jamais deux fois) ;
//   S  le SCAN (caméra SIMULÉE : un QR Mondial Relay dessiné dans le flux vidéo, lu par le vrai lecteur WebAssembly) :
//      50 achats IDENTIQUES ⇒ celui du n° visé ; « Ranger ici » note aussi le colis retiré (même clé que « J'ai retiré ») ;
//   Q  n° tapé : inconnu ⇒ « Aucun achat » ; deux achats au même n° ⇒ la liste, SON toucher choisit ;
//   L  un lot (3 articles dans SA transaction) ⇒ « Contient 3 paires », N°13·14·15, trois cases différentes ;
//   H  hors ligne : l'achat reconnu (données en cache), « Le N° attend le réseau », « Noter l'arrivée » ;
//   V  base VIDE (aucun achat, aucun meuble) : n° tapé ⇒ « Aucun achat », rien ne casse.
//  Partout : un seul plein, cibles ≥ 44 px (tactile), rien ne déborde, aucune clé brute, aucune erreur. Vues : 390
//  tactile clair/sombre, 1512 clair/sombre (VUES=…). Captures : SHOTS=<dossier>. Un autre build : BANC_DIST=<dist>.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), http = require('http');
const RACINE = path.join(__dirname, '..', '..');
const { lancer } = require('./_navigateur.cjs');
const { metaVersData, metaDe, filtreData } = require('./_meta.cjs');
let PW; try { PW = require(path.join(RACINE, 'node_modules', 'playwright')); } catch (_) { PW = require('playwright'); }
const qrcode = require(path.join(RACINE, 'node_modules', 'qrcode-generator'));
const DIST = process.env.BANC_DIST ? path.resolve(process.env.BANC_DIST) : path.join(RACINE, 'dist');
const PORT = Number(process.env.BANC_PORT || (20000 + Math.floor(Math.random() * 20000)));
const SHOTS = process.env.SHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const MS = Date.now(), J = 864e5;
const iso = (t) => new Date(t).toISOString();
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d !== undefined && !c ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 400) : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 220)); } };

// ── Les données (INVENTÉES, forme réelle) ──
const UID = '111';
const TITRE = 'Nike Dunk Low panda';
const url = (k) => `https://images1.vinted.net/t/b${k}/f800/x${k}.jpeg?s=x`;
const mr = (k) => String(41000000 + k * 7);
const commande = (tx, titre, prix, k, extra = {}) => ({ transaction_id: tx, conversation_id: 77000 + k, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, status: 'Colis déposé en point relais', transaction_user_status: 'needs_action', date: iso(MS - (2 + k % 5) * J), photo: { url: url(k + 1) }, ...extra });
const txnRow = (tx, items) => ({ id: `harvest_${UID}_txn_${tx}`, data: { payload: { transaction: { id: tx, user_side: 'buyer', seller: { login: `vendeur_${tx}` }, items_count: items.length,
  order: { items: items.map((t, i) => ({ title: t, size_title: String(40 + i), status: 'Très bon état', price: { amount: '40', currency_code: 'EUR' }, photos: [{ url: url(60 + i) }] })) } } } } });
const suiviRow = (tx, n) => ({ id: `harvest_${UID}_suivi_${tx}`, data: { tx: String(tx), suivi: n, transporteur: 'MONDIAL', capturedAt: iso(MS - 3600e3) } });
const PORTE_TX = 9300, SCAN_RETIRER_TX = 9423, LOT_TX = 9480, LOT_SUIVI = '43217890', DOUBLE = '48880000';
const MEUBLES = [{ id: 'mA', name: 'Étagère A', cols: 3, rows: 2 }, { id: 'mB', name: 'Armoire B', cols: 4, rows: 3 }];
const SLOTS = { B230: { m: 'mA', i: 0 }, 7: { m: 'mA', i: 1 } };
const POOL = [1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12];   // le 5 manque : un trou n'est JAMAIS redonné
function base(vide = false) {
  if (vide) return [{ id: 'main', data: { vinted_pickup_done: {}, vrm_colis_collected: [], vrm_colis_collected_at: {}, vrm_meubles: [], vrm_slots: {}, vinted_used_numeros: [] } },
    { id: `harvest_${UID}_orders_purchased`, data: { capturedAt: iso(MS), payload: { my_orders: [] } } }, { id: `harvest_${UID}_orders_sold`, data: { capturedAt: iso(MS), payload: { my_orders: [] } } }];
  const A = [], R = [];
  A.push(commande(PORTE_TX, 'Nike Air Max 90 blanche taille 43', 38, 99)); R.push(txnRow(PORTE_TX, ['Nike Air Max 90 blanche taille 43']));
  for (let k = 0; k < 50; k++) { const tx = 9400 + k; A.push(commande(tx, TITRE, 40 + k, k)); R.push(suiviRow(tx, mr(k)), txnRow(tx, [TITRE])); }
  A.push(commande(LOT_TX, 'Lot 3 paires', 120, 80, { items_count: 3 })); R.push(suiviRow(LOT_TX, LOT_SUIVI), txnRow(LOT_TX, ['Adidas Samba noire', 'New Balance 530 grise', 'Asics Gel 1130']));
  for (const tx of [9490, 9491]) { A.push(commande(tx, 'Converse Chuck 70 crème', 55, tx - 9400)); R.push(suiviRow(tx, DOUBLE), txnRow(tx, ['Converse Chuck 70 crème'])); }
  const relais = { [String(PORTE_TX)]: { code: '012345', lieu: 'Relais exemple, 35000 Exempleville', transporteur: 'mondialrelay', at: iso(MS) },
    [String(SCAN_RETIRER_TX)]: { code: '054321', lieu: 'Tabac de la gare, 22000 Autreville', transporteur: 'mondialrelay', at: iso(MS) } };
  return [{ id: 'main', data: { vinted_pickup_done: {}, vrm_colis_collected: [], vrm_colis_collected_at: {}, vrm_meubles: MEUBLES, vrm_slots: SLOTS, vinted_used_numeros: POOL } },
    { id: 'panel_colis_relais', data: relais }, { id: 'panel_num_reserves', data: {} },
    { id: `harvest_${UID}_orders_purchased`, data: { capturedAt: iso(MS), payload: { my_orders: A } } },
    { id: `harvest_${UID}_orders_sold`, data: { capturedAt: iso(MS), payload: { my_orders: [] } } }, ...R];
}
const ACCOUNTS = [{ id: 1, vinted_user_id: UID, login: 'compte_banc', domain: 'www.vinted.fr', updated_at: iso(MS) }];
// Le QR Mondial Relay d'une étiquette (forme mesurée : `exp=` porte le n° à 8 chiffres).
const matriceQr = (n) => { const q = qrcode(0, 'M'); q.addData(`https://www.mondialrelay.com/public/permanent/tracking.aspx?ens=MRVINTED&exp=${n}&language=FR&CodePostal=35260`); q.make(); const t = q.getModuleCount(); const m = []; for (let r = 0; r < t; r++) { const l = []; for (let c = 0; c < t; c++) l.push(q.isDark(r, c) ? 1 : 0); m.push(l); } return m; };

// ── Le serveur de l'app ──
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.wasm': 'application/wasm' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!p.startsWith(DIST) || !fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
const projette = (row, sel) => {
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'meta') { out[alias] = metaDe(row.data); continue; }
    if (src === 'updated_at') { out[alias] = iso(MS); continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[/^\d+$/.test(seg) && Array.isArray(v) ? Number(seg) : seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' ? (typeof v === 'object' ? JSON.stringify(v) : String(v)) : v);
  }
  return out;
};
const photoSvg = (k) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#dfe3e8"/><text x="200" y="230" font-size="120" text-anchor="middle" fill="rgba(0,0,0,.4)" font-family="sans-serif">${k}</text></svg>`;

async function ouvrir(b, vp, sombre, lignes, { camera = false, onglet = 'achats' } = {}) {
  const tactile = vp.width < 600;
  const ctx = await b.newContext({ viewport: vp, locale: 'fr-FR', timezoneId: 'Europe/Paris', colorScheme: sombre ? 'dark' : 'light', ...(tactile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(({ s, cam }) => {
    try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s)); localStorage.setItem('vrm_visite_vue', JSON.stringify(true)); localStorage.setItem('vrm_conseils_appareil', JSON.stringify({ coupe: true })); } catch (_) {}
    const md = navigator.mediaDevices;
    if (!md) return;
    if (!cam) { md.getUserMedia = async () => { throw new DOMException('Permission refusée', 'NotAllowedError'); }; return; }
    // LA CAMÉRA SIMULÉE : une étiquette blanche sur une table ; `__viser(matrice)` y dessine le QR de l'étiquette.
    window.__qr = null;
    md.getUserMedia = async () => {
      const c = document.createElement('canvas'); c.width = 640; c.height = 480;
      const x = c.getContext('2d');
      const dessiner = () => {
        x.fillStyle = '#6b5a48'; x.fillRect(0, 0, 640, 480);
        x.fillStyle = '#fff'; x.fillRect(150, 110, 340, 260);
        const m = window.__qr;
        if (m) { const t = m.length, k = Math.floor(200 / (t + 8)), o = Math.round(320 - (k * t) / 2), oy = Math.round(240 - (k * t) / 2); x.fillStyle = '#000';
          for (let r = 0; r < t; r++) for (let q = 0; q < t; q++) if (m[r][q]) x.fillRect(o + q * k, oy + r * k, k, k); }
        requestAnimationFrame(dessiner);
      };
      dessiner();
      return c.captureStream(15);
    };
    window.__viser = (m) => { window.__qr = m; };
  }, { s: !!sombre, cam: !!camera });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    const m = /images1\.vinted\.net\/t\/b(\d+)\//.exec(u);
    if (m) return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: photoSvg(Number(m[1])) });
    if (/\/rest\/v1\//.test(u)) return r.fallback();
    return r.abort();
  });
  await pg.route('**/rest/v1/**', async (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const H = { 'access-control-allow-origin': '*' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { ...H, 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (req.method() !== 'GET') {
      // Les écritures de l'app sont GARDÉES (une relecture du nuage rend ce qu'elle a écrit, comme la vraie base).
      if (/\/rest\/v1\/app_data/.test(u) && req.method() === 'POST') {
        try { const bd = JSON.parse(req.postData() || '[]'); for (const r of (Array.isArray(bd) ? bd : [bd])) { if (!r || !r.id || !r.data) continue; if (process.env.DEBUG_POST) console.log('     POST ' + r.id + ' slots=' + JSON.stringify(r.data.vrm_slots || null).slice(0, 160) + ' keys=' + Object.keys(r.data).slice(0, 8).join(',')); const i = lignes.findIndex((x) => x.id === r.id);
          if (i >= 0) lignes[i] = { id: r.id, data: r.id === 'main' ? { ...lignes[i].data, ...r.data } : r.data }; else lignes.push({ id: r.id, data: r.data }); } } catch (_) {}
      }
      // Un PATCH de `main` (comparer-et-échanger sur `rev`) : la nouvelle donnée est gardée, la ligne rendue (« écrit »).
      if (/\/rest\/v1\/app_data/.test(u) && req.method() === 'PATCH') {
        const eqP = /[?&]id=eq\.([^&]*)/.exec(u);
        try { const bd = JSON.parse(req.postData() || '{}'); const i = eqP ? lignes.findIndex((x) => x.id === eqP[1]) : -1;
          if (i >= 0 && bd && bd.data) { lignes[i] = { id: lignes[i].id, data: bd.data }; return route.fulfill({ status: 200, contentType: 'application/json', headers: H, body: JSON.stringify([{ id: lignes[i].id }]) }); } } catch (_) {}
      }
      return route.fulfill({ status: 201, contentType: 'application/json', headers: H, body: '[]' });
    }
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { ...H, 'access-control-expose-headers': 'content-range', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: H, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    if (!/\/rest\/v1\/app_data/.test(u)) return j([]);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || '';
    const forme = (r) => (sel && sel !== '*' && !/^id,data/.test(sel) && sel !== 'data,updated_at,cap:data->>capturedAt') ? projette(r, sel) : ({ ...r, updated_at: iso(MS), cap: r.data && r.data.capturedAt });
    const inn = /[?&]id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(',').map((x) => x.replace(/^"|"$/g, '')); return j(lignes.filter((r) => ids.includes(r.id)).map(forme)); }
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq) return j(lignes.filter((r) => r.id === eq[1]).map(forme));
    const lk = /[?&]id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(lignes.filter((r) => re.test(r.id) && filtreData(u)(r)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=${onglet}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs, tactile };
}

const lireLocal = (pg) => pg.evaluate(() => { const j = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } };
  return { fiches: j('vrm_fiches_neuves') || {}, slots: j('vrm_slots') || {}, pool: (j('vinted_used_numeros') || []).map(String), couts: j('vinted_buyprice_by_num') || {}, pickup: j('vinted_pickup_done') || {}, collected: j('vrm_colis_collected') || [], notes: j('vrm_arrivees_a_numeroter') || {} }; });
const attendre = async (fn, ms = 8000) => { const t0 = Date.now(); let v; while (Date.now() - t0 < ms) { v = await fn(); if (v) return v; await new Promise((r) => setTimeout(r, 200)); } return v; };
const shot = async (pg, nom) => { if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `arrivee-${nom}.png`), timeout: 120000 }).catch(() => {}); };
const ecran = (pg) => pg.evaluate(() => {
  const a = (q, k) => { const e = document.querySelector(q); return e ? e.getAttribute(k) : null; };
  return { ouvert: !!document.querySelector('[data-arv]'), tx: a('[data-arv]', 'data-arv-tx'), etat: a('[data-arv-etat]', 'data-arv-etat'), numeros: a('[data-arv-numeros]', 'data-arv-numeros'),
    mode: a('[data-arv-numeros]', 'data-arv-mode'), cases: a('[data-arv-cases]', 'data-arv-cases'), ici: a('[data-arv-ici]', 'data-arv-ici'), n: a('[data-arv-n]', 'data-arv-n'),
    contient: a('[data-arv-contient]', 'data-arv-contient'), fait: a('[data-arv-fait]', 'data-arv-fait'), deja: a('[data-arv-deja]', 'data-arv-deja'),
    vise: !!document.querySelector('[data-arv] .sm-case.is-vise'), texte: ((document.querySelector('[data-arv]') || {}).innerText || '').slice(0, 600) };
});
// La mesure de l'écran : un plein, 44 px, rien ne déborde, aucune clé brute.
function mesure(tactile) {
  const f = document.querySelector('[data-arv]'); if (!f) return null;
  const R = f.getBoundingClientRect();
  const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 1 && r.height > 1 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const nom = (e) => (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 30);
  const racine = f.closest('[role="dialog"]') || f;
  const pleins = [...racine.querySelectorAll('.n-bouton[data-n-variante="plein"], [data-n-variante="plein"]')].filter(vis).map(nom);
  const cibles = tactile ? [...racine.querySelectorAll('button, a[href], input, [role="button"]')].filter(vis).filter((e) => !e.closest('.sm-meuble') && Math.min(e.offsetWidth || 99, e.offsetHeight || 99) < 43.5).map((e) => nom(e) + ' ' + e.offsetWidth + '×' + e.offsetHeight) : [];
  const debord = [...f.querySelectorAll('*')].filter(vis).filter((e) => { if (e.closest('.arv-dessin, .arv-meubles')) return false; const r = e.getBoundingClientRect(); return r.right > R.right + 1.5 || r.left < R.left - 1.5; }).slice(0, 4).map((e) => e.className + ' ' + nom(e));
  const cles = ((racine.innerText || '').match(/\b(?:arv|scan|arr|sm)\.[a-zA-Z.]+\b/g) || []).slice(0, 4);
  return { pleins, cibles, debord, cles, page: document.documentElement.scrollWidth - window.innerWidth };
}
const juger = async (pg, T, quoi, tactile) => {
  const m = await pg.evaluate(mesure, tactile);
  if (!m) { dit(false, `${T} ${quoi} : l’écran d’arrivée est là`); return; }
  dit(m.pleins.length <= 1, `${T} ${quoi} : un seul bouton plein`, m.pleins);
  if (tactile) dit(!m.cibles.length, `${T} ${quoi} : cibles ≥ 44 px`, m.cibles);
  dit(!m.debord.length && m.page <= 1, `${T} ${quoi} : rien ne déborde`, m);
  dit(!m.cles.length, `${T} ${quoi} : aucune clé brute`, m.cles);
};
const toucher = async (pg, sel, tactile) => { const l = pg.locator(sel).first(); await l.scrollIntoViewIfNeeded().catch(() => {}); if (tactile) await l.tap(); else await l.click(); };
const fermerArrivee = async (pg) => { await pg.keyboard.press('Escape'); await attendre(() => pg.evaluate(() => !document.querySelector('[data-arv]')), 5000); await pg.waitForTimeout(600); };
const scannerArrivee = async (pg, tactile) => {
  // Le scanner a pu mettre Ventes à l'écran (il y lit ses sources) : on revient à Achats.
  if (!(await pg.locator('[data-arv-bouton="achats"]').count())) await pg.goto(`http://localhost:${PORT}/?tab=achats`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('[data-arv-bouton="achats"]', { timeout: 40000 });
  await toucher(pg, '[data-arv-bouton="achats"]', tactile);
  await pg.waitForSelector('[data-scan-arrivee]', { timeout: 15000 });
};
const taper = async (pg, n) => {
  if (!(await pg.locator('[data-scan-r-saisie]').count())) await pg.click('[data-scan-r-clavier]').catch(() => {});
  await pg.fill('[data-scan-r-saisie]', n); await pg.click('[data-scan-r-ok]');
  await attendre(() => pg.evaluate(() => { if (document.querySelector('[data-arv]')) return true; const r = document.querySelector('[data-scan-r-resultat]'); return r && r.getAttribute('data-scan-r-resultat') !== 'attente'; }), 20000);
  await pg.waitForTimeout(400);
};
const attendreArrivee = (pg, ms = 20000) => attendre(async () => { const e = await ecran(pg); return e.ouvert && e.etat !== 'lecture' && (e.numeros || e.etat || e.fait) ? e : null; }, ms);

async function passe(b, vp, sombre) {
  const T = `[${vp.width}${sombre ? ' sombre' : ' clair'}]`;
  const suf = `${vp.width}-${sombre ? 'sombre' : 'clair'}`;

  // ── P · LA PORTE : « J'ai retiré » ⇒ l'écran d'arrivée de CET achat ──
  await essaie(`${T} P`, async () => {
    const { ctx, pg, errs, tactile } = await ouvrir(b, vp, sombre, base(), { onglet: 'cat_achats' });
    try {
      const RETIRE = '[data-colis-retire], .vrm-pickup-collect';
      await pg.locator(`[data-cc-colonne="retirer"] .vrm-rpf-ouvrir, ${RETIRE}`).first().waitFor({ timeout: 40000 }).catch(() => {});
      if (!(await pg.locator(RETIRE).count())) await pg.locator('[data-cc-colonne="retirer"] .vrm-rpf-ouvrir').first().click().catch(() => {});

      const n = await pg.locator(RETIRE).count();
      dit(n > 0, `${T} P0 · « J’ai retiré » est là (Achats → À retirer)`, n);
      if (!n) { await shot(pg, `P-debug-${suf}`); return; }
      const avant = await lireLocal(pg);
      // Le colis de l'achat 9300 (le premier à retirer de la base, son code 012345).
      // Le bouton dont la CARTE (le plus grand parent qui ne contient que lui) parle de l'Air Max (code 012345).
      const i = await pg.evaluate((sel) => { const L = [...document.querySelectorAll(sel)]; return L.findIndex((e) => { let p = e; while (p.parentElement && p.parentElement.querySelectorAll(sel).length === 1) p = p.parentElement; return /012345|Air Max/.test(p.innerText || ''); }); }, RETIRE);
      dit(i >= 0, `${T} P0 · le colis de l’achat ${PORTE_TX} (code 012345) est dans « À retirer »`, i);
      if (i < 0) { await shot(pg, `P-debug-${suf}`); return; }
      await pg.locator(RETIRE).nth(i).scrollIntoViewIfNeeded().catch(() => {});
      await pg.locator(RETIRE).nth(i).click();
      const e = await attendreArrivee(pg);
      dit(!!e && e.tx === String(PORTE_TX), `${T} P1 · « J’ai retiré » ouvre l’écran d’arrivée de CET achat (${PORTE_TX})`, e);
      if (!e) { await shot(pg, `P-echec-${suf}`); return; }
      dit(e.numeros === '13' && e.mode === 'vrm', `${T} P1 · son N° : 13 (après 12, jamais le trou 5)`, e);
      dit(e.ici === 'mA:2' && e.vise, `${T} P1 · sa case : la première LIBRE (Étagère A, rangée 1, colonne 3), qui respire`, e);
      dit(e.contient === '1', `${T} P1 · « Contient 1 paire »`, e.contient);
      const p1 = await lireLocal(pg);
      dit(!Object.keys(p1.fiches).length && !p1.pool.includes('13') && JSON.stringify(p1.slots) === JSON.stringify(avant.slots), `${T} P1 · rien n’est écrit avant SON toucher (ni N°, ni case)`, p1);
      await juger(pg, T, 'P1', tactile);
      await pg.waitForTimeout(1300); await shot(pg, `P1-ecran-${suf}`);
      // Toucher une case prise ⇒ rien ne change ; une libre ⇒ elle devient la case.
      await pg.locator('[data-arv] [data-sm-case="mA:0"]').first().click({ force: true }).catch(() => {});
      dit((await ecran(pg)).ici === 'mA:2', `${T} P2 · toucher une case prise ne change rien`);
      await toucher(pg, '[data-arv] [data-sm-case="mA:4"]', tactile);
      dit((await ecran(pg)).ici === 'mA:4', `${T} P2 · toucher une case libre la choisit`, (await ecran(pg)).ici);
      await toucher(pg, '[data-arv-ranger]', tactile);
      const w = await attendre(async () => { const l = await lireLocal(pg); const f = Object.values(l.fiches)[0]; return f && l.slots['13'] ? { l, f } : null; }, 10000);
      dit(!!w && w.f.numero === '13' && w.f.achat && w.f.achat.tx === String(PORTE_TX) && w.l.pool.includes('13'), `${T} P3 · « Ranger ici » : la fiche N°13 liée à CET achat, N°13 au pool`, w && w.f);
      dit(!!w && w.l.slots['13'].m === 'mA' && w.l.slots['13'].i === 4 && w.l.slots.B230 && w.l.slots['7'], `${T} P3 · N°13 dans SA case (mA:4), les autres cases intactes`, w && w.l.slots);
      dit(!!w && w.l.couts['13'] == null, `${T} P3 · aucun prix d’achat écrit sans reçu (l’article seul n’est pas le payé)`, w && w.l.couts);
      const pil = await attendre(() => pg.evaluate(() => { const p = document.querySelector('[data-pilule-annuler]'); return p ? (p.getAttribute('aria-label') || p.textContent || '') : null; }), 4000);
      dit(!!pil && /13/.test(pil), `${T} P3 · la pilule « Annuler » dit N°13`, pil);
      const fait = await attendre(async () => { const x = await ecran(pg); return x.fait ? x : null; }, 5000);
      dit(!!fait && fait.fait === '13', `${T} P3 · l’écran dit « Rangé · N°13 »`, fait);
      await juger(pg, T, 'P3', tactile);
      await pg.waitForTimeout(500); await shot(pg, `P3-range-${suf}`);
      await fermerArrivee(pg);
      // Rouvrir (Aujourd'hui / le Stock, ou « J'ai retiré » encore) ⇒ « Déjà rangé » : jamais deux fois.
      await pg.evaluate((tx) => window.dispatchEvent(new CustomEvent('vrm:atelier-numeroter', { detail: { entrees: [{ tx: String(tx), titre: 'x', site: 'vinted' }], prendre: () => {} } })), PORTE_TX);
      const d = await attendre(async () => { const x = await ecran(pg); return x.etat === 'deja' ? x : null; }, 8000);
      dit(!!d && d.deja === '13', `${T} P4 · rouvert, l’achat dit « Déjà rangé · N°13 » (jamais deux fois)`, d || (await ecran(pg)));
      const p4 = await lireLocal(pg);
      dit(Object.keys(p4.fiches).length === 1, `${T} P4 · toujours UNE fiche pour cet achat`, Object.keys(p4.fiches).length);
      dit(!errs.length, `${T} P · aucune erreur de page`, errs[0]);
    } finally { await ctx.close(); }
  });

  // ── S · LE SCAN (caméra simulée) : 50 achats identiques ⇒ celui du n° visé ; le colis noté retiré ──
  await essaie(`${T} S`, async () => {
    const { ctx, pg, errs, tactile } = await ouvrir(b, vp, sombre, base(), { camera: true });
    try {
      await scannerArrivee(pg, tactile);
      const cam = await attendre(() => pg.evaluate(() => { const e = document.querySelector('[data-scan-r]'); return e && e.getAttribute('data-scan-r-camera') !== 'demarrage' ? e.getAttribute('data-scan-r-camera') : null; }), 15000);
      dit(cam === 'active', `${T} S0 · la caméra (simulée) est active, le viseur ouvert`, cam);
      await shot(pg, `S0-camera-${suf}`);
      await pg.evaluate((m) => window.__viser(m), matriceQr(mr(SCAN_RETIRER_TX - 9400)));
      const e = await attendreArrivee(pg, 30000);
      dit(!!e && e.tx === String(SCAN_RETIRER_TX), `${T} S1 · le QR de l’étiquette ⇒ l’arrivée de l’achat ${SCAN_RETIRER_TX}, parmi 50 IDENTIQUES`, e || (await pg.evaluate(() => (document.querySelector('[data-scan-r]') || {}).innerText || '')).slice(0, 200));
      if (!e) { await shot(pg, `S-echec-${suf}`); return; }
      dit(e.numeros === '13' && e.ici === 'mA:2', `${T} S1 · N°13, la première case libre`, e);
      await juger(pg, T, 'S1', tactile);
      await pg.waitForTimeout(1300); await shot(pg, `S1-ecran-${suf}`);
      await toucher(pg, '[data-arv-ranger]', tactile);
      const w = await attendre(async () => { const l = await lireLocal(pg); const f = Object.values(l.fiches)[0]; return f && l.pickup[String(SCAN_RETIRER_TX)] ? { l, f } : null; }, 10000);
      dit(!!w && w.f.achat.tx === String(SCAN_RETIRER_TX) && w.l.slots['13'] && w.l.slots['13'].i === 2, `${T} S2 · « Ranger ici » : la fiche de CET achat, sa case`, w && w.f);
      dit(!!w, `${T} S2 · le colis est noté retiré par la MÊME clé que « J’ai retiré » (vinted_pickup_done), dans le même geste`, w ? w.l.pickup : await lireLocal(pg));
      const fait = await attendre(async () => { const x = await ecran(pg); return x.fait ? x : null; }, 5000);
      const suivant = await pg.locator('[data-arv-suivant="scan"]').count();
      dit(!!fait && suivant === 1, `${T} S3 · « Scanner le suivant » proposé`, { fait, suivant });
      await pg.waitForTimeout(400); await shot(pg, `S3-range-${suf}`);
      await toucher(pg, '[data-arv-suivant]', tactile);
      const re = await attendre(() => pg.evaluate(() => !!document.querySelector('[data-scan-arrivee]')), 8000);
      dit(!!re, `${T} S3 · « Scanner le suivant » rouvre la caméra de l’arrivée`);
      dit(!errs.length, `${T} S · aucune erreur de page`, errs[0]);
    } finally { await ctx.close(); }
  });

  // ── Q · n° tapé : inconnu, deux achats ; L · un lot ; H · hors ligne ──
  await essaie(`${T} QLH`, async () => {
    const { ctx, pg, errs, tactile } = await ouvrir(b, vp, sombre, base());
    try {
      await scannerArrivee(pg, tactile);
      await taper(pg, '48889999');
      const q1 = await pg.getAttribute('[data-arv-scan]', 'data-arv-scan').catch(() => null);
      dit(q1 === 'aucun' && !(await ecran(pg)).ouvert, `${T} Q1 · n° inconnu ⇒ « Aucun achat avec ce n° », aucun écran d’arrivée`, q1);
      await shot(pg, `Q1-inconnu-${suf}`);
      await pg.click('[data-scan-r-autre]').catch(() => {});
      await taper(pg, DOUBLE);
      const q2 = await pg.evaluate(() => [...document.querySelectorAll('[data-scan-r-choix]')].map((e) => e.getAttribute('data-scan-r-choix')));
      dit(q2.length === 2 && q2.includes('achat:a:9490') && q2.includes('achat:a:9491') && !(await ecran(pg)).ouvert, `${T} Q2 · deux achats au même n° ⇒ la question (2 choix), rien d’ouvert seul`, q2);
      await shot(pg, `Q2-deux-${suf}`);
      await toucher(pg, '[data-scan-r-choix="achat:a:9491"]', tactile);
      const q3 = await attendreArrivee(pg);
      dit(!!q3 && q3.tx === '9491', `${T} Q3 · SON toucher choisit : l’arrivée de 9491`, q3);
      await fermerArrivee(pg);
      // L — le lot.
      await scannerArrivee(pg, tactile);
      await taper(pg, LOT_SUIVI);
      const l1 = await attendre(async () => { const x = await ecran(pg); return x.ouvert && x.numeros && x.numeros.split(',').length === 3 && x.cases ? x : null; }, 20000);
      dit(!!l1 && l1.tx === String(LOT_TX) && l1.contient === '3', `${T} L1 · un lot : « Contient 3 paires » (lu dans SA transaction)`, l1 || (await ecran(pg)));
      dit(!!l1 && l1.numeros === '13,14,15', `${T} L1 · N°13, 14, 15 — un par un, à la suite`, l1 && l1.numeros);
      const cs = l1 && l1.cases ? l1.cases.split(',') : [];
      dit(cs.length === 3 && new Set(cs).size === 3 && !cs.includes('-') && !cs.includes('mA:0') && !cs.includes('mA:1'), `${T} L1 · trois cases différentes, jamais une prise`, cs);
      await juger(pg, T, 'L1', tactile);
      await pg.waitForTimeout(1300); await shot(pg, `L1-lot-${suf}`);
      if (process.env.DEBUG_L) await pg.evaluate(() => { window.__trace = []; const t0 = Date.now(); const f = () => { window.__trace.push((Date.now() - t0) + ':' + Object.keys(JSON.parse(localStorage.getItem('vrm_slots') || '{}')).join('/')); if (Date.now() - t0 < 3000) setTimeout(f, 50); }; f();
        const o = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === 'vrm_slots') window.__trace.push('SET ' + (Date.now() - t0) + ' ' + String(v).slice(0, 120) + ' @ ' + (new Error().stack || '').split('\n').slice(2, 5).join(' | ').slice(0, 300)); return o.call(this, k, v); }; });
      await toucher(pg, '[data-arv-ranger]', tactile);
      if (process.env.DEBUG_L) { await pg.waitForTimeout(3200); const tr0 = await pg.evaluate(() => window.__trace); console.log('     TRACE ' + tr0.filter((x, i, a) => x.startsWith('SET') || i === 0 || (a[i - 1] && x.split(':')[1] !== a[i - 1].split(':')[1])).join(' || ')); }
      const l2 = await attendre(async () => { const l = await lireLocal(pg); const fs2 = Object.values(l.fiches).filter((f) => f.achat && f.achat.tx === String(LOT_TX)); return fs2.length === 3 && ['13', '14', '15'].every((x) => l.slots[x]) ? { l, fs2 } : null; }, 10000);   // les clés s'écrivent l'une après l'autre
      { const l = await lireLocal(pg); if (!l2 || !['13', '14', '15'].every((x) => l.slots[x])) console.log('     (lot : slots ' + JSON.stringify(l.slots) + ' · fiches ' + JSON.stringify(Object.values(l.fiches).map((f) => [f.numero, f.case, f.achat && f.achat.tx])) + ')'); }
      dit(!!l2 && l2.fs2.map((f) => f.numero).sort().join(',') === '13,14,15' && ['13', '14', '15'].every((n) => l2.l.slots[n]) && l2.fs2.every((f) => f.prixAchat == null), `${T} L2 · « Ranger les 3 paires » : 3 fiches, 3 cases, aucun prix divisé`, l2 && l2.fs2.map((f) => [f.numero, f.prixAchat]));
      await fermerArrivee(pg);
      // H — hors ligne : l'achat reconnu, le N° attend le réseau.
      // En ligne d'abord (une arrivée ouverte puis fermée : les écrans et les données sont en mémoire), puis le réseau tombe.
      await scannerArrivee(pg, tactile);
      await taper(pg, mr(8));
      await attendreArrivee(pg); await fermerArrivee(pg);
      await scannerArrivee(pg, tactile);
      await ctx.setOffline(true);
      await pg.evaluate(() => window.dispatchEvent(new Event('offline')));
      await taper(pg, mr(7));
      if (process.env.DEBUG_H) console.log('     (H : ' + await pg.evaluate(() => location.search + ' · onglets ' + [...document.querySelectorAll('[data-ecran]')].map((e) => e.getAttribute('data-ecran')).join(',') + ' · ' + ((document.querySelector('[data-scan-r]') || {}).innerText || '').slice(0, 160).replace(/\n/g, ' / ')) + ')');
      const h = await attendre(async () => { const x = await ecran(pg); return x.ouvert && x.etat ? x : null; }, 15000);
      dit(!!h && h.tx === '9407' && h.etat === 'horsLigne', `${T} H1 · hors ligne : l’achat reconnu (cache), « le N° attend le réseau »`, h || (await ecran(pg)));
      await juger(pg, T, 'H1', tactile);
      await shot(pg, `H1-hors-ligne-${suf}`);
      const avant = await lireLocal(pg);
      await toucher(pg, '[data-arv-noter]', tactile);
      const h2 = await attendre(async () => { const l = await lireLocal(pg); return l.notes['9407'] ? l : null; }, 6000);
      dit(!!h2 && h2.pool.length === avant.pool.length && !Object.values(h2.fiches).some((f) => f.achat && f.achat.tx === '9407'), `${T} H2 · « Noter l’arrivée » : notée, AUCUN N° donné hors ligne`, h2 && { notes: Object.keys(h2.notes), pool: h2.pool.length });
      await ctx.setOffline(false);
      await pg.evaluate(() => window.dispatchEvent(new Event('online')));
      await fermerArrivee(pg);
      dit(!errs.length, `${T} QLH · aucune erreur de page`, errs[0]);
    } finally { await ctx.close(); }
  });
}

async function passeVide(b, vp, sombre) {
  const T = `[${vp.width}${sombre ? ' sombre' : ' clair'} · vide]`;
  await essaie(`${T} V`, async () => {
    const { ctx, pg, errs, tactile } = await ouvrir(b, vp, sombre, base(true));
    try {
      await scannerArrivee(pg, tactile);
      await taper(pg, mr(3));
      const v = await pg.getAttribute('[data-arv-scan]', 'data-arv-scan').catch(() => null);
      dit(v === 'aucun', `${T} V1 · base vide : « Aucun achat avec ce n° »`, v);
      await shot(pg, `V1-vide-${vp.width}-${sombre ? 'sombre' : 'clair'}`);
      await pg.goto(`http://localhost:${PORT}/?tab=garage`, { waitUntil: 'domcontentloaded' });
      await pg.waitForTimeout(4000);
      dit(!(await pg.locator('[data-arv-arrives]').count()), `${T} V2 · le Stock vide ne montre aucun « Arrivés · à ranger »`);
      dit(!errs.length, `${T} V · aucune erreur de page`, errs[0]);
    } finally { await ctx.close(); }
  });
}

(async () => {
  await new Promise((ok2, ko2) => { srv.once('error', ko2); srv.listen(PORT, ok2); });
  const b = await lancer(PW, { executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    const vues = (process.env.VUES || '390-clair,390-sombre,1512-clair,1512-sombre').split(',');
    for (const v of vues) { const [w, th] = v.split('-'); const vp = w === '390' ? { width: 390, height: 844 } : { width: 1512, height: 950 }; await passe(b, vp, th === 'sombre'); }
    if (!process.env.SANS_VIDE) { await passeVide(b, { width: 390, height: 844 }, false); await passeVide(b, { width: 1512, height: 950 }, true); }
  } finally { await b.close(); srv.close(); }
  console.log(ko ? `\n❌ arrivée d’un achat : ${ko} rouge(s), ${ok} vert(s).` : `\n✅ arrivée d’un achat : ${ok} verts`);
  process.exit(ko ? 1 : 0);
})();
