# Le langage « jeu vidéo » de VRM

Julien, 24 novembre 2026 : « c'est pas visuel, hésite pas à faire des designs comme jeu vidéo », puis « je veux vraiment que TOUTE l'application soit visuelle ».
L'idée : des écrans d'inventaire, des quêtes, de la progression, des récompenses. Le résultat doit être vivant, sans couleurs criardes.

Code : `src/natif/Jeu.jsx` et `src/natif/jeu.css`. Tout est aussi exporté par `src/natif/index.js`.
Exemples réels :
- `src/natif/PopEvenements.jsx` (les pop-ups) ;
- `src/AlerteModeration.jsx` (la grille des disparues) ;
- `src/natif/ecrans/Aujourdhui.jsx` (l'anneau des colis, les ventes en tuiles).

Banc : `scripts/bancs/visuel-jeu.cjs`.

```jsx
import { TuilePaire, EtiquetteN, Anneau, CarteQuete, QuetesFaites, Confettis, EtagereTrophees } from '../natif/index.js';
```

## Les pièces

| pièce | à quoi elle sert | props utiles |
|---|---|---|
| `TuilePaire` | la paire comme un objet d'inventaire : la photo carrée, l'étiquette du N° (coin bas-gauche), le médaillon de l'événement (coin haut-droit). Sans photo, un médaillon teinté par famille. | `photo`, `numero`, `icone`, `genre` (`vente`, `arrivee`, `bordereau`, `moderation`, `rappel`, `avis`, `favori`, `message`, `offre`, `argent`, `erreur`), `taille` (`m` 56, `l` 72, `xl` 96), `Icon`, `Photo={PhotoVinted}` (prend la bonne taille, `src/photoTaille.js`), `attrsN` |
| `EtiquetteN` | l'étiquette du N° seule (un papier à œillet) | `numero`, `attrs` |
| `Anneau` | une progression | `valeur`, `total`, `taille`, `epaisseur`, `centre`, `fait`, `libelle` |
| `CarteQuete` | une chose à faire : médaillon, un verbe, « N restants ». `fait` ⇒ la coche se dessine, une petite pluie, puis la carte se replie | `icone`, `titre`, `verbe`, `restant`, `fait`, `onClick`, `onReplie` |
| `QuetesFaites` | le compteur « ✓ 3 faites aujourd'hui » | `n` |
| `Confettis` | la petite fête (1 s, 18 éclats), dans un parent `position: relative` | `n`, `graine`, `duree` |
| `Trophee`, `EtagereTrophees` | des paliers RÉELS (1, 10, 50, 100… ventes), calmes, sans relance | `total` (un nombre LU), `paliers` |

Grilles :
- La rangée défilante des ventes (`.n-inventaire`, `.n-inventaire-case`) est dans `jeu.css`.
- Pour une grille de tuiles : `display: grid; grid-template-columns: repeat(auto-fill, minmax(88px, 1fr))`, la tuile en `width: 100%; aspect-ratio: 1`. Voir `.vrm-mod-grille` dans `src/styles-alerte-moderation.css`.

## Les règles

1. **La photo vient de l'appelant, trouvée PAR IDENTITÉ** : id d'annonce, n° de transaction, fichier exact. Jamais par le titre, la marque ou la taille (CLAUDE.md §5). Sans identité, pas de photo : le médaillon. Le banc pose un leurre au même titre et vérifie qu'il n'est jamais pris.
2. **Le N° vient de sa source**, une fiche par identité, ou le N° que l'émetteur a écrit. Un N° absent ne dessine rien : mieux vaut un blanc qu'un faux. Le même N° ne s'écrit pas deux fois sur l'écran : l'étiquette le dit, le texte ne le redit pas.
3. **« Pas su » n'est jamais 0** : `Anneau` avec une valeur ou un total inconnu (null) se dessine en pointillé avec « — », jamais vide ni plein. `CarteQuete` sans `restant` affiche « — ». `EtagereTrophees` sans total LU ne rend rien.
4. **Aucun orange, aucun ambre.**
   - Couleurs : ardoise `#3D4B5B`, encre, sarcelle (`--n-teal`), vert « fait » (`--n-vert`), acier `#4C5A73`.
   - L'étiquette du N° est un papier NEUTRE, saturation ≤ 15 %.
   - Le rouge reste réservé à deux paires sous un même N° (§7).
   - Le banc juge les couleurs CALCULÉES : teinte 15–50°, saturation ≥ 30 %, luminosité 20–85 % ⇒ rouge.
5. **Mouvement** :
   - Des ressorts courts (`--n-jeu-ressort`, `--n-jeu-tampon`, en `linear()` avec un repli `cubic-bezier`).
   - Rien ne bloque : `pointer-events: none` sur les effets.
   - `prefers-reduced-motion: reduce` ⇒ un fondu, aucune pluie, aucun rebond (le banc le vérifie).
6. **Listes longues** : pas d'animation par rangée au-delà des 5 premières, et les images prennent leur bonne taille (`Photo={PhotoVinted}`).
7. **Textes** : tout passe par `tr()` (`src/i18n/langues/*/visuelJeu.js`, cinq langues). Cibles au doigt ≥ 44 px. Clair et sombre.
8. **Affichage seulement** : aucune règle métier ne change. Un nombre vient de son propriétaire unique (§5).

## L'apparition progressive (Julien, 24 nov. : « pas d'un coup en bloc »)

Les trois lots visuels utilisent UNE seule aide, dans `src/natif/Jeu.jsx` (`src/natif/index.js` l'exporte aussi).

Avant les données :
- Pose le squelette de la FORME finale : `<SqueletteInventaire n={5}/>` pour une rangée d'inventaire, `<SqueletteTuile taille="xl"/>` pour une tuile, `<Attente/>` (`src/natif/Attente.jsx`) pour des rangées.
- Les mêmes tailles qu'à l'arrivée : rien ne bouge, CLS ≤ 0,02.

Quand les données arrivent :
- Pose `{...revele(i)}` sur le i-ème élément, ou enveloppe-le dans `<Revele i={i}>`.
- Chaque élément arrive en fondu + 4 px, 30 ms après le précédent, plafonné au 8ᵉ (240 ms au plus).
- L'animation ne touche que `transform` et `opacity` : aucun décalage de mise en page. L'élément est lisible dès la première image (opacité de départ 0,35).
- Avec `prefers-reduced-motion: reduce`, l'apparition est immédiate.

Les images :
- `TuilePaire` pose la photo sur le gris du squelette et la fait apparaître en fondu une fois chargée (`data-n-tuile-charge`).
- Pas de flash blanc.
- Une image déjà en cache ne refait pas le fondu.

Pour une liste longue, ne pose `revele` que sur les premiers éléments visibles : au-delà du 8ᵉ, ils arrivent ensemble.
