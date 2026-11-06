// ══════════════════════════════════════════════════════════════════════════════
// « ADRESSE SANS COMPTE » (6 nov., vague 2, point 5)
// ══════════════════════════════════════════════════════════════════════════════
// Des e-mails arrivent chez lui (SES lignes `email_reception_*`, la réception
// rangée à son nom par l'adresse de RÉCEPTION, §5) sur une adresse qu'aucun
// compte Vinted ne porte (`vinted_account_emails`, le registre que lit le
// serveur pour savoir de quel compte vient un e-mail). Mesuré le 5 nov. : 66
// e-mails sur une adresse non reliée ; le 6 nov., trois adresses (138, 9 et 1
// e-mails). Leurs ventes, bordereaux et messages n'ont donc aucun compte.
//
// L'écran le dit et propose DEUX gestes — jamais le compte deviné :
//   · « Relier un compte » : SON clic choisit le compte ; l'écriture passe par le
//     registre existant (`vinted_account_emails`, ligne `main` à son nom — le
//     propriétaire est la LIGNE, jamais un champ du navigateur), avec la règle
//     d'unicité de Comptes liés (`conflitAdresseCompte`) ;
//   · « C'est un compte acheteur » : l'adresse sert à ACHETER (aucun compte
//     vendeur à relier) ; notée dans `vrm_adresses_acheteur` (synchronisée), elle
//     ne se signale plus — réversible.
// Trois états : `undefined` en cours · `null` pas su (une lecture manque) · tableau.
// La boîte collective VRM n'est jamais « une adresse sans compte ».
// Pur : aucune lecture, aucun React.
// ══════════════════════════════════════════════════════════════════════════════
import { normAdresse, estAdresseCollectrice, sansEtiquette } from '../api/_lib/proprietaire-email.js';

export const CLE_ADRESSES_ACHETEUR = 'vrm_adresses_acheteur';

// lignes      : [{ at, adresses: [..] }] — SES lignes de réception (projection) · null · undefined
// declarees   : { adresse: {...} } — son registre de réception (`vrm_email_owners`) · null
// comptesEmails : { uid: adresse } — `vinted_account_emails` · null
// acheteurs   : { adresse: { at } } — `vrm_adresses_acheteur`
export function adressesSansCompte({ lignes, declarees, comptesEmails, acheteurs } = {}) {
  if (lignes === undefined || declarees === undefined || comptesEmails === undefined) return undefined;
  if (!Array.isArray(lignes) || declarees === null || comptesEmails === null || typeof comptesEmails !== 'object') return null;
  const decl = new Set(Object.keys(declarees || {}).map(normAdresse).filter(Boolean));
  // L'adresse SUIVIE : la déclarée si elle l'est (avec ou sans « +étiquette »), sinon elle-même.
  const suivie = (a) => {
    const n = normAdresse(a);
    if (!n || !n.includes('@') || estAdresseCollectrice(n)) return '';
    if (decl.has(n)) return n;
    const s = sansEtiquette(n);
    return decl.has(s) ? s : n;
  };
  const reliees = new Set(Object.values(comptesEmails).map(normAdresse).filter(Boolean));
  const ach = new Set(Object.keys(acheteurs && typeof acheteurs === 'object' ? acheteurs : {}).map(normAdresse).filter(Boolean));
  const par = new Map();
  for (const l of lignes) {
    const vues = new Set();
    for (const a of (Array.isArray(l && l.adresses) ? l.adresses : [])) {
      const s = suivie(a);
      if (!s || vues.has(s)) continue;
      vues.add(s);
      const e = par.get(s) || { adresse: s, n: 0, dernier: '' };
      e.n += 1;
      const at = String((l && l.at) || '');
      if (at > e.dernier) e.dernier = at;
      par.set(s, e);
    }
  }
  return [...par.values()]
    .filter((e) => !reliees.has(e.adresse) && !reliees.has(sansEtiquette(e.adresse)) && !ach.has(e.adresse))
    .sort((a, b) => b.n - a.n || (a.dernier < b.dernier ? 1 : a.dernier > b.dernier ? -1 : 0));
}

// Les comptes Vinted qu'on PEUT relier à une adresse : ceux qui n'en ont aucune
// (relier un compte qui en a déjà une la remplacerait — ça se fait dans Comptes
// liés → Gérer, à la main, jamais d'ici).
export function comptesSansAdresse(comptes, comptesEmails) {
  const m = comptesEmails && typeof comptesEmails === 'object' ? comptesEmails : {};
  return (Array.isArray(comptes) ? comptes : []).filter((a) => a && a.vinted_user_id != null && !normAdresse(m[String(a.vinted_user_id)]));
}

// L'écriture du registre, sur SON clic : rend la nouvelle carte, ou `null` si
// l'adresse est déjà portée par un AUTRE compte (une adresse = un compte) ou si
// le compte en a déjà une (rien n'est remplacé d'ici).
export function relierAdresse(comptesEmails, uid, adresse) {
  const m = comptesEmails && typeof comptesEmails === 'object' ? comptesEmails : {};
  const a = normAdresse(adresse), u = String(uid == null ? '' : uid);
  if (!a || !a.includes('@') || !u) return null;
  if (normAdresse(m[u])) return null;
  if (Object.keys(m).some((k) => k !== u && normAdresse(m[k]) === a)) return null;
  return { ...m, [u]: a };
}
