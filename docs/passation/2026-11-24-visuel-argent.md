# Argent, Messages, Paramètres visuels — 24 novembre 2026 (lot `claude/visuel-argent`)

Julien, 24 nov. : il aime les pop-ups « jeu vidéo » et veut « toute l'application visuelle » ; « pas de bug visuel… tout est
donné parfaitement et pas d'un coup en bloc », puis « fais quelque chose sans latence ».
Branche partie de `claude/style-clair` (#1326), avec `origin/main` et `claude/visuel-jeu` (pièces de `src/natif/Jeu.jsx`,
README `src/natif/visuel/README.md`) fusionnés.

**AFFICHAGE SEULEMENT : aucune règle de calcul ne change.** Chaque nombre vient de son propriétaire, déjà appelé par l'écran.

## 1. Argent · Mois (`src/natif/ecrans/ArgentMois.jsx`, pièces `src/natif/ecrans/ArgentVisuel.jsx`)

| pièce | d'où vient le nombre | « pas su » |
|---|---|---|
| Anneau de l'objectif, à droite du reçu | `useObjectifMois` → `valeurObjectif` → `progressionObjectif` (src/objectifMois.js), la règle de Statistiques | pas d'objectif ⇒ rien ; valeur inconnue ⇒ anneau en pointillé « — » (jamais plein, jamais 0) ; minimum ⇒ « ≥ » |
| Six mois | inchangés (`barres` : `recuPublieEntre`) ; barres plus épaisses, le mois en cours à l'ardoise, un minimum hachuré | « — » et piste en pointillé |
| Barre sous « Vendu » | `vendu.valeur` / max(vendu, bénéfice) | pointillé |
| Sous « Bénéfice » | prix manquants ⇒ la COUVERTURE (k cases pleines sur n, `couts` = nCout/n) ; sinon la barre du bénéfice | — |
| « À venir » en cartes | `liveStats.aVenir.parEtape` (règle de la coque, `argentAVenir.js`) ; une carte par étape, médaillon `TuilePaire` | rien tant que la coque lit ; une seule étape ⇒ « N ventes » (son montant serait le total, déjà écrit sur la rangée) |
| Seuils de l'année | `jaugeSeuils` (src/microEntreprise.js) sur la ligne PUBLIÉE `vinted_urssaf_mois` (datée au versement) ; plafond micro, TVA avec le repère du seuil majoré | régime pas choisi « micro » ⇒ aucune jauge (jamais deviné) ; ligne absente ⇒ pistes en pointillé « — » ; partiel ⇒ « au moins », « ≥ », fin hachurée |

Jamais « encaissé » : le CA de l'année se dit « Reçu en 2026 ». Le même nombre n'est pas écrit deux fois (le total à venir
reste sur sa rangée, les cartes disent les étapes).

## 2. Messages (`src/ecrans/FilsTous.jsx` — l'écran réellement monté ; et `src/designV2/LigneConversation.jsx`)

- La rangée commence par la **tuile de la paire** (`TuilePaire` 52 px) : sa photo vient de la fiche reliée PAR IDENTITÉ
  (`convVinted` ⇒ `paire.photo`). La photo de l'ACHETEUR n'est plus jamais prise (dans `LigneConversation`, le repli
  `opposite_user.photo` est retiré). Sans photo : un médaillon (icône message, ou étiquette pour une offre).
- L'**avatar du compte** (initiale du groupe) est posé sur le coin de la tuile ; les comptes restent séparés (§3).
- Non lu : un point fixe à l'ardoise avec un halo léger (aucune animation). Offre : une pastille icône + prix.
- À l'ordinateur, la vignette de droite est devenue la tuile de gauche (une seule photo par rangée).

## 3. Paramètres (`src/natif/ecrans/parametres-visuel.css`, `data-pm-cat` dans `src/ecrans/Reglages.jsx`)

- Chaque section a son **médaillon** (dégradé teinté par famille : encre, ardoise, sarcelle, acier, vert, bleu-ardoise ;
  ni orange ni violet), l'icône en blanc.
- **Interrupteurs clairs** : éteint = piste bordée #8A8D94 (≥ 3:1) avec un petit rond ; allumé = ardoise avec un trait blanc.
- La vue « Connexions de l'extension » est le travail de `claude/connexions-extension` : pas refaite ici (la rangée
  `connexions` reçoit le même médaillon que sa section).

