// api/_lib/mail-essai.js
// ════════════════════════════════════════════════════════════════════════════
// « M'ENVOYER UN E-MAIL D'ESSAI » (8 nov., Réglages → Notifications)
// ════════════════════════════════════════════════════════════════════════════
// Pour voir un VRAI e-mail de VRM dans sa boîte (Julien : « fais des beaux mails
// à envoyer »), sans attendre le 1er du mois ni un essai gratuit.
//   · sur SON clic seulement (route POST de api/compte.js, `?mode=mail-essai`,
//     session exigée) ;
//   · à SA propre adresse seulement : celle DU COMPTE, confirmée par Supabase
//     (`adresseDuCompte`, la même règle que le bilan et les e-mails de l'essai) —
//     jamais une adresse venue du corps de la requête ;
//   · 3 par heure au plus et par compte : le compteur vit sous le propriétaire
//     NEUTRE (`mail_essai_{uid}`), qu'aucune session ne peut écrire (RLS), et
//     s'écrit par comparer-et-échanger (`modifierNeutre`) — trente clics en
//     parallèle n'en font partir que trois. Base muette ⇒ rien ne part ;
//   · le même canal que les autres e-mails (`RELANCES_SMTP_*`) : pas configuré
//     ⇒ rien ne part, et l'écran le dit ;
//   · le contenu ne porte AUCUNE donnée (ni chiffre, ni pseudo) : il montre la
//     forme des e-mails, pas des chiffres inventés (§2.3).
import { envoyerSmtp } from './smtp.js';
import { gabaritMail, SITE } from './mail-gabarit.js';
import { configurationRelances, adresseDuCompte } from './relances-essai.js';
import { modifierNeutre } from './neutre-cas.js';
import { lireMentions } from './mentions-legales.js';

export const MAX_PAR_HEURE = 3;
export const HEURE_MS = 3600e3;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const idCompteur = (owner) => `mail_essai_${String(owner).toLowerCase().replace(/-/g, '')}`;

export function mailEssai() {
  const { texte, html } = gabaritMail({
    titre: 'Tes e-mails VRM arrivent bien',
    preentete: 'Voici à quoi ressemblent les e-mails que VRM t’envoie.',
    paras: [
      'Tu as demandé cet e-mail d’essai depuis VRM : s’il est dans ta boîte de réception, l’envoi marche.',
      'C’est la forme de tous les e-mails de VRM : un titre, ce qu’il faut savoir, un seul bouton.',
    ],
    bouton: { mot: 'Ouvrir VRM', url: SITE },
    apres: 'Il est arrivé dans les indésirables ? Marque-le « non indésirable » : les suivants arriveront au bon endroit.',
    pied: { texte: 'Tu reçois ce message parce que tu as cliqué sur « M’envoyer un e-mail d’essai » dans VRM (Réglages → Notifications).' },
  });
  return { sujet: 'Ton e-mail d’essai VRM', texte, html };
}

// La réservation (pure) : `d` = la ligne compteur lue (ou null).
export function reserverEssai(d, maintenant = Date.now()) {
  const recents = (d && Array.isArray(d.envois) ? d.envois : []).filter((t) => Number.isFinite(Number(t)) && maintenant - Number(t) < HEURE_MS && Number(t) <= maintenant);
  if (recents.length >= MAX_PAR_HEURE) return { valeur: { trop: true, prochain: Math.min(...recents) + HEURE_MS } };
  return { data: { envois: [...recents, maintenant] }, valeur: { trop: false } };
}

// Rend `{ code, corps }` (jamais l'adresse d'un autre, jamais un secret).
export async function envoyerMailEssai({ owner, env = process.env, maintenant = Date.now(), envoyer = envoyerSmtp, adresse = adresseDuCompte, reserver = (id, decider) => modifierNeutre(id, decider) } = {}) {
  if (!UUID.test(String(owner || ''))) return { code: 401, corps: { ok: false, raison: 'session' } };
  const cfg = configurationRelances(env);
  if (!cfg.pret) return { code: 503, corps: { ok: false, raison: 'non-configure', message: 'L’envoi d’e-mails n’est pas encore configuré : rien n’est parti.' } };
  const adr = await adresse(owner);
  if (!adr || adr.etat !== 'ok') {
    const etat = adr ? adr.etat : 'passu';
    return { code: etat === 'passu' ? 503 : 409, corps: { ok: false, raison: `adresse-${etat}`, message: etat === 'non-confirmee' ? 'Confirme d’abord l’adresse de ton compte (le lien reçu à l’inscription) : rien n’est parti.' : etat === 'passu' ? 'Le serveur n’a pas pu lire l’adresse de ton compte : rien n’est parti. Réessaie dans un instant.' : 'Ton compte n’a pas d’adresse e-mail : rien n’est parti.' } };
  }
  const r = await reserver(idCompteur(owner), (d) => reserverEssai(d, maintenant));
  if (!r || !r.valeur) return { code: 503, corps: { ok: false, raison: 'pas-su', message: 'La base n’a pas répondu : rien n’est parti. Réessaie dans un instant.' } };
  if (r.valeur.trop) return { code: 429, corps: { ok: false, raison: 'trop', prochain: new Date(r.valeur.prochain).toISOString(), message: `Trois e-mails d’essai par heure au plus : réessaie après ${new Date(r.valeur.prochain).toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' })}.` } };
  try { await lireMentions(); } catch (_) {}
  const m = mailEssai();
  let v;
  try {
    v = await envoyer({ hote: env.RELANCES_SMTP_HOTE, port: cfg.port, utilisateur: env.RELANCES_SMTP_UTILISATEUR, motDePasse: env.RELANCES_SMTP_MOT_DE_PASSE,
      de: env.RELANCES_EXPEDITEUR, nomDe: 'VRM', a: adr.email, sujet: m.sujet, texte: m.texte, html: m.html, entetes: { 'Auto-Submitted': 'auto-generated' } });
  } catch (e) { v = { issue: 'incertain', message: String((e && e.message) || e).slice(0, 200) }; }
  const issue = ['envoye', 'refuse', 'incertain'].includes(v && v.issue) ? v.issue : 'incertain';
  if (issue === 'envoye') return { code: 200, corps: { ok: true, issue, a: adr.email } };
  if (issue === 'incertain') return { code: 200, corps: { ok: false, issue, a: adr.email, message: 'La connexion a lâché après l’envoi : il est peut-être parti. Regarde ta boîte dans une minute.' } };
  return { code: 502, corps: { ok: false, issue, message: 'Le serveur d’envoi a refusé : rien n’est parti.' } };
}
