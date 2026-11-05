// ════════════════════════════════════════════════════════════════════════════
//  LE TIROIR D'UNE VENTE N'EXISTE QU'APRÈS SA PREMIÈRE OUVERTURE (31 oct.)
//
//  Depuis le 21 oct., chaque ligne de vente (Vinted, Leboncoin, eBay) montait
//  d'avance son tiroir de détail complet, caché : c'était l'essentiel du coût
//  d'une lettre tapée dans Ventes (banc `ventes-frappe`). Il n'est plus monté
//  qu'à la PREMIÈRE ouverture de la ligne, puis gardé. Un banc qui jugeait ce
//  que contient un tiroir fermé l'ouvre d'abord — le geste d'une personne :
//  un clic sur la ligne, l'attente de l'ÉTAT (le tiroir présent), un second
//  clic qui la referme. Jamais un délai fixe.
//
//  `monterTiroirs(pg, selLignes)` : ouvre puis referme, une par une, chaque
//  ligne qui correspond à `selLignes` (un sélecteur de LIGNE, `.vrm-sale-row…`).
//  Rend le nombre de tiroirs présents après coup.
// ════════════════════════════════════════════════════════════════════════════
async function monterTiroirs(pg, selLignes = '.vrm-sale-row[data-tx]') {
  return pg.evaluate(async (sel) => {
    const attendre = (f, ms = 4000) => new Promise((ok) => {
      const t0 = performance.now();
      const tic = () => { let v = false; try { v = f(); } catch (_) {} if (v || performance.now() - t0 > ms) ok(v); else requestAnimationFrame(tic); };
      tic();
    });
    const lignes = [...document.querySelectorAll(sel)].filter((l) => !l.closest('.vrm-ledger-drawer'));
    let n = 0;
    for (const l of lignes) {
      const t = l.querySelector(':scope > .vrm-ledger-sale-toggle') || l.querySelector('.vrm-ledger-sale-toggle');
      if (!t) continue;
      const tiroir = () => { const id = t.getAttribute('aria-controls'); return id ? document.getElementById(id) : null; };
      if (!tiroir()) {
        if (t.getAttribute('aria-expanded') !== 'true') t.click();
        await attendre(() => !!tiroir());
      }
      if (t.getAttribute('aria-expanded') === 'true') { t.click(); await attendre(() => t.getAttribute('aria-expanded') === 'false'); }
      // le retour d'historique de la feuille refermée (`FermeAuRetour`) passe avant la suivante
      await new Promise((r) => setTimeout(r, 60));
      if (tiroir()) n++;
    }
    return n;
  }, selLignes);
}
module.exports = { monterTiroirs };
