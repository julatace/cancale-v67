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
//      pour Annonces), un site sans compte n'y est pas ;
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
//      groupe vide, aucune entrée d'un site sans compte.
// `BANC_PORT` (défaut 8940), `CAPTURES=<dossier>` pour garder les captures,
// `BANC_TAILLE=390|1512` pour une seule taille.
'use strict';
require('./_porte-banc.cjs');
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('/home/user/cancale-v67/node_modules/playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
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
  { id: `harvest_${UID}_orders_purchased`, data: { capturedAt: cap, payload: { my_orders: [] } } },
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
  const ctx = await b.newContext(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1512, height: 950 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript((loc) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_prenom', JSON.stringify('Julien')); localStorage.setItem('vrm_bascule_mineral_v1', '1'); for (const [k, v] of Object.entries(loc || {})) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); } catch (_) {} }, options.local || {});
  const LIGNES = [...LIGNES_BASE];
  if (!options.sansVestiaire) LIGNES.push({ id: 'vc_ventes', data: { ventes: { 'vc-1': { ref: '80', etat: 'Expédiée', date: il(5).toISOString(), montant: { valeur: 120, devise: 'EUR', cle: 'price' } } }, lectures: {} } }, { id: 'vc_listings', data: { items: {}, liens: {} } });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
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
          const m = /^([a-z_]+):data->(.+)$/i.exec(champ); if (!m) continue;
          let v = r.data; for (const p of m[2].split(/->>?/)) v = v == null ? v : v[p];
          o[m[1]] = (v != null && /->>/.test(m[2])) ? String(v) : v;
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
  await pg.waitForTimeout(2800);
  return { ctx, pg, errs };
};
const capture = async (pg, nom) => { if (!CAPTURES) return; try { fs.mkdirSync(CAPTURES, { recursive: true }); await pg.screenshot({ path: path.join(CAPTURES, nom + '.png'), fullPage: false }); } catch (_) {} };
// Ce que l'écran courant dit de lui-même (attributs, jamais un libellé).
const etat = (pg) => pg.evaluate(() => {
  const t = document.querySelector('[data-tache]');
  const f = t ? t.querySelector('[data-filtre-site]') : null;
  return {
    tache: t ? t.getAttribute('data-tache') : '',
    site: t ? t.getAttribute('data-tache-site') : '',
    filtres: f ? [...f.querySelectorAll('button[data-site]')].map((b) => b.getAttribute('data-site')) : [],
    presse: f ? ((f.querySelector('button[aria-pressed="true"]') || {}).getAttribute ? f.querySelector('button[aria-pressed="true"]').getAttribute('data-site') : '') : '',
    blanc: !document.querySelector('.vrm-main') || (document.querySelector('.vrm-main').innerText || '').trim().length < 20,
    tombe: /pas pu s'afficher|Cannot access|is not defined/.test(document.body.innerText),
    espace: (document.querySelector('[data-entete-plateforme]') || {}).getAttribute ? document.querySelector('[data-entete-plateforme]').getAttribute('data-entete-plateforme') : '',
    sections: [...document.querySelectorAll('nav[aria-label="Sections de la plateforme"] [data-section]')].map((b) => b.getAttribute('data-section')),
  };
});
const choisir = async (pg, site) => { const b = pg.locator(`[data-filtre-site] button[data-site="${site}"]`); if (!(await b.count())) return false; await b.first().click(); await pg.waitForTimeout(900); return true; };

(async () => {
  await new Promise((res) => srv.listen(PORT, res));
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader'] });
  try {
    // `BANC_TAILLE=390` ou `1512` : une seule taille (preuves par mutation, plus courtes).
    const TAILLES = process.env.BANC_TAILLE === '390' ? [true] : process.env.BANC_TAILLE === '1512' ? [false] : [true, false];
    for (const tel of TAILLES) {
      const qui = tel ? '390 px' : '1512 px';
      console.log(`── ${qui} : A. la navigation`);
      await essaie(`${qui} : navigation`, async () => {
        const { ctx, pg, errs } = await ouvrir(b, tel, 'journee', { local: { vrm_colis_aposter: { total: 2, enRetard: 0, vinted: 2, ebay: 0, at: maintenant.getTime() } } });
        if (tel) {
          const barre = await pg.evaluate(() => [...document.querySelectorAll('.vrm-mobile-nav > button')].map((x) => ({ lib: (x.querySelector('.vrm-nav-label') || x).innerText.trim(), h: Math.round(x.getBoundingClientRect().height), entree: x.getAttribute('data-nav-entree') || '' })));
          dit(barre.length === 5 && barre.map((x) => x.lib).join('|') === 'Journée|Annonces|Ventes|Colis|Plus', 'A. la barre du bas : Journée · Annonces · Ventes · Colis · Plus', JSON.stringify(barre));
          dit(barre.every((x) => x.h >= 44), 'A. chaque onglet ≥ 44 px', JSON.stringify(barre.map((x) => x.h)));
          const badge = await pg.evaluate(() => { const x = document.querySelector('.vrm-mobile-nav [data-badge-nav="cat_bord"]'); let pub = null; try { pub = JSON.parse(localStorage.getItem('vrm_colis_aposter')); } catch (_) {} return { n: x ? x.getAttribute('data-badge-n') : '', pub: pub && pub.total }; });
          dit(badge.n !== '' && badge.n === String(badge.pub) && Number(badge.n) > 0, 'H. badge sur Colis = le nombre PUBLIÉ (`vrm_colis_aposter`), jamais recalculé', JSON.stringify(badge));
          await pg.locator('.vrm-mobile-nav button[aria-label="Plus"]').tap();
          await pg.waitForTimeout(500);
          const f = await pg.evaluate(() => { const m = document.querySelector('.vrm-sheet'); if (!m) return null; return { groupes: [...m.querySelectorAll('[data-nav-groupe]')].map((g) => ({ t: g.getAttribute('data-nav-groupe'), n: g.querySelectorAll('[data-nav-entree]').length })), entrees: [...m.querySelectorAll('[data-nav-entree]')].map((e) => e.getAttribute('data-nav-entree')), petits: [...m.querySelectorAll('[data-nav-entree]')].filter((e) => e.getBoundingClientRect().height < 44).length }; });
          await capture(pg, 'plus-telephone');
          dit(!!f && f.groupes.map((g) => g.t).join('|') === 'Vendre|Expédier|Gérer|Argent|Plateformes|Moi', 'I. « Plus » groupé par tâche : Vendre · Expédier · Gérer · Argent · Plateformes · Moi', JSON.stringify(f && f.groupes));
          dit(!!f && f.groupes.every((g) => g.n > 0), 'I. aucun groupe vide', JSON.stringify(f && f.groupes));
          dit(!!f && !['journee', 'annonces', 'ventes', 'cat_bord'].some((x) => f.entrees.includes(x)), 'I. rien de la barre du bas en double dans « Plus »', JSON.stringify(f && f.entrees));
          dit(!!f && new Set(f.entrees).size === f.entrees.length, 'I. aucune entrée deux fois', JSON.stringify(f && f.entrees));
          dit(!!f && ['messages', 'republier', 'favoris', 'retraits', 'garage', 'achats', 'dashboard', 'compta', 'plat_ebay', 'plat_leboncoin', 'plat_vestiaire', 'communaute', 'settings'].every((x) => f.entrees.includes(x)), 'I. « Plus » porte Messages, Republier, Favoris, Retraits, Stock, Achats, Statistiques, Comptabilité, eBay, Leboncoin, Vestiaire, Communauté, Paramètres', JSON.stringify(f && f.entrees));
          dit(!!f && f.petits === 0, 'I. rangées ≥ 44 px', String(f && f.petits));
        } else {
          const col = await pg.evaluate(() => ({ taches: [...document.querySelectorAll('.vrm-sidebar [data-nav-taches] [data-nav-entree]')].map((e) => e.getAttribute('data-nav-entree')), groupes: [...document.querySelectorAll('.vrm-sidebar [data-nav-groupe]')].map((g) => g.getAttribute('data-nav-groupe')), toutes: [...document.querySelectorAll('.vrm-sidebar [data-nav-entree]')].map((e) => e.getAttribute('data-nav-entree')), badge: (document.querySelector('.vrm-sidebar [data-badge-nav="cat_bord"]') || { getAttribute: () => '' }).getAttribute('data-badge-n'), pub: (() => { try { return JSON.parse(localStorage.getItem('vrm_colis_aposter')).total; } catch (_) { return null; } })() }));
          await capture(pg, 'colonne-ordinateur');
          dit(col.taches.join('|') === 'journee|annonces|ventes|messages|cat_bord', 'A. la colonne : Ma journée · Annonces · Ventes · Messages · Colis', col.taches.join('|'));
          dit(col.groupes.join('|') === 'Vendre|Expédier|Gérer|Argent|Plateformes|Moi', 'A. puis les groupes par tâche', col.groupes.join('|'));
          dit(new Set(col.toutes).size === col.toutes.length, 'A. aucune entrée deux fois dans la colonne', col.toutes.join('|'));
          dit(col.toutes[col.toutes.length - 1] === 'settings', 'A. Paramètres en bas', col.toutes.join('|'));
          dit(col.badge !== '' && col.badge === String(col.pub) && Number(col.badge) > 0, 'H. badge sur Colis = le nombre publié', JSON.stringify({ b: col.badge, pub: col.pub }));
        }
        dit(errs.length === 0, `${qui} : aucune erreur`, errs.join(' | '));
        await ctx.close();
      });

      console.log(`── ${qui} : B/C. Ventes · filtres de site, « Vinted » = l'écran Vinted`);
      await essaie(`${qui} : ventes vinted`, async () => {
        const { ctx, pg, errs } = await ouvrir(b, tel, 'ventes');
        let e = await etat(pg);
        dit(e.tache === 'ventes' && e.filtres.join('|') === 'toutes|vinted|leboncoin|ebay|vestiaire', 'B. Ventes : Toutes · Vinted · Leboncoin · eBay · Vestiaire', JSON.stringify(e));
        dit(e.presse === 'toutes', 'B. Ventes s’ouvre sur « Toutes » (rien de retenu)', e.presse);
        await choisir(pg, 'vinted');
        e = await etat(pg);
        await capture(pg, `ventes-vinted-${tel ? 'tel' : 'ordi'}`);
        const c = await pg.evaluate(() => {
          const t = document.querySelector('[data-tache]');
          return {
            section: !!t.querySelector('section[aria-label="Vinted"]'),
            filtresVentes: t.querySelectorAll('.vrm-sales-filters button[aria-pressed], .vrm-sales-workbar button[aria-pressed]').length,
            lignes: t.querySelectorAll('[data-tx], [data-vente-tx], .vrm-sale-row, [data-transaction]').length,
            resume: !!t.querySelector('[data-vinted-majournee]'),
            sousNav: t.querySelectorAll('nav[aria-label="Sections de la plateforme"]').length,
            texte: t.innerText.length,
          };
        });
        dit(e.site === 'vinted' && c.section, 'C. « Vinted » rend l’écran Vinted (sa section)', JSON.stringify(c));
        dit(c.filtresVentes >= 3, 'C. « Vinted » garde ses filtres d’état des ventes', JSON.stringify(c));
        dit(c.resume, 'C. « Vinted » garde « À faire aujourd’hui »', JSON.stringify(c));
        dit(c.sousNav === 0, 'C. les sections de l’ancien onglet ne doublent pas la rangée de filtres', JSON.stringify(c));
        dit(errs.length === 0, `${qui} : aucune erreur`, errs.join(' | '));
        await ctx.close();
      });

      console.log(`── ${qui} : D/E. « Toutes » ne fusionne rien`);
      await essaie(`${qui} : toutes`, async () => {
        const { ctx, pg, errs } = await ouvrir(b, tel, 'ventes');
        await pg.waitForFunction(() => { const x = document.querySelector('[data-ventes-toutes]'); return x && x.getAttribute('data-ventes-toutes') === 'lu'; }, null, { timeout: 8000 }).catch(() => {});
        await capture(pg, `ventes-toutes-${tel ? 'tel' : 'ordi'}`);
        const l = await pg.evaluate((titre) => {
          const rows = [...document.querySelectorAll('[data-toutes-vente]')];
          const memes = rows.filter((r) => (r.innerText || '').includes(titre));
          return { n: rows.length, parSite: rows.reduce((m, r) => { const s = r.getAttribute('data-toutes-vente'); m[s] = (m[s] || 0) + 1; return m; }, {}), memes: memes.map((r) => r.getAttribute('data-toutes-vente') + ':' + r.getAttribute('data-toutes-id')), ids: rows.map((r) => r.getAttribute('data-toutes-vente') + ':' + r.getAttribute('data-toutes-id')), num: rows.filter((r) => r.querySelector('[data-toutes-num]')).map((r) => r.getAttribute('data-toutes-vente') + ':' + r.querySelector('[data-toutes-num]').getAttribute('data-toutes-num')) };
        }, MEME_TITRE);
        dit(l.memes.length === 2 && l.memes.includes('vinted:7001') && l.memes.includes('leboncoin:lbc-tx-1'), 'D. deux paires au même titre sur deux sites = DEUX lignes, chacune sous son site', JSON.stringify(l.memes));
        dit(l.parSite.vinted === 3 && l.parSite.leboncoin === 2 && l.parSite.ebay === 1 && l.parSite.vestiaire === 1, 'D. chaque vente lue est une ligne (3 Vinted, 2 Leboncoin — l’achat n’en est pas une —, 1 eBay, 1 Vestiaire)', JSON.stringify(l.parSite));
        dit(new Set(l.ids).size === l.ids.length, 'D. aucune ligne en double', l.ids.join(' '));
        dit(l.num.includes('ebay:12') && l.num.includes('vestiaire:80') && !l.num.some((x) => x.startsWith('vinted:')), 'D. le N° seulement par identité (SKU eBay, référence Vestiaire) — un blanc pour Vinted plutôt qu’un faux', JSON.stringify(l.num));
        // La plus récente d'abord : Vinted 7001 (aujourd'hui), puis Leboncoin (hier)…
        dit(l.ids[0] === 'vinted:7001', 'D. triées par date, la plus récente d’abord', l.ids.join(' '));
        // Une ligne ouvre SON site.
        await pg.locator('[data-toutes-vente="leboncoin"]').first().click();
        await pg.waitForTimeout(900);
        const e = await etat(pg);
        dit(e.tache === 'ventes' && e.site === 'leboncoin' && e.presse === 'leboncoin', 'D. une ligne Leboncoin ouvre Ventes · Leboncoin', JSON.stringify(e));
        dit(errs.length === 0, `${qui} : aucune erreur`, errs.join(' | '));
        await ctx.close();
      });
      await essaie(`${qui} : panne leboncoin`, async () => {
        const { ctx, pg } = await ouvrir(b, tel, 'ventes', { lbcPanne: true, sansVestiaire: true });
        await pg.waitForTimeout(800);
        const p = await pg.evaluate(() => ({ etat: (document.querySelector('[data-toutes-etat-site="leboncoin"]') || { getAttribute: () => '' }).getAttribute('data-etat'), lbc: document.querySelectorAll('[data-toutes-vente="leboncoin"]').length, filtres: [...document.querySelectorAll('[data-filtre-site] button[data-site]')].map((x) => x.getAttribute('data-site')) }));
        dit(p.etat === 'pas-su' && p.lbc === 0, 'E. ventes Leboncoin en 522 : le site est NOMMÉ « pas lu », aucune ligne inventée', JSON.stringify(p));
        dit(!p.filtres.includes('vestiaire'), 'B. sans compte Vestiaire, pas de pastille Vestiaire', JSON.stringify(p.filtres));
        await ctx.close();
      });

      console.log(`── ${qui} : B/G. Annonces · filtres, mémoire du filtre`);
      await essaie(`${qui} : annonces`, async () => {
        const { ctx, pg, errs } = await ouvrir(b, tel, 'annonces');
        let e = await etat(pg);
        dit(e.tache === 'annonces' && e.filtres.join('|') === 'vinted|leboncoin|ebay|vestiaire' && e.presse === 'vinted', 'B. Annonces : Vinted · Leboncoin · eBay · Vestiaire (pas de « Toutes »), sur Vinted', JSON.stringify(e));
        await choisir(pg, 'leboncoin');
        e = await etat(pg);
        dit(e.site === 'leboncoin' && !e.blanc, 'B. Annonces · Leboncoin rend l’écran Leboncoin', JSON.stringify(e));
        // Aller ailleurs, revenir : le filtre est retenu.
        await pg.locator(tel ? '.vrm-mobile-nav [data-nav-entree="cat_bord"]' : '.vrm-sidebar [data-nav-entree="cat_bord"]').first().click();
        await pg.waitForTimeout(700);
        await pg.locator(tel ? '.vrm-mobile-nav [data-nav-entree="annonces"]' : '.vrm-sidebar [data-nav-entree="annonces"]').first().click();
        await pg.waitForTimeout(900);
        e = await etat(pg);
        dit(e.site === 'leboncoin', 'G. Annonces rouvre sur le dernier filtre choisi (Leboncoin)', JSON.stringify(e));
        dit(errs.length === 0, `${qui} : aucune erreur`, errs.join(' | '));
        await ctx.close();
      });
      await essaie(`${qui} : filtre retenu à froid`, async () => {
        const { ctx, pg } = await ouvrir(b, tel, 'ventes', { local: { vrm_filtre_site: { ventes: 'ebay' } } });
        const e = await etat(pg);
        dit(e.site === 'ebay' && e.presse === 'ebay', 'G. le filtre retenu (eBay) survit à un rechargement', JSON.stringify(e));
        await ctx.close();
      });

      console.log(`── ${qui} : F. les anciens liens profonds`);
      const LIENS = [
        ['plat_vinted', { tache: 'ventes', site: 'vinted' }], ['cat_ventes', { tache: 'ventes', site: 'vinted' }],
        ['cat_annonces', { tache: 'annonces', site: 'vinted' }], ['vinted_annonces', { tache: 'annonces', site: 'vinted' }],
        ['plat_leboncoin', { tache: 'ventes', site: 'leboncoin' }], ['leboncoin', { tache: 'annonces', site: 'leboncoin' }],
        ['plat_ebay', { tache: 'ventes', site: 'ebay' }], ['ebay_annonces', { tache: 'annonces', site: 'ebay' }],
        ['cat_msg', { tache: 'messages', site: 'vinted' }], ['ebay_messages', { tache: 'messages', site: 'ebay' }],
        ['ebay_agent', { espace: 'ebay', section: 'agent' }], ['plat_vestiaire', { vestiaire: true }],
        ['cat_achats', { ecran: true }], ['cat_bord', { ecran: true }],
      ];
      for (const [id, attendu] of LIENS) {
        await essaie(`${qui} : ?tab=${id}`, async () => {
          const { ctx, pg, errs } = await ouvrir(b, tel, id);
          const e = await etat(pg);
          let bon;
          if (attendu.tache) bon = e.tache === attendu.tache && e.site === attendu.site && e.presse === attendu.site;
          else if (attendu.espace) bon = e.espace === attendu.espace && e.sections.includes(attendu.section) && !e.sections.includes('ventes');
          else if (attendu.vestiaire) bon = !e.blanc && !e.tache && /vestiaire/i.test(await pg.evaluate(() => document.querySelector('.vrm-main').innerText));
          else bon = !e.blanc && !e.tache;
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
