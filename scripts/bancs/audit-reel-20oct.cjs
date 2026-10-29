require('./_porte-banc.cjs');
// ═══ AUDIT SUR SES DONNÉES DU JOUR (20 octobre) — les six défauts, sur des
// données INVENTÉES à la forme réelle (aucune donnée réelle : dépôt public) ═══
// L'audit a rendu l'app sur une copie fraîche de sa base (hors dépôt) et
// comparé chaque chiffre à une requête SQL indépendante. Six écarts, chacun
// reproduit ici sur une base inventée :
//  A. Comptes liés : « lié le » lisait `updated_at` (renouvellement des jetons) —
//     ses comptes de juillet se disaient « liés le » jour même.
//  B. Statistiques : le « Finalisé sur Vinted » excluait les ventes masquées SANS
//     le dire, alors que le CA déclaré les compte (99 ventes, 2 157,80 € chez lui).
//  C. Leboncoin : « 2 vendues sur Vinted — à retirer » pour UNE paire (marquée
//     publiée ET vue sur Leboncoin avec sa référence).
//  D. eBay : une annonce dont AUCUNE fiche ne porte le N° du SKU se disait
//     « N°48 », reliée — sa paire avait été renumérotée.
//  E. eBay → Compte : une route muette (503) affichait « eBay n'est pas encore
//     configuré — ajoute tes clés dans Vercel » (le mauvais geste).
//  F. Ma journée : deux paires sous un même N° n'étaient dites QUE sur Colis.
//  G. Fraîcheur : seul le compte le plus en retard était nommé (jujuf38, 6 j) —
//     julatace35260 (3 j) ne l'était pas, sur aucun écran.
// Port : BANC_PORT (défaut 4917). Les deux sens sont vérifiés.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const fs = require('fs'), http = require('http'), path = require('path');
const { servir } = require('./_minipgrest.cjs');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4917;
const OWNER = '00000000-0000-0000-0000-0000000000aa';
process.env.BANC_SESSION_UID = OWNER; // la session de banc (_porte-banc.cjs) est celle de ce vendeur
const UID = '111';
const now = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const J = 86400000;

