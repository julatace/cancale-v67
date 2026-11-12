// api/_lib/prix-achat-regle.js — FABRIQUÉ par `node scripts/audit-prix-achat-regle.cjs --recopie`
// depuis src/App.jsx (le propriétaire de la règle, §11). NE RIEN MODIFIER ICI À LA MAIN :
// modifier App.jsx, puis refabriquer. `audit-prix-achat-regle.cjs` rougit si les deux divergent.
/* eslint-disable */
export const prixAchatDe = (fiche, buyByNum) => {
  const e = fiche || {};
  const num = e.numero != null ? String(e.numero).trim() : '';
  const brut = (e.buyPrice != null && String(e.buyPrice).trim() !== '') ? e.buyPrice
    : (num && buyByNum && buyByNum[num] != null ? buyByNum[num] : null);
  if (brut == null || String(brut).trim() === '') return null;
  const n = parseFloat(String(brut).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
