// Banc : ATELIER — FILE DE PUBLICATION (tranche 4), NON destructif.
//
// Sur des données INVENTÉES (il vit dans le dépôt), aux deux tailles, il exige,
// en EXÉCUTANT la vraie file de l'app :
//   · les brouillons PRÊTS sont proposés ; on les ajoute, on les RÉORDONNE ;
//   · l'espacement est BORNÉ (une saisie absurde est ramenée à la borne) ;
//   · DÉMARRER met en marche mais l'espacement GATE : rien n'est traité pendant
//     le délai ; PAUSE laisse l'article en attente (étape critique non coupée) ;
//   · après un RECHARGEMENT en marche, la file revient EN PAUSE (jamais relancée
//     toute seule) et garde ses articles (reprise après interruption) ;
//   · au passage, l'ÉLIGIBILITÉ est revérifiée : un brouillon dont l'annonce
//     n'est plus en ligne est SAUTÉ avec sa raison, jamais « prêt » ;
//   · rien n'est publié (essai à blanc) : aucune requête /api de publication.
// §6.1 : sur un build d'origin/main l'entrée « File de publication » et la
// modale `AtelierFile` n'existent pas ⇒ rouge.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT) || 4372;
const auj = new Date();
const ann = (id, o) => Object.assign({ id, price: { amount: '49.0', currency_code: 'EUR' }, is_closed: false, is_draft: false, photo: null, brand_title: 'Nike', size_title: '42', status: 'Très bon état', view_count: 10, favourite_count: 1 }, o);
const ITEMS = [
  ann(9102, { title: 'Salomon XT-6 blanc taille 40', brand_title: 'Salomon' }),
  ann(9103, { title: 'Adidas Spezial noir taille 38', brand_title: 'Adidas' }),
  ann(9106, { title: 'Nike Dunk low panda taille 41' }),
  // 999999 N'EST PAS en ligne → le brouillon 99 doit être SAUTÉ (inéligible).
];
const MAIN = { vinted_annonce_numeros: { '9102': { numero: '42' }, '9103': { numero: '43' }, '9106': { numero: '45' } } };
// Brouillons PRÊTS (titre + prix > 0 + photo), semés dans le navigateur. 99 pointe
// vers une annonce qui n'est plus en ligne → inéligible au passage.
const DRAFTS = {
  '42': { id: 9102, numero: '42', title: 'Salomon XT-6 blanc 40 — nickel', price: 60, photos: ['a', 'b'] },
  '43': { id: 9103, numero: '43', title: 'Adidas Spezial noir 38', price: 55, photos: ['a'] },
  '45': { id: 9106, numero: '45', title: 'Nike Dunk panda 41', price: 70, photos: ['a', 'b', 'c'] },
};
const rows = [
  { id: 'main', data: MAIN },
  { id: 'harvest_111_listings', data: { capturedAt: auj.toISOString(), payload: { items: ITEMS } } },
  { id: 'vinted_item_details', data: {} },
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
const ordreFile = (pg) => pg.$$eval('[data-file-item]', (els) => els.map((e) => e.getAttribute('data-file-item')));
const statut = (pg, k) => pg.locator(`[data-file-statut="${k}"]`).first().innerText().catch(() => '');
const mode = (pg) => pg.locator('[data-file-modal]').first().getAttribute('data-file-mode').catch(() => '');
(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      console.log(`── ${vp.width} px`);
      const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
      const pg = await ctx.newPage();
      const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
      let publieAppels = 0;
      let drop9106 = false;   // ⚠️ scoping PAR viewport : jamais muter ITEMS (partagé entre les deux passes)
      // ⚠️ On ne SÈME les brouillons que s'ils n'existent pas déjà : sinon ce
      //    script, rejoué à chaque navigation (dont le rechargement), écraserait
      //    l'édition du brouillon 45 qu'on fait exprès avant de re-naviguer.
      await pg.addInitScript((d) => { try { localStorage.setItem('vrm_acces_direct', '1'); if (!localStorage.getItem('vinted_annonce_drafts')) localStorage.setItem('vinted_annonce_drafts', JSON.stringify(d)); } catch (_) {} }, DRAFTS);
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
      await pg.route('**/api/**', (r) => { if (/publ|item_upload|delete/i.test(r.request().url())) publieAppels++; return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); });
      const ouvrirFile = async () => {
        const stock = pg.locator('.vrm-ann-stock-tools'); if (await stock.count()) await stock.evaluate((e) => { e.open = true; }).catch(() => {});
        const o = pg.locator('[aria-label="Outils"]').first();
        await o.waitFor({ state: 'visible', timeout: 6000 }).catch(() => {});
        await o.scrollIntoViewIfNeeded().catch(() => {});
        await o.click();
        const e = pg.locator('button:has-text("File de publication")').first();
        await e.waitFor({ state: 'visible', timeout: 2500 }).catch(() => {});
        if (await e.count() === 0) return false;
        await e.click();
        await pg.locator('[data-file-modal]').first().waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
        return await pg.locator('[data-file-modal]').count() > 0;
      };
      try {
        await pg.goto(`http://localhost:${PORT}/?tab=cat_annonces`, { waitUntil: 'domcontentloaded' });
        await pg.waitForTimeout(4000);
        dit(await ouvrirFile(), 'menu Outils → « File de publication » ouvre la modale');
        // bornes de l'espacement : une saisie absurde est ramenée à la borne
        await pg.locator('[data-file-esp-min]').fill('99999');
        await pg.waitForTimeout(80);
        dit(await pg.locator('[data-file-esp-min]').inputValue() === '3600', 'espacement borné : 99999 s ⇒ ramené à 3600 s (jamais au-delà)');
        // les 3 brouillons prêts sont proposés
        let n = 0; for (const k of ['42', '43', '45']) n += await pg.locator(`[data-file-cand="${k}"]`).count();
        dit(n === 3, 'les 3 brouillons prêts sont proposés à la file', `${n}/3`);
        // espacement grand (3600 s) → rien ne se traitera pendant l'essai de pause/reprise
        for (const k of ['42', '43', '45']) await pg.locator(`[data-file-cand="${k}"]`).check();
        await pg.locator('[data-file-ajouter]').click();
        await pg.waitForTimeout(120);
        dit((await ordreFile(pg)).join(',') === '42,43,45', 'les 3 articles entrent dans la file dans l’ordre', (await ordreFile(pg)).join(','));
        // réordonner : monter 45 d’un cran
        await pg.locator('[data-file-monter="45"]').click();
        await pg.waitForTimeout(80);
        dit((await ordreFile(pg)).join(',') === '42,45,43', 'monter N°45 d’un cran réordonne la file', (await ordreFile(pg)).join(','));
        // démarrer : l’espacement GATE — rien ne doit être traité pendant le délai
        await pg.locator('[data-file-demarrer]').click();
        await pg.waitForTimeout(400);
        dit(await mode(pg) === 'run', 'démarré : la file est en marche');
        dit(/attente/i.test(await statut(pg, '42')), 'l’espacement GATE : rien n’est traité pendant le délai (42 encore en attente)', await statut(pg, '42'));
        // pause : l’article reste en attente (étape critique non coupée)
        await pg.locator('[data-file-pause]').click();
        await pg.waitForTimeout(80);
        dit(await mode(pg) === 'pause' && /attente/i.test(await statut(pg, '42')), 'pause : la file s’arrête, l’article reste en attente', await mode(pg));
        // reprendre, puis RECHARGER en marche → doit revenir EN PAUSE
        await pg.locator('[data-file-reprendre]').click();
        await pg.waitForTimeout(80);
        dit(await mode(pg) === 'run', 'reprise : de nouveau en marche');
        // Le brouillon de N°45 devient INCOMPLET entre-temps (prix retiré, p.ex.
        // une correction faite ailleurs) : au passage, l'éligibilité revérifiée
        // devra le SAUTER. On l'écrit dans le localStorage (les brouillons sont
        // relus au montage) puis on RE-NAVIGUE (l'app retire ?tab de l'URL par
        // replaceState, un simple reload retomberait sur « Ma journée ») — même
        // effet qu'un rechargement : page neuve, état relu.
        await pg.evaluate(() => { try { const d = JSON.parse(localStorage.getItem('vinted_annonce_drafts') || '{}'); if (d['45']) { d['45'].price = 0; localStorage.setItem('vinted_annonce_drafts', JSON.stringify(d)); } } catch (_) {} });
        await pg.goto(`http://localhost:${PORT}/?tab=cat_annonces`, { waitUntil: 'domcontentloaded' });
        await pg.waitForTimeout(4500);
        dit(await ouvrirFile(), 'après rechargement : la modale se rouvre');
        dit(await mode(pg) === 'pause', 'après un rechargement EN MARCHE, la file revient EN PAUSE (jamais relancée toute seule)', await mode(pg));
        dit((await ordreFile(pg)).length === 3, 'la file est restaurée avec ses 3 articles (reprise après interruption)', String((await ordreFile(pg)).length));
        // espacement 0 et reprise → les éligibles passent, 45 est SAUTÉ (plus en ligne)
        await pg.locator('[data-file-esp-min]').fill('0');
        await pg.locator('[data-file-reprendre]').click();
        await pg.waitForTimeout(1500);
        const s42 = await statut(pg, '42'), s45 = await statut(pg, '45');
        dit(/prête/i.test(s42) && /prête/i.test(await statut(pg, '43')), 'les éligibles passent « prête » (essai à blanc)', s42);
        dit(/saut/i.test(s45) && /prix/i.test(s45), 'N°45, devenu incomplet (prix retiré), est SAUTÉ avec sa raison — jamais publié', s45);
        dit(await mode(pg) === 'idle', 'la file se termine d’elle-même (plus rien à faire)', await mode(pg));
        dit(publieAppels === 0, 'ESSAI À BLANC : aucune requête de publication n’est partie', String(publieAppels));
        dit(!errs.length, 'aucune erreur d’app', errs[0]);
      } catch (e) { dit(false, 'le scénario « file de publication » a tourné', String(e.message).slice(0, 160)); }
      await pg.screenshot({ path: path.join(require('os').tmpdir(), 'atelier-file-' + vp.width + '.png') });
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e.message).slice(0, 160)); }
  if (b) await b.close(); srv.close();
  console.log(`\n${ko ? '❌' : '✅'} atelier — file de publication : ${ko ? ko + ' rouge(s)' : 'tout est vert'}`);
  process.exit(ko ? 1 : 0);
})();
