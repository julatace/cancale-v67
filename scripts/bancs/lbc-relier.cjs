// Banc : RELIER une annonce Leboncoin « non reliée » à une paire (C4, 30 sept.).
//
// « Annonce Leboncoin non reliée : afficher la photo + pouvoir la relier à un N°
// dans l'app. » Sur des données INVENTÉES (il vit dans le dépôt), il exige :
//   · l'annonce non reliée montre sa PHOTO ;
//   · un N° que VRM ne connaît pas est REFUSÉ (le lien ne mènerait à rien) ;
//   · un N° connu la RELIE : elle sort de « non reliées », le lien est écrit
//     dans `vrm_lbc_liens` (une identité posée par lui, jamais devinée) ;
//   · l'EXTENSION applique la même règle : le VRAI `adRefKeys` de background.js,
//     exécuté dans un vm, rend ce N° pour cette annonce (§11 — sinon l'app
//     relie et le panneau ne relie pas).
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = 4335;

const auj = new Date();
const jour = (d) => new Date(auj.getFullYear(), auj.getMonth(), d, 12).toISOString();
const J = Math.min(auj.getDate(), 28);
const vente = (id, titre, prix, statut, d) => ({ transaction_id: id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, status: statut, date: jour(d) });
const VENTES = [
  vente(9001, 'Nike Air Max 1 olive taille 42', 80, 'Commande finalisée', Math.max(1, J - 3)),
  vente(9002, 'Salomon XT-6 blanc 👟 taille 40', 99.5, 'Commande finalisée', Math.max(1, J - 2)),
  vente(9003, 'Adidas Spezial noir taille 38', 45, 'Commande finalisée', Math.max(1, J - 1)),
  vente(9004, 'Asics Gel-Kayano taille 41', 60, 'Paiement validé', J),        // en cours : hors CA
  vente(9005, 'New Balance 990 taille 44', 70, 'Commande annulée', J),       // annulée : hors tout
];
const ACHATS = [
  { transaction_id: 7001, title: 'Lot Nike Air Max', price: { amount: '35', currency_code: 'EUR' }, status: 'Commande finalisée', date: jour(1), seller: 'vendeur_test' },
];
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];
const MAIN = { vinted_annonce_numeros: { '5001': { numero: '12', title: 'Paire test numérotée' } } };
const AD = { id: 'lbc777', subject: 'Basket test à relier', price: 40, lbcUser: 'u_test', status: 'active', images: ['https://img.test/photo-lbc777.jpg'], url: 'https://www.leboncoin.fr/ad/test/777' };
const rows = [
  { id: 'main', data: MAIN },
  { id: 'lbc_listings', data: { items: { lbc777: AD } } },
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
// Projection PostgREST minimale : `alias:data->>champ` (§6.3 — servir la ligne
// brute à une requête projetée fait lire des champs absents).
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : v;
  }
  return out;
};

(async () => {
  console.log('── extension (background.js, vm)');
  try {
    const vm = require('vm');
    const bg = fs.readFileSync(path.join(__dirname, '..', '..', 'vinted-sync-extension', 'background.js'), 'utf8');
    const i = bg.indexOf('function adRefKeys('); const fin = bg.indexOf('\n}\n', i) + 3;
    const ctx = {}; vm.createContext(ctx); vm.runInContext(bg.slice(i, fin) + '\nthis.adRefKeys = adRefKeys;', ctx);
    const k1 = ctx.adRefKeys(AD, { lbc777: '12' });
    dit(Array.isArray(k1) && k1[0] === '12', 'le panneau relie la même annonce au même N° (adRefKeys)', JSON.stringify(k1));
    dit(JSON.stringify(ctx.adRefKeys(AD, {})) === '[]', 'sans lien posé, il ne devine rien', JSON.stringify(ctx.adRefKeys(AD, {})));
  } catch (e) { dit(false, 'adRefKeys s’exécute', String(e.message).slice(0, 120)); }
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      console.log(`── ${vp.width} px`);
      const ctx = await b.newContext({ viewport: vp, acceptDownloads: true, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
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
        if (/id=eq\.main/.test(u)) return j([projette({ id: 'main', data: MAIN }, sel)]);
        const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: auj.toISOString(), cap: r.data.capturedAt });
        const eq = /id=eq\.([^&]*)/.exec(u);
        if (eq) { if (/pdfB64/.test(sel || '')) pdfDemandes.push(eq[1]); return j(rows.filter((r) => r.id === eq[1]).map(forme)); }
        const lk = /id=like\.([^&]*)/.exec(u);
        if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
        return j([]);
      });
      await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
      await pg.goto(`http://localhost:${PORT}/?tab=leboncoin`, { waitUntil: 'domcontentloaded' });
      await pg.waitForTimeout(3500);
      const bloc = '[data-lbc-relier="lbc777"]';
      const vu = await pg.evaluate((s) => { const el = document.querySelector(s); return el ? { img: !!el.querySelector('img[src*="photo-lbc777"]'), t: el.innerText } : null; }, bloc);
      await pg.screenshot({ path: path.join(require('os').tmpdir(), 'lbc-relier-' + vp.width + '.png') });
      dit(!!vu, 'l’annonce non reliée est listée');
      dit(!!(vu && vu.img), 'elle montre sa PHOTO');
      try {
        await pg.fill(bloc + ' input', '999'); await pg.click(bloc + ' button');
        await pg.waitForTimeout(500);
        const t = await pg.evaluate((s) => (document.querySelector(s) || {}).innerText || '', bloc);
        dit(/Aucune paire ne porte le N°999/.test(t), 'un N° inconnu de VRM est refusé', t.split('\n').slice(-2).join(' | '));
        dit(!await pg.evaluate(() => localStorage.getItem('vrm_lbc_liens')), 'et rien n’est écrit');
        await pg.fill(bloc + ' input', '12'); await pg.click(bloc + ' button');
        await pg.waitForTimeout(2500);
      } catch (e) { dit(false, 'le champ N° et « Relier » se manipulent', String(e.message).slice(0, 90)); }
      const liens = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_lbc_liens') || 'null'); } catch (_) { return null; } });
      dit(liens && liens.lbc777 === '12', 'un N° connu est relié : vrm_lbc_liens = { lbc777: "12" }', JSON.stringify(liens));
      dit(!await pg.$(bloc), 'l’annonce sort de « non reliées »');
      const r = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      dit(r.sw <= r.cw + 1, 'aucun débordement horizontal', `${r.sw} > ${r.cw}`);
      dit(errs.length === 0, 'aucune erreur d’app', errs.join(' | ').slice(0, 160));
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ relier une annonce Leboncoin : ${ko} rouge(s)` : '\n✅ relier une annonce Leboncoin : tout est vert');
  process.exit(ko ? 1 : 0);
})();
