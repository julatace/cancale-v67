// Banc : REPUBLIER À SON HEURE + HISTORIQUE DES REPUBLICATIONS (11 nov., lot republier-programme).
// Le vrai build (dist), données INVENTÉES, une fausse base À ÉTAT (la ligne `vrm_repub_programme`
// s'écrit et se relit, PATCH gardé par `data->>rev`), un faux pont d'extension (5.368) dont l'état
// dit l'onglet vinted.fr et le frein. 390 px tactile et 1512 px ; `SHOTS=dossier` garde les captures,
// `THEMES=clair,sombre`.
//   A. Atelier : « Programmer… » montre les conditions À L'AVANCE ; « Programmer » écrit SA
//      programmation (SON heure exacte, SES paires dans SON ordre, ses réglages) ; RIEN ne part ;
//      la carte « Republication programmée » apparaît dans Annonces (Modifier / Annuler).
//   B. Historique : « republiée 1 fois · dernière il y a 12 j · +6 favoris » sous l'annonce dans
//      l'atelier, par identité (deux annonces au même titre : une seule est republiée).
//   C. C'est l'heure, tout est là : le départ est PRIS (ligne « partie »), l'atelier part avec
//      SES paires seulement, dans SON ordre, et la feuille « VRM travaille » s'ouvre.
//   D. C'est l'heure, aucun onglet vinted.fr : RIEN ne part, « pas partie » + la raison sur la carte.
//   E. L'heure est passée de 20 min (VRM fermé) : RIEN ne part, « pas partie » (fermé).
// §6.1 : sur un build d'origin/main, `[data-rp-ouvrir]` n'existe pas et rien n'est relu ⇒ rouge.
require('../_source-app.cjs').brancher();
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT) || 4391;
const SHOTS = process.env.SHOTS || '';
const THEMES = (process.env.THEMES || 'clair').split(',');
const LARGEURS = (process.env.LARGEURS || '390,1512').split(',').map(Number);
const SCENES = process.env.SCENES || 'ABCDE';
const auj = new Date();
const ann = (id, o) => Object.assign({ id, price: { amount: '49.0', currency_code: 'EUR' }, is_closed: false, is_draft: false, photo: null, brand_title: 'Nike', size_title: '42', status: 'Très bon état', view_count: 10, favourite_count: 1 }, o);
const ITEMS = [
  ann(9102, { title: 'Nike Dunk low panda taille 41', favourite_count: 6, view_count: 70, created_at_ts: Math.floor(auj / 1000) - 12 * 86400 }),
  ann(9103, { title: 'Nike Dunk low panda taille 41', favourite_count: 0, created_at_ts: Math.floor(auj / 1000) - 60 * 86400 }),
  ann(9104, { title: 'Salomon XT-6 blanc taille 40', brand_title: 'Salomon', favourite_count: 2, created_at_ts: Math.floor(auj / 1000) - 40 * 86400 }),
];
const MAIN = { vinted_annonce_numeros: { '9102': { numero: '42', recreeDe: '9001', recreeAt: new Date(auj - 12 * 86400e3).toISOString() }, '9103': { numero: '43' }, '9104': { numero: '44' } } };
const HEX = '0123456789abcdef';
function base(scene) {
  const rows = [
    { id: 'main', data: MAIN },
    { id: 'harvest_111_listings', data: { capturedAt: auj.toISOString(), payload: { items: ITEMS, pagination: { total_entries: ITEMS.length } } } },
    { id: 'vrm_repub_journal', data: { rev: 1, v: 1, e: { 9102: ['9001', auj - 12 * 86400e3, 3, 50, 'recreer'] } } },
    { id: `actions_compte_111_${HEX}`, data: { ts: [], max: 50, reserve: 5 } },
  ];
  if (scene.prog) rows.push({ id: 'vrm_repub_programme', data: { rev: 3, v: 1, programmes: { 111: scene.prog } } });
  return rows;
}
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];
const VERSION = (/EXT_ATTENDUE = '([\d.]+)'/.exec(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'App.jsx'), 'utf8')) || [])[1] || '5.368.0';
const PONT = (o) => {
  const post = (m) => window.postMessage(m, '*');
  window.__repub = [];
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version: o.version });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version: o.version, code: o.version, ext: 'banc-ext', vrm: { ok: true, connecte: true, email: '' }, vinted: { uid: '111', login: 'compte_test' }, cmds: {}, repub: o.repub } });
    if (d.__vmr === 'cmd' && d.cmd === 'recreerVinted') {
      window.__repub.push({ cmd: d.cmd, id: d.id, uid: d.uid, prix: d.prix, confirme: d.confirme });
      setTimeout(() => post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: true, etape: 'fait', nouvelId: String(99000 + Number(d.id) % 1000), nouveau: d.prix } }), 300);
    } else if (d.__vmr === 'cmd') post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: true, etape: 'recent' } });
  });
  post({ __vmr: 'ready', version: o.version });
};
const passerVerif = async (pg) => { try { const f = await pg.waitForSelector('[data-verif-sheet]', { timeout: 900 }); if (f) { await pg.click('[data-verif-publier]'); await pg.waitForTimeout(200); } } catch (_) {} };
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ')'); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg.replace(/^"|"$/g, '')];
    out[alias] = v == null ? null : (src.includes('->>') && typeof v === 'object' ? JSON.stringify(v) : v);
  }
  return out;
};
async function page(b, vp, theme, scene) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}), colorScheme: theme === 'sombre' ? 'dark' : 'light' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const rows = base(scene);
  const ecrits = [];
  await pg.addInitScript((sombre) => { try { localStorage.setItem('vrm_acces_direct', '1'); if (sombre) localStorage.setItem('vinted_dark', 'true'); } catch (_) {} }, theme === 'sombre');
  await pg.addInitScript(PONT, { version: VERSION, repub: scene.repub === undefined ? { onglet: true, frein: null } : scene.repub });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', async (route) => {
    const req = route.request(); const m = req.method();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d, st = 200) => route.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (m === 'POST' && /\/rest\/v1\/app_data/.test(u)) {
      let arr = []; try { arr = JSON.parse(req.postData() || '[]'); } catch (_) {}
      for (const x of (Array.isArray(arr) ? arr : [arr])) if (x && /^vrm_repub_/.test(x.id)) { if (rows.some((r) => r.id === x.id)) return j({}, 409); rows.push({ id: x.id, data: x.data }); ecrits.push({ id: x.id, data: x.data }); }
      return j(null, 201);
    }
    if (m === 'PATCH' && eq && /^vrm_repub_/.test(eq[1])) {
      const r = rows.find((x) => x.id === eq[1]); const g = (/data->>rev=([^&]*)/.exec(u) || [])[1];
      if (!r) return j([]);
      const rev = r.data.rev == null ? 'is.null' : `eq.${r.data.rev}`;
      if (g && g !== rev) return j([]);
      r.data = JSON.parse(req.postData()).data; ecrits.push({ id: r.id, data: r.data }); return j([{ id: r.id }]);
    }
    if (m !== 'GET' && m !== 'HEAD') return j([]);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data|^data$|^data,/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: auj.toISOString(), cap: r.data.capturedAt });
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const lk = /[?&]id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, rows, ecrits, errs };
}
const prog = (o) => Object.assign({ id: 'pbanc', uid: '111', compte: 'compte_test', action: 'recreer', ids: ['9104', '9102'], at: Date.now() - 20000, creeAt: Date.now() - 86400e3, majAt: Date.now() - 86400e3,
  reglages: { regs: { photo: null, prix: { base: 'aucun' }, titre: { mode: 'aucun' }, lettre: false }, esp: { mode: 'fixe', min: 1, max: 3, fixe: 0 }, plan: { 9104: 0, 9102: 1 }, lettres: {}, ordre: ['9104', '9102'], viaBrouillon: true }, etat: 'attente', raisons: [] }, o || {});
