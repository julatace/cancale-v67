// ─────────────────────────────────────────────────────────────────────────────
// LES SMS DE CHRONOPOST — 9 nov., lecteur PRUDENT (forme réelle PAS ENCORE MESURÉE).
//
// Julien veut ses SMS Chronopost comme ceux de Mondial Relay. Aucun SMS Chronopost
// réel n'a été copié : on n'invente pas une forme. Le lecteur ne range QUE ce qui
// porte un n° de la FORME PROPRE de Chronopost (« XW/ZW + 9 chiffres + TS/SP »,
// `FORME_CHRONOPOST_PROPRE`) :
//   · « disponible » seulement si le SMS dit qu'il est disponible/arrivé/en attente
//     ET porte un code de retrait écrit après le mot « code » (jamais un chiffre
//     au hasard), et qu'aucune CONDITION ne précède (« si votre colis n'est pas
//     retiré… » ne constate rien, §5) ;
//   · sinon, avec ce n° : « à vérifier » (le n° SEUL est rangé, jamais le texte,
//     qui peut porter un code) — comme un SMS Mondial Relay d'une forme pas apprise ;
//   · sans n° de forme propre : rien n'est rangé (rien d'identifiable).
// ⚠️ LE VENDEUR EST CELUI DU JETON (api/_lib/sms-mondialrelay.js).
// La ligne a LA FORME des e-mails de suivi Chronopost (`email_track_chronopost_{n°}`) :
// l'app, le widget et le rappel la lisent sans rien changer. Un e-mail déjà rangé
// GAGNE ; un retiré reste retiré (`conserverRetrait`).
// Pour apprendre la vraie forme : docs/passation/2026-11-09-transporteurs-emails.md
// (« Copie-moi un SMS Chronopost »).
// ─────────────────────────────────────────────────────────────────────────────
import { plat, AUTHENTIFICATION } from './sms-commun.js';
import { conserverRetrait, normaliserSuivi } from './etat-colis-email.js';
import { FORME_CHRONOPOST_PROPRE } from './suivi-colis.js';

export const MARQUE_CHRONO = /chronopost|chrono\s*relais|pickup\s+station/i;
const N_CHRONO = /\b([XZ]W\s?\d{3}\s?\d{3}\s?\d{3}\s?(?:TS|SP))\b/i;
const DISPO = /\b(?:est\s+(?:disponible|arriv[ée]e?)|vous\s+attend|est\s+en\s+attente)\b/i;
const CODE = /\bcode\s*(?:de\s+retrait\s*)?:?\s*([A-Z0-9]{4,8})\b/i;
const CONDITION = /\b(?:si|s['’])\s+(?:votre|le)\s+colis\s+n['’]est\s+pas/i;

export function lireSmsChronopost({ texte = '', expediteur = '' } = {}) {
  const t = plat(texte);
  if (!t) return { type: 'ignore', raison: 'vide' };
  if (AUTHENTIFICATION.test(t)) return { type: 'ignore', raison: 'authentification' };
  if (!MARQUE_CHRONO.test(t) && !MARQUE_CHRONO.test(plat(expediteur))) return { type: 'ignore', raison: 'pas-chronopost' };
  const n = N_CHRONO.exec(t);
  const suivi = n ? normaliserSuivi(n[1]) : '';
  if (!suivi || !FORME_CHRONOPOST_PROPRE.test(suivi)) return { type: 'inconnu', suivi: '' };
  const c = CODE.exec(t);
  const code = c && /\d/.test(c[1]) && normaliserSuivi(c[1]) !== suivi ? c[1].toUpperCase() : '';
  if (DISPO.test(t) && code && !CONDITION.test(t)) return { type: 'disponible', suivi, code };
  return { type: 'inconnu', suivi };
}

export const idLigneSmsChrono = (suivi) => `email_track_chronopost_${normaliserSuivi(suivi)}`;
const isoOk = (v) => Number.isFinite(Date.parse(String(v || '')));
export function ligneSmsChronopost(lu, prev, { smsAt, maintenant } = {}) {
  if (!lu || !lu.suivi) return { data: null, action: 'sans-numero' };
  const p = prev && typeof prev === 'object' ? prev : null;
  const now = maintenant || new Date().toISOString();
  const at = isoOk(smsAt) ? new Date(Date.parse(smsAt)).toISOString() : now;
  const base = { type: 'suivi', carrier: 'chronopost', suivi: lu.suivi };
  const smsTrace = { at, forme: lu.type };
  if (lu.type === 'disponible') {
    if (p && p.status === 'delivered') return { data: null, action: 'deja-retire' };
    if (!p) {
      // Forme pas mesurée : jamais d'arrivée datée (`arriveLe` absent ⇒ une borne, pas l'arrivée).
      return { action: 'range', data: { ...base, status: 'available', statusLabel: 'Disponible au point de retrait (SMS Chronopost)',
        subject: `SMS Chronopost : colis ${lu.suivi} disponible`, receivedAt: now, emailAt: at, arriveLe: null,
        code: lu.code, code2: null, artTitle: null, lieu: null, limite: null, consigne: false,
        qrB64: null, qrType: null, qrUrl: null, account: '', source: 'sms', sms: smsTrace } };
    }
    const plusRecent = !!(isoOk(p.emailAt) && Date.parse(at) > Date.parse(p.emailAt));
    const garde = conserverRetrait(p, { status: 'available', label: 'Disponible au point de retrait (SMS Chronopost)' }, plusRecent);
    const data = { ...p, ...base, status: garde.status, statusLabel: garde.status === p.status ? (p.statusLabel || garde.label) : garde.label,
      receivedAt: now, emailAt: [at, p.emailAt].filter(isoOk).sort().pop() || at,
      code: p.code || lu.code, sms: smsTrace, aussiSms: true };
    if (p.code && String(p.code) !== lu.code) data.codeSms = lu.code;
    if (p.smsAVerifier) delete data.smsAVerifier;
    return { action: 'fusionne', data };
  }
  if (lu.type === 'inconnu') {
    if (p) return { data: null, action: 'deja-connu' };
    return { action: 'a-verifier', data: { ...base, status: 'info', statusLabel: 'SMS Chronopost pas reconnu — à vérifier',
      subject: `SMS Chronopost pas reconnu (colis ${lu.suivi})`, receivedAt: now, emailAt: at,
      code: null, code2: null, artTitle: null, lieu: null, limite: null, consigne: false,
      qrB64: null, qrType: null, qrUrl: null, account: '', source: 'sms', smsAVerifier: true, sms: smsTrace } };
  }
  return { data: null, action: 'ignore' };
}
