# Historique — colis-retraits

> Texte déplacé TEL QUEL depuis `CLAUDE.md` le 31 octobre 2026 (allègement du dossier : 1,36 Mo → moins de 60 Ko).
> Rien n'a été réécrit : les paragraphes gardent leur ordre d'origine. Le classement par thème est automatique (mots du titre) — en cas de doute, chercher par `grep` dans tous les `docs/passation/historique-*.md`.

> ⚠️⚠️ **PASSATION DU 21 OCTOBRE — LIS D'ABORD `docs/passation/2026-10-21.md`** : ce qui est
> en ligne, `claude/lot-21oct` (hors ligne, retours, 5.204, carte OpenFreeMap), les branches
> non déployées (`csp-app`, `app-rapide`, et INACHEVÉE `carte-pro`), les gestes de Julien.
> `journee-widgets` est FINIE le 22 octobre sur `v22-widgets` (non déployée) : § « Ma journée en widgets ».

### Le retrait d'un colis acheté
**Mesuré le 6 septembre, avant de coder** (`scripts/audit-retrait.cjs` porte le
détail) : sur **139 emails de suivi**, 20 portent un code de retrait, 28 un lien
de QR, 128 un n° de suivi — et **0 le titre de l'article**. Un transporteur ne
sait pas ce qu'il y a dans le carton. Sur les **638 emails « non reconnus »,
0 parle de colis** : il n'y a rien à récupérer de plus côté email.
Une commande d'achat Vinted porte `transaction_id`, `conversation_id`, date,
titre, prix, statut — **aucun n° de suivi** (le détail de transaction non plus :
191 objets `shipment`, seulement id/status/status_title/status_updated_at).
⇒ **Il n'existe aucune identité commune entre l'email du transporteur et la
commande Vinted.** Les relier par la date, le relais ou le titre serait le
rapprochement par ressemblance interdit — et se tromper ici, c'est ne pas aller
chercher un colis, donc le perdre. Ne pas réessayer sans une identité nouvelle.
- Ce qui marche : **le code et le QR vivent dans la conversation Vinted**. Chaque
  colis à retirer ouvre la sienne (`conversation_id`). L'extension y lit le code
  et le dépose dans `panel_colis_relais`.
- ⚠️⚠️ **MESURÉ LE 8 SEPTEMBRE : SON EXTENSION NE SAIT PAS ENCORE LE FAIRE.**
  Sur les **42 compteurs** que l'extension tient (`panel_diag_capture.n`),
  **aucun `retrait_*` ni `releve_*`** — alors que `bordereau_genere`,
  `label_envoye` et tous les `ecrit_*` tournaient à la minute sur **sept
  comptes** (captures de 9 à 11 minutes). Or `capterRetraits` écrit son compteur
  dès qu'il s'exécute, **même en échec** (`retrait_conv_refuse_*`,
  `retrait_conv_sans_message`). **Zéro compteur = la fonction n'a jamais
  tourné** : l'extension installée est antérieure à **5.45** — la version qui a
  apporté `capterRetraits`, pas 5.52 (voir « ce que sait faire l'extension »
  plus bas). `panel_colis_relais`
  n'existe même pas en base.
  ⇒ Et le 7 septembre je lui avais dit « passe sur Vinted connecté sur
  `julatace3535`, l'extension ira chercher les codes toute seule », et **l'app
  le lui disait aussi**. C'était une promesse que SON extension ne peut pas
  tenir — le défaut le plus coûteux du projet (§ zip), refait à l'identique.
  ⇒ Corrigé : `extSaitLireCodes()` distingue **absente** (téléphone → « ouvre la
  conversation, le code y est ») · **en retard** (→ « mets-la à jour d'abord,
  celle installée ne sait pas encore lire les codes ») · **à jour** (→ la
  promesse). `audit-retrait.cjs` exige qu'aucune promesse « toute seule » ne
  s'affiche sans cette garde.
  ⚠️ **Et le premier jet de cette garde avait le même trou.** Le pont n'annonce
  sa version que **depuis la 5.26** (posé le 17 août) : une extension plus
  ancienne est détectée mais **muette**. Or `extEnRetard` exigeait `!!v` — donc
  **aucun bandeau** — et `extSaitLireCodes` répondait « inconnue », qui
  retombait sur la PROMESSE. **L'extension la plus en retard était la seule à ne
  rien déclencher.** Se taire veut dire « plus vieille que 5.26 » : c'est traité
  comme un retard, et le bandeau s'affiche avec « ? → 5.52.0 ».
  ⇒ C'est le miroir exact de la leçon du panneau de sécurité : **« pas su » ne
  vaut pas « oui »**. À vérifier partout où l'app décide sur une capacité.
  ⚠️ **Autre chose que la mesure a démentie** : les colis à retirer ne sont pas
  tous sur `julatace3535`. Il y en a **6**, dont **1 sur `julatace35260`** — un
  compte capté il y a 10 minutes. Toutes les conditions y étaient réunies, et
  rien n'a été écrit : c'est ce qui prouve que le problème n'est pas le compte,
  mais la version.
- ⚠️ **L'extension VA CHERCHER les codes toute seule** (à partir de la **5.45**) —
  **et l'app disait le contraire.** `capterRetraits(uid)` (posé le 27 août, dans `background.js`)
  tourne à **chaque visite sur Vinted** : il prend les achats que Vinted dit
  « déposés en point relais », ouvre leur conversation par l'API et en lit le
  code. Bornes : **3 par visite**, pas de nouvel essai avant 6 h, et
  **uniquement pour le compte connecté dans l'onglet** (`garde`). C'est une
  LECTURE sur ses propres achats — la même forme que la récupération du
  bordereau, elle ne décide de rien.
  L'app, elle, lui répétait « ouvre la conversation UNE fois » : elle lui
  réclamait le travail que l'extension fait déjà, et comme rien n'arrivait il
  en concluait que l'app était cassée (« ça ne travaille pas tout seul »).
  Le vrai geste, et le seul : **se connecter sur le bon compte et passer sur
  Vinted**. Mesuré le 7 septembre — ses **5 colis à retirer sont tous sur
  `julatace3535`**, dont la dernière capture datait de 4 jours : l'extension
  n'y était jamais passée. D'où le compte **nommé sur chaque ligne** (il en a
  neuf), et `audit-retrait.cjs` qui vérifie désormais que le message de l'app
  et le code de l'extension disent la même chose. Ouvrir la conversation reste
  proposé — c'est le raccourci, plus l'obligation.
- ⚠️ **Le tableau de bord ne voyait qu'un colis sur six.** Le centre de
  notifications RECALCULAIT la règle de son côté, et sa version ne comptait que
  les colis venus d'un **email transporteur** : les colis vus « déposés en point
  relais » côté Vinted n'apparaissaient **nulle part** sur cet écran — 1 annoncé
  contre 5 sur Ma journée, et sur certaines données **aucune ligne du tout**.
  C'est §11 mot pour mot et §5.43 (un colis caché est un colis perdu).
  `pickupUnion` **publie** ses comptes (`vrm_colis_retirer`), le tableau de bord
  **consomme** — même motif que `vinted_nums_physiques` et `vinted_urssaf_mois`.
  ⚠️ Et il ne publie que **complet** : rendu depuis Ma journée seule, les emails
  de suivi n'étaient pas encore chargés et la valeur partielle (« 0 prêt · 5 en
  attente ») partait au tableau de bord. Sans ligne publiée, on retombe sur ce
  qu'on sait — jamais sur zéro. Le banc `retrait.cjs` exige que **les trois
  écrans** annoncent le même nombre.
- Un email « colis retiré » sort déjà le colis d'email de la liste
  (`suivisRetires` par n° de suivi, une identité).
- **Les QR : il n'y en a que 3 dans toute la base**, tous des codes-barres
  Pickup (`/api/barcode/AztecCode|DataMatrix`). Les 25 autres `qrUrl` sont des
  bannières et des pixels de suivi — `URL_PAS_UN_QR` les écarte, ne pas
  l'assouplir. Aucune ligne ne porte de `qrB64`.
- Le bloc **« colis jamais retirés »** (plus de 14 j) n'affichait QUE le code :
  ses 3 QR ne s'affichaient nulle part. Il montre les deux, et dit combien
  peuvent encore être retirés — « réclame à Vinted » est le mauvais geste quand
  on a encore le code. ⚠️ **23 octobre** : les 14 j sont remplacés par la date
  limite LUE dans l'e-mail, sinon 7 j (« colis à vérifier ») — voir « Colis à
  retirer fiables » (23 octobre), en fin de dossier.
- **« Commande non réclamée — retournée à l'expéditeur »** : 3 achats, 84,94 €,
  qui ne sortaient sur aucun onglet (`phaseReception` les range en « annulé »).
  Ils ont leur bloc sur Achats. On dit « à vérifier », **jamais « perdu »** :
  Vinted rembourse souvent tout seul.


### Les codes de retrait, remesurés le 15 septembre — et la photo est IMPOSSIBLE
Demande de Julien : « les codes de retrait Mondial Relay, Chronopost et Vinted
Go… je veux qu'il y ait les QR codes, les codes de retrait à chaque fois. Tu
prends tout ce qu'il y a dans le mail et tu le mets dans l'application. **Si tu
peux**, tu peux mettre la photo à côté si jamais tu as un numéro de suivi. Mais
attention, ne fais pas d'erreur. »

**Remesuré sur ses 150 emails de suivi, transporteur par transporteur** :

| transporteur | emails | code | QR | n° de suivi | lieu | date limite |
|---|---|---|---|---|---|---|
| Mondial Relay | 93 | **18** | 0 | 91 | 13 | 0 |
| Chronopost | 46 | 3 (dont 2 casiers à deux codes) | **3 vrais** | 42 | 2 | 3 |
| Vinted (`shipping@`) | 6 | 0 | 0 | 5 | 0 | 0 |
| Colissimo | 4 | 0 | 0 | 0 | 0 | 0 |
| Shop2Shop | 1 | 0 | 0 | 0 | 0 | 0 |

- **19 colis « arrivés au point de retrait »**, dont **15 avec leur code** et
  **3 avec un vrai code-barres** : c'est déjà ce que l'app affiche. Les
  **28 `qrUrl`** se réduisent bien à **3** (`/api/barcode/AztecCode|DataMatrix`) ;
  les 25 autres sont des mouchards et des bannières — `URL_PAS_UN_QR` fait son
  travail, ne pas l'assouplir.
- **Vinted Go : AUCUN email dans sa base** (2 mentions en tout, aucune de colis).
  Le transporteur est pourtant déjà reconnu (`detecterTransporteur` le teste
  **avant** « vinted », `CARRIERS.vinted` = « Vinted Go ») et `codeRetrait`
  accepte déjà sa forme `C65735`. **Il n'y a rien à écrire de plus tant qu'un
  vrai email n'est pas arrivé** — écrire un analyseur pour un format jamais vu,
  c'est promettre ce qu'on n'a pas mesuré.
- ⚠️ **La ligne `email_track_chronopost_XW476115185SP` porte toujours
  `code: "suivant"`** — un mot capté par un ancien motif trop large. Le serveur
  est corrigé depuis, mais **cette ligne ne sera jamais réécrite** : c'est
  `codeRetrait` qui l'écarte à l'affichage. Ne pas « nettoyer la base » pour ça.
- ⚠️⚠️ **LA PHOTO À CÔTÉ DU CODE : MESURÉE IMPOSSIBLE, ET C'EST DÉFINITIF TANT
  QU'AUCUNE IDENTITÉ N'APPARAÎT.** Sur les **21 emails qui portent un code,
  ZÉRO** se relie à un bordereau, à un achat ou à une commande Vinted :
  `artTitle` **0/150**, et sur **134 n° de suivi distincts**, **0/57** se
  retrouve dans un `email_achat_*` et **1/134** dans les commandes moissonnées.
  (Le pont existe **dans l'autre sens** — **23 des 134** correspondent à un
  bordereau, donc à une **vente** : ce sont les colis qu'il ENVOIE, pas ceux
  qu'il retire.) Mettre une photo à côté d'un code de retrait reviendrait donc à
  rapprocher par la date ou le point relais — le rapprochement par ressemblance
  interdit (§5) — et se tromper ici, c'est aller chercher le mauvais colis.
  **Mieux vaut un blanc qu'un faux.** Ne pas réessayer sans une identité neuve ;
  celle qui viendra est le code lu dans la **conversation Vinted**
  (`panel_colis_relais`, extension ≥ 5.45), qui, elle, porte la commande.


### L'écran Colis se range sur CE QU'IL PEUT FAIRE
**Vu en capture le 7 septembre, sur ses vraies données** : l'en-tête annonçait
« 10 bordereaux prêts à imprimer », et les **quatre premières cartes de l'écran**
disaient toutes « l'extension le récupère à ta prochaine visite ». Le tri par
date limite mettait devant les seuls colis qu'il ne **peut pas** traiter — dix
étiquettes l'attendaient plus bas. La liste se groupe donc en **Prêts à imprimer
/ En attente de leur bordereau / Déjà postés**, l'urgence restant le tri à
l'intérieur de chaque groupe et le texte de chaque carte.
⚠️ **PIÈGE DE BANC, corrigé le 7 septembre** : mes bancs rendaient la ligne
BRUTE (`{id,data}`) pour une requête qui demande une **projection**
(`select=id,filename:data->>filename,…`). L'app lisait donc `r.filename` sur un
objet qui ne l'a pas → **tous les bordereaux tombaient** et l'écran affichait
« 0 bordereau prêt à imprimer ». C'était un artefact du banc, pas un défaut de
l'app. `colis.cjs` applique désormais la projection `select=` pour de vrai
(§6.3) : un banc qui ne sert pas la bonne FORME de réponse mesure une fiction.


### Colis : « prêt à imprimer » n'avait pas de propriétaire
Mesuré le 8 septembre, sur ses vraies données : **Ma journée annonçait « 8
bordereaux prêts à imprimer », Colis « 9 »** — même formule, mêmes données.
La règle « prêt » a deux moitiés : le PDF reçu par email (`b.hasPdf`) **et** le
bordereau capté par l'extension (`labelsCaptes`). Or `labelsCaptes` n'est
rempli **que par l'écran Colis** — mesuré : **18 requêtes `label_*` sur Colis,
zéro sur l'accueil**. Le compte de Ma journée était donc un **minorant**,
présenté comme un total. C'est §11 : deux lecteurs recalculent la même notion.
- `pret` est maintenant **porté par la ligne** (`expeditions()` l'estampille) :
  le tri et le bandeau le LISENT, ils ne peuvent plus diverger.
- Colis **publie** `vrm_colis_prets`, Ma journée **consomme** — comme
  `vrm_colis_retirer`. Charger les `label_*` sur l'accueil coûterait neuf
  lectures de plus à chaque ouverture de l'app.
- ⚠️ **Et sans ligne publiée, on ne présente pas un minorant comme un total** :
  sur un appareil neuf l'accueil dit « **au moins** 8 bordereaux prêts ». Dès
  qu'on est passé par Colis, les deux disent 9.
- ⚠️ **« pas encore lu » n'est pas « aucun »** : `labelsCaptes` part à `{}`, et
  rien ne distinguait « zéro capté » de « jamais demandé ». D'où `labelsPrets`.
  Troisième forme du même piège après le panneau de sécurité et les capacités
  de l'extension.
- ⚠️ **Et `audit-chiffres.cjs` a crié au loup en renommant ce helper** : il
  exigeait la ligne `const pret = (e) =>`. Devenu `estPret`, la règle était
  intacte — mieux respectée qu'avant — et l'audit tombait au rouge. **Troisième
  fois** qu'un contrôle porte sur l'orthographe au lieu de la règle (après
  `audit-identite` et `audit-retrait`). Il vérifie maintenant les deux points
  qui comptent : la ligne PORTE `pret`, et le tri le compare AVANT la date
  limite.


### « Les plus urgents sont en haut de la liste » — faux une fois sur deux
La liste des colis se groupe sur **ce qu'il peut faire** (prêts à imprimer,
puis en attente de bordereau) ; l'urgence n'est que le tri **à l'intérieur** de
chaque groupe. Le bandeau d'urgence affirmait pourtant « les plus urgents sont
en haut de la liste ». Vu en capture le 8 septembre : le seul « à poster
demain » était dans le **second** groupe, dix cartes plus bas — et c'était
justement celui qu'il ne peut pas imprimer. **La structure avait été corrigée
en septembre, la phrase qui la décrit était restée en arrière** — exactement le
défaut de la carte URSSAF, le même jour.
`urgenceColis()` compte donc aussi **où** ils sont (`pressePret` /
`presseAttente`, sur la même source), et `ouSontLesPresses()` écrit les trois
cas réels. Le banc `colis.cjs` déclenche sur la **position** d'un colis pressé,
pas sur la formulation : 4 échecs sur le code d'avant.


### La carte des points relais (Achats)
**Mesuré le 6 septembre** : `vrm_ville` valait déjà « Cancale », `/api/relais`
répond bien 5 points — mais `vrm_ville_points` était **absent** et l'écran ne
cherchait rien. Cause : **un écran lit ses réglages au MONTAGE**
(`useState(() => load(...))`) et le nuage atterrit ~500 ms plus tard. Sur le
**premier écran ouvert**, il lit donc du vide ; on change d'onglet, on revient,
et tout marche. Le mécanisme de rattrapage existait (`onCloudReady`, posé pour
les numéros) : les réglages de la carte n'y étaient pas branchés. **Toute
donnée synchronisée lue au montage doit passer par `onCloudReady`**, et n'y
remplacer que ce qui est resté VIDE (sinon une saisie faite pendant le
chargement est écrasée — pour les numéros ce serait le pire défaut de l'app).
- Le filtre « Casiers & transporteurs », actif par défaut, cachait **4 des
  5 points** de Cancale sans le dire. Il affiche maintenant combien il masque.
- `vrm_points_relais` contient « Juste Ici » — un bout de texte pris dans un
  email, géocodé à **Marseille**, listé comme point relais de Cancale. Un point
  à plus de 30 km de la ville est signalé (« à 819 km ») ; **jamais supprimé
  tout seul**, c'est sa liste.


### ⚠️⚠️ « AMÉLIORE LA RAPIDITÉ » — 99 % DU TEMPS ÉTAIT DE L'ATTENTE
Demande de Julien, 15 septembre : « améliore la rapidité de la capture de
bordereau, de lecture de donnée et de transmission ». **Mesuré avant de coder**,
sur sa vraie base, et les trois chiffres qui comptent :

1. ⚠️⚠️ **`select=data` SUR 704 LIGNES DE TRANSACTION : 19,8 Mo en 5,0 s.** La
   projection `item_id` rend **16 Ko en 0,36 s** — **1 251× moins d'octets,
   14× plus vite**, et **exactement les mêmes 242 ventes prouvées** (0 manquante,
   0 en trop : la preuve qu'un jugement métier n'a pas bougé). Cette lecture
   était écrite **quatre fois** (app, `buildLbcData`, `buildEbayData`,
   `buildPanelData`) : **77 Mo par tour de panneau**. C'est §4.4 mot pour mot —
   et c'est de l'**égress**, celui qu'un `select=data` avait déjà crevé (5,7 Go).
   ⚠️ Le repli `t.item.id` n'existe nulle part chez lui (**704 lignes sur 704**
   portent `item_id`) : mesuré avant de le retirer, pas supposé.
2. **`harvest_*_conv_*` : 939 lignes, 4,3 Mo.** Les huit champs dont le panneau
   se sert tiennent en **994 Ko** — et les messages reviennent **identiques**
   (629 conversations comparées, 0 différence). Les 3,3 Mo de trop, ce sont les
   objets utilisateur, l'article et les photos : rien de ce qu'on lit.
3. ⚠️⚠️ **ET LA VRAIE LENTEUR N'ÉTAIT PAS LÀ.** Mesuré : **26 requêtes,
   6 198 ms, dont 6 153 ms d'attente réseau (99 %) — et jamais plus d'UNE
   requête en vol**. Même une lecture qui rend **0 Ko** coûte **536 ms** : ce qui
   coûte, c'est l'aller-retour, et on en faisait vingt-six à la queue leu leu.
   Les lectures indépendantes partent maintenant **par six**.
   ⚠️ **Ce n'est PAS le garde-fou « une par une » (§3)** : celui-là porte sur les
   requêtes envoyées à **VINTED**, et il ne bouge pas. Ici on lit **notre propre
   base** — Vinted n'est pas dans la boucle. Ne pas resérialiser en croyant
   protéger quelque chose.
   ⚠️ Effet de bord trouvé en mesurant : `isCloisonne()` mémorisait son
   **résultat**, pas sa **promesse** — tant que les lectures partaient une par
   une ça ne se voyait pas ; dès qu'elles partent ensemble, **six sondes
   identiques** partaient avant que la première ne réponde.

**Mesuré après, sur la même base** : `buildPanelData` **21,0 s → 3,8 s**
(5,6× plus vite), **25,6 Mo → 2,6 Mo** ; `buildLbcData` **21× moins d'octets** ;
`buildEbayData` **29×**. **Résultat identique partout** — c'est vérifié en
comparant les files et les `stats` rendues, pas en relisant le code.

⚠️⚠️ **ET LA MESURE A RÉVÉLÉ PIRE QUE LA LENTEUR.** Pendant les essais, la
lecture des transactions a **échoué une fois** (base sous charge) : le `|| []`
l'a transformée en « aucune vente prouvée », et la file Leboncoin est passée de
**40 à 55 paires** — **quinze paires DÉJÀ VENDUES reproposées à la
publication**, sans un mot. C'est la plainte du 13 septembre ressuscitée par un
simple timeout, et la **quinzième forme** de « rien lu ne vaut pas rien ».
⇒ `lireVentesProuvees()` **porte l'échec** (`{echec, vendus}`), les deux files le
rendent (`preuveKO`), et **les trois écrans le disent** — sans cacher la liste,
qui reste utile : « je n'ai pas pu vérifier lesquelles sont déjà vendues ».
**6 échecs** sur le code d'avant.

⚠️ **ET LE PLAFOND DES 1 000 LIGNES ÉTAIT À 61 LIGNES D'ÊTRE FRANCHI.** Mesuré :
`Content-Range: 0-999/4999` — au-delà de mille, Supabase coupe **sans le dire**
(§4.5), et `sbGet` ne paginait pas. `harvest_*_conv_*` est à **939**. Le jour où
il passe, le panneau cesse de voir des offres et des codes de retrait, en
silence. `sbGetTout` pagine, et **rend `null` si une page échoue** — une
demi-liste a l'air d'une réponse, c'est pire qu'une lecture ratée.
⚠️ La pagination est décidée **dans `lire`**, pas dans la liste de
préchargement : une garantie ne doit pas reposer sur le fait de ne rien oublier.

- `scripts/audit-lectures.cjs` porte les trois règles : aucun blob sur une
  famille lourde, toute famille qui balaie est paginée, une seule règle de preuve
  qui porte son échec. **10 échecs** sur le code d'avant.
- ⚠️ **§4.6 PAYÉ CASH, ENCORE** : `balayeFamille` posé **après** le bloc qui s'en
  sert → « Cannot access 'balayeFamille' before initialization », et
  `buildPanelData` mourait. **Aucun audit ne l'a vu** — c'est la comparaison
  avant/après, qui EXÉCUTE la fonction sur la vraie base, qui l'a attrapée.
- ⚠️ **Et `audit-panneau.cjs` MOURAIT au lieu de rapporter** (quatrième fois) :
  l'erreur venait d'une voie de préchargement **non attendue**, donc un rejet non
  traité qui tue le processus — et, dans la vraie extension, le service worker,
  en laissant les requêtes suivantes sans réponse **pour toujours**. Une voie qui
  tombe rend `null` : « je n'ai pas pu lire », que le panneau sait déjà dire.
- ⚠️ **DEUX de mes bancs servaient une FORME que le code ne sait plus lire**
  (§6.3) : `audit-places` et `audit-offres-auto` rendaient la ligne BRUTE pour
  une requête qui demande une projection — donc « aucune vente prouvée » et
  « aucune offre », en se croyant verts. Ils appliquent maintenant le `select=`
  pour de vrai.
- ⚠️ **SEIZIÈME ET DIX-SEPTIÈME fois qu'un de mes contrôles crie au loup** :
  (1) il traitait `harvest_*_conv_${convId}` — la lecture d'**UNE** conversation
  par son identifiant — comme un balayage de famille ; (2) il exigeait le nom
  `sbGetTout` au point d'appel, alors que `lire` pagine lui-même. *Un audit suit
  la RÈGLE, pas son orthographe* : il suit l'expression jusqu'à sa définition.


### La capture de bordereau : on savait quel chemin marche, et on le jetait
Troisième point de sa demande du 15 septembre. Relevé du **13 septembre** :
**`label_url_trouve` 29 contre `label_url_introuvable` 61** — l'URL du PDF est
introuvable **deux fois sur trois**. `recupererLabel` essaie **trois chemins**
Vinted l'un après l'autre (`/label_url`, `/shipments/{id}`, `/label_options`) et
s'arrête au premier qui répond.
⚠️ **Il calculait `via` — le chemin gagnant — et ne l'enregistrait nulle part.**
C'est exactement la mesure qui manque pour aller plus vite : sans elle, retirer
un chemin ou les réordonner serait une **supposition**, et c'est ce que ce projet
s'interdit. Le chemin gagnant est noté (`label_via_*`), et quand aucun ne donne
rien on note **les trois statuts HTTP** (`label_ko_statuts_*`) : « Vinted a
refusé » et « Vinted a répondu sans URL » ne se corrigent pas de la même façon.
Borné par construction : trois chemins, trois statuts.
⚠️ **Et je n'ai pas pu mesurer plus loin aujourd'hui** : `panel_diag_capture` a
été **remise à zéro** (48 compteurs et les deux échantillons le 13, plus rien le
15 — `majAt` du jour). Le code d'écriture est pourtant correct (il refuse
d'écrire sur une lecture ratée et garde `rates`). **Ne pas conclure sans la
cause** : la prochaine session aura les compteurs, et c'est eux qui diront quoi
changer.


### ⚠️⚠️ OUVRIR COLIS RETÉLÉCHARGEAIT 1,6 Mo DE PDF — LE CALLER ÉTAIT RESTÉ
Mesuré le 15 septembre sur sa vraie base, écran par écran : **Colis coûtait
3 594 Ko**, dont **713 · 482 · 268 Ko** pour trois lectures
`harvest_{uid}_label_latest&select=data`. Ses **7 lignes `label_latest` pèsent
1 663 Ko dont 1 658 Ko de `pdfB64` (99,7 %)** — et elles étaient lues **une fois
par compte à chaque ouverture**, uniquement pour répondre à **deux questions** :
« y a-t-il un PDF ? » et « de quand date-t-il ? ».
⚠️ **La version scalaire existait déjà**, avec un commentaire qui interdisait
exactement ça (« les octets du PDF ne partent qu'à l'impression »). C'est le
**CALLER** qui n'avait jamais été retiré : *une suppression « terminée » se
vérifie sur ce qui RESTE* — la leçon du pipeline Factures et du tiroir `Nav`,
refaite sur l'égress.
- `fetchLabelFrais` lit deux scalaires avec le filtre `data->>pdfB64=not.is.null`
  (la **présence** de la ligne vaut « il y a un PDF ») : **1 282 ms / 713 Ko →
  224 ms / 0 Ko** par compte. Les octets ne partent qu'au clic
  (`startBordereau`), qui garde `fetchCapturedLabel`.
- Et les neuf comptes sont interrogés **ensemble** (`Promise.all`). ⚠️ Rien à
  voir avec le garde-fou « une requête à la fois » : celui-là porte sur ce qu'on
  envoie à **Vinted**, jamais sur nos propres lectures Supabase.
- `email_track_*` était lu **3 fois** à l'ouverture de Colis (l'effet de l'écran,
  celui du changement d'onglet, le centre de notifications) : `cachedRow` partage
  la requête **en vol**, les deux appels qui doivent voir un changement passent
  `{force:true}`.
- `harvest_*_billing` était lu **deux fois** sur Ma journée (les soldes, puis les
  boosts) : **4 Ko**, mais **710 ms d'aller-retour × 2**. Ici ce n'est pas
  l'égress qui coûte, c'est le VOYAGE. Même motif, `fetchBillingRows`.
- Mesuré après : **Colis 3 594 → 1 797 Ko**.
⚠️⚠️ **ET LE BANC NE POUVAIT PAS LE VOIR, POUR DEUX RAISONS.** (1) Les fixtures
tronquent `pdfB64` à **quatre caractères** (elles ne montent jamais dans le
dépôt, §6) : servie ainsi, la lecture fautive coûtait 28 octets — **vert sur le
défaut**. C'est la leçon de la projection `select=` (§6.3) appliquée au **POIDS** :
un banc qui ne sert pas le bon **ordre de grandeur** mesure une fiction. Les PDF
sont regonflés à leur taille mesurée (237 Ko). (2) Le banc **ignorait les
filtres** de PostgREST : il rendait des lignes que l'app ne verrait jamais.
⇒ `colis.cjs` compte désormais **les octets de `pdfB64` qui traversent** —
ouvrir Colis doit en rapatrier **zéro** — et honore `data->>X=(not.)is.null`.
**1 185 Ko rapatriés** sur le code d'avant.
⚠️ Et la moitié qui manquerait à un contrôle posé sur les seuls octets : *ne
rien lire du tout est le moyen le plus simple de ne rien télécharger*. Le banc
sert donc **deux** `label_latest` fraîches, une seule avec son PDF, et exige que
le bandeau « tamponner en 1 clic » s'affiche **en nommant le compte dont le PDF
est là**. Prouvé en retirant le filtre : le bandeau nomme `angeled92`, plus
frais de 5 min et **sans PDF** — il enverrait tamponner un bordereau qui
n'existe pas.


### ⚠️⚠️ « ÇA IMPRIME DES FOIS EN RECTO VERSO » — ET LA PAGE PORTE TROIS CHOSES
Demande de Julien, 15 septembre : « quand tu imprimes un bordereau et que tu mets
tout imprimer, ça imprime des fois en recto verso, je veux juste que ça imprime
plusieurs feuilles avec un seul bordereau sur chaque feuille », puis
« **imprimante classique / imprimante thermique** — en thermique c'est simplement
le bordereau **sans la partie fiche destinataire**, et pub pour les Mondial
Relay, avec un **tout petit SKU en bas** ».

**MESURÉ AVANT DE CODER, sur ses 148 bordereaux qui portent un PDF** :
- **tous font UNE seule page A4**, jamais deux — « un bordereau par feuille »
  n'était donc pas cassé par un PDF multipage ;
- **67 en paysage** (842×595, Chronopost) et **81 en portrait** (595×842,
  InPost) — et un lot mélange les deux ;
- et cette page unique porte **l'étiquette ET la fiche destinataire ET la pub du
  transporteur**, séparées par une **ligne de découpe (✂)**. C'est ce qu'il
  décrit mot pour mot, et ça se voit au rendu, pas dans le DOM.

**Ce qui est livré :**
- **`/Duplex /Simplex`** dans tout PDF produit (`posePrefsImpression`). macOS et
  Acrobat lisent cette préférence et décochent le recto-verso. ⚠️ **Rien n'est
  promis pour autant** : un pilote qui force le recto-verso gagne toujours, et
  l'app **n'a aucun moyen de le vérifier** — elle rappelle où est la case, elle
  n'affirme pas que ça n'arrivera plus. (C'est le défaut le plus coûteux du
  projet qui repointait : promettre ce qu'on ne peut pas tenir.)
- **`zoneEtiquette(PL, page)`** isole l'étiquette : **144 des 148 (97 %)**,
  **quatre** mises en page, et la zone est **identique** d'un bordereau à l'autre
  pour une mise en page donnée. Le N° est tamponné **en petit, en bas** —
  103×153 mm sur Mondial Relay, une étiquette thermique fait 100×150.
- **Quand on ne SAIT pas, la page part ENTIÈRE**, et l'écran écrit **combien**
  ont été découpées, combien sont parties entières et **pourquoi**. Une zone
  devinée de travers, c'est un **code-barres coupé**, donc un colis qui ne part
  pas — et ça ne se voit qu'au comptoir. *Le chiffre, jamais la promesse.*
- Le sélecteur vit dans l'onglet Colis, avec **UNE** phrase sous les deux
  pastilles (§7) : c'est la pastille active qui distingue, pas un texte par ligne.
- `vrm_imprimante` est un réglage **synchronisé**, donc rattrapé par
  `onCloudReady` et seulement s'il est resté au défaut (§5.49).

⚠️⚠️ **QUATRE DÉFAUTS TROUVÉS EN REGARDANT LE RENDU, AUCUN DANS LE CODE** (§6.2) :
1. **Sur un bordereau Colissimo, c'était la MAUVAISE MOITIÉ qui était gardée** —
   « Comment utiliser votre étiquette » + « Preuve de dépôt », et l'étiquette
   avec son code-barres partait à la poubelle. *Une liste de mots est une
   ressemblance, et elle peut désigner le mauvais côté.* ⇒ Une **confirmation
   indépendante des mots** est exigée : le plus gros aplat (un code-barres est un
   pavé noir) doit être du côté gardé ; si les deux se contredisent, **on ne
   découpe pas**. Le repli par cadre écarte aussi tout cadre qui **contient** les
   mots de la notice — le plus GRAND cadre n'est pas forcément l'étiquette.
2. **Un chemin PDF porte plusieurs sous-chemins** (`m … l … m … l … S`). Fondus
   en une seule boîte, un trait de l'étiquette et un trait de la colonne d'à côté
   n'en formaient qu'un, large de 346 pt : la bande vide était bouchée et
   **33 bordereaux ressortaient pleine largeur** — donc sans rien retirer.
3. **Un texte n'est pas un point.** En ne notant que son origine, la carte
   d'occupation le croit large de zéro : la coupe pouvait tomber **en plein
   milieu d'une ligne**. Largeur estimée à 0,5 em par caractère, **dans le sens
   du texte** (les étiquettes en portent à la verticale).
4. **Un rectangle ne s'écrit pas toujours `re`** : la plupart des générateurs
   tracent un chemin. Ne lire que `re` rendait la page aveugle à tous ses traits.
⚠️ **Et un nom de pays coupé net n'était PAS un défaut** : vérifié en recadrant
large, le bordereau InPost le tronque lui-même. *Avant de « corriger », regarder
la source.*

- `scripts/audit-impression.cjs` **exécute** le vrai code extrait d'`App.jsx`
  dans un `vm`, sur de **vrais** PDF : **18 contrôles**, dont « une mise en page
  inconnue n'est PAS découpée ». `--prouve` réaffaiblit la règle (on découpe même
  sans savoir) → **3 contrôles au rouge**. « La fonction n'existait pas avant »
  n'est pas une preuve (§6.1).
- ⚠️ **QUATRIÈME FOIS QUE MON BANC SERT UNE FORME QUE LE CODE NE LIT PAS** (§6.3),
  et deux fois dans le même banc : (1) un PDF qu'on vient de construire porte son
  flux **en objet**, celui qui arrive de Vinted est **compressé** — le banc
  passait par `save()` puis `load()` après ça ; (2) pdf-lib écrit son texte en
  **hexadécimal** (`<4669…> Tj`), une forme que `relevePage` ne lisait pas. La
  deuxième a été corrigée **dans l'app** : une chaîne PDF s'écrit des deux façons,
  et n'en lire qu'une laisse la page muette.


### L'imprimante thermique au point, et un réglage « Imprimante » avec un aperçu par type (17 octobre)
Julien : « dans les paramètres, imprimante thermique et normale, tous les types
de bordereau avec une visualisation pour chaque type, et la thermique au point ».
- **Mesuré d'abord sur ses 93 bordereaux avec PDF** (lecture seule, copie locale
  dans `scripts/bancs/fx/bordereaux/`, gitignorée) : Chronopost/Shop2Shop 47
  (paysage 43, debout 4), Mondial Relay · InPost 16, Mondial Relay international
  27 (étiquette partenaire Hermes/An Post), Colissimo 3. `zoneEtiquette` en
  isolait **92** ; le 93ᵉ (international « FPDF ») partait entier : AUCUN mot
  lisible, mais ses DEUX étiquettes sont des images de 100×150 mm exactement.
