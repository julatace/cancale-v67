// Banc : BÉNÉFICE BRUT ET NET sur l'écran Ventes (demande de Julien, 18 oct.).
//
// « tu peux faire des statistiques sur les bénéfices net et brut ». La bande
// « Analyse de tes ventes » montrait un seul « Bénéfice estimé » (le NET). On y
// distingue désormais le BRUT (vente − achat) du NET (− boosts & frais).
//
// §4.10/§6 : le VRAI build dans une page, sur des ventes INVENTÉES (aucune
// donnée réelle — ce banc vit dans le dépôt public). Deux scénarios :
//   A. des prix d'achat + un boost  → brut ≠ net → DEUX cartes, brut > net ;
//   B. aucun prix d'achat           → une seule carte « Bénéfice · — » (§7 :
//      on ne scinde pas, et on n'invente pas un faux bénéfice).
// §6.1 : sur le code d'avant il n'y a qu'« Bénéfice estimé » — les libellés
// « brut »/« net » sont absents, donc le scénario A tombe au rouge.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4337);

const auj = new Date();
const jour = (d) => new Date(auj.getFullYear(), auj.getMonth(), d, 12).toISOString();
const J = Math.min(auj.getDate(), 28);
const vente = (id, titre, prix) => ({ transaction_id: id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, status: 'Commande finalisée', date: jour(Math.max(1, J - (id % 5))) });
// Deux ventes finalisées de CE mois. 5001 porte un boost (fees) → brut ≠ net.
// brut = (100−40)+(60−30) = 90 ; net = (100−40−3)+(60−30) = 87.
const VENTES = [vente(5001, 'Nike Air Max 1 olive taille 42', 100), vente(5002, 'Adidas Samba OG blanc taille 40', 60)];
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];
// `vinted_sale_overrides` est une clé SYNCHRONISÉE → dans la ligne `main` (lue
// par cloudLoad), jamais une ligne à part.
const AVEC_ACHATS = { vinted_sale_overrides: { '5001': { buyPrice: '40', fees: '3' }, '5002': { buyPrice: '30' } } };
const rowsPour = (avecAchats) => [
  { id: 'harvest_111_orders_sold', data: { capturedAt: auj.toISOString(), payload: { my_orders: VENTES } } },
  ...VENTES.map((v) => ({ id: 'harvest_111_txn_' + v.transaction_id, data: { capturedAt: auj.toISOString(), payload: { transaction: { id: v.transaction_id, status: 450, status_updated_at: jour(Math.max(1, J - 1)) } } } })),
  ...(avecAchats ? [{ id: 'main', data: AVEC_ACHATS }] : []),
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

const brancher = async (pg, rows) => {
  await pg.route('**/rest/v1/**', async (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) }).catch(() => {});
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || '';
    const forme = (r) => {
      if (/^[a-z]+:data->[a-z]+$/i.test(sel)) { const [al, src] = sel.split(':'); return { [al]: (r.data || {})[src.split('->')[1]] }; }
      if (/^[a-z]+:data->/i.test(sel)) {
        const o = {};
        for (const champ of sel.split(',')) { const m = /^([a-z]+):data->(.+)$/i.exec(champ); if (!m) continue; let v = r.data; for (const p of m[2].split(/->>?/)) v = v == null ? v : v[p]; o[m[1]] = (v != null && /->>/.test(m[2])) ? String(v) : v; }
        return o;
      }
      return { ...r, updated_at: auj.toISOString(), cap: r.data.capturedAt };
    };
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
};

const lireStrip = async (b, avecAchats) => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await brancher(pg, rowsPour(avecAchats));
  await pg.goto(`http://localhost:${PORT}/?tab=cat_ventes`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(3000);
  try { if (!(await pg.$('.vrm-summary-strip'))) await pg.getByText('Analyse de tes ventes', { exact: true }).click({ timeout: 4000 }); } catch (_) {}
  await pg.waitForTimeout(600);
  const strip = await pg.evaluate(() => (document.querySelector('.vrm-summary-strip') || {}).innerText || '');
  return { strip, errs, ctx };
};

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });

    // ── A. avec prix d'achat + un boost → brut ≠ net ──────────────────────────
    console.log('── A. des prix d’achat (un boost) → brut et net distincts');
    const A = await lireStrip(b, true);
    dit(!A.errs.length, 'l’écran Ventes se rend sans erreur', A.errs[0]);
    dit(/Bénéfice brut/i.test(A.strip) && /Bénéfice net/i.test(A.strip), 'deux cartes : « Bénéfice brut » ET « Bénéfice net »', A.strip.replace(/\n/g, ' · ').slice(0, 220));
    const apres = (t, lib) => { const m = new RegExp(lib + '[^0-9-]*(-?[\\d\\s  ]+)').exec(t.replace(/\n/g, ' ')); return m ? parseInt(m[1].replace(/[\s  ]/g, ''), 10) : NaN; };
    const brut = apres(A.strip, 'Bénéfice brut'), net = apres(A.strip, 'Bénéfice net');
    dit(Number.isFinite(brut) && Number.isFinite(net) && brut > net, 'le brut (vente − achat) dépasse le net (− boosts & frais)', `brut=${brut} net=${net}`);
    dit(/après boosts & frais/i.test(A.strip), 'le net dit ce qui est déduit (boosts & frais)', A.strip.replace(/\n/g, ' · ').slice(0, 220));
    await A.ctx.close();

    // ── B. aucun prix d'achat → une seule carte « Bénéfice · — » ───────────────
    console.log('── B. aucun prix d’achat → « Bénéfice · — », pas de split, pas de faux 0');
    const B = await lireStrip(b, false);
    dit(!B.errs.length, 'l’écran Ventes se rend sans erreur (sans prix d’achat)', B.errs[0]);
    dit(!/Bénéfice brut/i.test(B.strip) && !/Bénéfice net/i.test(B.strip), 'aucun split quand il n’y a pas de prix d’achat (§7)', B.strip.replace(/\n/g, ' · ').slice(0, 200));
    dit(/Bénéfice/.test(B.strip) && /—/.test(B.strip) && !/Bénéfice[^\n]*\n\s*0/.test(B.strip), 'une carte « Bénéfice · — », jamais un faux 0,00 € (§7)', B.strip.replace(/\n/g, ' · ').slice(0, 200));
    await B.ctx.close();

    console.log(ko ? `\n❌ bénéfice brut/net : ${ko} rouge(s)` : '\n✅ bénéfice brut/net : tout vert');
    process.exit(ko ? 1 : 0);
  } catch (e) { console.log('KO  le banc a levé — ' + String(e && e.message).slice(0, 160)); process.exit(1); }
  finally { try { srv.close(); } catch (_) {} if (b) try { await b.close(); } catch (_) {} }
})();
