// ════════════════════════════════════════════════════════════════════════════
//  Banc : LES ÉCRANS GARDÉS (8 nov., src/ecransGardes.jsx, src/passageOnglet.js)
//  node scripts/bancs/ecrans-gardes.cjs [dist]
//  Base inventée (_base-volume), 390 px tactile. Rien de réel.
//
//  Ce qu'il juge (sur le DOM, le réseau et les rendus de React — jamais un libellé) :
//   1. REVENIR sur un écran déjà vu par la barre du bas : le MÊME écran (le même
//      nœud du DOM), sans squelette, sans lecture, en moins de RETOUR_MAX ms, et
//      le moteur `Comptabilite` n'est pas recalculé (aucun rendu au retour).
//   2. Un écran gardé CACHÉ ne rend rien, ne publie rien, ne lit rien : sur
//      Réglages, on rejoue les signaux de l'extension, des transporteurs, une
//      sauvegarde, un retour au premier plan — aucune des lectures que fait Ma
//      journée MONTRÉE sur ces signaux (hors celles de la coque, relevées sur
//      Réglages seul), aucun rendu de `Comptabilite` hors de la page, aucune publication.
//   3. Après ces signaux, l'écran gardé est REMONTÉ à son retour (jamais périmé).
//   4. Un lien (pas la barre) remonte l'écran (il lit sa demande au montage).
//   5. Un seul écran dans la page : jamais deux `[data-attente-ecran]`.
//   6. Le passage : le nouvel écran arrive en fondu (Web Animations sur `<main>`) ;
//      mouvement réduit ⇒ ni fondu, ni glissé de la pastille, aucune animation sur `<main>`.
//  Les rendus de React sont relevés par un crochet d'outils de développement
//  posé avant l'app (`__REACT_DEVTOOLS_GLOBAL_HOOK__`) : chaque fibre au
//  `Comptabilite` (props `only` + `accounts` + `garageGrid`) RENDUE dans un rendu
//  validé (ses états changent d'objet), et si elle vit dans un conteneur détaché (caché).
// ════════════════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs'), http = require('http');
const RACINE = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(RACINE, 'node_modules', 'playwright'));
const { fabriquer, repondre } = require(path.join(__dirname, '_base-volume.cjs'));
const base = fabriquer({ volumeReel: true });
const DIST = process.argv[2] || path.join(RACINE, 'dist');
const PORT = +(process.env.BANC_PORT || 9651);
const RETOUR_MAX = +(process.env.RETOUR_MAX || 1000);   // large : conteneur partagé, chargé ; les preuves sont le nœud, les lectures, les montages
const CLES_PUBLIEES = ['vrm_colis_aposter', 'vrm_colis_retirer', 'vrm_colis_prets', 'widget_stats', 'vinted_nums_physiques', 'vinted_urssaf_mois', 'vrm_benefice_jours', 'vrm_paires_dorment'];
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d != null ? ' — ' + d : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/json', '.json': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ')'); process.exit(1); });
srv.listen(PORT);
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

// Posé AVANT l'app : le crochet que React appelle à chaque rendu validé.
function crochet() {
  window.__rendusCaches = []; window.__rendusCompta = []; window.__releve = false; window.__suivre = false;
  const estCompta = (p) => p && typeof p === 'object' && 'only' in p && 'accounts' in p && 'garageGrid' in p;
  const portail = (f) => { for (let x = f; x; x = x.return) if (x.tag === 4) return x.stateNode && x.stateNode.containerInfo; return null; };
  const vus = new WeakMap();
  const parcourir = (racine) => {
    const pile = [racine];
    while (pile.length) {
      const f = pile.pop(); if (!f) continue;
      if (f.child) pile.push(f.child);
      if (f.sibling) pile.push(f.sibling);
      if (estCompta(f.memoizedProps)) {
        // A-t-elle été RENDUE dans ce rendu validé ? Ses états (la liste de ses hooks)
        // sont un nouvel objet à chaque rendu ; un sous-arbre sauté garde les siens.
        // (Le drapeau « PerformedWork » d'une fibre sautée reste celui de son dernier rendu.)
        const avant = vus.has(f) ? vus.get(f) : (f.alternate && vus.has(f.alternate) ? vus.get(f.alternate) : undefined);
        const rendue = avant !== undefined && avant !== f.memoizedState;
        const montee = avant === undefined;   // une fibre jamais vue : un MONTAGE (tous ses calculs repartent de zéro)
        vus.set(f, f.memoizedState); if (f.alternate) vus.set(f.alternate, f.memoizedState);
        if ((rendue || montee) && window.__releve) {
          const c = portail(f); const cache = !!(c && !c.isConnected);
          window.__rendusCompta.push({ only: f.memoizedProps.only, cache, montee });
          if (cache) window.__rendusCaches.push(f.memoizedProps.only);
        }
      }
    }
  };
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true, renderers: new Map(), isDisabled: false,
    inject() { return 1; }, checkDCE() {}, onScheduleFiberRoot() {}, onCommitFiberUnmount() {}, onPostCommitFiberRoot() {},
    onCommitFiberRoot(id, root) { if (window.__suivre) { try { parcourir(root.current); } catch (_) {} } },
  };
}

