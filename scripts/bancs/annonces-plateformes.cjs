// Banc : OÙ EST CHAQUE PAIRE — logos de plateforme, statut par compte, filtres,
// et l'onglet VESTIAIRE COLLECTIVE (15 octobre). Données INVENTÉES : il vit dans
// le dépôt.
//
// Julien, 15 octobre : « continue à améliorer l'onglet Annonces ; on ne sait pas
// sur quelle plateforme est postée chaque annonce : mets un petit logo à côté »,
// puis « l'onglet Vestiaire doit être marqué Vestiaire Collective ; bientôt :
// préparer les achats, les ventes ; la mise en page exactement la même que
// Leboncoin, eBay, Vinted ».
// Aux deux tailles, en clair (et en sombre pour la capture), il exige :
//   · un logo par plateforme où la paire est PROUVÉE en ligne : Vinted (la
//     carte), Leboncoin (une annonce À LUI dont la référence est le N°), eBay
//     (le SKU VRM-{n°}) — et RIEN sur une annonce d'autrui au même titre, ni
//     sur une annonce eBay sans SKU au même titre ;
//   · une publication Leboncoin seulement DEMANDÉE (`vinted_lbc_posted`) : pas
//     de logo, les mots « à vérifier » ;
//   · le compte nommé quand il distingue (deux comptes Vinted) ;
//   · les filtres par plateforme n'existent que s'ils trouvent quelque chose,
//     portent le bon nombre, et filtrent pour de vrai ;
//   · la fiche (« Gérer l'annonce ») donne le statut par plateforme ET par
//     compte, avec le lien vers l'annonce ;
//   · Leboncoin illisible (522) : aucun logo Leboncoin inventé, UNE ligne qui le
//     dit, et pas de filtre « Seulement Vinted » (ce serait « pas su ») ;
//   · Vestiaire Collective : le nom complet (navigation et en-tête), les mêmes
//     sections que les autres (Ventes · Achats · Annonces · Compte),
//     « Bientôt disponible » sur les trois qui ne marchent pas et JAMAIS sur
//     Compte (la mesure, elle, marche), aucun montant ;
//   · aucune couleur de marque en dur (§7), aucun débordement, aucun écran tombé.
// Port 5921 (réservé à ce lot). `BANC_CAPTURES=dossier` garde les captures.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.PORT) || 5921;
const CAPT = process.env.BANC_CAPTURES || '';
const auj = new Date();
const ilYa = (j) => Math.floor((Date.now() - j * 86400000) / 1000);
const ann = (id, o) => Object.assign({ id, price: { amount: '59.0', currency_code: 'EUR' }, is_closed: false, is_draft: false, photo: null, brand_title: 'Nike', size_title: '42', status: 'Très bon état', view_count: 12, favourite_count: 1, nPhotos: 4, created_at_ts: ilYa(6), url: `https://www.vinted.fr/items/${id}` }, o);
const ITEMS_A = [
  ann(9201, { title: 'Salomon XT-6 blanc taille 40', brand_title: 'Salomon' }),   // N°21 : aussi sur Leboncoin (sa référence)
  ann(9202, { title: 'Adidas Spezial noir taille 38', brand_title: 'Adidas' }),   // N°22 : aussi sur eBay (SKU)
  ann(9203, { title: 'Nike Dunk low panda taille 41' }),                          // N°23 : Leboncoin DEMANDÉ seulement
  ann(9204, { title: 'Converse Chuck 70 noir taille 39', brand_title: 'Converse' }), // N°24 : nulle part ailleurs (sosies)
  ann(9205, { title: 'Asics Gel-Kayano 14 argent taille 43', brand_title: 'Asics' }), // N°25 : Leboncoin ET eBay
];
const ITEMS_B = [ann(9206, { title: 'Puma Suede gris taille 41', brand_title: 'Puma' })]; // N°26, autre compte
const MAIN = { vinted_annonce_numeros: { 9201: { numero: '21' }, 9202: { numero: '22' }, 9203: { numero: '23' }, 9204: { numero: '24' }, 9205: { numero: '25' }, 9206: { numero: '26' } } };
const LBC = { items: {
  '6101': { id: 6101, status: 'active', ref: '21', lbcUser: 'u-moi', accountName: 'Moi_LBC', subject: 'Salomon XT-6 blanc 40', url: 'https://www.leboncoin.fr/ad/chaussures/6101', seenAt: new Date(Date.now() - 5 * 86400000).toISOString() },
  '6105': { id: 6105, status: 'active', ref: '25', lbcUser: 'u-moi', accountName: 'Moi_LBC', subject: 'Asics Kayano 14', url: 'https://www.leboncoin.fr/ad/chaussures/6105', seenAt: auj.toISOString() },
  // Une annonce d'AUTRUI au MÊME titre que la N°24 : ne désigne rien (§5).
  '6199': { id: 6199, status: 'active', account: 'inconnu', accountName: 'Quelqu_un', subject: 'Converse Chuck 70 noir taille 39', url: 'https://www.leboncoin.fr/ad/chaussures/6199' },
} };
const EBAY = { capturedAt: Date.now(), items: [
  { itemId: '8802', sku: 'VRM-22', qty: '1', price: '65.00', title: 'Adidas Spezial noir 38', url: 'https://www.ebay.fr/itm/8802' },
  { itemId: '8805', sku: 'VRM-25', qty: '1', price: '70.00', title: 'Asics Gel-Kayano 14', url: 'https://www.ebay.fr/itm/8805' },
  // Sans SKU de paire, au MÊME titre que la N°24 : ne désigne rien (§5).
  { itemId: '8899', sku: '', qty: '1', price: '40.00', title: 'Converse Chuck 70 noir taille 39' },
] };
const rows = [
  { id: 'main', data: MAIN },
  { id: 'harvest_111_listings', data: { capturedAt: auj.toISOString(), payload: { items: ITEMS_A } } },
  { id: 'harvest_222_listings', data: { capturedAt: auj.toISOString(), payload: { items: ITEMS_B } } },
  { id: 'vinted_lbc_posted', data: { ids: ['9203'] } },
  { id: 'lbc_listings', data: LBC },
  { id: 'lbc_ventes', data: { ventes: {} } },
  { id: 'ebay_listings', data: EBAY },
];
const ACCS = [
  { id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: auj.toISOString() },
  { id: 2, vinted_user_id: '222', login: 'compte_b', domain: 'www.vinted.fr', updated_at: auj.toISOString() },
];
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
    out[alias] = v == null ? null : (src.includes('->>') && typeof v === 'object' ? JSON.stringify(v) : (src.includes('->>') ? String(v) : v));
  }
  return out;
};
const ouvrir = async (b, vp, { sombre = false, lbcKO = false, url }) => {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); if (s) { localStorage.setItem('vinted_dark', 'true'); localStorage.setItem('vrm_bascule_mineral_v1', '1'); } } catch (_) {} }, sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    if (lbcKO && /id=eq\.lbc_listings/.test(u)) return route.fulfill({ status: 522, contentType: 'text/html', headers: { 'access-control-allow-origin': '*' }, body: '<html>522</html>' });
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data|^data$|^data,/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: auj.toISOString(), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/${url}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs };
};
const capture = async (pg, nom) => { if (!CAPT) return; fs.mkdirSync(CAPT, { recursive: true }); await pg.screenshot({ path: path.join(CAPT, nom + '.png'), fullPage: false }); };
const cartes = (pg) => pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-carte-annonce]')].map((el) => {
  const pl = el.querySelector('[data-plateformes]');
  return [el.getAttribute('data-carte-annonce'), {
    plats: pl ? (pl.getAttribute('data-plateformes') || '').split(' ').filter(Boolean) : null,
    imgs: pl ? [...pl.querySelectorAll('img')].map((i) => (i.getAttribute('src') || '').replace(/.*\//, '')) : [],
    ligne: pl ? pl.innerText : '', demandee: !!el.querySelector('[data-lbc-demandee]'), t: el.innerText, html: el.outerHTML,
    liens: pl ? Object.fromEntries([...pl.querySelectorAll('[data-plateforme]')].map((x) => [x.getAttribute('data-plateforme'), x.tagName === 'A' ? x.href : ''])) : {},
  }];
})));
const filtres = (pg) => pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-filtre-plateforme]')].map((b) => [b.getAttribute('data-filtre-plateforme'), b.innerText.trim()])));
const visibles = (pg) => pg.evaluate(() => [...document.querySelectorAll('[data-carte-annonce]')].map((e) => e.getAttribute('data-carte-annonce')).sort());
const nCarte = (t) => Number((String(t).match(/(\d+)\s*$/) || [])[1]);

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      console.log(`── Annonces · ${vp.width} px`);
      const { ctx, pg, errs } = await ouvrir(b, vp, { url: '?tab=cat_annonces' });
      await pg.waitForSelector('[data-carte-annonce="9201"]', { timeout: 15000 }).catch(() => {});
      await pg.waitForTimeout(2500);
      await capture(pg, `annonces-${vp.width}-clair`);
      const c = await cartes(pg);
      const P = (id) => (c[id] && c[id].plats) || [];
      dit(!!c['9201'] && !!c['9206'], 'les six cartes sont rendues', Object.keys(c).join(','));
      dit(Object.values(c).every((x) => x.plats && x.plats.includes('vinted')), 'chaque carte porte le logo Vinted (la paire EST en ligne sur Vinted)', JSON.stringify(Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v.plats]))));
      dit(P('9201').join() === 'vinted,lbc', 'N°21 : logo Leboncoin (une annonce À LUI dont la référence est 21), pas eBay', P('9201').join());
      dit(P('9202').join() === 'vinted,ebay', 'N°22 : logo eBay (SKU VRM-22), pas Leboncoin', P('9202').join());
      dit(P('9205').join() === 'vinted,lbc,ebay', 'N°25 : Leboncoin ET eBay, dans cet ordre', P('9205').join());
      dit(P('9204').join() === 'vinted', 'N°24 : RIEN ailleurs — ni l’annonce Leboncoin d’autrui, ni l’annonce eBay sans SKU, au même titre (§5)', P('9204').join());
      dit(P('9203').join() === 'vinted' && c['9203'] && c['9203'].demandee && /Leboncoin à vérifier/.test(c['9203'].ligne), 'N°23 : publication Leboncoin seulement DEMANDÉE ⇒ pas de logo, « Leboncoin à vérifier »', c['9203'] && c['9203'].ligne);
      dit(c['9205'] && /leboncoin\.fr\/ad\/chaussures\/6105/.test(c['9205'].liens.lbc || '') && /ebay\.fr\/itm\/8805/.test(c['9205'].liens.ebay || '') && /vinted\.fr\/items\/9205/.test(c['9205'].liens.vinted || ''),
        'chaque logo OUVRE l’annonce sur sa plateforme (un geste direct)', JSON.stringify(c['9205'] && c['9205'].liens));
      dit(c['9201'] && c['9201'].imgs.join() === 'vinted.svg,leboncoin.svg', 'ce sont de VRAIS logos (les fichiers de la marque, monochromes)', c['9201'] && c['9201'].imgs.join());
      dit(/compte_a/.test((c['9201'] || {}).ligne) && /compte_b/.test((c['9206'] || {}).ligne), 'deux comptes Vinted : le compte est nommé à côté du logo', `${(c['9201'] || {}).ligne} | ${(c['9206'] || {}).ligne}`);
      dit(!/Moi_LBC/.test((c['9201'] || {}).ligne), 'un seul compte Leboncoin : il n’est pas répété sur chaque carte (§7)', (c['9201'] || {}).ligne);
      dit(!Object.values(c).some((x) => /data-aussi-sur/.test(x.html)), 'l’ancienne ligne « Aussi sur Leboncoin » (déduite d’un clic) n’existe plus');
      const horsPalette = /#09B1BA|#EC5A13|#3665F3|rgb\(9, 177, 186\)|rgb\(236, 90, 19\)|rgb\(54, 101, 243\)/i;
      dit(!Object.values(c).some((x) => horsPalette.test(x.html)), 'aucune couleur de marque en dur sur les cartes (§7 : une seule teinte d’accent)');
      // Filtres par plateforme.
      const f = await filtres(pg);
      dit(nCarte(f.lbc) === 2 && nCarte(f.ebay) === 2 && nCarte(f.demandee) === 1 && nCarte(f.seul) === 3, 'filtres : Leboncoin 2 · eBay 2 · À vérifier 1 · Seulement Vinted 3', JSON.stringify(f));
      try {
        await pg.click('[data-filtre-plateforme="lbc"]', { timeout: 4000 });
        await pg.waitForTimeout(400);
        await capture(pg, `annonces-${vp.width}-filtre-leboncoin`);
        const vLbc = await visibles(pg);
        dit(vLbc.join() === '9201,9205', 'filtre Leboncoin : seules les paires PROUVÉES là-bas', vLbc.join());
        await pg.click('[data-filtre-plateforme="ebay"]', { timeout: 4000 });
        await pg.waitForTimeout(400);
        const vEb = await visibles(pg);
        dit(vEb.join() === '9202,9205', 'filtre eBay : seules les paires au SKU de paire', vEb.join());
        await pg.click('[data-filtre-plateforme="seul"]', { timeout: 4000 });
        await pg.waitForTimeout(400);
        const vSeul = await visibles(pg);
        dit(vSeul.join() === '9203,9204,9206', 'filtre Seulement Vinted : ni Leboncoin ni eBay prouvé', vSeul.join());
        await pg.click('[data-filtre-plateforme="demandee"]', { timeout: 4000 });
        await pg.waitForTimeout(400);
        const vDem = await visibles(pg);
        dit(vDem.join() === '9203', 'filtre À vérifier : la publication demandée, pas encore vue', vDem.join());
        const recap = await pg.evaluate(() => (document.querySelector('.vrm-filter-recap') || {}).innerText || '');
        dit(/1 annonce dans cette sélection/.test(recap), 'la sélection dit combien elle montre', recap);
        await pg.getByRole('button', { name: 'Réinitialiser les annonces', exact: true }).click({ timeout: 4000 });
        await pg.waitForTimeout(400);
        dit((await visibles(pg)).length === 6, 'réinitialiser rend toutes les annonces');
      } catch (e) { dit(false, 'les filtres par plateforme se cliquent', String(e.message).slice(0, 120)); }
      // La fiche : statut par plateforme ET par compte.
      try {
        const fiche = await pg.evaluate(() => {
          const lire = (id) => {
            const d = document.querySelector(`[data-carte-annonce="${id}"] details.vrm-ann-actions`); if (d) d.open = true;
            return Object.fromEntries([...document.querySelectorAll(`[data-carte-annonce="${id}"] [data-fiche-plateforme]`)].map((e) => [e.getAttribute('data-fiche-plateforme'), { etat: e.getAttribute('data-etat'), t: e.innerText, liens: [...e.querySelectorAll('a')].map((a) => a.href) }]));
          };
          return { a: lire('9201'), d: lire('9203'), x: lire('9204') };
        });
        if (CAPT) { const el = await pg.$('[data-carte-annonce="9201"]'); if (el) { await el.scrollIntoViewIfNeeded(); await el.screenshot({ path: path.join(CAPT, `fiche-${vp.width}.png`) }); } }
        dit(fiche.a.lbc && fiche.a.lbc.etat === 'en_ligne' && /Moi_LBC/.test(fiche.a.lbc.t) && fiche.a.lbc.liens.some((h) => /leboncoin\.fr\/ad\/chaussures\/6101/.test(h)) && /vue il y a 5 j/.test(fiche.a.lbc.t),
          'fiche N°21 : Leboncoin · en ligne · le compte · « vue il y a 5 j » · le lien vers SON annonce', JSON.stringify(fiche.a.lbc));
        dit(fiche.a.vinted && fiche.a.vinted.etat === 'en_ligne' && /compte_a/.test(fiche.a.vinted.t), 'fiche N°21 : Vinted · en ligne · compte_a', JSON.stringify(fiche.a.vinted));
        dit(fiche.d.lbc && fiche.d.lbc.etat === 'demandee', 'fiche N°23 : Leboncoin « demandée, pas encore vue en ligne »', JSON.stringify(fiche.d.lbc));
        dit(fiche.x.lbc && fiche.x.lbc.etat === 'aucune' && fiche.x.ebay && fiche.x.ebay.etat === 'aucune', 'fiche N°24 : « aucune annonce reliée » sur Leboncoin et eBay', JSON.stringify([fiche.x.lbc, fiche.x.ebay]));
      } catch (e) { dit(false, 'la fiche se lit', String(e.message).slice(0, 120)); }
      const r = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, mort: /n'a pas pu s'afficher|Cannot access|is not defined/.test(document.body.innerText) }));
      dit(r.sw <= r.cw + 1, 'aucun débordement horizontal', `${r.sw} > ${r.cw}`);
      dit(!r.mort && !errs.length, 'aucun écran tombé, aucune erreur', errs[0]);
      await ctx.close();

      // ── Leboncoin illisible (522) ────────────────────────────────────────
      console.log(`── Annonces, Leboncoin illisible · ${vp.width} px`);
      const k = await ouvrir(b, vp, { url: '?tab=cat_annonces', lbcKO: true });
      await k.pg.waitForSelector('[data-carte-annonce="9201"]', { timeout: 15000 }).catch(() => {});
      await k.pg.waitForTimeout(2500);
      const ck = await cartes(k.pg);
      const fk = await filtres(k.pg);
      const ligne = await k.pg.evaluate(() => (document.querySelector('[data-plateformes-passu]') || {}).innerText || '');
      dit(!Object.values(ck).some((x) => (x.plats || []).includes('lbc')), 'pas su : aucun logo Leboncoin inventé', JSON.stringify(Object.fromEntries(Object.entries(ck).map(([i, v]) => [i, v.plats]))));
      dit(/Leboncoin/.test(ligne) && (await k.pg.$$('[data-plateformes-passu]')).length === 1, 'pas su : UNE ligne dit que Leboncoin n’a pas pu être lu', ligne);
      dit(!fk.seul && nCarte(fk.ebay) === 2, 'pas su : pas de « Seulement Vinted » (ce serait faux), eBay reste filtrable', JSON.stringify(fk));
      dit(ck['9203'] && ck['9203'].demandee, 'pas su : la publication demandée reste « à vérifier »');
      dit(!k.errs.length, 'aucune erreur', k.errs[0]);
      await k.ctx.close();

      // ── Sombre (capture + logos lisibles) ─────────────────────────────────
      const s = await ouvrir(b, vp, { url: '?tab=cat_annonces', sombre: true });
      await s.pg.waitForSelector('[data-carte-annonce="9201"]', { timeout: 15000 }).catch(() => {});
      await s.pg.waitForTimeout(2500);
      await capture(s.pg, `annonces-${vp.width}-sombre`);
      const filtreLogo = await s.pg.evaluate(() => { const i = document.querySelector('[data-carte-annonce="9201"] [data-plateformes] img'); return i ? getComputedStyle(i).filter : ''; });
      dit(/invert/.test(filtreLogo), 'sombre : les logos noirs sont inversés (lisibles sur la carte sombre)', filtreLogo);
      await s.pg.click('[data-filtre-plateforme="ebay"]', { timeout: 4000 }).catch(() => {});
      await s.pg.waitForTimeout(300);
      if (CAPT) { const z = await s.pg.$('.vrm-stock-views'); if (z) await z.screenshot({ path: path.join(CAPT, `filtres-${vp.width}-sombre.png`) }); }
      const filtreAllume = await s.pg.evaluate(() => { const i = document.querySelector('[data-filtre-plateforme="ebay"] img'); return i ? getComputedStyle(i).filter : ''; });
      dit(filtreAllume === 'none', 'sombre : sur le filtre allumé (fond clair), le logo reste noir — lisible', filtreAllume);
      dit(!s.errs.length, 'sombre : aucune erreur', s.errs[0]);
      await s.ctx.close();

      // ── Vestiaire Collective ──────────────────────────────────────────────
      console.log(`── Vestiaire Collective · ${vp.width} px`);
      const v = await ouvrir(b, vp, { url: '?tab=plat_vestiaire' });
      await v.pg.waitForSelector('[data-vc-section]', { timeout: 15000 }).catch(() => {});
      await v.pg.waitForTimeout(1200);
      await capture(v.pg, `vestiaire-${vp.width}`);
      const h1 = await v.pg.evaluate(() => { const h = document.querySelector('.vrm-market-heading h1'); return h ? h.innerText : ''; });
      dit(h1 === 'Vestiaire Collective', 'l’en-tête porte le nom complet', h1);
      const nav = await v.pg.evaluate(() => [...document.querySelectorAll('nav button, nav a, [role="menuitem"]')].map((x) => x.innerText.trim()).filter((t) => /Vestiaire/.test(t)));
      if (vp.width >= 1024) dit(nav.some((t) => t === 'Vestiaire Collective'), 'la navigation dit « Vestiaire Collective »', JSON.stringify(nav));
      const secs = await v.pg.evaluate(() => [...document.querySelectorAll('.vrm-platform-tabs [data-section]')].map((x) => x.getAttribute('data-section')));
      dit(secs.join() === 'ventes,achats,annonces,compte', 'les mêmes sections que les autres plateformes : Ventes · Achats · Annonces · Compte', secs.join());
      const sections = {};
      for (const s2 of ['ventes', 'achats', 'annonces', 'compte']) {
        await v.pg.click(`.vrm-platform-tabs [data-section="${s2}"]`, { timeout: 4000 }).catch(() => {});
        await v.pg.waitForTimeout(500);
        sections[s2] = await v.pg.evaluate(() => { const z = document.querySelector('[data-vc-section]'); return z ? { id: z.getAttribute('data-vc-section'), t: z.innerText, bientot: !!z.querySelector('[data-bientot]'), mesure: !!z.querySelector('[data-vc-mesure]'), boutons: [...z.querySelectorAll('button')].map((b) => b.innerText.trim()) } : null; });
      }
      dit(['ventes', 'achats', 'annonces'].every((k2) => sections[k2] && sections[k2].bientot && /Bientôt disponible/.test(sections[k2].t)), '« Bientôt disponible » sur Ventes, Achats, Annonces (rien n’y est capté)', JSON.stringify(Object.fromEntries(Object.entries(sections).map(([k2, x]) => [k2, x && x.bientot]))));
      dit(sections.compte && !/Bientôt disponible/.test(sections.compte.t) && sections.compte.mesure, 'JAMAIS « Bientôt disponible » sur Compte : la mesure du site, elle, marche', sections.compte && sections.compte.t.slice(0, 120));
      dit(!Object.values(sections).some((x) => x && /\d+,\d{2}\s?€/.test(x.t)), 'aucun montant Vestiaire inventé');
      dit(['ventes', 'achats', 'annonces'].every((k2) => sections[k2] && sections[k2].boutons.every((t) => t === 'Où en est VRM →')), 'aucun bouton qui ferait semblant : le seul geste mène à « Compte »', JSON.stringify(Object.fromEntries(Object.entries(sections).map(([k2, x]) => [k2, x && x.boutons]))));
      try {
        await v.pg.click('.vrm-platform-tabs [data-section="ventes"]', { timeout: 4000 });
        await v.pg.waitForTimeout(300);
        await v.pg.getByRole('button', { name: 'Où en est VRM →', exact: true }).click({ timeout: 4000 });
        await v.pg.waitForTimeout(400);
        const ici = await v.pg.evaluate(() => (document.querySelector('[data-vc-section]') || {}).getAttribute && document.querySelector('[data-vc-section]').getAttribute('data-vc-section'));
        dit(ici === 'compte', '« Où en est VRM → » ouvre Compte, pour de vrai', ici);
      } catch (e) { dit(false, '« Où en est VRM → » se clique', String(e.message).slice(0, 100)); }
      const rv = await v.pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, mort: /n'a pas pu s'afficher|Cannot access|is not defined/.test(document.body.innerText) }));
      dit(rv.sw <= rv.cw + 1, 'Vestiaire : aucun débordement horizontal', `${rv.sw} > ${rv.cw}`);
      dit(!rv.mort && !v.errs.length, 'Vestiaire : aucun écran tombé, aucune erreur', v.errs[0]);
      await v.ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ Annonces et plateformes : ${ko} rouge(s)` : '\n✅ Annonces et plateformes : tout est vert');
  process.exit(ko ? 1 : 0);
})();
