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

`npm run build && node scripts/bancs/visuel-argent.cjs` (390 tactile et 1512, clair et sombre ; `SHOTS=`, `VIDEO=`).
Résultats : voir §6.

## 6. Résultats et ce qui reste

(rempli à la fin du lot)
