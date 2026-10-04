// Banc : Ma journée distingue les ventes FAITES de l'argent REÇU, et le
// graphique des 14 jours les montre chacune à SA date (n° 20, demande du
// 3 octobre : « il y a les ventes que l'on fait en une journée et l'argent que
// l'on reçoit — je veux un graphique avec les ventes de la journée »).
//
// Le héros disait « Chiffre d'affaires » sur les ventes faites (en cours
// comprises, Vinted seul, figé au montage) — le mot du CA déclaré, qui est
// l'argent reçu. Ce banc rend Ma journée sur des ventes INVENTÉES (aucune
// donnée réelle : il vit dans le dépôt, qui est public) et juge les NOMBRES
// rendus (attributs `data-*`), jamais un libellé (§6.5) :
//   1. vendu = date de VENTE, toutes plateformes, en cours comprises, hors
//      annulées ; reçu = date de VERSEMENT (le CA déclaré, `ventesDeclarables`) ;
//   2. une vente faite le mois dernier et versée ce mois-ci est REÇUE ce mois,
//      pas vendue ; une vente finalisée sans date de versement est vendue mais
//      dans AUCUN jour « reçu », et c'est dit ;
//   3. « Vendu aujourd'hui » et la colonne du jour viennent de la même liste ;
//   4. dates de versement illisibles ⇒ aucune barre « reçu », aucun montant
//      « reçu » — jamais des zéros (« rien lu » ≠ « rien »).
// Lancer : npm run build && node scripts/bancs/vendu-recu.cjs
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('/home/user/cancale-v67/node_modules/playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = 4337;

const maintenant = new Date();
// Un jour « il y a n jours », à midi heure locale (jamais près de minuit).
const il = (n) => { const d = new Date(maintenant); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return d; };
const cle = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const ceMois = (d) => d.getFullYear() === maintenant.getFullYear() && d.getMonth() === maintenant.getMonth();
const vente = (id, prix, statut, d) => ({ transaction_id: id, title: 'Paire ' + id, price: { amount: String(prix), currency_code: 'EUR' }, status: statut, date: d.toISOString() });

// ── Les ventes inventées ─────────────────────────────────────────────────────
const V = [
  { o: vente(9101, 50, 'Paiement validé', il(0)), vendu: il(0), recu: null },              // en cours : vendue, pas reçue
  { o: vente(9102, 80, 'Commande finalisée', il(2)), vendu: il(2), recu: il(0) },          // vendue J-2, versée aujourd'hui
  { o: vente(9103, 30, 'Commande finalisée', il(20)), vendu: il(20), recu: il(1) },        // vendue il y a 20 j, versée hier
  { o: vente(9104, 70, 'Commande annulée', il(1)), vendu: null, recu: null },              // annulée : nulle part
  { o: vente(9105, 45, 'Commande finalisée', il(3)), vendu: il(3), recu: null, aDater: true }, // finalisée SANS date de versement
];
const LBC = { A: { txId: 'A', isSeller: true, price: 4000, stepLabel: 'Paiement effectué', dateVente: il(0).toISOString(), title: 'lbc' } };
const EBAY = [{ orderId: 'E1', orderPaymentStatus: 'PAID', creationDate: il(1).toISOString(), pricingSummary: { total: { value: '60.00', currency: 'EUR' } }, lineItems: [{ title: 'ebay' }] }];
// Ce que le banc ATTEND, calculé ici à partir des définitions — jamais lu dans l'app.
const lignesVendu = [...V.filter((x) => x.vendu).map((x) => ({ d: x.vendu, eur: Number(x.o.price.amount) })), { d: il(0), eur: 40 }, { d: il(1), eur: 60 }];
const lignesRecu = [...V.filter((x) => x.recu).map((x) => ({ d: x.recu, eur: Number(x.o.price.amount) })), { d: il(0), eur: 40 }, { d: il(1), eur: 60 }];
const somme = (L, f) => Math.round(L.filter(f).reduce((a, l) => a + l.eur, 0) * 100);
const attendu = {
  venduMois: somme(lignesVendu, (l) => ceMois(l.d)),
  recuMois: somme(lignesRecu, (l) => ceMois(l.d)),
  jour: (n) => ({ vendu: somme(lignesVendu, (l) => cle(l.d) === cle(il(n))), recu: somme(lignesRecu, (l) => cle(l.d) === cle(il(n))) }),
};

const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: maintenant.toISOString() }];
const lignes = (versementsLisibles) => [
  { id: 'lbc_ventes', data: { ventes: LBC } },
  { id: 'ebay_orders', data: { orders: EBAY } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: maintenant.toISOString(), payload: { my_orders: V.map((x) => x.o) } } },
  ...(versementsLisibles ? V.filter((x) => x.recu).map((x) => ({ id: 'harvest_111_txn_' + x.o.transaction_id, data: { capturedAt: maintenant.toISOString(), payload: { transaction: { id: x.o.transaction_id, status: 450, status_updated_at: x.recu.toISOString() } } } })) : []),
  { id: 'harvest_111_txn_9105', data: { capturedAt: maintenant.toISOString(), payload: { transaction: { id: 9105, status: 300, status_updated_at: il(3).toISOString() } } } },
];

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 160)); } };

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
srv.listen(PORT);

