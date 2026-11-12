// api/_lib/relances-essai.js
// ════════════════════════════════════════════════════════════════════════════
// LES E-MAILS PENDANT L'ESSAI GRATUIT (5 nov., Julien : « des e-mails de relance
// pendant l'essai gratuit sans engagement, pour convertir le client »).
// ════════════════════════════════════════════════════════════════════════════
// Trois e-mails, courts, au plus un par jour, envoyés par le cron du matin
// (api/ship-reminders.js — aucune fonction de plus, plan Hobby) :
//   j1  bienvenue et le premier geste            (jour 1 ou 2 de l'essai)
//   j3  ce qui n'est pas encore relié            (jour 3 à 5)
//   j6  l'essai se termine demain                (la veille de la fin)
//
// ⚠️ À QUI — ET SURTOUT À QUI JAMAIS :
//   · seulement un compte dont l'abonnement est EN ESSAI (`abonnements.statut =
//     'trialing'`, écrit par le webhook Stripe signé). Un abonné qui paie
//     (`active`, `past_due`…) n'est jamais dans la liste ;
//   · jamais Julien : le propriétaire de l'installation (`vrm_reglages.proprietaire`
//     ET `VRM_OWNER_UID`) est écarté ; si AUCUN des deux n'est lisible, on ne
//     sait pas qui il est ⇒ RIEN ne part (« pas su » ≠ « personne ») ;
//   · seulement l'adresse DU COMPTE (Supabase Auth, confirmée par son lien :
//     `email_confirmed_at`) — jamais une adresse de réception, jamais une
//     adresse saisie ailleurs ; non confirmée ⇒ rien ;
//   · jamais un essai en MODE TEST de Stripe (des essais de Julien), sauf si
//     `RELANCES_ESSAI_MODE_TEST=1` est posé exprès ;
//   · jamais quelqu'un qui s'est désinscrit (un clic, `relances_essai_choix`).
//
// ⚠️ SANS ENVOI CONFIGURÉ, RIEN NE PART, ET RÉGLAGES LE DIT. L'envoi passe par
//    un serveur SMTP (une boîte de VRM, ex. Gmail + mot de passe d'application :
//    gratuit — §2.9, aucun service payant à l'usage) réglé par des variables
//    d'environnement Vercel, jamais dans le dépôt :
//      RELANCES_SMTP_HOTE · RELANCES_SMTP_PORT (465 par défaut) ·
//      RELANCES_SMTP_UTILISATEUR · RELANCES_SMTP_MOT_DE_PASSE · RELANCES_EXPEDITEUR
//    + SUPABASE_SERVICE_KEY (lister les essais, lire l'adresse du compte, signer
//    le lien de désinscription). Une seule absente ⇒ `pret: false`.
//
// ⚠️ UN E-MAIL N'EST JAMAIS ENVOYÉ DEUX FOIS : l'étape est RÉSERVÉE dans la
//    ligne `relances_essai` du vendeur AVANT l'envoi ; une réservation non
//    confirmée par la base ⇒ rien ne part. Un refus du serveur SMTP AVANT le
//    message (rien n'est parti) libère l'étape pour le lendemain ; un envoi
//    « incertain » ne se refait pas.
// ⚠️ Les gabarits ne portent AUCUNE donnée réelle : ni nom, ni pseudo, ni chiffre
//    de ses ventes — seulement des dates et ce qui n'est pas relié.
import crypto from 'node:crypto';
import { sbCle } from './cle.js';
import { envoyerSmtp, emailSur, hoteValide } from './smtp.js';
import { gabaritMail as gabaritEmail } from './mail-gabarit.js';
import { lireMentions } from './mentions-legales.js';
import { fetchAvecDelai } from './fetch-delai.js';   // (11 nov.) chaque appel sortant a un délai
import { reserverMemo, modifierLigneCas } from './cas.js';   // (11 nov.) réservation par comparer-et-échanger

export const SITE = 'https://vrm.center';
export const ID_ENVOIS = 'relances_essai';
export const ID_CHOIX = 'relances_essai_choix';
export const DUREE_ESSAI_JOURS = 7;
export const ETAPES = ['j1', 'j3', 'j6'];
export const MAX_PAR_PASSAGE = 40;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SUPABASE_URL = () => process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
const SERVICE = () => process.env.SUPABASE_SERVICE_KEY || '';

