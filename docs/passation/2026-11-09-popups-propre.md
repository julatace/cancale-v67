# 9 nov. 2026 (soir) — Pop-ups propres (lot AI)

Branche `claude/popups-propre` (depuis `origin/main` 7867f121), poussée à chaque commit. **Pas de PR, pas de
merge** (consigne du coordinateur).

Julien, mot pour mot : « Je veux que tous les textes comme ça soient remplacés par des pop-ups car
actuellement ça fait très moche » ; « tu dois également enlever ce genre de texte de l'app qui gâche
l'expérience visuelle, tu peux proposer des pop-ups pour faire des propositions ». Demandes 1, 2, 13, 14 du
9 nov. 21 h (`2026-11-09-propositions.md`, dernière section).

## La forme unique : `src/composants/InfoPop.jsx` (+ `info-pop.css`)

- **`InfoPop`** — à l'écran, UNE ligne courte qui garde le SIGNAL (chiffre, état, âge : « 3 retirées de Vinted
  · 2 à confirmer », « au moins 2 annonces · lues il y a 7 j · à confirmer »), 13/500 grise, coupée en « … »,
  pastille ⓘ à droite ; **ambre** quand un geste est à faire, jamais rouge. La ligne entière se touche (44 px,
  clavier, `aria-haspopup="dialog"`). Le texte d'avant passe TEL QUEL dans la feuille unique (`SheetShell` :
  portail, `FermeAuRetour`, Échap, croix 44 px, focus gardé).
- **`PuceProposition`** — une PROPOSITION devient une pilule grise « [1] annonce remise en ligne ? › » ; la
  pop-up porte la question, la règle et LES MÊMES boutons. Rien n'est relié avant SON clic.
- Dans App.jsx, `InfoPop` / `PuceProposition` sont des relais qui donnent la vraie feuille (avec
  `FermeAuRetour`) ; exportés pour les écrans découpés (`src/ecrans/*.jsx`).
- Les `data-*` de l'ancien bloc restent sur la ligne courte (cibles d'« À trancher », bancs) ; ceux des
  morceaux de texte (`data-suppr-dit`, `data-vieux-dit`, `data-geste-dit`, `data-remise-ligne`…) sont DANS
  la pop-up.

## Inventaire : ce qui a été déplacé, écran par écran (avant → après)

