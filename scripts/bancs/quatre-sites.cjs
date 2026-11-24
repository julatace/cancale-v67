// ═══════════════════════════════════════════════════════════════════════════
// BANC : « METTRE AUSSI SUR… » — 1 PAIRE → 4 SITES (24 nov.)
//        node scripts/bancs/quatre-sites.cjs   (après la construction ; BANC_PORT, 7991 par défaut ;
//        SHOTS=dossier pour garder les captures)
// ═══════════════════════════════════════════════════════════════════════════
// Données INVENTÉES (dépôt public), servies sous leur vraie forme (le service et les lignes sont ceux de
// publier-partout.cjs). 390 px tactile et 1512 px, clair ET sombre :
//   A. la feuille d'UNE annonce (N°13) : trois sites, une case chacun ; la fiche partagée remplie par Vinted
//      (titre, description, taille, état, marque, photos) ; le prix de chaque site et ses frais ;
//   B. sans extension dans ce navigateur : Leboncoin grisé avec la raison ; Vestiaire « déjà en ligne » PAR
//      IDENTITÉ (lien posé 71000013 → 13) ; eBay possible ;
//   C. le prix Vinted change entre l'ouverture et « Créer » ⇒ eBay ARRÊTÉ (prix changé), aucun brouillon écrit ;
//   D. « Créer » ⇒ UN brouillon eBay au N°13 (SKU par le N°), aucun champ de port, aucune publication eBay ;
//      l'état « Brouillon eBay prêt » est dit ;
//   E. eBay pas relié ⇒ la case est grisée, rien n'est envoyé ;
//   F. aucune erreur, aucun débordement, cibles ≥ 44 px au doigt.
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 7991;
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
// (15 nov.) La catégorie Vinted lue sur la page de l'annonce, à la forme mesurée (`codes.catalog_id`) :
// 9012 « Femmes > Chaussures > Baskets » (2632), 9013 « Hommes > Chaussures > Chaussures habillées » (1238) ;
// 9014 sans fiche lue (catégorie pas lue).
const DETAILS = { 9012: { description: 'Très peu portées, boîte d’origine.', photos: [PHOTO_V(9012, 1), PHOTO_V(9012, 2), PHOTO_V(9012, 3)], codes: { catalog_id: 2632, brand: 'Nike' } }, 9013: { description: 'Comme neuves.', photos: [PHOTO_V(9013, 1), PHOTO_V(9013, 2), PHOTO_V(9013, 3)], codes: { catalog_id: 1238, brand: 'Adidas' } } };
// Les catégories qu'eBay « propose » au banc (inventées, à la forme de la route `parametres`).
const CATS_EBAY = { 'baskets femme': [{ id: '95672', nom: 'Baskets (inventée)', chemin: 'Mode › Femme › Chaussures femme › Baskets (inventée)' }, { id: '24087', nom: 'Chaussures de sport (inventée)', chemin: 'Sports › Chaussures (inventée)' }],
  'chaussures habillées homme': [{ id: '53120', nom: 'Chaussures habillées (inventée)', chemin: 'Mode › Homme › Chaussures homme › Habillées (inventée)' }] };
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
    // (15 nov.) Une écriture par comparer-et-échanger (`modifierLigneCas`, PATCH `data->>rev`) attend la ligne
    // ÉCRITE en retour (vide = « devancé ») : le service la rend et la garde, comme PostgREST.
    if (req.method() !== 'GET') {
      const body = req.postData() || '';
      POSTS.push({ url: u, body });
      let o = null; try { o = JSON.parse(body); } catch (_) { o = null; }
      const idEq = (/id=eq\.([^&]*)/.exec(u) || [])[1];
      if (req.method() === 'PATCH' && idEq && o && o.data) { const row = LIGNES.find((r) => r.id === idEq); if (row) row.data = o.data; else LIGNES.push({ id: idEq, data: o.data }); return j([{ id: idEq, data: o.data }], 200); }
      return j(Array.isArray(o) ? o : (o ? [o] : []), 201);
    }
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
    if (body.action === 'parametres') return j({ ok: true, arbre: '71', categories: CATS_EBAY[String(body.q || '')] || [], categoryId: null, aspects: null, conditions: null, compte: null });
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


