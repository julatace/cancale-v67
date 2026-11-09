# 9 novembre — Achats prêts à confirmer, et « Exporter pour mon comptable »

Branche `claude/achats-export` (depuis `origin/main`, `origin/main` refusionné avant le rapport).
Demande de Julien (« fais tout ») : 1. le prix payé sur Vinted proposé dans la saisie en
série, jamais écrit sans son clic ; 2. un export pour le comptable (période, CSV + PDF).

## 1. Achats prêts à confirmer (saisie en série)

**Ce que l'historique avait déjà tranché** (cherché dans `historique-compta-urssaf-abonnement.md`,
`historique-numeros.md`, `journal-agent-2.md`) : rien n'interdit de PROPOSER. Le 3 nov.
(13 h 02), Julien a demandé « Utiliser 42,90 € » pour un article relié PAR IDENTITÉ à un
achat (`src/prixAchatPropose.js`) : montant LU (le reçu Vinted quand sa ventilation tombe
juste : article + port + frais Vinted ; sinon l'article seul, dit), jamais écrit sans son
tap, « Valider les N prix proposés » avec confirmation. La règle §2.5 interdit de DEVINER ;
une valeur lue, proposée, écrite par son clic, est la règle déjà en place. Le 7 sept., il a
été mesuré qu'aucun pont automatique paire ↔ achat n'existe (il rephotographie ses paires) :
la proposition ne vient donc QUE d'un lien qu'il a posé (`buyFromId`, n° de transaction) ou du
même fichier photo exact — jamais du titre.

**Fait** (`src/App.jsx`, feuille « Prix d'achat à compléter ») :
- chaque fiche sans coût qui a une proposition montre « **Payé sur Vinted : 85,40 €** »
  (reçu juste, détail « Article 80,00 € · Frais de port 3,40 € · Frais Vinted 2,00 € ») ou
  « **Article seul sur Vinted : 25,50 €** — sans le port ni les frais Vinted (reçu pas lu) » :
  un prix d'article n'est jamais présenté comme payé ;
- deux gestes : **Garder** (son clic : l'écriture de « Relier un achat », prix + lien +
  instantané) et **Corriger** (met le curseur dans le champ, vide ; n'écrit rien) ;
- **Tout garder (N)** remplace « Valider les N prix proposés » : la même confirmation qui
  liste « N°12 · 85,40 € » par ligne ; Annuler ⇒ rien.
- Le texte vient d'une règle pure, `texteProposition` (`src/prixAchatPropose.js`).
- Achats hors plateforme : inchangés (pas de proposition). Lien achat ↔ paire : toujours
  `buyFromId` / photo exacte (`achatParIdentite`), jamais le titre.

**Limite dite** : le montant « payé » complet ne vient que du REÇU (email). La transaction
d'achat captée par l'extension n'a pas été mesurée pour un total payé (aucun lecteur dans le
code, et la seule base Supabase accessible à cette session n'est PAS celle de VRM — rien n'a
été lu). Sans reçu : « Article seul ». Mesure à faire : un `harvest_{uid}_txn_{tx}` côté
acheteur porte-t-il le total (prix + protection + port) ? Si oui, c'est une identité de plus
pour « Payé sur Vinted ».

## 2. « Exporter pour mon comptable » (`src/exportComptable.js`)

Comptabilité → Documents et réglages → carte **Exporter pour mon comptable** (après le récap
mensuel). Rien n'est lu tant qu'il n'a pas touché « Préparer ». Période : Mois (13 derniers),
Trimestre (5), Année (2). Deux fichiers, fabriqués dans le navigateur :
- **Tableur** `Export-comptable-{période}.csv` : UTF-8 avec BOM, « ; », virgule décimale
  (Excel FR). Sections : résumé, ce qui manque, CA déclaré par mois, ventes versées (date de
  vente, date de versement, plateforme, compte, N°, référence, titre, montant reçu), ventes
  À DATER à part, achats (date, plateforme, compte/fournisseur, référence, N°, article,
  **coût saisi** ou vide, montant lu et sa source).
- **PDF d'une page** : résumé, CA par mois, URSSAF, ce qui manque ; le détail est dans le tableur.

**Aucune règle recopiée** :
- ventes = `livreDesRecettes` (les lignes de `ventesDeclarables`, datées au versement) par
  `recettesDe` — la même écriture que la carte « Registres » (sortie de `RegistresCarte`) ;
- achats = `registreDesAchats` par `registreAchatsDe` (idem) ; nouveau champ `saisi` = les
  prix tapés sur les fiches reliées par `buyFromId`, tous présents, sinon vide ;
- CA déclaré = la ligne publiée `vinted_urssaf_mois` (mois par mois) et le total par
  `montantPeriodeUrssaf` (la carte « Prochaine déclaration ») ; « au moins » repris d'elle ;
- URSSAF = `aPayerUrssaf` au taux réglé **seulement si `regimeFiscal()` = micro** ; sinon
  « URSSAF non calculée » + la raison (statut pas choisi : « la question est en haut de Comptabilité ») ;
- trimestre ajouté à `src/registres.js` (`AAAA-Tn`, `moisDePeriode`) ;
- comptes exclus : déjà dehors par `declarablesCompta` / `compteEcarte` ;
- aucun coût saisi ⇒ « — » (jamais « au moins 0,00 € ») ; « 12 achats sans coût saisi »
  nommé ; jamais « encaissé ».
- Si le total des ventes listées diffère du CA déclaré (vente notée « déclarée » dans un autre
  mois), l'export suit la ligne publiée et le DIT.

## Preuves
- `scripts/audit-achats-export.cjs` : **55 verts** ; `--prouve` **8/8 mutations** (proposition
  écrite à l'affichage, « article seul » dit payé, coût deviné depuis le montant lu, lien par
  titre, URSSAF quel que soit le statut, « à dater » dans les ventes, trimestre amputé, CA
  recalculé depuis les ventes). Dont : 50 fiches + 50 achats au même titre ⇒ un seul coût,
  celui que SON n° relie, une seule proposition ; totaux de l'export = carte « Prochaine
  déclaration » = livre des recettes (mois, trimestre, année) ; CSV relu ; PDF relu (1 page).
  Sur `origin/main` : rouge (modules absents).
- Banc `scripts/bancs/achats-export.cjs` (base inventée, 1512 sombre + 390 tactile) :
  **104 verts**. Saisie en série : « Payé sur Vinted : 85,40 € » / « Article seul », 10 fiches
  identiques sans proposition, rien écrit à l'affichage, ni par Corriger, ni par Tout garder
  annulé ; Garder écrit 85,40 € + le lien sur N°12 seulement. Export : CA = ligne publiée,
  URSSAF 12,4 %, ventes = Registres, achats sans coût, à dater à part, CSV (BOM, virgule),
  PDF 1 page, compte exclu absent, statut pas choisi ⇒ non calculée. **Rouge sur origin/main**
  (11 rouges) ; **mutations** : proposition auto-écrite ⇒ 6 rouges ; URSSAF toujours calculée ⇒ 3 rouges.
- `audit-registres` 64 verts (lit maintenant `registreAchatsDe`/`recettesDe`, appelés par la
  carte) ; banc `registres` 112 verts.
- Audits verts : urssaf, identite, statuts, variables, tdz, coherence, export-donnees,
  versement-releve, benefice, boutons, icones, violet, prix-achat-propose, suggestions-achat,
  prix-numerotage. `npm run build` vert.
- Captures regardées (feuille de saisie 390, carte d'export 390/1512, sans statut, PDF).

## Geste de Julien
Aucun. À regarder : Comptabilité → Documents et réglages → « Exporter pour mon comptable ».
