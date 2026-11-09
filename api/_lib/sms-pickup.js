// ─────────────────────────────────────────────────────────────────────────────
// LES SMS DU RÉSEAU PICKUP (« Pickup », colis Vinted) — 9 nov., lecteur strict.
//
// Forme RÉELLE (captures iPhone de Julien, 9 nov. ; relais et jeton inventés ici) :
//   « RAPPEL-Votre colis VINTED est arrivé au relais TABAC DU PORT. Présentez
//     Pass: http://n.pkup.fr/Ab3dEf9Gh »
// ⚠️ AUCUN n° de suivi, AUCUN code : le relais et un lien-jeton (« Pass », le QR de
//    retrait à présenter au relais). Cinq SMS, cinq jetons, même relais : peut-être
//    cinq colis, peut-être cinq rappels du même — ON NE DEVINE PAS.
//    ⇒ ce n'est JAMAIS un colis « à retirer » rattaché à un achat : une INFORMATION
//      datée (`vrm_sms_infos`, api/_lib/sms-infos.js), une par JETON distinct (la
//      seule identité), « Pickup : un colis Vinted au relais X » ; le lien n'est
//      ouvert que sur SON clic (« Présenter le Pass ») — c'est un passe de retrait.
//    Rattachement à un achat seulement par une identité existante ou par SON clic.
// ⚠️ LE VENDEUR EST CELUI DU JETON VRM (api/_lib/sms-mondialrelay.js), jamais le texte.
// ─────────────────────────────────────────────────────────────────────────────
import { plat, AUTHENTIFICATION } from './sms-commun.js';

export const MARQUE_PICKUP = /\bpickup\b|pkup\.fr/i;
const ARRIVE = /(RAPPEL\s*[-–:]?\s*)?Votre\s+colis\s+([A-Za-z0-9 ]{2,20}?)\s+est\s+arriv[ée]e?\s+au\s+relais\s+(.{2,60}?)\s*\.\s*Pr[ée]sentez\s+(?:votre\s+|le\s+)?Pass\s*:?\s*(https?:\/\/[a-z0-9.-]*pkup\.fr\/([A-Za-z0-9_-]{4,40}))/i;

const lieuPropre = (s) => { const l = plat(s).replace(/[\s,;:–-]+$/, ''); return l.length >= 2 && l.length <= 60 && !/https?:|www\.|@/i.test(l) ? l : ''; };

// Rend { type: 'pickup', relais, pass, jeton, plateforme, rappel } | { type: 'inconnu' } | { type: 'ignore', raison }.
export function lireSmsPickup({ texte = '', expediteur = '' } = {}) {
  const t = plat(texte);
  if (!t) return { type: 'ignore', raison: 'vide' };
  if (AUTHENTIFICATION.test(t)) return { type: 'ignore', raison: 'authentification' };
  if (!MARQUE_PICKUP.test(t) && !MARQUE_PICKUP.test(plat(expediteur))) return { type: 'ignore', raison: 'pas-pickup' };
  const m = ARRIVE.exec(t);
  if (!m) return { type: 'inconnu' };
  const relais = lieuPropre(m[3]);
  if (!relais) return { type: 'inconnu' };
  return { type: 'pickup', relais, pass: m[4], jeton: m[5], plateforme: plat(m[2]).toUpperCase(), rappel: !!m[1] };
}
export const cleInfoPickup = (lu) => `pickup|${lu.jeton}`;
