# Fiche Firefox (addons.mozilla.org) — prête à coller

> Sert Firefox sur ordinateur, **Firefox pour Android**, et Orion (iPhone, iPad, Mac), qui installe depuis
> cette boutique. Compte **gratuit** : https://addons.mozilla.org/developers/ → « Soumettre un nouveau module ».
> Exigences relues le 8 nov. 2026 sur extensionworkshop.com (« Submitting an add-on », « Firefox built-in
> data consent ») — voir `README.md` §1.

**Fichier à envoyer** : `dist/boutiques/VRM-<version>-firefox.zip`.
Ce paquet porte (fabriqué par `scripts/paquets-boutiques.cjs`, vérifié par l'audit) :
- `browser_specific_settings.gecko.id` = `vrm@vrm.center` — **définitif** : ne jamais le changer, c'est lui
  qui fait arriver les mises à jour ;
- `strict_min_version` 140 (ordinateur) / 142 (Android) : les premières qui lisent la déclaration des données ;
- `data_collection_permissions.required` : `authenticationInfo`, `personallyIdentifyingInfo`,
  `personalCommunications`, `financialAndPaymentInfo`, `websiteContent`, `websiteActivity` — obligatoire
  pour toute NOUVELLE extension depuis le 3 nov. 2025 ; Firefox les montre à l'installation ;
- une page de fond (Firefox n'exécute pas le service worker) et `compat-firefox.js` devant chaque script.
Le code, lui, est celui de Chrome octet pour octet.

## 1. Où sera-t-il distribué ?
« **Sur ce site** » (fiche publique sur addons.mozilla.org) — nécessaire pour les mises à jour automatiques
et pour qu'Orion la trouve. (« Moi-même » = un fichier signé, sans mise à jour automatique : ce qu'on fuit.)

## 2. Plateformes
Cocher **Firefox** ET **Firefox pour Android**.

## 3. Code source
« Non » : le code n'est ni minifié ni assemblé par un outil ; ce qui est dans le zip est le source.

## 4. Décrire le module

- **Nom** : VRM — outil du revendeur
- **Adresse du module** : `vrm`
- **Résumé** (250 caractères au plus) :
<!-- resume -->
Relie tes comptes Vinted, Leboncoin et eBay à VRM : annonces, ventes, colis et bordereaux, depuis ton navigateur.
<!-- /resume -->
- **Description** :
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
- **Expérimental** : non.
- **Nécessite un paiement** : ✅ à cocher dès que l'abonnement VRM est ouvert (le module ne sert qu'avec un
  compte VRM payant) ; tant que VRM est gratuit, ne pas cocher.
- **Catégories** Firefox (2 au plus) : « Boutiques et achats » (Shopping) et « Autres » ; Android : les
  mêmes si proposées. ⚠️ La liste exacte s'affiche dans le formulaire.
- **Adresse e-mail d'assistance** : celle de `src/contact.js` · **Site d'assistance** : https://vrm.center
- **Licence** : « Tous droits réservés ».
- **Ce module a une politique de confidentialité** : ✅ — coller le texte de
  https://vrm.center/legal/extension.html (ouvrir la page, tout sélectionner, copier) ; AMO l'affiche sur la fiche.
- **Captures** (après la soumission, onglet « Images » de la fiche) : les 5 `capture-*.png` de
  `docs/boutiques/visuels/` (1280 × 800). Icône : `icon-128.png`, dans le paquet.

## 5. Notes pour le relecteur (à coller)

