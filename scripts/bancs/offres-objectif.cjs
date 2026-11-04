// Banc : LES TROIS CHANTIERS DU 4 NOVEMBRE — objectif du mois, statistiques des
// offres, questions eBay. Données INVENTÉES (le dépôt est public). Rendu à 390 px
// tactile et 1512 px, clair et sombre. Il juge la RÈGLE (data-* et nombres) :
//   A. OBJECTIF : aucun objectif ⇒ aucune barre ; « Modifier » → « Objectif » →
//      CA vendu 500 € → OK ⇒ une barre fine dans la carte de Ventes, valeur =
//      le vendu du mois TOUS sites (297 €) ⇒ 59 % ; recharger ⇒ gardé ; Achats :
//      pas de barre ; « Nombre de ventes » 4 ⇒ 4/4 = atteint ; Statistiques lit
//      le même réglage et la même valeur ;
//   B. OFFRES (Statistiques, novembre) : 3 ventes Vinted lues sur 3 ; 2 par offre
//      (80 → 70 et 130 → 115) ⇒ coût 25 €, remise moyenne 12,50 € ; les
//      conversations : 3 reçues · 1 acceptée · 0 refusée · 1 contre-offre ;
//      « Acceptées par le moteur : — » ;
//   C. QUESTIONS eBAY : « Questions » par défaut, une ligne par annonce (2), la
//      plus ancienne sans réponse ouverte d'abord, navigation 1 · 2 ; un message
//      qui n'est pas une question : pas de champ, « Ouvrir sur eBay » ; Envoyer ⇒
//      SA confirmation ⇒ `repondre` avec `confirme:true` sur CETTE question ;
//   D. aucun débordement, aucune erreur d'app.
// Lancer : node <construire> && BANC_PORT=47xx node scripts/bancs/offres-objectif.cjs
// Captures : SHOTS=<dossier>.
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4741);
const SHOTS = process.env.SHOTS || '';
const VUES = process.env.VUES ? process.env.VUES.split(',') : null;

