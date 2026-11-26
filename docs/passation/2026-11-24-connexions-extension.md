# 24 nov. 2026 — « Connexions de l'extension » (lot `claude/connexions-extension`)

Julien : « que on soit bcp plus informé sur les connexions d'extensions ».

## Ce qui est livré

- **Paramètres → Mes comptes → « Connexions de l'extension »** (onglet `connexions`, `?tab=connexions`) :
  `src/connexions/EcranConnexions.jsx`, règle PURE `src/connexions/connexions.js`, textes `cnx.*` (5 langues,
  `src/i18n/langues/*/connexions.js`), styles `src/connexions/connexions.css` (gris clair, accent ardoise, aucun ambre).
  - **Tes navigateurs** : une rangée par installation vue depuis moins de 3 j — « Chrome · Mac » (+ « #1a2b » quand deux
    portent le même nom, + « ce navigateur »), « En ligne maintenant » / « Vu il y a 5 h » / « Pas vu depuis 2 j »,
    « À jour » ou « 5.418 → 5.440 », les comptes qu'il lit (« Vinted : shop_a, shop_b · Leboncoin relu il y a 2 h »),
    pour CE navigateur « relié à ton compte VRM / à un autre compte VRM / pas relié à VRM » ; puis LE problème du moment
    en une phrase et UN bouton (icône + verbe) : arrêt nommé par l'extension (5.448), santé d'un site ≠ ok (5.448), envoi
    vers VRM raté (réseau), version ancienne (« Mettre à jour »).
  - **Tes comptes vendeur** : chaque compte Vinted (et Leboncoin / Vestiaire lus par `useComptesAutresSites`) : « relu il y
    a … », par QUEL navigateur, la jauge « 12/50 cette heure » (« prudence 24 h » quand elle court) ; « Vinted demande une
    vérification » / « Session Vinted expirée » (lus dans `actions_compte_*`) ; « Pas relu depuis 24 h : ouvre Vinted sur
    shop_x » avec « Ouvrir Vinted ».
  - **Anciennes installations** (repli, compte) : celles plus vues depuis 3 j ; rien n'est effacé.
  - « Pourquoi ? » replié : d'où viennent les lignes, pourquoi la jauge est par compte, pourquoi les anciennes sont à
    part, pourquoi « — » avant 5.448.
  - Relue à l'ouverture puis **toutes les 60 s tant que la page est visible** ; rien ne part quand l'onglet est caché
    (`visibilitychange`).
- **Aujourd'hui** : `LigneConnexionsJournee` — UNE ligne + « Voir », seulement quand un geste attend (dans cet ordre) :
  une vérification / session demandée par Vinted sur un compte ; une extension ANCIENNE vue dans les dernières 24 h
  (« Extension ancienne 5.418 : installe la 5.440 ») ; un compte relu un jour mais plus depuis 24 h. Rien sur « pas su »,
  rien sur une vieille installation. Une lecture, aucun minuteur.
- `nouveautes.js` : « Chaque navigateur et chaque compte, en clair ».

## La règle par compte, pour la porte « agir seulement si connecté »

Règle de Julien relayée le 24 nov. : depuis l'app il agit sur un compte seulement si l'extension est connectée pour
CE compte, sinon lecture seule ; la porte `peutAgir(plateforme, compte, capacite)` (branche `claude/agir-si-connecte`)
lit `etatConnexionCompte` (src/connexions/etatConnexionCompte.js, pure) : `connecte` true = un navigateur a vu ce compte
ouvert dans son onglet il y a moins de 30 min ; false = pas depuis 30 min / jamais ; **null = pas su ⇒ NON pour une
porte** (lecture en cours ou ratée ; Leboncoin et Vestiaire, qui ne publient pas leurs comptes vus : `compte-non-publie`).
`aJour` / `installer` : la version de l'extension qui l'a vu. Nom transmis à « main ».

## Mesures de la vraie base (24 nov., lecture seule, projections, rien de personnel copié)

- `ext_appareil_*` : **22 lignes, 1 vendeur**, id `ext_appareil_{16 hex}`. Clés de `data` : `appareil {nav, systeme, paquet}`,
  `at`, `atMs`, `code`, `diag`, `flux`, `v`, `ver`, `vus`. **Une ligne par INSTALLATION** : 17 « Chrome · Mac » de 5.329 à
  5.440, 3 Orion (5.336, 5.368, 5.409), 1 Chrome · Linux. Aucun nom d'ordinateur publié (seulement nav + système) ⇒
  le suffixe « #xxxx » quand deux portent le même nom, et les comptes lus pour les reconnaître.
- Versions vivantes ce matin (vues < 24 h) : 5.440, 5.410.8, 5.410.7, 5.436, 5.439, 5.438, 5.409 (Orion), 5.410.1, 5.418 —
  servie 5.440 ⇒ plusieurs « anciennes » réellement actives : c'est exactement la ligne d'Aujourd'hui.
- `vus.vinted` = `{ uid Vinted: ms }` ; `flux.{vinted|leboncoin|vestiaire}` = `{ okAt, koAt, koStatut, refus[{ at, statut:
  'reseau', famille, octets }] }` (les ENVOIS vers VRM) ; 3 lignes ont un `koAt`, toutes `statut: 'reseau'`.
