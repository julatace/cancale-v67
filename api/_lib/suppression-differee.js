// api/_lib/suppression-differee.js
// ════════════════════════════════════════════════════════════════════════════
// « SUPPRIMER MON COMPTE » AVEC UN DÉLAI DE GRÂCE DE 30 JOURS (13 nov., lot 51).
// Avant : l'effacement partait à la seconde (9 nov.). Des vendeurs payants
// arrivent : un geste irréversible se laisse le temps d'être regretté.
//   1. La DEMANDE (api/compte.js, POST `?mode=supprimer`, confirmation forte
//      jugée par le serveur) : l'abonnement est résilié tout de suite (aucun
//      nouveau prélèvement — réversible), puis une ligne NEUTRE dit la date
//      d'effacement (`effaceLe` = demande + 30 j). RIEN n'est effacé.
//   2. Pendant 30 jours, il peut ANNULER (POST `?mode=supprimer-annuler`, sa
//      session suffit : annuler ne détruit rien). L'abonnement que VRM avait
//      résilié pour la demande est repris si Stripe le permet, sinon c'est DIT.
//   3. Le cron du matin (api/ship-reminders.js) efface les demandes échues par
//      la MÊME fonction que la suppression d'avant (`effacerCompte`).
// Exception (dite) : un compte VIDE (aucune donnée, aucun compte de revente,
// aucun abonnement en cours — le compte qu'un « Continuer avec Discord » a
// créé sans le vouloir) est effacé tout de suite : il n'y a rien à regretter,
// et ce compte bloquerait 30 jours la liaison du Discord au vrai compte.
// ════════════════════════════════════════════════════════════════════════════
// ⚠️ LA DEMANDE VIT SOUS LE PROPRIÉTAIRE NEUTRE (qu'aucune session ne lit ni
//    n'écrit, RLS) : `vrm_effacement_prevu_{uid sans tirets}`. Le navigateur ne
//    peut ni la poser (contourner la confirmation forte), ni avancer sa date.
//    Le nom porte l'identifiant (comme `vrm_factures_gardees_`) : le passage du
//    cron le recalcule depuis `data.owner` et refuse une ligne qui ne colle pas.
// ⚠️ LECTURE RATÉE ⇒ RIEN : chaque lecture rend `undefined` (pas su), `null`
//    (aucune demande) ou la demande ; « pas su » n'efface ni n'annule rien.
// ⚠️ CLOISONNEMENT : chaque lecture / effacement de demande vise l'id exact
//    tiré de la SESSION (route) ou de `data.owner` (cron) — jamais un motif qui
//    toucherait la demande d'un autre. `scripts/audit-suppression-differee.cjs`
//    sert deux vendeurs et exige que l'autre reste intact.
import { sbCle } from './cle.js';
import { gabaritMail, SITE } from './mail-gabarit.js';
import { PROPRIETAIRE_NEUTRE } from './proprietaire-email.js';
import { stripeApi as stripeApiReel, stripePret } from './stripe.js';
import { envoyerSmtp } from './smtp.js';
import { configurationRelances, adresseDuCompte as adresseReelle } from './relances-essai.js';
import { lireMentions } from './mentions-legales.js';
import { inventaire, lireProprietaire, noterJournal, mailSuppression } from './suppression-compte.js';
import { effacerCompte, effacer } from './effacer-compte.js';
import { fetchAvecDelai } from './fetch-delai.js';

export const DELAI_GRACE_JOURS = 30;
export const PREFIXE_PREVU = 'vrm_effacement_prevu_';
export const MAX_PAR_PASSAGE = 5;
export const LIEN_ANNULER = `${SITE}/?tab=settings&section=supprimer`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// La même liste que STATUTS_ACTIFS d'api/compte.js (`past_due` : Stripe réessaie).
const ACTIFS = new Set(['active', 'trialing', 'past_due']);
export const actif = (statut) => ACTIFS.has(String(statut || ''));
const URL_BASE = () => process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';

export const idPrevu = (owner) => PREFIXE_PREVU + String(owner).toLowerCase().replace(/-/g, '');
export const dateEffacement = (demandeMs) => demandeMs + DELAI_GRACE_JOURS * 864e5;
export const jourLong = (ms) => new Date(ms).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long', year: 'numeric' });

