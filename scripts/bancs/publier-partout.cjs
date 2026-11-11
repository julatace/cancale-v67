// ═══════════════════════════════════════════════════════════════════════════
// BANC : PUBLIER PARTOUT — DEPUIS L'ANNONCE VINTED (11 nov.)
//        node scripts/bancs/publier-partout.cjs   (après la construction ;
//        BANC_PORT, 7968 par défaut ; SHOTS=dossier pour garder les captures)
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « Publier partout en un geste — mais ça doit PARTIR DE L'ANNONCE
// VINTED ». Données INVENTÉES (dépôt public), servies sous leur vraie forme
// (le service et les lignes sont ceux de plateformes-logo.cjs). 390 px tactile
// et 1512 px, clair ET sombre :
//   A. Annonces → ⋯ d'une annonce → « Publier partout » : UNE feuille, trois sites ;
//      chaque site dit ce qui part (prix, référence VRM-{n°}) ;
//   B. sans extension dans ce navigateur : Leboncoin et Vestiaire ne partent PAS
//      et le disent (garde de la voie) ; eBay (un brouillon) reste possible ;
//   C. N°13 déjà sur Vestiaire PAR IDENTITÉ (lien posé) ⇒ « déjà en ligne », sans case ;
//   D. le prix par site : « +5 € » sur eBay ⇒ 85 € sur eBay, 80 € ailleurs ;
//   E. en série (la sélection d'Annonces, par N°) : plusieurs annonces, une feuille ;
//   F. le bouton envoie eBay : un BROUILLON écrit avec SON N° (identité), aucune
//      publication eBay, aucun port ; l'état « à finir sur le site » est dit ;
//   G. aucune erreur, aucun débordement, cases ≥ 44 px au doigt.
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 7968;
const SHOTS = process.env.SHOTS || '';
const MAINTENANT = Date.now(), H = 3600000, J = 24 * H;
const ilYaH = (h) => new Date(MAINTENANT - h * H).toISOString();
const ACCOUNTS = [
  { id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: ilYaH(0), created_at: ilYaH(2000) },
  { id: 2, vinted_user_id: '222', login: 'compte_b', domain: 'www.vinted.fr', updated_at: ilYaH(0), created_at: ilYaH(2000) },
];
const PHOTO_V = (n, k = 1) => `https://images1.vinted.net/t/${n}-${k}.jpg`;
const FICHES = {
  9012: { numero: '12', title: 'Nike Air Max 90 inventée taille 42', photo: PHOTO_V(9012), numberedAt: ilYaH(300), accountId: '111' },
  9013: { numero: '13', title: 'Adidas Samba inventée taille 40', photo: PHOTO_V(9013), numberedAt: ilYaH(200), accountId: '111' },
  9014: { numero: '14', title: 'Puma Suede inventée taille 43', numberedAt: ilYaH(100), accountId: '111' },
  // (relecture) Supprimé de Vinted, dit « toujours chez moi » : proposable, mais la publication
  // Leboncoin de VRM part d'une annonce Vinted EN LIGNE ⇒ bloquée et dite, jamais un bouton muet.
  9015: { numero: '15', title: 'Reebok Club C inventée taille 41', photo: PHOTO_V(9015), numberedAt: ilYaH(400), accountId: '111' },
};
const DECISIONS = { 9015: { choix: 'chez-moi', at: ilYaH(50), numero: '15' } };
const ann = (id, titre, marque, prix, photo) => ({ id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, brand_title: marque, size_title: '42', status: 'Très bon état', is_closed: false, is_hidden: false, is_draft: false, ...(photo ? { photo: { url: PHOTO_V(id) } } : {}) });
const LISTINGS = { capturedAt: ilYaH(0.1), payload: { items: [ann(9012, FICHES[9012].title, 'Nike', 80, true), ann(9013, FICHES[9013].title, 'Adidas', 70, true), ann(9014, FICHES[9014].title, 'Puma', 60, false)] } };
const DETAILS = { 9012: { description: 'Très peu portées, boîte d’origine.', photos: [PHOTO_V(9012, 1), PHOTO_V(9012, 2), PHOTO_V(9012, 3)] }, 9013: { description: 'Comme neuves.', photos: [PHOTO_V(9013, 1), PHOTO_V(9013, 2), PHOTO_V(9013, 3)] } };
const LBC_ID = '8442aaaa-0000-4000-8000-000000000001';
const K1 = 'aaaaaaaaaaaaaaa1';
const cmdEbay = (orderId, titre) => ({ orderId, orderPaymentStatus: 'PAID', orderFulfillmentStatus: 'NOT_STARTED', creationDate: ilYaH(30), cancelStatus: { cancelState: 'NONE_REQUESTED' }, lineItems: [{ sku: '', title: titre }],
  pricingSummary: { total: { value: '96.50', currency: 'EUR' }, priceSubtotal: { value: '90', currency: 'EUR' } }, paymentSummary: { totalDueSeller: { value: '95', currency: 'EUR' }, payments: [{ paymentStatus: 'PAID' }] }, totalMarketplaceFee: { value: '5', currency: 'EUR' } });
