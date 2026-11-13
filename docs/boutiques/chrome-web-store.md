# Fiche Chrome Web Store — prête à coller

> Sert aussi Brave, Vivaldi, Arc et Yandex (ils installent depuis cette boutique).
> Tableau de bord : https://chrome.google.com/webstore/devconsole
> Vérifié le 8 nov. 2026 sur developer.chrome.com (pages « Images », « Listing »,
> « Privacy practices ») — voir `README.md` §1.
> Avant d'envoyer : `node scripts/paquets-boutiques.cjs` puis
> `node scripts/audit-paquets-boutiques.cjs` (tout vert).

**Fichier à envoyer** : `dist/boutiques/VRM-<version>-chrome.zip` (manifeste à la racine).

## Onglet « Fiche Play Store » (Store listing)

**Nom** (lu dans le paquet, non modifiable ici) : VRM — outil du revendeur

**Résumé** (lu dans le paquet — la `description` du manifeste, 132 caractères au plus ; non modifiable ici) :
<!-- resume -->
Relie tes comptes Vinted, Leboncoin, eBay et Vestiaire à VRM : annonces, ventes, colis et bordereaux, depuis ton navigateur.
<!-- /resume -->

**Description** (à coller) :
<!-- description -->
VRM est l'outil de gestion des revendeurs de seconde main (https://vrm.center). Cette extension relie l'app VRM à tes propres comptes Vinted, Leboncoin, eBay et Vestiaire Collective, depuis ton navigateur : tu n'as plus rien à recopier.

Ce qu'elle fait pour toi
• Elle range dans ton espace VRM ce que ces sites affichent déjà sur ta propre activité quand tu les ouvres : annonces, ventes, achats, messages, offres, soldes, bordereaux.
• Elle récupère les bordereaux d'expédition de tes ventes, prêts à imprimer avec le numéro de rangement de la paire.
• Elle relève les codes de retrait de tes colis et leur statut chez le transporteur.
• Sur ton clic dans VRM : remplir une annonce sur Leboncoin, eBay ou Vestiaire Collective, republier une annonce Vinted, baisser un prix, poser le mode vacances, répondre à un message, accepter, refuser ou faire une offre, générer un bordereau.
• Seulement si tu les allumes dans VRM (éteintes par défaut) : accepter les offres Vinted au-dessus du prix minimum que tu as fixé (et refuser avec TON message celles sous ton seuil), et envoyer ton message aux personnes qui mettent ton annonce en favori.

Ses garde-fous
• Elle n'agit qu'au nom du compte connecté dans l'onglet, jamais d'un autre.
• Au plus 50 actions par heure et 200 par jour et par compte, une requête à la fois ; elle s’arrête net quand le site demande une pause ou une vérification.
• Elle ne lit jamais ton mot de passe ni ton historique de navigation.
• Ce qu'elle lit part uniquement dans TON compte VRM. Rien n'est vendu, rien ne sert à la publicité.

Il faut un compte VRM (vrm.center). Détail de ce que l'extension lit et envoie : https://vrm.center/legal/extension.html

VRM est un outil indépendant, ni affilié ni approuvé par Vinted, Leboncoin, eBay ou Vestiaire Collective.
<!-- /description -->

