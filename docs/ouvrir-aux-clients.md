# Ouvrir VRM aux clients — le pas-à-pas (6 novembre 2026)

Pour Julien. Chaque étape dit **pourquoi**, **où cliquer**, **quoi coller**,
**comment vérifier** et **combien de temps** ça prend. Tout a été relu dans le
code du jour (les chemins de fichier sont cités) ; ce qui n'a pas pu être vérifié
d'ici est dit à la fin, en toutes lettres.

> ⚠️ Ne colle **jamais** une clé secrète (Stripe, Supabase, SMTP) dans une
> conversation, ni dans un fichier du dépôt (il est **public**). Les clés vont
> seulement dans les tableaux de bord (Vercel, Supabase, GitHub, Stripe).

## L'ordre, et pourquoi cet ordre

| # | étape | durée | bloquant ? |
|---|---|---|---|
| 1 | Mentions légales (`editeur.js`) + relecture CGV / rétractation | 30 min + relecture | **oui** : le paiement reste fermé tant qu'un champ est vide |
| 2 | Supabase : adresses de retour, SMTP, confirmation, modèles | 45 min | **oui** : sans SMTP, aucun client ne reçoit l'e-mail de confirmation |
| 3 | Vercel Pro | 15 min | **oui** pour vendre (le plan gratuit interdit l'usage commercial) |
| 4 | Stripe : prix, clés, webhook, mode réel, essai réel | 1 h 30 | **oui** : c'est l'encaissement |
| 5 | Les variables d'environnement restantes (liste à cocher) | 30 min | en partie |
| 6 | Ouvrir le verrou « abonnement obligatoire » | 5 min | c'est LE geste qui fait payer |
| 7 | Boutiques d'extension (Chrome, Firefox, Edge) | 2 h + revue | non, mais un client n'installera pas un zip « mode développeur » |

Les étapes 1 à 4 peuvent se faire le même jour. L'étape 6 se fait **en dernier**,
quand l'essai réel de l'étape 4 est passé.

---

## 1. Les mentions légales — `public/legal/editeur.js` et `src/contact.js`

**Pourquoi.** Le serveur lit ce fichier avant d'ouvrir un paiement
(`api/_lib/mentions-legales.js`, appelé par `api/compte.js`, fonction `checkout`) :
tant qu'**un seul** des 10 champs de `VRM_EDITEUR_OBLIGATOIRES` est vide, il
répond « Le paiement n'est pas encore ouvert : rien n'a été prélevé » et n'appelle
même pas Stripe. Raison juridique (commentaire du fichier) : vendre un abonnement
sur des CGV qui ne disent ni qui vend ni où se rétracter prolonge le délai de
rétractation jusqu'à 12 mois (art. L221-20 du Code de la consommation).
Les cinq pages légales (`/legal/cgv.html`, `cgu.html`, `confidentialite.html`,
`mentions-legales.html`, `retractation.html`) affichent ces champs ; un champ vide
y apparaît surligné « à compléter : … ». Les boutiques d'extension (étape 7)
exigent aussi une politique de confidentialité complète.

**État aujourd'hui (lu dans le dépôt).** 1 champ rempli sur 10 : `email`
(`vrm.vinted35+contact@gmail.com`), et `src/contact.js` porte la même adresse
(`scripts/audit-lancement.cjs` exige que les deux soient identiques). **Neuf champs
restent à `null`.**

| champ | à quoi il sert | forme attendue pour une micro-entreprise (à remplir avec TES informations) |
|---|---|---|
| `nom` | qui vend (mentions, CGV) | « Prénom Nom (EI) » — un entrepreneur individuel fait suivre son nom de « EI » ou « entrepreneur individuel » |
| `forme` | forme juridique | « Entrepreneur individuel (micro-entreprise) » |
| `adresse` | adresse du siège | l'adresse déclarée à l'INSEE (une adresse de domiciliation si tu ne veux pas publier ton domicile) |
| `siret` | immatriculation | les 14 chiffres de ton avis de situation INSEE |
| `rcs` | registre | selon ton extrait du registre (RNE) : « RCS <Ville> <SIREN> » si tu es commerçant immatriculé, sinon la mention exacte qui figure sur ton extrait — ne pas deviner |
| `tva` | régime de TVA | en franchise : « TVA non applicable, art. 293 B du CGI » ; sinon ton n° FR… |
| `email` | contact, rétractation, RGPD | déjà rempli — à changer seulement si tu veux une autre adresse (et alors **aussi** dans `src/contact.js`) |
| `telephone` | obligatoire pour une activité commerciale (LCEN art. 6-III) | un numéro où l'on peut te joindre |
| `directeur` | directeur de la publication | toi : « Prénom Nom » |
| `mediateur` | médiateur de la consommation (art. L612-1) | « Nom du médiateur — adresse de son site ». Il faut **adhérer** à un médiateur agréé (liste officielle sur economie.gouv.fr, « Liste des médiateurs de la consommation ») ; l'adhésion est en général payante |

**Où.** Deux possibilités, la plus simple d'abord :
- demander à une session Claude : « remplis `public/legal/editeur.js` avec ces
  informations : … » en lui donnant les 9 valeurs (ce ne sont pas des secrets :
  elles seront publiques sur le site) ; elle vérifie, construit, pousse et déploie ;
- ou sur GitHub : `public/legal/editeur.js` → crayon « Edit » → remplacer chaque
  `null` par le texte **entre guillemets droits** `"…"` (une apostrophe dans le
  texte — « d'Exemple » — casse le fichier si on met des apostrophes autour), puis
  « Commit » sur une branche et une PR (règle du dépôt : on ne pousse pas sur `main`).

**Relecture CGV et rétractation.** `public/legal/cgv.html` dit : 16,99 € par mois,
sans engagement, essai gratuit de 7 jours une fois par adresse e-mail et par compte
Vinted ; `public/legal/retractation.html` porte le formulaire de rétractation. Les
faire relire par quelqu'un dont c'est le métier (avocat, juriste de la CCI, service
juridique de ta banque pro) **avant** l'étape 6. Points à leur montrer : le droit
de rétractation gardé au prorata (article 5), la demande d'accès immédiat cochée
dans l'app (`acces_immediat_demande_le`), le renouvellement automatique après l'essai.

**Vérifier.**
1. Ouvre https://vrm.center/legal/mentions-legales.html : plus aucun texte
   surligné « à compléter ».
2. VRM → Paramètres → Mon compte (toi, le propriétaire) : la carte ne dit plus
   « Le paiement reste fermé tant que les mentions légales sont incomplètes (…) ».

**Durée.** 30 min pour remplir (avec ton avis de situation INSEE sous la main),
plus le délai de la relecture juridique et de l'adhésion au médiateur.

---

## 2. Supabase — que chaque client reçoive ses e-mails de compte

**Pourquoi.** C'est le point le plus bloquant. La documentation de Supabase
(« Send emails with custom SMTP », lue le 6 nov.) dit que **sans SMTP
personnalisé, Supabase refuse d'envoyer un e-mail à une adresse qui n'est pas
membre de ton équipe Supabase** (« Email address not authorized ») et limite le
nombre d'envois par heure. Autrement dit : un client qui s'inscrit ne reçoit
**jamais** son lien de confirmation, ni son « mot de passe oublié ».

### 2a. Les adresses de retour (5 min)
Tableau de bord Supabase → ton projet → **Authentication** → **URL Configuration**.
- **Site URL** : `https://vrm.center`
- **Redirect URLs** → « Add URL », ajoute ces deux lignes :
  - `https://vrm.center`
  - `https://vrm.center/**`

Pourquoi ces deux-là (lu dans `src/App.jsx`, `avecRetour` et `oauthStart`, et
`src/auth/liaisonOAuth.js`) : l'app demande le retour sur `https://vrm.center`
(inscription, renvoi du lien, lien de connexion, changement d'adresse), sur
`https://vrm.center/recuperation.html` (mot de passe oublié), sur
`https://vrm.center/` (Google / Discord) et sur
`https://vrm.center/?tab=settings&vue=compte` (relier Google à un compte). `/**`
couvre les trois derniers. Sans elles, Supabase renvoie vers son « Site URL »
(c'est ce qui a envoyé une inscription réelle vers `http://localhost:3000` le
5 octobre). Garde les URL déjà présentes si tu en vois.

**Vérifier** : demande « Mot de passe oublié » avec ton adresse : le lien reçu
ouvre `vrm.center/recuperation.html`.

### 2b. Le SMTP personnalisé (20 min)
**Authentication** → **Emails** → onglet **SMTP Settings** → « Enable Custom SMTP ».
Les champs : *Sender email*, *Sender name* (`VRM`), *Host*, *Port*, *Username*,
*Password*, *Minimum interval between emails*.

Deux fournisseurs simples, sans payer à l'usage (§2.9) :

| | Brevo (conseillé) | Ton Gmail + mot de passe d'application |
|---|---|---|
| gratuit | 300 e-mails / jour (offre gratuite de Brevo) | limité par Google (de l'ordre de 500 destinataires / jour pour un compte personnel) |
| Host | `smtp-relay.brevo.com` | `smtp.gmail.com` |
| Port | `587` | `465` |
| Username | l'identifiant SMTP affiché par Brevo (Paramètres → SMTP & API) | ton adresse Gmail |
| Password | une **clé SMTP** créée dans Brevo (pas ton mot de passe) | un **mot de passe d'application** (Compte Google → Sécurité → Validation en deux étapes activée → Mots de passe des applications) |
| Sender email | une adresse **vérifiée** dans Brevo (Expéditeurs) | la même adresse Gmail |

Brevo est meilleur pour des clients (expéditeur dédié, réputation séparée de ta
boîte perso). Le jour où tu as un nom de domaine pour les e-mails, ajoute-le dans
Brevo (SPF, DKIM) : les e-mails tombent moins en indésirables.

Après l'enregistrement, Supabase impose **30 e-mails / heure** au départ
(documentation Supabase) : **Authentication** → **Rate Limits** → monte la limite
d'e-mails (par exemple 100 / heure) pour ne pas bloquer un afflux d'inscriptions.

**Vérifier** : crée un compte VRM avec une adresse qui n'est pas dans ton équipe
Supabase (une adresse d'un proche) : l'e-mail de confirmation arrive en moins
d'une minute, expéditeur « VRM ».

### 2c. La confirmation d'e-mail obligatoire (2 min)
**Authentication** → **Sign In / Providers** → **Email** → « Confirm email »
**allumé**. Sans elle, n'importe qui peut s'inscrire avec l'adresse d'un autre.
L'app sait déjà gérer les deux cas (`confirmRequired`, `mailer_autoconfirm`).
**Vérifier** : à l'inscription, l'écran dit « regarde ta boîte » et la connexion
est refusée tant que le lien n'est pas cliqué.

### 2d. Les modèles d'e-mail en français (10 min)
**Authentication** → **Emails** → **Templates** :
- **Confirm signup** : objet `VRM — Confirme ton adresse email`, corps = le contenu
  de `supabase/templates/confirmation.html` (garde `{{ .ConfirmationURL }}`).
- **Reset Password** : objet `VRM — Réinitialiser ton mot de passe`, corps =
  `supabase/templates/recovery.html` (il mène à `/recuperation.html`).
- **Magic Link** (lien de connexion sans mot de passe) : aucun modèle dans le
  dépôt ; traduis l'objet (« VRM — Ton lien de connexion ») et le texte en gardant
  `{{ .ConfirmationURL }}`.
- (Option) **Change Email Address** : même principe.

Le script `scripts/configurer-auth-production.mjs` sait poser 2a et 2d d'un coup
avec un jeton d'administration Supabase — c'est plus rapide pour une session
Claude, mais le tableau de bord suffit.

**Durée de l'étape 2 :** 45 min.

---

## 3. Vercel Pro

**Pourquoi.**
- **Les conditions du plan gratuit (Hobby)** : « Hobby teams are restricted to
  non-commercial personal use only. All commercial usage of the platform requires
  either a Pro or Enterprise plan » — page *Fair use guidelines*
  (https://vercel.com/docs/limits/fair-use-guidelines) ; les conditions générales
  (https://vercel.com/terms) le redisent. Encaisser des abonnements sur vrm.center
  est un usage commercial.
- **12 fonctions au plus** par déploiement sur Hobby (message d'erreur de Vercel :
  « No more than 12 Serverless Functions can be added to a Deployment on the Hobby
  plan » ; documentation des fonctions : « Pro and Enterprise: No limit »). Le dépôt
  est exactement à 12 (`api/*.js`) et `scripts/audit-fonctions-api.cjs` refuse
  d'en ajouter une treizième.
- **Skew Protection** (https://vercel.com/docs/skew-protection) : garder les
  fichiers de l'ancienne version servis après un déploiement, pour qu'un onglet
  resté ouvert ne tombe pas sur un morceau disparu. Disponible sur **Pro et
  Enterprise seulement**, pas sur Hobby ; durée réglable jusqu'à la durée de
  conservation des déploiements (changelog Vercel « Skew Protection max age now
  supports the full deployment lifetime »).
- Les tâches planifiées : sur Hobby, Vercel ne lance un cron qu'une fois par jour
  (c'est pour ça que le récapitulatif du réveil passe par GitHub,
  `.github/workflows/reveil-notifs.yml`).

**Où.** https://vercel.com → en haut à gauche, ton compte → **Create Team** (ou
**Upgrade**) → choisir **Pro** → carte bancaire. Puis projet VRM → **Settings** →
**General** (tout en bas, *Transfer Project*) → le transférer dans l'équipe Pro si
Vercel ne l'a pas fait. Le domaine `vrm.center`, les variables d'environnement et
l'historique suivent le projet. Prix : celui affiché par Vercel au moment de payer
(par membre et par mois).

Ensuite : projet → **Settings** → **Advanced** (ou *Deployment Protection*) →
**Skew Protection** → **Enable**, durée par exemple 7 jours.

**Ce que ça change dans le dépôt — rien tout de suite, et c'est voulu :**
- `vercel.json` reste valable tel quel (région `dub1`, crons, réécritures).
- **Ne pas** remonter la limite de `scripts/audit-fonctions-api.cjs` (12) tant
  que le passage à Pro n'est pas fait et vérifié : un déploiement à 13 fonctions
  sur Hobby échoue. À rouvrir après le passage, en une session dédiée.
- Skew Protection n'agit vraiment sur une app Vite que si les demandes de
  fichiers portent l'identifiant du déploiement (la doc décrit trois façons :
  en-tête `x-deployment-id`, cookie `__vdpl`, paramètre `?dpl=`). D'ici là, le
  filet actuel reste en place : `src/main.jsx` recharge la page une fois sur
  `vite:preloadError`. Brancher Skew Protection dans le code = un petit chantier
  à part, après Pro.
- Optionnel après Pro : le récapitulatif du réveil pourrait redevenir un cron
  Vercel (`7,37 3-11 * * *`) au lieu du workflow GitHub.

**Vérifier.** Vercel → ton équipe → **Settings** → **Billing** : « Pro ». Le
projet est dans l'équipe Pro, `https://vrm.center` répond toujours,
`/api/sante` aussi.

**Durée.** 15 min.

---

## 4. Stripe — encaisser 16,99 € par mois

Ce que le code attend (lu dans `api/compte.js` et `api/_lib/stripe.js`) :
- le prix est trouvé par sa **clé de recherche** (lookup key) `vrm_mensuel`
  (`STRIPE_PRICE_LOOKUP` peut la changer, inutile) — jamais par son identifiant ;
- il doit valoir **exactement 16,99 €, en euros, par mois** (`PRIX_CGV`) : sinon
  le paiement reste fermé (« prix ≠ CGV ») et ta carte « Mon compte » montre les
  deux prix ;
- la clé secrète est lue dans `STRIPE_SECRET_KEY` (`sk_test_…` ou `sk_live_…`) ;
- le webhook arrive sur `https://vrm.center/api/stripe-webhook` (réécrit vers
  `/api/compte?mode=webhook` par `vercel.json`) et sa signature est vérifiée avec
  `STRIPE_WEBHOOK_SECRET` (`whsec_…`) ; sans elle, la route répond 503 ;
- version d'API figée dans le code : `2026-08-26.dahlia`.

### 4a. Le prix (10 min) — d'abord en mode **Test**
Stripe → **Catalogue de produits** → le produit VRM (ou « Ajouter un produit » :
nom « VRM — abonnement mensuel ») → **Ajouter un prix** :
- **16,99 €**, **Récurrent**, **Mensuel** ;
- **Options avancées** → **Clé de recherche** : `vrm_mensuel` → cocher
  **« Transférer la clé de recherche »** (elle quitte l'ancien prix et passe à
  celui-ci, en une fois) ;
- enregistrer, puis **archiver** l'ancien prix (9,99 € ou 12,99 €). Un prix Stripe
  ne se modifie pas, il se recrée : c'est normal.

### 4b. Les réglages Stripe utilisés par VRM (10 min)
- **Paramètres** → **Détails publics** (Public details) → *Conditions d'utilisation* :
  `https://vrm.center/legal/cgv.html` (sans elle, la case « J'accepte les CGV » de
  Stripe ne s'affiche pas ; VRM fait déjà accepter ses CGV avant, mais autant
  avoir les deux).
- **Paramètres** → **Facturation** → **Portail client** : l'activer (annuler,
  changer de carte, voir ses factures) — c'est lui que « Gérer mon abonnement »
  ouvre (`billing_portal/sessions`).

### 4c. Les clés sur Vercel (5 min)
Stripe → **Développeurs** → **Clés API** → *Clé secrète* → copier.
Vercel → projet → **Settings** → **Environment Variables** → **Add** :
`STRIPE_SECRET_KEY` = la clé, environnement **Production**. Puis **Deployments**
→ le dernier → **Redeploy** (une variable n'est lue qu'au déploiement suivant).

### 4d. Le webhook (10 min)
Stripe → **Développeurs** → **Webhooks** → **Ajouter une destination / un endpoint** :
- URL : `https://vrm.center/api/stripe-webhook`
- version d'API : `2026-08-26.dahlia` (celle du code)
- événements : `checkout.session.completed`, `customer.subscription.created`,
  `customer.subscription.updated`, `customer.subscription.deleted`
  (les `invoice.*` sont acquittés et ignorés par le code : inutiles).
Puis ouvrir l'endpoint → **Secret de signature** → **Révéler** → copier le
`whsec_…` → Vercel → `STRIPE_WEBHOOK_SECRET` (Production) → Redeploy.

**Vérifier (mode test).** `https://vrm.center/api/sante` répond
`"stripe": true` et `"stripeWebhook": true`. Puis avec un compte VRM d'essai
(pas le tien : le propriétaire ne paie pas, l'app répond « Ton compte est
gratuit ») : Paramètres → Abonnement → cocher les CGV et l'accès immédiat →
payer avec la carte de test `4242 4242 4242 4242` → retour sur VRM « merci » →
l'abonnement apparaît « en essai » dans l'app, et Stripe → Webhooks montre des
envois en **200**.

### 4e. Passer en mode réel (30 min)
1. Stripe → **Activer le compte** : informations de l'entreprise (les mêmes que
   l'étape 1), IBAN de versement, pièce d'identité.
2. Basculer le tableau de bord en **mode réel** (interrupteur « Mode test ») :
   **le catalogue, les clés et les webhooks du mode réel sont séparés**. Refaire
   4a (prix 16,99 € + clé `vrm_mensuel`), 4b, et 4d (nouveau `whsec_…`).
3. Vercel : remplacer `STRIPE_SECRET_KEY` par la `sk_live_…` et
   `STRIPE_WEBHOOK_SECRET` par le secret du webhook **réel** → Redeploy.

### 4f. L'essai avec une vraie carte, puis le remboursement (20 min)
L'abonnement commence par **7 jours gratuits** (une fois par e-mail et par compte
Vinted) : le premier passage ne prélève rien. Pour voir un vrai prélèvement :
1. Avec un compte VRM d'essai et **ta carte réelle** : s'abonner. L'app dit « en
   essai ».
2. Stripe (mode réel) → **Clients** → ce client → l'abonnement → **Mettre fin à
   l'essai maintenant** (ou « Actions » → mettre à jour l'abonnement) : Stripe
   facture 16,99 € tout de suite.
3. Vérifier : la facture « payée » dans Stripe, l'abonnement « actif » dans VRM
   (Paramètres → Abonnement), la facture listée dans VRM.
4. **Rembourser** : Stripe → **Paiements** → ce paiement → **Rembourser** (total).
   Puis **annuler** l'abonnement (immédiatement). Vérifier dans VRM qu'il n'est
   plus actif.

**Durée de l'étape 4 :** 1 h 30 (hors délai de validation du compte Stripe).

---

## 5. Les variables d'environnement — la liste à cocher

Où : Vercel → projet → **Settings** → **Environment Variables** (Production),
puis **Redeploy**. GitHub : dépôt → **Settings** → **Secrets and variables** →
**Actions**. Vérifier ce qui est posé, sans rien révéler :
`https://vrm.center/api/sante` (oui/non pour `serviceKey`, `owner`, `stripe`,
`stripeWebhook`, `relancesEssai`, `ia`, `detourage`).

**Indispensables pour des clients**
- [ ] `STRIPE_SECRET_KEY` (Vercel) — étape 4.
- [ ] `STRIPE_WEBHOOK_SECRET` (Vercel) — étape 4.
- [ ] `SUPABASE_SERVICE_KEY` (Vercel) — clé de service Supabase (Settings → API) ;
      sans elle : pas de webhook rangé, pas de relances, pas de fermeture de compte.
- [ ] `VRM_OWNER_UID` (Vercel) — ton identifiant de compte VRM (déjà en base :
      `vrm_reglages.proprietaire`) ; c'est ce qui te garde gratuit et à l'écart des relances.
- [ ] `VAPID_PRIVATE_KEY` (Vercel) — notifications push.
- [ ] `CRON_SECRET` (Vercel **et** GitHub, **la même valeur**, une longue phrase
      inventée) — Vercel l'envoie au cron du matin et du soir
      (`api/ship-reminders.js` refuse sans elle) ; GitHub l'utilise pour le
      récapitulatif du réveil (`.github/workflows/reveil-notifs.yml` : sans elle,
      « aucun récapitulatif n'est demandé »).
- [ ] `EMAIL_INBOUND_SECRET` (Vercel) — la même valeur que dans les propriétés du
      script Gmail (`scripts/gmail-forwarder.gs`, à recoller) et que le Worker
      Cloudflare (`docs/email-pipeline.md`). Sans elle, la réception des e-mails
      répond « clé non configurée ».

**Les e-mails de l'essai gratuit (jour 1, 3, 6)** — `api/_lib/relances-essai.js`
- [ ] `RELANCES_SMTP_HOTE` (ex. `smtp-relay.brevo.com` ou `smtp.gmail.com`)
- [ ] `RELANCES_SMTP_PORT` (`465` par défaut ; `587` accepté)
- [ ] `RELANCES_SMTP_UTILISATEUR`
- [ ] `RELANCES_SMTP_MOT_DE_PASSE`
- [ ] `RELANCES_EXPEDITEUR` (l'adresse qui envoie)
      Une seule absente ⇒ rien ne part, et Paramètres le dit. Le même compte
      Brevo que l'étape 2b convient. `RELANCES_ESSAI_MODE_TEST=1` seulement pour
      un essai en mode test Stripe.

**Facultatives**
- [ ] `PUSH_CONTACT` (`mailto:` de contact pour les notifications ; défaut prévu).
- [ ] `AI_API_KEY` / `AI_MODEL` — l'assistant d'annonces, sur TA clé : à ne pas
      ouvrir aux clients (§2.9 : rien de payant à l'usage sur ta clé pour les autres).
- [ ] `PHOTOROOM_API_KEY`, `PHOTOROOM_PLAFOND_MOIS`, `PHOTOROOM_POUR` — même
      remarque (la clé du vendeur est le bon chemin, voir `docs/photoroom.md`).
- [ ] `EBAY_APP_ID`, `EBAY_DEV_ID`, `EBAY_CERT_ID`, `EBAY_RUNAME`,
      `EBAY_VERIF_TOKEN`, `EBAY_DELETION_URL` — eBay (`docs/ebay-api.md`).
- [ ] `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` — Communauté / Discord.
- [ ] `VRM_COFFRE_CLE` — clé du coffre (sinon dérivée de la clé de service).
- [ ] `VITE_TURNSTILE_SITE_KEY` — captcha (prêt, éteint ; ordre des gestes dans
      l'historique sécurité : extension d'abord, clé de site, puis Supabase).

---

## 6. Ouvrir le verrou « abonnement obligatoire » (le dernier geste)

**Pourquoi.** Aujourd'hui (lu en base, lecture seule, le 6 nov.) :
`vrm_reglages.abonnement_obligatoire = '0'` — **tout le monde a accès sans payer**,
et aucun abonnement n'existe encore (0 ligne dans `abonnements`). Tant que ce
réglage vaut `'0'`, un client peut s'abonner, mais rien ne l'y oblige.
La règle est dans la base (`supabase/migrations/006-acces-abonnement.sql`,
`vrm_regle_acces`) : avec `'1'`, ont accès le propriétaire (toi), les abonnés
actifs ou en essai, et ceux dont le prélèvement échoue depuis moins de 14 jours.
Les données de quelqu'un qui ne paie pas ne sont **jamais supprimées** : elles
réapparaissent quand il s'abonne.

⚠️ **Avant** : la base compte 8 comptes VRM. Tous ceux qui ne sont pas toi
perdront l'accès à la seconde où le réglage passe à `'1'` s'ils ne sont pas
abonnés. Préviens-les (ou laisse-leur le temps de démarrer leur essai).

**Où.** Supabase → **SQL Editor** → coller puis **Run** :
```sql
update public.vrm_reglages set valeur = '1' where cle = 'abonnement_obligatoire';
```
(Pour revenir en arrière : la même ligne avec `'0'`.)

**Vérifier.** Un compte de test sans abonnement voit l'écran d'abonnement ; ton
compte voit tout comme avant.

**Durée.** 5 min.

---

## 7. Les boutiques d'extension

Un client ne va pas « charger une extension non empaquetée en mode
développeur ». Détail complet, textes à coller et justification de chaque
permission : `docs/boutiques-extension.md` (§8, mis à jour ce jour) et
`docs/chrome-web-store/README.md`.

**Le fichier à envoyer.** Il se fabrique (une session Claude le fait) :
```
node scripts/zip-extension.cjs --store VRM-chromium.zip --firefox VRM-firefox.zip
```
`VRM-chromium.zip` (manifeste à la racine) pour Chrome, Edge et Opera ;
`VRM-firefox.zip` pour Firefox (et Orion). ⚠️ **Pas** `public/VRM-extension.zip` :
celui-là se dézippe en un dossier (pour l'installation à la main), les boutiques
veulent le manifeste à la racine.

| boutique | compte | coût | à fournir | revue |
|---|---|---|---|---|
| **Chrome Web Store** (https://chrome.google.com/webstore/devconsole) | compte Google | 5 $ une fois | zip, description, catégorie, icône 128, au moins une capture 1280×800, vignette 440×280, objectif unique, justification de **chaque** permission, politique de confidentialité, données collectées | quelques jours en général, plus long avec l'accès aux cookies |
| **Firefox AMO** (https://addons.mozilla.org/developers/) — sert aussi **Orion** | compte Mozilla | gratuit | zip Firefox, résumé, notes pour le relecteur, politique de confidentialité | de quelques heures à quelques jours |
| **Edge Add-ons** (Partner Center) | compte Microsoft | gratuit | le zip Chrome, mêmes textes | jusqu'à 7 jours ouvrés |

**Vérifier.** La fiche publiée s'installe d'un clic ; envoyer son adresse à une
session Claude : elle la pose dans `LIENS_BOUTIQUES` (`src/navigateursServis.js`)
et l'app propose alors « Installer depuis la boutique » au lieu du zip.

**Durée.** 2 h pour les trois fiches, plus la revue.

---

## Ce qui n'a pas pu être vérifié d'ici (6 nov.)

- Les pages officielles de Vercel, Stripe, Google, Mozilla et Microsoft ne sont
  pas joignables depuis ce conteneur (réseau filtré) : les extraits Vercel cités
  viennent de la recherche dans la documentation Vercel et d'une recherche web ;
  ceux de Supabase de sa documentation (outil de recherche officiel). Les prix et
  délais des boutiques sont ceux affichés publiquement à ce jour — **à revérifier
  au moment de payer**.
- Le réglage réel d'authentification de Supabase (Site URL, SMTP, modèles) n'est
  pas lisible en lecture seule : l'état décrit vient du code et des passations.
- `https://vrm.center/api/sante` n'a pas pu être appelé d'ici.
- Les formes juridiques (RCS, médiateur) : ce document dit OÙ trouver la bonne
  valeur, il ne remplace pas la relecture juridique.
