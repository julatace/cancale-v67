# 14 nov. 2026 — 160 · La vente en main propre en 2 touchers

Branche `claude/idees-argent` (depuis `origin/main` 578bd343). Aucune PR ouverte (consigne).
Quatre idées étaient demandées (159 dépense en photo, 160 vente en main propre, 161 « Dis Siri »,
162 partager en image). **Julien a choisi la 160 seule** (« fais ça bien », « je ne tolère plus
d'erreurs ») : 159, 161 et 162 ont été retirées de la branche avant fusion — code, route et jeton
Siri (`api/widget.js?mode=siri` n'existe pas), textes, audits, nouveautés. `audit-vente-main-propre`
§C6 vérifie qu'il n'en reste aucune trace.

## Ce qui existait — et la règle unique

« **Vendu ailleurs** » (11 nov., `src/venteAilleurs.js`) : sur la fiche d'une paire,
`vrm_cycle_decisions[annonce] = { choix: 'vendu-main', numero, montant, date, at, ailleurs }`,
comptée par `ventesMainPropre` dans `ventesFaites` (vendu), `ventesDeclarables` (CA URSSAF,
paramètre `main`), `ventesAutresBenefice` (bénéfice), et côté serveur dans `calculerBilan`
(api/_lib/bilan-semaine.js). Jamais deux fois avec la vente Vinted de la même annonce.

La 160 **n'ajoute aucune règle de comptage** : la feuille écrit cette même décision
(`opsVenteMain` → `opsVenduAilleurs`), plus le mode de paiement (`paiement`, nouveau champ de
`opsVenduAilleurs`, liste `PAIEMENTS` : espèces · virement · autre).

Ce qui décidait « peut-on noter cette vente ? » vivait dans App.jsx (`blocVenduAilleurs`). Il est
sorti en une fonction pure, **`verdictVenteMain`** (src/ideesArgent/venteMain.js), que la fiche ET
la feuille appellent sur la MÊME lecture : `histoirePaire` (extraite de `rendreFichePaire`) =
`rechercheParNumero` (« Tout sur le N° », identité par le N° EXACT) + `histoireArticle` (l'étape
« vente » lue sur Vinted, Leboncoin, eBay).

| verdict | quand | la feuille dit |
|---|---|---|
| `possible` | une paire présente sous ce N°, ventes lues, aucune vente | la paire, le prix |
| `plusieurs` | deux paires PRÉSENTES sous ce N° (le doublon §5) | « 2 paires portent le N°88 : laquelle as-tu vendue ? » (plaques rouges), puis SON toucher |
| `deux-annonces` | deux annonces en ligne de la MÊME paire | refus : ouvre sa fiche pour trancher |
| `vendue` | une vente lue (Vinted à envoyer, en route ou finie ; Leboncoin ; eBay ; Vestiaire — ses ventes par identité, `ventesVcDe`, la règle de `numerosDejaVendus`) | refus, la vente dite |
| `deja-main` · `marquee` · `sortie` | déjà vendue en main propre · marquée vendue dans Annonces · enlevée du stock | refus |
| `compte-ecarte` | la paire d'un compte retiré de ses totaux (`compteEcarte`, la règle de la coque) | refus : sa vente n'y compterait pas |
| `passu` | fiches, ventes (Vestiaire compris) ou dressing pas lus | refus : « je ne peux pas vérifier… » (« pas su » ≠ « pas vendue ») |
| `archive` | « 125 » tapé, seul « B125 » (d'avant la remise à zéro du 11 oct.) existe | « Le N°B125 existe » + « C'est le N°B125 » (son toucher) — jamais pris à sa place |
| `aucune` | aucune paire sous ce N° | « Aucune paire au N°999 dans tes annonces. » |

Effet sur la fiche : « Vendu ailleurs » suit désormais ce verdict — il ne s'offre plus pour une paire
marquée vendue, enlevée du stock, d'un compte exclu (avant : offert) ; le reste est inchangé
(une seule paire possible, ou « déjà vendu ailleurs »). La fiche d'un N° d'archive garde sa règle
(rien n'y est proposé) ; la feuille, elle, accepte « B125 » tapé exactement.

## La feuille (src/ideesArgent/Feuilles.jsx)

- Portes : la loupe / ⌘K « vendu 124 » (« main propre 124 ») ⇒ « N°124 vendu en main propre »
  (la feuille s'ouvre sur ce N°, le PRIX au focus) ; « vente main propre » sans N° ; le lien
  `https://vrm.center/?idee=vente-main[&num=124]` (un Raccourci « Ouvrir les URL » de l'iPhone).
  Quand l'éventail du disque (direction Studio) existera : `ouvrirIdee('vente-main')`.
- **Deux touchers, mesurés par le banc** : l'action de la loupe, puis « Vendue · 45 € » (le prix se
  tape au clavier déjà ouvert). Depuis la feuille vide : taper le N°, Entrée (ou toucher le prix),
  taper le prix, « Vendue ».
- Paiement : segment Espèces · Virement · Autre (espèces par défaut). Date : aujourd'hui,
  « changer » (passée seulement). Phrase : « Pas de versement d'une plateforme : comptée vendue et
  encaissée le 14 novembre. »
- Une recherche par mots (« dunk 42 ») ne fait que PROPOSER (8 lignes) ; la ligne touchée remet
  son N° dans le champ, puis le verdict.
- Au clic « Vendue », le verdict est **relu** : une vente lue ou notée entre-temps ⇒ « Le N° vient de
  changer… rien n'est noté ».
- Écriture : le geste annulable de la fiche (`gesteVrm`, pilule « Annuler » 5 s ⇒ l'état d'avant
  exact : décision, marque « vendue », case du Stock). Rien n'est écrit avant « Vendue ».
- Après : « N°124 vendu en main propre · 45 € », « Comptée dans « vendu », ton CA et ton bénéfice du
  14 novembre (espèces) » ; si l'annonce Vinted est encore en ligne : « retire-la, sinon elle peut se
  vendre une deuxième fois ».
- **Reçu PDF** (optionnel, `recuPdf.js`, pdf-lib à la demande, A5) : n° `MP-AAAAMMJJ-{N°}`, date,
  « Vendu par » (l'entité des Factures, sinon une ligne à remplir), article, référence N°, paiement,
  montant, « Article d'occasion, vendu en l'état et remis en main propre. Paiement reçu en totalité ».
  Ni acheteur (VRM ne le connaît pas), ni prix d'achat.
- « Annuler une vente en main propre » (repli, 30 jours) : `opsAnnulerVenteMain` remet la décision
  d'avant (`prec`, gardée dans la décision), retire la marque « vendue », rend la case (`caseAvant`)
  si elle est restée libre — prise par une autre paire ⇒ rien n'est déplacé, la pilule le dit.

## Les totaux (la règle existante, exécutée par l'audit)

Vendu (`ventesFaites`) au jour saisi ; CA URSSAF (`ventesDeclarables`) du mois saisi, encaissé ce
jour-là, jamais « à dater » ; bénéfice = prix − prix d'achat de SON N° (`ventesAutresBenefice`) ;
bilan serveur (`calculerBilan`) : vendu et reçu. Compte : la paire d'un compte retiré des totaux est
refusée à l'entrée (les lignes « main propre » n'ont pas de compte dans les règles des totaux).

## Fichiers

- Neufs : `src/ideesArgent/{venteMain.js, recuPdf.js, Racine.jsx, Feuilles.jsx, idees-argent.css}`,
  `src/i18n/langues/{fr,en,es,it,de}/idees.js`, `scripts/audit-vente-main-propre.cjs`,
  `scripts/bancs/vente-main-propre.cjs`.
- Points d'entrée : `src/App.jsx` (`histoirePaire`, `verdictVenteMainCoque`, `blocVenduAilleurs` par
  le verdict, `besoinNumData` quand la feuille est ouverte, `<IdeesArgentRacine/>`, une ligne dans
  `lancerActionRecherche`) ; `src/annulerCommandes.js` (deux actions) ; `src/venteAilleurs.js`
  (`paiement`) ; `src/nouveautes.js` ; `scripts/audit-traduction.cjs` (MIGRES).
- Studio bleu clair : classes `sb-*` du contrat définies PROVISOIREMENT dans `idees-argent.css`
  sous `:where(.ia)` (à retirer quand `src/design/studio.css` arrive) ; le rouge (`--ia-rouge-double`)
  ne sert qu'à `.sb-plaque.is-double`.

## Preuves (après la fusion de `origin/main`)

- `node scripts/audit-vente-main-propre.cjs` : **43 verts** — R verdict sur les vraies `toutSurLeNumero`
  + `histoireArticle` (N° exact, archive, inconnu, 50 titres identiques, doublon ⇒ question puis son
  toucher, même paire deux fois, vendue Vinted à envoyer / en route / finie, annulée ⇒ possible,
  Leboncoin, eBay, Vestiaire, pas lu ⇒ refus, déjà vendue en main propre, marquée, sortie, compte
  exclu) ; G geste et annulations (5 s exacte ; remise en stock : décision d'avant, case si libre) ;
  T vendu, CA URSSAF, bénéfice (`ventesAutresBenefice`), bilan serveur ; P reçu PDF relu par pdfjs ;
  C une règle fiche + feuille, verdict relu au clic, aucune trace de 159/161/162.
  `--prouve` : **17/17 mutations attrapées**. Sur l'arbre de départ (578bd343, `git archive`) : rouge.
- `node scripts/bancs/vente-main-propre.cjs` (après `npm run build`) : **88 OK, 0 KO** à 390 tactile
  et 1512, clair et sombre — deux touchers mesurés (pointerdown), décision + paiement + sortie du
  stock, Ma journée « vendu 45 € / versé 45 € » du jour (`data-jv2-vendu`, `data-jv2-verse`),
  « Annuler » ⇒ stockage d'avant exact et chiffres d'avant, « Vente annulée » dite, reçu PDF
  téléchargé, refus (inconnu, vendue sur Vinted), archive proposée puis prise par son toucher,
  doublon ⇒ question + plaques rouges, cibles ≥ 44 px, aucun débordement, aucune erreur. Captures
  regardées (`$TMPDIR/vrm-bancs/vente-main-propre/`) : bénéfice du mois 8 € (45 − 37), vendu du mois
  125 € (80 + 45), cohérents.
- Audits passés : build, traduction, tdz, variables, coherence, identite, csp, fonctions-api, urssaf,
  violet, rouge-doublon, quoi-de-neuf, annuler-commandes, saisie-rapide, bilan-semaine, bilan-mois.

## Geste de Julien

Aucun obligatoire. Facultatif : un Raccourci iPhone « Vente en main propre » (« Ouvrir les URL »
`https://vrm.center/?idee=vente-main`). Remplir le nom de la facture (Argent → Factures) pour qu'il
figure sur le reçu.
