// ════════════════════════════════════════════════════════════════════════════
//  FAVORIS — LA LISTE, LE MESSAGE ET L'ENVOI (27 nov., tests-unitaires-verts)
//
//  Jusqu'au 20 nov., ce test montait l'écran React `src/FavorisVinted.jsx` (résumé, fenêtre « 1. Choisir · 2. Message ·
//  3. Envoi », réglages enregistrés par l'écran). Il a été RETIRÉ (95ce6ea4d, « Ateliers d'action retirés » ; décision de
//  Julien du 20 nov. : toute action de plateforme se fait dans le panneau de l'extension —
//  docs/passation/2026-11-20-actions-extension.md). Le test restait rouge (« Could not resolve ./src/FavorisVinted.jsx »)
//  et n'était lancé par aucun workflow. Même méthode que favoris-historique-interface.cjs : chaque garantie est reportée
//  sur le contrôle qui la juge AUJOURD'HUI sur le chemin qui existe (panneau `vrm-badge.js`, `cochablesApercu`/`lancer`
//  du vrai background.js, file serveur, règle du message `src/favorisMessage.js`) — le juge est LANCÉ, son contrôle nommé
//  doit être VERT (scripts/tests/_garanties-reportees.cjs). Celles dont l'objet est parti avec l'écran sont « retirées »,
//  avec leur raison. Tout est synthétique.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const { juger, JUGES_FAVORIS } = require('./_garanties-reportees.cjs');
const ECRAN = 'objet retiré avec src/FavorisVinted.jsx (20 nov.)';
const JUGES = { ...JUGES_FAVORIS,
  message: { args: ['--test', 'scripts/tests/favoris-message.test.mjs'] },     // la règle du message et de l'offre (app = extension)
  reglages: { args: ['--test', 'scripts/tests/reglages-favoris.test.mjs'] },   // les réglages du compte (message, taux, rythme)
};

