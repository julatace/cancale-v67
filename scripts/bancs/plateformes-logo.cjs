// ═══════════════════════════════════════════════════════════════════════════
// BANC : PLATEFORMES — LOGOS, COMPTE DE LA VENTE, PUBLIER AILLEURS (5 nov.)
//        node scripts/bancs/plateformes-logo.cjs   (après la construction ;
//        BANC_PORT, 7967 par défaut ; SHOTS=dossier pour garder les captures)
// ═══════════════════════════════════════════════════════════════════════════
// Julien, 5 nov. : « les mêmes onglets que Vinted pour Leboncoin, eBay et
// Vestiaire, séparés par le logo » ; « le compte sur lequel l'article a été
// vendu doit apparaître » ; « Vinted → Leboncoin, Vestiaire, eBay : beaucoup
// plus accompagné, pro, pointilleux et fiable ».
// Données INVENTÉES (dépôt public), servies sous leur vraie forme. Exigé à
// 390 px tactile et 1512 px, clair ET sombre :
//   A. Ventes, Annonces, Achats, Messages, Colis : le MÊME sélecteur, un logo
//      dessiné par site (servi localement), « Tous » sur Ventes et Colis ; dans
//      Colis il est visible (il était caché au téléphone) ;
//   B. le compte sur CHAQUE vente : « Tous les sites » (Vinted, Leboncoin, eBay,
//      Vestiaire) et la liste de chaque site ;
//   C. un site sans compte relié reste choisissable : l'onglet dit ce qui
//      manque et le geste (« Relier eBay » pour eBay, le geste de l’écran eBay) ;
//   D. « Publier ailleurs » depuis Annonces · Leboncoin : choisir l'article par
//      son N° (jamais le titre), trois sites, quatre étapes, ce qui part (la
//      référence VRM-{n°}), l'état par identité (N°13 vu sur Vestiaire = « vue
//      en ligne »), un manque bloquant (N°14 sans photo) grise « Publier » ;
//      « Publier sur Vestiaire » ouvre la ligne de CET article ;
//   E. la fiche d'un N° ouvre le même parcours ;
//   F. aucune erreur, aucun débordement, cibles ≥ 44 px au doigt.
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 7967;
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
};
const ann = (id, titre, marque, prix, photo) => ({ id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, brand_title: marque, size_title: '42', status: 'Très bon état', is_closed: false, is_hidden: false, is_draft: false, ...(photo ? { photo: { url: PHOTO_V(id) } } : {}) });
const LISTINGS = { capturedAt: ilYaH(0.1), payload: { items: [ann(9012, FICHES[9012].title, 'Nike', 80, true), ann(9013, FICHES[9013].title, 'Adidas', 70, true), ann(9014, FICHES[9014].title, 'Puma', 60, false)] } };
const DETAILS = { 9012: { description: 'Très peu portées, boîte d’origine.', photos: [PHOTO_V(9012, 1), PHOTO_V(9012, 2), PHOTO_V(9012, 3)] }, 9013: { description: 'Comme neuves.', photos: [PHOTO_V(9013, 1), PHOTO_V(9013, 2), PHOTO_V(9013, 3)] } };
const LBC_ID = '8442aaaa-0000-4000-8000-000000000001';
const K1 = 'aaaaaaaaaaaaaaa1';
const cmdEbay = (orderId, titre) => ({ orderId, orderPaymentStatus: 'PAID', orderFulfillmentStatus: 'NOT_STARTED', creationDate: ilYaH(30), cancelStatus: { cancelState: 'NONE_REQUESTED' }, lineItems: [{ sku: '', title: titre }],
  pricingSummary: { total: { value: '96.50', currency: 'EUR' }, priceSubtotal: { value: '90', currency: 'EUR' } }, paymentSummary: { totalDueSeller: { value: '95', currency: 'EUR' }, payments: [{ paymentStatus: 'PAID' }] }, totalMarketplaceFee: { value: '5', currency: 'EUR' } });
