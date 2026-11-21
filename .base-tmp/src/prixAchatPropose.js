// ═══════════════════════════════════════════════════════════════════════════
// LE PRIX D'ACHAT PROPOSÉ — en un geste, jamais écrit sans son tap (3 novembre)
// ═══════════════════════════════════════════════════════════════════════════
// Julien (3 nov., 13 h 02) : quand un article (N°) est relié PAR IDENTITÉ à un
// achat et que son prix d'achat est vide, VRM PROPOSE le montant réellement payé
// (« Utiliser 42,90 € ») ; rien n'est écrit sans son tap.
//
// §2.5 « il saisit les prix d'achat lui-même » : la proposition est une valeur
// LUE (le reçu Vinted, sinon le prix de l'achat capté), affichée avec son détail
// sur UNE ligne ; c'est SON tap qui l'écrit. §5 « l'identité d'une paire » :
//   1. `buyFromId` — l'achat qu'IL a relié (n° de transaction de l'achat) ;
//   2. la PHOTO, fichier exact (`photoKey`, jamais le dossier seul) : un achat
//      dont l'image est CELLE de l'article (Vinted « revendre » réutilise le
//      fichier). Deux achats au même fichier ⇒ rien (ambigu) ; l'achat de la
//      même transaction que la vente (vente d'un de ses comptes à un autre) ⇒
//      rien ; un achat remboursé, annulé, échoué ⇒ rien (il n'a rien coûté) ;
//      un achat postérieur à la vente ⇒ rien.
// JAMAIS le titre, la marque, la taille, la date seule : 50 articles au même
// titre ne reçoivent aucune proposition, sauf celui qu'une identité désigne
// (`scripts/audit-prix-achat-propose.cjs`).
//
// LE MONTANT : le reçu de l'achat (relié par SON n° de transaction,
// `api/_lib/recu-achat.js`), quand sa ventilation tombe juste au centime
// (« Montant payé » = Article + Frais de port + Frais Vinted − Réduction) :
// c'est ce qu'il a vraiment payé, détail sur une ligne. Sans reçu juste : le
// prix de l'article capté, dit « Article seul ». Autre devise ⇒ rien.
//
// MESURÉ (lecture seule, sa base, 3 nov.) : voir l'historique compta.
// ─────────────────────────────────────────────────────────────────────────────

// Un achat qui n'a rien coûté (remboursé, annulé, échoué, refusé, retour).
export const ACHAT_SANS_COUT = /annul|cancel|refus|rembours|retour|suspend|[ée]chou|failed/i;

