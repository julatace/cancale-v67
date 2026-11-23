# Intégration du 20 nov. — branche `claude/integration-20nov`

Julien : « Met tout en ligne ». Un train, partie d'`origin/main` (9671c8423), fusions par de VRAIS `git merge --no-edit`
(jamais `-s ours`), dans cet ordre, chaque fusion commitée et poussée :

1. `claude/boutons-natifs` (76a2ab87a)
2. `claude/relier-depuis-liste` (eeb8a4a19)
3. `claude/retraits-visuel` (b50582f1e)
4. `claude/ce-qui-manque` (8f6c3951c)
5. `claude/arrivee-scan` (e0c5ed53d)
6. `claude/demarrage-store` (5ab09e583)
7. `claude/chasse-bugs` (eccbe7d87), puis par-dessus `claude/chasse-bugs-2` (f0c7ec624, en DERNIER, refetchée juste avant) —
   ajoutées en cours de train par la coordination. Conflit de chasse-bugs-2 : `achats-v2.css` — la règle d'avant du « ⋯ »
   d'un achat reste retirée (boutons-natifs : `BoutonIcone` natif, 44 × 44 par lui-même).

**Pas dans ce train** : `actions-extension`, `panneau-vintex`, `lbc-vc-interesses` (ils demandent l'extension 5.410 : train
suivant) ; `minimaliste`, `argent-natif`, `iphone-rapide`, `repub-messages-malins` (en cours). Aucune des sept ne dépend
d'elles : aucune ne touche `vinted-sync-extension/` ni `EXT_CAPACITES` (extension servie inchangée : **5.409.0**) ;
`minimaliste` CONTIENT boutons-natifs et relier-depuis-liste (pas l'inverse).

## Conflits et leur résolution

| fichier | fusion | résolution |
|---|---|---|
| `CLAUDE.md` §9 | 3, 4, 5, 6, 7 | les deux côtés (une ligne par lot) |
| `src/nouveautes.js` | 2, 4, 5, 6 | les deux côtés |
| `src/i18n/langues/{fr,en,es,it,de}.js` | 6 | les deux dictionnaires (`arriveeScan`, `demarrage`) |
| `src/ecrans/AnnoncesEgalite.jsx` (import d'App) | 2, 4 | union : `annonceLbcALui`, `comptesLbc*` (main) + `PhotoVinted` (relier) + `save`, `AUTH` (ce-qui-manque) |
| `src/stockV2/StockV2.jsx` (import natif) | 5 | `Champ` (ce-qui-manque) + `ArrivesARanger`, `ouvrirRetrouver` (arrivee-scan) |
| `src/GuideDemarrage.jsx` (`BandeauExemple`) | 6 | le geste en LIEN texte de demarrage-store (NATIF §1 bis : jamais un second plein) remplace le `BoutonBase primaire` de boutons-natifs |
| `scripts/audit-stockage-sur.cjs` (plafonds) | 7 | plafonds de chasse-bugs sans `ParcoursNouveau.jsx` (supprimé par demarrage-store) ; + `ArriveeAchat.jsx` 3 et `LigneConversation.jsx` 1, nommés (positions d'un lot, morceaux d'un pseudo) |

`CLAUDE.md` dépassait 60 000 octets (60 416) : les trois lignes les plus anciennes du 19 nov. (§9) sont déplacées telles
quelles à la fin de `historique-divers.md`.

## Ce que la fusion a cassé, et réparé ici

- **Écran d'arrivée, 30–34 px au doigt** (banc arrivee-scan) : boutons-natifs a restreint le renvoi `all: revert-layer` de
  `src/coque-native.css` aux contrôles `n-…`/sans classe ; les `arv-…` (feuille d'arrivée) et `sm-…` (meuble dessiné),
  dessinés dans la couche `vrm-natif`, retombaient sous une règle d'avant sans couche. Ajoutés à la liste.
- **Achats : « Retrouver un colis » recouvert** (banc design-v2 T) : arrivee-scan posait un second hôte
  `.vrm-tache-retrouver` (« Arrivée ») au même endroit absolu ; le rond « Arrivée » est maintenant DANS l'hôte de
  « Retrouver » (côte à côte), et son icône `box` existe dans `TRAITS` (le rond était vide).
- **Annonces à 1512 : le tableau passait sous le bord** (banc liaison-sites R1) : Vues + Favoris (ce-qui-manque) + Liaison
  (relier-depuis-liste) ; le titre d'un article fixait la largeur minimale de sa colonne. `.n-tt-article-texte` en
  `contain: inline-size` : le titre s'abrège, cases et Statut restent visibles (`src/natif/tableau.css`).
- **Barre du trajet des colis à retirer** : « Payé », « Expédié »… en `--n-encre-3` (2,9–3,5:1) ⇒ `--n-encre-2`
  (banc design-v2 C).
- **Démarrage 2 023 Ko > 2 005** : `RetraitsPoints` / `RienARetirer` chargés à la demande (2 016) ; budget 2 020
  (`scripts/budget-vitesse.json` ; main 2 004, les lots ajoutent ~12 Ko aux cinq onglets).
- **Paramètres : deux lignes à l'icône `play`** (« Bien démarrer » et « Visite ») : `door` pour « Bien démarrer ».
- **« Bien démarrer » : anneau de focus autour du titre** : la règle `!important` de la couche `vrm-a11y` passait devant
  celle de `demarrage.css` ; exception nommée pour `#dm-titre` (focus de lecteur d'écran, rien à toucher).
- **`MeubleDessin` coupait « B230 » en « B23 »** au téléphone : la taille du N° suit la largeur de la case ET le nombre de
  caractères (`--sm-len`). Contrôle ajouté au banc arrivee-scan : rouge avant (« B230 76>68 »), vert après.
- **Ouverture** (demande de la coordination) : le manifeste était encore bleu (`#174C88` / `#2563A8`) ⇒ `--n-fond`
  `#F2F2F7` ; `audit-ouverture` §6 juge le fond natif (`src/natif/jetons.css`) au lieu du verre (mutations rouges).

Audits remis sur leur règle (la règle n'a pas bougé, sa forme si) : `audit-colis-achat-auto` G10 (`RetraitsPoints` a remplacé
`PassesRetraitV2`), `audit-raccourcis-clavier` (nom lu de `BoutonBase` par ses deux chemins natifs), `audit-studio` S7
(`BoutonIcone` natif, `key` du scanner), `audit-politique-hotes` (liens d'itinéraire de `retraitsVue.js`). Chacun prouvé
par mutation.

Bancs : `atelier-arrivee` réécrit sur le nouveau départ (« J'ai retiré » ⇒ écran d'arrivée, N° + case en un geste ;
« 1 paire à finir » ⇒ l'atelier reprend AUX PHOTOS) — 117 verts, rouge sur main (W1) ; `ce-qui-manque` attend le point de
la lecture au lieu de lire trop tôt ; `design-v2` : un « à vérifier » retenu (retraits-visuel) n'est pas « à retirer »,
un contrôle `n-…` est natif ; `liaison-sites` nomme l'élément qui déborde ; `lisible-partout` ouvre aussi la page
Extension et « Bien démarrer ».

## Rouges restants (tous déjà rouges sur `origin/main`)

Les 745 audits passés sur l'arbre intégré ET sur `git archive origin/main` : restent rouges, déjà rouges sur main pour la
même raison (message identique) — `chemin-json-guillemets` (background.js `->${owner}`), `config-facture`, `relier-fiable`
D4, `vendeur-generaliste` (4), `vocabulaire-article` (1). Bancs : `design-v2` a exactement les rouges de main (34) ;
`lisible-partout` en a moins que main (les défauts restants : le toast « N nouvelles paires numérotées » posé sur une
rangée au moment de la mesure, et le thème sombre que le banc perd après Annonces — les deux aussi sur main).

⚠️ Un audit régénère `public/VRM-*.zip` dans l'arbre où il tourne : ne pas les commiter (restaurés ici).
