# Publier l'extension VRM partout où elle peut tourner (5.188 → 5.198)

Trois paquets couvrent tous les navigateurs qui acceptent des extensions :

```
node scripts/zip-extension.cjs --store VRM-chromium.zip --firefox VRM-firefox.zip --safari VRM-safari.zip
```

| navigateur | ordinateur | téléphone | paquet | où il s'installe |
|---|---|---|---|---|
| **Chrome** | ✅ | ❌ Chrome mobile n'accepte aucune extension | `VRM-chromium.zip` | Chrome Web Store |
| **Edge** | ✅ | ❌ catalogue choisi par Microsoft | `VRM-chromium.zip` | Microsoft Edge Add-ons |
| **Brave**, **Arc**, **Vivaldi** | ✅ | ❌ | `VRM-chromium.zip` | ils installent depuis le Chrome Web Store |
| **Opera** | ✅ | ❌ | `VRM-chromium.zip` | Opera Add-ons |
| **Yandex Browser** | ✅ (Chromium) | ⚠️ « Alpha », expérimental | `VRM-chromium.zip` | Chrome Web Store |
| **Firefox** | ✅ | ✅ **Android** (Firefox 128+) | `VRM-firefox.zip` | addons.mozilla.org |
| **Orion** (Kagi) | ⚠️ non essayé | ⚠️ **iPhone**, non essayé — voir plus bas | `VRM-firefox.zip` (conseillé) ou `VRM-chromium.zip` | addons.mozilla.org ou Chrome Web Store |
| **Safari** | ⚠️ app conteneur | ⚠️ app conteneur | `VRM-safari.zip` (dossier à convertir) | App Store, après Xcode + compte Apple |
| **Samsung Internet** | — | ❌ programme d'extensions fermé | — | — |
| **DuckDuckGo** | ❌ | ❌ aucune extension | — | — |
| **Kiwi** (Android) | — | ❌ abandonné (janvier 2025) | — | — |
| **Lemur, Quetta, Mises** (Android) | — | ⚠️ ils chargent des extensions Chrome — non essayé, jamais proposé par l'app | `VRM-chromium.zip` | Chrome Web Store |

Le CODE est le même partout, octet pour octet. Les paquets Firefox et Safari ne
changent que le manifeste et ajoutent `compat-firefox.js` devant chaque script
(`scripts/audit-extension-navigateurs.cjs` le vérifie, et exécute le vrai code
dans des navigateurs imités, dont un à API manquantes). Le validateur officiel
de Mozilla (`web-ext lint`) ne relève **aucune erreur, aucun avertissement,
aucune remarque** sur le paquet Firefox de la 5.198.

---

## 1. Les API, navigateur par navigateur (20 octobre 2026)

⚠️ **Comment c'est mesuré.** Recherches du 20 octobre. Les sources primaires de
Kagi (`help.kagi.com`, `kagi.com`, `orionfeedback.org`, la feuille Google de
Kagi) sont **bloquées depuis ce conteneur** ; ce qui est dit d'Orion vient de la
copie publique des pages d'aide de Kagi (dépôt `kagisearch/kagi-docs`, lu
directement), de ses notes de version (copie publique `orion-updates-cdn`) et
d'extraits indexés du forum. Safari et Firefox Android : **données de
compatibilité de MDN** (`mdn/browser-compat-data`, lues directement).

