# 20 nov. — « lectures légères » (branche `claude/lectures-legeres`, partie de `claude/integration-5410`)

Mesuré au profil de Julien (4G 1,6 Mbit/s) : au démarrage à froid, l'app lisait les ventes ET les achats de tous ses
comptes en UNE lecture Supabase de ~1,9 Mo (`payload.my_orders`, un tableau que PostgREST ne sait pas projeter) — plus de
9 s —, puis les dressings (560 Ko) en même temps. Mission : moins d'octets, AUCUN chiffre changé. Pas de migration (base
en lecture seule), pas de nouvelle fonction `api/` (12 au plus), `vinted-sync-extension/` pas touchée.

## 1. Ce qui a été mesuré sur sa base (lecture seule, projections et tailles seulement)

- 30 lignes `harvest_*_orders_*d` de son owner, **1 900 Ko** de texte, **5 277 commandes** (2 588 ventes, 2 689 achats) ;
  les deux plus grosses : 2 012 ventes (688 Ko) et 2 024 achats (673 Ko).
- Chaque commande porte EXACTEMENT : `date`, `price {amount, currency_code}`, `title`, `status` (12 valeurs, ~48 car.),
  `transaction_id`, `conversation_id` (surtout une chaîne de 36 car.), `transaction_user_status` (4 valeurs), `photo` (24 % ;
  `url` 128 car., `high_resolution` sur un quart, l'objet complet sur 5), `photo_url` (5 vieilles). C'est la liste blanche
  que l'extension range déjà (`commandeMaigre`, background.js) — **il n'y a rien d'inutile à retirer** : le gain vient de la
  COMPRESSION (et des clés répétées 5 000 fois), pas d'une coupe de champs.

## 2. Ce qui change

1. **`GET /api/compte?mode=commandes-lire`** (`api/_lib/commandes-lecture.js`, mode ajouté à la route existante) :
   vendeur = celui de la SESSION (`vendeurExige` ; jamais un owner du navigateur — un `owner=` dans l'URL n'arrive pas à la
   base), lecture avec la clé de service + `owner=eq.<session>` (même périmètre que RLS `owner = auth.uid()`), toutes les
   pages (`Range`, ordre stable, 416 de frontière), chaque commande réduite à `CHAMPS_COMMANDE` (ordre des clés gardé, photo
   entière), réponse **brotli/gzip**, **ETag** sur la version des lignes rendues (mêmes scalaires que `src/copieLignes.js`) ⇒
   `If-None-Match` égal : **304** après la seule lecture des versions. `Cache-Control: private, no-cache` + `Vary:
   Authorization`. Lecture ratée / clé absente ⇒ **503, jamais `[]`** ; base qui dit 0 ligne ⇒ 200 `[]` ; `ids` d'une autre
   forme ⇒ 400 ; pas de session ⇒ 401 ; connexion en panne ⇒ 503.
2. **L'app** (`lireCommandesRoute` / `lireCommandesLegeres`, App.jsx près de `SEL_COMMANDES`) : le préchargement
   (`prechargerDemarrage`, chemins froid, copie et incohérent) et `fetchHarvestOrdersBrut` passent par la route ; route
   absente (404/405, HTML), en panne, autre forme, autre vendeur entre-temps, hors ligne, sans session ⇒ **la lecture
   d'avant** (`lireTout`, mêmes lignes) — jamais un écran vide. Les lignes rendues passent `sansComptesSupprimes` comme
   `lireTout`.
3. **Dressings après les commandes** : une porte (`poserPorteDressings`) posée par le préchargement, ouverte quand SES
   commandes sont réglées (lues ou en panne), au plus tard 6 s ; Annonces et Bordereaux (qui les montrent) l'ouvrent tout de
   suite ; une relecture `force` ne l'attend pas. Le tableau de bord, la cloche et le retrait auto eBay les demandaient dès
   l'ouverture et partageaient le débit avec les ventes.
4. **Lectures en double** :
   - `src/memoCourt.js` : une réponse RÉUSSIE sert 20 s aux voisines, même vendeur seulement, jamais un « pas su », oubliée
     à toute écriture qui peut toucher ses lignes (`lecturesPartagees.abonner(chemin, f)`, nouveau), à tout `vrm:ext`, au
     retour du réseau, à `onCloudReady` ; « Réessayer » force. Posé sur `lireCapturesDetail` et sur les transactions des
     preuves de vente.
   - **Les preuves de vente** (`lirePreuvesVenteVinted`) relisaient la famille `harvest_*_txn_*` sous une 2e projection
     (~144 Ko à CHAQUE ouverture, la plus grosse lecture au chaud) : elles prennent la famille gardée de `lireTxnMeta`
     (`lireTxnPreuves`, mêmes valeurs sous les noms d'avant) ; la copie porte `ti` (intitulé) et s'appelle `txn2` (une copie
     d'avant, sans `ti`, n'est jamais servie) ; la mémoire de 60 s `_txnMeta` est oubliée à toute écriture de transaction.
   - ⚠️ Les « dates de capture ×3 » et « transactions ×2 » vues au banc venaient surtout d'une **boucle du BANC** : il
     répondait `[]` aux PATCH gardés de `main`, l'app se croyait devancée et relisait `main` en boucle (×35 en 40 s, 3 Mo),
     chaque écriture vidant le partage des lectures. En `SESSION=1` le banc rend désormais la ligne écrite (comme Supabase) :
     les deux « doubles » de 124/125 Ko sont alors les DEUX PAGES de la famille (1 000 lignes chacune), pas un double.

## 3. Avant / après (banc `iphone-rapide`, `SESSION=1 FORME=reelle MBIT=1.6 LECTURES=2 ETAPES=demarrage`)

`avant` = la fusion 66902839e (integration-5410 + iphone-rapide), `après` = cette branche ; même machine (partagée,
charge 10 à 20 : les temps muraux varient de ±1 s d'une passe à l'autre).

| mesure | avant | après |
|---|---|---|
| **commandes à froid** (octets sur le fil · durée) | **2 069 Ko · 10,7 s** (14,2 → 25,0 s) | **303 Ko · 1,8 s** (15,4 → 17,2 s) |
| commandes lues (fin) | 25,0 s | **17,2 s (−7,7 s)** |
| base à froid, tout lu | 197 lectures · **4 146 Ko** | 201 lectures · **2 232 Ko (−46 %)** |
| base avant « écran prêt » (froid) | 3 398 Ko | 1 089 Ko |
| dressings (560 Ko) | 14,9 → 17,9 s, en même temps que les commandes | 20,3 → 23,3 s, après elles |
| transactions des preuves (144 Ko) | lues à froid ET à chaque ouverture | **0** (la famille gardée) |
| base au chaud (2e ouverture) | 171 lectures · **677 Ko** | 177 lectures · **509 Ko (−25 %)** |
| octets lus en double (froid · chaud) | 98 Ko · 4 Ko | 100 Ko · 7 Ko (`main` relu à la fin de la passe, ~72 s) |
| écran utile à froid (Aujourd'hui) | 15,9 s | 16,9 s (≈ : borné par les 2 Mo de JS+CSS, coque à ~14 s ; Aujourd'hui n'attend pas les commandes) |

Sans la boucle du banc (passes d'avant ce correctif, mêmes builds) : avant 7 205 Ko à froid dont 3 157 Ko en double.

La route seule (banc `commandes-lecture`, forme réelle ~2 Mo) : **303 Ko compressés (brotli 5) pour 2 082 Ko** en direct
(gzip 6 : ~337 Ko).

## 4. Preuves

- `node scripts/bancs/commandes-lecture.cjs --mutation` : **35 verts** — la route EXÉCUTÉE (et par `api/compte.js`) ; les
  lignes = la projection de l'app ; un autre owner (même dans l'URL) jamais servi ; 401/503 ; base 500, coupure, 2e page
  manquante, JSON illisible, clé absente ⇒ 503 ; 0 ligne ⇒ 200 `[]` ; ETag/304 ; ids ⇒ 400. **5 mutations rouges** (owner
  du navigateur, `[]` sur panne, ETag sans version, liste blanche coupée, sans compression).
- `scripts/bancs/chiffres-volume.cjs` (+ `SESSION=1 FORME=reelle`, la vraie route) : avant / après **35 relevés identiques**
  (Aujourd'hui, Ventes, Achats, Colis, Argent, Déclarer, Statistiques, et les notions publiées : bénéfice par jour, URSSAF du
  mois, colis…) ; idem `ROUTE=panne` (repli) et `ROUTE=absente` (404) ; idem sans session (accès direct). **Mutation** (la
  route sans `status` ni `price`) : **25 différences** — le banc voit bien les données de la route.
- `node scripts/audit-memo-court.cjs --mutation` : 21 verts, 6 mutations rouges.
- `audit-preuve-vente` (92 verts), `audit-ebay-retrait-auto`, `audit-lectures-partagees`, `audit-memo-ecritures`,
  `audit-fonctions-api` (12), `audit-cle-service`, `audit-familles-serveur`, `audit-pagination-ordre`, `audit-tdz`,
  `audit-variables`, `audit-ventes-envoi-leger`, `audit-serveur-migrations`, `audit-coherence` : verts.
  `audit-preuve-vente` et `audit-ebay-retrait-auto` servent `lireTxnPreuves` par la projection d'avant (l'équivalence des
  noms est tenue par `audit-memo-court`).

## 5. Ce qui reste

- **Le JS (2 Mo compressés) reste le gros du froid** : coque à ~14 s en 4G lente (voir `2026-11-20-iphone-rapide.md` §5).
- Les dressings (560 Ko) : le `payload` EST la liste des annonces ; même traitement possible (route compressée, liste
  blanche des champs d'annonce lus) — pas fait ici (les champs d'une annonce lus par l'app sont nombreux, à mesurer d'abord).
- La boîte de réception (169 Ko), `email_track_*` (113 Ko), `vinted_item_details` (108 Ko) : candidates suivantes.
- En production, la compression de Supabase lui-même n'a pas pu être mesurée d'ici (hôte refusé par le proxy du conteneur) :
  si Supabase compresse déjà, le gain réel des commandes est plus petit que 2 Mo → 0,3 Mo ; il reste l'ETag/304 et la copie.
- Geste de Julien : **aucun** (pas de migration ; la route marche avec `SUPABASE_SERVICE_KEY`, déjà posée).
