// ═══════════════════════════════════════════════════════════════════════════
// LE BÉNÉFICE RÉEL D'UN ARTICLE, FRAIS INCLUS (15 nov., lot argent-plus)
// ═══════════════════════════════════════════════════════════════════════════
// Julien (« vas-y fais tout ») : prix de vente − frais de la plateforme − frais connus
// (boost, port payé par lui, emballage…) − prix d'achat réel ; sur la fiche de
// l'article et dans les listes, le manque NOMMÉ quand un élément manque.
//
// AUCUNE RÈGLE NEUVE (§5) — ce module ASSEMBLE celles qui existent :
//   · ce que le site verse = la règle de chaque site, passée par l'appelant :
//       Vinted     aucune commission vendeur (l'acheteur paie la protection,
//                  src/fraisPlateformes.js) ⇒ versé = prix ;
//       Leboncoin  le prix final capté EST ce que le vendeur touche ⇒ versé = prix ;
//       eBay       `montantRecuEbay` (App.jsx) = dû au vendeur − frais eBay LUS
//                  (`totalMarketplaceFee`), port jamais compté (§2.8) ; frais pas lus
//                  ou autre devise ⇒ PAS SU (jamais compté à 0) ;
//       Vestiaire  `montantRecuVc` (le versé `sellerEarning`) ; la commission est
//                  prix affiché − versé quand les deux sont lus (`fraisVc`), sinon
//                  « pas lue » — le bénéfice, lui, part du versé ;
//   · le reste = `beneficeLigneVente` (src/beneficeLigne.js → `beneficePaire`) sur ce
//     VERSÉ : − prix d'achat SAISI (jamais deviné, §2.5) − frais SAISIS (`coutsVente` :
//     boost, commission notée, port payé par lui, remboursement, emballage, autres),
//     en centimes entiers — la règle de la ligne d'une vente, de la cascade, de
//     `vrm_benefice_jours` et de la fiche. Par construction : versé − saisis − achat
//     === bénéfice de la règle, au centime (l'audit le vérifie).
// LES ÉTATS (le manque est NOMMÉ, jamais un 0 inventé) :
//   'ok'        tout est connu : le bénéfice exact ;
//   'partiel'   achat connu, frais saisis PAS confirmés (« Tous les frais sont
//               renseignés » pas coché) : ce qui reste à déduire ne peut que BAISSER
//               le bénéfice ⇒ « au plus » (un plafond, jamais un plancher) ;
//   'achat'     prix d'achat pas saisi ⇒ « — » ;
//   'plateforme' ce que le site verse n'est pas lu (frais eBay inconnus, devise) ⇒ « — » ;
//   'prix'      prix de vente pas lu (ou autre devise) ⇒ « — » ;
//   'illisible' un montant saisi illisible ⇒ « — » ;
//   'annulee'   vente annulée : pas de bénéfice.
// ⚠️ Une LISTE ne se somme que sur ses articles calculables ; ce qu'elle ne compte pas
//    est dit (« sur 18 ventes de 23 · 5 prix d'achat à saisir »). Elle ne dit JAMAIS
//    « au moins » : un article au prix d'achat inconnu peut être vendu à perte
//    (src/beneficeNoms.js, 13 nov.) — un total qui contient un « au plus » est lui-même
//    « au plus ». Le nom de la notion : « Après frais de vente » (`NOM_APRES_FRAIS`).
// Module PUR. Exécuté par scripts/audit-argent-plus.cjs.
// ═══════════════════════════════════════════════════════════════════════════
import { beneficeLigneVente } from './beneficeLigne.js';
import { coutsVente, centimes } from './beneficePaire.js';

export const SITES_SANS_COMMISSION = ['Vinted', 'Leboncoin'];
const cts = (x) => { if (x == null || x === '') return null; const c = centimes(String(typeof x === 'number' ? (Math.round(x * 100) / 100).toFixed(2) : x).replace(',', '.')); return c; };

