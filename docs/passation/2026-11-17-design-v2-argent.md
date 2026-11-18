# 17 nov. — Nouveau design, phase 2 : Argent et Paramètres (branche `claude/design-v2-argent`)

Dépend du lot design-v2 (`claude/design-v2`, réglage `vrm_design_v2`, éteint par défaut). Éteint ⇒ Argent,
Statistiques, Déclarer, Factures et Paramètres sont ceux d'avant (signature DOM mesurée, voir Preuves).
Aucun calcul changé : on choisit, on range, on nomme.

## Ce que voit Julien, allumé

**L'en-tête des quatre écrans d'Argent** : « Argent » (34/700) avec la cloche sur la même ligne (la tête de la
coque ne prend plus de bande, comme Annonces) ; UNE ligne « Toutes les plateformes · 2 comptes › » (les comptes qui
entrent dans les totaux, la règle `compteEcarte` ; le toucher mène aux comptes) ; UN segmenté pleine largeur, quatre
parts égales (`SegmentV2` partagé) Mois · Statistiques · Déclarer · Factures (les mêmes chemins, `ONGLET_SEGMENT`) ;
en grand texte, 2 × 2 (jamais un segment rogné). Code : `ArgentNav` (src/App.jsx).

**La tête de la coque au téléphone (Annonces, Argent, Paramètres)** : une barre FIXE pleine largeur de 56 px, la cloche à
droite à la même place qu'en haut de page (rien ne saute : CLS 0 mesuré au changement de segment) ; transparente en haut
(les touchers passent), en verre une fois défilée, le titre centré. Avant, défilée, un bloc clair se posait sur l'affiche
(revue du coordinateur). Paramètres perd la rangée de ronds d'hier (loupe, profil) comme Annonces.

**Mois** (src/designV2/ArgentMois.jsx, données préparées par `ArgentMoisV2` dans src/ecrans/Compta.jsx) :
- le chiffre d'affiche « 277 € reçus en novembre » (la signature `v2-affiche-sig` : 56/700, le mot sur la même ligne de base) — REÇU, daté au
  versement : la valeur de la case « Reçu » d'hier (`valeurChiffre('recu')` par `questionsArgent`) ; « au moins »
  au-dessus quand il est partiel ; la phrase dessous vient de la même règle (sa note, sinon « Daté au jour du versement ») ;
- six mois en barres (80 px) : le mois en cours = l'affiche ; les cinq d'avant = `recuPublieEntre` mois entier (la
  lecture de « Comparer deux mois »), une barre « pas su » est un contour, jamais une barre à zéro ; le montant est
  écrit au-dessus de la barre CHOISIE seulement (le mois en cours, ou celle qu'il touche) ;
- UNE carte de faits, chacun la porte de son détail (un fait pas su n'est pas une carte « — » : il est nommé sur UNE
  ligne « Pas encore lu : Disponible », AJOUT 3.3) : Disponible (`dispo`, porte-monnaie), En attente
  (`attente`, l'écran « Argent à venir »), Bénéfice (la règle de la case d'hier : le net, sinon le brut et jamais
  « au moins » sur le brut), Coûts saisis « N sur M » (la couverture du bénéfice) ;
- le seul plein, seulement s'il y a un geste : « Saisir 4 prix d'achat » (le chiffre faux est la porte,
  `DEMANDE_SAISIE_PRIX`, le même geste que la porte ambre d'hier, le même nombre) ;
- « Versements de novembre » : le livre des recettes du mois (`recettesDe`, la lecture de « Registres »), du plus
  récent au plus ancien : titre sur 2 lignes au plus, étiquette N° kraft (`Etiquette` de src/designV2/Signature.jsx),
  jour · plateforme, montant, et « acheté 60 € → +69 € » quand le prix d'achat est connu (le relevé de Ventes,
  `vrm_stats_ventes` [4] et [5], la règle de « Ce qui rapporte » : marge = vente − achat ; rien sinon) ; un squelette
  de la forme des rangées pendant la lecture ;
  30 au plus puis « et N autres dans Déclarer → Registres ». Toucher une rangée à N° ouvre sa fiche.
- dessous, le « Détail » d'hier (bénéfice ligne par ligne, vendu et reçu, bilan, rapport, délai, porte-monnaie,
  dépenses) : inchangé. Les quatre réponses, « À venir » et l'anneau d'hier restent MONTÉS, cachés (mêmes lectures,
  mêmes data-*).

**Factures** (revue du coordinateur) : la tête du design (« Argent » + le plein « + Facture » sur la ligne du titre),
UNE recherche (en direct) + « ⋯ » (relire, Excel, ma facture, réglages : la même feuille), UN segmenté
En attente · Comptabilisées, la liste (le même tableau) ou un état vide dessiné ; les cartes d'hier dessous.

**Déclarer, Statistiques** : le même en-tête ; le contenu d'hier, un seul plein par écran (les autres
`vrm-b-primaire` et « Copier » sont teintés : `@layer vrm-verre`, la première couche, la seule qui bat les
`!important` d'hier). « J'ai déclaré » reste le seul plein de Déclarer, seulement sur SON toucher (`demanderDeclaration`).

