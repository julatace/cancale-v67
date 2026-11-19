# 19 nov. — « Aujourd'hui », propre et utile (branche `claude/aujourdhui-propre`)

## Ce que Julien a dit (19 nov., mot pour mot)

1. Une capture de son iPhone, puis : « ça ne me convient toujours pas, je veux que tout soit beaucoup mieux, le
   visuel de l'app doit être absolument parfait ».
2. Deux captures de la liste « À faire » : « honnêtement tout ça ne sert à rien, ça doit être rangé dans les onglets
   dédiés justement à ça. Par exemple les litiges dans les ventes, ou les retours en cours, pas forcément en plein
   milieu de ma journée, ça sert à rien, je pense qu'il y a d'autres choses plus intéressantes pour cet onglet. Sinon
   en fait il ne sert à rien. »
3. « dis-toi que l'outil doit être pratique, pas chiant ».
4. « la mise en page est catastrophique, revois absolument tout […] je veux quelque chose de drastique, nouveau,
   totalement différent » ⇒ UN seul design, « VRM natif » (`docs/design/NATIF.md`, branche `claude/natif-fondation`).
   La barre du bas, la tête et le rail appartiennent à ce lot-là ; ce lot-ci livre le FOND d'« Aujourd'hui » et de
   « À régler », et l'écran sur les composants natifs dès qu'ils existent.

## Ce qui change pour lui

- **« Aujourd'hui » ne montre plus la liste « À faire ».** À la place, de haut en bas : le vendu du jour (« 102 €
  vendus aujourd'hui · 2 ventes » ; le matin, s'il n'a encore rien vendu, le dernier jour utile : « vendus hier »),
  les sept derniers jours en barres (une barre se touche), le mois (Vendu · Reçu · Bénéfice), « À envoyer » (le
  nombre, des vignettes nettes avec leur plaque N°, « +N » pour le reste, le bouton « Imprimer les bordereaux »),
  « À retirer » (la passe : le point sur une ligne, le code en grand), les 5 dernières ventes, « Argent à venir ».
  Au plus UNE ligne ambre en tête, seulement si une date limite LUE tombe aujourd'hui ou demain.
- **Chaque chose à faire est dans SON onglet**, en tête, dans un bloc discret « À régler · N » : replié en une ligne
  s'il ne presse pas, ouvert (3 rangées puis « Tout voir ») si une rangée est ambre. Ventes : colis pressés, litiges,
  ventes annulées, retours, ventes sans prix d'achat. Achats : achats à numéroter, colis à vérifier. Annonces :
  prix à baisser, et UNE rangée « Compléter mes annonces · N » pour « sans numéro », « sans prix mini », « sans prix
  d'achat » (ce ne sont pas des alertes). Stock : inventaire en cours, nouveaux N° à écrire. « Tout va bien ? »
  (Paramètres) : les choses à trancher, les e-mails à trier. Le MÊME geste qu'avant sur chaque rangée.
- **Les pastilles** : celle d'un onglet = ce qu'elle comptait (colis à envoyer, à retirer, annonces de la cloche)
  + un par groupe « À régler » qu'elle ne comptait pas déjà. « N messages à lire » est la pastille de Messages.
- « 3 pas encore prêt » → « 3 pas encore prêts » (le pluriel recevait `r`, il choisit sur `n` : les 5 langues).

## Où est le code

