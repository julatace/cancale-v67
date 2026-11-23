# 17 nov. 2026 — Onglets rapides (PR #1250, branche `claude/onglets-rapides`)

Julien, sur iPhone en production : « beaucoup trop long entre les onglets, c'est catastrophique » ; « Quand ça charge
tout bouge bizarrement » (Ma journée). Aucune règle métier touchée. Base de production non lue. Bancs sur base INVENTÉE
(`_base-volume`, 2 000 ventes, 1 000 annonces, 7 comptes), 390 tactile, processeur ×4, 4G (9 Mb/s, 60 ms).

## ÉTAT À LA REPRISE
PR #1250 ouverte, NON fusionnée. Banc `onglets-rapides` encore ROUGE aux seuils 100 / 300 ms (voir §3) : le gain est
net, le seuil n'est pas atteint. Reste : le calcul de `Comptabilite` au montage, Annonces non gardé, la structure de
l'instantané de Ma journée (§4).

## 1. Les causes, mesurées
- **Le toucher restylait tout le document.** Trace Chrome (Argent → Ventes) : l'image qui suit le toucher passait 2,5 à
  4,2 s en recalcul de style (« Affected by :has() » sur HTML et BODY, « invalidates subtree »). `onduler()`
  (src/design/ondulation.js) INSÉRAIT un anneau sous `<body>` à chaque changement d'espace, et le retirait 620 ms après.
  La feuille porte ~440 règles `:has(…)` dont des `html:has(…)` : une insertion sous `<body>` restyle tout.
- **Achats et Ventes étaient remontés à chaque retour.** Banc `latence-gestes` (instrumenté : le nœud de l'écran est-il
  le même ?) : « meme=false » à chaque retour. La publication `vrm_a_trancher` (réécrite en passant par Ma journée et la
  coque, deux publieurs de la source « supprimés Vinted ») déclenchait `perimer()` (src/ecransGardes.jsx).
- **`panel_num_reserves`** : jusqu'à 5 lectures à l'ouverture d'Achats (chasse aux bugs).
- (Mesuré, pas changé) le grand chiffre `ajusterChiffre` force une mise en page de 1,2 à 2,2 s au ×4 sur Ventes : c'est
  le coût d'une mise en page du document (≈ 7 000 nœuds, ~10 900 règles dont ~440 `:has`), pas la fonction.

## 2. Ce qui change
1. src/design/ondulation.js : UN anneau, posé au repos (`preparerOndulation`, appelé par la barre du bas) ou au premier
   toucher, puis REJOUÉ (géométrie en style en ligne + `getAnimations()` cancel/play). Plus d'insertion, plus de retrait,
   plus de `void main.offsetWidth`. Même dessin/durée/courbe ; mouvement réduit : rien. `data-sb-onde` compte les
   ondulations ; le banc `studio-coque` compte un anneau rejoué comme un anneau inséré.
2. src/ecransGardes.jsx : `vrm_a_trancher` parmi les clés neutres. Ses lecteurs (`useATrancher` dans App.jsx,
   src/SanteDonnees.jsx) l'écoutent en direct (`vrm:save`) : un écran gardé se met à jour à son retour.
3. src/lectureEnVol.js : une lecture EN VOL par clé (rien gardé après l'arrivée ; `vrm:ext` fait repartir) ;
   `lireReservesNum()` (App.jsx) remplace les 4 lectures directes de `panel_num_reserves`. `vrm_avis_bas` : déjà
   partagée 60 s (src/lectureAvisBas.js) — le banc la compte.
4. Ma journée qui charge : l'instantané porte la SORTE de chaque chiffre du mois (`data-carte-chiffre`, capturée,
   ou déduite de la clé pour un instantané plus ancien) ⇒ la feuille (verre-journee.css) les range comme l'écran vrai :
   « Vendu · Reçu · Bénéfice » pendant ET après (avant : « Bénéfice · Vendu · Reçu » puis réordonné).

## 3. Les mesures (avant = origin/main e00943c, après = cette branche, même banc, même machine)
Banc `scripts/bancs/onglets-rapides.cjs` — voir le corps de la PR #1250 pour le tableau final des 20 paires.
Premier passage (10 paires communes) : médiane première réponse 1 344 → 464 ms ; écran utile 3 459 → 2 910 ms ;
achats→journée 2 800/8 211 → 344/1 293 ms. Banc `latence-gestes` : Ventes revue 2 000 → 270–380 ms de réponse,
12,4 → 2,5 s d'écran utile ; une vente touchée dans « Toutes » (branche `claude/vitesse-cache`) 2,6–3,2 s → 0,34–0,54 s.

## 4. Ma journée : ce qui bouge encore (pas fait ici)
Banc `scripts/bancs/journee-stable.cjs` : CLS sans copie 0,133 (tuiles du bento), avec copie 0,000 — un REMPLACEMENT
n'est pas un décalage pour le CLS, d'où la comparaison de STRUCTURE ajoutée (ordre des chiffres). Restent :
la carte « N colis à envoyer · Vérification… » de l'instantané (la vraie est « N colis pressés » avec photos), le
« vendu hier · 1 vente » et la photo à droite du grand chiffre (absents de l'instantané), le squelette « Ensuite · N
gestes » (le vrai écran pose des tuiles À envoyer / À retirer / Messages), la mention « Mis à jour » et la phrase qui
disparaissent, et les trois chevauchements de sa capture (crayon sur « Bénéfice · mois », « + 2 à vérifier » coupé,
« prix d'achat manquants » sur 3 lignes : verre-journee.css). Le bon geste : rendre l'instantané PAR les composants
de l'écran vrai (JourneeStudio) nourris de l'instantané, au lieu d'un rendu parallèle.

## 5. Preuves
- `audit-onglets-rapides.cjs` : 13 verts ; rouge sur origin/main ; `--prouve` 8/8.
- Audits verts : studio, tdz, variables, arrivee-sans-gel, traduction, quoi-de-neuf, composants, identite, avis-bas-partage.

## 6. Geste de Julien
Aucun.
