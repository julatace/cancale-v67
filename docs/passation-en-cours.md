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
- ✅ A1 (5.118 : connecté → l'icône ouvre/réutilise l'onglet vrm.center sur `plat_vinted` ou `plat_leboncoin` selon le site actif, puis se ferme ; pas connecté → petite fenêtre de connexion seule, qui ouvre VRM après connexion ; `bancs/popup.cjs` 14 verts. Le panneau sur Vinted existe encore — à retirer/réduire quand l'app aura tout). Clic sur l'icône de l'extension ⇒ ouvre directement l'app VRM : sur
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
- 🟨 B1 — RAPPORT D'OBSERVATION DE VINTEX (Claude in Chrome, 30/09, compte
  angeled92 ; aucune action envoyée, pas de capture réseau) :
  · panneau `vintex-proxy-panel` injecté dans vinted.fr (shadow DOM fermé) =
    RELAIS : les actions pilotées depuis vintex.app s'exécutent dans l'onglet
    Vinted avec la session de l'utilisateur ; pont v2.7.0.
  · tableau de bord « Vintex Neo » : Notifications (filtre « Favoris ») liste
    « [pseudo] a marqué ton article [titre] comme favori » → action « Répondre
    aux notifications » ; automatisation « Messages aux favoris » (règles texte
    / offre, jours, créneaux, délai 15 min, 1 j avant de réécrire, anti-doublon
    via conversations, quotas 10/60/illimité par jour selon forfait) ;
    « Boost favoris » = échange de favoris entre membres (gonflage, a priori
    contraire aux CGU Vinted — NE PAS reproduire) ; republication = supprime
    puis recrée (déjà refusé §3).
  · ⇒ **§3 « Vinted ne dit jamais QUI met en favori » est FAUX pour le flux des
    NOTIFICATIONS Vinted** (confirmé par Julien : « ça vient de l'app Vinted
    directement »). Nos emails « favori » le disent aussi : 33 reçus depuis le
    22/09, 9 avec pseudo lu — le serveur extrait `qui` + `article` puis JETTE
    (seul `email_journal` borné) → à ranger (`email_favori_*`) plus tard.
  · 5.117 : `inject.js` capte passivement `/api/v*/notifications` (et
    `user_notifications`) → `harvest_{uid}_notifications`. 0 vu à ce jour ;
    Julien doit ouvrir la cloche sur Vinted une fois. PUIS mesurer la forme
    (pseudo/id, item_id, date, pagination) avant toute règle.
  · Garde-fous si on construit l'envoi : compte de l'onglet (`garde`), un par
    un, plafond/heure et /jour, jamais 2 fois la même personne, déclenché par
    lui (§3 : `vanessa5723`). Pas de délais « faussement humains ».
  Méthode initiale : une extension ne peut PAS observer une autre (isolation Chrome).
  Méthode donnée à Julien : DevTools du service worker de Vintex + DevTools de
  la page Vinted, onglet Network, « Keep log », une action Vintex, export HAR
  (Chrome l'exporte sans cookies ni en-têtes d'auth). Attendre ses fichiers.
  Julien installe l'extension Vintex ; capter son mécanisme d'envoi de
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
- ✅ G1 (Réglages → Comptabilité → « Masqué de la compta », onglets Ventes masquées / Achats masqués avec titre·date·compte·montant et « Réafficher » ; NOUVEAU : masquer un achat (icône œil barré sur la carte Achats, `vinted_purchases_hidden`, synchronisé), retiré à la source dans `loadOrders('purchased')` donc de tous les totaux ; liste gardée en mémoire car `save()` est différé de 500 ms et `load()` ne voit pas l'écriture en attente — deux masquages rapprochés s'écrasaient). Tout ce qu'on masque dans la compta ⇒ dans Réglages, onglets « Ventes
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
- ✅ H4 (`vinted_account_phones`, synchronisé ; alerte si le même numéro — comparé chiffres seuls, +33 ≡ 0 — sert sur un autre compte ; rendu vérifié). Comptes liés : champ numéro de téléphone par compte (multi-compte : savoir
  quels numéros ont servi).

