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

## Le téléphone

- **Android** : Firefox pour Android + l'extension depuis addons.mozilla.org.
  L'extension tourne alors SUR le téléphone : l'app le voit (le pont répond) et
  agit d'ici, sans passer par l'ordinateur (`raisonExtGlobale`, prouvé au banc
  `pont.cjs`, « Firefox pour Android »).
- **iPhone** : aucun navigateur iPhone n'accepte cette extension aujourd'hui
  (Safari exige une app emballée et signée par Apple — compte développeur à
  99 $/an, revue de l'App Store, et des API que Safari n'a pas toutes). Sur
  iPhone, **le relais** (5.183) fait le travail : depuis l'iPhone, VRM fait
  agir l'extension de l'ordinateur allumé (bordereaux, réponses, publication
  Leboncoin).
- **Orion (Kagi)** : le seul navigateur d'iPhone qui accepte des extensions — il
  installe celles de la boutique de Chrome et de Firefox. Aucun paquet à part.
  Il se présente exactement comme Safari, donc l'app ne peut pas le
  reconnaître : sur Safari (Mac) et sur iPhone, l'écran des premiers pas le
  PROPOSE (« Installer dans Orion »), mais seulement une fois une fiche Chrome
  ou Firefox publiée (`boutiqueOrion`), et il dit que VRM n'y a pas encore été
  essayé — sa prise en charge des API d'extension est partielle. Installée,
  l'extension se mesure comme ailleurs (le pont répond, l'app agit d'ici).
- Chrome pour Android et Chrome pour iPhone n'acceptent aucune extension. Kiwi
  (Android) a fermé en janvier 2025.
