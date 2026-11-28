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
    // (28 nov., ebay-livraison) L'étiquette PRÉPAYÉE PAR L'ACHETEUR reçue par e-mail (`email_bordebay_{n° de commande}`,
    // `x.etiquette`) part avec les bordereaux Vinted ; sans elle, la ligne reste grisée (l'étiquette se prend dans eBay).
    // VRM n'achète jamais d'étiquette (§2.8).
    const pdf = !!x.etiquette;
    return { cle: x.key, site: 'ebay', orderId: String(e.orderId || ''), trNom: x.trNom, rang: i, age: null, ancienne: false, imprime: null,
      pdf, cochable: pdf, num: x.num || '', titre: e.titre || `Commande ${e.orderId || ''}`.trim(), photo: x.photo || null, sous: 'eBay' };
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

// ── (12 nov.) UNE SEULE SOURCE POUR LE BOUTON ET LA FEUILLE ─────────────────
// Julien : « Tout imprimer (15) » ouvrait « Imprimer (6) » sans dire pourquoi. Le
// bouton comptait TOUTES les lignes du lot ; la feuille n'imprime que les cochées.
// `resumeLot(L)` : ce qui part (cochées d'office) — le nombre du bouton ; avec
// `coches` (la feuille), ce qui part de SA sélection. Les autres lignes, NOMMÉES
// par leur raison (la première qui vaut, dans cet ordre) : eBay (étiquette dans
// eBay), sans bordereau, déjà imprimé, vendue il y a longtemps, décochée par lui.
export function resumeLot(L, coches) {
  const lignes = (L || []).filter(Boolean);
  const c = coches || cochesParDefaut(lignes);
  const r = { total: lignes.length, partent: 0, ebay: 0, sansBordereau: 0, dejaImprimes: 0, anciennes: 0, decoches: 0, exclus: [] };
  // (17 nov., chasse-bugs) Chaque ligne qui ne part pas, NOMMÉE avec sa raison (« N°193 attend son bordereau ») :
  // Julien ne savait pas quels étaient « 2 colis n'y sont pas ».
  const exclu = (l, raison) => r.exclus.push({ cle: l.cle, num: l.num ? String(l.num) : '', titre: l.titre || '', raison });
  for (const l of lignes) {
    if (l.cochable === false) { r.ebay++; exclu(l, 'ebay'); continue; }
    if (c.has(l.cle)) { r.partent++; continue; }
    if (l.pdf === false) { r.sansBordereau++; exclu(l, 'sansBordereau'); }
    else if (l.imprime || l.depotAVerifier) { r.dejaImprimes++; exclu(l, 'dejaImprime'); }
    else if (l.ancienne) { r.anciennes++; exclu(l, 'ancienne'); }
    else { r.decoches++; exclu(l, 'decoche'); }   // décochée par lui
  }
  r.autres = r.total - r.partent;
  return r;
}

// ── (17 nov., chasse-bugs — Julien : « regarde ici il y a 4 bordereaux de sélectionné ») ─────────────
// Le bouton disait « Imprimer les 3 bordereaux » à côté d'une pastille « + 1 retour » alors que QUATRE cases
// étaient cochées et que les quatre partaient dans le même PDF (`imprimerLot(choix, { retours })`). UNE règle :
// le nombre du bouton = les ventes cochées imprimables + les retours cochés imprimables, le mot « retour » dit
// à côté (« Imprimer les 4 bordereaux · dont 1 retour »), jamais un second nombre à additionner de tête.
export const nombreAImprimer = (nVentes, nRetours) => (Number(nVentes) || 0) + (Number(nRetours) || 0);
export function libelleImprimer(t, cle, nVentes, nRetours, vars = {}) {
  const n = nombreAImprimer(nVentes, nRetours), nR = Number(nRetours) || 0;
  const base = t(cle, { ...vars, n });
  return nR > 0 ? `${base} · ${t('impr.retour.dont', { n: nR })}` : base;
}
// « N°193 attend son bordereau · N°88 : étiquette dans eBay · + 2 autres » — au plus deux nommées.
export function texteExclus(t, exclus, max = 2) {
  const X = (exclus || []).filter(Boolean);
  if (!X.length) return '';
  const nom = (x) => (x.num ? `N°${x.num}` : String(x.titre || '').slice(0, 28) || t('impr.exclu.sansNom'));
  const parts = X.slice(0, max).map((x) => t(`impr.exclu.${x.raison}`, { nom: nom(x) }));
  if (X.length > max) parts.push(t('impr.exclu.plus', { n: X.length - max }));
  return parts.join(' · ');
}
