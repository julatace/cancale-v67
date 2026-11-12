// ════════════════════════════════════════════════════════════════════════════
//  BAISSER LE PRIX EN SÉRIE SUR VESTIAIRE (11 nov., lot vestiaire-plus, ext. 5.364)
// ════════════════════════════════════════════════════════════════════════════
// Même règle que Vinted (src/baissePrix.js : c'est LUI qui choisit la baisse,
// arrondie à l'euro, toujours sous l'ancien prix ; VRM ne propose aucun montant),
// avec ce qui est propre à Vestiaire :
//  · la requête n'est rejouée que si sa RECETTE a été APPRISE de son propre
//    changement de prix fait à la main sur vestiairecollective.com (et relu) —
//    `vc_prix_recette.appris`. Sinon : « Fais-le une fois à la main, VRM apprendra » ;
//  · le compte de l'annonce (`vc_listings.items[id].compte`) doit être celui de
//    l'onglet Vestiaire (`vc_session`) ; sinon la ligne ne part pas ;
//  · le prix LU (vc_listings) est envoyé avec la commande : l'extension refuse si
//    la page montre un autre prix ; « fait » seulement au prix RELU.
// Module PUR : scripts/audit-baisse-vestiaire.cjs l'exécute.
import { prixBaisse } from './baissePrix.js';

// Le prix lu d'une annonce Vestiaire en CENTIMES (la clé dit « price », en euros), sinon null.
export const centsAnnonceVc = (it) => {
  const p = it && it.prix;
  return p && typeof p.valeur === 'number' && isFinite(p.valeur) && p.valeur > 0 && /price/i.test(String(p.cle || '')) && (!p.devise || p.devise === 'EUR') ? Math.round(p.valeur * 100) : null;
};

// Ce que VRM peut faire : 'pret' · 'pas-appris' · 'pas-sur' (raison) · 'passu' · 'ext-absente' · 'ext-retard'.
export function etatRecettePrixVc(recette, cap) {
  if (cap !== 'ok') return { etat: cap === 'absente' ? 'ext-absente' : 'ext-retard', raison: '' };
  if (recette === undefined) return { etat: 'encours', raison: '' };
  if (recette === null) return { etat: 'passu', raison: '' };
  if (!recette || recette.appris == null) return { etat: 'pas-appris', raison: '' };
  return recette.appris === true ? { etat: 'pret', raison: '' } : { etat: 'pas-sur', raison: String(recette.raison || '') };
}

// L'aperçu : `annonces` = [{ id, compte, num, titre, photo, it }] ; `compteOnglet` :
// undefined pas su · null aucun · id Vestiaire. Chaque ligne :
// { …a, avant (cents), apres (cents), bloque ('' ou code), coche }.
export function lignesBaisseVc({ annonces, baisse, compteOnglet } = {}) {
  return (Array.isArray(annonces) ? annonces : []).filter((a) => a && /^\d{3,15}$/.test(String(a.id || ''))).map((a) => {
    const avant = centsAnnonceVc(a.it);
    const nouveau = avant == null ? null : prixBaisse(avant / 100, baisse);
    const compte = String(a.compte || '');
    let bloque = '';
    if (!compte) bloque = 'compte-inconnu';
    else if (compteOnglet === undefined) bloque = 'onglet-passu';
    else if (!compteOnglet) bloque = 'onglet-absent';
    else if (String(compteOnglet) !== compte) bloque = 'autre-compte';
    else if (avant == null) bloque = 'prix-pas-lu';
    else if (baisse && baisse.ok && nouveau == null) bloque = 'trop-grande';
    return { ...a, compte, avant, apres: nouveau == null ? null : nouveau * 100, bloque, coche: !bloque && nouveau != null };
  });
}

// Ce qui arrête toute la série (le suivant serait refusé pareil).
const ARRET = new Set(['plafond', 'vc-pause', 'vc-absent', 'autre-compte', 'session', 'stockage', 'pas-appris', 'pas-rejouable', 'entetes', 'en-cours']);
// La réponse de l'extension → l'état d'UNE ligne (jamais « fait » sans le prix RELU).
export function issueBaisseVc(r) {
  if (!r || r.sansReponse) return { etat: 'incertain', prixVu: null, code: 'muet', arret: true };
  if (r.accepte !== true) return { etat: 'refus', prixVu: r.prixVu != null && isFinite(Number(r.prixVu)) ? Number(r.prixVu) : null, code: String(r.code || ''), raison: r.raison || '', arret: ARRET.has(String(r.code || '')) };
  const vu = r.prixVu != null && isFinite(Number(r.prixVu)) ? Number(r.prixVu) : null;
  if (r.etape === 'fait' && vu != null) return { etat: 'fait', prixVu: vu, arret: false };
  if (r.etape === 'ecart' && vu != null) return { etat: 'ecart', prixVu: vu, arret: false };
  if (r.etape === 'echec') return { etat: 'echec', prixVu: null, raison: r.raison || '', arret: true };
  return { etat: 'incertain', prixVu: null, raison: r.raison || '', arret: false };
}
