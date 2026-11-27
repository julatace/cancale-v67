// BANC — LA NAVIGATION PAR TÂCHE (31 octobre, décision de Julien : « A · par
// tâche, en améliorant encore » ; puis « réorganiser les onglets… tout peut
// être amélioré »).
//
// Données INVENTÉES (ce banc vit dans le dépôt, qui est public) : un compte
// Vinted, un compte Leboncoin (ses ventes rangées), un compte eBay, des ventes
// Vestiaire. DEUX PAIRES AU MÊME TITRE (« Nike Air Max 90 blanche taille 42 »)
// sont vendues, l'une sur Vinted, l'autre sur Leboncoin : ce sont deux ventes.
// Il juge, à 390 px (tactile) et 1512 px, sur des attributs et des nombres
// rendus, jamais une formulation (§6.4) :
//   A. la barre du bas porte CINQ entrées — Journée, Annonces, Ventes, Colis,
//      Plus — et la colonne de l'ordinateur les tâches puis les groupes ;
//   B. Ventes et Annonces portent la rangée de filtres de site (Toutes ·
//      Vinted · Leboncoin · eBay · Vestiaire pour Ventes ; sans « Toutes »
//      pour Annonces) ; (5 nov., Julien : « les mêmes onglets que Vinted ») les QUATRE sites,
//      un site sans compte estompé dont l'onglet dit ce qui manque (banc plateformes-logo) ;
//   C. le filtre « Vinted » rend les MÊMES contrôles que l'ancien écran Vinted
//      (sélecteur de compte, filtres d'état des ventes, période, résumé) ;
//   D. « Toutes » ne fusionne RIEN : chaque vente est une ligne, sous SON site
//      et SON identité ; les deux paires au même titre font deux lignes ;
//   E. un site illisible (522 sur ses ventes) est NOMMÉ, jamais « 0 » ;
//   F. les anciens liens profonds mènent au bon onglet ET au bon filtre
//      (`plat_vinted`, `cat_ventes`, `cat_annonces`, `plat_leboncoin`,
//      `leboncoin`, `cat_msg`, `ebay_annonces`, `plat_ebay`…) — jamais un écran
//      blanc ; et un écran propre à un site (eBay → À traiter) reste joignable ;
//   G. le filtre choisi est retenu par écran (rouvert après un autre écran) ;
//   H. badge ambre sur Colis quand des colis sont à expédier (nombre publié) ;
//   I. « Plus » : groupés par tâche, rien de la barre du bas en double, aucun
//      groupe vide, aucune entrée d'un site sans compte ;
// (31 oct., soir — « Achats à côté de À retirer », « pas la même chose dans les
// deux onglets », « enlever Plateforme en bas des onglets glissants ») :
//   J. « Plus » (téléphone) n'a PAS de groupe Plateformes ; la colonne
//      (ordinateur, sa maquette) le garde ; dans les deux, « Colis à retirer »
//      et « Achats » sont dans le même groupe, l'un juste sous l'autre ; la
//      colonne tient sans défiler à 900 px de haut, et porte les compteurs
//      PUBLIÉS (colis à poster, colis à retirer) — aucun sans nombre publié ;
//   K. « Colis à retirer » et « Achats » sont deux écrans DISTINCTS : le
//      premier n'a ni onglets d'étapes, ni liste, ni chiffres d'achats ; le
//      second n'a ni « À retirer », ni colis groupés par relais ;
//   L. chaque section propre d'un site est joignable depuis SA tâche :
//      Ventes · eBay (Commandes · À traiter · Offres), Annonces · eBay
//      (Annonces · Promotion), Achats · Leboncoin / eBay / Vestiaire, Colis ·
//      Leboncoin, Annonces · Vestiaire (sa clé Photoroom), Paramètres → Comptes
//      eBay ; et les anciens liens (`plat_ebay&section=…`, `plat_leboncoin&
//      section=colis`, `plat_vestiaire`, `cat_achats`) y mènent.
// ⚠️ (26 nov., bancs natifs) RÉÉCRIT SUR LES ÉCRANS « VRM NATIF » (src/natif/, docs/design/NATIF.md). Ce qui a changé
// depuis, et où chaque garantie est jugée aujourd'hui :
//   · la barre du bas est Aujourd'hui · Annonces · Ventes · Achats · Argent (21 nov., onglets-menu) ; « Plus » est l'écran
//     Menu ouvert par la photo du compte, Messages la bulle en haut à droite (A, H, I, J, Z) ;
//   · les onglets PAR SITE sont retirés (20 nov., fce3155d1, Julien : « enlève les onglets par plateforme, ça ne marche pas
//     du tout ») : Ventes et Achats mélangent leurs sites, chaque rangée sous SON site. B, C et G sont jugés sur le filtre
//     par plateforme d'un onglet (25 nov., `[data-fp]` / `[data-tt-filtre="site"]` ; ses nombres et sa règle : banc
//     filtre-plateformes) ; C (« Vinted = l'écran Vinted d'avant ») disparaît avec ces onglets ; F ne juge plus que l'ÉCRAN
//     et la section d'un ancien lien (le filtre de site est le choix de l'appareil, aucun lien ne l'écrit) ;
//   · D/E sur « Terminées » de Ventes (`[data-toutes-vente]`, les mêmes identités) ; K sur Ventes (À envoyer · En route ·
//     Terminées) et Achats (À retirer en tête) ; L : sections eBay, morceaux d'Achats par site, colis Leboncoin dans
//     « À envoyer », écran Vestiaire (clé Photoroom) par le menu d'actions d'Annonces filtré sur Vestiaire.
// `BANC_PORT` (défaut 8940), `CAPTURES=<dossier>` pour garder les captures,
// `BANC_TAILLE=390|1512` pour une seule taille.
'use strict';
require('./_porte-banc.cjs');
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
const { metaVersData } = require('./_meta.cjs');
const { getPath } = require('./_minipgrest.cjs');
const fs = require('fs'), http = require('http');
// (11 nov.) Le dictionnaire de la langue active (src/i18n/langues/<lang>.js, module ESM) : les libellés se jugent contre lui.
const dicoLangue = async (l) => { const f = path.join(__dirname, '..', '..', 'src', 'i18n', 'langues', (/^(fr|en|es|it|de)$/.test(l) ? l : 'fr') + '.js'); const m = await import(require('url').pathToFileURL(f).href); return m.default || m[Object.keys(m)[0]] || {}; };
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 8940;
const CAPTURES = process.env.CAPTURES || '';

