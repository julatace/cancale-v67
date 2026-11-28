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
//   C. QUESTIONS eBAY (27 nov. : « Tous » met les questions sans réponse en tête, « À répondre », la plus ancienne d'abord) : « Questions » par défaut, une ligne par annonce (2), la
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
let pgCourant = null, nomCourant = '';
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 200)); if (SHOTS && pgCourant) await pgCourant.screenshot({ path: path.join(SHOTS, 'echec-' + nom.replace(/[^a-z]+/gi, '-') + '-' + nomCourant + '.png') }).catch(() => {}); } };
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

// eBay : deux annonces (SKU VRM-80 et VRM-81), 3 questions + un message de transaction. Les ItemID ont la FORME d'eBay
// (12 chiffres) : la règle « question » de l'app (FilsTous `FilEbay`) l'exige, comme la route `repondre`.
const ITEM_A = '226000002001', ITEM_B = '226000002002';
const EBAY_ANNONCES = [
  { itemId: ITEM_A, sku: 'VRM-80', title: 'Salomon XT-6 blanc', price: '120.00', currency: 'EUR', photo: 'https://i.ebayimg.com/images/g/a/s-l500.jpg', observateurs: 11 },
  { itemId: ITEM_B, sku: 'VRM-81', title: 'Adidas Samba T40', price: '90.00', currency: 'EUR', photo: 'https://i.ebayimg.com/images/g/b/s-l500.jpg', observateurs: 2 },
];
const ih = (h) => new Date(maintenant.getTime() - h * 3600e3).toISOString();
const EBAY_MESSAGES = [
  { id: 'q1', itemId: ITEM_A, titre: 'Salomon XT-6 blanc', sender: 'acheteur_a', subject: 'Taille', body: 'Elle taille grand ?', responses: [], status: 'Unanswered', date: ih(20), type: 'AskSellerQuestion' },
  { id: 'q2', itemId: ITEM_A, titre: 'Salomon XT-6 blanc', sender: 'acheteur_b', subject: 'Envoi', body: 'Envoi demain possible ?', responses: [], status: 'Unanswered', date: ih(3), type: 'AskSellerQuestion' },
  { id: 'q3', itemId: ITEM_B, titre: 'Adidas Samba T40', sender: 'acheteur_c', subject: 'Prix', body: 'Dernier prix ?', responses: ['85 € ferme'], status: 'Answered', date: ih(30), type: 'AskSellerQuestion' },
  { id: 'q4', itemId: ITEM_B, titre: 'Adidas Samba T40', sender: 'acheteur_d', subject: 'Commande', body: 'Bien reçu, merci', responses: [], status: 'Unanswered', date: ih(1), type: 'ContactTransactionPartner' },
];