**Catégorie** : Outils (« Tools ») — à défaut « Productivité ». ⚠️ La liste exacte des catégories ne
s'affiche que dans le tableau de bord : prendre celle qui parle d'outils de travail, jamais « Shopping »
(l'extension ne vend rien aux visiteurs).
**Langue** : Français.

**Images** (dans `docs/boutiques/visuels/`, refaites par `node scripts/boutiques-visuels.cjs`) :
- Icône 128 × 128 : `vinted-sync-extension/icon-128.png` (dans le paquet). ⚠️ Google conseille 96 × 96 de
  dessin + 16 px de marge transparente ; l'icône actuelle remplit tout le carré. Ce n'est pas un motif de
  refus, mais la redessiner change le paquet : à faire avec une version de l'extension, pas ici.
- Captures 1280 × 800 (1 au moins, 5 au plus) : `capture-1-journee.png`, `capture-2-cat_bord.png`,
  `capture-3-ventes.png`, `capture-4-annonces.png`, `capture-5-extension.png`. Données INVENTÉES (mode
  exemple de l'app, bandeau « Exemple — rien n'est à toi » visible).
- Petite tuile 440 × 280 : `tuile-440x280.png`. Grande tuile 1400 × 560 (facultative) : `tuile-1400x560.png`.

**Site** : https://vrm.center · **Assistance** : l'adresse de contact de `src/contact.js` (à remplir d'abord).

## Onglet « Pratiques de confidentialité » (Privacy practices)

**Objectif unique** :
<!-- objectif -->
Relier les propres comptes de revente de l'utilisateur (Vinted, Leboncoin, eBay, Vestiaire Collective) à son espace VRM : ranger dans VRM son activité de vente lue sur ces sites, et exécuter sur ces comptes les actions de vente qu'il commande depuis VRM.
<!-- /objectif -->

**Justification des autorisations** (une case par autorisation dans le formulaire ; une phrase vraie chacune) :

| autorisation | justification à coller |
|---|---|
| `cookies` | Lire les cookies de session de Vinted (access_token_web, refresh_token_web, anon_id) pour savoir quel compte Vinted est connecté et n'agir qu'au nom de celui-là ; ces jetons sont rangés dans l'espace VRM de l'utilisateur pour exécuter les actions qu'il commande. |
| `storage` | Garder l'état de l'extension entre deux réveils du service worker : session VRM, compteurs du plafond de 50 actions par heure, commandes en attente, dates des tâches. |
| `alarms` | Relancer les tâches périodiques : relève des comptes (toutes les 10 à 20 minutes), photos en attente (chaque minute), renouvellement de la session VRM (40 minutes). |
| `scripting` | Exécuter, dans l'onglet Vinted, Leboncoin ou Vestiaire Collective déjà ouvert par l'utilisateur, les lectures et les actions qu'il commande, depuis la page elle-même (même origine, mêmes cookies). |
| `tabs` | Retrouver l'onglet du site ou de VRM déjà ouvert et ouvrir la page utile (VRM, dépôt d'annonce) quand l'utilisateur le demande ; l'adresse des onglets n'est ni gardée ni envoyée. |
| `downloads` | Reconnaître le PDF d'un bordereau d'expédition que l'utilisateur télécharge depuis Vinted, pour le ranger avec la vente ; tout autre téléchargement est ignoré et l'extension n'en déclenche aucun. |
| `contextMenus` | Ajouter au clic droit sur l'icône de l'extension deux entrées, « Connexion à VRM » et « État de l'extension », qui ouvrent la page de connexion de l'extension dans un onglet. Aucun autre menu, aucune lecture de page. |

**Autorisations d'hôte** (le formulaire les regroupe en une case « Host permission » : coller le tableau
en texte, une ligne par hôte) :