const maintenant = new Date(2026, 9, 31, 15, 30, 0);
const il = (n, h = 12) => { const d = new Date(maintenant); d.setHours(h, 0, 0, 0); d.setDate(d.getDate() - n); return d; };
const UID = '111';
const MEME_TITRE = 'Nike Air Max 90 blanche taille 42';
const vente = (id, titre, prix, statut, d, extra = {}) => ({ transaction_id: id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, status: statut, date: d.toISOString(), ...extra });
const VENTES = [
  vente(7001, MEME_TITRE, 65, 'Le paiement a été validé', il(0, 11), { transaction_user_status: 'needs_action' }),
  vente(7002, 'Adidas Samba OG noir taille 40', 72, 'Commande finalisée', il(2), { transaction_user_status: 'completed' }),
  vente(7003, 'Salomon XT-6 gris taille 43', 110, 'Colis en cours d\'acheminement', il(1), { transaction_user_status: 'waiting' }),
];
const ANNONCES = Array.from({ length: 4 }, (_, k) => ({ id: 6000 + k, title: ['Nike Dunk Low panda taille 38', 'Adidas Gazelle bleu taille 41', 'Salomon XT-4 noir taille 42', 'Asics Gel-1130 blanc taille 40'][k], price: { amount: String(40 + k * 7), currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false, created_at_ts: il(30 + k).toISOString() }));
const ACCOUNTS = [{ id: 1, vinted_user_id: UID, login: 'boutique_demo', domain: 'www.vinted.fr', updated_at: maintenant.toISOString() }];
const cap = maintenant.toISOString();
// Leboncoin : `lbc_ventes.data.ventes` est un OBJET indexé (forme rangée par l'extension).
const LBC_VENTES = {
  'lbc-tx-1': { txId: 'lbc-tx-1', itemId: 900001, isSeller: true, title: MEME_TITRE, price: 7000, dateVente: il(1, 15).toISOString(), stepStatus: 'done', at: il(0, 8).toISOString() },
  'lbc-tx-2': { txId: 'lbc-tx-2', itemId: 900002, isSeller: true, title: 'Asics Gel-1130 blanc taille 40', price: 5500, dateVente: il(4).toISOString(), at: il(0, 8).toISOString(), stepLabel: 'Paiement en attente' },
  'lbc-tx-3': { txId: 'lbc-tx-3', itemId: 900003, isSeller: false, title: 'Un achat', price: 3000, at: il(0, 8).toISOString() },
};
const cmd = (id, prix, titre, d) => ({ orderId: id, creationDate: d.toISOString(), orderPaymentStatus: 'PAID', orderFulfillmentStatus: 'NOT_STARTED', pricingSummary: { priceSubtotal: { value: prix, currency: 'EUR' }, total: { value: prix, currency: 'EUR' } }, lineItems: [{ title: titre, sku: 'VRM-12', legacyItemId: '1234567', quantity: 1 }] });
const LIGNES_BASE = [
  { id: `harvest_${UID}_orders_sold`, data: { capturedAt: cap, payload: { my_orders: VENTES } } },
  { id: `harvest_${UID}_orders_purchased`, data: { capturedAt: cap, payload: { my_orders: [
    vente(8001, 'Nike Dunk Low gris taille 41', 45, 'Commande finalisée', il(6), { transaction_user_status: 'completed' }),
    vente(8002, 'Asics Gel-Kayano 14 argent taille 42', 60, 'Le colis a été déposé au point relais', il(2), { transaction_user_status: 'needs_action' }),
  ] } } },
  { id: `harvest_${UID}_listings`, data: { capturedAt: cap, payload: { items: ANNONCES, pagination: { total_entries: ANNONCES.length } } } },
  { id: 'lbc_ventes', data: { ventes: LBC_VENTES } },
  { id: 'lbc_listings', data: { items: {}, lectures: {} } },
  { id: 'ebay_comptes', data: { comptes: [{ cle: '', pseudo: 'paire_perso', principal: true }] } },
  { id: 'ebay_orders', data: { orders: [cmd('11-0001', '80.00', 'Converse Chuck 70 blanc taille 41', il(3))], capturedAt: cap } },
  { id: 'vrm_colis_aposter_srv', data: {} },
];

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (!c && d ? ' — ' + String(d).slice(0, 300) : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 200)); } };

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });

