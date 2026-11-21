// ═══════════════════════════════════════════════════════════════════════════
// BANC : TON HISTORIQUE VINTED (11 nov., lot import-depart, extension 5.344)
//        npm run build && BANC_PORT=$((20000+RANDOM%20000)) node -r ./scripts/bancs/_porte-banc.cjs scripts/bancs/import-depart.cjs
// ═══════════════════════════════════════════════════════════════════════════
// Le VRAI écran Paramètres → Mes comptes → Mon historique Vinted, et la VRAIE Ma journée,
// sur une base INVENTÉE (aucune donnée réelle) : les lignes `import_vinted_{uid}` dans la
// forme exacte de `publierImport` (background.js). Un faux pont RETIENT `importTout` (§6.5).
//   A. Paramètres : 111 en cours « 400 sur 1 250 » (barre fine au tiers, estimation) ;
//      222 fini ; 333 rien lu ⇒ « Ouvre vinted.fr… » ; « Tout récupérer » seulement pour
//      le compte de l'onglet (222), une commande, rien écrit en base.
//   B. Extension 5.341 : « Mets l'extension à jour (5.344.0) », aucun bouton.
//   C. Ma journée : une barre par compte en cours ou fini depuis < 24 h.
//   D. Tout fini depuis plus d'un jour : rien sur Ma journée.
//   E. Sans nouvelles depuis 1 h ⇒ « ouvre vinted.fr » ; pause Vinted ⇒ « Reprise à hh:mm ».
// Jugé sur des data-* et des nombres. `BANC_CAPTURE=<dossier>` : captures 390 tactile et
// 1512, clair et sombre. `BANC_DIST=<dossier>` : un autre build (preuve §6.1).
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4581;
const CAPT = process.env.BANC_CAPTURE || '';

const auj = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const ACCS = [
  { id: 1, vinted_user_id: '111', login: 'atelier_test', domain: 'www.vinted.fr', updated_at: iso(auj), created_at: iso(auj - 2 * 86400e3), owner: null },
  { id: 2, vinted_user_id: '222', login: 'second_test', domain: 'www.vinted.fr', updated_at: iso(auj), created_at: iso(auj - 2 * 86400e3), owner: null },
  { id: 3, vinted_user_id: '333', login: 'troisieme', domain: 'www.vinted.fr', updated_at: iso(auj), created_at: iso(auj - 2 * 86400e3), owner: null },
];
// L'état publié par l'extension (la forme EXACTE de `publierImport`, background.js 5.344).
// (11 nov., lot extension-visuel) La version demandée est celle de l'app (`EXT_ATTENDUE`),
// lue dans src/App.jsx — elle monte à chaque version d'extension, le banc ne la recopie pas.
const EXT_ATTENDUE_APP = (/const EXT_ATTENDUE = '([\d.]+)'/.exec(require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'src', 'App.jsx'), 'utf8')) || [])[1] || '?';
const ligne = (uid, o) => ({ id: `import_vinted_${uid}`, data: Object.assign({ v: 1, type: 'import', uid, code: '5.344.0', capturedAt: iso(auj), at: auj, debut: auj - 3600e3, demande: false, repriseA: null, cause: null, fin: null }, o) });
let ROWS = [];
const ROWS_DEFAUT = () => [
  ligne('111', { etat: 'encours', ventes: { lus: 400, total: 1250, pages: 4, fini: false }, achats: { lus: 0, total: null, pages: 0, fini: false }, resteMin: 50 }),
  ligne('222', { etat: 'fini', ventes: { lus: 2160, total: 2160, pages: 22, fini: true }, achats: { lus: 340, total: 340, pages: 4, fini: true }, resteMin: 0, fin: auj - 2 * 3600e3 }),
];

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

const PONT = ({ version, onglet }) => {
  const post = (m) => window.postMessage(m, '*');
  window.__cmds = []; window.__attente = [];
  window.__relacher = (resp) => { const c = window.__attente.shift(); if (!c) return false; post({ __vmr: 'cmd:result', reqId: c.reqId, resp }); return true; };
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, code: version, vrm: { ok: true, connecte: true, email: '' }, vinted: { uid: onglet, login: 'x' }, cmds: {} } });
    if (d.__vmr === 'cmd') {
      if (d.cmd === 'importTout') { window.__cmds.push({ cmd: d.cmd, uid: d.uid }); window.__attente.push(d); return; }
      post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: false, code: 'banc', raison: 'banc' } });
    }
  });
  post({ __vmr: 'ready', version });
};

