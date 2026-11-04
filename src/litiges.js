// ═══════════════════════════════════════════════════════════════════════════
// LITIGES, RETOURS ET RÉCLAMATIONS EN COURS — AVEC LEUR DÉLAI (3 novembre)
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « une ligne par litige / retour / réclamation en cours, avec la date
// limite pour répondre et le geste ». Une ligne = une IDENTITÉ (transaction,
// conversation, retour eBay) ; le geste est TOUJOURS un lien vers le site (son
// clic), jamais une action automatique.
//
// Mesuré dans sa base le 3 novembre (lecture seule) :
//   · E-MAILS VINTED, aujourd'hui « aucune règle ne le reconnaît » (gardés
//     entiers dans `email_inconnu_*`, corps `brut`) :
//       – « Action requise : problème avec la commande « <article> » » (5, sept.)
//         au VENDEUR : « L'acheteur a signalé un problème… Nous avons suspendu
//         la commande jusqu'à ce que tu le fasses » — AUCUNE date limite écrite
//         (« sous 5 jours ouvrés » est le délai de l'ACHETEUR pour renvoyer) ;
//       – « L'acheteur souhaite annuler son achat ! » (3, oct.) — accepter ou
//         refuser dans la conversation, AUCUNE date écrite ;
//       – « Retourne ta commande d'ici le 14 oct. : <article> » (3) à l'ACHETEUR
//         (lui, sur un achat) — la date est LUE dans le sujet (jour + mois ;
//         l'année est celle de la réception, ou la suivante si la date tombe
//         avant la réception).
//     L'identité : le lien « Voir le litige » / « Aller sur la conversation »
//     (`links.vinted.com/t/<base64>` → `vinted.fr/inbox/<id>`) — l'id est la
//     conversation de la commande (`conversation_id` de « Mes ventes / Mes
//     achats », `user_msg_thread_id` de la transaction). Mesuré : 5/5 litiges
//     et 3/3 annulations retrouvent leur commande. JAMAIS le titre du sujet
//     (22 % de titres en double) : il n'est qu'un LIBELLÉ quand rien ne relie.
//   · TRANSACTIONS : 440 « Retour initié » (10), 430 « Transaction suspendue »
//     (2) ; aucune ne porte de date limite (champs mesurés : status,
//     status_title, available_actions, suspending_complaint_id, shipment…).
//   · LISTES « Mes ventes / Mes achats » : « Transaction suspendue - en attente
//     de vérification. » (1 achat), « Remboursement effectué » (clos).
//   · eBay : AUCUNE commande eBay en base ⇒ aucun retour eBay jamais observé.
//     La date limite d'un retour (`sellerResponseDue.respondByDate`, Post-Order
//     v2) vient de la DOCUMENTATION d'eBay, pas d'une mesure.
//   · Vestiaire : une vente, état `ACTION_NEEDED` (= à expédier) — aucun litige
//     jamais observé : pas de ligne Vestiaire (on n'invente pas la forme).
//
// Règles (§5) :
//   · la date limite n'est donnée que si elle est LUE (sujet d'e-mail, champ
//     eBay) ; sinon `limite: null` et l'écran dit « délai non lu » ;
//   · « clos » se PROUVE par la commande reliée (finalisée, remboursée,
//     annulée) — jamais par une absence ; une ligne d'e-mail sans commande
//     reliée de plus de LITIGE_EMAIL_MAX_J jours est « ancienne » (repliée,
//     jamais cachée) ;
//   · le N° vient de l'appelant, par identité (`numeroDe(vente)`) ;
//   · trois états : `encours` (ventes pas lues) · `passu` (rien n'a pu être lu)
//     · `lu` (`lignes`, `manques` nomme ce qui n'a pas pu être lu).
// Module PUR (aucune lecture, aucune écriture). Exécuté par
// `scripts/audit-litiges.cjs`.

import { texteDuBrut } from '../api/_lib/achat-arrive-relais.js';

export const LITIGE_EMAIL_MAX_J = 30;
// Une date lue à moins de 48 h : la ligne passe « pressée » (ambre, §7).
export const LITIGE_PRESSE_H = 48;

const str = (v) => String(v == null ? '' : v);
const espaces = (s) => str(s).replace(/[   ]/g, ' ').replace(/\s+/g, ' ').trim();
const TETE = String.raw`^\s*(?:(?:TR|Fwd?|Re)\s*:\s*)*`;

