# Audit SERVEUR — `api/*.js`, `api/_lib/*`, crons, script Gmail, Worker Cloudflare

Arbre : `origin/main` à `f04af748` (branche locale `audit-serveur`, rien de modifié, rien de commité).
Je n'ai rien corrigé. Les défauts déjà listés dans `flux.md`, `utilisateurs.md`, `limites.md`, `plateformes.md` et `securite.md` ne sont pas recomptés : G3 (emails falsifiés), F3 (clés dans l'URL), D18 (widget au-delà de 1 000 vendeurs), A8, A14, « 0 en ligne » du widget, `email_bord_*` jamais purgé, `email_track_*` au-delà de 1 000.

**Comment c'est vérifié.** Chaque fonction a été EXÉCUTÉE contre un faux PostgREST qui sert la vraie forme
(`…/scratchpad/srv/faux-supabase.mjs`). Il calcule `meta` avec la même règle que `public.vrm_meta` (scalaires de 600 octets au plus, `_pdf`, champs `_txn_`), sert `id`/`meta->>`/`data->` avec `eq|neq|like|ilike|in|is.null`, `or=(…)`, la projection `select=` (alias, `->`, `->>`), la pagination `Range` plafonnée à 1 000 avec `content-range`, le PATCH conditionnel, et l'upsert `merge`/`ignore-duplicates`. Les pannes se posent famille par famille, et `web-push` est intercepté, ce qui compte les notifications réellement envoyées.
Bancs : `banc-emails.mjs` (34 emails inventés, `corpus.mjs`), `banc-bord.mjs`, `banc-quarantaine.mjs`, `banc-faux-vente.mjs`, `banc-push.mjs`, `banc-cron.mjs`, `banc-offre-copie.mjs`, `banc-appels.mjs`, tous sous `/tmp/claude-0/-home-user-cancale-v67/f70a9764-046d-5574-bac2-0a1794911434/scratchpad/srv/`.

---

## A. Défauts, du plus grave au moins grave

