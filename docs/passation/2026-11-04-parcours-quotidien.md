# Parcours quotidiens — 4 novembre 2026

Base main 4b8c25ed. Les dix améliorations demandées renforcent les composants
existants, sans nouveau rapprochement par titre, règle financière ou envoi marchand.

1. Contexte : les préférences `useVueSession` survivent au remontage/rechargement
   via sessionStorage, par propriétaire et pendant sept jours. Nettoyage à la
   déconnexion/changement de propriétaire ; au démarrage conserver seulement le
   propriétaire restauré. Défilement conservé sur navigation et pagehide.
2. Fiche centrale : le parcours existant par identité conserve ses annonces,
   republications, prix, offres et documents. Navigation directe vers ses étapes
   (mouvement réduit respecté), avec accès au journal local du numéro.
3. Sélection : récapitulatif exact des colis cochés, plateformes et comptes
   identifiés ; les lignes non cochables (eBay) et les doublons sont exclus.
4. Erreur : si aucun PDF n'est lisible, la sélection des échecs est conservée.
   Sur succès partiel, seuls les identifiants refusés restent cochés, avec une
   explication. Garde propriétaire/empreinte relue avant toute nouvelle étape.
   Les éditeurs existants gardent leur saisie et leurs reprises ciblées.
5. Historique : numéros, prix d'achat et associations scalaires observés dans les
   sauvegardes locales réussies. Ancien → nouveau, date et numéro quand connu.
   100 entrées max, sept jours, filtré dans la fiche et consultable dans Réglages
   → Ce que VRM a fait. N'affirme PAS la synchronisation ni l'auteur du geste,
   ne reconstitue PAS les changements antérieurs et n'est pas un journal serveur.
6. Listes : pagination conservée, progression explicitée et extension de liste
   rendue via transition React ; la limite affichée Ventes/Messages est retenue.
   Une nouvelle recherche remet la limite des ventes au début, pas le remontage.
7. Périodes : un clic explicite reprend la dernière plage valide de ce propriétaire
   dans les calendriers des ventes, achats et cartes de chiffres. Pas de changement
   automatique de base de calcul. Les calendriers de listes nomment leur date.
8. Impression : récapitulatif avec/sans PDF et déjà imprimés, sans marquer expédié.
9. Recherche : motif visible pour les titres/numéros et infobulle par type de
   correspondance ; les routes et identités de résultats sont inchangées.
10. Boutons : gestes de la journée nommés (colis, retraits, messages, baisses),
    affichage des suivants et reprise d'impression déjà contextualisés.

Tests synthétiques uniquement. Aucun secret ou texte de message journalisé.
Aucune promesse de journal synchronisé, compatibilité navigateur non vérifiée,
ni modification de Google Cloud. Extension inchangée.