## I. Colis
- ✅ I1 (cause : l'âge = compte le plus ANCIEN parmi TOUS les comptes, exclus/bloqués compris ; ils sont écartés et le bandeau nomme le compte en retard. Non mesuré sur sa base — réseau bloqué). « Les infos datent de 58 jours » : faux, trouver et corriger.
- ✅ I2. Retirer « 1 imprime, colle, dépose et clique sur fait ».
- ⬜ I3. Imprimante classique/thermique prend trop de place ⇒ demander le format
  de découpe UNE fois à chaque nouveau type de bordereau capté ; l'app doit
  reconnaître les différents bordereaux (transporteurs ET variantes d'un même
  transporteur), et demander l'emplacement pour thermique ET normal.
- ✅ I4. Retirer « où aller déposer les colis ».
- ✅ I5 (le bloc « N bordereaux sans vente correspondante » est retiré ; ils n'étaient déjà plus des lignes de travail). Bordereaux captés sans vente correspondante : ne pas les afficher ;
  attendre la capture Vinted, les emails ne servent que de sécurité.
- ✅ I6 (un colis coché « colis fait » quitte la liste ; ligne « Afficher les N colis marqués postés » pour les revoir ; « Tout imprimer » les excluait déjà ; rendu vérifié). Les bordereaux disparaissent quand la vente est expédiée.

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
- ✅ L1. Renommer « Garage » en **« Stock »** (libellés visibles seulement ; l'id d'onglet `garage` et les clés `vrm_garage*` restent, sinon ses rangements seraient perdus).
- ⬜ L2. Beaucoup plus simple : ranger vêtements, chaussures, montres, tout objet ;
  étages, étagères, par terre, boîtes numérotées ; un « jeu vidéo » pour
  retrouver ses articles plus vite que dans la vraie vie.

## M. Statistiques
- ⬜ M1. Plus de graphiques / représentations 3D (ex. la marque / le logo le plus
  vendu en 3D).

## O. Demandes du 30/09 (après le rapport Vintex)
- ⛔ Pauses aléatoires « pour paraître humain » : refusées (§3 — évasion de
  détection bot, cause du blocage de `vanessa5723`). Julien a insisté ; refus
  maintenu et expliqué.
- ⬜ O1. « Republier en 1 clic » — Julien : « je ne veux pas le faire
  manuellement / je ne veux pas avoir à le faire tout seul ». Conception
  retenue : UN clic + confirmation par annonce ; l'extension (1) CRÉE la
  nouvelle depuis le coffre (`vinted_item_details` + photos ; création déjà
  observée : `wreq_api_v2_item_upload_items`) et vérifie qu'elle est en ligne,
  (2) PUIS supprime l'ancienne par l'endpoint usuel de Vinted, ciblé par son
  item_id (identité, §5), (3) VÉRIFIE la disparition (relire l'item) et le dit ;
  échec ⇒ deux annonces en ligne, rien de perdu, l'app le signale. AUCUN geste
  de mesure demandé à Julien : le 1er clic EST la mesure (statuts notés).
  Pas de file, pas de pauses aléatoires, `garde`, plafond horaire.
  Bloqué tant que l'extension n'est pas installée chez lui.

## P. Visuel (30/09) — « améliore le visuel, surtout téléphone ; le logo en petit en haut »
- ✅ P1. Identité « VRM Noir » tirée de son logo (thèmes sombre et clair, index.html :
  barre d'état, fond, focus). Logo = `public/logo-vrm.png` / `-192.png`
  (découpé de sa capture) via `VrmLogo` (en-tête, rail, connexion, Réglages).
  Pièce 3D retirée du héros (chevauchait « SEPTEMBRE » à 390 px). Espacement
  « Données à jour » sur Colis corrigé. Rendu vérifié à 390 et 1512 px.
- ⬜ P2. Suite mobile : en-tête chargé (menu + retour + logo + 4 icônes),
  emojis-icônes restants (🔢 Poser le N°, 📎 J'ai le PDF) → icônes au trait,
  photos des ventes (E4). Attendre son retour sur P1.

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
- ✅ `SUPABASE_SERVICE_KEY` posée sur Vercel le 30/09 (type sensitive,
  production), clé `sb_secret_` donnée par Julien dans la conversation ⇒
  lui conseiller de la RÉGÉNÉRER une fois la fermeture validée (Supabase →
  API Keys → nouvelle clé secrète → la poser sur Vercel → supprimer l'ancienne).
- ⚠️ Journal 30/09 : l'extension écrivait `authenticated` jusqu'à 11:27 puis
  `anon` dès 11:28 = installation du nouveau dossier 5.115 (mémoire neuve, la
  session transmise par l'app était perdue). Julien : « ça ne me demande pas de
  me connecter » (le formulaire n'était que dans la fenêtre de l'icône).
  ⇒ 5.116 : la bulle VRM de Vinted affiche le formulaire de connexion VRM quand
  l'extension n'est pas connectée (bouton VRM cerclé d'orange) ; background
  accepte authEtat/authLogin depuis `cancale-vpanel`. Testé en exécutant le vrai
  vinted-panel.js (bandeau, envoi, disparition après connexion).
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
- 30/09 (suite) : 15 puis 20 maquettes téléphone (https://claude.ai/artifact/CbEPsidghQb9B9YDKDcv83) — **Julien : « rien ne me plaît »**. Ne pas refaire de maquettes à l'aveugle : lui demander 2-3 captures d'apps qu'il aime.
- 30/09 : Julien fera **l'automatisation lui-même** (republier, messages aux favoris, offres) → dossier complet `docs/automatisation-vinted.md` (endpoints + corps RELEVÉS dans `harvest_*_wreq_*`, en-têtes, jetons, ordre de republication, N° à reporter, garde-fous). Point clé trouvé : `POST /api/v2/conversations {initiator:"seller_enters_notification", item_id, opposite_user_id}` = ouvrir une conversation depuis une notification.
- 30/09 : **G1 bis** — « Masqués » devient un ONGLET (menu, id `masques`, `EcranMasques`), plus dans Réglages, avec la **photo** de chaque vente/achat (`orderPhoto`). **G4 partiel** — « Facturation Pro » retirée de Réglages, bouton « Facturation Pro » dans l'onglet Factures (`ProFactureSetting`, même ligne `vrm_pro_facture`). `bancs/reglages.cjs` suit le déménagement (non relancé : fixtures `fx/` absentes du conteneur ; rendu vérifié par un script jetable à 390 et 1512 px).
- 30/09 : `ScreenHead` : le slot `right` a `maxWidth:100%` → les boutons reviennent à la ligne sur téléphone (Factures débordait de 300 px).
- 30/09 : **extension 5.119.0** — (1) les réponses automatiques envoyaient `{reply:"texte"}` ; la vraie forme (9 captures) est `{reply:{body,photo_temp_uuids:null,is_personal_data_sharing_check_skipped:false}}` (`audit-repondre` : 2 rouges sur l'ancien code). (2) ⚠️ SÉCURITÉ : `storeWriteReq` recopiait le corps de TOUTE écriture — la base contient en clair un IBAN, un scan de passeport, des jetons de carte, des codes 2FA, des changements d'email (lignes `harvest_*_wreq_api_v2_bank_accounts`, `…payments_identity`, `…payments_credit_cards`, `…user_2fa*`, `…save_email`, `…purchases_*_checkout*`, `…users_id_payouts`, `…user_addresses`, `…help_center…`, `…dsa…`, `…complaints`). Désormais : chemin gardé, corps retiré ; hôtes non-Vinted ignorés (`audit-wreq-sensible.cjs`, 5 rouges sur l'ancien code). **Les lignes déjà en base ne sont PAS supprimées — demandé à Julien.**
- 30/09 : Julien « je te laisse faire les visuels ». **P2 — accueil (Ma journée) refait** : graphique des 14 jours DANS le héros (`MiniBarres surSombre`), carte « Ta semaine » supprimée (doublon du héros + de la carte Expédier), carte « Expédier » montre les photos des paires (3 vignettes en éventail, `job.photos`), « Argent en attente » sans majuscules, ligne « Données à jour » masquée quand tout va bien (`FraicheurDonnees siAJour={false}` ; l'alerte d'une capture ancienne reste), dernières ventes en carrousel au doigt sur téléphone (`.vrm-carrousel` dans index.html, grille sur ordinateur), sous-titre « N choses à faire aujourd'hui ». Rendu vérifié 390/1512 px. Suite : même traitement Ventes, Annonces, Colis (photos d'abord, moins de texte).
- 30/09 : dossier `docs/automatisation-vinted.md` complété (§7 fonctionnement de VRM, §8 tout ce que fait Vintex — rapport d'observation du 30/09 résumé) et envoyé à Julien.
- 30/09 : Julien « des graphiques de qualité, là c'est enfantin ». `CourbeVentes` (SVG pur, cubique monotone → ne dépasse jamais les vraies valeurs, dégradé, point sur le dernier jour, infobulle par point) remplace les barres dans le héros de l'accueil ; nouvelle carte « Chiffre d'affaires · 12 derniers mois » en Statistiques (`liveStats.caParMois`/`ventesParMois`, calculés dans la MÊME boucle que `caMois`) ; barres de part du total par plateforme (si ≥ 2) et par compte (si ≥ 2) ; `StatBox compact` : les chiffres des Statistiques et de Ventes tiennent dans UNE carte à colonnes. Ventes : cartes plus courtes (photo 72 px, statut à côté de la date, compte seulement si la liste en mélange plusieurs, « ⚠️ à identifier » retiré — le champ « N° ? » le dit, prix « 40 € », N° + prix d'achat sur la ligne des actions) ; sans aucun prix d'achat, une seule case « Bénéfice » qui ouvre la saisie. `audit-chiffres` suit la règle et non l'orthographe (attributs avant `label`).
- ⬜ À faire ensuite (demande de Julien) : CGU / CGV + conformité légale FR/UE (mentions légales LCEN, RGPD/politique de confidentialité, cookies CNIL, CGV Stripe/consommateur, accessibilité).
- 30/09 : **CGU / CGV / conformité** (demande de Julien) — pages statiques `public/legal/` (mentions légales, CGU avec clauses art. 28, CGV prêtes pour Stripe, confidentialité, cookies), générées par `scripts/genere-pages-legales.py` ; identité de l'éditeur dans `public/legal/editeur.js` (tout à `null` → « à compléter » surligné, rien d'inventé). Liens sur l'écran de connexion (sans compte), phrase d'acceptation à l'inscription, section « Tes données et les conditions » dans Réglages. Google Fonts remplacé par @fontsource (IP des visiteurs plus envoyée à Google). `sw.js` ne met plus en cache les pages /legal/ (elles écrasaient l'app sous « / »). Récap et reste à faire : `docs/conformite-legale.md` (Julien : identité éditeur, médiateur, fermeture Supabase étape 2, dépôt privé ; app : bouton suppression de compte, purge planifiée).
- 30/09 : fenêtre « Se déconnecter / changer email / mot de passe » (`AcctSheet`) passée en `createPortal` vers document.body (zIndex 10000) : elle était piégée sous la barre du bas sur téléphone. Google/Discord : code OAuth PKCE déjà prêt, les boutons n'apparaissent que si le fournisseur est activé dans Supabase → Julien doit créer les identifiants chez Google Cloud et Discord Developer Portal. Republication : ⚠️ `GET /api/v2/items/{id}` répond **404 ×120** (panel_diag_capture, extension 5.115) — ni la republication ni `capterPhotosAnnonces` ne peuvent lire une fiche par là ; aucune autre lecture de fiche complète relevée. Le code « Vintex Clone » de Julien arrive tronqué (limite de longueur) ; sa partie requêtes reprend nos relevés, sa partie `transformImage` (rotation/recadrage/emoji au hasard) n'est pas reprise.
- 01/10 : **données sensibles effacées** (accord de Julien, « fais tout ») : 99 lignes `harvest_*_wreq_*` (banque, carte, identité, 2FA, e-mail, achats/paiement, support, DSA…) dans `app_data` ET dans la copie `sauvegarde.app_data_20260930` → `body` = « [retiré : donnée personnelle ou bancaire] », `url` = chemin seul, `nettoyeAt`. Vérifié : 0 IBAN, 0 JPEG base64, 0 jeton de carte restant. Le journal d'écritures ne stocke aucun contenu.
- 01/10 : **extension 5.120 — prépare la republication (mesure)**. Les 404 ×120 venaient de la 5.115 installée ; la 5.119 lit déjà la PAGE de l'annonce. `extraireDetailPage` garde désormais, depuis `__NEXT_DATA__`, la fiche de republication (`codes` : catalog_id, brand_id, size_id, status_id, color ids, package_size_id, price, item_attributes… — aucune donnée personnelle) + `photoIds`, rangés dans `vinted_item_details[id]`. Une annonce sans fiche est lue une fois (même plafond, même garde). Diag `fiche_codes_ok` / `fiche_codes_absents` + échantillon des CLÉS. `inject.js` relève la forme des envois FormData (noms de champs, type/taille de fichier). `audit-photos-passif` : 15 contrôles, 3 rouges sur l'ancien code. **Suite : une fois la 5.120 installée et une visite faite, lire `vinted_item_details` (codes) + `harvest_*_wreq_api_v2_photos` (champs FormData), puis écrire la republication (création → vérif → suppression → report du N°).**
- 01/10 : **guide complet pour l'extension de Julien** : `docs/guide-extension-vinted.md` (pièges : cookie HttpOnly → chrome.cookies, CSRF capté dans la page, items/{id} 404 → fiche dans __NEXT_DATA__, SW MV3 → storage ; manifest, session, appel, garde, lectures, écritures, republication pas à pas avec code, relance des favoris, branchement VRM, débogage, inconnus ❓ et comment les lever).
- 01/10 : Annonces allégé — places Leboncoin/eBay dans UNE carte (nom · n/N · Toutes/Aucune, phrase commune dessous), compte masqué sur les cartes s'il n'y en a qu'un (`annUnCompte`), « ✓ Vendue » et « Ranger » en neutre (l'orange répété sur chaque carte ne signalait plus rien), « relier à un achat » remonté à côté de Ranger pour que le prix d'achat ne soit plus tronqué sur téléphone. ⚠️ Le rendu de test montrait N°1 partout : artefact des photos de test (data: URL → même `photoKey`), pas un défaut ; l'alerte « numéro porté par deux annonces » s'est bien déclenchée.
- 01/10 : **Leboncoin, 3 PR livrées + extension 5.124.0.**
  - #344 **Ventes LBC finalisée vs en cours** (C2 en partie) : `lbcFinalisee`/`lbcAnnulee` au niveau module ; deux chiffres JAMAIS mélangés « Argent reçu · N finalisées » / « En attente · N en cours » (comme walletDispo/escrow §5.14), deux groupes « En cours »/« Finalisées », carte photo+titre+statut+prix. Bordereau plus répété sur chaque vente (il vit dans Colis). **Mesuré sur sa vraie base (MCP)** : l'Air Max 1 olive (`tx 361842001`, `seller=true`, `validation`/« Paiement effectué ») est bien captée et apparaît maintenant dans Ventes → En cours. « Paiement effectué » = acheteur a payé, pas encore expédié (escrow Leboncoin) → c'est « en cours », pas « argent reçu » — correct, comme Vinted. Ce qui RESTE de C2 (« l'annonce LBC reste en ligne ») est le lien paire↔annonce LBC via `VRM-{n°}`, bloqué (403 + `lbc_listings` ne contient pas ses propres annonces avec leur réf).
  - #345 **Onglet Achats LBC** (E4 côté Leboncoin) : les achats existaient dans `lbc_ventes` (`isSeller===false`) mais étaient JETÉS. Loader de la coque les extrait (`lbcVentes.achats`), composant `AchatsLeboncoin` (Reçus/En cours de livraison/Annulés), carte partagée `CarteLbc` (§11). Onglet « Achats » visible seulement si des achats sont captés. Probé 390/1512 px.
  - #346 **Panneau LBC : vrai logo VRM** (A-visuel, demande du 29/09) : `public/logo-vrm.png` copié dans l'extension, exposé en web_accessible_resource, posé sur le FAB (fermé) et l'en-tête — fini « VRM 52 ». ⚠️ Bug attrapé par `bancs/leboncoin.cjs` : le bouton contenant un `<img>`, un clic dessus ciblait l'enfant et `getAttribute('data-a')` rendait null → panneau ne s'ouvrait plus. Corrigé par `closest('[data-a]')` (KO=0 OK=63 après). `open=false` : ne s'ouvre pas tout seul (déjà le cas).
  - **E4 côté Vinted : déjà satisfait** — les écrans live Ventes/Achats Vinted portent déjà les photos (§perfv). L'écran `tab==='sales'` est l'ANCIEN tableau comptable éditable, pas l'écran de ventes live.
  - **I3 : déjà compact** — le sélecteur imprimante (Colis) est déjà 2 pastilles + 1 ligne, affiché seulement si des PDF sont prêts. Rien à réduire.
  - ⚠️ Bancs de RENDU (`verif_visuel`, etc.) instables dans ce conteneur (EADDRINUSE/timeouts à répétition) ; les bancs d'EXTENSION (`leboncoin.cjs`) et les probes Playwright ciblés marchent. Ne pas réécrire les gros écrans Vinted (E1-E4, H1-H3, Sales) sans un banc de rendu fiable — prod auto-déployée sur merge.
  - **Reste prioritaire, non bloqué, app-side** : C3 (« à publier » peu intuitif), C4 (non-reliée : photo + relier), D1/D7 (notifications plus claires/fiables), H1 (liste comptes dans Annonces → Réglages), G2 (détail des ventes dans le rapport compta). **Bloqué sur Julien** : installer l'extension 5.124 (débloque capture LBC, codes retrait, relevés, places) ; migration SQL étape 2 ; Google/Discord OAuth ; Stripe ; dépôt privé. **Bloqué 403** : lien paire↔annonce LBC, formulaire eBay.
