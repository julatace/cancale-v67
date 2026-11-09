// api/_lib/clients-partis.js
// ════════════════════════════════════════════════════════════════════════════
// LES CLIENTS PARTIS (9 novembre, validé par Julien) — un vendeur dont
// l'abonnement est TERMINÉ garde ses données 12 mois ; à 11 mois, un e-mail le
// prévient (« tes données seront supprimées le JJ/MM ») ; à 12 mois, son compte
// est supprimé par la MÊME fonction que « Supprimer mon compte »
// (`effacerCompte`, api/_lib/effacer-compte.js : factures Pro gardées 10 ans).
// Lancé par le cron du matin (api/ship-reminders.js), borné par passage.
// ════════════════════════════════════════════════════════════════════════════
// ⚠️ LA DATE DE FIN N'EST JAMAIS DEVINÉE : elle vient de STRIPE, relu à chaque
//    passage — `ended_at` d'un abonnement `canceled` / `incomplete_expired`,
//    `trial_end` passé d'un essai fini sans carte (`paused`, mêmes statuts
//    « terminés » que src/abonnement/etatAbonnement.js). Stripe muet, abonnement
//    d'un autre client, statut vivant, date absente ⇒ RIEN.
// ⚠️ JAMAIS : le propriétaire de l'installation (pas su ⇒ le passage s'arrête) ;
//    un abonnement ou un essai en cours (la ligne `abonnements` le dit, Stripe le
//    redit) ; un abonnement du mode TEST de Stripe (VRM_DEPARTS_MODE_TEST=1 pour
//    un essai) ; un compte dont une lecture a raté (inventaire, avis).
// ⚠️ L'AVIS PART UNE FOIS par date de fin (`vrm_depart_avis` du vendeur, réservé
//    AVANT l'envoi) ; SMTP pas configuré ⇒ aucun e-mail, et c'est dit.
// ⚠️ BORNÉ : MAX_AVIS e-mails et MAX_SUPPRESSIONS comptes par passage ; les
//    suivants attendent le lendemain (rien n'est perdu, tout est relu).
import { sbCle } from './cle.js';
import { stripeApi as stripeApiReel, stripePret } from './stripe.js';
import { envoyerSmtp } from './smtp.js';
import { gabaritMail, SITE } from './mail-gabarit.js';
import { configurationRelances, adresseDuCompte as adresseReelle } from './relances-essai.js';
import { lireMentions } from './mentions-legales.js';
import { inventaire, lireProprietaire, noterJournal, mailSuppression } from './suppression-compte.js';
import { effacerCompte, purgerFacturesGardees } from './effacer-compte.js';
import { PROPRIETAIRE_NEUTRE } from './proprietaire-email.js';

const URL_BASE = () => process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MOIS_GARDE = 12;
export const MOIS_AVIS = 11;
export const MAX_AVIS = 20;
export const MAX_SUPPRESSIONS = 5;
export const ID_AVIS = 'vrm_depart_avis';
export const STATUTS_FINIS = ['canceled', 'incomplete_expired', 'paused'];
export const LIEN_COMPTE = `${SITE}/?tab=settings&vue=compte`;

// n mois civils plus tard (UTC), le jour borné au dernier du mois (31 → 28/30).
export function ajouterMois(ms, n) {
  const d = new Date(ms);
  const y = d.getUTCFullYear(), m = d.getUTCMonth() + n;
  const dernier = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return Date.UTC(y, m, Math.min(d.getUTCDate(), dernier), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds());
}

// La fin réelle, lue dans l'objet abonnement de Stripe (ms), ou null.
export function finDeStripe(sub, maintenant = Date.now()) {
  if (!sub || typeof sub !== 'object') return null;
  const s = String(sub.status || '');
  if (s === 'canceled' || s === 'incomplete_expired') {
    const t = Number(sub.ended_at);
    return Number.isFinite(t) && t > 0 && t * 1000 <= maintenant ? t * 1000 : null;
  }
  if (s === 'paused') {
    const t = Number(sub.trial_end);
    return Number.isFinite(t) && t > 0 && t * 1000 <= maintenant ? t * 1000 : null;
  }
  return null;                                         // vivant, ou inconnu : jamais fini
}

