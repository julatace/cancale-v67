# 8 nov. 2026 — L'extension dans les boutiques officielles (Chrome, Edge, Firefox) et le parcours iPhone

Branche `claude/extension-boutiques` (depuis `claude/amazing-lovelace-xd7obl`). Pas de PR (consigne).
Julien : « fais tout » — le 8 nov. son iPhone tournait encore en 5.322 : une extension installée à la main
(zip, fichier Orion) ne se met JAMAIS à jour seule ; installée depuis une boutique, si.

⚠️ Le code de `vinted-sync-extension/` et sa version n'ont PAS été touchés (une autre session monte la
version, secours d'envoi). Tout est autour.

## Ce qui est livré

| quoi | où |
|---|---|
| Inventaire des exigences des 3 boutiques, relu le 8 nov. sur les pages officielles (developer.chrome.com, learn.microsoft.com, extensionworkshop.com) | `docs/boutiques/README.md` §1 |
| Fiches prêtes à coller : nom, résumé, description FR, objectif unique, justification de CHAQUE autorisation et de CHAQUE site, données déclarées, certifications, catégorie, checklist | `docs/boutiques/chrome-web-store.md`, `edge.md`, `firefox.md` (+ notes pour le relecteur AMO / Edge) |
| Parcours iPhone (Orion) : aujourd'hui par fichier, demain par la boutique Firefox, et ce qui n'est pas vérifié | `docs/boutiques/orion-iphone.md` |
| Visuels : 5 captures 1280 × 800 (mode exemple de l'app + vraie popup, aucune donnée réelle, aucune requête vers la base), tuiles 440 × 280 et 1400 × 560, logo 300 × 300, style Apple sans violet | `docs/boutiques/visuels/`, refaits par `node scripts/boutiques-visuels.cjs` (après `npm run build`) |
| Paquets par boutique, depuis `vinted-sync-extension/` sans le modifier, reproductibles (date fixe) | `node scripts/paquets-boutiques.cjs` → `dist/boutiques/VRM-<v>-chrome.zip`, `-edge.zip`, `-firefox.zip` |
| Audit : chaque paquet = le code de la version SERVIE (`public/VRM-extension.zip`) octet pour octet, Firefox = `manifesteFirefox` du servi (`gecko.id` vrm@vrm.center, données déclarées), fiches complètes vs manifeste, politique qui nomme chaque site, tailles d'images, règle de l'app | `node scripts/audit-paquets-boutiques.cjs [--prouve]` — 45 contrôles verts, 13/13 mutations attrapées |
| Politique de confidentialité DE L'EXTENSION, écrite d'après `background.js` (sites, ce qu'elle lit, envoie, à qui, ce qu'elle fait en son nom, ce qu'elle ne fait jamais, stockage local, utilisation limitée) | `public/legal/extension.html` → https://vrm.center/legal/extension.html ; lien ajouté au §3 de `confidentialite.html` (qui nomme aussi les transporteurs) |
| L'app : UNE règle `installerExtensionIci()` (fiche publiée du navigateur d'ici ⇒ la boutique ; sinon le zip) | `src/navigateurExtension.js` ; bandeau « Ton extension VRM est en retard » (App.jsx `ExtEnRetard`), « Télécharger la mise à jour » de `PremiersPas`, Réglages → État des connexions ; Orion iPhone propose la boutique dès que `LIENS_BOUTIQUES.firefox` est posé (avant : toujours le fichier) |

`LIENS_BOUTIQUES` (`src/navigateursServis.js`) reste VIDE : tant qu'aucune fiche n'est validée, l'app
fait exactement comme avant (audit H + banc `connexions-reglages` 13/13).

`scripts/zip-extension.cjs` : seulement enveloppé (`require.main === module`) et ses fonctions de
manifeste exportées ; lancé en commande, il fait la même chose qu'avant (audit-extension-navigateurs vert).

## Ce qui est vrai dans les fiches (relu dans le code) et peut faire tiquer un relecteur

- Les jetons de session Vinted sont rangés dans l'espace VRM (`vinted_accounts`) : déclaré
  « authentification ».
- `inject.js` lit les réponses réseau des pages Vinted/Leboncoin/Vestiaire : déclaré « activité de
  l'utilisateur » (surveillance du réseau) côté Chrome/Edge, `websiteActivity` côté Firefox.
- Deux automatismes existent, ÉTEINTS par défaut : acceptation des offres au-dessus du prix mini, message
  aux favoris (mode auto 5.309). L'ancien texte (`docs/chrome-web-store/README.md`, §3 de
  `docs/boutiques-extension.md`) disait « n'accepte jamais une offre » : faux, marqué comme remplacé.
- `tabs.query({})` lit l'adresse des onglets sur l'appareil (retrouver Vinted) : jamais envoyée → « Historique
  Web : non ».
- Photoroom ne reçoit des photos que par le serveur de VRM et avec la clé du vendeur (Vestiaire).

## Non fait / non vérifié

- Rien n'est soumis (comptes de Julien). Montant Google « 5 $ » : la page officielle dit « frais uniques »
  sans montant — à revérifier à l'inscription.
- Libellés exacts des catégories (visibles seulement dans les formulaires).
- Icône 128 sans la marge transparente conseillée par Google, et résumé du manifeste sans Vestiaire :
  les changer = une nouvelle version de l'extension (pas ici).
- Qu'Orion iPhone mette bien à jour seul une extension installée depuis addons.mozilla.org : non mesuré.
- Opera : même paquet que Chrome, pas de fiche dédiée. Safari : `docs/boutiques-extension.md` §4.

## Geste de Julien

`docs/boutiques/README.md`, « Le geste de Julien (5 lignes) » : contact rempli → Chrome (5 $) → Edge
(gratuit) → Firefox (gratuit) → me donner l'adresse de chaque fiche validée (je la pose dans
`LIENS_BOUTIQUES`).
