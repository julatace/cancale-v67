// Banc : BROUILLONS PROPOSABLES et AVANCÉE DE « REPUBLIER » (2 novembre).
// Deux défauts signalés par Julien le 2 novembre :
//   A. « elle propose de mettre des brouillons en ligne sans dire que ces
//      brouillons ne viennent pas de ce compte, et même quand ces brouillons
//      n'existent plus » ;
//   B. sur ordinateur, pendant « Republier », la feuille dit « En cours :
//      l'avancée est ci-dessous. » et RIEN en dessous.
//
// Données INVENTÉES (il vit dans le dépôt), 390 px tactile et 1512 px, un faux
// pont d'extension (Chrome ouvert sur le compte 111).
//
// A. Quatre brouillons, chacun un cas de la règle (`src/brouillonsProposables.js`) :
//    · 9201 — compte 111, vu dans une lecture de SON dressing vieille de 2 jours ⇒
//      « à vérifier sur Vinted », jamais « Mettre en ligne » ;
//    · 9401 — compte 222 (autre_compte), lecture complète et fraîche ⇒ grisé, son
//      compte NOMMÉ, « ouvre Vinted sur ce compte », jamais cochable ;
//    · 9601 — compte 111, enregistré il y a 1 h (vu par l'extension), après la
//      dernière lecture ⇒ le SEUL proposable ;
//    · 9602 — compte 111, enregistré il y a 3 jours, absent de la lecture COMPLÈTE
//      d'il y a 2 jours ⇒ plus proposé, et c'est dit (« plus sur Vinted »).
//    Dans « Voir mes brouillons » ET dans l'atelier « Brouillons → en ligne ».
// B. L'atelier « Republier » en cours d'exécution : la paire en cours (N°, titre),
//    son étape (« Étape N sur 7 »), une barre, « 0 sur 2 », le temps avant la
//    suivante — dans la fenêtre, sans défiler, MÊME quand l'ancienne annonce a
//    quitté le dressing relu (c'était la cause : la file était recalculée sur la
//    liste vivante et la paire en cours disparaissait). La commande est TENUE
//    (§6.5) : rien ne dépend d'un délai.
// §6.1 : sur un build d'origin/main, A et B sont rouges.
require('../_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT) || 4391;
const CAPT = process.env.CAPTURES || os.tmpdir();
const auj = new Date();
const H = 3600e3;
const iso = (ms) => new Date(ms).toISOString();
const ann = (id, o) => Object.assign({ id, price: { amount: '49.0', currency_code: 'EUR' }, is_closed: false, is_draft: false, is_hidden: false, photo: null, brand_title: 'Nike', size_title: '42', status: 'Très bon état', view_count: 10, favourite_count: 0, created_at_ts: Math.floor(auj / 1000) - 40 * 86400 }, o);
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: auj.toISOString() }, { id: 2, vinted_user_id: '222', login: 'autre_compte', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];
const pg_ = (items) => ({ items, pagination: { total_entries: items.length, total_pages: 1, current_page: 1 } });

