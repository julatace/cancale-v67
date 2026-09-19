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
| `lbctitre` | `lbcTitre` | **5.55.4** (12 sept.) | « le titre exactement tel qu'il partira sur Leboncoin » |
| `photoslbc` | `photosEnOctets` | **5.58.0** (13 sept.) | « photos attachées au formulaire Leboncoin, rien sur ton ordinateur » |
| `photosebay` | `photosPourEbay` | **5.59.0** (13 sept.) | la même promesse, pour eBay |
| `repond` | `repondreAuxMessages` | **5.77.0** (19 sept.) | « elle répond aux questions posées sur tes annonces » |

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

---

## 6. Comment on vérifie (et pourquoi ça compte)

**La méthode : mesurer la vraie base AVANT de coder.** La moitié des « bugs »
signalés venaient d'un de mes propres scripts qui lisait le mauvais champ.
Avant de conclure « c'est vide » : vérifier le **nom** et la **forme** du champ
(le prix Vinted est un **objet** `{amount}`, pas un nombre).

| outil | quoi |
|---|---|
| `npm run build` | compile — ne voit ni les variables absentes ni le rendu |
| `node scripts/audit-*.cjs` | **40 audits** : identité, chiffres, cohérence app↔extension, QR, colis, push, URSSAF, relevé, variables non déclarées, secrets… |
| `scripts/bancs/*.cjs` | les **23 bancs** — l'app **rendue sur les vraies données**, à 390 px et 1512 px — leur `README.md` dit comment les lancer. ⚠️ Leurs fixtures (`fx/`) ne montent **jamais** dans le dépôt : vraies ventes, vrais acheteurs, vraies adresses, dépôt **public**. `audit-bancs.cjs` le vérifie. |
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
scripts/audit-*.cjs             les 40 audits
scripts/bancs/                  les 23 bancs (leur README dit comment les lancer)
docs/journal-2026.md            l'historique complet (pourquoi chaque règle existe)
SECURITE.md · .env.example      ce qui doit rester hors du dépôt
```

Chromium du banc : `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`
(`--use-angle=swiftshader --no-sandbox`).
