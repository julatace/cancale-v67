// ════════════════════════════════════════════════════════════════════════════
//  LE LIEN « annonce eBay ↔ article » POSÉ À LA PUBLICATION (19 nov. 2026)
//
//  Julien : « ça aurait dû se relier tout seul » — ses annonces eBay publiées depuis VRM.
//  Mesuré (lecture seule, 19 nov.) : sur 4 annonces eBay en ligne, AUCUN lien « publication » ;
//  la publication ne pose le lien que si l'écran connaît l'identifiant de la paire (`pairId`),
//  or l'annonce construite (`itemDeBrouillon`) ne le porte pas et l'écran peut l'avoir perdu
//  (brouillon rouvert sans paire) : le SKU `VRM-{n°}` partait, le lien jamais.
//
//  La règle (pure, exécutée par `scripts/audit-ebay-lien-publication.cjs`) : après une
//  publication ACCEPTÉE par eBay (un identifiant d'annonce rendu), le lien est posé
//    · sur la paire choisie, si l'écran la connaît ;
//    · sinon sur LA fiche qui porte le N° envoyé comme SKU — une seule ; aucune ou plusieurs ⇒
//      rien (« mieux vaut un blanc qu'un faux », §5 ; la liaison guidée la proposera).
//  Jamais par le titre.
// ════════════════════════════════════════════════════════════════════════════
const cleDefaut = (v) => String(v == null ? '' : v).trim().toUpperCase().replace(/\s+/g, '').replace(/^0+(?=\d)/, '');
const ID_EBAY = /^\d{9,15}$/;

export function lienApresPublication({ itemId, pairId = null, numero = '', fiches = {}, cle = cleDefaut } = {}) {
  const id = String(itemId == null ? '' : itemId);
  if (!ID_EBAY.test(id)) return null;
  const n = cle(numero || '');
  if (pairId != null && String(pairId).trim()) return { itemId: id, pairId: String(pairId), numero: n || null };
  if (!n || !fiches || typeof fiches !== 'object') return null;
  const ids = Object.keys(fiches).filter((k) => fiches[k] && cle(fiches[k].numero || '') === n);
  return ids.length === 1 ? { itemId: id, pairId: ids[0], numero: n } : null;
}
