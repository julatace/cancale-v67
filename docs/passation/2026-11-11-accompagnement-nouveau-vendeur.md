# 11 nov. 2026 — Le parcours d'arrivée : un nouveau vendeur prêt en dix minutes

Branche `claude/accompagnement-nouveau-vendeur` (depuis `origin/main` 1ca9c09). Pas de PR, pas de
merge : la session principale intègre. Rien dans `vinted-sync-extension/` ni `public/`.
**Aucune migration** : l'état du parcours vit dans la ligne `main` (une clé de `SYNC_KEYS`).

Julien, 11 nov. : un NOUVEAU vendeur démarre en 10 minutes, avec « un vrai accompagnement » ;
« tout doit être plus beau et simple, mais surtout PRATIQUE ».

## Ce qui change pour le vendeur

1. **Un parcours plein écran, une étape à la fois** (`src/ParcoursArrivee.jsx`, comme « Ma
   configuration ») : « Étape 3 sur 6 », une barre en six segments, un dessin, un titre, l'état LU
   en direct (« J'attends ton premier e-mail… », « Reçu ✓ », « 12 annonces lues »), UN geste,
   « Pourquoi ? » replié (la pop-up ⓘ de l'app), « Plus tard », ✕.

   | # | étape | preuve (lue, jamais cochée à la main) | le geste |
   |---|---|---|---|
   | 1 | Ton compte VRM | la session de CE compte | — (écrans d'inscription inchangés) |
   | 2 | Tu vends quoi ? | `vrm_configuration.etat === 'fait'` (ou le choix des plateformes d'avant le 9 nov.) | « Commencer » ouvre **Ma configuration** existante |
   | 3 | Installe l'extension | le pont dit `connectee` (connectée à CE compte VRM), ou un compte Vinted déjà rangé dans SA base | le guide de CE navigateur (`PremiersPas` : zip Chrome/Edge, boutique Firefox, Orion iPhone, « sur ton ordinateur » au téléphone) |
   | 4 | Relie tes e-mails | une ligne `email_reception_*` (`select=id`, limit 1) | « Relier mes e-mails » ouvre **Ton adresse VRM** (`ParcoursAdresseVrm`) DANS l'étape : l'essai « Reçu ✓ » |
   | 5 | Ouvre Vinted une fois | un compte relié ET son dressing LU (`harvest_{uid}_listings`, `data->>nItems`) ⇒ « N annonces lues » ; compte relié sans dressing ⇒ « Lecture de ton dressing… » (on attend la vraie lecture) | « Ouvrir vinted.fr » |
   | 6 | Ta première vente | une vente ou un achat LU (`harvest_*_orders_*`, `nItems`) | aucun (attente) ⇒ « C'est prêt » + le récap des six |

2. **La réussite se constate** : pendant qu'une étape attend, l'écran relit toutes les 10 s (page
   visible) et au retour sur l'onglet (retour de vinted.fr, de l'app d'e-mail). Une étape qui
   devient faite sous ses yeux montre « ✓ » une seconde, puis passe seule à la suivante. Aucun
   « j'ai fini » à cocher.
3. **Reprise exacte, sur n'importe quel appareil** : `vrm_parcours` `{ v, etape, ouvert, fini, at }`
   dans `SYNC_KEYS` (ligne `main`). Un rechargement, ou un autre appareil, rouvre l'écran à la même
   étape s'il était ouvert ; fermé, il reste fermé. « Plus tard » : `vrm_parcours_plus_tard`
   (existant, 7 jours ; l'extension met Vinted de côté).
4. **Quand il s'ouvre** : seul, quand « Ma configuration » ouverte seule au premier lancement se
   termine par « C'est parti » (jamais pour le propriétaire de l'installation, qui n'a pas cette
   ouverture) ; sinon par « Continuer » sur Ma journée. La visite en bulles, les conseils et la
   feuille « compte relié » attendent qu'il soit fermé.
5. **La petite carte de Ma journée** (elle remplace la grande carte du guide du 8 nov.) :
   « Démarrer avec VRM · 3 sur 6 », la barre, l'étape courante (son nom, une ligne) et
   « Continuer » (« Commencer » / « Reprendre » sur la configuration, qui ouvre directement Ma
   configuration), « Plus tard », les six étapes sous un repli, « Voir VRM avec des exemples »
   (compte sans Vinted relié), « Masquer le guide » (compte relié). Tout ce qui reste mis de côté ⇒
   une ligne « Reprendre ». Tout fait ⇒ « C'est prêt » une fois (« Parfait »), puis plus rien.
   Un vendeur installé qui n'a jamais ouvert le parcours n'en voit rien (ni carte ni « C'est prêt »).

## Gestes comptés (vendeur neuf, sur ordinateur, de « C'est parti » à « C'est prêt »)

- **Avant** : Ma journée + visite en bulles (4 « Suivant ») avant d'agir ; l'extension se suivait
  dans la carte, mais les e-mails demandaient « Relier ma boîte » qui n'ouvrait l'écran E-mails que
  si l'on y était déjà (l'évènement n'est écouté que par cet écran et Réglages), puis revenir sur Ma
  journée pour voir la suite ; aucune étape ne disait « N annonces lues ».
- **Après** : 0 geste pour arriver sur l'extension (l'écran s'ouvre seul), 0 geste entre deux étapes
  (avance seule), e-mails : 1 geste (« Relier mes e-mails ») + l'essai dans la même page, Vinted :
  1 geste. La visite en bulles ne passe qu'après (ses cibles « extension »/« e-mails » sont sautées
  si elles ne sont plus à l'écran).

## Tranché (Julien a dit « tranche le reste toi-même »)

- **Extension « installée mais pas connectée »** (ou connectée à un AUTRE compte VRM) : l'étape
  n'est PLUS faite (le guide du 8 nov. la cochait dès que le pont répondait). La mission dit
  « connectée à CE compte ».
- **Vinted** : un compte relié ne suffit plus, il faut le dressing LU (même vide : « Dressing lu ·
  aucune annonce en ligne »). Un dressing d'un AUTRE compte ne compte pas ; un compteur illisible ⇒
  « pas su ».
- **Première vente** : une vente OU un achat lu (« premier colis »). Vinted seulement (comme le
  8 nov.) : un vendeur Leboncoin/Vestiaire seul garde l'étape en attente (« Aller à Ma journée »).
- La question « Qui écrit le numéro ? » n'est plus posée dans la carte : c'est l'étape « Où est ton
  numéro ? » de Ma configuration (déjà le cas dès que la configuration existait).
- « Vérifier mon installation » quitte la carte (le parcours EST la vérification) ; il reste dans
  Paramètres → Aide.
- Un vendeur **sans Vinted** (plateformes choisies sans Vinted) garde la carte « Relie tes comptes »
  d'avant (le lot DJ2 « vendeur généraliste » travaille ce vocabulaire).
- Pas de migration : `SYNC_KEYS` suffit (la ligne `main` est déjà serveur, fusionnée, cloisonnée).

## Où est le code

- Règle pure : `src/parcoursArrivee.js` (`ETAPES_PARCOURS`, `preuve*`, `etatParcours`,
  `etapeAMontrer`, `suivanteApres`, `carteParcours`, `lireParcours`, `ecritureParcours`, `reussite`).
- Dessin : `src/ParcoursArrivee.jsx` (`ParcoursArrivee`, `CarteParcours`), `src/parcours-arrivee.css`
  (jetons `--d-*`, clair/sombre, mouvement réduit, contraste).
- Branchement : `src/App.jsx`, bloc « LE PARCOURS D'ARRIVÉE, BRANCHÉ SUR LES PREUVES »
  (`useParcoursArrivee`, `useLectureParcours`, `CarteParcoursApp`, `ParcoursArriveeApp`), monté dans
  `AppCoeur` à côté de la configuration ; `SYNC_KEYS` + `vrm_parcours`. Retirés : `GuideDemarrageCarte`,
  `useVentesGuide`, `GuidePont` (remplacés). `src/guideDemarrage.js` reste (« Vérifier mon installation »).

## Preuves (§6)

- `npm run build` ✓.
- **Nouvel audit** `scripts/audit-parcours-arrivee.cjs` (R1-R7, règle EXÉCUTÉE + branchement) : vert ;
  `--prouve` : **16 mutations ⇒ 16 rouges** (extension pas connectée / autre compte comptée faite,
  e-mails pas lus cochés, compte relié = Vinted fait sans dressing, dressing d'un autre compte,
  compteur illisible = 0, dressing illisible coché, preuve absente = fait, configuration « plus tard »
  = faite, « Plus tard » éternel, reprise ignorée, « C'est prêt » à un installé, écriture sans
  changement, chiffre inventé, `vrm_parcours` hors `SYNC_KEYS`, dressing en `select=data`).
- **Nouveau banc** `scripts/bancs/parcours-arrivee.cjs` (base inventée, faux pont d'extension, 390
  tactile et 1512, clair et sombre) : A parcours complet (configuration ⇒ extension pas connectée
  pas faite ⇒ connectée ⇒ e-mails « Reçu ✓ » ⇒ Vinted « 12 annonces lues » ⇒ première vente ⇒
  « C'est prêt »), **rechargement à CHAQUE étape (reprise exacte)**, **autre appareil** (stockage
  vide) repris à la même étape ; B « Plus tard » / ✕ ; C installé : rien, dressing illisible jamais
  coché. **188 verts, 0 rouge sur les 4 combinaisons.** Mutation de l'app (extension « pas
  connectée » = faite, build à part) ⇒ **5 rouges** ; code d'avant (`git archive origin/main` + build,
  banc copié dedans) : voir le rapport de fin.
- Bancs suivis, verts à 390 clair : `premieres-minutes.cjs` (réécrit pour six étapes : la question du
  numéro est dans la configuration, « Vérifier » par Paramètres), `mode-exemple.cjs`,
  `configuration-depart.cjs` (C2 « Reprendre » porté par la carte du parcours).
- Audits verts : variables, tdz, coherence, identite, icones, textes-courts (étendu aux deux
  nouveaux fichiers), fonctions-api, secrets, premieres-minutes (P7 suivi, 9/9 mutations),
  configuration-depart (F8 suivi, 20/20 mutations), mode-exemple, boutons. **Déjà rouges sur
  `origin/main`, pas touchés** : `audit-violet` (3) et `audit-conseils` (2 : cible « comptes-muets »,
  regex de `tour`).
- Captures regardées (390 clair, 1512 clair/sombre) : défauts vus et corrigés — le « ✓ » sautait
  (l'étape suivante s'affichait avant), phrase d'état en double avec le guide de l'extension,
  récap redondant (« Configuration · Configuration enregistrée »), bouton ✕ carré.

## Reste / à voir

- Après « Aller à Ma journée », la feuille « shop_x est relié à VRM » (lot du 8 nov.) s'ouvre encore
  une fois (elle attend la fermeture du parcours) : un geste de plus, alors que le parcours a déjà dit
  « 12 annonces lues ». À fondre si Julien le veut (`src/CompteRelie.jsx`).
- La première vente ne lit que Vinted.
- Geste de Julien : aucun. Pour voir : un compte neuf (ou effacer `vrm_parcours` et
  `vrm_configuration` d'un compte d'essai).
