# 7 nov. — Design 2026 : les fondations, Ma journée et Colis

Branche `claude/design-fondations` (pas de PR : le coordinateur fusionne).

## La demande

Julien (7 nov.) : « je veux que tu améliores le visuel de tout le site, du petit message à la
structure […] là c'est vraiment pas beau ; je t'ai installé des nouveaux skills ». Ses réponses :
GARDER Apple (blanc, encre, bleu Apple rare, police système) EN BEAUCOUP MIEUX ; iPhone ET
ordinateur aussi soignés ; « outil pro calme » (Réglages, Mail, Wallet). Puis, en cours de
chantier : « mets le logo du transporteur à côté […] pour Colis aussi ».

Skills utilisés : `impeccable` (polish, mode Operate, `craft-floor`, puis `document` ⇒ `DESIGN.md`),
`apple-design` (échelle, approche, matières, mouvement), `emil-design-eng` (appui 0,97, courbes,
durées), `mobile-native` (pas de surbrillance au tap, `touch-action`, contrôles non sélectionnables).
Interview : aucune question posée (agent sans interlocuteur) — le brief et PRODUCT.md ont tenu lieu
de réponses.

## Ce qui a été posé

### 1. Les fondations — `src/styles-design-2026.css`
Importé en DERNIER CSS de `src/App.jsx` (et non de `main.jsx` : le CSS de l'app arrive dans SON
morceau, après celui de `main.jsx` ; posé là-bas il perdait contre `styles-visuel-2.css`).

- **Jetons `--d-*`** : texte 11 · 12 · 13 · 15 · 17 · 20 · 22 · 28 · 34 · 44 (Dynamic Type),
  interlignes `--d-il-*`, approches `--d-ap-*` (négatives en grand, nulles en petit) ; espaces
  4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 ; rayons 6 · 12 · 14 · 20 · 24 · 999 ; surfaces clair/sombre
  (`--d-fond`, `--d-carte`, `--d-case` = le second neutre, `--d-remplir`, `--d-filet`, `--d-encre`,
  `--d-gris`) ; ombres à deux couches (`--d-ombre-carte`, `-levee`, `-flottant`, liseré la nuit) ;
  mouvement (`--d-sortie`, `--d-tiroir`, 150/200/250 ms).
- **Les anciens noms lisent les jetons** : `--t-*`, `--vrm-t*`, `--r-*`, `--fu-r-*`, `--o-carte`,
  `--fu-ombre`, `--vrm-ombre-carte`, `--o-flottant`, `--vrm-sortie`, `--vrm-ressort`, `--fu-remplir*`.
  Une valeur à changer ⇒ un seul endroit. (Les couches d'avant restent ; aucune règle retirée :
  rien n'était sûrement mort à ce niveau.)
- **Surfaces du navigateur** : lissage des polices (Mac/iPhone), crénage, `caret-color` et
  `accent-color` bleus, sélection bleue à 24 % (42 % la nuit), barres de défilement fines et
  neutres, anneau de focus clavier 2 px décollé de 2 px (`:focus-visible`, faible spécificité),
  titres équilibrés (`text-wrap: balance`), paragraphes sans veuve (`pretty`), contrôles non
  sélectionnables au doigt (`.vrm-b`, segments, « … », cases) — un CONTENU (adresse, code) reste
  sélectionnable ; chiffres tabulaires ; `prefers-reduced-transparency` (barres floutées ⇒ aplats),
  `prefers-contrast: more` (cadre net sur chaque carte) ; appui `scale(.97)` 120 ms en mouvement
  normal seulement.

### 2. Ma journée
- **« À faire » en UN groupe à rangées à l'ordinateur aussi** (il ne l'était qu'au téléphone :
  cinq cartes empilées à 1512 px). Filet .5 px qui commence au texte, survol à la souris seulement.
- **Le guide « Démarrer avec VRM »** : une carte comme les autres (plus de cadre gris, filets
  d'iOS) ; à ≥ 1280 px il passe SOUS la semaine, colonne de gauche (il s'étirait sur 1 200 px
  après un trou de 50 px).

### 3. Colis
- **Le prochain geste** (`.vrm-colis-prochain`) : UNE rangée (rayon 20, ombre posée), un POINT
  ambre devant la phrase à l'encre, un bouton pilule à droite. Avant : deux lignes d'ambre gras et
  un bouton gris pleine largeur — le bloc le plus lourd de l'écran.
- **La frise n'est posée que si une étape est FAITE** (À envoyer Vinted, eBay/Leboncoin
  `CarteColisSite`, Vestiaire) : quatre traits gris sous chaque carte « à envoyer » ne disaient
  rien. Envoyés garde la sienne (une étape est toujours faite).
- **Le titre de la paire** : 15/600, DEUX lignes au plus, sur les cartes d'À envoyer, d'Envoyés
  (coupé sur une ligne avant) et dans la Tournée (coupé « Adidas Samba O… » avant).
