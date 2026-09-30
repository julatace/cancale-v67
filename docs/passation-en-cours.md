# Passation en cours — prompt du 30 septembre 2026

> **Pour l'IA qui reprend** : lis `CLAUDE.md` en entier, puis ce fichier. Ici vit
> la demande COMPLÈTE de Julien (rien n'a été résumé au point de perdre une
> exigence), découpée en tâches, avec l'état de chacune. Mets l'état à jour et
> pousse après CHAQUE tâche (règle §2.1). Travaille sur une branche `claude/…`,
> PR, merge (autorisation §2.2).
>
> Légende : ⬜ à faire · 🟨 en cours · ✅ fait (commit) · ⛔ bloqué (raison) · 👤 geste de Julien

Lien donné par Julien : https://claude.ai/artifact/SUm7REcQLakN9dpvdafDJ5 — c'est
une **maquette d'accueil « VRM Cash · Menthe »** (CA du mois, « à virer 282 € »,
« en attente chez Vinted 1 944 € », puces Expédier / Retirer / Messages), PAS
l'ancienne conversation. Référence de style pour la future page d'accueil.
Logo VRM (nouveau, 30/09) : `docs/assets/logo-vrm-2026-09-30.png` — carré noir
arrondi, liseré bleu lumineux, mot-symbole « VRM » blanc/argent. À décliner
(icône app, extension, accueil).

**Alertes Supabase reçues par Julien (29/09)** — Advisor, 2 CRITICAL :
« RLS Disabled in Public : table public.vinted_accounts » et « Sensitive Columns
Exposed : vinted_accounts … access_token ». Projet `cancale` plan **PRO**, compute
**NANO**, 12 819 requêtes/24 h, **65,3 % de succès**, Postgres 230 erreurs,
API gateway 4 122 warnings. ⇒ N1 est URGENT (dépôt public + jetons lisibles) :
recommandé à Julien de le remonter en priorité.

**Captures Leboncoin (vente du 29/09, reçues le 30/09)** — faits mesurés, SANS
données de l'acheteur (dépôt public) :
- page transaction : `leboncoin.fr/compte/part/transaction/{id}` (ex. 364210558) ;
  « Détails du prix » (prix barré 50 € → 45 €, frais offerts, total 45 €),
  « Numéro de transaction », « Annuler la transaction », acheteur (pseudo).
- messages automatiques Leboncoin dans la conversation : n° de **tracking**
  (ici 72397087, = « MR 72397087 ») puis « Votre QR code de dépôt est
  disponible ! Vous avez **3 jours** pour déposer… Point Relais® ou Locker » +
  bouton « Afficher le QR code ». Le QR est aussi dans l'email et le détail de
  transaction.
- deux modes : « Sans impression » (QR code) / « Avec impression » (bon d'envoi
  PDF servi par **api.leboncoin.fr**).
- le PDF : mise en page **InPost / Mondial Relay** portrait, étiquette à gauche +
  « Fiche destinataire » à droite ; porte « N° Expédition » (= tracking) et
  **« Référence Commande » = n° de transaction LBC** ⇒ IDENTITÉ bordereau ↔ vente
  (§5), pas besoin de ressemblance.
- **Cycle de vie d'une vente LBC** (captures 29/09, 16:20 → 19:52) :
  1. offre acceptée → message auto « L'acheteur a 48 heures pour payer » ;
  2. « {pseudo} a acheté votre article ! … a choisi la livraison Mondial Relay …
     Pour recevoir vos 45,00 €, **confirmez la disponibilité de sa commande dans
     les 48 heures**. Passé ce délai, la vente sera annulée. » + bouton
     « La commande est-elle disponible ? » → fenêtre « Vous avez fait une vente de
     45 € » avec **« Confirmer la disponibilité »** / « Annuler la vente » ;
     ⇒ à afficher dans l'app comme ACTION URGENTE (compte à rebours 48 h) ;
  3. page transaction : statut **« Colis à envoyer »** + date, bloc « Livraison
     Mondial Relay », « Votre QR code est en cours de génération. On vous notifie
     dès qu'il est prêt ! », « Numéro de suivi : 72397087 » ;
  4. QR prêt → « Vous avez 3 jours pour déposer le colis » (compte à rebours).
- URLs : annonce `leboncoin.fr/vi/{adId}` (ex. 3272594138, lien présent sur la
  page transaction ⇒ IDENTITÉ vente ↔ annonce LBC) ; conversation
  `leboncoin.fr/messages/id/{uuid}` ; transaction `…/compte/part/transaction/{id}`.
