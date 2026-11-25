// ════════════════════════════════════════════════════════════════════════════
//  UN ACHAT « CHEZ MOI » — LA SEULE RÈGLE DE CE QUI PEUT ÊTRE RELIÉ (21 nov. 2026, lot relier-retires)
// ════════════════════════════════════════════════════════════════════════════
// Julien (21 nov.) : « Quand je veux relier, ça me propose des paires que je n'ai pas retirées. »
//
// MESURÉ en lecture seule sur sa base (récit : docs/passation/2026-11-21-relier-retires.md) : la règle pondérée
// (src/liaisonAchat.js, `affecterPropositions`) ne filtrait QUE « libre et pas annulé » — l'arrivée n'était vérifiée que
// par la grille façon Bleam (`recuDe`). L'affectation globale (Annonces « Sans achat relié », Ventes, la série, le
// numérotage, la feuille « Relier un achat » d'avant, la fiche de la paire) proposait donc aussi les achats EN ROUTE,
// PAYÉS, ou AU POINT RELAIS pas retirés.
//
// LA RÈGLE (une fonction, consultée par TOUS les chemins de proposition) — un achat est CHEZ LUI quand une preuve le dit :
//   · la commande est FINALISÉE (Vinted : « Transaction finalisée », `transaction_user_status` completed ; Leboncoin
//     « Terminé ») — l'acheteur l'a validée, donc reçue ;
//   · SON toucher : « Je l'ai retiré » (`vinted_pickup_done`) ou « Arrivé / rangé » (atelier d'arrivée) ;
//   · le TRANSPORTEUR dit le colis retiré / livré au destinataire, par SON n° de suivi (`txFinis` de la règle des
//     retraits, src/retraitPreuves.js / pickupUnion) ;
//   · Vinted dit « Commande livrée ! » (mesuré : sur les 3 qui ont un suivi lu, le transporteur dit « Délivré » APRÈS
//     « Disponible pour retrait » — c'est le retrait) ;
//   · livré à domicile (« livré chez / à domicile », « remis », « réceptionné »).
// Et il N'EST PAS chez lui :
//   · AU POINT RELAIS (« colis déposé en bureau de Poste ou point relais », « disponible », ou le suivi dit
//     « disponible ») et pas retiré : `au-point` — montré à part (« Pas encore retirés · N »), relié seulement après
//     SON « Je l'ai retiré » ;
//   · en route, payé, bordereau envoyé : `en-route` / `en-cours` ;
//   · annulé, remboursé, en retour, en litige : `hors` (déjà écarté par src/achatsHorsRelier.js).
// « Pas su » (statut vide, autre site sans statut lu) ⇒ pas chez lui (`pas-su`) : jamais proposé, jamais deviné.
//
// L'écran qui a les preuves (Comptabilité : suivis, retraits, touchers) PUBLIE l'état par n° de transaction
// (`publierChezMoi`) ; sans publication (ou pour un achat qu'elle n'a pas), la règle se rabat sur le STATUT seul
// (`etatChezMoi(achat)` sans preuves) — la même fonction, avec moins de preuves : jamais plus permissive.
// Module PUR. Exécuté par scripts/audit-relier-retires.cjs (avec mutations).

const str = (v) => String(v == null ? '' : v);
const txDe = (a) => (a && a.transaction_id != null ? str(a.transaction_id).trim() : '');

// Au point relais / en consigne, pas encore retiré — LA règle de l'app (`isAtRelayStatus` de src/App.jsx l'importe).
export const auPointRelais = (s) => !!(s) && !/livr[ée]\s+(?:chez|à\s+(?:ton|votre|son)\s+domicile|à\s+domicile)/i.test(s) && !/finalis|termin|annul|rembours|retour/i.test(s) && ((/d[ée]pos[ée]|arriv[ée]/i.test(s) && /point\s+relais|bureau\s+de\s+poste|casier|consigne|locker|vinted\s*go|point\s+de\s+retrait/i.test(s)) || /pr[êe]t\s+à\s+[êe]tre\s+retir/i.test(s) || (/disponible|à\s+retirer|au\s+point\s+de\s+retrait/i.test(s) && /relais|bureau\s+de\s+poste|casier|consigne|point|retrait|locker|vinted\s*go/i.test(s)));

