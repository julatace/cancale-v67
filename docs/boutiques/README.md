# Publier l'extension VRM dans les boutiques officielles

**Pourquoi** : installée depuis une boutique, l'extension **se met à jour toute seule**. Installée à la main
(le zip, le fichier Orion), elle reste sur sa version jusqu'au prochain geste — le 8 novembre, l'iPhone de
Julien tournait encore en 5.322.

## Le geste de Julien (5 lignes)

1. **Avant tout** : remplir `public/legal/editeur.js` et `src/contact.js` (une adresse de contact) — les trois boutiques l'exigent.
2. **Chrome** : https://chrome.google.com/webstore/devconsole → compte développeur Google (**5 $ une fois**) → « Nouvel élément » → envoyer `VRM-<version>-chrome.zip`, coller `chrome-web-store.md`.
3. **Edge** : https://partner.microsoft.com/dashboard/microsoftedge/ → compte **gratuit** → « Create new extension » → `VRM-<version>-edge.zip`, coller `edge.md`.
4. **Firefox** (et Orion sur iPhone) : https://addons.mozilla.org/developers/ → compte **gratuit** → « Soumettre un nouveau module » → `VRM-<version>-firefox.zip`, coller `firefox.md`.
5. Les trois zips se fabriquent par `node scripts/paquets-boutiques.cjs` (dans `dist/boutiques/`) ; une fois chaque fiche validée, me donner son adresse : je la pose dans `LIENS_BOUTIQUES` et l'app propose la boutique au lieu du zip.

## Ce qui est dans ce dossier

| fichier | quoi |
|---|---|
| `chrome-web-store.md` | la fiche Chrome, champ par champ (Brave, Vivaldi, Arc en profitent) |
| `edge.md` | la fiche Microsoft Edge Add-ons |
| `firefox.md` | la fiche addons.mozilla.org (Firefox ordinateur, Android, Orion) + notes pour le relecteur |
| `orion-iphone.md` | le parcours iPhone, aujourd'hui (fichier) et demain (boutique), et ce qui n'est pas vérifié |
| `visuels/` | 5 captures 1280 × 800, tuiles 440 × 280 et 1400 × 560, logo 300 × 300 — refaits par `node scripts/boutiques-visuels.cjs` (après `npm run build`) depuis le **mode exemple** (données inventées) et la vraie fenêtre de l'extension |

Autour :
- `public/legal/extension.html` → https://vrm.center/legal/extension.html : la politique de confidentialité
  **de l'extension** (ce qu'elle lit, envoie, à qui, ce qu'elle ne fait jamais), écrite d'après `background.js`.
  C'est l'URL à donner aux trois boutiques. Elle renvoie à la politique générale pour le reste.
- `scripts/paquets-boutiques.cjs` : fabrique les trois paquets depuis `vinted-sync-extension/` sans y
  toucher (manifeste à la racine ; Firefox : `gecko.id` `vrm@vrm.center`, déclaration des données).
- `scripts/audit-paquets-boutiques.cjs` : vérifie que chaque paquet EST le code de la version servie
  (`public/VRM-extension.zip`), octet pour octet, que les fiches justifient chaque autorisation et chaque
  site du manifeste, que les images ont les bonnes tailles. `--prouve` : chaque contrôle doit rougir sur
  une mutation.
- `src/navigateurExtension.js` · `installerExtensionIci()` : la règle unique des boutons « installer /
  mettre à jour » de l'app (fiche publiée du navigateur d'ici, sinon le zip).
- `src/navigateursServis.js` · `LIENS_BOUTIQUES` : vide ⇒ rien ne change dans l'app.

## 1. Les exigences des boutiques (relues le 8 novembre 2026)

Sources lues directement : developer.chrome.com (« Supplying images », « Complete your listing
information », « Fill out the privacy fields »), learn.microsoft.com (« Publish a Microsoft Edge
extension », mise à jour du 2 sept. 2026), extensionworkshop.com (« Submitting an add-on », « Firefox
built-in data consent »). Ce que ces pages ne disent pas est marqué « à vérifier dans le formulaire ».