export const SUJET_PROBLEME = new RegExp(TETE + String.raw`Action requise\s*:\s*probl[èe]me avec (?:la|ta) commande\s*[«"“]\s*(.+?)\s*[»"”]\s*$`, 'i');
export const SUJET_ANNULATION = new RegExp(TETE + String.raw`L['’]acheteur souhaite annuler son achat`, 'i');
export const SUJET_RETOUR_ACHAT = new RegExp(TETE + String.raw`Retourne ta commande d['’]ici le\s+(\d{1,2})\s+([a-zéèûô]+)\.?\s*:\s*(.+?)\s*$`, 'i');

// ── Le mois écrit par Vinted (« janv. », « févr. », « juil. », « sept. »…) ──
const sansAccents = (s) => str(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export function moisVinted(m) {
  const s = sansAccents(m).replace(/\./g, '');
  if (!s) return null;
  const T = [['janv', 0], ['jan', 0], ['fevr', 1], ['fev', 1], ['mars', 2], ['avr', 3], ['mai', 4], ['juin', 5], ['juil', 6], ['aout', 7], ['sept', 8], ['sep', 8], ['oct', 9], ['nov', 10], ['dec', 11]];
  for (const [p, n] of T) if (s.startsWith(p)) return n;
  return null;
}

// Le décalage de Paris (en minutes) à une date donnée — sans bibliothèque.
function decalageParis(ms) {
  try {
    const f = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
    const local = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour) % 24, Number(p.minute));
    return Math.round((local - ms) / 60000);
  } catch (_) { return 60; }
}

// « d'ici le 14 oct. », reçu le 7 oct. 2026 ⇒ le 14 oct. 2026 à 23:59:59 (Paris).
// Rend `{ iso, jour }` ou null (jour/mois illisibles, date impossible).
export function limiteDuJour(jour, mois, recuLe) {
  const d = Number(jour), m = moisVinted(mois);
  const r = Date.parse(str(recuLe));
  if (!Number.isInteger(d) || d < 1 || d > 31 || m == null || !isFinite(r)) return null;
  let y = new Date(r).getUTCFullYear();
  const midi = (yy) => Date.UTC(yy, m, d, 12);
  if (new Date(midi(y)).getUTCDate() !== d) return null;            // 31 avril
  if (midi(y) < r - 2 * 86400000) y += 1;                           // décembre → janvier
  const finUtc = Date.UTC(y, m, d, 23, 59, 59);
  const ms = finUtc - decalageParis(midi(y)) * 60000;
  const jourIso = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return { iso: new Date(ms).toISOString(), jour: jourIso };
}

// ── La conversation d'un e-mail Vinted : directe ou dans un lien de suivi ──
const INBOX = /vinted\.[a-z.]{2,8}(?:\/|%2F)inbox(?:\/|%2F)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d{3,20})(?![0-9a-z-])/gi;
const SUIVI = /links\.vinted\.com\/(?:e\/)?t\/([A-Za-z0-9_\-+/]{16,}={0,2})/g;
function base64(b) {
  const n = str(b).replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  const p = n + '='.repeat((4 - (n.length % 4)) % 4);
  try {
    if (typeof atob === 'function') { const bin = atob(p); try { return decodeURIComponent(escape(bin)); } catch (_) { return bin; } }
  } catch (_) { /* tronqué : on essaie sans la fin */ }
  try { if (typeof Buffer !== 'undefined') return Buffer.from(p, 'base64').toString('utf8'); } catch (_) {}
  // Un jeton coupé (corps tronqué) : on décode ce qui tient en blocs entiers.
  try { const q = n.slice(0, n.length - (n.length % 4)); return typeof atob === 'function' ? atob(q) : ''; } catch (_) { return ''; }
}
export function conversationDuCorps(texte) {
  const t = str(texte).replace(/=\r?\n/g, '').replace(/&amp;/g, '&');
  const vus = new Set();
  for (const m of t.matchAll(INBOX)) vus.add(m[1].toLowerCase());
  for (const m of t.matchAll(SUIVI)) { const d = base64(m[1]); for (const k of d.matchAll(INBOX)) vus.add(k[1].toLowerCase()); }
  return vus.size === 1 ? [...vus][0] : '';                        // deux conversations : on ne choisit pas
}

