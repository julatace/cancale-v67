# Achat, offres, enchères et budgets

## Matrice d'activation

| Niveau | Fonctionnement | Conditions de lancement |
|---|---|---|
| Veille | Résultats et alertes | Contrat de lecture validé, quota opérationnel, collecte réellement active |
| Achat assisté | Préparer une décision et ouvrir le parcours eBay autorisé | Relecture actuelle, prix/destination explicites ; aucun débit par simple clic « retenir » |
| Offre assistée | Préparer prix et question | API et droit d'envoyer vérifiés ; confirmation du destinataire et du montant |
| Achat automatique | Engagement financier sans validation de chaque article | Accès officiel, contrat produit, pays/catégorie, paiement et mandat utilisateur vérifiés séparément |
| Enchère automatique / dernière seconde | Engagement distinct de l'achat à prix fixe | API et règles dédiées vérifiées ; aucune promesse issue du droit de recherche |

Sans preuve, désactiver la fonction et dire pourquoi. Pas de bouton donnant l'impression d'acheter alors qu'il ouvre seulement eBay. Pas de contournement d'authentification, CAPTCHA, 3-D Secure ou contrôles de plateforme. La règle de prix n'est pas un mandat de paiement.

## Configuration d'une éventuelle autorisation automatique

Utilisateur responsable, compte autorisé, devise, destination, recherches autorisées, catégories admises, états et exclusions, maximum par article/commande, quantité maximale par produit et recherche, enveloppe journalière/hebdomadaire/mensuelle et durée du mandat. Définir également les plafonds globaux partagés entre recherches et collaborateurs.

L'enveloppe appartient à VRM : ce n'est pas une lecture du solde bancaire ni une prévision de trésorerie. Aucun achat à crédit supposé. Les caractéristiques obligatoires inconnues interdisent le mode automatique ; un faible score de risque ne contourne pas cette règle.

Aucune quantité, devise ou enveloppe monétaire illimitée par défaut. Pause immédiate, arrêt après objectif atteint et révocation depuis tout appareil. Les modifications de mandat sont versionnées ; une tâche en file doit revérifier la version avant d'engager.

## Montants et concurrence

Montants en unités monétaires mineures, avec précision de la devise. Pas de calcul financier en flottants binaires. Taux de conversion daté et source visible ; une conversion indicative ne suffit pas à garantir un plafond de débit dans une autre devise.

Un coût certain combine les postes réellement fournis pour l'annonce, sa quantité et la destination : article, livraison, taxes et frais applicables. L'absence d'un poste n'est pas un zéro. Un retrait local peut avoir une livraison nulle seulement si ce mode est explicitement choisi et admis.

Pour toute action activée : transaction serveur atomique de réservation du budget, limites par jour/recherche/compte/équipe vérifiées ensemble, identifiant idempotent de tentative et horodatage serveur. Deux workers ne réservent pas deux fois le même budget ; deux recherches ne peuvent pas provoquer deux achats du même candidat par le même mandat. Des vendeurs VRM différents restent indépendants ; pas de fuite entre eux.

## Machine d'état

`repéré → à vérifier → admissible → devis relu → budget réservé → demande soumise → confirmé / refusé / résultat incertain`.

- Prix ou frais changés : refaire l'évaluation et la réservation ; ne pas accepter un nouveau total hors mandat.
- Annonce indisponible : libérer une réservation non engagée sur preuve de refus.
- Timeout après soumission : **résultat incertain**, pas « échec » et pas de deuxième achat automatique.
- Réconciliation par l'identité de tentative/commande supportée par le contrat ; si aucune méthode fiable n'existe, suspendre et demander une vérification humaine.
- Garder l'enveloppe engagée dans un résultat incertain jusqu'à résolution. Ne pas la rendre disponible à une autre recherche par simple expiration technique.
- Confirmation : enregistrer identifiant réel, compte, total, devise et source. Une annonce retenue manuellement n'est pas une commande confirmée.

L'idempotence interne ne prouve pas l'idempotence d'une API distante. Documenter précisément le mécanisme eBay disponible avant d'activer les reprises.

## Enchères, offres et lots d'achat

Séparer montant d'enchère maximal et prix final inconnu. Les groupes « en acheter au plus un » réservent le risque maximal simultané ; ne pas compter sur l'échec d'une autre enchère. La livraison et les conditions restent vérifiées pour chaque annonce. Pas de garantie de gagner, ni de gagner moins cher, ni d'enchère à la dernière seconde sans contrat et infrastructure validés.

Une offre préparée est un brouillon. L'envoi est une action commerciale avec résultat propre ; une offre acceptée peut avoir des obligations selon le contrat eBay. Vérifier ce point avant automatisation. Une fenêtre de temps ou un prix expiré exige une nouvelle validation.

## Réception après achat

Commande confirmée → contrôle de données → mission de récupération ou réception → colis reçu → contenu vérifié. Ne pas ajouter automatiquement le stock disponible au seul clic d'achat. Traiter les accessoires manquants, colis partiels, retours et remboursements séparément. Le coût d'achat comptable provient de la commande confirmée et des justificatifs, pas du prix affiché au moment de l'alerte.
