// ════════════════════════════════════════════════════════════════════════════
//  LE PARCOURS D'UNE VENTE VESTIAIRE, ÉTAPE PAR ÉTAPE (11 nov., lot vestiaire-plus)
// ════════════════════════════════════════════════════════════════════════════
// Julien : « le parcours d'une vente Vestiaire : colis envoyé → arrivé chez
// Vestiaire → en authentification → validé / refusé → payé ; chaque étape LUE,
// jamais devinée ; « pas su » dit ; et le moment où l'argent arrive ».
//
// Ce que VRM LIT (rien d'autre) :
//  · `etapesVc` — la frise du vendeur telle que Vestiaire l'écrit sur la page de
//    suivi d'une vente (`/contents/timeline/seller`, rangée par l'extension 5.316) :
//    { sellerSale, sellerShipment, sellerConformity, sellerDelivery, sellerPayment }
//    valant « done » / « pending » / « upcoming » (MESURÉ le 3 et le 11 nov. sur
//    une vente à expédier : sale done, shipment pending, le reste upcoming) ;
//  · le mot de Vestiaire sur la vente (`etat`, `statutVc`) ;
//  · « Colis fait » posé par LUI (`vrm_vc_colis_done`) ;
//  · la date de versement LUE (`verseLe`) et le paiement ESTIMÉ par Vestiaire
//    (`paiementEstime`, son texte tel quel).
// ⚠️ Les e-mails Vestiaire d'après la vente (expédition, réception, contrôle,
//    paiement) n'ont JAMAIS été reçus (0 e-mail Vestiaire en base le 11 nov. ;
//    seul l'e-mail de VENTE est reconnu, par son sujet, et range la vente dans
//    `vc_ventes`). Leur sujet n'est pas inventé ici : ils restent gardés entiers
//    (« forme pas encore apprise ») jusqu'à ce qu'un vrai soit lu.
//
// Les règles :
//  · « done » seul prouve une étape ; « pending » dit l'étape EN COURS chez
//    Vestiaire ; « upcoming » = à venir ; une étape absente ou un autre mot ⇒
//    « pas su » (le mot recopié tel quel), jamais coché.
//  · ARRIVÉ chez Vestiaire : prouvé par le contrôle de Vestiaire en cours ou
//    fait (on ne contrôle qu'un article reçu), ou par une étape plus loin faite.
//    Jamais par le temps passé depuis l'envoi.
//  · VALIDÉ : contrôle « done ». REFUSÉ : seulement un mot de Vestiaire qui le
//    DIT (refus, non conforme, rejet…). Sinon « en attente », jamais « validé ».
//  · PAYÉ : paiement « done », ou le mot « versé ». L'argent n'entre dans le CA
//    déclaré qu'au mois de sa date de versement LUE (§5) — sans elle, la vente
//    n'est dans aucun mois, et c'est dit.
// Module PUR : scripts/audit-parcours-vestiaire.cjs l'exécute.
// ════════════════════════════════════════════════════════════════════════════

import { etapeMotVc, vcVentePartie } from '../api/_lib/vestiaire-regle.js';

const objet = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);
const mot = (e, k) => { const o = objet(e); return o && o[k] != null ? String(o[k]).trim().toLowerCase() : ''; };
const ETATS_CONNUS = new Set(['done', 'pending', 'upcoming']);
// Un mot de Vestiaire qui DIT un refus au contrôle (jamais déduit d'une absence).
export const MOT_REFUS_VC = /refus|reject|non.?conform|not.?conform|not.?authentic|unauthentic|fake|contrefa|failed|declin/i;
export const MOT_ARRIVE_VC = /received.?by|arriv|reception|warehouse|entrep/i;

export const ETAPES_PARCOURS_VC = ['envoye', 'arrive', 'authentification', 'verdict', 'paye'];