| quoi | où |
|---|---|
| le modèle des chiffres, des dernières ventes, de l'alerte (pur) | `src/aujourdhui/modele.js` |
| où va chaque groupe, « Compléter », pastilles, publication (pur) | `src/designV2/aRegler.js` |
| le bloc « À régler · N » | `src/designV2/ARegler.jsx` (un `Groupe` natif replié de `Rangee`) |
| l'écran | `src/natif/ecrans/Aujourdhui.jsx` (composants natifs seulement ; l'ancien `src/designV2/Aujourdhui.jsx` et ses CSS sont retirés) |
| ajoutés à `src/natif/` | `Barres`, `Vignettes`, `CodeRetrait`, `Colonnes` (`complements.css`, mode d'emploi dans `docs/design/NATIF-composants.md`) |
| le branchement | `src/App.jsx` : `AujourdhuiAvecChiffresV2` (les chiffres), la branche « Aujourd'hui » de `Comptabilite only="journee"` (groupes publiés, alerte, dernières ventes), `rendreTache` (UNE ligne : `<ARegler onglet={t}/>` pour Ventes, Achats, Annonces), `badgesNav` ; `src/stockV2/StockV2.jsx` et `src/ecrans/Reglages.jsx` (une ligne chacun) |
| les textes | `src/i18n/langues/{fr,en,es,it,de}/designV2.js` (`v2.jour.*`, `v2.mois.*`, `v2.dv.*`, `v2.alerte.*`, `v2.reg.*`) |

**Aucune règle neuve, aucun calcul changé (§5).** Chaque valeur est DEMANDÉE à son propriétaire :
`valeurChiffre` (`src/design/carteChiffres.js`) sur `useSourcesCarte` — les mêmes appels que l'écran Argent
(`ArgentMoisV2`) : `questionsArgent`, le brut et sa couverture ; les lignes de « Vendu » sont `ventesFaites` ; l'alerte
lit `toShip` (une limite ESTIMÉE n'alerte jamais), `pickupUnion.urgents`, les retours « à déposer ». Les groupes sont
les cartes `jobs` de Ma journée, avec LEUR geste (`avant` puis `tab`).

**« À régler » : qui publie, qui lit.** Les groupes sont calculés par « Aujourd'hui » (les cartes vivent dans
`Comptabilite only="journee"`, qui est gelé quand il n'est pas à l'écran — `src/ecransGardes.jsx`). Il les PUBLIE ;
les onglets et les pastilles les LISENT. La dernière publication est gardée en mémoire (avec les gestes) et, en
résumé, sur l'appareil (`vrm_a_regler_v1:<vendeur>`, 12 h au plus) : l'app rouverte directement sur Ventes montre
ses rangées, dont le geste OUVRE alors leur écran ; dès qu'Aujourd'hui recalcule, la publication fraîche remplace.
⚠️ Limite connue : une rangée réglée dans un onglet reste affichée jusqu'au prochain passage par « Aujourd'hui »
(qui recalcule). Le vrai remède est de sortir le calcul des cartes de `Comptabilite` (un sélecteur partagé) — à faire
avec le lot « VRM natif », pas ici.

**Le geste « Compléter ».** `brancherARegler({ completer })` reçoit l'atelier `ouvrirCompleter({ sujet })` (un autre
lot) ; tant qu'il n'est pas branché, la rangée fait le geste du premier manque (le geste d'avant).

## « 1 j de retard » sous « 2 colis pressés » (son point 7)

Vérifié, rien changé : ce texte vient de `texteLimiteEnvoi` (`api/_lib/limite-envoi.js`), qui ne dit « N j de retard »
que pour une limite LUE dans l'e-mail du bordereau ; une date ESTIMÉE dépassée y devient « date estimée dépassée —
vérifie… », et la carte de Ma journée la remplace par « À vérifier sur Vinted » (`verif`, App.jsx). Les vignettes
suivent la même règle (`echeanceJ` : « à vérifier » pour une estimée).

## Preuves

- `node scripts/audit-aujourdhui.cjs` — les règles EXÉCUTÉES (modèle et « À régler ») : 45 contrôles ; 19 mutations
  (`MUTATION=liste`), chacune rouge.
- `node scripts/bancs/aujourdhui-propre.cjs` — l'app rendue sur une base INVENTÉE qui reproduit sa capture
  (50 ventes dont 8 à envoyer, 5 bordereaux prêts, 2 pressés par une limite lue, 2 prix illisibles, 15 colis à
  retirer à 6 points dont un au nom très long, 19 messages) ; bases `capture`, `estimee`, `volume`, `vide` ; 390 × 844
  tactile avec zone sûre, 1512, 1280 ; clair et sombre. Fond : aucun « À faire », chaque groupe dans son onglet avec
  son geste, pastilles, vendu des 7 jours et du mois = les ventes semées (« au moins » avec les 2 prix illisibles),
  reçu / bénéfice / à venir = l'écran Argent. Dessin : bande sans chevauchement, plaques entières, passe sur une
  ligne, barre d'onglets, un seul plein, cibles, contraste lu dans les PIXELS de la capture.
- Sur le build de `origin/main` (`BANC_DIST`), 390 clair : **20 rouges, 4 verts** (7 chevauchements dans la bande,
  8 plaques hors de leur case, textes superposés, « 3 pas encore prêt », cibles de 36 px, « 15 » blanc sur blanc).

(Les chiffres après l'écran natif et les mutations du banc sont à la fin de ce fichier.)
