// ── /api/compte — santé du serveur ET abonnement du vendeur ──────────────────
// ⚠️ POURQUOI UNE SEULE FONCTION : le plan Vercel Hobby plafonne à 12 fonctions
// serverless et le projet en a 12 (voir api/ebay.js). `api/sante.js` est devenu
// le mode par défaut d'ici ; vercel.json garde les adresses publiques :
//   /api/sante            → ?mode=sante       (GET, public, oui/non seulement)
//   /api/stripe-webhook   → ?mode=webhook     (POST, Stripe, SIGNÉ)
//   /api/compte?mode=abonnement   (GET, session)  statut de MON abonnement
//   /api/compte?mode=checkout     (POST, session) ouvre le paiement Stripe
//   /api/compte?mode=portail      (POST, session) changer de carte (page Stripe)
//   /api/compte?mode=factures     (GET, session)  MES factures et MA carte
//   /api/compte?mode=resilier     (POST, session) résilier à la fin de la période
//   /api/compte?mode=reprendre    (POST, session) annuler la résiliation
//
// L'abonnement (Julien, 4 octobre) : 9,99 € par mois, prélevé chaque mois à la
// date où la personne s'abonne, pour TOUT LE MONDE SAUF LUI (le propriétaire
// déclaré dans la base, `vrm_reglages`).
// ⚠️ Qui est qui : le serveur ne croit jamais un identifiant envoyé par le
//    navigateur — il prend le jeton de session et demande à Supabase (session.js).
// ⚠️ Le statut ne s'écrit QUE sur un événement Stripe dont la signature est
//    vérifiée, dans une table que le vendeur peut lire mais pas écrire
//    (supabase/migrations/005-abonnements.sql). Sinon on s'abonnerait soi-même
//    depuis la console du navigateur.
import { utilisateurDe, jetonDe } from './_lib/session.js';
import { stripeApi, stripePret, stripeModeTest, signatureValide, finPeriode } from './_lib/stripe.js';
import { sbCle } from './_lib/cle.js';

export const config = { api: { bodyParser: false } };

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
const ANON = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxnb254enJ6amNxdGhqdGJkcHpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1ODIyMjYsImV4cCI6MjA5NTE1ODIyNn0.QJQSKILJLEpbDvBP4w7xD-olxoUjX1H2rxrYdo63GWQ';
// L'adresse de retour après paiement est FIXE : jamais l'en-tête Origin de la
// requête (on ne renvoie personne vers un site choisi par l'appelant).
const APP_URL = 'https://vrm.center';
const PRIX_CLE = process.env.STRIPE_PRICE_LOOKUP || 'vrm_mensuel';
// ⚠️ QUI A ACCÈS, SI C'EST OBLIGATOIRE, QUI EST LE PROPRIÉTAIRE : la BASE le
//    dit (`vrm_acces`, supabase/migrations/006-acces-abonnement.sql) — la même
//    règle qui ferme ses lignes (RLS) et qui coupe notifications et widget.
//    Ces réponses vivaient ici dans deux variables d'environnement : l'écran
//    aurait pu dire « abonné » pendant que la base refusait ses données (§11).
//    Le réglage `abonnement_obligatoire` vaut '0' : rien n'est bloqué tant que
//    Julien ne l'a pas passé à '1' (Stripe en mode réel, CGV à jour).
// Un abonnement « vivant » pour Stripe (la carte d'abonnement) : `past_due`,
// Stripe réessaie le prélèvement — on ne propose pas un second abonnement.
const STATUTS_ACTIFS = new Set(['active', 'trialing', 'past_due']);
export const abonnementActif = (statut) => STATUTS_ACTIFS.has(String(statut || ''));

// `{ obligatoire, proprietaire, acces }` lu avec le jeton du vendeur ;
// `undefined` = pas su (on ne devine pas une réponse sur l'accès).
async function accesDe(req) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/vrm_acces`, {
      method: 'POST',
      headers: { apikey: ANON, Authorization: `Bearer ${jetonDe(req)}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!r.ok) return undefined;
    const j = await r.json();
    if (!j || typeof j !== 'object' || typeof j.acces !== 'boolean') return undefined;
    return { obligatoire: j.obligatoire === true, proprietaire: j.proprietaire === true, acces: j.acces };
  } catch (_) { return undefined; }
}

const repondre = (res, code, corps) => { res.status(code).json(corps); };

