// ════════════════════════════════════════════════════════════════════════════
// « OUVRIR LES PAIEMENTS » — CE QUI MANQUE POUR QU'UN CLIENT PUISSE PAYER
// (12 nov., lot agent2-ouverture-clients, validé par Julien : « indispensable »)
// ════════════════════════════════════════════════════════════════════════════
// Le propriétaire de l'installation (et lui SEUL) voit dans Paramètres une liste
// ✓ / ✗ de chaque prérequis, avec le geste exact. Chaque ✓ est LU, jamais deviné :
//   · la clé Stripe (`STRIPE_SECRET_KEY`) et son mode (test / réel), lus sur Vercel ;
//   · le secret du webhook (`STRIPE_WEBHOOK_SECRET`), lu sur Vercel ;
//   · le webhook CHEZ STRIPE : la liste `webhook_endpoints` relue avec la clé —
//     l'adresse de vrm.center, activé, et les 5 événements que la route traite ;
//   · les prix Solo (16,99 €) et Pro (19,99 €) : relus chez Stripe et comparés aux
//     CGV par les règles d'api/compte.js (`prixConforme`, `offrePro`) — passés ici ;
//   · les mentions légales (public/legal/editeur.js) : `mentionsManquantes` ;
//   · l'adresse de contact (src/contact.js) ET la même dans editeur.js.
// Trois états partout : 'ok' · 'manque' · 'pas-su' (Stripe muet, fichier
// illisible). « Pas su » n'est jamais un ✓.
// Pur, sauf `lireWebhooksStripe` (une lecture Stripe, jamais une écriture).
// ════════════════════════════════════════════════════════════════════════════

// Les événements que `webhook()` d'api/compte.js traite (les autres sont acquittés
// sans effet). Un événement absent ⇒ un abonnement payé qui n'arrive jamais dans VRM.
export const EVENEMENTS_WEBHOOK = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
];
// Les deux adresses qui mènent à la route (vercel.json réécrit la première).
export const URL_WEBHOOK = 'https://vrm.center/api/stripe-webhook';
const URLS_ACCEPTEES = [URL_WEBHOOK, 'https://vrm.center/api/compte?mode=webhook'];
const normUrl = (u) => String(u || '').trim().replace(/\/+$/, '').toLowerCase();

// Un point de terminaison Stripe convient-il ? Rend la liste des événements
// manquants ([] = complet), ou null si ce n'est pas notre adresse.
export function evenementsManquants(ep) {
  if (!ep || !URLS_ACCEPTEES.map(normUrl).includes(normUrl(ep.url))) return null;
  const ev = Array.isArray(ep.enabled_events) ? ep.enabled_events.map(String) : [];
  if (ev.includes('*')) return [];
  return EVENEMENTS_WEBHOOK.filter((e) => !ev.includes(e));
}

// Lit les webhooks déclarés chez Stripe (avec la clé du serveur : ceux du MÊME
// mode que la clé). Rend { etat, url, manquants, desactive }.
export async function lireWebhooksStripe(stripeApi) {
  let r;
  try { r = await stripeApi('GET', 'webhook_endpoints', { limit: 100 }); } catch (_) { r = null; }
  if (!r || !r.ok || !r.data || !Array.isArray(r.data.data)) return { etat: 'pas-su', url: URL_WEBHOOK, manquants: null, desactive: false };
  const nos = r.data.data.map((ep) => ({ ep, manque: evenementsManquants(ep) })).filter((x) => x.manque !== null);
  if (!nos.length) return { etat: 'manque', url: URL_WEBHOOK, manquants: EVENEMENTS_WEBHOOK.slice(), desactive: false, absent: true };
  // Le meilleur : activé et complet d'abord.
  nos.sort((a, b) => (a.ep.status === 'enabled' ? 0 : 1) - (b.ep.status === 'enabled' ? 0 : 1) || a.manque.length - b.manque.length);
  const best = nos[0];
  const desactive = best.ep.status !== 'enabled';
  return { etat: !desactive && best.manque.length === 0 ? 'ok' : 'manque', url: URL_WEBHOOK, manquants: best.manque, desactive };
}

