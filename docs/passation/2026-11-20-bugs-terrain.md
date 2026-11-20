# 20 nov. — bugs-terrain : ce que SA base révèle (branche `claude/bugs-terrain`)

Julien, après la mise en ligne du 20 nov. (d7bc5598a) : « C'est bien mais ça bug beaucoup trop encore ». Captures iPhone
(15:35) prises pendant que la barre bleue restait figée vers 80 % : Achats « À retirer au moins · 18 », « 13 à vérifier »,
puis rien ; Ventes « À envoyer » sans aucune photo ; Annonces en squelette.

## Mesuré (lecture seule, nombres agrégés)
- Sa base : 12 comptes Vinted, ~2 600 ventes et ~2 700 achats dans `orders_*` (un compte en porte ~2 000 de chaque),
  453 lignes `email_track_*`, 249 bordereaux. Les bancs servaient 3 à 7 comptes et 30 à 80 commandes par compte.
- Journaux Supabase de la session iPhone : toutes les lectures répondent en 200 (aucune panne serveur) ; ~700 requêtes en 3 min.
- Sonde `scratchpad/terrain/sonde.cjs` (hors dépôt) : l'app buildée, base INVENTÉE au volume de la sienne
  (`_base-volume.cjs` : 12 comptes, 2 600 ventes, 2 700 achats, 1 000 annonces), 390 tactile, processeur ×4.
  Résultat : 29 à 35 s de tâches longues sur 42 s ; les e-mails de suivi posés après plus de 20 s ; la barre du haut
  allumée presque tout le temps ; en v2, « À retirer au moins 0 » puis une zone vide.

## Corrigé
1. **Achats · À retirer n'est plus jamais un vide muet** (`src/App.jsx`, bloc v2) : lecture en cours ⇒ « Je lis tes colis… » ;
   lecture ratée (avant : `tracking` restait `null` pour toujours, sans phrase ni relecture) ⇒ la phrase + « Réessayer ».
   Le détail replié n'est monté qu'ouvert (`DetailsRepliOuvert`). Banc `retraits-jamais-muet` : 6 rouges sur origin/main, 12 verts.
2. **`texteVerifie`** (`src/sourcesRetrait.js`) : trois formateurs gardés au lieu d'un `Intl` neuf par appel (7 s sur 25 s au profil),
   textes identiques. `audit-texte-verifie` A–C.
3. **`jourDe`** (`api/_lib/retrait-colis.js`) : le jour de Paris gardé par heure (0,9 s au profil). `audit-texte-verifie` D.

## Vu, pas corrigé (à reprendre)
- Le fond du problème reste le CALCUL : Achats monte 3 `Comptabilite`, Ventes 2 ; chacun refait ses dérivés à chaque arrivée
  de données (11 s inclusifs au profil). Points chauds restants : `rangsEnvoyerNatif` (2,7 s, deux `toLocale…String` par rangée),
  `ajusterChiffre` (1,5 s de mises en page forcées), `useTitreReduit` (relit la mise en page toutes les 1,5 s), `load()` qui
  relit et reparse `vinted_annonce_numeros` (~250 Ko) dans des boucles de rendu.
- Photos des ventes (relues dans les transactions) : l'effet relit TOUT à chaque nouvelle référence de `sales.items` (journal :
  101 lectures `id=in.(…txn…)` en 2 min 30, les mêmes identifiants relus).
- `lireSuivisSansQr` relit les QR « retirés remis en jeu » par lots de 40 L'UN APRÈS L'AUTRE (8 allers-retours au banc).
- Ventes « À envoyer » sans photo : toutes ses 11 ventes à envoyer portent une photo ; tant que les commandes Vinted ne sont pas
  posées, les rangées viennent des e-mails (sans photo). C'est la lenteur, pas une donnée absente.
- Leboncoin : `lbc_listings` garde 49 annonces actives de 47 AUTRES vendeurs (vues en naviguant) ; l'écran Leboncoin les écarte
  (`annonceLbcALui`), à vérifier chez chaque autre lecteur.
