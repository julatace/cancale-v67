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
//   /api/compte?mode=session-extension (POST, session) une session À ELLE pour
//                                 l'extension Chrome (même vendeur, autre famille)
//   /api/compte?mode=fermer       (POST, session) FERMER MON COMPTE : résilie,
//                                 efface ses données, puis son compte (refusé au
//                                 propriétaire de l'installation)
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
import { utilisateurDe, jetonDe, vendeurExige } from './_lib/session.js';
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

// La version des CGV acceptées : la date de « Dernière mise à jour » de
// public/legal/cgv.html (audit-lancement vérifie qu'elles concordent).
const CGV_VERSION = '2026-10-04';
async function checkout(req, res) {
  const u = await utilisateurDe(req);
  if (!u) return repondre(res, 401, { erreur: 'session' });
  // ⚠️ LES CGV S'ACCEPTENT DANS VRM, AVANT STRIPE (décision du 6 octobre). La
  //    case de Stripe dépend d'un réglage de son tableau de bord (adresse des
  //    conditions) : tant qu'il manque, Stripe refusait d'ouvrir le paiement et
  //    personne ne pouvait s'abonner. L'acceptation est donc exigée ICI (case
  //    cochée dans l'app, `cgv: true`), datée et rangée dans les métadonnées de
  //    l'abonnement — c'est elle qui rend les CGV opposables. La case de Stripe
  //    reste demandée en plus quand il sait l'afficher.
  const corps = await lireCorpsJson(req);
  if (!corps || corps.cgv !== true) return repondre(res, 400, { erreur: 'cgv', message: "Coche « J'accepte les conditions générales de vente » avant de payer." });
  const accepteLe = new Date().toISOString();
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
    metadata: { owner: u.id, app: 'vrm', cgv_version: CGV_VERSION, cgv_acceptees_le: accepteLe },
    subscription_data: { metadata: { owner: u.id, app: 'vrm', cgv_version: CGV_VERSION, cgv_acceptees_le: accepteLe } },
    locale: 'fr',
    // ⚠️ LES CGV SE FONT ACCEPTER AVANT DE PAYER (5 octobre). Un abonnement
    //    vendu en ligne sans case « j'accepte les conditions de vente » n'a pas
    //    de CGV opposables : la case est OBLIGATOIRE (`required`), Stripe
    //    refuse le paiement tant qu'elle n'est pas cochée, et le lien mène à
    //    NOS CGV (public/legal/cgv.html), pas à un texte générique.
    // ⚠️ Stripe exige en plus l'adresse des conditions dans son tableau de bord
    //    (Paramètres → Détails publics). Tant qu'elle manque, il refuse d'ouvrir
    //    le paiement — c'est dit plus bas, jamais contourné en retirant la case.
    consent_collection: { terms_of_service: 'required' },
    custom_text: { terms_of_service_acceptance: { message: `J'accepte les [conditions générales de vente de VRM](${APP_URL}/legal/cgv.html).` } },
  };
  if (ligne && ligne.client_stripe) params.customer = ligne.client_stripe;
  else if (u.email) params.customer_email = u.email;
  // Un double clic ne crée pas deux sessions (même clé dans la même minute).
  const cle = `vrm-co-${u.id}-${Math.floor(Date.now() / 60000)}`;
  let r = await stripeApi('POST', 'checkout/sessions', params, cle);
  // L'adresse des CGV n'est pas encore réglée chez Stripe : sa case ne peut pas
  // s'afficher. Les CGV ont DÉJÀ été acceptées dans VRM (ci-dessus, datées) :
  // on ouvre le paiement sans la case de Stripe (autre clé d'idempotence :
  // Stripe refuse de rejouer une clé avec d'autres paramètres), et on le note
  // pour le propriétaire.
  const erreurStripe = String((r.data && r.data.error && r.data.error.message) || '');
  if (!r.ok && /terms of service/i.test(erreurStripe)) {
    console.warn('[stripe] case CGV de Stripe indisponible (adresse absente : Stripe → Paramètres → Détails publics → Conditions =', `${APP_URL}/legal/cgv.html) — CGV acceptées dans VRM, paiement ouvert sans la case de Stripe`);
    const sansCase = { ...params };
    delete sansCase.consent_collection;
    delete sansCase.custom_text;
    r = await stripeApi('POST', 'checkout/sessions', sansCase, cle + '-vrm');
  }
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

