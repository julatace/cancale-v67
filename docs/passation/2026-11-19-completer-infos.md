# 19 nov. 2026 — L'atelier « Compléter » (branche `claude/completer-infos`)

## Ce que Julien a dit

« essaye de trouver autre chose pour relier les achats, mettre les prix plancher minimum, mettre les prix — toutes les
informations en fait sur les annonces, sur les paires, ça doit être beaucoup [plus simple et rapide] ». Sur son iPhone ce
matin : cinq cartes (« 4 ventes sans prix d'achat », « 51 annonces sans prix mini », « 33 annonces numérotées sans prix
d'achat », « 8 annonces sans numéro », « 5 achats arrivés à numéroter »), cinq écrans, des dizaines de gestes. Il a déjà vu
le glisser-déposer, la liste à deux colonnes, « tous mes achats » : il demande AUTRE CHOSE. Puis, dans la journée :
« dis-toi que l'outil doit être pratique, pas chiant » ; et le design devient « VRM natif » (docs/design/NATIF.md).

## Ce qui est livré

**UN atelier, UNE question à la fois** — une page poussée du design natif (`src/completer/Completer.jsx`, chargée à la
demande ; composants de `src/natif/` : `PagePoussee`, `Faits`, `Groupe` + `Rangee`, `Bouton`, `Segmente`, `Feuille`, `Toast`).

- **La file** (`src/completer/regles.js`, pure) : les vendues d'abord (la plus récente en tête — le bénéfice en dépend),
  puis les annonces regardées (favoris), puis le reste (le plus d'argent en jeu), puis les fiches « À publier ». Chaque
  article ne porte QUE ses manques, lus par les règles existantes : `lignesManquantes` (prix mini), `sansAchatRelie`
  (annonce numérotée sans prix d'achat), la liste des ventes sans achat de l'app (`fileVendus`), les annonces à qui l'app
  demande un N° (`numerosADemander`, seulement en « je numérote moi-même »). Les ventes de plus de 30 jours sont comptées
  à part (« Ventes de plus de 30 jours »), jamais mêlées, jamais cachées.
- **La carte** : la photo en grand, la plaque N°, le titre, ses faits (taille, prix, favoris, site, compte s'il y en a
  plusieurs), puis la question :
  - **« Payée combien ? »** : jusqu'à 3 achats proposés en rangées photo (la « très probable » de `liaisonAchat`, puis ses
    pistes ; l'identité « même fichier photo » en tête) — titre de l'achat, taille lue (« ✓ » si c'est la même), vendeur,
    date, pourquoi, et ce qu'il a payé. **Un toucher relie** : l'écriture de « Relier » de l'app (`relierGlisse` →
    `confirmerLiaison`, le prix du reçu), par le n° de transaction de LA rangée touchée. Sinon « Taper le prix » (le pavé,
    dans l'écran), « Autre achat » (la feuille « Tous mes achats » de l'app, ses « Déjà reliés », ses lots), « Je ne sais
    plus » (noté dans `vrm_completer_sans`, aucun prix écrit), « Plus tard » (un toucher, pour cette séance).
  - **« Ton prix mini ? »** : des puces CALCULÉES et dites — « −10 % 76 € », « −15 % 72 € », « −20 % 68 € » (SON prix, à
    l'euro du dessous, en centimes entiers) et « achat + 10 € 62 € » quand l'achat est connu ; sous son coût (achat + frais
    saisis) la puce le DIT (ambre) ; « au prix ou plus » n'est jamais proposé. Ou « Autre montant » (le pavé).
  - **« Son prix ? »** seulement pour une fiche « À publier » sans prix (rien ne part chez Vinted).
  - **« Son N° ? »** : le pavé, « Prochain libre : N » ; écrit par `poserNumero` (tous ses garde-fous).
- **Aucune attente** : la réponse fait avancer tout de suite (la carte suivante est déjà dessinée, ses photos décodées) ;
  l'écriture part 40 ms après, par le moteur des gestes (`gesteVrm`, une lecture ratée n'écrit rien) ; **« Annuler » 10 s**
  (le `Toast`, sous la barre de titre). « ↶ » revoit la réponse précédente. Il ferme, il rouvre : il reprend où il s'était arrêté.
- **Ce qui est CERTAIN se remplit seul** (sa demande du jour) : un article qu'IL a déjà relié à un achat et dont le prix est
  resté vide reçoit ce qu'il a payé (`prixCertains` : jamais un lot, jamais une ressemblance) — un geste annulable, dit.
- **La règle en lot** (une feuille) : « −10 % · −15 % · −20 % · Autre % · achat + 10 € », l'aperçu ligne par ligne (N°, prix,
  prix mini), les écartées NOMMÉES (prix pas lu, achat pas connu, au prix ou plus, sous ton achat — celles-ci décochées, il
  peut les cocher), un toucher décoche, **« Poser N prix mini »** applique, « Annuler » rend tout. L'entrée « prix mini »
  ouvre cette feuille dès 5 annonces : **3 touchers** (ouvrir, −15 %, poser).
- **« ⋯ » Ce qui reste** : le filtre « Toutes · En ligne · Vendues », le compte par sorte (un toucher filtre), « Prix mini
  en lot », « Achats arrivés à numéroter » (ouvre l'atelier d'arrivée), « N mises de côté — Les revoir », la grille.
- **Ordinateur** : la file à gauche, la carte à droite ; chiffres, Entrée (valider et suivant), Tab (plus tard), 1 2 3
  (choisir l'achat / la puce), ← (revoir), Échap ; la vue « Grille » (N° · photo · titre · prix · prix mini · acheté).
- **L'app ne harcèle plus** : les cartes « N annonces sans prix mini », « N annonces numérotées sans prix d'achat », « N
  articles sans numéro », « N ventes sans prix d'achat » sont retirées de Ma journée — UNE entrée discrète « N infos à
  compléter ». Le prix mini n'y compte que si l'acceptation automatique est ALLUMÉE (§3 inchangé : sinon il n'est demandé
  que dans « Prix mini », avec la phrase « servira quand tu l'allumeras »).

## Comment brancher

```js
import { ouvrirCompleter, useCompteursCompleter } from './completer/porte.js';
ouvrirCompleter();                       // tout
ouvrirCompleter({ sujet: 'mini' });      // ⇒ la règle en lot dès 5 annonces ; sinon les cartes « prix mini »
ouvrirCompleter({ sujet: 'achat' });     // · 'prix' · 'numero' · 'anciennes'
ouvrirCompleter({ num: '124' });         // sur l'article de ce N°
const c = useCompteursCompleter();       // undefined en cours · null pas su · { articles, questions, achat, achatVentes,
                                         //   achatAnnonces, mini, prix, numero, anciennes, mis, miniActif } (un champ null = pas su)
```

La coque (`AppCoeur`) écoute `vrm:completer` et monte UNE instance `Comptabilite only="completer"` (cachée) : les mêmes
lectures, les mêmes écritures, où qu'on soit dans l'app. Les compteurs sont publiés par l'écran qui a lu annonces et ventes
(Ma journée, Annonces, l'atelier), par la MÊME règle, chargée hors du démarrage.

## Ce qui a été retiré / gardé

- Retiré : les quatre cartes de Ma journée ; la boucle de feuilles « Donne-lui un N° » (`demanderNumerosManquants`).
- GARDÉ (consigne du 19 nov. : Julien utilise « Relier achats et ventes » à l'ordinateur) : `RelierGlisser` et ses fichiers
  ne sont pas touchés. Gardés aussi, parce qu'un geste unique en dépend ou faute de temps : la feuille « Relier un achat »
  (« Autre achat » de l'atelier), « Sans achat relié » d'Annonces, la saisie en série, « Prix mini manquants » d'Offres
  auto, la feuille du prix d'achat de la notification. Ils ne sont plus annoncés par des cartes.
- Moteur des gestes : `duree` (10 s) et le type d'opération `fusion` (créer une entrée sans jamais en remplacer une : le
  N° donné tout seul à une vente entre-temps reste) — ajouts, `audit-geste-annulable` vert.

## Preuves

Voir le rapport de fin de session (audits, mutations, banc, captures). `scripts/audit-completer.cjs` exécute les règles et
le moteur ; `scripts/bancs/completer.cjs` joue dix articles au doigt, mesure les touchers et le temps entre deux cartes.

## Reste

1. Brancher les entrées du design natif (Aujourd'hui, « À régler » des onglets, la fiche) sur `ouvrirCompleter`.
2. Retirer « Sans achat relié », la saisie en série et « Prix mini manquants » quand leurs portes pointeront sur l'atelier
   (leurs audits et bancs à porter en citant la décision du 19 nov.).
3. Les offres en attente ne pèsent pas encore dans l'ordre (seuls les favoris) ; un achat arrivé se numérote toujours dans
   l'atelier d'arrivée (lien depuis « Ce qui reste »).
4. Pas mesuré sur un vrai iPhone ; ses volumes réels (≈ 2 000 achats, ≈ 1 400 articles sans achat) : la file est bornée
   (ventes de 30 jours), l'affectation des achats reste celle de l'app (calculée après le rendu).

## Reprise du 19 nov. (soir) — le prix d'achat repris du reçu, et le banc remis au vert

**Décision de Julien du 19 nov.** (« 2 oui », texte exact en fin de `docs/passation/2026-11-19-demandes-julien.md`,
branche `claude/project-review-nsk5su`) : le montant du REÇU de CET achat est posé seul quand l'achat est relié à
l'article par identité ou reçoit son N° ; jamais deviné ; un lot jamais divisé ; une saisie jamais écrasée ; dit une fois.

- **La règle** : `src/prixAchatRecu.js` (pur). Un article (fiche ou vente) dont `buyFromId` désigne un achat LU au même
  n° de transaction, prix vide, pas un lot (`estLot` vrai, pas su, `aSaisir`, ou deux N° sur le même achat ⇒ rien), reçu
  lu par SON n° et juste au centime ⇒ `buyPrice` = « Montant payé » du reçu (+ `buyPriceSource: 'recu'`,
  `buyPriceRecuTx`), et `vinted_buyprice_by_num` du N°. L'article seul (sans port ni frais) n'est PLUS posé : ce n'est
  pas ce qu'il a payé. Autre devise, remboursé, reçu faux ⇒ rien.
- **L'écriture** : par `ecrireOps` (relire puis écrire, le chemin des gestes) avec deux types d'opération neufs du moteur
  (`src/gesteAnnulable.js`) : `champsSiVide` / `cleSiVide`, revérifiés sur la valeur RELUE — une saisie arrivée entre la
  lecture et l'écriture gagne. Aucun inverse.
- **Un propriétaire** : l'app (`Comptabilite`, après `ventilationDeTx`), seulement nuage chargé, achats lus, reçus lus,
  lots su (`infosAchatsLues`). Dit une fois par toast « 1 prix d'achat repris du reçu · N°12 · 47,45 € » (`cpl.fait.recu`,
  5 langues), seulement pour ce que la valeur relue porte vraiment. L'atelier « Compléter » n'écrit plus sa copie
  (`prixCertains` délègue à la règle) : la question « Payé combien ? » disparaît quand le prix arrive ; elle reste pour
  les lots, les achats sans reçu lu et les articles sans achat relié.
- **Audit** : `scripts/audit-prix-achat-recu.cjs` (23 verts, `--prouve` 16/16) ; `audit-completer` (E9–E11, S9) suit.
- **Banc `completer` remis au vert** : les `.n-bouton` tombaient à 34 px (règle de base des boutons d'`index.html`, hors
  couche, gagnait sur `@layer vrm-natif`) ⇒ les composants `n-*` en sont exclus (`:where`, même spécificité pour les
  autres) ; la croix « Fermer » de `styles-boutons.css` (marge −8 px !important) n'atteint plus la feuille native ;
  « Annuler » (toast) passe par le portail natif (invisible à 390 px) ; la carte laisse la zone sûre du bas ; la règle en
  lot du « prix mini » ne se juge que sur des annonces LUES ; le banc juge le PRIX (pas la ligne) pour « Je ne sais plus »
  et mesure la forme une fois les mouvements finis.

**Geste de Julien** : aucun.
