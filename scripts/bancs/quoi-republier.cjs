// ═══════════════════════════════════════════════════════════════════════════
// BANC : « QUELLES ANNONCES REPUBLIER ? » (11 nov., lot quoi-republier)
//        npm run build && node -r ./scripts/bancs/_porte-banc.cjs scripts/bancs/quoi-republier.cjs
// ═══════════════════════════════════════════════════════════════════════════
// Une base INVENTÉE (aucune donnée réelle), horloge fixée au 20 novembre 2026, 15 h.
// Un compte Vinted (111) :
//   5002 N°13 · 95 j · 10 vues · 0 favori        ⇒ proposée
//   5004 N°15 · 40 j · vues et favoris PAS lus   ⇒ « à vérifier »
//   5006 N°17 · 45 j · 120 vues · 3 favoris      ⇒ elle marche, pas proposée
//   50 annonces au MÊME titre · 70 j · 2 vues · 0 favori ⇒ 50 lignes proposées
//   5008 · 5 j                                    ⇒ trop récente
// Leboncoin (reliées par leur référence VRM) : N°13 en ligne depuis 60 j, 8 vues, 0 favori
// ⇒ proposée ; N°15 depuis 50 j, jamais relevée ⇒ « à vérifier » ; N°17 depuis 70 j,
// 300 vues, 5 favoris ⇒ pas proposée.
// À LA MAIN :
//   A. Annonces → Republier : la carte dit 51 (+ 1 à vérifier) ; la 1re ligne est 5002,
//      « 95 j en ligne · 0 favori · 10 vues » ; 5004 « favoris pas lus · vues pas lues »
//      (jamais 0) ; un toucher la coche DANS la liste de l'atelier (« Par VRM · 1 »),
//      un second la décoche ; « Tout cocher (51) » ⇒ « Par VRM · 51 » ; régler 90 j ⇒ 1 ;
//      rien n'est envoyé à l'extension.
//   B. Ma journée : « 51 annonces anciennes et peu vues » ; « Voir » ⇒ Annonces → Republier.
//   C. Leboncoin → Republier sur Leboncoin : la carte dit 1 (+ 1 à vérifier) ; un toucher
//      coche la N°13 dans l'atelier ; « Continuer (1) » ; aucune suppression envoyée.
// Jugé sur des data-* et des nombres. `BANC_CAPTURE=<dossier>` : captures 390 tactile et 1512.
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4517;
const CAPT = process.env.BANC_CAPTURE || '';

const MAINTENANT = new Date(2026, 10, 20, 15, 0, 0);
const iso = (d) => d.toISOString();
const sec = (d) => Math.floor(d.getTime() / 1000);
const ilya = (j) => new Date(MAINTENANT.getTime() - j * 86400000);
const MON = '8442aaaa-0000-4000-8000-000000000001';
const accounts = [{ id: 1, vinted_user_id: '111', login: 'atelier_sneak', domain: 'www.vinted.fr', updated_at: iso(MAINTENANT), created_at: iso(new Date(2025, 0, 1)), owner: null }];
const ann = (id, titre, j, vues, fav) => ({ id, title: titre, price: { amount: '80', currency_code: 'EUR' }, created_at_ts: sec(ilya(j)), ...(vues != null ? { view_count: vues } : {}), ...(fav != null ? { favourite_count: fav } : {}), is_closed: false, is_hidden: false, is_draft: false, promoted: false, photo: { url: 'https://img.test/v' + id + '.jpg' } });
const MEME = 'Nike Air Force 1 blanche taille 42';
const ITEMS = [
  ann(5002, 'Nike Air Max 1 Treeline taille 42', 95, 10, 0),
  ann(5004, 'Salomon XT-6 blanc taille 40', 40, null, null),
  ann(5006, 'Asics Gel Kayano 14 taille 43', 45, 120, 3),
  ...Array.from({ length: 50 }, (_, i) => ann(710000 + i, MEME, 70, 2, 0)),
  ann(5008, 'Vans Old Skool taille 40', 5, 4, 0),
];
const MAIN = { vinted_annonce_numeros: {
  '5002': { numero: '13', title: ITEMS[0].title, mp: { lbc: true } },
  '5004': { numero: '15', title: ITEMS[1].title, mp: { lbc: true } },
  '5006': { numero: '17', title: ITEMS[2].title, mp: { lbc: true } },
} };
const lbc = (id, ref, titre, j, stats) => ({ id, subject: titre, price: 80, ref, account: MON, accountName: 'Totomondu', platform: 'leboncoin', status: 'active', seenAt: iso(MAINTENANT), publieeLe: iso(ilya(j)), url: 'https://www.leboncoin.fr/ad/chaussures/' + id, images: [], ...(stats ? { stats: { ...stats, at: iso(MAINTENANT) } } : {}) });
const LBC = {
  '3290000013': lbc('3290000013', '13', 'Nike Air Max 1 Treeline T42', 60, { favoris: 0, vues: 8 }),
  '3290000015': lbc('3290000015', '15', 'Salomon XT-6 blanc T40', 50, null),
  '3290000017': lbc('3290000017', '17', 'Asics Gel Kayano 14 T43', 70, { favoris: 5, vues: 300 }),
};
const rows = [
  { id: 'harvest_111_listings', data: { capturedAt: iso(new Date(MAINTENANT.getTime() - 60000)), payload: { items: ITEMS, pagination: { total_entries: ITEMS.length } } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: iso(MAINTENANT), payload: { my_orders: [] } } },
  { id: 'vinted_listing_dates', data: {} },
  { id: 'vinted_lbc_posted', data: { ids: ['5002', '5004', '5006'], updatedAt: iso(ilya(3)) } },
  { id: 'lbc_listings', data: { items: LBC, lectures: { [MON]: { at: iso(new Date(MAINTENANT.getTime() - 60000)), total: 3, n: 3 } } } },
  { id: 'lbc_accounts', data: { accounts: { [MON]: { id: MON, name: 'Totomondu', type: 'particulier', sessionAt: iso(MAINTENANT), source: 'session:messagerie' } } } },
  { id: 'lbc_ventes', data: { ventes: {} } },
  { id: 'ebay_orders', data: { orders: [] } },
];

