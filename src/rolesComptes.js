// ═══════════════════════════════════════════════════════════════════════════
// LE RÔLE D'UN COMPTE VINTED (20 nov., lot bleam-suite, « comme Bleam ») — une seule règle (§11)
// ═══════════════════════════════════════════════════════════════════════════
// Paramètres › Comptes liés › Gérer : « Compte de vente » (par défaut) · « Compte d'achats » · « Compte personnel
// (hors URSSAF et livre des recettes) ». Un compte PERSONNEL n'entre dans AUCUN total de CA déclaré, d'URSSAF ni du
// livre des recettes — exactement comme un compte écarté (« les comptes sélectionnés », `vinted_accounts_hidden`) :
// ses ventes restent visibles (colis, annonces, alertes : un colis caché est un colis perdu), seuls les TOTAUX
// déclarés l'écartent, et l'écart est DIT (le CA déclaré compte ce qu'il écarte, jamais en silence).
// `vrm_roles_comptes` = { [uid]: 'vente' | 'achats' | 'perso' } — un CHOIX écrit sur SON geste, synchronisé.
// Un rôle illisible ou absent ⇒ « vente » (pas su ne retire rien des totaux).
export const CLE_ROLES_COMPTES = 'vrm_roles_comptes';
export const ROLES_COMPTE = Object.freeze(['vente', 'achats', 'perso']);
export function roleCompte(regle, uid) {
  const v = regle && typeof regle === 'object' && !Array.isArray(regle) ? regle[String(uid)] : null;
  return ROLES_COMPTE.includes(v) ? v : 'vente';
}
// Les comptes PERSONNELS (Set d'uid) : hors de tout total déclaré.
export function comptesPersonnels(regle) {
  const o = regle && typeof regle === 'object' && !Array.isArray(regle) ? regle : {};
  return new Set(Object.keys(o).filter((u) => /^\d{1,20}$/.test(u) && o[u] === 'perso'));
}
// Les comptes hors des totaux déclarés : les écartés ET les personnels (même règle).
export function comptesHorsTotaux(caches, regle) {
  const s = new Set([...(caches || [])].map(String));
  for (const u of comptesPersonnels(regle)) s.add(u);
  return s;
}
// La nouvelle valeur après SON choix (les autres comptes ne bougent pas ; « vente » = la clé retirée).
export function avecRole(regle, uid, role) {
  const o = Object.assign({}, regle && typeof regle === 'object' && !Array.isArray(regle) ? regle : {});
  if (!/^\d{1,20}$/.test(String(uid)) || !ROLES_COMPTE.includes(role)) return o;
  if (role === 'vente') delete o[String(uid)]; else o[String(uid)] = role;
  return o;
}