- La page transaction porte photo, titre, « Marron • 40,5 », prix, acheteur.
- Le panneau VRM de l'extension s'affiche sur leboncoin.fr (pastille « VRM 69 »).
- ⚠️ Reste à MESURER côté extension (le mouchard `lbc_recon.paths` 5.93 note
  méthode + statut + type) : les endpoints api.leboncoin.fr de la transaction,
  du QR et du PDF — ne pas les deviner.

---

## A. Extension ↔ app (comme Vintex / l'extension « vines »)
- ⬜ A1. Clic sur l'icône de l'extension ⇒ ouvre directement l'app VRM : sur
  vinted.fr → onglet Vinted de VRM ; sur leboncoin.fr → onglet Leboncoin. Plus de
  panneau à utiliser sur Vinted : « c'est que sur l'app maintenant que l'on
  retrouve les données qui nous intéressent ». L'extension capte et envoie.
- ⬜ A2. Liaison extension ↔ app : on se connecte à l'extension avec les MÊMES
  identifiants que l'app (existe déjà en partie : popup.js, `vmrAuthEtat`). Les
  données vont au bon compte ; se connecter facilement à différents comptes.
- ⬜ A3. Sur vinted.fr, afficher le **N° de rangement de la paire à côté de la
  paire partout où elle apparaît** (ventes, annonces, etc.), sans l'écrire dans
  l'annonce. (Identité = item_id, jamais le titre — §5.)
