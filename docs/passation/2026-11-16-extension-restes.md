# 16 nov. 2026 — Lot `extension-restes` (extension 5.395.0)

Branche `claude/extension-restes`, depuis `origin/main` (5.385 au départ, 5.393 après le merge).
Version réservée dans `versions-reservees.txt` : **5.395.0** (5.394 prise par `traduction-restes`,
5.396 par `extension-robuste`).

## Ce qui est fait, point par point

| point | quoi | où |
|---|---|---|
| 22 | « Mondial Relay by InPost » dans une conversation : avant, deux noms ⇒ aucun transporteur. « InPost » = clé `mondialrelay` (la règle de l'app, `2026-11-11-colis-a-leur-place.md`), les clés vues sont dédoublonnées : un seul réseau. Deux réseaux différents ⇒ toujours rien (on ne choisit pas). | `background.js` (`TRANSP`, `retraitDeConversation`) ; `audit-retrait-conv` +2 contrôles |
| 23 | Registre `photo_vrm_{uid}` depuis `televerserPhotosRecreer` : **déjà livré sur `main`** pendant ce lot (5.392, capacité `photovrm`, `noterPhotosVrm`/`rangerPhotosVrm`, lu par l'app). Ma version (même forme) a été retirée avant le merge — rien en double. | — |
| 24 | Droit d'hôte `https://i.ebayimg.com/*` (manifeste). L'extension rend l'EMPREINTE d'une photo eBay que la page ne peut pas lire (CORS) : message `empreinteImage` (origine vérifiée), `https://i.ebayimg.com/` seulement, sans cookie, ≤ 900 Ko, 5 par demande, 60 par heure, aucune requête vers Vinted ni eBay, rien écrit (l'app range `photo_empreinte_ebay` comme avant). L'app ne demande qu'à une extension à jour (`extSait('empreinteebay')`). Vestiaire : `https://*.vestiairecollective.com/*` ajouté aussi aux hôtes (déjà couvert par les `content_scripts` sur Chrome, aucune invite de plus ; nécessaire pour Firefox, boutique prévue). La page « Tes données » nomme `i.ebayimg.com` sous eBay (`SITES_EXTENSION`). La vérification fine « sûr » (5.388) ne couvre toujours pas eBay (commentaire mis à jour). | `background.js` (`empreintesImagesPourApp`), `manifest.json`, `src/App.jsx` (`empreintesEbayPage`), `src/tesDonnees.js` |
| 49 | Anti-arnaque, Messages · Tous : une ligne Vinted portait l'aperçu de la BOÎTE (auteur pas su) ⇒ jamais comptée. L'app passe maintenant à `convVinted` le dernier message du FIL capté, auteur PROUVÉ (`extraitConversation`, source « fil », `de === 'eux'/'toi'`), la même règle que la liste Vinted (`motifConv`). Ses messages et l'auteur pas su ne comptent jamais. | `src/filUnique.js`, `src/ecrans/FilsTous.jsx`, `src/App.jsx` ; `audit-anti-arnaque` +2 |
| 50 | Santé des comptes : `vrm_avis_bas` branché. Les avis ≤ 3★ ARRIVÉS ces 14 jours (datés par le serveur, qui sait quand il les a vus) s'ajoutent à l'indicateur « avis bas » : « 0 sur les 10 derniers · dont 2 arrivés ces 14 jours » ; 2 arrivés ⇒ à surveiller, raison « 2 avis de 3★ ou moins arrivés ces 14 jours ». Lecture ratée ⇒ `null` (rien dit). « Au moins » : le serveur ne garde que ce qui passe le seuil de notification choisi. | `src/santeComptes.js`, `src/SanteComptes.jsx` (projection `data->alertes`), 5 langues |
| 44 | Republication programmée « pas partie » quand AUCUN appareil n'était ouvert : le passage de 15 min existant (`?moment=groupe`, GitHub), aucune fonction api/ de plus, famille « Rappels » (`cat: 'rappel'`). L'app pose un INDEX dans `vrm_repub_programme` à chaque écriture (`attentes` en bref — compte, heure, nombre ; jamais réglages ni paires — et `prochaineFin`, ISO). Le serveur choisit les vendeurs par la base (`and=(data->>prochaineFin.lt…,…gt…)`), lit la ligne PROJETÉE sur `attentes`, prévient une fois (mémo `repub_programme_notif` écrit avant l'envoi, illisible ⇒ rien), après l'heure + 10 min (fenêtre de l'app) + 5 min (marge de l'appareil), jamais au-delà de 24 h. Le serveur n'écrit JAMAIS `vrm_repub_programme` et ne lance rien. | `api/_lib/repub-programme-notif.js` (pur), `api/ship-reminders.js`, `src/repubProgramme.js` (`indexAttentes`) |
| 25 | « Publier cette fiche » : sur la feuille « À la main » d'une fiche « À publier », SON clic « Ouvrir Vinted » annonce la fiche à l'extension (`ficheAPublier`) ; la PREMIÈRE page de dépôt qui s'ouvre dans les 30 min montre et réserve LE N° DE LA FICHE (pas le suivant), et la publication le lie à l'annonce créée par son identifiant (`panel_num_reserves.items[id] = { numero, fiche }`) — l'app donne déjà ce N° à cette annonce (`reservesNum.parItem`). Une fois. N° déjà porté par une annonce ⇒ refus (« rien n'est réservé, regarde Annonces ») ; « Je numérote moi-même » ⇒ rien ; base illisible ⇒ rien promis. | `background.js` (`annoncerFicheAPublier`, `reserverNumeroPourOnglet`, `lierPublicationsEnAttente`), `src/App.jsx`, `src/ecrans/Republier.jsx` (`PublierALaMain`), `rg.publier.reserve/pris` 5 langues |
| 26 | « Créer sur Vinted » : une fiche SANS photo prend celles de SON studio (`studio_photos_{N°}`, par le N° de la fiche), la photo D'ORIGINE (jamais la détourée : le détourage sert Vestiaire seul, §3), dit sur la ligne (« 2 photos de ton studio reprises »), retirables ; une photo ajoutée entre-temps n'est jamais remplacée. | `src/CreerSurVinted.jsx`, `src/annonceVinted.js` (`photosStudioPourVinted`), `src/App.jsx` |
| 59 | « Tes comptes Vinted », offres acceptées à « — » : le TAUX ne peut pas sortir du journal (les offres traitées sur vinted.fr n'y sont pas — ce serait un total partiel présenté comme complet). Sous le « — », le journal des gestes ACCEPTÉS par Vinted (`journal_vrm_*`, 30 jours) donne « 3 acceptées par VRM » (« au moins » sur 90 j / l'année), et une note dit pourquoi ce n'est pas un taux. | `src/comptesVinted.js`, `src/ComptesVinted.jsx`, `src/ecrans/Stats.jsx` (lecture projetée `e`) |

Version : `CODE_VERSION`, manifeste, capteur et relais Leboncoin, `EXT_ATTENDUE`, `extension-version.json`,
notice Orion, aide (`aide-contenu.cjs` → `public/aide/`), bancs épinglés (`deux-comptes`, `versements-auto`) ;
capacités `fichepublier` et `empreinteebay` à 5.395.0 (`EXT_CAPACITES`, table de `audit-coherence`, §8) ;
zips régénérés (Chrome, Orion dossier/zip/xpi). Garde-fous §3 intacts (aucune action Vinted ajoutée).

## Preuves

| contrôle | ici | code d'avant | mutations |
|---|---|---|---|
| `audit-retrait-conv` (vrai background.js) | vert (+2) | 2 rouges (« » et « inpost ») | — |
| `audit-extension-restes` (neuf, vrai background.js dans `_fond-vm`) | 24 ✅ | 3 rouges sur le background.js de main (F0, E0, C…) | 7/7 rouges |
| `audit-repub-programme-notif` (neuf, LA VRAIE ROUTE `?moment=groupe`, fausse base à la vraie forme) | 24 ✅ | n'existe pas (route sans le passage) | 5/5 rouges |
| `audit-anti-arnaque` | vert (+2) | 2 rouges | `deMoi` forcé ⇒ rouge |
| `audit-sante-comptes` | 42 ✅ (le contrôle « placement » porté sur la règle : la carte vit dans « Tout va bien ? » depuis la refonte du 15 nov. — il était rouge sur main) | — | 8/8 (dont `avis-dates`, `avis-fenetre`) ; retirer la carte de « Tout va bien ? » ⇒ rouge |
| banc `sante-comptes` (390 tactile + 1512, clair + sombre) | tout vert, + « l'avis bas DATÉ est dit » ; les contrôles Ma journée portés sur « Tout va bien ? » (rouges sur main) | | |
| banc `comptes-vinted` (390 + 1512, clair + sombre) | 80 ✅ ; + A6b / A11b (« 2 acceptées par VRM », « au moins » sur l'année) ; A7 « aucune couleur » jugé contre les jetons neutres de l'app (rouge sur main depuis le Verre dépoli) | | |
| `audit-traduction`, `quoi-de-neuf`, `coherence`, `confiance`, `extension-zip`, `logos-bordereaux`, `fonctions-api`, `republier-programme`, `fil-unique`, `photos-comptes`, `meme-photo`, `photo-vrm`, `numero-vinted`, `numero-ecrit`, `republie-telephone`, `stats-offres`, `variables` | verts | | |

Voir « ÉTAT À LA REPRISE » pour le build, la passe complète, les bancs et la PR.

## Ce qui reste (et pourquoi)

- Les programmations posées AVANT ce lot n'ont pas l'index : le serveur ne les voit pas (elles l'auront à la
  prochaine écriture de la ligne). Le texte de la notification est en français (comme les rappels de remise).
- eBay « même photo · sûr » (la 2e mesure fine) n'est toujours pas faite pour eBay — l'empreinte l'est.
- « Publier cette fiche » sur l'iPhone (sans extension) : rien ne change (la feuille dit le N° à écrire).
- Mesure réelle manquante : la page eBay de VRM lit-elle vraiment les photos `i.ebayimg.com` ? Si oui, le
  secours de l'extension ne sert jamais ; sinon « N pas encore vérifiées » doit baisser après 5.395.

## Geste de Julien

Installer l'extension **5.395.0** (remplacer le dossier, puis ⟳ dans chaque Chrome ; Orion : le dossier).
Chrome ne redemande rien pour les hôtes (extension non empaquetée).

## ÉTAT À LA REPRISE

Tout est poussé sur `claude/extension-restes` (merge `origin/main` fait, 5.393 ⇒ 5.395). Build vert. Captures
regardées : Statistiques → Santé des comptes 390 clair (« 0 sur les 10 derniers · dont 1 arrivé avant-hier »),
« Tes comptes Vinted » 390 sombre (« — » puis « 2 acceptées par VRM »), « Tout va bien ? » 390 clair.
Règle de Julien du 16 nov. : ZÉRO rouge pour fusionner. La PR suit (voir le rapport final du lot).

### CI de la PR #1190 et règle « zéro rouge » (16 nov.)
- Reds introduits par ce lot, trouvés par la CI et corrigés : `audit-comptes-vinted` E4 (repli `#6e6e73` en dur),
  `audit-paquets-boutiques` F (l'hôte `i.ebayimg.com` justifié dans les trois fiches et la politique de l'extension),
  banc `nouveau-vendeur` « 30 j / 90 j » de « Tes comptes Vinted » à 40 px (cibles portées à 44 px).
- Les 68 autres audits rouges de la CI sont rouges À L'IDENTIQUE sur `origin/main` (vérifié un par un sur un arbre
  `git archive origin/main`) ; bancs rouges (colis-retirer-propre, annonces-actions, iphone-reprise, argent-mois,
  chiffres-coherents, retraits-suivi, accessibilite-clavier, nouveau-vendeur hors « Tes comptes Vinted ») et jobs
  `parcours-critiques` rouges aussi sur main. **PR NON FUSIONNÉE** (règle de Julien du 16 nov. : zéro rouge).
