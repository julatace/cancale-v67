// ── « EN LIGNE » SUR VESTIAIRE : CE QU'ON MONTRE ET CE QU'ON COMPTE (26 nov. 2026) ──
// Julien : « les données doivent être fiables, pense à Vestiaire Co et Leboncoin ».
//
// Trois écrans disaient l'état d'une annonce Vestiaire, chacun à sa façon :
//   · le Stock (`annoncesVcStock`) et l'anti double vente (`annoncesVcEnLigne`) : une vente
//     ANNULÉE ne prouve rien (l'article reste chez lui) et une lecture de plus de 24 h
//     ne dit plus « en ligne » (« à confirmer », §5 `<enligne-regle>`) ;
//   · Annonces → Vestiaire (`AnnoncesVestiaire`) et la touche « VC n » du sélecteur
//     (`compterVcEnLigne`) : toute vente lue, même annulée, disait « Vendue », et une
//     lecture vieille d'une semaine restait « En ligne » (comptée) ;
//   · l'écran Annonces de tous les sites (`lireAnnoncesEgalite`) : il ne lisait AUCUNE
//     vente Vestiaire — une annonce vendue restait « En ligne » jusqu'à la relecture.
// Une règle par notion (§11) : ce module, pur, est la seule façon de les dire.
//
// LA RÈGLE (le mot lu chez Vestiaire reste jugé par `etatAnnonceVcBrut`, partagée
// avec le serveur, inchangée) :
//   · une vente LUE et PAS ANNULÉE (`vcVenteAnnulee`) du même identifiant d'article
//     prouve « vendue » ; ventes pas lues (`null`) ⇒ rien n'en est tiré ;
//   · « en ligne » seulement si la lecture des annonces a moins de 24 h ; plus vieille,
//     ou pas datée ⇒ « à confirmer » (présente, hors des totaux, rien retiré) ;
//   · tout le reste (modération, retirée, état non dit) : le mot lu, tel quel.
import { etatAnnonceVcBrut, vcVenteAnnulee } from '../api/_lib/vestiaire-regle.js';

export const VC_FRAIS_MS = 24 * 3600e3;

// Les identifiants d'articles PROUVÉS vendus (vente lue, pas annulée). `null` = ventes pas lues.
export function vendusVc(ventes) {
  if (!ventes || typeof ventes !== 'object') return null;
  const out = new Set();
  for (const v of Object.values(ventes)) if (v && typeof v === 'object' && v.productId != null && String(v.productId) !== '' && !vcVenteAnnulee(v)) out.add(String(v.productId));
  return out;
}

// La lecture des annonces a-t-elle moins de 24 h ? (pas datée ⇒ non)
export const lectureVcFraiche = (capturedAt, maintenant = Date.now()) => {
  const lu = Date.parse(String(capturedAt || ''));
  return Number.isFinite(lu) && Number(maintenant) - lu <= VC_FRAIS_MS;
};

// L'état d'UNE annonce, à montrer et à compter : 'en-ligne' · 'a-confirmer' · 'vendue' · 'retiree' ·
// 'attente' · 'corriger' · 'refusee' · 'pas-dit' · 'autre'. `vieille: true` = « à confirmer » parce que la
// lecture a plus de 24 h (pas parce que l'annonce n'y était plus).
export function etatVcLu(id, it, { vendus = null, capturedAt = '', maintenant = Date.now() } = {}) {
  const vendue = !!(vendus && vendus.has(String(id)));
  const e = etatAnnonceVcBrut(it, vendue, capturedAt);
  if (e === 'en-ligne' && !lectureVcFraiche(capturedAt, maintenant)) return { etat: 'a-confirmer', vieille: true };
  return { etat: e, vieille: false };
}

// Le nombre d'annonces « En ligne » (touche Vestiaire du sélecteur d'Annonces). Liste jamais lue ⇒ null.
export function compterVcEnLigneRegle(lst, ventes, maintenant = Date.now()) {
  if (!lst || typeof lst !== 'object' || !lst.items || typeof lst.items !== 'object' || !lst.capturedAt) return null;
  const vendus = vendusVc(ventes);
  let n = 0;
  for (const [id, it] of Object.entries(lst.items)) {
    if (!it || typeof it !== 'object') continue;
    if (etatVcLu(id, it, { vendus, capturedAt: lst.capturedAt, maintenant }).etat === 'en-ligne') n++;
  }
  return n;
}

// L'état de chaque annonce pour l'écran Annonces de tous les sites (`lireAnnoncesEgalite`) : `capturedAt` de la
// lecture `vc_listings`, `ventesLues` = la réponse de la lecture `vc_ventes` projetée (`[{ ventes }]` ; autre chose =
// lecture ratée ⇒ aucune vente n'en est tirée, « vendue » seulement si l'annonce le dit).
export function etatDeVc({ capturedAt = '', ventesLues = null, maintenant = Date.now() } = {}) {
  const vendus = Array.isArray(ventesLues) && ventesLues[0] ? vendusVc(ventesLues[0].ventes) : null;
  return (id, it) => etatVcLu(id, it, { vendus, capturedAt, maintenant }).etat;
}