// ── A : les brouillons ──────────────────────────────────────────────────────
const lu111 = +auj - 48 * H;   // la dernière lecture de SON dressing : il y a 2 jours (complète)
const ROWS_A = () => [
  { id: 'main', data: { vinted_annonce_numeros: {} } },
  { id: 'harvest_111_listings', data: { capturedAt: iso(lu111), payload: pg_([
    ann(9001, { title: 'Vendue il y a longtemps', is_closed: true, item_closing_action: 'sold' }),
    ann(9201, { title: 'Nike Air Max 1 dark teal', is_draft: true }),
  ]) } },
  { id: 'harvest_222_listings', data: { capturedAt: auj.toISOString(), payload: pg_([
    ann(9301, { title: 'Puma Suede en ligne' }),
    ann(9401, { title: 'Brouillon de l’autre compte', is_draft: true }),
  ]) } },
  { id: 'vinted_brouillon_9201', data: { id: '9201', uid: '111', titre: 'Nike Air Max 1 dark teal', prix: 65, nPhotos: 4, etat: 'brouillon', at: iso(+auj - 72 * H) } },
  { id: 'vinted_brouillon_9401', data: { id: '9401', uid: '222', titre: 'Brouillon de l’autre compte', prix: 70, nPhotos: 3, etat: 'brouillon', at: iso(+auj - 5 * H) } },
  { id: 'vinted_brouillon_9601', data: { id: '9601', uid: '111', titre: 'Jordan 4 militaire', prix: 80, nPhotos: 3, etat: 'brouillon', at: iso(+auj - 1 * H) } },
  { id: 'vinted_brouillon_9602', data: { id: '9602', uid: '111', titre: 'Brouillon supprimé sur Vinted', prix: 50, nPhotos: 2, etat: 'brouillon', at: iso(+auj - 72 * H) } },
];
// ── B : l'atelier en cours ──────────────────────────────────────────────────
const ITEMS_B = [9102, 9103, 9104, 9105, 9106, 9107, 9108, 9109].map((id, k) => ann(id, { title: `Paire numéro ${k + 1} — Salomon XT-6 blanc taille ${38 + k}`, created_at_ts: Math.floor(auj / 1000) - (90 - k) * 86400 }));
const NUMS_B = {}; ITEMS_B.forEach((it, k) => { NUMS_B[String(it.id)] = { numero: String(42 + k) }; });
const ROWS_B = () => [
  { id: 'main', data: { vinted_annonce_numeros: NUMS_B } },
  { id: 'harvest_111_listings', data: { capturedAt: auj.toISOString(), payload: pg_(ITEMS_B.slice()) } },
];
let rows = ROWS_A();

