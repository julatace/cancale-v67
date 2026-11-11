# 11 novembre — Importer son stock et ses ventes passées (lot « import-autre-outil »)

Branche `claude/import-autre-outil` (depuis `origin/main`, `origin/main` refusionné avant le rapport).
Aucune PR, aucun merge dans `main`, aucune écriture dans la vraie base.

## Ce que voit le vendeur

**Paramètres → Sécurité et sauvegarde → Importer** (lien direct : `/?tab=settings&section=importer`),
et un lien **facultatif** sur la carte « Démarrer avec VRM » de Ma journée (`CarteParcours`,
src/ParcoursArrivee.jsx : « Tu arrives d'un tableur ou d'un autre logiciel ? Importer mon stock ») —
hors des étapes comptées (l'événement `vrm:aller` vers `?tab=settings&section=importer`).

1. **Mon stock** · **Mes ventes passées** (un segment).
2. « Choisir le fichier » : `.csv` (« ; », « , », tabulation ; UTF-8 ou Excel Windows) ou `.xlsx`,
   lus **dans le navigateur** par la lecture de l'import des achats (`src/importAchats.js`, sans
   bibliothèque). 5 Mo, 2 000 lignes.
3. Les colonnes sont **reconnues** (en-têtes FR/EN courants) et **réglables d'un geste** (un menu par
   colonne ; choisir un champ le retire de l'autre colonne). Un champ obligatoire absent est nommé.
4. **Aperçu ligne par ligne**, calculé par **tranches de 250** (l'écran respire entre deux : 2 000
   lignes en ~0,2 s au banc, aucune tâche longue) : à importer · en conflit · déjà là · à vérifier ·
   ignorée, avec la raison sur la ligne ; 150 lignes montrées, le reste compté.
5. **Rien n'est écrit avant « Importer N lignes »**.
6. **Tes imports** : chaque import (date, fichier, nombre) avec « Annuler » → « Retirer N lignes »
   (deux gestes).
7. **Relier tes paires à leurs annonces** (stock) : une annonce Vinted **proposée** par paire
   importée ; c'est **son clic** qui relie.

## Les règles (src/importStock.js, module pur)

