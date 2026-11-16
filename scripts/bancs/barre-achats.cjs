// BANC — LA BARRE DU BAS : ACHATS DEDANS, PLUS AUCUN GLISSER ENTRE ONGLETS
// (16 nov., lot barre-achats — Julien, capture iPhone : en glissant du doigt, l'écran passait
// d'Argent à Ma journée à moitié. « Je ne veux pas qu'on puisse glisser entre les onglets » ;
// « si on peut, ajoute les Achats dans la barre en bas »).
//
// Données INVENTÉES (le dépôt est public). Juge des attributs, des boîtes et des nombres rendus.
// A. LA BARRE (390 × 844 tactile et 320 × 568 tactile, clair et sombre) :
//   A1. Aujourd'hui · Annonces · Achats · « + » · Ventes · Argent ;
//   A2. chaque cible ≥ 44 × 44, aucun chevauchement, libellés entiers (≥ 9 px), toucher juste ;
//   A3. Achats porte son compteur (À retirer), une fois ;
//   A4. toucher un onglet ⇒ son écran, lui seul allumé ;
//   A5. passer d'un onglet de la barre à l'autre n'empile AUCUNE entrée d'historique : le retour
//       du système (bord gauche d'iPhone) n'a plus d'onglet voisin à montrer à moitié ;
//   A6. glisser de côté sur le contenu (doigt réel, touchers de page ; milieu et bord) ne change
//       jamais d'écran, l'écran ne bouge pas de côté ;
//   A7. un glisser vertical défile, jamais de côté ; overscroll-behavior-x: none ;
//   A8. une rangée qui défile de côté (filtres…) défile toujours au doigt ;
//   A9. le retour reste entier : il ferme le menu ; Messages (menu) ⇒ retour ⇒ Argent ;
//   A10. le disque « + » (plus au milieu) ouvre son éventail, toutes ses lames dans l'écran.
// L. LES LIENS ?tab= (390 et 1512) : chaque écran, anciens liens compris (retraits, cat_achats),
//    allume SON onglet ; Achats dans la colonne de l'ordinateur ; le sélecteur de Paires sans Achats.
//
// `BANC_PORT` (défaut 7963), `CAPTURES=<dossier>`.
'use strict';
require('./_porte-banc.cjs');
const path = require('path');
const PW = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { chromium } = PW;
// (6 nov., filet 6) `NAVIGATEUR=webkit` : le moteur de Safari (_navigateur.cjs).
const { lancer } = require('./_navigateur.cjs');
const { metaVersData } = require('./_meta.cjs');
const { getPath } = require('./_minipgrest.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 7963;
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
  const vp = mode === 'p320' ? { width: 320, height: 568 } : mode === 'se' ? { width: 375, height: 667 } : tel ? { width: 390, height: 844 } : { width: 1512, height: 950 };
  const ctx = await b.newContext(tel ? { viewport: vp, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: vp });
  await ctx.addInitScript((loc) => { try { if (!localStorage.getItem('__banc_pose__')) { localStorage.setItem('__banc_pose__', '1'); localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_prenom', JSON.stringify('Julien')); localStorage.setItem('vrm_bascule_mineral_v1', '1'); localStorage.setItem('vrm_bienvenue_vue', JSON.stringify({ at: '2026-10-01T00:00:00Z' })); for (const [k, v] of Object.entries(loc || {})) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); } } catch (_) {} }, local);
  await ctx.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) || /^https?:\/\/[^/]*vinted\.net\//i.test(r.request().url()) ? r.abort() : r.continue()));
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
  // (11 nov., webkit-fiable) L'horloge de Playwright est celle du CONTEXTE : l'installer une
  // 2ᵉ fois (page suivante du même appareil) lève sous WebKit (« __pwClock.controller »,
  // mesuré en CI : toute la partie R tombait). Installée une fois, puis seulement avancée.
  const t0 = maintenant.getTime() + (Date.now() - DEBUT);
  if (!ctx.__vrmHorloge) { await pg.clock.install({ time: t0 }); ctx.__vrmHorloge = true; }
  else await pg.clock.setSystemTime(t0);
  await pg.goto(`http://localhost:${PORT}/${query}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => document.querySelector('.vrm-main') || /pas pu s'afficher/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
  await pg.waitForTimeout(2800);
  return { pg, errs };
};
const capture = async (pg, nom) => { if (!CAPTURES) return; try { fs.mkdirSync(CAPTURES, { recursive: true }); await pg.screenshot({ path: path.join(CAPTURES, nom + '.png'), fullPage: false }); } catch (_) {} };
const CHAMP_ANNONCES = '[data-ann-recherche] input, input[aria-label="Rechercher une annonce"]';
const ecran = (pg) => pg.evaluate((CHAMP_ANNONCES) => {
  const m = document.querySelector('.vrm-main');
  const t = document.querySelector('[data-tache]');
  const actif = document.querySelector('.vrm-tabbar > [aria-current="page"]');
  return {
    ecran: m ? m.getAttribute('data-ecran') : '',
    site: t ? t.getAttribute('data-tache-site') : '',
    barre: actif ? (actif.getAttribute('data-nav-entree') || 'plus') : '',
    colis: (document.querySelector('[data-colis-onglet]') || { getAttribute: () => '' }).getAttribute('data-colis-onglet'),
    puce: (document.querySelector('[data-compte-puce][data-actif="1"]') || { getAttribute: () => '' }).getAttribute('data-compte-puce'),
    // Le champ de recherche d'Annonces par son crochet `data-ann-recherche` (le libellé a changé
    // le 5 nov., chantier C : « Rechercher une annonce (titre, marque, N°) ») ; l'ancien libellé
    // reste pour juger un arbre d'avant.
    recherche: (document.querySelector(CHAMP_ANNONCES) || { value: null }).value,
    defile: m ? Math.round(m.scrollTop) : -1,
    url: location.href,
  };
}, CHAMP_ANNONCES);

// ── Gestes ──────────────────────────────────────────────────────────────────
const toucher = async (pg, sel) => { const l = pg.locator(sel).first(); if (!(await l.count())) { console.log(`     (absent : ${sel})`); return false; } await l.tap({ timeout: 5000 }).catch(() => l.click({ timeout: 3000 }).catch(() => {})); await pg.waitForTimeout(700);
  await pg.waitForFunction(() => !document.querySelector('.vrm-tabbar[data-en-cours]'), null, { timeout: 4000 }).catch(() => {}); await pg.waitForTimeout(300); return true; };
const cliquer = async (pg, sel) => { const l = pg.locator(sel).first(); if (!(await l.count())) { console.log(`     (absent : ${sel})`); return false; } await l.click({ timeout: 5000 }).catch(() => {}); await pg.waitForTimeout(900); return true; };
// Un VRAI glisser de doigt : des touchers envoyés au NAVIGATEUR (CDP Input.dispatchTouchEvent), pas des
// événements fabriqués dans la page — le navigateur défile lui-même une rangée ou la page, comme au doigt.
const glisserDoigt = async (pg, x, y, dx, dy) => {
  const cdp = await pg.context().newCDPSession(pg);
  const pt = (k) => [{ x: Math.round(x + dx * k), y: Math.round(y + dy * k), id: 1, radiusX: 4, radiusY: 4, force: 1 }];
  try {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(0) });
    for (let k = 1; k <= 12; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(k / 12) }); await new Promise((r) => setTimeout(r, 16)); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } catch (e) { console.log('     (toucher refusé : ' + e.message + ')'); }
  await cdp.detach().catch(() => {}); await pg.waitForTimeout(600);
};
// Les touchers d'une page (ce que lirait un gestionnaire de balayage de la coque), du bord et du milieu.
const balayerEvenements = (pg, x0, x1, y) => pg.evaluate(([x0, x1, y]) => {
  const cible = document.elementFromPoint(Math.max(1, x0), y) || document.querySelector('.vrm-main');
  const t = (x) => { try { return new Touch({ identifier: 1, target: cible, clientX: x, clientY: y, pageX: x, pageY: y, screenX: x, screenY: y }); } catch (_) { return { identifier: 1, target: cible, clientX: x, clientY: y }; } };
  const ev = (type, x, liste) => { let e; try { e = new TouchEvent(type, { bubbles: true, cancelable: true, touches: liste ? [t(x)] : [], targetTouches: liste ? [t(x)] : [], changedTouches: [t(x)] }); } catch (_) { e = new Event(type, { bubbles: true, cancelable: true }); } cible.dispatchEvent(e); };
  ev('touchstart', x0, true); for (let k = 1; k <= 8; k++) ev('touchmove', x0 + (x1 - x0) * k / 8, true); ev('touchend', x1, false);
  for (const [type, x] of [['pointerdown', x0], ['pointermove', (x0 + x1) / 2], ['pointermove', x1], ['pointerup', x1]]) cible.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, buttons: type === 'pointerup' ? 0 : 1 }));
}, [x0, x1, y]).then(() => pg.waitForTimeout(700));

// L'onglet allumé (barre au téléphone, colonne à l'ordinateur) et l'écran affiché.
const etat = (pg) => pg.evaluate(() => {
  const m = document.querySelector('.vrm-main');
  const barre = document.querySelector('.vrm-tabbar > [aria-current="page"]');
  const rail = document.querySelector('.vrm-sidebar [data-nav-entree][aria-current="page"]');
  return { ecran: m ? m.getAttribute('data-ecran') : '', barre: barre ? barre.getAttribute('data-nav-entree') : '', rail: rail ? rail.getAttribute('data-nav-entree') : '',
    nBarreActifs: document.querySelectorAll('.vrm-tabbar > [aria-current="page"]').length, histo: history.length, st: history.state || {}, scrollX: Math.round(window.scrollX), mainX: m ? Math.round(m.scrollLeft) : -1 };
});
// La barre mesurée : entrées (boutons d'onglet ET disque), boîtes, libellés, toucher au centre.
const mesureBarre = (pg) => pg.evaluate(() => {
  const nav = document.querySelector('.vrm-tabbar'); if (!nav || !nav.offsetWidth) return null;
  const items = [...nav.querySelectorAll(':scope > button, :scope > .sb-disque, :scope > [data-disque]')].filter((x, i, a) => a.indexOf(x) === i && x.offsetWidth > 0);
  const entrees = items.map((x) => {
    const q = x.getBoundingClientRect(); const lab = x.querySelector('.vrm-nav-label');
    const hit = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2);
    return { id: x.getAttribute('data-nav-entree') || (x.classList.contains('sb-disque') ? 'disque' : '?'), x: q.left, r: q.right, w: Math.round(q.width), h: Math.round(q.height),
      coupe: lab ? lab.scrollWidth > lab.clientWidth + 1 : false, lib: lab ? lab.textContent : '', police: lab ? parseFloat(getComputedStyle(lab).fontSize) : 0, touche: !!hit && x.contains(hit) };
  });
  const r = nav.getBoundingClientRect();
  const badges = [...nav.querySelectorAll('[data-badge-nav]')].map((b) => [b.getAttribute('data-badge-nav'), b.getAttribute('data-badge-n')]);
  return { entrees, gauche: r.left, droite: r.right, vw: innerWidth, docW: document.documentElement.scrollWidth, badges };
});

const ATTENDU_BARRE = ['journee', 'paires', 'achats', 'disque', 'ventes', 'compta'];
// Chaque écran et l'onglet qui DOIT s'allumer (barre ; à l'ordinateur, l'entrée de la colonne).
const ECRANS = [
  { lien: 'journee', barre: 'journee', rail: 'journee' },
  { lien: 'annonces', barre: 'paires', rail: 'annonces' },
  { lien: 'garage', barre: 'paires', rail: 'garage' },
  { lien: 'achats', barre: 'achats', rail: 'achats' },
  { lien: 'ventes', barre: 'ventes', rail: 'ventes' },
  { lien: 'compta', barre: 'compta', rail: 'compta' },
  { lien: 'dashboard', barre: 'compta', rail: 'compta' },
  // Les anciens liens (notifications d'hier) : « Colis à retirer » et « Achats » d'avant mènent à Achats.
  { lien: 'retraits', ecran: 'achats', barre: 'achats', rail: 'achats' },
  { lien: 'cat_achats', ecran: 'achats', barre: 'achats', rail: 'achats' },
];

(async () => {
  await new Promise((res) => srv.listen(PORT, res));
  const b = await lancer(PW, { executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader'] });
  const local = { vrm_colis_retirer: { total: 3, at: maintenant.getTime() }, vrm_colis_aposter: { total: 2, enRetard: 0, vinted: 2, ebay: 0, at: maintenant.getTime() } };
  try {
    // ── A. LA BARRE (390 tactile, 320 tactile = iPhone SE 1re génération) ─────
    for (const mode of ['tel', 'p320']) for (const sombre of [false, true]) {
      const qui = `${mode === 'p320' ? '320' : '390'} ${sombre ? 'sombre' : 'clair'}`;
      console.log(`── A. la barre · ${qui}`);
      await essaie(`A ${qui}`, async () => {
        const ctx = await appareil(b, mode, { ...local, vinted_dark: sombre });
        const { pg, errs } = await ouvrirPage(ctx, '?tab=journee');
        // L'écran finit de se poser (lectures, bulles d'arrivée) : la barre est mesurée quand le toucher y arrive,
        // 4 essais au plus (jamais un délai seul) — le verdict porte sur la dernière mesure.
        let m = null;
        for (let k = 0; k < 4; k++) { m = await mesureBarre(pg); if (m && m.entrees.every((e) => e.touche)) break; await pg.waitForTimeout(1500); }
        await capture(pg, `barre-${mode}-${sombre ? 'sombre' : 'clair'}`);
        const ids = m ? m.entrees.map((e) => e.id) : [];
        dit(JSON.stringify(ids) === JSON.stringify(ATTENDU_BARRE), `A1 ${qui} : la barre = Aujourd'hui · Annonces · Achats · « + » · Ventes · Argent`, JSON.stringify(ids));
        const ach = m && m.entrees.find((e) => e.id === 'achats');
        dit(!!ach && ach.lib.trim().length > 0, `A1 ${qui} : l'onglet Achats porte son nom`, JSON.stringify(ach));
        dit(!!m && m.entrees.every((e) => e.w >= 44 && e.h >= 44), `A2 ${qui} : chaque cible ≥ 44 × 44 px`, JSON.stringify(m && m.entrees.map((e) => [e.id, e.w, e.h])));
        let chevauche = []; if (m) for (let k = 1; k < m.entrees.length; k++) if (m.entrees[k].x < m.entrees[k - 1].r - 0.5) chevauche.push([m.entrees[k - 1].id, m.entrees[k].id]);
        dit(!!m && !chevauche.length && m.entrees[0].x >= m.gauche - 0.5 && m.entrees[m.entrees.length - 1].r <= m.droite + 0.5, `A2 ${qui} : aucun chevauchement, tout dans la barre`, JSON.stringify(chevauche));
        dit(!!m && m.entrees.every((e) => !e.coupe) && m.entrees.filter((e) => e.id !== 'disque').every((e) => e.police >= 9), `A2 ${qui} : libellés entiers, lisibles (≥ 9 px)`, JSON.stringify(m && m.entrees.filter((e) => e.coupe || (e.id !== 'disque' && e.police < 9)).map((e) => [e.id, e.lib, e.police])));
        dit(!!m && m.entrees.every((e) => e.touche), `A2 ${qui} : le toucher au centre tombe sur l'entrée`, JSON.stringify(m && m.entrees.filter((e) => !e.touche).map((e) => e.id)));
        dit(!!m && m.docW <= m.vw, `A2 ${qui} : rien ne déborde de côté`, JSON.stringify(m && [m.docW, m.vw]));
        // A3 · le compteur d'Achats (colis à retirer, publié par Achats), une fois.
        // Le nombre est « À retirer » PUBLIÉ par Achats (`vrm_colis_retirer.total`, < 12 h) : l'app le recalcule à
        // l'ouverture ; on juge la règle — publié > 0 ⇒ ce nombre sur l'onglet Achats, une fois ; 0 ⇒ aucun.
        // La publication peut arriver après la première mesure : on relit (6 s au plus) jusqu'à ce que publié et rendu concordent.
        let bAch = [], pub = null, nJuste = false;
        for (let k = 0; k < 6 && !nJuste; k++) {
          if (k) { await pg.waitForTimeout(1000); m = await mesureBarre(pg) || m; }
          bAch = m ? m.badges.filter(([cle]) => cle === 'achats') : [];
          pub = await pg.evaluate(() => { try { const v = JSON.parse(localStorage.getItem('vrm_colis_retirer') || 'null'); return v && Number.isFinite(v.total) && Date.now() - (Number(v.at) || 0) < 12 * 3600000 ? v.total : null; } catch (_) { return null; } });
          nJuste = pub > 0 ? (bAch.length === 1 && bAch[0][1] === String(pub)) : bAch.length === 0;
        }
        dit(!!m && m.entrees.some((e) => e.id === 'achats') && nJuste, `A3 ${qui} : l'onglet Achats porte le nombre « À retirer » publié (${pub}), une fois`, JSON.stringify({ pub, badges: m && m.badges }));
        const nombres = m ? m.badges.map(([, n]) => n).filter((n) => /^\d+$/.test(n)) : [];
        dit(new Set(m ? m.badges.map(([k]) => k) : []).size === (m ? m.badges.length : 0), `A3 ${qui} : une pastille par onglet au plus`, JSON.stringify(m && m.badges));
        // A10 · le disque « + » n'est plus au milieu (3 onglets à gauche, 2 à droite) : son éventail reste DANS l'écran.
        await toucher(pg, '.vrm-tabbar > .sb-disque');
        await pg.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {})))).catch(() => {});
        const lames = await pg.evaluate(() => [...document.querySelectorAll('[data-sb-lame]')].map((b) => { const r = b.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right)]; }));
        const vw = await pg.evaluate(() => innerWidth);
        await capture(pg, `eventail-${mode}-${sombre ? 'sombre' : 'clair'}`);
        dit(lames.length >= 3 && lames.every(([g, d]) => g >= 0 && d <= vw), `A10 ${qui} : l'éventail du « + » s'ouvre, toutes ses lames dans l'écran`, JSON.stringify({ vw, lames }));
        await pg.keyboard.press('Escape').catch(() => {}); await pg.waitForTimeout(400);
        if (await pg.locator('[data-sb-lame]').count()) { await toucher(pg, '.vrm-tabbar > .sb-disque'); }
        // A4 · l'onglet allumé = l'écran, pour chaque écran (au toucher de la barre).
        const vus = [];
        for (const id of ['paires', 'achats', 'ventes', 'compta', 'journee']) {
          await toucher(pg, `.vrm-tabbar [data-nav-entree="${id}"]`);
          const e = await etat(pg); vus.push({ id, ...e });
        }
        dit(vus.every((v) => v.barre === v.id && v.nBarreActifs === 1 && (v.id === 'paires' ? ['annonces', 'garage'].includes(v.ecran) : v.ecran === v.id)), `A4 ${qui} : toucher un onglet ⇒ cet écran, cet onglet seul allumé`, JSON.stringify(vus.map((v) => [v.id, v.ecran, v.barre, v.nBarreActifs])));
        // A5 · le retour du système n'a plus d'onglet voisin à montrer : passer d'un onglet à l'autre n'empile rien.
        const h0 = vus[0].histo, hN = vus[vus.length - 1].histo;
        dit(hN === h0 && vus.every((v) => v.histo === h0), `A5 ${qui} : passer d'un onglet de la barre à l'autre n'ajoute aucune entrée d'historique (le glisser-retour ne montre pas l'onglet d'avant)`, JSON.stringify(vus.map((v) => v.histo)));
        // A6 · glisser sur le contenu (milieu ET bord, doigt réel puis touchers de page) ne change jamais d'écran.
        await toucher(pg, '.vrm-tabbar [data-nav-entree="compta"]');
        const avant6 = await etat(pg);
        const y = Math.round((await pg.evaluate(() => innerHeight)) * 0.45);
        await glisserDoigt(pg, 300, y, -260, 0); await glisserDoigt(pg, 40, y, 260, 0);
        await balayerEvenements(pg, 300, 20, y); await balayerEvenements(pg, 4, 300, y); await balayerEvenements(pg, 160, 20, y);
        const apres6 = await etat(pg);
        await capture(pg, `glisse-${mode}-${sombre ? 'sombre' : 'clair'}`);
        dit(avant6.ecran === 'compta' && apres6.ecran === 'compta' && apres6.barre === 'compta', `A6 ${qui} : glisser de côté sur Argent (milieu, bord) ne change pas d'écran`, JSON.stringify({ avant: avant6.ecran, apres: apres6.ecran, barre: apres6.barre }));
        dit(apres6.scrollX === 0 && apres6.mainX === 0, `A6 ${qui} : l'écran ne bouge pas de côté`, JSON.stringify({ x: apres6.scrollX, main: apres6.mainX }));
        // A7 · un glisser vertical fait défiler la page, jamais de côté.
        await toucher(pg, '.vrm-tabbar [data-nav-entree="ventes"]');
        await glisserDoigt(pg, 200, Math.round(y * 1.2), 40, -300);
        const e7 = await etat(pg); const defile = await pg.evaluate(() => Math.round(document.querySelector('.vrm-main').scrollTop));
        dit(e7.ecran === 'ventes' && e7.scrollX === 0 && e7.mainX === 0 && defile > 20, `A7 ${qui} : un glisser vertical (un peu de biais) défile, l'écran ne part jamais de côté`, JSON.stringify({ ...e7, st: undefined, defile }));
        const ob = await pg.evaluate(() => { const m = document.querySelector('.vrm-main'); return { main: getComputedStyle(m).overscrollBehaviorX, html: getComputedStyle(document.documentElement).overscrollBehaviorX }; });
        dit(ob.main === 'none' && ob.html === 'none', `A7 ${qui} : aucun rebond de côté (overscroll-behavior-x: none sur la page et le contenu)`, JSON.stringify(ob));
        // A8 · une rangée qui défile de côté (filtres, rangées) défile toujours au doigt, sans changer d'écran.
        await pg.evaluate(() => { document.querySelector('.vrm-main').scrollTop = 0; }); await pg.waitForTimeout(200);
        let rangee = null;
        for (const id of ['ventes', 'paires', 'achats', 'compta', 'journee']) {
          if (id !== 'ventes') await toucher(pg, `.vrm-tabbar [data-nav-entree="${id}"]`);
          rangee = await pg.evaluate(() => {
            const nav = document.querySelector('.vrm-tabbar').getBoundingClientRect().top;
            for (const n of document.querySelectorAll('.vrm-main *')) {
              const cs = getComputedStyle(n); if (!/(auto|scroll)/.test(cs.overflowX) || n.scrollWidth <= n.clientWidth + 20) continue;
              const r = n.getBoundingClientRect(); if (r.height < 24 || r.top < 60 || r.bottom > nav - 4 || r.width < 120) continue;
              n.setAttribute('data-banc-rangee', ''); return { x: Math.round(r.left + r.width * 0.75), y: Math.round(r.top + r.height / 2), ecran: document.querySelector('.vrm-main').getAttribute('data-ecran'), cls: String(n.className).slice(0, 60) };
            } return null;
          });
          if (rangee) break;
        }
        if (rangee) {
          const x0 = await pg.evaluate(() => document.querySelector('[data-banc-rangee]').scrollLeft);
          await glisserDoigt(pg, rangee.x, rangee.y, -160, 0);
          const x1 = await pg.evaluate(() => document.querySelector('[data-banc-rangee]').scrollLeft);
          const e8 = await etat(pg);
          dit(x1 > x0 + 10 && e8.ecran === rangee.ecran, `A8 ${qui} : une rangée qui défile de côté (${rangee.cls}) défile au doigt, même écran`, JSON.stringify({ x0, x1, ecran: e8.ecran, ...rangee }));
        } else dit(false, `A8 ${qui} : une rangée qui défile de côté trouvée sur un écran de la barre`);
        // A9 · le retour reste entier pour le reste : un écran du menu revient d'où on l'a ouvert ; une feuille se ferme.
        await toucher(pg, '.vrm-tabbar [data-nav-entree="compta"]');
        const ouvreMenu = (await pg.locator('[data-menu-ecrans]:visible').count()) ? '[data-menu-ecrans]' : '[data-profil-tete]';
        await toucher(pg, ouvreMenu);
        const feuille = await pg.evaluate(() => !!document.querySelector('.vrm-sheet, [data-menu-profil]'));
        await pg.goBack({ timeout: 3000 }).catch(() => {}); await pg.waitForTimeout(800);
        const e9a = await etat(pg).catch(() => ({ ecran: 'perdu' }));
        const fermee = await pg.evaluate(() => !document.querySelector('.vrm-sheet [data-nav-entree="messages"], [data-menu-profil] [data-nav-entree="messages"]')).catch(() => false);
        dit(feuille && e9a.ecran === 'compta' && fermee, `A9 ${qui} : « retour » avec le menu ouvert le ferme et reste sur Argent`, JSON.stringify({ feuille, ecran: e9a.ecran, fermee }));
        await toucher(pg, ouvreMenu); await toucher(pg, '.vrm-sheet [data-nav-entree="messages"], [data-menu-profil] [data-nav-entree="messages"]');
        const e9b = await etat(pg);
        await pg.goBack({ timeout: 3000 }).catch(() => {}); await pg.waitForTimeout(900);
        const e9c = await etat(pg).catch(() => ({ ecran: 'perdu' }));
        dit(e9b.ecran === 'messages' && e9c.ecran === 'compta' && e9c.barre === 'compta', `A9 ${qui} : Messages (menu) puis « retour » ⇒ Argent, allumé`, JSON.stringify({ ouvert: e9b.ecran, retour: e9c.ecran, barre: e9c.barre }));
        dit(errs.length === 0, `A ${qui} : aucune erreur de page`, errs.join(' | '));
        await ctx.close();
      });
    }
    // ── L. LES LIENS PROFONDS (390 tactile ; 1512 pour la colonne) ──────────
    for (const mode of ['tel', 'ordi']) {
      const qui = mode === 'tel' ? '390' : '1512';
      console.log(`── L. liens ?tab= · ${qui}`);
      await essaie(`L ${qui}`, async () => {
        const ctx = await appareil(b, mode, local);
        const vus = [];
        let pg0 = null;
        for (const c of ECRANS) {
          const { pg, errs } = await ouvrirPage(ctx, `?tab=${c.lien}`);
          const e = await etat(pg);
          vus.push({ ...c, vu: e.ecran, barre: e.barre, rail: e.rail, n: e.nBarreActifs, errs: errs.length });
          if (c.lien === 'achats') await capture(pg, `achats-${mode}`);
          if (pg0) await pg0.close().catch(() => {}); pg0 = pg;
        }
        const attendu = (v) => mode === 'tel' ? (v.vu === (v.ecran || v.lien) && v.barre === v.barre_ && v.n === 1) : (v.vu === (v.ecran || v.lien) && v.rail === v.rail_);
        const ko = vus.map((v) => ({ ...v, barre_: ECRANS.find((c) => c.lien === v.lien).barre, rail_: ECRANS.find((c) => c.lien === v.lien).rail, barre: v.barre })).filter((v) => !attendu(v));
        dit(!ko.length, `L ${qui} : chaque lien ?tab= (anciens compris) ⇒ son écran, et l'onglet allumé est le sien`, JSON.stringify(ko.map((v) => [v.lien, v.vu, mode === 'tel' ? v.barre : v.rail])));
        if (mode === 'ordi') {
          const rail = await pg0.evaluate(() => [...document.querySelectorAll('.vrm-sidebar [data-nav-entree]')].map((x) => x.getAttribute('data-nav-entree')));
          dit(rail.includes('achats') && rail.filter((x) => x === 'achats').length === 1, `L ${qui} : Achats est dans la colonne, une fois`, JSON.stringify(rail));
          dit(!(await pg0.locator('.vrm-tabbar').count()) || !(await pg0.locator('.vrm-tabbar:visible').count()), `L ${qui} : pas de barre du bas à l'ordinateur`);
        } else {
          // Le sélecteur de « Paires » ne porte plus Achats (Annonces · Stock) ; sur Achats, aucun sélecteur.
          const { pg } = await ouvrirPage(ctx, '?tab=annonces');
          const seg = await pg.evaluate(() => [...document.querySelectorAll('[data-paires-segment]')].map((x) => x.getAttribute('data-paires-segment')));
          await pg.close();
          const { pg: pa } = await ouvrirPage(ctx, '?tab=achats');
          const segA = await pa.evaluate(() => document.querySelectorAll('[data-paires-selecteur]').length);
          dit(!seg.includes('achats') && segA === 0, `L ${qui} : le sélecteur de « Paires » ne porte plus Achats, et Achats n'en montre aucun`, JSON.stringify({ seg, segA }));
          await pa.close();
        }
        if (pg0) await pg0.close().catch(() => {});
        await ctx.close();
      });
    }
  } finally {
    await b.close(); srv.close();
  }
  console.log(`\n${ok} ✅  ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