// Un compte VIDE : rien à regretter (l'inventaire LU, jamais deviné).
export function compteVide(inv, ligne) {
  if (!inv || typeof inv !== 'object') return false;
  if (ligne === undefined) return false;
  return inv.donnees === 0 && inv.comptesVinted === 0 && !(ligne && actif(ligne.statut));
}

// La demande de CE vendeur : undefined (pas su) · null (aucune) · { demandeLe, effaceLe, abonnement }.
export async function lirePrevue({ url, service, owner, fetcher = fetchAvecDelai }) {
  if (!UUID.test(String(owner || '')) || !service) return undefined;
  try {
    const r = await fetcher(`${url}/rest/v1/app_data?owner=eq.${PROPRIETAIRE_NEUTRE}&id=eq.${idPrevu(owner)}&select=data&limit=1`, { headers: sbCle(service) });
    if (r.status === 404) return null;
    if (!r.ok) return undefined;
    const j = await r.json().catch(() => null);
    if (!Array.isArray(j)) return undefined;
    const d = j[0] && j[0].data;
    if (!d) return null;
    // Une ligne qui ne dit pas CE vendeur n'est pas la sienne (jamais « oui » par défaut).
    if (String(d.owner || '').toLowerCase() !== String(owner).toLowerCase()) return null;
    const demandeLe = Date.parse(d.demandeLe || ''), effaceLe = Date.parse(d.effaceLe || '');
    if (!Number.isFinite(demandeLe) || !Number.isFinite(effaceLe)) return undefined;
    return { demandeLe: new Date(demandeLe).toISOString(), effaceLe: new Date(effaceLe).toISOString(), abonnement: String(d.abonnement || 'aucun') };
  } catch (_) { return undefined; }
}

// Pose la demande (une écriture, au nom du serveur). Rend la demande ou null.
export async function poserPrevue({ url, service, owner, abonnement = 'aucun', maintenant = Date.now(), fetcher = fetchAvecDelai }) {
  if (!UUID.test(String(owner || '')) || owner === PROPRIETAIRE_NEUTRE || !service) return null;
  const at = new Date(maintenant).toISOString();
  const data = { owner: String(owner).toLowerCase(), demandeLe: at, effaceLe: new Date(dateEffacement(maintenant)).toISOString(), abonnement };
  try {
    const r = await fetcher(`${url}/rest/v1/app_data?on_conflict=owner,id`, {
      method: 'POST',
      headers: { ...sbCle(service), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ owner: PROPRIETAIRE_NEUTRE, id: idPrevu(owner), data, updated_at: at }]),
    });
    return r.ok ? { demandeLe: data.demandeLe, effaceLe: data.effaceLe, abonnement } : null;
  } catch (_) { return null; }
}

// Retire SA demande (id exact). Le nombre retiré, ou null (pas su).
export const retirerPrevue = ({ url, service, owner }) =>
  (UUID.test(String(owner || '')) && service ? effacer(url, service, `app_data?owner=eq.${PROPRIETAIRE_NEUTRE}&id=eq.${idPrevu(owner)}`) : Promise.resolve(null));

