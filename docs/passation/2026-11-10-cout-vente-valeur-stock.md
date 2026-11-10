# 10 novembre — Lots BA et BF : le coût réel d'une vente, la valeur du stock

Branche `claude/cout-vente` (depuis `origin/main`). Validés par Julien (peu de texte, du
visuel). Les deux lots partagent la même règle — le prix d'achat SAISI, lu par
`beneficePaire` — et sont faits ensemble. L'extension n'est pas touchée.

## La règle (une seule) — `src/coutVente.js` (pur)

- **BA · `cascadeVente(prix, fiche)`** : DÉCOMPOSE la règle du bénéfice, ne la refait pas.
  vente − achat − frais − emballage = bénéfice, au centime (l'audit le vérifie sur 3 000
  tirages contre `beneficePaire`, et l'état contre `beneficeLigneVente`).
  - « frais » = tout ce que `coutsVente` déduit sauf l'emballage (boost, commission, port
    payé par lui, remboursement, autres) ;
  - **emballage** : un nouveau champ de frais `emballage` dans `champsCharges`
    (`src/beneficePaire.js`). Il entre donc dans `coutsVente`, et de là dans TOUS les
    totaux qui existent déjà (`vrm_benefice_jours` via `chargesVente`, le relevé
    `vrm_stats_ventes`, le plancher des offres, le formulaire « N° et frais », l'export CSV
    — colonne « Emballage » ajoutée avant « Frais confirmés »). Vide ⇒ `null`, « non
    saisi », jamais 0 ni deviné ; illisible ⇒ « — » (règle des frais illisibles).
  - ⚠️ Une coche « Tous les frais sont renseignés » posée AVANT ce champ ne couvre pas
    l'emballage : le bénéfice reste celui de la règle (rien ne change pour les anciens
    chiffres), mais la ligne « Emballage · non saisi » le NOMME à côté. Saisir l'emballage
    depuis la cascade ne décoche rien (un coût en plus ne rend pas le reste moins sûr).
- **BF · `valeurStock(paires, ficheDe)`** : Σ des prix d'achat SAISIS des paires PRÉSENTES —
  la liste `annoncesPresentes` (en ligne + à confirmer + masquées encore sur l'étagère),
  jamais une autre définition. Le prix se lit comme pour une vente
  (`fusionEntreeVente(fiche, null, buyByNum)` → `beneficePaire(...).achat`). Absent ou
  illisible ⇒ « sans prix », jamais sommé ; aucun prix ⇒ « — » ; « au moins » dès qu'il en
  manque un ou qu'une lecture d'annonces manque (`listings.incomplet`).
  `texteValeurStock` : « au moins 2 340 € · sur 48 paires · 6 sans prix ».

## Un propriétaire, des lecteurs

- **Calcul** : UNE fois, dans le composant qui tient `annoncesPresentes` (App.jsx, à côté
  de `presentesAnnonceIds`), seulement si les annonces sont lues sans erreur.
- **Publication** : `vrm_valeur_stock` (`publierValeurStock`, localStorage de l'appareil,
  estampillé du compte VRM ; dérivé, pas synchronisé) + événement `vrm:valeur-stock`.
- **Lecteurs** (`useValeurStock`, `src/CascadeVente.jsx`) : le Stock (widget sous le
  résumé) et Statistiques (carte « Valeur du stock », volet « L'argent depuis le début »).
  Jamais publiée pour ce compte ⇒ « — · annonces pas encore lues ».
- L'ancien `liveStats.stockValue` (somme des prix des annonces en ligne, SANS couverture,
  `Number(bp)||0` — un total partiel présenté comme complet) est **retiré** ; la carte de
  Statistiques et la ligne « La valeur du stock attend un prix d'achat » lisent la valeur
  publiée.
- Non touché (dit) : le widget « Stock actuel » de Ma journée garde son « Coût d'achat
  renseigné » des annonces EN LIGNE (`resumerStockJournee`) — une autre population ; à
  fondre dans `vrm_valeur_stock` si Julien le veut.

## L'écran

- **Ventes → récapitulatif d'une vente → « L'argent »** : une barre empilée (achat ·
  frais · emballage · bénéfice, à la largeur du prix ; une perte : la barre mesure les
  coûts, un trait ambre marque le prix), puis les lignes alignées dans l'ordre de la
  cascade, chacune avec le point de couleur de son segment. Neutre partout, l'accent sur le
  bénéfice seul, ambre pour la porte et la perte, jamais rouge. « Emballage · non saisi »
  est la porte : un champ, OK ⇒ `saleOv[tx].emballage` (la même écriture que « N° et
  frais »). « Prix d'achat » manquant garde sa porte ambre existante (`CoutAchatVente`).
- **Stock** : widget DA6 (blanc, rayon 24) « Valeur du stock », montant 34/800, jauge des
  paires au prix connu, « sur N paires » et « N sans prix › » en ambre qui OUVRE la saisie
  en série (`DEMANDE_SAISIE_PRIX` → Annonces).
- **Statistiques** : la carte « Valeur du stock » dit la même chose ; touchée avec des
  paires sans prix ⇒ la saisie en série.

Fichiers : `src/coutVente.js`, `src/CascadeVente.jsx`, `src/styles-cout-vente.css`,
`src/beneficePaire.js` (champ), `src/App.jsx` (récap, calcul + publication, CSV, retrait
de `stockValue`), `src/ecrans/Stock.jsx`, `src/ecrans/Stats.jsx`.

## Preuves

- `node scripts/audit-cout-vente.cjs` : **28 verts** ; `--prouve` **11/11 mutations**
  rouges (emballage hors de la règle, emballage vide pris pour 0, frais comptant
  l'emballage deux fois, achat absent pris pour 0, partiel dit exact, « sans prix » sommé à
  0, « au moins » tu, aucune paire ni prix dit 0, porte rouge, porte retirée, second calcul
  dans Statistiques). Sur l'arbre d'`origin/main` (git archive) : rouge (module absent).
- Banc `scripts/bancs/cout-vente.cjs` (données inventées ; 390 px tactile et 1512 px, clair
  et sombre) : voir le résultat ci-dessous ; captures regardées
  `<tmp>/cout-vente-{390,1512}-{clair,sombre}-{vente,emballage,stock,stats}.png`.
- `npm run build` ; audits `variables`, `tdz`, `coherence`, `identite`, `icones`, `urssaf`,
  `benefice`, `benefice-unique`, `plancher-stock`, `frais-plateformes`, `chiffres` : verts.

## Geste de Julien
Aucun. Pour voir la cascade complète : saisir un coût d'emballage sur une vente
(« Emballage · non saisi »).
