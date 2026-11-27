# 27 nov. soir — Favoris : « article ou destinataire pas confirmé », la file arrêtée (ext. 5.455.3)

Branche `claude/favoris-identite-fix`. Données des bancs INVENTÉES (dépôt public).

## Le symptôme (Julien, 27 nov. 17:31, compte tomj606, nouvelle messagerie `/inbox/<uuid>`)
Favoris → « Messages aux favoris · 0 envoyés · 1 pas envoyé · 3 en attente » ;
« Interrompu : L'article ou le destinataire du fil n'a pas été confirmé. Aucun message envoyé. » ;
le 1er favori « Ignoré · article ou destinataire pas confirmé ». Rien n'est parti.

## La cause (code + formes déjà mesurées ; la vraie base n'était pas joignable depuis cette session)
1. **La file s'est ARRÊTÉE parce que le refus est tombé à l'étape « conversation ».** Le serveur ne saute un favori
   (`refusLocal`) que si rien n'est écrit, ou seulement la conversation vide aux étapes vérification / historique /
   écriture / envoi. Le chemin par requêtes (5.455) faisait ses vérifications d'identité SOUS `etape('conversation')` ⇒
   le refus n'était pas « local » ⇒ la phrase brute de `RAISONS_FAVORIS.identite_non_confirmee` + « Les messages restants
   ne sont pas envoyés » (exactement l'écran). Prouvé par `favoris-progression.test.mjs` (3ᵉ test 5.455.3).
   Conséquence : l'échec venait de l'une des trois vérifications faites à cette étape : (a) conversation relue ≠ uuid ou
   illisible, (b) `opposite_users` ≠ exactement le destinataire, (c) `data.items` portant un autre id.
2. **Ces trois vérifications jugeaient des formes jamais mesurées** : `2026-11-23-favoris-auto.md` §« Ce qui reste »,
   point 4 : « les sous-champs `opposite_users[].id` et `data.items[].id` sont supposés (seule leur présence est
   mesurée) ». `idsDe` prenait `x.id` avant `item_id` (une ligne `{id: <ligne>, item_id: <article>}` ⇒ « autre article ») ;
   la relecture partait 0,8–1,6 s après la création alors que Vinted rend un `read_after_write_token` (sa lecture peut
   retarder : un 404 ⇒ (a)), sans aucune seconde lecture.
3. **La `transaction_id` rendue par `inquiries` (mesurée le 23 nov. : `{inquiry_id, transaction_id, conversation_id,
   read_after_write_token}`) était jetée.** La conversation mesurée « à commande » n'a ni `data.items` ni transaction ;
   l'ancienne relecture peut répondre 404 ⇒ ni article ni transaction ⇒ (e) refus, ou plus tard pas d'offre.
4. **Toutes les vérifications disaient la même phrase** (`identite_non_confirmee`) — et une variable manquante du message
   ({marque}, {taille}) aussi : impossible de savoir laquelle depuis son écran.

Sur la 5.455.2, l'audit `audit-favoris-requetes-vintex.cjs` (`AUDIT_BG=<background d'origin/main>`) est rouge 12 fois :
forme mesurée (V12), sans personne ni article lus (V13), 404 puis lu (V14), jamais lu (V15 : arrêt au lieu de saut),
contradictions mal nommées (V16a/b), deux transactions différentes ENVOYÉ quand même (V16c), ids en texte + vendeur dans la
liste (V16d), {marque} (V17), prix du dressing (V18), V2/V4 mal nommés.

## La décision (Julien, 27 nov. 17:40 : « tu dois faire comme les concurrents »)
Vintex et Bleam ne refusent pas après la création : l'identité est celle de la DEMANDE (`inquiries {item_ids:[X],
receiver_id:Y}`, Vinted bâtit LA conversation de cet article et de cette personne). La relecture sert à l'HISTORIQUE.

## Ce qui est livré (background.js, `executerMessageFavori`, chemin `requetes`)
- uuid de la création ; **transaction de la création** (`txCreationFavori`) si la conversation n'en dit pas ; deux
  transactions différentes (création ≠ conversation) ⇒ refus `article_different`.
- `etape('verification')` dès la création confirmée (⇒ un refus de CE favori le saute, la file continue ; trois de suite
  l'arrêtent toujours, règle du 22 nov.).
- Relecture jusqu'à **3 fois** (`PAUSES_FAVORI.relire` 1,5–3 s) ; reconnue par son uuid (`id`, `uuid`, `conversation_id`),
  réponse emballée ou à plat (`convMessagerieLue`). Jamais relue ⇒ **sauté** (`ignore`, `fil_non_relu`).
  Historique illisible ⇒ **sauté** (`ignore`, `historique_non_verifie`). Déjà écrite ⇒ sauté (inchangé).
- Identité : refus seulement sur une **contradiction LUE** — une autre personne (`id` / `user_id` / `user.id`, nombre ou
  texte, le vendeur lui-même écarté) ⇒ `destinataire_different` ; un autre article (`item_id` d'abord, comme
  `articleLigneCommande`) ou l'article / l'acheteur / le vendeur de la transaction différent ⇒ `article_different` /
  `destinataire_different`. Absent ou d'une autre forme ⇒ on continue (forme notée `vrmFormesFavori`, jamais une valeur).
- Prix de l'offre : la transaction, sinon **SON dressing** (par l'identifiant de l'article) — plancher (`offreAvecPlancher`)
  et `gardePrixEcriture` inchangés. Sans aucune transaction, pas d'offre possible (refus `offre_prix_inconnu`, inchangé).
- Titre `{article}` : transaction, sinon ligne de CET article dans la conversation, sinon dressing ; sinon « cet article ».
- Variables : `{marque}` / `{taille}` inconnues ⇒ **version neutre** (`<favoris-perso-regle>`, src/favorisPerso.js, recopié) ;
  une variable de prix ⇒ `offre_prix_inconnu` ; sinon `variable_manquante` (cause `variable:<nom>`), plus jamais
  « article ou destinataire pas confirmé » (`raisonChoixFavori`, aussi dans le chemin par clics).
- Garde-fous inchangés : autorisation serveur à usage unique, plafonds réservés, 403/429/captcha, une requête à la fois,
  compte de l'onglet, `ECRITURES_FAVORI`.

## Les mots (codes neufs, partout)
`fil_non_relu` (saut), `destinataire_different`, `article_different`, `variable_manquante` (refus locaux) :
`RAISONS_FAVORIS`, `RAISONS_LOCALES`, `MOTS_REFUS`, `MOTS_SAUT` (+ `historique_non_verifie`), `CAUSE_ACCUSE` (`variable`),
liste blanche du serveur (`api/_lib/favoris-file.js`), `src/favorisEcran.js`, `fav.bilan.r.*` / `fav.bilan.s.*` (5 langues),
`fa_r_*` et `f6_r_*` de vrm-ui.js (5 langues), `RAISONS_FAV` de vrm-action.js ; bloc `<gardes-app>` recopié.

## Preuves
- `audit-favoris-requetes-vintex.cjs` : 23 verts (V12–V18 neufs) ; rouge 12 fois sur la 5.455.2 ; `--prouve` : 15
  mutations, toutes rouges (dont `tx-creation-ignoree`, `une-seule-lecture`, `identite-stricte`, `fil-arrete`,
  `sans-article`, `sans-prix-dressing`, `variable-bloque`).
- `audit-favoris-perso.cjs` (P2 : {marque}/{taille} ⇒ « Ta paire te plaît ? »), `favoris-progression.test.mjs`
  (sauté + file continue ; le cas 5.455.2 arrêtait la file).
- Tous les `audit-*favori*`, tests `*favori*` (83), `audit-coherence`, `audit-extension-zip`, `audit-sans-vintex`,
  `audit-traduction`, `audit-quoi-de-neuf`, `npm run build`, banc `e2e-extension` (voir le rapport de session).

## Ce qui reste à mesurer (un vrai envoi)
La forme réelle de `opposite_users[]` et `data.items[]` d'une conversation de favori : désormais notée d'elle-même
(`vrmFormesFavori`, diagnostic `favori_req_identite_demande` / `_conversation`, `favori_req_tx_creation`,
`favori_req_prix_dressing`) au premier envoi.

Geste de Julien : installer **5.455.3** (remplacer le dossier, ⟳ dans chaque Chrome), puis relancer l'envoi.
