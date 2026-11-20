# 20 nov. — l'affichage instantané (branche `claude/instantane`)

Julien (20 nov.) : l'app est « trop longue à charger », les écrans de chargement sont « atroces, ça fait vraiment appli de
merde ». Ses captures iPhone : Annonces en squelette gris géant sous « Actions », Ventes avec des vignettes grises dures,
Achats vide sous « À retirer · 18 ». Partie de `origin/claude/integration-5410` + un vrai merge de `origin/claude/iphone-rapide`
(son banc, la barre bleue retirée).

## 1. Ce qui change pour lui

- **Chaque onglet s'ouvre sur SA dernière copie** — Aujourd'hui, Annonces, Ventes, Achats, Argent, Messages : la dernière
  liste que l'écran a affichée sur cet appareil, à la même place, datée (« Mis à jour il y a 3 min », gris, petite roue de
  14 px tant que la relecture court), puis l'écran vrai prend sa place sans saut. À l'ouverture de l'app, la copie est peinte
  AVANT que l'app soit chargée (dans l'écran de démarrage), barre du haut et barre d'onglets comprises.
- **Une copie ne sert qu'à voir** : inerte (aucun toucher, aucun focus), rien ne la relit pour un N°, un prix, un envoi.
- **Base injoignable** : la copie reste, « Pas à jour · Réessayer » (jamais un écran vide, jamais présentée comme fraîche).
  Hors ligne, rien ne change : l'écran vrai se lit sur l'appareil (lot K) et ses gestes hors ligne restent possibles.
- **Premier lancement (aucune copie)** : squelettes natifs aux vraies hauteurs de rangée (72 / 56 / 44), très pâles (≤ 6 %,
  `--n-squelette`), un reflet doux coupé par « réduire les animations » ; plus de carte sombre géante ; aucun bouton d'action
  au-dessus d'un squelette (Annonces : ni « Publier », ni « ⋯ » tant que la liste n'est pas lue).
- **Vignettes** : fond neutre doux, photo en fondu à son arrivée (déjà en cache : sans fondu), `loading=lazy`,
  `decoding=async`, taille fixée ; sans photo, l'icône s'efface (plus de bloc gris dur).

## 2. Comment c'est fait

| pièce | rôle |
|---|---|
| `src/copieEcran.js` | la règle : capture (DOM de l'écran PRÊT, coupé à 2 hauteurs d'écran, NETTOYÉ par liste blanche : aucun script, lien, `on*`, `id`, `href` ; images `https:` ou `data:` ≤ 40 Ko), index des rangées (id, titre, photo, N°, prix, statut), stockage IndexedDB `vrm-copies-ecrans` clé `vrm_copie_{owner}_{ecran}`, `SCHEMA_COPIE`, owner dans la clé ET la valeur, un seul compte sur l'appareil, `effacerCopiesEcrans` (appelé par `wipeLocalData` et la fin de session), index synchrone `vrm_copie_index:{owner}` (localStorage, `vrm_`). Montrable seulement le JOUR de sa capture, à la même largeur. |
| `src/CopieEcran.jsx` | `VueCopie` (dans l'app : son conteneur EST `vrm-attente-pret`, même arborescence que l'écran vrai) et `CoqueCopie` (avant l'app) ; la mention se pose sur une ligne d'en-tête libre (grand titre, en-tête de groupe), jamais sur un bouton ni un texte. Classes `vrm-ce-*` (`.vrm-copie` existait déjà : bouton « copier », il donnait padding et rayon 999 px). |
| `src/AttenteEcran.jsx` | la copie à la place du squelette ; **l'écran vrai n'est monté qu'à l'image suivante** quand une copie est montrée (son premier rendu coûte 1 à 4 s au ×4 : le toucher d'un onglet montre la copie tout de suite) ; `garderInstantane` (base injoignable). |
| `src/App.jsx` | `CaptureCopie` (écran prêt, au repos, 1,5 s après le dernier changement ; jamais hors ligne, base injoignable, page cachée, fenêtre changée) ; `prechargerCopies` au montage de la coque ; `copieIci` / `copieEnPanne`. |
| `src/ouvertureInstantanee.js`, `src/OuvertureInstantanee.jsx`, `src/main.jsx`, `src/demarrage.js` | avant l'app : la même porte que l'instantané de Ma journée (session, double vérification, laissez-passer de 7 jours, abonnement, boutique propre) + l'écran qui va s'ouvrir (`?tab=` ou reprise) + une copie du jour, même largeur, même thème ⇒ la coque copiée peinte (400 ms au plus pour la lire) ; l'écran de démarrage la garde devant tant que la coque de l'app montre un AUTRE écran (8 s au plus). |
| `src/Squelette.jsx`, `src/natif/natif.css`, `src/natif/jetons.css`, `src/natif/Rangee.jsx` | squelettes natifs pâles, reflet, vignettes en fondu. |

Mutation des bancs : `VRM_COPIE_MUTATION=compte|panne` au build (`vite.config.js` `define`, vide en production).

## 3. Mesures (banc `iphone-rapide`, `ETAPES=instantane`, profil de Julien : 390 × 844 @3 tactile, CPU ×4, 4G 1,6 Mbit/s, service worker, base de volume)

« Premier contenu réel » = une rangée ou un chiffre de l'écran visé visible dans le premier écran (copie ou écran vrai,
`contenuVisible`), jamais un squelette. AVANT = `723d8f55b` (integration-5410 + iphone-rapide), APRÈS = cette branche.

MESURES_ICI

## 4. Preuves

PREUVES_ICI

## 5. Ce qui reste

- **Les fiches** : la fiche d'un article (VRM natif) s'ouvre depuis l'article déjà en mémoire (aucune lecture) — pas de copie
  propre ; la fiche « Tout sur le N° » (`FichePaire`) garde son attente. Non fait dans ce lot.
- La coque copiée est peinte à la même largeur et dans le même thème que la capture ; une rotation, un autre thème ⇒ l'ouverture
  d'avant (puis la copie dans l'app). Un bandeau passager (fraîcheur, photos) qui apparaît APRÈS la copie la pousse d'autant.
- Les chiffres d'Argent et d'Aujourd'hui d'une copie sont ceux de la dernière visite DU JOUR (jamais d'un autre jour), datés.
