// ── GARDE DES OFFRES AUTOMATIQUES (2 novembre 2026) ─────────────────────────
// Audit « plateformes » P2 (GRAVE) : moteur allumé, prix mini posé à côté du N°,
// la paire se vend sur eBay, Leboncoin ou Vestiaire — l'annonce Vinted est encore
// en ligne, une offre arrive au-dessus du mini… et l'extension l'acceptait : la
// même paire vendue deux fois.
//
// L'app est la seule à savoir qu'une paire est vendue AILLEURS (§11 : la preuve de
// vente a un seul propriétaire). Elle publie donc, dans la ligne `main`
// (`vinted_offres_garde`), les annonces Vinted sur lesquelles l'extension ne doit
// JAMAIS accepter une offre, et si cette liste est COMPLÈTE. L'extension n'accepte
// que si la liste est complète, fraîche, et ne contient pas l'annonce.
// « Pas su » ne vaut pas « oui » : une plateforme pas relue ⇒ liste incomplète ⇒
// aucune acceptation (le refus sous le seuil, lui, reste permis : il ne vend rien).
//
// Identité seulement (§5) : les annonces viennent de `articlesVendusAilleurs`
// (N° par clé, lot éclaté, N° ambigu jamais deviné). Jamais le titre.
export const GARDE_OFFRES_VERSION = 1;
// L'extension refuse une garde plus vieille que ça (l'app n'a pas été rouverte).
export const GARDE_OFFRES_MAX_AGE_MS = 48 * 3600 * 1000;

// `data` : la sortie de `chargerRetraitsMulti` ({ annonces, ventes, manques }).
// `calcul` : la sortie de `articlesVendusAilleurs(data)` ({ lignes, ambigus }).
export function gardeOffres(data, calcul, maintenant = Date.now()) {
  const items = new Set();
  // 1. Vendue AILLEURS (eBay, Leboncoin, Vestiaire) : son annonce Vinted encore en ligne.
  for (const l of (calcul && calcul.lignes) || [])
    if (l && l.plateforme === 'Vinted' && l.id != null) items.add(String(l.id));
  // 2. Vendue sur Vinted même (vente prouvée) : l'annonce n'est plus active.
  for (const a of (data && data.annonces) || [])
    if (a && a.plateforme === 'Vinted' && a.active === false && a.id != null) items.add(String(a.id));
  const manques = Array.isArray(data && data.manques) ? data.manques.map(String) : ['rien lu'];
  return {
    v: GARDE_OFFRES_VERSION,
    at: maintenant,
    items: [...items].sort(),
    complet: !!data && manques.length === 0,
    manques,
    ambigus: Number((calcul && calcul.ambigus) || 0),
  };
}

// La MÊME décision que l'extension (copie dans background.js, `offreGardeDit`,
// comparée par `audit-offres-garde.cjs`) : peut-on accepter une offre sur `item` ?
// Rend `null` si oui, sinon la raison.
export function gardeRefuse(garde, item, maintenant = Date.now()) {
  if (!garde || typeof garde !== 'object' || garde.v !== GARDE_OFFRES_VERSION) return 'garde-absente';
  const at = Number(garde.at);
  if (!Number.isFinite(at) || maintenant - at > GARDE_OFFRES_MAX_AGE_MS || at > maintenant + 120000) return 'garde-perimee';
  if (garde.complet !== true) return 'garde-incomplete';
  if (!Array.isArray(garde.items)) return 'garde-absente';
  if (item == null || garde.items.includes(String(item))) return 'vendue-ailleurs';
  return null;
}
