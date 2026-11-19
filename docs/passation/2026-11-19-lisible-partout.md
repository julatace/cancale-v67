# 19 nov. — Lisible partout, puis « VRM natif » : un seul style pour les anciens écrans (branche `claude/lisible-partout`)

## 1. D'où l'on part

Julien, 19 nov. au matin : « sur l'app en mobile c'est pas fou du tout, même sur ordi là c'est une catastrophe,
l'ergonomie est atroce ». Cause mesurée : le 18 nov. au soir, les feuilles `src/designV2/interface/vrm-*.css`
(habillage par défaut « VRM ») ont posé un fond CLAIR sous des écrans dont les textes étaient écrits en BLANC pour le
bleu nuit du « Verre dépoli » (`color: #FFFFFF`, jetons `--v2-page-*`, `--sv-clair-*`). Aucun banc n'ouvrait tous les
écrans dans tous les habillages : personne ne l'a vu avant lui.

Puis, le même jour : « la mise en page est catastrophique, revois absolument tout […] je veux quelque chose de
drastique, nouveau, totalement différent ». Décision : UN SEUL design, « VRM natif » (`docs/design/NATIF.md`), et les
autres habillages disparaissent. Ce lot est passé de « corriger les habillages un par un » à :

1. **le style unique des anciens écrans** — tout écran pas encore réécrit avec les composants de `src/natif/` est au
   moins dans les couleurs, la typo, les rayons et les fonds du natif, lisible, sans dégradé bleu ni verre ;
2. **la suppression des couches devenues inutiles**, par étapes prouvées ;
3. **le filet** : le banc `lisible-partout`.

La coque (barre d'onglets, barre de titre, rail), Aujourd'hui, Ventes et la fiche d'un article sont réécrits par
d'autres agents : rien n'y a été poli ici, on a seulement vérifié que les suppressions ne les cassent pas.

## 2. Le banc `scripts/bancs/lisible-partout.cjs`

Il ouvre CHAQUE écran et sous-écran joignable — Aujourd'hui (et Ma semaine, À trancher), Annonces (listes A et C, Qui
dorment, À publier, « ⋯ », sélection, la feuille des plateformes, Republier, Leboncoin, eBay, Vestiaire), Ventes
(3 onglets, litiges), Achats (à retirer et son détail, en route, tous, « Plus », plateformes, factures), Stock
(et Organisation), Messages (liste, conversation, offre, non lues, favoris), E-mails (liste, un e-mail ouvert, Colis),
Argent (mois, statistiques, déclarer, factures, à venir, prix du marché, masqués), Paramètres (le premier écran,
« Tout va bien ? », Sécurité des données, **chaque catégorie et chaque sous-page, lues dans la page** : une rangée
ajoutée demain est ouverte demain), Communauté (et parrainage), la cloche, la loupe (un mot, un N°), le profil, l'état
de l'extension, l'aide, la fiche d'un article, la connexion et l'inscription (sans session) — à 390 × 844 tactile,
1512 et 1280, clair et sombre, sur la base de volume (1 000 paires, 1 000 conversations, 1 000 e-mails, 3 comptes,
colis au point relais) ET sur une base VIDE (`BASES=volume,vide`). Données inventées, garde réseau.

Ce qu'il mesure, sur l'app rendue :

