# Capture Leboncoin et statut Vinted — candidate 5.211.0

## Défauts reproduits et correction

La réponse privée `api/account/v2/members/me/account` fournit deux `account_id` concordants et `member.nickname.value`. Elle est reconnue explicitement, sans assimiler cet identifiant à l'UUID de messagerie. L'identifiant VRM utilise le préfixe `lbc-account:`. Aucun rapprochement historique n'est inventé.

Les annonces peuvent précéder le profil ou arriver pendant sa sauvegarde. Le capteur attend l'identité privée et le relais attend l'acquittement de sa sauvegarde avant de transmettre les listes. Une identité refusée bloque les listes suivantes. Une deuxième identité différente dans le même document est refusée. Seules les listes privées attendues sont parcourues, pas les recommandations. Les emails du profil ne sont pas transmis. Aucune nouvelle requête Leboncoin n'est déclenchée.

Une mise à jour du service worker ne recharge pas les scripts d'un onglet déjà ouvert. Le paquet rappelle de recharger Leboncoin, avec un bouton explicite ; aucun rechargement automatique ni perte forcée de formulaire.

Dans l'écran Comptes Vinted, un statut absent était présenté comme « Actif ». Il indique désormais « État non vérifié ». Un ancien refus HTTP indique « Accès refusé », jamais une preuve de bannissement. Le champ explicite `is_account_banned` continue de déterminer le statut confirmé. Aucun statut de jujuf38 n'est forcé sans preuve.

## Validation

- 145 tests unitaires réussis, build réussi.
- Audits Leboncoin, état du compte, connexion extension, navigateurs, paquet ZIP.
- Chromium avec monde MAIN et monde isolé séparés, vrai background exécuté dans une base simulée : identité avant/après annonces, sauvegarde lente, identité refusée, HTTP 403 avec corps ressemblant à un profil.
- Le même test échoue avec l'ancien capteur et avec un relais sans attente d'acquittement.
- Rappel de mise à jour testé à 390 et 1512 pixels : unique, fermable, pas de débordement, brouillon conservé.

## Limites à conserver dans la communication

La session réelle du client n'est pas accessible ici. L'installation d'une extension non empaquetée est désactivée par l'administrateur du navigateur fourni ; le téléchargement du navigateur alternatif est refusé par le réseau. Les tests de mondes séparés ne constituent pas un test d'installation réelle.

La candidate ne prouve pas que la page réelle charge encore cette route avec la même forme. Si l'identité privée n'est jamais reçue, la capture reste volontairement sans attribution. Ni historique de comptes ni mauvaises associations précédentes ne sont supprimés ou fusionnés automatiquement. Les échanges simultanés entre plusieurs onglets restent une limite à examiner séparément.

Avant de déclarer l'incident résolu : relever version du capteur/relais dans la carte réelle, nom reconnu, diagnostic inférieur, et comparer une annonce/photo visible sur Leboncoin avec VRM. Pour jujuf38, vérifier la réception d'un profil portant le bannissement explicite. Ne pas confondre un statut inconnu avec un compte actif.
