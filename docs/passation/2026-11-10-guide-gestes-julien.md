# Tes gestes, pas à pas — guide complet (10 novembre 2026)

Ce guide se suit **sans moi**. Chaque étape dit : où aller, quoi toucher, quoi copier,
ce que tu dois voir à la fin, et quoi faire si ça ne marche pas.
Fais-les **dans l'ordre**. Coche au fur et à mesure.

> État vérifié ce soir dans ta base (lecture seule) : **aucune** des migrations 016, 023 à 030
> n'est encore appliquée (seules la 022 et `vrm_acces` de la 027 sont présentes).

Légende : ⏱ durée · ✅ ce que tu dois voir · ⚠️ attention · 🆘 si ça bloque

---

## Partie 1 — Ce soir, 15 minutes, le plus utile

### 1. Installer l'extension 5.340.0 (⏱ 5 min, dans CHAQUE Chrome)
1. Sur l'ordinateur, ouvre **https://vrm.center/VRM-extension.zip** : le fichier se télécharge.
2. Ouvre le dossier **Téléchargements**, double-clique sur `VRM-extension.zip` :
   il donne **un seul dossier** `VRM-extension`.
3. Trouve **l'ancien** dossier `VRM-extension` (celui que tu avais installé la dernière fois)
   et **remplace-le** par le nouveau (même nom, même endroit). Accepte « Remplacer ».
4. Dans Chrome, tape dans la barre d'adresse : `chrome://extensions` puis Entrée.
5. Sur la carte **VRM**, clique la flèche ronde **⟳** (Recharger).
6. Recommence 4 et 5 **dans chaque Chrome / profil** où VRM est installée (Edge :
   `edge://extensions`).
7. iPhone/iPad avec Orion : ouvre **https://vrm.center/VRM-Orion-dossier.zip** dans Orion,
   ouvre-le dans l'app **Fichiers** (ça donne un dossier `VRM-Orion`), puis Orion →
   Extensions → **+** → « depuis un fichier » → choisis ce dossier.

✅ Sur `chrome://extensions`, la carte VRM affiche **5.340.0**. Dans VRM → Paramètres,
plus de bandeau « Ton extension VRM est en retard ».
🆘 Toujours l'ancienne version : tu as rechargé sans remplacer le dossier, ou remplacé sans
cliquer ⟳. Il faut les DEUX, dans cet ordre.

### 2. Leboncoin : ouvrir « Mes annonces » sur chaque compte (⏱ 2 min par compte)
1. Dans un Chrome où l'extension est à jour, va sur **leboncoin.fr**, connecté à ton 1er compte.
2. Clique ton avatar → **Mes annonces**. Laisse la page charger jusqu'en bas (fais défiler).
3. Déconnecte-toi, connecte-toi au compte suivant, recommence.

✅ Sur leboncoin.fr, la petite carte VRM dit « Annonces : N lues en entier ✓ ».

### 3. Vinted : ouvrir le compte des deux achats irlandais (⏱ 2 min)
1. Sur **vinted.fr**, connecte-toi au compte **loladupuis35260**.
2. Ouvre **Mes commandes → Achats**, laisse charger.

✅ Dans VRM → Colis → À retirer, les 2 colis « à vérifier » (n° finissant par « IE »)
passent à « retiré » ou restent avec leur état réel lu chez Vinted.

### 4. GitHub : `CRON_SECRET` (⏱ 5 min) — colis relus toutes les 15 min, factures auto
**a) Récupérer la valeur sur Vercel**
1. Va sur **https://vercel.com** → ton projet **VRM** → **Settings** → **Environment Variables**.
2. Cherche **`CRON_SECRET`**. Clique l'œil 👁 pour afficher la valeur et **copie-la**.
   - 🆘 Si Vercel ne veut pas l'afficher (« Sensitive ») : fabrique une nouvelle valeur de
     40 caractères (lettres et chiffres au hasard, par ex. un générateur de mots de passe),
     clique **⋯ → Edit** sur `CRON_SECRET`, colle la nouvelle valeur, **Save**, puis fais
     l'étape « Redéployer » ci-dessous. Garde cette valeur pour b).
   - 🆘 Si `CRON_SECRET` n'existe pas : **Add New** → Name `CRON_SECRET`, Value = 40 caractères
     au hasard, Environments : **Production** coché → **Save**, puis « Redéployer ».

**b) La poser sur GitHub**
1. Va sur **https://github.com/julatace/cancale-v67** → onglet **Settings** (en haut à droite
   du dépôt).
