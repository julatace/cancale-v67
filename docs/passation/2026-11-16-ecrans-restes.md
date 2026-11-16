# 16 nov. 2026 — Les restes des écrans (lot `ecrans-restes`)

Branche `claude/ecrans-restes`, partie d'`origin/main` (b8f26f36d). Aucune écriture en base réelle ; données de banc
inventées. Sept points de la liste du 16 nov. : 27, 28, 32, 36, 37, 51, 57.

## ÉTAT À LA REPRISE

- Tout ce qui suit est poussé sur la branche ; la PR et la fusion sont dites dans la ligne de CLAUDE.md §9.
- Reste ouvert (dit plus bas, « Ce qui n'est pas fait ») : les N° d'un lot dans la notification serveur du bordereau.
- Geste de Julien : aucun.

## Ce qui est livré

**(27) Le stock importé d'un autre outil se voit.** Paramètres → Importer rangeait les paires dans
`vrm_stock_importe` sans les montrer nulle part (récit 2026-11-11-import-autre-outil.md).
- Règle PURE `src/stockImporteVue.js` : par le N° seul (`cleNum`), jamais un titre ; une paire reliée à une annonce par
  SON clic (`annonce`) ou dont le N° est porté par une fiche est déjà dans la liste : pas deux fois ; un prix absent reste
  « pas dit » (null), jamais 0.
- **Stock** : une section « N importées d'un autre outil » sous la liste (N°, titre, « rangée « Carton B3 » (ton fichier) »,
  « achetée 25,00 € ») ; toucher une ligne ouvre SA fiche (« Tout sur le N° »).
- **Loupe** : « Tout sur le N°900 » a une ligne « Importée d'un autre outil · rangée … · achetée … » (`rn.importe`,
  src/rechercheNumero.js ; `null` lu = « pas su » dans les manques, absent = rien) ; la recherche par mots trouve aussi
  une paire importée (`importeesPourRecherche` dans `S.stock` de src/rechercheUnique.js) et ouvre sa fiche.
- **Fiche** : l'étape Stock dit « Importée · rangée « … » (dit par ton fichier) » ; le coût vient du coût par N°.
- **Serveur** : le bilan de la semaine (api/_lib/bilan-semaine.js, appelé par api/ship-reminders.js) passe
  `importees` à `ventesFaites` et `ventesDeclarables` (la copie refabriquée, inchangée) ; `vrm_ventes_importees` est lue
  dans la projection de `main` ; illisible ⇒ NOMMÉ. Le widget n'a rien à faire : il lit `vinted_urssaf_mois`, publié
  par l'app qui compte déjà les ventes importées.

**(28) La recherche manuelle de point relais : RETIRÉE (tranché).** `openRelayPicker` n'avait aucun bouton,
`addPointByAddress` / `removeSavedPoint` aucun appelant ; `OsmMap` et son fond `FondMiniCarte` ne servaient qu'à elle.
Pas rebranchée sur « point inconnu » : un point inconnu, c'est un colis dont AUCUN message ne dit le relais — chercher
« Super U Lyon » ne dit pas où est CE colis ; il faudrait relier le colis au lieu choisi, une identité devinée (§5), et
la carte ne range plus aucun point sans code postal LU depuis le 9 nov. Les points LUS (`ensureSavedPoint`) restent.

**(32) La date limite d'envoi dans la fiche et la loupe.** (`dateLimite` EST dans `meta` : c'est un scalaire de premier
niveau, `fetchEmailBordereaux` le projetait déjà — la remarque du récit fiche-d disait le contraire.)
- « Tout sur le N° » lit `dateLimite:meta->>dateLimite` des bordereaux e-mail (scalaire, jamais le PDF) et la garde par
  transaction ; `parcoursPaire` calcule `limiteEnvoi` par LA règle de Colis fournie par l'app (`limiteExpedition` :
  l'e-mail du bordereau, sinon vente + 7 j ESTIMÉE ; `texteLimiteEnvoi` pour la phrase) ; sans règle ⇒ null.
- La fiche : la ligne d'état « Vendue 65 € · à poster avant le 19 nov. à 10 h » (ambre) quand la carte n'est pas celle du
  bordereau ; sinon la carte « À déposer » porte la phrase (`data-fd-limite`, `data-fd-limite-estimee`).
- La loupe : Ventes publie aussi la LISTE des colis Vinted à expédier dans `vrm_colis_aposter` (clé de l'appareil, non
  synchronisée : titre court, N° — le tampon pour un lot —, jour, heure, estimée ; ni acheteur ni adresse ni suivi),
  republiée quand elle change ; « colis à expédier demain » la filtre (état `a-expedier`, jour) si elle a moins de 12 h,
  sinon « pas encore lus ici : ouvre Ventes une fois ». Toucher un résultat ouvre Ventes → « À envoyer ».
  Les colis eBay / Leboncoin / Vestiaire ne sont pas dans cette liste (leurs nombres seuls, comme avant).

**(36) iPad / 900 px / 1512 px.**
- 768–1199 px à la souris : les filtres de site passaient PAR-DESSUS la recherche (mesuré : 20 px sur Ventes et
  Messages) — `.vrm-barre-haut-droite` se resserrait sous sa rangée. La règle de la tablette au doigt vaut pour toute la
  coque ordinateur (src/styles-barre-haut.css) : les filtres gardent leur largeur, la recherche se resserre (≥ 140 px).
- Messages 744–999 px : un BLOC BLANC de 73 à 83 px sous le panneau de conversation (la zone de travail blanche plus
  haute que le panneau). La règle « une hauteur pour les deux colonnes » (`--vrm-msg-h`, déjà là à partir de 1000 px)
  vaut maintenant sur toute la coque à deux colonnes (src/styles-captures.css). Une liste courte dans une fenêtre très
  haute laisse le fond de SA colonne (comme à 1000 px et plus) — plus de vide sous le panneau.