juger('favoris-vinted-interface', [
  { garantie: 'pas de lecture au montage', ou: [['file', /la lecture cible exactement une ligne et son propriétaire, sans écriture/]] },
  { garantie: 'l’écran ne garde qu’un résumé : la liste vit dans la fenêtre', retiree: ECRAN + ' : la liste est la page Favoris du panneau' },
  { garantie: 'résumé : N favoris à contacter', ou: [['panneau', /segments Tous · Pas encore contactés · Envoyés · Ignorés, avec leurs nombres/]] },
  { garantie: 'la fenêtre s’ouvre sur « 1. Choisir »', retiree: ECRAN + ' : plus d’étapes, un tableau (« Favoris est un TABLEAU (plus d’étapes 1 Choisir…) »)' },
  { garantie: 'seuls les favoris sont listés, pas une notification d’offre', ou: [['liste', /l’aperçu rend la liste `tous`/], ['file', /capture, compte, format, phrase, lien, doublons ou sélection incompatibles : aucun destinataire inventé/]] },
  { garantie: 'couverture partielle explicite', ou: [['file', /la structure est bornée et ne promet pas de liste complète/], ['liste', /réponse bornée : message rendu pour les 60 premiers seulement/]] },
  { garantie: 'photo reçue affichée ; photo, texte et sélection alignés', ou: [['panneau', /chaque rangée a sa photo, la plaque N° quand il y en a un/], ['panneau', /rien ne déborde, cibles ≥ 44 px/]] },
  { garantie: 'la destination est celle de la notification', ou: [['file', /le paramètre destinataire est prouvé par le lien natif ouvert et la requête produite, jamais par son nom/]] },
  { garantie: 'rien de choisi : impossible de passer au message', ou: [['panneau', /sans sélection, pas de barre d’envoi/]] },
  { garantie: 'le destinataire choisi est nommé', ou: [['liste', /cochables, message rendu à leur nom, offre calculée/]] },
  { garantie: 'sans message, pas d’envoi', ou: [['message', /réglages : formes d’avant lues telles quelles, nouvelles formes validées/]] },
  { garantie: 'seul le message saisi est copié (bouton « Copier le message »)', retiree: ECRAN + ' : le panneau n’a pas de bouton de copie' },
  { garantie: 'aucune écriture avant l’enregistrement ou la confirmation explicite', ou: [['panneau', /rien n’est parti avant « Confirmer l’envoi »/], ['file', /message figé et aucun effet réseau au lancement/]] },
  { garantie: 'le texte part tel quel, la vraie offre Vinted suit (29 oct., comme Vintex)', ou: [['message', /l’extension personnalise avec le pseudo du fil vérifié et utilise l’offre/], ['reglages', /le pourcentage produit un texte, sans inventer de prix ou modifier le message de base/]] },
  { garantie: 'exemple de l’offre : 50 € → 45 € ; baisse en euros 50 € → 45,50 €', ou: [['message', /offre : diminuer en %, en €, fixer à, arrondi/], ['clair', /offre : 95 € −10 % ⇒ 85,50 €, −9,50 €/]] },
  { garantie: 'la variable {username} s’insère et l’aperçu la remplace par le pseudo du favori', ou: [['message', /variables : \{username\} et \{a\|b\}, le reste refusé/], ['clair', /aperçu : \{username\} = pastille, variante = son premier choix/]] },
  { garantie: 'une variable inconnue bloque la suite', ou: [['message', /variables : \{username\} et \{a\|b\}, le reste refusé/]] },
  { garantie: '100 % reste invalide au lieu d’être tronqué', ou: [['message', /serveur : l’offre suit le favori/]] },
  { garantie: 'compte rendu : chaque favori choisi est listé', ou: [['panneau', /les rangées disent Envoyé \/ Offre faite \/ Envoi en cours \/ En attente/]] },
  { garantie: 'cadence invalide (hors 0–1 440 min, max sous le min) : refusée, aucune écriture', ou: [['reglages', /cadence entière bornée et aucune activation cachée/], ['reglages', /autre propriétaire, autre identifiant ou format inconnu : refus/]] },
  { garantie: 'message, remise et rythme aléatoire enregistrés sans activer l’envoi', ou: [['reglages', /sauvegarde et relecture conservent le message, le taux et la cadence sans doubler la remise/], ['reglages', /cadence entière bornée et aucune activation cachée/]] },
  { garantie: 'aucun lancement sans moteur relié', ou: [['liste', /aucun lancement n’a atteint VRM/], ['liste', /sans confirmation ⇒ refusé/]] },
  { garantie: 'préparation plafonnée (10 alors, 15 par envoi aujourd’hui)', ou: [['liste', /16 favoris cochables ⇒ refusé \(15 au plus par envoi\)/], ['panneau', /barre basse collée « Envoyer à 15 favoris » \(15 au plus par envoi\), visible/]] },
  { garantie: 'aucun débordement horizontal ; cibles tactiles au moins 44 px', ou: [['panneau', /rien ne déborde, cibles ≥ 44 px/], ['panneau', /feuille : cibles ≥ 44 px/]] },
  { garantie: 'la fenêtre se referme pour retrouver la messagerie', ou: [['panneau', /Échap ferme la feuille, le panneau reste/]] },
  { garantie: 'réglages réhydratés après changement de compte', ou: [['reglages', /absence des réglages : défaut explicite non enregistré ; lecture exacte par propriétaire/], ['reglages', /sauvegarde et relecture conservent le message/]] },
  { garantie: 'actualisation remet la sélection à zéro', ou: [['liste', /après le lancement, l’aperçu gardé est vidé : un second envoi exige une liste relue/], ['liste', /un aperçu de plus de 30 min ⇒ relire d’abord, rien ne part/]] },
  { garantie: 'une erreur ne présente pas une ancienne liste comme actuelle', ou: [['file', /une capture absente est distincte d’une lecture en erreur ou ambiguë/], ['liste', /aucun aperçu lu sur ce navigateur ⇒ rien ne part/]] },
  { garantie: 'réponse de l’ancien propriétaire rejetée', ou: [['file', /une réponse d’un autre propriétaire ou un changement de session est rejeté/], ['reglages', /absence de reçu exact ou changement de session : aucune confirmation de sauvegarde/]] },
  { garantie: 'seuls les réglages explicitement sauvegardés sont écrits, aucun envoi Vinted', ou: [['reglages', /cadence entière bornée et aucune activation cachée/], ['file', /message figé et aucun effet réseau au lancement/]] },
], JUGES);
