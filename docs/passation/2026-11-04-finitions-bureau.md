# Finitions de bureau — 4 novembre 2026

Suite de #1008, base 27498fad. Demande : les cinq améliorations proposées
(ventes, messages, filtres, paramètres, finitions), en conservant le téléphone.

- Messagerie : deux volets de 1024 à 1439 px, trois ensuite. Le résumé de
  l'article reste dans le fil quand la fiche latérale est cachée. Les actions
  d'offre restent groupées ; aucun changement de leurs gardes ou de leur envoi.
- Ventes : colonnes de photo, article, statut et montant ; achat et bénéfice
  visibles dans les lignes qui possèdent déjà ces données. La vue toutes
  plateformes sépare compte, date, état et prix sans déduire d'état manquant.
  L'ancienne description reste accessible aux lecteurs d'écran.
- Filtres : la recherche globale rétrécit avant de toucher les plateformes.
  Les filtres métier peuvent revenir à la ligne ; aucun filtre n'est supprimé.
- Paramètres : retour de sous-écran plus visible, champs bornés à leur conteneur,
  textes longs coupables de débordement autorisés à revenir à la ligne.
- Menus et clavier : hauteur maximale, défilement interne, focus visible.
  Suppression d'une accolade CSS isolée dans styles-visite.css (warning du build).

CSS réservé au bureau >=1024 px ; aucune nouvelle taille ni disposition iPhone.
Essais sur données fictives, sans requête marchande réelle. Captures bureau et
comparaison de la référence téléphone. Le banc bureau-chargement couvre sept
écrans à six largeurs, les colonnes du fil, les collisions de la barre de recherche
et les cellules des vraies lignes Vinted après changement de plateforme.

Google Cloud : la marque OAuth nécessite toujours l'accès administrateur absent
ici ; procédure dans docs/connexion-google-marque-vrm.md. Aucune configuration
externe modifiée, aucune version d'extension changée.