// ── Un e-mail → une ligne brute (ou null si ce n'est pas un litige) ────────
// `row` : { id, subject, receivedAt, brut? } (projection de `email_inconnu_*`
// ou `email_achat_*` ; `brut` peut manquer).
export function litigeDEmail(row) {
  const r = row || {};
  const sujet = espaces(r.subject);
  if (!sujet) return null;
  const recu = str(r.receivedAt);
  const texte = espaces(texteDuBrut(r.brut) || '');
  const conv = conversationDuCorps(texteDuBrut(r.brut) || r.brut || '');
  let m;
  if ((m = SUJET_PROBLEME.exec(sujet))) {
    return { source: 'email', emailId: str(r.id), genre: 'probleme', sens: 'vente', article: m[1].slice(0, 140), qui: '', raison: '', conv, limite: null, recuLe: recu };
  }
  if (SUJET_ANNULATION.test(sujet)) {
    const a = /(\S+)\s+souhaiterait annuler l['’]achat de l['’]article\s+(.+?)\s+pour la raison suivante\s*:\s*["«“]?\s*([^"»”]{0,140}?)\s*["»”]/i.exec(texte)
      || /(\S+)\s+souhaiterait annuler l['’]achat de l['’]article\s+(.+?)(?:\s+pour la raison|\.\s|$)/i.exec(texte);
    return { source: 'email', emailId: str(r.id), genre: 'annulation', sens: 'vente', article: a ? a[2].slice(0, 140) : '', qui: a ? a[1].slice(0, 60) : '', raison: a && a[3] ? a[3].slice(0, 140) : '', conv, limite: null, recuLe: recu };
  }
  if ((m = SUJET_RETOUR_ACHAT.exec(sujet))) {
    const l = limiteDuJour(m[1], m[2], recu);
    return { source: 'email', emailId: str(r.id), genre: 'retour', sens: 'achat', article: m[3].slice(0, 140), qui: '', raison: '', conv, limite: l ? l.iso : null, limiteJour: l ? l.jour : null, recuLe: recu };
  }
  return null;
}

// La requête des e-mails (projection, lecture seule) : ceux gardés entiers ou
// rangés en achat, des 90 derniers jours, aux trois sujets mesurés.
export const MAX_EMAILS_LITIGES = 80;
export const requeteEmailsLitiges = (maintenant = Date.now()) => {
  const depuis = new Date(maintenant - 90 * 86400000).toISOString();
  return 'or=(id.like.email_inconnu_*,id.like.email_achat_*)'
    + `&data->>receivedAt=gte.${encodeURIComponent(depuis)}`
    + '&data->>subject=match.' + encodeURIComponent('(Action requise.{1,4}probl|souhaite annuler son achat|Retourne ta commande)')
    + `&select=id,subject:data->>subject,receivedAt:data->>receivedAt,brut:data->>brut&order=id.asc&limit=${MAX_EMAILS_LITIGES}`;
};

// ── L'état d'une commande Vinted (liste « Mes ventes / Mes achats ») ───────
const RE_CLOS = /finalis|rembours|annul/i;
const RE_RETOUR = /retour\s*initi|retour\s*en\s*cours|retour\s*demand/i;
const RE_SUSPENDUE = /suspendu|litige|r[ée]clamation/i;
const RE_PARTI = /exp[ée]di|achemin|livr|d[ée]pos/i;
export function commandeClose(o) {
  if (!o) return false;
  const tus = str(o.transaction_user_status).toLowerCase();
  return tus === 'completed' || tus === 'failed' || tus === 'canceled' || tus === 'cancelled' || RE_CLOS.test(str(o.status));
}
// Le genre de litige que la commande dit ELLE-MÊME (liste, puis transaction).
export function genreDeCommande(o, etat) {
  if (!o || commandeClose(o)) return null;
  const st = str(o.status);
  if (RE_RETOUR.test(st)) return 'retour';
  if (RE_SUSPENDUE.test(st)) return 'suspendue';
  const s = etat && isFinite(Number(etat.s)) ? Number(etat.s) : null;
  if (s === 440) return 'retour';
  if (s === 430) return 'suspendue';
  return null;
}

