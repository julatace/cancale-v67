// ── LA FORME D'UN CODE DE RETRAIT (19 nov., retraits parfaits) ───────────────
// Julien : « l'app doit être en mesure de reconnaître absolument tous les types de code de retrait ».
// Une règle, lue par la route des e-mails (api/email-inbound.js), la relecture serveur
// (api/_lib/suivi-colis.js, api/_lib/commande-colis.js) et l'app (src/App.jsx `codeRetrait`,
// src/retraitQr.js) — §11. Avant, chacun portait `^[A-Z]{0,2}\d{3,10}$` : un code de casier ou de
// Relais Colis MÊLANT lettres et chiffres (« 6A4B2C ») était lu par personne, et un code écrit en
// groupes (« 731 204 ») non plus.
//   · la forme d'avant, inchangée : 0 à 2 lettres puis 3 à 10 chiffres (Mondial Relay, Chronopost,
//     Vinted Go « B12345 ») ;
//   · EN PLUS un code alphanumérique de 5 à 10 signes qui porte AU MOINS deux chiffres ET au moins une
//     lettre (« 6A4B2C », « K7P2Q9 ») — jamais un mot (« suivant » n'a aucun chiffre), jamais un n° de
//     suivi (13 signes et plus), jamais un code postal (que des chiffres, déjà jugé par `codeImpossible`).
// `normaliserCode` retire les espaces, tirets et points d'un code écrit en groupes, en majuscules.
const FORME_SIMPLE = /^[A-Z]{0,2}\d{3,10}$/;
// Sans les lettres O et I (prises pour 0 et 1 : « 12O456 » reste « code pas lu », mieux vaut un blanc qu'un faux).
const FORME_MELEE = /^(?=(?:[A-HJ-NP-Z]*\d){2})(?=\d*[A-HJ-NP-Z])[A-HJ-NP-Z0-9]{5,10}$/;
export const normaliserCode = (v) => String(v == null ? '' : v).trim().toUpperCase().replace(/[\s .\-–]+/g, '');
export const estFormeCodeRetrait = (v) => { const c = String(v == null ? '' : v).trim(); return FORME_SIMPLE.test(c) || FORME_MELEE.test(c); };
// Le code s'il a la forme d'un code de retrait (tel qu'écrit, déjà normalisé), sinon ''.
export const codeDeForme = (v) => { const c = String(v == null ? '' : v).trim(); return estFormeCodeRetrait(c) ? c : ''; };