// ── UNE SESSION À ELLE POUR L'EXTENSION (« session fourchée », 5 octobre) ───
// ⚠️ POURQUOI : l'app passait à l'extension SA PROPRE session (jeton d'accès ET
//    jeton de renouvellement). Les deux renouvelaient donc la MÊME famille de
//    jetons. Or Supabase fait tourner le jeton de renouvellement : chaque
//    renouvellement consomme l'ancien. Celle des deux qui renouvelle en second
//    présente un jeton déjà consommé → refusé (`refresh_token_already_used`) :
//    elle est déconnectée et réessaie — les journaux d'auth de la production
//    montrent ces refus et des rafales de 429 ; selon la configuration, Supabase
//    révoque en plus la famille entière (il croit à un vol de jeton), et l'app
//    tombe avec elle. Mesuré sur un GoTrue v2.197 local : après deux rotations,
//    l'ancien jeton est bien refusé avec cette erreur-là.
// ⇒ L'extension reçoit une session INDÉPENDANTE, fabriquée ici pour le MÊME
//    vendeur : un lien magique généré côté serveur (`admin/generate_link`,
//    AUCUN email envoyé), aussitôt échangé (`verify`) contre une session neuve
//    — autre `session_id`, autre famille. Chacune renouvelle la sienne ; la
//    révocation de l'une ne touche pas l'autre (prouvé : audit
//    `scripts/audit-session-extension.cjs --local`).
//
// ⚠️ QUI : la session de l'appelant, vérifiée par Supabase (vendeurExige). Son
//    ADRESSE vient de la réponse de Supabase sur ce jeton (/auth/v1/user) —
//    JAMAIS du corps ni de l'adresse de la requête (le corps n'est même pas lu) :
//    sinon on fabriquerait la session de n'importe qui en tapant son email.
//    Et on vérifie deux fois que la session fabriquée est bien à LUI (le lien
//    généré, puis la session rendue) : un écart ⇒ refus, aucun jeton rendu.
// ⚠️ CE QUE ÇA N'OUVRE PAS : une faille XSS dans l'app lirait déjà le jeton de
//    renouvellement de l'app dans le stockage du navigateur — cette route ne
//    donne donc aucun pouvoir de plus à qui détient déjà une session. La
//    connexion propre de l'extension (sa fenêtre, email + mot de passe VRM)
//    reste disponible : ceci n'en est que le raccourci.
// ⚠️ CE QUI NE SORT JAMAIS : `hashed_token`, `email_otp`, `action_link` (de quoi
//    ouvrir une session à volonté) ni le reste de la fiche Supabase. On rend
//    cinq champs, construits ici, et aucun secret n'est écrit dans les journaux.
// ⚠️ Effet de bord, mesuré sur le GoTrue local : générer un lien magique
//    invalide un lien de réinitialisation de mot de passe encore en attente pour
//    ce compte (`otp_expired` : Supabase n'en garde qu'un). Sans conséquence pour
//    quelqu'un déjà connecté — il n'a qu'à redemander le sien.
const FORK_MAX = 6;                 // sessions fabriquées par vendeur…
const FORK_FENETRE = 3600 * 1000;   // …par heure glissante
const FORK_DELAI = 5000;            // chaque appel à Supabase, au plus 5 s
// Frein PAR INSTANCE, en mémoire du module : Vercel peut en faire tourner
// plusieurs, et une instance froide repart de zéro. C'est voulu — c'est un frein
// doux contre une boucle de l'extension (qui ferait sinon tourner des sessions
// à la chaîne), pas un état qui doit survivre ; il n'y a donc rien à ranger en
// base. Le vrai verrou est la session de l'appelant.
const forksRecents = new Map();     // id vendeur → horodatages des essais
function freinFork(uid) {
  const maintenant = Date.now();
  if (forksRecents.size > 5000) {
    for (const [k, v] of forksRecents) if (!v.some((t) => maintenant - t < FORK_FENETRE)) forksRecents.delete(k);
  }
  const recents = (forksRecents.get(uid) || []).filter((t) => maintenant - t < FORK_FENETRE);
  if (recents.length >= FORK_MAX) { forksRecents.set(uid, recents); return Math.ceil((recents[0] + FORK_FENETRE - maintenant) / 1000); }
  recents.push(maintenant);
  forksRecents.set(uid, recents);
  return 0;
}

