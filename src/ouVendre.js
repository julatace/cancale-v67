// ═══════════════════════════════════════════════════════════════════════════
// « OÙ VENDRE CET ARTICLE ? » (15 nov., lot securite-ventes — Julien : « vas-y fais tout »)
// ═══════════════════════════════════════════════════════════════════════════
// Sur la fiche d'un article : pour UN prix (le sien, modifiable), ce qu'il TOUCHE
// vraiment sur Vinted, Leboncoin, eBay et Vestiaire, frais du site déduits.
// Module PUR : aucune lecture, aucune écriture, aucun geste. Il range, l'écran dit.
//
// AUCUN BARÈME INVENTÉ. Chaque site prend la règle de frais qui EXISTE déjà dans VRM :
//   · Vinted, compte particulier : aucune commission vendeur — MESURÉ (src/fraisPlateformes.js,
//     4 nov. ; src/vintedPro.js, 11 nov. : 1 287 transactions de comptes particuliers, aucune
//     ne porte un frais du vendeur ; la Protection acheteurs est AJOUTÉE au prix, payée par
//     l'acheteur). Compte Pro : la commission ne se lit qu'au relevé (vintedPro.js) ⇒ « frais
//     inconnus ». Statut Pro pas lu ⇒ « frais inconnus » (« pas su » ne vaut pas « oui »).
//   · Leboncoin : la règle du bénéfice et de « Frais par site » — le prix capté est ce que le
//     vendeur touche (frais = 0 ; l'acheteur paie les frais de service).
//   · eBay : les frais LUS de SES commandes (`totalMarketplaceFee`, la règle de
//     `montantRecuEbay`), rapportés au dû vendeur (`totalDueSeller`, port exclu) ⇒ un taux
//     MOYEN sur ses DERNIÈRES ventes (les frais changent), dit « ≈ … d'après tes N dernières ventes ».
//     Sous SEUIL_TAUX ventes aux frais lus ⇒ « frais
//     inconnus ». Le port est payé par l'acheteur (CLAUDE.md §2.8) : jamais compté, ni en plus
//     ni en moins.
//   · Vestiaire : la commission LUE de SES ventes (`fraisVc`, api/_lib/vestiaire-regle.js :
//     prix affiché − versé), même règle de taux moyen, même seuil.
// Les sources officielles sont CITÉES (SOURCES_FRAIS) et n'entrent dans aucun calcul.
//
// Un site sans compte relié n'est jamais « le meilleur » : il est montré grisé, « pas relié ».
// Le meilleur = le plus haut montant parmi les sites reliés aux frais connus (ex æquo : tous) ;
// un site relié aux frais inconnus ⇒ `partiel` (l'écran dit « parmi les frais connus »).
// L'estimation arrondit les frais VERS LE HAUT (on ne promet jamais un centime de trop).
// Exécuté par scripts/audit-securite-ventes.cjs (+ --prouve).
// ═══════════════════════════════════════════════════════════════════════════

export const SITES_OU_VENDRE = Object.freeze(['vinted', 'leboncoin', 'ebay', 'vestiaire']);
// Sous ce nombre de ventes aux frais LUS, aucun taux n'est conclu (même seuil que « Vendre plus »).
export const SEUIL_TAUX = 5;
// Les pages officielles, CITÉES (jamais lues par le code, n'entrent dans aucun calcul). Relevé du
// 15 nov. 2026 : vinted.fr/pricelist (mise à jour du 08-09-2025) et l'aide « Protection acheteurs »
// (help/550) existent ; la page légale de Leboncoin aussi. Les pages d'aide eBay et Vestiaire n'ont
// pas pu être ouvertes depuis la session (réseau) : leur TITRE est cité, l'adresse non. Des sites tiers
// disent que les frais eBay des particuliers ont été retirés le 1er sept. 2026 et que Vestiaire a changé
// son barème en 2026 : c'est pourquoi VRM prend le taux de SES DERNIÈRES ventes, jamais un barème.
export const SOURCES_FRAIS = Object.freeze({
  vinted: Object.freeze([{ titre: 'Vinted · Liste des prix', url: 'https://www.vinted.fr/pricelist' }, { titre: 'Vinted · Protection acheteurs', url: 'https://www.vinted.fr/help/550' }]),
  leboncoin: Object.freeze([{ titre: 'Leboncoin · Informations légales et CGU', url: 'https://www.leboncoin.fr/legal.htm' }]),
  ebay: Object.freeze([{ titre: 'eBay.fr · Aide · Frais pour les vendeurs particuliers', url: null }]),
  vestiaire: Object.freeze([{ titre: 'Vestiaire Collective · Aide · Vendeur : frais de vente', url: null }]),
});
// Les frais d'un site changent (eBay, Vestiaire en 2026) : seules ses DERNIÈRES ventes comptent.
export const DERNIERES = 20;

