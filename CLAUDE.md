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
| accepter une offre automatiquement | ça engage une **vente ferme**, et le champ « offre encore en attente » n'a **jamais été observé** (toutes les offres captées sont déjà acceptées/refusées). On trancherait sur un code inconnu, avec de l'argent réel. |
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
  tourné** : l'extension installée est antérieure à 5.52. `panel_colis_relais`
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
- ⚠️ **L'extension VA CHERCHER les codes toute seule** (à partir de la 5.52) —
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
⚠️ **Le RELEVÉ daté reste introuvable** : ce que l'extension capte sous
`billing` n'est que le **solde** (`{main, escrow}`), jamais une liste de
mouvements — d'où `harvest_*_releve_*` = 0 ligne. Même cause que les
conversations : Vinted ne charge le relevé que si on ouvre cette page-là.

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
| `node scripts/audit-*.cjs` | **27 audits** : identité, chiffres, cohérence app↔extension, QR, colis, push, URSSAF, relevé, variables non déclarées, secrets… |
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

## 8. État au 7 septembre 2026

| | |
|---|---|
| annonces **ouvertes** | **49** · 0 sans numéro · **0 doublon vivant** ✅ (383 fermées à côté — voir le piège `nItems` ci-dessous) |
| paires numérotées | 320 · **0 prix d'achat** ⚠️ (il les saisit lui-même — la modale trie les vendues d'abord : 20 saisies = 33 % du CA reliable) |
| pool de numéros | 456, sans trou, plus haut = 456 (append-only : c'est normal) |
| ⚠️ numéros en double | **13**, tous HISTORIQUES : N°1 à N°16 redonnés par la numérotation auto les 2/4/6/15/16 août. **Cause : sur un appareil neuf le pool était lu VIDE au montage**, le nuage arrivant 500 ms plus tard → la numérotation repartait de 1. Corrigé (`onCloudReady` relit le pool) et protégé par `audit-identite.cjs`. **Aucun n'est vivant** : les paires en double sont fermées. |
| argent Vinted | **281,94 € disponibles** à virer · **2 235,80 € retenus** (9 porte-monnaie) |
| colis | 15 ventes à expédier, **10 bordereaux déjà en base** · **6** colis à retirer, **0 code** — 5 sur `julatace3535` (dernière capture : 4 j) et **1 sur `julatace35260`, capté il y a 10 min**. ⚠️ Ce n'est PAS le compte qui bloque : **son extension est antérieure à 5.52**, elle n'a pas `capterRetraits` (0 compteur `retrait_*` sur 42). La mise à jour est le premier geste. |
| notifications push | ✅ fonctionnent (clé VAPID posée sur Vercel) |
| comptes Vinted | 9, dont 5 dont la boîte **ne fait suivre aucun email** → aucune notification de vente possible pour eux (affiché dans Réglages) |
| ventes masquées | 209 (masquées à la main ; « tout réafficher » existe sur l'écran Ventes) |

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
scripts/audit-*.cjs             les 27 audits
scripts/bancs/                  les 10 bancs (leur README dit comment les lancer)
docs/journal-2026.md            l'historique complet (pourquoi chaque règle existe)
SECURITE.md · .env.example      ce qui doit rester hors du dépôt
```

Chromium du banc : `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`
(`--use-angle=swiftshader --no-sandbox`).
