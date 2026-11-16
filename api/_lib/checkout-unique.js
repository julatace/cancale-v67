// ═══════════════════════════════════════════════════════════════════════════
// JAMAIS DEUX ABONNEMENTS PRÉLEVÉS (16 nov., H19 de la revue serveur)
// ═══════════════════════════════════════════════════════════════════════════
// `checkout` ne refusait qu'un statut ACTIF lu dans NOTRE ligne `abonnements`.
// Deux sessions de paiement ouvertes dans deux onglets à des minutes
// différentes (la clé d'idempotence change chaque minute) pouvaient aboutir à
// deux abonnements prélevés ; et un webhook pas encore arrivé laissait notre
// ligne « pas abonné » alors que Stripe venait d'encaisser.
// Avant d'ouvrir une session, Stripe est RELU (la vérité sur l'argent) :
//   1. client connu ⇒ ses abonnements (`status=all`) : un vivant ⇒ refus ;
//   2. ses sessions de paiement des dernières 24 h, au nom de CE vendeur
//      (`client_reference_id`) : une session OUVERTE est EXPIRÉE (l'autre onglet
//      ne peut plus payer) ; une session TERMINÉE dont l'abonnement vit ⇒ refus
//      (« ton paiement vient d'aboutir »).
// « Pas su » (Stripe ne répond pas, une expiration pas confirmée) ⇒ RIEN
// n'ouvre (503) : mieux vaut un « réessaie » qu'un double prélèvement.
// Tenu par scripts/audit-serveur-robuste.cjs (H19).
// ═══════════════════════════════════════════════════════════════════════════

export const STATUTS_VIVANTS_STRIPE = new Set(['active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused']);
export const vivantChezStripe = (sub) => !!(sub && STATUTS_VIVANTS_STRIPE.has(String(sub.status || '')));

// `stripe(methode, chemin, params, idempotence)` ⇒ { ok, status, data } (api/_lib/stripe.js).
// Rend { ok: true, expirees } · { ok: false, raison: 'abonnement-vivant' | 'paiement-abouti' | 'pas-su' }.
export async function verrouCheckout({ stripe, owner, client = '', email = '', maintenant = Date.now() }) {
  if (!owner) return { ok: false, raison: 'pas-su' };
  // 1. Les abonnements du client chez Stripe, terminés compris.
  if (client) {
    const s = await stripe('GET', 'subscriptions', { customer: client, status: 'all', limit: 100 });
    if (!s || !s.ok || !s.data || !Array.isArray(s.data.data)) return { ok: false, raison: 'pas-su' };
    if (s.data.data.some(vivantChezStripe)) return { ok: false, raison: 'abonnement-vivant' };
  }
  if (!client && !email) return { ok: true, expirees: 0 };
  // 2. Ses sessions de paiement récentes.
  const filtre = client ? { customer: client } : { customer_details: { email } };
  const l = await stripe('GET', 'checkout/sessions', { ...filtre, limit: 100, created: { gte: Math.floor((maintenant - 24 * 3600e3) / 1000) } });
  if (!l || !l.ok || !l.data || !Array.isArray(l.data.data)) return { ok: false, raison: 'pas-su' };
  let expirees = 0;
  for (const cs of l.data.data) {
    if (!cs || String(cs.client_reference_id || (cs.metadata && cs.metadata.owner) || '') !== String(owner)) continue;
    if (cs.mode && cs.mode !== 'subscription') continue;
    if (cs.status === 'open') {
      const e = await stripe('POST', `checkout/sessions/${encodeURIComponent(cs.id)}/expire`, null, `vrm-exp-${cs.id}`);
      if (!e || !e.ok) {
        // Stripe refuse d'expirer une session qui vient d'être PAYÉE : ce n'est pas le moment d'en ouvrir une autre.
        return { ok: false, raison: e && e.status >= 400 && e.status < 500 ? 'paiement-abouti' : 'pas-su' };
      }
      expirees++;
    } else if (cs.status === 'complete' && cs.subscription) {
      const id = typeof cs.subscription === 'object' ? cs.subscription.id : cs.subscription;
      const sub = typeof cs.subscription === 'object' ? { ok: true, data: cs.subscription } : await stripe('GET', `subscriptions/${encodeURIComponent(id)}`);
      if (!sub || !sub.ok || !sub.data) return { ok: false, raison: 'pas-su' };
      if (vivantChezStripe(sub.data)) return { ok: false, raison: 'paiement-abouti' };
    }
  }
  return { ok: true, expirees };
}

export const MESSAGES_VERROU = {
  'abonnement-vivant': { status: 409, erreur: 'deja', message: 'Tu as déjà un abonnement en cours : rien de plus ne sera prélevé.' },
  'paiement-abouti': { status: 409, erreur: 'paiement-recent', message: 'Ton paiement vient d’aboutir : ton abonnement arrive dans un instant. Rien de plus ne sera prélevé.' },
  'pas-su': { status: 503, erreur: 'stripe-pas-su', message: "Je n'ai pas pu vérifier tes paiements en cours : rien n'a été prélevé. Réessaie dans un instant." },
};
