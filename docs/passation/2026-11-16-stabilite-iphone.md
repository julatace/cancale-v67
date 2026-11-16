# 16 nov. 2026 — Stabilité sur iPhone (lot `stabilite-iphone`)

Julien, sur son iPhone, version en ligne du 16 au matin (après #1178 « Verre dépoli partout », #1179, #1180) :
« l'app bug un peu », puis « l'app bug énormément », « lent quand les données s'affichent, c'est pas fluide »,
et deux captures (Ventes · eBay → À traiter ; Argent). Branche `claude/stabilite-iphone`.

## Ce que disent SES mesures (lecture seule, `app_data` `mesures_jour_2026-11-1x`)
Cases de `src/mesuresTerrain.js` (`BORNES_MS`, case i = ]borne i-1 ; borne i]). « Réponse au toucher » (INP,
l'interaction la plus lente d'une visite), **Ventes · téléphone** :

| jour | touchers | ≤ 150 ms | 150–650 ms | > 650 ms | pire case |
|---|---|---|---|---|---|
| 14 nov. | 20 | 5 | 14 | 1 | 800–1 000 ms |
| 15 nov. | 20 | 11 | 9 | 0 | 500–650 ms |
| **16 nov.** (après #1178–#1180) | **9** | 1 | 1 | **7** | **3 000–4 000 ms** |

Le 16 : 1 toucher à 1,25–1,5 s, 3 à 1,5–2 s, 2 à 2,5–3 s, 1 à 3–4 s. Ma journée, Annonces, Stock restent ≤ 100 ms
pour la plupart (Ma journée 16 nov. : 5 ≤ 50 ms, 2 ≤ 100 ms). Achats : un toucher à 800 ms–1 s. Aucun plantage JS.
⇒ la régression est **concentrée sur Ventes**, et elle date des mises en ligne du 16.

## Défauts trouvés · cause · correction · preuve
| défaut | écran | cause | correction | preuve |
|---|---|---|---|---|
| Touchers de 1,25 à 4 s | Ventes | `backdrop-filter: blur(24px) saturate(175%)` sur les LISTES entières (À envoyer : 358 × 3 067 px mesurés ; Toutes les ventes : une rangée par vente) et `blur(18px)` sur le segment — sous WebKit un flou se recalcule sur toute sa surface à chaque image et à chaque rendu de la liste ; posé sur le fond fixe en dégradé du verre (#1178), il couvre plusieurs écrans de haut | le flou retiré de ces trois éléments seulement (`studio-verre.css` §12 bis) ; leur verre (couleur, bord, ombre) reste ; il reste là où le contenu passe dessous (barre du bas, tête au défilement, pastille, filtres collés d'Achats, ronds de la tête) | inventaire des flous par écran (banc S9 `flous`) ; captures avec / sans sur la même page (`_comparer-captures.cjs flou`) — voir « Le même aspect » ; la preuve terrain viendra de `mesures_jour_2026-11-17` |
| Libellés de la barre du bas à 1,4:1 (« Aujourd'hui », « Annonces », « Argent » presque invisibles) | toutes | la barre est un contexte d'empilement (relative, z-index 60) : son fondu `::before` (z-index -1) se peint AU-DESSUS de son propre fond ; sur le bleu profond, il recouvrait le verre clair (barre ≈ rgb 75 100 130 mesurée sur la capture) | le verre est peint par `::after` (même couche, après le fondu) : la barre redevient claire | S10 (pixels de la capture) : 1,39–1,4:1 sur main ⇒ vert après |
| Sections eBay posées sur le bleu, encre sombre (1,2 à 1,7:1) | Ventes · eBay → À traiter, Offres, Commandes (guides), Annonces · eBay (Promotion, « Aucun brouillon ») | ces écrans sont dessinés pour une surface claire (`EBAY_SKIN`, couleurs en ligne) et n'avaient pas de carte | une carte de verre (même verre, rayon 22, ombre) derrière les panneaux À traiter / Offres / Promotion (`vrm-ebay-panneau`), les guides « Comment faire ? » des commandes et « Aucun brouillon » | S3 (styles recomposés sur le fond réel) et S10 (pixels) rouges sur main : « Retours et annulations » 1,71, « Annulations : » 1,27, « Tâches à traiter » 1,48, « Pas lu » 1,81… |
| « au moins 1 062 € » puis « au moins » une 2e fois | Argent · Reçu | la note de la case (`raisonCourte` ⇒ « au moins ») répétait le minimum déjà dit par le montant | `src/argent.js` : le minimum se dit une fois, sur le montant (`partiel`), la note retombe sur « au versement » | `audit-argent` vert |
| « URSSAF · à déclarer pour octob… » coupé à 390 px | Argent | le titre en `nowrap` + points de suspension à côté de l'échéance | le titre passe à la ligne, l'échéance garde sa colonne | capture 390 |

## L'arrivée des données (Julien : « lent quand les données s'affichent, c'est pas fluide »)
Profil CPU de l'ouverture de Ventes · Vinted (main 5a9abe571, base inventée de 1 000 paires, Chromium, 20 s) —
temps PROPRE des fonctions de l'app : `ajusterChiffre` (le grand chiffre qui tient dans sa place) **2,9 s**,
`rangeesDefilantes` (le fondu des rangées qui défilent) **1,5 s**, la préparation des achats de
`propositionsArticle` (la proposition d'achat sur CHAQUE vente sans achat relié, ajoutée le 15 nov.) **1,3 s sur
1,5 s**. Les deux premières ne coûtent pas par elles-mêmes : elles FORCENT la mise en page de tout l'écran
(≈ 6 900 nœuds sur Ventes, dont ~90 rangées) — et l'écrivaient entre deux lectures.

| cause | correction | preuve |
|---|---|---|
| `propositionsArticle` re-préparait tous les achats à chaque appel (une fois par vente sans achat, à chaque rendu) | préparation gardée par achat (même objet, mêmes champs, mêmes règles ; la réception relue à chaque appel) | `audit-arrivee-sans-gel` L1–L3 : 2e appel 301 → 1 lecture de marque, résultat identique ; rouge sur main |
| rangées : lire une rangée, l'écrire, lire la suivante… (une mise en page complète par rangée) | toutes les mesures, puis toutes les marques | R1 (ordre exécuté) ; rouge sur main |
| grand chiffre : retirait ses styles puis relisait style calculé et largeur à CHAQUE valeur | rien n'est écrit quand il tient et n'a jamais été ajusté | C1 (0 écriture, 0 style relu) ; C2 trop long toujours ajusté ; rouge sur main |
| ~90 rangées toutes mises en page et peintes à chaque vague de données | `content-visibility: auto` sur les rangées de Ventes au téléphone (hauteur retenue) | recalcul complet de l'écran **934 → 248 ms** (même page, injecté) ; même rendu en haut de liste (écart 0,04–0,17 / 255) |
| « À venir » arrivait en poussant la liste de ~124 px (Ventes · Vinted, Ma journée) | sa place gardée pendant la lecture (`reserve`, comme sur Ventes · Tous) | capture « avec / sans » de Ventes · Toutes (la carte apparue entre deux prises) |

`audit-arrivee-sans-gel.cjs --prouve` : 3/3 mutations rouges. Outils : `_mesure-arrivee.cjs` (vagues de rendu,
longues tâches, CLS à l'ouverture), profil CPU (récit de la commande dans « Comment refaire »).

## Comment refaire
- Profil : `scripts/bancs/_mesure-arrivee.cjs <dist>` ; captures : `_comparer-captures.cjs flou <dist>` (avec
  `STYLE_SANS='…'` pour juger une autre règle sur la même page) ; toucher : `_mesure-toucher.cjs <dist>`.

## Le banc `scripts/bancs/stabilite-iphone.cjs`
Appareil « iPhone 15 » (viewport, agent iOS, tactile), clair et sombre, base inventée (1 000 paires, 1 000
conversations, 1 000 e-mails + un compte eBay présent sans données). Chaque écran (Ma journée, Annonces et ses
sites, Ventes et ses sites, Ventes · eBay et CHAQUE sous-onglet, Achats, Stock, Argent, Messages, Paramètres,
loupe, cloche, fiche N°, disque « + », menu) et chaque sous-onglet touché : S1 erreurs JS · S2 garde-fou ·
S3 contraste sur le fond réel (la mesure de `verre.cjs`) · S4 débordement · S5 barres fixes qui se chevauchent ·
S6 rien sous la barre du bas tout en bas · S7 cible amenée au centre touchable · S8 défilement pas bloqué ·
S9 longues tâches au calme et au défilement (longtask sous Chromium, trou entre images sous WebKit), défilement
avec et sans le verre rapporté · **S10 contraste lu sur les PIXELS de la capture** (ce que l'œil voit : un
pseudo-élément, un flou, une superposition que la recomposition des styles ne voit pas — c'est lui qui a vu la
barre du bas). `NAVIGATEUR=webkit` le lance sous WebKit (CI : job « Bancs sous WebKit »).

Outils : `_mesure-toucher.cjs` (réponse au toucher et longues tâches à l'ouverture, CPU ralenti),
`_comparer-captures.cjs` (captures et écart pixel à pixel ; mode `flou` : même page, avec / sans le flou).

## Le même aspect (Julien : « J'aime bien le fond justement »)
Le fond (dégradé, reflets) n'est pas touché. Les cartes gardent leur verre, leurs bords, leurs ombres. Le flou ne
part que de trois éléments posés sur le dégradé (où il ne se voit pas) ; mesures « avec / sans » ci-dessous.

## Mesures en conteneur (à lire avec prudence)
Le conteneur de travail tournait à une charge de 50 à 90 sur 4 cœurs (plusieurs lots en parallèle) : les durées
absolues n'ont pas de sens, seules les comparaisons dans un même passage en ont. Chromium (CPU ×2), base inventée,
réponse au toucher la plus lente sur Ventes (onglets En route / À envoyer / Toutes) : build d'avant #1178 9,3 s,
main 4,0 s, main sans aucun flou 20,1 s — le bruit domine ; le coût JS d'un changement d'onglet de Ventes est de
plusieurs secondes à CPU ×2 dans TOUS les builds (voir « Ce qui reste »). Le rendu du flou par le compositeur
d'iOS n'est pas reproduit par Chromium logiciel : la preuve du gain viendra des mesures de son iPhone.

## Ce qui reste
- **WebKit** : ce conteneur ne peut pas télécharger WebKit (cdn.playwright.dev refusé) ; le banc tourne sous
  WebKit dans la CI (ajouté au job « Bancs sous WebKit »).
- **Le coût JS de Ventes** (changement d'onglet, arrivée des données) : plusieurs secondes à CPU ×2 en Chromium, dans
  tous les builds. À instrumenter (nombre de rendus par vague de données, clés, virtualisation de « Toutes ») ;
  coordination avec `vitesse-volume` et `vitesse-lectures`.
- Le « 999+ » du sélecteur de sites à 4,03:1 sur la pastille claire ; « Novembre · Vinted » de la carte d'action
  de Ventes · Vinted (blanc 66 %) à 3,23:1 — rapportés par S3, pas encore corrigés.

## ÉTAT À LA REPRISE
Branche `claude/stabilite-iphone`. À relire le lendemain : `mesures_jour_2026-11-17` (Ventes · téléphone · inp).
