// Banc : REPUBLIER ÉTAPE PAR ÉTAPE (17 nov., extension 5.408 — `repubetapes`, `repubreprise`).
// Données INVENTÉES. Le vrai build (dist) et les vrais fichiers de l'extension (vrm-ui.js, vrm-action.js).
//   A. L'atelier AVANT : « 3 paires · environ … · fin vers HH:MM » (data-repub-plan).
//   B. PENDANT : sur vinted.fr, l'écran plein dit la chaîne de LA paire (Coffre ✓ › Brouillon ✓ ›
//      Supprimée ✓ › En ligne dans 2 min) ; « Tout arrêter » / « Réduire » à 44 px.
//   C. APRÈS : le bilan « 1 en ligne · 2 à finir » et UN geste par problème (Choisir · Réessayer) ;
//      la chaîne sous chaque ligne ; « Choisir » repart avec SA réponse pour CETTE paire seulement.
// 390 tactile, 1280 et 1512 ; THEMES=clair,sombre ; SHOTS=dossier pour garder les captures.
// §6.1 : sur un build sans le lot, `[data-repub-plan]` n'existe pas ⇒ rouge.
require('../_source-app.cjs').brancher();
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const EXT = process.env.BANC_EXT || path.join(__dirname, '..', '..', 'vinted-sync-extension');
const PORT = Number(process.env.BANC_PORT || process.env.PORT) || 4419;
const SHOTS = process.env.SHOTS || '';
const THEMES = (process.env.THEMES || 'clair').split(',');
const LARGEURS = (process.env.LARGEURS || '390,1280,1512').split(',').map(Number);
const auj = new Date();
const ann = (id, o) => Object.assign({ id, price: { amount: '49.0', currency_code: 'EUR' }, is_closed: false, is_draft: false, photo: null, brand_title: 'Nike', size_title: '42', status: 'Très bon état', view_count: 10, favourite_count: 1 }, o);
const ITEMS = [
  ann(9102, { title: 'Baskets test cuir blanc taille 42', favourite_count: 2, created_at_ts: Math.floor(auj / 1000) - 40 * 86400 }),
  ann(9103, { title: 'Running test bleu taille 43', created_at_ts: Math.floor(auj / 1000) - 50 * 86400 }),
  ann(9104, { title: 'Montantes test noires taille 41', created_at_ts: Math.floor(auj / 1000) - 60 * 86400 }),
];
const MAIN = { vinted_annonce_numeros: { '9102': { numero: '42' }, '9103': { numero: '43' }, '9104': { numero: '44' } } };
const HEX = '0123456789abcdef';
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];
const VERSION = (/EXT_ATTENDUE = '([\d.]+)'/.exec(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'App.jsx'), 'utf8')) || [])[1] || '5.408.0';
// Le faux pont : chaque paire dit ses étapes comme l'extension 5.408, puis son résultat.
const PONT = (o) => {
  const post = (m) => window.postMessage(m, '*');
  const evt = (id, etape, x) => post({ __vmr: 'evt', evt: Object.assign({ type: 'maj', quoi: 'repub', id, etape }, x || {}) });
  window.__repub = [];
  window.__finir = (id) => evt(id, 'fin', { fin: { accepte: true, etape: 'fait', nouvelId: '8' + id, draftId: '8' + id, nouveau: 49 } });
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version: o.version });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version: o.version, code: o.version, ext: 'banc-ext', vrm: { ok: true, connecte: true, email: '' }, vinted: { uid: '111', login: 'compte_test' }, cmds: {}, repub: { onglet: true, frein: null } } });
    if (d.__vmr === 'cmd' && d.cmd === 'recreerVinted') {
      window.__repub.push({ cmd: d.cmd, id: d.id, reponses: d.reponses || null, total: d.total });
      const id = String(d.id), fin = (resp, ms) => setTimeout(() => post({ __vmr: 'cmd:result', reqId: d.reqId, resp }), ms);
      if (id === '9104' && !d.reponses) { fin({ accepte: false, code: 'onglet-vinted', raison: 'aucun onglet vinted.fr ouvert sur ce compte — rien n’a été envoyé' }, 200); return; }
      ['lecture', 'enregistrement', 'brouillon', 'suppression'].forEach((k, i) => setTimeout(() => evt(id, k), 60 * (i + 1)));
      if (id === '9103' && !d.reponses) { setTimeout(() => evt(id, 'attente'), 300); fin({ accepte: true, etape: 'brouillon-a-refaire', refaire: true, draftId: '89103', question: { champ: 'size', nom: 'la taille', options: [['56', '42'], ['57', '43']] }, raison: 'l’ancienne annonce est supprimée et le brouillon est rangé, mais il manque la taille' }, 450); return; }
      setTimeout(() => evt(id, 'attente', { jusqua: Date.now() + 120000 }), 300);
      fin({ accepte: true, etape: 'attente', draftId: '8' + id, jusqua: Date.now() + 120000, nouveau: 49 }, 450);
    } else if (d.__vmr === 'cmd') post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: true, etape: 'recent' } });
  });
  post({ __vmr: 'ready', version: o.version });
};
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
const attendre = async (f, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await f()) return true; await new Promise((r) => setTimeout(r, 200)); } return false; };
async function pageApp(b, vp, theme) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}), colorScheme: theme === 'sombre' ? 'dark' : 'light' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const rows = [{ id: 'main', data: MAIN }, { id: 'harvest_111_listings', data: { capturedAt: auj.toISOString(), payload: { items: ITEMS, pagination: { total_entries: ITEMS.length } } } }, { id: `actions_compte_111_${HEX}`, data: { ts: [], max: 50, reserve: 5 } }];
  await pg.addInitScript((sombre) => { try { localStorage.setItem('vrm_acces_direct', '1'); if (sombre) localStorage.setItem('vinted_dark', 'true'); localStorage.setItem('vrm_republier_esp', JSON.stringify({ mode: 'fixe', min: 1, max: 3, groupes: false })); } catch (_) {} }, theme === 'sombre');
  await pg.addInitScript(PONT, { version: VERSION });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', async (route) => {
    const req = route.request(); const m = req.method();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d, st = 200) => route.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    if (m !== 'GET' && m !== 'HEAD') return j([]);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data|^data$|^data,/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: auj.toISOString(), cap: r.data.capturedAt });
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const lk = /[?&]id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs };
}
const shot = async (pg, nom) => { if (SHOTS) { await pg.waitForTimeout(350); await pg.screenshot({ path: path.join(SHOTS, nom) }).catch(() => {}); } };