**Stock** — colonnes : N° (obligatoire), Description, Prix d'achat, Date d'achat, Emplacement, Notes.
- Le **N° est l'identité** (il dit où est l'article). Un N° déjà dans VRM — fiche d'annonce, vente,
  lien Leboncoin, Vestiaire, N° réservé (`panel_num_reserves`), stock déjà importé, **pool des N°
  servis** — ou deux fois dans le fichier ⇒ **CONFLIT montré** (« N°7 est déjà sur une annonce — rien
  n'est changé »), jamais écrit, jamais renuméroté.
- Remise à zéro (013) : le N° passe par `numeroExterne` avec la date de la ligne (« 230 » d'avant la
  coupure = B230, et c'est dit) ; archive active et pas de date ⇒ « N° pas su », ligne ignorée ;
  « B12 » tapé ⇒ ignoré (l'archive ne reçoit pas de nouveaux N°).
- **« Prix » seul n'est pas lu comme prix d'achat** (ce peut être son prix de vente) : il choisit
  lui-même la colonne. Montant illisible ⇒ **vide et dit** sur la ligne (la ligne reste).
- À l'écriture (`outilsImport.ecrire`, App.jsx) : les N° servis sont **relus** (un N° servi entre
  l'aperçu et le clic ⇒ rien n'est écrit, l'aperçu est relu) ; la numérotation doit être vérifiée
  (`numerotationPermise`) ; les N° importés **entrent dans le pool** (append-only : `prochainLibre` ne
  les redonne pas, `ajouterNumerosHorsEcran` les compte aussi) ; le prix devient le **coût par N°**
  (`vinted_buyprice_by_num`) seulement sur un N° qui n'en a aucun, relu au moment d'écrire.
- Les paires vivent dans `vrm_stock_importe` (synchronisée), marquées `source: 'importe'`, `importId`.

**Ventes passées** — colonnes : Date de vente (obligatoire), Prix de vente (obligatoire), Description,
Plateforme, Date de versement, N° de commande, N°.
- Datées **comme dans le fichier** ; date de vente illisible ⇒ ignorée (jamais « aujourd'hui »).
- Montant illisible ou vide ⇒ **vide et dit** ; la vente est **nommée** hors des totaux (« au moins »),
  jamais 0 €.
- **CA déclaré daté au VERSEMENT (§5)** : la date de versement du fichier ; sans elle, la vente est
  **« à dater », dans aucun mois** (« Déclarer » la range sous sa propre raison « importée sans date
  de versement », avec un bouton « Importer »).
- **Doublons par n° de commande seulement** (`refVente`, 3 caractères au moins) : déjà lue par VRM,
  déjà importée, deux fois dans le fichier. Une vente **Vinted / Leboncoin / eBay / Vestiaire sans n°**
  est « **à vérifier** » (VRM lit déjà ces ventes : un doublon ne s'y verrait pas) et n'entre que s'il
  coche « Importer aussi les ventes sans n° de commande ».
- Dans les règles de chiffres (`ventesDeclarables`, `ventesFaites`, nouveau paramètre `importees`) :
  une vente importée dont le n° est celui d'une vente **lue** (même identité `plateforme:n°`, lue avant
  OU après l'import) ne compte pas — jamais deux fois. Lignes marquées `importee: true`, plateforme
  « Autre » pour un site que VRM ne connaît pas. La copie serveur (`api/_lib/ventes-regle.js`) est
  refabriquée par `audit-bilan-semaine.cjs --recopie` (le serveur ne reçoit pas encore les ventes
  importées : paramètre vide ⇒ rien ne change pour lui).
- Elles vivent dans `vrm_ventes_importees` (synchronisée), marquées `source: 'importe'`.

**Annuler** (`annulerImport`) : retire ce que CET import a créé (par `importId` et ses `ids`), rien
d'autre ; un coût posé n'est retiré que s'il vaut **encore** ce que l'import a posé (une correction à
la main reste). **Le pool ne rétrécit jamais** : les N° restent réservés (dit avant de confirmer).
Journal : `vrm_imports` (synchronisé).

**Proposer, jamais relier** (`propositionAnnonce`) : annonce Vinted **sans N°**, même marque quand les
deux la disent, au moins un mot de modèle commun (pas une couleur, une taille, un mot vide) ; une
annonce n'est proposée qu'à une paire. « Relier » (son clic) : l'annonce prend le N° de la paire
(`vinted_annonce_numeros`, `manuelAt`, noté dans le journal des N°) — refusé si l'annonce a déjà un N°
ou si le N° est sur une autre annonce. Les annonces viennent du cache de l'onglet (Annonces ouvert une
fois) ; sinon la phrase le dit.

## Ce qui n'est PAS fait (dit honnêtement)

- Les paires importées **ne s'affichent pas encore dans l'écran Stock** (ni le garage 3D, ni la loupe
  « Tout sur le N° ») : elles sont dans `vrm_stock_importe`, leurs N° sont réservés, leur coût est posé
  par N°. Les montrer au Stock est le prochain chantier.
- Une vente importée sans date de versement se date en complétant son fichier puis en réimportant
  (annuler l'import d'abord) : pas de saisie à la main ligne par ligne.
- Le serveur (bilan de la semaine, widget) ne lit pas `vrm_ventes_importees`.

## Preuves

- `scripts/audit-import-autre-outil.cjs` : **60 verts** ; `--prouve` **17/17 mutations rouges** (N° déjà
  dans VRM accepté, N° en double accepté, prix illisible qui écarte, « Prix » seul lu comme prix d'achat,
  N° sans la date, coût sur un N° qui en a un, vente sans date ⇒ aujourd'hui, Vinted sans n° importée
  d'office, doublon par le titre, CA daté à la vente, vente lue après l'import comptée deux fois,
  montant vide compté 0 €, annuler un coût corrigé à la main, annuler un autre import, proposition
  d'une autre marque, écriture qui ne relit plus les N°, aperçu d'un bloc). Fichiers d'exemple
  **inventés** : CSV FR « ; » en encodage Excel Windows (« 12,50 € », JJ/MM/AAAA, 31/02 impossible),
  CSV « , » aux montants entre guillemets, `.xlsx` vrai (zip fabriqué, dates et prix numériques).
  Exécute les VRAIES `ventesDeclarables`/`ventesFaites` extraites d'App.jsx. Sur `origin/main` : rouge
  (module absent).
- Banc `scripts/bancs/import-autre-outil.cjs` (390 tactile + 1512, clair + sombre) : tout vert —
  conflits, rien écrit avant le clic, pool gardé + 12/13, coût sur 12 seul, fiche N°7 intacte ; N°20
  servi entre l'aperçu et le clic ⇒ refusé, dit, aperçu relu ; annuler (pool non rétréci) ; ventes
  (« à vérifier », « à dater ») ; 2 000 lignes (aucune tâche > 50 ms) ; le lien de la carte du
  parcours ouvre Importer sans changer les étapes comptées. Captures regardées. Sur `origin/main` : rouge.
- Audits retouchés (le memo a un nouvel argument) : `audit-urssaf.cjs` passe `ventesImp: []` à son
  exécution de `declRapport`. `declarablesCompta` (Compta.jsx) reçoit `importees` en paramètre (reste
  pure : `audit-registres`, `audit-dac7-comptes` verts).

## Gestes de Julien

Aucun.
