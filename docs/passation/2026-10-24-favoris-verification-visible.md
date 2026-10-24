# Vérification des favoris : action et résultat visibles

Le vendeur transmet encore seulement le contrôle du lancement, puis copie la liste de quatre favoris avec « 0 sélectionné » et l'ancien refus. Il n'y a pas de nouveau retour d'ouverture. Ce texte ne permet pas de confirmer que la commande d'ouverture a atteint l'extension. Sur téléphone, le bouton de ligne n'affichait qu'une icône.

Ajout d'un bouton principal « Vérifier un favori » au-dessus de la liste, utilisable sans cocher ni lancer les envois. Il vérifie seulement le premier favori visible disponible. En présence d'une sélection, le libellé devient « Vérifier le premier sélectionné » : il utilise un seul élément disponible de cette sélection ; aucun repli vers un favori non sélectionné si tous les sélectionnés sont bloqués. Même fonction d'ouverture que sur chaque ligne, avec les mêmes contrôles. Aucun appel de message et aucun traitement en lot.

L'erreur, le résultat et « Copier le contrôle » passent avant la liste, pour qu'une ouverture refusée ne soit pas noyée sous l'ancien échec d'envoi. Contrôle de version et classification du refus PR677 conservés. Extension reste 5.221. L'origine du refus dans la session client demeure inconnue ; ne pas annoncer les envois corrigés.

Tests React sur trois largeurs : bouton texte visible, clic sans sélection sur un seul favori disponible, aucun message, bouton désactivé pendant ouverture, refus situé avant la liste et diagnostic préservé. Banc app intégrale adapté pour utiliser le bouton principal à la place de l'icône. Fixtures uniquement ; aucune session réelle ni message Vinted testé.
