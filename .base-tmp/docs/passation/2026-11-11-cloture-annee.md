# 11 nov. 2026 — « Clôturer l'année » : une liste guidée

Branche `claude/cloture-annee` (depuis `origin/main`, puis un vrai `git merge origin/main`).
Pas de PR, pas de fusion dans `main`. L'extension n'est pas touchée. Aucune migration, aucune
fonction `api/`. Aucune écriture en base réelle.

## Ce qu'il voit

**Argent → Déclarer**, en tête, de **décembre à mai** : une carte « Clôturer 2026 » (en
décembre l'année en cours, de janvier à mai celle qui vient de finir ; de juin à novembre,
rien). Un compteur « 3/7 » (étapes réglées sur celles qui le peuvent), puis huit lignes ; chaque
ligne a un rond (✓ gris réglé · le nombre en ambre · « — » pas su · « … » lecture · « 31 » à
faire le 31 décembre · « ↗ » ton geste) et OUVRE l'écran existant qui la règle :

| étape | ce qui est constaté (règle du propriétaire) | la porte |
|---|---|---|
| 1. Ventes à dater | `vinted_urssaf_mois.aDater` ; celles vendues APRÈS l'année écartées (`annees`) ; les raisons du lot DJ7, « Ouvrir Vinted ↗ » sur un compte pas relu | « Vendu et reçu » (Résumé) |
| 2. Prix d'achat | `beneficeDesJours` de l'année sur `vrm_benefice_jours` (n − nCout) | Annonces, saisie en série |
| 3. Inventaire au 31/12 | la publication `vrm_inventaire_annuel` (lot W) ; ✓ seulement si lue LE 31 décembre (VRM ne reconstitue pas un jour passé) ; avant : « à faire le 31 décembre » | Stock → « Inventaire de fin d'année » ouvert |
| 4. CA de l'année | `caAnnee` (daté au VERSEMENT, comptes sélectionnés, ventes à dater prouvées de l'année), les 12 mois de la ligne (mois lu sans versement = 0, mois pas lu = « — »), « au moins » + raisons, « calculé avant la fin de l'année » | « Vendu et reçu » |
| 5. URSSAF | registre `vrm_urssaf_declare` (`moisDeclare`) par période du rythme choisi ; reste ≈ Σ `montantPeriodeUrssaf(...).apayer` des périodes pas notées, « au moins » si un minimum, « estimé » | la carte « Prochaine déclaration » |
| 6. Revenus | `declarationRevenus` au 31/12 : le montant et la case selon SA réponse au versement libératoire (non ⇒ 5KO, oui ⇒ 5TA) ; pas répondu ⇒ « réponds d'abord », jamais une case choisie ; société/marge : « vois avec ton comptable » ; statut pas choisi : « — » | « Ta micro-entreprise » |
| 7. Seuils et DAC7 | `jaugeSeuils` au 31/12 (TVA, micro) + `dac7ParPlateforme` ; un seuil dépassé ⇒ ambre (à regarder) | « Ta micro-entreprise » |
| 8. Export | jamais ✓ : VRM ne sait pas s'il est parti | « Exporter pour mon comptable » ouvert sur l'année (rien téléchargé avant son clic) |

**« J'ai fini »** (bouton encre, 44 px) demande confirmation en disant combien d'étapes ne sont pas
réglées ou pas vérifiées, puis range `vrm_cloture_annee[AAAA] = { at, etapes }` (l'état constaté de
chaque étape, synchronisé). La carte dit alors « 2026 clôturée le … » + « Rouvrir la liste ».

**Ma journée**, en **décembre et janvier**, une fois : « Clôturer 2026 » (neutre). « Voir » ouvre
Déclarer sur la liste et note l'année vue (`vrm_cloture_vue`, son clic) ; elle ne revient pas. Ni
pour un particulier, ni avant d'avoir lu le statut, ni pour une année clôturée.

Un particulier ne voit rien (rien à clôturer). La porte 8 ouvre la carte « Pour mon comptable » (zip,
tableur, PDF) réglée sur l'année ; rien n'est téléchargé avant son clic.

## Les règles

