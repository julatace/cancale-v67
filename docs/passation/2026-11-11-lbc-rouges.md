# 11 nov. — Leboncoin : les 6 bancs rouges remis au vert (lot `lbc-rouges`)

Branche `claude/lbc-rouges`, partie de `origin/claude/lbc-plus` @ 2a94bf016, puis
fusion (vraie) de `origin/claude/vert-11nov` (bancs en `fr-FR`). Pas de PR, pas de
fusion sur `main`.

Demande de Julien : Leboncoin « irréprochable ». Six bancs étaient rouges, à
l'identique sur `main` (f04d4a580) : lbc-pause 11, lbc-publier-app 8, lbc-relier 8,
lbc-flou-compte 3, lbc-messages 2, lbc-comme-vinted 2.

## Ce qu'il fallait trancher pour chaque rouge

Aucun des rouges n'était un défaut de Leboncoin dans l'app : l'écran s'ouvre, la
publication depuis l'app marche, la liaison est juste, la pause est bien dite.
Chaque rouge venait d'un banc qui servait une autre forme que la vraie base, ou qui
jugeait un ancien libellé, un instant d'animation ou une règle remplacée depuis.
Chaque banc a été porté sur la RÈGLE (`data-*`, nombres rendus, fin de lecture ou
d'animation). Aucun n'a été affaibli. Une seule retouche dans l'app : un attribut
(`data-favoris-lbc-qui`), aucun texte ni comportement changé.

| banc | cause | correction | preuve |
|---|---|---|---|
| lbc-relier (8) | Le banc ne servait pas `id=in.(…)`. La coque lit ainsi quels sites ont des lignes (`sitesLus`). Servi vide, Leboncoin passait « pas relié ». « Mes plateformes » le retirait alors (`FiltreSites` ramène au 1er site choisi) et `?tab=leboncoin` retombait sur Annonces · Vinted : le banc mesurait l'écran Vinted. | Le banc sert `id=in.(…)` (même forme que lbc-pause et lbc-supprimer). | Avant : 8 KO (capture : « Aujourd'hui · Vinted »). Après : 16/0. |
| lbc-publier-app (8) | Même cause : la fiche n'apparaissait jamais (attente de 20 s). | Même correction. | Avant : 0 ✓ · 8 ✗. Après : tout vert ; captures regardées (fiche 390, « 1 sur 1 réussie » 1512). |
| lbc-pause : Ma journée (6) | Le libellé est devenu « 1 annonce à retirer de Leboncoin » (Ma journée v2, 9 nov.) ; le banc cherchait « (\d+) à retirer ». | Le banc lit la carte `data-job="double-vente"` « à retirer de Leboncoin » (hors eBay/Vestiaire), son nombre RENDU (`data-n`) et « N°18 ». | Vert. |
| lbc-pause : N°14 sans preuve (4) | Une règle remplacée. Le 22 oct. : la N°14 restait « à retirer » avec un doute. Le 9 nov., décision de Julien (« elle propose de supprimer des annonces vendues sur Vinted qui ne sont plus sur Leboncoin », `lbcIdentiteSortie`, `2026-11-09-leboncoin-clair.md`) : une paire dont la SEULE annonce Leboncoin connue est sortie d'une lecture complète n'est ni « à retirer » ni « à confirmer ». | Le banc exige la décision du 9 nov. : la N°14 n'est ni dans `data-lbc-retirer`, ni dans `data-lbc-retirer-aconfirmer-num`. La N°18 garde son bouton. Ma journée dit 1 (§11). Le cas prouvé exige en plus « pas à confirmer ». | Mutation : `lbcIdentiteSortie` retiré ⇒ 2 KO (`aConfirmer: ["14"]`). |
| lbc-pause : « bouton rogné » à 390 (1) | « Vendues », « Retirées et autres » sont dans la rangée défilante des filtres (`styles-visuel-2.css` : `overflow-x: auto`, §7). On les fait défiler, ils ne sont pas rognés. | Un bouton ne compte comme rogné que s'il sort de l'écran sans aucun conteneur qui défile. | Mutation : `overflow-x: visible` ⇒ KO. |
| lbc-messages (2) | Le banc lisait l'état transitoire `charge` (« Lecture en cours… »). La panne se dit après une relecture (`lireReceptionLeboncoin`), en moins d'1 s. | Il attend que `data-messages-lbc` ne vaille plus `charge` (20 s au plus). | Mutation : `setD(null)` retiré (la panne reste « en cours ») ⇒ 2 KO. |
| lbc-flou-compte (3) | Le style était lu en pleine animation (`vrm-entree-ligne`, passage net ⇄ estompé : 0,56, 0,99). La ligne d'Achats, re-montée pendant l'attente, laissait un nœud détaché (opacité « 0 »). | Le style se lit à la fin des animations finies (3 lectures stables, 4 s au plus), et la ligne est relue à chaque tour. Les seuils (> 0,9 net, < 0,6 estompé) sont inchangés. | Deux passes vertes. Mutation : `STYLE_FLOU` retiré de `LigneAchat` ⇒ 2 KO. |
| lbc-comme-vinted (2) | Un ancien libellé : le banc cherchait « écrire à personne », l'écran dit « VRM n'écrit à personne ». | App : la phrase porte `data-favoris-lbc-qui="jamais"` (texte inchangé). Banc : la phrase une fois, et aucun bouton ni champ pour écrire dans le bloc. | Mutation : attribut retiré ⇒ 2 KO. |

Les mutations ont tourné ensemble dans une copie (`git archive` + build), bancs
lancés depuis cette copie. Pour relier et publier-app, la preuve est l'avant : le
même banc rouge sans `id=in.`.

## Résultat

`lot-bancs.sh` sur cet arbre (build du 11 nov.) : lbc-pause 58/0, lbc-publier-app
44/0, lbc-relier 19/0, lbc-flou-compte 25/0, lbc-messages 19/0, lbc-comme-vinted
67/0 ; les quatre autres restent verts (lbc-supprimer 70, lbc-repondre 41, dater-lbc
15, lbc-bordereau 7) ; banc lbc-plus 54/0. Audits : lbc-plus 56/0, lbc-plus-vue-pause, variables, tdz, coherence,
identite, icones, textes-courts, fonctions-api, secrets, quoi-de-neuf, traduction :
tous verts. Build vert.

## Remarques pour la suite

- Une ligne d'Achats Leboncoin se re-monte quand les données arrivent, et
  l'animation d'entrée se rejoue (un léger clignement). Ce n'est pas faux, mais un
  lot visuel peut vouloir garder la clé de la ligne stable.
- L'avertissement « le doute est dit une fois » (`data-lbc-retirer-doute`) n'est plus
  atteignable depuis le 9 nov. : une ligne sans identifiant Leboncoin passe toujours
  par « à confirmer » ou disparaît. Je l'ai laissé dans le code (sans risque). Un
  nettoyage peut le retirer.
- Geste de Julien : aucun.
