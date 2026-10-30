# Publier l'extension VRM sur le Chrome Web Store

> Edge, Opera, Brave et Firefox (ordinateur et Android) : voir
> `docs/boutiques-extension.md` — le même paquet sert Edge et Opera, et les
> textes ci-dessous servent les quatre boutiques.

Tout ce qu'il faut coller dans le tableau de bord développeur de Google
(https://chrome.google.com/webstore/devconsole), champ par champ.
Le paquet à envoyer se fabrique par :

```
node scripts/zip-extension.cjs --store VRM-chrome-web-store.zip
```

(`manifest.json` est à la racine du zip, comme la boutique l'exige ; le zip
habituel `public/VRM-extension.zip` est refait en même temps.)

## Ce que Julien doit faire (personne d'autre ne peut)

1. Créer le compte développeur Google (5 $ une fois), au nom de l'éditeur.
2. **Remplir l'adresse de contact** dans `public/legal/editeur.js` (champ
   `email`) et `src/contact.js` : Google exige une adresse joignable et la
   politique de confidentialité doit la porter. Sans elle, refus quasi certain.
3. Envoyer le zip, coller les textes ci-dessous, ajouter les images de
   `docs/chrome-web-store/` (icône 128, captures 1280×800, vignette 440×280).
4. **Visibilité conseillée : « Non répertoriée »** (seules les personnes qui ont
   le lien peuvent l'installer). On passe en « Publique » plus tard.
5. Une fois publiée : retirer la copie installée à la main dans
   `chrome://extensions` (sinon deux extensions VRM tournent, l'app le dit et
   coupe les commandes).

⚠️ **Chaque mise à jour repasse par la vérification de Google** (souvent
quelques heures, parfois quelques jours). Pendant ce temps l'app peut dire
« extension à mettre à jour » alors que la nouvelle version attend la
validation : c'est normal.

## Fiche de la boutique

**Nom** : VRM — outil du revendeur

**Résumé (132 caractères max, repris du manifeste)** :
Relie tes comptes Vinted, Leboncoin et eBay à VRM : annonces, ventes, colis et bordereaux, depuis ton navigateur.

**Catégorie** : Productivité (outils) · **Langue** : français

**Description** :

> VRM est l'outil de gestion des revendeurs de seconde main (vrm.center).
> Cette extension relie VRM à tes propres comptes Vinted, Leboncoin et eBay,
> depuis TON navigateur :
>
> • tes annonces, ventes, achats, messages et soldes arrivent dans VRM tout seuls ;
> • les bordereaux d'expédition de tes ventes sont récupérés et prêts à imprimer,
>   avec le numéro de rangement de la paire ;
> • les codes de retrait de tes colis sont lus dans tes conversations ;
> • tu publies une annonce sur Leboncoin ou eBay depuis VRM, sans recopier.
>
> Tout se pilote dans l'app VRM. L'extension n'agit que pour le compte connecté
> dans l'onglet, au plus 50 actions par heure, une requête à la fois, et
> n'accepte jamais une offre ni ne supprime une annonce toute seule.
>
> Un compte VRM est nécessaire. VRM est un outil indépendant, ni affilié ni
> approuvé par Vinted, Leboncoin ou eBay.

## Onglet « Pratiques de confidentialité »

**Objectif unique** :
Synchroniser l'activité de vente de l'utilisateur sur ses propres comptes de
revente (Vinted, Leboncoin, eBay, Vestiaire Collective) avec son espace VRM, et
exécuter dans ces comptes les actions qu'il demande depuis l'app VRM.

**Justification des autorisations** :

| autorisation | pourquoi |
|---|---|
| `cookies` | Savoir quel compte Vinted est connecté dans l'onglet : l'extension n'agit jamais au nom d'un autre compte que celui-là. Lecture seule. |
| `storage` | Garder l'état de l'extension (session VRM, compteurs d'actions par heure, file des commandes) entre deux réveils du service worker. |
| `alarms` | Relève périodique (toutes les 30 s à quelques minutes) des commandes envoyées depuis l'app et renouvellement de la session VRM. |
| `scripting` | Lire, dans l'onglet de la plateforme déjà ouvert par l'utilisateur, les données de ses annonces et ventes (et remplir le formulaire de dépôt Leboncoin quand il publie depuis VRM). |
| `tabs` | Retrouver l'onglet de la plateforme déjà ouvert, ouvrir la page de dépôt Leboncoin ou la conversation d'une vente quand l'utilisateur le demande. |
| `downloads` | Repérer le PDF du bordereau d'expédition que l'utilisateur télécharge depuis Vinted, pour le ranger dans VRM avec la vente. Observation seule : l'extension ne déclenche aucun téléchargement. |
| hôtes `*.vinted.*`, `*.leboncoin.fr`, `*.ebay.*` | Les plateformes de revente de l'utilisateur. |
| hôte `*.vinted.net` | Les photos de ses annonces (CDN de Vinted), pour les joindre à une annonce Leboncoin/eBay. |
| hôte `*.amazonaws.com` | Les bordereaux PDF de Vinted sont servis par un stockage Amazon S3 (`svc-shipping-labels…amazonaws.com`). |
| hôte `lgonxzrzjcqthjtbdpzo.supabase.co` | La base de données de VRM, où l'espace de l'utilisateur est rangé. |
| hôtes `vrm.center`, `cancale-v67-ten.vercel.app` | L'app VRM, qui pilote l'extension. |

**Code distant** : Non. Tout le code est dans le paquet (`inject.js` est un
fichier du paquet injecté via `chrome.runtime.getURL`).

**Données recueillies** (cases à cocher) :
- Informations permettant d'identifier l'utilisateur (e-mail du compte VRM, pseudos des comptes de revente)
- Communications personnelles (messages des conversations de vente)
- Informations financières et de paiement (soldes et montants des ventes ; jamais de numéro de carte)
- Informations d'authentification (session des comptes de revente, pour agir à sa demande)
- Localisation : non · Historique web : non · Activité de l'utilisateur : non · Contenu du site web : oui (ses annonces)

**Certifications** (les trois cases) : pas de vente à des tiers ; pas
d'utilisation sans rapport avec l'objectif unique ; pas d'utilisation pour la
solvabilité ou un prêt.

**Politique de confidentialité** : https://vrm.center/legal/confidentialite.html

## Images

- Icône 128×128 : `vinted-sync-extension/icon-128.png`
- Captures 1280×800 : `docs/chrome-web-store/capture-*.png` (données inventées, aucune donnée réelle)
- Vignette promotionnelle 440×280 : `docs/chrome-web-store/vignette-440x280.png`