### S1 — GRAVE · Un email reconnu mais mal lu perd sa pièce jointe, alors que VRM répond « rangé » (200) — **vérifié (banc)**
- **Scénario.** Vinted change une tournure, ou c'est le bordereau d'un autre compte. Exemple : « Bordereau d'envoi » sans n° de transaction lisible, avec son PDF. La branche bordereau échoue et appelle `garderInconnu(…, 'bordereau')`. Comme une `famille` est passée, le plafond tombe à **2 000 caractères** du JSON brut. Ces 2 000 caractères ne contiennent que les en-têtes : le PDF, l'adresse et le texte disparaissent. La route répond 200 et le collecteur classe l'email « confirmé ».
- **Où.** `api/email-inbound.js:2126` (`'bordereau'`), `:2181` (`'vente'`), `:641` (`const plafond = famille ? 2000 : 200000`).
- **Preuve.** `banc-emails.mjs bordereau-illisible` : `brut 2000 octets ; PDF envoyé 40060 octets ; PDF retrouvable : false`.
- **Même chose côté Leboncoin.** « Votre bordereau d'envoi est disponible » passe le test de sujet `/Bordereau\s+d['’]envoi/` (`:2119`), échoue (pas de transaction Vinted), et son PDF est coupé de la même façon (corpus `lbc-bordereau`).
- **Correction.** Ne réduire le plafond que pour les familles « sans action » (newsletter, évaluation…). Un email « reconnu, analyse impossible » se garde entier, pièces jointes comprises (dans la limite de 200 Ko, sinon un 503 plutôt qu'un 200).

### S2 — GRAVE · La quarantaine ne garde AUCUNE pièce jointe ; le rejeu après réclamation ne peut donc pas rendre le bordereau — **vérifié (banc)**
- **Scénario.** Un nouveau vendeur (adresse pas encore prouvée, ou relais iCloud, cf. D6) reçoit un bordereau. L'email part en quarantaine (« on le garde ENTIER », dit le commentaire). Seuls `filename` et `contentType` sont gardés, le contenu ne l'est pas. Le texte est coupé à 20 000 caractères et le HTML à 40 000 (un QR inline en base64 dépasse vite). Quand il réclame l'email, `email-rattacher` rejoue `{from,to,subject,text,html}` sans pièce jointe, sans `messageId` et sans `sourceDate`.
- **Où.** `api/email-inbound.js:1437-1440` (`pieces: … ({ filename, contentType })`), `api/email-rattacher.js:519`.
- **Preuve.** `banc-quarantaine.mjs` : `pièce jointe gardée : [{"filename":"Bordereau-Vinted-15000000001.pdf",…}] · contenu du PDF présent : false`.
- **Aggravant.** Si le vendeur a déjà la ligne `email_bord_{tx}` avec son PDF, ce rejeu sans pièce jointe l'EFFACE (voir S3).
- **Correction.** Garder les pièces jointes (en base64, plafond explicite, sinon 503) et les rejouer, avec `messageId` et `sourceDate`.

### S3 — GRAVE · Un second email « Bordereau d'envoi » du même n°, sans pièce jointe, efface le PDF déjà rangé — **vérifié (banc)**
- **Scénario.** Une copie « TR: » vers une autre boîte (le geste qu'on lui conseille pour ses autres comptes), un transfert iCloud qui perd la pièce jointe, ou le rejeu S2. La ligne `email_bord_{tx}` est réécrite en entier avec `pdfB64: null` et `pdfTamponneB64: null`. Colis perd « Prêt à imprimer ». La même erreur a été corrigée le 29 oct. pour les reçus d'achat (`email_achat_`), pas pour les bordereaux.
- **Où.** `api/email-inbound.js:2150-2156` (upsert `merge-duplicates` de `data` entier, `pdfB64: pdf ? … : null`).
- **Preuve.** `banc-bord.mjs` : `1er … pdf en base: true` puis `2e (copie sans PJ) … pdf en base: false`.
- **Correction.** Relire la ligne et garder `pdfB64`/`pdfTamponneB64`/`filename` quand le nouvel email n'a pas de PDF. Une lecture ratée répond 503, comme pour `email_track_`.

### S4 — GRAVE · Une conversation, une évaluation ou « Commande mise à jour » qui contient « a acheté … X,XX € » devient une VENTE, avec la notification « 💸 Vendu ! » — **vérifié (banc)**
- **Scénario.** Un acheteur écrit « mon frère a acheté la même chez vous à 50,00 € ». Ou une évaluation dit « Ma fille a acheté ces baskets 45,00 € ». La branche vente (`/vendu/i.test(subject) || /a\s+achet/i.test(corpsTexte)`) passe AVANT les branches message et offre et avant `familleConnue`. Il en sort une ligne `email_sale_*` (pseudo « frère », 50 €), une notification « 💸 Vendu ! la même chez vous à — 50.00 € » et `notifierDoubleVente`.
  - Ces lignes alimentent le repli « CA du mois » du widget (`api/widget.js:710`).
  - Elles alimentent aussi l'auto-retrait des annonces de l'app, par titre (`src/App.jsx:41267`).
  - « Commande mise à jour » est marqué « volontairement SANS ACTION, source des faux achats » (`:604-606`), mais n'arrive jamais à cette règle.
- **Où.** `api/email-inbound.js:2275` (test), `:300` (`(\S+)\s+a\s+achet`), `familleConnue` lue seulement à la fin.
- **Preuve.** `banc-faux-vente.mjs` : trois lignes `→ 200 vente email_sale_… | push: 💸 Vendu ! …`.
- **Correction.** Exiger la forme d'un email de VENTE Vinted : expéditeur Vinted, sujet de vente, ligne « X a acheté » en tête de corps. Et passer messages, évaluations et `familleConnue` avant la branche vente.

### S5 — GRAVE · Les ventes eBay (et Vestiaire si on les transfère) deviennent des ventes Vinted ; une vente Leboncoin devient un « colis en transit » — **vérifié (banc)**
- **Scénario.** Le script Gmail transfère `from:(… leboncoin OR ebay …) subject:(… vendu …)` (`scripts/gmail-forwarder.gs:118`).
  - « Vous avez vendu : Nike Air Force 1 44 VRM-58 » donne `email_sale_*` sans plateforme, `designation: "Nike Air Force 1 44 VRM-58 Prix :"`, la notification « 💸 Vendu ! » et la règle double vente.
  - Un email Vestiaire donne une vente « Article — 210 € ».
  - « Félicitations, votre article a été vendu » (Leboncoin) passe par le filet transporteur `colis.*livr` et devient `email_track_autre_*`, statut `transit` : un faux colis.
- **Où.** `api/email-inbound.js:2275` (aucun test d'expéditeur), `:1517-1521` (filet `autre`).
- **Preuve.** `banc-emails.mjs` : `ebay-commande → 200 type=vente … push: 💸 Vendu !`, `vestiaire-vente → 200 type=vente`, `lbc-vente → type=suivi status=transit carrier=autre`.
- **Correction.** Classer d'abord par expéditeur (Vinted / Leboncoin / eBay / Vestiaire). Les ventes non-Vinted se rangent « connu, sans action » (la plateforme a sa propre lecture) et ne vont jamais dans `email_sale_`.

### S6 — GRAVE (si Julien suit le geste demandé) · Le Worker Cloudflare de `docs/email-pipeline.md` poste vers un domaine qui ne répond pas et plante sur toute pièce jointe de plus de ~100 Ko — **vérifié (exécution) / domaine à vérifier**
- La section « Gestes attendus » de CLAUDE.md demande de « recoller le Worker Cloudflare de `docs/email-pipeline.md` ».
  1. Il poste vers `https://usevrm.com/api/email-inbound` (`docs/email-pipeline.md:73`) alors que la production est `vrm.center`. Ici, `usevrm.com` donne un CONNECT 502 sans DNS, alors que `vrm.center/api/sante` répond `ok`. Chaque email lèverait une exception, serait retenté, puis rejeté.
  2. `btoa(String.fromCharCode(...new Uint8Array(a.content)))` étale le tableau en arguments. Exécuté dans node (V8, le moteur des Workers) : à 200 Ko, `RangeError: Maximum call stack size exceeded` ; 60 Ko passe. Un bordereau PDF de plus de ~120 Ko fait échouer l'email à chaque essai.
  3. Rien ne borne la taille : au-delà de 4,5 Mo de JSON, Vercel refuse le corps (413). Le script Gmail, lui, s'arrête à 4 Mo.
