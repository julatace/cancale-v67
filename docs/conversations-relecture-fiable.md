# Conversations Vinted : actualisation et retours tardifs

## Comportement corrigé

- Le lecteur essaie les autres canaux si l’archive ou l’extension échoue. Sans
  aucun fil disponible, il rend une erreur lisible au lieu de laisser une
  promesse rejetée et un chargement bloqué.
- Une lecture forcée repliée sur l’archive est dite **non confirmée**, même si
  cette archive peut toujours être consultée. Le dernier fil déjà affiché n’est
  pas rétrogradé par ce repli.
- Les réponses portant un autre identifiant de conversation et les structures
  sans tableau de messages sont refusées. Aucun lien par pseudo/titre.
- La dernière lecture lancée est seule autorisée à modifier le fil ; une capture
  native reçue entre-temps l’invalide. Les retours sont aussi filtrés par
  propriétaire et par ouverture de conversation.
- L’en-tête indique l’actualisation et désactive son bouton pendant la lecture.
  Une panne conserve le fil et donne un lien vers la conversation exacte sur
  Vinted. Une nouvelle lecture réussie enlève l’avertissement.
- Après une action d’offre confirmée, l’échec de relecture reste distinct de
  l’action réussie. La relecture n’écrase pas une capture plus récente.
- Après un message confirmé, une lecture plus ancienne ne masque plus cette
  réponse. Le repli archivé conserve aussi les messages confirmés qui attendent
  encore leur recapture native.
- La confirmation autorisant un nouvel envoi après vérification refuse un
  changement de propriétaire intervenu pendant la fenêtre de confirmation.

## Preuves et limites

`scripts/tests/conversation-relecture.test.mjs` exécute les vrais lecteurs et
contrôleurs extraits d’App.jsx, avec canaux et réponses simulés. Les huit premiers
cas échouaient avant correction. Les cas supplémentaires couvrent les réponses
contradictoires/mal formées, la conservation du fil récent et des messages
confirmés. Les tests existants d’actions d’offre restent exécutés.

`scripts/tests/conversation-relecture-interface.cjs` rend l’en-tête et le vrai
contrôleur React, avec un lecteur simulé : 21 contrôles sur 320, 390 et 1512 px
(attente, bouton désactivé, fil visible, panne, lien exact, nouvelle tentative,
absence de débordement et d’erreur React). Il est enregistré dans la CI.

Aucun message, aucune offre, aucune requête vers un compte marchand ou une base
réelle n’est envoyé par ces tests. Cela ne certifie pas la disponibilité de
Vinted, du relais ou de l’extension sur l’appareil de l’utilisateur. Le repli
historique reste consultable et explicitement non actualisé ; il ne prouve pas
que la messagerie native est exhaustive.
