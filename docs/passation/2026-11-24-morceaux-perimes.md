# 24 nov. — Morceaux périmés : une page ouverte pendant une mise en ligne

Branche `claude/morceaux-perimes`. Le défaut que Julien voit le plus (« ça bug ») :
l'app ouverte sur l'iPhone pendant une mise en ligne, puis un écran jamais ouvert ⇒
la page repart (souvent sur Aujourd'hui) ou affiche « Mettre à jour VRM ».

## Mesuré avant de coder (lecture seule)

- **Base** (`mesures_jour_*`, `h["<écran>|telephone|morceau"]`) : 20 nov. 16 (`journee`),
  22 nov. 15 (`annonces` 11, `journee` 3, `extension` 1), 23 nov. 12 (`journee` 7,
  `emails` 5). Tout au téléphone. Le compteur (`src/mesuresCollecte.js`) compte chaque
  `vite:preloadError` et chaque rejet « morceau » — y compris les préchargements de fond
  qui ratent (d'où `journee`, l'écran de départ).
- **Production** (Vercel MCP, 24 nov.) : un fichier `/assets/` de la mise en ligne
  d'AVANT (`/assets/Stock-Cb-9-TK8.js`, `/assets/index-BOZdtDLl.js`) répond **404** sur
  vrm.center. Pas de « Skew Protection » sur Hobby. ⚠️ Ce 404 porte
  `cache-control: public, max-age=31536000, immutable` (l'en-tête de `vercel.json` vaut
  pour toute adresse `/assets/`, réponse d'erreur comprise). Sans effet sur ce chantier
  (un nom périmé reste périmé), mais à savoir : un 404 sur un nom NEUF demandé trop tôt
  resterait en cache. Pas touché ici (vercel.json partagé, à décider).
- Seul l'appareil peut donc garder les fichiers de la version qu'une page ouverte fait
  tourner : la réserve du service worker (`vrm-shell-v6`).

## Le banc : `scripts/bancs/morceaux-perimes.cjs <dist>`

Un build A ; B et C fabriqués depuis A (chaque `/assets/` renommé, références réécrites,
`sw.js` changé d'un octet ⇒ il s'installe). Un serveur « Vercel » ne sert que la mise en
ligne courante (404 + `immutable` comme la prod). Vrai service worker, iPhone 390
tactile, Chromium (WebKit n'est pas installable dans ce conteneur : téléchargement
refusé ; la CI a WebKit, mais la base est servie par `--host-resolver-rules`, Chromium
seulement). P1/P2/P6 vident le cache HTTP avant d'ouvrir les écrans (Safari l'évince
vite : seule la réserve du service worker est une garantie).

| scénario | origin/main | ce lot |
|---|---|---|
| P1 ouverte, réserve du SW finie, mise en ligne, 6 écrans jamais ouverts | vert (0 rechargement) | vert |
| P2 idem + B puis C + un 2e onglet qui fait le ménage | **0/338 fichiers de A gardés, rechargement, 15 fichiers en 404** | 338/338, 0 rechargement, 0 404 |
| P6 idem P1, SW « endormi » avant sa réserve (iOS) | **133/338 rangés en 91 s, rechargement, 15 en 404** | 338/338 en 8 s, 0 rechargement |
| P3 réserve pas finie du tout, Julien touche Réglages | **rechargé par un préchargement de fond SOUS SES YEUX, retombe sur Aujourd'hui** | 1 rechargement, sur Réglages, aucune erreur visible |
| P4 texte en cours (recherche d'Achats) quand un préchargement de fond rate | **rechargé, texte perdu, revient sur Aujourd'hui** | 0 rechargement, texte gardé ; page cachée ⇒ 1 rechargement invisible, sur Achats |
| P5 plus aucune page sur A, deux mises en ligne plus tard | morceaux de A partis | morceaux de A partis (rien ne s'accumule) |

Résultat complet : main 26 OK · 14 KO ; ce lot 38 OK · 2 KO (l’ancien P3, dépendant du chronométrage) puis P3 rejoué seul 8/8 après l’avoir rendu
déterministe. Captures regardées (`SHOTS=`) : sur ce lot, P6 Réglages en A avec la
pilule « Nouvelle version de VRM · Mettre à jour » (existante), P4 le texte « Jordan 4
bleu 42 » toujours dans la recherche d'Achats.

Après la fusion de `origin/main` (build refait) : P2, P4, P6 et P3 (réécrit : les écrans un à un jusqu'au premier introuvable) rejoués, verts ; ce P3 rouge sur main (rechargé tout seul sur Aujourd'hui, avant même le premier toucher).

**Mutations** (chacune rouge) : ménage du SW sans `nomsDesPagesOuvertes` ⇒ P2 rouge
(0/338, rechargement, 15 en 404) ; build sans la réserve de la page, sans `momentSur`
ni `adresseDeRetour` ⇒ P6, P3, P4 rouges (9 KO). `scripts/audit-morceaux-perimes.cjs`
(26 vérifications, sans navigateur) rougit aussi sur les deux mutations.

## La vraie cause

1. **Hypothèse du nettoyage (agent précédent) : vraie, mais pas la principale.**
   `purgerAncienneVersion` garde la nouvelle version + la liste hors ligne gardée : la
   version d'avant survit UNE mise en ligne, pas deux. Avec 30 mises en ligne par jour,
   une page ouverte deux mises en ligne plus tard, et une autre navigation (2e onglet,
   ordinateur) ⇒ ses fichiers partent (P2). Sur l'iPhone (une seule fenêtre de l'app
   installée), ce ménage n'a lieu qu'à une navigation : rarement pendant que la page vit.
2. **La cause principale : la réserve n'est pas finie quand la mise en ligne tombe.**
   Seul le service worker la remplissait, 15 s après l'ouverture, ≈ 340 fichiers un par
   un — et iOS endort le service worker quand il veut (P6). Tant qu'elle n'a pas fini,
   un écran jamais ouvert n'existe plus nulle part.
3. **Le filet aggravait** : un préchargement de fond raté (`vite:preloadError`)
   rechargeait la page tout de suite, sous ses yeux, même pendant une saisie (P4) ; et
   la page rechargée retombait sur Aujourd'hui (l'adresse est nettoyée : `/`) (P3).
4. Ni la coquille HTML (relue `no-store`, `max-age=0`) ni une boucle de rechargements
   (garde `rechargementPermis`, inchangée) en cause.

## Ce qui change

- `src/reserveMorceaux.js` (nouveau) : 4 s après l'ouverture, au repos, la PAGE relit
  `/hors-ligne-assets.json` ; si le serveur sert ENCORE sa version (la liste nomme son
  `index-…js`), elle demande deux à deux chaque fichier pas encore rangé — le service
  worker le range au passage (règle 3). Mêmes fichiers que la réserve du SW (langue du
  vendeur seule) + la police : aucun octet de plus, seulement plus tôt et sans dépendre
  du réveil du service worker. Un 404 arrête tout. Elle dit au SW sa version et ses
  fichiers (`VRM_GARDER_VERSION`).
- `public/sw.js` : `noterPage` / `nomsDesPagesOuvertes` — le ménage garde les fichiers
  de chaque page OUVERTE (`clients.matchAll`) ; une page fermée est oubliée au ménage
  suivant (au plus 8 notées). Le nom de la réserve ne change pas (`vrm-shell-v6`).
- `src/chargementSur.js` : `momentSur` (aucun champ de texte en cours, aucune feuille —
  `window.__vrmFeuilles` publié par `FermeAuRetour`, `aria-modal`, `history.state.vrmFeuille`) ;
  `adresseDeRetour` (le rechargement repart sur `?tab=<écran ouvert>`) ;
  `verifierMorceauPerime` : rechargement immédiat SEULEMENT pour un écran demandé
  (« morceau ») à un moment sûr ; sinon (préchargement de fond, saisie, feuille) il
  attend que la page soit cachée (`rechargerQuandCachee`) et l'écran demandé dit
  « Mettre à jour VRM ». La version du serveur est relue une fois pour les appels
  proches, la décision prise par appel (un « preload » ne mange plus un « morceau »).
- `vite.config.js` : la liste hors ligne nomme aussi les polices (`polices`).
- `src/App.jsx` : une ligne (`window.__vrmFeuilles`). `src/main.jsx` : l'appel.

Hors périmètre, dit : la 3D, la carte et le film d'accueil restent hors de la liste
(lourds, exclus exprès le 11 nov.) — après une mise en ligne, les ouvrir sur une page
ancienne recharge encore (une fois, sur l'écran). Le compteur `morceau` compte encore
les préchargements de fond ratés d'une page dont la réserve n'était pas finie (P3) :
il doit baisser fortement, pas tomber à zéro.

## Bancs voisins (même build, comparés à main)

- `ouverture.cjs` 2a/2b/2c/3/4 : vert.
- `hors-ligne-froid.cjs` : vert.
- `morceau-perime.cjs` : sa navigation vers E-mails (menu de l'avatar) n'aboutissait
  plus (écran resté « journee », sur main aussi) ; elle passe par `vrm:aller`. 6 rouges
  IDENTIQUES sur main et ici (« dernier filet » après le rechargement vers l'alias
  `index-NEUF…` du banc) — dette du banc, pas de ce lot.
- `iphone-reprise.cjs` : 87 rouges ici, 88 sur main (barre du bas et reprise R1/R3
  déjà rouges ; un `goto` en délai ici, machine chargée).
- `app-installable.cjs` : 3 rouges ici, 4 sur main (S1, A1 identiques).
- Audits : `audit-ouverture` 32, `audit-morceau-perime`, `audit-app-installable` 61,
  `audit-traduction` 45, `audit-fonctions-api`, `audit-morceaux-perimes` 26 — verts.

## Pour mesurer après la fusion

Le compteur `morceau` des `mesures_jour_*` (même requête qu'en tête). Attendu : nettement
moins au téléphone ; ce qui reste vient d'une mise en ligne tombée dans les secondes
qui suivent une ouverture.