- ⬜ A4. « Commande traitée » : un bouton (plutôt dans l'app) ; sur Vinted, la
  vente traitée est floutée / marquée « colis fait », et « tout générer / tout
  imprimer » ignore ces bordereaux.
- ⬜ A5. Multi-comptes : les actions (baisser prix, message aux favoris,
  republier) ne s'appliquent qu'au compte connecté dans l'onglet (garde §3). Quand
  on SÉLECTIONNE une action, ne montrer actifs que les éléments du compte chargé ;
  ceux des autres comptes floutés « ouvre ce compte avec l'extension ».
  Uniquement pendant qu'une action est sélectionnée.
- ⬜ A6. Extension : ne plus exposer le code (« les autres apps ne dévoilent pas
  leur code, on l'installe directement dans Chrome ») ⇒ publication Chrome Web
  Store (👤 compte développeur 5 $) + dépôt privé.

## B. Messages / offres aux favoris (comme Vintex)
- ⬜ B1. Julien installe l'extension Vintex ; capter son mécanisme d'envoi de
  messages / offres aux favoris et le reproduire. ⚠️ §3 : « Vinted ne dit jamais
  QUI a mis en favori » — mesuré. Si Vintex le fait, c'est qu'un endpoint existe :
  MESURER d'abord (mouchard `seen_urls` quand Vintex agit), ne pas deviner.
  Garde-fous anti-blocage (§3, `vanessa5723`) non négociables.
- ⬜ B2. Retirer « Répondre aux messages Vinted » des Réglages ; faire un ONGLET
  dédié (comme Vintex), orienté envoi de messages aux personnes qui ont mis
  l'article en favori.

## C. Leboncoin
- ⬜ C1. Vente Leboncoin : il faut dire que l'article est dispo puis générer le
  bordereau (pas instantané comme Vinted) ; il y a un **code / QR pour imprimer
  en locker**. Afficher ce QR à côté de la vente dans l'app ; le bordereau dans
  un onglet **Ventes Leboncoin**. (Attendre ses captures.)
- ⬜ C2. Vente captée (Air Max 1 olive) : quand l'argent est reçu l'annonce reste
  et on perd la trace ; la vente n'est pas catégorisée dans l'extension alors que
  l'argent est reçu. Corriger le suivi de statut des ventes LBC.
- ⬜ C3. Onglet « à publier » : pas intuitif ; pourquoi « annonce Leboncoin offre
  gratuit » ? Refaire.
- ⬜ C4. « Annonce Leboncoin non reliée » : afficher la photo + pouvoir la relier
  à un N° dans l'app. Le reste de la page « ne convient pas du tout » : refaire.

## D. Accueil / notifications (cloche en haut, à côté du verrou et des réglages)
- ⬜ D1. Centre de notifications plus clair.
- ✅ D2 (cloche : rappel les 1–3 du mois ; push serveur le 1er via le cron `ship-reminders`, catégorie `urssaf`, anti-doublon `urssaf_reminder_dedup`, route EXÉCUTÉE au banc). La carte « Prochaine déclaration » du tableau de bord est RESTÉE (le « dedans » visait la cloche) — à confirmer. Retirer la carte « déclaration URSSAF » ; à la place, notification le
  1er de chaque mois pour la faire.
- ✅ D3. Retirer « 25 offres reçues » (on les verra via la captation des messages).
- ✅ D4. Retirer « 20 messages non lus ».
- 🟨 D5 — MESURÉ 30/09 : 4 ventes « à expédier » dans la moisson ; 3 déjà cochées
  « colis fait » par Julien (`vinted_ship_done`), donc hors compte. Reste
  **angeled92, tx 22501209977, vente du 22/09, acheteur cladej** : Vinted dit
  encore « Bordereau envoyé au vendeur » (status 230) au détail du 28/09 ET à la
  liste du 30/09. ⇒ demandé à Julien si ce colis est parti. Compte
  `julienf765` capté il y a 10 j (20/09) : ses deux ventes y étaient figées.
  « Vente à expédier » : seulement si VRAIMENT sûr qu'elle n'est pas
  expédiée (il a déjà reçu l'argent pour celle signalée). Revoir la règle.
- ✅ D6 (partiel) — MESURÉ : 9 colis « disponible » sans lieu, dont les 5 Mondial
  Relay récents = des LOCKERS (`consigne:true`) ; le parseur ne connaissait que
  l'en-tête « Point Relais ». Élargi à Locker / Locker 24/7 / Consigne / Casier
  (même forme : en-tête puis nom + adresse). Le texte brut n'étant conservé
  nulle part, quand le lieu reste introuvable on stocke `extraitLieu` (lignes à
  code postal + 2 au-dessus, 600 car.) pour écrire la règle sur la VRAIE forme.
  Les anciennes lignes ne seront pas réécrites (pas de texte brut).
  « Colis à retirer » : le lieu du point relais est souvent en bas du mail
  ou dans ses infos, l'app dit à tort qu'elle ne l'a pas. Mieux extraire.
- ⬜ D7. Notifications push : « très bien ». Mais à une vente, le « en transit »
  en petit dessous doit être pertinent et fiable.
- ✅ D8. Renommer « push » en **« Notifications téléphone »**.

## E. Ventes
- ⬜ E1. Bordereau à côté de chaque vente (à côté du prix si possible), en plus
  de l'existant.
- ⬜ E2. Comptes pro : à côté, la facture générée par l'app pour la vente + bouton
  « envoyer la facture au client ».
- ⬜ E3. Pouvoir relier une vente à un achat Vinted + sa facture d'achat.
- ⬜ E4. Photo de l'annonce + toutes les infos à côté pour chaque vente ET achat
  (comme Vinted).
- ✅ E5 (le CSV avait déjà BOM + « ; » : seul le libellé manquait). Export CSV : ajouter à côté « format Excel / Numbers ».
- ✅ E6. Litiges : les retirer des Outils (déjà dans « annulée », ce n'est pas un
  problème pour lui).

## F. Achats
- ⬜ F1. Achat en duo / lot sur Vinted : au clic, diviser le lot en articles
  distincts pour attribuer chacun à son annonce.

## G. Compta / fiscal
- ⬜ G1. Tout ce qu'on masque dans la compta ⇒ dans Réglages, onglets « Ventes
  masquées » et « Achats masqués ».
- ⬜ G2. Rapport comptable à améliorer impérativement : il liste les factures
  d'achat par paire mais seulement le montant global des ventes ⇒ détail des
  ventes (et rapprochement).
- ⬜ G3. Régime fiscal « société » : soit parfait (TVA, boosts, frais…), soit on ne
  garde que la micro-entreprise.
- ⬜ G4. Onglet Factures : simulation de facture (logo + toutes les infos légales
  requises) avec aperçu du résultat. La config facture des Réglages déménage dans
  l'onglet Factures.

## H. Annonces / comptes
- ⬜ H1. Onglet Annonces Vinted « le bordel » : la liste des comptes connectés
  va dans Réglages avec infos (email, etc.).
- ⬜ H2. Compte bloqué définitivement par Vinted : ses ANNONCES sortent des
  annonces en ligne, l'app propose de les republier sur un autre compte (s'il y
  en a), sinon garde les infos côté serveur. ⚠️ Les VENTES et ACHATS restent
  (argent reçu, à déclarer).
- ⬜ H3. Fiche d'une annonce : trop d'infos, mal organisée ⇒ beaucoup plus
  intuitive et simple.
- ⬜ H4. Comptes liés : champ numéro de téléphone par compte (multi-compte : savoir
  quels numéros ont servi).

## I. Colis
- ✅ I1 (cause : l'âge = compte le plus ANCIEN parmi TOUS les comptes, exclus/bloqués compris ; ils sont écartés et le bandeau nomme le compte en retard. Non mesuré sur sa base — réseau bloqué). « Les infos datent de 58 jours » : faux, trouver et corriger.
- ✅ I2. Retirer « 1 imprime, colle, dépose et clique sur fait ».
- ⬜ I3. Imprimante classique/thermique prend trop de place ⇒ demander le format
  de découpe UNE fois à chaque nouveau type de bordereau capté ; l'app doit
  reconnaître les différents bordereaux (transporteurs ET variantes d'un même
  transporteur), et demander l'emplacement pour thermique ET normal.
- ✅ I4. Retirer « où aller déposer les colis ».
- ⬜ I5. Bordereaux captés sans vente correspondante : ne pas les afficher ;
  attendre la capture Vinted, les emails ne servent que de sécurité.
- ⬜ I6. Les bordereaux disparaissent quand la vente est expédiée.

## J. Réglages divers
- ⬜ J1. « Mes adresses de réception » : demander à la création du compte ou à la
  connexion d'un nouveau compte Vinted ; ou deviner via l'email du compte Vinted.
- ✅ J2 (menu Annonces, bouton eBay, réglage de clé locale ; `api/ai` reste — il sert aux réponses automatiques). Retirer la rédaction d'annonces par l'IA.
- ⬜ J3. Widget : pas convaincu pour l'instant (à revoir / garder discret).

## K. Bugs
- ✅ K1 (à confirmer sur son Mac). Sur ordinateur, impossible de défiler VRM au pavé tactile (obligé
  d'utiliser la barre de défilement). Anormal : corriger.
  → MESURÉ : c'est `<main>` qui défile ; hors de la colonne (marge, bande de
  droite, rail) la molette faisait 0 px. `DefilementPartout` renvoie à `<main>`
  tout événement qu'aucun conteneur ne peut absorber (jamais derrière une
  modale plein écran, jamais Ctrl+molette). Banc : 0 → 400 px aux 4 positions.
  Au-dessus du contenu, ça défilait déjà dans Chromium : s'il bloque ENCORE,
  lui demander sur quel écran et où est le curseur.

## L. Stock (ex-Garage)
- ⬜ L1. Renommer « Garage » en **« Stock »**.
- ⬜ L2. Beaucoup plus simple : ranger vêtements, chaussures, montres, tout objet ;
  étages, étagères, par terre, boîtes numérotées ; un « jeu vidéo » pour
  retrouver ses articles plus vite que dans la vraie vie.

## M. Statistiques
- ⬜ M1. Plus de graphiques / représentations 3D (ex. la marque / le logo le plus
  vendu en 3D).

## N. Ensuite, dans cet ordre (après A→M « parfaitement »)
- 🟨 N1 (PRIORITÉ, Julien : « on fait Supabase ») — voir « État Supabase » ci-dessous. Isolation des données + début du multi-utilisateurs : une extension et
  une adresse email appartiennent à UN compte, lui seul reçoit les infos, aucune
  fuite. Regarder les alertes de vulnérabilité envoyées par Supabase.
- ⬜ N2. Coût pour 200 utilisateurs (Supabase, Vercel…) : l'abonnement actuel
  suffit-il ?
- ⬜ N3. Connexion Google, etc.
- ⬜ N4. Stripe + paiements.
- ⬜ N5. Page d'accueil (« minable ») à refaire — cf. maquette ci-dessus.
- ⬜ N6. Deux environnements : PROD stable (utilisateurs) et BÊTA qui bouge ;
  pareil pour l'extension.
- ⬜ N7. Privatiser le code GitHub (👤 Settings → Danger zone → Change visibility).
- ⬜ N8. Maquettes de motion design pour le site.

---

## État Supabase (30/09) — MCP Supabase branché dans la session
Mesuré : `app_data` avait RLS ACTIVÉ mais 3 règles « tout_select/insert/update »
ouvertes à `public` (= grande ouverte, sans DELETE) ; `vinted_accounts` RLS
DÉSACTIVÉ (jetons Vinted lisibles/écrits par la clé publique). 1 seul compte
auth : shopcancale35@gmail.com = `74eea6e7-f060-46b6-b9c7-d500cedf4738`
(dernière connexion le 30/09 — l'app tourne connectée). Extension installée :
5.114. Vercel : ni `SUPABASE_SERVICE_KEY`, ni `CRON_SECRET`, ni `AI_API_KEY`.
- ✅ Sauvegarde intégrale : schéma privé `sauvegarde` (app_data 5 916 lignes,
  vinted_accounts 9), droits retirés à anon/authenticated.
- ✅ ÉTAPE 1 (migration `vrm_cloisonnement_etape1_proprietaire`) : colonne
  `owner` (défaut `auth.uid()`), tout attribué au compte ci-dessus, index
  uniques (owner,id) et (owner,vinted_user_id) EN PLUS des clés actuelles.
  Accès encore OUVERTS. ⇒ l'app et l'extension passent en mode cloisonné
  (jeton de l'utilisateur, `owner` écrit) ; un écrivain ANONYME laisse `owner`
  vide = témoin mesurable.
- ✅ `VRM_OWNER_UID` posé sur Vercel (production + preview).
- ✅ Journal TEMPORAIRE des écritures (`sauvegarde.journal_ecritures`, trigger
  `vrm_noter_ecriture` sur les 2 tables) : rôle (anon / authenticated /
  service_role), id de ligne, op, user-agent — jamais le contenu. Prouvé par un
  test auto-annulé (`raise exception`) ; le 1er jet n'écrivait RIEN (erreur
  avalée par `exception when others`) — corrigé via `to_jsonb(new)`.
  Mesure : `select role, left(agent,40), count(*), max(at) from
  sauvegarde.journal_ecritures group by 1,2 order by 4 desc;`
  ⇒ étape 2 quand plus AUCUNE ligne `anon`. Puis supprimer trigger + table.
- ℹ️ 15 requêtes 401 toutes les 5 min = un vieux **Google Apps Script**
  (user-agent Google-Apps-Script) avec une clé invalide : lit
  vrm_email_config / vrm_pro_facture / email_invoice_*. Rejeté, inoffensif ;
  👤 le couper (script.google.com → Déclencheurs).
- ✅ Serveur compatible avec les NOUVELLES clés Supabase (`sb_secret_…`, pas des
  JWT) : `api/_lib/cle.js` → `sbCle(k)` n'envoie `Authorization: Bearer` que
  pour une clé JWT (`eyJ…`). Appliqué à toutes les routes (19 sites). Vérifié
  en exécutant `api/widget.js` avec les deux formats ; `bancs/serveur.cjs` vert.
- ⬜ ÉTAPE 2 = `supabase/migrations/002-fermeture.sql` (prêt). Conditions :
  👤 `SUPABASE_SERVICE_KEY` sur Vercel (Supabase → Settings → API Keys →
  service_role → Vercel → Settings → Environment Variables, Production) ;
  👤 extension connectée à son compte VRM (icône → email + mot de passe VRM) ;
  mesure : aucune ligne `owner is null` récente.
- 👤 Advisor WARN : activer « Leaked password protection » (Auth → Providers →
  Email / Password security).

## Journal de cette session
- 30/09 : prompt reçu, découpé ici.
- ⚠️ Le réseau de la session BLOQUE `lgonxzrzjcqthjtbdpzo.supabase.co` (403
  proxy) : aucune mesure sur la vraie base possible tant que Julien n'a pas
  ajouté le domaine (environnement → Edit → Network access).
- ⚠️ `audit-offres-titre.cjs` était DÉJÀ rouge avant cette session (« l'accueil
  affiche le nombre mis de côté ») — probablement la refonte d'accueil #305/#306.
- La branche portait un commit non déployé de la session précédente :
  « Nouvelle identité Menthe » (fba8202) — conservé, part avec la 1re PR.
- K1 livré (#307).
- Lot 2 : D2 D3 D4 D8 I1 I2 I4 E5 E6 J2. `audit-offres-titre` rendu conditionnel (plus aucune offre affichée, décision de Julien) — il redevient exigeant dès qu'un écran rappelle `offresAtraiter`.