async function page(b, { reduit = false } = {}) {
  const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: reduit ? 'reduce' : 'no-preference' });
  await ctx.addInitScript(() => {
    localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vrm_visite_bulles_vue', '1');
    window.__sq = 0; window.__saves = []; window.__vrmGardeDebug = true; window.__fondus = 0;
    try { const a = Element.prototype.animate; Element.prototype.animate = function (...x) { if (this.classList && this.classList.contains('vrm-main')) window.__fondus++; return a.apply(this, x); }; } catch (_) {}
    window.addEventListener('vrm:save', (e) => { const d = e && e.detail; if (d && d.k) window.__saves.push(d.k); });
    new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes || []) if (n instanceof Element && (n.matches('[data-demarrage-attente]') || n.querySelector('[data-demarrage-attente]'))) window.__sq++; })
      .observe(document, { childList: true, subtree: true });
  });
  await ctx.addInitScript(crochet);
  const pg = await ctx.newPage();
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(e.message));
  const lectures = [];
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
  await pg.route('**/rest/v1/**', async (route) => {
    const rq = route.request();
    if (rq.method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
    lectures.push(decodeURIComponent(rq.url().replace(/^.*\/rest\/v1\//, '')));
    const h = await rq.allHeaders(); const rep = repondre(rq.url(), h.range, base);
    return route.fulfill({ status: rep.status, contentType: 'application/json', headers: { ...(rep.headers || {}) }, body: JSON.stringify(rep.body) });
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  return { ctx, pg, erreurs, lectures };
}
const ecranPret = (pg, tab, ms = 60000) => pg.waitForFunction((t) => { const e = document.querySelector(`[data-attente-ecran="${t}"]`); return !document.getElementById('vrm-demarrage') && e && e.isConnected && /pret|plafond/.test(e.getAttribute('data-attente') || ''); }, tab, { timeout: ms });
const calme = async (lectures, ms = 2000, max = 30000) => { const t0 = Date.now(); let n = lectures.length, tc = Date.now(); while (Date.now() - tc < ms && Date.now() - t0 < max) { await attendre(200); if (lectures.length !== n) { n = lectures.length; tc = Date.now(); } } };
// Toucher un onglet de la barre ; rend le temps jusqu'à la première image où l'écran visé est posé.
async function toucher(pg, tab) {
  await pg.evaluate((t) => { window.__tf = null; window.__t0 = performance.now(); window.__sq = 0; const r = () => { const e = document.querySelector(`[data-attente-ecran="${t}"]`); if (e && e.isConnected && /pret|plafond/.test(e.getAttribute('data-attente') || '')) { window.__tf = performance.now() - window.__t0; return; } requestAnimationFrame(r); }; requestAnimationFrame(r); }, tab);
  await pg.locator(`.vrm-tabbar [data-nav-entree="${tab}"]`).click();
  await pg.waitForFunction(() => window.__tf != null, null, { timeout: 60000 });
  return pg.evaluate(() => ({ ms: Math.round(window.__tf), squelettes: window.__sq }));
}
// Un repère posé sur le nœud de l'écran : le retrouver = le même écran, pas un remontage.
const marquer = (pg, tab, v) => pg.evaluate(([t, x]) => { const e = document.querySelector(`[data-attente-ecran="${t}"]`); if (e) e.__repere = x; }, [tab, v]);
const repere = (pg, tab) => pg.evaluate((t) => { const e = document.querySelector(`[data-attente-ecran="${t}"]`); return e ? (e.__repere || null) : 'absent'; }, tab);

async function versReglages(pg) {
  // (11 nov., lot DJ6) Paramètres s'ouvre par la photo du profil (en-tête), puis « Paramètres ».
  await pg.locator('[data-profil-tete]').first().click();
  await pg.locator('[data-profil-menu="parametres"]').first().click();
  await ecranPret(pg, 'settings');
}
async function signaux(pg) {
  await pg.evaluate(() => {
    const ev = (n, d) => window.dispatchEvent(new CustomEvent(n, { detail: d }));
    try { localStorage.setItem('vrm_stock_vendus', JSON.stringify({ banc: Date.now() })); } catch (_) {}
    ev('vrm:save', { k: 'vrm_stock_vendus' });
    for (const quoi of ['ventes', 'achats', 'label', 'annonces', 'messages', 'retrait', 'suivi', 'transp', 'versements']) ev('vrm:ext', { type: 'maj', quoi, uid: '1001' });
    ev('vrm:transp-maj'); ev('vrm:suivis-relire'); ev('vrm:suivis-manuels'); ev('vrm:ebay-maj');
  });
  await attendre(400);
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  try {
    // ── 0. Référence, dans la MÊME page (même état de la coque) : Réglages, aucun écran
    //    gardé encore, les signaux ⇒ les lectures de la coque et de Réglages seules.
    const { ctx, pg, erreurs, lectures } = await page(b);
    await pg.goto(`http://localhost:${PORT}/?tab=settings`); await ecranPret(pg, 'settings'); await calme(lectures, 3000);
    await signaux(pg); await calme(lectures, 2500);                 // un premier passage : ce que la coque relit une fois
    const n0 = lectures.length; await signaux(pg); await calme(lectures, 2500);
    const lecturesReference = lectures.slice(n0).sort();
    await pg.evaluate(() => { window.__suivre = true; });
    // Premier passage sur chaque écran (calculé), puis retour sur chacun (gardé).
    const premier = {};
    for (const t of ['journee', 'cat_bord', 'ventes', 'annonces', 'journee']) { premier[t] = await toucher(pg, t); await calme(lectures, 1500); }
    // Un repère sur chaque écran (seul l'écran montré est dans la page : on repasse sur chacun).
    for (const t of ['cat_bord', 'ventes', 'annonces', 'journee']) { await toucher(pg, t); await marquer(pg, t, 'vu-' + t); await calme(lectures, 800); }
    // Annonces n'est PAS gardée (sa grille rattachée d'un bloc s'affichait plus tard) : remontée à chaque visite.
    await toucher(pg, 'annonces'); await calme(lectures, 800);
    dit((await repere(pg, 'annonces')) !== 'vu-annonces', '1. annonces : remontée à chaque visite (pas gardée, comme avant)');
    for (const t of ['cat_bord', 'ventes', 'journee']) {
      const l0 = lectures.length;
      await pg.evaluate(() => { window.__rendusCompta = []; window.__releve = true; window.__vrmGardeEcarts = []; });
      const r = await toucher(pg, t);
      await attendre(600);
      const rc = await pg.evaluate(() => { window.__releve = false; return window.__rendusCompta.filter((x) => !x.cache); });
      const montages = rc.filter((x) => x.montee).length, rendus = rc.length - montages;
      const meme = (await repere(pg, t)) === 'vu-' + t;
      // Seule lecture permise : la SONDE de l'âge des ventes (un scalaire par compte), que
      // l'écran refait en revenant comme il la faisait en s'ouvrant (`surRetour`).
      const lu = lectures.slice(l0).filter((u) => !/^app_data\?id=like\.harvest_\*_orders_sold&select=id,cap:meta->>capturedAt$/.test(u));
      dit(meme, `1. ${t} : revenir par la barre rend le MÊME écran (aucun remontage)`);
      dit(r.squelettes === 0, `1. ${t} : aucun squelette au retour`, r.squelettes);
      dit(r.ms <= RETOUR_MAX, `1. ${t} : posé en ${r.ms} ms (premier passage : ${premier[t].ms} ms ; plafond ${RETOUR_MAX} ms)`);
      dit(lu.length === 0, `1. ${t} : aucune lecture au retour (hors la sonde de l'âge des ventes)`, lu.length ? lu.slice(0, 3).join(' | ') : 0);
      const ecarts = await pg.evaluate(() => (window.__vrmGardeEcarts || []).join(' ; '));
      // Pas REMONTÉ (ses ~150 calculs mémorisés gardés). Quelques rendus restent : ses
      // effets de mise en page sont rebranchés au retour (React) et re-posent des états.
      dit(montages === 0, `1. ${t} : le moteur Comptabilite n'est pas remonté (calculs gardés)`, `${montages} montage(s), ${rendus} rendu(s)` + (ecarts ? ' — écarts de la coque : ' + ecarts : ''));
    }
    dit(await pg.evaluate(() => document.querySelectorAll('[data-attente-ecran]').length) === 1, '5. un seul écran dans la page (les écrans gardés sont hors de la page)');
    dit(await pg.evaluate(() => window.__fondus) > 0, '6. changer d’onglet arrive en fondu (Web Animations sur <main>, aucune classe)', await pg.evaluate(() => window.__fondus));
    // Les lectures que fait un écran MONTRÉ sur ces signaux (Ma journée), hors celles de la coque
    // (vues sur Réglages) : ce que ferait en double un écran caché qui n'aurait pas tu ses écoutes.
    await signaux(pg); await calme(lectures, 2500);
    const lj = lectures.length; await signaux(pg); await calme(lectures, 2500);
    // Hors la lecture PARTAGÉE des ventes Vestiaire (`lireVentesVestiaire` : une seule pour toute
    // l'app, coque comprise, mémorisée 5 s — jamais en double) : selon l'instant, la coque la
    // refait ou non dans la fenêtre (vu 1 fois sur 4).
    const PARTAGEES = /^app_data\?id=in\.\(vc_ventes,vc_listings\)&select=id,ventes:data->ventes,liens:data->liens$/;
    const lecturesEcran = new Set(lectures.slice(lj).filter((u) => !lecturesReference.includes(u) && !PARTAGEES.test(u)));
    dit(lecturesEcran.size > 0, '2. (témoin) Ma journée montrée relit sur ces signaux', lecturesEcran.size);
    // ── 2. Caché : rien ne rend, ne publie, ne lit.
    await versReglages(pg); await calme(lectures, 2500);
    const gardes = await pg.evaluate(() => (document.querySelector('[data-ecrans-gardes]') || {}).getAttribute ? document.querySelector('[data-ecrans-gardes]').getAttribute('data-ecrans-gardes') : '');
    dit(/journee/.test(gardes) && /cat_bord/.test(gardes) && !/annonces/.test(gardes), '2. Ma journée et Colis sont gardés pendant Réglages (pas Annonces)', gardes);
    await pg.evaluate(() => { window.__rendusCaches = []; window.__saves = []; window.__releve = true; });
    await signaux(pg); await calme(lectures, 2500);                 // le même premier passage que la référence
    const l1 = lectures.length;
    await signaux(pg);
    await pg.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); });
    await calme(lectures, 2500);
    const caches = await pg.evaluate(() => { window.__releve = false; return window.__rendusCaches; });
    const pubs = await pg.evaluate((cles) => window.__saves.filter((k) => cles.includes(k)), CLES_PUBLIEES);
    const lus = lectures.slice(l1).sort();
    const enTrop = lus.filter((u) => lecturesEcran.has(u));
    dit(caches.length === 0, '2. aucun rendu de Comptabilite dans un écran caché', caches.join(' '));
    dit(pubs.length === 0, '2. aucune publication depuis un écran caché', pubs.join(' '));
    dit(enTrop.length === 0, '2. aucune lecture d’un écran caché (pas de lecture en double)', enTrop.join(' | ') || 0);
    // ── 3. Les signaux ont périmé les écrans gardés : le retour les remonte.
    const r3 = await toucher(pg, 'journee');
    dit((await repere(pg, 'journee')) !== 'vu-journee', '3. après un signal de données, Ma journée est remontée (jamais périmée)');
    await calme(lectures, 2000);
    // ── 4. Un lien (pas la barre) remonte l'écran : il lit sa demande au montage.
    await toucher(pg, 'cat_bord'); await calme(lectures, 1500); await marquer(pg, 'cat_bord', 'lien');
    await toucher(pg, 'journee'); await calme(lectures, 800);
    await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:aller', { detail: '?tab=cat_bord' })));
    await ecranPret(pg, 'cat_bord');
    dit((await repere(pg, 'cat_bord')) !== 'lien', '4. un lien vers Colis remonte l’écran (comme avant)');
    dit(erreurs.length === 0, 'aucune erreur JS', erreurs.slice(0, 2).join(' | '));
    await ctx.close();
    // ── 6. Mouvement réduit : ni fondu enchaîné, ni glissé, aucune animation sur <main>.
    {
      const { ctx: c2, pg: p2, lectures: l2 } = await page(b, { reduit: true });
      await p2.goto(`http://localhost:${PORT}/?tab=journee`); await ecranPret(p2, 'journee'); await calme(l2, 2000);
      await toucher(p2, 'cat_bord'); await calme(l2, 1200); await toucher(p2, 'journee');
      const anim = await p2.evaluate(() => (document.querySelector('.vrm-main').getAnimations ? document.querySelector('.vrm-main').getAnimations().length : 0));
      const trans = await p2.evaluate(() => { const p = document.querySelector('.vrm-tab-pastille'); return p ? getComputedStyle(p).transitionDuration : 'absente'; });
      dit(await p2.evaluate(() => window.__fondus) === 0, '6. mouvement réduit : aucun fondu');
      dit(anim === 0, '6. mouvement réduit : aucune animation sur <main>', anim);
      dit(trans !== 'absente' && String(trans).split(',').every((x) => parseFloat(x) < 0.01), '6. mouvement réduit : la pastille ne glisse pas', trans);
      await c2.close();
    }
  } catch (e) { ko++; console.log('KO  le banc a planté — ' + (e && e.message)); }
  await b.close(); srv.close();
  console.log(ko ? `\n${ko} défaut(s)` : '\nTout est vert.');
  process.exit(ko ? 1 : 0);
})();
