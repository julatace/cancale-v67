// ── MODE AUTOMATIQUE DES MESSAGES AUX FAVORIS (2 novembre 2026) ─────────────
// Julien (« Oui, mode auto ») : comme Vintex et Bleam, quand quelqu'un met une
// de ses annonces en favori, VRM lui écrit tout seul son message (+ la vraie
// offre Vinted de ses réglages). « Zéro problème avec Vinted » : délais
// aléatoires et beaucoup de garde-fous, tous RÉGLABLES, mode ÉTEINT par défaut.
//
// Ce fichier porte les règles PURES, les mêmes pour le serveur (qui décide :
// api/_lib/favoris-auto.js, api/_lib/favoris-file.js) et pour l'app (qui les
// affiche). Rien ici ne lit ni n'écrit quoi que ce soit.
//
// Garde-fous (sa liste du 2 nov.) :
//   1. jamais une conversation qui existe déjà avec cette personne, jamais une
//      personne déjà contactée dans les 30 derniers jours (tous articles) ;
//   2. un seul message par personne et par article, pour toujours ;
//   3. jamais une paire réservée, vendue, en pause, masquée ou vendue ailleurs ;
//   4. une attente tirée au hasard après le favori (10–60 min par défaut) ;
//   5. des plages horaires (9 h–21 h, heure de Paris) et des jours au choix ;
//   6. 30 messages / 24 h glissantes et 12 / heure par compte Vinted, EN PLUS du
//      plafond d'actions de l'extension ; montée progressive 10 → 20 → réglage ;
//   7. pause de 24 h du mode auto sur un compte dès un frein de Vinted ;
//   8. seulement si l'extension a un onglet vinted.fr ouvert sur CE compte ;
//   9. un journal visible et un bouton Stop immédiat ;
//  10. messages variés ({username}, {a|b} — src/favorisMessage.js).

import { motsVendeur } from './profilVendeur.js';
export const AUTO_DEFAUT = Object.freeze({ actif: false, attenteMin: 10, attenteMax: 60, heureDebut: 9, heureFin: 21, jours: [1, 2, 3, 4, 5, 6, 7], parJour: 30, parHeure: 12 });
export const AUTO_JOUR_MS = 24 * 3600 * 1000;
export const AUTO_HEURE_MS = 3600 * 1000;
export const AUTO_PAUSE_MS = 24 * 3600 * 1000;
// Un favori plus vieux que ça n'est plus « nouveau » : jamais d'arriéré en rafale.
export const AUTO_FAVORI_MAX_MS = 72 * 3600 * 1000;
// 30 jours : une personne déjà contactée (tous articles) n'est pas recontactée.
export const AUTO_RECONTACT_MS = 30 * 24 * 3600 * 1000;
// Entre deux messages automatiques d'un même compte : 3 à 12 min, tiré au hasard
// (déterministe sur le jeton : un comparer-et-échanger rejoué tire le même).
export const AUTO_ECART_MS = [3 * 60000, 12 * 60000];
// Les réponses qui disent « ralentis » ou « robot » : le mode auto se met en
// pause 24 h sur ce compte (dite dans l'app avec l'heure de reprise).
export const AUTO_FREINS = ['pause_vinted', 'vinted_frein', 'vinted_robot'];
// Refus survenus AVANT toute écriture chez Vinted : ce favori peut être retenté
// (rien n'est parti). Tout autre résultat compte pour « déjà contacté », à vie.
export const AUTO_AVANT_ECRITURE = ['onglet_vinted', 'compte_vinted_absent', 'compte_vinted_different', 'quota_extension', 'extension_indisponible', 'session_extension', 'autorisation_expiree', 'article_vendu'];
export const JOURS_AUTO = [[1, 'Lun'], [2, 'Mar'], [3, 'Mer'], [4, 'Jeu'], [5, 'Ven'], [6, 'Sam'], [7, 'Dim']];

