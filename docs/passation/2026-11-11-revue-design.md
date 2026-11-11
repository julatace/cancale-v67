# Revue de design — 11 novembre 2026

**Demande de Julien** : « tout doit être beau, simple et pratique — ça ne doit pas être moche ».
Revue faite **sans toucher au code de l'app**. Les captures sont dans
`docs/revue-design-2026-11-11/` (166 écrans + e-mail d'essai + extension + démarrage),
à 390 px tactile et 1512 px, en clair et en sombre, sur une **base inventée**
(`scripts/bancs/_base-volume.cjs`, 3 comptes, aucune requête réelle, photos remplacées par
des vignettes SVG inventées). Pour les refaire :

```
npm run build && node scripts/bancs/revue-design-captures.cjs
# options : LARGEURS=390 THEMES=clair ECRANS=colis,ventes QUOI=ecrans,feuilles,public,neuf SORTIE=dossier
```

Nom des fichiers : `<écran>-<largeur>-<thème>.jpg`, et `-suite` pour l'écran défilé d'un cran.
Grilles utilisées : CLAUDE.md §7, DESIGN.md, PRODUCT.md, et les skills `impeccable`
(critique, mode *Operate*), `apple-design` (8 principes), `taste-skill/app-screens`,
`emil-design-eng`, `design-critique`, `mobile-native`.

⚠️ Artefacts du banc, **pas des défauts** : « Extension à installer » en haut à droite (le banc n'a
pas d'extension dans le navigateur), E-mails et Communauté « pas su » (les routes `/api` répondent
`{}`), « Nike achat 0 » (titres inventés), heures « 10:00 PM » (le Chromium du banc ; à
vérifier sur iPhone).

---

## Le diagnostic en une phrase

Les **pièces** sont bonnes (rangées de Réglages, tableau des Ventes sur ordinateur, carte sombre,
fenêtre de connexion), mais **chaque écran empile cinq étages avant le contenu** (barre d'état,
date, grand titre, phrase + « ? », plateformes, carte sombre, tuiles de chiffres, outils), le
**bleu se répète** sur chaque ligne au lieu d'être rare, et les **contrôles natifs** (cases,
listes déroulantes, heures) cassent le style Apple. Cause de fond : 136 feuilles CSS (1,7 Mo,
8 141 `!important`) qui se corrigent l'une l'autre — chaque écran a fini par avoir ses propres
tailles.

---

## Tableau priorisé

Effort : **S** < ½ journée d'agent · **M** ≈ 1 journée · **L** plusieurs jours.
Les valeurs renvoient aux jetons `--d-*` de `src/styles-design-2026.css`.

### P1 — moche ou gênant, à corriger d'abord

