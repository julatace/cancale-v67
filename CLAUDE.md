# VRM — dossier de passation

> ⚠️⚠️ **PASSATION DU 12 OCTOBRE — DEUX AGENTS — LIS D'ABORD `docs/passation/README.md`,
> section « 🔴 LIRE D'ABORD » puis « RÉPARTITION ».** Agent 1 : mettre en ligne
> la 5.175 (avec le second correctif photos), migration 014, règle d'offre eBay,
> puis l'agent eBay. Agent 2 : page d'accueil, tri des 21 anciennes branches,
> fonctions retenues le 11 octobre, revue complète. Le travail non poussé est
> dans `docs/passation/branches-2026-10-12.bundle` et
> `branches-locales-2026-10-11.bundle` ; les listes de défauts restants dans
> `docs/passation/notes/`.

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
8. **Sur eBay, c'est l'acheteur qui paie le bordereau** (11 octobre, mot pour
   mot : « pour ebay on est d'accord c'est l'acheteur qui paye le bordereau »).
   Son compte est en livraison gérée par eBay : l'acheteur paie le port à eBay,
   eBay fournit l'étiquette prépayée. VRM n'achète **jamais** une étiquette avec
   son argent, ne pose **jamais** « livraison gratuite », et le port n'est ni une
   recette ni une charge dans sa compta. L'achat d'étiquettes chez un agrégateur
   (chantier K14 de l'agent eBay) est **gelé** pour lui.
9. **Aucune fonction payante à l'usage ne tourne sur SA clé pour les autres**
   (11 octobre : « trouve une solution sans IA ou avec leur clé API mais pas la
   mienne »). Traduction, détourage, IA, lecture d'image : d'abord **sans IA**
   (ce que le navigateur fait seul : reconnaissance vocale, traducteur intégré à
   Chrome, modèle local dans la page) ; sinon **la clé du vendeur**, collée par
   lui, rangée côté serveur, jamais relue par le navigateur. Une fonction qui
   n'a ni l'un ni l'autre se tait et dit pourquoi — jamais un repli sur sa clé.

---

## 3. Ce qui est refusé, définitivement (redemandé ~8 fois)

Ce ne sont pas des positions de principe : chacune a une raison technique.

| demande | pourquoi non |
|---|---|
| republication automatique en file, avec délais aléatoires | un délai « faussement humain » n'a qu'un usage : tromper la détection bot. C'est ce qui a fait bloquer `vanessa5723`. |
| **accepter une offre automatiquement** — ⛔ **RETIRÉ, sa décision** | coupée le 4 octobre (« je ne veux pas que ça accepte tout seul les offres »), **retirée** le 5 octobre (« enlève l'acceptation de l'offre ») : le moteur de l'extension, ses planchers, le champ « Min. accepté », l'interrupteur de Réglages. Accepter engage une vente ferme, et un programme qui accepte ressemble à un robot (le compte bloqué). **Ne jamais le reproposer** — je l'ai fait par erreur le 5 octobre en lisant l'ancienne version de cette ligne. Reste permis : accepter UNE offre depuis la messagerie, sur son clic, avec confirmation (`executerPourApp`). `audit-offres-auto.cjs` refuse tout autre chemin vers `/accept`. ⚠️ **Tout ce qui précède vaut pour VINTED. Sur eBay, Julien l'a demandé le 9 octobre**, en ses mots : « Je veux juste définir une règle sur chaque annonce et à chaque offre au-dessus ça accepte », puis, à la question « aussi sur Vinted ? » : « **eBay seulement** », et « J'accepte » sur le plan. Sur eBay c'est donc permis, sous UNE seule forme : le **seuil natif d'eBay** (`BestOfferAutoAcceptPrice`), posé annonce par annonce **sur son clic**, avec une confirmation qui dit qu'une offre acceptée vend la paire. C'est eBay qui accepte : VRM n'appelle aucune route d'acceptation et ne décide rien (`audit-offres-auto.cjs` le vérifie aussi pour `api/`, section 5). Sur Vinted, rien ne change : ce n'est **pas** un retour de l'acceptation automatique sur Vinted, ne pas l'y reproposer. Détail : « eBay : au-dessus, ça accepte » plus bas. |
| piloter la souris / le clavier | Vinted reçoit la **même requête** ; en plus un événement synthétique porte `isTrusted:false`, donc ça **ajoute** une preuve d'automatisation. Et un clic aveugle agit à côté quand la page bouge. |
| modifier les photos pour republier / passer sur un autre compte | Vinted relie les comptes par **appareil, navigateur, adresse, moyen de paiement** — pas par les images. Tourner une photo ne protège de rien. |
| supprimer une annonce automatiquement | irréversible et sans confirmation côté Vinted. |
| envoyer des messages en série aux favoris | **Vinted ne dit jamais QUI a mis en favori** (mesuré : aucun endpoint, aucun champ). Il n'y a pas de destinataire. La remise aux favoris de Vinted, elle, touche tout le monde en un clic. |

**Ce qui EST autorisé et automatique** : générer un bordereau et récupérer son
PDF (ça n'engage aucun argent, la vente est faite, le colis doit partir), et
toute **lecture** sur ses propres données.

**Refusé par Julien le 11 octobre (son choix, pas une limite technique) — ne pas
reproposer** : « imprimer la journée » avec une liste de préparation triée par
emplacement ; les étiquettes de carton avec QR code ; le prix conseillé à la mise
en ligne (calculé sur ses ventes passées) ; l'alerte « achat jamais arrivé » ;
l'alerte « argent bloqué » ; le rappel des messages sans réponse depuis 24 h ; le
rappel des évaluations à laisser ; la sauvegarde hebdomadaire envoyée chez lui ;
le widget iPhone enrichi.
Et, le même jour, parmi les nouveautés proposées : le badge « bonne affaire »
sur Vinted, la saisonnalité, la photo d'étiquette → fiche, les acheteurs fidèles.

**Retenu par Julien le 11 octobre (à construire, en plus du reste)** : prix
d'achat au numérotage · double vente app fermée · rappel URSSAF · fiche
« republier » · app plus rapide · page « tout va bien ? » · codes de retrait hors
ligne · rappel la veille au soir · fiche prête à l'arrivée d'un achat · plan des
paires qui dorment · bénéfice réel · récap comptable · réponses rapides · double
vérification de connexion · achats à vérifier avant la date limite · retour →
stock · favoris sans vente (remise native) · boost rentable ? · compte qui vend
le mieux · ce qui part vite · studio photo + détourage · saisie vocale ·
traduction des messages · mode équipe — les fonctions payantes selon la règle
§2.9.


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
- ⚠️ **LE CA DÉCLARÉ EST DATÉ AU JOUR DU VERSEMENT** (il l'a redemandé le
  3 octobre — voir « dater au versement » plus bas). Les autres écrans
  (Statistiques, Ma journée) restent datés au jour de la vente.
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

### Leboncoin : la liste vit dans le PANNEAU, et « vendue » se prouve
Demande de Julien, 12 septembre : « propose-moi les paires en ligne **en liste**,
prends le titre en l'optimisant pour Leboncoin, la description avec les photos,
**comme un pro** ; si une paire est vendue sur Vinted elle doit être enlevée de
Leboncoin, et elle garde le même numéro. » Puis : « **je veux avoir la liste sur
l'extension, pas dans l'app** » — c'est sur leboncoin.fr qu'il travaille.

**Mesuré avant de coder**, le vrai `buildLbcData()` exécuté sur la vraie base :
59 annonces en ligne, 59 numérotées, **59 dans la file**. Quatre défauts, tous
mesurés :

1. **Le titre était tronqué à la hache.** `[marque, titre].join(' ').slice(0,50)` :
   **7 titres au plafond dont 6 coupés EN PLEIN MOT** (« …tropez fringe noir
   taill »), la marque **doublée** (« Nike nike shox tl »), « taille 38,5 » au
   lieu de « T38,5 », « Chaussures style Nike sacai » (16 caractères de
   remplissage). `lbcTitre()` : **0 coupé en plein mot, 0 au plafond, 58 des 59
   améliorés**. ⚠️ Mon premier jet retirait le mot « chaussures » : il en faisait
   « **Ville** derby » et « **Bateau**/ mocassins ». Mesuré, ce mot PORTE DU SENS
   trois fois sur quatre chez lui — on ne retire que le remplissage pur
   (« chaussures **style** X ») et le doublon devant la marque.
2. **54 des 59 annonces partiraient avec UNE SEULE photo**, et rien ne le disait.
   Cause mesurée : **l'API Vinted ne renvoie AUCUNE photo** (0 sur 57 lignes
   `harvest_*_item_*`, captures jusqu'au 9 septembre) — elles ne viennent que de
   la PAGE de l'annonce, et les 93 déjà ouvertes en ont **5 en moyenne**. On ne
   peut donc pas les chercher tout seul : la liste se groupe sur **ce qu'il peut
   faire** (loi de l'écran Colis) — *aucune photo* (Leboncoin refuse) en haut,
   puis *prêtes*, puis *une seule photo* — chaque carte écrit **le chiffre** et
   donne **le lien vers l'annonce Vinted**. Le chiffre, jamais la promesse.
3. ⚠️⚠️ **« VENDUE » ÉTAIT DÉDUITE D'UNE ABSENCE.** Le panneau écrivait « N
   **vendues** sur Vinted — à retirer », en rouge, dès qu'une annonce n'était
   plus en ligne. Or elle sort aussi de la liste quand il l'a **mise en pause**.
   Mesuré : sur ses **400 annonces fermées, 151 seulement** portent une vente
   **prouvée** par identité (`transaction → item_id` : les 400 lignes
   `harvest_*_txn_*` la portent toutes). Dire « supprime-la » pour les 249 autres
   lui fait **perdre une vente sur une paire qu'il a encore**. Trois états
   désormais : **vendue (prouvée, rouge)** · **plus en ligne, à vérifier
   (ambre, aucun ordre)** · **en pause (gris, rien à faire)**. §5 mot pour mot :
   mieux vaut un blanc qu'un faux. **Le numéro, lui, ne bouge jamais** (pool
   append-only) — c'est écrit à l'écran.
4. **Une catégorie devinée fausse** : « 3 manuels première ST2S » partait en
   « Chaussures ». Leçon eBay appliquée ici.

5. ⚠️⚠️ **LE TEXTE PUBLICITAIRE DE VINTED PARTAIT COMME SA DESCRIPTION.** Mesuré
   sur ses **92 descriptions captées** : **4** sont « *Une communauté, des
   milliers de marques et de styles de seconde main. Prêt à te lancer ?
   Découvre comment ça marche !* » — la page de Vinted, pas son texte — et
   **une des quatre est en ligne**, donc elle partirait telle quelle sur
   Leboncoin comme description de SON annonce. Une autre commençait par le
   libellé « Description » collé au texte. `PAS_UNE_DESCRIPTION` les écarte **à
   la publication** ; rien n'est supprimé en base (même principe
   qu'`URL_PAS_UN_QR`). ⚠️ Et le banc vérifie **les deux sens** : une VRAIE
   description doit être gardée entière — un filtre trop large viderait ses
   annonces.
6. **Seules 6 des 59 annonces en ligne ont une description**, et 54 n'ont qu'une
   photo : **ce sont les mêmes**. Le geste est donc UN seul (ouvrir la page
   Vinted), et la carte le dit en **une ligne** — « 1 seule photo · pas de
   description » — pas deux alertes pour une cause (§7).

7. ⚠️⚠️ **LE PANNEAU DISAIT « (dont la réf VRM-401) » À CHAQUE FOIS — Y COMPRIS
   QUAND LA RÉFÉRENCE N'ÉTAIT PAS MISE.** Mesuré sur la structure que SON
   navigateur a rapportée de la vraie page de dépôt (`lbc_recon`, 2 août) :
   cette page ne porte **qu'UN seul champ** — `name="subject"`, « Que
   proposez-vous aujourd'hui ? ». Le dépôt Leboncoin est un formulaire **en
   étapes** : ni description, ni prix, ni référence n'existent à cette étape. La
   référence n'était donc **jamais** remplie, et le message affirmait le
   contraire à chaque clic. Ce n'est pas un détail : `VRM-{n°}` est ce qui relie
   l'annonce Leboncoin à la paire **sans rapprochement par titre** (§5) — sans
   elle, « vendue sur Vinted → à retirer » ne reconnaît plus l'annonce, et il
   vend la même paire deux fois. ⇒ Le message **nomme ce qui a été rempli**, dit
   quand la référence n'a pas pu l'être, et rappelle qu'elle est **dans la
   description** (`buildLbcAd` l'y met en haut et en bas). *Le chiffre, jamais
   la promesse.* **2 échecs** sur le code d'avant.
   (Au passage : son compte Leboncoin est **professionnel** — `type: business` —
   donc le champ Référence existe bien, à une étape ultérieure.)
8. ⚠️ **ET LE PRIX DE SA PAIRE ATTERRISSAIT DANS UN FILTRE DE RECHERCHE.** Le
   panneau tourne sur **toutes** les pages de Leboncoin ; une page de résultats
   porte « Prix min » / « Prix max », qui collent parfaitement à
   `/prix|price|montant/`. Prouvé au banc sur le code d'avant :
   **`price_min = 24.00`**. `PAS_UN_CHAMP_DE_DEPOT` les écarte **par ce qu'ils
   sont**, pas par l'URL — borner sur l'adresse aurait cassé le pré-remplissage
   aux étapes suivantes du dépôt, dont je ne connais pas les URL (*une nouveauté
   ne doit pas éteindre ce qui marchait*). La garde d'en-tête d'`ebay.js`
   manquait aussi ici ; elle est posée, mais **c'est une précaution, pas une
   découverte** : avec les motifs actuels la barre de recherche n'était pas
   atteignable.

9. ⚠️⚠️ **LA CAPTURE DE SES ANNONCES LEBONCOIN ÉTAIT MORTE, EN SILENCE.** Mesuré
   le 12 septembre : `lbc_listings` **et** `lbc_accounts` sont **absentes** de sa
   base, alors que `lbc_recon` (écrite par un autre chemin) existe depuis le
   2 août. Or le compte Leboncoin se lit sur **n'importe quelle** page dès que
   `__NEXT_DATA__` est là : s'il n'a jamais été écrit, c'est que cet élément
   n'existe plus — Leboncoin est passé au routeur « app » de Next, qui diffuse
   ses données dans **`self.__next_f`** au lieu de `__NEXT_DATA__`.
   ⇒ Conséquence, et c'est elle qui compte : **le « vendue sur Vinted → retire-la
   de Leboncoin » qu'il venait de demander ne pouvait pas fonctionner** (le
   rapprochement passe par la référence lue sur l'annonce Leboncoin), et le
   panneau affichait « 📊 **0** annonce sur Leboncoin » — un zéro **inventé** qui
   cachait exactement ça. C'est « rien lu ne vaut pas rien » sur cet écran.
   - `donneesNext()` essaie les **deux** formats ; `objetsDuFlux()` ne parse que
     du JSON **complet et bien fermé** — un fragment tronqué est ignoré, jamais
     deviné.
   - `lbcJamaisLu` distingue « aucune annonce » de « jamais capté » : un **tiret**
     et la raison, avec **ce que ça empêche**, jamais un zéro (§7).
   - ⚠️ **Je n'ai jamais pu voir la page** (leboncoin.fr me renvoie 403) : c'est
     donc l'extension qui mesure et qui **remonte ce qu'elle a vu**
     (`lbcDiag` → `lbc_recon.capture` : quel format porte la page, combien
     d'annonces). Même méthode que pour le formulaire eBay — faire mesurer par ce
     qui y a accès.
   - ⚠️⚠️ **ET MON DIAGNOSTIC A FAILLI CASSER LA VRAIE CAPTURE** : je l'avais
     nommé `lbcCapture`, un nom **déjà pris** par le message qui transporte les
     annonces. Le fond prenait le premier des deux handlers et **avalait la
     capture réelle**, en silence. C'est le banc qui l'a vu (champs `undefined`)
     avant que ça ne parte. *Un diagnostic ne doit jamais partager le canal de la
     donnée qu'il observe* — et le banc vérifie désormais que les **deux**
     messages partent.

10. ⚠️⚠️ **« TEXTE COPIÉ » SANS RIEN COPIER — UNE PROMESSE REJETÉE NE PASSE PAS
    PAR `catch`.** `copy()` s'écrivait `try { navigator.clipboard.writeText(t) }
    catch (_) { …repli… }` : le repli ne partait **que** si l'appel levait sur
    place. Or `writeText` échoue en rendant une **promesse rejetée** (document
    pas au premier plan, permission refusée, contexte non sécurisé) — donc rien
    n'était copié, **et le panneau annonçait quand même « copié »**. Prouvé au
    banc sur le code d'avant : le rejet ressort en `NotAllowed` (erreur de page
    non gérée) et le presse-papier reste vide. C'est la même famille que « 1
    champ pré-rempli » sur une page où rien n'a été rempli — et ça porte sur le
    texte qui contient la **référence VRM-{n°}**, le seul filet quand le
    formulaire n'a pas de champ pour elle.
11. **Le remplissage automatique s'arrêtait au bout de 90 s, en silence.** Le
    dépôt Leboncoin se fait en ÉTAPES (mesuré : la première page ne porte qu'un
    champ) ; choisir la catégorie et arriver au prix prend plus longtemps. Passé
    le délai, l'extension attendait des champs qu'elle ne surveillait plus. Le
    bandeau le DIT maintenant et renvoie sur « Re-remplir » — lequel **relance**
    la surveillance (sans ça il ne servait qu'une fois).
12. **Et « 🚀 Tout préparer » — le bouton que l'app lui dit d'utiliser — n'avait
    jamais été exécuté.** Il fait quatre choses, toutes vérifiées désormais :
    télécharger les photos dans `VRM-{n°}`, copier le texte complet **avec la
    référence**, **mémoriser la paire** (sans ça le nouvel onglet ne sait pas
    laquelle remplir) et ouvrir la page de dépôt.

13. ⚠️⚠️ **14 DES 57 ANNONCES « EN LIGNE » ÉTAIENT DÉJÀ VENDUES.** Plainte de
    Julien le 13 septembre (« des paires qui sont vendues »). Mesuré : la file
    ne filtrait que sur `is_closed`, or **Vinted ne ferme pas toujours
    l'annonce** après la vente, et une capture peut dater (`julatace3535` à
    **85 h**). La preuve de vente (`transaction → item_id`) **prime sur l'état
    de l'annonce** : une paire prouvée vendue sort de la file, dans l'app comme
    dans le panneau. Et l'écran **le dit** — une file qui rétrécit sans
    explication se lit comme une perte.
14. ⚠️⚠️ **LA CAPTURE A RANGÉ 81 ANNONCES QUI N'ÉTAIENT PAS À LUI.** Mesuré juste
    après la mise à jour : des **chalets, des gîtes, un appartement à La
    Plagne** — le flux `api/discovery/category/53` de la page qu'il regardait.
    Mon parser `__next_f` prenait tout objet en forme d'annonce sans se demander
    **à qui** il est. Le compteur aurait annoncé « 81 annonces sur Leboncoin »,
    et les 81 seraient ressorties en « non reliées ».
    ⇒ On ne garde que ce qu'on peut **attribuer** : l'annonce porte notre
    référence `VRM-{n°}`, ou son propriétaire est le compte connecté. Le reste
    est **ignoré**, pas caché. Et `lbcJamaisLu` vaut « rien vu » quand plus rien
    n'est attribuable — sinon on retombait sur le zéro inventé qu'on venait de
    retirer. *Élargir une lecture sans l'attribuer, c'est inventer des données.*
15. ⚠️⚠️ **ET LE FILTRE D'ATTRIBUTION N'AVAIT ÉTÉ POSÉ QUE CHEZ UN DES TROIS
    LECTEURS.** Mesuré le 13 septembre sur sa vraie base, l'extension à jour et
    qui tourne (`panel_diag_capture.majAt` à la minute) : `lbc_listings`
    contient bien les **81 annonces qui ne sont pas à lui**, rangées le matin
    même à 06:38 depuis `api/discovery/category/53`. Le filtre avait été mis sur
    `lbcCount`… et **seulement là**. `readLbcItems()` rendait tout, donc :
    - le **panneau** affichait « **81** vues sur Leboncoin » et déroulait
      **81 chalets** en « annonces non reliées », sur l'écran qui sert à publier
      ses baskets — pendant que l'**app** en affichait **0** (elle, filtrait).
      Deux lecteurs, deux règles, la même ligne : §11. Et c'est l'app↔extension
      qui diverge, le défaut que `audit-places.cjs` existe pour attraper.
    - ⚠️⚠️ **Et le cas qui coûte** : `adRefKeys` lit « n° 1234 » dans le TITRE de
      **n'importe quelle** annonce. Un chalet nommé « … n°412 » relie la paire
      N°412 et la **sort de sa file en silence** (« déjà en ligne sur
      Leboncoin ») — il ne la publie jamais. Mesuré aujourd'hui : **0 cas réel**,
      mais c'est un rapprochement par ressemblance (§5) sur des données qui ne
      sont **même pas les siennes**. Le banc sert exprès ce chalet-là.
    ⇒ `estALui` vit au **READ** (`readLbcItems`), pas chez un lecteur, et c'est
    **la même** que celle de l'app (`ref || customRef || lbcUser` — celle de
    l'extension oubliait `customRef`, troisième écart sur la même notion). Rien
    n'est supprimé en base. Mesuré après : **81 → 0**, et les deux écrans
    s'accordent. **4 échecs** sur le code d'avant.
    ⚠️ **QUATORZIÈME fois qu'un de mes contrôles est fautif**, et la TROISIÈME
    fois que c'est « il meurt au lieu de rapporter » : sur le code d'avant
    `estALui` n'existe pas, mon premier jet sortait en `TypeError` et le bilan
    n'était jamais imprimé.
16. ⚠️⚠️ **ET UN COMPTE QU'IL A EXCLU ALIMENTAIT ENCORE LA FILE.** Mesuré le
    13 septembre : la file du panneau contenait la **N°118, qui vient de
    `liliand653`** — le compte que Julien a lui-même mis de côté dans l'app. Le
    panneau lui proposait donc de publier sur Leboncoin l'annonce d'un compte
    qu'il a écarté. C'est § « un CHOIX n'est pas une panne » **retourné** : une
    fois le geste fait, l'app n'a plus rien à en tirer.
    ⚠️ Et ce n'était vrai que **là** : `buildEbayData` filtrait, l'**app**
    filtrait (`offAcc`) — seule la file Leboncoin du panneau ne le faisait pas.
    **L'app annonçait 39, le panneau 40**, sur exactement la même donnée (§11).
    ⇒ Mesuré après : **40 → 39**, et le panneau **le dit** en gris et sans
    consigne (« son compte Vinted est exclu de l'app — ton choix »), parce
    qu'une file qui rétrécit sans explication se lit comme une perte.
    **2 échecs** sur le code d'avant.
    ⚠️ **Mesuré au passage, et laissé tel quel** : une paire de la file (**N°30**)
    vient de `3170782324`, un identifiant de moisson qui **n'a plus de compte
    dans VRM**, dernière capture il y a **33 jours**. L'app et le panneau la
    gardent **tous les deux** — donc aucune divergence à corriger, et je
    n'invente pas une troisième règle sans qu'il ait tranché. À lui de dire.
17. **« Des photos qui n'apparaissent pas »** — et je n'ai pas pu trancher :
    Vinted **bloque mes requêtes** (même page de blocage pour deux annonces
    différentes), et l'URL d'une photo ne porte qu'une signature `?s=…`, **sans
    date d'expiration lisible**. Plutôt que de deviner, **la carte le constate
    elle-même** : si l'image ne charge pas, une note apparaît (« le lien Vinted
    a expiré ») avec la porte — rouvrir l'annonce recapte des liens frais. C'est
    la méthode du bandeau eBay appliquée à ce que je ne peux pas mesurer.

⚠️⚠️ **ET `lbc.js` N'AVAIT JAMAIS TOURNÉ** — 480 lignes, le panneau qui SERT à
publier. `node --check` ne lit que la syntaxe. `scripts/bancs/leboncoin.cjs` le
charge dans une fausse page avec un faux `chrome.runtime` : **18 contrôles, 10
échecs sur le code d'avant**. Le plus parlant : « la consigne *supprime-la* est
rendue **3 fois pour 1 vente prouvée** ».
- ⚠️ **Neuvième ET dixième fois qu'un de mes contrôles crie au loup**, et le
  second est le plus instructif. Jet 1 : « le mot *vendue* est interdit dans le
  groupe du doute » → il attrapait « je n'ai pas la preuve qu'elles sont
  **vendues** ». Jet 2 : « le mot *supprime* est interdit » → il attrapait « je
  ne te dis pas de les **supprimer** », c'est-à-dire la NÉGATION de ce qu'il
  traque. ⇒ Ce qui est interdit n'est pas un mot mais une **instruction**, et une
  instruction **se compte** : « supprime-la » ne doit être rendu qu'autant de
  fois qu'il y a de ventes prouvées. *La donnée déclenche, jamais la
  formulation.*
- ⚠️ `EXT_CAPACITES.lbctitre = '5.55.4'` : c'est l'EXTENSION qui publie, avec SA
  version de la règle. Sans cette garde, l'app dirait « le titre exactement tel
  qu'il partira » à une extension qui enverra l'ancien — le défaut le plus
  coûteux du projet, pour la **cinquième** fois.
- ⚠️ **Et les bancs de rendu dépendaient du CDN de Vinted sans le dire** : aucun
  n'interceptait les images. Tant que l'écran rendu n'en avait pas, ça ne se
  voyait pas ; le jour où la liste a eu ses vignettes, `verif_dark` est mort sur
  « page.screenshot: Timeout 30000ms exceeded ». Ce n'était pas un défaut de
  l'app — le banc était à un hoquet de réseau de tomber, depuis toujours. Les
  images externes sont coupées : c'est du déterminisme, pas un moyen de cacher
  une image cassée.
- `audit-places.cjs` ne compare plus l'existence des règles mais **leurs
  sorties** : l'app et l'extension doivent rendre **le même titre** sur les mêmes
  entrées (8 cas réels). Sans ça l'app en montre un et l'extension en publie un
  autre. **7 échecs** sur le code d'avant.

### ⚠️⚠️ « TROUVE UN MOYEN DE LE FAIRE » — ET LE MUR QUE J'ANNONÇAIS N'EXISTAIT PAS
Julien, 13 septembre : « ça me fait télécharger des photos dans mon ordi, ça ne
met pas la catégorie ni le reste donc bon », puis « **trouve un moyen de le
faire** ».

J'avais refusé la publication automatique sur **deux** arguments. Le premier
était **faux**, et je l'avais écrit deux fois dans ce dossier sans jamais
l'essayer : « un navigateur interdit de remplir un champ fichier par
programme ». **Mesuré dans Chromium** : ce qui est interdit, c'est
`input.value = '/chemin/photo.jpg'`. **`input.files = dataTransfer.files`
marche** — la page reçoit un vrai `File` (nom, taille, type), l'événement
`change` part, et le glisser-déposer synthétique marche aussi.
⇒ *Une impossibilité qu'on n'a pas mesurée est une opinion.* Avant d'écrire
« c'est impossible », l'essayer — ça coûtait dix lignes et un banc.

**Ce qui est livré (mesuré au banc sur le VRAI `lbc.js`)** :
- **Les photos s'ATTACHENT au formulaire** — plus rien ne touche son disque. Le
  fond lit les octets (le CDN Vinted n'a pas d'en-tête CORS, la page seule ne
  peut pas), le panneau fabrique les `File` nommés `VRM-{n°}-{i}.jpg` et les
  attache. **3 photos attachées, 0 téléchargement** au banc ; **6 échecs** sur le
  code d'avant, dont « il a demandé 3 téléchargements » et « 0 fichier attaché ».
- **La catégorie et l'état sont choisis.** Les listes déroulantes ne sont pas des
  `input` : `findField` ne les voyait même pas — c'est *exactement* pourquoi « ça
  ne met pas la catégorie ». `choisirListe` ne retient une option que si son
  libellé **correspond vraiment** ; sinon elle laisse vide. *Une catégorie fausse
  fait plus de mal que pas de catégorie* (leçon eBay), et on ne prend jamais « le
  premier de la liste ».
- **Le bandeau écrit le CHIFFRE** : « 3 photos attachées », ou la raison quand il
  n'y en a aucune. Jamais « ton annonce est prête ».

⚠️ **CE QUI MANQUE ENCORE POUR PUBLIER TOUT SEUL, ET C'EST MESURABLE** : le dépôt
Leboncoin est un formulaire **en étapes**, et je n'en ai jamais vu qu'**une**
(`lbc_recon`, 2 août : un seul champ, `name="subject"`). L'extension enregistre
désormais **chaque étape distincte** (`lbc_recon.etapes` — noms de champs,
libellés d'options, présence d'un champ fichier ; **aucun contenu saisi**). Un
seul dépôt fait à la main suffit à me donner la carte complète. **Ne pas écrire
le clic « Publier » avant d'avoir ces étapes** : ce serait promettre ce qu'on n'a
pas mesuré, le défaut le plus coûteux du projet.

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
- ⚠️⚠️ **CETTE LIGNE DISAIT L'INVERSE, ET ELLE ÉTAIT FAUSSE** : « les photos ne
  peuvent pas être injectées, un navigateur interdit de remplir un champ fichier
  par programme ». **Mesuré le 13 septembre dans Chromium** : ce qui est interdit
  c'est `input.value = '/chemin/photo.jpg'` ; **`input.files =
  dataTransfer.files` marche**. Je l'ai écrit deux fois dans ce dossier sans
  jamais l'avoir essayé. *Une impossibilité qu'on n'a pas mesurée est une
  opinion.* **Reporté sur eBay le 13 septembre** — voir la section suivante.
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

### ⚠️⚠️ ET eBAY N'AVAIT APPRIS AUCUNE DES LEÇONS DE LEBONCOIN
Les deux assistants sont livrés « sur le même modèle », et c'est précisément ce
qui rend le piège invisible : **les six défauts mesurés et corrigés sur Leboncoin
le 13 septembre étaient tous entiers dans eBay**, côte à côte, dans un fichier
que personne ne relisait parce qu'il était déjà « fait ». *Un correctif « sur le
modèle de » n'est pas un correctif appliqué aux deux.*

**Mesuré avant de coder** (le VRAI `buildEbayAd` exécuté sur la vraie base, file
eBay vide aujourd'hui — on mesure donc ce qui arrive **le jour où il coche**) :

1. ⚠️⚠️ **14 DE SES 53 ANNONCES EN LIGNE ET NUMÉROTÉES SONT PROUVÉES VENDUES**, et
   `buildEbayData` ne filtrait que sur `is_closed`. Exactement sa plainte du
   13 septembre (« des paires qui sont vendues »), corrigée pour Leboncoin le
   jour même. **Sur eBay c'est plus coûteux encore** : une vente y engage une
   expédition qu'il ne peut pas faire. La preuve (`transaction → item_id`, §5)
   **prime sur l'état de l'annonce**, et le panneau **dit combien** il écarte —
   une file qui rétrécit sans explication se lit comme une perte.
   ⚠️ Et l'absence de preuve n'est pas une preuve : sans **aucune** transaction
   captée, rien n'est écarté (le banc le vérifie — sinon une lecture vide
   viderait sa file, « rien lu » ne vaut pas « rien »).
2. **18 titres sur 53 sortaient avec la marque écrite deux fois** — « Nike nike
   shox tl », « Salomon salomon XT-6 » — et **51 sur 53** en « taille 42 » au
   lieu de « T42 ». `buildEbayAd` recollait `[marque, titre].join(' ')` puis
   `.slice(0, 80)` : **une seconde règle de titre**, avec le défaut que
   `lbcTitre` corrigeait juste à côté. Le plafond est devenu un **paramètre**
   (§11 : une notion, une règle, un propriétaire) — 50 pour Leboncoin, 80 pour
   eBay, la même règle pour les deux.
3. ⚠️⚠️ **LES PHOTOS ÉTAIENT TÉLÉCHARGÉES SUR SON DISQUE** (« ça me fait
   télécharger des photos dans mon ordi »), et le fichier affirmait toujours
   l'impossibilité mesurée fausse. Elles s'attachent. **0 téléchargement,
   3 photos attachées** au banc.
4. **Les listes déroulantes n'étaient même pas REGARDÉES** : `champ()` ne lit que
   `input`/`textarea`. C'est mot pour mot « ça ne met pas la catégorie ni le
   reste ». L'**état**, la **marque** et la **pointure** sont choisis —
   ⚠️ **jamais la CATÉGORIE** : eBay la propose à partir du titre et se trompe
   moins que moi, qui n'ai jamais vu son arbre. Le banc **exige** qu'elle reste
   vide : le jour où quelqu'un « complète la symétrie » avec Leboncoin, il passe
   au rouge.
5. ⚠️⚠️ **« Titre copié » SANS RIEN COPIER**, et ici c'était pire qu'ailleurs :
   `copy()` n'avait **aucun repli**. Une promesse rejetée ne passe pas par
   `catch`. Prouvé au banc sur le code d'avant : le presse-papier reste vide,
   deux `NotAllowed` non gérés, et le panneau annonce « Référence copiée :
   VRM-101 » — la référence est le seul filet quand le formulaire n'a pas de
   champ pour elle.
6. **L'arrêt au bout de 90 s se faisait en silence**, et `panel_ebay_form` était
   **écrasée à chaque passage** : la dernière étape vue effaçait la seule que
   j'avais. Toutes les étapes sont gardées par signature (comme
   `lbc_recon.etapes`), et le bandeau dit que c'est fini avec un
   « Re-remplir » qui **relance** la surveillance.

- `scripts/bancs/ebay.cjs` : **35 contrôles, 16 échecs sur le code d'avant**.
  `audit-places.cjs` : **4 échecs** de plus (vente prouvée, compte rendu, marque
  doublée, règle de titre unique).
- ⚠️ **ONZIÈME ET DOUZIÈME FOIS QU'UN DE MES CONTRÔLES CRIE AU LOUP**, et les deux
  sont des récidives nommées dans ce dossier : (1) j'interdisais le MOT
  « télécharg », et il attrapait la phrase **honnête** que je venais d'écrire
  (« rien n'est téléchargé sur ton ordinateur ») — ce qui est interdit est
  l'**instruction** d'aller chercher un dossier sur son disque ; (2)
  `audit-places.cjs` exigeait la signature exacte `(brand, base, size)` et
  tombait au rouge quand le plafond est devenu un paramètre — la fonction était
  **mieux partagée** qu'avant. *Un audit suit la RÈGLE, pas son orthographe.*
- ⚠️ **Et le banc MOURAIT sur le code d'avant** (un `click` sur un bouton
  inexistant expire à 30 s), donc deux blocs entiers n'étaient jamais rendus et
  je ne voyais que 10 échecs sur 16. *Un banc ne meurt pas, il rapporte* — même
  erreur que le premier jet d'`audit-places.cjs`.
- ⚠️ **La phrase de l'app était restée en arrière** : l'écran Annonces promettait
  « photos téléchargées » pour les deux places. Elle suit maintenant la version
  INSTALLÉE, place par place (`capPhotos`).
  ⚠️⚠️ **Et je n'en avais corrigé QU'UN des deux.** En balayant « télécharg » sur
  tout le dépôt : l'**écran Leboncoin** portait la même affirmation
  (« bouton 🚀 Tout préparer : photos téléchargées, texte copié, formulaire
  pré-rempli »), sans **aucune** garde de version. *Une suppression « terminée »
  se vérifie sur ce qui RESTE* — c'est la leçon du pipeline Factures, refaite le
  jour même, à une heure d'intervalle.
  ⇒ `audit-coherence.cjs` porte désormais la règle, dans la forme acceptée de
  `panne.cjs` : **toute phrase qui affirme ce que l'extension fait des photos
  doit avoir une garde de version dans son voisinage immédiat**. Interdire le
  *mot* attraperait la phrase honnête ; c'est la GARDE qui est exigée. **Rouge
  sur le code d'avant**, et il nomme la ligne.
  ⚠️ **TREIZIÈME fois qu'un de mes contrôles crie au loup**, et la récidive
  exacte du balayage des sondes : il s'est déclenché sur **mon propre
  commentaire**, celui qui cite la phrase d'avant pour expliquer pourquoi elle
  est partie. Retirer les lignes qui *commencent* par `//` ne suffit pas — un
  bloc `/* … */` de dix lignes n'en a aucune. Les blocs sont neutralisés en
  gardant les retours à la ligne, pour que les numéros signalés restent ceux du
  fichier.
- ⚠️ Et un **commentaire** de `lbc.js` répétait encore l'impossibilité fausse,
  quinze lignes au-dessus du code qui attache les photos. *Une suppression
  « terminée » se vérifie sur ce qui RESTE, commentaires compris* : un
  commentaire faux se relit comme une règle.

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

### ⚠️⚠️ LA LIGNE `main` PÈSE 197 Ko, ET HUIT LECTEURS LA PRENAIENT EN ENTIER
Mesuré le 15 septembre : `main` — la ligne des réglages synchronisés — fait
**197 Ko** (127 Ko de `vinted_annonce_numeros`, 25 Ko de
`vinted_sale_overrides`), et **huit** endroits la lisaient en `select=data` :
- le **panneau sur Vinted** (`buildPanelData`), à **chaque visite** ;
- les files **Leboncoin** et **eBay** du panneau, sur chaque page de ces sites ;
- l'**écran Leboncoin** de l'app ;
- la sauvegarde des numéros, `getPairPhotos`,
- et **le widget de son iPhone**, qui n'en lit que **trois clés pesant 1 Ko**.

C'est §4.4 mot pour mot (« jamais `select=data` sur une ligne lourde ») sur la
ligne la plus lue du projet — et c'est de l'**égress**, sur la route même dont le
dossier dit qu'un `select=data` avait **crevé le quota (5,7 Go)**. *La leçon
avait été apprise pour les commandes, jamais pour `main`.*
- **Mesuré, valeurs identiques** : widget **197 Ko / 1 070 ms → 1 Ko / 494 ms** ·
  écran Leboncoin **197 → 133 Ko** · panneau **197 → 161 Ko**.
- Exécuté sur la vraie base (le `vm` avant/après) : `buildPanelData` **1,5× plus
  vite**, `buildLbcData` **1,6×**, **résultat identique** dans les trois cas
  (file 40 → 40). Gagner du temps en perdant une paire serait le pire échange.
- **L'alias porte le nom de la clé** (`vinted_annonce_numeros:data->vinted_annonce_numeros`) :
  la ligne rendue se lit exactement comme avant, donc aucun appelant à renommer
  — donc aucune chance d'en oublier un.
- Un seul lecteur a le droit de tout prendre : **`cloudLoad`**, qui restaure
  toutes les clés synchronisées. C'est le **propriétaire** de la ligne (§11).
⚠️⚠️ **ET LA MOITIÉ QUI MANQUERAIT À UN CONTRÔLE POSÉ SUR LES OCTETS** : projeter
**trop peu** ne coûte rien et ne lève rien — la clé oubliée vaut `undefined`,
c'est-à-dire un compte exclu qui revient dans la file, ou une paire retirée du
stock qu'on republie, **en silence**. `audit-lectures.cjs` relit donc le corps de
chaque fonction, y cherche les clés de `main` qu'elle utilise **vraiment**, et
exige que la liste projetée les contienne toutes. **8 échecs** sur le code
d'avant, et rouge dès qu'on retire une clé d'une liste (prouvé).
⚠️ **Et ce défaut existait déjà : `vinted_pairs_lost` manquait à la file
Leboncoin du panneau.** L'app l'écartait, `buildEbayData` l'écartait — le panneau
proposait de publier une paire qu'il a déclarée **retirée du stock**. Mesuré :
**0 paire retirée aujourd'hui**, donc 0 cas réel, mais c'est le motif exact de
« l'app annonçait 39, le panneau 40 » (§11). Les trois lecteurs, une seule règle.
⚠️ **DEUXIÈME FOIS QUE MON PROPRE BANC SERT LA MAUVAISE FORME** (§6.3) :
`audit-places.cjs` rendait la ligne **brute** pour `id=eq.main`. Dès que les
files ont projeté, `main.vinted_annonce_numeros` se lisait sur un objet qui ne
l'a pas → **file vide**, et l'audit criait au loup sur un code intact. Même
piège que « 0 bordereau prêt à imprimer » sur l'écran Colis. Il projette.
⚠️ **Et deux allers-retours de plus, pour rien** : `harvest_*_billing` était lu
**deux fois** sur Ma journée (les soldes, puis les boosts) — **4 Ko**, mais
**710 ms × 2**. Ici ce n'est pas l'égress qui coûte, c'est le **voyage**.
`fetchBillingRows` partage la requête en vol (`cachedRow`).

### ⚠️⚠️ ET UNE LECTURE RATÉE POUVAIT RESSUSCITER TOUS LES COMPTES SUPPRIMÉS
**Seizième forme de « rien lu ne vaut pas rien » — et la première dans l'APP qui
DÉTRUIT.** `vrm_blocked_accounts` est la liste que l'extension lit pour refuser
de recapter un compte supprimé. Le dossier décrivait ce cas comme corrigé : il
l'était **du côté qui lit**. C'est l'**app** qui écrit cette liste
(`deleteVintedAccount`), en **lire-fusionner-réécrire**, et la lecture s'écrivait
`r.ok ? await r.json() : []`.
⇒ Un simple timeout — la base debout par ailleurs, donc **l'écriture passe** —
repartait d'une liste vide et **réécrivait la ligne avec le seul compte du
moment**. Prouvé au banc sur le code d'avant : la ligne part avec `["333"]`,
**`shop_cancale` et l'autre compte effacés**. Tous les comptes supprimés avant
lui redeviennent capturables, **jetons compris** — c'est mot pour mot « il
revenait tout le temps ».
*La moitié qui écrit n'avait jamais appris la leçon de la moitié qui lit.*
- On ne fusionne **que si on a lu** ; sinon on n'écrit pas.
- Et **on le dit** : la fonction rend `{ok, memo}`, et le message devient
  « supprimé — mais la base n'a pas répondu pour le mémo. S'il réapparaît,
  resupprime-le. » Se taire ici, c'est le défaut d'origine.
- `audit-fusion.cjs` ne s'arrêtait qu'aux onze lire-fusionner-réécrire de
  l'extension. Il **exécute** maintenant la vraie fonction d'`App.jsx` dans un
  `vm`, sur le cas qui détruit (**lecture KO, écriture OK** — la panne totale
  n'est presque jamais le cas dangereux) et dans **l'autre sens**. **3 échecs**
  sur le code d'avant.

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

### ⚠️⚠️ 135 DE SES 176 OFFRES ÉTAIENT CACHÉES PAR UNE RESSEMBLANCE DE TITRE
Mesuré le 15 septembre sur sa vraie base : sur ses **176 offres de moins de
14 jours**, l'accueil n'en montrait que **41**. Les 135 autres disparaissaient
parce qu'une vente — **n'importe laquelle, n'importe quand, sur n'importe lequel
de ses neuf comptes** — portait le **même titre**. C'est §5 mot pour mot :
« 22 % des ventes portent un titre en double, et le titre désignait la MAUVAISE
annonce dans 3 cas réels ».
⚠️ **Et l'asymétrie est décisive** : montrer une offre déjà réglée coûte un clic
sur « ✓ » ; en cacher une vivante lui fait **rater une vente** — la carte dit
elle-même « une offre acceptée, c'est presque une vente ».
⚠️ **CHERCHÉ D'ABORD, UNE IDENTITÉ** (§5 l'exige avant de toucher une
ressemblance) : sur les **518 offres**, `item_id` **0/518**, `transaction`
**0/518**, `conversation` **0/518** — et les liens de l'email sont des
redirections `links.vinted.com` en base64 qui ne portent que l'identifiant
d'invitation, **le même dans tous les emails**. Il n'existe donc **aucun pont
certain**. On n'échange pas une ressemblance contre une autre : on lui ajoute
les **contraintes réelles**, celles qui ne se devinent pas.
| contrainte | pourquoi c'en est une | offres rendues |
|---|---|---|
| le **COMPTE** | une offre reçue sur `tomj683` ne peut pas être réglée par une vente sur `angeled92` | **13** |
| la **CHRONOLOGIE** | une vente ANTÉRIEURE à l'offre ne l'explique pas — il avait donc une seconde paire | **4** |
| un titre **NON AMBIGU** | « adidas spezial noir taille 35,5 » est porté par **5 transactions** : vendre l'une n'apprend rien sur les offres faites aux autres (§2.4) | **17** |
⇒ Mesuré après, la VRAIE fonction exécutée sur la vraie base : **42 → 76 offres
affichées**, **34 qu'il ne voyait pas** — dont une à **65 €** sur `tomj683`.
- La tolérance de **6 h** n'est pas un réglage fin : elle absorbe le délai de
  classement de l'email, et mesurée à **6, 24 et 48 h le résultat est
  identique** (101 mises de côté). À 0 h on en garde 13 de plus.
- **Aucune vente captée ⇒ on ne cache RIEN** : une lecture vide ne doit pas vider
  sa liste (« rien lu » ne vaut pas « rien »).
- ⚠️ **Une liste qui rétrécit sans explication se lit comme une perte** (leçon de
  l'écran Leboncoin) : la carte dit maintenant combien sont mises de côté et
  pourquoi. Le chiffre, jamais la promesse.
- ⚠️ La chaîne vivait **en plein milieu du JSX** — impossible de savoir combien
  elle rendait sans la recopier (même défaut que les filtres de l'écran Ventes).
  Elle est dans `offresAtraiter` (§11, un seul propriétaire), et
  `audit-offres-titre.cjs` l'**exécute** dans un `vm` : il juge ce qu'elle REND.
  ⚠️ **Prouvé en RÉAFFAIBLISSANT la règle au titre seul** — les trois contrôles
  passent au rouge. « La fonction n'existe pas sur le code d'avant » n'est PAS
  une preuve (c'est la leçon d'`estALui`) : ce qu'il faut montrer, c'est que le
  contrôle attrape la RÈGLE fautive.
- ⚠️ **CINQUIÈME FOIS QU'UN DE MES AUDITS MEURT AU LIEU DE RAPPORTER**, et je
  viens de la refaire : le premier jet chargeait la règle **sans ses bornes**
  (`OFFRE_FENETRE_J`), sortait en `ReferenceError`, et **aucun contrôle n'était
  rendu**. Les bornes sont extraites du source, pas recopiées — recopiées, elles
  mesureraient MES chiffres, pas ceux de l'app.
- ⚠️⚠️ **ET LE MÊME DÉFAUT VIVAIT SUR LE MÊME ÉCRAN, À CÔTÉ.** « N ventes
  repérées via bordereau, pas encore synchronisées » rapprochait aussi par
  **titre** — alors que les **deux** côtés portent un n° de **transaction** :
  mesuré, **165 des 166 bordereaux** le portent et les 385 ventes aussi. Le
  titre se trompait **dans les deux sens** : il montrait à tort
  `tx 22155558568` (deux paires dans un même colis, titre composé qui ne
  correspond à aucune vente) — une **fausse alerte**, et une fausse alerte fait
  cesser de lire les vraies ; et il en cacherait une vraie dès qu'une paire au
  même libellé est vendue. `bordereauxPasSynchro` juge sur la transaction ; un
  bordereau **sans** transaction n'est pas jugé (mieux vaut un blanc qu'un faux).
  *Chercher l'identité AVANT d'aménager la ressemblance : ici elle était déjà là.*
- ⚠️ **Et une ligne morte préparait le retour du titre** : `vendus.add('t:'+titre)`
  alimentait un ensemble que **plus rien ne lisait** — le test par titre avait
  été retiré, sa ligne d'alimentation était restée. Même famille que le tiroir
  `Nav` : un relecteur la « rebranche » un jour en croyant réparer un oubli.
  L'audit refuse qu'un ensemble « vendu » soit alimenté par un titre.
- ⚠️⚠️ **SIXIÈME FOIS QU'UN DE MES AUDITS MEURT AU LIEU DE RAPPORTER**, et les
  **deux dernières dans ce fichier même** : charger la règle dans un `vm` ne
  suffit pas, l'**appeler** peut lever, et le rejet tue le processus **avant le
  bilan**. Tout appel passe par `essaie()` : ce qui lève devient un contrôle
  ROUGE. Prouvé en rebasculant les deux règles sur le titre — **3 contrôles
  rouges et un bilan imprimé**, au lieu d'une pile d'appels.
- ⚠️ **Et la lecture rapatriait le double de ce qu'elle lit** : `email_offer_*`
  porte `extrait`, le morceau brut de l'email — **102 Ko des 231 Ko** — et l'app
  ne le lit **nulle part**. Projetée : **231 Ko / 1 192 ms → 111 Ko / 402 ms**,
  valeurs identiques (518 lignes × 9 champs, 0 écart).

### ⚠️⚠️⚠️ « CITÉE DANS UNE TRANSACTION » N'EST PAS « VENDUE » — 15 PAIRES ÉCARTÉES
**Le défaut le plus coûteux de la journée, et il vient de MOI** : `lireVentesProuvees`
(écrite le 15 septembre) prenait **tout `item_id`** vu dans `harvest_*_txn_*`.
En vérifiant la FORME (§6) : sur les **711 lignes**, **468 portent `status: 1` et
un `status_title` VIDE** — ce sont des **conversations**, pas des ventes. Une
seule annonce en portait **treize** (« salomon XT-6 blanc taille 40 », **toujours
en ligne**) : treize acheteurs lui ont écrit, aucun n'a acheté.
⇒ Conséquence sur ses **65 annonces en ligne** : la « preuve » en écartait **15**
des files Leboncoin et eBay — **quinze paires qu'il a encore**, qu'il ne pouvait
donc plus publier ailleurs. Avec un vrai état de commande : **zéro**.
⚠️ **Et c'est ce qui l'a rendue invisible** : sur les **412 annonces FERMÉES** la
preuve tenait (188 états de vente). Elle avait donc l'air juste partout où on la
regardait — sauf là où elle coûtait.
- Une vente est prouvée quand Vinted donne un **état de commande** à la
  transaction (`status_title` non vide) **et** que cet état ne la fait pas
  REVENIR (`PAS_UNE_VENTE` : annulée, retour, suspendue, paiement échoué).
- ⚠️ **On ne liste pas de codes numériques** : un état inconnu demain doit
  compter comme une **vente**, sinon une paire vendue réapparaît dans la file le
  jour où Vinted en ajoute un — le défaut que cette preuve corrigeait. L'audit
  sert exprès « un état que je ne connais pas encore ».
- La règle est la **même des deux côtés** (`PAS_UNE_VENTE` dans l'app et dans
  l'extension) : une seule des deux corrigée, et les deux écrans divergent (§11).
- Mesuré après, sur la vraie base : **file Leboncoin 49 → 64**, panneau
  **58 → 63 annonces en ligne**, valeur du stock **3 461 → 3 653 €**.
⚠️ **ET MON AUDIT EST PASSÉ VERT POUR LA MAUVAISE RAISON.** `lireVentesProuvees`
est **async**, et je ne l'`await`ais pas : `r.vendus` valait `undefined` sur une
Promise, donc « rien n'est vendu » — les contrôles qui attendent une **absence**
passaient, seuls ceux qui attendent une présence tombaient. *Un contrôle vert par
accident est pire qu'absent.* (Et `instanceof Set` est FAUX dans un `vm` : il a
son propre realm — on teste que l'objet sait répondre `has`, pas sa lignée.)
⚠️ **TROISIÈME FOIS QUE MON BANC SERT UNE FORME QUE LE CODE NE LIT PLUS** (§6.3) :
`audit-places.cjs` servait une ligne txn **sans** `status_title` — c'est-à-dire
une conversation — et s'étonnait qu'elle ne prouve rien. Ses fixtures portent
l'état.

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

### ⚠️⚠️ ET L'ÉCRAN LEBONCOIN NE CONNAISSAIT QUE DEUX ÉTATS SUR TROIS
Vu **au rendu, sur ses vraies données**, le 15 septembre. Sa phrase
d'introduction s'écrivait `extSait('photoslbc')==='ok' ? A : B` — **deux** états
pour une fonction qui en rend **trois**. Le troisième est celui de son
**iPhone** : `absente`. L'écran lui annonçait donc « photos téléchargées dans un
dossier » — la description d'un comportement **qui ne peut pas avoir lieu**
(sans extension, rien n'est ni téléchargé ni attaché) — au lieu du vrai geste :
ouvrir l'app sur l'ordinateur où elle est installée.
C'est le trou du premier jet d'`extSaitLireCodes` (« l'extension la plus en
retard était la seule à ne rien déclencher »), et **l'écran Annonces, lui,
traitait déjà les trois** : le correctif n'avait été appliqué qu'à un des deux
endroits. *Une suppression « terminée » se vérifie sur ce qui RESTE.*
⚠️ **ON NE JUGE PAS SUR UN MOT** — interdire « télécharg » attraperait la phrase
honnête (onzième piège de ce genre). Le banc `capacites.cjs` rend l'écran dans
les **trois** états et exige **trois phrases différentes** : deux états qui se
ressemblent, c'est un état oublié. **3 échecs** sur le code d'avant, dont
« absente » et « en retard » à **100 % de recouvrement** — mot pour mot la même
phrase de 172 caractères.
⚠️ **DIX-NEUVIÈME FOIS QU'UN DE MES CONTRÔLES CRIE AU LOUP** : le seuil de §7
(60 caractères communs) ne s'applique pas tel quel ici — la phrase a **trois
morceaux** (la file · où ça se passe · les photos) et les deux premiers sont
**légitimement** communs aux trois états. On mesure le recouvrement **relatif** :
mesuré 13 % · 51 % · 13 % après, contre **100 %** sur le défaut.

### ⚠️⚠️ « 64 EN LIGNE » ET « 63 » — LE COMPTE EXCLU N'ÉTAIT PAS ENCORE ARRIVÉ
Vu **au rendu, sur ses vraies données** : l'écran Annonces annonçait **64 en
ligne**, le Tableau de bord **63**. Une notion, deux nombres (§11) — et le
commentaire du tableau de bord affirmait pourtant, en toutes lettres, « compte
EXACTEMENT ce que montre l'onglet Annonces ».
⚠️ **Et ni l'un ni l'autre n'avait tort.** La cause n'était dans aucun des deux
calculs : le compte **`liliand653`, exclu**, est déclaré **dans le nuage**, et
les deux écrans lisent cette liste **dans le navigateur, au MONTAGE**
(`useState(() => load('vinted_accounts_hidden'))`). Sur un **appareil neuf** elle
est vide — donc le compte exclu compte, jusqu'à ce qu'un second passage trouve
le `localStorage` rempli par `cloudLoad`. Mesuré : l'écran Annonces rendait
**64 au premier passage et 63 au second**, et le tableau de bord l'inverse.
C'est §5.49 mot pour mot (la carte des points relais), sur la donnée qui dit
**quels comptes il a mis de côté**.
⇒ Rattrapage par **`onCloudReady`** des deux côtés, et le calcul du tableau de
bord **attend le nuage** (ce sont des réglages synchronisés, pas des réglages
d'appareil). ⚠️ On ne remplace que ce qui est resté **VIDE** : sinon une
exclusion faite pendant le chargement serait écrasée. Mesuré après, sur la vraie
base : **63 / 63 dans les deux ordres** (avant : 64/63 et 64/63).
⚠️⚠️ **ET J'AI D'ABORD CORRIGÉ LE SYMPTÔME.** Premier jet : faire *publier* le
nombre par Annonces et le faire *consommer* par le tableau de bord (le motif de
`vrm_colis_prets`). Ça marchait dans **un** ordre et pas dans l'autre — et
surtout ça **figeait un 64 périmé**. *Un écart entre deux écrans n'est pas
toujours un problème de propriétaire : ici les deux lisaient la même chose, au
mauvais moment.* Retiré, et la cause corrigée.
⚠️⚠️ **ET LE CONTRÔLE NE PEUT SE DÉCLENCHER QUE SUR LE PREMIER ÉCRAN RENDU** :
dès le second, `cloudLoad` a rempli le navigateur et tout s'accorde. Mes deux
premiers jets enchaînaient les onglets dans la même page — **verts sur le
défaut**. `comptes.cjs` ouvre donc **deux contextes NEUFS**, un par écran, avec
l'exclusion déclarée **uniquement dans le nuage**. Sur le code d'avant :
**Annonces 48 · Tableau de bord 47** — rouge. *Un contrôle qui ne peut pas
échouer est pire qu'absent.*
⚠️ **Et j'ai avalé `projette()` en découpant un banc** (§4.11) : le bloc que je
remplaçais s'étendait jusqu'à la fonction suivante, et `verif_visuel.cjs` est
mort sur « projette is not defined ». *Une coupe se vérifie sur ce qui RESTE.*

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

### ⚠️⚠️ « BONJOUR JULIEN » — LE PREMIER ÉCRAN D'UNE NOUVELLE PERSONNE MENTAIT TROIS FOIS
Demande de Julien, 16 septembre : « continue à améliorer l'app pour qu'elle
accueille bientôt de nouvelles personnes. »

**Mesuré AU RENDU, pas dans le code** (§6.2), sur une installation neuve : base
**cloisonnée**, session valide, **zéro ligne**. Ce que voit la première vendeuse
qui ouvre VRM, en haut du tout premier écran :
> **Bonjour Julien**
> Rien d'urgent — ta boutique tourne. 👌
> 🎉 **Tout est à jour !** Rien à expédier, rien à retirer, aucun message en attente.
> *Profite — ou va sourcer de nouvelles paires.* 👟

Trois affirmations fausses d'affilée — **son prénom**, l'état de **sa boutique**,
l'état de **ses données** — et la seule ligne vraie (« Lie un compte Vinted »)
était en gris, 13 px, tout en bas. C'est « Tout est publié 🎉 » sur une file
jamais lue (écran Leboncoin), posé sur l'écran d'accueil de quelqu'un qui
découvre l'app.

- **Le prénom est un réglage synchronisé** (`vrm_prenom`, champ dans Réglages →
  Ton compte), **vide par défaut** : l'accueil dit alors « Bonjour » tout court.
  ⚠️ **On ne le déduit PAS de l'email** — « vinted35260 » n'est pas un prénom, et
  un prénom inventé est un faux : *mieux vaut un blanc qu'un faux* (§5). Lu au
  montage, donc rattrapé par `onCloudReady`, et seulement s'il est resté VIDE
  (§5.49). ⚠️ **Julien devra taper le sien une fois** — jusque-là son accueil dit
  « Bonjour ».
- **Une boutique jamais branchée ne se fête pas.** La liste vide a ici une
  **cause connue**, et une cause connue se dit : la carte des premiers pas
  nomme les quatre gestes dans l'ordre (dézipper · charger dans
  `chrome://extensions` · **se connecter à l'extension avec le même email que
  sur VRM** · ouvrir vinted.fr une fois), avec le **lien de téléchargement du
  zip**. Le geste, jamais la promesse : l'app ne sait pas si l'extension est
  installée sur cet appareil ni si la personne passera sur Vinted, elle ne
  promet donc aucun délai.
- ⚠️ **TROIS ÉTATS, JAMAIS DEUX** : `premierJour` exige `accountsReady` (la
  lecture est revenue) **et** `!baseKO` (elle a réussi). Sans ça une base qui
  hoquette accueille quelqu'un qui a **neuf comptes** par « installe
  l'extension » — le mensonge du 10 septembre, retourné. `journee` ne recevait
  d'ailleurs **pas** `accountsReady` (elle est montée à part, `tab==='journee'`,
  hors de la table `map` — exactement comme lors du premier correctif de
  `baseKO`).
- ⚠️ §7 : une fois la carte posée, la ligne grise « Lie un compte Vinted
  (⚙️ → Comptes liés) » disait la même chose en plus petit. Elle ne reste que
  pour le cas où la journée a **quand même** des actions sans aucun compte lié
  (des colis repérés par email) — là seulement elle apprend quelque chose.
- `scripts/bancs/premierjour.cjs` : **42 contrôles**, et 10 rouges de plus sur le build d'avant (§6.1). ⚠️ **Il n'a besoin d'AUCUNE fixture** — une installation
  neuve, c'est une base vide : rien de réel ne transite, il vit donc entièrement
  dans le dépôt.
  - Le contrôle du prénom ne cherche **pas le mot « Julien »** (ce serait posé
    sur l'orthographe, et vert le jour où quelqu'un met un autre prénom en dur) :
    il rend **deux fois, avec deux valeurs du réglage**, et exige que le bonjour
    **suive la donnée**.
  - Et il vérifie **les deux autres sens**, sans quoi *ne rien fêter du tout*
    passerait tous les contrôles : un compte lié et rien à faire ⇒ la fête
    revient ; base injoignable ⇒ ni fête, ni « installe l'extension ».
  - Le lien du zip est vérifié **par son `href`** (un geste qui se clique ne se
    voit pas dans `innerText`) **et** par l'existence du fichier pointé — un
    bouton qui mène à un 404 est le défaut du pipeline Factures.
- ⚠️ **VINGT-ET-UNIÈME fois qu'un de mes contrôles crie au loup**, et c'est mon
  balayage d'exploration : `/NaN/i` attrapait « mainte**nan**t ». `NaN` se
  cherche **sensible à la casse**.

### ⚠️⚠️ ET LA CARTE DE BIENVENUE RÉCITAIT QUATRE GESTES SANS REGARDER LESQUELS ÉTAIENT FAITS
Suite immédiate : une liste de quatre étapes dont trois sont déjà faites fait
chercher au **mauvais endroit**. Or l'app SAIT — le pont dit si l'extension
tourne dans **ce** navigateur (`vmrExtPresent`), et `vmrAuthEtat()` sous **quel
compte** elle écrit. L'information existait depuis toujours ; elle n'était lue
que dans le panneau « Sécurité des données », tout au fond de Réglages, sur la
ligne « Extension identifiée · pas connectée » — là où quelqu'un dont l'app
reste vide n'ira jamais.
`etapePont` rend **cinq** états — `absente` · `demande` · `muette` ·
`pasconnectee` · `autrecompte` · `connectee` — et le TITRE de la carte nomme
celui qui bloque ; les étapes faites portent une coche.
- ⚠️⚠️ **LE CAS QUI SÉPARE LES VENDEURS, ET IL ÉTAIT MUET** : l'extension peut
  être connectée sous **une autre adresse** que celle de l'app. Ses captures
  partent alors dans **la boutique de quelqu'un d'autre**, et celle-ci reste
  vide **pour toujours** — sans un mot. C'est exactement ce que Julien craint
  (« que tout ne se mélange pas »), vu du côté de la personne qui y perd. La
  carte **nomme les deux adresses** : sans les deux, on ne sait pas laquelle
  changer. C'est une **identité** (la même adresse), pas une ressemblance.
- ⚠️⚠️ **VU AU RENDU, ET C'ÉTAIT LE PIRE DÉTAIL** (§6.2) : le bouton principal
  disait « **Ouvrir vinted.fr** » dans les trois cas — y compris quand l'étape
  qui bloque était la **connexion** de l'extension. Dans le cas « autre
  compte », y aller aurait capté dans la boutique de l'autre. *Une alerte qui
  ne dit pas quoi faire ne sert à rien ; une alerte qui dit le MAUVAIS geste
  est pire.* Le bouton suit l'étape qui débloque — et quand le geste se passe
  dans Chrome (cliquer l'icône de l'extension), une page web ne peut pas
  l'ouvrir : **aucun** bouton principal plutôt qu'un qui envoie ailleurs.
- ⚠️ **« Pas su » ne vaut ni oui ni non** : une extension présente qui ne répond
  pas ne s'accuse de rien — on dit qu'on n'a **pas pu demander**.
- Le banc rejoue le **vrai dialogue du pont** (`postMessage` `ready` /
  `authEtat`) : c'est la seule façon de rendre les cinq états sans Chrome.
  **36 contrôles** au total, **6 rouges** de plus sur le build d'il y a une heure.

### ⚠️⚠️ « CE N'EST PAS NATUREL » — L'ACCUEIL ÉTAIT UNE NOTICE DE MONTAGE
Julien, 16 septembre, en regardant le premier écran : « bien mais pas encore
parfait, **ce n'est pas naturel** ». Il avait raison, et c'est §2.7 mot pour
mot : quatre étapes numérotées d'un coup, « dézippe », « Mode développeur »,
« extension non empaquetée » — du vocabulaire d'informaticien sur la toute
première page, à quelqu'un qui n'en est pas un.
⇒ **UNE seule étape à la fois**, en gros et en français ; les autres restent
visibles **en sourdine** (on veut savoir ce qui reste, pas tout lire). Une barre
de progression à trois segments, et l'écran **avance tout seul** — le pont
prévient dès que l'extension répond, et **on le dit** : c'est ça qui fait qu'on
se sent accompagné plutôt que mis au travail. Quatre étapes sont devenues
**trois** : télécharger et installer, c'est UN geste vu de l'utilisateur.
- **Le prénom se demande à l'inscription**, pas dans Réglages : c'est la
  question la plus naturelle du monde à ce moment-là, et personne ne va la
  chercher dans un écran de réglages. **Facultatif** — un champ obligatoire de
  plus pour un bonjour serait un péage. Même réglage `vrm_prenom` que le champ
  de Réglages (§11).
- ⚠️⚠️ **IL Y AVAIT DEUX ONBOARDINGS, ET ILS NE DISAIENT PAS LA MÊME CHOSE.**
  Le tableau de bord récitait « 3 étapes » — **sans lien de téléchargement**,
  en nommant « Shop Cancale35 – Vinted Sync » (**la boutique de quelqu'un
  d'autre**, pour un nouveau venu), et **sans l'étape qui sépare les vendeurs**
  (se connecter à l'extension avec le même email). Ma journée en disait quatre,
  mesurées. Deux écrans, deux consignes, sur les deux premières pages. §11.
  ⇒ `PremiersPas` porte la règle, les deux écrans la **rendent**. Le banc exige
  que **les trois gestes soient nommés sur les DEUX** — chacun identifié par ce
  qu'il DÉSIGNE (une adresse, une notion, un domaine), jamais par sa phrase.
- ⚠️⚠️ **ET LE TABLEAU DE BORD FÊTAIT « ✅ Tout est à jour » JUSTE SOUS LA CARTE
  QUI VENAIT D'EXPLIQUER QUE RIEN N'ÉTAIT BRANCHÉ** — un écran qui se contredit
  à deux centimètres d'écart. C'est le **troisième** « tout est à jour » du même
  écran (§ « ce banc ne rendait que les 4 écrans »), et le premier vu sur une
  installation neuve. La carte du dessus dit déjà quoi faire : ici on se tait
  (§7, une cause une phrase).
  ⇒ « c'est son premier jour » est UNE notion : elle est décidée **dans la
  coque** (`premierJour`) et consommée par les trois écrans.
- ⚠️ **Leboncoin fêtait « Tout est publié 🎉 (toutes tes paires numérotées en
  ligne sont sur Leboncoin) » sur une base à ZÉRO annonce.** Troisième cause
  d'une file vide, après « lecture ratée » et « tout décoché » : *il n'y a
  encore rien*. Une cause connue se dit. Quatrième cause au passage : des
  annonces en ligne mais **aucune numérotée**.
- ⚠️ **« Réception des emails · 3 transporteurs silencieux »**, en ambre, avec
  trois « aucun email reçu » en ROUGE — à quelqu'un qui vient de créer son
  compte. Rien ne se tait : **rien n'a commencé**. Trois états, jamais deux —
  et une fausse alerte est ce qui fait cesser de lire les vraies.
  ⚠️ **§4.6 PAYÉ CASH, ENCORE** : posé après `detail` (un élément JSX construit
  IMMÉDIATEMENT), `aucunEmailDeSuivi` a tué l'écran Achats sur « Cannot access
  before initialization ». **C'est le RENDU qui l'a vu**, pas le build.
- ⚠️ **VINGT-TROISIÈME fois qu'un de mes contrôles crie au loup**, et quatre
  d'un coup : ils cherchaient les PHRASES d'avant (« pas connectée à ton
  compte », « AUTRE compte », « n'a pas répondu »). Les états étaient tous
  corrects — seul le texte avait changé, et il devait changer, c'était la
  demande. ⇒ **La carte PORTE l'état décidé** (`data-etape`) et le banc juge
  **l'état et ses conséquences** (quel bouton, quelles adresses nommées) ; le
  texte reste libre. C'est la seule forme qui survive à une réécriture.
- ⚠️ **Et le banc MOURAIT sur un port déjà pris** (EADDRINUSE) au lieu de
  rapporter — septième fois. Il dit maintenant « le port est pris, relance-le
  seul ».
- **10 rouges** sur le build d'il y a une heure, 0 après.

### ⚠️⚠️ LES ÉTAPES DU DÉPÔT LEBONCOIN NE POUVAIENT PAS ÊTRE ENREGISTRÉES
Le dossier dit depuis deux passes : « *l'extension enregistre désormais chaque
étape distincte (`lbc_recon.etapes`)… un seul dépôt fait à la main suffit à me
donner la carte complète* ». **Mesuré le 16 septembre, et c'était une promesse
qu'aucun code ne pouvait tenir.**
`captureDepositForm()` ne tourne que dans `load()` — au démarrage, au retour sur
l'onglet, et **quand `location.href` CHANGE**. Or le dépôt Leboncoin est un
**assistant** : il remplace l'étape **sur place**, sans toucher à l'adresse. Les
étapes 2, 3, 4… étaient donc **invisibles** — exactement ce pour quoi ce code
existe. Les deux moitiés étaient là (`lbc.js` envoie `etape`, le fond range par
signature) ; c'est le **déclencheur** qui regardait la mauvaise chose.
⇒ On observe le **FORMULAIRE**, pas l'URL (`MutationObserver`, une capture par
seconde au plus, **12 étapes** au maximum, et uniquement sur une page de dépôt).
La signature dédoublonne déjà : réobserver ne coûte rien, **manquer une étape**
coûte la carte entière.
- ⚠️ **C'est une chance UNIQUE** : `lbc_recon.etapes` est absente de sa base. Le
  jour où il fait un dépôt à la main avec une extension à jour, soit
  l'enregistreur marche et j'ai enfin où vivent la catégorie, l'état et le champ
  photo — soit il ne marche pas, et on ne le saura qu'après. §4.10 : **ce code
  n'avait jamais tourné**.
- Le banc simule l'étape suivante **sans changer d'adresse** et exige : deux
  étapes enregistrées, **deux signatures distinctes** (la suivante n'écrase pas
  la précédente), et que l'étape rapporte **les listes déroulantes ET le champ
  photo**. **2 rouges** sur le code d'avant — dont « 0 liste, 0 champ fichier ».
- ⚠️ **Et la promesse de confidentialité n'avait jamais été vérifiée** : le code
  dit « noms de champs et libellés d'options uniquement, **aucun contenu
  saisi** ». Le banc tape une valeur dans un champ et exige qu'elle **ne parte
  pas** avec la structure.
- **Mesuré au passage, et ce n'était PAS un défaut** : le libellé de la page de
  dépôt a changé (« Que proposez-vous aujourd'hui ? » → « **Quel est le titre de
  l'annonce ?** », relevé du 13 septembre dans `lbc_recon.form`). `findField`
  cherche aussi `subject` et `titre` : le titre se remplit toujours. *Avant de
  « corriger », vérifier que c'est cassé.*
- Extension en **5.66.0**, zip régénéré, `EXT_ATTENDUE` suivie.

### ⚠️⚠️ « DÈS QUE J'APPUIE SUR UN BOUTON DANS VINTED, J'AI "OFFRE À TRANCHER" »
Plainte de Julien, 16 septembre. **Cause mesurée, et elle est nette** : dans
`nouveautes()`, les **ventes** et les **messages** sont comparés au mémo du
dernier récap ; les **OFFRES ne l'étaient pas**. `out.offres` valait le nombre
d'offres **EN ATTENTE**, pas le nombre de **nouvelles** — donc tant qu'il lui
restait une offre non tranchée, `rien` était faux **pour toujours**, et la
fenêtre **plein écran** (`position:fixed;inset:0`, fond assombri) revenait à
chaque cycle de capture. Vinted est une SPA : chaque bouton en relance un.
⇒ Une offre a une identité — **`offer_request_id`**. On compte celles qu'on n'a
pas encore montrées, exactement comme les ventes. Une VRAIE nouvelle offre
mérite encore d'interrompre (de l'argent, 24 h pour répondre) ; une offre déjà
vue, non.
- ⚠️ **Le libellé suit la donnée** : « 1 **nouvelle** offre à trancher ». Sinon
  on lit « 3 offres » dans la fenêtre et on en trouve 12 dans le panneau.
- ⚠️ **Première visite** : elles sont toutes « nouvelles ». On les remet à zéro
  comme les ventes et les messages — « 17 offres à trancher » d'un coup, c'est
  le « 320 ventes ! » qu'on évite juste à côté.

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

### ⚠️⚠️ ET SUR SON IPHONE, L'ACCUEIL DEMANDAIT L'IMPOSSIBLE
Mesuré au rendu à **390 px avec `isMobile + hasTouch`**, juste après la passe
« naturel » : la carte des premiers pas déroulait quand même « va sur
`chrome://extensions` », « allume Mode développeur », « Charger l'extension non
empaquetée » — **et proposait de TÉLÉCHARGER un zip sur un téléphone**, où il
ne sert à rien. La seule ligne vraie (« fais-le une fois sur un ordinateur »)
était en tout petit, tout en bas, sous la barre de navigation.
C'est l'écran que Julien ouvre le plus souvent, et c'est du travail impossible.
⇒ **On ne devine PAS « c'est un téléphone » : on mesure l'ENTRÉE.**
`useSansSouris()` = `(pointer: coarse)` **ET** `(hover: none)` — aucune souris du
tout. C'est vrai des téléphones comme des tablettes, et ça reste vrai le jour
où la marque change ; un portable tactile, lui, déclare `pointer: fine` et **rien
ne change pour lui**. Vérifié dans le Chromium du banc : `coarse/nohover` valent
`true/true` en mobile et `false/false` en bureau.
⇒ Dans ce cas, **aucune marche à suivre Chrome, aucun bouton de téléchargement**,
et on dit **où** ça se passe (« ouvre vrm.center dans le Chrome de ton
ordinateur — tu y retrouveras exactement cet écran »). Un `matchMedia` qui lève
rend `false` : « pas su » garde le comportement d'avant.
- ⚠️ **Le banc vérifie L'AUTRE SENS** : *tout retirer partout* passerait le
  contrôle. Sur ordinateur, la marche à suivre **et** le zip doivent rester.
- ⚠️ **Et « Taux marge 0% » sur le premier tableau de bord** : sans aucune
  vente, c'est **0 ÷ 0** — un chiffre fabriqué présenté comme un fait. §7 : un
  zéro qui veut dire « on ne sait pas » s'écrit `—`, avec la raison (« dès ta
  première vente »).
  ⚠️ **VINGT-QUATRIÈME cri au loup, attrapé avant de partir** : mon premier jet
  interdisait « 0% » sur **toute la page** — il attrapait « Remplissage garage
  0% », qui est une **vraie** mesure (rien n'est rangé). On juge la carte
  concernée, pas la page.
- **3 rouges** de plus sur le build d'il y a une heure ; `premierjour.cjs` est à
  **48 contrôles**.

### ⚠️⚠️ ET LA FENÊTRE DE L'EXTENSION NE DISAIT PAS QUEL MOT DE PASSE ELLE VOULAIT
C'est **l'étape qui sépare les vendeurs** : si quelqu'un se trompe de compte,
ses captures partent dans la boutique d'un autre. Or on arrive dans cette
fenêtre **juste après avoir été sur Vinted**, on lit « Email / Mot de passe »…
et on tape son mot de passe **Vinted**. Ça échoue — et on vient de le saisir
dans une fenêtre qui n'en a aucun besoin.
L'app le disait bien dans sa carte des premiers pas (« avec le même email que
sur VRM ») ; **la surface où le geste SE FAIT, elle, se taisait** — §11, sur la
seule étape où une erreur mélange deux boutiques.
⇒ La fenêtre nomme le compte (« ton compte **VRM**, le même que sur
vrm.center »), dit **ce que ce n'est pas** (« pas ton mot de passe Vinted,
l'extension n'en a jamais besoin »), met ça **dans les placeholders** — c'est
eux qu'on lit en tapant, pas le paragraphe — et offre un lien pour créer le
compte si on n'en a pas.
- ⚠️ **`popup.js` n'avait JAMAIS tourné** — §4.10, comme `lbc.js` et `ebay.js`
  avant lui. `scripts/bancs/popup.cjs` la charge dans une vraie page avec un
  faux `chrome.runtime` : **11 contrôles, 3 rouges** sur le code d'avant.
- Il vérifie les **trois états** de la fenêtre : pas connecté · connecté (elle
  **nomme** le compte — c'est ce qui permet de voir qu'on s'est trompé) ·
  **session expirée**, qui n'est pas « pas de compte » et n'appelle pas la même
  consigne.
- Extension en **5.64.0**, zip régénéré, `EXT_ATTENDUE` suivie. Aucune entrée
  d'`EXT_CAPACITES` : l'app ne promet rien de neuf.

### ⚠️⚠️ LA PORTE D'ENTRÉE PROMETTAIT UNE PROTECTION QU'ELLE N'AVAIT PAS MESURÉE
Même passe, même écran d'accueil — mais **avant** la connexion. La dernière
phrase que lit quelqu'un juste avant de confier ses jetons Vinted disait :
> « Chaque vendeur ne voit que ses propres données.
> **L'isolation est appliquée par la base, pas par l'application.** »

Elle s'affichait dès que **`CLOISONNE`** était vrai — et `CLOISONNE` mesure une
seule chose : **la colonne `owner` EXISTE**. Or la migration autorise
explicitement de s'arrêter là (« *garde RLS désactivé, n'applique que l'étape
1* »). Dans cet état la porte promettait l'isolation pendant que le panneau de
Réglages disait, **sur la même base**, « la clé publique permet encore de tout
écrire et effacer ». **Deux verdicts sur une notion (§11)** — et le faux était
celui qu'une nouvelle personne lit en premier.
⇒ La porte **mesure** : `sondeLectureSansCompte()` (une lecture, zéro écriture,
§2.3) rend **trois états** — encore lisible · fermée · **pas su**. On n'affirme
rien tant qu'on ne sait pas, et on n'accuse pas non plus.
⇒ **La règle est extraite et PARTAGÉE** : le panneau de sécurité la consomme au
lieu de la réécrire. Une seule des deux corrigée, et les deux écrans divergent
de nouveau.
- ⚠️ **VINGT-DEUXIÈME fois qu'un de mes contrôles crie au loup**, et c'est la
  récidive exacte de `sbGetTout` : `audit-chiffres.cjs` exigeait le mot `null`
  **dans l'expression** de la sonde. Devenue un appel de fonction partagée, la
  règle était **mieux tenue qu'avant** et l'audit tombait au rouge. Il suit
  maintenant l'expression **jusqu'à sa définition** — et il reste rouge quand on
  réaffaiblit la fonction (prouvé).
- Le banc couvre les **trois** états, y compris « sonde muette : aucune promesse
  **et** aucune accusation ». Sur le build d'avant, c'est la sonde muette qui
  échouait aussi : elle promettait l'isolation sans avoir rien pu mesurer.

### ⚠️⚠️ « TOUT PARAMÉTRÉ POUR L'ANNONCE » — LES CODES ARRIVAIENT COUPÉS À 9 000
Demande de Julien, 17 septembre : « qu'elle puisse publier, donc mettre le titre,
la description, les catégories au bon endroit, le prix, en gros tout paramétré
pour l'annonce ».

**Mesuré d'abord, et c'est ce qui bloquait.** Mettre une catégorie au bon endroit
suppose de connaître le **CODE** que Leboncoin attend (`{value,label}`), pas son
libellé. Ces codes passent par **deux** endpoints, tous deux **VUS** dans son
navigateur (`lbc_recon.paths`) : `api/frontend/v1/data/v7/fdata` (le dictionnaire
des attributs — mesuré :
`features.accessories_brand.values.simpleData[{value,label}]`) et
`api/frontend/v1/data/v5/fforms` (les formulaires par catégorie).
Or `lbc_recon.samples` n'a que **six places, prises en ordre d'arrivée** :

| réponse gardée | taille |
|---|---|
| `api.leboncoin.fr/…/v7/fdata` | **9 000** ← coupé |
| `/_next/data/…/nouveautes.json` · `/_next/data/…/my-searches.json` | 9 000 |
| `fast.nexx360.io/booster` · `ib.adnxs.com/openrtb2/prebidjs` · `hbopenbid.pubmatic.com/translator` | 9 000 · 9 000 · 7 119 |

**Trois sur six ne sont pas Leboncoin** : des enchères publicitaires. Elles
passent `AD_HINT` parce qu'une créative porte une adresse en `/ads` (mesuré :
c'est le seul mot qui matche, et il est **au-delà du 9 000ᵉ caractère**), et
elles évincent les seules réponses qui servent. `fforms` n'a **jamais** eu
d'échantillon.
⇒ On n'échantillonne plus que **leboncoin.fr** ; le catalogue a sa **propre
ligne** (`lbc_catalogue`), **une place par endpoint**, gardé **entier**, et il
**DIT s'il a été coupé** — la moitié d'un catalogue a l'air d'un catalogue.
⚠️ **ON N'ANALYSE RIEN POUR L'INSTANT** : 9 000 caractères de `fdata`, zéro de
`fforms`. Écrire l'analyseur aujourd'hui serait deviner. On collecte, la
prochaine passe branche — même méthode que `panel_ebay_form`.
⚠️ **Et `lbc_recon.etapes` est TOUJOURS absente** (dernière visite Leboncoin :
13 septembre, extension d'alors trop ancienne). **Le clic « Publier » ne
s'écrit pas avant d'avoir la carte des étapes** — ça n'a pas bougé.

- ⚠️⚠️ **TROIS LIRE-FUSIONNER-RÉÉCRIRE DE PLUS EFFAÇAIENT LEUR LIGNE.**
  `audit-fusion.cjs` listait les onze du panneau Vinted et s'arrêtait là :
  `storeLbcRecon`, `storeLbcListings` et `storeLbcAccount` écrivaient toutes les
  trois `(rows && rows[0] && rows[0].data) || {}`. Prouvé : `lbc_recon` repartait
  avec **`form:PERDU · etapes:PERDUES`** — c'est-à-dire **la carte du formulaire
  de dépôt**, celle qu'un seul dépôt fait à la main doit remplir. Un timeout
  pendant ce dépôt-là, et il faut le refaire. **3 rouges** sur le code d'avant.
  *Un banc qui énumère à la main ne couvre que ce qu'on a pensé à écrire.*
- §4.4 : `lbc_recon` pèse **67 Ko** et le panneau n'en veut qu'**une** valeur —
  **67 Ko / 725 ms** en entier, **16 octets / 165 ms** projetée, à chaque
  ouverture sur leboncoin.fr.
- `scripts/audit-lbc-catalogue.cjs` exécute le vrai `lbc-inject.js` dans un vrai
  navigateur **et** le vrai `background.js` dans un `vm` : **12 contrôles,
  9 rouges** sur le code d'avant.
  ⚠️ **MON PREMIER JET ÉTAIT VERT SUR LE DÉFAUT** : je servais un corps
  d'enchère **inventé**, qui ne contenait aucun des mots du filtre — il n'était
  donc pas relayé, et le contrôle passait. La forme servie vient maintenant de
  la **vraie ligne** (§6.3, sur le CONTENU cette fois, pas sur la projection).
  ⚠️ Et §6.6 payé cash dans le même banc : **Playwright prend la DERNIÈRE route
  enregistrée en premier** — le fourre-tout `**` avalait la route précise
  `/api/**` et servait du HTML, que `handle` écarte à raison ; le contrôle
  « l'autre sens » sortait rouge sur un code intact.

### ⚠️⚠️ « UNE RELANCE AUX FAVORIS » — 1 240 PERSONNES, ZÉRO ADRESSE ; ET 57 QUI EN ONT UNE
Deuxième moitié de sa demande du 17 septembre : « envoyer aux personnes sur
Vinted qui ont mis l'article en favori une petite relance pour qu'ils achètent ».

**Remesuré** (§3 dit non, mais ce non repose sur une MESURE, et une mesure se
refait — c'est ce qui a fait tomber le refus des offres automatiques) : sur ses
**481 annonces captées**, **105 portent au moins un favori, 1 240 favoris en
tout**, et les seuls champs qui nomment quelqu'un sont `user`/`user_id` (LUI, le
vendeur), `is_favourite` (est-ce que LUI a mis en favori) et `favourite_count` —
**un nombre**. ⇒ **Le refus tient toujours** : mille deux cent quarante
personnes, aucune adresse. L'onglet Favoris reste le bon canal (la remise
**native** de Vinted, qui les touche tous en un clic).

⚠️⚠️ **MAIS UN AUTRE GROUPE EST NOMMÉ, ET PERSONNE NE L'AVAIT CHERCHÉ.** Sur ses
**988 conversations captées** : **669 portent un `opposite_user`** (id **et**
login) et **661 un `transaction.item_id`** — la personne **et** la paire dont
elle a parlé, par **IDENTITÉ** (§5), jamais par ressemblance de titre. En ne
gardant que les paires **encore en ligne** dont l'échange n'a **jamais abouti**,
et en laissant de côté celles qui portent une offre en attente (elles ont déjà
leur place dans l'onglet Offres, §7) : **57 personnes sur 26 paires** — dont
**13 sur la seule « salomon XT-6 blanc taille 40 » à 99 €**. Vinted autorise la
réponse sur toutes (`allow_reply` : 0 refus).
⇒ Onglet **Relances** dans le panneau, groupé **par paire**, chaque personne
nommée avec **sa** conversation et le message prêt (remise calculée par
`montantRemise` — **la même règle** que l'onglet Favoris, §11).
- ⚠️ **RIEN NE PART TOUT SEUL, et ce n'est pas une prudence de façade** :
  soixante messages envoyés par un programme, c'est le signal de robot qui a
  fait bloquer `vanessa5723` (§3). Le clic **ouvre** la conversation et copie le
  texte ; c'est lui qui écrit et qui envoie. Même forme que l'assistant
  Leboncoin.
- **Une seule lecture pour deux usages** : les relances se calculent sur les
  **mêmes** `convRows` que les offres, avec deux champs de plus dans la
  projection (`opplogin`, `is_completed`).
- `scripts/audit-relances.cjs` : **11 contrôles, 9 rouges** sur le build
  d'avant. Il exige qu'**aucun** message ne parte, que chaque personne soit
  **NOMMÉE** (⚠️ l'autre sens : *tout retirer* passerait les contrôles
  d'envoi), et que les **trois** causes d'une liste vide donnent **trois**
  phrases différentes.
  ⚠️ **« Copié » ne s'écrit que si la copie a eu lieu** — prouvé en
  **réaffaiblissant** `copier` à la forme naïve `try { writeText } catch`, qui
  repasse au **rouge** : une promesse rejetée ne passe pas par `catch`. C'est la
  seule preuve qui vaille (« la fonction n'existait pas avant » n'en est pas
  une).
- ⚠️ **HUITIÈME FOIS QU'UN DE MES AUDITS MEURT AU LIEU DE RAPPORTER** : sur le
  code d'avant le bouton n'existe pas, et `.click()` sur `null` tuait le
  processus **avant le bilan**. Tout bloc passe par `essaie()`.
- ⚠️⚠️ **ET MON REMPLACEMENT DE PROJECTION AVAIT VISÉ LE MAUVAIS SITE D'APPEL** :
  une **autre** fonction portait la même sous-chaîne, et c'est elle qui a été
  modifiée. `opplogin` valait `''`, les relances sortaient à **0** — alors que
  la paire, elle, était trouvée **60 fois**. Aucun audit ne l'a vu ; c'est
  l'**exécution sur la vraie base** qui l'a attrapée. *Un remplacement par
  sous-chaîne se vérifie sur le site qu'on visait, pas sur le premier qui
  matche* — cousin de §4.11.

### ⚠️⚠️⚠️ LE DÉPÔT A ÉTÉ FAIT, ET `storeLbcRecon` JETAIT L'ÉTAPE EN SILENCE
Julien a fait son dépôt Leboncoin à la main le 17 septembre. **Mesuré tout de
suite** : `lbc_recon.form` écrit à **12:18:55 avec 3 champs** — donc
`captureDepositForm` a bel et bien tourné et le handler a bel et bien construit
`etapes` — et **`etapes` toujours absente de la base**.
Cause : `storeLbcRecon` rangeait **clé par clé** (`paths`, `sample`, `quota`,
`form`, `url`) et n'avait **aucune ligne** pour `patch.etapes` ni
`patch.capture`. Les deux moitiés existaient, le raccord manquait — le motif du
tiroir `Nav` (§4.11), sur la donnée attendue depuis trois passes. **Il a fait ce
dépôt pour rien, et c'était de mon fait.**
⚠️ Et ça **réécrit l'histoire de `lbcDiag`** : §8 disait « il n'a jamais tourné » ;
en réalité c'est son **rangement** qui le jetait. *Avant de conclure qu'un code
n'a jamais tourné, vérifier que ce qu'il produit est bien RANGÉ.*
⇒ On ne range plus clé par clé : tout ce qu'un appelant envoie est gardé.
⚠️⚠️ **ET AUCUN BANC NE POUVAIT LE VOIR** : `bancs/leboncoin.cjs` vérifie ce que
`lbc.js` **ENVOIE** (`window.__formes`) — il s'arrête à la frontière. Le
rangement, personne ne le mesurait. *Un contrôle qui s'arrête au message prouve
le message, jamais la donnée.* `audit-lbc-catalogue.cjs` va jusqu'à
l'**ÉCRITURE** et porte la règle sur **toutes** les clés : sur le code d'avant
il nomme les deux perdues, « etapes, capture ».

### ⚠️⚠️ ET LE SECOND DÉPÔT A ENREGISTRÉ TROIS ÉTAPES DE BRUIT
Rangement réparé, il refait le dépôt. **Mesuré** : 3 étapes, même dépôt, ordre et
horodatage corrects — et **aucune n'est le formulaire du milieu** :
- étape 1 : `/deposer-une-annonce`, **1 champ** (`subject`), 0 liste ;
- étapes 2 et 3 : `/deposer-une-annonce/**confirmation**` — la page de FIN — avec
  `high-contrast-toggle`, `search-header-mobile-input`,
  `search-header-extendable-input` et une volée de champs **cachés**
  (`id, ev, dl, rl, if, ts, iw, sw, sh, v, r`, du pistage). Les **quatre
  « listes »** étaient la **barre de recherche** de l'en-tête (« Valider votre
  recherche »).
**1 min 44 s** séparent l'étape 1 de l'étape 2 : l'observateur a tourné pendant
tout le dépôt, et le bruit a consommé les places pendant que la catégorie, les
photos et le prix passaient.
⇒ `estDuDepot` écarte l'en-tête, le pied, la zone de recherche, les `type=hidden`
et ce qui n'a aucune surface — c'est la garde `DANS_ENTETE` d'`ebay.js`, qu'il
fallait ici aussi. La page de **confirmation** n'est plus une étape. Plafond
porté à 24.
⚠️ **Et chaque étape porte désormais la VERSION de l'extension qui l'a écrite** :
sans elle je dois DEVINER si une étape manquante vient d'un défaut ou d'une
version trop ancienne — ce que le dossier interdit explicitement (§8). Trois
étapes, et aucun moyen de savoir laquelle des versions tournait.
- Le banc sert **le bruit réel mesuré** (cet en-tête-là, ces champs cachés-là) :
  sans lui il restait **vert sur le défaut**. **5 rouges** sur le code d'avant,
  qui reproduisent mot pour mot ce qu'il y avait dans sa base.
- ⚠️ §6.3 dans mon propre banc, encore : son faux `chrome.runtime` n'avait pas
  `getManifest`, donc le contrôle de version sortait rouge sur un code intact.

### ⚠️ ET LE CATALOGUE EST PLUS GROS QUE MON PLAFOND
Bonne nouvelle de la même mesure : **`lbc_catalogue` EXISTE**, écrite par la
nouvelle extension. Mais `fdata` est arrivé **coupé à 400 000** — le drapeau
`coupe` a fait son travail. Plafond porté à **3 000 000** ; la ligne n'est
réécrite que si le corps change, donc ça ne coûte qu'une fois. `fforms` n'est
toujours pas arrivé.

### ⚠️⚠️⚠️ « QU'ELLE RÉPONDE À MA PLACE AUX MESSAGES » — ET 2 SUR 5 N'ÉTAIENT PAS DES ACHETEURS
Demande de Julien, 18 septembre : « je veux également que tu puisses répondre à
ma place au message Vinted ». Mis devant le risque, il a tranché : **« Tout, elle
répond à tout »**. C'est SA décision, elle n'est pas à re-négocier.

**MESURÉ AVANT DE BRANCHER QUOI QUE CE SOIT**, sur ses **32 conversations non
lues** du 19 septembre :

| ce qu'elles sont | combien |
|---|---|
| aucune conversation captée (rien à lire) | **17** |
| captée, mais aucun message de l'acheteur dedans | **9** |
| `allow_reply: false` — Vinted refuse la réponse | **1** |
| ⚠️ un échange où c'est **LUI l'acheteur** | **1** |
| une vraie question posée sur une de SES annonces | **3** |

⚠️⚠️ **LE DÉFAUT QUE LA MESURE A ÉVITÉ.** « Conversation non lue = un acheteur qui
demande » est une **RESSEMBLANCE** (§5), et elle se trompait **2 fois sur 5** des
conversations lisibles : « *Trainers are in post, thanks for buying* » et
« *juste pour vous dire que j'envoie demain, le colis est prêt* » sont des
**vendeurs qui LUI expédient**. Or `api/ai` répond en VENDEUR (sa consigne dit
mot pour mot « on te donne le message d'un ACHETEUR ») : elle aurait envoyé, **en
son nom**, une réponse à côté de la plaque à quelqu'un qui lui poste un colis.
⇒ L'identité est l'**ARTICLE** : `transaction.item_id` ∈ ses annonces captées
(`sesAnnonces`). Mesuré : les 3 vraies questions passent, les 2 conversations où
il achète sont écartées, **0 erreur**.
⚠️ **Deux autres pistes essayées et ÉCARTÉES, mesurées** : `transaction.user_side`
est **`null` sur les 1 030 conversations** captées ; et l'identifiant de
participant déduit de `harvest_*_txn_*` ne marche pas — ces lignes portent AUSSI
ses **achats**, donc `seller_id` y varie (162 fois l'un, une fois chacun des
autres) : le prendre « le plus fréquent » serait un rapprochement par
**fréquence**. Ancré sur l'article il n'apportait d'ailleurs **rien** (0
conversation de plus). *Chercher l'identité, pas aménager la ressemblance.*

**Les garde-fous, qui sont ANTI-BLOCAGE et pas des scrupules** (§3 : `vanessa5723`
a été bloqué, neuf comptes sont son gagne-pain) : éteint par défaut
(`vinted_repond_auto`), uniquement le compte de l'onglet (`garde`), **3 réponses
par visite**, plafond horaire, une requête à la fois, et **jamais deux fois le
même message** — l'identité est l'`id` du message de l'acheteur, jamais son texte
ni sa date. Rien sous **55 de confiance** de l'IA, rien sur une réponse vide,
rien si l'IA est injoignable : *mieux vaut un blanc qu'un faux*, et un silence
d'une heure coûte moins qu'une phrase inventée sur un prix.

⚠️⚠️ **ET « ELLE RÉPOND À TOUT » NE DOIT PAS S'AFFICHER COMME UN FAIT.** 3 sur 32,
c'est le chiffre d'aujourd'hui : un total partiel présenté comme complet est pire
qu'un total absent (§5). L'extension **publie son bilan**
(`panel_msg_repondus.bilan` — une clé réservée, jamais confondue avec un envoi) et
le panneau de Réglages écrit **les deux nombres** et **les causes** (« 1 où c'est
toi qui achètes », « 17 dont l'extension n'a pas encore lu l'échange »…). Une
cause à **zéro** n'est pas écrite — ce serait du bruit permanent.
- **Il peut relire ce qui est parti en son nom** : le texte exact, la personne
  nommée, la paire. Un message envoyé à sa place qu'il ne peut pas relire serait
  le pire de tout — « un colis caché est un colis perdu » appliqué à ce qu'on dit
  à ses acheteurs.
- ⚠️ **« Pas su » ne vaut pas « allumé », et ne vaut pas « il est le vendeur »** :
  réglage non lu, annonces non lues, mémo des réponses non lu ⇒ **rien ne part**.
  Trois lectures, trois refus — le banc sert chacune en 522 séparément (lecture
  KO, écriture OK : le cas dangereux, jamais la panne totale).
- `convDernierMessageId(uid, cid)` lit la ligne **du compte** (`id=eq.`, vérifié :
  une conversation est toujours captée sous le compte de sa boîte) et rend
  `itemId` + `allowReply` — et rend son objet **même sans message lisible**, pour
  que le bilan distingue « pas captée » de « captée mais vide » : deux causes,
  deux phrases.
- `scripts/audit-repondre.cjs` **EXÉCUTE** le vrai `background.js` dans un `vm` et
  compte ce qui part chez Vinted : **30 contrôles**. Prouvé en **réaffaiblissant**
  la règle (identité du vendeur retirée, refus de Vinted ignoré) → **5 rouges**,
  dont « aucune réponse à quelqu'un qui LUI vend — envois=1 ». *« La fonction
  n'existait pas avant » n'est pas une preuve.*
- `scripts/bancs/repondre.cjs` rend le panneau dans **quatre** états et exige que
  le texte **suive la donnée** (deux jeux de chiffres, deux rendus différents —
  un texte figé passerait sinon). **7 rouges** sur un rendu réaffaibli à « Elle
  répond à tout ».
- `EXT_CAPACITES.repond = '5.77.0'`, extension en **5.77.0**, zip régénéré,
  `EXT_ATTENDUE` suivie. ⚠️ **Mesuré le 19 septembre : `panel_diag_capture.ver`
  est ABSENT** alors que `majAt` est de l'heure — son extension est donc encore
  antérieure à la 5.63. Tant qu'il ne l'a pas remplacée, **rien ne partira**, et
  l'app le dit (`extSait('repond') === 'retard'`).

### ⚠️⚠️ « LE BOUTON TÉLÉCHARGER MES DONNÉES ME RENVOIE SUR "COMPTE BLOQUÉ" »
Demande de Julien, 19 septembre : son **compte pro Vinted est bloqué**, il a
besoin de l'export de ses données pour le récupérer, et le bouton des réglages
le renvoie sur la page « ton compte est bloqué ». Il a une **session** — c'est
l'interface qui refuse, pas la connexion.

⚠️ **CE QU'IL NE FAUT PAS FAIRE, ET LA RAISON EST UNE MESURE.** Sur les
**41 chemins d'API** que son extension a observés en tout (`harvest_*_seen_urls`,
11 lignes), **aucun** ne concerne un export. Cet endpoint n'a **jamais été vu**.
Écrire un appel vers une adresse devinée est exactement ce que ce dossier
interdit partout — et ici ça partirait depuis la session d'un compte **déjà
bloqué**, c'est-à-dire au pire endroit possible : du trafic inhabituel sur ce
compte-là est ce qui transforme un blocage contestable en blocage définitif.
⇒ **C'est son navigateur qui mesure et qui rapporte** — la méthode du formulaire
eBay et des étapes Leboncoin : *faire mesurer par ce qui y a accès.*

⚠️⚠️ **ET LA MESURE QUI MANQUAIT EST LE STATUT.** Deux situations
**indistinguables** de l'extérieur, et qui n'appellent pas du tout le même geste :
- la requête d'export **part** et le serveur la refuse (**403**) ⇒ aucun
  contournement côté navigateur ne servira jamais, la voie écrite est la seule ;
- la requête **ne part pas** parce que c'est seulement la page qui redirige ⇒ la
  donnée est peut-être atteignable.

Le mouchard notait le **chemin** et **pas le statut** ; et il ignorait tout ce
qui n'est pas `/api/`, donc une page de réglages ne laissait **aucune trace**.
⇒ `noteSeen(url, method, status)` relève `MÉTHODE chemin → statut` (dernier
statut vu + combien de fois : « 403 une fois » et « 403 à chaque essai » ne se
lisent pas pareil), et note aussi les **pages** qui parlent d'export, de données
ou de compte — pas les autres (§7 vaut aussi pour un diagnostic).
- **La promesse de confidentialité ne bouge pas** : chemin + méthode + statut,
  **jamais** le corps, **jamais** les paramètres d'URL, et les identifiants
  numériques deviennent `{id}`. Le banc tape un corps et une adresse email dans
  la requête et exige qu'ils **ne partent pas**.
- ⚠️⚠️ **ET `storeSeenUrls` ÉCRASAIT LA LIGNE À CHAQUE VISITE.** Une page ne fait
  qu'une poignée d'appels : le passage suivant remplaçait donc tout ce qui avait
  été appris ailleurs. C'est ce qui explique les **41 chemins seulement** sur
  11 comptes alors que chaque visite en voit une dizaine. Pour un diagnostic dont
  le but est d'attraper **UN endpoint vu UNE fois**, écraser était fatal. Il
  fusionne, et **ne réécrit pas sur une lecture ratée** — `audit-fusion.cjs`
  porte le cas (la quinzième ligne de cette famille).
- `scripts/audit-endpoints-vus.cjs` **charge le vrai `inject.js` dans une vraie
  page** (§4.10) et regarde ce qu'il ENVOIE : **13 contrôles**, dont **5 rouges** sur le
  code d'avant — dont « et avec son CODE DE RÉPONSE : `[]` ».
- **Aucune entrée d'`EXT_CAPACITES`** : l'app ne promet rien de neuf, c'est une
  mesure. Extension en **5.78.0**, zip régénéré, `EXT_ATTENDUE` suivie.
- ⚠️ **Ce qu'on détient DÉJÀ du compte bloqué**, mesuré : l'identifiant de
  moisson `3170782324` porte le login **`vanessa5723`** et sa capture s'arrête
  net le **11 août** — 2 annonces (dont une à 49 € encore en ligne), 1 vente,
  4 achats, 10 conversations, un porte-monnaie. **132 Ko que Vinted ne lui montre
  plus**, exportés et envoyés. Ne PAS mettre cet export dans le dépôt : vrais
  acheteurs, vrais messages, dépôt public.
- La voie écrite est prête et ne dépend pas de l'interface :
  `docs/demande-rgpd-vinted.md` (art. 15 · art. 15.1.h · **art. 22.3, droit à
  une intervention humaine** quand un automate a décidé · sommes retenues).
  ⚠️ **Ne pas demander l'effacement** : la CNIL dit que ce n'est pas un droit
  absolu après un blocage, et ça **contredit** une demande de récupération.
  ⚠️ **L'adresse du DPO n'est pas affirmée** : je n'ai pas pu la lire depuis une
  source primaire, le document renvoie donc à la page de la CNIL qui la porte
  (`cnil.fr/fr/cnil-direct/question/1991`). *Mieux vaut un blanc qu'un faux.*

⚠️⚠️⚠️ **IL A CLIQUÉ, ET LE RELEVÉ EST ARRIVÉ VIDE — DEUX DÉFAUTS, TOUS DEUX DE MOI.**
Mesuré dans la minute : `harvest_199082413_seen_urls` écrite par la **5.79.0**,
donc la liste noire ne bloquait bien rien (c'était juste). Mais **0 réponse**, et
les 5 chemins relevés étaient ceux de son **dressing**, pas de la page de
réglages.

1. ⚠️⚠️ **`content.js` RELAYAIT UNE LISTE DE CHAMPS FIXE.** `inject.js` envoyait
   bien `reponses` ; le relais recopiait `kind, type, id, url, method, body,
   csrf, b64, paths` — **et rien d'autre**. La donnée mourait **entre deux
   fichiers qui avaient tous les deux raison**. C'est `storeLbcRecon` (qui
   rangeait clé par clé et perdait `etapes`) **une couche plus tôt**.
   ⇒ Le relais recopie désormais **tout** ce que la page envoie, sauf son
   étiquette ; `from` et `domain` restent posés par NOUS (la page ne les dicte
   pas). *Un raccord qui énumère ne transporte que ce qu'on a pensé à écrire.*
   ⚠️ **ET MON BANC NE POUVAIT PAS LE VOIR** : il lisait le `postMessage` **dans
   la page**. Il prouvait donc que `inject.js` ENVOIE, jamais que ça ARRIVE.
   *Un contrôle qui s'arrête au message prouve le message, jamais la donnée* —
   le dossier l'écrivait déjà pour `storeLbcRecon`, et j'y suis retombé. Le banc
   charge maintenant le **VRAI `content.js`** et juge ce qui en sort.
2. ⚠️⚠️ **LE VIDAGE À 5 s NE LAISSE AUCUNE CHANCE À UNE PAGE QUI REBONDIT.** Il
   clique, Vinted le renvoie **aussitôt** sur « compte bloqué » : la page est
   déchargée bien avant les 5 s, et `pagehide` ne sauve rien (un `sendMessage`
   depuis une page qui se décharge part rarement). C'est **exactement** le cas
   qu'on cherche à mesurer, et c'était le seul qu'on ne pouvait pas voir.
   ⇒ Ce qui est intéressant part **sur-le-champ** : tout appel qui **échoue**
   (≥ 400) ou tout appel sur un chemin de compte/export déclenche le vidage
   immédiatement.
- `audit-endpoints-vus.cjs` est à **18 contrôles**, et les deux nouveaux défauts
  sortent **7 rouges** sur la 5.79.0 — dont « les codes de réponse survivent au
  relais : `[]` » et « rien relayé après 800 ms ».
- ⚠️ **Le même motif dort dans `lbc.js`** : son relais énumère aussi, kind par
  kind. Complet aujourd'hui, mais c'est la même fragilité — à recopier en entier
  le jour où on y touche.
- Extension en **5.80.0**, zip régénéré, `EXT_ATTENDUE` suivie.

⚠️⚠️ **ET C'EST LUI QUI A VU LE TROU : « le compte shop cancale devait être
ignoré par l'extension ».** Il avait raison de demander — `shop_cancale`
(uid **199082413**) est dans `vrm_blocked_accounts`, la liste des comptes
supprimés DÉFINITIVEMENT, et c'est elle qui l'empêchait de « revenir tout le
temps ». **Mesuré, en exécutant le vrai `background.js`** : cette liste ne porte
que sur `captureDomain`, c'est-à-dire sur les **JETONS**. Ni `storeSeenUrls` ni
`storeHarvest` ne la consultent — ils ne lisent que le cookie de session
(`activeAccountId`). Donc le relevé partira, et **le compte ne réapparaît pas
dans l'app** : elle lit ses comptes dans la table `vinted_accounts`, jamais dans
`app_data`. Vérifié aussi : `content.js` tourne sur **toutes** les pages Vinted
quel que soit le compte connecté.
- `audit-endpoints-vus.cjs` porte les deux moitiés : le relevé **EST** écrit pour
  un compte de la liste noire, **et aucun jeton ne l'est**. Sans la seconde,
  « faire marcher le diagnostic » pourrait ressusciter le compte — exactement ce
  qu'il ne veut pas. Et sans la première, quelqu'un « compléterait » la liste
  noire un jour en l'étendant au diagnostic, rendant muet le seul compte qu'on
  cherche à documenter.
- ⚠️ **EFFET DE BORD À LUI ANNONCER, PAS À DÉCIDER POUR LUI** : comme
  `storeHarvest` n'est pas filtré non plus, passer sur `shop_cancale` va aussi
  **remoissonner ses annonces, ventes et messages** dans `harvest_199082413_*`.
  C'est une LECTURE sur ses propres données (§3 l'autorise), et ça peut lui
  servir pour récupérer le compte — mais des annonces d'un compte écarté peuvent
  ressortir dans certaines listes, comme le fait déjà l'orphelin `3170782324`.
  *Je n'invente pas une règle de plus sans qu'il ait tranché.*

⚠️⚠️ **ET J'AI DÉTRUIT MON PROPRE TRAVAIL EN VOULANT REBASER.** La recette de
rebase de ce dossier (`git checkout -B branche origin/main && git checkout <sha>
-- .`) est écrite pour du travail **COMMITÉ**. Lancée sur un arbre qui portait
cinq fichiers **non commités**, elle les a remplacés par la version du commit :
`inject.js`, `background.js`, `manifest.json`, `EXT_ATTENDUE`, `CLAUDE.md` et
`audit-fusion.cjs` sont repartis en arrière d'un coup, sans un mot. Seul le
fichier **non suivi** (`audit-endpoints-vus.cjs`) a survécu — l'inverse de
l'intuition.
⇒ **On commite AVANT toute manipulation de branche**, jamais après. C'est §2.1
(« pousse à chaque modification ») qui protège aussi de ça, et c'est la seule
fois où l'avoir oublié a coûté du travail.

### ⚠️⚠️ UN COMPTE SUPPRIMÉ DÉFINITIVEMENT ALIMENTAIT ENCORE LES FILES DE PUBLICATION
Mesuré le 19 septembre, en isolant `shop_cancale` (que Vinted a bloqué, uid
**199082413**). Il y a **TROIS** listes de comptes écartés, pas deux, et elles
ne se recouvrent pas :
- `vinted_accounts_hidden` — masqué à la main dans l'app ;
- `vinted_accounts_blocked` — « refusé par Vinted » (LOCAL à l'appareil, §5.31) ;
- `vrm_blocked_accounts` — **supprimé DÉFINITIVEMENT** (celle que l'extension lit
  pour refuser de recapter, celle où vit `shop_cancale`).

Les files de cross-posting — `buildLbcData`, `buildEbayData` **et l'écran
Leboncoin de l'app** — ne construisaient leur `off` que des **deux premières**.
Un compte supprimé définitivement n'y était donc **pas**, et ses paires
numérotées en ligne (mesuré : **96** pour `shop_cancale`) étaient proposées à la
republication sur Leboncoin/eBay — alors que les écrans d'annonces de l'app
l'écartent déjà (plus de ligne `vinted_accounts`, donc absent d'`accountUids`).
C'est la divergence §11 (« l'app annonçait 39, le panneau 40 »), sur la liste
des comptes morts : on ne propose pas de republier ailleurs les paires d'un
compte que Vinted a fermé.
⇒ Les trois lecteurs unionnent désormais `vrm_blocked_accounts` dans `off` —
côté extension via `blockedAccounts()` (dernière valeur connue, `null` sur
échec), côté app via une lecture dédiée. ⚠️ **`null`/échec ⇒ on n'exclut RIEN** :
sur-exclure cacherait les paires d'un compte VIVANT sur un simple hoquet — c'est
le **sens inverse** du cas d'écriture (sous-exclure revient au comportement
existant, sur-exclure fait perdre). `audit-places.cjs` sert un compte dans
`vrm_blocked_accounts` **seul** (ni hidden ni blocked) et exige les deux sens —
**3 rouges** sur le code d'avant (Leboncoin, eBay, app).
- **Aucune entrée d'`EXT_CAPACITES`** : c'est une correction, l'app ne promet
  rien de neuf. Extension en **5.81.0**, zip régénéré, `EXT_ATTENDUE` suivie.

### ⚠️⚠️ LE PRIX PARTAIT À 0,54 € — LE CHAMP LEBONCOIN EST EN CENTIMES
Julien a fait ses dépôts le 17 septembre, et la **carte du formulaire est enfin
arrivée** (`lbc_recon.etapes`). Mesuré le 19 septembre — l'étape cœur porte
`subject` (titre), **`body`** (description), **`price_cents`** (prix), `location`.
Le nom le dit : ce champ attend des **CENTIMES**. Or `lbc.js` y posait `ad.price`
tel quel (« 54 ») → Leboncoin affichait **0,54 €** sur son annonce. Le titre et
la description, eux, tombaient juste (`subject`/`body` matchent les motifs).
⇒ `poserPrix(euros, siVide)` LIT l'unité **dans le nom du champ** : si le nom
contient « cent », il pose l'entier en centimes (`Math.round(n*100)`), sinon les
euros. On ne devine pas — on lit ce que le champ déclare.
⚠️ **Le prix se remplissait à TROIS endroits** (`prefill`, `fillNow` la
surveillance, `fillNowForce` le « Re-remplir »), chacun avec le même défaut :
§11, une notion une règle. Les trois passent désormais par `poserPrix`.
- `scripts/bancs/leboncoin.cjs` sert maintenant la **vraie forme** du champ
  (`name="price_cents"`, §6.3) et exige `99,00 € → 9900`. **Rouge** sur le code
  d'avant (« price_cents = 99.00 »), vert après.
- **Aucune entrée d'`EXT_CAPACITES`** : c'est une correction. Extension en
  **5.82.0**, zip régénéré, `EXT_ATTENDUE` suivie.
- ⚠️ **Ce qui manque encore** : les champs `:form-field-_r_XX_` de l'étape
  catégorie/attributs n'ont **pas de libellé** dans la carte captée (l'extension
  d'alors ne relevait pas les `listes` de ces étapes). `fforms` (52 Ko) et
  `fdata` (682 Ko) sont arrivés **entiers** dans `lbc_catalogue` : c'est de là
  que sortira le mapping catégorie→code. **Rien n'est analysé pour l'instant** —
  on branche à la prochaine passe, pas avant d'avoir relié un `_r_XX_` à son
  libellé.

### ⚠️⚠️ REMESURÉ LE 19 SEPTEMBRE (plus tard) : LE PONT `_r_XX_` → LIBELLÉ EXISTE, ET `choisirListe` EST MORT SUR LE VRAI FORMULAIRE
Le point ci-dessus (« les `_r_XX_` n'ont pas de libellé ») **est périmé** — mesuré
sur sa vraie base ce soir. L'étape attributs de `lbc_recon.etapes` (captée le
17 septembre par une **5.75.0**, donc déjà présente quand j'écrivais le contraire)
porte pour ses **six** champs le libellé **ET** la liste d'options :
| champ (`_r_XX_`) | libellé | options captées |
|---|---|---|
| `_r_15_` | **Univers*** | Femme · Homme · Enfant |
| `_r_1e_` | **Type de chaussures** | Baskets & Sneakers · Mocassins · Bottines… (13) |
| `_r_21_` | **Pointure*** | 16 · 16,5 · … (25) |
| `_r_4c_` | **Marque** | A Bathing Ape · … · Adidas… (**11 — liste filtrée**, pas exhaustive) |
| `_r_4i_` | **Couleur** | Blanc · Bleu / Ciel · Gris / Anthracite… (21) |
| `_r_5d_` | **État** | Neuf avec étiquette · Très bon état · Bon état · État satisfaisant (5) |
- ⚠️⚠️ **ET `choisirListe` NE REMPLIT RIEN SUR CETTE ÉTAPE.** Les six champs sont
  **`tag:"input"` / `forme:"composant"`** — des listes React, **zéro `<select>`
  natif**. Or `choisirListe` fait `document.querySelectorAll('select')` : il
  trouve **0 élément** et remplit donc **0 attribut**. C'est mot pour mot
  « ça ne met pas la catégorie ni le reste » (13 sept.). Le bloc ci-dessus qui
  affirme « la catégorie et l'état sont choisis / les listes ne sont pas des
  `input` » **décrit une réalité qui n'existe pas sur son formulaire** — le
  bandeau, lui, reste honnête (il compte `n`, et `n` n'inclut jamais ces
  champs). *Une suppression « terminée » se vérifie sur ce qui RESTE* :
  `choisirListe` **reste** (une autre étape/variante peut porter un vrai
  `<select>`, §4.11), mais il ne faut pas croire qu'il fait ce travail.
- ⚠️⚠️ **CE QU'ON NE PEUT PAS FAIRE AUJOURD'HUI, ET POURQUOI** : la valeur
  **soumise** par Leboncoin est un **CODE** (`{value,label}`, `fforms`/`fdata`),
  pas le libellé. Poser le texte « Nike » dans un composant React ne pose **pas**
  le code — au mieux rien ne s'enregistre, au pire l'annonce part avec un
  attribut cassé. Écrire un remplisseur de combobox **avant** d'avoir relié
  chaque option à son code serait le défaut le plus coûteux du projet. `fforms`
  (**61 798 car.**) et `fdata` (**808 878 car.**) sont **entiers** dans
  `lbc_catalogue` (`coupe:false`) : la matière du mapping est là, **rien n'est
  encore analysé**. **Ne pas écrire le clic « Publier ».**
- **Ce qui sera mappable avec CERTITUDE** quand on branchera : **Pointure**
  (← `ad.taille`) et **État** (← condition, libellés exacts ci-dessus). **Marque**
  est une liste **filtrée** (11 options = résultats de recherche, pas le
  catalogue) → passe par le code, pas par le libellé. **Univers / Type / Couleur**
  ne se **devinent pas** depuis ses données (*mieux vaut un blanc qu'un faux*) —
  laissés vides, il les choisit.
- **Son extension installée est en `5.80.0`** (`panel_diag_capture.ver`, verAt
  19 sept.) — **derrière la 5.82.0 livrée**. Le correctif du prix en centimes
  (5.82) et l'exclusion des comptes supprimés (5.81) **ne tournent pas encore
  chez lui** ; l'app le dit déjà (diagnostic de version). *Le premier geste
  reste : remplacer le dossier de l'extension par le zip livré.*

### ⚠️⚠️ « FAIS-LE TOUT SEUL » — LE MAPPING EST FAIT, LE CODE DE CHAQUE OPTION MANQUAIT
Julien, 19 sept. (plus tard) : « tu peux faire ça tout seul ». J'ai donc analysé
`fforms`/`fdata` (entiers dans `lbc_catalogue`) pour relier chaque attribut du
dépôt à son **code** — le mapping que le dossier diffère depuis des passes.
**Mesuré, et deux choses ont tranché :**
- ⚠️ **`fforms` capté = `searchAd` UNIQUEMENT** — le formulaire de **RECHERCHE**,
  pas de dépôt. Le dossier supposait « les formulaires par catégorie » : faux
  sur la mesure. La liaison champ→feature ne vient donc pas de `fforms`.
- ✅ **Mais `fdata.features` la donne, par IDENTITÉ D'ENSEMBLE** (§5, jamais par
  ressemblance de libellé — plusieurs features s'appellent « État »/« Marque »).
  Chacun des six champs captés matche **un seul** feature dont l'ensemble
  d'options est identique (ou sur-ensemble pour les listes filtrées) :
  | champ dépôt | feature `fdata` | jointure |
  |---|---|---|
  | Univers* | `shoe_type` (1=Femme·2=Homme·3=Enfant) | ensemble identique |
  | Type de chaussures | `shoe_category_a` | ensemble identique |
  | Pointure* | `shoe_size` | sur-ensemble (liste captée partielle) |
  | Marque | `shoe_brand_a` | sur-ensemble (liste **filtrée** à la frappe) |
  | Couleur | `clothing_color_a` | ensemble identique |
  | État | `clothing_condition_a` (5=Neuf ét.·4·3=TBÉ·2·1) | ensemble identique |
- ⚠️⚠️ **CE QUI RESTAIT NON MESURABLE, ET POURQUOI JE N'AI PAS ÉCRIT LE REMPLISSAGE** :
  Leboncoin **soumet un code**, pas le libellé ; et les six listes sont des
  **composants React**, dont je n'ai **jamais vu** le DOM de sélection (comment
  la liste s'ouvre, où vit le code). Écrire un remplisseur de combobox sur cette
  base serait deviner — et un banc qui sert un faux composant mesure une fiction
  (§6.3). Un mauvais attribut sur une annonce **publiée** est le coût le plus
  élevé (leçon eBay). **Ne pas écrire le remplissage ni le clic « Publier » tant
  que le code réel n'est pas mesuré sur SA page.**
- ⇒ **Ce qui EST livré (mesuré, lecture seule, sans risque)** : la capture des
  étapes relève désormais, pour chaque option de composant, son **code réel**
  (`optcodes` : `{t: libellé, v: value/data-value/data-qa-id/id}`) + `role` et
  `controls` du contrôle. Le jour où sa **5.83** passe sur une page de dépôt,
  j'ai enfin le code de SA page — la jointure `fdata` n'est qu'un filet, pas une
  supposition. `bancs/leboncoin.cjs` sert une option `data-value="3"` et exige
  que `optcodes` la relève (`Très bon état=3`), et vérifie toujours qu'**aucune
  valeur saisie ne fuit**. Extension en **5.83.0**, zip régénéré, `EXT_ATTENDUE`
  suivie. **Aucune entrée d'`EXT_CAPACITES`** : c'est une mesure, l'app ne promet
  rien de neuf.
- **La passe suivante remplira Pointure + État** (code-certains **et**
  valeur-connue : `ad.taille`, condition), en visant le code relevé, prouvé au
  banc sur la vraie forme. **Univers/Type/Couleur restent vides** — leur valeur
  ne se devine pas depuis ses données (*mieux vaut un blanc qu'un faux*), même si
  leur code est connu. **Marque** : liste filtrée → passe par le code, jamais le
  libellé.

### ⚠️⚠️ LEBONCOIN ÉCRIT PARFOIS LA DESCRIPTION LUI-MÊME — ET LA RÉFÉRENCE DISPARAISSAIT
Julien, 19 sept. : « parfois la description et certaines choses sont faites
automatiquement par le bon coin, adapte l'extension ». **Mesuré dans le code**,
et il y avait un défaut des DEUX côtés :
- `fillNow` (surveillance auto) remplissait la description en `setIfEmpty` — donc
  quand Leboncoin l'avait **déjà écrite**, l'extension la respectait (bien) **mais
  la référence `VRM-{n°}` n'y entrait JAMAIS**. Or c'est elle qui relie l'annonce
  à la paire sans rapprochement par titre (§5) : sans elle, « vendue sur Vinted →
  retire-la de Leboncoin » ne reconnaît plus l'annonce, et il la republie ou vend
  deux fois. **La réf disparaissait en silence.**
- `prefill` (« ✍️ Pré-remplir ») et `fillNowForce` (« Re-remplir ») faisaient
  l'inverse : `setField` **écrasait** la description que Leboncoin venait
  d'écrire.
⇒ `poserDescription(ad)` porte la règle pour les trois chemins (§11) : champ vide
  → description complète ; champ **déjà rempli** (Leboncoin ou lui) → on **garde**
  son texte et on **ajoute la référence à la fin, une seule fois** (jamais un
  doublon, garde par regex sur `VRM-{n°}`). On n'écrase plus jamais une
  description. Le bandeau le dit (« ta référence ajoutée à la description que
  Leboncoin a déjà écrite »).
- ⚠️ **On ne devine pas « certaines choses »** : la capture des étapes note
  désormais, par champ, `rempli` (booléen) et `len` (longueur) — **jamais le
  contenu** — pour MESURER ce que Leboncoin auto-remplit vraiment et adapter le
  reste à la prochaine passe, sur mesure et pas sur une supposition.
- `bancs/leboncoin.cjs` pré-remplit la description **avant** que l'extension
  tourne (comme le ferait Leboncoin), sans référence, et exige les deux : le
  texte de Leboncoin **gardé** ET `VRM-401` **ajoutée**. Prouvé rouge sur le code
  d'avant (« la réf a disparu »). **Aucune entrée d'`EXT_CAPACITES`** (l'app ne
  promet rien de neuf) ; extension en **5.84.0**, zip régénéré, `EXT_ATTENDUE`
  suivie.

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

### ⚠️⚠️ « IL N'Y A QUE 5 PHOTOS » — ET MA « MESURE » DE COMPTE PRO ÉTAIT UN FRAGMENT D'URL
Julien, 19 sept. : « sur les comptes **particuliers** tu peux en mettre jusqu'à
**15** ; c'est sur les comptes **pro** où tu peux en mettre que **5** si tu
n'achètes pas le pack. Je veux toutes les photos de l'annonce Vinted sur
Leboncoin si c'est du compte particulier. » Puis, quand je lui ai répondu « ton
compte est pro » : **« non là c'est compte particulier »**. Il a raison, il
possède le compte.
⚠️⚠️ **MON PREMIER JET AFFIRMAIT « son compte Leboncoin est PRO
(`online_store_id`) » — c'était FAUX, et c'est le piège §6 mot pour mot.** En
remesurant : `lbc_accounts` est **vide** (`[]`) — le type de compte n'a **jamais
été capté** — et `online_store_id` n'était qu'un **bout de chemin d'URL** dans
`lbc_recon.paths` (`.../online_store_id"`), pas un champ de compte. J'ai lu le
mauvais champ et j'en ai tiré une affirmation, exactement ce que ce dossier
interdit. *Avant d'affirmer un fait sur ses données, vérifier le NOM et la FORME
du champ ; un fragment de chaîne n'est pas une mesure.*
**Ce qui EST mesuré, sur sa vraie base** : ses annonces Vinted captées portent
**au plus 6 photos** (`vinted_item_details`, 118 objets : `1→14 · 3→1 · 4→5 ·
5→38 · 6→60`, **aucune au-dessus de 6**). Et **ce n'est pas une troncature de
notre côté** : la capture garde jusqu'à **20** photos (`background.js:2610`,
`slice(0,20)`), le `slice(0,6)` de `lbc.js:489` ne concerne que les **vignettes
d'aperçu** du panneau. Donc ses paires ont réellement ≤ 6 photos — cohérent avec
« 5 en moyenne » mesuré le 12 sept.
⇒ **Le « 5 » qu'il voit = le nombre réel de photos de CETTE annonce-là** (38 de
ses annonces en ont exactement 5, 60 en ont 6). Ce n'est ni un plafond de
compte, ni un `slice` : l'extension envoie déjà **toutes** les photos qu'elle a.
- `attacherPhotos` **envoie jusqu'à 15** (`slice(0,15)`, `photoBytes … max:15`,
  contre 10 avant). C'est **correct pour un compte particulier** (15 autorisés),
  et sans risque : sur-fournir ne fait que laisser Leboncoin ignorer le surplus.
- ⚠️⚠️ **CE QUE JE CROYAIS ÊTRE LA VÉRITÉ ÉTAIT ENCORE FAUX** : j'avais écrit
  « ses annonces portent ≤ 6 photos ». C'était le compte **CAPTÉ**, pas le réel.
  Vinted DIT le vrai nombre dans `nPhotos` : **mesuré, ses annonces ont 7 à 16
  photos** (médiane ~12 ; distribution sur 784 : le gros entre 11 et 14). On n'en
  captait que **≤ 6** — il en manquait donc **la moitié**. Le « 15 » n'est PAS
  latent : c'est la **capture** qui plafonnait (voir la section suivante).
- **Aucune entrée d'`EXT_CAPACITES`** : le pont `photoBytes` respecte déjà `max`
  (`photosEnOctets(urls, max)`), rien de neuf n'est promis à l'app.

### ⚠️⚠️ ET C'ÉTAIT BIEN LA CAPTURE — LE CARROUSEL VINTED CHARGE SES IMAGES AU FUR ET À MESURE
Julien, 19 sept. : « c'est peut-être parce que la capture Vinted ne prend que
5 photos ». **Il avait raison.** `readListingDetailFromPage` (dans
`vinted-panel.js`) lisait les photos **du DOM**, et seulement `img[src*="vinted.net"]`.
Or le carrousel Vinted est **lazy** : les slides pas encore affichées n'ont pas
de `src` (leur URL vit dans `srcset`/`data-src`), donc elles étaient **perdues**.
D'où le plafond mesuré à 6 (les seules chargées d'emblée), qui n'a **rien** à
voir avec le type de compte.
⇒ `ajoute(u)` collecte désormais `src`, `srcset`, `data-srcset`, `data-src` des
`<img>` **et** les `<source srcset>`, toujours filtré au même domaine + grand
format (`f800|f1200|tc`). Et il **dédoublonne par IDENTITÉ de photo**
(`cle` = URL sans la query ni le segment de format) : une même photo vue en f800
**et** f1200 ne compte qu'une fois — sinon Leboncoin recevrait un doublon (défaut
que l'ancien code avait **aussi** : il ajoutait la photo principale deux fois).
- ⚠️ **§4.10 : cette fonction n'avait jamais tourné hors de Chrome.**
  `scripts/bancs/photos.cjs` extrait la VRAIE fonction (AVANT = `HEAD`, APRÈS =
  arbre) et les exécute sur **le même** carrousel synthétique où seules 5 images
  ont un `src` et le reste vit en lazy : **AVANT perd les 3 slides lazy et
  double la principale ; APRÈS capte les 9, sans doublon.** C'est un vrai
  avant/après (§6.1), pas « la fonction n'existait pas ».
- ⚠️⚠️ **CE QUE JE NE PEUX PAS PROUVER D'ICI, ET QUI RESTE À MESURER** : que le
  DOM réel de Vinted expose bien ses slides lazy dans `srcset`/`data-src`. Le
  banc prouve que **si** elles y sont, on les prend ; il ne prouve pas qu'elles
  y sont (je n'atteins pas Vinted, 403). *Le seul verdict : qu'il rouvre, avec
  la 5.87, une annonce qui a plus de 6 photos sur Vinted — puis on relit
  `vinted_item_details` et on compte.* Si ça reste à 6, les photos vivent dans
  la DONNÉE de la page (JSON embarqué), pas le DOM, et c'est la prochaine passe :
  faire mesurer par ce qui y a accès, comme le formulaire eBay.
- **Aucune entrée d'`EXT_CAPACITES`** : c'est une correction de capture, pas une
  promesse neuve. Extension en **5.87.0**, zip régénéré, `EXT_ATTENDUE` suivie.

### ⚠️⚠️ « UNE SEULE PHOTO SE TÉLÉVERSE » — L'UPLOADER LEBONCOIN LES PREND UNE PAR UNE
Julien, 19 sept. (dépôt simulé) : « il n'y a qu'une seule photo qui se téléverse,
il faut qu'elles y soient toutes, tout seul ». **Cause** : `attacherPhotos` posait
**toutes** les photos d'un coup (`input.files = dt.files` avec N fichiers). Or
l'uploader de Leboncoin lit **une** photo par `change`, ajoute sa vignette, puis
**remonte le champ** — un envoi groupé n'y dépose donc qu'**une** vignette.
⇒ Nouvelle stratégie, **débrouillarde** (résiste à un changement de Leboncoin) :
- champ **`multiple`** → on pose tout d'un coup (l'API standard) ;
- sinon → **une par une**, en **re-cherchant le champ** à chaque fois et en
  **comptant les vignettes d'aperçu** (`img[src^="blob:"]`) pour savoir combien
  Leboncoin a réellement acceptées — on avance jusqu'à atteindre notre nombre,
  avec repli **glisser-déposer** si le champ disparaît. S'arrête sur absence de
  progrès (pas de boucle infinie).
- La capture note désormais `multiple`/`accept` du champ fichier + `fichiersMultiple`
  de l'étape : on ne devine plus, on mesure.
- `bancs/leboncoin.cjs` sert l'uploader qui **ne prend qu'une photo** (non
  `multiple`, lit `files[0]`, se vide) : **§6.1 — un envoi groupé n'y dépose
  qu'1 vignette (le défaut) ; l'extension en dépose 3** (une par une). Le champ
  `multiple` (etape2) garde l'envoi groupé.
- Extension en **5.91.0**, zip régénéré, `EXT_ATTENDUE` suivie. Aucune entrée
  d'`EXT_CAPACITES` (correction de fiabilité).
- ⚠️ **« Juste un bouton et ça se poste » — toujours PAS le clic « Publier ».**
  L'arbre catégorie (Mode > Chaussures) et le clic final restent à lui tant que
  je n'ai pas capté l'étape catégorie sur un dépôt complet (le sien s'est arrêté
  avant). Photos + titre + description + prix + pointure + état sont automatiques ;
  publier reste un geste humain (aucune publication à l'aveugle, §5/§3).

### ⚠️⚠️ « ÇA NE FAIT PAS LA CATÉGORIE TOUT SEUL » — LES MENUS REACT SONT ENFIN REMPLIS (POINTURE + ÉTAT)
Julien, 19 sept., après son dépôt test. **Mesuré : son dépôt (5.89) n'a capté que
l'étape « titre »** — mais un dépôt antérieur avait capté l'étape ATTRIBUTS
entière (`lbc_recon.etapes`), et j'ai enfin sa **vraie forme** : chaque attribut
(Univers, Type, Pointure, Marque, Couleur, État) est un **`[role="combobox"]`**
(`:form-field-_r_XX_`) + une liste **`[role="option"]`** (les `-item-N`) — des
COMPOSANTS React, **zéro `<select>` natif**. C'est pour ça que `choisirListe`
(qui fait `querySelectorAll('select')`) ne remplissait **rien**.
⇒ `choisirComposant(motif, valeurExacte)` (lbc.js) **OUVRE le menu et CLIQUE
l'option** — le geste d'un humain, pas une valeur posée en douce. On trouve le
menu par son **libellé** (les ids `_r_XX_` changent à chaque rendu React), et on
ne clique QUE l'option au texte **EXACTEMENT** égal.
- Rempli automatiquement : **Pointure** (← `ad.taille`, « 40.5 »→« 40,5 ») et
  **État** (← `ad.etat` Vinted, exposé par `buildLbcAd`). ⚠️ **Correspondance
  EXACTE** : « Satisfaisant » (Vinted) ≠ « État satisfaisant » (Leboncoin) → laissé
  VIDE, exprès (mieux vaut un blanc qu'un faux, §5). Un attribut faux sur une
  annonce publiée est le coût le plus élevé (leçon eBay).
- **JAMAIS Univers/Type/Couleur/Marque** : ils ne se devinent pas depuis ses
  données. **JAMAIS le clic « Publier »** : il reste à lui.
- ⚠️ **Ce que je ne peux TOUJOURS pas prouver d'ici (403)** : que le combobox
  RÉEL de Leboncoin réponde au clic synthétique comme mon fixture. Le banc sert la
  vraie FORME mesurée (combobox + option), pas une fiction ; mais l'interaction se
  confirme à son prochain dépôt. Si un menu ne se remplit pas, c'est un no-op
  (VIDE), jamais un faux — il voit et complète.
- `scripts/bancs/leboncoin.cjs` sert un dépôt `etape3` avec la vraie forme
  (combobox React) : **Pointure 40 et État « Très bon état » choisis par clic ;
  une pointure absente et « Satisfaisant » laissés VIDES.** Extension en
  **5.90.0**, zip régénéré, `EXT_ATTENDUE` suivie. Aucune entrée d'`EXT_CAPACITES`
  (le panneau fait le geste et écrit le chiffre ; l'app ne promet rien de neuf).
- ⚠️ **La CATÉGORIE (l'arbre Mode > Chaussures), elle, n'est pas encore captée**
  (son dépôt 5.89 s'est arrêté au titre) : c'est l'étape en amont qui ouvre les
  attributs. À câbler quand un dépôt l'aura relevée — d'ici là, il choisit la
  catégorie, l'extension remplit le reste qu'elle peut.

### ⚠️⚠️ « ÇA NE CLIQUE PAS SUR LA CATÉGORIE » — VU AU RENDU : DES RADIOS + UN « CONTINUER »
Julien, 20 sept., capture d'écran de l'étape 1 du dépôt à l'appui : « ça ne clique
pas sur la bonne catégorie, et ça ne clique même pas ; je veux que ça fasse ça,
tout le reste, et que ça appuie sur Continuer ». **Mesuré au rendu (§6.2)** : la
catégorie n'est PAS une liste — c'est **trois boutons radio** (« Mode >
Chaussures », « Loisirs > Sport & Plein air », « Mode > Vêtements »), plus un
champ « Ou choisissez une autre catégorie », et un bouton **Continuer** dessous.
`choisirComposant` (combobox) et `choisirListe` (`<select>`) ne voyaient donc
**rien** ici.
⇒ **`choisirCategorie(ad)`** clique le RADIO dont le libellé contient sa
catégorie (`ad.category` = « Chaussures ») — une correspondance, jamais « le
premier ». **`cliquerContinuer()`** enchaîne l'étape : il clique un bouton
**« Continuer »/« Suivant »** et **JAMAIS** un bouton qui **publie/dépose/valide/
paye/finalise** (`BTN_PUBLIER` l'écarte, §3/§5). **`avancer()`** l'appelle une
fois par étape (signature), avec quelques essais puis abandon — si ça n'avance
pas, c'est qu'un champ **obligatoire non devinable** manque (ex. **Univers***),
et on le **DIT** (« un champ obligatoire reste à choisir ») au lieu de tourner en
rond. Câblé dans `fillNow` (passif), `prefill` et `fillNowForce`.
- ⚠️ **« Publier » reste À LUI**, toujours (aucune publication à l'aveugle). Ce
  qui part tout seul : titre, description, prix, référence, photos, pointure,
  état, **catégorie**, et l'enchaînement **Continuer**. Ce qui reste manuel :
  les attributs qu'on ne devine pas (Univers/Type/Couleur/Marque) et le clic
  final Publier.
- `bancs/leboncoin.cjs` sert l'étape catégorie (radios + Continuer + Publier) :
  **le radio « Mode > Chaussures » est coché, « Continuer » cliqué une fois,
  « Publier » JAMAIS** (0 clic). Extension en **5.92.0**, zip régénéré,
  `EXT_ATTENDUE` suivie. Aucune entrée d'`EXT_CAPACITES` (l'app ne promet rien
  de neuf : c'est le panneau qui agit, et le manifeste continue de dire « c'est
  toi qui cliques sur Publier »).

### ⚠️ « DIS-MOI QUAND TOUTE L'ANNONCE EST CAPTÉE → PRÊTE POUR LEBONCOIN »
Demande de Julien, 19 sept. : « j'aimerais que ça me dise quand ça capture toute
l'annonce sur Vinted, pour qu'après ça puisse me dire s'il est en capacité de la
mettre sur Leboncoin. »
**Le signal existe grâce à `nPhotos`** (le compte RÉEL de Vinted, mesuré 7-16 par
annonce) : on le compare aux photos **captées** de la page
(`vinted_item_details[id].photos.length`, exposé à l'app par `fetchDescLens` qui
rend désormais `{len, ph}` au lieu d'une simple longueur).
- Par paire (carte Annonces) : **✓ prête pour Leboncoin** (numérotée + toutes ses
  photos captées + une description) · **📷 X/Y photos — rouvre-la sur Vinted** ·
  **à capter — ouvre-la sur Vinted** · **description à capter**. Le CHIFFRE,
  jamais la promesse ; un total inconnu (`photoCount` absent) ne se juge pas (§5).
- Dans le bandeau : « **N à recapturer pour Leboncoin** » (ambre) / « ✓ N prêtes »,
  compté dans `annStats` — **même base que la grille** (§11), jamais un second
  calcul.
- ⚠️ **Ça éclaire le vrai état AUJOURD'HUI** : tant que la 5.87 (capture des
  photos lazy) n'est pas installée et les annonces rouvertes, presque tout est
  « à recapturer » (≤ 6 captées sur ~12 réelles). C'est honnête et actionnable :
  ça lui dit exactement quoi rouvrir.

### ⚠️⚠️ « OÙ EST LA PAIRE : VINTED / LEBONCOIN / QUEL COMPTE » — MESURÉ IMPOSSIBLE AUJOURD'HUI
Demande de Julien, 19 sept. : « dans VRM, dis-moi précisément si la paire est
postée sur Leboncoin, sur quel compte (j'aurai sûrement plusieurs comptes
Leboncoin) ; et vendue sur Vinted → dis-moi de la retirer de Leboncoin, et
inversement. »
**Mesuré sur sa vraie base, et c'est le point de départ honnête** :
- `lbc_listings.items` = **140 annonces qui ne sont PAS les siennes** (le flux
  « découverte » : chalets, locations), **0 avec une réf VRM**, **0 avec un champ
  compte**. `lbc_accounts` est **vide**.
- Le parseur (`handleLbcRaw`) extrait `id, ref, url, status, subject, price,
  images` — mais **aucun owner/compte**, et ses PROPRES annonces (particulier) ne
  sont pas encore captées avec leur `VRM-{n°}`.
⇒ Donc « sur quel compte » et « vendue ici → retire là » **ne peuvent pas être
rendus honnêtement aujourd'hui** : il n'y a ni compte capté, ni lien
paire↔annonce Leboncoin. Les afficher serait promettre ce qu'on ne peut pas
tenir (le défaut le plus coûteux du projet). *Le lien qui survit à plusieurs
comptes Leboncoin est la référence `VRM-{n°}` (déjà mise dans la description au
dépôt) + le compte connecté, à capter.*
⚠️ **CE QU'IL FAUT POUR DÉBLOQUER, et je ne peux pas le faire seul** : Leboncoin
me renvoie **403** — je ne vois pas la page « mes annonces » du compte
particulier ni où vit l'id de compte. Il faut : (1) qu'il **poste une vraie
annonce** et rouvre « mes annonces » sur Leboncoin avec l'extension à jour, pour
que ses ads soient captées avec leur `VRM-{n°}` **et** taguées du compte
connecté ; (2) que je voie la **forme** de cette réponse (recon). Alors seulement
je câble le « où / quel compte » et le « vendue ici → retire là » (les deux sens,
`status` active/inactive existe déjà), prouvé sur des données réelles. *Ne pas
écrire ce lien à l'aveugle.*

### ⚠️⚠️ « CAPTE À QUI APPARTIENT CHAQUE ANNONCE + LE NOM DU COMPTE » — LA MOITIÉ QUE JE PEUX FAIRE
Demande de Julien, 19 sept. : « prépare une extension intelligente qui capte la
plateforme, à quel compte ça appartient et le nom du compte, pour lier toutes les
paires — un écosystème pour un vrai revendeur. »
**Mesuré : l'infra existait (`storeLbcAccount`, message `lbcCapture.account`) mais
`lbc_accounts` était VIDE** — le motif du tiroir `Nav` : le mécanisme est là, la
DÉTECTION manquait. `lbc.js` cherchait le compte dans les données EMBARQUÉES de la
page (`__NEXT_DATA__`/`__next_f`) — il n'y est pas. L'identité du compte connecté
vit dans une **réponse API** que `lbc-inject` relaie déjà, mais que `handleLbcRaw`
ne minait pas.
⇒ `detectLbcAccount(data, url)` (background) lit l'identité du compte connecté dans
n'importe quelle réponse Leboncoin : un objet qui porte un **id + un nom** ET un
**marqueur de « c'est moi »** (email, téléphone, siren, store_id, is_pro). Il rend
`{id, name, type: pro|particulier, platform:'leboncoin'}`.
- ⚠️ **PRUDENCE (§5) : un acheteur a aussi un id + un pseudo.** Sans marqueur
  personnel (ou hors d'une clé `user/account/store/me/pro`), on ne prend RIEN —
  taguer une annonce du **mauvais compte** serait pire que ne rien taguer. Le banc
  sert exprès une réponse de **messagerie** (acheteurs) et exige `null`.
- `handleLbcRaw` tague les annonces de son **tableau de bord** (chemin pro `Ads`)
  du compte connecté (`account`, `accountName`, `accountType`, `platform`), et les
  annonces d'une réponse générique de **leur PROPRE owner** (jamais du compte de
  session — un chalet du flux découverte n'est pas à lui). Le compte est mémorisé
  dans `lbc_accounts`.
- `lbc-inject` laisse désormais passer les réponses `/account`, `/user`, `/me`,
  `/pro`, `dashboard`… (`ACCOUNT_HINT`), pas seulement celles qui parlent
  d'annonces — c'est là que vit l'identité.
- `scripts/audit-lbc-comptes.cjs` EXÉCUTE le vrai `background.js` (HEAD vs arbre) :
  particulier reconnu, pro reconnu, **acheteur non pris**, annonces taguées +
  écrites dans `lbc_accounts`. **§6.1 : sur le code d'avant, 0 annonce taguée.**
- **Aucune entrée d'`EXT_CAPACITES`** : c'est de la COLLECTE (l'app ne promet rien
  de neuf tant que le lien n'est pas rendu). Extension en **5.88.0**, zip
  régénéré, `EXT_ATTENDUE` suivie.
- ⚠️ **CE QUI RESTE, et pourquoi je ne le câble pas encore** : je n'ai pas VU la
  vraie forme de sa réponse « mes annonces » (403). `detectLbcAccount` est
  défensif (plusieurs noms de champs), mais tant que sa vraie réponse n'a pas
  confirmé où vit l'id + le nom, l'app **n'affiche pas** « publiée sur tel
  compte ». La prochaine passe, sur `lbc_accounts` réellement rempli, câble
  l'affichage par paire + le « vendue ici → retire là ». *On collecte, on
  vérifie, PUIS on promet.*

### ⚠️ « FLOUTER LES DÉJÀ PUBLIÉES » + « LE DESIGN FAIT SIMPLE » + « JUSTE UN BOUTON QUI PUBLIE »
Demande de Julien, 19 sept. Trois points, traités selon ce qui est HONNÊTE :
1. **Flouter les annonces déjà republiées** (« les Nike Sacai, on les a déjà mises
   sur Leboncoin »). `cardHtml` estompe (`.card.deja` : opacity .5 + grayscale) et
   **désactive « Tout préparer »** toute paire dont NOTRE `VRM-{n°}` est repéré sur
   la page Leboncoin (`pageRefs`, une IDENTITÉ, jamais un titre — §5), avec un
   badge « ✓ déjà en ligne ». ⚠️ Le signal PERSISTANT (ref trouvée dans ses
   annonces captées) ne s'allumera qu'une fois ses ads captées (5.88 + sa visite) ;
   d'ici là c'est le scan de page qui l'alimente.
2. **Design aligné sur la signature de VRM (§7)** : fini l'orange Leboncoin
   partout — encre ardoise `#10151B`, **UNE** couleur d'accent (bleu `#1E5FCC`,
   rare), fond gris froid `#F6F7F9`, ombres à deux couches, et **une seule forme
   de bouton** (hauteur/rayon/graisse). CSS only, aucune logique touchée ; le banc
   `leboncoin.cjs` reste vert.
3. ⚠️⚠️ **« juste appuyer sur un bouton et que ça publie » — PAS écrit, et c'est
   la règle du projet.** Le clic « Publier » et le remplissage des listes
   d'attributs (Univers/Type/Pointure/Marque/Couleur/État) sont des **composants
   React** dont je n'ai **jamais vu** le DOM de sélection (Leboncoin me renvoie
   403), et la valeur soumise est un **CODE**, pas le libellé. Un mauvais attribut
   sur une annonce **publiée** est le coût le plus élevé du projet (leçon eBay).
   *Écrire le clic « Publier » à l'aveugle serait le défaut le plus coûteux.* Ce
   que fait déjà « Tout préparer » (mesuré, sûr) : attache les photos, remplit
   titre + description + prix (en centimes) + référence, ouvre la page. **Ce qui
   débloque le bouton unique** : qu'il fasse UN dépôt à la main avec la 5.88+ (la
   capture `optcodes` + `lbc_recon.etapes` relève alors le DOM réel des listes) —
   ensuite on câble le remplissage des attributs code-certains (Pointure, État) et
   l'enchaînement des étapes, prouvé au banc sur la vraie forme. On ne promet pas
   avant d'avoir mesuré.
- Extension en **5.89.0**, zip régénéré, `EXT_ATTENDUE` suivie. Aucune entrée
  d'`EXT_CAPACITES` : estompage + design, rien de neuf n'est promis.

### ✅ LE DÉPÔT DU 17 SEPT. A ÉTÉ CAPTÉ — `optcodes` RÉELS, ET LEBONCOIN AUTO-REMPLIT 4/6 ATTRIBUTS
Mesuré sur sa vraie base après son dépôt manuel (extension à jour) : la capture
des étapes remonte enfin, pour chaque champ composant, son **code DOM réel**
(`optcodes: {t:libellé, v:value/data-value/data-qa-id/id}`) — plus une
supposition, la valeur qui part vraiment. Et **Leboncoin remplit lui-même** 4 des
6 attributs (Univers, Type, Pointure, Marque `rempli:true`), laissant **Couleur
et État** vides.
⇒ Ça débloque une passe FUTURE de remplissage d'attributs (Pointure ← `ad.taille`,
État ← condition) **visant le code relevé**, prouvée au banc sur la vraie forme —
**pas maintenant** : tant qu'un banc ne prouve pas le remplissage sur les codes
réels captés, écrire le remplisseur de combobox serait deviner (§6.3), et un
mauvais attribut sur une annonce **publiée** est le coût le plus élevé (leçon
eBay). **Univers/Type/Couleur restent vides** — leur valeur ne se devine pas
depuis ses données (*mieux vaut un blanc qu'un faux*). **Ne pas écrire le clic
« Publier ».**

### ⚠️⚠️ « QU'IL N'Y AIT PLUS D'ERREUR / QUAND JE VENDS ÇA SE SUPPRIME / BORDEREAUX LEBONCOIN » — CE QUI EST DÉJÀ FAIT, ET CE QUI ATTEND SA DONNÉE
Demande de Julien, 20 sept. : « une fois qu'une paire est rentrée dans
l'écosystème, plus d'erreur possible ; **quand je fais une vente que ça supprime
tout seul** ; et vois pour la **génération de bordereaux sur le bon coin** —
capter les bordereaux déjà dans l'app, et en générer comme sur Vinted. Je te
laisse te débrouiller **en attendant que je puisse mettre l'extension.** »

**Mesuré d'abord (§6), et le point de départ honnête** : sa base porte, côté
Leboncoin, seulement `lbc_accounts` · `lbc_catalogue` · `lbc_listings` ·
`lbc_recon` — **aucune vente, aucun bordereau, aucune commande** Leboncoin. Et
`lbc_listings` = **182 annonces qui ne sont PAS les siennes** (le flux
« découverte »), **1 seule** portant une réf `VRM-{n°}`. Leboncoin me renvoie
**403** : je ne vois ni sa page « mes annonces », ni sa messagerie, ni un
bordereau LBC.

**1. « Quand je vends → ça se supprime tout seul » : DÉJÀ FAIT, côté app, et
mesuré live.** `annBase` (App.jsx, la base de l'écran Annonces, des pastilles
« prête pour Leboncoin », de la numérotation) **exclut les paires prouvées
vendues** par `annoncesVendues` — `identiteAnnonce(o)` (jamais le titre, §5),
vente de **≤ 60 j**, `classifyOrderStatus !== 'cancelled'` (un retour/remboursement
la fait revenir). La paire disparaît de l'app **dès que la vente est captée**. Et
la **file Leboncoin** (comme eBay) écarte déjà les paires prouvées vendues
(`lireVentesProuvees`, qui **porte son échec** : « rien lu » ne vide pas la file).
⇒ Tout ce qui est faisable **sans donnée Leboncoin** pour « vendu → retiré » est
en place. Ne pas ré-écrire une seconde règle.

**2. « Retirer l'annonce Leboncoin *elle-même* quand la paire se vend » : BLOQUÉ
sur le lien paire ↔ annonce LBC, pas sur le code.** Ce lien est la réf
`VRM-{n°}` lue **sur l'annonce Leboncoin** + le compte connecté — et cette donnée
n'existe pas encore (`lbc_listings` ne contient pas ses annonces à lui avec leur
réf). L'afficher aujourd'hui serait promettre ce qu'on ne peut pas tenir (le
défaut le plus coûteux du projet). *Ne pas l'écrire à l'aveugle.*

**3. « Générer / capter des bordereaux Leboncoin comme sur Vinted » : BLOQUÉ sur
la MÊME absence, et VRM ne *génère* rien — il *capte*.** Sur Vinted, VRM ne crée
pas le bordereau : Vinted l'émet après la vente, l'extension en capte le **PDF**
(`label_latest.pdfB64`), l'app affiche « prêt à imprimer ». Le pendant Leboncoin
serait identique — capter le PDF du bordereau que **Leboncoin** émet dans la
messagerie/le colis après une vente. Il faut donc d'abord **voir la forme** d'une
vente LBC et de son bordereau. Écrire un analyseur de bordereau LBC sans avoir vu
un seul email/réponse serait deviner (§4.10, §6.3).

**⇒ CE QUI DÉBLOQUE TOUT est UNE seule chose, et l'infra de collecte existe
DÉJÀ** (rien à coder ici — vérifié en relisant `lbc-inject.js`) : dès qu'il
**charge l'extension à jour** et **fait/regarde une vente sur Leboncoin**,
`lbc-inject` remonte automatiquement — `lbc_recon.paths` (tous les chemins vus,
ids → `{id}`), `lbcenvoi` (toute écriture POST/PUT/PATCH/DELETE, **chemins de
clés et types uniquement, jamais les valeurs**), et les réponses `annonces` /
`compte` (`lbcraw`). C'est exactement comme ça que le `PUT …/shipment/order` de
Vinted a été trouvé. **La prochaine passe, sur données réelles**, câble alors :
le lien paire ↔ annonce LBC (réf + compte), le « vendue ici → retire là » (les
deux sens — `status` active/inactive existe déjà dans `handleLbcRaw`), et la
capture du bordereau LBC. **On collecte, on vérifie, PUIS on promet** — pas
avant, et surtout pas depuis une donnée qui n'est même pas la sienne.

⚠️ **Il « ne peut pas encore charger l'extension »** : donc aucune version neuve
ne l'aide tant qu'il ne l'a pas installée, et l'app le dit déjà (diagnostic de
version, `EXT_ATTENDUE`). Le premier geste reste **remplacer le dossier de
l'extension par le zip livré** — c'est lui qui débloque la mesure, donc tout le
reste. Aucune raison de bumper la version ni de régénérer le zip pour cette
passe : rien n'a changé dans `vinted-sync-extension/`, c'est un constat, pas une
promesse neuve.

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

### ⚠️⚠️ « IL N'Y A QUE LA PHOTO DE COUVERTURE » — LE VRAI UPLOADER LEBONCOIN, ENFIN MESURÉ
Julien, 20 sept. (le dépôt va jusqu'au bout, sauf ça) : « il y a juste la photo
de couverture ». **Mesuré sur sa vraie base** (installé : **5.91**,
`panel_diag_capture.ver`) : le champ photo de l'étape dépôt (`lbc_recon.etapes`)
est **`multiple:true`** (`accept image/*,.heic,…`). Or seule 1 photo arrivait.
- L'ancien `attacherPhotos` avait deux voies : champ `multiple` → **envoi groupé**
  (`input.files = tous`) ; sinon → une par une. Le vrai uploader Leboncoin est
  `multiple` **mais** lit **UNE** photo par `change`, l'envoie au serveur, affiche
  la vignette **renvoyée (URL http)** et **vide** le champ. L'envoi groupé n'y
  dépose donc que la **couverture**.
- Pire, la voie groupée **se croyait finie** : elle comptait les vignettes
  `blob:`/`data:` (`apercusPhotos`) — or Leboncoin les rend en **http**, donc le
  compteur valait **0**, et le code retournait « tout attaché » (n = total). Le
  faux-vert classique (§ « vert sur le défaut »), et le bandeau annonçait « 3
  photos attachées » alors qu'il y en avait 1.
⇒ **Le signal fiable n'est PAS l'attribut `multiple`** — c'est de savoir si le
champ **GARDE** le fichier qu'on vient d'y poser. On pose la **1re** photo, puis :
  · le champ la garde (`input.files` rempli) → **champ contrôlé** → on pose tout
    d'un coup (un séquentiel le remplacerait par une seule) ;
  · le champ s'est vidé → **uploader « à chaque change »** → on continue **une par
    une**, sans jamais reposer la même (pas de doublon), en re-cherchant le champ
    à chaque fois. On pilote sur ce qu'on **POSE**, jamais sur un compteur de
    vignettes aveugle.
- **On ne PRÉTEND jamais plus que ce qu'on sait** : « confirmées » quand on peut
  compter (vignettes blob/data, ou fichiers gardés par un champ contrôlé) ; sinon
  le bandeau dit « **N photos envoyées — vérifie qu'elles y sont toutes** », pas un
  « X/Y attachées » invérifiable.
- ⚠️ **La CAPTURE reste ≤ 6 photos** tant qu'il n'a pas rouvert ses annonces
  Vinted avec la 5.87+ (mesuré : `vinted_item_details` = {1:14,3:1,4:5,5:38,6:60},
  jamais > 6). Même uploader parfait, il n'attachera que ce qui est capté : le
  bandeau le dit et renvoie rouvrir l'annonce Vinted.
- ⚠️ **Deuxième cause possible, non écartée** : le CDN Vinted peut refuser des
  liens périmés (`rates`) → moins d'octets, moins de photos. `attacherPhotos`
  renvoie `rates`, et la **sonde** `photoDiag` (lecture seule, aucun contenu :
  compte des vignettes blob/data/http/canvas/bg + `multiple` + envoyées/rates)
  est rangée dans `lbc_recon.photodiag` — le prochain dépôt tranchera (a) uploader
  vs (b) octets manquants, sans deviner.
- `bancs/leboncoin.cjs` sert le **vrai** uploader (`photosreel` : `multiple` +
  upload-à-chaque-change + vignettes **http**) : **§6.1 — sur le code d'avant
  1 vignette sur 3 et le bandeau ment « 3 attachées » ; après, 3 sur 3 et le
  bandeau dit « envoyées — vérifie ».** Le champ CONTRÔLÉ (`etape2`) garde l'envoi
  groupé (3 fichiers retenus). Extension en **5.94.0**, zip régénéré,
  `EXT_ATTENDUE` suivie. Aucune entrée d'`EXT_CAPACITES` (correction de fiabilité).
- ⚠️ **« La prochaine fois, dépose sans booster »** — c'est déjà le cas : le clic
  « Publier »/boost reste à lui (`BTN_PUBLIER` écarte publier/déposer/payer), et
  l'app ne le fait jamais toute seule.

### ⚠️ « CAPTE TOUTES LES PHOTOS EN PASSIF » — L'EXTENSION LIT LE DÉTAIL, SANS OUVRIR L'ANNONCE
Julien, 20 sept. : « je veux que ça capture toutes les photos en passif, dès que
j'ouvre Vinted, je veux pas aller sur l'annonce ». **Mesuré sur sa base** : la
liste du dressing (`harvest_{uid}_listings`, ce qui charge quand il ouvre Vinted)
ne porte, par annonce, que **la couverture** (`photo` = UN objet) + le **vrai
compte** (`nPhotos`, ex. 9). Le jeu complet ne vit **que** dans le détail de
l'annonce. Lire les photos « du DOM » (5.87) exige donc d'ouvrir chaque annonce —
exactement ce qu'il ne veut plus.
⇒ `capterPhotosAnnonces(uid)` (background) tourne à **chaque visite Vinted**,
après la moisson : il prend SES annonces **en ligne** (`harvest_{uid}_listings`)
dont `nPhotos > photos déjà captées`, et va lire `/api/v2/items/{id}` pour en
extraire **toutes** les photos (`saveItemDetail`). C'est une **lecture sur ses
propres annonces** (§3 l'autorise), la forme exacte de `capterRetraits` /
`capterReleves`, avec les **mêmes garde-fous** : compte connecté (`garde`),
**3 par visite**, une par une, pas de nouvel essai avant 24 h. En quelques
visites, tout se remplit **tout seul** — la pastille « X/Y photos » de l'écran
Annonces passe au vert sans qu'il ouvre rien.
- ⚠️ **L'endpoint de détail n'a jamais été observé d'ici (403).** `urlsPhotosDeItem`
  lit `item.photos[].full_size_url|url` **et**, si cette forme ne donne rien,
  balaie la réponse pour toute URL d'image `vinted.net` — puis note un diag
  (`photos_annonce_ecrit` / `_refuse_{status}` / `_vide`) + un échantillon des
  **clés** (jamais le corps). Si l'extraction rate, la prochaine visite me dira
  la vraie forme (*faire mesurer par ce qui y a accès*), sans deviner.
- **On n'écrit jamais moins qu'on a** (`saveItemDetail` ne remplace pas par du
  vide) ; une lecture ratée de `vinted_item_details` (`null`) ⇒ on ne rejoue pas.
- `scripts/audit-photos-passif.cjs` **exécute** le vrai `background.js` dans un
  `vm` : complète les annonces à qui il manque des photos (jeu **complet**, pas
  la couverture), **ignore** fermées / 1 photo / déjà complètes, **borne à 3**,
  s'arrête si `garde` refuse. **§6.1 prouvé en RÉAFFAIBLISSANT** (retirer le
  filtre « en ligne » ⇒ une annonce fermée est lue → le contrôle mord). **11
  contrôles.** ⚠️ §6.3 dans mon propre banc : le mock devait honorer la
  **projection** `items:data->payload->items` (sinon `rows[0].items` = undefined,
  0 photo sur un code intact) **et** la lecture-après-écriture.
- **Aucune entrée d'`EXT_CAPACITES`** : c'est de la CAPTURE (l'app ne promet rien
  de neuf, la pastille lit ce qui est là). Extension en **5.95.0**, zip régénéré,
  `EXT_ATTENDUE` suivie.

### ⚠️⚠️ « APPUIE SUR PUBLIER SANS BOOSTER » — AUTORISÉ, MAIS GATED SUR UNE MESURE (LE BOOST = DE L'ARGENT)
Julien, 20 sept. : « si tout est parfait dans l'app et la publication, je veux que
ce soit TOI qui appuies sur publier **sans booster**, ça me dérange pas du tout ».
C'est un **renversement de la règle** « publier reste manuel » — et c'est **SA
décision d'owner**, elle n'est pas à re-négocier. Mais elle a une condition qu'il
pose lui-même (« **si tout est parfait** ») et un risque unique dans tout le
projet : **le boost coûte de l'argent**.
**Mesuré** (`lbc_recon.etapes`) : le dépôt passe par une étape
`deposer-une-annonce/options` portant `gallery | gallery30 | daily_bump |
daily_bump30 | sub_toplist | urgent` — **les options PAYANTES**. « Publier sans
booster » = traverser cette étape en **ne cochant AUCUNE** option payante, puis
cliquer le publier **gratuit**. Or **je n'ai jamais vu** cette étape jusqu'au
bout (ses dépôts se sont arrêtés avant), ni le bouton final, ni s'il y a une
confirmation/paiement derrière.
⇒ **Écrire le clic « Publier » à l'aveugle à travers une page d'options payantes,
c'est risquer de cocher un boost — dépenser son argent. C'est le SEUL défaut pire
qu'un clic manuel.** Donc, fidèle à tout le dossier (*ne pas promettre / cliquer
ce qu'on n'a pas mesuré*) : **pas de clic automatique tant que je n'ai pas la
carte réelle de l'étape options + publication.**
- L'enregistreur d'étapes (`captureDepositForm`) capte DÉJÀ chaque étape, options
  comprise — **un seul dépôt mené jusqu'à « Publier » (à la main, gratuit)** me
  donne : les vrais libellés/état par défaut des toggles de boost, et le bouton
  de publication gratuite. **Ensuite** je câble le clic, **gaté** : ne cliquer le
  publier que si **zéro** option payante n'est active, **jamais** un bouton de
  boost/paiement (la garde `BTN_PUBLIER`/boost), et seulement quand les champs
  requis sont remplis. Prouvé au banc sur la vraie forme (comme le reste).
- ⚠️ **Ce n'est pas un refus** — c'est l'ordre correct : mesurer l'étape qui
  engage de l'argent AVANT de l'automatiser. Le clic « Continuer » entre étapes
  non-payantes est déjà automatique ; il ne reste que la dernière page.

### ⚠️ « QU'UN RESELLER QUI FASSE AUTRE CHOSE QUE DES CHAUSSURES PUISSE L'UTILISER »
Julien, 20 sept. La boutique est en sneakers, et plusieurs endroits étaient
**codés « chaussures »**. Ce qui CORROMPT un article non-chaussure (donc traité
en premier) et ce qui est resté sûr :
- ⚠️⚠️ **LE TITRE FORÇAIT UN SUFFIXE « T{taille} » — même sur une taille LETTRE.**
  `lbcTitre` faisait `' T' + taille` : une taille « M » sortait en « **TM** », « L »
  en « TL ». Mesuré au banc sur le code d'avant : « Nike sweat tech fleece gris
  **TM** ». ⇒ Le « T » n'est une **pointure** que pour un **nombre** : `estPointure`
  (`/^\d{1,2}([.,]\d)?$/`) → numérique = « T42 » · lettre = « M » telle quelle. Et
  l'extraction ne retire le « T » de tête que **devant un chiffre** (`^t(?=\d)` :
  « T40 »→« 40 », mais « TU »/« M » intacts). **La MÊME fonction vit dans l'app
  ET l'extension** (§11) — les deux corrigées à l'identique, `audit-places` exige
  qu'elles rendent le même titre (11 cas, dont 3 non-chaussures).
- ⚠️ **PLUS DE DÉFAUT « Chaussures » CODÉ EN DUR.** `lbcCategory` renvoyait
  `'Chaussures'` pour tout ce qu'aucun mot-clé ne reconnaissait — un reseller de
  vêtements aurait vu « Chaussures » proposée partout. Désormais : familles par
  mot-clé élargies (sacs, vêtements, accessoires, livres, **chaussures**), puis
  **pointure numérique 34–50** (ce qui garde l'auto-catégorie de SES sneakers,
  dont le titre ne dit pas « chaussure »), **sinon `''`** — Leboncoin propose la
  catégorie (il la devine du titre), l'utilisateur choisit. Une catégorie fausse
  fait plus de mal que pas de catégorie (§5, leçon eBay). Les **vêtements sont
  testés AVANT** la pointure (« jean taille 40 » = vêtement, pas du 40).
- ⚠️ **Le panneau ne coche plus « Chaussures » par défaut** : `choisirCategorie`
  et `choisirListe` avaient un repli `'Chaussures'` — retiré. Catégorie inconnue
  ⇒ on ne coche RIEN (l'utilisateur choisit), et le message dit « Choisis la
  catégorie » au lieu de « Vérifie la catégorie « » ».
- **Déjà GÉNÉRIQUE, vérifié** : `remplirComposants` choisit la taille par
  `/pointure|taille|size/` **exact-match** — donc une taille lettre « M » clique
  l'option « M » d'un menu Taille de vêtement, ou ne clique rien (jamais un
  faux). L'ÉTAT, la description structurée (Marque/Taille/État/Couleur), la
  référence `VRM-{n°}`, l'upload photo, eBay (qui réutilise `lbcTitre`) : tous
  indépendants de la catégorie.
- `audit-places.cjs` : **§6.1 prouvé** sur le build d'avant (« sweat … **TM** »,
  « polo … **TL** ») ; après, « … M » / « … L », et app == extension sur les cas
  non-chaussures. Extension **5.96.0**, zip régénéré, `EXT_ATTENDUE` suivie.
  Aucune entrée d'`EXT_CAPACITES` (généralisation, pas promesse neuve).
- ⚠️ **Ce qui reste chaussure-spécifique et MESURÉ tel quel** : `extraireTaille`
  du barème des prix d'achat (§« prix d'achat ») compare des pointures — c'est de
  la SUGGESTION interne, pas une publication, et ça ne casse rien pour un autre
  article (au pire 0 suggestion). Non touché, pas de risque.

### ⚠️⚠️ « L'EXTENSION FAIT TOUT » — PUBLIER SANS BOOSTER, ET UN SEUL BOUTON
Julien, 20 sept. : « est-ce que l'extension publie jusqu'à publier sans
booster ? enlève Tout préparer / Pré-remplir / machin, je veux juste que ce soit
téléversé sur le Bon Coin. Maintenant l'extension fait tout. » Deux volets.

**1. Auto-publication SANS booster — livrée, mesurée sûre.** Le dossier différait
ça sur le risque ARGENT (cocher un boost). **Mesuré** (`lbc_recon.etapes`) :
l'étape options ne porte que **6 CASES À COCHER de boost** (gallery, gallery30,
daily_bump, daily_bump30, sub_toplist, urgent) — inspectables — et la page
`/confirmation` prouve que la voie GRATUITE existe et se termine là.
⇒ `publierSansBooster()` (lbc.js) : **décoche toute option payante** ; s'il en
reste une cochée → **on NE publie pas** (on le dit) ; puis clique un bouton de
publication qui matche `publier|déposer mon/l'annonce|mettre en ligne|valider`
**et jamais** un bouton portant un PRIX (`€`, `9,90`, booster, remont, payer,
premium, pack, option). Bouton introuvable ⇒ rien de cliqué, il publie à la main.
- **Gaté sur SA main** : ne se déclenche que pour une paire lancée par le bouton
  (`pending.publier === true`, posé au clic), à l'**étape des boosts** (mesurée),
  et seulement si des **photos ont été envoyées** (sinon Leboncoin refuse). Une
  fois ; après succès, la paire sort de la file (`markPosted`) et `pending` est
  effacé — jamais deux publications.
- ⚠️ **Le clic « Publier » n'est plus interdit — c'est SA décision d'owner**,
  répétée. La garde `BTN_PUBLIER` de `cliquerContinuer` (enchaînement d'étapes)
  reste : on n'AVANCE que par « Continuer », et la publication est un geste
  séparé, borné à `publierSansBooster`.
- `bancs/leboncoin.cjs` : fixture `boost` (cases de boost + un bouton GRATUIT +
  un bouton PAYANT à 9,90 € placé AVANT). **Boosts tous décochés, bouton gratuit
  cliqué 1×, bouton payant JAMAIS.** §6.1 : en retirant la garde « prix », le
  bouton PAYANT est cliqué (`__paid=1`) — la garde protège de la dépense.

**2. Un seul bouton, plus de « machin ».** La carte n'a plus que **🚀 Publier sur
Leboncoin** (ouvre le dépôt + remplit tout + publie sans booster) et **✓ Je l'ai
déjà publiée**. Retirés : Pré-remplir, Titre, Description, Prix, ⬇️ Photos — le
remplissage est **automatique** sur la page de dépôt (`autoPrefill`). Le bandeau
du dépôt n'a plus « Re-remplir »/« Copier la description » ; il montre l'état et
un **↻ Reprendre** qui n'apparaît QUE si le remplissage cale (filet).
- ⚠️ Bancs mis à jour : le pré-remplissage se teste par la voie AUTO (`getPending`
  → la page se remplit seule), plus par un bouton disparu ; et une page de
  **recherche** n'est jamais auto-remplie (garde d'URL de `autoPrefill` — le prix
  n'atterrit pas dans un filtre). Le bouton « Publier » pose `publier:true`.
- Extension **5.97.0**, zip régénéré, `EXT_ATTENDUE` suivie. Aucune entrée
  d'`EXT_CAPACITES` : la publication est un geste du panneau (lbc.js), pas une
  promesse de l'app gatée sur une version.
- ⚠️ **CE QUE JE N'AI TOUJOURS PAS VU (403), et le filet posé pour ça** : le
  bouton de publication réel et l'après-clic (confirmation ? paiement ?). Le
  risque argent est neutralisé (boosts décochés + aucun bouton à prix cliqué), et
  au pire rien n'est cliqué. Si le libellé réel diffère de mes motifs, il publie
  à la main — jamais une dépense, jamais un faux. Le prochain vrai dépôt le
  confirmera.

### ⚠️ « LE BOUTON PUBLIER EST TOUT EN BAS, DEVINE-LE » + LE PANNEAU S'OUVRAIT TOUT SEUL
Julien, 20 sept. (après son dépôt) : « le clic publier sans booster, c'est pas
difficile, il est tout en bas de la page ; même si tu ne l'as pas, essaie de le
deviner » — et « arrête d'ouvrir le panneau à chaque fois que je lance Vinted,
laisse le bouton à droite ». Deux gestes qu'il a explicitement autorisés.
- **Deviner le bouton du bas** : `publierSansBooster` cherche d'abord un libellé
  « Publier/Déposer… » ; s'il n'en trouve pas, il prend le bouton **le plus bas**
  de l'étape. **La garde ARGENT ne bouge pas** : jamais un bouton à prix/boost
  (`PRIX`), jamais « annuler/retour/aperçu » (`NEG`), jamais « Continuer »
  (l'enchaînement des étapes s'en charge). Au pire rien n'est cliqué, jamais une
  dépense, jamais un faux.
  ⚠️⚠️ **ET LE BANC A ATTRAPÉ UN VRAI DÉFAUT** : le « plus bas » cliquait le
  bouton de **NOTRE PROPRE bandeau** (`#vrm-lbc-banner`, en position fixe tout en
  bas), pas celui de Leboncoin. `NOTRE_UI` exclut désormais notre bandeau/témoin/
  panneau du balayage. Le banc sert une étape finale SANS libellé « Publier »
  (bouton gratuit « Terminer » tout en bas, un bouton à 9,90 € et un « Annuler »
  au-dessus) : **Terminer cliqué, le payant JAMAIS, Annuler jamais**. Sans
  l'exclusion, `fin=0` (il cliquait le bandeau) — rouge.
- **Le panneau démarre FERMÉ** (`vinted-panel.js`, `let open = false`) : on ne
  restaure plus l'état ouvert d'une page à l'autre. Le bouton rond « VRM » à
  droite reste, c'est SON clic qui l'ouvre. Extension **5.98.0**, zip régénéré,
  `EXT_ATTENDUE` suivie. Aucune entrée d'`EXT_CAPACITES` (le geste est dans le
  panneau, pas une promesse de l'app).
- ⚠️ **Ce qui reste à mesurer chez lui** (dit à Julien, pas deviné) : (1) le
  **prix** qu'il a vu faux — le code pose le prix Vinted en centimes dans
  `price_cents` ; sans le couple (prix Vinted → prix affiché) je ne peux pas
  distinguer un bug de centimes d'un mauvais champ ; (2) les **photos ≤ 6** —
  c'est la capture qui plafonne tant qu'il n'a pas rouvert ses annonces Vinted
  avec l'extension à jour (la capture passive `capterPhotosAnnonces` les complète
  ensuite toute seule).

### ⚠️ « SUR QUELLE PLATEFORME EST CHAQUE PAIRE » + PAIRES QUI DORMENT (écran Annonces)
Julien, 20 sept. : « dans les annonces, dis sur quelle plateforme est chaque
paire » + « paires qui dorment ». **Le « paires qui dorment » existait déjà**
(`annStats.sleeping`, `SLEEP_DAYS=30`, tri « Qui dorment 😴 », bandeau,
assistant de baisse de prix) — on l'a **rendu visible par carte**, pas refait.
- **Sur quelle plateforme — ce qui est PROUVÉ seulement.** Pastille **« ✓ sur
  Leboncoin »** quand `vinted_lbc_posted.ids` contient `item.id` (l'id d'annonce
  Vinted, exactement ce que `markPosted` écrit → correspondance directe, §5,
  jamais par titre). Chargé comme `listingDates` ; **lecture ratée/vide ⇒ Set
  vide ⇒ aucune pastille** : on n'affirme JAMAIS « publiée » à tort (sous-affirmer
  ne trompe pas, une fausse pastille verte si). Rendu en pastille ardoise pleine
  (`C.text`/`C.card`) — **pas de nouvelle couleur** (§7 : une seule teinte
  d'accent ; pas de vert en dur).
- **Pastille « 😴 en ligne depuis X j »** sur les paires qui dorment (âge de
  `listedAgeDays`, la date de mise en ligne captée ; `null` ⇒ rien, on n'invente
  pas d'ancienneté, §5.34). Le chiffre, jamais la promesse.
- ⚠️⚠️ **« SUR QUEL COMPTE Leboncoin » RESTE MESURÉ IMPOSSIBLE** (§ « où est la
  paire »). `lbc_accounts` vide, `lbc_listings` = des annonces qui ne sont pas
  les siennes : tant que ses PROPRES annonces LBC ne sont pas captées (5.98 + une
  vraie visite « mes annonces » sur Leboncoin, forme à voir), l'app **n'affiche
  pas** le compte ni un « publiée » déduit d'une capture. La seule source
  honnête aujourd'hui est SA marque `vinted_lbc_posted`. *On collecte, on
  vérifie, PUIS on promet.* **Rien touché dans l'extension** cette passe (pas de
  bump, pas de zip) : ce serait du code spéculatif sur une donnée absente.
- `npm run build`, `verif_visuel` (annonces rendues aux deux tailles, aucun
  crash/blanc/débordement), `audit-chiffres/variables/boutons/icones` : verts.

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

### ⚠️⚠️ « UN TOUT PETIT ÉCRAN EN BAS À DROITE, LE LOGO DE L'APP » (3 octobre, 5.130)
Julien : « sur Vinted, Leboncoin, eBay, peu importe où, le nouveau logo en bas à
droite ; enlève l'ancien orange ; il ne doit pas y avoir d'informations autres
que les moyens de connexion, le compte utilisé, le compte connecté et si les
informations circulent bien ; tout doit être centralisé dans VRM ; dès que tu
appuies dessus, le site VRM s'ouvre ».
- **`vrm-badge.js`** sur Vinted, Leboncoin, eBay **et Vestiaire** : le logo de
  l'app (`logo-vrm-96.png`), shadow root FERMÉE. Survol : compte VRM utilisé,
  compte du site (cookie Vinted / dernier compte « moi » Leboncoin), et la
  circulation **mesurée aux écritures** (`vrmFlux`, `noterFlux`) — jamais
  supposée. Clic : connecté → VRM s'ouvre sur l'onglet de la plateforme ; sinon
  la connexion. Ambre **seulement** s'il y a un geste à faire ; « pas su » reste
  gris (aucun faux vert). Vestiaire : « VRM ne capte pas encore ce site ».
- ⚠️⚠️ **LE MOT DE PASSE VRM SE TAPAIT DANS LE DOM DE VINTED** (bulle du
  panneau, sans shadow root : les scripts du site pouvaient le lire). La
  connexion vit désormais dans un **iframe de l'extension**
  (`popup.html?mode=carte`) : ni le champ ni le clavier ne sont visibles du site.
- ⚠️ **L'email du compte VRM se perdait au premier renouvellement** de session :
  gardé, sinon lu dans la revendication `email` du JWT (une identité).
- ⚠️ **Une session VRM d'un autre compte adoptée dans ce Chrome** (mesuré le
  2 oct. : 18 lignes, dont 3 bordereaux, parties chez `julien.fournier3535@…`)
  est notée (`vrmBascule`) et la carte nomme **les deux** adresses pendant 7 j.
- **Panneaux retirés** : `vinted-panel.js` → `vinted-capture.js` (date,
  description, photos lues sur la page — la seule chose que rien d'autre ne
  faisait) ; `lbc.js` et `ebay.js` gardent relais, capture, enregistreur
  d'étapes, remplissage, publication sans booster (LBC) et leur bandeau de
  dépôt. ~1 600 lignes sans appelant retirées du fond (`buildPanelData`, récap
  plein écran, réglages du panneau).
- **Ce qui est passé dans l'app** : ~~l'interrupteur « accepter les offres
  au-dessus du plancher »~~ (⛔ retiré le 5 octobre avec l'acceptation
  automatique, voir §3 ; `vinted_offres_auto` reste synchronisé à `false` pour
  les extensions 5.130 à 5.150) ; le bouton **« Publier sur Leboncoin »** / « Préparer sur eBay »
  par paire (`publierDepuisApp` : l'app n'envoie qu'un IDENTIFIANT, la paire
  est relue dans la file de l'extension — vendue, décochée ou preuve illisible
  → refusée) ; « Déjà publiée » et la limite de l'offre (`lbcMarque`,
  `lbcQuota`). Grisés et jamais cachés quand l'extension ne peut pas, la raison
  dite UNE fois (`RaisonPublication`).
- Bordereau généré sans PDF : l'extension pose le **rendez-vous** et l'app
  propose « Ouvrir la vente sur Vinted » — le PDF téléchargé est relié à CETTE
  vente.
- ⚠️ **PERDU AVEC LE PANNEAU, À REFAIRE DANS L'APP S'IL LE DEMANDE** : les
  relances (57 personnes nommées), les offres tranchées au clic, le coffre,
  l'empreinte, le gabarit de description. Ne pas les rebrancher dans une page
  de site : c'est l'app qui pilote.
- Bancs : `badge.cjs` (32), `popup.cjs` (carte, 23), `publier.cjs` (rendu,
  3 états) ; audits `audit-extension-ui.cjs` (11 rouges sur l'avant),
  `audit-publier-app.cjs` (8 rouges sur l'avant). Retirés avec le panneau :
  `audit-panneau`, `audit-recap`, `audit-relances`, `banc-captation`,
  `banc-favoris`.

### ⚠️⚠️ « TOUTES MES VENTES FINALISÉES, PEU IMPORTE LA PLATEFORME » (3 octobre, 5.131)
Le CA mensuel déclaré, son registre et ses exports ne comptaient que **Vinted** ;
Leboncoin et eBay n'apparaissaient que dans un total « depuis le début », sans mois.
- **Une seule règle** : `ventesDeclarables({vinted, lbc, ebay, masquee})` →
  `{lignes, aDater, ecartees}`, puis `caDeclarableParMois` (total + `par`
  plateforme, les « dont » somment au total). `caUrssafParMois` n'est plus
  qu'une enveloppe (§11). Identité `plateforme:id`, jamais un titre ; une vente
  vue deux fois compte une fois.
- **Leboncoin** : vente PROUVÉE (`isSeller === true`), finalisée, prix **final
  du détail** en centimes. ⚠️ **AUCUNE vente Leboncoin ne portait sa date de
  vente** (`at` = heure de capture). L'extension 5.131 relève `created_at` de la
  liste v3 (`dateVenteLbc`), ne le réécrit jamais, et ne laisse plus le prix de
  la liste (total acheteur, mesuré 2928 contre 2500) écraser le prix final
  (`prixListe` à part). **Sans date ⇒ dans aucun mois** : « à dater », avec son
  montant, dit à côté du total. L'heure de capture serait une date fausse.
- **eBay** : commande `PAID`, en EUR, datée de `creationDate` ; une autre devise
  est écartée et comptée à part, jamais convertie au hasard.
- L'écran Ventes publie `vinted_urssaf_mois` avec `par`, `aDater` et `sources`
  (« pas su » ≠ « aucune vente ») ; le tableau de bord ne retombe **plus jamais**
  sur l'archive vide (sans publication : « — » et où ça se calcule). Le rapport
  mensuel (écran, CSV, PDF) porte les lignes Leboncoin/eBay avec leur
  plateforme, et dit la répartition, les sources illisibles, les ventes à dater
  et « Vestiaire : pas encore relié ».
- Audits : `audit-urssaf.cjs` exécute la règle sur les trois plateformes (2
  rouges sur l'avant), `audit-lbc-ventes.cjs` la date et le prix (3 rouges),
  banc `rapport.cjs` (8 rouges sur un build d'avant).
- **TRANCHÉ PAR JULIEN le 3 octobre** (ce qui était « à trancher ») :
  1. **Bilan et CA déclaré = les comptes SÉLECTIONNÉS.** Les comptes retirés de
     l'app n'y entrent pas (ils n'ont déjà plus de ventes dans la liste), et une
     vente d'un compte **exclu** (`acctOffOf`) n'entre dans **aucun** total — ni
     un mois, ni « à dater » (`ventesDeclarables({exclu})`, publication, rapport
     mensuel, bilan annuel). Une vente **masquée d'un ✕** reste du CA, comptée à
     part. ⚠️ **Ne plus lui parler des comptes retirés** : il l'a demandé, c'est
     réglé — aucun texte visible ne les nomme (vérifié).
  2. **Tous les comptes Vinted chargés par l'extension sont à lui.** Les comptes
     VRM créés le 2 octobre (`julien.fournier3535@…` et un second) étaient des
     **essais**. Mesuré : le second ne porte que sa ligne `main` ; le premier
     porte 18 lignes (`angeled92`, dont 3 bordereaux) — **toutes existent
     aussi chez lui**, rien n'est perdu. `angeled92` est donc déclaré chez deux
     propriétaires. Supprimer ces comptes d'essai est irréversible : **à faire
     sur sa demande**, pas avant.
  3. **eBay = « l'argent que tu reçois »** (dû au vendeur − frais eBay). ⚠️ **Une
     AUTRE session s'occupe d'eBay** (Julien, 3 octobre) : la règle a été codée
     ici puis **retirée** pour ne pas écrire deux fois les mêmes lignes. C'est à
     la session eBay de l'appliquer (`ventesDeclarables`, branche eBay, et le
     résumé eBay) — `paymentSummary.totalDueSeller − totalMarketplaceFee`, frais
     inconnus ou autre devise ⇒ commande écartée et dite, jamais comptée au
     hasard.
  4. Le bilan annuel compte désormais **Leboncoin et eBay** comme les mois
     (§11) ; il ne comptait que Vinted. `audit-urssaf.cjs` : 7 rouges sur
     l'avant.
  5. Reste ouvert : « Chiffre d'affaires » sur Ma journée et le widget compte
     les ventes EN COURS — c'est la demande « ventes du jour ≠ argent reçu ».

### ⚠️⚠️ « L'ÉCRAN ANNONCES, C'EST TOTALEMENT N'IMPORTE QUOI » (3 octobre, 5.132)
Julien : « on ne sait pas sur quelle application, c'est quoi le prix, le boost ».
Mesuré : 70 cartes sur 71 affichaient la **marque** (`it.brand||it.title`),
jamais le titre ; quatre montants dont deux sans libellé ; six teintes (dont
`#0F8A6A`, `#09B1BA` et l'orange Leboncoin en dur) ; le sommeil dit trois fois.
- **La carte** : photo 88×118, **prix** en grand, N° en encre neutre, **titre**
  sur deux lignes, taille · état, « Aussi sur **Leboncoin** » seulement si
  PROUVÉ (`vinted_lbc_posted`), puis une ligne de chiffres **tous libellés**
  (achat · boost · marge ; « — » si inconnu), vues/favoris/âge (« dort » une
  fois, en ambre), compte si plusieurs. Saisie N° + achat + « Vendue » en bas ;
  le reste dans « ⋯ » (plancher, boost payé, achat relié, ranger, passeport,
  baisser le prix, la FILE Leboncoin/eBay — distincte de la présence). L'en-tête
  dit « N en ligne sur Vinted · X aussi sur Leboncoin · Y boostées » UNE fois.
- ⚠️ **La pastille « prête pour Leboncoin » mentait par construction** : `item`
  était reconstruit avec 5 champs, donc `captPhotos` valait toujours 0 →
  « à capter » sur toutes les cartes. La carte lit l'annonce entière.
- ⚠️⚠️ **« Vendue — bordereau reçu » se décidait encore PAR TITRE** en repli
  (`bordForItem`), et ce même repli **retirait l'annonce des annonces en ligne**.
  Mesuré : 7 couples annonce/bordereau au titre identique, 0 même article ; 177
  des 178 bordereaux portent leur transaction. Désormais : N°, sinon
  transaction → annonce (`txnItem`), sinon rien. `audit-identite` le vérifie.
- **Boosts** : Vinted envoie `promoted` dans le dressing ; l'allègement le jetait.
  L'extension le garde (avec `can_push_up`) et la carte dit « Boostée » quand
  c'est `true` — rien quand c'est absent (pas su ≠ non). **Le MONTANT par paire
  reste impossible aujourd'hui** : aucune trace de boost en base (0 nœud dans les
  porte-monnaie, 0 email, 71 réponses « billing » jetées sans échantillon).
  L'extension relève désormais la FORME d'une réponse qui parle de boost (noms de
  clés seulement : `boost_vu`, `boost_forme` dans `panel_diag_capture`). **Ne
  rattacher un coût à une paire que si cette forme prouve un `item_id` et un
  montant par article** — sinon c'est un coût de compte, jamais réparti.
  En attendant, le champ « Boost payé » (⋯) entre dans la marge et le bénéfice.
- Les planchers posés dans l'ANCIEN panneau (`panel_min_prices`, que
  l'extension applique toujours) sont lus en repli et affichés (§11).
- Tri « À booster 💡 » renommé « Vues sans favoris » (deux sens pour 💡).
- Banc `annonces-carte.cjs` (titre, chiffres libellés, Boostée trois états,
  présence prouvée, sommeil une fois, préparation qui suit la donnée, vendue par
  identité, aucune couleur hors palette, 390 px sans débordement).

### ⚠️⚠️ « DATER LA VENTE À LA DATE DE RÉCEPTION D'ARGENT » (3 octobre, 5.133)
Julien : « il faut dater la vente pour le CA du mois à la date de réception
d'argent, c'est ça les ventes finalisées ». C'est la **réintroduction demandée**
de ce que §5 avait retiré (« ne pas la réintroduire sans qu'il le redemande ») —
il l'a redemandé.
- **La date** : celle où la transaction Vinted passe **« Commande finalisée »**
  (`harvest_{uid}_txn_{tx}` → `payload.transaction.status === 450`,
  `status_updated_at`). C'est le moment où l'argent est versé. Lue par
  `fetchVersementsVinted` en **trois scalaires** (§4.4), paginée (`lireTout`).
- **Mesuré avant de coder** : septembre **26 ventes finalisées sur 56** portaient
  déjà cette date (1 601 € sur 3 465 €), août 101/156, juillet 18/76, juin 1/62.
  Les autres n'avaient jamais eu leur détail relu APRÈS la finalisation.
- ⚠️⚠️ **Sans date de versement, une vente n'est dans AUCUN mois** : elle va dans
  « à dater » avec son montant, et l'écran le dit. Retomber sur la date de vente
  serait mettre un chiffre FAUX dans la déclaration (§5 : mieux vaut un blanc
  qu'un faux). Dates illisibles (`null`) ⇒ l'écran Ventes **ne publie rien**.
- **L'extension va chercher les dates** : `capterDatesVersement(uid)` à chaque
  visite Vinted, après la moisson — lecture de `/api/v2/transactions/{tx}` pour
  les ventes finalisées sans date, **5 par visite**, `garde`, pas de nouvel essai
  avant 24 h, rien si les lectures en base ont échoué ; elle prévient l'app
  (`evt maj versements`). Uniquement pour le compte connecté dans l'onglet : les
  dates des autres comptes arrivent quand il y passe.
- Leboncoin : daté au jour de la vente (sa date de versement n'est pas captée),
  et l'écran le dit. eBay : date de la commande payée.
- Les **deux rapports** (mensuel, annuel), la grille des mois déclarables et la
  carte URSSAF du tableau de bord suivent la même règle (`ventesDeclarables`).
  Le mot « encaissé » reste interdit (Leboncoin n'est pas daté au versement).
- `audit-urssaf.cjs` : **9 rouges** sur le code d'avant ; `audit-versement.cjs`
  exécute la vraie fonction (12 contrôles, réaffaiblie → rouge) ;
  `bancs/rapport.cjs` sert une vente vendue le mois dernier et versée ce mois.

### « J'ai déclaré ce mois » — le registre de ses déclarations URSSAF (6 octobre)
Proposition n° 13, acceptée le 5 octobre. Le passage au versement (3 octobre)
crée un risque mesuré : **30 ventes vendues en août et versées en septembre
(657,80 €)** — s'il a déclaré août à la date de vente, elles sont dans août ET
dans septembre (~89 € de cotisations payés deux fois, sans rien voir).
- `vrm_urssaf_declare` (synchronisé) = `{ [ym]: { ids, n, ca, montant, regle, at } }`,
  écrit **uniquement sur son clic** dans le rapport comptable (« J'ai déclaré ce
  mois » / « retirer »). L'app ne coche jamais « déclaré » à sa place.
- **Une vente déclarée compte dans le mois de sa déclaration, plus nulle part
  ailleurs** — par son identité `plateforme:id` (§5). Une vente d'un mois déclaré
  qui n'est dans **aucune** déclaration est « à régulariser » (comptée, dite,
  jamais cachée) ; une vente déclarée dans deux mois compte une fois et le dit ;
  le mois du versement dit ce qui est déjà déclaré ailleurs.
- Pour un mois ≤ septembre 2026, le formulaire écrit **les deux totaux côte à
  côte** (versement · date de vente, l'ancienne règle) et c'est LUI qui dit lequel
  il a déclaré ; le montant de son espace URSSAF, s'il le tape, est comparé.
- **« Pas su » ne déplace rien** : avant l'arrivée du nuage le registre vaut
  `null` (`isCloudReady` + `onCloudReady`), et l'écran le dit.
- §11 : le rapport mensuel et le bilan annuel refaisaient leur propre boucle
  Vinted — ils lisent maintenant `declarables`, comme le tableau de bord (une
  règle, un propriétaire). `audit-urssaf.cjs` suit le nom jusqu'à sa définition.
- Preuves : `audit-urssaf.cjs` **11 rouges** sur le code d'avant, **5** en
  réaffaiblissant la règle (le registre ignoré) ; banc `rapport.cjs` déroule le
  geste aux deux tailles (déclare août à la date de vente → septembre ne recompte
  plus la vente de fin août, et le dit).
- ⚠️ **À lui** : dire ce qu'il a réellement déclaré pour août et septembre — le
  geste est dans Ventes → Outils → Rapport comptable → choisir le mois.

**Revue contradictoire du 6 octobre — cinq défauts réels, tous dans ce registre**
(chacun vérifié en EXÉCUTANT le vrai code avant d'être corrigé) :
- ⚠️⚠️ **« À régulariser » ne regardait pas la RÈGLE de la déclaration.** Un mois
  noté « à la date de vente » ne retient que les ventes Vinted VENDUES ce mois-là
  (`ancienneRegle`) ; les ventes vendues le mois d'avant et versées ce mois-ci
  étaient dites « arrivées après ta déclaration — à ajouter (régularisation) ».
  Exécuté : les **30 ventes d'août versées en septembre (657,90 €)** — le cas même
  qui a motivé le registre, ~89 € payés deux fois en suivant le conseil.
  ⇒ `place()` : à la date de vente, une vente Vinted vendue un mois plus tôt
  relève de SON mois de vente (`moisVenteAvant`, dite à part : « rien à
  régulariser, note ce mois-là ») ; elle ne redevient « à régulariser » que si
  son mois de vente est noté SANS elle (elle n'est alors dans aucune déclaration).
  Et le libellé ne dit plus « arrivées après » (aucune date n'est comparée) mais
  « ne figure(nt) dans aucune de tes déclarations » — vrai dans les deux règles,
  et pour Leboncoin/eBay, que l'ancienne règle ne comptait pas.
- ⚠️⚠️ **Dates de versement illisibles ⇒ rapports à « 0,00 € · Aucune vente
  finalisée »**, présenté comme un fait, et Leboncoin/eBay (lus correctement)
  perdus avec ; le bilan annuel ne rendait pas `enCours` (« 0 € » pendant le
  simple chargement). ⇒ `declRapport` (une source pour les deux rapports) :
  `encours` · `passu` (Leboncoin et eBay comptés, « sans Vinted » dit, aucune
  cotisation ni marge chiffrée dessus — « — ») · `lu`. La publication et Ma
  journée gardent `declarables === null` (« pas su », rien de « reçu »). Les
  exports CSV/PDF emportent la mention.
- ⚠️⚠️ **« J'ai déclaré ce mois » s'enregistrait sur une lecture ratée** :
  `{ ids: [], n: 0, ca: 0 }` écrit (prouvé au banc), puis tout le mois « à
  régulariser ». `lectureIncomplete` (dates, ventes, un compte non lu hors comptes
  exclus, Leboncoin, eBay, registre) grise le bouton avec la raison **et** le
  GESTE refuse lui-même (`declarerMois`) — une lecture peut tomber formulaire
  ouvert ; il dit alors « rien n'est noté ».
- ⚠️ **« Reçu en {mois} » se jugeait au mois de DÉCLARATION** (`l.ym`) : une vente
  versée en octobre et déclarée en septembre en sortait, pendant que la barre
  « reçu » du jour la comptait — deux « reçu » sur un écran (§11). ⇒ `recuDuMois`
  (au mois du versement, la date des barres), et la phrase dessous dit « dont X €
  déjà dans ta déclaration de septembre ». La carte URSSAF du tableau de bord
  (« argent versé en octobre ») dit ce qui en est EXCLU parce que déclaré ailleurs
  (`nAilleurs`/`caAilleurs`/`ailleurs`, de la même ligne publiée) et lit
  `declare: 'pasSu'` (registre pas encore lu au calcul).
- Preuves : `audit-urssaf.cjs` **13 rouges** sur f53df91 ; bancs `rapport.cjs`
  **16 rouges** et `vendu-recu.cjs` **3 rouges** sur le build de f53df91. Et
  chaque règle réaffaiblie seule repasse au rouge (au banc ET à l'audit) :
  « absente ⇒ à régulariser » quelle que soit la règle (2 rouges au banc) · reçu
  au mois de déclaration (1) · dates illisibles non bloquantes (1 — le geste,
  lui, refuse encore : défense en profondeur) · garde du geste retirée (2, la
  déclaration vide est écrite) · rapports sans Leboncoin/eBay (3) · bilan annuel
  qui ne rend plus le chargement (1).

### Paires qui dorment, toutes plateformes (proposition 9, 6 octobre)
L'assistant « Repricing » (Annonces → Conseils & signalements) disait seulement
quoi baisser sur Vinted. Une paire qui dort y est souvent AUSSI en vente sur eBay
ou Leboncoin, à un autre prix.
- **eBay** : l'annonce de la paire est reconnue par son SKU `VRM-{n°}` (identité,
  §5 — une annonce eBay au même titre sans SKU ne déclenche rien ; deux annonces
  pour un même N° ⇒ aucune n'est touchée). La baisse conseillée est la MÊME en
  proportion que sur Vinted, jamais sous le prix d'achat, et se fait d'ici en un
  clic **confirmé** (`revise` → ReviseInventoryStatus). eBay refuse ⇒ la raison
  d'eBay est écrite, rien n'est marqué baissé.
- **Vinted** reste un lien (c'est lui qui baisse) ; **Leboncoin** : la ligne le
  dit (« baisse-la là-bas dans Mes annonces »), sans lien deviné.
- `ebay_listings` n'est lu que quand le panneau est ouvert (§4.4) ; illisible ⇒
  aucune baisse eBay proposée, et c'est écrit.
- Le bandeau « paires qui dorment » n'est plus en rouge (§7 : le rouge est pour
  deux paires sous un même numéro).
- Banc `annonces-carte.cjs` : la bonne annonce (SKU), le bon prix (60 → 53 €),
  rien avant la confirmation, une seule baisse, l'écran qui le dit.

### Repère d'achat par modèle (proposition 10, 6 octobre)
Ventes → Analyse de tes ventes → « Repère d'achat par modèle » : par modèle
reconnu dans le titre (`extractModel`), prix moyen de revente (ventes non
annulées, comptes exclus écartés) moins prix moyen d'achat (achats non annulés).
- ⚠️ **Un repère pour acheter, JAMAIS de la compta** : deux moyennes, pas la
  marge d'une paire ; aucune paire n'est reliée à un achat (§5) ; n'entre dans
  aucun total, rapport ni export — l'écran le dit.
- Moins de 3 ventes OU 3 achats d'un modèle ⇒ pas de ligne. Les achats ne sont
  lus qu'à l'ouverture du bloc ; illisibles ⇒ rien n'est calculé, et c'est dit.
- Mesuré chez lui le 5 octobre : Samba +4,60 € (47 achetées / 26 vendues),
  Spezial +20,60 €, Air Max 1 +29,10 €, XT-6 +39,30 €. Seules **8 de ses 401
  paires** ont un prix d'achat saisi : ce repère ne remplace pas la saisie.
- Banc `rapport.cjs` : Samba +20 € (l'annulée à 999 € écartée), Gazelle à une
  seule paire absente ; réaffaibli (annulée comptée) ⇒ rouge.

### Les offres reçues reviennent, en tête de Messages (proposition 6, 6 octobre)
Retirées de l'accueil (28 sept.) puis de la cloche (30 sept.) avec la promesse
d'un « onglet dédié » ; leur lecture avait disparu le 3 octobre. Mesuré : **37
offres en 14 jours, toutes connues par EMAIL** (`email_offer_*`) ; seules 3
conversations captées portent une offre en attente, et elles sont vieilles.
- Messages ouvre sur « N offres à trancher » : la règle `offresAtraiter` (compte,
  chronologie, titre non ambigu) écarte celles réglées par une vente, et **le
  dit** (« 1 autre déjà réglée par une vente, mise de côté »). « c'est fait »
  range une offre (`vinted_offers_done`, synchronisé, rattrapé par `onCloudReady`).
- Lecture des **14 derniers jours seulement, en scalaires** (`meta->>`, §4.4).
- ⚠️ **L'email ne porte aucun identifiant d'annonce** (0/518) : ni « ton prix »
  ni « la remise demandée » ne sont écrits — les tirer du titre serait le
  rapprochement interdit (§5). Le repère montré est celui du **modèle** (prix
  moyen de revente, au moins 3 ventes), dit comme tel.
- On y répond sur Vinted, sur le compte nommé (une ligne d'en-tête quand elles
  sont toutes sur le même, sur chaque ligne sinon — §7).
- Banc `messagerie.cjs` : l'offre récente seule (ni la vieille, ni la réglée),
  le repère du modèle, aucune remise inventée, « c'est fait » gardé ; règle
  retirée ⇒ 4 rouges. `audit-offres-titre.cjs` accepte la phrase en ternaire
  (vingt-septième cri au loup évité : la règle, pas l'orthographe).

### Retrait automatique d'eBay quand la paire est prouvée vendue sur Vinted (proposition 8, 6 octobre)
Accepté par Julien le 5 octobre. Avant, l'alerte « vendue sur Vinted → retire-la
d'eBay » proposait un clic confirmé ; maintenant il peut l'allumer pour que ça se
fasse tout seul. **Éteint par défaut** (`vrm_ebay_retrait_auto`, synchronisé,
rattrapé par `onCloudReady`), et allumer demande une confirmation.
- **La même règle que l'alerte** (`doublesVenteEbay`, §11) : SKU `VRM-{n°}` sur une
  annonce eBay active + vente Vinted **prouvée** (transaction → `item_id`, état qui
  ne la fait pas revenir). Une annonce sans SKU ne désigne rien (§5).
- **Rien ne part sur « pas su »** : ventes Vinted illisibles, annonces illisibles,
  réglage pas encore arrivé du nuage (`isCloudReady`) ⇒ aucun retrait. 5 retraits
  au plus par passage, une seule tentative par annonce et par ouverture.
- **Le serveur revérifie, il ne croit pas le navigateur** (`handleRetirer`, mode
  `auto:true`) : SKU de paire exigé ; le réglage relu **chez ce vendeur**
  (illisible ⇒ 503, éteint ⇒ 403) ; puis `GetItem` relit l'annonce et son SKU
  doit être celui attendu (sinon 409 `sku-change`, rien n'est retiré) — une
  annonce dont le SKU a été changé entre-temps n'est plus la même paire.
- **Ce qui part en son nom se relit** : journal `ebay_retraits_auto` (50 derniers,
  écrit seulement si sa lecture a réussi), affiché sous l'alerte eBay. La réponse
  dit `journal:false` si l'écriture a échoué.
- Preuves : `audit-ebay-route.cjs` 162 contrôles (dont 9 pour ce mode) ; banc
  `ebay-annonces.cjs` (allumé : retrait parti avec le bon SKU ; éteint ou preuve
  illisible : rien). Mutation « réglage ignoré par le serveur » ⇒ rouge.

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

### ⚠️⚠️ VITESSE POUR 1 000 VENDEURS : LA COLONNE `meta` (3 octobre, 5.134)
Mesuré dans `pg_stat_statements` : les requêtes les plus coûteuses (400 à
950 ms, des milliers d'appels) lisaient UN petit champ (statut, n° de
transaction, date de capture) dans des lignes de **29 Ko** (`txn_*`) ou
**100 à 200 Ko** (`email_bord_*`, `label_*` : le PDF). Postgres décompresse la
ligne ENTIÈRE pour en sortir un champ. Et deux écrans relisaient `capturedAt`
sur **les ~5 000 lignes** `harvest_*`.
- **`app_data.meta`**, rempli par un **déclencheur** à chaque écriture
  (`vrm_meta(id, data)`) : les scalaires de premier niveau ≤ 600 car., `_pdf`
  (la ligne porte un PDF), et pour `harvest_{uid}_txn_*` les champs de la
  transaction (`id, item_id, status, status_title, status_updated_at,
  ship_status_title`). Rattrapé sur les 5 959 lignes, **0 écart** avec `data`.
- **Toute lecture d'un petit champ passe par `meta->>`** (app, extension), et
  la présence d'un PDF se teste par `meta->>_pdf=eq.true` (pas
  `data->>pdfB64=not.is.null`, qui décompresse le PDF pour rien). Mesuré :
  transactions **2 140 → 8 ms**.
- RLS : `owner = (select auth.uid())` (identité évaluée une fois, recommandation
  Supabase) + index `(owner, id text_pattern_ops)`. Migration consignée dans
  `supabase/migrations/004-meta-et-rls-rapide.sql`.
- ⚠️ L'outil SQL de la session attend une **confirmation humaine** pour tout
  `DROP` : il expire sans rien dire. Les politiques en double (`tout_*`) restent
  donc en place (mêmes droits, coût négligeable désormais).
- Les bancs servent des lignes `{id, data}` : `scripts/bancs/_meta.cjs`
  (`metaVersData`) retraduit `meta->>k` vers le chemin d'origine, avec la MÊME
  règle que le SQL. Tous les bancs et audits à faux Supabase l'appliquent.
- La cloche lisait 3 lignes par compte **à la queue leu leu** : elles partent
  ensemble (lectures de NOTRE base, pas de Vinted).

### ⚠️⚠️ LA MESSAGERIE INTÉGRÉE REVIENT — IL L'A REDEMANDÉE (3 octobre, 5.135)
Julien : « il doit y avoir la messagerie intégrée des derniers comptes, avec la
possibilité de répondre et de faire l'offre ». Ça **remplace** sa demande de
septembre (« enlève les messages, mets juste qu'il y en a de nouveaux ») :
c'est lui qui la redemande, ce n'est pas un retour en arrière à corriger.
- **La liste** (`data-messagerie`) : toutes les conversations captées, tous
  comptes, **non lues d'abord**, le compte nommé sur chaque ligne (la liste
  mélange ses comptes — là, la ligne distingue). 40 puis « Voir plus ».
- **Le fil** s'ouvre au clic : moisson d'abord, sinon **l'extension le lit**
  (`GET /api/v2/conversations/{id}`, au nom du compte connecté dans Chrome),
  sinon le repli serveur d'avant.
- **Les offres** : `offreEnAttenteDe` (même règle que le moteur de l'extension :
  l'acheteur, la courante, statut 10, un montant, transaction + offre) →
  « Accepter » (**confirmation d'abord** : ça vend la paire) / « Refuser », et
  « Faire une offre » / « Contre-offre » sur la transaction du fil.
- Côté extension, `EXEC_PERMIS` s'élargit à **ces trois gestes et cette seule
  lecture** — rien d'autre (`audit-exec.cjs`, 12 contrôles : DELETE et variantes
  refusés, autre compte refusé). Tout passe par `executerPourApp` : origine de
  l'app, garde STRICTE, **dans la file Vinted** (une requête à la fois). Une
  LECTURE ne consomme pas le plafond de 20 actions/heure ; un geste, si.
- `EXT_CAPACITES.messagerie = '5.135.0'` : une extension plus ancienne ne voit
  **aucun bouton d'offre** (il ne pourrait pas marcher), et la raison est dite.
- Banc `messagerie.cjs` (rejoue le vrai dialogue du pont, deux tailles).

### « L'onglet Annonces est trop brouillon » (3 octobre)
Vu au rendu : huit pastilles encadrées en rang (lues comme huit choses à faire),
puis cinq blocs avant la première carte, et sur CHAQUE carte le N° et le prix
d'achat **écrits deux fois** (le texte, puis une ligne de champs de saisie).
- Les **chiffres** (en ligne, valeur, favoris, vues) sont une **ligne de texte
  neutre** (`data-ann-resume`) ; ne restent en pastilles que les **gestes**
  (sans N°, à recapturer, qui dorment, sans prix d'achat, Aide à la vente).
- Le N° et l'achat se **modifient en place** (`EnLigne` : le texte reste, un clic
  en fait un champ, Entrée enregistre, Échap annule). La ligne de saisie sous
  chaque carte est retirée ; « Marquer vendue » passe dans « ⋯ ».
- « Publier aussi ailleurs » tient sur une ligne (Leboncoin · eBay côte à côte).
- Banc `annonces-carte.cjs` : aucune saisie visible hors « ⋯ » au repos, et
  modifier « achat — » → « achat 30,00 € » pour de vrai (rouge sur l'avant).

### Numéros à lettres : B125, C123… (3 octobre, 5.137)
Demande du 2 octobre : « toutes les personnes n'utilisent pas les mêmes numéros :
des fois B125, C123 ; rends la chose adaptable ». Cartographie complète d'abord
(tout ce qui supposait un ENTIER), et trois défauts **critiques** trouvés :
- ⚠️⚠️ **un numéro à lettres n'était jamais brûlé** (`recordUsed` faisait
  `parseInt`) **et la numérotation automatique EFFAÇAIT du pool tout ce qui
  n'était pas un entier** en le réécrivant — « jamais réattribué » ne tenait pas ;
- ⚠️⚠️ **« b125 » et « B125 » étaient deux numéros** (comparaison de chaînes
  exactes) : deux paires, un carton, sans alerte ;
- ⚠️⚠️ **« VRM-B125 » se lisait « 125 »** dans l'extension (`/(\d{1,5})/`) : la
  paire N°125 — une AUTRE — sortait de la file Leboncoin comme « déjà en ligne »,
  et B125 était proposée une seconde fois.
Ce qui est en place :
- **Une identité** : `cleNum` (majuscules, sans espace ni tiret, « 007 » = « 7 »),
  la MÊME dans l'app et l'extension (`audit-numeros-lettres.cjs` compare leurs
  sorties). `NUM_OK` : des chiffres, ou 1 à 3 lettres puis des chiffres.
- **Le pool** garde un entier pour un numéro en chiffres (comme avant — tous les
  lecteurs le comprennent) et la clé texte pour un numéro à lettres
  (`entreePool`). `applyRenum` (injoignable) part désormais du pool existant.
- **La pose à la main** (`poserNumero`) juge par clé, refuse une forme invalide,
  et **demande** quand le numéro a déjà servi sans fiche (avant : repris sans un
  mot, y compris en chiffres).
- **Réglages → « Tes numéros de rangement »** : Chiffres (défaut, rien ne change)
  ou une série à lettre (B1, B2…). Ne porte que sur les **prochains** numéros
  (`prochainLibre`, `vrm_num_prefixe` synchronisé, rattrapé par `onCloudReady`).
  Avec une série, les champs N° ouvrent le clavier à lettres (`clavierNum`).
- Mesuré chez lui : **0 numéro à lettres, 0 zéro de tête** — rien ne change pour
  ses données. Extension **5.137.0**, zip régénéré, aucune entrée
  d'`EXT_CAPACITES` (l'app ne promet rien de neuf).
- Preuves sur le code d'avant : banc `numeros-lettres.cjs` **3 rouges** (B125 perdu
  du pool, « b125 » accepté sur le même carton, pas de série) ;
  `audit-numeros-lettres.cjs` **3 rouges** (« VRM-B125 » → `["125"]`).
- ⚠️ **Trouvé au passage** : trois lecteurs (Garage 3D « à ranger », la fiche
  par numéro, le sélecteur de paires à publier) testaient `Array.isArray(phys)`
  sur `vinted_nums_physiques`, publiée en `{ nums, at }` — toujours faux, donc
  le filtre « paires présentes » **n'a jamais joué** : le Garage 3D proposait de
  ranger tout l'historique. Une règle, `numsPresents()` ; l'audit refuse le motif.
- ⚠️ **Pas couvert, volontairement** : les piles du Garage 3D se numérotent en
  entiers (`pileNums`) ; une boîte seule accepte « B125 ». Les titres Vinted
  « n125 » restent lus en chiffres (c'est une suggestion, pas une identité).
  `api/email-inbound` ne lit pas « nB125 » dans un email.

### ⚠️⚠️⚠️ UNE RECONNEXION POUVAIT RENUMÉROTER SES CARTONS (3 octobre)
Trouvé en cartographiant la numérotation. Trois migrations « une seule fois »
d'août réécrivaient les numéros (`vinted_num_fix1` : purge de TOUS les numéros
auto ; `vinted_num_compact_v1` : renumérotation des annonces auto > 42 au plus
petit numéro libre, SANS regarder le pool ; `vinted_used_cleaned_v1` : pool
rétréci, déjà désactivé). Leur drapeau « déjà fait » vivait dans le
**navigateur** — et `authSignOut` efface tout `vinted_*`. Après une reconnexion
(ou sur un appareil neuf), le nuage remplissait le navigateur, l'onglet Vinted se
montait, et la migration **repartait** sur ses vraies données.
- **Prouvé** (`scripts/bancs/numeros-reconnexion.cjs`, aucune fixture) : sur le
  code d'avant, les numéros 50…54 repartaient au nuage en **1…5** — des numéros
  déjà écrits sur des cartons de paires passées. Mesuré chez lui : **401 numéros
  dont 384 auto**. Pas de dégât récent (1 seule annonce en ligne « auto ≤ 42 ») —
  c'était à une reconnexion près.
- Les trois sont **retirées**, pas « re-gardées » : leur travail est fait depuis
  août, et un numéro ne change JAMAIS tout seul (§5).
- ⚠️ **Règle** : aucune migration ne s'arme sur un drapeau du `localStorage` —
  il ne survit ni à une déconnexion ni à un autre appareil. Une migration de
  données appartient au serveur (SQL), une fois, avec une sauvegarde.
- Mesuré au passage, **laissé tel quel** : 13 numéros portés par plusieurs
  entrées (1…16), l'héritage connu d'août ; la détection de doublons de l'app
  (`conflitsNum`) les juge sur les paires PRÉSENTES.

- ⚠️⚠️ **ET ÇA S'EST PRODUIT — MESURÉ LE 8 OCTOBRE** (lecture seule, sauvegardes
  `sauvegarde.app_data_20260930` et `_20261002`) : **8 paires numérotées
  automatiquement le 29 septembre ont changé de numéro entre le 30 septembre et
  le 2 octobre**, `numberedAt` inchangé — la signature de la migration de
  compactage, avant son retrait du 3 octobre :
  543→266 · 544→267 · 545→268 (`3179807757`), 548→269 (`3170801262`),
  549→270 · 550→271 (`3171228253`), 551→276 · 552→285 (`24602614`).
  **266 à 285 étaient déjà dans le pool** : des numéros déjà écrits sur des
  cartons de paires passées. 6 des 8 sont encore en ligne ; aucune n'a de vente
  prouvée. **Rien n'a changé depuis le 2 octobre** (0 écart avec la base du
  8 octobre). ⇒ **Geste de Julien** : regarder le carton de ces 6 paires ; s'il
  porte 543…552, remettre ce numéro dans le champ N° (l'app demande une
  confirmation, le numéro étant déjà au pool). **Ne pas corriger sa base à sa
  place** : seul le carton dit quel numéro est le vrai.
### ⚠️⚠️⚠️ Anciens numéros en B — la remise à zéro (migration 013, 9-11 octobre)
Julien, 9 octobre : « tous les anciens numéros, tu les fais commencer par B1,
B2… on commence à partir de zéro à partir du moment où je recommence à
reposter ». 10 octobre : « j'ai tout supprimé et je reposte, regarde par
rapport à la DATE DE MISE EN LIGNE », puis : « les anciens c'est que les paires
vendues, car je vais tout republier — c'est pour ça que je veux de nouveaux
numéros ». **Ce sont SES décisions, pas des options à reproposer.**
- **La règle** : une annonce mise en ligne APRÈS la coupure T est NOUVELLE et
  reçoit 1, 2, 3… dans l'ordre de mise en ligne — même si c'est physiquement une
  paire qui avait un numéro (il réétiquette le carton). Tout le reste passe en
  « B + l'ancien » et ne sert plus qu'à l'HISTOIRE (ventes, compta, bordereaux,
  fiches des paires supprimées). **Un ancien numéro ne se redonne JAMAIS** — ni
  « B230 », ni « 230 » : ni par une vente, ni par une photo ou un dossier de
  photo, ni par la bannière ♻️, ni à la main.
- **La date de mise en ligne**, dans l'ordre (la migration ET l'app,
  `dateMiseEnLigneMs`, §11) : `created_at_ts` du dressing, l'heure de dépôt de
  la photo (`photo.high_resolution.timestamp`), `vinted_listing_dates`, puis
  (migration seulement) `numberedAt`. Une fiche numérotée avant T ne devient
  jamais nouvelle sur une date contraire (`contradictions`, compté).
- **La migration** (`supabase/migrations/013-anciens-numeros-en-b.sql`) ne
  convertit RIEN à l'installation. L'appel est à part : MESURE
  (`vrm_numerotation_mesurer`) → ESSAI ANNULÉ (`node
  scripts/renum-b/essai-annule.cjs --coupure=… > essai.sql`, qui rend le plan :
  chaque annonce jugée nouvelle avec sa date, sa source et si une capture la
  montre en ligne) → APPLICATION (`vrm_numerotation_archiver`, avec la mesure)
  → `vrm_numerotation_rattraper`. Retour arrière ciblé :
  `vrm_numerotation_annuler`, refusé dès qu'un numéro a bougé depuis.
  ⚠️ **Le choix de T** : une annonce mise en ligne après T puis supprimée
  prendrait quand même un numéro neuf — le plan le signale
  (`nouvellesPasEnLigne`). À regarder avant d'appliquer.
- **Le marqueur** `main.vrm_numerotation` = `{version, coupure, appliqueLe,
  archive, renum, lbcAnnonces, ebayAnnonces, annule?}` n'est écrit QUE par le
  serveur : le garde-fou de la base le recopie depuis la ligne d'avant, quoi
  qu'envoie un navigateur. `renum` = {numéro provisoire → nouveau} (les 553+
  donnés avant la migration) : un appareil qui réécrirait « 553 » sur une fiche
  devenue « 1 » est refusé (`vrm_numeros_perimes`).
- **Les garde-fous de la base** (écritures `authenticated`/`anon` seulement) :
  `vrm_pool_retreci` (le pool ne rétrécit jamais, même avant la coupure),
  `vrm_numeros_perimes` (B230 qui redevient 230, une clé B385 qui redevient
  385, le numéro provisoire qui revient), `vrm_fiche_perdue` (une fiche
  numérotée qui disparaît sans `repriseDe`), `vrm_garage_perime` (garage sans la
  version), `vrm_prefixe_archive` (« B » comme lettre des nouveaux numéros).
  Une saisie à la main datée d'après la conversion (`manuelAt`) passe.
- **L'app** lit le marqueur (`archiveNumeros`, `coupureNumerotation`,
  `versionNumerotation`) : la version est relue toutes les 60 s et au retour au
  premier plan ; la numérotation automatique n'agit que sur une version relue
  depuis moins de 3 min (`numerotationPermise`). Un refus nommé de la base, ou
  une version qui a changé, couvre l'écran (`BlocNumerosPerimes`) : « Recharger »
  met de côté ce qui a été tapé (prix d'achat, colis cochés…) et le rejoue par
  IDENTIFIANT après le rechargement — jamais les numéros.
- **Un « 230 » écrit AVANT la coupure désigne l'ANCIENNE paire** : le SKU d'une
  annonce eBay ou la référence d'une annonce Leboncoin qui le portaient à la
  coupure, une commande eBay passée avant T. Sans ça, la vente Vinted de la
  NOUVELLE 230 faisait retirer d'eBay l'annonce de l'ancienne (`numeroExterne`,
  la même règle dans l'app, `api/_lib/numerotation.js` et l'extension pour
  Leboncoin, `numeroLbcLu`). Le retrait eBay automatique relit le marqueur chez
  le serveur ; illisible ⇒ rien.
  ⚠️ Le marqueur garde, PAR ANNONCE, chaque numéro qu'elle portait à la coupure
  ET ce qu'il devient : `ebayAnnonces = { "<itemId>": { "553": "1", "12": "B12" } }`
  (même forme pour `lbcAnnonces`). Un numéro donné APRÈS T (provisoire, dans
  `renum`) suit SA paire ; un numéro donné à plusieurs paires nouvelles rend
  `''` (personne). Et on ne traduit que si l'annonce porte ENCORE ce numéro :
  un SKU réécrit après T (« Relier à une paire ») se lit tel quel.
- **Les emails** : après la conversion, le « nXXX » d'un TITRE n'est retenu que
  s'il désigne une fiche actuelle de la nouvelle série AU MÊME TITRE ; sinon il
  part dans `numeroTitre` (jamais tamponné). Le repli par titre ne rend jamais
  un numéro d'archive (`numeroDEmail`, serveur ; `numeroEmailAdmis`, app).
- Preuves : `audit-renum-b.cjs` (la migration EXÉCUTÉE sur un Postgres jetable,
  ~5 min, et l'essai annulé qui ne laisse rien) ; `audit-numerotation-lecteurs.cjs`
  (les règles de l'app, du serveur et de l'extension exécutées, 18 mutations) ;
  `audit-ebay-route.cjs` (le retrait automatique : 3 rouges sur le code d'avant).
- **Relecture du 11 octobre — seize défauts reproduits, corrigés** (chacun rouge
  sur d8c688b, vert après, rouge sous mutation) :
  - ⚠️⚠️ **le RETOUR ARRIÈRE était refusé sur SA forme réelle** : il n'a pas de
    ligne `ebay_brouillons` ; une ligne absente (NULL SQL) comparée au `null`
    JSON rangé par la conversion valait « des numéros ont bougé ».
    `vrm_proj_aucun` ramène absent / `null` / `[]` à une seule forme. Rejoué sur
    la PROJECTION de sa base (lecture seule du 11 octobre, Postgres 16 jetable) :
    avant « REFUSÉ (ebay_brouillons) », après il passe et `main`, emails et
    garage reviennent exactement.
  - ⚠️⚠️ **ses DEUX annonces eBay étaient lues « B553 » et « B559 »** (numéros
    provisoires du 10 octobre, devenus 1 et 7) : plus aucune paire, l'anti
    double vente coupé. Le marqueur par annonce (ci-dessus) les rend à 1 et 7,
    sur sa projection. « Relier » une annonce d'avant au MÊME chiffre est
    refusé (409 `numero-ambigu` : rien ne distinguerait plus la B22 de la 22) ;
    `publish`/`programmer` lisent le marqueur et refusent un écran d'une autre
    version de numérotation (409 `numerotation-perimee`, l'app envoie la sienne).
  - **3 ventes d'après T (564/565/568) n'avaient que leur BORDEREAU capté** :
    `harvest_{uid}_label_{tx}` (`meta.tx` → `meta.item`, la copie `label_latest`
    écartée, un `meta.tx` qui contredit sa ligne aussi) relie maintenant comme la
    transaction : sur sa projection 564/565/568 → **1/12/13**, comme leurs
    voisines. ⚠️ **À faire confirmer par Julien** : ces trois numéros étaient
    `autoShip` (tamponnés sur le bordereau expédié). Toutes les ventes d'après T
    suivent désormais leur paire — pas un mélange selon ce qui a été capté.
  - **Une ANCIENNE annonce encore en ligne vendue après T** recevait un numéro
    NEUF (la photo ET l'identité étaient jetées) : seule la photo l'est, Vinted
    (transaction → annonce) dit la paire, la vente garde « B7 ».
  - La mesure nomme les **comptes dont le dressing date d'avant T** (`dressings`,
    et `attention` dans l'essai) : le plan n'y voit aucune annonce republiée.
    Mesuré le 11 octobre à 12:15 : les 7 comptes recaptés, tomj683 et arthuror2
    compris.
  - Le rattrapage épargne un chiffre porté par une fiche ACTUELLE au même titre
    (la règle `numeroDuTitreApresCoupure`) ; le plan n'est calculé qu'UNE fois
    (`main` verrouillée ~6 s sur sa projection : **l'essai et l'application se
    lancent VRM fermé partout**).
  - App : « Retape son numéro » / « garde le N°B… » / ⧉ ne s'affichent plus à
    côté d'un numéro d'archive (« numéro neuf »), et la paire revenue sort de la
    liste quand elle est republiée (identité ou photo) ; Réglages n'enregistre
    plus de lettre au clic sur « Avec une lettre » et ne propose plus « B125 » ;
    le bloc relit la version au refus (« remise à zéro », jamais « un autre
    appareil » au hasard) ; une sauvegarde d'avant la remise à zéro est refusée
    AVANT d'écrire, avec la vraie cause ; effacer un N° garde la fiche ; les
    gestes d'un écran périmé se rejouent en DIFFÉRENCE (un colis décoché ailleurs
    ne redevient pas « posté »).
  - Preuves : `audit-renum-b.cjs` (126) et ses mutations ; `audit-numerotation-
    lecteurs.cjs` (38/38 mutations) ; `audit-ebay-route.cjs` (10 rouges sur
    d8c688b) ; banc `numeros-remise-a-zero.cjs` sections E-F-G (9 rouges sur le
    build de d8c688b) ; et un banc de rendu sur la projection de sa base convertie
    par la vraie migration (hors dépôt : vraies données), 18 rouges avant, 0 après.
- ⚠️ **Non mesuré** : la migration n'a JAMAIS tourné sur sa vraie base (données
  inventées à la forme des siennes). Une annonce republiée SANS date lisible ne
  se numérote pas toute seule (elle reste « sans N° »). Le « nXXX » d'un titre
  Vinted republié reste lu tel quel par la file Leboncoin de l'extension
  (`vintedKeys`) : ancien ou nouveau numéro, VRM ne peut pas le savoir.

- **Fusion du 11 octobre (après-midi)** : la numérotation corrigée (99fd0a7 : retour
  arrière sans `ebay_brouillons`, annonces eBay/LBC publiées après T sous un N°
  provisoire traduites par annonce, ventes d'après T reliées par leur bordereau
  capté, dressings figés signalés, rattrapage, fiche vidée gardée, plan calculé une
  fois, ancienne annonce vendue après T qui garde son B, `api/ebay` qui lit le
  marqueur) arrive sur une production où la **5.167.0** est déjà publiée : son code
  d'extension change (`numeroLbcLu`), donc **5.168.0**, zip régénéré,
  `EXT_ATTENDUE` suivie. Une version publiée ne change jamais de contenu.
  **Tranché à la place de Julien (il ne veut plus de questions)** : les ventes
  d'après T suivent leur paire (564/565/568 → 1/12/13, B564/B565/B568 restent au
  pool) ; relier une ancienne annonce eBay au nouveau numéro du même chiffre reste
  refusé (409 `numero-ambigu` : terminer et republier) ; une sauvegarde faite avant
  la remise à zéro ne se restaure plus.

- ✅ **APPLIQUÉE EN PRODUCTION LE 11 OCTOBRE À 14:58:07 UTC** (T = 2026-10-09T00:00:00Z,
  marqueur version 2). Ordre suivi : déploiement du serveur et de l'app qui
  lisent le marqueur (PR #472) → mesure (7 dressings relus le jour même, aucun
  avant T ; 24 nouvelles, toutes datées par la photo ; 0 contradiction ; les 6
  « pas en ligne » = 6 ventes) → essai ANNULÉ sur sa vraie base (7,2 s, rien
  restant, vérifié) → application en UNE transaction : mesure refaite, refus si
  l'empreinte md5 du plan diffère de celle de l'essai, conversion, garde-fous
  posés dans la même transaction → rattrapage (0 email). Résultat : pool
  558 B + 1…24 ; fiches 401 B + 24 ; ventes 503 B + 6 (1, 7, 9, 14, 16, 17 :
  nouvelles déjà vendues) ; eBay 128127336988 {553→1}, 128086452103 {559→10} ;
  ventes 571/572/573 sans identité → B571/B572/B573 (vendues, historique).
  ⚠️ **Comment c'est passé** : l'outil SQL ne prend pas de fichier, et 92 Ko d'un
  bloc ne passent pas. Les fonctions (sections 1 à 6, sans effet tant qu'on ne les
  appelle pas) ont été installées en 6 morceaux d'instructions entières
  (commentaires hors corps retirés), puis **chaque corps comparé par md5(prosrc)**
  à celui du fichier : 28/28 identiques. Les deux `drop trigger if exists` ont été
  retirés (déclencheurs absents, et un DROP attend une confirmation humaine dans
  l'outil). Retour arrière : `sauvegarde.vrm_numerotation_annuler(owner)` (125
  copies prises), refusé dès qu'un numéro a bougé.

### La mémoire de l'agent eBay : migration 014 (chantier K3, 11 octobre) — PAS ENCORE APPLIQUÉE
Premier morceau de l'agent eBay « VRM fermé » (spécification `spec-finale.md`
§5.1-5.2, K3). Julien ne voit rien. **Aucune horloge** (ni `pg_cron` ni `pg_net` :
c'est la 015, sur son oui), **aucun DROP**, rien qui tourne : des tables vides et
`vrm_reglages.agent_ebay = '0'`. Fichier : `supabase/migrations/014-agent.sql`.
- **Les garanties vivent dans la base, face à tout appelant de l'API** (navigateur,
  clé de service, route boguée) : 16 tables, 21 fonctions (`SECURITY DEFINER`,
  `search_path` vide, exécutables par `service_role` SEULEMENT) et 3 aides
  internes exécutables par PERSONNE (`vrm_agent_heure`, `vrm_agent_efface`,
  `vrm_agent_sans_acheteur`). Même la clé de service n'écrit la file, les
  commandes, le journal, les compteurs, les mémos, les titulaires, l'index, les
  preuves, l'horloge, les pierres tombales et les marques **que par leurs
  fonctions** (ni INSERT, ni UPDATE, ni DELETE, ni TRUNCATE direct). Elle écrit
  directement : `vrm_agent_vendeurs` (réglages versionnés, pouls), `vrm_agent_vus`
  (insertion), `vrm_agent_routes`, `vrm_ebay_cles_publiques`, `vrm_coffre`.
  ⚠️ **Le propriétaire des tables** (`postgres`, celui de l'outil SQL) garde, par
  construction, le moyen de défaire n'importe quelle garde (désactiver un
  déclencheur, accorder un droit) : aucune garde en base ne tient face à lui.
  C'est `--verifier` qui voit qu'une garde a été touchée.
- **Le navigateur** lit SES lignes de `vrm_agent_vendeurs`, `_commandes`,
  `_journal` (avec la restrictive `abonnement_requis` : qui ne paie plus ne voit
  plus rien), n'écrit RIEN (TRUNCATE compris), ne lit rien d'autre ; `anon` ne lit
  rien du tout. ⚠️ Mesuré le 11 octobre : les droits par défaut du schéma public
  ouvrent toute table neuve en entier à anon et authenticated — la migration les
  retire tous.
- **L'heure** : le temps est un paramètre (`p_maintenant`) pour le banc de vie sur
  horloge simulée (K5) — et pour lui SEUL. Sans la variable de session
  `vrm.horloge_simulee = '1'` (que l'API ne sait pas poser ; un banc la pose par
  `set`, ou `PGOPTIONS='-c vrm.horloge_simulee=1'`), c'est `now()` du serveur
  qui compte, quoi que dise l'appelant. ⚠️ **Le banc de vie de K5 DOIT poser cette
  variable**, sinon ses heures simulées sont ignorées.
  **Les durées et échéances reçues sont BORNÉES en base** (revue 2) : un bail de
  plus de 600 s est REFUSÉ (`prendre` ne prend rien, `prendre_cle` rend false) —
  120 000 « secondes » qui étaient des millisecondes gelaient un compte eBay
  33 h 20, et `prendre_cle(…, 2147483647)` posait un bail jusqu'en 2094 ; une
  prochaine fois (`rendre`) ou une sonnette (`planifier`) à plus d'un an est
  refusée (false / NULL) — « dans 15 min » en millisecondes rangeait la veille
  en l'an 58 748, et le secours ne la recréait pas (elle n'était pas
  « manquante »). Refusé, jamais réduit en silence : la tâche reste tenue et
  revient à la fin de son bail (≤ 10 min).
- **La file** : `vrm_agent_prendre` choisit ses candidats EN SQL (une tâche par
  compte libre, quatre par vendeur, la plus en retard d'abord) puis en prend ≤ 2
  par vendeur et ≤ 1 par compte eBay : un arriéré de 250 tâches sur un compte
  n'affame plus personne. **Un compte eBay n'a jamais deux tâches en vol,
  battements ET clics confondus** : `vrm_agent_prendre_cle` (le clic, ⇒ 409)
  refuse une tâche tenue ET un compte dont une autre tâche est en vol, sous le
  même verrou consultatif que `prendre`. `vrm_agent_rendre` ne rend qu'avec SON
  jeton, ne RETIRE la tâche que sur un « fini » explicite (`p_fini`) sans échec ;
  « pas de prochaine fois » sans « fini », ou un échec, la garde 15 min (« pas
  su » ne détruit jamais une tâche) ; la raison est un CODE (sinon
  `raison-illisible`). Une sonnette arrivée pendant le bail — même EXPIRÉ mais pas
  encore repris (un appel lent) — n'est jamais perdue (`reveil`).
- **Une commande** : `vrm_agent_ecrire_commande(owner, jeton, compte, commande,
  version_lue, colonnes, plateforme, maintenant)` — la tâche qui la tient est
  DÉRIVÉE (`{plateforme}:{compte}:cmd:{commande}`), jamais reçue. Modifier exige
  le bail de CETTE tâche (la veille d'un compte ne réécrit plus une commande
  qu'un clic achète) ; créer, le bail d'une tâche de ce vendeur et de CE compte
  eBay. Version ET bail (FOR SHARE), sinon 0 ligne ; le rang ne descend jamais
  (`vrm_rang_descend`, dit).
- **R18 en base, sur ce qui a une FORME** : des codes (`etape`, `voie`,
  `transporteur`, `suivi`, `numero`, `raison`, `ref`, `source`…), des NOMS de clés
  `shipTo` d'eBay seulement dans `cles_shipto` (liste blanche : « Dupont »,
  « Cancale » sont refusés), aucune clé d'acheteur ni d'adresse à aucune
  profondeur, et aucune adresse email, dans `data`, `en_cours` et `defaire`
  (`vrm_agent_sans_acheteur`) ; la ville d'un devis reste permise (effacée avec
  lui). ⚠️ Le TEXTE d'un message (journal, `texte`) est libre : son contrôle (R13)
  reste au code (K13).
- `vrm_agent_premiere_fois` : les clés `achat:`, `msg:`, `eval:`, `offre:` sont
  GLOBALES (propriétaire neutre, quel que soit l'appelant) [S5], mémos ≥ 100 jours
  [S25]. `vrm_agent_reserver` : `ceil(TTC × 1,15)`, jour de Paris, plafond NULL ⇒
  refusé ; `vrm_agent_rendre_reservation` une seule fois ; la purge ne touche
  JAMAIS un compteur du mois en cours ni du mois précédent (ce sont des plafonds
  d'argent). `vrm_agent_quota` : confort 60 %, détection 80 %, obligations 100 %,
  1 % par compte — et un vendeur inconnu (NULL) est refusé hors obligation.
- **Titulaires et index** : un compte eBay, un vendeur ; un libellé de compte est
  unique chez un vendeur (il nomme ses tâches) ; quand il change, l'index des
  annonces le SUIT ; libérer retire TOUT l'index de ce compte ; seul le titulaire
  indexe, et une ligne laissée par un vendeur qui ne l'est plus est reprise.
  Preuve vue (heure jamais déplacée), horloge à `-infinity` [D14].
- **Le journal** : une seule réécriture, `vrm_agent_anonymiser_journal` (R19), qui
  retire le texte, la référence ET le « défaire » d'une entrée. Toute autre
  modification, suppression ou vidage est refusé (même au propriétaire de la
  table, par une écriture ordinaire) ; la purge et l'effacement d'un vendeur
  passent par une MARQUE de transaction (`vrm_agent_marques`, clé
  `txid_current()`) — une variable de session ne l'ouvre plus.
- **« Fermer mon compte » est SÉRIALISÉ avec chaque écrivain du vendeur** (revue 2,
  le 12 octobre). La pierre tombale n'était visible qu'au COMMIT de l'effacement :
  une sonnette (`planifier`), une ligne de journal (le texte de l'acheteur
  compris), un compteur de quota ou une écriture directe faits PENDANT ces
  quelques secondes survivaient, « Fermer mon compte » rendait « fait », et une
  tâche orpheline faisait LEVER `vrm_agent_prendre` pour TOUS les vendeurs, à
  chaque battement (reproduit en Postgres 16.14 et 17.6). ⇒ Un verrou consultatif
  par vendeur (`hashtext('vrm_agent_vendeur')`, `hashtext(owner)`) : EXCLUSIF en
  tête de `vrm_agent_effacer_vendeur`, PARTAGÉ dans `vrm_agent_efface` (passée en
  plpgsql **VOLATILE** : la relecture qui suit le verrou voit ce qui a été validé
  pendant l'attente — `--verifier` contrôle la volatilité), que TOUTES les
  fonctions qui écrivent appellent EN TÊTE (avant tout verrou de ligne : aucun
  interblocage ; `rendre`, `rendre_reservation` et `anonymiser_journal` l'ont
  désormais aussi), et que le déclencheur de la pierre tombale prend pour une
  NOUVELLE ligne (INSERT, ou UPDATE qui change le propriétaire — un UPDATE d'une
  ligne existante ne crée rien qu'un effacement ne voie, il ne relit que la
  pierre tombale validée, sans verrou). Un écrivain en vol finit avant
  l'effacement et ses lignes partent avec le reste ; un écrivain qui arrive
  pendant attend, puis voit la pierre tombale. `vrm_agent_prendre` ÉCARTE les
  vendeurs effacés de ses candidats et saute sans attendre un vendeur en cours
  d'effacement : une ligne restée à leur nom ne lève plus jamais pour les
  autres. ⚠️ **READ COMMITTED exigé** (le défaut de PostgREST et de Supabase) :
  sous REPEATABLE READ la pierre tombale serait relue sur un instantané d'avant
  le verrou — l'écriture et l'effacement y sont refusés (`vrm_agent_isolation`).
  ⚠️ Un écrivain tenu ouvert retarde « Fermer mon compte » d'autant (un appel
  PostgREST = une transaction courte).
- **« Fermer mon compte »** : `vrm_agent_effacer_vendeur(owner)` efface les 12
  tables qui portent son nom (coffre, commandes, preuves, index compris) et les
  quotas par compte qui le nomment sous le neutre, et pose d'ABORD une **pierre
  tombale** (`vrm_agent_effaces`) : plus aucune ligne ne s'écrit à son nom, ni par
  une fonction (un battement en vol), ni par une écriture directe du serveur
  (déclencheur `vrm_agent_pierre_tombale`, `vrm_vendeur_efface`). ⚠️ **À brancher
  dans `api/compte.js`** par le premier chantier qui écrit dans ces tables
  (aucune suppression directe ne passe). La purge (`vrm_agent_purger`, par la
  015) : vus 14 j, mémos à échéance, compteurs 400 j hors mois courant et
  précédent, journal 13 mois, commandes closes compactées à 90 j, et
  `cron.job_run_details` > 7 j **sans jamais faire échouer le reste**.
- **La forme** : `create table if not exists` sautait en silence une table d'une
  version plus ancienne ; une EMPREINTE (colonnes, types, NOT NULL, et chaque
  contrainte : son NOM **et** les 12 premiers hexadécimaux du md5 de son TEXTE,
  `pg_get_constraintdef` sans « public. ») dans le fichier fait tout refuser
  (`vrm_agent_forme`, le `detail` donne la valeur trouvée et le texte des
  contraintes en place), rien n'est installé. ⚠️ Revue 2 : le NOM seul ne
  suffisait pas — une table d'avant dont la contrainte R18 du même nom valait
  `check (true)` était réutilisée en silence (et la 014 corrigée, réappliquée,
  l'aurait gardée), puis une commande rangeait le nom et l'email de l'acheteur.
  L'empreinte est mesurée identique en Postgres 16.14 et 17.6 ; changer une
  contrainte change son empreinte (l'installation neuve de l'audit refuse et
  donne la nouvelle valeur, à recopier).
- **La garde `ebay_tokens*`** sur `app_data` : un navigateur (`auth.role()` ou rôle
  courant) ne peut ni créer, ni réécrire, ni effacer, ni renommer une ligne de
  jeton eBay (`vrm_ebay_tokens_serveur`). Mesuré : seule la route serveur l'écrit (aucun
  écrivain dans l'app ni l'extension ; en base, une ligne, celle du propriétaire).
  ⚠️ Sur la base d'aujourd'hui, un vendeur connecté PEUT réécrire sa ligne
  `ebay_tokens` (prouvé au banc sur l'avant).
- **Preuves** : `scripts/audit-agent-sql.cjs` — la migration EXÉCUTÉE sur un
  Postgres jetable qui imite la production (`postgres` NON superutilisateur,
  droits par défaut, 005-007 ET 013 appliquées telles quelles,
  `scripts/agent-sql/supabase-min.sql`) : **221 contrôles** (193 avant la revue
  2). **Revue 2 (12 octobre)** : sur l'arbre de 9dcd405 (l'audit copié dedans,
  lancé depuis lui, §6.1) **21 rouges sur 221** ; `--prouve` **79/79** — les 66
  d'avant et 13 de plus : effacement sans verrou exclusif, écrivains sans verrou
  partagé, pierre tombale STABLE, déclencheur sans verrou, quota qui revérifie
  après ses verrous, `prendre` qui n'écarte plus les effacés, isolation ignorée,
  bail non borné, prochaine fois non bornée, forme aux seuls noms, vérification
  aveugle à la définition des déclencheurs, aux droits de colonne, à la
  volatilité. ⚠️ **Les courses sont jouées sur un ÉTAT observé**, jamais sur un
  délai : l'effacement (ou l'écrivain) tient sa transaction ouverte APRÈS son
  travail (`pg_sleep`), et l'autre partie n'est lancée qu'une fois cette fenêtre
  vue dans `pg_stat_activity` (ou l'appel vu en attente d'un verrou) — sous la
  charge de `--prouve` (quatre audits à la fois), un délai fixe laissait le
  contrôle vacant. ⚠️ Premier jet du contrôle « ligne orpheline » : posée sur un
  compte dont une autre tâche était en vol, elle n'était jamais candidate —
  vert sur le défaut ; elle est posée sur un compte LIBRE. ⚠️ Et la nouvelle
  empreinte a d'abord AFFAIBLI quatre preuves : les mutations R18 (noms de clés,
  data, codes, référence du journal) changent le TEXTE d'une contrainte, donc
  son empreinte — la forme refusait l'installation de la migration mutée, et
  elles passaient au rouge pour une MAUVAISE raison (« vrm_agent_forme », 70
  contrôles), sans prouver que le contrôle R18 mord. L'audit recalcule
  l'empreinte de la migration mutée (`contraintes: true`) : c'est le contrôle
  R18 qui tombe (1 à 2 rouges chacune). *Une mutation se juge sur la RAISON
  de son rouge, pas sur son nombre.* Sur l'arbre de
  59edcdd (l'audit copié dedans, lancé depuis lui, §6.1) : **48 rouges sur
  172**. `--prouve` : **66/66 mutations** au rouge — les 27 d'avant et 39 pour la
  revue du 11 octobre au soir (24 constats, deux relecteurs) : bail de commande
  quelconque, création sous un autre compte, rang qui descend, sans FOR SHARE,
  heure reçue, « at » reçu au journal, sans pierre tombale, quotas, coffre,
  commandes, preuves ou index oubliés à l'effacement, vérification aveugle aux
  déclencheurs, aux droits ou aux fonctions, forme ignorée, R18 (noms de clés,
  data, codes, référence du journal), anonymisation du seul texte, raison
  brute, « pas su » qui efface, réveil sous bail expiré, clic qui ignore le
  compte en vol, fenêtre brute, quota sans vendeur, index sous l'ancien libellé
  ou gardé à la libération, indexation sans être titulaire, ligne périmée
  jamais reprise, journal ouvert par une variable, compteurs à 1 jour, mois en
  cours purgé, purge de pg_cron sans filet, TRUNCATE au navigateur, INSERT et
  TRUNCATE au serveur, garde des jetons aveugle au rôle courant.
  ⚠️ Les relectures avaient trouvé **dix mutations VERTES** sur l'audit de
  59edcdd (TRUNCATE et INSERT jamais essayés, 5 tables sur 12 vérifiées à
  l'effacement, purge des compteurs et FOR SHARE jamais exercés…) et un contrôle
  R18 vert sur une forme qui arrangeait (deux valeurs à espace) : un contrôle de
  refus exige désormais le refus PAR LA CONTRAINTE — une erreur d'appel n'en est
  pas un (vacant sinon sur le code d'avant, §6.3).
- **Application (session principale)** : `node scripts/agent-sql/essai-annule.cjs >
  essai.sql` (~67 Ko, indentation et commentaires retirés, ROLLBACK, ne laisse
  rien — vérifié), puis la migration, puis `--verifier` : lecture seule, `ok`
  et `ecarts` ; elle regarde la forme de chaque table (et le TEXTE de chaque
  contrainte, par la MÊME expression que le bloc 1c, relue dans le fichier), RLS
  activé ET forcé, les droits EXACTS d'anon, authenticated et service_role (dont
  TRUNCATE, et MAINTAIN en Postgres 17) et AUCUN droit de COLONNE
  (`droits_colonnes`), la séquence, les règles et leur texte, chaque fonction
  (une seule version, SECURITY DEFINER, search_path et VOLATILITÉ du fichier,
  corps md5, qui l'exécute), chaque déclencheur présent ET actif AVEC sa
  définition (moment, évènements, ligne/instruction, condition WHEN normalisée,
  aucun `UPDATE OF`, aucun argument), l'horloge, le réglage, aucune marque qui
  traîne, aucune horloge simulée posée sur la base ou un rôle. ⚠️ Celle de
  59edcdd rendait `ok = true` avec les gardes suspendues, une restrictive
  retirée, une fonction en SECURITY INVOKER, FORCE RLS retiré, le coffre lisible
  par le navigateur ; celle de 9dcd405 avec une garde affaiblie sous le MÊME nom
  (la garde des jetons recréée `when (false)` — un navigateur réécrivait le jeton
  eBay —, la garde du journal pour UPDATE seulement, la pierre tombale de la file
  pour INSERT seulement, `vrm_agent_commandes_data` et les 100 jours des mémos en
  `check (true)`, `grant insert (…)` ou `grant update (bail_jeton, bail_jusqua)`
  au serveur — reproduits) : l'audit en sert maintenant **28 dénaturations** et
  exige `ok = false` et la bonne partie nommée. Si l'outil SQL refuse le bloc :
  `--morceaux --dossier=…` (18,6 · 36,3 · 7,5 Ko, trois transactions dans
  l'ordre, chaque objet né fermé — vérifié), puis `--verifier`.
- **Mesuré en production le 11 octobre au soir** (lecture seule du catalogue) :
  Postgres 17.6, 0 table et 0 fonction de l'agent, aucun réglage `vrm.*` posé sur
  la base ou un rôle, ni `pg_cron` ni `pg_net`, déclencheurs d'`app_data` =
  ceux du socle du banc (`vrm_garde_garage`, `vrm_garde_numeros`, `vrm_meta_maj`,
  `vrm_noter_ecriture`).
- **Non mesuré** : jamais appliquée sur sa vraie base ; que l'outil SQL accepte
  ~67 Ko d'un bloc (la 013 à 92 Ko ne passait pas) ; la durée du verrou posé sur
  `app_data` par les déclencheurs en production (`lock_timeout` 3 s). **Le banc
  n'est pas la production** : Postgres 16 au banc contre 17.6 en production. ⚠️
  Revue 2 : l'audit ENTIER a aussi tourné sur un 17.6 « vanilla » (binaires
  `@embedded-postgres/linux-x64@17.6.0-beta.15`, `PG_BIN=…`) — **221 contrôles,
  0 au rouge** (MAINTAIN, texte des règles, empreinte des contraintes, WHEN des
  déclencheurs compris) ; pas sur le 17.6 de Supabase lui-même ; la purge de `cron.job_run_details` n'a tourné que sur une table
  À LA FORME de Supabase (droits de `postgres` supposés : pg_cron n'est pas
  installé en production) ; l'empreinte du texte des contraintes et la
  normalisation des conditions WHEN sont mesurées identiques en 16.14 et en 17.6
  « vanilla » (binaires embarqués), pas sur le 17.6 de Supabase — un écart de mise
  en forme ferait REFUSER l'installation (`vrm_agent_forme`) ou rendrait
  `ok = false` : le sens sûr, jamais un feu vert. Une montée de version majeure
  de Postgres pourra exiger de recopier l'empreinte.
- **Julien** : rien.

### Le mode équipe : migration 016 (fonction n°37, 16-17 octobre) — PAS APPLIQUÉE ; écran livré le 17
Retenue le 11 octobre : le vendeur invite un aide qui voit les colis à expédier
et à retirer, les codes de retrait, imprime les bordereaux — et RIEN d'autre.
**Livré le 16 : la migration prouvée. Le 17 : la route, les écrans et leur banc**
(section « L'écran du mode équipe » ci-dessous).
Fichier : `supabase/migrations/016-equipe.sql` (la 015 est réservée à l'horloge
de l'agent eBay).
- **Une table** `vrm_equipe` (vendeur, email, membre, rôle `colis`, statut
  `invitee | actif | revoquee`, dates), lue et écrite par **personne** en direct
  (RLS forcé, aucune règle, tous droits retirés — même à `service_role`) ; tout
  passe par des fonctions `SECURITY DEFINER`, `search_path` vide, qui prennent
  l'identité dans le jeton : `vrm_equipe_inviter(email)`, `_accepter(id)`,
  `_revoquer(id)` (le vendeur, ou le membre qui QUITTE), `_lister()`,
  `_colis(vendeur)`, et `_effacer(owner)` (serveur seul). Empreinte de forme
  (une table d'une autre forme fait tout refuser). 5 invitations vivantes au plus.
- **L'acceptation exige une adresse CONFIRMÉE** (`auth.users.email_confirmed_at`)
  égale à celle de l'invitation — une identité. Sans ça, quelqu'un créerait un
  compte à l'adresse invitée.
- **Lecture : une liste blanche d'`id`** (`vrm_equipe_id_permis`, ancrée) :
  `email_bord_{tx}` (le PDF porte l'adresse de l'acheteur : c'est ce qu'on colle
  sur le carton), `harvest_{uid}_label_{tx|latest}` (+ leur `meta`, même ligne),
  `panel_colis_relais`, `email_track_{transporteur}_{n}`. Rien d'autre : ni
  `main`, ni `orders_*` (prix), ni `txn_*`, `billing`, `releve_*`, `inbox`,
  `conv_*`, `email_sale|final|offer|invoice|achat|inconnu|quarantaine_*`,
  `ebay_*`, et **aucune** règle sur `vinted_accounts` (jetons).
- **Les ventes à expédier / achats à retirer passent par une PROJECTION**
  (`vrm_equipe_colis`) : `transaction_id, item_id, title, status,
  transaction_user_status, date, photo` (l'adresse), le login des comptes, les
  clés de `vinted_ship_done` / `vinted_pickup_done` — **aucun montant, aucun
  acheteur, aucun jeton**. Liste LARGE (sans finalisé/annulé/remboursé/
  completed) : la règle « à expédier » reste `aExpedier` dans l'app (§11).
- ⚠️⚠️ **LA DEMANDE EXPLICITE (en-tête `x-vrm-equipe: <vendeur>`)**. L'app lit
  ses lignes SANS filtre de propriétaire (`id=like.email_bord_*`) : si un membre
  qui est aussi vendeur voyait d'office les colis de l'autre, ses propres écrans
  les mêleraient aux siens. Les lignes du vendeur ne sont donc visibles que dans
  une requête qui porte l'en-tête (PostgREST l'expose dans `request.headers`,
  déjà lu en production par `noter_ecriture`) ET si l'appelant en est membre
  actif. Sans en-tête : rien ne change pour personne.
- **Zéro écriture pour le membre.** « Coché posté » n'est pas indispensable :
  Vinted sort le colis d'« à expédier » dès le scan au relais.
- **L'abonnement est celui du VENDEUR** : `vrm_equipe_actif` exige
  `vrm_acces_pour(vendeur)`. Seul objet existant modifié : la restrictive
  `abonnement_requis` d'`app_data` (`… or owner = (select
  vrm_equipe_vendeur())`) — un aide ne paie pas. Texte d'avant dans le fichier
  (retour arrière). `with check` inchangé ; `vinted_accounts` inchangée.
- **Preuves** : `scripts/audit-equipe-sql.cjs` (Postgres 16 jetable, socle
  `agent-sql/supabase-min.sql` + 005-007 + 013 tels quels, `auth.users` complété
  de `email`/`email_confirmed_at`) — **106 contrôles verts** : le membre lit
  EXACTEMENT les 5 lignes de colis ; ni `main`, ni prix, ni jetons, ni l'autre
  vendeur ; sans en-tête il ne voit que SES lignes ; la projection ne porte
  aucun de `42.00`, `price`, `tokJ`, `buyPrice`, l'acheteur ; il n'écrit rien
  (UPDATE/DELETE 0 ligne, INSERT refusé, table et `_effacer` refusées) ; un
  membre d'un autre vendeur, une invitation non acceptée, une adresse non
  confirmée, une invitation révoquée (ou quittée), un vendeur qui ne paie plus ⇒
  rien ; le vendeur et le serveur voient comme avant ; l'essai annulé ne laisse
  rien ; `--verifier` rend ok, et ok = false sur 10 gardes touchées (droit de
  table, de colonne, RLS non forcé, règle sur la table, fonction INVOKER, corps
  changé, `anon` exécutant, restrictive revenue, règle d'écriture ajoutée,
  forme). `--prouve` : **16 mutations sur 16 au rouge**.
  Pas de « rouge sur le code d'avant » : la migration est neuve, ce sont les
  mutations qui prouvent.
- **Essai annulé / vérification** : `node scripts/equipe-sql/essai-annule.cjs >
  essai.sql` (~15 Ko, ROLLBACK), puis après application `… --verifier`.
- **Non mesuré** : jamais appliquée ; `postgres` doit pouvoir lire
  `auth.users.email`/`email_confirmed_at` en production (la migration le vérifie
  à l'installation et refuse sinon) ; l'en-tête `x-vrm-equipe` dans
  `request.headers` de SA PostgREST (forme `noter_ecriture`, pas essayé) ; banc
  sur Postgres 16, production en 17.6.
- **Gestes de Julien** : (1) Supabase → Authentication : **confirmation d'email
  obligatoire** (sinon l'adresse « confirmée » ne prouve rien) ; (2) lancer
  l'essai annulé (`essai.sql`) dans l'outil SQL, lire la ligne `essai` ; (3)
  appliquer la 016 VRM fermé ; (4) `--verifier` ⇒ `ok: true`. Rien ne change
  pour personne tant qu'aucune invitation n'est acceptée (l'écran, sans la 016,
  dit « le mode équipe n'est pas encore activé sur ta base »).

#### L'écran du mode équipe (17 octobre)
- **Route** : `api/compte.js?mode=equipe` (logique `api/_lib/equipe.js`, toujours
  **12 fonctions**). GET → `rpc/vrm_equipe_lister` + `aBoutique` (a-t-il au moins
  un compte Vinted à lui, lu avec SON jeton) ; POST `{action: inviter | accepter
  | revoquer | quitter}`. Tout part avec le **jeton de l'appelant**, jamais la clé
  de service. Trois états : 200 · **503 `non-installe`** (fonction absente,
  PGRST202 ⇒ « Le mode équipe n'est pas encore activé sur ta base. », jamais une
  erreur brute ni une équipe vide) · **503 `pas-su`** · 400/409 refus réel dit en
  clair (adresse invalide, la sienne, plafond de 5, adresse pas confirmée…).
  ⚠️ **Aucun email d'invitation n'est envoyé** (pas de SMTP) : le panneau le dit,
  le vendeur prévient la personne.
- **Fermer mon compte** appelle `vrm_equipe_effacer` (clé de service, `sbCle`)
  APRÈS les compteurs et AVANT les photos : base sans la 016 ⇒ 0, rien à effacer ;
  base muette ⇒ fermeture INCOMPLÈTE, dite, compte de connexion gardé.
- **Réglages → Mon compte → Équipe** (`EquipeSetting`) : ce qu'un membre voit et
  ne voit pas (`CE_QUE_VOIT_UN_MEMBRE`, une phrase pour le panneau et
  l'invitation, §11), inviter par email, la liste (membre / invitée), « Retirer »
  (confirmé) ; côté invité : « Accepter », et « Tu prépares les colis de X —
  Ouvrir ses colis · Quitter ».
- **L'aiguillage** (`PorteEquipe`, dans `App`, **AVANT `PorteAbonnement`** : un aide
  ne paie pas, c'est l'abonnement du VENDEUR que la base vérifie) :
  · l'appareil a choisi l'écran d'un vendeur (`vrm_equipe_vue_{uid}`) ⇒ ses colis ;
  · jamais choisi + **aucune boutique à lui** (lu, pas supposé) ⇒ l'équipe, ou ses
    invitations à accepter ;
  · sinon ⇒ sa propre app, exactement comme avant. **Un vendeur qui est aussi
    membre garde sa propre app** et ouvre l'équipe sur son clic ; « Ma propre
    boutique » le ramène.
  · Choisi mais plus membre (révoqué / quitté) ⇒ « Tu n'as plus accès », rien de
    la boutique du vendeur. Base sans la 016 ⇒ la phrase prévue.
  · ⚠️ La liste est mise en cache sur l'appareil (`vrm_equipe_cache_{uid}`) : seule
    la TOUTE PREMIÈRE ouverture sur un appareil attend la réponse (2,5 s au plus)
    — sans ça un aide voyait d'abord une boutique vide et ses écrans lisaient
    ses lignes pour rien (vu au banc : `txn`, `billing`, `main`…). Ensuite, aucune
    attente pour personne. `AppCoeur` ne monte toujours qu'avec une session.
- **`ColisEquipe`** : chaque lecture porte `x-vrm-equipe: <vendeur>` ET
  `owner=eq.<vendeur>` ; la liste des ventes/achats vient de `rpc/vrm_equipe_colis`
  (aucun montant) ; « à expédier » = `aExpedier` de l'app moins les coches
  « posté » ; « à retirer » = `isAtRelayStatus` / `needs_action` moins les
  « retirés », avec le code (`panel_colis_relais`, `codeRetrait`) et le QR ;
  les codes reçus par email (`email_track_*`, disponibles, ≤ 14 j). Impression :
  `lirePdfLigne(row, '', {'x-vrm-equipe'})` (nouveau 3ᵉ paramètre), tamponnée du
  N° que porte la ligne `email_bord_*` — le membre ne lit jamais `main`, il ne
  recalcule aucun numéro (un bordereau capté sans email part avec le titre seul).
  Trois états : chargement · pas su (une ligne, « Réessayer ») · non installé ·
  plus d'accès (projection `null`) · lu ; une lecture partielle est dite une fois.
  `lecturesPartagees` met `x-vrm-equipe` dans sa clé.
- **Preuves** : banc `scripts/bancs/equipe.cjs` (port 5011, `BANC_PORT`), faux
  PostgREST qui applique la règle de la 016 (liste blanche, en-tête, adhésion
  active, aucune règle sur `vinted_accounts`), faux GoTrue, le VRAI
  `api/compte.js` exécuté, 390 et 1512 px — **76 contrôles** : l'aide arrive sur
  les colis (pas de porte d'abonnement), ne voit que la vente à poster (ni la
  finalisée, ni celle cochée « posté »), le code de retrait, AUCUN montant ;
  aucune requête de son navigateur vers `main`, `vinted_accounts`, `_txn_`,
  `_billing`, `orders_*`, `email_sale_*` ; chaque lecture porte l'en-tête ET
  `owner=eq.` ; l'impression lit le PDF avec l'en-tête et ouvre le bordereau ;
  invitation retirée ⇒ plus rien ; base sans la 016 ⇒ la phrase (écran et
  Réglages) ; le vendeur garde son app (aucune requête avec l'en-tête), invite et
  retire ; accepter d'un clic ouvre les colis ; une vendeuse-membre garde SA
  boutique, ouvre celle de V sur son clic, sans mélange. **35 rouges sur le build
  d'avant** (ed52842, §6.1) ; mutation « lecture sans `x-vrm-equipe` » ⇒ 8
  rouges. `audit-fermer-compte.cjs` : +3 contrôles (équipe effacée chez lui seul,
  base sans la 016, base muette ⇒ incomplet).
- **Non mesuré** : que la passerelle de Supabase laisse passer l'en-tête
  personnalisé `x-vrm-equipe` depuis le navigateur (CORS : le greffon Kong
  renvoie par défaut les en-têtes demandés — non vérifié, supabase.co est bloqué
  d'ici) ; si elle le refusait, l'écran dirait « pas pu lire » (jamais « aucun
  colis ») et la lecture devrait passer par la route. Le thème sombre n'est pas
  appliqué sur l'écran d'équipe (monté hors d'`AppCoeur`).
- **Gestes de Julien** (en plus de ceux de la migration) : rien d'autre. Une fois
  la 016 appliquée : Réglages → Mon compte → Équipe → inviter l'adresse de son
  aide, la prévenir ; elle crée son compte VRM avec cette adresse, la confirme, et
  arrive directement sur « Colis à préparer ».

### Leboncoin et eBay rangés comme Vinted : résumé, puis Ventes / Achats / Annonces (3 octobre)
Demande du 2 octobre : « plus d'écran Aperçu intermédiaire ». Les deux onglets
ouvrent sur **Ventes**, avec un résumé compact au-dessus (`PlatResume`, même forme
que `VintedResume`) :
- **Leboncoin** : CA finalisé · En attente, calculés par `lbcArgent` — la MÊME
  règle que la liste des ventes (§11) ; la liste ne répète plus ses totaux sous le
  résumé (`sansTotaux`). Sections : Ventes · Achats (si captés) · Annonces (l'ex
  « À publier ») · Colis.
- **eBay** : « Ventes payées » (`caParPlateforme`). Sections : Ventes · Achats ·
  Annonces · **Compte eBay** — c'est là que vivent la connexion et la publication
  (`EbayConnexion`), qui étaient dans l'Aperçu. Rien n'est perdu (§4.11).
- `Plateforme` ne sert plus qu'à Vestiaire ; ses branches eBay/Leboncoin, devenues
  mortes, sont retirées. Une liste vide dit sa cause UNE fois (pas sous le résumé
  ET dans la liste, §7 — vu au rendu sur eBay).
- ⚠️ `ebay-form.cjs` sort **déjà** rouge sur « Optimiser le titre avec l'IA » sur
  le build d'AVANT ce changement : défaut du banc ou de l'IA, pas des onglets. À
  regarder.

### Bordereau Leboncoin tamponné comme celui de Vinted (3 octobre, 5.136)
Demande du 2 octobre : « le titre et le N° sur TOUS les bordereaux ». Celui de
Leboncoin s'ouvrait par un simple lien (`voucherUrl`) : le PDF arrivait **nu**,
sans N° — il fallait recopier le numéro à la main sur l'étiquette.
- Le PDF est derrière la session Leboncoin (cookies) : l'app ne peut pas le lire,
  l'extension si. `pdfBordereauLbc(url)` le lit **uniquement** à l'adresse
  `api.leboncoin.fr/api/shippingproxy/v1/parcels/{id}/label` (liste blanche par
  motif), vérifie qu'il commence par `%PDF` (une page HTML de session expirée
  n'est jamais prise pour un bordereau), plafonne à 12 Mo, et ne répond qu'à
  l'origine de l'app. C'est une **lecture** de ses propres colis.
- L'app (`imprimerLbc`) le tamponne avec **le même code que Vinted**
  (`annotateAndDownloadBordereau`, titre + N°) et l'ouvre dans l'onglet réservé
  au clic. PDF illisible ⇒ on le dit et on ouvre le lien d'origine — jamais rien.
- Extension en retard ⇒ le lien d'avant reste, et son infobulle dit pourquoi il
  n'est pas tamponné (`extSait('lbcpdf')`).
- Banc `lbc-bordereau.cjs` (le PDF ouvert PORTE le titre ; ⚠️ pdf-lib compresse
  ses flux, le banc les décompresse avant de chercher le texte) ; `audit-exec.cjs`
  à 15 contrôles, dont « aucune autre adresse ne passe par ce pont ».

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

### ⚠️⚠️ « MÊME S'IL Y A DES MISES À JOUR, PLUS AUCUN PROBLÈME DE CAPTURE » — LA DÉRIVE DE CHAMP (3 octobre, 5.141)
Consigne permanente de Julien. La sentinelle de forme (5.139) attrapait déjà le
cas où Vinted/LBC/eBay **renomme la clé de liste** (`my_orders` → `orders`) : la
capture tombe à 0 en silence. **Mais elle revenait dès que la clé de liste était
présente** — or le vrai bug déjà vécu est **un champ INTÉRIEUR renommé**
(`brand_title` vs `brand`, § allègement) : la liste a l'air pleine, `articleMaigre`
garde un champ qui n'existe plus, et **tout le stock affiche « marque manquante »
sans la moindre erreur**. Une mise à jour de Vinted qui déplace `price` casserait
le prix de toutes les annonces, pareil, en silence.
⇒ `verifChampsListe` vérifie, quand la clé de liste est bonne, que les **champs
STRUCTURELS** qu'on lit sont encore là (`CHAMPS_CRITIQUES` : `id`, `title`,
`price` pour les annonces ; `transaction_id`, `title` pour les commandes ; `id`
pour l'inbox).
- ⚠️ **UNIQUEMENT des champs structurels** (indépendants de la catégorie) : Julien
  veut servir aussi un reseller de livres/sacs, donc `brand`/`size` peuvent
  légitimement manquer à tout un stock — les exiger crierait au loup.
- ⚠️ **Seuil anti-fausse-alerte : 0/N.** On n'alerte que si le champ est absent de
  **TOUS** les items d'une liste **non vide**. Un item isolé sans prix (un
  brouillon) laisse les autres le porter → rien. Seul un **renommage** le fait
  disparaître de tout le monde d'un coup — et c'est ça, et seulement ça, qu'on
  attrape. Liste vide (compte neuf) ⇒ rien.
- **On ne devine aucun parser** (interdit) : on note `forme_inconnue_champ_<type>`
  + le **nom** du champ perdu + les noms de clés d'un item (jamais une valeur),
  la passe suivante aliase sur la forme mesurée.
- **Aucun changement côté app** : la clé `forme_champ_<type>` remonte toute seule
  dans l'alerte « Format d'un site » de Réglages (l'écran scanne `/^forme_/` et
  mappe par sous-chaîne). Rien rendu à l'aveugle.
- `audit-forme-capture.cjs` étendu : champ renommé → déclenche et NOMME le champ ;
  un seul item sans le champ → rien (seuil 0/N) ; liste vide → rien ; aucune
  valeur ne fuit. **6 rouges sur le code d'avant** (le silence), 0 après — mesurés
  en relançant le banc étendu depuis l'arbre `HEAD` (§6.1).
- **Aucune entrée d'`EXT_CAPACITES`** : c'est un diagnostic de capture, l'app ne
  promet rien de neuf. Extension en **5.141.0**, zip régénéré, `EXT_ATTENDUE`
  suivie.

**Suite (5.142) — même blindage sur les captures OBJET (transaction, conversation).**
Les listes ne sont pas les seules à casser en silence : une **transaction** porte
la preuve de vente et la date de versement (`transaction.status`), une
**conversation** porte la messagerie et les offres (`messages`). Un renommage de
ces champs par Vinted viderait la preuve de vente ou la messagerie sans erreur.
`verifFormeObjet` les garde par **présence de clé** (false-alarm-proof : un
renommage fait disparaître `messages`/`status`, une valeur vide — `messages:[]`,
`status:0` — garde la clé), et **uniquement** si l'objet métier est substantiel
(≥ 3 clés) — un objet maigre/raté n'est pas jugé (mieux vaut un blanc qu'un faux).
Le renommage AMBIGU du conteneur (`transaction` absent) n'est pas jugé, seul le
champ interne l'est. `nomFamille` mappe `transaction`→ventes, `conversation`→
messages pour l'alerte « Format d'un site ». **6 rouges de plus sur le code
d'avant.** Extension **5.142.0**, zip régénéré, `EXT_ATTENDUE` suivie.

**Suite (5.143) — le détail d'annonce (`item`).** Même sentinelle objet, sur le
champ qui porte **toutes les photos** : le coffre ET la capture photo passive
(Leboncoin/eBay) lisent `(p.item||p).photos`. Un renommage de `photos` par Vinted
ferait tomber à zéro toute la publication photo en silence — le point le plus
retravaillé du projet (5.87, 5.91, 5.94, 5.95). Gardé par présence de clé
(`photos:[]` ne déclenche pas, seul un renommage le fait), objet substantiel.
`nomFamille` mappe `item`→annonces. **2 rouges de plus sur le code d'avant.**
Extension **5.143.0**, zip régénéré, `EXT_ATTENDUE` suivie.

### ⚠️ « CAPTE TOUTES MES PHOTOS » — TROIS VOIES, ZÉRO RAFALE (3 octobre, 5.144)
Julien : « tu peux pas tout capter d'un coup ? imagine 100 annonces ». **Non — un
envoi de 100 requêtes à Vinted en quelques secondes = signature de robot =
blocage** (`vanessa5723`, §3). On refuse « tout d'un coup » définitivement. Les
trois voies SÛRES, mesurées dans le code :
1. **À l'affichage (gratuit, illimité, déjà là)** — `vinted-capture.js` lit photos
   + description **de la page qu'il ouvre lui-même** : **zéro requête** à Vinted
   (c'est lui qui l'a chargée). `onPage()` tourne à la 1re page ET à chaque
   navigation, re-essais lazy. C'est le vrai levier de vitesse : parcourir ses
   annonces les capte en entier, instantanément. Rien à coder.
2. **Au clic « Publier » (1 lecture, sur son clic)** — `completerPhotosSiManque`
   dans `publierDepuisApp`, AVANT de construire l'ad : si la paire n'a aucune
   photo captée, on va la chercher tout de suite (`completerPhotos` → page de
   l'annonce, sous garde de LECTURE, dans la file Vinted). Il ne publie plus sans
   photos, sans attendre le fond. §4.10 : exécuté au banc (capte si manque, ne
   relit pas si déjà là).
3. ⚠️⚠️ **La capture de fond AFFAMAIT les vraies actions.** `capterPhotosAnnonces`
   passait par `garde` → **budget d'ACTIONS** (20/h, partagé avec accepter une
   offre, générer un bordereau). `tickPhotos` tourne chaque minute, 20/tour : elle
   **vidait le budget**, et les offres/bordereaux tombaient en « 20 actions dans
   l'heure ». Or lire la page de SES annonces est une **LECTURE** (§messagerie
   5.135 : « une lecture ne consomme pas le plafond d'actions »). ⇒ `gardeLecture`
   + `compterLecture` : un **budget de lecture séparé** (20/h aussi). Ça
   n'ACCÉLÈRE pas (monter le chiffre = deviner le seuil de Vinted, refusé §3) —
   ça **empêche la capture d'affamer les actions**.
- `audit-photos-passif.cjs` : **21 contrôles**. §6.1 prouvé — budget d'actions
  PLEIN : code d'avant **0 lecture** (2 rouges), après **lit quand même** et le
  budget d'actions reste intact. Extension **5.144.0**, zip régénéré,
  `EXT_ATTENDUE` suivie. Aucune entrée d'`EXT_CAPACITES` (pacing interne +
  lecture à la demande ; l'app ne promet rien de neuf gaté sur une version).

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

### ⚠️⚠️ ONZE CARTES PARTAGÉES RESTAIENT FROIDES AU PREMIER RENDU D'UN APPAREIL NEUF (4 octobre)
Suite de la passe fiabilité, famille §5.49. **Mesuré dans le code** : le démarrage
(`useEffect` au montage d'`AppCoeur`) fait `cloudLoad`, restaure `localStorage`,
appelle `apply()` sur **une liste précise** d'états racine, puis `markCloudReady`.
Donc une clé **synchronisée** lue au montage (`useState(() => load(k))`) qui n'est
**ni** dans `apply()` **ni** re-lue par un `onCloudReady` reste à sa valeur par
défaut **jusqu'à ce qu'on quitte et revienne sur l'écran** — l'`AppCoeur` monte
AVANT que le nuage soit là (appareil neuf, cache vidé, PWA réinstallée).
⚠️⚠️ **Et ce n'est pas cosmétique** : ces cartes sont éditées au clic/à la saisie,
et leur setter réécrit `localStorage` depuis l'état courant. Un clic pendant la
fenêtre froide part donc d'une carte **vide** et **réécrit le nuage réduit à une
entrée** — la famille destructrice §5 (comme les numéros repartis de 1 au
montage). Croisé `SYNC_KEYS` × lectures-au-montage × couverture : **11 cartes
partagées** manquaient, dont `vinted_sale_overrides` (tes corrections de compta,
achats reliés), `vinted_achat_notes` (texte saisi), les états de bordereau
(`bords_printed/hidden/shipped`, `bord_links`, `bordereau_formats`), les retours
(`retours_recus/dismissed`), `pairs_lost`, `offvinted_buys`.
⇒ Ajoutées au bloc `onCloudReady` **déjà existant** (celui des numéros/points
relais, L19189), au **motif déjà béni** `setX(n => vide(n) ? load(k) : n)` : sûr
par construction — il ne remplit QUE ce qui est resté par défaut, **jamais une
saisie faite pendant le chargement** (sinon ce serait le pire défaut de l'app).
Build + 57 audits verts (`audit-tdz` compris : un callback d'`onCloudReady`
s'exécute après le montage, pas au rendu — pas de TDZ bien que `setOffBuys` soit
déclaré plus bas).
- ⚠️ **Non render-vérifié ici** (pas de fixtures dans ce conteneur) : le motif est
  identique à celui que `comptes.cjs` a validé pour les comptes exclus, et le
  `vide`-guard le rend non destructeur ; à re-regarder au rendu sur un appareil
  neuf dès qu'un banc a des fixtures.
- ✅ **FAIT dans la foulée (même passe)** : les clés dont le setter vit dans un
  autre composant ont reçu leur propre `onCloudReady` local (juste après leur
  `useState`, scope garanti) — `vinted_regime` (base du taux URSSAF),
  `vinted_urssaf_freq`, `vinted_account_labels/emails/phones`, `vinted_inventory`,
  `vinted_entreprise_active`. ⚠️ **Deux gardes selon le type** : carte/liste →
  « remplir si vide » ; **scalaire à défaut non vide** (régime `'micro'`,
  fréquence `'trimestriel'`, entreprise `'ent_1'`) → « remplacer SEULEMENT s'il
  est resté au défaut » — `v => v === DEFAUT ? load(k) : v` — jamais par-dessus un
  choix fait pendant le chargement. Build + 58 audits verts (`audit-tdz` compris).
  Non render-vérifié ici (pas de fixtures) ; sûr par construction (la garde ne
  remplace jamais une saisie). ⚠️ Reste `vinted_account_labels` lu EN LECTURE
  SEULE dans un second composant (`const [accountLabels]=useState(…)`, pas de
  setter) : cosmétique (affichage froid jusqu'au remontage), non destructif —
  laissé tel quel.

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

### ⚠️⚠️ LE COFFRE EFFAÇAIT SA FICHE RICHE SUR UNE LECTURE RATÉE (4 octobre, 5.150)
Suite de la passe fiabilité, et la leçon que ce fichier répète : *un banc qui
énumère à la main ne couvre que ce qu'on a pensé à écrire*. En balayant **tout**
`background.js` (14 lire-fusionner-réécrire), deux sites du COFFRE — la source
qui sert à RECRÉER une annonce disparue (§47 : description + photos HD) — n'étaient
**ni gardés, ni dans `audit-fusion`** :
- **`archiverAnnonce`** (par article, appelé L841) lisait `coffre_{uid}_{id}`
  puis complétait depuis l'ancienne fiche (`const anc = (rows && …) || null`)
  **sans** garde `=== null`. `sbGet` rend `null` quand la base n'a pas répondu :
  `anc` valait alors `null`, la branche « complète depuis l'existant » était
  sautée, et la fiche **PAUVRE** du dressing (pas de description, une vignette)
  était réécrite **par-dessus la fiche riche**. `null` = pas su (on n'écrit pas) ;
  `[]` = première sauvegarde (écriture légitime) — seul `null` bloque.
- **`archiverLot`** (le LOT, appelé à **CHAQUE visite Vinted**, L849/L2348 — le
  chemin le plus fréquent) lisait la famille `id=like.coffre_{uid}_*` en
  `sbGet(...) || []` : une lecture ratée valait « coffre vide » → mêmes fiches
  riches réécrites appauvries. Et c'est une famille **NON BORNÉE** (une ligne par
  annonce, tous comptes) → §4.5, tronquée à 1000 en silence. Passé en `sbGetTout`
  (paginé, `null` si une page échoue) + garde `=== null` → on n'écrit pas.
- `audit-fusion.cjs` porte les deux : `archiverAnnonce` dans la table CAS
  (`id=eq.coffre_*`), `archiverLot` dans un bloc dédié (la famille ne rentre pas
  dans le fetch `id=eq.` du harnais) — **lecture KO, écriture OK**, le cas qui
  détruit, plus l'autre sens. **§6.1 : 2 rouges sur le code d'avant** (« la ligne
  est réécrite : desc="", 0 photo(s) »), 0 après, les 59 audits verts, build vert.
- **Aucune entrée d'`EXT_CAPACITES`** : correction de fiabilité, l'app ne promet
  rien de neuf. Extension **5.150.0**, zip régénéré, `EXT_ATTENDUE` suivie.

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

### Revue contradictoire des trois commits du 4 octobre au soir — 8 défauts confirmés (5 octobre)
Trois relecteurs (un par commit), puis deux sceptiques indépendants par défaut :
**8 confirmés, 0 rejeté**. Tous corrigés, chacun prouvé rouge sur le code d'avant.
- ⚠️⚠️ **« Vendu » inventait des zéros quand les ventes étaient illisibles.** Si
  AUCUNE lecture de ventes n'aboutissait mais qu'une lecture d'annonces
  réussissait, la coque posait `liveStats` à zéro : « Pas encore de vente
  aujourd'hui · Vendu ce mois 0 € », et le **widget de l'iPhone publiait 0 €**.
  Pas su ⇒ chaque chiffre tiré des ventes vaut `null` (`VENDU_PAS_SU`),
  l'écran dit « — » et pourquoi. Un total **partiel** (un compte, Leboncoin ou
  eBay illisibles) **nomme ce qui manque** (`venduManque`), et le widget n'écrit
  **que** un vendu complet — sinon il garde sa dernière photo complète.
  `lbcCoqueLu` et `ebayCommandes` ont maintenant **trois états**.
- **Le vendu était figé à l'ouverture** : masquer une vente (✕), une vente rangée
  par l'extension, minuit (une PWA reste ouverte) ne changeaient rien. `save()`
  émet `vrm:save`, la coque écoute `vrm:ext maj ventes` (relit CE compte) et
  une horloge de jour (`jourCle`). Banc `vendu-recu.cjs` : **51 contrôles, 11
  rouges** sur le build d'avant (minuit compris, avec l'horloge de Playwright).
- ⚠️ **Le relais (`/api/vinted-proxy`) range lui-même les jetons qu'il vient de
  renouveler**, avec la session du vendeur (`modifierCommeVendeur`, RLS : sa
  ligne seulement). Depuis qu'il relit les jetons en base, l'écriture laissée au
  navigateur — qui ne regardait pas `r.ok` — laissait un refresh_token CONSOMMÉ
  en base sur un simple hoquet : compte cassé côté relais. `refreshed.persiste`
  dit s'il a rangé ; sinon l'app réécrit et vérifie. `proxy.cjs` : **4 rouges**.
- ⚠️⚠️ **Le N° d'une paire pouvait être tamponné sur l'étiquette d'une autre.**
  (1) `fetchCapturedLabel` lisait la transaction puis le PDF de `label_latest` en
  DEUX requêtes — l'extension réécrit cette ligne à chaque capture. Une seule
  lecture désormais (`lirePdfLigne(id, 'tx:meta->>tx,…')`). (2) l'index des
  bordereaux captés retenait `label_latest` : `labelsParTransaction` ne garde
  que les `label_{tx}`. `audit-label-latest.cjs` **exécute** les vraies fonctions
  contre une base qui change de version entre deux lectures : sur l'avant,
  « tx annoncée A · PDF de B ».
- **« Tout imprimer » annonçait « 2 sur 3 imprimés »** quand la fusion avait
  écarté un PDF abîmé (commence par %PDF, refusé par pdf-lib) : il compte
  `r.count`, et nomme le PDF illisible. Banc `lot-bordereaux.cjs` (**2 rouges**).
- **Registre annuel** : un compte dont le reçu était illisible disparaissait dès
  qu'un autre compte avait un reçu. Banc `recus.cjs` (**1 rouge**).
- ⚠️ **VINGT-SIXIÈME fois qu'un de mes contrôles crie au loup** :
  `audit-lectures.cjs` exigeait l'orthographe `` select=b:data->>pdfB64` `` ; le
  lecteur accepte maintenant des scalaires dans la même requête. Il suit la
  règle (rien d'autre que `pdfB64` dans `data`, et chaque appel n'ajoute que des
  `meta->>`) — rouge quand on ajoute `pdfTamponneB64` à un appel (prouvé).

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

### ⛔ L'acceptation automatique des offres est RETIRÉE (5 octobre, 5.159)
Julien : « enlève l'acceptation de l'offre » — après que je la lui ai reproposée
par erreur (elle était coupée depuis le 4 octobre, mais la ligne du §3 la disait
encore « livrée, ne pas retirer » : un dossier en retard sur une décision fait
refaire l'erreur à la session suivante).
- **Extension** : le moteur (`autoAccepterOffres`, `offresEnAttente`,
  `planchers`, le salut automatique, `repondreOffre`, l'interrupteur local) est
  supprimé, son appel à chaque visite aussi. Reste `EXEC_PERMIS` : l'acceptation
  d'UNE offre depuis la messagerie, sur son clic.
- **App** : plus de champ « Min. accepté », plus de bandeau « N prix planchers »,
  plus de carte dans Réglages, plus de capacités `offres`/`offresapp`. Les
  planchers déjà saisis restent en base (rien n'est effacé), sans effet.
- **Mesuré avant** : son extension installée (5.128) n'a que l'ancien
  interrupteur local ; `panel_min_prices` porte 5 planchers (1 à 20 €), sur des
  annonces **toutes fermées ou disparues** — elle ne peut donc rien accepter
  aujourd'hui. Le geste qui ferme la question pour de bon : installer la 5.159.
- `audit-offres-auto.cjs` porte l'invariant (aucun code ne construit `/accept`
  hors de la liste blanche, aucun reste du moteur, aucune promesse dans l'app,
  et l'autre sens) : **8 rouges** sur le code d'avant. `capacites.cjs` exige,
  même avec des planchers en base et dans les six états du pont, qu'aucune
  promesse ni aucun « Min. accepté » n'apparaisse.

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
  qu'à des gens de confiance**. (2) Un email « corps illisible » (`garderInconnu`, avant toute
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

### ⚠️⚠️⚠️ `/api/ebay` ÉTAIT OUVERTE À TOUT INTERNET, AVEC SON COMPTE eBAY CONNECTÉ (5 octobre)
Trouvé par l'audit de sécurité du 5 octobre. **Mesuré en production** : la ligne
`ebay_tokens` porte bien un jeton de renouvellement, son compte eBay est donc
relié. La route n'exigeait **aucune session**. N'importe qui pouvait :
- lister ses commandes eBay, avec les acheteurs, et lire ses finances ;
- publier ou modifier une annonce sur **son** compte eBay ;
- ⚠️⚠️ **et remplacer sa connexion eBay par la sienne.** Il suffisait d'ouvrir la
  page de consentement d'eBay (son adresse ne contient rien de secret) et de
  s'y connecter avec son propre compte. Le retour rangeait ce jeton à la place
  de celui de Julien, et ses publications partaient alors sur le compte d'un
  inconnu.

⇒ **Correctif minimal, posé À L'ENTRÉE de la route** (eBay reste le domaine de
l'autre session, sa logique n'a pas été touchée) :
- Toute action `POST` exige la session (`vendeurExige`) et le **propriétaire de
  l'installation** (`VRM_OWNER_UID`, à qui appartient la ligne `ebay_tokens`).
  Un autre vendeur reçoit 403.
- `authurl` fabrique un `state` **signé par le serveur** et daté (HMAC dont la
  clé dérive d'`EBAY_CERT_ID`, jamais envoyée au navigateur). Le retour de
  consentement le vérifie avant d'échanger le code. Sans `state` valide, ou au
  bout de 30 minutes, rien n'est rangé.
- La lecture `GET` (« eBay est-il prêt ? ») reste publique : elle ne dit rien
  de ses données.
- L'app envoie son jeton (`enTeteSession()`) sur ses 10 appels.
- Le jeton déjà rangé reste valable : rien à refaire pour lui. La prochaine
  reconnexion passera par la demande signée.
- `audit-ebay-route.cjs` exécute la vraie route : **12 contrôles**, **10 rouges**
  sur le code d'avant, dont « jetons écrits : true » pour le code d'un inconnu.
- ⚠️ **Pour la session eBay** : `ebay_tokens` est une ligne d'installation, lue
  avec la clé de service, sans filtre de vendeur. Le jour où eBay sera ouvert à
  d'autres vendeurs, il faudra une ligne de jetons par vendeur. Ce sera alors à
  elle de relâcher la garde « propriétaire ».

### ⚠️⚠️ LA FACTURE EXÉCUTAIT CE QUE L'ACHETEUR ÉCRIT DANS SON NOM (5 octobre)
Trouvé par l'audit de sécurité du 5 octobre. Une facture porte le nom, l'adresse
et l'email de l'**acheteur** (qu'il écrit lui-même sur Vinted) et la
désignation de l'article. Ces valeurs partaient sans échappement :
- dans `buildInvoiceHtml` (serveur), c'est-à-dire le HTML de la facture Pro,
  rangé en base puis envoyé par email à l'acheteur ;
- dans `generatePDF` (app), écrit avec `window.open('')` + `document.write`.

Or une fenêtre ouverte ainsi a **la même origine que l'app**. Un nom
« `<svg onload=…>` » y exécutait son code au moment où Julien imprime, et
pouvait lire sa session. Mesuré au banc sur le code d'avant : **18 exécutions**.

⇒ **Deux défenses, chacune prouvée :**
- toutes les valeurs sont échappées, côté serveur (`h()`) et côté app
  (`xmlEsc`) ;
- `ouvrirDocumentImprimable` écrit en tête du document une politique
  (`default-src 'none'`). Elle couvre aussi les factures **déjà rangées en
  base**, construites avant le correctif. Mesuré dans Chromium : sans elle le
  code s'exécute, avec elle plus rien. L'impression est lancée depuis l'app
  (`w.print()`), car aucun script de la fenêtre ne tourne plus.
- `audit-xss-facture.cjs` exécute les vraies fonctions dans un vrai Chromium.
  Il donne **9 contrôles**, **6 rouges** sur le code d'avant, et repasse au
  rouge quand on retire la politique (`--mutation sanscsp`, les factures
  rangées).
  ⚠️ **Son premier jet était vert sur le défaut** : le piège `<img src=x>`
  attendait une réponse réseau qui ne venait jamais, et le gestionnaire ne se
  déclenchait pas. Le piège n'utilise désormais **aucun réseau**
  (`data:` et `<svg onload>`). *Un banc qui dépend du réseau mesure le réseau.*
- Le **reçu d'achat** (`openReceipt`) échappait déjà ses valeurs, et il garde
  ses boutons en ligne. Il n'est pas touché.
- **Ajouté** : `X-Content-Type-Options: nosniff` (`vercel.json`).
- ⚠️ **Pas fait, et pourquoi** : une vraie politique `script-src` sur toute
  l'app. `index.html` a deux scripts en ligne, et la fenêtre du reçu hérite
  de la politique de l'app (ses `onclick` casseraient). Surtout, les bancs
  servent `dist/` **sans les en-têtes de Vercel** : rien ne verrait la casse.
  Il faut d'abord un banc qui sert les vrais en-têtes.

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


### eBay « de ouf » : l'annonce reliée à sa paire, l'offre aux observateurs, l'anti double vente (5 octobre)
Julien : « pour eBay je ne sais pas pourquoi le site est si peu développé, tu as
accès à mon compte et tu ne fais rien de ouf ». **Mesuré le jour même** :
`ebay_listings` = **2 annonces actives, AUCUNE n'a de SKU** ; `ebay_orders` = 0.
Rien ne reliait donc une annonce eBay à une paire : une paire vendue sur Vinted
pouvait rester en vente sur eBay sans que VRM le voie — sauf à comparer les
titres, ce que §5 interdit.
- **L'identité d'une annonce eBay = son SKU `VRM-{cleNum(n°)}`** (champ
  « étiquette personnalisée »). La publication le pose à partir du **numéro** de
  la paire choisie (`item.numero`), **jamais** d'un `sku` envoyé par le
  navigateur ; un numéro illisible ⇒ 400, rien n'est publié (pas de faux lien).
  Une annonce existante se relie d'un clic (« Relier à une paire », N° tapé ou
  choisi, confirmation qui montre les DEUX titres) — la paire à la **même
  photo** est proposée en tête, **jamais** un classement par titre. Lecture
  STRICTE (`numDeSkuEbay`) : seul un SKU « VRM-… » entier donne un numéro, un SKU
  à lui (« 12345-ABC ») ou des chiffres nus ne désignent rien. Le serveur porte
  une copie de `cleNum` : `audit-ebay-route.cjs` exécute celle de l'app et
  compare leurs sorties (§11).
- **`api/ebay` — quatre actions, toutes derrière la session du propriétaire
  (401/403, zéro appel eBay sinon)** :
  · `sku` `{itemId, numero}` → Trading `ReviseFixedPriceItem`
    `<Item><ItemID/><SKU>VRM-n</SKU></Item>` ;
  · `offreinfo` → `GET /sell/negotiation/v1/find_eligible_items?limit=200`
    (`X-EBAY-C-MARKETPLACE-ID: EBAY_FR`), rend `{eligibles:[listingId], complet}`.
    ⚠️ eBay répond **204** quand aucune annonce n'est éligible : c'est « lu,
    aucune », pas une panne ; une panne rend 5xx **sans liste** ;
  · `offre` `{listingId, remise (entier 5–50), message? (≤ 2 000), confirme:true}`
    → éligibilité **revérifiée chez eBay** au moment d'envoyer (pas éligible ⇒
    409, vérification ratée ⇒ 5xx, rien n'est posté), puis
    `POST …/send_offer_to_interested_buyers` `{allowCounterOffer:false,
    offerDuration:{DAY,2}, offeredItems:[{listingId, discountPercentage:"N",
    quantity:1}]}`. Une coupure après l'envoi ⇒ 504 `incertain` (« je ne sais
    pas si elle est partie, regarde sur eBay ») ;
  · `retirer` `{itemId, confirme:true}` → Trading `EndFixedPriceItem`
    (`NotAvailable`) — sans retour côté eBay, d'où la confirmation exigée **par
    le serveur**, pas seulement par l'écran ; une coupure ⇒ 504 `incertain`.
  `offre` et `retirer` refusent **avant tout appel eBay** sans `confirme === true`
  (un `'true'` ou un `1` ne suffit pas). Les messages d'eBay remontent tels
  quels, **sans rien qui ressemble à un jeton** (`messageEbaySur`).
- **L'offre aux observateurs est l'équivalent eBay de la remise aux favoris de
  Vinted (§3 l'autorise)** : c'est eBay qui choisit les destinataires, VRM ne
  nomme personne et n'écrit à personne, et l'envoi part sur SON clic + une
  confirmation qui dit « si l'une accepte, la paire est vendue à ce prix ». Le
  bouton n'existe **que** sur une annonce qu'eBay déclare éligible (« Faire une
  offre aux N observateurs ») ; « pas d'observateur à qui l'envoyer » est dit
  **une fois** au-dessus de la liste (§7) ; éligibilité illisible ⇒ ni bouton
  ni phrase. `WatchCount` est maintenant rangé en `observateurs` (nombre, `null`
  si absent) : c'étaient des personnes qui suivent l'annonce, l'écran disait
  « vues » — `vues` reste pour les lecteurs d'avant.
- **L'anti double vente eBay, dans les deux sens — UNE règle**
  (`doublesVenteEbay`, à côté de `doublesVenteLbc`), rendue par l'écran
  eBay → Annonces **et** le centre de notifications (`?tab=ebay_annonces`) :
  · paire **prouvée** vendue sur Vinted (`lireVentesVintedProuvees` : transaction
    → `item_id` + un état de commande qui ne la fait pas revenir — la règle de
    l'écran Leboncoin et de l'extension, paginée et **stricte** : `lireTout(…,
    {strict:true})` rend `null` plutôt qu'une demi-liste) dont le SKU est sur une
    annonce eBay active ⇒ « Retirer d'eBay » (une confirmation « sans retour »).
    Une AUTRE annonce Vinted du même N° en vente et pas vendue ⇒ la paire est
    revenue : rien. Une conversation (état vide) ou une vente annulée : rien ;
  · commande eBay **engagée** (ni annulée, ni remboursée, ni paiement échoué) dont
    le SKU désigne une paire encore en vente sur Vinted ⇒ « retire-la de Vinted »
    avec le lien vers SON annonce — VRM ne touche jamais une annonce Vinted (§3).
    Vendue aussi sur Vinted ⇒ « une des deux ventes ne pourra pas partir ».
  · une annonce ou une commande **sans SKU** ne désigne RIEN, même au titre
    identique : l'écran la dit « pas reliée » (une phrase au-dessus de la liste,
    la pastille sur la carte).
  · « pas su » (ventes Vinted, ventes eBay, annonces Vinted illisibles) ⇒ AUCUNE
    alerte, et **une** ligne qui dit ce qui n'a pas pu être lu et ce que ça
    empêche. Les alertes passent AVANT « pas encore d'annonce » : une paire
    vendue sur eBay sort justement de la liste.
- ⚠️⚠️ **TROUVÉ EN ÉCRIVANT : LA SYNCHRO EFFAÇAIT SES ANNONCES SUR UN HOQUET
  D'eBAY.** `handleSync` réécrivait `ebay_listings`, `ebay_orders` et
  `ebay_inventory` **même quand la lecture avait échoué** — avec une liste vide.
  L'écran disait alors « pas encore d'annonce eBay », et l'anti double vente ne
  voyait plus rien à retirer. Une source qui n'a pas répondu garde sa dernière
  capture ; la réponse dit ce qui a été lu (`lu`).
- **Le SKU d'une variante n'est pas celui de l'annonce** : `<Variations>` est
  retiré avant de lire `<SKU>`.
- Trois bancs eBay étaient **rouges depuis la fermeture de la route le matin
  même** (ils appelaient sans session) : `ebay-api`, `ebay-write` et
  `ebay-callback` présentent maintenant la session du propriétaire (et la
  demande signée pour le retour de consentement) — ils mesuraient le 401, plus
  la route.
- Preuves : `audit-ebay-route.cjs` **77 contrôles, 55 rouges** sur le code
  d'avant ; banc `scripts/bancs/ebay-annonces.cjs` (données inventées, il vit
  dans le dépôt, deux tailles + un passage « pas su ») — **59 contrôles, 24
  rouges** sur le build d'avant (les 9 verts y sont les contrôles d'ABSENCE,
  vacants par construction). Il juge les `data-*` et le **corps exact** de ce
  qui part vers `/api/ebay`, et vérifie que **Annuler n'envoie rien**.
  `verif_visuel.cjs` (vraies fixtures) reste conforme aux deux tailles.
- ⚠️ **Rien n'a été appelé chez eBay pour de vrai** (ni en production) : les
  noms d'éléments (`SKU`, `WatchCount` dans `GetMyeBaySelling`) et les deux
  routes de négociation viennent de la documentation d'eBay. **Le premier geste
  de Julien** : ouvrir eBay → Annonces, relier ses 2 annonces (« Relier à une
  paire »), puis « ↻ Rafraîchir depuis eBay » sur Compte eBay — si la carte
  repasse « pas reliée », c'est que `GetMyeBaySelling` ne rend pas le SKU comme
  prévu, et c'est ça qu'il faut regarder, pas l'écran.

### ⚠️⚠️ eBay : CHAQUE VENDEUR SON eBAY, des BROUILLONS, et un PLANIFICATEUR (5 octobre)
Julien : « tout doit être adaptable en fonction de la personne en face », puis
« tout doit être personnalisable : le nombre d'annonces qu'il peut poster,
sélectionner ses brouillons, ce qu'il veut mettre en ligne, etc. Tout doit être
parfait. »

**0. Deux défauts d'avant, corrigés d'abord (`api/ebay.js`).**
- ⚠️⚠️ **« Vérifier sans publier » DOUBLAIT les frais.** `totalFrais`
  additionnait TOUS les `<Fee>` ; or le guide Trading « Fees » dit que
  `ListingFee` EST le total. Dès qu'un frais n'était pas nul, le montant
  annoncé était faux (0,35 € affichés 0,70 €). Le banc `ebay-write.cjs` était
  **vert dessus** : sa fixture servait « ListingFee 0,35 + InsertionFee 0,00 »,
  une forme irréaliste où additionner et lire donnent le même nombre (§6.3).
  ⇒ `fraisParNom` range chaque frais **sous son nom** ; `total` = `ListingFee`,
  **absent ⇒ `null` (« pas su »), jamais 0** ; `programmation` = le frais
  d'option (`SchedulingFee` — nom NON mesuré sur eBay.fr : absent ⇒ null) ; une
  remise éventuelle est rendue à côté, jamais soustraite.
- ⚠️ **`tradingCall` ne gardait que le PREMIER `<LongMessage>`** : sur un Ack
  Warning ou avec plusieurs `<Errors>`, il montrait un simple avertissement à la
  place du vrai refus, et perdait l'ErrorCode (le 488 du planificateur). Il rend
  maintenant `erreurs` (`{code, severite, message, params}`), `err` = la
  première **Error**, `avertissements` = les Warning.

**1. Chaque vendeur son eBay.** `ebay_tokens` et les lignes `ebay_*` étaient
celles de l'INSTALLATION (écrites au nom de `VRM_OWNER_UID`, lues avec la clé
de service **sans filtre**), et la route refusait tout autre vendeur (403).
- Base cloisonnée : toute lecture est filtrée `owner=eq.{vendeur de la
  session}`, toute écriture porte `owner` = lui, cible `(owner,id)`. Le vendeur
  est **passé explicitement** à chaque fonction de `api/_lib/ebay.js`
  (`portee(owner)`) — jamais une variable de module (deux requêtes se traitent
  en parallèle). Un vendeur ne lit jamais les jetons d'un autre, et ses appels
  partent chez eBay avec **son** jeton.
- Le `state` de consentement **porte le vendeur** (`ts.vendeur.mac`, HMAC par
  `EBAY_CERT_ID`, 30 min, comparaison en temps constant) : le retour range les
  jetons chez CELUI qui a demandé. Le vendeur fait partie de ce qui est signé :
  un state dont on remplace le vendeur est refusé.
- La garde « propriétaire seulement » est retirée sur base cloisonnée ; un
  abonnement coupé (`vrm_acces_pour` = false) ⇒ **402**, zéro appel eBay (« pas
  su » ne coupe pas, comme ailleurs).
- ⚠️ **Rétrocompatible sans rien faire** : sa ligne `ebay_tokens` porte déjà
  owner = `VRM_OWNER_UID` = son identifiant. **Base pas encore cloisonnée ⇒
  exactement comme avant** (un seul jeu de données, seul le propriétaire de
  l'installation) — c'est pourquoi le 403 y est GARDÉ.
- « Pas su » ≠ « pas relié » : la lecture du refresh_token a trois états ; une
  base qui hoquette répond 503 (« je n'ai pas pu lire ta connexion eBay »), plus
  « aucun compte eBay relié ».
- L'app lisait déjà toutes ses lignes eBay avec `sbAuth()` (RLS ne lui rend que
  les siennes) — vérifié ligne par ligne.

**2. Brouillons et planificateur.**
- **Brouillons** : une ligne DÉDIÉE par vendeur (`ebay_brouillons`, jamais
  `main`, lue projetée). « Enregistrer en brouillon » dans le formulaire ;
  « Modifier » rouvre un brouillon dans ce même formulaire. Relire-fusionner-
  écrire, et **une lecture ratée n'écrit RIEN** (repartir de vide remplacerait
  ses six brouillons par un seul — prouvé au banc en réaffaiblissant). Une
  seule règle « brouillon → annonce » (`itemDeBrouillon`) pour le formulaire ET
  la liste (§11). Cocher un, plusieurs ou tous ; « Vérifier la sélection »
  (une vérification à blanc par brouillon, l'une après l'autre, frais par nom).
- **Planificateur** (« Programmer la sélection ») : départ (préréglages
  **modifiables et synchronisés** : Maintenant · Ce soir 20 h · Demain 12 h 30 ·
  Dimanche 20 h, ou une date et une heure), N par jour, plage de–à, jours de la
  semaine, **écart FIXE** (aucun hasard, §3), ordre (sélection / N° / prix).
  Le rythme est `vrm_ebay_rythme` (SYNC_KEYS, rattrapé par `onCloudReady`
  seulement s'il est resté au défaut, §5.49).
  - L'heure est celle de **PARIS**, calculée par `Intl` (`partsParis`,
    `parisVersUtc`) — jamais l'heure locale de l'appareil. Le changement d'heure
    du 25 octobre 2026 est juste (19:00 = 17:00 UTC le samedi, 18:00 UTC le
    dimanche) ; une heure ambiguë ou inexistante est refusée ; « un jour plus
    tard » avance le CALENDRIER, pas 24 h. Le banc tourne exprès avec un
    navigateur à l'heure de **New York**.
  - `heuresDuLot` est une fonction pure du temps : premier moment autorisé,
    puis l'écart ; quota du jour ou plage dépassés ⇒ jour coché suivant. Jamais
    une annonce programmée à moins de 20 min (eBay en exige 15) ; au-delà de
    3 semaines (la limite d'eBay) les brouillons **restent des brouillons**, et
    l'écran dit combien.
  - L'aperçu donne l'heure exacte de chaque paire, groupé par jour, puis les
    frais **lus chez eBay pour CETTE heure** (vérification à blanc avec
    `ScheduleTime`) : programmation ligne par ligne et au total, « pas su »
    quand eBay ne l'annonce pas (jamais 0), et « facturés à la création, non
    remboursés si tu annules » **seulement** si un frais de programmation non
    nul est revenu. Une paire déjà en ligne / déjà programmée sur eBay (SKU),
    prouvée vendue sur Vinted, sans N° ou incomplète est écartée **avec sa
    raison** ; preuve de vente illisible ⇒ rien ne part.
  - La limite de vente (`GET /sell/account/v1/privilege`) est lue et dite ; un
    lot qui la dépasserait est signalé (« pas su » si illisible). ⚠️ C'est une
    LIMITE mensuelle, pas ce qu'il reste ce mois-ci (non exposé là).
  - ⚠️⚠️ **CE QUI N'EST PAS PROUVÉ EST DIT, JAMAIS PROMIS.** Avant sa PREMIÈRE
    programmation, une case à cocher : l'annulation par VRM n'est pas garantie
    (il faudra peut-être annuler sur eBay), et une paire vendue ailleurs avant
    son heure peut quand même partir. C'est SA décision (la revue proposait
    d'attendre la mesure de l'annulation ; Julien a demandé le planificateur —
    il décide en connaissance de cause). Mémorisée (`risqueCompris`).
- **Programmer** (`programmer`, une annonce par appel, l'une après l'autre) :
  `confirme:true`, heure ISO UTC validée par le serveur (15 min – 3 semaines),
  N° exigé (sans SKU, une paire vendue ailleurs ne se retrouve pas), **état
  exigé** (plus d'« Occasion » posé en silence), UUID 32 hex, frais vus. Puis :
  relecture de SES annonces (en ligne + programmées) ⇒ SKU déjà présent = 409
  (eBay, lui, ne l'empêche pas) ; illisible = 503 · vérification à blanc **sans
  UUID** ⇒ frais inconnus = refus, plus chers que vus = 409 · ajout **avec
  l'UUID** dans `<Item>`, `<ScheduleTime>` dans `<Item>`. La vérité rendue est
  celle d'eBay (ItemID, StartTime, EndTime) ; eBay qui ignore l'heure ⇒
  `enLigneMaintenant`. Coupure ⇒ « incertain » : l'app relit chez eBay par SKU
  AVANT tout nouvel essai, puis UN seul essai avec le MÊME UUID ; un 488 n'est
  « déjà programmée » qu'après un GetItem qui confirme le SKU. Bilan par
  brouillon (« 4 sur 6 programmées · 2 refusées : … »), jamais d'arrêt muet.
- **Programmées** : `GetMyeBaySelling` demande `<ScheduledList>` (sans elle une
  programmée est invisible : « pas vu » ≠ « aucune »), découpé **par
  conteneur** avant d'en extraire les `<Item>`, paginé (5 pages, sinon
  `complet:false`). Rangées dans `ebay_programmees` seulement si eBay a
  répondu ; ligne absente = « jamais lue » ⇒ l'écran la demande une fois.
  Groupées par jour ; statuts Programmée · En ligne · « Pas partie à l'heure »
  (+30 min, eBay la garde en attente, avec le geste) · « à relire » ; Échec sur
  le brouillon.
- **Déplacer** (`reprogrammer`) : refusé à moins d'1 h du départ (relu chez
  eBay), grisé avec la raison à l'écran. **Annuler** (`deprogrammer`) :
  EndFixedPriceItem **essayé** sur une programmée relue à l'instant, puis
  relecture ; la réponse d'eBay est montrée TELLE QUELLE, et sur un refus
  « annule-la dans le Seller Hub » avec le lien.
- **Double vente** : une programmée dont la paire est prouvée vendue sur Vinted
  rejoint l'alerte eBay (« programmée sur eBay — à annuler »), sur l'écran ET
  le tableau de bord (`doublesVenteEbay`, `programmees`, §11).

⚠️ **NON MESURÉ (eBay et la production bloqués ici — rien n'a été appelé pour
de vrai)** : le nom `SchedulingFee` sur eBay.fr et son montant (≈ 0,20 € selon
l'aide, la vérification à blanc fait foi) ; qu'EndFixedPriceItem accepte une
annonce pas encore commencée ; ReviseFixedPriceItem + ScheduleTime ; qu'eBay
omette un conteneur vide dans GetMyeBaySelling (lu « vide » sur un Ack
Success) ; l'adresse `ebay.fr/sh/lst/scheduled` du Seller Hub (un repli, pas une
promesse) ; le délai maximal de la fonction Vercel (un ajout lent devient
« incertain », couvert par la relecture par SKU). **Le premier geste de
Julien** : programmer UNE paire, une heure à l'avance, regarder la ligne de
frais de programmation, puis essayer « Annuler » — la réponse d'eBay dira si
l'annulation par VRM marche.

- Preuves : `audit-ebay-route.cjs` **153 contrôles** (dont 6 dans un processus
  neuf sur base NON cloisonnée), **73 rouges** sur e50cd28 ; et chacune de huit
  mutations le refait passer au rouge (lecture sans filtre de vendeur · UUID à
  la vérification · frais additionnés · garde d'identité retirée · 488 cru sans
  GetItem · XML lu sans conteneur · state non vérifié · premier message gardé).
  `ebay-write.cjs` : forme réaliste, **5 rouges** sur l'avant (`fees=1.1`).
  Banc `scripts/bancs/ebay-programmer.cjs` (données inventées, port 4721, deux
  tailles + un passage « brouillons illisibles ») : **71 contrôles**, rouge sur
  le build d'avant, et rouge sous quatre mutations (heure locale · décalage fixe
  +2 h · risque non coché · brouillons écrits depuis vide).
  `ebay-annonces.cjs` : + l'alerte « à annuler » (écran, tableau de bord,
  « pas su ») — **7 rouges** sur l'avant.

### ⚠️⚠️ Revue du 6 octobre, côté serveur eBay : le lien de connexion capturait le compte d'un autre
Revue contradictoire du planificateur eBay. Chaque défaut a été confirmé en
EXÉCUTANT la vraie route.
- ⚠️⚠️ **Le `state` signé prouvait QUI avait demandé, jamais que le retour arrivait
  dans SON navigateur.** Le vendeur B demandait un lien de connexion et
  l'envoyait à quelqu'un (« reconnecte ton eBay à VRM » : c'est une vraie page
  eBay, au nom de VRM). La victime acceptait, et **SON** refresh_token était
  rangé chez B : ses commandes, ses acheteurs, ses annonces. Le même lien
  servait 30 minutes, pour plusieurs victimes. C'est arrivé avec
  « chaque vendeur son eBay » (avant, seul le propriétaire obtenait un `state`).
  ⇒ `authurl` pose un **nonce** dans un cookie `HttpOnly; Secure; SameSite=Lax;
  Path=/api/` et le nonce entre dans la signature. Le retour l'exige, puis
  l'**efface quoi qu'il arrive**. Le lien ne marche donc que dans le navigateur
  qui l'a demandé, et une seule fois (RFC 6749 §10.12).
  ⚠️ Conséquence à connaître : une connexion lancée dans un navigateur et finie
  dans un autre échoue, avec « relance la connexion eBay depuis VRM, dans ce
  navigateur ». Ça peut arriver dans une PWA iPhone qui ouvre eBay dans une vue
  à part. Son jeton actuel n'est pas touché, et rien n'est à refaire pour lui.
- ⚠️⚠️ **« Publier » n'avait AUCUNE garde d'identité.** Une paire déjà en vente,
  ou programmée pour ce soir, repartait en seconde annonce (prouvé : deux
  annonces VRM-30). `publish` passe maintenant par la même règle que
  `programmer` (`dejaChezEbay` : relue chez eBay, en ligne ET programmées ;
  illisible ou incomplète ⇒ 503 « pas su » ; présente ⇒ 409 `deja-*` avec son
  `itemId`). Une annonce SANS N° part comme avant (rien à comparer).
- **Le SKU se compare par le N°, pas par la chaîne** (`numDeSku` / `memePaire`,
  même lecture stricte que `numDeSkuEbay` dans l'app). « VRM-030 », « vrm-30 »
  et « VRM 30 », retapés dans le Seller Hub, sont la N°30. Avant, ces formes
  laissaient programmer et publier une seconde annonce. Le retrait automatique
  suit la même règle.
- **Une écriture sans `<Ack>` est « incertaine », jamais « refusée »**
  (`sansAck`). Une passerelle eBay qui répond 503 en HTML APRÈS avoir créé,
  annulé, déplacé ou retiré une annonce était rendue « eBay a refusé ». Le
  brouillon restait alors à republier, d'où une seconde annonce. Concerne
  `publish`, `programmer`, `deprogrammer`, `reprogrammer` et `retirer`. Un VRAI
  refus (Ack Failure) reste un refus.
- Preuves :
  - `audit-ebay-route.cjs` : **181 contrôles, 16 rouges** sur le code d'avant,
    dont « le lien de B ouvert dans le navigateur de Julien : rangé chez B »,
    « 2 annonces VRM-22 » et « HTTP 422 eBay a refusé » sur une annonce créée ;
  - `bancs/ebay-callback.cjs` porte le nonce. Ses cas d'erreur doivent ATTEINDRE
    l'échange, sinon ils passeraient sur le refus du nonce, vides de sens.
- **Suite, même jour (revue des propositions 6, 8, 9, 10)** :
  - `revise` (changer un prix) n'avait pas appris `sansAck`. Il annonçait « eBay a
    refusé » sur un réseau coupé, alors que le prix avait pu changer.
  - Une annonce terminée par `retirer` (à la main ou automatiquement) **sort
    tout de suite de `ebay_listings`**, en lire-fusionner-réécrire gardé
    (`sortirDesAnnonces` : une lecture ratée n'écrit rien, la réponse dit
    `listes:null`). Avant, l'alerte « à retirer » restait, et le retrait
    automatique reprenait la même annonce à chaque ouverture, en occupant les
    5 places d'une vraie vente.
  - `audit-ebay-route.cjs` : 185 contrôles, 3 rouges sur le code d'avant.
- ⚠️ Deux branches de sauvegarde (`claude/wip-ext-5162`, `claude/wip-bilan-lancement`)
  ont été poussées par erreur le 6 octobre. Le proxy a refusé leur
  suppression : à effacer sur GitHub. Elles ne se déploient pas
  (`claude/**` est coupé dans `vercel.json`).

### ⚠️⚠️ UNE FILE, UN FREIN, L'ARGENT AVANT LES PHOTOS, LA BOÎTE QUI BOUGE, LE COLIS COCHÉ MAIS JAMAIS PARTI (6 octobre, 5.162)
Quatre défauts d'une revue appuyée sur sa base, **remesurés avant de coder**.
- ⚠️⚠️ **UN 429/403 DE VINTED NE STOPPAIT RIEN, ET LA MOITIÉ DES REQUÊTES
  ÉTAIT HORS FILE.** `avecVinted` ne couvrait que la génération de bordereaux,
  les réponses et les commandes de l'app ; la moisson, les codes, les
  versements, les relevés et les photos (chaque minute) partaient à côté — le
  banc mesure **jusqu'à 4 requêtes en vol** sur l'avant. Et après un 429 reçu
  dans la moisson d'une visite, **19 requêtes partaient encore** (ventes,
  achats, boîte, porte-monnaie, codes, versements, photos).
  ⇒ **Toute requête Vinted passe par `requeteVinted`**, dans les primitives
  (`vintedGet`, `vintedSend`, `vintedGetHtml`, `vintedGetCookie`, le
  renouvellement de session, la série faite dans la page) : une en vol, quelle
  que soit la source. `avecVinted` reste AU-DESSUS pour l'ordre des gestes ; les
  deux chaînes sont distinctes, donc aucune n'attend l'autre. ⚠️ Une primitive
  ne s'appelle JAMAIS de l'intérieur d'une autre place de la file (elle
  attendrait la sienne pour toujours) : `vintedSend` refait sa requête après un
  401 dans une NOUVELLE place.
  ⇒ Un 429/403 ouvre une **pause rangée dans `chrome.storage.local`**
  (`vrmPauseVinted`, §4.9) : 15 min, puis 30, 1 h, 2 h, 4 h si Vinted recommence
  dans les 6 h ; deux freins à la suite ne montent pas deux paliers. Pendant la
  pause, RIEN ne part : visite, moisson, lecteurs, photos, et les gardes
  (`garde`, `gardeLecture`, `gardeStricte`) refusent — un clic de l'app reçoit
  `code: 'vinted-pause'` et « **Vinted demande de ralentir — réessaie dans X
  min** ». Diagnostic : `vinted_frein_*`, `vinted_pause_palier_*`,
  `vinted_pause_refus`, `rates.vinted_pause`. Aucun plafond monté.
  ⇒ **La moisson faite DANS LA PAGE** (`inject.js`, `activeHarvest`) s'arrête au
  premier 429/403, prévient le fond (`vintedFrein` → même pause) et ne démarre
  pas pendant une pause : `content.js` lui transmet la fin de la pause (un
  nombre). Le fond ne pose une pause que sur NOS requêtes, jamais sur celles que
  la page fait d'elle-même.
- ⚠️ **L'ARGENT ET LES COLIS MANGEAIENT LE BUDGET DES ACTIONS.**
  `capterRetraits`, `capterDatesVersement` et `capterReleves` passaient par
  `garde` → `compterAction` : jusqu'à **10 des 20 actions/heure** par visite
  pour de simples lectures — un bordereau ou une réponse pouvaient ensuite se
  faire refuser. Elles passent sur le budget de LECTURE (`gardeLecture`, 5.144).
  ⚠️ Mais ce budget-là, les photos le vidaient (`tickPhotos`). **Mesuré : 238
  ventes finalisées sans date de versement** (hors compte supprimé) — c'est le
  CA qu'il déclare. Les classes `argent`/`colis`/`clic` ont tout le budget ; les
  `photos` s'arrêtent avant une **réserve** = ce que les lecteurs prioritaires
  ont encore à lire (au plus 5 + 2 + 3), qu'ils notent dans `vrmLecturesDues`.
  « Pas su » (jamais noté, plus d'une heure, une lecture ratée) garde la réserve
  entière ; plus rien à lire ⇒ les photos retrouvent les 20. Le total reste 20.
- ⚠️⚠️ **LA BOÎTE DE RÉCEPTION ÉTAIT FIGÉE SUR UNE PAGE ANCIENNE.** Mesuré :
  `24602614` sur la **page 5** (dernière conversation captée le 27 juillet,
  dernière vente le 2 octobre), `3156028798` sur la page 3. `listePlusRiche`
  compare des NOMBRES : une page profonde rangée en faisant défiler (50
  conversations) refusait toute page 1 fraîche (30). ⇒ `fusionnerInbox`, sur
  les deux voies d'écriture : `current_page === 1` met à jour le HAUT, une page
  profonde ne fait que compléter (jamais une version plus ancienne d'une
  conversation), fusion par identifiant, triée, **bornée à 300**, même forme
  `{pagination, conversations}`. Lecture de la ligne ratée ⇒ rien n'est écrit
  (une page 1 seule effacerait le reste) ; page vide ⇒ rien.
  Côté app (Messages) : quand la dernière vente d'un compte est plus récente
  (de plus d'1 h) que sa dernière conversation captée, une ligne le dit UNE fois
  et nomme le compte — « ouvre ta messagerie Vinted sur ce compte ». Ventes
  illisibles ou aucune conversation captée : on ne juge pas.
- ⚠️⚠️ **« COCHÉ POSTÉ » MAIS JAMAIS VU PARTIR.** Cocher « Colis fait » sort la
  vente de « à envoyer » partout ; rien ne revenait vérifier. **Mesuré : 4 ventes
  cochées dont Vinted dit encore « à expédier »** — mais seules **2** (65 € et
  75 €, cochées il y a 159 h et 92 h) ont un statut lu **après** la coche ; les
  2 autres (compte `3168505556`) ne sont connues que par une capture du
  20 septembre, antérieure à la coche du 29 : **pas su, pas d'alerte**.
  ⇒ `posteSansDepart` (une règle) : coche datée, `aExpedier` encore vrai, aucun
  email du transporteur ne l'a vu passer, statut lu APRÈS la coche
  (`_harvestSeen`), et date limite dépassée OU coche de plus de 48 h.
  `cochesNonPartis` (un propriétaire) est lu par **Colis** (bloc
  `data-poste-sans-depart`, le geste dit une fois, « ↺ Pas encore posté » la
  remet dans « à envoyer ») et **Ma journée** (action « Vérifier N colis
  cochés « posté » », même nombre). `limiteExpedition` porte maintenant la date
  limite pour `toShip` ET cette alerte (§11).
- **Preuves** (le vrai `background.js` dans un `vm`, banc commun
  `scripts/_fond-vm.cjs` : base à état, projection appliquée, Vinted qui compte
  les requêtes en vol, `executeScript` qui exécute vraiment la fonction de la
  page) — **rouges sur 9d71641 (5.161), verts après** :
  `audit-frein-vinted.cjs` **23 contrôles, 17 rouges** (dont « 19 requêtes
  après le 429 », « jusqu'à 4 en vol », le vrai `inject.js` qui continue après
  le 429) ; `audit-budget-lectures.cjs` **13, 8 rouges** ;
  `audit-inbox-fusion.cjs` **26, 16 rouges** ; banc `poste-sans-depart.cjs`
  (données inventées, deux tailles) **24 contrôles, 12 rouges** sur le build
  d'avant, et **8 rouges** quand on retire la condition « lu après la coche »
  (preuve par réaffaiblissement) ; `messagerie.cjs` + 5 contrôles (boîte figée
  dite une fois, et l'autre sens), **4 rouges** sur le build d'avant.
- `audit-versement.cjs` stubbait `garde` pour tester « garde refuse ⇒ rien » :
  il stubbe maintenant AUSSI `gardeLecture` (la règle est la même : un refus de
  la garde ⇒ zéro requête) — forme du banc, pas affaiblissement.
- Extension **5.162.0**, zip régénéré, `EXT_ATTENDUE` suivie. **Aucune entrée
  d'`EXT_CAPACITES`** : l'app ne promet rien de neuf (la ligne de Messages dit
  le geste, pas ce que l'extension fera).
- ⚠️ **Fusion du 8 octobre : DEUX extensions différentes s'appelaient « 5.162 ».**
  `main` (une autre session) avait la sienne : la purge des `email_bord_*` sans
  date lisible GARDE (#468). Ici, la file et le frein ci-dessus. Le code
  fusionné porte les deux, et passe en **5.163.0** : sinon une extension
  installée depuis l'un ou l'autre côté se dirait « à jour » sans l'être. Deux
  contenus ne portent jamais le même numéro.
- ⚠️ **Hors périmètre, constaté** : `inject.js` fait sa PROPRE moisson complète
  (jusqu'à ~66 requêtes, 1 fois / 30 min / onglet) en plus de `runActive` — et
  avec des délais **aléatoires** (`jitter`). Elle respecte désormais la pause et
  le frein, mais elle reste hors de la file du fond (elle vit dans la page). À
  trancher : la garder, ou la confier au fond.

### « Bilan de la semaine » et préparation du lancement (6 octobre, propositions 11 et 15)
**Le bilan (proposition 11).** Une notification par semaine et par vendeur :
vendu (nombre de ventes et montant), reçu, colis à expédier, paires qui dorment.
- ⚠️ **Le lundi vers 10 h (Paris), pas le dimanche soir. C'est un choix.** Le
  seul cron du projet (`ship-reminders`, 08:00 UTC) tourne une fois par jour, à
  ± 59 min près (plan Hobby). Un « bilan du dimanche » partirait le dimanche à
  10 h, sur une semaine pas finie présentée comme complète (§5). Le lundi, la
  semaine du lundi 00:00 au lundi 00:00 (heure de Paris) est terminée. La
  semaine du passage à l'heure d'hiver fait 169 h, et l'audit le vérifie.
  Si la base ne répond pas le lundi, mardi et mercredi réessaient. Le jeudi,
  plus rien. **Un second cron le dimanche soir est à trancher par Julien** : un
  cron refusé au déploiement bloquerait TOUS les déploiements (comme le défaut
  #250 des 13 fonctions).
- **Aucune règle n'est réécrite.** Vendu = `ventesFaites` (date de vente). Reçu
  = `ventesDeclarables`, daté au versement. ⚠️ Le bilan ne lui passe **pas** le
  registre « J'ai déclaré ce mois » : le reçu de la semaine est l'argent
  ARRIVÉ ces sept jours-là, pas ce qu'il a déclaré (sinon une vente déclarée
  sans date de versement sortirait des « sans date », et le reçu se dirait
  complet sans l'être). L'audit le vérifie sur l'appel lui-même. À
  expédier = la règle du widget (`aExpedier`, colis cochés « posté » exclus). Le
  serveur ne peut pas importer `App.jsx`. `api/_lib/ventes-regle.js` est donc
  une **copie exacte**, refabriquée par
  `node scripts/audit-bilan-semaine.cjs --recopie`. ⚠️ **Ne jamais la modifier à
  la main.** L'audit compare les deux codes (hors commentaires) ET leurs
  résultats.
- **Les paires qui dorment.** L'écran Annonces publie `vrm_paires_dorment`
  (clé synchronisée, `{n, total, datesKnown, at}`) et le serveur la lit (§11).
  Une publication de plus de 8 jours vaut « pas su ». Des dates de mise en
  ligne incomplètes donnent « au moins ».
- **Trois états par chiffre, jamais deux.** Chaque chiffre est soit sûr, soit
  partiel (« au moins », avec ce qui manque **nommé**), soit inconnu (aucun
  nombre, « à voir dans l'app »). Le bilan devient partiel dans ces cas :
  - un compte jamais capté, ou capté avant la fin de la semaine
    (« vendeuse_a (lu jeudi) ») ;
  - Vinted, Leboncoin ou eBay illisible ;
  - des ventes Leboncoin sans date ;
  - pour le reçu, des ventes finalisées sans date de versement.
  Si tout est illisible, rien n'est envoyé ni mémorisé, et le cron réessaie
  le lendemain. Jamais « 0 vente ».
- **Un bilan par semaine, jamais deux.** Le mémo `bilan_semaine_dedup` est
  écrit **AVANT** l'envoi, et sa bonne écriture est **vérifiée**. Mémo illisible
  ⇒ rien. Mémo non écrit ⇒ rien. Le bilan passe par la boucle par vendeur déjà
  en place : toutes ses lectures portent `owner=eq.`. La réponse du cron ne
  contient **aucun montant**.
- **Préférence « 📊 Bilan de la semaine »** (`push_prefs.bilan`), activée par
  défaut et coupable dans Réglages → Notifications. Les défauts sont les mêmes
  dans l'app et sur le serveur (l'audit compare `PUSH_CATS` et `PUSH_DEFAUT`).
  Un abonnement coupé coupe déjà tout envoi.

**Le lancement (proposition 15).**
- **(a) Les liens des emails d'inscription ramenaient sur `localhost`.** Mesuré
  le 5 octobre dans les journaux d'authentification : une vraie confirmation
  d'inscription y venait de `http://localhost:3000`, donc le Site URL de
  Supabase est encore `localhost`. L'app envoie maintenant `redirect_to` (son
  adresse ouverte) sur cinq chemins : l'inscription, le renvoi de confirmation,
  le lien magique, l'oubli de mot de passe et le changement d'adresse.
  ⚠️ **Ça ne suffit pas seul.** Supabase ignore un `redirect_to` absent de sa
  liste d'adresses autorisées, et retombe sur le Site URL.
  L'aide de l'inscription parlait d'une « adresse de test » d'envoi, à
  **toute** personne qui s'inscrivait. Elle dit maintenant seulement d'ouvrir
  l'email, et de regarder les indésirables si rien n'arrive. Elle est vraie
  avec ou sans SMTP personnalisé.
- **(b) Les CGV s'acceptent DANS VRM, avant Stripe** (décision prise le 6
  octobre, Julien : « arrête de demander »). Le premier jet faisait porter la
  case par Stripe seul (`consent_collection[terms_of_service]=required`). Or
  Stripe refuse d'ouvrir le paiement tant que l'adresse des conditions n'est
  pas réglée dans SON tableau de bord : personne ne pouvait s'abonner tant que
  Julien n'avait pas fait ce réglage.
  ⇒ Les deux écrans qui vendent l'abonnement (Mon compte, la porte
  d'abonnement) montrent une case **« J'accepte les conditions générales de
  vente »** (`CaseCgv`, une seule pour les deux, §11). « S'abonner » reste grisé
  tant qu'elle n'est pas cochée.
  ⇒ Le serveur **exige** `cgv: true` (400 `cgv` sinon, rien ne part chez Stripe).
  Il range la date d'acceptation et la version des CGV dans les métadonnées de
  l'abonnement (`cgv_acceptees_le`, `cgv_version` = la date de « Dernière mise
  à jour » de cgv.html, comparée par l'audit).
  ⇒ La case de Stripe est toujours demandée en plus. Si Stripe ne sait pas
  l'afficher (adresse absente), on rouvre la session **sans** sa case, sous
  une autre clé d'idempotence (Stripe refuse de rejouer une clé avec d'autres
  paramètres). L'acceptation a déjà eu lieu dans VRM, datée.
  `audit-lancement.cjs` : **4 rouges** sur le code d'avant. Le banc
  `abonnement.cjs` vérifie que le bouton est grisé et que rien ne part sans la
  case, puis que la demande porte `cgv:true` une fois la case cochée.
  ⚠️ Régler l'adresse des CGV dans Stripe reste recommandé (double
  acceptation), mais n'est plus bloquant.
- **(c) « Fermer mon compte »** (Réglages → Mon compte), mode `fermer` de
  `api/compte.js`. Il fallait l'écrire : la politique de confidentialité promet
  l'effacement, et aucun bouton ne le faisait.
  ⚠️ **Mesuré sur la vraie base avant d'écrire** : `app_data.owner` et
  `vinted_accounts.owner` n'ont **aucune clé étrangère** vers `auth.users`.
  Seule `abonnements` en a une. La migration 001 en prévoyait, elle n'est pas
  en place. Supprimer l'utilisateur n'effacerait donc rien : la route efface
  elle-même, table par table, uniquement `owner=eq.<celui du jeton>`.
  Les garde-fous :
  - l'adresse email retapée est vérifiée **par le serveur** ;
  - c'est **refusé au propriétaire** de l'installation, et « pas su » vaut
    refus aussi ;
  - l'ordre est choisi pour qu'un échec se rattrape :
    1. l'abonnement : résilié en fin de période, ou arrêté tout de suite s'il
       est impayé. Stripe ne répond pas ⇒ **rien** n'est effacé ;
    2. les sessions ;
    3. les données, les comptes Vinted, les compteurs ;
    4. les photos détourées ;
    5. **en dernier**, le compte de connexion. Tant qu'il existe, le vendeur
       peut se reconnecter et relancer.
  - Un échec partiel répond 502 « Fermeture INCOMPLÈTE », avec ce qui est fait
    et ce qui ne l'est pas. Jamais « compte fermé ».
  - ⚠️ **Limite dite à l'écran** : un jeton déjà délivré reste valable environ
    1 h. Une extension encore installée peut donc écrire une capture dans
    l'heure (l'écran conseille de la retirer).
  - Les copies du schéma `sauvegarde` ne sont pas touchées : la politique les
    autorise 90 jours.
  - Les CGU donnent le chemin.
- **(d) Le contact vient d'un seul endroit**, `src/contact.js`
  (`CONTACT_EMAIL = ''`). La page d'accueil et Réglages le lisent. Vide, ils
  disent « adresse de contact à venir », jamais une adresse inventée.
  `audit-lancement.cjs` exige que ce soit **la même valeur** que `email` dans
  `public/legal/editeur.js`. Il refuse aussi toute adresse écrite en dur, en
  lien comme en texte. Il exécute `editeur.js` : un champ vide s'affiche
  « à compléter », jamais « null ».
- **Les preuves.** Chaque contrôle sort rouge sur le code d'avant (5ea2602),
  puis rouge sous une **mutation** posée sur le code d'après :

  | contrôle | sur le code d'avant | sous les mutations |
  |---|---|---|
  | `audit-bilan-semaine.cjs` (46 contrôles) | 34 rouges | règle du miroir modifiée → 6 · partiel affiché comme sûr → 4 · bilan éteint par défaut → 2 · publication hors synchro → 1 · reçu passé par le registre des déclarations → 1 |
  | banc `bilan-semaine.cjs` (20, la vraie route, deux vendeurs, faux Web Push) | 14 rouges | règle du miroir modifiée → 1 · partiel affiché comme sûr → 2 · envoi malgré un mémo non écrit → 1 · mémo illisible pris pour « jamais envoyé » → 1 · préférence ignorée → 1 |
  | `audit-fermer-compte.cjs` (25) | 22 rouges | effacement sans filtre de vendeur → 3 · propriétaire accepté → 2 · échec partiel annoncé réussi → 3 |
  | `audit-lancement.cjs` (22) | 16 rouges | case CGV retirée → 2 · `redirect_to` retiré → 5 · adresse écrite en dur sur l'accueil → 2 |
  | bancs `abonnement.cjs` (53) et `accueil.cjs` (40) | 7 et 2 rouges | — |

  Les mutations ont été relancées **après la fusion** avec la branche du jour :
  mêmes rouges. Cette fusion a apporté le registre des déclarations, et
  `ventesDeclarables` appelle maintenant `indexDeclarations` et `moisDeclare`.
  Le miroir les porte (refabriqué par `--recopie`, jamais à la main).
  ⚠️ **Le premier banc du bilan était vert sur un miroir qui comptait les
  ventes remboursées**, car aucune n'était servie. Il en sert une maintenant.
  **Le premier contrôle du contact** ne regardait que les liens `mailto:` : une
  adresse écrite en texte passait. C'est la règle qu'il fallait juger, pas son
  orthographe.
- **Les gestes de Julien :**
  - **Supabase → Authentication → URL Configuration** : Site URL
    `https://vrm.center`, et `https://vrm.center/**` dans les Redirect URLs.
    Puis un **SMTP personnalisé** : l'expéditeur par défaut de Supabase est
    limité et fait pour les essais.
  - **Stripe → Settings → Public details** : Terms of service =
    `https://vrm.center/legal/cgv.html`. Sans ça, le paiement répond « CGV
    absentes ».
  - **Remplir l'adresse de contact** dans `src/contact.js` ET dans
    `public/legal/editeur.js`, avec ses autres mentions légales.
  - Décider s'il veut un second cron le dimanche soir.
- **Non mesuré, ni en production ni ici** :
  - l'heure réelle du cron de Vercel ;
  - le texte exact du refus de Stripe sans adresse de CGV ;
  - Supabase face à un `redirect_to` non autorisé ;
  - la suppression du stockage, de `logout?scope=global` et de
    `admin/users` sur la vraie base ;
  - l'arrivée réelle d'une notification ;
  - ce qu'une extension écrit dans l'heure qui suit une fermeture.

### ⚠️⚠️ REVUE CONTRADICTOIRE DU PLANIFICATEUR eBAY : neuf défauts, côté app (6 octobre)
Confirmés en EXÉCUTANT le code de f53df91 (rendu, `vm`), corrigés dans
`src/App.jsx` ; le serveur (`api/ebay.js` : `publish` relit la liste d'eBay et
répond 409 `deja-*` avec l'`itemId`, 503 `pas-su`, 504 `incertain` sans `<Ack>`)
est traité à part — l'app AFFICHE `j.error` de ces réponses telle quelle.
- ⚠️⚠️ **Une paire DÉJÀ VENDUE se programmait quand même** : la seule garde était
  l'annonce Vinted du brouillon (`pairId`). Vendue sur Leboncoin, sur eBay
  (commande SKU VRM-n), revendue sur Vinted sous une AUTRE annonce du même N°,
  ou brouillon sans `pairId` : programmée. ⇒ **`numerosDejaVendus`**, UNE règle
  par le N° (§5), à côté de `doublesVenteEbay`, consommée par le planificateur,
  « Publier », l'alerte « à annuler » (avec OÙ : `ouVenduesTexte`) et le centre
  de notifications (§11). « La paire est revenue » (une autre annonce du N° en
  vente, pas vendue) est respecté ; une annonce de BROUILLON compte pour son N°
  même si la fiche a disparu (`autres`). `lbc_ventes` est lue projetée, en
  TROIS états ; les annonces Leboncoin (226 Ko) ne le sont que si une vente ne
  se relie pas sans elles. **« Pas su » ⇒ rien ne part**, et l'écran nomme ce
  qui n'a pas pu être lu.
- **« Publier » (immédiat) ne vérifiait RIEN** : `gardePublier` applique les
  mêmes règles — vendue (toutes plateformes), pas su, déjà en vente OU
  PROGRAMMÉE sur eBay (`dejaSurEbay` porte maintenant les programmées et dit
  laquelle), plus en vente sur Vinted. Bouton grisé, la raison dite UNE fois.
  Une coupure n'est plus « Publication impossible (réseau) » : « je ne sais pas
  si elle est partie ».
- **Second essai** (après un « incertain ») : un refus (frais, vérification,
  liste illisible) ne prouve pas que le premier n'a rien créé ⇒ « incertaine »,
  jamais `envoi:{ok:false}` (le brouillon serait reprogrammé ou republié) ; un
  409 `deja-*` avec `itemId` PROUVE l'annonce ⇒ programmée.
- **L'UUID déjà rangé en base est gardé** (relu dans `modifierBrouillonsEbay`) ;
  la copie de l'écran pouvait être périmée. `modifierBrouillonsEbay` accepte
  `false` = « rien à écrire » (aucune écriture, pas même la ligne relue).
- **SKU canoniques** dans le planificateur (`skuEbayDe(numDeSkuEbay(x))`) :
  « vrm-027 », « VRM 028 » sont reconnus. **Doublon dans le lot** : deux
  brouillons du même N° — le premier part, les suivants sont écartés et dits.
- ⚠️ **Le brouillon « programmee » zombie** : `brouillonEncoreAttendu(pr, P)`
  (relu COMPLET 2 min après la programmation et absent, ou parti en ligne ⇒
  plus attendu) dans `programmeesConnues`, UNE règle pour la liste et l'alerte ;
  `remettreBrouillon` est appelé par « Annuler » ET « Annuler sa programmation ».
- **Les heures partent d'une ANCRE** (à la minute), plus de `maintenant` qui
  avance toutes les 30 s : avec « Maintenant », « Programmer 3 annonces »
  retombait à « 1 » au tic suivant. Réancrage sur un réglage, un préréglage
  recliqué, ou une heure passée sous 16 min — jamais pendant une vérification
  ni un envoi.
- **`enregistrerBrouillon` ne réécrit pas un brouillon déjà parti** (programmé
  ou publié entre-temps) — aucune écriture, et c'est dit.
- Preuves (données inventées) : `ebay-programmer.cjs` **101 contrôles, 23
  rouges** sur le build de f53df91 (scénarios A déjà vendue / doublon / SKU ·
  B second essai et UUID · C horloge installée, `runFor(31000)` entre Vérifier
  et Programmer · D « Publier »), 0 après ; `ebay-annonces.cjs` **83 contrôles,
  11 rouges** sur l'avant (« à annuler » toutes plateformes, zombies, alerte qui
  revenait), 0 après ; `audit-ebay-deja-vendue.cjs` (les vraies règles dans un
  `vm`) : 25 contrôles, et **7 réaffaiblissements sur 7** attrapés (`--prouve`).
- ⚠️ **Pas mesuré** : rien n'a été envoyé à eBay pour de vrai. La marge de 2 min
  entre l'horloge de l'appareil et `capturedAt` (serveur) est une précaution,
  pas une mesure du décalage réel.

### ⚠️⚠️ Revue des propositions 6, 8, 9, 10, côté app : une vente REMBOURSÉE comptait « vendue » (6-8 octobre)
Les douze défauts de la revue, RE-VÉRIFIÉS sur le code du jour avant d'y toucher
(le planificateur avait été corrigé entre-temps) : **tous reproduisaient encore**.
Repris le 8 octobre après une coupure (le premier jet n'était ni fini ni
vérifié) : relu, complété, puis prouvé.
- ⚠️⚠️ **La preuve de vente Vinted lisait un état PÉRIMÉ.** La ligne
  `harvest_*_txn_*` n'est recaptée que si la transaction est rouverte. Mesuré :
  19 transactions « Remboursement effectué » selon la liste de ses ventes
  (`orders_sold`), dont 3 que leur ligne disait encore « Le paiement a été
  validé » (N°198, 277, 382) — trois paires revenues chez lui, « vendues » pour
  l'app. ⇒ `preuvesVentesVinted` : l'état d'une transaction est **le plus frais
  des deux** — la liste quand elle la porte et qu'elle a été relue après la
  ligne de transaction (`_harvestSeen` contre `meta->>capturedAt`), sinon la
  transaction. Aucun cas « transaction plus fraîche et en désaccord » chez lui
  aujourd'hui : c'est préventif. ⚠️ **On n'écarte PAS une annonce « dès qu'une
  transaction est annulée »** : 22 annonces portent une « Commande annulée —
  article indisponible » (l'acheteur qui a perdu la course) À CÔTÉ de la vraie
  vente. Mesuré aussi : la `date` de `orders_sold` est la date de VENTE (178 sur
  178 antérieures à la finalisation, 8 jours d'écart en moyenne).
- ⚠️⚠️ **Le retrait AUTOMATIQUE est le plus strict** (`retraitsEbayAutoPermis`,
  lancé par `passageRetraitEbayAuto`) : vente CONFIRMÉE par `orders_sold`, N°
  porté par **une seule** fiche (13 N° hérités d'août en portent plusieurs),
  **jamais revenue** (`revenues` : une transaction remboursée, retournée,
  suspendue ou annulée d'après l'une OU l'autre source — hors « article
  indisponible » et paiement échoué ; mesuré, 1 vente confirmée sur 215),
  annonce eBay mise en ligne **AVANT** la vente (`depuis`, le StartTime d'eBay ;
  date inconnue ⇒ rien), toutes ses annonces Vinted lues, eBay ne la disant pas
  déjà terminée. Ce qui ne passe pas RESTE dans l'alerte « à retirer », avec le
  bouton.
- **Une lecture « en vente », deux lecteurs** (`lireAnnoncesVintedEnLigne`) :
  l'écran eBay et la coque lisent TOUS ses comptes liés, écartés compris
  (masquer un compte règle l'affichage, pas ce qui est en vente), et la coque ne
  retire plus des « en vente » ce qu'un titre disait vendu (`soldIdsN`, pas une
  identité). Les lectures sont celles que la coque fait déjà (`cachedRow`,
  60 s) : seuls les comptes écartés coûtent une lecture de plus, et seulement
  quand une annonce eBay porte un SKU VRM.
- **Le passage** : `nuageAuDepart` est noté AVANT toute lecture ; l'annulation du
  passage et l'interrupteur sont relus avant CHAQUE appel ; les fiches N° sont
  relues juste avant ; une annonce qu'eBay dit déjà close ne prend plus une des
  5 places ; un retrait fait mais pas noté dans l'historique (`journal:false`)
  est dit ; un passage qui lève ne retire rien (`.catch`).
- **Proposition 9** : un N° porté par plusieurs fiches ⇒ aucune baisse eBay (et
  c'est dit) ; la confirmation nomme l'annonce **eBay** qui change ; une baisse
  faite pour un prix Vinted n'est plus reproposée après la synchro
  (`vrm_ebay_baisses`, synchronisé, rattrapé par `onCloudReady`) ; le plancher
  lit le prix d'achat comme la carte (`prixAchatDe`, §11 — la N°385 et ses
  15 € saisis par numéro).
- **Changer un prix eBay a trois issues** (`resultatReviseEbay`, les deux
  endroits qui le font) : un 504 « incertain », une page d'erreur HTML ou une
  coupure ⇒ « je ne sais pas si le prix a changé », jamais « rien n'a changé ».
- **Une moyenne par modèle** (`moyennesParModele`, §11) pour l'écran Ventes et le
  repère d'une offre sur Messages (qui comptait les comptes exclus). Les achats
  d'un compte exclu sortent aussi du repère (ils ne comptent nulle part).
  Messages n'affiche plus les offres d'un compte exclu, et dit « toutes réglées
  par une vente » au lieu de se taire ; le repère par modèle nomme un compte
  dont les ventes ou achats n'ont pas pu être lus.
- **Preuves** (données inventées ; « avant » = 66580a5, arbre archivé, scripts
  copiés dedans, build refait là-bas) : `audit-ebay-retrait-auto.cjs` (les vraies
  fonctions dans un `vm`) **20 rouges** sur l'avant — dont la vente remboursée,
  sur une fonction qui existait déjà, et les 5 places prises par des annonces
  closes — et **13 réaffaiblissements sur 13** attrapés (`--prouve`, dont « la
  liste gagne toujours », « une paire revenue acceptée », « article
  indisponible compté comme un retour ») ; bancs `ebay-annonces.cjs` **6
  rouges** (le retrait automatique partait sur 4 annonces au lieu d'une),
  `annonces-carte.cjs` **10**, `messagerie.cjs` **10**, `rapport.cjs` **1** —
  tous verts après.
- ⚠️ **Pas fait, à savoir** : (1) côté serveur, le journal `ebay_retraits_auto`
  reste un lire-ajouter-réécrire (deux retraits simultanés peuvent perdre une
  ligne), et la route pourrait elle-même refuser une annonce dont le `StartTime`
  (lu par `GetItem`) est postérieur à la vente ; (2) **deux autres lecteurs de
  la preuve** gardent la règle « transaction seule » : l'écran Leboncoin de
  l'app (`PAS_UNE_VENTE` sur `harvest_*_txn_*`) et l'extension
  (`lireVentesProuvees`) — ils sur-excluent une paire remboursée de leurs files
  (le sens sûr), mais c'est encore trois lecteurs pour une notion (§11) ;
  (3) ~~une liste de ventes captée il y a longtemps confirme la vente~~ —
  corrigé le 8 octobre, voir ci-dessous.
- ⚠️ **Non mesuré** : que `GetMyeBaySelling` rende `StartTime` pour une annonce
  EN LIGNE (`depuis`). S'il ne le rend pas, AUCUN retrait automatique ne part
  (date inconnue) — l'alerte, elle, reste. Et le texte exact d'eBay pour une
  annonce déjà close (`EBAY_DEJA_TERMINEE` suit l'erreur 1047 documentée).

#### Seconde relecture (8 octobre) : huit défauts reproduits, tous corrigés
Chacun reproduit sur 12c6f26, corrigé, et prouvé rouge sur le build d'avant
(arbre archivé, scripts copiés dedans, build refait là-bas, §6.1).
- ⚠️⚠️ **Après une baisse eBay faite par VRM, l'écran repartait du prix
  PÉRIMÉ.** `revise` ne réécrit pas `ebay_listings` : la liste garde 60 € tant
  qu'eBay n'est pas relu. L'écran disait « 60 € aujourd'hui » pour une annonce à
  53 €, et — Vinted baissé ensuite — proposait de « baisser » de 53 à **56 €**,
  une hausse. ⇒ Le mémo `vrm_ebay_baisses` (le prix posé par VRM) fait foi tant
  que la liste n'a pas été relue APRÈS lui (`ebay_listings.capturedAt`, lu en
  scalaire) ; date inconnue ⇒ le mémo. Jamais une « baisse » vers un prix ≥ au
  prix connu. Banc `annonces-carte.cjs` (sans simuler la synchro) : **3 rouges**
  sur l'avant, et l'autre sens (eBay relu après, 58 € ⇒ la liste gagne).
- ⚠️⚠️ **Une liste de ventes ANCIENNE, ou un compte BLOQUÉ, « confirmait » la
  vente.** Reproduit : liste captée il y a 60 jours sur un compte que Vinted a
  bloqué (capture figée) ⇒ l'annonce eBay était terminée. ⇒ La preuve porte la
  date de la liste qui confirme (`cap`) et son compte ; le retrait automatique
  exige une liste relue depuis moins de **48 h** (`LISTE_VENTES_FRAICHE_MS`,
  raison `liste-perimee`) et refuse un compte de `vinted_accounts_blocked`
  (`compte-bloque`, `comptesBloquesVinted()`) ; liste des comptes bloqués pas
  fournie ⇒ « pas su » ⇒ rien. Un compte masqué n'est pas exclu en soi : la
  fraîcheur de sa liste suffit (s'il ne le relit plus, rien ne part).
- **La ligne d'état de l'interrupteur décrivait l'ANCIENNE règle**, au-dessus de
  deux paires prouvées vendues qui restaient sans un mot. ⇒ `CONDITIONS_RETRAIT_AUTO`
  (une phrase, la même pour la confirmation et la ligne d'état, bornes tirées de
  la règle) ; allumé, chaque ligne « à retirer » porte `data-ebay-auto-raison` —
  `retraitsEbayAutoPermis` jugé par l'écran sur ce qu'il a lu (`toutesLues`
  remonte de `useEbayPaires`) — et dit sa raison (`RAISON_RETRAIT_AUTO`) ; une
  raison commune à toutes les lignes se dit une fois (§7). Banc
  `ebay-annonces.cjs` : **4 rouges** sur l'avant (dont « 21 caractères communs »
  entre la ligne d'état et la confirmation).
- **Un retrait automatique au résultat incertain (504, page d'erreur, coupure)
  ne laissait aucune trace.** Il se dit (« je ne sais pas si l'annonce eBay a été
  retirée — regarde sur eBay ») et se note sur l'appareil
  (`vrm_ebay_auto_incertains`, relu sur la ligne de l'écran eBay) ; un refus
  certain se dit aussi, avec sa raison. ⚠️ **Et il ne s'attribue pas à eBay** :
  le premier jet écrivait « eBay a refusé le retrait automatique (« … rien n'a
  été envoyé à eBay ») » — la plupart des refus viennent de VRM (réglage éteint
  ou illisible côté serveur, SKU changé). « N°X n'a pas été retirée
  automatiquement : « raison du serveur » ». `audit-ebay-retrait-auto.cjs` :
  **2 rouges** sur 5cfa12e, et la mutation qui remet l'attribution repasse au
  rouge.
- **Messages** : « toutes réglées » disait « celle reçue » en ne comptant que les
  réglées (une offre rangée à la main n'y était pas) — la phrase ne dit plus rien
  du total reçu, et les rangées sont comptées à part (`offresAtraiter` rend
  `rangees`). Et le repère d'une offre ne disait pas qu'un compte manquait :
  `ventesNonLues` (une liste, comptes exclus retirés) est lue par le repère de
  l'écran Ventes ET par Messages (§11). Banc `messagerie.cjs` : **6 rouges**.
- **Écran Ventes : un compte illisible était signalé deux fois avec le même
  geste** (bandeau « compte non chargé » + ligne du repère). Le repère ne redit
  que ce qui distingue ; le geste n'y revient que pour un compte dont seuls les
  ACHATS manquent (`achatsSeuls`). Banc `rapport.cjs` : **1 rouge** (« 2 fois »).
- `audit-ebay-retrait-auto.cjs` : **13 rouges** sur 12c6f26, et **19
  réaffaiblissements sur 19** attrapés (`--prouve`, dont « une liste ancienne
  confirme », « un compte bloqué accepté », « comptes bloqués inconnus lus
  aucun », « un retrait incertain tu », « un refus de VRM attribué à eBay »).

### Plusieurs comptes eBay par vendeur, reliés par la seule connexion (9 octobre)
Julien (6 octobre) : « donne la possibilité d'avoir plusieurs comptes eBay
connectés, si c'est possible uniquement avec la connexion », puis « je veux que
l'on puisse sélectionner le compte dans l'onglet eBay, ou alors les deux comptes
en même temps, tous les trois s'il y en a trois ; les données doivent être bien
séparées ». Il a un compte particulier ET un compte pro.
- **L'identité d'un compte eBay** : au retour du consentement, la route demande
  à eBay QUI s'est connecté (Trading `GetUser` sans UserID : `<EIASToken>`
  stable, `<UserID>` = le pseudo). La clé = EIASToken haché (16 hexa) ; le pseudo
  ne sert qu'à l'affichage. Une identité, jamais une ressemblance (§5).
- **Chaque compte a SES lignes** : le premier (« principal ») garde les ids
  d'avant (`ebay_tokens`, `ebay_listings`, `ebay_orders`, `ebay_finances`,
  `ebay_programmees`, `ebay_inventory`, `ebay_retraits_auto`) — la ligne de
  Julien reste la sienne sans rien refaire, et son identité est apprise à la
  prochaine ouverture de l'onglet ou synchro. Les suivants : `…_{clé}`. Le
  registre `ebay_comptes` (pseudo, clé, dates — **aucun jeton**, aucun EIASToken
  brut) dit lesquels existent. On ne fusionne JAMAIS deux comptes dans une
  ligne : l'union n'existe qu'à l'affichage, chaque ligne marquée `_compte`.
  La règle du suffixe est la MÊME des deux côtés (`suffixeCompte` /
  `suffixeCompteEbay`, l'audit compare leurs sorties, §11).
- **Au retour** : même identité ⇒ ses jetons sont rafraîchis (aucun doublon) ;
  nouvelle ⇒ ajoutée ; ⚠️ identité illisible ⇒ seul le TOUT PREMIER compte garde
  le comportement d'avant, sinon refus, rien n'est rangé (« je n'ai pas pu savoir
  quel compte eBay vient de se connecter »). Identité du principal inconnue et
  impossible à apprendre ⇒ pas d'ajout. Registre illisible ⇒ refus AVANT même
  d'échanger le code. ⚠️ Sur le code d'avant, connecter un 2e compte ÉCRASAIT les
  jetons du premier (`A1=rt-A2` au banc) : c'est le mélange que ça empêche.
- **« Connecter un autre compte eBay »** (Compte eBay) : `prompt=login`, et
  l'intention (`.a`) est SIGNÉE dans le state (la retirer ⇒ refusé). Le nonce en
  cookie reste exigé.
- **Chaque action** prend `compte` (absent ⇒ principal), validé contre le
  registre de CE vendeur avant tout appel à eBay : inconnu ⇒ 404, mal formé ⇒
  400, déconnecté ⇒ 409, registre illisible ⇒ 503, celui d'un autre vendeur ne
  désigne rien. `deconnecter` (confirmé par la route aussi) vide SES jetons et le
  marque déconnecté ; ses lignes restent en base, il sort du sélecteur, de
  l'affichage, du CA et des sécurités ; le reconnecter le retrouve tel quel.
- **Anti double vente sur TOUS les comptes** : `dejaChezEbay` relit chaque
  compte actif chez eBay avec SON jeton ; « pas su » sur UN seul ⇒ rien ne part,
  le compte qui manque est nommé. Côté app, `dejaSurEbay`, `numerosDejaVendus`,
  `doublesVenteEbay`, le retrait automatique (qui part sur le compte de
  l'annonce), la baisse de prix et le centre de notifications lisent l'union.
  Une même paire en vente sur deux comptes est signalée (les deux annonces
  nommées, VRM ne choisit pas laquelle retirer).
- **L'onglet eBay** : la liste « Compte : Tous les comptes / un compte »
  (`ListeComptes`, la MÊME forme que celle des comptes Vinted, §11), seulement à
  partir de deux comptes ; réglage synchronisé `vrm_ebay_vue` (rattrapé par
  `onCloudReady` s'il est resté au défaut ; compte déconnecté ⇒ « Tous »). Un
  compte : TOUT (résumé, ventes, annonces, programmées, brouillons rattachés,
  soldes, alertes) ne porte que sur lui ; une alerte d'un AUTRE compte est
  COMPTÉE en une ligne, jamais disparue. « Tous » : l'union, le compte nommé sur
  la ligne seulement quand la liste en mélange plusieurs (§7), le résumé dit
  « · N comptes » ; un compte illisible est NOMMÉ, jamais un total partiel
  présenté comme complet. Publier / programmer : le compte est pré-choisi sur la
  vue (sinon le dernier utilisé, `vrm_ebay_compte_pub`) et la confirmation le
  NOMME. Le sélecteur ne change que ce qu'on VOIT.
- **L'argent** : le CA déclaré (`ventesDeclarables`, branche eBay), la coque et
  le bilan de la semaine (`api/ship-reminders.js` → `lireCommandesEbay`, une
  lecture `id=like.ebay_orders%` filtrée par le registre) comptent TOUS les
  comptes actifs ; un seul illisible ⇒ eBay « pas su ». La règle du miroir
  (`ventes-regle.js`) n'a pas bougé.
- La sauvegarde exclut `ebay_tokens*` (tous les comptes). Base PAS encore
  cloisonnée : inchangé (un seul compte ; « autre compte » refusé ; pas de
  GetUser).
- Preuves : `audit-ebay-route.cjs` **230 contrôles**, **36 rouges** sur le code
  d'avant ; trois mutations rouges (garde relisant le seul compte courant ⇒ 5 ;
  identité illisible rangée quand même ⇒ 1 ; compte non validé contre le
  registre ⇒ 7). `bancs/bilan-semaine.cjs` : + 2 contrôles (deux comptes ⇒ 942 €,
  pas le déconnecté), **2 rouges** sur l'avant. Banc `bancs/ebay-comptes.cjs`
  (port 4812, données inventées, 390 et 1512 px, trois comptes puis un seul) :
  **21 rouges** sur le build d'avant ; deux mutations de l'app, chacune rouge —
  filtre de vue retiré (`dansVueEbay` toujours vrai) ⇒ **12** (le compte 2
  voyait les ventes et annonces des trois, le résumé disait 623 € au lieu de
  210 €) ; garde de publication filtrée par la vue (`pris` limité au compte
  affiché) ⇒ la N°30, en vente sur le compte 1, **partait** sur le compte 2
  (2 rouges directs, 8 en cascade). ⚠️ Le bloc « un seul compte ⇒ aucun
  sélecteur » juge une ABSENCE : sur l'avant il tombe faute de l'attribut
  `data-ebay-vente`, pas du défaut — il ne prouve rien seul, c'est l'autre sens
  (le sélecteur EXISTE à deux comptes) qui porte.
  ⚠️ Deux bancs servaient une forme que le code ne lit pas (§6.3) :
  `ebay-callback.cjs` rendait `''` à une LECTURE (le retour relit maintenant le
  registre) ; `bilan-semaine.cjs` traduisait `like.ebay_orders%` en « au moins un
  caractère » (`%` puis `*` convertis deux fois) et ne rendait pas `ebay_orders`
  lui-même. `audit-ebay-retrait-auto.cjs` charge `corpsCompteEbay`.
- ⚠️ **NON MESURÉ — le premier essai réel se fera chez Julien** : `GetUser` n'a
  jamais été appelé pour de vrai (les noms `<UserID>`/`<EIASToken>` viennent de la
  doc d'eBay) ; `prompt=login` non plus (sans lui eBay reconnecterait en silence
  le compte ouvert — c'est la doc qui le dit). Si l'identité ne revient pas,
  l'ajout est refusé et l'écran le dit : rien n'est mélangé. Le geste de Julien :
  ouvrir eBay → Compte eBay (son pseudo doit apparaître), puis « Connecter un
  autre compte eBay » et se connecter avec l'autre compte.

### eBay : « au-dessus, ça accepte » — c'est eBay qui accepte, au seuil qu'il fixe (9 octobre)
Julien : « je veux juste définir une règle sur chaque annonce et à chaque offre
au-dessus ça accepte ». Fait SUR eBAY seulement, avec le réglage natif d'eBay
(Offre directe : `BestOfferAutoAcceptPrice`, et en option le refus
`MinimumBestOfferPrice`) ; Vinted et l'extension ne changent pas (§3).
- **Fait** : actions `regleoffre` (pose, change, retire ; `ReviseFixedPriceItem`,
  `DeletedField` pour retirer) et `regleoffrelire` dans `api/ebay.js` (toujours
  12 fonctions) ; ligne `ebay_offres{_clé}` par compte eBay
  (lire-fusionner-réécrire gardé : lecture ratée ⇒ rien n'est écrit, et une
  lecture n'écrase pas une plus récente, `lueA`) ; la synchro lit la règle dans
  les GetItem qu'elle faisait déjà (zéro appel de plus, rien dans
  `ebay_listings`) ; carte « Offres reçues : eBay accepte dès X € » ou « Définir
  une règle d'offre », modification en place ; « Une règle pour toutes » (%,
  aperçu arrondi au centime SUPÉRIEUR, une par une, Arrêter, bilan dont la somme
  vaut le total) ; champs à la création, dans les brouillons et le
  planificateur (sans règle, le XML envoyé est celui d'avant, au caractère
  près) ; un changement de prix (carte ET baisse des paires qui dorment) relit
  la règle et dit ce qu'il en reste ; déconnexion d'un compte eBay et « Fermer
  mon compte » disent combien d'annonces gardent une règle chez eBay.
- **Décisions** : trois états (connue · aucune · pas su ; une lecture de plus de
  30 jours, un prix changé depuis, des offres dont on ne sait pas si elles sont
  actives valent « pas su », qui n'affiche AUCUN montant) ; le prix et la règle
  que Julien a VUS sont des gardes serveur (`prixVu`, `attendu` : 409 s'ils ont
  changé chez eBay — une règle existante jamais lue n'est pas écrasée sans le
  lui redemander) ; un seuil sous la moitié du prix (« 7 » au lieu de « 72 »)
  exige `sousMoitie` ; la base est marquée « en cours » AVANT l'écriture chez
  eBay ; sans `<Ack>` ou panne d'eBay (`SystemError`, classe absente) ⇒
  relecture, jamais « refusé » ; le refus existant est RENVOYÉ quand on ne le
  touche pas (sinon eBay peut le faire sauter) ; le compte de L'ANNONCE, jamais
  celui de la vue ; pas de règle sur une paire vendue ailleurs ou en vente sur
  deux comptes (retirer reste possible, un clic, sans feuille) ; l'écran dit les
  deux fenêtres où eBay vend sans que VRM le voie (ventes eBay relues à
  l'ouverture au-delà de 6 h quand une règle est posée ; retrait automatique
  seulement VRM ouvert). Couleurs : texte pour un ✓ sans réserve, ambre pour
  tout le reste — jamais de vert.
- **Preuves** : `audit-ebay-route.cjs` section 12 (**126 contrôles**, la
  route exécutée ; **105 rouges** sur la base d'avant, `worktree-wf_d62e1db4-b5c-1`) ;
  `prouve-regle-offre.cjs` (**16 mutations** de la route, chacune rouge sur les
  contrôles nommés ; XML de publication sans règle identique à celui d'avant,
  12 048 caractères, et avec `offre: null` ; une route qui appellerait
  `RespondToBestOffer` fait rougir `audit-offres-auto.cjs`, section 5) ; banc
  `ebay-regle-offre.cjs` (port 4761, données inventées, deux tailles, **202
  contrôles**) prouvé par `prouve-banc-regle-offre.cjs` (**11 mutations** de
  l'écran, chacune rouge ; **47 rouges sur 53** sur le build d'avant) ; `ebay-form`,
  `ebay-programmer`, `annonces-carte` étendus — sur le build d'avant, **2**, **3**
  et **3 rouges** (le formulaire, les brouillons programmés, la baisse d'une
  paire qui dort sous une règle). `audit-ebay-route.cjs` entier : 354 contrôles.
  ⚠️ **Trois bancs eBay mesuraient une forme d'avant** (§6.3) : `ebay-write`
  jugeait le DERNIER appel Trading — or un changement de prix relit maintenant
  l'annonce après la révision (rouge sur une route intacte) ; `ebay-programmer`
  jugeait les brouillons illisibles pendant « charge » (rouge sous charge) ;
  `ebay-form` mourait sur un build sans le champ au lieu de rapporter.
  ⚠️ **Deux contrôles du banc étaient des courses d'horloge** (« Arrêter »
  pendant le 1er envoi, quitter l'écran pendant le 2ᵉ) : rouges une fois sur
  quelques-unes à 1512 px sur une machine chargée, sur un code intact. Le faux
  eBay RETIENT maintenant la requête visée jusqu'au geste (`retenir`). *Un
  geste « pendant » se joue sur une requête tenue, jamais sur un délai.*
  ⚠️ Vu au rendu : l'anneau de focus de TOUTE l'app était encore le vert de
  l'ancienne palette menthe (`#0f6b4f`, posé après la règle aux couleurs de la
  marque, il l'écrasait) — remis au bleu de la marque, le sombre suit
  `data-theme`.
- **Non mesuré (eBay et la production sont bloqués d'ici, rien n'a été appelé
  pour de vrai)** : les noms et places des éléments dans `ReviseFixedPriceItem`
  et `AddFixedPriceItem` (doc d'eBay) ; `DeletedField` sur ces chemins ; que
  `GetItem` rende les seuils au jeton du vendeur et qu'« absent » veuille dire
  « pas de seuil » ; que la catégorie 15709 sur eBay.fr accepte le seuil (sinon
  eBay active les offres sans le montant : l'écran le dit) ; « strictement sous
  le prix » (23004) et « refus sous l'acceptation » (sources tierces) ; ce que
  `ReviseInventoryStatus` fait d'une annonce à seuils (effacer, garder, refuser :
  les trois issues sont tenues, l'écran ne dit que ce qu'il a relu) ; une offre
  égale au seuil acceptée ; le délai de propagation d'une révision (VRM relit
  une 2ᵉ fois après 2 s) ; une offre déjà faite et en attente acceptée dès la
  pose (la feuille le dit comme une possibilité) ; la révision d'une annonce
  PROGRAMMÉE (refusée par VRM, 409). **Premiers gestes de Julien** : eBay →
  Compte eBay → « ↻ Rafraîchir depuis eBay » (ses 2 annonces passent de « — » à
  leur vrai état) ; relier ses 2 annonces à leur paire ; poser une règle sur UNE
  annonce et lire le message (« ✓ … » ou « activé les offres mais pas gardé le
  montant ») ; la retirer ; changer le prix d'une annonce à règle et lire ce que
  VRM a relu.

#### Revue du 11 octobre — neuf défauts signalés, neuf reproduits, neuf corrigés
Chaque défaut a été REPRODUIT d'abord (la vraie route dans le harnais
d'`audit-ebay-route`, l'app rendue sur données inventées), puis corrigé à la
racine, rouge sur 2a34c1c et vert après.
- ⚠️⚠️ **Deux gestes sur deux cartes du même compte s'effaçaient dans
  `ebay_offres`** (pose sur la Nike, retrait sur la Samba, à 0-100 ms) : la base
  disait « aucune » sur une annonce qu'eBay vendait dès 72 €, et les DEUX
  réponses disaient `range:true`. Conséquences mesurées : carte « aucune », bloc
  « ce que ça engage » qui ne la compte plus, ventes eBay plus relues à
  l'ouverture pour ce compte. Cause : lire-fusionner-réécrire la ligne ENTIÈRE
  (upsert), sans verrou ni version — la règle `lueA` ne protégeait que contre
  une lecture plus ancienne fournie DANS l'appel, pas contre la copie périmée
  des AUTRES annonces qu'un écrivain concurrent réécrit.
  ⇒ `modifierDonnee` (`api/_lib/ebay.js`) **compare-et-échange** sur
  `data.rev` : PATCH filtré `data->>rev=eq.N` (Postgres réévalue le filtre
  après avoir pris le verrou de la ligne : un écrivain devancé reçoit 0 ligne,
  relit et refait SA fusion sur ce que l'autre a écrit) ; ligne absente ⇒
  INSERT sans fusion (409 ⇒ on relit). Lecture ratée ⇒ rien n'est écrit,
  toujours. `[R-concurrence]` : **3 rouges sur 2a34c1c** (pose + retrait, deux
  poses, deux premières poses sur une ligne absente), 0 après ; mutation
  `sans-cas` (l'écriture sans la version) ⇒ rouge.
  ✅ **17 octobre** : `modifierComptes` (registre `ebay_comptes`) et
  `sortirDesAnnonces` (`ebay_listings`) passent aussi par `modifierDonnee`
  (audit : « deux retraits simultanés », rouge sur l'avant). Restent les
  brouillons (écrits par l'app).
- ⚠️⚠️ **Fermer « Une règle pour toutes » pendant un lot arrêtait le lot en
  silence** — la réponse EN VOL n'était jamais appliquée (la carte disait
  « aucune règle » quand eBay en tenait une), les cartes du lot restaient
  grisées pour toujours, et le bandeau « lot interrompu » n'apparaissait qu'au
  montage SUIVANT de l'écran. ⇒ La porte est **grisée pendant un lot** (on
  arrête par « Arrêter », qui fait un bilan) ; et si le panneau disparaît quand
  même (une sonde de connexion qui hoquette le démonte), la réponse en vol
  s'applique à la carte, les cartes sont rendues, l'écran relit la base et
  **dit** l'arrêt tout de suite (`onInterrompu`). Banc bloc 14 : 4 rouges par
  taille sur 2a34c1c ; mutation `porte-lot` ⇒ SEUL le contrôle de la porte
  rougit (fermer pour de vrai ne casse plus rien d'autre — c'est ce qui prouve
  le démontage), `porte-et-demontage` ⇒ les trois conséquences rougissent.
- **`verifie: null` voulait dire deux choses, l'écran n'en connaissait
  qu'une** : sans lecture, la route n'a pas pu relire ; AVEC une lecture, elle a
  relu le BON montant et seul l'état des offres manque (eBay ne montre pas
  `BestOfferEnabled`). La carte disait « je n'ai pas pu le relire — Relire chez
  eBay » — une phrase qui ne venait pas de la donnée (§5), et un geste qui
  rendrait la même chose. ⇒ Septième issue, `offres-inconnues` : le seuil RELU
  est dit, avec « regarde l'annonce sur eBay » et le lien ; le lot la compte à
  part (`data-regles-offres-inconnues`).
- **L'aperçu « Une règle pour toutes » calculait sur l'ancien prix** (celui de
  la liste) pendant que la carte affichait le prix relu chez eBay : 85,50 € «
  dès » sur une annonce à 80 €. ⇒ `prixDe(it)`, UNE source pour la carte,
  `etatDe` et l'aperçu (§11) ; ce qui part porte `prixVu` 80.
- **Après un lot, changer le pourcentage laissait « ✓ réglée » sous « dès
  72,00 € »**. ⇒ Une issue porte le montant ENVOYÉ (`seuilEnvoye`) et ne se
  montre que sous une ligne qui propose ce montant-là.
- **« Dont 1 lue il y a plus de 7 jours » sans qu'aucune carte ne le dise**
  (lecture de 7 j ½ : `> 7 × 24 h` en haut, jours arrondis `> 7` sur la carte).
  ⇒ `ageRegleJ` / `regleVieille`, une règle pour les deux.
- **✏️ Modifier le prix : « 72 € » ou « 0 » n'étaient pas envoyés et l'écran
  disait « ✓ Modifié sur eBay »** (régression de `prixChange` : illisible valait
  « inchangé »). ⇒ Le prix tapé se lit par `montantSaisi` (§11) ; non vide et
  illisible ⇒ « Un prix en euros… — rien n'a été envoyé à eBay », aucun envoi.
- **Banc `ebay-regle-offre` : deux attentes fixes** (900 ms après « Oui »,
  1 200 ms après l'ouverture) — rouge sur une app intacte dès que la machine
  rame ou que les ventes Vinted mettent du temps à arriver (l'app grise alors
  « Définir / Modifier », à raison). ⇒ Le banc attend que le faux eBay ait
  RÉPONDU puis que la carte ne soit plus en envoi (`data-regle-envoi`), et le
  VERDICT des ventes rendu (`data-regle-bloquee` ≠ « en-cours »). Reproduit à
  coup sûr avec deux leviers ajoutés au banc : `BANC_EBAY_DELAI=1500` (faux eBay
  lent) ⇒ l'ancien banc **8 rouges sur 8** au bloc 8 sur l'app intacte, le neuf
  0 ; `BANC_TXN_DELAI=7000` (ventes lentes) ⇒ l'ancien **2 rouges**
  (`locator.click: Timeout 5000ms`), le neuf 0. `PORT` se règle par
  l'environnement (aussi pour `ebay-annonces`, `ebay-programmer`, `ebay-form`,
  `ebay-comptes`, `annonces-carte` : lancés un par un sur 4781-4786, tous verts). *Un geste se juge sur sa réponse appliquée, jamais sur un
  délai* — la leçon de « retenir », appliquée aux poses une par une.
- **Preuves** : `audit-ebay-route.cjs` **357 contrôles** (3 rouges sur
  2a34c1c) ; `prouve-regle-offre.cjs` **22 sur 22** (17 mutations de la route,
  dont `sans-cas` et `rangement` réancrée sur `modifierDonnee` ; XML sans règle
  identique à celui d'avant) ; banc `ebay-regle-offre.cjs` **234 contrôles, 0
  rouge** (blocs 8, 11, 14 : **20 rouges** sur le build de 2a34c1c, exactement
  les dix contrôles visés par taille, les autres contrôles de ces blocs verts) ;
  `prouve-banc-regle-offre.cjs` **26 sur 26** (18 mutations de l'écran, dont 7
  nouvelles ; `porte-lot` et `porte-et-demontage` vérifient QUELS contrôles
  rougissent, pas seulement le bloc). Tous les audits verts (84).
- **Non mesuré** : les deux formes du compare-et-échange contre la VRAIE
  PostgREST (`PATCH …&data->>rev=eq.N&select=id` avec `return=representation`,
  `data->>rev=is.null` pour une ligne d'avant, 409 sur un INSERT en doublon) —
  servies par le faux de l'audit, jamais envoyées à la base (aucune écriture en
  production) ; le chemin « panneau démonté, écran encore là » n'a été joué
  qu'en réaffaiblissant la porte (la sonde de connexion qui le déclencherait ne
  se pilote pas au banc).

#### Revue du 11 octobre, tour 2 — sept défauts signalés, sept reproduits, corrigés
Chaque défaut REPRODUIT d'abord avec la sonde du relecteur sur bac8da1 (la vraie
route dans le harnais d'`audit-ebay-route`, l'app rendue sur données inventées),
corrigé à la racine, puis : rouge sur bac8da1 (copie `git archive`, contrôle lancé
DEPUIS elle, §6.1), vert après, rouge sous une mutation qui réaffaiblit le correctif.
- ⚠️⚠️ **Une lecture RATÉE effaçait une règle ACTIVE connue.** Un GetItem qui
  hoquette pendant la synchro ou « Relire chez eBay » rangeait `{lu:false,
  raison:'lecture-ratee'}` — plus récent, donc gagnant — par-dessus « eBay accepte
  dès 72 € ». Conséquences reproduites : ligne « pas su » en gris (sans risque),
  annonce sortie de « ce que ça engage », et plus de relecture des ventes eBay à
  l'ouverture pour ce compte (le filtre « règle active » ne la voyait plus),
  pendant qu'eBay vendait au seuil. Et c'est justement quand une règle est active
  que cette synchro tourne. ⇒ `rangerReglesOffre` : une lecture ratée ne remplit
  qu'une place VIDE — jamais par-dessus une règle connue, ni par-dessus une
  écriture incertaine (`en-cours`, `incertain`, `apres-ecriture` restent : elles
  disent un risque). L'écran ne la pose plus localement non plus, et DIT combien
  de relectures ont raté (« eBay n'a pas rendu N annonces : VRM garde ce qu'il en
  savait »). *Rien lu ne vaut pas rien, y compris quand « rien lu » est plus
  récent.*
- ⚠️ **Course : `lueA` était l'heure de la RÉPONSE.** Une lecture partie AVANT une
  pose et revenue APRÈS se croyait plus fraîche que la relecture de la pose et la
  réécrivait (« aucune » sur une annonce qu'eBay vend dès 72 €, synchro ET
  « Relire »). ⇒ `lueA` = l'heure où la question PART chez eBay (`t0`, dans
  `lectureRegleDe`, une lecture pour la synchro, la relecture, la pose, le prix et
  la publication). Et `garder` (la liste complète d'une synchro) effaçait la
  règle d'une annonce publiée PENDANT la synchro (liste lue avant elle) : il
  porte maintenant l'heure de la liste (`{ids, a}`) et n'efface qu'une entrée
  PLUS ANCIENNE qu'elle. L'autre sens est gardé : une annonce terminée, rangée
  avant la liste, en sort toujours.
- **Montants qui s'arrondissent à 0** : `montantOk` acceptait 1e-9 (« > 0 » et
  1e-7 de tolérance) ; la création envoyait `BestOfferAutoAcceptPrice 0.00` (et
  `MinimumBestOfferPrice 0.00` SANS aucune confirmation). ⇒ au moins un centime
  APRÈS arrondi, dans la route et dans l'app (la même copie, `[R-§11]` compare
  leurs sorties, cas 1e-9 / 5e-324 / 0,004 / 0,01 compris). Ce qu'eBay fait d'un
  seuil à 0,00 n'est pas mesuré — il ne part plus.
- ⚠️⚠️ **✏️ « Modifier le prix / le stock » gardait le prix de la LISTE** (n° 4 et
  n° 7, une cause). Après une 409 « prix-change », la carte affichait le prix relu
  chez eBay (95 €, ou 80 €) et le champ Prix restait « 90,0 » (initialisé une
  fois sur `it.price`) : changer le STOCK seul renvoyait 90 € à eBay, avec
  « ✓ Modifié sur eBay » — et, sous une règle, se faisait refuser par la garde de
  la règle. ⇒ le champ part du prix de la CARTE (`prixCarte`, la même source que
  l'en-tête, §11) et `price` vaut `null` tant qu'il n'est pas tapé : le prix ne
  part que TAPÉ et différent.
- **« Seuil relu, offres activées ou non pas montré » parlait de trois voix** : la
  carte « regarde l'annonce sur eBay », la ligne du haut « pas encore lue —
  Relire chez eBay » (une relecture en boucle, qui rendait la même chose),
  l'aperçu du lot « relis-la d'abord ». ⇒ UNE règle, `PAS_SU_SANS_RELECTURE` /
  `seRelitChezEbay` (illisible · devise · offres-inconnues), lue par la ligne du
  haut, « Relire chez eBay » et le lot : la ligne du haut la dit à part avec son
  geste (le lien vers l'annonce) et ne propose « Relire » que s'il reste une
  annonce vraiment pas lue ; le lot lui donne un statut propre (`a-voir-ebay`,
  pas cochable) ; le panneau montre le seuil lu. ⚠️ **Trouvé en reproduisant** :
  « Définir une règle » sur cette annonce envoyait `attendu:'inconnu'` ⇒ 409
  « eBay a déjà une règle » ⇒ même état ⇒ même 409, **sans fin**. L'état porte
  maintenant `lu`, la garde l'envoie (ce que le panneau montre), et la pose
  active les offres (`BestOfferEnabled`).
- **Lot : « 1 à revoir » et plus aucune ligne pour dire laquelle** (régression
  des correctifs #4 et #5 du premier tour : le montant de la ligne est recalculé
  sur le prix relu, et l'issue ne s'affichait que sous le montant envoyé). ⇒
  « à revoir » s'affiche toujours sur SA ligne — rien n'a été posé, la condition
  du montant ne s'y applique pas — et dit le prix relu (« le prix sur eBay est
  maintenant de 95,00 € — rien n'a été envoyé, le montant est recalculé »).
- **Preuves** : `audit-ebay-route.cjs` **377 contrôles** (`[R-lecture-ratee]`,
  `[R-course]` — lectures TENUES, jamais un délai —, `[R-mont]` et `[R-crea]`
  étendus) : **16 rouges sur bac8da1**, 0 après ; `prouve-regle-offre.cjs` **26
  sur 26** (21 mutations de la route, dont 4 nouvelles : `lecture-ratee-remplace`,
  `luea-arrivee`, `garder-sans-age`, `montant-zero` ; XML sans règle toujours
  identique, 12 048 caractères). Banc `ebay-regle-offre.cjs` bloc **15** (50
  contrôles, deux tailles) : **20 rouges sur le build de bac8da1** — exactement
  les dix contrôles visés par taille, les `finPage` verts — et **284 contrôles, 0
  rouge** en entier ; `prouve-banc-regle-offre.cjs` : 7 mutations nouvelles
  (`champ-prix-fige`, `offres-inconnues-relire`, `offres-inconnues-ligne`,
  `offres-inconnues-lot`, `attendu-inconnu`, `issue-a-revoir`,
  `relire-ratee-locale`), chacune rouge sur SON contrôle et verte sur ceux
  qu'elle ne vise pas ; l'ancre d'`issue-montant` suit la nouvelle condition ;
  les **25 mutations** relancées une par une sur ce code : **25 rouges sur 25**
  (aucun contrôle précis de `porte-lot` / `porte-et-demontage` déplacé).
  Les 84 audits verts. Bancs eBay lancés un par un (ports 4792-4798) :
  `ebay-annonces`, `ebay-programmer`, `ebay-form`, `ebay-api`, `ebay-write`,
  `ebay-callback`, `ebay-deletion` verts.
  ⚠️ **Deux bancs rouges, et ils l'étaient AVANT** (mesuré sur le build de
  bac8da1, lancés seuls) : `ebay-comptes` « publier une paire libre » tombe une
  fois sur deux ou trois sur les deux builds (« element is outside of the
  viewport » puis « not stable » sur « Oui, publier » à 1512 px — la feuille
  bouge pendant le clic ; 2 rouges sur 3 passes sur bac8da1, 1 sur 2 après), et
  `annonces-carte` « la baisse eBay se déroule jusqu'au bout » (1 rouge, le même
  sur bac8da1). Une course d'horloge du banc, pas l'écran de la règle — à
  rejouer sur une requête TENUE, comme `retenir`.
- **Non mesuré** : un `GetItem` réel d'eBay qui échoue au milieu d'une synchro
  (servi par le faux de l'audit) ; l'heure de départ d'une lecture n'a de sens que
  sur l'horloge d'UNE instance Vercel — deux instances aux horloges décalées de
  plus que la durée d'une pose pourraient encore se croiser.

#### Revue du 11 octobre, tour 3 — douze défauts signalés, douze reproduits, corrigés
Même méthode, sur c4fa405 : chaque défaut REPRODUIT (la vraie route dans le
harnais d'`audit-ebay-route`, l'app rendue sur données inventées), corrigé à la
racine, rouge sur c4fa405 (copie `git archive`, contrôle lancé DEPUIS elle,
§6.1), vert après, rouge sous une mutation qui réaffaiblit le correctif.
- ⚠️⚠️ **Une règle qu'eBay tient PEUT-ÊTRE n'était comptée NULLE PART** (n° 1 et
  n° 6, une cause). Cinq lecteurs jugeaient « règle active » chacun à sa façon
  (`offresActives === true` sur la ligne BRUTE, ou `etat === 'connue'`) : un seuil
  relu sans l'état des offres, une pose incertaine, en cours, ou posée mais pas
  relue — même quand eBay avait répondu « Success » — n'entraient ni dans la
  relecture des ventes eBay à l'ouverture, ni dans « ce que ça engage », ni dans
  la déconnexion du compte eBay, ni dans « Fermer mon compte » : **eBay pouvait
  vendre au seuil sans que VRM relise rien ni le dise**. Et, dans l'autre sens,
  la ligne brute comptait des annonces TERMINÉES et des prix changés : l'écran
  disait « 2 actives + 1 peut-être », la feuille de déconnexion « 4 ».
  ⇒ UNE règle (§11) : `regleEngage` (`'oui'` = connue · `'peut-etre'` = « pas su »
  AVEC risque, `etatRegleOffre` · `null`) et `reglesEngagees(parCompte)`, lues par
  la relecture des ventes, le bloc « ce que ça engage » (« 0 connue · 1
  peut-être », avec le geste), l'alerte « vendue sur Vinted — encore en vente sur
  eBay » (« elle a PEUT-ÊTRE une règle d'offre »), `compterReglesEbay`
  (déconnexion, fermeture : `{oui, peutEtre}`, les deux dits). Une entrée dont
  l'annonce n'est ni en ligne ni programmée sur des listes COMPLÈTES lues après
  elle (10 min de marge) ne compte plus ; listes illisibles ⇒ elle compte (« pas
  su » ne cache rien) ; le prix de la liste juge « prix changé ».
  ⇒ Côté route, une annonce terminée SORT des règles rangées : « Retirer d'eBay »
  et l'annulation vérifiée d'une programmation (`sortirDesRegles`,
  compare-et-échange : une lecture ratée n'écrit rien, la réponse dit `regles`),
  et « Relire chez eBay » sur une liste complète (`garder = {ids, a: heure de la
  liste}`, la règle de la synchro du tour 2).
- ⚠️⚠️ **Une annonce PROGRAMMÉE avec sa règle n'était jamais rangée ni relue**
  (n° 2) — même mise en ligne « Maintenant » : partie, elle sortait des
  programmées sans entrer dans Annonces, et le seuil que VRM venait d'envoyer
  n'était plus visible nulle part. ⇒ `rangerRegleProgrammee` (route) : en ligne
  maintenant (pas d'heure, ou eBay a ignoré l'heure) ⇒ relue et rangée comme une
  publication (`par: 'programmation'`) ; pour plus tard ⇒ rangée `programmee`
  avec ce qui a été ENVOYÉ (un risque : « peut-être », « Relire chez eBay ») ; le
  doublon 488 (premier essai resté sans réponse) la range aussi. Côté app, une
  programmée qu'eBay dit partie mais que la liste ne porte pas encore fait relire
  le compte (une synchro, une fois par annonce et par ouverture).
- **« Retirer la règle » manquait sur une paire bloquée** (vendue, en vente sur
  deux comptes) quand la règle n'était que « peut-être » (n° 3) : le bouton
  suit `regleEngage`, plus `etat === 'connue'`.
- **Les confirmations ne disaient pas toutes la même conséquence** : la feuille
  du lot ne disait pas qu'une offre déjà faite peut être acceptée dès la pose
  (n° 4 — `texteOffresDejaFaites`, une phrase pour la carte et le lot), celle du
  planificateur ne disait pas qu'une offre acceptée VEND la paire (n° 5 — la
  forme exigée par la décision du 9 octobre ; `OFFRE_VEND_LA_PAIRE`, une
  conséquence pour la carte, le lot, la publication et le planificateur).
- **Trois phrases ne venaient pas de la source de la carte** (§5) : « ✓ Prix
  changé — ta règle reste à 72 € » en couleur de texte sous une carte « pas su »
  ou « aucune » sur la même lecture (n° 7 — `regleApresPrix` passe par
  `etatRegleOffre`) ; la publication écrivait « pas encore relue » sur un seuil
  relu (n° 8 — `messageOffreCreation` passe par `resultatRegleOffre`, la route
  rend `range`) ; le lot écrivait « ✓ réglée » sur une règle qu'eBay a posée et
  que VRM n'a pas pu noter (n° 12 — `nonNote`, en ambre, comme la carte).
- **« Pas sur ce compte » était AVALÉ par « Relire chez eBay »** (n° 9) : eBay
  disait, sur sa liste complète, que l'annonce n'y était plus — la carte restait
  « en ligne », la ligne du haut « jamais lue », et Relire renvoyait la même
  relecture sans fin. ⇒ La carte le porte, l'écran le dit, relit la LISTE du
  compte (une synchro) ; `pas-sur-ce-compte` rejoint `PAS_SU_SANS_RELECTURE`.
- **Chaque « pas su » avec SON geste, et seulement le sien** (n° 10, n° 11) :
  deux annonces « seuil relu, offres activées ou non pas montré » avaient deux
  cartes identiques à « jamais lue », sans lien ⇒ la carte dit le seuil MONTRÉ
  par eBay et porte SON lien, la ligne du haut nomme chacune avec son lien.
  « Relire chez eBay » était proposé pour une autre devise et pour NOTRE lecture
  ratée, et le lot proposait « Relire ces 9 annonces chez eBay », un bouton qui
  n'envoyait rien ⇒ autre devise : dite, sans geste ; notre lecture ratée :
  « Réessayer » (relit VRM, rien ne part chez eBay) ; le lot dit « règle actuelle
  pas lisible dans VRM — rien n'est remplacé à l'aveugle ».
- ⚠️ **`[R-course]` tombait une fois sur plusieurs dizaines** : le faux eBay
  servait la pose et la lecture tenue dans la MÊME milliseconde, et deux `lueA`
  égaux ne s'ordonnent pas. Le contrôle attend 3 ms (la route ne change pas) —
  sur la vraie horloge, une lecture qui part avant une pose et une pose ne
  partagent pas leur milliseconde.
- **Preuves** : `audit-ebay-route.cjs` **393 contrôles** (+15 : `[R-prog-regle]`,
  `[R-retire-regle]`, `[R-lire-absente]`, `[R-engage]`, `[R-apres-prix]`,
  `[R-publie-offre]` — les deux derniers exécutent les règles de l'APP dans un
  `vm`) : **10 rouges sur c4fa405**, 0 après ; `prouve-regle-offre.cjs` : 7
  mutations nouvelles (route : `prog-non-rangee`, `retirer-garde-regle`,
  `lire-sans-garder` ; app : `engage-connue-seule`, `engage-sans-liste`,
  `apres-prix-brut`, `publie-sans-lecture`), chacune rouge sur SON contrôle — **33 sur 33** au total (28 mutations ; le XML
  sans règle toujours identique, 12 048 caractères).
  ⚠️ Le premier jet d'`apres-prix-brut` était VERT : il ne retirait que la
  ligne « offres activées ou non », et la ligne suivante disait déjà ambre — la
  mutation neutralise maintenant la règle elle-même (l'état forcé à « connue »).
  Banc `ebay-regle-offre.cjs` bloc **16** (nouveau) et blocs 2 et 13 révisés :
  **21 rouges sur le build de c4fa405** (47 contrôles à 1512 px) ; en entier,
  **342 contrôles, 0 rouge** aux deux tailles.
  `prouve-banc-regle-offre.cjs` : 13 mutations nouvelles, dont deux qui visent
  un AUTRE banc (`planif-vend` → `ebay-programmer`, `publie-pas-relue` →
  `ebay-form` : il les lance tels quels et exige le contrôle visé), relancées une
  par une : **13 rouges sur 13**, chacune sur SON contrôle. ⚠️ Le premier jet de
  `devise-relire` exigeait le premier contrôle de l'essai — vert sous la mutation
  (le clic n'envoie qu'A4 dans les deux cas) : c'est « il ne reste que la
  devise : plus de « Relire chez eBay » » qui l'attrape.
  `ebay-programmer` et `ebay-form` : +1 contrôle chacun, **1 rouge** chacun sur
  le build de c4fa405. Les 83 audits verts (`audit-renum-b` sauté) ; bancs eBay
  un par un (ports 4791-4796) : `ebay-annonces` (92), `ebay-programmer` (110),
  `ebay-form` (45), `ebay-comptes` (54), `annonces-carte` (60), `ebay-api`,
  `ebay-write`, `ebay-callback`, `ebay-deletion` verts. ⚠️ Lancés pendant les
  audits, `annonces-carte` (« les cas « règle d'offre » se déroulent », un clic
  à 4 s) et `audit-pont-session` (« il ne s'annonce qu'une fois » : 2 `ready`,
  extension intouchée) sont tombés une fois — relancés SEULS, verts.
- **Non mesuré** : ce qu'eBay répond à `GetItem` sur une annonce programmée pas
  encore partie (elle n'est pas relue avant son départ — la synchro qui suit la
  relit) ; ce qu'il rend quand une programmée part sans que la liste la porte
  encore (servi par le faux de l'audit et du banc).

### Mise en production du 5 octobre
PR #442 mergée à 10:24 UTC (80 déploiements sur 24 h : sous la limite), déploiement
de production READY sur le commit de merge, `/api/sante` répond, le zip servi
est celui de la 5.158 (382 238 octets). ⚠️ vrm.center et supabase.co sont
**bloqués par le proxy de ce conteneur** : la vérification passe par l'outil
Vercel (`web_fetch_vercel_url`), pas par `curl`.

### Logo iPhone : icônes PWA régénérées (3 octobre)
`apple-touch-icon.png` + `icon-192/512/maskable` portaient encore l'ancien logo
orange ; régénérées depuis `logo-vrm.png` (VRM Noir), maskable avec marge sur
fond `#07090D`. iOS cache l'icône d'accueil : retirer le raccourci et le rajouter.

### Relier un achat DEPUIS la vente (3 octobre)
Julien : « dans les ventes finalisées / en cours, relier les achats avec les
ventes — un gain de temps de ouf ; même si l'app ne trouve pas, elle fait une
sélection et je tranche. »
- **Mesuré dans le code** : tout existait déjà — le picker `openPicker`/
  `choosePick` (écran Annonces), le classement par `scoreAchat` (même marque/
  taille en tête), `AchatRelie` (photo + reçu), et la carte de vente AFFICHAIT
  déjà l'achat relié (`<AchatRelie entry={e}/>`). **Le seul trou : aucun moyen de
  CRÉER le lien depuis la vente** — on ne pouvait le faire que depuis Annonces.
- Ajouté sur chaque carte de vente (sauf annulée) : **« Relier l'achat »** quand
  aucun coût n'est connu, **« changer »** quand un achat est déjà relié. Le clic
  ouvre le MÊME picker (§11), trié par pertinence — « la sélection » qu'il
  demande ; c'est toujours SON clic qui relie, **jamais un rapprochement
  automatique par titre** (§5, garanti par `audit-identite`).
- **Deux chemins, une seule info** : une vente AVEC identité d'annonce
  (`identiteAnnonce` → item_id) relie la **paire** (`numeros[id]`, partagé avec la
  compta et l'écran Annonces) ; une vente SANS identité relie la **vente**
  elle-même (override `saleOv[tx]`, `_saleTx`). `choosePick` branche sur `_saleTx`,
  `effEntry` fait ressortir `buyFromId`/`buyFrom` de l'override, `linkedBuyIds`
  inclut les deux (un achat déjà relié ne se repropose pas). `withBuyByNum` ne
  remplit que si vide → l'override n'est jamais écrasé.
- Le coût rempli alimente la marge, le bénéfice et la compta par les voies
  existantes (`buyOf`/`benef`), sans second calcul.
- ⚠️ **Non render-vérifié ici** (pas de fixtures dans ce conteneur) : build +
  `audit-identite/chiffres/variables/icones/coherence` verts, la logique réutilise
  le flux déjà éprouvé de l'écran Annonces, mais le rendu de la carte de vente est
  à regarder au banc dès qu'il y a des fixtures. C'est de la plomberie + UI, pas
  une nouvelle règle de rapprochement.

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

### « Vendu » et « reçu » : deux notions, deux mots (n° 20, 4 octobre)
Julien, 3 octobre : « il y a les ventes que l'on fait en une journée et
l'argent que l'on reçoit — je veux un graphique avec les ventes de la journée ».
Le héros de Ma journée écrivait « **Chiffre d'affaires** » sur les ventes FAITES
(en cours comprises, Vinted seul, `liveStats` figé au montage) — le mot du CA
déclaré, qui est l'argent reçu.
- **VENDU** = `ventesFaites` : date de VENTE, toutes plateformes, en cours
  comprises, hors annulées et hors ventes/comptes cachés (`isHidden`).
  Leboncoin sans `dateVente` n'est dans aucun jour (`sansDate`). Propriétaire
  dans l'écran : `vendus` → `bilanVentes` (« Vendu aujourd'hui », « Vendu en
  {mois} ») et la colonne VENDU du graphique — une seule liste.
- **REÇU** = `ventesDeclarables` (le CA déclaré, date de VERSEMENT). Le memo
  `declarables` est partagé par la publication `vinted_urssaf_mois` ET l'écran :
  « Reçu en {mois} » est le même nombre que la carte URSSAF du tableau de bord.
- Carte **« Tes 14 derniers jours »** (`BarresVenduRecu`, qui remplace
  `MiniBarres` jamais rendue) : deux barres par jour, VENDU à l'accent, REÇU à
  l'encre neutre, même échelle. Versements illisibles ⇒ **aucune** barre
  « reçu », jamais des zéros ; une vente finalisée sans date de versement est
  dite une fois sous le graphique.
- « Vendu aujourd'hui » dit des **ventes**, plus des « paires » (un lot vaut 1).
- Statistiques : « CA du mois » → « **Vendu ce mois** » (même chiffre, bon mot).
- Banc `vendu-recu.cjs` (ventes inventées, 30 contrôles, juge les `data-*`).
  Réaffaibli (annulée comptée + reçu daté à la vente) → **11 rouges**.
- ✅ **Fermé le 4 octobre** : `liveStats` (Statistiques « Aujourd'hui », « Vendu
  ce mois », la courbe des mois, la jauge d'objectif, le widget `caMois`) était
  un SECOND calcul du vendu — Vinted seul, comptes bloqués exclus, Leboncoin et
  eBay oubliés. Mesuré au banc sur le code d'avant : « Aujourd'hui » **50 €** au
  lieu de **90 €**, « Vendu ce mois » **175 €** au lieu de **275 €**, et le
  widget pareil. ⇒ La coque relit les ventes de TOUS les comptes liés (même
  lecture, `_acc` posé) et `liveStatsVus` passe par **`ventesFaites` puis
  `resumeVendu`** — la même règle que Ma journée ; un compte s'écarte par
  `compteEcarte` (masqué dans l'app ou éteint dans l'ancien panneau, une seule
  définition pour la compta et la coque). Le widget n'écrit plus depuis l'effet
  de lecture : il publie `widgetBase` + le vendu unifié, et seulement quand
  le JSON change. Ventes illisibles ⇒ on garde l'ancien calcul (« rien lu » ne
  vaut pas « rien »). Banc `vendu-recu.cjs` : **36 contrôles**, et **4 rouges**
  sur le code d'avant **instrumenté des mêmes attributs** (« la fonction
  n'existait pas » n'aurait rien prouvé).

### « Ce que Vinted transmet aux impôts » — les seuils DAC7, compte par compte (6 octobre)
Chaque année, Vinted transmet aux impôts les vendeurs qui font **au moins 30
ventes OU plus de 2 000 €** dans l'année civile (directive européenne DAC7).
**Mesuré avant de coder** (lecture seule, sa base) : `grep DAC7` = 0 dans l'app ;
7 comptes liés, aucun exclu ; ventes **finalisées** de 2026 — `julatace35260`
**101 · 3 721,10 €** (les deux seuils), `llloollllaa` **49 · 1 775,70 €**,
`tomj606` **33 · 1 433,50 €** (30 ventes), puis 27 · 20 · 16 · 0, sous les seuils.
- **Où** : Ventes → Outils → **Registre annuel**, UNE carte (`CarteSeuilsVinted`),
  pour l'année choisie. Ton informatif : aucun rouge ni ambre (§7), un seuil
  atteint se dit par le mot, en gras.
- ⚠️ Le premier jet (2c85fe1) disait « pour qu'il n'y ait jamais d'écart avec ce
  que tu déclares » et comptait comme SÛRES des ventes sans date de versement :
  **c'était faux** — voir la revue juste en dessous. Ne pas le remettre.
- **Trois états** : registre pas encore calculé · **lecture ratée ⇒ « — » et la
  raison, jamais « 0 vente »** · lu. Un compte **exclu** n'y entre pas (décision
  du 3 octobre) ; une ligne neutre dit que les exclus ne sont pas comptés, **sans
  les nommer**. « Plus de 2 000 € » se compare en centimes : 2 000,00 € pile ne
  l'atteint pas.
- **Pas mesuré / pas affirmé** : les sources primaires (impots.gouv.fr,
  economie.gouv.fr, Légifrance, EUR-Lex, BOFiP) sont **bloquées par le proxy du
  conteneur** — les seuils sont écrits tels quels, recoupés sur des sources
  secondaires, et **rien d'autre n'est affirmé** (ni date de début, ni ce que
  Vinted envoie au vendeur, ni la date que Vinted retient pour rattacher une
  vente à l'année). Non mesuré : si Vinted juge chaque compte à part ou
  regroupe les comptes d'une même personne ; le montant exact qu'il retient (VRM
  prend le prix de l'article, comme le CA déclaré) ; Leboncoin et eBay, soumis
  aussi à DAC7, ne sont pas dans cette carte.

#### Revue contradictoire du 6 octobre — six défauts, corrigés le 8 octobre
Un relecteur les a REPRODUITS au rendu ; la première correction (d9bac7e) a été
interrompue, reprise et finie.
- ⚠️⚠️ **Le cache des ventes changeait un compte en panne en « 0 vente · sous les
  seuils »** au passage suivant (rechargement ou retour sur l'écran dans les
  3 min) — et le bandeau « compte non chargé » de l'écran Ventes disparaissait
  aussi. `putCache` gardait la liste partielle **sans** dire quels comptes
  avaient raté. Une entrée de cache porte maintenant `failedUids` (version
  `_CACHE_V` : une entrée d'avant, qui ne sait rien de ses échecs, est ignorée),
  et `loadOrders` les rend avec la liste. Une relecture discrète ratée garde ce
  qu'on montrait **du seul compte raté** (elle gardait toute l'ancienne liste
  avec la nouvelle liste d'échecs : un compte raté avant et revenu passait à
  « 0 vente »). Le cache des annonces et des conversations garde aussi ses
  comptes ratés. « Rouvre l'écran Ventes » est devenu un vrai bouton
  **« Relire mes ventes »** (`relireVentes` : vide le cache, relit notre base —
  jamais Vinted — et les dates de versement si elles étaient illisibles).
- **Un échec se juge par l'IDENTITÉ** (`failedUids`), plus par le nom affiché :
  un libellé arrivé du nuage après la lecture faisait passer le compte en panne
  pour lu. Vaut pour la carte, le bandeau de l'écran Ventes, le rapport mensuel
  et le geste « J'ai déclaré ce mois » (`nomsVentesKO`, nommé au rendu).
- ⚠️⚠️ **La partie sûre de la carte EST le chiffre du registre** — mesuré sur la
  copie de sa base du 5 octobre : carte 245 ventes · 9 361 € contre registre
  141 · 5 226 €. Le registre calcule, par compte, ses ventes Vinted de l'année
  (`vintedParUid`, mêmes lignes que son total : mois de la déclaration s'il l'a
  notée, sinon du versement) et sa liste « pas encore datées » ; la carte LIT les
  deux (`seuilsVintedParCompte` ne rappelle plus `ventesDeclarables`, §11).
  Mesuré après sur la même copie : **carte 141 · 5 226,30 € = registre**, plus
  **104 ventes · 4 134,80 € « pas encore datées »**, dites à part comme une
  **estimation** (rattachées à l'année par la date de vente et la borne de
  45 jours : le versement suit la vente — **0 sur 173** avant elle — et au plus
  **25 jours** après, médiane 7,8 j ; une borne mesurée, pas une certitude).
  Un seuil atteint seulement avec elles se dit « **atteint si** … ».
  ⚠️ Le premier correctif recalculait ces ventes **sans** le registre des
  déclarations : une vente déclarée sans date comptait deux fois.
- **VRM ne sait pas si Vinted juge chaque compte à part** : la carte le dit, et
  ajoute une ligne « **Tous tes comptes ensemble** » (« au moins » et « sans X »
  quand un compte manque — jamais « sous les seuils » sur un total partiel).
  Année en cours : « **à ce jour** » et « encore N ventes ou X € avant le seuil »
  (sur la partie sûre ; « plus de 2 000 € » ⇒ il faut 2 000,01 €).
- §7 : la panne et « Lecture des ventes… » se disent **une fois** au-dessus des
  lignes ; la ligne d'un compte pas lu ne porte qu'un « — ».
- **Constaté, laissé tel quel** : l'année suit le fuseau de l'APPAREIL
  (`getFullYear`), comme `ventesDeclarables` et le registre — une vente versée
  le 1er janvier à 00 h 20 (Paris) compte l'année d'avant sur un téléphone réglé
  à Londres. Changer la carte seule la ferait diverger du registre.
- **Preuves** : `audit-seuils-vinted.cjs` (vraie règle dans un `vm`, ventes
  inventées) **39 contrôles**, **34 rouges** sur 2c85fe1, et chacune des **11
  mutations** le refait passer au rouge (`exclus` 4 · `passu` 5 · `versnull` 2 ·
  `encours` 4 · `seuil2000` 3 · `adater` 13 · `recalcule` 17 · `strict` 2 ·
  `totalsous` 1 · `reste` 2 · `acejour` 1). Banc `bancs/seuils-vinted.cjs`
  (port 4802, aucune fixture, 390 et 1512 px, cinq scénarios : comptes,
  cache, libellé tardif, panne totale, année passée) **99 contrôles, tout vert**, **70 rouges**
  sur le build de 2c85fe1, et rouge sur trois builds réaffaiblis du code
  d'après : cache rendu sans ses échecs (**4**), échecs reconnus par le nom
  (**2**), « pas encore datées » recalculées sans les déclarations (**2**).
  `rapport.cjs` et `vendu-recu.cjs` restent verts.
- **Pas mesuré** : la carte n'a pas été vue sur sa vraie base dans l'app (bancs
  sur données inventées ; les chiffres ci-dessus viennent de la règle exécutée
  sur la copie locale du 5 octobre).

#### Deuxième revue (9 octobre) — le cache ne savait pas QUELS comptes il couvrait
Deux défauts, reproduits chacun par deux relecteurs au rendu, corrigés.
- ⚠️⚠️ **Un compte lié depuis la dernière lecture s'affichait « 0 vente · sous
  les seuils »**, et le total « tous tes comptes » se disait complet. L'entrée de
  cache des ventes ne retenait que ses ÉCHECS : liste de comptes du navigateur
  en retard sur la base, ou rechargement dans les 3 min après une liaison ⇒
  `loadOrders` resservait le cache des anciens comptes ; le nouveau n'était ni lu
  ni en échec. Dans l'autre sens, un compte **retiré** restait compté au
  registre (95 ventes contre 62 sur la carte).
  ⇒ L'entrée de cache ET l'état des ventes portent `comptes`, la clé des comptes
  interrogés (`cleComptesVinted` : les identités triées — jamais un nombre, jamais
  un nom). `entreeCache` ne sert qu'une entrée qui couvre **exactement** les
  comptes d'aujourd'hui (`_CACHE_V` = 3), et les relectures suivent `cleComptes`
  au lieu de `accounts.length` (un compte retiré + un lié = même longueur). Même
  règle pour les annonces, les achats et les conversations. Et tant que la
  lecture ne couvre pas les comptes d'aujourd'hui, le registre dit « lecture en
  cours » (`ventesComptees` vaut `null`) et « J'ai déclaré ce mois » attend.
- ⚠️ **Relecture discrète ratée** (signal de l'extension, un compte déjà lu ne
  répond pas) : la liste garde ses ventes d'avant ; le registre les COMPTAIT tout
  en écrivant « ventes de X pas lues », et la carte (« sans X ») donnait un autre
  total. ⇒ **Un compte en échec n'entre dans AUCUN total** (`ventesComptees`
  écarte `failedUids`), qu'on ait déjà vu ses ventes ou non — la liste, elle,
  continue de les montrer. Carte == registre, et la phrase dit ce que le chiffre
  contient. Par ricochet : la ligne publiée au tableau de bord
  (`vinted_urssaf_mois`) ne part plus pendant qu'un compte non exclu est en échec
  (le tableau de bord garde la dernière, complète) ; Ma journée écrit « Reçu en
  {mois} · **sans X (ventes pas lues)** » ; le total « à la date de vente » du
  formulaire de déclaration lit la même liste.
- **Preuves** : banc `seuils-vinted.cjs` **165 contrôles** (scénarios F1 compte
  lié · F2 rechargement · F3 compte retiré · G relecture discrète · H Ma journée,
  plus l'égalité registre == carte après la relecture ratée de B) — **11 rouges**
  sur le build d'avant (e719d0f), et **5 rouges** sur un build où le cache « se
  croit » (entrée sans clé de comptes). `audit-seuils-vinted.cjs` **45 contrôles**
  (+6 sur la clé) ; mutations `clelongueur` 3 rouges, `clenom` 2.
  `audit-urssaf.cjs` exigeait l'orthographe `vinted: sales.items` : il suit la
  règle (Leboncoin et eBay passés à la même fonction).
- **Constaté, laissé tel quel** : les totaux de l'écran Ventes et « Vendu »
  (`ventesFaites`) comptent encore les ventes d'avant d'un compte en échec — de
  l'affichage, pas le CA déclaré ; le bandeau « compte non chargé » le dit.
  **Pas mesuré** : rien n'a été vu sur sa vraie base (données inventées).

### La page d'accueil publique (n° 22, 4 octobre)
Julien : « une vraie page d'accueil… qui donne envie… avant d'arriver sur la
connexion », avec une vidéo en motion design, inspirée de Vinteer.
- `src/Accueil.jsx`, rendue par `main.jsx` (`Racine`) **seulement sans
  session** ; l'app (`App.jsx`, ~340 Ko gzip) est un morceau à part, chargé au
  clic et préchargé au survol des boutons. Une session, `?code=`,
  `#access_token=`, `?tab=`, `?connexion`, `?inscription` ⇒ droit dans l'app,
  **sans éclair** de page d'accueil. « Créer mon compte » ouvre le formulaire
  d'inscription (`?inscription`), et l'écran de connexion a « ← Découvrir VRM ».
- La démo est une **fonction pure du temps** (6 scènes × 4,2 s, dessinée en
  720×470, ou 420×500 sous 560 px de large), arrêtée hors écran, immobile avec
  « réduire les animations ». ⚠️ Le temps suit l'**horloge**, pas le nombre
  d'images : bornée à 0,05 s par pas, elle tournait à moitié vitesse à 9 images/s
  (mesuré en rendu logiciel à 1512 px).
- ⚠️ `overflow-x:hidden` sur la racine empêchait la barre du haut de rester
  collée : `overflow-x:clip` (repli `hidden` si non supporté).
- **Honnêteté** : le prix « gratuit » vient des CGV, « aucune donnée revendue »
  de la politique de confidentialité, aucun chiffre de clientèle ni étoile —
  le banc `accueil.cjs` (36 contrôles) le vérifie.
- **La vidéo** : `?film` rend l'animation seule ; `scripts/film-accueil.cjs`
  l'exporte image par image en MP4 (1920×1080 et 1080×1920, 25,2 s, ~1 Mo).
  Les MP4 ne montent pas dans le dépôt : ils se régénèrent après chaque
  changement de la démo (`npm run build` puis le script).

### ⚠️⚠️ L'ABONNEMENT : 12,99 €/MOIS (9,99 € JUSQU'AU 11 OCTOBRE), ET QUI NE PAIE PLUS NE VOIT PLUS RIEN (4 octobre)
Julien : « un abonnement à 10 € par mois » puis « **9,99** », « pour tout le monde
sauf moi », « prélevé chaque mois à partir du moment où la personne s'abonne »,
puis « la personne ne doit plus recevoir de notifications, voir ses données,
etc. lorsqu'elle ne paye plus ».
- ⚠️⚠️ **11 OCTOBRE : LE PRIX PASSE À 12,99 € PAR MOIS** — décision de Julien
  après l'étude du coût par abonné (« on va passer à 12,99 par mois » : 12,99 €
  TTC, la TVA arrivant tôt pour lui). Ce qui le dit : les CGV (encadré et
  article 2, « Dernière mise à jour : 11 octobre 2026 » ⇒ `CGV_VERSION =
  '2026-10-11'`, rangée dans les métadonnées Stripe), la page d'accueil (FAQ,
  section Prix), le repli de l'app (`PRIX_CGV_LISIBLE`) et le serveur
  (`PRIX_CGV`, en centimes). Mesuré : **0 ligne dans `abonnements`** — personne
  ne payait 9,99 €, aucun abonné à basculer.
  ⚠️⚠️ **LE GESTE DE JULIEN — ET TANT QU'IL N'EST PAS FAIT, LE PAIEMENT EST
  FERMÉ.** Le montant PRÉLEVÉ est celui du prix rangé chez Stripe sous la clé
  `vrm_mensuel` (encore 9,99 €), et un prix Stripe ne se modifie pas, il se
  recrée : **Stripe → Produits → le produit VRM → « Ajouter un prix » : 12,99 €,
  récurrent, mensuel, clé de recherche `vrm_mensuel`, cocher « transférer la clé
  de recherche »** (l'ancien prix la perd ; l'archiver ensuite). Le connecteur
  Stripe n'était pas autorisé dans la session du 11 octobre : **ce n'est pas
  fait**, et ça ne se simule pas. À refaire en mode réel le jour du passage.
  ⇒ **L'app le détecte, côté serveur** : `checkout` compare le prix lu chez
  Stripe à `PRIX_CGV` (`prixConforme` : mêmes centimes, en euros, une fois par
  mois) et, s'il diffère, **n'ouvre PAS le paiement** — 503 `prix-cgv`, « Le
  paiement n'est pas encore ouvert : rien n'a été prélevé » (au vendeur, SANS
  le montant de Stripe — revue ci-dessous). Jamais 9,99 € prélevés sur des CGV
  acceptées à 12,99 €. La carte « Mon compte » ne relaie pas un prix non
  conforme (`prix: null`, `prixConforme: false` ⇒ « le paiement n'est pas
  encore ouvert », aucun bouton) ; seul le PROPRIÉTAIRE reçoit le montant de
  Stripe (`prixStripe`) et sa carte dit les deux prix et le geste. Stripe muet ⇒
  `prixConforme: null` (« pas su »), jamais « différent ». Les journaux Vercel
  le disent aussi (`[stripe] prix « vrm_mensuel » = … ≠ CGV …`).
  ⚠️ Ce contrôle ne porte que sur les NOUVEAUX paiements : un abonnement déjà
  souscrit garde son prix chez Stripe (aucun aujourd'hui).
  - Preuves : `audit-abonnement.cjs` **74 contrôles**, **11 rouges** sur le code
    d'avant ; trois mutations, chacune rouge : contrôle retiré (7), prix relayé
    quand il diffère (1), intervalle oublié (2). `audit-lancement.cjs` **30** —
    UNE valeur : CGV ×2 = `PRIX_CGV` = `PRIX_CGV_LISIBLE` = page d'accueil ;
    3 rouges sur l'avant, serveur resté à 999 ⇒ rouge, seconde valeur écrite à
    côté de la constante ⇒ rouge. Banc `abonnement.cjs` **60** — 3 rouges sur le
    build d'avant (il affichait « 9,99 € / mois » et « S'abonner » quand Stripe
    différait des CGV).
  ⚠️⚠️ **REVUE DU 11 OCTOBRE — QUATRE DÉFAUTS DE CE CHANGEMENT DE PRIX, REPRODUITS
  AU RENDU (1512 et 390 px) ET EN EXÉCUTANT `api/compte.js`, TOUS CORRIGÉS.**
  Latents aujourd'hui (abonnement facultatif, 0 abonné), réels le jour où il
  passe `abonnement_obligatoire` à '1' sans avoir recréé le prix — et en mode
  réel, il devra le refaire.
  1. ⚠️⚠️ **La PORTE (second écran qui vend l'abonnement, §11) proposait
     « S'abonner » quand le paiement est fermé** : « 12,99 € / mois », la case
     des CGV, un bouton actif — et le clic menait au refus 503, dont le message
     nommait par-dessus **le prix réglé chez Stripe (9,99 €) à un vendeur**. La
     carte « Mon compte » évitait ce bouton, la porte non. ⇒ `paiementFerme`
     (`prixConforme === false`, ou Stripe pas branché, et pas un impayé) : ni
     case, ni bouton, aucun prix — « le paiement n'est pas encore ouvert, rien
     n'a été prélevé, tes données t'attendent » — et « Se déconnecter » reste.
     Un impayé garde « Mettre à jour ma carte ». Le refus 503 ne part jamais au
     propriétaire (409 avant) : il est **générique** pour tout le monde, le
     détail (les deux prix, le geste) reste dans `console.warn` et sur la carte
     du propriétaire.
  2. **Un ANCIEN abonné perdait la liste de ses factures** (sa compta) : la
     branche `prixConforme === false` de la carte rendait la carte seule — les
     factures étaient demandées puis jamais affichées. Elle rend `listeFactures`
     comme la branche d'en dessous.
  3. ⚠️ **L'alerte du propriétaire pouvait écrire deux prix IDENTIQUES** —
     « le prix réglé chez Stripe (12,99 € / mois) n'est pas celui des CGV
     (12,99 € / mois) » pour un prix en dollars, tous les 3 mois ou par semaine
     — **ou « 0,00 € »** pour un prix sans montant fixe : `prixLisible` ignorait
     la devise et le rythme, et `lirePrix` changeait `unit_amount: null` en 0.
     C'est justement quand il se trompe de devise ou de récurrence dans Stripe
     qu'elle doit le lui montrer. ⇒ Le serveur écrit le texte (`prixTexte` :
     montant, **devise** — « 12,99 USD » —, **rythme** — « / semaine »,
     « tous les 3 mois », « en une fois » —, « sans montant fixe » jamais 0) et
     le rend dans `prixStripe.texte` ; la carte l'affiche **tel quel**.
     `prixTexte(PRIX_CGV)` vaut exactement `PRIX_CGV_LISIBLE` (vérifié).
  4. **Un abonné actif lisait « Abonné · 12,99 € / mois » en payant 9,99 €** :
     la carte retombait sur le prix de l'offre (ou des CGV quand le serveur ne
     le relayait pas), juste au-dessus de factures à 9,99 €. Or un abonnement
     Stripe garde le prix auquel il a été souscrit (les CGV le disent). ⇒ le
     serveur lit le prix de **SON** abonnement (`prixAbonnement` : l'article de
     l'abonnement chez Stripe, vérifié sur son client, un seul article) ; pas
     su ⇒ la carte écrit « Abonné » **sans montant**, jamais un prix deviné.
     ⚠️ Ça coûte une lecture Stripe de plus à l'ouverture de « Mon compte »,
     pour un abonné seulement.
  - Preuves : `audit-abonnement.cjs` **91 contrôles**, **17 rouges** sur
    2851ef4 ; quatre mutations, chacune rouge : l'ancien formateur (6), le
    refus qui renomme le prix Stripe au vendeur (1), le prix de l'abonnement lu
    sans vérifier le client (1), `prixAbonnement` = prix de l'offre (5). Banc
    `abonnement.cjs` **82** (la porte aux deux tailles, Stripe ≠ CGV et Stripe
    pas branché) — **13 rouges** sur le build de 2851ef4, et **13 rouges** sur
    un build réaffaibli des quatre correctifs à la fois (chaque groupe de
    contrôles tombe sur SA mutation).
- **Stripe en MODE TEST seulement**, sans bibliothèque (`api/_lib/stripe.js`) :
  Checkout (abonnement), portail de gestion, webhook signé (HMAC sur le corps
  BRUT, comparaison en temps constant, 5 min de tolérance), version d'API
  **figée** (`2026-08-26.dahlia` : `current_period_end` vit sur l'article).
  Prix : clé `vrm_mensuel`. Tout passe par **`api/compte.js`** (le plan Hobby
  plafonne à **12 fonctions** et le projet y est : `api/sante.js` y est devenu
  un mode, `vercel.json` garde `/api/sante` et `/api/stripe-webhook`).
- **Qui paie** : le serveur ne croit JAMAIS un identifiant du navigateur — il
  demande à Supabase qui porte le jeton (`api/_lib/session.js`). Le statut ne
  s'écrit QUE sur un événement Stripe signé, dans `abonnements` (lisible par le
  vendeur, inscriptible par la clé de service seule — migration 005). Un
  événement plus ancien n'écrase pas un plus récent ; une écriture ratée
  répond 5xx (Stripe réessaie). Retour de paiement : adresse FIXE.
- ⚠️⚠️ **LA RÈGLE D'ACCÈS VIT DANS LA BASE, EN UN SEUL ENDROIT** (migration 006,
  `vrm_regle_acces`) : accès si l'abonnement n'est pas obligatoire · ou
  propriétaire · ou `active`/`trialing` · ou `past_due` depuis **moins de
  14 jours** (Stripe réessaie ; `impaye_depuis` garde le PREMIER échec, posé
  par le webhook, effacé au retour du paiement). Elle est lue par :
  · **la base elle-même** — politiques RESTRICTIVES `abonnement_requis` sur
    `app_data` et `vinted_accounts` (en « ET » avec les règles d'owner) : ni
    l'app, ni l'extension, ni un appel à la main ne lisent ni n'écrivent ;
  · **l'app** — `vrm_acces` → `/api/compte?mode=abonnement` rend `acces`, et
    `PorteAbonnement` se ferme sur `acces === false`, sans rien recalculer ;
  · **le serveur** — `vrm_acces_pour` (`api/_lib/abonnement.js`) : plus aucune
    notification (`sendPushToAll` → `coupe:'abonnement'`, sa liste d'appareils
    n'est même pas lue) et le widget répond **402 sans aucun chiffre**.
  ⚠️ Avant, « obligatoire » et « propriétaire » étaient deux variables
  d'environnement : l'écran aurait pu dire « abonné » pendant que la base
  refusait ses lignes (§11). Elles ne sont plus lues.
- **Rien n'est supprimé** : les données d'un vendeur coupé restent intactes
  (la clé de service continue de ranger ses emails) et réapparaissent dès qu'il
  reprend. Ses appareils restent enregistrés : les notifications reviennent
  sans rien réactiver.
- **« Pas su » ne coupe pas** : la base ne répond pas sur l'accès ⇒ on notifie,
  le widget répond, la porte reste ouverte (on ne fait pas rater une vente à un
  payeur pour un hoquet) — mais `/api/compte?mode=abonnement` répond 503, jamais
  une réponse devinée. Le verrou qui compte, ses DONNÉES, est tenu par RLS.
- ⚠️⚠️ **TROUVÉ EN BRANCHANT LA COUPURE : `/api/push` NE SAVAIT PAS À QUI ÉTAIT
  UN TÉLÉPHONE.** Il rangeait l'appareil chez le propriétaire de l'installation :
  le téléphone d'un second vendeur aurait reçu les ventes de Julien. Prouvé au
  banc (« rangé chez 9999… »). Base cloisonnée ⇒ la route exige la session
  (401 sinon) et tout se passe dans le contexte de CE vendeur ; l'app et
  `main.jsx` envoient le jeton (main.jsx attend qu'il soit frais, jamais
  d'envoi anonyme). Et deux défauts voisins : la sonde `cloisonnee()` mémorisait
  « non » sur une panne (lecture SANS filtre = les appareils d'un autre), et
  `pushCategorieActive` passait un booléen à `duVendeur` — dès qu'un vendeur
  était connu, ses préférences de notification étaient ignorées.
  ⚠️ Le `pushsubscriptionchange` du service worker n'a pas de session : il
  reçoit 401, et c'est l'ouverture suivante de l'app qui ré-enregistre.
- **Réglage** : `vrm_reglages.abonnement_obligatoire` vaut **'0'** — RIEN n'est
  bloqué aujourd'hui. Julien le passe à '1' quand Stripe est en mode réel ET que
  les CGV et la page d'accueil sont à jour (fait le 4 octobre, voir plus bas). Le
  propriétaire est `vrm_reglages.proprietaire` (= `VRM_OWNER_UID`).
- **À lui** : `STRIPE_SECRET_KEY` (sk_test_…) sur Vercel — le webhook et son
  secret sont posés. La règle SQL a été exécutée sur la vraie base dans une
  transaction ANNULÉE (cinq cas, rien n'a persisté).
- Preuves : `audit-abonnement.cjs` (**44 contrôles**, exécute les vraies routes —
  **14 rouges** sur le code d'avant, dont le téléphone rangé chez le
  propriétaire et le widget qui montre ses chiffres ; réaffaibli → 5 rouges) ;
  banc `abonnement.cjs` (**27**, rendu : la porte suit `acces`, un impayé de
  plus de 14 jours envoie mettre la carte à jour, jamais repayer — 3 rouges sur
  le build d'avant).

### L'onglet « Mon compte » : abonnement, carte, factures, résiliation (4 octobre)
Julien : « un onglet pour gérer l'abonnement et les factures dans les
paramètres, avec ses infos de compte regroupées ». Les Paramètres ont deux
onglets (`data-onglets-reglages`) : **Réglages** (l'app) et **Mon compte** (la
personne : identité, prénom, abonnement, carte, factures, connexion, ses
données). Sans session, pas d'onglets. `?vue=compte` (retour de Stripe) ouvre
le bon onglet.
- `api/compte.js` : `mode=factures` (SES factures et SA carte — le client Stripe
  vient de SA ligne lue avec son jeton, jamais d'un paramètre ; seules les
  adresses `*.stripe.com` sont transmises ; Stripe muet ⇒ 502, **jamais** « aucune
  facture ») · `mode=resilier` / `mode=reprendre` (POST seulement ;
  `cancel_at_period_end` — la résiliation prend effet en FIN de période, comme le
  portail ; l'abonnement doit appartenir à CE client, sinon 403 ; la ligne est
  réécrite tout de suite depuis la réponse de Stripe). Résilier en ligne est une
  obligation en France (art. L215-1-1).
- **CGV et page d'accueil disent 12,99 € par mois (9,99 € jusqu'au 11 octobre),
  sans engagement.** Tant que
  `abonnement_obligatoire` vaut '0', elles disent aussi que l'accès est offert —
  ⚠️ **le jour où Julien passe le réglage à '1', retirer cette phrase** de
  `src/Accueil.jsx` (FAQ « Combien ça coûte ? » et section Prix) et de l'encadré
  des CGV. Le banc `accueil.cjs` lit le prix DANS les CGV (une seule source).
- Preuves : `audit-abonnement.cjs` **62 contrôles** (14 rouges sur l'avant) ;
  banc `abonnement.cjs` **42** (13 rouges sur le build d'avant).

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

### ⚠️⚠️ VENDUE SUR LEBONCOIN → À RETIRER DE VINTED (anti double vente, 4 octobre, 5.152)
Julien : « quand une paire est vendue sur une plateforme, elle doit disparaître
des autres, pour éviter de vendre deux fois la même paire ». Le sens Vinted →
Leboncoin existait (« à retirer de Leboncoin ») ; **l'autre sens n'existait pas** :
une vente Leboncoin ne disait rien de la paire, qui restait en vente sur Vinted.
**Mesuré avant de coder** : 3 ventes Leboncoin où il est le vendeur (dont un colis
à envoyer), toutes sur des annonces reliées à **aucune** paire.
- **Un seul chemin d'identité** (`doublesVenteLbc`, une règle pour l'écran
  Leboncoin ET le tableau de bord, §11) : vente (il est le VENDEUR, pas annulée —
  `lbcAnnulee`) → son annonce (`itemId`) → ses clés (`clesAnnonceLbc` : lien posé
  à la main, réf VRM, « nXXX » du titre) → le N° → l'annonce Vinted de ce N°.
  Encore en vente ⇒ alerte en tête de l'écran Leboncoin, avec le lien Vinted ;
  prouvée vendue sur Vinted aussi ⇒ « vendue deux fois, annule-en une ».
- ⚠️ **VRM ne retire pas l'annonce Vinted tout seul** : §3 (irréversible, sans
  confirmation côté Vinted). C'est lui qui agit ; l'app dit quoi et où.
- **Une vente non reliée ne désigne JAMAIS une paire toute seule** : elle demande
  « quelle paire ? » et PROPOSE jusqu'à trois paires en ligne qui ressemblent
  (`suggestionsPaires` : mots, pointure, prix) — **c'est son clic qui relie**
  (`relierAnnonceLbc`, la même écriture que le champ N°). Une pointure
  DIFFÉRENTE exclut (même modèle, autre paire, §2.4).
  ⚠️ **L'audit a attrapé ma première règle de pointure** : elle prenait le
  premier nombre venu, donc « 90 » dans « Nike Air Max **90** … taille 44 », et
  proposait une paire en 42.
- ⚠️⚠️ **`account` NE PROUVE PAS QU'UNE ANNONCE EST À LUI.** Mesuré : 58
  annonces portent ce champ, sur **48 comptes** — la 5.88 étiquetait celles
  d'AUTRUI de leur propre propriétaire. J'ai failli l'ajouter à `aLui` (« 57
  annonces à lui ») : ça aurait mis 50 annonces d'inconnus dans « non reliées ».
  Ce qui prouve : une vente où il est le VENDEUR désigne une annonce, dont le
  compte est donc le sien (`comptesLbcProuves`). Chez lui : **1 compte, 8
  annonces, dont 7 qu'aucune règle ne voyait**. Même règle dans l'extension
  (`estALui(ad, prouves)`), `audit-places` compare les deux.
- Une annonce **vendue** sur Leboncoin n'y est plus en vente : elle sort de « en
  ligne », « à retirer » et « non reliées » (app et extension).
- **Le tableau de bord disait « vendue sur Vinted » sur une ABSENCE** (annonce
  publiée sur Leboncoin et plus en ligne sur Vinted — une mise en pause suffisait,
  la règle que l'écran Leboncoin a abandonnée le 12 septembre). Il ne compte plus
  que les ventes prouvées (`soldIdsN`). Il lit les ventes Leboncoin (5 Ko) et ne
  lit les annonces (226 Ko) que si une vente ne se relie pas sans elles, une fois
  par session (`lbcAnnoncesSession`).
- Preuves : `audit-double-vente.cjs` (**20 contrôles**, exécute les vraies règles
  de l'app et de l'extension ; `--prouve` réaffaiblit → **6 rouges**) ; banc
  `double-vente.cjs` (**28**, deux tailles, données inventées, il vit dans le
  dépôt — **20 rouges** sur le build d'avant). Le banc écrit `main` pour de vrai
  quand l'app sauvegarde : sans ça le lien posé « disparaissait » au rechargement
  (§6.3, un banc qui ne garde pas les écritures mesure une fiction).
- Au passage : `lbc-relier.cjs` était rouge depuis la 5.137 (`adRefKeys` appelle
  `cleNum` et `RE_VRM`, que son `vm` ne chargeait pas).
- Extension **5.152.0**, zip régénéré, `EXT_ATTENDUE` suivie. Aucune entrée
  d'`EXT_CAPACITES` : l'app ne promet rien de neuf de l'extension.
- **Reste à faire** : eBay (une autre session s'en occupe) n'entre pas encore
  dans ce contrôle — une vente eBay devra suivre la même règle (SKU `VRM-{n°}`).

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

### eBay : UN seul bouton pour mettre une paire en vente (4 octobre)
Julien : « il y a deux fois le bouton pour poster les paires, ça ne me convient
pas du tout ». **Mesuré** : le même publieur (`EbayPublier`, « Vendre une paire
sur eBay ») était monté dans **Annonces ET Compte eBay**. Le 3 octobre (#390) il
avait été « déplacé » vers Annonces en l'AJOUTANT là-bas, sans le retirer de
`EbayConnexion` — et la liste des annonces avec son « ✏️ Modifier » était elle
aussi écrite deux fois.
- **Mettre en vente et modifier vivent UNE fois, dans eBay → Annonces.** « Compte
  eBay » ne garde que la connexion, l'argent et un renvoi (« Voir mes
  annonces ») ; son titre ne dit plus « Publier ». `EbayLigne`, devenu sans
  appelant, est retiré (§4.11) — `EbayAnnonceCard` porte la modification.
- **Et le second chemin, mort, ne s'affiche plus** : la case « eBay » de « Publier
  aussi ailleurs » et la puce « À publier aussi sur eBay » remplissaient la file
  de l'EXTENSION (« Préparer sur eBay »), qui n'a plus aucun bouton depuis la
  5.130 — et la phrase dessous promettait une préparation que rien ne
  déclenche. `MP_PLACES` garde l'entrée (`ui: false` : `mpChoisi`, les audits et
  l'extension la lisent) ; l'écran ne montre que `MP_PLACES_UI`. Mesuré : **0 des
  401 fiches** avait coché eBay, rien n'est perdu.
- ⚠️ **Le côté extension (`ebay.js`, `buildEbayData`, `ebayPreparer`) n'est PAS
  retiré** : c'est le domaine de la session eBay, et ça impose un bump.
- Bancs : `ebay-form.cjs` **compte** les `[data-poster="ebay"]` sur les quatre
  sous-onglets (1, dans Annonces — **2 sur le build d'avant**) ;
  `annonces-carte.cjs` trouve la carte des places par son TITRE (un attribut
  absent du build d'avant aurait rendu le contrôle vert sur le défaut) — **4
  cases eBay sur le build d'avant, 0 après**. Au passage, `ebay-form.cjs` exigeait
  encore le bouton « Optimiser le titre avec l'IA », retiré exprès le 30
  septembre : il vérifie maintenant qu'il ne revient pas.

### Le stock 3D à la souris (4 octobre)
Julien : « améliore le stock en 3D pour que ce soit facile à la souris, mets-toi
à la place de l'utilisateur ». **Mesuré d'abord** : quatre réglages posés sur
OrbitControls, tout le reste aux défauts — sur sa pièce (17 × 10 m) un carton
faisait ~11 px, la molette avançait de 5 % par cran vers le CENTRE de la pièce
(le meuble visé sortait de l'écran), la vue traînait 9 images derrière la main.
- **Réglages** (`Room3D`) : amortissement 0,2, rotation 0,6 à la souris,
  `zoomToCursor` + `zoomSpeed 3` (≈ 14 %/cran vers le point visé), déplacement
  au sol, distance max = 1,35 × la vue d'ensemble (44 m → ~27 m chez lui), cible
  **bornée à la pièce** (on ne passe plus sous le plancher). Ce sont des valeurs
  de RESSENTI : à ajuster avec sa main, sans toucher à la logique.
- ⚠️⚠️ **UN CLIC DROIT POUVAIT RETIRER UN CARTON.** `pd`/`pu` ne regardaient pas
  le bouton : un clic droit sans bouger (le début d'un déplacement de vue) sur
  une pile choisie ouvrait la saisie « laisse VIDE pour la retirer ». Seul le
  bouton gauche « tape » désormais.
- ⚠️⚠️ **LE SURLIGNAGE NE TOUCHAIT JAMAIS LES CARTONS** : il teintait
  `material.emissive`, or un carton porte un TABLEAU de six matériaux — une pile
  n'était jamais surlignée, et dans une grille c'étaient les cases VIDES qui
  s'allumaient (matériaux partagés en prime). Remplacé par des **contours**
  posés sur la boîte englobante, couleur d'accent (§7 : plus de rouge, réservé
  au doublon de numéro). La recherche vise **le carton précis** (`pileIdx`/`num`),
  plus toute la pile.
- **Survol** (souris seulement) : curseur main / attraper, contour, et une bulle
  dont le texte vient **des données** (nom du meuble, N° du carton). Les
  étiquettes flottantes ne volent plus les clics (`raycast` vide).
- **Double-clic** : se mettre en face d'un meuble ou d'une case (vol de 420 ms,
  sortie douce, **interrompu dès qu'on attrape la vue**). ⚠️ Sur une case d'un
  meuble DÉJÀ choisi, le clic simple attend 280 ms : sans ça le 1er clic du
  double-clic ouvrait la saisie et le 2ᵉ tombait dessus (vu au banc). Choisir un
  meuble reste instantané.
- **Clavier** (la zone prend le focus) : ← → tourner, ↑ ↓ + − zoomer, Début
  toute la pièce, F de face, Échap désélectionner. **Mouvement réduit** respecté
  (pas de vol, pas d'inertie).
- ⚠️ **La carte de l'audit disait « ← → font quitter le Stock » : FAUX** — le
  Stock n'est pas dans les onglets du bas, `slideTab` l'ignore. Le contrôle que
  j'avais écrit pour ça ne pouvait pas échouer (prouvé en retirant la garde : il
  restait vert) : retiré. *Un contrôle qui ne peut pas échouer est pire
  qu'absent.*
- **Pas fait, et pourquoi** : le rendu à la demande (la boucle tourne en continu,
  ombres 2048 à chaque image) — c'est l'étape qui peut FIGER l'écran sans erreur
  si une mutation oublie de redemander une image ; à faire seule, avec son
  propre banc. Les étiquettes à taille constante à l'écran, l'aide au premier
  passage, un canvas plus haut sur ordinateur.
- Banc `garage3d.cjs` (pièce inventée, il vit dans le dépôt) : survol, clic
  droit, surlignage du carton cherché, molette, clavier, double-clic. Preuve par
  **réaffaiblissement** (la sonde n'existe pas sur le build d'avant, donc « rouge
  avant » n'y prouverait rien) : remettre le clic droit qui tape → **2 rouges** ;
  retirer l'attente du clic → le double-clic **rouge**.

### Messages dans Vinted, et un écran Leboncoin qui commence par ce qu'on fait (4 octobre)
Julien : « dans Vinted et dans Leboncoin il y ait les messages », « Leboncoin
beaucoup plus intuitif ».
- **Messages Vinted** : l'écran complet existait (liste tous comptes, fil,
  réponse, offres) mais n'avait **plus aucune porte dans Vinted** — seulement la
  cloche. Il est la 4ᵉ section de l'onglet Vinted (Ventes · Achats · Annonces ·
  Messages). Un **point** (pas un nombre) signale des non-lus : trois règles de
  comptage coexistent (coque, cloche, écran), un chiffre sur l'onglet pourrait
  contredire celui de l'écran (§11). L'ancien `?tab=cat_msg` (cloche, bandeau,
  « à faire ») y mène (`subVoulue`) ; `messagerie.cjs` le vérifie.
- **Leboncoin → Annonces** : la liste « à publier » — la seule chose qu'il fait
  ici — était le DERNIER de douze blocs. Ce qui se LIT une fois (préparation de
  la publication, paragraphe d'explication, comptes, limite de l'offre) descend
  dans **« Détails et réglages »**, replié en bas ; en haut il ne reste que ce
  qui se FAIT (double vente, « quelle paire ? », à retirer, à publier).
  - « Offre : **Gratuit** » s'affichait quand aucune offre n'était connue
    (`plan`/`limit` jamais renseignés) — une valeur **inventée** : retirée.
  - « Comptes Leboncoin détectés » ne s'affiche plus pour UN compte.
  - **Un nom, une porte** : l'entrée de menu « À publier » ouvrait le même écran
    sous un autre nom ; retirée, et `?tab=leboncoin` mène à Leboncoin →
    Annonces.
- **Reste à faire (mesuré par la carte du 4 octobre)** : les messages
  **Leboncoin** — aucune conversation captée en base, mais l'extension a VU les
  endpoints (compteur de non-lus `{userId, unread}`, détail de conversation,
  envoi) ; il faut d'abord corriger la mesure (UUID non normalisés dans
  `lbc_recon`, `paths` plein à 300/300) puis relever le compteur par compte. Les
  messages **eBay** n'existent pas dans l'app (« comme pour eBay » n'a pas de
  modèle) — à trancher avec lui, et c'est le domaine de la session eBay.

### Messages Leboncoin : le NOMBRE de non-lus, par compte — et un message client fuyait (4 octobre, 5.153)
Julien : « dans Leboncoin, il y ait les messages ». **Mesuré** : aucune
conversation captée, mais la page Leboncoin recharge elle-même un compteur
`{userId, unread, pollingTime}` par compte, et `linked_accounts` liste ses
comptes. L'extension relaie **ce nombre** (`lbcmsgcompteur`) et ses comptes liés
**sans email** (`lbccomptes`) ; le fond range `lbc_messages`
(`compteurs[userId]`, `comptes[id]`) en lire-fusionner-réécrire gardé contre la
lecture ratée (dans `audit-fusion.cjs`), et n'écrit que si le nombre change.
Zéro requête de plus vers Leboncoin.
- L'app : **Leboncoin → Messages**, chaque compte nommé avec son nombre, « — »
  pour un compte lié jamais relevé (jamais « 0 »), un relevé de plus de 24 h le
  dit, et le bouton ouvre la messagerie de Leboncoin. On y répond là-bas : lire
  les fils viendra après avoir MESURÉ leur forme (un passage de Julien sur
  leboncoin.fr/messages avec la 5.153), jamais avant.
- ⚠️⚠️ **LE TEXTE D'UN MESSAGE CLIENT QUITTAIT LA PAGE.** Une réponse de
  conversation contient « subject », « owner », « annonce » : elle passait
  `AD_HINT` et partait en `lbcraw` — dont le fond garde un échantillon de 9 000
  caractères en base. Prouvé sur le code d'avant (« un message client est
  parti »). Désormais **aucune réponse `/messaging/` ne sort**, sauf le nombre ;
  le jeton `realtime/credentials` ne sort jamais (pas même ses clés).
- **UUID** : la règle « 3 chiffres ou plus → {id} » mangeait le début d'un UUID
  et laissait le reste — les UUID de ses conversations partaient à moitié en
  clair dans `lbc_recon`, et chaque conversation créait sa clé de schéma.
  `sansUuid` passe d'abord (chemins, schémas, envois).
- Preuves : `audit-lbc-messages.cjs` (le VRAI `lbc-inject.js` dans un vrai
  navigateur, sous le nom de leboncoin.fr — **10 contrôles, 8 rouges** sur le
  code d'avant) ; banc `lbc-messages.cjs` (trois états : relevé · jamais · panne)
  — il a attrapé « 4non lus » (l'espace n'était qu'une marge visuelle).
- Extension **5.153.0**, zip régénéré, `EXT_ATTENDUE` suivie,
  `EXT_CAPACITES.lbcmsg`.

### Vestiaire Collective : mesurer la forme AVANT de capter (4 octobre, 5.154)
Julien : « commence à faire Vestiaire Collective bien ». **Mesuré d'abord** :
**zéro ligne `vc_*`** en base, et le site me renvoie **403** — je ne connais ni
ses adresses d'API ni la forme de ses pages. Écrire un analyseur de ventes
aujourd'hui, ce serait deviner (§4.10, §6.3) et ranger des chiffres faux dans
sa comptabilité. ⇒ Même méthode que Leboncoin et eBay : **on fait mesurer le
site par SON navigateur**.
- `vc-inject.js` (monde MAIN) enveloppe fetch/XHR et ne regarde que ce que la
  page charge **déjà** — aucune requête de plus, aucun clic (§3). Il relève :
  les **chemins** d'API (méthode + chemin normalisé + code + type), la
  **structure** des réponses JSON (chemin de clé + TYPE de feuille), les
  **familles** de pages, et les **hôtes** tiers (le nom seul, compté).
- ⚠️⚠️ **JAMAIS UNE VALEUR** : ses pages vendeur portent nom, adresse, IBAN,
  téléphone, messages. Les identifiants (nombres ≥ 3 chiffres, UUID, longues
  suites hexadécimales) deviennent `{id}`/`{uuid}`, y compris quand ils sont une
  CLÉ d'objet (une carte indexée par email ou par produit) ; un segment de
  chemin qui n'a pas la forme d'un mot devient `{x}`. `vc.js` relaie (source =
  cette page, notre étiquette, et c'est NOUS qui posons l'origine et l'action) ;
  le fond (`storeVcRecon`) range `vc_recon` en lire-fusionner-réécrire gardé
  contre la lecture ratée, et **n'écrit rien quand rien n'est neuf** (mémo
  `vrmVcConnu` dans `chrome.storage.local`, §4.9).
- **Aucune vente, aucune annonce n'est comptée** : l'onglet Vestiaire de l'app
  dit ce qui a été relevé (`VestiaireMesure` : relevé · jamais · pas su) et le
  bouton VRM du site le dit aussi (« VRM apprend à lire Vestiaire Collective »).
  Le jour où la structure montre où vivent une vente, son montant net et sa
  date, on écrira l'analyseur — pas avant.
- **Le geste de Julien** : installer la 5.154, puis ouvrir dans ce Chrome ses
  pages vendeur Vestiaire (ventes, articles en vente, paiements).
- Preuves : `audit-vc-recon.cjs` (le VRAI `vc-inject.js` dans un vrai
  navigateur sous le nom de vestiairecollective.com, nourri de données
  personnelles inventées — **10 contrôles** ; réaffaibli pour relever des
  valeurs au lieu de types → **3 rouges**) ; `audit-fusion.cjs` porte
  `vc_recon` ; banc `vestiaire.cjs` (trois états, aucun chiffre inventé).
- Extension **5.154.0**, zip régénéré, `EXT_ATTENDUE` suivie,
  `EXT_CAPACITES.vestiaire`. Aucune permission d'hôte ajoutée : les scripts de
  contenu suffisent, le fond n'appelle jamais Vestiaire.

### ⚠️⚠️ « À EXPÉDIER » : UNE SEULE RÈGLE, LE CHAMP MACHINE DE VINTED (4 octobre)
Julien : « le statut en transit, colis à faire, vendu… doit être beaucoup plus
fluide et fiable quand l'extension est connectée ». **Mesuré** : le même jour,
quatre lecteurs donnaient quatre nombres pour « à expédier » — **Colis 2 · Ma
journée 3 · la cloche 3 · le widget 6** — chacun avec SA lecture du texte du
statut.
- **La règle** (`aExpedier`, la MÊME dans `src/App.jsx`, l'extension
  `A_EXPEDIER` et `api/widget.js`) : le champ machine de Vinted
  `transaction_user_status` d'abord — sur une VENTE, `needs_action` = à expédier,
  `waiting`/`completed`/`failed` = pas à expédier ; le texte n'est lu qu'en repli
  quand le champ manque. `PAS_UN_ENVOI` (annulée, remboursée, retour, suspendue,
  finalisée, paiement échoué) gagne toujours. ⚠️ Sur un ACHAT `needs_action` veut
  dire « à retirer » : ne jamais réutiliser la règle des ventes.
- « Bordereau envoyé au vendeur » n'affichait plus « En transit », un colis au
  relais n'affiche plus « Livrée » ni « Reçu » (le test du relais passe AVANT
  « livr »), et la vente « bordereau commandé » ne disparaît plus de Colis.
- **Un propriétaire** : `toShip` publie `vrm_colis_aposter`, la cloche le
  consomme (< 12 h), son repli recompte avec `aExpedier` — et se recalcule à
  l'arrivée du nuage (`nuagePret`, §5.49 : sur un appareil neuf elle disait 3
  pour 2 et ne se corrigeait jamais).
- **Coché « posté » à la main** (`isShipDone`) : hors d'« À expédier » partout,
  sous « En transit » avec l'étiquette **« Posté »** (elle disait encore
  « À expédier »).
- **« Commande non réclamée — retournée »** est un colis qui REVIENT : rangé
  « annulé » pour l'ARGENT (aucun CA), mais visible dans « En transit » et
  « Toutes » — il n'était que sous « Annulées », un mot faux.
- Ventes : pastilles **« À expédier » / « En transit »** (deux questions
  différentes). Colis : un groupe replié **« Partis — Vinted suit le colis »**
  en lecture seule. Colis à retirer : le même colis se reconnaît à son **code de
  retrait**, jamais à son titre.
- Widget et rappels : ni compte retiré, ni colis coché « posté », ni faux retard
  (date limite de l'email, sinon vente + 7 j) — et une liste de comptes vide ne
  filtre rien (§4.1).
- **Fluidité** : une relecture ne vide plus la liste (`loadOrders` garde ce qui
  est affiché, un numéro de séquence empêche une lecture plus ancienne d'écraser
  une plus récente), un signal de l'extension reçu sur un autre écran n'est plus
  perdu, une lecture ratée n'efface plus les bordereaux d'un compte, et une
  panne de NOTRE base ne déclenche plus d'appel au relais Vinted.
- Preuves : `audit-statuts.cjs` (18 rouges sur l'avant), bancs `statuts-colis.cjs`
  (rendu des cinq écrans, aucune fixture — 38 rouges sur c117b30, 6 sur le
  premier jet), `fluidite.cjs` (12), `widget-colis.cjs` (5).

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

### Code mort et rappels d'expédition à l'échelle (4 octobre)
- **Sept fonctions sans appelant** retirées (graphique mensuel, export Factur-X
  seul, scène 3D de l'accueil, clé IA locale, pseudo Vinted, distance, état
  Vinted) : 220 lignes. ⚠️ `moisDeVente`, `caUrssafParMois` et `heureCommande`
  n'ont PAS d'appelant dans l'app mais `audit-urssaf.cjs` les exécute : les
  garder. 32 écrans montés avant et après (§4.11).
- **`ship-reminders`** : 8 vendeurs à la fois (mille à la queue leu leu
  dépassaient les 300 s de Vercel), un vendeur qui plante n'arrête plus les
  autres (réponse 500 pour rester visible), la sonde de cloisonnement en panne
  vaut « pas su » (elle faisait basculer en passe GLOBALE, vendeurs mélangés), et
  ses réglages illisibles le font se taire au lieu de compter ses colis déjà
  postés. `ship-multi.cjs` : 3 rouges sur l'avant.
### L'extension prévient l'app de ce qui a VRAIMENT eu lieu (4 octobre, 5.155)
Aucune requête Vinted de plus ; tous les garde-fous du §3 inchangés.
- **Achats** : une écriture d'`orders_purchased` qui ABOUTIT (voie passive
  `storeHarvest` et active `storeHarvestRow`) envoie `maj · achats · uid` —
  comme `maj · ventes`. Écriture ratée ⇒ rien.
- **Code de retrait** : `noterRetrait(r, uid)` envoie `maj · retrait · uid · tx`
  uniquement si un code NEUF a été écrit ET accepté. Elle rendait `true` même
  quand l'écriture échouait (le journal disait « code récupéré » sur un code
  rangé nulle part). Un seul endroit pour les trois chemins (conversation
  passive, `capterRetraits`, direct).
- L'app les écoute (`vrm:ext`) : `achats` relit les achats en silence, `retrait`
  relit `panel_colis_relais` — un code lu dans une conversation apparaît sans
  recharger.
- **Capture plus pauvre refusée sur la voie active** : comptée
  (`ignore_partiel_actif_<type>`, même famille que `ignore_partiel_<type>`),
  elle se taisait.
- **« Relis mes ventes »** : `rafraichirVentes` rend `{ok, ecrit, raison}`
  (`compte · lecture · aucune · plus-pauvre · ecriture`) au lieu de `true` sans
  rien écrit. Lecture « ratée » = Vinted n'a rendu AUCUNE page (`pagesLues`), pas
  une liste vide. La commande `ventes` suit la forme de `bordereau` : accusé
  `file` + `jobId = ventes:{uid}`, puis `fait` · `rien` (avec la raison) ·
  `echec` dans `vrmCmds`. La garde des 90 s est **relâchée** sur un échec
  (lecture ou écriture : la demande suivante réessaie), **gardée** sur un succès
  ET sur un refus « plus pauvre » (sinon un refus durable relirait à chaque
  ouverture d'écran). Même règle pour la visite (`prendreGardeVentes` /
  `rendreGardeVentes`, qui ne relâche que SA marque).
  ⚠️ **Relâcher n'est pas effacer (§3)** : la visite tourne à chaque page
  Vinted — une garde effacée sur un échec DURABLE (jeton mort, base en panne)
  relirait `my_orders` à chaque page. Elle est ramenée à **20 s**
  (`VENTES_REESSAI_MS`), et quand c'est **Vinted qui freine (429/403)** elle
  reste entière (`raison: 'vinted-freine'`).
- **`supabaseUpsert`** : toujours un booléen, mais un refus est noté
  `ecriture_ratee_<famille>_<code HTTP|reseau>` — la famille ne garde que les
  mots de l'id (aucun n° de compte, de transaction, de suivi), jamais le corps.
  UN seul nouvel essai après un **401 sur base cloisonnée**, et seulement si
  `refreshSession` rend un jeton (un seul renouvellement en vol) ; jamais sur un
  5xx ni le réseau (l'écriture a pu passer).
  ⚠️ `noterDiag` n'y est **pas** attendu : `viderTampon` écrit par
  `supabaseUpsert` depuis la chaîne du tampon — l'attendre la bloquerait.
- **`viderTampon` vidait le tampon même quand son écriture échouait** (son
  commentaire disait le contraire) : les compteurs d'un tour partaient avec.
  Il ne vide plus que ce qui est arrivé en base.
- `scripts/audit-evt-extension.cjs` exécute le vrai `background.js` (base à
  état, projection `select=` appliquée) : **47 contrôles, 23 rouges sur
  c117b30**, et **14 mutations sur 14** repassent au rouge (un envoi retiré, la
  garde jamais rendue / effacée / rendue sur un 429, le compteur d'écriture
  retiré, un nouvel essai sur un 5xx, la famille qui laisse passer le n° de
  compte…). `--src chemin` lance l'audit sur une copie mutée.
- Extension **5.155.0**, zip régénéré, `EXT_ATTENDUE` suivie. Aucune entrée
  d'`EXT_CAPACITES` : rien de neuf n'est promis.

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

### ⚠️⚠️ « VENDUE HIER, RELIÉE, NI RETIRÉE D'eBAY NI PROPOSÉE » — LA PREUVE DE VENTE MANQUAIT (11 octobre, 5.169)
**Mesuré (lecture seule)** : la N°553 (tx 23052006117, angeled92) n'avait
**aucune** ligne `harvest_*_txn_*` — elle n'arrive que quand la conversation
est ouverte sur vinted.fr, geste que « Générer le bordereau » depuis l'app rend
inutile. Son bordereau (21:55) portait pourtant l'annonce, lue dans la
transaction puis **jetée**. Sur 18 ventes en cours, 6 seulement étaient
prouvées ; la règle a tourné 36 fois sans rien voir. Le retrait automatique est
**ALLUMÉ** dans sa base (il le croyait éteint).
- **Une règle, deux côtés** (`<preuve-vente-regle>`, identique dans l'app et
  l'extension, §11) : vente prouvée = transaction avec un état de commande qui ne
  la fait pas revenir, **ou** bordereau `harvest_{uid}_label_{tx}` (méta `tx`,
  `item` ; jamais `_latest`, méta contredite = doute) dont la vente est LUE dans
  les ventes du **même** compte, ni annulée, ni retour, ni `failed`. ⚠️ Jamais
  `item_closing_action: 'sold'` seul (mesuré : 10 « sold » n'ont que des
  transactions revenues). Les ventes ne sont lues que s'il reste un bordereau à
  juger ; toute lecture ratée ⇒ `null` / `echec` (« pas su »).
- **Extension 5.169** (⚠️ pas 5.167 : la 5.167.0 et la 5.168.0 PUBLIÉES par
  #471 et #472 n'ont pas ce code — voir la revue juste en dessous) :
  `recupererLabel` range la transaction qu'il lit
  (`rangerTransaction`, forme de `capterDatesVersement`, **zéro** requête de plus,
  une écriture par appel, jamais sous un autre numéro) ; `capterPreuvesVente`,
  après la moisson, lit la transaction des ventes en cours sans preuve
  (`gardeLecture` colis, file Vinted, 3 par visite, 6 h, compte du cookie,
  pause) et entre dans la réserve des lectures prioritaires (13 au lieu de 10 :
  `audit-budget-lectures` suit). `EXT_CAPACITES.preuves = '5.169.0'`.
- **Écran eBay → Annonces** : « N ventes Vinted en cours pas encore reliées à
  leur annonce » dit **une** fois, comptes nommés, le geste selon `extSait`
  (absente · retard · ok), seulement s'il y a une annonce reliée ; il se relit
  sur `maj preuves|label|ventes`. L'interrupteur dit **ALLUMÉ / ÉTEINT** en un
  mot, ce qu'il fait en son nom, et « … » tant que le réglage n'est pas relu du
  nuage (il affichait « éteint » sur un appareil neuf). Son choix n'est pas
  touché.
- ⚠️⚠️ **Le SKU passe par la numérotation — et un numéro PROVISOIRE n'est pas un
  ancien** : la 553 fait partie des « 553+ » renumérotés par la 013. ⚠️ Le premier
  correctif de ce chantier lisait `renum` sur un marqueur à l'ANCIENNE forme
  (liste d'identifiants) : sur la production convertie à 14:58 (carte PAR
  ANNONCE, `ebayAnnonces = { "128127336988": { "553": "1" } }`), « VRM-553 »
  restait « 553 » et la N°1 vendue ne déclenchait rien. **Abandonné à la fusion**
  au profit de `traductionAnnonce` d'integ-11oct (app, serveur, extension) —
  mesuré : « VRM-553 » → **1**, la paire 1 vendue ⇒ « à retirer ».
- **Preuves** : `audit-preuve-vente.cjs` (app + vrai `background.js`, même base
  inventée) **54 contrôles, 23 rouges** sur ef03dc8, **20/20 mutations**
  attrapées (74 contrôles et 26 mutations après la revue ci-dessous) ; banc
  `ebay-annonces.cjs` sert la vente par son **seul bordereau** (il servait une
  ligne txn : vert sur le défaut, §6.3), plus vente annulée et paire revenue :
  **23 rouges** sur le build d'ef03dc8, **16 rouges** sur un build réaffaibli
  (preuve par bordereau retirée + interrupteur sans « pas lu »), 0 après. Ses
  feuilles de confirmation attendent 20 s (en rendu logiciel à 1512 px, le voile
  flouté rend Playwright lent à juger un bouton « stable » — déjà rouge à 1512 px
  sur ef03dc8, ce n'était pas l'app). `BANC_PORT` choisit le port.
- ⚠️ **Non mesuré** : le délai réel entre la vente et la moisson (la preuve
  n'arrive qu'avec la visite suivante sur le bon compte) ; un LOT ne prouve que
  son `item` (les `items` d'un lot ne sont pas dans `meta`) ; rien n'a été
  envoyé à Vinted ni à eBay. Aucune notification « vendue ailleurs » n'existe (le
  contrôle ne tourne qu'app ouverte).
- **Geste de Julien** : terminer l'annonce eBay de l'Autry dans le Seller Hub si
  elle est encore en ligne ; décider s'il garde le retrait automatique ALLUMÉ ;
  installer la **5.169**.

### ⚠️⚠️ REVUE DU CHANTIER eBAY : L'INSTANTANÉ DE LA TRANSACTION, DEUX CONTENUS POUR UN NUMÉRO (11 octobre, 5.169)
Onze défauts reproduits par la revue (vm + Chromium, données inventées), corrigés
après une **vraie** fusion d'integ-11oct (aee8e5c : la 013 appliquée à 14:58).
- ⚠️⚠️ **LA TRANSACTION RANGÉE EST UN INSTANTANÉ, JAMAIS RELU.** Celle que le
  bordereau range dit « Bordereau envoyé au vendeur » pour toujours : une vente
  annulée ou **remboursée** ensuite restait « prouvée vendue » — la paire,
  revenue, sortait des files Leboncoin/eBay et partait au **retrait automatique**
  d'eBay (ALLUMÉ chez lui). Mesuré en production (lecture seule) : **46 preuves à
  un état non terminal sur 7 comptes, 5 contredites** par leur vente
  (« Le paiement a été validé » / « Remboursement effectué », failed).
  ⇒ Bloc partagé (§11) : un état **non terminal** ne prouve que si la vente du
  même `tx`, lue dans les ventes **du même compte** (relues à chaque visite),
  n'est pas revenue ; vente introuvable dans la liste lue ⇒ l'instantané tient ;
  « Commande finalisée » est terminal. Les comptes qui portent un tel instantané
  sont lus (`comptesAJuger(…, transactions)`), leur panne vaut « pas su ».
  ⚠️ Coût : les ventes de ces ~7 comptes (~190 Ko) sont lues à chaque
  construction de file — la correction avant l'égress.
- ⚠️⚠️ **DEUX CONTENUS SOUS LE MÊME NUMÉRO.** La 5.167.0 et la 5.168.0 sont
  **publiées** (#471, #472) **sans** `capterPreuvesVente` ; le chantier promettait
  à ces versions « l'extension va lire la transaction toute seule ». Extension
  **5.169.0**, `EXT_CAPACITES.preuves = '5.169.0'` ; l'audit exige « retard »
  pour 5.164/5.167.0/5.168.0. ⚠️ **À l'intégration : si un autre chantier a déjà
  pris 5.169, monter encore** — jamais deux contenus sous un numéro.
- **§11 : l'écran Leboncoin de l'app** gardait sa boucle sur les seules
  transactions ; il lit maintenant `lireVentesVintedProuvees` (même preuve que
  `buildLbcData` et l'écran eBay). Banc `lbc-preuve.cjs` (port 4913).
- **La ligne « pas reliées » d'eBay** ne fait plus tomber la preuve quand les
  ventes des AUTRES comptes ne se lisent pas (elle vaut `null`, la preuve reste) ;
  elle **nomme** chaque vente (titre), avec le lien vers **sa** conversation et,
  à poster, son bouton « Générer le bordereau » (un bordereau capté relie déjà
  la vente, même en 5.164) ; elle dit le **chiffre** (« 3 par visite », « au fil
  de tes visites » au-delà — `PREUVE_PAR_VISITE` = `PREUVE_MAX_PAR_VISITE`,
  comparé par l'audit). Le panneau d'état d'une 5.164 dit ce qui lui manque
  vraiment (« la preuve des ventes qui n'ont pas encore de bordereau »).
- **L'interrupteur du retrait automatique** suit le nuage à son arrivée
  (`v || …` ne pouvait jamais repasser à faux : éteint ailleurs, il affichait
  ALLUMÉ pendant que le retrait, lui, ne faisait rien).
- **Preuves** (rouge sur 6729407, vert après, rouge sous mutation) :
  `audit-preuve-vente.cjs` **74 contrôles, 9 rouges** sur l'avant, **26/26
  mutations** ; banc `ebay-annonces.cjs` (port `BANC_PORT`) **16 rouges** sur
  l'avant, 4 builds réaffaiblis rouges (interrupteur, capacité 5.167, rythme,
  nom de la vente) ; `lbc-preuve.cjs` **4 rouges**, 3 sur un build réaffaibli ;
  `tout-generer.cjs` **3 rouges**, 1 sur un build réaffaibli ;
  `audit-numerotation-lecteurs` (integ) + le serveur lit « 553 » → « 1 » sur la
  forme de la 013 appliquée (`repro` : « 553 » sur l'avant).
- ⚠️ **Non mesuré** : rien n'est parti chez Vinted ni eBay ; le DOM réel d'une
  conversation Vinted (`inbox/{conversation_id}`) n'est pas vérifié ici ; une
  vente remboursée APRÈS sa finalisation (état terminal) resterait prouvée — pas
  vu dans sa base.

### ⚠️⚠️ REVUE DU CHANTIER eBAY (11 octobre, 5.172) — LE NUMÉRO 5.169 ÉTAIT DÉJÀ PRIS, ET LA 5.170 DE PRODUCTION N'A PAS LA PREUVE
Treize constats d'une revue adverse, chacun **reproduit** (vm, Chromium, données
inventées) avant d'être corrigé. Fusion de `integ-11oct` (c7efee0, 5.170 servie
en production) dans le chantier.
- ⚠️⚠️ **Extension 5.172.0, `EXT_CAPACITES.preuves = '5.172.0'`.** La 5.170.0
  servie par main (PR #473) n'a **pas** `capterPreuvesVente` : avec le seuil à
  5.169, l'app lui promettait « l'extension lit sa transaction toute seule ».
  Et « 5.169 » désignait déjà le chantier extension (e7b-1, qui prend aussi la
  5.171). ⇒ `scripts/_versions-publiees.cjs` **lit l'historique** de main (sa
  première lignée, + la 5.164 installée hors main) ; `audit-coherence` refuse
  tout seuil ≤ une version servie sans la fonction (rouge sur 5e74f92 :
  « preuves 5.169.0 ≤ 5.170.0 ») ; `audit-preuve-vente` dérive de là ses
  versions publiées (la liste recopiée oubliait la 5.170) et refuse un numéro
  réservé (`RESERVEES`) ou déjà servi avec un autre contenu. Depuis une copie
  (§6.1) : `VRM_GIT=<dépôt>`, sinon « pas su » est **rouge**.
  ⚠️ **À la fusion avec e7b-1 : monter encore** (aucun des deux ne porte le code
  de l'autre).
- **La promesse « elle lit toute seule »** n'est faite qu'à une extension à jour
  **et connectée à CE compte VRM** (`connexionExtensionVrm`) : sans session, la
  visite s'arrête avant de lire (`visite_sans_session`). Sinon la ligne dit ce
  qui bloque avec **la phrase de l'indicateur** (`raisonExtGlobale`, §11 — les
  deux adresses quand c'est un autre compte) et le geste qui marche (ouvrir la
  vente).
- **La cloche relance l'anti double vente** sur `maj · label | preuves | ventes`
  (regroupé, au plus un recalcul / 5 s) : retrait automatique allumé, une preuve
  rangée pendant que VRM est ouvert retirait **rien** avant un rechargement — le
  flux même de la N°553.
- **Les ventes d'un AUTRE compte illisibles** sont nommées dans la ligne « pas
  pu lire » (avant : la ligne « pas reliées » disparaissait, l'écran d'une panne
  était celui où tout est relié) ; la preuve, elle, tient.
- **Pas de « Générer le bordereau »** sur une vente dont le bordereau est déjà
  capté sans l'annonce (le clic répondait « déjà fait » sans rien relier, et
  Ventes disait « prêt à imprimer ») ; ni **au doigt** (un bouton grisé muet).
- **Leboncoin** : une paire REVENUE (vente remboursée après une transaction
  figée) est « à publier » pour VRM mais « vendue » pour une extension
  antérieure à la règle de l'instantané — son « Publier » est **grisé** avec la
  raison, dite une fois (`LbcCroitVendue`), au lieu d'un refus au clic.
- Déjà corrigé avant la revue et **gardé** (preuves ajoutées) : transaction
  figée + vente remboursée ⇒ pas vendue (8239c6f) ; l'écran Leboncoin lit la
  même preuve (`audit-preuve-vente` §1 bis refuse désormais tout troisième
  lecteur de `status_title`) ; l'interrupteur suit le nuage ; la carte par
  annonce de la 013 (objet) — trois mutations « lue comme une liste ».
- **Preuves** : `audit-preuve-vente` 77 contrôles, **27/27 mutations** (12 rouges
  sur 6729407) ; `audit-coherence` (rouge sur 5e74f92 et sous mutation) ;
  `audit-numerotation-lecteurs` **42/42** (l'ancre `banniere-archive` suivait
  encore `onlineAnnonceIds`) ; banc `ebay-annonces` **153 contrôles**, 23 rouges
  sur le build de 5e74f92, 38 sur 6729407, rouge sous six mutations ; banc
  `lbc-preuve` cas D, 3 rouges sur 5e74f92, rouge sous mutation ;
  `audit-budget-lectures` recompté (réserve 13 = argent + colis + preuves).
- ⚠️ **Non mesuré** : la réponse réelle de Vinted et d'eBay (aucun appel) ; si
  Julien a d'autres extensions installées hors main que la 5.164.

### ⚠️⚠️ « ANNONCES = LES PAIRES EN LIGNE MAINTENANT » — LA RELECTURE PUBLIQUE DE SES AUTRES COMPTES (11 octobre, 5.167)
Julien : « j'avais supprimé mes annonces sur Vinted… il y avait encore toutes mes
annonces sur VRM… trois fois la même paire alors qu'il n'y a qu'une seule
annonce. Il faut que ce soit les paires qui sont en ligne actuellement. »
**Mesuré (lecture seule)** : le dressing d'un compte n'est relu que quand Chrome
est CONNECTÉ dessus (un seul jeton vivant à la fois). `arthuror2` (10 annonces
« en ligne ») et `tomj683` (6) n'avaient pas été relus depuis le 8 octobre
22 h 30 : tout ce qu'il y avait supprimé ou republié depuis restait affiché.
- **L'extension relit ses AUTRES comptes à chaque visite** — la vue PUBLIQUE de
  leur dressing (`GET /api/v2/wardrobe/{profil}/items`, ce que voit n'importe
  quel visiteur), avec les cookies de l'onglet, **jamais** le jeton d'un autre
  compte (`activeFetchAll` reste retiré). `relireAnnoncesAutresComptes` :
  uniquement des comptes À LUI (`vinted_accounts`), jamais un masqué ni un
  supprimé (`vrm_blocked_accounts`, `hidden` — une de ces listes illisible ⇒
  personne ; « refusé par Vinted » est une liste PROPRE À L'APPAREIL, que
  l'extension ne voit pas — revue ci-dessous) ; 3 comptes par visite, pas un
  compte relu depuis moins de 30 min ; une requête à la fois dans
  `requeteVinted`, pause/frein respectés (un 403/429 écarte le compte 24 h —
  revue ci-dessous) ; budget de LECTURE (`gardeLecture`, classe `enligne` :
  après l'argent et les colis, AVANT les photos — revue) ; toutes les pages jusqu'à
  `total_entries`, un article d'un AUTRE membre ⇒ lecture rejetée, et une
  réponse **sans total annoncé** (forme inattendue, page vide sans pagination)
  ne décide RIEN — rangée, elle aurait fait « partir » toutes ses annonces.
  Incomplète ⇒ **rien n'est écrit**, nouvel essai dans 5 min. Complète ⇒
  `harvest_{uid}_enligne` `{ids, n, items, complet:true, capturedAt, source:'public'}`
  — une ligne À PART, jamais par-dessus `harvest_{uid}_listings` — puis
  `maj · annonces` à l'app.
- **UNE règle, la même texte pour texte dans l'app et l'extension**
  (`<enligne-regle>` : `enLigneDuCompte`, `enLigneDesLignes`) : la lecture
  COMPLÈTE la plus récente fait foi (son dressing ou la vue publique), datée par
  `dateLectureDressing` (`capturedAt`, jamais `updated_at` — la revue de la
  5.165, §11) ; une annonce absente de la vue publique plus récente **sort toute
  seule** (ce n'est pas une preuve de VENTE : elle ne devient pas « vendue ») ;
  une annonce republiée (seulement dans la vue publique) apparaît, avec ce que
  la vue publique en sait (titre, prix, photo) ; une suppression vue après la
  lecture la retire (`supprimeeApres`). Lecteurs : écran Annonces (`annBase`,
  via `dressingEnLigne`), tableau de bord, file et alertes Leboncoin de l'app,
  recherche, prix du marché, numérotation automatique (elle ne voit que
  `listings.items`), et côté extension `buildLbcData` / `buildEbayData`.
  `retirerSupprimees(Lignes)` n'existe plus : la règle les remplace partout.
- **Une lecture de plus de 24 h (ou sans date) ne compte plus « en ligne »** :
  ses annonces sont « à confirmer » — hors de la grille et des totaux, **rien
  n'est supprimé**, son numéro reste (pool append-only, §5). UNE ligne repliée
  au-dessus de la grille, dans `FraicheurAnnonces` (la même voix que les
  supprimées et les lectures anciennes, §7) : « ▸ N annonces de X à confirmer —
  dernière lecture il y a 3 j », qui s'ouvre au clic ; plusieurs comptes : TOUS
  nommés, chacun avec son nombre et son âge (revue de la 5.165). UN geste selon
  `extSait('enligne')` : à jour ⇒ « vérifiées à ta prochaine visite sur Vinted,
  sur n'importe lequel de tes comptes » ; en retard ⇒ mettre à jour, d'ici là
  ouvrir le compte ; téléphone ou sans extension ici ⇒ « avec l'extension VRM à
  jour, sur l'ordinateur où elle est installée ». La promesse « une suppression
  sort d'ici tout de suite » et l'avertissement « deux extensions » de la revue
  de la 5.165 restent, dans la même phrase. Pendant ce temps la file Leboncoin
  ne propose pas de les retirer (pas su) et l'anti double vente les compte
  encore. Lecture des lignes `enligne` ratée ⇒ la dernière connue (app : la
  session ; extension : le service worker), sinon « pas su » : seul un dressing
  de moins de 30 min décide, le reste est « à confirmer » et c'est DIT (revue
  ci-dessous — « on retombe sur le dressing seul » ressuscitait les supprimées).
- **Les bancs à fixtures** (`fx/`, une photo datée) recalent en mémoire la date
  de leurs dressings (`_instantane.cjs`, écarts entre comptes gardés) : sans ça
  une copie de la semaine passerait toute « à confirmer » et le banc mesurerait
  l'horloge.
- **Preuves** (méthode §6.1, sur la tête d'`integ-11oct`, ef03dc8) :
  `audit-enligne.cjs` (le VRAI `background.js` dans un `vm`, la vraie règle des
  deux fichiers, mêmes sorties) **62 contrôles, 16 rouges sur ef03dc8**, et
  **16 mutations sur 16** rouges (lecture la plus récente, « à confirmer »
  retiré, divergence app/extension, vendue, exclus, pas su, 3 par visite,
  30 min, total, sans total, page ratée, budget, file, écrasement de
  `listings`, autre membre, retrait sur une lecture partielle). Banc
  `enligne.cjs` (données inventées, 390 et 1512 px : 3 annonces d'une paire
  dont 2 supprimées ⇒ 1 seule, la republiée ; compte figé ⇒ « à confirmer »,
  hors grille et hors compteur ; republiée ⇒ affichée ; lecture ratée ⇒ rien
  ne disparaît ; téléphone) **25 rouges** sur le build d'ef03dc8 et rouge sous
  3 mutations (lecture publique ignorée 16, « à confirmer » retiré 14, ligne
  muette 14). `audit-supprimees` §7 compare les QUATRE lecteurs sur une ligne
  sans date (rien en ligne, la même liste « à confirmer ») ; banc `supprimees`
  2 rouges sur ef03dc8 (le geste).
- `EXT_CAPACITES.enligne` : **'5.170.0'** depuis la revue (`relireAnnoncesAutresComptes` — les 5.167 et 5.168 parties en production ne la portent pas). La 5.167 de cette branche
  porte aussi la numérotation (013), les suppressions et la revue de la 5.165.
- ⚠️ **Non mesuré** (aucun appel à Vinted d'ici) : la forme réelle de la vue
  publique (une annonce vendue y figure-t-elle, `total_entries` y est-il
  cohérent avec `items` ?) — si le total y compte des annonces que la liste ne
  rend pas, aucune lecture ne sera jamais « complète » et ses autres comptes
  resteront « à confirmer » (le sens sûr) ; la réaction de Vinted à 3 lectures
  publiques par visite ; le premier tour réel chez lui ; la copie de
  l'extension sans session (§ mesure du 11 oct.) qui lit arthuror2 et tomj683.
- **Geste de Julien** : installer la **5.170** (la revue ci-dessous — UN seul
  dossier, retirer toute autre copie de VRM dans `chrome://extensions`, dans
  chaque profil Chrome), puis ouvrir vinted.fr sur n'importe lequel de ses
  comptes — trois autres comptes sont relus à chaque visite.

### ⚠️⚠️ REVUE DE LA 5.167 : SEIZE CONSTATS, QUATORZE DÉFAUTS REPRODUITS (11 octobre, 5.170)
Deux relecteurs adverses ont REPRODUIT chaque défaut (vrai `background.js` dans le
`vm`, vrai Chromium, app rendue sur données inventées) avant qu'il soit corrigé.
Extension en **5.170.0** : la 5.168 est en production (`main`, autre contenu) et
la 5.169 est prise par le chantier extension (`wf_4d08d5c8`, session adressée,
code périmé) — deux contenus ne portent jamais le même numéro. ⚠️ À la fusion des
deux chantiers, monter encore : ni l'un ni l'autre ne porte le code de l'autre.
⚠️⚠️ **Et `EXT_CAPACITES.enligne` passe de 5.167 à 5.170** : la 5.168 installée chez
lui (production) ne porte pas `relireAnnoncesAutresComptes` — avec le seuil à 5.167,
l'app lui aurait promis « tes autres comptes seront vérifiés à ta prochaine
visite », le défaut le plus coûteux du projet, refait par une collision de numéros.
- ⚠️⚠️ **UN 403 SUR UN SEUL COMPTE FAISAIT MONTER LA PAUSE VINTED À 4 H.** Après
  un échec, le compte réessayait dans 5 min (moins que la pause de 15 min) et
  restait le plus ancien : la première requête partie après CHAQUE pause était
  celle que Vinted venait de refuser — 15, 30, 60, 120, 240 min : **705 minutes de
  pause sur 738** en douze heures, bordereaux et réponses bloqués. C'est la forme
  exacte du §3. ⇒ un 403/429 sur une lecture publique écarte CE compte **24 h**
  (`vrmEnLigneFreins`) ; un **429**, ou un **second** compte freiné dans les 24 h,
  coupe toute la relecture du jour (c'est le lecteur qui est en cause) ; un
  compte en échec récent passe APRÈS les autres (`vrmEnLigneEchecs`).
- ⚠️⚠️ **L'ONGLET POUVAIT QUITTER VINTED PENDANT LA RELECTURE** : `executeScript`
  injecte dans le document COURANT — la page 2 partait CHEZ LEBONCOIN, avec le
  jeton CSRF de Vinted, et un 403 de Leboncoin posait la pause Vinted (prouvé
  dans Chromium). ⇒ l'onglet est revérifié avant chaque requête (sinon un autre,
  ou le service worker) ; la page injectée vérifie `location.hostname` AVANT tout
  `fetch` et rend son origine ; une réponse qui ne vient pas de Vinted vaut
  « rien lu », jamais une pause.
- ⚠️⚠️ **UNE LECTURE « DÉCHIRÉE » PASSAIT POUR COMPLÈTE** : une suppression entre
  la page 1 et la page 2 décale la liste — une annonce TOUJOURS en ligne n'est
  jamais vue, le total baisse d'autant, « lus = total » passait (et avec une
  suppression + une republication, le total ne bouge même pas). ⇒ chaque page
  doit annoncer le MÊME total que la page 1 (`mouvant`, la lecture s'arrête là),
  et à plusieurs pages la page 1 est RELUE à la fin (mêmes identifiants).
- **Le budget** : la relecture était dans la classe des photos — après une
  republication `tickPhotos` vidait le budget et les autres comptes attendaient
  une heure. ⇒ trois étages, total inchangé (20/h) : argent/colis, puis relecture
  (`gardeLecture(…,'enligne')`), puis photos ; la relecture note ce qui lui reste
  (`noterLecturesDues(uid,'enligne',…)`), « pas su » garde sa réserve (3).
- **Lignes illisibles côté extension** : des dressings illisibles (`|| []`) faisaient
  dire « à retirer de Leboncoin » toutes les paires du compte connecté ⇒ `echec`,
  les files ne calculent rien, le disent (`lecturesKO`), et la publication est
  refusée avec la raison. Des lectures publiques illisibles ⇒ dernière connue,
  sinon « pas su ».
- **La règle (`<enligne-regle>`, app = extension)** : une vendue (pour son vendeur)
  que la vue publique montre ouverte RESTE parmi les fermées (elle disparaissait
  de toutes les sorties, preuve de vente comprise) ; une suppression vue en 2xx
  n'est plus annulée par une lecture PUBLIQUE postérieure (la vue publique n'est
  pas mesurée, Vinted ne réutilise pas un identifiant) — le DRESSING de son
  vendeur, lui, fait toujours foi (5.165, `audit-supprimees` inchangé) ;
  `pub = { passu: true }` : sans les lectures publiques, seul un dressing de moins
  de `ENLIGNE_SUR_MS` (30 min = `ENLIGNE_DELAI_MS` : aucune lecture plus récente
  ne peut exister) décide.
- ⚠️⚠️ **« À CONFIRMER » N'EST PAS « PLUS EN LIGNE » POUR LES NUMÉROS.** Le champ N°
  disait « il était sur …, qui n'est plus en ligne — la même paire revient ? » et
  un « oui » SUPPRIMAIT la fiche d'une paire peut-être encore sur l'étagère (son
  prix d'achat déménageait) ; le bandeau ♻️ proposait la même reprise sur un
  simple titre. ⇒ les paires présentes = en ligne + à confirmer dans
  `porteursNum`, `numeroReprises` (`presentesAnnonceIds`) et
  `vinted_nums_physiques` (comme `numDoublons`, §11) ; le dialogue dit « une paire
  le porte PEUT-ÊTRE encore » (Annuler / numéro neuf). `onlineAnnonceIds` reste
  « en ligne » : relier une vente PROUVÉE à une annonce à confirmer est juste.
- **Les chiffres** : « Annonces en ligne » écrit « ≥ N » (ou « — » à zéro) quand
  des annonces sont à confirmer, et `widget_stats.online` part à `null` (le
  widget affiche un tiret, jamais « 0 » sur l'iPhone) ; la liste dépliée du
  tableau de bord porte les N° (elle écrivait « sans N° ») ; sans `numeros`, un
  blanc plutôt qu'un faux.
- ⚠️ **`harvest_{uid}_enligne` n'est pas une capture de SA session** : comptée
  dans « Comptes liés », elle faisait dire « À jour » à un compte figé depuis
  trois jours (en permanence, dès la 5.167), et la réparation automatique levait
  « Refusé par Vinted ». `ligneDeSaSession` l'écarte des deux balayages.
  ⚠️ **Le même lecteur existe tel quel sur `main` (production)** : `main` n'écrit
  aucune ligne `_enligne` (sa 5.168 ne relit pas les autres comptes), mais une
  extension de CE chantier installée face à l'app de production y produirait le
  même faux « À jour » — ce correctif doit partir AVEC l'extension, jamais après.
- **L'écran Leboncoin** dit combien d'annonces sont « à confirmer » au-dessus de la
  file, et n'affirme plus « tu n'as pas encore d'annonce en ligne » quand toutes
  le sont. **La promesse** « vérifiées à ta prochaine visite » (et « une
  suppression sort d'ici tout de suite ») n'est faite qu'à une extension
  CONNECTÉE à CE compte VRM (`connexionExtensionVrm`) ; sinon le geste.
- **Preuves** (§6.1 sur 18880b6) : `audit-enligne.cjs` **101 contrôles, 31 rouges**
  sur 18880b6, et **30 mutations sur 30** rouges (dont `frein`, `coupure`, `tri`,
  `ongletfige`, `hotepage`, `sansgarde`, `relit`, `pagetotal`, `budget2`,
  `dressingsko`, `pubko`, `vendue2`, `supprpublic`, `passupub`) — `_fond-vm.cjs`
  sert maintenant l'URL COURANTE de l'onglet (`chrome.tabs.get`, `location`, une
  requête hors de Vinted notée dans `j.horsVinted`) ; `audit-budget-lectures`
  §6 (2 rouges sur 18880b6). Banc `enligne.cjs` §8–13 et §5/7b révisés : **19
  rouges** sur le build de 18880b6, et **9 mutations de l'app** rouges
  (`SECTIONS=` pour ne rendre que la section concernée).
- ⚠️ **Non mesuré** : ce que Vinted répond vraiment à une lecture publique refusée
  (403 ou 404 ?) ; l'ordre réel du dressing public (une republication en tête —
  la relecture de la page 1 suppose ça) ; le script iOS du widget (absent du dépôt :
  `online: null` doit y afficher un tiret).

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

### ⚠️⚠️ LA 5.170 DE PRODUCTION DITE « PÉRIMÉE », ET « RIEN D'AUTRE À FAIRE » SOUS « LECTURE SEULE » (11 octobre, 5.171)
Deux défauts de la revue du chantier ci-dessus, reproduits après la fusion
d'`integ-11oct` (annonces en ligne, photos) dans ce chantier.
- **Extension 5.171.0** : `main` a publié une **5.170** (PR #473) SANS ce
  chantier. Deux contenus ne portent jamais le même numéro.
- ⚠️⚠️ **Collision de numéros.** `CODE_DANS_ETAT`, `EXT_CAPACITES.liaison` et
  `jugeable` (pont, logo) étaient à 5.169 — en dessous de la 5.170 publiée, dont
  l'état n'a PAS `code` : sa 5.170 était dite « périmée » (« Lecture seule »,
  aucune commande ni session, « clique ⟳ » — faux : ⟳ recharge la même 5.170) et
  l'app lui promettait « je la connecte » sur un canal qu'elle n'ouvre pas.
  Les quatre frontières passent à **5.171.0**. **Invariant** : chaque frontière
  reste STRICTEMENT au-dessus de toute version publiée sans le champ.
  `scripts/audit-planchers-code.cjs` exécute `codePerime` et `extSait('liaison')`
  sur 5.168, 5.170 et ce que dit `origin/main` (sa version, `code:` dans son état,
  `demanderLiaison`) ⇒ **après un `git fetch`, il passe au rouge tout seul** si
  `main` publie encore une version sans ce code au niveau de la frontière : monter
  alors les quatre ensemble.
- **Le bandeau de liaison** disait « connectée ✓ — elle capte maintenant pour
  toi. Rien d'autre à faire. » AU-DESSUS de « Lecture seule » (une copie ancienne
  vivante : la session part adressée, les commandes restent coupées). Il lit
  l'état de l'extension (`raisonExtGlobale`, §11) et dit ce qui reste, avec le
  geste (`data-liaison-reste` : plusieurs · périmé · muette · absente · trop
  ancienne). La session VRM, elle, vient d'être posée : pas jugée ; une pause de
  Vinted n'appelle aucun geste.
- ⚠️⚠️ **TROUVÉ EN FUSIONNANT les deux chantiers** : l'écran Annonces
  (`FraicheurAnnonces`, chantier « en ligne ») promettait « elles seront
  vérifiées à ta prochaine visite » et « une suppression sort d'ici tout de
  suite » à une extension dont le CODE est périmé, pendant que la pastille disait
  « Lecture seule — clique ⟳ ». Un code d'avant ne fait pas ce que la version
  annoncée sait faire : périmé ⇒ aucune promesse, le même geste ⟳
  (`data-perime`). Et les bancs `enligne` et `supprimees` servaient un état
  « à jour » SANS `code` — une fiction depuis la frontière (§6.3) : ils servent
  la vraie forme (`code` à partir de `CODE_DANS_ETAT`, lu dans la source).
  `enligne.cjs` 13b : **2 rouges** sur le build de b4a7bc8, mutation rouge.
- Preuves : `audit-planchers-code.cjs` **6 rouges** sur 7187f88 et sur la fusion
  (7899211), 5 mutations rouges · `pont.cjs` (5.170 de production) **3 rouges**
  et `premierjour.cjs` **2** sur le build de 7899211 · `deux-extensions.cjs`
  (rendu COMBINÉ bandeau + pastille, Ma journée, 390 et 1512 px ; l'autre sens)
  **6 rouges** sur le build de 7899211, 3 mutations rouges.
- Vérifié après : 90 audits verts ; bancs rejoués un par un sur le build final —
  pont, premierjour, deux-extensions, badge, popup, publier, signal-annonces,
  tout-generer, filtre-compte, session, capacites, enligne, supprimees : verts.
  ⚠️ `publier` (3) et `signal-annonces` (1) sont sortis rouges UNE fois, sous une
  charge de 16 à 20 (d'autres sessions sur la machine) ; verts relancés seuls, et
  verts sur le build de la fusion : instables sous charge, pas un défaut.
- ⚠️ **Non mesuré** : la 5.170 réellement installée chez lui (les bancs simulent
  sa FORME : version sans `code`, pas de canal adressé — lue dans le code de
  `main`, jamais vue répondre).
- **Geste de Julien** : installer la **5.171** (pas la 5.169, jamais livrée) dans
  UN seul dossier, puis ⟳ dans CHAQUE Chrome.

### « Les notifications des messages ne sont pas toujours envoyées » — le serveur, l'app, la fuite de l'IA (11 octobre)
**Mesuré d'abord** (base en lecture seule, journaux de la base ; rapport et deux
relectures dans le scratchpad `plaintes-11oct/notifications*.md`) : **le serveur
n'a perdu aucune notification les 9 et 10 octobre** (22 emails de message, 22
envois, 0 purge). Ce qui manque est en amont : **3 comptes n'envoient aucun
email à VRM** (`angeled92` et `tomj606` jamais, `arthuror2` plus rien depuis le
23 septembre — prouvé par transaction : leurs ventes n'ont aucun
`email_bord_{tx}`), Vinted envoie l'email **~15 min 30 s** après le message, et
pas quand il a déjà répondu dans l'app Vinted (3 sur 3). ⚠️ **« Masquer mon
adresse » d'Apple n'est PAS la cause prouvée** : deux comptes retirés à adresse
Apple recevaient très bien leurs emails, et le relais d'`arthuror2` transfère.
Les « 4 messages sans email » du premier rapport étaient des réponses de Julien.
- **La notification nomme la paire** (`paireDuSujetMessage`, lue dans le sujet
  « Nouveau message à propos de … », rien d'autre) : « 💬 {paire} » /
  « Nouveau message sur {compte} — ouvre Vinted pour répondre. »
- **Quatre faiblesses de la route, reproduites puis fermées** (banc
  `notif-messages.cjs`, la vraie route, base à état) :
  · préférences illisibles ⇒ la dernière lue par l'instance, sinon on SONNE pour
    ce qui appelle un geste ou de l'argent **et les messages** (`SONNE_SI_PAS_SU`)
    — suivi, achat, favori, facture gardent leur défaut ;
  · mémo anti-doublon lu en **trois états** (`supabaseLireRow`) : une lecture
    ratée ne le réécrit plus à vide ; on envoie, et la clé est retenue par
    l'instance (`_memoEnAttente`, un REPLI) puis versée au mémo à la lecture
    suivante. Même garde sur le journal des emails (il se vidait aussi) ;
  · clé = **empreinte du texte entier** (sha256) — l'ancienne clé « sujet + 200
    caractères » reste reconnue comme ALIAS, jamais réécrite : sans elle, le jour
    du déploiement, chaque fil renvoyé re-sonnerait en entier ;
  · `push_subs` se modifie par **écriture conditionnelle** (`modifierSubs` :
    `PATCH …&data->>rev=eq.<lue>`, insertion `ignore-duplicates`, relire et
    recommencer sur conflit) — abonnements simultanés, désinscription, purge
    d'un appareil mort : plus aucun appareil perdu ; un appareil déjà inscrit ne
    réécrit plus la liste. Aucune migration : la première écriture pose `rev`.
  ⚠️ `PATCH` filtré sur `data->>rev` est la grammaire PostgREST documentée,
  **jamais appelée sur la vraie base** (lecture seule).
- **L'app dit quels comptes n'envoient aucun email, depuis quand, avec le
  geste** — UNE règle (`etatEmailsComptes`, bloc `<comptes-sans-email>`) pour
  Réglages → Notifications ET Achats → En attente (§11). « Muet » seulement sur
  **preuve** : ≥ 2 ventes captées (de plus de 3 jours, la plus ancienne de plus
  de 7) sans email de bordereau depuis le dernier signe de vie du compte. Le
  journal compte (`jujuf38` n'est plus « aucun email »), un compte qui n'a rien
  vendu est « calme » (gris), plus aucun rouge (§7), lecture ratée ⇒ personne
  n'est accusé et c'est dit. Le geste : 1) Vinted → Paramètres → Notifications
  (e-mails), 2) la boîte fait suivre — pour une adresse Apple : Réglages → ton
  nom → Connexion et sécurité → Se connecter avec Apple → Vinted → Transférer à.
  Les ventes viennent de la coque (`publierVentesCoque`/`useVentesCoque`).
- **La fuite de l'IA** (`repondreAuxMessages`, à chaque page Vinted, ~255/jour) :
  une hésitation ou une réponse vide n'était mémorisée nulle part et repartait
  chez l'IA à chaque page. **Une question par message** (`panel_msg_repondus.demandes`,
  clé `conversation:message`, 300 au plus) ; une réponse sûre retenue par le
  plafond horaire est **réutilisée** sans repayer ; IA injoignable (rien de
  facturé) ⇒ rien n'est mémorisé. L'app ne liste pas `demandes` comme un envoi.
- **Détourage** : plafond par défaut **100** photos par vendeur et par mois (150 avant).
- Preuves : `notif-messages.cjs` **23 contrôles, 14 rouges** sur 1465387, 5
  mutations rouges ; `audit-repondre.cjs` **49, 7 rouges** sur 1465387, 3
  mutations rouges ; `audit-comptes-sans-email.cjs` **16** (`--prouve` : 11
  rouges) ; banc `comptes-sans-email.cjs` **24 rouges** sur le build de
  1465387, 8 sur un build réaffaibli ; `repondre.cjs` 1 rouge sur l'avant.
  `audit-abonnement.cjs` sert maintenant la forme `return=representation`.
- **Pas fait, à savoir** : les emails d'ACTION de Vinted (« L'acheteur souhaite
  annuler », « Action requise », « Demande de remboursement ») ne sonnent
  toujours pas (relecture n° 1, N2) ; le journal par appareil (qui a reçu) ; la
  notification `new Notification` de l'app (refusée sur iPhone, N4).
- **Le geste de Julien** : sur `angeled92`, `tomj606`, `arthuror2`, vérifier les
  notifications e-mail dans Vinted puis le « Transférer à » d'Apple ; remplacer
  le script Gmail par celui du dépôt (il en tourne un d'avant le 4 octobre).
- ~~Extension : `background.js` touché, version inchangée~~ — **FAUX, corrigé
  par la revue ci-dessous** : ce contenu portait le numéro 5.168.0, déjà publié
  par `main` (PR #472) avec un AUTRE `background.js`. Extension **5.173.0**.

#### Revue du chantier notifications (11 octobre, 5.173) — 17 constats, tous reproduits puis corrigés
Chacun ROUGE sur le code d'avant (9af5943 / 0ae270e / 6f305b3), vert après,
ROUGE sous mutation.
- ⚠️⚠️ **Version** : ce chantier modifiait `background.js` SOUS le numéro 5.168.0
  déjà servi par la production, puis la production est passée en 5.170 sans le
  correctif de l'IA — une extension installée depuis l'une ou l'autre se serait
  dite « à jour ». Fusion d'integ-11oct (vrai merge) et **5.173.0** (5.169/5.171 :
  chantier extension, 5.172 : chantier eBay). `audit-extension-zip` refuse
  désormais qu'une version DÉJÀ servie par `main` change de contenu (il lit
  l'historique de main : rouge sur f3cbac2 et sur ce contenu sous 5.170).
- ⚠️⚠️ **L'ancienne clé anti-doublon AVALAIT les nouveaux messages** d'une paire
  déjà notifiée par l'ancien code (même d'un autre acheteur) : elle n'est un alias
  que si elle couvrait tout le corps (≤ 200 caractères). Au-delà, un fil renvoyé
  le jour du déploiement re-sonne UNE fois — une notification de trop se répare.
- **Une identité PAR EMAIL** : le Message-ID (script Gmail : `getHeader('Message-ID')`,
  repli `getId()` ; Worker : `message.headers.get('Message-ID')`), lu par
  `normaliserEntrant` (`messageId`). Deux messages d'une même conversation au
  corps identique (la forme mesurée) sonnent tous les deux. ⚠️ **Le script Gmail
  et le Worker doivent être recollés** : sans eux, l'empreinte du texte reste le
  repli (et deux corps identiques n'en font qu'un).
- **Préférences illisibles** : relues une fois, puis la dernière lue (instance),
  puis la copie gardée AVEC LES APPAREILS (`push_subs.prefs`, écrite par le
  serveur seulement quand elle change, jamais au détriment de la liste), sinon le
  DÉFAUT. Plus de `SONNE_SI_PAS_SU` : des messages coupés ne sonnent plus sur une
  instance froide. ⚠️ Un vendeur dont les préférences n'ont jamais été lues ET
  sont illisibles ne reçoit pas ses messages (défaut « non ») — « pas su » ne
  vaut pas « oui ».
- `paireDuSujetMessage` : « à propos de » seulement (« concernant » donnait
  « 💬 ta commande »).
- ⚠️⚠️ **La fuite de l'IA n'était pas fermée** : une réponse PAYÉE mais illisible
  (`reason:'parse'` — JSON tronqué, texte libre, vraie réponse vide) était prise
  pour « IA injoignable » et redemandée à chaque page (10 sur 10). `api/ai.js` dit
  `facture: true` après tout 2xx d'Anthropic ; l'extension la range (« illisible »,
  jamais redemandée). L'audit servait une forme que le serveur ne rend pas
  (`{ok:true, suggestions:[{text:'  '}]}`) : il exécute maintenant le VRAI
  `api/ai.js` (§6.3). IA pas branchée / injoignable / illisible : comptée à part
  (`bilan.iaKO` + causes), l'app écrit « l'IA n'a pas répondu (cause) — rien n'est
  parti », plus « elle n'était pas sûre ».
- **Comptes sans email** : on ne juge que les ventes POSTÉRIEURES au début de la
  réception (le plus ancien email lu, tous comptes ; inconnu ⇒ personne n'est
  muet) — un compte dormant ou une nouvelle vendeuse n'est plus accusé.
  « Calme » = aucune vente depuis ce début ; une vente sans email sous le seuil =
  « à surveiller » avec sa phrase ; exclu = « exclu — non vérifié ». Le bloc dit
  l'effet PROUVÉ (« pas de rappel du matin pour leurs colis à poster » :
  `ship-reminders` ne compte que les `email_bord_*`), plus « leurs codes de
  retrait » ; singulier pour un compte ; Réglages déplié ne redit pas le
  résumé ; la table ne redit pas un compte nommé au-dessus ; Achats : une ligne
  repliée (44 px à 390), APRÈS les colis jamais retirés.
- Preuves : `notif-messages.cjs` 37 (10 rouges, 5 mutations) · `audit-repondre`
  65 (14 rouges, 3 mutations) · `repondre.cjs` (2 rouges) ·
  `audit-comptes-sans-email` 26 (10 rouges ; `--prouve=ancienne|debut|calme`
  20/3/6) · `comptes-sans-email.cjs` (29 rouges, 2 mutations d'écran) ·
  `audit-extension-zip` (rouge sur 5.168 et sous mutation 5.170).
- **Non mesurable ici** : le vrai corps d'un email de message (deux messages
  d'une même conversation) — l'identité par Message-ID le contourne, mais ne
  marche qu'une fois le script Gmail / le Worker recollés ; ce que `ship-reminders`
  devrait compter pour les comptes muets (les colis attendus d'après la moisson)
  — dit, pas codé ; la forme réelle d'un 4xx d'Anthropic facturé (aucun appel réel).
- **Gestes de Julien** : installer la **5.173**, recoller `scripts/gmail-forwarder.gs`
  et le Worker de `docs/email-pipeline.md`.

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

### Leboncoin publié depuis VRM, Super PDP, titre eBay (16 octobre, 5.182)
- **Fiche Leboncoin dans l'app** (`FicheLbc`, Leboncoin → Annonces) : titre (50 car.), prix, état (4 libellés MESURÉS du dépôt, l'état Vinted, ou « laisser Leboncoin demander »), photos captées choisies et ordonnées, description qui garde `VRM-{n°}`. Un bouton publie ; l'avancement arrive en direct (`depotProgres`, nettoyé par le fond, seulement depuis l'onglet du dépôt en cours). Règle commune `<annonce-lbc-regle>` (texte identique app/extension) ; l'extension **revérifie** tout (`appliquerAnnonceLbc`) et refuse en entier une fiche invalide. Extension < 5.182 : une fiche non corrigée part « tel quel », une fiche corrigée est grisée. Preuves : `audit-lbc-fiche.cjs` (19 rouges sur l'avant), banc `lbc-publier-app.cjs`. ⚠️ **Non mesuré sur le vrai leboncoin.fr.**
- **Super PDP** (facturation électronique, Comptabilité) : mode `superpdp` de `/api/compte` (toujours 12 fonctions), identifiants du VENDEUR vérifiés chez Super PDP puis rangés **chiffrés** (`superpdp_cle`, clé `VRM_COFFRE_CLE` ou dérivée de `SUPABASE_SERVICE_KEY` ; sans clé de coffre : rien n'est rangé), jamais relus par le navigateur (§2.9). Envoi à trois issues (envoyée · refusée · incertaine), `external_id` = n° FX-AAAA-NNNN, une incertaine est CHERCHÉE avant tout renvoi. E-reporting PAS branché (forme non confirmée). ⚠️ **Formes d'API tirées d'un client open source** (la doc officielle est bloquée d'ici) : à vérifier sur le bac à sable. Preuves : `audit-superpdp-route.cjs` (36 rouges sur l'avant), banc `superpdp.cjs`.
- **Titre eBay** : `lbcTitre` écrit désormais « taille 36 » (plus « T36 ») ; `ebayTitre` ne retirait que « T36 » ⇒ « taille 36 taille 36 » (capture de Julien). `audit-titre-ebay.cjs` (6 rouges sur l'avant).
- **Refonte premium** (coque mobile `styles-coque.css`, Réglages iOS `styles-reglages.css`, Achats/Messages, Annonces/Leboncoin/eBay, Ventes/Colis) : bancs `coque-mobile`, `reglages-premium`, `achats-messages-premium`, `plateformes-premium`, `ventes-colis-premium`. ⚠️ Sur téléphone sans extension, le fil de Messages remplace la saisie par « Répondre sur Vinted ↗ ».

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

### Revue adverse de l'extension (17 octobre, 5.184) — trois défauts reproduits
Chacun REPRODUIT d'abord en exécutant le vrai `background.js` (`_fond-vm.cjs`,
harnais des audits), rouge sur 1872a1a (§6.1, arbre archivé, audit lancé depuis
lui), vert après.
- ⚠️⚠️ **Le plafond de 20 actions/heure cédait à deux gestes simultanés.**
  `compterAction` (et `compterLecture`) faisaient lire-ajouter-réécrire dans
  `chrome.storage.local` sans file : trois réponses lancées ensemble à 19
  actions partaient TOUTES les trois, et quatre gestes sur un budget vide n'en
  notaient qu'UN (la suite de l'heure dépassait encore). Le relais du téléphone
  rend ce cas réel (un geste du téléphone pendant un clic dans l'app). ⇒ une
  chaîne de promesses (`unCompteurALaFois`) sérialise le compte — ce n'est pas un
  tampon de données (§4.9), l'état reste dans le stockage.
  `audit-compteurs-concurrents.cjs` : 4 rouges sur l'avant.
- ⚠️⚠️ **Une marque Leboncoin ratée publiait la paire deux fois.** `markPosted`
  (après une publication réussie) et « Déjà publiée » (`lbcMarque`, `ebayMarque`)
  jetaient le résultat de l'écriture de `vinted_lbc_posted` : base qui hoquette ⇒
  l'app lisait « fait », la paire restait dans la file, et un nouveau « Publier »
  (le téléphone par le relais ne voit pas l'état des jobs) ouvrait un SECOND
  dépôt qui publie tout seul. ⇒ `writePosted`/`markLbcPosted` rendent le vrai
  résultat ; « Déjà publiée » ratée répond `lecture` ; une publication non notée
  garde `nonMarquee` sur sa commande, et `publierDepuisApp` retente la marque au
  clic suivant sans JAMAIS rouvrir de dépôt (`deja-publiee`, même confirmé).
  `audit-publier-app.cjs` : 4 rouges sur l'avant.
- **Relais : « en cours » écrasait « fait ».** `traiterRelais` inscrivait le
  suivi du bordereau AVANT d'écrire « en-cours » : un job rapide (PDF déjà prêt
  chez Vinted) écrivait « fait » pendant que « en-cours » traînait dans une base
  lente, et l'écrasait en arrivant — le téléphone restait « En cours sur ton
  ordinateur… ». Et « pdf » puis « fait » partaient en parallèle. ⇒ « en-cours »
  d'abord, puis le suivi, puis l'état relu (un job déjà fini est relayé) ;
  `relaisSuivreJob` passe ses étapes une à une. `audit-relais.cjs` §10 : 3 rouges
  sur l'avant.
- Cherché sans rien trouver de confirmé : helpers hors portée (balayage Babel de
  tous les fichiers de l'extension : 0), balayages non paginés (tous bornés par
  compte), lire-fusionner-réécrire sans garde de lecture ratée (tous gardés).
- Extension **5.184.0**, zip régénéré, `EXT_ATTENDUE` suivie. Aucune entrée
  d'`EXT_CAPACITES` : des corrections.

### Ce que sait faire l'extension dépend de SA version — `EXT_CAPACITES`
Le défaut le plus coûteux du projet (l'app promet ce que l'extension installée
ne sait pas faire) s'est reproduit **trois fois**. Il ne se traite pas au cas par
cas : l'app tient **une table**, chaque capacité portant **la version où elle est
arrivée** — vérifiée commit par commit sur `manifest.json`, pas devinée.

| capacité | fonction de l'extension | arrivée en | ce que l'app promet |
|---|---|---|---|
| `codes` | `capterRetraits` | **5.45.0** (27 août) | « l'extension va chercher les codes toute seule » |
| `releve` | `capterReleves` | **5.52.0** (5 sept.) | « l'extension récupère le relevé à ta prochaine visite » |
| `places` | `mpChoisi` | **5.54.0** (11 sept.) | « seules les annonces cochées partent sur Leboncoin » |
| `ebay` | `buildEbayData` | **5.55.0** (12 sept.) | « l'extension prépare tes annonces sur eBay » |
| `lbctitre` | `lbcTitre` | **5.55.4** (12 sept.) | « le titre exactement tel qu'il partira sur Leboncoin » |
| `photoslbc` | `photosEnOctets` | **5.58.0** (13 sept.) | « photos attachées au formulaire Leboncoin, rien sur ton ordinateur » |
| `photosebay` | `photosPourEbay` | **5.59.0** (13 sept.) | la même promesse, pour eBay |
| `repond` | `repondreAuxMessages` | **5.77.0** (19 sept.) | « elle répond aux questions posées sur tes annonces » |
| `commande` | `executerCommande` | **5.129.0** (2 oct.) | « Générer le bordereau » depuis l'app : l'app COMMANDE l'extension |
| `publication` | `publierDepuisApp` | **5.130.0** (3 oct.) | « Publier sur Leboncoin » / « Préparer sur eBay » depuis l'app |
| `lbcdate` | `dateVenteLbc` | **5.131.0** (3 oct.) | « ouvre Mes transactions, l'extension relève la date de vente » |
| `versement` | `capterDatesVersement` | **5.133.0** (3 oct.) | « l'extension va chercher la date de versement de tes ventes finalisées » |
| `messagerie` | `executerPourApp` | **5.135.0** (3 oct.) | lire un fil, accepter/refuser/faire une offre depuis l'app |
| `lbcpdf` | `pdfBordereauLbc` | **5.136.0** (3 oct.) | « 🖨 Imprimer le bordereau » Leboncoin, tamponné du titre et du N° |
| `lbcmsg` | `storeLbcMessages` | **5.153.0** (4 oct.) | Leboncoin → Messages : « l'extension relève tes non-lus, compte par compte » |
| `vestiaire` | `storeVcRecon` | **5.154.0** (4 oct.) | Vestiaire : « ouvre Vestiaire dans ce Chrome, l'extension apprend à le lire » |
| `detourage` | `detourerPhotos` | **5.156.0** (4 oct.) | « tes photos sont détourées (fond blanc) avant d'être attachées à Leboncoin » |
| `supprimees` | `noterSuppression` | **5.165.0** (11 oct.) | « une suppression faite sur vinted.fr dans ce Chrome sort d'ici tout de suite » |
| `enligne` | `relireAnnoncesAutresComptes` | **5.170.0** (11 oct. — les 5.167/5.168 de production ne la portent pas) | « tes autres comptes sont relus à ta prochaine visite sur Vinted, sur n'importe lequel de tes comptes » — et seulement si l'extension est connectée à CE compte VRM (revue, 5.170) |
| `preuves` | `capterPreuvesVente` | **5.172.0** (11 oct. — ni la 5.167, ni la 5.168, ni la 5.170 publiées ne l'ont ; la 5.169 et la 5.171 sont prises par d'autres chantiers) | « l'extension lit toute seule la transaction des ventes en cours pas encore reliées (anti double vente) » |
| `relais` | `traiterRelais` | **5.183.0** (16 oct. — la 5.182 publiée par main, fiche Leboncoin, ne l'a pas) | « sur le téléphone : actions via ton ordinateur » (le relais lit le signe de vie, pas le pont) |
| `liaison` | `demanderLiaison` | **5.171.0** (11 oct. — la 5.170 de production ne la porte pas) | « je connecte l'extension à ton compte VRM — rien à taper » (session adressée) |
| `etatcompte` | `noterEtatCompte` | **5.181.0** (16 oct.) | « compte actif / banni par Vinted » relevé par l'extension (`panel_comptes_etat`) |
| `lbcfiche` | `appliquerAnnonceLbc` | **5.182.0** (16 oct.) | publier sur Leboncoin l'annonce CORRIGÉE dans la fiche de VRM (titre, prix, état, photos, description) |

⚠️ **DEUX SEUILS POUR UNE MÊME NOTION, EXPRÈS.** Les photos s'attachent côté
Leboncoin depuis la 5.58 et côté eBay depuis la 5.59 : un seul seuil aurait
menti dans un sens (promettre à une 5.58 que ses annonces eBay partent avec leurs
photos — le défaut le plus coûteux du projet) ou dans l'autre (réclamer une mise
à jour qui ne change rien, ce que le dossier interdit aussi). Et comme
`audit-coherence.cjs` exige qu'une capacité cite une **fonction** de
`background.js`, le pont eBay passe par `photosPourEbay` — une ligne de pont ne
se date pas, une fonction si. `MP_PLACES` porte `capPhotos` place par place.

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

⚠️⚠️ **ET LA LIGNE DES PLACES ÉCRIVAIT LA MÊME PHRASE DEUX FOIS.** Vu au rendu
le 13 septembre, sur l'écran Annonces : Leboncoin et eBay portaient chacun
« *Ton choix est enregistré. C'est l'extension, dans ton Chrome, qui prépare
ensuite chaque annonce sur X — ouvre l'app sur l'ordinateur où elle est
installée.* » — **150 caractères écrits deux fois**, dont seul le nom de la place
changeait, et il est déjà dans le titre de la ligne juste au-dessus. C'est §7 mot
pour mot (les 13 × « code pas encore reçu », les 14 × « l'extension le
récupère »), sur l'écran où il coche ses annonces. La phrase commune se dit
**une fois au-dessus des lignes** ; sur la ligne il ne reste que ce qui
distingue.
- ⚠️ **On juge sur la PHRASE RENDUE, pas sur l'état** : deux places « en retard »
  ne réclament pas la même version (5.54 et 5.55), donc leurs phrases
  **distinguent** et restent sur leur ligne. Fusionner sur l'état aurait donné
  une seule consigne, fausse pour l'une des deux. D'où une clé qui porte tout ce
  qui varie.
- Le banc `capacites.cjs` **cherche la répétition**, pas une formule — un
  contrôle posé sur le libellé serait vert le jour où quelqu'un reformule
  (§6.5). Et il exige **les deux moitiés** : aucun doublon **et** les deux places
  toujours nommées — un contrôle qui n'aurait que la première serait vert sur un
  écran qui a perdu eBay.
- ⚠️⚠️ **ET MON PREMIER JET DE CE CONTRÔLE NE POUVAIT PAS ÉCHOUER.** Il exigeait
  deux phrases **identiques** — or les deux lignes différaient d'un mot (« sur
  Leboncoin » / « sur eBay »). **Vert sur le défaut**, donc *pire qu'absent : il
  rassurait* (même famille que le `DIST` absolu des quatorze bancs et
  qu'`audit-coherence.cjs` qui sortait toujours en 0). Ce qui se répète n'est pas
  la phrase exacte mais sa **substance** : on mesure le plus long morceau de
  texte **commun** à deux phrases rendues, et **60 caractères identiques** valent
  une phrase écrite deux fois, quel que soit le mot qui change au milieu.
  **2 échecs** sur le code d'avant, 0 après — et le message cite le morceau
  répété. *Un contrôle se vérifie sur le code d'AVANT, toujours, même quand la
  règle paraît évidente.*

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

### Double vérification de connexion (TOTP, 16 octobre)
Retenue par Julien le 11 octobre (n° 17). **Facultative** : Réglages → Mon
compte → Connexion → « Double vérification ». Rien ne change pour qui ne
l'active pas.
- **L'API MFA native de GoTrue, à la main** (comme le reste de l'auth, aucune
  bibliothèque) : `POST /factors` (totp) → QR (`data:image/svg+xml`, affiché en
  `<img>`, jamais en HTML) + clé à recopier ; `challenge` + `verify` (rend des
  jetons `aal2`) ; `DELETE /factors/{id}` ; `GET /user` (porte `factors`).
  Helpers : `totpVerifies`, `aalDuJeton`, `etatMfa`, `mfaPasse`, `mfaAppel`,
  `mfaVerifierCode`, `mfaLireFacteurs`.
- **La session porte `totp`** (les facteurs TOTP VÉRIFIÉS), lu dans le `user` de
  chaque réponse de jeton (mot de passe, renouvellement, PKCE, lien email par
  `fetchMe`). `etatMfa` : `aal2` ⇒ entrer · `totp` non vide ⇒ le code · `[]` ⇒
  entrer · absent (session rangée avant cette fonction) ⇒ on relit `/user`.
- **La porte vit dans `App`, AVANT le cœur** (`PorteMfa`) : tant que le code
  n'est pas passé, `AppCoeur` ne monte pas, aucune lecture au nom du vendeur ;
  ni l'extension (`assurerSessionExtension`), ni le relais du téléphone
  (`relaisUtile`), ni l'abonnement aux notifications (`main.jsx`) ne partent.
  Vaut pour une session restaurée au rechargement.
- **« Activée » ne s'écrit qu'après un premier code juste.** Désactiver :
  confirmation + code (la session repasse en `aal2`, ce que GoTrue exige pour
  supprimer un facteur vérifié).
- **Personne enfermé dehors** : GoTrue injoignable ⇒ « le service de connexion
  ne répond pas », « Réessayer » (et nouvel essai seul toutes les 15 s quand on
  ne sait pas s'il faut un code) ; jamais de déconnexion automatique. Téléphone
  perdu : l'écran dit que ça ne se retire pas d'ici et donne l'adresse de
  contact (`src/contact.js` — vide aujourd'hui ⇒ « adresse de contact à venir »).
  Aucune procédure inventée.
- **L'extension** : sa session (`/api/compte?mode=session-extension`, lien
  magique) est en `aal1`, et c'est sans effet sur ce qu'elle fait — RLS ne
  regarde pas `aal`. Elle n'est simplement plus fabriquée avant le code.
  Extension NON modifiée, pas de bump.
- ⚠️ **Limite à connaître** : la double vérification protège l'APP (l'écran),
  pas l'API. Une session `aal1` (mot de passe seul) lit encore la base en
  direct : RLS n'exige pas `aal2`. L'exiger (règle restrictive `aal = aal2`
  quand un facteur existe) couperait l'extension, dont la session est `aal1`.
  À trancher plus tard, avec une session extension en `aal2`.
- Preuves : banc `bancs/double-verification.cjs` (port 4981, faux GoTrue à la
  forme documentée, 390 tactile + 1512 px) — sans MFA comme avant (connexion et
  session d'avant), activation (QR, clé, code faux refusé, « activée » après),
  désactivation (code faux, DELETE en `aal2`), connexion protégée (zéro lecture
  au nom du vendeur avant le code, rechargement compris, code faux refusé),
  GoTrue injoignable (ni « activée », ni déconnexion). **63 contrôles** ; sur le
  build d'avant (§6.1, banc copié dans l'arbre de 0969738) **20 rouges** — les 8
  verts sont les cas « sans double vérification », comme attendu. Le banc ne
  compte que les lectures faites AVEC le jeton du vendeur (les sondes anonymes
  de l'écran de connexion ne lisent rien de lui). `audit-photos-vinted` admet
  le `<img>` du QR (source fermée : `qrEnSrc`). ⚠️ `demarrage.cjs` sort 1 rouge
  (« une vraie nouvelle vente est annoncée ») — **déjà rouge sur 0969738**, sans
  lien avec cette passe.
- **Non mesuré** : le vrai GoTrue de production (formes tirées de la doc
  Supabase) ; que TOTP soit activé dans le projet (Authentication → MFA —
  **geste de Julien : vérifier**, rien n'a été écrit en production) ; « mot de
  passe oublié » sur un compte protégé (`PUT /user` en `aal1` : GoTrue peut le
  refuser, l'erreur est affichée, puis le code est demandé) ; un compte qui
  active la double vérification sur un appareil voit ses AUTRES sessions `aal1`
  demander le code au renouvellement suivant de leur jeton (≤ 1 h).

---

### Studio photo : cadre guide + détourage DANS le navigateur (fonction n°33, 17 octobre)
Retenue le 11 octobre (« studio photo + détourage »), sous §2.9 : rien de payant
sur la clé de Julien. Annonces → « ⋯ Outils » → **Studio photo**
(`src/StudioPhoto.jsx`, `src/studioPhoto.js`, chargés au clic par `React.lazy`).
- **Le cadre** : on choisit une paire PRÉSENTE (la liste de l'inventaire
  physique, `porteursNum` — jamais un numéro tapé), la caméra s'ouvre
  (`getUserMedia`, caméra arrière) dans une zone 3:4 avec un gabarit SVG (bord,
  ligne de sol, axe). La photo prise est exactement ce que montre le cadre,
  rangée dans `studio_photos_{N°}` (une ligne par paire, 12 photos au plus,
  lire-fusionner-réécrire GARDÉ : une lecture ratée n'écrit rien et le dit).
  Caméra refusée ou absente ⇒ la phrase le dit et le champ fichier
  (`capture=environment`) prend le relais, recadré au même format.
- **VRM ne publie rien sur Vinted** : « Enregistrer » télécharge la photo, il
  l'ajoute lui-même dans l'app Vinted (l'écran le dit).
- **Le détourage, local, sans clé, sans envoi** : modèle **U²-Netp**
  (`public/modeles/u2netp.onnx`, 4,6 Mo, servi par VRM, chargé au clic).
  ⚠️ **LICENCES vérifiées à la source le 16 octobre** : U²-Net = **Apache 2.0**
  (fichier LICENSE de github.com/xuebinqin/U-2-Net) ; conversion ONNX de rembg =
  **MIT** (sha256 `309c8469…`) ; moteur **onnxruntime-web 1.22.0 = MIT**, chargé
  depuis cdn.jsdelivr.net au clic. Notices dans `public/modeles/LICENCES-u2netp.txt`.
  **Écartés** : `@imgly/background-removal` (AGPL), RMBG-1.4 (non commercial),
  le paquet npm `@rmbg/model-u2netp` (aucune licence déclarée). L'originale est
  TOUJOURS gardée à côté de la détourée ; aucune route ajoutée (12 fonctions).
- **Décision** : le chemin Photoroom existant (`api/_lib/detourage.js`,
  `PHOTOROOM_POUR`) n'est pas touché ; la clé PAR VENDEUR (modèle Super PDP)
  n'a pas été écrite, le détourage local la rend non nécessaire pour ce studio.
  Extension non touchée.
- **Preuves** : banc `scripts/bancs/studio-photo.cjs` (port 4991, données
  inventées, fausse caméra Chromium, 390 tactile et 1512) — **55 contrôles** :
  cadre par-dessus la caméra, photo rangée pour la BONNE paire et au format
  3:4, détourée avec transparence (≈ 75 % transparent / 23 % opaque sur
  l'image de la fausse caméra), aucune requête payante (Photoroom, POST
  `/api/ai`, `mode=detourage`), rien du moteur avant le clic, seul hôte
  extérieur cdn.jsdelivr.net, caméra refusée ⇒ repli + phrase, lecture KO ⇒
  rien écrit. **Rouge sur le build d'avant** (le studio n'existe pas, 2 KO) ;
  deux mutations (alpha forcé à 255, lecture ratée lue « vide ») ⇒ **4 rouges**.
  Le moteur est servi au banc depuis une copie locale (`BANC_ORT_DIR`, sinon
  téléchargé une fois par curl dans le dossier temporaire).
- **Non mesuré** : la QUALITÉ sur de vraies chaussures (aucune photo réelle
  joignable d'ici — u2netp est léger, bords doux : l'écran demande de vérifier) ;
  Safari iOS réel (getUserMedia en PWA, encodage WebP — repli PNG prévu) ; le
  temps de calcul sur un vrai téléphone (≈ 16 Mo téléchargés au premier
  détourage) ; le poids des lignes `studio_photos_*` dans la sauvegarde
  complète (elles y entrent, comme toute donnée captée).

### Double vente, app fermée : la notification part du serveur (17 octobre)
Fonction n°2 retenue le 11 octobre. L'alerte « vendue sur Vinted → encore en
vente sur eBay / Leboncoin » ne se calculait que VRM ouvert. `api/email-inbound`
envoie maintenant une notification dès qu'une vente Vinted arrive par email
(bordereau, « ton article s'est vendu »), **si et seulement si** la paire est
PROUVÉE en vente ailleurs. Règle pure : `api/_lib/double-vente.js`.
- **Identité par le N° seulement** (§5) : le N° LU dans l'email (après le
  jugement 013 de `numeroDEmail`). Le N° retrouvé par ressemblance de titre
  (`findNumeroByTitle`, `parTitre`) sert à tamponner le bordereau, **jamais** à
  affirmer une double vente.
- **eBay** : SKU `VRM-{n°}` d'une annonce de `ebay_listings*` (comptes eBay
  actifs du registre, `comptesActifs`), traduit par la carte 013 PAR ANNONCE
  (`numeroExterne`, `ebayAnnonces`) — la règle de `numEbayLu`.
  **Leboncoin** : annonce à lui (`annonceLbcALui`, comptes prouvés par ses
  ventes), pas morte, pas vendue sur Leboncoin, clé = lien posé à la main ou
  référence VRM (réf / CustomRef), traduite par `lbcAnnonces`. ⚠️ Plus strict que
  l'app, exprès : le « nXXX » d'un TITRE Leboncoin n'est pas retenu (ressemblance,
  et ancien numéro possible après la remise à zéro).
- **Pas su ⇒ rien** : marqueur 013, registre eBay, annonces eBay, annonces ou
  ventes Leboncoin illisibles ⇒ la plateforme concernée ne dit rien ; base
  cloisonnée sans vendeur résolu ⇒ rien (une lecture sans filtre lirait tous les
  vendeurs). Rejeu en lot (`silence`) ⇒ rien.
- **Une seule fois** : `pushOnce` (mémo `push_dedup`, lire-fusionner-réécrire
  gardé). Clé = N° + annonces rencontrées (`dv-230-ebay:1111`) : le bordereau et
  l'email « vendu » d'une MÊME vente, ou un email rejoué, ne sonnent qu'une fois.
  ⚠️ Décision : pas la transaction — l'email « vendu » n'en porte pas, et les
  deux emails d'une vente doivent tomber sur la même clé.
- **Contenu** : « ⚠️ Vendue sur Vinted — N°230 encore en vente sur eBay » /
  « {paire} — N°230 est encore en vente sur eBay : retire-la… », ouvre
  `?tab=ebay_annonces` (ou `?tab=leboncoin`). Rien n'est retiré tout seul.
- **Préférence `doublevente`**, activée par défaut, la même dans `PUSH_CATS` (app)
  et `PUSH_DEFAUT` (serveur) — `audit-bilan-semaine.cjs` compare les deux.
  Abonnement coupé ⇒ rien (`sendPushToAll`). Aucun cron, toujours 12 fonctions.
- **Coût** : la lecture des annonces ne part que pour une vente qui porte un N°
  et une catégorie active. Projetées (`data->items`, jamais `select=data`), mais
  `lbc_listings` pèse ~226 Ko : quelques ventes par jour, accepté.
- **Preuves** : banc `scripts/bancs/double-vente-push.cjs` (la vraie route, base
  cloisonnée à deux vendeurs, faux Web Push, 26 contrôles) — **11 rouges** sur
  l'avant (§6.1, copié dans l'arbre d'avant) ; `--mutation=titre` (N° par titre
  compté) 1 rouge, `--mutation=passu` (lecture ratée = vide) 2 rouges,
  `--mutation=dedup` (envoi direct) 1 rouge.
- **Non mesuré** : la forme réelle des lignes `ebay_listings` / `lbc_listings` en
  production (lues telles que la synchro et l'extension les écrivent) ; un
  `ebay_listings` incomplet ne fait que MANQUER une alerte (le sens sûr) ; une
  annonce retirée d'eBay à la main sans synchro reste « en vente » jusqu'à la
  synchro suivante (fausse alerte possible, le temps d'une synchro).
- **Julien** : rien — la catégorie est activée d'office (Réglages →
  Notifications pour la couper).

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

---

## 6. Comment on vérifie (et pourquoi ça compte)

**La méthode : mesurer la vraie base AVANT de coder.** La moitié des « bugs »
signalés venaient d'un de mes propres scripts qui lisait le mauvais champ.
Avant de conclure « c'est vide » : vérifier le **nom** et la **forme** du champ
(le prix Vinted est un **objet** `{amount}`, pas un nombre).

| outil | quoi |
|---|---|
| `npm run build` | compile — ne voit ni les variables absentes ni le rendu |
| `node scripts/audit-*.cjs` | **84 audits** : identité, chiffres, cohérence app↔extension, QR, colis, push, URSSAF, relevé, variables non déclarées, secrets… |
| `scripts/bancs/*.cjs` | les **76 bancs** — l'app **rendue sur les vraies données**, à 390 px et 1512 px — leur `README.md` dit comment les lancer. ⚠️ Leurs fixtures (`fx/`) ne montent **jamais** dans le dépôt : vraies ventes, vrais acheteurs, vraies adresses, dépôt **public**. `audit-bancs.cjs` le vérifie. |
| `node scripts/audit-*.cjs` | **94 audits** : identité, chiffres, cohérence app↔extension, QR, colis, push, URSSAF, relevé, variables non déclarées, secrets… |
| `scripts/bancs/*.cjs` | les **85 bancs** — l'app **rendue sur les vraies données**, à 390 px et 1512 px — leur `README.md` dit comment les lancer. ⚠️ Leurs fixtures (`fx/`) ne montent **jamais** dans le dépôt : vraies ventes, vrais acheteurs, vraies adresses, dépôt **public**. `audit-bancs.cjs` le vérifie. |
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

⚠️⚠️ **PLUSIEURS SESSIONS MERGENT SUR `main` EN MÊME TEMPS** (3 octobre : une
session fait l'extension et les colis Leboncoin, une autre eBay). Pour amener
`main` dans sa branche : **`git merge origin/main`, un VRAI merge**, conflits
résolus à la main — **jamais `git merge -s ours`** : il garde l'arbre de la
branche, la PR qui suit **défait en silence** tout ce que les autres ont mergé.
Après le merge, `git diff origin/main --stat` ne doit montrer **que ses propres
fichiers**. Et ne pas toucher au domaine d'une autre session (eBay) : lui laisser.
⚠️⚠️ **LE PLAN GRATUIT DE VERCEL PLAFONNE À 100 DÉPLOIEMENTS PAR 24 H — ET LES
BRANCHES `claude/…` LES AVAIENT TOUS MANGÉS** (4 octobre). Chaque `git push` sur
une branche créait une prévisualisation : 59 ce jour-là (36 pour une seule
session), plus 24 mises en production. Le merge de la PR #441 est tombé sur
« Deployment rate limited — retry in 24 hours » : `main` était à jour, le site,
lui, restait sur la version d'avant. ⇒ `vercel.json` coupe désormais les
déploiements des branches `claude/**` (`git.deploymentEnabled`) ; seul `main`
se déploie. La preuve d'une branche, ce sont **nos** audits et bancs, pas une
prévisualisation. ⚠️ **Ne jamais « promouvoir » une prévisualisation pour
contourner la limite** : les clés de service (Supabase, notifications, cron,
Stripe, eBay) n'existent qu'en Production — la promouvoir couperait la réception
des emails, les notifications et les paiements. Attendre la fenêtre, ou que
Julien décide de passer en Pro.
⚠️ Ne jamais lancer `npm run build` pendant qu'un banc sert `dist/`.
⚠️ `git fetch` avant toute comparaison avec la production : une référence locale
jamais rafraîchie ment en silence.

---

## 7. Le visuel

Règle unique, posée après six passes ratées :

> **UNE SEULE couleur d'accent, et elle est RARE.** Tout le reste est neutre. Un
> chiffre ne porte une couleur que s'il y a **vraiment quelque chose à rattraper**.

Famille actuelle (30 septembre, **« VRM Noir » tirée du logo de Julien** —
`public/logo-vrm.png` : carré noir, « VRM » argent, liseré bleu) : sombre
`#07090D` / cartes `#10141B` / rail `#030406`, **un seul accent bleu
électrique `#3D7BFF`** (clair : fond `#F4F6FA`, accent `#2458E6`). Le logo
(image) est en petit en haut (en-tête téléphone, rail ordinateur) ; la pièce
3D de l'accueil est RETIRÉE (demande de Julien, elle chevauchait le titre sur
téléphone). La menthe est abandonnée. Mode sombre choisi, pas inversé
automatiquement.
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

### Les formes communes (revue du 16 octobre) — banc `formes-communes.cjs`
Une fonction, une forme. Avant d'écrire un contrôle, **réutiliser** celui-ci :
- **Contrôle segmenté** : `Segmente` (App.jsx) = `.vrm-seg` + `.vrm-seg-btn`
  (styles-coque.css), le même dessin que les sous-onglets des plateformes ;
  `aria-pressed` pour un choix d'écran, `aria-current` pour une section ;
  `plein` = segments égaux. **Jamais de segment bleu plein** (§7). Colis
  (imprimante), Achats, Compta (période), Stock (vues), Réglages (taille de
  l'affichage, détourage) y passent.
- **Filtres** : la rangée porte `vrm-filtres` ; pastille neutre, l'active à
  l'encre (clair) ou en surface élevée bordée (sombre — jamais blanc plein).
- **Replis** : `className="vrm-repli"` sur le `<details>` (et `vrm-label-help`,
  `vrm-quick-settings`, `vrm-ann-stock-tools`, `vrm-platform-summary`) = une
  rangée de 44 px à l'encre, chevron › qui tourne ; ni texte gris, ni triangle
  du navigateur. Ne pas remettre de style en ligne sur le `<summary>`.
- **Lien-texte au doigt** : sans fond, sans bordure, `padding:0` (ou la classe
  `vrm-lien-action`) ⇒ la boîte garde 44 px, une marge négative rend la place
  à la ligne (« tout voir » ne gonfle plus sa rangée à 44 px).
- **Rangée qui défile** (`.vrm-rangee`, `.vrm-carrousel`, `.vrm-defile`) : un
  fondu sur le bord droit, posé seulement si elle DÉBORDE — c'est
  `src/rangeesDefilantes.js` qui mesure (`data-defile="suite"`).
- Sombre : le logo porte un liseré ; un bouton grisé (« Tout générer »,
  « Bordereau ») = l'encre à 46 %, plus « texte secondaire à 55 % en gris ».
- ⚠️ `conflitsDeNumeros` : une **case du garage est un emplacement, pas une
  paire**. Une annonce rangée dans sa case allumait le bloc rouge sur Colis
  (« 5 numérox portés par deux paires », la coquille comprise) pour chaque paire
  rangée. `audit-conflits-numeros.cjs` : 3 rouges sur l'avant.

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

## 9. Chemins utiles

```
src/App.jsx                     l'app (grep avant de lire — le fichier est énorme)
vinted-sync-extension/          background.js · inject.js · vinted-panel.js · content.js
api/                            email-inbound · push · widget · ship-reminders · ai
scripts/audit-*.cjs             les 84 audits
scripts/bancs/                  les 76 bancs (leur README dit comment les lancer)
scripts/audit-*.cjs             les 95 audits
scripts/bancs/                  les 85 bancs (leur README dit comment les lancer)
docs/journal-2026.md            l'historique complet (pourquoi chaque règle existe)
SECURITE.md · .env.example      ce qui doit rester hors du dépôt
```

Chromium du banc : `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`
(`--use-angle=swiftshader --no-sandbox`).
