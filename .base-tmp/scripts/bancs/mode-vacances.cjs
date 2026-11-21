// ═══════════════════════════════════════════════════════════════════════════
// BANC : MODE VACANCES (10 nov., lot O, extension 5.338)
//        npm run build && BANC_PORT=$((20000+RANDOM%20000)) node -r ./scripts/bancs/_porte-banc.cjs scripts/bancs/mode-vacances.cjs
// ═══════════════════════════════════════════════════════════════════════════
// Le VRAI écran Paramètres → Mes comptes → Mode vacances, une base INVENTÉE (aucune
// donnée réelle), un faux pont qui RETIENT chaque commande `vacancesVinted` jusqu'à
// ce que le banc la relâche (§6.5). Trois comptes :
//   111 atelier_test — profil lu « ouvert », ouvert dans l'onglet vinted.fr
//   222 second_test  — profil lu « en vacances »
//   333 troisieme    — aucun profil lu (« — »)
// VRM a appris « mettre en vacances », jamais « rouvrir ».
// À LA MAIN :
//   A. Les trois rangées : Ouvert · En vacances · — ; trois autres sites « À faire sur le site ».
//   B. « Tout mettre en vacances » → « Mettre atelier_test en vacances ? » → oui : UNE commande
//      (111, vacances, confirmée), rien d'autre ; « Envoi… » ; relâchée « fait, relu » ⇒ 111
//      « En vacances · Fait, relu » ; 333 « Ouvre vinted.fr sur ce compte » (ambre).
//   C. « Tout rouvrir » : jamais appris ⇒ aucune commande, « Rouvre ce compte une fois à la main… ».
//   D. Réponse « envoyé, pas relu » ⇒ « Pas relu », la rangée reste « Ouvert » (l'état LU).
//   E. Extension 5.337 : la raison est dite, les deux boutons grisés, rien ne part.
//   F. L'onglet sur un compte qui n'est pas à lui : rien ne part, chaque rangée « Ouvre vinted.fr… ».
// Jugé sur des data-*. `BANC_CAPTURE=<dossier>` : captures 390 tactile et 1512, clair et
// sombre. `BANC_DIST=<dossier>` : un autre build (preuve §6.1, mutations).
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
  { id: 1, vinted_user_id: '111', login: 'atelier_test', domain: 'www.vinted.fr', updated_at: iso(auj), created_at: iso(auj - 400 * 86400e3), owner: null },
  { id: 2, vinted_user_id: '222', login: 'second_test', domain: 'www.vinted.fr', updated_at: iso(auj), created_at: iso(auj - 400 * 86400e3), owner: null },
  { id: 3, vinted_user_id: '333', login: 'troisieme', domain: 'www.vinted.fr', updated_at: iso(auj), created_at: iso(auj - 400 * 86400e3), owner: null },
];
const ROWS = [
  { id: 'harvest_111_profile', data: { uid: '111', type: 'profile', capturedAt: iso(auj - 3 * 3600e3), payload: { code: 0, user: { id: 9000111, is_on_holiday: false } } } },
  { id: 'harvest_222_profile', data: { uid: '222', type: 'profile', capturedAt: iso(auj - 26 * 3600e3), payload: { code: 0, user: { id: 9000222, is_on_holiday: true } } } },
  { id: 'vinted_vacances_recette', data: { recettes: { on: { methode: 'PUT', chemin: '/api/v2/users/{moi}/exemple', corps: '{"x":{"is_on_holiday":true}}', cle: ['x', 'is_on_holiday'] } }, dernier: { rejouable: true, sens: 'on' } } },
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
      if (d.cmd === 'vacancesVinted') { window.__cmds.push({ cmd: d.cmd, uid: d.uid, vacances: d.vacances, confirme: d.confirme }); window.__attente.push(d); return; }
      post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: false, code: 'banc', raison: 'banc' } });
    }
  });
  post({ __vmr: 'ready', version });
};

