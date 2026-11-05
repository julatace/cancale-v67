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
const dateLongue = (t) => new Date(t).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long' });
const echapper = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Ce qui n'est pas relié, dans l'ordre où ça compte. `true` relié · `false` pas
// relié · `null` pas su (jamais écrit comme « pas relié »).
export const RELIER = [
  { id: 'vinted', texte: 'Ton compte Vinted : installe l’extension VRM, puis ouvre Vinted connecté à ton compte. Elle lit tes annonces et tes ventes.' },
  { id: 'emails', texte: 'Tes e-mails Vinted : VRM y lit tes ventes, tes bordereaux et tes codes de retrait. Paramètres → Réglages → E-mails te montre comment les transférer.' },
  { id: 'notifications', texte: 'Les notifications : aucun appareil ne les reçoit encore. Paramètres → Réglages → Notifications, puis « Activer sur cet appareil ».' },
];
export function texteRelance(etape, { fin, annule = false, relie = {}, lien = '' } = {}) {
  const finTxt = Number.isFinite(Date.parse(fin || '')) ? dateLongue(Date.parse(fin)) : '';
  const pied = lien
    ? `Tu reçois cet e-mail parce que ton essai gratuit de VRM est en cours. Pour ne plus recevoir ces rappels : ${lien}`
    : 'Tu reçois cet e-mail parce que ton essai gratuit de VRM est en cours.';
  let sujet = '', paras = [];
  if (etape === 'j1') {
    sujet = 'Bienvenue sur VRM — ton premier geste';
    paras = [
      'Bonjour,',
      `Ton essai gratuit de VRM a commencé${finTxt ? ` : il dure jusqu’au ${finTxt}` : ''}. Sans engagement.`,
      'Le premier geste qui rend VRM utile : installe l’extension VRM, puis ouvre Vinted dans le même navigateur. VRM lit tes annonces et tes ventes, et donne à chaque article un numéro de rangement.',
      `Ouvrir VRM : ${SITE}`,
    ];
  } else if (etape === 'j3') {
    const manquent = RELIER.filter((x) => relie[x.id] === false);
    const pasSu = RELIER.some((x) => relie[x.id] !== true && relie[x.id] !== false);
    sujet = manquent.length ? 'VRM — ce qui n’est pas encore relié' : 'VRM — tout est relié';
    paras = ['Bonjour,'];
    if (manquent.length) {
      paras.push('Voici ce qui n’est pas encore relié à ton compte VRM :', ...manquent.map((x) => `· ${x.texte}`));
    } else if (!pasSu) {
      paras.push('Ton compte Vinted, tes e-mails et tes notifications sont reliés : VRM suit tes ventes et tes colis tout seul.');
    }
    if (pasSu) paras.push('Paramètres → Réglages → Comptes liés te dit ce qui est relié et ce qui attend un geste.');
    if (finTxt) paras.push(`Ton essai continue jusqu’au ${finTxt}.`);
    paras.push(`Ouvrir VRM : ${SITE}`);
  } else if (etape === 'j6') {
    sujet = 'Ton essai VRM se termine demain';
    paras = annule
      ? ['Bonjour,', `Ton essai gratuit se termine demain${finTxt ? `, le ${finTxt}` : ''}. Tu as arrêté l’abonnement : ton accès à VRM se fermera à ce moment-là. Tes données restent gardées.`,
        'Pour continuer : VRM → Paramètres → Abonnement → « Reprendre mon abonnement ».', `Ouvrir VRM : ${SITE}`]
      : ['Bonjour,', `Ton essai gratuit se termine demain${finTxt ? `, le ${finTxt}` : ''}. Ensuite ton abonnement démarre au prix affiché à ton inscription — rien à faire pour continuer.`,
        'Si tu ne veux pas continuer, résilie avant demain : VRM → Paramètres → Abonnement → « Résilier ».', `Ouvrir VRM : ${SITE}`];
  } else return null;
  const texte = [...paras, '', '—', pied].join('\n\n');
  const html = `<!doctype html><html lang="fr"><body style="margin:0;padding:24px;background:#ffffff;color:#1d1d1f;font:15px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">`
    + `<div style="max-width:520px;margin:0 auto">`
    + paras.map((p) => `<p style="margin:0 0 14px">${echapper(p).replace(/https:\/\/vrm\.center\S*/g, (u) => `<a href="${u}" style="color:#0071e3">${u}</a>`)}</p>`).join('')
    + `<hr style="border:0;border-top:1px solid #e5e5ea;margin:24px 0 12px">`
    + `<p style="margin:0;color:#6e6e73;font-size:12px">${echapper(pied).replace(/https:\/\/vrm\.center\S*/g, (u) => `<a href="${u}" style="color:#6e6e73">ne plus recevoir ces rappels</a>`)}</p>`
    + `</div></body></html>`;
  return { sujet, texte, html };
}

