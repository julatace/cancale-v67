// ── LA MARGE POSSIBLE D'UNE ANNONCE eBAY SIGNALÉE (11 nov., lot alertes-ebay) ──
// Pur. Jamais un verdict (« bonne affaire » est REFUSÉ, §3) : un calcul avec SES
// chiffres, par LA règle de la calculette (src/calculetteAchat.js `calculer` →
// `cascadeVente`) — aucune seconde formule.
//   · le prix d'achat : celui de l'annonce PORT COMPRIS ; port inconnu ⇒ le prix
//     seul et la marge est « au plus » (« port pas connu ») ;
//   · le prix de revente, dans l'ordre : celui qu'IL a indiqué sur la recherche
//     (`veille.revente`, sur le site qu'il a choisi) ; sinon la MÉDIANE de SES ventes
//     Vinted du modèle de la recherche (au moins 3, la règle du repère : jamais une clé
//     générique ni un accessoire) ; sinon rien — « — » et la raison ;
//   · ses ventes pas lues ⇒ « pas su » (jamais « aucune vente »).
import { calculer } from './calculetteAchat.js';

export const MIN_VENTES_MEDIANE = 3;

// La médiane, en centimes entiers (deux valeurs du milieu : leur moyenne arrondie).
export function mediane(liste) {
  const xs = (Array.isArray(liste) ? liste : []).filter((x) => Number.isFinite(x) && x > 0).map((x) => Math.round(x)).sort((a, b) => a - b);
  if (!xs.length) return null;
  const m = xs.length >> 1;
  return xs.length % 2 ? xs[m] : Math.round((xs[m - 1] + xs[m]) / 2);
}

const deux = (c) => (c / 100).toFixed(2);

// `veille` : la recherche (ou null si elle n'existe plus) ;
// `revente(mots)` : undefined = ventes pas encore lues · null = pas de médiane · { modele, mediane, n }.
// Rend { etat: 'ok' | 'sans-base' | 'pas-su' | 'illisible', benefice, borne, base, manque }.
export function margePossible(x, veille, { revente = () => null, contexte = {} } = {}) {
  if (!x || !Number.isSafeInteger(x.prix)) return { etat: 'illisible' };
  const achat = Number.isSafeInteger(x.total) ? x.total : x.prix;
  let base = null;
  if (veille && Number.isSafeInteger(veille.revente) && veille.revente > 0) base = { source: 'toi', montant: veille.revente, site: veille.reventeSite || 'vinted' };
  else {
    const r = veille ? revente(veille.mots) : null;
    if (r === undefined) return { etat: 'pas-su' };
    if (r && Number.isSafeInteger(r.mediane) && r.mediane > 0 && r.n >= MIN_VENTES_MEDIANE) base = { source: 'mediane', montant: r.mediane, n: r.n, modele: r.modele, site: 'vinted' };
  }
  if (!base) return { etat: 'sans-base' };
  const c = calculer({ achat: deux(achat), revente: deux(base.montant), site: base.site }, contexte);
  if (c.etat !== 'ok') return { etat: 'illisible' };
  const manque = [...c.manque];
  if (!Number.isSafeInteger(x.total)) manque.unshift('port pas connu');
  const borne = manque.length ? 'au-plus' : c.borne;
  return { etat: 'ok', benefice: c.benefice, borne, base, frais: c.frais, manque };
}