> Extension compagnon du service VRM (https://vrm.center), utilisable seulement avec un compte VRM et des
> comptes de revente (Vinted, Leboncoin, eBay, Vestiaire Collective) appartenant à l'utilisateur. Code non
> minifié, aucune source à joindre. Aucun code distant : `inject.js`, `lbc-inject.js` et `vc-inject.js` sont
> des fichiers du paquet.
>
> Permissions :
> | autorisation | justification à coller |
> |---|---|
> | `cookies` | Lire les cookies de session de Vinted (access_token_web, refresh_token_web, anon_id) pour savoir quel compte Vinted est connecté et n'agir qu'au nom de celui-là ; ces jetons sont rangés dans l'espace VRM de l'utilisateur pour exécuter les actions qu'il commande. |
> | `storage` | Garder l'état de l'extension entre deux réveils du service worker : session VRM, compteurs du plafond de 50 actions par heure, commandes en attente, dates des tâches. |
> | `alarms` | Relancer les tâches périodiques : relève des comptes (toutes les 10 à 20 minutes), photos en attente (chaque minute), renouvellement de la session VRM (40 minutes). |
> | `scripting` | Exécuter, dans l'onglet Vinted, Leboncoin ou Vestiaire Collective déjà ouvert par l'utilisateur, les lectures et les actions qu'il commande, depuis la page elle-même (même origine, mêmes cookies). |
> | `tabs` | Retrouver l'onglet du site ou de VRM déjà ouvert et ouvrir la page utile (VRM, dépôt d'annonce) quand l'utilisateur le demande ; l'adresse des onglets n'est ni gardée ni envoyée. |
> | `downloads` | Reconnaître le PDF d'un bordereau d'expédition que l'utilisateur télécharge depuis Vinted, pour le ranger avec la vente ; tout autre téléchargement est ignoré et l'extension n'en déclenche aucun. |
>
> Hôtes :
> | hôte | justification |
> |---|---|
> | `https://*.vinted.fr/*`, `https://*.vinted.com/*`, `https://*.vinted.it/*`, `https://*.vinted.de/*` | Les comptes Vinted de l'utilisateur : lire son activité, exécuter ses actions. |
> | `https://*.vinted.net/*` | Les photos de ses annonces Vinted (serveur d'images de Vinted), pour les joindre à la même annonce sur un autre site. |
> | `https://*.amazonaws.com/*` | Les bordereaux PDF de Vinted sont servis par un stockage Amazon S3 ; l'extension les télécharge pour les ranger avec la vente. |
> | `https://*.leboncoin.fr/*` | Les comptes Leboncoin de l'utilisateur. |
> | `https://*.ebay.fr/*`, `https://*.ebay.com/*` | Les comptes eBay de l'utilisateur : remplir une annonce depuis VRM. |
> | `https://*.vestiairecollective.com/*` (scripts de contenu) | Les comptes Vestiaire Collective de l'utilisateur. |
> | `https://www.mondialrelay.be/*`, `https://www.mondialrelay.fr/*`, `https://ws.chronopost.fr/*`, `https://carrier.vintedgo.com/*` | Lire le statut public des colis que l'utilisateur attend (n° de suivi), quand le serveur de VRM ne peut pas le lire ; 12 lectures par heure et par transporteur au plus. |
> | `https://www.chronopost.fr/tracking-no-cms/*`, `https://vintedgo.com/*` (scripts de contenu) | Sur une page de suivi ouverte par l'utilisateur, lire seulement l'adresse de la page (le n° de suivi), jamais son contenu. |
> | `https://lgonxzrzjcqthjtbdpzo.supabase.co/*` | La base de données de VRM, où l'espace de l'utilisateur est rangé. |
> | `https://vrm.center/*`, `https://cancale-v67-ten.vercel.app/*` | L'app VRM, qui commande l'extension (la seconde est l'ancienne adresse de l'app). |
>
> `data_collection_permissions` : authenticationInfo (jetons de session Vinted, session VRM),
> personallyIdentifyingInfo (e-mail VRM, pseudos ; noms et adresses des acheteurs sur les commandes),
> personalCommunications (messages des ventes), financialAndPaymentInfo (montants, solde Vinted ; jamais
> de carte), websiteContent (annonces, commandes, photos, bordereaux), websiteActivity (téléchargement
> d'un bordereau, réponses réseau des pages de ces sites). Tout part UNIQUEMENT dans le compte VRM de
> l'utilisateur ; rien n'est vendu ni partagé. Politique : https://vrm.center/legal/extension.html
>
> Pour tester : créer un compte sur https://vrm.center, cliquer l'icône de l'extension (« Ouvrir VRM »
> la connecte), puis ouvrir vinted.fr : le logo VRM en bas à droite ouvre la carte qui dit le compte VRM
> connecté. Sans compte Vinted connecté, rien n'est lu ni envoyé.
>
> Sur Firefox, les autorisations des sites des transporteurs peuvent rester non accordées : l'extension le
> mesure (`permissions.contains`), se tait, et sa fenêtre propose « Autoriser » (`permissions.request`,
> dans le geste de l'utilisateur).

## Checklist de soumission

- [ ] `public/legal/editeur.js` et `src/contact.js` remplis ; https://vrm.center/legal/extension.html en ligne.
- [ ] `node scripts/paquets-boutiques.cjs` puis `node scripts/audit-paquets-boutiques.cjs` : tout vert.
- [ ] (Facultatif, conseillé) `npx web-ext lint -s <dossier dézippé>` : 0 erreur (le 31 oct. sur la 5.198 :
      0 erreur, 0 avertissement).
- [ ] Soumettre → « Sur ce site » → `VRM-<version>-firefox.zip` → Firefox + Android → code source « Non ».
- [ ] Décrire (nom, résumé, description, catégories, assistance, licence, politique) ; notes pour le relecteur.
- [ ] Captures dans l'onglet Images.
- [ ] Une fois validée : l'adresse de la fiche (`https://addons.mozilla.org/fr/firefox/addon/vrm/`) dans
      `LIENS_BOUTIQUES.firefox` (`src/navigateursServis.js`). L'app propose alors la boutique sur Firefox,
      Firefox pour Android et Orion — le parcours iPhone devient celui de `orion-iphone.md`.
- [ ] Retirer la copie installée à la main (`about:addons`) ; sur Orion, l'ancien paquet `VRM-Orion.xpi`.
