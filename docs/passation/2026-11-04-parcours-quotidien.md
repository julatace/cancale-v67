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

## Blocage prioritaire : bordereau Vestiaire

Julien signale qu'il ne peut pas ouvrir le bordereau d'une vente. La lecture
était hors du try/catch et le bouton n'avait pas de finally : rejet/attente
pouvait le laisser en état « lecture ». Lecture bornée à 20 s, propriétaire
contrôlé avant/après, erreur visible et remise en état du bouton, verrou contre
les doubles clics. Le tamponnage relit aussi le propriétaire juste avant
l'ouverture du PDF, puis avant le marquage imprimé.

Un geste distinct « Ouvrir le PDF d’origine » lit et valide le vrai PDF sans
le modifier, sans tampon ni marquage imprimé. Le bouton normal conserve le
chemin de tamponnage et les confirmations. Aucun bordereau n'est choisi par
ressemblance. Absence, échec de lecture et fichier refusé restent distincts.

Tests : lecteur (absence, rejet, délai, changement de compte) ; bouton et
contrôleur réels en React à 390/1512, vrai PDF synthétique pour l'ouverture
originale, reprise après erreur, double clic et réponse périmée. Aucun compte
réel ni PDF de client disponible dans cet environnement.

Le contrôle de parité a détecté une collision entre la deuxième action de PDF
et le menu « … » dans la carte compacte de Colis. L'ouverture originale reste
réservée au récapitulatif de vente ; la carte compacte garde un seul bouton
flottant. Test explicite sur le composant et reprise du scénario « Colis fait »
(aller dans Envoyés puis annuler), sans force-click.

## Simplification des retraits et emails

- Retraits : bouton d’ouverture explicite, chevron, titre complet dans le détail ; Code et J’ai retiré restent des actions indépendantes. Aucun changement des règles de collecte ni des rapprochements.
- Réception : un seul message et une seule action de réessai lors d’un premier échec ; avertissement conservé si des données anciennes sont encore affichées.
- Texte des emails : réessai individuel sans recharger le journal ; texte toujours échappé, réponse tardive ignorée après démontage.
- Validation : retraits 117 contrôles ; espace emails 57 ; synthèse réception téléphone et ordinateur ; réessai du texte avec erreur simulée puis succès et HTML inactif. Données fictives uniquement.