// Une saisie de prix (« 85 », « 85,50 », « 1 200 € ») → centimes entiers, ou null (jamais deviné).
export function centimesPrix(saisie) {
  if (typeof saisie === 'number') return Number.isFinite(saisie) && saisie > 0 ? Math.round(saisie * 100) : null;
  const s = String(saisie == null ? '' : saisie).replace(/[\s  €]/g, '').replace(',', '.');
  if (!/^\d{1,6}(?:\.\d{1,2})?$/.test(s)) return null;
  const c = Math.round(Number(s) * 100);
  return c > 0 ? c : null;
}

// Vinted, selon le statut du compte : 'particulier' · 'pro' · 'mixte' (plusieurs comptes, statuts
// différents, aucun désigné) · autre (pas su).
export function fraisVintedSelon(statut) {
  if (statut === 'particulier') return { regle: 'aucune' };
  if (statut === 'pro') return { regle: 'inconnu', raison: 'pro' };
  if (statut === 'mixte') return { regle: 'inconnu', raison: 'selonCompte' };
  return { regle: 'inconnu', raison: 'statutPasSu' };
}
// Le statut de l'article : ses comptes Vinted possibles → leurs statuts Pro lus (true · false · null).
export function statutVinted(statuts) {
  if (!Array.isArray(statuts) || !statuts.length) return 'passu';
  if (statuts.some((x) => x !== true && x !== false)) return 'passu';
  if (statuts.every((x) => x === false)) return 'particulier';
  if (statuts.every((x) => x === true)) return 'pro';
  return 'mixte';
}

// Un taux MOYEN à partir de ventes aux frais lus : [{ cPrix, cFrais, ts }] (centimes entiers). Seules
// les DERNIERES ventes (par date, la plus récente d'abord ; sans date : après les datées) comptent.
export function tauxObserve(lignes) {
  if (lignes == null) return { regle: 'inconnu', raison: 'pasLu', n: 0 };
  const ok = [];
  for (const l of lignes) {
    if (!l || !Number.isSafeInteger(l.cPrix) || !Number.isSafeInteger(l.cFrais) || l.cPrix <= 0 || l.cFrais < 0 || l.cFrais > l.cPrix) continue;
    ok.push(l);
  }
  ok.sort((a, b) => (Number(b.ts) || 0) - (Number(a.ts) || 0));
  const pris = ok.slice(0, DERNIERES);
  const n = pris.length;
  if (n < SEUIL_TAUX) return { regle: 'inconnu', raison: 'peuDeVentes', n };
  let cPrix = 0, cFrais = 0, min = Infinity, max = -Infinity;
  for (const l of pris) { cPrix += l.cPrix; cFrais += l.cFrais; const r = l.cFrais / l.cPrix; if (r < min) min = r; if (r > max) max = r; }
  const pc = (x) => Math.round(x * 1000) / 10;
  return { regle: 'taux', n, cPrix, cFrais, pct: pc(cFrais / cPrix), pctMin: pc(min), pctMax: pc(max) };
}

const eurLu = (m) => (m && typeof m === 'object' && m.value != null && String(m.value).trim() !== '' && Number.isFinite(Number(m.value)) && m.currency === 'EUR')
  ? Math.round(Number(m.value) * 100) : null;
