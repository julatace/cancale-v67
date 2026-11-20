require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « CE QUI MANQUE » (20 nov. 2026) — données INVENTÉES (dépôt public), base servie par la règle de table du mode
//  exemple (src/exempleBase.js : `select=` projeté, `meta->>`, `id=like.`, écritures gardées). 390 tactile et 1512,
//  clair et sombre. Captures dans BANC_CAPTURES (à regarder, §6.2).
//   V. VUES ET FAVORIS + STOCK AU PRIX AFFICHÉ : l'écran Annonces publie (aucune requête Vinted : le dressing lu porte
//      `view_count` / `favourite_count`), Aujourd'hui montre — les NOMBRES rendus (data-*) = ceux tirés de la base :
//      465 vues sur 3 annonces (un `view_count: 0` est « pas su », jamais 0), +20 aujourd'hui (le point d'hier) ; 19 favoris
//      sur 4, +1 ; 355 € au prix affiché sur 4 (le brouillon ne compte pas). À l'ordinateur, le tableau Annonces : la
//      colonne Vues dit 120 pour la paire 1001 et « — · pas fourni par le site » pour celle dont Vinted ne donne pas le nombre.
//   R. LECTURE RATÉE (règle 1) : les dressings répondent 503 ⇒ Aujourd'hui garde les derniers chiffres (rien d'effacé).
//   B. COMPTE BLOQUÉ, CHANGER D'AVIS : page Extension, la rangée du compte bloqué ⇒ « Garder » puis « Mettre en pause »,
//      la même clé `vrm_comptes_bloques` (épisode du blocage gardé), à tout moment.
//   S. STOCK : « Personnaliser » (nom, style Rayonnage, couleur Sable, une colonne de plus) ⇒ `vrm_meubles` réécrit, les
//      paires gardent leur rangée et leur colonne, AUCUN N° changé ; « La pièce » ⇒ l'ordre ; à la souris (1512), une paire
//      glissée d'une case à une case libre ⇒ `vrm_slots` (la pose de « Déplacer »), aucun N° changé.
//   Q. partout : aucune erreur de page, aucun défilement de côté, cibles ≥ 44 px dans ce qui est neuf.
//  `BANC_SEUL=V,R,B,S`, `BANC_PORT`, `BANC_DIST`, `BANC_CAPTURES`.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), http = require('http'), fs = require('fs'), os = require('os');
const RACINE = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(RACINE, 'node_modules', 'playwright'));
const DIST = process.env.BANC_DIST || path.join(RACINE, 'dist');
const PORT = Number(process.env.BANC_PORT) || 4787;
const CAPTURES = process.env.BANC_CAPTURES || path.join(os.tmpdir(), 'banc-ce-qui-manque');
fs.mkdirSync(CAPTURES, { recursive: true });
const UID = '11111111-2222-3333-4444-555555555555';
const SESSION = { access_token: 'aaa.bbb.ccc', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: UID, email: 'vendeuse@exemple.test', created_at: '2025-01-10T10:00:00.000Z' } };
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.webp': 'image/webp' };
const H = 3600e3;
const iso = (ilYa) => new Date(Date.now() - ilYa).toISOString();
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (!c && d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 400) : '')); return c; };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String((e && e.stack) || e).split('\n').slice(0, 3).join(' ')); } };
let servirTable;

// ── La base inventée ─────────────────────────────────────────────────────────
const ligne = (id, data, meta) => ({ id, owner: UID, data, updated_at: iso(0), ...(meta ? { meta } : {}) });
const compte = (uid, login) => ({ id: Number(uid), vinted_user_id: String(uid), login, domain: 'www.vinted.fr', owner: UID, updated_at: iso(0) });
const article = (id, titre, prix, vues, fav, extra = {}) => ({ id, title: titre, price: { amount: String(prix) + '.0', currency_code: 'EUR' }, url: `https://www.vinted.fr/items/${id}`, photo: null, status: 'Très bon état',
  is_closed: false, is_hidden: false, is_reserved: false, is_draft: false, created_at_ts: Math.floor((Date.now() - 10 * 864e5) / 1000), view_count: vues, favourite_count: fav, ...extra });