const ouvrir = async (b, vp, versementsLisibles) => {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  const L = lignes(versementsLisibles);
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    // Dates de versement illisibles : la VRAIE forme d'une panne (522 + HTML).
    if (!versementsLisibles && /_txn_/.test(u) && /like\./.test(u)) return route.fulfill({ status: 522, contentType: 'text/html', body: '<html>522</html>' });
    // §6.3 : une requête PROJETÉE reçoit la projection, pas la ligne brute.
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || '';
    const forme = (r) => {
      if (/^[a-z]+:data->[a-z]+$/i.test(sel)) { const [al, src] = sel.split(':'); return { [al]: (r.data || {})[src.split('->')[1]] }; }
      if (/^[a-z]+:data->/i.test(sel)) {
        const o = {};
        for (const champ of sel.split(',')) { const m = /^([a-z]+):data->(.+)$/i.exec(champ); if (!m) continue; let v = r.data; for (const p of m[2].split(/->>?/)) v = v == null ? v : v[p]; o[m[1]] = (v != null && /->>/.test(m[2])) ? String(v) : v; }
        return o;
      }
      return { ...r, updated_at: maintenant.toISOString(), cap: r.data.capturedAt };
    };
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(L.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(L.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => document.querySelector('[data-vendu-mois]') || /pas pu s'afficher/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
  await pg.waitForTimeout(1500);
  const lu = await pg.evaluate(() => {
    const a = (sel, at) => { const e = document.querySelector(sel); return e ? e.getAttribute(at) : null; };
    const jours = {};
    for (const e of document.querySelectorAll('[data-vendu-recu] [data-jour]')) jours[e.getAttribute('data-jour')] = { vendu: e.getAttribute('data-vendu'), recu: e.getAttribute('data-recu') };
    return { venduMois: a('[data-vendu-mois]', 'data-vendu-mois'), recuMois: a('[data-recu-mois]', 'data-recu-mois'), venduJour: a('[data-vendu-jour]', 'data-vendu-jour'),
      aDater: a('[data-a-dater]', 'data-a-dater'), jours, tombe: /pas pu s'afficher|Cannot access|is not defined/.test(document.body.innerText),
      deb: document.documentElement.scrollWidth - window.innerWidth };
  });
  return { ctx, pg, lu, errs };
};

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      console.log(`\n── Ma journée, ${vp.width} px`);
      await essaie(`${vp.width} px`, async () => {
        const { ctx, pg, lu, errs } = await ouvrir(b, vp, true);
        if (process.env.CAPTURES) await pg.screenshot({ path: path.join(process.env.CAPTURES, `vendu-recu-${vp.width}.png`), fullPage: true });
        dit(!lu.tombe && errs.length === 0, 'l’écran s’affiche, sans erreur', errs.join(' | ').slice(0, 160));
        dit(lu.deb <= 1, 'aucun débordement horizontal', `${lu.deb} px`);
        dit(lu.venduMois === String(attendu.venduMois), 'VENDU ce mois = ventes faites ce mois, toutes plateformes, en cours comprises, hors annulée', `rendu ${lu.venduMois} · attendu ${attendu.venduMois}`);
        dit(lu.recuMois === String(attendu.recuMois), 'REÇU ce mois = ventes VERSÉES ce mois (dont une vendue il y a 20 jours)', `rendu ${lu.recuMois} · attendu ${attendu.recuMois}`);
        dit(lu.venduMois !== lu.recuMois, 'les deux notions donnent deux nombres différents sur ces ventes (sinon on ne prouve rien)');
        const auj = attendu.jour(0), hier = attendu.jour(1), avant = attendu.jour(2);
        const rj = (n) => lu.jours[cle(il(n))] || {};
        dit(Object.keys(lu.jours).length === 14, 'le graphique porte 14 jours', `${Object.keys(lu.jours).length}`);
        dit(rj(0).vendu === String(auj.vendu) && rj(0).recu === String(auj.recu), 'aujourd’hui : vendu et reçu chacun à SA date', `vendu ${rj(0).vendu}/${auj.vendu} · reçu ${rj(0).recu}/${auj.recu}`);
        dit(rj(1).vendu === String(hier.vendu), 'hier : la vente annulée n’est pas « vendue »', `vendu ${rj(1).vendu}/${hier.vendu}`);
        dit(rj(1).recu === String(hier.recu), 'hier : la vente faite il y a 20 jours et versée hier est REÇUE hier', `reçu ${rj(1).recu}/${hier.recu}`);
        dit(rj(2).vendu === String(avant.vendu) && rj(2).recu === '0', 'avant-hier : vendue ce jour-là, pas encore d’argent ce jour-là', `vendu ${rj(2).vendu}/${avant.vendu} · reçu ${rj(2).recu}`);
        dit(rj(3).recu === '0' && rj(3).vendu === String(attendu.jour(3).vendu), 'la vente finalisée SANS date de versement est vendue, jamais placée dans « reçu »', `vendu ${rj(3).vendu} · reçu ${rj(3).recu}`);
        dit(lu.aDater === '1', 'et c’est dit : 1 vente attend sa date de versement', `${lu.aDater}`);
        dit(lu.venduJour === rj(0).vendu, '« Vendu aujourd’hui » = la colonne du jour (une seule liste)', `${lu.venduJour} · ${rj(0).vendu}`);
        await ctx.close();
      });
    }
    console.log('\n── Dates de versement illisibles (522)');
    await essaie('versements illisibles', async () => {
      const { ctx, lu, errs } = await ouvrir(b, { width: 390, height: 844 }, false);
      dit(!lu.tombe && errs.length === 0, 'l’écran s’affiche', errs.join(' | ').slice(0, 160));
      dit(lu.venduMois === String(attendu.venduMois), 'le VENDU reste juste (il ne dépend pas des versements)', `${lu.venduMois}`);
      dit(lu.recuMois === '', 'aucun montant « reçu » inventé', `rendu « ${lu.recuMois} »`);
      const recus = Object.values(lu.jours).map((j) => j.recu);
      dit(recus.length === 14 && recus.every((r) => r === ''), 'aucune barre « reçu » — jamais des zéros', recus.slice(-3).join(','));
      await ctx.close();
    });
  } catch (e) { dit(false, 'le banc s’exécute', String(e.message || e).slice(0, 160)); }
  finally {
    if (b) await b.close(); srv.close();
    console.log(ko ? `\n❌ vendu-reçu : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ vendu-reçu : ${ok} verts, 0 rouge`);
    process.exit(ko ? 1 : 0);
  }
})();
