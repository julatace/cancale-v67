// ════════════════════════════════════════════════════════════════════════════
//  LE COÛT RÉEL DE CHAQUE VENTE (21 nov., lot rentabilite — choix n° 41 de Julien)
//  « Prix de vente − commission / frais de la plateforme − boost − emballage − port s'il le paie − prix d'achat =
//  bénéfice net de la paire », chaque ligne LUE (ou saisie par lui, ou fixée par la règle du site) ou ABSENTE et dite,
//  jamais devinée. Dans la fiche de vente (Ventes) et la colonne « Net » du tableau à l'ordinateur.
//
//  ⚠️ UNE SEULE RÈGLE (§5) : ce module DÉCOMPOSE la règle du bénéfice, il ne la recopie pas. Le net d'une vente est
//     `beneficePaire(base, ficheRegle)` (src/beneficePaire.js, `coutsVente` : boosts, commission notée, port payé par lui,
//     remboursement, autres frais, emballage saisi ou FORFAIT réglé par lui) — la règle de la ligne de vente, de
//     `vrm_benefice_jours` et du relevé `vrm_stats_ventes` ; `base` est ce que cette règle compte pour chaque site :
//       · Vinted     : le prix de la vente. Commission vendeur : AUCUNE (règle du site) — la protection acheteur est payée
//                      par l'acheteur, elle n'est ni une recette ni un frais (exclue) ;
//       · Leboncoin  : le prix final capté = ce que le vendeur touche (commission : aucune, règle de la vente captée) ;
//       · eBay       : l'argent reçu = `totalDueSeller` − `totalMarketplaceFee` (`montantRecuEbay`) : la commission est LUE
//                      sur la commande ; pas lue ⇒ la vente n'a pas de net (« — », jamais 0). Le PORT n'est ni une recette
//                      ni une charge (§2.8 : l'acheteur le paie à eBay, VRM n'achète jamais d'étiquette) : il n'est JAMAIS
//                      compté, même noté sur la fiche ; les autres frais notés (boost, emballage saisi ou forfait,
//                      remboursement, autres) le sont, comme sur les autres sites (`ficheDeLaRegle`) ;
//       · Vestiaire  : le montant versé ; la commission LUE = prix affiché − versé (`fraisVc`) quand les deux sont lus, sinon
//                      « pas lue » (dit) — le net reste celui du versé (la commission n'est pas comptée deux fois).
//  Par construction : vente − commission − boost − emballage − port − autres − achat === le bénéfice de la règle, au
//  centime (scripts/audit-rentabilite.cjs le vérifie sur des milliers de tirages, et par mutation).
//  Le prix d'achat est celui que la règle reçoit (relié par identité, jamais deviné ; un LOT : le prix du lot entier,
//  jamais divisé) ; manquant ⇒ net `null` (« — », la porte de saisie reste sur la fiche).
//  États : 'ok' (tout est su) · 'partiel' (achat su, des frais pas confirmés : le net est un plafond, « au plus ») ·
//  'achat' · 'commission' (eBay/Vestiaire, commission pas lue) · 'prix' · 'illisible' · 'annulee'.
// ════════════════════════════════════════════════════════════════════════════
import { beneficePaire, centimes, coutsVente } from './beneficePaire.js';

export const SITES_COUT_REEL = ['Vinted', 'Leboncoin', 'eBay', 'Vestiaire'];
const vide = (v) => v == null || String(v).trim() === '';
// LA FICHE QUE LA RÈGLE DU BÉNÉFICE COMPTE pour une vente de ce site — UNE définition pour la règle de l'app
// (src/App.jsx `ventesAutresBenefice` via `fraisFicheAutres`), la fiche de l'article (src/beneficeArticle.js) et ce module :
//   eBay : jamais le port (§2.8 : l'acheteur le paie à eBay) ni une commission notée (elle est lue) ; Vestiaire : jamais la
//   commission notée (le versé l'a déjà retirée) ; Vinted, Leboncoin : la fiche telle quelle.
export function ficheDeLaRegle(site, f) {
  const e = f || {};
  if (site === 'eBay') return { ...e, transportVendeur: '', commission: '' };   // la commission eBay est LUE (`totalMarketplaceFee`)
  if (site === 'Vestiaire') return { ...e, commission: '' };
  return e;
}
const saisi = (f, k) => { const v = f && f[k]; if (vide(v)) return { c: null, src: 'aucun' }; const c = centimes(v); return c == null ? { c: null, src: 'illisible' } : { c, src: 'saisi' }; };

