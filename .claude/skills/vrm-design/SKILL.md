---
name: vrm-design
description: La direction visuelle de VRM voulue par Julien (14 nov. 2026) — à charger AVANT de toucher à un écran, une feuille, un bouton ou une couleur de l'app. Règles « liste d'abord », 1 000 articles, Atelier, interdits vus sur ses captures, preuves attendues.
---

# VRM — direction visuelle (skill du projet)

Julien, sur son iPhone, le 14 nov. 2026 : « C'est moche », « rien n'a changé », « sortir des classiques »,
« imagine si j'ai 1000 articles », « pas beau du tout : les couleurs, les formes, les boutons »,
« toute l'application, change totalement, dramatique ».

**Ordre de priorité quand deux règles se contredisent : AJOUT 3 (liste d'abord) > AJOUT 2 (1 000 articles)
> direction Atelier > le reste.** Les règles de CLAUDE.md (§2, §3, §5, §7) restent au-dessus de tout.

Charger aussi : `impeccable`, `apple-design`, `taste-skill`, `emil-design-eng`, `animate`, `mobile-native`.


Julien, sur son iPhone, après trois passes « système » (jetons, graisses, gris, contrastes) :
« C'est moche. Continue à améliorer le design, rien n'a changé. »
Ses captures (non versionnées : données réelles) montraient Achats et Annonces.

Leçon : corriger des jetons ne se VOIT pas. Il faut changer la COMPOSITION des écrans :
hiérarchie, densité, ce qui est montré d'abord, ce qui est replié. Viser une app iOS
native signée Apple (Réglages, Santé, Wallet, Bourse) — pas une page web.

## Ce qui est moche sur ses captures (à ne plus jamais voir)
1. Murs de phrases grises (« 1 234 ventes sans achat relié : comptées dans aucune source (Ventes → … »),
   quatre paragraphes d'explication sous un chiffre. → Une ligne courte au plus ; le détail derrière un
   « ? » ou un repli « Comment c'est calculé ». (Règle §5 qui reste : un total partiel montre sa
   couverture À CÔTÉ du chiffre — « sur 1 000 » — en une ligne, jamais en paragraphe.)
2. Des chiffres noyés dans des phrases (« 12 345 € investi  50 % marge  100 jours pour revendre »).
   → Tuiles : gros chiffre (28–34/700, chiffres alignés) + libellé court 13/400 dessous. 2 ou 3 par rangée.
3. Une carte avec un énorme padding intérieur et un grand titre dedans. → Titre de section HORS de la
   carte (20/700 ou 22/700), carte = contenu seulement, padding 16.
4. Bouton « … » qui DÉBORDE de sa carte à droite. → rien ne sort d'une carte, jamais.
5. Pastille flottante « Mis à jour à 08:19 » posée en permanence SUR la liste. → Elle apparaît 2 s
   après une mise à jour puis disparaît (ou devient une ligne discrète en bas de page), jamais au-dessus
   du contenu en continu.
6. Barre du haut encombrée : petit titre + 5 ronds (compte, œil, cloche 99+ bleue, loupe, logo).
   → Grand titre iOS (34/700) dans la page ; en haut, 2–3 icônes maximum, nettes ; la pastille de la
   cloche n'est pas bleue (l'accent est rare) : encre ou ambre si geste, plafonnée « 9+ ».
7. Couleur d'accent bleue sur un montant (« au plus +40 € »). → Les montants sont à l'encre ; le bleu
   est réservé aux actions (liens, bouton principal).
8. Listes : en-tête de groupe « Autres comptes · 9 comptes · 1 234 achats » en gris long. → En-tête
   court en petites capitales iOS (13/400, gris, MAJUSCULES non — style « Réglages » : 13 px gris au-dessus
   du groupe), rangées 52–56 px, nom 17/400, valeur à droite 17/400 gris, chevron.

