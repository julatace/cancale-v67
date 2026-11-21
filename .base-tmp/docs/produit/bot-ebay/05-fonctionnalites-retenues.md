# Les autres fonctionnalités retenues

Ce périmètre reprend les idées acceptées dans cette conversation. « Retenu » ne signifie pas « développé ». Les simulateurs de revente, l'inventaire au téléphone et la prévision de trésorerie restent exclus. Les nouvelles propositions de logo ont été rejetées : conserver le logo métallique officiel désormais publié.

## 1. Délégation : prolonger le mode équipe existant

### État de départ vérifié

`supabase/migrations/016-equipe.sql`, `api/_lib/equipe.js`, `api/compte.js`, les écrans d'équipe dans `src/App.jsx` et le banc `scripts/bancs/equipe.cjs` existent. Le membre est identifié par sa session, avec projection limitée des colis et codes de retrait, sans accès général à l'argent ni aux conversations. Le message d'absence de migration est distinct d'une équipe vide. La présence du code ne prouve pas l'installation de la migration sur toutes les bases.

Les missions doivent étendre ce modèle. Ne pas donner au membre un accès à `app_data` entier, ni remplacer les appels authentifiés par une clé de service utilisée dans le navigateur.

### Types de missions

Récupérer des colis, réceptionner, contrôler le contenu, photographier, préparer une annonce, faire valider une annonce, préparer/emballer, déposer des colis, traiter un retour, vérifier une opportunité eBay, contrôler les consommables. Modèle réutilisable mais consignes spécifiques par mission.

Champs : propriétaire de l'espace, responsable, exécutant, catégorie, titre, articles/commandes concernés par identifiants, emplacement/point relais, échéance et fuseau, priorité, étapes, preuves attendues, matériel, dépendances, visibilité et état. Un modèle ne remplit jamais de faux articles ou de fausses adresses.

États : brouillon → attribuée → prise en charge → en cours → terminée par l'exécutant → validée par le responsable. Bloquée et annulée sont distincts. « Terminée » ne marque pas à elle seule une vente expédiée, une annonce publiée ou un article disponible : chaque changement métier doit avoir sa preuve et sa règle propre.

### Réalisation et contrôle

- Une personne prend une mission ; bail/concurrence pour éviter les prises simultanées involontaires.
- Checklist : chaque ligne a son état, son auteur et son heure serveur. Une tâche avec dix articles ne devient pas finie après le premier.
- Preuves adaptées : photo, quantité, accessoire constaté, commentaire ou justificatif. La présence d'une photo ne prouve pas son contenu.
- Blocage : raison, élément concerné, personne à prévenir et prochaine action. « Article introuvable » ne supprime pas l'article.
- Retour pour correction, validation partielle et réouverture possibles, journalisés sans effacer l'historique.
- Missions récurrentes créées une seule fois par occurrence ; fuseaux et changements d'heure testés.
- Transmission automatique d'une mission à la suivante seulement sur un état confirmé. Préparation d'annonce : brouillon par le collègue, publication par un rôle explicitement autorisé.
- Passation : note utile, blocages, travail réellement terminé et destinataire suivant.

### Récupération des colis

Regrouper par point relais et date limite réelle lorsque les données le permettent. Montrer horaires avec leur source/date ; ne pas inventer une ouverture ou une distance. Les codes sont visibles uniquement au membre autorisé pour la mission active. Les identifiants de suivi ne deviennent jamais des codes de retrait par une simple règle numérique.

Distinguer : déplacement prévu, colis récupéré, colis remis à l'espace, contenu vérifié, éléments manquants. La mission peut être partiellement réalisée. Une photo de colis ne remplace pas un contrôle du bon article. Révocation d'un membre : interdiction de nouvelles lectures immédiatement ; ne pas promettre d'effacer ce qu'il a déjà mémorisé hors ligne.

### Droits

Rôles proposés : responsable, coordinateur de missions, opérateur, photographe/préparateur, lecteur limité. Capacités explicites plutôt qu'un seul booléen « équipe » : attribuer, voir des codes, ajouter une preuve, valider une tâche, voir un coût, engager une dépense, publier une annonce. Aucun de ces droits n'est déduit des autres.

Contrôler à chaque requête propriétaire, appartenance active, rôle, mission et ressource liée. Les preuves sont privées, avec liens temporaires et durée de conservation définie. Pas de code, jeton ou adresse complète dans le journal général, un export d'équipe ou une notification d'écran verrouillé.

## 2. Réservations et acomptes

Réserver un article pour un acheteur, un canal externe ou une mission de vente, avec dates et quantité. Une réservation retire la quantité de la disponibilité interne, pas de la présence physique. Définir qui peut prolonger, annuler ou confirmer.

États : brouillon, active, expirée, convertie en vente, annulée. Expiration décidée par le serveur, avec concurrence contrôlée. Une vente confirmée et une expiration ne peuvent pas consommer la même quantité. Une réservation ne retire pas automatiquement les annonces eBay/Vinted/Leboncoin sans fonction native et autorisation vérifiées : afficher les canaux encore à traiter.

Acompte : montant, devise, date et justificatif réels ; solde restant si le prix est connu. L'enregistrement d'un acompte ne déclenche pas un paiement. Annulation/remboursement : événement distinct ; pas de libération comptable silencieuse à l'expiration.

## 3. Lots et ventilation comptable

