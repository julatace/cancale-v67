# 14 nov. 2026 — L'ouverture instantanée (proposition 84)

Branche `claude/ouverture-instantanee`, poussée à chaque étape, **pas de PR** (consigne). Choix de
Julien : « l'app s'ouvre en moins d'une seconde sur tes dernières données, même sans réseau, puis se
met à jour ». Pas d'extension, aucune fonction `api/` de plus, aucune migration, aucune écriture en base.

## 1. Mesuré d'abord (origin/main `9236d48b`)

Banc `scripts/bancs/ouverture-instantanee.cjs` : base inventée à SON volume (10 comptes, 2 000 ventes,
2 500 achats, 1 000 annonces — `_base-volume.cjs`, options `achats`/`annonces` ajoutées, défaut inchangé),
390 px tactile, **service worker actif** (l'app installée), processeur ×4, réseau « Fast 3G » (562,5 ms
d'aller-retour, 1,44 Mb/s partagé) simulé AU SERVEUR pour tout (app, /api/, base) — une requête servie par
le cache du service worker ne paie rien, comme sur le téléphone.

⚠️ **Deux pièges de mesure trouvés en route** (à connaître pour tout banc de vitesse) :
- **Une route Playwright coupe le cache HTTP** (même celle de la garde réseau) : le service worker voit
  alors chaque ouverture comme un rechargement forcé (`request.cache === 'reload'`) et va au réseau —
  +650 ms de fiction à chaque ouverture. Le banc n'a donc AUCUNE route : l'app et `/api/` sont servis par un
  vrai serveur local, la base sous son vrai nom en https (`--host-resolver-rules`, certificat jetable,
  `--no-proxy-server`, comme `session.cjs`) ; la route de la garde est retirée (`unrouteAll`), les noms
  réels ne se résolvent toujours pas et toute réponse d'un hôte réel rend la garde rouge.
- **La machine des bancs est partagée** (charge 20 à 49 sur 4 cœurs ce jour-là ; la même charge de calcul
  variait de 270 à 1 400 ms). « ×4 » sur une machine 5 fois encombrée mesure du ×20. Le banc mesure donc
  l'encombrement avant chaque ouverture (temps écoulé ÷ temps processeur d'une charge fixe) et pose
  4 ÷ encombrement (entre 1 et 4) : ×4 **par rapport à la machine au repos** ; taux et encombrement sont
  imprimés avec chaque mesure (`CPU_MESURE=4` impose le ×4 brut).

Ce que coûtait l'ouverture (avant) — voir le tableau §4 :
- la **2e ouverture** repassait par le réseau : la page de la 1re ouverture n'était pas contrôlée par le
  service worker, rien n'était rangé ; 72 fichiers, 2,4 Mo en 3G ;
