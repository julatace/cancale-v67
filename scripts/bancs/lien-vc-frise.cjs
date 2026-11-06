// ═══════════════════════════════════════════════════════════════════════════
// BANC : UN SEUL N° VINTED ↔ VESTIAIRE + LA FRISE eBAY / VESTIAIRE (3 nov.)
//        (node scripts/bancs/lien-vc-frise.cjs — après la construction ;
//         BANC_PORT, 8071 par défaut ; SHOTS=dossier pour garder les captures)
// ═══════════════════════════════════════════════════════════════════════════
// Données INVENTÉES (dépôt public). Deux articles Vinted au MÊME titre (N°12 et
// N°13, Gucci beige, sans taille : des sacs), deux annonces Vestiaire au N°
// donné par VRM (61, 62), deux ventes Vestiaire (à expédier ; livrée), deux
// commandes eBay (payée par l'acheteur, pas envoyée ; envoyée + argent libéré).
// Exigé, à 390 px tactile (clair) et 1512 px (sombre) :
//   A. Vestiaire → « Relier à Vinted » : la feuille propose les deux articles
//      Gucci beige (ressemblance), rien n'est relié avant SON toucher + sa
//      confirmation ; après : l'annonce porte le N°12, « N°61 → N°12 » à barrer ;
//   B. « C'est écrit » : la ligne à barrer part, la liaison reste ;
//   C. « Délier » + confirmation : l'annonce reprend le N°61 (état d'avant) ;
//   D. Vinted → « Relier à Vestiaire » (l'autre sens) : relie P1 au N°13 ;
//   E. Ventes Vestiaire : la frise sur la LIGNE, cochée seulement prouvée ;
//   F. Ventes eBay : la frise, « Payée » seulement sur l'argent libéré lu.
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 8071;
const SHOTS = process.env.SHOTS || '';
const MAINTENANT = Date.now(), H = 3600000, J = 24 * H;
const ilYaH = (h) => new Date(MAINTENANT - h * H).toISOString();
const dansJ = (j) => new Date(MAINTENANT + j * J).toISOString();
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: ilYaH(0) }];
const PHOTO_VC = (n) => `https://images.vestiairecollective.com/produit/${n}-1_3.jpg`;
const PHOTO_V = (n) => `https://images1.vinted.net/t/${n}.jpg`;
const TITRE_V = 'Sac Gucci Ophidia beige';
const FICHES = { 8012: { numero: '12', title: TITRE_V, photo: PHOTO_V(8012), numberedAt: ilYaH(200) }, 8013: { numero: '13', title: TITRE_V, photo: PHOTO_V(8013), numberedAt: ilYaH(100) } };
const LISTINGS = { capturedAt: ilYaH(0.1), payload: { items: [8012, 8013].map((id) => ({ id, title: TITRE_V, price: { amount: '320', currency_code: 'EUR' }, brand_title: 'Gucci', is_closed: false, is_hidden: false, is_draft: false, photo: { url: PHOTO_V(id) } })) } };
const K1 = 'aaaaaaaaaaaaaaa1';
const cmd = (orderId, titre, extra) => ({ orderId, orderPaymentStatus: 'PAID', orderFulfillmentStatus: 'NOT_STARTED', creationDate: ilYaH(30), cancelStatus: { cancelState: 'NONE_REQUESTED' }, lineItems: [{ sku: '', title: titre }],
  pricingSummary: { total: { value: '96.50', currency: 'EUR' } }, paymentSummary: { totalDueSeller: { value: '95', currency: 'EUR' }, payments: [{ paymentStatus: 'PAID', paymentHolds: [{ holdState: 'HELD' }] }] }, totalMarketplaceFee: { value: '5', currency: 'EUR' }, ...extra });
let LIGNES = null;
const ecritures = [];

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 160)); } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.mjs': 'text/javascript' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul (BANC_PORT=…)'); process.exit(1); });
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
const svg = (c) => `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="300" height="400" fill="${c}"/></svg>`;