| hôte | justification |
|---|---|
| `https://*.vinted.fr/*`, `https://*.vinted.com/*`, `https://*.vinted.it/*`, `https://*.vinted.de/*` | Les comptes Vinted de l'utilisateur : lire son activité, exécuter ses actions. |
| `https://*.vinted.net/*` | Les photos de ses annonces Vinted (serveur d'images de Vinted), pour les joindre à la même annonce sur un autre site. |
| `https://*.amazonaws.com/*` | Les bordereaux PDF de Vinted sont servis par un stockage Amazon S3 ; l'extension les télécharge pour les ranger avec la vente. |
| `https://*.leboncoin.fr/*` | Les comptes Leboncoin de l'utilisateur. |
| `https://*.ebay.fr/*`, `https://*.ebay.com/*` | Les comptes eBay de l'utilisateur : remplir une annonce depuis VRM. |
| `https://*.vestiairecollective.com/*` (scripts de contenu) | Les comptes Vestiaire Collective de l'utilisateur. |
| `https://www.mondialrelay.be/*`, `https://www.mondialrelay.fr/*`, `https://ws.chronopost.fr/*`, `https://carrier.vintedgo.com/*` | Lire le statut public des colis que l'utilisateur attend (n° de suivi), quand le serveur de VRM ne peut pas le lire ; 12 lectures par heure et par transporteur au plus. |
| `https://www.chronopost.fr/tracking-no-cms/*`, `https://vintedgo.com/*` (scripts de contenu) | Sur une page de suivi ouverte par l'utilisateur, lire seulement l'adresse de la page (le n° de suivi), jamais son contenu. |
| `https://lgonxzrzjcqthjtbdpzo.supabase.co/*` | La base de données de VRM, où l'espace de l'utilisateur est rangé. |
| `https://vrm.center/*` | L’app VRM, qui commande l’extension, et le numéro de la dernière version servie (`/extension-version.json`), lu au plus toutes les 6 heures. |

**Code distant** : « Non, je n'utilise pas de code distant ». Tout le code est dans le paquet ; les scripts
de la page (`inject.js`, `lbc-inject.js`, `vc-inject.js`) sont des fichiers du paquet.

**Utilisation des données** — cases à cocher (ce que l'extension recueille, d'après le code) :

| catégorie (libellé du formulaire) | coche | ce que c'est chez VRM |
|---|---|---|
| Informations permettant d'identifier personnellement l'utilisateur | ✅ | e-mail du compte VRM, pseudos des comptes de revente ; noms et adresses de livraison des acheteurs sur les commandes |
| Informations sur la santé | ❌ | — |
| Informations financières et de paiement | ✅ | montants des ventes, soldes du porte-monnaie Vinted (jamais un numéro de carte) |
| Informations d'authentification | ✅ | jetons de session des comptes de revente, session VRM |
| Communications personnelles | ✅ | messages des conversations de vente |
| Position | ❌ | — (l'adresse d'un point relais est celle d'un commerce, rangée avec la commande) |
| Historique Web | ❌ | l'adresse des onglets est lue sur l'appareil pour retrouver un onglet, jamais gardée ni envoyée |
| Activité de l'utilisateur | ✅ | l'extension lit les réponses réseau que Vinted, Leboncoin et Vestiaire envoient à la page (« surveillance du réseau » au sens du formulaire) ; ni frappes, ni clics |
| Contenu du site Web | ✅ | annonces, commandes, photos, bordereaux |

**Certifications** (les trois cases) : je ne vends ni ne transfère les données à des tiers, en dehors des
cas d'utilisation approuvés ; je n'utilise pas les données à des fins sans rapport avec l'objectif unique ;
je n'utilise pas les données pour déterminer la solvabilité ou accorder un prêt.

**Règles de confidentialité (URL)** : https://vrm.center/legal/extension.html

## Onglet « Distribution »

- **Visibilité** conseillée au début : « Non répertoriée » (seuls ceux qui ont le lien l'installent) ; passer
  en « Publique » quand tout tourne.
- **Régions** : toutes (VRM reste sur la France, mais un vendeur peut voyager).

## Checklist de soumission

- [ ] `public/legal/editeur.js` et `src/contact.js` remplis (sinon la politique affiche des blancs : refus probable).
- [ ] https://vrm.center/legal/extension.html répond (déployé).
- [ ] `node scripts/paquets-boutiques.cjs` puis `node scripts/audit-paquets-boutiques.cjs` : tout vert.
- [ ] Envoyer `dist/boutiques/VRM-<version>-chrome.zip` (Éléments → Importer un nouveau package).
- [ ] Coller description, catégorie, langue ; ajouter les 5 captures, la petite tuile (et la grande).
- [ ] Onglet confidentialité : objectif unique, 6 autorisations + le tableau des hôtes, code distant « Non »,
      cases de données, 3 certifications, URL de la politique.
- [ ] Distribution : « Non répertoriée ».
- [ ] « Envoyer pour examen ». L'accès aux cookies et à de nombreux sites rallonge l'examen.
- [ ] Une fois publiée : coller l'adresse de la fiche dans `LIENS_BOUTIQUES.chrome`
      (`src/navigateursServis.js`) — l'app propose alors la boutique au lieu du zip.
- [ ] Retirer la copie installée à la main (`chrome://extensions`) dans chaque Chrome : deux extensions VRM
      dans un navigateur, l'app coupe les commandes.

⚠️ Chaque nouvelle version repasse par l'examen de Google. ⚠️ Une mise à jour qui AJOUTE un site ou une
autorisation avec un nouvel avertissement **désactive l'extension** chez chacun jusqu'à ce qu'il accepte :
tout ce qui est prévu doit être dans la première version publiée.
