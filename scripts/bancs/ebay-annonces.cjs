// Banc : eBay → ANNONCES « de ouf » (5 octobre) — l'écran RENDU, sur des
// données INVENTÉES (il vit dans le dépôt, qui est public : aucune fixture).
//
// Julien : « pour eBay je ne sais pas pourquoi le site est si peu développé, tu
// as accès à mon compte et tu ne fais rien de ouf ». Mesuré le jour même : ses
// 2 annonces eBay n'étaient reliées à AUCUNE paire. Ce banc rend l'écran à 390
// et 1512 px et exige, en jugeant les `data-*` posés par l'écran (§6.5 — le
// texte reste libre) et ce qui PART vers `/api/ebay` :
//   · une annonce reliée par son SKU affiche son N° ; une annonce sans SKU dit
//     « pas reliée » et propose « Relier à une paire » — et une annonce dont le
//     titre est identique à une paire n'est JAMAIS reliée toute seule (§5) ;
//   · VENDUE SUR VINTED (preuve : transaction + état de commande) et encore en
//     vente sur eBay ⇒ l'alerte et « Retirer d'eBay », derrière une
//     confirmation qui dit « sans retour » ; Annuler n'envoie RIEN, Oui envoie
//     `{action:'retirer', itemId, confirme:true}` — et une conversation (état
//     vide) ou une vente annulée ne déclenchent rien ;
//   · VENDUE SUR eBAY et encore en vente sur Vinted ⇒ l'alerte avec le LIEN
//     vers l'annonce Vinted ; une commande annulée, ou sans SKU mais au titre
//     identique, ne déclenche rien ;
//   · l'offre aux observateurs : le bouton n'existe QUE sur l'annonce qu'eBay
//     déclare éligible ; « pas d'observateur » est dit UNE fois ; la remise
//     donne le prix résultant ; Annuler n'envoie rien ; Oui envoie exactement
//     `{action:'offre', listingId, remise, confirme:true}` ; une remise hors
//     5–50 n'envoie rien ;
//   · relier : un N° inconnu ou déjà porté par une autre annonce eBay est
//     refusé sans rien envoyer ; un N° choisi, confirmé, envoie `{action:'sku'}`
//     et la carte affiche le N° ; la paire à la MÊME photo est proposée en tête ;
//   · le tableau de bord dit les deux mêmes alertes (même règle, §11) ;
//   · « pas su » : ventes Vinted, ventes eBay et éligibilité illisibles ⇒ UNE
//     ligne qui le dit, AUCUNE alerte, AUCUN bouton d'offre, aucun « pas
//     d'observateur » inventé ;
//   · aucun débordement horizontal, aucune erreur de page.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = 4711;

