// ═══════════════════════════════════════════════════════════════════════════
// BANC : « BOOST RENTABLE ? » (Statistiques — refait le 3 nov., une seule carte)
//        npm run build && BANC_PORT=4493 node scripts/bancs/boost-rentable.cjs
// ═══════════════════════════════════════════════════════════════════════════
// Données INVENTÉES (ce banc vit dans le dépôt, qui est public), période
// « Année », à 1512 px clair, 1512 px SOMBRE et 390 px tactile SOMBRE :
//   A. 6 Nike Dunk boostées (« Boost payé » 3 € saisi, `promoted` une sur deux)
//      dont 4 vendues en 3 j à 60 €, et 6 Dunk NON boostées dont 2 vendues en
//      10 j à 60 € ; une Samba boostée seule (aucune Samba non boostée : hors
//      comparaison). Calcul à la main : vendus 4/6 contre 2/6, délai 3 j contre
//      10 j, prix médian boost déduit 57 € contre 60 €, coût 18 €, montant saisi
//      6/6 ; couverture « 6 boostés · 6 autres » ;
//   B. 2 boostées seulement : « Pas assez de données », aucun chiffre comparé ;
//   C. transactions illisibles (522) : « — », aucun chiffre ;
//   D. deux ventes boostées SANS transaction reliée (même titre) : jamais
//      reliées par le titre ⇒ 2/6 vendues ;
//   E. une SEULE carte « Boost rentable ? » sur l'écran (l'ancienne est retirée).
// Jugé sur les attributs `data-sv-*`, jamais sur un libellé (§6.5).
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), os = require('os');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4493;

const J = 86400000;
const maintenant = Date.now();
const iso = (t) => new Date(t).toISOString();
const accounts = [{ id: 1, vinted_user_id: '111', login: 'atelier_sneak', domain: 'www.vinted.fr', updated_at: iso(maintenant), created_at: iso(maintenant - 90 * J), owner: null }];

// nb boostées (vb vendues), nnb non boostées (vnb vendues) ; `sansTx` : nombre de
// ventes boostées dont la transaction ne relie pas l'annonce.
function jeu({ nb = 6, vb = 4, nnb = 6, vnb = 2, sansTx = 0, samba = true } = {}) {
  const ventes = [], txns = [], items = [], fiches = {};
  let i = 0;
  const pose = (cote, k, vendu, titre = 'Nike Dunk Low blanc taille 42', marque = 'Nike') => {
    i += 1;
    const item = 700000 + i, tx = 900000 + i;
    const enLigne = maintenant - 60 * J + i * J;
    const delai = cote === 'b' ? 3 : 10;
    if (vendu) {
      ventes.push({ transaction_id: tx, id: tx, title: titre, price: { amount: '60', currency_code: 'EUR' }, status: 'Commande finalisée', date: iso(enLigne + delai * J) });
      if (!(cote === 'b' && k < sansTx)) txns.push({ id: `harvest_111_txn_${tx}`, data: { capturedAt: iso(maintenant), payload: { transaction: { id: tx, item_id: item, status: 450, status_title: 'Commande finalisée', status_updated_at: iso(enLigne + (delai + 2) * J) } } } });
    }
    items.push({ id: item, title: titre, brand_title: marque, size_title: '42', price: { amount: '60', currency_code: 'EUR' }, is_closed: !!vendu, ...(vendu ? { item_closing_action: 'sold' } : {}), promoted: cote === 'b' ? (k % 2 === 0) : false, view_count: 50, favourite_count: 3, created_at_ts: Math.floor(enLigne / 1000) });
    fiches[String(item)] = { numero: String(i), buyPrice: '20', ...(cote === 'b' ? { fees: '3' } : {}) };
  };
  for (let k = 0; k < nb; k++) pose('b', k, k < vb);
  for (let k = 0; k < nnb; k++) pose('nb', k, k < vnb);
  if (samba) pose('b', 99, true, 'Adidas Samba noir taille 41', 'Adidas');
  const rows = [
    { id: 'harvest_111_orders_sold', data: { capturedAt: iso(maintenant), payload: { my_orders: ventes } } },
    { id: 'harvest_111_listings', data: { capturedAt: iso(maintenant - 60000), payload: { items } } },
    ...txns,
    { id: 'lbc_ventes', data: { ventes: {} } },
    { id: 'ebay_orders', data: { orders: [] } },
  ];
  return { rows, main: { vinted_annonce_numeros: fiches } };
}