// La ligne d'abonnement du vendeur. Lue avec SON jeton (RLS : il ne voit que la
// sienne) — aucune clé de service n'est nécessaire pour ça. `undefined` = pas
// su (lecture ratée), `null` = aucune ligne, sinon la ligne.
async function ligneDe(req) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/abonnements?select=statut,client_stripe,abonnement_stripe,fin_periode,annule_fin_periode,mode_test&limit=1`, {
      headers: { apikey: ANON, Authorization: `Bearer ${jetonDe(req)}` },
    });
    if (!r.ok) return undefined;
    const j = await r.json();
    if (!Array.isArray(j)) return undefined;
    return j[0] || null;
  } catch (_) { return undefined; }
}

async function lirePrix() {
  const r = await stripeApi('GET', 'prices', { 'lookup_keys[]': PRIX_CLE, active: 'true', limit: 1 });
  const p = r.ok && r.data && Array.isArray(r.data.data) ? r.data.data[0] : null;
  return p && p.id ? { id: p.id, montant: (p.unit_amount || 0) / 100, devise: p.currency, intervalle: p.recurring && p.recurring.interval } : null;
}

// ── Corps BRUT (la signature Stripe porte sur l'octet près) ─────────────────
async function corpsBrut(req) {
  // ⚠️ On lit le FLUX d'abord : toucher `req.body` sur Vercel déclenche son
  //    analyse JSON, et un JSON re-sérialisé ne correspond plus à la signature.
  const morceaux = [];
  try { for await (const c of req) morceaux.push(Buffer.isBuffer(c) ? c : Buffer.from(c)); } catch (_) {}
  if (morceaux.length) return Buffer.concat(morceaux);
  const b = req.rawBody || req.body;
  if (Buffer.isBuffer(b)) return b;
  if (typeof b === 'string') return Buffer.from(b, 'utf8');
  return null;   // déjà analysé en objet : impossible de vérifier, on refuse
}

// ── Écrire le statut (clé de service — elle seule écrit cette table) ────────
async function ecrireStatut(owner, ligne, evenementTs) {
  const SERVICE = process.env.SUPABASE_SERVICE_KEY || '';
  if (!SERVICE) return { ok: false, code: 'sans-cle' };
  const h = { ...sbCle(SERVICE), 'Content-Type': 'application/json' };
  // Les webhooks arrivent dans le désordre : un événement plus ANCIEN que celui
  // déjà appliqué n'écrase rien (sinon un vieux « incomplete » effacerait un
  // « active » arrivé avant lui).
  let avant = null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/abonnements?owner=eq.${encodeURIComponent(owner)}&select=evenement_ts,impaye_depuis`, { headers: h });
    if (!r.ok) return { ok: false, code: 'lecture' };
    const j = await r.json();
    if (!Array.isArray(j)) return { ok: false, code: 'lecture' };
    avant = j[0] || null;
    if (avant && Number(avant.evenement_ts) > evenementTs) return { ok: true, ignore: 'plus-ancien' };
  } catch (_) { return { ok: false, code: 'lecture' }; }
  // Depuis quand le prélèvement échoue : la base laisse 14 jours (Stripe
  // réessaie pendant ce temps), puis coupe. On garde la PREMIÈRE date d'échec —
  // chaque nouvel essai raté de Stripe ne doit pas relancer les 14 jours — et on
  // l'efface dès que le statut n'est plus « impayé ».
  const impaye_depuis = ligne.statut === 'past_due'
    ? ((avant && avant.impaye_depuis) || new Date((evenementTs || Math.floor(Date.now() / 1000)) * 1000).toISOString())
    : null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/abonnements?on_conflict=owner`, {
      method: 'POST',
      headers: { ...h, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ owner, ...ligne, impaye_depuis, evenement_ts: evenementTs, maj: new Date().toISOString() }]),
    });
    if (r.ok) return { ok: true };
    const t = await r.text().catch(() => '');
    // 23503 : ce vendeur n'existe pas (compte VRM supprimé) — réessayer n'y
    // changera rien, on l'acquitte et on le dit dans les journaux.
    if (/23503/.test(t)) return { ok: true, ignore: 'vendeur-inconnu' };
    return { ok: false, code: 'ecriture-' + r.status };
  } catch (_) { return { ok: false, code: 'ecriture' }; }
}

// Le propriétaire VRM d'un abonnement Stripe : posé par NOUS dans `metadata`
// au moment du paiement (depuis une session vérifiée) — jamais deviné. En repli,
// la ligne qui porte déjà ce client Stripe.
async function proprietaireDe(sub, client) {
  const m = sub && sub.metadata && sub.metadata.owner;
  if (m && /^[0-9a-f-]{36}$/i.test(m)) return m;
  const SERVICE = process.env.SUPABASE_SERVICE_KEY || '';
  if (!client || !SERVICE) return '';
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/abonnements?client_stripe=eq.${encodeURIComponent(client)}&select=owner&limit=1`, { headers: sbCle(SERVICE) });
    if (!r.ok) return '';
    const j = await r.json();
    return (j[0] && j[0].owner) || '';
  } catch (_) { return ''; }
}