| # | Écran | Problème précis (capture) | Correction proposée | Effort |
|---|---|---|---|---|
| 1 | **Colis** (et la file « à envoyer » partout) | Un **rond bleu d'impression sur chaque carte** (8 ronds bleus visibles à la fois) : l'accent n'est plus rare, l'œil ne sait plus où est l'action. Même chose sur ordinateur, où la rangée s'étire sur 1 180 px. `colis-1512-clair-suite.jpg`, `colis-390-clair-suite.jpg` | Sur chaque ligne : bouton **secondaire** rond 36 px (`--d-remplir`, icône encre 16 px). Le seul bleu de l'écran = « Tout imprimer » en haut. Le libellé long « Imprimer le bordereau » (`vrm-lib-long`, `App.jsx` ~18170, 22390, 46789) ne s'écrit **jamais** sur une ligne de liste, seulement dans la feuille d'une vente. | S |
| 2 | **Colis** | « **Choisir la vente** » dans un **grand encadré ambre clair** (570 px de large sur ordinateur) sur CHAQUE carte, lien souligné 12 px dedans ; en sombre, l'encadré devient marron boueux. `colis-1512-clair-suite.jpg`, `colis-390-sombre-suite.jpg` | La règle « une même phrase sur chaque ligne = UNE phrase » : un en-tête de groupe « 27 colis sans vente reliée · Choisir » (une pilule), et sur la carte seulement un point ambre 7 px devant la note. Plus aucun fond `--d-ambre-fond` en aplat dans une liste. | S |
| 3 | **Colis** | **Quatre étages de contrôles avant le premier colis** : [scan][Tout imprimer][⋯] → carte sombre « 30 à envoyer » → 3 tuiles (15 / 0 / 60) → segmenté plateformes → segmenté À envoyer·30 / Envoyés / À retirer·60 → [Préparer mes colis][Je dépose] → « 27 à envoyer en priorité » → [Préparer la tournée de dépôt] ⓘ. Le premier colis arrive à 840 px sur ordinateur, hors écran au téléphone. 30 et 60 sont écrits deux fois (carte + segment). `colis-1512-clair.jpg`, `colis-390-clair.jpg` | Carte sombre **couchée** et basse (hauteur 120 px max, grand chiffre à gauche, les 3 chiffres comme cases DANS la carte, plus de tuiles dessous). Une rangée d'outils unique : segmenté (À envoyer · Envoyés · À retirer) + pilules « Préparer » et « Tournée » à droite, le « ⓘ » supprimé. « 27 en priorité » devient l'en-tête du premier groupe. Objectif : premier colis visible sous 420 px (ordinateur) et 560 px (téléphone). | M |
| 4 | **Feuille « Tout imprimer »** | La feuille la plus utilisée est la plus brouillonne : étapes « 1 · 6 sélectionné(s) / 2 · 0/6 article(s) contrôlé(s) / 3 · Préparer les PDF » collées en 12 px, pastilles « 0 sans bordereau », « 0 déjà imprimé(s) », « (s) » partout, « Tout sélectionner » et « Tout décocher » en boutons gris empilés, **cases à cocher natives bleues** (2 par ligne), poignée de tiroir affichée sur ordinateur. `feuille-tout-imprimer-390-clair.jpg`, `-1512-clair.jpg` | Structure : titre « 6 bordereaux à imprimer » + une ligne grise 13 px (« 3 comptes · tous ont leur bordereau ») ; les zéros ne s'écrivent pas. Un seul lien texte « Tout / Aucun » à droite de l'en-tête de groupe. Cases : composant rond 22 px façon Rappels (remplissage encre coché, cercle filet sinon) ; « Contrôlé » devient un interrupteur de la rangée entière (geste : toucher la photo). Pluriels calculés, jamais « (s) ». Poignée seulement au doigt (`pointer: coarse`). | M |
| 5 | **Toutes les feuilles** (menu profil, Tout imprimer…) | Un **liseré bleu de 2 px autour de la feuille** : l'anneau de focus se dessine sur la feuille entière quand elle reçoit le focus à l'ouverture. Ça fait « bug ». `feuille-tout-imprimer-1512-clair.jpg`, `feuille-menu-profil-390-clair.jpg` | Dans `src/composants/SheetShell.jsx` : le conteneur qui reçoit le focus programmatique porte `outline: none` ; l'anneau reste sur `:focus-visible` des contrôles seulement. | S |
| 6 | **Toutes les listes** (Annonces, Ventes, Achats) | Le **contenu commence sous la ligne de flottaison** : barre d'état + titre 34 px + phrase + « ? » + plateformes + carte sombre + 2-3 tuiles. Sur Ventes au téléphone, la 1re vente est au 2e écran ; sur Annonces, au 2e écran aussi. Des tuiles isolées pleine largeur (« Ventes 22 », « Qui dorment 0 », « En route 60 ») avec 80 px de vide. `ventes-390-clair.jpg`, `annonces-390-clair.jpg`, `achats-390-clair.jpg`, `annonces-1512-clair.jpg` | Gabarit d'écran unique (lot A) : en-tête compact (titre 28 px sur ordinateur et 34 px au téléphone, **plus de phrase sous le titre** : le « ? » va à côté du titre), carte sombre réduite à **une ligne de chiffres** (≤ 112 px) sur les écrans-listes, et **aucune tuile seule sur sa ligne** (deux ou trois par rangée, sinon dans la carte). Le premier élément de la liste doit apparaître dans le premier écran à 390 × 844. | M |
| 7 | **Barre du haut (téléphone)** | Deux ronds côte à côte : « V » gris avec un point, puis un **cercle vide** (photo de profil absente) — ça se lit comme une icône cassée. Sur Ma journée la barre devient **noire** en thème clair (elle prend la couleur de la carte sombre) alors qu'elle est grise ailleurs. `journee-390-clair.jpg` vs `colis-390-clair.jpg` | Un seul rond : la photo, sinon l'**initiale** sur `--d-remplir-fort` (comme dans Mon compte). Le compte Vinted actif passe dans le menu du profil. Barre du haut : même matière sur tous les écrans (fond translucide `--d-fond` à 80 % + flou), jamais noire en clair. | S |
| 8 | **E-mails (ordinateur)** | « Trop gros » : grand titre 44 px + phrase + segmenté 50 px, puis une colonne de **440 px** où tout est en 17 px (pilules 44 px, recherche 44 px), et à droite **850 px vides** avec une icône de boîte. `emails-1512-clair.jpg` | Mise en page de Mail : colonne liste 360 px **dans la page** (pas une carte flottante), rangées 13/15 px, pilules de filtre 32 px (`vrm-filtres`) — la cible de 44 px reste au doigt seulement (`pointer: coarse`). Le titre « E-mails » à 28 px, segmenté remplacé par un lien « Relier ma boîte » dans l'en-tête. Volet de lecture : fond carte, message vide en 15 px gris centré verticalement, pas d'illustration. | M |
| 9 | **Argent → Factures** | Écran le moins fini : tableau avec **en-tête orange** (« N° Article »), qui **déborde** au téléphone (« Dé… », « Aucune factur », « + Nouvelle » coupés), onglets soulignés (un 3e style d'onglets), « Registre des factures — Aucune facture » + « Aucune facture en attente » (le vide dit deux fois), 5 boutons dans l'en-tête dont un bleu, liste déroulante native « novembre 2026 ». `argent-factures-390-clair.jpg`, `argent-factures-1512-clair.jpg` | Rangée de liste VRM (vignette · titre · note · montant) au lieu d'un tableau au téléphone ; tableau seulement ≥ 1024 px, en-têtes 12/600 gris. Onglets « En attente / Comptabilisées » = `Segmente`. Un seul état vide (illustration non, une phrase + « Nouvelle facture »). En-tête : « Nouvelle facture » (seul bleu) + « ⋯ » qui range Relire, Exporter, Ma facture, Réglages. | M |
| 10 | **Démarrage** (le « bandeau gris avec un logo centré ») | À chaque ouverture : écran gris plein avec le logo au centre et un trait de progression ; sur ordinateur, 1 512 px de gris pour un logo de 72 px. `demarrage-1512-clair.jpg`, `demarrage-390-clair.jpg` | La coquille d'abord : rail latéral + barre du haut + squelettes de l'écran demandé, dès le premier rendu (l'app installable sert déjà la coquille du cache). Le logo seul n'est gardé qu'au tout premier lancement, 400 ms max, puis fondu 150 ms. | M |
| 11 | **Frise de suivi** (Envoyés, feuille d'une vente — signalée par Julien) | Épaisse, quatre couleurs. (Pas reproduite dans la base inventée : aucune vente n'y a d'étape lue.) DESIGN.md demande déjà : posée seulement si une étape est faite, trait franchi bleu. | Trait de **3 px**, rayon 2, gris `--d-remplir-fort` ; le franchi en **encre** (pas de bleu ni de vert : ce n'est pas une action), le mot sous la seule dernière étape faite (12/500). Une seule couleur hors neutre possible : le point ambre si l'étape est en retard. Fichier `Frise.jsx` + règles 5.3 de `styles-design-2026.css`. | S |
| 12 | **« Achat à saisir » répété** (Ventes, ligne de vente — signalé par Julien) | Le même mot sur chaque ligne sans prix d'achat (`achatTxt: 'à saisir'`, `App.jsx` ~42185 ; `Vestiaire.jsx` ~613). | Règle de la phrase unique : sur la ligne, la case vide « — » grise ; en tête de liste UNE pilule « 12 prix d'achat à saisir → Saisir en série » (le chiffre faux est la porte, CLAUDE.md §5). | S |

### P2 — on voit que ce n'est pas fini

| # | Écran | Problème précis (capture) | Correction proposée | Effort |
|---|---|---|---|---|
| 13 | Toutes | La ligne « ● Tout est à jour · vérifié à l'instant » occupe une ligne entière sur **chaque** écran, avant le titre. `*-390-clair.jpg` | Quand tout va bien : rien (ou un point gris 7 px à côté de la cloche). La ligne n'apparaît qu'en retard ou en panne, en ambre, avec son geste. | S |
| 14 | Toutes | **Trois styles d'onglets** : segmenté gris (Argent), onglets soulignés (Factures), pilules noires (comptes, filtres) ; et des segmentés **imbriqués** (Argent → Statistiques → Mes ventes / Prix → Semaine / Mois / Année, trois niveaux, largeurs différentes). `argent-stats-390-clair.jpg` | Un niveau de `Segmente` par écran, pleine largeur au téléphone, 480 px max sur ordinateur. Le 2e niveau devient des pilules `vrm-filtres` 32 px, le 3e un menu « Mois ▾ ». | M |
| 15 | Toutes | **Contrôles natifs** qui sortent du style : `<select>` (« Tous les comptes », « 19 h (hiver) », « Choisir… », « novembre 2026 » — 66 `<select>` dans `src`), cases à cocher (« Masquer mon nom » dans le menu profil), heures `type="time"`, triangle `▾` de `<details>`. `stock-390-clair.jpg`, `feuille-notifications-390-clair.jpg`, `feuille-menu-profil-390-clair.jpg` | Un composant `Choix` (rangée de Réglages avec la valeur grise à droite + chevron, ouvre une feuille de choix) ; interrupteur iOS pour un oui/non ; pour l'heure, deux rangées « De 22 h » / « À 8 h ». Audit qui refuse `<select>` et `type="checkbox"` nus hors composant. | L |
| 16 | Messages | Chaque fil non lu porte **une barre bleue à gauche ET un point bleu ET un chevron** ; sur ordinateur les fils sont des cartes séparées par du gris au lieu d'un groupe. `messages-390-clair.jpg`, `messages-1512-clair.jpg` | Non lu = pseudo en 600 + point bleu 8 px (iOS Mail). Supprimer la barre et le chevron. Un seul groupe blanc à filets (DESIGN.md « rangée de liste »). | S |
| 17 | Achats | L'état en **pastille** sous chaque titre (« Arrivé », « À retirer » ambre, « En route ») + bouton « ⋯ » rond par ligne ⇒ rangées de 96 px, 1 000 px de vide entre titre et prix sur ordinateur. Rangée d'outils « Calculette · scan · Mode relais » centrée (pas alignée à gauche). `achats-1512-clair-suite.jpg`, `achats-390-clair.jpg` | État = mot gris 13 dans la note (« vendeur_1 · 11 nov. · Arrivé »), seul « À retirer » prend le point ambre ; « ⋯ » remplacé par le glisser/clic long ; rangée 64 px. Sur ordinateur : colonnes comme Ventes (titre · compte · date · état · montant). Outils alignés à gauche ou dans « ⋯ » de l'en-tête. | M |
| 18 | Ventes | « Vendue » répété sur chaque ligne ; logo V + « Vinted · vendeur_2 » répété ; tuiles « Bénéfice — pas calculé » / « À envoyer — ouvre Colis » : un tiret géant de 40 px comme chiffre. `ventes-390-clair.jpg`, `ventes-1512-clair-suite.jpg` | État par défaut (vendue) muet, seuls les états à part s'écrivent ; filtre « Vinted » actif ⇒ plus de site sur la ligne. Un chiffre pas su s'écrit « — » en **taille du texte** (17 px gris) avec sa raison, jamais en grand chiffre. | S |
| 19 | Argent → Résumé / Déclarer | Tuiles **grises** (`--d-remplir`) sur fond gris alors qu'elles sont blanches partout ailleurs ; carte orpheline « Pas encore calculé · [Ouvrir Ventes] » répétée sur Résumé et Déclarer ; quatre « — ». `argent-resume-390-clair.jpg`, `argent-declarer-390-clair.jpg` | Tuiles = cartes blanches. Le « pas calculé » devient la phrase de la tuile concernée (Bénéfice) avec son geste ; plus de carte d'en-tête. | S |
| 20 | Statistiques (ordinateur) | Mur de cartes « pas encore calculé » de tailles et marges différentes (titres 18 px et 14 px, bords à 302 et 308 px), barres d'annulation noires épaisses. `argent-stats-1512-clair-suite.jpg` | Les blocs sans donnée se replient en UNE carte « Pas encore assez de données : Vitesse d'envoi, Tailles, Boost » ; titres de bloc 17/600 partout ; barres 4 px `--d-remplir-fort` / encre. | M |
| 21 | Ma facture | Les 7 champs manquants **tous cerclés d'orange** à la fois + encadré orange : un mur d'alerte ; « Code postal / Ville » décalés de 16 px. `feuille-ma-facture-1512-clair.jpg` | Champs normaux ; un compteur en tête « 7 informations à compléter » avec point ambre ; le champ cerclé seulement après un essai d'enregistrement. Grille alignée sur la même colonne. | S |
| 22 | Stock | « Comment marche le Stock » (dessin + 3 étapes) toujours affiché alors que 36 annonces sont là ; pastilles « 0 rangée · 0 à ranger » ; select natif. `stock-390-clair.jpg`, `stock-1512-sombre.jpg` | L'explication se replie après la 1re case créée (lien « Comment ça marche »). Les zéros ne s'écrivent pas. | S |
| 23 | Paramètres (ordinateur) | Colonne **centrée** de 790 px alors que tous les autres écrans sont alignés à gauche : le titre saute de 200 px en changeant d'écran ; « Tout va bien ? », « Comptes liés », « État des connexions » = trois entrées pour une même idée. `parametres-1512-clair.jpg` | Même colonne que les autres (bord gauche 288 px, largeur 720 max). Fusionner les trois entrées en « Mes comptes et l'extension » (une page, trois groupes). | M |
| 24 | Appareils connectés (signalé : « trop détaillé ») | La liste du banc est sobre ; le détail vient de « Tout va bien ? » (« Où tourne l'extension », versions, « Extension 5.344 · vu à l'instant », « Alertes sur ton iPhone · Réessayer · Pas su : le serveur n'a pas répondu »). `feuille-appareils-390-clair.jpg`, `feuille-tout-va-bien-390-clair.jpg` | UNE liste « Mes appareils » : nom (« iPhone », « Mac — Chrome ») + « actif » / date ; la version de l'extension seulement si elle est en retard (point ambre + « Mettre à jour »). « Se déconnecter partout » en lien texte, pas en bouton pleine largeur. | S |
| 25 | Notifications | Bouton bleu pleine largeur « Activer sur cet appareil » + interrupteurs **bleus** (iOS : verts ; ici le bleu triple l'accent). `feuille-notifications-390-clair.jpg` | Interrupteurs en encre (ou vert système `#34C759` si Julien l'accepte — à lui de trancher, hors palette actuelle) ; bouton d'activation pilule bleue normale, pas pleine largeur. | S |
| 26 | Connexion | Avertissement ambre en jargon (« clé publique », « verrou (RLS) ») sous le formulaire. Il est **voulu** et mesuré (`sondeLectureSansCompte`, `App.jsx` ~16950) : il n'apparaît que si la base se lit vraiment sans compte — c'est le cas du banc, pas d'une base cloisonnée. `public-connexion-390-clair.jpg` | Garder la mesure (décision d'honnêteté), mais en mots simples et sans ambre criard : « Ton espace n'est pas encore fermé aux autres comptes — n'invite personne pour l'instant. » Le détail technique reste dans Réglages → Sécurité des données. | S |
| 27 | Extension — carte du logo | « VRM · extension 5.130.0 » en en-tête (numéro de version visible), « Tes données / Tes données sont à jour », phrase entière en ambre « Pas connecté — connecte-toi ci-dessous », la question « c'est bien un de tes comptes ? » en carte **sombre** sur une page claire. `extension-badge-*.png` | En-tête : logo + « VRM » seulement (version dans « ⋯ »). Libellés supprimés quand la valeur se lit seule (« sophie@… », « angeled92 », « À jour · il y a 3 min »). État = point + mot. La carte suit le thème du navigateur. | S |
| 28 | E-mail d'essai (« peut être plus beau ») | Propre mais plat : logo sombre + « VRM » en double, carte décalée de 8 px par rapport au logo et au pied, marge basse (48 px) > marge haute (28 px), aucun signe visuel de réussite. `email-essai-*.jpg` | Gabarit `api/_lib/mail-gabarit.js` : bords alignés (carte et en-tête sur la même colonne, 24 px intérieur partout), un rond 48 px `#F2F2F7` avec une coche encre au-dessus du titre (« ça marche »), une liste de 3 lignes « Ce que tu recevras » (bilan du mois · colis à envoyer · fin d'essai), bouton 44 px rayon 12, mode sombre (`prefers-color-scheme` dans le `<style>`). | S |
| 29 | Ma journée | Deux pilules côte à côte « Semaine du 2 nov. » et « Ma semaine › » (même destination) ; dans la frise des jours, le 10 plein blanc et le 11 cerclé : on ne sait pas lequel est aujourd'hui ; « Bénéfice · mois » seul sur sa ligne sur ordinateur avec un grand « — ». `journee-390-clair.jpg`, `journee-1512-clair.jpg` | Une seule pilule « Ma semaine › ». Aujourd'hui = cercle plein encre, jour choisi = cercle filet. Les trois tuiles sur une rangée à toute taille. | S |
| 30 | À trancher | La section « Pas encore compté » = une colonne de « — » avec « Ouvre Colis » : une liste de tirets. `a-trancher-390-clair.jpg` | Ne lister que ce qui est compté ; le reste en une phrase « 5 vérifications attendent la prochaine lecture ». | S |

### P3 — finitions

| # | Écran | Problème | Correction | Effort |
|---|---|---|---|---|
| 31 | Plateformes (segmenté) | Logos Leboncoin et eBay presque invisibles (gris clair sur gris), Vinted en noir : poids inégaux. `ventes-390-clair.jpg` | Logos monochromes encre à 60 %, actif à 100 % ; même hauteur optique (16 px). | S |
| 32 | Configuration de départ | « 1 sur 6 » en haut mais pastille « 2 » sur l'étape. `configuration-depart-390-clair.jpg` | Le compteur et la pastille disent le même rang. | S |
| 33 | Page de partage formateur | Un **bouton bleu par groupe** ; « Ses groupes » décalé de 4 px. `public-partage-formateur-390-clair.jpg` | Bouton secondaire par groupe (ou rangée entière cliquable + chevron) ; titres alignés à 16 px. | S |
| 34 | Carte de colis | Titre coupé entre la pastille N° et la 2e ligne (« New Balance / xt-6 taille 40 »), note tronquée « 3 j pour l'envo… ». | Pastille N° sur sa propre ligne de note, titre 15/600 deux lignes pleines ; la note ne porte qu'une info (la limite). | S |
| 35 | Annonces (grille) | Pastilles N° 18 px noires très lourdes sur les photos ; chevron « ⌄ » à côté du titre sans fonction claire. `annonces-390-clair-suite.jpg` | Pastille N° 13/700, fond encre à 85 % + flou ; geste « ⌄ » dans « ⋯ ». | S |
| 36 | Menu profil | Rond vide, « Nom masqué », case native. `feuille-menu-profil-390-clair.jpg` | Initiale ; interrupteur iOS. | S |

---

## Découpage en lots indépendants

Chaque lot touche **sa** zone (fichiers et sélecteurs distincts) pour que plusieurs agents
travaillent en parallèle sans conflit. Chaque lot : captures avant/après avec
`scripts/bancs/revue-design-captures.cjs` (`ECRANS=…`), rangées à côté de celles-ci, et un
banc qui juge la règle (attributs `data-*`, nombres rendus) et qui échoue sur le code d'avant.

| Lot | Zone | Points | Fichiers principaux | Taille |
|---|---|---|---|---|
| **A — Gabarit d'écran et coquille** | En-tête d'écran (titre, « ? », ligne d'état), barre du haut téléphone, rond du profil, carte sombre réduite, règle « aucune tuile seule », démarrage par la coquille | 6, 7, 10, 13, 29 | `ScreenHead`, coque (`styles-coque.css`, `styles-nav-v2.css`), `public/demarrage-*.js`, carte sombre (`styles-design-2026.css` §carte) | M-L |
| **B — Colis et impression** | Cartes de colis, bouton d'impression de ligne, « Choisir la vente », étages de contrôles, feuille « Tout imprimer », frise | 1, 2, 3, 4, 11, 34 | `App.jsx` (vue Colis ~45800-46800, `SheetShell` du lot ~46133), `Frise.jsx`, `styles-colis-colonnes.css`, `styles-design-2026.css` §5 | L |
| **C — Listes : Ventes, Achats, Messages, Annonces** | Rangées, état muet par défaut, « à saisir » en tête, Achats en colonnes sur ordinateur, non-lus de Messages, grille d'annonces | 12, 16, 17, 18, 35 | `App.jsx` (Ventes ~42100-42400), `ecrans/Achats.jsx`, `styles-messages.css`, `styles-annonces-grille.css` | M |
| **D — Argent** | Résumé, Statistiques, Déclarer, Factures, Ma facture | 9, 14 (dans Argent), 19, 20, 21 | `ecrans/Compta.jsx`, `ecrans/Stats.jsx`, `FacturePro.jsx`, `facture-pro.css`, `src/argent.js` | M-L |
| **E — Paramètres, feuilles et contrôles** | Composants `Choix` / interrupteur, fin des `<select>` et cases natives, focus des feuilles, Paramètres alignés, Appareils et « Tout va bien ? » simplifiés, Notifications, menu profil, E-mails sur ordinateur | 5, 8, 15, 23, 24, 25, 36 | `composants/SheetShell.jsx`, `composants/Ios.jsx`, `ecrans/Reglages.jsx`, `ToutVaBien.jsx`, `profil/MenuProfil.jsx`, `boite-emails.css` | L |
| **F — Hors de l'app** | E-mail d'essai et gabarit des e-mails, carte du logo de l'extension, page de connexion, page formateur, configuration de départ, À trancher, logos des plateformes | 26, 27, 28, 30, 31, 32, 33 | `api/_lib/mail-gabarit.js`, `api/_lib/mail-essai.js`, `vinted-sync-extension/vrm-badge.js` + `popup.*` (⚠️ monter la version, régénérer le zip), `public/formateur.html`, page d'auth | M |

Ordre conseillé : **B** et **A** d'abord (ce que Julien voit vingt fois par jour), puis C, D, E
en parallèle, F quand il veut. Le lot E (composants `Choix` / interrupteur) peut livrer ses
composants en premier : C et D les réutilisent.

---

## Cinq règles à ajouter à DESIGN.md (ajoutées le 11 nov., section « Règles de la revue du 11 nov. »)

1. **Le contenu dans le premier écran.** Sur un écran-liste, le premier élément de la liste est
   visible sans défiler à 390 × 844 et à 1512 × 950. Au-dessus : l'en-tête, UNE rangée d'outils,
   et au plus une bande de chiffres de 112 px. Jamais une tuile seule sur sa ligne.
2. **Un bleu par écran, jamais par ligne.** Une action répétée sur chaque rangée (imprimer,
   rejoindre, choisir) est secondaire (`--d-remplir`) ; le seul aplat bleu est l'action groupée
   de l'en-tête (« Tout imprimer »). Même règle pour l'ambre : un point de 7 px, jamais un
   encadré ou un fond sur chaque ligne.
3. **Aucun contrôle natif nu.** Pas de `<select>`, de case à cocher, d'heure ou de `<details>`
   au style du navigateur : `Choix` (rangée + feuille), interrupteur iOS, `vrm-repli`. Tous les
   onglets sont `Segmente` (un seul niveau par écran) ou `vrm-filtres`.
4. **Les tailles suivent le pointeur.** 44 px est la cible **au doigt** (`pointer: coarse`) ; à la
   souris, rangées et pilules en 32–36 px, texte de liste 15 px, grand titre 28 px. Un écran
   d'ordinateur ne reprend pas l'échelle du téléphone agrandie.
5. **Le vide et le zéro ne s'affichent pas en grand.** Un « — » ou un 0 s'écrit à la taille du
   texte avec sa raison ; une section sans donnée se replie dans une phrase ; un même vide ne se
   dit qu'une fois par écran ; « (s) » ne s'écrit jamais (pluriel calculé).
