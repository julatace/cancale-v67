// ─────────────────────────────────────────────────────────────────────────────
// LES TRANSPORTEURS QUE VRM NE LIT PAS ENCORE (12 nov.) — la règle PURE prête pour
// le SERVEUR (décision du 12 nov. : jamais par l'extension), et la raison écrite pour chacun.
//
// Julien : « tout doit être automatique sans erreur possible ». Mondial Relay, Chronopost
// (Shop2Shop et Pickup compris) et Vinted Go sont lus par le serveur
// (`LECTURE_SERVEUR_TRANSP`, api/_lib/transporteurs.js). Pour Colissimo / La Poste, DPD, UPS,
// GLS et Relais Colis, AUCUNE réponse n'a été MESURÉE (le conteneur de développement ne joint
// pas leurs sites) : on n'écrit pas de lecteur de page inventé. (13 nov., lot 89 : Colissimo / La Poste et UPS
// ont eu une lecture serveur par API officielle à clé, RETIRÉE le 16 nov. sur décision de Julien ; DPD et GLS restent à mesurer.)
// Ce module fixe donc :
//   · `VOIES_A_OUVRIR` : par transporteur, la page publique à lire, si une clé est exigée
//     (refusée, §2.9 : jamais la clé de Julien pour les autres) et qui doit la lire ;
//   · `etatDepuisEvenements` : la règle qui tranche l'état à partir des ÉVÉNEMENTS que
//     l'extension rapportera tels qu'écrits sur la page ({ date ISO, texte }), avec les mots
//     déjà mesurés sur les e-mails des transporteurs. La ligne rendue a la forme `transp_*`
//     que l'app lit déjà (`fusionTransporteur` : le transporteur tranche).
// « Pas su ne vaut pas oui » : aucun événement, ou des textes non reconnus ⇒ `inconnu`.
// ─────────────────────────────────────────────────────────────────────────────
import { normaliserSuivi } from './etat-colis-email.js';