| écran | avant (à l'écran) | après (à l'écran) | dans la pop-up |
|---|---|---|---|
| Annonces · Vinted / Toutes / Statistiques (`FraicheurAnnonces`) | 2 à 6 lignes : « 3 annonces plus en ligne sur Vinted (supprimées ou retirées) : enlevées d'ici automatiquement. shop_x : annonces lues aujourd'hui à 14 h 50 — ce que tu as supprimé… Elles seront relues à ta prochaine visite… Une suppression faite sur vinted.fr dans ce Chrome sort d'ici tout de suite… » | « 3 retirées de Vinted · 2 à confirmer · shop_x lu aujourd'hui à 14 h 50 ⓘ » (ambre si à confirmer, relecture pas lue, ou geste à faire) | tout le texte d'avant, une idée par paragraphe, la liste « à confirmer » dépliable, le geste |
| Annonces · Vinted | carte « Une annonce remise en ligne ? Tu as supprimé une annonce… C'est la même paire que N°11 … ? Même marque, même taille : vérifie l'étiquette… [Oui, N°11] [Non, une autre paire] » | puce « [1] annonce remise en ligne ? › » | la question, la règle (photo forte / ressemblance), « Oui, N°x » et « Non, une autre paire » — même `repondreRemise` |
| Annonces · Vinted (« je numérote moi-même ») | carte « N numéros écrits à vérifier · Tu numérotes toi-même… » + lignes | puce « [N] numéros écrits à vérifier › » | les lignes, « Garder N°X » / « Prendre N°Y », la phrase « sans N° écrit » |
| Annonces · Sélectionner | « Coche des annonces d'un même compte, puis Actions : republier, modifier prix ou titre, mettre en brouillon ou en ligne. » | « Coche, puis **Actions** ⓘ » | la phrase entière (et sa variante brouillons) |
| Annonces · Vestiaire | « 3 annonces (au moins), lues sur Vestiaire il y a 7 j. À confirmer : la lecture a plus de 24 h — ouvre « Mes articles »… » (2 à 5 lignes) | « au moins 3 annonces · lues il y a 7 j · à confirmer ⓘ » (ambre si vieille / fiches à venir) | la phrase entière, « (au moins — Vestiaire en annonce N) », le geste, la mise à jour de l'extension |
| Stock (résumé) | « 3 rangées · 42 pas encore rangées · dont 3 à confirmer (Vestiaire, lu il y a 7 j — ouvre…) · dont 8 masquées par Vinted… · 1 sans N° (donne-leur…) · 4 annonces eBay sans N° pas comptées… » (3 à 6 lignes) | « 3 rangées · 42 à ranger · 3 à confirmer · pas tout lu · 5 sans N° ⓘ » (ambre si à confirmer / pas lu / Vestiaire vieux) ; le grand chiffre garde « au moins » | la ligne entière d'avant, morceau par morceau (mêmes `data-stock-*`) |
| Stock | « 3 paires rangées pas vérifiées (N°5, N°27, N°B153) : une lecture manque… Je ne dis ni qu'elles sont en ligne, ni qu'elles sont parties. » | « 3 rangées pas vérifiées · N°5, N°27, N°B153 ⓘ » | la phrase entière (« pas lu » renvoie à « pas tout lu » en tête de Stock) |
| Stock · Plus en ligne | « Rangées, mais plus en annonce nulle part : retire-les du carton, ou garde-les si elles reviennent en vente. » | « Rangées, plus en annonce nulle part ⓘ » | la phrase entière |
| Ma journée (premier lancement) | « Ce que tu vends, tes plateformes, ton statut, ton numéro : deux minutes, et VRM s'adapte à toi. » | « Deux minutes, et VRM s'adapte à toi ⓘ » | la phrase entière |
| Ma journée · guide de démarrage | « pourquoi » de l'étape (≈ 95 caractères, 2-3 lignes) | « Pourquoi cette étape ? ⓘ » (prop `Pop` de `GuideDemarrage`) | le « pourquoi » |
| Colis | « 1 bordereau à imprimer — à envoyer avant … [Imprimer] » ET « Tout imprimer » en haut | la phrase seule ; « Tout imprimer » reste le seul bouton | — |
| Colis « Peut-être en double » | déjà retiré sur `main` (« Retraits frais », 9 nov.) | — | — |

**Rien n'est perdu** : aucune phrase n'a été réécrite (sauf « « pas lu » plus haut » → « « pas tout lu » en
tête de Stock », pour suivre le déplacement) ; « au moins », « à confirmer », « pas tout lu », « sans N° »
restent dans la ligne courte ; ambre quand il y a un geste. Aucun mot de `src/libelles.js` ajouté.

### Le bouton en double (demande 2)
Vérifié dans le code : le bouton « Imprimer » de la ligne « Prochain geste » de Colis appelait `ouvrirLot()`
(avec `disabled={batchBusy || nLot === 0}`), exactement comme « Tout imprimer » de la barre du haut (même
`ouvrirLot`, même lot `lignesLot`, même compte `nLot`, même garde). Sur un autre onglet, il changeait d'onglet
puis ouvrait le MÊME lot — « Tout imprimer » l'ouvre de n'importe quel onglet. ⇒ La ligne garde sa phrase
(et « Ouvrir la tournée » / « Voir le point » pour les autres gestes), « Tout imprimer » reste seul.

### La carte du compte (demande 13)
`.vrm-nav-compte` (pied de la colonne, DA5) est un `<button>` qui ouvre Paramètres (`setTab('settings')`),
`aria-label` « nom · offre — ouvrir Paramètres », fond au survol / à l'appui, anneau clavier. Au téléphone,
« Plus » n'a pas de carte du compte (rien à câbler).

