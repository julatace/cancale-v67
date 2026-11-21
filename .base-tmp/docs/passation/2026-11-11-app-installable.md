# 11 nov. — VRM installable sur iPhone et Android (lot `app-installable`)

Principe : « plus beau, simple, surtout PRATIQUE ». La base PWA existait
(manifeste, service worker, push, guide iPhone dans Paramètres → Notifications,
thème de la barre d'état suivant le choix clair/sombre, zones sûres sur les
feuilles, champs à 16 px sur iOS, retour arrière par l'historique). Ce lot
comble les trous, sans rien doubler.

## Ce qui change
1. **Ouverture instantanée au 2e lancement** (`public/sw.js`). La coquille
   (`/`, `/index.html`) est servie du cache, si TOUS ses fichiers y sont
   (`coquilleComplete`). Le réseau la relit derrière, fichiers compris
   (`relireCoquille`) : l'ouverture suivante est instantanée ET à jour.
   Un rechargement demandé (`location.reload`, « Mettre à jour ») va au réseau.
   Les données ne passent jamais par là (Supabase, `/api/`) : elles restent
   relues par l'app, avec « Vu à hh:mm · pas relu » (lot K, `src/copieLignes.js`).
   Le cache garde au plus DEUX versions (servie + suivante), jamais une plus vieille.
2. **Défaut corrigé** : toute navigation (`/statut`, `/f/…`, `/extension-retour.html`)
   était rangée sous « / » et remplaçait l'app en cache. Seule la coquille l'est.
3. **« Mettre à jour » discret** (`src/miseAJour.js`, `src/AppInstallable.jsx`).
   Avant : rechargement d'office, même pendant une saisie ; et un nouveau
   service worker rechargeait aussi la page. Maintenant : écran de démarrage
   encore là, ou retour après 10 min caché, sans champ en cours ⇒ recharge ;
   sinon une pilule en bas, au-dessus de la barre, une fois par version (× ⇒
   `vrm_maj_refusee`). Le service worker ne recharge plus rien.
4. **Aide d'installation** (`src/aideInstallation.js`). Proposée UNE fois, à
   partir de la 2e ouverture, après 20 s. iPhone Safari : 2 gestes (Partager →
   « Sur l'écran d'accueil »). Android : « Installer » (invite du navigateur,
   `beforeinstallprompt`, gardée au lieu du mini-bandeau). Rien si installée,
   sur iPad, sur Chrome iPhone, sur ordinateur, ou si le guide de Paramètres a
   été fermé. Le guide complet reste dans Paramètres → Notifications.
5. **Écrans de démarrage iPhone** (`public/demarrage/`, 24 fichiers, 278 Ko) :
   12 tailles × clair/sombre, même dessin que `#vrm-demarrage`. iOS montrait
   un écran blanc. Téléchargés par iOS seul, à l'ajout à l'écran d'accueil.
6. **Icônes** : 48 → 512 « any », 192 et 512 « maskable », apple-touch 152/167/180,
   favicon 32. Manifeste : `id: "/"`, `lang`, `display_override`, catégories,
   4 raccourcis (appui long sur l'icône) : Ma journée, Ventes, Colis, Nouvel achat.
7. **Rechargement au tirer** (Chrome Android) coupé : `html{overscroll-behavior:none}`
   (celui de `body` ne joue pas sur la racine). Le rebond iOS du contenu reste.
8. **Notifications** : le clic va à une fenêtre de L'APP (la plus récemment
   vue), jamais à une page d'aide ou de CGU ouverte ; sinon l'app s'ouvre sur
   l'adresse (l'app installée, sur le bon écran).

## Tranché (ambigu)
- Barre d'état : `default` gardé. `black-translucent` écrit en BLANC toujours :
  illisible en clair. La couleur suit déjà le choix de l'app (`theme-color`).
- Écran de démarrage : iOS ne connaît que le thème du SYSTÈME à cet instant,
  pas `vinted_dark`. Téléphone clair + app sombre ⇒ démarrage clair, puis sombre.
- La pilule en BAS (en haut, elle masquait les icônes de l'île).
- Pas d'aide à la 1re ouverture : l'accueil a déjà ses premiers pas.

## Preuves
- `node scripts/audit-app-installable.cjs` : 61 verts (manifeste, pixels des
  icônes et démarrages, règles exécutées, `sw.js` exécuté en bac à sable).
- `node scripts/bancs/app-installable.cjs` : 23 verts. S : vrai `sw.js`
  (2e ouverture 26 ms pour un serveur à 3 s ; lien profond hors ligne ; page
  statique ; rechargement = nouvelle version). A : vraie app `dist/`,
  390 tactile, UA iPhone/Android, clair et sombre, mode installé simulé.
- `sw-cache.cjs` adapté (au plus servie + suivante ; l'ouverture suivante sert C et jette B).
- Rouge sur le code d'avant (audit : modules absents ; banc : S1, S3, A1–A4) et
  par mutation (saisie ignorée, aide dès la 1re visite, notification vers la
  première fenêtre venue, navigation statique rangée, réseau d'abord).
- Captures regardées (pilule et aide, clair/sombre, Android).
- ⚠️ **WebKit pas installable ici** (téléchargement refusé) : aucun banc
  Safari. Zones sûres réelles (encoche, barre d'accueil) non émulables en
  Chromium : vérifiées par lecture du CSS seulement.

## Geste de Julien
Aucun. À la 1re ouverture après déploiement, l'ancien service worker sert
encore l'ancienne règle ; dès la suivante, ouverture instantanée. Pour voir
le nouvel écran de démarrage : retirer l'icône VRM et la reposer (iOS garde
l'ancien écran).