const RE_HORS = /annul|cancel|rembours|retour|refus|[ée]chou|failed|suspend|litige|r[ée]clamation/i;
const RE_FINI = /finalis|\btermin[ée]/i;
const RE_LIVREE_VINTED = /commande\s+livr/i;
const RE_DOMICILE = /livr[ée]e?\s+(?:chez|à\s+(?:ton|votre|son)\s+domicile|à\s+domicile)|\bremis\b|r[ée]ceptionn/i;
const RE_ROUTE = /exp[eé]di|transit|achemin|en\s+route|envoy|pris\s+en\s+charge/i;

// Les états, du plus sûr au moins sûr. `chez` : peut être relié.
export const ETATS_CHEZ = Object.freeze(['finalise', 'retire-clic', 'retire', 'livre']);
export const ETATS_PAS_CHEZ = Object.freeze(['au-point', 'en-route', 'en-cours', 'hors', 'pas-su']);

// achat : la commande lue ({ transaction_id, status, transaction_user_status }) ;
// preuves (facultatives, données par l'écran qui les a lues) :
//   retireClic : son toucher « Je l'ai retiré » / « Arrivé » pour CET achat (par son n°) ;
//   finiSuivi  : le transporteur dit retiré / livré, par un n° de suivi de CET achat ;
//   auPointSuivi : le transporteur (ou son e-mail) dit « disponible au point », par un n° de CET achat.
// Rend { chez: bool, etat }.
export function etatChezMoi(achat, { retireClic = false, finiSuivi = false, auPointSuivi = false } = {}) {
  if (!achat || typeof achat !== 'object' || !txDe(achat)) return { chez: false, etat: 'pas-su' };
  const s = str(achat.status);
  const tus = str(achat.transaction_user_status).toLowerCase();
  if (RE_HORS.test(s)) return { chez: false, etat: 'hors' };
  if (RE_FINI.test(s) || tus === 'completed') return { chez: true, etat: 'finalise' };
  if (retireClic) return { chez: true, etat: 'retire-clic' };
  if (finiSuivi) return { chez: true, etat: 'retire' };
  if (RE_LIVREE_VINTED.test(s)) return { chez: true, etat: 'livre' };
  if (auPointRelais(s) || auPointSuivi) return { chez: false, etat: 'au-point' };
  if (RE_DOMICILE.test(s) || /\blivr[ée]/i.test(s.replace(/livraison/gi, ''))) {
    // « La livraison n'a pas encore eu lieu » : le mot « livraison » n'est pas « livré ».
    if (!/pas\s+encore/i.test(s)) return { chez: true, etat: 'livre' };
  }
  if (RE_ROUTE.test(s)) return { chez: false, etat: 'en-route' };
  if (!s.trim()) return { chez: false, etat: 'pas-su' };
  return { chez: false, etat: 'en-cours' };
}

// ── La publication de l'écran qui a les preuves ─────────────────────────────
let _publie = null;
// m : Map tx → { chez, etat } (ou null pour retirer la publication).
// (24 nov., vitesse-ecran-montre) `m` : la Map, ou une FONCTION qui la rend (calculée au premier appel, src/calculParesseux.js).
export function publierChezMoi(m) { _publie = typeof m === 'function' ? m : m instanceof Map ? () => m : null; }
const _publieeLue = () => { try { const m = _publie ? _publie() : null; return m instanceof Map ? m : null; } catch (_) { return null; } };
export const chezMoiPublie = () => _publieeLue();
// L'état d'un achat : la publication si elle a CET achat, sinon le statut seul.
export function etatAchatChezMoi(achat) {
  const tx = txDe(achat);
  const P = tx ? _publieeLue() : null;
  if (P && P.has(tx)) return P.get(tx);
  return etatChezMoi(achat);
}
// Le seul test que les chemins de proposition appellent.
export const achatChezMoi = (achat) => !!etatAchatChezMoi(achat).chez;

// La liste en deux : ce qui peut être relié (chez lui) et ce qui attend au point relais (montré replié,
// « Je l'ai retiré » le rend reliable). Le reste (en route, payé, pas su) n'est que compté.
// etatDe(achat) → { chez, etat } (par défaut la règle publiée).
export function partagerChezMoi(achats, etatDe = etatAchatChezMoi) {
  const chez = [], auPoint = [], ailleurs = [];
  for (const a of (Array.isArray(achats) ? achats : [])) {
    let e = null; try { e = etatDe(a); } catch (_) { e = null; }
    if (e && e.chez) chez.push(a);
    else if (e && e.etat === 'au-point') auPoint.push(a);
    else ailleurs.push(a);
  }
  return { chez, auPoint, ailleurs };
}
