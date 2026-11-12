# 12 nov. 2026 — La facture au téléphone : aperçu en miniature, tableau à largeurs fixes, « Envoyer avec VRM »

Branche `claude/agent2-facture-mobile` (second agent, depuis `origin/main` 184f46c2f), poussée à chaque
commit. Pas de PR, pas de fusion : l'intégrateur de la session intègre. Rien dans
`vinted-sync-extension/`. Aucune nouvelle fonction `api/` (toujours 12), aucune migration.

## Sa demande (12 nov., 08 h 16, trois captures iPhone, Ventes → vente d'un compte Pro → « Envoyer la facture »)

« Corrige les bugs de facture. » Ce que montraient les captures :
1. l'aperçu de la facture coupé à droite (« FACTUR… », « N° FA-2026-0006 (do… », « FACTURÉ À / BILL T… »),
   la colonne « Désignation » écrasée à UNE lettre par ligne (« D é s i g n a t i o n », le titre de
   l'article sur 30 lignes), la page qui défile de côté ;
2. en bas : « Tu as choisi d'envoyer depuis ta propre boîte : connecte-la, ou laisse VRM envoyer. » —
   mais seulement « Connecter ma boîte » et « Émettre sans envoyer » : aucun bouton pour laisser VRM envoyer ;
3. (à vérifier) la facture bilingue (acheteuse aux Pays-Bas, adresse e-mail privée de relais Vinted).

## La cause (reproduite au banc AVANT de corriger)

- `src/facture-pro.css` (6 nov.) posait `white-space: nowrap` sur les en-têtes ET les cellules des colonnes
  de chiffres, avec `table-layout: auto`. En bilingue, les en-têtes deviennent « Prix unit. HT / Unit price
  excl. VAT », « Total HT / Total excl. VAT » : sur une ligne, ils réclament ~330 px. Dans une feuille de
  358 px, le navigateur donne le reste (≈ 5 % du tableau) à « Désignation » ; avec `overflow-wrap: anywhere`
  sur la page blanche, le titre se coupe à chaque lettre (mesuré : 80 lignes, colonne à 5 %).
- La page blanche de la facture était dessinée à la largeur de la feuille : tout ce qui ne tenait pas
  sortait à droite (le titre, le numéro, « FACTURÉ À / BILL TO »).
- La phrase venait de `bloqueEnvoi` (« …ou laisse VRM envoyer. ») ; le bouton n'existait pas, et le serveur
  (`api/_lib/facture-pro.js`, `envoyer`) ne savait envoyer par VRM que si le RÉGLAGE disait « VRM ».

Le PDF (`src/facturePro/pdf.js`, dessiné par pdf-lib, positions fixes) n'était PAS touché : relevé texte
par texte sur la facture bilingue inventée, rien ne sort des marges, rien ne se chevauche, la mention
293 B (française puis traduite) et « acquittée » sont là. Il n'a pas été modifié ; l'audit le garde.

## Ce qui a changé

1. **Le gabarit pose ses largeurs** (`ApercuFacture`, `src/facture-pro.css`) : `table-layout: fixed`, un
   `<colgroup>` — Qté 3,4 em, Prix et Total 7,6 em — « Désignation » prend le reste (54 % du tableau dans la
   miniature, 67 % sur ordinateur) ; les en-têtes passent à la ligne (français, puis anglais dessous, comme le
   PDF) ; les montants (cellules et totaux) ne passent jamais à la ligne (« 1 / 234,50 € » vu au banc, corrigé).
2. **L'aperçu d'une feuille est une MINIATURE** (`MiniatureFacture`, `LARGEUR_PAGE_FP` = 520 px) : la
   facture rendue à sa vraie largeur, puis réduite par `transform: scale` pour tenir (0,63 au téléphone ;
   à 1 dès que la place suffit, jamais agrandie). Hauteur réservée = hauteur × échelle (ResizeObserver).
   Une pastille « Agrandir » ; un toucher (ou Entrée) ouvre le PDF en grand dans la visionneuse de PDF de
   l'app (`ouvrirPdf` → `ouvrirPdfOnglet`; sur iPhone, l'onglet PDF de Safari : pincer pour zoomer). Une
   facture pas encore émise s'ouvre avec « N° … (aperçu) » (`apercuEnGrand`) : le PDF ouvert ne passe
   jamais pour la facture définitive. Vaut pour « Envoyer la facture » (Vinted Pro) et « Faire la facture »
   (Leboncoin/Vestiaire/eBay, `src/FactureAutres.jsx`). « Ma facture » (aperçu en direct pendant la saisie,
   avec ses « à compléter » en ambre) garde l'aperçu à la largeur de sa colonne : le tableau fixe suffit.