- **Thermique** : chaque étiquette devient UNE page de **100 × 150 mm**
  exactement (`ETIQ_TH`), tournée si elle est couchée (du côté qui remet le texte
  à l'endroit, lu dans la matrice du texte : `avecSens`), mise à l'échelle ENTIÈRE
  dans une marge de 2,5 mm (jamais rognée, jamais agrandie de plus de 25 %), le N°
  dans une bande réservée SOUS l'étiquette (avant : posé par-dessus, à 4 pt du
  bord, et la page gardait la taille de la zone — le pilote décidait du reste).
- **Deux repères de plus, sans rien deviner** : une page déjà au format étiquette
  part entière ; une image ou un Form XObject au format exact d'une étiquette EST
  une étiquette (deux qui se chevauchent ⇒ page entière). Résultat : **93/93**,
  94 pages (l'international donne ses deux étiquettes — les deux vont sur le colis).
- **Une règle pour les trois chemins d'impression** (une vente, un lot,
  bordereau + facture, et Leboncoin par `annotateAndDownloadBordereau`) :
  `poserBordereau`. Le réglage est lu par `imprimanteChoisie()` (§11, le même
  `vrm_imprimante` que les pastilles de Colis). En thermique isolé, plus de
  « déplacer le N° » (il est dans la bande).
- **Réglages → Impression → « Imprimante et bordereaux »** (`ImprimanteSetting`) :
  le choix, une phrase par mode, et « Voir les aperçus » — au CLIC seulement, au
  plus 24 PDF lus (§4.4), un aperçu normal (zone thermique en pointillés) et
  thermique par type (`typeBordereau` : mots du transporteur, puis créateur
  « MondialRelay », puis étiquette partenaire ; sinon « autre mise en page »),
  fabriqués par `poserBordereau` lui-même, avec un N° d'exemple dit comme tel ;
  les types jamais reçus sont dits « pas encore vus », sans aperçu inventé. Le
  dessin passe par pdf.js 3.11.174 chargé au premier aperçu depuis jsdelivr ;
  injoignable ⇒ « Ouvrir le PDF ».
- Preuves : `audit-impression.cjs` (vrai code, `new Function` — un tableau né
  dans un `vm` n'est pas un `Array` pour pdf-lib) **+ section 7 sur ses vrais PDF
  si présents** : 93 découpés, 0 page hors 100×150, 0 zone hors page ;
  `--prouve` : **8 rouges** (découpe sans savoir · étiquettes qui se chevauchent
  prises · page à la taille de la zone). Banc `imprimante.cjs` (390/1512, trois
  autres états) vert. Sur le code d'avant, les fonctions n'existent pas
  (11 rouges — pas une preuve en soi) ; la mesure de l'ancien rendu : 92/93 et des
  pages à la taille de la zone (152×103 mm couchées, 103×153 mm debout).
- ⚠️ **Non mesuré** : l'impression sur une vraie imprimante thermique (Zebra,
  Rollo, Phomemo…) — le PDF fait 100×150 mm, mais l'échelle « 100 % » et le
  papier se choisissent dans la fenêtre d'impression (l'écran le dit) ; Vinted Go,
  Relais Colis, UPS, DPD seuls jamais vus ; le PDF Leboncoin.


### ⚠️⚠️ « EST-CE QUE MON EXTENSION EST À JOUR ? » — L'APP NE POUVAIT PAS RÉPONDRE
Trois sessions de suite ont dû **DEVINER** la version installée (« aucun
compteur `retrait_*`, donc antérieure à 5.45 ») — et §8 dit noir sur blanc que
**l'une de ces déductions était fausse**. Le dossier en avait tiré la règle
(« ne pas redéduire une version d'un compteur à zéro. Le signal fiable est ce
que le pont annonce, ou une écriture datée »), **sans jamais créer cette
écriture datée**. C'est le même motif que le tiroir `Nav` : la règle était là,
le mécanisme n'existait pas.

**Remesuré le 16 septembre, et c'est ce qui a déclenché la passe** :
`label_url_trouve` **7** contre `label_url_introuvable` **4** — mais **aucun
`label_via_*`**, alors que le code l'écrit à la ligne **suivante**, sur le même
chemin, sans condition. Ce n'est PAS le piège du compteur à zéro : la fonction a
demonstrablement tourné 7 fois sans écrire son voisin. Donc son extension est
plus ancienne que la version qui a posé `label_via_*`. Et le seul moyen de le
savoir était ce raisonnement-là.

⇒ L'extension inscrit désormais **sa propre version** dans sa ligne de
diagnostic à chaque capture (`panel_diag_capture.ver` + `verAt`), dans
`viderTampon` — qui refuse déjà d'écrire sur une lecture ratée et conserve
`rates`.

⚠️⚠️ **C'EST UN CONSTAT, JAMAIS UNE CAPACITÉ — et c'est toute la difficulté.**
Cette version est celle de l'extension qui a capté **EN DERNIER, quelque part**,
pas celle du navigateur qui lit l'app. S'en servir pour décider ce qu'on
**promet** reviendrait à annoncer à son **iPhone** ce qu'un Chrome sait faire :
le défaut le plus coûteux du projet, pour la sixième fois. `extSait()` continue
donc de n'écouter **que le pont**, et `audit-coherence.cjs` l'interdit
explicitement (il relit le corps d'`extSait` et refuse qu'il touche à cette
valeur).

**Ce que ça change pour lui** : depuis son téléphone — l'appareil où il pose la
question — la ligne « Extension Chrome · pas détectée ici » ajoute le fait
mesuré : « **La dernière capture est partie d'une 5.41.0 (il y a 3 h).** C'est
donc l'ancienne qui tourne encore sur ton ordinateur — c'est là qu'il faut la
remplacer par la 5.63.0. » À jour, elle dit « rien à faire ici » et ne réclame
rien. Sur l'ordinateur, le pont répond déjà : la phrase ne s'affiche donc **que**
là où l'information manquait (§7).
- **Trois états**, comme partout : `undefined` en cours · `null` **pas su** ·
  un objet lu. Ligne absente **ou** lecture ratée ⇒ **aucune version inventée**.
- **Aucune entrée d'`EXT_CAPACITES`** : l'app ne promet rien de neuf. Extension
  en **5.63.0**, zip régénéré, `EXT_ATTENDUE` suivie.
- `capacites.cjs` rend l'écran Réglages **sans extension** dans quatre états
  (version à jour · vieille · ligne absente · lecture ratée) et exige les deux
  moitiés : la version est **dite** quand on la connaît, et elle ne devient
  **jamais** une promesse (« pas détectée ici » reste, « branchée sur cette
  page » n'apparaît pas).
- ⚠️⚠️ **ET DEUX DE MES CONTRÔLES ÉTAIENT VERTS PAR ACCIDENT SUR LE CODE
  D'AVANT.** Ils cherchaient le numéro de version dans **TOUTE la page** — or
  « Télécharger l'extension 5.62.0 » y est déjà, et « · à jour » aussi. *Un
  contrôle vert par accident est pire qu'absent* (même famille que le `DIST`
  absolu des quatorze bancs). On découpe la **phrase** qui parle de la dernière
  capture et on juge dedans : **2 → 5 échecs** sur le code d'avant.


### « LA LECTURE DES BORDEREAUX PLUS VITE » — CE QUI SE MESURE SANS SUPPOSER
Même demande, même jour. **Relevé sur sa base le 16 septembre** :
`label_url_trouve` **25** contre `label_url_introuvable` **28** — l'URL manque
**une fois sur deux** — et **AUCUN compteur `label_via_*`** ni
`label_ko_statuts_*`, alors que le code les écrit sur le même chemin, sans
condition. ⇒ **Son extension est antérieure à celle qui les écrit** (confirmé
par `panel_diag_capture.ver` absent, la version que l'extension inscrit
elle-même depuis la 5.63). *On ne sait donc toujours pas quel chemin gagne, et
réordonner serait une supposition — ce que ce projet s'interdit.*
**Ce qui se mesure sans ça** : une vente dont le PDF n'est pas prêt faisait
`4 × (1 transaction + 3 chemins)` = **16 requêtes Vinted**, et reprenait **4 fois
le même échantillon de diagnostic** (12 aller-retours de `chrome.storage.local`).
⇒ La boucle d'insistance transmet ce qu'elle a appris : **13 requêtes** et
**3 écritures** de stockage. Les trois chemins restent essayés à chaque
tentative — c'est le PDF qu'on attend, pas eux.
⚠️⚠️ **ET MON PREMIER JET CASSAIT LE CAS QUI COMPTE** : je mettais la
transaction en cache **dans tous les cas** — or « Vinted n'expose pas encore
l'expédition » est justement celui où il FAUT la redemander (le service
d'expédition est en train de la créer). Les trois essais suivants relisaient la
même réponse vide. **C'est `audit-bordereau-rattrapage.cjs` qui l'a vu**, sur un
contrôle écrit bien avant : « on réessaie le temps que le PDF arrive ». On ne
garde la transaction **que si elle a répondu ce qu'on lui demandait**.
⚠️ **Le garde-fou « une requête à la fois » (§3) ne bouge pas** : ces trois
chemins vont chez **Vinted**. Les paralléliser serait exactement le signal
qu'on refuse depuis le début.
- `scripts/audit-recap-bordereau.cjs` exécute le VRAI `background.js` dans un
  `vm` : **10 contrôles, 5 rouges** sur le code d'avant — dont « deuxième
  passage, MÊMES offres : offres=**2** », la fenêtre qui revenait.
- ⚠️ **ET MON BANC SERVAIT UNE FORME QUE LE CODE NE LIT PAS** (§6.3, dans mon
  propre banc) : `rep(body, status)` appelé sans statut rendait
  `ok: undefined < 400` = **faux**, donc `sbGetTout` rendait `null` et je
  mesurais « aucune offre » sur un code intact.
- Extension en **5.65.0**, zip régénéré, `EXT_ATTENDUE` suivie. Aucune entrée
  d'`EXT_CAPACITES` : ce sont des corrections, pas des promesses neuves.


### ⚠️ « UN PETIT ONGLET EN BAS À DROITE » + RETRAIT DE « SHOP CANCALE »
Demande de Julien, 19 sept. : « un petit onglet tant que l'extension a pas tout
capté en bas à droite pour voir ce que j'ai à faire », et « supprime tout ce qui
concerne shop cancale dans l'extension et l'app ».

**L'onglet (`ResteAFaire`, monté sur la COQUE)** : petit bloc fixe en bas à
droite, qui LIT `extSait('_maj')` (le propriétaire de la version, §11 — compare
l'extension de CE navigateur à `EXT_ATTENDUE`) et ne dit QUE le mesurable :
- extension en retard → « à mettre à jour → {EXT_ATTENDUE} » + bouton Réglages ;
- extension absente ici → « pas détectée dans ce navigateur » + bouton Réglages ;
- **à jour → l'onglet DISPARAÎT** (pas de badge permanent qui a fini son travail) ;
- **téléphone** (`useSansSouris`) → muet (l'install est sur l'ordinateur, leçon
  iPhone : on ne harcèle pas un geste impossible) ; **base injoignable** →
  `BaseInjoignable` dit déjà la panne ; **premier jour** → `PremiersPas` dit déjà
  tout. On ne double aucune de ces voix (§7).
- ⚠️ **« Tout capté » n'est pas devinable côté app** (la capture vit dans la base
  de l'extension) : tant qu'elle n'est pas à jour elle ne capte pas tout — c'est
  CE geste-là, mesurable, que l'onglet porte. Le reste se branchera quand un
  signal de capture existera, **jamais avant** (on ne devine pas).
- `capacites.cjs` : onglet **présent** quand l'extension est en retard (nomme
  `EXT_ATTENDUE`), **absent** quand elle est à jour. 4 contrôles.

**Retrait de « shop cancale »** — mesuré d'abord (`grep`), 39 occurrences dont la
quasi-totalité en **commentaires** (le « pourquoi » d'une règle : `vanessa5723`
bloqué, « il revenait tout le temps ») et en fixtures de test. Le
**fonctionnel/visible** genericisé : tooltip du manifeste (`default_title` →
« VRM - Vinted Sync », le `name` l'était déjà), texte de l'app qui nommait
l'extension, nom du fichier de sauvegarde (`shop-cancale-backup-` → `vrm-backup-`),
titre du README.
- ⚠️ **PAS touché, et c'est VOULU** : `vrm_blocked_accounts` en base garde
  shop_cancale **hors capture** — la retirer le ferait « revenir tout le temps »
  (l'inverse de ce qu'il veut). Les commentaires d'historique restent (ils
  encodent le POURQUOI de règles de sécurité ; les retirer inviterait la
  régression). Le lien Vercel `shopcancale35-7638s-projects` est son **vrai**
  projet de déploiement (le toucher casserait le lien Réglages→env) ; le
  `.gs` Firebase est un script mort non livré. Les deux sont signalés, pas
  modifiés en douce.
- Extension en **5.85.0**, zip régénéré, `EXT_ATTENDUE` suivie. Aucune entrée
  d'`EXT_CAPACITES` : rien de neuf n'est promis.


