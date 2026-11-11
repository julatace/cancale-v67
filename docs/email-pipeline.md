# Pipeline email universel VRM — branchement

Objectif : recevoir les mails Vinted (ventes, factures, **bordereaux**) de **n'importe
quel fournisseur** (iCloud, Gmail, Outlook…) sans dépendre de Google, en les
transférant vers une adresse à nous qui les parse automatiquement.

Le code de réception est déjà prêt : **`api/email-inbound.js`** (porté depuis
l'ancien Apps Script). Il ne reste qu'à brancher la plomberie ci-dessous.

---

## ⭐ L'adresse de réception UNIQUE de chaque vendeur (8 nov. 2026)

Chaque vendeur a SA propre adresse VRM, aléatoire (24 caractères, ex.
`k7p2m9…@recu-vrm.fr`), affichée dans **Réglages → E-mails → Adresses → Ton adresse
VRM** et dans **E-mails → Relier ma boîte**. Il y fait suivre ses e-mails
(transfert automatique Gmail / iCloud / Outlook / Yahoo) ou la donne directement
comme e-mail d'un compte Vinted. **Tout e-mail livré à cette adresse est rangé chez
lui, sans autre preuve** : c'est VRM qui l'a fabriquée pour lui
(`api/_lib/adresse-reception.js`). Elle passe AVANT toutes les autres règles ;
inconnue, remplacée ou désactivée ⇒ quarantaine neutre (jamais chez un autre,
jamais jetée). Les adresses déclarées/prouvées et le script Gmail continuent de
marcher à côté.

### Les gestes de Julien (une fois)

> ⭐ **(10 nov.) La notice à suivre est `docs/emails-transfert-mise-en-service.md`**
> (pas à pas, valeurs exactes, et le Worker SANS paquet à coller tel quel :
> `cloudflare/worker-reception.js`, testé par `scripts/audit-emails-transfert.cjs`).
> Le Worker `postal-mime` plus bas demande une installation (impossible dans
> l'éditeur de Cloudflare) et son `btoa(String.fromCharCode(...))` casse sur une
> grosse pièce jointe : ne plus le coller.

1. Acheter un **domaine court dédié** à la réception (≈ 10 €/an, ex. `recu-vrm.fr`) —
   jamais `vrm.center` (ses e-mails à lui y vivent).
2. L'ajouter à **Cloudflare** (gratuit) : Cloudflare donne deux *nameservers*, les
   poser chez le registrar.
3. Cloudflare → le domaine → **Email → Email Routing** → activer (Cloudflare pose
   les MX) → **Routing rules → Catch-all address** → *Action* : **Send to a
   Worker** → le Worker ci-dessous (avec la variable `EMAIL_INBOUND_SECRET`).
4. Vercel → projet → Settings → Environment Variables : **`DOMAINE_RECEPTION`** =
   le domaine (ex. `recu-vrm.fr`, sans `@`), puis redéployer.
5. Vérifier que **`EMAIL_INBOUND_SECRET`** est la même sur Vercel et dans le Worker.
6. Dans VRM : Réglages → E-mails → Adresses → **Ton adresse VRM** → « Envoyer un
   e-mail d'essai » : « Dernier e-mail reçu : il y a 1 min » doit apparaître.

Tant que `DOMAINE_RECEPTION` est vide, la feuille le dit et aucune adresse n'est
fabriquée.

### Le code de confirmation Gmail

Quand le vendeur ajoute son adresse VRM comme adresse de transfert, Gmail y envoie
« (#123456789) Confirmation de transfert Gmail ». VRM le lit (la règle stricte de
`api/_lib/transfert-gmail.js`, destination = SON adresse) et l'AFFICHE dans sa
feuille avec « Copier » et le lien de confirmation de Google (hôtes Google
seulement). Même chose pour le lien de vérification de Yahoo.

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
Le même Worker sert la boîte collective et le **catch-all** du domaine de réception :
il transmet le destinataire RÉEL de l'enveloppe (`message.to`) dans `envelopeTo` —
c'est lui qui désigne le vendeur (les en-têtes To/Cc d'un e-mail transféré disent
encore la boîte d'origine) — et l'en-tête `Authentication-Results` (la signature
de Google sur un code de transfert).

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

    // (11 nov., sécurité) La clé part dans un EN-TÊTE, jamais dans l'adresse :
    // une adresse est écrite dans les journaux (Vercel, proxys). La route
    // accepte encore `?key=` pour un Worker d'avant, le temps de le recoller.
    const rep = await fetch('https://usevrm.com/api/email-inbound', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-vrm-email-key': env.EMAIL_INBOUND_SECRET },
      body: JSON.stringify({
        // L'identité de l'email : deux messages d'une même conversation Vinted
        // ont souvent le même corps — sans elle, le second ne sonnait pas.
        messageId: message.headers.get('Message-ID') || email.messageId || '',
        from: (message.from) || '',
        // L'ENVELOPPE : l'adresse à laquelle CET exemplaire a été livré (une par
        // destinataire, même en catch-all). C'est elle qui désigne le vendeur.
        envelopeTo: (message.to) || '',
        to: (message.to) || '',
        authentification: message.headers.get('Authentication-Results') || message.headers.get('ARC-Authentication-Results') || '',
        subject: email.subject || '',
        text: email.text || '',
        html: email.html || '',
        attachments,
      }),
    });
    // ⚠️⚠️ SANS CES DEUX LIGNES, TOUT LE RESTE NE SERT À RIEN.
    // Une fois le `email()` terminé sans erreur, Cloudflare considère le
    // message DÉLIVRÉ et le supprime. Ignorer la réponse — ce que faisait ce
    // Worker — revient à jeter l'email dès que VRM n'a pas pu le ranger : du
    // 9 au 11 septembre 2026, base Supabase injoignable, chaque vente, chaque
    // bordereau et chaque suivi a été acquitté puis perdu. La route répond
    // maintenant 503 quand elle n'a rien pu écrire ; `throw` fait RÉESSAYER
    // l'expéditeur, qui garde le message pendant des heures.
    if (!rep.ok) throw new Error('VRM a répondu ' + rep.status + " — email non rangé, on réessaiera");
  },
};
```

> **Si tu as déjà collé ce Worker dans Cloudflare avant septembre 2026**,
> remplace-le par cette version : c'est la moitié qui manque. Le serveur peut
> bien dire « je n'ai pas pu », personne ne l'écoute tant que le Worker ne
> regarde pas la réponse.

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
