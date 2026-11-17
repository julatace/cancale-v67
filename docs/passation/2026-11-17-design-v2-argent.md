# 17 nov. — Nouveau design, phase 2 : Argent et Paramètres (branche `claude/design-v2-argent`)

Dépend du lot design-v2 (`claude/design-v2`, réglage `vrm_design_v2`, éteint par défaut). Éteint ⇒ Argent,
Statistiques, Déclarer, Factures et Paramètres sont ceux d'avant (signature DOM mesurée, voir Preuves).
Aucun calcul changé : on choisit, on range, on nomme.

## Ce que voit Julien, allumé

**L'en-tête des quatre écrans d'Argent** : « Argent » (34/700) avec la cloche sur la même ligne (la tête de la
coque ne prend plus de bande, comme Annonces) ; UNE ligne « Toutes les plateformes · 2 comptes › » (les comptes qui
entrent dans les totaux, la règle `compteEcarte` ; le toucher mène aux comptes) ; UN segmenté
Mois · Statistiques · Déclarer · Factures (les mêmes chemins, `ONGLET_SEGMENT`). Code : `ArgentNav` (src/App.jsx).

**Mois** (src/designV2/ArgentMois.jsx, données préparées par `ArgentMoisV2` dans src/ecrans/Compta.jsx) :
- le chiffre d'affiche « 277 € reçus en novembre » (56/700, le mot sur la même ligne de base) — REÇU, daté au
  versement : la valeur de la case « Reçu » d'hier (`valeurChiffre('recu')` par `questionsArgent`) ; « au moins »
  au-dessus quand il est partiel ; la phrase dessous vient de la même règle (sa note, sinon « Daté au jour du versement ») ;
- six mois en barres (72 px) : le mois en cours = l'affiche ; les cinq d'avant = `recuPublieEntre` mois entier (la
  lecture de « Comparer deux mois »), une barre « pas su » est un contour, jamais une barre à zéro ;
- UNE carte de quatre faits, chacun la porte de son détail : Disponible (`dispo`, porte-monnaie), En attente
  (`attente`, l'écran « Argent à venir »), Bénéfice (la règle de la case d'hier : le net, sinon le brut et jamais
  « au moins » sur le brut), Coûts saisis « N sur M » (la couverture du bénéfice) ;
- le seul plein, seulement s'il y a un geste : « Saisir 4 prix d'achat » (le chiffre faux est la porte,
  `DEMANDE_SAISIE_PRIX`, le même geste que la porte ambre d'hier, le même nombre) ;
- « Versements de novembre » : le livre des recettes du mois (`recettesDe`, la lecture de « Registres »), du plus
  récent au plus ancien, rangées A : titre, étiquette N° kraft (`.v2-etiquette`, signature du design ; dessin de repli
  sous `:where()` dans argent-v2.css tant que le composant commun n'est pas arrivé), jour · plateforme, montant ;
  30 au plus puis « et N autres dans Déclarer → Registres ». Toucher une rangée à N° ouvre sa fiche.
- dessous, le « Détail » d'hier (bénéfice ligne par ligne, vendu et reçu, bilan, rapport, délai, porte-monnaie,
  dépenses) : inchangé. Les quatre réponses, « À venir » et l'anneau d'hier restent MONTÉS, cachés (mêmes lectures,
  mêmes data-*).

**Déclarer, Factures, Statistiques** : le même en-tête ; le contenu d'hier, un seul plein par écran (les autres
`vrm-b-primaire` et « Copier » sont teintés : `@layer vrm-verre`, la première couche, la seule qui bat les
`!important` d'hier). « J'ai déclaré » reste le seul plein de Déclarer, seulement sur SON toucher (`demanderDeclaration`).

**Paramètres (téléphone)** : la liste groupée d'iOS — « Compte » (la carte), « Réglages » (les catégories en rangées :
icône teintée, nom 17/400, valeur, chevron, séparateurs indentés), « Avancé » (Sécurité des données, inchangée à
l'intérieur). Les mêmes `ligneCategorie` / `data-categorie-ouvrir`. L'interrupteur « Nouveau design (essai) » reste
dans Apparence et langue → Apparence.

## Preuves
Banc `scripts/bancs/design-v2-argent.cjs` (jeu de `nouveau-vendeur`, micro mensuel, versements de septembre à
novembre, un titre très long ; 390 tactile sombre et clair, 1512 clair et sombre) : chiffres éteint = allumé (REÇU,
graphe, BÉNÉFICE, VENDU de « Comparer », URSSAF à payer et CA de Déclarer, le geste ⇔ la porte d'hier), structure,
un plein, cibles ≥ 44, rien de tronqué ni de débordant, contraste, Paramètres, et la signature DOM éteinte = celle du
build de `origin/claude/design-v2` (`BANC_REFERENCE`). Chiffres exacts : le corps de la PR.

## Ce qui reste
- Statistiques garde, sous l'en-tête, « Mes ventes · Prix qui marche » et la période : trois contrôles ; à ranger
  (la période dans « ⋯ » ? « Prix qui marche » en rangée ?).
- Déclarer et Factures : le contenu d'hier dans la coque neuve ; leurs cartes ne sont pas encore redessinées.
- Paramètres à l'ordinateur : le sommaire d'hier.
- Passer à `.v2-etiquette` commun dès qu'il arrive de `claude/design-v2` (retirer le dessin de repli).
