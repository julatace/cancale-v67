// BANC — LA BARRE DU BAS DE L'IPHONE ET LA REPRISE AU MÊME ENDROIT
// (5 novembre, demandes de Julien : « la barre d'onglets sur iPhone est à revoir
// TOTALEMENT — ça ne marche pas, c'est pas ouf » ; « quand on quitte l'app et
// qu'on la rouvre, revenir au même endroit, dans le même état » ; sur Edge, des
// libellés du rail coupés « Ven », « Gér », « Arg », « Plat » et un logo « VI »).
//
// Données INVENTÉES (le dépôt est public) : deux comptes Vinted fictifs, des
// ventes, des annonces, des ventes Leboncoin, une commande eBay. Rien de réel.
// Il juge sur des attributs, des boîtes et des nombres rendus — jamais une
// formulation (§6.4) — en clair ET en sombre :
//
// B. LA BARRE (390 × 844 tactile, et 375 × 667, un iPhone SE) :
//   B1. cinq entrées, chacune ≥ 44 px, aucun libellé coupé, le toucher au
//       centre de chaque entrée tombe SUR elle, rien ne déborde de côté, la
//       barre touche le bas de l'écran et porte la zone sûre (env()) ;
//   B2. un nombre ne s'écrit qu'une fois dans la barre (§7) ;
//   B3. « Plus » ouvert : le panneau ne recouvre PAS la barre ; toutes ses
//       entrées sont visibles sans défiler (iPhone SE compris), ≥ 44 px, et le
//       toucher tombe sur elles ;
//   B4. le geste « retour » avec « Plus » ouvert le FERME et reste dans VRM,
//       sur le même écran (avant : il quittait VRM) ;
//   B5. toucher « Plus » une 2ᵉ fois le referme ; toucher un onglet y va ;
//   B6. sur un écran rangé dans « Plus » (Compta), la 5ᵉ place dit CET écran ;
//   B7. un balayage parti du bord gauche (le « retour » d'iOS) ne change pas
//       d'onglet ; un balayage au milieu en change toujours (rien de coupé) ;
//   B8. toucher l'onglet où l'on est ramène en haut, sans changer d'écran ;
//   B9. le retour entre écrans marche : Journée → Ventes → Colis, ← Ventes, ← Journée.
// R. LA REPRISE (390 tactile) :
//   R1. rechargement : même écran, même filtre de site, même compte choisi ;
//   R2. app rouverte (nouvelle page, `sessionStorage` vide, même appareil) :
//       même écran, même onglet de Colis ;
//   R3. app rouverte : même recherche tapée, même défilement ;
//   R4. un lien `?tab=` reçu GAGNE sur la reprise ;
//   R5. rien de rangé ⇒ Ma journée (aucun écran deviné).
// O. L'ORDINATEUR (1512 × 950, puis fenêtres d'Edge : 1512 × 830, 1008 × 633
//    à 150 %, zoom de l'app 125 %) : aucun libellé de la colonne coupé, le
//    mot « VRM » entier, et rien ne passe PAR-DESSUS la colonne.
// O2. (revue du 5 nov.) LA CAUSE DES LIBELLÉS COUPÉS : le bloc « Recharger »
//    (numéros périmés, la capture Edge de Julien) rendu dans <main> héritait de
//    la largeur bornée des écrans d'ordinateur (1360 px centrés) : à 1512 px il
//    commençait à 76 px, la colonne restait visible et TOUCHABLE dessous
//    (« Ven », « Gér », « Arg », « Plat », « VI ») et l'écran lisible à droite.
//    Servi ici par une version de numérotation relue différente. Il doit
//    couvrir TOUTE la fenêtre (390 tactile, 1512 × 950 clair, 1512 × 830 sombre).
//
// `BANC_PORT` (défaut 7951), `CAPTURES=<dossier>` pour garder les captures,
// `BANC_PARTIE=B|R|O|O2` pour une seule partie.
'use strict';
require('./_porte-banc.cjs');
const path = require('path');
const PW = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { chromium } = PW;
// (6 nov., filet 6) `NAVIGATEUR=webkit` : le moteur de Safari (_navigateur.cjs).
const { lancer } = require('./_navigateur.cjs');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 7951;
const CAPTURES = process.env.CAPTURES || '';
const PARTIE = process.env.BANC_PARTIE || '';
let VERSION_NUAGE = null;