- `src/clotureAnnee.js` (pur, aucune écriture) : `anneeACloturer`, `carteJournee`,
  `clotureAnnee({ annee, maintenant, ligne, joursBenef, inventaire, declare, regime, freq, taux,
  liberatoire, activite, cloture, R })`, `enregistrementCloture`. `R` = les règles des
  propriétaires (l'écran passe `REGLES_CLOTURE`). Trois états partout ; global « prêt » seulement
  si toutes les étapes comptées sont ✓ (jamais sur un pas su ou une lecture en cours).
- `src/ClotureAnnee.jsx` : la forme (aucune somme), styles `src/styles-cloture-annee.css` (reprend la
  carte de « Mois bouclé »).
- Branchements : `src/ecrans/Compta.jsx` (montage, `portesCloture`, l'export s'ouvre sur l'année
  demandée — `DEMANDE_COMMANDE.exportPeriode`), `src/ecrans/Stock.jsx` + `src/inventaireAnnuel.js`
  (`DEMANDE_INVENTAIRE_ANNUEL`), `src/App.jsx` (job de Ma journée, `vrm_cloture_annee` et
  `vrm_cloture_vue` dans `SYNC_KEYS` et `CLES_GESTES`).

## Les montants légaux — ce qui a été vérifié, et ce qui ne l'a pas été

⚠️ **Dans cette session, les sites officiels n'ont pas pu être lus** : impots.gouv.fr et
entreprendre.service-public.gouv.fr sont refusés par le réseau du conteneur (« ENOTFOUND », hôtes
hors liste). Rien n'a donc été revérifié aujourd'hui. Ce que la carte affiche vient des chiffres
DÉJÀ vérifiés et datés dans le code, avec leur source et leur date, jamais comme un fait neuf :
- cases **5KO / 5TA** : `CASES_IMPOT` (src/microEntreprise.js), « vérifié sur la notice officielle
  2042-C-PRO 2026 (impots.gouv.fr, revenus 2025) le 29 oct. ». La carte écrit la source et, pour des
  revenus plus récents que 2025, « revérifie la case sur la notice de l'année avant de la reporter »
  (la notice des revenus 2026 paraît au printemps 2027) ;
- seuils 2026 (TVA 85 000 € / 93 500 €, micro 203 100 €) : `SEUILS_MICRO`, lus le 29 oct. sur
  service-public.gouv.fr (F21746, F32353) — la carte affiche « Seuils lus le … » ; une année sans
  seuils vérifiés ⇒ « seuils de cette année pas vérifiés » (`seuilsDe` rend `null`) ;
- DAC7 (30 ventes ou 2 000 €) : `DAC7` (src/profilFiscal.js), règle de `verdictDac7`.
**Geste pour la prochaine session (ou Julien)** : autoriser impots.gouv.fr et
service-public.gouv.fr dans le réseau de l'environnement, relire ces trois pages, et au printemps
2027 la notice 2042-C-PRO des revenus 2026 (mettre `NOTICE_LUE` à jour dans src/clotureAnnee.js).

## Preuves

- `node scripts/audit-cloture-annee.cjs` : **54 verts**. Il EXÉCUTE src/clotureAnnee.js avec les
  vraies règles d'App.jsx (`montantPeriodeUrssaf`, `moisDeclare`, `beneficeDesJours`, jouées en vm),
  les vrais `caAnnee`, `declarationRevenus`, `jaugeSeuils`, `dac7ParPlateforme`, sur des données
  inventées, et compare chaque chiffre à la règle du propriétaire. `--prouve` : **16/16 mutations
  rouges** (à dater de l'année d'après comptées, à dater tues, pas su ignoré, export coché,
  inventaire lu un autre jour, case devinée, reste URSSAF avec les périodes déclarées, mois pas lu à
  0, « avant la fin » tu, second calcul du CA, prix tus, carte de Ma journée en février, carte qui
  revient, liste pas montée, carte pas poussée, écriture au rendu). Sur l'arbre d'`origin/main`
  (git archive) : rouge.
- Banc `scripts/bancs/cloture-annee.cjs` (horloge de la page fixée : 15 janv. 2027, 10 févr. 2027,
  11 nov. 2026 ; 390 tactile et 1512, clair et sombre) : **117 verts, 0 rouge** sur le code fusionné
  avec `main`. Captures regardées (liste claire/sombre, confirmation, carte de Ma journée, export sur
  2026 — zip « Pour mon comptable » de `main` compris —, « clôturée »). Vu au banc et corrigé :
  l'inventaire disait « ouvre Ventes » (⇒ « liste pas encore lue : ouvre Annonces ») ; les seuils
  sur un CA minimum disaient « une lecture d'annonces manque » ; « Rouvrir » chevauchait le titre ;
  **la porte « inventaire » n'ouvrait rien quand le Stock est vide** (ce chemin de l'écran ne
  montait pas la feuille de fin d'année — elle est maintenant montée sur les deux chemins).
  Banc `inventaire-annuel` relancé : 72 verts.
- `npm run build` vert ; audits variables, tdz, coherence, identite, icones, textes-courts,
  fonctions-api, secrets, urssaf verts ; fusion-nuage, mois-boucle, inventaire-annuel,
  rappel-urssaf, suivi-urssaf verts.

## Reste

- L'inventaire n'est ✓ que si la liste a été lue le 31 décembre (ouvrir VRM ce jour-là).
- La carte ne sait pas si l'export est parti chez le comptable : c'est son geste.
