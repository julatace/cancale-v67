// ═══════════════════════════════════════════════════════════════════════════
// LEBONCOIN — LE DÉTAIL DES TRANSACTIONS EST LU, BORNÉ (1er octobre 2026)
//        node scripts/audit-lbc-details.cjs
// ═══════════════════════════════════════════════════════════════════════════
// Mesuré sur sa base : la vente « Nike air max 1 olive vert taille 43 » (58 €,
// tx 361842001) n'avait été vue que dans la LISTE `v3/pages/transactions`, qui
// ne dit pas qui vend. Côté inconnu + statut figé → elle ne sortait nulle part.
// Seul le DÉTAIL `v2/pages/transactions/{id}` porte `is_seller`.
//
// On exécute le VRAI `lbc-inject.js` dans une page, et on exige :
//   1. la liste déclenche la lecture du détail des transactions ;
//   2. au plus 5 par page (borne), jamais une transaction ANNULÉE ;
//   3. avec les en-têtes que le site a lui-même envoyés ;
//   4. chaque détail repart par le même chemin qu'une transaction ouverte à la main ;
//   5. une transaction TERMINÉE n'est pas relue à la visite suivante ;
//   6. l'autre sens : sans liste, aucune lecture (pas de bruit).
const { chromium } = require(require('path').join(__dirname, '..', 'node_modules', 'playwright'));
const fs = require('fs'), path = require('path');
const INJ = fs.readFileSync(path.join(__dirname, '..', 'vinted-sync-extension', 'lbc-inject.js'), 'utf8');

let ko = 0;
const dit = (ok, nom, det) => { if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${det ? ' — ' + det : ''}`); };
const essaie = async (nom, fn) => { try { return await fn(); } catch (e) { dit(false, nom, 'a levé : ' + e.message); return null; } };

// La liste, à la forme relevée dans sa base (`id.purchase_id`, `item`, `step`).
const LISTE = JSON.stringify([
  { id: { purchase_id: 361842001 }, item: { title: 'Nike air max 1 olive vert taille 43', price: 5800 }, step: 'ongoing' },
  { id: { purchase_id: 111 }, item: { title: 'A', price: 1000 }, step: 'done' },
  { id: { purchase_id: 222 }, item: { title: 'B', price: 1000 }, step: 'cancelled' },
  { id: { purchase_id: 333 }, item: { title: 'C', price: 1000 }, step: 'ongoing' },
  { id: { purchase_id: 444 }, item: { title: 'D', price: 1000 }, step: 'ongoing' },
  { id: { purchase_id: 555 }, item: { title: 'E', price: 1000 }, step: 'ongoing' },
  { id: { purchase_id: 666 }, item: { title: 'F', price: 1000 }, step: 'ongoing' },
]);
const detail = (id) => JSON.stringify({ is_seller: true, item: { id: 9000 + id, title: 'x', prices: { final: 5800 } }, step: { status: 'done', label: 'Vente finalisée' } });

(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const ctx = await nav.newContext();
  const pg = await ctx.newPage();
  const requetes = [];
  await pg.route('https://www.leboncoin.fr/**', (r) => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>' }));
  await pg.route('https://api.leboncoin.fr/**', (r) => {
    const u = r.request().url();
    const m = u.match(/v2\/pages\/transactions\/(\d+)/);
    if (m) { requetes.push({ id: m[1], h: r.request().headers() }); return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': 'https://www.leboncoin.fr', 'access-control-allow-credentials': 'true' }, body: detail(+m[1]) }); }
    if (/v3\/pages\/transactions/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': 'https://www.leboncoin.fr', 'access-control-allow-credentials': 'true' }, body: LISTE });
    r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  const visite = async (avecListe) => {
    await pg.goto('https://www.leboncoin.fr/compte/part/mes-transactions');
    await pg.evaluate(`window.__vus = []; window.addEventListener('message', (e) => { const d = e.data; if (d && d.__tag === 'CANCALE_LBC' && d.kind === 'lbcvente') window.__vus.push(d.url); });`);
    await pg.evaluate(INJ);
    if (avecListe) await pg.evaluate(`fetch('https://api.leboncoin.fr/api/consumergoods/proxy/v3/pages/transactions', { credentials: 'include', headers: { 'api_key': 'CLE-DU-SITE', 'Accept': 'application/json' } }).then(r => r.text())`).catch(() => {});
    await pg.waitForTimeout(3000);
    return pg.evaluate('window.__vus');
  };

  await essaie('première visite', async () => {
    const vus = await visite(true);
    const ids = requetes.map((q) => q.id);
    dit(ids.includes('361842001'), 'la liste déclenche la lecture du détail (dont la vente des Air Max olive)', 'lus : ' + ids.join(','));
    dit(ids.length === 5, 'au plus 5 détails lus par page', ids.length + ' lus');
    dit(!ids.includes('222'), 'une transaction ANNULÉE n\'est jamais relue');
    dit(requetes.every((q) => q.h['api_key'] === 'CLE-DU-SITE'), 'avec les en-têtes que le site a lui-même envoyés', JSON.stringify(requetes.map((q) => q.h['api_key'])));
    const relayes = vus.filter((u) => /v2\/pages\/transactions\/\d+/.test(u));
    dit(relayes.length === ids.length && ids.length > 0, 'chaque détail repart par le même chemin qu\'une transaction ouverte à la main', relayes.length + ' relayés');
  });

  await essaie('deuxième visite', async () => {
    const avant = requetes.length;
    await visite(true);
    const nouveaux = requetes.slice(avant).map((q) => q.id);
    dit(!nouveaux.includes('361842001') && !nouveaux.includes('111'), 'une transaction TERMINÉE (lue une fois) n\'est pas relue', 'relus : ' + nouveaux.join(','));
    dit(nouveaux.includes('666'), 'et celle qui restait (6e) est lue à la visite suivante', 'lus : ' + nouveaux.join(','));
  });

  await essaie('sans liste', async () => {
    const ctx2 = await nav.newContext(); const p2 = await ctx2.newPage();
    const req2 = [];
    await p2.route('https://www.leboncoin.fr/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body></body></html>' }));
    await p2.route('https://api.leboncoin.fr/**', (r) => { req2.push(r.request().url()); r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }); });
    await p2.goto('https://www.leboncoin.fr/'); await p2.evaluate(INJ); await p2.waitForTimeout(1500);
    dit(req2.length === 0, 'sans liste de transactions, aucune lecture (pas de bruit)', req2.length + ' requêtes');
    await ctx2.close();
  });

  await nav.close();
  console.log(ko ? `\n❌ ${ko} rouge(s)` : '\n✅ Le détail des transactions Leboncoin est lu, borné, sans bruit.');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error('❌ le banc est tombé :', e && e.message); process.exit(1); });
