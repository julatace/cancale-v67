// ═══════════════════════════════════════════════════════════════════════════
// BANC : BAISSE DE PRIX EN SÉRIE (10 nov., lots C + AW, extension 5.336)
//        npm run build && BANC_PORT=$((20000+RANDOM%20000)) node -r ./scripts/bancs/_porte-banc.cjs scripts/bancs/baisse-prix.cjs
// ═══════════════════════════════════════════════════════════════════════════
// Le VRAI écran Annonces, une base INVENTÉE (aucune donnée réelle), un faux pont
// d'extension qui RETIENT chaque commande `baisserPrixVinted` jusqu'à ce que le
// banc la relâche (un geste « pendant » se joue sur une requête TENUE, §6.5).
// Deux comptes : atelier_test (111, ouvert dans l'onglet) et second_test (222).
//   900001 Nike Cortez 80 € · 95 j · N°41 · achat 30 € (plancher 30 €)
//   900005 Adidas Samba 70 € · 50 j · N°43 · compte 222 (PAS celui de l'onglet)
//   900002 Puma Suede 50 € · 40 j · N°42 · achat 48 €, frais confirmés (plancher 48 €)
//   900003 Asics Gel 60 € · 35 j · sans prix d'achat
//   900004 Vans 40 € · 5 j (ne dort pas)
// À LA MAIN :
//   A. Annonces → À relancer · Qui dorment : 900001, 900002, 900003 (compte de l'onglet
//      d'abord, le plus ancien d'abord), puis 900005 ; une case par ligne ; « Tout cocher » ⇒ « Baisser le prix (4) ».
//   B. La feuille, −5 € : 80→75 cochée · 70→65 « Ouvre second_test sur Vinted », jamais
//      cochable · 50→45 SOUS le plancher (48 €), ambre, DÉCOCHÉE · 60→55 cochée ;
//      « Baisser 2 prix ». −10 % : 80→72 · 60→54 (arrondi à l'euro).
//   C. « Baisser 2 prix » → « Oui, baisser » : UNE commande part (900001, prix 72, prixAvant
//      80, confirmée) et RIEN d'autre tant qu'elle n'a pas répondu ; « 1 sur 2 », Arrêter.
//      Réponse « fait, relu 72 » ⇒ la 2ᵉ part (900003). Réponse « envoyé, pas relu » ⇒
//      « Pas relu », « 60 € → — » (jamais 54). Aucune commande pour 900005 ni 900002.
//   D. Arrêter pendant la 1ʳᵉ : la 2ᵉ ne part jamais (« Pas envoyée »).
//   E. Le plafond (réponse `plafond-bordereaux`) : la série s'arrête, rien d'autre ne part.
//   F. Extension 5.335 (sans la baisse) : la feuille le dit, « Baisser » grisé, rien ne part ;
//      dans Sélectionner, « Baisser le prix… » est grisé (5.335) puis possible (5.336).
// Jugé sur des data-* et des nombres. `BANC_CAPTURE=<dossier>` : captures 390 tactile et
// 1512, clair et sombre. `BANC_DIST=<dossier>` : un autre build (preuve §6.1, mutations).
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4573;
const CAPT = process.env.BANC_CAPTURE || '';

const auj = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const sec = (j) => Math.floor((auj - j * 86400e3) / 1000);
const ACCS = [
  { id: 1, vinted_user_id: '111', login: 'atelier_test', domain: 'www.vinted.fr', updated_at: iso(auj), created_at: iso(auj - 400 * 86400e3), owner: null },
  { id: 2, vinted_user_id: '222', login: 'second_test', domain: 'www.vinted.fr', updated_at: iso(auj), created_at: iso(auj - 400 * 86400e3), owner: null },
];
const ann = (id, titre, marque, prix, jours) => ({ id, title: titre, brand: marque, size: '42', price: { amount: String(prix), currency_code: 'EUR' }, created_at_ts: sec(jours),
  is_closed: false, is_draft: false, is_hidden: false, promoted: false, view_count: 20, favourite_count: 1, url: 'https://www.vinted.fr/items/' + id });
