// ══════════════════════════════════════════════════════════════════════════
//  SÉLECTION MULTIPLE DANS VENTES, COLIS ET ACHATS (10 nov., lot X — proposition 35)
// ══════════════════════════════════════════════════════════════════════════
// La même forme qu'Annonces → Sélectionner : il coche des lignes, une barre en bas
// propose les gestes qui EXISTENT DÉJÀ en série — rien de neuf ne part d'ici :
//  · « Imprimer · N »  : les bordereaux prêts (la règle de « Tout imprimer »,
//    `selectionImprimable`, et SON contrôle avant impression) ;
//  · « Déposé · N »    : le geste « Colis fait » (vente + bordereau), annulable 5 s ;
//  · « Masquer · N »   : Achats seulement (les ventes ne se masquent plus, 29 oct.),
//    annulable 5 s.
// Chaque geste porte le NOMBRE de lignes qu'il touchera vraiment (« Déposé · 2 »
// quand 3 sont cochées et une seule est déjà partie) ; ce qui n'a aucun geste
// est dit (« 1 sans geste possible »), jamais pris en silence.
// L'identité d'une ligne est son n° de transaction (§5) — jamais un titre.
// Module PUR : exécuté par scripts/audit-selection-serie.cjs.

export const GESTES_PAR_ECRAN = {
  ventes: ['imprimer', 'depose'],
  colis: ['imprimer', 'depose'],
  achats: ['masquer'],
};

// `lignes` : [{ cle, imprimable, deposable, masquable }] — ce que la ligne permet
// (calculé par l'écran avec SES règles). `coches` : Set ou tableau de clés.
export function gestesSerie(ecran, lignes, coches) {
  const permis = GESTES_PAR_ECRAN[ecran] || [];
  const set = coches instanceof Set ? coches : new Set(coches || []);
  const choisies = (lignes || []).filter((l) => l && l.cle != null && set.has(String(l.cle)));
  const parGeste = {
    imprimer: choisies.filter((l) => l.imprimable).map((l) => String(l.cle)),
    depose: choisies.filter((l) => l.deposable).map((l) => String(l.cle)),
    masquer: choisies.filter((l) => l.masquable).map((l) => String(l.cle)),
  };
  const gestes = permis.map((id) => ({ id, cles: parGeste[id], n: parGeste[id].length })).filter((g) => g.n > 0);
  const avecGeste = new Set(gestes.flatMap((g) => g.cles));
  return { n: choisies.length, gestes, sansGeste: choisies.filter((l) => !avecGeste.has(String(l.cle))).length };
}

// Une case cochée qui n'est plus dans la liste (filtre changé, vente partie) ne
// compte plus : la barre ne dit que ce qu'il VOIT.
export function garderVisibles(coches, cles) {
  const vis = new Set((cles || []).map(String));
  const out = new Set();
  for (const c of coches || []) if (vis.has(String(c))) out.add(String(c));
  return out;
}

export function basculerCle(coches, cle) {
  const out = new Set(coches || []);
  const k = String(cle);
  if (out.has(k)) out.delete(k); else out.add(k);
  return out;
}
