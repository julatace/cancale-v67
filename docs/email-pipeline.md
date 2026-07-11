# Pipeline email universel VRM — branchement

Objectif : recevoir les mails Vinted (ventes, factures, **bordereaux**) de **n'importe
quel fournisseur** (iCloud, Gmail, Outlook…) sans dépendre de Google, en les
transférant vers une adresse à nous qui les parse automatiquement.

Le code de réception est déjà prêt : **`api/email-inbound.js`** (porté depuis
l'ancien Apps Script). Il ne reste qu'à brancher la plomberie ci-dessous.

---

## Vue d'ensemble

```
Boîte mail (iCloud…)  --règle de transfert-->  recu@usevrm.com
        |
   Cloudflare Email Routing (gratuit)  --Email Worker-->  POST JSON
        |
   https://usevrm.com/api/email-inbound?key=SECRET   (ce dépôt)
        |
   Parse (vente / facture / bordereau)  -->  Supabase (app_data)
        |
   L'app lit email_sale_* / email_bord_* / email_final_*
```

---

## Étape 1 — Domaine sur Vercel

1. Acheter **usevrm.com** (Vercel → Domains, ou autre registrar).
2. Dans le projet Vercel `cancale-v67` → **Settings → Domains** → ajouter `usevrm.com`
   (et `www`). Le site sera alors sur `https://usevrm.com`.

## Étape 2 — Variable secrète (anti-injection)

Vercel → projet → **Settings → Environment Variables** :

| Nom | Valeur |
|---|---|
| `EMAIL_INBOUND_SECRET` | une longue chaîne aléatoire (ex. `vrm_9f3a…`) |

(La route refuse tout POST sans `?key=` égal à cette valeur.)

## Étape 3 — Réception des mails (Cloudflare Email Routing, gratuit)

1. Créer un compte Cloudflare, ajouter le domaine `usevrm.com` (Cloudflare gère le DNS).
   > Si le domaine est acheté chez Vercel : soit pointer les *nameservers* vers
   > Cloudflare, soit utiliser un autre service inbound (Postmark/Mailgun) via des
   > enregistrements MX — voir « Variante » plus bas.
2. **Email → Email Routing** → activer. Créer l'adresse **`recu@usevrm.com`**.
3. Router `recu@usevrm.com` vers un **Email Worker** (code ci-dessous).

### Code de l'Email Worker (Cloudflare)

Nécessite le paquet `postal-mime` (parse le MIME → texte + pièces jointes).

```js
import PostalMime from 'postal-mime';

export default {
  async email(message, env, ctx) {
    const parser = new PostalMime();
    const raw = new Response(message.raw);
    const email = await parser.parse(await raw.arrayBuffer());

    const attachments = (email.attachments || []).map(a => ({
      filename: a.filename,
      contentType: a.mimeType,
      // postal-mime donne un ArrayBuffer -> base64
      content: btoa(String.fromCharCode(...new Uint8Array(a.content))),
    }));

    await fetch('https://usevrm.com/api/email-inbound?key=' + env.EMAIL_INBOUND_SECRET, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: (message.from) || '',
        to: (message.to) || '',
        subject: email.subject || '',
        text: email.text || '',
        html: email.html || '',
        attachments,
      }),
    });
  },
};
```

Dans le Worker, définir la variable `EMAIL_INBOUND_SECRET` (même valeur qu'à l'étape 2).

## Étape 4 — Règle de transfert dans la boîte de l'utilisateur

**iCloud** (icloud.com → Mail → ⚙️ → Règles) :
- Condition : *expéditeur contient* `vinted`
- Action : *transférer vers* `recu@usevrm.com`

**Gmail** : Paramètres → Transfert et POP/IMAP → ajouter l'adresse, puis un filtre
`from:vinted.fr` → transférer.

**Outlook** : Règles → de `vinted` → transférer.

---

## Ce que ça range dans Supabase (table `app_data`)

| Type de mail | Ligne créée | Contenu |
|---|---|---|
| « Ton article s'est vendu » | `email_sale_{hash}` | pseudo, prix, désignation, numéro, adresse, email |
| « transaction finalisée » | `email_final_{hash}` | marqueur d'argent reçu |
| « Bordereau d'envoi » | `email_bord_{transaction}` | numéro, modèle, taille, suivi, **PDF en base64** |

Le PDF du bordereau est stocké en base64 → l'app peut le **tamponner** (numéro/titre)
et l'imprimer, comme le flux extension `harvest_{uid}_label_latest`.

## Variante sans Cloudflare (Postmark / Mailgun inbound)

Si tu préfères ne pas déplacer le DNS sur Cloudflare : ces services donnent une
adresse inbound et POSTent le mail parsé (JSON) directement. Il suffit de pointer
leur webhook vers `https://usevrm.com/api/email-inbound?key=SECRET`. Le handler
reconnaît déjà les formats **Postmark**, **SendGrid** et **Mailgun**.

## Test rapide (sans mail réel)

```bash
curl -X POST "https://usevrm.com/api/email-inbound?key=SECRET" \
  -H "Content-Type: application/json" \
  -d '{"subject":"Ton article s'\''est vendu","text":"acheteur a acheté Nike Air Max N°142 44,00 €\nAdresse : Jean, 12 rue X, 35260 Cancale\nAdresse e-mail : jean@icloud.com"}'
# -> { "ok": true, "type": "vente", "pseudo": "acheteur", "prix": "44.00", "numero": "142" }
```
