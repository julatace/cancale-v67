// Banc : « REPUBLIER » (28 octobre) — UN parcours dans Annonces, demandé par
// Julien : un bouton « Republier », la liste de ses paires EN LIGNE, il en
// choisit, leur applique les modifications, et l'annonce se republie.
//
// Données INVENTÉES (il vit dans le dépôt), 390 px tactile et 1512 px. Un faux
// pont d'extension (5.247) répond à `republierVinted` et note ce qui part. Il
// exige :
//   · un bouton « Republier » dans la barre d'Annonces ; plus de « Lots » ni de
//     « File de publication » dans le menu, plus de « ✨ Préparer » sur les cartes ;
//   · la liste = ses paires en ligne (3), à cocher ; « Continuer » grisé sans choix ;
//   · l'aperçu calcule le NOUVEAU prix (−10 % : 49 → 44,10 €) et respecte le
//     plancher (prix d'achat 47 € ⇒ 47,00 €, jamais en dessous) ;
//   · rien ne part avant la case de confirmation ; ensuite, UNE commande par
//     paire choisie, avec SON prix, `confirme: true` ; une paire refusée par
//     l'extension dit « pas faite » avec SA raison, jamais « republiée ».
// §6.1 : sur un build d'origin/main, `[data-republier-ouvrir]` n'existe pas ⇒ rouge.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT) || 4373;
const auj = new Date();
const ann = (id, o) => Object.assign({ id, price: { amount: '49.0', currency_code: 'EUR' }, is_closed: false, is_draft: false, photo: null, brand_title: 'Nike', size_title: '42', status: 'Très bon état', view_count: 10, favourite_count: 1 }, o);
const ITEMS = [
  ann(9102, { title: 'Salomon XT-6 blanc taille 40', brand_title: 'Salomon', favourite_count: 6, created_at_ts: Math.floor(auj / 1000) - 30 * 86400 }),
  ann(9103, { title: 'Adidas Spezial noir taille 38', brand_title: 'Adidas', favourite_count: 0, created_at_ts: Math.floor(auj / 1000) - 60 * 86400 }),
  ann(9106, { title: 'Nike Dunk low panda taille 41', created_at_ts: Math.floor(auj / 1000) - 5 * 86400 }),
  ann(9107, { title: 'Asics Gel-Kayano 14 taille 43', brand_title: 'Asics', favourite_count: 0, created_at_ts: Math.floor(auj / 1000) - 2 * 86400 }),
];
const MAIN = { vinted_annonce_numeros: { '9102': { numero: '42' }, '9103': { numero: '43' }, '9106': { numero: '45', buyPrice: '47', recreeAt: new Date(auj - 5 * 3600e3).toISOString() }, '9107': { numero: '46' } } };
const rows = [
  { id: 'main', data: MAIN },
  { id: 'harvest_111_listings', data: { capturedAt: auj.toISOString(), payload: { items: ITEMS } } },
  { id: 'vinted_item_details', data: {} },
];
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];
const VERSION = (/EXT_ATTENDUE = '([\d.]+)'/.exec(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'App.jsx'), 'utf8')) || [])[1] || '5.247.0';
const PONT = (o) => {
  const post = (m) => window.postMessage(m, '*');
  window.__repub = [];
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version: o.version });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version: o.version, code: o.version, ext: 'banc-ext', vrm: { ok: true, connecte: true, email: '' }, vinted: { uid: '111', login: 'compte_test' }, cmds: {} } });
    if (d.__vmr === 'cmd' && (d.cmd === 'republierVinted' || d.cmd === 'recreerVinted')) {
      window.__repub.push({ cmd: d.cmd, id: d.id, uid: d.uid, prix: d.prix, titre: d.titre, plancher: d.plancher, confirme: d.confirme, reglages: d.reglages });
      const resp = d.id === '9107' ? { accepte: false, code: 'vinted-pause', raison: 'Vinted demande de ralentir — réessaie dans 15 min' }
        : d.id === '9106' ? { accepte: false, code: 'recette-absente', raison: 'VRM ne connaît pas encore la catégorie exacte' }
        : d.id === '9103' ? { accepte: true, etape: 'double', nouvelId: '99103', nouveau: d.prix, raison: 'la nouvelle annonce est en ligne, mais Vinted a refusé de supprimer l\u2019ancienne' }
        : { accepte: true, etape: 'fait', nouvelId: '99102', ancien: 49, nouveau: d.prix };
      post({ __vmr: 'cmd:result', reqId: d.reqId, resp });
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
    out[alias] = v == null ? null : (src.includes('->>') && typeof v === 'object' ? JSON.stringify(v) : v);
  }
  return out;
};
(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      console.log(`── ${vp.width} px`);
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
      try {
        await pg.goto(`http://localhost:${PORT}/?tab=cat_annonces`, { waitUntil: 'domcontentloaded' });
        const bouton = pg.locator('[data-republier-ouvrir]').first();
        await bouton.waitFor({ state: 'visible', timeout: 12000 }).catch(() => {});
        dit(await bouton.count() > 0 && await bouton.isVisible(), 'Annonces : un bouton « Republier » dans la barre');
        dit(await pg.locator('[data-atelier-ouvrir]').count() === 0, 'plus de « ✨ Préparer » sur les cartes (un seul parcours)');
        const outils = pg.locator('[aria-label="Outils"]').first();
        if (await outils.count()) { await outils.click(); await pg.waitForTimeout(200); }
        const menu = await pg.evaluate(() => document.body.innerText);
        dit(!/Lots — titres|File de publication/.test(menu), 'le menu Outils ne propose plus « Lots » ni « File de publication »');
        await pg.keyboard.press('Escape').catch(() => {});
        if (await outils.count()) { await pg.mouse.click(5, 5).catch(() => {}); await pg.waitForTimeout(150); }
        await bouton.click();
        await pg.locator('[data-republier]').waitFor({ state: 'visible', timeout: 4000 });
        const paires = await pg.$$eval('[data-republier-paire]', (els) => els.map((e) => e.getAttribute('data-republier-paire')));
        dit(paires.join(',') === '9103,9102,9106,9107', 'la liste = ses 4 paires en ligne, les plus anciennes d’abord', paires.join(','));
        const info = await pg.locator('[data-republier-paire="9102"]').innerText();
        dit(/en ligne depuis 30 j/.test(info) && /6 favoris/.test(info) && /10 vues/.test(info), 'chaque paire dit son ancienneté, ses vues et ses favoris', info.replace(/\n/g, ' · '));
        dit(await pg.locator('[data-republier-recente="9106"]').count() === 1 && await pg.locator('[data-republier-recente="9102"]').count() === 0, 'une paire recréée il y a moins de 2 jours le dit (et seulement elle)');
        await pg.locator('[data-republier-tri]').selectOption('favoris');
        const parFav = await pg.$$eval('[data-republier-paire]', (els) => els.map((e) => e.getAttribute('data-republier-paire')));
        dit(parFav[parFav.length - 1] === '9102', 'tri « moins de favoris d’abord » : la paire à 6 favoris passe en dernier', parFav.join(','));
        dit(await pg.locator('[data-republier-suivant]').isDisabled(), 'sans paire choisie, « Continuer » est grisé');
        await pg.locator('[data-republier-paire="9102"]').click();
        await pg.locator('[data-republier-paire="9103"]').click();
        await pg.locator('[data-republier-paire="9106"]').click();
        await pg.locator('[data-republier-paire="9107"]').click();
        await pg.locator('[data-republier-suivant]').click();
        await pg.locator('[data-republier-apercu="9102"]').waitFor({ timeout: 3000 });
        const p1 = await pg.locator('[data-republier-apercu="9102"]').getAttribute('data-republier-nouveau-prix');
        const p2 = await pg.locator('[data-republier-apercu="9106"]').getAttribute('data-republier-nouveau-prix');
        dit(p1 === '4410', 'aperçu : −10 % sur 49 € ⇒ 44,10 €', p1);
        dit(p2 === '4700', 'aperçu : jamais sous le prix d’achat (47 €) ⇒ 47,00 €', p2);
        // Réglages photo (« ce qu'on avait commencé dans Préparer ») : zoom 1,2.
        await pg.locator('[data-republier-reglage="zoom"]').evaluate((el) => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, '1.2'); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); });
        const tf = await pg.locator('[data-republier-photos]').getAttribute('data-republier-photos-css').catch(() => '');
        dit(/scale\(1\.2\)/.test(tf || ''), 'les réglages photo se voient dans l’aperçu (zoom 1,2)', tf);
        await pg.screenshot({ path: path.join(require('os').tmpdir(), 'republier-modif-' + vp.width + '.png') });
        await pg.locator('[data-republier-suivant]').click();
        await pg.locator('[data-republier-lancer]').waitFor({ timeout: 3000 });
        dit(await pg.locator('[data-republier-lancer]').isDisabled(), 'sans la case de confirmation, « Republier » est grisé');
        const avant = await pg.evaluate(() => (window.__repub || []).length);
        dit(avant === 0, 'rien n’est parti avant la confirmation', String(avant));
        dit(await pg.locator('[data-republier-favoris]').getAttribute('data-republier-favoris').catch(() => '') === '7', 'avant de lancer : les favoris PERDUS sont comptés (6 + 1 = 7) et dits', await pg.locator('[data-republier-favoris]').innerText().catch(() => 'absent'));
        dit(await pg.locator('[data-republier-recentes]').count() === 1, '… et la paire déjà recréée récemment est signalée');
        const ordreLignes = () => pg.$$eval('[data-republier-ligne]', (els) => els.map((e) => e.getAttribute('data-republier-ligne')));
        const o0 = await ordreLignes();
        dit(o0.join(',') === '9102,9103,9106,9107', 'la file suit l’ordre de SA sélection', o0.join(','));
        await pg.locator('[data-republier-melanger]').click();
        const o1 = await ordreLignes();
        dit(o1.join(',') !== o0.join(',') && [...o1].sort().join(',') === [...o0].sort().join(','), '« Mélanger » change l’ordre (les mêmes paires, aucune perdue)', o1.join(','));
        await pg.locator('[data-republier-ordre-selection]').click();
        dit((await ordreLignes()).join(',') === o0.join(','), '« Ordre de ma sélection » le remet');
        await pg.locator('[data-republier-monter="9103"]').click();
        const o2 = await ordreLignes();
        dit(o2.join(',') === '9103,9102,9106,9107', 'la flèche ↑ monte une paire', o2.join(','));
        await pg.screenshot({ path: path.join(require('os').tmpdir(), 'republier-ordre-' + vp.width + '.png') });
        const petits = await pg.$$eval('[data-republier-monter],[data-republier-descendre],[data-republier-melanger]', (els) => els.filter((e) => { const r = e.getBoundingClientRect(); return r.width < 44 || r.height < 44; }).length);
        dit(petits === 0, 'flèches et « Mélanger » font 44 px au doigt', String(petits));
        await pg.locator('[data-republier] input[inputmode="numeric"]').fill('0');
        await pg.locator('[data-republier-confirme]').check();
        await pg.locator('[data-republier-lancer]').click();
        for (let i = 0; i < 40; i++) { const m = await pg.locator('[data-republier]').getAttribute('data-republier-mode'); if (m === 'fini' || m === 'pause') break; await pg.waitForTimeout(250); }
        const envois = await pg.evaluate(() => window.__repub || []);
        dit(envois.length === 4, 'UNE commande par paire choisie (4)', JSON.stringify(envois.map((x) => x.id)));
        dit(envois.map((x) => x.id).join(',') === '9103,9102,9106,9107', 'les paires sont recréées DANS L’ORDRE affiché', envois.map((x) => x.id).join(','));
        dit(await pg.locator('[data-republier]').getAttribute('data-republier-mode') === 'pause' && await pg.locator('[data-republier-arret]').count() === 1, 'Vinted demande de ralentir : la file S’ARRÊTE et le dit (pas une rafale de refus)', await pg.locator('[data-republier-arret]').innerText().catch(() => 'absent'));
        const e1 = envois.find((x) => x.id === '9102'), e2 = envois.find((x) => x.id === '9106');
        dit(envois.every((x) => x.cmd === 'recreerVinted'), 'chaque paire est SUPPRIMÉE ET RECRÉÉE (commande recreerVinted)', envois.map((x) => x.cmd).join(','));
        dit(e1 && e1.uid === '111' && Math.abs(e1.prix - 44.1) < 1e-9 && e1.confirme === true, 'la commande porte SON prix (44,10), son compte, et la confirmation', JSON.stringify(e1));
        dit(e1 && e1.reglages && Math.abs(e1.reglages.zoom - 1.2) < 1e-9 && e1.reglages.rot === 0, 'les réglages photo partent avec la commande', JSON.stringify(e1 && e1.reglages));
        dit(e2 && Math.abs(e2.prix - 47) < 1e-9 && Number(e2.plancher) === 47, '… et le plancher (prix d’achat) part avec', JSON.stringify(e2));
        dit(await pg.locator('[data-republier-ligne="9102"]').getAttribute('data-republier-statut') === 'fait', 'la paire recréée dit « recréée »');
        const l3 = pg.locator('[data-republier-ligne="9103"]');
        dit(await l3.getAttribute('data-republier-statut') === 'double' && /refusé de supprimer/.test(await l3.innerText()), 'ancienne pas supprimée : dit en toutes lettres, jamais « recréée »', await l3.innerText());
        await pg.waitForTimeout(1500);   // `save` écrit 500 ms plus tard
        const nums = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vinted_annonce_numeros') || '{}'); } catch (_) { return {}; } });
        dit(nums['99102'] && nums['99102'].numero === '42' && nums['99102'].recreeDe === '9102', 'le N° 42 passe sur la NOUVELLE annonce (jamais un numéro neuf)', JSON.stringify(nums['99102']));
        dit(nums['99103'] && nums['99103'].numero === '43', '… y compris quand l’ancienne reste en ligne (le N° suit la paire)', JSON.stringify(nums['99103']));
        dit(nums['9102'] && nums['9102'].numero === '42', 'l’ancienne fiche garde son historique', JSON.stringify(nums['9102']));
        const l2 = pg.locator('[data-republier-ligne="9106"]');
        dit(await l2.getAttribute('data-republier-statut') === 'echec' && /catégorie exacte/.test(await l2.innerText()), 'la paire refusée dit « pas faite » avec SA raison, jamais « recréée »', await l2.innerText());
        const r = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
        dit(r.sw <= r.cw + 1, 'aucun débordement horizontal', `${r.sw} > ${r.cw}`);
        dit(!errs.length, 'aucune erreur d’app', errs[0]);
      } catch (e) { dit(false, 'le scénario « Republier » a tourné', String(e.message).slice(0, 160)); }
      await pg.screenshot({ path: path.join(require('os').tmpdir(), 'republier-' + vp.width + '.png') });
      await ctx.close();
    }
    // ── Temps ALÉATOIRE entre deux paires (sa demande) : horloge simulée.
    { console.log('── aléatoire 1–2 min');
      const ctx = await b.newContext({ viewport: { width: 1512, height: 950 } });
      const pg = await ctx.newPage();
      await pg.clock.install({ time: auj });
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
        const eq = /id=eq\.([^&]*)/.exec(u); if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
        const lk = /id=like\.([^&]*)/.exec(u);
        if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
        return j([]);
      });
      await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
      try {
        await pg.goto(`http://localhost:${PORT}/?tab=cat_annonces`, { waitUntil: 'domcontentloaded' });
        for (let i = 0; i < 40 && !(await pg.locator('[data-republier-ouvrir]').count()); i++) await pg.clock.runFor(500);
        await pg.locator('[data-republier-ouvrir]').first().click();
        await pg.locator('[data-republier-paire="9102"]').click();
        await pg.locator('[data-republier-paire="9103"]').click();
        await pg.locator('[data-republier-suivant]').click();
        await pg.locator('[data-republier-suivant]').click();
        await pg.locator('[data-republier-esp-choix="aleatoire"]').click();
        await pg.locator('[data-republier-esp-min]').fill('1');
        await pg.locator('[data-republier-esp-max]').fill('2');
        dit(await pg.locator('[data-republier-esp-choix="aleatoire"]').getAttribute('aria-pressed') === 'true' && await pg.locator('[data-republier-esp-choix="fixe"]').getAttribute('aria-pressed') === 'false', '« Aléatoire » est bien le segment actif');
        await pg.mouse.move(1, 1);
        await pg.setViewportSize({ width: 390, height: 844 }); await pg.screenshot({ path: path.join(require('os').tmpdir(), 'republier-alea-390.png') }); await pg.setViewportSize({ width: 1512, height: 950 });
        dit(await pg.locator('[data-republier-esp="aleatoire"]').count() === 1, '« Aléatoire » se choisit, avec un minimum et un maximum en minutes');
        await pg.locator('[data-republier-confirme]').check();
        await pg.locator('[data-republier-lancer]').click();
        for (let i = 0; i < 20 && (await pg.evaluate(() => (window.__repub || []).length)) < 1; i++) await pg.clock.runFor(100);
        await pg.clock.runFor(1000);
        const prochaine = Number(await pg.locator('[data-republier-prochaine]').getAttribute('data-republier-prochaine').catch(() => 'NaN'));
        dit(prochaine >= 60 && prochaine <= 120, 'le temps tiré est entre 1 et 2 min, et le compte à rebours s’affiche', String(prochaine));
        await pg.clock.runFor(57000);
        const n1 = await pg.evaluate(() => (window.__repub || []).length);
        dit(n1 === 1, 'rien ne part avant le minimum (1 min)', String(n1));
        await pg.clock.runFor(63000);
        for (let i = 0; i < 20 && (await pg.evaluate(() => (window.__repub || []).length)) < 2; i++) await pg.clock.runFor(100);
        const n2 = await pg.evaluate(() => (window.__repub || []).length);
        dit(n2 === 2, 'la seconde paire est partie au plus tard au maximum (2 min)', String(n2));
        const memo = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_republier_esp') || 'null'); } catch (_) { return null; } });
        dit(memo && memo.mode === 'aleatoire', 'le choix est retenu pour la prochaine fois', JSON.stringify(memo));
      } catch (e) { dit(false, 'le scénario aléatoire a tourné', String(e.message).slice(0, 160)); }
      await ctx.close(); }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e.message).slice(0, 160)); }
  if (b) await b.close(); srv.close();
  console.log(`\n${ko ? '❌' : '✅'} republier : ${ko ? ko + ' rouge(s)' : 'tout est vert'}`);
  process.exit(ko ? 1 : 0);
})();
