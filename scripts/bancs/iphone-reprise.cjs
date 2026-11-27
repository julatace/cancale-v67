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
//   B9. (16 nov.) passer d'un onglet de la barre à l'autre n'empile rien : le retour ne montre pas l'onglet d'avant.
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
// O3. (27 nov.) Aujourd'hui, dans ces mêmes fenêtres : chaque texte tient dans sa colonne (rien ne sort, rien de rogné,
//    aucun mot cassé, rien sous un prix) — `_journee-tient.cjs`.
// O2. (revue du 5 nov.) LA CAUSE DES LIBELLÉS COUPÉS : le bloc « Recharger »
//    (numéros périmés, la capture Edge de Julien) rendu dans <main> héritait de
//    la largeur bornée des écrans d'ordinateur (1360 px centrés) : à 1512 px il
//    commençait à 76 px, la colonne restait visible et TOUCHABLE dessous
//    (« Ven », « Gér », « Arg », « Plat », « VI ») et l'écran lisible à droite.
//    Servi ici par une version de numérotation relue différente. Il doit
//    couvrir TOUTE la fenêtre (390 tactile, 1512 × 950 clair, 1512 × 830 sombre).
//
// ⚠️ (26 nov., bancs natifs — réécrit sur les écrans « VRM natif », src/natif/, docs/design/NATIF.md) Mêmes garanties,
//    jugées sur les éléments d'aujourd'hui : la barre `nav[data-n-onglets] > .n-onglet` ; le « Plus » d'hier est l'écran Menu
//    ouvert par la photo du compte (`[data-n-coque-compte]`, 21 nov. onglets-menu) ; le filtre de site d'un onglet est la
//    rangée `[data-fp]` (25 nov.) ; la colonne est `[data-n-laterale]` (ses groupes : les cinq onglets du téléphone en tête,
//    puis Gestion · Dans l'extension · Aide). Trois défauts de l'app trouvés et corrigés en le réécrivant : la grille de la
//    coque d'ordinateur ne suivait pas LA règle de coque (O 1008×633 : l'écran passait sous la colonne, src/natif/natif.css),
//    « Terminées » de Ventes n'était pas repris (src/repriseEcran.js), la recherche d'Annonces natif ne revenait pas
//    (src/ecrans/AnnoncesEgalite.jsx) et le compte choisi dans Achats ne se redessinait qu'au rechargement
//    (src/achats/FiltreAchats.jsx, enfant-fonction dans un écran gardé).
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
const { getPath } = require('./_minipgrest.cjs');
const TIENT = require('./_journee-tient.cjs');
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
  // (16 nov., bancs-rouges-b) Sous WebKit, une page NEUVE (about:blank) n'a pas encore l'horloge du contexte :
  // `setSystemTime` y lève « __pwClock.controller » (mesuré en CI, toute la partie R tombait encore). On ouvre
  // d'abord un petit document de la même origine (le script d'horloge s'y pose), puis on avance l'heure.
  else await pg.clock.setSystemTime(t0).catch(async () => {
    await pg.goto(`http://localhost:${PORT}/etat-version.json`, { waitUntil: 'domcontentloaded' });
    await pg.clock.setSystemTime(t0);
  });
  await pg.goto(`http://localhost:${PORT}/${query}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => document.querySelector('.vrm-main') || /pas pu s'afficher/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
  // (27 nov., WebKit en CI) `.vrm-main` existe SOUS l'écran de démarrage (index.html `#vrm-demarrage`, `data-vrm-boot`) : sous
  // WebKit chargé, il couvrait encore la page après 2,8 s (capture : « Ça prend plus de temps que d'habitude ») — la barre
  // mesurée dessous, les touchers pris par lui (B1, B7, B8, R3 rouges). On attend qu'il soit parti (30 s au plus), comme
  // _a11y-mesure.cjs `attendreDemarrage` ; s'il reste, les mesures le voient et rougissent.
  await pg.waitForFunction(() => !document.getElementById('vrm-demarrage') && !document.documentElement.hasAttribute('data-vrm-boot'), null, { timeout: 30000 }).catch(() => {});
  await pg.waitForTimeout(2800);
  return { pg, errs };
};
const capture = async (pg, nom) => { if (!CAPTURES) return; try { fs.mkdirSync(CAPTURES, { recursive: true }); await pg.screenshot({ path: path.join(CAPTURES, nom + '.png'), fullPage: false }); } catch (_) {} };
// (26 nov., bancs natifs) Annonces natif : le champ de la tête de liste (`.n-eg-recherche`, src/natif/ecrans/Annonces.jsx) —
// l'ancien `[data-ann-recherche]` reste rendu, caché, par l'écran d'avant monté dessous : il n'est plus celui qu'on tape.
const CHAMP_ANNONCES = '.vrm-main[data-ecran="annonces"] .n-eg-recherche [data-n-recherche] input';
const ecran = (pg) => pg.evaluate((CHAMP_ANNONCES) => {
  const m = document.querySelector('.vrm-main');
  const t = document.querySelector('[data-tache]');
  const actif = document.querySelector('nav[data-n-onglets] > [aria-current="page"]');
  return {
    ecran: m ? m.getAttribute('data-ecran') : '',
    // (26 nov., bancs natifs) Le filtre de site d'un onglet est la rangée `[data-fp]` (src/natif/FiltrePlateformes.jsx, 25 nov.) :
    // son choix (`data-fp-choix`) ; l'ancien repère de la tâche (`data-tache-site`) reste lu s'il n'y en a pas.
    site: (() => { const f = [...document.querySelectorAll('[data-fp]')].find((x) => x.getClientRects().length); return f ? f.getAttribute('data-fp-choix') : (t ? t.getAttribute('data-tache-site') : ''); })(),
    segment: (() => { const v = [...document.querySelectorAll('[data-vn-onglet]')].find((x) => x.getClientRects().length); return v ? v.getAttribute('data-vn-onglet') : ''; })(),
    barre: actif ? (actif.getAttribute('data-nav-entree') || 'plus') : '',
    colis: (document.querySelector('[data-colis-onglet]') || { getAttribute: () => '' }).getAttribute('data-colis-onglet'),
    // (26 nov., bancs natifs) La puce choisie VISIBLE : un écran d'avant monté caché porte aussi une rangée de puces.
    puce: ([...document.querySelectorAll('[data-compte-puce][data-actif="1"]')].find((x) => x.getClientRects().length) || { getAttribute: () => '' }).getAttribute('data-compte-puce'),
    // Le champ de recherche d'Annonces par son crochet `data-ann-recherche` (le libellé a changé
    // le 5 nov., chantier C : « Rechercher une annonce (titre, marque, N°) ») ; l'ancien libellé
    // reste pour juger un arbre d'avant.
    recherche: (document.querySelector(CHAMP_ANNONCES) || { value: null }).value,
    defile: m ? Math.round(m.scrollTop) : -1,
    url: location.href,
  };
}, CHAMP_ANNONCES);
// Un balayage au doigt, en évènements tactiles DE LA PAGE : seul VRM les voit
// (le navigateur n'y joue pas son propre « retour » de bord d'écran), on juge
// donc ce que fait VRM, et lui seul.
const balayer = async (ctx, pg, x0, x1, y) => {
  await pg.evaluate(([x0, x1, y]) => {
    const cible = document.elementFromPoint(x0 < 1 ? 1 : x0, y) || document.querySelector('.vrm-main');
    // (11 nov., webkit-fiable) `new Touch(...)` n'existe pas sous WebKit (« Illegal constructor »,
    // mesuré en CI : la partie B s'arrêtait là). Un toucher de page porte ce que l'app lit
    // (`touches[0].clientX/Y`, `changedTouches`) : sans constructeur, un objet de la même forme
    // posé sur un TouchEvent (ou un Event nommé pareil si TouchEvent manque aussi).
    const t = (x) => { try { return new Touch({ identifier: 1, target: cible, clientX: x, clientY: y, pageX: x, pageY: y, screenX: x, screenY: y }); } catch (_) { return { identifier: 1, target: cible, clientX: x, clientY: y, pageX: x, pageY: y, screenX: x, screenY: y }; } };
    const ev = (type, x, liste) => {
      const champs = { touches: liste ? [t(x)] : [], targetTouches: liste ? [t(x)] : [], changedTouches: [t(x)] };
      let e; try { e = new TouchEvent(type, Object.assign({ bubbles: true, cancelable: true }, champs)); if (!e.touches || e.touches.length !== champs.touches.length || !e.changedTouches || !e.changedTouches.length) throw 0; }
      catch (_) { e = new Event(type, { bubbles: true, cancelable: true }); for (const [k, v] of Object.entries(champs)) Object.defineProperty(e, k, { value: v }); }
      return cible.dispatchEvent(e);
    };
    ev('touchstart', x0, true);
    for (let k = 1; k <= 6; k++) ev('touchmove', x0 + (x1 - x0) * k / 6, true);
    ev('touchend', x1, false);
  }, [x0, x1, y]);
  await pg.waitForTimeout(800);
};
// (14 nov., choix n° 61) Annonces, Stock et Achats sont dans l'onglet « Paires » : l'onglet, puis le segment.
// (26 nov., bancs natifs) La barre native : l'onglet « Annonces » (`paires`) ouvre Annonces ; le segment n'existe plus (le Stock
// est dans le Menu) — touché seulement s'il est là, et l'écran visé est vérifié par ceux qui appellent.
const allerPaire = async (pg, id) => { await toucher(pg, 'nav[data-n-onglets] [data-nav-entree="paires"]'); if (await pg.locator(`[data-paires-segment="${id}"]`).count()) return toucher(pg, `[data-paires-segment="${id}"]`); return true; };
const toucher = async (pg, sel) => { const l = pg.locator(sel).first(); if (!(await l.count())) { console.log(`     (absent : ${sel})`); return false; } await l.tap({ timeout: 5000 }).catch(() => {}); await pg.waitForTimeout(800);
  // (8 nov.) L'écran se calcule en tâche interruptible (startTransition) : on attend la fin du calcul
  // (`data-en-cours` de la barre, 4 s au plus), jamais un délai fixe seul (CLAUDE.md §6.5).
  await pg.waitForFunction(() => !document.querySelector('nav[data-n-onglets][data-en-cours]'), null, { timeout: 4000 }).catch(() => {});
  return true; };
