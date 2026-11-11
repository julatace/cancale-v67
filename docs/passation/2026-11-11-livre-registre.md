# 11 nov. 2026 — Le livre des recettes et le registre des achats, complets (lot `livre-registre`)

Branche `claude/livre-registre` (depuis `origin/main`). Demande validée par Julien : les deux
registres d'un micro-entrepreneur en achat-revente, avec chaque mention obligatoire, à l'écran
(par mois, filtrable) et en PDF + CSV + XLSX horodatés pour un contrôle.

## Ce qui existait
`src/registres.js` (3 nov.) : `livreDesRecettes` (les lignes de `ventesDeclarables`, datées au
versement, « à dater » à part) et `registreDesAchats` (Vinted hors annulés, hors plateforme, en
gros). Carte « Registres » (Argent → Déclarer) : deux rangées, PDF et tableur. Il manquait :
le client, la nature, le mode de règlement (espèces distinguées), la pièce justificative, les
totaux trimestriels, une vue à l'écran, l'horodatage, l'Excel, les sources.

## Ce que dit le droit (et d'où) — À VÉRIFIER
Légifrance, BOFiP et service-public **n'ont pas pu être ouverts** depuis la session (proxy :
403 / nom introuvable). Les mentions viennent d'extraits rendus par une recherche web, recoupés :
- CGI art. 50-0, 5 : livre-journal servi au jour le jour, détail des recettes, appuyé des
  factures et pièces ; registre récapitulé par année du détail des achats (vente de marchandises).
- Code de commerce L. 123-28 (registre des achats pour la vente de marchandises) et D. 123-205-1
  (décret 2008-1405) : chronologique, montant et origine, espèces distinguées, références des pièces.
- BOFiP (doctrine 2834-PGP) : totalisé en fin de trimestre et d'année.
- Fiche service-public F36018 : recettes = date, référence de la pièce, client, nature, montant,
  mode de paiement ; achats = date, pièce, fournisseur, nature, montant, mode de paiement.