const dressing = (uid, items) => { const cap = iso(10 * 60e3); return ligne(`harvest_${uid}_listings`, { capturedAt: cap, nItems: items.length, complet: true, payload: { items, pagination: { total_entries: items.length, total_pages: 1, current_page: 1 } } }, { capturedAt: cap, nItems: String(items.length) }); };
const ITEMS_111 = [article(1001, 'Nike Air Max 90 blanche', 65, 120, 6), article(1002, 'Adidas Samba noire', 80, 0, 2), article(1003, 'New Balance 550', 90, 45, 0)];
const ITEMS_222 = [article(2001, 'Asics Gel-Kayano 14', 120, 300, 11), article(2002, 'Nike Dunk Low (brouillon)', 70, 9, 9, { is_draft: true })];
const ATTENDU = { vues: 465, nVues: 3, gagnesVues: 20, favoris: 19, nFav: 4, gagnesFav: 1, stockC: 35500, stockN: 4 };
const DEPUIS = iso(5 * H);
const BANNI = { etat: 'banni', at: iso(H), preuve: 'champ profil is_account_banned', depuis: DEPUIS };
const ACTIF = (t = H) => ({ etat: 'actif', at: iso(t), preuve: 'champ profil is_account_banned' });
const MEUBLES = [{ id: 'mA', name: 'Étagère entrée', cols: 4, rows: 3, ordre: 0 }, { id: 'mB', name: 'Armoire chambre', cols: 3, rows: 2, couleur: 'ardoise', ordre: 1 }];
// N°1 en rangée 1 colonne 2 de mA (i 1), N°2 en rangée 2 colonne 4 (i 7), N°4 dans mB.
const SLOTS = { 1: { m: 'mA', i: 1 }, 2: { m: 'mA', i: 7 }, 4: { m: 'mB', i: 0 } };
const NUMEROS = { 1001: { numero: '1', title: 'Nike Air Max 90 blanche', accountId: '111' }, 1002: { numero: '2', title: 'Adidas Samba noire', accountId: '111' }, 1003: { numero: '3', title: 'New Balance 550', accountId: '111' }, 2001: { numero: '4', title: 'Asics Gel-Kayano 14', accountId: '222' } };
const base = ({ etat111 = ACTIF(), choix = null } = {}) => ({ app_data: { lignes: [
  ligne('main', { vrm_bienvenue_vue: { at: iso(30 * 864e5) }, vrm_visite: { at: iso(30 * 864e5), fin: 'fin' }, vrm_je_vends: { choix: 'sneakers' },
    vinted_annonce_numeros: NUMEROS, vrm_meubles: MEUBLES, vrm_slots: SLOTS, vinted_nums_physiques: { nums: ['1', '2', '3', '4'], at: Date.now() },
    vrm_numerotation: { archive: 'B', version: 2, coupure: '2026-10-09T00:00:00Z' },
    vrm_aujourdhui_cartes: { ordre: ['vues', 'stock', 'chiffres'], montrees: ['vues', 'stock', 'chiffres'], rev: 1, at: Date.now() - H },
    // Le point d'HIER de la paire 1001 (100 vues, 5 favoris) : « aujourd'hui » = 120 − 100, 6 − 5.
    vrm_vues_lues: { v: 1, debut: '2026-11-01', a: { 'vinted#1001': [[Date.now() - 30 * H, 100, 5]] } },
    ...(choix ? { vrm_comptes_bloques: choix } : {}) }),
  ligne('panel_comptes_etat', { comptes: { 111: etat111, 222: ACTIF() } }),
  dressing(111, ITEMS_111), dressing(222, ITEMS_222),
  ligne('lbc_listings', { items: {}, updatedAt: iso(H) }), ligne('vc_listings', { items: {}, capturedAt: iso(H) }),
] }, vinted_accounts: { lignes: [compte(111, 'shop_cancale'), compte(222, 'autre_compte')] } });

