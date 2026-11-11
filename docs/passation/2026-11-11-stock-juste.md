# Stock juste (lot DJ4) — 11 novembre 2026 (branche `claude/stock-juste`)

Demande de Julien (ligne DJ4 de `2026-11-11-demandes-julien.md`) : Stock = seulement les paires
**en ligne**, UNE fois si elle est sur plusieurs sites (par identité), pas de vieilles annonces ;
inventaire physique, audit d'inventaire, « Répartir un lot » retirés de la vue (données gardées) ;
« À trancher » sans onglet exprès (dans Ma journée) ; après une suppression, « Est-ce toujours chez
toi ? » ⇒ « L'enlever du stock ? » ; bug : « Annuler » reste affiché en permanence.

Deux sessions : la première (arrêtée par la limite d'usage) a fait l'essentiel (4 commits), la
seconde a vérifié, corrigé, refait deux bancs et intégré `main`.

## Ce qui est livré

| point | où | comment |
|---|---|---|
| Stock = en ligne | `src/stockAnnonces.js` `partagerParEtat`, `src/ecrans/Stock.jsx` | compte « N paires en ligne » et liste « En ligne » = `etat === 'enligne'` seul ; « À confirmer », « Masquées par Vinted », « Gardées chez toi » dans trois replis fermés À PART, rien supprimé ; « À ranger » = en ligne seulement |
| une fois par paire | `annoncesActuelles` (inchangé : union par annonce, N°, photo exacte) | une pastille par site (`data-stock-sites`) ; 50 paires au même titre restent 50 |
| Ma journée « Stock actuel » | `src/stockJournee.js` | compte désormais par N° (« 007 » = « 7 ») — la même identité que le Stock — puis par annonce ; « paires en ligne » |
| valeur du stock | `src/CascadeVente.jsx` | même base que l'inventaire de fin d'année (lots BF/W, `annoncesPresentes`), dite « sur N paires **chez toi** » pour ne pas se lire comme le nombre en ligne |
| trois outils retirés | menu Outils d'Annonces (`App.jsx`) | « Répartir un lot », « Inventaire physique », « Audit du stock » : plus d'entrée ; modales et données gardées |
| plus d'onglet « À trancher » | `App.jsx` (`GROUPES_PLUS`, `badgesNav`, effet `tab==='trancher'`) | la carte « N à trancher » de Ma journée s'ouvre EN PLACE ; un ancien lien / raccourci « t » ouvre Ma journée, carte ouverte ; **ouverte d'office si ≤ 3 choses** |
| « L'enlever du stock ? » | `src/cycleArticle.js` `opsChezToi`, `src/ATrancher.jsx` `QuestionChezToi`, `src/aTrancher.js` | « Supprimée de Vinted. L'enlever du stock ? » : **« Enlever du stock »** (pleine largeur, en premier) = UN toucher ⇒ séparée, déclarée partie par SON annonce, case libérée, N° jamais redonné, aucune vente inventée ; « Non, je l'ai » ⇒ chez-moi (reste au stock, à republier) ; « Plus tard » ⇒ se tait 20 h. Les trois annulables 5 s, sans fenêtre. La même question sur la fiche « Tout sur le N° » |
| bug « Annuler » permanent | `src/PiluleAnnuler.jsx`, `src/gesteAnnulable.js` | le bouton cliqué disparaît sans `blur` ⇒ la pause ne se levait jamais ; la pilule relit focus et survol réels à chaque changement ; une pause ne dure jamais plus de 60 s |
| CSS | `src/styles-a-trancher.css` | une `}` en trop fermait la couche `vrm-premium` avant les règles du lot : elles étaient hors couche, donc battues par les `!important` de la couche (boutons écrasés sur trois lignes à 390 px). Accolade remise en fin de fichier |

## Décisions prises seul (« tranche le reste toi-même »)

- **Pas de raison demandée** pour « Enlever du stock » (la 1re session demandait Donnée / Vendue
  ailleurs / Perdue / Rendue) : elle ne servait à aucun calcul et coûtait un toucher ; « Annuler »
  rattrape une erreur. `opsChezToi` accepte encore une raison connue (refuse une inconnue).
- **La question dit les mots de Julien** : « L'enlever du stock ? », sa réponse en premier.
- **Valeur du stock** : gardée sur les paires présentes (en ligne + à confirmer + masquées
  présentes), car c'est la base de l'inventaire fiscal de fin d'année (lot W, audit
  `publication-autre-liste`) ; dite « chez toi ». À trancher par Julien s'il la veut « en ligne ».
- **« Faire l'inventaire » du Stock gardé** : Julien a nommé « Inventaire physique » (l'outil du menu
  d'Annonces, retiré) ; celui du Stock est sa demande du 6 nov. et sert « Je vérifie mes cartons »
  de l'inventaire de fin d'année. Une ligne à retirer s'il le veut aussi.
- Raccourci clavier « t » gardé : il ouvre Ma journée, la carte ouverte.

## Gestes avant / après (« les gens doivent gagner du temps »)

