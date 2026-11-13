# Familles de défauts de l'app — moyens et bas réglés par famille (11 nov. 2026, second agent)

Branche `claude/agent2-familles-app` (partie de `origin/main` f04d4a580), **pas de PR, pas de
fusion** : l'agent principal intègre. Listes d'origine (lecture seule) :
`git show origin/claude/agent2-robustesse:docs/passation/robustesse/metier.md` et `.../donnees.md`.

⚠️ **Cette branche CONTIENT `claude/agent2-robustesse-metier`** (fusionnée au début, conflit
`src/ecrans/Stock.jsx` réglé en gardant les deux imports) pour ne pas refaire ses corrections ni
entrer en conflit : n'intégrer que celle-ci.

Chaque famille = **une règle commune** + **un audit gardien** qui échoue sur `origin/main`
(`git archive`) ET à la mutation (`--prouve`, helper commun `scripts/_mutations-gardien.cjs`).
Les motifs qu'on ne pouvait pas tous corriger aujourd'hui sont tenus par un **cliquet** (plafond
par fichier : « pas un de plus », le plafond baisse quand on corrige).

| famille | règle commune | endroits corrigés | gardien (verts · rouges sur main · mutations) |
|---|---|---|---|
| 1. Dates à l'heure de Paris | `src/dateParis.js` (`jourParis`, `moisParis`, `anneeParis`, `moisRecents`, `moisDecale`, `cleCalendrier`) — Intl Europe/Paris, secours sans Intl (règle européenne) | **31** : chaîne de déclaration (`ymDeTs`, `moisDeVente`, `dateLocaleISO` — copies autonomes car des audits les exécutent seules ; registres, récap, export comptable, « Boucler le mois », factures électroniques, DAC7, clôture, inventaire, rapport du mois, objectif, comparer, stats-plus), 9 noms d'exports datés, historique des prix, suggestions d'achat, avis, satisfaction, widget `onlineAt`, rappel d'essai (une clé par seuil, plus une par jour UTC jamais nettoyée), 7 secours UTC ; copie serveur `api/_lib/ventes-regle.js` refabriquée (`--recopie`) | `audit-dates-paris.cjs` : exécute sous New York, Tokyo, UTC et sans Intl ; interdit `toISOString().slice(0,10|7|4)` dans src/ (liste blanche nommée : 2 en zone Colis) et toute clé « AAAA-MM » à l'heure de l'appareil dans la chaîne de déclaration · **54 · 40 · 6/6** |
| 2. « Pas su » ≠ 0 | `src/sommeConnue.js` (`sommeConnue`, `texteSomme`, `texteCouverture`, `medianeSue`, `valeurSue`) | **14** : Leboncoin (CA finalisé, en attente, achats reçus/en route/annulés), Achats (Dépensé du mois + comptes pas relus, grille, vraie médiane), Ventes « CA finalisé » Vinted (prix pas lu, compte pas relu, « Vinted » nommé), mois déclaré à l'ancienne règle, export comptable (mois illisible ⇒ « — »), CA de l'année micro (mois illisible ⇒ « au moins »), courbe des mois et détail d'un mois (Stats), commande dans une autre devise écartée (`montantCommandeLu`, + miroir serveur), 2 « +x\|\|0 » | `audit-pas-su.cjs` : règle exécutée, lbcArgent/montantCommandeLu/export/micro exécutés, cliquet sur 5 motifs « inconnu ⇒ 0 » · **17 · 11 · 7/7** |
| 3. Deux N° par `cleNum` | `cleNum` (api/_lib/numerotation.js) ; copies locales vérifiées identiques | **27** : fiche d'une annonce liée, jumelles par photo (×2), porteurs du garage (carte rangée par cleNum LUE en texte brut : « 07 » jamais trouvé), reprise de N°, sélection d'achat, liaison eBay par SKU, garage (case, pièce, contrôle ×6, libérer, boîte), Stock 2D (×2), Stock 3D (×3), parcours, fil unique, vente annulée remise en ligne, actions d'annonces, audit « vendue » | `audit-numeros-clenum.cjs` : copies = référence sur 15 entrées, `garageCellOf` et `etatRemise` exécutés, interdit `String(…num…) === String(…num…)` / `a.num === b.num`, cliquet sur `.trim().toLowerCase()` d'un N° · **11 · 8 · 5/5** |
| 4. Une règle par notion | `argentAVenir` (4 nov.) · `beneficePaire` / `beneficeLigneVente` | **4** : Trésorerie « En attente » = l'argent à venir (plus la somme des statuts « en cours », 220 € de trop mesurés le 4 nov.) et « Reçu » sans 0 € muet ; bénéfice Leboncoin/Vestiaire avec les frais saisis sur la fiche (Vestiaire sans sa commission, déjà retirée) dans le total ; carte d'une vente Leboncoin = `beneficeLigneVente` ; fiche d'une paire vendue sur Leboncoin = `beneficePaire` | `audit-une-regle.cjs` · **9 · 7 · 4/4** |
| 5. Stockage protégé, écouteurs, clés | `src/stockageSur.js` (`lireLocal`, `ecrireLocal`, `retirerLocal`, `lireJSON`, `stockageDispo`) | **5** : « Fermer le bilan » semaine/mois (Safari privé : le bouton ne fermait plus), catalogue vu, compteurs de notifications (sans stockage : aucune notification inventée), conversations vues ; clé stable du détail d'un mois. La synchro (`lireLocalSync`, `poserFusionLocale`) lève EXPRÈS : un stockage illisible l'arrête (jamais une liste vide poussée) | `audit-stockage-sur.cjs` : exécuté contre un stockage qui lève ; cliquets stockage/`JSON.parse` nus et clés d'index (239) ; chaque effet retire ses écouteurs window/document et ses intervalles · **5 · 3 · 4/4** |
| 6. Moyens restants | — | **6** : séries de factures par préfixe + année (FA-2025-0040 ne masque plus les trous 2026) ; DAC7 par compte dans l'année du VERSEMENT ; rapports CSV « 12,50 » ; dépenses/packs/abonnements = `lireMontantSaisi` (« 1.234,56 » refusé) ; Vestiaire : `sellerPrice` n'est pas « versé », « Paiement reçu » n'est pas « livrée », « checkout » n'est pas un contrôle | audits existants (factures-pro-2, factures-autres, dac7-comptes, vestiaire-partout) verts |

