// ── FLOU PAR COMPTE — une définition pour tous les espaces (§11) ─────────────
// Julien (7 oct., Vinted) : le compte OUVERT est mis en avant, les lignes des
// autres comptes restent VISIBLES mais estompées (flou + gris + non cliquables) —
// rien n'est caché. 31 oct. : « pareil pour Leboncoin et Vestiaire ».
// Le style est le même partout : Vinted (Comptabilite) et Leboncoin le lisent ici.
export const STYLE_FLOU = Object.freeze({ filter: 'blur(2px) grayscale(0.55)', opacity: 0.4, pointerEvents: 'none', transition: 'filter 160ms ease-out, opacity 160ms ease-out' });

// L'identité d'un compte Leboncoin : `8442c3e8…` (compteur de messagerie) et
// `lbc-account:8442c3e8…` (session privée) sont LE MÊME compte (5.212) — une
// identité, jamais un nom ressemblant (§5). Même règle que `idCompteLbc` de
// l'extension.
export const idCompteLbcFlou = (x) => String(x == null ? '' : x).trim().replace(/^lbc-account:/i, '');

// ── LE COMPTE LEBONCOIN OUVERT ───────────────────────────────────────────────
// Ce que l'extension relève (background.js, `noterSessionLbc` / `storeLbcAccount`,
// 5.195) : `lbc_accounts.accounts[id].sessionAt`, posé SEULEMENT pour le compte
// dont la page a lu le compteur de messagerie (Leboncoin ne le relit que pour le
// compte connecté) ou `members/me/account` — jamais pour un compte lié, jamais
// pour une fiche d'autrui. L'extension le réécrit à CHAQUE changement de compte,
// sinon au plus toutes les 6 h tant qu'il navigue sur leboncoin.fr.
// ⇒ Le compte ouvert = celui au `sessionAt` le plus récent, s'il date de moins de
//   `LBC_OUVERT_MS` (deux fois la cadence de réécriture : un compte relevé il y a
//   longtemps n'est pas « ouvert »). Deux comptes au même instant, aucune date
//   lisible, ou trop ancienne ⇒ '' : « pas su », aucun flou, jamais un compte
//   deviné. (Borne choisie, non mesurée.)
export const LBC_OUVERT_MS = 12 * 3600e3;
export function compteLbcOuvert(accounts, maintenant = Date.now()) {
  let meilleur = '', t0 = -Infinity, egalite = false;
  for (const [cle, a] of Object.entries(accounts || {})) {
    if (!a || !a.sessionAt) continue;
    const t = Date.parse(String(a.sessionAt));
    if (!Number.isFinite(t)) continue;
    const id = idCompteLbcFlou(a.id || cle);
    if (!id) continue;
    if (t > t0) { meilleur = id; t0 = t; egalite = false; }
    else if (t === t0 && id !== meilleur) egalite = true;
  }
  if (!meilleur || egalite) return '';
  if (maintenant - t0 > LBC_OUVERT_MS) return '';
  return meilleur;
}
// Une ligne est estompée seulement si un compte est ouvert ET que la ligne porte
// un AUTRE compte connu. Une ligne sans compte relevé n'est jamais floutée (on
// n'affirme pas qu'elle est à un autre compte).
export function lbcFloute(ouvert, compteLigne) {
  const c = idCompteLbcFlou(compteLigne);
  return !!(ouvert && c && c !== ouvert);
}