- **Correction.** URL `https://vrm.center/api/email-inbound`, clé en en-tête `x-vrm-email-key`. Encodage base64 par tranches (ou `Buffer`/`btoa` sur des morceaux de 32 Ko). Plafond de taille avec rejet temporaire explicite. Et vérifier ce que Cloudflare fait d'une exception (rejet ou nouvel essai) : à vérifier dans sa documentation.

### S7 — GÊNANT · Le rappel « offre au-dessus de ton prix mini » se dit « copie FIDÈLE » de la règle de l'app, mais ne l'est plus — **vérifié (banc différentiel)**
- **Scénario.** Le cron du matin pousse « Une offre au-dessus de ton prix mini — à accepter en 1 tap » pour une offre que l'app ne propose pas :
  - deux offres en attente : l'app ne choisit pas, le serveur prend la dernière ;
  - une offre en livres sterling (§3 International : jamais convertie) ;
  - une offre REFUSÉE dont une capture plus pauvre remontre `status 10` ;
  - un acheteur inconnu (`opposite_user` absent).
- **Où.** `api/ship-reminders.js:388-401` (`offreCouranteServeur`) contre `src/offresVinted.js:26-93` (`offreVintedEnAttente`, celle de l'app, `src/App.jsx:5522`). Aucun audit ne compare les deux textes : le commentaire dit « l'audit compare au besoin ».
- **Preuve.** `banc-offre-copie.mjs`, sur les 4 cas : `app → null · serveur → "2"`, `"1"`, `"1"`, `"1"`.
- **Correction.** Importer `src/offresVinted.js` dans le serveur (module pur, sans JSX) au lieu d'une recopie, ou ajouter un `--recopie` jugé par Babel comme `ventes-regle.js`.

### S8 — GÊNANT · Le widget relit, à chaque rafraîchissement, TOUTES les lignes `email_sale_*` en `select=data`, pour un repli rarement utilisé — **vérifié (lecture + banc)**
- `rows('email_sale_*')` (`api/widget.js:131-133`, appelé `:608`) rapatrie tout l'historique des emails de vente, jamais purgé : nom, adresse et email de l'acheteur compris (~0,4 Ko par ligne). Il ne sert qu'au repli `moneySource:'emails'`, quand la photo de l'app manque (`:710-721`).
  - Avec 3 000 ventes : ~1,2 Mo par appel ; 96 appels par jour (un toutes les 15 min) donnent ~3,5 Go par mois. Le quota d'égress gratuit de Supabase est de 5 Go : c'est la faute de §4.4, encore présente ici.
  - Une seule page ratée dans cette lecture et tout le widget répond 503 (`:619`). Le repli compte en plus les faux S4/S5.
- **Correction.** Projeter `receivedAt:meta->>receivedAt,prix:meta->>prix` filtré sur le mois (`meta->>receivedAt=gte.AAAA-MM`), ou ne lire qu'en l'absence de `widget_stats` du mois.

### S9 — GÊNANT · Cron exécuté deux fois : rappels URSSAF (et rappel du matin) en double — **vérifié (banc)**
- **Scénario.** Vercel peut déclencher deux fois la même tâche planifiée. Le rappel URSSAF du 1er et le rappel du matin lisent le mémo, envoient, puis écrivent le mémo (`api/ship-reminders.js:536-543`, `:620-627`), sans comparer-et-échanger.
  - Le soir écrit avant d'envoyer, mais sans condition non plus (`:780`) : deux passages simultanés lisent tous deux « rien ».
  - Une lecture ratée du mémo du matin (`|| {}`) renvoie aussi le rappel.
- **Preuve.** `banc-cron.mjs double` (deux appels simultanés, 2 vendeurs, aujourd'hui = 1er nov.) : `notifications URSSAF reçues par appareil : 2`.
- **Correction.** Réserver le mémo par `modifierCas` (déjà utilisé pour `push_dedup`) AVANT l'envoi, pour URSSAF, matin et soir.

### S10 — GÊNANT (échelle) · Le cron n'a pas d'horloge globale : au-delà de ~100 vendeurs actifs, les derniers n'ont rien — **vérifié en partie (banc), durée max à vérifier**
- 8 vendeurs à la fois (`:57`). Chacun peut prendre jusqu'à 20 s (relecture eBay `:473` et transporteurs `BUDGET_CRON_MS` 20 s, en parallèle).
  - Au mieux ~8 vendeurs toutes les 20 s, soit ~120 vendeurs dans 300 s. Rien ne s'arrête avant la coupure : le cron est tué en plein milieu, sans réponse, et les rappels des vendeurs de queue ne partent pas.
  - Banc sans eBay ni transporteur (60 ms par requête) : 202 vendeurs en 31 s, 33 requêtes par vendeur.
  - La relecture eBay n'a pas d'`AbortController` (`api/_lib/ebay-relecture.js:69-84`), contrairement aux transporteurs (corrigé le 29 oct.) : elle continue d'écrire après le minuteur.
- `vercel.json` ne fixe aucun `maxDuration`. Le projet n'est pas lisible depuis ici (Vercel MCP : 404). **À vérifier** : Fluid compute (300 s) ou ancien mode Hobby (10 s par défaut). Dans ce second cas, même un seul vendeur avec eBay dépasse.
- **Correction.** Une échéance globale : chaque ouvrier s'arrête avant ~270 s et le bilan nomme les vendeurs non traités. Plus un `signal` pour la relecture eBay, et `maxDuration` explicite dans `vercel.json`.

### S11 — GÊNANT · Relais Colis / InPost « votre colis vous attend… Code : 5521 » rangé « info », sans notification ni « à retirer » — **vérifié (banc, formes inventées) ; forme réelle à vérifier**
- Le statut est bien lu `available`, puis rabaissé en `info` parce qu'aucun n° de suivi n'est trouvé (`api/email-inbound.js:892-896`).
  - Les motifs ne lisent que `\d{8,14}`, `[A-Z]{2}\d{9}[A-Z]{2}` (Chronopost), `VGS…`, ou « n° de suivi : X » sur 6 à 20 caractères (`:858-879`).
  - Un n° InPost (24 chiffres) ou Relais Colis alphanumérique commençant par un chiffre ne passe pas.
  - La ligne garde code, lieu et date limite, mais ne sonne pas et n'est pas comptée.
- **Preuve.** `relaiscolis → status=info … "code":"5521","lieu":"PRESSING DU PORT…","limite":"2026-11-15"`, `inpost → status=info … "code":"123456"`.
- **Correction.** Mesurer les vrais emails Relais Colis et InPost, puis ajouter leurs formats de n°. Sinon, ranger « à vérifier » (visible) plutôt que « info ».

### S12 — GÊNANT · Une écriture ratée répond bien 503, mais la notification est déjà partie — **vérifié (banc)**
- Vente, colis, offre, finalisation, bordereau : `supabaseUpsert` échoue, la notification part quand même, puis la route répond 503.
  - Le vendeur touche « 💸 Vendu ! » ou « 📍 Colis arrivé » et l'app ne montre rien tant que le service n'a pas rejoué.
  - La clé de dédoublonnage est déjà consommée : le rejeu, lui, ne sonne pas.
  - Si le rejeu n'arrive jamais (Worker S6), la notification a été le seul signe de l'email.
- **Preuve.** `banc-emails.mjs ecriture-ko` : `vinted-vente email_sale_* → 503 · push malgré tout : 1` (idem colis, offre, finalisation) ; `banc-bord.mjs` : `écriture KO 503 … push 1`.
- **Correction.** N'appeler `pushOnce` qu'après une écriture confirmée (`ecritureRatee()` faux).

### S13 — DÉTAIL · Rejeu (503, reprise du script) : les emails non reconnus et la quarantaine se dédoublent à chaque essai — **vérifié (banc)**
- Les clés comprennent `Date.now()` : `email_inconnu_` (`:642`) et `email_quarantaine_` (`:1419`). Chaque renvoi du même Message-ID crée une ligne de plus (jusqu'à 200 Ko chacune), et la liste « à réclamer » montre des doublons.
- Le reste est idempotent : vente, bordereau, colis, message et offre ne créent aucune ligne et aucune notification au rejeu.
- **Preuve.** `banc-emails.mjs rejeu` : `stripe-facture … rejeu + 1`, `vinted-annulation … rejeu + 1`, `vinted-bordereau (illisible) … rejeu + 1` ; `banc-quarantaine.mjs` : `2 lignes pour 2 envois du MÊME email`.
- **Correction.** Clé = empreinte du Message-ID (`empreinteEmail`, déjà calculée), sinon du corps.

### S14 — DÉTAIL · Journal des emails : deux emails traités en même temps, une entrée perdue — **vérifié (banc)**
- `logEmail` lit, fusionne et réécrit `email_journal` sans version (`api/email-inbound.js:654-670`). Le script envoie un email à la fois, mais le Worker et le rejeu de réclamation peuvent tourner en même temps.
- **Preuve.** `banc-emails.mjs concurrence` : `5 traités · entrées du journal : 4`.
- **Correction.** `modifierCas('email_journal', …)`.

### S15 — DÉTAIL · Une notification trop longue est perdue sans que rien ne le dise — **vérifié (banc)**
- `sendPushToAll` n'impose aucune taille (`api/_lib/push.js:326-360`) ; titre et texte de 5 000 caractères donnent 20 Ko envoyés. Un service push refuse au-delà de ~4 Ko (413). Ce code ne vaut ni « mort » ni « clé morte » : l'appareil est gardé, `sent` n'augmente pas, et rien n'est signalé.
- Les textes non bornés : vente (`data.designation`, `:2289`), bordereau (`data.modele`, `:2157`).
- **Correction.** Couper titre et texte dans `sendPushToAll` (par exemple 120 et 300 caractères).

### S16 — DÉTAIL · Le mode « factures » du script Gmail renvoie toutes les factures en attente avec leurs PDF : au-delà de 4,5 Mo, plus aucune ne part — **vérifié par lecture**
- `api/email-inbound.js:1826-1838` : `email_invoice_*` en `select=id,data` sans `limit`, `retourB64` et logo compris. Une file de quelques dizaines de factures dépasse la limite de réponse de Vercel. Le script logue « VRM a répondu 500 — rien envoyé » à chaque passage.
- **Correction.** Paginer (`limit=10`) ou renvoyer les PDF facture par facture.

### S17 — DÉTAIL · Messages Leboncoin notifiés comme des messages Vinted ; litiges et annulations Vinted rangés « ignoré » — **vérifié (banc, formes inventées)**
- « Nouveau message concernant « Nike Dunk Low 43 » » (Leboncoin) donne `type=message`, avec un lien vers la conversation Vinted (`DESTINATIONS.message`).
- « Un problème a été signalé sur ta commande… Réponds dans les 2 jours ouvrés » donne `type=ignoré`. Il est conservé, sans notification, alors qu'il demande une action : la branche 7 ne le reconnaît pas.
- **À vérifier** sur les vrais emails (formes non mesurées).

### S18 — DÉTAIL · Deux commentaires d'horaire sont faux
- `api/ship-reminders.js:279` dit « cron du matin (10 h à Paris) ». `vercel.json` a `0 5 * * *`, soit 7 h l'été et 6 h l'hiver (`:3` le dit bien). Les jours, eux, sont pris en heure de Paris (`parisDate`, `toLocaleDateString('en-CA',{timeZone:'Europe/Paris'})`) : le changement d'heure du 25 octobre ne décale aucune date.

---

## B. Copies serveur des règles de l'app (`api/_lib/*-regle.js`) — relancées

| audit | résultat |
|---|---|
| `audit-bilan-semaine.cjs` (`ventes-regle.js`, jugé par Babel au jeton près) | ✅ 48/48, à jour |
| `audit-rappel-urssaf.cjs` (`urssaf-regle.js`) | ✅ tout vert, à jour |
| `audit-statuts.cjs` (`aExpedier` : app = extension = widget) | ✅ |
| `audit-fonctions-api.cjs` (12 fonctions, réécritures `/api/rappel-soir`, `/api/sante`…) | ✅ |
| `audit-push`, `audit-email-formes`, `audit-routes-revue` (33/33), `audit-email-cle`, `audit-journal-emails` (58), `audit-transp-notif`, `audit-transporteurs`, `audit-statut-transporteurs`, `audit-proprietaire-email`, `audit-email-rattacher`, `audit-codes-retrait`, `audit-vintedgo-adresse` (32/32) | ✅ |
| `audit-offres-email.cjs` | ❌ 1 rouge, côté app : « les conversations et leurs offres restent rendues » (motif cherché dans App.jsx) |

**Pas couvert par un `--recopie`** : `offreCouranteServeur` (S7, diverge). C'est la seule copie à la main trouvée côté serveur.

## C. Requêtes au chargement (banc `scripts/bancs/vitesse.cjs`, build de cet arbre, base au volume)

| écran | lectures | octets | en double | balayages des transactions | contrôles du banc |
|---|---|---|---|---|---|
| Ma journée 390 px | **70** (plafond 62) | 2,3 Mo | 6 | **3** (plafond 2) | ❌ ×4 (dont rendus 15/12/14 > 13, brouillons eBay lus) |
| Ma journée 1512 px | 62 | 2,2 Mo | 0 | 2 | ❌ brouillons eBay lus |
| Colis (`cat_bord`) 390 / 1512 px | 81 / 81 | 2,3 Mo | 2 / 3 | **3** / **3** | ❌ balayage ×3 |

- **Doublons au téléphone** : `harvest_%_txn_%` (77 Ko + 14 Ko) lu deux fois de suite, plus `orders_sold` (cap), `vrm_blocked_accounts`, `relais_ext`, `panel_accounts_off`.
- **Lourd sur Ma journée** : `coffre_*` avec `desc` (668 Ko), lu à l'ouverture alors qu'il sert à Republier. `harvest_*_orders_* select=id,data` (447 Ko). `email_track_* select=id,data` : en base réelle, chaque ligne porte `qrB64` (une image), et la lecture a lieu à chaque ouverture.
- Ces défauts sont côté app, mesurés à la demande ; les plafonds du banc sont ceux du dépôt, rouges sur `main`.

## D. Vérifié sans défaut (pour ne pas y revenir)

- **Encodages et formes.** Quoted-printable MIME brut, sujet `=?UTF-8?Q?…?=`, HTML seul avec `<style>`, sujets en MAJUSCULES et emoji, email vide : lus, et conservés quand ils sont inconnus.
- **Classement juste dans le corpus.** Vinted vente, finalisation, achat, offre, message, favori, évaluation et virement bancaire ; Mondial Relay, Chronopost (disponible puis livré, même ligne), Vinted Go (`VGS…`, code `C49341`), Colissimo, UPS, DPD.
- **Rejeu du même Message-ID.** Vente, bordereau, colis, message et offre : aucune ligne ni notification de plus.
- **Écriture ratée.** La route répond 503 dans tous les cas où une ligne métier est écrite.
- **Push.**
  - Un 410 retire l'appareil, et l'autre est gardé.
  - Un 403 « VAPID … do not correspond » est compté `perimes` et purgé.
  - Les autres erreurs gardent l'appareil.
  - Les abonnements s'écrivent par comparer-et-échanger.
- **Crons.**
  - Un vendeur qui lève une exception n'arrête pas les autres : la réponse 500 porte les bilans.
  - La liste des vendeurs est paginée par `Range`.
  - Le soir n'envoie qu'un mémo confirmé.
- **Script Gmail.** Plafond de 4 Mo. Accusé nominatif exigé (`accuseValideVRM`) avant de classer. `vrm-a-reessayer` est repris, et le nettoyage ne fait qu'archiver.
