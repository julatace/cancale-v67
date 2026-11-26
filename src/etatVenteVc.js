// ════════════════════════════════════════════════════════════════════════════
//  L'ÉTAT D'UNE VENTE VESTIAIRE, EN MOTS (15 nov.)
// ════════════════════════════════════════════════════════════════════════════
// Julien (iPhone, 15 nov.) voyait sous ses ventes Vestiaire « Vestiaire :
// « IN_PROGRESS » » (le code machine de Vestiaire, recopié tel quel) et « À envoyer
// · date limite passée » sur un sac expédié depuis huit jours. Ce module dit
// l'état d'une vente PAR SES ÉTAPES LUES (la frise du vendeur `etapesVc`, le statut
// `statutVc`, le mot `etat` rangé dans une famille connue), jamais par le code
// brut. Il rend une CLÉ (les mots passent par tr(), `vcventes.etat.*`, 5 langues) :
//   annulee · colisFait · envoyeeTransporteur · aExpedier* · payee · paiement ·
//   valideePaiement · livreeControle · controle · expediee · plusAExpedier ·
//   vendue · inconnu.
// « À expédier » est LA règle partagée (`aExpedierVc`, api/_lib/vestiaire-regle.js :
// l'état le plus frais gagne) — la même que la tête « N à expédier », Colis, Ma
// journée, le widget. Un mot que rien ne range ⇒ `inconnu` (« État Vestiaire non
// reconnu »), jamais le mot lui-même.
// Module PUR : scripts/audit-vestiaire-a-expedier.cjs l'exécute.
// ════════════════════════════════════════════════════════════════════════════
import { aExpedierVc, expeditionVc, etapeMotVc, vcVenteAnnulee } from '../api/_lib/vestiaire-regle.js';
import { joursAvant } from '../api/_lib/ebay-a-expedier.js';

const objet = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);
const mot = (e, k) => { const o = objet(e); return o && o[k] != null ? String(o[k]).trim().toLowerCase() : ''; };
// Les mots MESURÉS d'une vente vendue que rien d'autre ne range (« IN_PROGRESS » :
// commande en cours ; « ACTION_NEEDED » : une vente à envoyer, mesurée le 11 nov.).
const MOTS_VENDUE = /^(in_progress|action_needed)$/i;
const MOIS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

// « 23 novembre 2026 » (le texte de Vestiaire, tel quel) ⇒ une date à MIDI, heure de Paris
// approchée (le jour seul compte) ; une autre forme ⇒ 0 (le texte est montré tel quel).
export function datePaiementEstimeVc(texte) {
  const s = String(texte == null ? '' : texte).trim().toLowerCase();
  const m = /^(\d{1,2})\s+([a-zéû]+)\.?\s+(\d{4})$/.exec(s);
  if (m) {
    const i = MOIS_FR.findIndex((x) => x === m[2] || x.slice(0, 3) === m[2].slice(0, 3));
    if (i >= 0) { const t = Date.UTC(+m[3], i, +m[1], 11); return Number.isFinite(t) ? t : 0; }
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) { const t = Date.UTC(+iso[1], +iso[2] - 1, +iso[3], 11); return Number.isFinite(t) ? t : 0; }
  return 0;
}

// `v` : une vente de `vc_ventes.ventes` (brute ou passée par `venteVcFraiche`) ;
// `fait` : la date de « Colis fait » posé par lui ; `depart` : la preuve du transporteur
// (`departsVc`) ; `lectures` : `vc_ventes.lectures`.
// Rend { cle, ton: 'action'|'annule'|'', limite?, jours?, estime?, estimeT?, phrase? }.
export function etatVenteVc(v, { fait = null, depart = null, lectures = null, maintenant = Date.now() } = {}) {
  if (!objet(v)) return { cle: 'inconnu', ton: '' };
  if (vcVenteAnnulee(v)) return { cle: 'annulee', ton: 'annule' };
  if (aExpedierVc(v, lectures)) {
    if (fait) return { cle: 'colisFait', ton: '' };
    if (depart) return { cle: 'envoyeeTransporteur', ton: '', phrase: String(depart.phrase || '') };
    const t = Date.parse(v.limite || '');
    if (!Number.isFinite(t)) return { cle: 'aExpedierSansDate', ton: 'action' };
    const j = joursAvant(t, maintenant);
    const cle = j == null ? 'aExpedier' : j < 0 ? 'aExpedierPassee' : j === 0 ? 'aExpedierAujourdhui' : j === 1 ? 'aExpedierDemain' : 'aExpedier';
    return { cle, ton: 'action', limite: t, jours: j };
  }
  const e = objet(v.etapesVc), m = etapeMotVc(v);
  if (mot(e, 'sellerPayment') === 'done' || m === 'versee' || m === 'terminee') return { cle: 'payee', ton: '' };
  if (mot(e, 'sellerConformity') === 'done') {
    const estime = String(v.paiementEstime || '').trim();
    return estime ? { cle: 'paiement', ton: '', estime: estime.slice(0, 40), estimeT: datePaiementEstimeVc(estime) } : { cle: 'valideePaiement', ton: '' };
  }
  if (mot(e, 'sellerDelivery') === 'done' || ['pending', 'ongoing'].includes(mot(e, 'sellerConformity')) || m === 'livree') return { cle: 'livreeControle', ton: '' };
  if (m === 'controle') return { cle: 'controle', ton: '' };
  if (expeditionVc(v).prouvee || m === 'en-route') return { cle: 'expediee', ton: '' };
  if (v.plusAExpedierDepuis) return { cle: 'plusAExpedier', ton: '' };
  const brut = String(v.etat || '').trim();
  if (!brut || MOTS_VENDUE.test(brut) || mot(e, 'sellerSale') === 'done') return { cle: 'vendue', ton: '' };
  return { cle: 'inconnu', ton: '' };
}

// Le rang de l'étape sur la frise de la ligne (Vendue · Postée · Livrée · Payée), pour le tri
// et les attributs (`data-vc-vente-etape`) ; `null` = pas su.
export const RANG_ETAT_VC = Object.freeze({ annulee: null, colisFait: 0, aExpedier: 0, aExpedierSansDate: 0, aExpedierPassee: 0, aExpedierAujourdhui: 0, aExpedierDemain: 0,
  envoyeeTransporteur: 1, expediee: 1, controle: 1, livreeControle: 2, valideePaiement: 2, paiement: 2, payee: 3, plusAExpedier: null, vendue: 0, inconnu: null });
