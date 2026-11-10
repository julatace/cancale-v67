# Ouvrir les e-mails de transfert — tes gestes, une seule fois

Ce que ça donne : chaque vendeur reçoit SA propre adresse VRM
(ex. `k7p2m9…@recu-vrm.fr`). Il y fait suivre ses e-mails Vinted.
VRM les range chez lui, tout seul.

- Durée : environ 30 minutes.
- Coût : le domaine, environ 10 € par an. Cloudflare est gratuit.
- Rien ne casse : ton script Gmail et tes adresses actuelles continuent.

Tant que ce n'est pas fait, VRM affiche « Bientôt disponible ».
Toi seul vois, dans cette même fenêtre, ce qui manque encore.

---

## Étape 1 — Acheter un domaine (5 min)

1. Choisis un nom court, juste pour recevoir. Exemple : `recu-vrm.fr`.
2. **Jamais `vrm.center`** : tes propres e-mails y vivent.
3. Achète-le chez Cloudflare (le plus simple), ou OVH, Gandi…

## Étape 2 — Mettre le domaine sur Cloudflare (5 min)

Si tu l'as acheté chez Cloudflare : rien à faire, passe à l'étape 3.

Sinon :
1. dash.cloudflare.com → **Add a domain** → tape ton domaine → plan **Free**.
2. Cloudflare affiche **deux nameservers**. Copie-les.
3. Chez ton registrar (OVH, Gandi…) : remplace les nameservers par ces deux-là.
4. Attends que Cloudflare dise **Active** (de 5 min à quelques heures).

## Étape 3 — Créer le Worker VRM (5 min)

1. Cloudflare → **Workers & Pages** → **Create** → **Create Worker**.
2. Nom : `vrm-reception` → **Deploy**.
3. **Edit code** → efface tout → colle le code ci-dessous → **Deploy**.
4. **Settings** → **Variables and Secrets** → **Add** :
   - Type : **Secret**
   - Name : `EMAIL_INBOUND_SECRET`
   - Value : la MÊME valeur que sur Vercel (étape 5).
5. **Deploy**.

Le code à coller (il ne demande aucune installation) :

```js
// ═══════════════════════════════════════════════════════════════════════════
// VRM — LE WORKER DE RÉCEPTION DES E-MAILS (Cloudflare Email Routing)
// ═══════════════════════════════════════════════════════════════════════════
// À COLLER TEL QUEL dans Cloudflare → Workers → (ton Worker) → « Edit code ».
// Aucun paquet à installer : il envoie l'e-mail BRUT à VRM, qui sait le lire
// (api/_lib/lire-email.js, clé `raw`).
//
// Il sert le « catch-all » du domaine de réception : TOUTE adresse
// `xxxx@<domaine>` arrive ici. Il transmet l'adresse de livraison RÉELLE
// (`message.to`, l'enveloppe) : c'est elle qui désigne le vendeur
// (api/_lib/adresse-reception.js), jamais l'expéditeur ni le contenu.
//
// Une variable à poser dans le Worker (Settings → Variables, type « Secret ») :
//   EMAIL_INBOUND_SECRET = la même valeur que sur Vercel.
// Facultatif : VRM_URL (par défaut https://vrm.center).
//
// ⚠️ La dernière ligne compte plus que tout le reste : si VRM n'a pas pu ranger
// l'e-mail (réponse autre que 2xx), le Worker LÈVE une erreur. Cloudflare
// refuse alors le message « pour l'instant », et le serveur d'origine le
// renvoie plus tard. Sans elle, un e-mail non rangé serait perdu
// (septembre 2026 : base injoignable, tout acquitté puis perdu).
//
// Tenu par scripts/audit-emails-transfert.cjs, qui EXÉCUTE ce fichier puis
// donne ce qu'il envoie à la vraie route api/email-inbound.js.
// ═══════════════════════════════════════════════════════════════════════════

// Vercel refuse un corps de plus de 4,5 Mo. Au-delà, on envoie l'essentiel
// (expéditeur, sujet, adresse de livraison) sans le contenu : l'e-mail n'est
// pas perdu (il reste dans la boîte d'origine), et VRM le dit.
const TAILLE_MAX = 4000000;

export default {
  async email(message, env) {
    const url = String((env && env.VRM_URL) || 'https://vrm.center').replace(/\/+$/, '') + '/api/email-inbound';
    const brut = await new Response(message.raw).text();
    const entete = (nom) => (message.headers && message.headers.get(nom)) || '';
    const commun = {
      // L'ENVELOPPE : l'adresse à laquelle CET exemplaire a été livré.
      envelopeTo: message.to || '',
      // La signature de Google sur un code de confirmation de transfert Gmail.
      authentification: entete('Authentication-Results') || entete('ARC-Authentication-Results'),
      source: 'cloudflare-worker',
    };
    const corps = brut.length <= TAILLE_MAX
      ? { ...commun, raw: brut }
      : { ...commun, from: entete('From') || message.from || '', to: entete('To'), subject: entete('Subject'), messageId: entete('Message-ID'),
          text: 'E-mail trop lourd pour VRM (' + Math.round(brut.length / 1e6) + ' Mo) : son contenu et ses pièces jointes ne sont pas transmis. Il est toujours dans ta boîte habituelle.',
          tropLourd: true };
    const rep = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-vrm-email-key': String((env && env.EMAIL_INBOUND_SECRET) || '') },
      body: JSON.stringify(corps),
    });
    if (!rep.ok) throw new Error('VRM a répondu ' + rep.status + ' : e-mail non rangé, il sera renvoyé');
  },
};
```