- **Le logo du transporteur** (demande de Julien) : `BadgeTransporteur`
  (src/PastilleTransporteur.jsx) pose le logo dans le coin de la vignette (tuile blanche 24 px,
  rayon 6) sur les cartes d'À envoyer (Vinted `trV`, eBay/Leboncoin `transporteur`), d'Envoyés
  (`x.tr`) et sur les rangées d'À retirer quand le nom est dit par l'en-tête du point (sinon la
  puce de la rangée porte déjà logo + nom : jamais deux fois sur une ligne, §7). Même `t` que la
  puce (`transporteurDuColis` / `transporteurVente`) : **rien lu ⇒ rien posé**. Tuile cachée tant
  que le logo n'est pas chargé (ou s'il échoue). La carte Vestiaire garde sa puce (pas de badge
  en plus). L'écran Ventes n'est pas touché (le coordinateur s'en charge).
- **Ordinateur** : un colis = une RANGÉE (photo · titre et limite · frise 260–340 px · gestes) au
  lieu d'une carte étirée sur 1 200 px dont la frise traversait l'écran ; Envoyés idem, la 3e
  colonne (« Suivre », « Pas encore déposé ») toujours réservée pour que les frises s'alignent ;
  la carte sombre « Aujourd'hui » couchée (grand chiffre à gauche, cases à droite : 250 → 150 px).
  La carte sombre est affinée, pas retirée (choix de Julien).

Aucune règle métier, aucun chiffre, aucune donnée touchés ; tous les `data-*` gardés.

## Avant / après (captures, données inventées)

Dossier : `/tmp/claude-0/-home-user-cancale-v67/f70a9764-046d-5574-bac2-0a1794911434/scratchpad/design-1/`
(script `cap.cjs`, base `_base-volume.cjs` corrigée `numero`, données Colis du banc
`colis-colonnes` + deux n° Chronopost). ⚠️ Le réseau de la machine est fermé : les logos des
transporteurs (favicon de LEUR domaine) ne chargent pas au banc ; pour VOIR la forme, `cap.cjs`
pose une image de remplacement dans les tuiles que l'app a rendues (avant comme après).

| écran | avant | après |
|---|---|---|
| Colis · À envoyer · 390 | `avant2/colis-envoyer-390-clair-long.png` | `apres2/colis-envoyer-390-clair-long.png` |
| Colis · Envoyés · 1512 | `avant2/colis-envoyes-1512-clair.png` | `apres3/colis-envoyes-1512-clair.png` |
| Ma journée · 1512 | `avant/journee-1512-clair-long.png` | `apres3/journee-1512-clair-long.png` |
| Tournée · 390 sombre | `avant2/tournee-390-sombre.png` | `apres2/tournee-390-sombre.png` |

Aussi : `apres2/` (390 et 1512, clair et sombre : journée, À envoyer, Envoyés, À retirer, Tournée,
« En grand »).

## Vérifications

Voir la section « Bancs et audits » du rapport de fin (même contenu) ; le banc `colis-envoi` a été
adapté pour juger la règle nouvelle : rien de fait ⇒ pas de frise (ou aucun mot à l'encre), une
carte imprimée garde la sienne, et aucune frise posée sans étape faite (la règle ne peut pas
passer en retirant toutes les frises).

## Ce qui reste (pour l'agent suivant)

1. **Appliquer les jetons** aux autres écrans : Ventes (le coordinateur y est), Annonces, Achats,
   Messages, Compta, Statistiques, Réglages, plateformes (eBay, Leboncoin, Vestiaire). Même
   méthode : une section par écran dans `styles-design-2026.css`, sélecteurs `:root:root body
   .vrm-app-shell .vrm-main …` (les couches d'avant sont en `!important` à forte spécificité),
   `--d-*` seulement, captures 390 + 1512, clair + sombre.
2. **Les listes** de ces écrans en groupes à rangées (filet .5 px après la vignette), une ligne
   d'état par rangée, la frise seulement quand une étape est faite.
3. **La phrase répétée sur chaque carte** (« 7 j pour l'envoyer · vendue aujourd'hui » quand
   toutes les ventes d'un groupe datent du même jour ; « vendue aujourd'hui » dans la Tournée) :
   pas faite — le banc `colis-envoi` exige l'attente sur CHAQUE carte et la phrase varie en vrai ;
   à faire seulement si toutes les cartes du groupe disent exactement la même chose, en gardant le
   texte lisible au lecteur d'écran.
4. **À retirer à l'ordinateur** : la colonne fait 900 px quand la tête (prochain geste, carte
   sombre) fait toute la largeur — à harmoniser (carte du relais à côté de la liste ?).
5. **Supprimer les couches mortes** : ~80 feuilles s'empilent (vitrine, finition, épuré, fusion,
   jetons, visuel, visuel-2…). Ne retirer qu'une règle prouvée morte au rendu (banc), écran par
   écran.