// `v` : une vente de `vc_ventes.ventes` ; `colisFait` : la date de « Colis fait » (ou rien).
// Rend null pour une vente qui n'est pas un objet ; sinon
// { etapes: [{ cle, etat: 'fait'|'encours'|'avenir'|'passu'|'refuse', t, preuve, mot }], argent, refusee }.
export function parcoursVenteVc(v, colisFait = null) {
  if (!objet(v)) return null;
  const e = objet(v.etapesVc);
  const brut = [v.etat, v.statutVc].map((x) => String(x == null ? '' : x).trim()).filter(Boolean).join(' · ');
  const s = (k) => mot(e, k);
  const fait = (k) => s(k) === 'done';
  const inconnu = (k) => !!s(k) && !ETATS_CONNUS.has(s(k));
  const refus = MOT_REFUS_VC.test(brut) || (inconnu('sellerConformity') && MOT_REFUS_VC.test(s('sellerConformity')));
  const paye = fait('sellerPayment') || etapeMotVc(v) === 'versee';
  const livre = fait('sellerDelivery');
  const valide = fait('sellerConformity');
  const controleEnCours = s('sellerConformity') === 'pending';
  // Encore « à expédier » chez Vestiaire : aucun mot ne dit l'arrivée (« shipmentInProgress » est l'état MESURÉ d'une vente à envoyer).
  const arriveMot = v.aExpedier !== true && MOT_ARRIVE_VC.test(brut);
  // Le mot de Vestiaire ne prouve l'envoi que hors « à expédier » (`vcVentePartie`, la règle partagée).
  const envoyeLu = !!colisFait || fait('sellerShipment') || vcVentePartie(v);
  const plusLoin = paye || livre || valide || refus || controleEnCours || arriveMot;
  const etape = (cle, ok, enCours, preuve, etatInconnu, t = null) => {
    if (ok) return { cle, etat: 'fait', t, preuve };
    if (etatInconnu) return { cle, etat: 'passu', t: null, preuve: '', mot: etatInconnu };
    if (enCours) return { cle, etat: 'encours', t: null, preuve };
    return { cle, etat: e || brut || colisFait ? 'avenir' : 'passu', t: null, preuve: '' };
  };
  const etapes = [
    etape('envoye', envoyeLu || plusLoin, s('sellerShipment') === 'pending',
      colisFait ? 'colis-fait' : fait('sellerShipment') ? 'vestiaire' : envoyeLu ? 'mot' : 'deduit', inconnu('sellerShipment') ? s('sellerShipment') : '', colisFait || null),
    etape('arrive', controleEnCours || valide || refus || arriveMot || livre || paye, false,
      controleEnCours || valide ? 'controle' : arriveMot ? 'mot' : 'deduit', ''),
    etape('authentification', valide || refus || livre || paye, controleEnCours, valide ? 'vestiaire' : controleEnCours ? 'vestiaire' : 'deduit', inconnu('sellerConformity') && !refus ? s('sellerConformity') : ''),
    refus ? { cle: 'verdict', etat: 'refuse', t: null, preuve: 'mot', mot: brut }
      : etape('verdict', valide || livre || paye, false, valide ? 'vestiaire' : 'deduit', ''),
    etape('paye', paye, s('sellerPayment') === 'pending', fait('sellerPayment') ? 'vestiaire' : 'mot', inconnu('sellerPayment') ? s('sellerPayment') : '', v.verseLe || null),
  ];
  // Sans aucune donnée de suivi (ni frise, ni mot, ni « Colis fait ») : tout est « pas su ».
  if (!e && !brut && !colisFait) for (const x of etapes) if (x.etat !== 'fait') x.etat = 'passu';
  // Un refus arrête le parcours : rien n'est payé après un refus (Vestiaire renvoie l'article).
  if (refus) etapes[4] = { cle: 'paye', etat: paye ? 'fait' : 'avenir', t: v.verseLe || null, preuve: paye ? 'vestiaire' : '' };
  return { etapes, argent: argentVenteVc(v), refusee: refus, motVestiaire: brut };
}

// LE MOMENT OÙ L'ARGENT ARRIVE (CA daté au versement, §5).
//  · `verse` : date de versement LUE ⇒ le mois du CA (AAAA-MM, heure de Paris) ;
//  · `estime` : Vestiaire estime le paiement (son texte, tel quel) — pas dans le CA ;
//  · `passu` : ni l'un ni l'autre.
export function argentVenteVc(v) {
  const t = Date.parse((v && v.verseLe) || '');
  if (Number.isFinite(t) && t > 0) {
    const mois = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit' }).format(new Date(t)).slice(0, 7);
    return { etat: 'verse', t, mois };
  }
  const est = String((v && v.paiementEstime) || '').trim();
  if (est) return { etat: 'estime', texte: est.slice(0, 60) };
  return { etat: 'passu' };
}

// Projection pour la frise existante (src/design/Frise.jsx) : { cle, label, fait, cours, ton, preuve, court, derniere }.
// `libelles` : { [cle]: texte } (traduits par l'appelant).
export function friseParcoursVc(p, libelles = {}, courts = {}) {
  if (!p || !Array.isArray(p.etapes)) return null;
  const L = p.etapes.map((x) => ({
    cle: x.cle, label: libelles[x.cle + (x.etat === 'refuse' ? '.refuse' : '')] || libelles[x.cle] || x.cle,
    court: courts[x.cle + (x.etat === 'refuse' ? '.refuse' : '')] || courts[x.cle] || undefined,
    fait: x.etat === 'fait' || x.etat === 'refuse', cours: x.etat === 'encours', ton: x.etat === 'refuse' ? 'action' : 'neutre',
    preuve: x.etat === 'passu' ? 'passu' : (x.preuve || ''),
  }));
  let der = -1; L.forEach((x, i) => { if (x.fait) der = i; });
  if (der >= 0) L[der].derniere = true;
  return L;
}