const ligneDeLAbonnement = (sub, livemode) => ({
  statut: String(sub.status || 'incomplete'),
  client_stripe: typeof sub.customer === 'string' ? sub.customer : (sub.customer && sub.customer.id) || null,
  abonnement_stripe: sub.id || null,
  fin_periode: finPeriode(sub),
  annule_fin_periode: !!(sub.cancel_at_period_end || sub.cancel_at),
  mode_test: !livemode,
});

async function webhook(req, res) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET || '';
  if (!secret) return repondre(res, 503, { erreur: 'webhook non configuré' });
  const brut = await corpsBrut(req);
  const entete = (req.headers && (req.headers['stripe-signature'] || req.headers['Stripe-Signature'])) || '';
  if (!brut || !signatureValide(brut, entete, secret)) return repondre(res, 400, { erreur: 'signature invalide' });
  let ev;
  try { ev = JSON.parse(brut.toString('utf8')); } catch (_) { return repondre(res, 400, { erreur: 'corps illisible' }); }
  const type = String(ev.type || ''), obj = (ev.data && ev.data.object) || {}, ts = Number(ev.created) || 0;

  let sub = null;
  if (type.startsWith('customer.subscription.')) sub = obj;
  else if (type === 'checkout.session.completed' && obj.mode === 'subscription' && obj.subscription) {
    // La session porte l'identifiant ; l'état complet vient de Stripe.
    const subId = typeof obj.subscription === 'string' ? obj.subscription : obj.subscription.id;
    const r = await stripeApi('GET', `subscriptions/${encodeURIComponent(subId)}`);
    if (!r.ok) return repondre(res, 503, { erreur: 'abonnement illisible chez Stripe', reessayer: true });
    sub = r.data;
    // Le propriétaire de la session (client_reference_id) fait foi s'il manque.
    if (!(sub.metadata && sub.metadata.owner) && obj.client_reference_id) sub.metadata = { ...(sub.metadata || {}), owner: obj.client_reference_id };
  } else {
    // invoice.* : le statut qui compte arrive par customer.subscription.updated.
    return repondre(res, 200, { recu: true, ignore: type });
  }

  const client = typeof sub.customer === 'string' ? sub.customer : (sub.customer && sub.customer.id) || '';
  const owner = await proprietaireDe(sub, client);
  if (!owner) { console.warn('[stripe] abonnement sans propriétaire VRM', sub.id); return repondre(res, 200, { recu: true, ignore: 'sans-proprietaire' }); }
  const ecrit = await ecrireStatut(owner, ligneDeLAbonnement(sub, !!ev.livemode), ts);
  // ⚠️ Tant que le statut n'est pas RANGÉ, on ne dit pas « reçu » : un 5xx fait
  //    réessayer Stripe (la leçon d'api/email-inbound, §5).
  if (!ecrit.ok) return repondre(res, 503, { erreur: 'statut non enregistré', detail: ecrit.code, reessayer: true });
  if (ecrit.ignore) console.warn('[stripe] événement acquitté sans écriture :', ecrit.ignore, sub.id);
  return repondre(res, 200, { recu: true });
}

