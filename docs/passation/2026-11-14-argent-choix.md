# 14 nov. 2026 — Les quatre choix d'Argent (75, 80, 81, 82)

Branche `claude/argent-choix`. Julien a choisi quatre propositions :
75 « Coller un tableau de prix d'achat (N° ; prix) », 80 « Bénéfice par modèle et par taille »,
81 « Objectif du mois, avec une jauge et le rythme par jour », 82 « Déclaration de revenus annuelle
prête ». Une partie existait : on a MESURÉ d'abord, puis complété seulement ce qui manquait.
Aucun chiffre n'est calculé autrement que par la règle existante (§5, une règle par notion).

## Ce qui existait, ce qui manquait, ce qui est fait

| # | existait (où, touchers depuis Ma journée à 390) | manquait par rapport à sa phrase | fait |
|---|---|---|---|
| 75 | « Importe tes achats depuis un tableur » (Achats → + Ajouter → fichier .csv/.xlsx : crée des ACHATS) ; la saisie en série des prix d'achat, un champ par paire (Ventes → « Coût d'achat · x/y renseignés » ou « Bénéfice — », 2–3 touchers) | coller un texte « N° ; prix » depuis Notes/Excel pour remplir les prix des fiches EXISTANTES d'un coup | « Coller un tableau » dans l'en-tête de la saisie en série : séparateurs `;` `,` tab espace `|`, « 007 » = « 7 » (`cleNumero`), prix « 60 », « 60,50 », « 60 € », « 1 250,00 » (`prixDuFichier`) ; aperçu ligne par ligne (à enregistrer · déjà ce prix · déjà un autre prix · N° inconnu · deux fiches · collé deux fois · vide · colonnes · illisible) ; « Enregistrer N prix » sur SON clic ; un prix différent n'est remplacé que s'il coche « Remplacer aussi » ; écrit par le chemin du prix TAPÉ (`ecriturePrixSaisi` → `vinted_annonce_numeros` + `vinted_buyprice_by_num`, `save` = lire-fusionner-réécrire), relu sur les fiches du moment (comparer-et-échanger), jamais sans base chargée (`isCloudReady`) ; point de retour (`pointAvant`) |
| 80 | « Ce qui rapporte le plus » (Argent → Statistiques, 3 touchers, ~4 écrans) : classement par Modèle OU Marque OU Taille ; « Ce qui part vite » ; « Quelles tailles vendent » | modèle ET taille ensemble ; chiffres sur les seules ventes RELIÉES (le délai et le nombre y comptaient toutes les ventes) ; tri au choix ; « quoi racheter » | carte « Modèle et taille » sous « Ce qui rapporte le plus » : axe `modeleTaille` ajouté à `cleAxe` (modèle SÛR `modeleSur` + taille de la vente ; l'un manque ⇒ « Autres ») ; chiffres = `classementRapporte` sur les ventes reliées ; couverture « sur 96 ventes reliées à leur achat · 126 ventes » ; tri Bénéfice · Par paire · Marge · Vite ; « À racheter » = ≥ 3 ventes reliées et datées, bénéfice par paire ≥ la médiane des groupes classables ET délai ≤ leur médiane ; < 3 groupes classables ⇒ aucun conseil (`src/quoiRacheter.js`) |
| 81 | `src/objectifMois.js` : objectif Vendu · Bénéfice · Ventes, barre dans la carte sombre de Ma journée (0 toucher) avec « encore X € en N jours · ≈ Y €/jour », rythme, proposition, bilan ; détail dans Argent → Statistiques à ~6 écrans | le REÇU au choix (date de versement, ce qu'il déclare) ; « il te faut X € par jour d'ici le 30 » lisible d'un coup d'œil ; la mesure DITE ; trouvable dans Argent | type `recu` (case « Reçu » du mois, `recuPublie` ; mois passés `recuPublieEntre`, même ligne) ; dans Argent, trois tuiles (« 77 € par jour d'ici le 30 » · « 1 300 € encore » · « 17 jours restants ») à la place de la phrase qui disait les mêmes nombres (§7) ; la mesure dite (« Sur le reçu : la date du versement compte. ») ; ventes à dater dites hors du reçu ; le bloc remonte sous les tuiles de la vitrine (~1 écran au lieu de ~6) ; libellés des types et « … ce mois » par `tr()` |
| 82 | `declarationRevenus` (2042-C-PRO) : Argent → Déclarer → « Micro-entreprise » (replié) → 4e carte : montant + case 5KO/5TA ; « Clôturer l'année » (décembre à mai) | la SOURCE de chaque chiffre (combien de ventes, de quels sites, ce qui est hors total) ; trouvable sans ouvrir un repli | carte « Ta déclaration de revenus 2026 » en tête de Déclarer, hors repli : chaque montant avec sa case (les deux cases, chacune avec sa condition, tant que le versement libératoire n'est pas répondu) ; « = ventes reçues en 2026 · 340 ventes » ; par site (Vinted 306 · 11 040 €, Leboncoin 20 · 800 €, eBay 10 · 340 €, vendues et finalisées dans l'année 4 · 160 €) ; hors total NOMMÉ (12 ventes sans date de versement (450 €), sites pas lus, mois illisibles, ventes dont l'argent ne se lit pas) ; la source se recompose au centime, sinon « incoherent » (« — », jamais un chiffre qui ne se recompose pas) ; statut jamais deviné (pas lu ⇒ lecture ; pas choisi ⇒ aucune case ; société ⇒ rien) ; la carte de la micro-entreprise ne redit plus le montant, elle y renvoie (§7) (`src/declarationAnnuelle.js`) |

Touchers mesurés par le banc (390, depuis Ma journée ; Argent est encore dans « Plus » sur
`origin/main` — l'agent coque le met dans la barre du bas, un toucher de moins) : déclaration 3
touchers à ~2 écrans ; modèle et taille 3 touchers à ~4 écrans ; objectif 3 touchers à ~1 écran
(et toujours la barre de Ma journée, 0 toucher) ; coller : Ventes → Coût d'achat → Coller.

## Tranché
- 75 : le N° collé est le N° d'AUJOURD'HUI (celui du carton) ; une paire d'avant la remise à zéro
  s'écrit « B230 ». L'aperçu montre le titre de la fiche que le N° désigne : il voit ce qu'il relie.
- 75 : une ligne à plus de deux colonnes (« 12 ; Air Max 90 ; 60 ») est refusée — « 90 » se lirait
  comme un prix. « 60 70 » (deux nombres) n'est pas un prix ; « 1 250,00 » en est un.
- 75 : un N° porté par deux fiches est refusé, même si c'est une paire republiée (la règle de
  l'import tableur, `etatNumero` = 'deux').
- 80 : « Nombre » reste un tri de la règle (`TRIS_RACHAT`) mais n'est pas un bouton (il se lit sur
  chaque rangée ; cinq boutons débordaient à 390).
- 80 : la carte ne propose que l'axe modèle × taille : les axes seuls sont dans « Ce qui rapporte le
  plus », juste au-dessus (un même nombre ne s'écrit pas deux fois).
- 81 : le reçu des ventes « à dater » n'est dans aucun mois (§5) : l'objectif sur le reçu ne les
  compte pas et les dit à côté, sans « au moins » (ce n'est pas un manque de lecture).
- 82 : la carte suit l'année de `declarationRevenus` (avant juillet : l'année passée, prête ; après :
  l'année en cours, « pour prévoir »).

## Dessin
Titre de section hors de la carte (20/700), couverture en une ligne à côté, carte sans bordure
(jetons §4 Atelier lus avec repli : `src/argent-choix.css`, aucune valeur recopiée), chiffre
d'affiche pour le montant à déclarer, tuiles pour l'objectif et « à racheter », rangées denses
(56–64 px) sans ombre, explications dans « Comment c'est calculé » (repli). Aucun montant en bleu ;
ambre seulement pour « hors total » et « pas enregistrées ». Un seul bouton plein (« Enregistrer N
prix »). 1 000 lignes collées : 200 rangées dessinées, le reste compté.

## Preuves
- `node scripts/audit-argent-choix.cjs` : 40 verts — il EXÉCUTE le parseur (56 lignes, pièges compris),
  l'aperçu, l'écriture (base pas lue ⇒ aucune écriture ; fiche changée depuis l'aperçu ⇒ pas écrite ;
  deux fiches apparues ⇒ pas écrite ; 184 prix en < 300 ms), modèle × taille, l'objectif sur le reçu
  (77 €/jour, 17 jours), la déclaration (12 340 € = 336 + 4 ventes, recomposée au centime). 15
  mutations, toutes rouges (`--mutation=cle|deux|conflit|colonnes|forme|lu|remplacer|cas|app|reliees|
  racheter|recu|parjour|source|regime`).
- Banc `scripts/bancs/argent-choix.cjs` (390 tactile / 1512, clair / sombre, base inventée : 126 ventes,
  184 fiches, une ligne publiée 2026) : voir le récit de la fin de session ci-dessous.
- Gardés verts : build, audits traduction, tdz, coherence, variables, urssaf, quoi-de-neuf,
  objectif-mois, ce-qui-rapporte, micro-entreprise, cloture-annee, icones, textes-courts, identite,
  fonctions-api ; `audit-benefice` : le même rouge connu (« joursAvant »), pas aggravé.

## Geste de Julien
Aucun.