const entier = (v, min, max, msg) => {
  const s = String(v ?? '').trim();
  if (!/^\d{1,5}$/.test(s) || Number(s) < min || Number(s) > max) throw Error(msg);
  return Number(s);
};
// Les réglages du mode auto, validés (serveur ET app). `actif` ne vaut vrai que
// s'il est exactement `true`.
export function validerAutoFavoris(a = {}) {
  if (!a || typeof a !== 'object' || Array.isArray(a)) throw Error('Réglages du mode automatique invalides.');
  const v = { ...AUTO_DEFAUT, ...a };
  const attenteMin = entier(v.attenteMin, 5, 1440, 'Attente après le favori : un nombre entier de minutes, au moins 5.');
  const attenteMax = entier(v.attenteMax, 5, 1440, 'Attente maximale : un nombre entier de minutes, 1 440 au plus.');
  if (attenteMax < attenteMin) throw Error('L’attente maximale doit être au moins égale à l’attente minimale.');
  const heureDebut = entier(v.heureDebut, 0, 23, 'Heure de début : entre 0 et 23.');
  const heureFin = entier(v.heureFin, 1, 24, 'Heure de fin : entre 1 et 24.');
  if (heureFin <= heureDebut) throw Error('L’heure de fin doit être après l’heure de début.');
  if (!Array.isArray(v.jours) || !v.jours.length || v.jours.length > 7) throw Error('Choisis au moins un jour.');
  const jours = [...new Set(v.jours.map((j) => entier(j, 1, 7, 'Jour inconnu.')))].sort((x, y) => x - y);
  const parJour = entier(v.parJour, 1, 50, 'Messages par 24 h : entre 1 et 50.');
  const parHeure = entier(v.parHeure, 1, 20, 'Messages par heure : entre 1 et 20.');
  if (parHeure > parJour) throw Error('Le nombre par heure ne peut pas dépasser le nombre par 24 h.');
  return { version: 1, actif: v.actif === true, attenteMin, attenteMax, heureDebut, heureFin, jours, parJour, parHeure };
}

