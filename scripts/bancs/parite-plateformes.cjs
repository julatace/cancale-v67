require('./_porte-banc.cjs');
// ═══════════════════════════════════════════════════════════════════════════
// BANC : PARITÉ DES PLATEFORMES (11 nov.)
//        npm run build && node scripts/bancs/parite-plateformes.cjs   (BANC_PORT, SHOTS=dossier)
// ═══════════════════════════════════════════════════════════════════════════
// Données INVENTÉES, servies sous leur vraie forme (projections `select=`, `id=in.`,
// `id=like.`, `_minipgrest.cjs`) ; 390 px tactile (clair, sombre) et 1512 px :
//   · Vinted : 2 ventes finalisées il y a 2 et 3 jours (60 € + 50 €) ;
//   · Leboncoin : 2 ventes finalisées il y a 2 jours, compte A (45 €) et compte B
//     (70 €), le compte B ÉCARTÉ par lui (`vrm_comptes_exclus`) ;
//   · Vestiaire : une vente versée (150 €, montant sûr) et une terminée au montant
//     PAS sûr (`price.amount`, 60 €) ;
//   · eBay : un compte, aucune commande.
// Ce qu'on juge, sur ce qui est RENDU (data-* et nombres, jamais un libellé seul) :
//   S1  Statistiques → « CA entre deux dates », 7 derniers jours : 60 + 50 + 45 + 150
//       = 305 € sur 4 ventes, « toutes plateformes », la vente Vestiaire au montant pas
//       sûr DITE hors total ; avant : 110 € « Vinted, tous comptes » ;
//   S2  « Finalisé par plateforme » : Leboncoin 45 € (le compte écarté hors ; avant 115 €) ;
//   S3  Leboncoin illisible (500) : « au moins » et « Leboncoin pas lu » sur le CA de la
//       plage ; Colis : le récapitulatif dit « au moins » (`data-colis-recap-au-moins`) ;
//   S4  aucune erreur, aucun débordement horizontal.
// Le volet « L’argent depuis le début » est ouvert d’avance (`vrm_stats_replis`, commodité de l’appareil).
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const fs = require('fs'), http = require('http'), path = require('path');
const { servir } = require('./_minipgrest.cjs');

const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4627;
const SHOTS = process.env.SHOTS || '';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const SESSION = { access_token: 'jeton-de-banc', refresh_token: 'r', expires_at: Date.now() + 3600e3, user: { id: '11111111-2222-3333-4444-555555555555', email: 'camille.martin@exemple.test' } };
const H = 3600e3, maintenant = Date.now(), iso = (t) => new Date(t).toISOString();
const ilYa = (j) => { const d = new Date(maintenant); d.setDate(d.getDate() - j); d.setHours(12, 0, 0, 0); return d.getTime(); };
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'vinted_banc', domain: 'www.vinted.fr', created_at: iso(maintenant - 60 * 24 * H), updated_at: iso(maintenant) }];
const FIN = 'Commande finalisée';
const VV = [[95001, 60, 2], [95002, 50, 3]];
const LBC_A = '8442aaaa-0000-4000-8000-000000000001', LBC_B = 'faf3bbbb-0000-4000-8000-000000000002';
const ligne = (id, data, meta) => ({ id, owner: SESSION.user.id, updated_at: iso(maintenant), data, meta: meta || {} });
const ROWS = [
  ligne('harvest_111_orders_sold', { capturedAt: iso(maintenant - H), payload: { my_orders: VV.map(([tx, p, j]) => ({ transaction_id: tx, id: tx, title: 'Baskets inventées ' + tx, price: { amount: String(p), currency_code: 'EUR' }, status: FIN, date: iso(ilYa(j)) })) } }, { capturedAt: iso(maintenant - H) }),
  ...VV.map(([tx, , j]) => ligne(`harvest_111_txn_${tx}`, { capturedAt: iso(maintenant - H), payload: { transaction: { id: tx, item_id: tx + 500000, status: 450, status_title: FIN, status_updated_at: iso(ilYa(j)) } } })),
  ligne('harvest_111_listings', { capturedAt: iso(maintenant - 60e3), payload: { items: [] } }),
  ligne('lbc_accounts', { accounts: {
    [LBC_A]: { id: LBC_A, name: 'atelier_lbc_banc', type: 'particulier', seenAt: iso(maintenant - 3 * H), sessionAt: iso(maintenant - 3 * H) },
    [LBC_B]: { id: LBC_B, name: 'second_lbc_banc', type: 'particulier', seenAt: iso(maintenant - 3 * H) },
  }, updatedAt: iso(maintenant) }),
  ligne('lbc_listings', { items: {}, lectures: {} }),
  ligne('lbc_ventes', { ventes: {
    T1: { txId: 'T1', isSeller: true, price: 4500, dateVente: iso(ilYa(2)), parcelColor: 'finished', account: 'lbc-account:' + LBC_A, title: 'Article Leboncoin A', at: iso(ilYa(2)) },
    T2: { txId: 'T2', isSeller: true, price: 7000, dateVente: iso(ilYa(2)), parcelColor: 'finished', account: LBC_B, title: 'Article Leboncoin B', at: iso(ilYa(2)) },
  } }),
  ligne('vc_listings', { items: {}, liens: {}, capturedAt: iso(maintenant - 30 * 60e3) }),
  ligne('vc_ventes', { ventes: {
    V1: { etat: 'Payout sent', montant: { valeur: 150, devise: 'EUR', cle: 'sellerPayout' }, date: iso(ilYa(1)) },
    V2: { etat: 'completed', montant: { valeur: 60, devise: 'EUR', cle: 'price.amount' }, date: iso(ilYa(1)) },
  }, lectures: {}, capturedAt: iso(maintenant - 30 * 60e3) }),
  ligne('ebay_comptes', { comptes: [{ principal: true, cle: 'aaaaaaaaaaaaaaaa', pseudo: 'shop_ebay_banc', type: 'pro', site: 'FR', ajouteLe: maintenant - 30 * 24 * H }] }),
  ligne('ebay_orders', { orders: [], capturedAt: maintenant - 2 * H }),
];

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (!c && d != null && d !== '' ? ' — ' + d : '')); };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });

