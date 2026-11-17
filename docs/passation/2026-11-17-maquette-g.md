# Maquette G — « Le tableau » (17 nov. 2026)

Demande de Julien (17 nov.) : « j'aime bien le C, propose encore plein d'autres maquettes » ; puis « change tout,
même la disposition des boutons » ; puis « parfait, minimaliste et simple ». G garde le **style Studio de C**
(fond bleu, rail souligné, porcelaine, plaque N°) et change l'**organisation** : les paires avancent en
colonnes d'étapes, comme un tableau Kanban.

C'est une **proposition**, pas une livraison : aucune PR. Branche `claude/maquette-g` (partie de
`claude/onglets-design-c`).

## Ce que c'est
- **Huit étapes** : Achetées · À ranger · En ligne · Vendues · À envoyer · En route · Payées · À vérifier, le
  nombre sur chacune. Une carte = une paire (photo, N°, titre, état, prix).
- **Téléphone** : une étape par écran, le rail souligné en haut (comme C), on glisse au doigt vers la voisine.
  En haut, seulement le titre et un « ? ».
- **Les boutons au pouce** : une barre en bas — Chercher · LE geste en série de l'étape (Imprimer 6, Baisser 14
  prix, Retirer 2, Ranger 8, Vérifier 11) · Argent. Aucun bouton dans une carte : la carte entière se touche et
  ouvre la paire (son geste vient au même endroit, en bas). Une étape sans geste (Vendues, En route) n'a pas de
  bouton plein : il n'y a rien à faire.
- **Ordinateur** : toutes les colonnes côte à côte ; un seul bouton plein (Imprimer, en tête d'« À envoyer ») ;
  la recherche ⌘K et Argent en haut. Inspirations (principes, rien de copié) : Linear (colonnes denses,
  compte à côté du nom, ⌘K), un tableau Kanban (la carte = l'objet) — sans son glisser-déposer.

## L'étape est CALCULÉE (src/maquettes/g/etapes.js, module pur)
Jamais posée à la main, jamais devinée. Identité §5 : la fiche N° par l'id de SON annonce, la vente par
`item_id`, le bordereau par le n° de transaction, l'achat par `buyFromId`.
- Achetées : achat vivant pas arrivé ; « au point relais » seulement sur le STATUT (jamais `needs_action`).
- À ranger : brouillon numéroté (avec ou sans case), ou achat arrivé depuis < 30 j relié à aucun N°.
- En ligne : annonce ouverte, lecture du dressing < 24 h ; > 60 j ⇒ ambre « Baisser ».
- Vendues : vente prouvée (état non vide, pas `PAS_UNE_VENTE`), à poster, bordereau pas encore reçu.
- À envoyer : la même, bordereau reçu ; date limite LUE sur le bordereau (sinon « pas lue »).
- En route : vente vivante, colis parti. Payées : finalisée (date de versement = transaction 450 ; pas lue ⇒ dit),
  30 derniers jours.
- À vérifier : deux paires présentes sous un N° (le seul rouge), dressing lu il y a plus de 24 h, masquée par
  Vinted, annonce fermée sans vente lue, vente annulée, colis qui revient, anciens achats jamais reliés.
- Une conversation (état vide) n'est pas une vente : la paire reste « En ligne » (cas servi par le banc).
⚠️ Les règles `PAS_UNE_VENTE`, `COLIS_DEJA_BOUGE`, `venteQuiRevient`, `venteVivante` sont **recopiées** d'App.jsx
(non exportées). Si G est retenue, elles sortent d'App.jsx dans un module partagé — jamais une 2e version.

## Ce que ça casse (si Julien la retient)
- **La barre du bas à 5 onglets** (Aujourd'hui · Annonces · Achats · Ventes · Argent) et le **disque « + »**
  disparaissent : la barre au pouce les remplace (Chercher · geste · Argent).
- **Ma journée** (le chiffre du jour, la semaine, Vendu/Reçu/Bénéfice) n'a plus d'écran : à loger dans Argent ou
  en tête du tableau.
- **Messages, Colis à retirer (codes), Stock 3D, Leboncoin / eBay / Vestiaire, Paramètres** passent derrière la
  loupe ou un menu ; pas maquettés.
- Les listes longues d'aujourd'hui (filtres, sélection en série, tris) deviennent des colonnes : « En ligne » à
  1 000 paires demande la recherche et les filtres DANS la colonne (pas maquetté).
- Textes en français seulement (prototype) : à passer par `tr()` si retenue.

## Comment la voir
`npm run build && SHOTS=/tmp/g node scripts/bancs/maquette-g.cjs` — base inventée (3 comptes, ~150 paires, un
cas par règle). Le prototype n'est monté que si l'appareil porte `vrm_banc_maquette` = 'g' (posé par le banc,
`src/main.jsx`) : invisible pour Julien.
Mesures du banc (390 tactile et 1512, clair et sombre) : 1 bouton plein visible au plus, aucune cible < 44 px au
téléphone, 1re carte à 180 px (≤ 422), aucun « undefined/NaN », les deux N° 57 dans « À vérifier ».