let ko = 0, ok = 0; const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d != null && d !== '' ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 200)); } };
const TAILLES = [{ nom: '390', vp: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, { nom: '1512', vp: { width: 1512, height: 950 } }]
  .filter((t) => !process.env.BANC_TAILLE || t.nom === process.env.BANC_TAILLE);

async function page(b, T, { sombre = false, version = '5.338.0', onglet = '111' } = {}) {
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
    if (req.method() !== 'GET') { ecrits.push(u); return j([]); }
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
const ouvrir = async (pg) => {
  await pg.goto(`http://localhost:${PORT}/?tab=settings`, { waitUntil: 'domcontentloaded' });
  await pg.locator('[data-mode-vacances]:visible, [data-sous-ouvrir="vacances"]:visible').first().waitFor({ timeout: 30000 }).catch(() => {});
  if (!(await pg.locator('[data-mode-vacances]').first().isVisible().catch(() => false))) await pg.locator('[data-sous-ouvrir="vacances"]').first().click().catch(() => {});
  await pg.waitForSelector('[data-vac-ligne]', { timeout: 20000 }).catch(() => {});
  await pg.waitForFunction(() => document.querySelectorAll('[data-vac-ligne][data-vac-etat="non"]').length > 0, null, { timeout: 15000 }).catch(() => {});
  await pg.waitForTimeout(400);
};
const lire = (pg) => pg.evaluate(() => { const s = document.querySelector('[data-mode-vacances]'); if (!s) return null;
  const L = {}; for (const e of s.querySelectorAll('[data-vac-ligne]')) L[e.getAttribute('data-vac-ligne')] = { etat: e.getAttribute('data-vac-etat'), action: e.getAttribute('data-vac-action'), onglet: e.getAttribute('data-vac-onglet'), issue: e.getAttribute('data-vac-issue'),
    valeur: (e.querySelector('[data-vac-valeur]') || {}).innerText || '', sous: (e.querySelector('[data-vac-sous]') || {}).innerText || '', ambre: (() => { const a = e.querySelector('[data-vac-sous][data-ton="geste"]'); return a ? getComputedStyle(a).color : null; })() };
  const b = (k) => { const x = s.querySelector(`[data-vac-tout="${k}"]`); return x ? { off: x.disabled, h: x.getBoundingClientRect().height } : null; };
  return { L, on: b('on'), off: b('off'), ext: (s.querySelector('[data-vac-ext]') || {}).innerText || '', apprendre: (s.querySelector('[data-vac-apprendre]') || { getAttribute: () => null }).getAttribute('data-vac-apprendre'),
    sites: [...s.querySelectorAll('[data-vac-site]')].map((x) => x.getAttribute('data-vac-site') + ':' + ((x.querySelector('a') || {}).href || '')), texte: s.innerText,
    deb: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    petites: [...s.querySelectorAll('button, a')].filter((x) => !x.disabled && x.getBoundingClientRect().width > 0 && !x.closest('.vrm-vac-note')).map((x) => x.getBoundingClientRect().height).filter((h) => h < 43.5).length }; });
const cmds = (pg) => pg.evaluate(() => window.__cmds.slice());
const relacher = (pg, resp) => pg.evaluate((r) => window.__relacher(r), resp);
const capture = async (pg, nom) => { if (!CAPT) return; fs.mkdirSync(CAPT, { recursive: true }); await pg.waitForTimeout(300); await pg.screenshot({ path: path.join(CAPT, nom + '.png'), fullPage: false }).catch(() => {}); };
const confirmer = async (pg) => { await pg.waitForSelector('.vrm-confirmation', { timeout: 8000 }); const t = await pg.locator('.vrm-confirmation').innerText(); await pg.locator('.vrm-confirmation .vrm-b-primaire').first().click(); return t; };

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
          await ouvrir(pg);
          let s = await lire(pg);
          const L = s ? s.L : {};
          dit(s && L['111'] && L['111'].etat === 'non' && L['222'] && L['222'].etat === 'oui' && L['333'] && L['333'].etat === 'passu', 'A1 états LUS : atelier_test ouvert · second_test en vacances · troisieme « — »', s && JSON.stringify(L));
          dit(L['333'] && L['333'].valeur.trim() === '—' && L['111'].valeur.trim() === 'Ouvert' && L['222'].valeur.trim() === 'En vacances', 'A2 les mots : Ouvert · En vacances · —', s && Object.values(L).map((x) => x.valeur).join(' | '));
          dit(L['111'] && L['111'].onglet === '1' && L['222'].onglet === '0', 'A3 le compte ouvert dans Chrome est marqué');
          dit(s && s.sites.length === 3 && s.sites.every((x) => /https:\/\//.test(x)), 'A4 Leboncoin, eBay, Vestiaire : « À faire sur le site », un lien', s && s.sites.join(' '));
          dit(s && s.on && !s.on.off && s.off && !s.off.off, 'A5 les deux boutons sont actifs (extension 5.338)', s && JSON.stringify([s.on, s.off]));
          dit(s && s.deb <= 0 && s.petites === 0 && s.on.h >= 44, 'A6 pas de défilement de côté, cibles ≥ 44 px', s && `deb=${s.deb} petites=${s.petites}`);
          dit(!ecrits.some((u) => /SELECT_DATA/.test(u)), 'A7 jamais `select=data` sur un profil', ecrits.filter((u) => /SELECT_DATA/.test(u)).join(' '));
          await capture(pg, `mode-vacances-${suf}`);
          // ── B ──
          await pg.locator('[data-vac-tout="on"]').click();
          const texteConf = await confirmer(pg);
          dit(/atelier_test/.test(texteConf), 'B1 la confirmation nomme LE compte qui part', texteConf.replace(/\s+/g, ' '));
          await pg.waitForFunction(() => window.__cmds.length >= 1, null, { timeout: 10000 }).catch(() => {});
          await pg.waitForTimeout(400);
          let c = await cmds(pg);
          dit(c.length === 1 && c[0].uid === '111' && c[0].vacances === true && c[0].confirme === true, 'B2 UNE commande : atelier_test (l’onglet), en vacances, confirmée', JSON.stringify(c));
          s = await lire(pg);
          dit(s && /Envoi/.test(s.L['111'].valeur) && s.on.off && s.off.off, 'B3 pendant : « Envoi… », boutons grisés', s && JSON.stringify([s.L['111'].valeur, s.on, s.off]));
          await relacher(pg, { accepte: true, etape: 'fait', vacances: true });
          await pg.waitForFunction(() => { const e = document.querySelector('[data-vac-ligne="111"]'); return e && e.getAttribute('data-vac-issue') === 'fait'; }, null, { timeout: 10000 }).catch(() => {});
          s = await lire(pg);
          dit(s && s.L['111'].etat === 'oui' && /Fait, relu/.test(s.L['111'].valeur), 'B4 relâchée « fait » ⇒ atelier_test « En vacances · Fait, relu »', s && JSON.stringify(s.L['111']));
          dit(s && s.L['333'].action === 'ouvrir' && /Ouvre vinted\.fr sur ce compte/.test(s.L['333'].sous) && s.L['222'].action === 'fait', 'B5 troisieme : « Ouvre vinted.fr sur ce compte » ; second_test déjà en vacances', s && JSON.stringify([s.L['333'], s.L['222']]));
          const amb = s && s.L['333'].ambre;
          dit(amb && (() => { const m = /rgb\((\d+), (\d+), (\d+)/.exec(amb); return m && +m[1] - +m[3] > 60 && +m[2] > 50; })(), 'B6 le geste est en ambre (chaud, pas rouge, pas gris)', amb);
          await pg.waitForTimeout(600);
          c = await cmds(pg);
          dit(c.length === 1, 'B7 rien d’autre n’est parti (un compte à la fois)', c.length);
          await capture(pg, `mode-vacances-apres-${suf}`);
          // ── C ──
          await pg.locator('[data-vac-tout="off"]').click();
          await pg.waitForTimeout(700);
          s = await lire(pg);
          c = await cmds(pg);
          dit(c.length === 1 && s && s.apprendre === 'off' && s.L['111'].action === 'apprendre', 'C1 « Tout rouvrir » jamais appris ⇒ aucune commande, « une fois à la main »', s && JSON.stringify({ n: c.length, a: s.apprendre, l: s.L['111'] }));
          dit(!(await pg.locator('.vrm-confirmation').count()), 'C2 … et aucune confirmation ouverte');
          await capture(pg, `mode-vacances-apprendre-${suf}`);
          dit(!errs.length, 'Z aucune erreur de page', errs.join(' | '));
          await ctx.close();
        });
        if (sombre && !CAPT) continue;
      }
      // ── D, E, F (clair seulement) ──
      await essaie('D' + T.nom, async () => {
        const { ctx, pg } = await page(b, T, {});
        await ouvrir(pg);
        await pg.locator('[data-vac-tout="on"]').click(); await confirmer(pg);
        await pg.waitForFunction(() => window.__cmds.length >= 1, null, { timeout: 10000 }).catch(() => {});
        await relacher(pg, { accepte: true, etape: 'incertain', vacances: null, raison: 'Vinted a accepté, mais VRM n’a pas pu relire : regarde ton profil' });
        await pg.waitForFunction(() => { const e = document.querySelector('[data-vac-ligne="111"]'); return e && e.getAttribute('data-vac-issue') === 'incertain'; }, null, { timeout: 10000 }).catch(() => {});
        const s = await lire(pg);
        dit(s && s.L['111'].issue === 'incertain' && s.L['111'].etat === 'non' && /Pas relu/.test(s.L['111'].valeur), 'D1 « envoyé, pas relu » ⇒ « Pas relu », la rangée garde l’état LU (jamais l’état voulu)', s && JSON.stringify(s.L['111']));
        await ctx.close();
      });
      await essaie('E' + T.nom, async () => {
        const { ctx, pg } = await page(b, T, { version: '5.337.0' });
        await ouvrir(pg);
        const s = await lire(pg);
        dit(s && s.on.off && s.off.off && /5\.(33[89]|3[4-9]\d)\.\d/.test(s.ext), 'E1 extension 5.337 : la raison est dite (version servie ≥ 5.338), les deux boutons grisés', s && JSON.stringify({ on: s.on, ext: s.ext }));
        await pg.locator('[data-vac-tout="on"]').click({ force: true }).catch(() => {});
        await pg.waitForTimeout(500);
        dit((await cmds(pg)).length === 0, 'E2 … rien ne part');
        if (CAPT) await capture(pg, `mode-vacances-ext-${T.nom}`);
        await ctx.close();
      });
      await essaie('F' + T.nom, async () => {
        const { ctx, pg } = await page(b, T, { onglet: '999' });
        await ouvrir(pg);
        await pg.locator('[data-vac-tout="on"]').click();
        await pg.waitForTimeout(700);
        const s = await lire(pg);
        dit((await cmds(pg)).length === 0 && !(await pg.locator('.vrm-confirmation').count()), 'F1 l’onglet sur un autre compte : rien ne part, aucune confirmation');
        dit(s && s.L['111'].action === 'ouvrir' && s.L['333'].action === 'ouvrir', 'F2 chaque compte pas en vacances dit « Ouvre vinted.fr sur ce compte »', s && JSON.stringify(s.L));
        await ctx.close();
      });
    }
  } catch (e) { dit(false, 'banc', String(e && e.message || e)); }
  finally { try { await b.close(); } catch (_) {} srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} mode-vacances : ${ok} verts, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
})();
