# Allumer le suivi Colissimo et UPS dans VRM — le pas-à-pas (13 nov. 2026)

**Pour qui :** Julien, une seule fois. **Durée :** 10 minutes par transporteur. **Coût :** 0 €.

VRM sait déjà lire le suivi **Colissimo / La Poste** et **UPS** par leurs services officiels.
Il lui manque seulement une **clé** (un mot de passe pour programmes), que chaque transporteur
donne gratuitement. Tant qu'elle n'est pas posée, VRM ne demande rien à La Poste ni à UPS et
l'app écrit simplement « Colissimo : suivi lu par e-mail seulement » — ce n'est pas une erreur.

> ⚠️ **Ne colle JAMAIS une clé dans une conversation** (ni avec Claude, ni par e-mail, ni dans
> un message). Elle va à **un seul endroit** : Vercel → Settings → Environment Variables.
> Si une clé a été montrée par erreur, retourne sur le site du transporteur et **régénère-la**.

---

## 1. Colissimo / La Poste (clé « Okapi », API « Suivi v2 »)

1. Ouvre **<https://developer.laposte.fr>** et clique **« Se connecter »** puis **« Créer un compte »**
   (ton e-mail, un mot de passe). Valide le lien reçu par e-mail.
2. Une fois connecté, va dans **« Mes applications »** → **« Créer une application »**.
   Nom : `VRM`. Description : `Suivi des colis achetés`. Enregistre.
3. Va dans le **catalogue des API** et ouvre **« Suivi »** (version **v2**,
   <https://developer.laposte.fr/products/suivi/2>). Clique **« Souscrire »** (ou « S'abonner »),
   choisis l'application **VRM** et l'offre **gratuite**. Valide.
4. Retourne dans **« Mes applications » → VRM**. Copie la **clé d'API** (« X-Okapi-Key »)
   avec le bouton **Copier**.
5. Ouvre **<https://vercel.com>** → le projet **cancale-v67** → **Settings** →
   **Environment Variables**.
   - **Key** : `LAPOSTE_OKAPI_KEY`
   - **Value** : colle la clé (Cmd+V)
   - **Environments** : coche **Production** (et Preview si tu veux)
   - clique **Save**.
6. Va dans **Deployments**, sur la première ligne (« Production ») clique les **trois points «…»**
   → **Redeploy** → **Redeploy**. Attends « Ready » (1 à 2 minutes).
7. **Vérifier :** ouvre VRM → **Achats**. Sous un colis Colissimo, au bout de quelques minutes,
   la ligne devient « Confirmé chez Colissimo il y a … » (ou « Colissimo : pas encore lu — VRM le
   lit tant que l'app est ouverte » juste avant la première lecture).

## 2. UPS (identifiants OAuth, API « Tracking »)

1. Ouvre **<https://developer.ups.com>** et clique **« Log In »**. Si tu n'as pas d'identifiant
   ups.com, clique **« Sign Up »** et crée-le (gratuit). Valide l'e-mail.
2. Va dans **« Apps »** (ou « My Apps ») → **« Add Apps »** / **« Create Application »**.
   - À la question sur l'usage, choisis **« I want to track packages »** / usage pour ta propre
     activité.
   - Si UPS demande un **numéro de compte UPS** : choisis l'option sans compte si elle est
     proposée ; sinon ouvre un compte UPS **gratuit** sur ups.com (« Ouvrir un compte », sans
     abonnement) et reviens.
   - Nom de l'application : `VRM`. **Callback URL** : `https://vrm.center` (UPS l'exige parfois,
     VRM ne s'en sert pas).
3. Dans la liste des produits (**« Products »** / « APIs »), ajoute **« Tracking »**. Enregistre.
4. Ouvre l'application **VRM** : copie le **Client ID**, puis le **Client Secret**
   (bouton « Show » puis « Copy »).
5. **Vercel** → **cancale-v67** → **Settings** → **Environment Variables**, deux variables
   (une à la fois, **Save** après chacune) :
   - `UPS_CLIENT_ID` = le Client ID
   - `UPS_CLIENT_SECRET` = le Client Secret
   - Environments : **Production**.
6. **Deployments** → « … » sur la dernière Production → **Redeploy**.
7. **Vérifier :** Achats → un colis UPS (n° qui commence par **1Z**) dit « Confirmé chez UPS … ».

## Ce que VRM fait avec ces clés (et ce qu'il ne fait jamais)

- Il envoie **seulement le n° de suivi** d'un colis que **tu achètes** (jamais ton code de retrait,
  ni ton nom), depuis le serveur VRM — au plus au même rythme que pour Chronopost (toutes les
  15 min pour un colis au point, toutes les heures en route).
- Les clés restent **dans Vercel** : jamais en base, jamais dans le navigateur, jamais dans un
  journal. Ce sont les clés **de l'installation VRM** (gratuites, sans coût à l'usage), pas tes
  comptes personnels de transporteur.
- Si La Poste ou UPS refuse (clé fausse, trop de demandes), VRM **se met en pause** pour ce
  transporteur (30 min, puis plus longtemps) et réessaie seul. Rien ne casse, l'app continue
  avec les e-mails.
- **Jamais par l'extension** (ta décision : « on ne fait pas avec l'extension »).

## Et DPD, GLS, Relais Colis ?

Pas de clé à poser : VRM lit leurs **e-mails** (et les SMS si tu actives le raccourci). Pour DPD et
GLS, leur suivi public n'a pas encore pu être **mesuré** (voir
`docs/passation/2026-11-13-lot89-suivi-transporteurs.md` §3) ; rien n'est branché tant que la
vraie réponse n'a pas été vue.
