// ════════════════════════════════════════════════════════════════════════════
//  « L'ÉCRAN EST PRÊT » — une attente sur un ÉTAT, jamais un délai fixe (§6.5)
//  (11 nov., lot webkit-fiable) Les bancs attendaient 2,8 s après chaque écran :
//  trop court sur une machine chargée ou sous WebKit (faux rouges), trop long
//  partout ailleurs (nouveau-vendeur dépassait 20 min sous WebKit en CI).
//  `ecranPret(pg, tab)` attend : <main data-ecran=tab> monté, la barre du téléphone
//  sans calcul en cours, aucun squelette de chargement (6 s au plus),
//  puis le DOM CALME (aucune mutation pendant `calme` ms). Borné (`max`) : au-delà
//  on rend la main et ce sont les contrôles du banc qui disent ce qui manque.
//  Rend { pret, ms } (pret=false ⇒ la borne a été atteinte).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
async function ecranPret(pg, tab, { calme = 600, max = 15000 } = {}) {
  const t0 = Date.now();
  try {
    await pg.waitForFunction((tab) => {
      const m = document.querySelector('.vrm-main');
      if (!m || (tab && m.getAttribute('data-ecran') !== tab)) return false;
      if (document.querySelector('.vrm-tabbar[data-en-cours]')) return false;
      return true;
    }, tab || '', { timeout: max });
    // Le morceau de l'écran chargé à la demande (repli Suspense : squelette `.vrm-skeleton`,
    // `data-morceau-attente`). Un squelette qui RESTE (données jamais arrivées) n'arrête pas le
    // banc plus de 6 s : ses contrôles le diront.
    await pg.waitForFunction(() => !document.querySelector('.vrm-main .vrm-skeleton, [data-morceau-attente]'), null, { timeout: Math.min(6000, Math.max(500, max - (Date.now() - t0))) }).catch(() => {});
    const reste = Math.max(1000, max - (Date.now() - t0));
    const pret = await pg.evaluate(([calme, reste]) => new Promise((ok) => {
      let minuteur = null; const fin = setTimeout(() => { obs.disconnect(); clearTimeout(minuteur); ok(false); }, reste);
      const relancer = () => { clearTimeout(minuteur); minuteur = setTimeout(() => { obs.disconnect(); clearTimeout(fin); ok(true); }, calme); };
      const obs = new MutationObserver(relancer);
      obs.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
      relancer();
    }), [calme, reste]);
    return { pret, ms: Date.now() - t0 };
  } catch (_) { return { pret: false, ms: Date.now() - t0 }; }
}
module.exports = { ecranPret };
