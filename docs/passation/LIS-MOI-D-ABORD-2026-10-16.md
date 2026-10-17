# 🔴 PASSATION DU 16 OCTOBRE 2026 — LIS-MOI D'ABORD

**Pour le Claude qui reprend VRM.** La session qui a travaillé du 2 au 16 octobre
a atteint sa limite de la semaine. Julien (le propriétaire, pas développeur) te
passe le relais. Ce fichier dit **où en est le code, quoi faire, dans quel
ordre**. Le détail complet (chaque demande de Julien avec son état, chaque
chantier, chaque défaut) est dans `docs/passation/PASSATION-2026-10-16.md`.

**Avant de coder : lis `CLAUDE.md` en entier** (règles §2 à §7 — elles ont toutes
une raison mesurée). Julien **ne veut pas de questions** : tranche, et dis ce
que tu as tranché. Il t'a **autorisé à déployer** (PR vers `main`, merge).

---

## 1. Où est le code — en 6 lignes

| | |
|---|---|
| **Branche de travail** | `claude/project-review-nsk5su` (tête : le commit qui ajoute ce fichier). C'est l'intégration de TOUT le travail des 15-16 octobre. |
| **Production** | `origin/main` → vrm.center (auto-déployé). Dernier merge connu : `416519d` (#531, 14-15 oct.). ⚠️ D'autres agents (branches `codex/…`) mergent aussi dans `main` : **`git fetch origin && git merge origin/main`** (un VRAI merge, jamais `-s ours`) avant ta PR. |
| **Écart** | 74 commits de `claude/project-review-nsk5su` ne sont PAS dans `main` : **rien du 15-16 octobre n'est en production**. |
| **Travail non fini** | 7 patchs dans `docs/passation/wip/` (voir §3). Vérifié : ils s'appliquent à la suite, sans conflit, build vert. |
| **Extension** | manifeste `5.177.0` dans la branche — mais **`5.177.0` a déjà été publiée par `main` avec un AUTRE contenu** (commit 9451051) ⇒ la prochaine version DOIT être **`5.178.0`** (ou plus). Jamais deux contenus sous un même numéro. |
| **Base** | Supabase, projet `lgonxzrzjcqthjtbdpzo`. Lecture seule pour mesurer ; jamais de donnée inventée en production (§2.3). |

### Ce qui est intégré dans la branche (fait, prouvé, PAS encore en production)
Lots fusionnés le 15-16 octobre, chacun avec ses preuves (rouge avant / vert
après / rouge sous mutation) et sa section datée dans `CLAUDE.md` :
`p0-lbc-pub` (titre « taille 43 », prix = celui de Vinted posé par-dessus la
recommandation de Leboncoin, ville du vendeur dans « Lieu », livraison activée —
Réglages → « Ta ville »), `p0-lbc-photos`, `p0-lbc-annonces`, `p0-audits`,
`p0-ebay-photos` (photos d'une annonce lues au clic depuis le formulaire eBay),
`p0-ebay-vc` (le clic eBay qui menait à Vestiaire), `p1-achats`, `p1-compta`
(Déclarations / Comptabilité séparées, `CarteUrssafMois`), `p1-comptes` (fiches
de comptes, adresses de réception, **mode stream**), `p1-ebay-prep` (prix et
description repris de Vinted, relecture GetItem après publication), `p1-fiscal`
(profil d'entreprise SIREN/forme/TVA/marge/VL, factures et avoirs numérotés sans
trou, régime respecté partout), `p1-journee` (Ma journée : barre de 4 actions),
`p1-messages`, `p1-stock`, `p1-veille`, `p1-ventes`, `p1-annonces` (logo de chaque
plateforme où la paire est PROUVÉE en ligne, « Vestiaire Collective » en entier).
La **réponse automatique aux messages a été RETIRÉE** (décision de Julien, 15 oct.).

---

## 2. Les 5 choses à faire en premier, dans l'ordre

1. **Appliquer les 7 patchs** (§3), puis **finir la numérotation automatique**
   (arrêtée depuis le 11 oct. 13:36 — c'est le goulot n°1 : sans N°, une paire
   n'apparaît ni dans la file Leboncoin ni dans le sélecteur eBay ; mesuré le
   16 oct. : **17 paires sur 60 en ligne seulement** sont publiables).
2. **Retour en litige** (patch 1, construit) : faire les 3 relectures adverses,
   corriger, prouver. C'est la plainte du 15 oct. : une vente en litige dont le
   colis de RETOUR est arrivé au point relais proposait « Imprimer le bordereau ».
3. **eBay en un clic** (patch 5, partiel) — Julien commence à publier sur eBay :
   « je ne dois rien avoir à remplir, juste Publier ». Plan mesuré au §4.3.
4. **Les 4 bugs P0 restants** : « Tout imprimer » (patch 3), tampons par type de
   bordereau (patch 4), le nuage barré (pas commencé), les comptes bloqués (pas
   commencé). Puis les **relectures adverses jamais faites** des lots
   `lbc-pub`, `lbc-photos`, `ebay-photos`, `ebay-vc`, et les défauts des
   relectures **fiscal (9)** et **annonces (4)** (patchs 6-7 partiels).
5. **Monter l'extension en 5.178.0, vérifier tout, PR, mettre en production**
   (§5). Ensuite seulement : la **maquette de style** (en DERNIER), puis l'arriéré.

---

## 3. Les 7 patchs — appliquer, puis finir

```
git checkout claude/project-review-nsk5su && git pull
for p in docs/passation/wip/[1-7]-*.patch; do git am -3 "$p" || break; done
npm install && npm run build && node scripts/audit-variables.cjs && node scripts/audit-tdz.cjs
```

| # | patch | ce que c'est | état |
|---|---|---|---|
| 1 | `1-p1-retours-3-commits.patch` | retour en litige : plus de bouton bordereau, le retour dans « colis à retirer », la date limite de renvoi d'un achat en litige | **construit**, audits `audit-retours-vente` et `audit-statuts` verts, **3 relectures adverses JAMAIS faites** |
| 2 | `2-p0-numerotation-WIP.patch` | ⚠️ **UNIQUEMENT une SONDE de diagnostic** (`window.__numDiag`) + un banc de reproduction `scripts/bancs/numeros-republication.cjs` (port 6160, données inventées à la forme de la prod) | **pas un correctif** — lance le banc, lis `__numDiag`, trouve la porte qui bloque, corrige, puis **RETIRE la sonde** |
| 3 | `3-p0-imprimer-WIP.patch` | « Tout imprimer » : aperçu, dédoublonnage, échecs nommés, `marquerLotImprime` ; banc `scripts/bancs/imprimer.cjs` | partiel, non prouvé, non relu |
| 4 | `4-p0-tampons-WIP.patch` | tampons titre + N° par TYPE de bordereau et par imprimante (`posTampon`, `noterTampon`, `vinted_bordereau_formats`) ; `audit-tampons.cjs` vert, banc `tampons.cjs` | partiel, non relu — **posé par-dessus le 3** (même chemin d'impression) |
| 5 | `5-p1-ebay-auto-WIP.patch` | eBay en un clic : `analyser()` lancé tout seul au choix de la paire, état Vinted → état eBay (`etatVinted`, `condAuto`, `aspAuto`), `api/ebay.js` | partiel ; `audit-ebay-publication` (78 ✅) et `audit-ebay-route` verts après résolution ; non relu |
| 6 | `6-p1-fiscal-WIP.patch` | corrections partielles des 9 défauts de la relecture fiscal | partiel — liste des défauts : `wip/defauts-relectures-15oct.md` |
| 7 | `7-p1-annonces-WIP.patch` | corrections partielles des 4 défauts de la relecture annonces | partiel — idem |

Un patch appliqué n'est PAS un patch juste. Applique-les tous (ils sont
imbriqués), puis reprends chaque chantier, prouve-le (§6.1 de `CLAUDE.md`), et
s'il est mauvais, `git revert` son commit. Les rapports bruts des agents
(mesures en base, causes, preuves) sont dans `docs/passation/notes/15oct/`.

---

## 4. Les chantiers, en détail utile

### 4.1 Numérotation arrêtée (P0 — le plus important)
- **Mesuré le 15 oct.** : dernière fiche créée par l'app = `numberedAt
  2026-10-11T13:36:12Z`. Depuis : **64 annonces** mises en ligne sur 6 comptes,
  **toutes sans fiche** dans `main.vinted_annonce_numeros` (425 fiches, figé).
  Marqueur sain : `vrm_numerotation` version 2, coupure `2026-10-09T00:00Z`,
  archive « B », pool 582 entrées, `vrm_num_prefixe` vide.
- Forme réelle des annonces : **aucun `created_at_ts`**, seulement
  `photo.high_resolution.timestamp` (en SECONDES) ; l'app la normalise en
  `createdTs`. Suspects : `annonceNumerotable`, `dateMiseEnLigneMs`,
  `numerotationPermise()` (version relue depuis moins de 3 min),
  `cloudReady`, `txnPret`, les annonces « à confirmer » (lecture publique).
- La boucle est dans `src/App.jsx`, composant `Comptabilite`, l'effet « ⛔ pas de
  numérotation avant que le cloud soit chargé ». Le patch 2 y pose la sonde.
- **Règles intouchables** (§5) : un numéro n'est JAMAIS réattribué (pool
  append-only, garde-fous SQL `vrm_pool_retreci`, `vrm_numeros_perimes`,
  `vrm_prefixe_archive` qui REFUSENT l'écriture) ; un ancien numéro (B…) ne se
  redonne jamais ; seule une annonce SANS numéro en reçoit un automatiquement.
- Preuve attendue : le banc rouge sur la branche actuelle (les 3 nouvelles
  annonces restent sans N°), vert après, et rouge si on réaffaiblit.
- ⚠️ À part (geste de Julien, voir §8) : 8 paires (6 encore en ligne)
  renumérotées par erreur entre le 30 sept. et le 2 oct. (543→266 …) — c'est son
  carton qui dit le vrai numéro.

### 4.2 Retour en litige au point relais (P0 — patch 1)
- **Mesuré** : tx `22592792923` (tomj606, 59 €) : vente passée en 440 « Retour
  initié » ; la liste dit `needs_action` + « colis déposé… point relais ». Les
  trois règles « à expédier » (app `aExpedier`, extension `A_EXPEDIER`,
  `api/widget.js`) répondaient **vrai** ⇒ « À expédier » + « Imprimer le
  bordereau » (le bordereau d'ORIGINE, déjà utilisé). Le widget comptait 6 colis
  pour 5. Le témoin `23052006117` a le même texte en `waiting` : seul le couple
  « needs_action + colis déjà déposé » distingue le retour.
- Le message du retour vit dans la **conversation** (`event_group
  return_shipment`, `event_type held_at_post_office`, « Rends-toi au point
  relais … pour le récupérer »), **sans code ni QR**. `retraitDeConversation`
  écartait tout le côté vendeur. La liste de ventes porte la conversation en
  UUID, la ligne captée est rangée sous l'identifiant numérique : le lien se fait
  par le n° de transaction.
- Ce que le patch 1 fait : la règle « à expédier » ne compte plus ce retour (les
  trois copies), le retour apparaît dans « colis à retirer » (Ma journée,
  Achats), « 1 retour de ta vente à récupérer » dans le titre, la date limite de
  renvoi d'un ACHAT en litige (« Retourne la commande d'ici le … ») relevée par
  l'extension (`renvoiLimite`) et dite en rouge une fois dépassée.
- Reste : **3 relectures adverses** (la règle — app/extension/widget disent la
  même chose sur les mêmes entrées ; les écrans — rendu à 390 et 1512 px ; l'
  extension — la conversation côté vendeur, aucun faux code), corriger, prouver.
  Le rapport complet de la mesure : `notes/15oct/retours-litige.md`.

### 4.3 eBay en un clic (P0 pour Julien — patch 5)
Demande du 16 oct. : « je ne dois pas avoir à remplir la marque, tu dois la
prendre sur Vinted, pareil pour le style, la catégorie, tout ça, je ne dois rien
avoir à remplir, juste Publier, ça poste automatiquement ».
**Mesuré le 16 oct. (lecture seule)** : 60 annonces en ligne ; prix 60/60 ; état
Vinted 60/60 (58 « Très bon état ») mais **non branché** (l'état « Occasion »
3000 part en silence) ; photos complètes 59/59 ; **description réelle 4/60**
(il n'en écrit presque jamais — repli : le titre) ; catégorie **0/60
automatique** (clic manuel « Trouver la catégorie eBay ») ; **17/60 cliquables**
(N° requis → voir 4.1). La catégorie vient DÉJÀ d'eBay en amont : `pubinfo`
(Taxonomy `get_category_suggestions`, `handlePubInfo` dans `api/ebay.js`).
Plan mesuré (rapport : `notes/15oct/mesure-publication-auto.md`) :
1. Réutiliser `pubinfo` (pas de `GetSuggestedCategories` en doublon, §11).
2. Serveur : si `categoryId` absent au publish/verify → 1re suggestion d'eBay,
   dite dans la réponse ; aucune suggestion ⇒ refus propre, rien de publié.
3. App : `analyser()` lancé tout seul après `choisirPaire` (fait dans le patch 5).
4. Ajouter un point « catégorie » à `verifPublication` (relecture GetItem).
5. État Vinted → ConditionID par libellé exact (Neuf avec étiquette→1000, Neuf
   sans étiquette→1500, Très bon/Bon/Satisfaisant→3000), borné aux états permis
   par la catégorie ; inconnu ⇒ défaut, DIT (fait en partie dans le patch 5).
6. Marque, style, pointure, couleur : depuis Vinted, à l'égalité exacte avec une
   valeur d'eBay, sinon la plus proche **en le disant** (décision de Julien du
   15 oct. : la plus proche plutôt que vide). Gardes inchangées : `dejaChezEbay`,
   `gardePublier`, confirmations, jamais d'option payante.

### 4.4 Publication 100 % automatique Leboncoin (P1)
Décision de Julien (15 oct.) : après SON clic « Publier », tout est rempli ;
quand une catégorie/option ne correspond pas exactement, prendre **la plus
proche, en le disant** ; description = **exactement** celle de Vinted (la réf
`VRM-{n°}` reste, c'est l'anti double vente). **La mesure Leboncoin a été coupée
par la limite : à refaire** (catalogue `lbc_catalogue` fdata/fforms, ses dépôts
`lbc_recon.etapes`, où le dépôt cale). Jamais de boost/option payante
(`publierSansBooster`).

### 4.5 Les 4 bugs P0 de la demande du 15 oct. pas finis
- **« Tout imprimer »** (patch 3) : il imprimait des bordereaux de ventes d'il y
  a un mois. Attendu : EXACTEMENT les ventes à expédier visibles avec un PDF ; un
  aperçu (date, plateforme, compte, statut, éligible ou non et pourquoi) ; les
  déjà imprimés exclus par défaut (case pour les inclure) ; dédoublonnage par
  transaction ; « Réimprimer les échecs » ; tri par **date de vente décroissante,
  toutes plateformes, jamais par compte**.
- **Tampons** (patch 4) : la position du titre + N° mémorisée par TYPE de
  bordereau (jamais par compte) et par imprimante (classique/thermique), réglable
  à la main avec aperçu, synchronisée (`SYNC_KEYS` + `onCloudReady`), le PDF
  source jamais modifié.
- **Nuage barré en haut** (pas commencé) : Julien : « pourquoi le nuage est
  barré ? Supabase relie mal les données ? ». Un panneau court qui dit l'état
  MESURÉ (synchronisé il y a X min · pas encore · hors ligne · la base ne répond
  pas · session expirée · dernière sauvegarde refusée) + UN bouton de reprise.
  Jamais « synchronisé » sur un « pas su ». Répondre à sa question.
- **Comptes bloqués** (pas commencé) : un statut par compte (bloqué /
  déconnecté / lecture seule / état inconnu) **dérivé d'un signal explicite** —
  un échec de chargement n'est JAMAIS « bloqué » ; affiché sur la fiche, dans
  Messages et dans la pastille Actions/Lecture seule ; les annonces d'un compte
  CONFIRMÉ bloqué sortent des vues actives, gardées en archive, jamais supprimées.

### 4.6 Relectures adverses dues
- **Jamais faites** : `lbc-pub`, `lbc-photos`, `ebay-photos`, `ebay-vc` (fusionnés
  dans la branche). Un relecteur qui REPRODUIT sur une copie, puis corrige.
- **Faites, corrections inachevées** : fiscal (9 défauts) et annonces (4) — chaque
  défaut avec sa reproduction : `docs/passation/wip/defauts-relectures-15oct.md`.
  Comptes (7) : corrigé et fusionné.

---

## 5. Intégration et mise en production

1. `git fetch origin && git merge origin/main` (VRAI merge ; après :
   `git diff origin/main --stat` ne doit montrer que nos fichiers).
2. **Extension 5.178.0** : `vinted-sync-extension/manifest.json` (version),
   `CODE_VERSION` en tête de `background.js`, `EXT_ATTENDUE` dans `src/App.jsx`,
   remplacer `photosclic: 'A_POSER'` dans `EXT_CAPACITES` par `'5.178.0'`
   (`lbctitre`/`lbclieu` y valent déjà 5.178.0), **régénérer
   `public/VRM-extension.zip`** (un seul dossier `VRM-extension/`, contenu =
   octet pour octet la source). `audit-extension-zip`, `audit-coherence`,
   `audit-preuve-vente` doivent passer (aujourd'hui rouges UNIQUEMENT à cause de
   la version non montée).
3. `npm run build`, **tous** les `node scripts/audit-*.cjs` (≈ 96 ;
   `audit-renum-b` est long), les bancs touchés **un par un**
   (`scripts/bancs/README.md` ; les fixtures `fx/` ne sont pas dans le dépôt
   public — les bancs à données inventées tournent sans).
4. Mettre à jour `CLAUDE.md` (une section datée par chantier : mesuré, décidé,
   prouvé, non mesuré).
5. PR `claude/project-review-nsk5su` → `main`, merge. Vérifier : déploiement
   Vercel READY sur le commit de merge, `/api/sante` répond, le zip servi est le
   bon (taille). ⚠️ Plan gratuit : **100 déploiements / 24 h** ; les branches
   `claude/**` ne se déploient pas (`vercel.json`) ; ne JAMAIS promouvoir une
   prévisualisation (les clés n'existent qu'en Production).
6. Dire à Julien : installer la 5.178 depuis le zip, dans UN SEUL dossier, en
   retirant toute autre copie de VRM dans `chrome://extensions`.

---

## 6. Après la mise en production
- **La maquette** `docs/design/maquette-style-2026-10-15.webp` à appliquer à
  TOUTE l'app, **sans changer la disposition des boutons** (règle §7 : une
  seule couleur d'accent, rare). En DERNIER.
- L'arriéré, vérifié (détail : `PASSATION-2026-10-16.md` §4 à §6) :
  - **construit avant le 12 oct. et jamais fusionné** (dans les bundles de
    `docs/passation/`) : litiges qui font sonner le téléphone, synchro de `main`
    par morceaux, copie quotidienne des numéros, « Tes connexions », pointage du
    stock carton par carton, coffre, fiche Chrome Web Store ;
  - **eBay** : CA eBay = « l'argent que tu reçois » (décidé le 3 oct., PAS codé),
    anti double vente VRM fermé (agent eBay, migration 015), pause stock 0,
    commandes eBay dans Colis, retours/litiges, offres reçues remises en tête de
    Messages (régression du 13 oct.) ;
  - **propositions du 11 oct. restantes** : 2 (double vente app fermée), 10
    (rappel la veille — attention au 2ᵉ cron), 17 (2FA, avec chemin de
    récupération), 33 (studio photo, sans la clé de Julien), 37 (mode équipe),
    5 (vitesse, en dernier). Déjà livrées : 1, 3, 4, 6, 9, 11, 13-16, 21, 22, 24,
    25, 34, 35. Mesurées impossibles : 18, 23 ;
  - #21 (plusieurs milliers d'utilisateurs), #79 (revue complète), #81
    (Vestiaire : publier avec détourage), adresse de réception PROUVÉE (bloquant
    avant d'ouvrir VRM à des inconnus).

## 7. Décisions de Julien à NE PAS défaire
- **Réponse automatique aux messages Vinted : RETIRÉE** (15 oct.) — l'extension
  lit, il répond sur son clic depuis VRM.
- **Acceptation automatique d'offres sur Vinted : RETIRÉE** (5 oct.). Sur eBay
  seulement : le seuil natif d'eBay, posé sur son clic.
- Jamais de délais aléatoires « humains », de pilotage souris/clavier, de
  suppression automatique d'annonce, de messages en série (§3).
- Garde-fous de l'extension intouchables : compte de l'onglet (`garde`), 20
  actions/h, une requête à la fois.
- VISUEL-01…20 **abandonnés**, APP-01 et APP-06 **exclus** (matrice du 15 oct.).
- Publication Leboncoin/eBay : **la catégorie la plus proche** quand rien ne
  correspond exactement (en le disant) ; **jamais d'option payante**.
- Numéros : jamais réattribués ; anciens en « B » ; rien ne change un numéro
  tout seul (sauf une annonce sans numéro).
- Abonnement : **12,99 €/mois** (prix Stripe `vrm_mensuel` à recréer par lui).

## 8. Gestes que SEUL Julien peut faire (à lui rappeler, pas à faire à sa place)
Certains ont peut-être été faits depuis : **vérifie avant de les lui redemander**
(la liste vérifiée une à une est dans `PASSATION-2026-10-16.md`).
- Installer l'extension à jour (UN seul dossier), puis passer sur Vinted.
- Regarder le carton des 8 paires (6 encore en ligne) renumérotées par erreur (543→266, 544→267,
  545→268, 548→269, 549→270, 550→271, 551→276, 552→285) et remettre le bon N°.
- Supabase → Authentication → URL Configuration : Site URL `https://vrm.center`
  + Redirect `https://vrm.center/**` ; un SMTP personnalisé.
- Stripe : recréer le prix 12,99 € sous la clé `vrm_mensuel` (tant que ce n'est
  pas fait, le paiement reste fermé) ; Terms of service =
  `https://vrm.center/legal/cgv.html`.
- Remplir l'adresse de contact (`src/contact.js` ET `public/legal/editeur.js`).
- Passer le dépôt GitHub en PRIVÉ.
- Supprimer les branches de sauvegarde poussées par erreur
  (`claude/wip-ext-5162`, `claude/wip-bilan-lancement`) ; les tables
  `sauvegarde.app_data_20260930/_20261002` (un DROP exige un humain devant
  l'écran).

## 9. Pièges de la reprise (tous déjà payés une fois)
- `git merge -s ours` défait en silence le travail des autres : interdit.
- **Commiter AVANT toute manipulation de branche** (une recette de rebase a déjà
  détruit du travail non commité).
- `api/` : le plan Hobby plafonne à **12 fonctions** (une 13ᵉ bloque TOUS les
  déploiements) — ajouter un MODE à une route existante.
- `npm run build` ne compile pas `api/` : une route n'est vérifiée que si un banc
  l'EXÉCUTE.
- Un `useMemo` lit ce qui est déclaré AU-DESSUS de lui (§4.6) — `audit-tdz.cjs`.
- Un audit doit être ROUGE sur le code d'avant (copie `git archive`, lancé
  DEPUIS la copie) ; un contrôle qui ne peut pas échouer est pire qu'absent.
- « Pas su » ne vaut jamais « oui », « rien lu » ne vaut jamais « rien » — c'est
  la famille de défauts la plus coûteuse du projet (relis §5 du dossier).
- Le serveur GitHub MCP était en échec de connexion dans cette session : si tu
  ne peux pas ouvrir la PR, dis-le à Julien (il peut l'ouvrir depuis GitHub).
