// ─────────────────────────────────────────────────────────────────────────────
// LES SMS DE VINTED GO (« VintedGo ») — 9 nov., lecteur strict.
//
// Formes RÉELLES (captures iPhone de Julien, 9 nov. ; codes, dates et liens inventés ici) :
//   « RAPPEL : utilise le code K12345 pour récupérer ton colis avant le 08/10/2026.
//     Retrouve ton relais ici : https://p.vintedgo.com/e/100001 »
// (le premier SMS, non-rappel, finit aussi par « Retrouve ton relais ici : » — son
//  début n'est pas connu : seule la phrase « utilise le code … avant le … » est lue).
//
// ⚠️ LE CODE DE RETRAIT EST UNE IDENTITÉ (§5) — pas de n° de suivi. Le colis est
//    celui qui porte DÉJÀ ce code (une ligne de colis d'e-mail, ou la conversation
//    Vinted lue par l'extension, `panel_colis_relais`) : la ligne est rangée sous
//    CE code (`email_track_vinted_code-{code}`) et l'app la relie par ce code, comme
//    elle le fait déjà (« le même colis vu des deux côtés se reconnaît par son code »).
//    Code inconnu de VRM ⇒ « à vérifier » avec le code, jamais rattaché par
//    ressemblance (relais, date, titre).
// ⚠️ La date limite est LUE (« avant le JJ/MM/AAAA », jour de Paris) ; l'id après
//    « /e/ » est le relais (même id ⇒ même relais), jamais un colis.
// ⚠️ LE VENDEUR EST CELUI DU JETON VRM (api/_lib/sms-mondialrelay.js), jamais le texte.
// ─────────────────────────────────────────────────────────────────────────────
import { plat, AUTHENTIFICATION } from './sms-commun.js';
import { conserverRetrait } from './etat-colis-email.js';

export const MARQUE_VGO = /vinted\s*go|vintedgo\.com/i;
const CODE_LIMITE = /utilise\s+le\s+code\s+([A-Z]\d{5})\b\s+pour\s+r[ée]cup[ée]rer\s+ton\s+colis\s+avant\s+le\s+(\d{1,2})\/(\d{1,2})\/(\d{4})\b/i;
const RELAIS = /https?:\/\/p\.vintedgo\.com\/e\/(\d{2,12})\b/i;
const dateValide = (a, m, j) => { const d = new Date(Date.UTC(a, m - 1, j)); return d.getUTCFullYear() === a && d.getUTCMonth() === m - 1 && d.getUTCDate() === j; };
const deux = (n) => String(n).padStart(2, '0');

// Rend { type: 'vintedgo', code, limite ('AAAA-MM-JJ'), relaisId, rappel } | { type: 'inconnu' } | { type: 'ignore', raison }.
export function lireSmsVintedGo({ texte = '', expediteur = '' } = {}) {
  const t = plat(texte);
  if (!t) return { type: 'ignore', raison: 'vide' };
  if (AUTHENTIFICATION.test(t)) return { type: 'ignore', raison: 'authentification' };
  if (!MARQUE_VGO.test(t) && !MARQUE_VGO.test(plat(expediteur))) return { type: 'ignore', raison: 'pas-vintedgo' };
  const m = CODE_LIMITE.exec(t);
  if (!m) return { type: 'inconnu' };
  const a = +m[4], mo = +m[3], j = +m[2];
  if (!dateValide(a, mo, j)) return { type: 'inconnu' };
  const r = RELAIS.exec(t);
  return { type: 'vintedgo', code: m[1].toUpperCase(), limite: `${a}-${deux(mo)}-${deux(j)}`, relaisId: r ? r[1] : '', rappel: /^\s*RAPPEL\b/i.test(t) };
}

export const idLigneSmsVgo = (code) => `email_track_vinted_code-${String(code).toUpperCase()}`;
const isoOk = (v) => Number.isFinite(Date.parse(String(v || '')));
// `prev` : la ligne déjà rangée pour ce code (la sienne, ou une ligne de colis d'e-mail qui porte
// ce code) ; `connu` : le code est déjà porté par une conversation Vinted lue (`panel_colis_relais`).
export function ligneSmsVintedGo(lu, prev, { smsAt, maintenant, connu = false } = {}) {
  if (!lu || !lu.code) return { data: null, action: 'sans-code' };
  const p = prev && typeof prev === 'object' ? prev : null;
  const now = maintenant || new Date().toISOString();
  const at = isoOk(smsAt) ? new Date(Date.parse(smsAt)).toISOString() : now;
  const smsTrace = { at, forme: lu.rappel ? 'rappel' : 'code' };
  if (p) {
    if (p.status === 'delivered') return { data: null, action: 'deja-retire' };
    const garde = conserverRetrait(p, { status: 'available', label: p.statusLabel || 'Au point relais (SMS Vinted Go)' }, false);
    // La ligne d'un e-mail GAGNE sur ce qu'elle a ; le SMS ne fait que combler (la date limite lue).
    const data = { ...p, status: garde.status, limite: p.limite || lu.limite, relaisVgo: p.relaisVgo || lu.relaisId || null, sms: smsTrace, aussiSms: true };
    if (!p.code) data.code = lu.code;
    if (p.smsAVerifier && connu) { delete data.smsAVerifier; data.status = 'available'; data.statusLabel = 'Au point relais (SMS Vinted Go)'; }
    return { action: JSON.stringify(data) === JSON.stringify(p) ? 'deja-connu' : 'fusionne', data };
  }
  const base = { type: 'suivi', carrier: 'vinted', suivi: '', code: lu.code, code2: null, artTitle: null, lieu: null,
    limite: lu.limite, consigne: false, qrB64: null, qrType: null, qrUrl: null, account: '', source: 'sms', relaisVgo: lu.relaisId || null,
    receivedAt: now, emailAt: at, arriveLe: null, sms: smsTrace };
  if (connu) return { action: 'range', data: { ...base, status: 'available', statusLabel: 'Au point relais (SMS Vinted Go)', subject: `SMS Vinted Go : colis à retirer avec le code ${lu.code}` } };
  return { action: 'a-verifier', data: { ...base, status: 'info', smsAVerifier: true, statusLabel: 'SMS Vinted Go — code pas encore relié à un colis, à vérifier', subject: `SMS Vinted Go : code ${lu.code} pas encore relié` } };
}
