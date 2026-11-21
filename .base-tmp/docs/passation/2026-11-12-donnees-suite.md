# Robustesse des données — la suite (12 nov. 2026, second agent)

Branche `claude/agent2-donnees-suite`, partie de `origin/claude/agent2-robustesse-donnees`
(⚠️ elle la CONTIENT : n'intégrer que celle-ci), puis `git merge origin/main` (f04d4a580, déjà à jour).
Les « moyenne » restants de `docs/passation/2026-11-11-robustesse-donnees.md` (revue
`robustesse/donnees.md`, branche `claude/agent2-robustesse`). Pas d'extension.

## Ce qui a changé

| point | avant | maintenant |
|---|---|---|
| 18 `push_prefs` | Réglages → Notifications et Ma configuration réécrivaient la ligne ENTIÈRE lue au montage : un réglage changé ailleurs entre-temps (heures calmes, autre appareil) était effacé, le serveur appliquait la mauvaise préférence | `ecrireDifference` (`src/ligneCas.js`) : seul CE qui a changé ici (de la ligne lue à la nouvelle) est posé sur la ligne RELUE, par comparer-et-échanger sur `data.rev` ; Ma configuration passe la ligne qu'elle a lue (`avant`, `src/configurationDepart.js`) |
| 21 `vrm_pro_facture` | « Ton entreprise » (Compta, `ProfilFiscalCarte`) réécrivait la fiche entière : un SIRET / régime de TVA saisi dans Ma facture ou Ma configuration entre-temps était effacé | même `ecrireDifference` ; l'écran adopte ce qui vient d'ailleurs, une frappe faite pendant l'envoi reste (`fusion3`) |
| 20 `ebay_brouillons` | relire puis réécrire sans version : deux onglets (ou l'agent eBay) ⇒ un brouillon perdu | `modifierLigneCas`, relue PROJETÉE (`items:data->items,rev:data->rev`, jamais `select=data`) ; devancé ⇒ relu, `changer` rejoué. `modifierLigneCas` accepte désormais `select` / `deLigne` |
| 40 `studio_photos_{N°}` | deux photos ajoutées vite ⇒ la seconde effaçait la première | `modifierLigneCas` |
| 36 `save` différé de 500 ms | un prix tapé puis l'app glissée (iPhone) dans la demi-seconde : perdu sans trace | `viderAvantFermeture` (App.jsx) : à `pagehide` et à la page masquée, TOUTES les sauvegardes en attente sont faites (navigateur + file d'envoi, rejouée au chargement suivant), puis l'envoi au nuage part sans attendre ses 800 ms, en `keepalive` quand le corps fait moins de 60 Ko (limite du navigateur : 64 Ko ; au-delà la file d'envoi garde tout) |
| scène « onglets » | **mesuré** : l'ancien jeton renvoyé 1 fois sur 3. Cause : deux onglets vivent dans deux processus ; `localStorage` écrit par A est recopié chez B APRÈS coup — B entrait dans le verrou 7 ms après A et relisait l'ancienne session | la session renouvelée est aussi rangée dans IndexedDB (un seul service pour tout le site) AVANT de rendre le verrou ; B la lit là si `localStorage` ne l'a pas encore (`rangerSessionOnglets` / `lireSessionOnglets`, `src/sessionOnglets.js`) ; effacée à la déconnexion. Après : 0 réutilisation sur 8 passages |
| banc `file-envoi` (20 rouges sur main) | le banc ouvrait « Outils → Compléter les prix d'achat », RETIRÉ du menu le 5 nov. (chantier C) : ce n'était pas un défaut du code | porte actuelle : « Compléter » du bandeau (`data-ann-achats-completer`) ou le « Prochain geste » prix ; prix jugés en NOMBRE (la saisie range « 41,00 ») |
| « 2 changements en attente » pour UN prix (défaut révélé par le banc) | un prix tapé écrit la fiche ET son miroir `vinted_buyprice_by_num` ; la reprise des écrans (`vrm_reprise_ecrans`) comptait aussi | `compterEnAttente` (`src/fileEnvoi.js`) : le miroir ne compte pas quand la fiche attend ; la reprise des écrans n'est pas une saisie. Rien ne change à ce qui PART (tout part) |
| 37, 50, 51 devises | trésorerie « dépensé » `Number(o.price.amount)` (NaN possible, GBP comptées en euros) ; porte-monnaie d'un compte vinted.co.uk additionné aux euros ; `montantCommandeLu` sans devise | `montantCommandeLu` rend `null` pour une autre devise (MÊME ligne que `agent2-familles-app` : fusion sans conflit) ; « dépensé » ne compte que ce qui se lit en euros et dit « au moins : N achats à part (prix pas lu ou autre devise) » ; porte-monnaie : le compte en GBP hors total, hors liste, NOMMÉ (« Autre devise, hors total : shop_uk (GBP) »), virements en GBP écartés ; ancienne trésorerie (`fetchWalletEscrow`) : « N comptes dans une autre devise : hors total ». Jamais converti (CLAUDE.md §3) |

## Preuves
- `scripts/audit-donnees-suite.cjs` (EXÉCUTE `ecrirePushPrefs`, `modifierBrouillonsEbay`
  extraits, `ecrireDifference`, `modifierStudio`, `viderAvantFermeture`, `porteMonnaieParCompte`,
  `montantCommandeLu`, contre une base PostgREST qui juge `data->>rev` et sert les projections ;
  deux écrivains EN MÊME TEMPS) : **18 verts** ; sur la branche de départ
  (`agent2-robustesse-donnees`, git archive) **12 rouges** (heures calmes effacées, brouillon b1
  perdu, photo p1 perdue, 130 € au lieu de 50, GBP lue en euros…) ; `--prouve` **7/7 mutations**.
- Banc `file-envoi` : voir « Vérifié ». Banc `robustesse-donnees` (5 scènes) : voir « Vérifié ».
- `npm run build` ; audits variables, tdz, coherence, identite, icones, robustesse-donnees,
  lecture-groupee, fusion, fusion-nuage, file-envoi : verts. `lectures-lourdes` : rouge, déjà rouge
  sur la branche de départ (`src/categoriesLecture.js`, pas ce lot).

## Vérifié
- Banc `file-envoi` : **30 OK, 0 KO** (sur la branche de départ / main : 20 rouges — la porte
  retirée — puis, la porte remise, 3 rouges « 2 changements » révélés par lui : corrigés dans le code).
  Captures regardées (feuille « Prix d'achat à compléter » pendant la coupure, 390 px).
- Banc `robustesse-donnees` : **36 verts** (5 scènes) ; scène `onglets` rejouée 8 fois de plus :
  0 réutilisation (avant : 1 sur 3, journal des deux onglets dans le récit ci-dessus).
- Captures regardées : onglets 1512, Leboncoin clair/sombre, déconnexion 390/1512.

## Restes
- `ecrireReglage` (Ma facture, Ma configuration) relit-fusionne-réécrit par PATCH sur le champ,
  sans version : la fenêtre est courte (relu juste avant) mais pas fermée. Même motif à poser.
- 54 `noterLienEbay` en boucle, 94 `poserAchatVc`, `deposerLbc` : « load → modifier → save » qui
  repart d'une carte d'avant le `save` précédent (500 ms) — à régler par une file par clé.
- 102 `vrm_achats_jours` (montant 0 pour un prix illisible) : chez `agent2-familles-app`
  (`sommeConnue`) au moment de l'intégration.
- `keepalive` : une ligne `main` de plus de 60 Ko part au chargement suivant (file d'envoi).

## Geste de Julien
Aucun.