const srv = http.createServer((q, r) => {
  let f = decodeURIComponent(q.url.split('?')[0]); if (f === '/' || !path.extname(f)) f = '/index.html';
  let p = path.join(DIST, f);
  if (!fs.existsSync(p) && f.startsWith('/exemple/')) p = path.join(RACINE, 'public', f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});

async function contexte(nav, { largeur = 390, sombre = false }) {
  const mobile = largeur < 600;
  const ctx = await nav.newContext({ viewport: { width: largeur, height: mobile ? 844 : 950 }, isMobile: mobile, hasTouch: mobile, colorScheme: sombre ? 'dark' : 'light', deviceScaleFactor: 1, locale: 'fr-FR', serviceWorkers: 'block' });
  await ctx.addInitScript(({ s, sombre }) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_mfa_plus_tard_' + s.user.id, String(Date.now())); localStorage.setItem('vinted_dark', sombre ? 'true' : 'false');
    localStorage.setItem('vrm_bienvenue_vue', JSON.stringify({ at: new Date().toISOString() })); localStorage.setItem('vrm_parcours_plus_tard', JSON.stringify({ at: Date.now() })); localStorage.setItem('vrm_design_v2', '1'); localStorage.removeItem('vrm_banc_dom_ancien'); /* le design natif (la garde réseau pose l'ancien DOM sans choix) */ } catch (_) {} }, { s: SESSION, sombre });
  return ctx;
}
async function page(ctx, { b, panneDressings = () => false, tab = 'journee' }) {
  const pg = await ctx.newPage();
  const etat = { erreurs: [] };
  pg.on('pageerror', (e) => etat.erreurs.push(e.message));
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) || /^https?:\/\/[^/]*vinted\.net\//i.test(r.request().url()) ? r.abort() : r.continue()));
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...SESSION, expires_in: 3600, id: UID, email: SESSION.user.email, created_at: SESSION.user.created_at }) }));
  await pg.route('**/rest/v1/**', (r) => {
    const url = new URL(r.request().url()), m = r.request().method();
    if (/\/rpc\//.test(url.pathname)) return r.fulfill({ status: 200, contentType: 'application/json', body: 'true' });
    const brut = decodeURIComponent(url.search);
    if (m === 'GET' && /harvest_/.test(brut) && panneDressings()) return r.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
    const t = url.pathname.slice('/rest/v1/'.length).split('/')[0];
    const table = b[t] || { lignes: [] };
    let corps = null; try { corps = r.request().postData() ? JSON.parse(r.request().postData()) : null; } catch (_) {}
    const x = servirTable(table, { methode: m, url: url.pathname + url.search, entetes: r.request().headers(), corps, owner: UID });
    return r.fulfill({ status: x.status, headers: x.headers, body: x.status === 204 || x.body == null ? '' : JSON.stringify(x.body) });
  });
  await pg.route('**/api/**', (r) => {
    const u = r.request().url();
    if (/mode=abonnement/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, actif: true, acces: true, statut: 'active', configure: false, obligatoire: false }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => !document.getElementById('vrm-demarrage') && !document.documentElement.hasAttribute('data-vrm-boot'), null, { timeout: 30000 }).catch(() => {});
  return { pg, etat };
}
const capture = (pg, nom) => pg.screenshot({ path: path.join(CAPTURES, `${nom}.png`) }).catch(() => {});
const ls = (pg, k) => pg.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } }, k);
const sansDebord = (pg) => pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
const petites = (pg, sel) => pg.evaluate((sel) => [...document.querySelectorAll(sel)].filter((e) => e.getClientRects().length).map((e) => e.getBoundingClientRect())
  .filter((r) => r.width > 0 && (r.height < 43.5 || r.width < 43.5)).map((r) => `${Math.round(r.width)}×${Math.round(r.height)}`), sel);
const toucher = async (pg, tel, sel) => { const el = pg.locator(sel).locator('visible=true').first(); await el.waitFor({ state: 'visible', timeout: 12000 }); await el.scrollIntoViewIfNeeded(); if (tel) await el.tap(); else await el.click(); await pg.waitForTimeout(400); };

