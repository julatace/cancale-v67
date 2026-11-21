# 11 nov. — eBay : les quatre bancs rouges (lot ebay-rouges)

Branche `claude/ebay-rouges`, partie de `claude/ebay-complet` @ 5ba373ffc. Demande : eBay « irréprochable » —
`ebay-programmer` (21 KO), `ebay-annonces` (4), `ebay-form` (4), `ebay-un-clic` (2), rouges à l'identique sur
`main` (f04d4a580). Pour chacun : la cause, puis corriger l'APP si c'est elle, sinon porter le banc sur la RÈGLE.

## Ce qui a été trouvé

| banc | cause | correction | preuve |
|---|---|---|---|
| ebay-programmer (21 KO) | Depuis la navigation par tâche (31 oct.), `?tab=plat_ebay` ouvre **Ventes · eBay** ; le banc touchait « Annonces » dans la barre du bas, qui rouvre Annonces sur **son** dernier filtre (Vinted par défaut, règle `navigationTache.js`, voulue). Il cherchait les brouillons eBay dans Annonces · Vinted. Ensuite (scénario D) : la feuille de vérification avant publication (3 nov., « 2 photos seulement ») attendait une réponse. | Banc : `ouvrirAnnoncesEbay` = le lien `?tab=annonces&site=ebay`, écran exigé MONTÉ sur eBay (`[data-tache="annonces"][data-tache-site="ebay"]`, sinon le banc lève) ; la feuille de vérification répondue « Publier quand même » (`data-verif-publier`) — les paires bloquées doivent rester bloquées après ce oui. | **110 OK, 0 KO** (l'avant : 21 KO). Mutation app (le `site=` du lien ignoré) ⇒ rouge. |
| ebay-annonces (3-4 KO, scénario « pas su ») | **Défaut de l'app.** `ebayRelie` (les sites montrés dans les filtres, 8 nov.) valait `null` dès que la sonde des lignes rangées (`sitesLus`) ne répondait pas — même avec un compte eBay RELIÉ au registre. eBay sortait des filtres et Annonces · eBay retombait sur Vinted pendant une panne de lecture, lien compris. | App (`src/App.jsx`) : un compte relié au registre (non implicite) prouve eBay à lui seul ; sinon la règle d'avant. Banc : le registre `ebay_comptes` servi dans sa forme réelle (`select=comptes:data->comptes`). | **182 OK, 0 KO.** Mutation (l'ancienne ligne `ebayRelie`, banc neuf) ⇒ les 3 mêmes rouges. |
| ebay-form (4 KO, « sous-onglets introuvables ») | Trois formes périmées : (1) le banc ne servait pas le registre des comptes eBay — depuis le 8 nov. eBay n'est montré qu'à un vendeur dont le registre prouve un compte, les liens `site=ebay` retombaient sur « Tous » ; (2) l'entrée est devenue « Vendre sur eBay » (6 nov., une seule entrée) et le banc comptait le libellé « Vendre un article sur eBay » ; (3) l'exemple du titre suit « Je vends » (lot vendeur-généraliste) et le banc cherchait `placeholder^="Nike Air Max"`. | Banc : registre servi ; comptage par `data-poster="ebay"` (UN seul, dans Annonces) ; titre par `maxlength="80"` ; `locale: 'fr-FR'` posée. | **0 KO** (tous ✅). Mutation app (le `site=` ignoré) ⇒ rouge. |
| ebay-un-clic (2 KO) | Même navigation que ebay-programmer + registre absent ; puis la feuille de vérification (3 nov.) ; et le critère manquant n'est plus une phrase « Il manque… » : eBay le DEMANDE (`QuestionsEbay`, lot ebay-complet), en anglais faute de langue posée. | Banc : lien `?tab=annonces&site=ebay` + contrôle neuf « l'écran est Annonces · eBay et y reste » ; registre servi ; vérification répondue ; B juge la question (`data-ebay-question="caracteristique"`, « Département » et les valeurs d'eBay), puis « Plus tard » (`data-ebay-q-plus-tard`) ⇒ rien vérifié ni publié, « Rien n'est publié » dit ; `locale: 'fr-FR'`. | **17 ✅, 0 ❌.** Mutation (le `site=` ignoré) ⇒ « le lien d'Annonces · eBay… » rouge (A et B). |

La langue : ces bancs lancés seuls (sans `scripts/lancer-bancs.cjs` et sa garde) prenaient la langue de la machine
(anglais) ; la branche `vert-11nov` pose `fr-FR` dans `_garde-reseau.cjs`. Ici elle est posée dans chaque banc
(`locale: 'fr-FR'`), sans dépendre de cette branche — les deux s'accordent.

## Ce qui n'a PAS été changé (et pourquoi)
- Toucher « Annonces » depuis Ventes · eBay rouvre Annonces sur SON dernier filtre (Vinted par défaut) : c'est la
  règle de la navigation par tâche (31 oct.) et du filtre retenu par écran — pas un défaut.
- `?tab=plat_ebay` sans section ouvre Ventes · eBay (`DEFAUT_SITE`, voulu).
- Un site masqué par ses réglages d'affichage reste masqué ; seule la preuve d'un compte relié ne se perd plus sur
  une lecture ratée (« pas su » ne vaut pas « absent »).

## Vérifications
- `npm run build` vert ; bancs : ebay-programmer 110/0, ebay-annonces 182/0, ebay-form 0 ❌, ebay-un-clic 17/0 ;
  ebay-complet **74/74**, ebay-complet-route 55/55, ebay-comptes 56/0, ebay-photos-agent-arret 37/37.
- Audits : ebay-route (530), variables, tdz, coherence, identite, icones, textes-courts, fonctions-api, secrets,
  quoi-de-neuf, traduction, ebay-retrait-auto — verts.
- Mutation : arbre `701fa3c08` + ancienne `ebayRelie` + `site=` du lien ignoré, bancs neufs ⇒ rouges :
  ebay-annonces 3 KO (« pas su »), ebay-form (Annonces/Messages introuvables, entrée absente), ebay-programmer
  (écran levé), ebay-un-clic (« le lien d'Annonces · eBay… » A et B).
- Captures regardées (390 et 1512) : brouillons eBay, aperçu du planificateur, Annonces · eBay.

## ÉTAT À LA REPRISE
- Tête poussée sur `claude/ebay-rouges` (pas de PR, pas de fusion sur main — consigne ; `origin/main` pas
  fusionné dans la branche : elle part d'`ebay-complet`, à intégrer avec lui).
- Pas de ligne §9 : seul changement d'app, eBay reste dans les filtres pendant une lecture ratée (rien de neuf à
  l'écran) ; CLAUDE.md de cette branche à 58 824 octets.
- Les 4 bancs à 0 KO ; rien ne reste rouge dans ce périmètre.
