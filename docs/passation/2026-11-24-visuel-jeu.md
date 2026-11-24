# 24 nov. 2026 — Le visuel « jeu vidéo » (`claude/visuel-jeu`)

## La demande

Julien, ce matin, devant Aujourd'hui sur son iPhone : « c'est pas visuel, hésite pas à faire des designs comme jeu vidéo ».
L'écran montrait la carte « Vinted a agi 5 fois » : des murs de texte gris, la même phrase sur chaque rangée, des pilules beiges.

Il a ajouté « sur les pop-up » : les pop-ups passent d'abord. Après la première galerie, il a dit : « c'est déjà beaucoup mieux, beaucoup plus visuel… je veux vraiment que TOUTE l'application soit visuelle ».

Ce qui tient toujours (passation du 23 nov., §3) :
- gris clair, accent ardoise, **ni orange ni ambre** ;
- le rouge seulement pour deux paires sous un même N° ;
- peu de mots, des boutons « icône + verbe ».

« Jeu vidéo » veut dire visuel et vivant, pas des couleurs criardes.

## Ce qui est fait

### 1. Les pop-ups (`src/natif/PopEvenements.jsx`, `pop-evenements.css`)

Ce sont les cartes d'événement de l'app ouverte (vente, offre, favori, colis arrivé, code de retrait, modération, rappel). Elles reprennent les codes d'une notification de jeu :

