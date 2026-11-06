# 6 nov. — Vague 2 : comptes sans e-mail, adresse sans compte, « Vérification de l'article », Leboncoin « Suppression »

Points 5, 6 et 11 de `docs/passation/2026-11-05-ameliorations-vague-2.md` (zone des chantiers G
et H). Branche LOCALE `v36-vague2-comptes`, partie de `claude/project-review-nsk5su`
(162659a6). Rien dans `vinted-sync-extension/`, `public/` intact. Rien poussé.

## Mesuré d'abord (sa base, SELECT seulement — aucun nom, adresse ni pseudo ici)

- **Ventes « avec Vérification de l'article »** : 2 e-mails (2 et 3 nov.) gardés
  `email_inconnu_*`, famille « vente », raison « reconnu vente, analyse impossible ». Sujet
  « Tu as vendu un article sur Vinted ! (avec Vérification de l’article) » ; corps
  « <pseudo> a acheté <titre> taille <t>. » puis « … envoyer la commande à notre centre de
  vérification sous 5 jours ». **Aucun prix dans l'e-mail** : `parseSaleEmail` exigeait un prix.
  Le lien « conversation » est un id d'`/inbox/` au NOUVEAU format (UUID), pas un n° de
  transaction : aucune identité de vente dans l'e-mail.
- **États de commande** contenant « vérification » : `Envoi au centre de vérification`
  (2 ventes, 2 comptes, `transaction_user_status` = waiting) et `Transaction suspendue - en
  attente de vérification.` (une SUSPENSION, `PAS_UNE_VENTE` — pas l'étape).
- **Leboncoin « Suppression de vos annonces sur leboncoin.fr »** : 2 e-mails (21 oct.), « aucune
  règle ne le reconnaît ». Corps : « Votre annonce <titre> a bien été supprimée du site
  leboncoin.fr le <date>. » Les liens du HTML : accueil, « déposer une annonce », CGU,
  réseaux, magasins d'applis. **Aucune identité d'annonce** (ni `/ad/…`, ni id).
- **Adresses** : 924 lignes `email_reception_*`, 9 adresses ; 3 n'ont aucun compte Vinted
  dans `vinted_account_emails` (138, 9 et 1 e-mails). Toutes sont dans son registre.

## Ce qui change

### 1. Comptes liés : une ligne « E-mails » sur chaque carte Vinted
`src/emailsCompteLie.js` (`ligneEmailsCompte`) PROJETTE la règle existante
`etatEmailsComptes` (celle de Notifications et d'Achats, §11 — aucune règle neuve) :
`recoit` ⇒ « reçoit ses e-mails » ; `muet` ⇒ « aucun e-mail depuis N j » (N depuis son dernier
e-mail, ou — jamais reçu — depuis sa 1re vente qui aurait dû en produire un : la PREUVE) en
ambre + « Relier sa boîte » (ouvre E-mails → Relier ma boîte, sur les adresses) ;
`surveiller`/`calme` disent pourquoi on ne conclut pas ; pas su ⇒ « — pas su » ; en cours ⇒
« Lecture en cours… » ; hors des totaux ⇒ rien. `CarteCompteLie` prend `emails` ;
`VintedAccounts` appelle `useEtatEmailsComptes(accounts)` ; `data-compte-emails`,
`data-compte-emails-jours`, `data-compte-emails-relier`.

### 2. E-mails → Relier ma boîte : « Adresse sans compte : N e-mails »
`src/adressesSansCompte.js` : SES lignes de réception (`select=at:data->>at,adresses:data->adresses`,
`lireTout`, jamais `select=data`), une fois par e-mail, l'adresse suivie (déclarée, « +étiquette »
ramenée), hors boîte collective VRM, hors adresses portées par un compte et hors « compte
acheteur ». Trois états (`undefined` · `null` ⇒ `EtatPanne` · tableau). Bloc `AdressesSansCompte`
en tête de l'onglet (passé dans `reglages` de `BoiteEmails`, avant `EmailsSetting` — le harnais
`tests/espace-emails-interface` découpe `EmailsSetting` par sa signature, gardée).
Deux gestes, **le compte n'est jamais deviné** :
- **Relier un compte** : ne propose que les comptes SANS adresse (`comptesSansAdresse`) ;
  `relierAdresse` refuse une adresse déjà portée par un autre compte et ne remplace jamais
  l'adresse d'un compte (ça se fait dans Comptes liés → Gérer) ; confirmation, puis
  `save('vinted_account_emails')` — le registre existant que lit le serveur (`detectAccount`),
  ligne `main` à son nom (le propriétaire est la ligne).
