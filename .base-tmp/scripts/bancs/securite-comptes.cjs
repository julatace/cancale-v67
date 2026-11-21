// ═══════════════════════════════════════════════════════════════════════════
// BANC : SÉCURITÉ DES COMPTES (11 nov., lot securite-vinted, extension 5.366)
//        npm run build && BANC_PORT=$((20000+RANDOM%20000)) node -r ./scripts/bancs/_porte-banc.cjs scripts/bancs/securite-comptes.cjs
// ═══════════════════════════════════════════════════════════════════════════
// Le VRAI écran Paramètres → Mes comptes → Sécurité des comptes, une base INVENTÉE :
//   111 atelier_test — « Vinted vérifie ton compte » (contrôle anti-robot vu)
//   222 second_test  — prudence jusqu'à dans 2 h (un refus il y a 10 min)
//   333 troisieme    — rien vu (calme, ou repos selon l'heure du banc)
//   Vestiaire 4242   — vu par l'extension, 3 gestes aujourd'hui
// À LA MAIN :
//   A. Une phrase par compte (data-secu-niveau), l'ambre pour la vérification seulement ;
//      Vestiaire a son groupe ; le tableau « Ce que VRM fait sur tes comptes » compte le journal.
//   B. « Tout arrêter » ⇒ sa clé porte l'arrêt, l'extension reçoit `secuArret`, chaque compte
//      dit « Tout est arrêté » ; « Relancer » ⇒ l'inverse.
//   C. Réglages d'un compte : plafond par jour 5 ⇒ écrit pour CE compte seulement.
//   D. 222 : « Journée calme conseillée » ⇒ « Calme aujourd'hui » pose la date du jour.
// Jugé sur des data-*. `BANC_CAPTURE=<dossier>` : captures 390 tactile et 1512, clair et sombre.
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4582;
const CAPT = process.env.BANC_CAPTURE || '';

const auj = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const ACCS = [
  { id: 1, vinted_user_id: '111', login: 'atelier_test', domain: 'www.vinted.fr', updated_at: iso(auj), created_at: iso(auj - 400 * 86400e3), owner: null },
  { id: 2, vinted_user_id: '222', login: 'second_test', domain: 'www.vinted.fr', updated_at: iso(auj), created_at: iso(auj - 400 * 86400e3), owner: null },
  { id: 3, vinted_user_id: '333', login: 'troisieme', domain: 'www.vinted.fr', updated_at: iso(auj), created_at: iso(auj - 400 * 86400e3), owner: null },
];
const NAV = 'abcdef0123456789';
const ROWS = [
  { id: 'securite_etat_' + NAV, data: { nav: NAV, at: iso(auj), evts: [], comptes: {
    'vinted:111': { robot: { depuis: auj - 5 * 60000 }, prudence: null, dernier: auj - 6 * 60000, jours: {} },
    'vinted:222': { robot: null, prudence: { jusqua: auj + 2 * 3600e3, raison: '429', depuis: auj - 10 * 60000 }, dernier: auj - 11 * 60000, jours: {} },
    'vestiaire:4242': { robot: null, prudence: null, dernier: auj - 3600e3, jours: {} },
  } } },
  { id: 'journal_vrm_111_' + NAV, data: { e: [{ t: auj - 60000, s: 'offre_acceptee' }, { t: auj - 120000, s: 'baisse_prix' }, { t: auj - 86400e3 * 2, s: 'favori' }] } },
  { id: 'journal_vc_4242_' + NAV, data: { e: [{ t: auj - 60000, s: 'reponse' }, { t: auj - 90000, s: 'reponse' }, { t: auj - 100000, s: 'offre_refusee' }] } },
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

const PONT = ({ version }) => {
  const post = (m) => window.postMessage(m, '*');
  window.__cmds = [];
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, code: version, vrm: { ok: true, connecte: true, email: '' }, vinted: { uid: '111', login: 'x' }, cmds: {} } });
    if (d.__vmr === 'cmd') { window.__cmds.push({ cmd: d.cmd, arret: d.arret }); post({ __vmr: 'cmd:result', reqId: d.reqId, resp: d.cmd === 'secuArret' ? { accepte: true, etape: 'fait', arrete: d.arret === true } : { accepte: false, code: 'banc', raison: 'banc' } }); }
  });
  post({ __vmr: 'ready', version });
};