function projette(row, select) {
  if (!select || select === '*') return row;
  const out = {};
  for (const part of select.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const alias = m[1] || m[2].split('->').pop().replace(/^>/, ''); const src = m[2];
    if (src === 'id' || src === 'updated_at') { out[alias] = row[src] || (src === 'updated_at' ? iso(MAINTENANT) : null); continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (/^data(->|->>)/.test(src)) { const reste = src.replace(/^data(->>|->)/, ''); let v = row.data;
      for (const seg of reste.split(/->>|->/)) v = (v == null ? null : v[seg.replace(/^"|"$/g, '')]); out[alias] = (v == null) ? null : (/->>[^>]*$/.test(src) && typeof v !== 'object' ? String(v) : v); continue; }
    out[alias] = row[src];
  }
  return out;
}
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.onnx': 'application/octet-stream' };
const srv = http.createServer((q, r) => { let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p)); });
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);

let ko = 0, ok = 0; const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d != null && d !== '' ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 200)); } };
const TAILLES = [{ nom: '1512', vp: { width: 1512, height: 950 } }, { nom: '390', vp: { width: 390, height: 844 }, isMobile: true, hasTouch: true }].filter((t) => !process.env.BANC_TAILLE || t.nom === process.env.BANC_TAILLE);

// Une extension à jour dans la page : elle note chaque commande (aucune ne doit partir).
const PONT = () => {
  window.__cmds = [];
  const version = '5.344.0';
  const post = (m) => window.postMessage(m, '*');
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version, id: 'ext-banc' });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, code: version, ext: 'ext-banc', vrm: { ok: true, connecte: true, email: '' }, vinted: null, cmds: {}, lbcSupprime: true } });
    if (d.__vmr === 'cmd') { window.__cmds.push(d.cmd || '?'); setTimeout(() => post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: false, code: 'banc', raison: 'banc' } }), 50); }
  });
  post({ __vmr: 'ready', version, id: 'ext-banc' });
};
async function page(b, T, opts = {}) {
  const ctx = await b.newContext({ viewport: T.vp, isMobile: !!T.isMobile, hasTouch: !!T.hasTouch, locale: 'fr-FR', colorScheme: opts.sombre ? 'dark' : 'light' });
  const pg = await ctx.newPage();
  await pg.clock.setFixedTime(MAINTENANT);
  const errs = [], posts = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((sombre) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_langue', JSON.stringify('fr')); if (sombre) localStorage.setItem('vinted_dark', 'true'); } catch (_) {} }, !!opts.sombre);
  if (opts.pont) await pg.addInitScript(PONT);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') {
      try { const corps = JSON.parse(route.request().postData() || 'null'); for (const x of [].concat(corps || [])) if (x && x.id) posts.push(String(x.id)); } catch (_) {}
      return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' }); }
    if (/select=owner/.test(u)) return j([{ owner: '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b' }]);
    const S = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(accounts);
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq && eq[1] === 'main') return j([projette({ id: 'main', data: MAIN }, S)]);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map((r) => projette(r, S)));
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(',').map((x) => x.replace(/^"|"$/g, '')); return j(rows.filter((r) => ids.includes(r.id)).map((r) => projette(r, S))); }
    const lk = /id=like\.([^&]*)/.exec(u); if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$');
      return j(rows.filter((r) => re.test(r.id)).map((r) => projette(r, S))); }
    return j([]);
  });
  await pg.route('**/api/**', (r2) => r2.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true,"devices":1}' }));
  return { ctx, pg, errs, posts };
}
const aller = async (pg, tab, repere, ms = 1500) => {
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  if (repere) await pg.waitForFunction((r) => document.querySelector(r) || /pas pu s'afficher/.test(document.body.innerText), repere, { timeout: 25000 }).catch(() => {});
  await pg.waitForTimeout(ms);
};
const captureEl = async (pg, sel, nom) => { if (!CAPT) return; fs.mkdirSync(CAPT, { recursive: true }); const el = pg.locator(sel).first(); await el.scrollIntoViewIfNeeded().catch(() => {}); await pg.waitForTimeout(250); await el.screenshot({ path: path.join(CAPT, nom + '.png') }).catch((e) => console.log('   (capture ' + nom + ' : ' + e.message.slice(0, 80) + ')')); };
const lireQR = (pg, site) => pg.evaluate((site) => { const s = document.querySelector(`[data-quoi-republier="${site}"]`); if (!s) return null;
  return { n: s.getAttribute('data-qr-n'), verifier: s.getAttribute('data-qr-verifier'), jours: s.getAttribute('data-qr-jours'),
    lignes: [...s.querySelectorAll('.vrm-qr-liste')[0] ? s.querySelectorAll('.vrm-qr-liste')[0].querySelectorAll('[data-qr-ligne]') : []].map((e) => ({ cle: e.getAttribute('data-qr-ligne'), coche: e.getAttribute('data-qr-coche'), h: e.getBoundingClientRect().height, raison: (e.querySelector('[data-qr-raison]') || {}).innerText || '' })),
    verif: [...s.querySelectorAll('[data-qr-a-verifier] [data-qr-ligne]')].map((e) => ({ cle: e.getAttribute('data-qr-ligne'), raison: (e.querySelector('[data-qr-raison]') || {}).textContent || '' })),
    texte: s.innerText, deb: document.documentElement.scrollWidth - document.documentElement.clientWidth }; }, site);

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const T of TAILLES) {
      for (const sombre of CAPT ? [false, true] : [false]) {
        const suf = `${T.nom}${sombre ? '-sombre' : ''}`;
        console.log(`\n══ ${T.nom} px${T.hasTouch ? ' (tactile)' : ''}${sombre ? ' · sombre' : ''}`);

        console.log('── A. Annonces → Republier');
        await essaie('A' + suf, async () => {
          const { ctx, pg, errs, posts } = await page(b, T, { sombre, pont: true });
          await aller(pg, 'vinted_annonces', '[data-vue-republier]', 2500);
          await pg.locator('[data-vue-republier]').first().click();
          await pg.waitForSelector('[data-quoi-republier="vinted"][data-qr-n]:not([data-qr-n=""])', { timeout: 20000 }).catch(() => {});
          let r = await lireQR(pg, 'vinted');
          dit(r && r.n === '51' && r.verifier === '1', 'la carte : 51 proposées (5002 + les 50 au même titre), 1 à vérifier', r && `${r.n} / ${r.verifier}`);
          dit(r && r.lignes.length === 5 && r.lignes[0].cle === '111:5002' && /^95 j en ligne · 0 favori · 10 vues$/.test(r.lignes[0].raison.trim()), 'la plus ancienne d’abord, sa raison en une phrase (« 95 j en ligne · 0 favori · 10 vues ») ; 5 lignes montrées', r && `${r.lignes.length} ${r.lignes[0] && r.lignes[0].cle} « ${r.lignes[0] && r.lignes[0].raison} »`);
          dit(r && r.verif.length === 1 && r.verif[0].cle === '111:5004' && /favoris pas lus/.test(r.verif[0].raison) && /vues pas lues/.test(r.verif[0].raison) && !/\b0 (vue|favori)/.test(r.verif[0].raison), '5004 « à vérifier » : « favoris pas lus · vues pas lues » (jamais 0)', r && JSON.stringify(r.verif));
          dit(r && !/111:5006|111:5008/.test(JSON.stringify(r.lignes.concat(r.verif))), '5006 (120 vues, 3 favoris) et 5008 (5 j) ne sont pas proposées');
          dit(r && r.lignes.every((x) => x.h >= 44), 'chaque ligne fait 44 px ou plus', r && JSON.stringify(r.lignes.map((x) => Math.round(x.h))));
          await pg.locator('[data-qr-plus]').first().click(); await pg.waitForTimeout(300); r = await lireQR(pg, 'vinted');
          const cles = r ? r.lignes.map((x) => x.cle) : [];
          dit(cles.length === 51 && new Set(cles).size === 51 && cles.filter((x) => /^111:7100\d\d$/.test(x)).length === 50, '« Voir les 51 » : 50 annonces au même titre = 50 lignes, 50 identités', `${cles.length} ${new Set(cles).size}`);
          await captureEl(pg, '[data-quoi-republier="vinted"]', `qr-vinted-${suf}`);
          await pg.locator('[data-qr-ligne="111:5002"]').first().click(); await pg.waitForTimeout(300);
          const apres = await pg.evaluate(() => ({ carte: (document.querySelector('[data-qr-ligne="111:5002"]') || { getAttribute: () => null }).getAttribute('data-qr-coche'),
            liste: (document.querySelector('[data-selection-annonce="5002"]') || { getAttribute: () => null }).getAttribute('data-sel-coche'),
            lancer: (document.querySelector('[data-republier-lancer]') || { getAttribute: () => null }).getAttribute('data-republier-lancer') }));
          dit(apres.carte === '1' && apres.liste === '1' && apres.lancer === '1', 'un toucher la COCHE dans la liste de l’atelier (« Par VRM · 1 ») — rien ne part', JSON.stringify(apres));
          await pg.locator('[data-qr-ligne="111:5002"]').first().click(); await pg.waitForTimeout(300);
          const de = await pg.evaluate(() => ({ liste: (document.querySelector('[data-selection-annonce="5002"]') || { getAttribute: () => null }).getAttribute('data-sel-coche'), lancer: document.querySelectorAll('[data-republier-lancer]').length }));
          dit(de.liste === '0' && de.lancer === 0, 'un second toucher la décoche', JSON.stringify(de));
          await pg.locator('[data-qr-tout]').first().click(); await pg.waitForTimeout(300);
          const tout = await pg.evaluate(() => (document.querySelector('[data-republier-lancer]') || { getAttribute: () => null }).getAttribute('data-republier-lancer'));
          dit(tout === '51', '« Tout cocher (51) » ⇒ « Par VRM · 51 » : c’est lui qui lance ensuite', tout);
          await captureEl(pg, '[data-selection-vue="republier"]', `qr-vinted-atelier-${suf}`);
          await pg.locator('[data-qr-reglages] > summary').first().click(); await pg.waitForTimeout(200);
          await pg.locator('[data-qr-jours-choix="90"]').first().click(); await pg.waitForTimeout(400); r = await lireQR(pg, 'vinted');
          const lr = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_quoi_republier') || 'null'); } catch (_) { return null; } });
          dit(r && r.n === '1' && r.jours === '90' && r.lignes.map((x) => x.cle).join() === '111:5002' && lr && lr.jours === 90, 'régler « 90 j » : 5002 seule, réglage gardé', r && `${r.n} ${r.jours} ${JSON.stringify(lr)}`);
          await captureEl(pg, '[data-quoi-republier="vinted"]', `qr-vinted-regle-${suf}`);
          dit(r && r.deb <= 0, 'aucun défilement horizontal', r && r.deb);
          const cmds = await pg.evaluate(() => window.__cmds || []);
          dit(cmds.length === 0 && !posts.some((x) => /^cmd_|^vrm_cmd|relais/.test(x)), 'aucune commande envoyée à l’extension', JSON.stringify(cmds));
          dit(errs.length === 0, 'aucune erreur d’app', errs.join(' | ').slice(0, 200));
          await ctx.close();
        });

        console.log('── B. Ma journée');
        await essaie('B' + suf, async () => {
          const { ctx, pg, errs } = await page(b, T, { sombre });
          await aller(pg, 'journee', '[data-job]', 3000);
          await pg.waitForSelector('[data-job="quoi-republier"]', { timeout: 20000 }).catch(() => {});
          const c = await pg.evaluate(() => { const e = document.querySelector('[data-job="quoi-republier"]'); return e ? { n: e.getAttribute('data-n'), texte: e.innerText.replace(/\s+/g, ' ') } : null; });
          dit(c && c.n === '51' && /51 annonces anciennes et peu vues/.test(c.texte), 'la ligne « 51 annonces anciennes et peu vues » (les « à vérifier » n’y comptent pas)', c && JSON.stringify(c));
          await captureEl(pg, '[data-job="quoi-republier"]', `qr-journee-${suf}`);
          const btn = pg.locator('[data-job="quoi-republier"] button, [data-job="quoi-republier"] a').first();
          if (await btn.count()) await btn.click(); else await pg.locator('[data-job="quoi-republier"]').click();
          await pg.waitForSelector('[data-quoi-republier="vinted"]', { timeout: 15000 }).catch(() => {});
          const v = await pg.evaluate(() => ({ carte: !!document.querySelector('[data-quoi-republier="vinted"]'), vue: (document.querySelector('[data-selection-vue]') || { getAttribute: () => null }).getAttribute('data-selection-vue') }));
          dit(v.carte && v.vue === 'republier', '« Voir » ouvre Annonces → Republier, la carte en tête', JSON.stringify(v));
          dit(errs.length === 0, 'aucune erreur d’app', errs.join(' | ').slice(0, 200));
          await ctx.close();
        });

        console.log('── C. Republier sur Leboncoin');
        await essaie('C' + suf, async () => {
          const { ctx, pg, errs } = await page(b, T, { sombre, pont: true });
          await aller(pg, 'leboncoin', '[data-repub-lbc-porte]', 2000);
          await pg.locator('[data-repub-lbc-ouvrir]').first().click().catch(() => {});
          await pg.waitForSelector('[data-quoi-republier="leboncoin"]', { timeout: 10000 }).catch(() => {});
          const r = await lireQR(pg, 'leboncoin');
          dit(r && r.n === '1' && r.verifier === '1' && r.lignes[0] && r.lignes[0].cle === '3290000013' && /^60 j en ligne · 0 favori · 8 vues$/.test(r.lignes[0].raison.trim()), 'la carte Leboncoin : N°13 (60 j, 0 favori, 8 vues) proposée, N°15 (jamais relevée) à vérifier, N°17 non', r && `${r.n}/${r.verifier} ${r.lignes[0] && r.lignes[0].raison}`);
          await captureEl(pg, '[data-quoi-republier="leboncoin"]', `qr-lbc-${suf}`);
          await pg.locator('[data-qr-ligne="3290000013"]').first().click(); await pg.waitForTimeout(300);
          const s = await pg.evaluate(() => { const i = document.querySelector('[data-repub-lbc-ligne="3290000013"] input'); const c = document.querySelector('[data-repub-lbc-suivant]'); return { coche: i ? i.checked : null, suivant: c ? c.textContent.trim() : '', actif: c ? !c.disabled : null }; });
          dit(s.coche === true && /\(1\)/.test(s.suivant) && s.actif, 'un toucher coche la N°13 dans l’atelier (« Continuer (1) ») — c’est lui qui continue', JSON.stringify(s));
          const cmds = await pg.evaluate(() => window.__cmds || []);
          dit(!cmds.includes('lbcSupprime') && !cmds.includes('lbcPublier'), 'aucune suppression ni publication envoyée', JSON.stringify(cmds));
          dit(r && r.deb <= 0, 'aucun défilement horizontal', r && r.deb);
          dit(errs.length === 0, 'aucune erreur d’app', errs.join(' | ').slice(0, 200));
          await ctx.close();
        });
      }
    }
  } catch (e) { dit(false, 'le banc s’exécute', String(e.message || e).slice(0, 200)); }
  finally {
    if (b) await b.close(); srv.close();
    console.log(ko ? `\n❌ quoi-republier : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ quoi-republier : ${ok} verts, 0 rouge`);
    process.exit(ko ? 1 : 0);
  }
})();
