// Banc : ANNONCES — SÉLECTIONNER, PUIS « ACTIONS POSSIBLES » (5 nov., Julien).
//
// Données INVENTÉES (le dépôt est public), 390 px tactile et 1512 px, clair et
// sombre. Un faux pont d'extension (Chrome ouvert sur le compte 111) note ce qui
// part. Il exige :
//   S. Annonces → « Sélectionner » : en ligne, MASQUÉES et BROUILLONS, chacun avec
//      son état, rangés PAR COMPTE (un brouillon du 222 jamais sous le 111) ; une
//      annonce « en vérification par Vinted » est là, mais ne se coche pas, et dit
//      pourquoi ;
//   A. une sélection ⇒ UN carré « Actions possibles » : deux comptes mélangés ⇒
//      tout grisé, raison dite ; deux annonces en ligne du compte de Chrome ⇒
//      republier, modifier, en ligne → brouillon ; brouillon → en ligne grisé ; « à
//      la main » possible sur plusieurs (une par une, 6 nov.) ; un brouillon ⇒
//      « brouillon → en ligne » ;
//   V. AVANT de lancer, paire par paire, ce qui manque (description trop courte,
//      couleur absente) avec le geste et le lien « Corriger sur Vinted » ;
//   R. lancer ouvre le moteur existant (Republier) sur CES annonces, à l'étape
//      d'après « Choisir », et rien ne part sans sa confirmation ;
//   M. « Republier à la main » : titre, description, prix à copier, photos ; il
//      désigne la nouvelle annonce (même compte seulement, une annonce au même
//      TITRE d'un autre compte n'est jamais proposée), confirme ; le N° attend
//      tant que l'ancienne est en ligne, puis passe sur la nouvelle ;
//   K. (revue du 5 nov.) un dressing qui envoie `color1`/`catalog_id` à `null`
//      (la forme MESURÉE en base) ne fait jamais dire « Couleur absente » ni
//      « Catégorie absente » : c'est « pas lu » ; « à la main » sur une MASQUÉE :
//      tant que l'ancienne masquée est encore là, son N° ne passe PAS sur la
//      nouvelle (deux paires présentes sous un N°) ; partie, il passe ;
//   F. aucun débordement, cibles de 44 px, aucune erreur ; captures dans SHOTS.
// §6.1 : sur le code d'avant, `[data-vue-selection]` n'existe pas ⇒ rouge.
const path = require('path'), fs = require('fs'), http = require('http'), os = require('os');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT) || 7943;
const SHOTS = process.env.SHOTS || os.tmpdir();
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const auj = new Date(); const s = Math.floor(auj / 1000);
const ann = (id, o) => Object.assign({ id, price: { amount: '49.0', currency_code: 'EUR' }, is_closed: false, is_draft: false, is_hidden: false, photo: null, brand_title: 'Nike', size_title: '42', status: 'Très bon état', view_count: 10, favourite_count: 1, nPhotos: 5, descLen: 60, color1: 'Blanc', catalog_id: 1242, created_at_ts: s - 40 * 86400 }, o);
const ITEMS_111 = [
  ann(9102, { title: 'Salomon XT-6 blanc taille 40', brand_title: 'Salomon', size_title: '40' }),
  // (revue) La forme MESURÉE d'un dressing non allégé : couleur et catégorie à `null`.
  ann(9103, { title: 'Adidas Spezial noir taille 38', brand_title: 'Adidas', size_title: '38', descLen: 2, color1: null, color1_id: null, catalog_id: null }),
  ann(9104, { title: 'Asics Gel-Kayano 14 taille 43', brand_title: 'Asics', is_processing: true, item_alert_type: 'under_review' }),
  ann(9110, { title: 'Puma Speedcat rouge taille 39', brand_title: 'Puma', is_hidden: true }),
  ann(9201, { title: 'Nike Air Max 1 dark teal', is_draft: true }),
  // La nouvelle annonce, republiée À LA MAIN (même titre que 9102, autre identifiant).
  ann(9120, { title: 'Salomon XT-6 blanc taille 40', brand_title: 'Salomon', size_title: '40', created_at_ts: s - 60 }),
  // La nouvelle de la MASQUÉE 9110, republiée à la main.
  ann(9121, { title: 'Puma Speedcat rouge taille 39', brand_title: 'Puma', created_at_ts: s - 50 }),
];
const ITEMS_222 = [
  // Même TITRE que 9102, mais un autre compte : jamais proposée comme la nouvelle.
  ann(9301, { title: 'Salomon XT-6 blanc taille 40', brand_title: 'Salomon', created_at_ts: s - 30 }),
  ann(9302, { title: 'Brouillon du second compte', is_draft: true }),
];
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: auj.toISOString() }, { id: 2, vinted_user_id: '222', login: 'autre_compte', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];
const MAIN = { vinted_annonce_numeros: { 9102: { numero: '42' }, 9103: { numero: '43' }, 9104: { numero: '44' }, 9110: { numero: '45' }, 9301: { numero: '50' } } };
const lignes = (etat) => {
  // L'ancienne n'est plus en ligne : Vinted la rend fermée (même nombre d'annonces lues : une lecture plus courte ne remplacerait pas la plus riche, §4.2).
  // (6 nov.) Les « nouvelles » annonces sont datées au moment où la page les LIT, pas au lancement du
  // banc : sous charge, une vue passait 10 min après le départ et la règle « mise en ligne bien avant
  // qu'il commence » (candidatsNouvelle) les écartait — un faux rouge de minuterie.
  const mnt = Math.floor(Date.now() / 1000); const frais = { 9120: 60, 9121: 50 };
  const i111 = ITEMS_111.map((x) => ((x.id === 9102 && etat.sans9102) || (x.id === 9110 && etat.sans9110) ? { ...x, is_closed: true } : x)).map((x) => (frais[x.id] ? { ...x, created_at_ts: mnt - frais[x.id] } : x));
  return [
    { id: 'main', data: MAIN },
    { id: 'harvest_111_listings', data: { capturedAt: auj.toISOString(), payload: { items: i111, pagination: { total_entries: i111.length } } } },
    { id: 'harvest_222_listings', data: { capturedAt: auj.toISOString(), payload: { items: ITEMS_222, pagination: { total_entries: ITEMS_222.length } } } },
    { id: 'vinted_brouillon_9201', data: { id: '9201', uid: '111', titre: 'Nike Air Max 1 dark teal', prix: 65, nPhotos: 4, etat: 'brouillon' } },
    { id: 'coffre_111_9102', data: { title: 'Salomon XT-6 blanc taille 40', desc: 'Salomon XT-6 portées deux fois, boîte d’origine.', brand: 'Salomon', size: '40', etat: 'Très bon état', price: 49, photos: ['https://images1.vinted.net/t/a/f800/1.jpeg', 'https://images1.vinted.net/t/a/f800/2.jpeg'] } },
  ];
};
const VERSION = (/EXT_ATTENDUE = '([\d.]+)'/.exec(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'App.jsx'), 'utf8')) || [])[1] || '5.322.0';
const PONT = (o) => {
  const post = (m) => window.postMessage(m, '*');
  window.__envois = [];
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version: o.version });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version: o.version, code: o.version, ext: 'banc-ext', vrm: { ok: true, connecte: true, email: '' }, vinted: { uid: '111', login: 'compte_test' }, cmds: {} } });
    if (d.__vmr === 'cmd') {
      if (['republierVinted', 'recreerVinted', 'publierBrouillon'].includes(d.cmd)) window.__envois.push({ cmd: d.cmd, id: d.id || d.draftId });
      post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: true, etape: 'recent' } });
    }
  });
  post({ __vmr: 'ready', version: o.version });
};

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d !== undefined && d !== '' ? ' — ' + d : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance avec un autre BANC_PORT'); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^(data|meta)(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (src.includes('->>') && typeof v === 'object' ? JSON.stringify(v) : v);
  }
  return out;
};

