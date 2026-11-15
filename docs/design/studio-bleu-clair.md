# Studio bleu clair — la direction visuelle de VRM

**Décision de Julien, 14 novembre 2026** : la direction t25 « Studio bleu clair » (Spatial × Bento × Aplats ×
Lumière). Elle REMPLACE Vitrine / Apple (31 oct., 2 nov.). « Tout doit être parfait, tu peux changer les
dispositions. » Rouge = deux paires sous un même N° (seulement) ; violet interdit ; ambre = un geste à faire.

| où | quoi |
|---|---|
| `src/design/studio.css` | les jetons `--sb-*` (clair et nuit), les quatre formes de bouton, les composants, la coque — chargé EN DERNIER |
| `src/design/studio-polices.css`, `src/design/polices/` | Urbanist + Inter variables, sous-ensemble latin, licence OFL jointe |
| `src/design/DisqueEventail.jsx` | le disque « + » de la barre du bas et son éventail (Chercher · Scanner · Publier · Imprimer N) |
| `src/design/ondulation.js` | l'ondulation de lumière au changement d'espace |
| `src/design/espace.js` | `espaceDe(tab)` : journee · paires · ventes · argent · autres (`data-espace`) |
| `src/themeMineral.js` | la même palette pour les styles écrits en ligne (`C.*`) |
| `scripts/audit-studio.cjs` | jetons et classes du contrat présents, aucun bouton hors des quatre formes dans les fichiers migrés |
| `scripts/bancs/studio-coque.cjs` | la coque rendue : fond, verre, disque ⇒ éventail ⇒ geste réel, ondulation, contraste AA |

Récit de la fondation : `docs/passation/2026-11-14-studio-fondation.md`.

## Le contrat des noms (fixé le 14 nov. pour tous les chantiers d'écran)

Décision de Julien (14 nov.) : la direction t25 « Studio bleu clair » (Spatial × Bento × Aplats × Lumière,
bleu clair PARTOUT, quatre formes de bouton, aucun bouton moche ou inutile, « tout doit être parfait, tu peux
changer les dispositions »). La référence visuelle et chiffrée :
- ce document (jetons, composants, « Règles des boutons », liste de contrôle par écran) ;
- la maquette jouable et sa planche sont restées hors du dépôt (photos de paires) ; les valeurs exactes sont dans `src/design/studio.css`.

Plusieurs agents travaillent EN MÊME TEMPS. Pour que leurs travaux se rejoignent sans conflit, ces noms sont FIXÉS.
L'agent « fondation » les implémente dans `src/design/studio.css` (+ `src/design/studio-polices.css`) ;
les agents « écrans » les UTILISENT tels quels (même si la fondation n'est pas encore fusionnée chez eux :
ils peuvent copier la définition minimale dans leur propre fichier d'écran le temps du travail, en la
marquant `/* provisoire : vient de studio.css */`, et la retirer à la fusion).

## Variables CSS (sur :root, redéfinies en nuit sous `:root[data-theme="dark"]` et le media prefers-color-scheme gardé)
--sb-haut, --sb-bas            lumière du fond (dégradé haut → bas)
--sb-aplat                     aplat de l'espace (nuance ±2 points par espace via [data-espace="journee|paires|ventes|argent"])
--sb-porcelaine, --sb-porcelaine-2   surface des tuiles / plans (haut → bas)
--sb-creux                     champs, segments, frise (creusés)
--sb-verre                     fond du verre dépoli (barre du bas, feuilles) + backdrop-filter
--sb-encre, --sb-encre-2       texte principal / secondaire
--sb-diode, --sb-lien          diode d'état actif / liens
--sb-ambre, --sb-ambre-point   texte « à faire » / point ambre
--sb-doublon                   ROUGE — seulement deux paires sous un même N° (§5, audit-rouge-doublon)
--sb-o                         triplet RVB de la teinte des ombres
--sb-ombre-pose, --sb-ombre-plan, --sb-ombre-avant   trois hauteurs, une seule lumière
--sb-r-tuile 22px · --sb-r-plan 28px · --sb-r-barre 26px · --sb-r-touche 13px · --sb-r-plaque 6px · --sb-r-vignette 11px
--sb-police-affiche (Urbanist, chiffres et titres) · --sb-police-texte (Inter / système)
--sb-e-appui 90ms cubic-bezier(.2,.9,.25,1) · --sb-e-espace 420ms cubic-bezier(.32,.72,0,1) · --sb-e-avant 360ms

