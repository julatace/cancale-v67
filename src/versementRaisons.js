// ════════════════════════════════════════════════════════════════════════════
//  POURQUOI CES VENTES N'ONT PAS DE DATE DE VERSEMENT ? (11 nov., lot DJ7)
// ════════════════════════════════════════════════════════════════════════════
// Julien : « Compta : 1756 ventes sans date de versement ». Le CA déclaré est
// daté au jour du VERSEMENT (§5) ; une vente sans date n'est dans aucun mois.
// Ce module ne DATE rien : il range les ventes « à dater » de `ventesDeclarables`
// par RAISON (ce qui manque, prouvé par ce que la base contient), et compte les
// ventes datées, dont celles datées par le relevé du porte-monnaie (par leur
// n° de transaction seulement, src/versementReleve.js).
// MESURÉ le 11 nov. (lecture seule) : 1 751 des ventes sans date sont d'un seul
// compte, dont le détail de transaction n'a JAMAIS été relu (51 relus sur
// 1 789 finalisées) ; aucun relevé de porte-monnaie rangé ne porte de vente.
// ⇒ La raison est « détail pas encore relu », le geste « ouvre Vinted sur ce
//   compte » (l'extension relit le détail, `capterDatesVersement`).
// Règle PURE : l'écran Ventes la publie (`vinted_urssaf_mois.aDater.raisons`,
// `.datees`), « Déclarer » la lit (§11 : un propriétaire, les autres lisent).

// Les raisons, de la plus utile à la moins utile. `geste` : ce que l'écran propose.
export const RAISONS_A_DATER = {
  'vinted-detail': { geste: 'vinted' },          // détail de la transaction jamais relu
  'vinted-attente': { geste: null },             // relu : Vinted ne la dit pas (encore) finalisée
  'vinted-passu': { geste: null },               // les états des transactions n'ont pas été lus
  leboncoin: { geste: 'main' },                  // Leboncoin : la date se recopie à la main
  vestiaire: { geste: 'vestiaire' },
  ebay: { geste: null },
  importee: { geste: 'importer' },              // (11 nov.) importée sans date de versement dans son fichier
};

const r2 = (x) => Math.round(x * 100) / 100;
const txDe = (o) => (o && o.transaction_id != null ? String(o.transaction_id) : (o && o.id != null ? String(o.id) : ''));

// aDater : lignes « à dater » de `ventesDeclarables` (Vinted porte `o`).
// etat(tx) : `undefined` = pas su · `null` = aucune transaction rangée · `{ s }` = état lu.
// compteDe(o) : { uid, nom } du compte de la vente (ou null).
export function raisonsADater(aDater, { etat, compteDe } = {}) {
  const par = new Map();
  const ajoute = (cle, l, compte) => {
    const q = par.get(cle) || { cle, n: 0, ca: 0, comptes: [] };
    q.n += 1; q.ca += Number(l.eur) || 0;
    if (compte && compte.uid) {
      let c = q.comptes.find((x) => x.uid === compte.uid);
      if (!c) { c = { uid: compte.uid, nom: compte.nom || '', n: 0 }; q.comptes.push(c); }
      c.n += 1;
    }
    par.set(cle, q);
  };
  for (const l of (aDater || [])) {
    if (!l || !Number.isFinite(Number(l.eur))) continue;
    if (l.importee) ajoute('importee', l);
    else if (l.plateforme === 'Vinted') {
      const tx = txDe(l.o);
      const e = typeof etat === 'function' && tx ? etat(tx) : undefined;
      const compte = typeof compteDe === 'function' ? compteDe(l.o) : null;
      if (e === undefined) ajoute('vinted-passu', l, compte);
      else if (e === null) ajoute('vinted-detail', l, compte);
      else ajoute('vinted-attente', l, compte);
    } else if (l.plateforme === 'Leboncoin') ajoute('leboncoin', l);
    else if (l.plateforme === 'Vestiaire') ajoute('vestiaire', l);
    else ajoute('ebay', l);
  }
  const ordre = Object.keys(RAISONS_A_DATER);
  return [...par.values()]
    .map((q) => ({ ...q, ca: r2(q.ca), comptes: q.comptes.sort((a, b) => b.n - a.n) }))
    .sort((a, b) => ordre.indexOf(a.cle) - ordre.indexOf(b.cle));
}

// Les ventes DATÉES (une date de versement lue) : combien, et combien par le relevé.
// parReleve : Set des n° de transaction datés par le relevé (`versementsParReleve`).
export function venteDatees(lignes, parReleve) {
  let n = 0, releve = 0;
  for (const l of (lignes || [])) {
    if (!l || !l.ts) continue;                 // déclarée sans date : pas « datée »
    n += 1;
    if (l.plateforme === 'Vinted' && parReleve && parReleve.has(txDe(l.o))) releve += 1;
  }
  return { n, releve };
}