Chaque source porte `verifie: false` dans `SOURCES` (src/registresConformes.js) : l'écran, le
CSV, l'Excel et le PDF disent « à vérifier » à côté de chacune. Une source relue ⇒ `verifie:
'AAAA-MM-JJ'`. Les URL Légifrance pointent le CODE entier (identifiant d'article pas vérifié).
Le mot « conforme » n'est jamais écrit (audit M8).

## Ce qui est livré
- `src/registresConformes.js` (pur) : complète les lignes des registres SANS règle recopiée.
  - Client : nom de la **facture Pro** de CETTE vente (`email_invoice_*` : `transaction` pour
    Vinted, `plateforme`+`reference` sinon ; avoir, facture annulée, deux factures ⇒ aucune) ›
    **pseudo** de l'acheteur (transaction `harvest_{uid}_txn_{tx}` lue côté VENDEUR, projetée) ›
    « Particulier ». Jamais un nom hors facture Pro (données minimales).
  - Fournisseur : pseudo du vendeur (transaction lue côté ACHETEUR) › « Particulier (Vinted) » ;
    hors plateforme et en gros : ce qu'il a saisi.
  - Nature : « Vente · titre » / « Achat · titre » / « … 10 paires en gros » ; sans titre, la
    nature reste générique et le manque est compté.
  - Règlement : « Paiement via <plateforme> », Espèces = Non ; hors plateforme, en gros,
    importées : VIDE et nommé (« à écrire sur le fichier exporté » — VRM ne le connaît pas).
  - Pièce : facture Pro › facture d'achat jointe (`achat_facture_*`, photo ⇒ « Photo du
    ticket », PDF ⇒ « Facture jointe ») › reçu Vinted relié par SON n° de transaction › la
    référence de la transaction. Rien ⇒ vide et nommé.
  - Une recette DÉCLARÉE sans date de versement reste dans le mois de sa déclaration (règle de
    `ventesDeclarables`) et sa date manquante est nommée.
  - `manquesNommes` (comptés, avec le geste : Ouvrir Achats · Ouvrir Vinted · à écrire sur le
    fichier), `parMois`, `totauxPeriodes` (trimestres + période), `filtrerLignes` (plateforme,
    recherche sans accents, « à compléter »).
  - Exports : `csvConforme` (BOM, « ; »), `feuillesConformes` → `xlsxClasseur` (Recettes/Achats,
    À dater, Totaux, Sources ; montants en vrais nombres), `pdfConforme` (A4 italienne, par mois
    avec sous-totaux, manques en ambre, mentions et sources, pied horodaté et paginé).
    Nom : `Livre-des-recettes-2026-11-etabli-20261111-1432.pdf` ; « Établi le 11/11/2026 à 14:32 ».
- `src/registres.js` : chaque ligne porte aussi `ym` (le mois que la règle donne) et `uid`.
- `src/RegistresVue.jsx` : la feuille (portail `SheetShell`) ouverte par « Voir » sur la carte :
  Segmenté recettes/achats, période, plateforme (si plusieurs), recherche, « À compléter (N) »,
  total (« au moins » si partiel), manques nommés + geste, mois avec nombre et total, « Dans
  aucun mois · à dater », « Ce que dit la loi » (repli : mention → sources, « à vérifier »),
  pied PDF · CSV · Excel. Tout le texte par `tr()` (clés `registres.*`, 5 langues).
- `src/ecrans/Compta.jsx` (`RegistresCarte`) : bouton « Voir » ; mentions lues AU BESOIN (feuille
  ouverte ou export) : pseudos par lots de 100 en projection (`SELECT_PSEUDOS`), factures Pro
  projetées (`SELECT_FACTURES_REGISTRE`), factures jointes (`lireFactures`, liste sans contenu) ;
  PDF / Tableur de la carte = les exports complets horodatés.
- « Quoi de neuf » : `livre-registre` (pour : pro).

## Décisions tranchées (dans l'esprit de la demande)
- « Particulier » quand l'acheteur n'est pas connu (sa demande). Pseudo plutôt que nom.
- La référence de transaction de la plateforme vaut référence de pièce (c'est le justificatif
  que la plateforme tient) ; une facture ou un reçu la remplace quand il existe.
- (Remplacé par « Payé en », voir la suite ci-dessous.)
- Les anciennes `csvRegistre` / `pdfRegistre` restent (audit-registres, zip comptable) ; la carte
  ne les appelle plus.

## Limites dites
- La forme `transaction.buyer.login` / `seller.login` côté vente n'a pas été MESURÉE sur la vraie
  base (aucune base VRM joignable) ; la lecture côté achat est celle du livre de police. Forme
  absente ⇒ « Particulier », jamais un faux.
- Mois affichés en français dans la feuille (`libellePeriode`) quelle que soit la langue.

## Preuves
- `scripts/audit-livre-registre.cjs` : 37 verts ; `--prouve` 13/13 mutations rouges (client par
  titre, pseudo du mauvais côté, avoir pris pour pièce, « à dater » dans un mois, manque tu,
  règlement inventé, source dite vérifiée, nom sans horodatage, montant texte dans l'Excel, reçu
  d'un autre achat, trimestres absents, `select=data`, filtre inopérant). Excel relu par openpyxl,
  PDF par pdf.js.
- Banc `scripts/bancs/livre-registre.cjs` (1512 sombre, 390 clair tactile, locale fr-FR) :
  **48 verts** — recettes du mois = ventes versées (lignes, total, groupe du mois), « à dater »
  à part et nommée, client par facture Pro / pseudo, projection des transactions, recherche,
  sources « à vérifier », PDF/CSV/Excel horodatés relus = l'écran, achats (pseudo vendeur,
  photo du ticket par identité, « à compléter » sur la ligne, filtre « À compléter »), 44 px,
  aucun débordement, aucune erreur. Rouge sur `origin/main` par construction (aucun bouton
  « Voir »). Captures 390/1512 et PDF regardés. Le Segmenté (36 px, composant commun) est hors
  de la mesure des 44 px.
- Remarque : un navigateur en anglais voit la feuille en anglais (`tr`) ; le banc fixe fr-FR.
- Banc `registres.cjs` : 112 verts (nom de fichier horodaté exigé).
- Audits communs : variables, tdz, coherence, identite, icones, textes-courts, fonctions-api,
  secrets, quoi-de-neuf, traduction, registres : verts.

## Suite (même jour, validé par Julien) : « Payé en »
- `src/modePaiement.js` (pur) : Espèces · Carte · Virement · Chèque · Autre ; un mode inconnu
  n'est jamais pris ; vide = « — » et le manque nommé.
- `src/composants/ChoixPaiement.jsx` : cinq choix de 44 px, facultatif (rien par défaut, second
  toucher = enlevé), dans « Nouvel achat » / « Modifier l'achat » hors plateforme
  (`src/ecrans/Achats.jsx`, champ `paiement` de `vinted_offvinted_buys`, synchronisé) et le
  formulaire d'achat en gros (`src/AchatsOutils.jsx`, `vrm_fournisseurs.achats[id].paiement`,
  gardé par `lireRegistre` / `champsAchatGros`). Aucune migration.
- Registre des achats : colonne Règlement = le mode choisi, Espèces = Oui / Non ; le manque
  « sans mode de paiement » n'est plus compté quand il est rempli (geste : Ouvrir Achats). Le
  livre de police en profite (même ligne).
- Preuves : `audit-livre-registre` 42 verts, `--prouve` 17/17 (+ mode deviné, mode ignoré hors
  plateforme, mode ignoré en gros, espèces mal dites) ; audits qui copient `registres.js` /
  `fournisseurs.js` mis à jour (registres 64, livre-police 34, achats-export 58,
  achats-sourcing 32, fournisseurs 52, export-zip 31, mois-boucle 53) ; banc `livre-registre`
  étendu (fiche de l'achat : mode relu, changé, rangé ; capture `paye-en-*`).
- Le choix « Ouvrir le mode de paiement manquant » d'un achat Vinted ne se pose pas : le
  paiement passe par Vinted (« Paiement via Vinted »).

## Geste de Julien
Relire les sources (F36018, D. 123-205-1, art. 50-0 du CGI) .
