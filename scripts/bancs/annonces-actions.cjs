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
// ⚠️ (26 nov., bancs natifs) RÉÉCRIT SUR ANNONCES NATIF (src/natif/ecrans/Annonces.jsx, src/ecrans/AnnoncesEgalite.jsx). Le
// parcours d'aujourd'hui : CHOISIR l'action (« ⋯ » → l'action ; à l'ordinateur, les actions directes du tableau) puis cocher —
// seules les annonces que l'action accepte se cochent (`pour`), le bouton « Lancer » s'éteint et dit sa raison (`juger`).
// Mêmes garanties : S (états, par compte, brouillons sous « À publier ») ; A (deux comptes ⇒ rien au nom d'un compte ; une
// masquée ne se republie pas ; « brouillon → en ligne » pour les brouillons seuls ; « à la main » sur deux comptes) ; R : depuis
// le 24 nov. (« tout faire depuis VRM si l'extension est connectée », CLAUDE.md §3) « Republier » part par la porte de l'app
// (src/agir/porte.js `republierDansApp`) APRÈS SA confirmation — plus par l'étape « modif » de l'atelier : exigé ici que rien
// ne parte avant ni sur « Annuler » ; M (la feuille « à la main », la même) ; K/M (le N° attend que l'ancienne soit partie).
// Retirés AVEC la feuille « Actions possibles » d'avant (plus montée par l'écran natif, 19 nov.) : V (ce qui manque paire par
// paire, `data-act-paire`) et K-couleur (« pas lu » vs « absente ») — leur règle reste jugée par scripts/audit-annonces-actions.cjs ;
// « en vérification par Vinted » non cochable : rétabli le 27 nov. dans l'écran natif (src/ecrans/AnnoncesEgalite.jsx `pour` /
// `raisonLigne`, `data-ad-raison`) — sur le code du 26 nov. ces deux contrôles S sont rouges.
require('./_porte-banc.cjs');   // (26 nov.) la garde réseau du banc : rien ne sort
require('../_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const path = require('path'), fs = require('fs'), http = require('http'), os = require('os');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
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
  await pg.addInitScript((sb) => { try { localStorage.setItem('vrm_acces_direct', '1'); if (!localStorage.getItem('vinted_dark')) localStorage.setItem('vinted_dark', sb ? 'true' : 'false'); } catch (_) {} }, sombre);
  await pg.addInitScript(PONT, { version: VERSION });
  await ctx.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const t = r.request().resourceType();
    if (t === 'document') return r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>vinted (banc)</title>' });
    // (12 nov.) la sonde des photos Vinted (`essaiSonde`, fetch no-cors) est coupée comme l'image : rien ne sort.
    if (['image', 'media', 'font'].includes(t) || /^https?:\/\/[^/]*vinted\.net\//i.test(r.request().url())) return r.abort();
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
// (11 nov., rouges A) « Une nouvelle ouverture de l'app » : depuis le 9 nov. (vitesse), le cache
// d'écran est écrit QUAND LA PAGE EST QUITTÉE (`pagehide`) — l'effacer avant `goto` ne suffit plus,
// la page qui part le réécrit. On l'efface aussi après elle (écouteur posé après celui de l'app).
// (11 nov., rouges A) « Oui, c'est elle » : sous charge, la feuille de confirmation glisse encore
// quand le clic part ; si le clic a fini par passer, la feuille est fermée et le repli « clic en JS »
// attendait 30 s un bouton parti (« le parcours s'arrête »). Le repli ne joue que si le bouton est
// encore là ; c'est `[data-main-lie]` qui juge ensuite que SON clic a relié.
const nouvelleOuverture = (pg) => pg.evaluate(() => { try { sessionStorage.removeItem('vrm_acct_cache'); window.addEventListener('pagehide', () => { try { sessionStorage.removeItem('vrm_acct_cache'); } catch (_) {} }); } catch (_) {} });
// (26 nov., bancs natifs) Un toucher (téléphone) ou un clic (ordinateur) sur l'élément VU — un écran d'avant reste monté caché
// sous l'écran natif, avec les mêmes repères (`:visible`).
const geste = async (pg, tel, sel) => { const l = pg.locator(sel + ':visible').first(); if (!(await l.count())) return false; await l.scrollIntoViewIfNeeded().catch(() => {}); await (tel ? l.tap({ timeout: 5000 }) : l.click({ timeout: 5000 })).catch(() => {}); await pg.waitForTimeout(700); return true; };
const debordement = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
// Les articles montrés : téléphone = la liste groupée par compte (`[data-eg-groupe]`), ordinateur = le tableau de travail.
const articles = (pg) => pg.evaluate(() => { const vus = new Set(); return [...document.querySelectorAll('[data-eg-article]')].filter((x) => x.getClientRects().length && !vus.has(x.getAttribute('data-eg-article')) && vus.add(x.getAttribute('data-eg-article'))).map((x) => {
  const g = x.closest('[data-eg-groupe]');
  return { id: x.getAttribute('data-eg-article').replace(/^vinted#/, ''), compte: x.getAttribute('data-eg-compte') || '', groupe: g ? g.getAttribute('data-eg-groupe') : '',
    etat: x.getAttribute('data-ad-etat') || x.getAttribute('data-tt-statut-ligne') || '', coche: x.getAttribute('data-eg-coche') || x.getAttribute('data-tt-coche') || '0', grise: x.getAttribute('data-ad-grise') === '1', numero: x.getAttribute('data-eg-numero') || '' };
}); });
// Le segment montré (`[data-eg-ecran][data-eg-etat]`) : un toucher pendant le calcul de l'écran peut se perdre — attendu, un 2ᵉ au plus (§6.5).
const segment = async (pg, tel, e) => { for (let k = 0; k < 2; k++) { await geste(pg, tel, `[data-eg-segment="${e}"]`);
  if (await pg.waitForFunction((e) => !!document.querySelector(`[data-eg-ecran][data-eg-etat="${e}"]`), e, { timeout: 3000 }).then(() => true).catch(() => false)) break; } await pg.waitForTimeout(600); };
// Le mode « sélection » d'une action (téléphone) : « ⋯ » puis l'action ; ses cases se cochent au toucher de la rangée.
const modeAction = async (pg, k) => {
  await pg.locator('[data-eg-actions]:visible').first().waitFor({ timeout: 15000 }).catch(() => {});
  await geste(pg, true, '[data-eg-actions]'); await geste(pg, true, `[data-eg-action="${k}"]`);
  return pg.waitForFunction((k) => !!document.querySelector(`[data-eg-ecran][data-eg-selection="${k}"]`), k, { timeout: 5000 }).then(() => true).catch(() => false); };
const cocher = async (pg, tel, id) => (tel ? geste(pg, true, `[data-eg-article="vinted#${id}"]`) : pg.evaluate((id) => { const l = [...document.querySelectorAll('[data-tt-ligne]')].find((x) => x.getAttribute('data-eg-article') === 'vinted#' + id && x.getClientRects().length); const c = l && l.querySelector('[data-tt-coche], input[type="checkbox"]'); if (c) c.click(); return !!c; }, id));
const lancer = (pg, tel, k) => pg.evaluate(([tel, k]) => { const b = [...document.querySelectorAll(tel ? `[data-eg-lancer="${k}"]` : `[data-tt-action-directe="${k}"]`)].find((x) => x.getClientRects().length);
  // La raison d'un bouton éteint : le texte posé À CÔTÉ de lui (src/natif/Bouton.jsx `raison`), pas son libellé.
  const t = (x) => ((x && x.innerText) || '').replace(/\s+/g, ' ').trim();
  return b ? { off: b.getAttribute('aria-disabled') === 'true', n: b.getAttribute('data-eg-n') || b.getAttribute('data-tt-lancer-n'), raison: t(b.parentElement).replace(t(b), '').trim() } : null; }, [tel, k]);
// Les écritures parties vers la base (une commande pour l'extension, `cmd_*`) : rien ne part sans SA confirmation.
const ecrituresDe = (u) => u.filter((x) => /republier|recreer|cmd_|file_/i.test(x)).length;

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: CHROMIUM, args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      for (const sombre of [false, true]) {
        const T = `${vp.width}${sombre ? ' sombre' : ' clair'}`, tel = vp.width < 600;
        const nomF = (x) => path.join(SHOTS, `annonces-actions-${vp.width}-${sombre ? 'sombre' : 'clair'}-${x}.png`);
        console.log(`── ${T}`);
        const etat = { sans9102: false, sans9110: false };
        const { ctx, pg, errs } = await contexte(b, vp, sombre, etat);
        const ecrits = []; pg.on('request', (r) => { if (r.method() !== 'GET' && /\/rest\/v1\//.test(r.url())) ecrits.push(r.url() + ' ' + (r.postData() || '').slice(0, 300)); });
        try {
          await pg.goto(`http://localhost:${PORT}/?tab=cat_annonces`, { waitUntil: 'domcontentloaded' });
          await pg.waitForFunction(() => [...document.querySelectorAll('[data-eg-article]')].some((x) => x.getClientRects().length), null, { timeout: 20000 }).catch(() => {});
          await pg.waitForTimeout(1200);
          dit((await pg.evaluate(() => document.documentElement.getAttribute('data-theme'))) === (sombre ? 'dark' : 'light'), `F ${T} thème ${sombre ? 'sombre' : 'clair'} posé`);
          // S — en ligne et MASQUÉES (« En ligne »), BROUILLONS (« À publier »), chacun sous SON compte, avec son état.
          const L = Object.fromEntries((await articles(pg)).map((a) => [a.id, a]));
          dit(L['9102'] && L['9102'].etat === 'enligne' && L['9110'] && L['9110'].etat === 'masquee' && L['9102'].compte === 'vinted:111' && L['9301'] && L['9301'].compte === 'vinted:222', `S ${T} en ligne et masquée, chacune avec son état et SON compte`, JSON.stringify(Object.values(L).map((a) => a.id + ':' + a.etat + ':' + a.compte)));
          if (tel) dit(Object.values(L).every((a) => a.groupe === a.compte), `S ${T} rangées PAR COMPTE (chaque annonce sous le groupe de son compte)`, JSON.stringify(Object.values(L).map((a) => a.id + '→' + a.groupe)));
          await pg.screenshot({ path: nomF('liste') });
          // Au téléphone, le segment « À publier » ; à l'ordinateur le tableau filtre les états par « Statut » (brouillons hors du
          // filtre par défaut : « 1 sur 2 annonces » sous autre_compte) — les brouillons par compte se jugent au téléphone.
          if (tel) {
            await segment(pg, tel, 'apublier');
            await pg.waitForFunction(() => [...document.querySelectorAll('[data-eg-article="vinted#9201"], [data-eg-article="vinted#9302"]')].some((x) => x.getClientRects().length), null, { timeout: 8000 }).catch(() => {});
            const B = Object.fromEntries((await articles(pg)).map((a) => [a.id, a]));
            dit(B['9201'] && B['9201'].compte === 'vinted:111' && B['9302'] && B['9302'].compte === 'vinted:222' && B['9302'].groupe === 'vinted:222' && B['9201'].groupe === 'vinted:111', `S ${T} brouillons sous « À publier » : celui du second compte sous SON compte, jamais sous l’autre`, JSON.stringify(Object.values(B).map((a) => a.id + ':' + a.compte + '→' + a.groupe)));
            await segment(pg, tel, 'enligne');
          }
          if (tel) {
            // A — « Republier » (une action au nom d'un compte) : deux comptes ⇒ rien ne se lance, la raison dite.
            await modeAction(pg, 'recreer');
            await cocher(pg, tel, '9110');
            let M = Object.fromEntries((await articles(pg)).map((a) => [a.id, a]));
            dit(M['9110'] && M['9110'].grise && M['9110'].coche === '0', `A ${T} Republier : une masquée ne se coche pas (grisée)`, JSON.stringify(M['9110']));
            // S — « en vérification par Vinted » (lu : `is_processing`) : là, ne se coche pas, et SA rangée dit pourquoi (`data-ad-raison`).
            await cocher(pg, tel, '9104');
            M = Object.fromEntries((await articles(pg)).map((a) => [a.id, a]));
            const raison9104 = await pg.evaluate(() => { const x = [...document.querySelectorAll('[data-eg-article="vinted#9104"]')].find((e) => e.getClientRects().length); const r = x && x.querySelector('[data-ad-raison]'); return r && r.getClientRects().length ? r.textContent.trim() : ''; });
            dit(M['9104'] && M['9104'].grise && M['9104'].coche === '0' && /Vinted/.test(raison9104), `S ${T} « en vérification par Vinted » : là, ne se coche pas, et dit pourquoi`, JSON.stringify({ a: M['9104'], raison9104 }));
            await cocher(pg, tel, '9102'); await cocher(pg, tel, '9301');
            let l = await lancer(pg, tel, 'recreer');
            dit(!!l && l.off && l.n === '2' && l.raison.length > 5, `A ${T} deux comptes mélangés ⇒ « Republier » ne se lance pas, la raison dite`, JSON.stringify(l));
            await pg.screenshot({ path: nomF('deux-comptes') });
            await cocher(pg, tel, '9301'); await cocher(pg, tel, '9103');
            l = await lancer(pg, tel, 'recreer');
            dit(!!l && !l.off && l.n === '2', `A ${T} deux annonces en ligne du même compte ⇒ « Republier · 2 » se lance`, JSON.stringify(l));
            // R — lancer : SA confirmation d'abord ; « Annuler » ⇒ rien n'est parti.
            const avant = ecrituresDe(ecrits);
            await geste(pg, tel, '[data-eg-lancer="recreer"]');
            await pg.waitForTimeout(800);
            const conf = await pg.evaluate(() => { const d = [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')].find((x) => x.getClientRects().length); return d ? d.innerText.replace(/\s+/g, ' ').slice(0, 160) : ''; });
            await pg.screenshot({ path: nomF('confirmer') });
            dit(/2/.test(conf) && ecrituresDe(ecrits) === avant && (await pg.evaluate(() => window.__envois.length)) === 0, `R ${T} lancer demande SA confirmation (« · 2 ») — rien n’est parti avant`, conf);
            const annuler = pg.locator('[role="dialog"]:visible button, [role="alertdialog"]:visible button').first();
            await annuler.click().catch(() => {}); await pg.waitForTimeout(800);
            dit(ecrituresDe(ecrits) === avant && (await pg.evaluate(() => window.__envois.length)) === 0, `R ${T} « Annuler » ⇒ rien n’est parti`, ecrits.slice(-3).join(' | '));
            // A — « Remettre en ligne » : seuls les brouillons se cochent.
            await pg.goto(`http://localhost:${PORT}/?tab=cat_annonces`, { waitUntil: 'domcontentloaded' });
            await pg.waitForFunction(() => [...document.querySelectorAll('[data-eg-article]')].some((x) => x.getClientRects().length), null, { timeout: 20000 }).catch(() => {});
            await segment(pg, tel, 'enligne');
            await modeAction(pg, 'enLigne');
            await cocher(pg, tel, '9102');
            M = Object.fromEntries((await articles(pg)).map((a) => [a.id, a]));
            dit(M['9102'] && M['9102'].grise && M['9102'].coche === '0', `A ${T} « brouillon → en ligne » : une annonce en ligne ne se coche pas`, JSON.stringify(M['9102']));
            await segment(pg, tel, 'apublier');
            await cocher(pg, tel, '9201');
            M = Object.fromEntries((await articles(pg)).map((a) => [a.id, a]));
            l = await lancer(pg, tel, 'enLigne');
            dit(M['9201'] && M['9201'].coche === '1' && !!l && !l.off, `A ${T} un brouillon ⇒ « Remettre en ligne » se coche et se lance`, JSON.stringify({ a: M['9201'], l }));
            // M — « Republier à la main » : deux comptes permis (une paire à la fois, chacune avec son compte).
            await pg.goto(`http://localhost:${PORT}/?tab=cat_annonces`, { waitUntil: 'domcontentloaded' });
            await pg.waitForFunction(() => [...document.querySelectorAll('[data-eg-article]')].some((x) => x.getClientRects().length), null, { timeout: 20000 }).catch(() => {});
            await segment(pg, tel, 'enligne');
            await modeAction(pg, 'main');
            await cocher(pg, tel, '9110'); await cocher(pg, tel, '9301');
            l = await lancer(pg, tel, 'main');
            dit(!!l && !l.off && l.n === '2', `A ${T} « à la main » : une masquée et deux comptes, possible (une à la fois)`, JSON.stringify(l));
            await cocher(pg, tel, '9110'); await cocher(pg, tel, '9301'); await cocher(pg, tel, '9102');
            await geste(pg, tel, '[data-eg-lancer="main"]');
            // (26 nov.) La feuille « à la main » est un GUIDE par étapes (src/ecrans/Republier.jsx `RepublierALaMain` : Photos ·
            // Supprimer · Créer · Fini, `[data-rg-etapes]`, `[data-main-aller]`) : les champs à copier vivent dans l'étape qui les montre.
            await pg.waitForSelector('[data-rg-etapes]', { timeout: 8000 }).catch(() => {});
            for (let i = 0; i < 20; i++) { if (!(await pg.$('[data-main-lecture]'))) break; await pg.waitForTimeout(200); }
            const etapes = String(await pg.getAttribute('[data-rg-etapes]', 'data-rg-etapes').catch(() => '') || '').split(',').filter(Boolean);
            const photosN = await pg.getAttribute('[data-main-photos]', 'data-main-photos').catch(() => null);
            for (const k of etapes) { await geste(pg, tel, `[data-main-aller="${k}"]`); if (await pg.locator('[data-main-champ="titre"]:visible').count()) break; }
            const champs = await pg.$$eval('[data-main-champ]', (x) => Object.fromEntries(x.filter((e) => e.getClientRects().length).map((e) => [e.getAttribute('data-main-champ'), e.textContent])));
            dit(/Salomon XT-6/.test(champs.titre || '') && /boîte d’origine/.test(champs.description || champs.desc || '') && /49/.test(champs.prix || ''), `M ${T} titre, description et prix prêts à copier (le coffre de CETTE annonce)`, JSON.stringify(Object.keys(champs)));
            dit(await pg.locator('[data-main-copier]:visible').count() >= 3 && photosN === '2', `M ${T} boutons « Copier » et les 2 photos du coffre`, JSON.stringify({ etapes, photosN }));
            if (etapes.length) await geste(pg, tel, `[data-main-aller="${etapes[etapes.length - 1]}"]`);
            const [pop] = await Promise.all([pg.context().waitForEvent('page', { timeout: 5000 }).catch(() => null), geste(pg, tel, '[data-main-ouvrir-vinted]')]);
            if (pop) await pop.close().catch(() => {});
            await pg.waitForSelector('[data-main-candidat]', { timeout: 5000 }).catch(() => {});
            const cands = await pg.$$eval('[data-main-candidat]', (x) => x.map((e) => e.getAttribute('data-main-candidat')));
            dit(cands.includes('9120') && !cands.includes('9301') && !cands.includes('9102') && !cands.includes('9103'), `M ${T} proposées : la nouvelle du MÊME compte ; jamais celle de même titre de l’autre compte, ni l’ancienne, ni une autre numérotée`, cands.join(','));
            await pg.screenshot({ path: nomF('main') });
            await geste(pg, tel, '[data-main-lier="9120"]');
            { const oui = pg.locator('button', { hasText: 'Oui, c’est elle' }).last(); await oui.waitFor({ state: 'visible', timeout: 4000 }).catch(() => {}); await oui.click({ timeout: 4000 }).catch(async () => { if (await oui.count()) await oui.evaluate((x) => x.click(), null, { timeout: 4000 }).catch(() => {}); }); }
            await pg.waitForSelector('[data-main-lie="9120"]', { timeout: 4000 }).catch(() => {});
            dit(await pg.locator('[data-main-lie="9120"]').count() > 0, `M ${T} SON clic relie la nouvelle annonce (confirmée)`);
            // K/M — le N° : tant que l'ancienne est en ligne, le N°42 reste à elle seule (jamais deux annonces sous un N°).
            for (let i = 0; i < 40; i++) { if (await pg.evaluate(() => /"9102":\{[^}]*"nouvelId":"9120"/.test(localStorage.getItem('vrm_repub_main') || ''))) break; await pg.waitForTimeout(250); }
            await nouvelleOuverture(pg);
            await pg.goto(`http://localhost:${PORT}/?tab=cat_annonces`, { waitUntil: 'domcontentloaded' });
            await pg.waitForFunction(() => [...document.querySelectorAll('[data-eg-article]')].some((x) => x.getClientRects().length), null, { timeout: 20000 }).catch(() => {});
            await pg.waitForTimeout(1500);
            // (27 nov.) Sous charge, les rangées montrées d'abord n'avaient pas encore leurs N° (« » rendu, rouge à tort) : on attend
            // qu'une rangée porte le N°42, 10 s au plus (§6.5) ; deux porteurs, ou la nouvelle seule, restent rouges.
            let n42 = [];
            for (let i = 0; i < 40; i++) { n42 = (await articles(pg)).filter((a) => a.numero === '42').map((a) => a.id); if (n42.length) break; await pg.waitForTimeout(250); }
            dit(n42.length === 1 && n42[0] === '9102', `M ${T} tant que l’ancienne est en ligne, le N°42 reste à elle seule`, n42.join(','));
            etat.sans9102 = true;
            await nouvelleOuverture(pg);
            await pg.goto(`http://localhost:${PORT}/?tab=cat_annonces`, { waitUntil: 'domcontentloaded' });
            await pg.waitForFunction(() => [...document.querySelectorAll('[data-eg-article]')].some((x) => x.getClientRects().length), null, { timeout: 20000 }).catch(() => {});
            let n = '';
            for (let i = 0; i < 30; i++) { n = ((await articles(pg)).find((a) => a.id === '9120') || {}).numero || ''; if (n === '42') break; await pg.waitForTimeout(250); }
            await pg.screenshot({ path: nomF('apres') });
            // L'écran rouvert peut d'abord montrer SON instantané (affichage instantané, 20 nov.), puis la lecture fraîche : on attend
            // celle-ci (la nouvelle porte le N°42 ET l'ancienne fermée n'est plus en ligne), 10 s au plus (§6.5).
            let porteurs = [];
            for (let i = 0; i < 40; i++) { porteurs = (await articles(pg)).filter((a) => a.numero === '42').map((a) => a.id + ':' + a.etat); if (porteurs.length === 1) break; await pg.waitForTimeout(250); }
            dit(n === '42' && porteurs.length === 1, `M ${T} l’ancienne partie ⇒ la nouvelle porte le N°42 (une seule fois)`, JSON.stringify({ n, porteurs }));
          } else {
            // A (ordinateur) — le tableau : la sélection, puis les actions directes du bas (`data-tt-action-directe`).
            // S — « en vérification par Vinted » : cochée seule, aucune action Vinted ne la prend (« Republier » éteint, rien compté).
            {
              const L0 = Object.fromEntries((await articles(pg)).map((a) => [a.id, a]));
              await cocher(pg, tel, '9104');
              const l0 = await lancer(pg, tel, 'recreer');
              dit(!!L0['9104'] && !!l0 && l0.off && l0.n !== '1', `S ${T} « en vérification par Vinted » : là, et « Republier » ne la prend pas`, JSON.stringify({ vue: !!L0['9104'], l0 }));
              await cocher(pg, tel, '9104');
            }
            await cocher(pg, tel, '9102'); await cocher(pg, tel, '9301');
            let l = await lancer(pg, tel, 'recreer');
            dit(!!l && l.off && l.n === '2', `A ${T} deux comptes mélangés ⇒ « Republier » ne se lance pas`, JSON.stringify(l));
            await pg.screenshot({ path: nomF('deux-comptes') });
            await cocher(pg, tel, '9301'); await cocher(pg, tel, '9103');
            l = await lancer(pg, tel, 'recreer');
            dit(!!l && !l.off && l.n === '2', `A ${T} deux annonces en ligne du même compte ⇒ « Republier · 2 » se lance`, JSON.stringify(l));
            const avant = ecrituresDe(ecrits);
            await geste(pg, tel, '[data-tt-action-directe="recreer"]');
            await pg.waitForTimeout(800);
            const conf = await pg.evaluate(() => { const d = [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')].find((x) => x.getClientRects().length); return d ? d.innerText.replace(/\s+/g, ' ').slice(0, 160) : ''; });
            await pg.screenshot({ path: nomF('confirmer') });
            dit(/2/.test(conf) && ecrituresDe(ecrits) === avant && (await pg.evaluate(() => window.__envois.length)) === 0, `R ${T} lancer demande SA confirmation (« · 2 ») — rien n’est parti avant`, conf);
            await pg.keyboard.press('Escape'); await pg.waitForTimeout(600);
            dit(ecrituresDe(ecrits) === avant && (await pg.evaluate(() => window.__envois.length)) === 0, `R ${T} refermée sans « Oui » ⇒ rien n’est parti`, ecrits.slice(-3).join(' | '));
          }
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