// `options.lbcPanne` : les ventes Leboncoin répondent 522 (la vraie forme d'une panne).
// `options.sansVestiaire` : aucune ligne Vestiaire (pas de compte) ; sinon des ventes.
// `options.local` : ce que le navigateur porte déjà (filtre retenu, colis publiés).
const ouvrir = async (b, tel, tab, options = {}) => {
  const ctx = await b.newContext(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1512, height: options.hauteur || 950 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: maintenant });
  // (9 nov., lot Z) La pastille de l'icône : on écoute ce que l'app demande au navigateur (API Badging).
  await pg.addInitScript(() => { window.__pastille = []; try { navigator.setAppBadge = (n) => { window.__pastille.push(n); return Promise.resolve(); }; navigator.clearAppBadge = () => { window.__pastille.push(null); return Promise.resolve(); }; } catch (_) {} });
  await pg.addInitScript((loc) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_prenom', JSON.stringify('Julien')); localStorage.setItem('vrm_bascule_mineral_v1', '1'); for (const [k, v] of Object.entries(loc || {})) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); } catch (_) {} }, options.local || {});
  const LIGNES = [...LIGNES_BASE];
  if (!options.sansVestiaire) LIGNES.push({ id: 'vc_ventes', data: { ventes: { 'vc-1': { ref: '80', etat: 'Expédiée', date: il(5).toISOString(), montant: { valeur: 120, devise: 'EUR', cle: 'price' } } }, lectures: {} } }, { id: 'vc_listings', data: { capturedAt: cap, complet: true, liens: { P81: '81' }, items: { P81: { statut: 'on_sale', vuAt: cap, titre: 'Converse Run Star blanche taille 39', compte: 'vcA', prix: 95 } } } });   // (26 nov.) une annonce Vestiaire : Annonces a deux sites, donc son filtre
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) || /^https?:\/\/[^/]*vinted\.net\//i.test(r.request().url()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    if (route.request().method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    if (options.lbcPanne && /id=eq\.lbc_ventes/.test(u)) return route.fulfill({ status: 522, contentType: 'text/html', body: '<html>522</html>' });
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || '';
    const forme = (r) => {
      if (/(^|,)[a-z_]+:data->/i.test(sel)) {
        const o = {};
        for (const champ of sel.split(',')) {
          if (champ === 'id') { o.id = r.id; continue; }
          if (champ === 'data') { o.data = r.data; continue; }
          if (champ === 'updated_at') { o.updated_at = cap; continue; }
          // (6 nov.) Le chemin JSON se lit comme PostgREST (`getPath` du mini PostgREST
          // des bancs : `->>` = texte, absent ⇒ `null`). Le banc lisait
          // `cap:data->>capturedAt` comme la clé « >capturedAt », toujours absente :
          // depuis la lecture projetée des dressings (vitesse 2, `SEL_MOISSON`), le
          // dressing servi n'avait plus de date de lecture — « à confirmer », donc hors
          // des annonces sans numéro de la cloche. Une fiction (§6.3), pas l'app.
          const m = /^([a-z_]+):(data->.+)$/i.exec(champ); if (!m) continue;
          o[m[1]] = getPath(r, m[2]);
        }
        return o;
      }
      if (sel === 'id') return { id: r.id };
      return { ...r, updated_at: cap, cap: r.data.capturedAt };
    };
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1]).map(forme));
    const dans = /id=in\.\(([^)]*)\)/.exec(u);
    if (dans) { const ids = dans[1].split(','); return j(LIGNES.filter((r) => ids.includes(r.id)).map(forme)); }
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/${tab ? '?tab=' + tab : ''}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => document.querySelector('.vrm-main') || /pas pu s'afficher/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
  // (6 nov., « de vrais écrans de chargement ») L'écran attend ses données derrière son
  // squelette (src/AttenteEcran.jsx, au plus ~2,5 s) : on juge l'écran OUVERT, pas son squelette.
  await pg.waitForFunction(() => !document.querySelector('[data-attente="attente"]'), null, { timeout: 10000 }).catch(() => {});
  await pg.waitForTimeout(2800);
  return { ctx, pg, errs };
};
const capture = async (pg, nom) => { if (!CAPTURES) return; try { fs.mkdirSync(CAPTURES, { recursive: true }); await pg.screenshot({ path: path.join(CAPTURES, nom + '.png'), fullPage: false }); } catch (_) {} };
// Ce que l'écran courant dit de lui-même (attributs, jamais un libellé).
// (26 nov., bancs natifs) L'écran montré est `.vrm-main[data-ecran]` ; une section propre d'un site (eBay : À traiter,
// Offres, Promotion) garde `[data-tache][data-tache-section]` et sa sous-rangée `[data-tache-sous]`.
const etat = (pg) => pg.evaluate(() => {
  const m = document.querySelector('.vrm-main');
  const t = [...document.querySelectorAll('[data-tache]')].find((x) => x.getClientRects().length) || document.querySelector('[data-tache]');
  const cur = document.querySelector('[data-tache-sous] [aria-current="page"]');
  return {
    ecran: m ? m.getAttribute('data-ecran') : '',
    section: t ? t.getAttribute('data-tache-section') : '',
    sousActif: cur ? cur.getAttribute('data-section') : '',
    reglageOuvert: [...document.querySelectorAll('[data-sous-ecran]')].filter((x) => !x.hidden).map((x) => x.getAttribute('data-sous-ecran')).join(','),
    blanc: !m || (m.innerText || '').trim().length < 20,
    tombe: /pas pu s'afficher|Cannot access|is not defined/.test(document.body.innerText),
  };
});
// Le filtre de site d'un onglet (25 nov., src/natif/FiltrePlateformes.jsx) : au téléphone la rangée `[data-fp]` montrée,
// à l'ordinateur l'entrée « Site » du menu de filtres du tableau (`[data-tt-filtre="site"]`).
const filtre = (pg, ecran) => pg.evaluate((ecran) => {
  const r = [...document.querySelectorAll(`[data-fp="${ecran}"]`)].find((x) => x.getClientRects().length);
  if (r) return { choix: r.getAttribute('data-fp-choix'), sites: [...r.querySelectorAll('[data-fp-site]')].map((x) => x.getAttribute('data-fp-site')), n: Object.fromEntries([...r.querySelectorAll('[data-fp-site]')].map((x) => [x.getAttribute('data-fp-site'), x.getAttribute('data-fp-n')])) };
  const t = [...document.querySelectorAll('[data-tt-filtre="site"]')].find((x) => x.getClientRects().length);
  return t ? { choix: t.getAttribute('data-tt-filtre-valeur'), sites: null, n: null } : null;
}, ecran);
const toucher = async (pg, tel, sel) => { const l = pg.locator(sel).first(); if (!(await l.count())) return false; await (tel ? l.tap({ timeout: 5000 }) : l.click({ timeout: 5000 })).catch(() => {}); await pg.waitForTimeout(1000);
  await pg.waitForFunction(() => !document.querySelector('nav[data-n-onglets][data-en-cours]'), null, { timeout: 4000 }).catch(() => {}); return true; };
// « Terminées » de Ventes (le segmenté natif) : un toucher pendant le calcul de l'écran peut se perdre — attendu, un 2ᵉ au plus (§6.5).
const terminees = async (pg, tel) => {
  const vu = () => pg.waitForFunction(() => [...document.querySelectorAll('[data-vn-onglet="toutes"]')].some((x) => x.getClientRects().length), null, { timeout: 3000 }).then(() => true).catch(() => false);
  // (27 nov.) Sous charge (quatre bancs à la fois), deux touchers tombaient tous deux pendant le calcul de l'écran (capture :
  // « À envoyer » resté choisi, aucune rangée) : on attend d'abord que le segmenté soit VU, puis jusqu'à quatre touchers,
  // chacun jugé sur l'onglet montré — jamais un délai qui décide à la place de l'écran.
  await pg.waitForFunction(() => [...document.querySelectorAll('[data-colis-onglet-choix="toutes"]')].some((x) => x.getClientRects().length), null, { timeout: 15000 }).catch(() => {});
  for (let k = 0; k < 4; k++) { await toucher(pg, tel, '[data-colis-onglet-choix="toutes"]:visible'); if (await vu()) return true; }
  return false;
};
const lignesToutes = (pg) => pg.evaluate(() => [...document.querySelectorAll('[data-toutes-vente]')].filter((r) => r.getClientRects().length).map((r) => ({
  site: r.getAttribute('data-toutes-vente'), id: r.getAttribute('data-toutes-id'), texte: r.innerText || '',
  num: (r.querySelector('.n-plaque-numero') || { textContent: '' }).textContent.trim() })));