const maintenant = new Date(2026, 10, 2, 17, 30, 0);
const il = (n, h = 12) => { const d = new Date(maintenant); d.setHours(h, 0, 0, 0); d.setDate(d.getDate() - n); return d; };
const A = '111', ACHETEUR = '222';
let nPhoto = 0;
const vente = (id, titre, prix, statut, d, tus) => ({ transaction_id: id, conversation_id: 50000 + id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, status: statut, transaction_user_status: tus, date: d.toISOString(), photo: { url: `https://images1.vinted.net/t/b${++nPhoto}/f800/${id}.jpeg?s=x` } });
const VENTES = [
  vente(8001, 'Salomon XT-6 noir taille 38,5', 70, 'Le paiement a été validé', il(0, 11), 'needs_action'),
  vente(8002, 'Adidas Samba OG noir gomme taille 40', 72, 'Le paiement a été validé', il(1, 9), 'needs_action'),
  vente(8003, 'New Balance 550 vert taille 42', 88, 'Le colis est en route', il(3, 10), 'waiting'),
  vente(8004, 'Nike Air Max 1 rouge taille 43', 115, 'Le colis a été livré', il(1, 10), 'waiting'),
  vente(8005, 'Asics Gel-Kayano 14 argent taille 44', 89, 'Commande finalisée', il(9), 'completed'),
  vente(8006, 'Nike Shox TL noir taille 41', 95, 'Commande annulée', il(1), 'failed'),
];
const ACCOUNTS = [{ id: 1, vinted_user_id: A, login: 'boutique_test', domain: 'www.vinted.fr', updated_at: maintenant.toISOString() }];
const cap = maintenant.toISOString();
const plusTard = new Date(maintenant.getTime() + 6 * 3600e3).toISOString();   // lu après « maintenant » : la période est couverte
const txn = (id, sys, op, ip, ic = 1) => ({ id: `harvest_${A}_txn_${id}`, data: { capturedAt: cap, payload: { transaction: { id, item_id: 8900 + id, status: 230, status_title: 'Le paiement a été validé', status_updated_at: cap, offer: { id: 9000 + id, price: { amount: String(op), currency_code: 'EUR' }, is_system: sys }, order: { item_count: ic, items: [{ id: 8900 + id, price: { amount: String(ip), currency_code: 'EUR' } }] } } } } });
const t = (d, h) => { const x = new Date(maintenant); x.setDate(x.getDate() - d); x.setHours(h, 0, 0, 0); return x.toISOString(); };
const req = (oid, st, quand, prix = '60.0') => ({ id: 'm' + oid, entity_type: 'offer_request_message', created_at_ts: quand, entity: { offer_request_id: oid, transaction_id: 70000 + oid, user_id: Number(ACHETEUR), status: st, status_title: st === 20 ? '- Offre acceptée' : st === 30 ? 'Refusée' : 'En attente', price: { amount: prix, currency_code: 'EUR' }, original_price: { amount: '80.0', currency_code: 'EUR' }, current: true } });
const conv = (n, messages) => ({ id: `harvest_${A}_conv_${n}`, data: { capturedAt: plusTard, payload: { conversation: { id: n, opposite_user: { id: Number(ACHETEUR) }, transaction: { current_user_side: 'seller', item_id: 8900 + n }, messages } } } });
const LIGNES = [
  { id: `harvest_${A}_orders_sold`, data: { capturedAt: cap, payload: { my_orders: VENTES } } },
  { id: `harvest_${A}_listings`, data: { capturedAt: cap, payload: { items: [], pagination: null } } },
  { id: 'lbc_ventes', data: { ventes: { T77: { txId: 'T77', isSeller: true, title: 'Nike Air Max 90 blanche', price: 4000, dateVente: il(0, 10).toISOString(), status: 'paid', account: 'lbc_test', at: cap } } } },
  txn(8001, false, 70, 80), txn(8002, true, 72, 72), txn(8004, false, 115, 130),
  conv(1, [req(1, 20, t(1, 10))]),
  conv(2, [req(2, 30, t(1, 11)), { id: 'o2', entity_type: 'offer_message', created_at_ts: t(1, 12), entity: { user_id: Number(A), price: { amount: '75.0', currency_code: 'EUR' }, current: true } }]),
  conv(3, [req(3, 10, t(0, 9))]),
];

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 200)); } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.mjs': 'text/javascript' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'updated_at') { out[alias] = cap; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' ? String(v) : v);
  }
  return out;
};
const photoSvg = (k) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${['#dfe3e8', '#e8e1d8', '#dfe5dd'][k % 3]}"/></svg>`;

// eBay : deux annonces (SKU VRM-80 et VRM-81), 3 questions + un message de transaction.
const EBAY_ANNONCES = [
  { itemId: '2001', sku: 'VRM-80', title: 'Salomon XT-6 blanc', price: '120.00', currency: 'EUR', photo: 'https://i.ebayimg.com/images/g/a/s-l500.jpg', observateurs: 11 },
  { itemId: '2002', sku: 'VRM-81', title: 'Adidas Samba T40', price: '90.00', currency: 'EUR', photo: 'https://i.ebayimg.com/images/g/b/s-l500.jpg', observateurs: 2 },
];
const ih = (h) => new Date(maintenant.getTime() - h * 3600e3).toISOString();
const EBAY_MESSAGES = [
  { id: 'q1', itemId: '2001', titre: 'Salomon XT-6 blanc', sender: 'acheteur_a', subject: 'Taille', body: 'Elle taille grand ?', responses: [], status: 'Unanswered', date: ih(20), type: 'AskSellerQuestion' },
  { id: 'q2', itemId: '2001', titre: 'Salomon XT-6 blanc', sender: 'acheteur_b', subject: 'Envoi', body: 'Envoi demain possible ?', responses: [], status: 'Unanswered', date: ih(3), type: 'AskSellerQuestion' },
  { id: 'q3', itemId: '2002', titre: 'Adidas Samba T40', sender: 'acheteur_c', subject: 'Prix', body: 'Dernier prix ?', responses: ['85 € ferme'], status: 'Answered', date: ih(30), type: 'AskSellerQuestion' },
  { id: 'q4', itemId: '2002', titre: 'Adidas Samba T40', sender: 'acheteur_d', subject: 'Commande', body: 'Bien reçu, merci', responses: [], status: 'Unanswered', date: ih(1), type: 'ContactTransactionPartner' },
];

