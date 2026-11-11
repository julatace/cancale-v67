// ═══════════════════════════════════════════════════════════════════════════
// BANC : TON HISTORIQUE LEBONCOIN / VESTIAIRE / eBAY (11 nov., lot import-historique-sites, ext. 5.365)
//        npm run build && BANC_PORT=$((20000+RANDOM%20000)) node -r ./scripts/bancs/_porte-banc.cjs scripts/bancs/import-sites.cjs
// ═══════════════════════════════════════════════════════════════════════════
// Le VRAI écran Paramètres → Comptes → Mon historique, sur une base INVENTÉE : les lignes
// `import_leboncoin_*` / `import_vestiaire_*` dans la forme EXACTE de `publierImpSite`
// (background.js) et `import_ebay*` dans celle de `api/_lib/ebay-historique.js`.
//   A. Leboncoin « Toto » : « 120 lues · encore… », détails « 40 lues » ; Vestiaire « 120 sur
//      400 » (barre au tiers), achats sans modèle ⇒ « Va à la page 2 une fois » (geste) ;
//      eBay « Tout ce qu'eBay garde est récupéré ✓ », achats « eBay ne garde que 60 jours ».
//   B. Le second compte eBay (aucune ligne) avance TOUT SEUL, carte ouverte : la route
//      `historique` est appelée pour lui, une étape à la fois ; « Tout récupérer » eBay repart
//      du début (`depuisDebut`).
//   C. Leboncoin arrêté (sans nouvelles) : « ouvre leboncoin.fr », « Tout récupérer » envoie UNE
//      commande `importSiteTout` (tenue, §6.5) ; extension 5.344 : aucun bouton Leboncoin/Vestiaire.
//   D. Base muette : « Pas su », jamais « fini ».
// Jugé sur des data-* et des nombres. `BANC_CAPTURE=<dossier>` : captures 390 tactile et 1512,
// clair et sombre. `BANC_DIST=<dossier>` : un autre build (preuve §6.1).
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4582;
const CAPT = process.env.BANC_CAPTURE || '';
const auj = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const LBC = 'a1b2c3d4-0000-4000-8000-000000000001', VC = 'c42', CLE2 = '0123456789abcdef';
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'atelier_test', domain: 'www.vinted.fr', updated_at: iso(auj), created_at: iso(auj - 2 * 86400e3), owner: null }];
const ext = (site, compte, o) => ({ id: `import_${site}_${compte}`, data: Object.assign({ v: 1, type: 'import', plateforme: site, compte, code: '5.365.0', capturedAt: iso(auj), at: auj, debut: auj - 3600e3, demande: false, repriseA: null, cause: null, fin: null, attend: null }, o) });
const ROWS_DEFAUT = () => [
  ext('leboncoin', LBC, { etat: 'encours', resteMin: 600, types: { transactions: { lus: 120, total: null, pages: 6, fini: false }, details: { lus: 40, total: null, pages: 40, fini: false } } }),
  ext('vestiaire', VC, { etat: 'encours', resteMin: 70, attend: 'modele', types: { ventes: { lus: 120, total: 400, pages: 6, fini: false }, achats: { lus: 0, total: null, pages: 0, fini: false, sansModele: true } } }),
  { id: 'import_ebay', data: { v: 1, type: 'import', plateforme: 'ebay', etat: 'fini', raisonFin: 'ebay', ventes: { lus: 450, total: 450, pages: 8, fini: true }, achats: { lus: 0, total: null, pages: 0, fini: true, limiteJours: 60 }, at: auj, fin: auj - 3600e3, cause: null, capturedAt: iso(auj) } },
  { id: 'lbc_accounts', data: { accounts: { ['lbc-account:' + LBC]: { name: 'Toto', preuveCompte: 'membre-prive-v1' } } } },
  { id: 'vc_ventes', data: { ventes: {} } },
  { id: 'ebay_orders', data: { orders: [] } },
  { id: 'ebay_orders_' + CLE2, data: { orders: [] } },
];
let ROWS = [];
let MUET = false;
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