### ⚠️ « CAPTER LE BORDEREAU DU BON COIN COMME SUR VINTED » — LE MOUCHARD DE CHEMINS PASSE À PARITÉ
Julien, 20 sept. (précision) : « oui je parle de capture **comme sur Vinted** ;
continue à améliorer. » Sur Vinted, VRM ne *génère* pas le bordereau : Vinted
l'émet après la vente, l'extension en capte le PDF. Le pendant Leboncoin est
identique — mais **je n'ai encore vu aucune vente ni aucun bordereau LBC**
(403), donc écrire l'analyseur maintenant serait deviner (§4.10/§6.3). *Faire
mesurer par ce qui y a accès* : ce qui débloque, c'est que sa prochaine vente LBC
soit **reconnaissable** dans ce que l'extension remonte.
**Mesuré, et c'était le trou** : le mouchard de chemins de `lbc-inject.js`
(`lbcpaths` → `lbc_recon.paths`) notait le chemin **nu** (`host/path`) — alors
que celui de Vinted (`inject.js`) note **méthode + statut**. Un bordereau est un
**PDF** ; un chemin nu ne se distingue pas d'un JSON de vente, et « 403 » ne se
lit pas comme « 200 ».
⇒ `noteSeen(url, méthode, statut, ctype)` note désormais **`MÉTHODE host/chemin
→ statut [type]`** — `[pdf]`/`[json]`/`[html]`/… — **jamais le corps, jamais la
query**, ids → `{id}` (la promesse de confidentialité ne bouge pas). Porté au
niveau transport (fetch **et** XHR), là où méthode et statut vivent. On garde
**Leboncoin**, plus **tout PDF** (un bordereau peut venir du transporteur) et
**tout échec ≥ 400** ; jamais le bruit publicitaire en 200/json, qui évincerait
les chemins qui servent (leçon du catalogue). Le jour d'une vente, un
`GET …/label… → 200 [pdf]` saute aux yeux, et la passe suivante câble la capture
du PDF, prouvée sur la vraie forme.
- **Aucune entrée d'`EXT_CAPACITES`** : c'est de la MESURE (lecture seule), l'app
  ne promet rien de neuf. Extension en **5.93.0**, zip régénéré, `EXT_ATTENDUE`
  suivie.
- `audit-lbc-catalogue.cjs` sert un `GET → 200 [pdf]` et un `→ 403` et exige
  qu'ils soient distinguables dans les chemins, que la méthode soit portée, que
  le bruit `adnxs` n'y entre pas, et qu'aucun id brut ne fuite. **4 rouges** sur
  le code d'avant (chemin nu, sans type ni statut).
- ⚠️ **Il ne peut toujours pas charger l'extension** : ça n'aide qu'une fois
  installée + une vraie vente LBC faite. L'app le dit déjà (diagnostic de
  version). Rien d'autre n'est promis ; « vendue ici → retire là » et la capture
  du bordereau restent gated sur cette mesure.


### ⚠️⚠️ « C'EST L'APPLICATION QUI CONTRÔLE L'EXTENSION » (2 octobre, 5.129)
Julien : « on ne gère plus dans l'extension mais dans l'application ; il faut
que l'extension soit allumée, sinon floute les boutons ; le bordereau est capté
par l'extension, les mails ne sont qu'une sécurité ; presque instantané dès que
je fais une vente. »
- ⚠️⚠️ **LE CANAL `exec` CONTOURNAIT TOUS LES GARDE-FOUS DU §3** (mesuré) : ni
  origine, ni compte connecté, ni plafond, ni méthode — un `DELETE
  /api/v2/items/{id}` serait parti. Désormais : origine de l'app, **liste
  blanche** (`POST …/conversations/{id}/replies` seulement), **`gardeStricte`**
  (le compte doit être CELUI du cookie Vinted — `garde` laisse passer un cookie
  illisible, une commande de l'app non), plafond 20/h. `audit-exec.cjs` : 6
  rouges sur le code d'avant.
- **Le pont est vivant** : `bridge.js` se tait quand il est orphelin
  (`chrome.runtime.id` absent — il annonçait « ready » pour toujours), l'app
  l'interroge toutes les 20 s (`etat`, **zéro requête Vinted**), trois états
  (`__vmrEtat` : `undefined` on vérifie · `null` muette · objet), et
  l'extension POUSSE (`evt` : étape de commande, bordereau rangé, ventes
  rafraîchies). Après une mise à jour, `reinjecterPont()` recharge bridge.js
  dans les onglets de l'app déjà ouverts.
- **`executerCommande`** (`cmd:'bordereau'`) : garde stricte → idempotence (PDF
  déjà rangé → « fait », 0 requête ; transaction qui a déjà son expédition →
  **pas de PUT**, la course du 28 sept. sortait en 400) → génération → PDF →
  `notifierApp`. L'état vit dans `chrome.storage.local.vrmCmds` (§4.9).
  **`avecVinted`** : une seule file pour TOUTES les actions Vinted (visite,
  commande, panneau, réponses, offres) — rien ne les sérialisait.
  `audit-commande.cjs` : 19 contrôles ; réaffaibli (garde laxiste + file
  retirée) → 5 rouges.
- **`BoutonBordereau`** (Ventes ET Colis, un seul composant) : imprime si le PDF
  est là (extension d'abord, email en secours), sinon commande ; GRISÉ et jamais
  caché, la raison commune dite UNE fois (`RaisonBordereauxGrises`), la raison
  propre à la vente (« Chrome est connecté sur X — bascule sur Y ») sur sa
  ligne. Plus de bouton de bordereau sur une vente expédiée ou finalisée.
  `bancs/pont.cjs` rejoue le vrai dialogue du pont dans 5 situations.
- ⚠️ Le bouton E1 de la veille ne connaissait que les EMAILS : **30 ventes en 30
  jours** avaient un PDF capté par l'extension et aucun email. `labelsCaptes`
  est désormais chargé sur Ventes aussi.
- ⚠️ `startBordereau` prenait `label_latest` (le dernier PDF du COMPTE) sans
  comparer sa transaction : avec deux ventes sur un compte, le N° d'une paire
  sur le bordereau de l'autre. Corrigé (tx exigée quand on la connaît).
- **Fraîcheur** : l'extension pousse « ventes rangées » → l'app relit CE compte ;
  sans extension (téléphone), sonde toutes les 60 s de `capturedAt` (< 1 Ko) ;
  à l'ouverture de Ventes/Colis/Ma journée, `cmd:'ventes'` fait relire ses
  ventes au compte du cookie (lecture, bornée à 90 s). ⚠️ Les ventes des
  comptes NON connectés dans Chrome n'arrivent qu'avec l'email ou quand il s'y
  connecte : mesuré, un seul jeton Vinted est vivant à la fois.


### ⚠️⚠️ « LE CODE DE RETRAIT EST DANS LA CONVERSATION — TU N'AS AUCUNE EXCUSE » (3 octobre, 5.145)
Julien, capture à l'appui : « rends-toi au point relais Phone Cash » (Mondial
Relay) montre le lieu ET le transporteur ; pour les Adidas Vinted Go et la paire
de Nike, « le code de retrait + le QR sont DIRECTEMENT dans la conversation
Vinted », avec un lien « scanne ton code de retrait ». L'app n'en montrait rien.
- **Mesuré dans le code** (le défaut, pas une opinion) : l'affichage était DÉJÀ
  complet — `relaisDe(o)` rend `{lieu, code, qr}` de `panel_colis_relais` et la
  carte montre déjà lieu, code, lien QR, compte. Le trou était **deux gardes trop
  étroites** côté extension, prouvé en exécutant le vrai parseur dans un `vm` :
  1. **`AT_RELAY`** (quelle commande fait ouvrir sa conversation) ne connaissait
     que « déposé en point relais / bureau de poste » → **Vinted Go (casier),
     « prêt à être retiré », « disponible »** étaient INVISIBLES, conversation
     jamais ouverte, code jamais capté. Élargi (casier/consigne/locker/Vinted Go,
     prêt-à-retirer, disponible+lieu), en EXCLUANT livré-domicile/finalisé/annulé/
     remboursé/retour. Lire une conversation de trop est une **lecture bornée sans
     risque** ; en manquer une fait **perdre un colis** — l'asymétrie penche vers
     l'élargissement. **Expression IDENTIQUE à `isAtRelayStatus` (app), §11** :
     `audit-coherence` les compare (0 désaccord), et elles doivent rester
     **mono-ligne** (le regex d'extraction n'avale pas les sauts de ligne).
  2. **`CONV_ARRIVE`** (quel message est une arrivée) n'acceptait que « ton colis
     est arrivé » / « t'attend à l'adresse » → « **rends-toi au point relais …** »
     et « **récupère-le au casier … scanne ton code de retrait** » étaient
     MANQUÉS. Élargi, avec `CONV_SORTANT` qui écarte EN PREMIER un colis qui PART
     (« dépose ton colis dans n'importe quel point relais » = ENVOI). Lieu étendu
     à « rends-toi au … » / « récupère-le au … », consigne « pour récupérer … »
     coupée. **On ne prend PAS « est disponible » seul** (un bordereau disponible
     n'est pas un retrait) : la garde reste l'extraction d'un code/lieu/qr, et le
     code garde `CODE_APRES` (« suivant » reste écarté).
- `audit-retrait-conv.cjs` : 3 cas de plus, **rouges sur le code d'avant**
  (rends-toi Phone Cash, Vinted Go casier, AT_RELAY élargi), verts après ; les
  gardes (envoi, côté vendeur, livré-domicile, « suivant ») tiennent, et le
  **§11 app==ext** est vérifié sur les mêmes statuts.
- **Aucune entrée d'`EXT_CAPACITES`** : l'affichage existait déjà, c'est la
  capture qu'on débloque — l'app ne promet rien de neuf. Extension **5.145.0**,
  zip régénéré, `EXT_ATTENDUE` suivie.
- ⚠️ **Non render-vérifié ici** (pas de fixtures dans ce conteneur) : le
  changement de `isAtRelayStatus` touche plusieurs écrans (Ma journée, Achats,
  tableau de bord). Il n'AJOUTE que des statuts clairement « à retirer » et
  n'en retire aucun ; le risque (un colis montré en trop) est bénin face au
  défaut corrigé (un colis jamais montré). À re-regarder au rendu dès qu'un banc
  a des fixtures.


### ⚠️ L'EMAIL VINTED GO ÉTAIT TAGUÉ « autre », PAS « Vinted Go » (4 octobre)
Julien a envoyé le vrai email Vinted Go (capture). Mesuré en exécutant
`parseCarrierEmail` + `detecterTransporteur` dessus : le **code (C49341), le suivi
(VGS…), le lieu (Consigne Vinted Go, Speed Queen - Vannes) et la date limite
(29/09)** s'extraient bien — mais `detecterTransporteur` rend **`autre`**, pas
`vinted`. Cause : l'email vient d'un `noreply@vinted.com` **nu** (ni `vintedgo.com`
ni `shipping@relay`) ; le narrowing `carrierSrc = mail.from` (posé pour ne pas
classer une VENTE Vinted par son corps) cache « Vinted Go », et l'email retombait
dans le filet `fromVinted` qui écrit `autre`. Conséquence : ligne
`email_track_autre_VGS…`, badge « Transporteur » au lieu de « Vinted Go », et pas
le mode de retrait Vinted Go dans l'app.
⇒ Dans ce filet (déjà gardé par un **sujet de colis**, `colis && !pasColis`), on
nomme `vinted` quand le sujet/corps dit « Vinted Go » **ou** porte un suivi `VGS…`.
Ça ne crée **aucune ligne** (on y était déjà) — ça corrige seulement le
transporteur, §11 (même carrier des deux côtés, sinon l'app n'affiche pas le bon
point de retrait). ⚠️ Ça n'ouvre pas la porte aux ventes : le filet exige un
sujet de colis, et « vente/offre/message/favori/bordereau » restent « pas un
colis » (vérifié au banc).
- `audit-transporteurs.cjs` : 2 cas du **vrai** email (`@vinted.com` nu + « Vinted
  Go » / suivi VGS) → **rouges sur le code d'avant** (`obtenu autre`), verts après ;
  `serveur.cjs` (la route exécutée) reste vert.
- Correction **serveur uniquement** (`api/email-inbound.js`) : pas de changement
  d'extension ni d'app, donc **pas de bump de version ni de zip**. §5 (note stale
  « Vinted Go : aucun email ») est désormais périmée — un vrai email existe et est
  capté. C'est le pendant **email** du fix conversation (5.145) : les deux voies
  surfacent maintenant C49341 + lieu + suivi.


### ⚠️ PURGE DES VIEUX BORDEREAUX — après vente finalisée (4 octobre, 5.146)
Julien : « 117 colis partis… au-delà de 2 semaines / après expédition tu peux
supprimer les bordereaux, ça ferait énormément d'économie. » Tranché par lui :
**« après vente finalisée ».** Un bordereau (PDF 100-200 Ko, le gros du
stockage/égress) sert jusqu'à l'envoi ; une vente **finalisée** (statut 450,
argent versé) est livrée depuis longtemps.
⇒ `purgeBordereaux()` (extension, à la visite Vinted, cooldown 12 h) retire les
**octets** du PDF (`pdfB64`, `pdfTamponneB64`) des `email_bord_{tx}` dont la vente
est finalisée, et **garde toute la métadonnée** (date, N°, suivi, transaction).
L'app liste les bordereaux par `meta->>filename` : vider `filename` sort la ligne
purgée de « à imprimer » — **aucun bouton « Imprimer » cassé, aucun changement
app**.
- ⚠️ **DESTRUCTIF → FAIL-SAFE PAR SENS, on SOUS-purge au moindre doute** :
  lecture ratée (`null`, `sbGetTout`/`sbGet`) ⇒ on ne purge RIEN ; on ne marque
  « purgé » QUE si on a trouvé de VRAIS octets (une forme inconnue ne perd rien
  et ne se dit pas purgée) ; **ceinture** : jamais un bordereau de moins de 7 j,
  même « finalisé ». Borné à 20/run.
- ⚠️ **Statut 450 = le même signal que la date de versement** (`capterDatesVersement`),
  fiable ; finalisé ⇒ livré ⇒ bordereau déjà utilisé. §3 ne s'applique pas (NOS
  lectures/écritures Supabase, pas des requêtes Vinted).
- `scripts/audit-purge-bordereaux.cjs` exécute le vrai `background.js` en `vm` :
  purge la vente finalisée (octets retirés, filename vidé, métadonnée gardée),
  **laisse** la non-finalisée · la trop-récente · la déjà-purgée · la sans-PDF,
  et **ne purge RIEN** sur une lecture ratée (ventes / liste / ligne). **§6.1 : 7
  rouges sur le code d'avant** (la fonction n'existe pas), 0 après.
- **Aucune entrée d'`EXT_CAPACITES`** : c'est du ménage interne, l'app ne promet
  rien de neuf. Extension **5.146.0**, zip régénéré, `EXT_ATTENDUE` suivie.


### ⚠️⚠️ `noterUrlLabel` EFFAÇAIT SA MESURE DE BORDEREAU SUR UNE LECTURE RATÉE (4 octobre, 5.147)
Suite de la passe fiabilité. `audit-fusion.cjs` énumérait les sites
lire-fusionner-réécrire **à la main** — et le dossier posait déjà la règle :
*« un banc qui énumère à la main ne couvre que ce qu'on a pensé à écrire »*. En
balayant TOUT `background.js`, un site manquait : `noterUrlLabel`
(ligne `panel_label_urls`), qui ACCUMULE une observation par chemin Vinted de
bordereau — **la mesure même que le dossier dit « remise à zéro sans cause
trouvée »** (§« capture de bordereau »). Elle lisait
`const cur = (rows && rows[0] && rows[0].data) || {}` **sans** garde `=== null`,
quand tous ses frères (panel_offer_statuts, seen_urls, colis_relais, item_details,
listing_dates, msg_repondus, lbc_recon, ebay_form…) l'ont. Un timeout de lecture,
la base debout, la réécrivait avec **la seule URL du moment** — tous les chemins
appris, effacés. C'est très probablement la cause de la « remise à zéro ».
⇒ Garde posée (`if (rows === null) return;`). `audit-fusion.cjs` porte désormais
`panel_label_urls` dans sa liste de CAS — **§6.1 : rouge sur le code d'avant**
(« la ligne est réécrite depuis une lecture ratée »), vert après, les deux sens
vérifiés. Extension **5.147.0**, zip régénéré, `EXT_ATTENDUE` suivie.
- **Reste constaté, laissé tel quel (pas la même famille)** : `storeReleve` écrit
  une ligne FRAÎCHE complète (pas une fusion de clés accumulées) ; sur lecture
  ratée de sa sonde `nLignes`, il saute seulement la garde « capture plus riche »
  (§4.2) et réécrit — mineur et auto-réparant à la capture suivante, pas une
  perte de données accumulées. Ne pas « durcir » au risque de bloquer une
  écriture légitime.


### PDF de bordereaux — étape 0 : un seul lecteur, trois états, 5.157 (4 octobre)
Préalable au passage des PDF dans le stockage de fichiers (plan complet dans
la cartographie du 4 octobre, résumée ici). **Mesuré sur sa vraie base** :
~38 Mo de PDF dans le JSONB (`email_bord_*` 179 lignes dont 161 portent
`pdfB64` **et** `pdfTamponneB64` ; `harvest_*_label_{tx}` 95 lignes, 19 Mo ;
`label_latest` 8 lignes, toutes des doublons octet pour octet d'un
`label_{tx}`). **108 bordereaux de ventes finalisées sont purgeables et 0 l'a
été : son extension installée est la 5.128** (`panel_diag_capture.ver`), la
purge est arrivée en 5.146. *Le premier geste reste d'installer le zip.*
- **Un seul lecteur d'octets** (`lirePdfLigne`, `octetsBordereau`) pour les sept
  endroits qui impriment : il ne demande que `pdfB64` (la copie tamponnée par
  le serveur, `pdfTamponneB64`, n'est lue par personne — elle doublait l'égress
  de chaque impression d'un PDF venu par email), vérifie `%PDF`, et rend
  **trois états** : octets · absent · `null` (la base n'a pas répondu). Avant,
  « pas su » et « pas de PDF » donnaient le même « PDF illisible », et une page
  HTML rangée par erreur faisait remonter l'erreur brute de pdf-lib.
- Plus aucun `select=data` sur une ligne de bordereau ou de reçu dans l'app
  (`fetchCapturedLabel`, `fetchCapturedReceipt` lisent des scalaires d'abord) ;
  les reçus du bilan annuel ne téléchargent leur PDF qu'au clic, les comptes
  sont lus ensemble, et une lecture ratée ne s'affiche pas « aucun reçu ».
- Un lot imprimé en partie le DIT (« 7 sur 9 imprimés — 2 que la base n'a pas
  rendus »), jamais comme complet (§5).
- **Extension 5.157** : les trois portes de capture (`recupererLabel`,
  `capterTelechargement`, `inject.js`) vérifient les **octets** `%PDF`, plus
  seulement l'en-tête — une page de session expirée servie en
  `application/pdf` passait `_pdf` à vrai, et `labelDejaRange` ne redemandait
  plus jamais le vrai bordereau. `storeLabel`/`storeReceipt` ne disent plus
  « capté » sur une écriture refusée, et `storeLabel` ne lit plus la ligne
  `orders_sold` entière (§4.4).
- Preuves : `ventes-bordereau.cjs` **4 rouges** sur l'avant (copie tamponnée
  rapatriée aux deux tailles, « PDF illisible » sur une panne, erreur pdf-lib
  sur une page HTML) ; `audit-lectures.cjs` **4** ; `audit-bordereau-pdf.cjs`
  **3** ; `audit-recap-bordereau.cjs` **2**.
- ⚠️ Deux audits servaient « un PDF » de **4 octets** (`%PDF`) : le contrôle
  accepte donc ≥ 4 octets — un vrai PDF en a toujours plus.
- **La suite (non faite, chacune sa PR)** : compartiment `bordereaux` privé +
  règle `_pdf` élargie à `pdfPath` (migration 009) ; l'app lit les deux formes ;
  le serveur puis l'extension rangent dans le stockage
  (`{owner}/{famille}/{sha256}.pdf`, objet écrit AVANT la ligne) ; rattrapage
  en deux phases, la seconde (vider la colonne) **sur un oui de Julien**.
  **Tranché par Julien le 4 octobre au soir** (« je te donne toutes les
  autorisations ») : les `harvest_*_label_{tx}` des ventes finalisées sont
  purgés (5.158, ci-dessous) et les tables `sauvegarde.app_data_2026093{0}` /
  `_20261002` (~76 Mo de PDF) peuvent partir — ⚠️ mais un `DROP` exige une
  confirmation HUMAINE dans l'outil SQL : **il reste à faire, avec lui devant
  l'écran**, jamais en tâche de fond.
  ⚠️ Les mesures de l'étape « stockage » (doublon, 400 vs 404, CORS) se font sur
  une branche Supabase ou en local, **jamais en production** (§2.3).


### Purge des bordereaux CAPTÉS par l'extension — ventes finalisées (5 octobre, 5.158)
Suite de la purge des `email_bord_*` (5.146) : les `harvest_{uid}_label_{tx}`
(et le « dernier capté » `label_latest`, une copie) gardaient leur PDF pour
toujours — mesuré : **55 lignes de ventes finalisées, 10,8 Mo**. Autorisé par
Julien le 4 octobre. `purgeBordereaux` les allège dans le même passage, avec les
mêmes ceintures et deux de plus :
- on ne liste que les lignes qui portent **encore** un PDF
  (`meta->>_pdf=eq.true`, posé par la base) — une ligne purgée ne revient jamais ;
- la vente doit être **finalisée** (450) **et** la capture **datée et vieille de
  7 jours** — sans date lisible, on garde ;
- la transaction se lit **dans l'identifiant** de la ligne ; si `meta->>tx` en
  dit une autre, doute → on garde. `label_latest` sans transaction : on garde ;
- on retire `pdfB64` et rien d'autre : `tx`, `item`, `url`, `capturedAt`
  restent — l'app relie toujours la paire (`labelsCaptes[tx].item`) et
  `venteExpediee` voit toujours la preuve ;
- lecture ratée (ventes, liste, ligne) ⇒ rien n'est touché ;
- 20 par passage ; s'il en reste, le passage suivant vient **dans l'heure**
  (sinon 12 h) — l'arriéré se résorbe en une journée de visites.
Côté app rien ne change : une vente finalisée n'est jamais `aExpedier`, elle n'a
donc plus de bouton de bordereau ; et si un PDF purgé était quand même demandé,
`lirePdfLigne` répond « absent » et l'écran le dit (étape 0).
- `audit-purge-bordereaux.cjs` : **29 contrôles** ; **4 rouges** sur la 5.157 ;
  chacune des trois gardes retirée tour à tour le fait repasser au rouge.
- Aucune entrée d'`EXT_CAPACITES` (ménage interne). Extension **5.158.0**, zip
  régénéré, `EXT_ATTENDUE` suivie.


### ⚠️⚠️ « JE NE PEUX PAS APPUYER SUR LE BORDEREAU, ÇA MET QUE L'EXTENSION NE RÉPOND PAS » (5 octobre, 5.160)
Une vente à expédier, l'extension allumée, et le bouton grisé. **Trois causes,
mesurées, et aucune n'était « l'extension est éteinte »** :
1. ⚠️⚠️ **UN PONT ORPHELIN RÉPONDAIT « RIEN » PLUS VITE QUE LE PONT VIVANT.**
   Après une mise à jour (ou un rechargement) de l'extension, l'ancien
   `bridge.js` reste dans la page VRM, sans service worker derrière lui. Il
   répondait `resp: null` **tout de suite** ; `reinjecterPont` remet bien un
   pont neuf dans la page, mais l'app prenait la **première** réponse et
   concluait « muette » pour de bon. Pareil pour `exec`, `photo`, `pdfLbc`,
   `authEtat` (`sendMessage` lève sur un orphelin, le `catch` répondait une
   erreur). ⇒ Deux moitiés : l'**app** n'écoute plus une réponse vide (grâce de
   1,5 s pour qu'un pont vivant réponde — ça protège aussi les extensions déjà
   installées), et le **pont 5.160** orphelin se tait sur TOUT et retire son
   écouteur ; un seul pont vivant par monde isolé (`globalThis.__vrmPontVivant`
   — deux ponts vivants relaieraient une réponse à un acheteur deux fois).
2. **2,5 s pour répondre, et « muette » au premier raté.** Au réveil, le service
   worker sondait la base et renouvelait sa session AVANT de répondre (plusieurs
   secondes quand Supabase traîne). ⇒ L'app attend 6 s, relance à 3 s, et seul
   le **deuxième** raté d'affilée vaut « muette » ; un `ready` relance la
   vérification. L'extension 5.160 répond **sans réseau** (`authEtatRapide`,
   `loginDe` servi périmé et rafraîchi en fond, cloisonnement rangé) — moins de
   300 ms même si tout le réseau pend (`audit-pont-session.cjs`).
3. ⚠️⚠️ **L'APP ET L'EXTENSION PARTAGEAIENT LA MÊME FAMILLE DE JETONS.** L'app
   envoyait SON jeton de renouvellement à chaque changement et à chaque
   `ready`. Avec la rotation de Supabase, celle qui renouvelle en second
   présente un jeton consommé : journaux d'auth de la production le 5 octobre,
   `refresh_token_already_used` puis une rafale de **429** (l'extension
   renouvelait sans « un seul en vol » ni pause). ⇒ L'extension reçoit **SA**
   session : `POST /api/compte?mode=session-extension` fabrique, pour le MÊME
   vendeur, un lien magique côté serveur (aucun email) aussitôt échangé —
   autre `session_id`, autre famille. Prouvé sur un GoTrue v2.197 **local**
   (`audit-session-extension.cjs --local`, jamais la production). L'app ne la
   donne que **quand il faut** (pas de session, session morte, autre compte) ;
   une extension déjà connectée ne reçoit RIEN. L'adresse vient de
   `/auth/v1/user`, jamais de la requête ; identité vérifiée deux fois ;
   `hashed_token`, `email_otp`, `action_link` ne sortent jamais ; frein doux
   6/h par vendeur. ⚠️ Effet de bord mesuré : générer un lien magique invalide
   un lien de réinitialisation de mot de passe encore en attente.
   ⚠️ Le repli d'avant (notre propre session) ne sert plus qu'à **amorcer** une
   extension qui n'a aucune session quand le serveur ne sait pas en fabriquer
   une (404/405/503) — jamais pour remplacer une session morte, c'est
   exactement le cas qui s'entre-tuait.
- Extension 5.160 : renouvellement **un seul en vol** ; refus définitif (400-404
  + code d'auth) ⇒ session marquée `mort`, plus aucune requête tant qu'une
  NOUVELLE session n'arrive ; 429/5xx/réseau ⇒ pause 30 s → 10 min rangée dans
  `chrome.storage.local` (§4.9). `isCloisonne` à **trois états** (il mémorisait
  `false` sur un simple 502 : toutes les captures partaient sans propriétaire
  pour la vie du service worker), même règle que `baseCloisonnee` du serveur.
- ⚠️⚠️ **TROUVÉ AU PASSAGE : « PUBLIER SUR LEBONCOIN » DEPUIS L'APP ÉTAIT REFUSÉ
  DEPUIS LA 5.130.** Le relais des commandes recopiait `cmd, uid, tx, jobId` :
  `id`, `etat`, `limit` et `plan` n'arrivaient **jamais** au service worker
  (« annonce inconnue »). Aucun banc ne passait par le pont — ils parlaient au
  service worker directement. C'est `content.js` (5.80) refait : *un raccord
  qui énumère ne transporte que ce qu'on a pensé à écrire*. Le pont relaie la
  commande entière ; `from`/`action` restent posés par lui. 3 rouges avant.
- Muette ⇒ bouton **« Recharger la page »** ; chaque vente grisée par
  l'extension propose son repli **« sur Vinted ↗ »** (la conversation de la
  vente) — le PDF remonte ensuite par l'email de Vinted. Pas sur une vente
  grisée pour une raison de COMPTE : là le geste est de basculer.
- **L'indicateur demandé par Julien** (« je veux savoir si je peux faire des
  actions ou si c'est de la lecture ») : une pastille dans l'en-tête,
  **« Actions possibles · {compte Vinted} »** / **« Lecture seule »** /
  « Vérification… », et un panneau : extension, compte VRM, compte Vinted
  ouvert dans Chrome, et LE geste qui débloque ; en lecture seule il dit ce qui
  marche quand même (données, colis à retirer, bordereaux déjà reçus). Une
  seule règle (`raisonExtGlobale`) + le cookie Vinted. Elle **remplace** le petit
  onglet « Extension à mettre à jour » (deux voix, §7) ; une extension capable
  de commandes mais pas à jour le dit dans la ligne « Extension ».
  Couleur seulement s'il y a un geste ICI (sur téléphone, la lecture seule est
  normale, le point reste gris).
