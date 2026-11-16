# 16 nov. 2026 — lot `barre-achats` : Achats dans la barre, plus aucun glisser entre onglets

## Les deux demandes de Julien (capture iPhone : en glissant du doigt, l'écran passait d'Argent à Ma journée à moitié)
1. « Je ne veux pas qu'on puisse glisser entre les onglets. »
2. « Si on peut, ajoute les Achats dans la barre en bas. »

## Ce qui glissait vraiment (mesuré)
- Le balayage de VRM entre onglets est retiré depuis le 9 nov. (PR #1074) : aucun `touchstart`
  de la coque ne change d'onglet (tenu par `audit-barre-achats` B3). Aucun carrousel d'écrans,
  aucun `scroll-snap` entre écrans (les écrans gardés sont DÉTACHÉS du document,
  src/ecransGardes.jsx), aucune animation de côté au changement d'écran.
- Ce qui restait : le **glisser du NAVIGATEUR** (« page précédente »). Depuis le 18 oct., chaque
  toucher de la barre empilait une entrée d'historique (`pushState`). Un glisser horizontal sur le
  contenu (Chrome au doigt), ou depuis le bord gauche (Safari sur iPhone), montre alors l'entrée
  d'avant, en direct, à moitié pendant le geste : exactement « Argent ⇒ Ma journée à moitié ».
  **Reproduit** par le banc sur le code d'avant : un vrai toucher (CDP `Input.dispatchTouchEvent`)
  glissé de côté sur Argent ⇒ l'écran devient Ma journée (`A6 … {"avant":"compta","apres":"journee"}`).

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
- **Rien ne part de côté** : `<main>` porte `overscroll-behavior-x: none` et `touch-action: pan-y
  pinch-zoom` — le navigateur ne fait plus de son glisser horizontal une « page précédente » ; un
  glisser appartient au premier conteneur qui défile sous le doigt, donc les rangées qui défilent de
  côté (filtres, photos, frises) gardent le leur (mesuré au vrai toucher par le banc, A8). Le glisser
  depuis le bord d'iOS est un geste du système (il ne se bloque pas depuis une page) : c'est le
  remplacement d'historique qui lui retire l'onglet d'avant.
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
- `node scripts/audit-barre-achats.cjs` : 11 ✅ ; sur origin/main (`--dossier`) : rouge (barre à 4,
  Achats allumant « Paires », aucun remplacement d'historique, ni overscroll-x ni touch-action).
- `scripts/bancs/barre-achats.cjs` (390 et 320 tactiles, clair/sombre ; liens à 390 et 1512) :
  **81 ✅ 0 ❌** ; sur le code d'avant (dist de origin/main) : **33 ❌** (dont A6 qui reproduit la
  capture de Julien : Argent ⇒ Ma journée).
- Mutations (bundle construit, une règle réaffaiblie, `ba-mut.sh`) : historique toujours empilé ⇒
  A5 rouge (4 ❌, l'historique grossit à chaque onglet) ; `touch-action` retiré ⇒ A6 rouge (12 ❌, le
  glisser quitte l'app) ; Achats remis dans `ECRANS_PAIRES` ⇒ A4 et L rouges (8 ❌, « Paires »
  allumé sur Achats).
- Captures regardées : 390 et 320 (clair, sombre) — cinq libellés entiers, Achats allumé sur Achats ;
  1512 — Achats allumé dans la colonne. Le disque « + » est un peu à droite du centre (5 onglets +
  disque : 3 à gauche, 2 à droite) — accepté pour garder chaque cible ≥ 44 px.

## ÉTAT À LA REPRISE
- **PR #1201 ouverte, NON fusionnée** (règle du 16 nov. : zéro rouge pour fusionner). La CI de `main` est déjà
  rouge sur tous les jobs que ce lot touche (Audits 1-3, Bancs 1-3, parcours-critiques) ; comparée ligne à ligne à
  celle de la PR #1181 (dernier main) : **aucun rouge nouveau** — Audits 69 KO contre 70 (extension-zip réparé),
  Bancs 1 identique (nouveau-vendeur 18 défauts), Bancs 3 : 5 lignes de main réparées (iphone-reprise « aucun
  libellé coupé » ×4, colis-retirer-propre « pastille d'Achats ») et seule différence la garde réseau
  d'accessibilite-clavier (12 requêtes au lieu de 8, même rouge) ; Bancs 2 coupé à 45 min (comme sur main) avant
  d'atteindre `barre-achats` ; parcours-critiques : mêmes échecs, mêmes messages.
- En local (machine saturée) : audits 70 KO, tous KO aussi sur origin/main ; `barre-achats` 85 ✅ ; `studio-coque`
  0 ❌ ; `navigation-tache` exactement les 14 rouges d'avant ; `refonte-coque` : H2 (déjà rouge avant) ; la partie R
  d'`iphone-reprise` (reprise) varie d'un passage à l'autre sous la charge (jamais la même ligne).
- À faire pour fusionner : remettre `main` au vert (hors de ce lot) ou décision de Julien ; puis vrai merge de
  origin/main, CI, fusion. Allonger le délai du job Bancs 2 (45 min) pour que `barre-achats` y tourne.
- Geste de Julien : aucun. À regarder sur SON iPhone après la mise en ligne : glisser depuis le bord sur Argent ne
  doit plus montrer Ma journée ; Achats est dans la barre.
