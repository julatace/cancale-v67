# Revue de fiabilité avant montée en charge — 22 octobre 2026

Cette revue répond à la demande d'accueillir environ 2 000 utilisateurs. Elle fournit des corrections et des preuves reproductibles, pas une garantie d'absence de bugs ni un certificat de capacité de production.

## Corrections livrées dans ce lot

- Réception des emails : lecture paginée du registre des adresses, ordre stable, prise en compte d'un plafond PostgREST inférieur à 500, refus d'un résultat partiel ou d'une page répétée. Le vendeur après la millième ligne et les conflits tardifs ne sont plus ignorés. Une fin de pagination HTTP 416 exige un total cohérent. Les lectures simultanées dans une même instance partagent la requête, sans cache durable d'attribution.
- Notifications : seules les destinations HTTPS des fournisseurs Web Push connus sont acceptées. Les anciennes destinations arbitraires déjà enregistrées ne sont pas contactées. Les abonnements sont projetés sur les champs utiles. Les erreurs internes ne sont plus renvoyées telles quelles au navigateur. Délai maximum de dix secondes par envoi.
- Rappels programmés : `CRON_SECRET` obligatoire dans l'en-tête Authorization ; une clé passée dans l'URL ne suffit plus. Configuration absente, schéma sans séparation ou énumération des vendeurs impossible : refus explicite, aucun envoi global de secours. Le cron du soir utilise la même protection.
- Vérification de session et sondes de confidentialité : requêtes réseau bornées à dix secondes.
- Outil de compilation Vite et plugin React mis à jour : les deux alertes de dépendances de développement du contrôle initial disparaissent. Le contrôle après intégration du dernier main ne signale aucune vulnérabilité npm connue.
- Capacités de l'extension : les nouveautés « à confirmer » et notification de retrait exigent réellement la 5.206, au lieu d'être promises aux versions 5.204/5.205 publiées sans ces fonctions. Le zip 5.206 de main est conservé.

## Méthode et preuves

Les tests utilisent des vendeurs, jetons, bases et plateformes synthétiques. Aucune vente de test, aucun email et aucune notification réels ne sont créés. Les appels de plateformes sont simulés ; le JavaScript métier et les routes sont exécutés.

`node --test scripts/tests/*.test.mjs` couvre notamment séparation des comptes, changements de session, réception, confidentialité, retraits, réglage des bordereaux et opérations. Le nouveau fichier `capacite-securite.test.mjs` teste :

1. 2 000 lignes de registre et un conflit entre le premier et le dernier vendeur ;
2. panne ou répétition d'une page, plafond serveur de 100 lignes, fin exacte HTTP 416 ;
3. 30 lectures simultanées et relecture immédiate d'une nouvelle attribution ;
4. 2 000 requêtes entrelacées vers la route push, chacune lisant uniquement son propriétaire malgré un owner adverse envoyé par le client ;
5. destinations Web Push internes/trompeuses refusées ;
6. cron non configuré ou non authentifié : zéro accès aux données et zéro notification.

Ces 2 000 requêtes sont une simulation de concurrence logique en mémoire. Elles ne mesurent ni le débit réel de Vercel, ni les connexions de Supabase, ni les quotas de Gmail.

Les audits existants des factures, chiffres croisés, eBay, widgets, en-têtes navigateur, reprise des emails et notifications sont aussi exécutés. Les anciennes simulations sans session sont actualisées : la session simulée et sa relecture portent la même identité ; les cas volontairement sans session continuent d'exiger zéro écriture. Le test de rattrapage des bordereaux active explicitement le réglage du vendeur, conformément à sa demande. Aucune protection de production n'est assouplie pour faire passer un test.

## Résultats de cette exécution

