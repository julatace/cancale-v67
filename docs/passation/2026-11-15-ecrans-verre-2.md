# 15 nov. 2026 — Écrans en verre, 2 : Argent, Argent à venir, Messages, Paramètres, la fiche d'une paire

## La décision
Julien a validé les maquettes « Verre dépoli » (« tout est parfait sauf étagères ») : planches `argent`, `messages`,
`parametres`, `fiche` et leurs vues (`argent-mois`, `argent-avenir`, `messages-liste`, `messages-offre`,
`parametres`, `parametres-ventes`, `fiche-paire`). Choix tranchés : Paramètres en TUILES (le premier écran tient
sans défiler), le plein de la conversation va à « Proposer N € ». Ce lot les rend À L'IDENTIQUE sur les vraies règles.

Branche `claude/ecrans-verre-2` : partie de `claude/verre-app`, avec `claude/parametres` (dix catégories) et
`claude/argent-attente` (l'écran « Argent à venir »), puis `claude/project-review-nsk5su` (verre fini + Stock en
étagères). Pas de PR.

## Comment : une feuille neuve, des classes neuves
`src/design/verre-ecrans.css`, importée juste après `studio-verre.css`, dans la MÊME couche (`@layer vrm-verre`) :
des classes `vg-*` neuves, aucune règle de la couche commune modifiée (les autres chantiers — `refonte-journee`,
`refonte-ventes` — y travaillent). Les valeurs sont celles de la maquette (`kit.cjs`, `style.cjs`,
`e-argent-msg.cjs`, `e-reste.cjs`) : verre rayon 22 (tuile 20, plein 16, touche 14), chiffre d'affiche 52/700
(−.05em), chiffres de carte 22/750, libellés 12.5/600, gris `--sv-encre-2`, ambre `--sv-ambre`, fumé
`rgb(10 38 76 / .24)` + bord blanc .32. Les couleurs viennent des jetons de la couche, sauf les quatre teintes des
étapes de l'argent (maquette : ambre = à envoyer, un geste ; encre = en route ; ardoise = livrée ; hachuré =
versement / porte-monnaie). Textes : `verre2.*` (`src/i18n/langues/{fr,en,es,it,de}/verre2.js`).

## Écran par écran
**Argent · le mois** (`ArgentQuestions`, `AVenirVerre`, src/ecrans/Compta.jsx) — « vendu » en chiffre d'affiche blanc
sur le fond (sans carte) et « vendu en novembre · N ventes » ; Reçu · Bénéfice en deux verres ; l'argent à venir en
verre : total, barre PAR ÉTAPE dont chaque part suit le montant de son étape (`parEtape` de `argentAVenir`), légende
deux colonnes ; l'URSSAF : « à déclarer pour {période} », l'échéance en ambre, les cotisations (`P.apayer`) en
grand, « 12,4 % de {CA} reçus » (`P.ca`, daté au versement) et « J'ai déclaré » SEULEMENT quand la déclaration est
ouverte et qu'un mois reste à noter (`demanderDeclaration`, sur son clic). Les quatre `data-argent-q`, leurs
`data-argent-valeur` (le net pour le bénéfice), `.vrm-argent-w-n`, `.vrm-argent-w-note` : inchangés (banc `argent`).
⚠️ **Le bénéfice ne dit JAMAIS « au moins »** : la maquette écrivait « Bénéfice, au moins 398 € · 14 ventes sur
17 ». Or `src/beneficeNoms.js` (3 nov.) l'interdit : une paire au prix d'achat inconnu peut être vendue à perte, le
brut sur les ventes au prix connu n'est pas un plancher. Rendu : le « Bénéfice » (net) quand il est su ; sinon,
s'il manque des prix d'achat, le « Bénéfice brut » avec SA couverture (« 14 ventes sur 17 ») et la porte
« 3 prix à saisir › » (la saisie en série, §5 « le chiffre faux est la porte pour le corriger »). À trancher par
Julien s'il veut autre chose.