// ── V + R ────────────────────────────────────────────────────────────────────
async function scenarioV(nav, largeur, sombre) {
  const nom = `V-${largeur}-${sombre ? 'sombre' : 'clair'}`;
  console.log(`\nV · vues et favoris, stock au prix affiché · ${nom}`);
  const ctx = await contexte(nav, { largeur, sombre });
  const b = base();
  let panne = false;
  try {
    // 1. Annonces publie (le propriétaire).
    const A = await page(ctx, { b, tab: 'annonces', panneDressings: () => panne });
    const pub = await A.pg.waitForFunction(() => { try { return JSON.parse(localStorage.getItem('vrm_vues_favoris') || 'null'); } catch (_) { return null; } }, null, { timeout: 30000 }).then((h) => h.jsonValue()).catch(() => null);
    const sv = await ls(A.pg, 'vrm_stock_valeur');
    dit(!!pub && pub.vues.total === ATTENDU.vues && pub.vues.n === ATTENDU.nVues && pub.favoris.total === ATTENDU.favoris && pub.favoris.n === ATTENDU.nFav,
      `${nom} : Annonces publie ${ATTENDU.vues} vues sur ${ATTENDU.nVues}, ${ATTENDU.favoris} favoris sur ${ATTENDU.nFav} (le 0 de Vinted = pas su)`, pub);
    dit(!!pub && pub.vues.gagnes === ATTENDU.gagnesVues && pub.favoris.gagnes === ATTENDU.gagnesFav, `${nom} : +${ATTENDU.gagnesVues} vues, +${ATTENDU.gagnesFav} favori aujourd’hui (le point d’hier)`, pub && { v: pub.vues, f: pub.favoris });
    dit(!!sv && sv.centimes === ATTENDU.stockC && sv.n === ATTENDU.stockN && sv.nVinted === 4, `${nom} : stock au prix affiché 355 € sur 4 (le brouillon ne compte pas), prix Vinted`, sv);
    // (20 nov., intégration) Le point s'écrit APRÈS la publication de `vrm_vues_favoris` (machine chargée : lu trop tôt, le banc
    // voyait encore le seul point d'hier) : on attend l'état (deux points), jamais un délai fixe ; rien de plus n'est exigé.
    await A.pg.waitForFunction(() => { try { const x = JSON.parse(localStorage.getItem('vrm_vues_lues') || 'null'); return !!(x && x.a && (x.a['vinted#1001'] || []).length >= 2); } catch (_) { return false; } }, null, { timeout: 10000 }).catch(() => {});
    const j = await ls(A.pg, 'vrm_vues_lues');
    dit(!!j && Array.isArray(j.a['vinted#1001']) && j.a['vinted#1001'].length === 2 && j.a['vinted#1001'][1][1] === 120 && Math.abs(j.a['vinted#1001'][1][0] - (Date.now() - 10 * 60e3)) < 5 * 60e3,
      `${nom} : un point daté par la LECTURE du dressing (il y a 10 min), pas l’heure de l’écran`, j && j.a['vinted#1001']);
    if (largeur >= 1024) {
      // Le tableau : Vues 120 pour 1001, « — · pas fourni » pour 1002 (Vinted ne donne pas le nombre).
      await A.pg.waitForSelector('[data-eg-article="vinted#1001"]', { timeout: 15000 }).catch(() => {});
      const cellules = await A.pg.evaluate(() => {
        const th = [...document.querySelectorAll('th, [role="columnheader"]')].find((x) => /^\s*Vues\b/.test(x.textContent || ''));
        const ligne = (k) => document.querySelector(`[data-eg-article="${k}"]`);
        const l1 = ligne('vinted#1001'), l2 = ligne('vinted#1002');
        return { entete: !!th, l1: l1 ? l1.innerText : null, pasFourni2: l2 ? l2.querySelectorAll('[data-eg-pasfourni]').length : -1, titre: l2 && l2.querySelector('[data-eg-pasfourni]') ? l2.querySelector('[data-eg-pasfourni]').getAttribute('title') : '' };
      });
      dit(cellules.entete && /\b120\b/.test(cellules.l1 || '') && cellules.pasFourni2 >= 1 && /pas fourni par le site/.test(cellules.titre), `${nom} : tableau, colonne Vues : 120 ; « — » dit « pas fourni par le site »`, cellules);
      await capture(A.pg, `${nom}-annonces`);
    }
    dit(!A.etat.erreurs.length, `${nom} : Annonces sans erreur`, A.etat.erreurs.join(' | '));
    await A.pg.close();
    // 2. Aujourd'hui montre la publication.
    const J = await page(ctx, { b, tab: 'journee', panneDressings: () => panne });
    await J.pg.waitForSelector('[data-v2-bloc="vues"][data-v2-vues="lu"]', { timeout: 30000 }).catch(() => {});
    const lu = async (pg) => pg.evaluate(() => {
      const f = (k) => { const e = document.querySelector(`[data-v2-vues-fait="${k}"]`); return e ? { total: e.getAttribute('data-v2-vues-total'), gagnes: e.getAttribute('data-v2-vues-gagnes'), texte: e.innerText } : null; };
      const s = document.querySelector('[data-v2-bloc="stock"]');
      return { vues: f('vues'), favoris: f('favoris'), stock: s ? s.getAttribute('data-v2-stock-affiche') : null, stockTexte: s ? s.innerText : '' };
    });
    const x = await lu(J.pg);
    dit(x.vues && x.vues.total === String(ATTENDU.vues) && x.vues.gagnes === String(ATTENDU.gagnesVues) && x.favoris && x.favoris.total === String(ATTENDU.favoris) && x.favoris.gagnes === String(ATTENDU.gagnesFav),
      `${nom} : Aujourd’hui, « Vues et favoris » = la publication (465 · +20 ; 19 · +1)`, x);
    dit(/465/.test(x.vues ? x.vues.texte.replace(/\s/g, '') : '') && /aujourd/.test(x.vues ? x.vues.texte : '') && /sur 3 annonces/.test(x.vues ? x.vues.texte : ''), `${nom} : la carte dit le chiffre, « +20 aujourd’hui », « sur 3 annonces »`, x.vues);
    dit(x.stock === `${ATTENDU.stockC},${ATTENDU.stockN},${ATTENDU.stockN}` && /355/.test(x.stockTexte) && /prix Vinted/.test(x.stockTexte), `${nom} : « Stock en ligne » au prix affiché : 355 € sur 4, prix Vinted (dit)`, x);
    dit(await sansDebord(J.pg), `${nom} : aucun défilement de côté`);
    const p44 = await petites(J.pg, '[data-v2-bloc="vues"] button, [data-v2-bloc="stock"] button');
    dit(!p44.length, `${nom} : cibles ≥ 44 px dans les cartes`, p44);
    await J.pg.locator('[data-v2-bloc="vues"]').scrollIntoViewIfNeeded().catch(() => {});
    await capture(J.pg, `${nom}-aujourdhui`);
    dit(!J.etat.erreurs.length, `${nom} : Aujourd’hui sans erreur`, J.etat.erreurs.join(' | '));
    await J.pg.close();
    if (largeur === 390 && !sombre) {
      // R. La lecture des dressings tombe (503) : Annonces ne publie rien, Aujourd'hui garde les derniers chiffres.
      console.log(`\nR · lecture ratée · ${nom}`);
      panne = true;
      const A2 = await page(ctx, { b, tab: 'annonces', panneDressings: () => panne });
      await A2.pg.waitForTimeout(9000);
      const pub2 = await ls(A2.pg, 'vrm_vues_favoris'), sv2 = await ls(A2.pg, 'vrm_stock_valeur');
      dit(!!pub2 && pub2.vues.total === ATTENDU.vues && pub2.favoris.total === ATTENDU.favoris && !!sv2 && sv2.centimes === ATTENDU.stockC, 'R : dressings en 503 ⇒ rien publié par-dessus : 465 vues, 19 favoris, 355 € restent', { pub2: pub2 && pub2.vues, sv2 });
      await A2.pg.close();
      const J2 = await page(ctx, { b, tab: 'journee', panneDressings: () => panne });
      await J2.pg.waitForSelector('[data-v2-bloc="vues"][data-v2-vues="lu"]', { timeout: 30000 }).catch(() => {});
      const y = await lu(J2.pg);
      dit(y.vues && y.vues.total === String(ATTENDU.vues) && y.stock === `${ATTENDU.stockC},${ATTENDU.stockN},${ATTENDU.stockN}`, 'R : Aujourd’hui montre toujours les derniers chiffres', y);
      await capture(J2.pg, 'R-aujourdhui');
      await J2.pg.close();
    }
  } finally { await ctx.close(); }
}