| API utilisée par VRM | Chromium | Firefox Android | Safari iOS (MDN) | Orion iOS | ce que fait VRM s'il manque |
|---|---|---|---|---|---|
| fond : service worker | ✅ | ❌ page de fond (`scripts`) | ✅ 15.4 (non persistant) | ⚠️ 2023 : extensions MV3 à service worker « Not compatible » (forum, fil 3914) ; **Orion préfère `background.scripts`** quand les deux sont déclarés (forum, fil 13760) | paquet Firefox / Safari : page de fond |
| `storage.local` | ✅ | ✅ | ✅ | ✅ (implicite : ses extensions vedettes en dépendent) | — |
| `runtime.sendMessage` / `onMessage` | ✅ | ✅ 48 | ✅ 15 | ✅ (corrigé en 0.99.120, macOS) | — |
| `alarms` | ✅ | ✅ 48 | ✅ 15 | **non documenté** (bug « alarms ne marche pas » #9071 sur macOS, résolu) | **minuteries + rattrapage daté** dans `chrome.storage.local` |
| `scripting.executeScript` monde MAIN | ✅ | ✅ 128 | ✅ 15.4 | `scripting` ajouté (iOS 1.3.x) ; « executeScript avec function » listé comme défaut ouvert (iOS 1.3.9, 2024) ; monde MAIN **non documenté** | **relais de la page** : content.js ↔ inject.js |
| scripts de contenu `world: "MAIN"` | ✅ 111 | ✅ 128 | ✅ **18** | **non documenté** | `lbc-inject.js` / `vc-inject.js` se posent eux-mêmes dans la page |
| `tabs.query/get/create/update` | ✅ | ✅ 54 | ✅ 15 | ✅ (`tabs.query` corrigé en 1.4.17, mai 2026) | — |
| `tabs.sendMessage` | ✅ | ✅ | ✅ | ✅ (corrigé en 0.99.115, macOS) | boîte aux lettres dans `chrome.storage.local` |
| `cookies.get` / `onChanged` | ✅ | ✅ 48 | ✅ 15 — **HttpOnly lus seulement depuis Safari 18** | « cookies.get & cookies.remove corrigés » (notes 2023) | **la page donne ses cookies** (`document.cookie`) |
| `downloads.onCreated` | ✅ | ❌ (retiré en 79) | ❌ | non documenté | les deux autres portes du bordereau (API Vinted, inject.js) |
| `externally_connectable` | ✅ | ❌ | ✅ 15.4 (matches seuls) | ⚠️ « externally_connectable.matches avec runtime.sendMessage échoue » (ticket 13767) | **le pont de la page** (`adresse`, bridge.js) |
| `action.setPopup/openPopup` | ✅ | ✅ 109 | ✅ 15.4 / 16 | « action ajouté » (iOS 1.3.x) | la fenêtre ouvre VRM elle-même (`window.open` en dernier recours) |
| `windows.update` | ✅ | ❌ | ❌ sur iOS | non documenté | déjà en `try` (rien d'autre n'en dépend) |
| `fetch` du fond vers Vinted/Supabase | ✅ | ✅ | ✅ | « requêtes du fond qui ne marchaient plus » corrigé (1.3.20 · #11848, 1.3.28, 2025) | — |

Repère Orion documenté par Kagi : l'objet `window.KAGI` (page « technical »).
L'app s'en sert pour CHOISIR une phrase, jamais pour décider d'une capacité.

## 2. Orion sur l'iPhone — ce qui marchera, ce qui a été adapté

Julien : « elle doit tout faire pareil que sur Chrome ». L'extension ne lit pas
l'agent utilisateur : **au démarrage, le fond regarde quelles API existent**
(`mesurerCapacites`, `background.js`). Une API présente garde le chemin de
Chrome à l'identique ; une API absente prend un **vrai chemin de remplacement
qui garde la fonction** :

| fonction | sans l'API, sur Orion iPhone | parité |
|---|---|---|
| savoir quel compte Vinted est ouvert, ses jetons | content.js lit `document.cookie` sur vinted.fr et le donne au fond (seulement les 3 cookies utiles, seulement depuis un onglet Vinted, pour SON domaine) ; une session neuve relance la capture | ✅ **si** ces cookies ne sont pas HttpOnly (non mesuré) — sinon l'app le DIT |
| moisson, relecture publique des autres comptes | la même fonction, exécutée par le fond, chaque requête part DE LA PAGE par le relais (mêmes requêtes, même origine, même file Vinted, mêmes garde-fous §3) — prouvé au banc : exactement les mêmes requêtes que Chrome | ✅ |
| tâches périodiques (capture 10 min, moisson 20 min, session 40 min, photos, relais) | minuteries tant que le fond est éveillé ; la date de chaque tâche dans `chrome.storage.local` ; au réveil (iOS a suspendu le fond), ce qui est en retard repart **une fois**, jamais en rafale | ✅ (rythme seulement quand Orion est ouvert) |
| Leboncoin, Vestiaire (scripts du monde de la page) | ils se posent dans la page par une balise `<script>` s'ils se retrouvent dans le monde isolé | ✅ |
| bordereau téléchargé | capté par les deux autres portes | ✅ |
| connexion VRM ↔ extension | le pont de la page, adressé par identifiant ; et si le canal direct d'Orion refuse (ticket 13767), l'app repasse par le pont | ✅ |
| fenêtre de l'icône | déjà en plein écran mobile (5.192) ; ouvre VRM par `window.open` si `tabs` refuse | ✅ |

**Ce qui ne peut pas être garanti, et pourquoi.**
- **Les cookies HttpOnly** : si Orion n'a pas d'API `cookies` utilisable ET que
  Vinted pose `access_token_web` en HttpOnly, aucun script ne peut le lire —
  c'est la protection même d'HttpOnly. L'extension ne devine pas une identité :
  l'état du pont dit `indispo: ['cookies']` et l'app écrit « Orion ne laisse
  pas encore l'extension voir ta session Vinted … passe par un ordinateur ».
- **iOS suspend tout en arrière-plan** : une capture ne tourne que pendant
  qu'Orion est au premier plan ; l'app le dit dans la même phrase.
- Le reste du panneau (bordereaux, réponses, publication) dépend des mêmes
  chemins que ci-dessus : s'ils tiennent, tout tient.

L'extension **le dit elle-même** : l'état du pont porte `nav: { remplace: […],
indispo: […] }` (absent sur Chrome) ; le panneau « Actions possibles / Lecture
seule » de l'app l'écrit en **une** phrase (`phraseNavigateur`).

**Quel paquet pour Orion sur iPhone/iPad ?** Un paquet dédié est désormais
livré : `public/VRM-Orion.xpi` et sa copie identique `VRM-Orion.zip`.
Le manifeste classique utilise une page de fond non persistante, un adaptateur
d’API et un chargeur des capteurs dans la page. La notice est dans
`public/VRM-Orion-installation.txt`. Il s’importe depuis le bouton + des
Extensions d’Orion. Ce n’est pas une fiche de boutique publiée, et son
fonctionnement dans Orion/iOS réel reste à confirmer. Voir
`docs/passation/2026-10-25-orion-iphone-ipad.md` pour les validations exactes.
La boutique Firefox reste une autre voie lorsqu’une fiche sera publiée.

### Marche à suivre Orion, pas à pas (une fois la fiche Firefox publiée)
1. Sur l'iPhone : App Store → **Orion Browser by Kagi** (gratuit) → Obtenir.
2. Orion → **•••** (en bas à droite) → **Réglages** → groupe **Extensions** →
   allumer **Firefox extensions** (et Chrome extensions si besoin).
3. Ouvrir dans Orion la fiche addons.mozilla.org de VRM (le lien que l'app
   montre, ou `LIENS_BOUTIQUES.firefox`) → **Ajouter à Firefox** → accepter les
   permissions.
4. Ouvrir **vrm.center** dans Orion, se connecter : l'app connecte l'extension
   toute seule. Puis ouvrir **vinted.fr** connecté sur un compte.
5. Toucher le logo VRM en bas à droite de Vinted : la carte dit le compte VRM,
   le compte Vinted et si les données partent. Le panneau d'état de l'app dit
   ce qu'Orion a remplacé.
6. Si l'écran n'avance pas : Orion → ••• → Extensions → VRM → la console du
   fond (aide Kagi, « Troubleshooting Extension Issues ») et l'envoyer.

Sans fiche publiée, utiliser le paquet Orion dédié et sa notice ci-dessus.
Kagi documente l’installation depuis un fichier ; les suffixes acceptés par
chaque version du sélecteur et l’exécution réelle doivent être vérifiés sur
l’appareil. Les deux copies XPI/ZIP ont le même contenu, ne pas les installer
toutes les deux.

## 3. Le kit de publication addons.mozilla.org (Firefox ordinateur, Android, Orion)

Compte gratuit : https://addons.mozilla.org/developers/ → **Soumettre un
nouveau module** → envoyer `VRM-firefox.zip`.

- **Distribution** : « Sur ce site » (fiche publique — nécessaire pour qu'Orion
  la trouve et que l'app propose le bouton) ; « Moi-même » sinon (non listée).
- **Plateformes** : cocher **Firefox** ET **Firefox pour Android**.
- **Nom** : VRM — outil du revendeur
- **Résumé (≤ 250 car.)** : « Relie tes comptes Vinted, Leboncoin et eBay à VRM :
  tes annonces, ventes, colis et bordereaux arrivent dans ton tableau de bord,
  depuis ton navigateur. Il faut un compte VRM (vrm.center). »
- **Description** : « VRM est l'outil de gestion des revendeurs. Cette extension
  lit les pages Vinted, Leboncoin et eBay que tu ouvres toi-même, et range dans
  TON compte VRM tes annonces, ventes, achats, messages, colis et bordereaux.
  Elle ne publie rien et n'accepte aucune offre toute seule ; elle agit
  seulement au nom du compte ouvert dans l'onglet, au plus 20 actions par heure,
  une requête à la fois. Ton mot de passe Vinted n'est jamais lu. »
- **Catégorie** : « Boutiques et achats » (Shopping) ; secondaire « Productivité ».
- **Étiquettes** : vinted, leboncoin, ebay, revente, colis.
- **Site / assistance** : https://vrm.center · l'adresse de contact de
  `src/contact.js` (à remplir d'abord).
- **Politique de confidentialité** : https://vrm.center/legal/confidentialite.html
- **Licence** : « Tous droits réservés ».
- **Notes pour le relecteur** (à coller tel quel) :
  > Extension compagnon du service VRM (https://vrm.center), utilisable avec un
  > compte VRM. Code non minifié, aucune source à joindre.
  > Permissions : `cookies` — lire les cookies de session Vinted
  > (access_token_web, refresh_token_web, anon_id) pour savoir quel compte est
  > ouvert et ranger ses données sous ce compte ; `storage` — état local
  > (session VRM, files, compteurs de plafond) ; `alarms` — tâches périodiques
  > (capture des comptes, entretien de la session) ; `scripting` — exécuter
  > des requêtes en lecture dans la page Vinted déjà ouverte ; `tabs` — trouver
  > l'onglet Vinted ou VRM ; `downloads` — reconnaître un bordereau PDF
  > téléchargé par l'utilisateur. Hôtes : les sites Vinted, Leboncoin, eBay,
  > Vestiaire Collective (lecture des pages ouvertes par l'utilisateur), la base
  > Supabase de VRM et vrm.center ; et (5.290) les sites de SUIVI des
  > transporteurs — www.mondialrelay.be, www.mondialrelay.fr, ws.chronopost.fr,
  > carrier.vintedgo.com — pour lire le statut des colis que l'utilisateur
  > attend (une liste d'adresses exactes, 12 lectures par heure et par
  > transporteur au plus, une à la fois) ; la page de suivi Chronopost
  > (www.chronopost.fr/tracking-no-cms) et vintedgo.com portent un script qui
  > lit seulement l'ADRESSE de la page, jamais son contenu.
  > `data_collection_permissions` : authenticationInfo (jetons de session
  > Vinted, session VRM), personallyIdentifyingInfo (nom/pseudo du vendeur, des
  > acheteurs sur les commandes), personalCommunications (messages Vinted),
  > financialAndPaymentInfo (montants des ventes, solde Vinted), websiteContent
  > et websiteActivity (annonces, commandes, pages visitées sur ces sites). Tout
  > part UNIQUEMENT dans le compte VRM de l'utilisateur ; rien n'est vendu ni
  > partagé.
  > Pour tester : créer un compte sur vrm.center, ouvrir vinted.fr connecté.
- **Captures (1280×800 ou 640×400, 3 à 5)** : (1) la carte du logo VRM sur
  vinted.fr ; (2) l'écran Ventes de VRM ; (3) Colis avec « Générer le
  bordereau » ; (4) la fenêtre de connexion de l'extension ; (5) sur Android, la
  carte au toucher. Sans aucune donnée réelle (compte de démonstration).
- **Icône** : `icon-128.png` (déjà dans le paquet).
- **L'identifiant `vrm@vrm.center` est définitif.**
- Une fois validée : recopier l'adresse de la fiche dans `LIENS_BOUTIQUES.firefox`
  (`src/navigateurExtension.js`).

## 4. Safari (Mac et iPhone) — la marche exacte

Safari n'installe pas un zip : une « Safari Web Extension » vit **dans une app**,
construite sur un Mac et signée par Apple.

Ce qu'il faut : **un Mac** (macOS récent), **Xcode** (gratuit, Mac App Store),
un **compte Apple Developer Program (99 $ par an)**, et la revue de l'App Store.

1. `node scripts/zip-extension.cjs --safari VRM-safari.zip` puis dézipper :
   un dossier `VRM-safari/`.
2. Sur le Mac, dans le Terminal :
   ```
   xcrun safari-web-extension-converter VRM-safari --app-name "VRM" --bundle-identifier center.vrm.extension
   ```
   (le convertisseur crée un projet Xcode pour macOS **et** iOS ; il signale les
   clés du manifeste que Safari ne prend pas.)
3. Ouvrir le projet dans Xcode → **Signing & Capabilities** → choisir l'équipe
   du compte développeur, pour la cible macOS et la cible iOS.
4. Essayer : Product → Run (Mac), puis sur un iPhone branché. Sur le Mac :
   Safari → Réglages → Extensions → cocher VRM. Sur l'iPhone : Réglages →
   Apps → Safari → Extensions → VRM → Autoriser, et « Toujours autoriser » sur
   vinted.fr, leboncoin.fr, ebay.fr, vrm.center (Safari demande l'accès site par
   site avant d'injecter) — et, pour le suivi des colis (5.290),
   mondialrelay.be, mondialrelay.fr, ws.chronopost.fr, carrier.vintedgo.com.
5. Product → Archive → **Distribute App** → App Store Connect → créer la fiche
   (même texte et confidentialité qu'ailleurs) → soumettre à la revue.
6. Une fois en ligne : `LIENS_BOUTIQUES.safari`.

Ce que le paquet Safari change (et pourquoi — données MDN) : fond **non
persistant** en `background.scripts` (iOS n'accepte rien d'autre), `downloads`
retiré (Safari ne l'a pas), `strict_min_version` 16.4, `externally_connectable`
gardé (pris en charge, matches seuls), `compat-firefox.js` devant chaque script.
⚠️ Avant Safari 18, `cookies.get` ne lit pas les cookies HttpOnly et le monde
MAIN des scripts de contenu n'existe pas : le second est compensé (les scripts
se posent eux-mêmes), le premier non si les cookies de Vinted sont HttpOnly.
**Rien n'a été essayé dans Safari** : le convertisseur et Xcode n'existent que
sur un Mac.

## 5. Les autres boutiques (Chromium) — rappel

0. **Remplir l'adresse de contact** dans `public/legal/editeur.js` et
   `src/contact.js` — toutes les boutiques l'exigent.
1. **Chrome Web Store** — `docs/chrome-web-store/README.md` (5 $ une fois).
   Brave, Arc, Vivaldi, Yandex en profitent sans rien de plus.
2. **Microsoft Edge Add-ons** — compte gratuit (Partner Center), `VRM-chromium.zip`,
   mêmes textes que Chrome. Validation : jusqu'à 7 jours ouvrés.
3. **Opera Add-ons** — compte gratuit, même paquet, mêmes textes.
4. **Firefox** — section 3.
5. Chaque fiche VALIDÉE ⇒ son adresse dans `LIENS_BOUTIQUES`. Vide ⇒ l'app ne
   promet aucune boutique.
6. Après l'installation depuis une boutique : retirer la copie installée à la
   main. Deux extensions VRM dans un navigateur : l'app le dit et coupe les
   commandes.

## 6. Navigateurs sans extension — ce que dit l'app

`extensionIci()` (`src/navigateurExtension.js`) range chaque navigateur, par son
marqueur dans l'agent utilisateur (SamsungBrowser, DuckDuckGo/Ddg, YaBrowser,
Vivaldi, Edg, OPR, Firefox) ou `window.KAGI` (Orion) :
- **Samsung Internet, DuckDuckGo, Chrome Android** : « n'accepte aucune
  extension » ; Firefox pour Android proposé dès que sa fiche est publiée ;
  sinon l'ordinateur. Un navigateur Android inconnu qui se dit « Chrome »
  (Lemur, Quetta, Edge…) est rangé avec Chrome Android : si son extension
  répond quand même, le pont le dit et fait foi.
- **iPhone (Safari, Chrome, Firefox, Edge, DuckDuckGo)** : l'ordinateur, puis le
  **relais** (5.183 : l'iPhone fait agir l'extension de l'ordinateur allumé) ;
  Orion proposé seulement avec une fiche publiée.
- **Dans Orion** : sa consigne propre (boutique Firefox), et « non essayé ».
- **Safari Mac sans app** : « n'accepte pas cette extension » ; Chrome, Edge,
  Brave ou Opera sur cet ordinateur.

Sources Android : Kiwi abandonné (presse, MakeUseOf 2025) ; Edge Android :
catalogue de 22 extensions (Windows Latest, Android Authority, mars 2025) ;
Yandex « Alpha, expérimental » (guide Quetta, source intéressée) ; Lemur, Quetta,
Mises : seulement des articles promotionnels ou secondaires — **non vérifié,
jamais proposé**.

## 7. Ce qui n'a PAS été mesuré

- **Aucun vrai Orion, aucun vrai iPhone, aucun vrai Safari, aucun vrai Firefox
  Android** : tout a été exécuté dans des navigateurs IMITÉS (`_fond-vm.cjs`,
  profils `orion-ios`, `orion-ios-pire`, `safari-ios`, `firefox-android`). Le
  premier essai réel se fera chez Julien.
- La liste officielle des API d'Orion (feuille Google de Kagi) n'est pas
  joignable d'ici.
- Si les cookies de session de Vinted sont HttpOnly (déterminant pour Orion sans
  API `cookies` et Safari < 18).
- WebKit (Playwright) n'est pas installé dans ce conteneur : les scripts de
  contenu n'ont pas été exécutés dans WebKit.

## Correctif Leboncoin 5.207.0 — 22 octobre 2026

Le capteur MAIN démarrait à `document_start`, son relais isolé seulement à `document_idle`. Une réponse de session reçue entre les deux ne parvenait jamais au background : aucun compte ne pouvait être enregistré sur cette réponse. Le relais est maintenant un fichier dédié lancé à `document_start`. Un échange de disponibilité dans les deux sens couvre les deux ordres d'injection. Le capteur rejoue ses réponses en attente (mémoire seulement, 64 messages / 4 millions de caractères maximum), avec un numéro technique pour éviter les doublons. Les interfaces de dépôt restent démarrées à leur moment habituel.

Le test navigateur `scripts/bancs/lbc-demarrage.cjs` échoue avec l'ancien capteur : identification reçue avant le relais perdue. Il réussit avec le nouveau, capteur avant/après relais, réinjection et accusé répété sans doublon. Aucun appel supplémentaire à Leboncoin, aucune écriture de production, aucune récupération de cookie ajoutés.

Les audits de session, comptes, données restantes, compteurs de messages, détails de transactions, compatibilité navigateurs et liaison VRM sont conservés. Ils ne remplacent pas une vérification sur une vraie session Leboncoin : aucune session utilisateur Leboncoin n'est accessible dans l'environnement de développement. La mise à jour du dossier de l'extension et le rechargement des onglets Leboncoin restent nécessaires : une extension décompressée ne reçoit pas les nouveaux scripts depuis le site.

## Suite 5.208.0 — session reconnue sans pseudo et reprise d'envoi

Retour utilisateur : 5.207 installée mais carte « pas encore reconnu » et « rien envoyé » sur toutes les pages. Trois défauts supplémentaires corrigés : l'état de la carte exigeait un pseudo même quand un identifiant de session était connu ; les XHR `responseType=json` et les appels fetch avec un objet URL n'étaient pas lus ; la session était marquée envoyée pour six heures même après un échec de stockage. Le marqueur est maintenant posé après un succès seulement, et le prochain événement peut reprendre l'envoi.

Un diagnostic local distingue relais présent / capteur MAIN actif sur l'onglet courant, sans compte, email, contenu de message ni jeton. Il propose un geste précis lorsque la session n'est toujours pas lue. Cela ne transforme pas une absence de données en succès.

Périmètre constaté : comptes et annonces/photos, ventes et étapes de transactions déjà prises en charge par leurs parseurs. Le module de messages Leboncoin actuel ne collecte que les compteurs ; la lecture et la réponse aux conversations complètes ne sont pas implémentées. Les formats réels des achats/codes et messages complets doivent être vérifiés sur une session autorisée avant de promettre « tout capté ». Aucune session utilisateur Leboncoin n'est disponible ici. Ne pas annoncer cette version comme une capture exhaustive validée en production.

## 5.209 — priorité à l'attribution correcte, pas à une capture exhaustive

Retour utilisateur : données incorrectes et mauvais compte dans VRM. Régressions reproduites sur 5.208 : le badge reprenait le dernier compte global d'un autre onglet ; deux compteurs différents dans un onglet remplaçaient arbitrairement la session ; `lbcCapture` acceptait un compte extrait du DOM et ses annonces sans preuve de session ; un acheteur avec email sur un endpoint `/users/me/conversations` pouvait être identifié comme compte courant.

La carte lit maintenant le compte relevé dans SON onglet ; plusieurs identités dans le même document rendent l'attribution ambiguë et aucune session courante n'est choisie. Un nouveau document remet ce contexte à zéro. Les captures DOM non confirmées sont refusées ; les listes privées continuent via le canal réseau attribué au compte du même document. La détection d'identité est limitée aux endpoints de session et de comptes liés, pas aux acheteurs des conversations. L'app parle de « dernier compte relevé », pas de compte actuellement connecté.

Le test exécute l'ancien code et reproduit quatre échecs, puis valide les protections et un changement légitime de compte après rechargement. Ces protections ne prouvent PAS que le compte réel de l'utilisateur est désormais lu, ni que les données historiques déjà mal attribuées sont corrigées. Aucune donnée de production n'a été supprimée ou réattribuée. Demande de précision en cours : autre compte personnel Leboncoin ou compte appartenant à un tiers ; le second cas exige de poursuivre l'audit d'isolation VRM comme incident, sans supposer que c'est seulement un cache.

## 5.210 — conservation des photos et anciennes attributions

Les annonces peuvent arriver dans plusieurs réponses partielles : une mise à jour sans image effaçait les photos déjà connues. Le rangement conserve maintenant les anciennes photos quand aucune nouvelle URL valide n'a été lue. Les formats chaîne, listes d'URL et objets d'images Leboncoin sont normalisés ; seules les URL HTTPS Leboncoin sans identifiants sont gardées. Le titre et les autres informations peuvent continuer à être mis à jour.

Une ancienne valeur `lbcUser` n'est plus acceptée seule comme preuve d'appartenance. Son compte doit avoir été confirmé par une session/vente, selon les mêmes règles dans l'app, l'extension et les alertes du serveur. Le serveur lit les comptes confirmés du vendeur concerné ; une lecture impossible ne produit pas de rapprochement. Les liens/références explicites restent traités comme avant. Aucun prix ni calcul de bénéfice modifié, aucune suppression/réattribution de données historiques.

Validation : 140 tests unitaires, build, audits session/comptes/ventes/restes, double vente/places, 28 contrôles de notification double vente avec deux vendeurs, ZIP, sans bruit et en-têtes. Test natif préparé dans `scripts/bancs/extension-leboncoin-installee.cjs` : chargement de l'extension réelle, service worker, scripts isolés, base et pages simulées. Il n'a PAS pu être exécuté ici : Chromium répond « Loading of unpacked extensions is disabled by the administrator » ; le téléchargement d'un navigateur de test est aussi refusé par la politique réseau (403). Aucune politique n'a été contournée. Ne pas annoncer ce test natif comme réussi, ni la capture du compte réel de l'utilisateur comme vérifiée.

## 5.290 — le suivi des colis chez les transporteurs : quatre sites de plus

Julien, 24 octobre : « tu as juste à regarder sur le site du transporteur ». Le
serveur lit Chronopost et (selon la mesure du chantier serveur) Vinted Go ; il ne
lit **jamais** Mondial Relay (l'API `/api/tracking` de la .be répond 403 HTML à
un User-Agent honnête depuis Vercel, mesuré le 24 octobre). Le navigateur de
Julien lit donc les n° que le serveur lui donne et relaie la réponse brute.

**Nouveaux `host_permissions`** : `https://www.mondialrelay.be/*`,
`https://www.mondialrelay.fr/*` (repli `_mvc` si la .be refuse — le serveur
accepte ou refuse cette voie), `https://ws.chronopost.fr/*`,
`https://carrier.vintedgo.com/*`. **Nouveau script de contenu** `transp-page.js`
sur `www.mondialrelay.fr`, `www.mondialrelay.be`,
`www.chronopost.fr/tracking-no-cms/*`, `vintedgo.com` : il prévient seulement le
fond qu'une page de suivi est ouverte ; le n° est tiré de l'ADRESSE de l'onglet.

**Ce que ça change, boutique par boutique** :
- **Chrome, extension non empaquetée** (le cas de Julien) : les sites sont
  accordés au rechargement (⟳ dans chaque Chrome), sans question.
- **Chrome Web Store, Edge, Opera (plus tard)** : une mise à jour qui ajoute un
  site avec un nouvel avertissement **désactive l'extension** jusqu'à ce que la
  personne accepte. D'où : ces sites sont ajoutés AVANT toute première
  publication. Les `matches` d'un script de contenu comptent aussi comme accès.
- **Firefox (ordinateur, Android)** : les permissions d'hôte MV3 peuvent rester
  NON accordées (selon la version, et pour une mise à jour qui en ajoute). Le fond
  le mesure (`permissions.contains`) et se TAIT ; la fenêtre de l'icône propose
  « Autoriser VRM à lire le suivi des transporteurs » (`permissions.request`,
  dans le geste). L'app voit `nav.indispo: ['transporteurs']`.
- **Orion / Safari** : même test ; si l'API des permissions manque,
  `nav.indispo: ['transporteurs-passu']` (« pas su ») et rien ne part.
- **Notes pour le relecteur d'AMO** (section 3) : mises à jour avec ces sites.
- Sans extension, ou sans permission, **rien ne casse** : le serveur reste la voie
  principale pour Chronopost (et Vinted Go si le serveur le lit).

**Non mesuré** : un `fetch` depuis le service worker vers la .be avec les cookies
du navigateur (partitionnement possible), la nécessité du `Referer` (interdit à
`fetch`, non envoyé), la réponse réelle du repli `_mvc` en GET, le déroulé de la
demande de permission dans un vrai Firefox (la fenêtre peut se fermer quand la
demande s'affiche ; la lecture repart à l'accord par `permissions.onAdded`).
`web-ext lint` n'est pas installé dans ce conteneur : pas relancé pour la 5.290.
