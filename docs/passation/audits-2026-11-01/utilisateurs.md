# Audit « un autre vendeur que Julien » — VRM, 1er novembre 2026

Base auditée : `origin/main` à `f04af748` (branche locale `audit-utilisateurs`, rien commité, rien poussé).
Angle : Sophie, revendeuse, découvre VRM, s'inscrit, n'a ni l'extension, ni emails branchés, ni Leboncoin/eBay.

Moyens employés :
- lecture du code (`src/`, `api/`, `supabase/migrations/`, `scripts/gmail-forwarder.gs`, `docs/emails/boite-collective.md`) ;
- production, en lecture seule : `GET https://vrm.center/api/sante`, `GET /legal/editeur.js`, `GET <supabase>/auth/v1/settings` (réglages publics d'authentification) ;
- audits existants : `audit-abonnement` (103 verts), `audit-lancement` (31 verts), `audit-routes-revue` (33 verts) ;
- bancs existants : `premierjour` (87 verts), `inscription-fiable` (tout vert) ;
- **un banc jetable** : `/tmp/claude-0/-home-user-cancale-v67/f70a9764-046d-5574-bac2-0a1794911434/scratchpad/audit-final/banc-nouveau.cjs`. Il simule une vendeuse inventée (sophie@exemple.fr), une base vide et aucune extension, et rend 25 écrans à 1512 px. Les textes et captures sont dans `.../audit-final/rendu/` et `.../audit-final/rendu2/`. Aucune page ne lève d'erreur JS.
- Note : le projet Supabase accessible par l'outil MCP est « mes-sejours », pas la base de VRM. Je n'ai donc **pas pu vérifier la base de production** (RLS en vigueur, `abonnement_obligatoire`, 023 appliquée ou non, SMTP).

Légende : **vérifié** = constaté dans le code, la prod ou un rendu ; **à vérifier** = déduit, pas observé.

---

## Ce qui tient (vérifié, pour éviter de chercher là)

- **Cloisonnement des données (code)** : la clé primaire est `(owner, id)` (001 §2c). La RLS `owner = auth.uid()` s'ajoute à des politiques restrictives (004, 006, 021). Toutes les lectures serveur avec la clé de service passent par `duVendeur` (`api/_lib/owner.js:34`), qui **lève une erreur** s'il n'y a pas de vendeur, ou par `scoped` (widget) ou `pourCeVendeur` (push). Les seules lectures « tous vendeurs » ne projettent que des scalaires d'identification : `widget.js:107` (owner + jeton), `compte.js:959` (Discord vérifié, email masqué), `ship-reminders.js:105` (liste des owners). `vinted-proxy`/`vinted-refresh` filtrent par `u.id`. Je n'ai trouvé **aucune fuite** de données d'un vendeur vers un autre. La politique réellement active en base reste **à vérifier**.
- **Emails** : le propriétaire se décide par l'adresse de réception **prouvée**. `repliInstallation` rend toujours `false`, donc un email non attribué va en quarantaine, jamais chez Julien (`api/_lib/proprietaire-email.js:160-200`).
- **Changement de compte sur le même navigateur** : `wipeLocalData` efface toutes les clés `vinted_|vrm_|cancale`, et toutes les clés de données du code portent ces préfixes (grep vérifié). La réserve de QR est vidée et le service worker ne met jamais `/api/` en cache. Le `sessionStorage` (`vrm_acct_cache`) n'est **pas** vidé, mais chaque entrée est rejetée si la liste de comptes diffère (`App.jsx:42704`) : pas de fuite constatée.
- **Inscription** : le banc `inscription-fiable` est vert. Les erreurs GoTrue sont traduites. Le paiement fermé est dit sans prix trompeur (« Le paiement n'est pas encore ouvert : VRM reste gratuit pour l'instant. »).
- **Vendeur sans extension** : Ma journée, Annonces, Achats, Messages et Comptes liés disent tous « Aucun compte Vinted lié — installe l'extension… », avec le geste (banc jetable).

---

## Défauts

### D1 — Une adresse Gmail ne peut pas être transférée vers VRM sans intervention manuelle de Julien · **BLOQUANT** (pour les utilisateurs Gmail) · vérifié (code + doc)
- **Scénario** : Sophie suit Paramètres → Réception des emails → étape 4 « Transfert ». Elle ajoute `vrm.vinted35@gmail.com` comme adresse de transfert dans Gmail. Gmail envoie le code de validation **à vrm.vinted35@gmail.com**, pas à elle. L'écran lui dit pourtant « Valide le transfert si ta messagerie le demande » (`src/ConfigurerTransfert.jsx:27`), ce qu'elle ne peut pas faire.
- **Preuve** : `scripts/gmail-forwarder.gs:94-99` (`confirmationTransfertVRM`) pose seulement un libellé, avec le commentaire « Aucun lien de validation n'est ouvert automatiquement ». `docs/emails/boite-collective.md` : « l'administrateur vérifie à qui appartient la demande ». Rien ne prévient Julien qu'une demande attend, et rien ne dit à Sophie d'attendre.
- **Correction** : dire à Sophie que la validation Gmail est faite par VRM sous 24 h (et prévenir Julien par push quand un email `forwarding-noreply` arrive), ou préférer un filtre Gmail avec transfert vers une adresse `@vrm.center` (Worker Cloudflare) qui n'exige pas de code.

### D2 — Les liens de preuve d'adresse et les factures Pro dépendent d'un script que Julien n'a pas encore recollé · **BLOQUANT** (pour tout autre vendeur, tant que le geste n'est pas fait) · vérifié (code + CLAUDE.md « Gestes attendus »)
- **Scénario** : Sophie déclare son adresse. Le lien de confirmation est envoyé **par le script Gmail collectif** (`preuves-a-envoyer`, `api/email-inbound.js:1725`). CLAUDE.md : « l'ancien script lit encore la base avec l'ancienne clé : aucune facture Pro ni lien de preuve d'adresse ne part ». Sans preuve, **tous ses emails partent en quarantaine** (`api/_lib/preuve-adresse.js:29-33`) : ventes, bordereaux, codes de retrait.
- **Seule échappatoire** : son adresse Vinted = son adresse de connexion VRM, confirmée par lien Supabase (voir D3).
- **Preuve** : `/api/sante` en prod ne dit rien du script. La ligne `vrm_email_collecteur_passage` est **à vérifier** en base.
- **Correction** : recoller `gmail-forwarder.gs` et poser `EMAIL_INBOUND_SECRET`. En attendant, faire dire à l'écran « le lien n'est pas encore parti, VRM te prévient » plutôt que « en préparation » sans délai.

### D3 — Inscription par email : confirmation obligatoire, SMTP personnalisé probablement absent · **BLOQUANT** (probable) · réglage vérifié, SMTP à vérifier
- **Scénario** : Sophie crée un compte email + mot de passe. Supabase exige la confirmation (`mailer_autoconfirm:false`, lu en prod sur `/auth/v1/settings`). Si l'expéditeur par défaut de Supabase est toujours en place, il n'écrit qu'aux membres de l'équipe du projet, avec quelques emails par heure. Sophie ne reçoit alors jamais le lien et ne peut pas se connecter. Même chose pour « mot de passe oublié » (`authReset`, `App.jsx:1383`).
- **Preuve** : CLAUDE.md « Gestes attendus : Supabase… SMTP personnalisé » ; `docs/passation/journal-agent-2.md:617` : « les réglages distants SMTP/redirects ne sont PAS appliqués ». Google et Discord marchent (`external.google/discord: true`).
- **Correction** : brancher un SMTP (Brevo, Resend…) dans Supabase. Sinon, tant que ce n'est pas fait, mettre en avant Google/Discord et retirer la création par email.

### D4 — Pages légales publiques incomplètes (« à compléter : raison sociale… ») · **GRAVE** (légal, avant de vendre) · vérifié en prod
- **Scénario** : Sophie ouvre « Conditions de vente » depuis l'écran d'abonnement ou /legal/mentions-legales.html. Elle y lit « à compléter : raison sociale », « à compléter : SIRET », « à compléter : téléphone »…
- **Preuve** : `curl https://vrm.center/legal/editeur.js` → `nom: null`, `siret: null`, `telephone: null` (9 champs sur 10 vides). Le paiement est fermé en conséquence (`/api/sante` : `"stripe":false`). L'app le dit au propriétaire seulement (`App.jsx:57671`).
- **Correction** : remplir `public/legal/editeur.js`. Tant que ce n'est pas fait, masquer les liens légaux de la porte d'abonnement, ou y afficher « Mentions en cours de rédaction ».

### D5 — Factures Pro « envoi automatique » : promises à tous, envoyées seulement pour Julien · **GRAVE** · vérifié (code)
- **Scénario** : Sophie (compte Vinted Pro) active Paramètres → Facturation Pro → « Envoi automatique à l'acheteur : ON ». À chaque vente Pro, la facture est créée `status:'queued'` (`api/email-inbound.js:475`) et elle reçoit la notification « 🧾 Facture en cours d'envoi » (`:2304`). Mais la file n'est lue que par le script Gmail, dans le contexte **`VRM_OWNER_UID`** (`api/email-inbound.js:1865`, mode `factures` `:1826`). Ses factures restent « en cours d'envoi » pour toujours, et l'acheteur ne reçoit rien.
- **Preuve** : `docs/emails/boite-collective.md` : « La facturation Pro… reste limitée par le serveur au propriétaire de l'installation. » L'interrupteur (`App.jsx:58735`) ne le dit pas.
- **Correction** : masquer l'interrupteur « Envoi automatique » hors propriétaire (ou le dire), et ne pas notifier « en cours d'envoi » quand aucun envoi n'est possible.

### D6 — Adresse « Masquer mon adresse » d'Apple (relais iCloud) : impossible à prouver, emails en quarantaine pour toujours · **GRAVE** · vérifié (code) ; comportement Apple à vérifier
- **Scénario** : Sophie s'est inscrite sur Vinted avec un relais `…@privaterelay.appleid.com` (fréquent sur iPhone). Le relais n'accepte que l'expéditeur pour qui il a été créé (Vinted). L'app ne demande d'ailleurs **jamais** de lien pour un relais (`App.jsx:59533` : `if (!estRelaisApple(a)) await demanderPreuveAdresse(a)`). Seul Julien a une exemption (« transition », `preuve-adresse.js:36-47`). Résultat : tous ses emails Vinted restent en quarantaine, et l'écran se contente de dire « tant qu'une adresse n'est pas confirmée, ses emails sont mis de côté ».
- **Correction** : proposer une autre preuve pour un relais Apple (par exemple : « transfère-nous l'email Vinted de bienvenue reçu sur ce relais », preuve par contenu signé par Vinted), ou au minimum dire clairement que cette adresse ne pourra pas être reçue et quoi faire (changer l'adresse Vinted).

### D7 — Le message « base injoignable » demande au vendeur de redémarrer le projet Supabase de Julien · **GÊNANT** · vérifié (code)
- **Scénario** : une panne de base de plus d'une heure. Chaque vendeur lit « c'est ton hébergeur de données qui a un problème… clique Restore… Settings → General → Restart project », avec des liens vers `supabase.com/dashboard/project/<ref>` (`App.jsx:16005-16025`).
- **Même famille** : le push sans clé dit « Vercel → projet cancale-v67 → … VAPID_PRIVATE_KEY » (`App.jsx:10997`), avec un lien direct vers `vercel.com/shopcancale35-7638s-projects/…` (`App.jsx:58997`). eBay non configuré dit « Ajoute tes clés eBay dans Vercel… docs/ebay-api.md » (`App.jsx:21574-21578`). L'IA sans clé dit « pose AI_API_KEY sur Vercel » (`App.jsx:52577`).
- **Correction** : réserver ces instructions au propriétaire (`acces.proprietaire`) et dire aux autres « VRM a un souci de son côté, rien n'est perdu, on s'en occupe ».

### D8 — La rétrospective dit « Quelle année, Julien ! » à tous les vendeurs · **GÊNANT** · vérifié (code)
- **Scénario** : Sophie a une vente finalisée, ouvre Outils → « Rétrospective 2026 » (`App.jsx:46225`). La dernière carte affiche « Quel mois, Julien ! » / « Quelle année, Julien ! » (`App.jsx:53048`).
- **Correction** : utiliser `vrm_prenom` s'il existe, sinon « Quelle année ! ».

### D9 — Les factures que le vendeur remet à ses acheteurs portent le logo VRM et « Cancale Shoes Store » · **GÊNANT** · vérifié (code + logo décodé)
- **Scénario** : Comptabilité → Factures → imprimer. `generatePDF` met `LOGO_CANCALE` (le logo VRM, 192 px, décodé dans `.../audit-final/logo.png`) avec `alt="Cancale Shoes Store"` (`App.jsx:28371, 28407`). La version PDF ajoute `setProducer('VRM Cancale')` (`App.jsx:28557, 28589`). La facture de Sophie à son client affiche donc la marque VRM, et non la sienne (le champ `logo` de `vrm_pro_facture` n'est pas utilisé ici).
- **Correction** : utiliser le logo de l'entreprise du vendeur s'il existe, sinon aucun logo ; `alt` et `Producer` neutres.

### D10 — Ventes, pour un vendeur sans compte Vinted : pas de filtre « Vinted », mais Vestiaire mis en avant · **GÊNANT** · vérifié (banc jetable)
- **Scénario** : Sophie ouvre Ventes. Elle voit les filtres « Tous les sites · Vestiaire », la phrase « Vestiaire : jamais lu — ouvre tes ventes sur Vestiaire avec l'extension. » et « Aucune vente lue pour l'instant ». Il n'y a ni Vinted, ni le geste « installe l'extension ». Dans la colonne, « Plateformes » ne montre que Vestiaire : Leboncoin et eBay, annoncés par la Bienvenue, n'apparaissent nulle part tant qu'aucune donnée n'existe.
- **Preuve** : `rendu/ventes.txt` ; `App.jsx:61186-61203` (`sitesPresents` : Vinted seulement si un compte existe, Vestiaire toujours).
- **Correction** : afficher toujours Vinted (le site principal), ou dire dans Ventes « Aucun compte Vinted lié » avec le même geste qu'Annonces.

### D11 — Colis affiche « 0 » partout et « Vinted ne te demande aucun envoi » à quelqu'un qui n'a rien relié · **GÊNANT** · vérifié (banc jetable + capture)
- **Scénario** : Sophie, sans compte lié, ouvre Colis. Elle lit « Prêts à imprimer 0 / En attente 0 / À retirer 0 / Partis 0 », puis « Aucun colis à envoyer. Vinted ne te demande aucun envoi en ce moment. ». En parallèle, « Je lis encore tes bordereaux : il y en a peut-être plus ».
- **Preuve** : `rendu2/cat_bord.txt`, `rendu2/cat_bord.png`. Cela contredit CLAUDE.md §5 (« rien lu ne vaut pas rien »).
- **Correction** : sans compte lié, remplacer les compteurs par « — » et la phrase par le geste « relie ton compte Vinted ».

### D12 — eBay renvoie vers une section « Compte » qui n'existe plus · **GÊNANT** · vérifié (banc jetable)
- **Scénario** : Annonces → eBay affiche « Pas encore d'annonce eBay en ligne. Connecte ton compte eBay (section « Compte ») et synchronise. ». Depuis le 31 oct., le compte eBay vit dans Paramètres → Comptes eBay (`src/navigationTache.js:47-52` : sous-sections « Annonces · Promotion » seulement).
- **Preuve** : `rendu/ebay_annonces.txt`.
- **Correction** : remplacer par un bouton « Paramètres → Comptes eBay ».

### D13 — Le réglage « Import des emails Vinted · Date de début » n'agit que pour Julien · **GÊNANT** · vérifié (code + doc)
- **Scénario** : Sophie règle une date de début (`EmailStartSetting`, `App.jsx:58785`). Elle est enregistrée sous son owner. Le script collectif lit `mode=config` dans le contexte `VRM_OWNER_UID` (`api/email-inbound.js:1819, 1865`). Doc : « Le script collectif ne reprend pas le réglage d'import personnel d'un utilisateur. »
- **Correction** : masquer ce réglage hors propriétaire, ou le dire (« ta date n'est pas utilisée par la réception collective »).

### D14 — Le jour où l'abonnement devient obligatoire, la porte ne parle pas de l'essai gratuit · **GÊNANT** · vérifié (code) ; l'état réel de `abonnement_obligatoire` est à vérifier
- **Scénario** : Julien passe `abonnement_obligatoire` à `1`. Sophie, inscrite gratuitement, tombe sur `AbonnementRequis` (`App.jsx:57846-57905`) : « 16,99 € / mois, sans engagement… S'abonner ». Aucune mention des 7 jours gratuits auxquels elle a droit (`info.essaiDispo` n'est lu que par la carte de Paramètres, `App.jsx:57784`), alors que les CGV les promettent. Tous les inscrits gratuits sont coupés le même jour, sans préavis dans l'app.
- **Correction** : reprendre la phrase `essaiDispo` de la carte de Paramètres sur la porte, et annoncer la bascule quelques jours avant (bandeau).

### D15 — Le texte d'accueil laisse croire que le téléphone suffit · **DÉTAIL** · vérifié (code)
- **Constat** : `src/Accueil.jsx:660` dit « Une installation, sur ton ordinateur. Ensuite, ton téléphone suffit. ». Or les actions depuis l'iPhone passent par le relais, **ordinateur allumé avec Chrome ouvert** (banc `premierjour` : « l'iPhone agira par l'ordinateur allumé »). Un revendeur sans ordinateur paie pour une app qui ne se remplit jamais.
- **Correction** : « Ton ordinateur avec Chrome reste nécessaire pour que VRM lise Vinted ».

### D16 — Petites traces de Julien dans les textes · **DÉTAIL** · vérifié (extraction des chaînes par Babel : `.../audit-final/chaines.cjs`, commentaires exclus)
- Exemples écrits : « ex : Maison de la Presse, 40 Rue du Port, 35260 Cancale » (`App.jsx:38705, 38711`), « Super U Cancale » (`App.jsx:38734, 51971`), « Brocante de Cancale » (`App.jsx:10848`), « Accompagnement de Julien » (`src/communaute/Communaute.jsx:767`), « 'Julien d'Exemple' » (`App.jsx:57680`, réservé au propriétaire : sans gravité).
- Aucun pseudo de compte Vinted ([compte Vinted], shop_cancale, hopcancale…), aucun email de Julien ni UID en dur dans un texte affiché. Ils n'apparaissent que dans des commentaires, et l'UID dans la migration 006 (normal).
- **Correction** : exemples neutres (« 12 rue de la Gare, 75010 Paris »).

### D17 — L'assistant IA ne peut pas recevoir la clé du vendeur · **DÉTAIL** (latent) · vérifié (code)
- **Constat** : l'app envoie `load('vrm_ai_key')` (`App.jsx:20570, 44815`) mais **aucun écran n'écrit cette clé**. C'est aussi contraire à §2.9 (« la clé du vendeur, rangée côté serveur, jamais relue par le navigateur »). Aujourd'hui `/api/sante` dit `"ia":false` : le bouton reste caché, sans dommage. Le jour où `AI_API_KEY` sera posée, `GET /api/ai` rendra `ready` à **tous** les vendeurs. Le bouton « ✨ Rédiger » apparaîtra chez Sophie et répondra « pose AI_API_KEY sur Vercel ».
- **Correction** : que `GET /api/ai` ne dise `ready` qu'au propriétaire, ou à un vendeur qui a une clé rangée côté serveur (comme Photoroom).

### D18 — Le widget ne trouve plus personne au-delà de 1 000 vendeurs · **DÉTAIL** (échelle) · vérifié (code)
- **Constat** : `api/widget.js:107` lit toutes les lignes `main` pour retrouver le vendeur d'après son jeton, sans pagination. Supabase plafonne à 1 000 lignes (§4.5). Au-delà, un vendeur sur deux reçoit un 401.
- **Correction** : filtrer directement par jeton (`data->>vrm_widget_token=eq.<k>`, avec un index).

### D19 — La pastille « Lecture seule » en haut de l'écran, avant toute extension · **DÉTAIL** · vérifié (banc jetable + capture)
- **Constat** : la première chose que lit Sophie en haut à droite de chaque écran est « Lecture seule » (`App.jsx:17136`), sans savoir de quoi il s'agit.
- **Correction** : sans extension, afficher « Extension à installer » (même geste).

---

## Hors de portée de la lecture du code (à vérifier en prod par Julien)
- SMTP personnalisé réellement branché dans Supabase (D3).
- `vrm_reglages.abonnement_obligatoire` en base (D14), et l'application de 016 et 023. Si la 023 est appliquée : un compte Vinted déjà capté par un compte d'essai bloque un nouveau vendeur. L'extension saute les 409 en silence (`background.js:1729`), à vérifier.
- Le dernier passage du script Gmail (`vrm_email_collecteur_passage`), qui conditionne D1, D2 et D5.
- Les politiques RLS réellement actives sur `app_data`/`vinted_accounts` (je n'ai eu accès qu'au code des migrations).
