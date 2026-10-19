# Recherches enregistrées et suivi des échéances

Suite de la livraison Organisation du 19 octobre 2026.

## Recherches eBay

Le vendeur peut modifier les critères enregistrés, dupliquer une recherche en lui donnant un autre nom, archiver et restaurer. L’identité d’une recherche modifiée reste stable. La copie possède sa propre identité et ses propres modifications.

Création et édition passent par la même validation serveur des critères et des montants. L’historique conserve les critères avant/après, l’auteur et la date. La modification exige la version de critères ouverte dans le formulaire : recharger l’espace pendant l’édition n’autorise pas à écraser une modification faite entre-temps. Une version périmée est refusée ; fermer et rouvrir le formulaire récupère les critères actuels. Les recherches de la première livraison, sans version explicite, sont prises en charge.

Restaurer et dupliquer produisent toujours une recherche **préparée**. Aucun de ces gestes n’active de collecte, notification, enchère ou achat eBay. Les droits officiels et le collecteur restent à valider et développer.

## Réservations

Une réservation encore active peut être prolongée, avec une échéance strictement ultérieure et un motif. L’historique conserve l’ancienne date, la nouvelle et l’auteur ; prix, acompte et quantité restent inchangés. Les commandes rejouées ne doublent pas l’événement.

Une réservation expirée, annulée ou convertie ne peut pas être prolongée. Une réservation expirée peut avoir libéré une quantité déjà réaffectée ; il faut créer une nouvelle réservation, soumise au contrôle de disponibilité habituel, plutôt que réactiver l’ancienne.

## Échéances

Dans Missions, Réservations et Retours & litiges, le vendeur peut trier par échéance ou par ajout récent, et filtrer les échéances actives en retard ou dans les 24 heures. Les cartes portent un petit repère distinct du statut métier. Les tâches terminées et dossiers clos ne deviennent pas artificiellement en retard ; une date inconnue n’est jamais inventée. Une réservation arrivée à expiration conserve son état expiré, sans faux indicateur d’activité.

L’affichage s’appuie sur l’heure serveur reçue, puis le temps écoulé du navigateur, pour éviter qu’une mauvaise date du téléphone n’expire visuellement toutes les réservations. Le serveur continue à décider de leur activité lors de chaque écriture.

Les membres voient les repères des missions qui leur sont attribuées. Leurs droits d’écriture restent limités aux étapes et états déjà autorisés : ils ne peuvent ni modifier les recherches, ni prolonger les réservations.

## Vérification

- 41 tests métier/API : montants, dates, versions périmées, relecture concurrente, idempotence, refus d’accès et états inactifs.
- 41 contrôles navigateur : parcours existants, édition/duplication/restauration, formulaire périmé, prolongation, tri, filtre, badges, horloge du téléphone fausse et révocation.
- Compilation de production réussie. Affichage des contrôles d’échéance vérifié à 320, 390 et 1 440 px, sans débordement horizontal.

Ces vérifications utilisent les vrais composants et gestionnaires de route, avec données et Supabase simulés. Aucun compte réel, paiement ou message à un acheteur n’est utilisé.
