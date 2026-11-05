# DAC7 compte par compte — 5 novembre 2026 (branche `v31-dac7-comptes`)

Demande de Julien (pages manuscrites du 5 nov., §8, et vocal) : « les rapports DAC7 dans VRM,
pour chaque compte » ; « tout ce que tu peux capter par les comptes Vinted, il faut le prendre ».

## Ce qui a été mesuré AVANT de coder (base de production, lecture seule, SELECT uniquement)

- **Ventes par compte et par plateforme, année 2026** (lignes `harvest_{uid}_orders_sold`,
  `lbc_ventes`, `vc_ventes`, `ebay_orders`) :
  - Vinted : plusieurs comptes au-dessus de 30 ventes finalisées dans l'année (108, 76, 57, 55,
    47, 40, 37, 32…), d'autres en dessous (24, 19, 1). Une ligne porte exactement 2 000 commandes
    : liste probablement plafonnée par la capture — c'est un
    autre propriétaire de la base, rien n'a été lu au-delà du compte.
  - Leboncoin : un compte, 3 ventes prouvées (`isSeller: true`) datées 2026,
    178 € ; les autres transactions sont des achats ou sans côté connu.
  - Vestiaire : 1 vente, **sans compte relevé** (`compte: ""`) ⇒ carte « Compte non identifié ».
  - eBay : 0 commande.
- **Un rapport DAC7 envoyé par une plateforme est-il arrivé ?** Non, nulle part :
  - e-mails : sujets de 3 243 e-mails (`email_inconnu_*`, `email_reception_*`,
    `email_quarantaine_*`) relus pour « fiscal », « impôt », « tax », « déclar », « DAC »,
    « rapport », « relevé », « annuel », « informations » : **0** (le seul « dac7 » trouvé dans
    `email_*` était un morceau de hachage dans une URL de QR code) ;
  - documents captés : aucune ligne fiscale. Chez Vinted, l'extension a seulement relevé que les
    pages `/settings/taxpayer`, `/settings/taxpayer_center` et
    `GET /api/v2/wallet/income_reports/settings` ont été **visitées** (`harvest_*_seen_urls`),
    jamais leur contenu ;
  - le porte-monnaie Vinted capté (`harvest_{uid}_billing`, forme « relevé ») porte
    `payload.taxpayer_restricted` sur 2 comptes (les deux : `false`) ;
  - Leboncoin : son interface captée (`lbc_catalogue`) renvoie vers son article d'aide
    « Le rapport DAC7 » (`https://assistance.leboncoin.info/hc/fr/articles/14847662938898-Le-rapport-DAC7`)
    et parle d'« Informations fiscales manquantes ».

## Ce qui est livré

Comptabilité → 3. Le détail → repli **« DAC7 »** (rendu même replié, comme les autres) :

- **une carte par compte et par plateforme** (Vinted, Leboncoin, eBay, Vestiaire) : ventes
  `N / 30` et montant `/ 2 000 €` avec une barre chacune, le verdict par le MOT (« Au-dessus du
  seuil » en gras · « Sous le seuil » · « Au-dessus si les ventes à dater comptent » ·
  « Pas encore sûr »), « au moins » et le manque NOMMÉ (« Il manque 1 vente pas encore datée
  (45,00 €) », « N ventes au montant illisible »), « Encore N ventes ou X € » quand rien ne
  manque ; « — » quand la lecture de la plateforme ou de CE compte a échoué ; « … » en cours ;
  un compte connu sans vente d'une plateforme lue : « 0 / 30 » ;
- **le rapport de la plateforme** : reconnu dans les e-mails reçus le jour où il arrive
  (« Rapport reçu le … » + sujet + adresse de réception), sinon **où le trouver** — lien vers
  Vinted → Paramètres → Informations fiscales (`/settings/taxpayer_center`, chemin vu), l'aide
  Leboncoin « Le rapport DAC7 » (lien donné par Leboncoin), une phrase sans lien pour eBay et
  Vestiaire (aucun lien vu, aucun inventé). Les autres e-mails fiscaux de la plateforme
  (demande d'informations fiscales) sont listés en dessous ;
- **Vinted bloque ce compte** (`taxpayer_restricted: true` dans le porte-monnaie) : dit en ambre
  sur la carte, avec « Les remplir sur Vinted ↗ » ; `false` : « aucun blocage chez Vinted · lu le … » ;
  absent : rien ;
- **export par compte** : PDF et tableur (`DAC7-{année}-{plateforme}-{compte}.pdf|csv`) —
  résumé (ventes, montant, verdict, manque), une ligne par vente (date, montant, référence, N°
  par identité, article), total = la partie sûre, puis « Pas comptées dans le total » (pas
  encore datées, montant illisible). L'en-tête dit « ce n'est pas le rapport de {plateforme} » ;
- **l'année** : sélecteur année en cours / année d'avant (le rapport de 2026 arrive en janvier 2027) ;
- **comptes exclus des totaux** (Vinted masqué/décoché, Leboncoin/eBay/Vestiaire écartés dans
  Comptes liés) : aucune carte, comptés nulle part, nommés en bas (« Pas comptés, exclus de tes
  totaux : … »).

### Les règles (une notion, un propriétaire — §11)

- `src/seuilsAnnee.js` : `atteintDac7` et `verdictDac7` exportés — LA règle DAC7 (30 ventes OU
  plus de 2 000 €, centimes entiers ; « sous » seulement si rien ne manque). La carte « DAC7 par
  plateforme » de « Tes seuils » l'utilise désormais aussi (même comportement, audit 20/20).
- `src/dac7Comptes.js` : `indexComptesVentes` (le compte que la vente PORTE :
  `_acc.vinted_user_id`, `compteDeVente` d'`api/_lib/comptes-exclus.js` pour les autres ; sans
  compte ⇒ « compte non relevé », jamais deviné), `dac7ParCompte` (rangement des lignes de
  `ventesDeclarables` — la MÊME lecture que le CA déclaré et les registres :
  `useDeclarablesCompta`), `classerEmailFiscal` (plateforme par l'EXPÉDITEUR, nature par le
  sujet), `anneeConcernee`, `emailsFiscaux`, `blocagesFiscauxVinted`, `csvDac7`, `pdfDac7`.
- Pas encore datées : une vente Vinted finalisée sans date de versement compte « peut-être » dans
  l'année si sa date de vente + `VERSEMENT_MAX_J` (45 j, la borne de la carte « Ce que Vinted
  transmet ») y tombe ; sans aucune date, elle rend le compte « au moins ».