- Preuves : banc `pont.cjs` **19 rouges** sur le build d'avant (orphelin,
  réponse lente, session, indicateur), tout vert après ;
  `audit-pont-session.cjs` **29 rouges** sur l'extension d'avant, 41 verts ;
  `audit-session-extension.cjs` **29 rouges** sur la route d'avant.
- ⚠️ **VINGT-SEPTIÈME cri au loup** : `audit-bordereau-pdf.cjs` exigeait
  l'orthographe `member/transactions/` près de `genere_sans_pdf` ; le lien passe
  maintenant par une variable. Il suit la variable jusqu'à sa définition — et
  repasse au rouge quand on y retire l'adresse Vinted (prouvé).
- ⚠️ **Le chantier PDF→stockage avait réservé la 5.160** : il passera en **5.165**
  (5.161 = suite de la revue ci-dessous, 5.162 = défauts d'extension mesurés,
  5.163 = la fusion du 8 octobre, 5.164 = « Tout générer » borné, 9 octobre).
- **Revue contradictoire (26 constats, 5 octobre au soir)** — corrigé en 5.161 et
  dans l'app, chacun prouvé rouge sur e50cd28 :
  - ⚠️⚠️ **Une extension < 5.129 passait « muette » au bout de 15 s** (elle ne
    connaît pas « état ») : « recharge la page », éternellement, à quelqu'un qui
    devait METTRE À JOUR. « En retard » passe avant « muette », et un pont trop
    ancien n'est plus questionné (il garde la session d'avant, à défaut).
  - ⚠️⚠️ **La grâce de 1,5 s pouvait faire envoyer une réponse DEUX fois** : une
    erreur d'orphelin rendue pendant que le pont vivant ENVOIE → « échec » →
    il renvoie. Une COMMANDE et un ENVOI attendent l'échéance ; la grâce ne
    vaut que pour une lecture.
  - **Séparation d'avance** d'une extension qui a encore la famille de jetons
    de l'app (une fois par appareil et par compte : `vrm_ext_separee_{uid}` —
    pas une migration de données, au pire une séparation de plus) ; « autre
    compte » tranché par l'onglet au premier plan (deux onglets se la
    renvoyaient) ; rien n'est envoyé si le compte a changé pendant l'attente.
  - **Une paire ne part plus deux fois sur Leboncoin** : avec le relais complet,
    un double clic ouvrait deux dépôts (et Leboncoin publie seul). Verrou par
    paire posé AVANT toute attente + dépôt de moins de 15 min refusé (audit :
    3 dépôts pour 3 clics avant, 1 après).
  - « Pas su » ne vaut plus ✓ (session VRM inconnue, renouvellement en cours,
    cookie Vinted pas lu à temps : `vintedPasSu`, 5.161) ; l'indicateur ne
    promet que les capacités INSTALLÉES ; plus de promesse « le PDF remonte
    avec l'email » (elle dépend de la réception de chaque vendeur).
  - Laissé tel quel, noté : un « Se déconnecter » volontaire dans la fenêtre
    de l'extension est réparé par l'app au battement suivant (c'est la page
    connectée qui décide) — pour la déconnecter, se déconnecter de VRM.



### La route des emails exige sa clé, et le script Gmail ne lit plus la base (4 octobre)
Deux trous mesurés : (1) `EMAIL_INBOUND_SECRET` n'était pas posée — n'importe
qui pouvait envoyer une fausse vente ou un faux bordereau, **rangés comme les
vrais** (prouvé sur le code d'avant : un POST quelconque était écrit en base) ;
(2) le script Gmail lisait la base **directement avec la clé publique** — depuis
le cloisonnement elle ne lit plus rien (RLS rend `[]` sans erreur), donc la date
de départ retombait sur sa valeur de secours et **aucune facture ne pouvait
partir**, en silence.
- `api/email-inbound` a trois modes pour le script, **tous derrière la clé** :
  `?mode=config` (date de départ), `?mode=factures` (factures EN ATTENTE avec un
  email d'acheteur), `?mode=facture-envoyee` (POST, ne vise que
  `email_invoice_*`, relit puis réécrit la ligne ENTIÈRE). Le vendeur est celui
  de l'installation (`VRM_OWNER_UID`). ⚠️ Ces modes rendent des données
  personnelles : **sans clé posée sur le serveur, ils refusent (503)** — jamais
  ouverts par défaut. Lecture ratée ⇒ 503, jamais « aucune facture ».
- La clé se compare en temps constant (`cleValide`). L'arrivée d'un email sans
  clé reste acceptée **tant que la variable n'est pas posée** : sinon les emails
  s'arrêteraient le jour du changement.
- `scripts/gmail-forwarder.gs` ne contient plus aucune clé de base ; `SECRET`
  reste **vide dans le dépôt (public)**, il la colle chez lui.
- **L'ordre des gestes** : il colle le nouveau script avec la clé → la route
  journalise « script Gmail à jour (clé fournie) » → on pose
  `EMAIL_INBOUND_SECRET` sur Vercel et on redéploie. Dans l'autre ordre rien ne
  se perd non plus : un email refusé (401) n'est pas étiqueté, le script le
  renverra.
- `audit-email-cle.cjs` **exécute la route** : 20 contrôles, **18 rouges** sur
  le code d'avant.


### ⚠️⚠️ « TOUT GÉNÉRER » CONTOURNAIT LE PLAFOND PAR VISITE (revue du 9 octobre)
Revue de « Tout générer » (#462), du bordereau de retour (#460) et de l'état de
l'extension (#457) après la fusion du 8 octobre. Chaque défaut REPRODUIT d'abord
(vrai `background.js` dans un `vm`, rendu du build de e6bda5c) :
- ⚠️⚠️ **Un clic « Tout générer (20) » = 20 PUT chez Vinted et les 20 actions de
  l'heure** (jusqu'à 300 requêtes quand les PDF tardent) ; une réponse à un
  acheteur était ensuite refusée une heure. Une visite s'arrête à 6 (§3).
  ⇒ **L'extension juge** : au plus `BORD_MAX_PAR_VISITE` (6) bordereaux commandés
  par l'app par compte et par 5 min (`vrmBordCmds`, refus `lot` avec l'heure de
  la suite), et ces commandes s'arrêtent à 15 actions/h (`RESERVE_GESTES` = 5
  gardées pour répondre/trancher, refus `plafond-bordereaux`). L'admission est
  sérialisée. **L'app** ne lance que ce qu'elle annonce : `BORD_LOT_MAX` = 6 par
  clic (« Générer 6 bordereaux (sur 8) »), égal à la borne de l'extension (§11,
  vérifié). Le total reste 20/h — ne pas le monter.
- **Le refus était jeté** (« 0 lancé · 3 refusés. Chaque colis montre sa
  progression » — rien ne la montrait). Le bilan garde chaque raison, la dit UNE
  fois, s'arrête au premier refus qui vaut pour tout le lot (pause, plafond,
  `lot`, autre compte…), et « chaque ligne suit le sien » n'est écrit que si un
  bordereau est parti.
- **La pause demandée par Vinted se voit avant le clic** : l'état du pont porte
  `pause.jusqua` ; `raisonExtGlobale` rend `pause` (sauf pour publier, qui ne va
  pas chez Vinted) — pastille « Lecture seule », bouton grisé, sans couleur
  (rien à faire). Une extension plus ancienne ne la dit pas : le refus au clic,
  lui, la dit.
- **Base lente ⇒ « refusé » pour un bordereau généré** : la liste des comptes et
  « PDF déjà rangé ? » retenaient l'accusé sans délai. Bornées (4 s / 1,5 s) ;
  comptes illisibles ⇒ refus `lecture` dit (`getStoredAccounts({ouNull:true})`),
  plus « compte introuvable ». Côté app, **pas de réponse ≠ refus** : « je ne
  sais pas, regarde sa ligne », et le bilan passe à « lancé » dès qu'un
  évènement de CE colis arrive (bouton par colis compris).
- **File longue** : un colis en file depuis 120 s était réaccepté (7 actions pour
  4 colis). La file en mémoire fait foi (`BORD_EN_COURS`) ; l'état dit `vivant`
  pour ce qui y est réellement, l'app garde « En file… » tant que c'est vrai
  (`jobEnCours`), et « Tout générer » saute ces colis. Un service worker
  redémarré : plus `vivant`, le clic relance pour de vrai.
- **§7** : la raison d'un « Tout générer » grisé n'est plus écrite sous le bouton
  (le bandeau `RaisonBordereauxGrises` la dit) ; « À mettre à jour en X » n'est
  plus dit là où le pont a mesuré CE navigateur, et ne nomme que ce qui manque à
  la version vue (`capacitesManquantes`, tiré d'`EXT_CAPACITES`) ; « publier sur
  Leboncoin reste possible » seulement si `extSait('publication') === 'ok'`.
- **Achat en litige à renvoyer** (`ACHAT_A_RENVOYER`, une règle) : bloc en tête
  d'Achats sur les onglets du quotidien (lien de retour une fois) et ligne de Ma
  journée qui nomme le compte. Il ne revient pas dans « En route ».
- Preuves : `audit-tout-generer.cjs` (20 contrôles, **11 rouges** sur e6bda5c ;
  la borne app = extension, rouge sous mutation) ; banc `tout-generer.cjs`
  (port 5710, données inventées, deux tailles : **30 rouges** sur le build de
  e6bda5c, 0 après). `audit-statuts.cjs` charge `ACHAT_A_RENVOYER`.
- Extension **5.164.0** (montée à la fusion du 9 octobre), zip régénéré,
  `EXT_ATTENDUE` suivie. Aucune entrée d'`EXT_CAPACITES` : l'app détecte `pause`
  et `vivant` à leur présence, et ne promet rien à une extension qui ne les a pas.


### ⚠️⚠️ REVUE DE LA 5.165 : DIX DÉFAUTS REPRODUITS, DONT UN RELAIS SERVEUR QUE LES SUPPRESSIONS RÉVEILLAIENT (11 octobre, 5.166)
Revue contradictoire de 4a29202 : chaque défaut REPRODUIT d'abord (vrai
`background.js` dans un `vm` à horloge pilotée, app rendue sur données
inventées), corrigé, puis rouge sur 4a29202 et sous mutation.
**Remesuré le 11 octobre** (lecture seule) : `panel_diag_capture.ver` = 5.164.0 ;
**tomj683 et arthuror2 toujours lus le 8 octobre 22:30** (16 annonces « en
ligne ») ; aucune ligne `harvest_*_supprimees` (la 5.165 n'a jamais été
installée) ; `visite_en_pause` 30, `vinted_frein_403` 1, des `ecriture_ratee_*`
qui arrivent pour de vrai (`orders_sold` 18, `inbox` 17, `profile` 12).
1. ⚠️⚠️ **Chaque « maj · annonces » faisait lire Vinted PAR LE SERVEUR.** L'écran
   Annonces et le calcul de la coque relisaient tout à chaque signal (une par
   suppression rangée) ; pour un compte lié SANS ligne moissonnée, ces lectures
   retombaient sur `/api/vinted-proxy` — Vinted lu depuis l'IP de Vercel, au nom
   d'un AUTRE compte : **0 appel avant la 5.165, 24 après 6 suppressions (48
   quand ventes et boîte manquent)**. ⇒ Une relecture sur signal ne lit QUE la
   moisson (`moissonSeule` : pas de ligne ⇒ on garde ce qu'on montrait, jamais
   un faux « 0 »), seulement les comptes signalés ; les signaux se regroupent
   (`regrouperSignaux` : 300 ms pour cueillir une rafale, puis au plus une
   relecture / 5 s, la dernière jamais perdue) ; la coque ne recompte que les
   annonces (ventes et boîte reprises de la dernière lecture complète). Une
   lecture d'ouverture en cours au moment du signal est suivie d'une relecture.
   Banc `signal-annonces.cjs` : **9 rouges** sur 4a29202, 2 mutations rouges.
   ⚠️ Les 7 appels du relais **au chargement** (compte jamais visité) existaient
   avant la 5.165 et restent : seul le signal est corrigé.
2. ⚠️⚠️ **La garde des 5 min était rendue à 60 s sur CHAQUE échec**, durable
   compris : base en panne (522) ou écritures refusées (RLS 403/42501) ⇒ une
   moisson complète par minute de navigation, toutes jetées — **30 moissons
   (240 requêtes Vinted) en 30 min, contre 6 avant la 5.165**. Et l'alarme des
   20 min et le changement de cookie appellent `runActive` SANS la garde.
   ⇒ **Recul de la base** (`vrmReculBase`, `chrome.storage.local`) : une moisson
   ou des ventes dont TOUTES les écritures sont refusées le posent — 1, 5, 10,
   20, 40, 60 min — et il vaut pour `runActive` (toutes les voies) et la visite
   (ventes, moisson, lecteurs). Il tombe dès qu'une ligne de CAPTURE
   (`harvest_{uid}_profile|listings|orders_*|inbox|billing`) est écrite —
   jamais une ligne de diagnostic. Le premier palier (1 min) garde le hoquet.
   ⇒ **Échec passager** (Vinted 401, page qui navigue) : la garde n'est rendue
   qu'UNE fois (`vrmVisiteEchecs`), ensuite les 5 min entières. Mesuré après :
   **0 moisson et 4 requêtes Vinted en 30 min** de panne ou de RLS.
3. ⚠️⚠️ **Le repli par cookie (`activeFetchActiveAccount`) rangeait B sous A** —
   profil, dressing, ventes — s'il changeait de compte en route ; et, B venant
   d'être VIDÉ, le dressing complet et vide de B **effaçait les 61 annonces de
   A** (`dressingCompletFaitFoi`, 5.165), puis la garde passive, trompée par le
   profil de B rangé sous A, refusait le dressing de A. ⇒ Le compte du cookie
   est relu avant CHAQUE rangement (écart ⇒ plus rien, `moisson_compte_change`) ;
   le profil rendu doit être celui qu'on a rangé (`profilIdRange` : connu et
   différent ⇒ rien ; pas su ⇒ `base`, rien) ; même contrôle de profil dans la
   moisson de la page.
4. **§4.2 : un compteur `nItems` illisible valait « on écrit »** — la page 1 du
   dressing (20 sur 61) écrasait la liste complète, avec un `capturedAt`
   rajeuni. `listePlusRiche` a trois états (`null` = pas su ⇒ on n'écrit pas,
   `ignore_partiel_lecture_ratee`) ; la moisson le compte comme un ÉCHEC
   (`lecture-ratee`), pas comme « lu, plus pauvre ».
   ⇒ `audit-moisson-dressing.cjs` : **33 contrôles, 10 rouges** sur 4a29202
   (§9 à §11 : RLS, panne, alarme, 401 répété, trois bascules, compteur
   illisible), et 5 mutations nouvelles rouges (`durable`, `recul`, `cookie`,
   `lecturepassu`, `garde` réécrite). ⚠️ Le banc PILOTE l'horloge du service
   worker (`m.avance(ms)`) : reculer la seule marque de garde ne simulait plus
   le temps dès qu'il existe un recul. §2 juge la MOISSON seule (les ventes
   rapides ont leur propre garde, pré-posée).
