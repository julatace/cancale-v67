# 11 nov. 2026 — Visuels pour les réseaux sociaux (lot visuels-reseaux)

Demande validée par Julien : **des visuels pour les réseaux sociaux en un geste**.

## Ce que ça fait

- **Une annonce** : Annonces → « … » sur la fiche → **Visuel réseaux**.
- **Plusieurs** : Annonces → Sélectionner → coche → Actions → **Nouveautés de la semaine**
  (un lien sous les tuiles, comme « Prix mini… » ; plusieurs comptes permis : rien ne part
  chez Vinted). 4 annonces par image carrée, 6 par story, 24 au plus (dit au-delà).
- La feuille dessine **dans le navigateur** (canvas, police du système, aucune IA, aucun
  serveur) une image **carrée 1080 × 1080** ou une **story 1080 × 1920** : photo(s), prix,
  taille, marque, état, et le **nom de SA boutique** (champ de la feuille, vide par défaut,
  rangé avec le format, le modèle et la couleur dans `vrm_visuels_reglages`, SYNC_KEYS).
- **3 modèles** sobres (DA Apple) : Épuré (blanc, la photo en grand, le prix en accent ;
  en story, deux petites photos de plus quand la galerie les a), Plein cadre (photo bord à
  bord, dégradé, prix en pastille), Carte (fond gris, carte blanche). **5 couleurs** d'accent :
  bleu Apple, encre, vert, orange, rose (le violet est refusé, §3 Palette).
- **Partager** : le menu de partage du téléphone avec les fichiers PNG (`navigator.share`
  + `canShare({files})`) ; sans partage de fichiers (ordinateur), le bouton n'est pas là et
  **Télécharger** enregistre `vrm-carre.png` / `vrm-story-2.png`… **Rien n'est publié
  automatiquement.**

## Les photos (CORS)

Une photo Vinted affichée par un `<img>` natif souillerait le canvas (le CDN n'envoie pas
de CORS). `lirePhotoVisuel` (App.jsx) passe par le chemin des photos de l'app : la route
photo de VRM (`photoViaServeur`, `data:`), puis la copie déjà rapatriée par l'extension
(`photosVinted.blobDe`), puis l'extension (`vmrPhotoIssue`). Une autre photo (https) : lue
en CORS, sinon pas lisible. **Une photo pas lisible n'est jamais une image vide** : l'article
sort du visuel et la feuille le dit (« Photo pas lisible : « … ». Pas dans le visuel. ») ;
aucune photo lisible ⇒ aucune image, la raison, « Réessayer ». Le dessin refuse un plan
dont une photo manque (`dessinerVisuel` rend `false`), et un `toBlob` refusé (canvas
souillé) est dit « Le navigateur a refusé une photo ».

Prix : euros seulement (§3), jamais converti ; pas su ⇒ pas de prix sur l'image, dit.
Jamais sur l'image ni dans l'article : le N°, le prix d'achat, le compte, le pseudo
(`articleVisuel` ne les recopie pas).

## Fichiers

`src/visuelsReseaux.js` (la règle pure : réglages, prix, article, pages, plan, dessin) ·
`src/composants/VisuelsReseaux.jsx` + `visuels-reseaux.css` (la feuille, morceau à la
demande) · `src/App.jsx` (`lirePhotoVisuel`, bouton de la fiche, lien de la feuille
Actions, écouteur `vrm:visuels`, SYNC_KEYS) · `src/annoncesActions.js` (action `visuels`) ·
`src/i18n/langues/*.js` (clés `visuels.*`, 5 langues) · `src/nouveautes.js`.

## Preuves

- `node scripts/audit-visuels-reseaux.cjs` (26 contrôles, exécute la règle) ;
  `--prouve` : 6 mutations (autre devise convertie, article sans photo lue gardé, tout
  recopié dans l'article, dessin troué accepté, photo Vinted rendue telle quelle au canvas,
  boutique ignorée) ⇒ toutes ROUGES.
- `scripts/audit-annonces-actions.cjs` mis à jour (B18 : `visuels` et `mini` seuls
  ignorent le compte ; B24 : possible sur deux comptes).
- `scripts/bancs/visuels-reseaux.cjs` : le vrai écran Annonces, données et photos
  INVENTÉES (dessinées par le banc), 390 tactile et 1512 ; PNG générés rangés par
  `BANC_CAPTURE` et regardés.

## ÉTAT À LA REPRISE

Voir la fin du fichier (mis à jour à chaque étape).
