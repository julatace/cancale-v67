// « LE BOOST EST-IL RENTABLE ? » — la règle, pure (21 octobre).
//
// Fonction retenue par Julien le 11 octobre. Un REPÈRE, jamais de la compta :
// rien de ce qui sort d'ici n'entre dans un total, un rapport ni un export.
//
// MESURÉ AVANT DE CODER (sa base, lecture seule, 21 octobre) :
//   • `promoted` (boost EN COURS, dans le dressing) : 0 `true` sur 380 annonces,
//     347 `false`, 33 sans le champ ;
//   • le champ « Boost payé » de l'écran Annonces (`vinted_annonce_numeros[id].fees`) :
//     0 fiche sur 478 ;
//   • le diagnostic de l'extension (`boost_forme`) n'a vu que `bumps`
//     (`minimum_price.has_free_bumps`) : aucun montant par article ; les
//     porte-monnaie (`invoice_lines`) ne portent aucune ligne de boost.
//   ⇒ Aujourd'hui l'écran dira « pas assez de ventes pour juger ». C'est juste.
//
// LES RÈGLES :
//   • une vente se relie à SON annonce par la transaction (`txn[tx].item`) —
//     jamais par le titre (§5). Sans annonce reliée : comptée à part ;
//   • boostée = l'annonce porte `promoted === true` OU un montant « Boost payé »
//     saisi (> 0). Non boostée = `promoted === false` ET aucun montant saisi.
//     `promoted` absent et rien de saisi = « pas su », ni d'un côté ni de l'autre ;
//   • on ne compare que des paires de MÊME TRANCHE DE PRIX : seules les tranches
//     où il y a des deux côtés comptent ;
//   • moins de SEUIL ventes d'un côté ⇒ aucune conclusion, aucun chiffre comparé ;
//     chaque mesure a en plus sa propre couverture (une mesure dont un côté a
//     moins de SEUIL valeurs connues vaut `null` = « — ») ;
//   • la marge d'une boostée exige son montant saisi (sinon le coût du boost est
//     inconnu ⇒ pas de marge) et son prix d'achat ; celle d'une non boostée, son
//     prix d'achat.
export const SEUIL_BOOST = 5;
export const TRANCHES_BOOST = [
  { k: 't0', de: 0, a: 30, lib: 'moins de 30 €' },
  { k: 't1', de: 30, a: 60, lib: '30 à 60 €' },
  { k: 't2', de: 60, a: 100, lib: '60 à 100 €' },
  { k: 't3', de: 100, a: Infinity, lib: '100 € et plus' },
];
export const trancheBoost = (eur) => {
  const n = Number(eur);
  if (!Number.isFinite(n) || n <= 0) return null;
  return TRANCHES_BOOST.find((t) => n >= t.de && n < t.a) || null;
};
// « 3,50 » · « 3.5 » · 3.5 → 3.5 ; vide, illisible, ≤ 0 → null.
export const montantBoostSaisi = (v) => {
  if (v == null || String(v).trim() === '') return null;
  const n = Number(String(v).replace(',', '.').trim());
  return Number.isFinite(n) && n > 0 ? n : null;
};
const mediane = (xs) => {
  if (!xs.length) return null;
  const s = xs.slice().sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const moyenne = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

// ventes : les ventes Vinted (o.transaction_id, o.date, o.price…)
// txn    : { [tx]: { item } } | null (null = pas su)
// items  : { [itemId]: { id, promoted, views, favourites, createdTs } } | null
// fiches : vinted_annonce_numeros ({ [itemId]: { fees, buyPrice, numero } }) | null
// injectés : estAnnulee(o), ecarte(o), montantVente(o), dateMiseEnLigne(it), prixAchat(fiche)
export function boostRentable({ ventes, txn, items, fiches, estAnnulee, ecarte, montantVente, dateMiseEnLigne, prixAchat }) {
  if (!Array.isArray(ventes) || txn == null || items == null || fiches == null) return { etat: 'passu' };
  const garde = ventes.filter((o) => o && !(estAnnulee && estAnnulee(o)) && !(ecarte && ecarte(o)));
  const R = { etat: 'lu', total: garde.length, sansAnnonce: 0, inconnues: 0, boostees: 0, avecMontant: 0, nonBoostees: 0, horsTranche: 0 };
  const lignes = [];
  for (const o of garde) {
    const tx = String(o.transaction_id || '');
    const itemId = tx && txn[tx] && txn[tx].item ? String(txn[tx].item) : '';
    const it = itemId ? items[itemId] : null;
    if (!it) { R.sansAnnonce += 1; continue; }
    const fiche = fiches[itemId] || null;
    const boost = montantBoostSaisi(fiche && fiche.fees);
    const cote = (it.promoted === true || boost != null) ? 'b' : (it.promoted === false ? 'nb' : null);
    if (!cote) { R.inconnues += 1; continue; }
    if (cote === 'b') { R.boostees += 1; if (boost != null) R.avecMontant += 1; } else R.nonBoostees += 1;
    const prix = Number(montantVente(o));
    const t = trancheBoost(prix);
    if (!t) { R.horsTranche += 1; continue; }
    const enLigne = dateMiseEnLigne ? dateMiseEnLigne(it) : null;
    const vendu = Date.parse(o.date || '');
    const delai = (enLigne != null && vendu > 0 && vendu >= enLigne) ? (vendu - enLigne) / 86400000 : null;
    const achat = prixAchat ? prixAchat(fiche) : null;
    const coutBoost = cote === 'b' ? boost : 0;
    const marge = (achat != null && coutBoost != null) ? Math.round((prix - achat - coutBoost) * 100) / 100 : null;
    lignes.push({ cote, t: t.k, delai, vues: Number.isFinite(it.views) ? it.views : null, favoris: Number.isFinite(it.favourites) ? it.favourites : null, marge });
  }
  const parT = {};
  for (const l of lignes) { const e = parT[l.t] || (parT[l.t] = { b: 0, nb: 0 }); e[l.cote] += 1; }
  R.tranches = TRANCHES_BOOST.map((t) => ({ k: t.k, lib: t.lib, b: (parT[t.k] || {}).b || 0, nb: (parT[t.k] || {}).nb || 0 })).filter((t) => t.b || t.nb);
  const communes = new Set(R.tranches.filter((t) => t.b > 0 && t.nb > 0).map((t) => t.k));
  const comp = lignes.filter((l) => communes.has(l.t));
  R.comparables = { b: comp.filter((l) => l.cote === 'b').length, nb: comp.filter((l) => l.cote === 'nb').length };
  R.assez = R.comparables.b >= SEUIL_BOOST && R.comparables.nb >= SEUIL_BOOST;
  const mesure = (champ, f) => {
    const vb = comp.filter((l) => l.cote === 'b' && l[champ] != null).map((l) => l[champ]);
    const vnb = comp.filter((l) => l.cote === 'nb' && l[champ] != null).map((l) => l[champ]);
    const ok = R.assez && vb.length >= SEUIL_BOOST && vnb.length >= SEUIL_BOOST;
    return { nb: vb.length, nnb: vnb.length, b: ok ? f(vb) : null, nonb: ok ? f(vnb) : null };
  };
  R.delai = mesure('delai', mediane);
  R.vues = mesure('vues', moyenne);
  R.favoris = mesure('favoris', moyenne);
  R.marge = mesure('marge', mediane);
  return R;
}
