# Refonte visible — sites (Leboncoin, eBay, Vestiaire), Paramètres, première impression (14 nov.)

Branche `claude/refonte-plateformes-reglages`. Brief commun : AJOUT 3 (« la liste d'abord ») > AJOUT 2
(1 000 articles) > direction Atelier. Skills appliqués : `vrm-design`, `apple-design`, `impeccable`,
`taste-skill`, `emil-design-eng`, `mobile-native`, `references-design` (principes seulement, aucune identité).
Forme seulement : aucune règle métier, aucun chiffre recalculé, aucun `data-*` retiré.

## Ce qui était laid (captures avant, base inventée)
- **Annonces · Leboncoin** : « Chiffres », « Publier sur Leboncoin », « Actualiser », « Republier », « Baisser le
  prix », « Données » : six blocs AVANT la liste ; la 1re annonce à **968 px** (390 × 844), en grandes cartes
  photo de 300 px avec un bouton « Gérer » gris chacune.
- **Annonces · eBay** : « Annonces eBay (4) » redit sous l'onglet, carte « À faire sur eBay », carte « Vendre sur
  eBay », champ + micro + engrenage gris, puis la liste à **693 px** ; deux capsules grises par rangée.
- **Annonces · Vestiaire** : carte « Publier », carte « Tes annonces Vestiaire » (titre dans la carte), capsules
  « 3 annonces », « Lu il y a 2 h », « Baisser des prix », grille photo ; 1re annonce à **534 px**.
- **Paramètres** : titre + phrase de deux lignes, onglets, carte « À terminer » (bouton gris), carte « Protège ton
  compte » de 250 px avec trois étapes, PUIS la recherche, PUIS la liste à **789 px** ; phrases grises sur deux lignes.
- **Connexion / accueil / exemple** : le second appel est une capsule GRISE pleine largeur sous le bleu ; le
  bandeau du mode exemple pose un 2e bouton plein bleu au-dessus de Ma journée.

## Ce qui change (composition)
- **`src/plateformes/AFaireSite.jsx`** : « • À faire · N › » (la forme et les classes de `src/ui/LigneAFaire`),
  dont la feuille reste MONTÉE fermée (`hidden`) : une baisse de prix en série, une republication ou le formulaire
  eBay ouverts depuis elle ne sont jamais coupés par Échap ou le voile. Un geste qui mène dans l'écran
  (`data-afaire-ferme` : filtrer, aller au bloc) la referme.
- **Leboncoin** : conseils + « Republier » + « Baisser le prix » dans « À faire » ; doubles ventes et ventes à relier
  restent dans la page (seul geste urgent) ; `AnnoncesLeboncoin` = `BarreOutils` (champ, « Actualiser », « + »
  Publier — l'événement `vrm:publier-ailleurs` et `data-pa-entree` gardés) + `Filtres` (les vides cachés sauf le
  choisi) + rangées denses (photo 52, N° en pastille, état en point, prix, « Gérer ↗ », « Supprimer » confirmé par
  l'écran comme avant). « N reçues · ⓘ » et « Données » sous la liste.
- **eBay** : le titre redit devient lecteur d'écran ; « À faire sur eBay » dans « À faire » ; la barre porte champ,
  micro, « Vendre sur eBay » (sa porte devient une icône étiquetée ; ouverte, la feuille de vente se déplie sous la
  barre — `data-poster="ebay"` visible et cliquable) et les réglages ; `Filtres` communs ; rangées : titre sur une
  ligne, « Relier » et « ⋯ » en mot/glyphe. L'intro du compte passe sous la liste.
- **Vestiaire** : plus de carte autour de la liste ; « Baisser des prix » dans « À faire » (la feuille de la série
  reste montée hors d'elle) ; une barre avec RECHERCHE (le N° tapé trouve l'annonce, le titre aussi) et « + »
  Publier ; rangées denses (photo entière sur blanc) ; « Délier / Relier à Vinted » à droite ; les puces de
  fraîcheur sous la liste. La carte « Ta clé Photoroom » reste sur l'écran Vestiaire (§3), sous la liste.
- **Chiffres d'un site** (`PlatResume`, App.jsx) : plus de repli « Chiffres » ni de carte encadrée — `BandeChiffres`
  (≤ 72 px) ; un montant pas su n'a pas de case ; la note d'un compte illisible reste (une ligne).
- **Paramètres** : titre + « ? » (la phrase disparaît, le « ? » la dit) ; la RECHERCHE sous le titre ; onglets ;
  « À faire » en rangées (« À terminer » : point ambre, geste en mot ; « Protège ton compte VRM » : une rangée,
  « Activer · Plus tard · Comment ? », les trois étapes au toucher de « Comment ? ») ; groupes iOS : intertitre 13
  gris hors carte, rangées 52 px, pastille d'icône teintée (bleu nuit, neutre pour les groupes d'outil), libellé 17,
  phrase sur UNE ligne, valeur à droite, chevron fin ; **réglages avancés repliés** : « Sécurité et sauvegarde »
  derrière une rangée « Réglages avancés › » (dépliée d'office quand une recherche y trouve un réglage ; panneaux
  toujours montés). Le panneau « Sécurité des données » garde ses mots (§5).
- **Connexion** : le panneau de marque prend le dégradé encre → bleu nuit (§4) et ses trois halos passent au bleu
  (accent, bleu ciel, bleu nuit — principe « lumière dans le tiers haut », jamais de violet) ; titre 34 (44 à
  l'ordinateur) ; le formulaire flotte (ombre douce, rayon 24) ; « Découvrir avec des exemples › » en lien à
  l'accent. **Accueil** : un halo bleu très doux derrière le titre ; « Découvrir avec des exemples » en teinte
  d'accent (un seul bouton plein). **Mode exemple** : « Créer mon compte » en teinte. **Démarrage** : carte posée.
- Textes neufs : `plateformes.*` (5 langues, `src/i18n/langues/<l>/plateformes.js`). Briques reprises telles
  quelles de `claude/refonte-listes` (`src/ui/*`, `listes.*`) et §4 Atelier de `claude/refonte-coque`.

## Inventaire des réglages
`scripts/bancs/_inventaire-reglages.json` : 145 entrées relevées sur origin/main (`INVENTAIRE=1`, chaque
`data-sous-ouvrir`, chaque `data-reglage-*`, chaque sous-écran, dans les trois vues) ; le banc exige que chacune
existe encore. Avant : 145 · après : 145 (R = 0).

## Preuves
Banc `scripts/bancs/refonte-plateformes-reglages.cjs` (la mesure des passes design + L liste ≤ 50 % · V carte « — »
· A ≤ 1 plein accent · G capsules grises · B bandeau · R réglages joignables), 12 écrans, base inventée :
- **origin/main** (`BANC_DIST` = build d'avant, 390 clair) : **ROUGE** — 1re ligne à 968 px (Leboncoin), 693 (eBay),
  534 (Vestiaire) ; la première passe complète (390, deux thèmes) : 29 défauts (liste 8, cartes « — » 10, bandeau 11).
- **après**, 390 tactile dsf 2 clair + sombre : **VERT, 24 rendus, 0 défaut** ; 1512 clair + sombre : **VERT, 24 rendus**.
  1re ligne : Leboncoin ≈ 393 px, eBay ≈ 421 (juste : le segment « Annonces · Promotion » de la tâche reste au-dessus), Vestiaire ≈ 335, Paramètres ≈ 240 (à 390 × 844).
- **mutation** (`MUTATION=1`, la 1re ligne repoussée d'un écran) : **ROUGE** (2/2).
- R : 145 réglages d'avant, 145 joignables (les trois vues).
- Deux règles laissent explicitement à leur chantier ce qui est à lui : V ne juge pas la carte de chiffres PARTAGÉE
  (`CarteStatsApp`, `.vrm-fu-*`, `[data-ventes-kpi]` : `claude/refonte-listes`) ; B ne juge pas la pastille
  « Mis à jour » ni le bandeau de mise à jour (`.vrm-neuf-hote` : `claude/refonte-coque`).
- Paires : `docs/design/avant-apres/{leboncoin,leboncoin-sombre,ebay,vestiaire,reglages,reglages-sombre,connexion,connexion-accueil}-{avant,apres}.png`.

## Paramètres, d'après les captures de Julien de midi
- **Compte propriétaire** (« dans parrainage je ne sais pas pourquoi il y a mon compte ») : l'onglet Abonnement
  montre « Compte propriétaire · gratuit », SANS les offres Solo/Pro ni le parrainage (pour les clients). Ce qui
  reste pour laisser les clients payer (mentions légales, prix Stripe, offre Pro) tient en UNE ligne
  « Ouvrir le paiement · N › » (`AFaireSite`, hors de la carte `[data-abonnement]`) : sa feuille dit les étapes en
  mots simples, le détail technique d'avant (mêmes textes et `data-mentions-manquantes`, `data-prix-stripe`,
  `data-pro-geste`) replié au bout, pour lui seul. Un client ne voit rien de technique (inchangé).
- **« Il y a 2 “ce que VRM a fait” »** : « Journal : ce que VRM a fait » quitte « Connexion » pour « Tes données »,
  à côté de « Confidentialité : ce que VRM lit et garde » (5 langues ; `audit-confiance-publique` suit le libellé).
- « N choses à revoir » au-dessus du titre et la phrase sous « Paramètres » : l'écran ne les rajoute pas (la
  phrase est devenue le « ? » à côté du titre ; l'alerte de tête est la coque, `claude/refonte-coque`).

## Bancs adaptés
- `design-passe-2.cjs` `toucher` : une ligne rangée dans un repli fermé (« Réglages avancés ») — on touche d'abord
  le repli (un geste de plus, rien de caché). Profite à `design-passe-3`.
- `lbc-plus`, `lbc-comme-vinted`, `lbc-supprimer`, `quoi-republier`, `vestiaire-plus` : la porte (Republier,
  Baisser le prix) vit dans « À faire » — on l'ouvre d'abord (`[data-pf-afaire]`), la porte attendue `attached`.

## Bancs relancés (machine très chargée : charge 50–78, 1 à 2 Go libres, disque à 98 %)
- Après la fusion de main : `design-passe` (Paramètres) VERT ; `design-passe-2` (Paramètres 390 sombre) VERT ;
  `design-passe-3` (Paramètres 390 clair) VERT ; `reglages.cjs` VERT ; `detourage-reglage` VERT ;
  `entree-publier-ailleurs` VERT ; ce banc 390 (23/24 rendus verts, le 24e « Page crashed » — mémoire de la
  machine) et 1512 clair VERT.
- ⚠️ Un premier passage avait rougi `design-passe-3` (sous-pages) : la copie du §4 prise le matin sur
  `claude/refonte-coque` datait d'avant la passe 3 et effaçait sa section 2.12. Corrigé (`styles-systeme.css` =
  main + §3/§4 de la coque, 0 ligne retirée à main), relancé vert.
- Après « compte propriétaire / Journal » (fin de journée, la machine a redémarré, charge ≈ 50) : ce banc
  (Paramètres 390 clair + sombre) VERT ; `audit-traduction`, `audit-confiance-publique` (libellé suivi), tdz,
  variables, composants VERTS. `reglages.cjs` et `abonnement.cjs` rouges PAR LA CHARGE : la sonde montre l'écran
  encore en squelettes de chargement après leurs 3,5–5 s d'attente fixe (aucune carte rendue, même pour un client ;
  `reglages.cjs` était VERT sur le même code juste avant le dernier lot). À relancer machine calme.
- Pas relancés jusqu'au bout ici (pages qui « crashent » sous la charge, pas une règle) : `lbc-plus`,
  `vestiaire-plus`, `lbc-comme-vinted`, `lbc-supprimer`, `quoi-republier`, `abonnement`, `parrainage-lot54` — à
  relancer machine calme.
## Ce qui reste (hors de ce chantier, ou à reprendre)
- Ventes · site : la carte sombre des chiffres (`CarteStatsApp`, « — Finalisé ») est la carte partagée du chantier
  `claude/refonte-listes` ; elle n'est pas jugée ici (règle V) et n'a pas été touchée.
- La pastille « Mis à jour à … » posée sur la liste (règle B) : la coque (`claude/refonte-coque`) la fait
  disparaître après 2 s ; tant que ce chantier n'est pas sur `main`, la règle B la voit.
- `AJOUT 2` (1 000 annonces) n'a pas de mesure dans ce banc : les rangées sont `content-visibility:auto`, sans ombre
  ni flou, l'animation sur les 12 premières seulement ; un banc de volume Leboncoin/Vestiaire reste à écrire.
- eBay : la 1re rangée tient à 421 px pour 422 — le segment « Annonces · Promotion » (la tâche, App.jsx) reste au-dessus.
