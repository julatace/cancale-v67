# Chrome Web Store — publier l'extension VRM 5.409.0 (20 novembre 2026)

> Mis à jour le 20 nov. 2026 pour la **5.409.0** (paquet, autorisations, politique, captures au style
> « VRM natif »). Les textes français AUDITÉS (fiche, autorisations, hôtes, données) sont dans
> `docs/boutiques/chrome-web-store.md` ; leur traduction anglaise dans `fiche-en.md`.
> `node scripts/audit-paquets-boutiques.cjs` vérifie qu'aucune autorisation ni aucun site du manifeste
> n'y manque (vert le 20 nov.).

## Le pas à pas pour Julien (à faire dans l'ordre, sans terminal)

Tout se fait sur https://chrome.google.com/webstore/devconsole, connecté au compte Google qui sera
« l'éditeur » de VRM. Compte environ **45 minutes** la première fois, puis **1 à 3 jours** d'attente
(jusqu'à 2–3 semaines pour une première extension qui lit des cookies sur plusieurs sites).

**Ce qu'il te faut sous la main** : le paquet `VRM-chromium.zip`, les 5 captures et la petite tuile
(dossier `chrome-store/` que la session t'a donné, ou `docs/boutiques/visuels/`), et ce fichier.

### Étape 0 — avant de commencer (sinon : refus presque sûr)
1. Remplis `public/legal/editeur.js` (nom, forme, adresse, SIRET, téléphone…) et `src/contact.js`, puis
   déploie : la page https://vrm.center/legal/extension.html doit s'ouvrir **et afficher ton e-mail**.
   Google lit cette page ; des « à compléter » dessus = refus.
2. Active la **validation en deux étapes** sur le compte Google (myaccount.google.com → Sécurité) : la
   console l'exige.

### Étape 1 — créer le compte développeur (une fois, 5 $)
1. Ouvre https://chrome.google.com/webstore/devconsole → accepte le contrat développeur.
2. Paye les **frais uniques de 5 $** (carte bancaire). C'est tout : pas d'abonnement.
3. Onglet **Compte** : nom d'éditeur `VRM` ; e-mail de contact `vrm.vinted35+contact@gmail.com`.
4. **Vérifie l'e-mail** : Google t'envoie un lien, clique-le. Tant que ce n'est pas fait, le bouton
   « Envoyer pour examen » reste gris.
5. Toujours dans **Compte** : VRM est vendu par abonnement ⇒ coche **« professionnel » (trader)** et remplis
   nom ou raison sociale, adresse, téléphone, e-mail. Google les vérifie et les **affiche sur la fiche**
   (règle européenne DSA).

### Étape 2 — envoyer le paquet
1. **+ Nouvel élément** (en haut à droite) → choisis `VRM-chromium.zip` (n'ouvre pas le zip, envoie-le
   tel quel). La console lit le nom, la version **5.409.0**, l'icône.
2. Si un message rouge parle du manifeste : arrête-toi et transmets-le moi mot pour mot.

### Étape 3 — onglet « Fiche Play Store » (Store listing)
Copie chaque texte depuis `docs/boutiques/chrome-web-store.md` :
| case de la console | quoi coller | où le trouver |
|---|---|---|
| Description | le bloc entre `<!-- description -->` et `<!-- /description -->` | section « Onglet Fiche Play Store » |
| Catégorie | **Outils** (sinon « Productivité ») — jamais « Shopping » | même section |
| Langue | **Français** | même section |
| Icône 128 × 128 | rien : elle vient du paquet | — |
| Captures d'écran | `capture-1-journee.png`, `capture-2-ventes.png`, `capture-3-garage.png`, `capture-4-annonces.png`, `capture-5-extension.png` (dans cet ordre) | dossier `chrome-store/` ou `docs/boutiques/visuels/` |
| Petite tuile promotionnelle 440 × 280 | `tuile-440x280.png` | idem |
| Tuile « marquee » 1400 × 560 (facultative) | `tuile-1400x560.png` | idem |
| Site Web officiel | `https://vrm.center` | — |
| Assistance | l'adresse de `src/contact.js` | — |
Le nom et le résumé ne se tapent pas : ils viennent du paquet.

### Étape 4 — onglet « Pratiques de confidentialité » (Privacy practices)
Toujours depuis `docs/boutiques/chrome-web-store.md`, section « Onglet Pratiques de confidentialité » :
1. **Objectif unique** : le bloc entre `<!-- objectif -->` et `<!-- /objectif -->`.
2. **Une case par autorisation** (7 : `cookies`, `storage`, `alarms`, `scripting`, `tabs`, `downloads`,
   `contextMenus`) : colle la phrase de la colonne « justification à coller » de la ligne correspondante.
3. **Autorisation d'hôte** (une seule case) : colle tout le tableau des hôtes, une ligne par hôte.
4. **Code distant** : « Non, je n'utilise pas de code distant ».
5. **Données** : coche exactement les cases ✅ du tableau « Utilisation des données » (identification,
   finances, authentification, communications, activité, contenu du site) ; laisse ❌ santé, position,
   historique Web.
6. Coche les **3 certifications**.
7. **URL des règles de confidentialité** : `https://vrm.center/legal/extension.html`.

### Étape 5 — onglet « Instructions de test » (fortement conseillé)
1. Crée un compte VRM vide réservé à Google (par ex. `relecteur.vrm@…`), sans abonnement payant requis.
2. Colle ses identifiants et ce texte (anglais, pour les relecteurs) :
   « Sign in at https://vrm.center with the account below, install the extension, open vinted.fr signed in to
   any Vinted seller account: the VRM logo card appears and the VRM app lists the listings. Every action on a
   site is started by the user from VRM; automations are off by default. »
   Sans compte de test, « impossible à tester » est un motif de refus courant.

### Étape 6 — onglet « Distribution »
1. Paiement : **gratuit**.
2. **Visibilité : « Non répertoriée »** d'abord : seuls ceux qui ont le lien l'installent, mais l'examen est
   le même. Tu passeras en **« Publique »** quand tout tourne (nouvel examen, rapide).
3. Régions : **toutes**.

### Étape 7 — envoyer, attendre, publier
1. **Envoyer pour examen** (en haut à droite). Coche « publier automatiquement après validation » si
   proposé.
2. Délais : souvent **1 à 3 jours** ; **jusqu'à 2–3 semaines** pour une première soumission avec `cookies`
   et plusieurs sites. Un e-mail arrive dans tous les cas.
3. Acceptée : donne-moi l'adresse `https://chromewebstore.google.com/detail/…/<identifiant>` — je la pose
   dans `LIENS_BOUTIQUES.chrome` (`src/navigateursServis.js`) ; « Bien démarrer » et « Tout va bien ? »
   proposeront alors « Ajouter depuis Chrome Web Store » au lieu du zip.
4. Chez toi : retire la copie installée à la main dans chaque Chrome (`chrome://extensions` → Supprimer),
   puis installe depuis la fiche (deux VRM dans un même Chrome ⇒ l'app coupe les commandes) et reconnecte-toi
   une fois.
5. Chaque nouvelle version : **Package → Importer un nouveau package** puis **Envoyer pour examen**. ⚠️ Une
   version qui ajoute un site ou une autorisation désactive l'extension chez chacun jusqu'à ce qu'il accepte.

### Ce qui fait refuser, et quoi répondre
| motif de refus (mots de Google) | pourquoi chez nous | ce qu'on répond / fait |
|---|---|---|
| « Excessive permissions » / hôte trop large (`*.amazonaws.com`) | les bordereaux PDF de Vinted viennent d'un stockage Amazon | réponse : le bucket exact `svc-shipping-labels.s3.eu-central-1.amazonaws.com` ; si refusé quand même, je fabrique une 5.41x restreinte à cette adresse (une nouvelle version) |
| « Single purpose » non respecté | beaucoup de gestes différents | répondre avec l'objectif unique : tout sert à relier SES comptes de revente à SON espace VRM |
| « Insufficient privacy disclosure » / données non déclarées (`cookies`, jetons) | les jetons de session partent dans son espace VRM | c'est déclaré (« Informations d'authentification ») et écrit §3-4 de la politique : renvoyer vers https://vrm.center/legal/extension.html |
| « Unable to test » / « Functionality not working » | connexion VRM obligatoire | fournir le compte de test (étape 5) |
| « Spam / automation » (actions sur des sites tiers) | messages, offres, baisses | tout part de son clic ; les automatismes sont éteints par défaut ; 50 actions/h, 200/jour, une requête à la fois, arrêt au premier captcha |
| « Misleading / impersonation » (marques tierces) | Vinted, Leboncoin… nommés | la description dit « outil indépendant, ni affilié ni approuvé » ; les captures sont en données d'exemple, sans logo de transporteur |
| politique inaccessible ou incomplète | `editeur.js` vide | étape 0 |
Pour répondre : e-mail de refus → lien « Faire appel » (ou corriger puis renvoyer). Copie-moi le message
exact, je prépare la réponse ou la nouvelle version.

## Le paquet 5.409.0 vérifié le 20 novembre

- Fabriqué par `node scripts/zip-extension.cjs --store <dossier>/VRM-chromium.zip` (puis `git checkout -- public/`) :
  `manifest.json` à la racine, sans `README.md`, sans rien d'Orion/Safari/Firefox.
- Chargé dans Chromium (`--load-extension`, Playwright) : service worker démarré, version 5.409.0,
  `chrome://extensions` sans erreur ni avertissement — détail et chiffres en bas de ce fichier
  (« Vérification du 20 novembre »).
- Depuis la 5.385 : `https://*.vestiairecollective.com/*` est devenu une **autorisation d'hôte** (avant :
  scripts de contenu seulement) et `https://i.ebayimg.com/*` s'ajoute ; aucune nouvelle autorisation d'API.
  Les deux sont justifiés dans la fiche et la politique (mise à jour le 20 nov. : publier une fiche, masquer,
  baisse par règle, négociation par paliers, vendue ailleurs ⇒ masquée, écran plein « Tout arrêter »,
  compte bloqué ⇒ pause).
- Captures refaites au style « VRM natif » (FR + EN), l'écran Stock à la place d'Achats (Argent, en données d'exemple, montre surtout des « — »).

## Fabriquer ce qu'on envoie

```
node scripts/zip-extension.cjs --store <dossier>/VRM-chromium.zip     # le paquet (manifest.json à la racine, sans README, sans rien d'Orion/Safari)
npm run build && node scripts/boutiques-visuels.cjs                 # captures FR dans docs/boutiques/visuels/
node scripts/boutiques-visuels.cjs --langue en --sortie <dossier>   # les mêmes en anglais (en-*)
node scripts/audit-paquets-boutiques.cjs                            # tout vert avant d'envoyer
```

⚠️ `zip-extension.cjs` refait AUSSI `public/VRM-extension.zip` et les paquets Orion (même contenu,
octets différents à cause des dates) : `git checkout -- public/` ensuite, rien à commiter.
`node scripts/paquets-boutiques.cjs` donne le même contenu (`dist/boutiques/VRM-<version>-chrome.zip`,
dates fixes).

## Ce qui a été vérifié le 15 novembre (paquet 5.385.0)

- Contenu du zip Store = `vinted-sync-extension/` sans `README.md`, identique fichier pour fichier au
  zip servi (`public/VRM-extension.zip`) ; aucun `compat-firefox.js`, `compat-orion.js`, `orion-main.js`.
- Chargé dans Chromium (Playwright, `--load-extension` sur le dossier dézippé) : service worker
  `background.js` démarré, Chrome lit `version 5.385.0`, `manifest_version 3`, les 7 autorisations ;
  `chrome://extensions` : état ENABLED, **0 erreur de manifeste, 0 avertissement d'installation** ;
  `popup.html` s'ouvre sans erreur JavaScript.
- Manifeste : MV3, icônes 16/32/48/128 aux bonnes tailles, ni `key` ni `update_url`, nom 24 car.,
  description 124 car. (≤ 132), aucune autorisation `<all_urls>`, CSP des pages de l'extension
  `script-src 'self'`.
- Code distant : aucun `eval`, `new Function`, `setTimeout("…")`, `importScripts`, `import()` dynamique
  ni script chargé depuis Internet. Les `<script>` posés dans les pages (`content.js`, `lbc-inject.js`,
  `vc-inject.js`, `popup.js`) ont pour `src` un fichier du paquet (`chrome.runtime.getURL`) ; les
  `chrome.scripting.executeScript` passent des fonctions du paquet (`func`) ou `files: ['bridge.js']`.
  Les commandes venues de vrm.center sont des données, jamais du code. Code lisible (ligne la plus
  longue : 767 caractères), pas d'obscurcissement.
- Politique : `public/legal/extension.html` mise à jour le 15 nov. (mot de passe VRM saisi dans
  l'extension, serveurs vrm.center comme destinataire, gestes ajoutés depuis le 8 nov., plafond du
  jour, arrêt au contrôle anti-robot). Elle affiche l'e-mail de `public/legal/editeur.js`.
- Images : 5 captures 1280 × 800 et tuile 440 × 280 en PNG 24 bits (sans alpha), données inventées
  (mode exemple ; carte du logo sur une page de dressing inventée, sans marque de site).

Pas vérifiable depuis ce conteneur : developer.chrome.com et vrm.center sont hors réseau (les exigences
ci-dessous viennent de la lecture du 8 nov., `docs/boutiques/README.md` §1, et de ce qui était connu).

## Le pas à pas du 15 novembre (gardé pour mémoire — celui du haut le remplace)

1. **Avant** : un compte Google avec la **validation en deux étapes** ; 5 $ ; ton identité
   d'éditeur. VRM est vendu par abonnement ⇒ Google te demandera le statut **professionnel (trader,
   DSA)** : nom/raison sociale, adresse, téléphone, e-mail, vérifiés et **affichés sur la fiche**.
   `public/legal/editeur.js` n'a que l'e-mail : remplir le reste (nom, forme, adresse, SIRET, RCS,
   TVA, téléphone, directeur, médiateur) — sinon les mentions légales disent « à compléter ».
2. https://chrome.google.com/webstore/devconsole → contrat, 5 $ → onglet **Compte** : éditeur `VRM`,
   e-mail de contact `vrm.vinted35+contact@gmail.com` **vérifié** (sans lui, « Envoyer » reste grisé),
   statut professionnel rempli.
3. **+ Nouvel élément** → `VRM-chromium.zip`.
4. **Fiche** : description, catégorie (Productivité → Outils), langue (Français), icône 128,
   5 captures, petite tuile — textes dans `docs/boutiques/chrome-web-store.md`.
5. **Confidentialité** : objectif unique, une phrase par autorisation, la case des hôtes, code distant
   « Non », données (identification, finances, authentification, communications, activité, contenu
   du site ; pas santé, position, historique), 3 certifications, URL
   `https://vrm.center/legal/extension.html`.
6. **Instructions de test** : un compte VRM vide réservé aux relecteurs (conseillé — sans lui,
   « impossible à tester » est un refus courant) + le texte anglais du mode d'emploi.
7. **Distribution** : gratuit ; **Non répertoriée** pour commencer (installable par le lien, absente des
   recherches, même examen ; passage en Publique plus tard, ré-examiné) ; toutes les régions.
8. **Envoyer pour examen**. Souvent 1 à 3 jours ; jusqu'à 2–3 semaines pour une première soumission
   avec `cookies` et plusieurs sites.
9. Accepté : me donner l'adresse `https://chromewebstore.google.com/detail/…/<id>` ⇒
   `LIENS_BOUTIQUES.chrome` (`src/navigateursServis.js`) ; retirer la copie « non empaquetée » de chaque
   Chrome (deux VRM dans un Chrome ⇒ l'app coupe les commandes) et se reconnecter une fois (autre
   identifiant d'extension : l'app le découvre par le pont, rien à changer). Chaque nouvelle version :
   « Importer un nouveau package » + « Envoyer pour examen ».

## Risques de refus, et la réponse prête

| risque | où on en est | si Google refuse |
|---|---|---|
| `https://*.amazonaws.com/*` jugé trop large | phrase précise (bucket S3 de Vinted nommé) | 5.393.0 : `https://svc-shipping-labels.s3.eu-central-1.amazonaws.com/*` (seule adresse vue, `background.js` vers la ligne 22 544 ; restreindre ne redemande aucune autorisation aux utilisateurs) |
| `cookies` + jetons de session envoyés au serveur | déclaré (« Informations d'authentification »), expliqué case `cookies` et politique §3-4 | répondre avec l'objectif unique ; rien à cacher |
| connexion obligatoire, impossible à tester | onglet « Instructions de test » | fournir le compte relecteur |
| actions sur des sites tiers (messages, offres) | tout sur son clic ; automatismes éteints par défaut ; plafonds | citer `garde`, 50/h, 200/j, une requête à la fois |
| fiche anglaise impossible | le paquet n'a pas `_locales` | 5.393.0 : `_locales/fr` + `_locales/en`, `default_locale: "fr"`, nom et description en `__MSG_…__` (textes : `fiche-en.md`) |
| icône sans marge | remplit le carré (conseil Google : 96 + 16 px de marge) | 5.393.0 : icône redessinée |
| logos tiers visibles dans les captures (le « V » de Vinted, Mondial Relay dans l'écran Achats) | c'est l'interface de VRM, mode exemple | refaire les captures sans l'écran Achats |

Aucune de ces corrections n'est faite : elles changent le paquet, donc une nouvelle version (une version
publiée ne change jamais de contenu, CLAUDE.md §6).
