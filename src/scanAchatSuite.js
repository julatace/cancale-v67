// ═══════════════════════════════════════════════════════════════════════════
// LE COLIS D'ACHAT SCANNÉ : SON N° ET LE GESTE SUIVANT (23 nov. 2026, lot scan-achat) — LA RÈGLE, PURE
// ═══════════════════════════════════════════════════════════════════════════
// Julien (« fais tout parfaitement ») : scanner le bordereau d'un colis d'ACHAT ⇒ l'app dit ce qu'il y a dedans,
// QUEL N° de rangement l'attend, et le geste suivant : « Ranger en … », « Numéroter », ou — la paire est déjà
// vendue — la vente à envoyer. Le scanner (src/ScannerRetrouver.jsx, `FicheAchat`) montre ce que cette règle rend.
//
// Les règles intouchables (CLAUDE.md §5) :
//   • le N° d'un achat vient de SON IDENTITÉ seulement : une fiche reliée à SON n° de transaction (`buyFromId`,
//     son clic) ou rangée à l'arrivée sous SON n° de transaction — jamais un titre (50 achats au même titre ⇒ seul
//     le bon) ;
//   • AUCUN N° n'est « prévu » ici : un N° montré peut être écrit sur un carton ; il n'est montré qu'une fois servi
//     (l'écran d'arrivée l'écrit dans le pool AVANT de le montrer). Sans N° ⇒ « Numéroter » ;
//   • une case n'est proposée que sur les cases LUES (`casesProposees`, la règle du Stock) ; pas su ⇒ rien ;
//   • « vendue » se PROUVE : une vente lue (pas annulée) porte ce N° par identité (son annonce, sa correction) ;
//     ventes pas lues ⇒ `venteSu: false` (rien n'est dit sur la vente, jamais « pas vendue »).
// ─────────────────────────────────────────────────────────────────────────────
import { casesProposees } from './ouRanger.js';
import { normaliserN } from './scanColis.js';

const str = (v) => (v == null ? '' : String(v)).trim();
const estObjet = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

// Les N° portés par CET achat, par identité : `fiches` = `vinted_annonce_numeros` (LUES), `rangees` =
// `vrm_fiches_neuves` (LUES : les paires rangées à l'arrivée portent `achat.tx`). Rend une liste (peut être vide),
// ou null (pas su : une des deux pas lue, ou tx illisible).
export function numerosDeLAchat({ tx, fiches, rangees, cleNum } = {}) {
  const t = str(tx);
  if (!/^\d+$/.test(t) || !estObjet(fiches) || !estObjet(rangees) || typeof cleNum !== 'function') return null;
  const vus = new Map();
  const ajoute = (n) => { const s = str(n); const k = s ? cleNum(s) : ''; if (k && !vus.has(k)) vus.set(k, s); };
  for (const k of Object.keys(fiches)) { const e = fiches[k]; if (e && str(e.buyFromId) === t) ajoute(e.numero); }
  for (const k of Object.keys(rangees)) { const f = rangees[k]; if (f && !f.retireeAt && f.achat && str(f.achat.tx) === t) ajoute(f.numero); }
  return [...vus.values()];
}

// La case d'un N° noté dans `vrm_slots`, dite avec le meuble lu : { num, meuble, meubleId, i, rangee, colonne } ;
// meuble inconnu ⇒ la place sans nom (`meuble: ''`).
function placeNotee(num, slot, meubles) {
  const m = (meubles || []).find((x) => x && x.id != null && String(x.id) === String(slot.m));
  const i = Number(slot.i);
  const cols = Math.max(1, Number(m && m.cols) || 1);
  return { num, meubleId: String(slot.m), meuble: m ? String(m.name || '') : '', i, rangee: Math.floor(i / cols) + 1, colonne: (i % cols) + 1 };
}

