// ═══════════════════════════════════════════════════════════════════════════
// BANC : TON HISTORIQUE VINTED (11 nov., lot import-depart, extension 5.344) — 5.455.8 : juge le RETRAIT de l'import (voir plus bas)
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

// ⚠️ 5.455.8 (Julien, 28 nov. : « Import de ton passé : je t'avais demandé de l'enlever ») : plus AUCUNE carte ni bouton
//    d'import — ni « Tout récupérer », ni barres, ni « Import de ton passé » ; l'extension lit tout l'historique seule. Ce banc
//    juge désormais ce RETRAIT : Réglages → Mon historique dit UNE ligne sans bouton (« en cours » quand un import tourne) ;
//    Ma journée ne montre rien, même pendant un import ; aucune commande `importTout` ne part.
const ouvrirReglages = async (pg) => {
  await pg.goto(`http://localhost:${PORT}/?tab=settings`, { waitUntil: 'domcontentloaded' });
  await pg.locator('[data-import-reglages]:visible, [data-sous-ouvrir="historique"]:visible').first().waitFor({ timeout: 30000 }).catch(() => {});
  if (!(await pg.locator('[data-import-reglages]').first().isVisible().catch(() => false))) await pg.locator('[data-sous-ouvrir="historique"]').first().click().catch(() => {});
  await pg.waitForSelector('[data-import-ligne-unique]', { timeout: 20000 }).catch(() => {});
  await pg.waitForFunction(() => { const x = document.querySelector('[data-import-ligne-unique]'); return x && x.getAttribute('data-import-ligne-unique') === 'encours'; }, null, { timeout: 8000 }).catch(() => {});
  await pg.waitForTimeout(300);
};
const lireR = (pg) => pg.evaluate(() => { const s = document.querySelector('[data-import-reglages]'); if (!s) return null;
  const u = s.querySelectorAll('[data-import-ligne-unique]');
  return { lignes: u.length, etat: u[0] ? u[0].getAttribute('data-import-ligne-unique') : null, boutons: s.querySelectorAll('button, [data-import-tout]').length + document.querySelectorAll('[data-import-tout]').length,
    barres: s.querySelectorAll('.vrm-imp-barre').length, texte: s.innerText, deb: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
const ouvrirJournee = async (pg) => {
  await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(3000);
};
const cmds = (pg) => pg.evaluate(() => window.__cmds.slice());
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
          dit(s && s.lignes === 1 && s.etat === 'encours' && /lecture par l’extension/.test(s.texte), 'A1 Réglages → Mon historique : UNE ligne, « en cours de lecture par l’extension, toute seule »', s && JSON.stringify(s));
          dit(s && s.boutons === 0 && s.barres === 0 && !/Import de ton passé|Tout récupérer/.test(s.texte), 'A2 ni bouton « Tout récupérer », ni barre, ni « Import de ton passé »', s && JSON.stringify(s));
          dit(s && s.deb <= 0, 'A3 aucun défilement horizontal', s && s.deb);
          await capture(pg, `reglages-${suf}`, '[data-import-reglages]');
          const c = await cmds(pg);
          dit(!c.length, 'A4 aucune commande importTout ne part', JSON.stringify(c));
          dit(!ecrits.some((u) => /SELECT_DATA|import_vinted_|harvest_/.test(u)), 'A5 l’app n’écrit jamais la ligne de l’extension ni une capture ; aucun select=data', JSON.stringify(ecrits));
          dit(!errs.length, 'A6 aucune erreur de page', errs.join(' | ').slice(0, 200));
          await ctx.close();
        });
        await essaie('C' + suf, async () => {
          ROWS = ROWS_DEFAUT();
          const { ctx, pg, errs } = await page(b, T, { sombre });
          await ouvrirJournee(pg);
          const n = await pg.evaluate(() => document.querySelectorAll('[data-import-journee], [data-import-tout]').length + (/Import de ton passé|Tout récupérer/.test(document.body.innerText) ? 1 : 0));
          dit(n === 0, 'C1 Ma journée : aucune carte d’import, même pendant un import', String(n));
          dit(!errs.length, 'C2 aucune erreur de page', errs.join(' | ').slice(0, 200));
          await ctx.close();
        });
      }
    }
  } finally { if (b) await b.close(); srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} banc import de départ : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