// ── L'abonnement : l'arrêter avant d'effacer, le reprendre à l'annulation ───
// `ligne` : SA ligne `abonnements` (lue avant). Rend { ok:true, etape } ou
// { ok:false, code, erreur } — une erreur ne laisse rien d'effacé.
export async function arreterAbonnement({ ligne, owner, stripe = stripeApiReel, pret = stripePret }) {
  if (!(ligne && ligne.abonnement_stripe && ligne.client_stripe && actif(ligne.statut))) return { ok: true, etape: 'aucun' };
  if (!pret()) return { ok: false, code: 503, erreur: 'stripe' };
  const id = encodeURIComponent(ligne.abonnement_stripe);
  const lu = await stripe('GET', `subscriptions/${id}`);
  if (!lu || !lu.ok || !lu.data) return { ok: false, code: 502, erreur: 'stripe' };
  if (lu.data.customer !== ligne.client_stripe) return { ok: false, code: 403, erreur: 'pas-a-toi' };
  if (!actif(lu.data.status)) return { ok: true, etape: 'deja-fini' };
  const impaye = lu.data.status === 'past_due';
  if (!impaye && lu.data.cancel_at_period_end) return { ok: true, etape: 'deja-resilie' };   // rejoué : rien à refaire
  const r = impaye
    ? await stripe('DELETE', `subscriptions/${id}`, null, `vrm-fer-${owner}`)
    : await stripe('POST', `subscriptions/${id}`, { cancel_at_period_end: 'true' }, `vrm-fer-${owner}-${Math.floor(Date.now() / 60000)}`);
  if (!r || !r.ok || !r.data) return { ok: false, code: 502, erreur: 'stripe' };
  return { ok: true, etape: impaye ? 'arrete' : 'resilie' };
}
// { etat: 'repris' · 'deja' (rien à reprendre) · 'fini' (terminé chez Stripe) · 'pas-su', sub }.
export async function reprendreAbonnement({ ligne, owner, stripe = stripeApiReel, pret = stripePret }) {
  if (!(ligne && ligne.abonnement_stripe && ligne.client_stripe)) return { etat: 'fini' };
  if (!pret()) return { etat: 'pas-su' };
  const id = encodeURIComponent(ligne.abonnement_stripe);
  const lu = await stripe('GET', `subscriptions/${id}`);
  if (!lu || !lu.ok || !lu.data || lu.data.customer !== ligne.client_stripe) return { etat: 'pas-su' };
  if (!actif(lu.data.status) || lu.data.status === 'past_due') return { etat: 'fini' };
  if (!lu.data.cancel_at_period_end) return { etat: 'deja' };
  const r = await stripe('POST', `subscriptions/${id}`, { cancel_at_period_end: 'false' }, `vrm-rep-sup-${owner}-${Math.floor(Date.now() / 60000)}`);
  return r && r.ok && r.data ? { etat: 'repris', sub: r.data } : { etat: 'pas-su' };
}

// ── Les e-mails (gabarit commun ; rien de ses données dedans) ───────────────
export function mailDemande({ effaceLe, contact = '' }) {
  const quand = jourLong(Date.parse(effaceLe));
  const { texte, html } = gabaritMail({
    titre: `Ton compte VRM sera supprimé le ${quand}`,
    preentete: `Tu as 30 jours pour changer d’avis : jusque-là, rien n’est effacé.`,
    paras: [
      `Tu as demandé la suppression de ton compte VRM. Elle aura lieu le ${quand} : ce jour-là, ton compte et tes données (ventes, annonces, numéros, compta, réglages, comptes de revente liés, adresses de réception) seront effacés.`,
      'Jusque-là, rien n’est effacé et tu peux annuler en un geste : Paramètres → Mon compte → Supprimer mon compte → « Annuler la suppression ». Ton abonnement est déjà résilié : aucun nouveau prélèvement.',
      'Pour garder une copie : Paramètres → Mon compte → Exporter mes données.',
    ],
    bouton: { mot: 'Annuler la suppression', url: LIEN_ANNULER },
    suite: [`Ce n’est pas toi ? Annule tout de suite et change ton mot de passe.${contact ? ` Écris aussi à ${contact}.` : ''}`],
    pied: { texte: 'Tu reçois ce message parce qu’une suppression de ton compte VRM vient d’être demandée.' },
  });
  return { sujet: `Ton compte VRM sera supprimé le ${quand}`, texte, html };
}

