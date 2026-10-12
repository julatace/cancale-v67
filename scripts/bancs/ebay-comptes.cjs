// Banc : PLUSIEURS COMPTES eBAY (9 octobre) — l'écran RENDU, sur des données
// INVENTÉES (il vit dans le dépôt, qui est public : aucune fixture).
//
// Julien (6 octobre) : « je veux que l'on puisse sélectionner le compte dans
// l'onglet eBay, ou alors les deux comptes en même temps, tous les trois s'il y
// en a trois ; les données doivent être bien séparées ».
// Trois comptes eBay inventés, chacun avec SES lignes (`ebay_listings`,
// `ebay_listings_{clé}`…). Le banc rend l'onglet eBay à 390 et 1512 px et juge
// les `data-*` posés par l'écran, les MONTANTS rendus, et ce qui PART vers
// `/api/ebay` :
//   · « Tous les comptes » : l'union, chaque ligne marquée de son compte, le
//     résumé dit sur combien de comptes il porte ;
//   · « compte 2 » : AUCUNE annonce, vente ni montant des comptes 1 et 3 ;
//   · une paire en vente sur le compte 1 reste BLOQUÉE à la publication sur le
//     compte 2 — même quand la vue est réglée sur « compte 2 » ;
//   · publier : le compte est pré-choisi sur la vue, la confirmation le NOMME,
//     et l'envoi porte ce compte ;
//   · la même paire en vente sur deux comptes est signalée ; une alerte d'un
//     autre compte est COMPTÉE (jamais disparue sans un mot) ;
//   · « Déconnecter » est confirmé, nomme le compte, n'envoie que lui — et la
//     vue réglée sur ce compte retombe sur « Tous » ;
//   · un seul compte ⇒ aucun sélecteur (rien ne change) ;
//   · aucun débordement horizontal, aucune erreur de page.
//        node scripts/bancs/ebay-comptes.cjs
const { chromium } = require('playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.PORT) || 4812;

const auj = new Date();
const K1 = 'aaaaaaaaaaaaaaa1', K2 = 'bbbbbbbbbbbbbbb2', K3 = 'ccccccccccccccc3';
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];
const PAIRES = [[30, 'Salomon XT-6 noir taille 43', 120], [31, 'Nike Dunk Low panda taille 42', 95], [40, 'Adidas Samba blanc taille 41', 85], [50, 'Asics Gel 1130 argent taille 39', 70], [60, 'New Balance 550 gris taille 44', 90]];
const idDe = (n) => 8000 + n;
const LISTINGS = { capturedAt: auj.toISOString(), payload: { items: PAIRES.map(([n, t, p]) => ({ id: idDe(n), title: t, price: { amount: String(p), currency_code: 'EUR' }, brand_title: t.split(' ')[0], is_closed: false, is_hidden: false, is_draft: false, nPhotos: 2, photo: { url: `https://img.test/v${idDe(n)}.jpg` } })) } };
const FICHES = Object.fromEntries(PAIRES.map(([n, t]) => [String(idDe(n)), { numero: String(n), title: t, photo: `https://img.test/v${idDe(n)}.jpg` }]));
const DETAILS = Object.fromEntries(PAIRES.map(([n]) => [String(idDe(n)), { photos: [`https://img.test/v${idDe(n)}.jpg`, `https://img.test/v${idDe(n)}b.jpg`] }]));
const ann = (itemId, n, prix) => ({ itemId, title: (PAIRES.find((x) => x[0] === n) || [])[1], price: prix, sku: 'VRM-' + n, observateurs: 0, photo: '', url: 'https://www.ebay.fr/itm/' + itemId });
const cmd = (orderId, eur, titre) => ({ orderId, orderPaymentStatus: 'PAID', orderFulfillmentStatus: 'FULFILLED', lineItems: [{ sku: '', title: titre }], pricingSummary: { total: { value: eur, currency: 'EUR' } } });
let rows = [], envois = [], ecritures = [];
// Trois comptes : le premier (principal, lignes d'avant), puis deux suffixés.
// La N°31 est en vente sur le compte 1 ET sur le compte 2 (publiée à la main
// avant la garde) : la double vente entre comptes doit être dite.
const remettre = (unSeul) => {
  rows = [
    { id: 'main', data: { vinted_annonce_numeros: FICHES } },
    { id: 'harvest_111_listings', data: LISTINGS },
    { id: 'vinted_item_details', data: DETAILS },
    { id: 'ebay_comptes', data: { comptes: unSeul ? [{ cle: K1, pseudo: 'paire_perso', principal: true }] : [
      { cle: K1, pseudo: 'paire_perso', principal: true, ajouteLe: 1 },
      { cle: K2, pseudo: 'paire_pro', principal: false, ajouteLe: 2 },
      { cle: K3, pseudo: 'paire_trois', principal: false, ajouteLe: 3 },
    ] } },
    { id: 'ebay_listings', data: { items: [ann('120000000030', 30, '130.0'), ann('120000000031', 31, '99.0')], capturedAt: Date.now() } },
    { id: 'ebay_orders', data: { orders: [cmd('11-0001', '80.00', 'Converse Chuck 70 blanc')], capturedAt: Date.now() } },
    { id: 'ebay_programmees', data: { items: [], enLigne: [], complet: true, capturedAt: Date.now() } },
    { id: 'ebay_brouillons', data: { items: {
      'b-60': { id: 'b-60', numero: '60', pairId: String(idDe(60)), titre: 'New Balance 550 gris taille 44', prix: '90', quantite: '1', etat: '3000', photos: [`https://img.test/v${idDe(60)}.jpg`], categorie: { id: '15709', nom: 'Baskets', requis: [] }, aspects: {}, etatBrouillon: 'brouillon', majLe: Date.now(), compte: K3 },
    }, majAt: Date.now() } },
    ...(unSeul ? [] : [
      { id: 'ebay_listings_' + K2, data: { items: [ann('120000000040', 40, '89.0'), ann('120000000131', 31, '97.0')], capturedAt: Date.now() } },
      { id: 'ebay_orders_' + K2, data: { orders: [cmd('22-0002', '210.00', 'Puma Suede rouge')], capturedAt: Date.now() } },
      { id: 'ebay_programmees_' + K2, data: { items: [], enLigne: [], complet: true, capturedAt: Date.now() } },
      { id: 'ebay_listings_' + K3, data: { items: [ann('120000000050', 50, '75.0')], capturedAt: Date.now() } },
      { id: 'ebay_orders_' + K3, data: { orders: [cmd('33-0003', '333.00', 'Vans Old Skool noir')], capturedAt: Date.now() } },
      { id: 'ebay_programmees_' + K3, data: { items: [], enLigne: [], complet: true, capturedAt: Date.now() } },
    ]),
  ];
  envois = []; ecritures = [];
};
const registre = () => (((rows.find((r) => r.id === 'ebay_comptes') || {}).data || {}).comptes || []);

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
// Un banc ne meurt pas, il rapporte : ce qui lève devient un contrôle ROUGE.
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { dit(false, quoi, 'a levé : ' + String((e && e.message) || e).split('\n')[0].slice(0, 160)); return null; } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
srv.listen(PORT);
// Projection PostgREST : `alias:data->champ` / `alias:data->>champ` (§6.3).
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

