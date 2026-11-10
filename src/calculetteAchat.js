// ── LA CALCULETTE D'ACHAT (10 nov. 2026, lot L — validée par Julien) ──────────
// « Si j'achète X € et que je la revends Y € sur telle plateforme, combien je gagne ? »
// C'est LUI qui tape les deux prix : rien n'est conseillé (le prix conseillé est
// REFUSÉ depuis le 11 oct., CLAUDE.md §3) ; rien n'est écrit (aucun save, aucun envoi).
//
// UNE règle (§5) : le bénéfice est celui d'une vente, `cascadeVente` (src/coutVente.js)
// sur une fiche faite des chiffres TAPÉS — vente − achat − frais − emballage — jamais
// une seconde formule. Les frais de la plateforme sont ceux que VRM LIT déjà
// (src/fraisPlateformes.js, mesuré le 4 nov.) :
//   · Vinted    : aucune commission vendeur (l'acheteur paie la protection) ⇒ 0, sûr ;
//   · Leboncoin : le prix de vente est ce que le vendeur touche ⇒ 0, sûr ;
//   · eBay      : la part des frais LUS sur SES commandes (`fraisParPlateforme`, la même
//                 règle que Statistiques → « Ce que coûte chaque site ») appliquée au prix
//                 tapé ⇒ « environ », avec « d'après tes N ventes eBay » ; aucune commande
//                 aux frais lus ⇒ frais PAS SUS ⇒ le bénéfice est « au plus » ;
//   · Vestiaire : commission pas lue (jamais devinée) ⇒ bénéfice « au plus ».
// L'emballage est celui qu'il tape (ou choisit parmi SES emballages, src/emballages.js) ;
// vide ⇒ « emballage pas compté », le bénéfice dit « au plus » s'il en reste.
//
// Module PUR : src/CalculetteAchat.jsx et scripts/audit-calculette-emballages.cjs.
import { cascadeVente } from './coutVente.js';
import { centimes } from './beneficePaire.js';
import { fraisParPlateforme } from './fraisPlateformes.js';

export const SITES_CALCULETTE = [
  { cle: 'vinted', nom: 'Vinted' },
  { cle: 'leboncoin', nom: 'Leboncoin' },
  { cle: 'ebay', nom: 'eBay' },
  { cle: 'vestiaire', nom: 'Vestiaire' },
];

// Ce que la plateforme prend, tel que VRM le sait.
// Rend { etat: 'zero' | 'taux' | 'pasLu', taux (‰ entier, eBay), n (ventes lues), phrase }.
export function fraisSite(site, { ebayCommandes = null, commandeEbayEngagee = null } = {}) {
  if (site === 'vinted') return { etat: 'zero', phrase: 'Vinted ne prend rien au vendeur' };
  if (site === 'leboncoin') return { etat: 'zero', phrase: 'Leboncoin ne prend rien au vendeur' };
  if (site === 'vestiaire') return { etat: 'pasLu', phrase: 'Commission Vestiaire pas lue' };
  if (site !== 'ebay') return { etat: 'pasLu', phrase: 'Frais pas connus' };
  if (!Array.isArray(ebayCommandes) || typeof commandeEbayEngagee !== 'function') return { etat: 'pasLu', phrase: 'Frais eBay pas encore lus' };
  const F = fraisParPlateforme({ releve: [], ebay: ebayCommandes, packs: [], de: 0, a: Infinity, R: { commandeEbayEngagee } });
  const s = F.sites.find((x) => x.plateforme === 'eBay');
  const lus = s && s.couverture ? s.couverture.lus : 0;
  if (!s || !lus || !(s.base > 0)) return { etat: 'pasLu', phrase: 'Frais eBay pas encore lus' };
  // Le taux en pour mille, sur les SEULES ventes aux frais lus (commission / dû au vendeur).
  const taux = Math.round((Math.round(s.commission * 100) / Math.round(s.base * 100)) * 1000);
  return { etat: 'taux', taux, n: lus, phrase: `${(taux / 10).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} % d’après tes ${lus} vente${lus > 1 ? 's' : ''} eBay` };
}

const lisible = (t) => { const s = String(t == null ? '' : t).trim().replace(/\s*€$/, '').replace(/\s/g, ''); return s === '' ? '' : s; };

// Le calcul. Rend { etat: 'vide' | 'illisible' | 'ok', … } :
//   ok : { cascade, benefice (centimes), borne: 'exact' | 'environ' | 'au-plus', frais, manque: [phrases] }
export function calculer({ achat, revente, site, emballage = '' }, contexte = {}) {
  const a = lisible(achat), v = lisible(revente), e = lisible(emballage);
  if (!a || !v) return { etat: 'vide' };
  if (centimes(a) == null || centimes(v) == null || (e && centimes(e) == null)) return { etat: 'illisible' };
  const f = fraisSite(site, contexte);
  const commission = f.etat === 'taux' ? String((Math.round(centimes(v) * f.taux / 1000) / 100).toFixed(2)) : '';
  const fiche = { buyPrice: a, ...(commission ? { commission } : {}), ...(e ? { emballage: e } : {}), fraisComplets: true };
  const c = cascadeVente(v, fiche);
  if (c.etat !== 'ok' && c.etat !== 'partiel') return { etat: 'illisible' };
  const manque = [];
  if (f.etat === 'pasLu') manque.push(f.phrase);
  if (!e) manque.push('emballage pas compté');
  const borne = manque.length ? 'au-plus' : f.etat === 'taux' ? 'environ' : 'exact';
  return { etat: 'ok', cascade: c, benefice: c.benefice, borne, frais: f, manque };
}

// « 32 € », « 12,50 € », « −8 € ».
export const eurosCalc = (c) => {
  if (c == null || !Number.isFinite(c)) return '—';
  const e = Math.abs(c) / 100;
  return (c < 0 ? '−' : '') + (Number.isInteger(e) ? e.toLocaleString('fr-FR') : e.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) + ' €';
};