- à la 3e, les chiffres de Ma journée (l'instantané du 9 nov.) n'arrivaient qu'après TOUT : 5,4 Mo de JS
  analysés et exécutés (tâche longue de 1,1 à 1,9 s), vérification de la boutique, équipe (deux
  allers-retours), premier rendu du cœur (tâche longue ≈ 1,8 s) ;
- les scripts de démarrage (`/demarrage-*.js`, bloquants dans le `<head>`) étaient servis au réseau
  d'abord : un aller-retour 3G avant la première image ;
- le réchauffage des morceaux (`rechaufferMorceaux`, un par un) partait dès l'ouverture et prenait le
  débit des lectures du démarrage ;
- hors ligne : la vue « hors connexion » de Ma journée, sans les chiffres ; base en panne : « Je n'arrive pas
  à joindre tes données » et un écran vide (l'instantané était interdit sur panne).

## 2. Ce qui change

### L'instantané peint AVANT l'app
- `src/ouvertureInstantanee.js` — la **décision**, prise avant de charger l'app : rien que ce que la porte
  « hors ligne à froid » laisserait déjà voir sans réseau (`laissezPasserHorsLigne` : session cohérente,
  CE compte vérifié par le serveur sur CET appareil avec CETTE session il y a moins de 7 jours, abonnement
  connu), double vérification passée (règle `etatMfa`), pas sans abonnement (aperçu : jamais d'instantané
  lisible), mode équipe tranché pour SA boutique (un aide va sur les colis du vendeur : rien ; pas su :
  rien), Ma journée est l'écran qui va s'ouvrir (`?tab=journee`, ou aucune reprise d'un autre écran —
  `ecranAOuvrir`), un instantané de CE uid montrable (≤ 3 jours). Elle ne fait que LIRE.
- `src/OuvertureInstantanee.jsx` — le **rendu** : le MÊME composant que la coque (`JourneeInstantanee`,
  inerte, « Mis à jour il y a N min », « Vérification… », attributs `data-ji-*`) peint DANS l'écran de
  démarrage d'index.html, à la place relevée à la capture (zone des écrans, couleur de la barre du haut,
  classes et variables de couleur de la coque) — seulement à la même largeur et dans le même thème ; la
  feuille de l'app d'abord (1,5 s au plus, sinon rien n'est peint). Il part avec l'écran de démarrage
  (`vrm:demarrage-fin`, src/demarrage.js) : quand la coque montre SON instantané, ou une porte (connexion,
  double vérification, refus du serveur).
- `src/main.jsx` — un premier tri minuscule (une session et un instantané rangé pour son uid), puis le
  morceau à part ; l'app (5 Mo) n'est exécutée qu'APRÈS cette image (elle est déjà préchargée). Sans
  instantané : rien ne change. La page d'accueil ne télécharge rien de plus (index : 102,7 → 103,6 Ko).
  Le morceau n'est demandé que si TOUTES les traces exigées sont là (instantané, laissez-passer, abonnement,
  cache de l'équipe, `?tab=` absent ou Ma journée) : un « non » ne retarde jamais l'app.
- Pourquoi `localStorage` et pas IndexedDB : ≈ 1,5 Ko lus d'un trait avant tout, sans l'aller-retour
  asynchrone d'IndexedDB (parfois long au lancement sur iPhone). Même cloisonnement qu'avant : clé ET
  valeur par uid, un seul compte sur l'appareil, effacé à la déconnexion et au changement de vendeur
  (`wipeLocalData`), jamais dans le nuage. Les copies lourdes des lignes restent dans IndexedDB (lot K).

### Hors ligne et base en panne : l'instantané reste, daté, et dit pourquoi
- `JourneeInstantanee` prend `etat` (`hors-ligne` | `panne`) : la ligne « Hors ligne : ces chiffres sont
  ceux de ta dernière visite… » ou « Pas relu : la base ne répond pas… » (`data-instantane-panne`), le geste
  dit « Hors ligne » / « Pas relu », pas de lignes qui chargent. Textes par `tr()` (5 langues).
- `src/App.jsx` : hors ligne, au-dessus de la vue « hors connexion » (qui garde ses listes et ses codes) ;
  base injoignable, sous le bloc `BaseInjoignable`. Jamais présenté comme frais, inerte, aucune écriture.
- **Aucune capture pendant une panne ou hors ligne** (Ma journée, Ventes, Annonces) : un écran lu à moitié
  remplaçait le dernier instantané complet.
- **§4.2** (`ecrireInstantane`) : le même jour, un instantané de moins de 6 h qui connaissait PLUS de
  chiffres est gardé avec SA date (`chiffresConnus`) — « 3 340 € · il y a 2 h » plutôt que « — · à l'instant ».
- Défaut corrigé au passage (`capturerCases`) : le libellé rangé d'une case était le texte pour lecteur
  d'écran (« Vendu · mois : 4 962 € », tronqué à l'écran) au lieu du libellé vu (« Vendu · mois »).

### Le service worker (`public/sw.js`)
- **La coquille est rangée dès la 1re ouverture** : l'app (jamais la page d'accueil) envoie
  `VRM_RANGER_COQUILLE` ; le SW range la page, ses fichiers `/assets/` (venus du cache HTTP) et ses scripts de
  démarrage. La 2e ouverture ne touche plus le réseau avant la première image.
- **Scripts de démarrage** (`/demarrage-*.js`) : rangés avec la coquille qui les nomme, servis depuis le
  cache (la même version que la coquille servie), relus derrière.
- **Une réponse se range entière** (`ranger`) : `cache.put` d'un corps encore en téléchargement tenait la
  réserve ; le corps est lu d'abord, rangé ensuite (l'en-tête d'encodage retiré, le corps étant décodé).
- **Le réchauffage des morceaux attend 15 s** (`rechaufferPlusTard`) : il part toujours, à la 1re ouverture
  comme aux suivantes (audit `gestes-hors-ligne` §15, même règle jugée), mais ne prend plus le réseau aux
  lectures du démarrage.

