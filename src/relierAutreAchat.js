// ════════════════════════════════════════════════════════════════════════════
//  CHOISIR UN AUTRE ACHAT · DÉPLACER · DÉLIER (11 nov. 2026, lot DJ5)
// ════════════════════════════════════════════════════════════════════════════
// Julien, mot pour mot : « Quand l'app me fait une proposition pour relier un
// achat, je ne peux pas en sélectionner un autre, je peux simplement mettre un
// prix d'achat. »
//
// Une proposition (suggestion par ressemblance, ou prix proposé par identité)
// n'est qu'une PROPOSITION (§5) : à côté d'elle, « Choisir un autre achat »
// ouvre la feuille de recherche dans SES achats. C'est SON clic sur UNE ligne
// qui relie — par le n° de transaction de CETTE ligne (`buyFromId`), jamais par
// le titre : avec 50 achats au même titre, le clic décide seul.
//
// Ce module est PUR (aucune écriture) : l'app et `scripts/audit-achats-relier.cjs`
// exécutent CES fonctions.
//   · `detenteursAchat` : qui porte déjà cet achat (fiche par N°, ou vente sans
//     fiche) — « Déjà relié à N°12 » se lit ici, par identité (`buyFromId`) ;
//   · `patchDelier` : l'écriture qui retire le lien d'UNE fiche / vente. Le prix
//     d'achat posé PAR le lien (égal au prix de l'instantané `buyFrom`) part avec
//     lui ; un prix qu'il a retapé autrement reste (§2.5 : il saisit ses prix) ;
//   · `ecrituresDeplacer` : relier ICI un achat déjà relié ailleurs = le délier de
//     ses détenteurs (un achat simple ne compte qu'une fois dans les coûts). Un LOT
//     qui n'a pas atteint son nombre n'est jamais « pris » (`achatDisponible`).

const txDe = (a) => (a && a.transaction_id != null ? String(a.transaction_id) : '');
const nombre = (v) => { if (v == null || String(v).trim() === '') return null; const n = Number(String(v).replace(/\s/g, '').replace(',', '.')); return Number.isFinite(n) ? n : null; };

// Qui porte l'achat `tx` : [{ ou: 'fiche'|'vente', cle, numero }] (fiches d'abord).
export function detenteursAchat(tx, { numeros = {}, saleOv = {} } = {}) {
  const t = String(tx == null ? '' : tx);
  if (!t) return [];
  const out = [];
  for (const [cle, e] of Object.entries(numeros || {})) if (e && e.buyFromId != null && String(e.buyFromId) === t) out.push({ ou: 'fiche', cle: String(cle), numero: String(e.numero || '').trim() });
  for (const [cle, e] of Object.entries(saleOv || {})) if (e && e.buyFromId != null && String(e.buyFromId) === t) out.push({ ou: 'vente', cle: String(cle), numero: String(e.numero || '').trim() });
  return out;
}

// « Déjà relié à N°12 » · « Déjà relié à N°12 et N°40 » · « Déjà relié à une vente ».
export function texteDejaRelie(detenteurs) {
  const l = Array.isArray(detenteurs) ? detenteurs : [];
  if (!l.length) return '';
  const nums = [...new Set(l.map((d) => d.numero).filter(Boolean))];
  if (!nums.length) return l.length > 1 ? `Déjà relié à ${l.length} ventes` : 'Déjà relié à une vente';
  const n = nums.slice(0, 3).map((x) => 'N°' + x);
  return `Déjà relié à ${n.length > 1 ? n.slice(0, -1).join(', ') + ' et ' + n[n.length - 1] : n[0]}${nums.length > 3 ? '…' : ''}`;
}

// L'écriture qui délie UNE entrée (fiche ou vente). null si elle n'est reliée à rien.
export function patchDelier(entree) {
  if (!entree || entree.buyFromId == null || String(entree.buyFromId) === '') return null;
  const pose = nombre(entree.buyFrom && entree.buyFrom.price);
  const prix = nombre(entree.buyPrice);
  const prixDuLien = prix == null || (pose != null && Math.abs(prix - pose) < 0.005);
  return { buyFromId: null, buyFrom: null, ...(prixDuLien ? { buyPrice: '' } : {}) };
}

// Relier ICI l'achat `achat` déjà porté ailleurs : les écritures qui le délient
// de ses autres détenteurs. `ici` : { ou, cle } de la cible (jamais déliée).
// Rend [{ ou, cle, numero, patch }].
export function ecrituresDeplacer(achat, { numeros = {}, saleOv = {}, ici = null } = {}) {
  const tx = txDe(achat);
  if (!tx) return [];
  const out = [];
  for (const d of detenteursAchat(tx, { numeros, saleOv })) {
    if (ici && ici.ou === d.ou && String(ici.cle) === d.cle) continue;
    const e = d.ou === 'fiche' ? numeros[d.cle] : saleOv[d.cle];
    const patch = patchDelier(e);
    if (patch) out.push({ ...d, patch });
  }
  return out;
}