- **La paire en grand.** Tuile de 64 px sur iPhone, 80 px sur ordinateur.
  - La photo est toujours la même que la veille : celle de la notification (prouvée par l'e-mail), sinon `photoEvenement` dans App.jsx (n° de transaction ou de conversation de l'adresse). Jamais par le titre.
  - **L'étiquette du N°** est un petit papier à œillet, dans le coin bas-gauche (environ un tiers de la tuile, à la demande du coordinateur). Le N° vient soit du champ `numero` posé par l'émetteur, soit du « N°124 » que le serveur a ÉCRIT dans son texte (il le tire de ses propres règles d'identité). Rien n'est deviné. Le numéro est retiré du texte : il ne s'écrit pas deux fois.
  - **Le médaillon** de la sorte d'événement est en haut à droite : cœur pour un favori, œil pour la modération, étoile pour un avis, etc.
  - Sans photo, la tuile devient un médaillon teinté par famille : vert pour une vente, sarcelle pour un colis, encre pour la modération, acier pour un rappel ou un avis, ardoise pour le reste.
- **Mouvement.**
  - La carte arrive sur un ressort (`linear()` calculé : raideur 300, amortissement 22, 7 % de dépassement). La tuile rebondit, l'étiquette se pose, le médaillon sort.
  - Elle part dans le sens du geste : on la balaie de côté (au-delà de 80 px ou à plus de 0,5 px/ms) ou vers le haut. Vers le bas, elle résiste comme un élastique. Un tirage n'est jamais un clic.
  - Le compteur « +2 » de la pile rebondit quand une carte arrive. Les cartes repliées derrière sont d'un gris un cran plus soutenu, jamais un blanc vide.
- **La vente est un moment** : 18 confettis (ardoise, vert, argent, blanc) pendant 1 s, un reflet qui traverse la carte, le médaillon vert qui saute deux fois. Rien de tout cela ne bloque : `pointer-events: none`, et la carte reste lisible dès la première image.
  - La double vente est une ALERTE : jamais de fête pour elle.
- **Mouvement réduit** : un fondu, aucune pluie, aucun rebond.
- Le sous-titre tient sur deux lignes au téléphone (retouche du coordinateur). La carte reste en haut, sous l'encoche : elle ne couvre jamais la barre du bas.
- **La galerie « Voir tous les pop-ups »** (propriétaire seulement) montre chaque carte comme elle sera. Elle utilise les photos d'EXEMPLE de l'app (`public/exemple/`, crédits dans `CREDITS.md`) et un N° d'exemple, posés exemple par exemple dans `src/galeriePops.js` (`PHOTO_EXEMPLE`), jamais tirés du titre. En dehors de la galerie, seule une photo Vinted prouvée passe ; la regex `RE_PHOTO_EXEMPLE` ne vaut que pour `galerie: true`.

### 2 bis. L'apparition, sans latence

Julien : « pas d'un coup en bloc », puis « fais quelque chose sans latence ».

- `revele`, `Revele`, `useArrive`, `SqueletteTuile`, `SqueletteInventaire`, décrits dans `src/natif/visuel/README.md`.
- Ce qui est connu s'affiche d'un coup.
- Seul ce qui ARRIVE s'anime : 15 ms d'écart, 120 ms au plus, 160 ms de fondu, le premier élément jamais.
- Une image en cache n'a aucun fondu : c'est vérifié avant la première peinture.
- Les deux autres lots (`claude/visuel-annonces`, `claude/visuel-argent`) utilisent les mêmes pièces.

### 2. Les pièces réutilisables (`src/natif/Jeu.jsx`, `jeu.css`, mode d'emploi `src/natif/visuel/README.md`)

`TuilePaire`, `EtiquetteN`, `Confettis`, `Anneau`, `CarteQuete`, `QuetesFaites`, `Trophee`, `EtagereTrophees`. Elles sont exportées par `src/natif/index.js`.

Les règles que ces pièces portent elles-mêmes :
- `Anneau` avec une valeur ou un total inconnu se dessine en pointillé avec « — ». Il n'est jamais vide ni plein.
- `CarteQuete` sans `restant` affiche « — ».
- `EtagereTrophees` sans total LU ne rend rien.
- `TuilePaire` sans N° ne dessine pas d'étiquette.

### 3. Aujourd'hui

- **« Vinted a agi »** (base #1346) : les disparues d'un compte forment une GRILLE de tuiles. Chaque tuile porte la photo de SA fiche (identifiant d'annonce) et son étiquette N°. Sans fiche, le médaillon et l'identifiant. « ✓ Vu » est sous chaque tuile, et « Pourquoi ? » et le bouton unique restent.
  - Les repères du banc `moderation-carte` sont gardés : `data-moderation-*`, cinq visibles puis « Voir les N autres ».
- **Colis** : la case « À envoyer » porte l'ANNEAU des bordereaux prêts, avec les mêmes nombres que sa phrase (« 24 pas encore prêts »). Pour cela, `affiche.prets` est ajouté dans Comptabilite.jsx, à partir de `nPrets` / `em.exact`, déjà calculés pour la phrase.
  - Pas lu ⇒ anneau en pointillé.
  - Rien à envoyer ⇒ pas d'anneau.
  - Tout est prêt et le compte est exact ⇒ anneau vert.
- **Ventes « En route »** : sous la phrase de l'étape, le TRAJET dessiné (`Trajet`). Ce sont les MÊMES étapes prouvées (`etapesRoute`), le camion est posé sur la dernière, et le vert n'apparaît qu'à « validée ». Sans étape prouvée, la piste est en pointillé, sans camion.
- **Dernières ventes** : une rangée d'inventaire, avec la tuile de 104 px (photo trouvée par la source, par SA transaction), l'étiquette N°, le logo du site, le prix et « il y a ». Elle défile de côté au téléphone et devient une grille sur ordinateur. `tx` est ajouté à chaque ligne (affichage seulement).
- **« À faire »** : non remis sur cet écran. La décision d'avant tient : ses groupes sont publiés pour leurs onglets.

## Les preuves

`scripts/bancs/visuel-jeu.cjs` tourne sur l'app rendue (`dist/`), avec la base de `design-passe.cjs`, à 390 et 1512 px, en clair et en sombre.

| repère | ce qui est jugé |
|---|---|
| J1 | Un LEURRE est ajouté : une vente au même titre, une autre transaction, une autre photo. La carte de la vraie vente montre la photo de SA transaction, jamais celle du leurre. Une transaction inconnue au même titre ⇒ aucune photo (`data-n-pop-photo="0"`). |
| J2 | L'étiquette dit 124, et le texte ne redit plus « N°124 ». |
| J3 | Aucune couleur orange calculée (teinte 15–50°, saturation ≥ 30 %, luminosité 20–85 %) dans les pop-ups, confettis en vol compris, ni dans les pièces `data-n-jeu`. |
| J4 | Ressort (`n-pop-entre`) et pluie sur la vente. Avec `reducedMotion: 'reduce'` : `n-pop-fondu`, la tuile à `animation: none`, aucun confetti. |
| J5 | La pile dit « +2 ». Un balayage à gauche (pointeur tactile à 390, souris à 1512) ferme la carte vers la gauche (`data-n-pop-sort="gauche"`). |
| J6 | La carte ne couvre pas la barre du bas. Rien ne déborde, aucune erreur JS. |
| J7 | Le vrai `Trajet` : sans étape prouvée, pas de camion ; avec deux étapes, le camion est au tiers. Le vrai composant `Anneau`, rendu côté serveur : valeur inconnue, total inconnu, les deux, ou total 0 ⇒ `data-n-anneau-su="0"`, « — », aucun arc plein. 6 sur 30 ⇒ 0,200. |
| J9 | « Sans latence » : la 1re tuile n'attend pas ; les suivantes ont 15 ms d'écart, 120 ms au plus, et un fondu ≤ 200 ms. Avec mouvement réduit, il n'y a aucune apparition. |
| J10 | Le temps du toucher (barre d'onglets) au premier contenu, sur swiftshader, machine partagée ; le seuil du banc est 1,5 s. Au retour, les ventes déjà montrées n'ont aucun fondu. |
| J8 | L'anneau des colis porte les nombres de la case. Chaque tuile des dernières ventes montre la photo de SA vente (`data-n-vente-tx`) : le leurre au même titre ne prête pas la sienne, ni l'inverse. |

Résultats :
- **Base et mutation** : voir la section suivante.
- Les bancs voisins `galerie-pops` (24 exemples, rien d'écrit en base, aucune erreur) et `moderation-carte` tournent après le build.

**Captures et film** (390 px, clair), dans le scratchpad de la session : `visuel-jeu/banc/*.png`, `visuel-jeu/galerie/*.png`, `visuel-jeu/pop-vente-390-clair.webm`.

## Rouge sur la base et mutation (joués)

### La base

Le banc a été copié dans `git archive origin/claude/style-clair` et lancé sur le build de ce même commit (`1ae499652`, `BANC_DIST`), à 390 px en clair : **13 rouges**.

| repère | ce qui manque sur la base |
|---|---|
| J1 | ni photo dans la carte ni règle de leurre ; une transaction inconnue n'a pas de tuile |
| J2 | pas d'étiquette, et « N°124 » reste dans le texte |
| J4 | pas de ressort ni de pluie ; en mouvement réduit, la tuile n'existe pas |
| J5 | le balayage de côté ne ferme rien (3 → 3) |
| J6 | la carte n'est pas trouvée |
| J7 | `Jeu.jsx` absent |
| J8 | ni anneau ni tuiles |
| J9 | aucune apparition |

Restent verts sur la base, et c'est normal : « +2 » (déjà là), aucun orange, rien ne déborde, aucune erreur.

### Les mutations

Jouées sur une copie de `dist/` :
- **Retirer le fondu du mouvement réduit** (la carte garde son ressort) ⇒ J4 réduit rouge (`n-pop-entre`).
- **Un orange `#E8892A` dans le papier de l'étiquette** ⇒ J3 rouge (pile et Aujourd'hui), avec la couleur nommée.

### Ce que le banc a trouvé en route

J10 a été rouge sur un vrai défaut. Au retour sur Aujourd'hui, les ventes refaisaient leur fondu : leurs données repassent un instant par « en lecture » à chaque montage.

Correction : `useArrive(pret, cle)` retient les blocs déjà montrés pendant la session. Ils reviennent d'un coup.

## Ce qui reste

À faire par moi :
- Ventes / Achats en tuiles, et À retirer en carte de trajet.

Lancé par le coordinateur, deux autres agents sur ces pièces :
- Annonces + Stock ;
- Argent + Messages + Paramètres.

Pas encore fait :
- La série de jours « tous les colis partis ».
- Les trophées branchés sur un total de ventes LU.
- La jauge d'objectif du mois.
- Les transporteurs en logos pleins.

Les pièces existent (`EtagereTrophees`, `Anneau`) ; il manque une source honnête pour chacun.

**Geste de Julien** : ouvrir Paramètres → « Voir tous les pop-ups » sur l'iPhone et regarder.
