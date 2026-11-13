# Mettre VRM sur le Chrome Web Store (et Edge) — le pas-à-pas de Julien

> 12 nov. 2026 · lot `agent2-ext-boutique` (extension 5.371.0).
> **But** : installée depuis une boutique, l'extension se met à jour **toute seule**.
> Plus de zip à remplacer, plus de ⟳ dans chaque Chrome.
> **Personne d'autre que toi ne peut publier** : il faut ton compte Google et ton paiement.
> Rien n'a été envoyé par Claude.

Les textes à coller sont dans `docs/boutiques/chrome-web-store.md` (Chrome) et
`docs/boutiques/edge.md` (Edge). Ce fichier-ci dit **où cliquer**, dans l'ordre.
Compte une heure la première fois (sans l'attente de l'examen).

---

## 0. Avant de commencer (une fois, 15 min)

Sans ces trois choses, Google refuse la fiche à coup sûr.

1. **Les mentions de l'éditeur** : remplir `public/legal/editeur.js` (nom, adresse, SIRET, e-mail…)
   et `src/contact.js` (l'adresse de contact). Demande-le à une session Claude : « remplis editeur.js
   avec … ». La politique de l'extension (https://vrm.center/legal/extension.html) affiche ces champs ;
   vides, elle a des blancs ⇒ refus.
2. **Vérifier que la politique répond** : ouvre https://vrm.center/legal/extension.html dans Chrome.
   Tu dois voir « Extension VRM — confidentialité » et ton nom d'éditeur.
3. **Un compte VRM de démonstration pour l'examinateur** (important) : l'extension ne fait rien sans
   compte VRM. L'examinateur de Google doit pouvoir se connecter, sinon il refuse avec « fonctionnalité
   impossible à vérifier ». Crée sur vrm.center un compte **vide** (une adresse à toi, par ex.
   `demo-boutique@…`), un mot de passe simple, et active-lui l'accès (abonnement d'essai). Ne mets
   **aucune** vraie donnée dedans. (C'est le même que `VRM_DEMO_EMAIL` du contrôle « comme un vrai client »
   si tu l'as déjà créé.)
4. **Le paquet** : demande à une session Claude « fabrique les paquets des boutiques ». Elle lance
   `node scripts/paquets-boutiques.cjs` puis `node scripts/audit-paquets-boutiques.cjs` (tout vert) et
   te donne `VRM-5.371.0-chrome.zip` (et `-edge.zip`, `-firefox.zip`). ⚠️ C'est **ce** zip-là qu'on
   envoie, pas `VRM-extension.zip` (celui-là a un dossier dedans : la boutique le refuse).

---

## 1. Créer le compte développeur Chrome (5 $, une seule fois)

1. Ouvre https://chrome.google.com/webstore/devconsole avec **ton** compte Google (celui que tu garderas :
   on ne change pas de compte plus tard sans tout republier).
2. Google demande d'avoir la **validation en deux étapes** sur ce compte. Si elle n'est pas activée :
   https://myaccount.google.com/security → « Validation en deux étapes » → l'activer (ton téléphone).
3. Retour à la console : coche **« J'accepte le contrat du développeur »** → **« Accepter et continuer »**.
4. **Payer les frais d'inscription : 5 $** (une seule fois, carte bancaire, par Google Payments).
   Le reçu arrive par e-mail.
5. **Compte → « Adresse e-mail de contact »** : mets l'adresse de `src/contact.js` → Google envoie un
   lien → **clique-le** (sans ça, le bouton « Publier » reste gris).
6. **Compte → « Statut de commerçant »** (règle européenne, DSA) : VRM vend un abonnement ⇒ choisis
   **« Je suis un commerçant »** (« Trader »). Google demande alors, **affichés publiquement sur la
   fiche** : nom ou raison sociale, adresse, e-mail, téléphone. Mets ceux de `editeur.js` (les mêmes
   partout). Google peut demander une **vérification d'identité** (pièce d'identité, quelques jours).