const maintenant = new Date(2026, 9, 31, 15, 30, 0);
const DEBUT = Date.now();
const il = (n, h = 12) => { const d = new Date(maintenant); d.setHours(h, 0, 0, 0); d.setDate(d.getDate() - n); return d; };
const vente = (id, titre, prix, statut, d, extra = {}) => ({ transaction_id: id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, status: statut, date: d.toISOString(), ...extra });
const MODELES = ['Nike Dunk Low panda', 'Adidas Gazelle bleu', 'Salomon XT-4 noir', 'Asics Gel-1130 blanc', 'New Balance 550 vert', 'Puma Suede rouge'];
const annonces = (base, n) => Array.from({ length: n }, (_, k) => ({ id: base + k, title: `${MODELES[k % MODELES.length]} taille ${38 + (k % 7)}`, price: { amount: String(35 + k * 3), currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false, created_at_ts: il(10 + k).toISOString() }));
const ventes = (base, n) => Array.from({ length: n }, (_, k) => vente(base + k, `${MODELES[(k + 2) % MODELES.length]} taille ${39 + (k % 5)}`, 40 + k * 4, k < 2 ? 'Le paiement a été validé' : 'Commande finalisée', il(k % 20, 10 + (k % 8)), { transaction_user_status: k < 2 ? 'needs_action' : 'completed' }));
const ACCOUNTS = [
  { id: 1, vinted_user_id: '111', login: 'boutique_demo', domain: 'www.vinted.fr', updated_at: maintenant.toISOString() },
  { id: 2, vinted_user_id: '222', login: 'atelier_test', domain: 'www.vinted.fr', updated_at: maintenant.toISOString() },
];
const cap = maintenant.toISOString();
const LIGNES = [
  { id: 'harvest_111_orders_sold', data: { capturedAt: cap, payload: { my_orders: ventes(7000, 18) } } },
  { id: 'harvest_222_orders_sold', data: { capturedAt: cap, payload: { my_orders: ventes(7100, 12) } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: cap, payload: { my_orders: [vente(8002, 'Asics Gel-Kayano 14 argent taille 42', 60, 'Le colis a été déposé au point relais', il(2), { transaction_user_status: 'needs_action' })] } } },
  { id: 'harvest_111_listings', data: { capturedAt: cap, payload: { items: annonces(6000, 30), pagination: { total_entries: 30 } } } },
  { id: 'harvest_222_listings', data: { capturedAt: cap, payload: { items: annonces(6100, 12), pagination: { total_entries: 12 } } } },
  { id: 'lbc_ventes', data: { ventes: { 'lbc-tx-1': { txId: 'lbc-tx-1', itemId: 900001, isSeller: true, title: 'Nike Air Max 90 blanche taille 42', price: 7000, dateVente: il(1, 15).toISOString(), stepStatus: 'done', at: il(0, 8).toISOString() } } } },
  { id: 'lbc_listings', data: { items: {}, lectures: {} } },
  { id: 'vrm_colis_aposter_srv', data: {} },
];

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (!c && d !== undefined ? ' — ' + String(d).slice(0, 300) : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 200)); } };

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });

