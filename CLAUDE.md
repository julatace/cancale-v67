# VRM — dossier de passation

**Lis ce fichier en entier avant de coder. Il est court exprès.**
L'historique détaillé (chaque session, chaque mesure, chaque erreur et sa cause)
vit dans **`docs/journal-2026.md`** — 7 700 lignes, à ouvrir seulement si tu
cherches *pourquoi* une règle existe. Tout ce qui est nécessaire pour travailler
sans rien casser est ici.

---

## 1. Le projet en dix lignes

Julien revend des sneakers d'occasion sur Vinted (plusieurs comptes). **VRM** est
son outil de gestion : annonces, ventes, achats, colis, numéros de rangement,
comptabilité. Il n'est **pas développeur** et pilote tout par des sessions Claude.

| pièce | où | quoi |
|---|---|---|
| **App** | `src/App.jsx` — un seul fichier, ~22 000 lignes | React + Vite, styles en ligne |
| **Extension Chrome** | `vinted-sync-extension/` | capte les données Vinted depuis SON navigateur |
| **Serverless** | `api/*.js` | emails entrants, widget iPhone, notifications push, IA |
| **Données** | Supabase `app_data` (clé-valeur JSONB) + `vinted_accounts` | pas de vrai schéma relationnel |
| **Prod** | https://vrm.center (Vercel, auto-déployé sur `main`) | |
| **Dépôt** | `julatace/cancale-v67`, **PUBLIC** ⚠️ | branche de travail : `claude/new-session-gzdgur` |

---

## 2. Les règles de Julien — permanentes, jamais à re-négocier

1. **Pousse à chaque modification.** Aucun travail ne reste en local : une session
   qui perd son conteneur perd tout, et la suivante le refait à l'envers.
2. **Déploie toi-même** (autorisation donnée le 5 septembre) : ouvrir une PR
   depuis la branche et la merger. Ne plus lui demander.
3. **N'invente jamais de données.** Aucune ligne de test dans la base de
   production. Les bancs servent des copies.
4. **« Même avec 50 articles identiques, tu ne dois pas pouvoir te tromper »** —
   aucun rapprochement par ressemblance (titre, marque, taille). Voir §5.
5. **Il saisit les prix d'achat lui-même.** Ne pas les deviner.
6. **L'extension se livre en zip qui se dézippe en UN dossier.**
7. **Il n'est pas développeur** : une alerte qui ne dit pas quoi faire ne sert à
   rien ; un chiffre qu'on ne peut pas vérifier est invendable.

---

## 3. Ce qui est refusé, définitivement (redemandé ~8 fois)

Ce ne sont pas des positions de principe : chacune a une raison technique.

| demande | pourquoi non |
|---|---|
| republication automatique en file, avec délais aléatoires | un délai « faussement humain » n'a qu'un usage : tromper la détection bot. C'est ce qui a fait bloquer `vanessa5723`. |
| ~~accepter une offre automatiquement~~ ⚠️ **PÉRIMÉ — VOIR §5** | le refus tenait à une **mesure**, pas à un principe : le code « offre encore en attente » n'avait jamais été observé. Un relevé du **26 août sur 326 offres** l'a trouvé (**10 = En attente**, 4 cas ; 20 acceptée ×118, 30 refusée ×195, 40 annulée ×9). La raison est tombée, et le moteur est livré depuis la **5.38** — bordé : éteint par défaut, plancher obligatoire annonce par annonce, `garde`, 3 par visite, jamais deux fois la même offre. **Ne pas le retirer en relisant cette table.** |
| piloter la souris / le clavier | Vinted reçoit la **même requête** ; en plus un événement synthétique porte `isTrusted:false`, donc ça **ajoute** une preuve d'automatisation. Et un clic aveugle agit à côté quand la page bouge. |
| modifier les photos pour republier / passer sur un autre compte | Vinted relie les comptes par **appareil, navigateur, adresse, moyen de paiement** — pas par les images. Tourner une photo ne protège de rien. |
| supprimer une annonce automatiquement | irréversible et sans confirmation côté Vinted. |
| envoyer des messages en série aux favoris | **Vinted ne dit jamais QUI a mis en favori** (mesuré : aucun endpoint, aucun champ). Il n'y a pas de destinataire. La remise aux favoris de Vinted, elle, touche tout le monde en un clic. |

