// ═══════════════════════════════════════════════════════════════════════════
// LE PROGRAMME PARTENAIRE — LA RÈGLE (15 nov., décision de Julien)
// ═══════════════════════════════════════════════════════════════════════════
// « Un ami influenceur fera la promotion de VRM : 3 € par mois et par client
//   payant, à vie (tant que le client paie), quel que soit l'abonnement. »
//
// Ce fichier ne lit RIEN et n'écrit RIEN : des fonctions pures, que le webhook
// Stripe, la route d'administration et la page du partenaire appellent toutes
// (une seule règle, un seul propriétaire). Les lectures et écritures vivent dans
// api/_lib/partenaires.js ; les tables dans supabase/migrations/043-partenaires.sql.
//
// LA COMMISSION :
//   · 3,00 € (300 centimes), Solo comme Pro (le montant ne dépend JAMAIS du prix) ;
//   · seulement sur une facture d'abonnement PAYÉE pour de vrai : statut « paid »,
//     `amount_paid` > 0, en euros, motif `subscription_create` ou
//     `subscription_cycle` (jamais la facture à 0 € de l'essai, jamais une facture
//     de régularisation `subscription_update`, jamais une facture manuelle) ;
//   · une facture = une commission au plus (clé : l'identifiant de la facture) —
//     un webhook rejoué ne crée rien de plus ;
//   · un client = une commission par MOIS au plus (mois de Paris du paiement) ;
//   · datée du PAIEMENT ; DUE 14 jours après (le délai de rétractation) ;
//   · rien avant le rattachement (rien de rétroactif) ;
//   · litige, ou remboursement / avoir de TOUTE la facture ⇒ la commission est
//     ANNULÉE (gardée, marquée, dite — jamais effacée) ;
//   · (16 nov., lot compta-donnees) remboursement / avoir PARTIEL ⇒ la commission
//     est RÉDUITE au prorata de ce qui reste payé : 3 € × (payé − remboursé) / payé,
//     arrondi au centime INFÉRIEUR (jamais plus que ce que le client a payé) —
//     1 € rendu sur 16,99 € ⇒ 2,82 €. Un montant de remboursement pas lu ⇒
//     annulée (pas su ne vaut pas « partiel »). `commissionNette` est la seule règle ;
//   · client parti ⇒ plus aucune facture, donc plus aucune commission ; ce qui
//     est déjà gagné reste (rien de rétroactif dans l'autre sens non plus) ;
//   · partenaire en pause : son code n'attache plus personne ; les clients déjà
//     venus par lui comptent toujours (« à vie »).
// VRM NE VERSE RIEN : « Versé » est noté sur le clic de Julien (date, montant).
// Ce qui sort vers le partenaire : des NOMBRES, jamais un nom, un e-mail, un pseudo.
// ═══════════════════════════════════════════════════════════════════════════

