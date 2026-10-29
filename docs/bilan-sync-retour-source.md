# Bilan de synchronisation : retrait et retour d’une source

Une source retirée du tableau puis réintroduite avec exactement le même contenu
ne réapparaissait plus : ses lignes et sa référence de comparaison étaient effacées,
mais son empreinte de lecture restait mémorisée.

Le retrait invalide maintenant également cette empreinte. Le retour établit une
nouvelle première lecture, sans présenter les anciens éléments comme de nouvelles
ventes. Le rendu filtre immédiatement les comptes absents des sources actuelles,
avant même l’exécution de l’effet React.

Preuve : le banc `bilan-synchronisation-interface.cjs` échoue sur l’ancien code
au retour de la source identique. Après correction : 45 contrôles sur 320, 390 et
1512 pixels, dont retrait/retour, erreurs de lecture et changement de propriétaire.
Aucune requête vers un compte marchand ou une base de production dans ce banc.
Ce bilan demeure une comparaison des lectures de la session, pas une certification
de l’exhaustivité des données de plateforme.
