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

### Reste (prochaines étapes exactes)
1. **Banc d'écran** `scripts/bancs/photos-comptes.cjs` à écrire (modèle : `en-ligne-deux-fois.cjs`) :
   servir `harvest_{A,B}_listings` + `photo_emprunte_{A,B}` (empreintes calculées par
   `empreinteDepuisPixels` sur des pixels inventés) ; juger : carte `[data-journee-photos-comptes]`
   (data-n), feuille `[data-photos-comptes]` (`data-pc-groupes`, `data-pc-pas-verifiees`), même compte
   ⇒ aucune carte, lecture ratée ⇒ « pas lues », aucune écriture ; clic `[data-pc-republier]` ⇒
   Republier à la main s'ouvre AUSSI depuis Ma journée (⚠️ pas vérifié : `repubMainOuvert` est-il rendu
   sur l'instance `only='journee'` ?) ; 390 tactile / 1512, clair / sombre, captures REGARDÉES ;
   rouge sur origin/main (git archive).
2. Ligne « Quoi de neuf » (`src/nouveautes.js`, `audit-quoi-de-neuf`).
3. Bancs voisins à relancer : `journee-perso` (nouvelle carte du catalogue), `en-ligne-deux-fois`,
   `publier-ailleurs`, `annonces-coherence` (menu Outils), `vitesse` (nouvelle lecture `photo_emprunte_*`).
4. Vrai `git merge origin/main`, ligne §9 de CLAUDE.md, réserver 5.358 dans COORDINATION (déjà notée
   par l'agent principal).
5. Non fait : Leboncoin/Vestiaire/eBay « pour info » côté extension (seul Vinted est calculé) ;
   Studio photo / nouvel achat (essayé puis retiré : le texte « publier quand même » y trompait).

### Pièges
- `_fond-vm.cjs` : passer `src:` explicite (le `--src` de l'audit est un ARBRE, pas background.js).
- Le CDN des images n'est PAS Vinted : ne jamais laisser son statut passer à `requeteVinted`
  (un 403 d'adresse signée périmée mettait tout Vinted en pause).
- L'audit de cohérence exige l'historique complet (`git fetch --unshallow origin main`).
