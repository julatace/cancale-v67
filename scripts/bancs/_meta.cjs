// ════════════════════════════════════════════════════════════════════════════
//  Les bancs servent des lignes `{id, data}`. Depuis le 3 octobre l'app lit les
//  petits champs dans la colonne `meta` (calculée par la base à chaque
//  écriture : `public.vrm_meta(id, data)`), pour ne plus décompresser des
//  lignes de 30 à 200 Ko pour un statut. Ce traducteur rend à chaque banc la
//  requête qu'il savait déjà servir : `meta->>k` redevient le chemin d'origine
//  dans `data`. Il suit EXACTEMENT la règle SQL (mêmes clés, même `_pdf`),
//  sinon un banc mesurerait une fiction (§6.3).
// ════════════════════════════════════════════════════════════════════════════
const TXN = new Set(['id', 'item_id', 'status', 'status_title', 'status_updated_at']);
function metaVersData(u) {
  if (!u || u.indexOf('meta') < 0) return u;
  const txn = /_txn_/.test(u);
  return u.replace(/meta(-%3E%3E|->>)([A-Za-z_]+)(=eq\.true)?/g, (m, fl, k, eqTrue) => {
    const a1 = fl === '->>' ? '->' : '-%3E';
    if (k === '_pdf') return `data${fl}pdfB64${eqTrue ? '=not.is.null' : ''}`;
    if (txn && TXN.has(k)) return `data${a1}payload${a1}transaction${fl}${k}${eqTrue || ''}`;
    if (txn && k === 'ship_status_title') return `data${a1}payload${a1}transaction${a1}shipment${fl}status_title${eqTrue || ''}`;
    return `data${fl}${k}${eqTrue || ''}`;
  });
}
module.exports = { metaVersData };