// ── LECTURES / ÉCRITURES (clé de service ; `null` = pas su) ─────────────────
async function lire(chemin) {
  if (!SERVICE()) return null;
  try {
    const r = await fetch(`${SUPABASE_URL()}/rest/v1/${chemin}`, { headers: { ...sbCle(SERVICE()) } });
    if (!r.ok) return null;
    const j = await r.json();
    return Array.isArray(j) ? j : null;
  } catch (_) { return null; }
}
// Les comptes en essai (pagination : jamais une demi-liste prise pour complète).
export async function listerEssais() {
  const out = [];
  for (let from = 0; from < 100000; from += 1000) {
    const page = await lire(`abonnements?statut=eq.trialing&select=owner,statut,fin_periode,annule_fin_periode,mode_test&order=owner.asc&offset=${from}&limit=1000`);
    if (!page) return null;
    out.push(...page);
    if (page.length < 1000) break;
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
    const r = await fetch(`${SUPABASE_URL()}/auth/v1/admin/users/${encodeURIComponent(owner)}`, { headers: { ...sbCle(SERVICE()) } });
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
async function ecrire(owner, id, data) {
  if (!SERVICE()) return false;
  try {
    const r = await fetch(`${SUPABASE_URL()}/rest/v1/app_data?on_conflict=owner,id`, {
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
  const proprio = await proprietaires();
  if (!proprio) return { pret: true, envoyes: 0, arret: 'proprietaire pas su' };
  const essais = await listerEssais();
  if (!essais) return { pret: true, envoyes: 0, arret: 'essais illisibles' };
  const ignores = {}; const ign = (r) => { ignores[r] = (ignores[r] || 0) + 1; };
  let envoyes = 0;
  for (const a of essais) {
    if (envoyes >= MAX_PAR_PASSAGE) { ign('plafond du passage'); continue; }
    if (horloge() >= jusqua) { ign('temps du passage'); continue; }
    const owner = String((a && a.owner) || '').toLowerCase();
    if (!UUID.test(owner)) { ign('identifiant'); continue; }
    if (a.statut !== 'trialing') { ign('pas en essai'); continue; }
    if (proprio.has(owner)) { ign('proprietaire'); continue; }
    if (a.mode_test !== false && !cfg.modeTest) { ign('mode test'); continue; }
    const [choix, envois] = await Promise.all([lireChoix(owner), lireEnvois(owner)]);
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
    const base = { ...(envois.envois || {}) };
    const reserve = await ecrire(owner, ID_ENVOIS, { envois: { ...base, [etape]: { at: new Date(maintenant).toISOString(), issue: 'en-cours' } } });
    if (!reserve) { ign('reservation non confirmee'); continue; }
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
    const fin = issue === 'refuse'
      ? { ...base }
      : { ...base, [etape]: { at: new Date(maintenant).toISOString(), issue } };
    await ecrire(owner, ID_ENVOIS, { envois: fin, ...(issue === 'refuse' ? { dernierRefus: { etape, at: new Date(maintenant).toISOString(), etapeSmtp: String((r && r.etape) || '') } } : {}) });
    if (issue === 'envoye') envoyes++; else ign(`smtp ${issue}`);
  }
  return { pret: true, envoyes, essais: essais.length, ignores };
}
