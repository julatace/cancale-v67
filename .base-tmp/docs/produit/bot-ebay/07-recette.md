# Recette et critères de lancement

## Recherche et catégories

1. Petit budget avec port inconnu : résultat « à vérifier », pas de total garanti.
2. Frais confirmés dépassant le plafond : rejet, même si le prix de l'article seul passe.
3. Changement de destination : invalide le devis de livraison précédent.
4. Taille absente, référence partielle, compatibilité non fournie : inconnu, pas oui.
5. Recherche « pour pièces » explicitement voulue : ne pas la rejeter par une exclusion globale cachée.
6. Lot de quantité inconnue : pas de prix unitaire certain.
7. Plusieurs variantes d'une annonce : stock, frais et prix de la variante ciblée.
8. Deux articles identiques : identités conservées, aucune fusion par titre.
9. Marketplace/catégorie non supportée : refus compréhensible, pas une recherche faussement active.

## Collecte et alertes

10. Première collecte avec 300 résultats : pas de 300 notifications « nouvelles ».
11. Même annonce présente sur deux pages et trois recherches : décisions/alertes dédupliquées selon leur périmètre.
12. Annonce refusée : ne revient pas à chaque polling ; règle de nouvelle baisse explicite.
13. Réponse 429 : reprise bornée suivant les indications, aucune rotation pour contourner le quota.
14. Timeout de lecture : résultats conservés avec date et état d'erreur ; jamais « zéro résultat ».
15. Pagination tronquée : couverture partielle visible ; ne pas marquer toutes les annonces absentes comme supprimées.
16. Deux vendeurs VRM : aucun résultat privé, budget ou destinataire partagé.
17. Pause ou révocation pendant une notification en file : nouvelle permission vérifiée avant envoi.
18. Fuseau et passage heure d'été/hiver : horaires silencieux respectés.
19. Push refusé ou non livré : pas de confirmation inventée ; liste intégrée accessible.
20. Mesures de latence séparées ; absence de taux d'occasions manquées présenté comme certain.

## Achat et budgets, si cette capacité est validée

21. Recherche créée sans mandat : impossible de payer automatiquement.
22. Deux workers et plusieurs recherches tentent le même candidat : au plus un engagement de ce mandat.
23. Deux annonces veulent le dernier budget disponible : transaction serveur, pas de dépassement.
24. Prix/port changés entre découverte et commande : nouvelle évaluation ; blocage si hors plafond.
25. Destination, quantité ou devise différentes du mandat : blocage.
26. Timeout après soumission : état incertain, budget conservé, aucune nouvelle commande automatique.
27. Confirmation distante retrouvée : une seule commande et une seule dépense.
28. Paiement exige une interaction eBay : suspension et parcours humain, pas de contournement.
29. Pause ou nouvelle version de mandat entre devis et soumission : dernier contrôle serveur.
30. Enchères groupées : pire engagement simultané couvert ; pas de garantie de victoire.

## Équipe et missions

31. Membre non attribué : pas de code de retrait ni de preuve privée.
32. Révocation : prochaines lectures et écritures refusées, même avec URL connue.
33. Deux personnes prennent une mission : conflit explicite, pas d'écrasement silencieux.
34. Mission de dix articles partiellement terminée : quantités/étapes restantes visibles.
35. « Colis récupéré » ne marque pas le contenu contrôlé ni la vente expédiée.
36. Exécutant sans droit de validation : peut terminer, pas s'auto-valider.
37. Changement de consignes pendant l'exécution : version et information de l'exécutant conservées.
38. Preuve révoquée/expirée : lien inaccessible ; aucune pièce privée dans un export public.
39. Membre au rôle limité : pas d'accès à l'argent par appel direct aux API ou à Supabase.
40. Récurrence relancée après incident : une mission par occurrence.

## Réservations, lots et consommables

41. Dernière unité réservée simultanément : un seul succès.
42. Expiration et vente simultanées : une transition valide, pas de quantité négative.
43. Acompte présent : expiration ne crée pas de remboursement ni ne l'efface.
44. Ventilation de 107,00 € en trois : 35,67 + 35,67 + 35,66, somme exacte.
45. Coût source inconnu : enfants non valorisés, pas coût zéro.
46. Article d'un lot déjà vendu : correction par ajustement audité, pas réécriture discrète.
47. Export : dépense du lot et allocations ne sont pas additionnées deux fois.
48. Réception partielle : stock disponible seulement pour les quantités contrôlées.
49. Consommables non initialisés : inconnu, pas stock vide.
50. Réimpression et requête rejouée : pas de seconde consommation de carton.
51. Annulation : matériaux remis en stock seulement si retour physique déclaré.
52. Rouleau/mètre sans conversion fournie : consommation bloquée ou unité inchangée, pas de facteur supposé.

## Interface et qualité

53. À 320, 390, 768 et 1440 px : gros montants, longues références, noms multilingues et états d'erreur sans chevauchement.
54. Clavier, lecteur d'écran, contrastes, réduction des animations et focus après fermeture.
55. Action groupée partiellement échouée : résultat de chaque élément, aucun succès global trompeur.
56. Liste actualisée sans effacer une décision en cours ni perdre un brouillon.
57. Recherche ou API indisponible : pas de démo inventée au milieu des vraies données.
58. Images expirées : cadre stable, source alternative prouvée, absence honnêtement indiquée.
59. Retour local : refuse d'écraser une modification plus récente ; action distante irréversible clairement distincte.
60. Migration manquante : fonction indisponible explicitement, pas de faux succès local.

## Conditions de lancement

Lancer la veille seulement après tests contractuels de lecture, quota et collecte durable, puis pilote mesuré. Lancer l'équipe seulement après migrations/RLS et tests de permissions. Lancer la ventilation comptable après validation des invariants et de l'export. L'achat automatique exige en plus accès officiel, mandat, transactions budgétaires, preuves de réconciliation et recette financière dédiée.

Aucun de ces scénarios n'a été exécuté sur un bot opérationnel dans cette tâche : ce sont les exigences de recette du développement à venir. Les tests des modifications d'interface déjà publiées ne prouvent pas ces fonctions futures.