| | règle | comment |
|---|---|---|
| C | contraste ≥ 4,5:1 (3:1 en grand) | le texte est rendu transparent, une capture, on lit les **pixels** sous chaque ligne (translucides, dégradés, `::before`, photos compris) ; le pire des deux bouts du fond (20e et 80e centile) fait foi |
| I | icône seule ≥ 3:1 | deux captures (avec, sans) : les pixels de l'icône ; une icône qui ne dessine rien est dite |
| V | aucun contrôle vide | une boîte dessinée, rien dedans |
| G | aucun dégradé bleu | fond, `::before` de la coque, surface > 40 × 40 (repris de `theme-apple`, retiré) |
| F | aucun flou dans le contenu | `backdrop-filter` hors barre d'onglets et barre de titre (contrat §1) |
| D | aucun débordement horizontal | page, contenu, élément hors de l'écran |
| T | aucun texte coupé | rogné par son cadre (hors « … » d'une rangée et `line-clamp`) |
| B | rien sous la barre du bas | en bas de page, au téléphone |
| Z | cibles ≥ 44 × 44 | zone étendue `::before/::after` comptée ; lien dans une phrase exempté |

Il **rapporte** (il ne meurt pas) : une ligne par défaut dans `rapport.txt` (écran, habillage, largeur, thème, règle,
sélecteur, texte, couleurs, ratio), `rapport.json`, une capture par état. Un état qui ne répond plus est dit « pas
joignable » après 75 s et la page est rouverte (le premier inventaire s'était figé 15 minutes sur une sous-page).
Ce que d'autres agents réécrivent est LISTÉ à part, jamais compté dans le verdict (`HORS=aucun` les compte tous).
`HABILLAGES=vrm,apple,ancien` + `BANC_DIST=<dist d'avant>` jugent encore un arbre d'avant.

Preuve par mutation : `MUTATION=blanc` remet un blanc en dur sur les titres de la page ⇒ C rouge (voir §6).

## 3. Ce qui a été fait

### 3.1 Le style unique : `src/natif/anciens-ecrans.css` (couche `n-anciens`, la première nommée)

C'est l'ancien style « Apple » (`src/designV2/theme-apple.css`, 18 nov.) devenu **inconditionnel** : plus aucun
`data-theme-style`. Les familles de jetons d'hier (`--sb-*` studio, `--sv-*` verre, `--v2-*`, `--d-*`, `--sbp-*`,
`--sj-*`, `--vv-*`, `--vj-*`) y lisent les jetons `--n-*` du contrat (`var(--n-fond, #F2F2F7)` : la valeur du contrat
en repli tant que `src/natif/jetons.css` de la fondation n'est pas fusionné — même nom, même valeur, rien à refaire
à la fusion). Importé une fois par `src/natif/anciens.js` (App.jsx), AVANT les feuilles du studio (`audit-studio` S3).

Corrigé **à la racine** (plus un blanc en dur) :
- `--v2-page-texte / -muet / -ambre` (design-v2.css) : l'encre du natif, jour et nuit (ils valaient `#FFFFFF`) ;
- les 28 jetons `--sv-*` : le bloc `:root` de studio-verre.css (dégradé, translucides, `--sv-clair: #FFFFFF`) est
  retiré, les noms valent ceux du natif ;
- le « ? » d'aide : le filtre `brightness(0) invert(1)` qui le forçait en blanc le jour est retiré (1,12:1) ;
- l'encre seconde des anciens écrans : 15 % d'encre en plus (`color-mix`), parce qu'ils la posent aussi sur des
  remplissages gris (champs, puces) où `--n-encre-2` tombait à 4,09:1.

Et ce que le banc a nommé, écran par écran (§19 de la feuille) : invite des champs, nombre d'un segment (blanc sur
le pouce blanc), « Cases · Places » du Stock (blanc sur clair), l'heure d'une bulle, le numéro d'une étape d'aide,
le bouton discret sur remplissage, les sites de la feuille « Plateformes » (30 px de haut), l'ombre du champ de
recherche.

### 3.2 Les couches supprimées

