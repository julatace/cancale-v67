# 16 nov. 2026 · eBay → Achats, la refonte (lot `ebay-achats-refonte`)

Julien, sur 4 captures iPhone d'Achats → eBay : **« Améliore eBay, c'est de la merde. »**

## Ce qui était mesuré (avant, build de `main`, banc `scripts/bancs/ebay-achats-refonte.cjs`, données inventées)

| vue | hauteur de la partie eBay | mots visibles | contraste minimum |
|---|---|---|---|
| 390 px tactile, clair | 2 424 px | 353 | **1,1:1** (« 1 recherche en alerte… », encre sombre du thème JS sur le bleu du verre) |
| 390 px tactile, sombre | 2 401 px | 353 | 4,61:1 (texte d'exemple) |
| 1512 px, clair | 1 887 px | 356 | **1,1:1** |
| 1512 px, sombre | 1 887 px | 355 | 3,28:1 |

La cause : « Nouvelles annonces », « Chercher… », « Ton fil » et l'espace Organisation monté
dans l'onglet étaient posés **à nu sur le fond bleu du verre** avec les couleurs du thème JS
(`C.text` = encre sombre). Sur téléphone, une règle commune (`styles-epure.css`,
`.vrm-app-shell .vrm-main input{background:var(--ep-teinte)!important}`) posait en plus un
fond teinté sans bord sur chaque champ.

## Ce qui est fait (après)

| vue | hauteur | mots | contraste minimum |
|---|---|---|---|
| 390 clair | 1 081 px | 96 | 5,07:1 |
| 390 sombre | 1 081 px | 96 | 6,8:1 |
| 1512 clair | 738 px | 96 | 5,07:1 |
| 1512 sombre | 738 px | 96 | 6,8:1 |

Trois **cartes** de verre (`src/ebay/achats-ebay.css`, encre `--sv-encre`/`--sv-encre-2`) :

1. **Chercher sur eBay** — « Modèle ou marque », « Pointure » (Sneakers seulement), « Prix max,
   port compris » ; état / achat immédiat / livrable en France sous **« Plus de critères »**
   (replié) ; Entrée = Chercher (un `<form>`, `enterKeyHint="search"`), clavier décimal ; à côté
   du bouton, discret : **« 2/200 aujourd'hui »**. Les résultats : photo, prix (port compris ou
   « port non indiqué »), lien eBay 44 px ; « Enregistrer cette recherche ». Le paragraphe
   « Les données » (plafond, quota eBay, Ko) est **replié sous « Détails »**, mot pour mot.
2. **Mes recherches** — remplace l'espace Organisation (`<Operations contexteEbay>`) qui était
   monté ici (« GESTION · Recherches enregistrées · Tes prochaines trouvailles » + une carte
   « Recherches enregistrées · ton fil eBay » : titre dit deux fois). **Une ligne par
   recherche** (nom ; budget · pointure · N nouvelles / N annonces) et l'interrupteur
   **« Me prévenir »** (`role="switch"`, `veille.alerte`). Le détail **au toucher** : ses
   annonces (le fil), ses critères, l'état de son alerte, son prix de revente (facultatif),
   Modifier / Dupliquer / Archiver, ses modifications. « + Ajouter » ouvre la même édition.
   Le menu **« ··· »** : Relire maintenant · Historique (archivées, Restaurer) · Exporter.
3. **Nouvelles annonces** (`src/AlertesEbay.jsx`) — la liste si elle existe ; sinon UNE phrase
   avec le geste (« Rien de nouveau. Touche « Me prévenir » sur une recherche… »).

« Tes achats gagnés sur eBay » (le repli dessous) prend la même carte.

**Aucune règle eBay ne change** : mêmes écritures (`veille.creer/modifier/dupliquer/archiver/
restaurer/alerte`, jugées par `src/operations/metier.js` côté serveur, comparer-et-échanger sur
la révision), même fil (10 recherches, 15 min, plafonds 200 / 150, pannes dites une fois), mêmes
alertes (serveur, chaque heure), port jamais gratuit, VRM n'achète jamais (« Voir sur eBay »).
Le texte « Me prévenir » n'allume plus d'abord un formulaire de prix : l'interrupteur allume
l'alerte avec le prix déjà rangé (sinon la médiane de ses ventes, comme avant) ; le prix se
règle au détail. Textes neufs par `tr()`, 5 langues (`src/i18n/langues/*/ebayachats.js`).

## Preuves

- Banc neuf `scripts/bancs/ebay-achats-refonte.cjs` (390 tactile + 1512, clair + sombre, faux
  eBay) : 3 cartes dans l'ordre, aucun « Recherches enregistrées »/« Gestion », « Les données »
  repliées, quota court, **chaque texte ≥ 4,5:1 (placeholders compris, fond = pire arrêt du
  dégradé du verre)**, champs bordés, fond clair, 44 px, clavier décimal, « Plus de critères »
  replié ; Entrée = Chercher avec les critères ; enregistrer (`veille.creer`, aucun appel eBay de
  plus) ; une ligne par recherche ; « Me prévenir » ⇒ `veille.alerte` ; détail au toucher ;
  édition 44 px ; Exporter/Historique dans le menu seulement ; une nouvelle annonce visible,
  « Retirer », phrase courte. **Vert** sur la branche ; **rouge** sur le build de `main`
  (§6.1, 60+ KO) ; mutations (CSS du build) : voir plus bas.
- `scripts/bancs/alertes-ebay.cjs` porté sur la règle (état de chaque alerte sur la ligne de sa
  recherche, interrupteur + prix de revente au détail) : vert.
- `scripts/bancs/ebay-achats-recherche.cjs` : **déjà rouge sur `main` (36 KO : le bouton
  « Achats » de la coque avait changé)** ; ouvert par `?tab=plat_ebay&section=achats`, porté
  sur la règle (détail ouvert avant de lire une liste, « Détails » ouvert avant « Les données »,
  « dans le fil » = l'interrupteur).

## ÉTAT À LA REPRISE

- Branche `claude/ebay-achats-refonte`. Captures avant/après regardées (390 et 1512, clair et
  sombre) dans le dossier de travail de la session (non versées : le dépôt est public).
- Rien n'attend Julien. À regarder sur son iPhone : la carte « Chercher », une ligne de
  « Mes recherches », l'interrupteur.
- L'espace Organisation (Réglages → Stock et rangement → Organisation → « Veille eBay ») garde
  son ancienne forme : seule la partie eBay → Achats est refaite.