// UN APPAREIL = un contexte (son localStorage). Une page = une ouverture de l'app.
const appareil = async (b, mode, local = {}) => {
  const tel = mode !== 'ordi';
  const vp = mode === 'se' ? { width: 375, height: 667 } : tel ? { width: 390, height: 844 } : { width: 1512, height: 950 };
  const ctx = await b.newContext(tel ? { viewport: vp, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: vp });
  await ctx.addInitScript((loc) => { try { if (!localStorage.getItem('__banc_pose__')) { localStorage.setItem('__banc_pose__', '1'); localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_prenom', JSON.stringify('Julien')); localStorage.setItem('vrm_bascule_mineral_v1', '1'); localStorage.setItem('vrm_bienvenue_vue', JSON.stringify({ at: '2026-10-01T00:00:00Z' })); for (const [k, v] of Object.entries(loc || {})) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); } } catch (_) {} }, local);
  await ctx.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await ctx.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    if (route.request().method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    // O2 : une version de numérotation relue différente de celle chargée ⇒ bloc « Recharger ».
    if (VERSION_NUAGE && /vrm_numerotation->>version/.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ v: VERSION_NUAGE }]) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
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
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return ctx;
};
const ouvrirPage = async (ctx, query = '') => {
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  // L'horloge de chaque ouverture CONTINUE celle d'avant (une app rouverte ne
  // remonte pas le temps : une valeur rangée « dans le futur » serait refusée).
  await pg.clock.install({ time: maintenant.getTime() + (Date.now() - DEBUT) });
  await pg.goto(`http://localhost:${PORT}/${query}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => document.querySelector('.vrm-main') || /pas pu s'afficher/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
  await pg.waitForTimeout(2800);
  return { pg, errs };
};
const capture = async (pg, nom) => { if (!CAPTURES) return; try { fs.mkdirSync(CAPTURES, { recursive: true }); await pg.screenshot({ path: path.join(CAPTURES, nom + '.png'), fullPage: false }); } catch (_) {} };
const ecran = (pg) => pg.evaluate(() => {
  const m = document.querySelector('.vrm-main');
  const t = document.querySelector('[data-tache]');
  const actif = document.querySelector('.vrm-tabbar > [aria-current="page"]');
  return {
    ecran: m ? m.getAttribute('data-ecran') : '',
    site: t ? t.getAttribute('data-tache-site') : '',
    barre: actif ? (actif.getAttribute('data-nav-entree') || 'plus') : '',
    colis: (document.querySelector('[data-colis-onglet]') || { getAttribute: () => '' }).getAttribute('data-colis-onglet'),
    puce: (document.querySelector('[data-compte-puce][data-actif="1"]') || { getAttribute: () => '' }).getAttribute('data-compte-puce'),
    recherche: (document.querySelector('input[aria-label="Rechercher une annonce"]') || { value: null }).value,
    defile: m ? Math.round(m.scrollTop) : -1,
    url: location.href,
  };
});
// Un balayage au doigt, en évènements tactiles DE LA PAGE : seul VRM les voit
// (le navigateur n'y joue pas son propre « retour » de bord d'écran), on juge
// donc ce que fait VRM, et lui seul.
const balayer = async (ctx, pg, x0, x1, y) => {
  await pg.evaluate(([x0, x1, y]) => {
    const cible = document.elementFromPoint(x0 < 1 ? 1 : x0, y) || document.querySelector('.vrm-main');
    const t = (x) => new Touch({ identifier: 1, target: cible, clientX: x, clientY: y, pageX: x, pageY: y, screenX: x, screenY: y });
    const ev = (type, x, liste) => cible.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: liste ? [t(x)] : [], targetTouches: liste ? [t(x)] : [], changedTouches: [t(x)] }));
    ev('touchstart', x0, true);
    for (let k = 1; k <= 6; k++) ev('touchmove', x0 + (x1 - x0) * k / 6, true);
    ev('touchend', x1, false);
  }, [x0, x1, y]);
  await pg.waitForTimeout(800);
};
const toucher = async (pg, sel) => { const l = pg.locator(sel).first(); if (!(await l.count())) { console.log(`     (absent : ${sel})`); return false; } await l.tap({ timeout: 5000 }).catch(() => {}); await pg.waitForTimeout(800); return true; };
const PLUS = '.vrm-tabbar button[aria-label="Plus"]';

// La barre, mesurée.
const mesureBarre = (pg) => pg.evaluate(() => {
  const nav = document.querySelector('.vrm-tabbar'); if (!nav) return null;
  const r = nav.getBoundingClientRect();
  const entrees = [...nav.querySelectorAll(':scope > button')].map((x) => {
    const q = x.getBoundingClientRect(); const lab = x.querySelector('.vrm-nav-label');
    const hit = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2);
    return { id: x.getAttribute('data-nav-entree') || 'plus', h: Math.round(q.height), w: Math.round(q.width), coupe: lab ? lab.scrollWidth > lab.clientWidth + 1 : true, touche: !!hit && x.contains(hit) };
  });
  const nombres = [...nav.querySelectorAll('[data-badge-n]')].map((x) => x.getAttribute('data-badge-n')).filter((n) => /^\d+$/.test(n));
  // La zone sûre : la règle qui gagne doit la porter (Chromium vaut env() = 0).
  let zoneSure = false;
  for (const ss of document.styleSheets) { let rr; try { rr = ss.cssRules; } catch (_) { continue; } const tous = []; const plat = (l) => { for (const x of l) { if (x.selectorText) tous.push(x); if (x.cssRules && x.cssRules.length) plat(x.cssRules); } }; plat(rr); for (const x of tous) { if (x.selectorText && /\.vrm-tabbar\b/.test(x.selectorText) && x.style && /safe-area-inset-bottom/.test(x.style.getPropertyValue('padding-bottom'))) zoneSure = true; } }
  return { bas: Math.round(r.bottom), haut: Math.round(r.top), vh: innerHeight, vw: innerWidth, docW: document.documentElement.scrollWidth, entrees, nombres, zoneSure };
});
const mesurePanneau = (pg) => pg.evaluate(() => {
  const m = document.querySelector('.vrm-sheet'); if (!m) return null;
  const q = m.getBoundingClientRect(); const nav = document.querySelector('.vrm-tabbar').getBoundingClientRect();
  const entrees = [...m.querySelectorAll('[data-nav-entree]')].map((e) => { const r = e.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); const lib = e.querySelector('.vrm-sheet-lib'); return { id: e.getAttribute('data-nav-entree'), h: Math.round(r.height), visible: r.top >= 0 && r.bottom <= Math.min(innerHeight, nav.top) + 1, touche: !!hit && e.contains(hit), coupe: lib ? lib.scrollWidth > lib.clientWidth + 1 : false }; });
  return { bas: Math.round(q.bottom), navHaut: Math.round(nav.top), defile: m.scrollHeight > m.clientHeight + 1, entrees, plusOuvert: document.querySelector('.vrm-tabbar button[aria-label="Plus"]').getAttribute('aria-expanded') };
});

(async () => {
  await new Promise((res) => srv.listen(PORT, res));
  const b = await lancer(PW, { executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader'] });
  try {
    if (!PARTIE || PARTIE === 'B') for (const sombre of [false, true]) for (const mode of ['tel', 'se']) {
      const qui = `${mode === 'se' ? '375×667' : '390×844'} ${sombre ? 'sombre' : 'clair'}`;
      console.log(`── B. la barre · ${qui}`);
      await essaie(`B ${qui}`, async () => {
        const ctx = await appareil(b, mode, { vinted_dark: sombre, vrm_colis_aposter: { total: 2, enRetard: 0, vinted: 2, ebay: 0, at: maintenant.getTime() } });
        let { pg, errs } = await ouvrirPage(ctx, '?tab=journee');
        const m = await mesureBarre(pg);
        await capture(pg, `barre-${mode}-${sombre ? 'sombre' : 'clair'}`);
        dit(!!m && m.entrees.length === 5, `B1 ${qui} : cinq entrées`, JSON.stringify(m && m.entrees.map((e) => e.id)));
        dit(!!m && m.entrees.every((e) => e.h >= 44 && e.w >= 44), `B1 ${qui} : chaque entrée ≥ 44 px`, JSON.stringify(m && m.entrees.map((e) => [e.w, e.h])));
        dit(!!m && m.entrees.every((e) => !e.coupe), `B1 ${qui} : aucun libellé coupé`, JSON.stringify(m && m.entrees.filter((e) => e.coupe).map((e) => e.id)));
        dit(!!m && m.entrees.every((e) => e.touche), `B1 ${qui} : le toucher au centre tombe sur l'entrée`, JSON.stringify(m && m.entrees.filter((e) => !e.touche).map((e) => e.id)));
        dit(!!m && m.docW <= m.vw && m.bas === m.vh, `B1 ${qui} : rien ne déborde, la barre touche le bas`, JSON.stringify(m && { docW: m.docW, vw: m.vw, bas: m.bas, vh: m.vh }));
        dit(!!m && m.zoneSure, `B1 ${qui} : la barre porte la zone sûre (safe-area-inset-bottom)`);
        dit(!!m && new Set(m.nombres).size === m.nombres.length, `B2 ${qui} : un nombre une seule fois dans la barre (§7)`, JSON.stringify(m && m.nombres));
        // B3 · « Plus » ouvert
        await toucher(pg, PLUS);
        // Le panneau glisse de 16 px à l'ouverture : on mesure une fois l'animation finie (sinon un faux rouge de 16 px).
        await pg.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {})))).catch(() => {});
        const p = await mesurePanneau(pg);
        await capture(pg, `plus-${mode}-${sombre ? 'sombre' : 'clair'}`);
        dit(!!p && p.plusOuvert === 'true', `B3 ${qui} : « Plus » ouvert le dit (aria-expanded)`);
        dit(!!p && p.bas <= p.navHaut + 1, `B3 ${qui} : le panneau ne recouvre pas la barre`, JSON.stringify(p && { bas: p.bas, navHaut: p.navHaut }));
        dit(!!p && p.entrees.length >= 9 && p.entrees.every((e) => e.visible) && !p.defile, `B3 ${qui} : toutes les entrées visibles sans défiler`, JSON.stringify(p && { horsVue: p.entrees.filter((e) => !e.visible).map((e) => e.id), defile: p.defile }));
        dit(!!p && p.entrees.every((e) => e.h >= 44 && e.touche && !e.coupe), `B3 ${qui} : entrées ≥ 44 px, touchables, libellés entiers`, JSON.stringify(p && p.entrees.filter((e) => !(e.h >= 44 && e.touche && !e.coupe))));
        // B4 · retour avec « Plus » ouvert
        await pg.goBack({ timeout: 3000 }).catch(() => {}); await pg.waitForTimeout(800);
        const e4 = await ecran(pg).catch(() => ({ url: 'perdu' }));
        dit(/^http:\/\/localhost/.test(e4.url) && e4.ecran === 'journee', `B4 ${qui} : « retour » ferme « Plus » et reste dans VRM, sur Ma journée`, JSON.stringify(e4));
        dit(!(await pg.locator('.vrm-sheet').count().catch(() => 1)), `B4 ${qui} : le panneau est fermé`);
        // Avant le 5 nov., le retour QUITTAIT VRM : on rouvre l'app pour juger la suite.
        let pg2 = pg;
        if (!/^http:\/\/localhost/.test(e4.url)) { await pg.close().catch(() => {}); ({ pg: pg2 } = await ouvrirPage(ctx, '?tab=journee')); }
        pg = pg2;
        // B5 · Plus, Plus ; Plus puis Ventes
        await toucher(pg, PLUS); await toucher(pg, PLUS);
        dit(!(await pg.locator('.vrm-sheet').count()), `B5 ${qui} : toucher « Plus » une 2ᵉ fois le referme`);
        await toucher(pg, PLUS); await toucher(pg, '.vrm-tabbar [data-nav-entree="ventes"]');
        const e5 = await ecran(pg);
        dit(e5.ecran === 'ventes' && !(await pg.locator('.vrm-sheet').count()), `B5 ${qui} : panneau ouvert, toucher Ventes y va et le ferme`, JSON.stringify(e5));
        // B6 · un écran de « Plus »
        await toucher(pg, PLUS); await toucher(pg, '.vrm-sheet [data-nav-entree="compta"]');
        const e6 = await pg.evaluate(() => { const x = document.querySelector('.vrm-tabbar button[aria-label="Plus"]'); return { ecran: document.querySelector('.vrm-main').getAttribute('data-ecran'), plusEcran: x.getAttribute('data-plus-ecran') || '', courant: x.getAttribute('aria-current') || '' }; });
        await capture(pg, `compta-${mode}-${sombre ? 'sombre' : 'clair'}`);
        dit(e6.ecran === 'compta' && e6.plusEcran === 'compta' && e6.courant === 'page', `B6 ${qui} : sur Compta, la 5ᵉ place dit Compta`, JSON.stringify(e6));
        const m6 = await mesureBarre(pg);
        dit(m6.entrees.every((e) => !e.coupe), `B6 ${qui} : son libellé n'est pas coupé`, JSON.stringify(m6.entrees.filter((e) => e.coupe)));
        // Chaque écran de « Plus » : la 5ᵉ place le dit, libellé entier.
        const vus = [];
        for (const id of ['messages', 'garage', 'achats', 'dashboard', 'communaute', 'settings']) {
          await toucher(pg, PLUS); await toucher(pg, `.vrm-sheet [data-nav-entree="${id}"]`);
          const x = await pg.evaluate(() => { const b = document.querySelector('.vrm-tabbar button[aria-label="Plus"]'); const l = b.querySelector('.vrm-nav-label'); return { e: b.getAttribute('data-plus-ecran'), coupe: l.scrollWidth > l.clientWidth + 1, lib: l.innerText }; });
          vus.push({ id, ...x });
        }
        dit(vus.every((v) => v.e === v.id && !v.coupe), `B6 ${qui} : Messages, Stock, Achats, Stats, Communauté, Réglages — la 5ᵉ place dit l'écran, libellé entier`, JSON.stringify(vus));
        // B7 · balayages
        await toucher(pg, '.vrm-tabbar [data-nav-entree="ventes"]');
        const avant7 = await ecran(pg);
        await balayer(ctx, pg, 4, 220, 420);
        const e7 = await ecran(pg);
        // Le bord appartient au système (le « retour » de Safari sur iPhone) :
        // VRM ne doit PAS y ajouter son changement d'onglet (l'onglet voisin).
        dit(avant7.ecran === 'ventes' && e7.ecran === 'ventes', `B7 ${qui} : un balayage parti du bord gauche est laissé au système (VRM ne change pas d'onglet)`, JSON.stringify({ avant: avant7.ecran, apres: e7.ecran }));
        await balayer(ctx, pg, 200, 40, 420);
        const e7b = await ecran(pg);
        dit(e7b.ecran === 'cat_bord', `B7 ${qui} : un balayage au milieu change toujours d'onglet (Ventes → Colis)`, JSON.stringify(e7b));
        // B8 · retoucher l'onglet courant
        await toucher(pg, '.vrm-tabbar [data-nav-entree="annonces"]');
        await pg.evaluate(() => { document.querySelector('.vrm-main').scrollTop = 400; }); await pg.waitForTimeout(300);
        const avant8 = await ecran(pg);
        await toucher(pg, '.vrm-tabbar [data-nav-entree="annonces"]'); await pg.waitForTimeout(600);
        const e8 = await ecran(pg);
        dit(avant8.defile > 100 && e8.ecran === 'annonces' && e8.defile < 5, `B8 ${qui} : toucher l'onglet courant ramène en haut, même écran`, JSON.stringify({ avant: avant8.defile, apres: e8.defile, ecran: e8.ecran }));
        // B9 · le retour entre écrans
        await toucher(pg, '.vrm-tabbar [data-nav-entree="journee"]');
        await toucher(pg, '.vrm-tabbar [data-nav-entree="ventes"]');
        await toucher(pg, '.vrm-tabbar [data-nav-entree="cat_bord"]');
        await pg.goBack().catch(() => {}); await pg.waitForTimeout(700); const r1 = (await ecran(pg)).ecran;
        await pg.goBack().catch(() => {}); await pg.waitForTimeout(700); const r2 = (await ecran(pg)).ecran;
        dit(r1 === 'ventes' && r2 === 'journee', `B9 ${qui} : retour Colis → Ventes → Journée`, `${r1} puis ${r2}`);
        dit(errs.length === 0, `B ${qui} : aucune erreur de page`, errs.join(' | '));
        await ctx.close();
      });
    }

    if (!PARTIE || PARTIE === 'R') for (const sombre of [false, true]) {
      const qui = `390 ${sombre ? 'sombre' : 'clair'}`;
      console.log(`── R. la reprise · ${qui}`);
      await essaie(`R ${qui}`, async () => {
        const ctx = await appareil(b, 'tel', { vinted_dark: sombre });
        // R5 · rien de rangé
        let { pg } = await ouvrirPage(ctx);
        dit((await ecran(pg)).ecran === 'journee', `R5 ${qui} : rien de rangé ⇒ Ma journée`);
        // R1 · Ventes · Leboncoin, rechargement
        await toucher(pg, '.vrm-tabbar [data-nav-entree="ventes"]');
        await toucher(pg, '[data-filtre-site] button[data-site="leboncoin"]');
        await pg.reload({ waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(3000);
        const r1 = await ecran(pg);
        dit(r1.ecran === 'ventes' && r1.site === 'leboncoin', `R1 ${qui} : rechargé, même écran (Ventes) et même filtre (Leboncoin)`, JSON.stringify(r1));
        // R1 · compte choisi (Ventes · Vinted, compte 222)
        await toucher(pg, '[data-filtre-site] button[data-site="vinted"]');
        await toucher(pg, '[data-compte-puce="222"]');
        await pg.reload({ waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(3000);
        const r1b = await ecran(pg);
        dit(r1b.ecran === 'ventes' && r1b.site === 'vinted' && r1b.puce === '222', `R1 ${qui} : rechargé, même compte choisi`, JSON.stringify(r1b));
        // R2 · Colis · À retirer, app rouverte
        await toucher(pg, '.vrm-tabbar [data-nav-entree="cat_bord"]');
        await toucher(pg, '[data-colis-onglet-choix="retirer"]');
        const r2avant = await ecran(pg);
        await pg.close();
        ({ pg } = await ouvrirPage(ctx));
        const r2 = await ecran(pg);
        await capture(pg, `reprise-colis-${sombre ? 'sombre' : 'clair'}`);
        dit(r2avant.colis === 'retirer' && r2.ecran === 'cat_bord' && r2.colis === 'retirer', `R2 ${qui} : rouverte, même écran (Colis) et même onglet (À retirer)`, JSON.stringify({ avant: r2avant.colis, apres: r2 }));
        // R3 · Annonces : recherche + défilement, app rouverte
        await toucher(pg, '.vrm-tabbar [data-nav-entree="annonces"]');
        await toucher(pg, '[data-filtre-site] button[data-site="vinted"]');
        const champ = pg.locator('input[aria-label="Rechercher une annonce"]').first();
        if (await champ.count()) { await champ.fill('taille'); await pg.waitForTimeout(600); await pg.evaluate(() => document.activeElement && document.activeElement.blur()); }
        await pg.waitForTimeout(400);
        await pg.evaluate(() => { document.querySelector('.vrm-main').scrollTop = 600; }); await pg.waitForTimeout(500);
        const r3avant = await ecran(pg);
        await pg.evaluate(() => { try { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); } catch (_) {} });
        await pg.close();
        ({ pg } = await ouvrirPage(ctx));
        await pg.waitForTimeout(800);
        const r3 = await ecran(pg);
        await capture(pg, `reprise-annonces-${sombre ? 'sombre' : 'clair'}`);
        dit(r3.ecran === 'annonces' && r3.site === 'vinted' && r3.recherche === 'taille', `R3 ${qui} : rouverte, même écran, même filtre, même recherche`, JSON.stringify(r3));
        dit(r3avant.defile > 200 && Math.abs(r3.defile - r3avant.defile) <= 4, `R3 ${qui} : rouverte, même défilement`, JSON.stringify({ avant: r3avant.defile, apres: r3.defile }));
        // R4 · un lien reçu gagne
        await pg.close();
        ({ pg } = await ouvrirPage(ctx, '?tab=compta'));
        const r4 = await ecran(pg);
        dit(r4.ecran === 'compta', `R4 ${qui} : un lien ?tab=compta gagne sur la reprise (Annonces)`, JSON.stringify(r4));
        await ctx.close();
      });
    }

    if (!PARTIE || PARTIE === 'O') {
      const cas = [
        { w: 1512, h: 950 }, { w: 1512, h: 950, sombre: true }, { w: 1512, h: 830 }, { w: 1008, h: 633 }, { w: 1512, h: 950, zoom: '1.25' },
      ];
      for (const c of cas) {
        const qui = `${c.w}×${c.h}${c.zoom ? ' zoom ' + c.zoom : ''} ${c.sombre ? 'sombre' : 'clair'}`;
        console.log(`── O. la colonne · ${qui}`);
        await essaie(`O ${qui}`, async () => {
          const loc = { vinted_dark: !!c.sombre }; if (c.zoom) loc.vrm_zoom = c.zoom;
          const ctx = await appareil(b, 'ordi', loc);
          const { pg } = await ouvrirPage(ctx, '?tab=journee');
          await pg.setViewportSize({ width: c.w, height: c.h }); await pg.waitForTimeout(900);
          const r = await pg.evaluate(() => {
            const side = document.querySelector('.vrm-sidebar'); if (!side) return null;
            const sr = side.getBoundingClientRect();
            const libs = [...side.querySelectorAll('.vrm-rail-lib, .vrm-rail-section-label, .vrm-sidebar-mot')].filter((e) => e.getClientRects().length);
            const coupes = libs.filter((e) => { const q = e.getBoundingClientRect(); return e.scrollWidth > e.clientWidth + 1 || q.right > sr.right + 1 || q.left < sr.left - 1; }).map((e) => e.innerText);
            // Rien PAR-DESSUS la colonne : au milieu de chaque libellé visible, c'est la colonne qu'on touche.
            const recouverts = libs.filter((e) => { const q = e.getBoundingClientRect(); if (q.bottom < 0 || q.top > innerHeight) return false; const h = document.elementFromPoint(q.left + Math.min(q.width - 1, 30), q.top + q.height / 2); return !h || !side.contains(h); }).map((e) => e.innerText);
            const mot = side.querySelector('.vrm-sidebar-mot');
            return { coupes, recouverts, mot: mot ? mot.innerText : '', largeur: Math.round(sr.width), groupes: [...side.querySelectorAll('.vrm-rail-section-label')].map((e) => e.innerText) };
          });
          await capture(pg, `colonne-${c.w}x${c.h}${c.zoom ? '-z' : ''}-${c.sombre ? 'sombre' : 'clair'}`);
          dit(!!r && r.mot === 'VRM' && r.coupes.length === 0, `O ${qui} : « VRM » entier et aucun libellé de la colonne coupé`, JSON.stringify(r));
          dit(!!r && r.recouverts.length === 0, `O ${qui} : rien ne passe par-dessus la colonne`, JSON.stringify(r && r.recouverts));
          dit(!!r && ['Vendre', 'Gérer', 'Argent', 'Plateformes'].every((g) => r.groupes.includes(g)), `O ${qui} : les groupes Vendre · Gérer · Argent · Plateformes sont là, en entier`, JSON.stringify(r && r.groupes));
          await ctx.close();
        });
      }
    }
    if (!PARTIE || PARTIE === 'O2') {
      VERSION_NUAGE = '99';
      for (const c of [{ mode: 'ordi', w: 1512, h: 950 }, { mode: 'ordi', w: 1512, h: 830, sombre: true }, { mode: 'tel', w: 390, h: 844 }]) {
        const qui = `${c.w}×${c.h} ${c.sombre ? 'sombre' : 'clair'}`;
        console.log(`── O2. le bloc « Recharger » couvre tout · ${qui}`);
        await essaie(`O2 ${qui}`, async () => {
          const ctx = await appareil(b, c.mode, { vinted_dark: !!c.sombre });
          const { pg } = await ouvrirPage(ctx, '?tab=compta');
          if (c.mode === 'ordi') await pg.setViewportSize({ width: c.w, height: c.h });
          await pg.waitForSelector('[data-numeros-perimes]', { timeout: 15000 }).catch(() => {});
          await pg.waitForTimeout(600);
          const r = await pg.evaluate(() => {
            const bl = document.querySelector('[data-numeros-perimes]'); if (!bl) return null;
            const q = bl.getBoundingClientRect();
            const dedans = (x, y) => { const h = document.elementFromPoint(x, y); return !!h && bl.contains(h); };
            const side = document.querySelector('.vrm-sidebar');
            const libs = side ? [...side.querySelectorAll('.vrm-rail-lib, .vrm-rail-section-label, .vrm-sidebar-mot')].filter((e) => e.getClientRects().length) : [];
            const railVisible = libs.filter((e) => { const r = e.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && !dedans(r.left + 4, r.top + r.height / 2); }).map((e) => e.innerText);
            const coins = [[2, 2], [innerWidth - 3, 2], [2, innerHeight - 3], [innerWidth - 3, innerHeight - 3], [innerWidth - 20, innerHeight / 2], [20, innerHeight / 2]];
            return { rect: [q.left, q.top, q.width, q.height].map(Math.round), vw: innerWidth, vh: innerHeight, railVisible, coins: coins.map(([x, y]) => dedans(x, y)) };
          });
          await capture(pg, `recharger-${c.w}x${c.h}-${c.sombre ? 'sombre' : 'clair'}`);
          dit(!!r, `O2 ${qui} : le bloc « Recharger » est là`);
          dit(!!r && r.rect[0] === 0 && r.rect[1] === 0 && r.rect[2] === r.vw && r.rect[3] === r.vh, `O2 ${qui} : il couvre toute la fenêtre`, JSON.stringify(r && { rect: r.rect, vw: r.vw, vh: r.vh }));
          dit(!!r && r.coins.every(Boolean), `O2 ${qui} : bords et coins touchent le bloc (rien de lisible ni de touchable à côté)`, JSON.stringify(r && r.coins));
          dit(!!r && r.railVisible.length === 0, `O2 ${qui} : la colonne n'apparaît pas dessous (aucun « Ven », « Gér », « VI »)`, JSON.stringify(r && r.railVisible));
          await ctx.close();
        });
      }
      VERSION_NUAGE = null;
    }
  } finally {
    await b.close(); srv.close();
  }
  console.log(`\n${ok} vérifications OK, ${ko} en échec`);
  process.exit(ko ? 1 : 0);
})();