## Étape 4 — Brancher les e-mails sur le Worker (5 min)

1. Cloudflare → ton domaine → **Email** → **Email Routing** → **Get started**.
2. Cloudflare propose ses enregistrements DNS → **Add records and enable**.
   Ne tape rien toi-même. Vérifie juste qu'ils sont là (onglet **DNS**) :

| Type | Nom | Valeur | Priorité |
|---|---|---|---|
| MX | `@` | `route1.mx.cloudflare.net` | celle que Cloudflare affiche |
| MX | `@` | `route2.mx.cloudflare.net` | celle que Cloudflare affiche |
| MX | `@` | `route3.mx.cloudflare.net` | celle que Cloudflare affiche |
| TXT | `@` | `v=spf1 include:_spf.mx.cloudflare.net ~all` | — |

   Cloudflare ajoute parfois aussi un TXT `cf2024-1._domainkey` : laisse-le.
3. **Email Routing** → **Routing rules** → **Catch-all address** → **Edit**.
4. Action : **Send to a Worker**. Destination : `vrm-reception`. **Save**.
5. Vérifie que **Catch-all** est sur **Enabled**.

Aucune adresse « de destination » à vérifier : tout part vers le Worker.

## Étape 5 — Vercel (5 min)

vercel.com → projet `cancale-v67` → **Settings** → **Environment Variables**.

| Nom | Valeur | Environnement |
|---|---|---|
| `DOMAINE_RECEPTION` | ton domaine seul, ex. `recu-vrm.fr` (sans `@`, sans `https://`) | Production |
| `EMAIL_INBOUND_SECRET` | voir ci-dessous | Production |

`EMAIL_INBOUND_SECRET` :
- **Elle existe déjà ?** Ne la change pas. Recopie sa valeur dans le Worker.
- **Elle n'existe pas ?** Fabrique 40 caractères au hasard (un générateur de
  mots de passe). Mets la même valeur à TROIS endroits : Vercel, le Worker,
  et la clé du script Gmail (`scripts/gmail-forwarder.gs`).
  Sinon le script Gmail s'arrête.

Puis **Deployments** → le plus récent → **⋯** → **Redeploy**.

## Étape 6 — Vérifier (2 min)

1. VRM → **Paramètres** → **Mes e-mails** → **Mon adresse VRM**.
2. Ton adresse VRM s'affiche. (Encore « Bientôt disponible » ? La liste dit quoi.)
3. Étape 3 de la fenêtre : **Envoyer l'e-mail d'essai**, depuis ta boîte.
4. En moins d'une minute : **Reçu ✓**.

## Ça ne marche pas ?

| Ce que tu vois | Ce que ça veut dire | Le geste |
|---|---|---|
| « Bientôt disponible », ligne « Le domaine posé sur Vercel » à faire | `DOMAINE_RECEPTION` absent | Étape 5, puis **Redeploy** |
| « mal écrit » | `DOMAINE_RECEPTION` contient `@` ou `https://` | Le domaine seul |
| L'essai n'arrive jamais | Cloudflare ne transmet pas | Email Routing → **Activity** : l'e-mail y est-il ? |
| Workers → `vrm-reception` → **Logs** : « VRM a répondu 401 » | La clé du Worker ≠ celle de Vercel | Recopie la même valeur |
| « VRM a répondu 503 » | La base était injoignable | Rien : l'e-mail est renvoyé tout seul |

## Ce que tu n'as PAS à faire

- Créer une adresse par vendeur : VRM la fabrique lui-même.
- Toucher au script Gmail : il continue comme avant.
- Payer Cloudflare : Email Routing et Workers sont gratuits.

---

<details>
<summary>Pour la session suivante (technique)</summary>

- Le Worker : `cloudflare/worker-reception.js` (le bloc ci-dessus en est la copie
  exacte, vérifiée par `scripts/audit-emails-transfert.cjs`, contrôle G). Il envoie
  l'e-mail BRUT (`raw`), l'enveloppe (`envelopeTo`) et `Authentication-Results`,
  la clé dans l'en-tête `x-vrm-email-key` ; au-delà de 4 Mo, l'essentiel seulement
  (`tropLourd`). Réponse autre que 2xx ⇒ il lève ⇒ Cloudflare refuse
  temporairement ⇒ l'expéditeur renvoie.
- Réception : `api/email-inbound.js` (`adresseUniqueDe`, avant toute autre règle) ;
  la règle : `api/_lib/adresse-reception.js`.
- La fenêtre : `src/AdresseReception.jsx` ; la route :
  `api/email-rattacher.js?mode=adresse-unique` (au propriétaire seul, sans domaine :
  `miseEnService { domaine, cle }`, jamais une valeur).
- Récit : `docs/passation/2026-11-10-emails-transfert.md`.
</details>
