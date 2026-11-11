# Revue adverse des trois lots colis — 11 nov. 2026

Branche revue : `claude/revue-colis` (partie de `claude/suivi-commandes`). Objet : `git diff origin/main...HEAD`
de `claude/suivi-commandes` — lot DJ3 (Colis rangé dans Ventes « À expédier » / Achats « À retirer », « Tout
imprimer » en trois temps), lot retraits fiables (point par identité, codes, relances, doublons, fantômes,
e-mails transporteurs), lot suivi des commandes (n° de suivi, statut, incohérences, lecture serveur).
Aucune écriture en base réelle, aucune PR, aucun merge.

## Défauts trouvés, prouvés, corrigés

| # | gravité | défaut | preuve | correction | commit |
|---|---|---|---|---|---|
| 1 | **haute** | « Tout imprimer » (⌘K « Imprimer les bordereaux du jour », `?print=bord`, case « à envoyer » de Ma journée) **ne s'ouvre pas** si Achats a été vu avant. Deux moteurs `Comptabilite only="bordereaux"` existent depuis DJ3 ; Achats est un écran GARDÉ : caché (suspendu), ses écoutes `window` posées par `useEffect` restent branchées. La plus ancienne (Achats caché) consomme `_pendingBordPrint`, la feuille s'ouvre dans l'écran invisible. | banc `tout-imprimer-garde` : rouge sur la branche (`false · ventes`, feuille vide), **témoin** `TEMOIN=1` (même geste sans passer par Achats) vert — c'est bien l'écran caché | seul un moteur MONTRÉ qui porte les colis à envoyer prend la demande (`prendImpression` : `colisDans!=='achats' && !cache()`) | 1er commit de la branche |
| 2 | moyenne | **Achats · eBay / Achats · Leboncoin montrent les colis VINTED à retirer, avec leurs codes.** La section « À retirer » ne recevait pas le site d'Achats (Ventes le passe), alors que le lot annonce « le filtre de Ventes / Achats, un seul » (et Julien, 2 nov. : « des données Vinted dans eBay, inadmissible »). Le filtre de site de l'ancien Colis → À retirer était donc perdu. | banc `achats-retirer-site` : codes `012345,654321` sous eBay et Leboncoin (rouge) | le site d'Achats est passé à sa section « À retirer » SAUF sur Vinted : Achats n'a pas de « Toutes », et Vinted est l'écran d'arrivée (Ma journée, notifications) — tous les colis y restent montrés, un achat Leboncoin au relais n'est jamais caché (1re version de ce correctif : le cachait, attrapé par `colis-qr` (8 rouges, achat Leboncoin) et `transporteurs-logos` (4 rouges, achat Vestiaire) ⇒ resserré : 100 verts et tout vert). « leboncoin » est un filtre comme un autre en section d'Achats | 2e et 7e |
| 3 | moyenne | **`?tab=plat_leboncoin&section=colis` ouvre un écran BLANC.** `PLACE_SECTION.leboncoin.colis` (src/navigationTache.js) visait `cat_bord`, et `setTab` applique `placeDesColis` AVANT cette table : `cat_bord` arrivait tel quel, aucun écran ne le rend plus. | banc `navigation-tache` F (`blanc:true`, vert sur `main`) ; banc `liens-colis-anciens` rouge avant (`tache:null`) | la table vise `['ventes','leboncoin']` (section « À expédier » de Ventes · Leboncoin) ; le banc rejoue aussi cat_bord, colis, cat_expedition, retraits, cat_achats, colis&sub=retirer (28 verts) | 4e |

Mutation : chaque banc ci-dessus est rouge sur le code d'avant la correction (build de `claude/suivi-commandes`)
et vert après (build de cette branche).

## Bancs portés (rouges à tort sur la branche)

* `ecrans-gardes` — « aucune lecture d'un écran caché » rouge : `push_journal`, `push_journal_lu`, `relais_ext`.
  Ce sont des lectures de la COQUE (`CentreNotifsCoque`, `demarrerRelais`) déclenchées par le `visibilitychange`
  que le banc ne rejoue QUE dans le passage caché. La référence rejoue désormais le même geste ; le témoin
  (Ma journée montrée relit) reste positif (4). Vert.