- Paramètres 1512 : « Pas encore synchronisé · Réessayer » écrasé (« P… », « Réessayer » lettre par lettre : bouton de
  15 px). Cause : index.html réserve la place de l'île (`--vrm-ile`, ~300 px) à droite de toute `.vrm-settings-status`
  — réserve d'avant le 14 nov., quand la ligne d'état était la première ligne. Elle vit maintenant dans la ligne du titre,
  sous la barre du haut : réserve retirée là, bouton jamais coupé (src/styles-reglages.css).

**(37) « Tout imprimer » tamponne les N° du lot.** `lignesLotTous` : une vente en lot (`lotDeVente`, lue) porte le
tampon de SES articles (« 124 · 131 · 140 + 1 sans N° », la règle d'`imprimerBordereauVente`) et leur liste `nums` ;
la garde du §5 (`numerosDemandent` / `confirmerNumerosAVerifier`) vérifie CHAQUE N° (`numerosDeLigne`), sur les trois
chemins (le lot, une ligne, « Placer ») ; la signature du PDF préparé suit le tampon.

**(51) « Plus tard » de la carte MFA, sur tous ses appareils.** `vrm_carte_mfa_rangee` est dans `SYNC_KEYS` ; la carte
écrit par `save` (file d'envoi, nuage) et se relit par `useStateCle` ; l'ancien « 1 » de l'appareil se lit pareil.

**(57) L'instantané de Colis : RETIRÉ.** `ColisInstantane` était encore rendu (`grep -c '<ColisInstantane'` = 1) mais
plus rien ne le rangeait depuis le lot DJ3 (`<CaptureColis` = 0) : seul un instantané d'avant le 11 nov. aurait pu
s'afficher. Retirés : `ColisInstantane`, `capturerColis`, `lire/ecrireInstantaneColis`, `colisMontrable`, la branche de
`instantaneEcranIci`. La clé `vrm_colis_instantane:` reste connue de src/instantaneEcran.js (effacée à la déconnexion).
Écrans montés (`tab===`) inchangés ; le banc colis-ventes-instantanes juge déjà qu'aucun instantané de Colis ne se montre.

## Fichiers

`src/stockImporteVue.js` (neuf), `src/ecrans/Stock.jsx`, `src/ecrans/Loupe.jsx`, `src/rechercheNumero.js`,
`src/rechercheUnique.js`, `src/fichePaire.js`, `src/ficheProduit.js`, `src/FichePaire.jsx`, `src/CarteDoubleVerif.jsx`,
`src/App.jsx`, `src/ColisVentesInstantanes.jsx`, `src/colisVentesInstantanes.js`, `api/_lib/bilan-semaine.js`,
`api/ship-reminders.js`, CSS `styles-barre-haut`, `styles-captures`, `styles-reglages` ; traductions
`src/i18n/langues/*/ecransRestes.js` (5 langues) ; « Quoi de neuf » : `stock-importe-visible`, `fiche-date-limite`.
Audits retouchés sur la RÈGLE : `audit-copie-annonces` (M2 : `save(CLE_CARTE_MFA, 1)`), `audit-photos-vinted`
(entrée `OsmMap` retirée), test `colis-ventes-instantanes` (plus de `colisMontrable`).

## Preuves

- `scripts/audit-ecrans-restes.cjs` : **38 verts** ; `--prouve` **12/12 mutations rouges** ; sur l'arbre d'origin/main
  (`RACINE=`) : **22 rouges**. Il EXÉCUTE `importeesAuStock`, `toutSurLeNumero`, `parcoursPaire`, `ligneEtat`,
  `actionFiche`, `limiteExpedition` et `calculerBilan` du serveur (vente importée comptée, déjà lue jamais deux fois).
- Banc `scripts/bancs/ecrans-restes.cjs` (données inventées, `locale: 'fr-FR'`) : A stock importé (390 tactile + 1512),
  B date limite (fiche, publication, loupe — 390 + 1512), C 900/768/1000/820 doigt/1512, E MFA (1512 puis un autre
  appareil à 390) : **30 / 30 verts** ; sur le build d'origin/main (`BANC_DIST`) : **A 10 rouges, B 8 rouges, C 7 rouges,
  E 2 rouges** (27 sur 30) (seul E1, la carte qui se montre, est vert des deux côtés : c'est la précondition).
- Captures regardées (390, 900, 1512) : Stock (section importées), fiche N°160 « à poster avant le 19 nov. à 10 h »,
  loupe « colis à expédier », Messages 820 doigt (plus de vide sous le panneau), Paramètres 1512 (ligne entière),
  barre du haut à 900 px.

## Ce qui n'est pas fait (dit honnêtement)

- **Les N° d'un lot dans la notification serveur du bordereau** : la notification ne nomme que le N° que le vendeur a
  écrit dans le titre de l'annonce (lu dans l'e-mail) ; un lot est titré « Lot 3 articles », donc aucun N°. Pour nommer
  les N° du lot, le serveur devrait lire la transaction (`order.items`, souvent capturée APRÈS l'arrivée de l'e-mail) et
  les fiches par identifiant d'annonce, et un banc devrait EXÉCUTER la route (§4.10) : pas fait ici. Le widget, lui,
  n'affiche que des nombres de colis (aucun N°, même pour une vente simple) : rien à y ajouter.
- La loupe « à expédier » ne connaît que les colis Vinted (les autres sites publient des nombres).

## Geste de Julien

Aucun.
