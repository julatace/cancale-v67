# Publier l'extension VRM partout où elle peut tourner (5.188)

Deux paquets suffisent pour tous les navigateurs qui acceptent les extensions :

```
node scripts/zip-extension.cjs --store VRM-chromium.zip --firefox VRM-firefox.zip
```

| navigateur | ordinateur | téléphone | paquet | boutique |
|---|---|---|---|---|
| **Chrome** | ✅ | ❌ (Chrome mobile n'accepte aucune extension) | `VRM-chromium.zip` | Chrome Web Store |
| **Edge** | ✅ | ❌ pas encore pour tout le monde | `VRM-chromium.zip` | Microsoft Edge Add-ons |
| **Brave** | ✅ | ❌ | — | il installe depuis le Chrome Web Store |
| **Opera** | ✅ | ❌ | `VRM-chromium.zip` | Opera Add-ons |
| **Firefox** | ✅ | ✅ **Android** (Firefox 128 et plus) | `VRM-firefox.zip` | addons.mozilla.org |
| **Samsung Internet** | — | ❌ programme d'extensions fermé (Galaxy Store, développeurs choisis par Samsung) | — | — |
| **Orion** (Kagi, Mac et iPhone) | ⚠️ non essayé | ⚠️ **iPhone**, non essayé | — | il installe depuis le Chrome Web Store ou addons.mozilla.org |
| **Safari** (Mac, iPhone) | ❌ | ❌ | — | demande une app signée par Apple (voir plus bas) |

Le CODE est le même partout, octet pour octet. Le paquet Firefox ne change que
le manifeste et ajoute `compat-firefox.js` devant chaque script
(`scripts/audit-extension-navigateurs.cjs` le vérifie, et exécute le vrai code
dans un Firefox imité). Le validateur officiel de Mozilla (`web-ext lint`)
ne relève **aucune erreur et aucun avertissement** sur le paquet Firefox de la
5.188.

⚠️ **Ce qui n'a pas été essayé dans un vrai Firefox** (ce conteneur n'y a pas
accès) : le premier essai réel se fera chez Julien. Si quelque chose ne marche
pas, la carte du logo et l'en-tête de l'app le disent (« l'extension ne répond
pas ») — rien n'est envoyé au mauvais endroit.

## Ce que Julien doit faire (personne d'autre ne peut)

0. **Remplir l'adresse de contact** dans `public/legal/editeur.js` et
   `src/contact.js` — les quatre boutiques l'exigent.
1. **Chrome Web Store** — voir `docs/chrome-web-store/README.md` (5 $ une fois).
   Brave en profite sans rien faire de plus.
2. **Microsoft Edge Add-ons** — compte gratuit sur
   https://partner.microsoft.com/dashboard/microsoftedge (Partner Center).
   Envoyer `VRM-chromium.zip`. Les textes, les justifications des permissions,
   la politique de confidentialité et les images sont **les mêmes** que pour
   Chrome (`docs/chrome-web-store/`). Validation : jusqu'à 7 jours ouvrés.
3. **Opera Add-ons** — compte gratuit sur https://addons.opera.com/developer/.
   Même paquet, mêmes textes. Validation manuelle (quelques jours).
