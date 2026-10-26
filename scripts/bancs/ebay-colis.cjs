// ═══════════════════════════════════════════════════════════════════════════
// BANC : LES VENTES eBAY À POSTER DANS COLIS ET MA JOURNÉE (19 octobre)
//        (node scripts/bancs/ebay-colis.cjs — après `npm run build` ;
//         BANC_PORT pour changer de port, 8041 par défaut)
// ═══════════════════════════════════════════════════════════════════════════
// « Rien ne se passe après une vente eBay » (docs/passation/notes/agent-ebay/
// etat.md) : la commande eBay payée n'était visible que dans eBay → Ventes.
// Ce banc rend l'app sur des données INVENTÉES (il vit dans le dépôt, public) :
//   Vinted 9301 à envoyer (compte_a) ;
//   eBay  E-1 payée, à poster, limite hier, SKU VRM-12        ⇒ à poster, en retard, N°12
//         E-2 payée, à poster, limite demain, authentification ⇒ à poster, signalée
//         E-3 expédiée · E-5 retrait · E-6 annulée · E-7 pas payée ⇒ rien
//         E-4 annulation demandée                              ⇒ « Ne poste pas »
// Il exige, aux deux tailles (390 px tactile, 1512 px) :
//   1. Colis : le total du haut = 1 Vinted + 2 eBay (`data-colis-recap`) ;
//      le bloc eBay nomme EXACTEMENT E-1 et E-2, avec leur N° (SKU) et leurs
//      jours, le lien vers la commande sur eBay ; « Ne poste pas » nomme E-4 ;
//   2. Ma journée : « À envoyer » porte le MÊME nombre (`data-n`, `data-ebay`)
//      et l'action « Ne poste pas » ;
//   3. la cloche reçoit le même total (`vrm_colis_aposter`) ;
//   4. « Suivi et message à l'acheteur » ouvre eBay → Ventes sur CETTE commande ;
//   5. « pas su » : commandes eBay illisibles ⇒ dit, « au moins », et jamais
//      « Tout est à jour » ;
//   6. aucun débordement, aucune erreur, aucun écran tombé.
// On juge les ATTRIBUTS et les nombres rendus, jamais une formulation.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 8041;

const MAINTENANT = Date.now();
const H = 3600000, J = 24 * H;
const ilYaH = (h) => new Date(MAINTENANT - h * H).toISOString();
const dansJ = (j) => new Date(MAINTENANT + j * J).toISOString();
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: ilYaH(0) }];
const cmd = (id, o = {}) => ({
  orderId: id, creationDate: ilYaH(30), orderPaymentStatus: 'PAID', orderFulfillmentStatus: 'NOT_STARTED',
  cancelStatus: { cancelState: 'NONE_REQUESTED' }, fulfillmentStartInstructions: [{ fulfillmentInstructionsType: 'SHIP_TO' }],
  pricingSummary: { total: { value: '80.00', currency: 'EUR' } }, buyer: { username: 'acheteur_' + id },
  lineItems: [{ lineItemId: '1' + id.slice(-1), title: 'eBay Paire ' + id, sku: o.sku || '', legacyItemId: '55' + id.slice(-1), quantity: 1,
    lineItemCost: { value: '80.00', currency: 'EUR' }, lineItemFulfillmentInstructions: { shipByDate: dansJ(o.dj == null ? 3 : o.dj) }, ...(o.li || {}) }],
  ...(o.x || {}),
});
const COMMANDES = [
  cmd('E-1', { dj: -1, sku: 'VRM-12' }),
  cmd('E-2', { dj: 1, sku: 'VRM-13', li: { program: { authenticityVerification: { status: 'PENDING' } } } }),
  cmd('E-3', { x: { orderFulfillmentStatus: 'FULFILLED' } }),
  cmd('E-4', { sku: 'VRM-14', x: { cancelStatus: { cancelState: 'CANCEL_REQUESTED' } } }),
  cmd('E-5', { x: { fulfillmentStartInstructions: [{ fulfillmentInstructionsType: 'PREPARE_FOR_PICKUP' }] } }),
  cmd('E-6', { x: { cancelStatus: { cancelState: 'CANCELED' } } }),
  cmd('E-7', { x: { orderPaymentStatus: 'PENDING' } }),
];
const ROWS = [
  { id: 'main', data: { vinted_ship_done: {} } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: ilYaH(0.2), payload: { my_orders: [
    { transaction_id: 9301, title: 'Vinted Paire 9301', price: { amount: '50.0', currency_code: 'EUR' }, status: 'Le paiement a été validé', transaction_user_status: 'needs_action', date: ilYaH(20) },
  ] } } },
  { id: 'ebay_orders', data: { capturedAt: MAINTENANT - 2 * H, orders: COMMANDES } },
];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 140)); } };

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.onnx': 'application/octet-stream' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul (BANC_PORT=…)'); process.exit(1); });
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
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' ? String(v) : v);
  }
  return out;
};

