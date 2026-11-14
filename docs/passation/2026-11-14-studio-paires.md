# 14 nov. — « Studio bleu clair » : l'espace Paires (Annonces, Stock, Inventaire, la fiche)

Branche `claude/studio-paires` (depuis `claude/integration-refonte`). Direction choisie par Julien : t25
« Studio bleu clair » (`directions/t25-mix/note.md`, contrat des noms `CONTRAT-STUDIO.md`) — « tout doit être
parfait, tu peux changer les dispositions », mais **aucune fonction ne disparaît**.

## Ce qui change, en une phrase par écran

- **Annonces (Vinted)** — la liste d'abord, sur un **plan de verre** : des rangées de **64 px** (60 sur ordinateur)
  `plaque N° gravée · vignette posée · titre + méta (T. 42 · ♡ 12 · 91 j) · prix` (Urbanist, « € » plus petit).
  Au-dessus, tout tient en cinq lignes : le segment Annonces · Stock · Achats (plateau, l'actif enfoncé + diode),
  le titre « Annonces » + « ? » + **« • À faire · N › »** (un lien, sur la ligne du titre), les sites et le compte
  **sur une ligne**, la **bande de chiffres** (sans carte), la recherche **creusée** + Trier · Liste/Grille · Outils
  (des ronds), puis les vues (Toutes, Sélectionner, Republier, Brouillons, Masquées, Sans N°, Sans achat relié,
  À compléter, Relancer) en **un plateau creusé** qui défile. 1re rangée à **397 px** sur 844 (47 %).
- **Toucher une paire** (téléphone) : elle **monte au premier plan, à sa place dans la liste** (les autres reculent à
  40 %) — photo 75 × 105, plaque grande (le N° se change en la touchant), titre, **prix affiché (42 px fin) ·
  acheté (se saisit en le touchant) · jours en ligne · favoris**, puis **Baisser le prix · Republier · « ⋯ »**.
  « × », Échap ou un second toucher la font redescendre. « ⋯ » ouvre **la fiche de la paire** (proposition 62)
  avec tout le reste.
- **Ordinateur** : toucher une rangée ouvre la fiche **en plan à droite** (460 px, porcelaine, la liste reste à
  gauche et touchable ; la rangée ouverte est désignée) ; Échap la ferme. La liste est dense, en colonnes
  (N° · photo · paire et sa méta, vues comprises · sites · prix).
- **La fiche d'une paire** (src/FichePaire.jsx) : porcelaine, carte héros comme la paire montée (photo 75 × 105,
  plaque N° gravée, prix fin), les cases de l'annonce (état, prix d'achat, accepter dès, refuser sous, boost, marge)
  **en tête** de la fiche, en cases creusées, les gestes en touches posées.
- **Stock** : même matière (plan de verre, rangées 64 px avec la plaque en 1re colonne, « Ranger » / « Voir » en
  lien, puces et compte en touches, recherche creusée, « À faire » en lien, ronds en tête).
- **Leboncoin / eBay / Vestiaire** (onglets d'Annonces) : leurs listes sur le même plan de verre, la plaque N° gravée,
  le prix Urbanist ; leurs sous-rubriques (eBay : Annonces · Promotion) sur leur propre ligne, en plateau.
- **Grille** : la grille de vignettes d'hier reste **au choix** (rond Liste/Grille, retenu sur l'appareil,
  `vrm_paires_vue`), en tuiles de porcelaine.

## Inventaire des gestes — chacun à sa place (rien de retiré)

