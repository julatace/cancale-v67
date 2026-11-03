// ── BANC : VENTES — LE BÉNÉFICE SUR LA LIGNE, ET « DÉPOSÉ » AU GLISSÉ (1er nov.) ─
//        npm run build && node scripts/bancs/ventes-benefice-glisser.cjs
// Maquettes « ventes-B-journal » (téléphone) et « ventes-ordi » (colonnes Prix ·
// Achat · Bénéfice). Données INVENTÉES (le dépôt est public).
// CALCULÉ À LA MAIN (prix − achat − frais connus, la règle de `beneficePaire`) :
//   9201  85 € − 38 € (frais confirmés)            = +47,00 € → 4700, « ok »
//   9202  95 € − 52 € − 2,50 € (frais pas confirmés) = +40,50 € → 4050, « au plus »
//   9203  78 €, prix d'achat inconnu                 = « — », le geste « Prix d'achat » sur la ligne
//   9205  60 € − 27 € (frais confirmés)            = +33,00 € → 3300
//   9204  annulée                                    = aucun bénéfice
// « DÉPOSÉ » (téléphone, doigt) :
//   · glisser 9201 vers la gauche ⇒ la barre « Annuler » ; rien n'est écrit pendant
//     le délai ; « Annuler » ⇒ RIEN écrit (vinted_ship_done, vinted_bords_shipped) ;
//   · glisser puis attendre ⇒ la MÊME écriture que le bouton « Déposé » de la
//     ligne et que « ✓ Colis fait » de Colis (mêmes clés, mêmes formes) ;
//   · une vente finalisée (9202) ne se glisse pas et n'a pas de bouton ;
//   · un défilement vertical ne dépose rien.
// Jugé sur les attributs (`data-benef-*`, `data-depose-*`) et le stockage (§6.4).
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), os = require('os');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT || 4395);
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-ventes-benefice');
try { fs.mkdirSync(SHOTS, { recursive: true }); } catch (_) {}

