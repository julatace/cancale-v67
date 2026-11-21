# Photos en double entre comptes — 11 nov. 2026 (branche `claude/photos-comptes`, extension 5.358.0)

Demande de Julien : « Vinted relie les comptes entre eux et peut les bannir ; une même photo publiée
sur deux de mes comptes est un risque. » Arrêt demandé par Julien en cours de lot : la suite est
reprise par la session principale.

## ÉTAT À LA REPRISE

### Fait (poussé)
- **Règle** `src/photoEmpreinte.js` : empreinte perceptuelle SANS IA = dHash + pHash 64 bits chacun,
  à 3 recadrages (0, 4 %, 8 %) ⇒ 96 hex ; distance = meilleur dHash + meilleur pHash / 2 ;
  `SEUIL_PHOTO = 16`. `photosEnDouble` (groupes entre comptes Vinted DIFFÉRENTS, même compte = rien,
  compte pas relu / empreinte absente ⇒ « pas vérifiées »), `dejaSurAutreCompte` (avant de publier).
  §5 : aucune règle d'identité ne la lit (`entryKeyByPhoto`, `jumellesParPhoto` intacts).
- **Seuil MESURÉ** : `scripts/bancs/photos-comptes-seuil.cjs` (Chromium, 8 paires × 6 prises de vue
  inventées, 11 transformations : JPEG 90/50/30, moitié, ×1,5, ±15 % lumière, contraste, recadrages
  3 %/6 %/5 % d'un côté, combinaison). Même photo ⇒ max 13 ; photo différente (même paire) ⇒ min 23 ;
  autre paire ⇒ min 19. Vert ; mutations `seuil` (30) et `sansrecadrage` ⇒ rouges.
  ⚠️ Piège mesuré : un pHash 8×8 seul NE sépare PAS (recadrage 3 % ⇒ 16, deux paires différentes ⇒ 4) ;
  le premier jeu de test (chaussure petite, décor dominant) était irréaliste — refait.
- **Extension 5.358.0** (`tickEmpreintes`, alarme `vrm-empreintes` 1 min) : onglet vinted.fr ouvert,
  compte connecté, rien pendant qu'il navigue / pause ; UNE image par tour, 45 s d'écart, budget de
  LECTURE classe « photos » (`gardeLecture`), file Vinted, `credentials:'omit'`, miniature
  `photo.mini` (ajoutée à `photoUtile`), ≤ 600 Ko ; 403 du CDN ne pose PAS la pause globale (status 0),
  429 ⇒ 24 h sans empreinte ; file `vrmEmpreintesFile` rangée par lot de 10 dans `photo_emprunte_{uid}`
  (`payload.annonces[id][clé]=empreinte`, jamais l'image), lecture ratée ⇒ rien écrit.
  Bloc `<empreinte-photo-regle>` recopié (`node scripts/audit-photos-comptes.cjs --recopie`).
  CODE_VERSION, manifeste, transports LBC, `EXT_ATTENDUE`, `EXT_CAPACITES.empreintes`, zips Chrome + Orion.
- **Audit** `scripts/audit-photos-comptes.cjs` (vrai background.js dans `_fond-vm.cjs`) : 27 verts,
  `--mutation=toutes` 8/8 rouges. `audit-coherence` connaît la capacité (FONCTIONS).
- **App** : `lireEmpreintesPhotos` (projection + Range), `photosComptes` (useMemo dans `Comptabilite`,
  APRÈS `enLigneDeux`) publié via `src/photosComptes.js` ; Annonces → Outils « Photos en double »
  (feuille `PhotosEntreComptesDetail`, geste = Republier à la main sur l'annonce la plus récente) ;
  carte ambre Ma journée `photos-comptes` (catalogue `journeePerso.js`, compte des gestes) ;
  encart `EncartPhotosAutresComptes` dans Publier ailleurs (LBC/eBay/Vestiaire, photos locales
  calculées dans la page) et Republier (étape envoi). Textes en 5 langues (`photosComptes.*`).
  Build vert ; audits variables, tdz, coherence (après `git fetch --unshallow`), identite, icones,
  textes-courts, fonctions-api, secrets, extension-zip, traduction : verts.

### Décision tranchée
« Republier avec d'autres photos » ouvre **Republier à la main** (il reprend des photos, VRM garde le
N°), pas l'atelier automatique : celui-ci renverrait les MÊMES photos, et les modifier pour échapper à
la détection est refusé (§3 « modifier les photos pour tromper »).

### Reprise du 11 nov. (soir) — fait
- **Banc d'écran** `scripts/bancs/photos-comptes.cjs` : photos INVENTÉES (le dessin du banc du seuil,
  exportées en JPEG, servies comme vinted.net), empreintes par le vrai `photoEmpreinte.js`, 3 comptes ;
  390 tactile / 1512 × clair / sombre ; carte ambre de Ma journée (data-n), feuille (groupes, P3 vue 1/2
  pas groupées, même compte pas groupé, 8 vérifiées / 1 pas vérifiée DITE, miniatures chargées ENTIÈRES,
  côte à côte, légende compte + N° VISIBLE, liens vinted.fr, geste ≥ 44 px sur la plus récente) ;
  « Republier avec d'autres photos » depuis Ma journée ⇒ Republier à la main (oui, rendu sur cette
  instance) ; rien écrit ; Annonces → Outils (n = 2) ; lecture ratée ⇒ « pas lues » ; compte lu il y a
  30 h ⇒ nommé « pas relu » ; rien en double ⇒ aucune carte. `BANC_SEUL=390|1512`, `BANC_THEME=clair|sombre`.
- **Défaut trouvé par les captures** : la classe `vrm-pc` était déjà celle de Photo carton
  (`styles-photo-carton.css`) ⇒ miniatures coupées à 52 px, légendes invisibles. Classes renommées
  `vrm-phc-*`. Le geste passe sur deux lignes (libellé, puis compte · N°).
- Règle : un compte pas relu est nommé même sans annonce montrée (`photosEnDouble`).
- Seuil re-mesuré dans le Chromium du banc : même photo max 11, autre photo min 19 (seuil 16) ;
  mutations `seuil` et `sansrecadrage` rouges. (Le banc du seuil lançait un Chromium absent : corrigé.)
- « Quoi de neuf » (`photos-comptes`), CLAUDE.md §8 (capacité) et §9 (ligne), merge origin/main.

### Reste
- Bancs voisins pas relancés (machine partagée) : `journee-perso`, `en-ligne-deux-fois`,
  `publier-ailleurs`, `annonces-coherence`, `vitesse`.
- L'encart « avant de publier » (Republier, Publier ailleurs) n'a pas de banc d'écran.
- Leboncoin/Vestiaire/eBay « pour info » côté extension : non fait (seul Vinted est calculé).

### Pièges
- `_fond-vm.cjs` : passer `src:` explicite (le `--src` de l'audit est un ARBRE, pas background.js).
- Le CDN des images n'est PAS Vinted : ne jamais laisser son statut passer à `requeteVinted`
  (un 403 d'adresse signée périmée mettait tout Vinted en pause).
- L'audit de cohérence exige l'historique complet (`git fetch --unshallow origin main`).
