// ── REMETTRE EN VENTE UNE INACTIVE eBAY : QUAND VRM LE PROPOSE (3 novembre) ──
// Une annonce eBay terminée SANS vente (`ebay_inactives`) peut être remise en
// vente depuis VRM, sur SON clic, confirmé (route `relancer`, règle serveur
// `api/_lib/ebay-relance.js`). L'écran ne la PROPOSE que si tout est su :
//   · la paire a une IDENTITÉ (N° lu dans le SKU `VRM-{n°}`) — sans elle, VRM ne
//     sait pas quelle chaussure il remettrait en vente (§5) ;
//   · elle n'est vendue NULLE PART (verdict `numerosDejaVendus`, par N°), et ce
//     verdict est LU (ventes illisibles ou en cours de lecture ⇒ pas proposé) ;
//   · elle est toujours chez lui : pas déclarée partie (`vinted_pairs_lost`, clé
//     au N° nu ou `N°@annonce` — dans le doute, pas proposé) ;
//   · pas retirée par VRM parce que vendue ailleurs, pas déjà de retour sur
//     eBay (autre annonce, `RelistedItemID`, même annonce vue en ligne) ;
//   · une capture du jour (pas « ancienne »).
// Fonction PURE (l'audit `audit-ebay-relance.cjs` l'exécute).
const cle = (v) => {
  const s = String(v == null ? '' : v).toUpperCase().replace(/\s+/g, '');
  const m = /^([A-Z]{0,3})0*(\d+)$/.exec(s);
  return m ? m[1] + String(Number(m[2])) : s;
};
// Le N° est-il déclaré parti du stock ? `perdues` = `vinted_pairs_lost`
// (`{ "12": {...}, "12@987": {...} }`). Illisible ⇒ `null` (pas su).
export function numeroSorti(n, perdues) {
  if (!n) return false;
  if (perdues == null || typeof perdues !== 'object' || Array.isArray(perdues)) return null;
  const voulu = cle(n);
  return Object.keys(perdues).some((k) => cle(String(k).split('@')[0]) === voulu && perdues[k] != null);
}
// Rend `{ propose: true }` ou `{ propose: false, pourquoi }` (un mot, pour `data-*`).
export function relanceProposable(x) {
  const o = x || {};
  if (o.ancienne) return { propose: false, pourquoi: 'ancienne' };
  if (!o.n) return { propose: false, pourquoi: 'sans-identite' };
  if (o.vendue) return { propose: false, pourquoi: 'vendue' };
  if (o.retraitAuto) return { propose: false, pourquoi: 'retiree-par-vrm' };
  if (o.verifManque) return { propose: false, pourquoi: 'ventes-pas-sues' };
  if (o.sortie === null) return { propose: false, pourquoi: 'stock-pas-su' };
  if (o.sortie) return { propose: false, pourquoi: 'sortie' };
  if (o.memeEnLigne || o.relancee || o.deja) return { propose: false, pourquoi: 'deja' };
  const p = Number(String(o.prix == null ? '' : o.prix).replace(',', '.'));
  if (!(Number.isFinite(p) && p > 0)) return { propose: false, pourquoi: 'prix' };
  return { propose: true };
}
