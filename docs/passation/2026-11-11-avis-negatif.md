# 11 nov. — Prévenu quand un avis de 3★ ou moins arrive (`claude/avis-negatif`, extension 5.352.0)

Ce sont des avis **REÇUS**. Le « rappel des évaluations à laisser » reste refusé (§3, 11 oct.) :
aucun rappel d'évaluation n'est ajouté.

## Ce que Julien voit
- **Une notification** (famille neuve « Avis négatif reçu », allumée par défaut, heures calmes et
  regroupement de `sendPushToAll`) : « Avis 2★ reçu sur shop_x » · « Touche pour le lire sur Vinted
  et y répondre. ». Plusieurs d'un coup sur un compte : « 2 avis de 3★ ou moins reçus sur shop_x ».
  Une notification par compte, **une fois par avis**. Jamais le texte de l'avis (il passe par
  Apple/Google), jamais un acheteur.
- **Le toucher** : la vente dans VRM (`?tab=ventes&site=vinted&cible=vente&tx=…`) SEULEMENT si l'avis
  porte son n° de transaction ; sinon **le profil des avis sur Vinted**
  (`https://www.vinted.fr/member/{id de profil}?tab=feedback`, ouvert en direct par le service worker —
  seul lien externe permis, forme fermée `RE_LIEN_AVIS`). Dans la cloche, l'entrée existe mais ne mène
  nulle part (`urlSure` du journal n'accepte que `/?…`) : la carte de Ma journée porte le lien.
- **Une carte dans Ma journée** (« À faire », ambre, comptée parmi les gestes ; souvent « la prochaine
  chose » en tête) : « Avis 2★ reçu sur shop_x » + le texte de l'avis s'il est rangé, sinon « Lis l'avis
  sur Vinted. ». « Lire » ouvre une feuille : les étoiles, le compte, le texte, et les gestes —
  « Voir la vente et écrire » (seulement avec le n° de transaction : la vente porte la messagerie
  existante), « Répondre sur Vinted ↗ », « C'est vu ». Sans n° : « Vinted ne dit pas quelle vente il
  note : pour écrire à l'acheteur, ouvre la conversation sur Vinted. » 14 jours au plus.
- **Paramètres → Notifications** : la famille dans le groupe « Comptes et avis » (aperçu = le vrai
  texte), et « Avis négatif » : 1★ à 4★ ou moins (défaut 3★), rangé dans `push_prefs.avisSeuil`.

## La règle (une seule, `src/avisNegatif.js`, importée par le serveur et l'app)
- **Forme MESURÉE** le 10 nov. : `harvest_{uid}_feedbacks` → `payload.user_feedbacks` = `{ id, rating,
  feedback }` (ni date, ni transaction, ni acheteur). Pas de tableau ⇒ « pas su » ⇒ rien ; une page dont
  aucun avis n'a cette forme ⇒ « pas su ». Note entière 1…5 et identifiant, sinon l'avis est ignoré.
- **« Nouveau » se prouve par l'identifiant de l'avis.** 1re lecture d'un compte = **ligne de base**,
  rien ne sonne (sinon tous les vieux 1★ sonneraient à l'installation). Ensuite, la page va du plus
  récent au plus ancien : seuls les avis placés AVANT le premier connu sont neufs. Aucun connu dans la
  page (plus de 20 avis d'un coup, page méconnaissable) ⇒ « pas su » : rien ne sonne, ils sont retenus.
  Un identifiant vu ne sonne jamais deux fois ; un avis qui reparaît après un connu n'est pas neuf.
- **La vente** : seulement par `transaction_id` porté par l'avis. Jamais par titre, date, prix ou
  acheteur (§5). Aujourd'hui Vinted ne le donne pas (mesuré) : le chemin existe pour le jour où il le
  donnera ; d'ici là, toujours le profil des avis.

## Qui fait quoi (§11 — un écrivain par ligne)
- **Extension 5.352.0** (`capterAvis`, inchangée côté Vinted : 1re page, une fois par 24 h, budget de
  lecture « suivi ») : `avisPropre` garde `transaction_id` s'il est en chiffres (rien d'autre ajouté) ;
  après une écriture RÉUSSIE de la ligne, `signalerAvisLus(uid)` → `POST /api/push { action:'avis', uid }`
  avec la session. **Aucune requête Vinted de plus.** Sans session ou réseau KO : rien retenté, le cron
  est le filet. Capacité `avisnegatif` (EXT_CAPACITES, audit-coherence).
- **Serveur** `api/_lib/avis-negatif.js` (`notifierAvisBas`), appelé par `api/push.js` (action `avis`) et
  par le cron du matin et du soir (`api/ship-reminders.js`, `avisBas` dans le bilan) : relit en
  PROJECTION les comptes présents (`vinted_accounts` moins `vrm_blocked_accounts`), les avis, l'id de
  profil ; une lecture ratée ⇒ 503, rien écrit ni envoyé ; compte d'un autre vendeur ⇒ 403. Mémoire
  `vrm_avis_bas` (seul écrivain : le serveur ; comparer-et-échanger sur `rev`) : `comptes[uid] = { base,
  ids[≤200] }`, `alertes[≤40] = { uid, id, note, at, tx?, notifie? }` — ni texte, ni pseudo. L'alerte est
  RÉSERVÉE (`notifie`) avant l'envoi : deux appels en même temps n'envoient qu'une fois. Famille coupée ⇒
  l'alerte est gardée (la carte), rien n'est envoyé. Aucune nouvelle fonction `api/` (12).
- **App** : lit `vrm_avis_bas` (`select=a:data->alertes`), `vrm_avis_bas_vus`, et pour les seuls comptes
  concernés le texte et l'id de profil en projection (jamais `select=data` sur une moisson). « C'est vu »
  écrit `vrm_avis_bas_vus` (seul écrivain : l'app, lire-fusionner-réécrire, lecture ratée ⇒ rien écrit).
  `src/AvisNegatifJournee.jsx`, `src/styles-avis-bas.css`, icône `star` ajoutée à `ICON_PATHS`.

## Preuves
- `node scripts/audit-avis-negatif.cjs` : **70 verts** — règle exécutée (R1–R26), route exécutée contre
  une fausse base à projections et téléphones interceptés (S1–S20), vrai `background.js` dans sa VM
  (E1–E5), branchement de l'app (A1–A6), **13 mutations toutes rouges** (base qui sonne, « aucun connu »
  qui sonne, seuil ignoré, forme inconnue = aucun avis, n° pris tel quel, alerte en double, avis qui
  reparaît, vente devinée, « vu » sans effet, compte d'un autre accepté, envoi sans réserver, lecture
  ratée ignorée, signal sur écriture refusée). Sur l'arbre d'avant (point de départ de la branche) :
  rouge, dont E1/E3 sur le vrai comportement de l'extension 5.342.
- `scripts/bancs/avis-negatif.cjs` : **96 verts**, 390 tactile et 1512, clair et sombre (carte comptée,
  ambre, ≥ 44 px ; feuille ; lien Vinted ; « Voir la vente » seulement avec le n° ; « C'est vu » écrit et
  efface ; panne 522 ⇒ rien ; compte retiré ou déjà vu ⇒ rien). Captures regardées. **28 rouges** sur le
  build du point de départ ; **4 rouges** sous la mutation « Voir la vente sans n° de transaction » (le banc
  a d'abord laissé passer ce mutant : React omettait `data-avis-voir-vente={undefined}` — l'attribut est
  désormais toujours posé, vide sans n°).
- Audits mis à jour pour la 9e famille : `audit-notifications` (F5), `audit-compte-pas-relu` (A26),
  `audit-notifs-belles` (X2 : « avis » permis seulement comme ce mot exact — un avis REÇU — ; toute
  catégorie qui rappellerait d'évaluer reste interdite).
- Verts : variables, tdz, coherence, identite, icones, textes-courts, fonctions-api, secrets,
  extension-zip, compte-relie-push, avis-vinted. `npm run build` vert.
- Les autres audits rouges de la suite l'étaient déjà au point de départ de la branche (vérifié un par un
  sur l'arbre d'avant) : rien de ce lot.

## À vérifier / gestes
- **Julien** : installer l'extension **5.352.0** (remplacer le dossier, ⟳ dans chaque Chrome). Sans elle,
  le cron du matin et du soir fait le travail (avec du retard).
- Le lien `…/member/{id}?tab=feedback` : forme à confirmer sur un vrai profil (si Vinted ignore `tab`, il
  ouvre le profil, l'onglet « Évaluations » est à un toucher).
- La 1re lecture de chaque compte après la mise en service ne sonne pas (ligne de base) : c'est voulu.