async function abonnement(req, res) {
  const u = await utilisateurDe(req);
  if (!u) return repondre(res, 401, { erreur: 'session' });
  const [acc, ligne] = await Promise.all([accesDe(req), ligneDe(req)]);
  if (acc === undefined || ligne === undefined) return repondre(res, 503, { erreur: 'base-injoignable', message: "Je n'ai pas pu lire ton abonnement. Réessaie dans un instant." });
  const prix = stripePret() ? await lirePrix() : null;
  return repondre(res, 200, {
    ok: true,
    proprietaire: acc.proprietaire,
    configure: stripePret(),
    modeTest: stripePret() ? stripeModeTest() : null,
    obligatoire: acc.obligatoire,
    prix: prix ? { montant: prix.montant, devise: prix.devise, intervalle: prix.intervalle } : null,
    statut: ligne ? ligne.statut : null,
    finPeriode: ligne ? ligne.fin_periode : null,
    annuleFinPeriode: ligne ? !!ligne.annule_fin_periode : false,
    peutGerer: !!(ligne && ligne.client_stripe),
    // `actif` : l'abonnement est vivant chez Stripe (ce que dit la carte).
    // `acces` : la base laisse entrer (ce que décide la porte) — LA règle.
    actif: acc.proprietaire || !!(ligne && abonnementActif(ligne.statut)),
    acces: acc.acces,
  });
}

async function checkout(req, res) {
  const u = await utilisateurDe(req);
  if (!u) return repondre(res, 401, { erreur: 'session' });
  if (!stripePret()) return repondre(res, 503, { erreur: 'stripe', message: "Le paiement n'est pas encore branché." });
  const [acc, ligne] = await Promise.all([accesDe(req), ligneDe(req)]);
  if (acc === undefined || ligne === undefined) return repondre(res, 503, { erreur: 'base-injoignable', message: "Je n'ai pas pu vérifier ton abonnement. Réessaie dans un instant." });
  if (acc.proprietaire) return repondre(res, 409, { erreur: 'proprietaire', message: 'Ton compte est gratuit : rien à payer.' });
  // Jamais deux abonnements pour un vendeur : déjà actif ⇒ on l'envoie gérer.
  if (ligne && abonnementActif(ligne.statut)) return repondre(res, 409, { erreur: 'deja', message: 'Tu es déjà abonné.' });
  const prix = await lirePrix();
  if (!prix) return repondre(res, 503, { erreur: 'prix', message: "Le prix de l'abonnement est introuvable chez Stripe." });
  const params = {
    mode: 'subscription',
    line_items: [{ price: prix.id, quantity: 1 }],
    success_url: `${APP_URL}/?tab=settings&vue=compte&abonnement=merci`,
    cancel_url: `${APP_URL}/?tab=settings&vue=compte&abonnement=annule`,
    client_reference_id: u.id,
    metadata: { owner: u.id, app: 'vrm' },
    subscription_data: { metadata: { owner: u.id, app: 'vrm' } },
    locale: 'fr',
  };
  if (ligne && ligne.client_stripe) params.customer = ligne.client_stripe;
  else if (u.email) params.customer_email = u.email;
  // Un double clic ne crée pas deux sessions (même clé dans la même minute).
  const r = await stripeApi('POST', 'checkout/sessions', params, `vrm-co-${u.id}-${Math.floor(Date.now() / 60000)}`);
  if (!r.ok || !r.data.url) return repondre(res, 502, { erreur: 'stripe', message: "Stripe n'a pas pu ouvrir le paiement. Réessaie dans un instant." });
  return repondre(res, 200, { url: r.data.url });
}

async function portail(req, res) {
  const u = await utilisateurDe(req);
  if (!u) return repondre(res, 401, { erreur: 'session' });
  if (!stripePret()) return repondre(res, 503, { erreur: 'stripe', message: "Le paiement n'est pas encore branché." });
  const ligne = await ligneDe(req);
  if (ligne === undefined) return repondre(res, 503, { erreur: 'base-injoignable', message: "Je n'ai pas pu lire ton abonnement. Réessaie dans un instant." });
  if (!ligne || !ligne.client_stripe) return repondre(res, 404, { erreur: 'aucun', message: "Tu n'as pas encore d'abonnement." });
  const r = await stripeApi('POST', 'billing_portal/sessions', { customer: ligne.client_stripe, return_url: `${APP_URL}/?tab=settings&vue=compte` });
  if (!r.ok || !r.data.url) return repondre(res, 502, { erreur: 'stripe', message: "Stripe n'a pas pu ouvrir la page de gestion. Réessaie dans un instant." });
  return repondre(res, 200, { url: r.data.url });
}