### Les lectures du démarrage
Mesurées : aucune `select=data` sur une ligne lourde (le banc le juge), lectures déjà projetées et
parallèles (≈ 45 en un seul envoi dès que la porte s'ouvre). Les deux allers-retours en série AVANT
(vérification de la boutique, puis équipe) sont **voulus** (aucune donnée lue avant que la séparation des
boutiques soit confirmée, ni pour un aide) : non touchés. L'instantané, lui, ne les attend plus.

## 3. Règles tenues
- « Pas su ≠ oui » : l'instantané est daté partout, jamais « tout est à jour » ; inerte.
- Aucune écriture depuis l'instantané (la décision lit ; le banc vérifie : panne et hors ligne, zéro
  écriture vers la base) ; il ne remplace jamais une donnée du nuage.
- §4.2 : une capture plus pauvre n'écrase pas une plus riche (ci-dessus) ; aucune capture en panne.
- §4.4 : aucune lecture nouvelle.
- Effets de données : aucun ajouté hors d'`AppCoeur` (la décision lit l'appareil, rien d'autre).
- Un autre compte VRM sur l'appareil : rien du précédent, même un instant (le banc le juge avec la sonde
  de peinture, écran de démarrage compris).
- Mode équipe : l'aide n'a que sa projection (aucun instantané peint pour lui).

## 4. Preuves

### Les temps (banc `ouverture-instantanee.cjs`, 390 px, Fast 3G, 2 000 / 2 500 / 1 000, 10 comptes)

« Premier écran utile » = des chiffres de Ma journée À L'ÉCRAN (l'instantané peint dans l'écran de
démarrage, ou dans la coque une fois celui-ci parti) — jamais le squelette. La machine des bancs était
saturée toute la journée (charge 40 à 82 sur 4 cœurs, plusieurs agents) : chaque mesure porte son
encombrement ; « ramené à ×4 » = un processeur 4 fois plus lent que la machine au repos (§1).

