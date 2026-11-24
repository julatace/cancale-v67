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

## L'apparition progressive, SANS LATENCE

Julien, 24 nov. : d'abord « pas d'un coup en bloc », puis « fais quelque chose sans latence ».

Une aide partagée par les trois lots visuels, dans `src/natif/Jeu.jsx` (exportée aussi par `src/natif/index.js`). Elle n'ajoute **jamais** d'attente.

1. **Ce qui est déjà connu s'affiche d'un coup**, à la première image, sans fondu : cache, visite d'avant. `const arrive = useArrive(donneesPretes)` est faux si les données étaient là au montage.
2. **Squelette seulement quand rien n'est connu** : `<SqueletteInventaire n/>`, `<SqueletteTuile taille/>`, ou `<Attente/>`. Il a la forme exacte de ce qui arrive (CLS ≤ 0,02).
3. **Seul un contenu qui ARRIVE s'anime** : `{...revele(i, 'ma-classe', arrive)}`, ou `<Revele i={i} arrive={arrive}>`.
   - Le premier élément (i = 0) n'attend jamais.
   - Chacun des suivants : 15 ms d'écart, 120 ms au plus.
   - Fondu + 3 px en 160 ms, sur `transform` et `opacity` seulement.
   - Avec mouvement réduit : rien.
4. **Toucher < 100 ms** : l'état appuyé est immédiat (transition 80 ms au plus) et la navigation part tout de suite.
5. **Aucune animation d'entrée d'écran au-delà de 200 ms.** Les pop-ups et la fête de la vente ne bloquent rien, elles gardent leur ressort.
6. **Images** : posées sur le gris du squelette.
   - Une image déjà en cache s'affiche tout de suite (`data-n-tuile-charge="deja"`), vérifié avant la première peinture.
   - Une image qui se charge arrive en fondu de 160 ms : jamais de flash blanc.

Banc : `scripts/bancs/visuel-jeu.cjs`.
- J9 : la 1re tuile n'attend pas, 15 ms d'écart, ≤ 120 ms, fondu ≤ 200 ms ; mouvement réduit ⇒ aucune apparition.
- J10 : temps du toucher au premier contenu ; au retour sur l'écran, les données connues sont là d'un coup.