| | Chrome Web Store | Microsoft Edge Add-ons | Firefox (AMO) |
|---|---|---|---|
| compte | Google, **5 $ une fois** (à revérifier à l'inscription) | Partner Center, **gratuit** | compte Mozilla, **gratuit** |
| paquet | zip, `manifest.json` à la racine, MV3 | zip, idem | zip/xpi, 200 Mo au plus ; `gecko.id` |
| Manifest V3 | obligatoire | MV3 : aucun code distant | MV3 accepté (page de fond) |
| nom / résumé | lus dans le manifeste (`name`, `description` ≤ 132 car.) | lus dans le manifeste | modifiables ; résumé 250 car. (à vérifier dans le formulaire) |
| description | sans limite donnée ; pas de bourrage de mots-clés | **250 à 10 000 caractères** | libre |
| icône | 128 × 128 PNG dans le paquet (96 de dessin + 16 de marge conseillés) | logo 1:1, **300 × 300 conseillé**, 128 minimum | celle du paquet |
| captures | **1 à 5**, 1280 × 800 (ou 640 × 400), coins carrés, plein cadre | 6 au plus, 1280 × 800 ou 640 × 480 | libres (1280 × 800 conseillé) |
| petite tuile | 440 × 280 (sans elle, la fiche passe après les autres) | 440 × 280 (facultative) | — |
| grande tuile | 1400 × 560 (seulement pour être mis en avant) | 1400 × 560 (facultative) | — |
| objectif unique | **obligatoire** (« étroit et facile à comprendre ») | **obligatoire** | — |
| justification | **chaque autorisation**, une case chacune | **chaque autorisation** | notes pour le relecteur |
| code distant | « Non » à déclarer | « Non » à déclarer | interdit ; source à joindre si minifié (ici : non) |
| données | cases par catégorie + 3 certifications | mêmes cases + certifications | `data_collection_permissions` **obligatoire** pour toute nouvelle extension depuis le 3 nov. 2025 (Firefox 140 / Android 142) |
| politique de confidentialité | URL, obligatoire dès qu'on traite des données | URL, obligatoire | texte, obligatoire dès qu'une donnée quitte l'appareil |
| catégorie | une (liste dans le formulaire) | une (obligatoire) | 2 Firefox + 2 Android |
| autre | — | mots-clés : 7 au plus, 30 car., 21 mots ; notes de certification | case « nécessite un paiement » ; plateformes Firefox / Android |
| examen | quelques jours, plus long avec cookies et beaucoup de sites | **jusqu'à 7 jours ouvrés** | quelques heures à quelques jours |
| mises à jour | chaque version repasse l'examen ; un nouvel avertissement d'autorisation **désactive** l'extension chez chacun jusqu'à accord | idem | idem ; une nouvelle donnée requise est montrée à la mise à jour |

**Les autorisations larges, à justifier une par une** : `cookies` (session Vinted), `tabs`, `scripting`,
`downloads`, et les hôtes `*.amazonaws.com` (les bordereaux de Vinted sont sur S3 — le plus surprenant
pour un relecteur, d'où la phrase précise) et `*.vinted.net`. Aucune `<all_urls>`. Les tableaux des fiches
sont la seule source ; l'audit vérifie qu'aucune autorisation ni aucun site du manifeste n'y manque.

**Ce qui peut faire tiquer un relecteur, et ce qu'on y répond (vrai d'après le code)** : l'extension agit
sur des sites tiers (republier, répondre, offres) — toujours au nom du compte connecté dans l'onglet,
50 actions par heure au plus, une requête à la fois ; les deux automatismes (offres au-dessus du prix
mini, message aux favoris) sont **éteints par défaut** et allumés par l'utilisateur ; les jetons de session
Vinted vont dans l'espace VRM de l'utilisateur (déclaré : « Informations d'authentification »).

## 2. À chaque nouvelle version de l'extension

1. La version est montée et `public/VRM-extension.zip` refait (règle §6 de CLAUDE.md).
2. `node scripts/paquets-boutiques.cjs` → `node scripts/audit-paquets-boutiques.cjs` (vert).
3. Envoyer le même numéro aux trois boutiques (« Importer un nouveau package » / « Update » / « Nouvelle
   version »). Les fiches ne changent que si une autorisation ou un site change — alors les tableaux d'abord.
4. Tant que la boutique n'a pas validé, l'app peut dire « extension en retard » : c'est normal.

## 3. Pas fait ici, et pourquoi

- **Rien n'a été soumis** : il faut les comptes de Julien (et le paiement Google).
- **Opera Add-ons** : même paquet que Chrome/Edge (`VRM-<version>-chrome.zip`), mêmes textes ; pas de fiche
  dédiée (moins de vendeurs ; `LIENS_BOUTIQUES.opera` existe déjà).
- **Safari** (Mac, iPhone sans Orion) : app conteneur, Mac + Xcode + 99 $/an — `docs/boutiques-extension.md` §4.
- **L'icône 128** n'a pas la marge transparente conseillée par Google : la changer modifie le paquet, donc
  avec une prochaine version de l'extension.
- Le manifeste dit « Vinted, Leboncoin et eBay » sans Vestiaire Collective : c'est le résumé que Chrome et
  Edge afficheront ; le changer est un changement de version de l'extension (pas fait ici, une autre session
  monte la version en ce moment).
