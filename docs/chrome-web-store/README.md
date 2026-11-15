# Chrome Web Store — le dossier d'envoi (15 novembre 2026, extension 5.385.0)

> Ce dossier remplace l'ancien README du 8 octobre (faux sur plusieurs points) et ses images
> (ancienne palette), retirés. **Les textes français audités** (fiche, autorisations, hôtes, données)
> restent dans `docs/boutiques/chrome-web-store.md` — `scripts/audit-paquets-boutiques.cjs` vérifie
> qu'aucune autorisation ni aucun site du manifeste n'y manque. Ici : le pas à pas pour Julien, la
> version anglaise (`fiche-en.md`), ce qui a été vérifié et les risques de refus.

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

## Le pas à pas (Julien)

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