- Lectures : les sujets d'e-mails fiscaux sont filtrés **par la base**
  (`or=(data->>subject.ilike.*mot*,…)`, la même forme que `api/email-inbound.js`) et
  **projetés** (`id,s,f,to,at`), paginés (`lireTout`) ; le porte-monnaie projeté
  (`tr:data->payload->>taxpayer_restricted`). Jamais `select=data`. Une lecture ratée ⇒
  « Rapport : e-mails pas lus », jamais « pas encore reçu ».

Aucune fonction `api/` ajoutée ni modifiée, aucune migration, rien dans `vinted-sync-extension/`.

## Preuves

- `npm run build` vert.
- `node scripts/audit-dac7-comptes.cjs` : **40 verts** — EXÉCUTE la chaîne de l'app
  (`declarablesCompta` → `ventesDeclarables` extraites dans un vm) puis le module ; seuil
  (30 ventes, 2 000,00 € pile = sous, 2 000,01 € = au-dessus), compte par identité (Leboncoin
  avec et sans `lbc-account:`, vente sans compte ⇒ « non relevé »), versement (vendue 2025 /
  versée 2026 ⇒ 2026), pas encore datées (atteintSi, jamais dans la partie sûre ; vendue en
  2024 ⇒ hors 2026), montant illisible ⇒ jamais « sous », lectures ratées ⇒ « — », compte exclu
  dit et compté nulle part, e-mails (expéditeur, rapport vs demande, année), blocage fiscal,
  tableur et PDF relus (même total, même nombre).
  `--prouve` : **11 mutations, toutes rouges**. Sur le code d'avant : rouge (module absent).
- `node scripts/audit-seuils-annee.cjs` : 20 verts (refactor de `verdictDac7`), ses 4 mutations
  DAC7 toujours rouges ; `audit-seuils-vinted`, `audit-coherence`, `audit-fonctions-api`,
  `audit-urssaf`, `audit-comptes-exclus`, `audit-icones` verts.
- Banc de rendu `scripts/bancs/dac7-comptes.cjs` (données inventées, `BANC_PORT=7983`,
  1512 px et 390 px tactile, clair et sombre) : **78 verts** ; sur le code d'avant
  (`git archive` de la base, banc copié dedans) : **5 rouges** ; mutation de l'écran (« Pas encore
  sûr » remplacé par « Sous le seuil ») : **4 rouges**. Captures regardées (1512 clair/sombre,
  390 clair/sombre).
- Constaté, pas de mon fait : `audit-registres` a 2 rouges sur cette machine (pdfjs-dist absent
  de `node_modules`) ; `fusion-echelle --verifier` signale 4 feuilles d'avant
  (`fusion.css`, `styles-bureau.css`, `styles-chargement.css`, `styles-parcours.css`) ;
  `src/design/dac7.css` est dans l'échelle.

## Gestes de Julien

- Ouvrir Comptabilité → Le détail → « DAC7 » et relire ses comptes (surtout ceux au-dessus).
- Fin janvier : quand une plateforme envoie son rapport DAC7, s'assurer que l'e-mail arrive dans
  la boîte qui transfère à VRM (il apparaîtra alors sous « Rapport reçu »).
- Sur Vinted, ouvrir Paramètres → Informations fiscales sur chaque compte : la page a déjà été
  visitée, mais l'extension n'en lit pas encore le contenu.

## Ce qui reste

- **Extension** (pas touchée ici, consigne) : capter la réponse de
  `/api/v2/wallet/income_reports/settings` et du centre fiscal Vinted (`taxpayer_center`) — le
  rapport DAC7 téléchargeable par compte — et `taxpayer_restricted` sur la forme
  `main/escrow` du porte-monnaie (seule la forme « relevé » le porte aujourd'hui). Une forme
  pas encore mesurée ne s'écrit pas : il faut d'abord la relever sur un compte.
- `api/email-inbound.js` ne range pas encore un e-mail DAC7 à part (il tombera dans
  `email_inconnu`, où la section le trouve par son sujet). Un lecteur dédié se fera sur un
  vrai e-mail reçu, pas sur un sujet deviné.
- Vestiaire : la vente mesurée n'a pas de compte relevé (`vc_session` jamais écrit) — elle reste
  sur « Compte non identifié » tant que l'extension 5.295+ n'a pas vu `/users/me`.
- eBay et Vestiaire : aucun lien vers leur rapport tant qu'aucun n'a été vu.