// ── Le geste : un lien vers le site, et ses mots ──────────────────────────
export const LIBELLE_GENRE = {
  probleme: 'Litige', annulation: 'Annulation demandée', retour: 'Retour', suspendue: 'Transaction suspendue',
};
export function gesteDe(l) {
  if (l.plateforme === 'ebay') return { libelle: 'Répondre sur eBay', url: l.returnId ? `https://www.ebay.fr/rt/ReturnDetails?returnId=${encodeURIComponent(l.returnId)}` : 'https://www.ebay.fr/mye/myebay/v2/sold' };
  const url = l.conv ? `https://www.vinted.fr/inbox/${encodeURIComponent(l.conv)}` : (l.tx ? `https://www.vinted.fr/member/transactions/${encodeURIComponent(l.tx)}` : '');
  const libelle = l.genre === 'annulation' ? 'Accepter ou refuser sur Vinted'
    : l.genre === 'probleme' ? 'Répondre sur Vinted'
    : l.genre === 'retour' && l.sens === 'achat' ? 'Renvoyer sur Vinted'
    : l.genre === 'retour' ? 'Suivre le retour sur Vinted'
    : 'Voir sur Vinted';
  return { libelle, url: url || 'https://www.vinted.fr/inbox' };
}

// La conversation → LA commande (une seule, sinon personne).
function parConversation(conv, liste) {
  const c = str(conv).toLowerCase();
  if (!c) return null;
  const vus = new Map();
  for (const o of liste || []) if (o && o.conversation_id != null && str(o.conversation_id).toLowerCase() === c) vus.set(str(o.transaction_id), o);
  return vus.size === 1 ? [...vus.values()][0] : null;
}

