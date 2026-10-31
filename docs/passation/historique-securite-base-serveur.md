# Historique — securite-base-serveur

> Texte déplacé TEL QUEL depuis `CLAUDE.md` le 31 octobre 2026 (allègement du dossier : 1,36 Mo → moins de 60 Ko).
> Rien n'a été réécrit : les paragraphes gardent leur ordre d'origine. Le classement par thème est automatique (mots du titre) — en cas de doute, chercher par `grep` dans tous les `docs/passation/historique-*.md`.

> **29 octobre (revue) — « TA CLÉ PHOTOROOM » : dix défauts reproduits, corrigés :** (1) « Vérifier » sans réponse de
> Photoroom (coupure, 5xx, forme inconnue) n'écrit plus RIEN : la dernière réponse connue reste (un REFUS restait sinon
> effacé, et le Studio reproposait le détourage), la route dit `sansReponse` et la carte nomme la dernière vérification ;
> (2) Studio : une opération (détourage local ou Photoroom, rangement, retrait) reste liée à SA paire — changer de paire
> pendant un détourage affichait la photo de la N°42 sous « N°43 » et la téléchargeait « VRM-43 » ; (3) la copie EN CLAIR
> est recherchée et effacée à CHAQUE ouverture tant qu'elle existe (un DELETE raté n'était jamais retenté), « maintenant
> chiffrée » n'est dit que si la base a confirmé l'effacement ; une clé en clair PLUS RÉCENTE (ancienne app restée
> ouverte) ou un coffre illisible : elle remplace celle du coffre ; (4) clé du vendeur pas lue ⇒ 503 `cle-pas-su`, jamais
> un repli sur la clé du serveur (§2.9 : avec `PHOTOROOM_POUR=tous`, le hoquet dépensait la clé de Julien) ; le Studio
> n'attribue plus à Photoroom un refus de VRM (`source`) ; (5) « acceptée » exige un JSON `images|credits` en objet —
> un 200 de portail/proxy vaut « pas su » (forme notée dans les journaux, jamais une valeur) ; (6) « en clair » dit SA
> cause (`cause` : rangement raté · coffre absent) et ne prétend plus que Photoroom a été interrogé ; (7) vérification et
> migration en comparer-et-échanger (`data.rev`, PATCH filtré ; création seule `INSERT` puis annulation de NOTRE ligne si
> l'ancienne a disparu entre-temps) : une clé RETIRÉE ou REMPLACÉE pendant une vérification ne revient plus ; (8) « une
> photo déjà détourée n'est jamais repayée » → « …et gardée par VRM n'est pas repayée » ; (9) « sans formule API » ⇒ pas
> de bouton dans le Studio, la raison dite une fois ; (10) ⚠️ **la carte n'est PLUS dans Paramètres → Mon compte**
> (décision du 17 oct. « ne le mets pas dans les paramètres » ; la demande du 29 n'en parlait pas) : elle vit sur l'écran
> Vestiaire Collective, et `detourage-reglage.cjs` refuse la CARTE (`data-photoroom-cle`) dans les deux onglets des
> Paramètres, pas un mot. Preuves : `audit-photoroom-cle.cjs` **88 contrôles** (33 rouges sur 321dcad, 58 sur
> origin/main ; 10 mutations sur 10 rouges, script de mutations hors dépôt) ; bancs
> `photoroom-carte.cjs` 140 (24 rouges sur 321dcad, 76 sur origin/main, mutation « maintenant chiffrée sans effacement »
> rouge), `studio-photo.cjs` (+ course et sans formule API : 6 rouges sur 321dcad, mutation « toujours la même paire »
> rouge), `detourage-reglage.cjs` (2 rouges sur 321dcad — vert sur origin/main, où la carte n'était pas dans les Paramètres : le
> défaut venait du chantier ; mutation « carte remise sous un autre titre » rouge). Preuves refaites à la reprise (après la
> limite d'utilisation) : build, audit, trois bancs, arbres d'avant (`a0d43bde` = origin/main d'alors, `321dcad`), 10 mutations.
> Le banc `detourage.cjs` exigeait l'ANCIEN repli (« clé vendeur pas lue ⇒ clé du serveur, 403 ») : il exige maintenant 503
> `cle-pas-su` et zéro appel à Photoroom (rouge sur 321dcad et origin/main, rouge sous la mutation « pas su lu aucune »).
> Rouges hérités d'origin/main, pas touchés : `audit-politique-hotes` (vinted.fr dans 2 fichiers), `audit-pont-session`,
> `audit-preuve-vente`, banc `reglages-premium` (chevrons à 1512 px).
> ⚠️ Non mesuré : la vraie réponse de `v2/account`, le `DELETE … return=representation` filtré sur `data->>at` et le
> `PATCH` filtré sur `data->>rev` contre SA PostgREST (formes documentées, jamais envoyées d'ici) ; l'extension ne
> connaît pas `cle-pas-su` (elle garde la photo d'origine et réessaie photo par photo — pas touchée ici). **Geste de
> Julien** : dire s'il veut AUSSI la carte dans Paramètres → Mon compte (retirée par prudence) ; sa clé se range depuis
> l'écran Vestiaire Collective.

> **29 octobre — « TA CLÉ PHOTOROOM » : chaque vendeur range SA clé (chiffrée), carte refaite, bouton dans Studio photo :**
> Julien : « fais un meilleur visuel pour la clé API Photoroom des personnes qui utilisent VRM ». Mode `photoroom` de
> `/api/compte` (`api/_lib/photoroom-cle.js`, toujours 12 fonctions) : GET = état (`aucune` · `posee` · `illisible` ·
> `en-clair` sans coffre · 503 pas su), POST `poser` (vérifiée chez Photoroom par `GET image-api.photoroom.com/v2/account`,
> qui ne consomme aucune image — 401/403 ⇒ refusée, RIEN rangé ; 402 ⇒ « sans formule API » ; muet ⇒ rangée « pas encore
> vérifiée »), `verifier`, `retirer` (`confirme: true` exigé). La clé va dans `app_data.photoroom_cle`, CHIFFRÉE (coffre
> commun `api/_lib/coffre.js`, AES-256-GCM, `VRM_COFFRE_CLE` ou dérivée de `SUPABASE_SERVICE_KEY` ; Super PDP y passe, même
> format) ; sans coffre, rien n'est rangé ; aucune réponse ne la contient (4 derniers caractères seulement). Une clé d'avant
> en clair (`vrm_photoroom_cle`, lisible par le navigateur — **1 ligne en production, mesurée le 29 oct.**) est chiffrée puis
> effacée à la première lecture. `api/_lib/detourage.js` lit le coffre (puis l'ancienne ligne en repli) : avec SA clé, son
> compte paie, sans plafond ; sans clé à lui, comme avant (§2.9). App : `ClePhotoroom` (`src/photoroomCle.js`) sur
> l'écran Vestiaire (⚠️ plus dans Mon compte depuis la revue, voir au-dessus) — trois états (`data-photoroom-cle`), ce que ça coûte (son compte, à la photo,
> ~0,02 $ relevé le 4 oct.), où elle sert (Vestiaire, Studio photo ; Leboncoin/eBay gardent leurs photos d'origine), le lien
> vers Photoroom. ⚠️ Ce n'est PAS le réglage « détourer avant de publier » refusé le 17 oct. (`detourage-reglage.cjs` exige
> toujours son absence, Mon compte compris). **Studio photo** : « Détourer avec Photoroom » seulement si SA clé est lue et
> pas refusée ; la photo part à `/api/ai?mode=detourage` avec sa session (jamais à Photoroom depuis le navigateur). Retirés :
> `lireClePhotoroom`/`sauverClePhotoroom` (lecture/écriture EN CLAIR côté navigateur). Preuves : `audit-photoroom-cle.cjs`
> (44 ; 33 rouges sur origin/main ; 7 mutations rouges), banc `photoroom-carte.cjs` (390 tactile + 1512, clair et sombre, 110 ;
> 41 rouges sur le build d'origin/main ; mutations « Retirer sans confirmer » et « pas su lu aucune » rouges),
> `studio-photo.cjs` (+ scénario clé rangée ; 4 rouges sur l'avant ; mutation « bouton sans clé » rouge).
> ⚠️ Non mesuré : la vraie réponse de `v2/account` (forme tirée de la doc indexée de Photoroom) ; une clé « sandbox » ;
> la carte sur un vrai iPhone. **Geste de Julien** : ouvrir l'écran Vestiaire Collective → « Ta clé Photoroom » (sa clé
> d'avant se chiffre toute seule), puis « Vérifier chez Photoroom ».

> **29 octobre — Republier GARDE la taille de la paire : VRM la retrouve dans la grille de Vinted (5.275) :** Julien : « VRM doit
> pouvoir regarder la taille, garder toutes les infos de l'article ». Sur un refus `size` (Mise en ligne d'un brouillon, Refaire,
> Republier par brouillon, création directe), `secoursTaille` lit la grille de la catégorie (`POST /api/v2/item_upload/attributes`
> `{attributes:[{code:'category',value:[cat]}]}`, requête MESURÉE dans ses navigateurs, 200 ; la RÉPONSE jamais vue : lue
> défensivement — nœud `code: 'size'` ou clé `sizes`, options `{id, title}` —, forme gardée `tailles_reponse_forme`, grille
> gardée 24 h par catégorie `vrmTaillesVinted`), prend la taille de la PAIRE par identité (`coffre_{uid}_{ancienId}.size`, sinon
> le `size` de l'annonce dans son dressing — jamais le titre), ne pose qu'UNE option au libellé EXACT (« 38 » = « 38 », « EU 38 »,
> « 38 EU » ; « 38,5 » ≠ « 38 »), garde les autres attributs (état…), UN nouvel essai, brouillon enregistré à jour. Deux options
> au même libellé, aucune, taille inconnue, grille illisible ⇒ rien posé et la phrase dit pourquoi + le geste Vinted. Barre :
> étape `secours-taille`. Preuve : `audit-recreer.cjs` (122 ; 7 rouges sur la 5.274 ; mutation « libellé par sous-chaîne » ⇒ 2
> rouges). ⚠️ Non mesuré : la vraie forme de la réponse des attributs (si elle n'est pas lue, la phrase le dit et la forme est
> rangée dans `panel_diag_capture` pour la passe suivante).

> **28 octobre (nuit, fin) — LES COULEURS DE VINTED, mesurées (5.266) :** « Republier sans blocage sur la couleur ».
> Mesuré : aucune ligne de sa base ne porte le NOM d'une couleur (les corps acceptés n'ont que `color_ids`), mais sa page de
> dépôt charge `GET /api/v2/item_upload/colors` (vu sur ses 7 comptes). `inject.js` la capte en passant
> (`noteCouleursVinted`, id + nom seulement) ; sinon `couleursConnues` la lit UNE fois (lecture, budget « clic », 24 h
> entre deux essais) quand un brouillon sans couleur demande le choix. Rangée dans `chrome.storage.local.vrmCouleursVinted`
> (`nettoyerCouleurs` : un nom de couleur, ≥ 3 entrées, et si le n°1 existe il doit être « Noir » — le seul mesuré dans une
> annonce acceptée — sinon refusée). `couleur-absente` rend toute la liste ; l'app (`askChoix`, une feuille, un bouton de
> 44 px par couleur, « Pas maintenant ») le laisse choisir ; une couleur hors liste n'est jamais envoyée. Une seule connue ⇒
> l'ancienne question « Noir — publier ». Preuves : `audit-recreer.cjs` (116 ; 3 rouges sur la 5.265), banc `republier.cjs`.

> **28 octobre (soir) — ses BROUILLONS Vinted, et « brouillon puis en ligne » (5.251) :** Julien : « voir ses
> brouillons, faire passer le statut de brouillon à en ligne ». Formes MESURÉES dans ses requêtes :
> `POST /api/v2/item_upload/drafts` `{draft:{id:null,…},parcel:null,upload_session_id}` puis
> `POST …/drafts/{id}/completion` (même corps, `draft.id` posé, `push_up:false`) ; un brouillon publié GARDE son
> identifiant. (1) Annonces → **Brouillons · N** (`BrouillonsVinted`, dressing `is_draft`, par compte) : « Mettre
> en ligne » (confirmé, `publierBrouillon`) seulement si l'extension a le CORPS accepté par Vinted
> (`vinted_brouillon_{id}`, capté quand il enregistre le brouillon — `inject.js` `noteBrouillon`), du même compte,
> présent dans son dressing comme brouillon, et complet (titre, prix, photos, catégorie, description) — sinon
> « Ouvrir sur Vinted » ; rien n'est complété ni deviné. Les brouillons d'avant la 5.251 ne sont pas connus : les
> rouvrir et les enregistrer une fois. (2) **Republier** : « Passer par un brouillon Vinted, puis le mettre en
> ligne » (allumé par défaut, `viaBrouillon`) — photos → brouillon → 5 s → mise en ligne → SEULEMENT ALORS
> suppression de l'ancienne ; brouillon ou mise en ligne refusés / sans réponse ⇒ rien supprimé ; 3 gestes du
> plafond horaire par paire. (3) Visuel : l'étiquette N° sur les cartes Vinted (lien superposé à la photo) était
> étirée en barre sombre en bas ⇒ pastille en haut à gauche ; au téléphone, « Republier » était écrasé dans la case
> de 44 px du micro, le champ de recherche dessinait deux boîtes, l'icône du tri était un carré vide. Preuves :
> `audit-recreer.cjs` (49 ; 19 rouges sur la 5.250), bancs `republier.cjs` et `numero-vinted.cjs` (barre étirée
> reproduite sur l'avant : 194 px en bas de la photo). ⚠️ Non mesuré : la RÉPONSE de `POST …/drafts` (id lu
> défensivement : `draft.id`, `item.id`, `id` ; illisible ⇒ rien n'est mis en ligne) et l'adresse d'édition d'un
> brouillon (`/items/{id}/edit` supposée).

> **28 octobre (soir) — « Republier » SUPPRIME ET RECRÉE l'annonce, photos réglées (5.248) :** Julien : « je veux
> que ça supprime et recrée l'annonce », « en modifiant les photos, c'est ce qu'on avait commencé dans Préparer ».
> Mesuré d'abord (ses requêtes du 26 oct., `harvest_*_wreq_*`, noms et types seulement) : `POST /api/v2/photos`
> (FormData `photo[type]=item`, `photo[file]`, `photo[temp_uuid]`), `POST /api/v2/item_upload/items`
> (`{item:{id:null,…,temp_uuid,assigned_photos:[{id,orientation:0,…}],item_attributes,package_size_id,
> shipment_prices:{domestic:null,international:null}},parcel:null,push_up:false,upload_session_id=temp_uuid}`),
> `POST /api/v2/items/{id}/delete`. Extension `recreerVinted` : photos du coffre (réglages redresser/lumière/
> contraste/saturation/zoom refaits EN PIXELS à partir de l'original, `OffscreenCanvas`), téléversées → création →
> identifiant lu → SEULEMENT ALORS suppression de l'ancienne. Photo ou création refusée, ou création sans
> identifiant ⇒ rien n'est supprimé ; suppression refusée ⇒ « en vente DEUX fois », dit. La recette (catégorie,
> taille/état/matière, colis, marque, couleurs) : le corps accepté de CETTE annonce (`vrm_vinted_modele`), sinon
> les codes de sa fiche — jamais devinée ; mesuré : 6 annonces la portent aujourd'hui (celles modifiées à la
> main) ; les autres ⇒ « pas faite » + le geste (Modifier → Enregistrer une fois sur Vinted). La recette de la
> NOUVELLE annonce est gardée : la recréation suivante n'a rien à réapprendre. L'app reporte le N° sur la
> nouvelle annonce (`recreeDe`, l'ancienne fiche reste pour l'historique), la suppression est notée (plus
> présente). Réglages photo communs à la sélection, dans l'étape « Modifier ». Gestes : créer + supprimer = 2
> des 20 actions/heure. ⚠️ Non mesuré : la RÉPONSE de `POST /api/v2/photos` (id lu défensivement ; illisible ⇒
> rien créé, `recreer_photo_*` dans `panel_diag_capture`). Preuves : `audit-recreer.cjs` (20, mutations
> « supprimer avant de créer » 4 rouges, « sans garde d'identifiant » 1), banc `republier.cjs` (rouge sur #807).

**Lis ce fichier en entier avant de coder. Il est court exprès.**
L'historique détaillé (chaque session, chaque mesure, chaque erreur et sa cause)
vit dans **`docs/journal-2026.md`** — 7 700 lignes, à ouvrir seulement si tu
cherches *pourquoi* une règle existe. Tout ce qui est nécessaire pour travailler
sans rien casser est ici.

### Le panneau « Sécurité des données » (Réglages)
C'est le SEUL endroit où des étapes techniques sont assumées : passer le dépôt
en privé, appliquer la migration SQL, poser `SUPABASE_SERVICE_KEY` sur Vercel —
**ces gestes n'appartiennent qu'à lui** (il possède les comptes). Le vocabulaire
d'informaticien y est donc justifié ; ne pas « simplifier » ce bloc.
- ⚠️ **Une sonde qui n'a pas répondu n'est PAS une alerte.** Le panneau sonde la
  base à chaque ouverture. Deux de ses cinq lignes écrivaient
  `ok={s.X === true}` : un sondage **raté** (`null`) devenait `false`, donc le
  triangle d'alerte — et le texte dessous déroulait le diagnostic complet d'un
  problème **qu'on n'avait pas mesuré**. Vu en capture le 7 septembre :
  « Création de compte · … » en ambre. `Ligne` savait pourtant afficher
  l'attente (`ok === null`) ; c'est l'appelant qui écrasait l'information.
  Sur un panneau de SÉCURITÉ, une fausse alerte est ce qui fait cesser de lire
  les vraies. État inconnu = **gris**, « pas encore vérifié », et une phrase qui
  dit de rouvrir l'écran — jamais un diagnostic.
  `audit-chiffres.cjs` le vérifie. ⚠️ Son premier jet exigeait la **formule**
  `== null ? null` et criait au loup sur `ok={s.colonne}` (qui laisse passer le
  `null`, c'est-à-dire exactement ce qu'on veut). Il porte maintenant sur la
  règle : est fautive une expression qui **aplatit en booléen** sans jamais
  pouvoir rendre `null`.
  ⚠️ Et le même défaut avait deux autres restes, trouvés en relisant le bloc :
  `action={!s.colonne && …}` affichait le bouton **« Copier la migration SQL »**
  quand la sonde avait échoué (proposer le remède sans diagnostic), et le badge
  du titre affirmait **« partagées »** dès que `proteges` était faux — or il
  l'est aussi quand les deux sondes n'ont rien pu lire. Trois états, pas deux.


### ⚠️⚠️ QUAND LA BASE NE RÉPOND PAS, L'APP DISAIT « TOUT VA BIEN »
**Le 10 septembre la base Supabase était réellement injoignable** — 522
Cloudflare, trois essais, réponse HTML. Rendue dans cet état, l'app affichait :
- **Ma journée** : « Rien d'urgent — ta boutique tourne. 👌 » puis
  « 🎉 **Tout est à jour ! Rien à expédier, rien à retirer** » — avec **14 colis
  à expédier** et **6 à retirer** ;
- **Colis** et **Achats** : « **Aucun compte Vinted lié** — installe l'extension
  Chrome » — à quelqu'un qui en a **neuf** et dont l'extension tourne ;
- **Tableau de bord** : « **Bienvenue 👋** · connecte ton compte pour commencer ».

C'est **le mensonge le plus coûteux que l'app puisse produire** : il l'ouvre le
matin, lit « tout va bien », et ne poste pas ses colis.

**Cause** : `fetchVintedAccounts` rendait `[]` **à la fois** pour « aucun
compte » et pour « la base n'a pas répondu ». §4.1 dit de rendre `[]` plutôt que
de lever — **oui, mais l'app doit SAVOIR que c'est un échec** pour ne pas
l'afficher comme un fait. C'est §4.1 **retourné**, et c'est la cinquième forme
du même piège (panneau de sécurité, capacités de l'extension, `labelsCaptes`,
comptes exclus) : **« pas su » ne vaut pas « oui », et « rien lu » ne vaut pas
« rien ».**
⇒ La lecture rend **`null` sur échec** (y compris quand la réponse n'est pas un
tableau : un 522 renvoie du HTML), `baseKO` porte l'information, et un seul bloc
`BaseInjoignable` dit ce qui se passe, **ce que ce n'est pas** (« rien n'est
perdu — c'est la lecture qui échoue, pas tes données ») et le geste.
⇒ Un « ↻ Actualiser » pendant la panne n'**efface** plus la liste des comptes.
⚠️ **Mon premier correctif a raté DEUX écrans, et c'est le banc qui l'a vu :**
- **Ma journée** est montée à part (`tab==='journee'`), pas dans la table `map`
  des écrans — elle ne recevait donc pas `baseKO`. J'avais réparé Colis, Achats
  et le tableau de bord… en laissant mentir **l'écran qu'il ouvre le matin**.
- Le tableau de bord porte **DEUX** « tout est à jour » : celui de l'onboarding
  et celui de la liste « À faire » vide.
⇒ *Corriger « partout » se vérifie au RENDU, écran par écran, jamais en relisant
le code.*
⚠️ Le banc `panne.cjs` sert la **vraie forme** de la panne (522 + HTML, pas un
JSON d'erreur) et vérifie **les deux sens** : aucun mensonge pendant la panne,
et **aucune fausse alerte** en marche normale. **8 échecs** sur le code d'avant.


### ⚠️⚠️ ET CE BANC NE RENDAIT QUE LES 4 ÉCRANS QUE JE VENAIS DE CORRIGER
Le 11 septembre, élargi aux **15 écrans joignables** : **huit** se taisaient
pendant la panne, et cinq affirmaient pour de bon. *Un banc qui ne rend que les
écrans du correctif prouve le correctif, jamais la RÈGLE* — c'est mot pour mot
la leçon de l'île d'actions (trois écrans y échappaient parce qu'aucun banc ne
les rendait). **19 échecs** sur le code d'avant, 0 après.
- ⚠️⚠️ **LE PANNEAU DE SÉCURITÉ AFFIRMAIT « Lecture sans compte · fermée —
  seule une session identifiée lit tes données », en VERT.** Alors que RLS est
  désactivé et que la clé publique lit tout. Le défaut n'était pas dans
  l'affichage (corrigé le 7 septembre, `ok={…}` laisse passer `null`) mais
  **dans la sonde** : `out.lisibleSansCompte = r.ok ? … : false`, donc tout
  échec valait « fermée ». Deux autres du même bloc : `out.colonne = res.ok`
  (→ « colonne absente » **et** le bouton « Copier la migration SQL » : le
  diagnostic ET son remède, sur une mesure qui n'a pas eu lieu) et
  `setSrv({})` (→ « clé de service manquante »). **Seul un 400 PostgREST dit
  « colonne absente » ; seul un 401/403 dit « fermée » ; seul `ok:true` mesure
  les routes.** Sixième forme de « pas su ne vaut pas oui » — et la première
  où le mensonge est un **feu vert**, sur l'écran qui sert à décider si ses
  données sont protégées. `audit-chiffres.cjs` pose la règle là où la mesure
  est FAITE : une sonde doit pouvoir rendre `null` — rouge sur le code d'avant,
  et il y **nomme les trois sondes**.
- **« Comptes Vinted liés » disait « Aucun compte détecté · installe
  l'extension »** à quelqu'un qui en a neuf — pire que faux : une consigne à ne
  surtout pas suivre, réinstaller l'extension ne répare pas une lecture.
- **Leboncoin fêtait « Tout est publié 🎉 »** une file jamais lue. Cet écran
  lit lui-même (`sbGet` rend `null` sur échec) : il porte donc son propre
  `echecLecture`, il n'a pas besoin de `baseKO`.
- ⇒ **La garde ne se pose plus écran par écran : elle est sur la COQUE**,
  au-dessus de `EcranGardeFou` — un seul `{baseKO && <BaseInjoignable/>}`, qui
  couvre aussi les écrans pas encore écrits. Les écrans gardent une
  **`LignePanne`** là où leur propre liste vide mentirait ; le bloc, lui, ne
  s'affiche qu'une fois.
- ⚠️ §7 sur le même écran : une fois le bloc posé, Ma journée disait la panne
  **trois fois** (bloc + sous le bonjour + liste vide). Le banc compte les
  occurrences : bloc ×1, ligne ≤1.
- ⚠️ **Deux fois de plus, mes contrôles ont crié au loup** (cinquième et
  sixième) : `/Tout est publié/i` attrapait la phrase HONNÊTE que je venais
  d'écrire (« …pas parce que tout est publié ») — c'est la FÊTE qui est
  interdite, 🎉 compris ; et le balayage des sondes s'est déclenché sur **mon
  propre commentaire**, qui cite l'ancienne ligne. **Un audit lit le CODE** :
  les commentaires sont retirés d'abord.


### ⚠️⚠️ LES ROUTES `api/` N'AVAIENT JAMAIS APPRIS LA LEÇON — ET ELLES, ELLES DÉTRUISENT
Le 11 septembre, troisième jour de base injoignable, Julien : « **je reçois
plus les messages** ». L'app venait d'apprendre cinq fois que « rien lu » ne
vaut pas « rien ». Les **routes serveur**, que `npm run build` ne compile même
pas (§4.10) et qu'**aucun banc n'avait jamais exécutées**, ne l'avaient jamais
apprise. **6 échecs** sur le code d'avant (`scripts/bancs/serveur.cjs`), 0 après.

- ⚠️⚠️ **`api/email-inbound` acquittait des emails qu'il n'avait pas rangés.**
  `supabaseUpsert` rendait bien `res.ok` — et **aucun de ses douze appels ne le
  lisait**. La route répondait **200**, c'est-à-dire « je l'ai, tu peux
  l'oublier » : le service de réception **supprime** alors le message. Trois
  jours de panne = trois jours de **ventes, bordereaux, suivis et messages
  perdus pour de bon**. C'est §5 « on ne jette aucun email » retourné.
  Le commentaire du `catch` final disait même, en toutes lettres : « *on répond
  200 pour éviter que le service de mail ne rejoue* » — or **rejouer est
  exactement ce qu'on veut**. Une écriture ratée se retient dans le contexte de
  la requête (`marquerEcritureRatee`, jamais une variable de module : deux
  emails se traitent en parallèle) et `repondre()` transforme tout succès en
  **503**.
  ⚠️ **Et la moitié qui compte est chez Cloudflare** : le Worker de
  `docs/email-pipeline.md` faisait `await fetch(...)` **sans regarder la
  réponse**. Le serveur peut bien dire « je n'ai pas pu », personne ne l'écoute.
  Il fait maintenant `if (!rep.ok) throw` — Cloudflare réessaie. *Un correctif
  serveur qui dépend d'un client qu'on ne corrige pas ne corrige rien.*
  ⚠️ **Un email RECONNU dont l'analyse échoue n'était conservé nulle part** :
  le jour où Vinted change une tournure, les ventes partent une par une en
  silence. `garderInconnu` est appelé avant de répondre.
- ⚠️⚠️ **`api/push` EFFAÇAIT ses autres téléphones.** `loadSubs()` rendait `[]`
  aussi bien pour « aucun appareil » que pour « je n'ai pas pu lire » ; or
  `subscribe` fait **lire-ajouter-réécrire**. Une lecture ratée repartait donc
  d'une liste vide et **réécrivait `push_subs` avec le seul appareil courant**.
  Ce n'est pas un affichage faux, c'est une **perte**. Le banc sert exprès un
  troisième état — **lecture KO, écriture OK** (un simple timeout, la base
  debout par ailleurs) — parce qu'en panne totale l'écriture échoue aussi et le
  défaut **ne se voit pas**. `loadSubs` rend `null`, et on n'écrit pas.
  La route répondait par-dessus `{ok:true}` → l'app affichait « ✅ Activé ».
- ⚠️ **`api/widget` annonçait `0 à expédier · 0 à retirer · 0 €`** sur l'écran
  d'accueil de son iPhone. Un chiffre **absent** est honnête, un zéro inventé
  ne l'est pas : la route répond 503 **sans aucun nombre** (un widget qui ne
  trouve pas `ship` affiche un tiret, jamais « 0 »).
  ⚠️ Effet de bord trouvé au passage : la **clé** du widget vit dans la ligne
  `main`. `main()` rendant `{}` sur échec, `expected` valait `''` et **la route
  répondait sans clé**. Se taire referme aussi ça.
- L'app, elle, était déjà juste : elle fait `if (!r.ok) throw`. **C'est le
  serveur qui lui mentait.** Elle affiche maintenant la phrase de la route
  (« le serveur de données ne répond pas · rien n'est perdu · réessaie »)
  plutôt que « enregistrement serveur échoué ».


### ⚠️⚠️ ET L'EXTENSION ACHETAIT LE MÊME DÉFAUT ONZE FOIS
Mesuré le 11 septembre, après le serveur : l'extension range ses données dans
des lignes **dédiées** (§« l'extension n'écrit jamais la ligne `main` ») et les
met à jour en **lire-fusionner-réécrire**. Dix de ces onze endroits écrivaient
`const cur = (rows && rows[0] && rows[0].data) || {}` — or `sbGet` rend `null`
quand la base **n'a pas répondu**. La fusion repartait alors d'un objet vide et
l'écriture **remplaçait la ligne par la seule clé courante**.
Un simple timeout de lecture, la base debout par ailleurs, suffisait à effacer :
| ligne | ce qu'il perdait |
|---|---|
| `panel_min_prices` | **tous ses prix planchers**, posés à la main |
| `panel_buyprices` | **tous ses prix d'achat** saisis depuis le panneau (§2.5) |
| `panel_accounts_off` | quels comptes il a éteints — un compte exclu se rallume |
| `panel_colis_relais` | **les codes de retrait** déjà lus dans les conversations |
| `panel_bords_done` · `panel_colis_collected` | bordereaux faits, colis récupérés |
| `vinted_lbc_posted` | ce qui est déjà sur Leboncoin → tout à republier |
| `vinted_listing_dates` · `vinted_item_details` · `panel_diag_capture` · `panel_offer_statuts` | dates, descriptions, diagnostic |
- **Vérifié avant d'écrire quoi que ce soit sur l'argent** : perdre les
  planchers ne fait PAS accepter d'offre à tort — `autoAccepterOffres` refuse
  d'agir sans plancher (`if (!(isFinite(min) && min > 0)) continue`). C'est une
  perte de RÉGLAGES, pas un risque d'argent. Ne pas dramatiser au-delà.
- ⚠️ **Le cas qui détruit n'est pas la panne totale** : quand tout est tombé,
  l'écriture échoue aussi et rien n'est perdu. C'est **lecture KO, écriture OK**
  qu'il faut servir — sinon le contrôle est vert sur le défaut. Même leçon que
  `push_subs`, et c'est ce que fait `scripts/audit-fusion.cjs` (le VRAI
  `background.js` dans un `vm`). **9 échecs** sur le code d'avant, 0 après.
- ⚠️ Le fichier portait déjà, sur `panel_diag_capture`, un gros avertissement :
  « *ON RÉÉCRIT LA LIGNE ENTIÈRE : sans `...tout`, cette écriture EFFAÇAIT
  `rates`* ». La **fusion** avait été corrigée, la **lecture ratée** jamais.
  Une moitié de leçon apprise est une leçon non apprise.
- Extension passée en **5.53.0**, zip régénéré, `EXT_ATTENDUE` suivie.


### ⚠️⚠️ ET LE PANNEAU SUR VINTED FÊTAIT « TOUT EST À JOUR » PENDANT LA PANNE
**Treizième forme du piège, sur la surface qu'il regarde TOUS LES JOURS.**
Mesuré le 12 septembre, quatrième jour de base injoignable. `buildPanelData`
fait **22 lectures**, toutes écrites `(rows && rows[0] && rows[0].data) || {}`
ou `|| []` — or `sbGet` rend `null` quand la base n'a pas répondu. Tous les
compteurs tombaient à 0, et le panneau affichait
**« ✅ Rien d'urgent : tout est à jour. Beau boulot. »** avec 14 colis à
expédier et 6 à retirer. C'est le mensonge du 10 septembre, mot pour mot, dans
l'extension — et il a tourné pendant toute la panne.
- **Pire : la route répondait `{ok:true, ...r}` par-dessus.** Le panneau n'avait
  donc **aucun moyen** de faire la différence : des compteurs à zéro sont
  exactement ce qu'il voit un jour calme. `baseKO` est la seule information qui
  sépare « rien à faire » de « je n'ai rien pu lire ».
- Le bandeau se pose **UNE fois** au-dessus du corps (comme le bloc de panne sur
  la coque de l'app, §7), dit ce que ce n'est **pas** (« rien n'est perdu »), et
  **ne promet rien sur le retour** — le panneau ne peut pas le savoir.
- Les **deux replis de `load()`** portent aussi l'échec (`VIDE()`) : « pas su »
  ne vaut pas « rien », y compris quand c'est l'extension qui a été rechargée.
- ⚠️ **Le cas dangereux n'est pas la panne totale** : `audit-panneau.cjs` sert
  aussi **une seule lecture qui expire** (`orders_sold`, `email_track_`,
  `id=eq.main`), la base debout par ailleurs — même famille que « lecture KO,
  écriture OK » pour `push_subs`. **8 échecs** sur le code d'avant, 0 après,
  et il vérifie les **deux sens** (aucune fausse alerte en marche normale).
- ⚠️ **SEPTIÈME fois qu'un de mes contrôles crie au loup** : il exigeait
  `baseKO` dans l'expression du repli, et le repli vaut `VIDE()` — un helper qui
  le porte très bien. La règle est « la valeur de repli PORTE l'échec », pas
  « elle l'écrit sur place » : le contrôle suit l'expression jusqu'à sa
  définition. *Un audit suit la RÈGLE, pas son orthographe.*
- Extension passée en **5.55.3**, zip régénéré, `EXT_ATTENDUE` suivie. Aucune
  entrée d'`EXT_CAPACITES` : l'app ne promet rien de neuf, c'est un mensonge
  qu'on retire.


### « Ça revient tout seul » était faux au troisième jour
Le bloc de panne promettait une coupure passagère : « *si ça dure plus d'une
heure, c'est une panne du serveur : ça revient tout seul* ». La base est tombée
le 9 septembre et **n'est pas revenue** — le 11 l'app lui répétait encore
d'attendre, c'est-à-dire de **ne rien faire**, alors que le seul geste utile
était d'ouvrir son tableau de bord Supabase. *Une alerte qui ne dit pas quoi
faire ne sert à rien ; une alerte qui dit d'ATTENDRE quand il faut agir est
pire.*
- La durée est notée sur l'APPAREIL (`vrm_base_ko_depuis`) : c'est la seule
  chose qu'on puisse encore écrire quand la base est justement injoignable.
  Posée au premier échec, **effacée dès qu'elle répond**.
- Au-delà d'une heure, le bloc dit **depuis combien de temps** et **où aller**
  (supabase.com → le projet → souvent un bouton *Restore*, ou le disque plein).
- ⚠️⚠️ **ET J'ALLAIS Y REMETTRE UNE PROMESSE INVÉRIFIABLE** : « les emails qui
  arrivent sont mis en attente, ils seront rangés dès le retour ». Ce n'est vrai
  que si le **Worker Cloudflare** a été remis à jour (il doit relancer quand la
  route répond 503) — et **l'app n'a aucun moyen de le vérifier**. C'est le
  défaut le plus coûteux du projet (le zip, les codes de retrait) qui repointait
  dans la phrase même où je corrigeais son cousin. Retiré, et la raison est en
  commentaire dans le code.
- Le banc `panne.cjs` sert une panne **datée de 3 jours** et exige les trois
  points. **3 échecs** sur le code d'avant.
- ⚠️ **ET LE RETOUR COMPTE AUTANT QUE LA PANNE.** La marque vit sur l'appareil :
  si elle n'est pas **effacée** quand la base répond de nouveau, la prochaine
  coupure de deux minutes afficherait « depuis 5 jours » et enverrait ouvrir
  supabase.com pour un problème qui n'existe plus. Une alerte **périmée** fait
  cesser de lire les vraies, exactement comme une fausse alerte. Le banc rend
  donc l'app **base debout AVEC une marque de 5 jours** et exige que la marque
  soit partie — rouge dès qu'on retire le nettoyage (prouvé).


### ⚠️⚠️ LES QUATORZE BANCS DE RENDU NE POUVAIENT PAS ÉCHOUER
Mesuré le 12 septembre, en voulant prouver un correctif de texte : le banc
`panne.cjs`, copié dans `/tmp/av12` selon la méthode §6.1 et lancé **depuis cet
arbre**, a annoncé **118 contrôles verts** — sur un `App.jsx` qui ne contenait
même pas le mot « Restart ». Cause : `const DIST='/home/user/cancale-v67/dist'`,
un **chemin absolu**, dans les **quatorze** bancs de rendu. La méthode de preuve
existe précisément pour que `__dirname/..` ne relise pas le dépôt courant ; un
chemin absolu la contourne **sans rien dire**, et le banc mesure le CORRECTIF en
croyant mesurer le code d'avant.
⇒ C'est le défaut d'`audit-coherence.cjs` à l'échelle de tous les bancs de
rendu : **un contrôle qui ne peut pas échouer est pire qu'absent — il rassure.**
Et il invalide rétroactivement tout « N échecs sur le code d'avant » obtenu par
un banc de rendu lancé depuis `/tmp/avN` : la preuve était truquée, pas le
correctif.
⇒ `DIST` se déduit maintenant de l'emplacement DU BANC
(`path.join(__dirname,'..','..','dist')`), et `audit-bancs.cjs` refuse tout
chemin servi au navigateur qui commence par `/` sans passer par `__dirname` —
rouge sur les 13 bancs d'avant (prouvé).


### « Ouvre supabase.com, il y aura un bouton Restore » était faux aussi
Mesuré le 12 septembre sur son vrai projet, **quatrième jour** de panne : le bord
répond (401 **instantané** sur `/rest/v1/`), mais tout ce qui touche la base
expire — `/rest/v1/app_data` → **522 au bout de 20 s**, et le stockage le dit en
clair : **544 `DatabaseTimeout`, « the connection to the database timed out »**.
Un projet dans cet état n'est **pas en pause** : il n'y a donc **aucun bouton
Restore** sur sa page, et l'app l'envoyait chercher un bouton qui n'existe pas.
Le geste réel est **`Settings` → `General` → `Restart project`**.
- Les **deux** cas sont nommés, avec comment les distinguer, et deux **liens
  directs** vers SON projet — le `ref` est extrait de `SUPABASE_URL` (§11, une
  seule source), pas écrit une seconde fois.
- **« Reprendre l'abonnement ne redémarre rien tout seul »** : il avait repayé le
  plan à 25 € et rien n'était revenu. Sans cette phrase il attend un retour que
  le paiement ne déclenche pas.
- Vérifié que ce n'était **pas** une panne de plateforme : le seul incident
  ouvert chez Supabase parle de « 401 errors due to JWT rejections », impact
  mineur — pas d'un délai de base. C'est son projet.
- Le banc lit aussi les **`href`**, pas seulement `innerText` : un geste qui se
  clique ne se voit pas dans le texte, et un lien « Ouvrir mon projet » qui
  pointe ailleurs serait vert sur un contrôle posé sur le libellé.
  **4 échecs** sur le code d'avant — cette fois mesurés sur le **vrai** build
  d'avant (voir ci-dessus).


### Comptes liés : un CHOIX n'est pas une panne
Vu en capture le 9 septembre : l'en-tête annonçait « ✓ 0 à jour · ⏱ 7 à
rafraîchir · 🚫 **2 en panne** » — et l'un des deux était `liliand653`, le
compte que Julien a lui-même **exclu de l'application** (le bandeau juste
au-dessus le disait : « 1 compte est exclu »). Sa carte portait donc
« Masqué (annonces + compta) » **et** « Pas capté (il y a 38 j) » en rouge, avec
la consigne « repasse sur vinted.fr » — c'est-à-dire exactement ce qu'il ne faut
**pas** faire pour un compte mis de côté.
`acctHealth` ignorait `hiddenAccts`. Il rend maintenant un **quatrième état**,
`exclu` (gris), placé **avant** « refusé par Vinted » : masquer un compte est
souvent la RÉPONSE à un blocage (le bouton le dit), et une fois le geste fait
l'app n'a plus à le réclamer — la raison reste dans l'infobulle.
- Le décompte ne porte que sur les comptes **qui sont dans l'app** ; les exclus
  ont leur mention à part, en gris : « 1 exclu — ton choix », sans consigne.
- Mais ils restent **nommés** : un compte écarté en silence serait pire que
  l'alerte qu'on vient de retirer.
- Le banc `comptes.cjs` **force le masquage** (aucune fixture n'en a) du compte
  le moins frais — il tombe tout seul sur `liliand653` — et vérifie les deux
  sens : il sort des pannes (2 → 1), il est compté à part, sa carte ne dit plus
  « Pas capté », et il n'a pas disparu. **3 échecs** sur le code d'avant.
- C'est la même famille que le panneau de sécurité : **une fausse alerte est ce
  qui fait cesser de lire les vraies.**


### ⚠️⚠️ ET QUATRE PANNEAUX DE RÉGLAGES EFFAÇAIENT CE QU'ILS N'AVAIENT PAS LU
**Dix-septième forme de « rien lu ne vaut pas rien », et la première qui frappe
quatre écrans d'un coup.** Chacun lit sa ligne puis la **réécrit ENTIÈRE** au
premier réglage touché, et tous traitaient une lecture ratée comme « vide » :

| ligne | ce qu'il perd si la base hoquette pendant qu'il ouvre Réglages |
|---|---|
| `vrm_email_owners` | **toutes ses adresses de réception**. C'est l'adresse d'arrivée qui décide à quel vendeur appartient un email (§5) : les bordereaux, ventes et suivis suivants partent en quarantaine. Et l'écran affirmait **« Aucune adresse déclarée »** — une affirmation sur l'attribution de ses emails, faite sur une mesure qui n'a pas eu lieu. |
| `push_prefs` | mesuré : **5 préférences, toutes à `true`**. Un basculement après une lecture ratée réécrit la ligne avec **une seule clé** (prouvé au banc : `{"suivi":true}`) ; les quatre autres retombent sur leur défaut, dont certains à `false` — **il cesse d'être prévenu**, sans rien voir. |
| `vrm_pro_facture` | **l'entité du reçu comptable** (raison sociale, adresse, SIRET). Le formulaire s'affichait VIDE, et la première frappe l'écrivait : le reçu redit « Ma boutique », ce que le dossier décrit comme un défaut de plusieurs mois. |
| `vrm_email_config` | l'écran affichait **la date du jour** alors que le vrai réglage est le **10 juillet** (mesuré). Il lit « les emails ne sont pris en compte qu'à partir du 15 septembre » et croit avoir perdu deux mois. Un mensonge d'affichage sur un écran de RÉGLAGES — et s'il « corrige » le champ, il l'écrit pour de bon. |

Deux d'entre eux n'avaient **aucun `res.ok`** : sur un 522 Cloudflare `res.json()`
lève, et le `catch` posait les valeurs par défaut en annonçant que tout allait
bien. Les deux autres écrivaient `r.ok ? await r.json() : []`.
⇒ **Trois états, jamais deux** — comme la sonde du panneau de sécurité et
`extSait` : `undefined` = en cours · `null` = **pas su** · un objet = lu.
`lireReglage(id)` porte la règle pour les quatre (§11), on n'écrit rien tant
qu'on n'a pas lu, et l'écran le **DIT** avec le geste (`REGLAGE_PAS_LU`) — se
taire renverrait au défaut d'origine (« je l'ai réglé et ça n'a pas tenu »).
- ⚠️ **`null` pour « en cours » ET pour « échec » faisait dire « Chargement… »
  pour toujours** à un panneau qui avait échoué. Deux états ne suffisent pas.
- ⚠️ **Le cas qui détruit n'est pas la panne totale** (l'écriture échouerait
  aussi) : c'est **lecture KO, écriture OK**. `scripts/bancs/reglages.cjs` sert
  exactement ça — seules ces quatre lignes échouent, la base debout par ailleurs
  — puis **CLIQUE** et exige que **zéro** écriture parte. **11 échecs** sur le
  code d'avant, dont `push_prefs ← {"suivi":true}`.
- ⚠️⚠️ **ET MON PREMIER RENDU DISAIT LA MÊME CHOSE QUATRE FOIS.** Vu en capture :
  les quatre panneaux portaient chacun le même paragraphe de **190 caractères** —
  quatre alertes pour **une** cause, sur un écran qu'il faut déjà faire défiler.
  C'est §7 mot pour mot : le défaut de Ma journée (« la panne dite trois fois »)
  et des six « saisis tes prix d'achat », refait le jour même.
  ⇒ Même forme que `BaseInjoignable` : **le bloc UNE fois en haut de Réglages**,
  qui **nomme** les panneaux touchés (sur un écran qui défile, « un réglage » ne
  dit pas lequel regarder) ; sur le panneau il ne reste qu'une **pastille grise**
  — c'est elle qui distingue, pas le libellé. Le banc **compte** : bloc ×1,
  pastille ≤ 1 par panneau.
- ⚠️ **Et il vérifie l'autre sens** : *ne rien écrire du tout est le moyen le
  plus simple de ne rien écraser*. En marche normale le banc clique pour de vrai
  et exige que l'écriture parte **avec les cinq clés**.
- ⚠️ **DIX-HUITIÈME fois qu'un de mes contrôles crie au loup**, et c'est la
  récidive des `href` de `panne.cjs` : la date d'import est un
  `<input type="date">` et la raison sociale un `<input>` — **leur valeur n'est
  pas dans `innerText`**. Le banc les déclarait absentes sur une app intacte. On
  lit ce qui est RENDU, pas ce qui est écrit en toutes lettres.
- **Vérifié, et laissés tels quels** : `vrm_local` et `vrm_room` ne sont PAS
  concernés — leur état vient du `localStorage` et la lecture du nuage ne le
  remplace que si elle a réussi (c'est le motif `onCloudReady`). Ne pas les
  « corriger ».


### ⚠️⚠️ ET LE TITRE DÉSIGNAIT LA MAUVAISE ANNONCE — 5 PAIRES CACHÉES DE L'ÉCRAN
L'écran Annonces (et le panneau) retiraient une annonce « en ligne » quand une
vente de moins de 60 jours portait le **même titre**, avec pour seule garde « un
titre en double ne retire rien ». Mais cette garde comptait les annonces **EN
LIGNE**, pas les ventes : deux paires identiques, il en vend une, il n'en reste
qu'une en ligne… donc le titre redevient « unique », et **la paire qu'il a encore
disparaît**.
Mesuré sur ses **65 annonces en ligne** : **5 étaient retirées, aucune prouvée
vendue**. Pour quatre d'entre elles **Vinted dit lui-même** quelle annonce est
partie — et c'est une **AUTRE** à chaque fois. « Adidas Spezial noir taille 35,5 »
a **3 ventes**, qui pointent vers 3 annonces différentes : celle qui restait en
ligne était la **quatrième paire**, bien réelle.
⇒ C'est §2.4 mot pour mot, et une annonce cachée est une paire qu'il ne peut plus
numéroter, ni cocher pour Leboncoin, ni tarifer. On retire sur l'**identité**
(`identiteAnnonce`), jamais sur le titre ; quand l'identité ne dit rien, on ne
retire pas.
⚠️ **`onlineTitleN` RESTE** dans l'extension : il sert de garde d'ambiguïté à
**deux autres endroits**. Le retirer avec la règle du titre aurait tué
`buildPanelData` en silence — §4.11, *une coupe se vérifie sur ce qui RESTE*.


### ⚠️⚠️⚠️ « MISE EN LIGNE » — MESURÉ : LA BASE N'EST PAS CLOISONNÉE DU TOUT
Demande de Julien, 15 septembre : « je veux que tu commences à réfléchir à une
optique de **mise en ligne** de l'application… que les données coexistent,
soient bien séparées entre elles, que chaque compte appartienne bien à une
personne et que chaque donnée appartienne bien à chaque compte, et que tout ne
se mélange pas. Car ça pourrait avoir de **gros problèmes**. »

**MESURÉ SUR SA VRAIE BASE LE MÊME JOUR — et c'est le point de départ :**
- **`app_data.owner` N'EXISTE PAS** : `400 « column app_data.owner does not
  exist »`. La migration `supabase/migrations/001-multi-utilisateurs.sql` n'a
  **jamais été passée** — ses **5 086 lignes** sont dans un seul tas ;
- **`vinted_accounts` n'a pas de propriétaire non plus** (9 comptes) ;
- la clé publique **LIT** (200) **et ÉCRIT** : un `POST` sur `app_data` avec elle
  seule répond **201** (ligne de sonde supprimée aussitôt) ;
- et elle **lit `vinted_accounts`**, qui porte `access_token`, `refresh_token`,
  `csrf_token` — vérifié, elle rend les logins.
⇒ **Aujourd'hui un second utilisateur ouvrirait SA boutique, et pourrait
l'effacer.** Ce n'est pas un risque théorique : c'est l'état mesuré.

**Ce qui est de MOI, et qui est fait :**
- le panneau ne parlait que de la **LECTURE**. Or *lire, c'est regarder ;
  écrire, c'est remplacer ses numéros de rangement, ses bordereaux, ses comptes
  — et effacer*. Il décrivait donc le moindre des deux risques, sur l'écran qui
  sert précisément à décider si ses données sont protégées. Deux sondes de plus,
  **mesurées vraies aujourd'hui** : l'écriture et les jetons Vinted.
- ⚠️ **UNE SONDE N'ÉCRIT PAS DANS SA BASE** (§2.3). Le droit d'écriture se teste
  par un **`PATCH` sur un identifiant qui n'existe pas** : même contrôle de
  permission, **aucune ligne touchée** — vérifié, 200 + `[]`, et la ligne n'est
  pas créée. RLS actif sans règle répondrait 401/403.
- ⚠️ **UNE CAUSE, UNE LIGNE** (§7) : lire, écrire et les jetons, c'est le MÊME
  verrou manquant. Trois lignes d'alerte se liraient comme trois problèmes —
  c'est une seule ligne, « Accès sans compte », qui **nomme les trois faits**.
  Et le verdict global (« cloisonnées ») exige désormais les **quatre** sondes :
  une base qu'on peut encore écrire n'est pas cloisonnée.

**Ce qui n'appartient qu'à LUI** (il possède les comptes, §« panneau de
sécurité ») : passer la migration SQL, poser `SUPABASE_SERVICE_KEY` et
`VRM_OWNER_UID` sur Vercel, et passer le dépôt en privé. Le panneau écrit
l'ordre exact. **Ne pas le faire à sa place, et ne pas le lui cacher.**

⚠️⚠️ **CE QUE LE BANC A RÉVÉLÉ EN TOMBANT, ET QUI VAUT MIEUX QUE LE BADGE** :
dès que la colonne existe, **l'app ne montre plus aucune boutique sans
session** — elle bascule sur l'écran de connexion (`isCloisonne()`). C'est CE
comportement qui protège un vendeur d'un autre, bien plus qu'un libellé.
`scripts/bancs/securite.cjs` l'exige donc explicitement, et vérifie qu'**aucune
donnée ne transparaît** sur cet écran (ni login Vinted, ni montant).
- Le banc rend **trois états** : base grande ouverte (le sien), base cloisonnée,
  sondes muettes. **2 échecs** sur le code d'avant (mesurés sur un vrai build
  d'avant, §6.1).
- ⚠️ **VINGTIÈME FOIS QU'UN DE MES CONTRÔLES CRIE AU LOUP**, récidive exacte de
  « télécharg » : j'interdisais les MOTS (« jetons », « effacer ») dans l'état
  muet — or la phrase honnête **nomme ce qu'elle n'a pas pu mesurer**
  (« la lecture · l'écriture · les jetons Vinted »), et c'est exactement ce
  qu'on veut. Ce qui est interdit, c'est l'**AFFIRMATION** qu'un accès est
  ouvert (« permet encore de »).
- ⚠️ **Et trois défauts étaient dans mon banc, pas dans l'app** : il servait `[]`
  à la sonde de lecture (donc « lecture fermée » sur une base grande ouverte,
  **vert sur le défaut**, §6.3) ; il comptait les écritures **légitimes** de
  l'app (`widget_stats`) comme des sondes ; et sa « base cloisonnée » répondait
  401 à **tout**, ce qui simule une panne, pas un cloisonnement.


### ⚠️⚠️ « 300 NOTIFS », « COMME SI JE DÉBUTAIS », « ÇA TÉLÉCHARGE » (3 octobre)
Trois plaintes de Julien, **une cause racine pour les deux premières** :
- ⚠️⚠️ **LES EFFETS DE L'APP PARTAIENT AVANT LA SESSION.** La porte de connexion
  était vérifiée à la FIN du composant `App`, après la déclaration de ses effets :
  au montage, comptes, ligne `main`, ventes LBC/eBay étaient lus **avec la clé
  publique**. Base cloisonnée ⇒ RLS répond `[]` **sans erreur** ⇒ boutique vide,
  « Bienvenue — il reste une chose à brancher » après chaque reconnexion, et
  rien ne se relisait ensuite. Mesuré au banc : **22 lectures anonymes** à
  chaque ouverture. ⇒ `App` n'est plus que la porte ; `AppCoeur` ne monte
  qu'avec une session prête, et `key = user.id` (changer de vendeur remonte tout
  à neuf). **Ne jamais remettre un effet de données dans `App`.**
- **La sonde de schéma rendait `false` sur tout échec** (502, > 4 s) ⇒ lecture
  anonyme. Trois états (200 oui · 400 non · reste = pas su), 3 essais, et le
  résultat est **mémorisé sur l'appareil** (`schema_cloisonne` : on ne
  dé-cloisonne jamais une base). `sbAuth` passe le jeton dès qu'il y a une
  session, cloisonné ou non.
- **« ~300 notifications »** : les nouvelles ventes se comptaient par
  **différence de total** avec l'ouverture précédente ; une ouverture qui avait
  lu `[]` mémorisait 0. Elles se comptent maintenant par **identité**
  (`vinted_notif_seen_ventes`, transactions vues, qui ne fait que grandir), le
  mémo des conversations **fusionne** au lieu d'être reconstruit, et le
  « déjà montré » ne se pose qu'en fin de passage (un passage interrompu le
  consommait : une vraie nouvelle vente n'était jamais annoncée).
- **`cloudLoad` : trois états.** Un échec rendait `null` comme « pas de ligne »,
  et l'appelant **poussait les données du navigateur dans le nuage**. Échec ⇒
  `undefined` ⇒ on réessaie (2 → 30 s), rien n'est poussé.
- **Imprimer un bordereau sur ordinateur le téléchargeait** (et l'iframe cachée
  qui devait imprimer ne charge pas la visionneuse PDF de Chrome). Il s'ouvre
  dans un **onglet réservé au clic** (`data-imprime`, sinon le navigateur bloque
  l'ouverture faite ~1 s plus tard) ; le bouton « Ouvrir » de la modale n'a plus
  `download`.
- Bancs : `demarrage.cjs` (5 rouges sur l'avant, dont la phrase exacte qu'il a
  vue) · `ventes-bordereau.cjs` + onglet ouvert / aucun téléchargement (4 rouges).


### « Plusieurs milliers de personnes » — lot 1 : le cache et les notifications (3 octobre)
Mesuré par la cartographie du 3 octobre (bundle, service worker, en-têtes de
production), corrigé sur ce qui ne change rien à l'écran :
- ⚠️ **Le cache du service worker gardait TOUTES les versions** (`vrm-shell-v4` :
  1,4 → 3,3 Mo en trois déploiements, 13 à 21 déploiements par jour, jamais
  purgé). Il passe en **v5** (l'activation jette la v4 chez tout le monde) et,
  quand la page annonce un **autre** script principal, retire de `/assets/` tout
  ce qu'elle ne nomme pas. Même version rouverte ⇒ rien n'est jeté (sinon la 3D
  et pdf-lib se retéléchargeraient à chaque ouverture).
- ⚠️⚠️ **Tout fichier même-origine était servi « cache d'abord »**, y compris
  `/VRM-extension.zip` (même nom à chaque version) : le lien sans `?v=` rendait
  l'**ancien zip, pour toujours** — le défaut le plus coûteux du projet (§ zip),
  par un autre chemin. Seul `/assets/` (hashé) est « cache d'abord » ; le reste
  est réseau d'abord, cache en secours.
- **`/assets/` en cache long** (`vercel.json`, `immutable`) : la production
  servait tout en `max-age=0`. Rien d'autre n'est figé.
- ⚠️ **Trois clés de notifications coexistaient** (main.jsx, sw.js, App.jsx) :
  seule celle d'App.jsx était celle du serveur. À chaque ouverture, main.jsx
  renvoyait un abonnement périmé ou en recréait un avec la mauvaise clé —
  refusé par Apple/Google, sans un mot. Une seule source : `src/vapid.js`
  (sw.js en porte une copie, il ne peut pas importer) ; un abonnement à une
  autre clé est remplacé à l'ouverture.
- Preuves : banc `sw-cache.cjs` (trois déploiements synthétiques avec le VRAI
  `sw.js`, aucune fixture) — **2 rouges** sur l'avant ; `audit-vapid.cjs` —
  **3 rouges** sur l'avant. `audit-push.cjs` suit désormais la clé jusqu'à
  `src/vapid.js` (vingt-cinquième cri au loup évité : la règle, pas l'endroit).


### ⚠️⚠️ « PRÉPARE LE SITE POUR BEAUCOUP DE PERSONNES » — SCALE + EMAILS (4 octobre)
Demande de Julien : préparer la mise en ligne multi-vendeurs + « comment
redistribuer les infos qui arrivent par mail aux bonnes personnes ». **Mesuré
d'abord (§6), et l'essentiel était DÉJÀ bâti** :
- **Redistribution email = résolue, de la seule façon sûre.**
  `resoudreProprietaire` (api/_lib/proprietaire-email.js) décide par **l'adresse
  de RÉCEPTION**, jamais le contenu ; `email-inbound` **tague chaque ligne du
  `owner`** → RLS isole ; inconnu → **quarantaine** (jamais au hasard) +
  rattachement (`/api/email-rattacher`) ; le repli « seul vendeur » **s'éteint
  dès qu'un 2ᵉ owner existe**. Prouvé (`audit-proprietaire-email.cjs`). RLS
  **déjà actif** (migration 004, `app_data` PK = `(owner,id)` via 002). Rien à
  coder — par vendeur : déclarer son adresse (Réglages) + faire suivre sa boîte.
- **Checklist de mise en ligne** consignée dans `docs/mise-en-ligne.md` (ce qui
  est prêt, les gestes de Julien, les leviers classés). **Free Upgrade Micro
  pris** le 4 oct (compute = ce qui casse en premier, mesuré 62 % CPU à 1 user).
- **§4.5 pagination** des balayages serveur (`widget`, `ship-reminders`) :
  au-delà de 1000 lignes Supabase tronque en silence → des rappels/colis perdus.
  `fetchPaginated` (Range, `null` si une page échoue). Vérifié `bancs/serveur.cjs`.

**⚠️⚠️ LE DERNIER VRAI TROU MONO-VENDEUR : `ship-reminders` poussait UN résumé
global à TOUT LE MONDE.** Le cron calculait un total unique (toutes lignes, tous
owners mélangés) et `sendPushToAll` SANS contexte → le résumé d'un vendeur
partait sur le téléphone d'un autre dès qu'il y en a deux. L'infra par-vendeur
existait pourtant déjà (`contexteVendeur` + `duVendeur`, que le pipeline email
utilise). ⇒ `traiterVendeur()` extrait, et le handler **boucle par propriétaire**
quand la base est cloisonnée : `ownersActifs()` (un `main` par owner, clé de
service), `contexteVendeur.run({owner}, …)`, lectures `scoped()` (`owner=eq.`),
dédoublonnage `ecrireDedup` par owner (clé `(owner,id)`). **Base non cloisonnée
⇒ passe unique, comportement d'aujourd'hui À L'IDENTIQUE** (le banc serveur, qui
sert une base non cloisonnée, reste vert). On ne pousse **jamais** hors contexte :
cloisonné mais vendeurs non énumérables ⇒ on se tait, pas de résumé mélangé.
- `scripts/bancs/ship-multi.cjs` sert une base cloisonnée à **2 vendeurs** et
  exige : bordereaux lus `owner=eq.` pour A ET B, **aucune lecture globale**,
  `push_subs` lu par vendeur (chacun ses appareils), dédoublonnage par owner,
  bilan à 2 vendeurs. **§6.1 : 5 rouges sur le code d'avant**, 0 après.
- ✅ **FAIT (même famille, PR suivante)** : `widget.js` avait le même défaut (il
  prenait le premier `main` venu et agrégeait tous les owners → le vendeur B
  voyait les chiffres de A, et une clé `?k=` inconnue était servie quand même).
  `ownerDuToken(req,res)` résout SON owner par la clé AVANT toute lecture (seule
  lecture globale : owner + sa clé, jamais ses données), puis tout le calcul
  tourne dans `contexteVendeur.run({owner})` → chaque `scoped(…)` se filtre sur
  lui. Base NON cloisonnée → `''`, comportement d'aujourd'hui à l'identique (banc
  `serveur.cjs` toujours vert). Clé inconnue sur base cloisonnée multi-vendeurs
  → 401, jamais les chiffres d'un autre. `scripts/bancs/widget-multi.cjs` sert
  **2 vendeurs** (clés + colis distincts) et exige : la clé de A ⇒ lectures
  `owner=eq.A` et SON total (pas A+B), la clé de B ⇒ `owner=eq.B` et SON total,
  aucune lecture lourde globale, clé inconnue ⇒ 401. **§6.1 : 7 rouges sur le
  code d'avant** (dont « HEAD sert l'agrégat A+B à une clé inconnue »), 0 après.
- ⚠️ **À l'échelle (1000)** : la boucle fait N passes ; au-delà de quelques
  dizaines d'owners, grouper en mémoire (une lecture globale bucketée par owner)
  pour ne pas multiplier les requêtes par vendeur. Correction avant optimisation.


### Passe fiabilité — l'audit des routes qui ÉCRIVENT (4 octobre)
Demande de Julien : « améliore la fiabilité ». Mesuré d'abord (§6), pas deviné :
- **Les 57 audits sont verts** — aucune régression de la famille « rien lu ne
  vaut pas rien ».
- **Prod vérifiée en direct** (`GET vrm.center/api/sante`, public, OUI/NON seuls) :
  `serviceKey:true · owner:true`. Le scénario catastrophe du dossier (RLS actif +
  `SUPABASE_SERVICE_KEY` absente sur Vercel = **emails perdus en silence**, push
  mort, widget 503, rappels morts) **n'a pas lieu**. `ia:false` : l'IA de réponse
  auto n'est pas branchée — éteinte par défaut, pas une urgence.
- **Revue route par route de la famille qui DÉTRUIT** (lecture ratée → réécriture
  qui efface) sur TOUT `api/*.js` : `email-inbound`/`push`/`widget`/`ship-reminders`
  déjà couverts (`serveur.cjs`) ; `email-rattacher` relit sa ligne et ne la
  supprime QUE si `resultat.ok && !resultat.quarantaine` (jamais le seul
  exemplaire) ; `vinted-refresh` rend 502 sur lecture ratée, aucune écriture ;
  `vinted-connect` fait un upsert sans fusion-qui-efface ; `relais`/`sante` en
  lecture seule / booléens. **Aucune route ne perd de données sur lecture ratée.**
- ⚠️ **TROU §4.10 FERMÉ** : les deux routes qui écrivent la donnée la plus
  coûteuse à perdre — les **jetons Vinted** — n'avaient **jamais** été exécutées
  par un banc. `scripts/bancs/routes-ecriture.cjs` les lance pour de vrai et porte
  l'invariant : **un refresh que Vinted REFUSE ne réécrit JAMAIS la ligne** (sinon
  un bon jeton est remplacé par du vide → compte mort jusqu'à reconnexion, §5.22),
  et **un jeton refusé ne crée AUCUNE ligne** (pas de compte fantôme). Les deux
  sens sont vérifiés (refus → rien · valide → la ligne est bien écrite — un
  contrôle qui n'aurait que l'absence serait vacant). **§6.1 prouvé en
  réaffaiblissant** `vinted-refresh` (persister malgré l'échec) → **2 rouges**,
  dont « PATCH écrit `access_token:null` ». `vinted-connect` a trois gardes en
  couches (refresh null · newAccess null · account_id null) qui bloquent chacune
  une écriture fautive — c'est pour ça qu'il est si difficile à faire tomber, et
  c'est tant mieux.


### ⚠️⚠️ CINQ BALAYAGES DE FAMILLE NON BORNÉS TRONQUÉS À 1000 EN SILENCE (4 octobre, 5.148)
Suite de la passe fiabilité, famille §4.5. Supabase coupe une réponse à
**1000 lignes sans le dire** ; un balayage `id=like.` lu par `sbGet` (un seul
appel, pas d'en-tête `Range`) repart donc AMPUTÉ au-delà. Mesuré dans
`background.js` : cinq scans de familles **non bornées** (une ligne par ANNONCE,
par BORDEREAU, par ÉTIQUETTE — **tous comptes confondus**, donc 9 comptes ×
centaines → dépasse 1000 chez un vendeur actif) le faisaient encore :
`harvest_*_item_*` (×2, les files de publication Leboncoin/eBay → des paires
sans photo), `email_bord_*`, `harvest_{uid}_label_*` (×2). Tronqués, ils
produisent une file incomplète ou un bordereau « manquant » re-généré, **sans la
moindre erreur**.
⇒ Passés en `sbGetTout` (paginé par `Range`, et rend `null` si une page échoue —
une demi-liste a l'air d'une réponse). `sbGetTout` a **exactement la même forme
de retour** que `sbGet` (tableau, ou `null`) : le `|| []` des appelants est
conservé → **changement neutre** hors la troncature corrigée. Les familles
BORNÉES (une ligne par compte `*_listings`, par mois `*_releve_*`) ne sont pas
touchées.
- `scripts/audit-pagination-ext.cjs` (NOUVEAU) verrouille la règle : toute
  famille non bornée (`_item_`, `_label_`, `email_bord_`) balayée en `id=like.`
  doit passer par `sbGetTout`. ⚠️ Il **neutralise d'abord les commentaires** (mes
  commentaires de correctif disent « sbGet tronquait » — sinon cri au loup, le
  balayage des sondes refait). **§6.1 : rouge** quand on rebascule un scan sur
  `sbGet` (il nomme la ligne), vert après.
- ⚠️⚠️ **ET MON PROPRE BANC A ATTRAPÉ UNE RÉGRESSION QUE J'AVAIS INTRODUITE** :
  `audit-bordereau-pdf.cjs` extrait `capterTelechargement` et lui fournissait un
  faux `sbGet` **mais pas `sbGetTout`** — que le code appelle maintenant (L4631).
  L'appel levait, le cas « un seul colis → toujours relié » tombait. C'est §6.3
  (un banc doit servir la forme que le code utilise) : `sbGetTout` ajouté au vm,
  à l'identique de `sbGet`. **La leçon : un changement d'API de lecture se
  répercute dans TOUS les vm qui exécutent le code touché.**
- Extension **5.148.0**, zip régénéré, `EXT_ATTENDUE` suivie. Les 58 audits verts.


### Les bancs à fixtures relancés sur la base du jour — six défauts d'app, et des bancs qui ne pouvaient plus échouer (5 octobre)
Les 19 bancs qui lisent `scripts/bancs/fx/` (copie de sa vraie base, gitignorée,
exportée le 5 octobre avec son accord) ont été relancés UN PAR UN, chaque rouge
trié (défaut de l'app · banc en retard · donnée qui a changé · instable) puis
contre-vérifié par deux sceptiques. Corrigés dans l'app, chacun rouge avant :
- **Colis pendant la lecture** : « 0 bordereau prêt · 3 en attente », puis
  « 2 · 1 », puis « 3 ». Tant que bordereaux captés ET emails ne sont pas tous
  lus : « au moins N prêts », aucun « en attente » (le groupe dit « pas encore
  vérifié »). `colis.cjs` sert un réseau lent (4 s sur `_label_`/`email_bord`).
- **Menu « ⋯ Outils » d'Annonces** coupé par le bord aux deux tailles : il
  s'ancre à droite comme celui de Ventes, à gauche si le bouton est passé à la
  ligne près du bord (côté mesuré au clic).
- **Leboncoin → Annonces pendant une panne** : gardé par `baseKO` comme ses
  quatre voisins ; une lecture ratée de `lbc_listings` ne dit plus « jamais vu,
  ouvre leboncoin.fr » ; les lectures ratées sont dites UNE fois avec ce
  qu'elles empêchent ; « — à publier » au lieu de « 0 ».
- **URSSAF** : « à payer 21,20 € · net 135,81 € » sur 157 € (21,195 arrondi d'un
  seul côté). `aPayerUrssaf` / `netApresUrssafDe` arrondissent UNE fois, en
  centimes entiers, pour la carte, le récap, l'échéance, le CSV et les deux
  rapports — 0 incohérence sur 200 001 montants. ⚠️ Le premier correctif
  proposé ne touchait que la carte : le récap mensuel du même écran aurait dit
  un autre centime (c'est un sceptique qui l'a vu).
- **Retrait sur Ma journée** : en extension absente (téléphone) ou en retard, la
  consigne ne nommait pas le compte ; l'écran Achats, si (§11).
- **Ventes** : un « Retour initié » n'était visible que sous « Annulées »
  (`venteQuiRevient`, même défaut que la « non réclamée » du 4 octobre).

⚠️⚠️ **TROIS BANCS ÉTAIENT VERTS (OU MUETS) SUR N'IMPORTE QUEL DÉFAUT** :
- `urssaf.cjs` cherchait `transaction->>id` sur l'URL BRUTE — le navigateur
  encode `>` en `%3E` : la transaction n'était **jamais servie**, le CA valait
  0 €, et « 0 × 13,5 % = 0 » passait. **Toute route de banc se teste sur l'URL
  DÉCODÉE** (§6.3, la forme de la requête).
- `retrait.cjs` lisait un bloc à partir de « Point relais » ; l'étiquette est en
  `textTransform:uppercase` et `innerText` rend « POINT RELAIS » : bloc vide,
  « 0 colis », exigences sautées. Et `/inbox\/(\d+)/` prenait un identifiant
  de conversation en UUID (232 sur 236) pour une conversation inventée.
- Un contrôle qui dépend d'une situation que la base du jour n'a plus (« non
  réclamée ») ne mesure rien : le banc la PRÉPARE en mémoire.
Bancs mis à jour sur la forme actuelle sans les affaiblir : capacites, carte,
colis, comptes, ia, oublies, perfv, postes, retrait, serie, urssaf. Restent
**instables sous charge** (4 cœurs) : la modale de `serie` (< 1,2 s) et le
tableau de bord de `retrait` — à relancer SEULS, jamais à élargir.


### ⚠️⚠️ Les emails de deux vendeurs : le registre se lit EN ENTIER, et rattacher ne prend que ce qui est à soi (5 octobre)
Trouvé par l'audit de sécurité du 5 octobre, prouvé en exécutant les vraies routes.
- ⚠️⚠️ **`email-inbound` ne lisait que la PREMIÈRE ligne `vrm_email_owners`.**
  Or, une fois la base cloisonnée, il y en a une **par vendeur** (chacun écrit
  la sienne sous RLS), et la route les lit avec la clé de service. Elle ne
  gardait que `j[0]`. Conséquence : l'adresse d'un second vendeur n'existait
  pas pour elle, et son bordereau tombait dans le repli « installation »,
  c'est-à-dire chez Julien.
  ⚠️⚠️ **Pire, le vendeur d'une adresse venait du champ `owner` écrit DANS le
  JSON, donc par le navigateur.** Un vendeur qui déclarait dans SA ligne
  « julien@… → moi » recevait les ventes de Julien. Prouvé au banc sur le code
  d'avant : la vente de Julien était écrite chez l'autre.
  ⇒ `fusionnerRegistres` (dans `api/_lib/proprietaire-email.js`, une fonction
  pure) lit **toutes** les lignes, et le vendeur d'une adresse est **celui de
  la LIGNE** (la colonne `owner`, posée par la base). Une adresse déclarée par
  deux vendeurs ne désigne personne (`conflits`) : l'email part en quarantaine,
  jamais chez l'un des deux au hasard.
- **La sonde de cloisonnement mémorisait « non » sur un 502**, pour toute la vie
  de l'instance, et la quarantaine était alors sautée. Elle a maintenant trois
  états : seul un 400 dit « non », un échec n'est jamais mémorisé.
- **Un registre illisible valait « personne n'a déclaré d'adresse ».** Sonde ou
  registre illisibles ⇒ **503**, « renvoie-le ». Un email retardé se rattrape ;
  un email donné au mauvais vendeur, non.
- **Mesuré en production : 0 ligne de registre aujourd'hui** (Julien n'a déclaré
  aucune adresse). Pour lui seul, rien ne change : le repli « installation »
  joue comme avant (contrôlé dans l'autre sens, l'incident du 16 août).
- ⚠️⚠️ **`email-rattacher` relisait la ligne mise de côté SANS filtre de
  vendeur** (clé de service). N'importe quel vendeur connecté faisait rejouer
  chez lui l'email d'un autre en donnant son identifiant, et pouvait aussi
  l'effacer. Sans session, l'email était rejoué quand même. La route exige
  maintenant la session, ne lit et n'efface que **les lignes de ce vendeur**,
  et une lecture ratée répond 503 (et non plus « déjà rattaché »).
- ⚠️ **Reste à faire pour le multi-vendeurs** : la quarantaine est rangée chez
  le propriétaire de l'installation. Un second vendeur ne voit donc pas la
  sienne, et seul Julien peut rattacher. C'est cohérent avec la règle, mais ce
  n'est pas encore un service pour lui. ✅ **Fait le 6 octobre** (section
  suivante).
- `audit-proprietaire-email.cjs` : **32 contrôles**, dont la vraie route avec
  deux vendeurs. Il sort **8 rouges** sur le code d'avant.
- `audit-email-rattacher.cjs` (nouveau, la route n'avait jamais tourné, §4.10) :
  **8 contrôles**, **6 rouges** sur le code d'avant.
- **`ship-reminders` appelable sans clé : faux en production.** `CRON_SECRET`
  y est posée depuis le 4 octobre (vérifié par nom, sans lire la valeur).


### ⚠️⚠️ La quarantaine des emails n'est à PERSONNE — chacun réclame la sienne (6 octobre)
Avant d'ouvrir VRM à d'autres : `mettreEnQuarantaine` rangeait un email non
attribuable **sous le propriétaire de l'installation** (Julien). Le jour où un
second vendeur arrive, ses ventes, bordereaux, noms et adresses d'acheteurs mis
de côté atterrissaient chez Julien, et lui ne les voyait jamais.
**Mesuré le 6 octobre (lecture seule)** : 593 lignes `email_quarantaine_*`, toutes
chez Julien, **toutes déjà rejouées** (`supprime`) ; **aucune** ligne
`vrm_email_owners` (donc aujourd'hui rien n'est mis de côté : le repli
« installation » lui donne tout) ; `app_data` : clé `(owner,id)`, `owner uuid
NOT NULL`, **aucune clé étrangère** ; RLS `owner = auth.uid()` en lecture comme
en écriture.
- **Base cloisonnée ⇒ propriétaire NEUTRE** `00000000-0000-0000-0000-000000000000`
  (`PROPRIETAIRE_NEUTRE`, `api/_lib/proprietaire-email.js`) : aucune session ne
  le porte, RLS ne le montre à personne. Base non cloisonnée : inchangé (on n'y
  met rien de côté). La ligne garde aussi ses adresses en une chaîne
  (`destinataires`, ≤ 560 octets) que la base copie dans `meta` : la liste se lit
  sans décompresser l'email (§4.4). Trop longue : pas de chaîne (jamais tronquée
  — elle cacherait un second destinataire), la liste relit `data->adresses`.
- **Qui réclame** (`peutReclamer`) : la règle d'ARRIVÉE (`resoudreProprietaire`,
  §11) rejouée avec le registre d'aujourd'hui, **sans le repli « installation »**
  — sinon Julien redevenu seul prendrait tout le tas des vendeurs partis. Adresse
  déclarée par deux vendeurs, deux vendeurs destinataires, aucune adresse ⇒
  personne. Une identité (l'adresse de réception), jamais le contenu.
- `api/email-rattacher` (toujours 12 fonctions) : `GET ?mode=liste` (session
  exigée) rend `id, sujet, raison, quand` — les lignes d'avant du vendeur + les
  neutres qui sont à lui, **paginé** (`Range`, une page ratée ⇒ 503). `POST`
  relit la sienne, sinon la neutre si elle est à lui ; pas à lui ⇒ 404 (on ne
  dit pas qu'elle existe) ; registre ou ligne illisibles ⇒ 503 ; ligne déjà
  vidée ⇒ 404 (avant : rejouée, et un « email inconnu » vide de plus). Date
  d'origine gardée ; la ligne n'est vidée que si le traitement a abouti, **chez
  son propriétaire** (avant : une copie vide repartait chez Julien).
- **L'app** (Réglages → adresses, rattrapage de Ma journée/Achats) lit la liste
  par la route, trois états : la panne s'écrit une fois (« pas pu vérifier »),
  jamais un silence ; le rattrapage réessaie à la prochaine ouverture ; ajouter
  une adresse relit la liste.
- Preuves : `audit-proprietaire-email.cjs` **45 contrôles, 3 rouges** sur le
  code d'avant ; `audit-email-rattacher.cjs` **32, 16 rouges** ; banc
  `bancs/emails-mis-de-cote.cjs` (port 4801, données inventées, deux tailles)
  **26, 14 rouges** sur le build d'avant. Mutations : repli « installation »
  rendu à la réclamation, une seule lecture sans pagination, registre illisible
  lu « vide », ligne vidée rejouée ⇒ chacune repasse au rouge.
- ⚠️ **Pas fait, à savoir** : (1) ⛔ **BLOQUANT AVANT D'OUVRIR VRM À DES
  INCONNUS — une adresse déclarée n'est pas PROUVÉE** (aucun email de
  confirmation). Vrai à l'arrivée comme à la réclamation, mais le tas rend ça
  plus coûteux : un vendeur qui déclare APRÈS COUP l'adresse non déclarée d'un
  autre **vide son arriéré mis de côté** (ventes, bordereaux, nom et adresse
  des acheteurs), sans que l'autre le voie partir. Reproduit le 6 octobre.
  ⚠️ **Rien de spéculatif n'a été codé contre ça, exprès** : la date d'une
  déclaration ne peut pas servir de garde (c'est le NAVIGATEUR qui l'écrit dans
  `vrm_email_owners`), et comparer la date d'arrivée de l'email à celle de la
  déclaration ferait perdre au vrai vendeur l'arriéré qu'il réclame justement
  APRÈS coup — c'est le cas normal. Le seul vrai correctif est une adresse
  PROUVÉE (lien de confirmation envoyé à l'adresse déclarée, cliqué depuis la
  session du vendeur, preuve rangée côté serveur) — il faut un envoi d'email
  (SMTP), qui n'existe pas ici. Tant que ce n'est pas fait : **VRM ne s'ouvre
  qu'à des gens de confiance**. ✅ **Fait le 22 octobre** (« l'adresse de
  réception PROUVÉE », fin du dossier) : base cloisonnée, une adresse non
  prouvée ne donne plus rien. (2) Un email « corps illisible » (`garderInconnu`, avant toute
  attribution) part encore chez le propriétaire de l'installation. (3) Un email
  sans adresse lisible reste au neutre pour toujours : personne ne peut le
  réclamer (mieux vaut un blanc qu'un faux). (4) Le 404 « pas à toi » se
  distingue d'un 404 « n'existe pas » par le temps de réponse (une lecture du
  registre de plus) — identifiants aléatoires, risque faible.

#### Relecture du 6 octobre : l'incident du 16 août était devenu INVISIBLE
Un relecteur a reproduit, sur une fausse base à état, quatre défauts du commit
ci-dessus. Tous corrigés, chacun rouge sur ce commit et repassé au rouge sous
mutation.
- ⚠️⚠️ **HAUT — Julien à 0 adresse, un autre compte déclare.** Son état réel
  (mesuré : **aucune** ligne `vrm_email_owners`). Dès qu'un AUTRE compte déclare
  une adresse — un second vendeur, ou son propre compte d'essai — le repli
  « installation » s'éteint, et tout ce qui arrive sur ses adresses non
  déclarées part au neutre. Sa liste rendait `[]`, son POST `404`, et Réglages
  affirmait encore « les emails reçus sont attribués au propriétaire de cette
  installation ». **Ses ventes partaient de côté sans un mot.**
  ⇒ `GET ?mode=liste` rend, au **seul** propriétaire de l'installation
  (`VRM_OWNER_UID`, base cloisonnée) : `installation.personne` = le **NOMBRE**
  d'emails neutres que personne ne peut réclamer, et leur **cause**
  (`pourquoiPersonne` : `inconnue` · `disputee` · `plusieurs` · `aucune`,
  l'envers EXACT de `peutReclamer`, §11) — **jamais** un sujet, une adresse ou
  un contenu (ce tas peut contenir les emails d'un autre vendeur). Compté en
  scalaires (`meta->>destinataires`), **au plus 5 pages de 1 000** (« au moins »
  au-delà), et `null` (« pas su ») si une page échoue — jamais 0. Plus
  `installation.repli` (`repliInstallation`, la règle même de l'arrivée).
  Un autre vendeur ne reçoit **ni le nombre, ni le booléen**.
  ⇒ L'app (`phrasePersonne`, une phrase pour deux écrans) : Réglages → Mes
  adresses de réception écrit le nombre, la cause et le geste ; **Ma journée**
  porte UNE ligne tant qu'il y en a (`data-job="emails-personne"`), qui mène au
  panneau. La phrase « aucune adresse déclarée » **suit le registre** (seul à
  déclarer / un autre compte a déclaré / pas le propriétaire / une seule
  boutique / pas su — cinq phrases, aucune n'affirme ce qui n'est pas mesuré).
  ⇒ **Les suggestions** : ses adresses déjà vues, ajoutables d'un clic.
  **Mesuré (lecture seule, sa vraie base)** : parmi les familles `email_*`,
  **seules `email_inconnu_*` gardent la destination** — `meta->>to`, l'en-tête
  « À » (1 053/1 053, 17 formes dont « Hide My Email <…@icloud.com> ») ; aucune
  autre famille ne la porte. C'est un champ que la règle d'arrivée lit
  (`adressesDeLivraison`) : la déclarer suffit. Lues sous SA session (RLS),
  normalisées par **le `normAdresse` du serveur** (importé, §11), avec le
  nombre et la date pour qu'il reconnaisse les siennes. Jamais celles du tas.
  ⚠️ Limite : une ligne rangée chez lui par le REPLI pendant qu'un autre vendeur
  n'avait rien déclaré porterait l'adresse de l'autre — c'est pourquoi c'est
  une suggestion à SON clic, jamais un ajout automatique.
  ⇒ Une fois l'adresse déclarée, il récupère son arriéré par le chemin existant
  (liste + POST) — vérifié en exécutant les deux vraies routes.
- **Bas — la liste relisait TOUT le tas neutre**, pour chaque vendeur, à chaque
  appel : **25 001 lignes ⇒ 503 pour tout le monde** (51 requêtes). Elle ne lit
  plus que les **candidats** : les lignes neutres dont `meta->>destinataires`
  contient une adresse déclarée par CE vendeur (`or=(…ilike…)` dans la base,
  étiquette « + » comprise ; une liste trop longue pour `meta` est cherchée dans
  `data->>adresses`). Mesuré au banc : **4 requêtes**. Aucun email n'est
  supprimé (§5) — pas de purge.
- **Bas — liste ≠ réclamation.** La liste découpait `destinataires` sur les
  ESPACES, la réclamation lisait `data.adresses` : « x@inconnu.fr
  b@vrm.center » (un To mal formé, une seule adresse pour la règle) était
  proposé à B puis refusé (404), et le rattrapage le retentait à chaque
  ouverture. La liste juge maintenant chaque candidat avec `peutReclamer` sur
  `data->adresses` projeté — la MÊME valeur que le POST. Et `destinataires`
  s'écrit en **JSON** (`JSON.stringify(adresses)`, ≤ 590 octets une fois
  encodé : `vrm_meta` garde `octet_length(v::text) <= 600`, vérifié sur la
  fonction en base) : une adresse avec une espace reste une adresse.
- La forme de la base se mesure à part (`select=owner&limit=1`) : un **400**
  sur une requête composée n'est plus lu « colonne `owner` absente » (il aurait
  fait relire la quarantaine sans filtre de vendeur).
- Preuves : `audit-email-rattacher.cjs` **48 contrôles** — **12 rouges** sur
  7b9b04b (dont « 503 · 51 requêtes » sur 25 001 lignes, « refusés : … → 404 »,
  aucun nombre ; 3 de ces 12 viennent de ce que l'ancienne liste ne sait pas
  lire `destinataires` en JSON) ; 5 mutations, chacune rouge : nombre donné à tout vendeur (4),
  jugement par découpe sur les espaces (1), tas relu en entier (2), compte raté
  lu 0 (1), repli toujours allumé (5). `audit-proprietaire-email.cjs` **51** —
  3 rouges sur 7b9b04b ; cause aplatie et découpe sur les espaces ⇒ rouges.
  Banc `emails-mis-de-cote.cjs` **52** (deux tailles, données inventées) —
  **18 rouges** sur le build de 7b9b04b ; `phrasePersonne` neutralisée ⇒ 4
  rouges, l'ancienne phrase « attribués au propriétaire » remise ⇒ 4 rouges.
- ⚠️ **Non mesuré sur la vraie base** : le filtre
  `or=(meta->>destinataires.ilike."*\"a@b\"*")` (valeur entre guillemets, `"`
  échappé par `\`). Vérifié dans la grammaire de PostgREST v12.2.3
  (`pLogicSingleVal` → `pQuotedValue`, `pCharsOrSlashed`) — aucun appel n'a été
  fait ici (§2.3). Si la base le refusait, la liste répondrait 503 (« pas su »)
  à tous : **à regarder en premier** si Réglages dit « pas pu vérifier » après
  le déploiement. Pas mesuré non plus : `order=meta->>receivedAt.desc` des
  suggestions (une lecture refusée ne suggère rien, n'affirme rien).


### Mise en production du 5 octobre
PR #442 mergée à 10:24 UTC (80 déploiements sur 24 h : sous la limite), déploiement
de production READY sur le commit de merge, `/api/sante` répond, le zip servi
est celui de la 5.158 (382 238 octets). ⚠️ vrm.center et supabase.co sont
**bloqués par le proxy de ce conteneur** : la vérification passe par l'outil
Vercel (`web_fetch_vercel_url`), pas par `curl`.


### ⚠️⚠️ MA JOURNÉE, VENTES, ANNONCES, ACHATS TOMBAIENT EN PRODUCTION — §4.6 (4 octobre)
`linkedBuyIds` (#407, une autre session) était un `useMemo` posé ~800 lignes
**au-dessus** de `saleOv` : « Cannot access 'saleOv' before initialization » au
premier rendu, sur les quatre écrans du composant. Vu par le banc
`premierjour.cjs` (22 rouges sur `main`), pas par le build ni par un audit.
⇒ **`scripts/audit-tdz.cjs`** : il suit la **liaison** Babel de chaque
identifiant lu AU RENDU (`useMemo`, initialiseur de `useState`, tableau de
dépendances, `.map` dans du code immédiat, fonction appelée sur place) et
refuse toute lecture d'un `const`/`let` déclaré plus bas dans la même fonction.
Rouge sur `main` (il nomme `saleOv`), vert après. Il ne voit pas une lecture
**indirecte** (un `useMemo` qui appelle une fonction qui lit une constante
déclarée plus bas) — pour ça, il faut encore le rendu.


### ⚠️⚠️ AUDIT DE SÉCURITÉ DU 4 OCTOBRE — CE QUI ÉTAIT OUVERT, ET CE QUI NE L'EST PLUS
Demande de Julien : « continue à améliorer la sécurité du site ». Outils :
**gitleaks** (historique complet), **semgrep** (règles open source de
`semgrep/semgrep-rules` : le registre semgrep.dev est bloqué par le réseau du
conteneur), `npm audit`, le conseiller Supabase, puis une relecture des routes et
du pont app↔extension. Ce qui a été trouvé et fermé :
- ⚠️⚠️ **L'EXTENSION FAISAIT CONFIANCE À DEUX ADRESSES QUI NE SONT PAS À JULIEN.**
  `cancale-v67.vercel.app` et `www.vrm.center` étaient dans le manifeste (le pont
  y était injecté) et dans `ORIGINE_APP`. Vérifié sur le projet Vercel : seuls
  `vrm.center` et `cancale-v67-ten.vercel.app` (qui redirige) lui appartiennent
  — Vercel a ajouté « -ten » parce que `cancale-v67` était déjà pris. Une page
  servie là pouvait faire **adopter SA session VRM** à l'extension (les captures
  de Julien, jetons Vinted compris, partaient dans sa boutique) et **commander
  des actions Vinted** (accepter une offre, répondre). Et la règle n'était pas
  ancrée : `https://vrm.center.autre-site.com` passait. ⇒ `ORIGINES_APP`, UNE
  liste exacte comparée à `new URL(src).origin` ; `APP_URLS` en découle.
  **Extension 5.149.0.** `audit-exec.cjs` : 2 rouges sur l'avant (les 4
  imposteurs nommés). ⚠️ **Ne jamais remettre une adresse dans cette liste sans
  l'avoir vue dans les domaines du projet Vercel.**
- ⚠️⚠️ **`/api/vinted-refresh` ÉTAIT PUBLIQUE** : n'importe qui déclenchait le
  renouvellement en masse des jetons de TOUS les comptes de TOUS les vendeurs
  depuis l'IP de Vercel — le schéma que le journal (juillet) accuse d'avoir fait
  bloquer un compte — et la réponse listait leurs identifiants Vinted.
  **`/api/vinted-connect` aussi** : il rangeait le compte collé chez le
  propriétaire de l'installation. ⇒ Les deux exigent la session
  (`vendeurExige`) et ne touchent qu'aux comptes de CE vendeur.
  `routes-ecriture.cjs` : 3 rouges sur l'avant.
- **`/api/ai`** : la clé IA du serveur (pas encore posée) aurait servi à
  n'importe qui. Elle exige la session et un abonnement en règle ; l'app et
  l'extension envoient le jeton. Une clé apportée par l'appareil reste libre.
- **Base (migration 007)** : la clé publique ne peut plus que LIRE (RLS lui rend
  `[]`) — elle avait encore insert/update/delete et **TRUNCATE, que RLS ne
  filtre pas**. `search_path` figé sur `vrm_meta` et son déclencheur.
- **Ce qui a été vérifié et qui va bien** : gitleaks → 30 « fuites », toutes la
  clé publique `anon` (vérifié rôle par rôle) et la clé PUBLIQUE des
  notifications ; aucun secret dans l'historique. `npm audit` : 0 vulnérabilité
  en production. Les insertions de HTML de l'extension passent toutes par
  `esc()` ; les écoutes de messages vérifient `event.source === window`.
  Le conseiller Supabase ne signale plus que deux choses VOULUES (`vrm_reglages`
  sans règle = serveur seul ; `vrm_acces*` exécutables par un vendeur connecté =
  elles ne disent que SON accès).
- ✅ **`/api/vinted-proxy` FERMÉ (4 octobre, soir)** : c'était un relais OUVERT —
  n'importe qui lui envoyait un jeton Vinted et une adresse de son choix, avec
  n'importe quelle méthode (DELETE compris), et la requête partait de l'IP de
  VRM. Il exige la **session**, ne prend **plus aucun jeton du navigateur** (il
  lit ceux du compte `uid` en base, AVEC la session du vendeur — RLS — et filtré
  sur son `owner`), ne fait que **lire** (GET, `LECTURES_PERMISES` : les sept
  adresses que l'app lit vraiment), et répond 503 si la base ne répond pas.
  Banc `proxy.cjs` (route exécutée, **17 contrôles, 13 rouges** sur l'avant).
- **Reste ouvert, noté** : le `pushsubscriptionchange` du
  service worker n'a pas de session (ré-enregistré à l'ouverture suivante).
  **À Julien** : dépôt public, clé publique `anon` → clé « publishable »,
  réglages d'authentification (confirmation d'email, longueur du mot de passe)
  dans le tableau de bord Supabase.


### Détourage Photoroom avant chaque publication (4 octobre, 5.156)
Julien : « intègre l'API de Photoroom pour le détourage des photos avant chaque
poste ». L'ancienne route (25 sept.) avait été retirée pour rester à 12
fonctions ; elle n'avait ni session, ni cache, ni plafond.
- **Serveur** : un MODE de `api/ai.js` (`?mode=detourage`, rewrite
  `/api/detourage`), logique dans `api/_lib/detourage.js`. Session + abonnement
  exigés ; **réservé au propriétaire** sauf `PHOTOROOM_POUR=tous` (c'est sa clé,
  facturée à la photo) ; **cache par empreinte SHA-256** des octets d'origine
  (recalculée par le serveur — une photo ne peut pas être rangée sous
  l'empreinte d'une autre), dans un compartiment PRIVÉ rangé par vendeur ;
  **plafond mensuel** réservé par la base en une instruction
  (`vrm_detourage_reserver`, migration 008 — jamais un lire-ajouter-réécrire) ;
  compteur illisible ⇒ on ne paie PAS ; un REFUS de Photoroom rend l'unité, mais
  un délai ou une coupure APRÈS sa réponse la garde (l'image a pu être facturée) ;
  cache illisible ⇒ 503 (on ne repaie pas) ; plafond atteint ⇒ dès la sonde.
  ⚠️ `PHOTOROOM_POUR=tous` exige un abonnement Stripe **réellement payé** : la
  règle d'accès générique laisse passer tout compte tant que l'abonnement n'est
  pas obligatoire, un compte gratuit aurait dépensé sa clé.
  `audit-fonctions-api.cjs` refuse une 13ᵉ fonction (#250 avait bloqué TOUS les
  déploiements).
- **Extension** : `detourerPhotos`, en fin de `photosEnOctets` — le seul point
  par où passent les photos que l'extension attache. ⚠️ **eBay n'en profite
  PAS** : sa seule voie de publication restante (`EbayPublier` → `/api/ebay`)
  envoie les liens Vinted bruts, sans l'extension. L'écrire « Leboncoin ou eBay »
  était faux (revue adverse) ; le brancher appartient à la session eBay. Réglage illisible = éteint ;
  l'affiche générique de Vinted (12 des 780 photos captées) n'est jamais envoyée ;
  l'empreinte part d'abord SANS la photo ; 3 envois à la fois, 45 s de budget ;
  arrêt sur clé absente, plafond, crédits épuisés, compte non autorisé. **Toute
  issue autre qu'un succès garde la photo d'origine** et note la raison ; le
  bandeau Leboncoin écrit « dont N détourées » (parmi les photos POSÉES) ou la
  raison qui compte (une raison d'arrêt avant « l'affiche du site »).
  ⚠️ **« Continuer » attend les photos** : elles peuvent mettre 45 s à revenir du
  détourage, et l'enchaînement des étapes partait sans elles (banc
  `leboncoin.cjs`, vu au rouge : clic à 2,1 s, photos à 4 s).
- **App** : Réglages → « Détourer mes photos avant de publier » (Éteint par
  défaut · Photo de couverture · Toutes), `vrm_detourage` synchronisé. La carte
  dit ce que le SERVEUR dit (`usage=1` : clé posée ? compte autorisé ? N sur
  plafond) — cinq états, et « pas su » n'affiche aucun nombre.
- Preuves : `audit-detourage-ext.cjs` (le vrai `background.js` : 29 contrôles,
  18 rouges sur l'avant, 9 en réaffaiblissant), bancs `detourage.cjs` (la route :
  21 rouges sur l'avant) et `detourage-reglage.cjs`. Guide : `docs/photoroom.md`.
- ⚠️ **Pas de préchauffage au clic « Publier »** : deux instances qui manquent le
  cache en même temps paieraient deux fois. Le détourage se fait quand les
  octets sont lus, c'est tout.


### Le journal des plantages, sans fournisseur (4 octobre)
Un écran mort se voyait par une capture, jamais par un signal — et ceux d'un
autre vendeur ne nous arriveraient jamais. `src/plantages.js` note chaque
erreur (garde-fou d'écran, dernier filet, `error`/`unhandledrejection` écoutés
dès `main.jsx`) dans **sa propre base** : `plantage_{empreinte}`, au nom du
vendeur, envoyé depuis `AppCoeur` (session obligatoire). **Aucun tiers** (pas de
Sentry) : la politique de confidentialité n'a pas à changer.
- Gardé : message, 6 lignes de pile, écran, version, navigateur en deux mots.
  **Jamais** un email, un jeton, une suite de 5 chiffres ou plus, ni les
  paramètres d'une adresse. Bruit écarté (réseau, extensions). Une même erreur
  une fois par heure et par appareil, dix par ouverture ; une écriture non
  confirmée **reste en file**.
- « État des connexions » dit « Écrans en erreur · N ces 7 derniers jours » —
  rien sur zéro, rien sur une lecture ratée.
- ⚠️ Revue adverse : le premier jet laissait passer un login cité par le
  navigateur (« reading 'julatace3535' »), un téléphone espacé, un prix, un
  `refresh_token=…`, un UUID et une adresse encodée ; jugeait le bruit sur TOUTE
  la pile (une extension tierce plus bas cachait une vraie erreur de l'app) ;
  gardait le nom de fonction minifié dans l'empreinte (une ligne par
  déploiement) ; et écrasait un plantage noté pendant l'envoi. Tout est corrigé
  et au banc.
- **Pour une prochaine session** : `select id, data from app_data where id like
  'plantage_%' order by data->>'at' desc` donne les écrans tombés chez les
  vendeurs. Banc `plantages.cjs` (29 contrôles, 8 rouges en réaffaiblissant).


### La sauvegarde complète l'est enfin (4 octobre)
« Télécharge TOUT : catalogue, ventes, achats… » était faux : le fichier ne
portait que la ligne `main`. Il porte maintenant les réglages (restaurables,
comme avant) **et toutes les lignes captées** (ventes, achats, messages,
annonces, emails), lues par pages de 500 — mesuré : 4 487 lignes, 12 Mo. Restent
dehors, et le fichier le DIT (`omis`) : les PDF de bordereau, le détail brut des
transactions (on garde leur `meta`) et les jetons Vinted. Une page ratée donne
`complet:false` et la liste de ce qui manque. La restauration ne réécrit PAS les
données captées (une copie ancienne écraserait une capture plus fraîche, §4.2).
⚠️⚠️ **Et le premier jet FAISAIT FUIR SEPT SECRETS** (revue adverse, prouvé au
banc `sauvegarde.cjs` sur le code d'avant) : la boucle relisait le navigateur,
qui garde `vinted_accounts` AVEC access/refresh/csrf, sans l'allègement que
`cloudPush` applique — plus `ebay_tokens`, les clés des téléphones (`push_subs`)
et la clé du widget. La règle est maintenant celle du nuage (§11), ces lignes ne
quittent pas la base, et un filet retire tout champ de jeton du fichier.
- **Restaurer une vieille sauvegarde rendait libres les numéros posés depuis**
  (§5 : un numéro écrit sur un carton ne sert jamais deux fois). Le pool est
  l'UNION ; pour les fiches numérotées, ce qui est en place gagne et le fichier ne
  comble que les manques. Jamais de `vinted_accounts` ni de clé du widget depuis
  un fichier.
- **« ✓ restaurée » s'affichait même quand le nuage avait refusé l'écriture** —
  et le rechargement relisait l'ancienne ligne : tout disparaissait sans un mot.
  Écriture vérifiée ; sur un échec, valeurs d'avant remises, pas de rechargement,
  et on le dit.
- « Dernière sauvegarde : aujourd'hui ✅ » n'est posée que pour un fichier
  complet ; des réglages lus avant l'arrivée du nuage rendent le fichier
  « incomplet ». Banc `sauvegarde.cjs` : 19 contrôles, **9 rouges** sur l'avant.


### ⚠️⚠️ « LE COMPTE DE L'EXTENSION EST SÉLECTIONNÉ » NE S'ÉTAIT JAMAIS ALLUMÉ (9 octobre)
Demande de Julien du 7 octobre (#462-#464, une autre session) : la liste
« Compte » choisit d'office le compte ouvert dans Chrome, les autres sont
estompés et inertes. Revue du 8 octobre, quatre défauts reproduits au rendu :
- ⚠️⚠️ **Le compte était lu dans `authEtat`, qui ne le porte pas** (session VRM
  seule, de la 5.116 à la 5.163). `compteConnecte` valait toujours `''`. La
  seule réponse qui le porte est `etat` : `vintedDeChrome()` (trois états), la
  même lecture que la pastille « Actions possibles · {compte} » (§11). Aucune
  extension à changer.
- **Messages disait « Tout est lu » au-dessus de non-lus** d'un compte estompé
  (le compte ne gardait que le compte choisi) et sur une boîte illisible.
  Il compte la liste AFFICHÉE ; ceux d'un compte estompé sont dits à côté avec
  le geste ; une boîte qui n'a pas pu être lue est nommée (`convs.ko`) et une
  liste partielle n'est plus mise en cache.
- **« N offres à trancher » listait un compte exclu ou retiré** (5 offres de
  julienf765, mesuré). Écartées comme la conversation ; « retiré » ne se juge
  que sur une liste de comptes LUE ; une offre sans compte reste.
- **La liste proposait les comptes exclus**, et en choisir un floutait tout
  l'écran. `compteEffectif` (une règle pour la liste et le flou) ne retient
  qu'un compte qu'on peut montrer ; Chrome sur un compte exclu ⇒ « Tous ».
  Les ventes d'un compte masqué restent visibles par « les voir », sous
  « Tous les comptes ».
- Une fois allumé, le flou d'office touche Ventes/Achats/Annonces/Messages (pas
  Colis) : la note sous la liste le dit UNE fois, avec « Tous les comptes ».
- Banc `filtre-compte.cjs` (données inventées) : **17 rouges** sur e6bda5c,
  chaque règle réaffaiblie seule repasse au rouge. `messagerie.cjs` choisit
  désormais « Tous les comptes » (son pont est sur compte_a).


### ⚠️⚠️ « J'AI SUPPRIMÉ BEAUCOUP DE PAIRES, ELLES SONT ENCORE DANS LES ANNONCES » + « L'EXTENSION NE RÉPOND PAS » (9-11 octobre, 5.165)
Il supprimait toutes ses annonces pour tout reposter, juste après avoir installé
la 5.164. **Mesuré** (base en lecture seule, journaux de la base, Chromium réel
avec les vraies extensions — détail dans le passage du 10 octobre) :
- le dressing de cinq comptes datait du 8 au soir (~41 annonces « en ligne »
  supprimées depuis), et l'écran Annonces ne disait NULLE PART de quand datait
  sa lecture (il ne prévenait qu'au-delà de 7 jours) ;
- la moisson de llloollllaa a bien été lue chez Vinted (18:38), puis **refusée
  en bloc par la base** (400 : partie sans session VRM) ; la garde des 5 min,
  posée avant, a interdit tout nouvel essai une fois la session revenue ;
- une copie plus ancienne de VRM tournait **à côté** (une ≤ 5.77 vivante à
  18:37) : chaque commande et chaque `exec` de l'app partaient vers LES DEUX
  (mesuré : « cmd:bordereau ×2 », « exec …/replies ×2 »), la session tendue par
  l'app était adoptée par les deux (`refresh_token_already_used`), et l'app
  affichait la version du DERNIER `ready` — « mets à jour » juste après la mise
  à jour ;
- la seule trace d'une suppression était `writereq`, posée AVANT la requête
  (donc aussi pour une suppression refusée), sans statut, une ligne par compte
  écrasée à chaque fois.
**Remesuré le 11 octobre** : llloollllaa, julatace35260, tomj606 relus le 10 au
soir, angeled92 le 11 ; **tomj683 et arthuror2 toujours au 8 octobre 22:30**
(16 annonces « en ligne »). `panel_diag_capture.ver` = 5.164.0 ; aucune ligne
`harvest_*_supprimees` (la 5.165 n'est pas installée).

**Corrigé** :
1. **La moisson** (`background.js`) : sans session VRM sur base cloisonnée, rien
   ne part chez Vinted (`visite_sans_session`, `moisson_sans_session`) ; la garde
   des 5 min est RENDUE sur échec (nouvel essai à 60 s, entière pendant une
   pause Vinted) ; une moisson ne compte que ce qui est RANGÉ (tout refusé ⇒
   `abandon`, pas de seconde moisson) ; un dressing lu EN ENTIER par la moisson
   (toutes les pages, `complet`) fait foi même vide ou plus court
   (`dressingCompletFaitFoi`) — une page partielle n'écrase toujours pas (§4.2) ;
   compte changé pendant la moisson ⇒ rien rangé ; la capture passive ne range
   que SON dressing (jamais celui d'un autre membre) ; plus de balayage de tous
   les comptes (`activeFetchAll`) en repli.
2. **La suppression vue sort l'annonce de VRM, par identité** : `inject.js`
   poste `{suppression, itemId, status}` dans le rappel de la RÉPONSE, seulement
   pour un `POST /api/v*/items/{id}/delete` en **2xx** sur Vinted ; le fond
   (`noterSuppression`) revérifie, met en file dans `chrome.storage.local`
   (§4.9), range `harvest_{uid}_supprimees = {ids:{[id]: atISO}}` (500 au plus)
   en lire-fusionner-réécrire gardé, sur UNE chaîne (dix suppressions à la suite
   ne se perdent pas), et prévient l'app (`maj · annonces`). Un dressing rangé la
   prévient aussi. **Une règle des deux côtés** (`supprimeeApres`, bloc
   `<supprimees-regle>`) : écartée si supprimée APRÈS la lecture du dressing
   (`capturedAt` + marge de 5 min : c'est l'heure du rangement) ; le dressing
   relu après fait foi ; ligne illisible ⇒ rien n'est écarté. Appliquée LÀ où
   le dressing est lu (`fetchHarvestBrut` ; `retirerSupprimeesLignes` pour les
   balayages : file Leboncoin de l'app, recherche, prix du marché), donc Annonces,
   ses chiffres et le tableau de bord la suivent ; côté extension `buildLbcData`,
   `buildEbayData` et `capterPhotosAnnonces` (plus de 404 sur une annonce
   supprimée). ⚠️ Supprimée n'est PAS vendue : rien n'entre dans une preuve de
   vente, un CA ni « à retirer ailleurs », et le numéro n'est pas touché.
3. **La fraîcheur, une fois** (`FraicheurAnnonces`, Annonces ET tableau de bord,
   §11) : au-delà de 30 min (⚠️ 12 h, ou vu actif depuis, après la revue — section
   suivante), nomme les comptes et l'heure (« annonces lues hier
   à 22 h 30 — ce que tu as supprimé ou mis en ligne depuis n'y est pas ») et le
   geste (ouvrir vinted.fr connecté sur ce compte) ; sans couleur ; rien quand
   tout est frais. Remplace le « pas rafraîchie depuis une semaine ».
4. **Deux extensions** : le pont (5.165) joint l'identifiant de l'extension à
   `ready` ; l'app compte les ponts qui répondent à UN même `ping`
   (`sonderPonts`, au premier `ready` puis à chaque battement). Deux ⇒ code
   `plusieurs` AVANT `retard`/`muette` (« supprime l'ancienne dans
   chrome://extensions, puis recharge »), et **ni commande, ni `exec`, ni
   session** ne partent (une commande attend le premier compte, ≤ 2,5 s). La
   version retenue est la plus HAUTE. Un orphelin depuis la 5.129 se tait : il
   ne compte pas ; un orphelin plus ancien répond encore — d'où « si tu viens de
   la retirer, recharger suffit ». ⚠️ Un `ready` qui répond à notre propre
   compte ne remet pas les ratés à zéro (sinon une extension muette n'était plus
   jamais dite muette — c'est `pont.cjs` qui l'a vu).
5. `CODE_VERSION` (en tête de `background.js`) part avec `ver` dans
   `panel_diag_capture` : copie partielle (manifeste neuf, code ancien) et deux
   extensions se distingueront enfin. `audit-extension-zip` l'exige égale au
   manifeste.
- **Preuves** (rouge sur cdc9c1d, vert après, mutations) :
  `audit-moisson-dressing.cjs` 20 contrôles, **12 rouges**, 7 mutations rouges
  (page partielle, total ignoré, garde, session, écritures, compte, autre
  membre) · `audit-supprimees.cjs` 36 contrôles (le vrai `inject.js` →
  `content.js` → `background.js`), **17 rouges**, 6 mutations rouges (statut
  page/fond, pas su, marge, divergence app/extension, file Leboncoin) ·
  `audit-fusion` porte `harvest_{uid}_supprimees` (lecture KO, écriture OK) ·
  bancs `supprimees.cjs` (**16 rouges**, 4 mutations rouges) et
  `deux-extensions.cjs` (**19 rouges**, 5 mutations rouges), données inventées,
  390 et 1512 px. Bancs voisins verts un par un : annonces-carte, filtre-compte,
  pont, capacites, premierjour, double-vente, messagerie, comptes, tout-generer,
  publier, verif_visuel. ⚠️ `publier.cjs` était déjà rouge sur cdc9c1d (il
  servait 5.130 comme « à jour », le seuil est 5.160) : il lit maintenant le
  seuil dans l'app.
- `EXT_CAPACITES.supprimees = '5.165.0'` (`noterSuppression`) : la phrase « une
  suppression faite sur vinted.fr dans ce Chrome sort d'ici tout de suite » ne
  s'écrit que si `extSait('supprimees') === 'ok'`.
- ⚠️ **Non mesuré** : la forme réelle de la réponse de Vinted à une suppression
  (on ne lit que le statut) ; le délai réel entre le 200 et la navigation sur le
  vrai réseau (mesuré en local seulement) ; ce que fait un onglet Vinted ouvert
  AVANT la mise à jour (son `inject.js` est l'ancien : ses suppressions ne
  partent qu'après rechargement — rien n'est réinjecté) ; combien de copies de
  VRM tournent chez lui (seul `chrome://extensions` le dit). Une page Vinted
  pourrait forger un message `suppression` : au pire une annonce est cachée
  jusqu'à la relecture suivante de son dressing.
- **Geste de Julien** : installer la 5.165 dans UN seul dossier (supprimer toute
  autre entrée VRM dans `chrome://extensions`), recharger ses onglets Vinted,
  puis passer une fois sur **tomj683** et **arthuror2**. (⚠️ La 5.165 n'est
  jamais partie : c'est la **5.166** de la section suivante qu'il installe.)


### ⚠️⚠️ « SE CONNECTER » OUVRE VRM, LA SESSION TIENT, LE CODE PÉRIMÉ SE RÉPARE (11 octobre, 5.169)
Plaintes de Julien : « se connecter doit envoyer dans VRM », « elle ne garde pas
les connexions », « l'extension n'est pas allumée », « je ne peux pas poster sur
Leboncoin ». Causes MESURÉES (journaux d'auth, vrai GoTrue, vrai Chromium) :
- ⚠️⚠️ **5 Chrome sur 6 exécutaient une 5.95–5.129 sous un manifeste « 5.164 »** :
  remplacer le dossier ne recharge PAS le service worker ; seul ⟳ le fait, et
  seulement dans le Chrome où on le clique. ⇒ au démarrage, un code ≠ manifeste se
  recharge UNE fois (garde `vrmRechargeCode`) ; le pont (toujours lu depuis le
  disque) juge le code qui répond (`perime`) et pose `popup.html?mode=reparer`, qui
  vérifie AVANT ⟳ ; l'état porte `code` et `ext` ; l'app dit « périmé » (pastille
  ambre, commandes coupées, geste ⟳). La consigne de mise à jour dit les DEUX
  gestes : remplacer le dossier, PUIS ⟳ dans CHAQUE Chrome (`audit-extension-zip`).
- ⚠️⚠️ **La session ne passe plus par la page** (⚠️ sauf, depuis le 12 octobre,
  pour une extension d'AVANT la 5.171 — voir « Relecture croisée de la 5.174 ») : `window.postMessage` était
  entendu par toute extension (une copie ancienne adoptait la même famille de
  jetons → révoquée), un `session: null` au démarrage d'une app morte faisait
  oublier la sienne à l'extension (B9), et l'app prêtait SA famille aux < 5.129.
  ⇒ `externally_connectable` : l'app demande à UNE extension (son identifiant)
  si elle a besoin d'une session (`liaison` → nonce 128 bits, 2 min, une fois),
  fait fabriquer la sienne par le serveur, la lui remet avec le nonce. Seul
  « Se déconnecter » (un geste) la déconnecte, et sous CE compte seulement.
- **Renouvellement** : une réponse perdue est rejouée (+1,5 s, +4 s) — le vrai
  GoTrue rend le jeton actif au parent ; une session morte prévient l'app tout de
  suite (`evt session morte`) ; les alarmes ne sont plus remises à zéro à chaque
  réveil (`vrm-session` ne partait jamais).
- **« Se connecter avec VRM »** (fenêtre, et le logo des sites à chaque clic) ouvre
  `vrm.center/?lier-extension=<id>` ; connectée, l'app connecte l'extension ;
  sinon une connexion dans VRM suffit. Le mot de passe VRM reste derrière un lien.
- **Leboncoin** : un dépôt fermé ou arrêté passe à « abandonné » (onglet retenu,
  `depotArrete`) — « Le dépôt n'a pas abouti — Réessayer » ; un clic refusé dit
  pourquoi ; « Actions possibles · sauf publier » ; le bouton dit « 2 photos sur
  5 ». Écritures `lbc_recon`/`lbc_catalogue` : morceaux dans
  `chrome.storage.local`, au plus une écriture par 30 s et seulement si ça change
  (40 Mo par visite mesurés le 10 octobre).
- Preuves (rouges sur ef03dc8, verts après) : banc `session.cjs` (vrai Chromium,
  vraie extension, faux GoTrue à la rotation RÉELLE, port 4794) **18 rouges** ;
  `pont.cjs` 20 ; `publier.cjs` 5 ; `deux-extensions.cjs` 2 ;
  `audit-pont-session.cjs` 19 ; `audit-lbc-catalogue` 4 ; mutations (rejeu
  retiré, mort non annoncée, pont qui ne juge plus) ⇒ rouges.
- ⚠️ **Non mesuré** : la vraie page de dépôt Leboncoin fermée/arrêtée ; la
  réparation sur SES Chrome (prouvée sur un profil reproduit, pas chez lui) ;
  le catalogue Leboncoin attend en mémoire du service worker (renvoyé à chaque
  visite, rien de perdu). Extension **5.169.0** (écrite comme « 5.167 en cours », mais les 5.167 et 5.168 sont parties en production SANS ce code : deux contenus ne portent jamais le même numéro), zip régénéré.


### ⚠️⚠️ REVUE DE LA SESSION ADRESSÉE : « JE LA (RE)CONNECTE » SANS RIEN ENVOYER (11 octobre, 5.169)
Revue contradictoire du chantier ci-dessus, chaque constat REPRODUIT (rendu sur
données inventées, vrai `background.js` dans un `vm`, vrai Chromium + vraie
extension), corrigé, rouge sur 24bec0d et sous mutation.
- ⚠️⚠️ **La version** : ce code était écrit « 5.167 en cours », mais la 5.167 et
  la 5.168 sont parties en production SANS lui. Il passe en **5.169.0** — et les
  seuils qui datent ses nouveautés aussi (`EXT_CAPACITES.liaison`,
  `CODE_DANS_ETAT`, le jugement du code par `bridge.js` et `vrm-badge.js`) :
  à 5.167, une 5.168 publiée aurait été déclarée « périmée » à tort.
- ⚠️⚠️ **« Je la (re)connecte — rien à taper » à une extension qui ne reçoit plus
  rien.** La garde (« elle ne sait pas recevoir la session adressée ») n'était
  posée que sur « pas connectée » : « autre compte VRM » et les premiers pas le
  promettaient encore à une 5.164 (mesuré : 0 envoi en 25 s), et « Se connecter
  avec VRM » nommait un bouton que sa fenêtre n'a pas. ⇒ **`voieConnexionExt()`**,
  une règle pour l'en-tête, la liste des ventes, le panneau et les premiers pas :
  `app` (5.169, le serveur n'a rien refusé) · `retard` (la mettre à jour, ou le
  mot de passe VRM) · `serveur` (refus 429/503 : le mot de passe ; l'app
  réessaie après `__sessExtPasAvant`). Le panneau lisait « Se connecter avec
  VRM » pendant que la liste disait le mot de passe : c'est fini (§11).
- **Autre compte + extension d'avant la 5.169** : son icône, connectée, ouvre
  VRM (pas sa fenêtre) — « clique l'icône, Se déconnecter » était impossible.
  Le seul geste d'ici : **« Déconnecter l'extension de ce Chrome »**, l'ANCIEN
  message (`session: null`), sur ce clic seulement ; puis le mot de passe VRM
  dans sa fenêtre. Même message sur le geste « Se déconnecter » de VRM (une
  5.164 continuait d'écrire sous ce compte) — jamais quand on SAIT qu'elle écrit
  sous un autre compte ; une 5.169 l'ignore (elle passe par l'adressé).
- **« Se connecter avec VRM » bloqué** : avec une copie ancienne à côté, la
  session part quand même, ADRESSÉE à celle qui a demandé (les commandes restent
  coupées) ; sur un code périmé, le bandeau le dit (⟳) et repart après la
  réparation ; la croix apparaît toujours au bout de 6 s. Le bandeau laisse la
  place de l'île (`vrm-tete-row`) : sa croix ne se cliquait pas à 1512/1280 px.
- **Périmé réparé, page ouverte** : le pont remis à neuf annonce `ready` ; l'app
  relit l'état tout de suite (avant : « périmé — clique ⟳ » ~20 s, commandes
  coupées).
- **La fenêtre de l'icône sur un code périmé** (5 de ses 6 Chrome) : l'ancien
  service worker ne connaît pas `lierAvecVRM`, le clic ne faisait RIEN. Sans
  réponse, `popup.js` (lu depuis le disque) ouvre VRM avec l'identifiant de
  l'extension, répare le code (⟳), sinon déplie le mot de passe VRM et dit ⟳.
- **Dépôt Leboncoin** : un onglet ouvert n'est pas un dépôt vivant (navigué sur
  vinted.fr, il bloquait la paire pour toujours) — vivant = adresse de dépôt ET
  réponse de `lbc.js` pour CETTE paire (grâce de 30 s / page qui charge : un
  double clic n'abandonne rien). Un arrêt à 90 s ou un onglet fermé, c'est « pas
  su » : il a pu FINIR À LA MAIN (champ obligatoire non devinable) — l'app ne dit
  plus « n'a pas abouti », nomme « Déjà publiée », et **relancer exige sa
  confirmation** (l'extension refuse `confirmer` sans elle). La paire en dépôt
  n'est rendue (`getPending`) qu'à l'onglet ouvert pour elle.
- ~~Laissé tel quel, décision assumée : une extension d'avant la 5.169 ne reçoit
  plus de session de l'app~~ — ⚠️⚠️ **RENVERSÉ le 12 octobre** (« Relecture
  croisée de la 5.174 », plus bas) : il ne peut pas mettre à jour, et la
  production les reconnectait.
- Preuves : `pont.cjs` **18 rouges** sur 24bec0d · `premierjour.cjs` 10 ·
  `deux-extensions.cjs` 2 · `publier.cjs` 6 · `popup.cjs` 3 · `leboncoin.cjs` 1 ·
  `audit-pont-session.cjs` 7 · `session.cjs` (vrai Chromium, cas G/P/S) 5 ;
  7 mutations de l'app, 4 de l'extension, 2 de la fenêtre ⇒ toutes rouges.
- ⚠️ **Non mesuré** : la vraie page de dépôt Leboncoin (réponse de `lbc.js` sur
  leboncoin.fr) ; le délai réel entre ⟳ et le `ready` du pont réinjecté chez lui.
- **Geste de Julien** : installer la **5.169** dans UN seul dossier, puis ⟳ dans
  CHAQUE Chrome (ou ouvrir VRM : le pont répare un code périmé tout seul).


### ⚠️⚠️ RELECTURE CROISÉE DE LA 5.174 : QUATRE DÉFAUTS ENTRE LES TROIS CHANTIERS (12 octobre, 5.175)
Les trois chantiers de l'intégration (connexion, preuve de vente, notifications)
avaient été relus SÉPARÉMENT. Relus ENSEMBLE, face aux extensions qu'il a
AUJOURD'HUI — **il ne peut pas mettre à jour** (5 de ses 6 Chrome exécutent un
code 5.95–5.129 sous un manifeste 5.164 ; la 5.170 n'est pas installée) — la
nouvelle app devait faire AU MOINS ce que faisait la production (2fed734).
Chaque défaut REPRODUIT d'abord (le VRAI `bridge.js` de la 5.164 et de la 5.170
lu dans git, le vrai `background.js` dans un `vm`, la vraie 5.164 chargée dans
Chromium), corrigé, rouge sur 0caff0d et sous mutation.
- ⚠️⚠️ **Une 5.164 / 5.170 sans session, à la session MORTE, ou sur un AUTRE
  compte VRM n'était plus jamais reconnectée** (la production le faisait en un
  battement). `assurerSessionExtension` sortait sur `!ext` (l'état d'avant la
  5.171 n'a pas `ext`) puis sur `liaison !== 'ok'`. Sans session, la 5.164 écrit
  avec la clé publique — refusée par RLS : plus rien de ce Chrome n'arrivait tant
  qu'il ne retapait pas son mot de passe, **dans chacun de ses Chrome**. Et l'app
  y menait elle-même : elle conseille ⟳ au code 5.95–5.128, après quoi c'est la
  5.164 qui tourne… sans session.
  ⇒ **Voie `page`** (`connexionParLaPage`, `sessionParLaPage`) : le chemin de la
  production, resserré — extension d'avant la 5.171 qui répond à « état »
  (≥ 5.129), code non périmé, UN seul pont (`!__vmrPlusieurs`, après
  `sondageConnu`), et seulement si `connecte === false`, « pas su » deux
  battements de suite, ou un autre compte avec l'onglet au premier plan (jamais
  pour « séparer » une extension saine) ; session fabriquée par le serveur
  (`mode=session-extension`, une famille à ELLE — `sessionAppPourExtension`
  reste retirée ; serveur qui refuse ⇒ rien, et `__sessExtErreur` le dit) ;
  postée `{__vmr:'session'}` vers `location.origin`, bornée par
  `__sessExtPasAvant`. `session: null` n'est toujours posté que sur un GESTE.
  `voieConnexionExt()` rend `'page'` : la promesse « je la connecte » suit
  l'envoi, et le secours nomme ce que SA fenêtre a (email + mot de passe VRM —
  pas « Se connecter avec VRM », qu'elle n'a pas). Une 5.171+ ignore ce message
  (son pont répond `canal`).
- ⚠️ **« Se déconnecter » puis reconnexion laissait une 5.164 / 5.170 déconnectée
  pour de bon** (D9 lui fait oublier sa session au geste — juste ; mais rien ne la
  lui rendait). Corrigé par la voie `page`.
- ⚠️⚠️ **Preuve de vente : un échec passager cachait la vente 6 h** à l'anti
  double vente (et au retrait automatique d'eBay), pendant que l'écran promettait
  « à ta prochaine visite ». Le mémo était posé AVANT la requête et jamais ôté :
  une écriture refusée par NOTRE base (recul d'une minute) ou un 429 (pause de
  15 min) ⇒ relue à +6 h 06. Même motif dans `capterRetraits` (6 h) et
  `capterDatesVersement` (24 h). ⇒ `suiteLectureRatee` / `memoApresEchec` (une
  règle pour les trois) : 4xx autre que 401/403/429 = jugé, délai normal ; 5xx =
  30 min ; pause, 429/403, 401, réseau = mémo ôté (la pause empêche avant) ;
  écriture refusée par notre base = mémo ôté et on s'arrête (`rangerTransaction`
  et `noterRetrait` rendent `null` pour « pas rangé », `false` pour « rien à
  ranger »). La vente reste comptée dans `noterLecturesDues` : la réserve de
  lecture tient. Extension **5.175.0** (CODE_VERSION, EXT_ATTENDUE, zip).
  ⚠️ `audit-evt-extension.cjs` exigeait l'orthographe `noterRetrait(...) === false`
  sur une écriture refusée : il juge maintenant la règle (jamais « écrit », l'app
  pas prévenue) et la nouvelle distinction (`null` ≠ `false`).
- **eBay → Annonces, « vente pas encore reliée »** : « ou génère son bordereau
  (bouton ci-dessous) » s'écrivait au-dessus d'un bouton GRISÉ — et avec deux
  extensions, le même paragraphe disait « je n'en envoie aucune ». Le bouton et
  la phrase ne sont là que si `raisonExtGlobale(sansSouris, {cap:'commande'})`
  vaut `null` ; sinon « ouvre la vente sur vinted.fr » (le bouton de l'écran
  Ventes reste, grisé avec sa raison).
- Preuves (rouges sur 0caff0d, verts après) : `session.cjs` (vraie 5.164 dans
  Chromium, cas F, F2 morte, F3 autre compte, F4 5.164+5.170, F5 5.164+neuve, S
  déconnexion → reconnexion) **17 rouges** ; mutation (deux copies + jeton de
  l'app) ⇒ 5 rouges, dont F4 « les deux adoptent la même famille » ;
  `pont.cjs` (simulé + VRAI `bridge.js` 5.164 : morte, deux copies, cycle)
  **10 rouges** ; `premierjour.cjs` **4** ; `audit-preuve-vente.cjs` §10
  **12 rouges**, 5 mutations rouges (`memo-echec-garde`, `memo-ecriture-*`,
  `cinq-cents-six-heures`) ; `ebay-annonces.cjs` **8 rouges** (deux extensions,
  périmé, 5.164 périmée et muette, pas connectée, autre compte, absente ; l'autre
  sens : une 5.170 connectée garde bouton et phrase). Banc d'origine :
  `scratchpad/croisee/compat/banc-compat.cjs` (prod 2fed734 contre l'intégration).
- ⚠️ **Limite connue, comme en production** : deux copies de la MÊME version
  ancienne (sans identifiant dans leur `ready`, d'avant la 5.165) comptent pour
  une — la page les atteindrait toutes les deux. Non vu chez lui ; le geste
  (une seule copie par profil) est déjà dans la consigne.
- **Geste de Julien** : rien de neuf — installer la **5.175** quand il pourra
  (pas la 5.174, jamais livrée). D'ici là, ses 5.164 sont reconnectées par l'app.


### Les emails
- **C'est l'adresse de RÉCEPTION qui décide** à quel vendeur appartient un email —
  jamais l'expéditeur, le sujet ou le corps (sinon n'importe qui déposerait des
  données chez un autre).
- **On ne jette aucun email** : ce qu'aucune règle ne reconnaît est conservé entier.
- Le classement d'un colis se lit **sur le SUJET d'abord**, le corps seulement en
  repli (le corps d'un « colis disponible » contient les consignes de retrait).
- **Un colis caché est un colis perdu** : on n'écarte jamais un colis en silence.


### « App plus rapide » — mesuré d'abord, au volume de sa base (16 octobre)
Retenue par Julien le 11 octobre. **Mesuré avant de coder** : banc
`scripts/bancs/vitesse.cjs` sur une base INVENTÉE au volume de la sienne
(`_base-volume.cjs`, tailles par famille lues en production le 16 octobre en
lecture seule : ~1 200 transactions, ~1 300 conversations, PDF de 100 Ko), un
aller-retour simulé (150 ms, 2 Mo/s, téléphone à processeur ×4), et le
profileur de Chrome sur un build non minifié.
- **Le code JS** : `App` = 1,73 Mo (518 Ko compressés), chargé à part de la
  page d'accueil ; `pdf-lib` et la 3D sont déjà paresseux. Le découper est un
  chantier à lui seul (un fichier de 42 000 lignes que cinq sessions modifient) :
  **pas fait**.
- ⚠️⚠️ **LE RÉSEAU : 16 à 45 LECTURES IDENTIQUES PAR ÉCRAN.** Ma journée faisait
  72–77 lectures de notre base, dont 16–21 strictement identiques
  (`lbc_ventes` ×5, `ebay_orders` ×5, `vinted_lbc_posted` ×4…) ; Messages 95–100
  dont 40–45. Chaque écran et chaque passage du centre de notifications relit à
  sa façon. ⇒ `src/lecturesPartagees.js` : une lecture GET de NOTRE base
  identique à une lecture en cours ou finie depuis moins de 2 s reçoit la même
  réponse (une copie). **Un échec n'est jamais gardé** (« pas su » reste « pas
  su »), **toute écriture vide tout** (à son départ et à son retour), le signal
  de l'extension (`vrm:ext`) vide tout, la session et `Range` font partie de la
  clé (deux vendeurs ne partagent rien). Vinted n'y passe jamais (§3).
  `audit-lectures-partagees.cjs` exécute la règle (`--prouve` : 3 mutations
  rouges).
- **La famille des transactions balayée 2 à 7 fois par écran** — la requête la
  plus coûteuse de la base (`pg_stat_statements`). Le pont transaction → annonce
  et les dates de versement lisent maintenant LA MÊME projection
  (`TXN_META_SELECT`) : un balayage, chacun garde sa règle de « pas su ».
- **Les suppressions lues une par compte** (7 allers-retours, à la suite des
  lectures publiques) : `lireSupprimees(uid)` lit dans `lireSupprimeesTous()`.
- **Le processeur au démarrage** (profileur, téléphone ×4) : le rapport
  comptable (~170 ms), le registre annuel (~125 ms) et le récap « Wrapped »
  (~100 ms) étaient recalculés à chaque arrivée de données sur TOUS les écrans
  du composant, Ma journée comprise : calculés seulement panneau ouvert. Le
  cache de session (`_persistAcctCache`, ~150 ms de `JSON.stringify` répétés)
  ne s'écrit plus qu'une fois par rafale (un effacement reste immédiat).
- **Résultat** (même base, même banc) : Ma journée **72–77 → 48–54 lectures**,
  doublons **16–21 → 0–4** ; Ventes 98–105 → 65–66 ; Colis 102–107 → 63–69 ;
  Annonces 87–92 → 47–50 ; Achats 97–102 → 58–63 ; Messages 95–100 → 50–51 ;
  tableau de bord 63–68 → 50. **Texte rendu identique** sur les 14 rendus
  (sauf la phrase des photos de Ventes, qui dépend du moment où le banc coupe
  les images — elle apparaît dans les deux sens). `vitesse.cjs` : **56 rouges**
  sur le build d'avant, 0 après.
- **La frappe dans la recherche de Ventes** (fait, 16 oct.) : mesuré (banc
  `ventes-frappe.cjs`, base inventée, 390 px, processeur ×4) — chaque lettre
  recréait les 60 lignes au rendu urgent PUIS au différé (120 à 240 par lettre),
  **151 ms de processeur** avant l'image (horloge médiane 343 ms). Ligne extraite
  en `LigneVenteVinted` (`React.memo`) : gardée telle quelle au rendu urgent
  (`gel` : seule la recherche a changé) ou quand `pre.deps` — tout ce qu'elle lit
  dans l'écran (`preparerLigneVente`) — n'a pas bougé ; gestes par
  `actionsVentes` (toujours la version à jour). Après : **0 ligne au rendu
  urgent**, 3 à 63 en tout, **62 ms** (horloge 120). Texte identique au build
  d'avant (`VENTES_REFERENCE`) et à une page ouverte à froid ; 2 rouges sur
  l'avant. ⚠️ Toute nouvelle valeur lue dans la ligne passe par
  `preparerLigneVente` (sinon ligne périmée).
- **Les rendus de `Comptabilite` au démarrage (17 oct.)** : mesuré par le crochet
  React (`vitesse.cjs`, 390 px ×4, médiane de 3) **14–19 → 11–12**. Deux causes de
  la COQUE : le statut du nuage (`syncStatus`, 3 rendus de toute l'app par
  sauvegarde) vit dans `BoutonSync` (magasin `poserStatutBouton`), et le
  porte-monnaie + l'âge des captures partent AVEC les ventes (un seul rendu au
  lieu de deux). Temps de la fonction `Comptabilite` ~750 → ~615 ms. Texte
  identique (`VITESSE_REFERENCE`). ⚠️ PAS de `React.memo` sur `Comptabilite` : elle
  lit des globales au rendu (`C`, `extSait`, `etatRelais`, `load(...)`) ; ni de
  garde « même contenu » sur ses `onCloudReady` (des effets de publication
  relisent le `localStorage` sur ce changement). Reste par arrivée de données.
- **Pas fait, mesuré** : (2) ~~rendus au démarrage~~ (réduits, ci-dessus) ; (3) ~~sonde → comptes → ventes à la suite~~ (fait,
  ci-dessous) ; (4) le code de l'app (518 Ko compressés).
- **La chaîne du premier écran raccourcie (16 octobre)** : au téléphone, le rendu
  d'AppCoeur (~600 ms de processeur ×4) s'intercalait entre la sonde et les
  comptes, puis ~350 ms avant les ventes. `prechargerDemarrage` (appelé par
  `authBoot` quand la porte sait qu'AppCoeur monte) lance les comptes ET les
  commandes de tous les comptes en UNE lecture (`lireTout … strict`) ; chaque
  compte LIÉ reçoit sa part dans `cachedRow('o:uid')` (mêmes lignes que
  `fetchHarvestOrdersBrut`), famille illisible ⇒ lecture par compte. Gardes
  inchangées : session = son jeton ; sans session seulement accès direct + base
  MESURÉE non cloisonnée (`SCHEMA_MESURE`) ; rien pendant une récupération ;
  échec ⇒ `null` (panne dite). Ventes lues au 2ᵉ aller-retour au lieu du 4ᵉ-5ᵉ
  (`vitesse.cjs`, 2 rouges sur l'avant) ; Ma journée 52 → 46 lectures ; texte
  identique (même build : famille coupée vs servie ; entre builds : `VITESSE_TEXTES`).
  Le temps au héros (~2,3–3,4 s → ~1,9–2,1 s au téléphone) varie trop sur la
  machine partagée pour un plafond.


### ⛔ Double vérification GRATUITE : un second appareil de secours, pas de SMS (22 octobre)
**Décision de Julien, 22 octobre : pas de SMS — c'est payant** (« Advanced MFA
Phone » : 75 $/mois chez Supabase, hors plafond, plus chaque SMS ; §2.9). La
double vérification reste l'app d'authentification (TOTP, gratuite), et le
chemin de secours est un **second appareil**.
- **La branche `codex/mfa-sms` (4870df1, 21 oct.) a été lue, fusionnée à l'essai
  avec main (un conflit : l'invitation au démarrage qu'elle modifiait a été
  retirée de main), puis NON gardée.** Au-delà du prix, elle était dangereuse :
  1. `utilisateurDe` exigeait `aal2` dès qu'un facteur est vérifié, et sa
     migration 022 posait une règle RLS restrictive `aal2` sur `app_data` et
     `vinted_accounts`. Or la session de l'extension est **`aal1`** (lien
     magique, § TOTP du 16 oct.) : activer la double vérification **coupait
     toutes les captures** — la limite que ce dossier dit « à trancher plus
     tard », tranchée dans le mauvais sens ;
  2. le SMS était proposé à tous, sans savoir si un fournisseur existe (l'erreur
     n'arrivait qu'au clic) ;
  3. avec deux apps d'authentification, son écran du code listait « Application
     d'authentification » deux fois et ne défiait que le premier facteur : le
     code du second était refusé (mesuré, son build au banc ci-dessous : 13
     rouges sur 19 à 390 px).
  `audit-mfa-gratuite.cjs` refuse tout enrôlement `phone`, `channel:'sms'` et les
  modules `mfaSms`/`VerificationSms` (rouge sur la branche : 6 lignes nommées).
- **Mesuré (base, lecture seule, `auth.mfa_factors` en comptes)** : **1** facteur
  TOTP **non vérifié** (21 oct. 16:38 — l'essai de l'invitation retirée), **0
  vérifié, 0 téléphone** : personne n'a la double vérification active, personne
  ne peut être enfermé aujourd'hui. `auth.mfa_recovery_code_sets` existe dans le
  schéma (codes de secours de GoTrue), mais son API n'a pas pu être mesurée
  (supabase.co bloqué par le proxy du conteneur) : **non livré**.
- **Livré (app seule — aucune route, aucune migration, extension NON touchée)** :
  - **L'écran du code accepte le code de N'IMPORTE LEQUEL des appareils**
    (`mfaVerifierCodeParmi` : chaque facteur vérifié, jusqu'au premier qui
    accepte). Trois états : un injoignable ⇒ « pas su », jamais « faux » ; un
    429 ⇒ « trop d'essais » (il affichait « Too many requests », en anglais) et
    on s'arrête ; tous disparus (appareil retiré ailleurs, il affichait « Factor
    not found ») ⇒ la liste est relue et UN envoi du bon code suffit. Il nomme
    les appareils, et « appareil perdu » dit d'entrer avec l'autre puis de
    retirer le perdu.
  - **Réglages → Mon compte → Double vérification** : chaque appareil a un
    **nom** (choisi à l'enrôlement — GoTrue n'a pas de renommage ; un ancien nom
    automatique « VRM 2026-… » s'affiche « Appareil ajouté le … »), la liste,
    « Ajouter un appareil de secours » (nom, QR, « prends l'AUTRE appareil »,
    ajouté seulement après SON premier code), « Retirer… » par appareil avec le
    code de n'importe lequel (les AUTRES d'abord : le cas « perdu »), le dernier
    retiré = désactiver. Un seul appareil : une phrase neutre propose un appareil
    de secours — **jamais imposé, aucune invitation au démarrage**.
  - Un nom déjà pris est refusé ici (sans casse) **sans rien créer** chez
    GoTrue ; 422 `name_conflict`, 403 (aal) et 429 sont dits en français.
  - La session porte `totpNoms` (affichage seul ; `totp` décide toujours, §11) ;
    la ligne de Réglages dit « Activée · 2 appareils ».
- **Récupération si l'UNIQUE appareil est perdu** — lui seul, il possède le
  projet : Supabase → SQL Editor → `delete from auth.mfa_factors where user_id =
  '<son identifiant>';` (les défis et jeux de codes partent en cascade — vérifié
  dans le schéma). **Jamais exécuté ici.** Pour un autre vendeur : l'adresse de
  contact (vide aujourd'hui, « à venir »).
- **Preuves (§6)** :
  | contrôle | code d'avant (origin/main d198bca, build copié) | après | mutations |
  |---|---|---|---|
  | banc `double-verification-appareils.cjs` (port 6251, faux GoTrue : un code par facteur, nom unique, aal2 pour enrôler et supprimer, 404, 429 ; 390 tactile + 1512) | **26 rouges sur 40** (la suite ne peut pas tourner : rien à cliquer) | **70/70** | `premier` (ne défier que le 1er) · `nompris` · `perime` (ne pas relire) · `trop` (429 non traité) · `ordre` (défier d'abord l'appareil retiré) : chacune rouge sur SON contrôle (1, à 1512 px) |
  | même banc sur le build de `codex/mfa-sms` (390 px) | 13 rouges sur 19 | — | — |
  | banc `double-verification.cjs` existant (PORT=6252, inchangé) | — | 62/62 | — |
  | `audit-mfa-gratuite.cjs` (la vraie règle dans un `vm`) | rouge (règle absente) ; branche codex : 2/2 rouges | 8/8 | `premier` 4 · `trop` 1 · `passu` 1 rouges |
  Et sur l'arbre final : `npm run build`, les **143 audits** `scripts/audit-*.cjs`
  verts (lancés un par un), banc `session-reveil.cjs` vert. Captures regardées à
  390 et 1512 px (écran du code à deux appareils, liste, QR de secours, retrait).
- **Non mesuré** : le vrai GoTrue (formes tirées de sa doc et de son code : nom
  unique, `aal2` pour enrôler un second facteur, sessions liées au facteur
  supprimé rétrogradées en `aal1` — si Julien retire l'appareil dont il vient
  de taper le code, VRM peut lui redemander un code au renouvellement suivant,
  ≤ 1 h) ; « Mots de passe » de l'iPhone avec deux QR du même compte ; que TOTP
  soit activé dans le projet (Authentication → MFA). La règle `aal2` côté base
  reste **à trancher** — avec une session d'extension en `aal2`, jamais avant.
- **Geste de Julien** : aucun obligatoire. S'il la veut : Réglages → Mon compte →
  Double vérification → Activer (iPhone), puis « Ajouter un appareil de
  secours » avec un AUTRE appareil (iPad, ancien téléphone).
- **Revue du 22 octobre (soir) — deux défauts du retrait, reproduits puis
  corrigés** (`DoubleVerification`, `retirer`) :
  1. **Un appareil déjà retiré ailleurs** (le formulaire ouvert sur un autre
     écran) : le `DELETE` répond **404** et le panneau disait « Le service de
     connexion a refusé (erreur 404). « Téléphone » reste enregistré. » — faux,
     GoTrue ne le connaît plus. ⇒ 404 = déjà retiré : même mise à jour de la
     session qu'un succès, message « n'était déjà plus enregistré (retiré
     entre-temps)… Je relis la liste » (ton gris, pas une erreur).
  2. **Formulaire fantôme** : après ce 404, ou un retrait FAIT dont la réponse
     s'est perdue (503), la liste relue n'a plus qu'un appareil et le formulaire
     resté ouvert devenait « Pour désactiver la double vérification… Ton mot de
     passe suffira ensuite » — faux (l'iPad reste actif), liste cachée. ⇒ un
     effet sur la liste relue referme le formulaire « retirer » quand l'appareil
     qu'il vise n'y est plus ; la liste et les gestes de l'appareil restant
     reviennent (proposition de nom refaite, comme après un retrait réussi).
  - Preuves : banc `double-verification-appareils.cjs` **section H** (faux
    GoTrue : retiré ailleurs ⇒ 404 ; « réponse perdue » ⇒ retiré puis 503 ;
    `SECTIONS=H` rejoue la section seule) — **16 rouges sur 34** sur le build
    de 078823f (worktree), **8 sur 17** sur sa copie `git archive` à 1512 px
    (§6.1) ; après, **104/104** aux deux tailles. Mutations : 404 non traité ⇒
    4 rouges (le message), effet retiré ⇒ 6 rouges (le formulaire fantôme).
    `double-verification.cjs` vert, 138 audits non SQL verts, build OK.
  - Non mesuré : le statut que le vrai GoTrue rend sur un facteur inconnu au
    `DELETE` (404 d'après son code, `mfa_factor_not_found`) ; dans le cas 503 la
    session garde l'appareil disparu dans `totp` jusqu'à sa prochaine relecture
    (sans effet : la porte relit les facteurs chez GoTrue).

---


### Revue adverse des routes serveur (17 octobre)
Toutes les routes `api/*.js` et `api/_lib/*.js` relues, chaque défaut REPRODUIT
en exécutant la vraie route (`scripts/audit-routes-revue.cjs`, un processus neuf
par scénario, fausse base à état) : **15 rouges sur le code d'avant, 0 après**.
- ⚠️⚠️ **Facture Pro : un compteur illisible émettait « FA-AAAA-0001 » et
  remettait le compteur à 1** (toutes les factures suivantes reprenaient des
  numéros déjà émis) ; et **le même email renvoyé** (un 503 est fait pour ça)
  donnait à la facture déjà émise un NOUVEAU numéro et la repassait « à
  envoyer » — le script Gmail l'envoyait une seconde fois à l'acheteur.
  `createProInvoice` relit d'abord `email_invoice_{clé}` (déjà émise ⇒ rendue
  telle quelle), lit compteur et réglage en trois états ; pas su ⇒ aucune
  facture et 503.
- ⚠️⚠️ **`duVendeur` (owner.js) lisait SANS filtre de vendeur quand la sonde de
  cloisonnement hoquetait** (`null` valait « une seule boutique »). Chemin
  réel : le rejeu d'un email mis de côté (`email-rattacher` → `traiterEmail`) —
  journal, fiches, mémo d'un AUTRE vendeur lus avec la clé de service, puis
  réécrits chez celui-ci. Seul un « non » mesuré lit sans filtre.
- ⚠️⚠️ **Le widget aussi** : sonde ratée ⇒ lectures sans filtre, et la clé de A
  servait les ventes de B (prouvé : `salesMonth=2` au lieu de 1). Trois états,
  `null` ⇒ 503 (le défaut corrigé le 4 octobre dans push.js et ship-reminders).
- **§2.9 : `/api/ai` dépensait la clé du serveur (celle de Julien) pour tout
  vendeur connecté**, et la faisait passer DEVANT la clé que le vendeur
  apportait. Clé du vendeur d'abord ; clé du serveur pour `VRM_OWNER_UID` seul ;
  sinon `no-key` (l'app retombe sur ses suggestions calculées).
- `/api/vinted-refresh` disait « refreshed » (200) quand l'écriture des jetons
  renouvelés échouait — l'ancien jeton étant consommé chez Vinted. Rend
  `refreshed_not_saved` et 502. (Route sans appelant aujourd'hui.)
- **Pas retenus, notés** : l'action eBay `exchange` échange un code SANS
  state/nonce (aucun appelant dans l'app, et un code ne fuit pas vers un tiers :
  à retirer un jour) ; `PHOTOROOM_POUR=tous` ouvrirait la clé Photoroom de
  Julien aux abonnés payants — c'est un réglage à poser exprès, éteint, mais il
  contredit §2.9 s'il est posé ; la notification de suppression de compte eBay
  (`mode=deletion`, POST) n'efface rien ; `harvestOrders` du widget lit
  `select=id,data` sur `orders_*` (repli quand le résumé manque) ;
  `vinted-connect` ne vérifie pas un `accessToken` encore valide auprès de
  Vinted (il ne touche que les lignes du vendeur lui-même).


### Vérification anti-robot (Cloudflare Turnstile), routes publiques, téléphone (20 octobre)
Julien : « des anti-bot, des captcha et une vérification par téléphone si possible », avant d'ouvrir VRM à d'autres.
- **Le captcha est PRÊT mais ÉTEINT** : `src/captcha.js`, `TURNSTILE_SITE_KEY` = `''` (ou la variable Vercel `VITE_TURNSTILE_SITE_KEY`). **Clé vide ⇒ aucun widget, aucune requête vers Cloudflare, corps envoyés à GoTrue identiques** (rien ne change au déploiement).
- **Lu dans le code de GoTrue** (`internal/api/api.go`, `middleware.go`) : `verifyCaptcha` protège `/signup`, `/token?grant_type=password`, `/otp`, `/magiclink`, `/recover`, `/resend` ; exemptés : `refresh_token`, `pkce`, `id_token`, et tout appel avec la clé de service. Le jeton part dans le corps JSON : `gotrue_meta_security.captcha_token`.
- **Clé posée** : le widget se charge sur l'écran de connexion seulement (`challenges.cloudflare.com/turnstile/v0/api.js?render=explicit`), `authCall` joint le jeton aux 5 appels de l'app (connexion, inscription, mot de passe oublié, lien de connexion, renvoi de l'email), un jeton ne sert qu'une fois (`consommerCaptcha` relance le widget), un jeton expiré se renouvelle (`refresh-expired: auto`). Sans jeton, le bouton est grisé et DIT pourquoi (« Vérification anti-robot… », « Coche la vérification ci-dessus ») ; widget injoignable (bloqueur, réseau) ⇒ message clair + « Réessayer » (44 px). Un refus captcha de GoTrue est traduit (`MSG_CAPTCHA_REFUS`).
- ⚠️⚠️ **L'ORDRE DES GESTES, sinon plus personne ne se connecte** : (1) Cloudflare → Turnstile → créer un widget pour `vrm.center` (mode « Managed ») ; (2) poser la clé de SITE (`VITE_TURNSTILE_SITE_KEY` sur Vercel, Production, ou dans `src/captcha.js`) et **redéployer** ; vérifier que le widget apparaît sur vrm.center/?connexion ; (3) SEULEMENT ENSUITE, Supabase → Authentication → Attack Protection → Enable CAPTCHA → Turnstile + la clé SECRÈTE (jamais dans le dépôt, public). Retour arrière : éteindre dans Supabase d'abord, puis vider la clé.
- ⚠️ **Ce que l'activation côté Supabase casse dans l'extension** (non modifiée ici) : la connexion PAR MOT DE PASSE de la fenêtre de l'extension (`authLogin`, `background.js` : `POST /auth/v1/token?grant_type=password` sans jeton) sera refusée (400 « captcha protection: request disallowed »). Restent intacts : le renouvellement (`refresh_token`), la session fabriquée par le serveur (`api/compte.js` session-extension : `admin/generate_link` avec la clé de service + `verify`, tous deux exemptés) — donc « Se connecter avec VRM » (5.169+) et la reconnexion par l'app (voie `page` des 5.164/5.170). **À faire dans l'extension avant d'allumer** : retirer le repli « avec mon mot de passe VRM » (ou le remplacer par l'ouverture de `vrm.center/?lier-extension=<id>`) — une page d'extension MV3 ne peut pas charger le script distant de Turnstile ; et traduire l'erreur captcha.
- **Routes publiques** : `api/relais.js` était un relais PUBLIC vers Nominatim/Overpass, sans session, que l'app n'appelle plus nulle part (mesuré) — un abus coûtait des appels Vercel et le bannissement de l'adresse de VRM par Nominatim (qui servirait aussi la ville de la communauté). Elle exige la session (`vendeurExige`) et ne se met plus en cache public. Les autres routes : session (`ai`, `vinted-*`, `compte` hors `sante`/`webhook` signé/`discord` signé), clé (`widget`), secret (`email-inbound`, `ship-reminders`), lecture « prêt ? » d'eBay. Le reste du frein vient de Supabase (limites d'auth) + le captcha. Rien de payant ajouté.
- **Téléphone : PAS fait, exprès (§2.9)**. Supabase Phone Auth exige un fournisseur SMS payant (Twilio, MessageBird, Vonage, Textlocal) : Twilio France **0,0798 $ par SMS** (oct. 2026, + frais opérateur) sur la clé de Julien, pour chaque inscription et chaque connexion des autres ; et le « téléphone comme second facteur » (MFA Phone) coûte en plus **75 $/mois** (add-on Supabase, hors plafond de dépense). Risque mesuré dans la doc : la « fraude au SMS » (des robots déclenchent des SMS vers des numéros surtaxés). Ce qui protège déjà, gratuitement : confirmation d'email obligatoire (Supabase), double vérification TOTP (16 oct.), captcha (ci-dessus).
- Preuves : banc `captcha.cjs` (faux GoTrue qui refuse sans jeton ou jeton rejoué, faux Turnstile servi à la place de Cloudflare, il fabrique lui-même le build « clé posée » ; 390 tactile + 1512) — **54 contrôles** ; **34 rouges sur origin/main** (build d'avant : aucun widget, aucun jeton ; les 20 verts sont la section « clé vide » et les contrôles d'absence) ; mutation « jeton non joint » ⇒ **18 rouges**. `audit-anti-bot.cjs` (captcha.js exécuté, `api/relais.js` exécutée) : 17 contrôles, 7 rouges sur l'avant.
- **Non mesuré** : le vrai Turnstile et le vrai GoTrue de production (formes tirées du code de GoTrue et de la doc) ; le texte exact du refus de GoTrue (traduit dès qu'il contient « captcha ») ; la politique de confidentialité devra citer Cloudflare (Turnstile) le jour où la clé est posée.


### La politique de sécurité du contenu (CSP) sur toute l'app (21 octobre)
Suite de l'audit du 4-5 octobre (« Pas fait : une vraie politique `script-src` »).
- **`vercel.json`, deux en-têtes** : EN VIGUEUR, les directives structurelles
  (`frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'`,
  + `X-Frame-Options: DENY`) ; en **Report-Only**, la politique complète :
  `default-src 'self'; script-src 'self' 'wasm-unsafe-eval' https://cdn.jsdelivr.net https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://lgonxzrzjcqthjtbdpzo.supabase.co wss://lgonxzrzjcqthjtbdpzo.supabase.co https://cdn.jsdelivr.net https://*.vinted.net https://api-adresse.data.gouv.fr https://nominatim.openstreetmap.org data: blob:; media-src 'self' blob: data:; worker-src 'self' blob:; frame-src https://challenges.cloudflare.com chrome-extension: moz-extension:; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`.
  **Pourquoi Report-Only** : le vrai Turnstile, le vrai jsdelivr et Safari iOS ne
  sont pas joignables d'ici ; une violation non vue en vigueur casserait un écran
  sans rien dire. Les violations sont **notées** dans le journal des plantages
  (`ecouterViolationsCsp`, `plantage_*` origine `csp`, sources d'extensions
  écartées) : après quelques jours sans violation chez lui, **renommer l'en-tête
  en `Content-Security-Policy`** — le banc en mode `BANC_CSP_EN_VIGUEUR=1` prouve
  déjà que ça tient.
- **Aucun `'unsafe-inline'` pour les scripts** : les deux scripts en ligne
  d'`index.html` sont devenus `public/demarrage-theme.js` (dans `<head>`, avant
  le premier rendu) et `public/demarrage-densite.js`. `style-src 'unsafe-inline'`
  est accepté exprès (styles en ligne partout, React).
- **Le reçu d'achat** (`openReceipt`, fenêtre `about:blank` qui HÉRITE de la
  politique) n'a plus d'`onclick` : ses boutons portent un id et l'app y attache
  les gestes après `document.close()`. La facture imprimable garde sa propre
  `default-src 'none'`. pdf.js : `isEvalSupported: false` (sa sonde `eval`
  était une violation). ORT (studio photo) : `'wasm-unsafe-eval'` + jsdelivr.
  Le pont de l'extension ouvre `popup.html?mode=reparer` en iframe ⇒
  `frame-src chrome-extension: moz-extension:`. Leaflet et les tuiles : `img-src https:`
  (⚠️ 22 oct. : plus vrai pour le fond OpenFreeMap — MapLibre va chercher ses
  tuiles par `fetch`, donc `connect-src` ; voir « La CSP finie » juste après).
- ⚠️ **Toute nouvelle origine appelée par le navigateur** (un CDN, une API) doit
  entrer dans `connect-src`/`script-src`, sinon elle sera refusée le jour du
  basculement — `csp.cjs` et `audit-csp.cjs` le voient.
- Preuves : `scripts/bancs/_vercel.cjs` (sert `dist/` avec les `headers` et
  `rewrites` LUS dans `vercel.json`) ; banc `csp.cjs` (24 écrans × 390/1512, pages
  publiques, reçu, facture, bordereau blob:, contrôle positif) : **0 violation**
  dans les deux modes, **9 rouges sur le build d'avant** (b25ed61) ; mutations
  `BANC_CSP_MUTATION=supabase` ⇒ 8 rouges, jsdelivr retiré ⇒ studio photo
  12 violations. `audit-csp.cjs` (statique) : 19 rouges sur l'avant. Bilan CSP
  branché dans `studio-photo`, `communaute`, `imprimante`, `captcha`.
- **Non mesuré** : la vraie production (en-têtes réels après déploiement), Safari
  iOS, le vrai Turnstile, Discord/Stripe (redirections pleine page, hors
  `connect-src`). L'extension n'a pas été touchée.


### La CSP finie (22 octobre) — la carte OpenFreeMap, le service worker, et des workers que le banc ne voyait pas
Branche `claude/csp-app` reprise : **vrais merges** d'origin/main (3de5c8f — un
seul conflit, ce fichier, les deux sections gardées — puis 911898e, sans conflit).
- **Mesuré d'abord, sur l'arbre fusionné** : `communaute.cjs` → **38 violations**
  `connect-src ← https://tiles.openfreemap.org/…` (style, sprite). La carte
  OpenFreeMap arrivée sur main (21 oct.) n'était pas dans la politique : passée
  en vigueur telle quelle, la carte de la Communauté serait tombée en liste chez
  tout le monde, sans un mot.
- ⚠️⚠️ **LE BANC NE VOYAIT PAS LES WORKERS.** Mesuré dans Chromium : une violation
  DANS un worker (MapLibre charge ses tuiles depuis le sien) ou dans le service
  worker n'arrive **ni** à l'évènement `securitypolicyviolation` de la page **ni**
  à sa console. Seul `report-uri` la voit. `_vercel.cjs` pose donc
  `report-uri /__vrm-csp-rapport` sur la CSP qu'il SERT (jamais dans vercel.json :
  la production n'a pas de collecteur) et compte les rapports. Sur le code
  d'avant, 4 tuiles refusées (`document /assets/maplibre-gl-worker-*.js`)
  n'étaient visibles QUE par là. Contrôle positif : un worker qui contacte une
  adresse interdite DOIT être signalé — `BANC_CSP_SANS_RAPPORTS=1` ⇒ rouge.
  ⚠️ Conséquence en production : le journal des plantages (`origine: 'csp'`) voit
  les violations de la PAGE et (depuis la revue du soir) des fenêtres que l'app
  ouvre (reçu, facture). Celles du worker de la carte, du service worker et de
  l'onglet du bordereau PDF ne remontent nulle part — elles ne sont tenues que
  par ce banc et `audit-csp.cjs`.
- ⚠️⚠️ **MA JOURNÉE HORS LIGNE : LA PAGE ALLAIT CHERCHER LES QR CHEZ LES
  TRANSPORTEURS** (`rechaufferQr` → `fetch(u)`). Mesuré dans sa base (lecture
  seule, hôtes seulement) : `qrUrl` sur **6 hôtes** — p.vintedgo.com ×15,
  avn-webexternal.azureedge.net ×11, tracking.network1.pickup.fr ×9,
  avisageng-colis-webexternal.pickup-services.com ×5,
  pickup-services.email-messaging.com ×4, static.chronopost.fr ×1. Une liste
  blanche en `connect-src` éteindrait la réserve au premier changement d'hôte.
  ⚠️ (corrigé par la revue du soir) Ces six hôtes sont ceux des `qrUrl`, pas des
  QR : `URL_PAS_UN_QR` écarte les mouchards et bannières, il reste **deux hôtes
  de vrais QR** (p.vintedgo.com ×15, avisageng-…pickup-services.com ×5), et les
  15 Vinted Go sont en **http** — ils n'entraient jamais dans la réserve (voir
  la revue ci-dessous).
  ⇒ La page demande `/hl-qr?u=…` (même origine), **seulement quand le service
  worker la commande** ; c'est lui qui va chercher et qui **range** (`public/sw.js`).
  ⇒ `/sw.js` n'est **plus sous la politique complète** :
  `"source": "/((?!sw\\.js).*)"` (vérifié avec path-to-regexp 6.1.0, celle de
  `@vercel/routing-utils` : `/`, `/index.html`, `/assets/…`, `/recuperation.html`
  oui, `/sw.js` non). Il garde les directives structurelles. Sans service worker
  aux commandes, rien n'est rangé (la réserve ne sert que par lui) : réessayé à
  l'ouverture suivante.
- **`vercel.json`** : `connect-src` et `img-src` + `https://tiles.openfreemap.org`
  (style, TileJSON, tuiles vectorielles et raster, sprite, polices — un seul
  domaine dans les vrais `liberty`/`dark`, relus dans hyperknot/openfreemap-styles) ;
  `worker-src 'self' blob:` (déjà là : le worker de MapLibre est un fichier servi
  par VRM, celui de pdf.js un blob). La politique complète vit dans SA règle ; la
  bascule = renommer SA clé en `Content-Security-Policy`.
- `_vercel.cjs` : un motif à parenthèses imbriquées était mal lu (coupé à la
  première `)`) — les bancs auraient servi d'autres en-têtes que Vercel.
- **Bancs** : `csp.cjs` passe par `_porte-banc` (l'« accès direct » est retiré),
  rend la carte dans un contexte NEUF (les violations sont dédoublonnées par
  contexte : la tournée des écrans rendait ce contrôle vert par accident sur le
  code d'avant) et exige qu'elle ait DEMANDÉ style, TileJSON, tuiles, raster et
  sprite ; `/recuperation.html` ; la réserve d'un QR par le service worker (le
  VRAI `rechaufferQr`). `abonnement.cjs` (Stripe : clic « S'abonner » →
  checkout.stripe.com) et `hors-ligne.cjs` observent maintenant la CSP.
- **Preuves** — §6.1, arbre `git archive` de la fusion (7a7038f), banc copié dedans :
  `csp.cjs` **7 rouges** avant (101 verts), **0** après (109) ; en vigueur
  (`BANC_CSP_EN_VIGUEUR=1`) **0** (111 verts, carte dessinée, QR rangé) ;
  mutations `openfreemap` 3 rouges · `swpolitique` 2 rouges (le rapport vient de
  `/sw.js`) · `BANC_CSP_SANS_RAPPORTS=1` 2 rouges. `audit-csp.cjs` **5 rouges**
  avant, 0 après. `hors-ligne.cjs` avant : **4 violations** (le QR demandé par la
  page) ; après 0, la réserve se remplit et le QR s'affiche sans réseau.
  `communaute` 144 + 0 violation (dont « Se connecter avec Discord »), `captcha`
  (Turnstile) 62, `imprimante` 32, `studio-photo`, `abonnement` 83 + 0 violation,
  `sw-cache` : verts. Et avec la politique complète servie **EN
  VIGUEUR** (copie de vercel.json par `BANC_VERCEL_JSON`) : `communaute`,
  `captcha`, `abonnement`, `hors-ligne`, `imprimante`, `studio-photo` — tous
  verts, **0 violation**.
- **Les 143 audits** (`scripts/audit-*.cjs`) : tous verts sur cette branche,
  après chacun des deux merges — aucun rouge, donc rien à comparer avec main
  (`audit-agent-sql` est tombé une fois sur « No space left on device » : le
  disque de la machine partagée était plein à 98 % ; vert à la relance). Après
  le second merge : build, `audit-csp` et `csp.cjs` (109 verts, 0 rouge) relancés ;
  les autres bancs cités ici l'ont été sur le premier (main y a changé le
  diagnostic Leboncoin et l'extension, rien de ce qu'ils rendent). `verif_visuel.cjs` (fixtures
  réelles, hors dépôt) : 21 contrôles non conformes, **exactement la même liste
  sur un arbre `git archive origin/main`** (CA par plateforme, vente Leboncoin
  prouvée, résumé Vinted, carte héros) : rien ne vient de ce chantier.
- **Passer en vigueur** : les directives structurelles le sont déjà
  (`frame-ancestors 'none'` : aucun écran ne s'encadre lui-même, vérifié). ⚠️
  Critère RÉÉCRIT par la revue du soir (voir ci-dessous) — l'ancien demandait
  d'ouvrir des surfaces que le journal ne pouvait pas voir, et le faux positif
  des QR Vinted Go le rendait inatteignable. Il y a deux moitiés :
  1. **Ce que le journal voit** (la page, le reçu d'achat, une facture) : 7 jours
     sans aucune ligne `plantage_*` d'origine `csp` depuis le déploiement de ce
     correctif, à condition qu'il ait ouvert pendant ces 7 jours, sur son iPhone
     ET sur l'ordinateur : Ma journée avec un colis à retirer, Achats, Mon
     compte, un reçu d'achat, le studio photo. Vérification (lecture seule) :
     `select data->>'message', data->>'ecran', data->>'navigateur', count(*), max(data->>'at') from app_data where id like 'plantage_%' and data->>'origine' = 'csp' group by 1, 2, 3;`
     (`ecran` dit où : `cat_achats`, `journee`, `fenetre:recu`, `fenetre:facture`…).
  2. **Ce que le journal ne voit PAS, et ne peut pas voir d'une page** : le
     worker de la carte de la Communauté (MapLibre), le worker de pdf.js
     (aperçus d'imprimante), le service worker, l'onglet du bordereau PDF. Ils
     ne sont tenus QUE par le banc `csp.cjs` (dans Chromium, par `report-uri`) ;
     sur Safari iOS ils ne sont pas mesurés. Le jour de la bascule, les regarder
     À L'ŒIL sur l'iPhone ET l'ordinateur : la carte de la Communauté montre la
     carte (pas la liste), un bordereau s'ouvre, Réglages → Imprimante → « Voir
     les aperçus » dessine les aperçus. Sinon : remettre la clé
     `Content-Security-Policy-Report-Only`.
  Le geste : dans la règle `/((?!sw\\.js).*)` de vercel.json, renommer la clé
  `Content-Security-Policy-Report-Only` en `Content-Security-Policy`.
- **Non mesuré** : les en-têtes réels de Vercel avec cette règle (aucun
  déploiement d'ici) ; Safari iOS ; le vrai Turnstile ; la vraie instance
  OpenFreeMap (bloquée d'ici ; que sa TileJSON `/planet` désigne des tuiles sur
  le MÊME domaine est DOCUMENTÉ — README d'hyperknot/openfreemap, « `/planet/latest/{z}/{x}/{y}.pbf` » —
  pas mesuré : un autre hôte ferait passer la carte en liste une fois en vigueur,
  et en Report-Only la violation viendrait du worker, que le journal ne voit pas) ; les
  vraies redirections Stripe et Discord (navigations pleine page, hors CSP).
  L'extension n'est pas touchée.

### Ma journée en widgets, finie et vérifiée (22 octobre)
Demande de Julien (21 oct.) : Ma journée « comme l'écran d'un iPhone, avec des
widgets ». Reprise de `claude/journee-widgets` (f4cfaff, « EN COURS, non
vérifié »), vrai merge d'origin/main (3de5c8f, puis d198bca), finie sur
`v22-widgets` — **non déployée**.
- **Ce que c'est** : la disposition SEULE (`src/journeeWidgets.js`) — quels blocs,
  dans quel ordre, à quelle largeur — rangée dans `vrm_journee_widgets`
  (synchronisé, `{v:1, w:[{id,t}]}`, rattrapé par `onCloudReady` seulement s'il
  est resté vide). Chaque widget rend un bloc que Ma journée calculait déjà :
  **aucun chiffre n'est recalculé** (§11), **aucune lecture de plus**.
  « Modifier » (ordinateur : en haut de la grille ; téléphone : « Modifier
  l'écran » en bas) ou appui long au doigt ⇒ les widgets tremblent (rien si
  « réduire les animations »), on glisse, « − » retire, « + Ajouter » (feuille),
  « OK ». Clavier : flèches, Suppr, Échap. Catalogue : les 7 blocs d'avant +
  14 derniers jours, URSSAF, et 4 petites cases (à envoyer, à retirer,
  messages, prix à baisser). PAS de widget « bénéfice » (revue ci-dessous).
- **La mise en page par défaut est CELLE D'AVANT**, même ordre, même place :
  barre, à faire, vendu | semaine | attente, puis photos 2/3 | stock 1/3 sur
  ordinateur (grille de 6 colonnes) ; l'un sous l'autre sur téléphone.
  ⚠️ **Une exception, assumée** : les alertes qui coûtent étaient les premières
  lignes de « À faire », SOUS la barre ; elles sont maintenant au-dessus de la
  grille, donc de la barre (revue ci-dessous). Le banc
  `revendeurs` (vert sur origin/main) l'exige — « stock à droite des dernières
  ventes », tout visible sans défiler — et il était ROUGE sur mon premier jet
  (grille de 4 colonnes) : *une nouveauté ne doit pas changer ce qu'on voit tant
  qu'on n'a rien touché.*
- **Mesuré au rendu sur f4cfaff, corrigé** :
  1. ⚠️⚠️ **à la souris, glisser un widget de côté CHANGEAIT D'ONGLET** : le
     balayage horizontal de la coque prenait le geste ; on lâchait le widget sur
     l'écran Vinted. La grille porte `data-noswipe` en mode « Modifier » ;
  2. **sur téléphone, « Modifier » était INVISIBLE** : il vivait dans la tête de
     l'écran, que `styles-mobile-studio` cache sous 768 px. Seul l'appui long
     (que personne ne devine) y menait. Un seul des deux boutons se voit à une
     largeur donnée ;
  3. **« Grand » ne montrait rien de plus** : la même carte, deux rangées plus
     haute et vide. Une taille est une **largeur** (ordinateur : 1/6, un tiers,
     deux tiers, pleine largeur) ; sur téléphone (2 colonnes) tout ce qui n'est
     pas petit fait toute la largeur : le bouton de taille n'y est pas proposé ;
  4. **« 1 colis en retard » était dit deux fois** (une alerte de tête ajoutée +
     la case de la barre) : il ne remonte en tête que si AUCUNE case ne le
     montre (`caseVisible`). Même règle ajoutée pour le colis **hors délai à
     retirer** (il repart chez l'expéditeur), que le premier jet oubliait :
     retirer la barre l'aurait rendu muet ;
     ⚠️ (23 oct., après la fusion avec « colis à l'heure ») la règle de date
     limite dit déjà en tête tout colis Vinted dépassé (`colis-limite`) :
     `colis-en-retard` ne garde que les colis **eBay** en retard, sinon un vrai
     retard était dit deux fois (banc `journee-widgets` H, rouge avant) ;
  5. **« À faire » était retirable** — et avec lui les emails mis de côté, les
     colis cochés non partis, le litige, « Tout est OK » à confirmer… Il est
     **fixe** (déplaçable, jamais retiré ; remis s'il manque d'une disposition
     abîmée) ;
  6. **le premier jour, la grille entière était cachée**, « À faire » compris :
     la ligne « N emails mis de côté » disparaissait (banc `emails-mis-de-cote`,
     2 ❌ sur un jet intermédiaire, vert sur origin/main). La grille est rendue,
     ses widgets se taisent d'eux-mêmes, et « Modifier » n'y est pas ;
  7. **base injoignable** : la carte « Lecture du stock indisponible » était une
     troisième voix après le bloc de la coque et la ligne de panne (§7) — retirée,
     et « Modifier » n'est pas proposé pendant la panne.
- **Décidé (sans lui demander)** : les alertes qui coûtent (`urgent` : deux
  paires sous un N°, double vente, ne pas poster eBay, coché non parti, « Tout
  est OK » à moins de 24 h) restent HORS grille, en tête, jamais retirables.
  Une disposition illisible ou abîmée retombe sur ce qui est lisible, jamais sur
  un écran vide.
- **Prouvé** : banc `journee-widgets.cjs` (données inventées, base cloisonnée
  comme en production, 1512 et 390 px, clair ET sombre, souris et doigt)
  **129 ✅ · 0 ❌** ; **50 ❌ sur origin/main** (3de5c8f), **34 ❌ sur
  f4cfaff** ; il compare les chiffres, les actions (`data-job`) et les blocs
  rendus au build de la base de fusion (mêmes valeurs). Mutations, chacune
  ROUGE : grille sans `data-noswipe` (5 ❌), alerte de retard sans `caseVisible`
  (2 ❌), sans le bouton du bas (9 ❌), « À faire » retirable (2 ❌), « Deux
  tiers » remis en carte plus haute (3 ❌). Audits `tdz`, `boutons`, `icones`,
  `variables`, `chiffres`, `coherence`, `identite`, `bancs`, `extension-zip`
  verts.
  - **Sur le build final** (fusionné avec d198bca) : `journee-widgets`,
    `journee-premium`, `premierjour`, `vendu-recu`, `emails-mis-de-cote`,
    `revendeurs`, `hors-ligne`, `demarrage`, `stock-journee` verts, et les bancs
    Leboncoin arrivés avec main (`lbc-identite-privee`, `lbc-demarrage`,
    `lbc-rappel-mise-a-jour` — ⚠️ ils cherchent `/usr/bin/chromium` :
    `CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`).
  - Sur un build intermédiaire de la branche : `cartes-vivantes`,
    `chiffres-croises`, `glisser-onglet`, `compact`, `accueil`,
    `double-verification`, `numeros-remise-a-zero`, `session-reveil`,
    `photo-vente` verts.
  - **`vitesse`** : aucune lecture de plus (64 à 390 px comme main, 60 contre 62
    à 1512) ; rendus au démarrage indiscernables (médianes à 390 px, quatre
    mesures alternées : main 14·16·17·16, ici 15·14·15·16) — ses deux rouges
    (« ≤ 62 lectures », « ≤ 13 rendus ») le sont déjà sur main.
  - Rouges À L'IDENTIQUE sur origin/main (même nombre, déjà rouges avant ce
    chantier, à regarder à part) : `benefice-journee` 2, `ebay-messages-journee`
    8, `a-confirmer` 6, `poste-sans-depart` 12, `double-vente` 30,
    `rappel-urssaf` 6, `statuts-colis` 52, `seuils-vinted` 13,
    `recherche-numero` 13, `tout-generer` 36, `ebay-colis` 8, `audit-reel-20oct`
    24, `codes-hors-ligne` 6, `photos-vinted` 40. Pour `benefice-journee`
    (« éteint ⇒ plus de carte ») la cause est dans le BANC : il sert la sonde de
    schéma en 400 (base non cloisonnée), donc `cloudPush` ne part pas, et le
    rechargement relit « allumé » dans le nuage (§6.3 — le même piège que mon
    propre banc avant qu'il serve 200).
- **Non mesuré** : le vrai iPhone (appui long, défilement pendant le glisser —
  tout est au Chromium tactile du banc) ; le mode stream ne floute rien de
  Ma journée (aucun `vrm-sensible` dans l'écran, sur main non plus : les comptes
  nommés dans « À faire » restent lisibles — inchangé, à trancher à part).
- **Revue adverse du 22 octobre (soir) — six défauts reproduits sur 43c8e48,
  six corrigés** :
  1. ⚠️ **En mode « Modifier », → déplaçait le widget ET menait à l'onglet
     Vinted** (mode perdu) : la coque écoute ← → sur la fenêtre, et un widget
     (`role="group"`) n'est pas un bouton pour elle. Les flèches d'un widget
     sont prises (`preventDefault` + `stopPropagation`), même au bord (rien à
     déplacer) ; et la coque ignore une flèche déjà prise ou partie d'une zone
     `data-noswipe` (deux gardes indépendantes) ;
  2. ⚠️ **Le premier jour, l'appui long ouvrait « Modifier »** (absent ce jour-là) :
     six cases « Rien à montrer », et ce qu'on retirait partait au nuage. Même
     trou pour un vendeur eBay/Leboncoin sans compte Vinted (premier jour
     permanent). L'appui long lit `peutModifier`, et le mode se ferme tout seul
     s'il ne l'est plus (panne pendant la modification) ;
  3. **Deux propriétaires pour le bénéfice** : le widget « Ton bénéfice »
     l'affichait pendant que Réglages disait « éteint », et l'interrupteur n'avait
     plus d'effet (§11). Tranché : le widget est RETIRÉ du catalogue — le
     réglage `vrm_journee_benefice` reste le seul propriétaire, et le bénéfice
     reste DANS la carte « Vendu et reçu » (décision de Julien du 21 oct.,
     c136941, « regrouper CA et bénéfice »). Carte « Vendu » retirée, réglage
     allumé ⇒ il a sa propre carte sous la grille (jamais « allumé » et
     invisible). Mesuré (lecture seule) : un vendeur a `vrm_journee_benefice`
     à `true`, aucun n'a de disposition rangée ; un `benefice` resté dans une
     disposition (builds intermédiaires) est ignoré ;
  4. **« Même ordre qu'avant » était faux avec une alerte qui coûte** (au-dessus
     de la barre au lieu de dessous). Tranché : ASSUMÉ — aucune disposition ne
     doit pouvoir pousser « deux paires sous un N° » en bas de l'écran. Dit
     ci-dessus et vérifié au banc (A2), plus « même ordre » sur ces données-là ;
  5. **La feuille « Ajouter » proposait les petites cases à côté de la barre** :
     « 2 À envoyer » écrit deux fois (§7 — et le banc l'exigeait). Une petite
     case n'est plus proposée tant que la barre est là, ni la barre tant qu'une
     petite case est là (`widgetsAjoutables`), et la feuille dit pourquoi en
     une phrase ;
  6. **En mode « Modifier » à 1512 px, le bouton de largeur recouvrait la carte**
     (« Mes ventes › » réduit à « Me », la légende « Vendu », « tout voir › ») :
     il est SOUS la carte.
  - Prouvé : banc `journee-widgets.cjs` **163 ✅ · 0 ❌** (sections A2, B3, B4,
    K, E réécrite, E2 étendue) ; le même banc lancé depuis une copie de 43c8e48
    (`git archive`, §6.1) **15 ❌** (clavier 4, premier jour 2, bénéfice 4,
    petites cases 2 + la suite de BF qui meurt faute du bouton « Fermer »
    marqué) ; le recouvrement mesuré à part sur 43c8e48 : 6 boutons sur 6
    recouvrent leur carte (`afaire:105x30`, `vendu:71x30`…), 0 après. Mutations
    (`BANC_SECTIONS`), chacune ROUGE : flèches sans les deux gardes (B3, 4 ❌),
    appui long sans `peutModifier` (B4, 2 ❌), bénéfice sans sa carte hors
    « Vendu » (K, 2 ❌), feuille sans exclusion (E, 4 ❌), bouton de largeur
    remis en absolu (E2, 1 ❌). ⚠️ Une seule des deux gardes du clavier (ou de
    l'appui long) retirée reste VERTE : défense en profondeur, voulu.
    137 audits verts (les 5 qui montent un Postgres jetable, sans lien avec ce
    chantier, n'ont pas été lancés). Bancs voisins sur ce build, un par un :
    `journee-premium` 17, `premierjour` 86, `vendu-recu` 57, `demarrage` 12,
    `hors-ligne` 45, `glisser-onglet` 14, `revendeurs` 196, `stock-journee` 7,
    `emails-mis-de-cote` 52 verts ; `benefice-journee` : ses 2 mêmes rouges que
    sur main (« éteint ⇒ plus de carte », cause dans le banc), et « CA et
    bénéfice partagent la même carte » vert.

## 8. État au 12 septembre 2026, 19h40 — base revenue, remesuré en entier

**La base Supabase est restée injoignable du 9 au 12 septembre** (522 après 20 s,
et `544 DatabaseTimeout` côté stockage : le projet n'était **pas en pause**, il
était bloqué). Julien a cliqué **`Settings` → `General` → `Restart project`** le
12 à ~19h35 ; la base répond en **0,66 s**, et **six comptes ont été captés dans
les deux minutes qui ont suivi** — toute la chaîne remarche. **Rien n'a été
perdu** : les 9 comptes Vinted sont là, les 338 numéros aussi.

| | |
|---|---|
| annonces **ouvertes** | **59** · **0 doublon vivant** ✅ (400 fermées à côté — `nItems` compte les deux, piège du 7 sept.) |
| paires numérotées | **338** · plus haut numéro **481** · **0 prix d'achat**, **0 prix plancher** ⚠️ (il les saisit lui-même) |
| cochées pour une autre place | **0 explicitement** — donc la file Leboncoin prend tout (le défaut vaut « oui », exprès : une nouveauté n'éteint pas ce qui marchait). eBay, défaut `false` : file vide, comme prévu. |
| argent Vinted | **227,54 € disponibles** à virer · **2 002,80 € retenus** — sur **8 porte-monnaie lus** sur 10 lignes (2 hors sujet, ignorées : une ligne `purgedAt/supprime` et une réponse `balance/history`). Détail : `arthuror2` 93 € + 109,80 € · `julienf765` 106,10 € + 273 € · `julatace3535` 28,44 € + 409,80 € · `tomj683` 455 € retenus · `julatace35260` 315 € · `tomj606` 343,50 € · `angeled92` 96,70 €. |
| ventes | **431 captées**. À **expédier : 6** (5 « Le paiement a été validé » + 1 « Bordereau envoyé au vendeur » — qui n'est PAS un colis parti, §`needsBordereau`). 13 en cours d'acheminement, 4 déposés, 3 non réclamées, 350 finalisées, 46 remboursées. |
| bordereaux | **157 emails** dont **139 avec le PDF** · **63 captés** par l'extension |
| achats | **544 captés**. **1** « colis déposé en bureau de Poste ou point relais », 3 « non réclamée — retournée à l'expéditeur », 6 livrés. **0 code de retrait** : `panel_colis_relais` **n'existe toujours pas**. |
| comptes Vinted | **9**, dont `liliand653` **exclu** (son choix). Trois identifiants de moisson n'ont plus de compte en face (reliquats de juillet/août). |

⚠️ **LA FRAÎCHEUR N'EST PAS LA MÊME PARTOUT** (lue sur `data.capturedAt`, jamais
`updated_at` qui ment, §4.3) : `tomj606`, `llloollllaa`, `tomj683`,
`julienf765`, `julatace35260`, `angeled92` **captés à l'instant** ; mais
**`julatace3535` date de 3,1 jours** et **`arthuror2` de 4,1 jours** — ce sont
les deux qu'il n'a pas ouverts depuis la panne, et `julatace3535` est justement
celui qui porte ses colis à retirer. **Le geste : passer sur Vinted connecté sur
ces deux comptes-là.**

⚠️⚠️ **CE QUE SON EXTENSION FAIT VRAIMENT — REMESURÉ LE 13 SEPTEMBRE, ET LE
DOSSIER DISAIT LE CONTRAIRE.** §8 affirmait « toujours antérieure à 5.45 », déduit
de « 0 compteur `retrait_*` ». **C'est une déduction, pas une mesure** : un
compteur absent ne prouve la version que si la fonction s'exécute
inconditionnellement — or `capterRetraits` sort avant d'écrire quand aucun achat
n'est en attente de retrait. Ce qui EST mesuré :
- `panel_diag_capture.majAt` = **aujourd'hui 10:14** : elle tourne à la minute
  (`bordereau_genere` 3 → **6**, `label_envoye` 15 → **25**) ;
- `lbc_listings` a été **écrite ce matin à 06:38** avec les 81 annonces du flux
  « découverte » — donc son extension porte le parser `__next_f`, arrivé bien
  **après** la 5.45 ;
- mais `lbc_recon` n'a **ni `capture` ni `etapes`** (dernière écriture le
  28 juillet) et `panel_ebay_form` est absente : `lbcDiag` et l'enregistrement
  des étapes n'ont jamais tourné.
⇒ **Ne pas redéduire une version d'un compteur à zéro.** Le signal fiable est ce
que le pont annonce, ou une écriture datée. Le zip livré est en **5.63.0**
(`public/VRM-extension.zip`) ; `EXT_ATTENDUE` le suit.

⚠️ **CE QUE LA FILE eBAY DONNERAIT LE JOUR OÙ IL COCHE** (mesuré le 13 septembre,
la file est vide aujourd'hui — défaut `false`) : **53 annonces en ligne et
numérotées**, dont **14 prouvées vendues** (écartées depuis), **18 titres** avec
la marque écrite deux fois et **51** en « taille X » (corrigés depuis). Voir
« eBay n'avait appris aucune des leçons de Leboncoin ».

⚠️⚠️ **PIÈGE `billing` — ET C'EST ENCORE MON SCRIPT QUI AVAIT TORT.** Première
mesure après le retour : « **0 € sur 0 porte-monnaie, 10 lignes hors sujet** »,
et « **0 annonce ouverte sur 12 comptes** ». J'allais annoncer que la panne avait
tout effacé. En vérifiant la FORME (§6) : tout vit sous **`data.payload`** (pas
`data`), les items sont **`payload.items`** / **`payload.my_orders`**, et les
montants Vinted sont des **objets `{amount, currency_code}`**, pas des nombres.
Le dossier le disait déjà en deux endroits. ⇒ **Avant d'annoncer une perte,
vérifier le nom ET la forme du champ** — c'est la troisième fois que ce même
script-là me fait croire à une catastrophe.

**Ouvert :**
- **La mise à jour de l'extension** : le premier geste, et il débloque les codes
  de retrait, les relevés et le filtrage des places.
- **Les emails du 9 au 12 septembre sont perdus** si le Worker Cloudflare n'a pas
  été remis à jour (il doit rejouer quand la route répond 503). Les ventes,
  annonces, achats et messages se re-captent tout seuls par l'extension ; ce qui
  ne revient pas, ce sont les **PDF de bordereau** et les **emails de suivi**
  reçus pendant ces trois jours. **L'app n'a aucun moyen de le vérifier** — ne
  pas le promettre à l'écran.
- **La forme d'une ligne de VENTE dans le relevé** : toujours 0 ligne
  `harvest_*_releve_*` (extension trop ancienne). « credit » ≠ « recette » :
  **ne baptiser aucun total « CA encaissé »** avant d'avoir vu une vraie ligne.
- **Dépôt PUBLIC** et **RLS désactivé** : la clé « anon » du bundle donne un
  accès complet en lecture/écriture, y compris aux jetons Vinted. Les deux
  gestes n'appartiennent qu'à lui (`SECURITE.md`).

---


### Confirmer le bon compte Vinted, et le graphisme de l'extension (19 octobre, 5.191)
Julien : « à l'installation de l'extension, confirmer le bon compte Vinted » et « le graphisme de l'extension ».
- **La question** (`vrm-badge.js`, panneau `.question`) : sur Vinted, VRM connecté, quand le compte du COOKIE n'a jamais été confirmé dans ce Chrome ET qu'on sait le nommer (login de la base `loginDe`, sinon celui lu dans la réponse `users/current` déjà reçue, rangé dans `chrome.storage.local.vrmLoginsVus` — jamais deviné, jamais « compte n° … ») : « Tu es connecté sur {login} — c'est bien un de tes comptes à capter ? [Oui, capter ce compte] [Non, ignorer ce compte] » (× = plus tard, pour cette page). Pas de pastille ambre : une question n'est pas une panne.
- **Le choix** : `chrome.storage.local.vrmChoixComptes[uid] = {choix, login, at}` (ce Chrome seulement ; pas de ligne `app_data`). Écrit par le service worker (`choixCompte`) **seulement pour le compte du cookie de l'onglet qui demande** — un autre uid est refusé. « Non » ⇒ `compteNonCapte` (refusé OU supprimé définitivement) ferme les cinq portes de capture (passive, active, moisson, visite, chemins vus), ses jetons ne partent pas (`captureDomain`, rien d'effacé), et la relecture publique des autres comptes le saute. Pas répondu ou stockage illisible ⇒ on capte COMME AVANT. Revenir : au survol du logo, « ignoré dans ce navigateur (ton choix) » + **« Capter ce compte »**.
- **Graphisme** : `popup.html` (fenêtre de l'icône et `?mode=carte`) et la carte du badge en VRM Noir par variables, clair/sombre selon `prefers-color-scheme` (sombre #07090D / #10141B / #3D7BFF ; clair #F4F6FA / blanc / #2458E6), boutons d'une seule forme (rayon 8, 44 px), champs et lien « avec mon mot de passe VRM » à 44 px. CSS seulement côté popup.
- Preuves (§6.1, bancs copiés dans l'arbre de HEAD) : `badge.cjs` 67 contrôles dont la section 10 sur le VRAI `background.js` (`_fond-vm`) — « Non » ⇒ zéro écriture `harvest_111_*`, « Oui » et « pas répondu » ⇒ la capture part, autre uid refusé — **12 rouges sur l'avant** ; `popup.cjs` 57 contrôles, **9 rouges sur l'avant** (fond clair, accent clair, cibles < 44 px).
- Aucune entrée d'`EXT_CAPACITES` (l'app ne promet rien de neuf). Extension **5.191.0**, zip régénéré, `EXT_ATTENDUE` suivie.
- ⚠️ Non mesuré : le vrai Vinted (le login arrive avec la première réponse `users/current` : la question peut apparaître quelques secondes après l'ouverture) ; sur Firefox Android, pas de survol — le retour sur un « Non » passe par la carte au toucher.


### Audit de bout en bout sur ses données du 20 octobre — 7 écarts corrigés, le reste juste
Copie fraîche de sa base (lecture seule, `execute_sql` ; un résultat trop gros
est rangé par l'outil dans un fichier, lu sans passer par le contexte), rangée
dans `scripts/bancs/fx/rows.json` (gitignoré, PDF remplacés par 12 octets, jetons
retirés), servie à l'app par un mini-PostgREST (`scripts/bancs/_minipgrest.cjs` :
`meta->>`, `data->>`, `or=`, `cs.`, projection, `Range`). Chaque écran et chaque
section rendus à 390 tactile et 1512, clair et sombre : aucun écran mort, aucun
débordement, aucune erreur. Chaque chiffre comparé à une requête SQL écrite à
part (règles de ce dossier, pas le code).
- **Justes** (mesure = écran) : à envoyer 16 · à retirer 6 et leurs 6 codes ·
  bordereaux prêts 16 · annonces en ligne 52 (11+0+14+9+8+10+0, la lecture
  complète la plus récente de chaque compte) · « à vérifier sur carton » 34 ·
  vendu octobre 2 626,80 € / 47 ventes · aujourd'hui 45 € · reçu octobre
  1 145,67 € (19 versements) · CA déclaré août 2 311,40 · sept. 4 330,90 ·
  2026 10 349,77 € · en attente 2 145,80 € sur 6 porte-monnaie, disponible
  0,67 € · messages non lus < 7 j : 8 · 4 doublons de N° sur Colis · Leboncoin
  finalisé 133 € (2 sans date, « à dater »).
- **Corrigés** (banc `audit-reel-20oct.cjs`, données inventées, 24 rouges sur
  11bac30, chaque correctif réaffaibli ⇒ rouge) :
  1. Comptes liés : « lié le » lisait `updated_at` (renouvellement des jetons) —
     sept comptes de juillet-août « liés le 20/10/2026 » ⇒ `created_at`.
  2. Statistiques : « Finalisé sur Vinted » 8 480,97 € excluait **99 ventes
     masquées (2 157,80 €)** sans le dire, pendant que le CA déclaré (10 638,77 €)
     les compte ⇒ le chiffre ne bouge pas, la carte et la ligne « Vinted » de
     « par plateforme » le DISENT (`nMasque`/`caMasque`, `data-finalise-masquees`).
  3. Leboncoin : « 2 vendues sur Vinted — à retirer » pour UNE paire (N°18 marquée
     publiée ET vue sur Leboncoin) ⇒ une ligne par N°, celle qui a le lien.
  4. eBay : VRM-48 (publiée le 15) affichée « N°48 », reliée — aucune fiche ne
     porte plus 48 (sa paire est la N°53 depuis le 18) ⇒ « à vérifier · pas
     reliée » (`numEbayLu` : zéro porteur, fiches lues ⇒ `null`).
  5. eBay → Compte : une route muette affichait « eBay pas encore configuré —
     ajoute tes clés dans Vercel » ⇒ trois états (`data-ebay-statut`).
  6. Ma journée ne disait pas les **deux paires sous un même N°** (N°50, 58, 60,
     88 ; trois sur une paire à poster) ⇒ une ligne urgente, la liste de Colis.
  7. Fraîcheur : seul jujuf38 (6 j) était nommé, pas julatace35260 (3 j) ⇒ tous
     les comptes en retard, chacun avec son âge (`dataAgeComptes`).
- **Notés, pas corrigés** : Messages « Non lues 156 » compte de vieux drapeaux
  (comptes pas relus : jujuf38 48) quand Ma journée dit 8 (< 7 j, libellé dit) ;
  « total des ventes payées eBay indisponible » alors qu'eBay est lu à 0 commande ;
  Leboncoin → Messages : le compteur (id `8442c3e8…`, celui des annonces) et le
  compte SHOPCANCALE (`faf3fbba…`, comptes liés) font deux lignes — c'est
  l'extension 5.195 (#610) qui les rapproche ; l'écran Leboncoin compte « 1 à
  confirmer » (une annonce du compte orphelin `3170782324`) que l'écran Annonces
  ne montre pas (décision « compte orphelin » toujours à trancher par Julien) ;
  Compta « Vendu juin 41 € · Finalisé 1 512,70 € » (le vendu exclut les ventes
  masquées, le finalisé non — deux règles écrites, à trancher).
- **Reprise du 20 oct. (après fusion d'origin/main ac29d0e)** : banc refait sur le
  build d'ac29d0e — 24 rouges, 0 après ; mutation « `updated_at` + zéro porteur
  relié » ⇒ 8 rouges ; audits et bancs voisins (eBay, Leboncoin, annonces,
  comptes, Ma journée, chiffres croisés) verts.
- **Gestes de Julien** : (1) **l'annonce eBay VRM-82 « Nike air max 1 noir taille
  44 » (128137572355) est probablement la paire vendue sur Vinted le 18 (tomj606,
  N°81, à poster)** — la terminer sur eBay après avoir regardé les photos (VRM ne
  peut pas la relier par identité) ; (2) corriger les 4 doublons de N° avant
  d'imprimer (Colis) ; (3) repasser sur Vinted connecté sur **jujuf38** (6 j) et
  **julatace35260** (3 j) ; (4) les 34 numéros à vérifier sur carton.

### Ce qui casse en production côté serveur — mesuré le 20 octobre
Lecture seule : Vercel (erreurs 7 j, journaux 50 min, déploiements), Supabase (journaux
edge/PostgREST/Postgres/auth sur 24 h glissantes, conseillers, `pg_stat_statements`),
lignes `plantage_*`, `email_inconnu_*`, quarantaine, journal des emails.
- **La base va bien.** Plus AUCUNE réponse 5xx de PostgREST depuis la 017 (dernière :
  18 oct. 02:51 ; 101 le 17-18, 112 le 13-14) ; écritures de `main` toutes en 2xx
  (≤ 1 s). Postgres : 3 erreurs de syntaxe (l'outil SQL) et rien d'autre. Auth : un
  500 « unexpected EOF » isolé, aucun `refresh_token_already_used`, aucun 429. Aucun
  déploiement en échec sur 7 jours. Plantages : 2 lignes (15 et 16 oct.), rien depuis.
  Quarantaine : vide (593 lignes déjà rejouées). `email_inconnu_*` : des « Commande
  mise à jour », « transfert bancaire », « remboursée » — gardés EXPRÈS sans action.
- **Corrigé : le tableau des erreurs de production n'affichait que du bruit.** Le seul
  groupe (1 336 lignes, 6 routes, depuis le 31 juillet) était `[DEP0169] url.parse()`,
  émis par Node 24 de Vercel et `web-push` — aucune ligne de `api/` ne l'appelle.
  `api/_lib/sans-bruit.js`, importé EN PREMIER par les 12 routes, retire CE code et
  rien d'autre. `audit-sans-bruit.cjs` (charge chaque route pour de vrai,
  `--pending-deprecation`) : 44 contrôles, 29 rouges sur l'avant, 4 rouges sous la
  mutation « tout couper ». ⚠️ À vérifier après déploiement : si la plateforme émet
  l'avertissement AVANT de charger le module, il reviendra (une fois par instance).
- **Geste de Julien — l'ANCIEN script Gmail tourne encore, toutes les minutes** :
  ~1 390 lectures × 3 par jour, directement sur la base avec l'ancienne clé publique
  (`vrm_email_config`, `email_invoice_*`, `vrm_pro_facture`), toutes en **401** (les
  clés JWT d'avant sont refusées). Les emails passent quand même (il retombe sur sa
  date de secours) mais **aucune facture Pro ne peut partir**. Recoller
  `scripts/gmail-forwarder.gs` du dépôt (avec sa clé), puis poser
  `EMAIL_INBOUND_SECRET` sur Vercel — absente aujourd'hui, la route des emails
  accepte donc encore un envoi sans clé (§ « la route des emails exige sa clé »).
- Noté, normal : `rpc/vrm_equipe_lister` → 404 (~60/jour, une par ouverture) tant que
  la 016 n'est pas appliquée (corrigée et essayée le 22 octobre : voir la section de la 016) (la route dit « pas encore activé ») ; quelques 401 au
  réveil de l'iPhone (jeton expiré, le renouvellement et la reprise d'envoi existent).
- Noté pour Julien : `STRIPE_SECRET_KEY` absente de Vercel (paiement non branché) ; le
  commentaire de `STRIPE_PRICE_LOOKUP` dit encore « 9,99 € ».


### L'extension d'après ce qu'elle fait VRAIMENT chez lui (20 octobre, 5.197)
Audit en lecture seule de sa production (`panel_diag_capture` de la 5.194, journaux de la passerelle Supabase sur 24 h, `vinted_item_details`, fraîcheur `harvest_*`). ⚠️ Les compteurs `n` sont CUMULÉS depuis toujours (toutes versions) : un compteur non nul ne dit pas que le défaut vit encore — on lit l'échantillon daté (`rates.*.at`) et les journaux du jour.
- ⚠️⚠️ **`vinted_accounts` réécrite jusqu'à 90 fois PAR MINUTE** (687 `POST` en 73 min, journaux du 20 oct.) : chaque requête de la page Vinted qui porte un `x-csrf-token` envoie un message `csrf` → `captureDomain` → la ligne entière, jetons identiques. Désormais une écriture quand les jetons ou le csrf CHANGENT, ou toutes les 30 min au plus (`empreinteCompte` FNV, jamais un jeton en clair ; `vrmCompteEcrit` dans `chrome.storage.local` ; posée seulement après une écriture réussie ; effacée par `noterRefus`). `audit-compte-ecritures.cjs` : 20 csrf ⇒ 1 écriture (20 sur l'avant), 3 mutations rouges.
- ⚠️⚠️ **La page d'une annonce relue toutes les 6 h pour rien, et les 17 pauses Vinted venaient de là.** `fiche_codes_absents` 650 = `photos_page_ecrit` 650, échantillon `cles=` vide : `__NEXT_DATA__` ne porte plus l'annonce, les codes (catégorie, marque, couleur) ne sont JAMAIS trouvés (0 fiche sur 233 en base), donc `!codes` relançait chaque annonce. Et `photos_page_refuse_429` 17 = `vinted_frein_429` 17 : la pause qui suit refuse aussi bordereaux et réponses (`vinted_pause_refus` 8). ⇒ `aRelirePageAnnonce` : déjà lue par la page (`pageAt`) et restée incomplète ⇒ 3 jours (`PAGE_REESSAI_INCOMPLET_MS`) ; aucune photo ⇒ tout de suite. Le flux Next « app router » est lu (`texteDuFluxNext`, `objetsAutourDeLId` : seul l'objet dont l'id est celui de l'annonce, §5) et le format est NOTÉ (`fiche_format_*`, `pageFormat`, échantillon `fiche_codes` avec `next_data/next_f/id_vu`). ⚠️ **Non mesuré** : la vraie page (403 d'ici) — c'est `fiche_format_*` qui dira si le flux porte l'annonce.
- ⚠️⚠️ **Une photo qui n'est PAS de la paire partait sur Leboncoin/eBay** (§5) : le même fichier `02_024a3_…` dans 29 annonces (toujours en position nPhotos+1, balayage d'images de la page), `06_01e6b_…` dans 17 (capture du panneau, position 6). ⇒ balayage plafonné à `nPhotos` ; `retirerPhotosEtrangeres` (un fichier présent dans ≥ 3 annonces aux couvertures toutes différentes, couverture d'aucune) à chaque écriture de `vinted_item_details` — la ligne entière se répare à la prochaine capture. Deux annonces d'une même paire ne déclenchent rien.
- **`saveItemDetailMaintenant` (panneau) effaçait la fiche lue sur la page** (codes, `photoIds`) : gardée.
- **`ventes_lecture_ratee` 164 sur 615** : la cause est maintenant notée (`ventes_lecture_ratee_{statut|pause}`) ; une pause déjà ouverte garde la garde entière.
- **App** : « un site a changé le format de sa réponse messages » (État des connexions) venait des 250 `forme_inconnue_champ_conversation` des extensions < 5.193 (corps d'ERREUR `{code,message,message_code}`) ; l'échantillon du 17 oct. l'aurait affiché jusqu'au 24. `estCorpsErreurVinted` l'écarte (`audit-derive-erreur.cjs`, rouge sur l'avant).
- **Constatés, pas des défauts actifs** : tous les `ecriture_ratee_*_400` (corrigés en 5.193 : 0 réponse ≥ 400 de son Chrome en 24 h) ; `forme_inconnue_champ_conversation` / `conversation_lecture_ou_forme_ratee` (5.193) ; `photos_annonce_refuse_404` (ancien chemin `/api/v2/items`, retiré) ; `ignore_partiel_*` (garde §4.2, voulue ; inbox fusionnée depuis 5.162) ; `ignore_billing_hors_sujet`, `ignore_dressing_autre_membre`, `abandon_sans_compte_*` (déconnecté) ; `label_ko_statuts_200_200_200` (PDF pas encore prêt, réessayé — `label_abandon_apres_essais` 9 : l'email prend le relais) ; `bordereau_refuse_400` 6 (`validation_error` de Vinted, 13 oct.) ; `*_refuse_401` (jeton du compte) ; `relais_*_reseau` (ordinateur en veille). Comptes `3156028798` (3 j) et `3191111372` (6 j) pas ouverts dans Chrome : leurs annonces restent relues publiquement (`enligne`).
- ⚠️ **Hors extension, à Julien** : **4 173 lectures refusées (401) en 24 h** par l'ANCIEN script Gmail (Google Apps Script, `email_invoice_*`, `vrm_pro_facture` lus avec la clé publique) — recoller `scripts/gmail-forwarder.gs`.
- Preuves : `audit-photos-passif.cjs` 35 contrôles (9 rouges sur la 5.195, 4 mutations rouges) ; `audit-compte-ecritures.cjs` ; `audit-derive-erreur.cjs`. Bancs badge, popup, session, pont, leboncoin verts. Extension **5.197.0**, zip régénéré, `EXT_ATTENDUE` suivie, aucune entrée d'`EXT_CAPACITES`.

