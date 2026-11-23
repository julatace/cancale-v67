// ════════════════════════════════════════════════════════════════════════════
//  UN ACHAT REMBOURSÉ NE COÛTE RIEN — LA SEULE RÈGLE DU COÛT NET D'UN ACHAT (21 nov. 2026, lot relier-retires)
// ════════════════════════════════════════════════════════════════════════════
// Julien (21 nov.) : « Ne compte pas dans les dépenses quand je suis remboursé. »
//
// Le propriétaire du coût d'un achat est la liste `buysBase` de l'écran Achats (src/App.jsx) : « Dépensé » (le mois, la
// case), le registre des achats (src/registres.js), les achats jour par jour publiés (`vrm_achats_jours` : groupes
// d'accompagnement) la lisent, et `achatAnnule` (statut « annulé / remboursé / refusé ») les sort. Avant ce lot :
//   · un remboursement prouvé par e-mail (`email_rembachat_{tx}`, même n°) d'au moins ce qu'il a payé sortait l'achat
//     (src/retoursAchat.js `avecRemboursementsProuves`) — un remboursement PARTIEL ne changeait rien (tout restait compté) ;
//   · une transaction que Vinted dit ANNULÉE (détail lu, code ≥ 500) alors que la liste des achats ne l'a pas encore vu
//     restait comptée ;
//   · un colis NON RÉCLAMÉ revenu à l'expéditeur, un retour ouvert : comptés sans rien dire.
// MESURÉ en lecture seule sur sa base (récit : docs/passation/2026-11-21-relier-retires.md).
//
// LA RÈGLE (par SON n° de transaction, jamais par titre — §5) :
//   · statut Vinted « annulé / remboursé / refusé » ⇒ REMBOURSÉ (0 compté) ;
//   · le détail de la transaction dit ANNULÉE (500, 510, 520) ⇒ REMBOURSÉ (Vinted rembourse une commande annulée) ;
//   · remboursement lu par e-mail ≥ ce qu'il a payé ⇒ REMBOURSÉ ; MOINS ⇒ PARTIEL : seul le RESTE compte ;
//   · non réclamé / retour initié / transaction suspendue, sans remboursement lu ⇒ « REMBOURSEMENT EN ATTENTE » : le coût
//     COMPTE encore (pas su ≠ remboursé), et c'est DIT à côté du chiffre ;
//   · prix payé pas lu ⇒ le reste n'est pas su (null), jamais 0.
// Module PUR, exécuté par scripts/audit-relier-retires.cjs (avec mutations).

const str = (v) => String(v == null ? '' : v);
const RE_SANS_COUT = /annul|rembours|refus/i;       // la règle de « Dépensé » (src/registres.js `achatAnnule`)
const RE_NON_RECLAME = /non\s+r[ée]clam/i;
const arrondi = (x) => Math.round(x * 100) / 100;

// o : l'achat lu ; remb : Map tx → { montant, at } (`remboursementsParTx`) — null/undefined pas su ;
// txn : (tx) → { s, ss } (l'état lu de la transaction) ou null ; paye : ce qu'il a payé (€) ou null.
// Rend { etat: 'aucun' | 'rembourse' | 'partiel' | 'attente', montant (€ remboursé lu, ou null), reste (€ qui compte, ou null), raison }.
export function remboursementAchat(o, { remb = null, txn = null, paye = null } = {}) {
  const tx = o && o.transaction_id != null ? str(o.transaction_id).trim() : '';
  const p = paye != null && Number.isFinite(Number(paye)) ? Number(paye) : null;
  if (!o) return { etat: 'aucun', montant: null, reste: p, raison: '' };
  if (RE_SANS_COUT.test(str(o.status))) return { etat: 'rembourse', montant: p, reste: 0, raison: /rembours/i.test(str(o.status)) ? 'statut' : 'annule' };
  const e = tx && typeof txn === 'function' ? (() => { try { return txn(tx); } catch (_) { return null; } })() : null;
  if (e && Number(e.s) >= 500) return { etat: 'rembourse', montant: p, reste: 0, raison: 'annule' };
  const r = tx && remb instanceof Map ? remb.get(tx) : null;
  const m = r && r.montant != null && Number.isFinite(Number(r.montant)) ? Number(r.montant) : null;
  if (m != null && m > 0) {
    if (p == null) return { etat: 'rembourse', montant: m, reste: 0, raison: 'email' };   // la preuve du remboursement suffit
    if (m + 0.005 >= p) return { etat: 'rembourse', montant: m, reste: 0, raison: 'email' };
    return { etat: 'partiel', montant: m, reste: arrondi(p - m), raison: 'email' };
  }
  if (e && (RE_NON_RECLAME.test(str(e.ss)) || Number(e.s) === 440 || Number(e.s) === 430)) {
    return { etat: 'attente', montant: null, reste: p, raison: RE_NON_RECLAME.test(str(e.ss)) ? 'non-reclame' : Number(e.s) === 440 ? 'retour' : 'litige' };
  }
  if (RE_NON_RECLAME.test(str(o.status)) || /retour\s+initi|retour\s+en\s+cours/i.test(str(o.status))) return { etat: 'attente', montant: null, reste: p, raison: RE_NON_RECLAME.test(str(o.status)) ? 'non-reclame' : 'retour' };
  return { etat: 'aucun', montant: null, reste: p, raison: '' };
}