let ko = 0, ok = 0; const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d != null && d !== '' ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 200)); } };
const TAILLES = [{ nom: '390', vp: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, { nom: '1512', vp: { width: 1512, height: 950 } }]
  .filter((t) => !process.env.BANC_TAILLE || t.nom === process.env.BANC_TAILLE);

async function page(b, T, { sombre = false, version = '5.366.0' } = {}) {
  const ctx = await b.newContext({ viewport: T.vp, isMobile: !!T.isMobile, hasTouch: !!T.hasTouch, colorScheme: sombre ? 'dark' : 'light' });
  const pg = await ctx.newPage();
  const errs = [], ecrits = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(({ sombre }) => { try { if (sessionStorage.getItem('__banc')) return; sessionStorage.setItem('__banc', '1'); localStorage.setItem('vrm_acces_direct', '1'); if (sombre) localStorage.setItem('vinted_dark', 'true'); } catch (_) {} }, { sombre });
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
  await pg.locator('[data-securite-comptes]:visible, [data-sous-ouvrir="securite-comptes"]:visible').first().waitFor({ timeout: 30000 }).catch(() => {});
  if (!(await pg.locator('[data-securite-comptes]').first().isVisible().catch(() => false))) await pg.locator('[data-sous-ouvrir="securite-comptes"]').first().click().catch(() => {});
  await pg.waitForFunction(() => document.querySelectorAll('[data-secu-compte][data-secu-niveau]:not([data-secu-niveau="lecture"])').length >= 4, null, { timeout: 20000 }).catch(() => {});
  await pg.waitForFunction(() => { const t = document.querySelector('[data-secu-tableau]'); return t && t.getAttribute('data-secu-tableau') === 'lu'; }, null, { timeout: 15000 }).catch(() => {});
  await pg.waitForTimeout(400);
};
const lire = (pg) => pg.evaluate(() => { const s = document.querySelector('[data-securite-comptes]'); if (!s) return null;
  const L = {}; for (const e of s.querySelectorAll('[data-secu-compte]')) { const ph = e.querySelector('[data-secu-phrase]'); L[e.getAttribute('data-secu-compte')] = { niveau: e.getAttribute('data-secu-niveau'), phrase: ph ? ph.innerText : '', ton: ph ? ph.getAttribute('data-ton') : null, couleur: ph ? getComputedStyle(ph).color : null }; }
  const T = {}; for (const r of s.querySelectorAll('[data-secu-ligne]')) T[r.getAttribute('data-secu-ligne')] = [...r.querySelectorAll('[data-secu-jour-n]')].map((x) => x.getAttribute('data-secu-jour-n'));
  return { L, T, arret: s.getAttribute('data-secu-arret'), groupes: [...s.querySelectorAll('[data-secu-groupe]')].map((g) => g.getAttribute('data-secu-groupe')),
    deb: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    petites: [...s.querySelectorAll('button, input')].filter((x) => !x.disabled && x.getBoundingClientRect().width > 0 && x.getAttribute('role') !== 'switch').map((x) => x.getBoundingClientRect().height).filter((h) => h < 43.5).length }; });
const cle = (pg) => pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_securite_comptes') || 'null'); } catch (_) { return null; } });
// La sauvegarde est différée (`save`) : on attend que SA clé dise ce qu'on attend (8 s au plus).
const attendreCle = async (pg, test) => { for (let i = 0; i < 40; i++) { const k = await cle(pg); if (k && test(k)) return k; await pg.waitForTimeout(200); } return cle(pg); };
const capture = async (pg, nom) => { if (!CAPT) return; fs.mkdirSync(CAPT, { recursive: true }); await pg.waitForTimeout(300); await pg.screenshot({ path: path.join(CAPT, nom + '.png'), fullPage: false }).catch(() => {}); };

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const T of TAILLES) {
      for (const sombre of CAPT ? [false, true] : [false]) {
        const suf = `${T.nom}${sombre ? '-sombre' : '-clair'}`;
        console.log(`\n══ ${T.nom} px${T.hasTouch ? ' (tactile)' : ''}${sombre ? ' · sombre' : ' · clair'}`);
        await essaie('ABCD' + suf, async () => {
          const { ctx, pg, errs } = await page(b, T, { sombre });
          await ouvrir(pg);
          let s = await lire(pg);
          const L = s ? s.L : {};
          // Jugé sur la règle (niveau, hôte, heure), pas sur la langue du navigateur du banc.
          dit(L['vinted:111'] && L['vinted:111'].niveau === 'robot' && /vinted\.fr/.test(L['vinted:111'].phrase), 'A1 atelier_test : « Vinted vérifie ton compte · … sur vinted.fr »', s && JSON.stringify(L['vinted:111']));
          dit(L['vinted:222'] && L['vinted:222'].niveau === 'prudence' && /\d{1,2} h \d{2}/.test(L['vinted:222'].phrase), 'A2 second_test : prudence, l’heure de reprise dite', s && JSON.stringify(L['vinted:222']));
          dit(L['vinted:333'] && ['ok', 'repos'].includes(L['vinted:333'].niveau), 'A3 troisieme : calme (ou repos si le banc tourne la nuit)', s && JSON.stringify(L['vinted:333']));
          dit(L['vestiaire:4242'] && s.groupes.includes('vestiaire') && s.groupes.includes('vinted'), 'A4 Vestiaire a son groupe, le compte vu par l’extension y est', s && JSON.stringify(s.groupes));
          const amb = L['vinted:111'] && L['vinted:111'].couleur, gris = L['vinted:222'] && L['vinted:222'].couleur;
          const chaud = (c) => { const m = /rgb\((\d+), (\d+), (\d+)/.exec(c || ''); return !!m && +m[1] - +m[3] > 60 && +m[2] > 50; };
          dit(L['vinted:111'] && L['vinted:111'].ton === 'geste' && chaud(amb) && !chaud(gris), 'A5 l’ambre pour la vérification seulement (geste à faire), la prudence reste neutre', `${amb} / ${gris}`);
          const t111 = s && s.T['vinted:111'], t4242 = s && s.T['vestiaire:4242'];
          dit(t111 && t111[6] === '2' && t111.filter((x) => x === '1').length === 1 && t4242 && t4242[6] === '3', 'A6 le tableau compte le journal par jour : 2 aujourd’hui (Vinted), 3 (Vestiaire)', s && JSON.stringify(s.T));
          dit(s && s.deb <= 0 && s.petites === 0, 'A7 pas de défilement de côté, cibles ≥ 44 px', s && `deb=${s.deb} petites=${s.petites}`);
          await capture(pg, `securite-comptes-${suf}`);
          // ── B ──
          await pg.locator('[data-secu-tout-arreter]').click();
          await pg.waitForFunction(() => document.querySelector('[data-securite-comptes]').getAttribute('data-secu-arret') === '1', null, { timeout: 8000 }).catch(() => {});
          s = await lire(pg);
          const k1 = await attendreCle(pg, (k) => Array.isArray(k.evts) && k.evts.length > 0);
          const cmds = await pg.evaluate(() => window.__cmds.slice());
          const ev = k1 && Array.isArray(k1.evts) ? k1.evts[k1.evts.length - 1] : null;
          dit(s && s.arret === '1' && ev && ev.s === 'arret' && cmds.some((c) => c.cmd === 'secuArret' && c.arret === true), 'B1 « Tout arrêter » : sa clé porte l’arrêt, l’extension reçoit l’ordre tout de suite', JSON.stringify({ ev, cmds }));
          const nArret = await pg.locator('[data-secu-arrete]').count();
          dit(s && nArret === 1 && !Object.values(s.L).some((x) => x.niveau === 'arret') && s.L['vinted:111'].niveau === 'robot', 'B2 « Tout est arrêté » dit UNE fois, en tête (§7) ; chaque compte garde son état (la vérification reste dite)', s && JSON.stringify({ nArret, n: Object.values(s.L).map((x) => x.niveau) }));
          await capture(pg, `securite-comptes-arret-${suf}`);
          await pg.locator('[data-secu-relancer]').click();
          await pg.waitForTimeout(400);
          s = await lire(pg);
          const k2 = await attendreCle(pg, (k) => Array.isArray(k.evts) && k.evts.length > 1);
          dit(s && s.arret === '0' && k2 && k2.evts[k2.evts.length - 1].s === 'relance', 'B3 « Relancer » : le dernier geste fait foi', JSON.stringify(k2));
          // ── C ──
          await pg.locator('[data-secu-compte="vinted:333"] > .vrm-ios-rangee-zone').click();
          const champ = pg.locator('[data-secu-reglages="vinted:333"] [data-secu-champ="parJour"]');
          await champ.fill('5'); await champ.press('Enter'); await pg.waitForTimeout(300);
          const k3 = await attendreCle(pg, (k) => k.comptes && k.comptes['vinted:333']);
          dit(k3 && k3.comptes && k3.comptes['vinted:333'] && k3.comptes['vinted:333'].parJour === 5 && !(k3.comptes['vinted:111']), 'C1 plafond par jour 5 : écrit pour CE compte seulement', JSON.stringify(k3 && k3.comptes));
          await capture(pg, `securite-comptes-reglages-${suf}`);
          await pg.locator('[data-secu-compte="vinted:333"] > .vrm-ios-rangee-zone').click();
          // ── D ──
          await pg.locator('[data-secu-compte="vinted:222"] > .vrm-ios-rangee-zone').click();
          const conseil = await pg.locator('[data-secu-reglages="vinted:222"] [data-secu-conseil-calme]').count();
          if (conseil) await pg.locator('[data-secu-reglages="vinted:222"] [data-secu-calme-poser]').click();
          await pg.waitForTimeout(300);
          const k4 = await attendreCle(pg, (k) => k.comptes && k.comptes['vinted:222']);
          const dates = k4 && k4.comptes && k4.comptes['vinted:222'] && k4.comptes['vinted:222'].calmeDates;
          dit(conseil === 1 && Array.isArray(dates) && dates.length === 1 && /^\d{4}-\d{2}-\d{2}$/.test(dates[0]), 'D1 un refus vu ⇒ « Journée calme conseillée », « Calme aujourd’hui » pose la date', JSON.stringify({ conseil, dates }));
          s = await lire(pg);
          dit(s && s.L['vinted:222'].niveau === 'prudence', 'D2 la prudence reste dite en premier (plus importante que la journée calme)', s && s.L['vinted:222'].niveau);
          dit(!errs.length, 'Z aucune erreur de page', errs.join(' | '));
          await ctx.close();
        });
      }
    }
  } catch (e) { dit(false, 'banc', String(e && e.message || e)); }
  finally { try { await b.close(); } catch (_) {} srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} securite-comptes : ${ok} verts, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
})();