// Ce que la route `abonnement` rend au PROPRIÉTAIRE (`ouverture`). Toutes les
// entrées sont des LECTURES faites par l'appelant.
//   cle         : STRIPE_SECRET_KEY bien formée (stripePret)
//   modeTest    : true · false · null (pas de clé)
//   secret      : STRIPE_WEBHOOK_SECRET posé (whsec_…)
//   webhook     : résultat de lireWebhooksStripe, ou null (pas de clé ⇒ pas lu)
//   soloConforme: true · false · null (prixConforme du prix `vrm_mensuel`)
//   soloTexte   : le prix tel que Stripe le dit (s'il diffère)
//   pro         : { ouvert, raison, texteStripe } (offrePro)
//   manque      : mentionsManquantes (null = pas su)
//   contact     : contactEmail() de src/contact.js ('' = vide)
//   editeurEmail: le champ `email` d'editeur.js (null = pas su)
//   cleSolo     : la clé de recherche du prix Solo (STRIPE_PRICE_LOOKUP)
export function etatOuverture({ cle, modeTest, secret, webhook, soloConforme, soloTexte = null, pro, manque, contact, editeurEmail, cleSolo = 'vrm_mensuel' }) {
  const e = (ok, pasSu = false) => (pasSu ? 'pas-su' : ok ? 'ok' : 'manque');
  const contactOk = !!contact && typeof editeurEmail === 'string' && editeurEmail.trim().toLowerCase() === String(contact).trim().toLowerCase();
  const etapes = {
    mentions: { etat: manque === null || manque === undefined ? 'pas-su' : e(manque.length === 0), manquants: Array.isArray(manque) ? manque.map((x) => x.libelle || x) : null },
    contact: { etat: editeurEmail === null || editeurEmail === undefined ? (contact ? 'pas-su' : 'manque') : e(contactOk), differents: !!contact && !!editeurEmail && !contactOk },
    cle: { etat: e(!!cle), mode: cle ? (modeTest ? 'test' : 'reel') : null },
    prixSolo: { etat: !cle ? 'manque' : soloConforme === null || soloConforme === undefined ? 'pas-su' : e(soloConforme === true), texteStripe: soloConforme === false ? soloTexte : null, cle: cleSolo },
    prixPro: { etat: !cle ? 'manque' : pro && pro.ouvert ? 'ok' : pro && pro.raison === 'prix-illisible' ? 'manque' : pro ? 'manque' : 'pas-su', raison: pro ? pro.raison || null : null, texteStripe: pro && pro.texteStripe ? pro.texteStripe : null },
    secret: { etat: e(!!secret) },
    webhook: { etat: !cle ? 'manque' : webhook ? webhook.etat : 'pas-su', manquants: webhook ? webhook.manquants : null, desactive: !!(webhook && webhook.desactive), absent: !!(webhook && webhook.absent), url: URL_WEBHOOK, evenements: EVENEMENTS_WEBHOOK },
    modeReel: { etat: !cle ? 'manque' : e(modeTest === false) },
  };
  // Ce qui suffit pour qu'un paiement s'ouvre (en test comme en réel) : la même
  // porte que `checkout` (clé, prix Solo conforme, mentions) + de quoi RECEVOIR
  // le paiement (secret et webhook) — sans eux, un client paie et VRM ne le voit pas.
  const porte = ['mentions', 'contact', 'cle', 'prixSolo', 'secret', 'webhook'];
  const ouvertTest = porte.every((k) => etapes[k].etat === 'ok');
  return { etapes, ouvertTest, ouvertClients: ouvertTest && etapes.modeReel.etat === 'ok' };
}
