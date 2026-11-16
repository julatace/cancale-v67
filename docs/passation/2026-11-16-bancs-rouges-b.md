# 16 nov. 2026 — Bancs rouges (lot b) : impression, e2e-extension, accompagnement, accessibilité, volume

Branche `claude/bancs-rouges-b` (depuis `origin/main` b8f26f36). Missions (7), (8), (54), (55), (56) du brief du 16 nov.
Les bancs des lots voisins (parcours-critiques ; enligne, vestiaire, sante-donnees, stock) ne sont pas touchés.
Machine très chargée tout du long (charge 40 → 108 sur 4 cœurs, disque plein un moment) : « Page crashed »,
« Target crashed » et écrans restés sur le démarrage ont été relancés avant toute conclusion ; les temps ne sont
jamais jugés en absolu.

## ÉTAT À LA REPRISE

- Tout est poussé sur `claude/bancs-rouges-b`. PR : voir la fin du récit (état de la CI et de la fusion).
- **Règle de Julien du 16 nov. : zéro rouge pour fusionner**, y compris les rouges déjà sur `main` des jobs touchés.
  Les jobs que ce lot touche (Audits, Bancs principaux, WebKit, App + vraie extension) portent des rouges d'autres
  chantiers (journee-coherence, colis-retirer-propre, retraits-suivi, iphone-reprise B « Plus »…) : voir « Ce qui reste ».
- Bancs neufs : `scripts/bancs/accessibilite-feuilles.cjs`, `scripts/bancs/volume-lbc-vestiaire.cjs`.

## Le tableau (cause d'abord)