// LA SUITE. `numeros` : `numerosDeLAchat(...)` · `slots`, `meubles` : LUS · `vendus` : Map cleNum ⇒ { tx } des
// ventes LUES (pas annulées), ou null (ventes pas lues).
// Rend { su: false } (N° pas su : seul « Ranger » d'avant, l'écran d'arrivée relit tout) ·
//      { su: true, etat: 'aNumeroter' } ·
//      { su: true, etat: 'vendue', numeros, vente: { tx, num } } ·
//      { su: true, etat: 'range', numeros, places } (chaque N° est dans une case) ·
//      { su: true, etat: 'aRanger', numeros, places | null, aucunMeuble? } (places : la case notée, sinon proposée,
//        sinon null — plus de case libre ; `places: null` = cases pas lues) ;
//      + `venteSu` (false : ventes pas lues).
export function suiteAchatScan({ numeros, slots, meubles, vendus, cleNum } = {}) {
  if (!Array.isArray(numeros) || typeof cleNum !== 'function') return { su: false };
  const nums = numeros.map(str).filter(Boolean);
  const venteSu = vendus instanceof Map;
  if (!nums.length) return { su: true, etat: 'aNumeroter', venteSu };
  if (venteSu) {
    for (const n of nums) { const v = vendus.get(cleNum(n)); if (v && str(v.tx)) return { su: true, etat: 'vendue', numeros: nums, vente: { tx: str(v.tx), num: n }, venteSu }; }
  }
  if (!estObjet(slots) || !Array.isArray(meubles)) return { su: true, etat: 'aRanger', numeros: nums, places: null, venteSu };
  const notees = nums.map((n) => { const s = slots[cleNum(n)]; return s && s.m != null && Number.isInteger(Number(s.i)) ? placeNotee(n, s, meubles) : null; });
  if (notees.every(Boolean)) return { su: true, etat: 'range', numeros: nums, places: notees, venteSu };
  const sans = nums.filter((n, k) => !notees[k]).map((n) => cleNum(n));
  const prop = casesProposees({ meubles, slots, cles: sans });
  const aucunMeuble = !meubles.some((m) => m && m.id != null);
  const places = nums.map((n, k) => notees[k] || (prop && prop[cleNum(n)] ? { num: n, ...prop[cleNum(n)], propose: true } : null));
  return { su: true, etat: 'aRanger', numeros: nums, places, venteSu, ...(aucunMeuble ? { aucunMeuble: true } : {}) };
}

// Les N° VENDUS, par identité : `ventes` LUES (commandes vendues), `identiteAnnonce(o)` ⇒ l'annonce de la vente,
// `fiches` (N° par annonce), `corrections` (`vinted_sale_overrides` : le N° posé sur CETTE vente), `annulee(o)`.
// Rend Map cleNum ⇒ { tx }, ou null (ventes pas lues).
export function numerosVendus({ ventes, identiteAnnonce, fiches, corrections, annulee, cleNum } = {}) {
  if (!Array.isArray(ventes) || typeof cleNum !== 'function') return null;
  const m = new Map();
  const F = estObjet(fiches) ? fiches : {}, C = estObjet(corrections) ? corrections : {};
  for (const o of ventes) {
    if (!o || o.transaction_id == null) continue;
    if (typeof annulee === 'function' && annulee(o)) continue;
    const tx = String(o.transaction_id);
    let id = null; try { id = typeof identiteAnnonce === 'function' ? identiteAnnonce(o) : null; } catch (_) { id = null; }
    for (const n of [id != null && F[id] ? F[id].numero : null, C[tx] ? C[tx].numero : null]) { const k = str(n) ? cleNum(str(n)) : ''; if (k && !m.has(k)) m.set(k, { tx }); }
  }
  return m;
}

// UN N° TAPÉ (ou lu par la douchette) qui n'est pas un n° de suivi : le n° de TRANSACTION d'un achat (9 à 13
// chiffres, égalité exacte avec SA clé `a:{tx}`), ou le CODE DE RETRAIT d'un colis à retirer (4 caractères au
// moins, égalité exacte, sans espaces). Jamais un titre, jamais un début de n°. Rend { etat: 'un'|'plusieurs'|'aucun',
// par, trouve?, trouves? }.
export function achatParIdentite(brut, enregistrements) {
  const n = normaliserN(brut);
  const L = (Array.isArray(enregistrements) ? enregistrements : []).filter((e) => e && e.cle != null && (e.sorte === 'achat' || e.sorte === 'colis'));
  let par = '', T = [];
  if (/^\d{9,13}$/.test(n)) { T = L.filter((e) => e.sorte === 'achat' && String(e.cle) === 'a:' + n); par = 'transaction'; }
  if (!T.length && n.length >= 4) { T = L.filter((e) => e.code && normaliserN(e.code) === n); par = 'code'; }
  const vus = new Map(); for (const e of T) vus.set(`${e.sorte}:${e.cle}`, e);
  const U = [...vus.values()];
  if (!U.length) return { etat: 'aucun' };
  if (U.length > 1) return { etat: 'plusieurs', par, trouves: U };
  return { etat: 'un', par, trouve: U[0] };
}
