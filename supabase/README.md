# Passer VRM en multi-vendeurs — mode d'emploi

Tout le code est déjà en place. Il ne manque que **trois actions dans Supabase**
et **une ligne à changer dans le code**. Tant que tu n'as rien fait, l'app
continue de marcher exactement comme aujourd'hui : aucun écran de connexion,
aucun risque.

L'ordre compte. Ne saute pas d'étape.

---

## Pourquoi c'est en attente et pas déjà activé

L'isolation entre vendeurs est faite par **Postgres**, pas par le JavaScript de
l'app. C'est volontaire : une séparation écrite en JavaScript ne protège de
rien (il suffit d'ouvrir la console du navigateur pour la contourner). La règle
qui compte — « tu ne peux lire que tes lignes » — doit vivre dans la base.

Or je ne peux pas modifier la structure de la base avec la clé publique que
l'app utilise. Il faut la coller toi-même dans Supabase. D'où ce mode d'emploi.

---

## Étape 1 — Préparer la base (5 min, sans effet visible)

1. Va sur https://supabase.com/dashboard → ton projet → **SQL Editor** → **New query**
2. Ouvre `migrations/001-multi-utilisateurs.sql`, copie **l'étape 1 uniquement**
   (le fichier est découpé et commenté)
3. Colle, clique **Run**

L'app fonctionne toujours pareil après ça. Rien n'a changé pour toi.

## Étape 2 — Autoriser les inscriptions

Supabase → **Authentication** → **Providers** → **Email** → décoche
**« Confirm email »**.

Pourquoi : par défaut Supabase envoie un email de confirmation avant d'activer
un compte, mais son serveur d'envoi intégré est réservé aux tests — il n'écrit
qu'aux membres du projet et n'envoie que quelques messages par heure. Tes futurs
vendeurs ne recevraient jamais rien. Sans confirmation, l'inscription est
immédiate.

> Quand tu voudras ouvrir l'app à de vrais clients payants, remets la
> confirmation et branche un vrai service d'envoi (Resend, Postmark, Brevo…)
> dans **Authentication → Emails → SMTP Settings**. La confirmation email évite
> qu'on crée des comptes avec l'adresse de quelqu'un d'autre.

## Étape 3 — Créer ton compte et récupérer ton identifiant

1. Dis-moi de passer `MULTI_USER` à `true` (une ligne dans `src/App.jsx`), je
   déploie
2. Ouvre l'app → **Créer un compte** avec ton email
3. Supabase → **Authentication** → **Users** → clique sur ton email → copie
   l'**User UID**

À ce stade tu verras une app **vide** : c'est normal, tes données existantes
n'appartiennent encore à personne. L'étape 4 te les rend.

## Étape 4 — T'attribuer tes données et fermer la porte

Reprends `migrations/001-multi-utilisateurs.sql`, **étape 2**, remplace les deux
`METS-TON-UID-ICI` par ton User UID, colle dans le SQL Editor, **Run**.

Recharge l'app : tout ton historique est revenu, et il est maintenant à toi.
Un autre vendeur qui crée son compte démarre sur une app vierge et ne verra
jamais rien de tes données.

## Étape 5 — Reconnecter l'extension

Ouvre l'app une fois, connecté. L'extension récupère automatiquement ton
identité au passage (via `bridge.js`) et continue de capter tes annonces et
tes ventes sous ton compte. Rien à configurer.

Si tu as plusieurs profils Chrome, fais-le dans chacun.

---

## Ce qui reste en chantier après ça

**Les fonctions serveur** (`api/widget.js`, `api/email-inbound.js`,
`api/ship-reminders.js`, `api/push.js`) écrivent avec la clé publique. Une fois
l'isolation active, elles n'auront plus le droit d'écrire :

- le **widget iPhone** n'aura plus de chiffres à jour
- l'**import des emails Vinted** (ventes, bordereaux, colis) s'arrêtera

Pour les remettre en route il faut leur donner la clé `service_role` (Vercel →
Settings → Environment Variables → `SUPABASE_SERVICE_KEY`) et leur faire
préciser à quel vendeur appartient chaque ligne écrite. Pour les emails, ça
suppose aussi de savoir **à quel vendeur appartient une adresse email** — c'est
un vrai morceau, à faire dans un second temps.

**Tant que ce n'est pas fait**, deux options :

- appliquer **seulement l'étape 1** de la migration (les colonnes, sans RLS) :
  rien ne casse, mais il n'y a pas encore d'isolation réelle — donc pas encore
  de deuxième vendeur ;
- ou tout activer et accepter que le widget et l'import des emails soient en
  pause quelques jours.

À décider ensemble avant de basculer.
