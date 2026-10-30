// ═══════════════════════════════════════════════════════════════════════════
// BANC : « LE BOOST EST-IL RENTABLE ? » (Statistiques, 21 octobre)
//        npm run build && BANC_PORT=4493 node scripts/bancs/boost-rentable.cjs
// ═══════════════════════════════════════════════════════════════════════════
// Données INVENTÉES (ce banc vit dans le dépôt, qui est public), à 1512 px et
// à 390 px tactile :
//   A. 6 paires boostées (preuve `promoted` ou « Boost payé » saisi) et 6 non
//      boostées, toutes à 50 € : la carte compare — délai 3 j contre 10 j,
//      vues, favoris, marge boost déduit (27 € contre 30 €) — et écrit la
//      couverture (6 boostées dont 6 avec montant · 6 non boostées) ;
//   B. 3 boostées seulement : « pas assez de ventes pour juger », aucun chiffre
//      comparé (que des « — ») ;
//   C. transactions illisibles (522) : « pas pu lire », aucun chiffre ;
//   D. deux paires AU MÊME TITRE, une boostée vendue sans transaction reliée :
//      elle n'est pas comptée boostée (jamais par le titre).
// Jugé sur les attributs `data-boost-*`, jamais sur un libellé (§6.5).
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('/home/user/cancale-v67/node_modules/playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4493;

const J = 86400000;
const maintenant = Date.now();
const iso = (t) => new Date(t).toISOString();
const accounts = [{ id: 1, vinted_user_id: '111', login: 'atelier_sneak', domain: 'www.vinted.fr', updated_at: iso(maintenant), created_at: iso(maintenant - 90 * J), owner: null }];

// nb boostées, nnb non boostées ; `sansTx` : nombre de boostées dont la
// transaction ne relie pas l'annonce.
function jeu({ nb = 6, nnb = 6, sansTx = 0 } = {}) {
  const ventes = [], txns = [], items = [], fiches = {};
  let i = 0;
  const pose = (cote, k) => {
    i += 1;
    const item = 700000 + i, tx = 900000 + i;
    const enLigne = maintenant - 40 * J + i * J;
    const delai = cote === 'b' ? 3 : 10;
    ventes.push({ transaction_id: tx, id: tx, title: 'Baskets inventées taille 42', price: { amount: '50', currency_code: 'EUR' }, status: 'Commande finalisée', date: iso(enLigne + delai * J) });
    if (!(cote === 'b' && k < sansTx)) txns.push({ id: `harvest_111_txn_${tx}`, data: { capturedAt: iso(maintenant), payload: { transaction: { id: tx, item_id: item, status: 450, status_title: 'Commande finalisée', status_updated_at: iso(enLigne + (delai + 2) * J) } } } });
    items.push({ id: item, title: 'Baskets inventées taille 42', price: { amount: '50', currency_code: 'EUR' }, is_closed: true, item_closing_action: 'sold', promoted: cote === 'b' ? (k % 2 === 0) : false, view_count: cote === 'b' ? 200 : 80, favourite_count: cote === 'b' ? 12 : 4, created_at_ts: Math.floor(enLigne / 1000) });
    fiches[String(item)] = { numero: String(i), buyPrice: '20', ...(cote === 'b' ? { fees: '3' } : {}) };
  };
  for (let k = 0; k < nb; k++) pose('b', k);
  for (let k = 0; k < nnb; k++) pose('nb', k);
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
const TAILLES = [{ nom: '1512', vp: { width: 1512, height: 950 } }, { nom: '390', vp: { width: 390, height: 844 }, isMobile: true, hasTouch: true }];

async function ouvrir(b, T, { rows, main }, opts = {}) {
  const ctx = await b.newContext({ viewport: T.vp, isMobile: !!T.isMobile, hasTouch: !!T.hasTouch });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
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
  await pg.waitForFunction(() => { const e = document.querySelector('[data-stats-carte="boost"]'); return (e && e.getAttribute('data-boost-etat') !== 'encours') || /pas pu s'afficher/.test(document.body.innerText); }, null, { timeout: 25000 }).catch(() => {});
  await pg.waitForTimeout(600);
  return { ctx, pg, errs };
}
const lire = (pg) => pg.evaluate(() => {
  const e = document.querySelector('[data-stats-carte="boost"]');
  if (!e) return null;
  const o = {}; for (const a of e.getAttributeNames()) if (a.startsWith('data-boost-')) o[a.slice(11)] = e.getAttribute(a);
  o.vals = {}; for (const v of e.querySelectorAll('[data-boost-val]')) o.vals[v.getAttribute('data-boost-val')] = { t: v.textContent.trim(), c: getComputedStyle(v).color };
  o.verdict = !!e.querySelector('[data-boost-verdict="pas-assez"]');
  o.texte = e.innerText;
  o.deborde = e.scrollWidth > e.clientWidth + 1;
  return o;
});
const sansCouleurJugement = (vals) => Object.values(vals).every((v) => { const m = /rgb\((\d+), ?(\d+), ?(\d+)/.exec(v.c) || []; const [r, g, b] = [+m[1], +m[2], +m[3]]; return !(g > r + 40 && g > b + 20) && !(r > g + 60 && r > b + 60); });

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const T of TAILLES) {
      console.log(`\n══ ${T.nom} px${T.hasTouch ? ' (tactile)' : ''}`);
      await essaie('A' + T.nom, async () => {
        console.log('── A. 6 boostées / 6 non boostées');
        const { ctx, pg, errs } = await ouvrir(b, T, jeu());
        const R = await lire(pg);
        dit(!!R && R.etat === 'lu', 'la carte « Le boost est-il rentable ? » est sur Statistiques', JSON.stringify(R && R.etat));
        if (R) {
          dit(R.b === '6' && R.montant === '6' && R.nb === '6' && R.comp === '6/6', 'couverture : 6 boostées dont 6 avec montant · 6 non boostées · 6/6 comparées', JSON.stringify([R.b, R.montant, R.nb, R.comp]));
          dit(R.assez === 'oui' && !R.verdict, 'assez pour juger');
          dit(R.vals['delai-b'] && /^3\s*j$/.test(R.vals['delai-b'].t) && /^10\s*j$/.test(R.vals['delai-nb'].t), 'délai médian 3 j contre 10 j', JSON.stringify([R.vals['delai-b'], R.vals['delai-nb']]));
          dit(R.vals['vues-b'] && R.vals['vues-b'].t === '200' && R.vals['favoris-nb'].t === '4', 'vues et favoris', JSON.stringify([R.vals['vues-b'], R.vals['favoris-nb']]));
          dit(R.vals['marge-b'] && /27/.test(R.vals['marge-b'].t) && /30/.test(R.vals['marge-nb'].t), 'marge boost déduit : 27 € contre 30 €', JSON.stringify([R.vals['marge-b'], R.vals['marge-nb']]));
          dit(sansCouleurJugement(R.vals), 'aucune couleur verte ni rouge sur les chiffres');
          dit(/rien ici n.entre dans un total/.test(R.texte), 'la carte dit qu’elle n’entre dans aucun total');
          dit(!R.deborde, 'aucun débordement dans la carte');
        }
        const deb = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        dit(deb <= 1, 'aucun débordement horizontal', `${deb}px`);
        if (process.env.BANC_CAPTURE) await pg.locator('[data-stats-carte="boost"]').screenshot({ path: path.join(process.env.BANC_CAPTURE, `boost-${T.nom}.png`) });
        dit(errs.length === 0, 'aucune erreur d’app', errs.join(' | ').slice(0, 160));
        await ctx.close();
      });
      await essaie('B' + T.nom, async () => {
        console.log('── B. 3 boostées seulement');
        const { ctx, pg, errs } = await ouvrir(b, T, jeu({ nb: 3 }));
        const R = await lire(pg);
        dit(!!R && R.etat === 'lu' && R.assez === 'non' && R.verdict, '« pas assez de ventes pour juger »', JSON.stringify(R && [R.etat, R.assez, R.verdict]));
        dit(!!R && Object.values(R.vals).every((v) => v.t === '—'), 'aucun chiffre comparé (tableau replié ou que des « — »)', JSON.stringify(R && R.vals));
        dit(errs.length === 0, 'aucune erreur d’app', errs.join(' | ').slice(0, 160));
        await ctx.close();
      });
      await essaie('C' + T.nom, async () => {
        console.log('── C. transactions illisibles');
        const { ctx, pg } = await ouvrir(b, T, jeu(), { txnKO: true });
        const R = await lire(pg);
        dit(!!R && R.etat === 'passu' && !/\d+\s*j\b/.test(R.texte), '« pas pu lire », aucun chiffre', JSON.stringify(R && R.etat));
        await ctx.close();
      });
      await essaie('D' + T.nom, async () => {
        console.log('── D. même titre, transaction non reliée');
        const { ctx, pg } = await ouvrir(b, T, jeu({ nb: 6, sansTx: 2 }));
        const R = await lire(pg);
        dit(!!R && R.b === '4' && /2 pas reliées/.test(R.texte), 'les 2 boostées sans transaction reliée ne comptent pas (jamais par le titre)', JSON.stringify(R && [R.b, R.texte.slice(0, 200)]));
        await ctx.close();
      });
    }
  } catch (e) { dit(false, 'banc', String(e && e.message || e)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} ${ok} verts, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
})();