// ── B ─────────────────────────────────────────────────────────────────────────
async function scenarioB(nav, largeur, sombre) {
  const nom = `B-${largeur}-${sombre ? 'sombre' : 'clair'}`;
  console.log(`\nB · compte bloqué, changer d’avis · ${nom}`);
  const tel = largeur < 600;
  const ctx = await contexte(nav, { largeur, sombre });
  try {
    const { pg, etat } = await page(ctx, { b: base({ etat111: BANNI, choix: { 111: { choix: 'pause', at: iso(2 * H), episode: DEPUIS, n: 3 } } }), tab: 'extension' });
    const vu = await pg.waitForSelector('[data-ext-bloque="111"]', { timeout: 30000 }).then(() => true).catch(() => false);
    dit(vu, `${nom} : la page Extension montre la rangée du compte bloqué`);
    dit(await pg.locator('[data-ext-bloque="111"]').getAttribute('data-ext-bloque-choix').catch(() => '') === 'pause', `${nom} : son choix d’avant est dit (en pause)`);
    dit((await pg.locator('[data-ext-bloque]').count()) === 1, `${nom} : l’autre compte (actif) n’a rien de tel`);
    const p44 = await petites(pg, '[data-ext-bloque-geste]');
    dit(!p44.length, `${nom} : « Mettre en pause » / « Garder » ≥ 44 px`, p44);
    await pg.locator('[data-ext-bloque="111"]').scrollIntoViewIfNeeded().catch(() => {});
    await capture(pg, `${nom}-1`);
    await toucher(pg, tel, '[data-ext-bloque-geste="garder"]');
    await pg.waitForFunction(() => { try { return JSON.parse(localStorage.getItem('vrm_comptes_bloques'))['111'].choix === 'garder'; } catch (_) { return false; } }, null, { timeout: 6000 }).catch(() => {});
    const c1 = await ls(pg, 'vrm_comptes_bloques');
    dit(c1 && c1['111'] && c1['111'].choix === 'garder' && c1['111'].episode === DEPUIS, `${nom} : « Garder » ⇒ son choix rangé (même clé, épisode du blocage)`, c1);
    dit(await pg.locator('[data-ext-bloque="111"]').getAttribute('data-ext-bloque-choix').catch(() => '') === 'garder', `${nom} : la rangée dit « gardées »`);
    await toucher(pg, tel, '[data-ext-bloque-geste="pause"]');
    await pg.waitForFunction(() => { try { return JSON.parse(localStorage.getItem('vrm_comptes_bloques'))['111'].choix === 'pause'; } catch (_) { return false; } }, null, { timeout: 6000 }).catch(() => {});
    const c2 = await ls(pg, 'vrm_comptes_bloques');
    dit(c2 && c2['111'] && c2['111'].choix === 'pause' && c2['111'].episode === DEPUIS && c2['111'].n === 3, `${nom} : « Mettre en pause » ⇒ de nouveau en pause (n gardé)`, c2);
    dit((await pg.locator('[data-compte-bloque]').count()) === 0, `${nom} : aucune question de la coque (son choix vaut)`);
    dit(await sansDebord(pg), `${nom} : aucun défilement de côté`);
    await capture(pg, `${nom}-2`);
    dit(!etat.erreurs.length, `${nom} : aucune erreur`, etat.erreurs.join(' | '));
  } finally { await ctx.close(); }
}