const MAINTENANT = Date.now();
const ilYa = (j) => new Date(MAINTENANT - j * 86400000).toISOString();
const AEXP = 'Le paiement a été validé';
const v = (tx, titre, prix, statut, j, tus) => ({ transaction_id: tx, conversation_id: tx + 1000, title: titre, price: { amount: prix, currency_code: 'EUR' }, status: statut, ...(tus ? { transaction_user_status: tus } : {}), date: ilYa(j) });
const VENTES = [
  v(9201, 'Nike Air Max 90 taille 42', '85.00', AEXP, 1, 'needs_action'),
  v(9202, 'Adidas Samba OG taille 41', '95.00', 'Commande finalisée', 3, 'completed'),
  v(9203, 'New Balance 550 taille 43', '78.00', AEXP, 1, 'needs_action'),
  v(9204, 'Converse Run Star taille 40', '70.00', 'Commande annulée', 4, 'failed'),
  v(9205, 'Asics Gel-1130 taille 40', '60.00', AEXP, 2, 'needs_action'),
];
const OV = { '9201': { numero: '42', buyPrice: '38', fraisComplets: true }, '9202': { numero: '117', buyPrice: '52', fees: '2.50' }, '9203': { numero: 'B233' }, '9205': { numero: '61', buyPrice: '27', fraisComplets: true } };
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', updated_at: new Date(MAINTENANT).toISOString() }];
const ROWS = [
  { id: 'harvest_111_listings', data: { capturedAt: new Date(MAINTENANT - 60000).toISOString(), payload: { items: [] } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: new Date(MAINTENANT).toISOString(), payload: { my_orders: [] } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: new Date(MAINTENANT).toISOString(), payload: { my_orders: VENTES } } },
  { id: 'email_bord_9201', data: { transaction: '9201', filename: 'bordereau_9201.pdf', suivi: '12345678', receivedAt: ilYa(0.2), uid: '111', account: 'compte_banc', pdfB64: 'JVBERi0xLjQK' } },
];
const MAIN = { vinted_dark: false, vinted_sale_overrides: OV };

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 160)); } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'updated_at') { out[alias] = new Date(MAINTENANT).toISOString(); continue; }
    let x = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) x = x == null ? null : x[seg];
    out[alias] = x == null ? null : (/->>/.test(src) && typeof x === 'object' ? JSON.stringify(x) : x);
  }
  return out;
};
async function preparer(b, vp) {
  const tactile = vp.width < 600;
  const ctx = await b.newContext({ viewport: vp, ...(tactile ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq && eq[1] === 'main') return j([projette({ id: 'main', data: MAIN }, sel)]);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map((r) => projette(r, sel)));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map((r) => projette(r, sel))); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs };
}
const ouvrirVentes = async (pg) => {
  await pg.goto(`http://localhost:${PORT}/?tab=cat_ventes`, { waitUntil: 'domcontentloaded' });
  await pg.locator('[data-tx="9201"]').first().waitFor({ timeout: 25000 });
  await pg.waitForTimeout(1500);
};
const lireStock = (pg) => pg.evaluate(() => { const L = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } }; return { ship: L('vinted_ship_done') || {}, bords: L('vinted_bords_shipped') || {} }; });
// La forme d'une écriture : les clés, et le TYPE de chaque valeur (l'heure change).
const forme = (s) => JSON.stringify({ ship: Object.keys(s.ship).sort().map((k) => [k, typeof s.ship[k]]), bords: Object.keys(s.bords).sort().map((k) => [k, s.bords[k]]) });
// Un vrai doigt : des événements tactiles (le navigateur en fait des pointeurs `touch`).
async function glisser(pg, sel, dxPart = 0.6, dy = 0) {
  const r = await pg.evaluate((s) => { const e = document.querySelector(s); e.scrollIntoView({ block: 'center' }); const b = e.getBoundingClientRect(); return { x: b.left + b.width * 0.8, y: b.top + Math.min(40, b.height / 2), w: b.width }; }, sel);
  await pg.waitForTimeout(200);
  const cdp = await pg.context().newCDPSession(pg);
  const pt = (x, y) => [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(r.x, r.y) });
  const n = 12;
  for (let k = 1; k <= n; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(r.x - (r.w * dxPart) * k / n, r.y + dy * k / n) }); await pg.waitForTimeout(16); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