- **C'est un compte acheteur** : confirmé, noté dans `vrm_adresses_acheteur` (ajouté à
  `SYNC_KEYS`), l'adresse ne se signale plus ; « Annuler » dans le repli.

### 3. Ventes « avec Vérification de l'article »
- `parseSaleEmail` (api/email-inbound.js) : la mention (sujet « Vérification de l’article » ou
  corps « centre de vérification ») ⇒ titre lu jusqu'au point qui finit la phrase (« … taille
  44,5. »), N° du titre comme avant ; **prix vide, jamais deviné** ; `verification: true`. Une
  forme sans pseudo ni titre reste « analyse impossible » (gardée). La réponse et le résumé de
  réception portent `verification`/`vf:1`. Notification « 💸 Vendu ! … — avec Vérification de
  l’article : envoi au centre de vérification de Vinted » (`texteVendu`, sans prix).
- Widget (repli sur les e-mails seulement) : une vente sans prix lu ⇒ « au moins »
  (`moneyNonComptees`), jamais un total partiel présenté complet.
- Frise : `src/verificationArticle.js` (`auCentreDeVerification(o)` — l'état de LA transaction,
  jamais un titre ; une suspension n'est pas l'étape). `friseVenteFusion(…, { verification })`
  insère « Au centre de vérification » (mot court « Vérification » sous le trait, nom entier lu)
  entre Postée et Livrée : faite seulement si Livrée l'est (déduite), sinon en cours une fois
  postée. Ligne, récapitulatif (`RecapFrise`) et phrase (« Vers le centre de vérification. »).
  Une fois livrée, Vinted ne dit plus « centre » : la frise redevient la frise de toujours.

### 4. Leboncoin « Suppression de vos annonces »
`api/_lib/lbc-suppression.js` : reconnu (sujet + expéditeur, ou la phrase ; « TR: » compris) ;
titre et date LUS, `identite: null`. La route garde l'e-mail (famille « annonce Leboncoin
supprimée », la même côté app dans `familleEmail` pour les 2 déjà gardés), ne touche à AUCUNE
ligne Leboncoin ni N°, et range UNE notification par jour de Paris (tag
`lbc-suppression-AAAA-MM-JJ`) : catégorie `lbcsuppression`, famille **Rappels**, « ouvre « Mes
annonces » sur Leboncoin pour que VRM relise la liste », ouvre Annonces · Leboncoin
(`DESTINATIONS.lbcAnnonces`). Écriture de l'e-mail ratée ⇒ 503.

## Preuves
- `npm run build` vert.
- Audits neufs (chacun EXÉCUTE ses règles ; les deux routes par `scripts/_faux-inbound.cjs`, une
  fausse base PostgREST dans la forme réelle ; mutations par `scripts/_mutations-audit.cjs`) :
  | audit | après | base 162659a6 (`git archive`) | `--prouve` |
  |---|---|---|---|
  | `audit-vente-verification` | 25 verts | 15 rouges | 8/8 |
  | `audit-lbc-suppression` | 16 verts | 9 rouges | 7/7 |
  | `audit-comptes-emails-ligne` | 12 verts | 6 rouges | 7/7 |
  | `audit-adresse-sans-compte` | 19 verts | 9 rouges | 9/9 |
- Banc `scripts/bancs/vague2-comptes.cjs` (données inventées, `BANC_PORT` 9520 par défaut,
  390 tactile et 1512, clair et sombre) : W1 Comptes liés, W2 adresse sans compte (+ panne),
  W3 Ventes. Chiffres : voir « Résultats du banc » ci-dessous.
- Verts : `email-formes`, `journal-emails`, `boite-emails`, `coque-parametres`,
  `messages-emails-communaute`, `ventes-e2`, `fonctions-api`, `coherence`, `identite`,
  `icones` (et les audits voisins des notifications : `notifications`, `cibles-notif`,
  `notifs-centre`, `compte-pas-relu`, `bilan-semaine`, `flux-divers`…).

## Ce qui reste
- L'étape « Au centre de vérification » n'existe que tant que Vinted dit « Envoi au centre de
  vérification » : aucun autre état du parcours (au centre, vérifié, refusé) n'a été vu chez lui —
  à mesurer à la prochaine vente vérifiée, puis l'ajouter à `auCentreDeVerification`.
- La vente reçue par e-mail (forme vérification) n'a pas de n° de transaction : elle se relie à
  la moisson comme les autres ventes d'e-mail (par la moisson de l'extension).
- Le geste « Relier sa boîte » ouvre l'onglet ; il ne présélectionne pas l'adresse du compte.
- Les 2 e-mails Leboncoin déjà gardés ne sonnent pas (rien n'est rejoué) ; ils sont rangés dans
  leur famille à l'écran.
- La frise de Colis ne connaît pas l'étape (hors zone).
