# Publier l'extension VRM — pas à pas (31 octobre 2026, version 5.293.0)

Vérifié avant de livrer : 194 audits verts ; validateur officiel de Mozilla
(addons-linter 10.15) : 0 erreur, 0 avertissement, 0 remarque ; bancs pont,
popup, deux-extensions, session-reveil, extension-leboncoin-installee,
republier, relais-telephone verts. Le détail technique (texte pour le
relecteur, données collectées) : `docs/boutiques-extension.md` §3.

Les fichiers : `VRM-firefox.zip` (boutique Firefox → iPhone avec Orion,
Firefox ordinateur et Android) · `VRM-chromium.zip` (Chrome Web Store → Chrome,
Edge, Brave, Opera, et Orion) · `VRM-tuile-440x280.png` et
`VRM-capture-1280x800.png` (images demandées par Chrome). Fabriqués par
`node scripts/zip-extension.cjs --firefox VRM-firefox.zip --store VRM-chromium.zip`.

## 0. Avant tout (une fois)

- Une **adresse email de contact** pour VRM : les deux boutiques l'exigent.
  La poser aussi dans `src/contact.js` et `public/legal/editeur.js` (champ `email`).
- La politique de confidentialité est en ligne :
  https://vrm.center/legal/confidentialite.html (les champs de l'éditeur encore
  vides y sont marqués « à compléter » ; un relecteur peut le relever).
- Tout se fait **sur l'ordinateur**.

## 1. Boutique Firefox (gratuite) — c'est elle qui sert l'iPhone

1. https://addons.mozilla.org/developers/ → **Se connecter** → créer un compte
   Mozilla (email + mot de passe), confirmer l'email reçu.
2. **Soumettre un nouveau module**.
3. « Comment voulez-vous distribuer cette version ? » → **Sur ce site**.
4. **Sélectionner un fichier** → `VRM-firefox.zip` → attendre la validation
   automatique (vert) → cocher **Firefox** et **Firefox pour Android** → Continuer.
5. « Code source » : **Non** (le code n'est pas minifié).
6. Fiche :
   - Nom : `VRM — outil du revendeur`
   - Résumé : `Relie tes comptes Vinted, Leboncoin et eBay à VRM : tes annonces, ventes, colis et bordereaux arrivent dans ton tableau de bord, depuis ton navigateur. Il faut un compte VRM (vrm.center).`
   - Catégories : **Boutiques et achats** (+ Productivité).
   - Email d'assistance : l'adresse de l'étape 0. Site : `https://vrm.center`
   - Licence : **Tous droits réservés**.
   - Politique de confidentialité : coller le lien ci-dessus.
   - Notes pour le relecteur : copier le bloc « Notes pour le relecteur » de
     `docs/boutiques-extension.md` §3.
7. **Envoyer la version**. Mozilla relit : de quelques heures à quelques jours,
   un email arrive à l'acceptation.
8. Une fois acceptée : sur l'iPhone, dans **Orion**, ouvrir la fiche VRM sur
   addons.mozilla.org → **Ajouter à Firefox** → accepter les autorisations
   (comme Dark Reader). Envoyer le lien de la fiche à Claude : il va dans
   `LIENS_BOUTIQUES.firefox` (`src/navigateurExtension.js`).

## 2. Chrome Web Store (5 $ une fois) — ordinateurs, et Orion aussi

1. https://chrome.google.com/webstore/devconsole → se connecter avec un compte
   Google → accepter le contrat → payer **5 $** (une seule fois) → confirmer
   l'email de contact.
2. **Nouvel élément** → `VRM-chromium.zip`.
3. Onglet **Fiche Play Store / Store listing** :
   - Description : le texte « Description » de `docs/boutiques-extension.md` §3.
   - Catégorie : **Shopping** · Langue : **Français**.
   - Icône : déjà dans le paquet.
   - Capture d'écran : `VRM-capture-1280x800.png`.
   - Petite vignette promotionnelle : `VRM-tuile-440x280.png`.
   - Site officiel : `https://vrm.center`.
4. Onglet **Pratiques de confidentialité / Privacy** :
   - Objectif unique : `Relier les comptes Vinted, Leboncoin et eBay du vendeur à son compte VRM : lire ses annonces, ventes, colis et messages sur les pages qu'il ouvre, et les ranger dans son tableau de bord.`
   - Justification de chaque autorisation :
     - `cookies` : savoir quel compte Vinted est ouvert (cookies de session Vinted) pour ranger ses données sous ce compte.
     - `storage` : garder l'état local de l'extension (session VRM, files, compteurs de plafond).
     - `alarms` : tâches périodiques (relecture des comptes, entretien de la session).
     - `scripting` : exécuter des lectures dans l'onglet Vinted déjà ouvert par l'utilisateur.
     - `tabs` : trouver l'onglet Vinted ou VRM ouvert.
     - `downloads` : reconnaître un bordereau PDF téléchargé par l'utilisateur.
     - Accès aux sites : Vinted, Leboncoin, eBay, Vestiaire Collective (pages ouvertes par l'utilisateur), la base de VRM et vrm.center, et les pages de suivi Mondial Relay, Chronopost et Vinted Go (statut des colis attendus).
   - Code distant : **Non**.
   - Données collectées : cocher **Informations d'authentification**,
     **Informations personnelles**, **Communications personnelles**,
     **Informations financières et de paiement**, **Activité sur le site Web**,
     **Contenu du site Web** ; puis cocher les trois déclarations (pas de vente
     des données, pas d'usage hors de l'objectif, pas d'évaluation de crédit).
   - Politique de confidentialité : le lien de l'étape 0.
5. Onglet **Distribution** : **Public** (ou **Non répertorié** : seulement
   par lien).
6. **Envoyer pour examen**. Google relit : souvent quelques jours (plus long
   avec l'accès aux cookies).
7. Une fois acceptée : envoyer le lien à Claude (`LIENS_BOUTIQUES.chrome`).
   Les mises à jour arrivent alors toutes seules sur chaque ordinateur.

## 3. Après chaque nouvelle version

Claude fabrique les deux zips ; dans chaque boutique : fiche de l'extension →
**Nouvelle version / Importer un nouveau package** → le zip → Envoyer.