const auj = new Date();
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];
const annonce = (id, titre, prix, ferme) => ({ id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, brand_title: titre.split(' ')[0], size_title: (/taille (\d+)/.exec(titre) || [])[1] || '', is_closed: !!ferme, is_hidden: false, is_draft: false, photo: { url: 'https://img.test/v' + id + '.jpg' } });
const LISTINGS = { capturedAt: auj.toISOString(), payload: { items: [
  annonce(7001, 'Nike Dunk Low panda taille 42', 95),
  annonce(7002, 'Adidas Gazelle bleu taille 40', 80, true),     // vendue sur Vinted (fermée)
  annonce(7003, 'Salomon XT-6 noir taille 41', 120),
  annonce(7004, 'New Balance 550 blanc taille 43', 90),
  annonce(7005, 'Asics Gel 1130 argent taille 39', 70),
] } };
const fiche = (numero, title, id) => ({ numero, title, photo: 'https://img.test/v' + id + '.jpg' });
const MAIN = { vinted_annonce_numeros: {
  '7001': fiche('21', 'Nike Dunk Low panda taille 42', 7001),
  '7002': fiche('22', 'Adidas Gazelle bleu taille 40', 7002),
  '7003': fiche('23', 'Salomon XT-6 noir taille 41', 7003),
  '7004': fiche('24', 'New Balance 550 blanc taille 43', 7004),
  '7005': fiche('25', 'Asics Gel 1130 argent taille 39', 7005),
} };
const txn = (tx, item, statut, titre) => ({ id: `harvest_111_txn_${tx}`, data: { payload: { transaction: { id: tx, item_id: item, status: statut, status_title: titre } } } });
const TXN = [
  txn(9001, 7002, 450, 'Commande finalisée'),   // N°22 : VENDUE, prouvé
  txn(9002, 7005, 1, ''),                       // N°25 : une conversation, pas une vente
  txn(9003, 7003, 300, 'Commande annulée'),     // N°23 : la paire est revenue
];
const EBAY_ANNONCES = () => [
  { itemId: '110000000001', title: 'Adidas Gazelle bleu taille 40', price: '80.0', sku: 'VRM-22', observateurs: 1, photo: 'https://img.test/e1.jpg', url: 'https://www.ebay.fr/itm/110000000001' },
  // Pas de SKU, et SA photo est exactement celle de la paire N°21 (une identité).
  { itemId: '110000000002', title: 'Nike Dunk Low panda taille 42', price: '100.0', sku: '', observateurs: 3, photo: 'https://img.test/v7001.jpg', url: 'https://www.ebay.fr/itm/110000000002' },
  { itemId: '110000000003', title: 'Salomon XT-6 noir taille 41', price: '120.0', sku: 'VRM-23', observateurs: null, photo: 'https://img.test/e3.jpg' },
  { itemId: '110000000005', title: 'Asics Gel 1130 argent taille 39', price: '75.0', sku: 'VRM-25', observateurs: 0, photo: 'https://img.test/e5.jpg' },
];
const EBAY_COMMANDES = [
  { orderId: '01-001', orderPaymentStatus: 'PAID', orderFulfillmentStatus: 'NOT_STARTED', lineItems: [{ sku: 'VRM-24', title: 'New Balance 550 blanc taille 43', legacyItemId: '110000000004' }], pricingSummary: { total: { value: '90.00', currency: 'EUR' } } },
  { orderId: '01-002', orderPaymentStatus: 'PAID', cancelStatus: { cancelState: 'CANCELED' }, lineItems: [{ sku: 'VRM-21', title: 'Nike Dunk Low panda taille 42' }], pricingSummary: { total: { value: '95.00', currency: 'EUR' } } },
  // Sans SKU, au titre IDENTIQUE à la paire N°23 encore en ligne : ne désigne rien.
  { orderId: '01-003', orderPaymentStatus: 'PAID', lineItems: [{ sku: '', title: 'Salomon XT-6 noir taille 41' }], pricingSummary: { total: { value: '120.00', currency: 'EUR' } } },
];
let rows = [];
const remettre = () => {
  rows = [
    { id: 'main', data: JSON.parse(JSON.stringify(MAIN)) },
    { id: 'harvest_111_listings', data: LISTINGS },
    ...TXN,
    { id: 'ebay_listings', data: { items: EBAY_ANNONCES(), capturedAt: Date.now() } },
    { id: 'ebay_orders', data: { orders: EBAY_COMMANDES, capturedAt: Date.now() } },
  ];
};

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
// Un banc ne meurt pas, il rapporte : ce qui lève devient un contrôle ROUGE.
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { dit(false, quoi, 'a levé : ' + String((e && e.message) || e).split('\n')[0].slice(0, 140)); return null; } };
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
    out[alias] = v == null ? null : v;
  }
  return out;
};