- 120 tests unitaires : 120 réussis, aucun échec.
- Compilation de production réussie après intégration de PR637 et mise à jour de Vite. L’avertissement sur les gros bundles reste une limite de performance à traiter ; il n’est pas masqué.
- Audit npm complet, développement inclus : aucune vulnérabilité connue signalée.
- Les 141 scripts d’audit existants sont validés après les relances nécessaires. L’audit d’abonnement est relancé avec des abonnements Web Push synthétiques conformes à la nouvelle validation. Avec le nouveau banc de confidentialité, 142 scripts d’audit sont validés.
- PostgreSQL 17.11 est extrait localement dans `/tmp`, sans installation système ni connexion à la production, afin d’exécuter les audits SQL initialement bloqués. Agent : 221 contrôles, communauté : 206, équipe : 106, garde de numérotation : 22, migration des anciens numéros : 126, sans échec. Le dernier audit a dépassé le délai initial de 120 secondes ; il a été relancé seul jusqu’à sa fin, pas déclaré réussi sur un arrêt prématuré.
- Nouveau `scripts/audit-confidentialite-sql.cjs` : 45 contrôles réels sur PostgreSQL jetable, tous réussis. La vraie migration 021 est appliquée deux fois ; les politiques trop permissives ne permettent ni lecture, ni insertion, ni modification, ni suppression chez autrui. Changer owner est refusé. Les écritures propres fonctionnent. Les droits dangereux, l’anonymat, la restriction d’abonnement et la lecture d’équipe explicitement autorisée sont contrôlés. Chaque requête passe par une connexion SQL distincte.

Commande de ce dernier audit : `PG_BIN=/chemin/vers/postgresql/bin node scripts/audit-confidentialite-sql.cjs`. Le script refuse de se déclarer réussi si PostgreSQL manque. Il démarre uniquement une base jetable, écoute sur une socket locale et la supprime en fin d’exécution.

## État réel des droits SQL

L'utilisateur a appliqué la migration 021 et transmis le résultat du diagnostic : deux tables présentes, RLS activé, verrous restrictifs présents, aucun écart de politique et aucun droit dangereux relevé. Les règles transmises filtrent `app_data` et `vinted_accounts` sur `owner = auth.uid()`.

Ce résultat est structurel, fourni par l'administrateur. Il ne remplace pas un test réel sur deux sessions distinctes ni une inspection des copies historiques éventuellement rangées sous un mauvais propriétaire. Aucun propriétaire existant n'est automatiquement corrigé ou supprimé.

## Conditions restant à valider avant une ouverture à grande échelle

1. **Prouver la possession des adresses supplémentaires déclarées pour recevoir les emails.** Une déclaration et une détection de conflits ne constituent pas une preuve. Un parcours de validation d'adresse reste nécessaire : RLS seule ne protège pas contre la revendication initiale de l'adresse d'autrui.
2. **Vérifier deux vraies sessions sur deux appareils**, en lecture et écriture, et examiner l'attribution historique après l'incident signalé. Les tests synthétiques ne certifient pas les anciennes copies.
3. **Mesurer le trafic prévu**, le plan Vercel/Supabase, les index, temps d'exécution, quotas, mémoire et egress avec une base de préproduction représentative. Les rappels traitent huit vendeurs en parallèle ; le traitement réel de 2 000 vendeurs dans la durée autorisée n'est pas démontré.
4. **Dimensionner la réception Gmail.** Le collecteur actuel réserve au maximum 80 nouveaux messages et 20 reprises par passage, avec un budget de transfert de 180 secondes. À cinq minutes, 80 × 12 × 24 donne un plafond théorique de 23 040 nouveaux messages/jour, avant latence, pannes et quotas. Ce nombre n'est pas une capacité garantie. Les quotas effectifs dépendent du compte Google : https://developers.google.com/apps-script/guides/services/quotas. Une file durable, un suivi du retard et une stratégie de quotas sont nécessaires si le volume approche les limites. Le scan paginé du registre par réception reste un coût à mesurer.
5. **Confirmer les paramètres serveur et l'exploitation** : CRON_SECRET, sauvegardes et restauration testée, alertes sur erreurs/retards, limitation d'abus partagée entre instances. Un budget en mémoire dans une fonction ne constitue pas une limite distribuée.

Aucun accès administrateur à Supabase, Vercel ou Gmail n'est disponible dans cette session. Aucune configuration payante ni MFA par SMS n'est activée. La MFA reste reportée selon la décision de l'utilisateur.
