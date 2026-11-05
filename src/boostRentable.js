// « LE BOOST EST-IL RENTABLE ? » — la règle, pure (21 octobre ; refaite le
// 3 novembre, choisie par Julien parmi trois améliorations).
//
// Un REPÈRE, jamais de la compta : rien de ce qui sort d'ici n'entre dans un
// total, un rapport ni un export.
//
// MESURÉ AVANT DE CODER (sa base, lecture seule) :
//   • 21 oct. : `promoted` (boost EN COURS, dans le dressing) : 0 `true` sur 380
//     annonces ; aucun montant par article chez Vinted ni dans les porte-monnaie ;
//   • 3 nov. : le « Boost payé » saisi dans la fiche (`vinted_annonce_numeros
//     [id].fees`) : 0 fiche sur 1 005 (trois comptes VRM).
//   ⇒ Aujourd'hui la carte dit « pas assez de données ». C'est juste.
//
// LA QUESTION (3 nov.) : les articles boostés se vendent-ils plus, plus vite,
// plus cher — boost déduit — que les articles NON boostés du MÊME modèle sûr,
// mis en ligne sur la MÊME période ?
//
// LES RÈGLES :
//   • la population : les ANNONCES (vendues ou non) mises en ligne dans la
//     période [de, a[ — une annonce sans date de mise en ligne est comptée à
//     part (`sansDate`) ;
//   • boostée = un « Boost payé » saisi (> 0) OU `promoted === true` (Vinted le
//     dit pendant le boost) ; non boostée = `promoted === false` ET aucun
//     montant ; `promoted` absent et rien de saisi = « pas su », ni d'un côté ni
//     de l'autre (`inconnues`) ;
//   • le modèle : `modeleDe(annonce)` (injecté : `modeleSur` de
//     src/ceQuiRapporte.js — marque + modèle SÛRS, jamais une identité) ; sans
//     modèle sûr ⇒ comptée à part (`sansModele`) ;
//   • on ne compare QUE les modèles qui ont des deux côtés ;
//   • vendue = une vente (non annulée, compte non écarté) reliée à SON annonce
//     par la transaction (`txn[tx].item`) — jamais par le titre (§5) ;
//   • moins de SEUIL_BOOST boostées comparables ⇒ AUCUNE conclusion, aucun
//     chiffre comparé (`assez: false`) ;
//   • « vendues » : part des annonces vendues ; « délai » : médiane mise en
//     ligne → vente des vendues ; « prix » : médiane du prix de vente, BOOST
//     DÉDUIT pour une boostée (sans montant saisi, son coût est inconnu : elle
//     ne compte pas dans ce prix, la couverture le dit) ; une mesure sans
//     aucune valeur d'un côté vaut `null` (« — ») ;
//   • le coût : la somme des boosts SAISIS des boostées comparables, avec sa
//     couverture (`avecMontant` sur `comparables.b`).
export const SEUIL_BOOST = 3;
const J = 86400000;
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
const c2 = (v) => Math.round(v * 100) / 100;

