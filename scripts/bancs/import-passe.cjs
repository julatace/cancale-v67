// ═══════════════════════════════════════════════════════════════════════════
// BANC : L'IMPORT DE TON PASSÉ (13 nov., lot 47, extension 5.375)
//        npm run build && BANC_PORT=$((21500+RANDOM%500)) node -r ./scripts/bancs/_porte-banc.cjs scripts/bancs/import-passe.cjs
// ═══════════════════════════════════════════════════════════════════════════
// La VRAIE Ma journée et le VRAI Paramètres → Mon historique Vinted, sur une base
// INVENTÉE : les lignes `import_vinted_{uid}` dans la forme v 2 de `publierImport`
// (background.js 5.375 : horizonMois, estime, pagesEstimees, annonces, souci, enCours).
//   P1. en cours : la tête dit « Import de ton passé · 340 / ~1 200 ventes · compte X »,
//       la barre est remplie sur l'ESTIMATION (≈ 28 %), « 4 pages sur ~12 » ;
//   P2. pause du budget : « suite dans 40 min » (jamais une heure seule) ;
//   P3. compte déconnecté : la phrase dit qu'il faut l'ouvrir et que ça reprend seul (ambre) ;
//   P4. fini sur 12 mois : « Ton passé est importé (12 mois) » UNE fois — la 2e visite ne
//       le montre plus ; la marque « vu » part dans `vrm_import_passe_vu` (synchronisée) ;
//   P5. Paramètres : annonces « 49 ✓ », dressing trop gros « 1 000 sur 1 500 » dit ;
//       extension 5.374 (sans la capacité) ⇒ « Mets l'extension à jour (EXT_CAPACITES.importpasse)… ».
// Les aides (fausse base, faux pont, lecture des écrans) sont celles de `import-depart.cjs`.
// Jugé sur des data-* et des nombres. `BANC_CAPTURE=<dossier>` : captures 390 tactile et
// 1512, clair et sombre. `BANC_DIST=<dossier>` : un autre build (preuve §6.1).
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 21731;
const CAPT = process.env.BANC_CAPTURE || '';
// La version qui apporte l'import de ton passé : celle de l'app (`EXT_CAPACITES.importpasse`), jamais recopiée.
const VERSION_LOT = (/importpasse: '([\d.]+)'/.exec(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'App.jsx'), 'utf8')) || [])[1] || '?';

const auj = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const ACCS = [
  { id: 1, vinted_user_id: '111', login: 'atelier_test', domain: 'www.vinted.fr', updated_at: iso(auj), created_at: iso(auj - 2 * 86400e3), owner: null },
  { id: 2, vinted_user_id: '222', login: 'second_test', domain: 'www.vinted.fr', updated_at: iso(auj), created_at: iso(auj - 2 * 86400e3), owner: null },
];
// La forme EXACTE de `publierImport` (background.js 5.375, `resumeImport` v 2).
const ligne = (uid, o) => ({ id: `import_vinted_${uid}`, data: Object.assign({ v: 2, type: 'import', uid, code: VERSION_LOT, capturedAt: iso(auj), at: auj, debut: auj - 3600e3, demande: false, horizonMois: 12,
  repriseA: null, cause: null, souci: null, souciA: null, fin: null, enCours: 'ventes', annonces: { lus: 0, total: null, fini: false, partiel: false } }, o) });
const ty = (lus, total, estime, pages, pagesEstimees, fini = false, horizon = false) => ({ lus, total, estime, pages, pagesEstimees, fini, horizon });
let ROWS = [];
let MAIN = {};
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

async function page(b, T, { sombre = false, version = VERSION_LOT, onglet = '222' } = {}) {
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
    if (req.method() !== 'GET') { ecrits.push(u + ' ' + (req.postData() || '').slice(0, 400000)); return j([]); }
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    if (/select=data(&|$)/.test(u) && /harvest_\d+_profile/.test(u)) ecrits.push('SELECT_DATA ' + u);
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq && eq[1] === 'main') return j([projette({ id: 'main', data: { ...MAIN, ...(sombre ? { vinted_dark: true } : {}) } }, sel)]);
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


