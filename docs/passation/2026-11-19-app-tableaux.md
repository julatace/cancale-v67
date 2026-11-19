# 19 nov. soir — « L'app en tableaux de travail » (branche `claude/app-tableaux`, partie de `claude/integration-19nov`)

Julien (captures d'un outil de vendeur, gardées hors du dépôt) : « je veux que tu fasses les mêmes fonctionnalités, même rendu
grosso modo, même dans l'app, j'aime bien ce style, les options proposées ». On reprend la STRUCTURE et les options, pas la marque
ni les couleurs (accent bleu VRM, étiquettes douces, ambre = un geste à faire, jamais de rouge ni de violet). Contrat : NATIF.md §2 bis.

## Ce qui est livré
- **Composant** `src/natif/TableauTravail.jsx` + `src/natif/tableau.css` (mode d'emploi : `docs/design/NATIF-composants.md`).
  Vignette 48 ajoutée à `Vignette` (ajout de prop, rien cassé).
- **Annonces** (ordinateur) : `src/natif/ecrans/AnnoncesTableau.jsx`, branché par `src/ecrans/AnnoncesEgalite.jsx`. Colonnes : Article,
  N°, Prix, Prix mini, Acheté, Bénéfice, Date, Vues, Favoris, Site · compte, Place, Statut (Bénéfice, Vues, Place cachées par défaut).
  Statut = le meilleur état des annonces au site / compte choisis (`statutTableau`, src/articles/modele.js) ; cochés par défaut :
  En ligne · Masquée · En pause · À confirmer = le segment « En ligne » d'hier (même nombre : 84 sur la base de volume).
  Filtres : Site, Compte, Ancienneté (« Dorment depuis 30 j » = la règle du segment). Actions = celles du menu « Actions »
  (mêmes `pour`/`juger`, même chemin `demanderActionAnnonces` / `vrm:publier-partout`). Cellules « — » : la même saisie qu'avant.
  Plus de troisième volet pour Annonces (`ECRANS_TABLEAU`) : la fiche s'ouvre en panneau à droite. Lien « Automatisations ».
- **Ventes** (ordinateur, segment « Toutes ») : `src/natif/ecrans/VentesTableau.jsx` dans `VentesToutes` — les mêmes lignes,
  la même étiquette (`etapeVente`…) rangée par `categorieVente` (src/ventesEcran.js) : À envoyer · En route · Terminée · Annulée ·
  Litige · En cours. Transporteur avec logo. « Imprimer les bordereaux » des ventes cochées ⇒ `vrm:imprimer-choix` ⇒ le moteur
  des colis à envoyer prend les lignes de SON lot par n° de transaction et appelle `imprimerLot` (aucune prête ⇒ dit).
- **Achats** (ordinateur) : `src/natif/ecrans/AchatsTableau.jsx` dans Comptabilite (`only==='achats'`) — `buysBase`, `etapeAchat`
  (`categorieAchat`), prix payé, transporteur (la ligne de suivi d'avant), code de retrait (seulement à l'étape « À retirer »,
  `codeRetrait`, ouvre le code). Annulés hors du défaut (la règle du 17 nov.). Les étapes et la recherche d'hier ne sont pas
  rendues à l'ordinateur (le tableau les porte).
- **Notifications** (ordinateur) : la feuille de la cloche en tableau (`NotificationsTableau.jsx`) : type, période 7 / 30 j / tout,
  Statut Non lue · Lue, « Marquer comme lues » en série (`marquerLues`, la même écriture).
- **Messages** : la rangée façon liste de travail — avatar rond (initiale) à gauche, vignette de l'article à droite (mêmes valeurs).
- **Automatisations** (`?tab=automatisations`, Paramètres → Automatisations, lien depuis Annonces) : `src/natif/ecrans/Automatisations.jsx`
  (vue, deux volets) + `src/automatisations/Branchement.jsx` (lectures / écritures). État LU dans le vrai réglage ; chaque geste
  écrit dans la clé existante : favoris (`vrm_favoris_reglages_{uid}` par `sauverReglagesFavoris`, l'allumage reste dans
  Messages → Favoris où le risque est dit, l'arrêt par `auto_stop`), offres (`vinted_offres_auto` après `confirmerOffresAuto`,
  la MÊME question qu'Annonces ; refus + variantes avec la garde `erreurMessageAuto`), baisse par règle (`avecRegle`), vendue
  ailleurs ⇒ masquée (lecture seule), republication (l'atelier). Onglets Configuration · Négociation.
- **Négociation par paliers** (demande du 19 nov. soir) : `src/automatisations/negociation.js` — marge %, paliers (% + message),
  aperçu « 100 → 93 → 88 → 85 · plancher 85 », marge par tranche, bonus de lot, arrondi ; le prix mini du N° est le plancher
  prioritaire. Rangé dans `vinted_offres_nego` (synchronisé). ⚠️ Le moteur ne fait PAS de contre-offre : l'écran dit « bientôt »,
  rien n'est envoyé. Geste côté extension à faire (lire `vinted_offres_nego`, capacité à ajouter à `EXT_CAPACITES`).
- ⛔ Pas de « boost favoris » (favoris artificiels : engagement simulé, CLAUDE.md §3).

## Preuves
`scripts/bancs/app-tableaux.cjs` (harnais `outils/app-tableaux/`, vraies vues, vraies règles d'articles, données inventées) :
1512 / 1280 / 390 tactile, clair / sombre, bases volume, vide, Leboncoin seul, Vestiaire seul : **370 verts, 0 rouge** (premier passage
complet, puis 187 / 0 sur volume après les retouches de largeur). Mutations `compteur`, `tri`, `plein` : chacune rougit.
Captures regardées (Annonces, Ventes, Achats, Notifications, Automatisations + Négociation, téléphone, sombre, Leboncoin seul).
Audits : traduction 45 / 0, tdz, variables, identite, quoi-de-neuf verts. Build vert.
`chiffres-volume` (Ventes, Achats, Annonces ; avant = `origin/claude/integration-19nov`, après = la branche) : les **12 valeurs
publiées identiques** ; à l'écran, **aucun montant disparu** (Ventes 70 = 70) ; Achats et Annonces en montrent PLUS (le tableau
affiche 100 lignes au lieu de 60, et tous les achats au lieu de la seule étape choisie) — d'où les écarts d'ordre et d'attributs.
La carte « Comptes détectés et liés » (page Extension, référence 16.webp) est faite : une rangée par compte, « Lié » ; « Délier »
reste dans Paramètres → Comptes (le pied le dit).

## Ce qui reste
- Barre latérale réductible en icônes (16.webp) : pas faite.
- E-mails en tableau : pas fait. Messages : pas de « Choisir une action » ni d'en-tête article N° + prix mini dans le fil.
- Actions par site dans Annonces (baisse Leboncoin / Vestiaire, pause LBC) : le menu reste celui d'annonces-a-egalite (Vinted +
  « Publier partout ») ; les limites de chaque site sont dites une fois en pied.
- Automatisations : « Messages aux aimés » Vestiaire et baisse auto Leboncoin / Vestiaire marquées « bientôt » (pas de moteur).
- La republication programmée n'a pas d'état lu (« — »).

## Suite (19 nov., nuit) — ce que le coordinateur a demandé ensuite
- **Messages** : « Choisir une action ▾ » (les gestes d'hier du « ⋯ » : non lues, à répondre, offres, toutes, mettre à jour,
  réponses rapides) et le filtre Site au-dessus de la recherche ; **l'article en tête du fil** (photo, N°, prix, prix mini)
  par identité (`paireDeConv` → `ficheDeConv`), rien sans article relié.
- **Filtre Site** : Achats et Messages (le MÊME choix que le menu de plateforme : `vrm:site-tache` → `setPlatSub` +
  `retenirFiltre`) ; Notifications : le site que l'adresse de la notification nomme (`siteNotif`), « Site non précisé » sinon
  (jamais deviné Vinted).
- **Annonces, gestes par site** : « Changer le prix (tous ses sites) » — la feuille existante `vrm:prix-partout` (Vinted,
  `baisserPrixLbc`, `baisserPrixVestiaire`, leurs garde-fous), un article à la fois ; « Mettre en pause sur Leboncoin » —
  une confirmation, puis `lbcPause` une par une, le bilan dit ; refusée tant que l'extension ne sait pas (`lbcPause`).
- **Barre latérale réductible** (72 px, icônes, libellés lus et en bulle) : `vrm_laterale_reduite`, cet appareil.
- **Automatisations alignées sur le moteur** (`claude/extension-utile`, PAS encore dans le train à cette heure) : UNE clé,
  `vinted_offres_paliers`, UNE forme et UNE règle — `src/negociationPaliers.js` est le fichier de cette branche, octet pour
  octet (`{ actif, remiseMax, paliers: [%], messages, arrondi }`) ; `vinted_offres_nego` et `src/automatisations/negociation.js`
  sont retirés. L'allumage demande. Les états viennent de `EXT_CAPACITES` : `contreoffres` et `baisselbc` absents de la table
  de cette app ⇒ « bientôt » (rien n'est envoyé) ; présents (après la fusion d'extension-utile) ⇒ l'état de l'extension.
  Baisse automatique Leboncoin : la même règle (`vinted_baisse_regle.comptes['lbc:{compte}']`), comptes Leboncoin dans le
  choix du compte quand la capacité existe. Marge par tranche et bonus de lot : « bientôt », RIEN de rangé (pas de moteur).