// ── S ─────────────────────────────────────────────────────────────────────────
async function scenarioS(nav, largeur, sombre) {
  const nom = `S-${largeur}-${sombre ? 'sombre' : 'clair'}`;
  console.log(`\nS · Stock : personnaliser, la pièce, glisser · ${nom}`);
  const tel = largeur < 600;
  const ctx = await contexte(nav, { largeur, sombre });
  try {
    const { pg, etat } = await page(ctx, { b: base(), tab: 'garage' });
    await pg.waitForSelector('[data-sm-tuile="mA"]', { timeout: 30000 }).catch(() => {});
    await capture(pg, `${nom}-debut`);
    const numsAvant = JSON.stringify(await ls(pg, 'vinted_annonce_numeros'));
    await toucher(pg, tel, '[data-sm-tuile="mA"]');
    dit(await pg.locator('[data-sm-zoom="mA"]').count() === 1, `${nom} : le meuble zoomé`);
    dit(await pg.locator('[data-sm-perso-ouvrir="mA"]').locator('visible=true').count() === 1, `${nom} : « Personnaliser » à la place de « Modifier »`);
    await toucher(pg, tel, '[data-sm-perso-ouvrir="mA"]');
    await pg.waitForSelector('[data-sm-perso="mA"]', { timeout: 8000 }).catch(() => {});
    dit(await pg.locator('[data-sm-perso="mA"]').count() === 1, `${nom} : la page « Personnaliser » s’ouvre`);
    const p44 = await petites(pg, '[data-sm-perso] button');
    dit(!p44.length, `${nom} : cibles ≥ 44 px dans « Personnaliser »`, p44);
    await capture(pg, `${nom}-perso`);
    await pg.locator('[data-sm-perso-nom]').fill('Rayon du fond');
    const seg = pg.locator('[data-sm-perso] button', { hasText: 'Rayonnage' }).first();
    if (tel) await seg.tap(); else await seg.click();
    await toucher(pg, tel, '[data-sm-perso-couleur="sable"]');
    await toucher(pg, tel, '[data-sm-perso-plus="colonnes"]');
    dit((await pg.locator('[data-sm-perso-n="colonnes"]').innerText()).trim() === '5', `${nom} : une colonne de plus (5)`);
    await toucher(pg, tel, '[data-sm-perso-enregistrer="mA"]');
    await pg.waitForFunction(() => { try { return JSON.parse(localStorage.getItem('vrm_meubles')).find((m) => m.id === 'mA').cols === 5; } catch (_) { return false; } }, null, { timeout: 6000 }).catch(() => {});
    const ms = await ls(pg, 'vrm_meubles'), sl = await ls(pg, 'vrm_slots');
    const mA = ms && ms.find((m) => m.id === 'mA');
    dit(!!mA && mA.name === 'Rayon du fond' && mA.cols === 5 && mA.rows === 3 && mA.couleur === 'sable' && mA.reglages && mA.reglages.affichage === 'rayonnage', `${nom} : « Enregistrer » ⇒ nom, 5 colonnes, Sable, Rayonnage dans vrm_meubles`, mA);
    // Les paires gardent rangée et colonne : N°1 (r0 c1) ⇒ i 1 ; N°2 (r1 c3) ⇒ i 1*5+3 = 8.
    dit(sl && sl['1'] && sl['1'].i === 1 && sl['2'] && sl['2'].i === 8 && sl['4'] && sl['4'].m === 'mB', `${nom} : les paires gardent leur rangée et leur colonne`, sl);
    // La pièce : mA descend après mB.
    await pg.waitForTimeout(500);
    await toucher(pg, tel, '[data-sm-piece-ouvrir]');
    await pg.waitForSelector('[data-sm-piece]', { timeout: 8000 }).catch(() => {});
    const p44b = await petites(pg, '[data-sm-piece] button');
    dit(!p44b.length, `${nom} : cibles ≥ 44 px dans « La pièce »`, p44b);
    await capture(pg, `${nom}-piece`);
    await toucher(pg, tel, '[data-sm-piece] [data-sr-descendre="mA"]');
    await pg.waitForFunction(() => { try { const l = JSON.parse(localStorage.getItem('vrm_meubles')); return l.find((m) => m.id === 'mA').ordre > l.find((m) => m.id === 'mB').ordre; } catch (_) { return false; } }, null, { timeout: 6000 }).catch(() => {});
    const ms2 = await ls(pg, 'vrm_meubles');
    dit(!!ms2 && ms2.find((m) => m.id === 'mA').ordre > ms2.find((m) => m.id === 'mB').ordre, `${nom} : « La pièce » ⇒ l’Étagère passe après l’Armoire`, ms2 && ms2.map((m) => m.id + ':' + m.ordre));
    await pg.keyboard.press('Escape').catch(() => {});
    await pg.waitForTimeout(600);
    if (!tel) {
      // Glisser à la souris : N°1 (mA i 1) vers la case libre i 0.
      const de = pg.locator('[data-sm-zoom="mA"] [data-sm-case="mA:1"]'), vers = pg.locator('[data-sm-zoom="mA"] [data-sm-case="mA:0"]');
      const a = await de.boundingBox(), c = await vers.boundingBox();
      if (a && c) {
        await pg.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await pg.mouse.down();
        await pg.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2, { steps: 3 });
        await pg.mouse.move(c.x + c.width / 2, c.y + c.height / 2, { steps: 8 });
        const allume = await pg.locator('[data-sm-glisse-cible]').count();
        await capture(pg, `${nom}-glisse`);
        await pg.mouse.up();
        await pg.waitForFunction(() => { try { return JSON.parse(localStorage.getItem('vrm_slots'))['1'].i === 0; } catch (_) { return false; } }, null, { timeout: 6000 }).catch(() => {});
        const sl2 = await ls(pg, 'vrm_slots');
        dit(allume === 1, `${nom} : pendant le glisser, la case visée s’allume`);
        dit(sl2 && sl2['1'] && sl2['1'].m === 'mA' && sl2['1'].i === 0 && sl2['2'].i === 8, `${nom} : N°1 glissé dans la case libre (vrm_slots), N°2 n’a pas bougé`, sl2);
      } else dit(false, `${nom} : cases du meuble zoomé introuvables`);
    }
    dit(JSON.stringify(await ls(pg, 'vinted_annonce_numeros')) === numsAvant, `${nom} : AUCUN N° changé`);
    dit(await sansDebord(pg), `${nom} : aucun défilement de côté`);
    await capture(pg, `${nom}-fin`);
    dit(!etat.erreurs.length, `${nom} : aucune erreur`, etat.erreurs.join(' | '));
  } finally { await ctx.close(); }
}

