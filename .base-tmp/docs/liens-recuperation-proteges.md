# Liens de connexion et récupération

Le nettoyage du retour utilise désormais `URLSearchParams` : les paramètres sensibles dupliqués ou dont le nom est encodé sont retirés, ainsi que le fragment. Les filtres de navigation utiles sont conservés. L’ancien remplacement par expression régulière laissait par exemple `%63ode` dans l’URL alors que le lecteur reconnaissait bien ce code.

Le document principal fixe aussi une politique `strict-origin` dès son en-tête HTML : même avant le nettoyage en JavaScript, les requêtes de chargement ne transmettent plus le chemin et les paramètres du lien en `Referer`. Le nouveau banc reproduit le défaut avant correction et vérifie sa disparition, avec les en-têtes actuels de production.

Un retour de récupération active son mode avant la publication de la session. Le formulaire sait lire ce mode même si le résultat global du retour n’est pas encore rangé. L’app ne monte donc pas l’espace de vente ni ses lectures pendant le choix du nouveau mot de passe. Ce cas couvre les retours par fragment et les codes PKCE explicitement marqués `type=recovery`.

Une durée de validité vide, non numérique, négative ou conduisant à un dépassement numérique est refusée sans remplacer la session précédente. Les anciens liens sans durée gardent leur valeur par défaut ; leur identité est toujours vérifiée au serveur.

Un lien de récupération collé dans l’aide à la confirmation n’est pas envoyé à `verify` : l’utilisateur est orienté vers le formulaire adapté, sans consommer le jeton à usage unique. La récupération dédiée reste disponible sans exposer le lien dans une URL de navigation supplémentaire.

Vérification : 37 tests unitaires regroupant connexion, création, sessions et récupération ; actions de la vraie interface à 320/390/1512 px ; nouveau banc `recuperation-retour.cjs` sur l’app complète pour les deux formats de retour, avec vérification de l’absence de lectures métier et d’écriture de mot de passe. Le banc utilise aussi un nom de paramètre `code` encodé. Ajout à la CI. Tous les comptes et services sont simulés : pas d’email réel envoyé, ni de connexion à un compte utilisateur.