const lignesDe = ({ ebay = true, lbc = true } = {}) => [
  { id: 'main', data: { vinted_ship_done: {}, vinted_used_numeros: [12, 13, 14], vinted_annonce_numeros: FICHES } },
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
    { id: 'ebay_orders', data: { capturedAt: Date.now(), orders: [cmdEbay('11-0001', 'Converse Chuck 70 inventée')] } },
  ] : []),
];
let LIGNES = lignesDe();

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
    if (/vinted\.net/.test(u)) return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: svg('#d9c7a8') });
    return ['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue();
  });
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d, st) => route.fulfill({ status: st || 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') return j([], 201);
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

(async () => {
  let b;
  try {
    srv.listen(PORT);
    b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const [vp, sombre] of [[{ width: 390, height: 844 }, false], [{ width: 390, height: 844 }, true], [{ width: 1512, height: 950 }, false], [{ width: 1512, height: 950 }, true]]) {
      const nomVp = `${vp.width}${sombre ? '-sombre' : ''}`;
      const doigt = vp.width < 600;
      console.log(`── ${nomVp}`);
      LIGNES = lignesDe();
      const { ctx, pg, errs } = await preparer(b, vp, sombre);
      await essaie('A. Ventes : le sélecteur à logos', async () => {
        await aller(pg, 'tab=ventes');
        await pg.waitForSelector('[data-filtre-site="ventes"]', { timeout: 25000 });
        await pg.waitForTimeout(500);
        const s = await selecteur(pg, 'ventes');
        dit(s && s.logos, `${nomVp} · A · Ventes : le sélecteur À LOGOS (un seul composant)`, JSON.stringify(s && s.logos));
        const sites = s ? s.boutons.map((x) => x.site).join() : '';
        dit(sites === 'toutes,vinted,leboncoin,ebay,vestiaire', `${nomVp} · A · « Tous » puis les quatre sites, l’ordre de Vinted`, sites);
        const logos = s ? s.boutons.filter((x) => x.site !== 'toutes') : [];
        dit(logos.length === 4 && logos.every((x) => new RegExp('brands/' + x.site + '\\.svg').test(x.masque) && x.logoW >= 14 && x.logoH >= 14), `${nomVp} · A · chaque site porte SON logo (masque /brands/{site}.svg), dessiné`, JSON.stringify(logos.map((x) => [x.site, x.masque.slice(-30), Math.round(x.logoW)])));
        if (doigt) dit(s.boutons.every((x) => x.h >= 43.5), `${nomVp} · A · segments ≥ 44 px au doigt`, JSON.stringify(s.boutons.map((x) => Math.round(x.h))));
        await capture(pg, `ventes-tous-${nomVp}`);
      });
      await essaie('B. Le compte de chaque vente — Tous les sites', async () => {
        await pg.click('[data-filtre-site="ventes"] [data-site="toutes"]');
        await pg.waitForSelector('[data-ventes-toutes="lu"]', { timeout: 20000 });
        await pg.waitForFunction(() => { const l = document.querySelector('[data-toutes-vente="leboncoin"]'); return l && l.getAttribute('data-toutes-compte'); }, null, { timeout: 8000 }).catch(() => {});
        const c = await pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-toutes-vente]')].map((l) => [l.getAttribute('data-toutes-vente'), l.getAttribute('data-toutes-compte')])));
        dit(c.vinted === 'compte_a' && c.leboncoin === 'atelier_lbc_banc' && c.ebay === 'paire_perso' && c.vestiaire === 'n° 7781234', `${nomVp} · B · « Tous les sites » : le compte de chaque vente (Vinted, Leboncoin, eBay, Vestiaire)`, JSON.stringify(c));
        const logoLigne = await pg.evaluate(() => [...document.querySelectorAll('[data-toutes-vente] [data-toutes-site] [data-logo-site]')].length);
        dit(logoLigne >= 4, `${nomVp} · B · chaque ligne porte le logo de son site`, String(logoLigne));
        await sain(pg, `${nomVp} · Ventes · Tous`);
      });
      await essaie('B. Le compte de chaque vente — par site', async () => {
        const voir = async (site, sel) => {
          await pg.click(`[data-filtre-site="ventes"] [data-site="${site}"]`);
          await pg.waitForSelector(sel, { timeout: 20000 });
          await pg.waitForFunction((sel) => { const e = document.querySelector(sel); return e && e.getAttribute('data-vente-compte'); }, sel, { timeout: 6000 }).catch(() => {});
          return pg.evaluate((sel) => (document.querySelector(sel) || { getAttribute: () => null }).getAttribute('data-vente-compte'), sel);
        };
        const v = await voir('vinted', '[data-plateforme-vente="vinted"]');
        dit(v === 'compte_a', `${nomVp} · B · Vinted : le compte sur la ligne (même avec un seul compte vendeur)`, String(v));
        const vu = await pg.evaluate(() => { const e = document.querySelector('[data-plateforme-vente="vinted"] [data-fu-compte], [data-plateforme-vente="vinted"] .vrm-ledger-sale-sous'); return e ? e.innerText : ''; });
        dit(/compte_a/.test(vu), `${nomVp} · B · …et il est ÉCRIT (pas seulement un attribut)`, vu);
        await capture(pg, `ventes-vinted-${nomVp}`);
        const l = await voir('leboncoin', '[data-lbc-vente="T1"]');
        dit(l === 'atelier_lbc_banc', `${nomVp} · B · Leboncoin : le compte de la transaction, nommé tel que lu`, String(l));
        const e = await voir('ebay', '[data-ebay-vente] [data-vente-compte], [data-ebay-vente] [data-plateforme-vente]');
        dit(e === 'paire_perso', `${nomVp} · B · eBay : le compte de la commande`, String(e));
        const c = await voir('vestiaire', '[data-vc-vente="V1"]');
        dit(c === 'n° 7781234', `${nomVp} · B · Vestiaire : le compte relevé (son identifiant, aucun nom inventé)`, String(c));
        await sain(pg, `${nomVp} · Ventes · Vestiaire`);
      });
      await essaie('A. Annonces, Achats, Messages, Colis : le même sélecteur', async () => {
        for (const t of ['annonces', 'achats', 'messages']) {
          await aller(pg, 'tab=' + t);
          await pg.waitForSelector(`[data-filtre-site="${t}"]`, { timeout: 25000 });
          const s = await selecteur(pg, t);
          dit(s && s.logos && s.boutons.map((x) => x.site).join() === 'vinted,leboncoin,ebay,vestiaire' && s.boutons.every((x) => x.logoW >= 14), `${nomVp} · A · ${t} : les quatre logos, sans « Tous »`, JSON.stringify(s && s.boutons.map((x) => x.site)));
        }
        await aller(pg, 'tab=cat_bord');
        await pg.waitForSelector('[data-filtre-site="colis"]', { timeout: 25000 });
        await pg.waitForTimeout(800);
        const s = await selecteur(pg, 'colis');
        dit(s && s.logos && s.visible && s.boutons.length === 5 && s.boutons.filter((x) => x.site !== 'toutes').every((x) => x.logoW >= 14), `${nomVp} · A · Colis : le sélecteur à logos est VISIBLE (Tous + quatre sites)`, JSON.stringify(s && { v: s.visible, n: s.boutons.length }));
        await capture(pg, `colis-${nomVp}`);
        await sain(pg, `${nomVp} · Colis`);
      });
      await essaie('D. Publier ailleurs — choisir l’article', async () => {
        await aller(pg, 'tab=annonces');
        await pg.waitForSelector('[data-filtre-site="annonces"]', { timeout: 25000 });
        await pg.click('[data-filtre-site="annonces"] [data-site="leboncoin"]');
        await pg.waitForSelector('[data-pa-entree="leboncoin"] button', { timeout: 20000 });
        const hb = await pg.evaluate(() => document.querySelector('[data-pa-entree="leboncoin"] button').getBoundingClientRect().height);
        if (doigt) dit(hb >= 43.5, `${nomVp} · D · l’entrée « Publier une annonce Vinted sur Leboncoin » ≥ 44 px`, String(hb));
        await pg.click('[data-pa-entree="leboncoin"] button');
        await pg.waitForSelector('[data-publier-ailleurs="choix"]', { timeout: 8000 });
        await pg.waitForSelector('[data-pa-choix]', { timeout: 20000 });
        const n = await pg.evaluate(() => [...document.querySelectorAll('[data-pa-choix]')].map((x) => x.getAttribute('data-pa-choix-num')).sort().join());
        dit(n === '12,13,14', `${nomVp} · D · les articles proposables (source partagée : en ligne sur Vinted)`, n);
        await pg.fill('[data-pa-cherche]', '12');
        await pg.waitForTimeout(200);
        const n2 = await pg.evaluate(() => [...document.querySelectorAll('[data-pa-choix]')].map((x) => x.getAttribute('data-pa-choix-num')).join());
        dit(n2 === '12', `${nomVp} · D · « 12 » tapé ⇒ le N°12 seul (identité, pas le titre)`, n2);
        await capture(pg, `pa-choix-${nomVp}`);
        await pg.click('[data-pa-choix-num="12"]');
        await pg.waitForSelector('[data-publier-ailleurs="12"] [data-pa-site]', { timeout: 15000 });
        await pg.waitForFunction(() => !document.querySelector('[data-pa-lecture]'), null, { timeout: 20000 }).catch(() => {});
        await pg.waitForTimeout(400);
        const r = await pg.evaluate(() => ({
          sites: [...document.querySelectorAll('[data-pa-site]')].map((x) => x.getAttribute('data-pa-site')),
          etats: Object.fromEntries([...document.querySelectorAll('[data-pa-site]')].map((x) => [x.getAttribute('data-pa-site'), x.getAttribute('data-pa-etat')])),
          etapes: [...document.querySelectorAll('[data-pa-site="leboncoin"] [data-pa-etape-cle]')].map((x) => x.getAttribute('data-pa-etape-cle') + ':' + x.getAttribute('data-pa-etape-etat')),
          ident: (document.querySelector('[data-pa-site="leboncoin"] [data-pa-identite]') || { getAttribute: () => null }).getAttribute('data-pa-identite'),
          titre: (document.querySelector('[data-pa-site="leboncoin"] [data-pa-titre]') || {}).innerText || '',
          photos: (document.querySelector('[data-pa-site="leboncoin"] [data-pa-photos]') || { getAttribute: () => null }).getAttribute('data-pa-photos'),
          desc: (document.querySelector('[data-pa-site="leboncoin"] [data-pa-description]') || {}).innerText || '',
          prix: (document.querySelector('[data-pa-site="leboncoin"] [data-pa-prix]') || { getAttribute: () => null }).getAttribute('data-pa-prix'),
          partout: (document.querySelector('[data-pa-partout]') || { getAttribute: () => null }).getAttribute('data-pa-partout'),
        }));
        dit(r.sites.join() === 'leboncoin,vestiaire,ebay', `${nomVp} · D · trois sites, Leboncoin (celui d’où il vient) en premier`, r.sites.join());
        dit(r.etapes.join() === 'verifier:fait,apercu:fait,publier:ici,suivi:a-venir', `${nomVp} · D · quatre étapes visibles, « Publier » là où il en est`, r.etapes.join());
        dit(r.ident === 'VRM-12' && /VRM-12/.test(r.desc), `${nomVp} · D · ce qui part porte le N° : « VRM-12 » dans la description`, `${r.ident} / ${r.desc.slice(0, 60)}`);
        dit(/Nike/.test(r.titre) && r.photos === '3' && r.prix === '80', `${nomVp} · D · ce qui part : le titre (règle Leboncoin), 3 photos, 80 €`, JSON.stringify({ t: r.titre, p: r.photos, x: r.prix }));
        dit(r.etats.leboncoin === 'a-publier' && r.etats.vestiaire === 'a-publier', `${nomVp} · D · N°12 : à publier sur Leboncoin et Vestiaire (listes lues, pas vu)`, JSON.stringify(r.etats));
        dit(r.partout === 'vinted', `${nomVp} · D · « N°12 en ligne sur Vinted » (le même N° partout)`, String(r.partout));
        await capture(pg, `pa-n12-${nomVp}`);
        await sain(pg, `${nomVp} · Publier ailleurs N°12`);
        if (doigt) {
          const petits = await pg.evaluate(() => [...document.querySelectorAll('[data-publier-ailleurs] button, [data-publier-ailleurs] a')].filter((x) => { const b = x.getBoundingClientRect(); return b.width && b.height < 43.5; }).map((x) => x.outerHTML.slice(0, 70)));
          dit(!petits.length, `${nomVp} · F · cibles de la feuille ≥ 44 px`, petits.slice(0, 3).join(' | '));
        }
      });
      await essaie('D. Publier ailleurs — vue en ligne, manque bloquant, l’envoi', async () => {
        await pg.click('[data-pa-changer]');
        await pg.waitForSelector('[data-pa-choix]', { timeout: 10000 });
        await pg.fill('[data-pa-cherche]', '13');
        await pg.click('[data-pa-choix-num="13"]');
        await pg.waitForSelector('[data-publier-ailleurs="13"] [data-pa-site="vestiaire"]', { timeout: 15000 });
        await pg.waitForFunction(() => { const v = document.querySelector('[data-pa-site="vestiaire"]'); return v && v.getAttribute('data-pa-etat') === 'vue-en-ligne'; }, null, { timeout: 20000 }).catch(() => {});
        const v = await pg.evaluate(() => ({ etat: document.querySelector('[data-pa-site="vestiaire"]').getAttribute('data-pa-etat'), voir: !!document.querySelector('[data-pa-site="vestiaire"] [data-pa-voir], [data-pa-site="vestiaire"] .vrm-pa-actions'), publier: !!document.querySelector('[data-pa-publier="vestiaire"]'), partout: document.querySelector('[data-pa-partout]').getAttribute('data-pa-partout') }));
        dit(v.etat === 'vue-en-ligne' && !v.publier && v.partout === 'vinted,vestiaire', `${nomVp} · D · N°13 vu sur Vestiaire PAR IDENTITÉ (lien posé) ⇒ « vue en ligne », plus de bouton Publier`, JSON.stringify(v));
        await capture(pg, `pa-n13-${nomVp}`);
        await pg.click('[data-pa-changer]');
        await pg.waitForSelector('[data-pa-choix]', { timeout: 10000 });
        await pg.fill('[data-pa-cherche]', '14');
        await pg.click('[data-pa-choix-num="14"]');
        await pg.waitForSelector('[data-publier-ailleurs="14"] [data-pa-site="ebay"]', { timeout: 15000 });
        const m = await pg.evaluate(() => ({ manque: (document.querySelector('[data-pa-site="ebay"] [data-pa-manque="photos"]') || { getAttribute: () => null }).getAttribute('data-bloque'),
          desactive: (document.querySelector('[data-pa-publier="ebay"]') || {}).disabled, etape: document.querySelector('[data-pa-site="ebay"]').getAttribute('data-pa-etape') }));
        dit(m.manque === '1' && m.desactive === true && m.etape === 'verifier', `${nomVp} · D · N°14 sans photo : « Aucune photo » bloquant, « Préparer sur eBay » grisé, étape « Vérifier »`, JSON.stringify(m));
        await capture(pg, `pa-n14-${nomVp}`);
        // L'envoi : « Publier sur Vestiaire » ouvre la ligne de CET article dans Annonces · Vestiaire.
        await pg.click('[data-pa-changer]');
        await pg.waitForSelector('[data-pa-choix]', { timeout: 10000 });
        await pg.fill('[data-pa-cherche]', '12');
        await pg.click('[data-pa-choix-num="12"]');
        await pg.waitForSelector('[data-pa-publier="vestiaire"]:not([disabled])', { timeout: 15000 });
        await pg.click('[data-pa-publier="vestiaire"]');
        await pg.waitForSelector('[data-vc-paire="9012"][data-vc-demande]', { timeout: 20000 });
        const t = await pg.evaluate(() => ({ site: (document.querySelector('[data-tache="annonces"]') || { getAttribute: () => null }).getAttribute('data-tache-site'), feuille: !!document.querySelector('[data-publier-ailleurs]') }));
        await pg.waitForFunction(() => !document.querySelector('[data-publier-ailleurs]'), null, { timeout: 4000 }).catch(() => {});
        dit(t.site === 'vestiaire', `${nomVp} · D · « Publier sur Vestiaire » ⇒ Annonces · Vestiaire, la ligne du N°12 mise en évidence (son clic publie)`, JSON.stringify(t));
        await capture(pg, `pa-vers-vc-${nomVp}`);
        await sain(pg, `${nomVp} · Annonces · Vestiaire`);
      });
      await essaie('E. La fiche du N° ouvre le parcours', async () => {
        await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:fiche-paire', { detail: '12' })));
        await pg.waitForSelector('[data-fiche-publier-ailleurs]', { timeout: 20000 });
        await pg.click('[data-fiche-publier-ailleurs]');
        await pg.waitForSelector('[data-publier-ailleurs="12"] [data-pa-site]', { timeout: 15000 });
        dit(true, `${nomVp} · E · Fiche N°12 → « Publier ailleurs » ouvre le parcours du N°12`);
        await pg.click('[data-pa-fermer]');
      });
      dit(!errs.length, `${nomVp} · aucune erreur de page`, errs.slice(0, 2).join(' | '));
      await ctx.close();
      // C. Sans compte eBay ni Leboncoin : l'onglet dit ce qui manque et le geste.
      LIGNES = lignesDe({ ebay: false, lbc: false });
      const z = await preparer(b, vp, sombre);
      await essaie('C. Un site sans compte', async () => {
        await aller(z.pg, 'tab=achats');
        await z.pg.waitForSelector('[data-filtre-site="achats"]', { timeout: 25000 });
        await z.pg.waitForTimeout(1500);
        const s = await selecteur(z.pg, 'achats');
        dit(s && s.boutons.length === 4 && s.boutons.find((x) => x.site === 'ebay').sansCompte, `${nomVp} · C · eBay sans compte : toujours dans le sélecteur, estompé`, JSON.stringify(s && s.boutons.map((x) => [x.site, x.sansCompte])));
        await z.pg.click('[data-filtre-site="achats"] [data-site="ebay"]');
        await z.pg.waitForSelector('[data-onglet-manque="ebay"][data-onglet="achats"]', { timeout: 10000 });
        const m = await z.pg.evaluate(() => { const e = document.querySelector('[data-onglet-manque="ebay"]'); const b = e.querySelector('[data-onglet-geste-bouton="comptes"][data-vers-comptes-ebay]'); return { geste: (e.querySelector('[data-onglet-geste]') || {}).innerText || '', bouton: !!b && /Relier eBay/.test(b.innerText) }; });
        dit(/Paramètres → Comptes eBay/.test(m.geste) && m.bouton, `${nomVp} · C · Achats · eBay : « Aucun compte eBay relié » + le geste et son bouton`, JSON.stringify(m));
        await capture(z.pg, `manque-ebay-${nomVp}`);
        await z.pg.click('[data-onglet-geste-bouton="comptes"]');
        await z.pg.waitForSelector('[data-ebay-compte-section]', { timeout: 15000 }).catch(() => {});
        dit(!!(await z.pg.$('[data-ebay-compte-section]')), `${nomVp} · C · « Relier eBay » mène à Paramètres → Comptes eBay`);
        await aller(z.pg, 'tab=cat_bord');
        await z.pg.waitForSelector('[data-filtre-site="colis"]', { timeout: 25000 });
        await z.pg.click('[data-filtre-site="colis"] [data-site="leboncoin"]');
        await z.pg.waitForSelector('[data-onglet-manque="leboncoin"][data-onglet="colis"]', { timeout: 10000 });
        dit(true, `${nomVp} · C · Colis · Leboncoin sans compte : ce qui manque et le geste`);
        await sain(z.pg, `${nomVp} · Colis sans Leboncoin`);
      });
      dit(!z.errs.length, `${nomVp} · C · aucune erreur de page`, z.errs.slice(0, 2).join(' | '));
      await z.ctx.close();
    }
  } catch (e) { ko++; console.log('❌ le banc a levé — ' + (e && e.message)); }
  if (b) await b.close(); srv.close();
  console.log(`\n${ko ? '❌ ' + ko + ' contrôle(s) au rouge' : '✅ Plateformes : un sélecteur à logos partout, le compte sur chaque vente, « Publier ailleurs » guidé'} (${ok} verts)`);
  process.exit(ko ? 1 : 0);
})();