// `vente` : le prix payé pour l'article (euros : nombre ou texte « 12,50 ») ;
// `recu`  : ce que le site verse (euros), `null` = pas su (`raisonRecu` le dit) —
//           ignoré pour Vinted et Leboncoin (versé = prix) ;
// `entree` : la fiche de l'article (prix d'achat résolu, frais saisis).
export function beneficeArticle({ plateforme = 'Vinted', vente = null, recu = null, raisonRecu = '', entree = null, annulee = false, autreDevise = false } = {}) {
  const e = entree || {};
  const venteC = autreDevise ? null : cts(vente);
  const sansCommission = SITES_SANS_COMMISSION.includes(plateforme);
  const recuC = sansCommission ? venteC : (autreDevise ? null : cts(recu));
  const ch = coutsVente(e);
  const achatC = centimes(e.buyPrice);
  const fraisSite = sansCommission ? (venteC == null ? null : 0) : (venteC != null && recuC != null ? venteC - recuC : null);
  const base = {
    plateforme, vente: venteC, fraisSite, recu: recuC, saisis: ch.valid ? ch.cents : null, saisisConfirmes: !!ch.complet,
    achat: achatC, benefice: null, manque: [], raisonRecu: recuC == null && !sansCommission ? (raisonRecu || 'versé pas lu') : '',
  };
  if (annulee) return { ...base, etat: 'annulee' };
  if (autreDevise) return { ...base, etat: 'prix', manque: ['devise'] };
  if (recuC == null) {
    if (sansCommission || (venteC == null && !raisonRecu)) return { ...base, etat: 'prix', manque: ['prix'] };
    return { ...base, etat: 'plateforme', manque: ['plateforme', ...(achatC == null ? ['achat'] : [])] };
  }
  // LA règle : `beneficeLigneVente` sur ce que le site VERSE.
  const r = beneficeLigneVente((recuC / 100).toFixed(2), e);
  const manque = [];
  if (r.etat === 'achat') manque.push('achat');
  if (r.etat === 'illisible') manque.push('illisible');
  if (r.etat === 'partiel') manque.push('frais');
  const benefice = r.benefice == null ? null : Math.round(r.benefice * 100);
  return { ...base, etat: r.etat === 'prix' ? 'prix' : r.etat, benefice, manque };
}

// Le résumé d'une LISTE d'articles (sorties de `beneficeArticle`) : la somme des
// calculables, leur nombre sur le total, et les manques comptés par nature.
export function beneficeListe(resultats) {
  const L = (Array.isArray(resultats) ? resultats : []).filter((r) => r && r.etat !== 'annulee');
  let somme = 0, nCompte = 0, nAuPlus = 0;
  const manque = { achat: 0, plateforme: 0, frais: 0, prix: 0, illisible: 0, devise: 0 };
  for (const r of L) {
    if (r.benefice != null && (r.etat === 'ok' || r.etat === 'partiel')) { somme += r.benefice; nCompte += 1; if (r.etat === 'partiel') nAuPlus += 1; }
    for (const m of r.manque || []) if (m in manque) manque[m] += 1;
  }
  return { n: L.length, nCompte, nAuPlus, auPlus: nAuPlus > 0, somme: nCompte ? somme : null, manque };
}

// Les lignes de la décomposition, pour l'écran (montants en centimes, `null` = « — »).
// `T` : le `tr` de l'app. Le signe se lit dans le nom (« − frais du site ») : chaque
// montant est positif, le bénéfice seul peut être négatif.
export function lignesBeneficeArticle(b, T = (k) => k) {
  if (!b || b.etat === 'annulee') return [];
  const sansCommission = SITES_SANS_COMMISSION.includes(b.plateforme);
  const L = [{ cle: 'vente', nom: T('argentPlus.ba.vente'), v: b.vente }];
  L.push({ cle: 'site', nom: T('argentPlus.ba.site', { site: b.plateforme }), v: b.fraisSite,
    note: sansCommission ? T('argentPlus.ba.siteAucune') : b.fraisSite == null ? (b.recu != null ? T('argentPlus.ba.sitePasLu') : (b.raisonRecu || T('argentPlus.ba.sitePasLu'))) : '' });
  if (!sansCommission) L.push({ cle: 'recu', nom: T('argentPlus.ba.recu', { site: b.plateforme }), v: b.recu, note: b.recu == null ? (b.raisonRecu || T('argentPlus.ba.sitePasLu')) : '' });
  L.push({ cle: 'saisis', nom: T('argentPlus.ba.saisis'), v: b.saisis, note: b.saisis == null ? T('argentPlus.ba.illisible') : b.saisisConfirmes ? T('argentPlus.ba.confirmes') : T('argentPlus.ba.aConfirmer') });
  L.push({ cle: 'achat', nom: T('argentPlus.ba.achat'), v: b.achat, note: b.achat == null ? T('argentPlus.ba.achatManque') : '' });
  L.push({ cle: 'reste', nom: T('argentPlus.ba.reste'), v: b.benefice, total: true, auPlus: b.etat === 'partiel' });
  return L;
}
// Les manques d'une liste, en mots (une phrase par nature présente).
export function manquesListe(s, T = (k, v) => k) {
  if (!s) return [];
  const out = [];
  if (s.manque.achat) out.push(T('argentPlus.bl.achat', { n: s.manque.achat }));
  if (s.manque.plateforme) out.push(T('argentPlus.bl.plateforme', { n: s.manque.plateforme }));
  if (s.manque.frais) out.push(T('argentPlus.bl.frais', { n: s.manque.frais }));
  if (s.manque.prix + s.manque.devise + s.manque.illisible) out.push(T('argentPlus.bl.prix', { n: s.manque.prix + s.manque.devise + s.manque.illisible }));
  return out;
}