**Ce qui EST autorisé et automatique** : générer un bordereau et récupérer son
PDF (ça n'engage aucun argent, la vente est faite, le colis doit partir), et
toute **lecture** sur ses propres données.

**Garde-fous de l'extension, à ne jamais retirer** : agir uniquement au nom du
**compte connecté dans l'onglet** (`garde`), plafond de **20 actions/heure par
compte**, plafond par visite, requêtes **une par une** en attendant la réponse.

---

## 4. Les lois du code — chacune a coûté cher

1. **Une liste vide n'est jamais une réponse.** Session expirée, page pas ouverte,
   appel refusé → `[]`, pas une erreur.
2. **Une capture partielle ne doit jamais écraser une capture complète**
   (`listePlusRiche`). Le compteur se lit **en scalaire** (`select=n:data->>nItems`).
3. **`updated_at` ment** : la table n'a aucun trigger, la colonne garde la date de
   **création**. Utiliser `harvestTs(row)` (lit `data.capturedAt`). Toute écriture
   passe par `withOwner`, qui estampille `updated_at`.
4. **Jamais `select=data` sur une ligne lourde** (bordereaux avec PDF, commandes).
   Projeter les scalaires. Un `select=data` sur le widget a crevé le quota d'égress
   (5,7 Go). Quand tu corriges ça côté app, **vérifie aussitôt les `api/*.js`** :
   ils ont leur propre code de lecture.
5. **Supabase plafonne une réponse à 1 000 lignes sans le dire.** Utiliser
   `lireTout(query)` (pagination par en-tête `Range`).
6. **Piège TDZ** : un `useMemo` s'exécute immédiatement — il doit être placé
   **après** tout ce qu'il lit, sinon écran blanc au premier rendu.
7. **`( {/* … */} )` n'est pas un commentaire, c'est un objet vide** → React
   error #31, écran en erreur.
8. **Un helper n'est utilisable que dans la fonction où il est déclaré**
   (`background.js` en particulier). `node --check` ne le voit pas.
9. **Dans un service worker MV3, aucun tampon ne survit à 30 s en variable de
   module.** Chrome tue le worker. Utiliser `chrome.storage.local`.
10. **Une fonction serverless n'est vérifiée que si un banc l'EXÉCUTE.**
    `npm run build` ne compile pas `api/`.
11. **Une découpe par numéros de ligne se vérifie sur ce qui RESTE.** Deux écrans
    entiers ont disparu comme ça, sans qu'aucune erreur soit levée.
    ⚠️ **Et un composant jamais rendu ne lève rien non plus.** `Nav` (un tiroir de
    navigation avec `TABS` et `ARCHIVE_TABS`) était défini, complet, et
    **référencé nulle part** — un `<Nav …>` n'existait pas dans le fichier. Il
    portait une SECONDE navigation, aux libellés différents de la vraie
    (« Stats » contre « Statistiques », un « Comptabilité » qui n'existe nulle
    part ailleurs) et sept emojis-icônes qui ressortaient à chaque audit du §7.
    Retiré le 7 septembre (66 lignes) après avoir vérifié que « Ancien
    catalogue » et « Anciennes ventes » restent joignables depuis Réglages.
    **Avant de « corriger » une navigation, vérifier qu'elle est rendue** :
    `grep -c '<Nom'` — et compter les écrans montés (`tab===`) avant ET après
    la coupe (13 des deux côtés).
12. **`-0 < 0` est faux en JavaScript** (calcul de délais).

---

## 5. Les règles métier intouchables

### L'identité d'une paire
**Jamais par titre, jamais par ressemblance.** Dans l'ordre :
1. **identifiant d'annonce Vinted** — `transaction_id` → détail de transaction →
   `item_id` (`identiteAnnonce`) ;
2. **photo** (`entryKeyByPhoto` : fichier exact, puis dossier **non ambigu**) ;
3. **n° de transaction**, **n° de suivi** — des identités elles aussi.

Mesuré : 22 % des ventes portent un titre en double, et le titre désignait la
**mauvaise** annonce dans 3 cas réels. **Mieux vaut un blanc qu'un faux** — un
numéro faux ne se voit pas, il envoie la mauvaise chaussure.
`scripts/audit-identite.cjs` pose 50 paires rigoureusement identiques et vérifie
qu'aucune règle n'en désigne une.

### Les numéros de rangement
- **Un numéro n'est JAMAIS réattribué** (il est écrit sur un carton réel). Le pool
  est append-only ; `freedNums` a été supprimé — ne pas le réintroduire.
- Le compteur qui monte à 330 pour 30 paires en stock est **normal** : ça veut
  dire 329 paires passées. Ne pas « corriger ». « Renuméroter à la suite » n'est
  plus proposé nulle part.
- **Rien ne change un numéro tout seul.** Les seuls chemins : les champs N° (annonce
  ou vente), le bouton d'un doublon, le bandeau ♻️ de reprise — **tous sur son clic**.
  Seule exception : une annonce **sans** numéro en reçoit un automatiquement.
- **Deux paires présentes sous le même numéro** est le seul risque irréversible de
  l'app : c'est le seul endroit où le rouge est justifié.

### Les chiffres
- **Le chiffre faux est la porte pour le corriger.** « Coût d'achat · 1/184
  renseigné » ouvre la saisie en série ; on n'ajoute pas un bloc pour ça.
- **Un total partiel qui se présente comme complet est pire qu'un total absent.**
  On somme uniquement ce qu'on connaît, et on affiche la couverture à côté
  (« sur 1 vente sur 175 »). Vaut pour le bénéfice, l'argent en attente, l'URSSAF.
- **Une seule règle par notion, un seul propriétaire** : un écran publie
  (`vinted_nums_physiques`, `vinted_urssaf_mois`, `widget_stats`), les autres
  consomment. Ne jamais recalculer ailleurs.
- **Tout est daté au jour de la VENTE.** La date d'encaissement a été retirée
  exprès (elle n'existait que pour une partie des ventes). Ne pas la réintroduire
  sans qu'il le redemande.
- Le rapport comptable dit « CA des ventes finalisées », **jamais « encaissé »** :
  l'URSSAF demande légalement les recettes encaissées, et l'app ne les connaît pas.
- ⚠️⚠️ **LA PHRASE QUI EXPLIQUE UN CHIFFRE DOIT VENIR DE LA MÊME SOURCE QUE LUI.**
  Vu en capture le 8 septembre, sur la carte du mois du Tableau de bord :
  « À payer (13,5 %) **19,32 €** », et juste dessous « Calculé sur le CA des
  ventes finalisées de septembre (**0,00 €**) ». 19,32 € vient bien de
  **143,10 €** — la ligne publiée par l'écran Ventes ; le `0,00 €` venait de
  l'**ancienne archive**, vide depuis juillet 2026. Les CHIFFRES avaient été
  rebranchés sur le bon propriétaire, **la phrase était restée en arrière** —
  et le commentaire du code disait pourtant que l'archive n'était plus la
  source. Sur l'écran où il décide ce qu'il verse à l'URSSAF.
  ⚠️ Même carte, même passe : « Ventes **26** » à côté d'un montant calculé sur
  **2** ventes finalisées. Un total partiel présenté comme complet est pire
  qu'un total absent : c'est « Ventes finalisées 2 · sur 26 vendues ce
  mois-ci » — la couverture À CÔTÉ, jamais à la place.
  ⇒ Le banc `urssaf.cjs` ne lit **aucun libellé pour juger** : il prend les
  nombres rendus et exige `CA × taux = à payer` et `CA − à payer = net`, plus
  l'égalité avec la ligne publiée. Un contrôle posé sur la formulation serait
  vert le jour où quelqu'un reformule (§6.5). 4 échecs sur le code d'avant.

### Le reçu d'achat part chez un comptable
Il dit **qui achète** (l'entité des Factures : raison sociale, adresse, SIRET —
pendant des mois il disait « Ma boutique »), et il dit **qu'il n'est pas la
facture de Vinted** (Vinted n'en émet aucune entre particuliers). La photo passe
par l'extension : le CDN Vinted ne renvoie aucun en-tête CORS.
`scripts/audit-justificatif.cjs` protège ces deux points.

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
  on a encore le code.
- **« Commande non réclamée — retournée à l'expéditeur »** : 3 achats, 84,94 €,
  qui ne sortaient sur aucun onglet (`phaseReception` les range en « annulé »).
  Ils ont leur bloc sur Achats. On dit « à vérifier », **jamais « perdu »** :
  Vinted rembourse souvent tout seul.

### Les prix d'achat : aucun pont automatique, mesuré
**Mesuré le 7 septembre**, en cherchant s'il existait un rapprochement CERTAIN
paire ↔ achat : sur **320 paires numérotées**, seules **4** partagent le nom de
fichier photo d'un achat — il rephotographie ses paires avant de les mettre en
ligne. `panel_buyprices` est vide, `vinted_buyprice_by_num` aussi. **Il n'y a
rien à automatiser** : il les saisit, comme sa règle le dit.
- Ce qui EST juste : la modale trie **les paires vendues d'abord, au CA
  décroissant**. Mesuré : **150 des 320** portent au moins une vente reliée par
  identité (42 % des ventes se relient), et **les 20 premières couvrent 33 % du
  CA reliable**. Vingt saisies rattrapent donc un tiers des chiffres.
- ⚠️ Elle plafonnait à **300 lignes pour 320 paires** : vingt paires n'étaient
  atteignables nulle part alors que l'en-tête les comptait, et la chaîne
  « Entrée » s'arrêtait net à la 300ᵉ. Plus de plafond.
- ⚠️ **`prepAchat` : chaque achat épluché UNE fois.** Le barème comparait
  288 paires × 544 achats = **156 672 appels**, chacun ré-extrayant marque,
  taille, modèle, couleurs et titre normalisé **du même achat**. La modale
  mettait **3,5 s** à s'ouvrir — sur l'écran qu'il doit utiliser 320 fois.
  Après : **~300 ms**, et **exactement les mêmes 26 suggestions** (c'est la
  preuve qu'un jugement métier n'a pas bougé). Le barème vit dans
  `scoreAchatPrep`, qui ne doit **jamais** ré-extraire quoi que ce soit.
  ⚠️ `audit-identite.cjs` cherchait la ligne `const cs = extractColors(t)` et a
  crié au loup : **un audit doit suivre la RÈGLE, pas son orthographe**.

### L'argent : « en attente » et « disponible » ne se confondent jamais
Mesuré le 7 septembre sur ses **neuf porte-monnaie** (`harvest_{uid}_billing`) :
**281,94 € disponibles** à virer, à côté de **2 235,80 € retenus** par Vinted.
Ce sont les chiffres de Vinted, pas une estimation — l'accueil ne montrait que
l'attente, et le disponible ne vivait que dans une phrase d'explication de
l'écran Statistiques. Les deux sont maintenant sur la ligne d'accueil, sur deux
lignes et avec deux mots différents (`escrow`/`main` — jamais `balance` mélangé,
§5.14), et un solde de plus de 7 jours annonce son âge.
⚠️ **Le RELEVÉ daté : ce paragraphe disait le contraire de §8, corrigé le
8 septembre.** Il affirmait « introuvable — Vinted ne charge le relevé que si
on ouvre cette page-là ». C'était vrai de la voie PASSIVE : sous `billing`,
l'extension ne capte que le **solde** (`{main, escrow}`). Mais depuis la
**5.52** `capterReleves` va le chercher activement
(`/api/v2/users/{pid}/payouts?year=&month=`, borné, `garde`, un compte marqué
muet s'il ignore le paramètre). `harvest_*_releve_*` = 0 ligne chez lui **parce
que son extension est plus ancienne**, pas parce que la donnée n'existe pas.
Deux sections du dossier se contredisaient sur le même fait — ne pas relire §8
en croyant celle-ci.

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

### Achats : le compte se nomme UNE fois quand c'est le même
Il a **neuf comptes** et l'extension ne travaille que pour celui qui est
connecté dans l'onglet : savoir lequel est **indispensable**, et ça ne se perd
jamais. Mais vu en capture le 8 septembre : « **compte julatace3535** » écrit
**cinq fois**, sous cinq titres différents, alors que les cinq colis du groupe
sont sur ce compte-là — et « Ouvrir la conversation **→ le code arrive tout de
suite** » cinq fois aussi, alors que l'en-tête du groupe l'explique déjà.
C'est §7 mot pour mot, sur un groupe **uniforme**.
- Le compte est nommé **dans l'en-tête du groupe** quand il est le même
  (« Ils sont tous sur `julatace3535`. »), **sur chaque ligne** quand le groupe
  est mixte — là seulement la ligne distingue.
- Le libellé long ne reste que s'il distingue (groupe mixte, ce colis-ci n'a pas
  son code alors que ses voisins l'ont). Mesuré : **3 098 → 2 875 caractères**.
- Le banc `retrait.cjs` exige **les deux à la fois** : le compte apparaît **au
  moins une fois** (jamais perdu) **et** pas une fois par colis quand ils sont
  tous sur le même. Un contrôle qui n'aurait que la première moitié serait vert
  sur le défaut. Prouvé : « julatace3535 » ×5 avant, ×1 après.
- ⚠️ **Deux erreurs dans mon propre banc, corrigées** : (1) une commande
  moissonnée **ne porte aucun champ de compte** — c'est l'identifiant de ligne
  (`harvest_{uid}_orders_purchased`) qui le dit ; `o.account || o.uid` valait
  toujours `''`, et un `Set([''])` a une taille de 1, donc le banc annonçait
  « sur 1 compte » **en ne mesurant rien**. (2) Sa fenêtre de texte débordait
  sur le bandeau voisin et y lisait un login sans rapport.
- ⚠️ **Et l'uniformité se juge PAR GROUPE, pas sur l'ensemble** : les 6 colis
  sans code sont sur **2** comptes, mais la liste se groupe par point relais et
  celui « à confirmer » en porte 5, tous sur le même. Poser la condition sur
  l'ensemble ne l'aurait jamais déclenchée.

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

### L'écran Ventes : 287 cartes, et la frappe qui saccade
**Mesuré le 7 septembre au banc `perfv.cjs`, sur ses vraies données** : l'écran
rend **287 cartes et 8 840 nœuds** d'un coup (page de 19 885 px sur ordinateur,
**46 209 px sur iPhone**). Chaque lettre tapée dans la recherche les refiltrait
toutes : **293 ms par frappe sur ordinateur, 179 sur téléphone** — taper
« salomon » coûtait deux secondes de saccade.
`React.useDeferredValue(ordSearch)` garde le champ instantané et laisse React
refiltrer juste après → **~150 ms**, et le changement de filtre passe de 334 à
~155 ms. Aucun changement de comportement.
- Les **286 photos sont déjà toutes en `loading="lazy"`** — vérifié, ce n'était
  pas là que ça coûtait.
- **La liste ne dessine plus que 60 cartes** (`ventesAffichees.slice(0, ventesMax)`),
  le reste s'ouvre au bouton **« Voir plus — 60 affichées sur 287 »** : le total
  est écrit dessus, rien n'est caché, et **les totaux du haut portent toujours
  sur l'ensemble** (vérifié au banc : 6 695 € / 224 ventes, identiques avant et
  après avoir déplié). Une recherche ou un changement de filtre remet la tranche
  à 60. Mesuré : **8 840 → 2 194 nœuds**, iPhone **46 209 → 11 577 px**, frappe
  ~150 → **~88 ms**.
- La chaîne de filtres vivait **en plein milieu du JSX** : impossible de savoir
  combien de ventes elle rendait sans la recopier. Elle est dans un `useMemo`
  (§11 : une seule règle, un seul propriétaire).
- `perfv.cjs` garde des planchers (frappe < 250 ms, filtre < 300 ms, zéro image
  non paresseuse) aux deux tailles, et vérifie que « Voir plus » ouvre bien la
  suite sans changer les totaux.
  ⚠️ **Piège du banc** : ses mesures de frappe tapent « salomon » et cliquent un
  filtre — la liste tombe à six cartes et le bouton disparaît légitimement. Il
  faut **remettre l'écran à zéro** avant de vérifier la pagination, sinon le
  banc mesure son absence comme un défaut.

### L'écran Achats : même tranche, et un piège TDZ payé cash
Onglet « Tous », mesuré au banc : **72 880 px de page sur iPhone** — quatre-vingt-six
écrans — pour **544 commandes rendues d'un coup**. Même traitement que les
ventes : `achatsAffiches` dans un `useMemo`, 60 cartes dessinées, bouton
**« Voir plus — 60 affichés sur 534 »**. Mesuré : **8 844 → 1 261 nœuds**,
**72 880 → 9 415 px**, recherche 227 → **69 ms**.
- Le prix s'écrivait **à l'anglaise** (« 21.0 € », « 6.73 € ») : le montant brut
  de Vinted recopié tel quel. Deux décimales et une virgule.
- ⚠️ **§4.6 payé cash** : posé trop haut, ce `useMemo` s'exécute avant
  `trackForBuy`/`achatStage` → **« Cannot access 'Xc' before initialization »**,
  écran Achats mort. Il vit après `achatStage`.
- ⚠️⚠️ **ET LE BANC N'A RIEN VU** : le garde-fou d'écran affiche un vrai texte,
  sans débordement et sans `pageerror` (React attrape l'exception) — donc
  « aucun écran vide », « aucune erreur d'app », **rendu conforme**. C'est la
  CAPTURE qui l'a vu. `verif_visuel.cjs` teste désormais la présence de
  « n'a pas pu s'afficher / Cannot access / is not defined ».

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

### L'écran Messages : il a demandé qu'on RETIRE la liste
« Enlève les messages, mets juste qu'il y en a de nouveaux. » L'écran ne
déroule donc **aucune conversation** — une carte dit combien sont non lus, un
bouton emmène répondre sur Vinted, et les réponses rapides se copient. **Ne pas
remettre la liste** : c'est une décision prise, pas un oubli.
- Ce qui manquait, en revanche : **sur quel compte**. Il en a neuf, et le bouton
  ouvre l'inbox du compte connecté — pas forcément celui qui a les messages. La
  carte nomme maintenant les trois premiers (« sur lllooIlllaa (8),
  julatace3535 (7), julatace35260 (6) et 4 autres comptes »), calculés sur la
  MÊME source que le nombre juste au-dessus (§11) : les deux ne peuvent pas se
  contredire. C'est une information, pas la liste.

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

### ⚠️⚠️ ET UNE LECTURE RATÉE POUVAIT EFFACER UN COMPTE VINTED
Douzième forme du même piège, et la plus coûteuse côté extension.
`captureDomain` efface la ligne `vinted_accounts` d'un compte quand il est dans
la **liste noire** ET qu'il n'a pas été **réautorisé**. Les deux listes se
lisaient en `res.ok ? … : []`, puis le résultat était **mis en cache** (5 min /
60 s) **comme une vraie mesure**. Un 522 devenait donc « liste vide », gardée.
- **Contre-ordre lu vide → la ligne du compte est EFFACÉE.** Un compte qu'il
  vient de réautoriser compte comme encore supprimé : ses jetons partent, il
  doit repasser sur Vinted. C'est mot pour mot « l'extension ne veut pas
  renvoyer mes nouveaux comptes », déclenché par 60 s de lecture ratée.
- **Liste noire lue vide → un compte supprimé se fait re-capter** (le cas
  `shop_cancale`, « il revenait tout le temps »).
⇒ `null` = « pas su » : on **ne met pas en cache un échec**, on garde la
dernière valeur connue, et `captureDomain` **n'efface que s'il SAIT** (les deux
listes lues). Au pire un compte supprimé est re-capté une fois — ça se répare
d'un clic ; un compte vivant qui perd ses jetons, non.
- ⚠️⚠️ **ET MON PREMIER CONTRÔLE NE REPRODUISAIT PAS LE DÉFAUT.** Il faisait
  échouer les **deux** listes à la fois — le compte n'était alors pas dans la
  liste noire non plus, donc aucun DELETE, donc **vert sur le code fautif**.
  Ce qui supprime est le cas **asymétrique** : liste noire lue, contre-ordre
  pas lu. `audit-comptes-noirs.cjs` le sert exprès. **2 échecs** sur le code
  d'avant, 0 après. *Même famille que « lecture KO, écriture OK » pour
  `push_subs` : la panne totale n'est presque jamais le cas dangereux.*

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

### Factures : un pipeline MORT, appelé toutes les 5 minutes
Mesuré le 9 septembre. L'écran Factures appelait `fetchVintedInvoices` — un
**Google Apps Script** (`script.google.com/macros/s/…/exec`) — **au montage et
toutes les 5 minutes**, en silence (`silencieux=true`, donc aucun message).
Interrogé : **404**, réponse HTML. `res.json()` levait, le `catch` avalait, et
l'écran retentait indéfiniment un endpoint qui n'existe plus.
⚠️ Et l'écran vide **disait à Julien** « elles arrivent de tes emails Vinted,
**par ta feuille Google** », avec un bouton « Aller les chercher maintenant » :
il pouvait attendre des factures qui ne pouvaient **pas** arriver, et cliquer
sur un bouton qui ne pouvait **que** échouer — en affichant « Erreur
récupération : … », du vocabulaire d'informaticien par-dessus le marché.
⚠️⚠️ **Le dossier annonçait cette architecture retirée le 30 août** (« plus
AUCUN appelant ») : **c'était faux**, ce caller-ci avait survécu. Même famille
que le tiroir `Nav` — sauf qu'ici le code mort **tournait**. *Une suppression
« terminée » se vérifie sur ce qui RESTE, y compris des mois après.*
⇒ La vraie source vit juste à côté : `fetchProInvoices` lit `email_invoice_*`
en base (les reçus Vinted arrivés par email, `api/email-inbound`). C'est elle
que la boucle des 5 minutes et le bouton relisent maintenant, et c'est elle que
l'écran vide nomme. La porte proposée est « + Nouvelle facture », qui marche.
⚠️ **Et l'URL `/exec` est une URL-CAPACITÉ dans un dépôt PUBLIC** : elle suffit
à invoquer le script, sans mot de passe. `audit-secrets.cjs` la refuse
désormais — elle était morte, mais un Apps Script se redéploie.

### Le mode sombre s'arrêtait aux composants
Mesuré le 9 septembre, app **en sombre** : les cartes étaient bien à
`rgb(26,31,39)` … et **`document.body` à `rgb(246,247,249)`**, le gris clair.
Cause : `index.html` ne gérait le sombre que par **`prefers-color-scheme`**,
c'est-à-dire la préférence du **système** — alors que le mode sombre de VRM est
un **choix** rangé dans `vinted_dark` (§7 : « mode sombre choisi, pas inversé
automatiquement »). `C` était bien remplacé pour React ; le **document**, lui,
restait clair. Téléphone en clair + app en sombre, et il obtenait :
- une **barre d'état blanc cassé** au-dessus d'une app noire (`theme-color`
  valait `#F6F7F9`) — sur l'iPhone où il l'a ajoutée à l'écran d'accueil ;
- un **éclair de gris clair au rebond de défilement** : iOS peint le fond du
  BODY quand on tire au-delà de la page ;
- des **champs natifs en clair** (`color-scheme` n'était posé nulle part) — la
  date d'« Import des emails » sortait en boîte blanche dans l'app sombre.

⇒ Le thème est **estampillé sur la racine** (`data-theme`), par un script de
démarrage d'`index.html` **avant le premier rendu** (sinon l'app s'affiche en
clair puis bascule) et tenu à jour par un effet au clic. Les deux lisent
`vinted_dark` : une seule source (§11).
⚠️ Le média utilisait `#0E1116` alors que `THEMES.dark.bg` vaut `#11151B` — une
**troisième** valeur de fond sombre traînait dans le projet. Une seule reste.
⚠️ Le banc `verif_dark.cjs` mesure la **luminance**, pas une chaîne : comparer à
« #11151B » serait vert le jour où la palette change de teinte. Ce qui doit
rester vrai : le fond du document est sombre, la barre d'état suit, les champs
natifs suivent, et la **hiérarchie rail < page < carte** tient (0,0029 <
0,0073 < 0,0135). **8 échecs** sur le code d'avant (4 contrôles × 2 tailles).

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

### « Les annonces que l'on sélectionne » — le cross-posting part d'un CHOIX
Demande de Julien, 11 septembre : « lorsqu'une annonce est publiée sur n'importe
quel compte associé à VRM, je veux que ça publie les annonces que l'on
**sélectionne** sur Leboncoin, eBay, etc. »
Mesuré avant de coder : le « peu importe le compte » **était déjà vrai**
(`buildLbcData` balaie `harvest_*_listings`, tous comptes confondus). Ce qui
manquait, c'est le **choix** : la file prenait TOUTE annonce numérotée en ligne.
- Le choix vit dans `vinted_annonce_numeros[id].mp` — **la même ligne** que le
  numéro, le prix d'achat et le prix plancher. L'app en est propriétaire,
  l'extension le LIT (§11, exactement comme `minPrice`).
- ⚠️ **`undefined` (jamais touché) ≠ `false` (retiré exprès)**, et le défaut de
  Leboncoin vaut **oui** : passer d'un coup à « rien n'est sélectionné » aurait
  vidé sa file du jour au lendemain. *Une nouveauté ne doit pas éteindre ce qui
  marchait.*
- ⚠️ `updatePair` **effaçait l'entrée** quand numéro et prix d'achat étaient
  vides : cocher une annonce sans numéro perdait le choix à la ligne suivante.
  `mp` compte maintenant comme une valeur.
- ⚠️ §7 : « Aussi sur » écrit sur 44 cartes est UNE phrase. Elle vit **au-dessus
  de la grille** (avec le compte, calculé dans `annStats` — même base que la
  grille, §11) ; sur la carte il ne reste que la **puce**, dont l'état change
  d'une carte à l'autre — c'est elle qui distingue, pas le libellé.
- ⚠️ **Une annonce retirée ne disparaît pas en silence** : l'écran Leboncoin dit
  combien et où ça se règle, et « Tout est publié 🎉 » ne s'affiche plus quand
  la file est vide **parce que tout a été décoché** (deux causes, deux phrases).
- ⚠️⚠️ **C'EST L'EXTENSION QUI FILTRE** : une version antérieure à la **5.54**
  enregistre bien le choix mais prépare TOUTES les annonces. D'où
  `EXT_CAPACITES.places = '5.54.0'` — sans quoi l'app promettrait « la puce
  décide » à une extension qui ne sait pas le faire, pour la **quatrième** fois.
  `audit-coherence.cjs` l'a d'ailleurs attrapé tout seul : j'avais déclaré la
  capacité sans l'inscrire dans `FONCTIONS`, il est sorti rouge.
- `scripts/audit-places.cjs` exécute le VRAI `buildLbcData()` dans un `vm` sur
  trois annonces de **deux comptes** : choisie → dans la file · retirée → pas
  dans la file · jamais touchée → dans la file. Il vérifie aussi que **l'app et
  l'extension appliquent la même règle** (elles calculent la file chacune de leur
  côté — le panneau tourne sur leboncoin.fr, où l'app n'est pas chargée).
  **6 échecs** sur le code d'avant.

### eBay : deuxième place, même modèle — et le défaut d'eBay est **NON**
Julien a confirmé le 12 septembre : « **j'ai les deux** » (compte particulier ET
professionnel). L'assistant eBay est donc livré sur le modèle de Leboncoin :
`ebay.js` tourne sur **ebay.fr**, liste les paires cochées, télécharge les
photos, copie le texte, ouvre le formulaire de mise en vente et remplit les
champs qu'il **reconnaît**. Aucune publication automatique.
- ⚠️ **Le défaut d'eBay est `false`, et ce n'est pas une symétrie ratée.**
  Leboncoin vaut « oui » parce que sa file existait AVANT la sélection et qu'on
  ne l'éteint pas dans son dos ; eBay n'a jamais rien préparé, donc cocher à sa
  place mettrait 44 annonces dans une file qu'il n'a pas demandée.
- Le titre monte à **80 caractères** (50 sur Leboncoin) et la référence
  `VRM-{n°}` va dans le champ **SKU** du compte pro — c'est ce qui permettra de
  reconnaître l'annonce plus tard **sans rapprochement par titre** (§5).
- **Aucune catégorie n'est devinée** : eBay la propose à partir du titre, et une
  catégorie fausse ferait plus de mal que pas de catégorie du tout.
- ⚠️⚠️ **JE N'AI JAMAIS VU LE FORMULAIRE eBAY, ET LE CODE LE DIT.** Le bandeau
  annonce **combien de champs ont été remplis** — s'il dit 0, rien n'a été
  reconnu et il le voit tout de suite (le texte complet est dans son
  presse-papier, les photos dans `VRM-{n°}`). Et l'extension me **rapporte la
  structure du formulaire** (`panel_ebay_form` : noms de champs, aucun contenu)
  pour que le prochain passage vise juste. *Mesurer d'abord* appliqué à ce que
  je ne peux pas mesurer moi-même : on fait mesurer par ce qui y a accès.
  **Ne pas écrire « ton annonce est prête » — écrire le chiffre.**
- Les photos ne peuvent **pas** être injectées (un navigateur interdit de
  remplir un champ fichier par programme) — dit à l'écran, pas contourné.
- `EXT_CAPACITES.ebay = '5.55.0'`, et `audit-places.cjs` couvre les deux places.
  ⚠️ Son premier jet **mourait** sur le code d'avant (`buildEbayData` n'existe
  pas → `TypeError`), donc les contrôles suivants n'étaient jamais rendus : *un
  audit ne meurt pas, il rapporte*.