4. **Firefox (ordinateur ET Android)** — compte gratuit sur
   https://addons.mozilla.org/developers/. Envoyer `VRM-firefox.zip`.
   - Choisir « Sur ce site » (fiche publique) ou « Moi-même » (non listée : le
     fichier signé s'installe depuis un lien). Conseillé : « Moi-même » d'abord.
   - Cocher **Firefox pour Android** parmi les plateformes : c'est ce qui la
     rend installable sur son téléphone Android.
   - Le code n'est pas compressé ni minifié : aucune « source » à joindre.
   - Les données transmises sont déjà déclarées dans le manifeste
     (`data_collection_permissions` : identifiants de connexion, informations
     d'identification, messages, informations financières, contenu et activité
     des sites — c'est ce que VRM range dans SA base).
   - L'identifiant `vrm@vrm.center` est **définitif** : ne jamais le changer
     (Firefox ne mettrait plus l'extension à jour).
5. **Une fois chaque fiche VALIDÉE**, recopier son adresse dans
   `src/navigateurExtension.js` (`LIENS_BOUTIQUES`). Tant qu'un lien est vide,
   l'app ne promet aucune boutique : elle propose le zip (Chrome, Edge, Brave,
   Opera) ou dit que la version de ce navigateur n'est pas encore en ligne
   (Firefox). Dès qu'il est rempli, l'écran des premiers pas montre
   « Installer depuis la boutique » dans CE navigateur (et sur Firefox pour
   Android).
6. Après l'installation depuis une boutique : retirer la copie installée à la
   main (`chrome://extensions`, `edge://extensions`…). Deux extensions VRM dans
   le même navigateur : l'app le dit et coupe les commandes.

## Ce qui change selon le navigateur — et pourquoi

- **Firefox n'a pas de service worker d'extension** : il charge une page de
  fond (`background.scripts`), avec les mêmes API.
- **Firefox ne connaît pas `externally_connectable`** : l'app ne peut pas
  parler directement à l'extension. La connexion de l'extension à son compte
  VRM passe alors par le pont de la page (`bridge.js`, message `adresse`),
  **toujours adressée à cette extension par son identifiant**, avec les mêmes
  règles qu'ailleurs : origine de l'app, nonce de 2 minutes servant une fois,
  compte annoncé. Sur Chrome, Edge, Opera et Brave, rien ne change.
- **Firefox 128 minimum** : c'est la première version qui exécute les scripts
  « dans le monde de la page » (Leboncoin, Vestiaire).
- **Firefox : pas de ⟳** dans `about:addons` ; si l'extension ne répond plus,
  l'app dit de la désactiver puis la réactiver.

## Le téléphone — mesuré le 19 octobre 2026 (« l'extension pour iPhone et Samsung »)

⚠️ **Comment c'est mesuré** : recherches web le 19 octobre. Deux sources
primaires étaient **bloquées depuis ce conteneur** (DNS) :
`developer.samsung.com` (guide des extensions Samsung Internet) et
`help.kagi.com` (aide d'Orion). Ce qui en est dit ci-dessous vient des extraits
indexés de ces pages et de la presse spécialisée — pas d'une lecture directe.
Aucun navigateur mobile n'a été essayé avec VRM : rien n'est promis tant que
Julien ne l'a pas vu marcher sur son téléphone.

| téléphone · navigateur | extension VRM ? | ce qu'il faut | source |
|---|---|---|---|
| **Samsung · Firefox pour Android** | ✅ **oui** (paquet Firefox, 5.188) | publier `VRM-firefox.zip` sur addons.mozilla.org en cochant « Firefox pour Android » (étape 4 ci-dessus) | manifeste `gecko_android`, `web-ext lint` 0 erreur |
| **Samsung · Samsung Internet** | ❌ **impossible pour VRM** | ses modules passent par le Galaxy Store, dans un programme **fermé** (« closed beta » : seuls les développeurs que Samsung autorise) ; aucune installation d'une extension non publiée | guide Samsung (extrait indexé), forum développeurs Samsung — des développeurs y réclament encore l'ouverture de l'API |
| **Samsung · Chrome pour Android** | ❌ | Chrome mobile n'accepte aucune extension | — |
| **Samsung · Edge pour Android** | ❌ aujourd'hui | Edge stable n'ouvre qu'un **catalogue choisi par Microsoft** (22 extensions au lancement, mars 2025) ; Edge Canary installe une extension par identifiant derrière une option développeur — pas un geste à demander | presse (Windows Latest, Android Authority, mars 2025) ; rien de plus récent trouvé |
| **Kiwi** (Android) | ❌ | **abandonné** en janvier 2025 (dépôt archivé, retiré du Play Store) | annonce du développeur, presse |
| **Lemur, Quetta, Yandex** (Android, Chromium) | ⚠️ peut-être | ils installent depuis le Chrome Web Store — donc seulement une fois la fiche Chrome publiée ; VRM utilise un service worker MV3, des menus de page et le monde « MAIN » : rien ne dit qu'ils les exécutent. **Non essayé — ne pas le proposer dans l'app.** | presse secondaire seulement |
| **iPhone · Safari** | ❌ sans Apple | une « Safari Web Extension » doit être **emballée dans une app iOS** : un Mac avec Xcode, `xcrun safari-web-extension-converter`, le **programme développeur Apple (99 $/an)**, puis la revue de l'App Store. Et des API que VRM utilise ne sont pas toutes dans Safari (à mesurer). Gros chantier, pas un réglage. | documentation Apple (« Packaging a web extension for Safari ») |
| **iPhone · Chrome, Firefox, Edge** | ❌ | sur iPhone tous utilisent le moteur de Safari, sans extensions | — |
| **iPhone · Orion (Kagi)** | ⚠️ **expérimental** | il installe en un toucher depuis le Chrome Web Store ou addons.mozilla.org (donc seulement une fois une fiche publiée) ; Kagi dit lui-même que « seul un petit nombre d'extensions marche complètement » sur iOS (API limitées par Apple). Il se présente comme Safari : l'app ne peut pas le reconnaître. | page Orion de Kagi, aide Orion (extrait indexé), forum Orion |

**Ce que fait l'app selon le téléphone** (`mobileIci`, `src/navigateurExtension.js`) :
- **Samsung Internet** (reconnu par « SamsungBrowser » dans l'agent utilisateur)
  et **Chrome Android** : la carte des premiers pas dit qu'il n'accepte pas
  l'extension ; dès que la fiche Firefox est publiée (`LIENS_BOUTIQUES.firefox`),
  elle propose **« Installer Firefox pour Android »** (fiche Google Play de
  Mozilla) ; d'ici là, l'étape se fait sur l'ordinateur.
- **Firefox pour Android** : fiche publiée ⇒ « Installer depuis la boutique » ;
  sinon « pas encore en ligne », et l'ordinateur.
- **iPhone** : l'ordinateur d'abord, puis **le relais** (5.183 — depuis l'iPhone,
  VRM fait agir l'extension de l'ordinateur allumé) ; Orion seulement avec une
  fiche publiée, et en disant qu'il n'a pas été essayé.
- **Au doigt** (Firefox pour Android, Orion), la carte du logo s'ouvre au
  toucher (il n'y a pas de survol), porte « Ouvrir VRM », et le retour sur un
  « Non » (« Capter ce compte ») se fait au toucher (banc `badge.cjs`).

**Les gestes de Julien pour le téléphone** :
1. **Samsung** : publier la version Firefox (étape 4 : compte gratuit AMO,
   `VRM-firefox.zip`, cocher **Firefox pour Android**), puis recopier l'adresse
   de la fiche dans `LIENS_BOUTIQUES.firefox`. Sur son Samsung : installer
   Firefox depuis le Play Store, ouvrir vrm.center dedans, installer l'extension.
2. **iPhone, sans rien publier** : rien à faire — le relais marche déjà depuis
   l'iPhone tant que l'ordinateur est allumé avec l'extension.
3. **iPhone, Orion** : après la publication Chrome OU Firefox — installer Orion,
   ouvrir la fiche dans Orion, « Ajouter ». À essayer avant de compter dessus.
4. **iPhone, Safari** : seulement s'il décide d'y consacrer un chantier — compte
   développeur Apple (99 $/an), un Mac avec Xcode, et une revue de l'App Store.
   Rien n'est commencé, rien n'est promis.