(async () => {
  await new Promise((res) => srv.listen(PORT, res));
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader'] });
  try {
    // `BANC_TAILLE=390` ou `1512` : une seule taille (preuves par mutation, plus courtes).
    const TAILLES = process.env.BANC_TAILLE === '390' ? [true] : process.env.BANC_TAILLE === '1512' ? [false] : [true, false];
    const PLATEFORMES = /^(plat_|ebay_|vinted$|leboncoin$|ebay$|vestiaire$)/;
    for (const tel of TAILLES) {
      const qui = tel ? '390 px' : '1512 px';
      console.log(`── ${qui} : A. la navigation`);
      await essaie(`${qui} : navigation`, async () => {
        const { ctx, pg, errs } = await ouvrir(b, tel, 'journee', { local: { vrm_colis_aposter: { total: 2, enRetard: 0, vinted: 2, ebay: 0, at: maintenant.getTime() }, vrm_colis_retirer: { total: 3, prets: 3, sansCode: 0, aVerifier: 0, urgents: 0, at: maintenant.getTime() } } });
        const pub = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_colis_aposter')).total; } catch (_) { return null; } });
        if (tel) {
          // ⚠️ (26 nov., bancs natifs) LA BARRE NATIVE (NATIF.md §2 ; 21 nov., Julien : « garde les onglets ») : Aujourd'hui ·
          // Annonces · Ventes · Achats · Argent — plus de « Plus » (le Menu s'ouvre par la photo du compte, en haut à droite).
          const barre = await pg.evaluate(() => [...document.querySelectorAll('nav[data-n-onglets] > .n-onglet')].map((x) => ({ lib: (x.querySelector('.n-onglet-libelle') || x).innerText.trim(), h: Math.round(x.getBoundingClientRect().height), entree: x.getAttribute('data-nav-entree') || '', n: (x.querySelector('.n-onglet-pastille') || { textContent: '' }).textContent.trim() })));
          // Les libellés passent par tr() : jugés contre le dictionnaire de la langue ACTIVE (src/i18n/langues/<lang>.js).
          const langue = await pg.evaluate(() => (document.documentElement.getAttribute('lang') || 'fr').slice(0, 2));
          const dico = await dicoLangue(langue);
          const attendu = ['nav.journee.court', 'nav.annonces', 'nav.ventes', 'nav.achats', 'nav.compta'].map((k) => dico[k]);
          dit(barre.map((x) => x.entree).join('|') === 'journee|paires|ventes|achats|compta' && attendu.every(Boolean) && barre.map((x) => x.lib).join('|') === attendu.join('|'), `A. la barre du bas : Aujourd’hui · Annonces · Ventes · Achats · Argent (21 nov., onglets-menu ; langue ${langue})`, JSON.stringify({ barre, attendu }));
          dit(barre.length === 5 && barre.every((x) => x.h >= 44), 'A. chaque onglet ≥ 44 px', JSON.stringify(barre.map((x) => x.h)));
          const nVentes = (barre.find((x) => x.entree === 'ventes') || {}).n || '';
          dit(nVentes !== '' && nVentes === String(pub) && Number(nVentes) > 0, 'H. pastille de Ventes (colis à poster) = le nombre PUBLIÉ (`vrm_colis_aposter`), jamais recalculé', JSON.stringify({ n: nVentes, pub }));
          // (9 nov., lot Z) L'icône de VRM porte LE MÊME nombre (dernière demande au navigateur).
          const pastille = await pg.evaluate(() => (window.__pastille || []).slice(-1)[0]);
          dit(nVentes !== '' && pastille === Number(nVentes), 'Z. pastille de l\'icône de VRM = la pastille des colis à poster', JSON.stringify({ pastille, n: nVentes }));
          dit(await pg.evaluate(() => !!document.querySelector('[data-n-coque-messages]')), 'I. Messages à un toucher : la bulle en haut à droite (21 nov. : plus dans le Menu)');
          // Le MENU (l'ancien « Plus ») : la photo du compte ouvre l'écran Menu.
          // (27 nov.) Sous charge (police CI), le toucher sur la photo se perdait pendant le calcul de l'écran (capture : Aujourd'hui
          // resté affiché) : jusqu'à trois touchers, chacun jugé sur le Menu MONTRÉ (§6.5), jamais sur un délai.
          for (let k = 0; k < 3; k++) { await toucher(pg, tel, '[data-n-coque-compte]:visible');
            if (await pg.waitForFunction(() => !!document.querySelector('[data-n-menu]'), null, { timeout: 5000 }).then(() => true).catch(() => false)) break; }
          const f =await pg.evaluate(() => { const m = document.querySelector('[data-n-menu]'); if (!m) return null;
            return { ecran: document.querySelector('.vrm-main').getAttribute('data-ecran'), groupes: [...m.querySelectorAll('[data-n-menu-groupe]')].map((g) => ({ t: g.getAttribute('data-n-menu-groupe'), n: g.querySelectorAll('[data-n-plus-entree]').length, ids: [...g.querySelectorAll('[data-n-plus-entree]')].map((e) => e.getAttribute('data-nav-entree') || e.getAttribute('data-n-plus-entree')) })),
              entrees: [...m.querySelectorAll('[data-n-plus-entree]')].map((e) => e.getAttribute('data-nav-entree') || e.getAttribute('data-n-plus-entree')),
              petits: [...m.querySelectorAll('[data-n-plus-entree]')].filter((e) => e.getBoundingClientRect().height < 44).length,
              compte: (() => { const c = m.querySelector('[data-profil-tete][data-nav-entree="settings"]'); return !!c && !c.closest('[data-n-menu-groupe]'); })() }; });
          await capture(pg, 'menu-telephone');
          dit(!!f && f.ecran === 'menu' && f.groupes.length >= 2, 'J. la photo du compte ouvre le Menu, groupé (Gestion · Dans l’extension · Aide)', JSON.stringify(f && f.groupes));
          dit(!!f && !f.entrees.some((x) => PLATEFORMES.test(x)), 'J. aucune entrée de site dans le Menu (décision du 8 nov. ; fce3155d1 : plus de sélecteur de plateforme)', JSON.stringify(f && f.entrees));
          dit(!!f && f.groupes.every((g) => g.n > 0), 'I. aucun groupe vide', JSON.stringify(f && f.groupes));
          dit(!!f && !['journee', 'annonces', 'ventes', 'achats', 'compta', 'paires', 'messages'].some((x) => f.entrees.includes(x)), 'I. rien de la barre du bas (ni la bulle Messages) en double dans le Menu', JSON.stringify(f && f.entrees));
          dit(!!f && new Set(f.entrees).size === f.entrees.length, 'I. aucune entrée deux fois', JSON.stringify(f && f.entrees));
          dit(!!f && ['garage', 'emails', 'communaute'].every((x) => f.entrees.includes(x)) && !(f.groupes.find((g) => g.t === 'gestion') || { ids: [] }).ids.includes('compta'), 'I. le Menu porte Stock, E-mails, Communauté (Argent est dans la barre, lot AO puis 21 nov.)', JSON.stringify(f && f.groupes));
          dit(!!f && f.compte && f.entrees.filter((x) => x === 'settings').length === 1, 'I. au téléphone, Paramètres derrière la photo du profil : la carte du compte, en tête du Menu, une fois', JSON.stringify(f && { compte: f.compte }));
          dit(!!f && f.petits === 0, 'I. entrées ≥ 44 px', String(f && f.petits));
        } else {
          // ⚠️ (26 nov., bancs natifs) LA COLONNE NATIVE (src/natif/BarreLaterale.jsx, App.jsx `LateraleNative`, 21 nov. onglets-menu) :
          // en tête les cinq onglets de la barre du téléphone, puis Gestion · Dans l'extension · Aide ; Paramètres = la carte du compte au pied.
          await pg.waitForFunction(() => document.querySelector('[data-n-laterale] [data-n-entree="ventes"] .n-pastille'), null, { timeout: 15000 }).catch(() => {});
          const col = await pg.evaluate(() => { const s = document.querySelector('[data-n-laterale]'); if (!s) return null; const liste = s.querySelector('.n-laterale-liste');
            return { groupes: [...liste.querySelectorAll('.n-laterale-groupe')].map((g) => ({ titre: !!g.querySelector('.n-laterale-titre'), ids: [...g.querySelectorAll('[data-n-entree]')].map((e) => e.getAttribute('data-n-entree')) })),
              nombres: Object.fromEntries([...liste.querySelectorAll('[data-n-entree]')].map((e) => [e.getAttribute('data-n-entree'), (e.querySelector('.n-pastille') || { textContent: '' }).textContent.trim()]).filter(([, n]) => n !== '')),
              pied: !!s.querySelector('.n-laterale-pied [data-nav-compte][data-nav-entree="settings"]') };
          });
          await capture(pg, 'colonne-ordinateur');
          const toutes = col ? col.groupes.flatMap((g) => g.ids) : [];
          dit(!!col && (col.groupes[0] || { ids: [] }).ids.join('|') === 'journee|annonces|ventes|achats|compta', 'A. la colonne : en tête Aujourd’hui · Annonces · Ventes · Achats · Argent (les onglets du téléphone, 21 nov.)', JSON.stringify(col && col.groupes));
          dit(!!col && col.groupes.slice(1).length >= 2 && col.groupes.slice(1).every((g) => g.titre && g.ids.length > 0) && !toutes.some((x) => PLATEFORMES.test(x)), 'A/J. puis des groupes titrés, jamais vides — aucune entrée par plateforme (8 nov., fce3155d1)', JSON.stringify(col && col.groupes));
          dit(new Set(toutes).size === toutes.length && !toutes.includes('settings') && !!col && col.pied, 'A. aucune entrée deux fois ; Paramètres = la carte du compte, au pied de la colonne', JSON.stringify({ toutes, pied: col && col.pied }));
          dit(!!col && ['garage', 'messages', 'emails', 'communaute'].every((x) => toutes.includes(x)), 'J. la colonne porte Stock, Messages, E-mails, Communauté', toutes.join('|'));
          // (21 nov., onglets-menu) UNE source par pastille, la même sur tous les écrans : Ventes = à poster, Achats = à retirer
          // (`badgesStables`) ; Annonces ne porte plus de nombre (pas un geste) ; rien sans nombre publié.
          const pubR = await pg.evaluate(() => { try { return String(JSON.parse(localStorage.getItem('vrm_colis_retirer')).total); } catch (_) { return null; } });
          dit(!!col && col.nombres.ventes === String(pub) && Number(pub) > 0, 'H. pastille de Ventes (colonne) = le nombre publié des colis à poster', JSON.stringify({ n: col && col.nombres, pub }));
          dit(!!col && Object.keys(col.nombres).every((k) => (k === 'ventes' && col.nombres[k] === String(pub)) || (k === 'achats' && col.nombres[k] === pubR)), 'J. aucun compteur sans nombre publié (Annonces, Messages, sites : rien) ; Achats = les colis à retirer publiés', JSON.stringify({ n: col && col.nombres, pubR }));
        }
        dit(errs.length === 0, `${qui} : aucune erreur`, errs.join(' | '));
        await ctx.close();
      });

      // (20 nov., fce3155d1 — Julien : « enlève les onglets par plateforme, ça ne marche pas du tout ») Ventes est UNE liste
      // mélangée, chaque rangée sous le logo de son site ; le « filtre Vinted = l'écran Vinted d'avant » (C) a disparu avec
      // les onglets par site. Ce qui reste à garantir ici : rien n'est fusionné, chaque vente sous SON identité.
      console.log(`── ${qui} : D/E. « Terminées » ne fusionne rien`);
      await essaie(`${qui} : toutes`, async () => {
        const { ctx, pg, errs } = await ouvrir(b, tel, 'ventes');
        const ok = await terminees(pg, tel);
        await pg.waitForFunction(() => { const x = document.querySelector('[data-ventes-toutes]'); return x && x.getAttribute('data-ventes-toutes') === 'lu'; }, null, { timeout: 8000 }).catch(() => {});
        await pg.waitForTimeout(600);
        await capture(pg, `ventes-toutes-${tel ? 'tel' : 'ordi'}`);
        const rows = await lignesToutes(pg);
        const memes = rows.filter((r) => r.texte.includes(MEME_TITRE));
        const parSite = rows.reduce((m, r) => { m[r.site] = (m[r.site] || 0) + 1; return m; }, {});
        const ids = rows.map((r) => r.site + ':' + r.id);
        dit(ok && memes.length === 2 && memes.some((r) => r.site === 'vinted' && r.id === '7001') && memes.some((r) => r.site === 'leboncoin' && r.id === 'lbc-tx-1'), 'D. deux paires au même titre sur deux sites = DEUX lignes, chacune sous son site', JSON.stringify(memes.map((r) => r.site + ':' + r.id)));
        dit(parSite.vinted === 3 && parSite.leboncoin === 2 && parSite.ebay === 1 && parSite.vestiaire === 1, 'D. chaque vente lue est une ligne (3 Vinted, 2 Leboncoin — l’achat n’en est pas une —, 1 eBay, 1 Vestiaire)', JSON.stringify(parSite));
        dit(new Set(ids).size === ids.length, 'D. aucune ligne en double', ids.join(' '));
        // §5 : le N° d'une vente vient de SON identité (référence Vestiaire 80) ; la vente Leboncoin qui porte le MÊME titre
        // qu'une vente Vinted ne prend JAMAIS son numéro (aucune ressemblance). Le SKU eBay « VRM-12 » : AUCUNE fiche de ce
        // jeu ne porte le N°12 ⇒ il ne désigne personne (règle du 20 oct., `numEbayLu` : « l'annonce ne désigne personne »,
        // mesuré chez Julien avec VRM-48) — un blanc, jamais un N° que rien ne porte.
        const nums = Object.fromEntries(rows.map((r) => [r.site + ':' + r.id, r.num]));
        const numV = nums['vinted:7001'] || '';
        dit(nums['ebay:11-0001'] === '' && nums['vestiaire:vc-1'] === '80' && (!nums['leboncoin:lbc-tx-1'] || nums['leboncoin:lbc-tx-1'] !== numV), 'D. le N° seulement par identité (référence Vestiaire ; un SKU eBay qu’aucune fiche ne porte reste blanc) — jamais par le titre d’une autre vente', JSON.stringify(nums));
        dit(ids[0] === 'vinted:7001', 'D. triées par date, la plus récente d’abord', ids.join(' '));
        dit(errs.length === 0, `${qui} : aucune erreur`, errs.join(' | '));
        await ctx.close();
      });
      await essaie(`${qui} : panne leboncoin`, async () => {
        const { ctx, pg } = await ouvrir(b, tel, 'ventes', { lbcPanne: true, sansVestiaire: true });
        await terminees(pg, tel);
        await pg.waitForTimeout(800);
        const p = await pg.evaluate(() => ({ etat: (document.querySelector('[data-toutes-etat-site="leboncoin"]') || { getAttribute: () => '' }).getAttribute('data-etat'),
          pied: ((document.querySelector('[data-tt-pied]') || { innerText: '' }).innerText || '').trim().length,
          lbc: [...document.querySelectorAll('[data-toutes-vente="leboncoin"]')].length }));
        const fl = await filtre(pg, 'ventes');
        // Au téléphone l'état de chaque site est une ligne `[data-toutes-etat-site]` ; à l'ordinateur, le pied du tableau la porte.
        dit((tel ? p.etat === 'pas-su' : p.pied > 0) && p.lbc === 0, 'E. ventes Leboncoin en 522 : le site est NOMMÉ « pas lu », aucune ligne inventée', JSON.stringify(p));
        // Le 8 novembre : un site sans compte ni ligne ne prend pas de place (src/filtrePlateforme.js : pas d'entrée sans ligne).
        dit(!fl || !fl.sites || !fl.sites.includes('vestiaire'), 'B. Vestiaire sans compte ni vente : aucune entrée dans le filtre', JSON.stringify(fl));
        await ctx.close();
      });

      // (25 nov.) Le filtre par plateforme d'un onglet (sa règle et ses nombres : banc filtre-plateformes) : ici, qu'il existe sur
      // Ventes et Annonces, qu'un site choisi ne montre QUE ses lignes, et qu'il est retenu par écran.
      console.log(`── ${qui} : B/G. le filtre de site, retenu par écran`);
      await essaie(`${qui} : filtre ventes`, async () => {
        const { ctx, pg, errs } = await ouvrir(b, tel, 'ventes');
        await terminees(pg, tel);
        let fl = await filtre(pg, 'ventes');
        dit(!!fl && fl.choix === 'toutes' && (!tel || fl.sites.join('|') === 'toutes|vinted|leboncoin|ebay|vestiaire'), 'B. Ventes : Toutes · Vinted · Leboncoin · eBay · Vestiaire, sur « Toutes » (rien de retenu)', JSON.stringify(fl));
        if (tel) {
          await toucher(pg, tel, '[data-fp="ventes"] [data-fp-site="leboncoin"]');
          const rows = await lignesToutes(pg); fl = await filtre(pg, 'ventes');
          dit(fl && fl.choix === 'leboncoin' && rows.length === 2 && rows.every((r) => r.site === 'leboncoin'), 'C. « Leboncoin » ne montre QUE ses ventes', JSON.stringify(rows.map((r) => r.site + ':' + r.id)));
          await toucher(pg, tel, 'nav[data-n-onglets] [data-nav-entree="achats"]');
          await toucher(pg, tel, 'nav[data-n-onglets] [data-nav-entree="ventes"]');
          await terminees(pg, tel);
          fl = await filtre(pg, 'ventes');
          dit(!!fl && fl.choix === 'leboncoin', 'G. Ventes rouvre sur le dernier filtre choisi (Leboncoin)', JSON.stringify(fl));
        }
        dit(errs.length === 0, `${qui} : aucune erreur`, errs.join(' | '));
        await ctx.close();
      });
      await essaie(`${qui} : filtre retenu à froid`, async () => {
        const { ctx, pg } = await ouvrir(b, tel, 'ventes', { local: { vrm_filtre_plateformes: { ventes: 'ebay' } } });
        await terminees(pg, tel);
        const fl = await filtre(pg, 'ventes');
        const rows = await lignesToutes(pg);
        dit(!!fl && fl.choix === 'ebay' && rows.length > 0 && rows.every((r) => r.site === 'ebay'), 'G. le filtre retenu (eBay) survit à un rechargement', JSON.stringify({ fl, rows: rows.map((r) => r.site) }));
        await ctx.close();
      });
      if (tel) await essaie(`${qui} : filtre annonces`, async () => {
        const { ctx, pg, errs } = await ouvrir(b, tel, 'annonces');
        let fl = await filtre(pg, 'annonces');
        dit(!!fl && fl.sites.includes('vinted') && fl.sites.includes('vestiaire') && fl.choix === 'toutes', 'B. Annonces : un filtre par site présent (Vinted, Vestiaire), sur « Toutes »', JSON.stringify(fl));
        await toucher(pg, tel, '[data-fp="annonces"] [data-fp-site="vestiaire"]');
        await toucher(pg, tel, 'nav[data-n-onglets] [data-nav-entree="achats"]');
        await toucher(pg, tel, 'nav[data-n-onglets] [data-nav-entree="paires"]');
        fl = await filtre(pg, 'annonces');
        dit(!!fl && fl.choix === 'vestiaire', 'G. Annonces rouvre sur le dernier filtre choisi (Vestiaire)', JSON.stringify(fl));
        // L. Annonces · Vestiaire : l'écran du site (sa clé Photoroom — jamais les Paramètres, décision du 17 oct.) est à deux touchers.
        await toucher(pg, tel, '[data-eg-actions]');
        await toucher(pg, tel, '[data-eg-ecran-site="vestiaire"]');
        await pg.locator('[data-photoroom-cle]').first().waitFor({ timeout: 10000 }).catch(() => {});
        const v = await pg.evaluate(() => ({ cle: document.querySelectorAll('[data-photoroom-cle], [data-photoroom-bloc]').length, ecran: document.querySelector('.vrm-main').getAttribute('data-ecran') }));
        await capture(pg, 'annonces-vestiaire-tel');
        dit(v.cle > 0 && v.ecran === 'annonces', 'L. Annonces · Vestiaire : l’écran du site porte la clé Photoroom (jamais les Paramètres)', JSON.stringify(v));
        dit(errs.length === 0, `${qui} : aucune erreur`, errs.join(' | '));
        await ctx.close();
      });

      // (11 nov., lot DJ3) Les colis à envoyer vivent dans Ventes, les colis à retirer en tête d'Achats.
      console.log(`── ${qui} : K. À envoyer dans Ventes, À retirer dans Achats`);
      await essaie(`${qui} : colis à retirer`, async () => {
        const { ctx, pg, errs } = await ouvrir(b, tel, 'cat_bord');
        const f = await pg.evaluate(() => ({ ecran: document.querySelector('.vrm-main').getAttribute('data-ecran'), choix: [...new Set([...document.querySelectorAll('[data-colis-onglet-choix]')].filter((x) => x.getClientRects().length).map((x) => x.getAttribute('data-colis-onglet-choix')))].join('|') }));
        dit(f.ecran === 'ventes' && f.choix === 'envoyer|envoyes|toutes', 'K. (lot DJ3) ?tab=cat_bord ⇒ Ventes : À envoyer · En route · Terminées (« À retirer » vit dans Achats)', JSON.stringify(f));
        await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:aller', { detail: '?tab=retraits' })));
        await pg.locator('[data-colis-section="achats"]').first().waitFor({ timeout: 30000 }); await pg.waitForTimeout(1500);
        await capture(pg, `retraits-${tel ? 'tel' : 'ordi'}`);
        const r = await pg.evaluate(() => { const s = document.querySelector('[data-colis-section="achats"]');
          return { ecran: document.querySelector('.vrm-main').getAttribute('data-ecran'), onglet: s ? (s.closest('[data-colis-onglet]') || s.querySelector('[data-colis-onglet]') || document.querySelector('[data-colis-onglet]') || { getAttribute: () => '' }).getAttribute('data-colis-onglet') : '',
            r8002: [...document.querySelectorAll('[data-colis-ident="r:v:8002"]')].filter((x) => x.getClientRects().length).length }; });
        dit(r.ecran === 'achats' && r.onglet === 'retirer', 'K. (lot DJ3) ?tab=retraits ⇒ Achats, « À retirer » en tête', JSON.stringify(r));
        dit(r.r8002 === 1, 'K. l’achat 8002 (au point relais) est montré UNE fois, sous son identité', JSON.stringify(r));
        dit(errs.length === 0, `${qui} : aucune erreur`, errs.join(' | '));
        await ctx.close();
      });
      // (20 nov. soir, fce3155d1) Achats mélange ses sites : sous Vinted, chaque autre site relié a SON morceau (monté, même vide).
      await essaie(`${qui} : achats`, async () => {
        const { ctx, pg, errs } = await ouvrir(b, tel, 'achats');
        // La liste d'Achats se monte après ses lectures : on attend ses onglets (§6.5, jamais un délai fixe seul), 10 s au plus.
        await pg.waitForFunction(() => document.querySelectorAll('[data-achats-onglet]').length > 0, null, { timeout: 10000 }).catch(() => {});
        await pg.waitForTimeout(800);
        await capture(pg, `achats-${tel ? 'tel' : 'ordi'}`);
        const a = await pg.evaluate(() => ({ ecran: document.querySelector('.vrm-main').getAttribute('data-ecran'),
          morceaux: [...document.querySelectorAll('[data-achats-morceau]')].map((x) => x.getAttribute('data-achats-morceau')),
          lbc: document.querySelectorAll('[data-achats-morceau="leboncoin"] [data-lbc-achat], [data-achats-morceau="leboncoin"] [data-lbc-achats-vide]').length,
          section: (document.querySelector('[data-colis-section]') || { getAttribute: () => '' }).getAttribute('data-colis-section'),
          onglets: [...document.querySelectorAll('[data-achats-onglet]')].map((x) => x.getAttribute('data-achats-onglet')) }));
        dit(a.ecran === 'achats' && a.section === 'achats', 'K. ?tab=achats ouvre Achats, « À retirer » en tête', JSON.stringify(a));
        // Au téléphone la liste a ses onglets ; à l'ordinateur elle est le tableau de travail (src/natif/TableauTravail.jsx :
        // l'état de chaque achat est une colonne et un filtre « Statut », plus des onglets) — « À retirer » reste en tête (ci-dessus).
        if (tel) dit(['route', 'recus', 'all'].every((x) => a.onglets.includes(x)) && !a.onglets.includes('retirer'), 'K. la liste d’Achats : En route · Reçus · Tous — pas d’« À retirer » (il est en tête)', a.onglets.join('|'));
        else dit(await pg.evaluate(() => !!document.querySelector('[data-tt-tableau]')) && !a.onglets.includes('retirer'), 'K. la liste d’Achats (ordinateur) : le tableau de travail, sans onglet « À retirer » (il est en tête)', a.onglets.join('|'));
        dit(['vinted', 'leboncoin', 'ebay', 'vestiaire'].every((x) => a.morceaux.includes(x)), 'L. Achats : les achats de chaque site (Vinted · Leboncoin · eBay · Vestiaire) ont leur place', JSON.stringify(a.morceaux));
        dit(a.lbc > 0, 'L. Achats · Leboncoin rend les achats de ce site', JSON.stringify(a));
        dit(errs.length === 0, `${qui} : aucune erreur`, errs.join(' | '));
        await ctx.close();
      });

      console.log(`── ${qui} : L. chaque section de site joignable`);
      for (const [lien, tache, section] of [['plat_ebay&section=agent', 'ventes', 'agent'], ['plat_ebay&section=offres', 'ventes', 'offres'], ['plat_ebay&section=promo', 'annonces', 'promo']]) {
        await essaie(`${qui} : ${lien}`, async () => {
          const { ctx, pg, errs } = await ouvrir(b, tel, lien);
          const e = await etat(pg);
          const t = await pg.evaluate(() => { const x = [...document.querySelectorAll('[data-tache]')].find((y) => y.getClientRects().length); return x ? x.innerText.trim().length : 0; });
          dit(e.ecran === tache && e.section === section && e.sousActif === section && t > 10 && !e.tombe && errs.length === 0, `L. ${tache} · eBay · ${section} rendu, sa sous-rangée allumée`, JSON.stringify({ e, t }));
          await ctx.close();
        });
      }
      await essaie(`${qui} : colis leboncoin`, async () => {
        const { ctx, pg, errs } = await ouvrir(b, tel, 'plat_leboncoin&section=colis');
        const e = await etat(pg);
        const rangs = await pg.evaluate(() => [...document.querySelectorAll('[data-vn-rang]')].filter((x) => x.getClientRects().length).map((x) => x.getAttribute('data-vn-rang')));
        dit(e.ecran === 'ventes' && rangs.some((x) => x.startsWith('l:')), 'L. ?tab=plat_leboncoin&section=colis ⇒ Ventes, « À envoyer » montre le colis Leboncoin (sous son identité)', JSON.stringify({ e: e.ecran, rangs }));
        dit(errs.length === 0, `${qui} : aucune erreur`, errs.join(' | '));
        await ctx.close();
      });
      if (!tel) await essaie('1512×900 : la colonne tient sans défiler', async () => {
        const { ctx, pg } = await ouvrir(b, false, 'journee', { hauteur: 900 });
        const h = await pg.evaluate(() => { const s = document.querySelector('[data-n-laterale]'); if (!s) return null; const z = s.querySelector('.n-laterale-liste'); const der = [...z.querySelectorAll('[data-n-entree]')].pop(); const prof = s.querySelector('[data-nav-compte]');
          return { sh: z.scrollHeight, ch: z.clientHeight, bas: Math.round(der.getBoundingClientRect().bottom), der: der.getAttribute('data-n-entree'), profil: prof ? Math.round(prof.getBoundingClientRect().bottom) : null, vh: innerHeight }; });
        await capture(pg, 'colonne-900');
        dit(!!h && h.sh <= h.ch + 1 && h.bas <= h.vh && h.profil != null && h.profil <= h.vh, 'J. à 900 px de haut, toute la colonne se voit sans défiler (la dernière entrée et la carte du compte — Paramètres — visibles)', JSON.stringify(h));
        await ctx.close();
      });

      // F. Les anciens liens : le bon ÉCRAN, jamais un écran blanc ; une section propre d'un site garde sa section.
      // ⚠️ (26 nov.) La part « et le bon filtre de site » de ces liens est RETIRÉE avec les onglets par site (20 nov.,
      // fce3155d1 : « enlève les onglets par plateforme ») ; le filtre d'aujourd'hui (25 nov.) est le choix de CET appareil,
      // qu'aucun lien n'écrit (même règle que Messages, `choixSeul`).
      console.log(`── ${qui} : F. les anciens liens profonds`);
      const LIENS = [
        ['plat_vinted', { ecran: 'ventes' }], ['cat_ventes', { ecran: 'ventes' }], ['cat_annonces', { ecran: 'annonces' }], ['vinted_annonces', { ecran: 'annonces' }],
        ['plat_leboncoin', { ecran: 'ventes' }], ['leboncoin', { ecran: 'annonces' }], ['plat_ebay', { ecran: 'ventes' }], ['ebay_annonces', { ecran: 'annonces' }],
        ['cat_msg', { ecran: 'messages' }], ['ebay_messages', { ecran: 'messages' }], ['ebay_agent', { ecran: 'ventes', section: 'agent' }], ['plat_vestiaire', { ecran: 'annonces' }],
        ['plat_ebay&section=offres', { ecran: 'ventes', section: 'offres' }], ['plat_ebay&section=achats', { ecran: 'achats' }], ['plat_ebay&section=compte', { reglage: 'ebay' }],
        ['plat_leboncoin&section=achats', { ecran: 'achats' }], ['plat_vinted&section=achats', { ecran: 'achats' }],
        ['cat_achats', { ecran: 'achats' }], ['retraits', { ecran: 'achats' }], ['achats', { ecran: 'achats' }], ['cat_bord', { ecran: 'ventes' }],
      ];
      for (const [id, attendu] of LIENS) {
        await essaie(`${qui} : ?tab=${id}`, async () => {
          const { ctx, pg, errs } = await ouvrir(b, tel, id);
          const e = await etat(pg);
          let bon;
          if (attendu.reglage) bon = e.ecran === 'settings' && e.reglageOuvert === attendu.reglage && await pg.evaluate(() => { const x = document.querySelector('[data-sous-ecran="ebay"]'); return !!(x && !x.hidden && x.querySelector('[data-ebay-compte-section]')); });
          else bon = e.ecran === attendu.ecran && (!attendu.section || (e.section === attendu.section && e.sousActif === attendu.section));
          dit(bon && !e.blanc && !e.tombe && errs.length === 0, `F. ?tab=${id} → ${JSON.stringify(attendu)}`, JSON.stringify({ ...e, errs }));
          await ctx.close();
        });
      }
    }
  } catch (e) { dit(false, 'banc', String(e.message || e).slice(0, 200)); }
  finally { await b.close(); srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} navigation par tâche : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
