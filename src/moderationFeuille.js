// ── src/moderationFeuille.js — quels comptes la feuille « annonces disparues » d'Aujourd'hui explique déjà (23 nov.) ──
// Julien : « une explication, pas deux ». Quand la feuille des annonces disparues d'un compte (src/AlerteModeration.jsx) est
// à l'écran, le bandeau « Vinted a modéré ce compte · Reprendre » (src/Discretion.jsx) de CE compte se range dedans.
// Mémoire de la page seulement (aucune donnée, aucune écriture).
import React from 'react';
let comptes = new Set();
const ecoutes = new Set();
export function poserComptesFeuille(liste) {
  const n = new Set((liste || []).map(String));
  if (n.size === comptes.size && [...n].every((u) => comptes.has(u))) return;
  comptes = n; ecoutes.forEach((f) => { try { f(); } catch (_) {} });
}
export const compteDansFeuille = (u) => comptes.has(String(u));
export function useComptesFeuille() {
  const [, setT] = React.useState(0);
  React.useEffect(() => { const f = () => setT((t) => t + 1); ecoutes.add(f); return () => { ecoutes.delete(f); }; }, []);
  return compteDansFeuille;
}
