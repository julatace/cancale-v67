// ════════════════════════════════════════════════════════════════════════════
//  BANC « MISE EN LIGNE PENDANT QUE L'APP EST OUVERTE » — filet 3 du 6 nov.
//  Le 6 nov. au matin, sur iOS Safari : « Unable to preload CSS for
//  /assets/App-….css » juste après une mise en ligne — enregistré comme un
//  PLANTAGE. Les fichiers de l'app sont nommés par leur contenu : une page
//  restée ouverte demande des morceaux que le nouveau déploiement n'a plus.
//  Vercel Hobby n'a pas la « Skew Protection ». main.jsx recharge la page
//  (`vite:preloadError`) ; ce banc juge le reste.
//  Données INVENTÉES : le jeu et le harnais de `nouveau-vendeur`.
//  Le banc ouvre l'app, PUIS « met en ligne » : chaque fichier /assets/ que la
//  page n'a pas encore chargé répond 404 (ce que fait Vercel après un
//  déploiement). Il ouvre alors un écran chargé à la demande (E-mails, avec sa
//  feuille de style à part).
//   M1 (déploiement fini) la page se recharge UNE fois, l'écran s'ouvre ensuite ;
//      aucun plantage noté ; le morceau est COMPTÉ À PART (`vrm_morceaux_perimes`) ;
//   M2 (les anciens fichiers restent introuvables, vraie panne) : après le
//      rechargement, l'erreur repart — elle n'est TOUJOURS PAS notée comme
//      plantage (comptée à part), l'écran dit son souci à sa place et la
//      navigation marche ; jamais une boucle de rechargements.
//  Réglages : `BANC_PORT` (défaut 10022), `BANC_DIST` (un autre dist/), `SHOTS` (captures),
//  `MV_W=390` / `MV_UN=1` (une largeur, un passage), `MV_DBG`/`MV_DBG2` (diagnostic),
//  `MV_MUTATION_ALIAS=1` (mutation : l'alias d'avant, qui faisait exécuter deux fois le point d'entrée).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
process.env.BANC_PORT = process.env.BANC_PORT || '10022';
const path = require('path');
const NV = require('./nouveau-vendeur.cjs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const PORT = NV.PORT;

let ko = 0;
const dit = (bon, quoi, det) => { if (!bon) ko++; console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det ? ' — ' + String(det).slice(0, 500) : ''}`); };
const base = () => ({ lignes: JSON.parse(JSON.stringify(NV.JEU_LIGNES)), comptes: NV.JEU_COMPTES, ecritures: 0 });

// E-mails : dans la barre latérale à l'ordinateur ; au téléphone, dans le menu de l'avatar (choix n° 61 du 14 nov. :
// plus de « Plus » dans la barre — le menu du haut porte Messages, Stock, E-mails…).
// (24 nov., morceaux-perimes) Le chemin par le menu de l'avatar ou la barre latérale n'aboutissait plus (l'écran restait
// « journee », sur main aussi) : E-mails est ouvert comme le fait l'app elle-même pour un lien (`vrm:aller`). La règle jugée
// est inchangée — un écran DEMANDÉ dont le morceau n'existe plus ⇒ UN rechargement vers la nouvelle version.
async function versEmails(pg) {
  await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:aller', { detail: '?tab=emails' }))).catch(() => {});
}
async function scenario(nav, { W, panne, jsSeul = false }) {
  const T = `[${W}px ${panne ? 'panne' : jsSeul ? 'déploiement, CSS déjà là' : 'déploiement'}]`;
  const tel = W < 600;
  // Le « déploiement » : un drapeau ; tant qu'il est levé, tout /assets/ que la
  // page n'a pas DÉJÀ chargé répond 404. `panne` : il reste levé après le rechargement.
  const etat = { deploye: false, charges: new Set(), refus: [], ancienApres: [] };
  const nc = nav.newContext.bind(nav);
  nav.newContext = async (...a) => {
    const ctx = await nc(...a);
    // `MV_DBG2=1` (24 nov.) : nomme le nœud qu'un `removeChild`/`insertBefore` vise hors de son parent (diagnostic du dernier filet).
    if (process.env.MV_DBG2) await ctx.addInitScript(() => {
      const d = (n) => n ? (n.nodeName + (n.id ? '#' + n.id : '') + (n.className && typeof n.className === 'string' ? '.' + n.className.trim().split(/\s+/).join('.') : '') + (n.getAttribute && n.getAttribute('data-attente') ? '[attente=' + n.getAttribute('data-attente') + ']' : '')) : String(n);
      const ch = (n) => { const out = []; for (let x = n; x && out.length < 8; x = x.parentNode) out.push(d(x)); return out.join(' < '); };
      const o = Node.prototype.removeChild;
      Node.prototype.removeChild = function (c) { if (c && c.parentNode !== this) { console.log('RMFAIL parent=' + ch(this) + ' || child=' + ch(c) + ' || html=' + (c.outerHTML || c.textContent || '').slice(0, 300) + ' || ' + new Error().stack.split('\n').slice(2, 6).join(' / ')); } return o.call(this, c); };
      const ib = Node.prototype.insertBefore;
      Node.prototype.insertBefore = function (c, r) { if (r && r.parentNode !== this) console.log('IBFAIL parent=' + ch(this) + ' || ref=' + ch(r)); return ib.call(this, c, r); };
    });
    // (17 nov., chasse-bugs) RÈGLE DU 15 NOV. (chantier « ouverture », src/chargementSur.js `verifierMorceauPerime`) : la page
    // ne se recharge QUE si le serveur sert une AUTRE version (son index.html nomme un autre `index-….js`). Une vraie
    // mise en ligne change ce nom : après « le déploiement », le serveur du banc sert la page sous un nouveau nom de
    // script principal (un alias du même fichier) ; en « panne », il sert la même version (aucun rechargement voulu).
    // (24 nov., crash-apres-deploiement) UNE VRAIE MISE EN LIGNE RENOMME TOUT MORCEAU JS QUI CHANGE — le script principal ET
    // chaque morceau qui l'importe (« ./index-<empreinte>.js » : Rollup recalcule leurs empreintes). L'alias d'avant ne
    // renommait que le script principal : les morceaux (App…, servis tels quels, souvent par le service worker qui les
    // gardait sous le MÊME nom) importaient encore l'ancien nom ⇒ src/main.jsx s'exécutait DEUX fois sur la page relue,
    // deux racines React sur #root, la seconde vidait le conteneur de la première ⇒ « removeChild … not a child » (le
    // dernier filet). Une fiction du banc, jamais une vraie mise en ligne (récit : 2026-11-24-crash-apres-deploiement.md).
    // Donc la nouvelle version nomme AUTREMENT chaque fichier JS (`index-NEUF…`, `NEUF<nom>`), partout où il est nommé
    // (page, version-app.json, imports et listes de préchargement des morceaux), et le serveur les sert sous ce nom.
    // `MV_MUTATION_ALIAS=1` rejoue l'alias d'avant (preuve par mutation : le banc retombe au rouge).
    const fs = require('fs');
    const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
    const JS = new Set(fs.readdirSync(path.join(DIST, 'assets')).filter((f) => /\.js$/.test(f)));
    const alias = !!process.env.MV_MUTATION_ALIAS;
    const neuf = (f) => (/^index-/.test(f) ? 'index-NEUF' + f.slice(6) : alias ? f : 'NEUF' + f);
    const renommer = (t) => t.replace(/(\.\/|assets\/)([A-Za-z0-9_.~-]+\.js)\b/g, (m, pre, f) => (JS.has(f) ? pre + neuf(f) : m));
    await ctx.route((u) => { const x = new URL(u); return /^localhost$|^127\./.test(x.hostname) && (x.pathname === '/' || x.pathname === '/index.html' || !/\.\w+$/.test(x.pathname)); }, async (route) => {
      // La nouvelle version reste en ligne après le rechargement (une mise en ligne ne revient pas en arrière).
      if (!etat.nouvelle || panne || route.request().method() !== 'GET') return route.fallback();
      const r = await route.fetch(); const html = await r.text();
      return route.fulfill({ response: r, body: renommer(html) });
    });
    // (22 nov., latence-totale) La version en 60 octets (`/version-app.json`, lue d'abord) dit la même chose que la page.
    await ctx.route((u) => { const x = new URL(u); return /^localhost$|^127\./.test(x.hostname) && x.pathname === '/version-app.json'; }, async (route) => {
      if (!etat.nouvelle || panne || route.request().method() !== 'GET') return route.fallback();
      const r = await route.fetch(); const t = await r.text();
      return route.fulfill({ response: r, body: renommer(t) });
    });
    await ctx.route(/\/assets\/(index-)?NEUF/, (route) => route.fulfill({ status: 200, contentType: 'text/javascript',
      body: renommer(fs.readFileSync(path.join(DIST, new URL(route.request().url()).pathname.replace('NEUF', '')), 'utf8')) }));
    await ctx.route(/\/assets\//, (route) => {
      const p = new URL(route.request().url()).pathname;
      if (/\/assets\/(index-)?NEUF/.test(p)) return route.fallback();
      if (etat.relu && /\/assets\/index-[\w-]+\.js$/.test(p)) etat.ancienApres.push(p);   // la page relue vise l'ANCIEN point d'entrée
      // `jsSeul` (14 nov.) : la feuille de style est déjà là (gardée, ou un morceau sans CSS) — seul le JS manque.
      if (etat.deploye && !etat.charges.has(p) && !(jsSeul && /\.css$/.test(p))) { etat.refus.push(p); return route.fulfill({ status: 404, contentType: 'text/plain', body: 'Not Found' }); }
      etat.charges.add(p);
      return route.fallback();
    });
    // Le nouveau déploiement est en ligne dès que la page se RECHARGE (Vercel bascule
    // d'un coup) : la page relue vise alors des fichiers qui existent. En « panne »,
    // les fichiers restent introuvables même après.
    ctx.on('request', (r) => { if (!panne && etat.deploye && r.resourceType() === 'document') { etat.deploye = false; etat.relu = true; } });
    // (14 nov., fiabilité prod) Le rechargement d'un iPhone n'est pas instantané : tant que la
    // page relue n'est pas arrivée, l'ANCIENNE page vit encore et React rend ce que l'import lui a
    // donné. Mesuré en production (64 écrans tombés du 10 au 12 nov. : « undefined is not an object
    // (evaluating 'e.FactureVente') », « …reading 'default' ») : main.jsx appelait
    // `ev.preventDefault()` et Vite rendait `undefined` au lieu du module. La page relue arrive
    // donc ici 2,5 s plus tard (le premier chargement, lui, tout de suite).
    let documents = 0;
    await ctx.route('**/*', async (route) => {
      if (route.request().resourceType() === 'document' && route.request().frame() === route.request().frame().page().mainFrame() && documents++ > 0) await new Promise((ok) => setTimeout(ok, 2500));
      return route.fallback();
    });
    return ctx;
  };
  const bv = base();
  const o = await NV.ouvrir(nav, { W, sombre: false, base: bv, tab: 'journee' });
  nav.newContext = nc;
  let chargements = 0;
  if (process.env.MV_DBG) o.pg.on('console', async (m) => { if (m.type() !== 'error' || !/application en erreur/.test(m.text())) return; try { const a = m.args(); const st = await a[1].evaluate((e) => String(e && e.stack)); const cs = a[2] ? await a[2].evaluate((x) => String(x)) : ''; console.log('MVSTACK', st.slice(0, 1500), '\nCOMPOSANTS', cs.slice(0, 1500)); } catch (e) { console.log('MVSTACK?', String(e)); } });
  if (process.env.MV_DBG2) o.pg.on('request', async (r) => { if (/\/assets\/index-/.test(r.url())) console.log('REQ', r.url(), r.serviceWorker ? (r.serviceWorker() ? 'SW' : '') : '', (await r.allHeaders().catch(() => ({})))['referer'] || ''); });
  if (process.env.MV_DBG2) o.pg.on('console', (m) => { if (/RMFAIL|IBFAIL/.test(m.text())) console.log(m.text().slice(0, 1500)); });
  o.pg.on('load', () => { chargements++; });
  await o.pg.waitForTimeout(3000);
  // La mise en ligne.
  etat.deploye = true; etat.nouvelle = !panne;
  await versEmails(o.pg);
  await o.pg.waitForTimeout(5000);
  await o.pg.waitForLoadState('domcontentloaded').catch(() => {});
  await o.pg.waitForSelector('.vrm-main', { timeout: 20000 }).catch(() => {});
  await o.pg.waitForTimeout(2500);
  // Après le rechargement, l'app peut être revenue ailleurs : on rouvre E-mails.
  const surEmails = await o.pg.evaluate(() => (document.querySelector('.vrm-main') || { getAttribute: () => '' }).getAttribute('data-ecran') === 'emails');
  if (!surEmails) {
    await versEmails(o.pg);
    await o.pg.waitForTimeout(2500);
  }
  await o.pg.waitForTimeout(4000);   // la file des plantages part vers la base 3 s après
  const vu = await o.pg.evaluate(() => {
    const t = document.body.innerText || '';
    let file = [], compte = null;
    try { file = JSON.parse(localStorage.getItem('vrm_plantages_attente') || '[]'); } catch (_) {}
    try { compte = JSON.parse(localStorage.getItem('vrm_morceaux_perimes') || 'null'); } catch (_) {}
    const nav = document.querySelector('nav[data-n-onglets], [data-n-laterale], .vrm-mobile-nav, .vrm-sidebar');   // (24 nov., main-vert) la barre NATIVE (téléphone) et la colonne native (ordinateur)
    return { file: file.map((x) => x.message), compte, ecran: (document.querySelector('.vrm-main') || { getAttribute: () => '' }).getAttribute('data-ecran'),
      souci: /n'a pas pu s'afficher/.test(t), dernierFilet: /L'application n'a pas pu démarrer/.test(t), nav: !!(nav && nav.getBoundingClientRect().height) };
  });
  if (process.env.MV_DBG) console.log('MVDBG', T, await o.pg.evaluate(() => { const t = document.body.innerText || ''; const i = t.indexOf("n'a pas pu démarrer"); return i < 0 ? 'pas de filet' : t.slice(Math.max(0, i - 200), i + 600); }));
  const enBase = bv.lignes.filter((l) => /^plantage_/.test(l.id)).map((l) => l.data && l.data.message);
  const morceaux = vu.file.concat(enBase).filter((m) => /preload CSS|dynamically imported module|module script failed/i.test(m || ''));
  dit(etat.refus.length > 0, `${T} (contrôle du banc) des fichiers d'avant ont bien été refusés`, JSON.stringify(etat.refus));
  // (24 nov.) Une vraie mise en ligne : la page relue ne demande JAMAIS l'ancien script principal (sinon src/main.jsx s'exécute
  // deux fois — une fiction de banc, voir l'en-tête de `renommer`).
  if (!panne) dit(!etat.ancienApres.length, `${T} (contrôle du banc) la nouvelle version ne nomme plus l'ancien script principal`, JSON.stringify(etat.ancienApres));
  // Règle du 15 nov. : déploiement (autre version en ligne) ⇒ UN rechargement ; panne (même version) ⇒ AUCUN (l'écran relance
  // son morceau puis dit « Mettre à jour VRM ») — jamais une boucle.
  if (!panne) dit(chargements === 1, `${T} une autre version en ligne : la page s'est rechargée UNE fois (jamais une boucle)`, `${chargements} rechargement(s)`);
  else dit(chargements === 0, `${T} même version (panne) : aucun rechargement (jamais une boucle)`, `${chargements} rechargement(s)`);
  dit(!morceaux.length, `${T} aucun plantage noté pour un morceau d'un ancien déploiement`, JSON.stringify(morceaux));
  // (14 nov.) Ni « undefined is not an object » ni « reading 'default' » : l'import ne rend jamais `undefined`.
  const indefinis = vu.file.concat(enBase).filter((m) => /undefined|is not an object|reading 'default'/i.test(m || ''));
  dit(!indefinis.length, `${T} aucun écran tombé sur un module « undefined » pendant le rechargement`, JSON.stringify(indefinis));
  dit(vu.compte && vu.compte.n >= 1 && /preload CSS|imported module/i.test(vu.compte.message || ''), `${T} le morceau est compté À PART sur l'appareil (vrm_morceaux_perimes)`, JSON.stringify(vu.compte));
  if (!panne) dit(vu.ecran === 'emails' && !vu.souci && !vu.dernierFilet, `${T} après le rechargement, E-mails s'ouvre normalement`, JSON.stringify(vu));
  else {
    dit(!vu.dernierFilet && vu.nav, `${T} panne : la coque et la navigation restent (jamais le dernier filet)`, JSON.stringify(vu));
  }
  // `SHOTS=dossier` : la page APRÈS le rechargement, à regarder (§6.2 — le dernier filet ne se voit pas dans un compte).
  if (process.env.SHOTS) await o.pg.screenshot({ path: path.join(process.env.SHOTS, `morceau-perime-${W}-${panne ? 'panne' : jsSeul ? 'css-la' : 'deploiement'}.png`) }).catch(() => {});
  await o.ctx.close();
}

(async () => {
  await new Promise((ok) => NV.srv.listen(PORT, ok));
  const nav = await chromium.launch({ executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const W of (process.env.MV_W ? [Number(process.env.MV_W)] : [1512, 390])) for (const [panne, jsSeul] of (process.env.MV_UN ? [[false, false]] : [[false, false], [false, true], [true, false]])) {
      try { await scenario(nav, { W, panne, jsSeul }); } catch (e) { dit(false, `[${W}px] le passage a pu aller au bout`, String(e && e.stack).slice(0, 300)); }
    }
  } catch (e) { dit(false, 'le banc a pu aller au bout', String(e && e.stack).slice(0, 300)); }
  await nav.close(); NV.srv.close();
  console.log(ko ? `\n❌ morceau-perime : ${ko} défaut(s)` : '\n✅ morceau-perime : rien à signaler');
  process.exit(ko ? 1 : 0);
})();
