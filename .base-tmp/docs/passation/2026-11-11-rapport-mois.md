# 11 novembre 2026 — « Rapport du mois » en PDF, en un clic (lot rapport-mois)

Branche `claude/rapport-mois`. Aucune écriture en base, aucune PR ni merge dans `main`.

## Ce que voit le vendeur

Argent → Le détail → **« Rapport du mois »** (sous « Bilan du mois ») : un menu de
13 mois — par défaut **le dernier mois bouclé** (`periodeBouclee('mois')`, la règle de
« Pour mon comptable ») — et un bouton **« Partager le rapport (PDF) »** (feuille native
du téléphone, `navigator.share`) ou **« Télécharger le rapport (PDF) »** quand le
navigateur ne sait pas partager un fichier. Rien n'est lu avant son clic. Le retour dit
« Rapport partagé / téléchargé · N points à compléter, listés à la fin ».

Le PDF (A4, 3 pages en pratique, 4 si « Ce qui manque » déborde), Helvetica, encre et
gris, une seule couleur d'accent (le bleu de l'app) pour les barres du vendu :

1. **En-tête** : SA fiche de facturation (`vrm_pro_facture` : nom, SIRET) ; sinon ses
   comptes vendeurs (jamais un compte écarté) ; « Établi le … » ; le mois.
   **Chiffres clés** (6 cases) : Vendu · Reçu au versement · Ventes · Panier moyen ·
   Bénéfice · Marge, chacun avec sa note de couverture ; « Dépensé ce mois » et le
   meilleur compte (seulement si le vendu est complet — règle du bilan).
   **Graphique** : vendu par jour (barres bleues) et reçu par jour (barres pâles).
2. **Par plateforme** (ventes, vendu, bénéfice des finalisées au prix connu « sur N/M »),
   **par compte** (part du vendu), **par catégorie** (seulement si deux familles sont
   connues, comme Statistiques), **les 10 meilleures ventes** (date, N°, titre,
   plateforme · compte, montant).
3. **Stock** (articles, valeur d'achat « au moins … · sur N · k sans prix », date du
   comptage), **Achats du mois**, **URSSAF** (régime CHOISI seulement), **Ce qui manque**
   (chaque manque NOMMÉ), et la légende (vendu ≠ reçu, « — » = pas su, « au moins »).

## Aucune règle neuve (§5, §11)

`src/rapportMois.js` RANGE et MET EN PAGE ; chaque chiffre vient de son propriétaire :

| bloc | règle |
|---|---|
| vendu, reçu, ventes, dépensé, bénéfice | `bilanDuMois` — l'assemblage de la carte « Bilan du mois », sorti tel quel en `assembleBilanMois` (Compta.jsx) et partagé par les deux cartes |
| panier moyen | ce vendu ÷ ces ventes (mêmes lignes) ; aucune vente ⇒ « — » |
| marge | bénéfice ÷ ventes qu'il compte (`B.ca`) — la règle de Statistiques |
| bénéfice incomplet | « — » et, à côté, `chiffreBrut` : « brut au prix connu X € · N sur M ». **Jamais « au moins » devant un bénéfice** (src/beneficeNoms.js : une paire au prix inconnu peut être à perte) — la mission disait « au moins … sur N » : la règle du dépôt l'emporte, la couverture « N sur M » est dite |
| vendu par jour | les lignes de `ventesFaites` du mois, par jour LOCAL ; Σ jours = vendu (audit) |
| reçu par jour | `vinted_urssaf_mois.recuJours`, dessiné SEULEMENT si sa somme = le reçu du mois au centime ; sinon pas dessiné, et dit |
| plateformes | `margeParPlateforme` |
| comptes | les lignes groupées par le compte qu'elles portent (`nomGroupeVente`, le nom du bilan) |
| catégories | `statsParCategorie` + `afficherCategories` ; lectures `lireTableFamilles` / `lireCategoriesFiches` / `fabriqueFamDe` **sorties de Stats.jsx telles quelles** dans `src/categoriesLecture.js` (Stats les importe ; un cache) |
| top 10 | les lignes du vendu triées par montant ; titre et N° du relevé de Ventes PAR IDENTITÉ (`cleVente`), sinon de SON annonce Vinted par SA transaction ; sinon « — » (jamais le titre d'une autre vente au même montant) |
| stock | `lireValeurStock` (publiée par Annonces) ; jamais publiée ⇒ « ouvre Annonces une fois » |
| achats | `registreAchatsDe` (la même lecture que « Registres » et l'export comptable) |
| URSSAF | `montantPeriodeUrssaf` + `aPayerUrssaf` (micro) ; autre statut ⇒ `raisonUrssaf` ; **pas choisi ⇒ section absente** |

`partagerOuTelecharger` (src/exportComptableZip.js) prend désormais un `type` (défaut
zip, inchangé pour le zip).

## Preuves

- `npm run build` vert ; audits `variables, tdz, coherence, identite, icones,
  textes-courts, fonctions-api, secrets` verts (+ `export-zip`, `chantier-f`,
  `marge-plateforme`, `benefice`, `urssaf`, `stats-categories`).
- **`scripts/audit-rapport-mois.cjs`** (47 contrôles) : GÉNÈRE le PDF sur des ventes
  inventées (14 ventes, 4 plateformes, un compte pas lu, une vente au montant pas lu,
  stock 6 dont 2 sans prix, 3 achats dont 1 au montant pas lu) et le RELIT avec pdfjs :
  pages (2–4, A4, numérotées), chiffres = ceux des règles (bilan, recuPublieEntre,
  chiffreBenefice, margeParPlateforme, statsParCategorie, valeurStock), couverture dite,
  top 10 par identité (leurre au même montant jamais pris), URSSAF absente / raison /
  montant selon le régime, manques nommés, jamais « encaissé », aucun pseudo d'acheteur,
  mois par défaut. `--png=dossier` rend les pages (pdftoppm) : **regardées**.
  - Rouge sur `origin/main` (module absent) ; **7 mutations, toutes rouges**
    (`--prouve`) : reçu par jour sans garde, URSSAF devinée, titre par ressemblance,
    manque tu, « au moins » perdu, stock sans couverture, « pas su » écrit 0.
- **`scripts/bancs/rapport-mois.cjs`** (56 verts, base inventée, 1512 sombre et 390
  tactile, micro et statut pas choisi) : la carte, le mois proposé, un vrai
  téléchargement relu (vendu = Σ ventes inventées hors compte exclu, chaque vente au
  top, URSSAF présente/absente), cibles 44 px, aucun débordement, aucune erreur.
  Il a trouvé un vrai défaut, corrigé : l'en-tête nommait un **compte écarté**.
- `scripts/bancs/stats-categories.cjs` reste vert (40) après le déplacement des lectures.

## Limites dites

- Le reçu par jour n'existe que si l'écran Ventes a publié `recuJours` (app récente) et
  qu'il tombe juste au centime ; sinon seul le total est dit.
- Le stock est une photo (date du dernier comptage d'Annonces), pas l'état à la fin du mois.
- Le partage natif n'a pas été essayé sur un vrai téléphone (le banc n'a pas
  `navigator.share` : voie « téléchargement »). La même fonction sert déjà le zip.

## Geste de Julien

Aucun.
