// Banc : LE CONTRÔLE AVANT DE LANCER UNE REPUBLICATION (20 nov., extension 5.410 — `repubverif`).
// Données INVENTÉES. Le vrai build (dist) ; un faux pont d'extension 5.410 qui répond à `verifierRepub`.
//   V1. À l'étape « Envoi », la vérification part seule : « 2 vérifiées · 1 corrigée seule · 1 à corriger avant de lancer ».
//   V2. Sous chaque ligne : la correction dite (la taille), ce qui manque + « Choisir la taille » / « Retirer de la file ».
//   V3. Lancer est FERMÉ tant qu'il reste une annonce à corriger (data-repub-lancer-verif="a-corriger").
//   V4. « Choisir la taille » : SA réponse revérifiée pour CETTE paire seule ; Lancer s'ouvre.
//   V5. Au départ, la commande de CETTE paire porte SA réponse ; les autres n'en portent aucune.
// 390 tactile et 1512 ; THEMES=clair,sombre ; SHOTS=dossier pour garder les captures.
// §6.1 : sur un build sans le lot, `[data-repub-verif]` n'existe pas ⇒ rouge.
require('../_source-app.cjs').brancher();
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const EXT = process.env.BANC_EXT || path.join(__dirname, '..', '..', 'vinted-sync-extension');
const PORT = Number(process.env.BANC_PORT || process.env.PORT) || 4437;
const SHOTS = process.env.SHOTS || '';
const THEMES = (process.env.THEMES || 'clair').split(',');
const LARGEURS = (process.env.LARGEURS || '390,1512').split(',').map(Number);
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
const VERSION = '5.410.0';   // la version qui sait `repubverif`
const PONT = (o) => {
  const post = (m) => window.postMessage(m, '*');
  window.__repub = []; window.__verif = [];
  const Q = { champ: 'size', nom: 'la taille', options: [['56', '42'], ['57', '43']], geste: '' };
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version: o.version });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version: o.version, code: o.version, ext: 'banc-ext', vrm: { ok: true, connecte: true, email: '' }, vinted: { uid: '111', login: 'compte_test' }, cmds: {}, repub: { onglet: true, frein: null } } });
    if (d.__vmr === 'cmd' && d.cmd === 'verifierRepub') {
      window.__verif.push({ ids: d.ids, reponses: d.reponses || {} });
      const paires = (d.ids || []).map((id) => {
        const rep = (d.reponses || {})[id];
        if (id === '9102') return { id, etat: 'corrige', corrections: [{ champ: 'size', nom: 'la taille', raison: "sa taille n'est plus dans la grille de Vinted pour cette catégorie : la même taille (même libellé) de la grille d'aujourd'hui est posée" }], manque: [] };
        if (id === '9103') return rep && rep.size ? { id, etat: 'ok', corrections: [], manque: [] } : { id, etat: 'a-corriger', corrections: [], manque: ['la taille (pas de « 44 » dans la grille de Vinted)'], question: Q };
        return { id, etat: 'ok', corrections: [], manque: [] };
      });
      setTimeout(() => post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: true, etape: 'fait', paires, at: Date.now() } }), 500);
      return;
    }
    if (d.__vmr === 'cmd' && d.cmd === 'recreerVinted') {
      window.__repub.push({ id: d.id, reponses: d.reponses || null });
      setTimeout(() => post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: true, etape: 'attente', draftId: '8' + d.id, jusqua: Date.now() + 120000, nouveau: 49 } }), 300);
      return;
    }
    if (d.__vmr === 'cmd') post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: true, etape: 'recent' } });
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

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const theme of THEMES) for (const w of LARGEURS) {
      const vp = { width: w, height: w < 600 ? 844 : 900 };
      const tag = `${w}-${theme}`;
      console.log(`── ${tag}`);
      const { ctx, pg, errs } = await pageApp(b, vp, theme);
      // (VRM natif, 19 nov.) Annonces → « Actions » → Republier → cocher → lancer (téléphone) ; au tableau de l'ordinateur :
      // « Choisir une action » → Republier → cocher → lancer. Les deux mènent à l'atelier par `demanderActionAnnonces`.
      await pg.goto(`http://localhost:${PORT}/?tab=cat_annonces`, { waitUntil: 'domcontentloaded' });
      if (w < 900) {
        await pg.locator('[data-eg-actions]').first().waitFor({ state: 'visible', timeout: 20000 });
        await pg.locator('[data-eg-actions]').first().click();
        await pg.locator('[data-eg-action="recreer"]').first().click();
        for (const id of ['9102', '9103', '9104']) { const l = pg.locator(`[data-eg-article$="${id}"]`).first(); await l.click(); await pg.waitForTimeout(80); }
        await pg.locator('[data-eg-lancer="recreer"]').first().click();
      } else {
        await pg.locator('[data-tt-ouvre="action"]').first().waitFor({ state: 'visible', timeout: 20000 });
        await pg.locator('[data-tt-ouvre="action"]').first().click(); await pg.waitForTimeout(150);
        await pg.locator('[data-tt-action="recreer"]').first().click(); await pg.waitForTimeout(150);
        const boites = pg.locator('[data-tt-tableau] tbody input[type="checkbox"]:not([disabled])');
        const nb = await boites.count(); for (let i = 0; i < nb; i++) { await boites.nth(i).click(); await pg.waitForTimeout(60); }
        await pg.locator('[data-tt-lancer]').first().click();
      }
      await pg.locator('[data-republier]').waitFor({ state: 'visible', timeout: 6000 });
      for (let i = 0; i < 3; i++) { const s = pg.locator('[data-republier-suivant]'); if (await s.count() && await s.isVisible()) { await s.click(); await pg.waitForTimeout(250); } }
      const v = pg.locator('[data-repub-verif]');
      await v.waitFor({ timeout: 8000 }).catch(() => {});
      await attendre(async () => (await v.getAttribute('data-repub-verif').catch(() => '')) !== 'encours', 8000);
      const rv = await v.evaluate((e) => ({ e: e.getAttribute('data-repub-verif'), ok: e.getAttribute('data-repub-verif-ok'), c: e.getAttribute('data-repub-verif-corrige'), a: e.getAttribute('data-repub-verif-a-corriger'), t: e.textContent })).catch(() => null);
      dit(rv && rv.e === 'bloque' && rv.ok === '1' && rv.c === '1' && rv.a === '1' && /3 vérifiées/.test(rv.t) && /1 corrigée seule/.test(rv.t) && /1 à corriger avant de lancer/.test(rv.t), `V1 ${tag} le récapitulatif : « 3 vérifiées · 1 corrigée seule · 1 à corriger avant de lancer »`, rv && rv.t);
      const nv = await pg.evaluate(() => window.__verif.length);
      dit(nv === 1, `V1b ${tag} UNE vérification, partie seule à l'étape « Envoi »`, String(nv));
      const lignes = await pg.$$eval('[data-repub-verif-ligne]', (els) => els.map((e) => e.getAttribute('data-repub-verif-ligne') + ':' + e.getAttribute('data-repub-verif-etat')));
      dit(lignes.join(',') === '9102:corrige,9103:a-corriger', `V2 ${tag} sous chaque ligne : la correction (9102) et ce qui manque (9103) ; rien sous la ligne « ok »`, lignes.join(','));
      const hb = await pg.$$eval('[data-repub-verif-ligne] button', (els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
      dit(hb.length === 2 && hb.every((h) => h >= (w < 600 ? 44 : 32)), `V2b ${tag} « Choisir la taille » et « Retirer de la file » à la bonne taille`, hb.join(','));
      await pg.locator('[data-republier-confirme]').check();
      const lan = pg.locator('[data-republier-lancer]').last();
      const l1 = { verif: await lan.getAttribute('data-repub-lancer-verif'), dis: await lan.isDisabled() };
      dit(l1.verif === 'a-corriger' && l1.dis, `V3 ${tag} Lancer reste FERMÉ tant qu'une annonce est à corriger (même « Je confirme » coché)`, JSON.stringify(l1));
      const deborde = await pg.evaluate(() => { const r = document.querySelector('[data-repub-verif]').getBoundingClientRect(); return r.right > innerWidth + 1 || document.documentElement.scrollWidth > innerWidth + 1; });
      dit(!deborde, `V3b ${tag} rien ne déborde de l'écran`);
      await v.scrollIntoViewIfNeeded().catch(() => {});
      await shot(pg, `rv1-recap-${tag}.png`);
      await pg.evaluate(() => { const e = document.querySelector('[data-repub-verif-ligne="9103"]'); if (e) e.scrollIntoView({ block: 'center' }); });
      await shot(pg, `rv2-lignes-${tag}.png`);
      // (20 nov.) La liste des lignes de l'atelier avait une hauteur NULLE au téléphone (flex qui rétrécit, overflow caché) : visible ?
      const hl = await pg.evaluate(() => { const l = document.querySelector('[data-republier-liste]'); return l ? Math.round(l.getBoundingClientRect().height) : -1; });
      dit(hl > 100, `V2c ${tag} la liste des annonces de l'atelier est visible (hauteur ${hl} px, plus jamais écrasée à 0)`, String(hl));
      await pg.evaluate(() => { const e = document.querySelector('[data-repub-verif-choisir="size"]'); if (e) e.scrollIntoView({ block: 'center' }); });
      await pg.locator('[data-repub-verif-choisir="size"]').click();
      const opt = pg.locator('[data-ask-choix] button').first();
      if (await opt.waitFor({ timeout: 4000 }).then(() => true).catch(() => false)) { await shot(pg, `rv3-choisir-${tag}.png`); await opt.click(); }
      await attendre(async () => (await pg.evaluate(() => window.__verif.length)) >= 2, 6000);
      await attendre(async () => (await v.getAttribute('data-repub-verif').catch(() => '')) === 'pret', 6000);
      const env = await pg.evaluate(() => window.__verif[1] && { ids: window.__verif[1].ids, r: window.__verif[1].reponses });
      dit(env && env.ids.join(',') === '9103' && JSON.stringify(env.r) === '{"9103":{"size":"56"}}', `V4 ${tag} SA réponse revérifiée pour 9103 seule`, JSON.stringify(env));
      const l2 = { verif: await lan.getAttribute('data-repub-lancer-verif'), dis: await lan.isDisabled() };
      dit(l2.verif === 'ok' && !l2.dis, `V4b ${tag} plus rien à corriger : Lancer s'ouvre`, JSON.stringify(l2));
      await shot(pg, `rv4-pret-${tag}.png`);
      await pg.locator('[data-republier-esp-choix="vintex"]').click().catch(() => {});
      await lan.click();
      try { const f = await pg.waitForSelector('[data-verif-sheet]', { timeout: 1500 }); if (f) await pg.click('[data-verif-publier]'); } catch (_) {}
      await attendre(async () => (await pg.evaluate(() => window.__repub.length)) >= 2, 45000);
      const rp = await pg.evaluate(() => window.__repub.map((x) => x.id + ':' + JSON.stringify(x.reponses)));
      const de9103 = rp.find((x) => x.startsWith('9103:')), autres = rp.filter((x) => !x.startsWith('9103:'));
      dit((!de9103 || de9103 === '9103:{"size":"56"}') && autres.every((x) => /:null$/.test(x)) && rp.length >= 2, `V5 ${tag} au départ, SA réponse part avec 9103 seule ; les autres sans réponse`, rp.join(' | '));
      dit(!errs.length, `V6 ${tag} aucune erreur de page`, errs.slice(0, 2).join(' | '));
      await ctx.close();
    }
  } catch (e) { ko++; console.log('KO  exception : ' + (e && e.stack || e)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ banc repub-verifier : ${ko} KO` : '\n✅ banc repub-verifier : tout est OK');
  process.exit(ko ? 1 : 0);
})();