const EN_LIGNE = {
  111: [ann(900001, 'Nike Cortez blanche', 'Nike', 80, 95), ann(900002, 'Puma Suede noire', 'Puma', 50, 40), ann(900003, 'Asics Gel Lyte', 'Asics', 60, 35), ann(900004, 'Vans Old Skool', 'Vans', 40, 5)],
  222: [ann(900005, 'Adidas Samba OG', 'Adidas', 70, 50)],
};
const ROWS = [];
for (const uid of ['111', '222']) {
  const items = EN_LIGNE[uid];
  ROWS.push({ id: `harvest_${uid}_listings`, data: { uid, type: 'listings', nItems: items.length, capturedAt: iso(auj - 60000), payload: { items, pagination: { total_entries: items.length } } } });
  ROWS.push({ id: `harvest_${uid}_orders_sold`, data: { capturedAt: iso(auj - 60000), payload: { my_orders: [] } } });
}
ROWS.push({ id: 'vinted_listing_dates', data: {} });
const NUMEROS = {
  900001: { numero: '41', buyPrice: '30', fraisComplets: true },
  900002: { numero: '42', buyPrice: '48', fraisComplets: true },
  900003: { numero: '44' },
  900004: { numero: '45' },
  900005: { numero: '43', buyPrice: '20' },
};

const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id' || src === 'updated_at') { out[alias] = row[src]; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>[^>]*$/.test(src) && typeof v !== 'object' ? String(v) : v);
  }
  return out;
};
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.onnx': 'application/octet-stream' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);

// Le faux pont : `ready`, `etat` (onglet sur 111), et les commandes. Une commande
// `baisserPrixVinted` est RETENUE : le banc la relâche avec la réponse de son choix.
const PONT = ({ version }) => {
  const post = (m) => window.postMessage(m, '*');
  window.__cmds = []; window.__attente = [];
  window.__relacher = (resp) => { const c = window.__attente.shift(); if (!c) return false; post({ __vmr: 'cmd:result', reqId: c.reqId, resp }); return true; };
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, code: version, vrm: { ok: true, connecte: true, email: '' }, vinted: { uid: '111', login: 'atelier_test' }, cmds: {} } });
    if (d.__vmr === 'cmd') {
      if (d.cmd === 'baisserPrixVinted') { window.__cmds.push({ cmd: d.cmd, uid: d.uid, id: d.id, prix: d.prix, prixAvant: d.prixAvant, confirme: d.confirme }); window.__attente.push(d); return; }
      post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: false, code: 'banc', raison: 'banc' } });
    }
  });
  post({ __vmr: 'ready', version });
};