export const COMMISSION_CENTIMES = 300;
export const DELAI_DUE_JOURS = 14;
export const MOTIFS_ABONNEMENT = ['subscription_create', 'subscription_cycle'];
export const RAISONS_ANNULATION = ['remboursement', 'litige', 'avoir'];
export const CODE_PARTENAIRE_RE = /^[A-Z0-9]{3,16}$/;
// Ne pas confondre avec un code de parrainage (8 signes de l'alphabet du parrainage) :
// les deux vivent sur des liens différents (`/r/` et `/p/`), la forme seule ne tranche pas.
export const codePartenaire = (brut) => {
  const c = String(brut == null ? '' : brut).normalize('NFKD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();
  return CODE_PARTENAIRE_RE.test(c) ? c : '';
};
export const RE_MOIS = /^\d{4}-(0[1-9]|1[0-2])$/;

// Le mois (AAAA-MM) d'un instant, à l'heure de Paris.
export function moisParis(ms) {
  if (!Number.isFinite(ms)) return '';
  const p = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit' }).formatToParts(new Date(ms));
  const y = (p.find((x) => x.type === 'year') || {}).value, m = (p.find((x) => x.type === 'month') || {}).value;
  return y && m ? `${y}-${m}` : '';
}

// L'abonnement d'une facture — avant l'API « basil » sur la facture, depuis dans `parent`.
export function abonnementDeFacture(f) {
  if (!f || typeof f !== 'object') return '';
  const brut = f.subscription || (f.parent && f.parent.subscription_details && f.parent.subscription_details.subscription) || '';
  const id = typeof brut === 'string' ? brut : (brut && brut.id) || '';
  return /^sub_[A-Za-z0-9]+$/.test(id) ? id : '';
}
// L'instant du paiement (ms) : `status_transitions.paid_at`, sinon la création.
export function datePaiement(f) {
  const t = Number(f && f.status_transitions && f.status_transitions.paid_at) || Number(f && f.created) || 0;
  return t > 0 ? t * 1000 : NaN;
}
// Les identifiants du paiement (pour retrouver la facture d'un remboursement ou d'un litige) :
// anciens champs, puis `payments.data[].payment` (API « basil » et suivantes).
export function paiementsDeFacture(f) {
  const out = { charge: null, payment_intent: null };
  if (!f || typeof f !== 'object') return out;
  const id = (v) => (typeof v === 'string' ? v : (v && v.id) || '');
  const ch = id(f.charge), pi = id(f.payment_intent);
  if (/^(ch|py)_/.test(ch)) out.charge = ch;
  if (/^pi_/.test(pi)) out.payment_intent = pi;
  const liste = f.payments && Array.isArray(f.payments.data) ? f.payments.data : [];
  for (const p of liste) {
    const pay = (p && p.payment) || {};
    const c = id(pay.charge), q = id(pay.payment_intent);
    if (!out.charge && /^(ch|py)_/.test(c)) out.charge = c;
    if (!out.payment_intent && /^pi_/.test(q)) out.payment_intent = q;
  }
  return out;
}

// La facture ouvre-t-elle droit à une commission ? { ok, raison }.
export function factureReelle(f) {
  if (!f || typeof f !== 'object' || !/^in_[A-Za-z0-9]+$/.test(String(f.id || ''))) return { ok: false, raison: 'forme' };
  if (String(f.status || '') !== 'paid') return { ok: false, raison: 'pas-payee' };
  const paye = Number(f.amount_paid);
  if (!Number.isInteger(paye) || paye <= 0) return { ok: false, raison: 'zero' };
  if (String(f.currency || '').toLowerCase() !== 'eur') return { ok: false, raison: 'devise' };
  if (!abonnementDeFacture(f)) return { ok: false, raison: 'hors-abonnement' };
  if (!MOTIFS_ABONNEMENT.includes(String(f.billing_reason || ''))) return { ok: false, raison: 'motif' };
  if (!Number.isFinite(datePaiement(f))) return { ok: false, raison: 'date' };
  return { ok: true };
}

// LA DÉCISION. Entrées :
//   facture        l'objet `invoice` de Stripe (webhook `invoice.paid`) ;
//   rattachement   { filleul, partenaire, inscrit } ou null ;
//   partenaire     { id } ou null (le partenaire du rattachement) ;
//   existantes     les commissions DÉJÀ rangées de ce filleul : [{ facture, mois, annulee_le }] ;
//   annulee        une annulation déjà reçue pour cette facture ou son paiement (raison) ou null.
// Rend { creer: ligne } ou { rien: raison }.
export function decisionCommission({ facture, rattachement, partenaire, existantes = [], annulee = null, signaux = [] }) {
  const r = factureReelle(facture);
  if (!r.ok) return { rien: r.raison };
  if (!rattachement || !rattachement.filleul) return { rien: 'pas-rattache' };
  if (!partenaire || !partenaire.id || String(partenaire.id) !== String(rattachement.partenaire)) return { rien: 'partenaire-inconnu' };
  const paye = datePaiement(facture);
  const inscrit = Date.parse(rattachement.inscrit || '');
  if (!Number.isFinite(inscrit) || paye < inscrit) return { rien: 'avant-rattachement' };
  if (existantes.some((c) => c && c.facture === facture.id)) return { rien: 'deja' };
  const mois = moisParis(paye);
  if (existantes.some((c) => c && c.mois === mois && !c.annulee_le)) return { rien: 'mois-deja' };
  const p = paiementsDeFacture(facture);
  const ligne = {
    facture: facture.id,
    partenaire: rattachement.partenaire,
    filleul: rattachement.filleul,
    montant_centimes: COMMISSION_CENTIMES,
    facture_centimes: Number(facture.amount_paid),
    paye_le: new Date(paye).toISOString(),
    mois,
    due_le: new Date(paye + DELAI_DUE_JOURS * 86400000).toISOString(),
    charge: p.charge, payment_intent: p.payment_intent,
    annulee_le: null, annulee_raison: null, rembourse_centimes: 0,
  };
  // (16 nov.) Ce qui est arrivé AVANT la facture payée (désordre) : `signaux` (lignes de
  // `partenaire_annulations`) ; `annulee` (une annulation sans montant) vaut « toute ».
  const tous = [...(annulee && RAISONS_ANNULATION.includes(annulee.raison) ? [{ raison: annulee.raison, signal: annulee.signal || 'total', centimes: annulee.centimes == null ? null : annulee.centimes, le: annulee.le }] : []), ...(Array.isArray(signaux) ? signaux : [])];
  const rb = remboursementDe(tous, ligne.facture_centimes);
  if (rb.total) { ligne.annulee_le = rb.le || new Date(paye).toISOString(); ligne.annulee_raison = rb.raison; }
  else if (rb.centimes > 0) ligne.rembourse_centimes = rb.centimes;
  return { creer: ligne };
}

// Un événement Stripe d'annulation ⇒ { raison, signal, centimes, cles: { facture, charge, payment_intent } } ou null.
//   charge.refunded / refund.created / charge.refund.updated ⇒ remboursement ;
//   charge.dispute.created ⇒ litige ; credit_note.created ⇒ avoir.
// (16 nov.) `signal` nomme CE geste de Stripe (un remboursement « re_… », un avoir « cn_… »,
// le cumul d'un paiement « cumul:N », un litige « litige ») : le même rejoué ne compte qu'une
// fois ; `centimes` = son montant (null = pas lu ⇒ toute la facture).
export function annulationDeLEvenement(type, obj) {
  if (!obj || typeof obj !== 'object') return null;
  const id = (v) => (typeof v === 'string' ? v : (v && v.id) || '');
  let raison = null;
  if (type === 'charge.refunded') { if (!(Number(obj.amount_refunded) > 0)) return null; raison = 'remboursement'; }
  else if (type === 'refund.created' || type === 'charge.refund.updated') { if (String(obj.status || '') === 'failed' || String(obj.status || '') === 'canceled') return null; raison = 'remboursement'; }
  else if (type === 'charge.dispute.created') raison = 'litige';
  else if (type === 'credit_note.created') { if (!(Number(obj.amount) > 0) || String(obj.status || '') === 'void') return null; raison = 'avoir'; }
  else return null;
  const cles = { facture: null, charge: null, payment_intent: null };
  const f = id(obj.invoice);
  if (/^in_/.test(f)) cles.facture = f;
  const ch = type === 'charge.refunded' ? id(obj.id) : id(obj.charge);
  if (/^(ch|py)_/.test(ch)) cles.charge = ch;
  const pi = id(obj.payment_intent);
  if (/^pi_/.test(pi)) cles.payment_intent = pi;
  if (!cles.facture && !cles.charge && !cles.payment_intent) return null;
  const n = (v) => (Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : null);
  let signal = 'total', centimes = null;
  if (type === 'charge.refunded') { centimes = n(obj.amount_refunded); signal = centimes ? 'cumul:' + centimes : 'total'; }
  else if (type === 'refund.created' || type === 'charge.refund.updated') { const rid = id(obj.id); centimes = n(obj.amount); signal = /^(re|pyr)_[A-Za-z0-9]+$/.test(rid) && centimes ? rid : 'total'; if (signal === 'total') centimes = null; }
  else if (type === 'credit_note.created') { const cid = id(obj.id); centimes = n(obj.amount); signal = /^cn_[A-Za-z0-9]+$/.test(cid) && centimes ? cid : 'total'; if (signal === 'total') centimes = null; }
  else signal = 'litige';
  return { raison, signal, centimes, cles };
}

// (16 nov.) CE QUI A ÉTÉ RENDU sur une facture, d'après tous les signaux reçus pour elle
// (facture, paiement). Rend { total, raison, centimes, le } :
//   · un litige, ou un signal au montant pas lu ⇒ total (la commission est annulée) ;
//   · sinon : le plus grand de (cumul du paiement, Σ des remboursements distincts, Σ des
//     avoirs distincts) — un avoir qui rembourse donne aussi un remboursement : on ne les
//     additionne pas entre familles (jamais deux fois le même euro) ;
//   · rendu ≥ payé ⇒ total.
export function remboursementDe(signaux, factureCentimes) {
  const liste = (Array.isArray(signaux) ? signaux : []).filter((x) => x && RAISONS_ANNULATION.includes(x.raison));
  if (!liste.length) return { total: false, raison: null, centimes: 0, le: null };
  const plusTot = (xs) => xs.map((x) => x.le).filter(Boolean).sort()[0] || null;
  const tot = liste.filter((x) => x.raison === 'litige' || x.signal === 'total' || x.signal === 'litige' || !(Number(x.centimes) > 0));
  if (tot.length) { const l = tot.find((x) => x.raison === 'litige') || tot[0]; return { total: true, raison: l.raison, centimes: null, le: plusTot(tot) }; }
  const vus = new Set(); let cumul = 0, re = 0, cn = 0;
  for (const x of liste) {
    const sig = String(x.signal || ''), c = Number(x.centimes);
    if (sig.startsWith('cumul:')) { cumul = Math.max(cumul, c); continue; }
    if (vus.has(sig)) continue; vus.add(sig);
    if (sig.startsWith('cn_')) cn += c; else re += c;
  }
  const r = Math.max(cumul, re, cn);
  const raison = cn > Math.max(cumul, re) ? 'avoir' : 'remboursement';
  const f = Number(factureCentimes);
  if (!(f > 0) || r >= f) return { total: true, raison, centimes: r, le: plusTot(liste) };
  return { total: false, raison, centimes: r, le: plusTot(liste) };
}

// (16 nov.) LA COMMISSION QUI COMPTE : 0 si annulée ; réduite au prorata d'un remboursement
// partiel, arrondie au centime inférieur ; sinon le montant rangé (3,00 €).
export function commissionNette(c) {
  if (!c || c.annulee_le) return 0;
  const m = Number(c.montant_centimes) || 0, f = Number(c.facture_centimes), r = Number(c.rembourse_centimes) || 0;
  if (!(r > 0)) return m;
  if (!(f > 0) || r >= f) return 0;
  return Math.floor((m * (f - r)) / f);
}

// L'état d'une commission à un instant : 'annulee' · 'attente' (pas encore due) · 'due'.
export function etatCommission(c, maintenant = Date.now()) {
  if (!c) return null;
  if (c.annulee_le) return 'annulee';
  const due = Date.parse(c.due_le || '');
  return Number.isFinite(due) && due <= maintenant ? 'due' : 'attente';
}

// ── LES CHIFFRES (des nombres, jamais qui) ──────────────────────────────────
// commissions [{ filleul, mois, montant_centimes, due_le, annulee_le }]
// versements  [{ mois, montant_centimes, verse_le }]
// inscrits    nombre de comptes rattachés au code
// actifs      Set des filleuls dont l'abonnement est vivant (actif ou impayé en cours)
//             — `null` = pas su (le chiffre dit « — »).
// Par mois : commissions dues, en attente (< 14 j), annulées, versé, reste à verser.
// `reste` = dû − versé (peut être négatif : une commission annulée après versement
// est à reprendre — dit, jamais caché).
export function chiffresPartenaire({ commissions = [], versements = [], inscrits = 0, actifs = null, maintenant = Date.now() }) {
  const mois = new Map();
  const m = (k) => { if (!mois.has(k)) mois.set(k, { mois: k, clients: new Set(), nDues: 0, nAttente: 0, nAnnulees: 0, nReduites: 0, dueCentimes: 0, attenteCentimes: 0, verseCentimes: 0, versements: [] }); return mois.get(k); };
  const payeurs = new Set();
  for (const c of commissions) {
    if (!c || !RE_MOIS.test(String(c.mois || ''))) continue;
    const x = m(c.mois), e = etatCommission(c, maintenant), v = commissionNette(c);
    if (e === 'annulee') { x.nAnnulees++; continue; }
    if (Number(c.rembourse_centimes) > 0) x.nReduites++;
    if (c.filleul) { x.clients.add(String(c.filleul)); payeurs.add(String(c.filleul)); }
    if (e === 'due') { x.nDues++; x.dueCentimes += v; } else { x.nAttente++; x.attenteCentimes += v; }
  }
  for (const v of versements) {
    if (!v || !RE_MOIS.test(String(v.mois || ''))) continue;
    const x = m(v.mois); const n = Number(v.montant_centimes) || 0;
    x.verseCentimes += n; x.versements.push({ le: String(v.verse_le || '').slice(0, 10), centimes: n });
  }
  const liste = [...mois.values()].sort((a, b) => b.mois.localeCompare(a.mois)).map((x) => ({
    mois: x.mois, clientsPayants: x.clients.size, nDues: x.nDues, nAttente: x.nAttente, nAnnulees: x.nAnnulees, nReduites: x.nReduites,
    dueCentimes: x.dueCentimes, attenteCentimes: x.attenteCentimes, verseCentimes: x.verseCentimes,
    resteCentimes: x.dueCentimes - x.verseCentimes, versements: x.versements,
  }));
  const somme = (k) => liste.reduce((s, x) => s + x[k], 0);
  const payantsActifs = actifs instanceof Set ? [...payeurs].filter((f) => actifs.has(f)).length : null;
  // La ligne de Julien : le mois le plus ANCIEN dont il reste quelque chose à verser.
  const aVerser = liste.filter((x) => x.resteCentimes > 0).sort((a, b) => a.mois.localeCompare(b.mois));
  return {
    inscrits: Number(inscrits) || 0, payantsActifs, clientsAyantPaye: payeurs.size,
    mois: liste,
    totaux: { dueCentimes: somme('dueCentimes'), attenteCentimes: somme('attenteCentimes'), verseCentimes: somme('verseCentimes'), resteCentimes: somme('resteCentimes') },
    prochainVersement: aVerser[0] ? { mois: aVerser[0].mois, centimes: aVerser[0].resteCentimes, clients: aVerser[0].clientsPayants } : null,
  };
}

// L'export pour la compta : une ligne par commission (client ANONYME : « Client 3 »,
// rang dans l'ordre du premier paiement) puis une par versement. Séparateur « ; »
// (Excel en français), montants « 3,00 ».
const euros = (c) => (Number(c) / 100).toFixed(2).replace('.', ',');
const champ = (v) => { const t = String(v == null ? '' : v); return /[;"\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
export function csvPartenaire({ partenaire, commissions = [], versements = [], maintenant = Date.now() }) {
  const rang = new Map();
  [...commissions].sort((a, b) => String(a.paye_le).localeCompare(String(b.paye_le))).forEach((c) => { if (c.filleul && !rang.has(String(c.filleul))) rang.set(String(c.filleul), rang.size + 1); });
  const lignes = [['type', 'partenaire', 'code', 'mois', 'date', 'due_le', 'client', 'montant_eur', 'etat', 'raison'].join(';')];
  const nom = partenaire ? partenaire.nom : '', code = partenaire ? partenaire.code : '';
  for (const c of [...commissions].sort((a, b) => String(a.paye_le).localeCompare(String(b.paye_le)))) {
    lignes.push(['commission', nom, code, c.mois, String(c.paye_le || '').slice(0, 10), String(c.due_le || '').slice(0, 10),
      c.filleul ? 'Client ' + rang.get(String(c.filleul)) : 'Client (compte supprimé)', euros(commissionNette(c)), etatCommission(c, maintenant), c.annulee_raison || (Number(c.rembourse_centimes) > 0 ? `remboursement partiel ${euros(c.rembourse_centimes)}` : '')].map(champ).join(';'));
  }
  for (const v of [...versements].sort((a, b) => String(a.verse_le).localeCompare(String(b.verse_le)))) {
    lignes.push(['versement', nom, code, v.mois, String(v.verse_le || '').slice(0, 10), '', '', euros(v.montant_centimes), 'verse', ''].map(champ).join(';'));
  }
  return '﻿' + lignes.join('\r\n') + '\r\n';
}
