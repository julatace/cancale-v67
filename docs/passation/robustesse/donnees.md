# Revue de robustesse — couche données de l'app VRM (lecture seule)

Dépôt : `/home/user/cancale-v67`, `origin/main` du 11 nov. 2026 (commit 76445c043). Aucun fichier du dépôt modifié.

Périmètre : `src/App.jsx` (lectures/écritures, synchro `main`, file d'envoi, caches), `src/*.js` de données (`copieLignes`, `fusionNuage`, `fileEnvoi`, `lectureGroupee`, `lecturesPartagees`…), `src/ecrans/*.jsx` (lectures/écritures). Les audits de données existants (`audit-tdz`, `audit-fusion*`, `audit-file-envoi`, `audit-pagination-*`, `audit-lectures*`…) passent tous : les points ci-dessous sont hors de ce qu'ils vérifient.

**Total : 120 points** — critique 2 · haute 11 · moyenne 49 · basse 58.

Chaque point : *fichier:ligne* · ce qui peut arriver · **correction** (une phrase).


## Critique (2)

1. **src/App.jsx:54036-54041, 54119** — Passage de fond de la cloche : si la lecture de `vinted_lbc_posted` échoue (`!r.ok` ou exception, avalée par `catch(_){}`), `postedIds` reste `[]` ⇒ `aJuger` faux ⇒ `publierLbcARetirer([])` publie une liste « à retirer de Leboncoin » VIDE pour le logo de l'extension : sur un hoquet, l'alerte anti-double-vente disparaît de leboncoin.fr.  
   **Correction :** Distinguer `null` (pas lu) de `[]` et ne rien publier tant que `vinted_lbc_posted` n'a pas été lu.

2. **src/App.jsx:1320-1327 (`writeSession`) ; caches l. 4605, 5019, 5670, 5690, 5820, 6773, 21220, 49461** — Changement de vendeur dans le MÊME onglet (Se déconnecter puis se connecter, sans rechargement) : `writeSession` vide quelques caches mais pas `_dernieresLecturesPubliques` (repli SANS limite de durée quand la lecture échoue : les annonces en ligne de l'ancien vendeur), `_comptesEbay` (pseudos eBay de l'ancien vendeur), `TXN_ETATS`, `_ventesCoquePub` (ses ventes, publiées aux écrans), `_ventesEmailLu`, `_descLensParId`, ni `_lbcAnnoncesSession` (annonces Leboncoin, 10 min), ni `_rowCache` (clés globales `s:*`, `e:*`, `billing`, `email_track`, `transp` 60 s). Le nouveau vendeur peut voir des données de l'autre.  
   **Correction :** Recharger la page à tout changement d'identité (comme le fait l'écouteur `storage`, l. 4054), ou vider explicitement chacun de ces caches.


## Haute (11)