let ko = 0, ok = 0; const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d != null && d !== '' ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 200)); } };
const TAILLES = [{ nom: '390', vp: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, { nom: '1512', vp: { width: 1512, height: 950 } }]
  .filter((t) => !process.env.BANC_TAILLE || t.nom === process.env.BANC_TAILLE);

async function page(b, T, { sombre = false, version = '5.344.0', onglet = '222' } = {}) {
  const ctx = await b.newContext({ viewport: T.vp, isMobile: !!T.isMobile, hasTouch: !!T.hasTouch, colorScheme: sombre ? 'dark' : 'light' });
  const pg = await ctx.newPage();
  const errs = [], ecrits = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(({ sombre }) => { try { if (sessionStorage.getItem('__banc')) return; sessionStorage.setItem('__banc', '1'); localStorage.setItem('vrm_acces_direct', '1'); if (sombre) localStorage.setItem('vinted_dark', 'true'); } catch (_) {} }, { sombre });
  await pg.addInitScript(PONT, { version, onglet });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) || /^https?:\/\/[^/]*vinted\.net\//i.test(r.request().url()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') { ecrits.push(u + ' ' + (req.postData() || '').slice(0, 4000)); return j([]); }
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    if (/select=data(&|$)/.test(u) && /harvest_\d+_profile/.test(u)) ecrits.push('SELECT_DATA ' + u);
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq && eq[1] === 'main') return j([projette({ id: 'main', data: { ...(sombre ? { vinted_dark: true } : {}) } }, sel)]);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map((r) => projette(r, sel)));
    const dans = /id=in\.\(([^)]*)\)/.exec(u);
    if (dans) { const ids = dans[1].split(','); return j(ROWS.filter((r) => ids.includes(r.id)).map((r) => projette(r, sel))); }
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map((r) => projette(r, sel))); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs, ecrits };
}

const ouvrirReglages = async (pg) => {
  await pg.goto(`http://localhost:${PORT}/?tab=settings`, { waitUntil: 'domcontentloaded' });
  await pg.locator('[data-import-reglages]:visible, [data-sous-ouvrir="historique"]:visible').first().waitFor({ timeout: 30000 }).catch(() => {});
  if (!(await pg.locator('[data-import-reglages]').first().isVisible().catch(() => false))) await pg.locator('[data-sous-ouvrir="historique"]').first().click().catch(() => {});
  await pg.waitForSelector('[data-import-ligne]', { timeout: 20000 }).catch(() => {});
  await pg.waitForFunction(() => document.querySelectorAll('[data-import-ligne][data-import-etat="encours"]').length > 0, null, { timeout: 15000 }).catch(() => {});
  await pg.waitForTimeout(400);
};
const lireR = (pg) => pg.evaluate(() => { const s = document.querySelector('[data-import-reglages]'); if (!s) return null;
  const L = {}; for (const e of s.querySelectorAll('[data-import-ligne]')) {
    const ty = {}; for (const t of e.querySelectorAll('[data-import-type]')) { const bar = t.querySelector('.vrm-imp-barre > i'), cadre = t.querySelector('.vrm-imp-barre');
      ty[t.getAttribute('data-import-type')] = { lus: t.getAttribute('data-import-lus'), total: t.getAttribute('data-import-total'), fini: t.getAttribute('data-import-fini'), texte: t.innerText.replace(/\s+/g, ' ').trim(),
        pc: bar && cadre ? Math.round(bar.getBoundingClientRect().width / cadre.getBoundingClientRect().width * 100) : null, h: cadre ? cadre.getBoundingClientRect().height : null }; }
    const btn = e.querySelector('[data-import-tout]');
    L[e.getAttribute('data-import-ligne')] = { etat: e.getAttribute('data-import-etat'), onglet: e.getAttribute('data-import-onglet'), ty, bouton: btn ? { off: btn.disabled, h: btn.getBoundingClientRect().height } : null, texte: e.innerText.replace(/\s+/g, ' ').trim() }; }
  return { L, ext: (s.querySelector('[data-import-ext]') || {}).innerText || '', issue: (s.querySelector('[data-import-issue]') || { getAttribute: () => null }).getAttribute('data-import-issue'),
    deb: document.documentElement.scrollWidth - document.documentElement.clientWidth, texte: s.innerText }; });