2. Menu de gauche : **Secrets and variables** → **Actions**.
3. Bouton vert **New repository secret**.
4. Name : `CRON_SECRET` (exactement, en majuscules). Secret : colle la valeur. **Add secret**.

✅ La liste « Repository secrets » montre `CRON_SECRET`.

**Redéployer Vercel (à faire après CHAQUE changement de variable Vercel)**
Vercel → ton projet → **Deployments** → la ligne du haut (Production) → **⋯** → **Redeploy**
→ **Redeploy**. Attends « Ready » (≈ 2 min).

### 5. M'envoyer les logos (⏱ 2 min)
Fais une capture d'écran du **haut d'un e-mail Chronopost** (là où est le logo), et si tu en
as : Colissimo, InPost, Relais Colis, Shop2Shop, GLS, Colis Privé. Envoie-les dans la
conversation. Aujourd'hui ces logos sont leur nom en couleurs, pas le vrai dessin.

---

## Partie 2 — La base de données (Supabase), ⏱ 20 min

⚠️ Fais d'abord l'étape 1 (extension 5.340) : la 029 en a besoin.
⚠️ Fais-le à un moment calme (le soir, personne d'autre sur VRM).

**La méthode, la même pour chaque fichier :**
1. Ouvre le lien du fichier (liste ci-dessous) dans ton navigateur.
2. En haut à droite du fichier, clique **Raw** (ou l'icône « copier le fichier brut » ⧉).
3. **Tout sélectionner** (⌘A sur Mac, Ctrl+A sur PC) puis **copier** (⌘C / Ctrl+C).
4. Va sur **https://supabase.com/dashboard** → ton projet → menu de gauche **SQL Editor**
   → **+ New query**.
5. **Colle** (⌘V / Ctrl+V) → bouton **Run** (en bas à droite).
6. Lis le résultat en bas :
   - ✅ « Success. No rows returned » (ou des lignes « NOTICE ») = c'est posé. Passe au suivant.
   - 🆘 Un message rouge : **ne relance pas**. Copie le message et envoie-le-moi. Rien n'est
     cassé : chaque fichier s'arrête proprement sans rien changer s'il rencontre un problème.
   - Si Supabase demande une confirmation « potentially destructive » : réponds **non**
     et envoie-moi le message (aucun de ces fichiers ne supprime de données).

**L'ordre (respecte-le) :**

| # | fichier | lien | ce que ça fait |
|---|---|---|---|
| 1 | 029 | https://github.com/julatace/cancale-v67/blob/main/supabase/migrations/029-vinted-accounts-preuve.sql | un compte Vinted ne se relie qu'après preuve |
| 2 | 028 | https://github.com/julatace/cancale-v67/blob/main/supabase/migrations/028-plans-solo-pro.sql | les offres Solo / Pro |
| 3 | 030 | https://github.com/julatace/cancale-v67/blob/main/supabase/migrations/030-solo-plateformes.sql | Solo = un compte vendeur par plateforme |
| 4 | 024 | https://github.com/julatace/cancale-v67/blob/main/supabase/migrations/024-appareils-connectes.sql | la liste de tes appareils connectés |
| 5 | 025 | https://github.com/julatace/cancale-v67/blob/main/supabase/migrations/025-communaute-accompagnement.sql | les groupes d'accompagnement de la Communauté |
| 6 | 026 | https://github.com/julatace/cancale-v67/blob/main/supabase/migrations/026-charge-ebay-et-id.sql | eBay plus léger |
| 7 | 027 | https://github.com/julatace/cancale-v67/blob/main/supabase/migrations/027-abonnement-apercu-et-parrainage.sql | aperçu sans abonnement + parrainage |
| 8 | 023 | https://github.com/julatace/cancale-v67/blob/main/supabase/migrations/023-un-compte-vinted-par-vrm.sql | un compte Vinted = un seul compte VRM. ⚠️ Elle peut REFUSER en nommant un compte Vinted en double (ex. `angeled92` sur ton compte d'essai) : c'est normal, envoie-moi le message, on décide ensemble quel compte VRM le garde. |
| 9 | 016 | https://github.com/julatace/cancale-v67/blob/main/supabase/migrations/016-equipe.sql | le mode équipe (aide qui imprime les bordereaux). Seulement si tu veux le mode équipe. |

✅ À la fin, envoie-moi « migrations faites » : je vérifie tout depuis ici en lecture seule.

---

## Partie 3 — Les e-mails (⏱ 30 à 45 min)

### 6. Relier la boîte des e-mails « ton achat t'attend » sans compte (⏱ 3 min)
17 e-mails Vinted « ton achat t'attend » arrivent sur une adresse e-mail reliée à aucun de
tes comptes dans VRM.
1. VRM → **Paramètres** → **Mes e-mails**.
2. La ligne de cette adresse dit « reliée à aucun compte » → touche **Relier ma boîte**.
3. Choisis le compte Vinted qui reçoit ces e-mails → VRM t'envoie un lien de preuve à cette
   adresse → **ouvre l'e-mail et clique le lien depuis le même appareil**.

✅ L'adresse affiche le compte et « prouvée ✓ ».

### 7. Brevo : que VRM puisse envoyer des e-mails (factures, liens) (⏱ 20 min)
1. Crée un compte gratuit sur **https://www.brevo.com** (300 e-mails/jour gratuits).
2. Brevo → en haut à droite ton nom → **SMTP & API** → onglet **SMTP**.
   - Note le **Login** (une adresse du type `xxxx@smtp-brevo.com`).
   - Clique **Generate a new SMTP key** → nomme-la `VRM` → **copie la clé** (elle ne
     s'affiche qu'une fois).
3. Brevo → **Senders, Domains & Dedicated IPs** → **Domains** → **Add a domain** → `vrm.center`.
   Brevo affiche 3 ou 4 enregistrements DNS (TXT « brevo-code », DKIM, DMARC).
   - Va là où sont gérés les DNS de `vrm.center` (Vercel → **Domains** → `vrm.center` →
     **DNS Records**, ou ton registrar) et **ajoute chaque enregistrement** exactement comme
     Brevo l'affiche (Type, Nom, Valeur).
   - Reviens sur Brevo → **Authenticate** / **Verify**. ✅ « Authenticated ».
4. Vercel → projet → **Settings → Environment Variables** → ajoute (Production) :

| Name | Value |
|---|---|
| `RELANCES_SMTP_HOTE` | `smtp-relay.brevo.com` |
| `RELANCES_SMTP_PORT` | `587` |
| `RELANCES_SMTP_UTILISATEUR` | le **Login** Brevo |
| `RELANCES_SMTP_MOT_DE_PASSE` | la **clé SMTP** Brevo |
| `RELANCES_EXPEDITEUR` | `noreply@vrm.center` |

5. **Redéployer** (voir fin de l'étape 4).

✅ VRM → Argent → Factures : le bandeau ambre « l'envoi par VRM n'est pas ouvert » disparaît.

### 8. Ta fiche de facture (⏱ 5 min)
VRM → **Argent** → **Factures** → **Ma facture** : SIRET (la fiche se remplit seule, vérifie
puis « C'est bon »), forme, régime de TVA, ton e-mail. L'envoi automatique reste **éteint**
tant que tu ne coches pas la case.

### 9. Ton adresse de réception VRM (⏱ 30 min, une seule fois)
Suis **`docs/emails-transfert-mise-en-service.md`** (sur GitHub :
https://github.com/julatace/cancale-v67/blob/main/docs/emails-transfert-mise-en-service.md).
En bref : acheter un domaine (pas `vrm.center`) → le mettre sur Cloudflare → créer le Worker
`vrm-reception` (code dans le document) avec le secret `EMAIL_INBOUND_SECRET` (la même valeur
que sur Vercel) → Email Routing « Catch-all → Send to a Worker » → sur Vercel ajouter
`DOMAINE_RECEPTION` = ton domaine → Redéployer → VRM → Paramètres → Mes e-mails → Mon adresse
VRM → « Envoyer l'e-mail d'essai ».
✅ « Reçu ✓ » en moins d'une minute.

---

## Partie 4 — Pour que les autres puissent payer (⏱ 45 min)

### 10. Tes informations légales (⏱ 10 min)
Le plus simple : **envoie-moi ces 9 informations** dans la conversation, je les pose :
1. Nom ou raison sociale (ex. « Julien X (entrepreneur individuel) »)
2. Forme juridique (ex. « Entrepreneur individuel (micro-entreprise) »)
3. Adresse du siège
4. SIRET (14 chiffres)
5. Immatriculation (ex. « RCS Saint-Malo 123 456 789 » ou « non inscrit au RCS »)
6. TVA (n° intracom, ou « TVA non applicable, art. 293 B du CGI »)
7. Téléphone
8. Directeur de la publication (souvent toi)
9. Médiateur de la consommation (nom + site web) — à choisir chez un médiateur agréé
   (liste sur economie.gouv.fr, « médiateurs de la consommation »)

Et l'e-mail de contact public (aujourd'hui `vrm.vinted35+contact@gmail.com` : garde-le ou
donne-m'en un autre).

### 11. Stripe (⏱ 30 min) — fais-le d'abord en **mode test**
1. **https://dashboard.stripe.com** → **Product catalog** → **+ Add product** :
   - « VRM Solo » · prix **16,99 €** · **Recurring** · **Monthly** · dans « Advanced » /
     **Lookup key** : `vrm_mensuel` → **Save**.
   - « VRM Pro » · **19,99 €** · Recurring · Monthly · Lookup key `vrm_pro_mensuel` → Save.
     Ouvre ce prix, copie son identifiant **`price_…`**.
2. **Developers → API keys** → **Secret key** → **Reveal** → copie (`sk_test_…` en test,
   `sk_live_…` en réel).
3. **Developers → Webhooks → + Add endpoint** :
   - URL : `https://vrm.center/api/stripe-webhook`
   - Événements : `checkout.session.completed`, `customer.subscription.created`,
     `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`
   - **Add endpoint** → sur la page de l'endpoint, **Signing secret → Reveal** → copie
     (`whsec_…`).
4. **Settings → Billing → Customer portal** → **Activate** (laisse les réglages par défaut).
5. Vercel → Environment Variables (Production) :

| Name | Value |
|---|---|
| `STRIPE_SECRET_KEY` | la clé `sk_…` |
| `STRIPE_WEBHOOK_SECRET` | le `whsec_…` |
| `STRIPE_PRIX_PRO` | le `price_…` du Pro |

6. Redéployer. Dis-moi « Stripe posé » : j'ouvre le bouton Pro (`PRO_OUVERT`) et je vérifie.
7. Quand tout marche en test : refais 1 à 5 en **mode réel** (interrupteur « Test mode » en
   haut de Stripe) et remplace les trois valeurs sur Vercel.

### 12. Supabase : connexion et e-mails de connexion (⏱ 10 min)
Supabase → ton projet → **Authentication** :
1. **URL Configuration** : Site URL = `https://vrm.center` ; Redirect URLs → **Add URL** →
   `https://vrm.center/**` → Save.
2. **Emails** (ou **SMTP Settings**) → **Enable Custom SMTP** : Host `smtp-relay.brevo.com`,
   Port `587`, Username = Login Brevo, Password = clé SMTP Brevo, Sender email
   `noreply@vrm.center`, Sender name `VRM` → Save.
3. **Providers → Email** : **Confirm email** = activé → Save.
4. (Facultatif) **Providers → Discord** : activer, coller Client ID / Secret de ton application
   Discord (discord.com/developers).

---

## Partie 5 — Ce que toi seul peux décider (réponds-moi quand tu veux)

1. **Les ≈ 1 780 ventes à dater** : (a) tout dater, (b) seulement l'année en cours, (c) les
   sortir du compte. Ça change ton chiffre d'affaires déclaré.
2. **« Je dépose »** remplace-t-il l'ancienne « Tournée de dépôt » ? (oui / non)
3. ✅ Réglé (10 nov., 20 h) : **Pro = comptes vendeurs illimités**. La migration 031 n'existe
   plus (rien à appliquer).
4. **Comparer deux mois** : compter les **paires achetées** plutôt que les **achats** ?
5. **Revendu combien ?** : le prix médian une seule fois (au lieu de deux) ?
6. **Un seul bouton « Retiré »** partout, y compris hors ligne ?
7. **Factures au téléphone** : ranger les cinq boutons dans un menu ?
8. **Livre de police** : es-tu déclaré en préfecture comme revendeur d'objets mobiliers
   (cerfa n° 11733) ? Sinon, c'est à faire si tu es professionnel.

---

## Partie 6 — Plus tard (pas urgent)
- Regarder sur le carton les 6 paires renumérotées le 2 octobre (543 → 266…).
- Boutiques d'extensions (Firefox, Edge, Opera) : `docs/boutiques-extension.md`.
- Vercel Pro (≈ 20 $/mois) vers 70 vendeurs actifs.
- Notifications GitHub « run failed » : GitHub → Settings → Notifications → Actions.
- Captcha Turnstile : prêt et éteint, à allumer plus tard (ordre dans l'historique sécurité).