async function ouvrir(b, vp) {
  const ctx = await b.newContext({ viewport: vp, locale: 'fr-FR', ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(([fiches]) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_annonce_numeros', JSON.stringify(fiches)); } catch (_) {} }, [FICHES]);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d, st) => route.fulfill({ status: st || 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') {
      try { for (const l of [].concat(JSON.parse(route.request().postData() || 'null') || [])) { if (!l || !l.id) continue; ecritures.push(l.id); const i = rows.findIndex((r) => r.id === l.id); if (i >= 0) rows[i] = { id: l.id, data: l.data }; else rows.push({ id: l.id, data: l.data }); } } catch (_) {}
      return j([]);
    }
    if (/select=owner/.test(u)) return j({ m: 1 }, 400);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: auj.toISOString(), cap: r.data && r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(','); return j(rows.filter((r) => ids.includes(r.id)).map(forme)); }
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  // ⚠️ enregistré APRÈS le fourre-tout → Playwright le prend en PREMIER (§6.6).
  await pg.route('**/api/ebay**', (route) => {
    const req = route.request();
    const j = (d, st) => route.fulfill({ status: st || 200, contentType: 'application/json', body: JSON.stringify(d) });
    if (req.method() !== 'POST') return j({ ok: true, ready: true, canConsent: true });
    let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch (_) {}
    if (['publish', 'deconnecter', 'programmer', 'retirer'].includes(body.action)) envois.push(body);
    // La route rend SES comptes : ceux du registre, sans les déconnectés.
    if (body.action === 'status') return j({ ok: true, connected: true, comptes: registre().filter((c) => !c.deconnecteLe).map((c) => ({ cle: c.cle, pseudo: c.pseudo, principal: !!c.principal, relie: true })) });
    if (body.action === 'pubinfo') return j({ ok: true, categorie: { categoryId: '15709', suggeree: { categoryId: '15709', categoryName: 'Baskets' } }, categories: [{ categoryId: '15709', categoryName: 'Baskets' }], conditions: [{ id: '3000', label: "D'occasion" }], attributs: [], attributsObligatoires: [] });
    if (body.action === 'publish') return j({ ok: true, itemId: '120000000777', url: 'https://www.ebay.fr/itm/120000000777', sku: body.item && body.item.numero ? 'VRM-' + body.item.numero : null });
    if (body.action === 'deconnecter') {
      const reg = registre(); const c = reg.find((x) => (body.compte ? x.cle === body.compte : x.principal));
      if (c) c.deconnecteLe = Date.now();
      return j({ ok: true, compte: c ? c.pseudo : '' });
    }
    if (body.action === 'offreinfo') return j({ ok: true, eligibles: [], complet: true });
    if (body.action === 'finances') return j({ ok: true, dispo: 10, enAttente: 0, retenu: 0, total: 10, devise: 'EUR' });
    if (body.action === 'limites') return j({ ok: true, quantite: 10, montant: 500, devise: 'EUR', inscrit: true });
    return j({ ok: true });
  });
  return { ctx, pg, errs };
}
const feuille = (pg) => pg.locator('div[style*="z-index: 2000"]');
const sousOnglet = async (pg, nom) => { await pg.getByRole('button', { name: nom, exact: true }).first().click({ timeout: 8000 }); await pg.waitForTimeout(900); };
const choisirVue = async (pg, val) => { await pg.selectOption('#vrm-sel-compte-ebay', val); await pg.waitForTimeout(700); };
const resume = (pg) => pg.$eval('[data-plat-resume]', (e) => e.innerText).catch(() => '');
const ventes = (pg) => pg.$$eval('[data-ebay-vente]', (l) => l.map((e) => ({ id: e.getAttribute('data-ebay-vente'), c: e.getAttribute('data-ebay-compte'), t: e.innerText })));
const annonces = (pg) => pg.$$eval('[data-ebay-annonce]', (l) => l.map((e) => ({ id: e.getAttribute('data-ebay-annonce'), c: e.getAttribute('data-ebay-compte'), nom: (e.querySelector('[data-ebay-carte-compte]') || {}).textContent || '' })));
const deborde = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: require('../_chromium.cjs').executablePath(), args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      console.log(`── ${vp.width} px · trois comptes eBay`);
      remettre(false);
      const { ctx, pg, errs } = await ouvrir(b, vp);
      await essaie('Tous les comptes : ventes', async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=plat_ebay`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('#vrm-sel-compte-ebay', { timeout: 15000 });
        await pg.waitForSelector('[data-ebay-vente]', { timeout: 10000 }).catch(() => {});
        await pg.waitForTimeout(700);
        const opts = await pg.$$eval('#vrm-sel-compte-ebay option', (l) => l.map((o) => [o.value, o.textContent]));
        dit(opts.length === 4 && opts[0][0] === '*' && opts.some(([v, t]) => v === 'principal' && t === 'paire_perso') && opts.some(([v, t]) => v === K2 && t === 'paire_pro') && opts.some(([v, t]) => v === K3 && t === 'paire_trois'),
          'le sélecteur propose « Tous les comptes » + une entrée par compte eBay, nommée par son pseudo', JSON.stringify(opts));
        const v = await ventes(pg); const r = await resume(pg);
        dit(v.length === 3 && new Set(v.map((x) => x.c)).size === 3 && v.some((x) => x.id === '22-0002' && x.c === K2 && /paire_pro/.test(x.t)),
          '« Tous » : les ventes des trois comptes, chacune marquée de SON compte (le pseudo est sur la ligne : la liste en mélange plusieurs)', JSON.stringify(v.map((x) => [x.id, x.c])));
        // ⚠️ l'étiquette est en `textTransform: uppercase` : innerText rend
        // « 3 COMPTES » — on lit sans la casse (le piège de « POINT RELAIS »).
        dit(/623,00\s*€/.test(r) && /3 comptes/i.test(r), 'le résumé « Tous » dit le total ET sur combien de comptes il porte (80 + 210 + 333 = 623 €, 3 comptes)', r.replace(/\s+/g, ' '));
      });
      await essaie('compte 2 : ventes', async () => {
        await choisirVue(pg, K2);
        const v = await ventes(pg); const r = await resume(pg);
        const vue = await pg.$eval('[data-ebay-vue]', (e) => e.getAttribute('data-ebay-vue')).catch(() => '');
        const txt = await pg.evaluate(() => document.body.innerText);
        dit(vue === K2 && v.length === 1 && v[0].id === '22-0002', '« compte 2 » : SA vente et elle seule', JSON.stringify(v.map((x) => x.id)));
        dit(/210,00\s*€/.test(r) && !/623/.test(r) && /paire_pro/i.test(r), 'le résumé ne porte que sur ce compte (210 €), nommé', r.replace(/\s+/g, ' '));
        dit(!/333,00/.test(txt) && !/80,00\s*€/.test(txt) && !/11-0001|33-0003/.test(txt), 'aucun montant des comptes 1 et 3 ne se glisse à l\'écran (ni 80 €, ni 333 €)');
        const memo = await pg.evaluate(() => localStorage.getItem('vrm_ebay_vue'));
        dit(/bbbbbbbbbbbbbbb2/.test(String(memo)), 'le choix est mémorisé (réglage synchronisé `vrm_ebay_vue`)', String(memo));
      });
      await essaie('compte 2 : annonces', async () => {
        await sousOnglet(pg, 'Annonces');
        await pg.waitForSelector('[data-ebay-annonce]', { timeout: 10000 });
        await pg.waitForTimeout(800);
        const a = await annonces(pg);
        dit(a.length === 2 && a.every((x) => x.c === K2) && a.some((x) => x.id === '120000000040') && !a.some((x) => ['120000000030', '120000000031', '120000000050'].includes(x.id)),
          '« compte 2 » : SES annonces seulement — aucune de celles des comptes 1 et 3', JSON.stringify(a.map((x) => x.id)));
        const deux = await pg.$$eval('[data-ebay-deux-comptes-annonce]', (l) => l.map((e) => e.getAttribute('data-ebay-deux-comptes-annonce')).sort());
        dit(deux.length === 2 && deux.includes('principal') && deux.includes(K2), 'la N°31, en vente sur le compte 1 ET le compte 2, est signalée — les deux annonces sont nommées', JSON.stringify(deux));
        const br = await pg.$$eval('[data-brouillon]', (l) => l.map((e) => e.getAttribute('data-brouillon')));
        dit(!br.includes('b-60'), 'le brouillon rattaché au compte 3 ne se montre pas dans la vue du compte 2', JSON.stringify(br));
      });
      await essaie('publier sur le compte 2', async () => {
        await pg.click('[data-poster="ebay"]');
        await pg.waitForSelector('[data-ebay-publier-compte]', { timeout: 8000 });
        const pre = await pg.$eval('[data-ebay-publier-compte]', (e) => e.getAttribute('data-ebay-publier-compte'));
        dit(pre === K2, 'le compte de la publication est pré-choisi sur la vue (compte 2)', pre);
        // N°30 : en vente sur le COMPTE 1. La vue est sur le compte 2 : elle
        // reste bloquée (la garde regarde TOUS les comptes).
        await pg.locator('button', { hasText: 'N°30' }).first().click({ timeout: 8000 });
        await pg.getByRole('button', { name: 'Trouver la catégorie eBay' }).click({ timeout: 5000 });
        await pg.waitForSelector('text=Catégorie eBay', { timeout: 8000 });
        await pg.fill('input[placeholder="ex. 74"]', '125');
        await pg.waitForFunction(() => !document.querySelector('[data-publier-garde="en-cours"]'), null, { timeout: 10000 }).catch(() => {});
        const g = await pg.$eval('[data-publier-garde]', (e) => e.getAttribute('data-publier-garde')).catch(() => null);
        const dis = await pg.$eval('button:has-text("Publier sur eBay")', (e) => e.disabled).catch(() => null);
        await pg.locator('button:has-text("Publier sur eBay")').click({ force: true, timeout: 3000 }).catch(() => {});
        await pg.waitForTimeout(500);
        dit(g === 'deja-en-ligne' && dis === true && envois.filter((x) => x.action === 'publish').length === 0,
          'la N°30, en vente sur le compte 1, reste BLOQUÉE à la publication sur le compte 2 — même vue réglée sur « compte 2 » : rien n\'est envoyé', `${g} · grisé=${dis}`);
      });
      await essaie('publier une paire libre', async () => {
        await sousOnglet(pg, 'Ventes'); await sousOnglet(pg, 'Annonces');
        await pg.waitForSelector('[data-poster="ebay"]', { timeout: 8000 });
        await pg.click('[data-poster="ebay"]');
        await pg.locator('button', { hasText: 'N°60' }).first().click({ timeout: 8000 });
        await pg.getByRole('button', { name: 'Trouver la catégorie eBay' }).click({ timeout: 5000 });
        await pg.waitForSelector('text=Catégorie eBay', { timeout: 8000 });
        await pg.fill('input[placeholder="ex. 74"]', '92');
        await pg.waitForFunction(() => !document.querySelector('[data-publier-garde="en-cours"]'), null, { timeout: 10000 }).catch(() => {});
        await pg.locator('button:has-text("Publier sur eBay")').click({ timeout: 5000 });
        await feuille(pg).getByRole('button', { name: 'Oui, publier' }).waitFor({ timeout: 5000 });
        const titre = await feuille(pg).innerText();
        await feuille(pg).getByRole('button', { name: 'Annuler' }).click();
        await pg.waitForTimeout(300);
        dit(/paire_pro/.test(titre) && envois.filter((x) => x.action === 'publish').length === 0, 'la confirmation NOMME le compte (« paire_pro ») ; Annuler n\'envoie rien', titre.split('\n')[0]);
        await pg.locator('button:has-text("Publier sur eBay")').click({ timeout: 5000 });
        await feuille(pg).getByRole('button', { name: 'Oui, publier' }).click({ timeout: 5000 });
        await pg.waitForTimeout(900);
        const p = envois.filter((x) => x.action === 'publish');
        dit(p.length === 1 && p[0].compte === K2 && String(p[0].item && p[0].item.numero) === '60', 'Oui ⇒ UN envoi, sur le compte 2 (`compte` = sa clé), pour la N°60', JSON.stringify(p.map((x) => [x.compte, x.item && x.item.numero])));
      });
      await essaie('compte 3 : ce qui est ailleurs est compté', async () => {
        await choisirVue(pg, K3);
        await sousOnglet(pg, 'Ventes'); await sousOnglet(pg, 'Annonces');
        await pg.waitForSelector('[data-ebay-annonce]', { timeout: 10000 });
        await pg.waitForTimeout(600);
        const a = await annonces(pg);
        const ailleurs = await pg.$eval('[data-ebay-alertes-ailleurs]', (e) => e.getAttribute('data-ebay-alertes-ailleurs')).catch(() => null);
        const br = await pg.$$eval('[data-brouillon]', (l) => l.map((e) => e.getAttribute('data-brouillon')));
        dit(a.length === 1 && a[0].id === '120000000050', '« compte 3 » : sa seule annonce', JSON.stringify(a.map((x) => x.id)));
        dit(ailleurs === '1' && (await pg.$$('[data-ebay-deux-comptes]')).length === 0, 'la double vente des comptes 1 et 2 n\'est pas montrée ici — elle est COMPTÉE (« 1 paire à régler sur tes autres comptes »)', String(ailleurs));
        dit(br.includes('b-60'), 'le brouillon rattaché au compte 3 est là', JSON.stringify(br));
      });
      await essaie('Tous : annonces', async () => {
        await choisirVue(pg, '*');
        await sousOnglet(pg, 'Ventes'); await sousOnglet(pg, 'Annonces');
        await pg.waitForSelector('[data-ebay-annonce]', { timeout: 10000 });
        await pg.waitForTimeout(600);
        const a = await annonces(pg);
        dit(a.length === 5 && new Set(a.map((x) => x.c)).size === 3 && a.every((x) => /paire_/.test(x.nom)), '« Tous » : les 5 annonces des 3 comptes, chaque carte nomme son compte', JSON.stringify(a.map((x) => [x.id, x.c])));
        dit(await deborde(pg) <= 1, 'aucun débordement horizontal', String(await deborde(pg)));
        await pg.screenshot({ path: path.join(os.tmpdir(), 'ebay-comptes-' + vp.width + '.png'), fullPage: true });
      });
      await essaie('déconnecter le compte 3', async () => {
        await choisirVue(pg, K3);
        await sousOnglet(pg, 'Compte eBay');
        await pg.waitForSelector('[data-ebay-comptes]', { timeout: 10000 });
        const n = await pg.$eval('[data-ebay-comptes]', (e) => e.getAttribute('data-ebay-comptes'));
        dit(n === '3' && (await pg.$$('[data-ebay-connecter-autre]')).length === 1, '« Compte eBay » liste ses 3 comptes, et propose « Connecter un autre compte eBay »', n);
        await pg.click(`[data-ebay-deconnecter="${K3}"]`);
        await feuille(pg).getByRole('button', { name: 'Oui, déconnecter' }).waitFor({ timeout: 5000 });
        const t = await feuille(pg).innerText();
        await feuille(pg).getByRole('button', { name: 'Annuler' }).click();
        await pg.waitForTimeout(300);
        dit(/paire_trois/.test(t) && /autres comptes eBay ne sont pas touchés/.test(t) && envois.filter((x) => x.action === 'deconnecter').length === 0, 'la confirmation nomme le compte et dit que les autres ne sont pas touchés ; Annuler n\'envoie rien', t.split('\n')[0]);
        await pg.click(`[data-ebay-deconnecter="${K3}"]`);
        await feuille(pg).getByRole('button', { name: 'Oui, déconnecter' }).click({ timeout: 5000 });
        await pg.waitForTimeout(1500);
        const d = envois.filter((x) => x.action === 'deconnecter');
        dit(d.length === 1 && d[0].compte === K3 && d[0].confirme === true, 'Oui ⇒ UN envoi, pour le compte 3 seulement, confirmé', JSON.stringify(d));
        const vue = await pg.$eval('[data-ebay-vue]', (e) => e.getAttribute('data-ebay-vue')).catch(() => '');
        const opts = await pg.$$eval('#vrm-sel-compte-ebay option', (l) => l.map((o) => o.value));
        dit(vue === '*' && opts.length === 3 && !opts.includes(K3), 'la vue réglée sur le compte déconnecté retombe sur « Tous » ; il sort du sélecteur', `${vue} · ${JSON.stringify(opts)}`);
      });
      dit(errs.length === 0, 'aucune erreur de page', errs.join(' | ').slice(0, 200));
      await ctx.close();
    }
    // ── UN SEUL COMPTE : rien ne change pour lui ─────────────────────────────
    console.log('── 1512 px · un seul compte eBay');
    remettre(true);
    {
      const { ctx, pg, errs } = await ouvrir(b, { width: 1512, height: 950 });
      await essaie('un seul compte', async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=plat_ebay`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('[data-ebay-vente]', { timeout: 15000 });
        await pg.waitForTimeout(800);
        const sel = (await pg.$$('#vrm-sel-compte-ebay')).length;
        const r = await resume(pg);
        dit(sel === 0, 'un seul compte eBay ⇒ AUCUN sélecteur', String(sel));
        dit(/80,00\s*€/.test(r) && !/comptes?\b|paire_/i.test(r), 'le résumé est celui d\'avant (80 €, sans « N comptes »)', r.replace(/\s+/g, ' '));
        await sousOnglet(pg, 'Annonces');
        await pg.waitForSelector('[data-ebay-annonce]', { timeout: 10000 });
        const a = await annonces(pg);
        dit(a.length === 2 && a.every((x) => !x.nom), 'ses annonces, sans nom de compte sur les cartes (§7 : rien à distinguer)', JSON.stringify(a.map((x) => [x.id, x.nom])));
        await pg.click('[data-poster="ebay"]');
        await pg.waitForTimeout(500);
        dit((await pg.$$('[data-ebay-publier-compte]')).length === 0, 'et pas de choix de compte à la publication');
      });
      dit(errs.length === 0, 'aucune erreur de page', errs.join(' | ').slice(0, 200));
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ eBay, plusieurs comptes : ${ko} rouge(s)` : '\n✅ eBay, plusieurs comptes : chaque compte ses données, « Tous » l\'union nommée, la garde regarde tous les comptes quelle que soit la vue');
  process.exit(ko ? 1 : 0);
})();