async function ouvrir(b, vp, panne) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const envois = [];
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d, st) => route.fulfill({ status: st || 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') {
      try { for (const l of [].concat(JSON.parse(route.request().postData() || 'null') || [])) if (l && l.id === 'main' && l.data) rows[0].data = l.data; } catch (_) {}
      return j([]);
    }
    if (/select=owner/.test(u)) return j({ m: 1 }, 400);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    // « Pas su » : les ventes Vinted (preuve) et les commandes eBay ne répondent pas.
    if (panne && (/_txn_/.test(u) || /ebay_orders/.test(u))) return j({ message: 'timeout' }, 500);
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
    if (['offre', 'retirer', 'sku', 'publish'].includes(body.action)) envois.push(body);
    if (body.action === 'status') return j({ ok: true, connected: true });
    if (body.action === 'offreinfo') return panne ? j({ ok: false, error: 'eBay injoignable' }, 503) : j({ ok: true, eligibles: ['110000000002'], complet: true });
    if (body.action === 'offre') return j({ ok: true, remise: body.remise, envoyees: 3 });
    if (body.action === 'retirer') {
      // Ce que ferait la synchro suivante : l'annonce terminée sort de la liste.
      const L = rows.find((r) => r.id === 'ebay_listings'); L.data.items = L.data.items.filter((a) => a.itemId !== body.itemId);
      return j({ ok: true });
    }
    if (body.action === 'sku') {
      const L = rows.find((r) => r.id === 'ebay_listings'); const a = L.data.items.find((x) => x.itemId === body.itemId);
      if (a) a.sku = 'VRM-' + body.numero;
      return j({ ok: true, sku: 'VRM-' + body.numero });
    }
    if (body.action === 'finances') return j({ ok: false, reason: 'scope', error: 'x' });
    return j({ ok: true });
  });
  return { ctx, pg, errs, envois };
}
async function versAnnoncesEbay(pg) {
  await pg.goto(`http://localhost:${PORT}/?tab=plat_ebay`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(1500);
  await pg.getByRole('button', { name: 'Annonces', exact: true }).first().click({ timeout: 8000 });
  await pg.waitForSelector('[data-ebay-annonce]', { timeout: 15000 }).catch(() => {});
  await pg.waitForSelector('[data-ebay-retirer-vinted]', { timeout: 6000 }).catch(() => {});
  await pg.waitForTimeout(1200);
}
const feuille = (pg) => pg.locator('div[style*="z-index: 2000"]');
const lire = (pg) => pg.evaluate(() => {
  const a = (sel, at) => [...document.querySelectorAll(sel)].map((e) => e.getAttribute(at));
  const relie = {}; for (const e of document.querySelectorAll('[data-ebay-annonce]')) { const r = e.querySelector('[data-relie]'); relie[e.getAttribute('data-ebay-annonce')] = r ? r.getAttribute('data-relie') : null; }
  const txt = document.body.innerText;
  return {
    relie,
    doublons: a('[data-ebay-doublon]', 'data-ebay-doublon'),
    retirer: a('[data-retirer-ebay]', 'data-retirer-ebay'),
    vendues: [...document.querySelectorAll('[data-ebay-vendue]')].map((e) => ({ num: e.getAttribute('data-ebay-vendue'), href: (e.querySelector('a[href*="vinted.fr/items/"]') || {}).href || '' })),
    offres: [...document.querySelectorAll('[data-offre-ouvrir]')].map((e) => ({ id: e.getAttribute('data-offre-ouvrir'), t: e.textContent })),
    relierBtn: a('[data-relier-ouvrir]', 'data-relier-ouvrir'),
    sansObs: document.querySelectorAll('[data-ebay-sans-observateur]').length,
    sansObsTxt: (txt.match(/pas d.observateur à qui l.envoyer/g) || []).length,
    pasSu: [...document.querySelectorAll('[data-ebay-pas-su]')].map((e) => e.textContent),
    pasReliee: (txt.match(/pas reliée/g) || []).length,
  };
});
const deborde = (pg) => pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      console.log(`── ${vp.width} px`);
      remettre();
      const { ctx, pg, errs, envois } = await ouvrir(b, vp, false);
      // ── Le tableau de bord d'abord : la MÊME règle, la même conclusion (§11).
      await essaie('tableau de bord', async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=dashboard`, { waitUntil: 'domcontentloaded' });
        await pg.waitForFunction(() => /vendues? sur eBay, encore en vente sur Vinted/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
        const t = await pg.evaluate(() => document.body.innerText);
        const a = /(\d+) paires? vendues? sur Vinted, encore en vente sur eBay/.exec(t);
        const v = /(\d+) paires? vendues? sur eBay, encore en vente sur Vinted/.exec(t);
        dit(a && a[1] === '1', 'le tableau de bord annonce 1 paire vendue sur Vinted à retirer d\'eBay', a ? a[0] : 'absent');
        dit(v && v[1] === '1', 'et 1 paire vendue sur eBay à retirer de Vinted', v ? v[0] : 'absent');
      });
      await essaie('écran Annonces eBay', async () => {
        await versAnnoncesEbay(pg);
        const v = await lire(pg);
        await pg.screenshot({ path: path.join(os.tmpdir(), 'ebay-annonces-' + vp.width + '.png'), fullPage: true });
        dit(v.relie['110000000001'] === '22' && v.relie['110000000003'] === '23' && v.relie['110000000005'] === '25',
          'une annonce eBay reliée par son SKU affiche le N° de sa paire', JSON.stringify(v.relie));
        dit(v.relie['110000000002'] === '' && v.relierBtn.includes('110000000002') && v.relierBtn.length === 1,
          "l'annonce sans SKU dit « pas reliée » et propose « Relier à une paire » — même au titre identique à une paire en ligne", JSON.stringify(v.relierBtn));
        dit(JSON.stringify(v.doublons) === '["22"]' && JSON.stringify(v.retirer) === '["110000000001"]',
          'vendue sur Vinted (prouvé) ⇒ « Retirer d\'eBay » pour la N°22, et elle seule (pas la conversation N°25, pas la vente annulée N°23)', JSON.stringify(v.doublons));
        dit(v.vendues.length === 1 && v.vendues[0].num === '24' && /vinted\.fr\/items\/7004$/.test(v.vendues[0].href),
          'vendue sur eBay ⇒ l\'alerte pour la N°24 mène à SON annonce Vinted (pas la commande annulée N°21, pas la commande sans SKU au titre identique)', JSON.stringify(v.vendues));
        dit(v.offres.length === 1 && v.offres[0].id === '110000000002' && /3 observateurs/.test(v.offres[0].t),
          'le bouton d\'offre n\'existe QUE sur l\'annonce qu\'eBay déclare éligible, avec son nombre d\'observateurs', JSON.stringify(v.offres));
        dit(v.sansObs === 1 && v.sansObsTxt === 1, '« pas d\'observateur à qui l\'envoyer » est dit UNE fois, pas sur chaque carte', `bloc ×${v.sansObs} · phrase ×${v.sansObsTxt}`);
        dit(v.pasSu.length === 0, 'en marche normale, aucune ligne « je n\'ai pas pu lire »');
      });
      // ── L'OFFRE AUX OBSERVATEURS ────────────────────────────────────────
      await essaie('offre', async () => {
        await pg.click('[data-offre-ouvrir="110000000002"]');
        await pg.waitForSelector('[data-offre-panneau="110000000002"]', { timeout: 5000 });
        await pg.fill('[data-offre-remise="110000000002"]', '60');
        const desactive = await pg.$eval('[data-offre-envoyer="110000000002"]', (e) => e.disabled);
        dit(desactive, 'une remise de 60 % (hors 5–50) ne peut pas partir');
        await pg.fill('[data-offre-remise="110000000002"]', '15');
        await pg.locator('[data-ebay-annonce="110000000002"]').screenshot({ path: path.join(os.tmpdir(), 'ebay-annonces-offre-' + vp.width + '.png') }).catch(() => {});
        const prix = await pg.$eval('[data-offre-prix]', (e) => e.getAttribute('data-offre-prix'));
        dit(prix === '85.00', 'la remise de 15 % donne le prix résultant (100 € → 85,00 €)', prix);
        await pg.click('[data-offre-envoyer="110000000002"]');
        await feuille(pg).getByRole('button', { name: 'Oui, envoyer' }).waitFor({ timeout: 5000 });
        await feuille(pg).getByRole('button', { name: 'Annuler' }).click();
        await pg.waitForTimeout(400);
        dit(!envois.some((e) => e.action === 'offre'), 'Annuler la confirmation n\'envoie RIEN');
        await pg.click('[data-offre-envoyer="110000000002"]');
        await feuille(pg).getByRole('button', { name: 'Oui, envoyer' }).click({ timeout: 5000 });
        await pg.waitForSelector('[data-ebay-info="110000000002"]', { timeout: 5000 });
        const e = envois.filter((x) => x.action === 'offre');
        const attendu = { action: 'offre', listingId: '110000000002', remise: 15, confirme: true };
        dit(e.length === 1 && JSON.stringify(e[0]) === JSON.stringify(attendu), 'Oui envoie exactement {action:offre, listingId, remise:15, confirme:true}', JSON.stringify(e));
        const info = await pg.$eval('[data-ebay-info="110000000002"]', (x) => x.textContent);
        dit(/envoyée à 3/.test(info), 'la carte dit à combien de personnes l\'offre est partie', info);
      });
      // ── RETIRER D'eBAY la paire vendue sur Vinted ───────────────────────
      await essaie('retirer', async () => {
        await pg.click('[data-retirer-ebay="110000000001"]');
        await feuille(pg).getByRole('button', { name: "Oui, retirer d'eBay" }).waitFor({ timeout: 5000 });
        const texte = await feuille(pg).innerText();
        dit(/sans retour/.test(texte) && /N°22/.test(texte), 'la confirmation nomme la paire et dit que c\'est sans retour côté eBay', texte.replace(/\s+/g, ' ').slice(0, 120));
        await feuille(pg).getByRole('button', { name: 'Annuler' }).click();
        await pg.waitForTimeout(400);
        dit(!envois.some((x) => x.action === 'retirer'), 'Annuler n\'envoie RIEN à eBay');
        await pg.click('[data-retirer-ebay="110000000001"]');
        await feuille(pg).getByRole('button', { name: "Oui, retirer d'eBay" }).click({ timeout: 5000 });
        await pg.waitForFunction(() => !document.querySelector('[data-retirer-ebay="110000000001"]'), null, { timeout: 8000 }).catch(() => {});
        const r = envois.filter((x) => x.action === 'retirer');
        dit(r.length === 1 && JSON.stringify(r[0]) === JSON.stringify({ action: 'retirer', itemId: '110000000001', confirme: true }),
          'Oui envoie exactement {action:retirer, itemId, confirme:true}', JSON.stringify(r));
        const reste = await pg.$$('[data-ebay-doublon]');
        dit(reste.length === 0, 'une fois retirée, l\'alerte disparaît');
      });
      // ── RELIER À UNE PAIRE ──────────────────────────────────────────────
      await essaie('relier', async () => {
        await pg.click('[data-relier-ouvrir="110000000002"]');
        await pg.waitForSelector('[data-relier-panneau="110000000002"]', { timeout: 5000 });
        await pg.locator('[data-ebay-annonce="110000000002"]').screenshot({ path: path.join(os.tmpdir(), 'ebay-annonces-relier-' + vp.width + '.png') }).catch(() => {});
        const premiere = await pg.$eval('[data-relier-panneau="110000000002"] [data-relier-paire]', (e) => ({ n: e.getAttribute('data-relier-paire'), t: e.textContent }));
        dit(premiere.n === '21' && /même photo/.test(premiere.t), 'la paire à la MÊME photo est proposée en tête (une identité, pas un titre)', JSON.stringify(premiere));
        const proposees = await pg.$$eval('[data-relier-panneau="110000000002"] [data-relier-paire]', (els) => els.map((e) => e.getAttribute('data-relier-paire')));
        dit(!proposees.includes('23') && !proposees.includes('25') && proposees.includes('24'),
          'une paire déjà reliée à une AUTRE annonce eBay n\'est pas proposée (une paire, une annonce)', JSON.stringify(proposees));
        await pg.fill('[data-relier-num="110000000002"]', '999');
        await pg.click('[data-relier-valider="110000000002"]');
        await pg.waitForTimeout(300);
        let info = await pg.$eval('[data-ebay-info="110000000002"]', (x) => x.textContent).catch(() => '');
        dit(/Aucune paire/.test(info) && !envois.some((x) => x.action === 'sku'), 'un N° que VRM ne connaît pas est refusé, rien n\'est envoyé', info);
        await pg.fill('[data-relier-num="110000000002"]', '23');
        await pg.click('[data-relier-valider="110000000002"]');
        await pg.waitForTimeout(300);
        info = await pg.$eval('[data-ebay-info="110000000002"]', (x) => x.textContent).catch(() => '');
        dit(/déjà reliée/.test(info) && !envois.some((x) => x.action === 'sku'), 'un N° déjà porté par une autre annonce eBay est refusé (une paire, une annonce)', info);
        await pg.fill('[data-relier-num="110000000002"]', '21');
        await pg.click('[data-relier-valider="110000000002"]');
        await feuille(pg).getByRole('button', { name: 'Oui, relier' }).click({ timeout: 5000 });
        await pg.waitForFunction(() => { const e = document.querySelector('[data-ebay-annonce="110000000002"] [data-relie]'); return e && e.getAttribute('data-relie') === '21'; }, null, { timeout: 8000 }).catch(() => {});
        const s = envois.filter((x) => x.action === 'sku');
        dit(s.length === 1 && JSON.stringify(s[0]) === JSON.stringify({ action: 'sku', itemId: '110000000002', numero: '21' }), 'son clic confirmé envoie {action:sku, itemId, numero:"21"}', JSON.stringify(s));
        const relie = await pg.$eval('[data-ebay-annonce="110000000002"] [data-relie]', (e) => e.getAttribute('data-relie')).catch(() => null);
        dit(relie === '21', 'la carte affiche désormais la N°21', String(relie));
        // Un lien posé se CHANGE (la confirmation le promet) : depuis le détail.
        await pg.click('[data-ebay-annonce="110000000003"] [role="button"]');
        await pg.click('[data-relier-changer="110000000003"]', { timeout: 5000 });
        const panneau = await pg.$('[data-relier-panneau="110000000003"]');
        dit(!!panneau && !envois.some((x) => x.action === 'sku' && x.itemId === '110000000003'),
          'une annonce déjà reliée peut changer de paire (depuis son détail), sans rien envoyer avant son choix');
      });
      await essaie('mise en page', async () => {
        const r = await deborde(pg);
        dit(r.sw <= r.cw + 1, 'aucun débordement horizontal', `${r.sw} > ${r.cw}`);
        dit(errs.length === 0, 'aucune erreur de page', errs.join(' | ').slice(0, 160));
      });
      await ctx.close();
    }
    // ── « PAS SU » : rien n'est inventé, et c'est dit UNE fois ─────────────
    console.log('── pas su (390 px)');
    remettre();
    const { ctx, pg, errs } = await ouvrir(b, { width: 390, height: 844 }, true);
    await essaie('pas su', async () => {
      await versAnnoncesEbay(pg);
      await pg.waitForSelector('[data-ebay-pas-su]', { timeout: 8000 }).catch(() => {});
      const v = await lire(pg);
      dit(v.pasSu.length === 1 && /ventes Vinted/.test(v.pasSu[0]) && /ventes eBay/.test(v.pasSu[0]),
        'ventes Vinted et ventes eBay illisibles ⇒ UNE ligne qui le dit, avec ce que ça empêche', JSON.stringify(v.pasSu).slice(0, 220));
      dit(v.doublons.length === 0 && v.retirer.length === 0 && v.vendues.length === 0, 'et AUCUNE alerte, aucun « Retirer d\'eBay » sur une preuve absente');
      dit(v.offres.length === 0 && v.sansObs === 0 && v.sansObsTxt === 0, 'éligibilité illisible ⇒ aucun bouton d\'offre, et pas de « pas d\'observateur » inventé');
      dit(v.relie['110000000002'] === '' && v.relierBtn.includes('110000000002'), 'le lien, lui, reste lisible (il vient du SKU déjà capté)');
      const r = await deborde(pg);
      dit(r.sw <= r.cw + 1 && errs.length === 0, 'aucun débordement, aucune erreur', errs.join(' | ').slice(0, 160));
    });
    await ctx.close();
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ eBay → Annonces : ${ko} rouge(s)` : '\n✅ eBay → Annonces : reliées par identité, double vente dite dans les deux sens, offre et retrait derrière confirmation, « pas su » jamais inventé');
  process.exit(ko ? 1 : 0);
})();