| parcours | avant (`main`) | après |
|---|---|---|
| paire supprimée de Vinted ⇒ la sortir du stock | Ma journée : ouvrir le menu de la rangée + choisir « séparé » = 2 gestes, et la case du Stock restait occupée ; depuis l'onglet À trancher : Plus → À trancher → « Non » (renvoyait à Ma journée) → menu → choix = 5 | **1** (carte ouverte d'office, ≤ 3 choses) ou 2 (ouvrir la carte + « Enlever du stock ») ; case libérée dans le même geste |
| « je l'ai encore » | 2 (menu + choix) | 1 ou 2 |
| « Annuler » après la suppression | restait affiché pour toujours (il fallait recharger) | 1 toucher, puis la pilule part seule (1,8 s mesuré) |
| lire le Stock | liste mêlée (en ligne + vieilles « à confirmer » + masquées) | la liste ne montre que l'en ligne ; le reste replié (0 geste pour l'ignorer) |
| les trois outils retirés | 3 lignes du menu Outils | 0 |

## Preuves

- `npm run build` vert (après fusion de `main`, tête f9144b84 puis ce récit).
- Audits verts : variables, tdz, coherence, identite, icones, textes-courts (47), fonctions-api,
  secrets, stock-juste, a-trancher, cycle-article (57), stock-annonces (53), stock-2d (49),
  inventaire (69), cout-vente (28), inventaire-annuel (37), journee-coherence (30), geste-annulable.
- `audit-stock-juste.cjs --prouve` : **6 mutations rougissent** (tout-en-ligne, raison-facultative,
  non-deux-gestes, case-gardee, plus-tard-muet, pause-sans-fin).
- `scripts/bancs/stock-annonces.cjs` : **vert** (390/1512, clair/sombre). Attentes refaites pour la
  règle DJ4 (5 en ligne, N°21 et N°5 à part, À ranger 2,31,41,9) ; fixture Leboncoin avec une
  lecture complète fraîche (règle du 6 nov.) ; V2 : VRM donne un N° à l'annonce Vestiaire sans
  référence ; phrase « pas lues ». Sur `main` (git archive) : 20 rouges avant mes changements de
  banc (dérive Leboncoin/Vestiaire/phrase), et la nouvelle attente « 5 en ligne » y rougit (7).
- `scripts/bancs/a-trancher.cjs` : **vert, 92 contrôles** ; refait pour « pas d'onglet » (total =
  somme des sources rangées à l'instant, aucun onglet ni badge, l'ancien lien ouvre Ma journée) et
  nouvelle partie **N** : « Enlever du stock » = un toucher, aucune confirmation, séparée, case
  libérée, N° intact, déclarée par SON annonce, « Annuler » rend tout, puis la pilule DISPARAÎT.
  **Preuve par mutation** : `PiluleAnnuler.jsx` + `gesteAnnulable.js` remis à `main`, rebâti ⇒
  N rougit exactement sur « Annuler / Annulé disparaissent » (pilule encore là à 12 s), seulement là.
- `scripts/bancs/stock-journee.mjs` : 9 contrôles ; la mutation « identité par N° retirée » rougit.
- Captures regardées (390 clair, 1512 sombre) : question → pilule « N°12 sortie du stock ·
  Annuler » → carte revenue → plus de pilule ; Stock « 5 paires en ligne », pastilles par site.
- Les bancs du Stock, de l'inventaire et des gestes, tournés après la fusion (branche) puis sur
  `main` 23f71d6b (git archive, rebâti) :
  - **verts** : stock-annonces, a-trancher (92), stock-2d, stock-2d-revue, stock-planches,
    stock-retrouver, inventaire-annuel (72), **cycle-supprime (18)** et **stock-plateformes**
    (tous deux refaits pour DJ4 : la question dans la carte À trancher, trois réponses — la
    mutation `CYCLE_MUTATION=1` rougit — ; Leboncoin avec sa lecture complète) ;
  - **rouges, les MÊMES sur `main`** (hors lot, bancs de l'ancien Stock 3D / de Colis d'avant DJ3) :
    stock-assistant 7, stock-gestes 6, stock-partis 12, stock-piece 13, stock-finitions (3D,
    coupé à 600-900 s), inventaire (≈ 42, coupé), gestes-annuler 4 (« Colis → À retirer », déplacé
    par le lot DJ3).

## Ce qui reste / limites

- Banc a-trancher : en s'ouvrant dans Ma journée, les écrans propriétaires republient LEURS
  sources (à 0 sur ces données inventées) ; les gestes « Ouvrir » de 7 sources (N° en double,
  colis postés, à retirer, N° à écrire/vérifier, remise en ligne, ventes à dater) ne sont plus
  joués (dits « -- » dans la sortie). Ils l'étaient sur `main`. À regagner en servant des données
  qui font naître ces sources.
- `audit-journee-hors-ligne.cjs` : 1 rouge, **le même sur `main`** (« l'app n'écrit la photo qu'après
  lectureComplete »), hors lot.
- `verif_visuel.cjs` / `verif_dark.cjs` / `litiges-ecran.cjs` visitent encore `?tab=trancher` : ils
  arrivent sur Ma journée (carte ouverte) — non relancés ici.

## Geste de Julien

Aucun obligatoire. Deux choix possibles : la valeur du stock « en ligne » plutôt que « chez toi » ;
retirer aussi « Faire l'inventaire » du Stock.

## Note d'intégration (fin de journée)

Une session parallèle a poussé sur la même branche pendant la reprise (1a59292e → f1523f93 :
« Annulation… »/« Annulé » jamais en pause, banc `scripts/bancs/stock-juste.cjs`, carte de Ma
journée sans résumé redit, un seul chevron par repli). Fusion réelle (109db29d), rien perdu ;
après fusion : build vert, audits verts (`audit-stock-juste --prouve` : 7 mutations rougissent),
bancs `a-trancher` et `stock-juste` verts.
