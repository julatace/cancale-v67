# 28 nov. 2026 — Sneakers : référence fabricant, pointure, cote VRM, étiquettes, entonnoir, en masse (`claude/sneakers-cote`)

Copié des outils sneakers américains (Payout, Resellify, Sneaker Portal, SyncKicks, Retailed) et de Vendoo / Bleam /
Vintedge pour la masse et les étiquettes (comparatif du 28 nov., lignes A1, A2, A4, A8, A10). Tout est dans
`src/sneakers/` ; l'extension n'est PAS modifiée.

## Les décisions de Julien du jour
- « On ne peut pas faire sans clé ? » puis « je ne veux pas avoir à mettre de clé, ni ceux des utilisateurs,
  débrouille-toi ». ⇒ **La cote est la cote « VRM »**, calculée sur SES PROPRES ventes passées (Vinted + eBay ; toutes
  ses ventes captées), même référence + même pointure, sinon même référence toutes pointures. **StockX : pas sans clé,
  écarté sur décision du 28 nov.** — aucune clé, aucun champ, aucune route serveur, aucune lecture de stockx.com
  (anti-robot + conditions d'utilisation), rien par l'extension. `audit-sneakers` §S le tient.
- Rappel §3 : « prix conseillé à la mise en ligne » reste REFUSÉ (11 oct.). La cote se montre à l'ACHAT et dans la
  VALEUR DU STOCK, jamais sur un écran de publication ni sur la fiche d'une annonce (`audit-sneakers` §L, mutation ⇒ rouge).

## S1 — Référence fabricant et pointure (`src/sneakers/reference.js`, `BlocFiche.jsx`)
- Formes reconnues : Nike `DD1391-100`, Jordan `555088-134` (tiret EXIGÉ : un code postal ou un n° de suivi n'est
  jamais une référence), adidas `GZ1234` / `B37571`, New Balance `M990GL6`. Tapée à la main : aussi une forme libre
  (Asics `1201A789-020`…), jamais proposée depuis un titre.
- Pointure normalisée `{ sys: EU|US|UK, val }` (« 42,5 », « 42 2/3 », « US 9 », « T44 »). Conversion US/UK → EU
  seulement par la table Nike homme et pour une référence Nike/Jordan, DITE (« table Nike homme ») ; sinon deux
  systèmes ne se comparent pas.
- Fiche d'un N° : rubrique « Modèle » (référence, pointure, étiquettes). Les références lues dans le titre sont des
  PUCES ; une seule lue ⇒ proposée ; deux ⇒ « choisis la bonne ». Rien n'est posé sans son toucher.
- ⚠️ §5 : la référence désigne un MODÈLE. Rangée SOUS le N° (`vrm_sneakers.fiches[N°]`), jamais l'inverse ; aucune
  vente ne reçoit un N° par sa référence (`audit-sneakers` I1–I6 : 50 paires de même référence ; `audit-identite` vert).
- Statistiques : la référence qui compte = celle qu'il a posée, sinon l'UNIQUE lue dans le titre (`refEffective`).

## S2 — Cote VRM (`src/sneakers/cote.js`, `CoteAchat.jsx`, `FeuilleSneakers.jsx`)
- `coteVRM` : médiane, nombre, min/max, dernière vente DATÉE, délai moyen (seulement les ventes dont la date de mise en
  ligne de SON annonce est lue, nombre dit), fenêtre 12 mois ; moins de 2 ventes à la pointure ⇒ toutes pointures
  (niveau dit). Zéro vente ⇒ `medianeC: null` : « pas encore de vente de cette référence », rien n'est estimé.
- Autre devise, prix pas lu ⇒ écartée (jamais 0 €, jamais convertie).
- À l'ACHAT : la calculette (Achats → Calculette, ⌘K « Voir ce que vaut une référence ») a deux champs Référence /
  Pointure ; elle dit la cote, la « marge possible » avant frais, et « Prendre X € comme revente » remplit la revente
  (la calculette ajoute les frais lus).
- VALEUR DU STOCK : Argent → Prix qui marche → « Cote VRM, valeur du stock, en masse » ⇒ feuille Sneakers · Valeur :
  « Valeur estimée », « N sur M cotées », sans référence / sans vente NOMMÉS, une ligne par référence.
- Sources (`App.jsx`, `poserSourcesSneakers`, lues à la demande, mémo 10 min) : `harvest_*_orders_sold` (projeté
  `my_orders`, annulées écartées, `montantCommandeLu`), N° de la vente par `vinted_annonce_numeros[item_id]`, date de
  mise en ligne par le dressing (`created_at_ts`), `ebay_orders` (ligne en euros, N° par SKU `VRM-{n°}`).

## S3 — En masse (`src/sneakers/masse.js`, feuille Sneakers · En masse ; Annonces → Actions → « Modifier en masse »)
- Cocher (tous sites, filtres site + étiquette) ⇒ −x % / prix / marque / pointure / référence ⇒ récapitulatif ligne par
  ligne ⇒ SON « Appliquer » (confirmation).
- Plancher : prix mini, sinon achat + 10 % ; sous le plancher ⇒ ne part pas ; sans plancher connu ⇒ seulement s'il
  coche « Envoyer aussi N annonces sans plancher ».
- eBay : la route `revise` existante (`envoisPrix(...).ebay`, prix vu, confirmé).
- Vinted / Leboncoin / Vestiaire : **la file que l'extension exécute déjà** — `envoyerGeste` de `src/agir/porte.js`
  (geste `baisser`, file `prix`, args `{ id, prix, prixAvant }`, au nom du compte de SON annonce) : le même chemin que
  « Paires qui dorment » (27 nov.). La porte dit non (compte pas joignable) ⇒ « Ouvrir N sur Vinted dans l'extension »
  (`lienPanneau`, page Prix, la sélection). Une HAUSSE ne passe jamais par la file : le panneau.
- ⚠️ Pas de `cmd_prix_*` rangée par l'app : la décision du 20 nov. (« plus de baisse rangée par l'app ») et
  `audit-actions-app` l'interdisent ; la file « À distance » (`cmd_dist_*`) est le chemin permis depuis le 24 nov.