// ── LA CONFIGURATION (trois états côté écran : prête · manque X · pas su) ───
export function configurationRelances(env = process.env) {
  const manque = [];
  if (!env.SUPABASE_SERVICE_KEY) manque.push('SUPABASE_SERVICE_KEY');
  if (!hoteValide(env.RELANCES_SMTP_HOTE)) manque.push('RELANCES_SMTP_HOTE');
  const port = Number(env.RELANCES_SMTP_PORT || 465);
  if (![465, 587].includes(port)) manque.push('RELANCES_SMTP_PORT');
  if (!env.RELANCES_SMTP_UTILISATEUR) manque.push('RELANCES_SMTP_UTILISATEUR');
  if (!env.RELANCES_SMTP_MOT_DE_PASSE) manque.push('RELANCES_SMTP_MOT_DE_PASSE');
  if (!emailSur(env.RELANCES_EXPEDITEUR)) manque.push('RELANCES_EXPEDITEUR');
  return { pret: manque.length === 0, manque, port, modeTest: env.RELANCES_ESSAI_MODE_TEST === '1' };
}

// ── LE LIEN DE DÉSINSCRIPTION ───────────────────────────────────────────────
// `<owner>.<signature>` : une signature HMAC (clé dérivée de la clé de SERVICE,
// jamais la clé publique du dépôt) sur l'identifiant du compte. Lire la base ne
// suffit pas à le fabriquer ; il ne désinscrit que CE compte, de CES e-mails.
const b64url = (b) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function cleLien(service = SERVICE()) {
  if (!service) return null;
  return crypto.createHmac('sha256', String(service)).update('vrm-relances-essai-v1').digest();
}
export function jetonDesinscription(owner, service = SERVICE()) {
  const k = cleLien(service);
  if (!k || !UUID.test(String(owner || ''))) return null;
  return `${String(owner).toLowerCase()}.${b64url(crypto.createHmac('sha256', k).update(String(owner).toLowerCase()).digest()).slice(0, 32)}`;
}
// Rend l'identifiant du compte si la signature est bonne, sinon `null`.
export function lireJeton(t, service = SERVICE()) {
  const m = /^([0-9a-f-]{36})\.([A-Za-z0-9_-]{32})$/.exec(String(t || '').trim());
  if (!m || !UUID.test(m[1])) return null;
  const attendu = jetonDesinscription(m[1], service);
  if (!attendu) return null;
  const a = Buffer.from(attendu), b = Buffer.from(`${m[1]}.${m[2]}`);
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? m[1] : null;
}
export const lienDesinscription = (owner, service = SERVICE()) => {
  const t = jetonDesinscription(owner, service);
  return t ? `${SITE}/api/compte?mode=relances&d=${t}` : null;
};

// ── QUEL E-MAIL AUJOURD'HUI (pur) ────────────────────────────────────────────
// Les jours sont ceux de PARIS. Le début de l'essai = sa fin − 7 jours (Stripe
// donne la fin : `fin_periode` d'un abonnement en essai).
const jourParis = (t) => new Date(t).toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });
const ecartJours = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400e3);
// Une étape est « faite » si elle est partie, peut-être partie, ou en cours
// (une réservation restée en cours = un envoi interrompu : on ne le refait pas).
export const etapeFaite = (envois, e) => {
  const x = envois && envois[e];
  return !!(x && ['envoye', 'incertain', 'en-cours'].includes(x.issue));
};
export function etapeDuJour({ fin, maintenant = Date.now(), envois = {} }) {
  const tFin = Date.parse(fin || '');
  if (!Number.isFinite(tFin) || tFin <= maintenant) return null;
  const aujourdhui = jourParis(maintenant);
  const debut = jourParis(tFin - DUREE_ESSAI_JOURS * 86400e3);
  const jour = ecartJours(debut, aujourdhui) + 1;          // 1 = le jour où il a commencé
  const reste = ecartJours(aujourdhui, jourParis(tFin));   // 1 = l'essai finit demain
  if (reste === 1) return etapeFaite(envois, 'j6') ? null : 'j6';
  if (jour >= 3 && jour <= 5 && reste > 1) return etapeFaite(envois, 'j3') ? null : 'j3';
  if (jour >= 1 && jour <= 2 && reste > 1) return etapeFaite(envois, 'j1') ? null : 'j1';
  return null;
}

