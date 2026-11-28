// src/crm/api.js — le CRM eBay côté app (28 nov., lot ebay-crm). Les appels passent par la route
// `api/ebay.js` (actions `crm*`, api/_lib/ebay-crm.js) ; les règles pures viennent du MÊME fichier que
// le serveur (api/_lib/ebay-crm-regle.js) — une seule règle (§5).
import { appelerEbay } from '../ebayRequetes.js';
export { remplir, variablesDe, VARIABLES, AUTOMATISMES, LONGUEUR_EVALUATION, LONGUEUR_MESSAGE, TEXTES_MAX, cleExclusion, SITES_EXCLUSION, acheteurMasque, cleAcheteur } from '../../api/_lib/ebay-crm-regle.js';

const corpsCompte = (compte) => (compte && compte !== 'principal' ? { compte } : {});
export const appelCrm = (action, payload, headers, compte, ecrit = false) => appelerEbay(action, { ...payload, ...corpsCompte(compte) }, headers, { write: ecrit });

// Ouvre la fiche d'un acheteur depuis N'IMPORTE QUEL écran (une vente, un message) : l'hôte
// (`HoteFicheAcheteur`, posé une fois par App.jsx) l'affiche. `ecrire` : ouvre directement le message
// (au sujet de l'annonce `itemId`). Un identifiant illisible ou masqué n'ouvre rien.
export const EVENEMENT_FICHE = 'vrm:fiche-acheteur';
export function ouvrirFicheAcheteur({ acheteur, compte = 'principal', ecrire = null }) {
  if (typeof window === 'undefined' || !acheteur || String(acheteur).includes('*')) return false;
  window.dispatchEvent(new CustomEvent(EVENEMENT_FICHE, { detail: { acheteur: String(acheteur), compte, ecrire } }));
  return true;
}

// Les modèles, lus une fois par compte et par session de page (les conversations les réutilisent).
const memo = new Map();
export async function lireModeles(headers, compte, { neuf = false } = {}) {
  const k = compte || 'principal';
  if (!neuf && memo.has(k)) return memo.get(k);
  const p = appelCrm('crmreglages', {}, headers, compte).then((j) => (j && j.reglages && Array.isArray(j.reglages.modeles) ? j.reglages.modeles : [])).catch(() => null);
  memo.set(k, p);
  const v = await p; if (v === null) memo.delete(k);
  return v;
}
export const oublierModeles = (compte) => memo.delete(compte || 'principal');
