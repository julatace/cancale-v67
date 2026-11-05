# 5 novembre 2026 — indicateur sobre, navigateur nommé juste, comptes un par ligne

Branche `v31-indicateur-pro` (app seule ; extension, zips et `EXT_ATTENDUE` non touchés).
Julien (demandes du 5 nov., §1 et §13) : « l'étiquette rouge "l'extension capte" plus pro », « elle affiche Chrome alors que je suis
sur Orion », « être mieux informé de la connexion et de la récupération des données ».
- **La pastille** (`EtatActions`) : tout va bien ⇒ un point discret à l'encre, sans halo, et le NOM du compte qui agit (« Actions
  possibles » reste en `aria-label`/titre) ; l'ambre SEULEMENT s'il y a un geste ici (`aRattraper`), sinon gris ; au doigt, le point
  de coin de l'en-tête ne se montre qu'en ambre. Mêmes `data-etat-*` (bancs). Panneau : plus d'accent quand tout va bien.
- **Le navigateur** : `motsNavigateur()` (src/navigateurExtension.js, une règle) — « ce Chrome » / « Orion » (`window.KAGI`) / « ce
  navigateur » ; Brave reconnu (`navigator.brave`) ; Safari jamais nommé (Orion s'y déguise) ; la page des extensions et le geste
  ⟳ seulement là où ils sont sûrs (Chromium, Firefox). `NAV` (App.jsx, favorisEcran.js, favorisAuto.js) remplace ~90 « Chrome » en dur ;
  le navigateur de l'ORDINATEUR vu du téléphone, ou celui « où l'extension est installée », se dit « le navigateur… ». Gardés : la liste
  « Chrome, Edge, Brave ou Opera », le « Chrome Web Store », la page d'accueil publique (`Accueil.jsx`, recommandation), les commentaires.
- **Tes comptes** (panneau de l'indicateur) : une ligne par compte, toutes plateformes — dernière relecture et le geste qui débloque
  (`src/fraicheurComptes.js`, sur `etatCompteLie`/`ageLecture` de Comptes liés, §11 ; `lireDernieresCaptures` partagé avec Comptes
  liés). Lu à l'OUVERTURE du panneau seulement (`useComptesAutresSites(actif)`) ; « pas su » dit par plateforme, jamais « jamais relu ».
- Preuves : banc `scripts/bancs/indicateur-pro.cjs` (port 7967, données inventées, 1512 + 390 tactile, Orion simulé par `window.KAGI`,
  agent Safari) — **19 rouges sur le build de `claude/project-review-nsk5su`** (85dad5b0), 0 après ; mutation « relecture publique
  comptée + NAV figé à Chrome » ⇒ 6 rouges. `relais-telephone.cjs` suit la phrase de l'ordinateur (« le navigateur de ton ordinateur »).
- **Non mesuré** : un vrai Orion (KAGI présent au chargement, documenté par Kagi, pas vu) ; la page des extensions d'Orion (non nommée) ;
  « désactive puis réactive VRM » comme geste de rechargement hors Chromium (supposé, pas essayé).


## Revue adverse (5 nov., même branche)
Défauts reproduits sur 811890d5 (banc `indicateur-pro`, cas E–H : 7 rouges), puis corrigés :
- **E** — un compte Leboncoin/Vestiaire « ouvert » (session relevée < 12 h, `compteLbcOuvert`, sur
  N'IMPORTE QUEL ordinateur) s'écrivait « vendeur_lbc Leboncoin — ouvert ici · » (faux « ici », séparateur
  vide : l'écran retirait « ouvert ici » du texte par expression régulière). `ligneFraicheur` rend désormais
  `quand` et `bloque` tels qu'écrits ; « ouvert ici » n'est dit que d'un compte Vinted (onglet de CE navigateur).
- **F** — au téléphone (ou sans extension ici), le geste disait « ouvre vinted.fr … dans ce navigateur » :
  ouvrir Vinted sur l'iPhone ne relit rien. Il dit « sur l'ordinateur où est l'extension VRM ».
- **G** — liste des comptes Vinted illisible (`baseKO`) : aucune ligne Vinted, aucun « pas su ». L'en-tête
  reçoit `null` et le panneau dit « Vinted : pas pu lire ».
- **H** — `NAV` figé au chargement du module : un `window.KAGI` posé plus tard laissait « Chrome ». `NAV`
  est relu à chaque phrase (Proxy sur `motsNavigateur()`). Non mesuré sur un vrai Orion (quand il pose KAGI).
- **« Chrome » oubliés** (audit neuf `audit-chrome-en-dur.cjs`, rouge sur 811890d5) : Brouillons (2), Republier
  → Brouillons → en ligne (1), `FavorisVinted.jsx` (2), `favorisProgression.js` (1) ; et `DEMANDES_AUTO`
  (`src/favorisAuto.js`) que le SERVEUR envoie en notification : la branche y écrivait « Ce navigateur est
  connecté… », lu sur l'iPhone — désormais « le navigateur où est l'extension VRM », sans dépendre du
  navigateur où le module est chargé.
Bancs voisins : `brouillons-avancee`, `filtre-compte` verts ; `vinted-ui` (8), `relais-telephone` (3),
`favoris-ecran` (2, colonne 1360 px) : mêmes rouges sur 811890d5. Les audits qui régénèrent les zips ont été
suivis d'un `git checkout public/`.
Reste : `src/Accueil.jsx` (page publique, « Chrome » comme prérequis) ; les phrases d'erreur écrites par
l'EXTENSION (« …dans ce profil Chrome… ») qu'affiche l'app telles quelles — à la session Orion/extension ;
les étiquettes de diagnostic (`plantages.js`, `diag_photos`) disent « Safari » sur Orion.

<!-- Section déplacée telle quelle de la fin de CLAUDE.md lors de l'intégration `integration-lot1` (5 nov.). -->

### 5 nov. · Indicateur sobre, navigateur juste, comptes par ligne (`v31-indicateur-pro`, app seule)
Fait : point discret + nom du compte (ambre seulement si geste) ; `motsNavigateur()` (Orion/Brave, jamais « Chrome » en dur) ; panneau « Tes comptes — dernière relecture » (`src/fraicheurComptes.js`). Prouvé : banc `indicateur-pro` 19 rouges avant / 0 après, mutation 6 rouges. Non mesuré : un vrai Orion. Détail : `docs/passation/2026-11-05-indicateur-pro.md`.

### 5 nov. · Revue adverse de `v31-indicateur-pro`
Corrigé : « ouvert ici · » vide sur Leboncoin/Vestiaire ; geste « dans ce navigateur » au téléphone (⇒ l'ordinateur) ; comptes Vinted illisibles tus ; 7 « Chrome » oubliés (dont une notification serveur, `DEMANDES_AUTO` neutre) ; `NAV` relu à chaque phrase. Prouvé : banc `indicateur-pro` 7 rouges sur 811890d5 / 0 après, `audit-chrome-en-dur`. Non mesuré : vrai Orion ; textes d'erreur venus de l'extension.