// Un appel à l'authentification de Supabase. Rend l'objet JSON, ou `null` si
// Supabase a refusé, n'a pas répondu à temps ou a rendu autre chose que du JSON.
// ⚠️ Le corps de la réponse n'est JAMAIS journalisé (il porte des secrets).
async function appelAuth(chemin, entetes, corps) {
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/${chemin}`, {
      method: 'POST',
      headers: { ...entetes, 'Content-Type': 'application/json' },
      body: JSON.stringify(corps),
      signal: AbortSignal.timeout(FORK_DELAI),
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j && typeof j === 'object' && !Array.isArray(j) ? j : null;
  } catch (_) { return null; }
}

// Une session fabriquée qu'on ne rend pas ne doit pas rester vivante : on la
// ferme (au mieux — un échec ici ne change rien à la réponse, déjà un refus).
async function fermerSession(jeton) {
  if (typeof jeton !== 'string' || jeton.split('.').length !== 3) return;
  try {
    await fetch(`${SUPABASE_URL}/auth/v1/logout?scope=local`, {
      method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${jeton}` }, signal: AbortSignal.timeout(FORK_DELAI),
    });
  } catch (_) {}
}

const REESSAIE = "Je n'ai pas pu préparer la connexion de l'extension. Réessaie dans un instant.";

async function sessionExtension(req, res) {
  const SERVICE = process.env.SUPABASE_SERVICE_KEY || '';
  // Sans clé de service, impossible de fabriquer quoi que ce soit : on le dit
  // tout de suite, sans aucun appel.
  if (!SERVICE) return repondre(res, 503, { erreur: 'non-configure', message: "La connexion automatique de l'extension n'est pas encore branchée sur le serveur. Connecte-toi depuis la fenêtre de l'extension." });
  const u = await vendeurExige(req, res);   // 401 déjà répondu, aucun appel d'administration
  if (!u) return;
  // L'adresse vient de Supabase (la fiche de CE jeton), jamais de la requête.
  const email = String(u.email || '').trim();
  if (!email) return repondre(res, 409, { erreur: 'sans-email', message: "Ton compte VRM n'a pas d'adresse email : connecte l'extension depuis sa fenêtre." });
  if (!u.emailConfirme) return repondre(res, 409, { erreur: 'email-non-confirme', message: "Ton adresse email n'est pas encore confirmée : clique le lien reçu par email, puis réessaie." });
  const attente = freinFork(u.id);
  if (attente) {
    res.setHeader('Retry-After', String(attente));
    return repondre(res, 429, { erreur: 'trop-souvent', message: "L'extension a demandé sa connexion trop souvent. Réessaie dans un moment." });
  }

  // 1) Le lien magique, généré côté serveur — aucun email ne part.
  const lien = await appelAuth('admin/generate_link', sbCle(SERVICE), { type: 'magiclink', email });
  const idLien = String((lien && (lien.id || (lien.user && lien.user.id))) || '');
  const hache = lien && typeof lien.hashed_token === 'string' ? lien.hashed_token : '';
  // ⚠️ `magiclink` seulement : `signup` voudrait dire que Supabase vient de
  //    CRÉER un compte pour cette adresse — ce n'est plus la personne connectée.
  if (!lien || !hache || lien.verification_type !== 'magiclink') return repondre(res, 502, { erreur: 'auth', message: REESSAIE });
  if (idLien !== u.id) { console.warn('[session-extension] lien généré pour un autre compte — refusé'); return repondre(res, 502, { erreur: 'identite', message: REESSAIE }); }

  // 2) Échangé aussitôt contre une session NEUVE (clé publique, comme le
  //    navigateur le ferait en cliquant le lien).
  const v = await appelAuth('verify', sbCle(ANON), { type: 'magiclink', token_hash: hache });
  if (!v) return repondre(res, 502, { erreur: 'auth', message: REESSAIE });
  const acces = typeof v.access_token === 'string' ? v.access_token : '';
  const renouv = typeof v.refresh_token === 'string' ? v.refresh_token : '';
  const duree = Number(v.expires_in);
  const idSession = String((v.user && v.user.id) || '');
  if (idSession !== u.id) {
    console.warn('[session-extension] session fabriquée pour un autre compte — refusée et fermée');
    await fermerSession(acces);
    return repondre(res, 502, { erreur: 'identite', message: REESSAIE });
  }
  if (acces.split('.').length !== 3 || !renouv || !(duree > 0)) {
    await fermerSession(acces);
    return repondre(res, 502, { erreur: 'auth', message: REESSAIE });
  }
  // Cinq champs, construits ici — rien d'autre de la réponse de Supabase.
  return repondre(res, 200, {
    ok: true,
    session: {
      access_token: acces,
      refresh_token: renouv,
      // En millisecondes, comme `sessionFrom` dans l'app.
      expires_at: Date.now() + duree * 1000,
      user_id: u.id,
      email,
    },
  });
}

