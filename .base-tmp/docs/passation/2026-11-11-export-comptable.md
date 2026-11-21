# 11 nov. 2026 — « Pour mon comptable » : un zip, en un clic (lot `export-comptable`)

## Ce qui existait
Argent → « Pour ton comptable » → carte « Exporter pour mon comptable » (9 nov.) :
un CSV et un PDF d'une page, téléchargés à part. Les factures Pro avaient leur zip
ailleurs (écran Factures). Les factures d'achat jointes s'ouvraient une par une.

## Ce qui change
- Carte renommée **« Pour mon comptable »**. Défaut : le **dernier mois bouclé**.
  Changer Mois / Trimestre / Année choisit la dernière période bouclée.
- Bouton principal **« Télécharger le zip »** (ou **« Partager le zip »** quand le
  navigateur sait partager un fichier : iPhone, Mac). Partage natif
  (`navigator.share` de fichiers), sinon téléchargement ; feuille fermée ⇒ rien.
- Le zip se dézippe en UN dossier `VRM-comptable-AAAA-MM/` :
  - `1-Recapitulatif-<période>.pdf` : totaux, couverture (« au moins 32,00 € · 1 sur 2 »),
    « Ce qui manque », pièces du zip comptées, pièces absentes NOMMÉES ; puis une page
    par manque nommé ligne par ligne (ventes à dater, achats sans coût saisi).
  - `2-Tableur-<période>.xlsx` : Résumé, Recettes (1re colonne = date de VERSEMENT),
    À dater, Achats (colonne Justificatif), CA par mois. Nombres en vrais nombres.
  - `2-Tableur-<période>.csv` : le CSV d'avant (BOM, « ; »), + colonne « Frais lus ».
  - `Factures-de-vente/` : factures et avoirs Pro émis sur la période (même PDF que
    l'envoi) + `Registre-des-factures-<période>.csv`.
  - `Factures-d-achat/` : les factures d'achat jointes aux achats de la période.
- CSV et PDF seuls restent sous « Un fichier seul ».
- ⌘K « Exporter pour mon comptable » : sous-titre et mots (« zip », « xlsx »).

## Gestes (dernier mois, tout compris)
Avant : Préparer · Mois · choisir le mois · Tableur · PDF · aller aux Factures ·
choisir la période · Exporter (zip) · puis 2 gestes par facture d'achat ⇒ 9 + 2n.
Après : **Préparer · Télécharger le zip ⇒ 2**.

## Décisions tranchées
- **Frais** : seuls les frais eBay sont LUS (`totalMarketplaceFee`, en euros, déjà
  vérifié par `montantRecuEbay`). La ligne eBay de `ventesDeclarables` porte `frais`
  (miroir serveur refabriqué : `audit-bilan-semaine --recopie`). Vinted, Leboncoin,
  Vestiaire : case VIDE (pas su), jamais 0.
- **Une pièce pas lue n'arrête pas le zip** : elle est nommée dans le récap
  (« pas dans le zip : la facture F2026-0007 ») et à l'écran (ambre). Le zip n'est
  jamais présenté complet. (Le zip de l'écran Factures, lui, refuse tout : inchangé.)
- **Reçus d'achat Vinted (e-mails)** : pas joints (ce sont des e-mails, pas des pièces) ;
  leur montant est dans le tableur (« Montant lu sur : reçu Vinted »).
- **.xlsx sans bibliothèque** : `src/xlsxSimple.js` (OOXML minimal, zip « stored » de
  `exportDonnees.js`). Dates en texte JJ/MM/AAAA (comme le CSV).
- La lecture des factures Pro est UNE constante (`SELECT_FACTURES_PRO`,
  `src/facturePro/registre.js`), lue par l'écran Factures et par l'export.

## Fichiers
`src/exportComptableZip.js` (neuf) · `src/xlsxSimple.js` (neuf) · `src/exportComptable.js`
(frais, couverture « sur N », pages des manques, justificatifs) · `src/registres.js`
(`frais`) · `src/factureAchat.js` (`cleFactureLigne`) · `src/facturePro/registre.js`
· `src/FacturePro.jsx` · `src/ecrans/Compta.jsx` · `src/App.jsx` (frais eBay) ·
`api/_lib/ventes-regle.js` (recopie) · `src/annulerCommandes.js`.

## Preuves
- `scripts/audit-export-zip.cjs` (neuf, 31 verts) : EXÉCUTE le vrai code, ouvre le zip,
  relit le .xlsx avec **openpyxl**, le récap avec **pdf.js** ; `--prouve` : 7 mutations
  toutes rouges (à dater dans un mois, frais 0, manque tu, période ignorée, nombres en
  texte, défaut = mois en cours, annulation qui télécharge). Rouge sur `origin/main`.
- Le zip ouvert aussi par `unzip` et LibreOffice (xlsx → PDF) : regardé.
- `audit-achats-export` : 58 verts (copie de `factureAchat.js` ajoutée, comme sur
  `claude/rouges-integration` ; « une page » devient « la 1re page = récap » + manques nommés).
- Banc `scripts/bancs/achats-export.cjs` à 390 et 1512 : 128 verts (défaut mois bouclé,
  libellé honnête du bouton, zip téléchargé et relu, xlsx sans le compte exclu).
- Audits communs verts. Rouges DÉJÀ sur `main` (pas de ce lot) : `audit-donnees-ecrans`
  (`_fmtJourSemaine`), `audit-plans-solo-pro` (phrase Solo).

## Geste de Julien
Aucun.