const euros = (c) => {
  const n = Math.abs(c);
  const e = String(Math.floor(n / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return (c < 0 ? '−' : '') + e + ',' + String(n % 100).padStart(2, '0') + '\u00a0€';
};
export const texteCentimes = (c) => (Number.isSafeInteger(c) ? euros(c) : '');

const centimesDe = (v) => {
  if (v == null) return null;
  const t = String(v).replace(/\s|€/g, '').replace(',', '.');
  if (!/^-?\d+(\.\d{1,2})?$/.test(t)) return null;
  const c = Math.round(Number(t) * 100);
  return Number.isSafeInteger(c) ? c : null;
};

const txDe = (a) => {
  const t = String(a && a.transaction_id != null ? a.transaction_id : '').trim();
  return /^\d{6,}$/.test(t) ? t : '';
};
const dateDe = (v) => { const t = Date.parse(v || ''); return Number.isFinite(t) ? t : null; };

// L'achat qu'une IDENTITÉ désigne pour cet article, ou null.
//   lie        : l'achat relié par SON clic (`achatRelie(e)` : vivant ou instantané)
//   photo      : la clé photo exacte de l'article (fiche ou vente)
//   venteTx    : le n° de transaction de la vente (exclu des achats)
//   venteDate  : la date de la vente (un achat postérieur est écarté)
//   achats     : les achats captés (tableau) ; absent ⇒ seule la voie `lie`
//   cleDePhoto : (achat) → clé photo exacte de l'achat
//   pris       : Set des n° d'achats déjà reliés à un AUTRE article
export function achatParIdentite({ lie = null, photo = null, venteTx = '', venteDate = null, achats = null, cleDePhoto = null, pris = null } = {}) {
  if (lie && txDe(lie)) return { achat: lie, par: 'lien' };
  if (!photo || !Array.isArray(achats) || typeof cleDePhoto !== 'function') return null;
  const vtx = String(venteTx || '');
  const tv = dateDe(venteDate);
  const memes = [];
  for (const a of achats) {
    if (!a) continue;
    const k = cleDePhoto(a);
    if (!k || k !== photo) continue;
    memes.push(a);
  }
  // L'identité exige UN seul achat à ce fichier (tous états confondus : deux
  // achats de la même image ne disent pas lequel est celui-ci).
  const candidats = memes.filter((a) => txDe(a) && txDe(a) !== vtx);
  if (candidats.length !== 1) return null;
  const a = candidats[0];
  if (ACHAT_SANS_COUT.test(String(a.status || ''))) return null;
  if (pris && pris.has(txDe(a))) return null;
  const ta = dateDe(a.date);
  if (tv != null && ta != null && ta > tv) return null;
  return { achat: a, par: 'photo' };
}

// Le montant à proposer pour cet achat : le reçu juste, sinon l'article seul.
//   ventilation : `ventilationRecuAchat(recu.texte)` (ou null : pas de reçu)
export function montantPropose(achat, ventilation) {
  if (!achat) return null;
  const devise = String((achat.price && achat.price.currency_code) || 'EUR').toUpperCase();
  if (devise !== 'EUR') return null;
  const v = ventilation;
  if (v && v.trouve && v.somme === 'juste' && Number.isSafeInteger(v.paye) && v.paye > 0) {
    const detail = v.lignes.map((l) => `${l.libelle} ${texteCentimes(l.centimes)}`).join(' · ');
    return { centimes: v.paye, source: 'recu', detail };
  }
  const c = centimesDe(achat.price && achat.price.amount);
  if (c == null || c <= 0) return null;
  return { centimes: c, source: 'achat', detail: 'Article seul' };
}

// LA proposition pour un article, ou null.
//   prixConnu : vrai si un prix d'achat est déjà saisi (rien à proposer)
//   annulee   : la vente est annulée (aucun coût à poser)
//   estLot    : (achat) → vrai pour un LOT (src/achatsSourcing.js `estLot`) ; défaut :
//               le titre « Lot … » ou l'instantané d'un article de lot (`lot`).
// (4 nov.) Un LOT ne propose JAMAIS son prix entier à un de ses articles : le prix
// de chaque N° se pose par « Répartir » (src/achatsSourcing.js), sur SON clic.
export function propositionPrixAchat({ prixConnu = false, annulee = false, identite = null, ventilationDe = null, estLot = null } = {}) {
  if (prixConnu || annulee || !identite || !identite.achat) return null;
  const a = identite.achat;
  if (typeof estLot === 'function' ? estLot(a) : (/^lot\b/i.test(String(a.title || '').trim()) || a.lot === true)) return null;
  const tx = txDe(a);
  const m = montantPropose(a, tx && typeof ventilationDe === 'function' ? ventilationDe(tx) : null);
  if (!m) return null;
  return { ...m, texte: texteCentimes(m.centimes), valeur: (m.centimes / 100).toFixed(2).replace('.', ','), tx, par: identite.par, achat: a };
}

// Un achat ne se propose qu'à UN article : la première ligne (dans l'ordre de
// la liste) le garde, les suivantes n'ont rien. Rend une Map cle → proposition.
export function propositionsUniques(lignes) {
  const out = new Map(); const vus = new Set();
  for (const { cle, proposition } of (lignes || [])) {
    if (!proposition || !proposition.tx || vus.has(proposition.tx)) continue;
    vus.add(proposition.tx); out.set(cle, proposition);
  }
  return out;
}

// Ce que la confirmation groupée liste : une ligne par article (N° + montant).
export function listeConfirmation(propositions, numeroDe) {
  const out = [];
  for (const [cle, p] of propositions) out.push({ cle, numero: (numeroDe && numeroDe(cle)) || '', texte: p.texte, centimes: p.centimes });
  return out;
}

// L'écriture d'une proposition acceptée : le prix, ET le lien vers l'achat qui
// l'a donné (comme « Relier un achat », §11 — `buyFrom` garde l'instantané).
export function ecritureProposition(p, { accNom = '', photoDe = null } = {}) {
  const a = p.achat || {};
  return {
    buyPrice: p.valeur,
    buyFromId: p.tx,
    buyFrom: {
      title: a.title || '', date: a.date || '', photo: (photoDe && photoDe(a)) || '',
      price: p.centimes / 100, devise: 'EUR', seller: a.seller || a.user_login || '',
      status: a.status || '', account: accNom || '', recu: p.source === 'recu',
    },
  };
}

// (9 nov.) Ce que la saisie en série DIT d'une proposition : « Payé sur Vinted :
// 85,40 € » quand le reçu tombe juste (article + port + frais Vinted, chacun tel
// que Vinted l'écrit) ; « Article seul sur Vinted : 80,00 € » sinon (le port et
// les frais ne sont pas lus : ce n'est PAS ce qu'il a payé, et c'est dit). Les
// gestes : « Garder » (SON tap écrit ce montant) et « Corriger » (le champ, vide :
// il tape le sien). Rien n'est écrit par ce texte.
export function texteProposition(p) {
  if (!p || !Number.isSafeInteger(p.centimes)) return null;
  const recu = p.source === 'recu';
  return {
    libelle: recu ? 'Payé sur Vinted' : 'Article seul sur Vinted',
    montant: texteCentimes(p.centimes),
    detail: recu ? (p.detail || '') : 'sans le port ni les frais Vinted (reçu pas lu)',
    garder: 'Garder', corriger: 'Corriger',
  };
}