| | avant (origin/main) | après |
|---|---|---|
| 2e ouverture, premier écran utile, brut (même machine, même heure) | **7,4 s** | **1,9 s** |
| ouvertures suivantes, brut | 4,0 · 6,4 · 5,7 s | 1,7 · 0,64 · 1,8 s |
| idem ramené à ×4 (4 ouvertures) | 4,4 · 1,9 · 4,7 · 3,9 s (médiane ≈ 4,2 s) | 1,08 · 1,16 · 0,38 · 1,24 s (médiane ≈ 1,1 s) |
| au calme relatif (charge ≈ 12, ×4 posé tel quel, 2e et 3e ouvertures) | — | **0,76 s · 0,90 s** |
| ce que la page attend du réseau avant sa 1re image (2e ouverture) | la page, 3 scripts de démarrage, et 72 fichiers (2,4 Mo) à la 2e | **rien** (seulement des relectures de fond) |
| coquille rangée dès la 1re ouverture | non | oui |
| lectures de la base avant le premier écran utile | 3 à 46 | **0** |
| JS exécuté avant l'écran utile | 5,2 Mo (l'app entière, puis son premier rendu) | ≈ 0,4 Mo (index, React, le morceau de l'instantané) ; l'app, préchargée du cache, s'exécute APRÈS l'image |
| tâches longues avant l'écran utile | 2,4 à 3,3 s (plus longue 1 à 2 s) | 0,4 à 1 s (plus longue 0,2 à 0,5 s) |
| hors ligne : chiffres de Ma journée | jamais (vue « hors connexion » seule) | **0,8 s brut**, datés, « Hors ligne », gardés quand l'app s'ouvre |
| base en panne (503) | « Je n'arrive pas à joindre… » et un écran vide | le même bloc + l'instantané daté « Pas relu », aucune écriture |
| écran vrai (« puis se met à jour ») | 16 à 18 s (charge ≈ 20) | 29 à 33 s (charge ≈ 62) : même chemin, il suit la charge (§5) |

⚠️ Le seuil « < 1 s » est **tenu au calme relatif** (0,76 / 0,90 s à ×4 posé) et **pas sous la charge
62-68** (médiane 1,1 s ramenée à ×4) : la règle de trois sur l'encombrement est grossière (une partie du
temps n'est pas du calcul). Le gain, lui, est net à charge égale : ≈ 4 fois plus tôt.

### Le banc et les preuves
- `scripts/bancs/ouverture-instantanee.cjs` — **après : 18 verts, 2 rouges** (les deux seuils « < 1 s »
  sous charge 62-68 ; verts à charge ≈ 12). **Sur origin/main** (banc et `_base-volume.cjs` copiés dans
  l'arbre `git archive`) : **10 rouges** — coquille pas rangée, 7,4 s, la page attend 4 à 7 fichiers du
  réseau, hors ligne sans chiffres (×3), panne sans instantané (×2), médiane.
- **Mutation** (service worker sans `VRM_RANGER_COQUILLE`, build d'après) : **5 rouges** — coquille pas
  rangée, 2e ouverture 3,9 s brut, la page attend `/index.html` et les 3 scripts de démarrage du réseau.
- `scripts/tests/ouverture-instantanee.test.mjs` : **11/11** (cas normal, aucune écriture, autre compte,
  porte hors ligne ×4, double vérification, abonnement, équipe, écran d'ouverture, instantané trop vieux,
  §4.2, cadre). **Mutations 7/7 rouges** (double vérification, laissez-passer, équipe, écran, abonnement,
  §4.2, autre thème). `journee-instantanee.test.mjs` 6/6, `colis-ventes-instantanes.test.mjs` vert.
- Captures regardées : l'instantané peint dans l'écran de démarrage (390 : à la place de l'écran vrai, barre
  du haut neutre, libellés « Vendu · mois »), hors ligne (instantané + vue hors connexion), panne (bloc +
  instantané « Pas relu »), autre compte (rien).

### Audits et bancs
- `npm run build` vert ; audits **tdz, variables, coherence, csp, traduction (45), quoi-de-neuf** verts ;
  app-installable (61), journee-hors-ligne, inventaire-hors-ligne (37), stock-hors-ligne (33), morceau-perime,
  vapid, push, composants, mesures-terrain, notifs-belles, avis-negatif, aide-signalement, lot5355,
  confiance-publique, import-partage-aide, verifier-production, copie-annonces, lbc-catalogue, aide-videos :
  verts. `gestes-hors-ligne` : son §15 jugeait l'orthographe (`.then(() => rechaufferMorceaux(cache))`) ; il
  accepte `rechaufferPlusTard` (qui appelle `rechaufferMorceaux`) — même règle, vert.
  `stockage-sur` et `signalement` : 1 rouge chacun, **les mêmes sur origin/main**.
- Bancs, sur une machine saturée (charge 40 à 82 ; « avant » = l'arbre d'origin/main, même banc) :
  - verts : **garde-ecrans**, **gestes-hors-ligne** (113/0), codes-hors-ligne (vert ; la garde réseau note
    `/auth/v1/settings` et `/auth/v1/user` — les mêmes sur origin/main) ;
  - rouges aussi sur origin/main : hors-ligne (après 7, avant 36), hors-ligne-froid (D ×2, K), hors-reseau (2,
    « l'écran est COLIS » — la coque a retiré l'onglet Colis), demarrage (2), ouverture-legere-2 (après 10,
    avant 6 — délais de rangement des copies sous charge), chargement (CLS, « pas su » transitoires ; délai) ;
  - tombés sur la machine (navigateur fermé « CreatePlatformSocket », délai de 540 s) : design-passe (3 écrans
    1512 sombre, vert sur origin/main hors charge), etats-vides, inventaire, photos-vinted ;
  - rouges de délai seulement, comparés DOS À DOS à la même charge : **journee-instantanee** avant 1 rouge
    (5,1 s, charge 37) / après **0 rouge** (charge 42, 107 verts) ; **colis-ventes-instantanes** avant 3 rouges
    (4,5 à 7,0 s, charge 39) / après 3 rouges (4,4 à 6,0 s) — les mêmes seuils « < 4 s base tenue » ;
    demarrage-vitesse (D1/D2, 12,4 s ; vert sur origin/main ce matin, hors charge) ;
  - pas comparés (les arbres « avant » ont été effacés du dossier de travail partagé en cours de route) :
    stock-hors-reseau (2 KO : un `tap` qui dépasse 8 s), fraicheur-unique (4), mode-depot (3), accueil (3),
    recherche-photo (1), vitesse.

## 5. Ce qui reste
- L'écran vrai (« puis se met à jour ») reste lent sur 2 000 ventes : vérification + équipe en série, puis
  le moteur `Comptabilite` monté avec tout ce qu'il calcule (récit `2026-11-12-vitesse-volume.md`).
  L'instantané le masque ; le gagner demande de découper ce moteur.
- L'instantané ne couvre que Ma journée avant l'app (Colis, Ventes, Annonces gardent le leur, dans la coque).
- Sur iPhone, un service worker peut être tué avant les 15 s du réchauffage : il repart à l'ouverture
  suivante (rien n'est perdu, les écrans jamais ouverts restent au réseau en attendant).

## 6. Geste de Julien
Aucun. (Ouvrir VRM une fois jusqu'au bout sur l'iPhone, puis le rouvrir.)