## 4. Sans latence

L'apparition passe par l'aide partagée de visuel-jeu (`useArrive(pret, cle)`, `revele(i, cls, arrive)`) :
- déjà connu au premier rendu ou déjà montré dans la session ⇒ affiché d'un coup, sans fondu ;
- arrivé sous les yeux ⇒ barres qui poussent (160 ms, `transform` seulement), cartes en `revele` (15 ms par rang, ≤ 120 ms) ;
- `prefers-reduced-motion` ⇒ aucune animation.

## 5. Preuves — `scripts/bancs/visuel-argent.cjs`

`npm run build && node scripts/bancs/visuel-argent.cjs` (390 tactile et 1512, clair et sombre ; `SHOTS=`, `VIDEO=`,
`PARTIES=argent,reduit,messages,parametres`, `SEUL=pur` pour les pièces seules). Tout passe par `lourd.sh` sur la machine partagée.

- **Ce build** : Argent + mouvement réduit + Messages **130 verts, 0 rouge** ; Paramètres **29 verts, 0 rouge** (4 tailles/thèmes) ;
  pièces seules **9/9**.
- **Rouge sur la base** (`111a7d86e`, visuel-jeu sans ce lot, construit à part et servi par `BANC_DIST`) : **11 rouges** — anneau,
  jauges, cartes, barres absents ; Messages 0 tuile sur 80, aucun avatar de compte ; Paramètres 0 médaillon, interrupteurs sans bord ni trait.
- **Mutations** (pièces seules, chacune ⇒ rouge puis fichier restauré) : jauge « pas su » rendue 0 ; anneau « pas su » rendu 0 ;
  le « ≥ » d'un minimum retiré ; couverture décalée d'une case.
- Le banc a trouvé, en route : l'avatar de l'acheteur pris pour la paire dans l'ancienne rangée v2 (retiré) ; l'orange du point
  « Tout va bien ? » la nuit (corrigé) ; les médaillons et les interrupteurs écrasés par la couche « verre » (déplacés dans la
  première couche `vrm-vintex`) ; le logo Google (marque, `data-marque`, gardé).
- **Toucher → premier contenu d'Argent** (rapporté ; rouge seulement avec `BANC_T_STRICT=1`) : revisite 83–120 ms (base : 162 ms au
  même endroit), première ouverture 161–574 ms — c'est le montage de tout l'écran (Comptabilite), pas ce lot ; de l'écran monté à
  Mois rendu : 3–13 ms. La réaction au toucher : 1–2 ms.
- Film du chargement : `scratchpad/visuel-argent/argent-chargement.mp4` (Argent arrive d'un coup, sans « 0 » ni bloc vide).

## 6. Ce qui reste

- Bancs voisins (même machine, même heure) : `argent-vintex` 46/0, `textes-visibles` 16/0, `argent-natif` 494 verts (arrêté par
  le délai de la machine, aucun rouge de fond). **Aucun rouge nouveau** : les rouges sont les MÊMES sur la base (banc de la base
  sur le build de la base) — `argent-mois` 16 (Ventes · Vinted « À venir », écran « Argent à venir »), `argent-a-venir` 13,
  `argent-mieux` 6 (Déclarer : « Copier », libellés), `messages-naturel` 25, `messages-volets` 2, `messages-sites-naturel` 26,
  `messages-lisibles` 11, `parametres-refonte` 10/21 (toucher une catégorie : délai dépassé). Ils jugent l'ancien DOM ; à reporter
  sur les `data-*` du design (passation du 23 nov. §4.6).
- `audit-traduction` 45/0, `audit-urssaf`, `audit-chiffres`, `audit-quoi-de-neuf` verts. Le relevé 35/35 (`chiffres-volume`) n'a pas
  tourné (machine saturée) : ce lot n'appelle que des propriétaires existants, aucune somme neuve.
- À l'ordinateur, la valeur « Micro-entrepre… » de la colonne Paramètres est coupée (d'avant ce lot).
- `revele` de visuel-jeu ne se rejouait plus à la revisite dans Argent (vérifié par le banc : 0 animation à la revisite).
