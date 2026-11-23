// api/_lib/rappel-prelevement.js
// ════════════════════════════════════════════════════════════════════════════
// ABONNEMENT SANS SURPRISE (16 nov., validé par Julien) : un rappel 3 JOURS AVANT
// chaque prélèvement — renouvellement d'un abonné ET fin d'essai gratuit.
// ════════════════════════════════════════════════════════════════════════════
// « Ton abonnement VRM Solo (16,99 €) sera renouvelé le 19/11. Gérer · Résilier »
// Une notification (si ses notifications sont allumées), et un e-mail
// transactionnel quand l'envoi d'e-mails est configuré (les mêmes variables que
// les e-mails de l'essai, api/_lib/relances-essai.js) ; sinon la notification seule.
// Passé par le cron du MATIN (api/ship-reminders.js) : aucune fonction de plus.
//
// ⚠️ LA DATE ET LE MONTANT SONT LUS CHEZ STRIPE, JAMAIS DEVINÉS :
//   · la date : l'abonnement chez Stripe (`subscriptions/{id}`) — fin de l'essai
//     (`trial_end`) ou fin de la période (`current_period_end`, sur l'abonnement ou
//     son article : `finPeriode`) ; elle doit tomber dans les 3 jours ;
//   · le montant : l'aperçu de la prochaine facture (`invoices/create_preview`,
//     remises et prorata compris) — en euros, un entier de centimes ; illisible ou
//     autre devise ⇒ RIEN ne part ce jour-là (« pas su » ≠ un montant), on relit demain ;
//   · l'abonnement doit être CELUI de son client (`customer`), encore vivant
//     (`active` ou `trialing`) et NON résilié (`cancel_at_period_end`, `cancel_at`) :
//     un abonnement résilié ne sera pas prélevé — aucun rappel.
// ⚠️ SANS `STRIPE_SECRET_KEY` (geste de Julien) : rien n'est lu, rien ne part, et la
//    réponse du cron le dit (`pret: false`) ; Paramètres → Mon abonnement le dit aussi.
// ⚠️ À QUI JAMAIS : le propriétaire (`proprietaires()` de relances-essai : pas su ⇒
//    personne), un abonnement en MODE TEST de Stripe (sauf `RELANCES_ESSAI_MODE_TEST=1`).
// ⚠️ UNE FOIS PAR PRÉLÈVEMENT : la date du prélèvement est RÉSERVÉE dans la ligne
//    `rappels_prelevement` du vendeur AVANT tout envoi (comparer-et-échanger) ; une
//    réservation non confirmée ⇒ rien ne part.
// ⚠️ Aucune donnée de carte, aucun nom : un plan, un montant, une date.
import { sbCle } from './cle.js';
import { stripeApi, stripePret, finPeriode } from './stripe.js';
import { envoyerSmtp } from './smtp.js';
import { gabaritMail } from './mail-gabarit.js';
import { configurationRelances, proprietaires, adresseDuCompte } from './relances-essai.js';
import { reserverMemo, modifierLigneCas } from './cas.js';
import { fetchAvecDelai } from './fetch-delai.js';

export const SITE = 'https://vrm.center';
export const LIEN_ABONNEMENT = `${SITE}/?tab=settings&vue=abonnement`;
export const ID_RAPPELS = 'rappels_prelevement';
export const JOURS_AVANT = 3;
export const MAX_PAR_PASSAGE = 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SUPABASE_URL = () => process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
const SERVICE = () => process.env.SUPABASE_SERVICE_KEY || '';
const VIVANTS = new Set(['active', 'trialing']);

// ── L'ÉTAT (ce que Paramètres dit) ───────────────────────────────────────────
// `stripe` : la clé est posée ; `email` : l'envoi d'e-mails est configuré.
export function configurationRappel(env = process.env) {
  const stripe = /^(sk|rk)_(test|live)_/.test(String(env.STRIPE_SECRET_KEY || ''));
  const service = !!env.SUPABASE_SERVICE_KEY;
  return { pret: stripe && service, stripe, email: configurationRelances(env).pret, joursAvant: JOURS_AVANT };
}

// ── LE JOUR (pur) ────────────────────────────────────────────────────────────
// Les jours sont ceux de PARIS. Rend le nombre de jours avant le prélèvement
// (3, 2, 1) s'il tombe dans la fenêtre, sinon null. 3 = le jour prévu ; 2 et 1 =
// un passage du matin manqué (cron en panne) : le rappel part quand même, une fois.
const jourParis = (t) => new Date(t).toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });
const ecartJours = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400e3);
export function joursAvantPrelevement(dateIso, maintenant = Date.now()) {
  const t = Date.parse(dateIso || '');
  if (!Number.isFinite(t) || t <= maintenant) return null;
  const n = ecartJours(jourParis(maintenant), jourParis(t));
  return n >= 1 && n <= JOURS_AVANT ? n : null;
}