- Marque / pointure / référence : écrites dans VRM seulement (la fiche du N°), rien n'est envoyé aux sites (dit) ;
  une annonce sans N° n'est pas écrite (dit).

## S4 — Étiquettes et entonnoir (`src/sneakers/tags.js`, `entonnoir.js`)
- Étiquettes libres (50 au plus), couleurs douces (gris, bleu, vert, sable, ardoise, turquoise ; ni rouge, ni violet,
  ni ambre — §7), posées sur un N° (fiche ou sélection), comptées sur les paires présentes numérotées, filtre de la masse.
  Écran seulement : aucune étiquette imprimée (refus du 11 oct.).
- Entonnoir vues → favoris → ventes par référence (annonces Vinted) ; vente comptée par IDENTITÉ (`item_id` = annonce) ;
  vues/favoris pas lus hors somme, couverture « lues sur N » ; taux « — » si la couverture n'est pas complète ;
  sans référence = un groupe à part.

## Rangé
- `vrm_sneakers` (SYNC_KEYS) : `{ v, fiches: { [N°]: { ref, pointure, marque, at } }, tags, poses: { [N°]: [id] } }`,
  écrit sur SON geste seulement.
- Traductions : `src/i18n/langues/{fr,en,es,it,de}/sneakers.js` (clés `snk.*`).

## Preuves
- `node scripts/audit-sneakers.cjs` (44 contrôles) · `--mutation` (19 mutations, toutes rouges).
- Verts : audit-traduction, tdz, variables, quoi-de-neuf, identite, urssaf, fonctions-api, actions-app, boutons-natifs,
  coherence ; build.
- Banc : `scripts/bancs/sneakers.cjs` (390 tactile et 1512, clair et sombre : fiche « Modèle », calculette, feuille
  Valeur et En masse), données fabriquées dans le banc, aucune donnée réelle.

## Ce qui reste
- Leboncoin / Vestiaire en masse : seulement quand l'écran Annonces a construit ses articles (sinon Vinted + eBay).
- Ventes Leboncoin / Vestiaire pas encore dans la cote (titres seulement, prix de vente à relire par leurs règles).
- Geste de Julien : aucun.