// ── LES TEXTES (sobres, sans donnée réelle) ─────────────────────────────────
// (5 nov., soir, Julien : « ça doit être bcp plus clair ».) Chaque e-mail suit
// la forme de api/_lib/mail-gabarit.js : un titre qui dit ce que c'est, une ou
// deux phrases sur ce qu'il faut faire, UN bouton (« Ouvrir VRM »), le pied en
// petit (pourquoi ce message, comment ne plus le recevoir).
const dateLongue = (t) => new Date(t).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long' });
// Ce qui n'est pas relié, dans l'ordre où ça compte. `true` relié · `false` pas
// relié · `null` pas su (jamais écrit comme « pas relié »).
export const RELIER = [
  { id: 'vinted', texte: 'Ton compte Vinted : installe l’extension VRM, puis ouvre Vinted connecté à ton compte.' },
  { id: 'emails', texte: 'Tes e-mails Vinted : transfère-les à VRM pour qu’il lise tes ventes, bordereaux et codes de retrait. Le pas-à-pas est dans E-mails → Relier ma boîte.' },
  { id: 'notifications', texte: 'Les notifications : active-les sur ton téléphone, dans Paramètres → Réglages → Notifications → « Activer sur cet appareil ».' },
];
export function texteRelance(etape, { fin, annule = false, relie = {}, lien = '' } = {}) {
  const finTxt = Number.isFinite(Date.parse(fin || '')) ? dateLongue(Date.parse(fin)) : '';
  const pied = { texte: 'Tu reçois ce message parce que ton essai gratuit de VRM est en cours.', ...(lien ? { lien, motLien: 'ne plus recevoir ces rappels' } : {}) };
  const bouton = { mot: 'Ouvrir VRM', url: SITE };
  let sujet = '', titre = '', preentete = '', paras = [], liste = [], suite = [];
  if (etape === 'j1') {
    sujet = 'Bienvenue sur VRM : ton premier geste';
    titre = 'Bienvenue sur VRM';
    preentete = 'Installe l’extension, ouvre Vinted : VRM fait le reste.';
    paras = [
      `Ton essai gratuit a commencé${finTxt ? `. Il dure jusqu’au ${finTxt}` : ''}, sans engagement.`,
      'Ton premier geste : installe l’extension VRM, puis ouvre Vinted dans le même navigateur. VRM lit alors tes annonces et tes ventes, et donne un numéro de rangement à chaque article.',
    ];
  } else if (etape === 'j3') {
    const manquent = RELIER.filter((x) => relie[x.id] === false);
    const pasSu = RELIER.some((x) => relie[x.id] !== true && relie[x.id] !== false);
    // (8 nov.) Le sujet dit la même chose que le titre : « pas su » n'est jamais « tout est relié ».
    sujet = manquent.length ? 'Ce qui n’est pas encore relié à VRM' : pasSu ? 'Où en est ton compte VRM' : 'Tout est relié à VRM';
    preentete = manquent.length ? 'Quelques minutes pour que VRM suive tes ventes tout seul.' : '';
    titre = manquent.length ? (manquent.length === 1 ? 'Une chose n’est pas encore reliée' : `${manquent.length} choses ne sont pas encore reliées`) : pasSu ? 'Où en est ton compte VRM' : 'Tout est relié';
    if (manquent.length) {
      paras.push('Relie-les pour que VRM suive tes ventes et tes colis tout seul :');
      liste = manquent.map((x) => x.texte);
    } else if (!pasSu) {
      paras.push('Ton compte Vinted, tes e-mails et tes notifications sont reliés : VRM suit tes ventes et tes colis tout seul. Rien à faire.');
    }
    if (pasSu) suite.push('Pour voir ce qui est relié et ce qui attend un geste : Paramètres → Réglages → Comptes liés.');
    if (finTxt) suite.push(`Ton essai continue jusqu’au ${finTxt}.`);
  } else if (etape === 'j6') {
    sujet = 'Ton essai VRM se termine demain';
    titre = 'Ton essai se termine demain';
    preentete = annule ? 'Ton accès se ferme demain. Tes données restent gardées.' : 'Rien à faire pour continuer.';
    paras = annule
      ? [`Tu as arrêté l’abonnement : ton accès à VRM se ferme demain${finTxt ? ` (${finTxt})` : ''}. Tes données restent gardées.`,
        'Pour continuer : Paramètres → Abonnement → « Reprendre mon abonnement ».']
      : [`Demain${finTxt ? ` (${finTxt})` : ''}, ton abonnement démarre au prix affiché à ton inscription. Rien à faire pour continuer.`,
        'Pour arrêter avant : Paramètres → Abonnement → « Résilier ».'];
  } else return null;
  // (8 nov.) E-mail FACULTATIF : « Gérer mes e-mails » au pied (Réglages → Notifications).
  const { texte, html } = gabaritEmail({ titre, preentete, paras, liste, suite, bouton, pied, facultatif: true });
  return { sujet, texte, html };
}