- `diag` = `{ auj|hier: { jour, n: { suivi_vu_escrow: 4, … } } }` : compteurs internes, **pas montrés** (rien pour lui).
- `actions_compte_*` : 27 lignes (clés `ts, max, reserve, jour, maxJour, parJour, montee, captcha, arret, ev, so, ta, nav, uid…`),
  1 captcha, 1 arrêt. Le `{nav}` de `actions_compte_{uid}_{nav}` n'est **jamais** l'id d'`ext_appareil` (0 sur 27) ⇒ la
  jauge « 12/50 cette heure » est affichée **par compte** (somme de tous les navigateurs, `jaugeDuCompte`), pas par
  navigateur — l'attribuer à un navigateur serait inventer. Dit sous « Pourquoi ? ».
- `public/extension-version.json` : 5.440.0 sur main (= `EXT_ATTENDUE`) ; la branche `claude/ext-adaptatif` sert 5.448.0
  avec `regles { 'vinted:supprimer': '5.448.0' }`.

## Les champs de la 5.448 (message du coordinateur, branche `claude/ext-adaptatif`)

`sante { vinted|lbc|vc|ebay: { k: ok|element|forme|onglet|pas-vu, nom } }`, `arret { site, geste, code, at }`, `servie`,
`depassee`. Lus **seulement présents**, en projection (`sante:data->sante,arret:data->arret,servie:data->>servie,
depassee:data->>depassee`). Une installation < 5.448 sans `sante` ⇒ `data-cnx-sante="trop-ancienne"` (« — », raison sous
« Pourquoi ? »), jamais « ok » ; version illisible et pas de `sante` ⇒ « pas-dit ». Un code d'arrêt inconnu devient
« autre » (aucun texte de page n'est affiché). `servie` plus récente que `EXT_ATTENDUE` ⇒ c'est elle qu'on demande
d'installer ; `depassee: true` ⇒ « ancienne » même si la comparaison ne le dit pas.
Le seuil vient de `EXT_CAPACITES.santesites` s'il existe, sinon `SANTE_DEPUIS = '5.448.0'` (src/connexions/connexions.js).
**À faire quand la 5.448 arrive sur main** : ajouter `santesites: '5.448.0'` à `EXT_CAPACITES` (fonction de l'extension
qui publie `sante`) — pas fait ici : `audit-coherence` exige la fonction dans `vinted-sync-extension/background.js`, pas
encore sur main, et ce lot ne touche pas à l'extension.

## La notification « navigateur plus vu » : NON faite, et pourquoi

Demandée en option « seulement si elle peut se décider sur des données réelles sans fausse alerte ». Mesuré : chaque
réinstallation laisse sa vieille ligne (22 lignes pour quelques navigateurs réels), et rien ne relie une ligne à la
suivante (pas de nom d'ordinateur, id neuf). « Un navigateur connecté n'a plus été vu depuis N heures alors que des
onglets Vinted servaient » sonnerait donc à CHAQUE mise à jour par dossier (l'ancienne ligne se tait pour toujours),
et rien ne dit qu'un onglet Vinted était ouvert ailleurs à ce moment. Pas de notification ; la page dit « Pas vu depuis
2 j » et range à part ce qui dépasse 3 j. À reprendre si l'extension publie un identifiant d'ORDINATEUR stable.

## Preuves

- `node scripts/audit-connexions-extension.cjs` : **39 verts** (dont 6 pour `etatConnexionCompte`), fixtures à la forme réelle (3 navigateurs vivants dont un
  5.418 et un Orion pas vu depuis 2 j, une ligne sans champs, une installation de 9 j (rangée à part au-delà de 3 j : mesuré 20 lignes vues en 7 j, 15 en 3 j), un doublon d'id ; 4 comptes Vinted
  dont un pas relu depuis 24 h, Leboncoin). `--prouve` : **9 mutations, 9 rouges** (`passu-ok`, `sante-ok`, `doublon`,
  `anciens`, `alerte-absent`, `select-data`, `arret-brut`, `connecte-vieux`, `jamais-frais`). Sur origin/main : le module n'existe pas.
- `scripts/bancs/connexions-extension.cjs` : la page rendue à 390 tactile et 1512, clair et sombre, puis Aujourd'hui (la
  ligne et « Voir »), Paramètres (l'entrée), et « tout va bien ⇒ aucune ligne » : **70 verts, 0 rouge** (dont « aucun texte
  visible de plus de 8 mots », « aucun texte ambre », cibles ≥ 44 px, aucun débordement). `--prouve` (mutations du BUILD) :
  `version-ok` rouge (10), `sante-ok` rouge (8). Captures regardées (390 clair/sombre, 1512 clair/sombre, Aujourd'hui).
  Sur origin/main : l'onglet `connexions` n'existe pas (absent d'`ONGLETS_LIENS`) ⇒ la page ne se monte pas, le banc
  rougit à son premier contrôle (pas relancé sur un build de main : machine saturée, charge 37).
- `textes-visibles` (ECRANS=connexions,journee) : 4 verts, plafonds `connexions@390/1512` posés à 0.
- Audits voisins : `traduction` 45 verts, `coherence` vert, `quoi-de-neuf` vert, `icones` vert, `fonctions-api` vert.

## ÉTAT À LA REPRISE

- PR #1357 (base main), à fusionner APRÈS #1326 (style-clair, d'où part la branche) et #1342 (appareils-connectes ;
  sa carte « Navigateurs avec l'extension VRM » dans Sécurité reste : elle sert « Se déconnecter partout », celle-ci
  sert le diagnostic). Pas fusionnée.
- Quand la 5.448 arrive sur main : `santesites: '5.448.0'` dans `EXT_CAPACITES` (voir plus haut).
- Pas fait : la notification « navigateur plus vu » (raison plus haut) ; la jauge PAR navigateur (aucune identité commune).

Geste de Julien : aucun (la page lit ce que ses extensions publient déjà ; les champs 5.448 s'allumeront seuls avec la 5.448).
