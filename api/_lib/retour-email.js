// ════════════════════════════════════════════════════════════════════════════
//  LES E-MAILS DE RETOUR D'UN ACHAT (11 nov., lot retours-litiges)
// ════════════════════════════════════════════════════════════════════════════
// Julien : « pour les retours on doit avoir les bordereaux à imprimer aussi ».
// Mesuré dans sa base (lecture seule, 11 nov. — formes, aucune donnée) :
//   1. « Bordereau de retour - {article} - à utiliser avant le JJ/MM/AAAA HH h MM »
//      (côté ACHAT : il renvoie un article). Pièce jointe
//      `Bon-Retour-Vinted-{n° de transaction}.pdf` (application/pdf, MondialRelay) ;
//      corps : « Numéro de suivi : 8 chiffres », « Date limite d'envoi : JJ/MM/AAAA
//      HH h MM », « Numéro de transaction : … », « Article : … ». Aucune règle ne le
//      reconnaissait : rangé « inconnu », TRONQUÉ ⇒ le PDF était perdu.
//   2. « La commande "{article}" a été remboursée ! » (côté ACHAT) : « Le paiement
//      que tu as fait à … a été annulé », « Montant remboursé : NN,NN € »,
//      « N° de transaction : … », « Remboursement estimé sur <moyen> : JJ/MM/AAAA ».
//      ⚠️ Le moyen de paiement porte les 4 derniers chiffres de la carte : JAMAIS
//      rangés (seuls le montant, la date et le n° de transaction le sont).
// Règles (§5) : l'identité est le n° de TRANSACTION (le nom de la pièce, puis le
// corps ; s'ils disent deux numéros différents ⇒ rien, « à vérifier ») ; le sujet
// d'abord ; une date jamais devinée (lue, heure de Paris) ; rien n'est jeté : ce
// qui ne se lit pas entier est gardé par l'appelant (`garderInconnu`).
// Module PUR (aucune lecture, aucune écriture) : exécuté par
// scripts/audit-retours-litiges.cjs, et sa route par le même audit.
import { lireDateLimite } from './limite-envoi.js';

const str = (v) => String(v == null ? '' : v);
const TETE = String.raw`^\s*(?:(?:TR|Fwd?|Re)\s*:\s*)*`;
export const SUJET_BORDEREAU_RETOUR = new RegExp(TETE + String.raw`Bordereau de retour\b`, 'i');
export const SUJET_REMBOURSEMENT_ACHAT = new RegExp(TETE + String.raw`La commande\s+[«"“]?\s*(.+?)\s*[»"”]?\s+a [ée]t[ée] rembours[ée]e`, 'i');
// Le corps d'un remboursement d'ACHAT (l'argent qu'IL a payé lui revient) — jamais
// celui d'une vente (« Tu as été remboursé » n'existe pas côté vendeur).
const CORPS_ACHAT = /paiement que tu as (?:fait|effectu[ée])/i;

const espaces = (s) => str(s).replace(/[   ]/g, ' ').replace(/\*/g, '').replace(/[ \t]+/g, ' ');

export const estBordereauRetour = (sujet) => SUJET_BORDEREAU_RETOUR.test(str(sujet));
export const estRemboursementAchat = (sujet, texte) => SUJET_REMBOURSEMENT_ACHAT.test(str(sujet)) && CORPS_ACHAT.test(espaces(texte));

// « 15/11/2026 23 h 59 » → { jour, heure, iso } (Paris) ; illisible ⇒ null.
function limiteLue(s) {
  const l = lireDateLimite(s);
  return l && isFinite(l.at) ? { jour: l.jour, heure: l.heure, iso: new Date(l.at).toISOString() } : null;
}

// Le PDF du bordereau de retour : UNE pièce PDF (deux ⇒ on ne choisit pas).
export function pdfDuRetour(attachments) {
  const pdfs = (Array.isArray(attachments) ? attachments : []).filter((a) => a && (/application\/pdf/i.test(str(a.contentType)) || /\.pdf$/i.test(str(a.filename))) && str(a.contentB64).length > 40);
  return pdfs.length === 1 ? pdfs[0] : null;
}