async function preparer(b, vp, sombre) {
  const ctx = await b.newContext({ viewport: vp, colorScheme: sombre ? 'dark' : 'light', locale: 'fr-FR', ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(([sombre, fiches]) => {
    try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(!!sombre)); localStorage.setItem('vrm_visite_vue', 'true'); if (!sessionStorage.getItem('banc_pose')) { localStorage.setItem('vinted_annonce_numeros', JSON.stringify(fiches)); sessionStorage.setItem('banc_pose', '1'); } } catch (_) {}
  }, [sombre, FICHES]);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    if (/vestiairecollective\.com/.test(u)) return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: svg('#c8b08a') });
    if (/vinted\.net/.test(u)) return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: svg('#d9c7a8') });
    return ['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue();
  });
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d, st) => route.fulfill({ status: st || 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') { ecritures.push({ m: req.method(), u, corps: req.postData() || '' }); return j([], 201); }
    if (/select=owner/.test(u)) return j({ m: 1 }, 400);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: r.data.capturedAt || ilYaH(0), cap: r.data.capturedAt });
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(','); return j(LIGNES.filter((r) => ids.includes(r.id)).map(forme)); }
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.route('**/api/ebay**', (route) => {
    const req = route.request();
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
    if (req.method() !== 'POST') return j({ ok: true, ready: true, canConsent: true });
    let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch (_) {}
    if (body.action === 'status') return j({ ok: true, connected: true, comptes: [{ cle: K1, pseudo: 'paire_perso', principal: true, relie: true }] });
    if (body.action === 'finances') return j({ ok: false, reason: 'scope', error: 'x' });
    return j({ ok: true });
  });
  return { ctx, pg, errs };
}
const capture = async (pg, nom) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, nom + '.png'), fullPage: false }); };
const sain = async (pg, ecran) => {
  const r = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, t: document.body.innerText }));
  dit(r.sw <= r.cw + 1, `${ecran} : aucun débordement horizontal`, `${r.sw} > ${r.cw}`);
  const m = /n'a pas pu s'afficher|n’a pas pu s’afficher|Cannot access|is not defined/.exec(r.t);
  dit(!m, `${ecran} : l'écran n'est pas tombé sur le garde-fou`, m && m[0]);
};
const numVc = (pg, id) => pg.evaluate((id) => (document.querySelector(`[data-vc-annonce="${id}"]`) || { getAttribute: () => null }).getAttribute('data-vc-annonce-num'), id);
const liensLs = (pg) => pg.evaluate(() => JSON.parse(localStorage.getItem('vrm_vc_liens') || '{}'));
// `save` écrit 500 ms après le geste : on attend que le stockage ait la forme attendue.
const attendLs = (pg, f) => pg.waitForFunction(f, null, { timeout: 4000 }).catch(() => {});
// Le bouton OK de la confirmation (la feuille de l'app), pas un « Relier » de la liste.
const confirmer = async (pg, libelle) => { const b = pg.locator(`button:text-is("${libelle}"):not([data-lien-vc-relier]):not([data-vc-relier])`).last(); await b.waitFor({ timeout: 8000 }); await b.click(); };
const frise = (pg, sel) => pg.evaluate((sel) => { const f = document.querySelector(sel + ' [data-fu-frise]'); if (!f) return null; return { fait: [...f.querySelectorAll('[data-fu-etape]')].map((s) => s.getAttribute('data-fait')).join(''), cours: (f.querySelector('[data-cours]') || { getAttribute: () => '' }).getAttribute('data-fu-etape'), ton: (f.querySelector('[data-cours]') || { getAttribute: () => '' }).getAttribute('data-ton') }; }, sel);