- ⚠️⚠️ **ET `ebay.js` N'AVAIT JAMAIS TOURNÉ.** `node --check` ne lit que la
  syntaxe : un sélecteur qui ne trouve rien, un panneau qui ne s'ouvre pas, un
  `null` déréférencé — rien de tout ça ne se voit sans **exécuter le script dans
  une page**. C'est §4.10 (« une fonction serverless n'est vérifiée que si un
  banc l'EXÉCUTE ») appliqué à un script de contenu. Le banc `ebay.cjs` sert une
  fausse page de mise en vente et le charge pour de vrai : **14 contrôles**.
- ⚠️ **Ce que j'ai mesuré sur la vraie page d'eBay** (`curl` — le navigateur du
  banc n'y accède pas) : le formulaire de mise en vente est **derrière la
  connexion**, donc toujours invisible d'ici. Ce qui EST visible, c'est
  l'en-tête : la barre de recherche est un `<input name="_nkw" id="gh-ac">`
  **vide, sur toutes les pages**. Avec les motifs actuels elle n'est **pas**
  atteignable (aucun ne correspond à « Rechercher sur eBay ») — ce n'était donc
  pas un défaut vivant. Mais élargir un motif un jour suffirait : la garde
  `DANS_ENTETE` écarte en-tête, pied de page et recherche, et le banc **passe
  au rouge** si on la retire (prouvé : le titre de l'annonce atterrit dans la
  barre de recherche, et le bandeau annonce « 1 champ rempli » sur une page où
  il n'a rien rempli d'utile). *Une précaution, pas une découverte.*

### Ce que sait faire l'extension dépend de SA version — `EXT_CAPACITES`
Le défaut le plus coûteux du projet (l'app promet ce que l'extension installée
ne sait pas faire) s'est reproduit **trois fois**. Il ne se traite pas au cas par
cas : l'app tient **une table**, chaque capacité portant **la version où elle est
arrivée** — vérifiée commit par commit sur `manifest.json`, pas devinée.

| capacité | fonction de l'extension | arrivée en | ce que l'app promet |
|---|---|---|---|
| `codes` | `capterRetraits` | **5.45.0** (27 août) | « l'extension va chercher les codes toute seule » |
| `offres` | `autoAccepterOffres` | **5.38.0** (26 août) | « offre acceptée automatiquement au-dessus de ton plancher » |
| `releve` | `capterReleves` | **5.52.0** (5 sept.) | « l'extension récupère le relevé à ta prochaine visite » |
| `places` | `mpChoisi` | **5.54.0** (11 sept.) | « seules les annonces cochées partent sur Leboncoin » |
| `ebay` | `buildEbayData` | **5.55.0** (12 sept.) | « l'extension prépare tes annonces sur eBay » |

`extSait(quoi)` rend **trois états** — `absente` (téléphone, autre navigateur) ·
`retard` · `ok` — et **jamais deux**. Une extension **muette** sur sa version est
antérieure à la 5.26 (le pont l'annonce depuis) donc antérieure à tout : elle
compte comme `retard`. **« Pas su » ne vaut pas « oui ».**

⚠️ **Le seuil est la version d'ARRIVÉE, jamais la dernière publiée.** Premier
jet : `EXT_LIT_LES_CODES = '5.52.0'` — or `capterRetraits` date de la 5.45. Une
5.48 installée sait très bien lire les codes, et l'app lui aurait dit « celle
installée ne sait pas encore » : **faux dans l'autre sens**, et il aurait cherché
une mise à jour qui ne change rien. `audit-coherence.cjs` vérifie les deux sens :
la fonction citée existe encore dans l'extension, et le seuil est **atteignable**
(≤ manifeste — un seuil plus haut ne s'afficherait jamais).

⚠️⚠️ **ET `audit-coherence.cjs` NE POUVAIT PAS ÉCHOUER.** Il imprimait des ❌ et
sortait **toujours en 0** : le balayage `for f in scripts/audit-*.cjs` le comptait
vert quoi qu'il arrive. Prouvé en cassant `EXT_ATTENDUE` à 9.99.9 — « ❌ version
d'extension attendue » à l'écran, code de sortie 0. §8 annonçait pourtant « il
vérifie que la constante suit le manifeste » : il le **racontait**. Un contrôle
qui ne peut pas échouer est **pire qu'absent — il rassure**. Il compte
maintenant (`ko`/`dit`) et sort en 1.

⚠️ **Le bandeau se pose UNE fois, pas sur chaque carte.** Les 43 cartes
d'Annonces portent chacune le champ « Min. accepté » ; la phrase qui dit que
l'extension ne l'appliquera pas vit **au-dessus de la grille**, et seulement si
**au moins un plancher est posé** (mesuré le 8 septembre : **0 sur 329**) — sinon
c'est du bruit permanent. Elle dit **combien**, pour qu'il puisse le vérifier.
Le compte vient de `annStats` (§11 : même base que la grille, un seul
propriétaire), pas d'un second calcul.

### La version de l'app était tapée à la main, et figée
`BUILD_ID` valait `'v83/00 · Rafraîchissement auto…'` **depuis le 25 août —
81 commits**. C'est le seul chiffre qui réponde à « **est-ce que j'ai bien la
dernière version ?** », la question qu'il pose après chaque déploiement, et le
bouton « Forcer la mise à jour » est juste à côté. Un numéro qui ne bouge
jamais répond donc **le contraire** de ce à quoi il sert.
⚠️ **Et le mécanisme existait déjà** : `vite.config.js` injecte `__BUILD__`,
l'horodatage réel de la compilation, avec en commentaire « sert de version
visible pour diagnostiquer les problèmes de cache » — **lu nulle part**. Même
famille que le tiroir `Nav` défini et jamais rendu (§4.11) : le code est là,
personne ne l'appelle, rien ne lève d'erreur. **Avant d'ajouter un mécanisme,
vérifier que celui qui existe est branché.**
- L'ISO complet est injecté et formaté **côté app**, dans SON fuseau : la
  chaîne tronquée était en UTC et aurait annoncé 12:32 pour un déploiement de
  14:32 — deux heures d'écart sur le seul chiffre censé le rassurer.
- Horodatage illisible ⇒ « **inconnue** », jamais une date inventée.
- `audit-diagnostic.cjs` vérifie la règle : ce qui est affiché doit **dépendre**
  de `__BUILD__`, une chaîne littérale échoue. 2 échecs sur le code d'avant.
- ⚠️ `audit-variables.cjs` a crié au loup : `__BUILD__` n'est déclaré nulle part
  dans le source (Vite le remplace au build). Corrigé en lui faisant **lire les
  `define:` de `vite.config.js`** — pas en mettant ce nom en liste blanche : un
  `__FOO__` non défini doit continuer d'échouer, et c'est vérifié.

### L'extension n'écrit jamais la ligne `main`
Elle écrit dans ses **lignes dédiées** (`panel_bords_done`, `panel_buyprices`,
`panel_accounts_off`, `panel_colis_relais`, …) en lecture-fusion-écriture.
L'app les lit en source supplémentaire, jamais l'inverse.

### Les emails
- **C'est l'adresse de RÉCEPTION qui décide** à quel vendeur appartient un email —
  jamais l'expéditeur, le sujet ou le corps (sinon n'importe qui déposerait des
  données chez un autre).
- **On ne jette aucun email** : ce qu'aucune règle ne reconnaît est conservé entier.
- Le classement d'un colis se lit **sur le SUJET d'abord**, le corps seulement en
  repli (le corps d'un « colis disponible » contient les consignes de retrait).
- **Un colis caché est un colis perdu** : on n'écarte jamais un colis en silence.

---

## 6. Comment on vérifie (et pourquoi ça compte)

**La méthode : mesurer la vraie base AVANT de coder.** La moitié des « bugs »
signalés venaient d'un de mes propres scripts qui lisait le mauvais champ.
Avant de conclure « c'est vide » : vérifier le **nom** et la **forme** du champ
(le prix Vinted est un **objet** `{amount}`, pas un nombre).

| outil | quoi |
|---|---|
| `npm run build` | compile — ne voit ni les variables absentes ni le rendu |
| `node scripts/audit-*.cjs` | **31 audits** : identité, chiffres, cohérence app↔extension, QR, colis, push, URSSAF, relevé, variables non déclarées, secrets… |
| `scripts/bancs/*.cjs` | l'app **rendue sur les vraies données**, à 390 px et 1512 px — leur `README.md` dit comment les lancer. ⚠️ Leurs fixtures (`fx/`) ne montent **jamais** dans le dépôt : vraies ventes, vrais acheteurs, vraies adresses, dépôt **public**. `audit-bancs.cjs` le vérifie. |
| banc `vm` + faux `chrome` | le VRAI code de l'extension exécuté hors de Chrome |

**Trois règles de preuve :**
1. **Un audit doit ÉCHOUER sur le code d'avant**, sinon il ne prouve rien.
   Méthode : `git archive HEAD | tar -x -C /tmp/avN`, **copier le script DEDANS**
   et le lancer **DEPUIS cet arbre** (sinon `__dirname/..` relit le dépôt courant
   et la preuve est truquée).
2. **Regarder la capture d'écran fait partie du test.** Un défaut d'affichage ne
   lève aucune erreur : image cassée, texte en double, écran vide, débordement.
   Un défaut dans un canvas (3D) ne se cherche pas dans le DOM.
3. **Servir TOUTES les familles de lignes et TOUTES les formes de requête** au
   banc (`id=eq.`, `id=like.`, `select=`), sinon on mesure un artefact.
   ⚠️ **La projection `select=` compte autant que la ligne.** Rendre `{id,data}`
   pour une requête `select=id,filename:data->>filename,…` fait lire
   `r.filename` sur un objet qui ne l'a pas : tous les bordereaux tombaient et
   l'écran Colis affichait « 0 bordereau prêt à imprimer » alors que dix étaient
   en base. C'est ce qui m'a fait chercher au mauvais endroit pendant plusieurs
   passes. Les bancs appliquent la projection (`projette`).
4. **Un écran tombé sur le garde-fou passe TOUS les contrôles.** « Cet écran n'a
   pas pu s'afficher » est un vrai texte, sans débordement et sans `pageerror`
   (React avale l'exception) : le banc répondait « rendu conforme » sur un écran
   MORT. Le contrôle existe maintenant dans les deux bancs de rendu.
5. **Un contrôle qui se déclenche sur la FORMULE est vert sur le code d'avant.**
   Premier jet : « si la phrase parle d'attendre un code, elle doit nommer un
   compte » — sur l'ancien texte la condition tombait à faux, le banc annonçait
   « rien à vérifier » et passait au VERT sur le défaut qu'il devait attraper.
   C'est la BASE qui déclenche : *s'il existe un colis sans code, la ligne doit
   nommer un compte*, quelle que soit la formulation. (Même leçon que
   `audit-identite` : suivre la règle, pas son orthographe.)
6. **Playwright prend la DERNIÈRE route enregistrée en premier** : un fourre-tout
   `**/api/**` posé après `**/api/relais**` avale la route précise et répond
   `{pret:true}` — la carte restait vide sans lever la moindre erreur.

⚠️ Ne jamais lancer `npm run build` pendant qu'un banc sert `dist/`.
⚠️ `git fetch` avant toute comparaison avec la production : une référence locale
jamais rafraîchie ment en silence.

---

## 7. Le visuel

Règle unique, posée après six passes ratées :

> **UNE SEULE couleur d'accent, et elle est RARE.** Tout le reste est neutre. Un
> chiffre ne porte une couleur que s'il y a **vraiment quelque chose à rattraper**.

Famille actuelle : fond gris froid `#F6F7F9`, cartes blanches, encre ardoise
`#10151B`, accent bleu `#1E5FCC`, navigation (rail / barre du bas) en ardoise —
c'est elle, la signature. Mode sombre choisi, pas inversé automatiquement.
Rayons **5 / 8 / 10 / 12** (plus de 2-3-4 px éparpillés), ombres à **deux
couches** (contact serré + diffusion large et pâle).

### Les boutons — une seule forme (`audit-boutons.cjs`)
Mesuré : **22 hauteurs, 22 paddings, 13 tailles de texte** sur 561 boutons, dont
47 à la police PAR DÉFAUT du navigateur. C'est la dispersion qui se lit « pas
fini », pas la couleur. Une règle de base dans `index.html` pose police, taille,
graisse, hauteur plancher et transition — et **rien d'autre** :
⚠️ **ne jamais y mettre `display:inline-flex`.** Un `<button>` centre déjà son
contenu ; le forcer a centré le rail de navigation et aplati le chiffre
cliquable « Coût d'achat » sur une seule ligne (vu en capture).
Les styles **en ligne** gagnent sur une classe : la règle ne pose donc que ce
qu'un bouton ne fixe pas lui-même.

- Une couleur en dur qui n'est pas dans `THEMES` ne suivra pas un changement de
  palette : `grep -oE '#[0-9a-fA-F]{6}' src/App.jsx` après chaque passe.
- Un emoji utilisé **comme icône** devient une icône au trait (`ICON_PATHS`, qui
  attend du **JSX**, pas une chaîne — sinon rien ne se dessine).
  ⚠️ **Et un nom absent de `ICON_PATHS` ne dessine rien non plus** : `Icon` rend
  `null`, sans erreur ni console. Mesuré le 7 septembre — l'onglet **« Grille »**
  du Garage était sans icône entre « Ma pièce » et « Photos », depuis des
  semaines, parce que `grid` n'avait jamais été défini. C'est la CAPTURE qui l'a
  vu. `audit-icones.cjs` vérifie maintenant tous les noms, y compris ceux qui
  passent par une variable (il regarde ce qui alimente le `<Icon name={…}/>`
  juste au-dessus). ⚠️ Ses deux premiers jets étaient faux dans les deux sens :
  trop timide il ratait `grid`, trop large il criait au loup sur les pays et les
  transporteurs.
- **Quand il dit trois fois « c'est pareil », arrêter de retoucher les teintes et
  aller mesurer la composition** à sa résolution de travail (1512 px, ordinateur).
  Les deux vrais défauts trouvés comme ça : une app mobile étirée sur 1440 px, et
  un accueil qui s'arrêtait au tiers de l'écran.
- **La même phrase répétée sur chaque ligne est UNE phrase.** Quand l'en-tête d'un
  groupe la dit déjà, la ligne ne la reprend que si le groupe est **mixte** — là
  seulement elle distingue. (Achats : 13 × « code pas encore reçu » ; Colis :
  14 × « l'extension le récupère ».) C'est le §11 à l'échelle de l'écran.
- **Une rangée de pastilles défile au doigt, revient à la ligne à la souris** :
  classe `.vrm-rangee` (`nowrap`, puis `wrap` au-delà de 1024 px). ⚠️ Un style
  **en ligne** gagne sur une classe — retirer `flexWrap`/`overflowX` du `style`.
- **Un bouton en `flex:'1 1 …'` sans `maxWidth` s'étire sur 500 px** sur un écran
  large. Toujours plafonner.
- **Sur ordinateur, les actions du haut sont une ÎLE flottante** en haut à droite
  (le bandeau pleine largeur était 56 px de vide au-dessus de chaque titre).
  ⚠️ Tout ce qu'un écran pose sur sa ligne de titre doit passer par le slot
  `right` de `ScreenHead` — sinon ça glisse SOUS l'île et disparaît. Le banc
  `verif_visuel.cjs` mesure ce recouvrement.
  ⚠️⚠️ **ET TROIS ÉCRANS Y ÉCHAPPAIENT PARCE QU'AUCUN BANC NE LES RENDAIT.**
  Mesuré le 7 septembre : les deux bancs de rendu couvraient **10 onglets sur
  15**. `vintedaccounts` (« Comptes liés », ses neuf comptes), `catalog` et
  `stockvinted` se fabriquaient chacun leur propre `<h2>` + bouton — donc
  « ↻ Actualiser », « Exporter Excel » et « Coller en masse » atterrissaient
  **pile sous l'île, invisibles**. Mesure directe sur `vintedaccounts` : bouton
  à `left 1311 · right 1410 · top 30`, île à `left 1301 · top 12 · bottom 59` —
  entièrement dedans. Le contrôle existait depuis des semaines ; ces écrans n'y
  passaient jamais. Les trois écrans sont repassés sous `ScreenHead`, et
  `audit-bancs.cjs` exige désormais que les bancs rendent **tout écran
  joignable** (dans le rail ou visé par un `setTab`).
  ⚠️ *Deux écrans montés restent INJOIGNABLES* (`comptabilite`, `inventory`) :
  aucun appelant, comme le tiroir `Nav`. Ils ne sont pas exigés au banc — tester
  un chemin mort ne prouve rien.
  ⚠️⚠️ **CAUSE ÉLUCIDÉE — et elle corrige ce que j'avais écrit d'abord.** En
  séquence complète, le banc ne signalait pas `vintedaccounts` ; j'en avais
  conclu « le banc peut être aveugle, un écran vert peut être faux ». **C'est
  faux.** Le banc mesurait juste : le bouton était bien à `left 1311` dans les
  deux cas, mais à `top 30` seul (donc SOUS l'île) et à `top 154` en séquence
  (donc dégagé). Ce qui le pousse : le bandeau **« 1 compte est exclu de
  l'application »**, qui n'apparaît qu'une fois `vinted_accounts_hidden` écrit
  dans le navigateur par un onglet précédent.
  ⇒ La vraie leçon : **un écran qui se fabrique sa ligne de titre n'est sous
  l'île que PARFOIS** — selon ce qui s'affiche au-dessus. C'est exactement
  pour ça que le défaut a survécu si longtemps, et pourquoi passer par
  `ScreenHead` compte plus, pas moins.
  ⇒ Et une propriété des bancs à connaître : `localStorage` **survit d'un
  onglet à l'autre** dans le même contexte, donc l'ORDRE des onglets change ce
  qui est rendu. Un banc n'est pas moins fiable pour autant — il faut juste
  savoir qu'il mesure un état, pas une vérité éternelle. *(Corollaire : l'état
  le plus risqué est l'APPAREIL NEUF, celui où rien n'a encore été écrit — c'est
  là que « ↻ Actualiser » disparaissait, et c'est le même terrain que les
  numéros repartis de 1 au montage.)*
  ⚠️ **Cherché, et il n'en reste pas** : deux lignes de titre sont encore
  fabriquées à la main, mais aucune n'est ce défaut — **Leboncoin** est centré
  (`maxWidth 600`), donc structurellement loin de l'île ; **« Ventes (n) »** de
  l'ancienne appli est un titre de SECTION en milieu de page, pas un en-tête
  d'écran. Onze écrans passent par `ScreenHead`. Ne pas refaire cette
  recherche.
- **Le sombre tient par la hiérarchie, pas par la teinte** : rail le plus sombre,
  page au-dessus, cartes encore au-dessus. Quatre unités d'écart, et la barre
  latérale se confond avec la page.
- **Le même nombre ne s'écrit jamais deux fois sur un écran** — surtout pas
  arrondi différemment (« 296 € » et « 296,40 € » le même jour). Et **un `0,00 €`
  qui veut dire « on ne sait pas » s'écrit `—` avec la raison à côté**.
- **Pas de « n/d »** ni d'autre vocabulaire d'informaticien : il n'est pas
  développeur. Un tiret dit « on ne sait pas », la raison en clair dit quoi
  faire. `audit-chiffres.cjs` compte les `n/d` restants — il y en avait encore
  **quatre** sur l'écran Statistiques le 7 septembre, des semaines après la
  règle. ⚠️ Et remplacer un `n/d` par **`0,00 €` est pire**.
- **Une carte qui ne peut RIEN afficher, jamais, n'apprend rien — TRANCHÉ.**
  « CA / jour actif » se calculait sur `receiveDate`, la date d'encaissement
  **retirée exprès de l'app** : 0 jour, donc un tiret que ni une saisie ni une
  synchro ne pourrait jamais remplir. La date de **VENTE**, elle, est connue
  pour toutes les ventes : la carte est devenue **« CA / jour de vente »** —
  mesuré sur ses données, **117,46 € sur 57 jours où il a vendu**. `joursVente`
  est publié par le **même calcul** que `caEncaisse` (§11), sur exactement les
  mêmes ventes finalisées : numérateur et dénominateur parlent des mêmes lignes.
- **« saisis tes prix d'achat » s'écrivait SIX fois sur l'écran Statistiques**,
  en ambre, dans trois groupes — six alertes pour une seule cause, ça se lit
  comme six problèmes. Les cartes gardent leur `—` ; la raison et la **porte**
  vivent une fois par groupe (« La valeur du stock, le bénéfice et la marge
  attendent tes prix d'achat — les saisir → », qui ouvre la saisie en série).
  Mesuré au rendu : **6 → 1**. Et « prix d'achat manquants » disait la même
  chose avec d'autres mots : une cause, une phrase.
  ⚠️ Le drapeau `DEMANDE_SAISIE_PRIX` vit au niveau **module** : au moment du
  clic l'écran Annonces n'est pas monté, un `dispatchEvent` serait perdu.

---

### Le zip de l'extension — le défaut le plus coûteux du projet
Pendant des semaines l'app a dit « ton extension est en retard, mets-la à
jour », alors que **le zip de cette version n'existait nulle part** : le
manifeste était en 5.52.0, le seul zip du dépôt datait du 30 août en 4.13.0, et
l'app n'offrait **aucun lien de téléchargement**. Pire, la consigne disait
« clique sur ⟳ dans chrome://extensions » — or ⟳ recharge le **dossier du
disque**, donc la même vieille version. Il ne pouvait pas mettre à jour, quoi
qu'il fasse — et tout ce que l'app lui promettait ensuite (les codes de retrait
lus dans ses conversations) en dépendait.
- Le zip vit dans `public/VRM-extension.zip`, se dézippe en **un seul dossier au
  nom stable** (`VRM-extension`) pour qu'il remplace l'ancien au même endroit.
- `scripts/audit-extension-zip.cjs` vérifie que le zip livré porte la version du
  manifeste, qu'`EXT_ATTENDUE` suit, qu'il tient en un dossier, qu'il contient
  tous les fichiers, que l'app le propose, et qu'aucun zip périmé ne traîne.
- **Après toute modification de `vinted-sync-extension/`, régénérer le zip.**

## 8. État au 8 septembre 2026 (remesuré en fin de journée)

| | |
|---|---|
| annonces **ouvertes** | **54** · **0 doublon vivant** ✅ (385 fermées à côté — voir le piège `nItems` ci-dessous) |
| paires numérotées | **329** · **0 prix d'achat** ⚠️ (il les saisit lui-même — la modale trie les vendues d'abord : 20 saisies = 33 % du CA reliable) |
| pool de numéros | **465**, sans trou, plus haut = 465 (append-only : c'est normal) |
| ⚠️ numéros en double | **13**, tous HISTORIQUES : N°1 à N°16 redonnés par la numérotation auto les 2/4/6/15/16 août. **Cause : sur un appareil neuf le pool était lu VIDE au montage**, le nuage arrivant 500 ms plus tard → la numérotation repartait de 1. Corrigé (`onCloudReady` relit le pool) et protégé par `audit-identite.cjs`. **Aucun n'est vivant** : les paires en double sont fermées. |
| argent Vinted | **139,04 € disponibles** à virer · **2 013,60 € retenus** — sur **7 porte-monnaie**, pas 9, et c'est ce que l'app affiche (voir le piège des trois formes ci-dessous). Le plus ancien solde date de **13 j** (`julatace3535`). |
| colis | 15 ventes à expédier, **10 bordereaux déjà en base** · **6** colis à retirer, **0 code** — 5 sur `julatace3535` (dernière capture : 4 j) et **1 sur `julatace35260`, capté il y a 10 min**. ⚠️ Ce n'est PAS le compte qui bloque : **son extension est antérieure à 5.45**, elle n'a pas `capterRetraits` (0 compteur `retrait_*` sur 42). La mise à jour est le premier geste. |
| notifications push | ✅ fonctionnent (clé VAPID posée sur Vercel) |
| comptes Vinted | 9, dont 5 dont la boîte **ne fait suivre aucun email** → aucune notification de vente possible pour eux (affiché dans Réglages) |
| ventes masquées | 209 (masquées à la main ; « tout réafficher » existe sur l'écran Ventes) |

⚠️⚠️ **PIÈGE `billing` — ET C'EST MON SCRIPT QUI AVAIT TORT, PAS L'APP.** Le
8 septembre j'ai mesuré « 29,94 € disponibles sur 5 porte-monnaie » et j'allais
annoncer que l'app perdait de l'argent. En vérifiant la FORME (§6) : **trois
charges différentes** dorment sous le même identifiant `harvest_{uid}_billing` —
`{main, escrow}` (le solde, 5 comptes), `{balance, pending_balance, …}` (la
réponse `payouts`, 2 comptes : `arthuror2` 93 € + 109,80 €, `llloollllaa`
16,10 € + 428,50 €), et une réponse **qui n'a rien à voir** (`minimum_price`,
sur `julienf765`). `liliand653` n'a aucune ligne.
⇒ **L'app lit déjà les trois** (`fetchWalletEscrow`), ne mélange jamais
« disponible » et « en attente », ignore la charge hors sujet, et annonce
**le nombre de porte-monnaie réellement lus** — donc « sur 7 », pas « sur 9 ».
Elle est juste. Mon script lisait `data->payload->user_balance`, un champ qui
n'existe pas.
⇒ La ligne de `julienf765` est un **reliquat** : `estPorteMonnaie` (extension)
exige aujourd'hui un montant réel parmi `main|escrow|balance|pending_balance`,
donc ça ne peut plus se reproduire. Elle sera écrasée à sa prochaine visite du
porte-monnaie. **Ne pas « corriger » l'app pour ça.**

⚠️ **PIÈGE `nItems`, payé le 7 septembre.** `harvest_{uid}_listings.nItems` compte
**tout** ce que la moisson a capté, **annonces fermées comprises** : 103 pour
`julatace3535`, dont **94 `is_closed`**. J'en ai déduit « 380 annonces en ligne »
puis « **12 numéros en double, toutes les paires en ligne — le risque n°1 est
vivant** » — et j'allais l'annoncer. La vraie mesure (`!x.is_closed`) donne **49
ouvertes et 0 conflit**. C'est §6 mot pour mot : *vérifier le nom ET la forme du
champ avant de conclure*. Le banc `conflit.cjs` FORCE désormais le cas pour
prouver que l'alerte rouge s'affiche quand elle doit — constater une absence ne
prouve rien.

**Ouvert :**
- ⚠️ **L'extension installée chez lui est en retard** (mesuré : captures fraîches
  du matin, mais **0 ligne de relevé**). L'app le dit maintenant — `EXT_ATTENDUE`
  comparée à la version que le pont annonce, bandeau sur Ma journée et ligne dans
  Réglages. `scripts/audit-coherence.cjs` vérifie que la constante suit le
  manifeste. **C'est ce qui bloque le point suivant.**
- **La forme d'une ligne de VENTE dans le relevé du porte-monnaie.** Le relevé daté
  est capté (`harvest_{uid}_releve_{YYYY-MM}`), mais le seul mouvement jamais
  observé est un **virement sortant** — et il porte `type:"credit"`. Donc
  « credit » ≠ « recette ». **Ne baptiser aucun total « CA encaissé » avant
  d'avoir vu une vraie ligne de vente en base.** C'est ce qui débloquera un vrai
  « argent reçu » par mois pour l'URSSAF.
- Le paramètre `?year=&month=` des mois passés : jamais observé, tenté de façon
  bornée, et le compte est marqué muet si Vinted l'ignore.
- **Dépôt PUBLIC** et **RLS désactivé** : la clé « anon » du bundle donne un accès
  complet en lecture/écriture, y compris aux jetons Vinted. Les deux gestes qui
  referment ça (passer le dépôt en privé, appliquer
  `supabase/migrations/001-multi-utilisateurs.sql`) n'appartiennent qu'à lui.
  Détail dans `SECURITE.md`.

---

## 9. Chemins utiles

```
src/App.jsx                     l'app (grep avant de lire — le fichier est énorme)
vinted-sync-extension/          background.js · inject.js · vinted-panel.js · content.js
api/                            email-inbound · push · widget · ship-reminders · ai
scripts/audit-*.cjs             les 31 audits
scripts/bancs/                  les 16 bancs (leur README dit comment les lancer)
docs/journal-2026.md            l'historique complet (pourquoi chaque règle existe)
SECURITE.md · .env.example      ce qui doit rester hors du dépôt
```

Chromium du banc : `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`
(`--use-angle=swiftshader --no-sandbox`).