const contexte = async (b, vp, sombre) => {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  await ctx.addInitScript((s) => { try {
    localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s));
    // (26 nov.) L'app RÉELLE (« VRM natif ») : jamais le DOM d'avant le 17 nov. (échafaudage `vrm_banc_dom_ancien`, _garde-reseau.cjs).
    localStorage.setItem('vrm_design_v2', '1');
    localStorage.setItem('vrm_visite_vue', JSON.stringify(true));
    localStorage.setItem('vinted_annonce_numeros', JSON.stringify({ 801: { numero: '80', title: 'Salomon XT-6 blanc', numberedAt: '2026-10-20T10:00:00Z' }, 802: { numero: '81', title: 'Adidas Samba T40', numberedAt: '2026-10-20T10:00:00Z' } }));
  } catch (_) {} }, !!sombre);
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const ebayEcrits = [];
  await pg.clock.install({ time: maintenant });
  await pg.route(/^https?:\/\/[^/]*vinted\.net\//i, (r) => { const m = /\/b(\d+)\//.exec(r.request().url()); return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: photoSvg(m ? Number(m[1]) : 0) }); });
  await pg.route(/^https?:\/\/i\.ebayimg\.com\//i, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: photoSvg(/\/g\/b\//.test(r.request().url()) ? 1 : 2) }));
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1|[^/]*vinted\.net|i\.ebayimg\.com)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) || /^https?:\/\/[^/]*vinted\.net\//i.test(r.request().url()) ? r.abort() : r.continue()));
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
    if (!['messages', 'message', 'status', 'agent', 'achats', 'crmreglages'].includes(a)) ebayEcrits.push(body);   // les LECTURES (dont « achats », Achats · eBay, et « crmreglages », la lecture des modèles du CRM eBay — api/_lib/ebay-crm.js reglages(), aucune écriture) ne sont pas des écritures
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
      pgCourant = pg; nomCourant = nom;
      const shot = async (sel, f) => { if (!SHOTS) return; const l = pg.locator(sel).first(); if (await l.count()) { await l.scrollIntoViewIfNeeded().catch(() => {}); await l.screenshot({ path: path.join(SHOTS, `${f}-${nom}.png`) }).catch(() => {}); } };

      await essaie('A. objectif', async () => {
        console.log('── A. Objectif du mois');
        // (26 nov., bancs natifs) Depuis « VRM natif » (19 nov., docs/design/NATIF.md), Ventes est l'écran natif : la carte des
        // chiffres de Ventes (`[data-carte-stats="ventes"]`) y reste montée mais CACHÉE (`CacheSiV2 si={natifV}`, App.jsx), sa
        // barre d'objectif avec elle. L'objectif du mois n'est PAS retiré : le MÊME réglage (`useObjectifMois`,
        // `vrm_objectif_mois`) et la MÊME règle (`valeurObjectif` → `progressionObjectif`, src/objectifMois.js) se voient
        //   · dans Statistiques — `ObjectifDuMois`, le réglage complet CA / ventes (`[data-objectif-bloc]`) ;
        //   · dans Aujourd'hui, sous « Mois » — `ObjectifLigne` (`[data-v2-objectif]`, 2026-11-19-aujourdhui-propre.md) ;
        //   · dans Argent · Mois — l'anneau (`[data-agv-objectif]`, 2026-11-24-visuel-argent.md).
        // Les garanties d'avant y sont jugées : aucun objectif ⇒ rien de dessiné ; « 2k » jamais deviné ; 44 px ; CA 500 € ⇒
        // 297 € TOUS sites ⇒ 59 %, la même valeur aux trois endroits ; gardé au rechargement ; Achats sans objectif ;
        // « Nombre de ventes » 4 ⇒ 4/4, atteint.
        const lireStats = () => pg.evaluate(() => {
          const e = document.querySelector('[data-objectif-bloc]'); if (!e) return 'absent';
          const v = e.querySelector('[data-objectif-valeur]'), pb = e.querySelector('[role="progressbar"]');
          const r = pb ? pb.getBoundingClientRect() : null, c = e.getBoundingClientRect();
          return { type: e.getAttribute('data-objectif-bloc'), valeur: v ? v.getAttribute('data-objectif-valeur') : null, pct: v ? String(v.getAttribute('data-objectif-pct')) : null,
            h: r ? Math.round(r.height) : null, dedans: r ? r.left >= c.left - 0.5 && r.right <= c.right + 0.5 : null };
        });
        // Aujourd'hui : le segment du bloc des chiffres Jour · Mois (PERIODES_JOURNEE = ['jour', 'mois']) ⇒ « Mois », le 2ᵉ choix
        // (jugé sur `data-v2-periode`, jamais sur le libellé).
        const versMois = async () => {
          await aller(pg, 'tab=journee', '[data-v2-bloc="chiffres"][data-v2-chiffres="lu"] [role="radiogroup"] [role="radio"]');
          await pg.locator('[data-v2-bloc="chiffres"] [role="radiogroup"] [role="radio"]').nth(1).click();
          await pg.locator('[data-v2-bloc="chiffres"][data-v2-periode="mois"]').first().waitFor({ timeout: 10000 });
          await pg.locator('[data-v2-objectif]').first().waitFor({ timeout: 10000 });
        };
        const lireJournee = async () => {
          await versMois();
          return pg.evaluate(() => { const o = document.querySelector('[data-v2-objectif]'); return o ? { etat: o.getAttribute('data-v2-objectif'), pct: o.getAttribute('data-v2-objectif-pct'), barre: !!(o.matches('[role="progressbar"]') || o.querySelector('[role="progressbar"]')) } : null; });
        };
        const lireArgent = async () => {
          await aller(pg, 'tab=argent', '[data-argent-vue="resume"]');
          await pg.waitForTimeout(800);
          // L'anneau est posé À DROITE DU REÇU du mois (ArgentMois.jsx) : reçu pas su (« Reçu en novembre : … », la ligne du geste)
          // ⇒ pas de ligne du reçu, pas d'anneau — l'objectif reste dit dans Aujourd'hui et Statistiques. `recu` = « » : pas su.
          return pg.evaluate(() => { const o = document.querySelector('[data-agv-objectif]'); const r = document.querySelector('[data-v2-argent-recu]');
            return { recu: r ? r.getAttribute('data-v2-argent-recu') : null, anneau: o ? { etat: o.getAttribute('data-agv-objectif'), pct: o.getAttribute('data-agv-objectif-pct'), cible: o.getAttribute('data-agv-objectif-cible') } : null }; });
        };
        await aller(pg, 'tab=dashboard', '[data-objectif-bloc]');
        let s = await lireStats();
        dit(s && s.type === '' && s.valeur == null, 'Statistiques : aucun objectif ⇒ aucune barre ni valeur', JSON.stringify(s));
        let j = await lireJournee();
        dit(j && j.etat === 'aucun' && !j.barre, 'Aujourd’hui · Mois : aucun objectif ⇒ le seul lien pour le fixer, aucune barre', JSON.stringify(j));
        // L'entrée d'Aujourd'hui : « 2k » n'est jamais deviné (rien d'enregistré).
        await pg.locator('[data-v2-objectif="aucun"]').first().click();
        await pg.locator('[data-v2-objectif-saisie]').first().fill('2k');
        await pg.locator('[data-v2-objectif-enregistrer]').first().click();
        await pg.waitForTimeout(400);
        await pg.keyboard.press('Escape'); await pg.waitForTimeout(400);
        j = await lireJournee();
        dit(j && j.etat === 'aucun', 'Aujourd’hui : « 2k » n’enregistre rien (jamais deviné)', JSON.stringify(j));
        let a = await lireArgent();
        dit(a.recu !== null && a.anneau === null, 'Argent · Mois : aucun objectif ⇒ aucun anneau', JSON.stringify(a));
        await aller(pg, 'tab=dashboard', '[data-objectif-bloc]');
        await pg.locator('[data-objectif-bloc] [data-objectif-modifier]').first().click();
        await pg.locator('[data-objectif-bloc] [data-objectif-type="ca"]').first().click();
        await pg.locator('[data-objectif-bloc] [data-objectif-saisie]').first().fill('2k');
        dit(await pg.locator('[data-objectif-bloc] [data-objectif-ok]').first().isDisabled(), 'Statistiques : « 2k » : OK reste grisé (jamais deviné)');
        await pg.locator('[data-objectif-bloc] [data-objectif-saisie]').first().fill('500');
        const petits = await pg.evaluate(() => [...document.querySelectorAll('[data-objectif-bloc] button, [data-objectif-bloc] input')].filter((x) => x.getBoundingClientRect().height > 0 && x.getBoundingClientRect().height < 43.5).map((x) => (x.innerText || x.tagName) + ':' + Math.round(x.getBoundingClientRect().height)));
        dit(!petits.length, 'le réglage « Objectif » : 44 px au doigt', petits.join(' | '));
        await shot('[data-objectif-bloc]', 'reglage-objectif');
        await pg.locator('[data-objectif-bloc] [data-objectif-ok]').first().click();
        await pg.waitForTimeout(500);
        s = await lireStats();
        dit(s && s.type === 'ca' && s.valeur === '29700' && s.pct === '59', 'CA 500 € : Statistiques dit 297 € (le vendu du mois, TOUS les sites) ⇒ 59 %', JSON.stringify(s));
        dit(s && s.h != null && s.h <= 6 && s.dedans, 'une barre FINE, dans son bloc', JSON.stringify(s && { h: s.h, d: s.dedans }));
        await shot('[data-objectif-bloc]', 'stats-objectif');
        j = await lireJournee();
        dit(j && j.etat === 'lu' && j.pct === '59' && j.barre, 'Aujourd’hui · Mois : le MÊME objectif, la MÊME valeur (59 %)', JSON.stringify(j));
        await shot('[data-v2-objectif]', 'journee-objectif');
        a = await lireArgent();
        dit(a.recu !== null && (a.recu === '' ? a.anneau === null : !!a.anneau && a.anneau.etat === 'lu' && a.anneau.pct === '59' && a.anneau.cible === '50000'), 'Argent · Mois : l’anneau dit 59 % de 500 € (reçu lu), jamais un anneau sans le reçu', JSON.stringify(a));
        await shot('[data-agv-objectif]', 'argent-objectif');
        await aller(pg, 'tab=dashboard', '[data-objectif-bloc]');
        s = await lireStats();
        dit(s && s.pct === '59', 'recharger : l’objectif est gardé', JSON.stringify(s));
        await aller(pg, 'tab=achats', '[data-tache="achats"]');
        dit(await pg.locator('[data-objectif], [data-objectif-bloc], [data-v2-objectif], [data-agv-objectif]').count() === 0, 'Achats (aucun chiffre de vente) : pas d’objectif');
        await aller(pg, 'tab=dashboard', '[data-objectif-bloc]');
        await pg.locator('[data-objectif-bloc] [data-objectif-modifier]').first().click();
        await pg.locator('[data-objectif-bloc] [data-objectif-type="ventes"]').first().click();
        await pg.locator('[data-objectif-bloc] [data-objectif-saisie]').first().fill('4');
        await pg.locator('[data-objectif-bloc] [data-objectif-ok]').first().click();
        await pg.waitForTimeout(400);
        s = await lireStats();
        dit(s && s.type === 'ventes' && s.valeur === '4' && s.pct === '100', 'Nombre de ventes 4 : 4 ventes ce mois (3 Vinted + 1 Leboncoin) ⇒ 100 %', JSON.stringify(s));
        j = await lireJournee();
        dit(j && j.etat === 'lu' && j.pct === '100', 'Aujourd’hui : 4/4 ⇒ 100 %', JSON.stringify(j));
        a = await lireArgent();
        dit(a.recu !== null && (a.recu === '' ? a.anneau === null : !!a.anneau && a.anneau.etat === 'lu' && a.anneau.pct === '100'), 'Argent : 4/4 ⇒ 100 % (reçu lu)', JSON.stringify(a));
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
        console.log('── C. Messages · eBay : les questions dans « Tous »');
        // (26 nov., bancs natifs) Messages s'ouvre toujours sur le fil « Tous » (`FilsTous.jsx`, décision « sans sélecteur »
        // du 20 nov. ; « plus de sélecteur de plateforme », 20 nov. soir : une tâche montre tous ses sites). L'écran
        // Messages · eBay d'avant (`EbayMessages`, vue « Questions » groupée par annonce et navigation 1 · 2) n'est plus
        // joignable : `?tab=ebay_messages` ⇒ Messages (navigationTache.js `redirigerOnglet`). Ses échanges eBay sont dans
        // « Tous » (ajout validé par Julien le 11 nov.), un fil par échange, du plus récent au plus ancien (règle du 12 nov.).
        // Les garanties jugées là : chaque échange par SON identité (`ebay:{compte}:{id}`), le N° par le SKU de SON annonce
        // (VRM-80 / VRM-81), jamais par le titre ; une question : un champ, Envoyer ⇒ SA confirmation ⇒ `repondre` avec
        // `confirme:true` sur CETTE question ; un message qui n'en est pas une : aucun champ, « Voir sur eBay » ; 44 px,
        // contraste d'Envoyer, aucun débordement.
        await aller(pg, 'tab=ebay_messages', '[data-fil^="ebay:"]');
        const L = await pg.evaluate(() => [...document.querySelectorAll('[data-fil^="ebay:"]')].filter((x) => x.getBoundingClientRect().height > 0).map((x) => { const m = x.querySelector('[data-fil-a-repondre]'); const cs = m ? getComputedStyle(m) : null; return { fil: x.getAttribute('data-fil'), num: x.getAttribute('data-fil-num'), nonlu: x.getAttribute('data-nonlu'), aRep: !!(m && m.getClientRects().length), attente: x.getAttribute('data-fil-attente'), fw: cs ? Number(cs.fontWeight) : null, fond: cs ? cs.backgroundColor : null, coul: cs ? cs.color : null, cls: m ? m.className : '' }; }));
        const ids = L.map((x) => x.fil).join(',');
        // (27 nov., Julien) Les QUESTIONS sans réponse d'abord, la plus ANCIENNE en tête (q1 il y a 20 h, puis q2 il y a 3 h) ; le reste
        // garde la règle du 12 nov., du plus récent au plus ancien (q4 qui n'est pas une question, q3 répondue). L'identité ne change pas.
        dit(ids === 'ebay:principal:q1,ebay:principal:q2,ebay:principal:q4,ebay:principal:q3', '« Tous » : un fil par échange eBay, par SON identité ; les questions sans réponse d’abord (la plus ancienne), puis du plus récent au plus ancien', ids);
        dit(L.filter((x) => x.aRep).map((x) => x.fil.split(':')[2]).join(',') === 'q1,q2' && L.filter((x) => x.attente === '1').length === 2, '« À répondre » sur les deux questions sans réponse, et elles seules (ni q4, message sans question, ni q3 répondue)', JSON.stringify(L));
        dit(L.filter((x) => x.aRep).every((x) => x.fw >= 600), '« À répondre » se voit : en gras (le geste à faire, §7)', JSON.stringify(L.filter((x) => x.aRep)));
        const premier = await pg.evaluate(() => { const f = [...document.querySelectorAll('[data-fil]')].filter((x) => x.getBoundingClientRect().height > 0)[0]; return f ? f.getAttribute('data-fil') : ''; });
        dit(premier === 'ebay:principal:q1', '« Tous » : la plus ancienne question sans réponse est en TÊTE de la liste (avant les autres comptes)', premier);
        const num = Object.fromEntries(L.map((x) => [x.fil.split(':')[2], x.num]));
        dit(num.q1 === '80' && num.q2 === '80' && num.q3 === '81' && num.q4 === '81', 'le N° par le SKU de SON annonce (VRM-80, VRM-81)', JSON.stringify(num));
        dit(L.filter((x) => x.nonlu === '1').map((x) => x.fil.split(':')[2]).sort().join(',') === 'q1,q2,q4', 'sans réponse = non lu ; la question répondue (q3) ne l’est pas', JSON.stringify(L));
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `ebay-questions-${nom}.png`) });
        await pg.locator('[data-fil="ebay:principal:q1"]').first().click();
        await pg.locator('[data-fil-ebay="q1"]').first().waitFor({ timeout: 8000 });
        const q = await pg.evaluate(() => { const f = document.querySelector('[data-fil-ebay="q1"]'); return { texte: (f.querySelector('[data-fil-ebay-question]') || {}).innerText || '', champ: !!f.querySelector('[data-fil-ebay-saisie]'), w: Math.round(f.getBoundingClientRect().width) }; });
        dit(q.texte === 'Elle taille grand ?' && q.champ, 'la question 1 ouverte : SON texte, un champ pour répondre', JSON.stringify(q));
        dit(q.w >= (vp.width < 600 ? 360 : 380), 'le fil a la place de se lire (jamais un mot par ligne)', String(q.w));
        await pg.locator('[data-fil-ebay-saisie]').first().fill('Taille normale, prends ta taille habituelle.');
        const petits = await pg.evaluate(() => [...document.querySelectorAll('[data-fil-ebay="q1"] button')].filter((x) => x.getBoundingClientRect().height > 0).map((x) => x.getBoundingClientRect()).filter((r) => r.height < 43.5 || r.width < 43.5).map((r) => `${Math.round(r.width)}x${Math.round(r.height)}`).join(' '));
        dit(petits === '', 'le fil : 44 px au doigt', petits);
        await pg.waitForFunction(() => [...document.querySelectorAll('link[rel=stylesheet]')].every(l => !!l.sheet), null, { timeout: 8000 });
        const envoi = pg.locator('[data-fil-ebay-envoyer]').first();
        // Le remplissage active le bouton : attendre SA transition CSS réelle, pas une durée arbitraire.
        await envoi.evaluate(async b => { void getComputedStyle(b).backgroundColor; await Promise.allSettled(b.getAnimations().map(a => a.finished)); });
        const contraste = await envoi.evaluate(b => {
          const s = getComputedStyle(b), rgb = v => (v.match(/[\d.]+/g) || []).map(Number);
          const lum = v => rgb(v).slice(0, 3).map(x => x / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4).reduce((t, x, i) => t + x * [.2126, .7152, .0722][i], 0);
          let fond = s.backgroundColor, bg = rgb(fond);
          if (!(bg.length === 3 || bg[3] === 1) && /gradient\(/.test(s.backgroundImage || '')) { const m = /rgba?\([^)]*\)/.exec(s.backgroundImage); if (m) { fond = m[0]; bg = rgb(fond); } }
          const a = lum(s.color), c = lum(fond);
          return { ratio: (Math.max(a, c) + .05) / (Math.min(a, c) + .05), couleur: s.color, fond, opaque: bg.length === 3 || bg[3] === 1, actif: !b.disabled };
        });
        dit(contraste.actif && contraste.opaque && contraste.ratio >= 3, 'Envoyer actif : texte contrasté sur un fond opaque', JSON.stringify(contraste));
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `ebay-question-fil-${nom}.png`) });
        dit(!ebayEcrits.length, 'écrire ne part pas : rien n’est envoyé sans son clic');
        await envoi.click();
        const ok = pg.getByRole('button', { name: 'Oui, envoyer' }).last();
        await ok.waitFor({ timeout: 5000 });
        dit(!ebayEcrits.length, 'Envoyer ⇒ SA confirmation d’abord, rien de parti');
        await ok.click();
        await pg.waitForTimeout(800);
        const e = ebayEcrits[0] || {};
        dit(ebayEcrits.length === 1 && e.action === 'repondre' && e.messageId === 'q1' && e.itemId === ITEM_A && e.confirme === true, 'confirmé ⇒ `repondre` sur CETTE question, `confirme:true`', JSON.stringify(ebayEcrits));
        await aller(pg, 'tab=messages', '[data-fil="ebay:principal:q4"]');
        await pg.locator('[data-fil="ebay:principal:q4"]').first().click();
        await pg.locator('[data-fil-ebay-sans-reponse]').first().waitFor({ timeout: 8000 });
        const p = await pg.evaluate(() => { const f = document.querySelector('[data-fil-ebay="q4"]'); const a = f && f.querySelector('[data-pied-ouvrir]'); return { champ: !!(f && f.querySelector('textarea')), lien: a ? a.href : '', h: a ? Math.round(a.getBoundingClientRect().height) : 0 }; });
        dit(!p.champ && p.lien === `https://www.ebay.fr/itm/${ITEM_B}` && p.h >= 44, 'un message qui n’est pas une question : aucun champ, « Voir sur eBay » (44 px)', JSON.stringify(p));
        dit(await deborde(pg) <= 0, 'Messages · eBay : aucun débordement', String(await deborde(pg)));
      });
      dit(!errs.length, 'aucune erreur d’app', errs.join(' | ').slice(0, 300));
      await ctx.close();
    }
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} offres-objectif : ${ko} rouge(s), ${ok} vert(s)`);
  process.exit(ko ? 1 : 0);
})();