// ── LA RÈGLE ───────────────────────────────────────────────────────────────
// `ventes`, `achats` : listes Vinted (`undefined` pas encore lu · `null` pas su).
// `emails` : lignes d'e-mail (même convention). `etats(tx)` : l'état de la
// transaction ({ s }) ou null. `numeroDe(o)` : le N° d'une vente par identité.
// `ebay` : retours eBay lus `{ retour, compte, num }` (même convention).
export function litigesEnCours({ ventes, achats, emails, etats, numeroDe, ebay, maintenant } = {}) {
  const now = isFinite(maintenant) ? maintenant : Date.now();
  if (ventes === undefined && achats === undefined && emails === undefined) return { etat: 'encours', lignes: [], manques: [] };
  const manques = [];
  if (ventes === null) manques.push('tes ventes Vinted');
  if (achats === null) manques.push('tes achats Vinted');
  if (emails === null) manques.push('tes e-mails Vinted');
  if (ebay === null) manques.push('tes retours eBay');
  if (ventes === null && achats === null && emails === null) return { etat: 'passu', lignes: [], manques };
  const V = Array.isArray(ventes) ? ventes : [], A = Array.isArray(achats) ? achats : [];
  const parCle = new Map();
  const poser = (l) => {
    const p = parCle.get(l.cle);
    if (!p) { parCle.set(l.cle, l); return; }
    // Une même identité vue deux fois (la commande ET l'e-mail) : une ligne. Le
    // genre de l'e-mail est plus précis (« Litige », « Annulation ») ; une date
    // LUE l'emporte sur aucune ; jamais une date inventée.
    parCle.set(l.cle, { ...p, ...Object.fromEntries(Object.entries(l).filter(([, v]) => v != null && v !== '')), genre: l.source === 'email' ? l.genre : p.genre, limite: p.limite || l.limite || null, limiteJour: p.limiteJour || l.limiteJour || null, source: p.source === l.source ? p.source : 'commande+email', recuLe: [p.recuLe, l.recuLe].filter(Boolean).sort()[0] || null });
  };
  const ligneCommande = (o, sens, genre, extra = {}) => {
    const tx = str(o.transaction_id);
    return { cle: 'v:' + tx, plateforme: 'vinted', sens, genre, tx, conv: str(o.conversation_id), commande: o, titre: str(o.title), compte: o._acc || null,
      num: sens === 'vente' && typeof numeroDe === 'function' ? (numeroDe(o) || null) : null, limite: null, source: 'commande', recuLe: str(o.date) || null, ...extra };
  };
  // 1. Ce que la commande dit d'elle-même.
  for (const o of V) { const g = genreDeCommande(o, etats ? etats(str(o.transaction_id)) : null); if (g && o.transaction_id != null) poser(ligneCommande(o, 'vente', g)); }
  for (const o of A) { const g = genreDeCommande(o, null); if (g && o.transaction_id != null) poser(ligneCommande(o, 'achat', g)); }
  // 2. Les e-mails : reliés par leur conversation, sinon seuls.
  for (const row of (Array.isArray(emails) ? emails : [])) {
    const e = litigeDEmail(row); if (!e) continue;
    const o = e.conv ? (parConversation(e.conv, e.sens === 'vente' ? V : A) || parConversation(e.conv, e.sens === 'vente' ? A : V)) : null;
    if (o) {
      if (commandeClose(o)) continue;                                  // clos : la commande le PROUVE
      // Une annulation demandée sur une vente déjà partie : la question est passée.
      if (e.genre === 'annulation' && RE_PARTI.test(str(o.status))) continue;
      const sens = V.includes(o) ? 'vente' : 'achat';
      poser({ ...ligneCommande(o, sens, e.genre), source: 'email', emailId: e.emailId, qui: e.qui, raison: e.raison, limite: e.limite, limiteJour: e.limiteJour || null, recuLe: e.recuLe || null, article: e.article });
      continue;
    }
    const cle = e.conv ? 'c:' + e.conv : 'e:' + e.emailId;
    const ageJ = (now - (Date.parse(e.recuLe) || now)) / 86400000;
    poser({ cle, plateforme: 'vinted', sens: e.sens, genre: e.genre, tx: '', conv: e.conv, commande: null, titre: e.article, compte: null, num: null,
      limite: e.limite, limiteJour: e.limiteJour || null, source: 'email', emailId: e.emailId, qui: e.qui, raison: e.raison, recuLe: e.recuLe || null, ancien: ageJ > LITIGE_EMAIL_MAX_J });
  }
  // 3. eBay : les retours ouverts (Post-Order), la date de la réponse attendue si eBay la donne.
  for (const x of (Array.isArray(ebay) ? ebay : [])) {
    const r = x && x.retour; if (!r || !r.returnId) continue;
    const e = str(r.etat).toUpperCase();
    if (r.rembourse || /^(CLOSED|RETURN_CLOSED|REFUND_ISSUED|CLOSED_WITH_REFUND)$/.test(e)) continue;
    const lim = r.limite && isFinite(Date.parse(r.limite)) ? new Date(Date.parse(r.limite)).toISOString() : null;
    poser({ cle: 'ebay:' + r.returnId, plateforme: 'ebay', sens: 'vente', genre: 'retour', tx: '', returnId: str(r.returnId), orderId: str(r.orderId), conv: '', commande: null,
      titre: str(r.titre), compte: x.compte || null, num: x.num ? str(x.num) : null, limite: lim, source: 'ebay', qui: str(r.acheteur), raison: str(r.motif), recuLe: r.date || null });
  }
  const lignes = [...parCle.values()].map((l) => {
    const lm = l.limite ? Date.parse(l.limite) : NaN;
    // Une date LUE passée depuis plus d'un jour : l'échéance est derrière (Vinted
    // a tranché) — repliée, jamais cachée.
    const depassee = isFinite(lm) && now - lm > 86400000;
    const presse = isFinite(lm) && !depassee && lm - now < LITIGE_PRESSE_H * 3600000;
    return { ...l, ancien: !!l.ancien || depassee, depassee, presse, geste: gesteDe(l) };
  });
  const rang = (l) => (l.ancien ? 1e15 : 0) + (isFinite(Date.parse(l.limite)) ? Date.parse(l.limite) : 1e14 + (now - (Date.parse(l.recuLe) || 0)));
  lignes.sort((a, b) => rang(a) - rang(b));
  return { etat: 'lu', lignes, manques };
}

// Les lignes d'une vente (son tiroir) : par sa transaction ou sa conversation.
export function litigeDeVente(res, o) {
  if (!res || res.etat !== 'lu' || !o) return null;
  const tx = str(o.transaction_id), conv = str(o.conversation_id).toLowerCase();
  return res.lignes.find((l) => (tx && l.tx === tx) || (conv && l.conv && l.conv.toLowerCase() === conv)) || null;
}

// La date limite écrite comme l'écran la dit : « 14 nov. » ; null ⇒ « délai non lu ».
export function texteLimite(l) {
  const ms = l && l.limite ? Date.parse(l.limite) : NaN;
  if (!isFinite(ms)) return null;
  try { return new Date(ms).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'Europe/Paris' }); } catch (_) { return null; }
}