// ── FERMER MON COMPTE (5 octobre) ────────────────────────────────────────────
// La politique de confidentialité promet l'effacement (« supprimées dans un
// délai de 30 jours après la clôture du compte ») — et aucun bouton ne le
// faisait : il fallait écrire à une adresse qui n'existe pas encore.
//
// ⚠️ MESURÉ SUR LA VRAIE BASE LE 5 OCTOBRE, AVANT D'ÉCRIRE : `app_data.owner`
//    et `vinted_accounts.owner` n'ont AUCUNE clé étrangère vers auth.users
//    (seule `abonnements` en a une, ON DELETE CASCADE). La migration 001 en
//    prévoyait une ; elle n'est pas en place. Supprimer l'utilisateur ne
//    supprimerait donc RIEN de ses données : on les efface nous-mêmes, une
//    table à la fois, AVANT l'utilisateur.
//
// ⚠️ CE QUI EST TOUCHÉ : uniquement les lignes `owner = <celui de la session>`.
//    L'identifiant vient de Supabase (le jeton), jamais du corps de la requête ;
//    il est vérifié comme un UUID ; chaque suppression porte `owner=eq.<lui>`
//    et RIEN d'autre (`scripts/audit-fermer-compte.cjs` sert deux vendeurs et
//    exige que l'autre reste intact).
// ⚠️ REFUSÉ AU PROPRIÉTAIRE DE L'INSTALLATION (VRM_OWNER_UID, ou ce que dit la
//    base) : c'est sa boutique — un clic de travers l'effacerait. « Pas su »
//    s'il est le propriétaire ⇒ refus aussi.
// ⚠️ L'ORDRE COMPTE, ET IL EST CHOISI POUR QU'UN ÉCHEC SE RATTRAPE :
//    1. l'abonnement s'arrête D'ABORD — on n'efface jamais un compte qui serait
//       encore prélevé. Résilié à la FIN de la période payée (comme « Résilier »,
//       aucun nouveau prélèvement) ; en IMPAYÉ, arrêté tout de suite (sinon
//       Stripe continuerait de retenter la carte d'un compte fermé).
//       Stripe muet ⇒ RIEN n'est effacé ;
//    2. ses sessions sont fermées (l'extension ne pourra plus renouveler la
//       sienne, donc plus rien écrire au-delà de l'heure de son jeton) ;
//    3. ses données, puis ses comptes Vinted (et leurs jetons), ses compteurs ;
//    4. son cache de photos détourées ;
//    5. EN DERNIER, son compte de connexion : tant qu'il existe, il peut se
//       reconnecter et relancer la fermeture si une étape a raté.
//    La réponse dit ce qui a été fait et ce qui ne l'a pas été — jamais
//    « compte fermé » si une seule étape a échoué.
// ⚠️ LIMITE CONNUE, DITE : un jeton d'accès déjà délivré reste valable jusqu'à
//    son expiration (≈ 1 h). Une extension encore installée peut donc écrire
//    une capture dans l'heure qui suit — d'où le conseil, à l'écran, de la
//    retirer de Chrome. Les copies de sauvegarde techniques (schéma
//    `sauvegarde`) ne sont pas touchées ici : la politique les autorise 90 jours.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function lireCorpsJson(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  const b = await corpsBrut(req);
  if (!b || !b.length) return {};
  try { return JSON.parse(b.toString('utf8')); } catch (_) { return null; }
}