function base({ conflit = true, ebayRoute = 503, retard = [] } = {}) {
  const numeros = {
    '5003': { numero: conflit ? '7' : '8', title: 'adidas spezial bordeaux taille 36,5', accountId: UID, numberedAt: '2026-09-01T10:00:00.000Z', auto: true },
    '5004': { numero: '7', title: 'nike air max 1 olive taille 42,5', accountId: UID, numberedAt: '2026-10-18T08:26:45.251Z', auto: true },
    '5005': { numero: '18', title: 'nike shox TL noir taille 40', accountId: UID, numberedAt: '2026-09-02T10:00:00.000Z', auto: true },
    '5006': { numero: '53', title: 'Nike Air Max 1 noir jaune taille 42,5', accountId: UID, numberedAt: '2026-10-18T08:26:45.251Z', auto: true },
  };
  const ordre = (tx, item, status, tus, prix, j) => ({ transaction_id: tx, item_id: item, title: 'paire ' + tx, status, transaction_user_status: tus, price: { amount: String(prix), currency_code: 'EUR' }, date: iso(now - j * J), conversation_id: 'c' + tx });
  const sold = [
    ordre(9001, 5001, "Transaction finalisée - L'acheteur a validé la commande", 'completed', 50, 40),
    ordre(9002, 5002, "Transaction finalisée - L'acheteur a validé la commande", 'completed', 30, 41),
    ordre(9003, 5003, 'Bordereau envoyé au vendeur', 'needs_action', 40, 2),
    ordre(9004, 5005, 'Bordereau envoyé au vendeur', 'needs_action', 55, 2),
  ];
  const txn = (tx, item, status, title) => ({ id: `harvest_${UID}_txn_${tx}`, meta: { id: tx, item_id: item, status, status_title: title, status_updated_at: iso(now - 30 * J), capturedAt: iso(now - J) }, data: { payload: { transaction: { id: tx, item_id: item, status, status_title: title } } } });
  const annonce = (id, titre, prix) => ({ id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false, photo: { url: '' }, brand: 'Nike', size: '42' });
  const rows = [
    { id: 'main', data: {
      vinted_annonce_numeros: numeros,
      vinted_used_numeros: [7, 8, 18, 53],
      vinted_sales_hidden: ['9002'],
      vinted_accounts: [{ id: 1, login: 'compte_a', vinted_user_id: UID, domain: 'www.vinted.fr' }],
    } },
    { id: `harvest_${UID}_orders_sold`, data: { uid: UID, type: 'orders_sold', nItems: sold.length, capturedAt: iso(now - 60000), payload: { my_orders: sold, pagination: { total_entries: sold.length } } } },
    { id: `harvest_${UID}_listings`, data: { uid: UID, type: 'listings', nItems: 2, capturedAt: iso(now - 60000), payload: { items: [annonce(5004, 'nike air max 1 olive taille 42,5', 60), annonce(5006, 'Nike Air Max 1 noir jaune taille 42,5', 68)], pagination: { total_entries: 2 } } } },
    txn(9001, 5001, 450, 'Commande finalisée'), txn(9002, 5002, 450, 'Commande finalisée'),
    txn(9003, 5003, 230, 'Le paiement a été validé'), txn(9004, 5005, 230, 'Le paiement a été validé'),
    { id: 'vinted_lbc_posted', data: { ids: ['5005'] } },
    { id: 'lbc_listings', data: { items: { '3290168823': { id: '3290168823', ref: '18', subject: 'Nike shox TL noir taille 40', status: 'active', url: 'https://www.leboncoin.fr/ad/chaussures/3290168823', price: 55 } } } },
    { id: 'ebay_comptes', data: { rev: 1, comptes: [{ cle: 'aaaaaaaaaaaaaaaa', pseudo: 'vendeur_test', principal: true, deconnecteLe: null }] } },
    { id: 'ebay_listings', data: { ack: 'Success', complet: true, status: 200, capturedAt: now - 60000, items: [
      { itemId: '128000000048', sku: 'VRM-48', title: 'Nike Air Max 1 noir jaune taille 42.5', price: '68.0', qty: '1', depuis: '2026-10-15T21:43:46.000Z', url: 'https://www.ebay.fr/itm/128000000048', photo: '' },
    ] } },
    { id: 'ebay_orders', data: { orders: [], complet: true, status: 200, capturedAt: now - 60000 } },
  ];
  const comptes = [{ id: 1, vinted_user_id: UID, login: 'compte_a', domain: 'www.vinted.fr', access_token: 'x', refresh_token: 'x', created_at: '2026-07-05T08:47:35.901801+00:00', updated_at: iso(now - 3600000), owner: OWNER }];
  retard.forEach(([uid, login, jours], i) => {
    comptes.push({ id: 10 + i, vinted_user_id: uid, login, domain: 'www.vinted.fr', access_token: 'x', refresh_token: 'x', created_at: '2026-08-01T00:00:00+00:00', updated_at: iso(now), owner: OWNER });
    rows.push({ id: `harvest_${uid}_orders_sold`, meta: { capturedAt: iso(now - jours * J) }, data: { uid, type: 'orders_sold', nItems: 0, capturedAt: iso(now - jours * J), payload: { my_orders: [], pagination: { total_entries: 0 } } } });
  });
  for (const r of rows) { r.owner = OWNER; r.meta = r.meta || {}; if (/_orders_sold$/.test(r.id) && !r.meta.capturedAt) r.meta.capturedAt = r.data.capturedAt; }
  return { rows, comptes, ebayRoute };
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((q, r) => { let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p)); });
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris — relance le banc seul (' + e.code + ')'); process.exit(1); });
srv.listen(PORT);

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, fn) => { try { await fn(); } catch (e) { dit(false, nom, 'a levé : ' + String(e.message).slice(0, 160)); } };