const PLUS = 'nav[data-n-onglets] button[aria-label^="Plus"]';
// Ce que « Plus » porte (App.jsx, GROUPES_PLUS sans les groupes `ordi`) : lu dans la source, pas recopié.
const PLUS_ATTENDUES = (() => {
  try {
    const src = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'App.jsx'), 'utf8');
    const i = src.indexOf('const GROUPES_PLUS=['); if (i < 0) return [];
    const bloc = src.slice(i, src.indexOf('\n];', i));
    const ids = [];
    // (11 nov., traduction) les groupes s'écrivent `groupeNav({ cle:'…', nom:'…', items:[ entreeNav({id:'…'}) ] })`
    // (titre lu par tr()) ; l'ancienne forme `{ titre:'…', items:[ {id:'…'} ] }` reste lue.
    for (const g of bloc.split(/\n\s*(?:\{\s*titre:|groupeNav\(\{)/).slice(1)) {
      if (/^[^\n]*\bordi\s*:\s*true/.test(g)) continue;
      for (const l of g.split('\n')) { if (/^\s*\/\//.test(l)) continue; if (/\.\.\.ONGLET_MESSAGES/.test(l)) ids.push('messages'); const m = /(?:\{|entreeNav\(\{)\s*id:\s*'([a-z_]+)'/.exec(l); if (m) ids.push(m[1]); }
    }
    return [...new Set(ids)];
  } catch (_) { return []; }
})();

// La barre, mesurée.
const mesureBarre = (pg) => pg.evaluate(() => {
  const nav = document.querySelector('nav[data-n-onglets]'); if (!nav) return null;
  const r = nav.getBoundingClientRect();
  // (16 nov., barre-achats) Les ENTRÉES de la barre : ses onglets (`.vrm-tab`) — cinq depuis qu'Achats y est —, pas
  // le disque « + » du centre (14 nov.), qui comptait jusqu'ici pour la 5ᵉ entrée.
  // (26 nov., bancs natifs) La barre NATIVE (src/natif/BarreOnglets.jsx, NATIF.md §2) : ses entrées sont `.n-onglet`
  // (l'id de l'app sur `data-nav-entree`), le nombre de chaque onglet est sa pastille (`.n-onglet-pastille`).
  const entrees = [...nav.querySelectorAll(':scope > .n-onglet')].map((x) => {
    const q = x.getBoundingClientRect(); const lab = x.querySelector('.n-onglet-libelle');
    const hit = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2);
    return { id: x.getAttribute('data-nav-entree') || 'plus', h: Math.round(q.height), w: Math.round(q.width), coupe: lab ? lab.scrollWidth > lab.clientWidth + 1 : true, touche: !!hit && x.contains(hit) };
  });
  const nombres = [...nav.querySelectorAll('.n-onglet-pastille')].map((x) => x.textContent.trim()).filter((n) => /^\d+$/.test(n));
  // La zone sûre : la règle qui gagne doit la porter (Chromium vaut env() = 0).
  let zoneSure = false;
  for (const ss of document.styleSheets) { let rr; try { rr = ss.cssRules; } catch (_) { continue; } const tous = []; const plat = (l) => { for (const x of l) { if (x.selectorText) tous.push(x); if (x.cssRules && x.cssRules.length) plat(x.cssRules); } }; plat(rr); // (24 nov., main-vert) La barre NATIVE (`.n-onglets`, natif.css) porte la zone sûre par sa variable `--n-bas-sur`
    // (jetons.css : env(safe-area-inset-bottom)) : la variable est résolue jusqu'à env(), jamais admise sur son nom.
    const vars = new Set(); for (const x of tous) { if (!x.style) continue; for (let i = 0; i < x.style.length; i++) { const p = x.style[i]; if (p.startsWith('--') && /safe-area-inset-bottom/.test(x.style.getPropertyValue(p))) vars.add(p); } }
    const porte = (v) => /safe-area-inset-bottom/.test(v) || [...vars].some((n) => v.includes(`var(${n}`));
    for (const x of tous) { if (x.selectorText && /(^|[\s,>])\.n-onglets(?![\w-])/.test(x.selectorText) && x.style && (porte(x.style.getPropertyValue('padding-bottom')) || porte(x.style.getPropertyValue('padding')))) zoneSure = true; } }
  return { bas: Math.round(r.bottom), haut: Math.round(r.top), vh: innerHeight, vw: innerWidth, docW: document.documentElement.scrollWidth, entrees, nombres, zoneSure };
});
const mesurePanneau = (pg) => pg.evaluate(() => {
  const m = document.querySelector('.vrm-sheet'); if (!m) return null;
  const q = m.getBoundingClientRect(); const nav = document.querySelector('nav[data-n-onglets]').getBoundingClientRect();
  const entrees = [...m.querySelectorAll('[data-nav-entree]')].map((e) => { const r = e.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); const lib = e.querySelector('.vrm-sheet-lib'); return { id: e.getAttribute('data-nav-entree'), h: Math.round(r.height), visible: r.top >= 0 && r.bottom <= Math.min(innerHeight, nav.top) + 1, touche: !!hit && e.contains(hit), coupe: lib ? lib.scrollWidth > lib.clientWidth + 1 : false }; });
  return { bas: Math.round(q.bottom), navHaut: Math.round(nav.top), defile: m.scrollHeight > m.clientHeight + 1, entrees, plusOuvert: document.querySelector('nav[data-n-onglets] button[aria-label^="Plus"]').getAttribute('aria-expanded') };
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
        // (17 nov., chasse-bugs) RÈGLE DU 14 NOV. (Studio bleu clair, src/design/studio.css §barre) : la barre FLOTTE, posée à
        // max(12 px, zone sûre − 14 px) du bas — elle ne « touche » plus le bas. Elle reste collée au bas : 0 à 24 px, jamais plus.
        dit(!!m && m.docW <= m.vw && m.vh - m.bas >= 0 && m.vh - m.bas <= 24, `B1 ${qui} : rien ne déborde, la barre flotte au bas (0–24 px du bord)`, JSON.stringify(m && { docW: m.docW, vw: m.vw, bas: m.bas, vh: m.vh }));
        dit(!!m && m.zoneSure, `B1 ${qui} : la barre porte la zone sûre (safe-area-inset-bottom)`);
        dit(!!m && new Set(m.nombres).size === m.nombres.length, `B2 ${qui} : un nombre une seule fois dans la barre (§7)`, JSON.stringify(m && m.nombres));
        // (17 nov., chasse-bugs) CHOIX N° 61 DU 14 NOV. : plus de « Plus » dans la barre ; les autres écrans vivent dans le
        // MENU DE L'AVATAR (en haut à droite). B3–B6 jugent ce menu, avec les mêmes exigences.
        // ⚠️ (26 nov., bancs natifs) Depuis le 21 nov. (onglets-menu, App.jsx `EcranMenu`) la photo du compte ouvre un ÉCRAN, le
        // Menu (`data-ecran="menu"`, `[data-n-menu]`), plus une feuille : ses entrées sont les tuiles et rangées `[data-n-plus-entree]`
        // (l'écran visé sur `data-nav-entree`). Messages n'y est plus (la bulle en haut à droite) : B5 touche « E-mails ».
        // Mêmes exigences : ≥ 44 px, touchables, libellés entiers ; « retour » ferme et reste dans VRM ; une entrée y va.
        const TETE = '[data-n-coque-compte]';
        const menu = () => pg.evaluate(() => {
          const f = document.querySelector('[data-n-menu]');
          if (!f || !f.getClientRects().length) return null;
          const barre = document.querySelector('nav[data-n-onglets]');
          const bas = barre ? Math.min(innerHeight, barre.getBoundingClientRect().top) : innerHeight;
          const entrees = [...f.querySelectorAll('[data-n-plus-entree]')].map((e) => { const r = e.getBoundingClientRect(); const vis = r.height > 0 && r.top >= 0 && r.bottom <= bas; const hit = vis ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null; const lib = e.querySelector('.n-tuile-menu-libelle, .n-rangee-titre, .n-carte-compte-nom'); return { id: e.getAttribute('data-n-plus-entree'), h: Math.round(r.height), vis, touche: !vis || (!!hit && e.contains(hit)), coupe: lib ? lib.scrollWidth > lib.clientWidth + 1 : false }; });
          return { entrees, ecran: document.querySelector('.vrm-main').getAttribute('data-ecran') };
        });
        // B3 · le menu ouvert
        await toucher(pg, TETE);
        await pg.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {})))).catch(() => {});
        const p = await menu();
        await capture(pg, `menu-${mode}-${sombre ? 'sombre' : 'clair'}`);
        dit(!!p && p.ecran === 'menu' && p.entrees.filter((e) => e.id !== 'settings').length >= 3, `B3 ${qui} : l’avatar ouvre le menu des autres écrans`, JSON.stringify(p));
        dit(!!p && p.entrees.every((e) => e.h >= 44 && e.touche && !e.coupe), `B3 ${qui} : entrées ≥ 44 px, touchables, libellés entiers`, JSON.stringify(p && p.entrees.filter((e) => !(e.h >= 44 && e.touche && !e.coupe))));
        // B4 · retour avec le menu ouvert
        await pg.goBack({ timeout: 3000 }).catch(() => {}); await pg.waitForTimeout(800);
        const e4 = await ecran(pg).catch(() => ({ url: 'perdu' }));
        dit(/^http:\/\/localhost/.test(e4.url) && e4.ecran === 'journee', `B4 ${qui} : « retour » ferme le menu et reste dans VRM, sur Ma journée`, JSON.stringify(e4));
        dit(/^http:\/\/localhost/.test(e4.url) && !(await menu().catch(() => 'perdu')), `B4 ${qui} : le menu est fermé`);
        let pg2 = pg;
        if (!/^http:\/\/localhost/.test(e4.url)) { await pg.close().catch(() => {}); ({ pg: pg2 } = await ouvrirPage(ctx, '?tab=journee')); }
        pg = pg2;
        // B5 · menu ouvert, toucher une entrée y va et le ferme
        await toucher(pg, TETE); await toucher(pg, '[data-n-menu] [data-nav-entree="emails"]');
        const e5 = await ecran(pg);
        dit(e5.ecran === 'emails' && !(await menu()), `B5 ${qui} : menu ouvert, toucher E-mails y va et le ferme`, JSON.stringify(e5));
        // B6 · sur un écran du menu, la barre n'allume AUCUN autre onglet (l'onglet allumé = l'écran montré, ou rien)
        const vus = [];
        for (const id of ['garage', 'emails', 'extension']) {
          await toucher(pg, TETE); const ok = await toucher(pg, `[data-n-menu] [data-nav-entree="${id}"]`);
          if (!ok) continue;
          vus.push(await pg.evaluate(() => { const a = document.querySelector('nav[data-n-onglets] [aria-current="page"]'); return { ecran: document.querySelector('.vrm-main').getAttribute('data-ecran'), actif: a ? a.getAttribute('data-nav-entree') : '' }; }));
        }
        const groupe = { garage: 'paires', annonces: 'paires', achats: 'achats' };
        dit(vus.length >= 2 && vus.every((v) => v.ecran !== 'menu' && (!v.actif || v.actif === (groupe[v.ecran] || v.ecran))), `B6 ${qui} : sur chaque écran du menu, la barre n’allume que l’onglet de cet écran (ou aucun)`, JSON.stringify(vus));
        // Les visites du menu ont empilé leurs écrans : B7–B9 repartent d'une page neuve (comme avant, où « Plus » n'empilait rien).
        await pg.close().catch(() => {}); ({ pg } = await ouvrirPage(ctx, '?tab=journee'));
        // B7 · balayages
        await toucher(pg, 'nav[data-n-onglets] [data-nav-entree="ventes"]');
        // Le milieu de l'écran, HORS d'une commande : un geste qui part d'un bouton, d'un lien,
        // d'un champ ou d'une rangée qui défile de côté appartient à ce qu'il touche (règle
        // `gesteHorsNavigation` d'App.jsx, 16 oct.). Le point fixe (200, 420) tombait depuis
        // le 5 nov. sur une case-bouton de la carte du haut de Ventes : le banc mesurait la
        // mise en page, pas la règle. On cherche donc une hauteur où le doigt ne touche aucune
        // commande, au milieu (x 200) comme au bord (x 4 : sinon « le bord est laissé au
        // système » passerait sans rien prouver) ; s'il n'y en a aucune, c'est rouge.
        const y7 = await pg.evaluate(() => {
          const commande = (n) => { for (let k = 0; n && n !== document.body && k < 40; k++, n = n.parentElement) {
            if (n.matches && n.matches('button, a, input, textarea, select, label, [contenteditable="true"], [role="button"], [role="tab"], [role="link"], [role="slider"], [data-noswipe]')) return true;
            const cs = getComputedStyle(n); if (cs.position === 'fixed') return true;
            if (n.scrollWidth > n.clientWidth + 2 && (cs.overflowX === 'auto' || cs.overflowX === 'scroll')) return true;
          } return false; };
          const barre = (document.querySelector('nav[data-n-onglets]') || { getBoundingClientRect: () => ({ top: innerHeight }) }).getBoundingClientRect().top;
          for (let y = 160; y < barre - 20; y += 12) { const e = document.elementFromPoint(200, y), g = document.elementFromPoint(4, y); if (e && g && e.closest('.vrm-main') && g.closest('.vrm-main') && !commande(e) && !commande(g)) return y; }
          return null;
        });
        dit(y7 != null, `B7 ${qui} : au milieu de Ventes, il existe une place hors de toute commande pour balayer`, String(y7));
        const avant7 = await ecran(pg);
        await balayer(ctx, pg, 4, 220, y7 == null ? 420 : y7);
        const e7 = await ecran(pg);
        // Le bord appartient au système (le « retour » de Safari sur iPhone) :
        // VRM ne doit PAS y ajouter son changement d'onglet (l'onglet voisin).
        dit(avant7.ecran === 'ventes' && e7.ecran === 'ventes', `B7 ${qui} : un balayage parti du bord gauche est laissé au système (VRM ne change pas d'onglet)`, JSON.stringify({ avant: avant7.ecran, apres: e7.ecran }));
        await balayer(ctx, pg, 200, 40, y7 == null ? 420 : y7);
        const e7b = await ecran(pg);
        // (9 nov., décision de Julien) plus aucun changement d'onglet au doigt, même au milieu.
        dit(e7b.ecran === 'ventes', `B7 ${qui} : un balayage au milieu ne change plus d'onglet (décision du 9 nov.)`, JSON.stringify({ y: y7, ...e7b }));
        // B8 · retoucher l'onglet courant
        await allerPaire(pg, 'annonces');
        // (27 nov., WebKit) Annonces n'avait pas encore ses rangées (rien à défiler : 29 px) : on attend qu'il y ait de quoi
        // défiler de plus de 100 px (10 s au plus) ; le seuil « avant > 100 » reste celui du contrôle.
        await pg.waitForFunction(() => { const m = document.querySelector('.vrm-main'); return m && m.getAttribute('data-ecran') === 'annonces' && m.scrollHeight - m.clientHeight > 150; }, null, { timeout: 10000 }).catch(() => {});
        await pg.evaluate(() => { document.querySelector('.vrm-main').scrollTop = 400; }); await pg.waitForTimeout(300);
        const avant8 = await ecran(pg);
        await toucher(pg, 'nav[data-n-onglets] [data-nav-entree="paires"]'); await pg.waitForTimeout(600);
        const e8 = await ecran(pg);
        dit(avant8.defile > 100 && e8.ecran === 'annonces' && e8.defile < 5, `B8 ${qui} : toucher l'onglet courant ramène en haut, même écran`, JSON.stringify({ avant: avant8.defile, apres: e8.defile, ecran: e8.ecran }));
        // B9 · le retour entre écrans
        // ⚠️ (16 nov., lot barre-achats — Julien : « je ne veux pas qu'on puisse glisser entre les onglets ») Le
        // glisser-retour depuis le bord (iPhone) montrait l'onglet d'avant à moitié (Argent ⇒ Ma journée) : passer
        // d'un onglet de la barre à l'autre n'empile plus rien (src/navHistorique.js). Règle portée : le retour
        // depuis Argent ne montre AUCUN autre onglet de la barre ; il reste entier pour un écran du menu
        // (scripts/bancs/barre-achats.cjs A9) et pour les feuilles (B4).
        await toucher(pg, 'nav[data-n-onglets] [data-nav-entree="journee"]');
        const h9 = await pg.evaluate(() => history.length);
        await toucher(pg, 'nav[data-n-onglets] [data-nav-entree="ventes"]');
        await toucher(pg, 'nav[data-n-onglets] [data-nav-entree="compta"]');
        const h9b = await pg.evaluate(() => history.length);
        await pg.goBack().catch(() => {}); await pg.waitForTimeout(700);
        const r1 = await ecran(pg).catch(() => ({ ecran: '', url: 'perdu' }));
        const autreOnglet = /^http:\/\/localhost/.test(r1.url || '') && r1.ecran && r1.ecran !== 'compta';
        dit(h9b === h9 && !autreOnglet, `B9 ${qui} : Journée → Ventes → Argent n'empile rien ; le retour ne montre pas l'onglet d'avant`, JSON.stringify({ avant: h9, apres: h9b, retour: r1.ecran || r1.url }));
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
        // (26 nov., bancs natifs) Ventes natif (src/natif/ecrans/Ventes.jsx) : le filtre de site vit sous « Terminées » (les
        // listes « À envoyer » n'ont ici qu'un site : moins de deux sites ⇒ pas de filtre, src/filtrePlateforme.js). Même
        // exigence : rechargé, même écran, même liste, même site.
        await toucher(pg, 'nav[data-n-onglets] [data-nav-entree="ventes"]');
        await toucher(pg, '[data-colis-onglet-choix="toutes"]');
        // Le segmenté vient de se monter : un toucher pendant son calcul peut se perdre — on attend « Terminées » montré, un 2ᵉ toucher au plus (§6.5).
        if (!(await pg.waitForFunction(() => [...document.querySelectorAll('[data-vn-onglet="toutes"]')].some((x) => x.getClientRects().length), null, { timeout: 3000 }).then(() => true).catch(() => false))) {
          await toucher(pg, '[data-colis-onglet-choix="toutes"]');
          await pg.waitForFunction(() => [...document.querySelectorAll('[data-vn-onglet="toutes"]')].some((x) => x.getClientRects().length), null, { timeout: 3000 }).catch(() => {});
        }
        await toucher(pg, '[data-fp="ventes"] [data-fp-site="leboncoin"]');
        const r1avant = await ecran(pg);
        await pg.reload({ waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(3000);
        // Le filtre retenu ne s'affiche qu'une fois ses sites LUS (une entrée sans ligne n'existe pas, src/filtrePlateforme.js
        // `choixEffectif`) : on attend la rangée montrée sur le site retenu, 10 s au plus (§6.5) — un choix perdu reste « toutes ».
        await pg.waitForFunction(() => [...document.querySelectorAll('[data-fp="ventes"][data-fp-choix="leboncoin"]')].some((x) => x.getClientRects().length), null, { timeout: 10000 }).catch(() => {});
        const r1 = await ecran(pg);
        dit(r1avant.site === 'leboncoin' && r1.ecran === 'ventes' && r1.segment === 'toutes' && r1.site === 'leboncoin', `R1 ${qui} : rechargé, même écran (Ventes · Terminées) et même filtre (Leboncoin)`, JSON.stringify({ avant: r1avant, apres: r1 }));
        // R1 · compte choisi (Achats, compte 222)
        // (26 nov., bancs natifs) Ventes natif n'a plus de puces de compte (le compte est une colonne / un filtre du tableau) ;
        // la rangée des comptes `[data-compte-puce]` vit dans Achats : la reprise du compte choisi y est jugée.
        await toucher(pg, 'nav[data-n-onglets] [data-nav-entree="achats"]');
        await toucher(pg, '[data-compte-puce="222"]');
        await pg.waitForFunction(() => [...document.querySelectorAll('[data-compte-puce="222"][data-actif="1"]')].some((x) => x.getClientRects().length), null, { timeout: 4000 }).catch(() => {});
        const r1bavant = await ecran(pg);
        await pg.reload({ waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(3000);
        // (27 nov., WebKit) l'écran de démarrage parti, puis la rangée des comptes montrée (10 s au plus) — une puce perdue reste « * ».
        await pg.waitForFunction(() => !document.getElementById('vrm-demarrage') && [...document.querySelectorAll('[data-compte-puce][data-actif="1"]')].some((x) => x.getClientRects().length), null, { timeout: 10000 }).catch(() => {});
        const r1b = await ecran(pg);
        dit(r1bavant.puce === '222' && r1b.ecran === 'achats' && r1b.puce === '222', `R1 ${qui} : rechargé, même compte choisi`, JSON.stringify({ avant: r1bavant, apres: r1b }));
        await toucher(pg, '[data-compte-puce="*"]');
        // R2 · Colis · À retirer, app rouverte
        // (16 nov., barre-achats) Achats a son onglet dans la barre.
        await toucher(pg, 'nav[data-n-onglets] [data-nav-entree="achats"]');
        await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:aller', { detail: '?tab=retraits' }))); /* (11 nov., lot DJ3) « À retirer » est en tête d'Achats */ await pg.locator('[data-colis-section="achats"]').first().waitFor({ timeout: 30000 });
        const r2avant = await ecran(pg);
        await pg.close();
        ({ pg } = await ouvrirPage(ctx));
        const r2 = await ecran(pg);
        await capture(pg, `reprise-colis-${sombre ? 'sombre' : 'clair'}`);
        dit(r2avant.colis === 'retirer' && r2.ecran === 'achats' && r2.colis === 'retirer', `R2 ${qui} : rouverte, même écran (Achats, « À retirer » en tête — lot DJ3) et même liste (À retirer)`, JSON.stringify({ avant: r2avant.colis, apres: r2 }));
        // R3 · Annonces : recherche + défilement, app rouverte
        // (26 nov., bancs natifs) Annonces natif : un seul site dans ces données ⇒ pas de rangée de filtre (src/filtrePlateforme.js,
        // moins de deux sites) ; le filtre retenu par écran est jugé en R1 (même règle, `lireChoixPlateforme`). Ici : le filtre
        // montré (ou son absence) est le même après réouverture.
        await allerPaire(pg, 'annonces');
        const champ = pg.locator(CHAMP_ANNONCES).first();
        // (27 nov., CI chargée) l'écran Annonces se charge à la demande : on attend que SON champ soit monté (15 s au plus)
        // au lieu de compter tout de suite — un comptage immédiat rendait « absent » un champ encore en chargement.
        const champLa = await champ.waitFor({ state: 'visible', timeout: 15000 }).then(() => true, () => false);
        dit(champLa, `R3 ${qui} : le champ de recherche d'Annonces est là (sinon la reprise de la recherche n'est pas jugée)`);
        if (champLa) { await champ.fill('taille'); await pg.waitForTimeout(600); await pg.evaluate(() => document.activeElement && document.activeElement.blur()); }
        await pg.waitForTimeout(400);
        await pg.evaluate(() => { document.querySelector('.vrm-main').scrollTop = 600; }); await pg.waitForTimeout(500);
        const r3avant = await ecran(pg);
        await pg.evaluate(() => { try { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); } catch (_) {} });
        await pg.close();
        ({ pg } = await ouvrirPage(ctx));
        // (27 nov., R3 rouge une fois en CI : recherche null, défilement 0) On attend un ÉTAT, jamais un délai : l'écran Annonces
        // prêt (`.vrm-attente[data-attente-ecran="annonces"]` à « pret » ou « plafond », src/AttenteEcran.jsx), puis SON champ
        // monté et sa valeur rendue (la reprise la repose), puis le défilement reposé — chacun borné ; ce qui n'arrive pas
        // est lu tel quel et rougit plus bas (le jugement ne change pas).
        await pg.waitForFunction(() => !!document.querySelector('.vrm-main[data-ecran="annonces"] .vrm-attente[data-attente-ecran="annonces"]:is([data-attente="pret"], [data-attente="plafond"])'), null, { timeout: 30000 }).catch(() => {});
        await pg.waitForFunction(([sel, v]) => { const c = document.querySelector(sel); return !!c && c.getClientRects().length > 0 && c.value === v; }, [CHAMP_ANNONCES, r3avant.recherche], { timeout: 15000 }).catch(() => {});
        await pg.waitForFunction((h) => { const m = document.querySelector('.vrm-main'); return !!m && Math.abs(m.scrollTop - h) <= 4; }, r3avant.defile, { timeout: 10000 }).catch(() => {});
        const r3 = await ecran(pg);
        await capture(pg, `reprise-annonces-${sombre ? 'sombre' : 'clair'}`);
        dit(r3avant.ecran === 'annonces' && r3.ecran === 'annonces' && r3.site === r3avant.site && r3.recherche === 'taille', `R3 ${qui} : rouverte, même écran, même filtre, même recherche`, JSON.stringify(r3));
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
          // ⚠️ (26 nov., bancs natifs) LA COLONNE NATIVE (src/natif/BarreLaterale.jsx, App.jsx `LateraleNative`, 19–21 nov.) :
          // libellés `.n-laterale-libelle`, titres de groupe `.n-laterale-titre`, la marque `[data-n-marque]` (le logo VRM, une
          // image `alt="VRM"` : le « VI » coupé de la capture Edge serait un logo rogné par le bord de la colonne).
          const r = await pg.evaluate(() => {
            const side = document.querySelector('[data-n-laterale]'); if (!side) return null;
            const sr = side.getBoundingClientRect();
            const libs = [...side.querySelectorAll('.n-laterale-libelle, .n-laterale-titre, .n-laterale-compte-nom')].filter((e) => e.getClientRects().length);
            const coupes = libs.filter((e) => { const q = e.getBoundingClientRect(); if (q.width <= 1 && q.height <= 1) return false; /* rangé pour les lecteurs d'écran (colonne réduite), pas coupé */ return e.scrollWidth > e.clientWidth + 1 || q.right > sr.right + 1 || q.left < sr.left - 1; }).map((e) => e.innerText);
            // Rien PAR-DESSUS la colonne : au milieu de chaque libellé visible, c'est la colonne qu'on touche.
            const recouverts = libs.filter((e) => { const q = e.getBoundingClientRect(); if (q.width <= 1 || q.bottom < 0 || q.top > innerHeight) return false; const h = document.elementFromPoint(q.left + Math.min(q.width - 1, 30), q.top + q.height / 2); return !h || !side.contains(h); }).map((e) => e.innerText);
            const logo = side.querySelector('[data-n-marque] img[alt="VRM"], [data-n-marque] svg');
            const lq = logo ? logo.getBoundingClientRect() : null;
            const hitLogo = lq ? document.elementFromPoint(lq.left + lq.width / 2, lq.top + lq.height / 2) : null;
            const logoEntier = !!lq && lq.width >= 24 && lq.height >= 24 && lq.left >= sr.left - 0.5 && lq.right <= sr.right + 0.5 && lq.top >= sr.top - 0.5 && !!hitLogo && side.contains(hitLogo);
            const groupes = [...side.querySelectorAll('.n-laterale-groupe')].map((g) => { const t = g.querySelector('.n-laterale-titre'); const tq = t ? t.getBoundingClientRect() : null; return { titre: !!t, titreVu: !!tq && tq.width > 1 && tq.height > 1 && t.scrollWidth <= t.clientWidth + 1, entrees: [...g.querySelectorAll('[data-n-entree]')].map((e) => e.getAttribute('data-n-entree')) }; });
            return { coupes, recouverts, logoEntier, largeur: Math.round(sr.width), reduite: side.getAttribute('data-n-reduite') === '1', groupes };
          });
          await capture(pg, `colonne-${c.w}x${c.h}${c.zoom ? '-z' : ''}-${c.sombre ? 'sombre' : 'clair'}`);
          // O3 (27 nov.) AUJOURD'HUI TIENT DANS SES COLONNES : à 1008 × 633 (Edge à 150 %), trois colonnes de ~210 px
          // rognaient « 2 146 € », posaient le compte sous le prix, cassaient « nouvea / ux » et le « S » de la semaine
          // (_journee-tient.cjs). Chaque fenêtre d'ordinateur, chaque thème.
          await pg.waitForSelector('.sj-journee[data-sj-ordi="1"] .sj-grille-colonnes .sj-v-ligne', { timeout: 8000 }).catch(() => {});
          await pg.evaluate(() => (document.fonts ? document.fonts.ready : null)).catch(() => {});
          const tient = await pg.evaluate(TIENT.mesureTient);
          TIENT.juger(dit, tient, `O3 ${qui} :`);
          // O3 (27 nov., zoom 125 %) LE GRAND CHIFFRE DU JOUR ET SA PHRASE ne passent jamais SOUS la semaine : la grille « chiffre 1fr |
          // semaine auto » écrasait « 80 € » à 8 px ; une rangée qui passe à la ligne la remplace (src/design/verre-journee.css). Chaque
          // morceau de texte du chiffre (montant, « vendu aujourd'hui · … ») ne croise aucune barre ni lettre de la semaine.
          const croise = await pg.evaluate(() => {
            const a = [...document.querySelectorAll('.sj-journee[data-sj-ordi="1"] .vrm-jv2-argent')].find((x) => x.getClientRects().length); if (!a) return null;
            const boites = (sel) => [...a.querySelectorAll(sel)].flatMap((e) => { const r = document.createRange(); r.selectNodeContents(e); return [...r.getClientRects()]; }).filter((q) => q.width > 0.5 && q.height > 0.5);
            const chiffre = boites('.vrm-jv2-corps .vrm-jv2-grand, .vrm-jv2-corps .vrm-jv2-faits > span');
            const semaine = boites('.vrm-jv2-frise .vrm-jv2-jour');
            const x = [];
            for (const p of chiffre) for (const q of semaine) if (p.left < q.right - 0.5 && q.left < p.right - 0.5 && p.top < q.bottom - 0.5 && q.top < p.bottom - 0.5) x.push([Math.round(p.left), Math.round(p.right), Math.round(q.left), Math.round(q.right)]);
            return { n: chiffre.length, x };
          });
          dit(!!croise && croise.n > 0 && croise.x.length === 0, `O3 ${qui} : le grand chiffre et sa phrase ne passent pas sous la semaine`, JSON.stringify(croise));
          dit(!!r && r.logoEntier && r.coupes.length === 0, `O ${qui} : le logo « VRM » entier et aucun libellé de la colonne coupé`, JSON.stringify(r));
          dit(!!r && r.recouverts.length === 0, `O ${qui} : rien ne passe par-dessus la colonne`, JSON.stringify(r && r.recouverts));
          // (9 nov.) Le groupe « Plateformes » est RETIRÉ de la colonne (décision du 8 nov.,
          // docs/passation/2026-11-08-navigation-plateformes.md : des tâches uniques, les sites dans les tâches).
          // ⚠️ (26 nov., bancs natifs) Les groupes Vendre · Ranger · Compter du rail commun (17 nov.) sont remplacés le 21 nov.
          // (onglets-menu, App.jsx `groupesMenu` : « totalement réorganiser les onglets ») : en tête les CINQ onglets de la barre
          // du téléphone (Aujourd'hui · Annonces · Ventes · Achats · Argent), puis des groupes titrés (Gestion, Dans l'extension,
          // Aide), Paramètres = la carte du compte au pied. Exige, sur les ids (`data-n-entree`, jamais un libellé) : la tête =
          // les cinq onglets, dans l'ordre ; au moins deux groupes titrés, titres lisibles en colonne large ; AUCUNE entrée par
          // plateforme ; aucune entrée en double.
          const PLATEFORMES = /^(plat_|vinted$|leboncoin$|ebay$|vestiaire$|lbc$|vc$)/;
          const toutes = r ? r.groupes.flatMap((g) => g.entrees) : [];
          dit(!!r && r.groupes.length > 0 && JSON.stringify(r.groupes[0].entrees) === JSON.stringify(['journee', 'annonces', 'ventes', 'achats', 'compta'])
            && r.groupes.filter((g) => g.titre).length >= 2 && (r.reduite || r.largeur < 120 || r.groupes.filter((g) => g.titre).every((g) => g.titreVu))
            && !toutes.some((id) => PLATEFORMES.test(id)) && new Set(toutes).size === toutes.length,
          `O ${qui} : en tête les cinq onglets du téléphone, puis des groupes titrés (titres lisibles), aucune entrée par plateforme ni en double`, JSON.stringify(r && { groupes: r.groupes, largeur: r.largeur }));
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
            const side = document.querySelector('[data-n-laterale]');
            // (26 nov., bancs natifs) Les libellés de la colonne NATIVE (src/natif/BarreLaterale.jsx) et son logo : l'ancien
            // `.vrm-rail-lib` n'existe plus, la liste était vide et le contrôle ne pouvait plus échouer — à l'ordinateur il en faut.
            const libs = side ? [...side.querySelectorAll('.n-laterale-libelle, .n-laterale-titre, .n-laterale-compte-nom, [data-n-marque] img')].filter((e) => e.getClientRects().length && e.getBoundingClientRect().width > 1) : [];
            const railVisible = libs.filter((e) => { const r = e.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && !dedans(r.left + 4, r.top + r.height / 2); }).map((e) => e.innerText);
            const coins = [[2, 2], [innerWidth - 3, 2], [2, innerHeight - 3], [innerWidth - 3, innerHeight - 3], [innerWidth - 20, innerHeight / 2], [20, innerHeight / 2]];
            return { rect: [q.left, q.top, q.width, q.height].map(Math.round), vw: innerWidth, vh: innerHeight, railVisible, nLibs: libs.length, coins: coins.map(([x, y]) => dedans(x, y)) };
          });
          await capture(pg, `recharger-${c.w}x${c.h}-${c.sombre ? 'sombre' : 'clair'}`);
          dit(!!r, `O2 ${qui} : le bloc « Recharger » est là`);
          dit(!!r && r.rect[0] === 0 && r.rect[1] === 0 && r.rect[2] === r.vw && r.rect[3] === r.vh, `O2 ${qui} : il couvre toute la fenêtre`, JSON.stringify(r && { rect: r.rect, vw: r.vw, vh: r.vh }));
          dit(!!r && r.coins.every(Boolean), `O2 ${qui} : bords et coins touchent le bloc (rien de lisible ni de touchable à côté)`, JSON.stringify(r && r.coins));
          dit(!!r && (c.mode !== 'ordi' || r.nLibs > 0) && r.railVisible.length === 0, `O2 ${qui} : la colonne n'apparaît pas dessous (aucun « Ven », « Gér », « VI »)`, JSON.stringify(r && { visibles: r.railVisible, libellesLus: r.nLibs }));
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
