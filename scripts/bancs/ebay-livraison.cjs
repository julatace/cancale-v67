// ════════════════════════════════════════════════════════════════════════════
//  BANC : LA LIVRAISON eBAY DANS VENTES (28 nov., lot `ebay-livraison`)
//         node scripts/bancs/ebay-livraison.cjs   (après `npm run build` ; BANC_PORT, BANC_DIST, SHOTS)
//  Base INVENTÉE (design-passe : 3 comptes Vinted) + des commandes eBay inventées :
//    E-1  à poster, limite lue (shipByDate), Mondial Relay, étiquette reçue par e-mail ⇒ cochable, « Imprimer »
//    E-2  à poster, sans étiquette                     ⇒ grisée, lien « Étiquette sur eBay » (/ship/single/E-2)
//    E-3  expédiée, n° de suivi lu chez eBay           ⇒ En route
//    E-4  expédiée, aucun n° lu                        ⇒ En route (« expédiée »), jamais « livrée »
//  Il exige, à 390 tactile et 1512 :
//    1. À envoyer : E-1 et E-2 y sont, UNE fois chacune, avec les Vinted (le segment compte le tout) ;
//    2. E-1 : limite LUE (`data-vn-limite=lue`), la case cochable ; E-2 : la case grisée ;
//    3. le détail d'E-1 : le lien d'étiquette mène à /ship/single/E-1, le port de l'acheteur dit pour info ;
//    4. En route : E-3 et E-4 ;
//    5. aucun débordement, aucune erreur de page. Captures dans SHOTS.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const P = require('./design-passe.cjs');
const { ouvrir, base, srv, PORT, chromium } = P;
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-ebay-livraison');
fs.mkdirSync(SHOTS, { recursive: true });
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 500) : '')); } return c; };
const attendre = async (pg, f, ms = 30000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await pg.evaluate(f).catch(() => false)) return true; await pg.waitForTimeout(300); } return false; };
const J = 86400000, maint = Date.now();
const iso = (dj) => new Date(maint + dj * J).toISOString();
const PDF = Buffer.from('%PDF-1.4\n% etiquette inventee\n%%EOF\n').toString('base64');
const cmd = (id, o = {}) => ({
  orderId: id, creationDate: iso(-1), orderPaymentStatus: 'PAID', orderFulfillmentStatus: 'NOT_STARTED', cancelStatus: { cancelState: 'NONE_REQUESTED' },
  fulfillmentStartInstructions: [{ fulfillmentInstructionsType: 'SHIP_TO', shippingStep: { shippingCarrierCode: 'MONDIAL_RELAY', shipTo: { contactAddress: { countryCode: 'FR' } } } }],
  pricingSummary: { priceSubtotal: { value: '80.00', currency: 'EUR' }, deliveryCost: { value: '6.50', currency: 'EUR' }, total: { value: '86.50', currency: 'EUR' } },
  paymentSummary: { totalDueSeller: { value: '80.00', currency: 'EUR' } }, totalMarketplaceFee: { value: '10.00', currency: 'EUR' }, buyer: { username: 'acheteur_' + id },
  lineItems: [{ lineItemId: 'L' + id, title: 'eBay Nike Air Max 1 bleu 44', sku: '', legacyItemId: '55' + id.slice(-1), quantity: 1, lineItemCost: { value: '80.00', currency: 'EUR' },
    lineItemFulfillmentInstructions: { shipByDate: iso(o.dj == null ? 2 : o.dj) } }],
  ...(o.x || {}),
});
function baseEbay() {
  const b = base();
  b.rows.push({ id: 'ebay_orders', data: { capturedAt: maint - 60000, orders: [
    cmd('E-1', { dj: 3 }), cmd('E-2', { dj: 4 }),
    cmd('E-3', { x: { orderFulfillmentStatus: 'FULFILLED', fulfillmentHrefs: ['x'] } }), cmd('E-4', { x: { orderFulfillmentStatus: 'FULFILLED' } }),
  ] } });
  b.rows.push({ id: 'ebay_suivis', data: { capturedAt: maint, parCommande: { 'E-3': { suivis: [{ numero: '87654321', transporteur: 'MONDIAL_RELAY', expedieLe: iso(-0.5) }], n: 1, lusAt: iso(0) } } } });
  b.rows.push({ id: 'email_bordebay_E-1', data: { type: 'etiquette-ebay', orderId: 'E-1', pdfB64: PDF, filename: 'e.pdf', receivedAt: iso(0) } });
  return b;
}
const segment = async (pg, i) => { await pg.locator('[data-vn="ventes"] .n-segmente button, [data-vn="ventes"] .n-segmente [role="tab"], .n-vt-segment .n-segmente button, .n-vt-segment .n-segmente [role="tab"]').nth(i).click({ timeout: 8000 }).catch(() => {}); await pg.waitForTimeout(1500); };
const lire = (pg) => pg.evaluate(() => {
  const vis = (e) => !!e && e.getClientRects().length > 0 && !e.closest('[hidden]');
  const cles = [...document.querySelectorAll('[data-vn-rang], [data-vn-route], [data-tt-ligne]')].filter(vis).map((e) => e.getAttribute('data-vn-rang') || e.getAttribute('data-vn-route') || e.getAttribute('data-tt-ligne'));
  const de = (id) => { const e = [...document.querySelectorAll(`[data-vn-rang="${id}"], [data-tt-ligne="${id}"]`)].filter(vis)[0]; if (!e) return null;
    const c = e.querySelector('input'); return { limite: e.getAttribute('data-vn-limite') || (e.querySelector('[data-vn-limite]') || { getAttribute: () => null }).getAttribute('data-vn-limite'), coche: c ? !c.disabled : null, tr: e.getAttribute('data-vt-transporteur') || '' }; };
  const seg = [...document.querySelectorAll('[data-vn="ventes"] .n-segmente button, .n-vt-segment .n-segmente button')].filter(vis).map((b) => b.textContent.replace(/\s+/g, ' ').trim());
  return { cles, e1: de('e:principal:E-1'), e2: de('e:principal:E-2'), seg, deb: document.documentElement.scrollWidth - innerWidth, texte: document.body.innerText.slice(0, 200) };
});
(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] }).catch(() => chromium.launch({ args: ['--no-sandbox'] }));
  const b = baseEbay();
  try {
    for (const W of [390, 1512]) {
      console.log(`\n── Ventes · ${W}`);
      const { ctx, pg, erreurs } = await ouvrir(nav, { W, sombre: false, b, url: '/?tab=ventes' });
      await pg.waitForSelector('.vrm-main', { timeout: 30000 }).catch(() => {});
      await attendre(pg, () => !!document.querySelector('[data-vn-rang="e:principal:E-1"], [data-tt-ligne="e:principal:E-1"]'), 40000);
      await pg.waitForTimeout(1500);
      const m = await lire(pg);
      await pg.screenshot({ path: path.join(SHOTS, `envoyer-${W}.png`) });
      const nE1 = m.cles.filter((c) => c === 'e:principal:E-1').length, nE2 = m.cles.filter((c) => c === 'e:principal:E-2').length;
      dit(nE1 === 1 && nE2 === 1, 'À envoyer : E-1 et E-2 y sont, une fois chacune', m.cles.filter((c) => /^e:/.test(c)));
      dit(m.cles.some((c) => /^v:/.test(c)), 'À envoyer : avec les colis Vinted (même liste)');
      const n0 = Number(((m.seg[0] || '').match(/\d+/) || [])[0]);
      dit(n0 === m.cles.length, `le segment « À envoyer » compte le tout (Vinted + eBay) : ${n0} = ${m.cles.length} rangées`, m.seg);
      dit(!m.cles.some((c) => /E-3|E-4/.test(c)), 'les commandes expédiées ne sont pas « à envoyer »');
      dit(m.e1 && m.e1.limite === 'lue', 'E-1 : la date limite est LUE (shipByDate d\'eBay)', m.e1);
      dit(m.e1 && m.e1.coche === true && m.e2 && m.e2.coche !== true, 'E-1 (étiquette reçue) cochable pour « Imprimer N » ; E-2 (sans étiquette) grisée', [m.e1, m.e2]);
      if (W > 600) dit(m.e1 && m.e1.tr === 'mondialrelay', 'E-1 : le transporteur LU chez eBay (Mondial Relay, son logo)', m.e1);
      dit(m.deb <= 1, 'aucun débordement horizontal', m.deb);
      // Le détail d'E-2 : le lien d'étiquette, le port pour info.
      await pg.locator('[data-vn-rang="e:principal:E-2"], [data-tt-ligne="e:principal:E-2"] [data-tt-col="article"]').first().click({ timeout: 8000 }).catch(() => {});
      await pg.waitForTimeout(1500);
      const d = await pg.evaluate(() => { const a = document.querySelector('[data-vn-geste="lien"]'); const c = document.querySelector('[data-vn-geste="commande-ebay"]');
        return { lien: a ? (a.getAttribute('href') || (a.querySelector('a') || { getAttribute: () => '' }).getAttribute('href')) : null, cmd: !!c, texte: document.body.innerText.replace(/\s+/g, ' ') }; });
      await pg.screenshot({ path: path.join(SHOTS, `detail-${W}.png`) });
      dit(d.lien && /ebay\.fr\/ship\/single\/E-2$/.test(d.lien), 'détail : « Étiquette sur eBay » mène à la page d\'expédition de CETTE commande (/ship/single/E-2)', d.lien);
      dit(d.cmd, 'détail : « Ouvrir la commande sur eBay » à côté (repli)');
      dit(/Port payé par l’acheteur/.test(d.texte) && /6,50/.test(d.texte) && /ni recette ni charge/.test(d.texte), 'détail : le port payé par l\'acheteur (6,50 €) dit pour info, ni recette ni charge');
      await pg.keyboard.press('Escape').catch(() => {}); await pg.goBack().catch(() => {}); await pg.waitForTimeout(800);
      if (!(await pg.locator('[data-vn="ventes"] .n-segmente button, .n-vt-segment .n-segmente button').count())) { await pg.goto(`http://localhost:${PORT}/?tab=ventes`); await pg.waitForTimeout(4000); }
      await segment(pg, 1);
      const r = await lire(pg);
      await pg.screenshot({ path: path.join(SHOTS, `route-${W}.png`) });
      dit(r.cles.includes('e:principal:E-3') && r.cles.includes('e:principal:E-4'), 'En route : E-3 (suivi lu chez eBay) et E-4 (expédiée)', r.cles.filter((c) => /^e:/.test(c)));
      dit(erreurs.length === 0, 'aucune erreur de page', erreurs);
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a pu s’exécuter', String(e && e.stack || e).slice(0, 300)); }
  await nav.close(); srv.close();
  console.log(`\n${ko ? '❌' : '✅'} banc ebay-livraison : ${ok} verts, ${ko} rouges — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