const lignesDe = ({ ebay = true, lbc = true } = {}) => [
  { id: 'main', data: { vinted_ship_done: {}, vinted_used_numeros: [12, 13, 14, 15], vinted_annonce_numeros: FICHES } },
  { id: 'harvest_111_listings', data: LISTINGS },
  { id: 'harvest_222_listings', data: { capturedAt: ilYaH(0.1), payload: { items: [] } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: ilYaH(0.2), payload: { my_orders: [{ transaction_id: 5501, id: 5501, title: 'Vans Old Skool inventée', price: { amount: '45', currency_code: 'EUR' }, status: 'Commande finalisée', date: ilYaH(30) }] } } },
  { id: 'harvest_222_orders_sold', data: { capturedAt: ilYaH(0.2), payload: { my_orders: [] } } },
  { id: 'vinted_item_details', data: DETAILS },
  { id: 'vinted_lbc_posted', data: { ids: [] } },
  { id: 'vinted_vc_posted', data: { ids: [] } },
  ...(lbc ? [
    { id: 'lbc_accounts', data: { accounts: { ['lbc-account:' + LBC_ID]: { id: 'lbc-account:' + LBC_ID, name: 'atelier_lbc_banc', type: 'particulier', sessionAt: ilYaH(2) } }, updatedAt: ilYaH(0) } },
    { id: 'lbc_listings', data: { items: {}, lectures: { [LBC_ID]: { at: ilYaH(1), total: 0, n: 0 } } } },
    { id: 'lbc_ventes', data: { maj: ilYaH(1), ventes: { T1: { txId: 'T1', isSeller: true, price: 10000, dateVente: ilYaH(20), parcelColor: 'finished', account: LBC_ID, title: 'Asics Gel inventée', at: ilYaH(20) } } } },
  ] : []),
  { id: 'vc_listings', data: { capturedAt: ilYaH(0.3), complet: true, liens: { 71000013: '13' }, items: { 71000013: { titre: 'Adidas Samba inventée', statut: 'published', vuAt: ilYaH(0.3), prix: { valeur: 75, devise: 'EUR', cle: 'price' } } } } },
  { id: 'vc_ventes', data: { lectures: { ventes: { at: ilYaH(0.3) } }, ventes: { V1: { productId: '71000099', compte: '7781234', aExpedier: false, date: ilYaH(40), titre: 'Mocassins inventés', etat: '', etapesVc: { sellerSale: 'done', sellerShipment: 'done', sellerConformity: 'done', sellerDelivery: 'done', sellerPayment: 'upcoming' } } } } },
  ...(ebay ? [
    { id: 'ebay_comptes', data: { comptes: [{ cle: K1, pseudo: 'paire_perso', principal: true, ajouteLe: 1 }] } },
    { id: 'ebay_listings', data: { items: [], capturedAt: Date.now() } },
    // (relecture) Le brouillon eBay du N°12, MIS EN LIGNE (programme.itemId) : « publiée », jamais « préparée ».
    { id: 'ebay_brouillons', data: { majAt: Date.now(), items: { b12: { id: 'b12', pairId: '9012', numero: '12', titre: FICHES[9012].title, etatBrouillon: 'en-ligne', programme: { itemId: '335500000012', debut: null, demande: null, at: Date.now() - H } } } } },
    { id: 'ebay_orders', data: { capturedAt: Date.now(), orders: [cmdEbay('11-0001', 'Converse Chuck 70 inventée')] } },
  ] : []),
];
let LIGNES = lignesDe();
const POSTS = [], ACTIONS_EBAY = [];

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (!c && d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 180)); } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.mjs': 'text/javascript' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg.replace(/^"|"$/g, '')];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' ? String(v) : v);
  }
  return out;
};
const svg = (c) => `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="300" height="400" fill="${c}"/></svg>`;