let ko = 0, ok = 0; const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d != null && d !== '' ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 200)); } };
const TAILLES = [{ nom: '390', vp: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, { nom: '1512', vp: { width: 1512, height: 950 } }]
  .filter((t) => !process.env.BANC_TAILLE || t.nom === process.env.BANC_TAILLE);

async function page(b, T, { sombre = false, version = '5.336.0' } = {}) {
  const ctx = await b.newContext({ viewport: T.vp, isMobile: !!T.isMobile, hasTouch: !!T.hasTouch, colorScheme: sombre ? 'dark' : 'light' });
  const pg = await ctx.newPage();
  const errs = [], ecrits = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(({ n, sombre }) => { try { window.__VRM_BAISSE_PAUSE = 0; if (sessionStorage.getItem('__banc')) return; sessionStorage.setItem('__banc', '1'); localStorage.setItem('vrm_acces_direct', '1'); if (sombre) localStorage.setItem('vinted_dark', 'true'); localStorage.setItem('vinted_annonce_numeros', JSON.stringify(n)); } catch (_) {} }, { n: NUMEROS, sombre });
  await pg.addInitScript(PONT, { version });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') { ecrits.push(u); return j([]); }
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq && eq[1] === 'main') return j([projette({ id: 'main', data: { vinted_annonce_numeros: NUMEROS, ...(sombre ? { vinted_dark: true } : {}) } }, sel)]);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map((r) => projette(r, sel)));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map((r) => projette(r, sel))); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs, ecrits };
}
const ouvrirQD = async (pg) => {
  await pg.goto(`http://localhost:${PORT}/?tab=vinted_annonces`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('[data-vue-relancer]', { timeout: 30000 }).catch(() => {});
  await pg.locator('[data-vue-relancer]').first().click().catch(() => {});
  await pg.waitForSelector('[data-qui-dorment]', { timeout: 15000 }).catch(() => {});
  if (await pg.locator('[data-qd-mode-choix="dort"]').count()) { await pg.locator('[data-qd-mode-choix="dort"]').first().click(); }
  await pg.waitForSelector('[data-qd-ligne]', { timeout: 15000 }).catch(() => {});
  await pg.waitForTimeout(400);
};
const lireQD = (pg) => pg.evaluate(() => { const s = document.querySelector('[data-qui-dorment]'); if (!s) return null;
  return { lignes: [...s.querySelectorAll('[data-qd-ligne]')].map((e) => ({ id: e.getAttribute('data-qd-ligne'), age: e.getAttribute('data-qd-age'), coche: e.getAttribute('data-qd-coche') })),
    barre: (s.querySelector('[data-qd-baisser]') || { getAttribute: () => null }).getAttribute('data-qd-baisser') }; });
const lireBP = (pg) => pg.evaluate(() => { const s = document.querySelector('[data-baisse-serie]'); if (!s) return null;
  const L = {}; for (const e of s.querySelectorAll('[data-bp-ligne]')) L[e.getAttribute('data-bp-ligne')] = { coche: e.getAttribute('data-bp-coche'), ancien: e.getAttribute('data-bp-ancien'), nouveau: e.getAttribute('data-bp-nouveau'),
    sous: e.getAttribute('data-bp-sous-plancher'), bloque: e.getAttribute('data-bp-bloque'), etat: e.getAttribute('data-bp-etat'), vu: e.getAttribute('data-bp-prix-vu'), relu: (e.querySelector('[data-bp-relu]') || {}).textContent || null,
    caseOff: !!(e.querySelector('[data-bp-case]') || {}).disabled, texte: e.innerText.replace(/\s+/g, ' '), ambre: (() => { const a = e.querySelector('.vrm-bp-ambre'); return a ? getComputedStyle(a).color : null; })() };
  const lancer = s.querySelector('[data-bp-lancer]');
  return { L, phase: s.getAttribute('data-bp-phase'), lancer: lancer ? { n: lancer.getAttribute('data-bp-lancer'), off: lancer.disabled } : null,
    progres: (s.querySelector('[data-bp-progres]') || { getAttribute: () => null }).getAttribute('data-bp-progres'), ext: (s.querySelector('[data-bp-ext]') || {}).textContent || '',
    bilan: (s.querySelector('[data-bp-bilan]') || { getAttribute: () => null }).getAttribute('data-bp-bilan'), texte: s.innerText,
    deb: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    petites: [...s.querySelectorAll('button, input[type=checkbox]')].filter((x) => !x.disabled && x.getBoundingClientRect().width > 0).map((x) => { const z = x.closest('label') || x; const r = z.getBoundingClientRect(); return Math.min(r.width, r.height); }).filter((h) => h < 44).length }; });
const cmds = (pg) => pg.evaluate(() => window.__cmds.slice());
const relacher = (pg, resp) => pg.evaluate((r) => window.__relacher(r), resp);
const capture = async (pg, nom) => { if (!CAPT) return; fs.mkdirSync(CAPT, { recursive: true }); await pg.waitForTimeout(300); await pg.screenshot({ path: path.join(CAPT, nom + '.png') }).catch(() => {}); };
const ouvrirFeuille = async (pg, ids) => {
  for (const id of ids) await pg.locator(`[data-qd-case="${id}"]`).check();
  await pg.locator('[data-qd-baisser]').click();
  await pg.waitForSelector('[data-baisse-serie]', { timeout: 15000 }).catch(() => {});
  await pg.waitForTimeout(300);
};
const confirmer = async (pg) => { await pg.locator('[data-bp-lancer]').click(); await pg.waitForSelector('[data-bp-confirmer]', { timeout: 5000 }); await pg.locator('[data-bp-confirmer]').click(); };
const attendreCmds = (pg, n) => pg.waitForFunction((k) => window.__cmds.length >= k, n, { timeout: 15000 }).catch(() => {});

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const T of TAILLES) {
      for (const sombre of CAPT ? [false, true] : [T.nom === '390']) {
        const suf = `${T.nom}${sombre ? '-sombre' : '-clair'}`;
        console.log(`\n══ ${T.nom} px${T.hasTouch ? ' (tactile)' : ''}${sombre ? ' · sombre' : ' · clair'}`);
        await essaie('ABC' + suf, async () => {
          const { ctx, pg, errs, ecrits } = await page(b, T, { sombre });
          await ouvrirQD(pg);
          let q = await lireQD(pg);
          dit(q && q.lignes.map((x) => x.id).join(',') === '900001,900002,900003,900005' && q.lignes.map((x) => x.age).join(',') === '95,40,35,50', 'A1 Qui dorment : le compte de l’onglet d’abord, le plus ancien d’abord (95, 40, 35 j), puis second_test (50 j) ; la paire de 5 j n’y est pas', q && q.lignes.map((x) => x.id + ':' + x.age).join(','));
          dit(q && q.lignes.every((x) => x.coche === '0') && q.barre === '0', 'A2 une case par ligne, rien de coché d’avance, « Baisser le prix » grisé', q && JSON.stringify(q));
          await pg.locator('[data-qd-tout]').click(); await pg.waitForTimeout(200);
          q = await lireQD(pg);
          dit(q && q.barre === '4', 'A3 « Tout cocher » ⇒ « Baisser le prix (4) »', q && q.barre);
          if (CAPT) { await pg.locator('[data-qui-dorment]').first().screenshot({ path: path.join(CAPT, `qui-dorment-${suf}.png`) }).catch(() => {}); }
          await pg.locator('[data-qd-baisser]').click();
          await pg.waitForSelector('[data-baisse-serie]', { timeout: 15000 }).catch(() => {});
          await pg.waitForTimeout(400);
          let s = await lireBP(pg);
          const L = s ? s.L : {};
          dit(s && L['900001'] && L['900001'].ancien === '80' && L['900001'].nouveau === '75' && L['900001'].coche === '1', 'B1 −5 € : 80 → 75, cochée', s && JSON.stringify(L['900001']));
          dit(L['900005'] && L['900005'].coche === '0' && L['900005'].caseOff && /Ouvre second_test sur Vinted/.test(L['900005'].bloque || ''), 'B2 annonce de second_test (pas l’onglet) : « Ouvre second_test sur Vinted », case grisée', L['900005'] && JSON.stringify(L['900005']));
          dit(L['900002'] && L['900002'].nouveau === '45' && L['900002'].sous === '1' && L['900002'].coche === '0' && !L['900002'].caseOff, 'B3 50 → 45 sous le plancher (48 €) : décochée, mais il peut la cocher', L['900002'] && JSON.stringify(L['900002']));
          const amb = L['900002'] && L['900002'].ambre;
          dit(amb && !/rgb\(2[0-5]\d, [0-6]?\d, [0-6]?\d\)/.test(amb), 'B4 « Sous ton plancher » en ambre, jamais en rouge', amb);
          dit(L['900003'] && L['900003'].nouveau === '55' && L['900003'].coche === '1' && !/Plancher/.test(L['900003'].texte), 'B5 sans prix d’achat : 60 → 55, cochée, aucun plancher inventé', L['900003'] && L['900003'].texte);
          dit(s && s.lancer && s.lancer.n === '2' && !s.lancer.off, 'B6 « Baisser 2 prix »', s && JSON.stringify(s.lancer));
          dit(s && !/prix conseill|bonne affaire|vends? à/i.test(s.texte), 'B7 aucune phrase ne conseille un prix');
          await pg.locator('[data-bp-mode="pct"]').click(); await pg.locator('[data-bp-valeur]').fill('10'); await pg.waitForTimeout(250);
          s = await lireBP(pg);
          dit(s && s.L['900001'].nouveau === '72' && s.L['900003'].nouveau === '54' && s.L['900002'].nouveau === '45' && s.L['900002'].coche === '0', 'B8 −10 % : 80 → 72, 60 → 54, 50 → 45 (toujours sous le plancher, décochée)', s && ['900001', '900003', '900002'].map((k) => s.L[k].nouveau).join(','));
          dit(s && s.deb <= 0, 'B9 aucun défilement horizontal', s && s.deb);
          if (T.hasTouch) dit(s && s.petites === 0, 'B10 au doigt : chaque bouton et case fait 44 px ou plus', s && s.petites);
          await capture(pg, `feuille-apercu-${suf}`);
          dit((await cmds(pg)).length === 0, 'B11 rien n’est parti avant son clic');
          // C — une à la fois, prix relu.
          await confirmer(pg);
          await attendreCmds(pg, 1); await pg.waitForTimeout(600);
          let c = await cmds(pg);
          s = await lireBP(pg);
          dit(c.length === 1 && c[0].id === '900001' && c[0].uid === '111' && c[0].prix === 72 && c[0].prixAvant === 80 && c[0].confirme === true, 'C1 UNE commande part : 900001, compte 111, 72 € (avant 80 €), confirmée', JSON.stringify(c));
          dit(s && s.progres === '1/2' && s.L['900001'].etat === 'envoi' && (await pg.locator('[data-bp-arreter]').count()) === 1, 'C2 « 1 sur 2 », la ligne en cours, « Arrêter » visible', s && s.progres);
          await capture(pg, `feuille-envoi-${suf}`);
          await relacher(pg, { accepte: true, etape: 'fait', ancien: 80, voulu: 72, prixVu: 72, nouveau: 72 });
          await attendreCmds(pg, 2); await pg.waitForTimeout(400);
          c = await cmds(pg);
          dit(c.length === 2 && c[1].id === '900003' && c[1].prix === 54 && c[1].prixAvant === 60, 'C3 la 2ᵉ part APRÈS la réponse de la 1ʳᵉ (900003, 54 €)', JSON.stringify(c.map((x) => x.id)));
          await relacher(pg, { accepte: true, etape: 'incertain', ancien: 60, voulu: 54, prixVu: null, raison: 'Vinted a accepté, mais VRM n’a pas pu relire le prix : regarde l’annonce' });
          await pg.waitForSelector('[data-bp-bilan]', { timeout: 10000 }).catch(() => {});
          s = await lireBP(pg);
          dit(s && s.L['900001'].etat === 'fait' && s.L['900001'].vu === '72' && /72/.test(s.L['900001'].relu || '') && /relu sur Vinted/.test(s.L['900001'].texte), 'C4 900001 « Fait », 72 € RELU sur Vinted', s && JSON.stringify(s.L['900001']));
          dit(s && s.L['900003'].etat === 'incertain' && s.L['900003'].relu === '—' && !/54/.test(s.L['900003'].texte) && /Pas relu/.test(s.L['900003'].texte), 'C5 900003 envoyée pas relue : « Pas relu », « 60 € → — », jamais 54 €', s && s.L['900003'].texte);
          dit(s && s.bilan === '1/0/1/0/0', 'C6 le bilan : 1 baissé, 1 pas relu', s && s.bilan);
          c = await cmds(pg);
          dit(c.length === 2 && !c.some((x) => x.id === '900005' || x.id === '900002'), 'C7 aucune commande pour l’autre compte (900005) ni pour la décochée sous le plancher (900002)', JSON.stringify(c.map((x) => x.id)));
          dit(!ecrits.some((u) => /cmd_relais|vinted_offres_auto/.test(u)), 'C8 rien de programmé, aucun relais posé', ecrits.filter((u) => /cmd|offres/.test(u)).join(','));
          await capture(pg, `feuille-bilan-${suf}`);
          await pg.locator('[data-bp-fermer-fin]').click(); await pg.waitForTimeout(400);
          q = await lireQD(pg);
          dit(q && q.lignes.every((x) => x.coche === '0'), 'C9 après la série, les cases sont décochées', q && JSON.stringify(q.lignes));
          const prixLigne = await pg.evaluate(() => { const e = document.querySelector('[data-qd-ligne="900001"]'); return e ? e.innerText.replace(/\s+/g, ' ') : ''; });
          dit(/72/.test(prixLigne) && !/80/.test(prixLigne), 'C10 la liste montre le prix RELU (72 €)', prixLigne);
          dit(errs.length === 0, 'aucune erreur d’app', errs.join(' | ').slice(0, 200));
          await ctx.close();
        });
      }
      if (T.nom !== '1512') continue;
      await essaie('D', async () => {
        console.log('── D. Arrêter');
        const { ctx, pg, errs } = await page(b, T);
        await ouvrirQD(pg); await ouvrirFeuille(pg, ['900001', '900003']);
        await confirmer(pg); await attendreCmds(pg, 1); await pg.waitForTimeout(300);
        await pg.locator('[data-bp-arreter]').click();
        await relacher(pg, { accepte: true, etape: 'fait', ancien: 80, voulu: 75, prixVu: 75 });
        await pg.waitForSelector('[data-bp-bilan]', { timeout: 10000 }).catch(() => {});
        await pg.waitForTimeout(500);
        const c = await cmds(pg), s = await lireBP(pg);
        dit(c.length === 1 && s && s.L['900003'].etat === 'pas-envoye' && /Arrêtée/.test(s.L['900003'].texte), 'D1 Arrêter pendant la 1ʳᵉ : la 2ᵉ ne part jamais, « Pas envoyée — Arrêtée par toi »', `${c.length} ${s && s.L['900003'].texte}`);
        dit(errs.length === 0, 'aucune erreur d’app', errs.join(' | ').slice(0, 200));
        await ctx.close();
      });
      await essaie('E', async () => {
        console.log('── E. Le plafond arrête la série');
        const { ctx, pg } = await page(b, T);
        await ouvrirQD(pg); await ouvrirFeuille(pg, ['900001', '900003']);
        await confirmer(pg); await attendreCmds(pg, 1); await pg.waitForTimeout(300);
        await relacher(pg, { accepte: false, code: 'plafond-bordereaux', raison: '45 actions sur ce compte dans l’heure — les 5 dernières sont gardées pour répondre à tes acheteurs. La suite dans 12 min.' });
        await pg.waitForSelector('[data-bp-bilan]', { timeout: 10000 }).catch(() => {});
        await pg.waitForTimeout(500);
        const c = await cmds(pg), s = await lireBP(pg);
        dit(c.length === 1 && s && s.L['900001'].etat === 'refus' && s.L['900003'].etat === 'pas-envoye' && /12 min/.test(s.L['900003'].texte), 'E1 plafond atteint : la série s’arrête, la suivante « Pas envoyée » avec la raison, rien d’autre ne part', `${c.length} ${s && s.L['900003'].texte}`);
        await ctx.close();
      });
      await essaie('F', async () => {
        console.log('── F. Extension sans la baisse (5.335)');
        const { ctx, pg } = await page(b, T, { version: '5.335.0' });
        await ouvrirQD(pg); await ouvrirFeuille(pg, ['900001']);
        const s = await lireBP(pg);
        dit(s && /5\.336/.test(s.ext) && s.lancer && s.lancer.off, 'F1 extension 5.335 : la feuille dit « mets à jour (5.336) », « Baisser » grisé', s && `${s.ext} ${JSON.stringify(s.lancer)}`);
        dit((await cmds(pg)).length === 0, 'F2 rien ne part');
        await capture(pg, 'feuille-extension-ancienne-1512');
        await ctx.close();
      });
      await essaie('G', async () => {
        console.log('── G. Sélectionner → « Baisser le prix… »');
        for (const version of ['5.335.0', '5.336.0']) {
          const { ctx, pg } = await page(b, T, { version });
          await pg.goto(`http://localhost:${PORT}/?tab=vinted_annonces`, { waitUntil: 'domcontentloaded' });
          await pg.waitForSelector('[data-vue-relancer]', { timeout: 30000 }).catch(() => {});
          await pg.evaluate(() => { const b = [...document.querySelectorAll('.vrm-stock-views button, [data-vue-selection], button')].find((x) => /^Sélectionner/.test((x.innerText || '').trim())); if (b) b.click(); });
          await pg.waitForTimeout(800);
          const coches = await pg.evaluate(() => { const L = [...document.querySelectorAll('[data-choix-annonce], [data-sel-annonce], input[type=checkbox]')]; return L.length; });
          await pg.evaluate(() => { const x = [...document.querySelectorAll('[data-choix-id="900001"], [data-sel-id="900001"]')][0]; if (x) x.click(); });
          await pg.evaluate(() => { const lab = [...document.querySelectorAll('label, li, button')].find((e) => /Nike Cortez/.test(e.innerText || '') && e.querySelector && e.querySelector('input[type=checkbox]')); if (lab) lab.querySelector('input[type=checkbox]').click(); });
          await pg.waitForTimeout(300);
          await pg.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /^Actions/.test((x.innerText || '').trim())); if (b) b.click(); });
          await pg.waitForSelector('[data-action-sel="baisser"]', { timeout: 8000 }).catch(() => {});
          const etat = await pg.evaluate(() => { const e = document.querySelector('[data-action-sel="baisser"]'); return e ? e.getAttribute('data-action-sel-ok') : null; });
          dit(etat === (version === '5.336.0' ? 'oui' : 'non'), `G1 extension ${version} : « Baisser le prix… » ${version === '5.336.0' ? 'possible' : 'grisé'}`, `${etat} (cases ${coches})`);
          if (version === '5.336.0' && etat === 'oui') {
            await pg.locator('[data-action-sel="baisser"] button').click();
            await pg.waitForSelector('[data-baisse-serie]', { timeout: 15000 }).catch(() => {});
            const s = await lireBP(pg);
            dit(s && s.L['900001'] && s.L['900001'].nouveau === '75', 'G2 la même feuille s’ouvre depuis Sélectionner (900001 : 80 → 75)', s && JSON.stringify(Object.keys(s.L)));
            await capture(pg, 'feuille-depuis-selection-1512');
          }
          await ctx.close();
        }
      });
    }
  } catch (e) { dit(false, 'le banc s’exécute', String(e.message || e).slice(0, 200)); }
  finally {
    if (b) await b.close(); srv.close();
    console.log(ko ? `\n❌ baisse-prix : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ baisse-prix : ${ok} verts, 0 rouge`);
    process.exit(ko ? 1 : 0);
  }
})();