// ── LECTURES / ÉCRITURES (clé de service ; `null` = pas su) ─────────────────
async function lire(chemin) {
  if (!SERVICE()) return null;
  try {
    const r = await fetchAvecDelai(`${SUPABASE_URL()}/rest/v1/${chemin}`, { headers: { ...sbCle(SERVICE()) } });
    if (!r.ok) return null;
    const j = await r.json();
    return Array.isArray(j) ? j : null;
  } catch (_) { return null; }
}
// Les comptes en essai (pagination : jamais une demi-liste prise pour complète).
export async function listerEssais() {
  const out = [];
  // (11 nov., familles-serveur) pagination PAR CLÉ (`owner=gt.` le dernier lu),
  // jamais par `offset=` : une ligne qui change pendant la lecture ne fait ni
  // sauter ni doubler une autre.
  let apres = '';
  for (let n = 0; n < 100; n++) {
    const page = await lire(`abonnements?statut=eq.trialing${apres ? `&owner=gt.${encodeURIComponent(apres)}` : ''}&select=owner,statut,fin_periode,annule_fin_periode,mode_test&order=owner.asc&limit=1000`);
    if (!page) return null;
    out.push(...page);
    if (page.length < 1000) break;
    apres = String(page[page.length - 1].owner || '');
    if (!apres) return null;
  }
  return out;
}
// Les identifiants à ne JAMAIS relancer (le propriétaire). `null` = pas su.
export async function proprietaires() {
  const s = new Set();
  const env = String(process.env.VRM_OWNER_UID || '').trim().toLowerCase();
  if (UUID.test(env)) s.add(env);
  const r = await lire('vrm_reglages?cle=eq.proprietaire&select=valeur');
  if (r && r[0] && UUID.test(String(r[0].valeur || ''))) s.add(String(r[0].valeur).toLowerCase());
  return s.size ? s : null;
}
// L'adresse DU COMPTE, seulement si Supabase l'a confirmée par son lien.
export async function adresseDuCompte(owner) {
  if (!SERVICE() || !UUID.test(String(owner))) return { etat: 'passu' };
  try {
    const r = await fetchAvecDelai(`${SUPABASE_URL()}/auth/v1/admin/users/${encodeURIComponent(owner)}`, { headers: { ...sbCle(SERVICE()) } });
    if (r.status === 404) return { etat: 'absent' };
    if (!r.ok) return { etat: 'passu' };
    const u = await r.json();
    const email = String((u && u.email) || '').trim();
    if (!emailSur(email)) return { etat: 'absent' };
    if (!(u.email_confirmed_at || u.confirmed_at)) return { etat: 'non-confirmee' };
    return { etat: 'ok', email };
  } catch (_) { return { etat: 'passu' }; }
}
const ligneDe = async (owner, id) => {
  const r = await lire(`app_data?owner=eq.${encodeURIComponent(owner)}&id=eq.${id}&select=data&limit=1`);
  if (!r) return null;
  const d = r[0] && r[0].data;
  return d && typeof d === 'object' ? d : {};
};
export const lireEnvois = (owner) => ligneDe(owner, ID_ENVOIS);
export const lireChoix = (owner) => ligneDe(owner, ID_CHOIX);
// (12 nov., M92) Les deux lignes de TOUS les essais du passage, en lots de 100
// vendeurs (une lecture par lot, au lieu de deux par essai). Rend Map owner →
// { choix, envois } (lignes absentes ⇒ {}), ou null (pas su : on relit vendeur par
// vendeur, comme avant). La liste est entière : `limit` = lignes possibles.
export async function lireLignesEnLot(owners) {
  const out = new Map();
  const liste = [...new Set(owners.filter((o) => UUID.test(String(o))))];
  for (let i = 0; i < liste.length; i += 100) {
    const lot = liste.slice(i, i + 100);
    const r = await lire(`app_data?owner=in.(${lot.map(encodeURIComponent).join(',')})&id=in.(${ID_ENVOIS},${ID_CHOIX})&select=owner,id,data&order=owner.asc,id.asc&limit=${lot.length * 2}`);
    if (!r) return null;
    for (const o of lot) out.set(o, { choix: {}, envois: {} });
    for (const l of r) {
      const o = String((l && l.owner) || '').toLowerCase(); const x = out.get(o);
      if (!x) continue;
      const d = l.data && typeof l.data === 'object' ? l.data : {};
      if (l.id === ID_ENVOIS) x.envois = d; else if (l.id === ID_CHOIX) x.choix = d;
    }
  }
  return out;
}
async function ecrire(owner, id, data) {
  if (!SERVICE()) return false;
  try {
    const r = await fetchAvecDelai(`${SUPABASE_URL()}/rest/v1/app_data?on_conflict=owner,id`, {
      method: 'POST',
      headers: { ...sbCle(SERVICE()), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify([{ owner, id, data }]),
    });
    if (!r.ok) return false;
    const j = await r.json().catch(() => null);
    return Array.isArray(j) && j.length === 1;
  } catch (_) { return false; }
}
// Son choix (désinscrit / réinscrit), écrit par le serveur seul.
export const ecrireChoix = (owner, abonne) => ecrire(owner, ID_CHOIX, { desinscrit: !abonne, at: new Date().toISOString() });
// Ce qui est relié (pour j3) : trois lectures de scalaires, chacune true/false/null.
export async function ceQuiEstRelie(owner) {
  const o = encodeURIComponent(owner);
  const [v, e, p] = await Promise.all([
    lire(`vinted_accounts?owner=eq.${o}&select=vinted_user_id&limit=1`),
    lire(`app_data?owner=eq.${o}&id=eq.email_journal&select=id&limit=1`),
    lire(`app_data?owner=eq.${o}&id=eq.push_subs&select=subs:data->subs&limit=1`),
  ]);
  return {
    vinted: v ? v.length > 0 : null,
    emails: e ? e.length > 0 : null,
    notifications: p ? !!(p[0] && Array.isArray(p[0].subs) && p[0].subs.length > 0) : null,
  };
}

// ── LE PASSAGE DU MATIN ─────────────────────────────────────────────────────
// Rend un résumé (jamais une adresse) : { pret, envoyes, ignores: {raison: n} }.
// `jusqua` : l'heure (ms) après laquelle on ne COMMENCE plus d'envoi — le cron
// du matin a d'abord fait les rappels de tous les vendeurs, et une fonction
// Vercel s'arrête à 300 s : un envoi coupé en plein milieu resterait « en
// cours » (jamais refait). Ce qui n'est pas parti attend le lendemain.
export async function passageRelances({ maintenant = Date.now(), env = process.env, envoyer = envoyerSmtp, jusqua = Infinity, horloge = Date.now } = {}) {
  const cfg = configurationRelances(env);
  if (!cfg.pret) return { pret: false, manque: cfg.manque, envoyes: 0 };
  // (8 nov.) L'identité de l'éditeur pour le pied des e-mails (public/legal/editeur.js) ;
  // illisible ⇒ le pied n'en dit rien (jamais une mention inventée).
  try { await lireMentions(); } catch (_) {}
  const proprio = await proprietaires();
  if (!proprio) return { pret: true, envoyes: 0, arret: 'proprietaire pas su' };
  const essais = await listerEssais();
  if (!essais) return { pret: true, envoyes: 0, arret: 'essais illisibles' };
  const ignores = {}; const ign = (r) => { ignores[r] = (ignores[r] || 0) + 1; };
  let envoyes = 0;
  const enLot = await lireLignesEnLot(essais.filter((a) => a && a.statut === 'trialing').map((a) => String(a.owner || '').toLowerCase()));
  for (const a of essais) {
    if (envoyes >= MAX_PAR_PASSAGE) { ign('plafond du passage'); continue; }
    if (horloge() >= jusqua) { ign('temps du passage'); continue; }
    const owner = String((a && a.owner) || '').toLowerCase();
    if (!UUID.test(owner)) { ign('identifiant'); continue; }
    if (a.statut !== 'trialing') { ign('pas en essai'); continue; }
    if (proprio.has(owner)) { ign('proprietaire'); continue; }
    if (a.mode_test !== false && !cfg.modeTest) { ign('mode test'); continue; }
    const lu = enLot && enLot.get(owner);
    const [choix, envois] = lu ? [lu.choix, lu.envois] : await Promise.all([lireChoix(owner), lireEnvois(owner)]);
    if (!choix || !envois) { ign('pas su'); continue; }
    if (choix.desinscrit === true) { ign('desinscrit'); continue; }
    const etape = etapeDuJour({ fin: a.fin_periode, maintenant, envois: envois.envois || {} });
    if (!etape) { ign('rien aujourd’hui'); continue; }
    const adr = await adresseDuCompte(owner);
    if (adr.etat !== 'ok') { ign(`adresse ${adr.etat}`); continue; }
    const relie = etape === 'j3' ? await ceQuiEstRelie(owner) : {};
    const lien = lienDesinscription(owner, env.SUPABASE_SERVICE_KEY);
    const t = texteRelance(etape, { fin: a.fin_periode, annule: a.annule_fin_periode === true, relie, lien });
    if (!t || !lien) { ign('texte'); continue; }
    // Réserver AVANT d'envoyer : non confirmé ⇒ rien ne part.
    // (11 nov., H15) par COMPARER-ET-ÉCHANGER (_lib/cas.js) : deux passages qui se
    // chevauchent ⇒ un seul réserve l'étape (l'autre la voit déjà prise).
    const ligneEnvois = { url: SUPABASE_URL(), entetes: sbCle(SERVICE()), owner, id: ID_ENVOIS };
    const res = await reserverMemo({ ...ligneEnvois,
      deja: (d) => !!(d && d.envois && d.envois[etape]),
      nouveau: (d) => ({ ...(d || {}), envois: { ...((d && d.envois) || {}), [etape]: { at: new Date(maintenant).toISOString(), issue: 'en-cours' } } }) });
    if (!res.reserve) { ign(res.raison === 'deja' ? 'deja reserve' : 'reservation non confirmee'); continue; }
    let r;
    try {
      r = await envoyer({
        hote: env.RELANCES_SMTP_HOTE, port: cfg.port, utilisateur: env.RELANCES_SMTP_UTILISATEUR, motDePasse: env.RELANCES_SMTP_MOT_DE_PASSE,
        de: env.RELANCES_EXPEDITEUR, nomDe: 'VRM', a: adr.email, sujet: t.sujet, texte: t.texte, html: t.html,
        entetes: { 'List-Unsubscribe': `<${lien}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click', 'Auto-Submitted': 'auto-generated' },
      });
    } catch (e) { r = { issue: 'incertain', message: String(e && e.message || e).slice(0, 200) }; }
    const issue = ['envoye', 'refuse', 'incertain'].includes(r && r.issue) ? r.issue : 'incertain';
    // Un refus AVANT le message : rien n'est parti ⇒ l'étape est libérée (demain).
    await modifierLigneCas({ ...ligneEnvois, modifier: (d) => {
      const envoisLus = { ...((d && d.envois) || {}) };
      if (issue === 'refuse') delete envoisLus[etape]; else envoisLus[etape] = { at: new Date(maintenant).toISOString(), issue };
      const { dernierRefus: _ancien, ...reste } = d || {};
      return { ...reste, envois: envoisLus, ...(issue === 'refuse' ? { dernierRefus: { etape, at: new Date(maintenant).toISOString(), etapeSmtp: String((r && r.etape) || '') } } : {}) };
    } });
    if (issue === 'envoye') envoyes++; else ign(`smtp ${issue}`);
  }
  return { pret: true, envoyes, essais: essais.length, ignores };
}