// 'supprimer' · 'avis' · null.
export function etapeDepart({ fin, maintenant = Date.now(), avis = null }) {
  if (!Number.isFinite(fin)) return null;
  if (maintenant >= ajouterMois(fin, MOIS_GARDE)) return 'supprimer';
  if (maintenant >= ajouterMois(fin, MOIS_AVIS)) {
    const deja = avis && avis.pour === new Date(fin).toISOString() && ['envoye', 'incertain', 'en-cours'].includes(avis.issue);
    return deja ? null : 'avis';
  }
  return null;
}

export function mailAvis({ quand }) {
  const { texte, html } = gabaritMail({
    titre: `Tes données VRM seront supprimées le ${quand}`,
    preentete: `Ton abonnement est terminé : sans retour d’ici le ${quand}, ton compte et tes données seront effacés.`,
    paras: [
      `Ton abonnement VRM s’est terminé il y a 11 mois. Comme le dit notre politique de confidentialité, VRM garde tes données 12 mois après la fin de l’abonnement, puis les efface.`,
      `Le ${quand}, ton compte et tes données (ventes, annonces, numéros, compta, réglages) seront supprimés. Les factures Pro que tu as émises seront gardées 10 ans, sans accès, comme la loi l’exige.`,
      `Pour les garder : reviens sur VRM et reprends l’abonnement — tu pourras continuer, ou exporter tes données (Mon compte → Tes données → Exporter mes données).`,
    ],
    bouton: { mot: 'Ouvrir mon compte VRM', url: LIEN_COMPTE },
    pied: { texte: 'Tu reçois ce message parce que tu as eu un abonnement VRM. C’est le seul rappel avant la suppression.' },
  });
  return { sujet: `Tes données VRM seront supprimées le ${quand}`, texte, html };
}

const jourFr = (ms) => new Date(ms).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric' });

async function lire(url, service, chemin) {
  try {
    const r = await fetch(`${url}/rest/v1/${chemin}`, { headers: sbCle(service) });
    if (!r.ok) return null;
    const j = await r.json().catch(() => null);
    return Array.isArray(j) ? j : null;
  } catch (_) { return null; }
}
async function ecrireAvis(url, service, owner, data) {
  try {
    const r = await fetch(`${url}/rest/v1/app_data?on_conflict=owner,id`, {
      method: 'POST', headers: { ...sbCle(service), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ owner, id: ID_AVIS, data, updated_at: new Date().toISOString() }]),
    });
    return r.ok;
  } catch (_) { return false; }
}

