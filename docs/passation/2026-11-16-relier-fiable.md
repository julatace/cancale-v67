# 16 nov. 2026 — Relier un achat : des propositions fiables (branche `claude/relier-fiable`)

## Ce que Julien a dit

Capture iPhone, Achats en ligne : « je veux que la liaison pour relier l'achat soit beaucoup plus
fiable, sinon ça ne sert à rien de faire des propositions ». Sur la capture, la MÊME vente
« N°116 Adidas Spezial… » (paire violette) est proposée « Vente proposée · Possible · Relier » sous
TROIS achats différents (Spezial bleu marine, marron, bordeaux).

## La mesure (vraie base, LECTURE SEULE, 16 nov.)

Projections scalaires seulement (titre, prix, date, statut, adresse de photo ; fiches : titre, taille,
date de N°, lien d'achat), copiées dans le dossier de travail de la session (jamais dans le dépôt),
effacées à la fin. Rejeu de `affecterPropositions` sur ses 2 666 achats Vinted, ses 561 fiches sans
achat et ses 1 558 ventes des 12 derniers mois (≈ ce que l'app calcule).

- **La vente de la capture** : le titre de la vente dit « Adidas Spezial violet taille 37,5 » ; ses
  achats Spezial (523 achats « spezial », dont 90 avec une photo) n'écrivent **aucune couleur ni
  taille** (« Adidas spezial », « Zapatillas Adidas Spezial »…) : les couleurs vues sur la capture sont
  celles des PHOTOS des achats. La règle du 15 nov. ne connaissait la couleur que par le titre : rien
  ne l'écartait ; et un « possible » n'était pas exclusif ⇒ la même vente sous plusieurs achats.
- **Les champs** : achat = titre, prix, date de commande, statut, photo (706 sur 3 327 lignes, 21 %) —
  ni taille, ni couleur, ni catégorie en champ. Vente = titre, prix, date, photo (22 %). Fiche =
  titre, taille, photo, date du N°. Le champ couleur Vinted (`color_ids`) n'existe que pour quelques
  annonces (mesure du 15 nov. : 49, libellé vide) : il reste lu d'abord quand il est là.

| sur sa base (rejeu) | avant | après (titres seuls, photos pas encore lues) |
|---|---|---|
| achats avec une proposition sous eux (Achats) | **986** (19 « très probables ») | **9** (toutes « très probables ») |
| articles proposés sous PLUSIEURS achats | **161** (jusqu'à **53** achats pour un même article) | **0** |
| articles avec une proposition (« Sans achat relié ») | 1 717 | 9 |
| achats proposés à PLUSIEURS articles | 265 | **0** |
| pistes (repliées dans la feuille) | — | 1 717 articles |

**Vérité terrain** — ses 12 fiches qu'IL a reliées à un achat, rejouées comme si elles ne l'étaient pas :

| ses 12 liens | montré en ligne et juste | montré en ligne et FAUX | rien en ligne | le bon achat dans les pistes |
|---|---|---|---|---|
| avant | 8 | **4** | 0 | — |
| après (titres seuls) | 0 | **0** | 12 | 9 |

Avant, une proposition sur trois de sa vérité désignait le MAUVAIS achat. Après : aucune fausse ; ses titres
d'achat n'écrivent presque jamais taille ET couleur, donc tant que les photos ne sont pas lues rien n'est
« très probable » ; le bon achat est dans « Autres pistes » 9 fois sur 12. Les couleurs de photo (lues à
l'ouverture, sur l'appareil) feront monter les « très probables » ; ce rejeu ne peut pas les mesurer (le
conteneur n'a ni l'extension ni sa session).

Les couleurs des photos s'ajoutent à l'ouverture d'Achats / « Sans achat relié » (lues sur l'appareil,
gardées) : le nombre de « très probables » monte à mesure, jamais leur exclusivité ne bouge.

## La règle (src/liaisonAchat.js — une seule fonction, partout)

- **Filtres DURS** (une proposition qui en rate un n'est jamais montrée, ni en ligne ni en piste) :
  même marque ; un mot du modèle en commun, même version ; même pointure quand elle est connue des deux
  côtés (normalisée : « 42⅔ » = « 42,66 » = « 42 2/3 », « 42,0 » = « 42 », `tailleNorm`) ; **couleur
  compatible quand elle est connue des deux côtés** — le champ couleur de l'annonce d'abord, sinon les
  mots du titre (sept langues : bleu/blu/navy/marine, violet/viola/purple, bordeaux/burgundy…), sinon la
  **couleur dominante de la photo** (src/couleurPhoto.js : fond retiré par les bords, pixels du centre
  pesés, sans IA, sur l'appareil) ; achat commandé avant la mise en ligne / la vente ; achat ni
  remboursé ni déjà relié ; article sans achat ; « Ce n'est pas lui » respecté.
- **L'accord des couleurs** (`couleursAccord`) : deux côtés qui ont chacun une couleur VIVE se
  comparent sur leurs couleurs vives (le blanc d'une semelle n'accorde pas un violet et un bleu) ;
  sinon sur tout (un « blanc » écrit seul ne fait pas écarter une paire violet et blanc : prudence).
  Une couleur lue sur une photo tolère seulement les voisines que la lecture de pixels confond
  (bordeaux lu rouge ou marron, marron/beige, rouge/rose) — jamais bleu/violet.
- **« Très probable »** = taille ET couleur connues des deux côtés et d'accord, mots du modèle
  (couverture ≥ 50 %), score ≥ 8, pas un lot, pas un titre d'achat sans modèle ; si les deux photos ont
  une couleur lue, elles doivent s'accorder aussi.
- **EXCLUSIVITÉ** : les couples « très probables » sont pris du meilleur score au moins bon ; un couple
  n'est retenu que si l'achat devance de 2,5 tout autre achat de CET article ET l'article devance de 2,5
  tout autre article de CET achat — tous les concurrents comptent, même faibles. Égalité ⇒ rien.
  Un achat retenu n'est plus proposé ailleurs, même en piste.
- **Ce qui se montre** : `parArticle[key]` et `parAchat[tx]` portent AU PLUS une proposition, toujours
  « très probable ». Le niveau « Possible » n'est plus affiché nulle part en ligne. Les autres candidats
  (`pistes[key]`, qui passent tous les filtres durs) ne se voient que repliés sous **« Autres pistes ·
  N »** dans la feuille « Relier un achat / Choisir un autre achat » (et, repliées comme avant, dans la
  saisie en série). C'est toujours SON toucher qui relie (l'écriture de « Relier un achat », par le n°
  de la ligne, src/relierAutreAchat.js inchangé) ; « Ce n'est pas lui » (`vrm_liaison_refus`,
  synchronisé) : le couple ne revient jamais, ni en ligne ni en piste.
- **Partout la même** : Achats (sous un achat), Annonces → « Sans achat relié » (en vente et vendus),
  le récap d'une vente, le numérotage (`meilleureSuggestion`), la feuille « Relier un achat »
  (`propositionsArticle` / `pistesArticle`), la saisie en série (`seriePropositions`, qui remplace
  l'ancienne règle `suggestionsSaisieSerie` dans l'app). L'affectation globale est **publiée**
  (`publierAffectation`) : un écran qui juge un article seul lit ce qu'elle a dit, et ne propose jamais un
  achat déjà retenu pour un autre article.
- **Les photos** : après chaque affectation, les photos des articles qui ont des candidats et de leurs
  achats candidats (240 au plus par passe, chacune une fois par ouverture) sont lues par le chemin
  existant (`chargerPhotoBoite` : l'extension d'abord, sinon la route de VRM — le CDN de Vinted n'envoie
  pas d'en-tête CORS) ; la couleur est calculée et gardée sur l'appareil (src/indexCouleurs.js) ; puis
  l'affectation est refaite. Une photo illisible reste « pas su » : elle n'écarte rien, n'accorde rien.

## Les preuves

- `node scripts/audit-relier-fiable.cjs` (neuf) : **38 verts** — C (la capture : vente violette, trois
  achats bleu / marron / bordeaux, par photo puis par titre ⇒ AUCUNE proposition ; semelle blanche ;
  voisines tolérées sur photo seulement ; couleur pas sue ⇒ jamais « très probable »), X (même modèle +
  couleur + taille ⇒ UNE proposition sous UN achat ; deux achats identiques ⇒ rien ; deux ventes
  identiques ⇒ rien ; 50 identiques ⇒ 0 ; invariant ≤ 1 / ≤ 1 sur 96 × 96 ; l'isolé respecte la
  publiée), T (pointures), N (niveau), F (refus, en ligne, en piste, saisie en série), S (branchement).
  - **Sur l'arbre de départ** (`git archive origin/main`) : **27 rouges** (dont C1 qui reproduit la
    capture : la même vente sous les trois achats).
  - `--prouve` : voir « État à la reprise » (mutations : couleur ignorée, photo ignorée, semelle qui
    accorde, exclusivité article, exclusivité achat, pistes en ligne, « très probable » sans couleur,
    tiers de pointure, refus, pistes ouvertes d'office, app sans photo).
- `audit-liaison-achat` porté sur la règle (ordre vu par Julien = la très probable puis les pistes) :
  **37 verts**, précision inchangée (top-1 95 %, top-3 100 % sur son jeu inventé, 10 très probables,
  aucune fausse) ; 50 identiques ⇒ aucune proposition en ligne.
- `audit-identite` vert ; `audit-achats-a-relier` (G5 porté : 50 identiques ⇒ aucune proposition) ;
  `audit-suggestions-achat` (F7 porté sur `seriePropositions`) ; `prix-numerotage`, `fournisseurs`,
  `quoi-de-neuf` verts.
- Banc `achats-liaison` porté (les trois paires identiques ne reçoivent plus rien ; « Ce n'est pas lui »
  sur la très probable qui reste ; sous Achats, un article sous UN seul achat).

- Bancs : `achats-liaison` **78 verts, 0 rouge** (390 ×2, 1512 ×2, dont la feuille « Autres pistes »
  repliée puis dépliée, captures regardées) ; `annonces-achats` **56 / 0** (fixture : deux achats écrivent
  taille et couleur) ; `relier-achat-suggestions` **28 / 0**. `achats-relier` (B0 « Reçu d'achat », clic
  intercepté par la fiche) et `serie` (case « Coût d'achat » introuvable sur Ventes) sont **rouges aussi
  sur `origin/main` 5a9abe571** (build de main rejoué) : sans rapport avec ce lot.
- `audit-relier-fiable --prouve` : **11/11 mutations attrapées** (puis 4 de plus pour Délier / Reçu, rouges une à une).
- Bancs après les ajouts : `fiche-delier-recu` **vert** (390, 1512 ; captures : « Reçu · Délier » sous « Achetée 52 € »,
  la feuille du reçu au-dessus de la fiche, « Pas de reçu » sur un achat illisible) ; `achats-liaison` 90 contrôles
  (puce « Relier un achat » ×9 = le compte, 44 px, feuille, « Achetée 40 € ») ; `annonces-achats` **56 / 0**.
  `fiche-paire` est rouge (15) sur des contrôles de l'ancienne fiche (« grand N° », étapes) que ce lot ne touche pas.
- Passe complète `node scripts/lancer-audits.cjs` (673) : 69 rouges, **tous déjà rouges dans la CI de la dernière PR
  fusionnée (#1181)**, sauf `recherche-universelle` (mesure de durée : rouge en parallèle, vert seul).


## Deux ajouts de Julien pendant le lot (16 nov.)

1. **Fiche d'une vente, onglet « Argent »** (capture N°215 : « ici j'ai mal relié un achat, je veux pouvoir
   l'enlever, et tu peux mettre le justificatif d'achat à côté ») : à côté de « Achetée 24,63 € », **« Reçu »**
   et **« Délier »** (`GestesAchatRelie`, src/FichePaire.jsx ; `lienAchatDe` / `delierAchatFiche` /
   `ouvrirRecuFiche`, src/App.jsx dans `AppCoeur`).
   - Le lien est lu par identité : la fiche de la paire (`buyFromId`), sinon la ligne de SA vente.
   - « Délier » : une phrase de confirmation (`askConfirm`), puis un geste annulable (`gesteVrm`) : `patchDelier`
     (le lien part, le prix posé PAR le lien aussi — un prix tapé par lui reste), `vinted_buyprice_by_num` retiré
     seulement s'il vaut le prix du lien, et le couple rangé dans « Ce n'est pas lui » (`vrm_liaison_refus`, sous
     la clé de l'annonce ET celle de la vente) : la même proposition ne revient pas. Le bénéfice redevient « ? »
     avec sa raison (prix d'achat manquant), jamais 0 (la règle de la fiche).
   - « Reçu » : l'achat relié est relu (`lireAchatsFiche`, sinon la copie `buyFrom`), son reçu e-mail se trouve par
     SON n° de transaction (`recuDeLAchat`, §5) et s'ouvre dans la feuille du reçu (au-dessus de la fiche, `z`) ;
     sans e-mail, l'attestation tirée de l'achat (`generateAchatJustificatif`, la règle de « Reçu » de Ventes) ; ni
     achat lisible ni reçu ⇒ « Pas de reçu », jamais un lien mort. Pas fait : la photo du ticket d'un achat HORS
     plateforme (lien `buyGros`) — ces liens n'ont pas de `buyFromId`, la fiche ne montre rien pour eux.
   - Banc `fiche-delier-recu` (390 tactile, 1512) ; audit `relier-fiable` D1-D5 + 4 mutations.
2. **Annonces** (capture de la liste : « il n'y a rien pour relier un achat ») : sur chaque annonce sans achat
   relié — **la même règle que le compte de « Sans achat relié »** (`sansAchatRelie`) — une puce
   **« Relier un achat »** (44 px au doigt ; téléphone : 3e ligne de la rangée ; ordinateur : sous le nom ;
   vignettes : dans la carte) qui ouvre la feuille « Choisir un achat » (`openPicker` : la très probable, les
   pistes repliées, puis la recherche) ; reliée, **« Achetée 40 € »** discret. SON clic relie par l'identifiant
   de l'annonce (`updatePair`) : la vente de cette annonce lit sa fiche par identité (`identiteAnnonce`) et une
   republication garde le N° et la fiche (src/repriseNumero.js) — pas de nouveau banc pour « la vente plus tard
   hérite du lien » (règle existante, jugée par ses audits). Banc `achats-liaison` : puces = compte, ≥ 44 px,
   la puce ouvre la feuille, relier ⇒ « Achetée 40 € » et le compte baisse d'un.

## ÉTAT À LA REPRISE

- Code fini et poussé sur `claude/relier-fiable` ; mise en ligne par PR (voir l'état de la PR dans
  l'historique Git / GitHub).
- Pas mesurable ici : le nombre de « très probables » une fois les couleurs de PHOTO lues sur son appareil
  (il faut ouvrir Achats ou « Sans achat relié » chez lui ; chaque photo est lue une fois, gardée).
- Piste suivante possible (non faite) : le récap d'une vente n'a une proposition que si l'affectation a été
  calculée (Achats ou « Sans achat relié » ouverts) ; sinon il juge la vente seule, avec la même règle.