5. **§11 : l'écran Annonces datait le dressing par `harvestTs` (repli sur
   `updated_at`, qui ment), les trois autres lecteurs par `capturedAt`** — la
   même ligne rendait deux listes. ⇒ `dateLectureDressing` dans le bloc
   `<supprimees-regle>` des DEUX côtés, utilisée par `fetchHarvestBrut` (filtre
   ET date dite à l'écran), `retirerSupprimeesLignes` (app, extension) et
   `capterPhotosAnnonces`. `audit-supprimees` §7 exécute le VRAI
   `fetchHarvestBrut` et compare la SORTIE des quatre lecteurs sur une ligne
   sans `capturedAt` : 2 rouges sur 4a29202, mutation `datepropre` rouge.
6. **« ✓ Données Vinted à jour » au-dessus de « annonces lues hier »**, sur
   Vinted → Annonces : deux sources, une notion. La coche (âge des VENTES
   captées) dit désormais « Ventes Vinted à jour » et ne s'affiche pas au-dessus
   de la section Annonces ; elle reste sur Ventes (l'autre sens est vérifié).
7. **« a, b, c et 3 autres »** cachait sur quel compte repasser, et 30 min
   nommait ses 7 comptes à chaque ouverture (bruit permanent, §7). ⇒ Tous
   nommés, chacun avec son heure ; seuil **12 h**, ou **vu actif après la
   lecture** (ses ventes rangées plus de 10 min après son dressing : il est
   passé dessus et le dressing n'a pas été relu).
8. **Sur iPhone**, la phrase disait « ouvre vinted.fr … dans Chrome » : sans
   extension ici (`absente` ou `useSansSouris`), elle dit « sur l'ordinateur où
   l'extension VRM est installée ».
9. **« 3 annonces supprimées » pour une carte partie** : les pauses et les
   brouillons supprimés comptaient. `retirerSupprimees` garde les annonces
   retirées (`_vrmRetirees`) ; le compteur ne prend que `isOnlineListing`.
10. **« Une suppression … sort d'ici tout de suite » était fausse** dans un
   onglet Vinted ouvert AVANT la mise à jour (l'ancien `inject.js` y reste :
   mesuré par un relecteur dans Chromium, 0 suppression vue avant le
   rechargement) et à DEUX extensions (l'ancienne patche la page). ⇒ Promise
   seulement si l'extension de ce Chrome le sait ET est seule, avec le geste :
   « recharge d'abord les onglets Vinted ouverts avant la dernière mise à
   jour ». À deux : « tant qu'il en reste deux, une suppression peut ne pas
   être vue ».
   ⇒ Banc `supprimees.cjs` §8 à §13 : **12 rouges** sur le build de 4a29202 ;
   6 mutations (compteur, seuil, promesse, ailleurs, coche, activité).
- `audit-extension-zip` vérifie maintenant le CONTENU : chaque fichier du zip
  octet pour octet celui de la source (le zip de la 5.166 a porté la bonne
  version et un `background.js` périmé entre deux commits — rouge, il le nomme).
- Extension **5.166.0**, zip régénéré, `EXT_ATTENDUE` suivie. Aucune entrée
  d'`EXT_CAPACITES` : corrections, rien de neuf n'est promis.
- ⚠️ **Non fait, à savoir** : l'extension ne prévient pas les onglets Vinted
  déjà ouverts à l'installation (réinjecter `inject.js` dans une page qui a
  déjà l'ancien patcherait deux fois) — la phrase de l'app porte le geste.
  **Non mesuré** : la durée réelle d'une panne de RLS chez lui (le recul plafonne
  à 60 min) ; le comportement du recul sur sa vraie base (aucune extension
  ≥ 5.165 n'y a jamais tourné).
- **Geste de Julien** : installer la **5.166** dans UN seul dossier, recharger
  ses onglets Vinted, puis passer une fois sur **tomj683** et **arthuror2**.


### ⚠️⚠️ « JE N'AI PLUS LES PHOTOS DE MES PAIRES » — L'AFFICHAGE HORS DE VINTED.FR (11 octobre)
Julien : plus aucune photo dans VRM (Annonces, Ventes, Colis/bordereaux…).
**Mesuré avant de coder** : les données sont intactes (`photo.url` =
`https://images1.vinted.net/t/…/f800/….jpeg?s=…`, captures du jour) et le code
d'affichage n'avait pas changé dans le déploiement. La cause est donc
**extérieure et pas prouvée** : le CDN de Vinted qui refuse l'affichage hors de
son site (CORP, ou anti-hotlink sur le référent), ou un logiciel de protection.
- **Une règle, un composant** (`src/photosVinted.js` + `PhotoVinted`, §11) :
  les **49** `<img>` qui PEUVENT montrer une photo Vinted passent par lui ; toute
  autre adresse reste un `<img>` ordinaire (logos, QR de retrait, carte, photo
  de la pièce). `audit-photos-vinted.cjs` le garde dans le temps : tout `<img>`
  de `src/` est dans `PhotoVinted` ou dans une **liste FERMÉE** de sources qui
  ne peuvent pas être une photo Vinted, chacune avec sa raison — une source
  inconnue est rouge (un `<img src={orderPhoto(o)}>` remis sur Achats le serait).
  Dans l'ordre :
  1. `referrerPolicy="no-referrer"` — une protection par référent s'arrête là
     (banc, scénario D, Chromium en émulation iPhone — pas Safari) ;
  2. si le navigateur refuse quand même, **l'extension** va chercher les octets
     par le pont « photo » (présent depuis très longtemps : **rien à changer
     dans l'extension**). **Mesuré par la relecture avec la vraie extension** :
     la requête de son service worker part sans référent, sans `Origin`, sans
     cookie, et CORP ne s'y applique pas — les octets reviennent → URL objet,
     **uniquement jpeg/png/webp/gif/avif** (un SVG en URL objet ouvert dans un
     onglet s'exécute dans l'origine de l'app : refusé) ;
  3. cache par URL, 300 entrées hors écran (URL objet révoquées à l'éviction),
     **au plus 3 demandes en vol**, la place prise **jusqu'à la vraie réponse**
     (plafond dur 30 s), **aucune demande pour une photo hors écran** ;
  4. sans secours : le pictogramme à la place, **jamais une image cassée**.
     ⚠️ **Plus aucun état n'est « définitif »** (seconde revue, plus bas) :
     `onError()` ne part plus pour une photo Vinted, aucune liste ne la retire
     (`noterImgMorte`) — elle garde sa place avec le pictogramme et revient
     d'elle-même. `onError` ne vaut que pour un `<img>` ordinaire.
- **Un échec n'est pas figé** : un **témoin** (UNE photo perdue à l'écran,
  rechargée sans référent à 20 s puis ×2 jusqu'à 5 min, onglet visible),
  l'événement `online` (tout réessaie, refus de l'extension compris) et une
  photo **remontée plus d'une minute** après son échec. Dès qu'une photo qui
  avait échoué passe, **toutes** réessaient et la cause est remesurée.
- **Délai ≠ refus** (`vmrPhotoIssue`) : `refus` = l'extension a répondu sans
  octets ; `delai` = pas de réponse (« pas su ») → la photo retourne en attente,
  un nouvel essai, jamais « perdue » ; après deux délais on n'insiste plus sans
  signal neuf (remontage, témoin, `online`, retour de l'extension).
  ⚠️ **Un refus n'est pas un verdict non plus** : le pont ne relaie que
  `dataUrl` (un 404, un 503, une coupure arrivent identiques). La photo est
  « perdue » pour l'instant et **redemandée** : par le témoin (à l'extension, une
  photo à l'écran), au remontage après son recul (1, 2, 4 puis 5 min), à
  `online`, au retour de l'extension — et dès qu'une photo refusée revient par
  l'extension, toutes les autres lui sont redemandées.
- **« Pas su » ≠ « non »** : l'extension se manifeste quelques secondes après
  le chargement — pendant 7 s rien n'est déclaré perdu ; quand elle (re)devient
  disponible, ses photos retrouvent leurs essais.
- **UNE phrase, sur la coque** (`PhotosBloquees`), sans couleur d'alerte. QUAND
  parler vit dans `photosVinted.decision()`, jugé sur ce qui est **MONTÉ** (pas
  sur la session) : au moins **3** photos perdues à l'écran · aucune affichée
  **par l'extension** à l'écran (sinon les autres sont des liens morts) · et si
  une photo s'affiche par le navigateur, seulement quand la sonde a mesuré un
  blocage (une photo du cache ne prouve rien) · jamais pendant la mesure.
  `data-photos-bloquees` = la **cause affichée**, qui dit ce qui est mesuré et
  rien de plus : `navigateur` (deux échecs réseau ET l'extension les a
  récupérées : c'est la page qui est refusée, « dans VRM ») · `injoignable`
  (deux échecs réseau, sans plus : « ce navigateur n'arrive pas à les charger
  ici » — une coupure, un filtre ou CORP donnent la même erreur) · `reponse`
  (« peut-être des liens expirés ») · `horsligne` (`navigator.onLine === false`,
  mesuré) · `passu`. `data-photos-geste` : `reseau` (hors ligne : « je réessaie
  dès que le réseau revient », rien d'autre) · `refus` (l'extension a répondu
  sans image : « je lui redemande de temps en temps », jamais « recharge ») ·
  `reponse` (le serveur répond : **aucune promesse que l'extension les
  récupère** — elle rend `{ok:false}` sur un statut d'erreur) · `muette`
  (« recharge cette page ») · `muette-ailleurs` (un bandeau de l'écran dit déjà
  que l'extension ne répond pas : `useVoixExt`, la phrase ne le redit pas, §7) ·
  `telephone` · `chrome`.
  Sur ordinateur, sa boîte réserve la place de l'île d'actions
  (`.vrm-sous-ile`, comme `.vrm-tete-row`) : le geste passait dessous.
- **La mesure, dans SON navigateur** : au premier échec (et après chaque
  reprise), une sonde `fetch(no-cors, no-referrer, sans cookie)`. Réponse
  opaque ⇒ `reponse`. `TypeError` ⇒ **une seconde sonde 8 s plus tard sur une
  AUTRE photo** ; deux `TypeError` ⇒ `bloquee` (= deux échecs réseau espacés).
  Une `TypeError` puis une réponse ⇒ la PREMIÈRE photo est re-sondée : si elle
  répond aussi, **le réseau est revenu** — tout réessaie tout de suite, rien
  n'est conclu (au plus une fois par minute) ; si elle échoue encore, c'est un
  mélange ⇒ `reponse`. Hors ligne ⇒ `horsligne`.
  Remesurer (en changeant d'écran) **ne fait pas disparaître la phrase** : la
  conclusion d'avant reste pendant le premier essai, une erreur de plus après
  `bloquee` (aucune photo revenue depuis, sinon `reprise` l'aurait effacée) la
  confirme sans attendre ; « en cours » (rien affiché) seulement s'il n'y avait
  pas de conclusion, ou si le premier essai la contredit.
  Le bilan attend la conclusion, puis part dans **`app_data.diag_photos`**
  (sa ligne, RLS), au plus toutes les 10 min — **un retour** (une photo qui
  avait échoué s'affiche) le fait réécrire sans attendre, jamais deux fois en
  15 s — en lire-fusionner-réécrire **gardé** (lecture ratée ⇒ rien n'est écrit) :
  `{ at, dernier, parNavigateur: { 'Mac Chrome': {…}, 'iOS Safari': {…} } }`,
  chaque bilan = `{at, ko, ok, secoursOk, secoursKo, retours, delais, temoins,
  redemandes, sonde, sondeVue, enEchec, sansEchec, hote, ext
  (presente|absente|muette), ecran, nav, version}` — des nombres et des mots,
  **jamais une URL, une signature ou un titre**. Une session **sans aucun
  échec** propose un bilan `sansEchec:true`, que l'écriture ne range **que s'il
  remplace un échec rangé par ce navigateur** (sinon aucune écriture : pas une
  ligne de plus à chaque ouverture).
  **Comment le lire** (`select data from app_data where id = 'diag_photos'`) :
  `ok:0, ko>0, sonde:'bloquee', secoursOk>0` ⇒ le navigateur refuse la page (CORP
  de Vinted ou un logiciel de protection) et l'extension contourne ;
  `sonde:'bloquee', secoursOk:0` ⇒ bloqué OU injoignable, indiscernable d'ici ;
  `sonde:'reponse'` ⇒ le serveur répond une erreur (lien périmé, refus) ;
  `retours>0` ⇒ des photos sont revenues après un échec (c'était passager) ;
  `enEchec:0` ⇒ plus rien n'échoue à l'écran au moment du bilan ; `sondeVue` ⇒
  la cause mesurée plus tôt dans la session (une reprise remet `sonde` à zéro) ;
  `sansEchec:true` ⇒ une session où tout s'est affiché a remplacé un échec ;
  `redemandes>0` ⇒ l'extension a été redemandée après un refus ou deux délais ;
  `sonde:'horsligne'` ⇒ l'appareil était hors ligne ;
  `delais>0` ⇒ l'extension a tardé ; `ext:'absente'` sur `iOS …` ⇒ rien ne peut
  aller les chercher sur ce téléphone ; `ok>0` ⇒ elles s'affichent.
- ⚠️⚠️ **UN FAUX CDN SERVI PAR `page.route()` NE PROUVE RIEN** : mesuré, une
  image servie ainsi avec `Cross-Origin-Resource-Policy: same-site` **s'affiche**
  dans le Chromium du banc (l'interception de Playwright passe à côté du contrôle
  CORP). Le banc `photos-vinted.cjs` (ports 5741/5742) sert donc un **vrai
  serveur HTTPS local**, résolu sous `images1.vinted.net`
  (`--host-resolver-rules`), certificat jetable fabriqué à chaque lancement — et
  il VÉRIFIE en tête que CORP bloque.
- `verif_visuel.cjs` et `verif_dark.cjs` coupent désormais `*.vinted.net` en
  entier : leurs fixtures portent de vraies adresses, et la sonde est un `fetch`
  (pas une image) que leur route laissait passer.
- **Non mesuré** : la vraie cause chez lui (c'est `diag_photos` qui la dira) ;
  que SON extension installée réponde au pont « photo » sur sa machine ; le
  poids mémoire réel (300 photos f800 en URL objet : quelques dizaines de Mo au
  pire) ; Safari sur iPhone (aucun secours possible : seul `no-referrer` peut y
  aider, et seulement si la cause est le référent) ; le délai réel d'un service
  worker qui se réveille sur sa machine (le plafond de 30 s est un choix).

#### ⚠️⚠️ Revue du 11 octobre — onze défauts de c02ffcf, reproduits, corrigés
Deux relecteurs adverses, chaque défaut reproduit (vrai CDN HTTPS local, vraie
extension pour la mesure du service worker), puis corrigé :
- ⚠️⚠️ **Un échec PASSAGER devenait définitif pour la session** (réseau qui
  hoquette, PWA qui se réveille) : 36 pictogrammes jusqu'au rechargement, le CDN
  revenu — **219150e réessayait à chaque affichage**. Et la phrase affirmait
  « Ce navigateur **bloque** les photos de Vinted dès qu'elles s'affichent en
  dehors de vinted.fr » sur une connexion coupée, une seule `TypeError` suffisant
  à le dire, gardé dans `diag_photos` pour toute la session. ⇒ témoin, `online`,
  remontage, deux sondes, cause dite telle que mesurée (voir plus haut).
- **Une photo affichée sur Ventes faisait taire la phrase sur Annonces**
  (`okNatif === 0` jugé sur la session). Mesuré dans Chromium : une photo mise
  en cache AVANT que le CDN pose CORP s'affiche encore après — plausible chez lui
  (photos anciennes en cache, annonces republiées les 10-11 octobre non).
- **« Recharge cette page » quand Vinted refuse aussi l'extension** (403 partout) :
  un geste qui ne peut pas marcher, redit après chaque ouverture.
- **Un délai de 8 s valait refus définitif**, et libérait la place côté app
  pendant que le service worker travaillait encore : **6 demandes** chez lui
  (« au plus 3 » ne tenait pas), photos jetées, et « l'extension n'a pas pu les
  récupérer » alors qu'elle les avait rendues.
- **`onError` sur un état réversible** : Ma journée retirait ses photos (6 icônes
  de repli) quand l'extension n'était pas ENCORE là, et ne les rendait pas quand
  elle arrivait (0 demande au pont), alors que Ventes, sur la même page, les
  récupérait.
- **§7 : extension muette, la même cause dite deux fois** sur Ventes (« ne
  répond pas » ×2, « recharge » ×3).
- **Aucun garde-fou contre le retour d'un `<img>` brut** (aucun des 87 audits ne
  regardait les `<img>`, le banc ne rendait que trois écrans).
- **Un seul lien mort, et la phrase disait « l'extension n'a pas pu les
  récupérer non plus : recharge »** à côté de 8 photos qu'elle venait de rendre.
- **La phrase et son geste passaient SOUS l'île d'actions** (1512 px, mesuré mot
  par mot : « VRM est installée : c'est elle qui va les », « recharge cette
  page »).
- **Durcissement** : `evilvinted.net` passait la règle ; un SVG gardait son type
  en URL objet (mesuré : ouvert en onglet, il lit le `localStorage` de l'app).
  Aucune source réelle n'en injecte aujourd'hui. Côté app seulement (l'extension
  n'a pas été touchée : un autre chantier la modifie).
- ⚠️ **Et le premier jet de CETTE correction faisait scintiller la phrase** :
  en changeant d'écran, la cause se remesure sur les photos qui échouent
  maintenant, et la sonde posait « en cours » d'office — la phrase de la coque
  DISPARAISSAIT pendant les 8 s de la seconde sonde, puis revenait identique, à
  chaque écran (vu au banc, scénario U : 0 phrase sur Annonces 5,5 s après le
  changement). Corrigé comme dit plus haut ; mutations `scintille` (audit et
  banc U) et `cause-perimee` (audit : une cause contredite ne reste pas
  affichée pendant qu'on remesure) rouges.
- **Preuves** (méthode §6.1 : le banc et l'audit FINAUX copiés dans l'arbre de
  c02ffcf et lancés depuis lui) : banc `photos-vinted.cjs` — **130 contrôles**
  (A étendu à Ma journée et Achats ; G lien mort isolé ; H CDN injoignable puis
  revenu, aux deux tailles ; M ventes passent/annonces bloquées, aux deux
  tailles ; R tout refusé ; L extension à 9 s ; J extension arrivée après
  l'ouverture ; U extension muette ; S cause remesurée ; K île mesurée EN HAUT de
  page — dans le premier jet le contrôle tombait après le défilement, donc vert
  par vacuité). **24 rouges sur le build de c02ffcf**, et dix mutations du code
  final, chacune rouge sur son scénario (voir le README des bancs).
  `audit-photos-vinted.cjs` (nouveau) : **33 contrôles**, **14 rouges** sur
  c02ffcf, quinze mutations chacune rouge (`--mutation`). ⚠️ Son contrôle « au
  plus 3 demandes » est VERT sur c02ffcf, et c'est normal : le délai de 8 s qui
  libérait la place vivait dans `vmrPhoto` (App.jsx), pas dans la règle — c'est
  le banc L qui le prouve (« max 6 » sur c02ffcf).
  ⚠️ Un premier jet du scénario L ralentissait les photos des annonces 1 à 3 —
  qui ne sont PAS à l'écran (tri par date) : vert sur c02ffcf, par vacuité. Il
  ralentit maintenant les trois PREMIÈRES demandées, et vérifie qu'elles l'ont été.

#### ⚠️⚠️ Seconde revue du 11 octobre — sept constats confirmés, cinq défauts distincts
Trois lentilles (écrans, phrase, charge), chaque constat REPRODUIT (vrai CDN HTTPS
local, extension simulée par un aller-retour HORS page comme son service worker)
puis contre-vérifié par deux sceptiques. Les constats que les sceptiques n'ont
pas retenus ne sont PAS corrigés — dont « la phrase redit *ordinateur* sous le
bandeau des bordereaux » (un premier jet de ce correctif l'avait traité ; retiré,
il n'était pas dans la liste confirmée).
- ⚠️⚠️ **UN REFUS PASSAGER DE L'EXTENSION FIGEAIT LA PHOTO POUR LA SESSION**
  (trois constats, une cause ; gravité haute). Le pont (`bridge.js`) ne relaie
  que `dataUrl` : un 503 ou un 429 du CDN, un réseau qui hoquette dans son
  service worker arrivent EXACTEMENT comme un lien mort. c7efee0 posait
  `refus=true` pour de bon : le remontage, le témoin et le retour de
  l'extension ne la lui redemandaient jamais (seul `online` l'effaçait, et un
  hoquet ne passe pas toujours hors ligne) ; Ma journée RETIRAIT les photos de
  sa liste (`estDefinitive` → `onError` → `noterImgMorte`) ; et la phrase
  disait « rien à régler ici, je réessaie » alors qu'un rechargement les
  rendait toutes (mesuré : 15/15). ⇒ **Un refus n'est plus un verdict** :
  - le **témoin** (20 s, puis ×2 jusqu'à 5 min) redemande à l'extension **au
    plus 3 photos à l'écran par passage, les moins redemandées d'abord** — une
    seule par passage, prise dans l'ordre de la page, faisait passer cinq liens
    morts avant le premier refus passager (10 min de pictogrammes) ;
  - dès qu'une photo refusée **revient**, toutes les autres sont redemandées —
    sauf un lien déjà redemandé dans la même vague, qui attend son **recul**
    (1, 2, 4 puis 5 min) : sans cette borne, quinze retours redemandaient quinze
    fois le même lien mort ;
  - le **remontage** après son recul, `online` et le **retour de l'extension**
    la redemandent aussi ;
  - **plus aucun état n'est définitif** : aucune liste ne retire plus une photo
    Vinted (elle garde sa place avec le pictogramme et revient d'elle-même) ;
  - la phrase dit ce que fait la règle : « je lui redemande de temps en temps,
    elles s'afficheront ici dès qu'elle y arrive » — jamais « rien à régler ».
- **« Le serveur répond » promettait que l'extension « va les chercher »**
  (ordinateur) ou « c'est elle qui les récupère » (téléphone). Or `photoBytes`
  rend `{ok:false}` sur tout statut d'erreur : sur un lien mort elle ne fait pas
  mieux. Geste `reponse` : « je réessaie de temps en temps ; si ce sont des
  liens expirés, ils se renouvellent quand l'extension VRM repasse sur tes
  comptes Vinted » — la cause dit « peut-être des liens de photo expirés ».
- **`diag_photos` gardait « bloquée, 0 affichée, 0 revenue » pour un hoquet de
  20 s** : un retour ne déclenchait aucun bilan, et une session où tout
  s'affiche n'écrivait rien. ⇒ un retour réécrit le bilan sans attendre les
  10 min (jamais deux fois en 15 s) ; une session sans échec propose UN bilan
  `sansEchec`, que l'écriture ne range que pour **remplacer** un échec rangé par
  ce navigateur (sinon aucune écriture). Champs ajoutés : `redemandes`,
  `sondeVue`, `enEchec`, `sansEchec` — des nombres et des mots, jamais d'URL.
- **PWA qui se réveille** : une erreur puis une réponse (le réseau revenu entre
  les deux sondes) faisait dire « le serveur répond, mais ses images ne
  s'affichent pas » pendant ~12 s. ⇒ la PREMIÈRE photo est re-sondée : si elle
  répond aussi, le réseau est revenu — tout réessaie, rien n'est conclu (au
  plus une reprise par minute) ; si elle échoue encore, `reponse`.
- **Hors ligne mesuré disait « je n'ai pas pu mesurer pourquoi » et envoyait sur
  l'ordinateur**. ⇒ cause `horsligne` (`navigator.onLine === false`, maintenant
  ou à la sonde), geste `reseau` : « Pas de connexion internet ici pour
  l'instant… Je réessaie dès que le réseau revient. »
- **PREUVES** (méthode §6.1 : l'audit et le banc FINAUX copiés dans l'arbre de
  c7efee0 et lancés depuis lui) :
  - `audit-photos-vinted.cjs` : **50 contrôles**, **15 rouges sur c7efee0** ;
    onze mutations nouvelles, chacune rouge — `refus-definitif` (2),
    `temoin-navigateur` (4), `retour-seul` (3), `retour-sans-borne` (1 : quinze
    retours redemandent quinze fois le lien mort), `refus-colle` (1),
    `temoin-tout` (2 : tout redemander à chaque passage), `temoin-une` (1 : une
    seule photo, dans l'ordre de la page), `bilan-retour` (2),
    `bilan-sans-echec` (2), `reveil` (2), `horsligne-passu` (1) ; les quinze
    d'avant restent rouges.
  - banc `photos-vinted.cjs` : **166 contrôles, tout vert** ; scénarios
    nouveaux T, T390, X, O, E390, W, N, Y (et E, C étendus) : **15 rouges sur le
    build de c7efee0**, chaque scénario « réel » vert (il reproduit bien le
    défaut) — T ×2, T390 ×3 (dont « rien à régler ici »), X ×2 (Ma journée :
    `retirees:5`), O ×2, E et E390 (promesse), W (« reponse/telephone » à 8 s),
    N (« passu/telephone »), Y ×2 (bilan resté « bloquée, 0 revenue »). Dix
    mutations du code final, chacune rouge sur son scénario : `estDefinitive`
    rétabli (X, O : 4) · témoin sans l'extension (T : 4) · cadre non observé
    (T : 4) · texte « rien à régler » (T390) · réveil (W) · hors ligne « pas
    su » (N) · promesse sur `reponse` (E, E390) · bilan sans retour (Y) ·
    session sans échec muette (Y) · bilan « sans échec » écrit d'office (C).
  - tous les `scripts/audit-*.cjs` à 0 (hors `audit-renum-b`) ; bancs voisins
    verts un par un : annonces-carte, ventes-bordereau, messagerie, premierjour
    (48), statuts-colis, enligne (relancé seul : son premier passage est mort
    sur « browser has been closed », disque de la machine plein).
  ⚠️ **Le disque partagé de la machine s'est rempli pendant les preuves** (656 Mo
  libres) : Chromium mourait au milieu d'un banc (« Target page, context or
  browser has been closed ») et les copies des mutations échouaient. Ces rouges
  ne sont PAS des défauts : chaque scénario touché a été relancé seul.
- ⚠️ **Côté extension, à faire dans un chantier extension (pas ici)** : le pont
  ne dit pas POURQUOI il n'a pas d'octets. `bridge.js` (relais `photo`) devrait
  relayer `error` comme le fait déjà `pdfLbc`, et `photoBytes` le **statut**
  numérique : alors un 404/410 (lien mort) pourrait attendre plus longtemps, et
  un 429/5xx/réseau être redemandé plus tôt. Tant que ce n'est pas fait, l'app
  traite tout refus comme « passager, avec recul » — le sens sûr : une photo
  revient, au prix de quelques redemandes bornées sur des liens vraiment morts.
- **Non mesuré** : le rythme réel des refus passagers chez lui ; ce que le CDN
  répond vraiment à son service worker quand la page est refusée (403, 429 ?).


### Le relais du téléphone : agir depuis l'iPhone par l'extension de l'ordinateur (16 octobre, 5.183)
Julien : « quand je suis sur mon téléphone et que l'extension est allumée [sur
mon ordinateur] je veux pouvoir faire des actions ». Avant, sur le téléphone,
`raisonExtGlobale` rendait `telephone` et tout geste était grisé.
- **Le chemin** : le téléphone écrit UNE ligne par commande, `cmd_relais_{id}`
  (`{cmd, args, pour, demandeLe, expire = +10 min, etat:'attente', par:'telephone',
  confirme?}`, au nom du vendeur — RLS) ; l'extension (alarme `vrm-relais` de
  30 s, le minimum de Chrome, et chaque visite sur Vinted) lit
  `id=like.cmd_relais_*&meta->>etat=eq.attente`, **5 au plus**, la PREND par une
  écriture conditionnelle (`PATCH …&meta->>etat=eq.attente`), l'exécute par
  **les mêmes fonctions** qu'un clic sur l'ordinateur (`executerCommande`,
  `executerPourApp`, `publierDepuisApp` — donc `gardeStricte`, 20 actions/h,
  `avecVinted`, la pause) et écrit le résultat dans la ligne. Un bordereau
  accepté avance dans la ligne (`relaisSuivreJob`, branché sur `majCmd`).
- **L'extension revérifie tout** : liste blanche (`bordereau`, `lbcPublier`,
  `exec` par `EXEC_PERMIS` **sans les lectures** ; « Préparer sur eBay » ne se
  relaie pas — le formulaire s'ouvre sur l'ordinateur) ; forme des arguments ;
  propriétaire de la ligne ET `pour` = le propriétaire de SA session ; échéance
  (10 min au plus : expirée ⇒ refusée, jamais exécutée en retard) ; annulée ⇒
  jamais prise ; **une seule fois** (`vrmRelaisVus` dans `chrome.storage.local`,
  noté AVANT d'agir — un service worker redémarré ne rejoue pas). Accepter une
  offre exige `confirme` dans la ligne (l'entrée `confirmer: true`
  d'`EXEC_PERMIS`) : le téléphone ne l'envoie qu'après sa confirmation (§3).
- **Sans session VRM, la relève ne fait RIEN** — pas même une lecture de notre
  base (le stockage local d'abord).
- **Le signe de vie** `relais_ext` (`atMs, ver, code, vUid, vLogin,
  pauseJusqua`, des scalaires lus par `meta->>`), au plus une écriture par
  minute. Le téléphone le relit toutes les 30 s (visible, sans souris, sans
  extension ici, session ouverte) : **vivant** (< 3 min et version ≥
  `EXT_CAPACITES.relais`) · **éteint** (« pas donné signe de vie depuis X —
  ouvre Chrome ») · **en retard** · **pas su** (lecture ratée : aucune promesse).
  ⚠️ L'âge se compare à l'horloge du TÉLÉPHONE : une horloge d'ordinateur très
  décalée le ferait dire éteint (le sens sûr).
- **Côté app, aucun écran ne change de règle** : `vmrCmd` / `vmrExec` passent
  par le relais quand il est vivant (`relaisCmd`, `relaisExec`) et rendent la
  MÊME forme que le pont ; `raisonExtGlobale(sansSouris)` rend `null` sur relais
  vivant ; `useExtVivante().etat` devient `etatAgissant()` (le compte Vinted
  ouvert sur l'ordinateur) — `BoutonBordereau`, « Tout générer »,
  `BoutonPublier`, la messagerie et la pastille suivent tout seuls (§11). Le
  compte de la vente ≠ celui de l'ordinateur ⇒ grisé AVANT le clic.
- **Jamais « fait » avant l'extension** : `relais-attente` (« Envoyé à ton
  ordinateur… »), `relais-pris` (« En cours sur ton ordinateur… »), puis
  l'étape écrite par elle. Pas prise en 2 min ⇒ annulée par une écriture
  conditionnelle (prise entre-temps ⇒ rien n'est touché) et dit ; prise sans
  résultat après 6 min ⇒ « je ne sais pas si elle est partie ».
- **Une phrase, une fois** (§7) : « via ton ordinateur (compte Vinted ouvert :
  X) » au-dessus de la liste (`LigneRelais`) et dans le fil de la messagerie ;
  sur chaque bouton, en titre. Pastille : « Actions via ton ordinateur ·
  {compte} » (sur le téléphone, l'en-tête n'affiche que l'icône ⓘ : le libellé
  est dans `aria-label`, le panneau le détaille).
- Preuves : `audit-relais.cjs` (le vrai `background.js` dans `_fond-vm`) **27
  contrôles**, **14 rouges** sur b8d11f2 et **7 mutations sur 7** rouges (vus,
  échéance, propriétaire, confirmation, prise conditionnelle, session, liste
  blanche) ; banc `relais-telephone.cjs` (port 4941, 390 px tactile + 1512 px)
  **41 contrôles**, **28 rouges** sur le build de b8d11f2, et rouge sous deux
  mutations de l'app (âge ignoré ⇒ 4 ; « fait » avant l'extension ⇒ 7).
- ⚠️ **Non mesuré** : le `PATCH` conditionnel sur `meta->>etat` contre la vraie
  PostgREST (grammaire documentée, jamais appelé ici, §2.3) ; le délai réel de
  l'alarme de 30 s dans son Chrome ; plusieurs ordinateurs relais à la fois (le
  signe de vie est celui du DERNIER ; la prise conditionnelle empêche une double
  exécution, mais l'autre ordinateur peut refuser « autre compte »).


### L'extension n'écrit jamais la ligne `main`
Elle écrit dans ses **lignes dédiées** (`panel_bords_done`, `panel_buyprices`,
`panel_accounts_off`, `panel_colis_relais`, …) en lecture-fusion-écriture.
L'app les lit en source supplémentaire, jamais l'inverse.


### ⚠️⚠️ ET LE REPLI « UN SEUL VENDEUR » N'EST VRAI QUE TANT QU'IL EST SEUL
`resoudreProprietaire` (api/_lib/proprietaire-email.js) décide dans quelle
boutique atterrit un bordereau. Son étape 3 dit : « installation à un seul
vendeur, tout lui appartient » (`VRM_OWNER_UID`). C'était juste — **tant que
Julien est seul**. Le jour où l'app accueille quelqu'un d'autre, un email arrivé
sur une adresse que le NOUVEAU vendeur n'a pas encore déclarée partirait chez le
propriétaire de l'installation : **son bordereau, son code de retrait, sa vente,
dans la boutique d'un autre** — et ça ne se voit pas, celui qui l'attendait ne
saura jamais qu'il a existé. C'est le fichier lui-même qui l'écrit : « perdre un
email est réparable ; le donner au mauvais vendeur ne l'est pas. »
⇒ Le repli s'éteint **dès que le registre déclare un propriétaire AUTRE que
celui de l'installation** — il y a alors démonstrablement plus d'un vendeur.
⚠️ **Et il ne s'éteint PAS avant** : registre vide, ou ne portant que ses
propres adresses, rien ne change. C'est l'**incident du 16 au 22 août** (593
emails en quarantaine, zéro traité, ses codes de retrait perdus) qu'on ne refait
pas — *une nouveauté ne doit pas éteindre ce qui marchait*.
⚠️ **Le fichier annonçait « fonction PURE, donc testable exhaustivement »… et
RIEN ne l'exécutait.** C'est §4.10 mot pour mot, sur la règle qui répartit les
emails entre vendeurs. `scripts/audit-proprietaire-email.cjs` : **16 contrôles,
2 rouges** sur le code d'avant. Il vérifie aussi ce qui ne doit **jamais**
décider — un email dont l'expéditeur, le sujet ET le corps nomment un autre
vendeur reste chez le bon.


### La cloche retirée, « Sécurité des données » une fois (17 octobre)
- Le panneau « 🔔 Notifications » et `notifOpen` étaient morts (`setNotifOpen(true)` nulle part) : retirés. `notifItems` reste (Ma journée, tableau de bord, Collectif). 26 `tab===` avant et après ; retrait (4 KO identiques sur l'avant, donnée datée), premierjour, journee-premium, demarrage verts.
- Sous-écran « Sécurité des données » (téléphone) : le titre du panneau se tait (`.vrm-titre-panneau`, CSS), le verdict reste. `reglages-premium.cjs` compte le titre de CHAQUE sous-écran (hors bouton : « Fermer mon compte » s'ouvre en deux temps, exprès) : rouge sur l'avant (2 fois), vert après.


### Le bouton « retour » revient à l'écran d'avant, et Orion (18 octobre)
- ⚠️ **Aucun changement d'écran n'entrait dans l'historique** : le geste
  « retour » d'Android, le balayage de bord sur iPhone ou ← sur ordinateur
  QUITTAIENT VRM (mesuré : `about:blank`). Chaque écran ET chaque section d'une
  plateforme devient une entrée (`pushState`, adresse inchangée — `?tab=` reste
  à `goto`), un retour rejoue écran + section sans nouvelle entrée, l'entrée
  d'origine vaut Ma journée, un changement d'onglet = UNE entrée (pose différée
  d'un tour : la section suit l'onglet). `scrollRestoration = 'manual'` : la
  position reste à `MemoireDefilement`. Les deux `replaceState({})` gardent
  désormais l'état. Banc `retour-historique.cjs` (aucune fixture, 390/1512) :
  **10 rouges sur le build d'avant**, 0 après.
- **« Retour » ferme d'abord la feuille ouverte** (`<FermeAuRetour fermer={…}/>`,
  posé dans 33 feuilles : voile + panneau, recherche, photo agrandie, fil de
  conversation, lot de bordereaux…). La feuille ajoute UNE entrée (même écran :
  la coque n'y voit rien) ; fermée autrement (×, voile, Échap), son entrée part
  par `history.back()` — ou est REMPLACÉE par le nouvel écran si la fermeture a
  changé d'écran (sinon le retour défairait la navigation) ; la coque attend ce
  retour avant d'empiler (`__vrmRetourFeuille`). Une feuille qui refuse de se
  fermer (envoi en cours) retrouve son entrée. **Toute nouvelle feuille plein
  écran doit le porter.** Banc `retour-historique.cjs` : 3 rouges sur le build
  d'avant. ⚠️ Un `goto` lancé dans la même milliseconde qu'une fermeture est
  défait par ce retour (vu au banc `revendeurs`, qui attend désormais 400 ms) :
  aucun chemin humain ne le fait.
- **Orion (Kagi, Mac et iPhone)** installe les extensions des boutiques Chrome
  et Firefox — le seul navigateur d'iPhone qui en accepte. Même agent
  utilisateur que Safari : impossible à reconnaître, donc PROPOSÉ là où l'on
  dirait « Safari ne peut pas » (Safari Mac, iPhone), seulement avec une fiche
  publiée (`boutiqueOrion` : Chrome d'abord, Firefox sinon), et « VRM n'y a pas
  encore été essayé ». Aucun paquet à part. `audit-extension-navigateurs.cjs`
  +2 contrôles. ⚠️ Non mesuré dans un vrai Orion.


### La date d'arrivée de chaque colis à retirer (21 octobre)
Julien : « Améliore les colis, je veux que l'on voie la date à laquelle il est arrivé. »
- **Une règle** (`api/_lib/arrivee-colis.js`, importée par l'app ET `api/email-inbound`, §11) ; une ligne `LigneArrivee` sous le titre de chaque carte d'Achats → À retirer (email, colis vu par Vinted, retirés en attente, jamais retirés) : « Arrivé le 18 oct. · il y a 3 j », neutre ; `data-arrive-le="AAAA-MM-JJ"` (ou `inconnue`) et `data-arrive-sur="oui|borne"`. Elle était cachée dans « Détails du colis » et FAUSSE une fois sur cinq.
- ⚠️⚠️ **Mesuré (lecture seule)** : `email_track_*.receivedAt` est la date du DERNIER email — les rappels (« Le temps file… », « Libère de la place dans la consigne… ») réécrivent la ligne : **6 des 30** colis « disponibles » portaient la date d'un rappel. Email d'arrivée (« … est disponible », « … est arrivé en relais ») ⇒ date sûre ; rappel, « TR : », sujet inconnu ⇒ « **Arrivé au plus tard le** » ; le serveur garde désormais `arriveLe` (premier email d'arrivée, relu sur la ligne d'avant) — les lignes déjà rangées n'en ont pas.
- **Colis vu seulement par Vinted** : aucune date d'arrivée en base (la commande porte la date d'ACHAT, la transaction celle du paiement — mesuré sur ses 3 colis ; leurs conversations ne sont pas rangées). `panel_colis_relais.at` = heure de LECTURE par l'extension ⇒ « au plus tard » ; rien ⇒ « Date d'arrivée inconnue ». Jamais l'heure de capture présentée comme l'arrivée.
- Preuves : banc `colis-arrivee.cjs` (390 tactile + 1512, données inventées) **16 rouges sur le build d'avant**, rouge sous la mutation « rappel daté comme l'arrivée » (4) ; `audit-arrivee-colis.cjs` (la vraie route : « disponible » le 16 puis rappel le 20 ⇒ `arriveLe` le 16) 2 rouges sur l'avant, rouge si la ligne d'avant n'est pas passée.
- Non fait : Colis (à expédier) — rien ne date l'arrivée chez l'acheteur ; l'extension pourrait ranger l'heure du MESSAGE d'arrivée de la conversation (`created_at_ts`) — chantier extension.

### Colis au point relais et rappel de la veille au soir (21 octobre)
Julien : « fait tout » — deux notifications.
- **Colis acheté arrivé au point relais** : la notification existait déjà
  (`api/email-inbound.js`, catégorie **`colis`**, activée par défaut, « 📍 Colis
  à retirer ») avec le lieu et le code (`bodyNotifColis` : `codeNotif` écarte
  « suivant » et tout code sans chiffre ; le QR n'entre jamais dans le texte).
  **Aucune préférence nouvelle** : en créer une seconde pour la même chose serait
  deux règles pour une notion (§11). ⚠️⚠️ **Défaut trouvé et corrigé** : toutes
  les étapes d'un colis partageaient la clé anti-doublon `track-{suivi}` ; Julien
  a activé « Suivi du colis » (`suivi: true`, mesuré le 11 oct.), donc le premier
  « en transit » consommait la clé et **« arrivé au point de retrait » ne sonnait
  jamais**. `cleNotifColis` : « à retirer » a sa clé `relais-{suivi}-code|sans`
  (une fois par n° de suivi, et une seconde seulement si un email plus tardif
  apporte le code qui manquait) ; les autres étapes gardent la clé d'avant à
  l'identique. Ouvre `?tab=cat_achats`. ⚠️ Au déploiement, un colis déjà notifié
  « à retirer » peut re-sonner UNE fois sur un rappel du transporteur (l'ancienne
  clé n'est pas reprise en alias : elle aurait gardé le défaut).
- **Rappel de la veille au soir** : second cron `vercel.json`
  `/api/ship-reminders?moment=soir` à **18:00 UTC** (20 h à Paris l'été, 19 h
  l'hiver ; le plan Hobby décale d'au plus une heure). Même route (12 fonctions),
  même garde `CRON_SECRET`, boucle par vendeur, eBay relu d'abord. « Demain : N
  colis à poster — dont X déjà en retard, Y avec la date limite demain ». N =
  **la règle du widget et du bilan** (`txsAExpedier` : résumé de l'extension ou
  `aExpedier`, cochés « posté » et masqués exclus, eBay par `colisEbay`) ; le
  « dont » lit les dates limites des bordereaux de CES ventes et d'eBay (limite
  aujourd'hui ou avant = en retard demain). Préférence nouvelle **`soir`**
  (« 🌙 Colis de demain »), activée par défaut, la même dans `PUSH_CATS` et
  `PUSH_DEFAUT`. Rien ne part : rien à poster, ventes Vinted illisibles, mémo
  `soir_reminder_dedup` illisible / non écrit (écrit AVANT l'envoi, une fois par
  jour de Paris), préférence coupée, abonnement coupé. eBay illisible ⇒ « au
  moins N », eBay nommé. Le passage du soir n'envoie ni le rappel du matin, ni
  l'URSSAF, ni le bilan. « Avant midi » n'est pas dit : aucune heure limite n'est
  captée (les dates limites sont des jours). ⚠️ **FAUX, corrigé le 22 octobre** :
  204 bordereaux sur 205 portent leur heure dans `dateLimite` — voir « Tes
  colis à l'heure » plus bas.
- Preuves : bancs `colis-relais-push.cjs` (vraie route des emails, 14 contrôles ;
  3 rouges sur le code d'avant ; mutation « clé commune » 3 rouges) et
  `rappel-soir.cjs` (vraie route, deux vendeurs, widget comparé, 17 contrôles ;
  10 rouges sur le code d'avant ; mutations « sans mémo du jour » 2 rouges,
  « eBay illisible dit complet » 1 rouge).
- ⚠️ **Non mesuré** : que Vercel accepte un `path` de cron avec `?moment=soir`
  (documenté, jamais vu passer ici) et le second cron sur ce plan — **si le
  déploiement refuse `vercel.json`, retirer ce cron** (un cron refusé bloque tous
  les déploiements) ; l'heure réelle d'exécution ; aucune notification réelle
  envoyée. Le code de retrait lu par l'extension dans une conversation Vinted
  (`panel_colis_relais`) ne déclenche aucune notification (extension non touchée).


### Revue visuelle de tous les écrans (21 octobre)
Rendu de chaque écran et section (390 tactile clair, 1512 sombre, fixtures), captures regardées. Banc `revue-21oct.cjs` (port 8811 ou `BANC_PORT`, `EXPLORE=dossier` pour les captures) : **21 rouges sur le build d'avant, 0 après**. Corrigé :
- Achats → À retirer : le « i » d'un point relais n'était qu'une lettre nue ⇒ cerclé et centré ; sur une carte sans code, « J'ai retiré » restait seul à gauche ⇒ poussé à droite (`data-pickup-sans-code`).
- Colis : la mention d'urgence (« à poster aujourd'hui ») était ROUGE ⇒ ambre (§7 : le rouge, c'est deux paires sous un même N°), `data-colis-urgence`.
- « Mes transactions », « Ta déclaration URSSAF » se coupaient en fin de ligne, loin de leurs guillemets ⇒ espaces insécables.
- eBay : « l'onglet « Compte eBay » » renvoyait à un onglet qui n'existe pas ⇒ « la section « Compte » » ; la section Compte peignait une bande opaque sous la barre de sections, en sombre ⇒ retirée ; « Actualiser » d'À traiter n'avait pas de titre visible ⇒ « Tâches à traiter ».
- Compta : le lien de saisie des prix d'achat était redit sous le bénéfice net ; le segment « Période » laissait un vide à droite (`plein`) ; la liste vide d'abonnements redisait sa phrase.
- Communauté : « Réessayer » collé au paragraphe ; Comptes liés : « Gérer ce compte » décentré ; Annonces : la ligne de fraîcheur collée à la grille.
- **Laissés** : eBay « Réponse eBay incomplète » et les programmées vides (le banc sert `{pret:true}`) ; Compta à 0,00 € (limite des fixtures, déjà noté le 19 oct.) ; le lien en ligne « Statistiques » de 16 px (lien dans une phrase) ; le champ couleur du Garage ; le logo eBay en sombre (choix de design). `ventes-colis-premium` sort 2 rouges (« somme des prix rendus 0 € ») déjà sur le build d'avant.

---


### Retour → stock : « Retours en cours » dans Colis (21 octobre)
Fonction retenue le 11 octobre. **Mesuré (lecture seule)** : une VENTE en retour
a sa transaction à `status` 440 « Retour initié » ; son `ship_status_title` dit
où en est le colis de retour (vide / « Bordereau envoyé au vendeur » = pas
parti · « colis déposé… » = en route · « Commande livrée ! » = ambigu, peut être
la livraison d'origine) ; la liste des ventes passe ensuite à « Remboursement
effectué » (`failed`), la transaction reste figée à 440. 13 ventes 440 en base,
dont 1 en cours (oct.), 1 figée sur une vente finalisée (pas un retour), le
reste remboursé en août-sept. Aucune donnée de retour dans les conversations
n'a été utilisée.
- **Une règle pure** `src/retoursStock.js` (`retoursEnCours`, `remiseEnStock`) :
  la paire par IDENTITÉ (correction de la vente, sinon transaction → annonce →
  fiche N°), **jamais le titre** ; étapes initié · en route · reçu chez toi ·
  remboursé ; « reçu » n'est JAMAIS déduit (même « Vinted dit livrée ») : c'est
  SON clic (`vinted_retours_recus`, existant) ; non réclamée = la paire revient
  aussi ; remboursé de plus de 45 j et pas noté reçu ⇒ replié, jamais caché.
  Trois états (ventes pas lues · pas su · lu), ce qui manque nommé (états des
  transactions, ventes d'un compte, retours eBay).
- **eBay** : les retours Post-Order (`action: 'retours'`, la route existante),
  lus seulement sur Colis, une fois par 10 min, pour les comptes eBay RELIÉS
  (une ligne `ebay_orders`) ; N° par le SKU de la ligne de commande
  (`numLigneEbay`) ; clos sans remboursement ⇒ rien ne revient. Accepter /
  rembourser reste dans eBay → À traiter.
- **Colis → « Retours en cours »** (`RetoursEnCoursBloc`, `data-retours-encours`,
  `data-retour*`) : N°, étape, compte, lien Vinted/eBay ; « Reçu chez moi ? » ;
  « Remise en stock » (seulement reçu ET relié) : garde le N° ; porté par une
  autre paire PRÉSENTE ⇒ la feuille DEMANDE (« Remettre en stock sans N° » ou
  Annuler, jamais deviné) ; ancien N° (013) ⇒ « numéro neuf à la
  republication ». Rangé dans `vinted_retours_remis` (synchronisé, rattrapé par
  `onCloudReady`, rejoué comme geste) ; la ligne passe « à republier » (lien
  `vinted.fr/items/new`) jusqu'à republication (N° en ligne, annonce rouverte ou
  photo exacte). **Rien d'autre ne change** : ni pool, ni fiche, ni numéros
  présents. Le CA n'est pas touché (le remboursement en sort par les règles
  existantes, §11).
- **Une voix (§7)** : la liste « qui te reviennent » d'Annonces → Conseils est
  remplacée par une ligne qui mène à Colis. La carte « litiges » de Statistiques
  reste (elle compte aussi suspendues et pertes).
- Preuves : `audit-retours-stock.cjs` (vraie règle, 31 contrôles, `--prouve`
  **6/6** : relié par titre, livrée = reçu, conflit ignoré, pas su = vide,
  finalisée gardée, correction ignorée) ; banc `bancs/retours-stock.cjs`
  (`BANC_PORT`, `BANC_DIST`, 390 tactile + 1512, ventes inventées) — rouge sur
  le build d'origin/main (**20 rouges**), vert après, **4 rouges** sur un build « relié par titre ».
- **Non mesuré** : un vrai retour eBay (aucune commande eBay en base) ; le lien
  `ebay.fr/rt/ReturnDetails` ; « Commande livrée » sous 440 n'est jamais lu
  comme reçu (le sens sûr).



### Petits correctifs du 22 octobre : code Chronopost, délai d'email, mentions avant paiement, première visite (7, 8, 15, 16)
- **(7) Le code de retrait Chronopost « …suivant au commerçant : »** — mesuré
  (lecture seule) : l'email « Votre colis VINTED est arrivé en relais Pickup »
  écrit « communiquez le code de retrait suivant au commer&ccedil;ant : NNNNNN »
  (entité HTML non décodée) ; 3 emails Chronopost « arrivé » sur 8 portaient
  leur code. Une règle (`api/_lib/code-retrait-email.js`, `codeRetraitTournure`,
  §11) : les 4-10 chiffres qui suivent la tournure SUR LA MÊME LIGNE, rien d'autre
  (un nombre à la ligne suivante, un suivi de 14 chiffres, « suivant » seul ⇒
  rien). Lue par la route à l'arrivée ET par l'app (`reclassifyTrack`) dans
  l'`extraitCode` d'une ligne déjà rangée : **1 ligne en base** (lue en booléen,
  aucun code publié) affiche son code sans réécriture. `audit-transporteurs.cjs`
  (règle, vraie route, app dans un `vm`) : **10 rouges sur l'avant** ;
  mutations `ligne-suivante`, `sans-regle`, `app-sans-relecture` rouges.
- **(8) « réessaie dans N secondes »** — GoTrue répond 429
  « For security purposes, you can only request this after N seconds. »
  (inscription, mot de passe oublié, renvoi, lien, changement d'adresse).
  `delaiDemandeEmail` le lit, la phrase le dit en français, et le bouton est
  GRISÉ avec le décompte (« Réessaie dans N s », `data-auth-attente`) ; taper
  une autre adresse le libère. Le Site URL et l'expéditeur restent des réglages
  de Julien (non simulés). Banc `attente-email.cjs` (faux GoTrue, horloge
  pilotée, 390 et 1512) : vert ; **24 rouges sur le build d'avant** ; mutation
  « décompte toujours à 0 » ⇒ 16 rouges.
- **(15) Pas de paiement sur des CGV vides** — mesuré : les 10 champs de
  `public/legal/editeur.js` valent `null`, `src/contact.js` est vide, et l'art. 5
  des CGV renvoie à une adresse qui n'existe pas. `api/_lib/mentions-legales.js`
  lit CE fichier (le serveur l'importe ; il reste un simple script pour les
  pages) ; `checkout` refuse tant qu'un champ de `VRM_EDITEUR_OBLIGATOIRES` est
  vide ou que le fichier est illisible (« pas su » = fermé) : **503
  `mentions-legales`, même forme que « prix ≠ CGV »** — phrase générique au
  vendeur, détail dans les journaux et sur la carte du propriétaire
  (`mentionsManquantes`, libellés, au propriétaire seul ; `mentionsCompletes`
  null/true/false pour tous). L'app : la porte et la carte « Mon compte »
  ferment le paiement (`data-raison="mentions"`), le propriétaire lit la liste
  (`data-mentions-manquantes`).
  **Tranché** : la seconde case est une **demande d'accès immédiat** (L221-25),
  pas une renonciation au droit de rétractation (L221-28 1° exige un service
  pleinement exécuté sous 14 jours ; l'art. 5 garde ce droit, au prorata).
  Même composant que la case des CGV (`CaseCgv`, `cases={cgv, acces}`),
  « S'abonner » exige les deux, envoyée (`accesImmediat: true`, exigée par le
  serveur : 400 `acces-immediat`) et datée comme les CGV
  (`acces_immediat_demande_le`). Formulaire type (annexe R221-1) :
  `public/legal/retractation.html`, lié depuis l'art. 5 des CGV et la case ;
  CGV mises à jour au 22 octobre (`CGV_VERSION = '2026-10-22'`). Aucune mention
  inventée : « à compléter ». Preuves : `audit-mentions-paiement.cjs`
  (16 contrôles, **14 rouges sur l'avant**, 6 mutations rouges : porte retirée,
  détail au vendeur, pas su ouvert, case ignorée, liste à tous, métadonnée
  absente) ; `audit-abonnement` et `audit-lancement` remplissent les mentions
  (valeurs inventées) et envoient la case ; banc `abonnement.cjs` 100 verts
  (deux cases, porte, mentions vides, propriétaire).
- **(16) Le premier passage d'un nouvel inscrit n'a rien rangé — diagnostic**
  (lecture seule, aucune donnée de ce vendeur dans le dépôt) : son onglet
  Vinted était ouvert AVANT la liaison. La visite est sortie sur
  `visite_sans_session` (sans garde, voulu), la capture passive du profil a été
  refusée (`ecriture_ratee_harvest_profile_sans_session` ×2) et le dressing
  passif ignoré (`ignore_dressing_profil_pas_lu` ×2). Achats et messages sont
  arrivés 2 s après la liaison (capture passive) ; profil et annonces ont
  attendu l'alarme des 20 minutes (`runActive`). 0 vente : pas de
  `orders_sold`, normal. Aucun recul de base ni pause Vinted dans ses
  compteurs ; l'« heure de vide » lue d'abord venait d'`updated_at` (§4.3).
  **Corrigé (extension, version NON montée — à l'intégration)** :
  `visiteApresSession` — une session NEUVE pour la capture (aucune, morte, autre
  compte VRM ; liaison adressée ou mot de passe) relance `visiteVinted` sur
  l'onglet Vinted déjà ouvert, avec TOUS ses garde-fous (compte ignoré, pause,
  recul, garde des 5 min, file, budgets) ; la même session vivante renvoyée,
  ou aucun onglet Vinted ⇒ rien. `audit-liaison-visite.cjs` (vrai
  `background.js`) : 10 contrôles, **5 rouges sur l'avant** ; mutations
  `sans-appel`, `toujours`, `sans-onglet`, `contourne-gardes` rouges.
- **Revue du 23 octobre (nuit) — deux défauts reproduits, corrigés.**
  1. ⚠️ **Mentions ILLISIBLES (« pas su ») : le serveur refusait le paiement (503),
     la porte et la carte « Mon compte » proposaient quand même les deux cases et
     « S'abonner »** (reproduit avec un `editeur.js` rempli à la main d'une
     apostrophe dans une chaîne entre apostrophes : `nom: 'Julien d'Exemple'` ⇒
     le fichier ne se charge plus, `mentionsCompletes: null`). C'est le défaut de
     la revue du 11 octobre refait sur « pas su ». ⇒ L'app traite `null` (et
     absent) comme le serveur : FERMÉ (`mentionsCompletes !== true`, porte et
     carte, `data-raison="mentions"`). ≠ `prixConforme: null` (Stripe muet,
     passager, le serveur relit au clic) : un fichier illisible le reste.
     Le propriétaire lit l'erreur MESURÉE (`mentionsErreur`, à lui seul :
     « Unexpected identifier 'Exemple' ») et la cause la plus courante
     (l'apostrophe, avec le geste : des guillemets droits) ; `lireMentions` rend
     `{erreur}` au lieu de `null` (`mentionsManquantes` rend toujours `null` ⇒
     fermé). Banc `abonnement.cjs` (la forme du serveur : `mentionsCompletes`
     toujours présent dans `base`) : **7 rouges sur le build de 39a9042**, 109
     verts après ; mutation « `=== false` » ⇒ 6 rouges.
     `audit-mentions-paiement.cjs` : + un `editeur.js` à apostrophe dans une
     copie (fermé, vendeur sans l'erreur, propriétaire avec) — 1 rouge sur
     39a9042 (l'erreur au propriétaire est neuve), mutations `erreur-a-tous`,
     `sans-cause`, `passu-ouvert` rouges.
  2. **§7 : le compte à rebours s'écrivait deux fois** (« … dans 57 secondes »
     au-dessus de « Réessaie dans 57 s »). Là où un bouton grisé porte le
     décompte (inscription, mot de passe oublié, « Renvoyer » d'un compte pas
     confirmé, fenêtre « Changer mon email »), la phrase dit la cause SANS chiffre
     (`TEXTE_DELAI_EMAIL_BOUTON`) ; ailleurs (aucun bouton ne le porte) elle
     garde le nombre. Banc `attente-email.cjs` : contrôle qui COMPTE les nombres
     de secondes à l'écran (1, jamais 2) + scénario D « Changer mon email »
     (session de banc, `PUT /user` refusé) ; **12 rouges sur le build de
     39a9042**, vert après ; mutation « phrase avec chiffre » ⇒ 8 rouges.
     ⚠️ Son `pause(ms)` valait 0 ms (`pause(_pg, ms)` appelée à un argument) :
     corrigé ; il charge maintenant `_porte-banc.cjs`.
- **Non mesuré** : la vraie réponse de GoTrue au rendu (le texte vient de son
  code) ; Stripe réel ; la page de rétractation relue par un juriste ; la
  visite relancée dans un vrai Chrome ; que Vercel embarque bien
  `public/legal/editeur.js` dans la fonction (import dynamique au chemin
  littéral : sinon `mentionsErreur` le dira au propriétaire). `audit-extension-zip` est rouge tant que
  la version n'est pas montée et le zip refait (à l'intégration).
- **Gestes de Julien** : remplir `public/legal/editeur.js` (les 10 champs, dont
  le médiateur) ET `src/contact.js` — tant qu'ils sont vides, personne ne peut
  payer ; faire relire CGV et formulaire par un juriste ; régler le Site URL et
  le SMTP dans Supabase (inchangé).

#### Revue du chantier CSP (22 octobre, soir) — cinq défauts reproduits, cinq corrigés
Chacun REPRODUIT d'abord sur cab152a (copie `git archive`, contrôles lancés
depuis elle, §6.1), corrigé à la racine, rouge avant, vert après, rouge sous
mutation. Extension non touchée.
- ⚠️⚠️ **Reçu d'achat : « Imprimer » et « Fermer » ne faisaient plus rien dès que
  l'onglet de VRM s'était rechargé** (régression du chantier : ses gestes étaient
  branchés DEPUIS l'onglet de VRM, et un écouteur meurt avec l'onglet qui l'a
  posé — or l'app se recharge toute seule : version vérifiée chaque minute,
  nouveau service worker après chaque déploiement). ⇒ La fenêtre charge
  `public/recu-boutons.js` (même origine, permis par `script-src 'self'`) qui
  branche les deux gestes et pose `__vrmRecuBoutons` ; les écouteurs posés par
  l'onglet de VRM ne restent qu'en SECOURS (si le fichier n'a pas pu se charger),
  gardés par ce drapeau : jamais deux impressions.
  ⚠️ **Piège de banc mesuré** : l'interception de Playwright (`ctx.route`) laisse
  en suspens la requête d'un script chargé par une fenêtre `about:blank` —
  jamais partie, alors qu'elle part sans interception. Le reçu se juge donc dans
  un contexte SANS route (ouvreur : `/legal/cgv.html`, même politique).
- **Les QR Vinted Go (http, 15 sur 15 dans sa base) faisaient signaler une
  violation à chaque affichage d'Achats** (le critère des 7 jours était
  inatteignable) **et n'entraient JAMAIS dans la réserve hors ligne**
  (`rechaufferQr` et le service worker ne prennent que https — pré-existant,
  déjà sur main). Mesuré (lecture seule) : `qrUrl` http = p.vintedgo.com ×15
  seulement, tous les autres hôtes en https ; aucune adresse
  `https://p.vintedgo.com` nulle part en base. ⇒ **Une règle dans `qrImage`**
  (`qrEnHttps`, §11 : tous les lecteurs du QR passent par elle) : un QR hébergé
  en `http://` est rendu en `https://` — ce que le navigateur fait déjà de
  lui-même sur vrm.center (mesuré par la revue dans Chromium : la demande part
  vers https). ⚠️ **Non mesuré** (aucun appel à Vinted d'ici) : que
  p.vintedgo.com réponde en https — c'est l'adresse que Chrome lui demande déjà.
- **Le journal des violations ne voyait ni le reçu ni la facture**, et ne disait
  pas quel écran avait parlé (`ecran` vide : l'app retire `?tab=` de l'adresse).
  ⇒ `ecouterViolationsCspDans(doc, …)` (src/plantages.js) écoute aussi le
  document des fenêtres que l'app ouvre (`ecouterFenetreCsp`, après
  `w.document.open()` — `open()` efface les écouteurs posés avant — et avant
  d'écrire), `ecran` = `fenetre:recu` / `fenetre:facture` ; l'écran de la page
  se lit dans `history.state.vrmTab` (main.jsx, `ecranCourant`). Les workers,
  le service worker et l'onglet du bordereau PDF restent invisibles d'une page :
  le critère de bascule est réécrit en deux moitiés (ci-dessus).
- **Le service worker rangeait toute adresse ouverte par un lien vers
  `/hl-qr?u=…`** (n'importe quel site, sans limite) dans le stockage de
  vrm.center. ⇒ Une navigation vers `/hl-qr` répond 404 sans rien demander ni
  ranger ; le service worker ne va chercher que pour une image ou pour
  `rechaufferQr` (en-tête `x-vrm-hl-qr: 1`) ; la réserve garde au plus `QR_MAX`
  (60) entrées, les plus anciennes partent d'abord.
- **Preuves** (§6.1, arbre `git archive cab152a`, build refait là, scripts
  copiés dedans) : `audit-csp.cjs` **10 rouges** sur l'avant (section « revue du
  22 oct. »), 0 après ; `csp.cjs` **17 rouges** sur le build de cab152a (aux deux tailles : la violation `img-src ← http://p.vintedgo.com` sur Achats, le QR demandé en http, `ecran` vide, « Imprimer »/« Fermer » muets après rechargement, rien au journal pour le reçu ni la facture ; puis le QR Vinted Go hors de la réserve, 3 pages tierces rangées par 3 navigations, aucune borne), 0 après ; `hors-ligne.cjs` (un colis Vinted Go en http ajouté à ses données) **8 rouges** sur l'avant (le QR gardé vide dans la photo, jamais en réserve, absent hors ligne — aux deux tailles), 0 après.
  Mutations (deux builds mutés, `ECRANS=cat_achats`), chacune rouge sur SON contrôle : script du reçu retiré ⇒ « Imprimer »/« Fermer » muets après rechargement (4) · journal non posé sur le reçu ⇒ rien au journal (2, la facture reste verte) · `qrEnHttps` neutralisé ⇒ violation + QR en http + hors réserve (5) · garde de navigation retirée ⇒ pages tierces rangées (1) · écran lu dans l'adresse ⇒ `ecran` vide (2) · secours non gardé ⇒ « print() appelé 2 fois » (2) · borne retirée ⇒ 67 entrées pour 60 (1).
- Après : `csp.cjs` complet **128 verts, 0 rouge** ; en vigueur
  (`BANC_CSP_EN_VIGUEUR=1`, `ECRANS=journee,cat_achats`) vert — le script du
  reçu passe sous `script-src 'self'` ; `hors-ligne.cjs` vert ; `sw-cache.cjs`
  vert ; les **143 audits** verts.
- **Non mesuré** : un vrai Safari iOS (la fenêtre du reçu et son script, le
  journal dans la fenêtre) ; que p.vintedgo.com réponde en https (voir plus
  haut) ; la vraie production (aucun déploiement d'ici).

**Revue du 23 octobre — quatre défauts reproduits sur 5f6943d, corrigés** (même branche, extension toujours non montée) :
- ⚠️⚠️ **Un message « fiche » se FORGEAIT.** `content.js` relaie tout message
  étiqueté de la page : n'importe quel script de vinted.fr postait `{kind:'fiche',
  itemId: <n'importe laquelle de ses annonces>}` SANS aucune requête chez Vinted,
  le texte remplaçait la description rangée et partait dans les files Leboncoin et
  eBay, publié sous son nom (reproduit : « Paye-moi hors plateforme… » dans la file).
  Le rapport du chantier disait « au pire une de ses annonces jusqu'à sa prochaine
  modification » : c'était sous-estimé. ⇒ `ficheDeLaPage` juge l'ONGLET émetteur
  (`sender`, posé par le navigateur) : une modification n'est rangée que de l'onglet
  qui montre CETTE annonce (`/items/{id}/edit` ou `/items/{id}`) ou qui l'a ouverte
  en édition il y a moins de 30 min (`vrmOngletsAnnonces`, noté par
  `tabs.onUpdated` : la page peut changer d'adresse juste après l'enregistrement) ;
  une publication, que de l'onglet dont la réservation de numéro vient d'être liée
  à CETTE annonce (`vrmOngletsPublications`, posé par `noterPublication`) ; sans
  provenance, rien. ⚠️ **Reste, dit tel quel** : un script de la page peut changer
  l'adresse de SON onglet (`history.pushState`) vers `/items/{X}/edit` puis forger
  la fiche de X — la falsification vaut pour l'annonce que montre l'onglet, plus
  pour toutes ses annonces de n'importe quelle page ; et un tel script peut de toute
  façon modifier l'annonce chez Vinted lui-même, avec sa session.
- **La fiche ignorait « Non, ignorer ce compte »** et les comptes supprimés
  définitivement : `noterFicheVinted` passe maintenant par `compteNonCapte` (la
  porte des cinq autres captures, 5.191) ; cookie illisible ⇒ on capte, comme elles.
- **Vinted lent ⇒ la même annonce partait plusieurs fois d'affilée** (4 tours
  d'alarme pendant qu'une page tarde : `800@0s, 800@240s ×3`). `tickPhotos` est
  SÉRIALISÉ (promesse en vol + verrou daté `vrmPhotosTour` de 3 min dans
  `chrome.storage.local`, qui survit à un redémarrage du service worker) ; le mémo
  de l'annonce est enregistré AVANT la requête (`majMemoPhotos`, clé par clé sur la
  valeur relue) ; l'écart de 45 s se compte depuis la RÉPONSE ; et `vintedGetHtml`
  est borné à 30 s (`AbortController`) — sans ça une page muette tenait la file
  Vinted entière (bordereaux, réponses, ventes derrière elle).
- **« Les photos étaient la SEULE cause des pauses » était faux** (commentaire et
  ce dossier) : 23 des 27 (tous les 429) ; 4 sont des 403 ailleurs. Corrigé.
- **Prouvé** : `audit-fiche-modif.cjs` 35 contrôles — **7 rouges sur 5f6943d**
  (copie `git archive`, audit lancé depuis elle), 0 après, 3 mutations nouvelles
  rouges (onglet ignoré, publication sans réservation, compte refusé ignoré) ;
  `audit-photos-etalees.cjs` 43 contrôles — **7 rouges sur 5f6943d**, 0 après,
  5 mutations nouvelles rouges (tours non sérialisés, verrou retiré, mémo après la
  page, écart depuis le départ, page sans délai). `_fond-vm.cjs` passe le signal
  d'interruption au faux Vinted (non énumérable). Les 70 audits qui exécutent
  l'extension relancés un par un : verts sauf les 2 attendus tant que la version
  n'est pas montée (`audit-extension-zip`, contrôle de version
  d'`audit-preuve-vente`) ; bancs `badge`, `popup`, `session`, `numero-vinted`
  verts. **Non mesuré** : l'adresse exacte de la page de modification de Vinted
  (`/items/{id}/edit` supposée, `/items/edit/{id}` acceptée aussi — jamais vue
  d'ici) et que `sender.tab.url` d'un vrai Chrome la porte au moment du relais
  (une navigation APRÈS l'enregistrement est couverte par `vrmOngletsAnnonces`) :
  une fiche refusée à tort se verra au compteur `fiche_onglet_refuse` de
  `panel_diag_capture` ; la durée réelle d'une page photo chez lui.
  N°18 depuis VRM → Leboncoin → Annonces. La ligne de la N°18 venue de sa marque
  « publiée » part quand sa page profil a été relue APRÈS (sinon elle reste, avec
  le doute dit une fois).


### Colis à retirer fiables : la date limite et le lieu lus, « à vérifier » plutôt qu'« à retirer », un compte inconnu ne cache plus rien (23 octobre)
Julien : « nouveau colis Mondial Relay mais c'est pas mis à jour dans l'app… je veux que ça soit fiable, pour l'instant c'est catastrophique ; il doit prendre en compte si une paire est repartie au vendeur et n'est plus disponible ».
- **Mesuré (lecture seule, copie du 23 oct. dans `scripts/bancs/fx/`, gitignorée)** : le **Mondial Relay du 21 octobre** (TABA'VAP, Vannes) était bien à l'écran — mais dans le DERNIER bloc (~1 729 px à 390), « lieu non indiqué », sans date limite, sans son n° de suivi visible (le seul numéro de l'e-mail et de la notification), sans compte : l'e-mail est arrivé sur l'adresse de loladupuis35260, reliée à VRM seulement le 22. Causes :
  · Mondial Relay écrit « RETRAIT JUSQU'AU 26/10 », **sans l'année** : la route n'en lisait qu'à 4 chiffres — **22 Mondial Relay disponibles sur 22** et 4 Vinted Go sur 4 sans date limite. L'app supposait alors 14 jours ; ce que les transporteurs gardent VRAIMENT, lu dans ses e-mails : Mondial Relay 5 j, Chronopost 4 à 7 j, Vinted Go 6 j. Un colis reparti restait « à retirer » une semaine de plus.
  · « POINT RELAIS® » (le ® en fin de ligne) refusait l'en-tête : lieu vide (TABA'VAP, TERRA CBD) alors que le nom et l'adresse étaient dans les lignes gardées (`extraitLieu`). Sans date ni lieu, son urgence valait l'infini : dernier bloc, toujours.
  · « Information sur votre colis » de Chronopost (« sera disponible dans les prochains jours dans votre Relais Pickup ») était rangé « disponible », avec ce texte pour LIEU, compté et notifié « à retirer » (2 colis pas encore arrivés).
  · Un achat Vinted vu « déposé en point relais » était cru sur une capture de 9 jours (Salomon XT6 de jujuf38) ; aucune borne d'âge.
  · Le widget comptait 1 (le résumé de l'extension, sans aucun colis d'e-mail) quand l'app disait 7 ; les rappels du matin et du soir ne parlent pas des colis à retirer ; la cloche est retirée depuis le 17.
  · ⚠️ **PRÉSOMPTION, pas une identité** : ce Mondial Relay et le Chronopost Terra CBD du 22 correspondent sans doute à deux commandes déjà finalisées (même heure, même adresse de réception, même rue). Aucune transaction ne porte ces n° de suivi : VRM ne les relie PAS (§5), ils restent « à retirer » jusqu'à ce qu'il coche.
- **Une règle partagée** `api/_lib/retrait-colis.js` (app, `api/email-inbound`, `api/widget`, §11) : `limiteRetraitDepuisTexte` (avec ou sans année ; sans année : l'année de la réception à Paris, la suivante si la date tombe avant la veille ; acceptée seulement de la veille à +30 j, sinon rien), `lieuDepuisExtrait` (nom · rue qui commence par son numéro · code postal + ville, sinon rien), `etatRetrait` (`a_retirer` · `delai_depasse` : la limite ÉCRITE est passée · `trop_long` : sans limite, plus de `GARDE_MAX_J` = **7 j** au relais — un seuil d'affichage, jamais présenté comme une date), `urgenceTri`, `retirerPublie`. Les entités HTML (« jusqu&rsquo;au ») : `api/_lib/entites-html.js`, une table pour la route et la règle.
- **La route** lit la date limite et le lieu « POINT RELAIS® » ; un « sera disponible » sans code = **en transit** (`annonceArriveeFuture`, plus de notification « à retirer ») ; « retourné à l'expéditeur / repart chez l'expéditeur » = statut **`retour`** (clé `retour-{suivi}` à part, catégorie `colis`, « le transporteur écrit qu'il repart chez l'expéditeur — vérifie le remboursement ») ; la notification dit « à retirer jusqu'au jj/mm » ; aucune adresse de compte reconnue ⇒ l'adresse de réception est gardée (`recuSur`). **Les lignes déjà rangées** : `reclassifyTrack` relit lieu et date dans le texte gardé (`extraitLieu`, `extraitCode`) ; s'il n'y est pas, « Date limite de retrait inconnue — un point relais garde un colis 4 à 7 jours », jamais une date inventée.
- **Achats → À retirer** : ne compte que `a_retirer`. Bloc **« N colis à vérifier — sans doute repartis chez le vendeur »** (délai écrit dépassé, plus de 7 j, ou achat Vinted vu au relais sur une lecture ancienne — son âge dit) : visibles avec code et QR (peut-être encore là), jamais comptés, jamais « perdu », geste « Je l'ai eu ». **« Reparti au vendeur »** seulement par IDENTITÉ : e-mail `retour` du même n° de suivi, ou commande reliée par n° de suivi (`shipment.tracking_code` de la transaction) ou par code de retrait (`panel_colis_relais`) qui dit non réclamée / remboursée / annulée ; finalisée ⇒ le colis sort. Jamais par titre (une commande au même titre ne fait rien — prouvé). **Compte** : celui de la route, sinon l'adresse gardée ↔ e-mail du compte déclaré après coup ; inconnu ⇒ « compte non reconnu » dit UNE fois (et « Relie-la dans Réglages → Comptes liés » quand l'adresse est connue), le colis n'est jamais écarté. **Carte** : n° de suivi, compte, « À retirer jusqu'au 26/10 » ; les blocs se trient sur ce qui reste de la garde (un colis sans date ne passe plus derrière tous). **Fraîcheur** : « Achats relus il y a 9 j sur jujuf38 et 6 j sur julatace35260 — … », une fois, neutre (§7).
- **Ma journée** : la tuile « À retirer » = le même nombre qu'Achats (`txSuivisColis` : le même ensemble d'achats relie les e-mails sur les deux écrans — les achats au point relais, plus, seulement s'il y a un colis d'e-mail en attente, ceux achetés depuis trois semaines avant le plus ancien ; une fenêtre fixe de 60 jours faisait lire 455 n° de suivi pour 140 au point relais, banc `vitesse.cjs`), « dernier jour pour retirer », « N colis à vérifier ». **La publication `vrm_colis_retirer`** (désormais synchronisée : le serveur ne la voyait pas) porte `{total, aVerifier, urgents, colis:[[limite, arrivée]], vus, vusTx, at}` ; **le widget** la relit avec la règle (une limite qui passe app fermée sort du compte), ajoute les colis arrivés depuis (e-mail ou achat Vinted relu après `at`, comptes masqués exclus), dit `pickupSource`, `pickupAuMoins`, `pickupAVerifier`, `pickupUrgents` ; sans publication, l'ancien compte (résumé de l'extension), « au moins ».
- **Sur la copie réelle, après** : Achats « 2 colis à retirer · 5 à vérifier » — le Mondial Relay Taba'Vap en tête à 637 px avec son n° et « date limite inconnue » ; Terra CBD « À retirer jusqu'au 29/10 » ; les deux Chronopost « Information » sortis (en transit) ; à vérifier : deux Kusmi Tea (8 et 9 j), la Salomon XT6 (jujuf38, « Vinted disait déposé il y a 9 j »), Speed Queen (14 j), un Mondial Relay (15 j) ; « 2 colis : compte non reconnu » ; Ma journée « 2 À retirer » et « 5 colis à vérifier ». Avant : 7 « à retirer ».
- **Preuves** : `audit-retrait-fiable.cjs` (règle, vraie `parseCarrierEmail`, vraie route `email-inbound` qui range limite, lieu et retour, règles de l'app par Babel, vraie route `widget`) **47 contrôles**, **17 rouges sur 634f142** ; `--prouve` **13/13** (limite ignorée, date passée encore « à retirer », année absente, widget sans les nouveaux / qui recompte un rappel / sans Vinted / avec un compte masqué, entités en espace, annonce sans code « à retirer », clé de retour commune, retour sans statut, limite pas relue dans l'extrait, annonce gardée « à retirer » par l'app). Banc `colis-fiables.cjs` (données inventées à la forme mesurée, 390 clair, 390 sombre, 1512, puis l'horloge au 27 oct.) **82 contrôles**, **69 rouges sur le build de 634f142** ; mutations de l'app, chacune rouge : compte vide écarté, rapprochement par titre, date passée encore « à retirer », limite ignorée, Ma journée sans l'index des achats. `audit-retrait.cjs` et `audit-statuts.cjs` suivent la règle (ils lisaient une fenêtre de texte fixe) ; `audit-transporteurs.cjs` donne la règle partagée à `reclassifyTrack` ; `oublies.cjs` lit le bloc « à vérifier » ; `comptes-sans-email.cjs` le trouve par son attribut ; `journee-widgets.cjs` sert un colis au DERNIER jour (compté par l'ancien et le nouveau build : la comparaison « mêmes chiffres qu'avant » reste juste) et juge le délai dépassé à part — section H **6 rouges sur le build de 634f142** ; le faux PostgREST de `widget-colis.cjs` prenait la clé `vinted_accounts_hidden` de `main` pour la table des comptes (§6.3).
- **31 bancs voisins relancés un par un, build d'après contre build de 634f142** (retrait, retrait-lieux, colis-arrivee, colis-relais-push, rappel-soir, a-confirmer, hors-ligne, achats-messages-premium, journee-premium, journee-widgets, statuts-colis, widget-colis, widget-multi, oublies, codes-hors-ligne, retrait-carte, retrait-conv-push, serveur, ship-multi, colis, premierjour, comptes-sans-email, equipe, carte, cartes-vivantes, colis-heure, revue-ecrans, revue-19oct, revue-20oct, revue-21oct, vitesse) : verts, sauf des rouges **identiques sur 634f142** — retrait 12, colis 7, carte 4, revue-19oct 7, revue-20oct 12, revue-21oct 12 (dates des fixtures, écrans hors colis) — et `vitesse` « au plus 13 rendus de Ma journée à 390 px » (médianes 12 à 15 selon la passe, 14 sur 634f142 : le bruit de la machine déjà noté) ; `journee-widgets` est sorti une fois rouge pendant un build concurrent (« OK quitte le mode Modifier »), vert relancé seul (167). Tous les audits verts (151, hors les 5 qui demandent Postgres).
- **Non mesuré** : d'autres formes d'e-mail que celles vues (une date « avant le » d'un autre transporteur sera lue si elle suit le même motif, sinon « inconnue ») ; un relais qui garde plus de 7 j (le colis passe « à vérifier », toujours visible avec son code) ; le script du widget de l'iPhone ne lit pas encore `pickupAVerifier` ; l'extension (`AT_RELAY`) n'est pas touchée — pas de 5.214 ; les rappels du matin et du soir ne parlent toujours pas des colis à retirer (pas demandé).
- **Gestes de Julien** : cocher « J'ai retiré » sur Taba'Vap (Mondial Relay, arrivé le 21) et Terra CBD (Chronopost, arrivé le 22) s'il les a eus — VRM ne peut pas le prouver ; regarder les 5 « à vérifier » (« Je l'ai eu », ou la conversation dit le remboursement) ; repasser sur Vinted connecté sur jujuf38 et julatace35260.

#### Revue du 23 octobre — quinze défauts reproduits, corrigés
Deux relecteurs ont REPRODUIT chaque défaut (vraie route, vraie règle, rendu sur la copie réelle et sur données inventées) ; chacun est corrigé, rouge sur 6b96802 (§6.1, arbre archivé, contrôle lancé depuis lui), vert après, rouge sous mutation.
- ⚠️⚠️ **Un RAPPEL était rangé « reparti »** (régression de 71c6d19) : sans les accents, « ton délai de retrait expire demain » s'écrivait « expiré » ; « Si votre colis n'a pas été retiré dans les délais, il sera retourné » passait la garde (elle ne voyait que « s'il »). Sur la vraie route, un Vinted Go encore à la consigne passait « Reparti chez l'expéditeur », sortait de « à retirer » et faisait sonner « Colis reparti ». ⇒ `api/_lib/etat-colis-email.js` juge le retour PHRASE PAR PHRASE : une phrase qui pose une condition ou une échéance (`CONDITION` : si, s'il, une fois, passé ce délai, au-delà, faute de, sinon, lorsque, dès que…) ne constate rien ; le délai ne compte qu'avec son auxiliaire (« est dépassé », « a expiré ») ; un retour lu dans le SEUL corps d'un e-mail au sujet neutre ne vaut pas si le sujet est un rappel (`SUJET_RAPPEL` : « Rappel », « récupère ton colis », « Libère de la place », « Le temps file ») ou si une phrase dit que le colis attend encore (`ATTEND`). L'autre sens est gardé : « il a été retourné à l'expéditeur », « est en cours de retour » restent des retours.
- **Un e-mail plus ANCIEN traité après un plus récent faisait redescendre un colis disponible** (« Information… sera disponible dans les prochains jours », « en route ») : le script Gmail lit sa boîte du plus récent au plus ancien. ⇒ `conserverRetrait(précédent, nouveau, plusRecent)` : une ligne disponible (code, QR ou vrai lieu) ne redescend jamais en transit / info, un colis reparti ne redevient jamais disponible, SAUF si la date Gmail (`sourceDate` → `emailAt`, gardée sur la ligne, `dateDeLEmail`) PROUVE que l'e-mail est plus récent. L'état gardé garde le sujet qui l'a posé.
- **Sans date limite écrite, la garde est celle du transporteur** (`GARDE_PAR_TRANSPORTEUR`, `gardeDe` : Mondial Relay 5 j, Vinted Go 6 j, Chronopost 4 j — la plus courte mesurée ; autre : 7 j). Le Mondial Relay 38235759 (« RETRAIT JUSQU'AU 26/10 », jamais rangée) restait « à retirer » le 27 et le 28. Au-delà : « à vérifier », toujours visible avec son code.
- **Le jour d'un colis se compte à l'heure de Paris** (`jourDe` par `Intl`, formateur gardé) : sur Vercel (UTC), une arrivée à 00 h 30 à Paris tombait la veille et le widget disait « à vérifier » un jour avant l'app.
- **La date limite parmi plusieurs** : toutes les dates « jusqu'au / avant le » sont relevées ; celle qui suit un mot de retrait l'emporte (« Offre valable jusqu'au 15/11 » au-dessus de « RETRAIT JUSQU'AU 26/10 » donnait le 15/11) ; à défaut, la fenêtre [veille, +30 j] ; deux dates qui se contredisent ⇒ rien. L'année d'avant est essayée (« jusqu'au 31/12 » reçu le 1er janvier).
- ⚠️ **Le widget relit chaque colis de la photo par son IDENTITÉ** (`retirerPublie(pub, …, sorti)`, `sortisDepuisPhoto`) : « e:<n° de suivi> » sort s'il est coché retiré, si une ligne du même n° dit retiré (delivered) ou reparti (retour écrit depuis son arrivée), ou si plus aucune ligne ne le dit disponible ; « v:<compte>:<transaction> » sort si la capture de ce compte, POSTÉRIEURE à la photo, ne le dit plus au point relais. Avant : un colis retiré ou reparti après la dernière ouverture de l'app restait compté jusqu'à sa date limite, présenté comme complet. Ce qu'il n'a pas pu relire (lecture ratée, publication d'avant sans identité) reste compté et le widget dit `pickupPhoto` (« photo du … ») ; `pickupSortis` dit combien sont sortis. Les lignes d'e-mail sont lues UNE fois (`lireSuivisEmail` : disponibles + `in.(delivered,retour)`, scalaires seulement).
- Preuves : `audit-retrait-fiable.cjs` **+5 blocs** — **24 rouges sur 6b96802** ; `--prouve` **29/29** (dont 16 nouvelles : expire au présent, condition ignorée, sujet de rappel ignoré, « attend » ignoré, ordre ignoré, retour ressuscité, date de l'e-mail ignorée, garde unique, jour du processus, première date, année d'avant absente, widget sans identité, retiré ignoré, retour ignoré, relecture Vinted ignorée, photo muette). Le faux PostgREST de l'audit lit `in.(…)`.
- **Côté app (même revue)** :
  - ⚠️⚠️ **Ma journée HORS LIGNE comptait les « à vérifier » dans « à retirer »** et écrivait « hors délai » sur des colis sans date limite (mesuré sur sa copie : en ligne 2, hors ligne 6 « hors délai »). La photo passe en **v2** (`src/journeeHorsLigne.js`) : `retirer` = EXACTEMENT les colis de la tuile en ligne, avec leur date limite LUE ; `aVerifier` à part (ceux qui ont encore un code ou un QR, e-mail OU Vinted), avec leur raison (`delai_depasse` + la date, `trop_long` + la garde du transporteur), `nAVerifier` = tous. Une photo v1 est relue convertie (ses « hors délai » sortent de « à retirer »). Sur sa copie après : 2 et 2.
  - ⚠️ **Les e-mails de suivi illisibles faisaient disparaître les colis en silence** : « À retirer 1 » (les seuls colis Vinted), « aucun email de suivi reçu ». Trois états (`tracking === null` pas lu · `trackingKO` dernière lecture ratée, la liste d'avant gardée) : Achats dit la panne UNE fois avec « Réessayer » (`data-suivis-ko`, 44 px), l'onglet « À retirer » et la tuile de Ma journée disent « — » (titre : pourquoi), la réception des e-mails se tait. Et **pendant la lecture** (défaut 12) : la tuile dit « — » et la ligne « à vérifier » attend — plus de total partiel qui change sous ses yeux ; « Tout est à jour » exige les e-mails lus.
  - **La publication relue par le widget porte l'identité et le transporteur** de chaque colis (`[limite, arrivée, transporteur, e:<suivi> | v:<compte>:<tx> | k:<clé>]`) — jamais un code ni un lieu. Les textes « à vérifier » disent la garde de SON transporteur (« plus de 6 jours » pour Vinted Go), plus « 7 jours » pour tous (Achats, Ma journée, équipe, hors ligne).
  - **Un « disponible » sans code, lieu ni QR lus mais avec son n° de suivi est montré** (il était jeté tant qu'il était récent, sa notification « arrivé » partie) : « Code pas lu — ouvre l'e-mail du transporteur », « Suivi ↗ » (44 px), compté « à retirer » mais pas « prêt » (`sansCodeEmail`).
  - **« N ont encore leur code »** suit la règle des lignes (`aEncoreCode` : e-mail OU conversation Vinted) — il ne comptait que les e-mails. **L'âge de la lecture d'un compte** est dit une fois : un compte nommé par la ligne de fraîcheur (≥ `FRAICHEUR_ACHATS_J` = 2 j, `joursAchatsRelus`) ne se redit plus sous chacun de ses colis.
  - **Ma journée ne décompresse plus les transactions de tous les achats** parce qu'un vieux « disponible » jamais coché (à vérifier) élargissait la fenêtre de `txSuivisColis` : seuls les colis à retirer la fixent. Sur sa copie : 121 → 61 transactions (la fenêtre de 21 jours des 2 colis vraiment à retirer reste, règle du 22 oct.).
  - **Équipe** : les colis d'e-mail « à vérifier » ont leur bloc avec leur raison et leur code (ils étaient filtrés, invisibles pour l'aide).
- Preuves (app) : banc `colis-fiables.cjs` (+ « revue » 390/1512, suivis KO, suivis lents, 27 oct. à la garde Mondial Relay) **29 rouges sur 6b96802**, 0 après (118 contrôles) ; `hors-ligne.cjs` scénario D **8 rouges** ; `equipe.cjs` **2 rouges** ; trois builds réaffaiblis, chacun rouge sur SES contrôles (A : suivi seul jeté, code e-mail seul, âge redit, fenêtre élargie, publication sans identité — 15 rouges ; B : « pas su » lu vide, photo mêlée, équipe filtrée — 5 + 8 + 2 ; C : transporteur ignoré, tuile partielle — 6). `audit-journee-hors-ligne` : v2 et v1 convertie, `--prouve` 5/5 (l'ancre `soir-faux`, périmée depuis le 22 oct., suivie). `revendeurs.cjs` mis à la règle du 23 oct. (une date limite passée ⇒ « à vérifier » ; le n° de suivi est sur la ligne, jamais un code) : vert (210).


### Suppression ciblée : bordereaux et relevés séparés des ventes (26 octobre, PR #738)
Julien : « sépare les bordereaux et relevés des ventes ». La case « Ventes » de la
fenêtre « Supprimer des données… » emportait aussi les bordereaux (PDF) et les
relevés de versement — trois notions sous une case.
- `familiesDeCompte` : `label*` → `scopes.bordereaux`, `releve_*` → `scopes.releves` ;
  « Ventes » ne garde que `orders_sold$|txn_|billing$` (la compta se calcule sur
  eux, pas sur les bordereaux/relevés). Deux cases de plus dans la modale, prises
  dans « Tout supprimer » et dans `rienCoche`/`tout`.
- La **garde de préfixe EXACT** (le `_` joker de PostgREST `like` — le compte 35
  n'efface jamais le 352) et le reste du périmètre ne bougent pas.
- Preuves : `audit-suppr-compte.cjs` (exécute la VRAIE `familiesDeCompte`) étendu.
  §6.1 : **5 rouges** sur le code d'avant (Ventes prenait encore `label`/`releve`,
  les scopes `bordereaux`/`releves` n'existaient pas), 0 après. Build + banc de
  rendu verts.


### Statut chez le transporteur, tour 1 : un colis sorti l'est PARTOUT (29 octobre)
Plainte de Julien : un colis que le transporteur dit retiré, livré ou reparti
restait « à retirer » (Achats, Ma journée, widget, rappels), et un achat Vinted
sans code s'affichait à côté de son propre e-mail. Règles (une, un propriétaire) :
- **Arrivée SÛRE ≠ borne** (`etatColisVinted` : `arriveeSure`, `borneMs`) : la
  capture des achats n'est jamais l'arrivée d'un retour ; `sortiParSuivis(…, {borne})`
  (retour/incident comptent sans arrivée sûre ; un statut inconnu après la borne).
  La publication `vrm_colis_retirer.colis` porte `[limite, arrivée, transporteur,
  clé, sûre 1/0, n° d'un achat Vinted, limiteAt]` + `enVerification` ; le widget
  relit avec la même règle (`issueDesFins` : incident ⇒ « à vérifier », jamais
  « sorti » ; un n° que le transporteur seul dit disponible depuis la photo est
  compté ; `pickupAuMoins` si des achats sont en vérification).
- **Un colis qui sort de « à retirer » atterrit ailleurs** : e-mail resté « en
  transit » ou n° ajouté à la main, que le transporteur dit reparti/incident ⇒
  « repartis » / « à vérifier ». Repartis : 30 jours (`repartiAffichable`), toutes
  sources. **Un n°, une carte** : un achat sans code au n° d'un e-mail connu ne
  s'affiche pas deux fois. Achat sans code NI n° à côté d'un e-mail sans commande
  ⇒ « en cours de vérification » (Achats + une ligne de Ma journée), hors total.
- **Plus de fenêtre de 45 j** chez les lecteurs (app, widget, cron) : une ligne
  finie se lit toujours. **Mondial Relay** : route/prise en charge APRÈS
  « N jours restants » ⇒ `incident/quitte_relais` ; une limite « vers le » passée
  ne lève jamais la garde ; `introuvable` à un code postal saisi non prouvé ⇒
  `cp-inconnu` + `cpRefuse` (corrigé ⇒ relu tout de suite ; un n° fermé ainsi
  sous l'ancienne règle se relit). **Vinted Go** : retour seulement sur les
  valeurs relevées (`return_cancelled` n'est pas un retour), `limiteAt` (l'heure
  d'`expiration_time`) jusqu'à la carte, `etatRetrait` (heure passée ⇒ délai
  dépassé le jour même) et le rappel (« avant 10 h 34 ») ; n° à 12 chiffres lisible.
- **Rappel du matin** : les n° que le transporteur seul dit disponibles (ligne
  synthétique, comme l'app), sauf commande cochée « Je l'ai retiré »
  (`vinted_pickup_done`, reliée par le n°). Plus jamais « sans doute reparti ».
- **« Sans doute reparti » retiré partout** (Achats, Ma journée, notifications) : mesuré
  le 29, les 5 colis ainsi nommés avaient TOUS été retirés ; « à vérifier », et seuls le
  transporteur ou Vinted disent « reparti ».
- Preuves : `audit-statut-transporteurs.cjs` §9 (**23 rouges sur 8f62e6f2**,
  `--prouve` 49/49) ; banc `transporteurs.cjs` §E (390 + 1512, **29 rouges sur le
  build de 8f62e6f2**, constat d compris) ; `node scripts/prouve-banc-transporteurs.cjs`
  (9 mutations de l'app — borne d'arrivée, « nulle part », une carte, en vérification,
  limite sur la carte et dans la publication, 30 jours, fenêtre de 45 j, « sans doute »
  — chacune rouge sur SON contrôle, build et banc lancés dans une copie de l'arbre).
- **À faire côté extension (v29-colis-ext) pour le constat c** : le n° de suivi d'un
  achat au point relais (`journey_summary`, `harvest_{uid}_suivi_{tx}`) doit être lu
  AVANT de relire les achats en route ; tant qu'il manque, l'app range l'achat « en
  cours de vérification » (hors total) — jamais relié par lieu, date ou titre.
- ⚠️ **Non mesuré** : la vraie forme d'un `return_*` Vinted Go autre que ceux
  relevés ; une vraie séquence Mondial Relay « re-livré » ; aucun appel réel aux
  transporteurs n'a été fait pour ces corrections (formes de `mesures.json`).


## 31 octobre — Colis → « À retirer » : par point relais, sur une carte, avec les arrivées estimées (extension 5.295.0)

Demande de Julien : « l'extension peut essayer de capter le nom des points relais où les
colis vont arriver, pour prévoir ; objectif : une carte avec les colis à aller chercher par
point relais, et des prévisions ». (Elle lève, sur sa demande, le choix du 20 sept. « plus
d'adresse, d'itinéraire ni de carte » sur les blocs « Va à » : la carte est un bloc À PART,
replié, les blocs « Va à » ne changent pas.)

**Ce qui existait** : les colis DÉJÀ au point relais ont leur lieu (e-mail du transporteur,
`extraitLieu`/`lieuDepuisExtrait` ; conversation Vinted, `panel_colis_relais` ; lecture du
transporteur, `lieuNom/lieuCp/lieuVille` — seulement à l'arrivée). Pour un achat EN ROUTE,
**aucune source mesurée ne donne la destination** : la transaction Vinted (`shipment: {}`
sur 284 lignes), les e-mails « en transit » (le lieu au futur est refusé : « dans votre
Relais Pickup », sans nom), les transporteurs (le lieu n'arrive qu'avec « disponible »).
La seule voie plausible est le suivi Vinted (`journey_summary`), dont la forme réelle est
dans `panel_formes_suivi` chez lui — pas lisible d'ici.

**Extension 5.295.0** (`<suivi-regle>`, même texte dans inject.js et background.js) :
- `relaisDestination(réponse brute)` : UN objet sous une clé qui dit le point de RETRAIT
  (pickup, relay, relais, pudo, locker, parcel_shop, service_point…), jamais le DÉPÔT ni un
  relais du vendeur ou d'un retour (drop_off, depot, origin, sender, seller, return…) ni une
  personne (contact, recipient…) ; nom exigé ; rue + code postal + ville gardés seulement sous
  cet objet (l'adresse d'un commerce) ; un texte avec e-mail/téléphone n'est pas une adresse ;
  deux points différents ⇒ `null`.
- `arriveeEstimeeSuivi` : une date sous une clé d'ESTIMATION (estimated/expected/eta/
  planned/promised/prévue), jamais une date limite (deadline/expires/until/retrait), jamais
  sous le point de dépôt ; deux dates ⇒ `null`.
- Rangées dans `harvest_{uid}_suivi_{tx}` en scalaires (`relaisNom`, `relaisRue`,
  `relaisCp`, `relaisVille`, `arriveeEstimee`, `lieuLuAt` — lus en `meta`) ; un relais lu
  remplace l'ancien s'il est AUTRE, complète seulement s'il est le même (une lecture plus
  pauvre ne vide pas la rue) ; « pas lu » n'efface rien ; ils suffisent à réécrire la ligne
  (les étapes restent celles d'avant). Voie passive : la page envoie `relais` à côté du
  contenu allégé, le fond le REFAIT par la règle (`nettoyerRelaisSuivi`).
- `audit-suivi-vinted` : le destinataire de la fixture habite désormais Brest (ses mots
  restent des fuites), l'adresse du point relais est gardée exprès ; +2 contrôles.

**App** (`src/relaisColis.js`, règle pure ; `src/CarteRelais.jsx`) : en tête de Achats →
« À retirer », un bloc replié « Par point relais » : N points · arrivés · attendus. Les
arrivés = les listes de `pickupUnion` (le même compte que l'onglet, §11) ; les attendus =
les achats Vinted en route dont le suivi de CETTE transaction donne la destination (par
identité, jamais le titre ni le relais habituel). Des LIEUX regroupés (nom normalisé sans
accents/ponctuation + code postal ; un lieu sans code postal rejoint le SEUL point du même
nom), jamais des colis rapprochés ; un colis compte une fois (son identité). Par point :
« N déjà arrivés (dont sans code) », chaque achat attendu avec « arrivée estimée le … » ou
« date d'arrivée pas encore dite ». Carte : OpenFreeMap + MapLibre (src/fondCarte.js, la
carte de la communauté, rien ne charge avant le clic) ; une épingle par point au nombre de
colis (accent seulement si des colis ATTENDENT) ; le repère vient de la Base Adresse
Nationale (déjà dans la CSP) sur la RUE + le code postal lus, gardé seulement si sûr (adresse,
score ≥ 0,6, même code postal — `repereDepuisBan`) ; sinon « Pas sur la carte : … » ;
cache `vrm_geo_relais_v1` (commodité, échec relancé après 24 h). Les achats en route sans
destination sont comptés à part. Leboncoin, eBay, Vestiaire : aucune destination lisible
aujourd'hui, rien n'est deviné.

Preuves : `scripts/audit-relais-carte.cjs` (24 : la règle de l'extension exécutée depuis le
vrai background.js, et src/relaisColis.js) — sur l'avant 0 ✅ · 2 ❌ ; mutations rouges
(dépôt, date limite, code postal ignoré dans la clé, code postal BAN ignoré). Banc
`scripts/bancs/retrait-relais-carte.cjs` (390/1512 : un point Kusmi Tea e-mail + conversation
+ attendu, un point sans rue « pas sur la carte », une seule recherche d'adresse avec code
postal, une épingle). ⚠️ Le fond de carte réel n'a pas été dessiné au banc (tuiles hors ligne) :
la carte dit alors « indisponible ici », la liste reste.

**Geste de Julien** : installer la 5.295.0, puis sur Vinted toucher « Suivre le colis » d'un
achat en route (ou laisser la relecture active faire) : si `journey_summary` porte le point
de retrait, il apparaît dans « Par point relais ». Sinon, relire `panel_formes_suivi.journey.forme`
(lecture seule) : la règle se règle sur la vraie forme, sans deviner.

## 31 oct. (soir) — Colis en quatre colonnes, la maquette de Julien (« applique ça »)

Julien a choisi la maquette « Colis sur ordinateur » : « Prêts à imprimer » · « En attente »
· « À retirer » · « Partis », côte à côte, un compteur par colonne, des cartes (vignette,
nom complet en gras, une ligne d'état — ambre si le geste est dû —, le N° en pastille mono
à droite), la carte des points relais en bas de « À retirer », le bouton cobalt « Imprimer
les N prêts » à droite du titre, le sous-titre « Rangés sur ce que tu peux faire
maintenant », la recherche en haut à gauche (touche « / ») et les filtres de site à droite.

**Aucune règle de classement neuve.** `src/colisColonnes.js` ne fait que RANGER, par le
groupe que lui donne déjà une règle de l'app (`cartesColis` dans `Comptabilite`) :
- ventes Vinted : `expeditions()` + `pret` (PDF reçu ou capté) ⇒ prêts ; sans PDF ⇒ en
  attente (« bordereau pas encore lu » tant que la lecture n'est pas finie) ; cochée
  `isShipDone` ⇒ partis (« Coché posté · Vinted ne l'a pas encore vu partir ») ;
- eBay (`colisEbay`) : à poster, à vérifier, ne pas poster ⇒ en attente ; Vestiaire
  (`colisVestiaire`, ventes à envoyer) ⇒ en attente ;
- à retirer : `pickupUnion` — e-mails, conversations Vinted, ET `aVerifier`/`aConfirmer`
  (VISIBLES, marqués « à vérifier », §5 « un colis caché est un colis perdu ») ;
- partis : la même sélection que la section « Partis » (`venteStage`, 45 j).
Un groupe inconnu tombe dans « En attente » marqué « à vérifier » — jamais jeté. La même
identité n'est comptée qu'une fois. Ambre = les seuils existants (`dl <= 1` pour poster,
`jours <= 1` pour retirer — la règle `urgents`), plus les retours.
« Pas su » se dit DANS la colonne (ventes, bordereaux, e-mails de suivi, achats, eBay).
Une colonne de plus de 8 cartes se replie derrière « Voir les N autres » (dit, jamais muet).
Le bouton « Imprimer les N prêts » est l'ancien « Tout imprimer » : `ouvrirLot`, compte
`lignesLot()` (= la colonne). Colis lit maintenant aussi les achats (`loadOrders('purchased')`
sur `bordereaux`). Toute la liste d'avant (actions colis par colis, lot, imprimante,
retours, conflits de N°, eBay, Partis repliés) reste DESSOUS, sous « Colis par colis ».
Un clic sur une carte : prête/en attente ⇒ défile jusqu'à sa carte d'actions ; à retirer ⇒
Achats ; eBay ⇒ sa commande ; Vestiaire ⇒ l'espace Vestiaire. `CarteRelaisColis compacte` :
le fond puis une ligne par point (dans la colonne).

**Barre du haut (ordinateur)** : `BarreHaut` dans la coque (recherche existante, « / » hors
d'un champ ; la recherche cherche N°, modèle, marque — pas l'acheteur, la phrase ne le promet
pas) ; la rangée de filtres d'un écran y monte par `DansBarreHaut` (portail ; téléphone :
elle reste en place). Ventes/Annonces/Messages y envoient leur `FiltreSites` ; Colis y pose
son filtre de site s'il y a au moins deux sites avec des colis (filtre visible, « N colis X
sur M · tout voir »). La loupe de l'île se tait sur ordinateur (la barre la remplace).

Preuves : banc `scripts/bancs/colis-colonnes.cjs` (1512 et 390 px, 11 colis inventés) :
4 colonnes dans l'ordre (côte à côte / empilées), chaque colis dans SA colonne et une seule,
somme des compteurs = total = cartes = 11, compteur écrit = cartes, bouton = prêts et ouvre
le lot, ambre du dernier jour, « à vérifier » visible, 44 px au téléphone, « / ».
Sur l'arbre d'avant (origin/main) : 20 rouges. Mutations : `fait → attente` ⇒ rouge ;
`aVerifier` non rangé ⇒ rouge (rien de perdu, colis douteux).
Non vu au banc : les épingles de la mini-carte (géocodage hors ligne).
