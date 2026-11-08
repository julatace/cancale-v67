# Fiche Microsoft Edge Add-ons — prête à coller

> Partner Center : https://partner.microsoft.com/dashboard/microsoftedge/ — compte développeur **gratuit**.
> Exigences relues le 8 nov. 2026 sur learn.microsoft.com (« Publish a Microsoft Edge extension », page
> mise à jour le 2 sept. 2026) — voir `README.md` §1.
> Même paquet que Chrome (moteur Chromium), mêmes textes ; ce qui change est noté ⚠️.

**Fichier à envoyer** : `dist/boutiques/VRM-<version>-edge.zip` (le même contenu que celui de Chrome).

## 1. Packages → déposer le zip

## 2. Availability (disponibilité)
- **Visibility** : « Hidden » au début (seuls ceux qui ont le lien), « Public » ensuite.
- **Markets** : tous.

## 3. Properties (propriétés)
- **Category** : Productivity (« Productivité »).
- **Website** : https://vrm.center
- **Support contact detail** : l'adresse de contact de `src/contact.js` (à remplir d'abord).
- **Mature content** : non.

## 4. Privacy (confidentialité)

**Single Purpose Description** :
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
| `https://vrm.center/*`, `https://cancale-v67-ten.vercel.app/*` | L'app VRM, qui commande l'extension (la seconde est l'ancienne adresse de l'app). |

**Are you using remote code?** : « No, I am not using remote code ».

**Data usage** — mêmes cases que pour Chrome (le formulaire de Microsoft reprend les mêmes catégories) :

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

**Certifications** : cocher les trois (pas de vente ou transfert à des tiers hors usages approuvés ; pas
d'usage sans rapport avec l'objectif unique ; pas d'usage pour la solvabilité ou un prêt).

**Privacy Policy URL** : https://vrm.center/legal/extension.html

## 5. Store listings → Français (Details for French)

- **Extension name** et **Short description** : lus dans le paquet (non modifiables ici).
<!-- resume -->
Relie tes comptes Vinted, Leboncoin, eBay et Vestiaire à VRM : annonces, ventes, colis et bordereaux, depuis ton navigateur.
<!-- /resume -->
- **Description** ⚠️ 250 caractères au moins, 10 000 au plus (celle-ci en fait plus de 1 500) — ne PAS utiliser
  « Generate with AI » (elle inventerait des fonctions) :
<!-- description -->
VRM est l'outil de gestion des revendeurs de seconde main (https://vrm.center). Cette extension relie l'app VRM à tes propres comptes Vinted, Leboncoin, eBay et Vestiaire Collective, depuis ton navigateur : tu n'as plus rien à recopier.

Ce qu'elle fait pour toi
• Elle range dans ton espace VRM ce que ces sites affichent déjà sur ta propre activité quand tu les ouvres : annonces, ventes, achats, messages, offres, soldes, bordereaux.
• Elle récupère les bordereaux d'expédition de tes ventes, prêts à imprimer avec le numéro de rangement de la paire.
• Elle relève les codes de retrait de tes colis et leur statut chez le transporteur.
• Sur ton clic dans VRM : remplir une annonce sur Leboncoin, eBay ou Vestiaire Collective, republier une annonce Vinted, répondre à un message, accepter, refuser ou faire une offre, générer un bordereau.
• Seulement si tu les allumes dans VRM (éteintes par défaut) : accepter les offres Vinted au-dessus du prix minimum que tu as fixé, et envoyer ton message aux personnes qui mettent ton annonce en favori.

Ses garde-fous
• Elle n'agit qu'au nom du compte connecté dans l'onglet, jamais d'un autre.
• Au plus 50 actions par heure et par compte, une requête à la fois ; elle s'arrête quand le site demande une pause.
• Elle ne lit jamais ton mot de passe ni ton historique de navigation.
• Ce qu'elle lit part uniquement dans TON compte VRM. Rien n'est vendu, rien ne sert à la publicité.

Il faut un compte VRM (vrm.center). Détail de ce que l'extension lit et envoie : https://vrm.center/legal/extension.html

VRM est un outil indépendant, ni affilié ni approuvé par Vinted, Leboncoin, eBay ou Vestiaire Collective.
<!-- /description -->
- **Extension logo** ⚠️ (carré, 300 × 300 conseillé, 128 × 128 minimum) : `docs/boutiques/visuels/logo-300x300.png`.
- **Small promotional tile** 440 × 280 : `docs/boutiques/visuels/tuile-440x280.png`.
- **Large promotional tile** 1400 × 560 (facultatif) : `docs/boutiques/visuels/tuile-1400x560.png`.
- **Screenshots** ⚠️ (6 au plus, 1280 × 800 ou 640 × 480) : les 5 `capture-*.png` de `docs/boutiques/visuels/`.
- **Search terms** ⚠️ (7 au plus, 30 caractères chacun, 21 mots en tout) : vinted · leboncoin · revendeur ·
  bordereau · colis · seconde main · vestiaire collective

## 6. Notes for certification (à coller)

> Extension compagnon du service VRM (https://vrm.center) : elle ne sert qu'avec un compte VRM et des comptes
> Vinted / Leboncoin / eBay / Vestiaire Collective appartenant à l'utilisateur. Code non minifié.
> Pour tester sans compte de revente : créer un compte sur https://vrm.center, ouvrir l'icône de
> l'extension (« Ouvrir VRM » connecte l'extension), puis ouvrir vinted.fr : le logo VRM en bas à droite
> ouvre la carte qui dit le compte VRM connecté. Sans compte Vinted connecté, l'extension ne lit rien et
> n'envoie rien. Détail des données : https://vrm.center/legal/extension.html

## Checklist de soumission

- [ ] Compte Partner Center créé (gratuit), programme « Microsoft Edge » choisi.
- [ ] `public/legal/editeur.js` et `src/contact.js` remplis ; https://vrm.center/legal/extension.html en ligne.
- [ ] `node scripts/paquets-boutiques.cjs` puis `node scripts/audit-paquets-boutiques.cjs` : tout vert.
- [ ] Packages → `VRM-<version>-edge.zip` ; Availability « Hidden » ; Properties ; Privacy ; Store listing FR.
- [ ] Notes for certification collées → **Publish**. Examen : jusqu'à 7 jours ouvrés.
- [ ] Une fois « In the Store » : l'adresse de la fiche dans `LIENS_BOUTIQUES.edge` (`src/navigateursServis.js`).
- [ ] Retirer la copie installée à la main (`edge://extensions`).