// ── 1. « Bordereau de retour » ──────────────────────────────────────────────
// Rend { ok: true, transaction, suivi, dateLimite, dateLimiteJour, dateLimiteIso,
// article, pdf } ou { ok: false, raison } (gardé « à vérifier » par l'appelant).
export function lireBordereauRetour({ subject, text, attachments } = {}) {
  const sujet = espaces(subject).trim();
  if (!estBordereauRetour(sujet)) return { ok: false, raison: 'pas un bordereau de retour' };
  const corps = espaces(text);
  const pdf = pdfDuRetour(attachments);
  const deLaPiece = pdf ? (/Bon[-_ ]Retour[-_ ]Vinted[-_ ](\d{6,20})(?!\d)/i.exec(str(pdf.filename)) || [])[1] || '' : '';
  const duCorps = (/Num[ée]ro de transaction\s*:?\s*(\d{6,20})(?!\d)/i.exec(corps) || /N[°ºo]\s*de transaction\s*:?\s*(\d{6,20})(?!\d)/i.exec(corps) || [])[1] || '';
  if (deLaPiece && duCorps && deLaPiece !== duCorps) return { ok: false, raison: 'deux n° de transaction différents (pièce et corps)' };
  const transaction = deLaPiece || duCorps;
  if (!transaction) return { ok: false, raison: 'aucun n° de transaction' };
  if (!pdf) return { ok: false, raison: 'aucun PDF de bordereau joint (ou plusieurs)', transaction };
  // Le n° de suivi : écrit après « Numéro de suivi », chiffres ou lettres+chiffres.
  const sm = /Num[ée]ro de suivi\s*:?\s*([A-Z0-9]{8,30})(?![A-Z0-9])/i.exec(corps) || /N[°ºo]\s*de suivi\s*:?\s*([A-Z0-9]{8,30})(?![A-Z0-9])/i.exec(corps);
  const suivi = sm && /\d/.test(sm[1]) ? sm[1].toUpperCase() : '';
  // La date limite : le corps (« Date limite d'envoi : »), sinon le sujet (« à utiliser avant le »).
  const dCorps = /Date limite d['’]envoi\s*:?\s*(\d{2}\/\d{2}\/\d{4}(?:\s*(?:à\s*)?\d{1,2}\s*(?:h|:)\s*\d{2})?)/i.exec(corps);
  const dSujet = /avant le\s*:?\s*(\d{2}\/\d{2}\/\d{4}(?:\s*(?:à\s*)?\d{1,2}\s*(?:h|:)\s*\d{2})?)/i.exec(sujet);
  const texteDate = (dCorps && dCorps[1]) || (dSujet && dSujet[1]) || '';
  const lim = texteDate ? limiteLue(texteDate) : null;
  // L'article : « Article : … » du corps, sinon le milieu du sujet.
  let article = ((/(?:^|\n)\s*Article\s*:\s*([^\n]{2,160})/i.exec(corps) || [])[1] || '').trim();
  if (!article) { const m = /Bordereau de retour\s*[-–—]\s*(.+?)\s*[-–—]\s*à utiliser avant/i.exec(sujet); if (m) article = m[1].trim(); }
  return {
    ok: true, transaction, suivi,
    dateLimite: lim ? texteDate.replace(/\s+/g, ' ').trim() : '', dateLimiteJour: lim ? lim.jour : '', dateLimiteIso: lim ? lim.iso : '',
    article: article.slice(0, 160), pdf,
  };
}

// ── 2. « La commande "…" a été remboursée ! » (un de SES achats) ────────────
// Rend { ok: true, transaction, montant (nombre, €), estime ('AAAA-MM-JJ' | ''),
// article } ou { ok: false, raison }. Jamais le moyen de paiement.
export function lireRemboursementAchat({ subject, text } = {}) {
  const sujet = espaces(subject).trim();
  const corps = espaces(text);
  const ms = SUJET_REMBOURSEMENT_ACHAT.exec(sujet);
  if (!ms || !CORPS_ACHAT.test(corps)) return { ok: false, raison: 'pas un remboursement d’achat' };
  const transaction = (/N[°ºo]\s*de transaction\s*:?\s*(\d{6,20})(?!\d)/i.exec(corps) || /Num[ée]ro de transaction\s*:?\s*(\d{6,20})(?!\d)/i.exec(corps) || [])[1] || '';
  if (!transaction) return { ok: false, raison: 'aucun n° de transaction' };
  const mm = /Montant rembours[ée]\s*:?\s*(\d{1,6}(?:[.,]\d{1,2})?)\s*€/i.exec(corps);
  const montant = mm ? Math.round(parseFloat(mm[1].replace(',', '.')) * 100) / 100 : null;
  if (montant == null || !isFinite(montant)) return { ok: false, raison: 'montant remboursé pas lu', transaction };
  // « Remboursement estimé sur <moyen> : JJ/MM/AAAA » — seule la DATE est gardée.
  const de = /Remboursement estim[ée][^\n:]{0,80}:\s*(\d{2})\/(\d{2})\/(\d{4})/i.exec(corps);
  let estime = '';
  if (de) { const v = new Date(Date.UTC(+de[3], +de[2] - 1, +de[1])); if (v.getUTCDate() === +de[1] && v.getUTCMonth() === +de[2] - 1) estime = `${de[3]}-${de[2]}-${de[1]}`; }
  return { ok: true, transaction, montant, estime, article: ms[1].trim().slice(0, 160) };
}
