# Ouvrir les paiements — le guide pas à pas (12 novembre 2026)

> Pour Julien. Chaque étape dit **où cliquer**, **quoi copier**, **où le coller**.
> Dans VRM, **Paramètres → Réglages → « Ouvrir les paiements »** (toi seul la vois)
> montre la même liste avec ✓ / À faire / — : chaque ✓ est **relu** (Vercel, Stripe,
> les fichiers), jamais deviné. Touche une ligne pour savoir où cliquer.
> Touche **Revérifier** après chaque étape.
>
> ⚠️ Ne colle **jamais** une clé secrète (`sk_…`, `whsec_…`) dans une conversation,
> un e-mail ou un fichier du dépôt (il est **public**). Seulement dans Vercel.

## 0. Où en est-on (mesuré le 12 nov., lecture seule)

| prérequis | état | d'où ça vient |
|---|---|---|
| Mentions légales (`public/legal/editeur.js`) | **9 champs vides sur 10** (seul l'e-mail est rempli) | le fichier du dépôt |
| Adresse de contact (`src/contact.js`) | remplie, la même que dans `editeur.js` | les deux fichiers |
| CGV et rétractation | à jour : Solo 16,99 €, Pro 19,99 €, essai 7 jours, parrainage, rétractation | `public/legal/cgv.html` |
| `STRIPE_SECRET_KEY` (Vercel) | **absente** | liste des variables Vercel (noms seulement) |
| `STRIPE_WEBHOOK_SECRET` (Vercel) | présente — c'est celle d'un webhook **de test** | idem (commentaire de la variable) |
| `STRIPE_PRICE_LOOKUP` (Vercel) | `vrm_mensuel` (bon) | idem |
| `STRIPE_PRIX_PRO` (Vercel) | **absente** | idem |
| Prix Stripe Solo 16,99 € / Pro 19,99 € | pas vérifiable sans la clé | Stripe |
| Mode réel | non (tout est en test) | — |
| `abonnement_obligatoire` (base) | `0` : personne n'est bloqué | `vrm_reglages` |

Tant qu'une ligne manque, **personne ne peut payer** : le bouton « S'abonner » ne
s'affiche pas, et le serveur refuse d'ouvrir un paiement (« rien n'a été prélevé »).

---

## 1. Les mentions légales — `public/legal/editeur.js` (⏱ 15 min)

La loi (LCEN art. 6-III, Code de la consommation L111-1, L221-5, L612-1) exige ces
informations **avant** de vendre un abonnement. Personne ne les remplit à ta place.

**Ce qu'il faut, champ par champ** (ce qui est écrit dans tes papiers d'entreprise) :

| champ | ce qu'on y met | où le trouver |
|---|---|---|
| `nom` | ta raison sociale, ou « Prénom Nom (entrepreneur individuel) » | ton extrait INSEE / avis de situation |
| `forme` | ex. « Entrepreneur individuel (micro-entreprise) » ou « SAS au capital de 1 000 € » | idem |
| `adresse` | l'adresse du siège (ou de domiciliation) | idem |
| `siret` | 14 chiffres | annuaire-entreprises.data.gouv.fr |
| `rcs` | « RCS Ville 123 456 789 » ou « non inscrit au RCS » (micro-entrepreneur non commerçant) | Kbis, ou rien |
| `tva` | ton n° de TVA intracommunautaire, ou « TVA non applicable, art. 293 B du CGI » (franchise) | impots.gouv.fr → espace pro |
| `email` | ✓ déjà rempli (même adresse que `src/contact.js`) | — |
| `telephone` | un numéro où l'on peut te joindre (obligatoire pour une activité commerciale) | — |
| `directeur` | le directeur de la publication : toi, en général | — |
| `mediateur` | le médiateur de la consommation : **nom + site web** (obligatoire, art. L612-1) | adhérer à un médiateur (ex. CM2C, Medicys, CNPM : quelques dizaines d'euros par an) |

L'hébergeur (Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis)
est déjà écrit dans `public/legal/mentions-legales.html` : rien à faire.

**Le geste** : envoie ces 9 valeurs à Claude dans une session (« remplis editeur.js
avec : … ») — il les écrit entre guillemets, sans rien inventer. Ou, sur GitHub :
`public/legal/editeur.js` → crayon → remplace chaque `null` par `"ta valeur"` →
Commit. Puis attends le déploiement (2 min) et touche **Revérifier**.

## 2. L'adresse de contact — `src/contact.js` (déjà fait)

Elle reçoit les questions des clients et les demandes RGPD (la politique de
confidentialité y renvoie, avec une réponse sous **un mois**). Si tu la changes un
jour : la même dans `src/contact.js` **et** dans le champ `email` d'`editeur.js`
(sinon la ligne passe « À faire » : « mets la même adresse aux deux endroits »).

## 3. Les CGV (déjà à jour — à faire relire)

`vrm.center/legal/cgv.html` dit : Solo 16,99 €/mois (1 compte vendeur par
plateforme, comptes d'achat illimités), Pro 19,99 €/mois (comptes vendeurs
illimités), essai gratuit 7 jours une seule fois, parrainage (un mois offert à
chacun au premier paiement réel), rétractation 14 jours et son formulaire
(`/legal/retractation.html`). VRM vérifie que ces mots y sont.
**Conseillé avant le mode réel** : une relecture par un juriste (CGV + formulaire).

## 4. Stripe, en MODE TEST d'abord (⏱ 30 min)

Va sur **https://dashboard.stripe.com** et vérifie en haut à droite que
l'interrupteur **« Mode test »** est **allumé** (bandeau orange).

### 4a. Les deux prix
1. Menu de gauche → **Catalogue de produits** → **+ Ajouter un produit**.
2. Nom : `VRM Solo`. Dans « Tarif » : **Récurrent**, **16,99**, **EUR**, **Mensuel**.
3. Déplie **« Options supplémentaires »** (ou « Avancé ») → **Clé de recherche
   (lookup key)** : tape exactement `vrm_mensuel`. S'il dit qu'elle est déjà prise
   par un ancien prix (9,99 € ou 12,99 €) : coche **« Transférer la clé de
   recherche »**. → **Enregistrer le produit**.
4. Recommence : **+ Ajouter un produit** → `VRM Pro` → Récurrent **19,99** EUR
   Mensuel → clé de recherche `vrm_pro_mensuel` → Enregistrer.
5. Ouvre le produit **VRM Pro** → dans « Tarifs », clique le prix → en haut, l'**ID
   du tarif** commence par `price_…` → bouton copier. Garde-le pour l'étape 5.
6. (Si un ancien prix 9,99 € / 12,99 € existe encore : ouvre-le → **⋯** → **Archiver**.)

### 4b. La clé secrète
Menu **Développeurs** (en bas à gauche) → **Clés API** → **Clé secrète**
(`sk_test_…`) → **Révéler** → copier.

### 4c. Le webhook (ce qui dit à VRM « il a payé »)
**Développeurs → Webhooks** (ou « Destinations d'événements ») :
- S'il existe déjà un point vers `https://vrm.center/api/stripe-webhook` (c'est le
  cas en test) : ouvre-le → **Modifier** → vérifie les 5 événements ci-dessous.
- Sinon : **+ Ajouter une destination / un endpoint** → URL
  `https://vrm.center/api/stripe-webhook`.
- **Événements à envoyer** (exactement ces 5) :
  `checkout.session.completed`, `customer.subscription.created`,
  `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`.
  (Sans `invoice.paid`, le mois offert du parrainage n'est jamais crédité ; VRM le
  signale.)
- Sur la page du point : **Secret de signature** → **Révéler** → copier (`whsec_…`).

### 4d. Les CGV dans Stripe (2 min)
**Paramètres** (roue dentée) → **Détails publics** (ou « Informations publiques ») →
**Conditions d'utilisation / CGV** : `https://vrm.center/legal/cgv.html` →
Enregistrer. (VRM fait déjà accepter ses CGV avant de payer ; ceci ajoute la case
sur la page Stripe.)

## 5. Vercel (⏱ 10 min)

**https://vercel.com** → projet **cancale-v67** → **Settings** → **Environment
Variables**. Pour chacune : **Add New** (ou ⋯ → **Edit** si elle existe), cible
**Production**, coller la valeur, **Save** :

| nom | valeur |
|---|---|
| `STRIPE_SECRET_KEY` | la clé `sk_test_…` (4b) |
| `STRIPE_WEBHOOK_SECRET` | le `whsec_…` (4c) — remplace l'ancien s'il a changé |
| `STRIPE_PRIX_PRO` | le `price_…` du Pro (4a, point 5) — ou simplement `vrm_pro_mensuel` |

Puis **Deployments** → le dernier → **⋯** → **Redeploy** (les variables ne servent
qu'après un redéploiement). Attends « Ready ».

Dans VRM → **Ouvrir les paiements** → **Revérifier** : clé ✓ (« Clé de test »),
prix Solo ✓, prix Pro ✓, secret ✓, webhook ✓. Si une ligne reste « À faire », son
texte dit pourquoi (ex. « Stripe dit 12,99 € / mois : recrée le prix »).

## 6. L'essai complet en test (⏱ 15 min)

1. Crée un compte VRM d'essai avec une **autre** adresse e-mail (navigation privée).
2. Paramètres → **Abonnement** → coche les deux cases → **Commencer l'essai gratuit**.
3. Sur la page Stripe : carte **4242 4242 4242 4242**, date future (12/30), CVC 123,
   n'importe quel nom → **S'abonner**.
4. Retour dans VRM : « **Encore 7 jours d'essai** ». Dans Stripe → **Webhooks** →
   ton point : les événements sont en **200** (vert).
5. Stripe → **Clients** → ce client → l'abonnement → **Actions** → « Mettre fin à
   l'essai maintenant » : VRM passe à « **Abonné · 16,99 € / mois** ».
6. Dans VRM : **Résilier** (deux touchers) → « Fin le … ».
7. Le banc `scripts/bancs/paiement-bout-en-bout.cjs` joue tout ce chemin (et le
   parrainage, Solo/Pro, la fin d'abonnement en aperçu flouté) avec un Stripe
   simulé — il est vert.

## 7. Passer en MODE RÉEL (⏱ 30 min + validation Stripe)

1. Stripe → **Activer le compte** (en haut) : informations de l'entreprise (les
   mêmes que dans `editeur.js`), IBAN pour les virements, pièce d'identité.
   Attends la validation.
2. **Éteins** l'interrupteur « Mode test ».
3. Refais **4a** (les deux prix, mêmes clés de recherche), **4b** (clé `sk_live_…`),
   **4c** (le webhook réel, nouveau `whsec_…`), **4d**.
4. Vercel : remplace `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
   `STRIPE_PRIX_PRO` par les valeurs **réelles** → **Redeploy**.
5. VRM → Ouvrir les paiements → **Revérifier** : « Mode réel ✓ » et le titre
   devient « **Paiements ouverts aux clients** ».
6. Dis à Claude : « **ouvre Pro sur l'accueil** » (la page d'accueil dit encore
   « bientôt » pour Pro, `PRO_OUVERT`).
7. Premier paiement réel avec **ta** carte, puis **rembourse-le** : Stripe →
   **Paiements** → ce paiement → **Rembourser**.
8. Quand tu veux que l'abonnement soit **obligatoire** pour les nouveaux comptes :
   dis à Claude « passe abonnement_obligatoire à 1 » (une ligne de `vrm_reglages`).
   Avant, tout le monde utilise VRM gratuitement. Après, un compte sans abonnement
   voit « Bienvenue sur VRM » et l'offre (essai de 7 jours), le reste flouté.

## 8. Ce que VRM fait déjà tout seul

- Refuse d'ouvrir un paiement tant que les mentions, le prix ou les CGV ne
  collent pas (« rien n'a été prélevé »).
- Fait accepter les CGV et l'accès immédiat **avant** Stripe, datés.
- Essai gratuit une seule fois par e-mail et par compte Vinted.
- Parrainage : un mois offert à chacun au premier paiement réel (jamais l'essai à
  0 €), jamais deux fois.
- Fin d'abonnement : un aperçu (3 premières lignes nettes, le reste flouté), rien
  n'est supprimé ; données gardées 12 mois puis effacées (prévenu à 11 mois).
- Chaque client peut **exporter toutes ses données** et **supprimer son compte**
  lui-même (Paramètres → Mon compte).