// (12 nov., Julien : « on ne fait pas avec l'extension ») TOUT CÔTÉ SERVEUR. `voie` : ce que le serveur peut lire ;
// `geste` : ce qu'il faut faire une fois (jamais une clé collée dans une conversation ; jamais la clé de Julien
// pour les autres vendeurs, §2.9 ; et depuis le 16 nov., aucun suivi par clé du tout).
export const VOIES_A_OUVRIR = Object.freeze({
  // (16 nov.) Colissimo et UPS : la lecture par clé (lot 89 du 13 nov., puis la clé du vendeur) est RETIRÉE sur
  // décision de Julien — aucun appel à La Poste ni à UPS, aucun écran qui propose une clé.
  colissimo: { nom: 'Colissimo / La Poste', page: 'https://www.laposte.fr/outils/suivre-vos-envois?code={n}', cle: 'aucune', voie: 'aucune voie serveur (16 nov., décision de Julien : « on laisse tomber », aucun suivi par clé) : suivi Vinted et e-mails seulement ; la page publique s’ouvre seulement par le lien « Suivre », sur le clic du vendeur', geste: 'aucun' },
  // (13 nov., lot 89) DPD et GLS : JAMAIS MESURÉS. Le conteneur ne joint pas leurs hôtes, et le bac à sable
  // Vercel (la voie de mesure du 24 oct.) est épuisé jusqu'au 1er déc. (plan Hobby, 402). Aucun lecteur de
  // page inventé : e-mails et SMS seulement. Leur n° ne se reconnaît pas à sa forme (DPD : 14 chiffres comme
  // Chronopost ; GLS : 11-12 chiffres comme Vinted Go) — seulement quand l'e-mail nomme le transporteur.
  // (16 nov., lot transporteurs-suivi) Aucune API OFFICIELLE de suivi gratuite et ouverte à un particulier n'est documentée :
  // les services web de DPD (« DPD Web Services ») et de GLS (« ShipIT / Track & Trace ») sont réservés à leurs clients
  // expéditeurs sous contrat ; leurs pages publiques ne sont pas une API documentée et n'ont jamais été mesurées. Rien n'est
  // branché (on n'invente pas un lecteur de page) : e-mails et SMS seulement, et la ligne dit « suivi non lu chez ce transporteur ».
  dpd: { nom: 'DPD', page: 'https://tracking.dpd.de/rest/plc/fr_FR/{n}', cle: 'aucune annoncée (service de la page de suivi publique)', voie: 'serveur, réponse jamais mesurée : e-mails et SMS seulement en attendant', geste: 'mesurer la réponse depuis un bac à sable Vercel (dub1, User-Agent honnête) après le 1er déc., vérifier les conditions d’utilisation, puis brancher la lecture' },
  ups: { nom: 'UPS', page: 'https://www.ups.com/track?loc=fr_FR&tracknum={n}', cle: 'aucune', voie: 'aucune voie serveur (16 nov., décision de Julien : « on laisse tomber », aucun suivi par clé) : suivi Vinted et e-mails seulement ; la page publique s’ouvre seulement par le lien « Suivre », sur le clic du vendeur', geste: 'aucun' },
  gls: { nom: 'GLS', page: 'https://gls-group.eu/app/service/open/rest/FR/fr/rstt001?match={n}', cle: 'aucune (service de la page de suivi publique)', voie: 'serveur, réponse jamais mesurée : e-mails et SMS seulement en attendant', geste: 'mesurer la réponse depuis un bac à sable Vercel (dub1, User-Agent honnête) après le 1er déc., vérifier les conditions d’utilisation, puis brancher la lecture' },
  relaiscolis: { nom: 'Relais Colis', page: 'https://www.relaiscolis.com/suivi-de-colis/', cle: 'aucune API publique connue ; formulaire de la page', voie: 'aucune voie serveur sûre connue : e-mails et SMS seulement', geste: 'aucun pour l’instant (raison : pas de service de suivi public documenté)' },
  shop2shop: { nom: 'Shop2Shop', page: 'https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLT={n}', cle: 'aucune', voie: 'serveur (route Chronopost, déjà lue)', geste: 'aucun' },
});

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();
// Les mots MESURÉS sur les e-mails et pages des transporteurs déjà lus (api/_lib/etat-colis-email.js,
// api/_lib/transporteurs.js). Une CONDITION (« si… », « au cas où… ») ne constate rien.
const CONDITION = /\b(?:si|s'il|au cas ou|lorsque|quand|des que)\b/;
// Le FUTUR non plus (« sera livré demain », « livraison prévue ») : seul un constat tranche.
const FUTUR = /\b(?:sera|seront|va etre|vont etre|prevue?|estimee?|demain)\b/;
const RETIRE = /\b(?:livre|remis au destinataire|remis en mains propres|a ete retire|colis retire|recupere par le destinataire|distribue)\b/;
const RETOUR = /\b(?:retour(?:ne)? (?:a|vers) l'expediteur|renvoye a l'expediteur|retour expediteur|reexpedie a l'expediteur)\b/;
const DISPO = /\b(?:disponible (?:en|au|dans)|a retirer|vous attend|t'attend|depose (?:en|au|dans) (?:point|relais|casier|consigne|locker)|arrive (?:en|au|dans) (?:point|relais|bureau|casier|consigne|locker))\b/;
const ROUTE = /\b(?:en cours d'acheminement|en transit|pris en charge|en cours de livraison|en route|arrive sur (?:le|notre) site|en preparation|tri)\b/;

// evenements : [{ date: 'ISO', texte: 'tel qu'écrit sur la page' }] — le plus récent qui dit un état tranche.
export function etatDepuisEvenements({ carrier = '', suivi = '', evenements = [] } = {}) {
  const n = normaliserSuivi(suivi);
  const ev = (Array.isArray(evenements) ? evenements : [])
    .map((e) => ({ ms: Date.parse(String(e && e.date || '')), t: norm(e && e.texte) }))
    .filter((e) => Number.isFinite(e.ms) && e.t)
    .sort((a, b) => b.ms - a.ms);
  for (const e of ev) {
    if (CONDITION.test(e.t) || FUTUR.test(e.t)) continue;
    const etat = RETOUR.test(e.t) ? 'retour_expediteur' : RETIRE.test(e.t) ? 'retire' : DISPO.test(e.t) ? 'disponible' : ROUTE.test(e.t) ? 'en_route' : null;
    if (etat) return { suivi: n, carrier: String(carrier || ''), etat, etatAt: new Date(e.ms).toISOString(), fini: etat === 'retire' || etat === 'retour_expediteur' };
  }
  return { suivi: n, carrier: String(carrier || ''), etat: 'inconnu', etatAt: null, fini: false };
}
