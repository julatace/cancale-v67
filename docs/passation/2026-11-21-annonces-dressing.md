# Annonces « Dressing » et compte bloqué — 21 novembre 2026

Branche `claude/annonces-dressing` (non fusionnée). Écran Annonces seulement ; rien dans `vinted-sync-extension/`.

## Les demandes de Julien

- (a) « Les annonces sont moches » : refaire Annonces « toujours dans le style Vintex », inspiré du **Dressing de Bleam**
  (grille de cartes photo, 2 colonnes au téléphone) et de la page **« Articles » de Vintex** (liste fine : case, vignette, titre,
  prix, date, vues, favoris, statut en étiquette douce). Puis : « ça fait trop vibe codé, c'est dégueulasse sur téléphone ;
  sur ordinateur c'est vraiment bien » ⇒ téléphone calme, rien d'empilé, 1–2 touchers par geste, aucun saut au chargement.
  Captures iPhone (21 nov., 16:07) : vignettes vides, squelette qui reste, en-tête « V SHOP_CANCALE · 29 ANNONCES ⌄ » en
  capitales, « 22 prix d'achat à compléter » en tête de liste, grand plein « Publier un article » collé sur la barre, « T. 40,5 »
  qui répète la taille du titre. Audit `docs/design/audit-2026-11-20.md` (branche `claude/audit-design`) §11–13, §60.
- (b) « Quand un compte est ban je veux quand même pouvoir voir les annonces qu'il y avait dessus. »

## (b) Pourquoi les annonces d'un compte bloqué disparaissaient — mesuré (lecture seule, 21 nov.)

Sur la base : un vendeur a 2 comptes Vinted en pause (`vrm_comptes_bloques`, choix « pause »). Le dressing de l'un, recapté
APRÈS le blocage, ne porte plus que ses 3 ventes (`item_closing_action: sold`) : ses 2 autres annonces (2 fiches N° sans vente,
2 lignes `coffre_*`) ont disparu de la capture ; l'autre compte n'a plus de dressing (ligne vidée) et 36 fiches. Aucune lecture
publique (`harvest_*_enligne` : 0 id). Trois causes, toutes dans `src/ecrans/AnnoncesEgalite.jsx` :
1. le compte en pause était **retiré de la liste des comptes lus** (`accounts.filter(!pauseCB.has)`, lot compte-bloque du 19 nov.) ;
2. un compte « retiré pour de bon » (`vrm_annonces_retirees`) ou masqué était écarté par `comptesStockEcartes` ;
3. la règle « en ligne » (inchangée) rend absentes celles que Vinted ne montre plus — et la capture d'après le blocage ne les
   porte plus du tout.

### Le correctif (à la racine, règle « en ligne » intacte)
- Nouvel état d'annonce **`bloque`** (`src/articles/modele.js` : `RANG`, `ETATS_FILTRE.bloque`, `compterArticles`,
  `STATUTS_TABLEAU`) : la dernière annonce connue d'un compte bloqué. Hors de « En ligne » et de tout total (vues/favoris et
  valeur du stock ne lisent que `enligne`), aucune action (`pour` des actions exige `enligne`/brouillon…), un segment à part
  **« Bloqués »** qui n'apparaît que s'il a quelque chose.
- Un compte est « bloqué » s'il est **banni lu**, en **pause** (son choix) ou **retiré pour de bon** ; lié et pas supprimé
  (`lireSupprimes`). Il est relu :
  - pause / retiré ⇒ toutes ses annonces lues passent `bloque` (`c.horsLigne`, `src/articles/sources.js`) ;
  - banni sans pause ⇒ la règle « en ligne » décide de ce que Vinted montre encore ; le reste devient `bloque` ;
  - la **trace**, en deux temps : (1) tout de suite, ce que sa lecture porte mais ne montre plus, sans vente
    (`fetchVintedListings().autres` : absentes, fermées sans `sold`, retirées) ; (2) **après** les preuves de vente
    (`lirePreuvesVenteVinted`, la règle partagée), SES fiches (`vinted_annonce_numeros`, même `accountId`) qu'aucune lecture ne
    porte, qu'aucune preuve ne dit vendues (dressing, transactions, bordereaux, `vinted_annonces_vendues`), pas déclarées perdues
    (`tracesFiches`). Preuves pas lues ⇒ aucune fiche (on ne montre pas une paire peut-être vendue). La liste n'attend pas ce
    second temps.
  - Chaque annonce dit sa date : « Lu le 18 nov. » (sa lecture), « Vue en ligne le … » (`vrm_vus_en_ligne`), « N° posé le … »
    (fiche seule). L'en-tête du compte : étiquette « Compte bloqué » + « Dernières annonces connues (…). Hors des totaux, aucun
    geste. » Le « ⋯ » d'une carte bloquée n'offre qu'« Ouvrir / Toute la fiche » ; « Actions » ne la coche pas ; à l'ordinateur
    la ligne porte le statut « Compte bloqué », ses cellules ne se modifient pas, son ⋯ n'a qu'« Ouvrir ».