const ligneProg = (rows) => { const r = rows.find((x) => x.id === 'vrm_repub_programme'); return r && r.data && r.data.programmes && r.data.programmes['111']; };
const attendre = async (f, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await f()) return true; await new Promise((r) => setTimeout(r, 250)); } return false; };

async function moteur(pg) {
  await pg.locator('[data-actions-ouvrir]').first().click();
  await pg.waitForSelector('[data-selection-vue]', { timeout: 8000 });
  await pg.evaluate(() => { for (const c of document.querySelectorAll('[data-selection-annonce] input:checked')) c.click(); });
  await pg.locator('[data-selection-compte="111"] [data-selection-annonce="9104"] input').first().check();
  await pg.locator('[data-selection-compte="111"] [data-selection-annonce="9102"] input').first().check();
  if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `rp-selection-${pg.viewportSize().width}.png`) });
  // (vue « Republier » d'Annonces) « Par VRM · N » ouvre l'atelier ; sinon « Actions » → Republier.
  const parVrm = pg.locator('.vrm-sel-barre [data-republier-lancer]');
  if (await parVrm.count()) await parVrm.first().click();
  else { await pg.locator('[data-actions-possibles]').click({ timeout: 8000 }); await pg.locator('[data-action-sel="recreer"]').click(); }
  await pg.locator('[data-republier]').waitFor({ state: 'visible', timeout: 6000 });
}

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const theme of THEMES) for (const w of LARGEURS) {
      const vp = { width: w, height: w < 600 ? 844 : 950 };
      const tag = `${w}-${theme}`;
      console.log(`── ${tag}`);
      // ── A + B
      if (/[AB]/.test(SCENES)) { const { ctx, pg, rows, ecrits, errs } = await page(b, vp, theme, {});
        await pg.goto(`http://localhost:${PORT}/?tab=cat_annonces`, { waitUntil: 'domcontentloaded' });
        await pg.locator('[data-actions-ouvrir]').first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
        await moteur(pg);
        await pg.locator('[data-republier] button', { hasText: /^Retour$/ }).first().click().catch(() => {});
        await pg.locator('[data-republier-paire="9102"]').waitFor({ timeout: 5000 }).catch(() => {});
        // B : l'historique sous l'annonce, par identité
        const h = await pg.evaluate(() => { const e = document.querySelector('[data-rh-ligne="9102"]'); return e ? { n: e.getAttribute('data-rh-n'), j: e.getAttribute('data-rh-jours'), f: e.getAttribute('data-rh-favoris'), t: e.textContent } : null; });
        dit(h && h.n === '1' && h.j === '12' && h.f === '6', 'B1 sous l’annonce : republiée 1 fois · dernière il y a 12 j · +6 favoris', h ? h.t : 'absent');
        dit(await pg.locator('[data-rh-ligne="9103"]').count() === 0, 'B2 l’autre annonce au MÊME titre n’a aucun historique (jamais par titre)');
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `rp-choix-${tag}.png`) });
        // A : vers l'envoi
        for (let i = 0; i < 3; i++) { const s = pg.locator('[data-republier-suivant]'); if (await s.count() && await s.isVisible()) { await s.click(); await pg.waitForTimeout(250); } }
        await pg.locator('[data-republier-esp-choix="fixe"]').click().catch(() => {});
        dit(await pg.locator('[data-rp-ouvrir]').count() === 0, 'A0 « Programmer… » n’est proposé qu’après « Je confirme » (comme Lancer)');
        await pg.locator('[data-republier-confirme]').check();
        const ordreVu = await pg.$$eval('[data-republier-ligne]', (els) => els.map((e) => e.getAttribute('data-republier-ligne')));
        await pg.locator('[data-rp-ouvrir]').click();
        const cond = await pg.locator('[data-rp-conditions] li').count();
        dit(cond === 5, 'A1 les conditions du départ sont dites À L’AVANCE (VRM ouvert, onglet sur le compte, extension, plafond, pause)', String(cond));
        const cible = new Date(Date.now() + 26 * 3600e3); cible.setSeconds(0, 0); cible.setMinutes(0); cible.setHours(18);
        const d2 = (n) => String(n).padStart(2, '0');
        const val = `${cible.getFullYear()}-${d2(cible.getMonth() + 1)}-${d2(cible.getDate())}T18:00`;
        await pg.locator('[data-rp-heure]').fill(val);
        const btn = await pg.locator('[data-rp-valider]').boundingBox();
        dit(btn && btn.height >= 43.5, 'A2 « Programmer » fait 44 px au doigt', btn ? String(Math.round(btn.height)) : '');
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `rp-programmer-${tag}.png`), fullPage: false });
        await pg.locator('[data-rp-valider]').click(); await passerVerif(pg);
        await attendre(async () => !!ligneProg(rows), 8000);
        const p = ligneProg(rows);
        dit(p && p.etat === 'attente' && p.at === new Date(val).getTime(), 'A3 la programmation est écrite à SON heure exacte, en attente', p ? `${p.etat} ${new Date(p.at).toISOString()}` : 'rien');
        dit(p && ordreVu.length === 2 && p.ids.join(',') === ordreVu.join(',') && p.reglages && p.reglages.esp && p.reglages.esp.mode === 'fixe', 'A4 SES paires dans l’ordre de l’atelier, et SES réglages figés (espacement fixe)', p ? `${p.ids.join(',')} (écran ${ordreVu.join(',')})` : '');
        dit((await pg.evaluate(() => window.__repub.length)) === 0, 'A5 RIEN n’est envoyé à Vinted en programmant');
        await pg.locator('[data-rp-carte][data-rp-etat="attente"]').waitFor({ timeout: 6000 }).catch(() => {});
        dit(await pg.locator('[data-rp-carte][data-rp-etat="attente"] [data-rp-modifier]').count() === 1 && await pg.locator('[data-rp-carte][data-rp-etat="attente"] [data-rp-annuler]').count() === 1, 'A6 Annonces : la carte « Republication programmée » avec Modifier et Annuler');
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `rp-carte-${tag}.png`) });
        await pg.locator('[data-rp-annuler]').click();
        await pg.locator('.vrm-confirmation button').last().click().catch(() => {});
        await attendre(async () => (ligneProg(rows) || {}).etat === 'annulee', 6000);
        dit((ligneProg(rows) || {}).etat === 'annulee', 'A7 « Annuler » (confirmé) : rien ne partira', (ligneProg(rows) || {}).etat);
        dit(!errs.length, 'A8 aucune erreur de page', errs.slice(0, 2).join(' | '));
        await ctx.close();
      }
      // ── C départ
      if (SCENES.includes('C')) { const { ctx, pg, rows } = await page(b, vp, theme, { prog: prog() }); let verifVue = false;
        await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        const parti = await attendre(async () => (ligneProg(rows) || {}).etat === 'partie', 20000);
        dit(parti && (ligneProg(rows) || {}).appareil, 'C1 c’est l’heure, tout est là : le départ est PRIS par cet appareil', (ligneProg(rows) || {}).etat);
        const env = await attendre(async () => { if (await pg.locator('[data-verif-publier]').count()) { verifVue = true; await pg.locator('[data-verif-publier]').click().catch(() => {}); } return (await pg.evaluate(() => window.__repub.length)) >= 2; }, 30000);
        if (verifVue) console.log('    · la vérification d’avant départ a demandé sa réponse (banc : « Publier quand même »)');
        const ids = await pg.evaluate(() => window.__repub.map((x) => x.id).join(','));
        dit(env && ids === '9104,9102', 'C2 l’atelier part avec SES paires seulement, dans SON ordre', ids);
        dit(await pg.locator('[data-suivi-travail]').count() > 0, 'C3 la feuille « VRM travaille » s’ouvre (VRM figé)');
        if (process.env.DEBUG_RP) console.log(await pg.evaluate(() => { const e = document.elementFromPoint(195, 400); const ch = []; let x = e; while (x && ch.length < 8) { ch.push((x.tagName || '') + '#' + (x.id || '') + '.' + String(x.className || '').slice(0, 40) + '[z' + getComputedStyle(x).zIndex + ']'); x = x.parentElement; } return { url: location.href, chaine: ch }; }));
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `rp-depart-${tag}.png`) });
        await ctx.close();
      }
      // ── D pas d'onglet
      if (SCENES.includes('D')) { const { ctx, pg, rows } = await page(b, vp, theme, { prog: prog(), repub: { onglet: false, frein: null } });
        await pg.goto(`http://localhost:${PORT}/?tab=cat_annonces`, { waitUntil: 'domcontentloaded' });
        await attendre(async () => (ligneProg(rows) || {}).etat === 'pas-partie', 20000);
        const p = ligneProg(rows) || {};
        dit(p.etat === 'pas-partie' && (p.raisons || []).some((r) => r.cle === 'onglet'), 'D1 aucun onglet vinted.fr : « pas partie », raison « onglet »', `${p.etat} ${JSON.stringify(p.raisons)}`);
        await pg.waitForTimeout(1500);
        dit((await pg.evaluate(() => window.__repub.length)) === 0, 'D2 RIEN n’est envoyé à Vinted');
        await pg.locator('[data-rp-carte][data-rp-etat="pas-partie"]').waitFor({ timeout: 8000 }).catch(() => {});
        dit(await pg.locator('[data-rp-carte][data-rp-etat="pas-partie"] [data-rp-raison="onglet"]').count() === 1, 'D3 la carte ambre dit pourquoi et le geste');
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `rp-pas-partie-${tag}.png`) });
        await ctx.close();
      }
      // ── E heure passée
      if (SCENES.includes('E')) { const { ctx, pg, rows } = await page(b, vp, theme, { prog: prog({ at: Date.now() - 20 * 60000 }) });
        await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        await attendre(async () => (ligneProg(rows) || {}).etat === 'pas-partie', 20000);
        const p = ligneProg(rows) || {};
        dit(p.etat === 'pas-partie' && (p.raisons || []).some((r) => r.cle === 'ferme'), 'E1 heure passée de 20 min : jamais un départ en retard (« pas partie », fermé)', p.etat);
        dit((await pg.evaluate(() => window.__repub.length)) === 0, 'E2 RIEN n’est envoyé à Vinted');
        await ctx.close();
      }
    }
  } catch (e) { ko++; console.log('KO  le banc a planté : ' + (e && e.stack || e)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n${ko} KO` : '\nTout est OK');
  process.exit(ko ? 1 : 0);
})();