| quoi | état |
|---|---|
| `src/designV2/interface/vrm-interface.css`, `vrm-composants.css`, `vrm-lecture.css`, `vrm-iphone.css` (2 603 lignes, habillage « VRM » du 18 nov.) et leurs 4 `<link>` d'index.html | **supprimés**. Vérifié sur ce qui reste (§4.11) : 14 classes n'étaient stylées QUE là et sont utilisées — leur disposition est gardée dans `src/natif/anciens-composants.css` (Leboncoin « choisir l'annonce Vinted », la photo et les pages de la passe de retrait), sans couleur en dur |
| `src/designV2/theme-apple.css` + `src/designV2/style.js` (réglage « Style ») | **supprimés** (la feuille est devenue le style unique) |
| le réglage « Ancien design » | **supprimé** de Paramètres ; un `vrm_design_v2 = '0'` rangé hier ne compte plus. `src/designV2/reglage.js` n'est plus un réglage (voir §5, l'échafaudage des bancs) |
| studio-verre.css §0 (jetons), §2 (le fond en dégradé, son `::before` fixe, les deux `html:has(.vrm-app-shell[data-espace])`), §4 (verre), §5 (flou), §6–7 ter (l'encre claire : ~40 jetons redéclarés sur ~60 conteneurs puis remis à l'encre sombre dans chaque surface) | **supprimés** : 780 → 491 lignes |
| l'écran de chargement d'index.html, `theme-color`, `public/demarrage-theme.js` | fond plat `--n-fond` (#F2F2F7 / #000000), barre de progression à l'accent, plus de dégradé ni de flou |
| couches d'index.html | `@layer n-anciens, vrm-v2, …` (plus de `vrm-interface`, plus de `vrm-apple`) |
| « Quoi de neuf » | les entrées « VRM adopte le design de l'aperçu » et « Essaie le style Apple » retirées ; « Un seul design, clair et lisible » |

**Pas supprimé, exprès** (§4.11 : ne pas retirer une disposition dont un écran ancien dépend) : le reste de
studio-verre.css (§3 porcelaine des feuilles, §7 quater connexion, §8 coque, §9–13 : ils mêlent disposition et
couleur) et les `verre-*.css` d'écran (dispositions des maquettes validées le 15 nov.). Leurs couleurs passent par
les jetons, que la couche `n-anciens` tient. Chacun part avec la réécriture de son écran en natif.

### 3.3 Les chiffres (pour l'agent de `claude/vite-et-sans-bug`)

| | origin/main (ed9399cb) | ce lot |
|---|---|---|
| CSS du build, total | 3 207 616 octets | 3 103 391 octets (−104 225, −3,2 %) |
| `:has(` dans le CSS du build | 602 | 544 (−58) |
| `!important` dans le CSS du build | 24 395 | 23 455 (−940) |
| blocs de règles | 22 995 | 22 631 (−364) |
| `:has()` ancrés sur `html` retirés | — | 2 (`html:has(.vrm-app-shell[data-espace])`, studio-verre §2) + ceux de l'habillage « VRM » |
| JavaScript + CSS du démarrage (gzip, `audit-poids-demarrage`) | 1 980 Ko | 1 968 Ko (−12 Ko) ; budget 1 982 → 1 970 |

## 4. L'inventaire, avant et après

Avant = le build d'`origin/main`, habillage « VRM » (celui que Julien avait sous les yeux), 390 et 1512, clair.
Après = ce lot, natif. Mêmes états, mêmes règles, même base. Défauts des écrans de CE lot · (ceux des écrans
réécrits par d'autres, listés à part).

‹TABLEAU›

## 5. Ce qui reste, et à qui

- **L'échafaudage des bancs** (`vrm_banc_dom_ancien`) : les branches `!designV2` des écrans (le DOM d'avant le
  17 nov.) vivent encore dans `src/App.jsx`, et ~180 bancs jugent des règles MÉTIER (numéros, colis, chiffres) sur ce
  DOM-là — `_garde-reseau.cjs` le leur donnait par `vrm_design_v2 = '0'`. Ce n'est plus un réglage : aucun écran ne
  l'écrit, un vendeur ne peut plus y revenir. Mais retirer ces branches d'un coup aurait rougi ces bancs en masse
  sans rien prouver. Chaque écran réécrit en natif retire SA branche et met SON banc à jour ; la clé part avec la
  dernière. (`_garde-reseau.cjs` traduit encore un `vrm_design_v2` posé par un banc.)
- **Les bancs qui figeaient les habillages** : `theme-apple.cjs` retiré (sa règle « aucun dégradé bleu » est dans
  `lisible-partout`) ; `verre.cjs` V1/V2 jugent désormais l'ABSENCE de dégradé et de verre (le module reste : cinq bancs
  lisent sa mesure de contraste) ; `design-v2.cjs` R juge l'absence des deux réglages. ‹BANCS›
- **Les pages publiques et hors coque** gardent du bleu en dégradé (pas à ce lot, à signaler à la fondation) :
  `src/accueil/accueil.css`, `src/partenaires/partenaires.css`, `src/design/studio-reste-public.css` (Tarifs),
  `src/composants/MettreAJourVRM.jsx`, `src/parcoursNouveau/parcours-nouveau.css`, `src/design/scanner-retrouver.css`,
  et les images `apple-touch-startup-image` (`public/demarrage/*.jpg`, encore bleues).
- **Clés de traduction orphelines** : `v2.style.*`, `v2.reglage.*` (5 langues) ne sont plus lues ; laissées (un autre
  agent édite ces fichiers), à retirer au passage.
- **Zone sûre de l'iPhone** : Chromium ne simule pas `env(safe-area-inset-*)` ; le banc juge 390 × 844 sans encoche.
  La barre d'onglets et sa marge sont à la fondation.

## 6. Preuves

‹PREUVES›