// ── L'écran plein sur vinted.fr (les vrais vrm-ui.js et vrm-action.js) ──
const PAGE_VINTED = (nuit) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font:15px/1.4 system-ui,sans-serif;background:${nuit ? '#121416' : '#fff'};color:${nuit ? '#e8e8e8' : '#171717'}}header{height:64px;display:flex;align-items:center;padding:0 24px;border-bottom:1px solid #8883}header b{font-size:26px;color:#007782;font-style:italic}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:16px;padding:24px}main i{display:block;aspect-ratio:3/4;border-radius:6px;background:linear-gradient(160deg,#d9d4cc,#b7aea2)}</style></head><body><header><b>Vinted</b></header><main>${Array.from({ length: 12 }, () => '<i></i>').join('')}</main></body></html>`;
const IMG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#c9b8a0"/><rect x="14" y="30" width="52" height="22" rx="8" fill="#5a4a3a"/></svg>');
async function ecranPlein(b, vp, theme, tag) {
  const ctx = await b.newContext({ viewport: vp, colorScheme: theme === 'sombre' ? 'dark' : 'light', ...(vp.width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(String(e)));
  await pg.route('**/*', (r) => (/vinted\.net|\.svg|\.png/.test(r.request().url()) ? r.fulfill({ status: 200, contentType: 'image/svg+xml', body: IMG }) : r.fulfill({ status: 200, contentType: 'text/html', body: PAGE_VINTED(theme === 'sombre') })));
  await pg.addInitScript(() => { const o = Element.prototype.attachShadow; Element.prototype.attachShadow = function (x) { return o.call(this, Object.assign({}, x, { mode: 'open' })); }; });
  await pg.goto('https://www.vinted.fr/catalog');
  const du = Date.now() + 2 * 60000 + 5000;
  const act = { v: 1, actif: true, sorte: 'republier', uid: '111', debut: Date.now() - 60000, fait: 1, total: 3, enCours: false, prochain: null, quoi: '', item: { id: '9102', num: '42', photo: 'https://images1.vinted.net/t/banc/1.webp', titre: 'Baskets test cuir blanc taille 42' }, repub: { id: '9102', fait: 3, du, photos: null }, maj: Date.now() };
  await pg.evaluate((a) => {
    const ecoutes = []; window.__etat = a;
    window.chrome = { runtime: { id: 'ext', lastError: null, getURL: (p) => location.origin + '/' + p, sendMessage: (msg, cb) => { const rep = msg.action === 'etat' && msg.from === 'vrm-action' ? { ok: true, action: window.__etat } : msg.action === 'numeros' ? { ok: true, items: { 9102: '42' } } : { ok: true }; setTimeout(() => cb && cb(rep), 0); } },
      i18n: { getUILanguage: () => 'fr', getMessage: () => '' }, storage: { local: { get: (k, cb) => { const v = { vrmActionEnCours: window.__etat }; if (cb) setTimeout(() => cb(v), 0); return Promise.resolve(v); }, set: (o, cb) => { if (cb) setTimeout(cb, 0); return Promise.resolve(); } }, onChanged: { addListener: (f) => ecoutes.push(f) } } };
    window.__poser = (x) => { window.__etat = x; for (const f of ecoutes) f({ vrmActionEnCours: { newValue: x } }, 'local'); };
  }, act);
  for (const f of ['vrm-ui.js', 'vrm-mots.js', 'vrm-action.js']) { const js = fs.readFileSync(path.join(EXT, f), 'utf8'); await pg.evaluate((s) => { const e = document.createElement('script'); e.textContent = s; document.documentElement.appendChild(e); }, js); }
  await pg.waitForTimeout(500);
  const r = await pg.evaluate(() => { const h = document.getElementById('vrm-action'); const o = h && h.shadowRoot; if (!o) return null; const c = o.querySelector('[data-action-chaine]'); const li = c ? [...c.querySelectorAll('li')] : []; const btn = [...o.querySelectorAll('button')].map((b) => Math.round(b.getBoundingClientRect().height));
    const cr = c && c.getBoundingClientRect(); return { n: c && c.getAttribute('data-action-chaine'), etats: li.map((x) => x.getAttribute('data-etat')).join(','), textes: li.map((x) => x.textContent).join(' › '), btn, deborde: cr ? cr.right > innerWidth + 1 || cr.left < -1 : true }; });
  dit(r && r.n === '3' && r.etats === 'faite,faite,faite,encours' && /En ligne dans [12] min/.test(r.textes), `B1 ${tag} écran plein : Coffre ✓ › Brouillon ✓ › Supprimée ✓ › En ligne dans 2 min`, r && r.textes);
  dit(r && r.btn.length >= 2 && r.btn.every((h) => h >= 44) && !r.deborde, `B2 ${tag} « Tout arrêter » / « Réduire » à 44 px, la chaîne ne déborde pas`, r && JSON.stringify(r.btn));
  await shot(pg, `rp5-ecran-plein-${tag}.png`);
  // La paire suivante : photos en cours (coffre en cours, photo 2 sur 3).
  await pg.evaluate((a) => window.__poser(Object.assign({}, a, { fait: 1, enCours: true, item: { id: '9103', num: '43', titre: 'Running test bleu taille 43' }, repub: { id: '9103', fait: 0, du: null, photos: { fait: 1, total: 3 } }, maj: Date.now() })), act);
  await pg.waitForTimeout(400);
  const r2 = await pg.evaluate(() => { const o = document.getElementById('vrm-action').shadowRoot; const c = o.querySelector('[data-action-chaine]'); return c ? [...c.querySelectorAll('li')].map((x) => x.getAttribute('data-etat') + ':' + x.textContent).join(' | ') : null; });
  dit(r2 && /^encours:Coffre · photo 2 sur 3/.test(r2), `B3 ${tag} la paire suivante : « Coffre · photo 2 sur 3 » en cours`, r2);
  await shot(pg, `rp5-ecran-photos-${tag}.png`);
  dit(!errs.length, `B4 ${tag} aucune erreur de page`, errs.slice(0, 2).join(' | '));
  await ctx.close();
}

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const theme of THEMES) for (const w of LARGEURS) {
      const vp = { width: w, height: w < 600 ? 844 : 900 };
      const tag = `${w}-${theme}`;
      console.log(`── ${tag}`);
      { const { ctx, pg, errs } = await pageApp(b, vp, theme);
        await pg.goto(`http://localhost:${PORT}/?tab=cat_annonces`, { waitUntil: 'domcontentloaded' });
        await pg.locator('[data-actions-ouvrir]').first().waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
        await pg.locator('[data-actions-ouvrir]').first().click();
        await pg.waitForSelector('[data-selection-vue]', { timeout: 8000 });
        for (const id of ['9102', '9103', '9104']) await pg.locator(`[data-selection-compte="111"] [data-selection-annonce="${id}"] input`).first().check();
        const parVrm = pg.locator('.vrm-sel-barre [data-republier-lancer]');
        if (await parVrm.count()) await parVrm.first().click(); else { await pg.locator('[data-actions-possibles]').click(); await pg.locator('[data-action-sel="recreer"]').click(); }
        await pg.locator('[data-republier]').waitFor({ state: 'visible', timeout: 6000 });
        for (let i = 0; i < 3; i++) { const s = pg.locator('[data-republier-suivant]'); if (await s.count() && await s.isVisible()) { await s.click(); await pg.waitForTimeout(250); } }
        await pg.locator('[data-republier-esp-choix="fixe"]').click().catch(() => {});
        await pg.locator('[data-republier-esp-fixe]').fill('0').catch(() => {});
        const plan = pg.locator('[data-repub-plan]');
        await plan.waitFor({ timeout: 5000 }).catch(() => {});
        const pl = await plan.first().evaluate((e) => ({ n: e.getAttribute('data-repub-plan-n'), sec: Number(e.getAttribute('data-repub-plan')), t: e.textContent })).catch(() => null);
        dit(pl && pl.n === '3' && pl.sec >= 3 * 45 && /3 paires · environ \d+ min · fin vers \d\d:\d\d/.test(pl.t), `A1 ${tag} le plan avant de lancer : « 3 paires · environ … min · fin vers HH:MM »`, pl && pl.t);
        await plan.first().scrollIntoViewIfNeeded().catch(() => {});
        await shot(pg, `rp1-atelier-plan-${tag}.png`);
        await pg.locator('[data-republier-confirme]').check();
        await pg.locator('[data-republier-lancer]').last().click();
        try { const f = await pg.waitForSelector('[data-verif-sheet]', { timeout: 1500 }); if (f) { await pg.click('[data-verif-publier]'); } } catch (_) {}
        await attendre(async () => (await pg.evaluate(() => window.__repub.length)) >= 3, 12000);
        await pg.waitForTimeout(800);
        await shot(pg, `rp2-pendant-suivi-${tag}.png`);
        const tot = await pg.evaluate(() => window.__repub.map((x) => x.total));
        dit(tot.length === 3 && tot.every((t) => t === 3), `A2 ${tag} chaque commande dit la taille de la série (l'écran plein compte « 1 sur 3 »)`, JSON.stringify(tot));
        await pg.evaluate(() => window.__finir('9102'));
        // La feuille « VRM travaille » se ferme comme lui : « Fermer ».
        await attendre(async () => (await pg.locator('[data-suivi-fermer]').count()) > 0, 8000);
        await pg.locator('[data-suivi-fermer]').first().click().catch(() => {});
        await pg.waitForTimeout(300);
        const bil = pg.locator('[data-repub-bilan]');
        await bil.waitFor({ timeout: 8000 }).catch(() => {});
        const bl = await bil.evaluate((e) => ({ l: e.getAttribute('data-repub-en-ligne'), f: e.getAttribute('data-repub-a-finir'), t: e.querySelector('.vrm-repub-bilan-tete').textContent, gestes: [...e.querySelectorAll('[data-repub-bilan-ligne]')].map((x) => x.getAttribute('data-repub-bilan-ligne') + ':' + x.getAttribute('data-repub-geste')) })).catch(() => null);
        dit(bl && bl.l === '1' && bl.f === '2' && /1 en ligne/.test(bl.t) && /2 à finir/.test(bl.t), `C1 ${tag} le bilan : « 1 en ligne · 2 à finir »`, bl && bl.t);
        dit(bl && bl.gestes.join(',') === '9103:choisir,9104:reessayer', `C2 ${tag} UN geste par problème : la taille ⇒ Choisir, pas partie ⇒ Réessayer`, bl && bl.gestes.join(','));
        const ch = await pg.$$eval('[data-repub-chaine]', (els) => els.map((e) => e.getAttribute('data-repub-chaine') + '/' + (e.getAttribute('data-repub-probleme') || ''))).catch(() => []);
        dit(ch.join(',') === '4/,3/enligne,0/', `C3 ${tag} la chaîne sous chaque ligne : 4 étapes · brouillon prêt arrêté avant « en ligne » · rien coché pour la pas partie`, ch.join(','));
        const hb = await pg.$$eval('[data-repub-bilan] button, [data-repub-bilan] a', (els) => els.filter((e) => e.offsetParent).map((e) => Math.round(e.getBoundingClientRect().height)));
        dit(hb.length >= 2 && hb.every((h) => h >= (w < 600 ? 44 : 32)), `C4 ${tag} les gestes du bilan à la bonne taille (44 px au doigt)`, hb.join(','));
        await bil.scrollIntoViewIfNeeded().catch(() => {});
        await shot(pg, `rp3-bilan-${tag}.png`);
        // « Choisir la taille » : SA réponse repart pour CETTE paire seulement.
        await pg.locator('[data-repub-bilan-geste="choisir"]').first().click();
        const opt = pg.locator('[data-ask-choix] button').first();
        if (await opt.waitFor({ timeout: 4000 }).then(() => true).catch(() => false)) { await shot(pg, `rp4-choisir-${tag}.png`); await opt.click(); }
        await attendre(async () => (await pg.evaluate(() => window.__repub.filter((x) => x.reponses).length)) >= 1, 6000);
        const env = await pg.evaluate(() => window.__repub.filter((x) => x.reponses).map((x) => x.id + ':' + JSON.stringify(x.reponses)));
        dit(env.length === 1 && /^9103:\{"size":"56"\}$/.test(env[0]), `C5 ${tag} « Choisir » : la commande repart pour 9103 seule, avec SA réponse`, env.join(','));
        dit(!errs.length, `C6 ${tag} aucune erreur de page`, errs.slice(0, 2).join(' | '));
        await ctx.close();
      }
      await ecranPlein(b, vp, theme, tag);
    }
  } catch (e) { ko++; console.log('KO  exception : ' + (e && e.stack || e)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ banc republication-parfaite : ${ko} KO` : '\n✅ banc republication-parfaite : tout est OK');
  process.exit(ko ? 1 : 0);
})();