* `colis-sortants`, `colis-envoi` — leur helper `onglet('retirer')` cliquait un onglet qui n'existe plus et lisait
  l'écran Ventes resté ouvert (ses colis ENVOYÉS ⇒ « colis vendu dans À retirer », faux). Porté sur Achats :
  `colis-sortants` 30 verts ; `colis-envoi` « En grand » vert, reste B (voir plus bas).

## Bancs encore rouges — analysés, pas des défauts du produit

* **Rouges aussi sur `main` (avant ces lots)** : `achats-retraits` (8 : « Peut-être en double · 9 », « à vérifier »
  carte/liste), `colis-fiables` (4), `colis-tous-sites` (3), `carte-stable` (3), `retraits-frais` F6 (2),
  `navigation-tache` (7 : groupes de la colonne), `iphone-reprise` (13), `gestes-annuler` (3). Mêmes lignes.
* **Pas portés au lot DJ3** (sélecteur `[data-colis-onglet-choix="retirer"]`, `[data-nav-entree="cat_bord"]`, attente
  de l'ancien écran Colis, clé de point `^nom|cp`) : `colis-sms`, `journee-photos` C1, `retraits-frais` F1,
  `retrait-relais-carte`, `retrait-autre-ville` (le point au nom seul est bien listé, clé `seul:bazardesamis:…`),
  `vestiaire-colis`, `gestes-annuler` G1/G2, `iphone-reprise` B9/R2 (R2 rouvre bien Achats · À retirer),
  `navigation-tache` F/K/L, `colis-envoyes-tri` S (le « Suivre » est devenu le « ↗ » de la ligne de suivi).
* **Attente changée par une décision de Julien** (« aucune hypothèse » : le registre des points connus ne complète
  plus un colis) : `colis-villes` — « LOCKER 24/7 HYPER DU PORT » au nom seul n'est plus rangé à Cancale (3 au lieu
  de 4, « Lieu à confirmer » 3), et la carte sombre filtrée par ville n'est plus rendue en section.
  À porter par la prochaine session ; je ne les ai pas réécrits (une attente ne se change pas sans son auteur).

## Vérifié sans défaut trouvé

