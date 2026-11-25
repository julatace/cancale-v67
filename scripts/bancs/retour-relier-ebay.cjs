// ═════════════════════════════════════════════════════════════════════════════
//  BANC « RELIER eBAY, PUIS RETOUR » (24 nov., robot chaque-bouton, 2ᵉ passe, morceau F).
//  Ventes · eBay « À traiter » (`?tab=ebay_agent`, compte eBay pas relié) → « Relier eBay » → Paramètres → Comptes eBay.
//  Avant : la page poussée avait son entrée d'historique, puis la section revenait à « reglages » en empilant une entrée
//  AU-DESSUS ; le retour retombait sur la page, qui ré-empilait — on ne revenait JAMAIS à Ventes (piège).
//  Règle jugée : en trois gestes « retour » au plus, on est revenu à Ventes (la page Comptes eBay, puis Paramètres). Vues 390 tactile et 1512. Vendeur inventé (_base-volume.cjs), écritures interceptées.
//  BANC_DIST=<dist d'avant> pour la preuve « rouge avant ».
// ═════════════════════════════════════════════════════════════════════════════
const B = require('./_bt-commun.cjs');
(async () => {
  const J = B.journal('retour-relier-ebay');
  const { srv, ICI } = await B.serveur(); const nav = await B.navigateur();
  try {
    for (const vue of ['tel', 'ordi']) {
      const { pg } = await B.ouvrir(nav, vue, B.fabriquer());
      await B.demarrer(pg, ICI, 'ebay_agent');
      const ecran = () => pg.evaluate(() => document.querySelector('#vrm-contenu')?.dataset.ecran || '');
      const bouton = pg.locator('[data-vers-comptes-ebay]:visible').first();
      const vu = await bouton.count();
      J.dit(vue, '« Relier eBay » affiché sur Ventes · eBay (compte pas relié)', vu > 0, await ecran());
      if (!vu) { await pg.context().close(); continue; }
      await bouton.click(); await pg.waitForTimeout(2000);
      J.dit(vue, '« Relier eBay » mène à Paramètres', (await ecran()) === 'settings', await ecran());
      const pas = [];
      let n = 0;
      for (; n < 3 && (await ecran()) !== 'ventes'; n++) {
        await pg.evaluate(() => history.back()); await pg.waitForTimeout(1500);
        pas.push(await ecran());
      }
      J.dit(vue, 'revenu à Ventes en trois retours au plus', (await ecran()) === 'ventes', pas.join(' · '));
      await pg.context().close();
    }
  } catch (err) { J.dit('—', 'le banc a tourné jusqu’au bout', false, String(err && err.stack || err).slice(0, 300)); }
  await nav.close(); srv.close();
  process.exitCode = J.fin() ? 1 : 0;
})();
