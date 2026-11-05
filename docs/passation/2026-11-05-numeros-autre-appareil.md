# 5 novembre — « Un autre appareil vient de donner des numéros » ne bloque plus l'écran

Capture de Julien (Edge, 14 h 12) : le bloc « Recharger » plein écran. Mesuré (journaux Postgres,
lecture seule) : `vrm_fiche_perdue` à 12:13:14 UTC. Son téléphone avait numéroté N°132 à 141 le matin
(fiches de `main`, `numberedAt` 07:39 et 10:07 UTC) ; son Edge, ouvert avant, a envoyé une fusion où une
fiche numérotée manquait de son côté. La fusion à trois voies (`src/fusionNuage.js`, 1er nov.) prenait
ce retrait pour un geste de l'appareil ; la base l'a refusé (rien n'était perdu) et l'écran s'est bloqué.

- `garderFichesNumerotees` (src/fusionNuage.js, appelée par `fusionnerLigne` pour
  `vinted_annonce_numeros`) applique AVANT d'écrire la règle de la base : une fiche numérotée du nuage
  ne sort jamais de la fusion, sauf remplacée par une reprise (`repriseDe`). Rien n'est renuméroté ; la
  fiche revient telle quelle dans l'appareil après l'écriture (`poserFusionLocale`).
- Preuves : `audit-fusion-nuage.cjs` +3 contrôles (1 rouge sur origin/main cdd871a4, vert après ;
  mutation « fiche numérotée perdue par la fusion » vue) ; banc `deux-appareils.cjs` scénario I (un
  appareil qui a perdu une fiche numérotée, garde-fou 017 émulé) : **3 rouges sur le build de
  cdd871a4** (`vrm_fiche_perdue`, bloc ouvert), 33 OK après.
- Non mesuré : POURQUOI l'Edge avait perdu cette fiche de son côté (la cause locale n'est pas prouvée) ;
  la correction protège quelle qu'elle soit.
- Vu sur la capture, pas corrigé ici : libellés du rail coupés (« Ven », « Gér », « Arg », « Plat ») et
  logo « VI » sur Edge.
