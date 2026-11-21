# 11 nov. 2026 — lot `clics-directs`

Demande de Julien, mot pour mot : « Dans Ma journée, quand je clique sur la pile de ventes, je ne
veux pas que ça zoome : je veux que ça emmène sur les ventes. Dans les ventes, quand je clique sur
les photos, je ne veux pas voir la loupe mais la photo en plus grand. »

## Ce qui se passait (mesuré par le banc sur l'arbre de `main`)
- **Ma journée, la pile de la frise** (`FriseJournee`, `.vrm-jv2-pile-bouton`) : le bouton menait
  bien à Ventes (`onNav('cat_ventes')`), mais ses vignettes portent `data-vrm-vignette`. La
  visionneuse globale (lot AN, `src/Visionneuse.jsx`) écoute le clic EN CAPTURE et s'ouvre sur toute
  vignette qui ne remplit pas 80 % de son bouton : la vignette du dessus (68 px dans 112×96) ne les
  remplit pas ⇒ un toucher sur une PHOTO de la pile ouvrait la photo en grand (« ça zoome ») et
  Ventes ne s'ouvrait pas. Seul un toucher dans le vide autour des photos menait à Ventes
  (c'est pourquoi `journee-v2`, qui clique au centre du bouton, restait vert).
- **Ventes, le détail d'une vente** (`.vrm-recap-photo`, et `LigneVente` des autres sites) :
  `PhotoArticleAgrandissable` posait une **loupe** (icône `search` en coin, curseur `zoom-in`) et
  ouvrait un **second panneau** à lui (`.vrm-photo-viewer/.vrm-photo-panel`, une seule photo, pas
  de balayage). Sur la LIGNE de la liste, la photo ouvrait déjà la visionneuse globale, mais avec le
  curseur loupe au survol (règle `.vrm-main img[data-vrm-vignette] { cursor: zoom-in }`).

## Ce qui change
- Pile de Ma journée : `data-sans-visionneuse` sur le bouton (la porte prévue par
  `vignetteTouchee`) ⇒ tout toucher sur la pile, photo comprise, ouvre Ventes. Bouton nommé
  (« Voir les ventes (2 ventes) »), Entrée au clavier. Ventes n'a pas de filtre par jour : la pile
  mène à Ventes (liste au plus récent d'abord) sans filtre neuf — rester minimal à côté du lot DJ3.
- `PhotoArticleAgrandissable` (App.jsx) : plus de panneau ni de loupe ; un bouton « Voir la photo
  de … en grand » qui appelle `ouvrirVisionneuse(galerieDe(…), index, { titre, article })` — LA
  visionneuse de l'app, avec les autres photos de l'article rangées par FICHIER (`galerieDe`,
  jamais un titre) ⇒ balayer / flèches. La visionneuse reçoit `article` et le pose sur
  `data-stream-article` (le mode stream double le flou d'une photo en grand et ne dit pas la marque
  — garantie autrefois portée par `.vrm-photo-panel`).
- CSS : `.vrm-photo-open` curseur `pointer`, icône de coin retirée, styles du panneau retirés
  (`styles-mineral.css`) ; pas de curseur loupe sur les photos de Ventes, du détail, ni de la pile
  (`styles-achats-photos.css`). La visionneuse garde son propre curseur de zoom (pincer, double toucher).

## Gestes comptés
| | avant | après |
|---|---|---|
| Ma journée → Ventes depuis une photo de la pile | 1 toucher ouvre la photo, 1 pour fermer, puis viser le vide autour ou la barre : 3 | **1** |
| Ventes → photo du détail en grand | 1 toucher, mais via la loupe et un panneau à part, 1 seule photo | **1**, visionneuse unique, toutes les photos de l'article |
| Ventes → photo de la ligne en grand | 1 (curseur loupe au survol) | 1, sans loupe |

## Preuves
- `npm run build` vert ; audits `variables, tdz, coherence, identite, icones, textes-courts,
  fonctions-api, secrets, csp, visionneuse, stream-photos` verts. `audit-photos-vinted` est ROUGE
  sur `main` comme ici (9 `<img>` d'autres écrans — ATrancher, ModeRelais, Visionneuse…, aucune de
  ce lot) : non touché.
- Banc neuf `scripts/bancs/clics-directs.cjs` (390 tactile et 1512, clair et sombre, vrais
  touchers / clics, balayage tactile CDP) : **80 OK** ici ; sur l'arbre de `main` (`git archive`) :
  **30 rouges** (pile ⇒ visionneuse au lieu de Ventes ; détail : loupe, ancien panneau, 1 photo,
  pas d'article). Mutation : `data-sans-visionneuse` retiré ⇒ rouge. Captures regardées.
- `audit-stream-photos` 4.9 porté (la visionneuse dit l'article) ; `stream-photos` partie C portée
  vers la visionneuse : vert (flou doublé, marque jamais dite). `journee-v2` vert.
- `revendeurs.cjs` porté (nom du bouton, visionneuse), mais ce banc est **déjà rouge sur `main`**
  à sa ligne 187 (`.vrm-platform-summary` absent), avant d'atteindre la partie photo : la partie
  portée n'a donc pas pu s'exécuter.

## Geste de Julien
Aucun.