const contexte = async (b, vp, sombre) => {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  await ctx.addInitScript((s) => { try {
    localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s));
    localStorage.setItem('vrm_visite_vue', JSON.stringify(true));
    localStorage.setItem('vinted_annonce_numeros', JSON.stringify({ 801: { numero: '80', title: 'Salomon XT-6 blanc', numberedAt: '2026-10-20T10:00:00Z' }, 802: { numero: '81', title: 'Adidas Samba T40', numberedAt: '2026-10-20T10:00:00Z' } }));
  } catch (_) {} }, !!sombre);
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const ebayEcrits = [];
  await pg.clock.install({ time: maintenant });
  await pg.route(/^https?:\/\/[^/]*vinted\.net\//i, (r) => { const m = /\/b(\d+)\//.exec(r.request().url()); return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: photoSvg(m ? Number(m[1]) : 0) }); });
  await pg.route(/^https?:\/\/i\.ebayimg\.com\//i, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: photoSvg(/\/g\/b\//.test(r.request().url()) ? 1 : 2) }));
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1|[^/]*vinted\.net|i\.ebayimg\.com)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    if (route.request().method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    if (/id=in\.\(lbc_listings/.test(u) && /select=id(&|$)/.test(u)) return j([{ id: 'ebay_listings' }]);
    if (/id=eq\.ebay_listings/.test(u)) return j([{ items: EBAY_ANNONCES, capturedAt: cap }]);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: cap, cap: r.data.capturedAt });
    const dans = /[?&]id=in\.\(([^)]*)\)/.exec(u);
    if (dans) { const ids = dans[1].split(','); return j(LIGNES.filter((r) => ids.includes(r.id)).map(forme)); }
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1]).map(forme));
    const lk = /[?&]id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/ebay', async (r) => {
    const body = r.request().method() === 'POST' ? (r.request().postDataJSON() || {}) : {};
    const a = body.action;
    if (!['messages', 'message', 'status', 'agent'].includes(a)) ebayEcrits.push(body);
    let j = { ok: true, connected: true, ready: true };
    if (a === 'status') j = { ok: true, connected: true, comptes: [{ cle: '', ref: 'principal', principal: true, pseudo: 'Compte de banc', relie: true }] };
    if (a === 'messages') j = { ok: true, messages: EBAY_MESSAGES, page: 1, totalPages: 1 };
    if (a === 'repondre') j = { ok: true, avertissements: [] };
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(j) });
  });
  await pg.route('**/api/**', (r) => (/\/api\/ebay/.test(r.request().url()) ? r.fallback() : r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' })));
  return { ctx, pg, errs, ebayEcrits };
};
const aller = async (pg, url, attend) => {
  await pg.goto(`http://localhost:${PORT}/?${url}`, { waitUntil: 'domcontentloaded' });
  await pg.locator(attend).first().waitFor({ timeout: 30000 });
  await pg.waitForTimeout(2000);
};
const barre = (pg, page) => pg.evaluate((page) => {
  const c = document.querySelector(`[data-carte-stats="${page}"]`); if (!c) return 'carte-absente';
  const o = c.querySelector('[data-objectif]'); if (!o) return null;
  const r = o.getBoundingClientRect(), p = o.querySelector('.vrm-fu-objectif-piste').getBoundingClientRect();
  return { type: o.getAttribute('data-objectif'), cible: o.getAttribute('data-objectif-cible'), valeur: o.getAttribute('data-objectif-valeur'), pct: o.getAttribute('data-objectif-pct'), atteint: o.getAttribute('data-objectif-atteint'), h: Math.round(p.height), dedans: r.right <= c.getBoundingClientRect().right + 0.5, txt: o.innerText.replace(/\n/g, ' · ') };
}, page);
const deborde = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] }).catch(() => chromium.launch());
  try {
    for (const [vp, sombre, nom] of [[{ width: 390, height: 844 }, false, '390-clair'], [{ width: 390, height: 844 }, true, '390-sombre'], [{ width: 1512, height: 982 }, false, '1512-clair'], [{ width: 1512, height: 982 }, true, '1512-sombre']]) {
      if (VUES && !VUES.includes(nom)) continue;
      console.log(`\n══ ${nom}`);
      const { ctx, pg, errs, ebayEcrits } = await contexte(b, vp, sombre);
      const shot = async (sel, f) => { if (!SHOTS) return; const l = pg.locator(sel).first(); if (await l.count()) { await l.scrollIntoViewIfNeeded().catch(() => {}); await l.screenshot({ path: path.join(SHOTS, `${f}-${nom}.png`) }).catch(() => {}); } };

      await essaie('A. objectif', async () => {
        console.log('── A. Objectif du mois');
        await aller(pg, 'tab=cat_ventes', '[data-carte-stats="ventes"]');
        dit(await barre(pg, 'ventes') === null, 'aucun objectif ⇒ aucune barre (et aucune phrase)');
        await pg.locator('[data-carte-modifier="ventes"]').first().click();
        await pg.locator('[data-carte-objectif-ouvrir]').first().click();
        await pg.locator('[data-carte-objectif-type="ca"]').first().click();
        await pg.locator('[data-carte-objectif-saisie]').first().fill('2k');
        dit(await pg.locator('[data-carte-objectif-ok]').first().isDisabled(), '« 2k » : OK reste grisé (jamais deviné)');
        await pg.locator('[data-carte-objectif-saisie]').first().fill('500');
        const petits = await pg.evaluate(() => [...document.querySelectorAll('[data-carte-feuille] .vrm-carte-objectif button, [data-carte-feuille] .vrm-carte-objectif input')].filter((x) => x.getBoundingClientRect().height > 0 && x.getBoundingClientRect().height < 43.5).map((x) => x.innerText || x.tagName));
        dit(!petits.length, 'la section « Objectif » : 44 px au doigt', petits.join(' | '));
        if (SHOTS) await pg.locator('[data-carte-feuille]').first().screenshot({ path: path.join(SHOTS, `feuille-objectif-${nom}.png`) }).catch(() => {});
        await pg.locator('[data-carte-objectif-ok]').first().click();
        await pg.locator('[data-carte-fermer]').first().click();
        await pg.waitForTimeout(500);
        let o = await barre(pg, 'ventes');
        dit(o && o.type === 'ca' && o.cible === '50000' && o.valeur === '29700' && o.pct === '59' && !o.atteint, 'CA 500 € : la barre dit 297 € (le vendu du mois, TOUS les sites) ⇒ 59 %', JSON.stringify(o));
        dit(o && o.h <= 6 && o.dedans, 'une barre FINE, dans la carte', JSON.stringify(o && { h: o.h, d: o.dedans }));
        await shot('[data-carte-stats="ventes"]', 'carte-objectif');
        await aller(pg, 'tab=cat_ventes', '[data-carte-stats="ventes"]');
        o = await barre(pg, 'ventes');
        dit(o && o.pct === '59', 'recharger : l’objectif est gardé', JSON.stringify(o));
        await aller(pg, 'tab=achats', '[data-carte-stats="achats"]');
        dit(await barre(pg, 'achats') === null, 'Achats (aucun chiffre de vente) : pas de barre');
        await aller(pg, 'tab=cat_ventes', '[data-carte-stats="ventes"]');
        await pg.locator('[data-carte-modifier="ventes"]').first().click();
        await pg.locator('[data-carte-objectif-ouvrir]').first().click();
        await pg.locator('[data-carte-objectif-type="ventes"]').first().click();
        await pg.locator('[data-carte-objectif-saisie]').first().fill('4');
        await pg.locator('[data-carte-objectif-ok]').first().click();
        await pg.locator('[data-carte-fermer]').first().click();
        await pg.waitForTimeout(400);
        o = await barre(pg, 'ventes');
        dit(o && o.type === 'ventes' && o.valeur === '4' && o.pct === '100' && o.atteint === '1', 'Nombre de ventes 4 : 4 ventes ce mois (3 Vinted + 1 Leboncoin) ⇒ atteint', JSON.stringify(o));
        await shot('[data-carte-stats="ventes"]', 'carte-objectif-ventes');
      });

      await essaie('B. offres', async () => {
        console.log('── B. Statistiques : objectif et offres');
        await aller(pg, 'tab=dashboard', '[data-sv-tuile="vendu"]');
        await pg.locator('[data-stats-carte="sv-offres"]').first().scrollIntoViewIfNeeded();
        await pg.locator('[data-stats-carte="sv-offres"][data-of-etat="lu"]').first().waitFor({ timeout: 20000 });
        const of = await pg.evaluate(() => {
          const c = document.querySelector('[data-stats-carte="sv-offres"]');
          const v = (k) => (c.querySelector(`[data-of-tuile="${k}"]`) || {}).getAttribute && c.querySelector(`[data-of-tuile="${k}"]`).getAttribute('data-v');
          const l = c.querySelector('[data-of-compte="111"]');
          return { couv: c.getAttribute('data-of-couv'), cout: v('cout'), remise: v('remise'), paroffre: v('paroffre'),
            ligne: l ? { r: l.getAttribute('data-recues'), a: l.getAttribute('data-acceptees'), f: l.getAttribute('data-refusees'), c: l.getAttribute('data-contre'), cout: l.getAttribute('data-cout'), p: l.getAttribute('data-partiel-offres'), t: l.innerText.replace(/\n/g, ' · ') } : null,
            moteur: (c.querySelector('[data-of-moteur]') || {}).innerText || '' };
        });
        dit(of.couv === '3/3' && of.cout === '2500' && of.remise === '1250' && of.paroffre === '2/3', 'novembre : 3 ventes lues sur 3, 2 par offre, 25 € de remises, 12,50 € en moyenne', JSON.stringify(of));
        dit(of.ligne && of.ligne.r === '3' && of.ligne.a === '1' && of.ligne.f === '0' && of.ligne.c === '1' && of.ligne.cout === '2500' && !of.ligne.p, 'le compte : 3 reçues · 1 acceptée · 0 refusée · 1 contre-offre · 25 €', JSON.stringify(of.ligne));
        dit(/moteur : —/.test(of.moteur), '« Acceptées par le moteur : — » (aucun journal en base)');
        await shot('[data-stats-carte="sv-offres"]', 'stats-offres');
        const ob = await pg.evaluate(() => { const e = document.querySelector('[data-objectif-bloc]'); return e ? { t: e.getAttribute('data-objectif-bloc'), v: (e.querySelector('[data-objectif-valeur]') || { getAttribute: () => null }).getAttribute('data-objectif-valeur'), p: (e.querySelector('[data-objectif-pct]') || { getAttribute: () => null }).getAttribute('data-objectif-pct') } : null; });
        dit(!ob || (ob.t === 'ventes' && ob.v === '4' && ob.p === '100'), 'Statistiques : le MÊME objectif, la MÊME valeur que la carte (s’il est déplié)', JSON.stringify(ob));
        dit(await deborde(pg) <= 0, 'Statistiques : aucun débordement', String(await deborde(pg)));
      });

      await essaie('C. questions eBay', async () => {
        console.log('── C. Messages · eBay : Questions');
        await aller(pg, 'tab=messages&site=ebay', '[data-messagerie-site="ebay"] [data-ebay-questions]');
        const L = await pg.evaluate(() => [...document.querySelectorAll('[data-ebay-question-annonce]')].filter((x) => x.getBoundingClientRect().height > 0).map((x) => ({ item: x.getAttribute('data-ebay-question-annonce'), n: x.getAttribute('data-q-n'), sans: x.getAttribute('data-q-sans'), cible: x.getAttribute('data-q-cible'), num: x.getAttribute('data-conv-num'), t: x.innerText.replace(/\n/g, ' · ') })));
        dit(L.length === 2 && L[0].item === '2001' && L[0].n === '2' && L[0].sans === '2' && L[0].cible === 'q1' && L[0].num === '80', '« Questions » : une ligne par annonce ; 2001 en tête (2 sans réponse), la plus ANCIENNE ouverte d’abord, N°80 par son SKU', JSON.stringify(L));
        dit(L[1] && L[1].item === '2002' && L[1].n === '1' && L[1].num === '81', '2002 : 1 question (le message de transaction n’en est pas une), N°81', JSON.stringify(L[1]));
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `ebay-questions-${nom}.png`) });
        await pg.locator('[data-ebay-question-annonce="2001"]').first().click();
        await pg.locator('.vrm-chat-panel [data-q-nav]').first().waitFor({ timeout: 8000 });
        const nav = await pg.evaluate(() => [...document.querySelectorAll('[data-q-aller]')].map((x) => x.getAttribute('data-q-aller') + (x.getAttribute('aria-pressed') === 'true' ? '*' : '')).join(','));
        dit(nav === 'q1*,q2', 'le fil : 1 · 2, la question 1 ouverte', nav);
        const petitsNav = await pg.evaluate(() => [...document.querySelectorAll('[data-q-aller], [data-ebay-vue]')].filter((x) => x.getBoundingClientRect().height > 0).map((x) => x.getBoundingClientRect()).filter((r) => r.height < 43.5 || r.width < 43.5).map((r) => `${Math.round(r.width)}x${Math.round(r.height)}`).join(' '));
        dit(petitsNav === '', '« Questions · Tout » et « 1 · 2 » : 44 px au doigt', String(petitsNav));
        const fil = await pg.evaluate(() => { const p = document.querySelector('.vrm-chat-panel'); return p ? Math.round(p.getBoundingClientRect().width) : 0; });
        dit(fil >= (vp.width < 600 ? 389 : 380), 'le fil a la place de se lire (jamais un mot par ligne)', String(fil));
        await pg.locator('.vrm-chat-compose textarea').first().fill('Taille normale, prends ta taille habituelle.');
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `ebay-question-fil-${nom}.png`) });
        dit(!ebayEcrits.length, 'écrire ne part pas : rien n’est envoyé sans son clic');
        await pg.locator('.vrm-chat-send').first().click();
        const ok = pg.getByRole('button', { name: 'Envoyer la réponse' }).last();
        await ok.waitFor({ timeout: 5000 });
        dit(!ebayEcrits.length, 'Envoyer ⇒ SA confirmation d’abord, rien de parti');
        await ok.click();
        await pg.waitForTimeout(800);
        const e = ebayEcrits[0] || {};
        dit(ebayEcrits.length === 1 && e.action === 'repondre' && e.messageId === 'q1' && e.itemId === '2001' && e.confirme === true, 'confirmé ⇒ `repondre` sur CETTE question, `confirme:true`', JSON.stringify(ebayEcrits));
        if (vp.width < 600) { await pg.getByRole('button', { name: /Fermer la conversation eBay/ }).first().click().catch(() => {}); await pg.waitForTimeout(400); }
        await pg.locator('[data-ebay-vue="tout"]').first().click();
        await pg.locator('[data-ebay-message="q4"]').first().click();
        await pg.locator('[data-ebay-pas-question]').first().waitFor({ timeout: 8000 });
        const p = await pg.evaluate(() => { const f = document.querySelector('[data-ebay-pas-question]'); return { champ: !!f.querySelector('textarea'), lien: (f.querySelector('[data-pied-ouvrir]') || {}).href || '' }; });
        dit(!p.champ && /ebay\.fr\/itm\/2002/.test(p.lien), 'un message qui n’est pas une question : aucun champ, « Ouvrir sur eBay »', JSON.stringify(p));
        dit(await deborde(pg) <= 0, 'Messages · eBay : aucun débordement', String(await deborde(pg)));
      });
      dit(!errs.length, 'aucune erreur d’app', errs.join(' | ').slice(0, 300));
      await ctx.close();
    }
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} offres-objectif : ${ko} rouge(s), ${ok} vert(s)`);
  process.exit(ko ? 1 : 0);
})();
