// ════════════════════════════════════════════════════════════════════════════
//  LE LOT DE BORDEREAUX : QUI EST COCHABLE (4 nov., Julien, 21 h 08)
//  « je n'ai pas la possibilité de sélectionner la vente de Vestiaire Co et de
//  Leboncoin quand je veux imprimer les bordereaux ».
//  Mesuré dans le code d'avant : une vente Vestiaire n'entrait dans le lot que si
//  son bordereau était déjà rangé (`v.bordereau.id`), une vente Leboncoin que si
//  l'extension de CE navigateur savait lire le PDF (`extSait('lbcpdf') === 'ok'`)
//  ET que le lien du bordereau était lu — sur le téléphone (aucune extension)
//  jamais. Elles n'apparaissaient donc pas du tout dans la liste à cocher.
//  Règle (pure) :
//   · Vinted, Vestiaire, Leboncoin : toujours une ligne COCHABLE ; `pdf` dit si
//     le bordereau est là (cochée d'office) ou pas encore (décochée, « Sans
//     bordereau » — cochée, elle part au lot et le lot la NOMME, jamais un vide) ;
//   · eBay : une ligne GRISÉE « eBay » (l'étiquette se prend dans eBay, §2.8),
//     jamais cochable, jamais dans le PDF.
// ════════════════════════════════════════════════════════════════════════════

// `x` = un colis « autre site » de l'écran (`colisAEnvoyerRanges` : __autre vc · lbc · eb).
export function ligneLotAutre(x, i, { imprimesVc = {}, lbcPdf = false, numLbc = () => '' } = {}) {
  if (!x || !x.__autre) return null;
  if (x.__autre === 'vc') {
    const v = x.v || {};
    const pdf = !!(v.bordereau && v.bordereau.id);
    return { cle: x.key, site: 'vestiaire', v, trNom: x.trNom, rang: i, age: null, ancienne: false, imprime: imprimesVc[v.id] || null,
      pdf, cochable: true, num: v.num || '', titre: v.titre || 'Article Vestiaire', photo: v.photo || null, sous: 'Vestiaire' };
  }
  if (x.__autre === 'lbc') {
    const o = x.o || {}, lien = !!(o.label && o.label.voucherUrl);
    return { cle: x.key, site: 'leboncoin', lo: o, trNom: x.trNom, rang: i, age: null, ancienne: false, imprime: null,
      // Le lien seul ne suffit pas : le PDF Leboncoin ne se lit que par l'extension de ce navigateur.
      pdf: lien && !!lbcPdf, lien, cochable: true, num: numLbc(x) || '', titre: (x.x && x.x.titre) || o.title || '(sans titre)', photo: x.photo || null, sous: 'Leboncoin' };
  }
  if (x.__autre === 'eb') {
    const e = x.x || {};
    return { cle: x.key, site: 'ebay', trNom: x.trNom, rang: i, age: null, ancienne: false, imprime: null,
      pdf: false, cochable: false, num: x.num || '', titre: e.titre || `Commande ${e.orderId || ''}`.trim(), photo: x.photo || null, sous: 'eBay' };
  }
  return null;
}

// Cochées d'office : cochables, avec leur bordereau, ni anciennes ni déjà imprimées.
export const cochesParDefaut = (L) => new Set((L || []).filter((l) => l && l.cochable !== false && l.pdf !== false && !l.ancienne && !l.imprime).map((l) => l.cle));
// Ce qu'une sélection peut envoyer à l'impression : jamais une ligne non cochable (eBay).
export const selectionImprimable = (L, coches) => (L || []).filter((l) => l && l.cochable !== false && (!coches || coches.has(l.cle)));
// « N sans bordereau : N°12 Cabas, … » — les lignes nommées, sans phrase d'explication.
export function texteSansBordereau(lignes) {
  const L = (lignes || []).filter(Boolean);
  if (!L.length) return '';
  const nom = (l) => [l.num ? `N°${l.num}` : '', l.titre || ''].filter(Boolean).join(' ');
  return `${L.length} sans bordereau : ${L.slice(0, 4).map(nom).join(', ')}${L.length > 4 ? '…' : ''}`;
}