## Preuves
- `npm run build` ; `audit-variables`, `audit-tdz`, `audit-identite`, `audit-urssaf`, `audit-coherence`,
  `audit-icones` verts (`audit-coherence` est rouge sur `origin/main`, vert ici).
- **Tous les audits** (495) lancés sur `origin/main` puis sur cette branche (arbres `git archive`) :
  aucun audit vert sur main ne rougit ici (7 qui rougissaient en route — modules copiés seuls dans
  /tmp sans leurs nouvelles dépendances, miroir serveur, phrase lue par `audit-identite` — remis à la
  même règle). Les rouges de main restent ceux de main (`audit-benefice` : MeilleuresSources, etc.).
- Banc neuf `scripts/bancs/familles-app.cjs` (Leboncoin, un prix inconnu ⇒ « au moins 30 € »,
  390/1512, clair/sombre) : vert ici, **rouge sur origin/main** (« 30 € » présenté complet) ; captures
  regardées. Bancs touchés relancés un à la fois : `argent-mois` 104/0, `robustesse-metier` vert,
  `carte-stats` 87/3 (les 3 mêmes rouges sur origin/main : « A. les autres pages »).

## Pas fait (noté pour la suite)
- Cliquets à faire baisser : 18 « prix Vinted absent ⇒ 0 » et 3 sommes de `montantCommande` dans
  App.jsx (Stats/Bilan, rapport, `vrm_achats_jours`) ; 239 clés d'index (listes statiques surtout) ;
  15 stockages nus dans App.jsx ; 2 `.trim().toLowerCase()` de N° (recherche de pièce, réservés du
  garage) + Stock 2D ; heures d'APPAREIL hors chaîne de déclaration (`vrm_benefice_jours`, bornes
  `dansPeriode` locales — cohérentes entre elles, à passer ensemble).
- « Vendu · mois » Leboncoin (carte de la coque, `ventesFaites`) dit « 30 € » sans « au moins »
  quand un prix est inconnu — règle de la coque, pas de cette branche.
- Zone Colis (agent principal) : `data-sorti-at` en UTC, pastille « doublon » `conflitsNum` en texte
  brut, secours UTC de `colisEnvoi.js` (listes blanches nommées des gardiens).
- Recherche dans Messages (`rechercheMessagesVinted.js`) : laissée telle quelle exprès — son test
  veut « AB-125 » ≠ « AB125 », ce que `cleNum` confond.

## Geste de Julien
Aucun.