// ── CE QUE STRIPE DIT (pur, sur les objets lus) ──────────────────────────────
// La date du prochain prélèvement : fin d'essai, sinon fin de période.
export function datePrelevement(sub) {
  if (!sub || typeof sub !== 'object') return null;
  if (sub.status === 'trialing') return Number.isFinite(sub.trial_end) && sub.trial_end > 0 ? new Date(sub.trial_end * 1000).toISOString() : null;
  return finPeriode(sub);
}
// Le montant de l'aperçu : { centimes, devise } en euros, sinon null (pas su).
export function montantApercu(apercu) {
  if (!apercu || typeof apercu !== 'object') return null;
  const c = apercu.amount_due;
  if (!Number.isSafeInteger(c) || c <= 0) return null;
  if (String(apercu.currency || '').toLowerCase() !== 'eur') return null;
  return { centimes: c, devise: 'eur' };
}
export const euros = (centimes) => `${(centimes / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const dateCourte = (iso) => new Date(iso).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit' });
const dateLongue = (iso) => new Date(iso).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long' });
export const nomOffre = (plan) => (plan === 'pro' ? 'VRM Pro' : plan === 'solo' ? 'VRM Solo' : 'VRM');

// ── LES TEXTES ───────────────────────────────────────────────────────────────
export function texteRappel({ essai, plan, centimes, date }) {
  const offre = nomOffre(plan);
  const montant = euros(centimes);
  const court = dateCourte(date), long = dateLongue(date);
  const titre = essai ? `Ton essai se termine le ${court}` : `Ton abonnement sera renouvelé le ${court}`;
  const phrase = essai
    ? `Ton essai gratuit se termine le ${court} : ton abonnement ${offre} (${montant}) démarrera ce jour-là.`
    : `Ton abonnement ${offre} (${montant}) sera renouvelé le ${court}.`;
  const notif = { title: titre, body: `${phrase} Gérer · Résilier`, url: '/?tab=settings&vue=abonnement' };
  const { texte, html } = gabaritMail({
    titre,
    preentete: phrase,
    paras: [
      essai
        ? `Ton essai gratuit de VRM se termine le ${long}. Ce jour-là, ${montant} seront prélevés sur ta carte pour ton abonnement ${offre}, puis chaque mois.`
        : `Le ${long}, ${montant} seront prélevés sur ta carte pour ton abonnement ${offre}.`,
      'Rien à faire pour continuer. Pour changer de carte ou résilier avant cette date : Paramètres → Mon abonnement (« Gérer » ou « Résilier »). Résilier n’efface rien : VRM reste ouvert jusqu’à la date ci-dessus.',
    ],
    bouton: { mot: 'Gérer mon abonnement', url: LIEN_ABONNEMENT },
    pied: { texte: 'Tu reçois ce message parce que tu es abonné à VRM : un rappel avant chaque prélèvement. Le montant et la date viennent de Stripe, qui gère le paiement.' },
  });
  return { notif, sujet: titre, texte, html, phrase };
}

// ── LECTURES (clé de service ; `null` = pas su) ──────────────────────────────
async function lire(chemin) {
  if (!SERVICE()) return null;
  try {
    const r = await fetchAvecDelai(`${SUPABASE_URL()}/rest/v1/${chemin}`, { headers: { ...sbCle(SERVICE()) } });
    if (!r.ok) return null;
    const j = await r.json();
    return Array.isArray(j) ? j : null;
  } catch (_) { return null; }
}
// Les abonnements vivants, non résiliés, dont la fin tombe dans les 4 prochains jours.
export async function listerAPrelever(maintenant = Date.now()) {
  const de = new Date(maintenant).toISOString(), a = new Date(maintenant + (JOURS_AVANT + 1) * 86400e3).toISOString();
  const out = [];
  let apres = '';
  for (let n = 0; n < 100; n++) {
    const page = await lire(`abonnements?statut=in.(active,trialing)&annule_fin_periode=eq.false&fin_periode=gt.${encodeURIComponent(de)}&fin_periode=lte.${encodeURIComponent(a)}${apres ? `&owner=gt.${encodeURIComponent(apres)}` : ''}&select=owner,statut,plan,fin_periode,annule_fin_periode,mode_test,abonnement_stripe,client_stripe&order=owner.asc&limit=1000`);
    if (!page) return null;
    out.push(...page);
    if (page.length < 1000) break;
    apres = String(page[page.length - 1].owner || '');
    if (!apres) return null;
  }
  return out;
}

// ── LE PASSAGE DU MATIN ──────────────────────────────────────────────────────
// `pousser(owner, payload)` : la notification au nom du vendeur (le cron la branche
// sur `sendPushToAll` dans son contexte). Rend un résumé (jamais une adresse).
export async function passageRappelsPrelevement({ maintenant = Date.now(), env = process.env, envoyer = envoyerSmtp, pousser = null, jusqua = Infinity, horloge = Date.now } = {}) {
  const cfg = configurationRappel(env);
  if (!cfg.stripe) return { pret: false, manque: ['STRIPE_SECRET_KEY'], rappels: 0 };
  if (!cfg.pret) return { pret: false, manque: ['SUPABASE_SERVICE_KEY'], rappels: 0 };
  if (!stripePret()) return { pret: false, manque: ['STRIPE_SECRET_KEY'], rappels: 0 };
  const smtp = configurationRelances(env);
  const proprio = await proprietaires();
  if (!proprio) return { pret: true, rappels: 0, arret: 'proprietaire pas su' };
  const liste = await listerAPrelever(maintenant);
  if (!liste) return { pret: true, rappels: 0, arret: 'abonnements illisibles' };
  const ignores = {}; const ign = (r) => { ignores[r] = (ignores[r] || 0) + 1; };
  let rappels = 0, notifs = 0, emails = 0;
  for (const a of liste) {
    if (rappels >= MAX_PAR_PASSAGE) { ign('plafond du passage'); continue; }
    if (horloge() >= jusqua) { ign('temps du passage'); continue; }
    const owner = String((a && a.owner) || '').toLowerCase();
    if (!UUID.test(owner)) { ign('identifiant'); continue; }
    if (!VIVANTS.has(a.statut) || a.annule_fin_periode !== false) { ign('pas a prelever'); continue; }
    if (proprio.has(owner)) { ign('proprietaire'); continue; }
    if (a.mode_test !== false && !smtp.modeTest) { ign('mode test'); continue; }
    if (!a.abonnement_stripe || !a.client_stripe) { ign('sans stripe'); continue; }
    // ── Ce que Stripe dit, maintenant ──
    const lu = await stripeApi('GET', `subscriptions/${encodeURIComponent(a.abonnement_stripe)}`);
    const sub = lu && lu.ok ? lu.data : null;
    if (!sub || !sub.id) { ign('stripe pas su'); continue; }
    if (sub.customer !== a.client_stripe) { ign('pas a lui'); continue; }
    if (!VIVANTS.has(sub.status) || sub.cancel_at_period_end || sub.cancel_at) { ign('pas a prelever'); continue; }
    const date = datePrelevement(sub);
    const n = joursAvantPrelevement(date, maintenant);
    if (!n) { ign('pas dans les 3 jours'); continue; }
    const ap = await stripeApi('POST', 'invoices/create_preview', { customer: a.client_stripe, subscription: sub.id });
    const m = ap && ap.ok ? montantApercu(ap.data) : null;
    if (!m) { ign('montant pas su'); continue; }
    const cle = jourParis(Date.parse(date));
    // Réserver AVANT d'envoyer (une fois par prélèvement).
    const ligne = { url: SUPABASE_URL(), entetes: sbCle(SERVICE()), owner, id: ID_RAPPELS };
    const res = await reserverMemo({ ...ligne,
      deja: (d) => !!(d && d.rappels && d.rappels[cle]),
      nouveau: (d) => ({ ...(d || {}), rappels: { ...((d && d.rappels) || {}), [cle]: { at: new Date(maintenant).toISOString(), issue: 'en-cours' } } }) });
    if (!res.reserve) { ign(res.raison === 'deja' ? 'deja rappele' : 'reservation non confirmee'); continue; }
    const t = texteRappel({ essai: sub.status === 'trialing', plan: a.plan, centimes: m.centimes, date });
    // La notification.
    let notif = 'aucune';
    if (pousser) {
      try { const r = await pousser(owner, { ...t.notif, cat: 'abonnement', cle: `prelevement-${cle}`, tag: `prelevement-${cle}` }); notif = r && r.sent > 0 ? 'envoyee' : r && r.coupe ? 'coupee' : 'rangee'; }
      catch (_) { notif = 'incertaine'; }
      if (notif === 'envoyee' || notif === 'rangee') notifs++;
    }
    // L'e-mail, seulement si l'envoi est configuré et l'adresse du compte confirmée.
    let email = 'pas configure';
    if (smtp.pret) {
      const adr = await adresseDuCompte(owner);
      if (adr.etat !== 'ok') email = `adresse ${adr.etat}`;
      else {
        try {
          const r = await envoyer({ hote: env.RELANCES_SMTP_HOTE, port: smtp.port, utilisateur: env.RELANCES_SMTP_UTILISATEUR, motDePasse: env.RELANCES_SMTP_MOT_DE_PASSE,
            de: env.RELANCES_EXPEDITEUR, nomDe: 'VRM', a: adr.email, sujet: t.sujet, texte: t.texte, html: t.html, entetes: { 'Auto-Submitted': 'auto-generated' } });
          email = ['envoye', 'refuse', 'incertain'].includes(r && r.issue) ? r.issue : 'incertain';
        } catch (_) { email = 'incertain'; }
        if (email === 'envoye') emails++;
      }
    }
    await modifierLigneCas({ ...ligne, modifier: (d) => ({ ...(d || {}), rappels: { ...((d && d.rappels) || {}), [cle]: { at: new Date(maintenant).toISOString(), issue: 'fait', notif, email, jours: n } } }) });
    rappels++;
  }
  return { pret: true, rappels, notifs, emails, lus: liste.length, ignores, email: smtp.pret };
}
