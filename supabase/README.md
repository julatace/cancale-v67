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

## Étape 2 bis — Activer Google et Discord

Les deux boutons « Continuer avec… » sont déjà dans l'app. Il faut créer une
application chez chaque fournisseur et donner ses clés à Supabase.

**L'adresse de retour est la même dans les deux cas :**
`https://lgonxzrzjcqthjtbdpzo.supabase.co/auth/v1/callback`

### Google
1. https://console.cloud.google.com → crée un projet (ou prends-en un existant)
2. **APIs & Services → OAuth consent screen** → type *External* → renseigne le
   nom de l'app, ton email de contact, ton email de développeur
3. **APIs & Services → Credentials → Create credentials → OAuth client ID** →
   type *Web application*
4. Dans **Authorized redirect URIs**, colle l'adresse de retour ci-dessus
5. Copie le *Client ID* et le *Client secret*
6. Supabase → **Authentication → Providers → Google** → active, colle les deux,
   **Save**

### Discord
1. https://discord.com/developers/applications → **New Application**
2. Onglet **OAuth2** → **Redirects** → *Add Redirect* → colle l'adresse de retour
3. Copie le *Client ID* et le *Client secret* (**Reset Secret** si besoin)
4. Supabase → **Authentication → Providers → Discord** → active, colle les deux,
   **Save**

### Et l'adresse de retour vers l'app
Supabase → **Authentication → URL Configuration** :
- **Site URL** : `https://vrm.center`
- **Redirect URLs** : ajoute `https://vrm.center/**` et
  `https://cancale-v67-ten.vercel.app/**`

Cette liste est une **liste blanche** : sans elle, quelqu'un pourrait fabriquer
un lien de connexion qui renvoie le jeton vers son propre site.

---

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


---

# Sécurité — ce qui est fait, ce qui reste

## Fait

**L'isolation est dans la base, pas dans l'app.** Une séparation écrite en
JavaScript ne protège de rien : il suffit d'ouvrir la console du navigateur
pour la contourner. Ici c'est Postgres qui refuse les lignes des autres.

**La clé publique dans le code n'est pas un problème** — elle est *faite* pour
être publique. Ce qui la rendait dangereuse, c'est l'absence de RLS : sans
règle, cette clé donnait accès à tout. Avec RLS, elle ne donne accès à rien
sans être accompagnée du jeton d'un compte.

**Connexion Google / Discord en PKCE** et pas en méthode « implicite ». En
implicite le jeton d'accès revient *dans l'URL* : il finit dans l'historique du
navigateur, dans les journaux d'un proxy, dans le presse-papier si on copie le
lien. En PKCE il ne revient qu'un code inutilisable seul — l'échanger exige un
secret tiré par l'app, gardé dans l'onglet, jamais transmis. Intercepter l'URL
ne suffit plus.

**L'URL est nettoyée** après le retour de connexion : aucun jeton ne reste dans
la barre d'adresse.

**Le formulaire « mot de passe oublié » répond pareil** que le compte existe ou
non. Sinon il suffisait d'y taper des adresses pour savoir qui est inscrit.

**La session transmise à l'extension vérifie l'origine** de l'onglet émetteur :
sans ça, n'importe quel site ouvert dans le navigateur pouvait envoyer un jeton
à l'extension et lui faire écrire des données.

**La route du widget iPhone est fermée.** Elle était **publique** :
`https://vrm.center/api/widget` renvoyait à qui la demandait le chiffre
d'affaires du mois, le nombre de ventes, l'argent en attente et le nombre
d'annonces en ligne — sans aucune clé, et avec un en-tête qui autorisait même
n'importe quel site web à la lire. Elle exige maintenant une clé personnelle
(`?k=…`), comparée en temps constant (une comparaison ordinaire s'arrête au
premier caractère faux, ce qui permet de deviner la clé lettre par lettre en
chronométrant les réponses). L'app génère la clé et affiche l'adresse complète
dans **Paramètres → Widget iPhone** : à recopier dans Scriptable.

## Ce qui reste

**Les autres routes `api/`** (`email-inbound`, `ship-reminders`, `push`)
écrivent avec la clé publique et seront bloquées par RLS. Elles ont besoin de
la clé `service_role` et de savoir à quel vendeur rattacher chaque ligne.

**La session est stockée dans le navigateur** (`localStorage`), comme le fait
la bibliothèque officielle de Supabase. C'est lisible par un script malveillant
qui parviendrait à s'exécuter sur la page. S'en protéger vraiment demanderait
des cookies posés par un serveur — un vrai changement d'architecture, à
envisager le jour où l'app gère l'argent d'inconnus.

**Le proxy Vinted** (`api/vinted-proxy.js`) accepte un jeton fourni par
l'appelant et le relaie à Vinted. Il ne fuit rien (il faut déjà posséder le
jeton), mais n'importe qui peut s'en servir comme relais. À restreindre aux
appels authentifiés quand le multi-vendeurs sera actif.