// `plateforme` ; `prix` : le prix de vente affiché (euros, texte ou nombre ; eBay : le dû au vendeur `totalDueSeller`) ;
// `recu` (eBay, Vestiaire) : centimes de ce que la règle compte (eBay : dû − frais eBay ; Vestiaire : le versé) ou null ;
// `commissionLue` : centimes lus (eBay `totalMarketplaceFee`, Vestiaire prix − versé) ou null (pas lue) ; `fiche` : la fiche
// de la paire (prix d'achat résolu par l'appelant, comme pour la règle) ; `annulee`, `autreDevise`.
export function coutReelVente({ plateforme = 'Vinted', prix, recu = null, fiche, commissionLue = null, annulee = false, autreDevise = false } = {}) {
  const f = fiche || {};
  const site = SITES_COUT_REEL.includes(plateforme) ? plateforme : 'Vinted';
  if (annulee) return { site, etat: 'annulee', lignes: [], net: null, vente: null, base: null };
  const autre = site === 'eBay' || site === 'Vestiaire';
  const entier = (x) => (Number.isSafeInteger(x) && x >= 0 ? x : null);
  const lue = entier(commissionLue), recuC = entier(recu);
  const vente = autreDevise ? null : centimes(prix);
  // La fiche que la règle du site compte (`ficheDeLaRegle`) — jamais une autre.
  const ficheRegle = ficheDeLaRegle(site, f);
  const C = coutsVente(ficheRegle);
  const boost = saisi(f, 'fees');
  const port = site === 'eBay' ? { c: 0, src: 'ebay' } : saisi(f, 'transportVendeur');
  const embS = saisi(f, 'emballage');
  const emballage = embS.src !== 'aucun' ? embS : C.emballageForfait != null ? { c: C.emballageForfait, src: 'forfait' } : { c: null, src: 'aucun' };
  const comNote = site === 'Vinted' || site === 'Leboncoin' ? saisi(f, 'commission') : { c: null, src: 'aucun' };
  const commission = autre
    ? (lue != null ? { c: lue, src: 'lu' } : { c: null, src: 'pasLu' })
    : comNote.src === 'saisi' || comNote.src === 'illisible' ? comNote : { c: 0, src: 'regle' };
  const autresC = ['remboursement', 'autresFrais'].reduce((t, k) => { const x = saisi(f, k); return x.c == null ? t : (t ?? 0) + x.c; }, null);
  const achat = centimes(f.buyPrice);
  const lignes = [
    { cle: 'vente', c: vente, src: vente == null ? 'pasLu' : 'lu' },
    { cle: 'commission', c: commission.c, src: commission.src },
    { cle: 'boost', c: boost.c, src: boost.src },
    { cle: 'emballage', c: emballage.c, src: emballage.src },
    { cle: 'port', c: port.c, src: port.src },
    ...(autresC != null && autresC > 0 ? [{ cle: 'autres', c: autresC, src: 'saisi' }] : []),
    { cle: 'achat', c: achat, src: achat == null ? 'aucun' : 'saisi' },
  ];
  // LA BASE que la règle compte, puis LE NET : la règle elle-même (`beneficePaire`).
  const base = autreDevise ? null : autre ? recuC : vente;
  const B = base == null ? null : beneficePaire(String(base / 100), ficheRegle);
  let etat;
  if (base == null) etat = autre && !autreDevise && (site === 'eBay' ? vente != null : true) ? 'commission' : 'prix';
  else if (!C.valid) etat = 'illisible';
  else if (achat == null) etat = 'achat';
  else etat = C.complet ? 'ok' : 'partiel';
  const net = B && B.benefice != null && etat !== 'illisible' ? Math.round(B.benefice * 100) : null;
  return { site, etat, lignes, net, vente, base };
}

// La colonne « Net » d'une vente des AUTRES sites, depuis ce que la règle du bénéfice a déjà rangé (`ventesAutresBenefice` :
// { eur = la base, achat, frais }) : net = base − frais − achat, en centimes ; achat inconnu ⇒ null. La même règle que
// `ajouterVenteBenefice` (src/App.jsx) — rien de recalculé.
export function netDeVenteRangee(x) {
  if (!x) return null;
  const v = Number(x.eur), a = x.achat == null || String(x.achat).trim() === '' ? NaN : Number(x.achat), f = x.frais == null ? NaN : Number(x.frais);
  if (!Number.isFinite(v) || !Number.isFinite(a) || !Number.isFinite(f)) return null;
  return Math.round(v * 100) - Math.round(f * 100) - Math.round(a * 100);
}

// « +43 € », « au plus +43 € », « −5 € », « — ».
export function texteNet(net, etat, euros = (c) => (c / 100).toFixed(2).replace('.', ',').replace(/,00$/, '') + ' €') {
  if (etat === 'annulee') return '';
  if (net == null) return '—';
  const s = (net >= 0 ? '+' : '−') + euros(Math.abs(net));
  return etat === 'partiel' ? 'au plus ' + s : s;
}
