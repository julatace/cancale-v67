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