// L'heure et le jour (1 = lundi … 7 = dimanche) à Paris, été comme hiver.
const FMT_PARIS = (() => { try { return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', weekday: 'short', hour: 'numeric', hourCycle: 'h23' }); } catch (_) { return null; } })();
const JOURS_EN = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
export function heureParis(maintenant) {
  if (!FMT_PARIS || !Number.isFinite(maintenant)) return null;
  const p = FMT_PARIS.formatToParts(new Date(maintenant));
  const h = Number(p.find((x) => x.type === 'hour')?.value), j = JOURS_EN[p.find((x) => x.type === 'weekday')?.value];
  return Number.isInteger(h) && j ? { heure: h, jour: j } : null;
}
// Dans la plage choisie ? « Pas su » (horloge illisible) ⇒ non.
export function dansPlageAuto(reglages, maintenant) {
  const p = heureParis(maintenant);
  if (!p || !reglages) return false;
  return reglages.jours.includes(p.jour) && p.heure >= reglages.heureDebut && p.heure < reglages.heureFin;
}
// Montée progressive : 10 par jour la 1re semaine après l'allumage, 20 la 2e,
// puis le réglage (jamais plus que le réglage).
export function limiteJourAuto(reglages, allumeLe, maintenant) {
  const n = Number(reglages?.parJour) || 0;
  const age = Number(maintenant) - Number(allumeLe);
  if (!Number.isFinite(age) || age < 7 * AUTO_JOUR_MS) return Math.min(10, n);
  if (age < 14 * AUTO_JOUR_MS) return Math.min(20, n);
  return n;
}
// Empreinte FNV-1a sur 32 bits, ramenée à [0, 1).
export function hasardAuto(graine) {
  let h = 0x811c9dc5;
  for (const c of String(graine || '')) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0;
  // Brassage final (fmix32) : sans lui, deux identifiants voisins (« n1 », « n2 »)
  // tiraient presque la même attente (mesuré : 16 à 17 min pour 8 favoris).
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0; h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0; h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
// L'attente après le favori, en ms, tirée entre le minimum et le maximum
// (déterministe sur le favori : le même favori garde la même heure prévue).
export function attenteFavoriMs(notificationId, reglages) {
  const a = Number(reglages?.attenteMin), b = Number(reglages?.attenteMax);
  return Math.round((a + hasardAuto('attente:' + notificationId) * (b - a)) * 60000);
}
export function ecartAutoMs(graine) {
  return Math.round(AUTO_ECART_MS[0] + hasardAuto('ecart:' + graine) * (AUTO_ECART_MS[1] - AUTO_ECART_MS[0]));
}

// Pourquoi une annonce ne peut PAS recevoir un message automatique — `null` si
// elle le peut. `dressing` = la ligne `harvest_{uid}_listings` projetée
// ({ cap, pg, items }) ; `garde` = `vinted_offres_garde` (src/offresGarde.js).
// « Pas su » ne vaut pas « oui » : dressing absent, ancien (> 24 h) ou partiel ⇒
// raison GLOBALE (rien ne part, aucun favori n'est écarté pour de bon).
export const AUTO_DRESSING_MAX_MS = 24 * 3600 * 1000;
export function etatDressingAuto(dressing, maintenant) {
  if (!dressing || !Array.isArray(dressing.items)) return 'dressing_absent';
  const cap = Date.parse(dressing.cap || '');
  if (!Number.isFinite(cap) || maintenant - cap > AUTO_DRESSING_MAX_MS || cap > maintenant + 120000) return 'dressing_ancien';
  const t = Number(dressing.pg?.total_entries);
  if (dressing.pg?.total_entries == null || !Number.isFinite(t) || dressing.items.length < t) return 'dressing_partiel';
  return null;
}
export function etatAnnonceAuto(itemId, dressing, raisonGarde) {
  if (raisonGarde === 'vendue-ailleurs') return 'vendue';
  const it = dressing.items.find((x) => x && String(x.id) === String(itemId));
  if (!it) return 'annonce_absente';
  if (it.is_closed) return /sold/i.test(String(it.item_closing_action || '')) ? 'vendue' : 'fermee';
  if (it.is_draft) return 'fermee';
  if (it.is_hidden) return 'en_pause';
  if (it.is_reserved) return 'reservee';
  return null;
}

// Ce que l'écran dit pour chaque raison (une phrase, et le geste quand il y en a un).
export const RAISONS_AUTO = {
  envoye: 'Message envoyé.',
  en_file: 'Message prêt : il part dans un instant.',
  ignore: 'Conversation déjà commencée sur Vinted : rien envoyé.',
  incertain: 'Réponse incertaine de Vinted : vérifie la conversation sur Vinted, puis « J’ai vérifié » dans la file. Le mode auto attend.',
  refuse: 'Interrompu : rien envoyé.',
  conversation_existante: 'Une conversation existe déjà avec cette personne : VRM n’écrit pas.',
  contacte_30j: 'Personne déjà contactée ces 30 derniers jours : VRM n’écrit pas.',
  deja_contacte: 'Déjà contactée pour cet article : un seul message, pour toujours.',
  get vendue() { return `${motsVendeur().Nom} vendu${motsVendeur().e} (ici ou ailleurs) : aucun message.`; },
  get reservee() { return `${motsVendeur().Nom} réservé${motsVendeur().e} : aucun message.`; },
  en_pause: 'Annonce en pause ou masquée : aucun message.',
  fermee: 'Annonce plus en ligne : aucun message.',
  annonce_absente: 'Annonce absente de ton dressing lu : aucun message.',
  destinataire_non_prouve: 'VRM ne sait pas encore à qui écrire pour ce favori (identité non prouvée). Ouvre un favori depuis la cloche de Vinted pour qu’il apprenne.',
  expire: 'Favori trop ancien (plus de 3 jours) : laissé de côté.',
  essais_epuises: 'Pas pu partir après deux essais (rien n’est parti chez Vinted) : laissé de côté, VRM passe au suivant.',
  offre_refusee: 'Vinted a refusé l’offre : le message n’est pas parti, favori laissé de côté.',
  offre_prix_inconnu: 'Prix de l’annonce illisible : ni offre ni message, favori laissé de côté.',
  attente: 'En attente : le message partira après le délai tiré au hasard.',
  vinted_frein: 'Vinted a demandé de ralentir : mode auto en pause 24 h sur ce compte.',
  vinted_robot: 'Vinted a parlé d’activité automatisée (ou d’un captcha) : mode auto en pause 24 h sur ce compte.',
  pause_vinted: 'Vinted demande de ralentir : mode auto en pause 24 h sur ce compte.',
};
// (2 nov., 13 h — Julien : « il doit pouvoir régler tous les problèmes lui-même, ou
// demander s'il en a un ») Le mode auto ne BOUCLE JAMAIS : un favori qui n'a pas pu
// partir avant toute écriture chez Vinted est retenté au plus AUTO_ESSAIS fois en
// tout, puis laissé de côté avec sa raison. Et quand un geste de Julien débloquerait
// la situation, VRM le lui DEMANDE une fois (dans l'app et par notification), en une
// phrase avec le geste. La demande tombe d'elle-même quand le problème est réglé.
// (5 nov., revue) Ces phrases partent aussi du SERVEUR, en notification sur le
// téléphone (api/_lib/favoris.js) : elles ne nomment jamais un navigateur —
// « Ce navigateur est connecté… » lu sur l'iPhone désignait le mauvais. Le
// navigateur qui agit est celui où est l'extension VRM.
export const AUTO_ESSAIS = 2;
export const DEMANDES_AUTO = {
  destinataire_non_prouve: 'Pour écrire aux nouveaux favoris, VRM doit apprendre à qui écrire : sur vinted.fr, ouvre UN favori depuis la cloche (connecté sur ce compte), attends sa page de message, puis reviens.',
  onglet_vinted: 'Ouvre vinted.fr dans le navigateur où est l’extension VRM, connecté sur ce compte, et laisse l’onglet ouvert : les messages automatiques partent de là.',
  compte_vinted_absent: 'Connecte-toi à Vinted avec ce compte dans le navigateur où est l’extension VRM : les messages automatiques partent de l’onglet de CE compte.',
  compte_vinted_different: 'Le navigateur où est l’extension VRM est connecté à un autre compte Vinted : passe sur ce compte dans l’onglet vinted.fr.',
  extension_indisponible: 'L’extension ne répond pas : recharge-la dans le navigateur où elle est installée, puis recharge VRM.',
  extension_version: 'Installe l’extension 5.309 (Paramètres → Extension), puis recharge-la (⟳) : le mode automatique en a besoin.',
  session_extension: 'Reconnecte l’extension à ton compte VRM (ouvre l’extension → Connecter).',
  get garde_absente() { return `VRM n’a pas pu vérifier ${motsVendeur().tes} vendu${motsVendeur().e}s ailleurs : ouvre l’écran Annonces de VRM une fois.`; },
  get dressing_absent() { return `Ouvre ton dressing sur vinted.fr avec ce compte : VRM doit voir ${motsVendeur().quelles} sont en vente.`; },
  dressing_ancien: 'Ouvre ton dressing sur vinted.fr avec ce compte : sa dernière lecture a plus de 24 h.',
  dressing_partiel: 'Ouvre ton dressing sur vinted.fr et fais-le défiler jusqu’au bout : VRM n’en a lu qu’une partie.',
  boite_ancienne: 'Ouvre ta messagerie sur vinted.fr avec ce compte : VRM vérifie que personne n’est déjà en conversation avec toi.',
  capture: 'Ouvre la cloche de Vinted avec ce compte : VRM n’a pas encore vu ses favoris.',
  reglages: 'Enregistre ton message : Envoyer un message aux favoris → 2. Message → Enregistrer sans envoyer.',
  a_verifier: 'Un message est « à vérifier » : regarde la conversation sur Vinted, puis « J’ai vérifié » dans la file des favoris. Le mode auto attend.',
};
// Les états de la file qui DEMANDENT un geste (les autres attendent seuls).
export const ETATS_DEMANDE = ['destinataire_non_prouve', 'garde_absente', 'dressing_absent', 'dressing_ancien', 'dressing_partiel', 'boite_ancienne', 'capture', 'reglages', 'a_verifier'];
// Les refus d'un envoi automatique qui DEMANDENT un geste.
export const RAISONS_DEMANDE = ['onglet_vinted', 'compte_vinted_absent', 'compte_vinted_different', 'extension_indisponible', 'session_extension'];
// L'état du mode, en une phrase et un geste (écran « Mode automatique »).
export const ETATS_AUTO = {
  eteint: 'Éteint : aucun message ne part tout seul.',
  pause: 'En pause après un frein de Vinted.',
  hors_horaires: 'Hors de tes horaires : reprise à la prochaine plage.',
  quota_heure: 'Limite de l’heure atteinte : reprise dans moins d’une heure.',
  quota_jour: 'Limite des 24 h atteinte : reprise quand un message de la veille sort du compte.',
  espacement: 'Pause entre deux messages (tirée au hasard).',
  a_verifier: 'Un envoi est à vérifier sur Vinted : le mode auto attend ta vérification (file des favoris → « J’ai vérifié »).',
  occupe: 'Un envoi est en cours.',
  pret: 'Un message part dans un instant.',
  veille: 'Allumé : en attente d’un nouveau favori.',
  attente_favori: 'Allumé : un favori attend son délai avant le message.',
  get garde_absente() { return `Rien ne part : VRM n’a pas pu vérifier ${motsVendeur().tes} vendu${motsVendeur().e}s ailleurs. Ouvre l’écran Annonces de VRM (il refait la vérification).`; },
  dressing_absent: 'Rien ne part : ton dressing Vinted n’a pas été lu. Ouvre ton dressing sur vinted.fr avec ce compte.',
  dressing_ancien: 'Rien ne part : ton dressing a été lu il y a plus de 24 h. Ouvre ton dressing sur vinted.fr avec ce compte.',
  dressing_partiel: 'Rien ne part : ton dressing lu n’est pas complet. Ouvre ton dressing sur vinted.fr et fais-le défiler jusqu’au bout.',
  boite_ancienne: 'Rien ne part : tes conversations Vinted n’ont pas été relues depuis 24 h. Ouvre ta messagerie sur vinted.fr avec ce compte.',
  capture: 'Rien ne part : les favoris de ce compte n’ont pas été lus. Ouvre la cloche de Vinted avec ce compte.',
  destinataire_non_prouve: 'Rien ne part : VRM ne sait pas encore à qui écrire sur ce compte. Ouvre un favori depuis la cloche de Vinted.',
  extension: 'Un message est prêt, mais l’extension ne peut pas l’envoyer maintenant (voir le geste demandé).',
  reglages: 'Rien ne part : enregistre d’abord ton message (Envoyer un message aux favoris → 2. Message → Enregistrer).',
  lecture: 'La base VRM n’a pas répondu : rien n’est parti, nouvel essai dans quelques minutes.',
};