// ── MES FACTURES ET MA CARTE (onglet « Mon compte », 4 octobre) ─────────────
// Julien : « un onglet pour gérer l'abonnement et les factures dans les
// paramètres, avec ses infos de compte regroupées ».
// ⚠️ Le client Stripe vient de SA ligne d'abonnement (lue avec son jeton, RLS) :
//    jamais d'un identifiant envoyé par le navigateur — sinon on lirait les
//    factures d'un autre en changeant un paramètre.
const URL_STRIPE = /^https:\/\/(pay|invoice|files|invoicedata)\.stripe\.com\//;
const lienStripe = (u) => (typeof u === 'string' && URL_STRIPE.test(u) ? u : null);
export const factureLisible = (f) => ({
  id: String(f.id || ''),
  numero: f.number || null,
  date: f.created ? new Date(f.created * 1000).toISOString() : null,
  // Le montant FACTURÉ (total), pas ce qui reste à payer : une facture payée
  // dirait sinon « 0,00 € ».
  montant: Number.isFinite(f.total) ? f.total / 100 : null,
  devise: f.currency || 'eur',
  statut: String(f.status || ''),
  pdf: lienStripe(f.invoice_pdf),
  page: lienStripe(f.hosted_invoice_url),
});
export const carteLisible = (pm) => {
  const c = pm && pm.card;
  if (!c) return null;
  return { marque: String(c.display_brand || c.brand || ''), fin: String(c.last4 || ''), mois: c.exp_month || null, annee: c.exp_year || null };
};

async function factures(req, res) {
  const u = await utilisateurDe(req);
  if (!u) return repondre(res, 401, { erreur: 'session' });
  if (!stripePret()) return repondre(res, 503, { erreur: 'stripe', message: "Le paiement n'est pas encore branché." });
  const ligne = await ligneDe(req);
  if (ligne === undefined) return repondre(res, 503, { erreur: 'base-injoignable', message: "Je n'ai pas pu lire ton abonnement. Réessaie dans un instant." });
  // Aucun client Stripe = jamais abonné : la liste est VRAIMENT vide (on le sait).
  if (!ligne || !ligne.client_stripe) return repondre(res, 200, { ok: true, factures: [], carte: null });
  const [rf, rs] = await Promise.all([
    stripeApi('GET', 'invoices', { customer: ligne.client_stripe, limit: 24 }),
    ligne.abonnement_stripe
      ? stripeApi('GET', `subscriptions/${encodeURIComponent(ligne.abonnement_stripe)}`, { 'expand[]': 'default_payment_method' })
      : Promise.resolve(null),
  ]);
  // « Pas su » ne vaut pas « aucune facture » : une lecture ratée chez Stripe
  // répond une erreur, jamais une liste vide.
  if (!rf.ok || !rf.data || !Array.isArray(rf.data.data)) return repondre(res, 502, { erreur: 'stripe', message: "Stripe n'a pas répondu pour tes factures. Réessaie dans un instant." });
  const liste = rf.data.data
    .filter((f) => f && f.status !== 'draft' && f.customer === ligne.client_stripe)
    .map(factureLisible);
  let carte = null;
  if (rs && rs.ok && rs.data && rs.data.customer === ligne.client_stripe) carte = carteLisible(rs.data.default_payment_method);
  if (!carte) {
    // Repli : la carte par défaut du client (celle posée depuis le portail).
    const rc = await stripeApi('GET', `customers/${encodeURIComponent(ligne.client_stripe)}`, { 'expand[]': 'invoice_settings.default_payment_method' });
    if (rc.ok && rc.data && rc.data.invoice_settings) carte = carteLisible(rc.data.invoice_settings.default_payment_method);
  }
  return repondre(res, 200, { ok: true, factures: liste, carte });
}