| contrôle | cause | défaut app / contrôle périmé | ce qui a changé | preuve |
|---|---|---|---|---|
| `colis-a-leur-place` V | `waitForSelector('[data-colis-section="ventes"] ~ *, [data-bord-card]')` : une LISTE de sélecteurs fait attendre le PREMIER élément trouvé — un frère caché de la section (hauteur 0) | contrôle périmé (attente) | on attend `[data-bord-card]` | V vert |
| `colis-a-leur-place` V « intertitre » | la tête de Ventes n'a plus de `<h2>` (maquette du 15 nov. : segment + grand chiffre) | contrôle périmé | le mot « À envoyer » jugé sur la tête entière, « à expédier » interdit | vert |
| `colis-a-leur-place` V « Je dépose » | « Je dépose » vit derrière « … » puis « À faire · N » (refonte de Ventes, 15 nov.) | contrôle périmé | présent UNE fois dans la page ; I l'ouvre par « … » / « À faire » | vert |
| `colis-a-leur-place` T (titres) | `ventes-verre.css` : `white-space: nowrap; text-overflow: ellipsis` sur le titre d'un colis — « Nike Air Max 95 Icons Yel… », contre la demande de Julien du 11 nov. (« le titre doit se lire en entier ») ; la maquette n'avait que des titres courts | **défaut app** | le titre passe à la ligne (`white-space: normal`, `overflow-wrap: break-word`) | T rouge avant (coupe: true ×2), vert après ; capture 390 regardée (3 lignes) |
| `colis-a-leur-place` N (390) | Achats est dans l'onglet « Annonces » (Annonces · Stock · Achats, choix n° 61 du 14 nov.) | contrôle périmé | au téléphone : toucher l'onglet, l'entrée doit y être | vert |
| `colis-a-leur-place` I | l'ancien « Tout imprimer » en trois temps (aperçu A4, « C'est imprimé ? ») n'existe plus (impression-simple, 14 nov.) | contrôle périmé | I rejoue le parcours d'aujourd'hui : un plein « Imprimer (2) », la question du papier la première fois, UN PDF, noté imprimé à l'ouverture (7201, 7202 seulement), « Tout est sorti ? » (2 vignettes, la déposée ni dedans ni dite absente), « Choisir » (2 lignes, décochées car imprimées, titre entier, 44 px), « Je dépose » ⇒ mode dépôt | 4 vues : vert. Après la visionneuse, `page.waitForTimeout` sous horloge installée faisait planter l'onglet (4/4) : attente côté Node |
| `lot-bordereaux` (règle du 5 oct. : jamais un lot partiel présenté complet) | aperçu A4, feuille du tampon d'office, message « N sur M » retirés le 14 nov. | contrôle périmé | la RÈGLE jugée sur ce qui la porte aujourd'hui : `data-impr-n` = 1 (une vignette), les deux absents NOMMÉS avec leur raison (`sansPdf` « Paire C », `illisible`), seul 9001 noté imprimé, 9002/9003 restent cochés (relance = 2) | 16/16 |
| `ventes-colis-premium` | `data-lot-ouvrir` = « Choisir » (sans nombre) ; le plein est `data-colis-barre-btn="imprimer"` | contrôle périmé | `data-impr-lot` du plein | vert |
| `popups-propre` P4 | idem | contrôle périmé | un seul plein qui imprime | vert |
| `annuler-commandes` K2 | `POST /api/compte?mode=mesures` : le lot de mesures anonymes (src/mesuresCollecte.js, une fois par minute, quel que soit l'écran) compté comme « envoi du geste » | contrôle périmé | cette route EXACTE écartée, tout autre POST /api compté | 79/79 |
| `retours-litiges` « Paire revenue » 1512 | 44 px exigés à la souris (36 px mesurés) ; §7 : 44 px AU DOIGT | contrôle périmé | 44 au doigt, ≥ 32 à la souris (comme « Imprimer le bordereau » du même banc) | vert |
| **`e2e-extension` « l'app dit le plafond », « un 429 pose la pause »** (L2 vide) | après la 1re baisse, la feuille « VRM travaille » finie reste ouverte jusqu'à SON « Fermer » (11 nov., Julien : VRM reste figé ; Échap n'y fait rien exprès) et elle est RELUE au rechargement ; le banc fermait par Échap ⇒ la baisse suivante n'ouvrait jamais sa feuille | contrôle périmé (pas un défaut : décision du 11 nov.) | `fermerFeuille` touche `[data-suivi-fermer]` | 42/42 (tous les scénarios) ; mutations `plafond` (4 rouges) et `pause-429` (2 rouges) rougissent |
| `popups-propre` P1 Achats | « au moins 0 € » Dépensé et « 0 en route / 0 arrivés » alors que les achats ne sont PAS lus (« Pas lu : tes achats Vinted ») — §5 : « Au moins 0 € ne se dit jamais », « rien lu ≠ rien » | **défaut app** | somme partielle nulle ⇒ « — » ; comptes pas relus sans aucun achat lu ⇒ En route / Arrivés « — » (`data-n` vide) | avant : « au moins0 € … 0 0 » ; après : « — … pas su, pas lu » |
| `popups-propre` P1 Argent → Stats | « Vendu : à la date… · Reçu : au jour… · le reçu se calcule… » (133 caractères) | **défaut app** (textes courts) | le manque reste dit ; la définition Vendu/Reçu sous « Pourquoi ? » | vert |
| `popups-propre` P1 Argent → Déclarer | « Une page A4… Enregistrer en PDF… » (112 car.) | **défaut app** (textes courts) | sous « Enregistrer en PDF ? » (`compta.recapImprimerAide`, 5 langues) | — (le scénario a planté sous la charge : à relancer) |
| `popups-propre` P1 Annonces | la rangée de 72 px (titre, N°, prix, taille côte à côte, plus le texte `.vrm-sr` pour lecteur d'écran) prise pour un paragraphe | contrôle périmé | une rangée `data-fiche-ligne` et une bande de chiffres (`data-carte-chiffre`) ne sont pas des paragraphes ; le texte `.vrm-sr` n'est pas compté | vert |
| `popups-propre` P2/P3 Annonces | fraîcheur dans « À faire · N » (14 nov.) ; « Même article / paire » selon le profil (15 nov.) | contrôle périmé | ouvrir « À faire » ; les deux mots acceptés | à relancer (scénario coupé par la charge) |
| `audit-textes-courts` T1 (rouge sur `main`) | eBay : « Offre ≥ ce montant : eBay l'accepte seul… En dessous, elle t'arrive. » (94) | **défaut app** (textes courts) | même sens (« l'article est vendu » gardé, §3) en 78 caractères | 49/49 |
| `iphone-reprise` R (WebKit) | `clock.setSystemTime` sur une page NEUVE (about:blank) : l'horloge du contexte n'y est pas encore sous WebKit | contrôle (banc) | en cas d'échec, ouvrir un petit document de la même origine puis avancer l'heure | à vérifier en CI (WebKit absent du conteneur) |

## Bancs neufs

### `accessibilite-feuilles.cjs` (mission 55)
axe (WCAG A/AA + aria-allowed-role, aria-dialog-name) DANS : l'atelier Republier, « Publier ailleurs » (Leboncoin), une
catégorie de Paramètres et le sous-écran d'un réglage, le centre d'aide ; 390 tactile et 1512, clair et sombre ;
44 px DANS la feuille. Et F : fermer rend la main là où elle était (fiche d'une annonce depuis la liste défilée ;
catégorie de Paramètres et « ‹ Paramètres »).

Défauts trouvés ET corrigés :
- **F1 : la fiche fermée laissait le focus sur `<body>`** (WCAG 2.4.3 : clavier et VoiceOver repartaient du haut). La
  rangée touchée est une `<div>` ; `HoteFicheLigne` retient la rangée et lui rend le focus à la fermeture (`tabindex=-1`,
  `preventScroll`), sauf si un focus a déjà été rendu ailleurs. Rouge avant (focus `<body>`, défilement décalé de 8 px),
  vert après (1512).
- **Centre d'aide : le bouton vidéo s'appelait « Regarder la vidéo : Ma journée, 0:15 » alors qu'il affiche « Regarder :
  Ma journée »** (WCAG 2.5.3, axe `label-content-name-mismatch`) : son nom est son texte visible.
- **Annonces → Republier : texte sombre posé sur le fond bleu** (axe 1,2 à 1,8:1) : la consigne (« Coche des annonces,
  puis choisis À la main ou Par VRM »), « Glisse… », la tête d'un compte (« compte_banc · 4 annonces · Tout cocher »),
  « Stock et ajustements », « Publier aussi ailleurs » ⇒ ajoutés à l'encre claire du §6 de `studio-verre.css`.
- « Publier aussi ailleurs » : nom accessible complété des nombres visibles (« Leboncoin 3/4 »).

### `volume-lbc-vestiaire.cjs` (mission 56)
1 000 annonces Leboncoin et 1 000 Vestiaire INVENTÉES, 390 et 1512 : V1 les 1 000 comptées (rendues ou total dit ;
`data-vc-annonces-n`), V2 temps RELATIFS à une référence de 10 annonces mesurée juste avant (×3 ou +8 s : la machine est
partagée) et nœuds du DOM ≤ 60 000, V3 la recherche trouve L'annonce unique, V4 aucune lecture `select=data` entière
d'une liste de 1 000 et la projection `items` lue ≤ 4 fois, V5 rien ne déborde, aucune erreur. Mesures imprimées
(« MESURE … ») : voir le résultat final plus bas.

### `accompagnement.cjs` (mission 54)
Ajoutés : **connexion par QR** (avant, après, échec 410 — le monde entier se sert sans forme inconnue),
**Publier partout** (avant ; pendant/après/échec dits « non joués » : chaque site répond par l'extension avec sa forme
réelle), **Republier** (avant). Non joués (dits, pas inventés) : offres Vinted/Vestiaire, favoris, LBC, facture Pro,
fusion — leur monde demande des conversations / commandes à la forme réelle.

## Ce qui reste (et pourquoi)

- WebKit (`nouveau-vendeur`, `ventes-e2`) : non installable dans ce conteneur ; lu dans la CI de `main` : les requêtes
  « due to access control checks » sont des routes que le banc ne sert pas avec le bon CORS sous WebKit
  (`like.harvest_%25_releve_%25`, `api/relais?mode=etiquettes`) et des cibles < 44 px de l'app (plaque N°, « 30 j / 90 j »,
  « 2 prix à saisir ») — la plaque N° est « à trancher » par Julien (15 nov.). `ventes-e2` V7 (N° blancs en sombre) et G.
- `iphone-reprise` B : juge encore le panneau « Plus » de la barre, retiré le 14 nov. (choix n° 61) — à porter sur le
  menu ☰ (`MenuEcrans`).
- `accessibilite-feuilles` F1 au téléphone : le toucher de la rangée n'ouvrait pas la fiche dans le banc (à ordinateur :
  vert) — cause pas trouvée sous la charge.
- Rouges d'autres chantiers sur les jobs touchés (journee-coherence E6/E8, colis-retirer-propre, retraits-suivi R5/R7/R8,
  tout-imprimer « N° lus ») : pas de ce lot.

Geste de Julien : aucun.