**Argent à venir** (src/ArgentAVenirEcran.jsx) — la feuille prend le fond bleu ; le total en blanc (52/700), « N
ventes · sites » ; un verre : la barre, puis chaque étape (pastille, nom, montant) et ses ventes — les 3 premières
d'emblée, toutes au toucher de l'en-tête (« +N autres ») ; chaque vente : sa plaque N° **par identité**
(transaction → item_id → la fiche, `numDe` monté par la coque ; pas su ⇒ un blanc, jamais le titre), son titre, son
site et son compte, son montant ; en bas du verre, le porte-monnaie Vinted : son montant lu, sinon « — » et « Pas
lu : ouvre vinted.fr connecté pour le relire » (jamais 0 €, jamais ajouté) ; la raison « Vinted n'écrit pas la date
du versement », commune à toutes les étapes, est dite UNE fois (chaque étape la garde pour les lecteurs d'écran,
`data-av-date`). Le reçu du mois, la frise et « par site et par compte » restent dessous. Tous les `data-av-*` d'avant.

**Messages · Tous** (src/ecrans/FilsTous.jsx) — « Toutes · Offres · Non lues » (verre fumé, l'actif en porcelaine,
le nombre d'offres en ambre) ; UN verre par compte (CLAUDE.md §3 « Messages, comptes ») : le compte de l'onglet
d'abord (badge « compte de l'onglet », `compteConnecte`), puis les autres du plus récent au plus ancien, et DANS
chaque compte du plus récent au plus ancien ; une rangée = la photo de la paire, le pseudo, l'heure (point bleu si
non lu), la plaque N° (par identité, `paireDeConv`) et le dernier message — une offre ouverte en ambre (« Offre de
70 € », la règle de la liste Vinted : `offresConv` + `offreOuverte`, passée par App.jsx). La recherche, « À faire »
(peut-être la même paire), les fils reliés, l'anti-arnaque, 80 rangées au plus : gardés.
**Une conversation** (App.jsx `rendreConversation`, `ResumeOffre`) — sur le bleu : la tête en blanc, la paire en verre
(photo, plaque N° claire, titre ; prix et compte dessous), les bulles (l'autre en porcelaine, toi en bleu clair), le
jour en pastille fumée ; l'offre : « {pseudo} propose » et le montant en grand, le prix et ton mini dessous, l'écart
en ambre ; **le plein va à « Proposer N € »** (calculé depuis SON prix mini, `contreOffreMini`), « Accepter N € » et
« Refuser » en touches. Sans prix mini : comme avant (Accepter reste le plein, il demande confirmation). Les mêmes
gestes (`actionOffre`), les mêmes `data-offre-*`.

**Paramètres** (src/ecrans/Reglages.jsx, src/parametres/AlerteParametres.jsx) — premier écran (téléphone) : la
recherche (48 px, rayon 24), « Tout va bien ? » en ambre plein SEULEMENT s'il y a quelque chose (pastille de cœur,
chevron), la carte « Mon compte » (avatar, adresse), puis neuf tuiles (trois par rangée, icône dans sa pastille, nom,
valeur de `valeurCat` — rien d'inventé). Une catégorie : le rond « ‹ » fumé, le surtitre « Paramètres », le grand
titre en blanc ; les groupes (titre blanc 13/700, verre, rangées 62 px SANS icône, interrupteur à l'encre). Les 84
rangées, leurs `id`, les liens profonds, la recherche, l'ordinateur (sommaire + catégories) : inchangés.

**La fiche d'une paire** (src/FichePaire.jsx) — sur le bleu : la paire en verre (photo 96 rayon 18, plaque, titre),
**une ligne par site** (les annonces lues PAR IDENTITÉ par `parcoursPaire` : le site, son état, son prix — le texte
de l'étape, rangé ; l'étape ne le redit pas dessous), les chiffres en verres (achat, prix, si vendue), l'histoire dans
un verre, les gestes en touches (trois colonnes) ; la note privée passe SOUS l'histoire.

## La preuve
`scripts/bancs/ecrans-verre-2.cjs` (base inventée : 1 000 paires, 1 000 conversations, 3 comptes ; 390 tactile et
1512, clair et sombre ; `SHOTS=`, `DSF=2`) : A (vendu d'affiche, l'ordre, reçu · bénéfice côte à côte, une part de
barre par étape et à sa proportion, les étapes font le total, l'URSSAF, jamais « au moins » sur le brut), V (total
écrit une fois, une part par étape, porte-monnaie pas lu = « — »), M (groupes par compte, onglet d'abord, récents
d'abord, plaque N° sur chaque rangée reliée, le filtre, la 1re rangée à mi-écran, la paire en tête du fil, le plein
à « Proposer »), P (dix catégories, neuf tuiles en trois colonnes, au-dessus de la barre du bas, aucune rangée ;
une catégorie : titre et groupes en blanc, rangées sans icône ≥ 44 px, rond ≥ 44 px), F (la paire en tête, les
chiffres, l'histoire), Z (rien ne déborde, 44 px, un plein au plus). `_sonde-ev2.cjs` : une sonde de boîtes.

## Pièges
- Une règle « bouton nu » de même poids que `.vg-carte` et placée APRÈS elle effaçait le verre des cartes (Reçu,
  Bénéfice transparents) : le bouton-carte n'est pas dans la liste des boutons nus.
- `content-visibility: auto` sur les rangées : `innerText` d'une rangée hors de l'écran est VIDE (le banc lit
  `textContent`).
- `.vrm-pm` est une colonne flex à `gap: 12px` : les marges de la maquette s'y ajoutaient (la dernière tuile passait
  sous la barre du bas) — marges à 0.
- La fusion de `project-review-nsk5su` portait deux `export default {` dans les cinq dictionnaires (Stock en
  étagères) : réparé ici, puis par le coordinateur (cc0e7291) — un spread en double retiré.

## L'ordinateur (maquettes ordinateur validées ensuite : `ordi/vues/{argent,messages,parametres,fiche}-{1512,1280}`)
Le rail de navigation commun vient de `claude/refonte-journee` (fusionné, pas refait). Ici, §6 de `verre-ecrans.css` :
- **Argent** : trois colonnes — « vendu » en affiche au-dessus ; Reçu · Bénéfice puis les six mois (ComptaFusion) ;
  l'à venir DÉTAILLÉ (chaque étape et ses ventes, N° par identité : `useNumAVenir`, exporté par App.jsx, la même règle
  que la feuille) ; l'URSSAF puis le détail (replis). Banc `argent` N7 (ordinateur) réécrit à cette disposition :
  « vendu » au-dessus, Reçu · Bénéfice · URSSAF sur une ligne (avant : les quatre sur une ligne).
- **Paramètres** : le sommaire en un verre (nom et valeur, la catégorie choisie en porcelaine) ; chaque catégorie, son
  grand titre en blanc, ses groupes en verres sur deux colonnes, le titre DANS le verre, des rangées sans icône.
- **Messages** : la liste et le fil en verres (le fil sur le verre, la tête à l'encre).
- **La fiche** : un plan large en trois colonnes (la paire ; ses sites, ses chiffres, l'état ; l'histoire et les gestes),
  placé par rôle (grid), l'ordre du code inchangé.

## Bancs d'avant ajustés à la nouvelle forme (dit ici, §6)
- `coque-parametres` H3 : « une icône par catégorie » lue AUSSI sur les tuiles (`.vg-pm-tuile-ic`) ; au téléphone 9
  icônes distinctes (« Mon compte » porte un avatar, maquette).
- `argent` N7 (ordinateur) : la disposition de la maquette ordinateur (ci-dessus).

## Ce qui reste / écarts
Voir le rapport du lot (captures maquette | rendu clair | rendu sombre).