async function contexte(b, vp, sombre, etat) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((sb) => { try { localStorage.setItem('vrm_acces_direct', '1'); if (sb && !localStorage.getItem('vinted_dark')) localStorage.setItem('vinted_dark', 'true'); } catch (_) {} }, sombre);
  await pg.addInitScript(PONT, { version: VERSION });
  await ctx.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const t = r.request().resourceType();
    if (t === 'document') return r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>vinted (banc)</title>' });
    if (['image', 'media', 'font'].includes(t)) return r.abort();
    return r.continue();
  });
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const rows = lignes(etat);
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
const clic = async (pg, sel) => { const l = pg.locator(sel).first(); await l.scrollIntoViewIfNeeded().catch(() => {}); await l.click({ timeout: 4000 }).catch(async () => { await pg.$eval(sel, (x) => x.click()); }); };
const fermerFeuille = async (pg, dans) => { const x = pg.locator(`${dans} button[aria-label="Fermer"]`).first(); if (await x.count()) await x.click(); else await pg.keyboard.press('Escape'); await pg.waitForTimeout(250); };
const vueSelection = async (pg) => {
  await clic(pg, '[data-vue-selection]');
  await pg.waitForSelector('[data-selection-vue]', { timeout: 6000 });
  for (let i = 0; i < 40; i++) { if (await pg.$('[data-selection-annonce="9201"]') && await pg.$('[data-selection-annonce="9302"]')) break; await pg.waitForTimeout(250); }
};
const cocher = async (pg, id) => clic(pg, `[data-selection-annonce="${id}"] input`);
const debordement = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: CHROMIUM, args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      for (const sombre of [false, true]) {
        const T = `${vp.width}${sombre ? ' sombre' : ' clair'}`;
        const nomF = (x) => path.join(SHOTS, `annonces-actions-${vp.width}-${sombre ? 'sombre' : 'clair'}-${x}.png`);
        console.log(`── ${T}`);
        const etat = { sans9102: false, sans9110: false };
        const { ctx, pg, errs } = await contexte(b, vp, sombre, etat);
        try {
          await pg.goto(`http://localhost:${PORT}/?tab=cat_annonces`, { waitUntil: 'domcontentloaded' });
          const puce = pg.locator('[data-vue-selection]').first();
          await puce.waitFor({ state: 'attached', timeout: 15000 }).catch(() => {});
          dit(await puce.count() > 0, `S ${T} Annonces : une vue « Sélectionner »`);
          if (!(await puce.count())) { await pg.screenshot({ path: nomF('absent') }); continue; }
          dit((await pg.evaluate(() => document.documentElement.getAttribute('data-theme'))) === (sombre ? 'dark' : 'light') || !sombre, `F ${T} thème ${sombre ? 'sombre' : 'clair'} posé`, await pg.evaluate(() => document.documentElement.getAttribute('data-theme')));
          dit(await pg.locator('[data-vue-brouillons]').count() > 0, `S ${T} une vue « Brouillons » (ses brouillons Vinted lus)`);
          await vueSelection(pg);
          const groupes = await pg.$$eval('[data-selection-compte]', (l) => l.map((g) => ({ uid: g.getAttribute('data-selection-compte'), items: [...g.querySelectorAll('[data-selection-annonce]')].map((x) => ({ id: x.getAttribute('data-selection-annonce'), etat: x.getAttribute('data-selection-etat'), off: !!x.querySelector('input:disabled'), raison: (x.querySelector('[data-selection-raison]') || {}).textContent || '' })) })));
          const g = Object.fromEntries(groupes.map((x) => [x.uid, Object.fromEntries(x.items.map((i) => [i.id, i]))]));
          const g1 = g['111'] || {}, g2 = g['222'] || {};
          dit(g1['9102'] && g1['9102'].etat === 'en-ligne' && g1['9110'] && g1['9110'].etat === 'masquee' && g1['9201'] && g1['9201'].etat === 'brouillon', `S ${T} compte_test : en ligne, masquée, brouillon, chacun avec son état`, JSON.stringify(Object.values(g1).map((i) => i.id + ':' + i.etat)));
          dit(g2['9302'] && g2['9302'].etat === 'brouillon' && !g1['9302'] && !g2['9201'] && !g2['9102'], `S ${T} le brouillon du second compte est sous SON compte, jamais sous l’autre`, JSON.stringify(Object.keys(g2)));
          dit(g1['9104'] && g1['9104'].etat === 'verification' && g1['9104'].off && /Vinted/.test(g1['9104'].raison), `S ${T} « en vérification par Vinted » : visible, pas cochable, la raison dite`, g1['9104'] ? g1['9104'].raison : 'absente');
          dit(!g1['9110'].off && !g1['9201'].off, `S ${T} masquées et brouillons se cochent`);
          await pg.screenshot({ path: nomF('liste') });
          // A — deux comptes mélangés
          await cocher(pg, '9102'); await cocher(pg, '9301');
          const nb = await pg.getAttribute('[data-actions-possibles]', 'data-actions-possibles').catch(() => null);
          dit(nb === '2', `A ${T} un seul bouton « Actions · 2 » (la pastille « Actions possibles » de l’en-tête parle de l’extension)`, nb);
          await clic(pg, '[data-actions-possibles]');
          await pg.waitForSelector('[data-actions-selection]', { timeout: 4000 });
          const mix = await pg.$$eval('[data-action-sel]', (l) => l.map((x) => [x.getAttribute('data-action-sel'), x.getAttribute('data-action-sel-ok'), x.textContent]));
          // (5 nov., chantier C — revue 2.5) La raison commune se dit UNE fois, en tête de la
          //  feuille (`[data-actions-raison]`), plus sous chaque action : le contrôle lit la tête.
          const teteMix = await pg.$eval('[data-actions-raison]', (x) => x.textContent).catch(() => '');
          // (6 nov., vague 2) « Prix mini… » n'agit au nom d'aucun compte (une écriture dans ses fiches) :
          //  il reste possible ; tout ce qui agit au nom d'un compte reste grisé.
          // (6 nov.) « à la main » non plus (rien ne part d'ici ; une paire à la fois, chacune dit son compte).
          const parCompte = mix.filter(([k]) => k !== 'mini' && k !== 'main');
          dit(parCompte.length === 4 && parCompte.every(([, ok]) => ok === 'non') && /2 comptes/.test(teteMix), `A ${T} deux comptes mélangés ⇒ rien ne se lance au nom d’un compte, la raison dite`, mix.map((x) => x[0] + ':' + x[1]).join(' ') + ' / ' + teteMix);
          dit(mix.some(([k, ok]) => k === 'mini' && ok === 'oui'), `A ${T} « Prix mini… » reste possible sur deux comptes (rien ne part chez Vinted)`, mix.map((x) => x[0] + ':' + x[1]).join(' '));
          dit(mix.some(([k, ok]) => k === 'main' && ok === 'oui'), `A ${T} « à la main » reste possible sur deux comptes (une paire à la fois, chacune avec son compte)`, mix.map((x) => x[0] + ':' + x[1]).join(' '));
          await fermerFeuille(pg, '[data-actions-selection]');
          // A/V — deux annonces en ligne du compte de Chrome
          await cocher(pg, '9301'); await cocher(pg, '9103');
          await clic(pg, '[data-actions-possibles]');
          await pg.waitForSelector('[data-actions-selection="2"]', { timeout: 4000 });
          const oks = Object.fromEntries(await pg.$$eval('[data-action-sel]', (l) => l.map((x) => [x.getAttribute('data-action-sel'), x.getAttribute('data-action-sel-ok')])));
          dit(oks.recreer === 'oui' && oks.modifier === 'oui' && oks.versBrouillon === 'oui', `A ${T} republier, en ligne avec modifications, en ligne → brouillon possibles`, JSON.stringify(oks));
          // (6 nov.) « à la main » prend plusieurs annonces : une par une dans la feuille (« paire 1/2 »).
          dit(oks.enLigne === 'non' && oks.main === 'oui', `A ${T} « brouillon → en ligne » grisé (raison dite), « à la main » possible sur les deux`, JSON.stringify(oks));
          const v = Object.fromEntries(await pg.$$eval('[data-act-paire]', (l) => l.map((x) => [x.getAttribute('data-act-paire'), x.getAttribute('data-act-codes')])));
          dit(/description/.test(v['9103'] || '') && v['9102'] === '', `V ${T} avant de lancer : la paire 9103 dit « description », la 9102 rien`, JSON.stringify(v));
          // K — `null` du dressing = pas lu : jamais « Couleur absente » / « Catégorie absente ».
          const nonLu9103 = await pg.$eval('[data-act-paire="9103"] [data-act-non-lus]', (x) => x.textContent).catch(() => '');
          dit(!/couleur|categorie/.test(v['9103'] || '') && /couleur/.test(nonLu9103) && /catégorie/.test(nonLu9103), `K ${T} couleur et catégorie à null (forme mesurée) ⇒ « pas lu », jamais « absente »`, `${v['9103']} / ${nonLu9103.slice(0, 80)}`);
          dit(await pg.locator('[data-act-paire="9103"] a[href*="/items/9103/edit"]').count() > 0, `V ${T} le geste « Corriger sur Vinted ↗ » pointe sur CETTE annonce`);
          const petits = await pg.$$eval('[data-actions-selection] button, [data-actions-selection] a', (l) => l.filter((x) => { const r = x.getBoundingClientRect(); return r.height > 0 && r.height < 43.5; }).map((x) => x.textContent.slice(0, 24)));
          dit(!petits.length, `F ${T} cibles ≥ 44 px dans le carré`, petits.join(' | '));
          await pg.screenshot({ path: nomF('actions') });
          // R — lancer : le moteur existant, après « Choisir », rien ne part
          await clic(pg, '[data-action-sel="recreer"]');
          await pg.waitForSelector('[data-republier]', { timeout: 5000 }).catch(() => {});
          const rep = await pg.evaluate(() => { const r = document.querySelector('[data-republier]'); return r ? { a: r.getAttribute('data-republier-action'), e: r.getAttribute('data-republier-etape') } : null; });
          dit(rep && rep.a === 'recreer' && rep.e === 'modif', `R ${T} Republier s’ouvre sur ces annonces, après « Choisir »`, JSON.stringify(rep));
          await pg.screenshot({ path: nomF('republier') });
          dit((await pg.evaluate(() => window.__envois.length)) === 0, `R ${T} rien n’est parti sans sa confirmation`);
          // Un brouillon ⇒ « brouillon → en ligne »
          await pg.goto(`http://localhost:${PORT}/?tab=cat_annonces`, { waitUntil: 'domcontentloaded' });
          await pg.locator('[data-vue-selection]').first().waitFor({ state: 'attached', timeout: 15000 });
          await vueSelection(pg);
          await cocher(pg, '9201');
          await clic(pg, '[data-actions-possibles]');
          await pg.waitForSelector('[data-actions-selection="1"]', { timeout: 4000 });
          const okb = Object.fromEntries(await pg.$$eval('[data-action-sel]', (l) => l.map((x) => [x.getAttribute('data-action-sel'), x.getAttribute('data-action-sel-ok')])));
          dit(okb.enLigne === 'oui' && okb.recreer === 'non' && okb.versBrouillon === 'non' && okb.main === 'oui', `A ${T} un brouillon ⇒ « brouillon → en ligne » (et « à la main »)`, JSON.stringify(okb));
          await clic(pg, '[data-action-sel="enLigne"]');
          await pg.waitForSelector('[data-republier-action="enLigne"]', { timeout: 5000 }).catch(() => {});
          const repB = await pg.getAttribute('[data-republier]', 'data-republier-etape').catch(() => null);
          dit(repB === 'envoi' && (await pg.evaluate(() => window.__envois.length)) === 0, `R ${T} « Mettre en ligne » ouvert sur ce brouillon, à confirmer`, repB);
          // M — republier à la main
          await pg.goto(`http://localhost:${PORT}/?tab=cat_annonces`, { waitUntil: 'domcontentloaded' });
          await pg.locator('[data-vue-selection]').first().waitFor({ state: 'attached', timeout: 15000 });
          await vueSelection(pg);
          await cocher(pg, '9102');
          await clic(pg, '[data-actions-possibles]');
          await pg.waitForSelector('[data-actions-selection="1"]', { timeout: 4000 });
          await clic(pg, '[data-action-sel="main"] button');   // (chantier C) « à la main » : un lien sous les quatre tuiles
          await pg.waitForSelector('[data-main-champ="titre"]', { timeout: 5000 }).catch(() => {});
          for (let i = 0; i < 20; i++) { if (!(await pg.$('[data-main-lecture]'))) break; await pg.waitForTimeout(200); }
          const champs = await pg.$$eval('[data-main-champ]', (l) => Object.fromEntries(l.map((x) => [x.getAttribute('data-main-champ'), x.textContent])));
          dit(/Salomon XT-6/.test(champs.titre || '') && /boîte d’origine/.test(champs.description || champs.desc || '') && /49/.test(champs.prix || ''), `M ${T} titre, description et prix prêts à copier`, JSON.stringify(Object.keys(champs)));
          dit(await pg.locator('[data-main-copier]').count() >= 3 && (await pg.getAttribute('[data-main-photos]', 'data-main-photos').catch(() => null)) === '2', `M ${T} boutons « Copier » et les 2 photos du coffre`);
          const [pop] = await Promise.all([pg.context().waitForEvent('page', { timeout: 5000 }).catch(() => null), clic(pg, '[data-main-ouvrir-vinted]')]);
          if (pop) await pop.close().catch(() => {});
          await pg.waitForSelector('[data-main-candidat]', { timeout: 5000 }).catch(() => {});
          const cands = await pg.$$eval('[data-main-candidat]', (l) => l.map((x) => x.getAttribute('data-main-candidat')));
          dit(cands.includes('9120') && !cands.includes('9301') && !cands.includes('9102') && !cands.includes('9103'), `M ${T} proposées : la nouvelle du MÊME compte ; jamais celle de même titre de l’autre compte, ni l’ancienne, ni une numérotée`, cands.join(','));
          await pg.screenshot({ path: nomF('main') });
          await clic(pg, '[data-main-lier="9120"]');
          { const oui = pg.locator('button', { hasText: 'Oui, c’est elle' }).last(); await oui.waitFor({ state: 'visible', timeout: 4000 }); await oui.click({ timeout: 4000 }).catch(() => oui.evaluate((x) => x.click())); }
          await pg.waitForSelector('[data-main-lie="9120"]', { timeout: 4000 }).catch(() => {});
          dit(await pg.locator('[data-main-lie="9120"]').count() > 0, `M ${T} SON clic relie la nouvelle annonce (confirmée)`);
          const sheet = await pg.$('[data-main-lie]');
          if (sheet) { const x = await pg.$$('button[aria-label="Fermer"]'); if (x.length) await x[x.length - 1].click(); await pg.waitForTimeout(300); }
          await pg.waitForSelector('[data-suivi-main="9102"]', { timeout: 4000 }).catch(() => {});
          const num9120 = await pg.$eval('[data-selection-annonce="9120"] .vrm-sel-num', (x) => x.textContent).catch(() => '');
          dit((await pg.getAttribute('[data-suivi-main="9102"]', 'data-suivi-main-etat').catch(() => null)) === 'lie' && num9120 !== 'N°42', `M ${T} tant que l’ancienne est en ligne, le N°42 attend (jamais deux annonces sous un N°)`, num9120);
          // L'ancienne n'est plus en ligne ⇒ le N° passe sur la nouvelle.
          etat.sans9102 = true;
          // Une nouvelle ouverture de l'app (le cache d'écran de 5 min ne sert pas la lecture d'avant).
          await pg.evaluate(() => { try { sessionStorage.removeItem('vrm_acct_cache'); } catch (_) {} });
          await pg.goto(`http://localhost:${PORT}/?tab=cat_annonces`, { waitUntil: 'domcontentloaded' });
          await pg.locator('[data-vue-selection]').first().waitFor({ state: 'attached', timeout: 15000 });
          await vueSelection(pg);
          let n = '';
          for (let i = 0; i < 30; i++) { n = await pg.$eval('[data-selection-annonce="9120"] .vrm-sel-num', (x) => x.textContent).catch(() => ''); if (n === 'N°42') break; await pg.waitForTimeout(250); }
          dit(n === 'N°42' && !(await pg.$('[data-suivi-main="9102"]')),`M ${T} l’ancienne partie ⇒ la nouvelle porte le N°42, le suivi est fini`, n);
          await pg.screenshot({ path: nomF('apres') });
          // K — « à la main » sur une MASQUÉE : le N°45 attend que la masquée soit partie.
          await cocher(pg, '9110');
          await clic(pg, '[data-actions-possibles]');
          await pg.waitForSelector('[data-actions-selection]', { timeout: 4000 });
          await clic(pg, '[data-action-sel="main"] button');
          await pg.waitForSelector('[data-main-ouvrir-vinted]', { timeout: 5000 }).catch(() => {});
          { const [pop2] = await Promise.all([pg.context().waitForEvent('page', { timeout: 5000 }).catch(() => null), clic(pg, '[data-main-ouvrir-vinted]')]); if (pop2) await pop2.close().catch(() => {}); }
          await pg.waitForSelector('[data-main-lier="9121"]', { timeout: 5000 }).catch(() => {});
          const candsM = await pg.$$eval('[data-main-candidat]', (l) => l.map((x) => x.getAttribute('data-main-candidat')));
          dit(candsM.includes('9121') && !candsM.includes('9120'), `K ${T} masquée : la nouvelle 9121 proposée, jamais 9120 (déjà la nouvelle d’une autre)`, candsM.join(','));
          await clic(pg, '[data-main-lier="9121"]');
          { const oui = pg.locator('button', { hasText: 'Oui, c’est elle' }).last(); await oui.waitFor({ state: 'visible', timeout: 4000 }); await oui.click({ timeout: 4000 }).catch(() => oui.evaluate((x) => x.click())); }
          await pg.waitForSelector('[data-main-lie="9121"]', { timeout: 4000 }).catch(() => {});
          dit(await pg.locator('[data-main-lie="9121"]').count() > 0, `K ${T} masquée : SON clic relie 9121 (confirmée)`);
          // La sauvegarde de l'appareil part après un court délai (`save`) : on l'attend avant de recharger.
          for (let i = 0; i < 40; i++) { if (await pg.evaluate(() => /"9110":\{[^}]*"nouvelId":"9121"/.test(localStorage.getItem('vrm_repub_main') || ''))) break; await pg.waitForTimeout(250); }
          await pg.evaluate(() => { try { sessionStorage.removeItem('vrm_acct_cache'); } catch (_) {} });
          await pg.goto(`http://localhost:${PORT}/?tab=cat_annonces`, { waitUntil: 'domcontentloaded' });
          await pg.locator('[data-vue-selection]').first().waitFor({ state: 'attached', timeout: 15000 });
          await vueSelection(pg);
          // La numérotation a tourné (9120 porte le N°42) : on juge alors 9121.
          for (let i = 0; i < 30; i++) { if ((await pg.$eval('[data-selection-annonce="9120"] .vrm-sel-num', (x) => x.textContent).catch(() => '')) === 'N°42') break; await pg.waitForTimeout(250); }
          await pg.waitForTimeout(1200);
          const n45 = await pg.$$eval('[data-selection-annonce] .vrm-sel-num', (l) => l.filter((x) => x.textContent === 'N°45').map((x) => x.closest('[data-selection-annonce]').getAttribute('data-selection-annonce')));
          dit(n45.length === 1 && n45[0] === '9110', `K ${T} la masquée 9110 encore là ⇒ le N°45 reste à elle seule (jamais deux paires sous un N°)`, n45.join(','));
          await pg.screenshot({ path: nomF('masquee') });
          etat.sans9110 = true;
          await pg.evaluate(() => { try { sessionStorage.removeItem('vrm_acct_cache'); } catch (_) {} });
          await pg.goto(`http://localhost:${PORT}/?tab=cat_annonces`, { waitUntil: 'domcontentloaded' });
          await pg.locator('[data-vue-selection]').first().waitFor({ state: 'attached', timeout: 15000 });
          await vueSelection(pg);
          let n2 = '';
          for (let i = 0; i < 30; i++) { n2 = await pg.$eval('[data-selection-annonce="9121"] .vrm-sel-num', (x) => x.textContent).catch(() => ''); if (n2 === 'N°45') break; await pg.waitForTimeout(250); }
          dit(n2 === 'N°45', `K ${T} la masquée partie ⇒ la nouvelle porte le N°45`, n2);
          const deb = await debordement(pg);
          dit(deb <= 1, `F ${T} aucun débordement horizontal`, deb);
          dit(!errs.length, `F ${T} aucune erreur de page`, errs.slice(0, 2).join(' | '));
        } catch (e) { dit(false, `${T} le parcours s’arrête`, e.message.split('\n')[0]); await pg.screenshot({ path: nomF('erreur') }).catch(() => {}); }
        await ctx.close();
      }
    }
  } finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\nKO  ${ko} contrôle(s) rouge(s) — captures : ${SHOTS}` : `\nOK  annonces, sélection et actions — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
