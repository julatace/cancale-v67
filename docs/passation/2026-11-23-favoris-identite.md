# 23 nov. 2026 (nuit) — Extension 5.440.1 : le lien d'application de la cloche, l'identité par la commande, une phrase entière, un mot par état

Branche `claude/favoris-identite`. Capacités `favorislienapp`, `favoriscommande` = **5.440.1** (5.441 à 5.445 sont réservées
par les PR ouvertes #1327, #1311, #1329, #1331 — train du 24 nov.).

## Ce que Julien a vu (23 nov., 19:44 Paris, 5.440.0, compte angeled92)

- Fenêtre sur vinted.fr : « Envoi interrompu — le détail est dans le panneau VRM · 0 envoyés · 1 sauté · 2 non envoyés » ;
  la ligne « nike air max 1 bleu taille 43 — Pas envoyé · Conversation pas vérifiée — rien n'est parti », deux « En attente ».
- Panneau Favoris : « Messages aux favoris · 0 envoyé(s) · 1 pas envoyé(s) », « Interrompu : La page de Vinted n'a pas montré
  ce que VRM attendait pour plusieurs favoris de suite : … puis touche « » (COUPÉ), « 0 envoyé · 1 refusé : article ou
  destinataire pas confirmé », et la bannière « Une file d'envoi est en pause : 2 en attente » qui répète la phrase coupée.

## Ce qui a été MESURÉ (vraie base, lecture seule, formes et identifiants seulement)

| constat | mesure |
|---|---|
| l'accusé du favori 10725092171 | `refuse`, `identite_non_confirmee`, étape `conversation`, **aucune `cause`**, `ecrits: 0` |
| ce que ça désigne dans le code | sans cause + étape `conversation` = la SEULE ligne `noterDiag('favori_lien_autre'); return rep('refuse',0,'identite_non_confirmee')` (un refus de la page aurait porté `cause: page_autre`, un refus de la relecture l'étape `verification`) |
| le compteur | `panel_diag_capture.n.favori_lien_autre` = 1 ; aucun `interface_favoriOuvrir_ok`, aucun `favori_fil_nouveau*` |
| le lien de la notification de CE favori | `vintedfr://messaging?item_id=10725092171&user_id=3185499884&portal=fr` — l'article et le destinataire du job, exactement |
| depuis quand | `harvest_3175765377_notifications` : 5/5 notifications de favori à ce format, du 23 nov. 09:05 à 16:35 UTC ; les 8 autres comptes (archives) gardent `/items/N/want_it/new?offering_id=N` (1 057 lignes, jusqu'à 19:24) — un essai de Vinted sur SON compte |
| la page web d'un favori | relevé passif : `/inbox/want_it` (12:54:21) puis `POST messaging/main/inquiries` 201 (12:54:24) |
| la conversation « à commande » | `GET messaging/main/conversations/{uuid}` avec `data.order_id`, `data.escrow_order_id`, sans `data.items`, et `GET escrow-orders/api/v2/escrow-orders/{id}` → `escrow_order.{id, items[], buyer_id, conversation_id, current_user_side}` — relevés à **19:53:33–35**, quand Julien a rouvert `/inbox` (la messagerie ouvre la DERNIÈRE conversation, une vente) : ce n'est PAS la conversation du favori |
| la file du serveur | `refusLocaux` = 2, hérité d'un ENVOI PRÉCÉDENT (3 « cloche introuvable » de la 5.438) : `lancerFile` recopiait `{...g}` sans remettre le compteur ⇒ UN refus d'identité a fait « 3 de suite » et mis la file en pause (2 en attente) |
| la phrase coupée | la raison du serveur est ENTIÈRE (253 signes) ; l'extension la coupait à 240 (`st.fin.texte` et la bannière `fi.raison`), juste après « touche « » |

## La cause, confirmée dans le code

1. **Le lien d'application.** `pageFavoriNative` n'accepte qu'un lien `https://…/items/N/…/new` ; `vintedfr://messaging?…` rend
   `null` ⇒ `lienBrut && !page` ⇒ `favori_lien_autre` ⇒ refus d'identité AVANT tout clic. Rien n'est parti (juste), mais à tort.
   L'hypothèse « `filDepuisMessagerie` attend `data.items` » n'est pas la cause de CE refus (le code ne l'a pas atteint) ;
   elle reste un risque réel pour une conversation de la nouvelle messagerie sans article : traitée aussi (§2 ci-dessous).
2. **« Plusieurs favoris de suite » après UN refus** : le compteur `refusLocaux` d'un ancien lot gardé par `lancerFile`.
3. **La phrase coupée** : `.slice(0, 240)` à deux endroits de l'extension.
4. **Les mots** : la fenêtre additionnait `saute + pas` sous « sauté » et appelait les favoris en attente « non envoyés » ; le
   panneau additionnait refusés + ignorés + incertains en « pas envoyé(s) » ; le bilan disait « refusé ».

## Ce qui est livré

### 1. Le lien d'application reconnu par identité (`favorislienapp`)
- `lienFavoriProfond` (background.js) : `vinted{xx}://messaging?item_id=N&user_id=N[&portal=xx]` — exactement ces clés, une
  fois chacune, chiffres, l'article ≠ la personne ; lu à la main (pas d'`URLSearchParams`, et aucun décodage).
- Dans `executerMessageFavori` : l'article ET la personne doivent être ceux du job ; sinon refus `identite_non_confirmee`,
  **cause `lien_autre`** (ajoutée à `CAUSE_ACCUSE`), rien cliqué. Concordant ⇒ la page cherche la ligne native par les deux
  identités (aucune adresse à suivre). Un lien d'une forme inconnue ⇒ `favori_lien_forme_<gabarit>` (jamais une valeur).
- `vrm-formulaire.js` (`lienFavoriVisible`) : la ligne de la page peut dire la personne par `receiver_id` OU `user_id` (une seule
  des deux, `portal` permis) — toujours les deux identités exactes, sur vinted.fr. `__vrmFormulaireV` 7 ⇒ 7.1 (réinjection).

### 2. L'identité par la commande (`favoriscommande`)
- Une conversation de la nouvelle messagerie **sans `data.items`** mais avec `data.escrow_order_id` : SA commande est relue
  (`GET api.vinted.fr/escrow-orders/api/v2/escrow-orders/{id}`, même onglet de travail, GET seulement, `vintedPage`).
- `identiteParCommande` exige TOUT : `conversation_id` = l'uuid de la page ; `escrow_order.id` = `data.escrow_order_id` ;
  `current_user_side` = `seller` ; `buyer_id` = le destinataire du job ; l'unique `opposite_users[].id` = l'acheteur (s'il y
  en a) ; UN article, lu seulement dans `item_id`, `item.id`, ou `id` d'une ligne qui n'a ni l'un ni l'autre — égal à celui du
  job. Sinon rien ne part ; la cause nommée au diagnostic (`favori_commande_<raison>`).
- Forme d'article inconnue ⇒ refus, et sa FORME (clés et types, jamais une valeur) dans `favori_forme_commande_…` du
  diagnostic + `chrome.storage.local.vrmFormesFavori` (10 dernières).
- Pas dans la page : la réponse que la page reçoit n'est pas lue (une lecture GET du fond suffit, même budget que la lecture de
  la nouvelle messagerie). À faire si un jour la lecture du fond est refusée là où celle de la page passe.

### 3. La file : un refus d'identité saute CE favori, et le dit
- `lancerFile` et `reprendreFile` remettent `refusLocaux` (et `refusTexte`) à zéro : « de suite » veut dire dans CET envoi.
- La raison porte un code (`raisonCode` : `local_saute` · `locaux_suite` · `traitee`, `raisonRefus`, `raisonN`) ; le français
  vient de `phraseRaisonFile` (src/favorisProgression.js) : « Un favori n'est pas parti (article ou destinataire pas confirmé) :
  rien n'est parti pour lui, VRM continue avec les suivants. » ; trois de suite : « 3 favoris de suite ne sont pas partis (le
  dernier : …) : la file est en pause, … puis touche « Reprendre ». » — toujours finie par le nom du bouton.
- Une file finie sur « Sélection traitée » n'est plus présentée comme « Interrompu ».

### 4. Une phrase entière, traduite, et un mot par état
- L'extension traduit la raison par son code (`VRM_UI.raisonFileFav`, clés `f6_rc_*` en 5 langues, `{bouton}` = `a_reprendre`) ;
  sinon le texte du serveur ENTIER (`texteEntier`, borne 600, coupe seulement à une fin de phrase).
- Les nombres : `resumeFileCarte` rend `pasEnvoyes` et `sautes` calculés par `bilanFavoris` (la règle du bilan) ; `lignesFavoris`
  classe un refus pour une raison de saut (vendu, déjà contacté…) en « sauté » par la même liste (`RAISONS_SAUT`, recopiée par
  `recopier-gardes-extension.cjs`).
- Les mots, partout (fenêtre, panneau, bilan) : **envoyé · pas envoyé · sauté · à vérifier · annulé · en attente**. « refusé »,
  « restant » et « non envoyé » ne désignent plus un favori. La ligne « Pas envoyé » d'un refus d'identité dit
  « Article ou destinataire pas confirmé — rien n'est parti » (le mot du bilan).
- La fenêtre de fin dit la raison (code `local_saute` / `locaux_suite`) sous son titre.

## Garde-fous (§3) — inchangés
Compte de l'onglet (`garde` / `gardeStricte`), 15 messages/h, 50/h réserve 5 (les écritures réservées d'un coup), un geste à la
fois, pause 429/403, arrêt au captcha, chaque favori une fois. Aucune écriture fabriquée par VRM : la commande est LUE (GET),
`vintedPage` reste GET seulement (`audit-tout-interface` vert). Identité jamais par titre ni ressemblance.

