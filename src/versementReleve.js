// ════════════════════════════════════════════════════════════════════════════
//  LA DATE DE VERSEMENT PAR LE RELEVÉ DU PORTE-MONNAIE (6 nov., extension 5.323)
// ════════════════════════════════════════════════════════════════════════════
// Le CA déclaré est daté au jour du VERSEMENT (§5). La source de toujours est la
// transaction « Commande finalisée » (statut 450, `status_updated_at`) — mais
// 1 777 ventes (80 891 €) n'en ont pas (« à dater »). Le relevé du porte-monnaie
// (`harvest_{uid}_releve_{mois}`, rangé par l'extension 5.323, `lignes[]`) date
// chaque mouvement crédité.
// ⚠️ UNE VENTE N'EST DATÉE PAR LE RELEVÉ QUE PAR SON IDENTITÉ (§5) : une ligne
//    qui PORTE son n° de transaction (`tx`, posé par l'extension seulement quand
//    la ligne a une clé `transaction_id`, ou une nature « transaction » et son
//    identifiant). JAMAIS par un montant ou une date qui se ressemblent : deux
//    ventes au même prix le même jour sont courantes, un faux mois de CA ne se
//    voit pas. La forme réelle d'une ligne de VENTE n'a pas encore été mesurée :
//    tant qu'aucune ligne ne porte `tx`, ce module ne date RIEN.
// ⚠️ Seulement un CRÉDIT (montant > 0), pas « en attente » (l'argent n'est pas
//    encore là), daté, en euros quand la devise est dite (une autre devise est
//    écartée, jamais convertie — §3 International), et pas un virement vers SA
//    banque (`quoi: 'payout'`, un déplacement entre ses comptes).
// ⚠️ « Une date lue gagne toujours » — et la transaction 450 reste la règle :
//    le relevé ne fait que COMPLÉTER une vente qu'elle ne date pas. Deux lignes
//    de relevé pour la même vente avec deux jours différents ⇒ « pas su » pour
//    elle (aucune date plutôt qu'un choix au hasard).

const ISO = /^\d{4}-\d{2}-\d{2}/;

// rows : [{ id, l: lignes[] }] (projection `select=id,l:data->lignes`) · `null` = pas su.
// Rend tx → date ISO (`null` si `rows` est `null`).
export function versementsDuReleve(rows) {
  if (!Array.isArray(rows)) return null;
  const vus = new Map();          // tx → Set(jours)
  const dates = new Map();        // tx → date ISO (la première vue)
  for (const r of rows) {
    const lignes = r && Array.isArray(r.l) ? r.l : [];
    for (const x of lignes) {
      if (!x || typeof x !== 'object') continue;
      const tx = x.tx == null ? '' : String(x.tx);
      if (!/^\d{3,20}$/.test(tx)) continue;                       // pas d'identité : rien
      const m = Number(x.montant);
      if (!(isFinite(m) && m > 0)) continue;                        // un crédit seulement
      if (x.attente === true) continue;                             // pas encore versé
      if (x.quoi === 'payout') continue;                            // virement vers SA banque
      if (x.devise && x.devise !== 'EUR') continue;                 // jamais convertie
      const d = String(x.date || '');
      if (!ISO.test(d) || isNaN(Date.parse(d))) continue;
      if (!vus.has(tx)) { vus.set(tx, new Set()); dates.set(tx, d); }
      vus.get(tx).add(d.slice(0, 10));
    }
  }
  const out = {};
  for (const [tx, jours] of vus) if (jours.size === 1) out[tx] = dates.get(tx);   // deux jours ⇒ pas su
  return out;
}

// La transaction 450 d'abord (règle de toujours) ; le relevé complète. `null` reste `null`.
export function completerVersementsParReleve(map450, mapReleve) {
  if (map450 == null) return map450;
  if (!mapReleve) return map450;
  const out = Object.assign({}, map450);
  const parReleve = new Set();
  for (const [tx, d] of Object.entries(mapReleve)) if (out[tx] == null) { out[tx] = d; parReleve.add(tx); }
  // (11 nov., lot DJ7) Lesquelles le relevé a datées : propriété NON énumérable
  // (les lecteurs de la carte tx → date n'en voient rien), lue par `versementsParReleve`.
  Object.defineProperty(out, PAR_RELEVE, { value: parReleve, enumerable: false });
  return out;
}

const PAR_RELEVE = '__vrmParReleve';
// Les n° de transaction datés par le relevé (et non par la transaction 450). Toujours un Set.
export function versementsParReleve(map) {
  const s = map && map[PAR_RELEVE];
  return s instanceof Set ? s : new Set();
}