| geste | avant | maintenant |
|---|---|---|
| Annonces · Stock · Achats | segment en tête | le même, en plateau (enfoncé + diode) |
| Aide « ? » | à côté du titre | idem, rond 44 |
| À faire · N (brouillons à refaire, compte-rendu, programmes de republication, signalements…) | capsule en tête des vues | **lien sur la ligne du titre** (téléphone), ouvre la même feuille ; ordinateur : les alertes posées sous les vues (inchangé) |
| Sites (Vinted · Leboncoin · eBay · Vestiaire) | ligne seule | **même ligne que le compte** (plateau creusé) ; ordinateur : barre du haut (inchangé) |
| Compte (« Tous les comptes ▾ ») | ligne seule, sous les sites | à droite des sites (téléphone), sur la ligne du titre (ordinateur) |
| Bande (en ligne · ventes · vendu) + « ⋯ » réglage | bande | idem, chiffres Urbanist 300 sur le fond |
| Recherche (+ micro), phrase comprise (capsules) | barre | idem, champ creusé |
| Trier | bouton + menu | rond (téléphone) / touche (ordinateur), même `select` |
| Republier… (barre) | bouton de la barre **et** vue « Republier » | **une seule place** : la vue « Republier » (porte `data-actions-ouvrir`) — un geste en double retiré |
| Liste / Grille | — (grille seule) | **rond** de la barre ; la grille reste au choix |
| Outils ⋯ (offres automatiques, À compléter, photos en double entre comptes, studio photo, séance photo, catalogue privé) | rond | idem |
| Vues : Toutes, Sélectionner (puis feuille Actions : republier, modifier prix/titre, brouillon, en ligne, épingler…), Republier (atelier), Brouillons, Masquées, Sans numéro, Sans achat relié, À compléter, Relancer | capsules | **un plateau creusé** qui défile (actif enfoncé + diode) |
| Toucher une annonce | ouvrait la fiche | téléphone : **la paire monte** ; ordinateur : **fiche en plan à droite** |
| Photo ⇒ visionneuse / Vinted | sur la vignette | sur la paire montée (la rangée fermée est UN geste) |
| N° (changer, « + N° ») | pastille de la vignette | **plaque de la paire montée** (même `EnLigne`, même `poserNumero`) |
| Prix d'achat (saisie) | case cachée depuis la fiche unique | **« acheté » de la paire montée** + case en tête de la fiche (même écriture `ecrirePrixTape`) |
| Baisser le prix | série seulement (Relancer, Sélectionner) | **touche de la paire montée** (la même feuille `BaissePrixSerie`, pour cette annonce) ; la série reste |
| Republier une paire | via Sélectionner / vue Republier | **touche de la paire montée** (même atelier, même règle `actionsPossibles`, refus ⇒ sa raison) ; les vues restent |
| État, Accepter dès, Refuser sous, Boost payé, Marge | cases (cachées depuis la fiche unique) | **en tête de la fiche** (`DansFiche`, place « contexte ») |
| Changer le prix (partout), Voir / Ranger au stock, ⋯ gestes rares (file Leboncoin / eBay / Vestiaire, Publier partout, Visuels réseaux, Relier un achat, Passeport, Lien Vestiaire, Histoire · Dupliquer, Me le rappeler, Marquer vendue), préparation Leboncoin, achat relié | carte | **la fiche** (« ⋯ » de la paire montée ⇒ fiche ⇒ « ⋯ ») |
| Note privée de la paire | carte | la fiche (sa note, par N°) |
| Suite par paquets, Stock et ajustements, signalements repliés | sous la liste | idem |
| Leboncoin : Gérer, Supprimer (confirmé) | fiche (`DansFiche`) | idem |
| eBay, Vestiaire : leurs écrans d'annonces | onglets | idem (même liste, même matière) |
| Stock : recherche photo, Inventaire (et inventaire annuel), filtres, compte, puces d'état, Ranger / Voir, Voir plus, meubles, vendues à sortir, plus en ligne, retours, série (Enlever du stock, Exporter) | — | **inchangés** (CSS seulement) |

## Comment c'est fait

- `src/design/studio-paires.css` (importé EN DERNIER, couche `vrm-premium`) : lit les jetons du contrat
  (`var(--sb-*, repli)` par des alias privés `--sbp-*` ; les replis = `directions/_t25/tokens.cjs`) — **aucune
  définition ne double celle de la fondation**. Rouge : seulement `.vrm-num[data-num-etat="doublon"]` / `.is-double`.
- `src/paires/PaireAvant.jsx` : le petit magasin de la paire montée, le toucher délégué (`clicAvant` :
  téléphone ⇒ `preventDefault`, HoteFicheLigne ne l'ouvre pas en fiche), l'hôte qui rend la partie propre à la carte
  dans la place que la rangée réserve (`[data-sb-avant-place]`) et pose `data-sb-avant` / `.sb-avant` sur la
  rangée et `data-sb-recul` / `.sb-recul` sur la liste. **Ouvrir ne redessine que l'hôte** (1 000 paires) : ni la
  liste, ni l'écran, ni l'historique (la paire montée n'est pas une feuille).
- `App.jsx` : `rendreAvantAnnonce` (chiffres LUS — « — » quand on ne sait pas —, touches Baisser / Republier, « ⋯ ») ;
  `data-espace="paires"` sur l'écran ; la carte d'annonce porte `.sb-rangee` (vue liste) et sa clé ; les cases de
  l'annonce passent dans la fiche (`DansFiche` « contexte ») ; « Republier » de la barre retiré (doublon de la vue) ;
  `prixAffiche` (nombre + « € » plus petit, même texte lu) ; le compte sur la ligne des sites.
- `FichePaire.jsx` : `sb-plan` (ordinateur, fiche ouverte depuis une annonce ou le Stock, `aria-modal="false"`).
- Textes : `studio.paires.*` (5 langues, `src/i18n/langues/*/studio-paires.js`).

### Deux pièges mesurés
- **`content-visibility:auto` sur les rangées, à l'ordinateur** : les rangées VISIBLES n'étaient pas dessinées
  (Chromium 1243, coque ordinateur ; bisection : sans lui, la page se dessine). Posé au téléphone seulement
  (la liste vient par paquets à l'ordinateur), et `visible !important` à l'ordinateur (la fondation le pose sur
  `.sb-rangee`).
- **Le fondu `cancaleFadeIn` des images paresseuses** restait à 0 sur les rangées (animation jamais avancée) :
  retiré des vignettes de rangée ; le fondu `data-vu` d'hier suffit. Aucun fondu par rangée non plus (1 000
  transitions au recul).

## Preuves

Voir la fin du fichier (mise à jour au dernier tour) : audits, bancs, captures.