## Preuves
- `scripts/audit-favoris-identite.cjs` (nouveau, exécute le vrai `background.js` et la vraie file) : **31 verts** —
  I1 le lien d'application concordant ⇒ envoyé ; I2 ×4 autre personne / autre article / clé en plus / personne en double ⇒
  rien cliqué, cause `lien_autre` ; C1 conversation sans article + commande concordante ⇒ envoyé, la commande relue en GET ;
  C2–C11 autre acheteur, autre article, autre conversation, autre n°, côté acheteur, aucun article, forme inconnue, autre
  personne en face, deux articles, commande illisible ⇒ refusé, rien tapé ; C8 la forme notée sans valeur ; R1 le cas de Julien
  (ancien lot à 2 refus, puis UN refus d'identité) ⇒ la file CONTINUE, la phrase nomme ce refus ; R2 trois de suite ⇒ pause,
  phrase entière finie par « Reprendre » ; R3 le bilan dit « pas envoyés ».
  Sur `origin/main` (5.440.0, arbre `git archive`) : **21 rouges** (dont R1 : « plusieurs favoris de suite », la file arrêtée).
  `--prouve` : **9/9** mutations rouges.
- `scripts/bancs/favoris-auto.cjs` : **87 verts** (était 70) — P9 la ligne `item_id` + `user_id` cliquée, jamais l'autre
  personne ; P10 clés en trop ⇒ rien ; F1/F6 portés (« en attente », « annulés ») ; F7 (390, 390 sombre, 1512) « 0 envoyé ·
  1 pas envoyé · 2 en attente », la ligne « Article ou destinataire pas confirmé — rien n'est parti » ; F8 trois de suite :
  « 3 pas envoyés · 2 en attente » et la phrase entière dans la fenêtre. Sur `main` : **18 rouges** (« 0envoyés1sauté2restants »,
  « 3sautés2non envoyés »). Captures regardées (F7 390, F8 1512, F8 390 sombre).
- `scripts/bancs/panneau-favoris-tableau.cjs` : cas **Z** (1512 / 390, clair / sombre, la file jouée par la vraie file du
  serveur) : la fin et la bannière disent la phrase ENTIÈRE finie par « Reprendre », « 0 envoyé · 3 pas envoyés · 2 en
  attente », bilan « 3 pas envoyés : … ». 24 verts ; rouges sur `main`. Les 14 autres rouges du banc sont les MÊMES sur
  `main` (feuille de confirmation, comparés ligne à ligne). Captures regardées.
- Audits voisins verts : tout-interface, comme-bleam, ext-contrat-messages, onglet-travail, favoris-auto, coherence, ext-5438,
  action-plein, couleur-panneau, ext-boutique, politique-hotes, file-actions, ext-reprise-offres, extension-feuille,
  modif-avant-apres, formulaire-rythme, ext-arrets-formulaire, ext-aussi-interrompu, traduction, ext-cloche-favoris,
  messages-malins (M9e/M9f portés : « pas envoyé »), vc-notif-moderation, quoi-de-neuf, extension-zip, et les audits/tests
  des favoris (clair, écran, liste, envoi immédiat, offres irréprochables, rythme, carte) ; `scripts/tests/favoris-message`
  a 1 rouge, le même sur `main`.

## Ce qui n'est PAS vérifiable sans son vrai compte
1. **La ligne de la cloche sur le web** pour une notification au lien d'application : son adresse n'a jamais été relevée (seule
   la page `/inbox/want_it` l'a été, sans la requête). La 5.440.1 accepte `?item_id=&receiver_id=` OU `?item_id=&user_id=`
   (+ `portal`) sur vinted.fr. Si la ligne n'a pas de lien de cette forme, VRM ne la trouve pas : la page complète des
   notifications est essayée, puis ce favori est **sauté** (« favori trop ancien pour Vinted ») — rien n'est écrit au hasard.
   Le diagnostic le dira (`interface_favoriListe_rien_favori-notification`, `favori_absent_cloche`).
2. **La sous-forme de `escrow_order.items[]`** : jamais relevée. Une forme qui ne porte ni `item_id`, ni `item.id`, ni `id`
   ⇒ refus et la forme notée (`favori_forme_commande_*`).
3. **Qu'une conversation de favori soit « à commande »** : supposé possible, pas observé (la conversation à commande relevée
   était une vente).

## Geste de Julien
Installer la **5.440.1** (remplacer le dossier, ⟳ dans chaque Chrome ; Orion : son zip). Dans le panneau VRM → Favoris,
« Annuler la file » (l'ancienne, en pause), puis relancer les messages aux favoris, et dire ce que la fenêtre affiche sur
chaque ligne.

## Recouvrement avec les PR ouvertes (train du 24 nov.)
- **#1327** (5.441, favoris) touche `executerMessageFavori` (deux lignes `noterTexteEnvoyeFavori`, `deja_envoye`) et
  `vrm-formulaire.js` (`panneauCloche` : « Voir tout » bouton ; confirmation de suppression ; `__vrmFormulaireV` 7 ⇒ 8) — aucune
  des lignes changées ici, mais `__vrmFormulaireV` (ici 7.1) se résout en prenant **8** ; aussi `scripts/bancs/favoris-auto.cjs`,
  `audit-messages-malins.cjs`, `audit-coherence.cjs`, `src/App.jsx` (EXT_CAPACITES / EXT_ATTENDUE), versions, zips, CLAUDE.md,
  `nouveautes.js` : conflits de texte à fusionner (garder les deux).
- **#1329** et **#1331** touchent `vrm-badge.js` / `vrm-ui.js` (Vestiaire, Leboncoin) : pas les fonctions des favoris d'ici ;
  versions, zips, `App.jsx`, CLAUDE.md : conflits de texte.
- **#1311** : versions, zips, `App.jsx`, `audit-coherence.cjs`, CLAUDE.md seulement.
- Après la fusion des PR du train, la version servie remonte à 5.44x : chaque PR doit garder les capacités `favorislienapp` /
  `favoriscommande` à **5.440.1** dans `EXT_CAPACITES` et `audit-coherence.cjs`.
