# 12 nov. 2026 — Sécurité des comptes (second agent, `claude/agent2-securite-comptes`)

Validé par Julien le 12 nov. (points 1, 2, 7, 8, 9 de sa liste « sécuriser mes comptes »).
Pas d'extension (les points extension sont faits ailleurs). Complète `claude/securite-vinted`
(module commun des gestes, ext. 5.366) sans rien y refaire : ce lot ne touche que l'app et
trois routes serveur. `securite-revue`, `alerte-moderation`, `sante-comptes` : déjà dans `main`,
rien de commun.

## 1. Les mots qui font bannir — dans les messages (`src/messageSur.js`)
Une règle, un propriétaire. `risquesMessage(texte, site)` relève : numéro de téléphone (06 12 34 56 78,
+33…, « par SMS »), e-mail (adresse, « gmail », « arobase »), lien vers un autre site (un lien
vinted.fr/leboncoin.fr/… n'en est pas un), paiement hors plateforme (PayPal, virement, Lydia, RIB,
Paylib, Wero, espèces), autre messagerie (WhatsApp, Telegram, Snap, Insta, Messenger), vente hors
plateforme (« en dehors de Vinted », « paie-moi directement », « évite les frais »), main propre
proposée — **sauf sur Leboncoin**, où le site la prévoit.
Faux positifs évités : une pointure, un prix, une date, un n° de suivi, « téléphone portable
Samsung » (un titre), une négation dans la même phrase (« je ne fais pas de main propre »,
« je n'accepte pas PayPal ») ; une virgule arrête la négation (« pas de souci, PayPal ami » compte).
- **Envoi à la main** (Vinted, Leboncoin, Vestiaire, eBay — tous par `ComposeConv`, plus la
  réponse eBay de « Tous les fils ») : la ligne ambre sous le champ PENDANT la saisie, puis la
  feuille « <Site> bannit pour ça : sortir la vente de la plateforme » (la feuille « vérifier » de
  la publication, lignes ambre, rien à couper) ; l'envoi part seulement sur « Envoyer quand même »
  (`verifierMessageAvantEnvoi`, App.jsx). Un message sûr part comme avant.
- **Message automatique** : jamais envoyé.
  - Favoris : `preparerMessageFavori` refuse (« Ce message ne partira jamais tout seul : retire ce
    mot. ») — dit dans l'éditeur à la saisie, l'enregistrement et « Continuer » restent fermés ; le
    serveur refuse aussi (`validerReglagesFavoris` au lancement ; le mode auto s'arrête AVANT de poser
    un message : `stop('message_risque')`, demande dite dans l'écran et en notification).
  - Refus automatique d'une offre : `ecrireRefusMsg` ne range jamais un texte risqué dans
    `vinted_offre_refus_msg` (l'extension refuse alors SANS message) ; le champ garde ce qu'il a tapé,
    dit en ambre ; un texte risqué déjà rangé est vidé au chargement.
  - **Variantes** (`agent2-ecriture-humaine`, pas encore dans `main`) : à brancher à l'intégration —
    chaque variante passe par `erreurMessageAuto(texte)` dans l'éditeur, et une variante risquée n'est
    jamais tirée. Noté dans COORDINATION-AGENTS.md.

## 2. Les mots qui font supprimer une annonce
`risquesAnnonce` = la même famille (coordonnées, paiement, messagerie, hors plateforme, main propre
sauf Leboncoin) + la contrefaçon : réplica, réplique, fake, dupe, imitation, contrefaçon, copie (pas
« copie de la facture »), 1:1, non/pas authentique, inspiré de (pas « des années 80 »), type/style/façon
<marque> (liste de ~45 marques), « UA batch ». Branché dans `problemesAnnonce` (src/verifAnnonce.js),
donc partout où « vérifier avant de publier » existe : Publier Leboncoin, Préparer/Publier eBay,
Préparer Vestiaire, Republier, Publier partout. Sur le titre et la description qui PARTIRONT (ce qui
est su seulement). En tête, ambre, avec « Retire-le du titre ou de la description » ; jamais bloquant
(« Publier quand même »), jamais coupable (« Ne plus me le dire » absent : le code `motsRisque` n'est
pas dans `NOMS_ALERTES`).

## 7. Copie des annonces par compte (`src/copieAnnonces.js`, `src/CopieAnnonces.jsx`)
Paramètres → Mes comptes → « Copie de mes annonces » : une ligne par compte Vinted, « Télécharger ».
Le zip est fait dans le navigateur (`zipStocke`), partagé ou téléchargé, envoyé nulle part :
`VRM-annonces-<pseudo>-<date>/` avec `annonces.csv` (N°, titre, prix, devise, état, description, lien,
photos), `LISEZ-MOI.txt` et `photos/N12-1.jpg…`. Le N° vient de l'identifiant d'annonce
(`vinted_annonce_numeros`), jamais du titre. Description pas lue ⇒ cellule vide et « N sur M » dit ;
photo illisible ⇒ comptée et dite, le zip part quand même. Lecture seule (aucun `save`, aucun POST,
photos lues sans cookie). Leboncoin/Vestiaire : pas encore (le dressing Vinted est la source).

## 8. « Protège ton compte VRM » (`src/CarteDoubleVerif.jsx`)
Une carte discrète en haut de Paramètres, seulement si la double vérification est LUE inactive
(`session.totp` = liste vide ; pas de liste = pas su ⇒ rien). Trois étapes (app de codes, scanner,
taper le code) ; « Activer » ouvre le panneau existant (Compte → Double vérification) ; « Plus tard »
la range pour de bon sur cet appareil. Jamais au démarrage (décision du 21 oct.).

## 9. Jetons Vinted jamais renvoyés au navigateur
Mesuré avant : `api/vinted-proxy.js` rendait `refreshed: { access_token, refresh_token }` à la page
(H1 de la revue), `api/vinted-connect.js` rendait `tokens` hors extension (H2) ; les deux rendaient
aussi `detail: String(err)` ; la page relisait `vinted_accounts?select=*` (jetons, csrf, anon_id compris).
`securite-vinted` n'y avait pas touché. Maintenant :
- le relais range lui-même les jetons renouvelés (3 essais, sa session, filtré sur lui) et ne rend que
  `refreshed: { persiste }` ; page HTML coupée à 2 Ko ; plus de `detail` ;
- `vinted-connect` rend `{ ok, account }` (pseudo, photo, domaine), jamais les jetons ;
- `vinted-refresh` : plus de `detail` ;
- l'app lit la liste des comptes projetée (`id,owner,vinted_user_id,login,domain,created_at,updated_at`,
  colonnes mesurées sur la vraie base en lecture seule) et nettoie une ligne qui en porterait ;
  `persistRefreshedTokens` ne réécrit plus rien, l'état React n'en range plus. Aucune fonction de l'app
  ne lisait ces jetons (vérifié : seuls la persistance et le gestionnaire d'état les touchaient ;
  l'extension garde les siens et n'attend que `account`).

## Preuves
- `node scripts/audit-message-sur.cjs --prouve` : 60 phrases inventées (36 risquées, 24 sûres),
  intégration exécutée (verifAnnonce, favoris, tour auto du serveur) et chemins d'envoi ; 10/10 mutations.
- `node scripts/audit-jetons-vinted.cjs --prouve` : les trois routes EXÉCUTÉES dans 10 chemins (lecture,
  renouvelé rangé, écriture ratée, Vinted injoignable, liaison app/extension, base coupée, renouvellement
  global), chaque réponse fouillée ; la liste des comptes de l'app exécutée ; 6/6 mutations.
- `node scripts/audit-copie-annonces.cjs --prouve` : zip relu, N° par identité, « pas su » dit, carte
  MFA à trois états ; 5/5 mutations.
- Sur `origin/main` (git archive) : message-sur 12 rouges, jetons-vinted 10, copie-annonces 8 ; le
  banc `proxy.cjs` mis à la règle : 3 rouges sur `main`.
- Banc `scripts/bancs/securite-comptes-avertir.cjs` (390 tactile et 1512, clair et sombre) : saisie
  ambre, feuille, « Corriger » sans envoi, « Envoyer quand même » = une commande, message sûr sans
  feuille ; carte MFA, « Plus tard », zip téléchargé sans écriture en base. Captures regardées.
- Bancs/tests touchés relancés : `proxy.cjs`, `routes-ecriture.cjs`, `isolation-comptes`,
  `reglages-favoris`, `favoris-*` ; audits variables, tdz, coherence, identite, icones, traduction,
  verif-annonce, favoris-*, offres-*, politique-hotes, chrome-en-dur, textes-courts.

## Ce qui reste
- Variantes de `agent2-ecriture-humaine` : brancher `erreurMessageAuto` à l'intégration.
- Copie des annonces Leboncoin / Vestiaire.
- La carte MFA se range par appareil (`localStorage`) ; la mettre dans `SYNC_KEYS` si Julien veut
  « une fois pour toutes ».

## Gestes de Julien
Aucun.
