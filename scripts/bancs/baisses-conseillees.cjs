// ═══════════════════════════════════════════════════════════════════════════
// BANC : VENDRE PLUS (15 nov.) — baisses conseillées, relance des favoris, loupe (stock)
//        npm run build && BANC_PORT=$((20000+RANDOM%20000)) node -r ./scripts/bancs/_porte-banc.cjs scripts/bancs/baisses-conseillees.cjs
// ═══════════════════════════════════════════════════════════════════════════
// Le VRAI build, une base INVENTÉE (aucune donnée réelle), un faux pont d'extension (5.381) qui
// RETIENT chaque `baisserPrixVinted` (un geste « pendant » se joue sur une requête TENUE, §6.5).
// Compte atelier_test (111, ouvert dans l'onglet) :
//   900001 Nike Cortez 80 € · 95 j · achat 30 · 300 vues, 0 favori ⇒ BAISSER à 72 € (−10 %, le prix freine)
//   900006 Saucony Jazz 100 € · 45 j · achat 40 · 80 vues, 1 favori ⇒ BAISSER à 95 € (douce)
//   900002 Puma Suede 50 € · 40 j · achat 48 ⇒ GARDER (au plancher)
//   900007 Reebok Club 70 € · 60 j · achat 20 · 6 favoris ⇒ GARDER, offre aux favoris d'abord
//   900003 Asics Gel 60 € · 35 j · sans prix d'achat ⇒ « Prix d'achat ? »
//   900004 Vans 40 € · 5 j ⇒ rien (aucun prix à la mise en ligne)
// À LA MAIN (et ce que le banc juge, sur des data-* et des nombres) :
//   A. Annonces → À relancer · Qui dorment : la tuile « 2 baisses conseillées » ; la feuille : 900001 72,
//      900006 95 (baisser d'abord), 900002 garder (plancher), 900007 garder (favoris), 900003 achat ;
//      900004 absente ; aucun défilement horizontal ; au doigt, 44 px ;
//   B. « Appliquer les 2 baisses » ⇒ la feuille EXISTANTE « Baisser le prix », les prix conseillés (72, 95),
//      sans réglage −€/−% ; « Oui, baisser » ⇒ UNE commande (900001, 72, avant 80), rien d'autre tant
//      qu'elle n'a pas répondu ;
//   C. La loupe : « pile du fond » ⇒ les paires rangées là, par leur rangement ; « 77 » (rangé, sans
//      fiche) ⇒ un résultat Stock ;
//   D. Ma journée : « 6 personnes aiment N°47 » ; son geste prépare Messages → Favoris pour 900007.
// `BANC_CAPTURE=<dossier>` : captures 390 tactile et 1512, clair et sombre. `BANC_DIST=<dossier>` : un autre build.
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4627;
const CAPT = process.env.BANC_CAPTURE || '';

const auj = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const sec = (j) => Math.floor((auj - j * 86400e3) / 1000);
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'atelier_test', domain: 'www.vinted.fr', updated_at: iso(auj), created_at: iso(auj - 400 * 86400e3), owner: null }];
const ann = (id, titre, marque, prix, jours, vues, fav) => ({ id, title: titre, brand: marque, size: '42', price: { amount: String(prix), currency_code: 'EUR' }, created_at_ts: sec(jours),
  is_closed: false, is_draft: false, is_hidden: false, promoted: false, view_count: vues, favourite_count: fav, url: 'https://www.vinted.fr/items/' + id });
const ITEMS = [ann(900001, 'Nike Cortez blanche', 'Nike', 80, 95, 300, 0), ann(900006, 'Saucony Jazz Original', 'Saucony', 100, 45, 80, 1), ann(900002, 'Puma Suede noire', 'Puma', 50, 40, 60, 1),
  ann(900007, 'Reebok Club C 85', 'Reebok', 70, 60, 90, 6), ann(900003, 'Asics Gel Lyte', 'Asics', 60, 35, 70, 1), ann(900004, 'Vans Old Skool', 'Vans', 40, 5, 10, 0)];
