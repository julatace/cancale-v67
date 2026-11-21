# 6 nov. — Les bancs rouges d'avant les chantiers du 6 nov. (branche `v36-bancs-preexistants`)

Partie de `claude/project-review-nsk5su` (eeac9f1d). Rien poussé ; ni `vinted-sync-extension/`,
ni `public/`. Données inventées seulement. Arbre d'avant : `git archive claude/project-review-nsk5su`
+ `vite build`, bancs relancés seuls (ports 11550-11599).

Règle suivie (§6) : un rouge est soit un **défaut de l'app** (corrigé, rouge sur l'arbre d'avant →
vert), soit un **banc périmé par une décision écrite** (il juge maintenant la règle actuelle, la
décision est citée dans le banc). Aucun seuil baissé sans raison écrite ; aucun rouge masqué.

## Vrais défauts corrigés (visibles par Julien)

| où | défaut | correction | preuve |
|---|---|---|---|
| Compta → Factures → **Facturation Pro** | l'écran tombait sur le garde-fou (« Cannot read properties of undefined (reading 'etat') ») dès qu'une réponse 200 ne portait pas `boite` (page HTML, autre version du serveur) | `boiteLue` (src/FacturePro.jsx) : sans `boite` lisible = « pas su » (`null`), l'écran le dit ; « Connecter » sur une réponse illisible le dit et relit | avant : `tombe:true` ; après : `data-fp-boite="passu"`, E2 vert (390 et 1512) |
| Paramètres → Mode stream | « Ajouter » grisé sans dire pourquoi (E10 ×3) | `title` « Écris d'abord dans le champ à côté ce qu'il faut cacher. » | E10 rouge avant, vert après |
| Statistiques | textes hors de l'échelle 28/20/15/13/11 : Annulations (12 px), notes (12/17), offres (17 au téléphone), Comparer (12), Frais par site (17) | ramenés à 11 ou 15 (src/stats-vitrine.css, App.jsx) | stats-premium « échelle » rouge avant, vert après |
| Colis → « … » → Suivre un colis par son n° | au téléphone, le 4ᵉ transporteur (« Autre ») sortait de l'écran (segments 368 px dans 332) | `vrm-seg-grille` (styles-coque.css) : 2 × 2 sous 480 px | suivi-colis H rouge avant (`autre` 344→406), vert après (2 × 2) |

## Bancs périmés par une décision (ils jugent la règle actuelle)

| banc | rouges avant | décision qui les périme | correction du banc |
|---|---|---|---|
| tous-boutons 390 | E2, E4, E10×3 | E4 : un radio déjà coché (`aria-checked=true`, Numéros « Nulle part ») ne change rien, comme `aria-pressed`/`aria-selected` | exception ajoutée, `aria-checked` dans la signature |
| tous-boutons 1512 | + E0×3 (feuilles) | nuage seulement en panne (chantier H, 5 nov.) ; plus de widgets sur Ma journée (2 nov.) ; « deux commandes par vente, le reste dans … » (c6b2e1ea) | nuage ouvert sur une lecture de `main` en 503 ; saisie en série depuis Annonces (bandeau ou « Prochain geste ») ; « … » de la vente avant « Relier » |
| annonces-carte | 6 | chantier C (6dd638da) : « Tout afficher » (`data-ann-filtre`), libellés « Prix d'achat / Boost payé / Marge » ; badge dans le nom de l'entrée (729ecd78) ; fiches qui glissent à l'entrée | crochets, casse libre, nom à badge, mesure animations finies |
| dictee | 2 | `ChampRecherche` (bdc7b883) : son micro `data-champ-recherche-micro` | micro d'Annonces par son crochet ; « aucun micro » couvre les deux sortes |
| pave-vinted | 1 | Ventes sans recherche à l'écran (b3d5ed7b, fusion.css §13) | la recherche VISIBLE de l'écran (barre du haut) |
| journee-premium | 1 (376 px) | trois cases (2705c0c5, 3 nov.) + raisons sous « — » (E1, 5 nov.) | juge la règle du 27 oct. : le 1ᵉʳ geste entier au-dessus de la barre du bas ; mutation +110 px ⇒ rouge |
| finition-premium | 1 (30 px à 1280×720) | densité 3/4 de la colonne : 30/28 px (3012b3df) | plancher selon la densité |
| compta-stock-ui | 2 (Stock) | Stock = étagères 2D seules (2026-11-05-stock-2d.md §1) | Stock sans meuble dit quoi faire, « + Créer un meuble » ouvre la création |
| stats-premium | 8 | `montant()` sans « ,00 » (chantier B) ; objectif unique `vrm_objectif_mois` (4 nov.) ; déclaration dans « Déclarer {mois} » (comme stats-compta, ee20bd93) | valeur jugée, pas l'écriture ; bloc objectif ; carte de prévision |
| rapport | 16 | `montant()` sans « ,00 » | montants par valeur |
| vendu-recu | 13 | Ventes s'ouvre sur un site (Plateformes, 5 nov.) ; Statistiques en volets (2 nov.) et tuile « Vendu » (31 oct.) | Ventes · Toutes (`data-carte-*`), tuile `data-sv-tuile="vendu"`, volets ouverts |
| vestiaire-colis | 10 | une liste pour tous les sites (c2f4245f) ; « Bordereau sur Vestiaire » (ff92f91c) ; aucune tuile à zéro (2 nov.) | cartes et bordereau par crochets |
| achats-messages-premium | 4 | Colis à trois onglets (c2f4245f) ; ligne de retrait repliée, « Code » (CarteRelais.jsx, 3 nov.) | « À retirer » touché, code ouvert puis mesuré |
| suivi-colis | 42 | lignes repliées (3 nov.) ; « + Ajouter un n° de suivi » sous « … » (2026-11-06-finitions.md b.) | lignes et sections dépliées, « … » ouvert (H : vrai défaut, ci-dessus) |
| ebay-comptes | 9 | vérification avant publication (b07530a5) ; périmètre de la carte sombre en 1-3 mots (carteChiffres.js) ; « Compte » → Paramètres | « Publier quand même », total des 3 comptes sans en nommer un, vue relue sur eBay |

Tous verts après (tous-boutons : 390 = 0 défaut sur 51 écrans, 1512 = 0 sur 50).

## Ce qui reste

- **vitesse** : plafonds de lectures (62→84 sur Ma journée, etc.), 1 363 Ko de JS+CSS, rendus au
  démarrage, héros `data-vendu-mois` : non traité ici — c'est le chantier « nombre de requêtes »
  (`v36-charge`) et `2026-11-06-vitesse2.md` ; à reprendre après leur fusion.
- Rouges vus en passant, **identiques sur l'arbre d'avant**, hors liste : `compact` (ligne repliée
  de Ventes, « nom entier false »), `transporteurs` F n° 8 (« Reçus 1,7 k » sur une ligne).
- `argent-mois` est vert sur les deux arbres : son exception de `scripts/audits-exceptions.json`
  peut être retirée.
- Observé : la case « À imprimer » de Colis ne compte pas un bordereau Vestiaire non imprimé
  (2 à envoyer, 0 à imprimer, banc vestiaire-colis) — à vérifier contre `lignesLot()`.

Audits : build, `audit-coherence`, `audit-identite`, `audit-tdz`, `audit-variables`,
`audit-garde-ecrans`, `audit-facture-pro`, `audit-routes-revue`, `audit-vendeur-neutre` verts.
Bancs voisins relancés : facture-pro, mode-stream, compta-stats-coherence, argent-mois,
stats-compta, composants verts.