const ENCOURS = () => ligne('111', { etat: 'encours', ventes: ty(340, 2160, 1200, 4, 12), achats: ty(0, null, null, 0, null), resteMin: 50 });
const PAUSE = () => ligne('111', { etat: 'pause', cause: 'budget', repriseA: Date.now() + 40 * 60e3 + 20e3, ventes: ty(1200, 2160, 1200, 12, 12), achats: ty(0, null, null, 0, null), resteMin: 80 });
const DECO = () => ligne('222', { etat: 'encours', souci: 'deconnecte', souciA: auj - 60e3, ventes: ty(400, 900, 520, 4, 6), achats: ty(0, null, null, 0, null), resteMin: 30 });
const FINI = () => ligne('111', { etat: 'fini', enCours: null, fin: auj - 600e3, ventes: ty(486, 2000, 486, 5, 5, true, true), achats: ty(150, 150, 150, 2, 2, true, false), annonces: { lus: 49, total: 49, fini: true, partiel: false }, resteMin: 0 });
const PARTIEL = () => ligne('222', { etat: 'fini', enCours: null, fin: auj - 600e3, ventes: ty(800, 800, 800, 8, 8, true), achats: ty(90, 90, 90, 1, 1, true), annonces: { lus: 1000, total: 1500, fini: true, partiel: true }, resteMin: 0 });
const norm = (s) => String(s || '').replace(/\u202f|\u00a0/g, ' ');

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const T of TAILLES) {
      for (const sombre of CAPT ? [false, true] : [T.nom === '390']) {
        const suf = `${T.nom}${sombre ? '-sombre' : '-clair'}`;
        console.log(`\n══ ${T.nom} px${T.hasTouch ? ' (tactile)' : ''}${sombre ? ' · sombre' : ' · clair'}`);
        await essaie('P1' + suf, async () => {
          ROWS = [ENCOURS(), DECO()];
          const { ctx, pg, errs } = await page(b, T, { sombre, version: VERSION_LOT });
          await ouvrirJournee(pg);
          const r = await pg.evaluate(() => { const c = document.querySelector('[data-import-compte="111"]'); if (!c) return null; const t = c.querySelector('[data-import-type="ventes"]'); const bar = t && t.querySelector('.vrm-imp-barre > i'), cadre = t && t.querySelector('.vrm-imp-barre');
            return { titre: (c.querySelector('[data-import-titre]') || {}).innerText || '', est: t && t.getAttribute('data-import-estime'), pages: (t && (t.querySelector('[data-import-pages-texte]') || {}).innerText) || '', pc: bar && cadre ? Math.round(bar.getBoundingClientRect().width / cadre.getBoundingClientRect().width * 100) : null, h: cadre ? cadre.getBoundingClientRect().height : null }; });
          dit(r && norm(r.titre) === 'Import de ton passé · 340 / ~1 200 ventes · compte atelier_test', 'P1a la tête : « Import de ton passé · 340 / ~1 200 ventes · compte atelier_test »', r && norm(r.titre));
          dit(r && r.pc >= 26 && r.pc <= 30 && r.h > 0 && r.h <= 6, 'P1b la barre FINE se remplit sur l’estimation (340/1 200 ≈ 28 %), pas sur le total (16 %)', r && JSON.stringify({ pc: r.pc, h: r.h }));
          dit(r && norm(r.pages) === '4 pages sur ~12', 'P1c « 4 pages sur ~12 »', r && r.pages);
          const d = await pg.evaluate(() => { const c = document.querySelector('[data-import-compte="222"]'); if (!c) return null; const p = c.querySelector('.vrm-imp-phrase'); return { souci: c.getAttribute('data-import-souci'), texte: p ? p.innerText : '', ton: p && p.getAttribute('data-ton') }; });
          dit(d && d.souci === 'deconnecte' && /pas ouvert sur vinted\.fr/.test(d.texte) && /reprend seul/.test(d.texte) && d.ton === 'geste', 'P3 compte déconnecté : « ouvre-le », « reprend seul », en ambre (un geste)', d && JSON.stringify(d));
          const deb = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          dit(deb <= 0, 'P1d aucun défilement horizontal', deb);
          dit(!errs.length, 'P1e aucune erreur de page', errs.join(' | ').slice(0, 200));
          await capture(pg, `passe-encours-${suf}`, '[data-import-journee]');
          await ctx.close();
        });
        await essaie('P2' + suf, async () => {
          ROWS = [PAUSE()];
          const { ctx, pg } = await page(b, T, { sombre, version: VERSION_LOT });
          await ouvrirJournee(pg);
          const p = await pg.evaluate(() => { const c = document.querySelector('[data-import-compte="111"]'); return c ? { e: c.getAttribute('data-import-etat'), t: c.querySelector('.vrm-imp-phrase').innerText } : null; });
          dit(p && p.e === 'pause' && /suite dans 4[01] min/.test(p.t) && !/\d\d:\d\d/.test(p.t), 'P2 pause du budget : « suite dans 40 min » (pas une heure à deviner)', p && JSON.stringify(p));
          await capture(pg, `passe-pause-${suf}`, '[data-import-journee]');
          await ctx.close();
        });
        await essaie('P4' + suf, async () => {
          ROWS = [FINI()]; MAIN = {};
          const { ctx, pg, ecrits } = await page(b, T, { sombre, version: VERSION_LOT });
          await ouvrirJournee(pg);
          const j1 = await lireJ(pg);
          dit(j1 && /Ton passé est importé \(12 mois\)/.test(j1.texte) && /486 ✓/.test(norm(j1.texte)) && /49 ✓/.test(norm(j1.texte)), 'P4a fini : « Ton passé est importé (12 mois) » · 486 ventes · 49 annonces', j1 && norm(j1.texte).slice(0, 200));
          await capture(pg, `passe-fini-${suf}`, '[data-import-journee]');
          await pg.waitForFunction(() => { try { return !!JSON.parse(localStorage.getItem('vrm_import_passe_vu') || '{}')['111']; } catch (_) { return false; } }, null, { timeout: 8000 }).catch(() => {});
          const vu = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_import_passe_vu') || 'null'); } catch (_) { return null; } });
          dit(vu && Number(vu['111']) === FINI().data.fin, 'P4b la marque « vu » est posée (fin de CE import)', JSON.stringify(vu));
          await pg.waitForTimeout(3000);
          const file = await pg.evaluate(() => { try { return localStorage.getItem('vrm_file_envoi') || ''; } catch (_) { return ''; } });
          dit(ecrits.some((u) => /vrm_import_passe_vu/.test(u)) || /vrm_import_passe_vu/.test(file), 'P4c et part au nuage (écrite dans main, ou dans la file d’envoi qui la rejoue : vu sur un appareil, vu partout)', 'file=' + file.slice(0, 200) + ' · ' + ecrits.map((u) => (u.match(/"id":"[^"]+"/g) || []).join(',') + ' ' + u.length + ' ' + (u.match(/vrm_[a-z_]+/g) || []).slice(0, 8).join(',')).join(' | ').slice(0, 900));
          await ouvrirJournee(pg);
          await pg.waitForTimeout(1500);
          const j2 = await lireJ(pg);
          dit(j2 === null, 'P4d la 2e visite : plus rien (montré UNE fois)', j2 && j2.texte.slice(0, 120));
          await ctx.close();
        });
        await essaie('P5' + suf, async () => {
          ROWS = [FINI(), PARTIEL()];
          const { ctx, pg } = await page(b, T, { sombre, version: VERSION_LOT, onglet: '111' });
          await ouvrirReglages(pg);
          await pg.waitForSelector('[data-import-type="annonces"]', { timeout: 15000 }).catch(() => {});
          const a = await pg.evaluate(() => [...document.querySelectorAll('[data-import-reglages] [data-import-type="annonces"]')].map((e) => ({ lus: e.getAttribute('data-import-lus'), tot: e.getAttribute('data-import-total'), partiel: e.getAttribute('data-import-partiel'), t: e.innerText.replace(/\s+/g, ' ') })));
          dit(a.length === 2 && a[0].lus === '49' && /49 ✓/.test(norm(a[0].t)), 'P5a annonces « 49 ✓ »', JSON.stringify(a[0]));
          dit(a[1] && a[1].partiel === '1' && /1 000 sur 1 500/.test(norm(a[1].t)) && /la visite lit les 1 000 premières/.test(a[1].t), 'P5b dressing trop gros : « 1 000 sur 1 500 », dit pourquoi', a[1] && norm(a[1].t));
          const s = await lireR(pg);
          dit(s && s.L['111'] && /Ton passé est importé \(12 mois\)/.test(s.L['111'].texte), 'P5c Paramètres garde l’état « importé (12 mois) »', s && s.L['111'] && s.L['111'].texte.slice(0, 120));
          await capture(pg, `passe-reglages-${suf}`, '[data-import-reglages]');
          await ctx.close();
          const v = await page(b, T, { sombre, version: '5.374.0', onglet: '111' });
          await ouvrirReglages(v.pg);
          const n = await v.pg.evaluate(() => (document.querySelector('[data-import-ext="passe"]') || {}).innerText || '');
          dit(n.includes(`Mets l’extension à jour (${VERSION_LOT}) pour les 12 mois et les annonces`), `P5d extension 5.374 (sans l’import de ton passé) : « Mets l’extension à jour (${VERSION_LOT})… »`, n);
          await v.ctx.close();
        });
      }
    }
  } finally { if (b) await b.close(); srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} banc import de ton passé : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
