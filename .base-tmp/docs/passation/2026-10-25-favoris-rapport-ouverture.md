# Favoris — réunir le contrôle d’ouverture et le rapport de capture

Le vendeur continue à recevoir `favoris_preuve_absente` après la 5.223 et recopie deux fois le diagnostic de structure v5. Ce diagnostic ne porte ni la version mesurée, ni le résultat de la dernière commande. Il est impossible d’en déduire quelle étape de la 5.223 a échoué. Ne pas présenter ce changement comme une réparation de l’ouverture réelle.

L’assistance est désormais montée dans le même composant et le même périmètre propriétaire/compte que la liste. Son rapport inclut `verification` (version, étape, code, preuve et raison contrôlés) et, si présent, `lancement` avec compteurs bornés. Un résumé explique si la cloche, la recherche du favori, le relais ou la sauvegarde ont échoué. Sans tentative dans la vue courante, le rapport le dit explicitement. Pas de persistance dans le navigateur, pas de diffusion globale des contrôles ni de lecture automatique supplémentaire.

Les valeurs inconnues ne sont pas copiées. Le diagnostic détaillé reste une lecture demandée par l’utilisateur ; il ne déclenche aucune action Vinted. Aucun changement de moteur d’envoi, d’extension, de garde du destinataire ou de quota. L’extension demeure 5.223.0. Aucun test sur une session client et aucun message réel envoyé.

Validation : tests unitaires du contrôle et de la copie, tests React diagnostic sur 320/390/1512, parcours historique React avec refus d’ouverture et copie via le composant parent. Le rapport d’assistance copie effectivement le contrôle le plus récent et ne recycle pas le refus de lancement effacé.
