// Banc : LES VENTES ET LES COLIS SE METTENT À JOUR SANS CLIGNOTER, ET SANS MENTIR
// (node scripts/bancs/fluidite.cjs — données INVENTÉES, il vit dans le dépôt).
//
// Julien, 4 octobre : « le statut en transit, colis à faire, vendu et tout le
// reste doit être beaucoup plus fluide et fiable quand l'extension est
// connectée ». Mesuré dans le code :
//   1. chaque signal de l'extension (« ventes rangées », toutes les 90 s quand il
//      navigue sur Vinted) remettait la liste à vide : Ventes et Colis
//      affichaient un SQUELETTE, la liste disparaissait, le défilement sautait ;
//   2. un signal reçu pendant qu'il était sur un autre écran était JETÉ : en
//      revenant sur Ventes, l'ancienne liste restait ;
//   3. une lecture ratée de NOTRE base (`harvest_*_orders_*`) envoyait l'app
//      interroger Vinted par le relais du serveur (jetons depuis l'IP de Vercel) ;
//   4. une lecture ratée des bordereaux email rangeait chaque colis en « en
//      attente de bordereau », sans un mot.
// Le banc rejoue le signal de l'extension (`vrm:ext`, la même forme que
// bridge.js) et juge sur le DOM : nœuds conservés, squelettes comptés,
// requêtes comptées, attribut d'alerte présent.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = 4352;

const auj = new Date();
const ilYa = (h) => new Date(auj.getTime() - h * 3600000).toISOString();
const vente = (id, titre, statut, tus, h) => ({ transaction_id: id, title: titre, price: { amount: '50', currency_code: 'EUR' }, status: statut, transaction_user_status: tus, date: ilYa(h) });
const BASE = [
  vente(9201, 'Nike Air Max 1 olive taille 42', 'Bordereau envoyé au vendeur', 'needs_action', 30),
  vente(9202, 'Salomon XT-6 blanc taille 40', "Commande expédiée et en cours d'acheminement ! ", 'waiting', 50),
  vente(9203, 'Adidas Spezial noir taille 38', "Commande finalisée - l'acheteur a validé la commande", 'completed', 90),
];
const NOUVELLE = vente(9204, 'Asics Gel Kayano 14 argent taille 43', 'Le paiement a été validé', 'needs_action', 1);
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];

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