async function page(b, donnees, W) {
  const mobile = W < 600;
  const ctx = await b.newContext({ viewport: { width: W, height: mobile ? 844 : 950 }, ...(mobile ? { isMobile: true, hasTouch: true } : {}), locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  const pg = await ctx.newPage();
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => { const t = r.request().resourceType(); if (t === 'image' || t === 'media' || t === 'font' || /vinted\.net/.test(r.request().url())) return r.abort(); return r.continue(); });
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request(); const u = decodeURIComponent(req.url());
    const send = (d, h = {}) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', ...h }, body: JSON.stringify(d) });
    if (req.method() !== 'GET' && req.method() !== 'HEAD') return send([]);
    if (/select=owner&limit=1/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"message":"column app_data.owner does not exist"}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return send(donnees.comptes);
    if (/\/rest\/v1\/rpc\//.test(u)) return send(null);
    if (/\/rest\/v1\/app_data/.test(u)) { const { body, range } = servir(donnees.rows, req.url().replace(/%3E/gi, '>'), req.headers()); return send(body, { 'content-range': range }); }
    return send([]);
  });
  await pg.route('**/api/**', (r2) => {
    if (/\/api\/ebay/.test(r2.request().url()) && r2.request().method() === 'GET' && donnees.ebayRoute === 'nonconf') return r2.fulfill({ status: 200, contentType: 'application/json', body: '{"ready":false,"canConsent":false}' });
    return r2.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"banc"}' });
  });
  return { ctx, pg };
}
const aller = async (pg, tab, attente = 4500) => { await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(attente); };
const section = async (pg, s) => { await pg.click(`button[data-section="${s}"]`).catch(() => {}); await pg.waitForTimeout(2500); };
const texte = (pg) => pg.evaluate(() => document.body.innerText || '');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  for (const W of [390, 1512]) {
    console.log(`── ${W} px`);
    const { ctx, pg } = await page(b, base(), W);
    await essaie('A comptes liés', async () => {
      await aller(pg, 'vintedaccounts');
      const t = await texte(pg);
      const auj = new Date(now - 3600000).toLocaleDateString('fr-FR');
      dit(/lié le 05\/07\/2026/.test(t), 'A. « lié le » dit la date de LIAISON (created_at)', (t.match(/lié le [^\n]*/) || ['(absent)'])[0]);
      dit(!new RegExp('lié le ' + auj.replace(/\//g, '\\/')).test(t), 'A. … pas la date du dernier renouvellement des jetons (updated_at)');
    });
    await essaie('B statistiques', async () => {
      await aller(pg, 'dashboard', 5500);
      const n = await pg.evaluate(() => { const e = document.querySelector('[data-finalise-masquees]'); return e ? [e.getAttribute('data-finalise-masquees'), e.getAttribute('data-finalise-masquees-eur'), e.innerText] : null; });
      // (29 oct., décision de Julien) « on ne doit plus pouvoir masquer » : la vente
      // masquée d'avant (9002, 30 €) COMPTE, et plus rien ne parle de ventes masquées.
      dit(!n || n[0] === '0', 'B. plus aucune « vente masquée » écartée du finalisé', n ? n.join(' | ') : 'aucune mention');
      const hero = await pg.evaluate(() => { const e = document.querySelector('[data-stats-carte="hero"]'); return e ? e.innerText : ''; });
      dit(/80,00\s*€/.test(hero), 'B. … le finalisé compte la vente masquée d’avant (80 € = 50 + 30)', hero.split('\n').slice(0, 2).join(' | '));
    });
    await essaie('C leboncoin', async () => {
      await aller(pg, 'plat_leboncoin');
      await section(pg, 'annonces');
      const t = await texte(pg);
      const m = t.match(/(\d+) vendues? sur Vinted — à retirer de Leboncoin/);
      dit(m && m[1] === '1', 'C. une paire vendue = UNE ligne « à retirer de Leboncoin »', m ? m[0] : 'bloc absent');
      const n18 = (t.match(/N°18 ·/g) || []).length;
      dit(n18 === 1, 'C. … la N°18 écrite une fois', `${n18} fois`);
      dit(/voir sur Leboncoin/.test(t), 'C. … et c\'est la ligne avec son lien Leboncoin qui reste');
    });
    await essaie('D ebay annonces', async () => {
      await aller(pg, 'plat_ebay');
      await section(pg, 'annonces');
      const d = await pg.evaluate(() => [...document.querySelectorAll('[data-sku-douteux]')].map((e) => e.getAttribute('data-sku-douteux')));
      const t = await texte(pg);
      dit(d.includes('VRM-48'), 'D. un SKU dont aucune fiche ne porte le N° est « à vérifier · pas reliée »', JSON.stringify(d));
      dit(!/\bN°48\b/.test(t), 'D. … il n\'est jamais affiché comme la paire N°48');
      await section(pg, 'compte');
      const st = await pg.evaluate(() => { const e = document.querySelector('[data-ebay-statut]'); return e ? e.getAttribute('data-ebay-statut') : null; });
      dit(st === 'passu', 'E. route eBay muette ⇒ « pas pu vérifier », pas « eBay pas configuré »', String(st));
      dit(!/pas encore configuré/.test(await texte(pg)), 'E. … aucune consigne « ajoute tes clés dans Vercel »');
    });
    await essaie('F ma journée', async () => {
      await aller(pg, 'journee', 6500);
      const j = await pg.evaluate(() => { const e = document.querySelector('[data-job="numeros-en-double"]'); return e ? [e.getAttribute('data-n'), e.innerText] : null; });
      // (21 oct.) Depuis #623, deux annonces EN LIGNE sous le même N° se règlent
      // toutes seules : la plus récente reçoit un numéro neuf, à écrire sur son
      // carton. Ma journée le dit (doublon restant) OU le doublon a été réglé
      // et le nouveau numéro est à écrire (Colis) — jamais rien.
      let regle = null;
      if (!j) { await aller(pg, 'cat_bord', 6500); regle = await pg.evaluate(() => { const e = document.querySelector('[data-numeros-a-ecrire]'); return e ? e.innerText : null; }); }
      dit((!!j && j[0] === '1' && /N°7/.test(j[1])) || (!!regle && /\b7\b/.test(regle)), 'F. le numéro porté par deux paires (N°7) est dit (Ma journée) ou réglé, avec le nouveau numéro à écrire (Colis)', j ? j.join(' | ').replace(/\n/g, ' ') : (regle ? regle.replace(/\n/g, ' ').slice(0, 160) : 'absent'));
    });
    await ctx.close();
    // ── G. deux comptes en retard : les deux nommés ──────────────────────
    const v3 = await page(b, base({ retard: [['222', 'compte_b', 6], ['333', 'compte_c', 3]] }), W);
    await essaie('G fraicheur', async () => {
      await aller(v3.pg, 'cat_bord', 5500);
      const f = await v3.pg.evaluate(() => { const e = document.querySelector('[data-fraicheur-comptes]'); return e ? [e.getAttribute('data-fraicheur-comptes'), e.innerText] : null; });
      dit(!!f && /compte_b:6/.test(f[0]) && /compte_c:3/.test(f[0]), 'G. deux comptes en retard : les DEUX sont nommés, chacun avec son âge', f ? f[0] : 'un seul (ou aucun) nommé');
    });
    await v3.ctx.close();
    // ── L'AUTRE SENS ─────────────────────────────────────────────────────
    const v2 = await page(b, base({ conflit: false, ebayRoute: 'nonconf', retard: [['222', 'compte_b', 6]] }), W);
    await essaie('autre sens', async () => {
      await aller(v2.pg, 'journee', 6500);
      dit(!(await v2.pg.$('[data-job="numeros-en-double"]')), 'F (autre sens). sans doublon de N°, aucune alerte');
      await aller(v2.pg, 'cat_bord', 5500);
      const t = await texte(v2.pg);
      dit(/Les données du compte compte_b datent d'il y a 6 j/.test(t) && !(await v2.pg.$('[data-fraicheur-comptes]')), 'G (autre sens). un seul compte en retard : la phrase d\'avant, qui le nomme');
      await aller(v2.pg, 'plat_ebay');
      await section(v2.pg, 'compte');
      const st = await v2.pg.evaluate(() => { const e = document.querySelector('[data-ebay-statut]'); return e ? e.getAttribute('data-ebay-statut') : null; });
      dit(st === 'non-configure', 'E (autre sens). la route dit `ready:false` ⇒ « pas encore configuré » reste dit', String(st));
    });
    await v2.ctx.close();
  }
  await b.close(); srv.close();
  console.log(ko ? `\n${ko} échec(s)` : '\nTout est vert.');
  process.exit(ko ? 1 : 0);
})();
