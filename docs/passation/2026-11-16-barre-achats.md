# 16 nov. 2026 — lot `barre-achats` : Achats dans la barre, plus aucun glisser entre onglets

## Les deux demandes de Julien (capture iPhone : en glissant du doigt, l'écran passait d'Argent à Ma journée à moitié)
1. « Je ne veux pas qu'on puisse glisser entre les onglets. »
2. « Si on peut, ajoute les Achats dans la barre en bas. »

## Ce qui glissait vraiment (mesuré dans le code)
- Le balayage de VRM entre onglets est retiré depuis le 9 nov. (PR #1074) : aucun `touchstart`
  de la coque ne change d'onglet (vérifié, et tenu par `audit-barre-achats` B3). Aucun carrousel
  d'écrans, aucun `scroll-snap` entre écrans (les écrans gardés sont DÉTACHÉS du document,
  src/ecransGardes.jsx), aucune animation de côté au changement d'écran.
- Ce qui restait : le **retour du système**. Depuis le 18 oct., chaque toucher de la barre
  empilait une entrée d'historique (`pushState`). Le glisser depuis le bord gauche (Safari sur
  iPhone, et l'app installée là où iOS le permet) montre alors l'entrée d'avant, en direct, à
  moitié pendant le geste : exactement « Argent ⇒ Ma journée à moitié ».

## Ce qui est fait
- **Historique** (`src/navHistorique.js`, `entreeHistorique`) : d'un onglet de la barre à un autre
  (Annonces ↔ Stock, Argent ↔ Statistiques, Ma semaine, Litiges compris), l'entrée est
  **remplacée** — comme une barre d'onglets native, le retour n'a plus d'onglet voisin à montrer.
  Le retour reste entier pour le reste : une feuille se ferme (son entrée n'est jamais écrasée),
  un écran du menu (Messages, E-mails, Paramètres, Communauté…) revient à l'écran d'où on l'a
  ouvert. Le geste lui-même n'est ni bloqué ni intercepté.
  ⚠️ Conséquence voulue : « retour » depuis Argent n'emmène plus à Ventes puis à Ma journée
  (la règle du 18 oct., B9 d'`iphone-reprise`, portée sur la nouvelle règle). Si Julien veut
  retrouver ce retour-là, c'est la ligne `replaceState` de la coque — mais il revient alors avec
  le glisser à moitié.
- **Rien ne part de côté** : `<main>` porte `overscroll-behavior-x: none` (la racine avait déjà
  `overscroll-behavior: none`) ; les rangées qui défilent de côté gardent leur défilement
  (`contain`), mesuré au doigt par le banc.
- **Achats dans la barre** : Aujourd'hui · Annonces · Achats · ( + ) · Ventes · Argent. Même entrée
  que le menu (`ONGLET_ACHATS`, `nav.achats`), icône `cart`, pastille = « À retirer » publié
  (`vrm_colis_retirer`, comme avant sur le segment). « Paires » = Annonces · Stock
  (`ECRANS_PAIRES`) ; le sélecteur ne porte plus Achats et se tait s'il n'a qu'un segment.
  L'onglet allumé est TOUJOURS celui de l'écran (Achats ⇒ Achats, plus « Annonces ») ; les
  anciens liens `?tab=retraits`, `?tab=cat_achats` mènent à Achats et l'allument. Aplat de
  l'espace : celui des paires (`espace.js`, aucune teinte de plus). Ordinateur : Achats était déjà
  dans la colonne (groupe « Ranger ») — inchangé.
- **320 px** (iPhone SE 1re génération) : marges de la barre et du disque resserrées sous 360 px
  pour garder chaque cible ≥ 44 px (voir `src/design/studio.css`, « barre-achats »).
- Bancs portés sur la règle : `iphone-reprise` (B9, R2), `refonte-coque` (N : cinq onglets, Achats
  joint en 1 toucher, son onglet allumé et son nombre), `studio-coque` (cinq onglets),
  `_ergonomie-gestes-liste` (Achats → À retirer).
- « Quoi de neuf » : `barre-achats`.

## Preuves
- `node scripts/audit-barre-achats.cjs` : 10 ✅ ; sur origin/main (`--dossier`) : 8 ❌.
- `scripts/bancs/barre-achats.cjs` (390 tactile et 320 tactile, clair/sombre ; liens 390 et 1512) —
  chiffres dans la PR.
- Mutations : voir la PR.

## ÉTAT À LA REPRISE
- Voir la PR du lot (fusionnée ou non, dit dans le rapport). Geste de Julien : aucun (l'app se met à jour).
- À regarder sur SON iPhone : glisser depuis le bord sur Argent ne doit plus montrer Ma journée.
