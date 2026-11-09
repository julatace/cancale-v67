# 9 novembre — Lot F : le plancher sous chaque offre, et « déjà N paires de ce modèle »

Branche `claude/plancher-stock` (depuis `origin/main`). Propositions 1 et 8 de
`2026-11-09-propositions.md`, validées par Julien (« fais tout »). Rien d'autre ne change ;
l'extension n'est pas touchée.

## 1. Le prix plancher sous chaque offre (Vinted)

**La règle** — `src/plancherOffre.js` (pur) : le plancher est le prix où le bénéfice d'une
paire vaut 0, LU dans la règle du bénéfice elle-même (`beneficePaire('0', fiche)` : prix
d'achat **saisi** + frais connus de la fiche — frais/boost, commission, port payé par lui,
remboursement, autres). Une seule règle (§5) : l'audit vérifie sur 2 000 tirages que
« bénéfice < 0 » ⇔ « offre < plancher », même perte au centime.
- `achat` : aucun prix d'achat saisi ⇒ **aucun plancher** (pas su ≠ 0, §2.5) ; l'écran dit
  « Prix d'achat pas saisi : le plancher n'est pas calculé » + **Saisir le prix d'achat**
  (la porte existante `saisirPrixAnnonce` : elle DEMANDE, même écriture que la saisie en série) ;
- `illisible` : un montant saisi ne se lit pas ⇒ rien ;
- `ok` : achat + frais confirmés (« Tous les frais sont renseignés ») ⇒ « En dessous de 103 € tu
  perds de l'argent » ;
- `partiel` : frais pas confirmés ⇒ même phrase + « (au moins : tes frais ne sont pas tous
  confirmés) » ; une offre au-dessus n'est jamais dite « sans perte ».
- Offre sous le plancher ⇒ « Cette offre te ferait perdre 3 € » (« au moins » si partiel), en
  **ambre** (`C.warn`), jamais rouge. Jamais une phrase « vends à… » : ce n'est PAS un prix
  conseillé (refusé le 11 oct.).
- Le prix mini posé à côté du N° sous le plancher ⇒ « Ton prix mini (60 €) est sous ce
  plancher. » — information seule ; le mini n'est pas changé, le moteur `autoAccepterOffres`
  (extension) n'est pas touché.

**Où** (`src/App.jsx`, composant `src/LignePlancher.jsx`) :
- la carte d'offre du fil (sous « Prix affiché / Offre reçue / Ton minimum »), et la carte
  « indisponible » (extension absente ou en retard) ;
- la liste des conversations : « à perte » en ambre à côté de « Offre 100 € en attente ».
- La fiche est trouvée par IDENTITÉ (`numeros[item_id]`, `plancherDeItem`) ; une paire dans
  une autre devise ⇒ rien.

**Pas fait, dit** : Vestiaire. Ses offres (`vc_offres`) ne sont reliées à aucune fiche portant
un prix d'achat (seulement `productId` → N°), et la commission Vestiaire n'est pas lue
(`fraisPlateformes.js`) : un plancher y serait faux ou deviné ⇒ rien affiché. Si un jour la
commission est lue et le prix d'achat rangé par `productId`, `plancherVente(fiche,
{ commissionLue })` est prête. Les offres « Favoris » sont des offres ENVOYÉES par lui : hors sujet.

## 2. « Tu as déjà N paires de ce modèle en stock »

**La règle** — `src/dejaEnStock.js` (pur, `pairesDuModele`, `memeModele`) : ressemblance
(§5, une proposition), **jamais une liaison, rien n'est écrit**.
- même marque obligatoire (`extractBrand`, champ de l'annonce d'abord) ;
- modèle : deux modèles reconnus (`extractModel`) différents ⇒ écartée ; égaux ⇒ gardée ;
  sinon un mot de modèle commun (hors marque, couleurs `extractColors`, tailles, mots vides) ;
- taille connue des deux côtés et différente ⇒ écartée ; inconnue d'un côté ⇒ gardée (dite).
- Stock = les paires présentes : `annBase` (en ligne) + `annMasquees` (masquées sur
  l'étagère), mémo `stockPourModele` ; « depuis » = date relevée « Ajouté il y a… », sinon la
  date Vinted.

**Où** :
- Achats → Achats hors plateforme → « + Ajouter » : sous « Ce que tu as acheté », pendant la
  frappe (`src/ecrans/Achats.jsx`). Les annonces ne sont pas lues sur l'écran Achats : ouvrir le
  formulaire demande leur lecture (`chargerStock`, lecture seule) ; pas lues ⇒ rien dit.
- « Prix d'achat à compléter » (Achats prêts à confirmer) : sous une proposition « Payé sur
  Vinted… », « Tu as déjà N autres paires de ce modèle en stock » (la paire elle-même exclue).
- Toucher (`<details>` `vrm-repli`) ⇒ N°, photo, taille, « en ligne depuis N j » ; aucun bouton.

## Preuves

- `node scripts/audit-plancher-stock.cjs` : **35 verts** ; `--prouve` **12/12 mutations**
  rouges (achat absent pris pour 0, frais ignorés, partiel dit exact, frontière décalée, mini
  tu, marque/modèle/mot commun/taille ignorés, la paire comptée elle-même, ambre → rouge,
  plancher deviné à l'écran). Dont : 50 paires identiques ⇒ « 50 », stock intact, aucun champ de
  liaison ; marque différente écartée. Sur `origin/main` (git archive) : rouge (modules absents).
- Banc `scripts/bancs/plancher-stock.cjs` (390 px tactile sombre + 1512 px, données inventées) :
  tout vert ; sur l'arbre d'`origin/main` rebâti : 6 rouges dès le 390 px. Captures regardées :
  `<tmp>/plancher-stock-{390,1512}-{liste,fil,achat}.png`, `-1512-fil-partiel.png`.
- `npm run build` ; audits `variables`, `tdz`, `coherence`, `identite`, `statuts`, `icones`,
  `benefice`, `benefice-unique`, `frais-plateformes`, `moteur-offres`, `offres-auto`,
  `offres-garde`, `offres-mini-lecture`, `offres`, `prix-mini`, `contre-offre-mini`,
  `vc-offres`, `offre-annonce-partie` : verts.

## Geste de Julien
Aucun. Pour voir le plancher : saisir le prix d'achat de la paire (et cocher « Tous les frais
sont renseignés » pour un plancher exact).