* Identité : `bordsAvecEtiquettes` / `suiviDuBord` (n° de SA transaction seulement, ambigus écartés), sortie de
  « Tout imprimer » par `partiParPreuve`, « déposé ? à vérifier » décoché par défaut (`cochesParDefaut`) ;
  `regrouperRelais` (rue dans l'identité, nom seul jamais regroupé), `lieuGenerique`, `sansSuggestions` ;
  fusion par n° puis par code (un `inpost` et un `mondialrelay` du même n° = un colis) ; code d'une relance sans
  n° (`sansSuivi`) jamais compté, jamais en double d'un code déjà montré.
* Publications : `vrm_colis_aposter` / `vrm_colis_retirer` ne dépendent pas du filtre de site (le correctif 2 ne
  change aucun nombre). Widget et rappels lisent la même règle (`etiquettes` passées, ligne légère `data->pdf`).
* « Pas su » : `TXN_META_SELECT` + `capturedAt` (scalaire de premier niveau ⇒ présent dans `meta`, migration 004) ;
  incohérences seulement sur lecture fraîche et datée.
* Transporteurs : cadence 6 h après prise en charge, au plus 3/6 par passage, colis pas pris d'abord, `clos` à la fin ;
  aucun User-Agent ni contournement ajouté.
* Liens et notifications : `?tab=cat_bord&cible=retrait` ⇒ Achats (`ecranDeCible`), `cible=colis` ⇒ Ventes,
  À trancher (`onglet`), ⌘K « colis à retirer », reprise d'écran.
* `npm run build` ; audits `variables, tdz, coherence (clone complet), identite, icones, textes-courts,
  fonctions-api, secrets` et ceux du domaine (retraits-fiables, suivi-commandes, statut-transporteurs,
  logos-bordereaux, transporteur-anciens, a-envoyer-preuves, colis-sortants, relais-carte, relais-change,
  villes-colis, garde-ecrans, reprise-ecran, raccourcis-clavier, plateformes-logo, annuler-commandes) : verts.

## Remarques sans correction (pas prouvées dangereuses, ou cosmétiques)

* `colis-envoi` B : la barre du haut bouge de 1 px entre « À envoyer » et « Envoyés » (« Tout imprimer » 190 → 189 px).
* Les OUTILS de retrait sous Achats (à confirmer, à vérifier, e-mails…) ne suivent pas le filtre de site.
* La feuille « Tout imprimer » ne montre plus l'emplacement (pièce · meuble) de chaque paire (choix du lot DJ3).
* `AlerteRelaisChange` : sans code dans l'e-mail du changement, le code d'un AUTRE e-mail du même n° est montré ;
  s'il datait d'avant le changement de point, il pourrait ne plus valoir. Jamais observé ; à mesurer.
* Deux éléments portent `id="colis-a-expedier"` (la section Leboncoin et l'en-tête de la section Vinted ne sont
  jamais montés ensemble : sans effet aujourd'hui).

## Suite : intégration du paquet colis (demande de la session principale, 11 nov. après-midi)

Sur `claude/revue-colis`, pas de PR (la session principale intègre).

1. **Vrai `git merge origin/claude/integration-11nov-e2`** (main + paquet : ouverture légère, meilleures sources,
   reprise-ecrans, restes, actions-série, ventes-lot, stats-plus). Les deux côtés gardés : `lireTxnMeta` /
   `lireFamilleCopiee` + `cap` (déjà dans `VERSION_META` : rien à ajouter à `TXN_COPIE_SELECT`, un alias en double
   aurait été refusé) ; `noterEtatsTxn` garde `su` et `cap` ; `ecranAOuvrir` (reprise synchronisée) puis
   `placeDesColis` ; carte « À trancher » (`jobTrancher`) + « commandes à vérifier » ; `MeilleuresSources` +
   `ExtEnRetard` hors outils ; badges Ventes/Achats (l'entrée « À trancher » a quitté la navigation, lot DJ4).
   Bancs en conflit : `tout-imprimer` garde l'ordre de l'écran par clés (la variante « groupes de l'écran »
   comparait des transporteurs à des clés), `colis-retirer-propre` attend l'ÉTAT sans l'onglet disparu.
2. **`git merge origin/claude/ventes-achats-visuel`** : frise fine en ligne (`friseEtat`) posée sur la ligne de vente
   qui porte aussi le lot (ventes-lot) ; styles ventes-achats-visuel importés avant ceux de la tablette.
   **`origin/claude/agent2-nsk5su`** : déjà entièrement contenu dans la branche (`git merge-base --is-ancestor`) —
   ligne fine par colis, « Imprimer » à place fixe, étagère du Stock : rien à reprendre.
3. **Arbitrages tranchés** :
   (a) `colis-villes` porté sur « aucune hypothèse » : Cancale 3, « Autres · 2 », « Lieu à confirmer » 3, le bouton
   de la ville à la place de la carte sombre — 46 verts ;
   (b) les outils de retrait d'Achats suivent le filtre de site (Vinted, écran d'arrivée, montre tout ; rien sous
   eBay / Leboncoin / Vestiaire) — `achats-retirer-site` 24 verts ;
   (c) « Tout imprimer » : l'emplacement (pièce · meuble · case, par SON N°, `ouEstNumero`) en petit sous chaque paire,
   « emplacement non noté » sinon — `tout-imprimer` C ;
   (d) point relais changé : le code d'un autre e-mail du même n° n'est montré que s'il est daté APRÈS le changement,
   sinon « Code à confirmer » — `audit-relais-change` 32 verts, mutation « code-ancien-montre » attrapée (9/9) ;
   (e) une seule définition d'ancre (`ID_SECTION_COLIS`, src/colisPlace.js) ; `liens-colis-anciens` vérifie UNE ancre
   dans la page pour chacun des 7 anciens chemins ;
   (f) date limite au téléphone : sur l'état intégré elle passe à la ligne (capture regardée) ; le banc
   `annonces-ventes-brouillon` mesure désormais « aucune ellipse » sur chaque carte (390 et 1512).
4. **Bancs portés** (nombre « À retirer » = entrée Achats de la navigation + `data-cc-n` de la liste ; section
   d'Achats ; retour par Ventes) : `colis-sms` 57, `journee-photos` 105, `retraits-frais` F1, `retrait-relais-carte`,
   `retrait-autre-ville`, `vestiaire-colis`, `gestes-annuler` G1/G2, `iphone-reprise` 139 (B9/R2), `navigation-tache`
   162 (À trancher est une carte de Ma journée), `colis-envoyes-tri` 92 (le « ↗ » de la ligne de suivi).
   Restent rouges, les mêmes que sur `main` : `retraits-frais` F6 (ligne de fraîcheur), `gestes-annuler` G1 « avant
   toute écriture » et G3 (2), `achats-retraits` (8).
