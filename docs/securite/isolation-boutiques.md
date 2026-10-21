# Contrôle de séparation des boutiques

La présence d’une colonne owner ne prouve pas le filtrage réel des lectures. Le nouveau contrôle authentifié sonde seulement owner (une ligne maximum) avec la clé publique puis le jeton utilisateur, sur app_data et vinted_accounts. Il refuse l’ouverture du cœur de l’app si une lecture étrangère/anonyme est possible ou si la vérification est indisponible. Aucun contenu vendeur n’est renvoyé par ce diagnostic.

Le contrôle de l’interface ne remplace pas les droits de la base : une ancienne version, l’extension ou un client direct peuvent contourner une interface. La migration 021-confidentialite-boutiques.sql doit être appliquée par l’administrateur dans le SQL Editor Supabase. Cette session n’a aucun accès d’administration à Supabase, et n’a pas appliqué cette migration. Les essais directs vers le domaine Supabase ont été refusés par le proxy de l’environnement ; aucune conclusion sur les règles actives en production n’a été tirée de ces essais.

## Correction en base

Ouvrir le projet de production → SQL Editor → nouvelle requête. Exécuter le fichier `supabase/migrations/021-confidentialite-boutiques.sql` (copie publique `/VRM-confidentialite.sql`). Il ajoute des politiques restrictives, conserve les restrictions d’abonnement et la lecture d’équipe explicitement autorisée si ses fonctions existent. Il ne supprime, ne déplace et ne réattribue aucune ligne. Il échoue dans une transaction si la colonne owner manque.

Après application, les deux tables doivent afficher rowsecurity=true et les politiques restrictives vrm_* doivent être présentes. Vérifier ensuite avec deux vraies sessions distinctes : aucune boutique de l’autre ne doit s’afficher. Ne pas créer de fausses ventes ou comptes de test en production.

Le diagnostic ne certifie pas l’origine historique de lignes éventuellement déjà copiées sous un mauvais propriétaire. Une inspection séparée serait nécessaire ; aucune correction automatique de propriétaires n’est effectuée.

## Caches et limites

L’app attend une liste de comptes lue depuis la base au démarrage et applique aussi une liste réellement vide. Un navigateur dont les données locales n’ont jamais été attribuées à une identité est nettoyé à la connexion, comme lors d’un changement de vendeur. Les lignes cloud et les documents ne sont pas effacés par ces changements.

Le contrôle ne remplace ni l’audit des droits d’écriture ni les règles des autres tables. Les tests exécutent les contrôles et le rendu avec des données synthétiques ; la migration doit encore être appliquée et vérifiée dans le projet réel.

## Renforcement du 21 octobre — accès Vinted et changements de session

Les routes de connexion, de lecture et de renouvellement Vinted n'utilisent plus de repli vers une boutique commune lorsque le schéma est absent ou indisponible. Le propriétaire est celui de la session vérifiée par Supabase. Les lectures et modifications de comptes sont explicitement filtrées sur ce propriétaire ; une réponse portant un autre propriétaire est refusée. Les réponses serveur ne sont pas mises en cache.

L'app et l'extension 5.205 ciblent aussi le propriétaire pour la liste des comptes ; une réponse arrivée après un changement de vendeur n'est pas utilisée. La lecture du réglage cloud principal exige une seule ligne du vendeur. Les sauvegardes différées sont annulées au changement d'identité et revérifient l'identité dans le stockage partagé entre onglets avant d'écrire. L'ancien formulaire de code d'accès est supprimé. Le contrôle de confidentialité est renouvelé au retour dans l'app et au maximum une fois par minute lorsqu'elle reste visible ; un contrôle négatif ou indisponible ferme l'interface privée.

La double vérification protège la connexion, pas les règles de séparation SQL. Le QR de configuration est généré dans le navigateur depuis l'URI native de Supabase, sans service externe ; la clé manuelle est repliée par défaut. « Remplacer cette configuration » annule d'abord le facteur non vérifié avant d'en créer un nouveau. Cela ne révoque pas automatiquement une clé déjà exposée : son détenteur doit remplacer la configuration depuis sa session.

Ces changements ne prouvent pas que les lignes historiques ont été attribuées au bon propriétaire. Ils ne remplacent toujours pas l'application et la vérification de la migration 021 dans Supabase. Aucune donnée, vente ou identité n'est automatiquement réattribuée.
