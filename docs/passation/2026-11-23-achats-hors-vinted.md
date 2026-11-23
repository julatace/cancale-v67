# 23 nov. · Lot C — Achats hors Vinted : un ticket à plusieurs articles ⇒ un lot proposé (`claude/achats-hors-vinted`)

Julien (validé le 23 nov.) : « ajouter des achats faits hors Vinted (magasin, Leboncoin, vide-grenier) : photo du ticket
(lecture locale dans le navigateur si possible, sans IA payante — §2.9 —, sinon saisie assistée), ou import CSV/tableur ;
chaque ligne devient un achat avec coût, date, lieu ; relier aux paires reste SON toucher (identité §5) ».

## Ce qui existait (mesuré dans le code)
- Achats → « + » « Nouvel achat » (achats hors Vinted, `achat_hors_*`) : la photo du TICKET lue dans la page
  (`TextDetector`, sinon Tesseract WASM, jamais un service distant — `src/depensesTicket.js`, 3 et 11 nov.) propose
  montant TOTAL, date, lieu (`src/achatTicket.js`) ; « Un lot de N articles » (11 nov., `src/GrosLot.jsx`) ; l'import
  d'un tableur CSV / .xlsx (10 nov., `src/importAchats.js`, colonnes date · description · prix · où · référence · N°).
- Il manquait : un ticket de trois paires (vide-grenier, magasin) n'était lu qu'en UN achat au total — il fallait
  retaper chaque ligne dans le lot.

## Ce qui est fait
1. `lignesDuTicket(texte)` : une ligne d'article = un libellé (≥ 3 lettres) suivi d'UN montant en fin de ligne ; total,
   sous-total, TVA, HT/TTC, CB, espèces, rendu, remise, paiement, port… ne sont jamais des articles (bornes de mots :
   « Night » reste un article) ; une ligne de QUANTITÉ (« 2 x … ») rend le ticket ambigu.
2. `lotDuTicket(lu, lignes)` : proposé SEULEMENT si la somme des lignes est EXACTEMENT le total lu (au centime), que le
   nombre d'articles écrit sur le ticket (s'il y est) est le même, 2 à 60 lignes, aucune quantité. Sinon rien.
3. Nouvel achat : sous le résumé du ticket, « Diviser en 3 articles lus sur le ticket » remplit le lot (mode « à la
   main », un montant et un titre par article, ce qu'il avait tapé GARDÉ) et dit « Les montants … ont été lus sur le
   ticket : vérifie avant d'ajouter ». Rien n'est écrit : c'est SON « Ajouter le lot ». Aucun N° posé, aucune paire
   reliée (son toucher, §5). Textes `ahv.*` en 5 langues ; Quoi de neuf `ticket-plusieurs-articles`.

## Preuves
`node scripts/audit-achats-hors-vinted.cjs` vert (19 contrôles), `--prouve` 7/7 (somme non vérifiée, nombre écrit
ignoré, quantité ignorée, total lu comme article, « ht » sans bornes, saisie écrasée, lecture ratée proposée).
`audit-achat-ticket` (41), `audit-depense-ticket`, `audit-import-autre-outil`, `audit-traduction` : verts.

## ÉTAT À LA REPRISE
- Poussé sur `claude/achats-hors-vinted`. Après 15:30 UTC : build ; banc du formulaire (un ticket inventé servi au
  lecteur, « Diviser en 3 » puis le lot rempli) ; captures 390/1512 ; PR ; fusion demain après 07:00 UTC.
- Limite dite : la qualité de la lecture d'un ticket froissé dépend de Tesseract ; sans lecture sûre, rien n'est
  proposé (la saisie du lot reste). Geste de Julien : aucun.