**Paramètres (téléphone)** : la liste groupée d'iOS en `RangeeTouchable` — « Compte », « Réglages » (icône teintée, nom
17/400, valeur, chevron, séparateurs indentés), « Avancé » (Sécurité des données, inchangée à l'intérieur) ; les mêmes
`data-categorie-ouvrir`. « Tout va bien ? » : une rangée blanche à point ambre (plus un aplat). Recherche « Chercher un
réglage ». En grand texte, la valeur passe sous le nom (aucun mot coupé). L'interrupteur « Nouveau design (essai) » reste
dans Apparence et langue → Apparence.

## Preuves
Banc `scripts/bancs/design-v2-argent.cjs` (jeu de `nouveau-vendeur`, micro mensuel, versements de septembre à
novembre, un titre très long ; 390 tactile sombre et clair, 1512 clair et sombre) : chiffres éteint = allumé (REÇU,
graphe, BÉNÉFICE, VENDU de « Comparer », URSSAF à payer et CA de Déclarer, le geste ⇔ la porte d'hier), structure,
un plein, cibles ≥ 44, rien de tronqué ni de débordant, contraste, Paramètres, et la signature DOM éteinte = celle du
build de `origin/claude/design-v2` (`BANC_REFERENCE`). Chiffres exacts : le corps de la PR.

### Paramètres réorganisé (Julien : « c'est beau mais les cases sont dispersées partout »)
Inventaire d'avant (téléphone, allumé) : une carte « Mon compte », une liste « Réglages » de 8 catégories, une liste
« Avancé » (Sécurité des données) — trois blocs. Après : UNE liste de neuf sections, dans l'ordre des Réglages d'iOS,
chacune avec icône, nom, valeur actuelle et chevron ; un toucher ouvre sa page (ses groupes d'hier, tels quels) :

| section (nouveau nom) | avant | ce qu'elle tient |
|---|---|---|
| Compte | carte « Mon compte » | profil, abonnement, connexion, équipe, déconnexion, fermer le compte |
| Plateformes et comptes | « Mes plateformes » | comptes reliés, extension, onglets, e-mails |
| Ventes et colis | idem | impression, colis (SMS, carte merci), modèles d'annonce |
| Stock et numéros | idem | numéros, « je vends » |
| Argent et compta | « Argent » | régime, prix d'achat, ventes masquées, objectif du mois |
| Apparence et langue | idem (avant Notifications désormais) | langue, thème, nouveau design, zoom, taille du texte, écrans, Stream, raccourcis |
| Notifications | idem | push, rappels, agenda, alertes, capte |
| Sécurité et données | « Sécurité des comptes » + « Sécurité des données » (expert) | gardes des comptes (discrétion, vacances, santé, copie) PUIS le panneau technique « Sécurité des données » tel quel, sauvegarde/export/restaurer/corbeille, confidentialité |
| Aide | « Aide et Tout va bien ? » | Tout va bien ?, aide, revoir, propriétaire |

Déplacés : seulement les deux catégories de sécurité, réunies (leurs rangées et leurs panneaux inchangés). La recherche
« Chercher un réglage » liste les rangées trouvées (« dans Section ») ; un toucher ouvre la section, amène la rangée au
centre et la surligne 2,4 s. Ordinateur : deux colonnes, les neuf sections à gauche, la section choisie à droite.
Banc (R) : 9 sections dans l'ordre, aucune carte à part, CHAQUE rangée d'hier (relevée éteint, section par section)
atteinte en deux touchers, la recherche « langue » mène à sa rangée surlignée, deux colonnes à 1512.

### AIR (Julien : « c'est trop compacté »), mesuré par le banc (A)
Texte ≥ 20 px du bord de SA carte (les cartes d'hier d'Argent passent à 20 px : `vrm-surface`, `vrm-urssaf-geste`,
`vrm-mb`, `vrm-compta-carte`, `vrm-ac-*`, `vrm-d7-*`, `vrm-stva`, `vrm-fp-section`…), 16 px entre deux cartes, 32 entre
deux sections, rangées de liste ≥ 64 px, ≥ 12 px entre deux boutons, jamais 3 boutons ou plus sur une rangée (empilés),
interligne 1,4. Registres : « PDF · Tableur · Voir » ⇒ « Voir » + « ⋯ » (PDF, Tableur : la même `exporter`). Les replis
voisins (Tes déclarations URSSAF, Ta micro-entreprise, DAC7 ; le Détail du Mois) forment UNE liste groupée de rangées de
64 px avec leur résumé. Tout dans `@layer vrm-verre`, seulement allumé.

### Qualité et fluidité (la grille du 17 nov. soir), mesurée par le banc
Appui < 100 ms (le fond change à 60 ms), CLS hors geste 0 au changement de segment, jamais d'écran blanc, mouvement réduit
respecté, texte en 13 · 15 · 17 (+ chiffres 22 et 56), rayons 12 · 14 · 20, faits d'une rangée de même hauteur, aucun mot
coupé en deux (titres, montants) à 390, 375 et « Très grand », rangées en `content-visibility`.

## Ce qui reste
- Statistiques garde, sous l'en-tête, « Mes ventes · Prix qui marche » et la période : trois contrôles ; à ranger
  (la période dans « ⋯ » ? « Prix qui marche » en rangée ?).
- Déclarer et Factures : le contenu d'hier dans la coque neuve ; leurs cartes ne sont pas encore redessinées.
- Paramètres à l'ordinateur : le sommaire d'hier.
- Passer à `.v2-etiquette` commun dès qu'il arrive de `claude/design-v2` (retirer le dessin de repli).