3. **« Envoyer avec VRM »** : réglage « depuis ma boîte » + boîte PAS connectée + envoi VRM possible
   (serveur configuré, e-mail du vendeur, plafond du jour ; `vrmIndisponible`, la même règle que la route)
   ⇒ en bas : « Ta boîte n'est pas connectée. [Connecter ma boîte] » + le bouton plein « Envoyer avec VRM »
   + « Émettre sans envoyer ». Son clic émet puis envoie avec `via: 'vrm'` POUR CETTE FACTURE (Reply-To et
   copie au vendeur, plafond du jour, tous les garde-fous de l'envoi VRM) ; le réglage « ma boîte » n'est
   pas changé. Envoi VRM impossible ⇒ pas de bouton, la phrase dit pourquoi en une phrase (« L'envoi par
   VRM n'est pas encore ouvert. », « …ajoute ton e-mail dans « Ma facture ». », « …plafond du jour. »), les
   deux autres gestes restent. Facture déjà émise : le même bouton (« Renvoyer avec VRM » si elle est déjà
   partie, confirmé).
4. **Serveur** (`api/_lib/facture-pro.js`, `envoyer`) : `via = !auto && corps.via === 'vrm' ? 'vrm' : réglage`.
   L'envoi AUTOMATIQUE (`api/_lib/factures-auto.js`) suit toujours le réglage (un `via` ne vient que d'un clic).

## Preuves

| contrôle | origin/main (git archive) | cette branche |
|---|---|---|
| banc `scripts/bancs/facture-mobile.cjs` (390 tactile + 1512, clair + sombre) | **37 rouges** (colonne à 5 %, 80 lignes, titre coupé, pas de miniature, pas de bouton, « laisse VRM envoyer ») | **vert** (≈ 110 contrôles) |
| `audit-facture-mobile.cjs` (PDF relevé texte par texte + gabarit + phrase) | **7 rouges** (G1-G5, E1-E2 ; la partie PDF P est verte : le PDF n'était pas cassé) | 40 ✅ |
| `audit-facture-pro.cjs` V14 (« Envoyer avec VRM » côté serveur, auto ignore `via`, réglage respecté) | **1 rouge** (V14) | 102 ✅ |

Mutations : décaler la colonne « Qté » du PDF (`W - M - 130`) ⇒ P2/P3 rouges (chevauchements, désignation
sous « Qté ») ; le CSS d'avant ⇒ G1-G4 et le banc rouges ; retirer `corps.via` ⇒ V14 rouge.
Audits facture verts : `facture-pro`, `factures-pro-2`, `facture-en-tva`, `factures-autres`,
`facture-siret`, `xss-facture`, `config-facture` ; et `variables`, `tdz`, `coherence`, `identite`, `icones`.
Bancs facture relancés un à un (BANC_PORT aléatoire) : voir le rapport de l'intégrateur.

Planche avant/après (regardée) : `docs/passation/planches-facture-mobile/`.

## Ce qui reste

- Sur iPhone, le PDF en grand s'ouvre par un lien après sa fabrication (~1 s) : Safari peut demander une
  confirmation de téléchargement (même chemin que « Voir le PDF » et « Voir l'exemple en PDF » d'avant).
- La série « Facture Pro » (Ventes → Sélectionner) n'offre pas encore « avec VRM » quand la boîte n'est pas
  connectée : elle dit la raison par vente, comme avant.

## Geste de Julien

Aucun. (Pour que « Envoyer avec VRM » apparaisse, l'envoi par VRM doit être ouvert : `RELANCES_SMTP_*` +
`RELANCES_EXPEDITEUR` sur Vercel — geste déjà listé.)