const ouvrirJournee = async (pg) => {
  await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('[data-import-journee]', { timeout: 30000 }).catch(() => {});
  await pg.waitForTimeout(500);
};
const lireJ = (pg) => pg.evaluate(() => { const s = document.querySelector('[data-import-journee]'); if (!s) return null;
  return { n: Number(s.getAttribute('data-import-journee')), comptes: [...s.querySelectorAll('[data-import-compte]')].map((e) => e.getAttribute('data-import-compte') + ':' + e.getAttribute('data-import-etat')), texte: s.innerText.replace(/\s+/g, ' ').trim(),
    h: s.getBoundingClientRect().height, deb: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
const cmds = (pg) => pg.evaluate(() => window.__cmds.slice());
const relacher = (pg, resp) => pg.evaluate((r) => window.__relacher(r), resp);
const capture = async (pg, nom, sel) => { if (!CAPT) return; fs.mkdirSync(CAPT, { recursive: true }); await pg.waitForTimeout(300);
  if (sel) { const el = pg.locator(sel).first(); await el.scrollIntoViewIfNeeded().catch(() => {}); }
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
          ROWS = ROWS_DEFAUT();
          const { ctx, pg, errs, ecrits } = await page(b, T, { sombre });
          await ouvrirReglages(pg);
          const s = await lireR(pg);
          const L = s ? s.L : {};
          dit(L['111'] && L['111'].etat === 'encours' && L['111'].ty.ventes && L['111'].ty.ventes.lus === '400' && L['111'].ty.ventes.total === '1250', 'A1 atelier_test : « 400 sur 1 250 » ventes, en cours', s && JSON.stringify(L['111']));
          dit(L['111'] && L['111'].ty.ventes.pc >= 30 && L['111'].ty.ventes.pc <= 34 && L['111'].ty.ventes.h > 0 && L['111'].ty.ventes.h <= 6, 'A2 une barre FINE, remplie au tiers (400/1 250)', s && JSON.stringify(L['111'] && L['111'].ty.ventes));
          dit(L['111'] && /Lecture de ton historique/.test(L['111'].texte) && /environ 50 min/.test(L['111'].texte), 'A3 la phrase dit l’estimation (« environ 50 min, Vinted ouvert »)', L['111'] && L['111'].texte);
          dit(L['111'] && L['111'].ty.achats && L['111'].ty.achats.total === '' && /Ensuite/.test(L['111'].ty.achats.texte), 'A4 achats : total pas encore donné ⇒ « Ensuite », jamais un « 0 sur 0 »', L['111'] && JSON.stringify(L['111'].ty.achats));
          dit(L['222'] && L['222'].etat === 'fini' && /Tout est récupéré/.test(L['222'].texte) && /2 160 ✓/.test(L['222'].ty.ventes.texte.replace(/\u202f|\u00a0/g, ' ')), 'A5 second_test : « Tout est récupéré ✓ » · 2 160 ventes', L['222'] && L['222'].texte);
          dit(L['333'] && L['333'].etat === 'aucun' && /Ouvre vinted\.fr sur ce compte/.test(L['333'].texte), 'A6 troisieme : rien lu ⇒ « Ouvre vinted.fr sur ce compte » (jamais « fini »)', L['333'] && L['333'].texte);
          dit(L['222'] && L['222'].bouton && !L['222'].bouton.off && L['222'].bouton.h >= 43.5 && !L['111'].bouton && !L['333'].bouton, 'A7 « Tout récupérer » seulement sur le compte de l’onglet (44 px)', JSON.stringify({ a: L['111'] && L['111'].bouton, b: L['222'] && L['222'].bouton, c: L['333'] && L['333'].bouton }));
          dit(s && s.deb <= 0, 'A8 aucun défilement horizontal', s && s.deb);
          await capture(pg, `reglages-${suf}`, '[data-import-reglages]');
          await pg.locator('[data-import-tout="222"]').click();
          await pg.waitForFunction(() => window.__cmds.length > 0, null, { timeout: 5000 }).catch(() => {});
          const c = await cmds(pg);
          dit(c.length === 1 && c[0].cmd === 'importTout' && c[0].uid === '222', 'A9 le clic envoie UNE commande importTout pour 222', JSON.stringify(c));
          await relacher(pg, { accepte: true, etape: 'file' });
          await pg.waitForSelector('[data-import-issue]', { timeout: 5000 }).catch(() => {});
          const s2 = await lireR(pg);
          dit(s2 && s2.issue === 'ok', 'A10 réponse acceptée ⇒ « Lecture lancée »', s2 && s2.issue);
          dit(!ecrits.some((u) => /SELECT_DATA|import_vinted_|harvest_/.test(u)), 'A11 l’app n’écrit jamais la ligne de l’extension ni une capture ; aucun select=data', JSON.stringify(ecrits.filter((u) => /SELECT_DATA|import_vinted_|harvest_/.test(u)).slice(0, 2)).slice(0, 300));
          dit(!errs.length, 'A12 aucune erreur de page', errs.join(' | ').slice(0, 200));
          await ctx.close();
        });
        await essaie('B' + suf, async () => {
          ROWS = ROWS_DEFAUT();
          const { ctx, pg } = await page(b, T, { sombre, version: '5.341.0' });
          await ouvrirReglages(pg);
          const s = await lireR(pg);
          dit(s && new RegExp("Mets l'extension à jour \\(" + EXT_ATTENDUE_APP.replace(/\./g, '\\.') + "\\)").test(s.ext) && !Object.values(s.L).some((x) => x.bouton), 'B1 extension 5.341 : « Mets l’extension à jour (5.344.0) », aucun bouton', s && s.ext);
          await ctx.close();
        });
        await essaie('C' + suf, async () => {
          ROWS = ROWS_DEFAUT();
          const { ctx, pg, errs } = await page(b, T, { sombre });
          await ouvrirJournee(pg);
          const j = await lireJ(pg);
          dit(j && j.comptes.join(' ') === '111:encours 222:fini', 'C1 Ma journée : 111 en cours, 222 fini il y a 2 h ; 333 (rien) ne prend aucune place', j && j.comptes.join(' '));
          dit(j && /400 sur 1/.test(j.texte) && /atelier_test/.test(j.texte), 'C2 la barre dit « 400 sur 1 250 » et le compte', j && j.texte.slice(0, 160));
          dit(j && j.deb <= 0, 'C3 aucun défilement horizontal', j && j.deb);
          dit(!errs.length, 'C4 aucune erreur de page', errs.join(' | ').slice(0, 200));
          await capture(pg, `journee-${suf}`, '[data-import-journee]');
          await ctx.close();
        });
        await essaie('D' + suf, async () => {
          ROWS = [ligne('222', { etat: 'fini', ventes: { lus: 2160, total: 2160, pages: 22, fini: true }, achats: { lus: 340, total: 340, pages: 4, fini: true }, resteMin: 0, fin: auj - 30 * 3600e3 })];
          const { ctx, pg } = await page(b, T, { sombre });
          await ouvrirJournee(pg);
          await pg.waitForTimeout(1500);
          const j = await lireJ(pg);
          dit(j === null, 'D1 tout fini depuis plus d’un jour : Ma journée ne montre rien', j && j.comptes.join(' '));
          await ctx.close();
        });
        await essaie('E' + suf, async () => {
          ROWS = [ligne('111', { etat: 'encours', at: auj - 3600e3, capturedAt: iso(auj - 3600e3), ventes: { lus: 400, total: 1250, pages: 4, fini: false }, achats: { lus: 0, total: null, pages: 0, fini: false }, resteMin: 50 }),
            ligne('222', { etat: 'pause', cause: 'vinted', repriseA: auj + 25 * 60e3, ventes: { lus: 900, total: 2160, pages: 9, fini: false }, achats: { lus: 0, total: null, pages: 0, fini: false }, resteMin: 70 })];
          const { ctx, pg } = await page(b, T, { sombre });
          await ouvrirJournee(pg);
          const j = await lireJ(pg);
          dit(j && j.comptes.join(' ') === '111:arrete 222:pause', 'E1 sans nouvelles depuis 1 h ⇒ « arrêté » ; Vinted freine ⇒ « pause »', j && j.comptes.join(' '));
          dit(j && /ouvre vinted\.fr sur ce compte/.test(j.texte) && /Vinted freine\. Reprise à \d\d:\d\d/.test(j.texte), 'E2 le geste et l’heure de reprise sont dits', j && j.texte.slice(0, 200));
          await capture(pg, `journee-pause-${suf}`, '[data-import-journee]');
          await ctx.close();
        });
      }
    }
  } finally { if (b) await b.close(); srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} banc import de départ : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
