# 17 nov. 2026 — Relier : choisir parmi TOUS ses achats (lot `relier-tout-achat`)

## La demande

Julien : « je veux que quand je relie les paires on me laisse choisir autre chose que les articles achetés choisis par
VRM ». Branche `claude/relier-tout-achat`, partie de `origin/main` (après #1243 relier-taille et #1245).

## La mesure (banc, 3 000 achats inventés — règle de `main` exécutée telle quelle)

Script : les fonctions de `src/suggestionsAchat.js` de `main` sur 3 000 achats (2 comptes, 9 hors relier, 40 déjà reliés).

| ce qui cachait des achats dans « Relier un achat » (`RelierAchatCorps`) | combien |
|---|---|
| la liste entière cachée derrière « Choisir un autre achat » dès qu'UNE suggestion existait | les 2 951 |
| la liste coupée aux **200 plus récents** (`liste.slice(0, 200)`) | **2 751 sur 2 951** inatteignables sans chercher |
| la recherche ne lisait que titre, marque et n° : « 45,00 », « boutique_sud », « 12/11 », « novembre » ⇒ **0** ; « 42 » ⇒ des n° qui contiennent 42 | — |
| les déjà reliés ailleurs : derrière « Déjà reliés · N » tant qu'on ne cherche pas, coupés à 100 | 40 |
| les hors relier (retour, litige, remboursé, annulé — `achatHorsRelier`) : écartés **sans le dire** | 9 |
| filtre « taille » caché sous « Filtres », lu seulement dans le titre (pas la taille lue chez Vinted) | — |

Pas de fenêtre de date ni de filtre de compte côté chargement (`chargerAchats` lit tous les comptes, toutes les dates) ;
les suggestions (`propositionsArticle`) gardent leurs filtres durs — c'est voulu (§5), elles restent EN HAUT.

## Ce qui change

`src/ecrans/Achats.jsx` (`RelierAchatCorps`) :
- **« Suggestions »** en haut (la très probable, « Autres pistes » repliées) ; sans suggestion : « Aucune suggestion :
  VRM ne trouve pas d'achat assez sûr pour cette paire. Choisis-le dans tous tes achats, juste en dessous. »
- **« Tous mes achats · N »** toujours affiché dessous (plus de bouton) : recherche + la phrase de ce qu'elle lit
  (titre, marque, taille, vendeur, prix, date, n°, compte) ; filtres rapides **compte, mois, taille** (deux par rangée
  au téléphone, rien de coupé) ; « Filtres » garde prix payé, date de réception, marque.
- **Par tranches de 60** : la suite arrive en défilant (`IntersectionObserver`, 600 px d'avance) ou « Afficher plus · N
  restants ». 3 000 achats : la feuille s'ouvre et défile sans attendre.
- (2e demande, même jour : « quand un achat est relié je veux qu'il ne soit plus proposé, et qu'on ait un moyen de
  sélectionner les achats déjà reliés, car s'il y a un achat qui comporte 2 articles on le prend en compte ») Un achat
  **relié n'est plus proposé** : ni en suggestion (c'était déjà la règle, `achatDisponible`), ni dans « Tous mes achats ».
  Deux onglets : « **Tous mes achats · N** » / « **Déjà reliés · N** » ; dans « Déjà reliés », chaque achat dit « Relié à
  N°7 » et se prend par « **Choisir** » ⇒ l'app DEMANDE « Le détacher de N°7 ? » (un article n'appartient qu'à une paire,
  `detacherAvantRelier` dans App.jsx ; même si le détenteur ne se retrouve pas).
- **Les lots.** Mesuré en production (lecture seule, projections scalaires, 17 nov.) : `my_orders` n'a AUCUN champ de
  nombre (0 sur 3 327 achats) ; 103 titres commencent par « Lot » (94 avec un nombre) ; sur les 43 détails de transaction
  côté acheteur, 2 ont `items_count` > 1 (jusqu'à 8), `order.items[]` porte le titre (41/43) et la 1re photo (41/43) de
  chaque article. La feuille pose le nombre d'articles sur l'achat (`_nbArticles`) par la règle d'Achats `nombreLot`
  (déclaré > transaction lue > titre) ; `lotDe` le lit d'abord, donc un lot reste proposé (suggestions comprises) jusqu'à
  N liens. La ligne : « Lot · 2 articles · 1 relié », le titre (+ taille, photo) de chaque article (projection
  `n0..n3`, `p0..p3` ajoutée à `SELECT_DETAILS_ACHATS`), « Lot de 2 · 80 € — prix par paire à saisir ». Relier un
  article d'un lot pas complet ne délie JAMAIS un autre article ; un lot complet pris dans « Déjà reliés » demande QUEL
  article détacher (un seul).
- **Le prix d'un lot n'est jamais partagé** (§2.5) : le champ est vide (l'ancienne indication « ÷ 2 ≈ 40 € » est retirée
  de la feuille) ; laissé vide ⇒ l'article est relié, son coût reste « à saisir » (la porte « Coût d'achat · n/N
  renseigné ») ; illisible ⇒ rien n'est relié.
- Les **hors relier** restent exclus, et la feuille le dit : « 5 achats retournés, en litige, remboursés ou annulés
  masqués : ils ne peuvent pas être reliés. » (`exclus`, par raison).
- Titres sur plusieurs lignes (plus de « … »), y compris l'article visé en tête de feuille.

`src/suggestionsAchat.js` : `foinAchat` (ce que la recherche lit : taille lue `tailleDe` sinon écrite, vendeur lu
`vendeurDe` sinon celui de l'achat, prix « 45 » / « 45,00 » / « 45.5 », date « 12/11 », « 12/11/2026 », « novembre »,
compte) ; « taille 43 » / « pointure 42,5 » / « T43 » = la TAILLE (pas deux mots n'importe où) ; `exclus` compté ;
`filtresAchats` lit aussi la taille lue.

`src/App.jsx` : la feuille — `role="dialog"`, hauteur `calc(100dvh - 48px)` (repli 85vh) + zone du geste d'accueil
(`src/styles-relier-tout.css`), défilement contenu (`overscroll-behavior`), la page derrière ne défile plus
(`documentElement.overflow`), « × » 44 × 44 traduit ; `relierAchat` : « Relier quand même » demande TOUJOURS.

Rien n'est jamais relié sans son toucher (§5) : aucune écriture à l'ouverture, au défilement, à la recherche.

Textes : `relierTout.*` dans `src/i18n/langues/{fr,en,es,it,de}/liaison.js`. Quoi de neuf : `relier-tout-achat`.

Défaut d'affichage trouvé en route : une règle globale de `src/design/studio-finition.css` masque tout
`[data-recherche-aide]` (accessibilité de la recherche d'en-tête) — l'aide de la feuille s'appelle donc
`data-relier-recherche-aide`.

## Preuves

- Bancs voisins sur le build final : `relier-taille` 92 / 0, `relier-glisser` 63 / 0.
- Banc `scripts/bancs/relier-tout-achat.cjs` (390 tactile clair et sombre, 1512 clair et sombre ; 3 002 achats sur deux
  comptes, 5 hors relier, 3 déjà reliés à N°7/8/9, 2 lots, 40 détails de transaction servis en PROJECTION) : **40 contrôles
  par passe** (voir l'en-tête du banc) — deux parties sans rien toucher ; 2 995 comptés ; « 5 … masqués » ; recherche visible + 3 filtres ; page
  derrière verrouillée ; rien écrit ; 44 px ; rien de coupé (mesuré aussi : texte des menus et de l'invite) ; pas de
  débord ; feuille entière dans l'écran ; **les 2 995 atteignables en défilant** ; aucun hors relier, même en cherchant
  son n° ; déjà relié grisé « Déjà relié à N°7 » + « Relier quand même » ⇒ confirmation ⇒ Annuler n'écrit rien ;
  recherche par n°, vendeur lu, prix + date, compte, « taille 43 » (titre ET lue) ; filtre taille.
  - Sur le build d'`origin/main` : rouge (voir le rapport de PR).
  - Par mutation : voir le rapport de PR.
- Audits : relier-fiable, achats-relier, liaison-achat, faits-achat, relier-glisser, identite, suggestions-achat,
  achats-hors-relier, deja-relie, plateformes-logo, relier-colis, relier-compte, achats-a-relier, geste-annulable,
  traduction, quoi-de-neuf : verts.

## Mutations (banc à 390, une par règle — chacune doit rougir)

Chaque build muté, banc à 390 (`scratchpad/relier-tout/mutations.py`) — toutes rouges :
M1 un achat relié redevient disponible (`achatDisponible` ⇒ vrai) : 8 rouges (N°8 suggéré, reliés dans la liste) ·
M2 reliés mêlés à la liste par défaut : 7 · M3 pas d'onglet « Déjà reliés » : 5 · M4 nombre d'articles du détail ignoré :
8 (lot absent, « Lot · 2 articles » absent) · M5 prix du lot pré-rempli à la moitié : 2 · M6 détacher sans demander : 4 ·
M7 relier un article du lot délie l'autre : 3. Build d'`origin/main` : rouge (200 achats vus sur 2 995, aucune section).

## Reste

1. « Relier achats et ventes » (`RelierGlisser`) et « Relier ce colis à un achat » n'ont pas encore la recherche large
   ni le rendu par tranches (leur liste n'est pas coupée ; à reprendre si Julien s'y perd).
2. La recherche par date lit l'heure de l'appareil (Paris chez lui).
3. Un lot dont le nombre n'est écrit nulle part (ni titre, ni transaction lue, ni déclaré) reste un achat simple : il le
   déclare dans Achats (« C'est un lot ») — la feuille lit cette déclaration.
4. La page derrière : l'app défile déjà dans un conteneur interne (le `documentElement` est à `overflow: hidden` sur `main`
   aussi) — le verrou posé ici est donc sans effet mesurable ; le banc ne le compte pas.

## ÉTAT À LA REPRISE

Branche `claude/relier-tout-achat`, PR #1255, fusionnée par ce lot (accord du coordinateur). Aucun geste de Julien.
