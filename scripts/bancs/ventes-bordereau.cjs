// Banc : le BORDEREAU À CÔTÉ DE CHAQUE VENTE (E1, demande du 30 septembre).
//
// Sur l'écran Ventes, chaque vente dont le bordereau est arrivé par email porte
// un bouton « Bordereau » sous son prix. Le lien se fait par le n° de
// TRANSACTION, une identité (§5) — jamais par titre. Le banc sert, sur des
// ventes INVENTÉES (il vit dans le dépôt) :
//   · un bordereau relié à la vente 9001 (à expédier) par sa transaction ⇒
//     bouton d'impression sur 9001 ;
//   · un bordereau SANS transaction mais au MÊME TITRE que 9002 ⇒ PAS
//     d'impression sur 9002 (une ressemblance de titre ne relie rien) — 9002
//     reste « à générer » ;
//   · une vente FINALISÉE n'a plus aucun bouton de bordereau (2 octobre :
//     « il ne devrait même pas y en avoir », le colis est parti) ;
//   · un clic ⇒ le PDF est réellement demandé, puis produit sans erreur.
//
// (Reprise de la base du banc rapport.cjs.)
//
// Le rapport listait les achats ligne par ligne, mais les ventes seulement en
// TOTAL : le comptable ne pouvait rien rapprocher. Ce banc ouvre le rapport sur
// des ventes INVENTÉES (aucune donnée réelle : il vit dans le dépôt, qui est
// public) et exige :
//   1. un registre des ventes, une ligne par vente FINALISÉE du mois — ni la
//      vente en cours, ni l'annulée ;
//   2. que la somme des lignes rendues soit le CA affiché (§11 : une seule
//      source, la même boucle) — jugé sur les NOMBRES rendus, jamais un libellé ;
//   3. un prix d'achat inconnu écrit « — », jamais « 0,00 € » (§7) ;
//   4. que le PDF se génère, même avec un emoji dans un titre (les polices
//      standard de pdf-lib ne savent pas l'écrire : tout l'export échouait), et
//      qu'il contienne bien les deux registres.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = 4333;

const auj = new Date();
const jour = (d) => new Date(auj.getFullYear(), auj.getMonth(), d, 12).toISOString();
const J = Math.min(auj.getDate(), 28);
const vente = (id, titre, prix, statut, d) => ({ transaction_id: id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, status: statut, date: jour(d) });
const VENTES = [
  vente(9001, 'Nike Air Max 1 olive taille 42', 80, 'Le paiement a été validé', Math.max(1, J - 3)),
  vente(9002, 'Salomon XT-6 blanc 👟 taille 40', 99.5, 'Le paiement a été validé', Math.max(1, J - 2)),
  vente(9003, 'Adidas Spezial noir taille 38', 45, 'Commande finalisée', Math.max(1, J - 1)),
  vente(9004, 'Asics Gel-Kayano taille 41', 60, 'Paiement validé', J),        // en cours : hors CA
  vente(9005, 'New Balance 990 taille 44', 70, 'Commande annulée', J),       // annulée : hors tout
];
const ACHATS = [
  { transaction_id: 7001, title: 'Lot Nike Air Max', price: { amount: '35', currency_code: 'EUR' }, status: 'Commande finalisée', date: jour(1), seller: 'vendeur_test' },
];
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];
const PDF_B64 = fs.readFileSync(path.join(__dirname, 'bordereau-test.b64'), 'utf8').trim();
const rows = [
  { id: 'email_bord_test1', data: { transaction: '9001', filename: 'bordereau.pdf', modele: 'Nike Air Max 1', receivedAt: auj.toISOString(), pdfB64: PDF_B64 } },
  { id: 'email_bord_test2', data: { filename: 'bordereau2.pdf', modele: 'Salomon XT-6 blanc 👟 taille 40', article: 'Salomon XT-6 blanc 👟 taille 40', receivedAt: auj.toISOString(), pdfB64: PDF_B64 } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: auj.toISOString(), payload: { my_orders: VENTES } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: auj.toISOString(), payload: { my_orders: ACHATS } } },
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
  let b; const pdfDemandes = [];
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
        const u = decodeURIComponent(route.request().url());
        const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
        if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
        if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
        const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
        const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: auj.toISOString(), cap: r.data.capturedAt });
        const eq = /id=eq\.([^&]*)/.exec(u);
        if (eq) { if (/pdfB64/.test(sel || '')) pdfDemandes.push(eq[1]); return j(rows.filter((r) => r.id === eq[1]).map(forme)); }
        const lk = /id=like\.([^&]*)/.exec(u);
        if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
        return j([]);
      });
      await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
      await pg.goto(`http://localhost:${PORT}/?tab=cat_ventes`, { waitUntil: 'domcontentloaded' });
      await pg.waitForTimeout(3500);
      // L'onglet « Toutes » : les ventes finalisées comme celles en cours.
      try { await pg.getByText('Toutes', { exact: true }).first().click({ timeout: 3000 }); await pg.waitForTimeout(800); } catch (_) {}
      const bb = await pg.evaluate(() => [...document.querySelectorAll('[data-bouton-bord]')].map((x) => x.getAttribute('data-bouton-bord') + ':' + x.getAttribute('data-tx')));
      dit(bb.includes('pdf:9001'), 'la vente 9001 a son bouton « Bordereau » (relié par sa transaction)', JSON.stringify(bb));
      dit(!bb.includes('pdf:9002'), 'la vente 9002 n’a PAS d’impression : un bordereau au même titre, sans transaction, ne relie rien (§5)', JSON.stringify(bb));
      dit(!bb.some((x) => /:9003$/.test(x)), 'une vente FINALISÉE n’a plus aucun bouton de bordereau', JSON.stringify(bb));
      // 3 octobre : « sur ordi ça télécharge le bordereau et ça ne l'ouvre pas ».
      // Un clic doit OUVRIR un onglet sur le PDF, jamais télécharger un fichier.
      const onglets = [], telecharges = [];
      ctx.on('page', (p) => onglets.push(p));
      pg.on('download', (d) => telecharges.push(d.suggestedFilename()));
      const avant = pdfDemandes.length;
      try { await pg.click('[data-bouton-bord="pdf"][data-tx="9001"]', { timeout: 5000 }); } catch (e) { dit(false, 'le bouton se clique', String(e.message).slice(0, 90)); }
      await pg.waitForTimeout(2500);
      const urls = onglets.map((p) => p.url());
      dit(onglets.length === 1 && /^blob:/.test(urls[0] || ''), 'un clic OUVRE le bordereau dans un onglet (pas un fichier téléchargé)', JSON.stringify(urls));
      dit(telecharges.length === 0, 'aucun téléchargement', JSON.stringify(telecharges));
      dit(pdfDemandes.slice(avant).includes('email_bord_test1'), 'un clic demande le PDF de CE bordereau, et de lui seul', JSON.stringify(pdfDemandes.slice(avant)));
      const txt = await pg.evaluate(() => document.body.innerText);
      dit(!/PDF du bordereau illisible|Erreur impression/.test(txt), 'le PDF est produit sans erreur');
      const r = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      dit(r.sw <= r.cw + 1, 'aucun débordement horizontal', `${r.sw} > ${r.cw}`);
      dit(errs.length === 0, 'aucune erreur d’app', errs.join(' | ').slice(0, 160));
      await pg.screenshot({ path: path.join(require('os').tmpdir(), 'ventes-bord-' + vp.width + '.png') });
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ bordereau par vente : ${ko} rouge(s)` : '\n✅ bordereau par vente : tout est vert');
  process.exit(ko ? 1 : 0);
})();