// Supprime au nom du SERVEUR (clé de service). Rend le nombre de lignes
// effacées (`Content-Range: */N`), 0 si la table n'existe pas ici (404), ou
// `null` si la base a refusé ou n'a pas répondu — jamais un succès supposé.
async function effacer(chemin, SERVICE) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${chemin}`, {
      method: 'DELETE',
      headers: { ...sbCle(SERVICE), Prefer: 'count=exact,return=minimal' },
    });
    if (r.status === 404) return 0;
    if (!r.ok) return null;
    const m = /\/(\d+)\s*$/.exec((r.headers && r.headers.get && r.headers.get('content-range')) || '');
    return m ? Number(m[1]) : 0;
  } catch (_) { return null; }
}

// Le cache de photos détourées du vendeur (compartiment privé `detourage`,
// dossier `{owner}/`). Rend le nombre de fichiers effacés, ou `null`.
async function viderCacheDetourage(owner, SERVICE) {
  let n = 0;
  try {
    for (let tour = 0; tour < 50; tour++) {
      const l = await fetch(`${SUPABASE_URL}/storage/v1/object/list/detourage`, {
        method: 'POST',
        headers: { ...sbCle(SERVICE), 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefix: owner, limit: 100, offset: 0 }),
      });
      if (l.status === 404 || l.status === 400) return n;     // pas de compartiment ici
      if (!l.ok) return null;
      const items = await l.json();
      if (!Array.isArray(items)) return null;
      const noms = items.map((x) => x && x.name).filter((x) => typeof x === 'string' && x && !x.includes('/') && x !== '.emptyFolderPlaceholder');
      if (!noms.length) return n;
      const d = await fetch(`${SUPABASE_URL}/storage/v1/object/detourage`, {
        method: 'DELETE',
        headers: { ...sbCle(SERVICE), 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefixes: noms.map((x) => `${owner}/${x}`) }),
      });
      if (!d.ok) return null;
      n += noms.length;
    }
    return null;                                              // trop long : on ne dit pas « fini »
  } catch (_) { return null; }
}

// Ferme TOUTES ses sessions (app, extension, autres appareils).
async function fermerSessions(req) {
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/logout?scope=global`, { method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${jetonDe(req)}` } });
    return r.ok;
  } catch (_) { return false; }
}

const NON_TOUCHE = "Rien n'a été effacé.";
const nb = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;
const PROPRIO_REFUS = "Ce compte est celui du propriétaire de VRM : le fermer effacerait toute la boutique. C'est désactivé exprès.";

async function fermerCompte(req, res) {
  const u = await utilisateurDe(req);
  if (!u) return repondre(res, 401, { erreur: 'session', message: 'Connecte-toi à VRM pour fermer ton compte.' });
  if (!UUID_RE.test(u.id)) return repondre(res, 400, { erreur: 'identite', message: NON_TOUCHE });
  const SERVICE = process.env.SUPABASE_SERVICE_KEY || '';
  if (!SERVICE) return repondre(res, 503, { erreur: 'non-configure', message: `La fermeture de compte n'est pas encore branchée sur le serveur. ${NON_TOUCHE}` });
  if (process.env.VRM_OWNER_UID && process.env.VRM_OWNER_UID === u.id) return repondre(res, 403, { erreur: 'proprietaire', message: PROPRIO_REFUS });
  const acc = await accesDe(req);
  if (acc === undefined) return repondre(res, 503, { erreur: 'base-injoignable', message: `Je n'ai pas pu vérifier ton compte. ${NON_TOUCHE} Réessaie dans un instant.` });
  if (acc.proprietaire) return repondre(res, 403, { erreur: 'proprietaire', message: PROPRIO_REFUS });
  // La confirmation est vérifiée ICI, pas seulement à l'écran.
  const corps = await lireCorpsJson(req);
  const tape = String((corps && corps.confirmation) || '').trim().toLowerCase();
  const email = String(u.email || '').trim().toLowerCase();
  if (!email || tape !== email) return repondre(res, 400, { erreur: 'confirmation', message: `Recopie exactement ton adresse email pour confirmer. ${NON_TOUCHE}` });

  // 1) L'abonnement, d'abord.
  const ligne = await ligneDe(req);
  if (ligne === undefined) return repondre(res, 503, { erreur: 'base-injoignable', message: `Je n'ai pas pu lire ton abonnement. ${NON_TOUCHE} Réessaie dans un instant.` });
  const etapes = { abonnement: 'aucun' };
  if (ligne && ligne.abonnement_stripe && ligne.client_stripe && abonnementActif(ligne.statut)) {
    const STRIPE_MUET = `Je n'ai pas pu arrêter ton abonnement chez Stripe. ${NON_TOUCHE} Réessaie dans un instant.`;
    if (!stripePret()) return repondre(res, 503, { erreur: 'stripe', message: STRIPE_MUET });
    const id = encodeURIComponent(ligne.abonnement_stripe);
    const lu = await stripeApi('GET', `subscriptions/${id}`);
    if (!lu.ok || !lu.data) return repondre(res, 502, { erreur: 'stripe', message: STRIPE_MUET });
    if (lu.data.customer !== ligne.client_stripe) return repondre(res, 403, { erreur: 'pas-a-toi', message: NON_TOUCHE });
    if (abonnementActif(lu.data.status)) {
      const impaye = lu.data.status === 'past_due';
      const r = impaye
        ? await stripeApi('DELETE', `subscriptions/${id}`, null, `vrm-fer-${u.id}`)
        : await stripeApi('POST', `subscriptions/${id}`, { cancel_at_period_end: 'true' }, `vrm-fer-${u.id}-${Math.floor(Date.now() / 60000)}`);
      if (!r.ok || !r.data) return repondre(res, 502, { erreur: 'stripe', message: STRIPE_MUET });
      etapes.abonnement = impaye ? 'arrete' : 'resilie';
    } else etapes.abonnement = 'deja-fini';
  }

  // 2) Ses sessions. 3) Ses données. 4) Ses photos. 5) Son compte de connexion.
  //    Chaque étape n'a lieu que si la précédente a réussi : un échec laisse un
  //    compte qu'il peut rouvrir pour relancer, jamais des données orphelines.
  etapes.sessions = (await fermerSessions(req)) ? 'fermees' : 'non-fermees';
  const filtre = `owner=eq.${encodeURIComponent(u.id)}`;
  etapes.donnees = await effacer(`app_data?${filtre}`, SERVICE);
  etapes.comptesVinted = etapes.donnees === null ? null : await effacer(`vinted_accounts?${filtre}`, SERVICE);
  etapes.compteurs = etapes.comptesVinted === null ? null : await effacer(`detourage_usage?${filtre}`, SERVICE);
  etapes.photos = etapes.compteurs === null ? null : await viderCacheDetourage(u.id, SERVICE);
  let connexion = false;
  if (etapes.photos !== null) {
    try {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(u.id)}`, { method: 'DELETE', headers: sbCle(SERVICE) });
      connexion = r.ok;
    } catch (_) { connexion = false; }
  }
  etapes.connexion = connexion ? 'supprimee' : 'conservee';

  // Ce qui a été fait, ce qui ne l'a pas été — en clair.
  const fait = [], pasFait = [];
  if (etapes.abonnement === 'resilie') fait.push('abonnement résilié (aucun nouveau prélèvement)');
  if (etapes.abonnement === 'arrete') fait.push('abonnement arrêté');
  if (etapes.donnees !== null) fait.push(`tes données effacées (${nb(etapes.donnees, 'élément', 'éléments')})`);
  if (etapes.comptesVinted != null) fait.push(nb(etapes.comptesVinted, 'compte Vinted délié', 'comptes Vinted déliés'));
  if (etapes.photos != null && etapes.photos > 0) fait.push(nb(etapes.photos, 'photo détourée effacée', 'photos détourées effacées'));
  if (etapes.donnees === null) pasFait.push('tes données', 'tes comptes Vinted');
  else if (etapes.comptesVinted === null) pasFait.push('tes comptes Vinted');
  else if (etapes.compteurs === null) pasFait.push('tes compteurs de détourage');
  else if (etapes.photos === null) pasFait.push('tes photos détourées');
  if (!connexion) pasFait.push('ton compte de connexion');
  const ok = connexion && etapes.donnees !== null && etapes.comptesVinted !== null && etapes.compteurs !== null && etapes.photos !== null;
  const message = ok
    ? `Ton compte VRM est fermé : ${fait.join(', ')}.`
    : `Fermeture INCOMPLÈTE. Fait : ${fait.length ? fait.join(', ') : 'rien'}. Pas encore effacé : ${pasFait.join(', ')}. Reconnecte-toi et relance « Fermer mon compte ».`;
  if (!ok) console.warn('[fermer-compte] incomplet', JSON.stringify(etapes));
  return repondre(res, ok ? 200 : 502, { ok, etapes, message });
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
  if (mode === 'session-extension') return m === 'POST' ? sessionExtension(req, res) : repondre(res, 405, { erreur: 'POST seulement' });
  if (mode === 'fermer') return m === 'POST' ? fermerCompte(req, res) : repondre(res, 405, { erreur: 'POST seulement' });
  return repondre(res, 404, { erreur: 'mode inconnu' });
}
