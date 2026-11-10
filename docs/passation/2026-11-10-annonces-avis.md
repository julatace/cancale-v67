# 10 nov. — Lot U : annonces à compléter + avis sur chaque vente (`claude/annonces-avis`)

Validé par Julien (propositions du 9 nov., n° 31 et 32).

## 1. Annonces → « À compléter »

Une vue d'Annonces à part, à côté de « Sans achat relié » et « À relancer » (bouton
`data-vue-a-completer`, montré seulement s'il y a quelque chose). La grille (lot AM) n'est
pas touchée. Règle unique : `src/annoncesACompleter.js` ; vue : `src/AnnoncesACompleter.jsx`
(classes de « Qui dorment » + `src/styles-a-completer.css`).

Mesuré en lecture seule sur sa base (683 annonces captées) : `brand`, `size`, `status`
toujours présents (vides : 4 marques, 10 tailles, 2 états) ; `nPhotos` sur 681/683
(123 sous 5 photos) ; aucune description ni `numEcrit` dans la moisson actuelle.

Un manque n'est dit que s'il est LU :
- photos : `nPhotos` posé par l'extension seulement — le « 1 » déduit de la seule photo
  gardée par l'allègement (`photoCount`) n'est PAS une lecture (le banc l'a attrapé) ;
- marque / taille / état : `mapWardrobeItem` pose `champsLus` (le champ existait-il dans le
  dressing ?) ; champ lu vide ⇒ manque, champ absent ⇒ « pas su » ;
- N° : seulement si le réglage « Je numérote moi-même » est allumé avec la source
  « description » ; sinon VRM donne lui-même le N° (§5 (a)), rien à compléter. Description
  pas lue ⇒ pas su ; rien à la fin ⇒ « Pas de N° à la fin » ; écrit ailleurs ⇒ « N° pas à la fin » ;
- prix d'achat : `prixAchatDe` (saisi par lui) ; absent ⇒ « Sans prix d'achat », geste VRM
  (la saisie existante `saisirPrixAnnonce`, rien écrit sans OK).

Gestes : « Modifier ↗ » = `https://{domaine}/items/{id}/edit` (par identifiant) ; rien n'est
envoyé à Vinted. Filtre par manque (confort de l'écran). Le « pas su » est dit en une ligne.

⚠️ À décider : un ancien bloc « Annonces à compléter » existe dans Outils
(`src/OutilsArticlesVinted.jsx`, règle `bilanAnnonce` : titre, prix, description,
« caractéristiques », geste = brouillon VRM). Laissé tel quel (autre usage, ses tests) ;
deux notions au même nom — le fondre ou le renommer est un choix de Julien.

## 2. L'avis sur chaque vente

Récap d'une vente Vinted → Détails → « Avis reçu » (`src/AvisVente.jsx`, règle
`src/avisVente.js`). Lecture : `harvest_{uid}_feedbacks` par projection
(`select=avis:data->payload->user_feedbacks`), une fois par compte et par session.

**Mesuré (lecture seule)** : les 60 avis rangés (3 comptes) portent SEULEMENT
`{ id, rating, feedback }` — ni date, ni transaction, ni annonce (`avisPropre` de
l'extension ne garde rien d'autre) ; les 1 375 transactions captées n'ont aucun champ
d'avis ; les conversations seulement `feedback_reputation` (note du profil). **Donc aucun
avis ne peut être relié à une vente aujourd'hui** : la ligne dit « pas relié : Vinted ne
dit pas quelle vente il note », jamais un avis deviné (ni par ordre, ni par date, ni par
titre). Avis pas lus ⇒ aucune ligne. La règle relie déjà par `transaction_id` exact si un
jour l'avis le porte (il faudrait que l'extension le garde ET que Vinted le donne : à
mesurer, échantillon des NOMS de clés d'un avis brut). Aucun rappel d'évaluation.

## Preuves
- `scripts/audit-annonces-a-completer.cjs` : 15 contrôles (règles exécutées + branchement) ;
  rouge sur origin/main ; 9 mutations tuées (champ pas lu = manque, seuil photos, N° sans
  réglage, description pas lue = manque, lien sans id, avis deviné, avis contradictoires,
  `select=data`, `champsLus` retiré).
- `scripts/bancs/annonces-avis.cjs` : 76 verts, 390 tactile et 1512, clair et sombre ; il a
  attrapé deux défauts au premier passage (« 1 photo » déduit, bouton à 30 px), corrigés.
  Captures regardées.
- Audits variables, tdz, coherence, identite, icones, avis-vinted, numero-ecrit,
  dossier-vitesse-avis : verts. `npm run build` vert.
