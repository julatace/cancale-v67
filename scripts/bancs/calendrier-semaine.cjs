// ════════════════════════════════════════════════════════════════════════════
//  BANC — LES 7 PROCHAINS JOURS DES COLIS (23 nov., lot calendrier-semaine). Données INVENTÉES (dépôt public).
//  La VRAIE feuille montée seule (outils/calendrier-semaine), 390 tactile et 1512, clair et sombre :
//   K1 sept jours de Paris, du jour même (« Aujourd’hui », « Demain », puis le nom du jour) ;
//   K2 chaque colis à SON jour (data-cal-jour) ; l'estimée porte « estimée » (data-cal-estimee=1), jamais en retard ;
//   K3 « En retard » (lue dépassée) et « Estimation passée » à part ; « Plus tard » ; « Sans date » + eBay compté ;
//   K4 rien de perdu : 7 envois + 4 retraits publiés = 11 rangées de colis ;
//   K5 toucher un envoi ouvre la fiche de SON N° ; sans N°, Colis ; un retrait ⇒ « À retirer » ;
//   K6 « pas su » (?base=passu) : « pas encore lus », jamais une semaine vide ; rien ne déborde, ni NaN, cibles ≥ 44.
//  Doit être ROUGE sur le code d'avant (la feuille n'existe pas).
//  Lancer : node scripts/bancs/calendrier-semaine.cjs  (SHOTS=dossier pour les captures, à REGARDER)
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path');
const { lancer, REGLES_PAGE } = require('./_harnais-lots.cjs');
lancer({ lot: 'calendrier-semaine', url: '/?base=lu', parcours: async (pg, { W, th, SHOTS, dit }) => {
  await pg.waitForSelector('[data-cal-feuille]', { timeout: 15000 }); await pg.waitForTimeout(500);
  const a = await pg.evaluate(() => {
    const g = [...document.querySelectorAll('[data-cal-groupe]')].map((x) => ({ g: x.getAttribute('data-cal-groupe'), d: x.getAttribute('data-cal-date') || '', n: x.getAttribute('data-cal-n'),
      titre: (x.querySelector('h3, h2') || {}).textContent || '', colis: [...x.querySelectorAll('[data-cal-sorte]')].map((r) => ({ s: r.getAttribute('data-cal-sorte'), j: r.getAttribute('data-cal-jour'), e: r.getAttribute('data-cal-estimee'), num: r.getAttribute('data-cal-num'), t: r.innerText })) }));
    return { g, auj: window.__AUJ, autres: [...document.querySelectorAll('[data-cal-autre]')].map((x) => x.getAttribute('data-cal-autre') + ':' + x.getAttribute('data-cal-n')) };
  });
  const jours = a.g.filter((x) => x.g === 'jour');
  dit(jours.length === 7 && jours[0].d === a.auj && /Aujourd/.test(jours[0].titre) && /Demain/.test(jours[1].titre), `K1 ${W} ${th} : sept jours de Paris, du jour même`, jours.map((x) => x.d + ' ' + x.titre));
  const mal = jours.flatMap((x) => x.colis.filter((c) => c.j !== x.d));
  dit(!mal.length, `K2 ${W} ${th} : chaque colis à SON jour`, mal);
  const est = jours[0].colis.find((c) => c.num === '13');
  dit(est && est.e === '1' && /estimée/.test(est.t), `K2b ${W} ${th} : la date estimée est dite « estimée »`, est);
  const G = (k) => a.g.find((x) => x.g === k) || { colis: [] };
  dit(G('retard').colis.map((c) => c.num).join() === '15' && G('estimation-passee').colis.map((c) => c.num).join() === '16', `K3 ${W} ${th} : « En retard » (lue) et « Estimation passée » à part`, [G('retard').colis, G('estimation-passee').colis]);
  dit(G('plus-tard').colis.some((c) => c.num === 'B230') && G('sans-date').colis.length === 1 && a.autres.join() === 'ebay:2', `K3b ${W} ${th} : « Plus tard », « Sans date » (Colissimo) et les 2 eBay comptés`, [G('plus-tard'), G('sans-date'), a.autres]);
  const n = a.g.reduce((t, x) => t + x.colis.length, 0);
  dit(n === 11, `K4 ${W} ${th} : rien de perdu (11 colis publiés, 11 rangées)`, n);
  const r = await pg.evaluate(REGLES_PAGE, '[data-cal-feuille] .n-rangee');
  dit(!r.deborde && !r.nan && r.petites === 0, `K6 ${W} ${th} : rien ne déborde, aucun NaN, cibles ≥ 44`, r);
  await pg.screenshot({ path: path.join(SHOTS, `calendrier-${W}-${th}.png`), fullPage: false });
  await pg.locator('[data-cal-feuille]').first().screenshot({ path: path.join(SHOTS, `calendrier-feuille-${W}-${th}.png`) }).catch(() => {});
  await pg.locator('[data-cal-num="12"]').first().click();
  await pg.waitForTimeout(400);
  const f = await pg.evaluate(() => window.__FICHE.slice());
  dit(f.join() === '12', `K5 ${W} ${th} : toucher l’envoi ouvre la fiche de SON N°`, f);
  await pg.locator('[data-cal-ouvrir]').click(); await pg.waitForSelector('[data-cal-feuille]'); await pg.waitForTimeout(400);
  await pg.locator('[data-cal-sorte="envoi"][data-cal-num=""]').first().click(); await pg.waitForTimeout(400);
  dit(await pg.evaluate(() => window.__NAV === 'cat_bord'), `K5b ${W} ${th} : sans N°, Colis`);
  await pg.locator('[data-cal-ouvrir]').click(); await pg.waitForSelector('[data-cal-feuille]'); await pg.waitForTimeout(400);
  await pg.locator('[data-cal-sorte="retrait"]').first().click(); await pg.waitForTimeout(400);
  dit(await pg.evaluate(() => window.__NAV === 'retraits'), `K5c ${W} ${th} : un retrait ⇒ « À retirer »`);
  await pg.goto(pg.url().replace('base=lu', 'base=passu')); await pg.waitForSelector('[data-cal-feuille]'); await pg.waitForTimeout(300);
  const p = await pg.evaluate(() => (document.querySelector('[data-cal-passu]') || { getAttribute: () => '' }).getAttribute('data-cal-passu'));
  dit(p === 'envois,retraits', `K6b ${W} ${th} : pas su ⇒ « pas encore lus » (envois et retraits)`, p);
} });
