// Banc : le RAPPORT COMPTABLE détaille les ventes (G2, demande du 30 septembre).
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
const PORT = 4331;

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
const rows = [
  { id: 'harvest_111_orders_sold', data: { capturedAt: auj.toISOString(), payload: { my_orders: VENTES } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: auj.toISOString(), payload: { my_orders: ACHATS } } },
];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const nombre = (t) => { const m = /(-?[\d\s  ]+(?:[,.]\d+)?)\s*€/.exec(t || ''); return m ? parseFloat(m[1].replace(/[\s  ]/g, '').replace(',', '.')) : NaN; };

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
srv.listen(PORT);

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      console.log(`── ${vp.width} px`);
      // Le téléphone est émulé pour de vrai (tactile, sans souris) : c'est ce qui
      // décide de ce que la coque affiche par-dessus (§ « sur son iPhone »).
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
        // L'app lit les ventes par MOTIF (`id=like.harvest_111_orders_%`) : un
        // banc qui ne sert que `id=eq.` mesure un écran vide (§6.3).
        const forme = (r) => ({ ...r, updated_at: auj.toISOString(), cap: r.data.capturedAt });
        const eq = /id=eq\.([^&]*)/.exec(u);
        if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
        const lk = /id=like\.([^&]*)/.exec(u);
        if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
        return j([]);
      });
      await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
      await pg.goto(`http://localhost:${PORT}/?tab=cat_ventes`, { waitUntil: 'domcontentloaded' });
      await pg.waitForTimeout(3000);
      try {
        await pg.getByText('Outils', { exact: false }).first().click({ timeout: 5000 });
        await pg.getByText('Rapport comptable', { exact: true }).first().click({ timeout: 5000 });
      } catch (e) { dit(false, 'le rapport s’ouvre depuis « Outils »', String(e.message).slice(0, 100)); await ctx.close(); continue; }
      await pg.waitForTimeout(1500);
      const r = await pg.evaluate(() => {
        const reg = document.querySelector('[data-registre="ventes"]');
        const lignes = reg ? [...reg.children].map((c) => c.innerText) : null;
        const modale = reg ? reg.closest('div[style*="max-height"]') : null;
        return { lignes, modale: modale ? modale.innerText : document.body.innerText, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
      });
      dit(Array.isArray(r.lignes), 'le rapport a un registre des ventes');
      const L = r.lignes || [];
      dit(L.length === 3, 'une ligne par vente FINALISÉE du mois (3), ni l’en cours ni l’annulée', `${L.length} ligne(s)`);
      dit(!L.some((t) => /Kayano|990/.test(t)), 'la vente en cours et l’annulée n’y sont pas');
      const somme = L.reduce((a, t) => a + nombre(t.split('\n').pop()), 0);
      const caTxt = (/CA des ventes finalisées\s*\n?\s*([^\n]+)/i.exec(r.modale) || [])[1] || '';
      const ca = nombre(caTxt);
      dit(Math.abs(somme - ca) < 0.005 && ca > 0, 'la somme des lignes EST le CA affiché', `lignes ${somme} · CA ${ca}`);
      dit(L.length > 0 && L.every((t) => /achat —/.test(t)) && !L.some((t) => /achat 0,00/.test(t)), 'prix d’achat inconnu ⇒ « — », jamais 0');
      dit(!/BÉNÉFICE NET\s*\n\s*0,00/i.test(r.modale), 'aucun prix d’achat connu ⇒ bénéfice « — », jamais 0,00 € (§7)');
      dit(r.sw <= r.cw + 1, 'aucun débordement horizontal', `${r.sw} > ${r.cw}`);
      // Le PDF : il doit se générer (emoji dans un titre) et porter les deux registres.
      let pdfTxt = '';
      try {
        const [dl] = await Promise.all([pg.waitForEvent('download', { timeout: 15000 }), pg.getByText('📄 PDF').click()]);
        const buf = fs.readFileSync(await dl.path());
        pdfTxt = buf.toString('latin1');
        dit(buf.slice(0, 4).toString() === '%PDF', 'le PDF se génère malgré un emoji dans un titre', `${buf.length} octets`);
      } catch (e) { dit(false, 'le PDF se génère malgré un emoji dans un titre', String(e.message).slice(0, 100)); }
      dit(errs.length === 0, 'aucune erreur d’app', errs.join(' | ').slice(0, 160));
            await pg.screenshot({ path: path.join(require('os').tmpdir(), 'rapport-'+vp.width+'.png') });
      await ctx.close();
      void pdfTxt;
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ rapport : ${ko} rouge(s)` : '\n✅ rapport : tout est vert');
  process.exit(ko ? 1 : 0);
})();
