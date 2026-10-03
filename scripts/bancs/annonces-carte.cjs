// Banc : LA CARTE D'ANNONCE (3 octobre).
//
// Julien : « c'est totalement n'importe quoi ; on ne sait pas sur quelle
// application, c'est quoi le prix, le boost ». Mesuré : 70 cartes sur 71
// affichaient la MARQUE au lieu du titre, quatre montants dont deux sans
// libellé, six teintes, le sommeil dit trois fois, et la pastille « prête »
// valait « à capter » partout par construction.
// Sur des données INVENTÉES (il vit dans le dépôt), aux deux tailles, il exige :
//   · le TITRE est sur la carte (pas seulement la marque) ;
//   · le prix est le seul grand chiffre ; l'achat, le boost et la marge sont
//     LIBELLÉS, et un achat inconnu s'écrit « — » ;
//   · « Boostée » quand Vinted le dit (`promoted:true`) — et RIEN quand il ne
//     le dit pas (`promoted` absent ≠ « non boostée ») ;
//   · « Aussi sur Leboncoin » seulement pour la paire PROUVÉE publiée ;
//   · le sommeil n'est dit qu'UNE fois par carte ;
//   · la pastille de préparation suit la DONNÉE (6/6 photos + description ⇒
//     « prête », 2/6 ⇒ « 2/6 ») ;
//   · « Vendue » vient de l'IDENTITÉ (transaction → annonce), pas du titre :
//     deux annonces au même titre, un bordereau, une seule marquée ;
//   · aucune couleur hors palette (#0F8A6A, #09B1BA, orange Leboncoin) ;
//   · aucun débordement à 390 px.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = 4338;
const auj = new Date();
const ilYa = (j) => Math.floor((Date.now() - j * 86400000) / 1000);
const ann = (id, o) => Object.assign({ id, price: { amount: '49.0', currency_code: 'EUR' }, is_closed: false, is_draft: false, photo: null, brand_title: 'Nike', size_title: '42', status: 'Très bon état', view_count: 40, favourite_count: 2 }, o);
const ITEMS = [
  ann(9101, { title: 'Nike Air Max 1 obsidian lilac taille 42', promoted: true, nPhotos: 6, created_at_ts: ilYa(45) }),
  ann(9102, { title: 'Salomon XT-6 blanc taille 40', brand_title: 'Salomon', nPhotos: 6, created_at_ts: ilYa(3) }),
  ann(9103, { title: 'Adidas Spezial noir taille 38', brand_title: 'Adidas', nPhotos: 6, created_at_ts: ilYa(5) }),
  ann(9104, { title: 'Adidas Spezial noir taille 38', brand_title: 'Adidas', nPhotos: 6, created_at_ts: ilYa(6) }),   // même titre que 9103
];
const MAIN = { vinted_annonce_numeros: {
  '9101': { numero: '41', buyPrice: '25', fees: '1.95' },
  '9102': { numero: '42' },
  '9103': { numero: '43' },
  '9104': { numero: '44' },
} };
const DETAILS = { '9101': { photos: ['a', 'b', 'c', 'd', 'e', 'f'], description: 'Très bon état.' }, '9102': { photos: ['a', 'b'] } };
const rows = [
  { id: 'main', data: MAIN },
  { id: 'harvest_111_listings', data: { capturedAt: auj.toISOString(), payload: { items: ITEMS } } },
  { id: 'vinted_item_details', data: DETAILS },
  { id: 'vinted_lbc_posted', data: { ids: ['9102'] } },
  // Un bordereau pour la transaction 777, que Vinted relie à l'annonce 9104.
  { id: 'email_bord_777', data: { transaction: '777', modele: 'Adidas Spezial noir taille 38', receivedAt: auj.toISOString(), filename: 'b.pdf' } },
  { id: 'harvest_111_txn_777', data: { payload: { transaction: { id: 777, item_id: 9104, status_title: 'Commande finalisée' } } } },
];
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];
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
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      console.log(`── ${vp.width} px`);
      const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
      const pg = await ctx.newPage();
      const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
      await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
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
      await pg.goto(`http://localhost:${PORT}/?tab=cat_annonces`, { waitUntil: 'domcontentloaded' });
      await pg.waitForTimeout(4000);
      const c = await pg.evaluate(() => {
        const carte = (id) => { const el = document.querySelector(`[data-carte-annonce="${id}"]`); return el ? { t: el.innerText, html: el.outerHTML, boost: !!el.querySelector('[data-boostee]'), aussi: !!el.querySelector('[data-aussi-sur]'), prepa: (el.querySelector('[data-prepa]') || {}).textContent || '' } : null; };
        return { a: carte('9101'), b: carte('9102'), c: carte('9103'), d: carte('9104'), sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
      });
      dit(!errs.length, 'aucune erreur', errs[0]);
      // 9104 est VENDUE (son bordereau la désigne par transaction → annonce) :
      // elle sort des annonces ; 9103, au MÊME titre, reste. C'est l'identité
      // qui tranche, pas la ressemblance (§5).
      dit(!!c.c && !c.d, '« vendue » par IDENTITÉ : deux annonces au même titre, un bordereau — seule la bonne sort des annonces', `9103:${!!c.c} 9104:${!!c.d}`);
      dit(!!c.a && !!c.b && !!c.c, 'les trois cartes en ligne sont rendues');
      if (!c.a || !c.b || !c.c) { await pg.screenshot({ path: path.join(require('os').tmpdir(), 'annonces-dbg-' + vp.width + '.png') }); console.log((await pg.evaluate(() => document.body.innerText)).slice(0, 600)); await ctx.close(); continue; }
      dit(/obsidian lilac/.test(c.a.t), 'le TITRE est sur la carte, pas seulement la marque', c.a.t.split('\n').slice(0, 3).join(' · '));
      dit(/achat\s*25,00/.test(c.a.t) && /boost\s*1,95/.test(c.a.t) && /marge\s*\+22/.test(c.a.t), 'achat, boost et marge sont LIBELLÉS (49 − 25 − 1,95 ≈ +22)', (c.a.t.match(/achat[^\n]*/) || [''])[0]);
      dit(/achat\s*—/.test(c.b.t) && !/achat\s*0,00/.test(c.b.t), 'achat inconnu ⇒ « — », jamais 0');
      dit(c.a.boost && !c.b.boost, '« Boostée » quand Vinted le dit, et rien quand il ne dit rien');
      dit(c.b.aussi && !c.a.aussi, '« Aussi sur Leboncoin » seulement pour la paire PROUVÉE publiée');
      dit((c.a.t.match(/dort/g) || []).length === 1 && !/😴/.test(c.a.t), 'le sommeil n\'est dit qu\'UNE fois sur la carte', (c.a.t.match(/[^\n]*dort[^\n]*/g) || []).join(' | '));
      dit(/prête/.test(c.a.prepa) && /2\/6/.test(c.b.prepa), 'la préparation suit la DONNÉE (6/6 ⇒ prête, 2/6 ⇒ « 2/6 »)', `« ${c.a.prepa} » / « ${c.b.prepa} »`);
      dit(!/Vendue — bordereau/.test(c.c.t), 'et sa jumelle au même titre n\'est PAS marquée vendue');
      const horsPalette = /#0F8A6A|#09B1BA|#EC5A13|rgb\(15, 138, 106\)|rgb\(9, 177, 186\)|rgb\(236, 90, 19\)/i;
      dit(![c.a, c.b, c.c].some((x) => horsPalette.test(x.html)), 'aucune couleur hors palette sur les cartes (§7)');
      dit(c.sw <= c.cw + 1, 'aucun débordement horizontal', `${c.sw} > ${c.cw}`);
      // 3 octobre (« trop brouillon ») : le N° et l'achat ne sont plus écrits deux
      // fois (texte + champ) ; le TEXTE se modifie en place. On le prouve en le
      // modifiant pour de vrai.
      const visibles = await pg.evaluate(() => [...document.querySelectorAll('[data-carte-annonce="9102"] input')].filter((i) => i.offsetParent !== null && !i.closest('details')).map((i) => (i.closest('div') || {}).innerText + '|' + i.placeholder));
      dit(visibles.length === 0, 'au repos, aucune ligne de saisie sous la carte (le N° et l’achat ne sont écrits qu’une fois)', JSON.stringify(visibles));
      try {
        await pg.click('[data-carte-annonce="9102"] [data-edition="achat"]', { timeout: 4000 });
        await pg.keyboard.type('30');
        await pg.keyboard.press('Enter');
        await pg.waitForTimeout(500);
      } catch (e) { dit(false, 'l’achat se modifie en place (texte cliquable)', String(e.message).slice(0, 80)); }
      const apres = await pg.evaluate(() => (document.querySelector('[data-carte-annonce="9102"]') || {}).innerText || '');
      dit(/achat\s*30,00/.test(apres), 'cliquer sur « achat — », taper 30, Entrée : la carte dit « achat 30,00 € »', (apres.match(/achat[^\n]*/) || [''])[0]);
      await pg.screenshot({ path: path.join(require('os').tmpdir(), 'annonces-' + vp.width + '.png') });
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e.message).slice(0, 160)); }
  if (b) await b.close(); srv.close();
  console.log(`\n${ko ? '❌' : '✅'} carte d'annonce : ${ko ? ko + ' rouge(s)' : 'tout est vert'}`);
  process.exit(ko ? 1 : 0);
})();
