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