Une acquisition de lot reste la pièce source : prix global, frais réellement connus, devise, date et justificatif. Les articles enfants possèdent leur identité, quantité, numéro de série éventuel et état de réception. Ne pas créer dix dépenses égales au prix du lot.

Méthodes choisies : répartition égale, pondération explicite, montants saisis. Si les articles ne sont pas tous identifiés, garder une partie non ventilée. Une ventilation n'est pas une estimation automatique du prix de revente et ne réintroduit pas le simulateur refusé.

Exemple synthétique : coût du lot 100,00 €, frais connus 7,00 €, trois articles de poids 1/1/1 → 35,67 €, 35,67 €, 35,66 €. L'arrondi est déterministe, en unités mineures ; la somme reste exactement 107,00 €. Méthode d'arrondi et frais inclus visibles.

Règles :
- Totaux source = affectations + non ventilé ; aucune perte de centime.
- Coût absent ≠ zéro ; frais non lus signalés.
- Identité explicite entre achat source et enfants, jamais rapprochement certain par seul titre.
- Validation versionnée. Si un enfant est déjà vendu/déclaré, toute correction est un ajustement traçable, pas une réécriture silencieuse du passé.
- Retour partiel, remboursement partiel et réception incomplète gardent leur propre événement.
- Export comptable : distinguer dépense source et ventilation analytique, pour éviter la double comptabilisation. La règle fiscale applicable doit être confirmée avant de présenter un export comme déclaratif.
- Achat partagé : quote-part et propriétaire de chaque article, échanges entre participants et justificatifs ; aucune donnée d'un autre vendeur exposée sans partage autorisé.

## 4. Consommables, correctement réalisés

Catalogue libre : cartons, enveloppes, pochettes, calage, ruban, étiquettes. Unité explicite (pièce, rouleau, mètre), seuil et fournisseur facultatifs. L'unité d'achat et l'unité de consommation ne sont converties que par un facteur fourni et vérifié.

Journal des mouvements : entrée, consommation, réservation, libération, correction et perte. Auteur, quantité, unité, coût connu et motif. Le stock est calculé depuis une situation initiale connue ; sans elle, afficher « à initialiser », pas zéro.

Un emballage réellement préparé peut consommer son modèle de matériaux après confirmation. Réimprimer un bordereau ne consomme pas un deuxième carton. Relancer une requête ne débite pas deux fois. Annuler une préparation ne remet des consommables en stock que si le retour physique est déclaré. Les matériaux abîmés restent consommés.

Seuil de réapprovisionnement, liste d'achat et coût d'emballage connu par commande. Les taxes, ports et lots fournisseurs ne sont pas inventés. Pas de coût moyen certifié sans historique cohérent ; méthode choisie et explicable, corrections traçables. Pas de commande fournisseur automatique dans cette version.

## 5. Réception, contrôle qualité et numéros de série

Commande arrivée ≠ contenu vérifié. Checklist par catégorie : accessoires, état, références, défauts et photos. Numéro de série saisi/scanné si disponible, conservé comme texte (zéros inclus), masqué dans les vues non autorisées. Ne pas annoncer un contrôle IMEI, une garantie ou une authenticité sans source effective.

Réception partielle par article et quantité. Différence entre contenu attendu et reçu, dossier de preuve, tâche de résolution. Une fiche réutilisable conserve les caractéristiques et défauts constatés pour préparer les annonces sur plusieurs plateformes, sans publier avant validation.

## 6. Retours, litiges et après-vente

Dossier lié à la commande : demande, raison, échéance réellement fournie, échanges autorisés, justificatifs, retour physique, contrôle et remboursement. Distinguer remboursement initié et confirmé, colis revenu et article revendable. Réintégration en stock après contrôle, pas après seule notification de retour.

Rappels internes facultatifs de prochaines actions, pas de compteurs artificiels sur l'accueil. Les actions distantes dépendent des API et droits du compte ; une tâche de suivi locale reste possible lorsqu'eBay exige son propre parcours.

## 7. Autres fonctions conservées

- Recherche globale : réutiliser la recherche existante, indexer les types manquants dans le périmètre autorisé, afficher la source et l'identité exacte.
- Vue complète d'un article : étendre les détails existants ; achat, annonces, coûts, vente, justificatifs et messages seulement si leurs liens sont prouvés. Pas de fusion de produits identiques.
- Bénéfice explicable : étendre les calculs brut/net déjà présents ; montrer chaque poste et les manques, sans bénéfice fictif.
- Actions groupées : aperçu des changements et des exclusions, confirmation, résultat par élément ; pas de réessai commercial aveugle après timeout.
- Synchronisation par compte : dernière réussite par type de donnée, erreurs et portée ; une lecture partielle ne devient pas « tout synchronisé ».
- Expéditions regroupées : transporteur/destination lorsque connus, bordereaux reliés par identité ; distinguer préparation, dépôt et preuve d'expédition.
- Annulation de modifications locales : historique versionné et retour explicite, avec contrôle des changements intervenus depuis. Ne pas promettre d'annuler une action distante irréversible.
- Dossier comptable mensuel : justificatifs réellement disponibles, source de chaque montant, couverture de période et export sans doublons.
- Budget d'achat par collaborateur : demande d'achat et seuil de validation, sans accès implicite aux finances globales ni achat bancaire automatique.