// La liste des achats, chacun avec ce que la règle sait : REMBOURSÉ ⇒ son statut devient celui que Vinted écrira
// (« Remboursement effectué » : `achatAnnule` le sort de partout, sans attendre la relecture) ; PARTIEL ⇒ `_rembPartiel`
// (montant, reste) ; EN ATTENTE ⇒ `_rembAttente` (la raison). Rien d'autre ne change ; la même liste si rien ne bouge.
export function avecRemboursements(achats, { remb = null, txn = null, montantDe = null } = {}) {
  if (!Array.isArray(achats)) return achats;
  let change = false;
  const out = achats.map((o) => {
    if (!o || o.transaction_id == null || RE_SANS_COUT.test(str(o.status))) return o;
    const paye = typeof montantDe === 'function' ? montantDe(o) : null;
    const r = remboursementAchat(o, { remb, txn, paye });
    if (r.etat === 'rembourse') { change = true; return { ...o, status: 'Remboursement effectué', _statutLu: o.status, _rembourse: { montant: r.montant, raison: r.raison } }; }
    if (r.etat === 'partiel') { change = true; return { ...o, _rembPartiel: { montant: r.montant, reste: r.reste } }; }
    if (r.etat === 'attente') { change = true; return { ...o, _rembAttente: r.raison }; }
    return o;
  });
  return change ? out : achats;
}

// LE coût qui compte d'un achat (€) : 0 remboursé · le reste si partiel · ce qu'il a payé sinon · null pas su.
// `montantDe(o)` : ce qu'il a payé (`montantCommandeLu`).
export function coutAchatNet(o, montantDe) {
  if (!o) return null;
  if (RE_SANS_COUT.test(str(o.status))) return 0;
  const p = typeof montantDe === 'function' ? montantDe(o) : null;
  if (o._rembPartiel && Number.isFinite(Number(o._rembPartiel.reste))) return Number(o._rembPartiel.reste);
  return p == null || !Number.isFinite(Number(p)) ? null : Number(p);
}
// Combien d'achats d'une liste ont un remboursement EN ATTENTE (comptés, dit à côté du chiffre), et leur montant.
export function enAttenteDe(achats, montantDe) {
  let n = 0, eur = 0, pasLu = 0;
  for (const o of (Array.isArray(achats) ? achats : [])) {
    if (!o || !o._rembAttente || RE_SANS_COUT.test(str(o.status))) continue;
    n++; const p = typeof montantDe === 'function' ? montantDe(o) : null;
    if (p == null || !Number.isFinite(Number(p))) pasLu++; else eur += Number(p);
  }
  return { n, eur: arrondi(eur), pasLu };
}

// ── La publication de l'écran qui a les preuves (Achats) ────────────────────
// Le registre des achats (src/ecrans/Compta.jsx) relit ses achats lui-même : il applique la MÊME règle aux mêmes n° par
// ce que l'écran Achats a publié (tx → { etat, montant, reste, raison }). Rien de publié ⇒ le statut seul (comme avant).
let _publie = null;
export function publierRemboursements(achats) {
  const m = new Map();
  for (const o of (Array.isArray(achats) ? achats : [])) {
    if (!o || o.transaction_id == null) continue;
    const tx = str(o.transaction_id);
    if (o._rembourse) m.set(tx, { etat: 'rembourse', montant: o._rembourse.montant, reste: 0, raison: o._rembourse.raison });
    else if (o._rembPartiel) m.set(tx, { etat: 'partiel', montant: o._rembPartiel.montant, reste: o._rembPartiel.reste, raison: 'email' });
    else if (o._rembAttente) m.set(tx, { etat: 'attente', montant: null, reste: null, raison: o._rembAttente });
  }
  _publie = m;
}
// LE coût d'achat d'une PAIRE (bénéfice) : son prix d'achat `brut` (€) tel qu'il est écrit sur la fiche ; quand ce prix a
// été POSÉ DEPUIS LE REÇU de son achat (`buyPriceSource` 'recu', `buyPriceRecuTx` = SON n°) et que cet achat est remboursé,
// le remboursement est retiré (remboursé ⇒ 0, partiel ⇒ le reste). Un prix TAPÉ par lui n'est jamais touché (il sait ce
// qu'il a payé ; §2.5) ; rien de publié ⇒ le prix écrit.
export function coutFicheNet(e, brut) {
  if (brut == null || !Number.isFinite(Number(brut))) return brut;
  if (!e || e.buyPriceSource !== 'recu' || !(_publie instanceof Map)) return brut;
  const tx = str(e.buyPriceRecuTx || e.buyFromId).trim(); if (!tx) return brut;
  const r = _publie.get(tx); if (!r) return brut;
  if (r.etat === 'rembourse') return 0;
  if (r.etat === 'partiel' && Number.isFinite(Number(r.montant))) return Math.max(0, arrondi(Number(brut) - Number(r.montant)));
  return brut;
}
export function avecRemboursementsPublies(achats) {
  if (!Array.isArray(achats) || !(_publie instanceof Map) || !_publie.size) return achats;
  return achats.map((o) => {
    if (!o || o.transaction_id == null || RE_SANS_COUT.test(str(o.status))) return o;
    const r = _publie.get(str(o.transaction_id)); if (!r) return o;
    if (r.etat === 'rembourse') return { ...o, status: 'Remboursement effectué', _statutLu: o.status, _rembourse: { montant: r.montant, raison: r.raison } };
    if (r.etat === 'partiel') return { ...o, _rembPartiel: { montant: r.montant, reste: r.reste } };
    if (r.etat === 'attente') return { ...o, _rembAttente: r.raison };
    return o;
  });
}