3. **src/App.jsx:23016-23023 (écrivains l. 23401-23418 et 23757-23761)** — `saveRoomPlan` écrase `vrm_room` (la pièce, les meubles, la case de chaque N°) d'un bloc, sans version. Deux écrivains se croisent sur le même appareil : la sortie AUTOMATIQUE des paires parties (`sortirPartisDuStock`, relit puis réécrit) et l'écran de la pièce, qui renvoie 800 ms après chaque geste son état React (`persist`, réponse jamais regardée). Un geste fait juste avant la sortie automatique ressuscite la case libérée (ou la sortie efface le rangement qu'il vient de faire) ; deux appareils font pareil.  
   **Correction :** Comparer-et-échanger sur `data.rev` avec fusion par case, et vérifier le résultat de `persist`.

4. **src/ecrans/Reglages.jsx:4624-4640** — `vrm_email_owners` (adresses déclarées, qui décident à quel vendeur va un e-mail) est réécrite ENTIÈRE depuis la liste lue à l'ouverture de l'écran, sans version : une adresse ajoutée depuis un autre appareil disparaît ⇒ ses e-mails partent en quarantaine.  
   **Correction :** Relire juste avant l'écriture et fusionner, ou condition sur `data.rev`.

5. **src/ecrans/Leboncoin.jsx:1093-1095, 1359, 1570** — Écran Leboncoin : `postedRows === null` (lecture ratée) donne `posted` vide ; la file « à publier » (l. 1359) liste alors TOUTES les annonces déjà publiées, et `echecLecture` (l. 1570) ne tient pas compte de cet échec — le compteur « N à publier » s'affiche comme sûr, et un « Publier » en série republie des doublons sur Leboncoin.  
   **Correction :** Inclure `postedRows === null` dans `echecLecture` (et vider la file) comme pour `main`.

6. **src/App.jsx:32222-32223, 54270-54271** — `tableRecrees` (republiée ⇒ garde le N° de l'ancienne, §5) est nourrie par deux lectures `like.vinted_brouillon_*` et `like.coffre_*&meta->>recreeDe=not.is.null` SANS pagination (`fetch`/`fetchMemo`, pas `lireTout`) : à 50 republications/jour, `coffre_*` dépasse 1 000 lignes en un mois et PostgREST tronque en silence ⇒ des annonces recréées perdent le lien vers l'ancienne (N° non repris, ancienne montée en « supprimée de Vinted »).  
   **Correction :** Passer les deux lectures par `lireTout(..., { strict: true })`.

7. **src/App.jsx:8456-8470** — `fetchVintedOrders`, repli par le relais : si la page 2…12 échoue (429, 5xx, frein), la boucle fait `break` et rend `{ ok: true, items: <pages déjà lues> }` — une liste PARTIELLE présentée comme complète (§4.2, §5 « un total partiel ») ; et au-delà de 12 × 100 commandes la fin est coupée sans rien dire. CA, « en attente » et coûts d'achat sous-comptés.  
   **Correction :** Rendre `ok:false`/`partiel:true` dès qu'une page manque ou que `maxPages` est atteint avec une page pleine.

8. **src/App.jsx:8482-8520 (et 8512-8514)** — `fetchVintedConversations` : `fetchHarvest` rend `null` sur une LECTURE DE BASE RATÉE (pas `undefined`), donc un simple hoquet Supabase fait passer la boîte de réception au repli `vintedApiCall` — Vinted interrogé depuis l'IP du serveur pour chaque compte, le motif « multi-comptes piloté par un robot » que le code dit éviter ; le test `h === undefined` (l. 8514) ne peut jamais être vrai (code mort).  
   **Correction :** Faire rendre `undefined` à `fetchHarvest` sur échec et ne jamais partir au relais dans ce cas.

9. **src/App.jsx:4046-4056 et 1544-1551** — Deux onglets (ou l'app installée + un onglet) du MÊME vendeur : l'écouteur `storage` ne réagit qu'à un changement d'IDENTITÉ ; quand l'onglet A renouvelle la session, l'onglet B garde en mémoire l'ANCIEN `refresh_token` et `authRefresh` le renvoie à GoTrue. Hors de la fenêtre de réutilisation, Supabase le refuse (et sa détection de réutilisation révoque la famille de jetons) : B reste avec un jeton expiré (toutes ses lectures « pas su », ses écritures refusées) et A peut se retrouver déconnecté.  
   **Correction :** Dans `authRefresh`, relire `vrm_session` et adopter un jeton plus récent du même utilisateur avant d'appeler GoTrue ; dans l'écouteur `storage`, adopter la session mise à jour du même vendeur.

10. **src/App.jsx:19283-19297 (avec 2127-2147, 1320-1328)** — `__parcoursIci` / `__plusTardIci` (position du parcours d'arrivée « telle qu'écrite à l'instant ») sont des variables de MODULE jamais remises à zéro : ni quand le nuage apporte une étape plus avancée (un autre appareil a progressé ⇒ cet appareil réécrit l'ancienne étape par-dessus), ni à la déconnexion (`authSignOut` ne recharge pas la page) — le vendeur suivant sur le même onglet hérite de l'étape du précédent et la pousse dans SA ligne `main`.  
   **Correction :** Remettre ces deux variables à `null` dans `writeSession` (changement d'identité) et sur `vrm:nuage-relu` de `vrm_parcours`/`vrm_parcours_plus_tard`.

11. **src/App.jsx:34677-34690 (`loadOrders`)** — Un ACHAT est écarté comme « transfert entre tes comptes » dès que son TITRE contient « n » suivi de 3-4 chiffres (`porteMonNumero`, `/\bn\s?\d{3,4}\b/i`) — une décision prise sur une RESSEMBLANCE de titre (interdit §2.4 / §5) : un vrai achat dont le vendeur a écrit « n 1234 », « N°2002 »… disparaît des achats, des dépenses et du prix d'achat proposé, sans trace.  
   **Correction :** N'écarter que sur une identité (transaction présente dans SES ventes) et montrer les cas douteux comme suggestion.

12. **src/App.jsx:32903-32930, 32964-32965 (consommé l. 53353, 53956)** — `emailSoldIds` déclare une annonce EN LIGNE « vendue » quand le nombre d'e-mails de vente au même TITRE + TAILLE (`normTitle`, `extractSize`) atteint le nombre d'annonces de ce titre — une preuve par RESSEMBLANCE, interdite par §5 (« Vendue se PROUVE »), et sans même comparer le COMPTE (une vente sur le compte A fait sortir l'annonce identique du compte B). Le résultat est persisté et SYNCHRONISÉ (`vinted_annonces_email_sold`) puis retranché des « en ligne » du tableau de bord, du widget et de la cloche : une paire encore en vente disparaît des compteurs.  
   **Correction :** Ne garder que les preuves par identité (n° de transaction → `item_id`, bordereau `label_{tx}`) ; au mieux, proposer le rapprochement par titre à SON clic.

13. **src/App.jsx:15777 → 2127-2147 (et 1320-1325, 2157-2167, 4046-4055)** — « Se déconnecter ? — Tes données restent dans VRM » : `authSignOut` annule les sauvegardes en attente (`_saveTimers`, `_cloudTimer`) puis `wipeLocalData` efface toutes les clés `vrm_`… dont la FILE D'ENVOI (`vrm_file_envoi`) — sans vérifier qu'elle est vide. Une saisie faite hors réseau, ou dans la seconde qui précède, est perdue définitivement ; les autres onglets du même vendeur rechargent (écouteur `storage`) et perdent aussi leurs saisies en cours.  
   **Correction :** Avant de déconnecter : tenter l'envoi, et si la file n'est pas vide le DIRE (« N changements pas encore envoyés — se déconnecter quand même ? »).


## Moyenne (49)

14. **src/App.jsx:5851-5858** — `fetchEmailsIncompris` : réponse non-ok ou exception ⇒ `[]` ; l'écran dit « aucun e-mail incompris » alors que la base n'a pas répondu ; de plus `limit=200` sans ordre côté serveur tronque silencieusement (les 200 premiers par id, pas les plus récents) et `rows.sort` sans `Array.isArray`.  
   **Correction :** Rendre `null` sur échec, trier côté serveur (`order=meta->>receivedAt.desc`) ou paginer avec `lireTout`.

15. **src/App.jsx:10240-10257** — `fetchLotItems` (articles d'un lot) : toute erreur (`vintedApiCall` refusé, réseau) ⇒ `[]`, indiscernable d'une commande sans article ; l'appelant peut conclure « aucun article du lot » et ne relier aucun N°.  
   **Correction :** Rendre `null` sur échec et laisser l'appelant dire « pas su ».

16. **src/App.jsx:6139** — `fetchEmailSales` : `select=data` sur TOUTES les lignes `email_sale_*` (des milliers, avec nom complet, adresse et e-mail de l'acheteur Pro) alors que seuls `designation`, `prix`, `account`, `receivedAt`, `transaction` servent ; égress et données personnelles téléchargées pour rien (§4.4).  
   **Correction :** Projeter les seuls champs utilisés (`select=designation:data->>designation,…`).

17. **src/exportDonnees.js:25** — `jourIso` découpe `toISOString()` (UTC) : une vente à 00 h 30 heure de Paris le 1er du mois sort datée du dernier jour du mois précédent dans l'export compta ZIP (feuilles ventes, achats, déclarations, factures).  
   **Correction :** Formater en `Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' })`.

18. **src/ecrans/Reglages.jsx:1386-1393 ; src/App.jsx:19174-19179** — `push_prefs` est réécrite ENTIÈRE depuis l'état lu au montage, sans comparer-et-échanger : un réglage changé entre-temps sur un autre appareil (ou par Ma configuration, App.jsx:19174) est effacé ; le serveur applique alors la mauvaise préférence (notifications envoyées/coupées).  
   **Correction :** Relire la ligne juste avant, fusionner la seule sous-clé, écrire avec condition `data->>rev`.

19. **src/ecrans/Leboncoin.jsx:1218-1223** — `lbc_accounts` illisible (`accRows === null`) ⇒ `accsLbc = {}` : l'écran affiche « aucun compte Leboncoin connecté » et `lbcConnecte` faux au lieu de « pas su » ; le geste proposé (connecter un compte) est alors trompeur.  
   **Correction :** Garder `null` et dire « comptes Leboncoin pas relus ».

20. **src/ecrans/Ebay.jsx:349-365** — `modifierBrouillonsEbay` relit puis réécrit `ebay_brouillons` entier sans condition de version : deux onglets (ou l'agent eBay qui programme) qui modifient des brouillons différents en même temps — le second efface le brouillon créé par le premier.  
   **Correction :** Écrire avec `data->>rev=eq.N` (PATCH conditionnel) et réessayer sur 0 ligne.

21. **src/ecrans/Compta.jsx:1672-1686** — `ProfilFiscalCarte` réécrit `vrm_pro_facture` ENTIÈRE depuis l'état lu à l'ouverture, alors que trois autres écrans l'écrivent (ConfigurationDepart, FacturePro, App.jsx:26930) : un SIRET/régime TVA saisi ailleurs entre-temps est effacé, et la facture Pro sort avec l'ancienne entité.  
   **Correction :** Relire-fusionner juste avant l'écriture (comme ConfigurationDepart.jsx:363) avec condition de version.

22. **src/ecrans/Achats.jsx:302-313** — `lirePhotosAchatsHors` télécharge le base64 de TOUTES les photos d'achats hors Vinted (~20 Ko chacune) en une requête, sans pagination ni filtre `supprime` : au-delà de 1 000 lignes la liste est tronquée en silence, et l'ouverture de l'écran coûte des Mo d'égress.  
   **Correction :** Lire la liste des ids (projection scalaire, `lireTout`), puis la photo à la demande ligne par ligne.

23. **src/App.jsx:13586-13590** — Liste des brouillons Vinted (`like.vinted_brouillon_%25`) lue sans pagination : au-delà de 1 000 brouillons rangés, les plus « grands » ids disparaissent de la liste sans rien dire.  
   **Correction :** `lireTout` strict.

24. **src/App.jsx:4118-4129** — `fetchVintedAccounts` : si la lecture de `vrm_blocked_accounts` échoue, `blocked` reste vide et les comptes SUPPRIMÉS POUR DE BON réapparaissent dans la liste (et sont mémorisés par `memoriserComptesLies` pour la prochaine ouverture) — exactement le symptôme « shop_cancale revient ».  
   **Correction :** Sur échec, retomber sur la dernière liste gardée (`CLE_SUPPRIMES`) au lieu d'un ensemble vide.

25. **src/ecrans/Reglages.jsx:232-236** — `supprimerDonneesCompte` (scope « le compte et ses jetons ») : le `DELETE` de `vinted_accounts` est lancé sans regarder la réponse (`try { await fetch(...) } catch {}`), puis la fonction rend `{ ok: true }` — un refus (401 session expirée, 5xx) laisse les jetons en base et l'écran annonce le compte supprimé.  
   **Correction :** Vérifier `r.ok` et rendre `ok:false` (« jetons pas supprimés »).

26. **src/ecrans/MessagesLeboncoin.jsx:123 ; src/ecrans/FilsTous.jsx:40, 43 ; src/ecrans/Vestiaire.jsx:905** — Les fils `like.lbc_fil_*` et `like.vc_fil_*` (une ligne par conversation, cumulées depuis des mois) sont lus par `lireBaseRelue`, qui ne pagine pas : au-delà de 1 000 conversations PostgREST tronque en silence et les fils les plus « grands » (id) — souvent les plus récents — disparaissent de Messages sans que l'écran le dise (§4.5).  
   **Correction :** Lire via `lireTout` (ordre stable, `Range`) ou filtrer côté serveur sur `meta->>dernierAt` récent.

27. **src/ecrans/Vestiaire.jsx:911-913** — `vc_fil_*` illisible (`jf === null`) est remplacé par `[]` (`Array.isArray(jf) ? jf : []`) : toutes les conversations Vestiaire apparaissent « sans fil lu » au lieu de « pas su », et les gestes qui en dépendent (répondre, « déjà répondu ») se trompent.  
   **Correction :** Propager `null` jusqu'à l'écran.

28. **src/App.jsx:5251-5267** — `fetchHarvestBrut` rend `null` aussi bien quand la base n'a PAS répondu (`!Array.isArray(rows)`, exception) que quand la ligne n'existe pas (`!row`) ou qu'elle est trop vieille (`maxAge`) : les appelants (Messages, boîte, profil) ne peuvent pas dire « pas su » et affichent « aucune capture » / « session expirée » sur un simple hoquet — l'inverse de ce que `fetchHarvestOrders` (l. 6640) distingue déjà (`undefined`).  
   **Correction :** Rendre `undefined` pour « pas su » comme `fetchHarvestOrders`.

29. **src/App.jsx:5649** — `fetchEmailsParCompte` pagine TOUTES les lignes `email_*` avec le plafond par défaut de `lireTout` (20 pages = 20 000 lignes) : la base en comptait 1 211 en août et en reçoit des centaines par semaine ; une fois le plafond franchi la fonction rend `null` à chaque fois (« pas su » permanent pour la réception des e-mails par compte).  
   **Correction :** Filtrer par familles utiles et par date (`meta->>receivedAt=gte.`) ou agréger côté serveur.

30. **src/App.jsx:7016-7021** — `fetchResumesConversations` : un SIMPLE échec réseau de la première lecture (avec auteur/dernier message) pose `_resumeConvSansAuteur = true` pour toute la session — on ne redemande plus jamais l'auteur ni l'extrait du dernier message (« à toi de répondre » faux) tant que la page n'est pas rechargée. Le drapeau devait ne viser qu'un refus de grammaire (400).  
   **Correction :** Ne passer en mode « sans auteur » que sur un statut 400 de PostgREST, pas sur `null`.

31. **src/App.jsx:10322-10339** — `fetchVintedListings`, repli par le relais : même `break` sur une page ratée, puis `lu: Date.now()` et le commentaire « lecture complète et fraîche » — une lecture PARTIELLE du dressing reçoit une date fraîche ; et le plafond de 10 pages (1 000 annonces) coupe sans le dire. `loadListings` (l. 34990) en tire `lues[uid]` : le compte est daté « relu à l'instant » alors qu'une partie de son dressing manque (le total « en ligne » baisse sans avertissement).  
   **Correction :** Marquer `complet:false` (et pas de `lu`) si une page a échoué ou si le plafond est atteint.

32. **src/App.jsx:10264-10306** — `fetchVintedListings` : même confusion — dressing illisible en base (`h === null`) ⇒ repli sur le relais serveur (`users/current` puis jusqu'à 10 pages de `wardrobe`) au lieu de « pas su ».  
   **Correction :** Distinguer l'échec de lecture et s'arrêter là.

33. **src/ecrans/Reglages.jsx:1003-1009, 1020-1026** — « Tout réafficher » : lecture de `vrm_blocked_accounts` sans `Array.isArray` (`j[0]`), puis `PATCH` qui remplace la liste SANS `updated_at` (§4.3 : la colonne ment ensuite) et sans regarder la réponse — refusé ou 0 ligne, l'écran dit quand même « Tous les comptes sont réaffichés ».  
   **Correction :** Passer par `withOwner`/`updated_at`, vérifier `r.ok` et dire l'échec.

34. **src/App.jsx:2425-2427** — Le renouvellement périodique (`setInterval` 4 min) et au réveil n'a qu'un échec « discret » : si GoTrue refuse (`false`), la session expirée reste dans `AUTH` sans rien dire ; seules les lectures/écritures suivantes échouent une à une (« la base n'a pas répondu »), jamais « reconnecte-toi ».  
   **Correction :** Sur `false`, poser l'état « session refusée » et proposer la reconnexion (comme au démarrage, l. 2222).

35. **src/App.jsx:25729-25738 → 55618-55625** — Ancienne fenêtre « Sauvegarde » (`BackupModal`) : le fichier n'est validé que par `data.catalog || data.sales` ; `onImport` fait `data.catalog.map(...)` et `setCatalog(data.catalog)` sans vérifier que ce sont des LISTES (un objet ⇒ exception non attrapée au milieu, une partie des clés déjà écrite), ne contrôle PAS la version de numérotation (l'autre chemin, l. 55424-55429, le fait) et annonce « ✓ Restauration réussie ! » sans attendre le nuage — alors que `save` FUSIONNE à trois voies au lieu de remplacer.  
   **Correction :** Faire passer ce bouton par `applyAndReload` (même contrôle de version, même attente du nuage) et valider la forme de chaque clé.

36. **src/App.jsx:3820-3858 (`save`)** — Chaque sauvegarde attend 500 ms (`setTimeout`) avant d'écrire dans le navigateur ET dans la file d'envoi, et rien ne vide ces minuteries au `pagehide`/`visibilitychange` : un prix d'achat tapé puis l'app fermée (glissée sur iPhone) dans la demi-seconde est perdu sans trace (ni `localStorage`, ni file à rejouer).  
   **Correction :** Écrire immédiatement en local et ne différer que l'envoi au nuage, ou vider `_saveTimers` sur `pagehide`/`visibilitychange:hidden`.

37. **src/App.jsx:36549-36555** — Trésorerie « dépensé » : `Number(o.price.amount)` sans contrôle (un montant illisible donne `NaN` et tout le total devient « NaN € ») et SANS regarder la devise — un achat en GBP/USD est additionné comme des euros (§3 International : une autre devise est écartée et dite) ; un achat sans prix compte dans `nSpent` comme s'il était connu.  
   **Correction :** Ne sommer que `currency_code === 'EUR'` et un nombre fini ; compter à part les achats écartés (« au moins … sur N »).

38. **src/ecrans/Compta.jsx:3943, 4141 (`vrm_compta`, listes `depenses`/`packs`/`abonnements`)** — Ces listes d'objets à `id` passent par `fusionListe` (identité = contenu) : une même dépense corrigée sur deux appareils avant synchro reste en DOUBLE (l'ancienne version du nuage + la nouvelle locale) ⇒ charges du mois comptées deux fois. Cause : `fusionListe` (src/fusionNuage.js:51-59) prend le CONTENU entier comme identité d'un élément de liste — toutes les listes d'objets synchronisées (`vinted_invoices`, `vinted_compta`…) ont le même défaut.  
   **Correction :** Fusionner `vrm_compta` par `id` d'élément.

39. **src/factureAchat.js:83-97 (`lireFactures`)** — Liste des factures d'achat (`like.achat_facture_*`) lue SANS pagination : au-delà de 1 000 achats avec facture, PostgREST coupe en silence et des achats apparaissent « sans facture » (§4.5).  
   **Correction :** Paginer (`Range`, ordre stable) et rendre `null` sur une page ratée.

40. **src/studioPhoto.js:89-103 (`modifierStudio`)** — Lire-fusionner-réécrire `studio_photos_{N°}` SANS comparer-et-échanger : deux appareils (ou deux photos ajoutées vite à la suite, lectures en parallèle) — la seconde écriture repart de la liste lue avant la première et efface sa photo.  
   **Correction :** Ajouter `data.rev` et un PATCH conditionnel, réessayer sur 0 ligne.

41. **src/App.jsx:53837-53857** — Publication de `widget_stats` (widget iPhone) : l'empreinte `widgetEcrit.current` est posée AVANT l'écriture et la réponse du `POST` n'est jamais regardée — une écriture refusée ou perdue (réseau, 401) n'est plus retentée tant que les chiffres ne changent pas : le widget garde un CA périmé toute la journée. De plus `onlineAt` est le jour UTC (`toISOString().slice(0,10)`).  
   **Correction :** Ne poser l'empreinte qu'après `r.ok` ; jour de Paris pour `onlineAt`.

42. **src/App.jsx:34674-34676, 34688** — `soldTxns` est pris dans `sales.items` au moment de l'appel : si les ventes ne sont pas encore chargées (`null`), aucun transfert n'est écarté ; chargées, ils le sont — la liste et le total des achats changent selon l'ordre de chargement des écrans, et le résultat est mis en cache 3 min tel quel.  
   **Correction :** Attendre les ventes (ou relire les transactions) avant de ranger les achats, et ne pas mettre en cache un résultat calculé sans elles.

43. **src/App.jsx:10563-10568 (utilisé l. 29423, 29442, 32455, 38931, 38940)** — `numeroEmailAdmis` ADMET tel quel le N° d'un e-mail de bordereau arrivé AVANT la remise à zéro (migration 013) : « 230 » y désigne l'ancienne paire B230 (§5), mais `bordForItem`/le tampon le comparent au N° ACTUEL « 230 » d'une paire de la nouvelle série — la même faute que celle corrigée pour les factures (`facturesDuNumero`, l. 10552) ; seul le garde `republishedAfter` évite le pire dans `emailSoldIds`.  
   **Correction :** Pour un e-mail d'avant la coupure, convertir en `B+n°` (ou ne rien admettre), comme `facturesDuNumero`.

44. **src/App.jsx:26403-26430 (`offresAtraiter`)** — Une offre reçue par e-mail est classée « réglée » (sortie de la liste à traiter) quand UNE vente porte le même TITRE normalisé : une décision par ressemblance (§5), et quand l'uid de l'offre est vide le test « même compte » est sauté — une offre en attente sur une paire identique d'un autre compte disparaît.  
   **Correction :** Régler par identité (n° d'annonce / transaction) ; sinon laisser l'offre visible.

45. **src/App.jsx:33099-33131** — Publication de `vinted_nums_physiques` (LA liste « cette paire est chez toi », lue par le Stock/« À ranger », `numsPresents` l. 10454) : contrairement à `vrm_paires_dorment` (l. 34236) ou à la valeur du stock (l. 31962), elle part même quand la lecture des annonces est INCOMPLÈTE (`listings.incomplet`, un compte en panne) et traite `ebayStock`/`lbcStock` « pas su » (`null`) comme vides (`|| []`) — les paires des comptes non lus disparaissent de « À ranger ».  
   **Correction :** Ne publier que sur une lecture complète et des stocks eBay/Leboncoin lus.

46. **src/App.jsx:3545-3546 (`poserFusionLocale`) avec 3642-3645 et 3729-3730** — Si `localStorage.setItem` échoue (quota plein — iPhone, grosses clés de fiches) l'erreur est avalée, mais `_baseNuage[k]` prend quand même la valeur du nuage : au prochain envoi la fusion voit « base = nuage » et « local = ancienne valeur » ⇒ l'appareil RENVOIE son ancienne valeur et efface le changement fait sur l'autre appareil ; pour une clé ABSENTE de l'appareil, la fusion (`fusion3(b, undefined, n)`) la SUPPRIME même du nuage.  
   **Correction :** Ne mettre à jour la base que pour les clés effectivement posées (`changees`), garder l'ancienne base pour les autres et signaler « stockage plein ».

47. **src/historiqueNumero.js:82-87 (appelé par App.jsx:3812-3818)** — Le journal des N° (`CLE_JOURNAL_NUMEROS`, dans la ligne `main` synchronisée) grossit SANS borne (append-only, aucune limite ni archivage) ; or `main` repart EN ENTIER à chaque sauvegarde et se copie dans `localStorage` : à terme, chaque frappe coûte des centaines de Ko et le quota de Safari (5 Mo) finit par refuser les sauvegardes (« le stockage de cet appareil a refusé la modification »).  
   **Correction :** Ranger le journal dans sa propre ligne (append côté serveur) ou le borner/archiver par trimestre hors de `main`.

48. **src/App.jsx:4194-4209 (`deleteVintedAccount`)** — La liste noire `vrm_blocked_accounts` (que l'extension lit pour ne PAS recapter un compte) est relue puis réécrite entière SANS comparer-et-échanger : deux suppressions rapprochées (deux onglets, ou « Tout réafficher » de Réglages pendant ce temps) — la seconde écriture repart de l'ancienne liste et le premier compte supprimé redevient capturable (le cas « shop_cancale revient »).  
   **Correction :** PATCH conditionnel sur `data.rev` (ou union côté serveur) et relecture sur 0 ligne.

49. **src/ecrans/Leboncoin.jsx:625-626, 643, 657-658 ; src/ecrans/Reglages.jsx:305-307, 3610-3611 (avec App.jsx:3830-3851)** — Plusieurs gestes écrivent la clé SYNCHRONISÉE dans `localStorage` AVANT d'appeler `save` (lien Leboncoin ↔ N°, « aucune paire », format d'imprimante, LETTRE des nouveaux N°). Dans la minuterie de `save`, `avantTxt` vaut alors déjà la nouvelle valeur : `txt === avantTxt` ⇒ `noterSaisie` n'est jamais appelé, le geste n'entre PAS dans la file d'envoi. Hors réseau, app fermée avant l'envoi : au chargement suivant le nuage recopie l'ancienne valeur par-dessus (le lien posé à la main ou la lettre choisie disparaît).  
   **Correction :** Laisser `save` écrire (ou lui passer explicitement la valeur d'avant pour la file) au lieu d'écrire la copie locale soi-même.

50. **src/porteMonnaie.js:2-7, 16-17 ; src/App.jsx:6001-6003 (`fetchWalletEscrow`)** — Soldes des porte-monnaie (disponible, en attente) lus par `amount` SANS regarder `currency_code` : un compte Vinted britannique (`domain` vinted.co.uk, solde en GBP) est additionné aux euros dans « disponible »/« en attente » et dans le total de la trésorerie (§3 : une autre devise est écartée et dite, jamais convertie).  
   **Correction :** Ne sommer que les montants en EUR et nommer les comptes écartés pour devise.

51. **src/App.jsx:7253-7271 (`montantCommande`, `montantCommandeLu`)** — LA lecture unique du montant d'une commande Vinted (CA, « Vendu », CA déclaré URSSAF) ignore `currency_code` : une vente d'un compte non-euro est additionnée comme des euros, alors que le bénéfice de la même vente est écarté pour devise (l. 37641, 37688) — deux chiffres de la même vente qui ne se recoupent plus (§3, §5).  
   **Correction :** Rendre `null` (vente « à part, devise ») quand `currency_code` n'est pas EUR, comme `beneficeLigneVente`.

52. **src/FactureAutres.jsx:23-34** — Cache de MODULE `_f` des factures Leboncoin/eBay/Vestiaire (numéro, nom de l'ACHETEUR, TTC) : jamais vidé à la déconnexion ni au changement de vendeur dans le même onglet ; `useFacturesAutres` ne relit que si `_f` vaut `undefined`/`null` — le vendeur suivant voit la liste des factures (et les noms d'acheteurs) du précédent.  
   **Correction :** Vider `_f` sur changement d'identité (ou recharger la page), et clé de cache par `owner`.

53. **src/ecrans/Ebay.jsx:1126, 1135** — Publication eBay UNITAIRE depuis un brouillon : envoyée sans identifiant d'envoi (`uuid`, que le lot utilise pour la protection 488), puis le passage du brouillon à « en ligne » est écrit sans regarder le résultat (`.then((w) => { if (w.ok …) })`, rien sur l'échec) : si cette écriture rate, le brouillon reste « à publier » et un second clic crée une SECONDE annonce eBay de la même paire.  
   **Correction :** Tirer et ranger un `uuid` avant l'envoi comme le lot, et dire « publiée, mais le brouillon n'a pas pu être mis à jour » sur un échec d'écriture.

54. **src/ecrans/Ebay.jsx:5092-5097 appelé en boucle l. 345** — `noterLienEbay` fait `load(LIENS_EBAY)` → ajoute UN lien → `save` ; mais `save` n'écrit le navigateur que 500 ms plus tard. Appelé en boucle pour chaque brouillon publié (`lireBrouillonsEbay`, l. 345), chaque itération relit l'ANCIENNE carte : seul le DERNIER lien (annonce eBay → paire, une identité §5) est gardé, les autres sont perdus jusqu'aux lectures suivantes.  
   **Correction :** Accumuler les liens puis faire UN `save`, ou passer par un état/updater comme `poserPatchAchat`.

55. **src/App.jsx:52764-52773 et 29852-29860** — `panel_accounts_off` (comptes écartés depuis le panneau de l'extension) : lecture ratée ⇒ l'état reste `{}` (« aucun compte écarté »), sans rien dire ; les comptes que Julien a exclus rentrent alors dans « Vendu », Ma journée et les totaux (§5 : un compte exclu n'entre dans AUCUN total). La ligne n'est lue qu'au montage, jamais relue quand le panneau la change.  
   **Correction :** Trois états (`undefined`/`null`/objet), totaux en « — » tant que `null`, et relecture sur `vrm:ext`.

56. **src/App.jsx:52239-52251** — Recherche globale (la loupe) : les dressings illisibles (`lireDressings` ⇒ `null`) deviennent `[]` (`|| []`) — la loupe dit alors qu'aucune annonce n'est « en ligne » au lieu de « pas lu » (les commandes, elles, distinguent déjà `null`) ; et `gsData` n'est chargé qu'UNE fois par session (`if (!gsOpen || gsData) return`), même partiel : une vente du matin reste introuvable tant que l'app n'est pas rechargée.  
   **Correction :** Garder `null` pour les annonces et relire `gsData` à chaque ouverture (ou après 5 min / sur `vrm:ext`).

57. **src/App.jsx:4985-5005 (`lireTout`)** — Contrairement à son contrat (« une page ratée = pas su, `null` »), `lireTout` LÈVE sur une coupure réseau (`fetch` rejeté) ou un corps illisible (`r.json()` sur du HTML 200) : les appelants qui n'ont pas de `catch` (voir l'entrée suivante) laissent une promesse rejetée non attrapée et leur écran reste « en cours » pour toujours.  
   **Correction :** Envelopper fetch/`json()` dans `try` et rendre `null`.

58. **src/ToutVaBien.jsx:64-82** — « Tout va bien ? » (Paramètres, accompagnement) : l'IIFE asynchrone n'a aucun `try` ; hors ligne, `lireTout` rejette, `setBase` n'est jamais appelé et l'écran reste « je vérifie… » sans fin (rejet non attrapé, compté comme plantage).  
   **Correction :** `try/catch` qui pose `appareils: null` (pas su) et laisse le reste se dire.

59. **src/App.jsx:3434-3437 (`lireLocalSync`)** — Une clé synchronisée dont le texte local n'est pas du JSON (écriture interrompue, vieille version) est envoyée TELLE QUELLE (`catch { val = v; }`) : la fusion la voit « changée ici » et pousse la chaîne dans le nuage ; sur les autres appareils `load` la rejette (« objet attendu ») et rend `{}`, et leur prochain geste réécrit la clé avec ce seul geste — une valeur abîmée sur UN appareil peut vider la clé partout.  
   **Correction :** Ignorer (ne pas envoyer) une clé illisible et la signaler, comme `load` le fait à la lecture.

60. **src/App.jsx:19262-19263 (relu toutes les 10 s, l. 19387-19391)** — Parcours d'arrivée : `lireAnnoncesParcours` / `lireCommandesParcours` filtrent `like.harvest_*_listings` / `harvest_*_orders_*` et projettent `data->>nItems` — la base décompresse chaque dressing (~765 Ko mesurés) et chaque liste de commandes pour un entier, et ce TOUTES LES 10 SECONDES tant qu'une étape attend ; `meta->>nItems` (migration 004) donne le même entier sans décompresser.  
   **Correction :** Projeter `n:meta->>nItems`.

61. **src/App.jsx:23375 (`saveTout`) — utilisé l. 23392, 23397, 23418, 23423, 23452-23453** — `saveTout` écrit `localStorage` AVANT `save` : même défaut que les liens Leboncoin — la libération automatique des cases (`vrm_slots`), le journal des sorties et le geste « Je la garde » (`vrm_stock_garder`, son clic) n'entrent jamais dans la file d'envoi ; hors réseau puis app fermée, le nuage les écrase au chargement suivant (la paire revient dans sa case, « je la garde » est oublié).  
   **Correction :** Supprimer l'écriture directe et laisser `save` (ou lui fournir la valeur d'avant pour la file).

62. **src/ecrans/Reglages.jsx:1196-1203 ; src/ecrans/Compta.jsx:1839-1845 (avec App.jsx:2318-2327)** — Export « Mes données » et registre des achats : si la liste des comptes (`vinted_accounts`) ne se lit pas, `lireAchatsLies(null)` retombe sur TOUS les `harvest_*_orders_purchased` jamais captés — comptes retirés ou supprimés compris — et l'export/registre comptable les inclut sans le dire (§5 : un compte retiré n'entre dans aucun total).  
   **Correction :** Sur liste illisible, rendre « pas su » (feuille « — ») au lieu d'élargir à tous les comptes.


## Basse (58)

63. **src/App.jsx:5974-5976, 6029, 36579** — `fetchWalletEscrow` : lecture du porte-monnaie ratée (`rows === null`) ou exception ⇒ `{ total: 0, dispo: 0, accounts: 0 }`, posée telle quelle dans `walletEscrow` (l. 36579) — même forme que « aucun porte-monnaie lu » ; l'écran retombe sur l'estimation sans dire que la lecture a échoué.  
   **Correction :** Rendre `null` (pas su) et dire « porte-monnaie pas relus ».

64. **src/suggestionsAchat.js:208, 235** — Filtre « mois » des suggestions d'achat calculé en UTC (`toISOString().slice(0,7)`) : un achat du 1er à 00 h 30 (Paris) tombe dans le mois précédent.  
   **Correction :** Jour/mois à l'heure de Paris, comme `jourParis`.

65. **src/notesRecues.js:71** — « même jour » comparé en UTC : deux avis à 23 h 30 et 00 h 30 (Paris) sont jugés du même jour (et l'inverse entre 0 h et 2 h).  
   **Correction :** Comparer le jour de Paris.

66. **src/historiquePrix.js:30** — `jour(ms)` en UTC : un prix relevé entre minuit et 2 h (Paris) est rangé au jour précédent, deux relevés de la même nuit peuvent se fusionner/séparer à tort.  
   **Correction :** Jour de Paris.

67. **src/satisfaction.js:113** — Jour d'un commentaire en UTC (`toISOString().slice(0,10)`).  
   **Correction :** Jour de Paris.

68. **src/ecrans/Stats.jsx:1059, 1078** — `localStorage.setItem` sans `try` dans le `onClick` qui ferme le bilan de la semaine/du mois : en Safari privé ou quota plein l'exception arrête le gestionnaire avant `setShowWeekly(false)` — le bouton « Fermer » ne ferme plus.  
   **Correction :** Envelopper l'écriture dans `try` et fermer quoi qu'il arrive.

69. **src/App.jsx:3436 (`lireLocalSync`), 3535 (`poserFusionLocale`)** — `localStorage.getItem` sans `try` dans le cœur de la synchro : un stockage qui lève (Safari « bloquer tous les cookies », iframe) fait échouer `cloudPush`/`relireNuage` avec le message trompeur « la base n'a pas répondu ».  
   **Correction :** Lire via un accesseur protégé et dire « stockage de l'appareil refusé ».

70. **src/App.jsx:20240-20252** — `ecrireSuiviManuel` : lire-fusionner-réécrire sans condition de version ; deux modifications rapprochées (deux onglets) perdent un champ.  
   **Correction :** Ajouter `data->>rev=eq.N` et réessayer sur 0 ligne.

71. **src/fileEnvoi.js:155-159 (`nuagePlusRecent`)** — Compare l'`updated_at` de la ligne `main` — horodaté par l'HORLOGE de l'appareil qui a écrit (`withOwner`/`cloudPush`) — aux heures des gestes de CET appareil : un téléphone en avance de quelques minutes fait gagner le nuage sur des saisies locales plus récentes (et inversement).  
   **Correction :** Comparer des `rev`/séquences, ou faire poser `updated_at` par le serveur (`now()`).

72. **src/reglagesFavoris.js:66-68** — `sauverReglagesFavoris` écrit sans `updated_at` (pas de `withOwner`) : la colonne garde la date de création et ment (§4.3) à tout lecteur qui date le réglage.  
   **Correction :** Passer par `withOwner` ou poser `updated_at`.

73. **src/App.jsx:36800** — Série de jours de vente (`streak`) : `new Date(Y, M, D)` avec le mois tel qu'il est écrit (1-12) au lieu de `M-1` ⇒ le 31 janvier et le 1er février ne sont plus consécutifs (31 « février » = 3 mars), la plus longue série est fausse aux changements de mois.  
   **Correction :** `new Date(Y, M - 1, D)`.

74. **src/boostRentable.js:109** — `tnb: vn.length / N.length` sans garde : avec assez de comparables boostés (`B.length >= SEUIL_BOOST`) mais AUCUN non boosté, le taux vaut `NaN` (0/0) et peut s'afficher « NaN % ».  
   **Correction :** `N.length ? … : null` et dire « pas de comparaison ».

75. **src/ecrans/Stats.jsx:1215-1225** — `lireProfilsNotes` : la lecture des avis (`harvest_*_feedbacks`) ratée est avalée (`try {...} catch {}`) et donne `avis: undefined` = « pas encore lus », indiscernable d'une panne.  
   **Correction :** Rendre un état `null` distinct pour « lecture ratée ».

76. **src/ecrans/MessagesLeboncoin.jsx:127** — `lbc_accounts` illisible (`ja === null`) ⇒ `acc = {}` : les noms de comptes Leboncoin disparaissent et l'écran ne dit pas que la lecture a échoué.  
   **Correction :** Garder `null` et dire « comptes pas relus ».

77. **src/App.jsx:5691-5700** — `lireVentesEmail` garde un échec (`rows = null`) 60 s comme une vraie réponse (`_ventesEmailLu.at` posé même sur `null`) : pendant une minute toute relecture rend « pas su » sans réessayer, contrairement à la règle de `cachedRow` (l. 5038-5041).  
   **Correction :** Ne poser `at` que sur une lecture réussie.

78. **src/App.jsx:6793-6805** — `fetchTxnItemIds` rend `{}` sur échec (lecture `null` comme exception) — même forme que « aucune transaction captée » ; un appelant qui relie vente → annonce par cette carte conclut « pas d'annonce » au lieu de « pas su » (et le `catch` ne remet même pas `TXN_ETATS_LU` à faux).  
   **Correction :** Rendre `null` et laisser l'appelant garder l'état précédent.

79. **src/App.jsx:6982-6991** — `fetchHarvestConversation` : `rows[0]` sans `Array.isArray`, et `null` à la fois pour « pas capturée » et « lecture ratée » ; l'écran du fil ne peut pas dire « pas su ».  
   **Correction :** Trois états (`undefined`/`null`/payload) et vérifier la forme.

80. **src/App.jsx:55445-55452** — Restauration d'une sauvegarde complète : `PATCH … id=eq.main` avec `Prefer: return=minimal` ⇒ 0 ligne mise à jour (ligne `main` absente, premier jour) compte comme succès ; et la file d'envoi (`vrm_file_envoi`) n'est pas vidée — des saisies en attente d'AVANT la restauration seront rejouées par-dessus après le rechargement.  
   **Correction :** `return=representation` + vérifier 1 ligne ; vider la file d'envoi après une restauration acceptée.

81. **src/ecrans/Compta.jsx:1419 (`parseMontant`)** — « 1.234,56 » (séparateur de milliers point) ⇒ `replace(',', '.')` puis suppression des autres caractères ⇒ « 1.234.56 » ⇒ `parseFloat` = 1,234 € : une dépense de 1 234,56 € est enregistrée à 1,23 € sans avertissement.  
   **Correction :** Refuser une saisie à plusieurs séparateurs ou retirer les points de milliers avant la virgule décimale.

82. **src/App.jsx:38044-38054** — Totaux du relevé mensuel : une valeur illisible (`ent`, `sor`, `vir`) devient 0 (`n()`), le total s'affiche comme complet.  
   **Correction :** Compter les lignes illisibles et afficher « au moins », ou « — ».

83. **src/App.jsx:32746 (`eur`)** — Frais/boost d'une fiche illisibles (« 3 € », « 2,5e ») ⇒ 0 en silence dans le bénéfice : un bénéfice SURESTIMÉ présenté comme sûr.  
   **Correction :** Rendre `null` sur un texte non numérique et signaler la fiche dans la couverture.

84. **src/ecrans/Achats.jsx:346 et 449-450** — Total « N achats · X € payés » des achats hors Vinted : un achat sans prix lisible compte pour 0 € (`prixAchatHorsNombre(b) || 0`) et le total s'affiche comme complet (§5 : un total partiel doit dire sa couverture).  
   **Correction :** Afficher « au moins X € · N sans prix ».

85. **src/ecrans/Achats.jsx:424, 428** — `price: prix || ''` : un achat saisi à 0 € (cadeau, échange) est rangé SANS prix (« à saisir »), et `facture.joindre` est attendue sans `try` — si elle lève, `setEnvoi(false)` n'est jamais appelé : le bouton reste bloqué « envoi » alors que l'achat est déjà ajouté.  
   **Correction :** `price: prix` tel quel (0 compris) et `try/finally` autour de la jointure.

86. **src/App.jsx:5420, 5884, 6104, 37411, 38438 ; src/arriveesRelues.js:42** — Tris `new Date(b.x) - new Date(a.x)` sans garde : une date illisible (chaîne vide après `|| 0` exclue, mais texte invalide) rend le comparateur `NaN` et l'ordre devient incohérent (TimSort) — « le plus récent » n'est plus en tête.  
   **Correction :** Trier sur `Date.parse(...)` remplacé par `-Infinity` quand non fini.

87. **src/App.jsx:35458-35466** — Sonde de l'écran Ventes : `bouge` ne garde que le DERNIER compte dont `capturedAt` a changé ; si deux comptes ont été relus par l'extension dans la même minute, seul le dernier est rechargé, les ventes neuves de l'autre restent invisibles jusqu'à la réouverture (alors que `vus` a déjà enregistré sa nouvelle date).  
   **Correction :** Collecter tous les uids qui ont bougé et les relire (comme `comptesARelire` de la coque, l. 53693).

88. **src/App.jsx:34685-34687** — Déduplication par `String(o.transaction_id)` : une commande sans `transaction_id` donne la clé « undefined » ⇒ toutes les commandes sans identifiant sont fusionnées en UNE seule (les autres disparaissent).  
   **Correction :** Ne dédupliquer que sur un identifiant présent ; garder les autres telles quelles et les signaler.

89. **src/ecrans/Vestiaire.jsx:358-360 (`poserEtiquette`)** — `{ ...load(clé), ...prev }` puis `save` : l'état de l'écran (`prev`) repasse PAR-DESSUS le stockage, si bien qu'une étiquette retirée sur un autre appareil (absente du stockage, encore dans `prev`) est ressuscitée à la prochaine étiquette posée ici.  
   **Correction :** Partir du stockage seul et n'y modifier que la clé `id`.

90. **src/App.jsx:4226-4233 et 4211-4214** — `deleteVintedAccount` : les lots de purge (`supprime:true`) partent sans regarder la réponse, et le `DELETE` des jetons ne vérifie pas qu'une ligne a été supprimée (`return=minimal`) ; le résultat `ok` ne dit donc ni si les données ont été vidées ni si les jetons ont disparu.  
   **Correction :** Vérifier chaque `r.ok`, demander `return=representation` sur le DELETE et rendre un bilan (« jetons supprimés · N lignes vidées »).

91. **src/ecrans/Stats.jsx:1946-1951** — Nombre d'articles par achat (lots) : un lot de 100 transactions illisible est simplement sauté (`continue`), ses achats comptent alors pour UN article chacun (`nombreDe` ⇒ 1) — le prix par paire des lots du mois est faux sans que l'écran le dise.  
   **Correction :** Rendre « pas su » (état `null`) si un lot échoue et l'afficher.

92. **src/FacturePro.jsx:565** — Lecture des ventes Pro filtrée sur `data->>pro=eq.true` (et non `meta->>`) : la base décompresse chaque ligne `email_sale_*` pour filtrer (§4.4, la mesure de Compta.jsx:2083) ; avec des milliers d'e-mails la requête peut dépasser le délai et l'écran Factures Pro reste « pas su ».  
   **Correction :** Filtrer sur une colonne `meta` (ajouter `pro` au déclencheur de la migration 004).

93. **src/sondeVentes.js:11-13 (`comptesARelire`)** — Un compte dont la coque n'a encore AUCUNE date de lecture (`vus[uid]` absent : sa première lecture a échoué) est ignoré par la sonde (`!Number.isFinite(deja)` ⇒ `continue`) : il reste « ventes pas lues » jusqu'au rechargement, même quand l'extension vient de capter ses ventes.  
   **Correction :** Relire aussi un compte sans date connue dès qu'une ligne `orders_sold` existe pour lui.

94. **src/ecrans/Vestiaire.jsx:575-580 (`poserAchatVc`)** — Même motif « `load` → modifier → `save` » sans état intermédiaire : deux prix d'achat saisis à moins de 500 ms d'intervalle (deux paires Vestiaire à la suite, validation au clavier) — le second `save` repart de la carte d'avant le premier et l'efface (`vinted_buyprice_by_num`).  
   **Correction :** Lire la valeur en attente (ou passer par un updater) avant d'ajouter la clé.

95. **src/ecrans/Reglages.jsx:671-679** — Comptes liés : `select=id,data` sur toutes les lignes `harvest_*_profile` (profil Vinted complet, comptes supprimés compris) pour n'en tirer que note, avis, e-mail et photo ; aucune vérification `Array.isArray(rows)` (un corps non-liste fait lever `rows.forEach`, avalé).  
   **Correction :** Projeter les quelques champs (`data->payload->user->>feedback_reputation`, …) et vérifier la forme.

96. **src/ecrans/Compta.jsx:3826 ; src/App.jsx:6827** — Porte-monnaie de Compta : `like.harvest_*_releve_*` (une ligne par compte ET par mois, avec toutes ses lignes) lu sans pagination ni borne de date : la famille grossit chaque mois et dépassera 1 000 lignes (troncature silencieuse des comptes aux plus grands ids), en téléchargeant tout l'historique des relevés à chaque ouverture (même chose, paginé mais sans borne, pour les dates de versement l. 6827).  
   **Correction :** Filtrer sur les mois utiles (`id=in.(…)` des 13 derniers mois) ou paginer avec `lireTout`.

97. **src/journeeArgent.js:9-10 (avec App.jsx:5998-6004)** — « À virer » de Ma journée prend `dispo` de `fetchWalletEscrow`, qui additionne le disponible de TOUS les porte-monnaie, mais n'est montré que si `accounts > 0` (comptés sur l'« en attente ») et sans l'âge de la lecture (`plusVieuxJours` ne vaut que pour l'attente) : un solde disponible lu il y a des semaines s'affiche comme celui du jour.  
   **Correction :** Calculer l'âge et la couverture du disponible séparément et les dire.

98. **src/App.jsx:1456-1462** — `lireBordereauxAuto` : `rows.length` sans `Array.isArray` (un corps HTML 200 d'un proxy fait lever « Cannot read properties of undefined », message trompeur) ; même chose l. 1470 après l'écriture.  
   **Correction :** Vérifier la forme avant `rows.length`.

99. **src/App.jsx:34333-34342** — `panel_buyprices` (prix d'achat relevés par le panneau de l'extension) : lecture ratée ⇒ `{}` en silence ; les ventes concernées passent « sans prix d'achat » et le bénéfice affiché change d'une ouverture à l'autre sans que la panne soit dite.  
   **Correction :** Garder un état « pas su » et l'ajouter à la couverture du bénéfice.

100. **src/App.jsx:26869-26877 (`comptaChargesAnnee`)** — Pour une année PASSÉE (`annee < thisY`), les coûts fixes actuels (sans date) sont comptés × 12 — y compris ceux créés cette année — alors que l'écran dit « depuis janvier » : les charges et le bénéfice de l'an dernier changent rétroactivement à chaque coût fixe ajouté aujourd'hui.  
   **Correction :** Ne compter les coûts fixes que pour l'année en cours (ou exiger une date de début).

101. **src/App.jsx:32405-32417** — « Rien n'a changé ? » de `vinted_urssaf_mois` compare des `JSON.stringify` d'objets (`sources`, `par`, `nonComptees.par`…) : après un aller-retour par le nuage, Postgres (jsonb) a RÉORDONNÉ leurs clés (longueur puis octets : `eBay` avant `Vinted`…), la comparaison échoue à chaque lecture complète et la clé est republiée avec un nouvel `at` — toute la ligne `main` repart vers le nuage à chaque ouverture, sans changement réel.  
   **Correction :** Comparer avec `egalStable`/`jsonStable` (déjà dans src/fusionNuage.js).

102. **src/App.jsx:30647-30658** — « Achats par jour » publié (`vrm_achats_jours`, synchronisé, lu par le bénéfice/Statistiques) : chaque achat y entre avec `montantCommande(o)`, qui vaut 0 pour un prix illisible et ignore la devise — la dépense du jour est sous-estimée sans que la ligne dise combien d'achats manquent.  
   **Correction :** Utiliser `montantCommandeLu` et publier aussi le nombre d'achats au prix inconnu.

103. **src/App.jsx:35243, 37370 ; src/ecrans/Reglages.jsx:312-316** — Autres appelants de `lireTout` sans `catch` dans un `async` lancé par un effet ou un clic : photos/infos des achats (l. 35243), infos de réception du sélecteur « Relier » (l. 37370, `infosRelier` reste `undefined` ⇒ « lecture… » sans fin), aperçu des bordereaux de Réglages (`ap` reste « charge »). Hors ligne, chacun laisse un rejet non attrapé et un état figé.  
   **Correction :** Corriger `lireTout` (entrée précédente) ou ajouter `.catch(() => null)` à ces appels.

104. **src/App.jsx:6969-6980 (et `extractBoosts` 6848-6867)** — `fetchHarvestBoosts` : lecture du porte-monnaie ratée (`rows === null`) ou exception ⇒ `[]` (« aucun boost » au lieu de « pas su ») ; et les boosts sont trouvés par un parcours RÉCURSIF sur des libellés (`/bump|boost|…|\bvas\b/`) avec des montants > 0 seulement — un débit négatif est ignoré, un même boost présent dans deux sous-listes à des dates de champ différentes est compté deux fois.  
   **Correction :** Rendre `null` sur échec ; lire les boosts dans la forme mesurée (`invoice_lines` typées) plutôt que par mots-clés.

105. **src/corbeille.js:244-247 (appelé par App.jsx:3950-3965)** — La corbeille promet « effacé pour de bon après 30 jours », mais `aPurger` purge AUSSI tout ce qui dépasse 300 entrées (`i >= max`), quel que soit l'âge, et selon l'HORLOGE de l'appareil : une suppression en série de plus de 300 éléments (ou un téléphone à la mauvaise date) vide aussitôt, de façon irréversible, les plus anciens et leurs photos/tickets annexes.  
   **Correction :** Ne purger que sur l'âge (date serveur ou garde d'une horloge plausible) et prévenir quand la limite de taille est atteinte.

106. **src/App.jsx:17136** — La clé « rappel de fin d'essai vu aujourd'hui » porte le jour UTC (`toISOString().slice(0,10)`) : fermé à 0 h 30, le bandeau revient (jour UTC d'hier) ; ces clés s'accumulent aussi chaque jour dans `localStorage` sans jamais être nettoyées.  
   **Correction :** Jour de Paris et une seule clé `{ jour }` réécrite.

107. **src/App.jsx:25832-25843 (`useComptesAutresSites`)** — Pour savoir si une vente Vestiaire est « sans compte », toutes les ventes Vestiaire (`vc_ventes`, `data->ventes` entier) sont téléchargées à CHAQUE ouverture du panneau des comptes et à chaque signal `vrm:ext` lbc/vc — une projection lourde pour un booléen (§4.4).  
   **Correction :** Faire publier le booléen (ou un compteur) par l'extension, ou projeter le seul champ `compte`.

108. **src/App.jsx:25800-25815 (`lireCapturesDetail`)** — La ligne de fraîcheur lit TOUTES les lignes `harvest_*` (conversations, transactions, labels… des milliers) pour n'en garder que trois familles par compte ; au-delà de 20 000 lignes `lireTout` rend `null` et la fraîcheur devient « pas su » pour toujours.  
   **Correction :** Lire `id=in.(harvest_{uid}_orders_sold, …_listings, …_orders_purchased)` pour les comptes liés.

109. **src/App.jsx:35069** — Les e-mails de vente (`emailSales`, base de `emailSoldIds`) ne sont lus qu'UNE fois (tant que l'état vaut `null`) : une vente arrivée pendant la session n'est jamais prise en compte, et une lecture ratée (`null`) n'est retentée qu'au prochain changement d'onglet.  
   **Correction :** Relire sur `vrm:ext`/retour au premier plan, avec un état distinct pour l'échec.

110. **src/CompteRelie.jsx:316-321** — Tant que la première lecture d'un compte relié n'est pas finie, l'écran relit toutes les 8 s — y compris `relireAutres` (7 lectures dont toutes les ventes Vestiaire) — sans limite de durée ni arrêt quand l'onglet est caché : un compte qui ne termine jamais (extension fermée) fait tourner ces lectures indéfiniment.  
   **Correction :** Ralentir (rythme commun `rythme().doitLire`) et s'arrêter onglet caché ou après N essais.

111. **src/App.jsx:10349-10353 (`cleNum`)** — L'identité d'un N° ne retire les zéros de tête que pour un numéro TOUT en chiffres : « C007 » et « C7 » (ou « b 07 » et « B7 ») restent deux numéros différents — un doublon de numéro à lettres n'est pas vu, et une référence Leboncoin « VRM-C07 » ne retrouve pas la paire « C7 » (§5 annonce « 007 » = « 7 »).  
   **Correction :** Normaliser aussi la partie chiffrée après le préfixe lettres (`/^([A-Z]+)0*(\d+)$/`), la même règle dans l'app, l'extension et le serveur.

112. **src/ecrans/Stock.jsx:182-183, 256-260 ; src/ecrans/Compta.jsx:3439** — `vrm_meubles` / `vrm_slots` (et `vinted_urssaf_freq`) sont tenus en `useState(load(…))` et non en `useStateCle` : une case rangée ou un meuble ajouté sur l'AUTRE appareil (relu par `relireNuage`) n'apparaît pas tant que l'écran n'est pas rouvert (`onCloudReady` ne remplit qu'un état vide) — il voit un rangement périmé et peut ranger une 2e paire dans une case déjà prise ailleurs.  
   **Correction :** Passer ces états par `useStateCle` (comme les autres clés synchronisées).

113. **src/ecrans/Stats.jsx:161, 330-333** — Vieux tableau de bord (catalogue saisi) : `+v.sellPrice` / `+v.buyPrice` sans contrôle — un prix non numérique rend CA et bénéfice `NaN`, et un prix d'achat absent compte pour 0 (marge de 100 % présentée comme sûre) dans le détail du mois.  
   **Correction :** Ignorer les prix illisibles et dire la couverture (« sur N ventes au prix d'achat connu »).

114. **src/ecrans/Compta.jsx:4108-4110 ; src/ecrans/Achats.jsx:419-424** — Le ticket d'une dépense / la photo d'un achat est écrit dans SA ligne AVANT que la dépense/l'achat soit gardé : si la sauvegarde de `vrm_compta` (ou de la liste d'achats) échoue ensuite (stockage plein), la ligne `depense_ticket_*` / `achat_hors_photo_*` (jusqu'à ~1 Mo de base64) reste orpheline en base pour toujours — la purge de la corbeille ne la connaît pas.  
   **Correction :** Écrire l'annexe après la fiche, ou la vider si la fiche n'a pas été gardée.

115. **src/App.jsx:52964-52973 (contre 55320-55321)** — Au démarrage, si la permission du navigateur est accordée, l'effet remet `vinted_notif_enabled` à `true` sans condition : l'interrupteur « Alertes » coupé par lui (l. 55321) se rallume tout seul à chaque ouverture ; et quand la permission vaut `default`, la demande système part au chargement, sans geste.  
   **Correction :** Ne poser `true` que si aucune valeur n'est enregistrée ; ne demander la permission que sur son clic.

116. **src/App.jsx:21238-21253 (`useComptesEbay`)** — Le registre des comptes eBay illisible une fois (`null`) n'est jamais relu tout seul : seul un évènement `vrm:ebay-comptes` relance la lecture — les écrans eBay, Ventes et la coque restent « comptes eBay pas lus » toute la session après un simple hoquet.  
   **Correction :** Relire au retour au premier plan / avec le rythme commun quand la dernière lecture vaut `null`.

117. **src/App.jsx:9112-9130 (`relaisAttendre`)** — Boucle sans échéance globale : si la commande reste « attente » et que l'annulation conditionnelle rend `null` (lecture OK mais écriture refusée, ex. 401 sur PATCH), le téléphone repasse la lire et tenter de l'annuler toutes les `T.pas` indéfiniment, bouton bloqué.  
   **Correction :** Borner la boucle (`t0 + T.prise + T.pris`) quel que soit l'état lu, et rendre `inconnu`.

118. **src/App.jsx:28879-28888** — `vinted_listing_dates` est lu en `select=data` (la carte de TOUTES les annonces jamais vues, qui ne fait que grossir) à chaque montage de l'écran, pour dater les annonces en ligne (§4.4).  
   **Correction :** Projeter les seuls identifiants en ligne (`data->"id"` par lots), comme `lireCategoriesFiches` (Stats.jsx:1373).

119. **src/App.jsx:7014-7030, 7052-7058, 15150** — Trois lectures filtrent ou projettent DANS `data` de toutes les conversations captées (`harvest_*_conv_*`, ~1 400 lignes de ~30 Ko) : résumés (`messages->-1`), offres (`messages=cs.[…]`) et fiche d'une paire (`…transaction->>item_id=in.(…)`) — la base décompresse tout à chaque ouverture de Messages ou d'une fiche ; sur une base qui grandit, le délai de requête finit par tomber et ces écrans passent « pas su ».  
   **Correction :** Faire poser par l'extension les scalaires utiles dans `meta` (ou une ligne résumé par compte) et filtrer dessus.

120. **src/rafraichissementLeboncoin.js:41-63 (`lireBaseRelue`)** — Délai fixe de 12 s : une lecture lente mais valide (grosses lignes `vc_listings`/`lbc_listings` sur réseau mobile) est TOUJOURS déclarée « pas su », sans jamais être annulée (le `fetch` continue en arrière-plan) — sur une connexion lente l'écran reste en panne permanente tout en consommant la bande passante.  
   **Correction :** Annuler la requête (`AbortController`) et allonger le délai pour les lignes connues comme lourdes, ou projeter moins.


## Hors zone (notés seulement, 7)

- **src/App.jsx:6952-6966 (`fetchHarvestPickupPoints`)** — Points relais (colis) : `select=id,data` sur `harvest_*_pickup_points`, échec ⇒ `[]`, et un point sans `lat` numérique fait lever `toFixed` ⇒ toute la liste vide.

- **src/App.jsx:6043-6092 (`fetchDropOffPoints`)** — Où déposer (colis) : lecture ratée ⇒ `{ carriers: [] }` (« aucun point ») au lieu de « pas su » ; `metas.filter` sans `Array.isArray`.

- **src/App.jsx:39270 (`deposerLbc`)** — « Déposé » Leboncoin (colis) : `load` → modifier → `save` ; deux colis marqués à moins de 500 ms, le premier est perdu.

- **src/App.jsx:38684, 39279** — `vinted_ship_done` (colis) : `{ ...load(clé), ...shipDoneRef.current }` — l'état de l'écran repasse par-dessus le stockage et ressuscite un « Pas encore déposé » fait ailleurs.

- **api/email-inbound.js:414-415 (serveur)** — Prix de vente lu par `(\d+[,.]\d{2})\s*€` : « 1 234,56 € » est rangé 234,56 ; l'app (`fetchEmailSales`, `emailSoldIds`) consomme ce faux montant.

- **src/App.jsx:52567, 52913, 52942 (sécurité)** — `vinted_accounts` est gardé dans `localStorage` AVEC `access_token`/`refresh_token` Vinted de chaque compte : lisibles par tout script de la page (XSS, extension tierce).

- **src/App.jsx:9455-9470, 17072-17083 (OAuth/liaison)** — Lectures `sessionStorage` du retour de liaison : correctement gardées par un `try` englobant — non revues plus avant (zone d'une autre session).