async function ouvrir(nav, vp, { sombre = false, tab, lbcKO = false } = {}) {
  const mobile = vp.width < 600;
  const ctx = await nav.newContext({ viewport: vp, colorScheme: sombre ? 'dark' : 'light', ...(mobile ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(e.message));
  await pg.addInitScript(([s, d, ex]) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_comptes_exclus', JSON.stringify(ex)); localStorage.setItem('vrm_stats_replis', JSON.stringify({ argent: true })); if (d) localStorage.setItem('vinted_dark', 'true'); } catch (_) {} }, [SESSION, sombre, { leboncoin: [LBC_B] }]);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'jeton-de-banc', refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
  await pg.route('**/rest/v1/**', (r) => {
    const q = r.request();
    if (q.method() !== 'GET' && q.method() !== 'HEAD') return r.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
    const u = q.url(), ud = decodeURIComponent(u);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': `0-0/1` }, body: JSON.stringify(ACCOUNTS) });
    if (!/\/rest\/v1\/app_data/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    // Leboncoin illisible : la ligne des ventes répond 500 (le serveur, pas une liste vide).
    if (lbcKO && /id=eq\.lbc_ventes/.test(ud)) return r.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
    const s = servir(ROWS, ud.replace(/\+/g, ' ').replace(/#/g, '%23'), q.headers());
    return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': s.range }, body: JSON.stringify(s.body) });
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, erreurs };
}

// « CA entre deux dates » : le calendrier de SA carte, raccourci « 7 jours ».
async function plage7(pg) {
  const carte = pg.locator('div', { has: pg.locator('div', { hasText: /^CA entre deux dates$/ }) }).filter({ has: pg.locator('[data-periode-ouvrir]') }).last();
  await carte.waitFor({ timeout: 20000 });
  await carte.locator('[data-periode-ouvrir]').first().click({ timeout: 6000 });
  await pg.waitForSelector('[data-periode-panneau]', { timeout: 4000 });
  await pg.click('[data-periode-panneau] [data-periode-raccourci="j7"]');
  await pg.waitForFunction(() => { const e = document.querySelector('[data-ca-plage]'); return e && e.getAttribute('data-ca-plage') !== ''; }, null, { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(500);
  return pg.evaluate(() => {
    const e = document.querySelector('[data-ca-plage]');
    return { v: e && e.getAttribute('data-ca-plage'), auMoins: e && e.getAttribute('data-ca-plage-au-moins'), montant: e && e.textContent, t: (document.querySelector('[data-ca-plage-phrase]') || {}).textContent || '' };
  });
}
const lirePlateformes = (pg) => pg.evaluate(() => { const c = document.querySelector('[data-stats-carte="plateformes"]'); return c ? c.innerText.replace(/\s+/g, ' ') : null; });
const debord = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const capture = async (pg, sel, nom) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); const el = sel === '[data-ca-plage]' ? pg.locator(sel).first().locator('xpath=../..') : pg.locator(sel).first(); await el.scrollIntoViewIfNeeded().catch(() => {}); await pg.waitForTimeout(250); await el.screenshot({ path: path.join(SHOTS, nom + '.png') }).catch((e) => console.log('   (capture ' + nom + ' : ' + e.message.slice(0, 80) + ')')); };

(async () => {
  srv.listen(PORT);
  let nav;
  try {
    nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    const TAILLES = [['390', { width: 390, height: 844 }, false], ['390 sombre', { width: 390, height: 844 }, true], ['1512', { width: 1512, height: 950 }, false]];
    for (const [nom, vp, sombre] of TAILLES) {
      console.log(`\n══ ${nom}`);
      { // S1 + S2 : tout lu
        const { ctx, pg, erreurs } = await ouvrir(nav, vp, { sombre, tab: 'dashboard' });
        try {
          const r = await plage7(pg);
          dit(r.v === '30500', `S1 ${nom} · 7 jours = 305,00 € (Vinted 110 + Leboncoin 45 + Vestiaire 150)`, JSON.stringify(r));
          dit(/^4 ventes finalisées /.test(r.t) && /toutes plateformes/.test(r.t) && !/Vinted, tous comptes/.test(r.t), `S1 ${nom} · « 4 ventes finalisées … toutes plateformes »`, r.t);
          dit(/hors total[^:]*: 1 Vestiaire/.test(r.t) && r.auMoins === '0', `S1 ${nom} · la vente Vestiaire au montant pas sûr est DITE hors total ; tout lu ⇒ pas « au moins »`, r.t + ' · auMoins=' + r.auMoins);
          await capture(pg, '[data-ca-plage]', `ca-plage-${nom.replace(' ', '-')}`);
          const p = await lirePlateformes(pg);
          dit(p && /Leboncoin[^€]*\b45(,00)?\s?€/.test(p) && !/115(,00)?\s?€/.test(p), `S2 ${nom} · « Finalisé par plateforme » : Leboncoin 45 € (le compte écarté hors)`, p && p.slice(0, 300));
          await capture(pg, '[data-stats-carte="plateformes"]', `plateformes-${nom.replace(' ', '-')}`);
          dit((await debord(pg)) <= 0, `S4 ${nom} · aucun débordement horizontal`);
          dit(!erreurs.length, `S4 ${nom} · aucune erreur`, erreurs[0]);
        } catch (e) { dit(false, `S1 ${nom} · l'écran se lit`, String(e.message).slice(0, 200)); }
        await ctx.close();
      }
      { // S3 : Leboncoin illisible
        const { ctx, pg, erreurs } = await ouvrir(nav, vp, { sombre, tab: 'dashboard', lbcKO: true });
        try {
          const r = await plage7(pg);
          dit(r.v === '26000' && r.auMoins === '1' && /^au moins /.test(r.montant || '') && /Leboncoin pas lu/.test(r.t), `S3 ${nom} · Leboncoin illisible : « au moins 260 € », « Leboncoin pas lu »`, JSON.stringify(r));
          await capture(pg, '[data-ca-plage]', `ca-plage-lbc-ko-${nom.replace(' ', '-')}`);
          await pg.goto(`http://localhost:${PORT}/?tab=cat_bord`, { waitUntil: 'domcontentloaded' });
          await pg.waitForFunction(() => document.querySelector('[data-colis-recap]') || /pas pu s'afficher/.test(document.body.innerText), null, { timeout: 25000 }).catch(() => {});
          await pg.waitForFunction(() => { const e = document.querySelector('[data-colis-recap]'); return e && e.getAttribute('data-colis-recap-au-moins') === '1'; }, null, { timeout: 15000 }).catch(() => {});
          const c = await pg.evaluate(() => { const e = document.querySelector('[data-colis-recap]'); return e ? { auMoins: e.getAttribute('data-colis-recap-au-moins'), t: (e.querySelector('[data-colis-recap-texte]') || {}).textContent || '' } : null; });
          dit(c && c.auMoins === '1' && /ventes Leboncoin pas lues/.test(c.t), `S3 ${nom} · Colis : le récapitulatif dit « au moins » et nomme Leboncoin`, JSON.stringify(c));
          dit(!erreurs.length, `S4 ${nom} · aucune erreur (Leboncoin illisible)`, erreurs[0]);
        } catch (e) { dit(false, `S3 ${nom} · l'écran se lit`, String(e.message).slice(0, 200)); }
        await ctx.close();
      }
    }
  } catch (e) { dit(false, 'le banc s’exécute', String(e.message || e).slice(0, 200)); }
  finally {
    if (nav) await nav.close(); srv.close();
    console.log(ko ? `\n❌ parite-plateformes : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ parite-plateformes : ${ok} verts, 0 rouge`);
    process.exit(ko ? 1 : 0);
  }
})();
