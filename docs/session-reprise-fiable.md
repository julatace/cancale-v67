# Sessions : renouvellement et reprise

Le renouvellement conserve trois résultats : `true` pour une session renouvelée, `false` pour un refus, `null` lorsqu’on ne peut pas conclure. Les erreurs 408, 425 et 429 sont transitoires et ne font plus effacer la session à l’ouverture. Une réponse 200 vide, une identité contradictoire ou une expiration invalide restent non confirmées.

Après une réponse, le code vérifie que le jeton d’accès ET le jeton de renouvellement correspondent toujours à la demande. Si une autre connexion ou une autre action a changé la session, la réponse est ignorée, même en cas de refus : elle ne peut pas déconnecter le nouveau compte via `authBoot`.

La promesse partagée est initialisée avant le travail effectif. Une sortie immédiate (session sans jeton de renouvellement) libère donc correctement le verrou, au lieu de figer les demandes suivantes. Les échecs conservent le délai de quinze secondes entre lectures discrètes pour éviter les rafales.

La lecture de l’identité portée par un lien email utilise une interruption de vingt secondes et refuse un utilisateur sans identité. Un échec ne remplace pas la session précédente.

Vérification : sept tests unitaires exécutant les fonctions réelles, banc `session-reveil.cjs` sur 390/1512 px enrichi des cas 429 et réponse vide, et parcours de connexion. Le banc conserve ses vérifications du réveil réel avant expiration et du rechargement unique après disparition d’une ancienne feuille de style. Tests ajoutés à la CI. Toutes les données et réponses d’authentification sont simulées ; aucun compte réel ni email utilisé.
