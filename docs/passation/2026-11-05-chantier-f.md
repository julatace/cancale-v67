# 5 nov. — Chantier F : Compta et Statistiques

Feuille de route : `docs/passation/2026-11-05-revue-coherence.md` (points 2.25, 2.26,
2.27, 1.7 et les mots « Compta », « Bénéfice », « Vendu »), plus trois améliorations
demandées et la passe « des dizaines de petites améliorations » de Julien. Branche
locale `v35-chantier-f`, partie de `claude/project-review-nsk5su`. Rien dans
`vinted-sync-extension/`, rien dans `src/registres.js`, aucun composant partagé modifié.

## 1. Les points de la revue

| point | avant | après |
|---|---|---|
| 2.25 segment | « Vue d'ensemble · Prix qui marche » posé AU-DESSUS du titre « Statistiques » (dans la coque) | sous le titre (`ScreenHead sous=`), dans Statistiques et dans Prix qui marche |
| 2.25 cartes vides | 7 cartes sur 12 dépliées, grand titre et grand blanc, pour dire « — » | repliées en UNE ligne : le titre et la raison (`CarteStatsVitrine`, `data-sv-repliee`) — modèles rapides, Ce qui rapporte, Les offres, tailles, Boost, Notes, annulations sans vente |
| 2.25 Annulations | « 0 sur 2 · 0 % » en tête ET « 0/2 · 0 % » sur la ligne | le total d'en-tête seulement s'il additionne plusieurs comptes (même règle pour la moyenne des notes) |
| 2.26 anneau | une carte blanche vide (anneau sans données) à côté de « 6 derniers mois » | `RepartitionAnneau` ne rend rien sans part ; Compta ne pose pas le panneau, « 6 derniers mois » prend la largeur |
| 2.27 statut | choisi à 4 endroits : la question, « — URSSAF · Choisir mon statut », le segmenté « Régime fiscal » de « Ton entreprise », « Changer » | UN endroit : la question tant qu'il n'est pas choisi, puis Documents et réglages → **Statut** · Changer |
| 2.27 survol | `.vrm-statut-option:hover` collé au toucher (une carte non choisie restait cerclée de bleu) | seulement sous `@media (hover: hover) and (pointer: fine)`, en encre |
| 2.27 surtitre | « Novembre 2026 » au-dessus de « Compta » et « NOVEMBRE » dans la carte | la carte seule dit sa période |
| 1.7 Comparer | « Reçu 0,00 € » quand des ventes finalisées n'ont pas de date de versement | « — » (ou « au moins N € »), et la raison écrite sous le tableau (`recuAvecADater`) |
| 1.7 À déclarer | « 0,00 € À déclarer » sans statut | « — » et « à déclarer : choisis ton statut, plus bas » sous la carte ; particulier : « — » (rien à l'URSSAF) — par `locaux` de la carte, `carteChiffres.js` non touché |
| mots | « CA vendu », « Ton statut », « Régime fiscal », titre écrit à la main | `L.vendu`, `L.statut`, `L.compta`, `L.benefice`, `L.recu` |

## 2. Les trois améliorations

1. **« À recopier sur l'URSSAF »** (`PrevisionUrssafCarte`, question 2). La période finie,
   la carte devient la feuille de la déclaration : le chiffre d'affaires EXACT de la
   période (`previsionUrssaf` → la ligne publiée datée au versement, rien de recalculé)
   avec « Copier » (chiffres et virgule, sans espace ni « € » : `montantARecopier`), les
   cotisations estimées « à comparer avec le site », ce qui manque (« 1 vente sans date
   de versement : pas dans ce montant » + « La dater » qui ouvre « Vendu et reçu »),
   « Ouvrir l'URSSAF ↗ » et « J'ai déclaré » (le formulaire de toujours,
   `demanderDeclaration` → `vrm_urssaf_declare`, sur SON clic). Le dernier jour, la date
   passe en ambre. Période en cours : la prévision, sans « Copier ». L'encart
   « Déclaration URSSAF · J'ai déclaré » de la grille Fusion est retiré (un seul endroit).
   Jamais « encaissé ».
2. **« Bilan du mois »** (Compta → Le détail, `BilanMoisCarte`, `src/bilanMois.js`) : ce
   mois-ci ou le mois dernier — Vendu (`bilanLignes` sur `ventesFaites`), Reçu
   (`recuPublieEntre` + à dater), Dépensé (`comptaChargesMois`), Bénéfice
   (`chiffreBenefice(beneficeDuMoisPub)`, « prix d'achat connus N/M »), Paires vendues,
   Meilleur compte (aucun sur une lecture partielle ni une égalité). « Télécharger en
   PDF » par pdf-lib (le générateur des registres), une page A4.
3. **« Délai de paiement »** (Compta → Le détail, `DelaiPaiementCarte`,
   `src/delaiPaiement.js`) : la médiane vente → versement par site, SEULEMENT sur les
   versements lus (Vinted : transaction finalisée ; Vestiaire : date de versement), avec
   le nombre de ventes mesurées, l'écart min–max, les ventes sans date comptées à part ;
   Leboncoin et eBay : « — · date de versement pas lue sur ce site », jamais 0 j.

## 3. Les petites améliorations (avant → après)

Statistiques
1. Sous-onglets au-dessus du titre → sous le titre.
2. Carte vide dépliée (titre 20 px, grand blanc) → une ligne titre · raison, ≤ 100 px.
3. « Ce qui rapporte le plus » vide : le choix Modèle/Marque/… affiché pour rien → masqué.
4. « Les offres » vide : trois tuiles « — » et un tableau de « — » → « Conversations pas encore lues : elles arrivent à ta prochaine visite sur Vinted. »
5. « Notes reçues » : une ligne « pas lu — » par compte → une ligne « Pas encore lues… ».
6. Moyenne des notes redite en tête avec un seul compte → en tête seulement à plusieurs comptes.
7. « Annulations » dit deux fois → une fois.
8. Annulations, Notes, Boost en panne : « — » sans raison → la raison en mots.
9. « … » d'une carte en lecture → « Lecture en cours… ».
10. Tuile « En ligne » : « en ligne » redit dessous → « aujourd'hui ».
11. « dont 4 en ligne depuis 30 jours ou plus » → « dont 4 depuis 30 jours ou plus » ; 0 → « aucune depuis 30 jours ou plus ».
12. « Les modèles qui partent vite » vide : phrase à parenthèse → « Aucune vente Vinted à la date de mise en ligne connue sur la période. »
13. Note d'en-tête de carte qui coupait le titre en deux lignes au téléphone → passe sous le titre.
14. Carte repliée étirée à la hauteur de sa voisine de rangée → garde sa ligne.
15. « Comparer » : titre 15 px parmi des titres 20 px → 20/700, en `h2`.
16. « Comparer » : « CA vendu » → « Vendu ».
17. « Comparer » : « — » expliqué par une infobulle seule → une ligne de raison par chiffre sous le tableau.
18. « Comparer » : chiffres tabulaires posés sur les libellés → seulement sur les nombres.
19. « Comparer » : rayon 20 + ombre → rayon 14, sans ombre (la forme des autres cartes).
20. « Comparer » : « — » d'un chiffre ou d'un écart en encre → en gris.
21. « Frais par site » : rayon 20 + ombre, titre 15 px → la forme et le titre des autres cartes.
22. « Frais par site » : tabulaires sur toute la rangée → sur les nombres ; « — » en gris.
23. Anneau de répartition sans part (cercle gris « 0 ventes ») → rien.
Compta
24. Surtitre « Novembre 2026 » redit → retiré.
25. Panneau blanc vide (anneau) → retiré ; « 6 derniers mois » pleine largeur.
26. « 6 derniers mois » : six barres plates et un pointillé → une ligne « Pas encore de prix d'achat sur tes ventes de ces six mois. · Les saisir ».
27. Phrase sous la carte sombre : paragraphe vide rendu → rien quand rien à dire ; morceaux joints par « · » sans jamais commencer par lui.
28. Statut à 4 endroits → 1.
29. « Régime fiscal » (3 renvois) → « Statut » / « Ton entreprise ».
30. « Ton statut » (titre) → « Statut ».
31. Survol collé au toucher → souris seulement, en encre (l'accent reste au choix fait).
32. Carte « Quel est ton statut ? » à ~3 px de retrait → 18 px (16 au téléphone).
33. « À déclarer » chiffré sans statut → « — » et la raison visible.
34. Deux encarts URSSAF (« Déclaration URSSAF » + prévision) → un seul.
35. Prévision → feuille « À recopier » avec « Copier » (44 px, « Copié » 1,8 s, repli `execCommand`).
36. « Les dater » : lien collé dans la phrase, sans cible → « La dater / Les dater » (bouton discret, 44 px).
37. Dernier jour de déclaration : rien ne le distingue → date en ambre.
38. Résumé de « Documents et réglages » en phrase longue → « Statut, entreprise, factures, … ».
39. Suppression d'une ligne : « × » de texte → icône `close`.
40. « Arrêter » un abonnement : 26 px → `Bouton` secondaire petit (44 px au doigt).
41. Champs de saisie 40 px → 44 px.
42. Pastilles de catégorie 36 px → 44 px.
43. « Ajouter » : `#fff` écrit en dur → `onAccent`.
44. Icône « Ton entreprise » sur fond d'accent → neutre (l'accent reste rare).
45. Taux de cotisations : champ sans nom accessible → `aria-label`, 44 px.
46. « Ton entreprise » : « ton régime sert à calculer tes cotisations » (il n'y est plus) → retiré.
47. Bilan : « au moins » dit deux fois sur le reçu → « 1 vente sans date de versement : pas dedans ».
48. Délai : « de 2 jours à 3 jours » → « entre 2 et 3 jours ».
49. Prévision « Choisir mon statut » qui défilait vers la question juste dessous → retirée.
50. « Comparer » à 390 : colonnes 80 px → 84 px (« 1–5 nov. » ne touche plus).

## 4. Preuves

- `npm run build` vert.
- **Banc `scripts/bancs/compta-stats-coherence.cjs`** (données INVENTÉES : le jeu de
  `nouveau-vendeur` + deux versements lus et une vente finalisée à dater ; 390 tactile et
  1512, clair et sombre ; scénarios A statut jamais choisi, B micro mensuel ; l'écran
  Ventes ouvert d'abord, comme dans la vraie vie). `BANC_PORT=9211`.
  **Base `claude/project-review-nsk5su` (banc copié dans l'arbre `git archive`) : 134
  rouges, 22 verts. Après : 186 verts, 0 rouge.** Il mesure S1–S4, C1–C6, U1 (le montant
  copié = le CA de la prévision, presse-papier, « Copié », 44 px), B1 (vendu, paires et
  reçu du bilan = ceux de « Comparer » ; le PDF commence par `%PDF-`), D1 (2 et 3 jours ⇒
  2,5 j sur 2). Aucun libellé ne sert à juger une valeur.
- **Audit `scripts/audit-chantier-f.cjs`** : 24 contrôles (délai, bilan, anneau, reçu
  « à dater », montant à recopier, statut à un endroit, surtitre, survol) ;
  `--mutation` : **12/12 mutations rouges** ; sur la base : rouge (modules absents).
- Audits demandés verts : `audit-rouge-doublon`, `audit-composants`, `audit-coherence`,
  `audit-identite`, `audit-icones`, `audit-fonctions-api` ; et ceux de la zone :
  annulations-compte, argent-offres-masquees, benefice, benefice-unique, boost-rentable,
  carte-chiffres, ce-qui-rapporte, comparer-mois, dac7-comptes, finir-compta,
  frais-plateformes, objectif-mois, prevision-urssaf, rappel-urssaf, registres,
  seuils-annee, seuils-vinted, stats-offres, stats-ventes, tdz, urssaf, variables.
- **Audit adapté** : `audit-comparer-mois` exigeait le texte exact
  `recuDe: (b) => recuPublieEntre(...)` ; il accepte maintenant l'enveloppe
  `recuAvecADater(...)` — il jugeait l'orthographe, la règle (la SOURCE est
  `recuPublieEntre`) reste exigée.
- Bancs de la zone, base → après : voir `## 6`.
- Captures (hors dépôt, regardées) : avant
  `scratchpad/f35/shots-avant/`, après `scratchpad/f35/shots-apres/` (`stats-*`,
  `compta-A-*`, `compta-B-*`, `bilan-*`, `delai-*`, 390/1512, clair/sombre).

## 5. Ce qui reste
- La visionneuse du ticket de dépense reste une visionneuse photo (`vrm-photo-viewer`),
  pas une `SheetShell` : c'est une image plein écran, pas une feuille.
- « Acceptées par le moteur : — » reste toujours « — » (aucun journal en base) : banc et
  audit `stats-offres` l'exigent ; à retirer le jour où le moteur écrit son journal.
- Paramètres → « Régime fiscal » (zone H) : à renommer « Statut » ; Compta n'y renvoie plus.
- `src/styles-statut.css` (la seule feuille de la question du statut) a été touchée pour
  le survol : elle ne sert qu'à Compta.