const ROWS = [
  { id: 'harvest_111_listings', data: { uid: '111', type: 'listings', nItems: ITEMS.length, capturedAt: iso(auj - 60000), payload: { items: ITEMS, pagination: { total_entries: ITEMS.length } } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: iso(auj - 60000), payload: { my_orders: [] } } },
  { id: 'vinted_listing_dates', data: {} },
];
const NUMEROS = {
  900001: { numero: '41', buyPrice: '30', fraisComplets: true }, 900006: { numero: '46', buyPrice: '40', fraisComplets: true },
  900002: { numero: '42', buyPrice: '48', fraisComplets: true }, 900007: { numero: '47', buyPrice: '20', fraisComplets: true },
  900003: { numero: '44' }, 900004: { numero: '45' },
};
const PLAN = { rooms: [{ id: 'r1', name: 'Garage', items: [{ id: 'p1', name: 'Pile du fond', type: 'pile', nums: ['41', '46', '77'] }] }], active: 'r1' };

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
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);

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
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 240)); } };
const TAILLES = [{ nom: '390', vp: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, { nom: '1512', vp: { width: 1512, height: 950 } }]
  .filter((t) => !process.env.BANC_TAILLE || t.nom === process.env.BANC_TAILLE);
const capture = async (pg, nom, sel) => { if (!CAPT) return; fs.mkdirSync(CAPT, { recursive: true }); await pg.waitForTimeout(350); const l = sel ? pg.locator(sel).first() : null; await (l ? l.screenshot({ path: path.join(CAPT, nom + '.png') }) : pg.screenshot({ path: path.join(CAPT, nom + '.png') })).catch(() => {}); };

async function page(b, T, { sombre = false, version = '5.381.0' } = {}) {
  const ctx = await b.newContext({ viewport: T.vp, isMobile: !!T.isMobile, hasTouch: !!T.hasTouch, colorScheme: sombre ? 'dark' : 'light' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(({ n, sombre, plan }) => { try { window.__VRM_BAISSE_PAUSE = 0; if (sessionStorage.getItem('__banc')) return; sessionStorage.setItem('__banc', '1'); localStorage.setItem('vrm_acces_direct', '1'); if (sombre) localStorage.setItem('vinted_dark', 'true'); localStorage.setItem('vinted_annonce_numeros', JSON.stringify(n)); localStorage.setItem('vrm_room_plan', JSON.stringify(plan)); } catch (_) {} }, { n: NUMEROS, sombre, plan: PLAN });
  await pg.addInitScript(PONT, { version });
  // Ce que le geste de la carte prépare pour Messages → Favoris (relu ensuite, même s'il est déjà consommé).
  await pg.addInitScript(() => { const o = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === 'vrm_favoris_prepare') window.__prep = v; return o.call(this, k, v); }; });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) || /^https?:\/\/[^/]*vinted\.net\//i.test(r.request().url()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') return j([]);
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
  return { ctx, pg, errs };
}
const ouvrirQD = async (pg) => {
  await pg.goto(`http://localhost:${PORT}/?tab=vinted_annonces`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('[data-vue-relancer]', { timeout: 40000 }).catch(() => {});
  await pg.locator('[data-vue-relancer]').first().click().catch(() => {});
  await pg.waitForSelector('[data-qui-dorment]', { timeout: 20000 }).catch(() => {});
  if (await pg.locator('[data-qd-mode-choix="dort"]').count()) await pg.locator('[data-qd-mode-choix="dort"]').first().click();
  await pg.waitForSelector('[data-bc-entree]', { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(300);
};
const lireBC = (pg) => pg.evaluate(() => { const s = document.querySelector('[data-bc-feuille]'); if (!s) return null;
  const L = {}; for (const e of s.querySelectorAll('[data-bc-ligne]')) L[e.getAttribute('data-bc-ligne')] = { d: e.getAttribute('data-bc-decision'), sugg: e.getAttribute('data-bc-sugg'), geste: e.getAttribute('data-bc-geste'), raisons: (e.querySelector('[data-bc-raisons]') || { getAttribute: () => '' }).getAttribute('data-bc-raisons') };
  return { L, ordre: [...s.querySelectorAll('[data-bc-ligne]')].map((e) => e.getAttribute('data-bc-ligne')), tout: (s.querySelector('[data-bc-appliquer-tout]') || { getAttribute: () => null }).getAttribute('data-bc-appliquer-tout'),
    deb: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    petites: [...s.querySelectorAll('button, input[type=checkbox]')].filter((x) => !x.disabled && x.getBoundingClientRect().width > 0).map((x) => { const r = (x.closest('label') || x).getBoundingClientRect(); return Math.min(r.width, r.height); }).filter((v) => v < 43.5).length,
    texte: s.innerText.slice(0, 400) }; });

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const T of TAILLES) {
      for (const sombre of CAPT ? [false, true] : [false]) {
        const suf = `${T.nom}${sombre ? '-sombre' : '-clair'}`;
        console.log(`\n══ ${T.nom} px${T.hasTouch ? ' (tactile)' : ''}${sombre ? ' · sombre' : ' · clair'}`);
        await essaie('AB' + suf, async () => {
          const { ctx, pg, errs } = await page(b, T, { sombre });
          await ouvrirQD(pg);
          const n = await pg.locator('[data-bc-entree]').first().getAttribute('data-bc-entree').catch(() => null);
          dit(n === '2', 'A1 la tuile « 2 baisses conseillées » au-dessus de Qui dorment', n);
          await capture(pg, `qd-entree-${suf}`);
          await pg.locator('[data-bc-entree]').first().click();
          await pg.waitForSelector('[data-bc-feuille]', { timeout: 10000 }).catch(() => {});
          const f = await lireBC(pg);
          dit(f && f.L['900001'] && f.L['900001'].d === 'baisser' && f.L['900001'].sugg === '72' && /bc\.r\.freine/.test(f.L['900001'].raisons), 'A2 Nike Cortez : 300 vues, aucun favori ⇒ « Baisser à 72 € ? »', f && JSON.stringify(f.L['900001']));
          dit(f && f.L['900006'] && f.L['900006'].d === 'baisser' && f.L['900006'].sugg === '95', 'A3 Saucony : la baisse douce ⇒ 95 €', f && JSON.stringify(f.L['900006']));
          dit(f && f.L['900002'] && f.L['900002'].d === 'garder' && /bc\.r\.plancher/.test(f.L['900002'].raisons), 'A4 Puma (achat 48 € sur 50 €) ⇒ garder, au plancher', f && JSON.stringify(f.L['900002']));
          dit(f && f.L['900007'] && f.L['900007'].d === 'garder' && f.L['900007'].geste === 'favoris', 'A5 Reebok, 6 favoris ⇒ garder, offre aux favoris d’abord', f && JSON.stringify(f.L['900007']));
          dit(f && f.L['900003'] && f.L['900003'].d === 'achat' && f.L['900003'].sugg == null, 'A6 Asics sans prix d’achat ⇒ « Prix d’achat ? », aucun montant', f && JSON.stringify(f.L['900003']));
          dit(f && !f.L['900004'] && f.ordre.slice(0, 2).sort().join(',') === '900001,900006', 'A7 Vans (5 j) absente ; les baisses d’abord', f && f.ordre.join(','));
          dit(f && f.deb <= 0, 'A8 aucun défilement horizontal', f && f.deb);
          if (T.hasTouch) dit(f && f.petites === 0, 'A9 au doigt : chaque bouton et case fait 44 px ou plus', f && f.petites);
          await capture(pg, `baisses-conseillees-${suf}`, '.vrm-bc');
          // B — Appliquer ⇒ la baisse en série existante
          await pg.locator('[data-bc-appliquer-tout]').click();
          await pg.waitForSelector('[data-baisse-serie]', { timeout: 10000 }).catch(() => {});
          const bp = await pg.evaluate(() => { const s = document.querySelector('[data-baisse-serie]'); if (!s) return null; const L = {}; for (const e of s.querySelectorAll('[data-bp-ligne]')) L[e.getAttribute('data-bp-ligne')] = { n: e.getAttribute('data-bp-nouveau'), c: e.getAttribute('data-bp-coche') };
            return { L, cibles: (s.querySelector('[data-bp-cibles]') || { getAttribute: () => null }).getAttribute('data-bp-cibles'), reglage: !!s.querySelector('[data-bp-valeur]'), varier: !!s.querySelector('[data-bp-varier]') }; });
          dit(bp && bp.cibles === '2' && bp.L['900001'] && bp.L['900001'].n === '72' && bp.L['900006'].n === '95' && !bp.reglage && !bp.varier, 'B1 « Appliquer les 2 baisses » ⇒ la feuille « Baisser le prix », prix conseillés 72 et 95, sans −€/−% ni « Varier »', bp && JSON.stringify(bp));
          await capture(pg, `baisse-cibles-${suf}`, '.vrm-bp');
          dit((await pg.evaluate(() => window.__cmds.length)) === 0, 'B2 rien n’est parti avant son clic');
          // 5.370+ : « Dans les 4 h » est proposé d'abord (discrétion) ; le banc choisit « Maintenant ».
          if (await pg.locator('[data-bp-quand="maintenant"]').count()) await pg.locator('[data-bp-quand="maintenant"]').first().click();
          await pg.locator('[data-bp-lancer]').click(); await pg.waitForSelector('[data-bp-confirmer]', { timeout: 5000 }); await pg.locator('[data-bp-confirmer]').click();
          await pg.waitForFunction(() => window.__cmds.length >= 1, null, { timeout: 15000 }).catch(() => {});
          await pg.waitForTimeout(500);
          const c1 = await pg.evaluate(() => window.__cmds.slice());
          dit(c1.length === 1 && String(c1[0].id) === '900001' && c1[0].prix === 72 && c1[0].prixAvant === 80 && c1[0].confirme === true, 'B3 UNE commande (900001, 72 €, avant 80 €), rien d’autre tant qu’elle n’a pas répondu', JSON.stringify(c1));
          await pg.evaluate(() => window.__relacher({ accepte: true, etape: 'fait', prixVu: 72, ancien: 80 }));
          await pg.waitForFunction(() => window.__cmds.length >= 2, null, { timeout: 15000 }).catch(() => {});
          const c2 = await pg.evaluate(() => window.__cmds.slice());
          dit(c2.length === 2 && String(c2[1].id) === '900006' && c2[1].prix === 95, 'B4 la réponse reçue ⇒ la suivante (900006, 95 €)', JSON.stringify(c2));
          await pg.evaluate(() => window.__relacher({ accepte: true, etape: 'fait', prixVu: 95, ancien: 100 }));
          dit(!errs.length, 'B5 aucune erreur de page', errs.slice(0, 2).join(' | '));
          await ctx.close();
        });
        await essaie('C' + suf, async () => {
          const { ctx, pg, errs } = await page(b, T, { sombre });
          await pg.goto(`http://localhost:${PORT}/?tab=vinted_annonces`, { waitUntil: 'domcontentloaded' });
          await pg.waitForSelector('[data-vue-relancer]', { timeout: 40000 }).catch(() => {});
          if (T.hasTouch) await pg.locator('button[data-recherche-loupe]').first().tap(); else await pg.locator('[data-recherche-champ]').first().click();
          for (let i = 0; i < 60; i++) { if (await pg.evaluate(() => { const p = document.querySelector('[data-recherche-panneau]'); return !!(p && p.getAttribute('data-recherche-pret') === '1'); })) break; await pg.waitForTimeout(250); }
          await pg.locator('[data-recherche-champ]').first().fill('pile du fond');
          await pg.waitForTimeout(900);
          const r = await pg.evaluate(() => [...document.querySelectorAll('[data-recherche-resultat]')].map((x) => [x.getAttribute('data-recherche-resultat'), x.getAttribute('data-recherche-par'), x.getAttribute('data-recherche-num')]));
          const paires = r.filter((x) => x[0] === 'paire' && x[1] === 'rangement').map((x) => x[2]).sort().join(',');
          dit(paires === '41,46' && r.some((x) => x[0] === 'stock' && x[2] === '77'), 'C1 « pile du fond » ⇒ les N°41 et 46 par leur rangement, et le 77 (rangé, sans fiche) dans Stock', JSON.stringify(r));
          await capture(pg, `loupe-stock-${suf}`);
          dit(!errs.length, 'C2 aucune erreur de page', errs.slice(0, 2).join(' | '));
          await ctx.close();
        });
        await essaie('D' + suf, async () => {
          const { ctx, pg, errs } = await page(b, T, { sombre });
          await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
          await pg.waitForSelector('[data-rf-carte]', { timeout: 45000 }).catch(() => {});
          const rf = await pg.evaluate(() => { const s = document.querySelector('[data-rf-carte]'); if (!s) return null; return { n: s.getAttribute('data-rf-carte'), l: [...s.querySelectorAll('[data-rf-ligne]')].map((e) => [e.getAttribute('data-rf-ligne'), e.getAttribute('data-rf-personnes'), e.getAttribute('data-rf-depuis')]), texte: s.innerText, deb: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
          dit(rf && rf.l.length === 1 && rf.l[0][0] === 'vinted:900007' && rf.l[0][1] === '6' && /N°47/.test(rf.texte), 'D1 Ma journée : « 6 personnes aiment N°47 » (Reebok, rien depuis 60 j)', rf && JSON.stringify(rf));
          dit(rf && rf.deb <= 0, 'D2 aucun défilement horizontal', rf && rf.deb);
          await capture(pg, `relance-favoris-${suf}`, '[data-rf-carte]');
          if (rf) {
            await pg.locator('[data-rf-geste="favoris"]').first().click().catch(() => {});
            await pg.waitForTimeout(600);
            const prep = await pg.evaluate(() => { try { return JSON.parse(window.__prep || 'null'); } catch (_) { return 'x'; } });
            const cmdsD = await pg.evaluate(() => window.__cmds.length);
            dit(prep && prep.item === '900007' && prep.uid === '111' && cmdsD === 0, 'D3 le geste prépare Messages → Favoris pour CETTE annonce (900007), rien n’est envoyé', JSON.stringify(prep) + ' · ' + cmdsD + ' commande(s)');
          }
          dit(!errs.length, 'D4 aucune erreur de page', errs.slice(0, 2).join(' | '));
          await ctx.close();
        });
      }
    }
  } catch (e) { dit(false, 'banc', String(e.message || e).slice(0, 300)); }
  finally { if (b) await b.close().catch(() => {}); srv.close(); }
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