(async () => {
  let nav;
  try {
    ({ servirTable } = await import('file://' + path.join(RACINE, 'src', 'exempleBase.js')));
    await new Promise((res) => srv.listen(PORT, res));
    nav = await chromium.launch({ executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    const seul = (process.env.BANC_SEUL || '').split(',').filter(Boolean);
    const veut = (x) => !seul.length || seul.includes(x);
    const FORMATS = (process.env.BANC_FORMATS || '390:clair,1512:clair,390:sombre,1512:sombre').split(',').map((x) => { const [l, t] = x.split(':'); return [Number(l), t === 'sombre']; });
    if (veut('V')) for (const [l, s] of FORMATS) await essaie(`V-${l}`, () => scenarioV(nav, l, s));
    if (veut('B')) for (const [l, s] of FORMATS) await essaie(`B-${l}`, () => scenarioB(nav, l, s));
    if (veut('S')) for (const [l, s] of FORMATS) await essaie(`S-${l}`, () => scenarioS(nav, l, s));
  } finally {
    if (nav) await nav.close();
    srv.close();
    console.log(`\n${ko ? '❌' : '✅'} ce-qui-manque : ${ok} vert(s), ${ko} rouge(s) · captures : ${CAPTURES}`);
    process.exit(ko ? 1 : 0);
  }
})();