// Une page, une base inventée ; `etat` se modifie pendant le test.
async function ouvrir(b, vp, etat) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const proxy = [];
  await pg.addInitScript(() => {
    try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {}
    // Compte les squelettes qui APPARAISSENT après le premier chargement.
    window.__squelettes = 0;
    new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) {
      if (!(n instanceof Element)) continue;
      const tous = [n, ...n.querySelectorAll('*')];
      if (tous.some((x) => /cancaleSkeleton/.test((x.getAttribute && x.getAttribute('style')) || ''))) window.__squelettes++;
    } }).observe(document, { childList: true, subtree: true });
  });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    const panne = () => route.fulfill({ status: 522, contentType: 'text/html', headers: { 'access-control-allow-origin': '*' }, body: '<html>522</html>' });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    if (etat.ventesKO && /harvest_111_orders_/.test(u)) return panne();
    if (etat.bordsKO && /email_bord_/.test(u)) return panne();
    const rows = [
      { id: 'harvest_111_orders_sold', data: { capturedAt: etat.cap, payload: { my_orders: etat.ventes } } },
      { id: 'harvest_111_orders_purchased', data: { capturedAt: etat.cap, payload: { my_orders: [] } } },
    ];
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: auj.toISOString(), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => {
    if (/vinted-proxy/.test(r.request().url())) proxy.push(String(r.request().postData() || '').slice(0, 120));
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' });
  });
  return { ctx, pg, errs, proxy };
}
const signal = (pg, quoi) => pg.evaluate((q) => window.dispatchEvent(new CustomEvent('vrm:ext', { detail: { type: 'maj', quoi: q, uid: '111' } })), quoi);
const texte = (pg) => pg.evaluate(() => document.body.innerText);

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      console.log(`── ${vp.width} px`);
      // ── 1. Une vente arrive pendant qu'il regarde Ventes ─────────────────
      {
        const etat = { ventes: [...BASE], cap: ilYa(2) };
        const { ctx, pg, errs } = await ouvrir(b, vp, etat);
        await pg.goto(`http://localhost:${PORT}/?tab=cat_ventes`, { waitUntil: 'domcontentloaded' });
        await pg.waitForTimeout(3500);
        try { await pg.getByText('Toutes', { exact: true }).first().click({ timeout: 3000 }); await pg.waitForTimeout(600); } catch (_) {}
        const pose = await pg.evaluate(() => {
          const el = [...document.querySelectorAll('div,span')].find((x) => x.childElementCount === 0 && /Nike Air Max 1 olive/.test(x.textContent || ''));
          if (el) { window.__marque = el; window.__squelettes = 0; }
          return !!el;
        });
        dit(pose, 'la liste des ventes est affichée au départ');
        etat.ventes = [NOUVELLE, ...BASE]; etat.cap = ilYa(0);
        for (let i = 0; i < 5; i++) { await signal(pg, 'ventes'); await pg.waitForTimeout(150); }
        await pg.waitForTimeout(2500);
        const r = await pg.evaluate(() => ({ sq: window.__squelettes, garde: !!(window.__marque && window.__marque.isConnected) }));
        dit(r.sq === 0, 'cinq signaux « ventes » de l’extension : AUCUN squelette ne réapparaît', `${r.sq} squelette(s)`);
        dit(r.garde, 'la liste n’est pas démontée pendant la relecture (le défilement ne saute pas)');
        dit(/Asics Gel Kayano 14 argent/.test(await texte(pg)), 'la nouvelle vente apparaît, sans rien toucher');
        dit(errs.length === 0, 'aucune erreur d’app', errs.join(' | ').slice(0, 160));
        await ctx.close();
      }
      // ── 2. Le signal arrive pendant qu'il est sur Achats ───────────────
      {
        const etat = { ventes: [...BASE], cap: ilYa(2) };
        const { ctx, pg, errs } = await ouvrir(b, vp, etat);
        await pg.goto(`http://localhost:${PORT}/?tab=plat_vinted`, { waitUntil: 'domcontentloaded' });
        await pg.waitForTimeout(3000);
        try { await pg.click('[data-section="achats"]', { timeout: 4000 }); } catch (_) {}
        await pg.waitForTimeout(1500);
        etat.ventes = [NOUVELLE, ...BASE]; etat.cap = ilYa(0);
        await signal(pg, 'ventes');
        await pg.waitForTimeout(600);
        let bascule = false;
        try { await pg.click('[data-section="ventes"]', { timeout: 4000 }); bascule = true; } catch (_) {}
        dit(bascule, 'on revient sur Ventes par son onglet');
        await pg.waitForTimeout(3000);
        try { await pg.getByText('Toutes', { exact: true }).first().click({ timeout: 3000 }); await pg.waitForTimeout(600); } catch (_) {}
        dit(/Asics Gel Kayano 14 argent/.test(await texte(pg)), 'un signal reçu sur un AUTRE écran n’est pas perdu : la vente est là en revenant');
        dit(errs.length === 0, 'aucune erreur d’app', errs.join(' | ').slice(0, 160));
        await ctx.close();
      }
      // ── 3. Notre base ne répond pas sur les ventes ─────────────────────
      {
        const etat = { ventes: [...BASE], cap: ilYa(2), ventesKO: true };
        const { ctx, pg, errs, proxy } = await ouvrir(b, vp, etat);
        await pg.goto(`http://localhost:${PORT}/?tab=cat_ventes`, { waitUntil: 'domcontentloaded' });
        await pg.waitForTimeout(4500);
        const surVentes = proxy.filter((x) => /my_orders/.test(x));
        dit(surVentes.length === 0, 'une lecture ratée de NOTRE base n’envoie jamais l’app chercher les VENTES chez Vinted par le relais', `${surVentes.length} appel(s) au relais : ${surVentes.join(' | ')}`);
        dit(errs.length === 0, 'aucune erreur d’app', errs.join(' | ').slice(0, 160));
        await ctx.close();
      }
      // ── 4. Les bordereaux email ne répondent pas ───────────────────────
      {
        const etat = { ventes: [...BASE], cap: ilYa(2), bordsKO: true };
        const { ctx, pg, errs } = await ouvrir(b, vp, etat);
        await pg.goto(`http://localhost:${PORT}/?tab=cat_bord`, { waitUntil: 'domcontentloaded' });
        await pg.waitForTimeout(4500);
        const n = await pg.evaluate(() => document.querySelectorAll('[data-bords-ko]').length);
        dit(n === 1, 'Colis DIT que les bordereaux email n’ont pas pu être lus (une fois)', `${n} ligne(s)`);
        const recap = await pg.evaluate(() => { const e = document.querySelector('[data-colis-recap]'); return e ? e.innerText : null; });
        dit(recap !== null && !/en attente de bordereau/.test(recap), 'le récapitulatif n’annonce pas « en attente de bordereau » sur une lecture ratée', JSON.stringify(recap).slice(0, 160));
        const sw = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
        dit(sw.sw <= sw.cw + 1, 'aucun débordement horizontal', `${sw.sw} > ${sw.cw}`);
        dit(errs.length === 0, 'aucune erreur d’app', errs.join(' | ').slice(0, 160));
        await pg.screenshot({ path: path.join(require('os').tmpdir(), 'fluidite-colis-' + vp.width + '.png') });
        // Et l'autre sens : la base revient, l'alerte s'en va toute seule.
        etat.bordsKO = false;
        await pg.waitForTimeout(21500);
        const apres = await pg.evaluate(() => document.querySelectorAll('[data-bords-ko]').length);
        dit(apres === 0, 'quand la base répond de nouveau, l’alerte disparaît toute seule (nouvel essai)', `${apres} ligne(s)`);
        await ctx.close();
      }
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(`\n${ko ? `❌ ${ko} échec(s)` : '✅ tout est vert'}`);
  process.exit(ko ? 1 : 0);
})();
