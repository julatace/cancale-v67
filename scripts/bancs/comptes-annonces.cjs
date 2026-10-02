// Banc : les COMPTES ne s'empilent plus sur l'écran Annonces (H1, 30 sept.).
//
// « L'onglet Annonces, c'est le bordel : la liste des comptes va dans Réglages. »
// Sur trois comptes INVENTÉS (il vit dans le dépôt), il exige :
//   · plus aucune puce de compte cliquable sur Annonces (elles MASQUAIENT le
//     compte au tap — Julien le faisait en croyant filtrer) ;
//   · UNE ligne qui dit combien de comptes alimentent la liste, et une porte
//     « Gérer les comptes » qui mène à Réglages → Comptes liés ;
//   · là-bas, masquer un compte DEMANDE confirmation (la règle suit le geste),
//     et « Annuler » ne masque rien.

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
const PORT = 4334;

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
const ACCS = ['111','222','333'].map((u, i) => ({ id: i + 1, vinted_user_id: u, login: 'compte_test_' + u, domain: 'www.vinted.fr', updated_at: auj.toISOString() }));
const annonce = (id, t) => ({ id, title: t, price: { amount: '50', currency_code: 'EUR' }, is_closed: false, is_draft: false, photo: null });
const rows = ACCS.map((a, i) => ({ id: `harvest_${a.vinted_user_id}_listings`, data: { capturedAt: auj.toISOString(), payload: { items: [annonce(8000 + i * 10, 'Paire test A' + i), annonce(8001 + i * 10, 'Paire test B' + i)] } } }));
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
        const u = decodeURIComponent(route.request().url());
        const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
        if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
        if (/vinted_accounts/.test(u)) return j(ACCS);
        const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
        const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: auj.toISOString(), cap: r.data.capturedAt });
        const eq = /id=eq\.([^&]*)/.exec(u);
        if (eq) { if (/pdfB64/.test(sel || '')) pdfDemandes.push(eq[1]); return j(rows.filter((r) => r.id === eq[1]).map(forme)); }
        const lk = /id=like\.([^&]*)/.exec(u);
        if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
        return j([]);
      });
      await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
      await pg.goto(`http://localhost:${PORT}/?tab=cat_annonces`, { waitUntil: 'domcontentloaded' });
      await pg.waitForTimeout(3500);
      const v = await pg.evaluate(() => {
        const ligne = document.querySelector('[data-comptes-annonces]');
        const puces = [...document.querySelectorAll('main button')].filter((x) => /compte_test_\d+\s*·\s*\d/.test(x.innerText || ''));
        return { ligne: ligne ? ligne.innerText : null, puces: puces.length, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
      });
      await pg.screenshot({ path: path.join(require('os').tmpdir(), 'comptes-annonces-' + vp.width + '.png') });
      dit(v.puces === 0, 'plus aucune puce de compte cliquable sur Annonces', `${v.puces} puce(s)`);
      dit(!!v.ligne && /3 comptes/.test(v.ligne), 'une ligne dit combien de comptes alimentent la liste', JSON.stringify(v.ligne));
      dit(v.sw <= v.cw + 1, 'aucun débordement horizontal', `${v.sw} > ${v.cw}`);
      try { await pg.click('[data-comptes-annonces] button', { timeout: 4000 }); } catch (e) { dit(false, 'la porte se clique', String(e.message).slice(0, 80)); }
      await pg.waitForTimeout(2500);
      const surComptes = await pg.evaluate(() => /compte_test_111/.test(document.body.innerText) && /Comptes/i.test(document.body.innerText) && location.search.includes('vintedaccounts') || !!document.querySelector('[data-tab="vintedaccounts"]') || /Comptes (Vinted )?liés/i.test(document.body.innerText));
      dit(surComptes, '« Gérer les comptes » mène à Comptes liés');
      // Masquer y demande confirmation, et « Annuler » ne masque rien.
      const avant = await pg.evaluate(() => localStorage.getItem('vinted_accounts_hidden'));
      let confirmVue = false;
      try {
        await pg.locator('button[title*="Clique pour le masquer"]').first().click({ timeout: 4000 });
        await pg.waitForTimeout(600);
        confirmVue = await pg.evaluate(() => /Masquer « /.test(document.body.innerText));
        await pg.getByText('Annuler', { exact: true }).last().click({ timeout: 3000 });
        await pg.waitForTimeout(600);
      } catch (e) { dit(false, 'l’interrupteur « masquer » se clique', String(e.message).slice(0, 80)); }
      const apres = await pg.evaluate(() => localStorage.getItem('vinted_accounts_hidden'));
      dit(confirmVue, 'masquer un compte demande confirmation');
      dit(!/111|222|333/.test(String(apres || '')) && String(apres || '') === String(avant || ''), '« Annuler » ne masque rien', `${avant} → ${apres}`);
      dit(errs.length === 0, 'aucune erreur d’app', errs.join(' | ').slice(0, 160));
      /* capture prise sur Annonces, plus haut */
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ comptes / annonces : ${ko} rouge(s)` : '\n✅ comptes / annonces : tout est vert');
  process.exit(ko ? 1 : 0);
})();