7. **Nom de l'éditeur** (« Publisher name ») : `VRM` (c'est ce qu'on lit sous le nom de l'extension).

---

## 2. Envoyer le paquet

1. Console → **« Nouvel élément »** (bouton bleu en haut à droite, « + New item »).
2. **Choisir un fichier** → `VRM-5.371.0-chrome.zip` → **« Importer »**.
3. Google lit le zip. Si un message rouge dit « manifest » : n'insiste pas, envoie la capture à une
   session Claude. Sinon la fiche s'ouvre, avec un **identifiant de 32 lettres** (de a à p) en haut :
   **note-le**, c'est l'ID de l'extension sur la boutique (§6).

Le nom (« VRM — outil du revendeur ») et le résumé sont **lus dans le paquet** : tu ne les tapes pas.

---

## 3. Onglet « Fiche Play Store » (Store listing) — champ par champ

| champ | quoi mettre |
|---|---|
| **Description** | coller le bloc « Description » de `docs/boutiques/chrome-web-store.md` (entre les repères `description`) |
| **Catégorie** | « Outils » (Tools) ; sinon « Productivité ». Jamais « Shopping ». |
| **Langue** | Français |
| **Icône de la boutique** | `vinted-sync-extension/icon-128.png` (128 × 128) |
| **Vidéo** | rien |
| **Captures d'écran** | les 5 de `docs/boutiques/visuels/` : `capture-1-journee.png` … `capture-5-extension.png` (1280 × 800, données INVENTÉES, bandeau « Exemple ») — dans cet ordre |
| **Petite tuile promotionnelle** | `docs/boutiques/visuels/tuile-440x280.png` |
| **Tuile marquee** | `tuile-1400x560.png` (facultatif) |
| **URL officielle** | laisser vide (elle exige de prouver vrm.center dans Google Search Console ; on peut le faire plus tard) |
| **Page d'accueil** | `https://vrm.center` |
| **URL d'assistance** | `https://vrm.center/legal/mentions-legales.html` (ou l'adresse de contact) |
| **Contenu pour adultes** | Non |

→ **« Enregistrer le brouillon »** (en haut à droite).

---

## 4. Onglet « Pratiques de confidentialité » (Privacy) — champ par champ

C'est l'onglet que l'examinateur lit le plus. Tout est dans `docs/boutiques/chrome-web-store.md`,
à coller **tel quel** (chaque phrase est vraie d'après le code ; `audit-paquets-boutiques` vérifie
qu'aucune autorisation ni aucun site n'y manque).

1. **Description de l'objectif unique** : le bloc « Objectif unique ».
2. **Justification des autorisations** : une case par autorisation, dans cet ordre :
   `cookies`, `storage`, `alarms`, `scripting`, `tabs`, `downloads`, `contextMenus` → la phrase du tableau.
3. **Justification de l'autorisation d'hôte** : une seule case ⇒ coller tout le tableau des hôtes en texte,
   une ligne par site (« vinted.fr, .com, .it, .de : … »).