## Les QUATRE formes de bouton — aucune autre (Règles des boutons de note.md)
.sb-btn-plein            (a) le seul bouton plein de l'écran — rond d'encre 72 px (80 ordinateur) ; variante .sb-btn-plein--barre (barre 52 px)
.sb-touche               (b) touche posée 40 px, rayon 13 ; état actif = [aria-pressed="true"] ou .is-actif : enfoncée + diode
.sb-rond                 (c) rond d'action 44 px (60 pour .sb-rond--disque)
.sb-lien                 (d) lien texte
Tout bouton de l'app doit porter l'une de ces quatre classes (ou être une ligne/tuile entière qui se touche).

## Composants
.sb-plaque (N° gravé ; .sb-plaque.is-double = doublon, seul rouge) · .sb-plaque--grande (code de retrait)
.sb-tuile (Bento, porcelaine posée ; [data-taille="1x1|2x1|2x2|3x1"]) · .sb-tuile-plus (le « + » signe du coin)
.sb-rangee (rangée de liste 64–72 px : plaque · vignette · titre/méta · chiffre) · .sb-vignette (photo posée)
.sb-bande (bande de chiffres) · .sb-chiffre-affiche (grand chiffre fin, € à 0,44 em remonté)
.sb-feuille (feuille en verre) · .sb-barre (barre du bas en verre) · .sb-disque (le « + » central) · .sb-eventail
.sb-segment (segments creusés) · .sb-champ (recherche creusée) · .sb-avant (plan qui monte au premier plan)
`data-espace` sur la racine de chaque écran : journee | paires | ventes | argent | autres

