# 20 nov. 2026 — chantier « ce qui manque » (branche `claude/ce-qui-manque`)

Cinq manques, petits changements ciblés (aucune refonte d'écran, aucune modification de l'extension).

## 1. Vues et favoris des annonces

**Mesuré d'abord** (vraie base, lecture seule, projections) : les dressings `harvest_{uid}_listings` portent DÉJÀ
`view_count` et `favourite_count` sur 407 annonces sur 407 (11 comptes) ; ~2 % de `view_count: 0`, que Vinted renvoie quand
il ne donne plus le nombre (pas su, jamais 0 — règle de `mapWardrobeItem`). Leboncoin : `lbc_listings` ne porte aucun
chiffre (0 annonce sur 194 ; `counters` vide sur « Mes annonces ») — seuls les chiffres de la page « Statistiques » d'une
annonce (`stats`, ext. `lbcStatsAnnonce`) comptent. Vestiaire : `favoris` rangé mais vide (3 sur 3), aucune vue.
⇒ **aucune requête de plus, aucune modification de l'extension** : l'app lit ce que le dressing lu porte.

- `src/vuesFavoris.js` (pur) : le journal `vrm_vues_lues` (synchronisé sur `main`, `SYNC_KEYS` + `CLES_PUBLIEES`) — un point
  daté par la LECTURE du compte (`fetchVintedListings().lu`, passé par `src/articles/sources.js` jusqu'à l'annonce de
  l'article) quand quelque chose change ; une valeur pas sue n'écrase jamais un chiffre (`dernierConnu`) ; une lecture en
  retard ne réécrit rien. `vuesFavorisEnLigne` : totaux des annonces EN LIGNE (règle de chaque site), « gagné aujourd'hui »
  = dernier point d'avant le jour de Paris. `lectureUtile` : rien lu, ou Vinted raté sans une annonce Vinted ⇒ rien noté ni
  publié (les derniers chiffres restent).
- Propriétaire : l'écran Annonces (`src/ecrans/AnnoncesEgalite.jsx`) publie `vrm_vues_favoris` (cet appareil) ; Aujourd'hui
  (carte « Vues et favoris ») la lit : « 465 · +20 aujourd'hui · sur 3 annonces » ; jamais publiée ⇒ « — · ouvre Annonces » ;
  aucun chiffre ⇒ « — · pas fourni par le site ».
- Tableau Annonces : colonnes Vues (montrée par défaut désormais) et Favoris ; « — » porte « pas fourni par le site » au
  survol et à la lecture d'écran (pas une phrase répétée par ligne).

## 2. Valeur du stock au prix affiché

`src/stockValeurAffiche.js` (pur), publiée par Annonces sous `vrm_stock_valeur`, lue par la carte « Stock en ligne »
d'Aujourd'hui (3ᵉ fait « Au prix affiché ») : Σ des prix des articles qui ont au moins une annonce EN LIGNE ; l'article EST le
regroupement par identité (`construireArticles` : annonce Vinted, lien posé, N° — jamais le titre) ⇒ une paire comptée une
fois ; prix = celui de l'annonce Vinted, sinon le PLUS BAS — dit (« prix Vinted, sinon le plus bas ») ; prix illisible ⇒
« sans prix » ; doublon de N° ⇒ jamais sommé ; couverture « sur N », site manquant ⇒ « au moins ».

## 3. Messages en très grand texte (375)

Rouges de `design-v2-messages` (« lea_sne / akers », « disponible » coupé). `LigneConversation` : le pseudo se replie à ses
séparateurs (`nomSecable` : `<wbr>` après `_ . -`), `overflow-wrap: normal` ; en grand texte l'avatar décoratif (initiale)
s'efface, la vignette passe à 40 px et la rangée devient une grille : le pseudo prend TOUTE la largeur (au-dessus de la
vignette ; `.v2m-txt` / `.v2m-l1` en `display: contents`). Banc : l'air « bord gauche » ne juge plus un avatar absent, le
« bord droit » mesure les enfants d'un texte dissous. Sur le build d'avant : 2 rouges (pseudos, mots coupés) ; après : 0.
Reste rouge sur les DEUX builds (avant et après, même écart) : « éteint : messages a le DOM d'avant » — un toast
`data-toast-numeros` présent ou non selon l'instant (l'ancien DOM, pas touché ici).

## 4. Compte bloqué : changer d'avis

Page Extension, groupe du compte Vinted bloqué (« banni » lu) : « Vinted a bloqué ce compte · Ses annonces sont en pause /
gardées / pas encore choisi », puis « Mettre en pause » / « Garder » (coche sur le choix courant), à tout moment pendant le
blocage — la même clé `vrm_comptes_bloques` par `choixPose` (épisode gardé), sur son toucher. Le groupe est déplié d'office.

## 5. Stock

- « Personnaliser » (feuille native, `src/stockV2/StockV2.jsx`) : nom, style (Cartons · Rayonnage · Plan), couleur (4),
  colonnes × rangées (± dans les limites) ; « Enregistrer » ⇒ `s.personnaliserMeuble` ⇒ `enregistrerMeuble`
  (`src/ecrans/Stock.jsx`, extrait de l'éditeur d'hier : même écriture, même question quand un meuble rétréci fait sortir
  des paires). « Modifier le meuble » (l'éditeur complet) reste derrière une rangée.
- « La pièce » : une rangée par meuble, ↑ / ↓ (`placerMeuble`, écriture `ordre`).
- Glisser-déposer à la SOURIS dans le meuble zoomé (`useGlisserCase`) : au-delà de 6 px, la case visée s'allume ; au lâcher
  sur une autre case ⇒ `s.poser` (la pose de « Déplacer » : une case prise DEMANDE) ; Échap annule ; le doigt garde ses
  gestes. Aucun N° changé.

## Preuves

- `node scripts/audit-vues-stock.cjs` : 20 verts, 8 mutations sur 8 rougissent (une paire sur deux sites comptée deux fois,
  prix le plus haut, « à confirmer » comptée, publier sur une lecture ratée ×2, un « pas su » par-dessus le chiffre, point
  daté par l'écran, lecture ratée prise pour une réponse).
- `node scripts/bancs/ce-qui-manque.cjs` : 140 verts, 0 rouge (V vues/stock, R lecture ratée en 503, B compte bloqué,
  S Stock ; 390 tactile et 1512, clair et sombre ; captures regardées). `node scripts/bancs/design-v2-messages.cjs` :
  104 verts, 1 rouge (le toast d'« éteint », rouge aussi sur le build d'avant).
- Audits verts : identite, traduction, tdz, variables, coherence, icones, compte-bloque, extension-claire, stock-*,
  quoi-de-neuf. Rouges AUSSI sur `origin/main` (pas de ce lot) : benefice, coque-parametres, ecrans-restes,
  numeros-nouvelles, offre-annonce-partie, offres-auto.

## Ce qui reste

- La publication vit sur l'appareil qui a ouvert Annonces (comme `vrm_valeur_stock`) : sur un appareil neuf, Aujourd'hui
  dit « — · ouvre Annonces » jusqu'à la première ouverture.
- Le journal ne garde que les lectures que l'app VOIT (une par ouverture d'Annonces) : deux lectures de l'extension entre
  deux visites n'en font qu'une. Un point par lecture côté extension demanderait une ligne dédiée (5.410.0) — pas fait.
- Leboncoin : vues et favoris seulement pour les annonces dont il a ouvert « Statistiques » sur leboncoin.fr.