- Ce que ça ne fait pas : aucune écriture, aucun N° changé, rien chez Vinted. Les ventes du compte restent où elles étaient.

## (a) L'écran

**Téléphone** (`src/natif/ecrans/Annonces.jsx`, nouveau `src/natif/ecrans/AnnoncesCartes.jsx`, `annonces.css`) :
une barre (recherche « N°, titre, compte » · bascule grille ⇄ liste · ⋯), les segments (En ligne · À publier · Dorment
[· Bloqués] — à 4 segments le nombre n'est écrit que sur le segment choisi, sinon « À publ… » était coupé), **UNE** rangée
« À régler · 2 à relier · 22 prix d'achat › » pour tout l'écran (un sujet ⇒ droit au geste, deux ⇒ une feuille), « Mis à jour
il y a 18 min ⟳ », puis la liste divisée par compte sous un intertitre calme et collant « shop_cancale · 29 ⌄ » (13/18 gris, plus
de capitales).
- **Grille** (défaut, mémorisée `vrm_annonces_vue` sur l'appareil) : 2 colonnes, photo 4:5 **à taille réservée** (rien ne
  saute), un seul rond « ⋯ » 44 × 44 en haut à droite (la feuille des gestes de l'article), au plus un bandeau d'état neutre
  (Masquée, En pause, Pas revue récemment, Brouillon, Compte bloqué — jamais rouge) et une étiquette de conseil **« Dort · N j »**
  calculée par la RÈGLE du segment « Dorment » (`dortDe`, date de mise en ligne lue ≥ seuil) — aucun autre conseil n'est montré
  (« Boost utile », « Vaut le coup ? » n'ont pas de donnée réelle dans VRM : pas affichés). Puis titre 2 lignes, logo du site
  · marque · taille (taille omise si déjà dans le titre, `tailleDansTitre`), prix en gras + Plaque N° (rouge seulement en
  doublon), vues · favoris · jours avec icônes (seulement ce qui est lu).
- **Liste** (« Articles ») : la rangée de 72 d'avant, 2e ligne courte (logos · N° · taille si pas dans le titre · mini), sous le
  prix l'état en étiquette douce s'il n'est pas « en ligne », sinon vues · favoris.
- Plus de grand plein « Publier un article » au téléphone : « Publier un article » est la 1re rangée de « ⋯ ».

**Ordinateur** : le tableau de travail « Articles » (Vintex) reste la vue par défaut (ce qui lui plaît) ; la bascule grille montre
désormais les MÊMES cartes « Dressing » (`TableauTravail` reçoit `carteGrille`, prop optionnelle, aucun autre écran touché).

## 2e passe au téléphone (même jour) — « je n'aime pas du tout l'affichage sur iPhone, essaye de changer »

Julien a vu les captures 390 de la 1re passe (grille par défaut) : refusées. Nouvelle direction, celle de la page « Articles » de
Vintex, compacte et nette :
- **LISTE par défaut** (`vrm_annonces_vue_tel`, la grille reste choisissable par la bascule). `RangeeArticle`
  (`src/natif/ecrans/AnnoncesCartes.jsx`) : rangée 64–72 px, vignette 52 arrondie (place réservée), titre complet 15/19 normal sur
  2 lignes, UNE ligne méta grise 13 (« logo · N° · 12 j · ♡ 4 · 👁 41 », taille seulement si absente du titre), filets fins qui
  partent du texte, fond blanc PLEINE LARGEUR (plus de carte arrondie dans la page), « ⋯ » discret gris à droite (les gestes de
  l'article : ce que faisait le balayage — Prix mini, Prix d'achat, Relier N°, Autre…, Que sur ce site — plus les actions
  applicables et la fiche). L'état en étiquette douce seulement s'il n'est pas « en ligne » (et pas « Compte bloqué », déjà dit par
  l'en-tête du compte).
- **Deux formes**, `formeRangee` : **A** (par défaut) = le prix en gras à droite en haut, « mini » dessous, l'état dans la méta ;
  **B** = le prix en gras DANS la méta, le titre a toute la largeur, l'état en haut à droite. A retenue : le prix se lit en
  colonne comme chez Vintex, l'état ne se coupe jamais, et le « mini » garde sa place.
- **En-tête** : grand titre, une recherche (+ bascule, « ⋯ »), segments, puis UNE ligne fine « Mis à jour il y a 18 min ·
  ● 24 à régler › · ⟳ » ; intertitres de compte petits (13/18 gris, « shop_cancale · 29 »).
- **Grille plus sobre** : photo carrée, titre 2 lignes, UNE ligne « logo · prix · N° · ⋯ » (le ⋯ discret à côté du prix, plus
  de gros rond noir sur la photo).
- Banc : formes A et B, clair et sombre : rangées 64–72, vignette 52 réservée, ≥ 8 rangées entières par écran (base de
  1 000), aucun plein, « À régler » sur la ligne de « Mis à jour », liste pleine largeur, aucun état coupé — 80 verts ; rouge sur
  l'arbre d'avant.

## Gestes — avant / après (aucun perdu)

| geste | avant (origin/main) | après |
|---|---|---|
| segments En ligne · À publier · Dorment | ✓ | ✓ (+ « Bloqués » s'il y a un compte bloqué) |
| recherche N°, titre, compte | ✓ | ✓ |
| « ⋯ » Actions → sélection, Tout / Annuler / « {Action} · N » | ✓ | ✓ (cartes cochables en grille) |
| Publier un article | plein au bas (téléphone et ordinateur) | téléphone : 1re rangée de « ⋯ » ; ordinateur : plein inchangé |
| N à relier | rangée en tête de chaque compte | dans « À régler » (une rangée, feuille si deux sujets) |
| N prix d'achat à compléter | rangée en tête de chaque compte | dans « À régler » |
| toucher une annonce → fiche (N°) / fiche courte | ✓ | ✓ (carte et rangée) |
| balayage : Prix mini, Acheté / Autre…, Relier N°, Que sur ce site | ✓ (liste) | le « ⋯ » discret de chaque rangée et de chaque carte (les mêmes gestes, plus chaque action applicable et la fiche) |
| replier un compte | ✓ | ✓ (intertitre collant) |
| Voir N de plus | ✓ | ✓ |
| « À régler » (`aRegler`) | ✓ | ✓ |
| fiche courte : saisies, relier, toute la fiche | ✓ | ✓ |
| écran du site (menu ⋯) | ✓ | ✓ |
| relire (⟳) + « Mis à jour il y a … » | ordinateur seulement | téléphone aussi |
| liste ⇄ grille | ordinateur (grille générique) | téléphone et ordinateur (cartes « Dressing »), mémorisée |
| ordinateur : action, recherche, Statut, filtres Site/Compte/Ancienneté/Liaison, Colonnes, ⋯ ligne, cellules modifiables | ✓ | ✓ (+ statut « Compte bloqué », coché par défaut) |

Aucune nouvelle action vers Vinted : le « ⋯ » d'une carte appelle les MÊMES chemins que « Actions » (`onAction` →
`demanderActionAnnonces`, le panneau de l'extension, `vrm:prix-partout`…). `audit-actions-app` vert.

## Preuves

- **Banc** `scripts/bancs/annonces-dressing.cjs` (+ `outils/annonces-dressing/`) : base inventée (2 comptes Vinted dont un en
  pause avec sa lecture d'après blocage + 2 traces, Leboncoin, eBay, un doublon de N°), 390 × 844 tactile DPR 3 et 1512,
  clair et sombre, photos servies en retard (700 ms). **45 verts.** Sur l'arbre d'avant (`git archive origin/main`) : **15
  rouges** (pas de grille, pas de segment « Bloqués », le compte bloqué compté et cochable). `--prouve` : 4/4 mutations
  attrapées (photo sans taille réservée, rond trop petit, prix en rouge, contraste). 1 000 annonces : premier rendu ≈ 1 s,
  ≈ 2 300 nœuds (60 par compte puis « Voir N de plus »), CLS 0 au défilement.
- Le banc d'avant `annonces-egalite.cjs` ne se construit plus, **déjà sur origin/main** (esbuild sur `url("/brands/…")` de
  `logo-site.css`) — le nouveau banc le contourne (`external: ['/brands/*']`).
- Audits : traduction, identité, quoi-de-neuf, cohérence, parité des sites, actions-app, compte-bloqué, icônes, publier-agent,
  studio, fonctions-api : verts. `audit-boutons-natifs` : rouge **déjà sur origin/main** (`Reglages.jsx` 42/41,
  `AchatsTableau.jsx:30`) ; les boutons d'Annonces sont passés au natif ou en exception justifiée (intertitre, « À régler »).
- Captures (exemple inventé) : voir le rapport de la session (scratchpad), jamais dans le dépôt.

## Ce qui reste / pas fait

- Les vignettes vides de ses captures : une autre session corrige le chargement des photos ; ici la place est réservée.
- Le squelette « qui reste » vient de la lecture (`lireAnnoncesEgalite`) ; ce lot ne la ralentit pas (les fiches d'un compte
  bloqué arrivent en second temps) mais ne l'accélère pas non plus.
- Menu compact « Tous les comptes ▾ » au téléphone (audit §12) : pas fait (la liste reste divisée par compte).
- Le « + » de la barre du bas (dont parle le retour) n'est pas dans cet écran : « Publier » est dans « ⋯ » en attendant.
