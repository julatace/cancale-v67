# Favoris : historique, dates et connexion Chrome — 5.218.0

Julien signale une seule notification visible, une extension Chrome muette au
lancement, et demande l'âge des favoris et les contacts déjà effectués.

## Résultat

- Les captures de notifications alimentent une archive privée par propriétaire
  et compte Vinted. Fusion par identifiant natif et révision atomique : deux
  pages ou navigateurs ne peuvent plus remplacer silencieusement leurs listes.
- « Récupérer toutes les pages » lit une page à la fois, exclusivement depuis
  une adresse de notifications déjà observée sur Vinted. Le numéro de page
  retourné doit correspondre au numéro demandé. Les refus, quotas, interruptions
  et capacités atteintes laissent un résultat explicitement partiel.
- L'archive est bornée à 5 000 notifications et 300 000 caractères. Le budget
  natif existant de lectures reste prioritaire, notamment pour l'argent et les
  colis. Une lecture peut donc devoir être reprise ultérieurement. Les favoris
  qui ne sont plus disponibles chez Vinted ne sont pas récupérables par magie.
- La liste indique l'âge d'après la date native disponible, conserve la plus
  ancienne date observée et distingue les envois VRM confirmés, les fils déjà
  commencés et les accusés incertains. Une notification lue ne signifie jamais
  qu'un message a été envoyé. Recherche et filtres compacts ajoutés.
- Chrome peut joindre directement l'extension identifiée pour vérifier son état,
  récupérer les pages et exécuter une autorisation. Les contrôles d'origine,
  propriétaire, compte, version, doubles extensions et historique restent actifs.
  Un envoi sans accusé ne bascule jamais sur un autre canal : aucun rejeu.
- La file respecte son échéance serveur avant de redemander un travail, au lieu
  de télécharger inutilement son historique toutes les quinze secondes.

## Validation

Tous les scénarios utilisent des fixtures inventées, sans message réel Vinted.
30 tests unitaires, 13 contrôles archive/concurrence/pagination, 49 contrôles du
vrai moteur d'extension, 30 contrôles React de l'historique sur 320/390/1512 px,
72 contrôles liste/réglages et 66 contrôles de progression. Le banc de l'app
complète passe 45 contrôles, avec relais de page volontairement muet après mise
à jour, connexion directe Chrome et un seul dispatch de l'autorisation.
Audits : notifications 33, exécution 21, budget 20, suivi Vinted 127, cohérence,
archive ZIP et compatibilité navigateurs. Build Vite réussi.

Le contrôle de confidentialité du diagnostic utilise maintenant un identifiant
synthétique long : l'ancien « 456 » pouvait se retrouver fortuitement dans les
millisecondes d'une date et produire un faux échec. Les valeurs privées restent
interdites dans les traces.

## Livraison et limites

Installer l'extension 5.218.0, la recharger puis recharger VRM et Vinted. Ouvrir la
cloche Vinted une fois pour observer la source réelle de notifications. Dans
Messages, choisir le bon compte puis afficher et compléter les favoris.
L'écran VRM doit rester ouvert et visible pour les envois. Pas de nouveau relais
mobile, d'offre native de prix, ni de promesse d'absence de restriction Vinted.
La réception réelle chez un destinataire n'a pas été testée avec le compte client.
