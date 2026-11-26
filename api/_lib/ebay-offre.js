// ════════════════════════════════════════════════════════════════════════════
//  L'OFFRE AUX OBSERVATEURS eBAY : LE PRIX VU ET UNE OFFRE PAR ANNONCE (23 nov.)
//
//  Julien : « fais pareil pour eBay … les messages aux favoris ; tout doit être
//  parfait ». L'offre native d'eBay (`send_offer_to_interested_buyers`) part en
//  POURCENTAGE du prix QU'eBAY TIENT au moment de l'envoi. Avant ce module, la
//  route ne relisait pas ce prix : un prix changé sur eBay depuis l'écran faisait
//  partir une offre à un prix que Julien n'avait pas vu (§2.8 : le prix envoyé
//  est le prix vu). Et rien ne gardait la trace d'une offre envoyée : une 2e
//  pouvait partir pendant les 48 h de la 1re (eBay : une offre par annonce,
//  valable 48 h — page Seller Hub, non mesuré par l'API).
//
//  Module PUR (aucun appel) : la route `api/ebay.js` (action `offre`) l'applique
//  à ce qu'eBay rend (`lireItemRelance`, même lecture que la remise en vente) et
//  au journal `ebay_offres_envoyees{suffixe}`. `scripts/audit-ebay-offre-prix.cjs`
//  l'exécute.
// ════════════════════════════════════════════════════════════════════════════
import { centimes } from './ebay-relance.js';

export const DUREE_OFFRE_MS = 48 * 3600 * 1000;
export const JOURNAL_MAX = 300;
const eur = (c) => (c / 100).toFixed(2).replace('.', ',');
const refus = (status, reason, error, plus) => ({ ok: false, status, body: { ok: false, reason, error, ...(plus || {}) } });

// Le prix de l'offre, en centimes, calculé sur le prix RELU (arrondi au centime).
export const prixOffreCents = (prixCents, remise) => (Number.isInteger(prixCents) && prixCents > 0 && Number.isInteger(remise) && remise > 0 && remise < 100
  ? Math.round(prixCents * (100 - remise) / 100) : null);

// LA RÈGLE. `lu` = `lireItemRelance(xml)` du GetItem ; `demande` = { listingId,
// prixVu, remise } ; `devise` = celle du marché du compte. Rend
// `{ ok:true, prixCents, offreCents }` ou un refus `{ ok:false, status, body }`.
export function jugerOffre(lu, demande, { devise = 'EUR' } = {}) {
  const id = String((demande && demande.listingId) || '');
  if (!lu || !lu.itemId) return refus(503, 'pas-su', "eBay n'a pas rendu cette annonce — rien n'a été envoyé.");
  if (lu.itemId !== id) return refus(409, 'autre-annonce', "eBay a rendu une autre annonce que celle demandée — rien n'a été envoyé.");
  if (!/^Active$/i.test(lu.statut || '')) return refus(409, 'pas-en-ligne', "Cette annonce n'est plus en vente sur eBay — rien n'a été envoyé.");
  if (lu.variantes) return refus(409, 'variantes', 'Une annonce à variantes porte plusieurs articles : fais l\'offre sur eBay — rien n\'a été envoyé.');
  const vu = centimes(demande && demande.prixVu), chez = centimes(lu.prix);
  if (vu == null) return refus(400, 'prix', "Prix vu illisible — rien n'a été envoyé à eBay.");
  if (chez == null) return refus(503, 'pas-su', "eBay n'a pas rendu le prix de l'annonce — rien n'a été envoyé.");
  if (lu.devise && devise && lu.devise !== devise) return refus(409, 'devise', `Annonce en ${lu.devise}, compte en ${devise} : VRM n'envoie pas d'offre.`);
  if (vu !== chez) return refus(409, 'prix-change', `Chez eBay elle est à ${eur(chez)} ${lu.devise || devise}, pas à ${eur(vu)} : l'offre serait calculée sur ce prix — relis la liste avant de recommencer, rien n'a été envoyé.`, { prix: chez / 100 });
  const offre = prixOffreCents(chez, Number(demande && demande.remise));
  if (offre == null || offre < 100) return refus(400, 'remise', "Le prix de l'offre serait sous 1 € — rien n'a été envoyé.");
  return { ok: true, prixCents: chez, offreCents: offre };
}

// Le journal : `{ items: { [listingId]: { at, remise, prixCents, offreCents, envoyees, etat } } }`.
// `etat` : 'envoyee' (eBay a répondu oui) · 'incertaine' (pas de réponse lisible).
const objet = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);
export function offreEnCours(journal, listingId, maintenant = Date.now()) {
  const e = objet(objet(objet(journal) && journal.items) && journal.items[String(listingId)]);
  if (!e || e.etat !== 'envoyee') return null;
  const t = Date.parse(String(e.at || ''));
  if (!Number.isFinite(t)) return null;
  return maintenant - t < DUREE_OFFRE_MS ? { at: new Date(t).toISOString(), jusqua: new Date(t + DUREE_OFFRE_MS).toISOString(), remise: e.remise, offreCents: e.offreCents } : null;
}

// Le modificateur du journal (comparer-et-échanger) : ajoute l'entrée, garde les
// JOURNAL_MAX plus récentes. Ne dépend que de ce qu'il reçoit (rejouable).
export function noterOffre(entree) {
  return (d) => {
    const items = { ...((objet(d) && objet(d.items)) || {}) };
    items[String(entree.listingId)] = { at: entree.at, remise: entree.remise, prixCents: entree.prixCents, offreCents: entree.offreCents, envoyees: entree.envoyees, etat: entree.etat };
    const cles = Object.keys(items).sort((a, b) => String(items[b].at || '').localeCompare(String(items[a].at || '')));
    const garde = {}; for (const k of cles.slice(0, JOURNAL_MAX)) garde[k] = items[k];
    return { ...((objet(d)) || {}), items: garde, capturedAt: entree.at };
  };
}

// Pour l'écran : les offres en cours du journal (lecture seule).
export function offresEnCours(journal, maintenant = Date.now()) {
  const out = {};
  const it = objet(objet(journal) && journal.items) || {};
  for (const k of Object.keys(it)) { const e = offreEnCours(journal, k, maintenant); if (e) out[k] = e; }
  return out;
}
