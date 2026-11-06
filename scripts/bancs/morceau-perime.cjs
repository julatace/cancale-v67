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
//  Réglages : `BANC_PORT` (défaut 10022), `BANC_DIST` (un autre dist/).
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

// E-mails : dans la barre latérale à l'ordinateur ; au téléphone, sous « Plus » (les tuiles).
async function versEmails(pg, tel) {
  if (!tel) { await pg.locator('.vrm-sidebar [data-nav-entree="emails"]').first().click(); return; }
  const plus = pg.locator('.vrm-tabbar button[aria-label="Plus"]').first();
  if (await plus.count()) { await plus.click(); await pg.waitForTimeout(500); }
  const tuile = pg.locator('[data-nav-entree="emails"]:visible').first();
  if (await tuile.count()) await tuile.click();
}
async function scenario(nav, { W, panne }) {
  const T = `[${W}px ${panne ? 'panne' : 'déploiement'}]`;
  const tel = W < 600;
  // Le « déploiement » : un drapeau ; tant qu'il est levé, tout /assets/ que la
  // page n'a pas DÉJÀ chargé répond 404. `panne` : il reste levé après le rechargement.
  const etat = { deploye: false, charges: new Set(), refus: [] };
  const nc = nav.newContext.bind(nav);
  nav.newContext = async (...a) => {
    const ctx = await nc(...a);
    await ctx.route(/\/assets\//, (route) => {
      const p = new URL(route.request().url()).pathname;
      if (etat.deploye && !etat.charges.has(p)) { etat.refus.push(p); return route.fulfill({ status: 404, contentType: 'text/plain', body: 'Not Found' }); }
      etat.charges.add(p);
      return route.fallback();
    });
    // Le nouveau déploiement est en ligne dès que la page se RECHARGE (Vercel bascule
    // d'un coup) : la page relue vise alors des fichiers qui existent. En « panne »,
    // les fichiers restent introuvables même après.
    ctx.on('request', (r) => { if (!panne && etat.deploye && r.resourceType() === 'document') etat.deploye = false; });
    return ctx;
  };
  const bv = base();
  const o = await NV.ouvrir(nav, { W, sombre: false, base: bv, tab: 'journee' });
  nav.newContext = nc;
  let chargements = 0;
  o.pg.on('load', () => { chargements++; });
  await o.pg.waitForTimeout(3000);
  // La mise en ligne.
  etat.deploye = true;
  await versEmails(o.pg, tel);
  await o.pg.waitForTimeout(2500);
  await o.pg.waitForLoadState('domcontentloaded').catch(() => {});
  await o.pg.waitForSelector('.vrm-main', { timeout: 20000 }).catch(() => {});
  await o.pg.waitForTimeout(2500);
  // Après le rechargement, l'app peut être revenue ailleurs : on rouvre E-mails.
  const surEmails = await o.pg.evaluate(() => (document.querySelector('.vrm-main') || { getAttribute: () => '' }).getAttribute('data-ecran') === 'emails');
  if (!surEmails) {
    await versEmails(o.pg, tel);
    await o.pg.waitForTimeout(2500);
  }
  await o.pg.waitForTimeout(4000);   // la file des plantages part vers la base 3 s après
  const vu = await o.pg.evaluate(() => {
    const t = document.body.innerText || '';
    let file = [], compte = null;
    try { file = JSON.parse(localStorage.getItem('vrm_plantages_attente') || '[]'); } catch (_) {}
    try { compte = JSON.parse(localStorage.getItem('vrm_morceaux_perimes') || 'null'); } catch (_) {}
    const nav = document.querySelector('.vrm-mobile-nav, .vrm-sidebar');
    return { file: file.map((x) => x.message), compte, ecran: (document.querySelector('.vrm-main') || { getAttribute: () => '' }).getAttribute('data-ecran'),
      souci: /n'a pas pu s'afficher/.test(t), dernierFilet: /L'application n'a pas pu démarrer/.test(t), nav: !!(nav && nav.getBoundingClientRect().height) };
  });
  const enBase = bv.lignes.filter((l) => /^plantage_/.test(l.id)).map((l) => l.data && l.data.message);
  const morceaux = vu.file.concat(enBase).filter((m) => /preload CSS|dynamically imported module|module script failed/i.test(m || ''));
  dit(etat.refus.length > 0, `${T} (contrôle du banc) des fichiers d'avant ont bien été refusés`, JSON.stringify(etat.refus));
  dit(chargements === 1, `${T} la page s'est rechargée UNE fois (jamais une boucle)`, `${chargements} rechargement(s)`);
  dit(!morceaux.length, `${T} aucun plantage noté pour un morceau d'un ancien déploiement`, JSON.stringify(morceaux));
  dit(vu.compte && vu.compte.n >= 1 && /preload CSS|imported module/i.test(vu.compte.message || ''), `${T} le morceau est compté À PART sur l'appareil (vrm_morceaux_perimes)`, JSON.stringify(vu.compte));
  if (!panne) dit(vu.ecran === 'emails' && !vu.souci && !vu.dernierFilet, `${T} après le rechargement, E-mails s'ouvre normalement`, JSON.stringify(vu));
  else {
    dit(!vu.dernierFilet && vu.nav, `${T} panne : la coque et la navigation restent (jamais le dernier filet)`, JSON.stringify(vu));
  }
  await o.ctx.close();
}

(async () => {
  await new Promise((ok) => NV.srv.listen(PORT, ok));
  const nav = await chromium.launch({ executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const W of [1512, 390]) for (const panne of [false, true]) {
      try { await scenario(nav, { W, panne }); } catch (e) { dit(false, `[${W}px] le passage a pu aller au bout`, String(e && e.stack).slice(0, 300)); }
    }
  } catch (e) { dit(false, 'le banc a pu aller au bout', String(e && e.stack).slice(0, 300)); }
  await nav.close(); NV.srv.close();
  console.log(ko ? `\n❌ morceau-perime : ${ko} défaut(s)` : '\n✅ morceau-perime : rien à signaler');
  process.exit(ko ? 1 : 0);
})();
