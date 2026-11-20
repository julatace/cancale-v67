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

Machine partagée très chargée (charge 15 à 27 sur 4 cœurs pendant la passe finale) : les temps de l'après varient d'une
passe à l'autre (une passe plus calme : ouverture 0,68 à 1,14 s, toucher 0,14 à 0,30 s). AVANT : une passe ; APRÈS : la passe
finale (build `b9dd…`+, mention posée après la première image). Relevés : `iphone-rapide` `JSON=` (hors dépôt).

**Ouverture de l'app sur l'onglet** (page neuve, service worker, de la navigation au premier contenu) :

| onglet | avant clair | avant sombre | après clair | après sombre | ce qui s'affiche après |
|---|---|---|---|---|---|
| Aujourd'hui | 3 477 ms (ancien instantané) | 3 535 | 1 348 | 1 413 | la coque copiée, avant l'app |
| Annonces | 7 392 | 6 371 | 1 357 | 1 584 | idem |
| Ventes | 3 663 (ancien instantané) | 5 166 | 1 152 | 946 | idem |
| Achats | 11 603 | 11 146 | 1 605 | 740 | idem |
| Argent | 5 411 | 6 818 | 1 388 | 1 602 | idem |
| Messages | 6 000 | 7 174 | 1 437 | 1 471 | idem |

**Premier toucher de l'onglet** (page neuve sur Aujourd'hui, calme, puis le toucher ; clair) :

| onglet | avant | après |
|---|---|---|
| Aujourd'hui | 1 480 ms | 534 ms |
| Annonces | 3 141 | 393 |
| Ventes | 2 234 | 288 |
| Achats | 3 728 | 394 |
| Argent | 1 053 | 219 |
| Messages | 1 237 | 185 |

Objectif < 1 s : **tenu au toucher partout** ; **à l'ouverture, 0,7 à 1,6 s** sous cette charge (0,68 à 1,14 s sur une passe
plus calme) — la borne est le chargement de la page elle-même (index.html, le fichier d'entrée, la feuille de l'app, la base
IndexedDB : marque `vrm:apercu-copie` vers 0,9 s), plus le JavaScript de l'app. Avant : rien de lisible avant 3,5 à 11,6 s.

Planche 0 / 300 ms / 1 s / 3 s, avant/après, clair et sombre (hors dépôt : données inventées mais captures lourdes) :
`/tmp/claude-0/…/scratchpad/instantane/planche/planche-{clair,sombre}.png` et une planche par onglet
`{clair,sombre}-{journee,annonces,ventes,achats,compta,messages}.png`. Avant : le logo jusqu'à 1 s, puis squelettes à carte
sombre (Annonces, Achats, Argent) ou rien ; après : la copie dès 300 ms, identique à l'écran vrai qui la remplace.

## 4. Preuves

- `node scripts/bancs/copie-ecran.cjs <dist>` — **19 verts** sur cette branche ; **11 rouges sur le code d'avant** (aucune
  copie) ; mutation `VRM_COPIE_MUTATION=compte` ⇒ **rouge** (B voit la copie de A sur Annonces et Ventes) ; mutation `panne`
  ⇒ **rouge** (la copie n'est plus gardée sur une lecture ratée). A : lectures tenues, 3 rangées touchées + Entrée,
  **0 requête d'écriture** (la vérification d'appareil de la session, `mode=appareils` `verifier`, part à chaque ouverture,
  copie ou pas : comptée à part), aucune fiche ouverte, HTML sans `on*`/`href`/`id`/script, inerte, daté, puis remplacé.
- `node scripts/tests/copie-ecran.test.mjs` — 14 verts ; `--prouve` (mutation « compte ») ⇒ 5 rouges.
- `chiffres-volume` (1512) avant/après, passes rapprochées : **tous les montants et comptes identiques** ; restent l'ordre de
  deux attributs (aussi vu entre deux passes du MÊME build d'avant) et le drapeau `data-attente-instantane=1` (la copie a été
  montrée). La prévision du mois (8 700 / 8 800 €) varie aussi entre deux passes du même build sous charge.
- Audits : `audit-tdz`, `audit-variables`, `audit-traduction` (45 verts), `audit-quoi-de-neuf`, `audit-demarrage` (30 verts)
  verts ; `audit-poids-demarrage` : **1 989 Ko** (avant 1 983 Ko ; budget 2 008 Ko) ; tests `ouverture-instantanee` (11) et
  `journee-instantanee` (6) verts.

## 5. Ce qui reste

- **Les fiches** : la fiche d'un article (VRM natif) s'ouvre depuis l'article déjà en mémoire (aucune lecture) — pas de copie
  propre ; la fiche « Tout sur le N° » (`FichePaire`) garde son attente. Non fait dans ce lot.
- La coque copiée est peinte à la même largeur et dans le même thème que la capture ; une rotation, un autre thème ⇒ l'ouverture
  d'avant (puis la copie dans l'app). Un bandeau passager (fraîcheur, photos) qui apparaît APRÈS la copie la pousse d'autant.
- Les chiffres d'Argent et d'Aujourd'hui d'une copie sont ceux de la dernière visite DU JOUR (jamais d'un autre jour), datés.

## 6. Fusion de `origin/main` (Ventes en tableau #1279, vitesse #1280)

Vrai merge ; conflits réglés en gardant les deux intentions (banc `iphone-rapide` : `SESSION=1` de lectures-legeres + routes
d'abonnement de l'instantané ; README des bancs ; Quoi de neuf ; CLAUDE.md §9, deux plus vieilles lignes déplacées telles
quelles dans `historique-divers.md`). Après la fusion :
- les `id` sont GARDÉS dans la copie (des feuilles visent `#vrm-achats-retirer-corps` : Achats se décalait de 16 px) et la
  copie est posée APRÈS l'écran vrai caché (`getElementById` rend l'écran vrai) — le banc le vérifie (« aucun id devant ») ;
- la mention cherche aussi une ligne de texte courte libre (Achats : « 8 avec code · 140 à vérifier ») ;
- copie Ventes en tableau (1512) et Achats (390) : identiques à l'écran vrai (mêmes positions mesurées).
Bancs : copie-ecran 20 verts (mutations compte et panne : rouges), ventes-tableau 180, natif-ventes 58, retraits-jamais-muet 12,
chiffres-volume contre `origin/main` : 34 identiques, 1 différence = le drapeau `data-attente-instantane=1` ; poids 1 992 Ko.