## Direction
- Liste groupée inset iOS (fond gris très clair #F2F2F7 / nuit #000, cartes blanches / #1C1C1E, rayon 12–16,
  séparateurs fins indentés).
- Hiérarchie : 1 chose principale par écran en haut (le chiffre ou la liste qui sert), le reste dessous.
- Densité : moins de texte, plus d'air ENTRE les blocs (24–32), moins DANS les blocs.
- Une seule couleur d'accent, rare. Ambre = geste à faire. Rouge = doublon de N° seulement. Pas de violet.
- Utilise les jetons existants (`src/styles-systeme.css`, `docs/design/DESIGN.md`) ; si un jeton manque,
  ajoute-le au système plutôt qu'une valeur en dur.
- Charge et applique les skills `apple-design` puis `impeccable` (outil Skill) avant de dessiner.

## Ce qui ne change pas
Aucune règle métier, aucun chiffre calculé différemment, aucune donnée supprimée : on déplace, on
replie, on hiérarchise. Les explications restent accessibles (repli / « ? »), jamais supprimées si une
règle §5 les exige. Tout texte nouveau par `tr()` (5 langues). Pas `vinted-sync-extension/`.

## Preuve attendue
Captures AVANT (origin/main) et APRÈS, 390 tactile (iPhone, deviceScaleFactor 2 pour celles qu'on
montrera à Julien) et 1512, clair et sombre, sur une base INVENTÉE réaliste (beaucoup de comptes,
gros chiffres, comptes à longs noms). Range les paires avant/après les plus parlantes dans
`docs/design/avant-apres/<ecran>-{avant,apres}.png` (PNG optimisés, < 300 Ko chacun, aucune donnée réelle).
Un banc qui mesure la règle (ex. : aucun paragraphe > 1 ligne visible sous un chiffre sans repli ;
rien ne déborde de sa carte ; pas de pastille flottante au-dessus du contenu après 3 s ; accent
absent des montants) — rouge avant, vert après. `design-passe.cjs` et `design-passe-2.cjs` restent verts.

## ⚠️ AJOUT (Julien, 14 nov., juste après) — « sortir des classiques »
« Je veux que tout soit plus beau, l'application n'est pas incroyable, le design fait basique,
il faut vraiment qu'on sorte des classiques. »
⇒ Une liste iOS propre NE SUFFIT PAS. On vise une app qu'on montre : premium, qui a une identité.
Direction artistique commune « ATELIER » (les trois chantiers la suivent, pour rester cohérents) :
1. **La paire est la matière.** Les photos des paires sont le visuel principal : vignettes grandes,
   rayon généreux (14–20), piles de photos décalées (le composant de pile existe déjà), une photo en
   couleur sur les cartes héros. Une rangée sans photo a une pastille d'icône teintée douce.
2. **Typographie d'affiche.** Le chiffre d'un écran est ÉNORME (48–64/700, `letter-spacing:-0.03em`,
   chiffres tabulaires), le libellé petit (13/600, gris) : fort contraste d'échelle. Titres 34/700 serrés.