### Le compte Vinted en haut à droite (demande 14)
Plus un point seul : l'**avatar** du compte (son initiale, pastille ronde encre) ; sans compte lu, un « V » ;
pendant la vérification, l'icône qui tourne (rien sous « réduire les animations »). Le point d'avant devient
un **badge** de 9 px posé sur le bord de l'avatar, même couleur (encre / ambre / gris — aucun rouge), même
`.vrm-etat-point` ; même `aria-label`, même menu. Style : `src/styles-popups.css` (importé après la DA6).

## Coordination
- `claude/fraicheur-unique` (pas encore sur `main`) : elle retire la puce « Relire compte » de Colis, la ligne
  d'Achats et la tête de Vinted ; **je n'y ai pas touché**. Elle ne remplace pas `FraicheurAnnonces` (la
  fraîcheur PAR dressing d'Annonces) : celle-ci passe en ligne courte + pop-up ici. À la fusion des deux, pas
  de conflit attendu dans les blocs touchés (vérifié par `git diff origin/main...origin/claude/fraicheur-unique`).
- `claude/a-trancher` (pas encore sur `main`) : sa cible `[data-remise-bloc]` existe toujours (la puce) ; le
  défilement y mène, la pop-up s'ouvre d'un toucher.

## Preuves (§6)

- **`scripts/bancs/popups-propre.cjs`** (nouveau ; données inventées ; 390 tactile sombre + clair, 1512 ;
  Annonces Vinted / Toutes / Vestiaire, Stock, Colis, Ma journée, carte du compte) :
  P1 aucun bloc de texte visible > 90 caractères sur 2 lignes et plus hors feuille (seuil : à 390 px une
  ligne de 13 px tient ~48 caractères, au-delà de 90 c'est un paragraphe ; une ligne coupée « … » n'en est
  pas un) ; P2 chaque ligne courte tient sur une ligne, porte ⓘ, ouvre SA pop-up en portail qui contient le
  texte d'avant, se ferme à la croix ET à Échap ; P3 la remise en ligne est une puce, ouvrir la pop-up ne relie
  rien, « Oui, N°7 » relie 9303 au N°7 ; P4 un seul bouton d'impression du lot ; P5 carte du compte ⇒
  Paramètres ; P6 avatar + badge, aucun rouge rendu.
  - cette branche : **134 verts, 0 rouge** ;
  - `origin/main` (git archive 7867f121, son build, le banc copié dedans) : **39 rouges** (P1 sur tous les
    écrans, P2, P3, P4, P5, P6) ;
  - mutation : `InfoPop` qui recopie son texte dans la ligne ⇒ **24 rouges** (P1, P2).
- `npm run build` vert ; audits `variables`, `tdz`, `coherence`, `identite`, `statuts`, `icones`, `boutons` verts.
- Bancs existants, un à un : voir la section « Bancs » ci-dessous.

## Bancs existants

BANCS_RESULTATS

## Planches

`docs/passation/planches-popups/` (données inventées) : `avant-*` (origin/main) et `apres-*` (cette branche),
`{390-sombre,390-clair,1512-clair}-{annonces-vinted,annonces-toutes,annonces-vestiaire,stock,colis,journee}`
(`-zone` = la zone changée au milieu de l'écran) ; les pop-ups ouvertes `apres-*-popup` ; l'en-tête et la carte
du compte `*-entete-compte`.

## Ce qui reste

- **Le reste de l'app** : un relevé statique des textes JSX de plus de 90 caractères compte ~390 chaînes
  (App.jsx 136, Réglages 40, Compta 36, eBay 24, Leboncoin 23, Republier 15, Accueil 15, Vestiaire 12, Stats
  8…). Beaucoup sont déjà dans des feuilles, des états vides ou des cas rares ; les écrans demandés (Annonces,
  Stock, Colis, Ma journée) sont nets dans le banc. À passer à la même forme, écran par écran : Réglages,
  Compta, Leboncoin, eBay, Republier (le banc se prolonge en ajoutant un écran à `ECRANS`).
- Stock : les chiffres en gras du résumé restent à l'encre quand la ligne est ambre (règle `!important` de
  `styles-premium.css` sur `.vrm-s2d-resume-l b`) — à harmoniser si Julien le remarque.
- `FraicheurAnnonces` sur Statistiques prend la même forme (même composant) : pas capturé un par un.