// ── RÉSILIER / REPRENDRE, DIRECTEMENT DEPUIS L'APP ──────────────────────────
// Julien : « il peut le résilier s'il le veut ». En France, un contrat conclu
// en ligne doit pouvoir être résilié en ligne, simplement (loi du 16 août
// 2022) : on ne renvoie pas la personne chercher le bouton chez Stripe.
// La résiliation prend effet à la FIN DE LA PÉRIODE payée (le portail est réglé
// pareil : `at_period_end`, sans prorata) — l'accès reste jusque-là, et aucun
// autre prélèvement ne part. « Reprendre » annule la résiliation tant que la
// période n'est pas finie.
async function resilier(req, res, reprendre) {
  const u = await utilisateurDe(req);
  if (!u) return repondre(res, 401, { erreur: 'session' });
  if (!stripePret()) return repondre(res, 503, { erreur: 'stripe', message: "Le paiement n'est pas encore branché." });
  const ligne = await ligneDe(req);
  if (ligne === undefined) return repondre(res, 503, { erreur: 'base-injoignable', message: "Je n'ai pas pu lire ton abonnement. Réessaie dans un instant." });
  if (!ligne || !ligne.abonnement_stripe || !ligne.client_stripe) return repondre(res, 404, { erreur: 'aucun', message: "Tu n'as pas d'abonnement en cours." });
  // L'abonnement doit être CELUI de ce client, et encore vivant.
  const lu = await stripeApi('GET', `subscriptions/${encodeURIComponent(ligne.abonnement_stripe)}`);
  if (!lu.ok || !lu.data) return repondre(res, 502, { erreur: 'stripe', message: "Stripe n'a pas répondu. Réessaie dans un instant." });
  if (lu.data.customer !== ligne.client_stripe) return repondre(res, 403, { erreur: 'pas-a-toi' });
  if (!abonnementActif(lu.data.status)) return repondre(res, 409, { erreur: 'fini', message: "Ton abonnement est déjà terminé." });
  const r = await stripeApi('POST', `subscriptions/${encodeURIComponent(ligne.abonnement_stripe)}`,
    { cancel_at_period_end: reprendre ? 'false' : 'true' },
    `vrm-${reprendre ? 'rep' : 'res'}-${u.id}-${Math.floor(Date.now() / 60000)}`);
  if (!r.ok || !r.data || !r.data.id) return repondre(res, 502, { erreur: 'stripe', message: "Stripe n'a pas pu enregistrer ton choix. Réessaie dans un instant." });
  // Le webhook mettra la ligne à jour ; on l'écrit aussi tout de suite, depuis
  // la réponse de Stripe elle-même, pour que l'écran rouvert dise juste. Une
  // écriture ratée ici n'est pas grave : le webhook la refera.
  await ecrireStatut(u.id, ligneDeLAbonnement(r.data, !!r.data.livemode), Math.floor(Date.now() / 1000)).catch(() => {});
  const l = ligneDeLAbonnement(r.data, !!r.data.livemode);
  return repondre(res, 200, { ok: true, annuleFinPeriode: l.annule_fin_periode, finPeriode: l.fin_periode });
}

// ── Santé : seulement des OUI/NON (route publique) ──────────────────────────
function sante(req, res) {
  res.setHeader('Referrer-Policy', 'no-referrer');
  return repondre(res, 200, {
    ok: true,
    serviceKey: !!process.env.SUPABASE_SERVICE_KEY,
    owner: !!process.env.VRM_OWNER_UID,
    ia: !!process.env.AI_API_KEY,
    detourage: !!process.env.PHOTOROOM_API_KEY,
    stripe: stripePret(),
    stripeWebhook: !!process.env.STRIPE_WEBHOOK_SECRET,
  });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const mode = String((req.query && req.query.mode) || 'sante');
  const m = req.method;
  if (mode === 'sante') return m === 'GET' ? sante(req, res) : repondre(res, 405, { erreur: 'GET seulement' });
  if (mode === 'webhook') return m === 'POST' ? webhook(req, res) : repondre(res, 405, { erreur: 'POST seulement' });
  if (mode === 'abonnement') return m === 'GET' ? abonnement(req, res) : repondre(res, 405, { erreur: 'GET seulement' });
  if (mode === 'checkout') return m === 'POST' ? checkout(req, res) : repondre(res, 405, { erreur: 'POST seulement' });
  if (mode === 'portail') return m === 'POST' ? portail(req, res) : repondre(res, 405, { erreur: 'POST seulement' });
  if (mode === 'factures') return m === 'GET' ? factures(req, res) : repondre(res, 405, { erreur: 'GET seulement' });
  if (mode === 'resilier') return m === 'POST' ? resilier(req, res, false) : repondre(res, 405, { erreur: 'POST seulement' });
  if (mode === 'reprendre') return m === 'POST' ? resilier(req, res, true) : repondre(res, 405, { erreur: 'POST seulement' });
  return repondre(res, 404, { erreur: 'mode inconnu' });
}
