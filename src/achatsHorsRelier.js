// ════════════════════════════════════════════════════════════════════════════
//  UN ACHAT EN RETOUR, EN LITIGE, REMBOURSÉ OU ANNULÉ N'EST PAS « À RELIER » (16 nov.)
// ════════════════════════════════════════════════════════════════════════════
// Julien (capture de la feuille « Relier » d'une vente, liste de ses achats) : « par exemple
// j'ai demandé un retour, donc j'ai fait un litige : ne me la propose pas, vu que je ne vais
// pas la mettre en vente ».
//
// LA RÈGLE — partout où un achat est proposé à relier (propositions, « Choisir un achat »,
// « Autres pistes », numérotage, saisie en série, « Achetés, pas en ligne », atelier d'arrivée) :
// un achat est HORS RELIER quand l'une de ces PREUVES le désigne par SON n° de transaction
// (jamais par le titre, §5) :
//   · son propre statut Vinted : annulé, remboursé, retour, suspendu, échoué (`ACHAT_SANS_COUT`,
//     la règle du coût), ou « litige » / « réclamation » ;
//   · un bordereau de retour reçu par e-mail (`email_bordretour_{tx}`, sens « achat »), ou l'avis
//     « Retourne ta commande » désigné par SA conversation (une seule commande) — la règle partagée
//     `txAchatsEnRetour` (api/_lib/suivi-colis.js), passée par l'appelant ;
//   · un remboursement PROUVÉ par e-mail (`email_rembachat_{tx}`) d'au moins ce qu'il a payé (ou
//     payé pas su : la preuve du remboursement suffit) ; un remboursement PARTIEL prouvé (il garde
//     la paire) n'écarte rien ;
//   · un litige ouvert que VRM suit (`litigesEnCours`, sens « achat », son n°).
// Le litige CLOS SANS RETOUR (il garde la paire) : la commande le PROUVE (« Commande finalisée »,
// `transaction_user_status` completed, sans remboursement ni annulation) ⇒ l'achat redevient
// proposable, même si un bordereau de retour ou un avis avait été reçu.
// Rien n'est supprimé ni caché ailleurs : l'achat reste dans Achats → Retours / Litiges.
// « Pas su » (bordereaux, remboursements pas lus) n'écarte rien de plus que le statut.
//
// Module PUR (rien n'est lu ni écrit). La règle est exécutée par scripts/audit-achats-hors-relier.cjs.
// L'écran qui lit les preuves (Comptabilité) PUBLIE la carte (`publierHorsRelier`) ; les modules
// de liaison (src/suggestionsAchat.js `achatAnnule`, donc src/liaisonAchat.js) la consultent.
import { ACHAT_SANS_COUT } from './prixAchatPropose.js';

const str = (v) => String(v == null ? '' : v);
const txDe = (o) => (o && o.transaction_id != null ? str(o.transaction_id).trim() : '');
export const RE_LITIGE_STATUT = /litige|r[ée]clamation/i;
const RE_FINALISE = /finalis/i;
const RE_FIN_SANS_PAIRE = /annul|cancel|rembours|retour|refus|[ée]chou|failed/i;

// La raison que le STATUT dit lui-même, ou ''.
export function raisonStatut(o) {
  const st = str(o && o.status);
  if (!st) return '';
  if (/rembours/i.test(st)) return 'rembourse';
  if (/annul|cancel|refus|[ée]chou|failed/i.test(st)) return 'annule';
  if (/retour/i.test(st)) return 'retour';
  if (/suspend/i.test(st) || RE_LITIGE_STATUT.test(st)) return 'litige';
  if (ACHAT_SANS_COUT.test(st)) return 'annule';
  return '';
}
// Le litige clos sans retour : la commande est finalisée (il garde la paire).
export function closSansRetour(o) {
  if (!o) return false;
  const st = str(o.status), tus = str(o.transaction_user_status).toLowerCase();
  if (RE_FIN_SANS_PAIRE.test(st) || RE_LITIGE_STATUT.test(st) || /suspend/i.test(st)) return false;
  return RE_FINALISE.test(st) || tus === 'completed';
}

// achats   : ses achats Vinted lus ({ transaction_id, status, transaction_user_status, conversation_id })
// txRetour : Set des n° d'achats en retour (`txAchatsEnRetour`) — `null` pas su
// remb     : Map tx → { montant } (`remboursementsParTx`) — `null`/`undefined` pas su
// litiges  : lignes de `litigesEnCours` (ouvertes) — `null` pas su
// montantDe(o) : ce qu'il a payé (€) ou null
// Rend Map tx → raison ('rembourse' | 'annule' | 'retour' | 'litige').
export function achatsHorsRelier({ achats, txRetour = null, remb = null, litiges = null, montantDe = null } = {}) {
  const out = new Map();
  const litigeTx = new Set();
  for (const l of (Array.isArray(litiges) ? litiges : [])) {
    if (!l || l.sens !== 'achat' || l.plateforme && l.plateforme !== 'vinted') continue;
    const tx = str(l.tx).trim(); if (tx) litigeTx.add(tx);
  }
  for (const o of (Array.isArray(achats) ? achats : [])) {
    const tx = txDe(o); if (!tx) continue;
    const s = raisonStatut(o);
    if (s) { out.set(tx, s); continue; }
    const r = remb instanceof Map ? remb.get(tx) : null;
    if (r && isFinite(Number(r.montant))) {
      const paye = typeof montantDe === 'function' ? montantDe(o) : null;
      const partiel = paye != null && isFinite(paye) && Number(r.montant) + 0.005 < paye;
      if (!partiel) { out.set(tx, 'rembourse'); continue; }
    }
    if (closSansRetour(o)) continue;                       // clos sans retour : il garde la paire
    if (txRetour && typeof txRetour.has === 'function' && txRetour.has(tx)) { out.set(tx, 'retour'); continue; }
    if (litigeTx.has(tx)) { out.set(tx, 'litige'); continue; }
  }
  return out;
}

// ── La publication (l'écran qui lit les preuves la pose ; les règles de liaison la lisent) ──
let _publie = null;
export function publierHorsRelier(m) { _publie = m instanceof Map ? m : null; }
export const lireHorsRelier = () => _publie;
// L'achat est-il hors relier ? Le statut seul suffit toujours ; la carte publiée ajoute les preuves.
export function achatHorsRelier(o, carte = _publie) {
  if (!o) return false;
  if (raisonStatut(o)) return true;
  const tx = txDe(o);
  return !!(tx && carte instanceof Map && carte.has(tx));
}