export async function listerFinis(url, service) {
  const out = [];
  for (let from = 0; from < 100000; from += 1000) {
    const page = await lire(url, service, `abonnements?statut=in.(${STATUTS_FINIS.join(',')})&select=owner,statut,client_stripe,abonnement_stripe,mode_test&order=owner.asc&offset=${from}&limit=1000`);
    if (!page) return null;
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}

// Le passage. `stripe`, `envoyer`, `adresse` : remplaçables par un banc.
export async function passageClientsPartis({ maintenant = Date.now(), env = process.env, stripe = stripeApiReel, envoyer = envoyerSmtp, adresse = adresseReelle, maxAvis = MAX_AVIS, maxSuppressions = MAX_SUPPRESSIONS } = {}) {
  const url = URL_BASE(), service = env.SUPABASE_SERVICE_KEY || '';
  if (!service) return { fait: false, arret: 'non-configure' };
  if (stripe === stripeApiReel && !stripePret()) return { fait: false, arret: 'stripe non configure' };
  const proprio = await lireProprietaire({ url, service, env });
  if (proprio === undefined) return { fait: false, arret: 'proprietaire pas su' };
  const envProprio = String(env.VRM_OWNER_UID || '').trim().toLowerCase();
  const finis = await listerFinis(url, service);
  if (!finis) return { fait: false, arret: 'abonnements illisibles' };
  const cfg = configurationRelances(env);
  const modeTest = env.VRM_DEPARTS_MODE_TEST === '1';
  const ignores = {}; const ign = (r) => { ignores[r] = (ignores[r] || 0) + 1; };
  let avis = 0, supprimes = 0, incomplets = 0;
  let mentionsLues = false;
  for (const a of finis) {
    const owner = String((a && a.owner) || '').toLowerCase();
    if (!UUID.test(owner) || owner === PROPRIETAIRE_NEUTRE) { ign('identifiant'); continue; }
    if (owner === proprio || owner === envProprio) { ign('proprietaire'); continue; }
    if (!STATUTS_FINIS.includes(a.statut)) { ign('pas fini'); continue; }
    if (a.mode_test !== false && !modeTest) { ign('mode test'); continue; }
    if (!a.abonnement_stripe || !a.client_stripe) { ign('sans abonnement Stripe'); continue; }
    if (avis >= maxAvis && supprimes + incomplets >= maxSuppressions) { ign('plafond du passage'); continue; }
    // Stripe relu : la vérité sur la fin.
    const lu = await stripe('GET', `subscriptions/${encodeURIComponent(a.abonnement_stripe)}`);
    if (!lu || !lu.ok || !lu.data) { ign('stripe pas su'); continue; }
    if (lu.data.customer !== a.client_stripe) { ign('pas son client'); continue; }
    const fin = finDeStripe(lu.data, maintenant);
    if (fin == null) { ign('pas fini chez Stripe'); continue; }
    const lignes = await lire(url, service, `app_data?owner=eq.${owner}&id=eq.${ID_AVIS}&select=data&limit=1`);
    if (!lignes) { ign('avis pas su'); continue; }
    const etape = etapeDepart({ fin, maintenant, avis: lignes[0] && lignes[0].data });
    if (!etape) { ign('rien aujourd’hui'); continue; }
    if (!mentionsLues) { mentionsLues = true; try { await lireMentions(); } catch (_) {} }

    if (etape === 'avis') {
      if (avis >= maxAvis) { ign('plafond des avis'); continue; }
      if (!cfg.pret) { ign('smtp non configure'); continue; }
      const adr = await adresse(owner);
      if (!adr || adr.etat !== 'ok') { ign(`adresse ${adr ? adr.etat : 'passu'}`); continue; }
      const pour = new Date(fin).toISOString();
      if (!(await ecrireAvis(url, service, owner, { pour, at: new Date(maintenant).toISOString(), issue: 'en-cours' }))) { ign('reservation non confirmee'); continue; }
      const m = mailAvis({ quand: jourFr(ajouterMois(fin, MOIS_GARDE)) });
      let v;
      try { v = await envoyer({ hote: env.RELANCES_SMTP_HOTE, port: cfg.port, utilisateur: env.RELANCES_SMTP_UTILISATEUR, motDePasse: env.RELANCES_SMTP_MOT_DE_PASSE, de: env.RELANCES_EXPEDITEUR, nomDe: 'VRM', a: adr.email, sujet: m.sujet, texte: m.texte, html: m.html, entetes: { 'Auto-Submitted': 'auto-generated' } }); }
      catch (e) { v = { issue: 'incertain' }; }
      const issue = ['envoye', 'refuse', 'incertain'].includes(v && v.issue) ? v.issue : 'incertain';
      // Un refus AVANT le message : rien n'est parti ⇒ la réservation est levée (demain).
      await ecrireAvis(url, service, owner, issue === 'refuse' ? { pour: '', refuseLe: new Date(maintenant).toISOString() } : { pour, at: new Date(maintenant).toISOString(), issue });
      if (issue === 'refuse') ign('smtp refuse'); else avis++;
      continue;
    }

    // etape === 'supprimer'
    if (supprimes + incomplets >= maxSuppressions) { ign('plafond des suppressions'); continue; }
    const inv = await inventaire({ url, service, owner, proprio });
    if (!inv) { ign('inventaire pas su'); continue; }
    const adr = cfg.pret ? await adresse(owner) : null;          // lue AVANT : après, le compte n'existe plus
    const r = await effacerCompte({ url, service, owner, proprio, inv, maintenant });
    await noterJournal({ url, service, owner, ok: r.ok, nombres: { ...inv, donneesEffacees: r.etapes.donnees, depart: 1 }, maintenant });
    if (!r.ok) { incomplets++; continue; }
    supprimes++;
    if (adr && adr.etat === 'ok') {
      const m = mailSuppression({ fait: r.fait, motif: 'depart', maintenant });
      try { await envoyer({ hote: env.RELANCES_SMTP_HOTE, port: cfg.port, utilisateur: env.RELANCES_SMTP_UTILISATEUR, motDePasse: env.RELANCES_SMTP_MOT_DE_PASSE, de: env.RELANCES_EXPEDITEUR, nomDe: 'VRM', a: adr.email, sujet: m.sujet, texte: m.texte, html: m.html, entetes: { 'Auto-Submitted': 'auto-generated' } }); } catch (_) {}
    }
  }
  const factures = await purgerFacturesGardees({ url, service, maintenant });
  return { fait: true, finis: finis.length, avis, supprimes, incomplets, ignores, factures, smtp: cfg.pret };
}