## Règles intouchables (CLAUDE.md)
§5 entier (identité, N°, chiffres, « pas su ≠ oui »), rouge = doublon de N° seulement, pas de violet, tout texte par `tr()` (5 langues),
44 px au doigt, pas de `-webkit-overflow-scrolling: touch` sur un conteneur de feuille, feuilles par portail + `FermeAuRetour`,
AUCUNE fonction supprimée : un bouton retiré = son geste rangé ailleurs (la ligne, la fiche de la paire, « ⋯ », l'éventail du disque).
Chaque écran : liste d'abord, 1 000 paires praticables, un seul bouton plein.

---

# La note de la direction (t25)

**Ce qui change vraiment** : tout VRM vit sur un seul bleu clair lumineux (la nuit, un bleu-nuit profond), éclairé du haut comme un studio ; ce qu’on touche est un objet *posé* dessus — la liste est un plan de verre dépoli, Ma journée une grille de tuiles en porcelaine qui portent chacune leur geste, la paire ouverte monte au premier plan sans quitter la liste ; ce qui est actif est enfoncé avec une diode ; les actions globales partent d’un disque au centre de la barre. Il n’existe que **quatre formes de bouton**.


Écrans : A Ma journée · A′ une tuile dépliée · B Paires · B′ paire ouverte · D Colis à expédier · E éventail ouvert · A et B nuit · C À expédier ordinateur 1512 × 945 · planche Système (couleurs, les quatre boutons dans tous leurs états en clair et en nuit, matières, barre).

## Ce qui vient de chacune

| direction | ce qu’on garde | ce qui a changé |
|---|---|---|
| **Aplats** | une couleur pleine qui porte tout l’écran ; chiffres énormes et fins (Urbanist 200) ; le rond d’encre = le seul bouton plein | une seule couleur (bleu clair) au lieu de quatre ; la transition devient une **ondulation de lumière** |
| **Lumière** | une seule lumière (du haut), ombre de contact fine + ambiante teintée de bleu ; paires posées ; **actif = enfoncé + diode** ; plaque N° gravée ; champs et frise creusés | les tuiles deviennent de la porcelaine (blanc → `#F7FAFD`) |
| **Spatial** | trois plans (fond → plan/tuile → premier plan) ; la paire ouverte qui monte, les autres reculent à 38–45 % ; le **disque** central en éventail | la liste et la barre sont en verre dépoli |
| **Bento** | Ma journée en tuiles asymétriques qui portent leur geste ; la tuile se déplie sur place, les autres se tassent en chiffres (A′) ; sur ordinateur les tuiles du haut sont les filtres ; N° en colonne à gauche | le « + » de tuile n’est plus un bouton : la tuile entière se touche, le « + » n’est qu’un signe |

**Où suis-je sans quatre couleurs ?** Le grand titre de l’écran (Ma journée, Paires, À expédier, Ventes) et, dans la barre, la **pastille enfoncée + diode** de l’espace actif. Les espaces gardent une nuance de ±2 points de luminosité (presque invisible, jamais une autre teinte).

## Interactions signature

1. **Le disque** : appui → il s’enfonce (diode, « + » tourné en « × »), l’écran recule (0,9, flou 1,5 px) sous un voile de bleu éclairé par le bas, quatre gestes s’ouvrent en arc : Chercher, Scanner, Publier, **Imprimer 8** (le plein, sous le pouce droit). On glisse et on relâche.
2. **Changement d’espace — l’ondulation** : un anneau de lumière blanche part de la pastille touchée et s’élargit à tout l’écran en s’effaçant (560 ms), pendant que le contenu glisse de 12 px en fondu (320 ms). Le bleu ne change pas : c’est la lumière qui passe.
3. **La tuile qui se déplie** et **la paire qui monte** : même ressort, même ombre de premier plan.
4. **La touche tenue** : « Imprimer » reste enfoncé, diode allumée, tant que les bordereaux sortent.

## Règles tenues (mesurées au dernier tour)

- 1re rangée de liste à 32 % (Paires), 36 % (Colis) de 844 px ; rangées 64 px ; 8 paires visibles sur Paires.
- Un seul bouton plein par écran (aucun sur Paires) ; toutes les cibles iPhone ≥ 44 px ; rien ne déborde d’un écran ni d’une tuile.
- **Contraste AA remesuré** (`contraste.cjs`, 0 paire sous 4,5:1, sur le haut, le milieu et le bas du dégradé, la porcelaine et le creux) : clair — encre ≥ 12,2 · encre 2 ≥ 5,6 · ambre ≥ 5,8 · lien ≥ 5,0 · rouge ≥ 5,4 ; nuit — encre ≥ 13,4 · encre 2 ≥ 6,8 · ambre ≥ 8,4 · lien ≥ 6,9 · rouge ≥ 5,4.
- 1 000 paires : `content-visibility:auto` + `contain-intrinsic-size` sur les rangées, images `lazy`, aucune ombre lourde ni `backdrop-filter` sur une rangée (le verre est sur le plan entier et la barre, une seule couche chacun) ; `prefers-reduced-transparency` rend le verre opaque, `prefers-reduced-motion` ne garde que les fondus.
- Rouge = doublon de N° seulement (montré dans Système). Aucun violet.

---

# Système prêt à coder

## 1. Couleur — « bleu clair partout »

Chaque écran porte `class="esp-jour|esp-paires|esp-ventes|esp-argent"` (+ `nuit`). Seul l’**aplat** varie d’un espace à l’autre (±2 points) ; tout le reste est commun.

| jeton | clair | nuit |
|---|---|---|
| lumière haut (`--haut`) | `#EEF6FD` | `#15263D` |
| aplat Ma journée / Paires / Ventes / Argent | `#D9EAF7` / `#D5E8F6` / `#D2E5F4` / `#D6E8F5` | `#0D1A2C` / `#0C1829` / `#0B1727` / `#0D192A` |
| bas (`--bas`) | `#C6DDF0` | `#060E19` |
| porcelaine (`--feuille` → `--feuille2`) | `#FFFFFF` → `#F7FAFD` | `#16273C` → `#122135` |
| creux (plaque, enfoncé) | `#E4EEF7` | `#091320` |
| encre | `#0C1D30` | `#EAF2FB` |
| encre 2 | `#3F5468` | `#9CB0C6` |
| ombre `--o` (RVB) | `18 52 96` | `0 0 0` |
| diode | `#0060CC` | `#4AA3FF` |
| lien texte | `#0055B8` | `#6CB4FF` |
| ambre texte / point | `#764300` / `#E08A12` | `#F2B65E` / `#F2A33A` |
| rouge (doublon de N°) | `#B8261A` | `#FF6B5E` |

**Fond d’écran** : `radial-gradient(90% 40% at 18% 0%, #fff/.55, transparent 70%), linear-gradient(180deg, haut 0%, aplat 40%, bas 100%)` ; nuit : halo `rgb(110 160 230/.10)` au lieu du blanc. Aucun autre dégradé hors porcelaine et relief des touches (deux tons voisins).

**Verre** (barre du bas, plan de liste, navigation ordinateur) : clair `rgb(255 255 255/.64)` (plan : `/.80`), nuit `rgb(24 41 63/.62)` (plan : `rgb(20 35 54/.82)`), `backdrop-filter: blur(24px) saturate(170–180%)`, bord `inset 0 .5px 0 #fff/.95, 0 0 0 .5px o/.10`.

## 2. Ombre — une lumière, trois hauteurs

| hauteur | usage | clair | nuit |
|---|---|---|---|
| `--om-pose` | vignette | `0 .5px 1px o/.16, 0 3px 6px -3px o/.28` | `0 .5px 1px #000/.5, 0 3px 6px -3px #000/.7` |
| `--om-tuile` | tuile, plateau, touche posée | `inset 0 1px 0 #fff, 0 0 0 .5px o/.07, 0 1px 2px o/.07, 0 12px 26px -14px o/.30` | `inset 0 .5px 0 #fff/.09, 0 0 0 .5px #000/.5, 0 12px 26px -12px #000/.8` |
| `--om-haut` | paire ouverte, tuile dépliée | `inset 0 1px 0 #fff, 0 0 0 .5px o/.06, 0 2px 5px o/.07, 0 34px 60px -26px o/.48` | `inset 0 .5px 0 #fff/.12, 0 0 0 .5px #000/.5, 0 34px 60px -22px #000/.95` |

## 3. Grille, espacements, rayons (Bento compris)

- Grille de **4** ; gouttière d’écran **16** (titres et bandes à 20) ; entre blocs 8–16.
- **Bento iPhone** : 3 colonnes égales, gouttière **10**, rangées `96 / 96 / 108 / 100` ; « À envoyer » 2 × 2, « À retirer » 2 × 1, simples 1 × 1, mois 3 × 1 ; padding `14 14 14 16`. Tassées (A′) : `1.3fr 1fr 1fr 1fr`, hauteur 64, gouttière 8, rayon 17. Dépliée : pleine largeur, de 198 px à 100 px du bas.
- **Bento ordinateur** : `3fr 1fr 1fr 1fr 1fr`, gouttière **14**, hauteur **128**, padding `15 16 16`.
- Rayons : tuile **22** · plan **28** (haut) · barre **26** · plateau **16** · touche **13** · champ **14** · vignette **12** (ouverte 14) · plaque **6** (grande 8, code 8) · rond **50 %**.

## 4. Typographie

**Urbanist** variable (chiffres, titres d’écran) + **Inter** variable (texte). `font-feature-settings: "tnum","lnum","cv11","kern"` partout. Montants d’affiche : `1 471` puis **€ à 0,44 em, graisse 300, remonté de 0,92 em** (`<bdi class="nb">1 471<sup class="eur">€</sup></bdi>`, insécable) ; prix de rangée : € à 0,68 em remonté de 0,2 em.

| rôle | famille | taille / interligne | graisse | approche |
|---|---|---|---|---|
| affiche (275, 10) | Urbanist | 96 / .8 (ordinateur 104) | 200 | −0,065 em |
| chiffre de tuile (8) | Urbanist | 68–72 / .8 | 200 | −0,05 em |
| chiffre de filtre ordinateur | Urbanist | 56 / .8 | 200 | −0,05 em |
| chiffre moyen (tuile, bande, mois) | Urbanist | 38 · 27 · 26 / .8–1 | 300 | −0,03 em |
| prix de rangée | Urbanist | 21 / 1 | 400 | −0,02 em |
| titre d’écran | Urbanist | 32–34 (ordinateur 38) / 1 | 400 | −0,03 em |
| ligne au-dessus du titre | Inter | 13 / 1 | 500 | 0 |
| titre de rangée | Inter | 15 / 1,2 (ouverte 18) | 600 | −0,008 em |
| libellé de tuile, bouton, lien | Inter | 13–14 / 1,2 | 600 | 0 |
| méta, libellé de chiffre | Inter | 12–12,5 / 1,2 | 500–550 | 0 |
| plaque N° | Inter | 12,5 (grande 16, code 17 à +0,07 em) | 600 | « N° » 9,5 px encre 2 |
| barre du bas | Inter | 10,5 | 600 | 0 |

Icônes : un seul jeu au trait, **1,5 px à l’écran quelle que soit la taille** (`vector-effect: non-scaling-stroke`), bouts et jointures arrondis ; 21 dans les ronds, 16 dans les touches, 24 dans le plein.

## 5. Mouvement

| geste | durée | courbe |
|---|---|---|
| appui (touche, rond, plein) | 90 ms enfoncé · 160 ms retour | `cubic-bezier(.2,.9,.25,1)` — `translateY(1px)` (plein 1,5 px + `scale(.985)`) |
| diode | 120 ms | `ease-out` |
| ondulation (changement d’espace) | anneau 560 ms ; contenu 320 ms, 12 px | `cubic-bezier(.2,.9,.25,1)` |
| disque → éventail | écran 360 ms ; touches 300 ms, décalage 30 ms ; « + » → « × » 260 ms | même courbe, amorti critique, aucun rebond |
| premier plan (paire, tuile) | 360 ms ; voisines 240 ms | même courbe |
| réduire les animations | fondus 150–200 ms, ni glissé, ni flou, ni ondulation | — |

## 6. Composants

- **Vignette posée** : socle clair uniforme (`#F1F5F9` / nuit `#1C2E46`), photo fondue sur ses bords (`mask-image: radial-gradient(78% 78% at 50% 54%, #000 58%, transparent)`) pour qu’elle ait l’air détourée, liseré `.5px o/.10`, reflet haut `#fff/.7`, `--om-pose`. 44 en liste, 40 en tuile, 75 × 105 ouverte.
- **Plaque N°** : 22 de haut, min 46, rayon 6, creux, gravure `inset 0 .5px 1px o/.26, inset 0 0 0 .5px o/.08, 0 .5px 0 #fff/.9`. Doublon : texte rouge + anneau rouge 1 px. Code de retrait : 30 px, 17/600, +0,07 em.
- **Rangée** : 64 px, `50 | 44 | 1fr | auto`, gouttière 12, padding `0 20 0 16` ; N° · vignette · titre + méta · prix (ou échéance, ambre si avant demain). Pas de séparateur. La rangée entière est le geste (aucun bouton dedans).
- **Paire ouverte** : la rangée devient une carte en porcelaine, marge 8, rayon 22, `--om-haut` ; photo 75 × 105, plaque grande, titre 18/650, chiffres (prix Urbanist 200/42), puis **deux touches + « ⋯ »**.
- **Tuile** : porcelaine, rayon 22, `--om-tuile` ; libellé en haut à gauche, chiffre en bas à gauche, signe « + » 15 en haut à droite (pas un bouton) ; toute la tuile se touche. Tuile-filtre : douille éteinte en haut à droite ; active = enfoncée + diode.
- **Bande de chiffres** : sur le fond, sans carte ; Urbanist 300/27, libellé 12,5/550, écart 24.
- **Barre du bas** : verre, à 12 des bords et 20 du bas, 64 × rayon 26, `1fr 1fr 72px 1fr 1fr` ; icône 21 + libellé 10,5 ; l’espace actif = **pastille enfoncée 46 × 30 + diode**, libellé à l’encre ; disque (rond 60) monté de 16 px au centre. Fondu de bord bas de 132 px sous la barre.
- **Éventail** : arc de rayon 156 centré 14 px au-dessus du disque, angles 152° / 111° / 69° / 28° ; ronds 60 + le plein 72 côté pouce droit ; libellés 13/600.
- **Feuille** (À faire, détails) : porcelaine, rayon 28 en haut, `--om-haut`, l’écran derrière recule à 0,94 sous un voile de bleu à 60 %, `FermeAuRetour`.
- **Ordinateur** : navigation en verre de 222 (actif enfoncé + diode), titre + segment, rangée de tuiles-filtres, liste dense en plan de verre (rangées 60, N° en première colonne) ; la ligne ouverte passe au premier plan dans la liste.

---

# Règles des boutons (à appliquer à toute l’app)

## Les quatre formes — et aucune autre

| forme | dessin | quand | états |
|---|---|---|---|
| **(a) Bouton plein** | rond d’encre 72 (80 sur ordinateur), icône 24 + mot court 11,5/650 en dessous | **le** geste principal de l’écran, un seul ; il peut ne pas y en avoir (Paires) | repos · appui (enfoncé 1,5 px) · **en cours** (reste enfoncé + diode, libellé « En cours ») · désactivé (encre à 18 % sur le fond, sans ombre) |
| **(b) Touche** | 40 de haut (44 en bas de feuille), rayon 13, porcelaine en relief, texte 14/600, icône 16 facultative | gestes secondaires d’un objet (Baisser le prix, Republier, Marquer envoyé), menus (« Vinted · tous ▾ »), segments et filtres | repos · appui (enfoncée) · **actif** (enfoncée + diode : segment choisi, filtre posé, impression en cours) · désactivé (trait 0,5 px, texte encre 2 à 55 %) |
| **(c) Rond** | 44 (60 pour le disque et l’éventail), même matière que la touche, icône 21 | une icône seule qui se comprend sans mot : alertes, menu, chercher, fermer (×), aide (?), « ⋯ » | repos · appui · actif (enfoncé + diode) · désactivé |
| **(d) Lien** | texte 14/600 couleur lien, chevron 15, zone de 44 de haut | aller voir plus (« 2 autres, et 2 bordereaux à générer › », « À faire · 5 › »), un geste rare dans une ligne (« Générer le bordereau ») | repos · appui (opacité 55 %) · désactivé (encre 2 à 55 %) |

Ce qui **n’est pas** un bouton : une rangée de liste et une tuile (on les touche entières), les signes « + » et « › » (indices, pas des cibles), la navigation (barre du bas, colonne de gauche).

## Ce qu’il faut retirer

1. **Le bouton qui ne fait que naviguer** là où toucher la ligne ou la tuile suffit (« Ouvrir », « Voir », « Détails », « › » en bouton à part) → la ligne entière est la cible.
2. **Le doublon** d’un geste déjà présent sur l’écran (un « Imprimer » par rangée sous un « Tout imprimer » ; « Imprimer » dans la liste ET dans la carte ouverte) → un seul endroit : le plein pour le lot, la carte ouverte pour une paire.
3. **L’action rare** (Modifier, Partager, Dupliquer, Retirer, Supprimer, Exporter, Copier le lien) → dans « ⋯ » de la carte ouverte ou dans la fiche de la paire.
4. **L’action globale** posée sur un écran (Publier, Scanner, Chercher partout, Imprimer le lot) → dans l’éventail du disque.
5. **Le second bouton plein** → il devient une touche ; s’il n’y a pas de geste principal évident, aucun plein.
6. **Le bouton d’explication** (« Comment ça marche », « En savoir plus » en gros bouton) → un rond « ? » à côté du titre, ou un lien.
7. **Le bouton d’état** qui ne fait rien (« Synchronisé », « À jour », badge cliquable) → une ligne de texte ou une diode, sans cible.
8. **Les rangées de capsules** de plus de trois filtres → un menu « ▾ » (touche) ou des tuiles-filtres qui portent leur chiffre.
9. **Toute forme hors des quatre** (pastille colorée, bouton fantôme, bouton-icône de 30 px, double bordure, dégradé vif, bouton bleu plein) → la forme la plus proche des quatre.

## Où vont les actions

| genre | place |
|---|---|
| le geste du jour (imprimer le lot) | le **plein** de l’écran |
| un geste sur une paire | la **carte ouverte** : deux touches au plus + « ⋯ » |
| les actions rares d’une paire | « ⋯ » puis la **fiche de la paire** |
| créer, chercher partout, scanner, publier, imprimer | l’**éventail du disque** |
| filtrer, choisir un compte | tuiles-filtres ou une touche-menu « ▾ » |
| fermer, aide, alertes, menu | **ronds** 44 (au plus deux en haut à droite) |

## Liste de contrôle par écran

- [ ] Au plus **un** plein ; il nomme le geste du jour (« Imprimer 8 »), pas un verbe vague.
- [ ] Chaque bouton est l’une des **quatre formes**, au bon gabarit (72 · 40 · 44/60 · lien 44).
- [ ] Au plus **deux ronds** dans l’en-tête ; aucune icône seule sans `aria-label`.
- [ ] Aucune rangée de liste ne contient de bouton ; la rangée entière ouvre la paire.
- [ ] Aucun geste en double sur l’écran (même verbe deux fois = en retirer un).
- [ ] Les actions rares sont dans « ⋯ », la fiche ou l’éventail — pas visibles par défaut.
- [ ] Tout état actif = **enfoncé + diode** ; jamais une couleur de fond différente.
- [ ] Désactivé = forme gardée, contraste baissé, aucune ombre ; et une phrase dit pourquoi si le geste est attendu.
- [ ] Cibles ≥ 44 × 44 sur iPhone ; libellés de 1 à 3 mots, verbes à l’infinitif.
- [ ] Le bleu (lien, diode) n’est jamais sur un montant ; l’ambre seulement pour un geste à faire ; le rouge seulement pour un doublon de N°.

## Polices

Urbanist variable 100–900 (OFL-1.1, @fontsource/variable-urbanist 5.3.0) · Inter variable 100–900 (OFL-1.1, @fontsource-variable/inter 5.3.0). Licences vérifiées dans les paquets.