const tsDe = (x) => { const t = Date.parse(x || ''); return Number.isFinite(t) ? t : 0; };
// eBay : les commandes engagées dont le dû ET les frais sont lus en euros.
export function tauxEbay(commandes, engagee) {
  if (!Array.isArray(commandes)) return tauxObserve(null);
  const lignes = [];
  for (const o of commandes) {
    if (!o || (typeof engagee === 'function' && !engagee(o))) continue;
    const d = eurLu(o.paymentSummary && o.paymentSummary.totalDueSeller);
    const f = eurLu(o.totalMarketplaceFee);
    if (d == null || f == null || d <= 0) continue;
    lignes.push({ cPrix: d, cFrais: f, ts: tsDe(o.creationDate) });
  }
  return tauxObserve(lignes);
}
// Vestiaire : les ventes dont la commission est LUE (`fraisVc`).
export function tauxVestiaire(ventes, fraisVc) {
  if (!Array.isArray(ventes) || typeof fraisVc !== 'function') return tauxObserve(null);
  const lignes = [];
  for (const v of ventes) { let f; try { f = fraisVc(v); } catch (_) { f = null; } if (f && f.lu) lignes.push({ cPrix: f.cPrix, cFrais: f.cFrais, ts: tsDe(v && v.date) }); }
  return tauxObserve(lignes);
}

// Ce qu'il touche sur UN site pour `cPrix` (centimes), selon sa règle.
//   → { etat: 'connu' | 'estime' | 'inconnu', cTouche, cFrais, pct?, n?, raison? }
export function toucheSur(cPrix, frais) {
  if (!Number.isSafeInteger(cPrix) || cPrix <= 0) return { etat: 'inconnu', cTouche: null, cFrais: null, raison: 'prix' };
  if (!frais || frais.regle === 'inconnu') return { etat: 'inconnu', cTouche: null, cFrais: null, raison: (frais && frais.raison) || 'pasLu', n: frais && frais.n };
  if (frais.regle === 'aucune') return { etat: 'connu', cTouche: cPrix, cFrais: 0 };
  if (frais.regle === 'taux' && frais.cPrix > 0) {
    const cFrais = Math.ceil((cPrix * frais.cFrais) / frais.cPrix - 1e-9);
    return { etat: 'estime', cTouche: cPrix - cFrais, cFrais, pct: frais.pct, pctMin: frais.pctMin, pctMax: frais.pctMax, n: frais.n };
  }
  return { etat: 'inconnu', cTouche: null, cFrais: null, raison: 'pasLu' };
}

// LA RÈGLE. sites : { [site]: { relie: true|false|null, frais } }.
//   → { cPrix, lignes: [{ site, relie, etat ('pasRelie' en plus), cTouche, … , meilleur }], meilleurs, partiel }
export function ouVendre({ cPrix, sites = {} } = {}) {
  const lignes = SITES_OU_VENDRE.map((site) => {
    const s = sites[site] || {};
    if (s.relie !== true) return { site, relie: s.relie === false ? false : null, etat: 'pasRelie', cTouche: null, cFrais: null, meilleur: false };
    return { site, relie: true, ...toucheSur(cPrix, s.frais), meilleur: false };
  });
  const connus = lignes.filter((l) => l.relie && (l.etat === 'connu' || l.etat === 'estime') && l.cTouche != null);
  const max = connus.length ? Math.max(...connus.map((l) => l.cTouche)) : null;
  // Un seul site connu n'est pas « le meilleur » de rien : il faut au moins deux montants à comparer.
  const meilleurs = connus.length >= 2 ? connus.filter((l) => l.cTouche === max).map((l) => l.site) : [];
  for (const l of lignes) l.meilleur = meilleurs.includes(l.site);
  const partiel = lignes.some((l) => l.relie && l.etat === 'inconnu');
  return { cPrix: Number.isSafeInteger(cPrix) && cPrix > 0 ? cPrix : null, lignes, meilleurs, partiel };
}