const sites = (pg) => pg.evaluate(() => [...document.querySelectorAll('[data-mettre-aussi] [data-q4-site]')].map((r) => {
  const c = r.querySelector('input[type="checkbox"]') || r.querySelector('[role="checkbox"]');
  const b = (c && c.closest('label,button,span')) ? c.closest('label,button,span').getBoundingClientRect() : { height: 0 };
  return { site: r.getAttribute('data-q4-site'), possible: r.getAttribute('data-q4-possible'), code: r.getAttribute('data-q4-code'), coche: r.getAttribute('data-q4-coche'),
    etat: r.getAttribute('data-q4-etat'), etatCode: r.getAttribute('data-q4-etat-code'), prix: r.getAttribute('data-q4-prix'), frais: r.getAttribute('data-q4-frais'), h: Math.round(r.getBoundingClientRect().height), t: r.innerText };
}));
const ouvrir = async (pg, num) => {
  await pg.evaluate((n) => window.dispatchEvent(new CustomEvent('vrm:mettre-aussi', { detail: { num: n } })), num);
  await pg.waitForSelector(`[data-mettre-aussi="${num}"] [data-q4-site="ebay"]`, { timeout: 25000 });
  await pg.waitForFunction(() => { const r = document.querySelector('[data-q4-site="leboncoin"]'); return r && r.getAttribute('data-q4-code') !== 'lecture'; }, null, { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(500);
};
const fermer = async (pg) => { await pg.keyboard.press('Escape'); await pg.waitForSelector('[data-mettre-aussi]', { state: 'detached', timeout: 8000 }).catch(() => {}); await pg.waitForTimeout(300); };
const brouillons = () => { const r = LIGNES.find((x) => x.id === 'ebay_brouillons'); return r ? Object.values(r.data.items || {}) : []; };

(async () => {
  let b;
  try {
    srv.listen(PORT);
    b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const [vp, sombre] of [[{ width: 390, height: 844 }, false], [{ width: 390, height: 844 }, true], [{ width: 1512, height: 950 }, false], [{ width: 1512, height: 950 }, true]].filter(([v, s]) => !process.env.BANC_VP || `${v.width}${s ? '-sombre' : ''}` === process.env.BANC_VP)) {
      const nomVp = `${vp.width}${sombre ? '-sombre' : ''}`;
      const doigt = vp.width < 600;
      console.log(`── ${nomVp}`);
      LIGNES = lignesDe(); POSTS.length = 0; ACTIONS_EBAY.length = 0;
      const { ctx, pg, errs } = await preparer(b, vp, sombre);
      await essaie('A–D', async () => {
        await aller(pg, 'tab=annonces');
        await pg.waitForSelector('[data-sb-avant-cle="111_9013"]', { timeout: 30000 });
        await ouvrir(pg, '13');
        const s = await sites(pg);
        dit(s.map((x) => x.site).join() === 'leboncoin,vestiaire,ebay', `${nomVp} · A · trois sites, une case chacun`, JSON.stringify(s.map((x) => x.site)));
        const champs = await pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-q4-champ]')].map((c) => [c.getAttribute('data-q4-champ'), (c.querySelector('input,textarea') || {}).value])));
        const nPh = await pg.evaluate(() => Number((document.querySelector('[data-q4-photos]') || { getAttribute: () => -1 }).getAttribute('data-q4-photos')));
        dit(/Adidas Samba/.test(champs.titre || '') && champs.description === 'Comme neuves.' && champs.marque === 'Adidas' && champs.etat === 'Très bon état' && nPh === 3,
          `${nomVp} · A · la fiche partagée remplie par l’annonce Vinted (titre, description, marque, état, 3 photos)`, JSON.stringify([champs, nPh]));
        const lbc = s.find((x) => x.site === 'leboncoin'), vc = s.find((x) => x.site === 'vestiaire'), eb = s.find((x) => x.site === 'ebay');
        dit(lbc.possible === '0' && /^ext-/.test(lbc.code) && /extension/i.test(lbc.t), `${nomVp} · B · Leboncoin sans extension : grisé, la raison dite`, JSON.stringify(lbc));
        dit(vc.possible === '0' && vc.code === 'deja', `${nomVp} · B · Vestiaire déjà en ligne PAR IDENTITÉ (lien posé) : grisé`, JSON.stringify(vc));
        dit(eb.possible === '1' && eb.coche === '1' && eb.prix === '70' && eb.frais === 'taux' && /frais/i.test(eb.t), `${nomVp} · A · eBay possible, 70 € et ses frais (taux lu sur SES commandes)`, JSON.stringify(eb));
        if (doigt) dit(s.every((x) => x.h >= 44), `${nomVp} · F · chaque rangée ≥ 44 px au doigt`, JSON.stringify(s.map((x) => x.h)));
        await capture(pg, `q4-feuille-${nomVp}`);
        await sain(pg, `${nomVp} · feuille`);
        // C. le prix Vinted change avant « Créer » ⇒ arrêté, rien n'est écrit.
        const it = LISTINGS.payload.items.find((x) => x.id === 9013); it.price = { amount: '65', currency_code: 'EUR' }; LISTINGS.capturedAt = new Date().toISOString();
        const avant = brouillons().length;
        await pg.click('[data-q4-creer]');
        await pg.waitForFunction(() => { const r = document.querySelector('[data-q4-site="ebay"]'); return r && r.getAttribute('data-q4-etat') === 'arrete'; }, null, { timeout: 15000 }).catch(() => {});
        const s2 = await sites(pg);
        const e2 = s2.find((x) => x.site === 'ebay');
        dit(e2.etat === 'arrete' && e2.etatCode === 'prix-change' && brouillons().length === avant && !POSTS.some((p) => /ebay_brouillons/.test(p.url)),
          `${nomVp} · C · prix Vinted changé (70 → 65) ⇒ eBay arrêté, AUCUN brouillon écrit`, JSON.stringify([e2, brouillons().length]));
        await capture(pg, `q4-prix-change-${nomVp}`);
        it.price = { amount: '70', currency_code: 'EUR' };
        await fermer(pg);
        // D. « Créer » ⇒ un brouillon eBay au N°13.
        await ouvrir(pg, '13');
        await pg.click('[data-q4-creer]');
        await pg.waitForFunction(() => { const r = document.querySelector('[data-q4-site="ebay"]'); return r && ['brouillon', 'arrete'].includes(r.getAttribute('data-q4-etat')); }, null, { timeout: 20000 }).catch(() => {});
        const s3 = await sites(pg);
        const br = brouillons().filter((x) => x.numero === '13');
        const txt = JSON.stringify(br);
        dit(s3.find((x) => x.site === 'ebay').etat === 'brouillon' && br.length === 1 && br[0].pairId === '9013' && br[0].prix === '70',
          `${nomVp} · D · UN brouillon eBay au N°13 (paire 9013, 70 €), état « Brouillon eBay prêt »`, JSON.stringify([s3.find((x) => x.site === 'ebay'), br]));
        dit(!/livraison|shipping|freeShipping|gratuit|etiquette|"label"/i.test(txt) && !ACTIONS_EBAY.some((a) => /publier|programmer|retirer|label|etiquette/i.test(a)),
          `${nomVp} · D · aucun port, aucune étiquette, aucune publication eBay d’ici`, JSON.stringify(ACTIONS_EBAY));
        dit(!POSTS.some((p) => /lbc_|vc_listings|vinted_lbc_posted|vinted_vc_posted/.test(p.url)), `${nomVp} · D · rien vers Leboncoin ni Vestiaire (grisés)`, POSTS.map((p) => p.url).join(' '));
        await capture(pg, `q4-cree-${nomVp}`);
        await sain(pg, `${nomVp} · après Créer`);
      });
      dit(!errs.length, `${nomVp} · F · aucune erreur de page`, errs.join(' | ').slice(0, 300));
      await ctx.close();
    }
    // E. eBay pas relié (une taille suffit) : grisé, rien n'est envoyé.
    if (!process.env.BANC_VP) {
      LIGNES = lignesDe({ ebay: false }); POSTS.length = 0;
      const { ctx, pg } = await preparer(b, { width: 1512, height: 950 }, false);
      await essaie('E', async () => {
        await aller(pg, 'tab=annonces');
        await pg.waitForSelector('[data-sb-avant-cle="111_9013"]', { timeout: 30000 });
        await ouvrir(pg, '13');
        const s = await sites(pg); const eb = s.find((x) => x.site === 'ebay');
        dit(eb.possible === '0' && eb.code === 'ebay-jeton' && /eBay/.test(eb.t), '1512 · E · eBay pas relié : grisé, « relie eBay »', JSON.stringify(eb));
        const n = await pg.evaluate(() => (document.querySelector('[data-q4-creer]') || {}).getAttribute ? document.querySelector('[data-q4-creer]').getAttribute('data-q4-creer') : 'x');
        dit(n === '0', '1512 · E · aucun site possible ⇒ « Créer » ne part pas', n);
        await capture(pg, 'q4-sans-ebay-1512');
      });
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a pu tourner', String(e && e.message)); }
  finally { try { await b.close(); } catch (_) {} srv.close(); }
  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