const VERSION = (/EXT_ATTENDUE = '([\d.]+)'/.exec(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'App.jsx'), 'utf8')) || [])[1] || '5.310.0';
const PONT = (o) => {
  const post = (m) => window.postMessage(m, '*');
  window.__cmds = []; window.__tenues = [];
  window.__lacher = () => { for (const t of window.__tenues.splice(0)) post({ __vmr: 'cmd:result', reqId: t, resp: { accepte: true, etape: 'fait', nouvelId: '99102' } }); };
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version: o.version });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version: o.version, code: o.version, ext: 'banc-ext', vrm: { ok: true, connecte: true, email: '' }, vinted: { uid: '111', login: 'compte_test' }, cmds: {} } });
    if (d.__vmr !== 'cmd') return;
    window.__cmds.push({ cmd: d.cmd, id: d.id, draftId: d.draftId, uid: d.uid, confirme: d.confirme });
    // B : la recréation est TENUE (l'extension travaille) jusqu'à `__lacher()`.
    if (d.cmd === 'recreerVinted') { window.__tenues.push(d.reqId); return; }
    if (d.cmd === 'publierBrouillon') return post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: true, etape: 'fait', itemId: d.draftId } });
    post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: true, etape: 'recent' } });
  });
  post({ __vmr: 'ready', version: o.version });
};
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d !== undefined && d !== '' ? ' — ' + String(d).replace(/\s+/g, ' ').slice(0, 260) : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (src.includes('->>') && typeof v === 'object' ? JSON.stringify(v) : (src.includes('->>') ? String(v) : v));
  }
  return out;
};
async function page(b, vp) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  await pg.addInitScript(PONT, { version: VERSION });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data|^data$|^data,/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: auj.toISOString(), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs };
}
// Visible SANS DÉFILER : dans la fenêtre, et c'est bien lui (ou un enfant) qu'on
// touche en son centre (rien ne le recouvre, aucun conteneur ne l'a fait défiler hors vue).
const visible = (pg, sel) => pg.evaluate(([s, h]) => {
  const el = document.querySelector(s); if (!el) return 'absent';
  const r = el.getBoundingClientRect(); if (!r.width || !r.height) return 'sans taille';
  if (r.top < 0 || r.bottom > h) return `hors fenêtre (${Math.round(r.top)}…${Math.round(r.bottom)} pour ${h})`;
  const x = Math.min(window.innerWidth - 1, Math.max(0, r.left + Math.min(r.width / 2, 40))), y = r.top + r.height / 2;
  const t = document.elementFromPoint(x, y);
  return t && (t === el || el.contains(t)) ? 'ok' : `recouvert par ${t ? (t.className || t.tagName) : 'rien'}`;
}, [sel, pg.viewportSize().height]);

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      // ════ A ════
      console.log(`── A · brouillons · ${vp.width} px`);
      rows = ROWS_A();
      { const { ctx, pg, errs } = await page(b, vp);
        try {
          await pg.goto(`http://localhost:${PORT}/?tab=cat_annonces`, { waitUntil: 'domcontentloaded' });
          // (5 nov., chantier C — revue 2.5) La feuille « Republier et brouillons » est retirée :
          //  « Voir mes brouillons » vit dans la vue Brouillons (« Un par un ») — la MÊME feuille.
          const bouton = pg.locator('[data-actions-ouvrir]').first();
          await bouton.waitFor({ state: 'visible', timeout: 15000 });
          const vueBr = async () => { await pg.locator('[data-vue-brouillons]').first().click(); await pg.waitForSelector('[data-selection-vue="brouillon"]', { timeout: 6000 }); };
          await vueBr(); await pg.locator('[data-brouillons-detail]').first().click();
          await pg.locator('[data-brouillons-vinted]').waitFor({ state: 'visible', timeout: 5000 });
          await pg.locator('[data-brouillon="9601"]').waitFor({ timeout: 5000 }).catch(() => {});
          await pg.waitForTimeout(400);
          const ids = await pg.$$eval('[data-brouillon]', (els) => els.map((e) => e.getAttribute('data-brouillon')));
          dit(ids.includes('9201') && ids.includes('9401') && ids.includes('9601'), 'les brouillons des deux comptes sont listés', ids.join(','));
          dit(!ids.includes('9602'), 'un brouillon absent de la lecture COMPLÈTE plus récente de son dressing n’est plus proposé', ids.join(','));
          dit(await pg.locator('[data-brouillons-disparus="1"]').count() === 1, '… et c’est dit (« plus sur Vinted »), pas tu', await pg.locator('[data-brouillons-vinted]').innerText().catch(() => ''));
          const btn = async (id) => pg.locator(`[data-brouillon="${id}"] [data-brouillon-publier]`).count();
          dit(await btn('9601') === 1, 'le brouillon du compte ouvert dans Chrome, enregistré il y a 1 h : « Mettre en ligne »');
          dit(await btn('9401') === 0, 'le brouillon d’un AUTRE compte n’a pas « Mettre en ligne »');
          const t9401 = await pg.locator('[data-brouillon="9401"]').innerText().catch(() => '');
          dit(/autre_compte/.test(t9401) && /ouvre Vinted sur ce compte/i.test(t9401), '… il NOMME son compte et dit le geste (ouvrir Vinted sur ce compte)', t9401);
          const op = await pg.locator('[data-brouillon="9401"]').evaluate((e) => Number(getComputedStyle(e).opacity)).catch(() => 1);
          dit(op < 1, '… et il est grisé', String(op));
          dit(await btn('9201') === 0, 'un brouillon vu dans une lecture de 2 jours n’est pas proposé comme prêt');
          const t9201 = await pg.locator('[data-brouillon="9201"]').innerText().catch(() => '');
          dit(/vérifier sur Vinted/i.test(t9201), '… il est « à vérifier sur Vinted »', t9201);
          const pseudos = await pg.$$eval('[data-brouillon]', (els) => els.map((e) => (e.querySelector('[data-brouillon-pseudo]') || {}).textContent || ''));
          dit(pseudos.length > 0 && pseudos.every((p) => /compte_test|autre_compte/.test(p)), 'chaque brouillon dit DE QUEL COMPTE il est', pseudos.join(','));
          const petits = await pg.$$eval('[data-brouillons-vinted] button, [data-brouillons-vinted] a', (els) => els.filter((e) => e.offsetParent).filter((e) => e.getBoundingClientRect().height < 44).length);
          dit(petits === 0, 'cibles au doigt ≥ 44 px', String(petits));
          await pg.screenshot({ path: path.join(CAPT, `brouillons-voir-${vp.width}.png`) });
          await pg.locator('[data-brouillons-vinted] [aria-label="Fermer"]').click().catch(() => {});
          await pg.waitForTimeout(300);
          // « Mettre en ligne » (chantier C) : depuis la vue Brouillons, on coche, puis la feuille
          //  « Actions ». Les MÊMES règles, jugées là où elles vivent désormais : un autre compte ⇒
          //  rien ne part (raison dite, les comptes nommés) ; un brouillon sans lecture récente ⇒
          //  « à vérifier sur Vinted » dans « Avant de lancer » ; un brouillon disparu n'est pas là.
          await vueBr();
          await pg.locator('[data-selection-annonce="9601"]').waitFor({ timeout: 5000 }).catch(() => {});
          const coche = async (id) => { const l = pg.locator(`[data-selection-annonce="${id}"] input[type=checkbox]`); return (await l.count()) ? (await l.isDisabled() ? 'grisé' : 'cochable') : 'absent'; };
          const c9601 = await coche('9601'), c9602 = await coche('9602');
          dit(c9601 === 'cochable', 'atelier : le brouillon prouvé du compte de Chrome se coche', c9601);
          dit(c9602 === 'absent', 'atelier : le brouillon disparu n’est pas proposé', c9602);
          const ouvrirActions = async () => { await pg.locator('[data-actions-possibles]').click(); await pg.waitForSelector('[data-actions-selection]', { timeout: 4000 }); };
          const fermerActions = async () => { await pg.locator('[data-actions-selection]').locator('xpath=ancestor::*[@role="dialog"][1]').locator('button[aria-label="Fermer"]').first().click().catch(() => pg.keyboard.press('Escape')); await pg.waitForTimeout(300); };
          await pg.locator('[data-selection-annonce="9601"] input').check(); await pg.locator('[data-selection-annonce="9401"] input').check();
          await ouvrirActions();
          const mix = await pg.evaluate(() => ({ ok: (document.querySelector('[data-action-sel="enLigne"]') || {}).getAttribute && document.querySelector('[data-action-sel="enLigne"]').getAttribute('data-action-sel-ok'), tete: (document.querySelector('[data-actions-raison]') || {}).textContent || '' }));
          dit(mix.ok === 'non' && /autre_compte/.test(mix.tete), 'atelier : le brouillon de l’autre compte ne part pas avec lui, son compte nommé', JSON.stringify(mix));
          await fermerActions();
          await pg.locator('[data-selection-annonce="9401"] input').uncheck(); await pg.locator('[data-selection-annonce="9201"] input').check();
          await ouvrirActions();
          const v9201 = await pg.locator('[data-act-paire="9201"]').innerText().catch(() => '');
          dit(/vérifier sur Vinted/i.test(v9201), 'atelier : le brouillon sans lecture récente est « à vérifier sur Vinted » avant de lancer', v9201);
          await fermerActions();
          await pg.locator('[data-selection-annonce="9201"] input').uncheck();
          await ouvrirActions();
          await pg.locator('[data-action-sel="enLigne"]').click();
          await pg.locator('[data-republier]').waitFor({ state: 'visible', timeout: 5000 });
          await pg.locator('[data-republier-confirme]').check();
          await pg.screenshot({ path: path.join(CAPT, `brouillons-atelier-${vp.width}.png`) });
          await pg.locator('[data-republier-lancer]').click();
          await pg.locator('[data-republier-ligne="9601"][data-republier-statut="fait"]').waitFor({ timeout: 6000 }).catch(() => {});
          const cmds = await pg.evaluate(() => window.__cmds.filter((c) => c.cmd === 'publierBrouillon'));
          dit(cmds.length === 1 && cmds[0].draftId === '9601' && cmds[0].uid === '111', '« Tout cocher » puis lancer : SEUL le brouillon proposable part', JSON.stringify(cmds));
          dit(!errs.length, 'aucune erreur d’app', errs.join(' | '));
        } catch (e) { dit(false, 'A : le parcours a levé', e.message.split('\n')[0]); }
        await ctx.close(); }

      // ════ B ════
      console.log(`── B · Republier en cours · ${vp.width} px`);
      rows = ROWS_B();
      { const { ctx, pg, errs } = await page(b, vp);
        try {
          await pg.goto(`http://localhost:${PORT}/?tab=cat_annonces`, { waitUntil: 'domcontentloaded' });
          const bouton = pg.locator('[data-actions-ouvrir]').first();
          await bouton.waitFor({ state: 'visible', timeout: 15000 });
          // (5 nov., chantier C) « Republier… » mène à « Sélectionner » : on coche, dans cet ordre,
          //  9102 (N°42) puis 9103 (N°43), puis « Actions » → « Republier » ; le moteur s'ouvre
          //  après « Choisir » (sur CES paires). La suite du parcours ne change pas.
          await bouton.click();
          await pg.waitForSelector('[data-selection-vue]', { timeout: 6000 });
          await pg.locator('[data-selection-annonce="9102"]').waitFor({ timeout: 5000 });
          await pg.locator('[data-selection-annonce="9102"] input').check();
          await pg.locator('[data-selection-annonce="9103"] input').check();
          await pg.locator('[data-actions-possibles]').click();
          await pg.locator('[data-action-sel="recreer"]').click();
          await pg.locator('[data-republier]').waitFor({ state: 'visible', timeout: 5000 });
          await pg.locator('[data-republier-apercu="9102"]').waitFor({ timeout: 4000 });
          await pg.locator('[data-republier-suivant]').click();
          await pg.locator('[data-republier-lancer]').waitFor({ timeout: 4000 });
          await pg.locator('[data-republier-esp-choix="fixe"]').click();
          await pg.locator('[data-republier-esp-fixe]').fill('90');
          await pg.locator('[data-republier-confirme]').check();
          await pg.locator('[data-republier-lancer]').click();
          // La commande de 9102 est partie, et TENUE (l'extension travaille).
          await pg.waitForFunction(() => (window.__cmds || []).some((c) => c.cmd === 'recreerVinted' && c.id === '9102'), null, { timeout: 6000 });
          // L'extension annonce ses étapes : photos, enregistrement, brouillon, puis RETRAIT de l'ancienne…
          const ev = (o) => pg.evaluate((d) => window.dispatchEvent(new CustomEvent('vrm:ext', { detail: { type: 'maj', quoi: 'repub', id: '9102', ...d } })), o);
          await ev({ etape: 'lecture' }); await ev({ etape: 'photos', fait: 1, total: 3 }); await ev({ etape: 'enregistrement' }); await ev({ etape: 'brouillon' }); await ev({ etape: 'suppression' });
          // … l'ancienne annonce n'est plus sur Vinted : le dressing relu ne la montre plus.
          const items = ITEMS_B.filter((x) => x.id !== 9102);
          rows = rows.map((r) => r.id === 'harvest_111_listings' ? { id: r.id, data: { capturedAt: new Date().toISOString(), payload: pg_(items) } } : r);
          await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:ext', { detail: { type: 'maj', quoi: 'annonces', uid: '111' } })));
          // La relecture est servie : on attend que la liste vivante ait perdu 9102 (la grille d'Annonces).
          await pg.waitForFunction(() => !document.querySelector('[data-annonce-id="9102"], [data-id="9102"]'), null, { timeout: 4000 }).catch(() => {});
          await pg.waitForTimeout(1500);
          await ev({ etape: 'attente' });
          // Défile la liste jusqu'en bas : l'avancée doit rester sous les yeux.
          await pg.evaluate(() => { for (const el of document.querySelectorAll('[data-republier] *')) { const s = getComputedStyle(el); if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight) el.scrollTop = el.scrollHeight; } });
          await pg.waitForTimeout(200);
          const prog = '[data-republier-progression="9102"]';
          dit(await visible(pg, prog) === 'ok', 'la paire EN COURS garde sa barre d’étape, visible sans défiler (même relue absente du dressing)', await visible(pg, prog));
          const tProg = await pg.locator(prog).first().innerText().catch(() => '');
          dit(/Étape \d+ sur 7/.test(tProg), '… son étape en clair (« Étape N sur 7 · … »)', tProg);
          const bloc = '[data-republier-bilan]';
          dit(await visible(pg, bloc) === 'ok', 'le bloc d’avancée est dans la fenêtre', await visible(pg, bloc));
          const tBloc = await pg.locator(bloc).first().innerText().catch(() => '');
          dit(/N°42/.test(tBloc) && /Paire numéro 1/.test(tBloc), '… il nomme la paire en cours (N°42 et son titre)', tBloc);
          dit(/0 sur 2/.test(tBloc), '… il dit combien sont faites sur combien (« 0 sur 2 »)', tBloc);
          dit(/1 min 30 s/.test(tBloc), '… et le temps avant la suivante (1 min 30 s)', tBloc);
          dit(await visible(pg, '[data-republier-bilan] [role="progressbar"]') === 'ok', '… et sa barre se voit', await visible(pg, '[data-republier-bilan] [role="progressbar"]'));
          const lignes = await pg.$$eval('[data-republier-ligne]', (els) => els.map((e) => e.getAttribute('data-republier-ligne')));
          dit(lignes.join(',') === '9102,9103', 'la file garde ses deux paires (la paire en cours n’en sort pas)', lignes.join(','));
          const faux = await pg.evaluate(() => /avancée est ci-dessous/.test(document.querySelector('[data-republier]').innerText));
          dit(!faux, 'aucune phrase « l’avancée est ci-dessous » sans avancée', '');
          await pg.screenshot({ path: path.join(CAPT, `republier-encours-${vp.width}.png`) });
          // La fin : la paire est faite, la suivante est annoncée avec son compte à rebours.
          await pg.evaluate(() => window.__lacher());
          await pg.locator('[data-republier-ligne="9102"][data-republier-statut="fait"]').waitFor({ timeout: 4000 }).catch(() => {});
          await pg.locator('[data-republier-prochaine]').waitFor({ timeout: 3000 }).catch(() => {});
          const tFin = await pg.locator(bloc).first().innerText().catch(() => '');
          dit(/1 sur 2/.test(tFin) && /Prochain article dans/.test(tFin) && await visible(pg, '[data-republier-prochaine]') === 'ok', 'paire faite : « 1 sur 2 » et « Prochaine paire dans … », visibles', tFin);
          await pg.locator('[data-republier-pause]').click().catch(() => {});
          dit(!errs.length, 'aucune erreur d’app', errs.join(' | '));
        } catch (e) { dit(false, 'B : le parcours a levé', e.message.split('\n')[0]); }
        await ctx.close(); }
    }
  } catch (e) { dit(false, 'le banc a levé', e.message); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ brouillons-avancee : ${ko} rouge(s)` : '\n✅ brouillons-avancee : tout est vert');
  process.exit(ko ? 1 : 0);
})();