function projette(row, select) {
  if (!select || select === '*') return row;
  const out = {};
  for (const part of select.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const alias = m[1] || m[2].split('->').pop().replace(/^>/, ''); const src = m[2];
    if (src === 'id' || src === 'updated_at') { out[alias] = row[src]; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (/^data(->|->>)/.test(src)) { const reste = src.replace(/^data(->>|->)/, ''); let v = row.data;
      for (const seg of reste.split(/->>|->/)) v = (v == null ? null : v[seg]); out[alias] = (v == null) ? null : v; continue; }
    out[alias] = row[src];
  }
  return out;
}
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.onnx': 'application/octet-stream' };
const srv = http.createServer((q, r) => { let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p)); });
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);

let ko = 0, ok = 0; const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 160)); } };
const TAILLES = [{ nom: '1512', vp: { width: 1512, height: 950 } }, { nom: '1512-sombre', vp: { width: 1512, height: 950 }, sombre: true }, { nom: '390-sombre', vp: { width: 390, height: 844 }, isMobile: true, hasTouch: true, sombre: true }];

async function ouvrir(b, T, { rows, main }, opts = {}) {
  const ctx = await b.newContext({ viewport: T.vp, isMobile: !!T.isMobile, hasTouch: !!T.hasTouch });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((sombre) => { try { localStorage.setItem('vrm_acces_direct', '1'); if (sombre) localStorage.setItem('vinted_dark', 'true'); } catch (_) {} }, !!T.sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    if (opts.txnKO && /_txn_/.test(u)) return route.fulfill({ status: 522, contentType: 'text/html', body: '<html>522</html>' });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    const S = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(accounts);
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq && eq[1] === 'main') return j([projette({ id: 'main', data: main }, S)]);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map((r) => projette(r, S)));
    const lk = /id=like\.([^&]*)/.exec(u); if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map((r) => projette(r, S))); }
    return j([]);
  });
  await pg.route('**/api/**', (r2) => r2.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=dashboard`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('[data-sv-choix="annee"]', { timeout: 25000 }).catch(() => {});
  await pg.click('[data-sv-choix="annee"]').catch(() => {});
  await pg.waitForFunction(() => { const e = document.querySelector('[data-sv-carte="boost"]'); return (e && e.getAttribute('data-sv-etat') !== 'encours') || /pas pu s'afficher/.test(document.body.innerText); }, null, { timeout: 25000 }).catch(() => {});
  await pg.waitForTimeout(700);
  return { ctx, pg, errs };
}
const lire = (pg) => pg.evaluate(() => {
  const toutes = document.querySelectorAll('[data-sv-carte="boost"], [data-stats-carte="boost"]').length;
  const e = document.querySelector('[data-sv-carte="boost"]');
  if (!e) return { toutes };
  const A = (k) => { const x = e.querySelector(`[data-sv-boost="${k}"]`); return x ? x.getAttribute('data-v') : null; };
  const cout = e.querySelector('[data-sv-boost="cout"]');
  const vals = [...e.querySelectorAll('.vrm-sv-boost-val')].map((v) => ({ t: v.textContent.trim(), c: getComputedStyle(v).color }));
  return { toutes, etat: e.getAttribute('data-sv-etat'), b: e.getAttribute('data-sv-boostees'), nb: e.getAttribute('data-sv-autres'),
    vendues: A('vendues'), delai: A('delai'), prix: A('prix'), cout: cout ? cout.getAttribute('data-v') : null, couv: cout ? cout.getAttribute('data-couv') : null,
    pasAssez: (e.querySelector('[data-sv-boost-pas-assez]') || { getAttribute: () => null }).getAttribute('data-sv-boost-pas-assez'),
    vals, texte: e.innerText, deborde: e.scrollWidth > e.clientWidth + 1 };
});
const sansCouleurJugement = (vals) => vals.every((v) => { const m = /rgb\((\d+), ?(\d+), ?(\d+)/.exec(v.c) || []; const [r, g, b] = [+m[1], +m[2], +m[3]]; return !(g > r + 40 && g > b + 20) && !(r > g + 60 && r > b + 60); });

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const T of TAILLES) {
      console.log(`\n══ ${T.nom} px${T.hasTouch ? ' (tactile)' : ''}`);
      await essaie('A' + T.nom, async () => {
        console.log('── A. 6 Dunk boostées / 6 Dunk non boostées (+ une Samba boostée seule)');
        const { ctx, pg, errs } = await ouvrir(b, T, jeu());
        const R = await lire(pg);
        dit(R.toutes === 1, 'E · UNE seule carte « Boost rentable ? » sur Statistiques', String(R.toutes));
        dit(R.etat === 'lu', 'la carte compare', R.etat);
        dit(R.b === '6' && R.nb === '6', 'couverture : 6 boostés · 6 autres du même modèle (la Samba seule n’entre pas)', JSON.stringify([R.b, R.nb]));
        dit(R.vendues === '4/6|2/6', 'vendus 4/6 contre 2/6', R.vendues);
        dit(R.delai === '3|10', 'délai médian 3 j contre 10 j', R.delai);
        dit(R.prix === '5700|6000', 'prix médian boost déduit 57 € contre 60 €', R.prix);
        dit(R.cout === '1800' && R.couv === '6/6', 'coût des boosts 18 €, montant saisi 6/6', JSON.stringify([R.cout, R.couv]));
        dit(sansCouleurJugement(R.vals), 'aucune couleur verte ni rouge sur les chiffres');
        dit(!R.deborde, 'aucun débordement dans la carte');
        const deb = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        dit(deb <= 1, 'aucun débordement horizontal', `${deb}px`);
        await pg.locator('[data-sv-carte="boost"]').scrollIntoViewIfNeeded().catch(() => {});
        await pg.locator('[data-sv-carte="boost"]').screenshot({ path: path.join(process.env.BANC_CAPTURE || os.tmpdir(), `boost-${T.nom}.png`) }).catch(() => {});
        dit(errs.length === 0, 'aucune erreur d’app', errs.join(' | ').slice(0, 160));
        await ctx.close();
      });
      await essaie('B' + T.nom, async () => {
        console.log('── B. 2 boostées seulement');
        const { ctx, pg, errs } = await ouvrir(b, T, jeu({ nb: 2, vb: 1, samba: false }));
        const R = await lire(pg);
        dit(R.etat === 'pas-assez' && R.pasAssez === '2', '« Pas assez de données » (2 boostés sur 3)', JSON.stringify([R.etat, R.pasAssez]));
        dit(R.vendues == null && R.delai == null && R.prix == null && !/\d+\s*j\b/.test(R.texte), 'aucun chiffre comparé', R.texte);
        dit(errs.length === 0, 'aucune erreur d’app', errs.join(' | ').slice(0, 160));
        await ctx.close();
      });
      await essaie('C' + T.nom, async () => {
        console.log('── C. transactions illisibles');
        const { ctx, pg } = await ouvrir(b, T, jeu(), { txnKO: true });
        const R = await lire(pg);
        dit(R.etat === 'passu' && R.vendues == null && !/\d+\s*j\b/.test(R.texte), '« — », aucun chiffre', JSON.stringify(R.etat));
        await ctx.close();
      });
      await essaie('D' + T.nom, async () => {
        console.log('── D. même titre, transaction non reliée');
        const { ctx, pg } = await ouvrir(b, T, jeu({ sansTx: 2 }));
        const R = await lire(pg);
        dit(R.vendues === '2/6|2/6', 'les 2 ventes boostées sans transaction reliée ne rendent rien « vendu » (jamais par le titre)', R.vendues);
        await ctx.close();
      });
    }
  } catch (e) { dit(false, 'banc', String(e && e.message || e)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} ${ok} verts, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
})();