// ── Le passage du cron : les demandes échues ────────────────────────────────
// `stripe`, `envoyer`, `adresse` : remplaçables par un banc. Borné (`max`).
export async function passageSuppressionsPrevues({ maintenant = Date.now(), env = process.env, url = URL_BASE(), stripe = stripeApiReel, pret = stripePret, envoyer = envoyerSmtp, adresse = adresseReelle, max = MAX_PAR_PASSAGE, fetcher = fetchAvecDelai } = {}) {
  const service = env.SUPABASE_SERVICE_KEY || '';
  if (!service) return { fait: false, arret: 'non-configure' };
  const proprio = await lireProprietaire({ url, service, env, fetcher });
  if (proprio === undefined) return { fait: false, arret: 'proprietaire pas su' };
  const envProprio = String(env.VRM_OWNER_UID || '').trim().toLowerCase();
  let rows;
  try {
    const r = await fetcher(`${url}/rest/v1/app_data?owner=eq.${PROPRIETAIRE_NEUTRE}&id=like.${PREFIXE_PREVU}*&data->>effaceLe=lt.${encodeURIComponent(new Date(maintenant).toISOString())}&select=id,data&order=id.asc&limit=${max * 4}`, { headers: sbCle(service) });
    if (!r.ok) return { fait: false, arret: 'demandes illisibles' };
    rows = await r.json().catch(() => null);
    if (!Array.isArray(rows)) return { fait: false, arret: 'demandes illisibles' };
  } catch (_) { return { fait: false, arret: 'demandes illisibles' }; }
  const cfg = configurationRelances(env);
  const ignores = {}; const ign = (k) => { ignores[k] = (ignores[k] || 0) + 1; };
  let supprimes = 0, incomplets = 0, mentionsOk = null;
  const mails = { envoye: 0, refuse: 0, incertain: 0, sansAdresse: 0 };
  for (const x of rows) {
    if (supprimes + incomplets >= max) { ign('plafond du passage'); continue; }
    const d = (x && x.data) || {};
    const owner = String(d.owner || '').toLowerCase();
    if (!UUID.test(owner) || owner === PROPRIETAIRE_NEUTRE || x.id !== idPrevu(owner)) { ign('ligne qui ne colle pas'); continue; }
    if (owner === proprio || owner === envProprio) { ign('proprietaire'); continue; }
    const quand = Date.parse(d.effaceLe || '');
    if (!Number.isFinite(quand) || quand > maintenant) { ign('pas encore'); continue; }
    // Relue juste avant (une annulation a pu passer entre la liste et ici).
    const p = await lirePrevue({ url, service, owner, fetcher });
    if (p === undefined) { ign('demande pas sue'); continue; }
    if (p === null) { ign('annulee'); continue; }
    const inv = await inventaire({ url, service, owner, proprio, fetcher });
    if (!inv) { ign('inventaire pas su'); continue; }
    let ab;
    try {
      const r = await fetcher(`${url}/rest/v1/abonnements?owner=eq.${owner}&select=owner,statut,client_stripe,abonnement_stripe&limit=1`, { headers: sbCle(service) });
      ab = r.ok ? await r.json().catch(() => null) : null;
    } catch (_) { ab = null; }
    if (!Array.isArray(ab)) { ign('abonnement pas su'); continue; }
    const ligne = ab.find((l) => l && String(l.owner || '').toLowerCase() === owner) || null;
    const arret = await arreterAbonnement({ ligne, owner, stripe, pret });
    if (!arret.ok) { ign('stripe pas su : rien efface'); continue; }
    if (cfg.pret && mentionsOk === null) { try { const m = await lireMentions(); mentionsOk = !!(m && !m.erreur); } catch (_) { mentionsOk = false; } }
    const adr = cfg.pret && mentionsOk ? await adresse(owner) : null;     // lue AVANT : après, le compte n'existe plus
    const r = await effacerCompte({ url, service, owner, proprio, inv, maintenant });
    await noterJournal({ url, service, owner, ok: r.ok, nombres: { ...inv, donneesEffacees: r.etapes.donnees, differee: 1 }, maintenant, fetcher });
    if (!r.ok) { incomplets++; continue; }                               // la demande reste : relancée demain
    supprimes++;
    if ((await retirerPrevue({ url, service, owner })) === null) ign('demande pas retiree');
    if (adr && adr.etat === 'ok') {
      const m = mailSuppression({ fait: r.fait, motif: 'differee', maintenant });
      let v;
      try { v = await envoyer({ hote: env.RELANCES_SMTP_HOTE, port: cfg.port, utilisateur: env.RELANCES_SMTP_UTILISATEUR, motDePasse: env.RELANCES_SMTP_MOT_DE_PASSE, de: env.RELANCES_EXPEDITEUR, nomDe: 'VRM', a: adr.email, sujet: m.sujet, texte: m.texte, html: m.html, entetes: { 'Auto-Submitted': 'auto-generated' } }); } catch (_) { v = { issue: 'incertain' }; }
      const issue = ['envoye', 'refuse', 'incertain'].includes(v && v.issue) ? v.issue : 'incertain';
      mails[issue] += 1;
    } else mails.sansAdresse += 1;
  }
  return { fait: true, dues: rows.length, supprimes, incomplets, ignores, smtp: cfg.pret, mails };
}