async function preparer(b, vp, { ebayKO = false } = {}) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    if (ebayKO && /id=(eq|like)\.ebay_orders/.test(u)) return route.fulfill({ status: 503, contentType: 'text/html', headers: { 'access-control-allow-origin': '*' }, body: '<html>503</html>' });
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: r.data.capturedAt || ilYaH(0), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs };
}
async function sain(pg, ecran) {
  const r = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, t: document.body.innerText }));
  dit(r.sw <= r.cw + 1, `${ecran} : aucun débordement horizontal`, `${r.sw} > ${r.cw}`);
  const m = /n'a pas pu s'afficher|n’a pas pu s’afficher|Cannot access|is not defined/.exec(r.t);
  dit(!m, `${ecran} : l'écran n'est pas tombé sur le garde-fou`, m && m[0]);
}
const lireColis = (pg) => pg.evaluate(() => {
  const rc = document.querySelector('[data-colis-recap]');
  const bl = document.querySelector('[data-colis-ebay]');
  const ne = document.querySelector('[data-ebay-ne-pas-poster]');
  return {
    recap: rc ? rc.getAttribute('data-colis-recap') : null, recapEbay: rc ? rc.getAttribute('data-colis-recap-ebay') : null,
    bloc: bl ? bl.getAttribute('data-colis-ebay') : null,
    cmds: [...document.querySelectorAll('[data-colis-ebay-cmd]')].map((x) => ({ id: x.getAttribute('data-colis-ebay-cmd'), num: x.getAttribute('data-numero'), j: x.getAttribute('data-jours'),
      auth: !!x.querySelector('[data-colis-ebay-auth]'), lien: (x.querySelector('[data-lien-etiquette-ebay]') || {}).href || '' })),
    ne: ne ? [...ne.querySelectorAll('[data-ebay-ne-pas-poster-cmd]')].map((x) => x.getAttribute('data-ebay-ne-pas-poster-cmd')) : null,
    phrases: (document.body.innerText.match(/L'étiquette se prend dans eBay : elle est prépayée/g) || []).length,
  };
});

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      console.log(`── ${vp.width} px`);
      const { ctx, pg, errs } = await preparer(b, vp);
      let total = null;
      await essaie('Colis', async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=cat_bord`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('[data-colis-recap]', { timeout: 15000 });
        await pg.waitForTimeout(3500);
        const c = await lireColis(pg);
        total = Number(c.recap);
        dit(c.recap === '3' && c.recapEbay === '2', 'Colis : le total du haut = 1 colis Vinted + 2 ventes eBay', JSON.stringify({ recap: c.recap, ebay: c.recapEbay }));
        const ids = c.cmds.map((x) => x.id).sort().join(',');
        dit(c.bloc === '2' && ids === 'E-1,E-2', 'Colis : le bloc eBay nomme EXACTEMENT E-1 et E-2 (ni expédiée, ni retrait, ni annulée, ni impayée)', ids);
        const e1 = c.cmds.find((x) => x.id === 'E-1') || {}, e2 = c.cmds.find((x) => x.id === 'E-2') || {};
        dit(e1.num === '12' && e2.num === '13', 'Colis : le N° vient du SKU VRM-{n°}', JSON.stringify([e1.num, e2.num]));
        dit(e1.j === '-1' && e2.j === '1', 'Colis : les jours viennent de la date limite d\'eBay (en retard · demain)', JSON.stringify([e1.j, e2.j]));
        dit(e2.auth && !e1.auth, 'Colis : l\'authentificateur d\'eBay signalé sur E-2 seulement');
        dit(/ebay\.fr\/.*orderid=E-1/.test(e1.lien), 'Colis : le lien mène à la commande E-1 sur ebay.fr', e1.lien);
        dit(c.phrases === 1, 'Colis : la phrase « l\'étiquette se prend dans eBay » est dite UNE fois (§7)', `${c.phrases} fois`);
        dit(Array.isArray(c.ne) && c.ne.join(',') === 'E-4', 'Colis : « Ne poste pas » nomme E-4 (annulation demandée)', JSON.stringify(c.ne));
        await pg.screenshot({ path: path.join(os.tmpdir(), 'ebay-colis-' + vp.width + '.png'), fullPage: true }).catch(() => {});
        await sain(pg, 'Colis');
        const pub = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_colis_aposter') || 'null'); } catch (_) { return null; } });
        dit(!!pub && pub.total === 3 && pub.ebay === 2 && pub.nePasPoster === 1, 'la cloche reçoit le même total (vrm_colis_aposter)', JSON.stringify(pub));
      });
      await essaie('Ma journée', async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('[data-tuile="envoyer"]', { timeout: 15000 });
        await pg.waitForTimeout(3500);
        const t = await pg.evaluate(() => { const e = document.querySelector('[data-tuile="envoyer"]'); const j = document.querySelector('[data-job="ebay-ne-pas-poster"]'); return { n: e && e.getAttribute('data-n'), eb: e && e.getAttribute('data-ebay'), ne: j ? j.getAttribute('data-n') : null }; });
        dit(t.n === String(total) && t.eb === '2', 'Ma journée : « À envoyer » porte le MÊME nombre que Colis, dont 2 eBay', JSON.stringify({ ...t, colis: total }));
        dit(t.ne === '1', 'Ma journée : l\'action « Ne poste pas » (1 commande eBay)', String(t.ne));
        await sain(pg, 'Ma journée');
      });
      await essaie('Suivi et message', async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=cat_bord`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('[data-gerer-ebay="E-1"]', { timeout: 15000 });
        await pg.click('[data-gerer-ebay="E-1"]');
        await pg.waitForSelector('[data-ebay-vente]', { timeout: 15000 });
        await pg.waitForTimeout(800);
        const v = await pg.evaluate(() => [...document.querySelectorAll('[data-ebay-vente]')].map((x) => x.getAttribute('data-ebay-vente')));
        dit(v.length === 1 && v[0] === 'E-1', '« Suivi et message à l\'acheteur » ouvre eBay → Ventes sur CETTE commande', JSON.stringify(v));
      });
      dit(errs.length === 0, 'aucune erreur de page', errs.join(' | ').slice(0, 200));
      await ctx.close();
      // ── « PAS SU » : commandes eBay illisibles ──
      const k = await preparer(b, vp, { ebayKO: true });
      await essaie('pas su', async () => {
        await k.pg.goto(`http://localhost:${PORT}/?tab=cat_bord`, { waitUntil: 'domcontentloaded' });
        await k.pg.waitForSelector('[data-colis-recap]', { timeout: 15000 });
        await k.pg.waitForTimeout(3500);
        const c = await lireColis(k.pg);
        dit(c.recapEbay === 'passu' && c.bloc === 'passu' && c.cmds.length === 0, 'pas su : Colis le dit (aucune vente eBay inventée, aucun « 0 »)', JSON.stringify({ e: c.recapEbay, b: c.bloc }));
        await k.pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        await k.pg.waitForSelector('[data-tuile="envoyer"]', { timeout: 15000 });
        await k.pg.waitForTimeout(3500);
        const t = await k.pg.evaluate(() => { const e = document.querySelector('[data-tuile="envoyer"]'); return { n: e && e.getAttribute('data-n'), eb: e && e.getAttribute('data-ebay'), aJour: !!document.querySelector('[data-tout-a-jour]') }; });
        dit(t.eb === 'passu' && !t.aJour, 'pas su : Ma journée le dit, et jamais « Tout est à jour »', JSON.stringify(t));
        await sain(k.pg, 'pas su');
      });
      dit(k.errs.length === 0, 'pas su : aucune erreur de page', k.errs.join(' | ').slice(0, 200));
      await k.ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ ventes eBay à poster (écran) : ${ko} rouge(s)` : '\n✅ ventes eBay à poster (écran) : tout est vert');
  process.exit(ko ? 1 : 0);
})();
