// ── src/conseiller/contexte.js — ce que « Demande à VRM » envoie à l'IA (23 nov.) ──
// SEULEMENT des agrégats déjà calculés par VRM, les mêmes que les écrans (src/conseiller/sources.js) : les conseils
// et leurs chiffres, le résumé par modèle (90 j), le CA par période (la carte des chiffres), les comptes (30 j), le
// stock. Jamais une ligne de vente, jamais un acheteur, jamais un message, jamais une photo. PUR.
// « Pas su » reste `null` (le serveur le dit à l'IA : null n'est pas zéro).
export function contexteIA(sources, conseils, maintenant = Date.now()) {
  const S = sources || {};
  const d = new Date(maintenant);
  return {
    aujourdhui: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    conseils: (Array.isArray(conseils) ? conseils : []).map((c) => ({ id: c.id, geste: c.geste, chiffres: c.chiffres || {} })),
    chiffres: S.chiffres || null,
    modeles90j: S.resume || null,
    comptes30j: Array.isArray(S.comptes) ? S.comptes.slice(0, 10).map((c) => ({ compte: c.nom, site: c.site, ventes: c.n, vendu: c.v, auMoins: !!c.vp })) : null,
    stock: S.stock ? { enLigne: S.stock.n, avecPrixAchat: S.stock.nPrix, valeurAchat: S.stock.centimes == null ? null : S.stock.centimes / 100, auMoins: !!S.stock.partiel } : null,
    dorment: S.dorment ? S.dorment.valeur : null,
    offresSansReponse: S.offres ? S.offres.n : null,
    baissesConseillees: S.baisses ? S.baisses.n : null,
  };
}
// Une estimation AVANT la question (jetons ≈ caractères ÷ 3 ; ~400 jetons de réponse), aux prix publics de Haiku 5.5.
export const PRIX_MTOK = Object.freeze({ entree: 0.10, sortie: 0.50 });
export function estimationUsd(contexte, question = '', systeme = 1800) {
  const entree = Math.ceil((systeme + JSON.stringify(contexte || {}).length + String(question).length + 200) / 3);
  return Math.round(((entree * PRIX_MTOK.entree + 400 * PRIX_MTOK.sortie) / 1e6) * 1e6) / 1e6;
}