const PONT = ({ version }) => {
  const post = (m) => window.postMessage(m, '*');
  window.__cmds = []; window.__attente = [];
  window.__relacher = (resp) => { const c = window.__attente.shift(); if (!c) return false; post({ __vmr: 'cmd:result', reqId: c.reqId, resp }); return true; };
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, code: version, vrm: { ok: true, connecte: true, email: '' }, vinted: { uid: '111', login: 'x' }, cmds: {} } });
    if (d.__vmr === 'cmd') {
      if (d.cmd === 'importSiteTout') { window.__cmds.push({ cmd: d.cmd, site: d.site, compte: d.compte }); window.__attente.push(d); return; }
      post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: false, code: 'banc', raison: 'banc' } });
    }
  });
  post({ __vmr: 'ready', version });
};
let ko = 0, ok = 0; const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d != null && d !== '' ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 200)); } };
const TAILLES = [{ nom: '390', vp: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, { nom: '1512', vp: { width: 1512, height: 950 } }]
  .filter((t) => !process.env.BANC_TAILLE || t.nom === process.env.BANC_TAILLE);
const filtreOr = (u) => { const m = /[?&]or=\(([^)]*)\)/.exec(u); if (!m) return null; const conds = m[1].split(',').map((c) => { const [, op, v] = /^id\.(eq|like)\.(.+)$/.exec(c) || []; return op === 'eq' ? (id) => id === v : op === 'like' ? ((re) => (id) => re.test(id))(new RegExp('^' + v.replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$')) : () => false; }); return (id) => conds.some((f) => f(id)); };

async function page(b, T, { sombre = false, version = '5.365.0' } = {}) {
  const ctx = await b.newContext({ viewport: T.vp, isMobile: !!T.isMobile, hasTouch: !!T.hasTouch, colorScheme: sombre ? 'dark' : 'light', locale: 'fr-FR' });
  const pg = await ctx.newPage();
  const errs = [], ecrits = [], ebay = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(({ sombre }) => { try { if (sessionStorage.getItem('__banc')) return; sessionStorage.setItem('__banc', '1'); localStorage.setItem('vrm_acces_direct', '1'); if (sombre) localStorage.setItem('vinted_dark', 'true'); } catch (_) {} }, { sombre });
  await pg.addInitScript(PONT, { version });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') { const corps = req.postData() || ''; if (/"id":"import_/.test(corps)) ecrits.push(u + ' ' + corps.slice(0, 2000)); return j([]); }
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    if (/import_|ebay_orders/.test(u) && /select=data(&|$)/.test(u)) ecrits.push('SELECT_DATA ' + u);
    const f = filtreOr(u);
    if (f) { if (MUET && /import_/.test(u)) return route.fulfill({ status: 503, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{}' }); return j(ROWS.filter((r) => f(r.id)).map((r) => projette(r, sel))); }
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq && eq[1] === 'main') return j([projette({ id: 'main', data: { ...(sombre ? { vinted_dark: true } : {}) } }, sel)]);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map((r) => projette(r, sel)));
    return j([]);
  });
  await pg.route('**/api/**', (r) => {
    const u = r.request().url();
    if (/\/api\/ebay/.test(u) && r.request().method() === 'POST') { let c = {}; try { c = JSON.parse(r.request().postData() || '{}'); } catch (_) {} if (c.action === 'historique') { ebay.push(c); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, pages: 1, etat: { etat: ebay.length >= 3 ? 'fini' : 'encours' } }) }); } }
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' });
  });
  return { ctx, pg, errs, ecrits, ebay };
}
const ouvrir = async (pg) => {
  await pg.goto(`http://localhost:${PORT}/?tab=settings`, { waitUntil: 'domcontentloaded' });
  await pg.locator('[data-import-sites]:visible, [data-sous-ouvrir="historique"]:visible').first().waitFor({ timeout: 30000 }).catch(() => {});
  if (!(await pg.locator('[data-import-sites]').first().isVisible().catch(() => false))) await pg.locator('[data-sous-ouvrir="historique"]').first().click().catch(() => {});
  await pg.waitForFunction(() => { const s = document.querySelector('[data-import-sites]'); return s && s.getAttribute('data-import-sites') !== 'lecture'; }, null, { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(500);
};
const lire = (pg) => pg.evaluate(() => { const s = document.querySelector('[data-import-sites]'); if (!s) return null;
  const S = {}; for (const e of s.querySelectorAll('[data-import-site]')) {
    const comptes = {}; for (const c of e.querySelectorAll('[data-import-compte]')) { const ty = {}; for (const t of c.querySelectorAll('[data-import-type]')) { const bar = t.querySelector('.vrm-imp-barre > i'), cadre = t.querySelector('.vrm-imp-barre');
      ty[t.getAttribute('data-import-type')] = { lus: t.getAttribute('data-import-lus'), total: t.getAttribute('data-import-total'), texte: t.innerText.replace(/\s+/g, ' ').trim(), pc: bar && cadre ? Math.round(bar.getBoundingClientRect().width / cadre.getBoundingClientRect().width * 100) : null }; }
      const btn = c.querySelector('[data-import-tout]'); const ph = c.querySelector('.vrm-imp-phrase');
      comptes[c.getAttribute('data-import-compte')] = { etat: c.getAttribute('data-import-etat'), ty, bouton: btn ? { h: btn.getBoundingClientRect().height } : null, geste: ph ? ph.getAttribute('data-ton') : null, texte: c.innerText.replace(/\s+/g, ' ').trim() }; }
    S[e.getAttribute('data-import-site')] = { comptes, geste: (e.querySelector('[data-import-geste]') || {}).innerText || '' }; }
  return { etat: s.getAttribute('data-import-sites'), S, deb: document.documentElement.scrollWidth - document.documentElement.clientWidth, texte: s.innerText }; });
const capture = async (pg, nom) => { if (!CAPT) return; fs.mkdirSync(CAPT, { recursive: true }); await pg.waitForTimeout(300);
  const el = pg.locator('[data-import-sites]').first(); await el.scrollIntoViewIfNeeded().catch(() => {});
  await pg.screenshot({ path: path.join(CAPT, nom + '.png'), fullPage: false }).catch(() => {}); };

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const T of TAILLES) {
      for (const sombre of CAPT ? [false, true] : [T.nom === '390']) {
        const suf = `${T.nom}${sombre ? '-sombre' : '-clair'}`;
        console.log(`\n══ ${T.nom} px${T.hasTouch ? ' (tactile)' : ''}${sombre ? ' · sombre' : ' · clair'}`);
        await essaie('A' + suf, async () => {
          ROWS = ROWS_DEFAUT(); MUET = false;
          const { ctx, pg, errs, ecrits, ebay } = await page(b, T, { sombre });
          await ouvrir(pg);
          const s = await lire(pg); const S = (s && s.S) || {};
          const l = S.leboncoin && S.leboncoin.comptes[LBC], v = S.vestiaire && S.vestiaire.comptes[VC], e = S.ebay && S.ebay.comptes.principal;
          dit(s && Object.keys(S).join(',') === 'leboncoin,vestiaire,ebay', 'A1 trois sites, dans l’ordre', s && Object.keys(S).join(','));
          dit(l && /Toto/.test(l.texte) && l.ty.transactions.lus === '120' && /120 lues · encore/.test(l.ty.transactions.texte) && l.ty.transactions.pc === null, 'A2 Leboncoin « Toto » : « 120 lues · encore… », pas de barre sans total', l && JSON.stringify(l.ty.transactions));
          dit(l && /environ 10 h/.test(l.texte) && !l.bouton, 'A3 Leboncoin en cours : l’estimation, aucun bouton pendant la lecture', l && l.texte);
          dit(v && v.ty.ventes.total === '400' && /120 sur 400/.test(v.ty.ventes.texte) && v.ty.ventes.pc >= 28 && v.ty.ventes.pc <= 32, 'A4 Vestiaire : « 120 sur 400 », barre au tiers', v && JSON.stringify(v.ty.ventes));
          dit(v && /page 2 une fois/.test(v.ty.achats.texte) && v.geste === 'geste' && /Mes ventes/.test(v.texte), 'A5 Vestiaire achats sans modèle : le geste est dit (ambre)', v && v.texte);
          dit(e && e.etat === 'fini' && /eBay garde est récupéré/.test(e.texte) && /60 jours/.test(e.ty.achats.texte) && /450 ✓/.test(e.ty.ventes.texte), 'A6 eBay : « Tout ce qu’eBay garde est récupéré ✓ », 450 ventes, achats 60 jours', e && e.texte);
          dit(e && e.bouton && e.bouton.h >= 43.5, 'A7 eBay fini : « Tout récupérer » (44 px)', e && JSON.stringify(e.bouton));
          dit(s && s.deb <= 0, 'A8 aucun défilement horizontal', s && s.deb);
          await pg.waitForFunction(() => true); await pg.waitForTimeout(5500);
          dit(ebay.length >= 1 && ebay.every((c) => c.compte === CLE2 && !c.depuisDebut), 'B1 le 2e compte eBay (sans ligne) avance tout seul, carte ouverte — jamais le compte fini', JSON.stringify(ebay));
          dit(ebay.length === 3, 'B2 une étape à la fois, jusqu’à « fini » (3 étapes servies)', String(ebay.length));
          await capture(pg, `historique-sites-${suf}`);
          const n0 = ebay.length;
          await pg.locator(`[data-import-tout="ebay:principal"]`).click();
          await pg.waitForSelector('[data-suivi-travail="import-historique"][data-suivi-statut="fini"]', { timeout: 15000 }).catch(() => {});
          dit(ebay.length === n0 + 1 && ebay[n0].depuisDebut === true && !ebay[n0].compte, 'B3 « Tout récupérer » eBay : repart du début, compte principal', JSON.stringify(ebay.slice(n0)));
          const fe = await pg.evaluate(() => { const f = document.querySelector('[data-suivi-travail="import-historique"]'); return f ? { statut: f.getAttribute('data-suivi-statut'), n: f.getAttribute('data-suivi-n'), texte: f.innerText.replace(/\s+/g, ' ') } : null; });
          dit(fe && fe.statut === 'fini' && fe.n === '1/1' && /historique eBay/.test(fe.texte), 'B4 lancé à la main : la feuille de suivi (VRM figé) montre la lecture jusqu’à « fini »', fe && JSON.stringify({ s: fe.statut, n: fe.n }));
          if (fe) await capture(pg, `historique-sites-suivi-${suf}`);
          await pg.locator('[data-suivi-fermer]').first().click().catch(() => {});
          dit(!ecrits.length, 'A9 l’app n’écrit jamais une ligne `import_*` ; aucun select=data sur elles', JSON.stringify(ecrits).slice(0, 300));
          dit(!errs.length, 'A10 aucune erreur de page', errs.join(' | ').slice(0, 200));
          await ctx.close();
        });
        await essaie('C' + suf, async () => {
          ROWS = ROWS_DEFAUT(); MUET = false;
          ROWS[0] = ext('leboncoin', LBC, { etat: 'encours', at: auj - 3600e3, capturedAt: iso(auj - 3600e3), resteMin: 600, types: { transactions: { lus: 120, total: null, pages: 6, fini: false }, details: { lus: 40, total: null, pages: 40, fini: false } } });
          const { ctx, pg, errs } = await page(b, T, { sombre });
          await ouvrir(pg);
          const s = await lire(pg); const l = s && s.S.leboncoin && s.S.leboncoin.comptes[LBC];
          dit(l && l.etat === 'arrete' && /ouvre leboncoin\.fr sur ce compte/.test(l.texte) && l.geste === 'geste' && l.bouton, 'C1 sans nouvelles depuis 1 h ⇒ « ouvre leboncoin.fr », et « Tout récupérer »', l && l.texte);
          await pg.locator(`[data-import-tout="leboncoin:${LBC}"]`).click();
          await pg.waitForFunction(() => window.__cmds.length > 0, null, { timeout: 5000 }).catch(() => {});
          const c = await pg.evaluate(() => window.__cmds.slice());
          dit(c.length === 1 && c[0].cmd === 'importSiteTout' && c[0].site === 'leboncoin' && c[0].compte === LBC, 'C2 UNE commande importSiteTout pour ce compte', JSON.stringify(c));
          ROWS[0] = ext('leboncoin', LBC, { etat: 'encours', at: Date.now() + 1000, resteMin: 600, types: { transactions: { lus: 140, total: null, pages: 7, fini: false }, details: { lus: 40, total: null, pages: 40, fini: false } } });
          await pg.evaluate(() => window.__relacher({ accepte: true, etape: 'file' }));
          await pg.waitForSelector('[data-suivi-travail="import-historique"][data-suivi-statut="fini"]', { timeout: 20000 }).catch(() => {});
          const fe = await pg.evaluate(() => { const f = document.querySelector('[data-suivi-travail="import-historique"]'); return f ? { statut: f.getAttribute('data-suivi-statut'), texte: f.innerText.replace(/\s+/g, ' ') } : null; });
          dit(fe && fe.statut === 'fini' && /47 pages|7 pages/.test(fe.texte) && /continue toute seule/.test(fe.texte), 'C3 la feuille de suivi : pages lues relues dans SA ligne, « la suite continue toute seule »', fe && fe.texte.slice(0, 300));
          if (fe) await capture(pg, `historique-sites-suivi-lbc-${suf}`);
          await pg.locator('[data-suivi-fermer]').first().click().catch(() => {});
          await pg.waitForTimeout(300);
          await pg.locator(`[data-import-tout="vestiaire:${VC}"]`).count();
          await capture(pg, `historique-sites-arrete-${suf}`);
          dit(!errs.length, 'C4 aucune erreur de page', errs.join(' | ').slice(0, 200));
          await ctx.close();
          const g = await page(b, T, { sombre, version: '5.344.0' });
          await ouvrir(g.pg);
          const s2 = await lire(g.pg);
          dit(s2 && !s2.S.leboncoin.comptes[LBC].bouton && s2.S.ebay.comptes.principal.bouton, 'C5 extension 5.344 : aucun bouton Leboncoin (eBay, côté serveur, garde le sien)');
          await g.ctx.close();
        });
        await essaie('E' + suf, async () => {
          ROWS = ROWS_DEFAUT(); MUET = false;
          ROWS[0] = ext('leboncoin', LBC, { etat: 'encours', at: auj - 3600e3, capturedAt: iso(auj - 3600e3), resteMin: 600, types: { transactions: { lus: 120, total: null, pages: 6, fini: false }, details: { lus: 40, total: null, pages: 40, fini: false } } });
          const { ctx, pg, errs } = await page(b, T, { sombre });
          await ouvrir(pg);
          await pg.locator(`[data-import-tout="leboncoin:${LBC}"]`).click();
          await pg.waitForFunction(() => window.__cmds.length > 0, null, { timeout: 5000 }).catch(() => {});
          await pg.evaluate(() => window.__relacher({ accepte: false, code: 'onglet-absent', raison: 'Ouvre leboncoin.fr sur ce compte dans ce Chrome.' }));
          await pg.waitForFunction(() => { const f = document.querySelector('[data-suivi-travail="import-historique"]'); return f && f.getAttribute('data-suivi-statut') !== 'cours'; }, null, { timeout: 10000 }).catch(() => {});
          const fe = await pg.evaluate(() => { const f = document.querySelector('[data-suivi-travail="import-historique"]'); return f ? f.innerText.replace(/\s+/g, ' ') : ''; });
          dit(/Ouvre leboncoin\.fr sur ce compte dans ce Chrome/.test(fe), 'E1 refusé par l’extension : la feuille DIT la raison et le geste', fe.slice(0, 300));
          await capture(pg, `historique-sites-refus-${suf}`);
          dit(!errs.length, 'E2 aucune erreur de page', errs.join(' | ').slice(0, 200));
          await ctx.close();
        });
        await essaie('D' + suf, async () => {
          ROWS = ROWS_DEFAUT(); MUET = true;
          const { ctx, pg } = await page(b, T, { sombre });
          await ouvrir(pg);
          const s = await lire(pg);
          dit(s && s.etat === 'passu' && /Pas su/.test(s.texte) && !/récupéré/.test(s.texte), 'D1 base muette : « Pas su », jamais « fini »', s && s.texte.slice(0, 120));
          await ctx.close(); MUET = false;
        });
      }
    }
  } finally { if (b) await b.close(); srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} banc historique des sites : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