// annonces : { [itemId]: { id, brand, title, promoted, createdTs } } | null (null = pas su)
// ventes   : les ventes Vinted (o.transaction_id, o.date, o.price…) | null
// txn      : { [tx]: { item } } | null
// fiches   : vinted_annonce_numeros ({ [itemId]: { fees } }) | null
// de, a    : la période (ms), [de, a[
// injectés : modeleDe(it) → { cle, nom } | null, dateMiseEnLigne(it) → ms | null,
//            estAnnulee(o), ecarte(o), montantVente(o)
export function boostRentable({ annonces, ventes, txn, fiches, de, a, modeleDe, dateMiseEnLigne, estAnnulee, ecarte, montantVente }) {
  if (annonces == null || !Array.isArray(ventes) || txn == null || fiches == null) return { etat: 'passu' };
  // La vente de chaque annonce, par SA transaction.
  const venteDe = new Map();
  for (const o of ventes) {
    if (!o || (estAnnulee && estAnnulee(o)) || (ecarte && ecarte(o))) continue;
    const tx = String(o.transaction_id || '');
    const item = tx && txn[tx] && txn[tx].item ? String(txn[tx].item) : '';
    if (!item) continue;
    const t = Date.parse(o.date || '');
    const prev = venteDe.get(item);
    if (!prev || (t > 0 && t < prev.t)) venteDe.set(item, { t: t > 0 ? t : null, prix: Number(montantVente(o)) });
  }
  const R = { etat: 'lu', total: 0, sansDate: 0, inconnues: 0, sansModele: 0, boostees: 0, nonBoostees: 0 };
  const lignes = [];
  for (const id of Object.keys(annonces)) {
    const it = annonces[id];
    if (!it) continue;
    const enLigne = dateMiseEnLigne ? dateMiseEnLigne(it) : null;
    if (enLigne == null) { R.sansDate += 1; continue; }
    if (!(enLigne >= de && enLigne < a)) continue;
    R.total += 1;
    const boost = montantBoostSaisi(fiches[String(id)] && fiches[String(id)].fees);
    const cote = (boost != null || it.promoted === true) ? 'b' : (it.promoted === false ? 'nb' : null);
    if (!cote) { R.inconnues += 1; continue; }
    if (cote === 'b') R.boostees += 1; else R.nonBoostees += 1;
    const m = modeleDe ? modeleDe(it) : null;
    if (!m || !m.cle) { R.sansModele += 1; continue; }
    const v = venteDe.get(String(id)) || null;
    const delai = v && v.t != null && v.t >= enLigne ? (v.t - enLigne) / J : null;
    const prix = v && Number.isFinite(v.prix) && v.prix > 0 ? v.prix : null;
    lignes.push({ cote, modele: m.cle, nom: m.nom, vendu: !!v, delai, prix, boost: cote === 'b' ? boost : 0 });
  }
  const cotes = new Map();
  for (const l of lignes) { const e = cotes.get(l.modele) || { b: 0, nb: 0, nom: l.nom }; e[l.cote] += 1; cotes.set(l.modele, e); }
  const communs = new Set([...cotes].filter(([, e]) => e.b > 0 && e.nb > 0).map(([k]) => k));
  const comp = lignes.filter((l) => communs.has(l.modele));
  const B = comp.filter((l) => l.cote === 'b'), N = comp.filter((l) => l.cote === 'nb');
  R.comparables = { b: B.length, nb: N.length };
  R.modeles = [...communs].map((k) => cotes.get(k).nom).sort();
  R.assez = B.length >= SEUIL_BOOST;
  const avecMontant = B.filter((l) => l.boost != null && l.boost > 0);
  R.avecMontant = avecMontant.length;
  R.cout = avecMontant.length ? c2(avecMontant.reduce((s, l) => s + l.boost, 0)) : null;
  if (!R.assez) { R.vendues = R.delai = R.prix = null; return R; }
  const vb = B.filter((l) => l.vendu), vn = N.filter((l) => l.vendu);
  R.vendues = { b: vb.length, nb: vn.length, nB: B.length, nN: N.length, tb: vb.length / B.length, tnb: vn.length / N.length };
  const db = vb.map((l) => l.delai).filter((x) => x != null), dn = vn.map((l) => l.delai).filter((x) => x != null);
  R.delai = { b: mediane(db), nb: mediane(dn), nb_b: db.length, nb_nb: dn.length };
  // Le prix de vente d'une boostée, BOOST DÉDUIT : il faut son montant saisi.
  const pb = vb.filter((l) => l.prix != null && l.boost != null).map((l) => c2(l.prix - l.boost));
  const pn = vn.map((l) => l.prix).filter((x) => x != null);
  R.prix = { b: mediane(pb), nb: mediane(pn), nb_b: pb.length, nb_nb: pn.length, sansMontant: vb.filter((l) => l.prix != null && l.boost == null).length };
  return R;
}
