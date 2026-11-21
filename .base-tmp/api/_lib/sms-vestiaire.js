// ─────────────────────────────────────────────────────────────────────────────
// LES SMS DE VESTIAIRE COLLECTIVE (« VestiaireCo ») — 9 nov., lecteur strict.
//
// Formes RÉELLES (captures iPhone de Julien, 9 nov., mot pour mot) :
//   1. « Votre article Gucci vient d'etre vendu. Expédiez-le avant le lundi 9
//      novembre en utilisant l'étiquette d'expédition prépayée disponible, sinon
//      la vente sera annulée. »          (« etre » sans accent)
//   2. « N'oubliez pas d'expédier votre article Gucci avant le lundi 9 novembre,
//      sinon la vente sera annulée. »
//
// ⚠️ LE VENDEUR EST CELUI DU JETON (api/_lib/sms-mondialrelay.js), jamais le texte.
// ⚠️ CES SMS N'ONT AUCUNE IDENTITÉ (ni n° de commande, ni n° de suivi) : une MARQUE
//    et une DATE LIMITE. Une marque n'est pas une identité (§5 « 50 paires
//    identiques ») : ils ne sont JAMAIS rattachés seuls à une vente. Ils sont rangés
//    comme une INFORMATION DATÉE du vendeur (`vrm_sms_infos`, api/_lib/sms-infos.js) ;
//    l'app la montre à côté des ventes Vestiaire à envoyer et ne propose « c'est
//    cette vente ? » que si UNE seule vente Vestiaire à envoyer porte cette marque —
//    une suggestion, jamais une liaison automatique.
// ⚠️ « sinon la vente sera annulée » est une CONDITION : elle ne constate aucune
//    annulation (§5). Une limite dépassée sans preuve d'envoi ⇒ « à vérifier ».
// ⚠️ L'année n'est pas écrite : celle de la réception du SMS, l'année d'après si
//    le mois est AVANT celui de la réception (SMS de décembre, limite en janvier).
// Le rappel (2) met à jour la MÊME information (même marque + même date).
// ─────────────────────────────────────────────────────────────────────────────
import { plat } from './sms-commun.js';
import { limiteDuTexte } from './vestiaire-email.js';

export const MARQUE_VC = /vestiaire/i;
const VENDU = /Votre\s+article\s+(.{1,40}?)\s+vient\s+d['’`]?\s*[êeé]tre\s+vendu\b/i;
const RAPPEL = /N['’`]?\s*oubliez\s+pas\s+d['’`]?\s*exp[ée]dier\s+votre\s+article\s+(.{1,40}?)\s+avant\s+le\b/i;
// Les phrases propres à ces SMS (reconnus même quand Raccourcis n'envoie pas l'expéditeur).
export const estSmsVestiaire = (texte, expediteur) => MARQUE_VC.test(plat(expediteur))
  || (VENDU.test(plat(texte)) && /exp[ée]di/i.test(plat(texte)) && /sinon\s+la\s+vente\s+sera\s+annul/i.test(plat(texte)))
  || (RAPPEL.test(plat(texte)) && /sinon\s+la\s+vente\s+sera\s+annul/i.test(plat(texte)));

const FMT = (() => { try { return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }); } catch (_) { return null; } })();
const baseParis = (iso) => {
  const ms = Date.parse(String(iso || ''));
  if (!FMT || !Number.isFinite(ms)) return null;
  const p = {}; for (const x of FMT.formatToParts(new Date(ms))) p[x.type] = x.value;
  return { a: +p.year, m: +p.month, j: +p.day };
};
const marquePropre = (s) => { const m = plat(s).replace(/[«»"“”]/g, '').trim(); return m.length >= 1 && m.length <= 40 && !/https?:|www\./i.test(m) ? m : ''; };

// Rend { type: 'vestiaire', forme: 'vendu'|'rappel', marque, limite (ISO, fin de journée, Paris), jour ('AAAA-MM-JJ') }
//   ou { type: 'inconnu' } (Vestiaire, forme pas apprise — rien d'identifiable, rien rangé).
export function lireSmsVestiaire({ texte = '', smsAt = '' } = {}) {
  const t = plat(texte);
  const v = VENDU.exec(t);
  const r = v ? null : RAPPEL.exec(t);
  const m = v || r;
  if (!m) return { type: 'inconnu' };
  const marque = marquePropre(m[1]);
  const base = baseParis(smsAt);
  const limite = base ? limiteDuTexte(t, base) : '';
  if (!marque || !limite) return { type: 'inconnu' };
  return { type: 'vestiaire', forme: v ? 'vendu' : 'rappel', marque, limite, jour: limite.slice(0, 10) };
}

// La clé de l'information : même marque (sans casse ni accent) + même jour limite.
export const cleInfoVestiaire = (lu) => `vc|${String(lu.marque).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}|${lu.jour}`;
