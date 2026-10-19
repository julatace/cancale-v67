# VRM — bot eBay et fonctionnalités retenues

Préparation produit et technique du 18 octobre 2026. **Ce dossier n'active aucun bot et ne prouve aucun droit d'achat eBay.** Il sert de contrat de réalisation, avec critères de recette et limites vérifiables. Les fonctionnalités décrites ne sont pas annoncées comme développées.

**Mise à jour du 19 octobre :** les premiers parcours sont développés. Voir [l’état exact de la livraison et ce qui reste à faire](08-livraison-organisation.md). Les chapitres de conception ci-dessous conservent le périmètre cible.

## La direction

Un assistant d'approvisionnement pour des revendeurs de toutes catégories : trouver les annonces pertinentes, expliquer ce qui est connu, décider en équipe, puis suivre la réception. L'objectif est la qualité des occasions reçues et la fiabilité des décisions, pas un compteur de notifications ni une promesse d'être systématiquement le plus rapide.

Trois niveaux indépendants :

1. **Veille** : recherche, contrôle des critères, alertes facultatives, décisions conservées.
2. **Achat assisté** : relecture d'une annonce et de son coût réel, validation par la personne autorisée, passage au parcours eBay disponible.
3. **Achat automatique conditionnel** : seulement si l'accès officiel de VRM, le pays, le compte et l'annonce le permettent, avec mandat de dépense explicite et plafonds serveur. Ce niveau n'est pas acquis.

Une recherche enregistrée ne donne jamais l'autorisation de payer. L'inspiration VTools concerne la simplicité de l'expérience ; elle ne constitue pas une preuve de fonctionnalités ou de droits eBay.

## Lire le dossier

- [Sources et comparaison à vérifier](01-sources-et-marche.md)
- [Expérience, catégories et budgets](02-produit-et-profils.md)
- [Recherche, quotas et qualité des alertes](03-moteur-et-alertes.md)
- [Achat, offres et enchères](04-achat-et-budgets.md)
- [Équipe, réservations, lots et autres fonctions](05-fonctionnalites-retenues.md)
- [Architecture et intégration dans VRM](06-architecture-et-livraison.md)
- [Scénarios de recette et décisions de lancement](07-recette.md)
- [Catalogue structuré](catalogue.json)

## Ce qui a réellement été vérifié

Inspection du code VRM : OAuth eBay côté serveur, outils vendeur et mode équipe existants. Lecture de deux dépôts officiels eBay sur GitHub : OAuth et Feed SDK. Les pages développeur eBay et les sites des concurrents ont été bloqués par le réseau de cet environnement (CONNECT 403). Les conditions commerciales, quotas, pays et droits d'achat actuels doivent donc encore être vérifiés. Aucun benchmark concurrentiel exhaustif n'a été réalisé ; aucun classement « meilleur du marché » n'est justifié à ce stade.

## Décisions de Julien conservées

- Tous types d'articles et tous niveaux de budget ; aucune logique réservée aux chaussures.
- Bot eBay, réservations, lots avec ventilation comptable, consommables, équipe et missions retenus.
- **Exclus** : simulateur de bénéfice avant achat, inventaire au téléphone, prévision de trésorerie.
- Un plafond de dépense d'achat reste nécessaire au bot ; il ne devient pas un simulateur de revente ou une prévision de trésorerie.
- Notifications de veille volontaires ; pas de réintroduction de notifications système dans la messagerie.
- Logo officiel actuel, palette ardoise et disposition validée conservés.
- Fonctions déjà présentes à étendre, pas à reconstruire. Les anciens catalogues d'idées ne réactivent pas une fonction rejetée depuis.

## Premier résultat utilisable visé

Créer une recherche → tester ses critères sur des résultats réellement lus → choisir les alertes → recevoir une annonce avec coût connu/inconnu et raison de correspondance → examiner/refuser/attribuer → ouvrir un parcours d'achat autorisé → enregistrer l'achat confirmé → mission de récupération/réception → contrôle → stock.

On n'affiche ni recherche « active » sans collecte effective, ni « aucun résultat » après une panne, ni « acheté » avant preuve. La préparation du dossier est terminée ; la livraison des modules reste un chantier distinct, découpé dans la feuille de route.
