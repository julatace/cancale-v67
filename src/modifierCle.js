// ── MODIFIER UNE CLÉ SANS PERDRE LE GESTE D'AVANT (16 nov., lot compta-donnees) ──
// Reste de docs/passation/2026-11-12-donnees-suite.md : `noterLienEbay` (en boucle sur les
// brouillons), `poserAchatVc`, `deposerLbc` faisaient « load → modifier → save ». Or `save`
// attend 500 ms avant d'écrire le navigateur : un 2e geste sur la même clé dans cette
// demi-seconde relisait la carte d'AVANT le 1er (`load`), et sa sauvegarde REMPLAÇAIT celle
// en attente — le 1er lien eBay, le 1er prix d'achat, la 1re coche « déposé » perdus sans
// un mot.
// LA FILE PAR CLÉ : chaque geste part de la DERNIÈRE valeur de sa clé — celle qui attend
// encore son écriture (`lire` = `chargerPublie`, App.jsx) sinon celle du navigateur — et la
// sauvegarde suivante la prolonge. `changer(copie)` rend la nouvelle valeur, ou `undefined`
// (rien à écrire). Module pur : exécuté par scripts/audit-file-par-cle.cjs.
export function fabriquerModifierCle({ lire, save }) {
  return (k, defaut, changer) => {
    let base;
    try { base = lire(k, defaut); } catch (_) { base = defaut; }
    if (base == null) base = defaut;
    const copie = base && typeof base === 'object' ? (Array.isArray(base) ? [...base] : { ...base }) : base;
    const v = changer(copie);
    if (v === undefined) return base;
    save(k, v);
    return v;
  };
}