async function main() {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      const T = vp.width + 'px';
      // ── A. LE BÉNÉFICE SUR LA LIGNE ──────────────────────────────────────────
      await essaie(T + ' A', async () => {
        const { ctx, pg, errs } = await preparer(b, vp);
        await ouvrirVentes(pg);
        const L = await pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-tx]')].filter((e) => e.matches('.vrm-sale-row')).map((e) => {
          const bn = e.querySelector(':scope > button .vrm-ledger-sale-benef'), ac = e.querySelector(':scope > button .vrm-ledger-sale-achat');
          return [e.getAttribute('data-tx'), { cols: e.hasAttribute('data-benef-cols'), b: bn && bn.getAttribute('data-benef-ligne'), et: bn && bn.getAttribute('data-benef-etat'), txt: bn && bn.innerText.trim(), a: ac && ac.getAttribute('data-achat-ligne'), cout: !!e.querySelector('[data-gestes-ligne] [data-cout-vente="ligne"]') }];
        })));
        dit(L['9201'] && L['9201'].b === '4700' && L['9201'].et === 'ok' && L['9201'].a === '3800', `${T} 9201 : 85 − 38 = +47,00 € (frais confirmés)`, JSON.stringify(L['9201']));
        dit(L['9202'] && L['9202'].b === '4050' && L['9202'].et === 'partiel' && /^au plus\s+\+40,50 €$/.test(L['9202'].txt), `${T} 9202 : 95 − 52 − 2,50 = +40,50 €, frais pas confirmés ⇒ « au plus »`, JSON.stringify(L['9202']));
        dit(L['9203'] && L['9203'].b === '' && L['9203'].et === 'achat' && L['9203'].txt === '—' && L['9203'].cout, `${T} 9203 : prix d'achat inconnu ⇒ « — », le geste « Prix d'achat » sur la ligne`, JSON.stringify(L['9203']));
        dit(L['9205'] && L['9205'].b === '3300' && L['9205'].et === 'ok', `${T} 9205 : 60 − 27 = +33,00 €`, JSON.stringify(L['9205']));
        // Une vente annulée n'est pas dans la liste par défaut (filtre « Annulées ») ; si elle y est, sans bénéfice.
        dit(!L['9204'] || (L['9204'].et === 'annulee' && L['9204'].txt === ''), `${T} 9204 annulée : aucun bénéfice`, JSON.stringify(L['9204'] || 'hors de la liste'));
        // (2 nov. 22 h puis critique du 3 nov. #13) Les colonnes Prix · Achat · Bénéfice et leur en-tête ne
        // sont plus affichées : la ligne est la carte de la maquette FusionVentes (prix seul, frise) — retiré
        // à la demande de Julien, 2 nov. 22 h. Les MONTANTS restent jugés ci-dessus (attributs de la ligne).
        const sw = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
        dit(sw.sw <= sw.cw + 1, `${T} aucun débordement`, JSON.stringify(sw));
        await pg.evaluate(() => { const e = document.querySelector('[data-tx="9201"]'); if (e) e.scrollIntoView({ block: 'start' }); });
        await pg.waitForTimeout(300);
        await pg.screenshot({ path: path.join(SHOTS, `ventes-benefice-${vp.width}.png`) });
        // Le bouton « Déposé » : sur les ventes à expédier seulement, visible.
        // (3 nov., critique #5) « Déposé » est derrière « … » de la carte : on l'ouvre, comme Julien.
        await pg.evaluate(() => { for (const x of document.querySelectorAll('[data-vente-plus]')) x.click(); });
        await pg.waitForTimeout(300);
        const bt = await pg.evaluate(() => ['9201', '9202', '9203', '9204', '9205'].map((t) => { const e = document.querySelector(`[data-depose-vente="${t}"]`); return [t, !!(e && e.getBoundingClientRect().height >= 40)]; }));
        dit(JSON.stringify(bt) === JSON.stringify([['9201', true], ['9202', false], ['9203', true], ['9204', false], ['9205', true]]), `${T} bouton « Déposé » visible (≥ 40 px) sur les ventes à expédier, et seulement elles`, JSON.stringify(bt));
        dit(!errs.length, `${T} A aucune erreur d'app`, errs[0]);
        await ctx.close();
      });
    }
    const vpT = { width: 390, height: 844 };
    let parGlisse = null, parBouton = null, parColis = null;
    // ── B. GLISSER, PUIS ANNULER ⇒ RIEN ÉCRIT ─────────────────────────────────
    await essaie('B', async () => {
      const { ctx, pg, errs } = await preparer(b, vpT);
      await ouvrirVentes(pg);
      const avant = await lireStock(pg);
      await glisser(pg, '[data-tx="9201"]');
      const barre = await pg.locator('[data-depose-barre="9201"]').waitFor({ timeout: 3000 }).then(() => true).catch(() => false);
      dit(barre, '390px glisser 9201 vers la gauche ⇒ la barre « Annuler » apparaît');
      await pg.screenshot({ path: path.join(SHOTS, 'ventes-glisser-annuler-390.png') });
      await pg.waitForTimeout(1200);
      const pendant = await lireStock(pg);
      dit(!pendant.ship['9201'], '390px pendant le délai : rien n’est encore écrit', JSON.stringify(pendant));
      await pg.click('[data-depose-annuler="9201"]');
      await pg.waitForTimeout(6500);
      const apres = await lireStock(pg);
      dit(forme(apres) === forme(avant) && !(await pg.$('[data-depose-barre]')), '390px « Annuler » ⇒ RIEN écrit (vinted_ship_done, vinted_bords_shipped inchangés)', forme(apres));
      const btn = await pg.$('[data-depose-vente="9201"]');
      dit(!!btn, '390px après « Annuler », la vente est toujours à expédier (bouton « Déposé » là)');
      // Un défilement vertical sur la ligne ne dépose rien.
      await glisser(pg, '[data-tx="9205"]', 0.05, -200);
      await pg.waitForTimeout(800);
      dit(!(await pg.$('[data-depose-barre]')), '390px un défilement vertical ne dépose rien');
      // Une vente finalisée ne se glisse pas.
      await glisser(pg, '[data-tx="9202"]');
      await pg.waitForTimeout(800);
      const g2 = await pg.evaluate(() => document.querySelector('[data-tx="9202"]').hasAttribute('data-glisse-depose'));
      dit(!g2 && !(await pg.$('[data-depose-barre]')), '390px une vente finalisée ne se glisse pas', String(g2));
      dit(!errs.length, 'B aucune erreur d’app', errs[0]);
      await ctx.close();
    });
    // ── C. GLISSER ⇒ LA MÊME ÉCRITURE QUE LE BOUTON ET QUE COLIS ──────────────
    await essaie('C glisser', async () => {
      const { ctx, pg, errs } = await preparer(b, vpT);
      await ouvrirVentes(pg);
      await glisser(pg, '[data-tx="9201"]');
      await pg.locator('[data-depose-barre="9201"]').waitFor({ timeout: 3000 });
      await pg.waitForTimeout(6800);
      parGlisse = await lireStock(pg);
      dit(typeof parGlisse.ship['9201'] === 'number' && Object.keys(parGlisse.bords).length === 1, '390px glisser puis attendre ⇒ 9201 marquée déposée (vente + bordereau)', forme(parGlisse));
      const sortie = !(await pg.$('[data-depose-vente="9201"]'));
      dit(sortie, '390px la vente n’est plus « à expédier » (plus de bouton « Déposé »)');
      dit(!errs.length, 'C aucune erreur d’app', errs[0]);
      await ctx.close();
    });
    await essaie('C bouton', async () => {
      const { ctx, pg, errs } = await preparer(b, vpT);
      await ouvrirVentes(pg);
      await pg.click('[data-tx="9201"] [data-vente-plus]');
      await pg.click('[data-depose-vente="9201"]');
      await pg.locator('[data-depose-barre="9201"]').waitFor({ timeout: 3000 });
      await pg.waitForTimeout(6800);
      parBouton = await lireStock(pg);
      dit(!errs.length, 'C bouton aucune erreur d’app', errs[0]);
      await ctx.close();
    });
    await essaie('C Colis', async () => {
      const { ctx, pg, errs } = await preparer(b, vpT);
      await pg.goto(`http://localhost:${PORT}/?tab=cat_bord`, { waitUntil: 'domcontentloaded' });
      // (2 nov., revue) « Colis fait » est derrière le « … » de la carte Colis.
      await pg.locator('[data-tx-colis="9201"] [data-geste="fait"]').first().waitFor({ state: 'attached', timeout: 25000 });
      const plus = pg.locator('[data-tx-colis="9201"] [data-colis-plus]').first();
      if (await plus.count()) await plus.click();
      await pg.click('[data-tx-colis="9201"] [data-geste="fait"]');
      await pg.waitForTimeout(1500);
      parColis = await lireStock(pg);
      dit(!errs.length, 'C Colis aucune erreur d’app', errs[0]);
      await ctx.close();
    });
    dit(parGlisse && parBouton && forme(parGlisse) === forme(parBouton), 'glisser = le bouton « Déposé » : la même écriture', `${parGlisse && forme(parGlisse)} | ${parBouton && forme(parBouton)}`);
    dit(parGlisse && parColis && forme(parGlisse) === forme(parColis), 'glisser = « ✓ Colis fait » de Colis : la même écriture', `${parGlisse && forme(parGlisse)} | ${parColis && forme(parColis)}`);
  } finally { if (b) await b.close(); srv.close(); }
  console.log(`captures : ${SHOTS}`);
  console.log(ko ? `\n❌ ventes bénéfice / glisser : ${ko} rouge(s).` : `\n✅ ventes bénéfice / glisser : tout est vert`);
  process.exit(ko ? 1 : 0);
}
main();