async function preparer(b, vp, sombre) {
  const ctx = await b.newContext({ viewport: vp, colorScheme: sombre ? 'dark' : 'light', locale: 'fr-FR', ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(([sombre, fiches, decisions]) => {
    try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(!!sombre)); localStorage.setItem('vrm_visite_vue', 'true'); if (!sessionStorage.getItem('banc_pose')) { localStorage.setItem('vinted_annonce_numeros', JSON.stringify(fiches)); localStorage.setItem('vrm_cycle_decisions', JSON.stringify(decisions)); sessionStorage.setItem('banc_pose', '1'); } } catch (_) {}
  }, [sombre, FICHES, DECISIONS]);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    if (/vinted\.net/.test(u)) return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: svg('#d9c7a8') });
    return ['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue();
  });
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d, st) => route.fulfill({ status: st || 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') { POSTS.push({ url: u, body: req.postData() || '' }); return j([], 201); }
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
    ACTIONS_EBAY.push(String(body.action || ''));
    if (body.action === 'pubinfo') return j({ ok: true, categorie: { categoryId: '15709', suggeree: { categoryId: '15709', categoryName: 'Baskets (inventée)' } },
      attributs: [{ nom: 'Marque', requis: true, mode: 'FREE_TEXT', valeurs: [] }, { nom: 'Type', requis: true, mode: 'SELECTION_ONLY', valeurs: ['Basket'] }], conditions: [{ id: '1000' }, { id: '3000' }] });
    if (body.action === 'status') return j(LIGNES.some((r) => r.id === 'ebay_comptes') ? { ok: true, connected: true, comptes: [{ cle: K1, pseudo: 'paire_perso', principal: true, relie: true }] } : { ok: true, connected: false, comptes: [] });
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
// Le sélecteur d'un écran : ses segments, leur logo (masque servi localement), leur taille.
const selecteur = (pg, id) => pg.evaluate((id) => {
  const r = document.querySelector(`[data-filtre-site="${id}"]`);
  if (!r) return null;
  const vis = (el) => { const b = el.getBoundingClientRect(); const cs = getComputedStyle(el); return b.width > 0 && b.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  return { logos: r.hasAttribute('data-selecteur-logos'), visible: vis(r), boutons: [...r.querySelectorAll('button[data-site]')].map((b) => {
    const l = b.querySelector('[data-logo-site]'); const cs = l ? getComputedStyle(l) : null;
    const m = cs ? (cs.maskImage || cs.webkitMaskImage || '') : '';
    const bb = b.getBoundingClientRect(), lb = l ? l.getBoundingClientRect() : { width: 0, height: 0 };
    return { site: b.getAttribute('data-site'), presse: b.getAttribute('aria-pressed'), masque: m, logoW: lb.width, logoH: lb.height, h: bb.height, w: bb.width, sansCompte: b.hasAttribute('data-sans-compte'), label: b.getAttribute('aria-label') };
  }) };
}, id);
const aller = async (pg, q) => { await pg.goto(`http://localhost:${PORT}/?${q}`, { waitUntil: 'domcontentloaded' }); };

const cases = (pg) => pg.evaluate(() => [...document.querySelectorAll('[data-pp-case]')].map((c) => {
  const i = c.querySelector('input[type="checkbox"]'); const l = c.querySelector('.vrm-pp-coche'); const b = l ? l.getBoundingClientRect() : { height: 0 };
  return { cle: c.getAttribute('data-pp-case'), site: c.getAttribute('data-pp-site'), cochable: c.getAttribute('data-pp-cochable'), raison: c.getAttribute('data-pp-raison'),
    deja: c.getAttribute('data-pp-deja'), coche: !!(i && i.checked), prix: (c.querySelector('[data-pp-prix]') || {}).getAttribute ? c.querySelector('[data-pp-prix]').getAttribute('data-pp-prix') : '', h: b.height,
    resultat: c.getAttribute('data-pp-resultat'), texte: (c.querySelector('[data-pp-raison-texte]') || {}).innerText || '' };
}));

(async () => {
  let b;
  try {
    srv.listen(PORT);
    b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const [vp, sombre] of [[{ width: 390, height: 844 }, false], [{ width: 390, height: 844 }, true], [{ width: 1512, height: 950 }, false], [{ width: 1512, height: 950 }, true]]) {
      const nomVp = `${vp.width}${sombre ? '-sombre' : ''}`;
      const doigt = vp.width < 600;
      console.log(`── ${nomVp}`);
      LIGNES = lignesDe(); POSTS.length = 0; ACTIONS_EBAY.length = 0;
      const { ctx, pg, errs } = await preparer(b, vp, sombre);
      await essaie('A. La fiche d’une annonce Vinted → Publier partout', async () => {
        await aller(pg, 'tab=annonces');
        await pg.waitForSelector('[data-fiche-menu-ouvrir="9012"]', { state: 'attached', timeout: 25000 });
        const plus = await pg.$('[data-fiche-menu-ouvrir="9012"]');
        if (!(await plus.isVisible())) { const carte = await pg.evaluateHandle(() => document.querySelector('[data-fiche-menu-ouvrir="9012"]').closest('[data-fiche-plus]').parentElement.querySelector('[data-fiche-plus-bouton]')); await carte.asElement().click(); }
        await pg.click('[data-fiche-menu-ouvrir="9012"]');
        await pg.waitForSelector('[data-fiche-partout="12"]', { timeout: 8000 });
        await pg.click('[data-fiche-partout="12"]');
        await pg.waitForSelector('[data-publier-partout="1"] [data-pp-case]', { timeout: 25000 });
        await pg.waitForFunction(() => !document.querySelector('[data-pp-lecture]'), null, { timeout: 15000 }).catch(() => {});
        await pg.waitForTimeout(400);
        const c = await cases(pg);
        dit(c.map((x) => x.site).join() === 'leboncoin,vestiaire,ebay', `${nomVp} · A · une feuille, trois sites (Leboncoin, Vestiaire, eBay)`, JSON.stringify(c.map((x) => x.site)));
        dit(c.every((x) => x.prix === '80'), `${nomVp} · A · le prix Vinted (80 €) sur chaque site par défaut (jamais deviné)`, JSON.stringify(c.map((x) => x.prix)));
        await pg.click('[data-pp-apercu-bouton="9012:ebay"]').catch(() => {});
        const ident = await pg.evaluate(() => [...document.querySelectorAll('[data-pp-identite]')].map((x) => x.getAttribute('data-pp-identite')));
        dit(ident.length && ident.every((x) => x === 'VRM-12'), `${nomVp} · A · « ce qui part » porte l’identité VRM-12`, JSON.stringify(ident));
        await capture(pg, `partout-un-${nomVp}`);
        await sain(pg, `${nomVp} · feuille`);
        // B. sans extension : les voies d'extension ne partent pas, et le disent.
        const lbc = c.find((x) => x.site === 'leboncoin'), vc = c.find((x) => x.site === 'vestiaire'), eb = c.find((x) => x.site === 'ebay');
        dit(lbc.cochable === '0' && lbc.raison === 'ext' && (doigt ? /ordinateur|extension/i : /extension/i).test(lbc.texte), `${nomVp} · B · Leboncoin sans extension : pas de case, la raison dite`, JSON.stringify(lbc));
        dit(vc.cochable === '0' && vc.raison === 'ext', `${nomVp} · B · Vestiaire sans extension : pas de case`, JSON.stringify(vc));
        dit(eb.cochable === '1', `${nomVp} · B · eBay (un brouillon) reste possible`, JSON.stringify(eb));
        if (doigt) dit(c.every((x) => x.h >= 43.5), `${nomVp} · G · chaque case ≥ 44 px au doigt`, JSON.stringify(c.map((x) => Math.round(x.h))));
        // D. Le prix par site.
        await pg.selectOption('[data-pp-mode-choix="ebay"]', 'eur');
        await pg.fill('[data-pp-valeur="ebay"]', '5');
        await pg.press('[data-pp-valeur="ebay"]', 'Enter');
        await pg.waitForFunction(() => { const e = document.querySelector('[data-pp-case="9012:ebay"] [data-pp-prix]'); return e && e.getAttribute('data-pp-prix') === '85'; }, null, { timeout: 5000 }).catch(() => {});
        const c2 = await cases(pg);
        dit(c2.find((x) => x.site === 'ebay').prix === '85' && c2.find((x) => x.site === 'leboncoin').prix === '80', `${nomVp} · D · « +5 € » sur eBay ⇒ 85 € sur eBay, 80 € ailleurs`, JSON.stringify(c2.map((x) => [x.site, x.prix])));
        const garde = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_partout_prix') || 'null'); } catch (_) { return null; } });
        dit(garde && garde.ebay && garde.ebay.mode === 'eur' && garde.ebay.valeur === 5, `${nomVp} · D · le réglage est gardé (vrm_partout_prix)`, JSON.stringify(garde));
        await capture(pg, `partout-prix-${nomVp}`);
        // H. Tous les paramètres : un DÉFAUT (Vestiaire · matière « Cuir ») ⇒ « à finir sur Vestiaire » ;
        //    puis PAR ANNONCE (Leboncoin · livraison « non », que la voie contredirait) ⇒ dit et bloquant.
        await pg.click('[data-pp-defauts-bouton]');
        const matiere = '[data-pp-defaut-site="vestiaire"] [data-pp-champ="vestiaire:matiere"]';
        await pg.fill(matiere, 'Cuir'); await pg.press(matiere, 'Enter');
        await pg.waitForSelector('[data-pp-case="9012:vestiaire"] [data-pp-finir]', { timeout: 5000 }).catch(() => {});
        const fin = await pg.evaluate(() => { const e = document.querySelector('[data-pp-case="9012:vestiaire"] [data-pp-finir]'); return e ? e.innerText : ''; });
        dit(/Mati[eè]re « Cuir »/.test(fin), `${nomVp} · H · défaut Vestiaire « matière Cuir » ⇒ « à finir sur Vestiaire » nommé`, fin);
        const gp = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_partout_params') || 'null'); } catch (_) { return null; } });
        dit(gp && gp.vestiaire && gp.vestiaire.matiere === 'Cuir', `${nomVp} · H · le défaut est gardé (vrm_partout_params)`, JSON.stringify(gp));
        const liv = '[data-pp-case="9012:leboncoin"] [data-pp-champ="leboncoin:livraison"][data-pp-champ-quoi="annonce"]';
        await pg.selectOption(liv, 'non');
        await pg.waitForSelector('[data-pp-case="9012:leboncoin"] [data-pp-manque="hors-voie-livraison"]', { timeout: 5000 }).catch(() => {});
        const hv = await pg.evaluate(() => { const e = document.querySelector('[data-pp-case="9012:leboncoin"] [data-pp-manque="hors-voie-livraison"]'); return e ? e.getAttribute('data-bloque') : ''; });
        dit(hv === '1', `${nomVp} · H · par annonce : livraison « non » que la voie contredirait ⇒ dit et bloquant`, hv);
        const champs = await pg.evaluate(() => [...document.querySelectorAll('[data-pp-case="9012:leboncoin"] [data-pp-champ-ligne]')].map((x) => x.getAttribute('data-pp-champ-ligne').split(':').pop()));
        dit(['categorie', 'sousCategorie', 'marque', 'taille', 'couleur', 'etat', 'matiere', 'livraison', 'mainPropre', 'lieu', 'options'].every((c) => champs.includes(c)), `${nomVp} · H · Leboncoin : tous ses paramètres sont réglables`, JSON.stringify(champs));
        await pg.locator('[data-pp-case="9012:leboncoin"] [data-pp-champ-ligne$=":livraison"]').scrollIntoViewIfNeeded();
        await capture(pg, `partout-parametres-${nomVp}`);
        await sain(pg, `${nomVp} · paramètres`);
        await pg.selectOption(liv, '');
        await pg.fill(matiere, ''); await pg.press(matiere, 'Enter');
        await pg.click('[data-pp-fermer]');
      });
      await essaie('E/F. En série, puis le brouillon eBay', async () => {
        await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:publier-partout', { detail: { nums: ['13', '14'] } })));
        await pg.waitForSelector('[data-publier-partout="2"] [data-pp-case]', { timeout: 25000 });
        await pg.waitForFunction(() => !document.querySelector('[data-pp-lecture]'), null, { timeout: 15000 }).catch(() => {});
        await pg.waitForTimeout(400);
        const c = await cases(pg);
        dit(c.length === 6, `${nomVp} · E · deux annonces, trois sites chacune, UNE feuille`, String(c.length));
        const vc13 = c.find((x) => x.cle === '9013:vestiaire');
        dit(vc13 && vc13.deja === '1' && vc13.cochable === '0', `${nomVp} · C · N°13 déjà sur Vestiaire PAR SON N° ⇒ « déjà en ligne », pas de case`, JSON.stringify(vc13));
        const e13 = c.find((x) => x.cle === '9013:ebay');
        if (e13 && e13.cochable === '1' && !e13.coche) await pg.click('[data-pp-coche="9013:ebay"]');
        const e14 = c.find((x) => x.cle === '9014:ebay');
        if (e14 && e14.coche) await pg.click('[data-pp-coche="9014:ebay"]');
        await capture(pg, `partout-serie-${nomVp}`);
        await pg.click('[data-pp-lancer]');
        await pg.waitForSelector('[data-pp-bilan]', { timeout: 20000 });
        const r = await cases(pg);
        dit(r.find((x) => x.cle === '9013:ebay').resultat === 'a-finir', `${nomVp} · F · eBay : « à finir sur le site » (un brouillon, jamais « publié » d’ici)`, JSON.stringify(r.find((x) => x.cle === '9013:ebay')));
        const ecrit = POSTS.filter((p) => /ebay_brouillons/.test(p.body));
        let br = null; try { const rows = JSON.parse(ecrit[ecrit.length - 1].body); br = Object.values(rows[0].data.items).find((x) => x.pairId === '9013'); } catch (_) { br = null; }
        dit(br && br.numero === '13' && br.origine === 'partout' && br.categorie && br.categorie.id === '15709', `${nomVp} · F · le brouillon porte SON N° (13 ⇒ SKU VRM-13) et la catégorie suggérée`, JSON.stringify(br && { numero: br.numero, cat: br.categorie }));
        dit(br && !/livraison|shipping/i.test(JSON.stringify(br)), `${nomVp} · F · aucun port dans le brouillon (§2.8)`);
        dit(!ACTIONS_EBAY.includes('publish') && !ACTIONS_EBAY.includes('pubverify'), `${nomVp} · F · aucune publication eBay d’ici`, ACTIONS_EBAY.join());
        dit(!POSTS.some((p) => /lbcPublier|vcPreparer/.test(p.body)), `${nomVp} · B · rien n’est parti vers Leboncoin ni Vestiaire sans extension`);
        await capture(pg, `partout-bilan-${nomVp}`);
        await sain(pg, `${nomVp} · série`);
        await pg.click('[data-pp-fermer]');
      });
      dit(!errs.length, `${nomVp} · aucune erreur de page`, errs.slice(0, 2).join(' | '));
      await ctx.close();
    }
  } catch (e) { ko++; console.log('❌ le banc a levé — ' + (e && e.message)); }
  if (b) await b.close(); srv.close();
  console.log(`\n${ko ? '❌ ' + ko + ' contrôle(s) au rouge' : '✅ Publier partout : une feuille, trois sites, chacun par sa voie, identité VRM-{n°}'} (${ok} verts)`);
  process.exit(ko ? 1 : 0);
})();