4. **Utilisez-vous du code distant ?** → **« Non, je n'utilise pas de code distant »**.
5. **Utilisation des données** : cocher exactement les cases du tableau (identifiant personnel, finances,
   authentification, communications, activité de l'utilisateur, contenu du site) ; **ne pas** cocher
   santé, position, historique Web.
6. **Les 3 certifications** : cocher les trois.
7. **URL des règles de confidentialité** : `https://vrm.center/legal/extension.html`
8. **Enregistrer le brouillon.**

---

## 5. Onglet « Distribution », puis « Instructions de test », puis envoi

**Distribution**
- **Paiements** : « Gratuit » (l'abonnement se paie sur vrm.center, pas dans la boutique).
- **Visibilité** : **« Non répertoriée »** au début (seuls ceux qui ont le lien la trouvent). On passera
  en « Publique » quand tout tourne chez toi.
- **Régions** : toutes.

**Instructions de test** (onglet « Test instructions » s'il est là ; sinon dans « Notes à l'examinateur »).
Coller, en remplaçant l'e-mail et le mot de passe par ceux du compte de démonstration (§0.3) :

> VRM is a management tool for second-hand sellers (https://vrm.center). The extension only works with a
> VRM account. Test account: e-mail `…`, password `…`.
> 1. Install the extension, open https://www.vinted.fr (any page). A small VRM logo appears bottom-right.
> 2. Click it and sign in with the test account above. The card shows the VRM account and the Vinted
>    account (if you are logged in to Vinted).
> 3. Without a Vinted seller account, the extension only reads and shows status; it never acts on its own.
>    Every write action (reply, offer, relist, price change) is started by the user from vrm.center, runs
>    only for the account logged in the current tab, at most 50 actions per hour, one request at a time,
>    and stops when the site asks to slow down. The two automatic features (accept offers above a minimum
>    price, message to users who favourite an item) are OFF by default.
> Privacy policy: https://vrm.center/legal/extension.html

(En anglais : les examinateurs de Google lisent l'anglais en premier.)

**Envoyer** : bouton **« Envoyer pour examen »** (« Submit for review ») en haut à droite → une fenêtre
demande « Publier automatiquement après l'examen ? » → **décoche** (tu publieras toi-même, une fois prévenu).

L'examen prend **de quelques jours à 3 semaines** la première fois (cookies + beaucoup de sites
⇒ examen approfondi). Google écrit à l'adresse de contact.

---

## 6. Quand Google a validé

1. Console → l'élément → **« Publier »** (si tu avais décoché la publication automatique).
2. L'adresse de la fiche est `https://chromewebstore.google.com/detail/<l'identifiant de 32 lettres>`.
   **Donne-la à une session Claude** : « pose ce lien dans LIENS_BOUTIQUES.chrome ».
   Dès que c'est en ligne, l'app propose **« Installer depuis le Chrome Web Store »** au lieu du zip
   (Chrome, Brave, Vivaldi, Arc) ; le zip reste proposé en second (« Installer à la main »), et Orion
   garde son fichier.
3. **Chez toi, dans CHAQUE Chrome** :
   1. installe depuis la fiche (« Ajouter à Chrome ») ;
   2. ouvre `chrome://extensions` et **supprime l'ancienne copie** (celle marquée « Extension non empaquetée »).
      ⚠️ Deux extensions VRM dans le même Chrome : l'app coupe les commandes (elle ne sait pas à laquelle parler).
   3. ouvre vrm.center : l'extension se reconnecte toute seule.
4. Ensuite, **chaque nouvelle version** : une session Claude fabrique le paquet ; toi tu fais
   Console → l'élément → **« Package » → « Importer un nouveau package »** → le zip → **« Envoyer pour
   examen »**. Rien d'autre à remplir si aucune autorisation n'a changé. Les extensions installées se
   mettent à jour **seules** dans les heures qui suivent la validation.

---

## 7. Microsoft Edge Add-ons (gratuit, même paquet)

1. https://partner.microsoft.com/dashboard/microsoftedge/ → **« S'inscrire »** avec un compte Microsoft
   (Outlook, Hotmail…) → type de compte **« Individuel »** (ou « Société » si tu as une société) → **gratuit**.
   Microsoft vérifie l'adresse e-mail (et parfois l'identité, quelques jours).
2. **« Create new extension »** → déposer `VRM-5.371.0-edge.zip`.
3. **Availability** : « Hidden » au début · tous les marchés.
4. **Properties** : catégorie « Productivity », site `https://vrm.center`, contact = `src/contact.js`.
5. **Privacy** : mêmes textes que Chrome (`docs/boutiques/edge.md`) ; URL de la politique identique.
6. **Store listings → Français** : description (250 à 10 000 caractères, le texte de `edge.md` y entre),
   logo 300 × 300 (`docs/boutiques/visuels/logo-300x300.png`), les mêmes captures, petite tuile.
7. **Notes for certification** : les mêmes instructions de test (compte de démonstration).
8. **Publish**. Examen : jusqu'à 7 jours ouvrés.
9. Validée : donne l'adresse `https://microsoftedge.microsoft.com/addons/detail/…` à une session Claude
   (`LIENS_BOUTIQUES.edge`).

---

## 8. Ce que fait l'app ensuite (rien à faire de ton côté)

- **Installer** : `installerExtensionIci()` (`src/navigateurExtension.js`) propose la fiche du navigateur
  d'ici dès que `LIENS_BOUTIQUES` la connaît ; vide ⇒ le zip, comme aujourd'hui. Jamais un lien deviné.
- **« Nouvelle version disponible »** (5.371) : la carte du logo et la fenêtre de l'extension comparent la
  version installée à celle que vrm.center sert (`/extension-version.json`, la même que `EXT_ATTENDUE`).
  - installée **à la main** (zip) et plus ancienne ⇒ « Nouvelle version disponible » + **« Télécharger »**
    et 3 étapes courtes (dézipper · remplacer le dossier · ⟳) ;
  - installée **depuis une boutique** ⇒ **rien à faire** : la carte n'affiche rien, l'extension demande
    elle-même à la boutique de vérifier (`requestUpdateCheck`).
- **Tant que la boutique n'a pas validé** une nouvelle version, l'app peut dire « extension en retard » :
  c'est normal, ça part tout seul après la validation.

---

## 9. Le risque de refus — honnêtement

**Il existe.** L'extension agit sur des sites tiers (Vinted, Leboncoin, Vestiaire, eBay) : elle lit des
pages de ces sites et, sur ton ordre, envoie des actions (répondre, offre, republier, baisser un prix).
Google refuse parfois ce genre d'extension pour deux motifs :

| motif possible | ce que la fiche répond (vrai d'après le code) |
|---|---|
| « Objectif unique » jugé trop large | Un seul objectif : relier **tes propres** comptes de vente à ton espace VRM (lire ton activité, faire les gestes que **tu** commandes). Rien pour d'autres sites, rien pour d'autres comptes. |
| Automatisation / « spam » sur un site tiers | Chaque geste part de **ton clic** dans VRM ; seulement au nom du **compte connecté dans l'onglet** ; **50 actions par heure** et **200 par jour** au plus par compte, une requête à la fois, arrêt net si le site demande une pause ou une vérification ; les deux automatismes (offres au-dessus de TON prix mini, message aux favoris) sont **éteints par défaut**. Aucun clic simulé, aucun mot de passe lu. |
| Autorisations larges (`cookies`, beaucoup de sites, `*.amazonaws.com`) | Chaque autorisation et chaque site justifié en une phrase ; aucune `<all_urls>` ; `amazonaws.com` = les bordereaux PDF de Vinted sont stockés sur Amazon S3 (sans lui, plus de bordereau). |
| Données envoyées hors de l'appareil | Uniquement dans **ton** espace VRM (vrm.center et sa base) ; déclaré dans « Utilisation des données » ; politique dédiée. |
| Fonction impossible à tester | Le compte de démonstration (§0.3) et les instructions de test (§5). |

**Si Google refuse** : l'e-mail cite une règle (« Violation : … »). Ne réponds rien tout de suite :
copie l'e-mail entier à une session Claude. Le plus souvent il suffit de préciser un texte ou de retirer
une autorisation, puis de renvoyer (« Envoyer à nouveau pour examen »). Pendant ce temps **le zip continue
de marcher exactement comme aujourd'hui** : rien n'est cassé par un refus.

**Ce qu'on ne fera jamais pour passer l'examen** : cacher une fonction à l'examinateur, ou envoyer à la
boutique un code différent de celui qui est servi (`audit-paquets-boutiques` vérifie que c'est le même,
octet pour octet).

⚠️ **Plus tard** : une mise à jour qui **ajoute** une autorisation ou un site désactive l'extension chez
chaque vendeur jusqu'à ce qu'il accepte. Tout ce qui est prévu doit donc être dans la **première** version
publiée ; une session qui veut ajouter un site doit le dire avant.