3. **Profondeur, pas de traits.** Cartes sans bordure ; ombre diffuse douce (ex. `0 1px 2px rgb(0 0 0/.04),
   0 8px 24px rgb(0 0 0/.06)` ; la nuit : surface plus claire que le fond, pas d'ombre). Fond très
   légèrement chaud/teinté, pas gris plat. Barres du haut et du bas en matériau translucide
   (`backdrop-filter: saturate(180%) blur(20px)`) comme iOS.
4. **Une carte héros par écran** (comme la carte sombre de Ma journée, ou une carte Wallet) : fond encre
   profond avec un léger dégradé vers bleu nuit, LE chiffre de l'écran en très grand, une mini-courbe
   (sparkline SVG, sans librairie) quand une série existe déjà dans les données de l'écran, une photo de
   paire. Le reste de l'écran est calme en dessous.
5. **Mouvement.** Apparition des listes en ressort court (décalage 20–30 ms par rangée, 220–320 ms),
   chiffres qui défilent quand ils changent, appui = `scale(.97)` ; `prefers-reduced-motion` respecté ;
   rien qui ralentit un geste.
6. **Détails qui font « cher ».** Séparateurs indentés fins, pastilles d'icônes teintées à 12 %, coins
   continus, chevrons fins, états vides illustrés (une silhouette de basket en trait, pas un texte gris).
Inchangé : un seul accent bleu, rare (actions) ; ambre = geste ; rouge = doublon de N° seulement ; violet
interdit ; montants à l'encre ; mode sombre soigné autant que le clair.
Skills à charger (outil Skill) : `taste-skill`, `emil-design-eng`, `apple-design`, `impeccable`, `animate`.
Les jetons communs de la direction (ombres, dégradé héros, rayons, échelle d'affiche, durées de ressort)
vont dans `src/styles-systeme.css` section « §4 Atelier » : c'est l'agent COQUE qui la crée et la pousse
EN PREMIER sur `claude/refonte-coque` (commit court, dans l'heure) ; les deux autres la récupèrent par
`git fetch origin claude/refonte-coque` + `git checkout origin/claude/refonte-coque -- src/styles-systeme.css`
seulement si leur fichier n'a pas divergé, sinon ils recopient la section §4 telle quelle.

## ⚠️ AJOUT 2 (Julien, 14 nov.) — « Il faut que ça soit pratique, imagine si j'ai 1000 articles »
Le beau ne doit JAMAIS coûter l'usage à 1 000 paires.
Règles qui passent AVANT la direction Atelier quand elles se contredisent :
1. **Densité de travail.** Dans une liste, une rangée = 64–72 px avec vignette 48–56 px (pas des grandes
   cartes photo par article). La « photo grande » est pour la carte héros, la fiche et les piles — pas pour
   chaque rangée d'une liste longue. On voit au moins 8–9 articles par écran d'iPhone.
2. **Trouver vite.** Recherche + filtres + tri collés en haut de la liste (sticky), toujours atteignables
   d'un pouce ; le N° tapé trouve la paire ; en-têtes de groupe collants (par jour, par compte, par état)
   avec leur compte ; « Tout sélectionner » / actions en série gardées.
3. **La carte héros se replie.** Elle tient au plus ~40 % du premier écran et se compacte au défilement
   (en une ligne de chiffres) pour laisser la place à la liste.
4. **Vitesse.** Rendu fenêtré/virtualisé ou `content-visibility:auto` + `contain-intrinsic-size` sur les
   rangées (vérifie ce qui existe déjà avant d'ajouter quoi que ce soit) ; images `loading="lazy"` +
   `decoding="async"` + taille fixée (aucun saut) ; les animations d'apparition seulement sur les ~12
   premières rangées, jamais 1 000 rangées décalées ; aucun `backdrop-filter` sur une rangée de liste
   (seulement sur les barres) ; aucune ombre lourde répétée 1 000 fois (ombres sur les cartes, pas les rangées).
5. **Preuve à 1 000.** Le banc de chaque chantier sert une base inventée de 1 000 annonces / 1 000 ventes /
   1 000 achats et mesure : premier rendu de la liste (temps), défilement jusqu'en bas sans trou ni saut de
   mise en page (CLS ≈ 0), nombre de nœuds DOM de la liste, nombre d'articles visibles sur un écran 390 (≥ 8),
   recherche par N° qui trouve en < 300 ms. Rouge si le chantier fait pire que origin/main sur l'un d'eux.

## ⚠️⚠️ AJOUT 3 (Julien, 14 nov. 09:01) 
« Regarde, c'est pas beau du tout : les couleurs, les formes, les boutons, j'aime pas du tout. »
Ce qu'on voit sur Annonces (iPhone) et qui est INTERDIT désormais, sur TOUS les écrans :
1. **La liste arrive après 1,5 écran.** Avant la 1re annonce : « 10 choses à revoir », grand titre +
   phrase, sélecteur de plateformes, rangée de comptes, carte sombre « 2 en ligne », carte « Qui dorment — »,
   deux tuiles, rangée de 4 ronds + « 4 brouillons », rangée de filtres, « 18 retirées », carte « Bénéfice — »,
   « 2 nouveaux N° »… ⇒ RÈGLE : sur un écran de liste (Annonces, Ventes, Achats, Stock), la 1re ligne de la
   liste est visible sur le PREMIER écran d'iPhone (390×844), au plus à 50 % de la hauteur. Tout le reste se
   range dans UNE ligne compacte ou derrière un bouton.
2. **Carte sombre géante pour un seul chiffre** (« 2 en ligne ») : c'est exactement ce qu'il n'aime pas.
   ⇒ La carte héros sombre RESTE seulement sur Ma journée. Ailleurs : une bande de chiffres compacte
   (≤ 72 px, 2–4 chiffres côte à côte, 22–28/700, libellé 12–13), fond de la page, pas de carte.
   Ceci REMPLACE le point 4 de la direction Atelier pour les écrans de liste.
3. **Cartes vides** (« Qui dorment — pas par compte ») : une carte sans valeur n'est PAS montrée (ou une
   ligne grise d'une phrase dans la bande). Jamais une carte de 150 px pour « — ».
4. **Tout est capsule grise** (comptes, filtres, outils, alertes) en 52 px, texte 17 : lourd et monotone.
   ⇒ Hiérarchie de boutons : 1 bouton principal plein (accent) par écran au plus ; secondaires = texte
   accent ou teinte très légère ; filtres = petites capsules 32–36 px (texte 15/600), la sélection en
   encre pleine OU soulignée, pas 6 gris identiques. Le choix du compte = UN menu compact « compte_1 ▾ »
   (ou « Tous les comptes ▾ »), pas une rangée de pilules géantes. Outils (recherche, filtre, actualiser,
   …) = UNE barre : un vrai champ de recherche + 1–2 icônes, 36 px.
5. **Alertes éparpillées** (« 10 choses à revoir » en tête de page, « 4 brouillons à refaire » avec rond
   orange-brun, « 18 retirées de Vinted », « Bénéfice — : prix d'achat 0/19 connus. Compléter », « 2 nouveaux
   N° ») ⇒ UNE ligne « À faire · 5 › » (point ambre) qui ouvre une feuille listant chaque chose avec son geste.
   Rien de perdu, tout regroupé. Le « 10 choses à revoir » de la coque n'est jamais AU-DESSUS du titre.
6. **Couleurs** : trop de gris de remplissage, orange + brun + bleu + noir mélangés. ⇒ Fond de page clair
   uni, surfaces blanches, UNE teinte d'accent (bleu) pour les actions, ambre seulement en point/texte
   pour « à faire », jamais en rond plein brun. Nuit : même logique.
7. **« Nouvelle version de VRM · Mettre à jour »** posé au-dessus de la barre du bas, sur la liste
   ⇒ à la coque : la mise à jour s'applique toute seule à la prochaine ouverture, ou une ligne fine sous la
   barre du haut, jamais un bandeau flottant qui couvre la liste.
8. **Titre** : « Annonces » 34/700 + une phrase d'explication de 2 lignes + « ? » ⇒ la phrase disparaît
   (le « ? » suffit, à côté du titre).
Preuve ajoutée au banc de chaque écran de liste : position de la 1re ligne ≤ 50 % de 844 px à 390 ; aucune
carte dont la valeur principale est « — » ; ≤ 1 bouton plein accent visible ; aucune rangée de > 3 capsules
grises ≥ 44 px de haut sans défilement ; aucun bandeau flottant au-dessus de la barre du bas après 3 s.
