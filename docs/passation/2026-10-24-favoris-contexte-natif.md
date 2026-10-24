# Favoris : contexte natif conservé — extension 5.219.0

Le refus a persisté après les recherches dans les conversations captées. Cela
confirme que les preuves disponibles ne suffisent pas ; cela ne prouve toujours
pas que user_id est le destinataire. Les anciennes extensions ne conservaient
pas le lien de favori associé à la requête native d'ouverture de conversation.

## Nouvelle preuve

Le hook MAIN observe le clic fiable sur un lien Vinted items/.../new, ou l'adresse
de cette page lors de la création native POST /api/v2/conversations. Le clic est
borné à cinq secondes et consommé par la première création ; toute autre
interaction l'invalide. Aucune navigation ni requête Vinted n'est déclenchée par
ce mécanisme. Le fond vérifie l'origine, le format exact du corps et l'article,
puis range le contexte avec la trace, sous le propriétaire VRM authentifié.

L'archive privée existante garde au plus 100 créations avec leur contexte, sous
la même révision atomique que les notifications. Une autre conversation et une
nouvelle page ne les écrasent pas. Elle reste bornée, sans nouveau schéma SQL.

Le serveur accepte :
- l'ancienne preuve exacte article/user_id avec requête ou conversation native ;
- la correspondance du lien complet unique avec la création native observée ;
- un paramètre numérique dont le rôle destinataire a été prouvé par ce contexte
  natif et son corps sur deux destinataires distincts. Son nom n'est jamais supposé ; les clés du lien doivent
  correspondre et les paramètres répétés sont refusés pour cette généralisation.

Les identifiants ne sont jamais déduits d'un titre, d'une photo ou d'un pseudo.
Deux preuves contradictoires ne peuvent ni autoriser une notification ni servir
à généraliser un paramètre pour les autres. Une URL partagée par plusieurs
notifications ne crée pas une correspondance exacte. Les domaines www et nus,
l'ordre des paramètres, les fragments et la barre finale sont normalisés.

Sans paramètre numérique prouvé, seule la notification exacte reliée au contexte
est confirmée. Les autres restent bloquées. La réception réelle chez le client
n'a pas été validée. Le contrôle immédiat du fil, l'absence d'envoi si messages
existants, le quota par compte et l'absence de rejeu sont inchangés.

## Vérification

37 tests unitaires favoris, dont paramètre opaque de nom, user_id différent du
destinataire, traces anciennes, contradictoires, origines/comptes incompatibles,
paramètres répétés et vraie route HTTP utilisant une preuve archivée. 8 contrôles
du vrai inject avec fetch simulé, 17 archive/pagination/conservation, 49 moteur
extension, 49 app complète mobile/ordinateur. Build et audits cohérence, ZIP,
notifications, exécution, navigateurs et suivi Vinted réussis. Aucune action réelle
ni aucun message Vinted envoyé pendant ces essais.

## Utilisation

Installer 5.219.0, recharger l'extension, VRM et Vinted. Depuis Favoris reçus,
ouvrir un favori sur Vinted avec le bon compte (sans envoyer de message), puis
revenir actualiser VRM avant de relancer. Cette fois le lien natif est conservé ;
les anciennes versions ne collectaient pas cette preuve. Pour généraliser un
paramètre inconnu aux favoris jamais ouverts, deux destinataires natifs distincts
sont nécessaires ; une seule preuve confirme uniquement le lien exact ouvert. Ne pas annoncer une
résolution universelle ni contourner l'absence de preuve.
