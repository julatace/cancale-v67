// BANC — TOUS LES BOUTONS, TOUS LES ÉCRANS (1er nov., Julien : « continue à
// regarder la cohérence de tous les onglets, de chaque bouton »).
//
// Données INVENTÉES (le dépôt est public) — mêmes formes que
// `navigation-tache.cjs` : un compte Vinted, un compte Leboncoin, un compte
// eBay, des ventes Vestiaire. AUCUNE écriture n'a d'effet : les routes
// `rest/v1` en écriture et `/api/**` sont répondues par le banc (rien ne part),
// `window.open`, `print`, le presse-papier et les boîtes natives sont
// interceptés ; une confirmation n'est JAMAIS acceptée — une feuille ouverte
// par un clic est seulement refermée (Échap, toucher à côté, retour).
//
// À 390 px (tactile) et 1512 px, il ouvre CHAQUE entrée de navigation (la
// colonne, la barre du bas, « Plus »), chaque filtre de site et sous-onglet
// (Annonces, Ventes, Messages, Achats, Colis), Stock, Statistiques,
// Comptabilité, Paramètres et CHACUN de ses panneaux, Republier, Favoris &
// offres, Communauté, Comptes liés, Achats masqués, Organisation, Ma journée et
// sa Tournée ; sur chaque écran il énumère TOUT ce qui se clique (button, a,
// [role=button], [onclick], summary) et le clique, un par un. Pour chacun :
//   E1 erreur JS (pageerror) ;            E2 écran tombé sur le garde-fou / blanc ;
//   E3 onglet inconnu (aucun écran monté pour l'identifiant atteint) ;
//   E4 bouton mort (rien ne bouge : ni DOM, ni écran, ni requête, ni focus,
//      ni défilement, ni fenêtre, ni presse-papier) ;
//   E5 lien cassé (href vide, « # », javascript:) ;
//   E6 feuille qui ne se ferme pas (ni Échap, ni à côté, ni retour) —
//      et, à part, « Échap ne la ferme pas » sur ordinateur ;
//   E7 texte ↔ destination (un bouton qui nomme un écran et en ouvre un autre) ;
//   E8 nom d'écran hors de celui de la colonne (« Réglages » pour
//      Paramètres, « Stats » pour Statistiques…) ;
//   E9 cible < 44 px au téléphone ;     E10 désactivé sans raison dite ;
//   E11 (ordinateur, 1512×1000 → 1280×560) une entrée de la colonne à moitié visible ;
//   E12 un site où il a un compte absent des filtres de Colis (même règle qu'Annonces/Ventes).
// Juge des attributs, des nombres et l'écran atteint (`history.state.vrmTab`),
// jamais l'orthographe d'un bouton — sauf E7/E8, dont c'est l'objet.
//
// Réglages : `BANC_PORT` (défaut 9150), `BANC_TAILLE=390|1512`,
// `BANC_ECRANS=<regex>` (écrans à visiter), `MAX_PAR_ECRAN` (défaut 120),
// `RAPPORT=<fichier.json>`, `CAPTURES=<dossier>` (capture de chaque défaut).
// Sortie non nulle s'il reste un défaut hors des EXCEPTIONS ci-dessous.
'use strict';
require('./_porte-banc.cjs');
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
const { metaVersData } = require('./_meta.cjs');
const { getPath } = require('./_minipgrest.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT) || 9150;
const CAPTURES = process.env.CAPTURES || '';
const RAPPORT = process.env.RAPPORT || '';
const MAX = Number(process.env.MAX_PAR_ECRAN) || 120;
const FILTRE = process.env.BANC_ECRANS ? new RegExp(process.env.BANC_ECRANS) : null;

// ── Les EXCEPTIONS, chacune justifiée ───────────────────────────────────────
// Une ligne = [code, écran (regex), signature (regex), pourquoi]. Une exception
// qui ne sert plus est DITE (pour qu'on la retire), sans faire échouer.
const EXCEPTIONS = [
  ['E4', /./, /^summary\|/, 'un <summary> ouvre son <details> sans mutation DOM (attribut open posé par le navigateur, vu par le banc)'],
  ['E9', /./, /data-vrm-lien-texte|vrm-lien-texte/, 'lien dans une phrase : sa cible est la ligne de texte (§7 vise les commandes)'],
  ['E4', /./, /aria-current=page/, 'l’entrée de l’écran déjà ouvert : la retoucher ne change rien, c’est voulu'],
  ['E4', /./, /aria-pressed=true/, 'le filtre déjà choisi : le retoucher ne change rien, c’est voulu'],
  ['E4', /./, /aria-selected=true/, 'l’onglet déjà choisi : le retoucher ne change rien, c’est voulu'],
  ['E8', /^parametres$/, /^texte\|Réglages$/, 'l’onglet « Réglages » DANS Paramètres (à côté de « Mon compte » et « Abonnement », 4 oct.) : une section, pas un autre nom de l’écran'],
  ['E9', /^statistiques/, /^g\|[a-zéû]+ \d{4} ·/, 'une barre du graphique des mois : 12 barres sur 390 px, la hauteur (124 px) fait la cible ; le montant est aussi écrit sous le graphique'],
  ['E4', /./, /^button\|Fermer ce message/, 'un message (toast) : il se ferme tout seul, le banc l’a déjà vu partir'],
];

const maintenant = new Date(2026, 9, 31, 15, 30, 0);
const il = (n, h = 12) => { const d = new Date(maintenant); d.setHours(h, 0, 0, 0); d.setDate(d.getDate() - n); return d; };
const UID = '111';
const vente = (id, titre, prix, statut, d, extra = {}) => ({ transaction_id: id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, status: statut, date: d.toISOString(), ...extra });
const VENTES = [
  vente(7001, 'Nike Air Max 90 blanche taille 42', 65, 'Le paiement a été validé', il(0, 11), { transaction_user_status: 'needs_action' }),
  vente(7002, 'Adidas Samba OG noir taille 40', 72, 'Commande finalisée', il(2), { transaction_user_status: 'completed' }),
  vente(7003, 'Salomon XT-6 gris taille 43', 110, 'Colis en cours d\'acheminement', il(1), { transaction_user_status: 'waiting' }),
];
const ANNONCES = Array.from({ length: 4 }, (_, k) => ({ id: 6000 + k, title: ['Nike Dunk Low panda taille 38', 'Adidas Gazelle bleu taille 41', 'Salomon XT-4 noir taille 42', 'Asics Gel-1130 blanc taille 40'][k], price: { amount: String(40 + k * 7), currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false, created_at_ts: il(30 + k).toISOString() }));
const ACCOUNTS = [{ id: 1, vinted_user_id: UID, login: 'boutique_demo', domain: 'www.vinted.fr', updated_at: maintenant.toISOString() }];
const cap = maintenant.toISOString();
const LBC_VENTES = {
  'lbc-tx-1': { txId: 'lbc-tx-1', itemId: 900001, isSeller: true, title: 'Nike Air Max 90 blanche taille 42', price: 7000, dateVente: il(1, 15).toISOString(), stepStatus: 'done', at: il(0, 8).toISOString() },
  'lbc-tx-2': { txId: 'lbc-tx-2', itemId: 900002, isSeller: true, title: 'Asics Gel-1130 blanc taille 40', price: 5500, dateVente: il(4).toISOString(), at: il(0, 8).toISOString(), stepLabel: 'Paiement en attente' },
};
const cmd = (id, prix, titre, d) => ({ orderId: id, creationDate: d.toISOString(), orderPaymentStatus: 'PAID', orderFulfillmentStatus: 'NOT_STARTED', pricingSummary: { priceSubtotal: { value: prix, currency: 'EUR' }, total: { value: prix, currency: 'EUR' } }, lineItems: [{ title: titre, sku: 'VRM-12', legacyItemId: '1234567', quantity: 1 }] });
const LIGNES = [
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
  { id: 'vc_ventes', data: { ventes: { 'vc-1': { ref: '80', etat: 'Expédiée', date: il(5).toISOString(), montant: { valeur: 120, devise: 'EUR', cle: 'price' } } }, lectures: {} } },
  { id: 'vc_listings', data: { items: {}, liens: {} } },
];

// Les écrans MONTÉS par la coque (un `tab===…&&<…>` dans App.jsx), relevés dans
// le source à chaque lancement : un identifiant atteint qui n'y est pas ⇒ E3.
const APP = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'App.jsx'), 'utf8');
const MONTES = new Set([...APP.matchAll(/\{tab===['"]([a-z_0-9]+)['"]\s*&&/g)].map((m) => m[1]));
// Les onglets rendus par la table de la coque (`map={cat_annonces:…}`) :
for (const m of APP.matchAll(/const map=\{([^}]*)\}; if\(tab===/g)) for (const k of m[1].matchAll(/([a-z_]+):'/g)) MONTES.add(k[1]);
// Les identifiants qu'un effet de la coque redirige aussitôt (`if(tab==='x'){… setTab(`) :
const TRANSITOIRES = new Set([...APP.matchAll(/if\s*\(\s*tab\s*!==?\s*['"]([a-z_]+)['"]\s*\)/g)].map((m) => m[1]));

// LE NOM D'UN ÉCRAN, celui de la colonne de navigation (une source : la colonne).
const NOMS = {
  journee: ['Ma journée', 'Journée'], annonces: ['Annonces'], ventes: ['Ventes'], messages: ['Messages'], cat_bord: ['Colis'],
  garage: ['Stock'], achats: ['Achats'], dashboard: ['Statistiques'], compta: ['Compta']  /* (3 nov., Julien via la critique #2 : « Compta » partout) */, communaute: ['Communauté'], settings: ['Paramètres'],
};
// Les autres noms d'un écran, à ne plus écrire (E8) — `ou` : le contexte qui
// les rend légitimes (« Réglages » de l'iPhone, l'onglet « Réglages » DANS Paramètres).
const SYNONYMES = [
  { mot: /\bRéglages\b/, ecran: 'settings', ou: /(iPhone|ton nom|Connexion et sécurité|Se connecter avec Apple|réglages du navigateur|Réglages (des )?factures|Réglages\s*&|Réglages gardés|Réglages, numéros)/i },
  { mot: /\bStats\b/, ecran: 'dashboard' },
  // (3 nov.) « Compta » est désormais LE nom (colonne, titre, menu) : plus un synonyme.
];

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.onnx': 'application/octet-stream' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!p.startsWith(DIST) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });

// Ce qui est intercepté DANS la page (aucune sortie réelle).
const INIT = () => {
  try {
    localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_prenom', JSON.stringify('Julien'));
    localStorage.setItem('vrm_bascule_mineral_v1', '1');
    localStorage.setItem('vrm_colis_aposter', JSON.stringify({ total: 1, enRetard: 0, vinted: 1, ebay: 0, at: Date.now() }));
  } catch (_) {}
  window.__banc = { ouverts: [], copies: 0, imprime: 0, natifs: 0 };
  window.open = (u) => { window.__banc.ouverts.push(String(u || '')); return { closed: false, close() {}, focus() {}, location: { href: '' }, document: { write() {}, close() {} } }; };
  window.print = () => { window.__banc.imprime++; };
  try { Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { window.__banc.copies++; }, write: async () => { window.__banc.copies++; }, readText: async () => '' }, configurable: true }); } catch (_) {}
  // Un téléchargement (sauvegarde, PDF) passe par un <a download> cliqué : compté, jamais suivi.
  const clic = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () { if (this.hasAttribute('download') || /^blob:|^data:/.test(this.href)) { window.__banc.copies++; return; } return clic.call(this); };
  HTMLInputElement.prototype.showPicker = function () { window.__banc.copies++; };
  const clicIn = HTMLInputElement.prototype.click;
  HTMLInputElement.prototype.click = function () { if (this.type === 'file') { window.__banc.copies++; return; } return clicIn.call(this); };
};

const ouvrirPage = async (b, tel) => {
  const ctx = await b.newContext(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1512, height: 950 } });
  const pg = await ctx.newPage();
  const etat = { errs: [], requetes: 0, popups: [], navs: 0 };
  pg.on('framenavigated', (f) => { if (f === pg.mainFrame()) etat.navs++; });
  pg.on('pageerror', (e) => etat.errs.push(String(e.message || e).slice(0, 240)));
  pg.on('dialog', (d) => { etat.natifs = (etat.natifs || 0) + 1; d.dismiss().catch(() => {}); });
  ctx.on('page', (p) => { etat.popups.push(p.url()); p.close().catch(() => {}); });
  pg.on('filechooser', () => {});
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript(INIT);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => { const t = r.request().resourceType(); if (['image', 'media', 'font'].includes(t)) return r.abort(); if (/supabase|\/rest\/v1|\/auth\/v1|\/storage\/v1|\/functions\/v1/.test(r.request().url())) return r.fallback(); return r.fulfill({ status: 204, body: '' }); });
  await pg.route('**/rest/v1/**', (route) => {
    etat.requetes++;
    const u = decodeURIComponent(metaVersData(route.request().url()));
    // Toute écriture : répondue SANS effet (rien n'est enregistré nulle part).
    if (route.request().method() !== 'GET' && route.request().method() !== 'HEAD') return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    if (!/\/rest\/v1\/app_data/.test(u)) return j([]);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || '';
    const forme = (r) => {
      if (/(^|,)[a-z_]+:data->/i.test(sel)) {
        const o = {};
        for (const champ of sel.split(',')) {
          if (champ === 'id') { o.id = r.id; continue; }
          if (champ === 'data') { o.data = r.data; continue; }
          if (champ === 'updated_at') { o.updated_at = cap; continue; }
          // (6 nov.) chemin JSON lu comme PostgREST (getPath : `->>` = texte, absent ⇒ null) ; `alias:data->>x` était lu comme la clé « >x », toujours absente (§6.3).
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
    if (dans) { const ids = dans[1].split(',').map((x) => x.replace(/^"|"$/g, '')); return j(LIGNES.filter((r) => ids.includes(r.id)).map(forme)); }
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  // `/api/**` : aucune route ne fait rien ; une lecture reçoit une réponse vide.
  await pg.route('**/api/**', (r) => { etat.requetes++; return r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }); });
  return { ctx, pg, etat };
};

const attendreCoque = async (pg) => {
  await pg.waitForFunction(() => document.querySelector('.vrm-main') || /pas pu s'afficher/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
  await pg.waitForTimeout(1200);
};

// LES ÉCRANS. `url` : le lien profond (`?tab=…&site=…&section=…&vue=…`) ;
// `prep` : les gestes qui y mènent quand aucun lien ne suffit ; `portee` : où
// chercher les boutons (la coque — colonne, barre du bas, en-tête — n'est
// visitée qu'une fois, sur Ma journée).
const SCOPE_ECRAN = '.vrm-main, .vrm-barre-haut-droite';
const ouvrirEntreeNav = async (pg, tel, cle) => {
  if (tel) { await pg.locator('.vrm-mobile-nav button[aria-label="Plus"]').click(); await pg.waitForTimeout(500); }
  await pg.locator(`[data-nav-entree="${cle}"]`).first().click(); await pg.waitForTimeout(1200);
};
const ECRANS = (tel) => [
  { nom: 'coque', url: '?tab=journee', portee: 'body', exclure: SCOPE_ECRAN },
  ...(tel ? [{ nom: 'plus', url: '?tab=journee', prep: async (pg) => { await pg.locator('.vrm-mobile-nav button[aria-label="Plus"]').click(); await pg.waitForTimeout(500); }, portee: '.vrm-sheet', refaire: true }] : []),
  { nom: 'journee', url: '?tab=journee' },
  { nom: 'tournee', url: '?tab=journee', prep: async (pg) => { const o = pg.locator('[data-tournee-ouvrir]'); if (await o.count()) { await o.first().click(); await pg.waitForTimeout(700); } }, portee: '[data-tournee-plein]', refaire: true },
  ...['vinted', 'leboncoin', 'ebay', 'vestiaire'].map((s) => ({ nom: 'annonces.' + s, url: '?tab=annonces&site=' + s })),
  { nom: 'annonces.ebay.promo', url: '?tab=plat_ebay&section=promo' },
  { nom: 'republier', url: '?tab=journee', prep: async (pg) => { await ouvrirEntreeNav(pg, tel, 'republier'); await pg.waitForSelector('[data-selection-vue]', { timeout: 8000 }).catch(() => {}); }, portee: '[data-selection-vue]', refaire: true },   // (5 nov., chantier C) l'entrée « Republier » mène à la vue « Sélectionner » (plus de feuille « Republier et brouillons »)
  ...['toutes', 'vinted', 'leboncoin', 'ebay', 'vestiaire'].map((s) => ({ nom: 'ventes.' + s, url: '?tab=ventes&site=' + s })),
  { nom: 'ventes.ebay.agent', url: '?tab=plat_ebay&section=agent' },
  { nom: 'ventes.ebay.offres', url: '?tab=plat_ebay&section=offres' },
  ...['vinted', 'leboncoin', 'ebay', 'vestiaire'].map((s) => ({ nom: 'messages.' + s, url: '?tab=messages&site=' + s })),
  { nom: 'favoris', url: '?tab=messages&site=vinted&vue=favoris' },
  ...['vinted', 'leboncoin', 'ebay', 'vestiaire'].map((s) => ({ nom: 'achats.' + s, url: '?tab=achats&site=' + s })),
  { nom: 'colis', url: '?tab=cat_bord' },
  { nom: 'colis.leboncoin', url: '?tab=plat_leboncoin&section=colis' },
  { nom: 'stock', url: '?tab=garage' },
  { nom: 'statistiques', url: '?tab=dashboard' },
  { nom: 'statistiques.prix', url: '?tab=dashboard&section=prix' },
  { nom: 'comptabilite', url: '?tab=compta' },
  { nom: 'comptabilite.factures', url: '?tab=compta&section=factures' },
  { nom: 'communaute', url: '?tab=communaute' },
  { nom: 'comptes-lies', url: '?tab=vintedaccounts' },
  { nom: 'achats-masques', url: '?tab=masques' },
  { nom: 'organisation', url: '?tab=organisation' },
  { nom: 'parametres', url: '?tab=settings', panneaux: true },
];

// L'empreinte d'un écran : où l'on est, ce qui est ouvert, et sa liste de boutons.
const EMPREINTE = (portee, exclure) => {
  const st = history.state || {};
  const dlg = [...document.querySelectorAll('[role="dialog"], [aria-modal="true"], .vrm-sheet, dialog[open]')].filter((d) => d.getClientRects().length).length;
  const sous = [...document.querySelectorAll('[data-sous-ecran]')].filter((x) => !x.hidden).map((x) => x.getAttribute('data-sous-ecran')).join(',');
  return JSON.stringify([st.vrmTab || '', st.vrmSub || '', !!st.vrmFeuille, dlg, sous]);
};
// Énumère les éléments cliquables visibles : une signature stable par élément.
const ENUMERER = ([portee, exclure, marquer]) => {
  const racines = portee === 'body' ? [document.body] : [...document.querySelectorAll(portee)];
  const vus = new Set(); const sortie = []; const compte = {};
  const sel = 'button, a, [role="button"], [onclick], summary, [role="tab"], [role="menuitem"], [role="switch"]';
  document.querySelectorAll('[data-banc-cible]').forEach((e) => e.removeAttribute('data-banc-cible'));
  for (const r of racines) for (const e of r.querySelectorAll(sel)) {
    if (vus.has(e)) continue; vus.add(e);
    if (exclure && e.closest(exclure)) continue;
    if (e.closest('[hidden], [inert], .vrm-toasts')) continue;
    // Le contenu d'un <details> fermé n'est pas affiché (seul son <summary> l'est).
    const det = e.closest('details'); if (det && !det.open && !(e.matches('summary') && e.parentElement === det)) continue;
    if (det && det.parentElement && det.parentElement.closest('details:not([open])')) continue;
    if (e.parentElement && e.parentElement.closest(sel) && !e.matches('summary')) continue; // un bouton dans un bouton : le parent compte
    const rr = e.getBoundingClientRect(); const cs = getComputedStyle(e);
    if (!e.getClientRects().length || rr.width < 1 || rr.height < 1 || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
    const txt = (e.getAttribute('aria-label') || e.innerText || e.getAttribute('title') || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    const datas = [...e.attributes].filter((a) => /^data-/.test(a.name) && !/^data-banc/.test(a.name) && a.value.length < 30).map((a) => a.name + '=' + a.value).sort().join(' ');
    const etats = ['aria-current', 'aria-pressed', 'aria-selected', 'aria-expanded'].filter((a) => e.hasAttribute(a)).map((a) => a + '=' + e.getAttribute(a)).join(' ');
    const base = e.tagName.toLowerCase() + '|' + txt + '|' + datas + '|' + etats + (e.classList.contains('vrm-lien-texte') ? ' vrm-lien-texte' : '');
    compte[base] = (compte[base] || 0) + 1;
    const sig = base + '#' + compte[base];
    if (marquer && sig === marquer) e.setAttribute('data-banc-cible', '1');
    // Une cible de doigt : la boîte affichée ; un lien dans une phrase (inline, entouré de texte) n'en est pas une.
    const enLigne = cs.display === 'inline' && e.parentElement && (e.parentElement.innerText || '').trim().length > (e.innerText || '').trim().length + 8;
    sortie.push({ sig, txt, html: e.outerHTML.replace(/\s+/g, ' ').slice(0, 200), tag: e.tagName.toLowerCase(), w: Math.round(rr.width), h: Math.round(rr.height), enLigne,
      disabled: !!(e.disabled || e.getAttribute('aria-disabled') === 'true'),
      raison: (e.getAttribute('title') || '') + '|' + (e.getAttribute('aria-describedby') ? (document.getElementById(e.getAttribute('aria-describedby')) || {}).textContent || '' : '') + '|' + (e.getAttribute('data-raison') || ''),
      href: e.tagName === 'A' ? (e.getAttribute('href')) : null, target: e.getAttribute('target') || '', download: e.hasAttribute('download') });
  }
  return sortie;
};

const capturer = async (pg, nom) => {
  if (!CAPTURES) return '';
  try {
    fs.mkdirSync(CAPTURES, { recursive: true }); const f = path.join(CAPTURES, nom.replace(/[^a-z0-9._-]+/gi, '_').slice(0, 120) + '.png');
    // L'élément en cause est entouré (s'il est encore là).
    await pg.evaluate(() => { const c = document.querySelector('[data-banc-cible]'); if (c) { c.scrollIntoView({ block: 'center' }); c.style.outline = '3px solid #e5484d'; c.style.outlineOffset = '2px'; } }).catch(() => {});
    await pg.screenshot({ path: f });
    await pg.evaluate(() => { const c = document.querySelector('[data-banc-cible]'); if (c) { c.style.outline = ''; c.style.outlineOffset = ''; } }).catch(() => {});
    return f;
  } catch (_) { return ''; }
};

const defauts = []; let visites = 0; let ecransVus = 0;
const noter = async (pg, d) => {
  const ex = EXCEPTIONS.find(([c, e, s]) => c === d.code && e.test(d.ecran) && s.test(d.sig));
  if (ex) { ex.sert = true; return; }
  const cle = d.code + '·' + d.taille + '·' + d.ecran + '·' + d.sig;
  if (defauts.some((x) => x.cle === cle)) return;
  d.cle = cle; d.capture = await capturer(pg, `${d.code}-${d.taille}-${d.ecran}-${defauts.length}`);
  defauts.push(d);
};

const etatPage = (pg) => pg.evaluate(() => ({
  tab: (history.state || {}).vrmTab || '', sub: (history.state || {}).vrmSub || '', feuille: !!(history.state || {}).vrmFeuille,
  tombe: /pas pu s'afficher|Cannot access|is not defined|Minified React error/.test(document.body.innerText),
  blanc: !document.querySelector('.vrm-main') || (document.querySelector('.vrm-main').innerText || '').trim().length < 15,
  dlg: [...document.querySelectorAll('[role="dialog"], [aria-modal="true"], .vrm-sheet, dialog[open]')].filter((d) => d.getClientRects().length).length,
}));

// Referme ce qu'un clic a ouvert ; rend comment (E6).
const refermer = async (pg, tel, avant) => {
  const ouvert = async () => { const s = await etatPage(pg); return s.dlg > avant.dlg || (s.feuille && !avant.feuille); };
  if (!(await ouvert())) return { ouvert: false };
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(250);
  if (!(await ouvert())) return { ouvert: true, par: 'echap' };
  // Toucher à côté : un point du fond hors de la boîte de la feuille.
  const pt = await pg.evaluate(() => {
    const ds = [...document.querySelectorAll('[role="dialog"], [aria-modal="true"], .vrm-sheet, dialog[open]')].filter((d) => d.getClientRects().length);
    const d = ds[ds.length - 1]; if (!d) return null;
    const boite = d.querySelector('.vrm-sheet-panel, .vrm-sheet-corps, [data-feuille-corps]') || d;
    const r = boite.getBoundingClientRect(); const W = innerWidth, H = innerHeight;
    const cands = [[8, 8], [W - 8, 8], [8, H / 2], [W - 8, H / 2]];
    for (const [x, y] of cands) if (x < r.left || x > r.right || y < r.top || y > r.bottom) return [x, y];
    return null;
  });
  if (pt) { await pg.mouse.click(pt[0], pt[1]); await pg.waitForTimeout(350); if (!(await ouvert())) return { ouvert: true, par: 'a-cote' }; }
  // Le geste « retour » (FermeAuRetour).
  await pg.evaluate(() => history.back()); await pg.waitForTimeout(500);
  if (!(await ouvert())) return { ouvert: true, par: 'retour' };
  // Un bouton « Fermer » / « Annuler » / « Retour » de la feuille.
  const f = pg.locator('[role="dialog"] button, [aria-modal="true"] button, .vrm-sheet button').filter({ hasText: /^(Fermer|Annuler|Retour|‹|×|✕|Plus tard|Non)/ });
  if (await f.count()) { await f.last().click({ timeout: 1500 }).catch(() => {}); await pg.waitForTimeout(400); if (!(await ouvert())) return { ouvert: true, par: 'bouton' }; }
  const fl = pg.locator('[role="dialog"] [aria-label^="Fermer"], .vrm-sheet [aria-label^="Fermer"], [aria-modal="true"] [aria-label^="Fermer"]');
  if (await fl.count()) { await fl.last().click({ timeout: 1500 }).catch(() => {}); await pg.waitForTimeout(400); if (!(await ouvert())) return { ouvert: true, par: 'bouton' }; }
  return { ouvert: true, par: null };
};

const nomDe = (tab) => (NOMS[tab] || [])[0] || '';

// E6b — ÉCHAP ferme les feuilles, sur ordinateur (contrôle déterministe : la
// feuille est ATTENDUE avant la touche, un clic du parcours général peut la
// voir s'ouvrir trop tard sous charge). Une feuille posée par `FermeAuRetour`
// (SheetShell…) se reconnaît à `history.state.vrmFeuille`.
const FEUILLES = [
  // (5 nov., chantier C) La feuille « Republier et brouillons » n'existe plus : la feuille d'Annonces jugée ici est « … » d'une carte.
  { nom: 'Autres gestes d’une annonce (« … »)', url: '?tab=cat_annonces', ouvrir: (pg) => pg.locator('[data-fiche-menu-ouvrir]').first().click(), sel: '[data-fiche-menu]' },
  { nom: 'Synchronisation', url: '?tab=journee', ouvrir: (pg) => pg.locator('.vrm-sync-status').first().click(), sel: '[data-sync-panneau]' },
  { nom: 'Prix d’achat à compléter (Ma journée)', url: '?tab=journee', ouvrir: (pg) => pg.locator('[data-stock-completer]').first().click(), sel: null },
  { nom: 'Relier un achat (Ventes)', url: '?tab=ventes&site=vinted', ouvrir: (pg) => pg.locator('[data-cout-vente-relier]').first().click(), sel: null },
  { nom: 'Nouvelle facture (Factures)', url: '?tab=compta&section=factures', ouvrir: (pg) => pg.getByRole('button', { name: /Nouvelle facture/ }).first().click(), sel: null },
];
async function verifierFeuilles(b) {
  for (const F of FEUILLES) {
    const { ctx, pg } = await ouvrirPage(b, false);
    try {
      await pg.goto(`http://localhost:${PORT}/${F.url}`, { waitUntil: 'domcontentloaded' }); await attendreCoque(pg);
      await F.ouvrir(pg);
      const ouverte = () => pg.evaluate((sel) => (sel ? !!document.querySelector(sel) : !!(history.state || {}).vrmFeuille), F.sel);
      await pg.waitForFunction((sel) => (sel ? !!document.querySelector(sel) : !!(history.state || {}).vrmFeuille), F.sel, { timeout: 8000 });
      await pg.keyboard.press('Escape'); await pg.waitForTimeout(700);
      const reste = await ouverte();
      if (reste) await noter(pg, { code: 'E6b', taille: '1512', ecran: 'feuilles', sig: F.nom, detail: 'Échap ne ferme pas la feuille (contrôle ciblé)' });
      console.log(`  · feuille « ${F.nom} » — ${reste ? 'reste ouverte après Échap' : 'fermée par Échap'}`);
    } catch (e) { await noter(pg, { code: 'E0', taille: '1512', ecran: 'feuilles', sig: F.nom, detail: 'feuille pas ouverte : ' + String(e.message || e).slice(0, 120) }); }
    await ctx.close();
  }
}

// E11 — LA COLONNE DE L'ORDINATEUR : aucune entrée à moitié visible (capture de
// (Sous ~640 px de haut, la colonne serrée ne tient plus : elle défile EN ENTIER,
// et la fenêtre coupe ce qui dépasse, comme toute liste qui défile — pas jugé.)
// Julien, 1er nov. : « Vestiaire » coupé par le filet du pied à 1512 × ~1000).
// Une entrée est tout entière visible, ou tout entière hors de vue (la colonne
// défile) — jamais coupée par la zone qui défile, la colonne ou la fenêtre.
async function verifierColonne(b) {
  for (const [w, h] of [[1512, 1000], [1512, 880], [1440, 800], [1280, 720], [1280, 650]]) {
    const { ctx, pg } = await ouvrirPage(b, false);
    await pg.setViewportSize({ width: w, height: h });
    await pg.goto(`http://localhost:${PORT}/?tab=cat_bord`, { waitUntil: 'domcontentloaded' });
    await attendreCoque(pg);
    const coupees = await pg.evaluate(() => {
      const out = [];
      for (const e of document.querySelectorAll('.vrm-atelier-rail [data-nav-entree]')) {
        const r = e.getBoundingClientRect(); let top = r.top, bot = r.bottom;
        for (let p = e.parentElement; p; p = p.parentElement) {
          const cs = getComputedStyle(p);
          if (/(hidden|auto|scroll|clip)/.test(cs.overflowY) || p === document.documentElement) {
            const pr = p === document.documentElement ? { top: 0, bottom: innerHeight } : p.getBoundingClientRect();
            top = Math.max(top, pr.top); bot = Math.min(bot, pr.bottom);
          }
        }
        const vu = Math.max(0, bot - top), tout = r.bottom - r.top;
        if (vu > 0.5 && vu < tout - 0.5) out.push(`${e.getAttribute('data-nav-entree')} ${Math.round(vu)}/${Math.round(tout)} px`);
      }
      const rail = document.querySelector('.vrm-atelier-rail');
      return { out, densite: rail && rail.getAttribute('data-rail-densite') || '0', defile: rail && rail.getAttribute('data-rail-defile') || '' };
    });
    for (const c of coupees.out) await noter(pg, { code: 'E11', taille: `${w}x${h}`, ecran: 'colonne', sig: c.split(' ')[0], detail: `entrée de la colonne coupée : ${c} (densité ${coupees.densite}${coupees.defile ? ', toute la colonne défile' : ''})` });
    // E12 — les filtres de site de Colis suivent la MÊME règle que ceux d'Annonces,
    // Ventes, Messages : un site où il a un compte a sa pastille (le banc sert
    // Vinted, Leboncoin, eBay ET Vestiaire), même sans colis ce jour-là.
    if (w === 1512 && h === 1000) {
      await pg.waitForTimeout(800);
      const sites = await pg.evaluate(() => [...document.querySelectorAll('[data-filtre-site="colis"] button[data-site]')].map((x) => x.getAttribute('data-site')));
      for (const s of ['vinted', 'leboncoin', 'ebay', 'vestiaire']) if (!sites.includes(s)) await noter(pg, { code: 'E12', taille: '1512', ecran: 'colis', sig: 'filtre|' + s, detail: `Colis : pas de pastille « ${s} » alors que le compte existe (pastilles : ${sites.join(', ') || 'aucune'})` });
    }
    console.log(`  · colonne ${w}×${h} — densité ${coupees.densite}${coupees.defile ? ', défile en entier' : ''}, ${coupees.out.length} coupée(s)`);
    await ctx.close();
  }
}

async function visiterEcran(b, tel, E, panneau) {
  const taille = tel ? '390' : '1512';
  const nomEcran = panneau ? `${E.nom}.${panneau}` : E.nom;
  const { ctx, pg, etat } = await ouvrirPage(b, tel);
  const charger = async () => {
    await pg.goto(`http://localhost:${PORT}/${E.url}`, { waitUntil: 'domcontentloaded' });
    await attendreCoque(pg);
    if (E.prep) await E.prep(pg).catch(() => {});
    if (panneau) { await pg.locator(`[data-sous-ouvrir="${panneau}"]`).first().click({ timeout: 3000 }).catch(() => {}); await pg.waitForTimeout(900); }
  };
  const portee = panneau ? `[data-sous-ecran="${panneau}"]:not([hidden])` : (E.portee || SCOPE_ECRAN);
  const exclure = E.exclure || '';
  try {
    await charger();
    const e0 = await etatPage(pg);
    if (e0.tombe || e0.blanc) await noter(pg, { code: 'E2', taille, ecran: nomEcran, sig: '(ouverture)', detail: 'écran tombé ou blanc dès l’ouverture', errs: etat.errs.slice(0, 3) });
    if (etat.errs.length) await noter(pg, { code: 'E1', taille, ecran: nomEcran, sig: '(ouverture)', detail: etat.errs.slice(0, 3).join(' ¦ ') });
    ecransVus++;
    let liste = await pg.evaluate(ENUMERER, [portee, exclure, null]);
    // Paramètres : chaque panneau devient un écran à part (visité ensuite).
    const panneaux = E.panneaux && !panneau ? await pg.evaluate(() => [...document.querySelectorAll('[data-sous-ouvrir]')].map((x) => x.getAttribute('data-sous-ouvrir'))) : [];
    // E8 — les noms d'écran écrits ailleurs que dans la colonne.
    const textes = await pg.evaluate(([p, x]) => { const out = []; for (const r of (p === 'body' ? [document.body] : document.querySelectorAll(p))) { const w = document.createTreeWalker(r, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const el = n.parentElement; if (!el || (x && el.closest(x)) || el.closest('[hidden]') || !el.getClientRects().length) continue; const t = (el.innerText || n.textContent || '').replace(/\s+/g, ' ').trim(); if (t) out.push(t.slice(0, 220)); } } return [...new Set(out)]; }, [portee, exclure]);
    for (const t of textes) for (const s of SYNONYMES) if (s.mot.test(t) && !(s.ou && s.ou.test(t))) await noter(pg, { code: 'E8', taille, ecran: nomEcran, sig: 'texte|' + t.slice(0, 90), detail: `« ${t.slice(0, 160)} » — la colonne dit « ${nomDe(s.ecran)} »` });
    const empreinte0 = await pg.evaluate(EMPREINTE, [portee, exclure]);
    const sigs0 = liste.map((x) => x.sig).join('\n');
    let aRecharger = false; let fond = null;
    for (const el of liste.slice(0, MAX)) {
      // E9 / E10 / E5 se jugent sans cliquer.
      if (tel && !el.enLigne && (el.h < 44 || el.w < 44)) await pg.evaluate(ENUMERER, [portee, exclure, el.sig]).then(() => noter(pg, { code: 'E9', taille, ecran: nomEcran, sig: el.sig, html: el.html, detail: `${el.w}×${el.h} px` }));
      if (el.disabled) {
        const r = el.raison.replace(/\|/g, ' ').trim();
        if (r.length < 4 || r === el.txt) await pg.evaluate(ENUMERER, [portee, exclure, el.sig]).then(() => noter(pg, { code: 'E10', taille, ecran: nomEcran, sig: el.sig, html: el.html, detail: 'désactivé, aucune raison (title / aria-describedby)' }));
        continue;
      }
      if (el.tag === 'a' && !el.download) {
        const h = el.href;
        if (h == null || h === '' || h === '#' || /^javascript:/i.test(h)) {
          // Un <a> sans href qui porte un onClick est un bouton déguisé : il est cliqué plus bas.
        } else if (/^https?:/i.test(h) || el.target === '_blank') {
          try { new URL(h, 'http://localhost'); } catch (_) { await noter(pg, { code: 'E5', taille, ecran: nomEcran, sig: el.sig, detail: 'href illisible : ' + h }); }
          continue; // jamais suivi : un lien externe ne se clique pas au banc
        } else if (/^(mailto|tel|sms|chrome|blob|data):/i.test(h)) continue;
      }
      if (aRecharger) { await charger(); aRecharger = false; fond = null; }
      const trouve = await pg.evaluate(ENUMERER, [portee, exclure, el.sig]).then(() => pg.locator('[data-banc-cible]').count());
      if (!trouve) continue;
      visites++;
      const avant = await etatPage(pg);
      const nErr = etat.errs.length, nReq = etat.requetes, nPop = etat.popups.length, nNav = etat.navs;
      await pg.evaluate(() => {
        const c = document.querySelector('[data-banc-cible]'); c.scrollIntoView({ block: 'center', inline: 'center' });
        window.__bancMut = 0; window.__bancFond = 0;
        window.__bancScroll = JSON.stringify([scrollX, scrollY, ...[...document.querySelectorAll('*')].filter((x) => x.scrollTop || x.scrollLeft).slice(0, 40).map((x) => x.scrollTop + ':' + x.scrollLeft)]);
        window.__bancFocus = document.activeElement;
        // Ce que la page DIT (sans les chiffres : une horloge ne compte pas) et l'état propre du bouton.
        window.__bancTexte = (document.body.innerText || '').replace(/[0-9]/g, '');
        window.__bancAttr = [...c.attributes].filter((a) => !/^data-banc/.test(a.name)).map((a) => a.name + '=' + a.value).join('|');
        window.__bancCible = c;
        window.__bancB = JSON.stringify([window.__banc.ouverts.length, window.__banc.copies, window.__banc.imprime]);
        if (window.__bancObs) window.__bancObs.disconnect();
        window.__bancObs = new MutationObserver((ms) => { for (const m of ms) { if (m.type === 'attributes' && /^data-banc/.test(m.attributeName)) continue; window.__bancMut++; } });
      });
      // Le bruit de fond (horloges, animations) : mesuré une fois par chargement, sur la même durée.
      if (fond == null) {
        await pg.evaluate(() => { const o = new MutationObserver((ms) => { window.__bancFond += ms.length; }); o.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true }); window.__bancObsFond = o; });
        await pg.waitForTimeout(500);
        fond = await pg.evaluate(() => { window.__bancObsFond.disconnect(); return window.__bancFond; });
      }
      await pg.evaluate(() => { window.__bancObs.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true }); });
      const loc = pg.locator('[data-banc-cible]').first();
      let recouvert = false;
      try { await loc.click({ timeout: 1500 }); }
      catch (_) { recouvert = true; await pg.evaluate(() => { const c = document.querySelector('[data-banc-cible]'); if (c) c.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })); }); }
      await pg.waitForTimeout(500);
      // « Recharger la dernière version » recharge la page : c'est son effet, pas un écran blanc.
      if (etat.navs > nNav) { aRecharger = true; continue; }
      const apres = await etatPage(pg);
      const vie = await pg.evaluate(() => {
        const sc = JSON.stringify([scrollX, scrollY, ...[...document.querySelectorAll('*')].filter((x) => x.scrollTop || x.scrollLeft).slice(0, 40).map((x) => x.scrollTop + ':' + x.scrollLeft)]);
        const f = document.activeElement; const fv = f !== window.__bancFocus && f && /^(INPUT|TEXTAREA|SELECT)$/.test(f.tagName);
        const c = window.__bancCible; const attr = c && c.isConnected ? [...c.attributes].filter((a) => !/^data-banc/.test(a.name)).map((a) => a.name + '=' + a.value).join('|') : '(parti)';
        const change = attr !== window.__bancAttr || (document.body.innerText || '').replace(/[0-9]/g, '') !== window.__bancTexte;
        return { change, mut: window.__bancMut, scroll: sc !== window.__bancScroll, focus: !!fv, sorties: JSON.stringify([window.__banc.ouverts.length, window.__banc.copies, window.__banc.imprime]) !== window.__bancB, ouverts: window.__banc.ouverts.slice(-1)[0] || '' };
      });
      const dit = { taille, ecran: nomEcran, sig: el.sig, txt: el.txt, html: el.html };
      if (etat.errs.length > nErr) await noter(pg, { code: 'E1', ...dit, detail: etat.errs.slice(nErr, nErr + 2).join(' ¦ ') });
      if (apres.tombe || (apres.blanc && !avant.blanc && !apres.dlg)) await noter(pg, { code: 'E2', ...dit, detail: apres.tombe ? 'garde-fou d’erreur affiché' : 'écran blanc après le clic' });
      const navigue = apres.tab !== avant.tab;
      if (navigue && apres.tab && !MONTES.has(apres.tab) && !TRANSITOIRES.has(apres.tab)) await noter(pg, { code: 'E3', ...dit, detail: `mène à « ${apres.tab} », aucun écran monté` });
      if (vie.ouverts && /^(|#|about:blank)$/.test(vie.ouverts)) await noter(pg, { code: 'E5', ...dit, detail: 'window.open sans adresse' });
      // E7 — le texte nomme un écran, le clic en ouvre un autre.
      if (navigue && apres.tab) {
        for (const [ecr, noms] of Object.entries(NOMS)) {
          if (ecr === apres.tab) continue;
          // Le NOM propre (majuscule) : « la valeur du stock » n'est pas l'écran Stock.
          const nomme = noms.some((n) => new RegExp('(^|[^\\p{L}])' + n + '([^\\p{L}]|$)', 'u').test(el.txt));
          const nommeDest = (NOMS[apres.tab] || []).some((n) => new RegExp(n, 'i').test(el.txt));
          if (nomme && !nommeDest) await noter(pg, { code: 'E7', ...dit, detail: `« ${el.txt} » ouvre ${nomDe(apres.tab) || apres.tab}, pas ${noms[0]}` });
        }
      }
      const rien = !navigue && apres.sub === avant.sub && apres.dlg === avant.dlg && apres.feuille === avant.feuille && (vie.mut === 0 || (vie.mut <= fond && !vie.change)) && !vie.scroll && !vie.focus && !vie.sorties
        && etat.requetes === nReq && etat.popups.length === nPop && etat.errs.length === nErr;
      if (rien) await noter(pg, { code: 'E4', ...dit, detail: `aucun effet (mutations ${vie.mut}, fond ${fond})${recouvert ? ' — recouvert par un autre élément' : ''}` });
      // Une feuille ouverte : la refermer, sans jamais rien accepter.
      const f = await refermer(pg, tel, avant);
      if (f.ouvert && !f.par) { await noter(pg, { code: 'E6', ...dit, detail: 'feuille qui ne se ferme ni par Échap, ni à côté, ni par retour, ni par un bouton' }); aRecharger = true; }
      else if (f.ouvert && f.par !== 'echap' && !tel) await noter(pg, { code: 'E6b', ...dit, detail: `Échap ne ferme pas la feuille (fermée par ${f.par})` });
      // Revenir à l'écran de départ.
      const now = await etatPage(pg);
      if (now.tab !== avant.tab || now.sub !== avant.sub) { aRecharger = true; continue; }
      const emp = await pg.evaluate(EMPREINTE, [portee, exclure]);
      const sigs = (await pg.evaluate(ENUMERER, [portee, exclure, null])).map((x) => x.sig).join('\n');
      if (emp !== empreinte0 || sigs !== sigs0 || E.refaire) aRecharger = true;
    }
    for (const p of panneaux) if (!FILTRE || FILTRE.test(`${E.nom}.${p}`)) { await ctx.close().catch(() => {}); await visiterEcran(b, tel, E, p); return; }
  } catch (e) {
    await noter(pg, { code: 'E0', taille, ecran: nomEcran, sig: '(banc)', detail: 'le banc n’a pas pu visiter : ' + String(e.message || e).slice(0, 200) });
  } finally { await ctx.close().catch(() => {}); }
}

const demarrer = () => new Promise((res) => srv.listen(PORT, res));
module.exports = { demarrer, ouvrirPage, attendreCoque, PORT, ENUMERER };
if (require.main === module) (async () => {
  await demarrer();
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader'] });
  const t0 = Date.now();
  try {
    const TAILLES = process.env.BANC_TAILLE === '390' ? [true] : process.env.BANC_TAILLE === '1512' ? [false] : [true, false];
    if (TAILLES.includes(false) && (!FILTRE || FILTRE.test('colonne'))) await verifierColonne(b);
    if (TAILLES.includes(false) && (!FILTRE || FILTRE.test('feuilles'))) await verifierFeuilles(b);
    for (const tel of TAILLES) {
      for (const E of ECRANS(tel)) {
        if (FILTRE && !FILTRE.test(E.nom) && !(E.panneaux && FILTRE.test(E.nom + '.'))) continue;
        if (E.panneaux) {
          // L'écran lui-même, puis chacun de ses panneaux (ouverts un par un).
          await visiterEcran(b, tel, { ...E, panneaux: false });
          const { ctx, pg } = await ouvrirPage(b, tel);
          await pg.goto(`http://localhost:${PORT}/${E.url}`, { waitUntil: 'domcontentloaded' }); await attendreCoque(pg);
          const ps = await pg.evaluate(() => [...document.querySelectorAll('[data-sous-ouvrir]')].map((x) => x.getAttribute('data-sous-ouvrir')));
          await ctx.close();
          for (const p of ps) if (!FILTRE || FILTRE.test(`${E.nom}.${p}`) || FILTRE.test(E.nom)) await visiterEcran(b, tel, E, p);
        } else await visiterEcran(b, tel, E);
        process.stdout.write(`  · ${tel ? '390' : '1512'} ${E.nom} — ${visites} clics, ${defauts.length} défauts\n`);
      }
    }
  } finally { await b.close(); srv.close(); }
  const ordre = ['E0', 'E1', 'E2', 'E3', 'E11', 'E12', 'E6', 'E7', 'E5', 'E4', 'E8', 'E10', 'E6b', 'E9'];
  defauts.sort((a, b2) => ordre.indexOf(a.code) - ordre.indexOf(b2.code));
  console.log(`\n${ecransVus} écrans, ${visites} éléments cliqués, ${defauts.length} défauts (${Math.round((Date.now() - t0) / 1000)} s)`);
  const parCode = {}; for (const d of defauts) parCode[d.code] = (parCode[d.code] || 0) + 1;
  console.log(JSON.stringify(parCode));
  for (const d of defauts) console.log(`  ❌ ${d.code} [${d.taille}] ${d.ecran} · ${d.sig.slice(0, 110)} — ${String(d.detail).slice(0, 220)}`);
  for (const ex of EXCEPTIONS) if (!ex.sert && !FILTRE) console.log(`  ℹ️ exception jamais servie (à retirer ?) : ${ex[0]} ${ex[2]} — ${ex[3]}`);
  if (RAPPORT) fs.writeFileSync(RAPPORT, JSON.stringify({ ecrans: ecransVus, visites, defauts }, null, 1));
  console.log(defauts.length ? `❌ ${defauts.length} défaut(s)` : '✅ aucun défaut');
  process.exit(defauts.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