(async () => {
  let b;
  try {
    srv.listen(PORT);
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const [vp, sombre] of [[{ width: 390, height: 844 }, false], [{ width: 1512, height: 950 }, true]]) {
      const nomVp = `${vp.width}${sombre ? '-sombre' : ''}`;
      console.log(`── ${nomVp}`);
      LIGNES = [
        { id: 'main', data: { vinted_ship_done: {}, vinted_used_numeros: Array.from({ length: 62 }, (_, i) => i + 1), vinted_annonce_numeros: FICHES, vrm_vc_numeros: { 71000001: { numero: '61', numberedAt: ilYaH(48), auto: true }, 71000002: { numero: '62', numberedAt: ilYaH(48), auto: true } } } },
        { id: 'harvest_111_listings', data: LISTINGS },
        { id: 'harvest_111_orders_sold', data: { capturedAt: ilYaH(0.2), payload: { my_orders: [] } } },
        { id: 'vc_listings', data: { capturedAt: ilYaH(0.3), complet: true, liens: {}, items: {
          71000001: { titre: 'Cabas Gucci Ophidia beige', photo: PHOTO_VC(71000001), statut: 'published', vuAt: ilYaH(0.3), prix: { valeur: 340, devise: 'EUR', cle: 'price' } },
          71000002: { titre: 'Escarpins Gucci noir', photo: PHOTO_VC(71000002), statut: 'published', vuAt: ilYaH(0.3), prix: { valeur: 210, devise: 'EUR', cle: 'price' } },
        } } },
        { id: 'vc_ventes', data: { lectures: { 'a-expedier': { at: ilYaH(0.3), complet: true }, ventes: { at: ilYaH(0.3) } }, ventes: {
          V1: { productId: '71000002', aExpedier: true, limite: dansJ(3), date: ilYaH(5), titre: 'Escarpins Gucci noir', photo: PHOTO_VC(71000002), etat: 'ACTION_NEEDED', statutVc: 'shipmentInProgress',
            etapesVc: { sellerSale: 'done', sellerShipment: 'pending', sellerConformity: 'upcoming', sellerDelivery: 'upcoming', sellerPayment: 'upcoming' }, montant: { valeur: 180.5, devise: 'EUR', cle: 'sellerEarning' } },
          V2: { productId: '71000009', aExpedier: false, date: ilYaH(200), titre: 'Mocassins Gucci marron', photo: PHOTO_VC(71000009), etat: '',
            etapesVc: { sellerSale: 'done', sellerShipment: 'done', sellerConformity: 'done', sellerDelivery: 'done', sellerPayment: 'upcoming' }, montant: { valeur: 150, devise: 'EUR', cle: 'sellerEarning' } },
        } } },
        { id: 'ebay_comptes', data: { comptes: [{ cle: K1, pseudo: 'paire_perso', principal: true, ajouteLe: 1 }] } },
        { id: 'ebay_listings', data: { items: [], capturedAt: Date.now() } },
        { id: 'ebay_programmees', data: { items: [], enLigne: [], complet: true, capturedAt: Date.now() } },
        { id: 'ebay_orders', data: { capturedAt: Date.now(), orders: [
          cmd('11-0001', 'Converse Chuck 70 blanc'),
          cmd('11-0002', 'Puma Suede rouge', { orderFulfillmentStatus: 'FULFILLED', creationDate: ilYaH(300), paymentSummary: { totalDueSeller: { value: '95', currency: 'EUR' }, payments: [{ paymentStatus: 'PAID', paymentHolds: [{ holdState: 'RELEASED', releaseDate: ilYaH(10) }] }] } }),
        ] } },
      ];
      ecritures.length = 0;
      const { ctx, pg, errs } = await preparer(b, vp, sombre);
      const versVc = async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=annonces&site=vestiaire`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('[data-vc-annonces="lu"]', { timeout: 20000 });
        await pg.waitForFunction(() => document.querySelector('[data-vc-annonce="71000001"]') && document.querySelector('[data-vc-annonce="71000001"]').getAttribute('data-vc-annonce-num'), null, { timeout: 15000 }).catch(() => {});
        await pg.waitForTimeout(600);
      };
      await essaie('A. Relier depuis Vestiaire', async () => {
        await versVc();
        dit(await numVc(pg, '71000001') === '61', 'A · avant : l’annonce Vestiaire porte le N° donné par VRM (61)', await numVc(pg, '71000001'));
        await pg.click('[data-vc-relier="71000001"]');
        await pg.waitForSelector('[data-lien-vc="vc"]', { timeout: 8000 });
        await pg.waitForSelector('[data-lien-vc="vc"] [data-lien-vc-candidat]', { timeout: 20000 });
        const s = await pg.evaluate(() => ({ sugg: [...document.querySelectorAll('[data-lien-vc-suggere] [data-lien-vc-relier]')].map((x) => x.getAttribute('data-lien-vc-relier')), tous: [...document.querySelectorAll('[data-lien-vc-candidat]')].map((x) => x.getAttribute('data-lien-vc-candidat')) }));
        dit(s.sugg.includes('8012') && s.sugg.includes('8013'), 'A · la feuille SUGGÈRE les deux sacs Gucci beige (ressemblance)', JSON.stringify(s));
        dit(Object.keys(await liensLs(pg)).length === 0 && await numVc(pg, '71000001') === '61', 'A · rien n’est relié tant qu’il n’a pas touché « Relier »');
        await capture(pg, `feuille-vc-${nomVp}`);
        await pg.click('[data-lien-vc-relier="8012"]');
        await pg.waitForTimeout(300);
        dit(Object.keys(await liensLs(pg)).length === 0, 'A · …ni avant sa CONFIRMATION');
        await capture(pg, `confirmer-${nomVp}`);
        await confirmer(pg, 'Relier');
        await pg.waitForFunction(() => (document.querySelector('[data-vc-annonce="71000001"]') || { getAttribute: () => '' }).getAttribute('data-vc-annonce-num') === '12', null, { timeout: 8000 }).catch(() => {});
        await attendLs(pg, () => { const l = JSON.parse(localStorage.getItem('vrm_vc_liens') || '{}'); return !!l['71000001']; });
        const l = await liensLs(pg);
        dit(l['71000001'] && l['71000001'].numero === '12' && l['71000001'].item === '8012' && l['71000001'].de === '61', 'A · la liaison est rangée par identité (productId ↔ annonce Vinted 8012)', JSON.stringify(l));
        dit(await numVc(pg, '71000001') === '12', 'A · l’annonce Vestiaire porte maintenant le N°12 (celui du carton)', await numVc(pg, '71000001'));
        dit(await numVc(pg, '71000002') === '62', 'A · l’autre annonce garde SON N°62', await numVc(pg, '71000002'));
        const bar = await pg.evaluate(() => { const x = document.querySelector('[data-vc-barrer="71000001"]'); return x ? { de: x.getAttribute('data-vc-barrer-de'), vers: x.getAttribute('data-vc-barrer-vers') } : null; });
        dit(bar && bar.de === '61' && bar.vers === '12', 'A · « N°61 → N°12 » à barrer sur le carton', JSON.stringify(bar));
        dit(!!(await pg.$('[data-vc-delier="71000001"]')) && !(await pg.$('[data-lien-vc]')), 'A · la feuille se ferme, « Délier » remplace « Relier »');
        await pg.waitForTimeout(900);
        const ls = await pg.evaluate(() => ({ vc: JSON.parse(localStorage.getItem('vrm_vc_numeros') || '{}'), pool: JSON.parse(localStorage.getItem('vinted_used_numeros') || '[]') }));
        dit(ls.vc['71000001'] && ls.vc['71000001'].numero === '61', 'A · le N°61 reste servi (jamais effacé ni redonné)', JSON.stringify(ls.vc['71000001']));
        await pg.locator('[data-vc-barrer="71000001"]').scrollIntoViewIfNeeded().catch(() => {});
        await capture(pg, `relie-${nomVp}`);
        await sain(pg, 'Vestiaire relié');
      });
      await essaie('B. C’est écrit', async () => {
        await pg.click('[data-vc-barre="71000001"]');
        await attendLs(pg, () => { const l = JSON.parse(localStorage.getItem('vrm_vc_liens') || '{}'); return !!(l['71000001'] && l['71000001'].ecrit); });
        const l = await liensLs(pg);
        dit(!(await pg.$('[data-vc-barrer="71000001"]')) && l['71000001'] && l['71000001'].ecrit && await numVc(pg, '71000001') === '12', 'B · « C’est écrit » : la ligne part, la liaison reste');
      });
      await essaie('C. Délier', async () => {
        await pg.click('[data-vc-delier="71000001"]');
        await confirmer(pg, 'Défaire');
        await attendLs(pg, () => !JSON.parse(localStorage.getItem('vrm_vc_liens') || '{}')['71000001']);
        dit(await numVc(pg, '71000001') === '61' && !(await liensLs(pg))['71000001'], 'C · délié : l’annonce reprend le N°61 (l’état d’avant)', await numVc(pg, '71000001'));
        dit(!!(await pg.$('[data-vc-relier="71000001"]')), 'C · « Relier à Vinted » revient');
      });
      await essaie('D. Relier depuis Vinted', async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=annonces&site=vinted`, { waitUntil: 'domcontentloaded' });
        // (5 nov., chantier C — revue 2.6) « Relier à Vestiaire » vit dans la feuille « … » de la carte
        //  (deux gestes à la vue). On l'ouvre comme la personne : « Détails et gestes » au téléphone, puis « … ».
        await pg.waitForSelector('[data-carte-annonce="8013"] [data-fiche-menu-ouvrir]', { state: 'attached', timeout: 20000 }).catch(async (e) => { await capture(pg, `vinted-ko-${nomVp}`); throw e; });
        await pg.evaluate(() => { const c = document.querySelector('[data-carte-annonce="8013"]'); const d = c && c.querySelector('[data-fiche-plus-bouton][aria-expanded="false"]'); if (d && d.offsetParent) d.click(); });
        await pg.waitForTimeout(250);
        { const o = pg.locator('[data-carte-annonce="8013"] [data-fiche-menu-ouvrir]').first(); await o.scrollIntoViewIfNeeded().catch(() => {}); await o.click({ timeout: 5000 }).catch(() => o.evaluate((x) => x.click())); }
        await pg.waitForSelector('[data-annonce-relier-vc="8013"]', { state: 'attached', timeout: 20000 }).catch(async (e) => { await capture(pg, `vinted-ko-${nomVp}`); throw e; });
        const plus = pg.locator('[data-annonce-relier-vc="8013"]');
        if (!(await plus.isVisible())) { await pg.evaluate(() => { const b = document.querySelector('[data-annonce-relier-vc="8013"]'); const c = b && b.closest('[data-fiche-plus]'); const btn = c && c.parentElement && c.parentElement.querySelector('[data-fiche-plus-bouton]'); if (btn) btn.click(); }); await pg.waitForTimeout(300); }
        await plus.scrollIntoViewIfNeeded().catch(() => {});
        await plus.click();
        await pg.waitForSelector('[data-lien-vc="vinted"] [data-lien-vc-candidat]', { timeout: 15000 });
        const s = await pg.evaluate(() => ({ sugg: [...document.querySelectorAll('[data-lien-vc-suggere]')].map((x) => x.getAttribute('data-lien-vc-candidat')), tous: [...document.querySelectorAll('[data-lien-vc-candidat]')].map((x) => x.getAttribute('data-lien-vc-candidat')) }));
        dit(s.sugg.join() === '71000001' && s.tous.includes('71000002'), 'D · suggérée : le cabas Gucci beige ; les escarpins noirs restent choisissables dans « Tous »', JSON.stringify(s));
        await capture(pg, `feuille-vinted-${nomVp}`);
        await pg.click('[data-lien-vc-relier="71000001"]');
        await confirmer(pg, 'Relier');
        await attendLs(pg, () => !!JSON.parse(localStorage.getItem('vrm_vc_liens') || '{}')['71000001']);
        const l = await liensLs(pg);
        dit(l['71000001'] && l['71000001'].item === '8013' && l['71000001'].numero === '13', 'D · relié dans l’autre sens : P1 ↔ N°13', JSON.stringify(l['71000001']));
        // (chantier C) Le geste est dans la feuille « … » de la carte : on la rouvre pour le lire.
        await pg.waitForTimeout(300);
        if (!(await pg.$('[data-annonce-delier-vc="8013"]'))) { const o = pg.locator('[data-carte-annonce="8013"] [data-fiche-menu-ouvrir]').first(); await o.click({ timeout: 5000 }).catch(() => o.evaluate((x) => x.click())); await pg.waitForSelector('[data-annonce-delier-vc="8013"]', { timeout: 5000 }).catch(() => {}); }
        dit(!!(await pg.$('[data-annonce-delier-vc="8013"]')), 'D · la fiche Vinted dit « Délier Vestiaire »');
        await pg.keyboard.press('Escape').catch(() => {});
        await sain(pg, 'Annonces Vinted');
      });
      await essaie('E. Frise Vestiaire', async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=ventes&site=vestiaire`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('[data-vc-vente="V1"]', { timeout: 20000 });
        await pg.waitForTimeout(500);
        const f1 = await frise(pg, '[data-vc-vente="V1"]'), f2 = await frise(pg, '[data-vc-vente="V2"]');
        dit(f1 && f1.fait === '1000' && f1.cours === 'postee' && f1.ton === 'urgent', 'E · à expédier (sellerShipment « pending ») : Vendue seule, « Postée » en ambre (un geste)', JSON.stringify(f1));
        dit(f2 && f2.fait === '1110' && f2.cours === 'payee' && f2.ton !== 'urgent', 'E · livrée (sellerDelivery « done »), pas encore versée : Payée NON cochée', JSON.stringify(f2));
        await capture(pg, `ventes-vc-${nomVp}`);
        await pg.click('[data-vc-vente="V2"] .vrm-ledger-sale-toggle');
        await pg.waitForSelector('[data-recap-vente]:visible [data-fu-frise]', { timeout: 8000 });
        const r = await pg.evaluate(() => { const d = [...document.querySelectorAll('[data-recap-vente]')].find((x) => x.offsetParent !== null); return [...d.querySelectorAll('[data-fu-etape]')].map((s) => s.getAttribute('data-fait')).join(''); });
        dit(r === '1110', 'E · le récapitulatif porte la MÊME frise', r);
        await capture(pg, `ventes-vc-recap-${nomVp}`);
        await pg.keyboard.press('Escape').catch(() => {});
        await sain(pg, 'Ventes Vestiaire');
      });
      await essaie('F. Frise eBay', async () => {
        // La feuille du récapitulatif qui se ferme fait « retour » : une navigation lancée au même instant est annulée (ERR_ABORTED) ; on la refait une fois.
        await pg.goto(`http://localhost:${PORT}/?tab=plat_ebay`, { waitUntil: 'domcontentloaded' }).catch(() => pg.waitForTimeout(600).then(() => pg.goto(`http://localhost:${PORT}/?tab=plat_ebay`, { waitUntil: 'domcontentloaded' })));
        await pg.waitForSelector('[data-ebay-vente="11-0002"]', { timeout: 20000 });
        await pg.waitForTimeout(500);
        const a = await frise(pg, '[data-ebay-vente="11-0001"]'), c = await frise(pg, '[data-ebay-vente="11-0002"]');
        dit(a && a.fait === '1000' && a.cours === 'postee' && a.ton === 'urgent', 'F · payée par l’acheteur, pas envoyée : Vendue seule (« Payée » NON cochée)', JSON.stringify(a));
        dit(c && c.fait === '1111', 'F · envoyée + argent libéré lu : toute la frise', JSON.stringify(c));
        await capture(pg, `ventes-ebay-${nomVp}`);
        await sain(pg, 'Ventes eBay');
      });
      dit(!ecritures.some((e) => /vc_listings|vc_ventes|ebay_orders/.test(e.u + e.corps.slice(0, 200)) && !/"id":"main"/.test(e.corps.slice(0, 40))), 'aucune ligne de l’extension ni d’eBay réécrite');
      dit(errs.length === 0, 'aucune erreur de page', errs.join(' | ').slice(0, 200));
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ lien Vinted ↔ Vestiaire + frise : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ lien Vinted ↔ Vestiaire + frise : ${ok} verts`);
  process.exit(ko ? 1 : 0);
})();
