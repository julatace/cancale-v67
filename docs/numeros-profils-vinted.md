# Numéros sur les profils Vinted — 5.287.0

Retour utilisateur : en visitant un autre profil avec l’extension, des numéros
VRM apparaissent sur ses annonces. Après clarification, le problème signalé est
l’affichage Vinted ; l’import de ces annonces dans le stock VRM n’est pas confirmé.

## Correctif

La commande qui renvoie les numéros contrôle maintenant l’URL du véritable onglet
expéditeur. Sur `/member/{id}`, l’id doit être celui du profil du compte connecté,
lu en base, et non son `account_id` de cookie (ces deux ids sont différents).
Autre profil, profil illisible, compte non connecté ou origine invalide : aucune
lecture du tableau de numéros ni aucun numéro renvoyé. Les autres pages conservent
leur correspondance par identifiant exact d’article, transaction ou conversation.

Le script de page efface ses pastilles et ses correspondances au changement de
chemin. Une réponse arrivée après navigation est ignorée ; une réponse refusant
la portée enlève également les pastilles. La vérification ne crée, ne réserve et
ne modifie aucun numéro. Le cache du fond est aussi séparé par propriétaire VRM,
avec une seconde vérification du propriétaire avant son remplissage.

## Validation et portée

- Trois tests exécutent les vraies fonctions/commande du fond, dont profil vs
  account_id, refus sans lecture du tableau et changement de propriétaire VRM.
- Huit contrôles Chromium sur 390 et 1512 px : numéro sur son profil, retrait sur
  un profil étranger, réponse tardive écartée, aucune réservation lors d’une visite.
  Le test d’affichage échoue sur le code précédent (une pastille persiste).
- L’audit de moisson rejette déjà les captures de dressing d’un autre membre :
  33 contrôles réussis. Cette porte d’import n’est pas modifiée ici.
- Le banc existant des numéros vérifie les pages de publication, ventes et annonces.
- Les contrôles CI d’interface sont individualisés pour identifier le scénario
  précis en échec sans supprimer ni affaiblir leurs assertions.

Aucune lecture de la vraie base de l’utilisateur, aucune suppression ou
réattribution de numéros existants. Si des annonces étrangères apparaissent aussi
réellement dans VRM, il faut identifier leurs ids et provenance avant correction
ciblée ; le présent correctif ne prétend pas avoir nettoyé son stock.

Archives Chrome et Orion reconstruites depuis la 5.287.0. Remplacer le dossier de
l’extension et recharger l’extension puis la page Vinted ; les scripts déjà chargés
dans un ancien onglet doivent être remplacés par ce rechargement.
