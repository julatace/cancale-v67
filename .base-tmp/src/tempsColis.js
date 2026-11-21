// ════════════════════════════════════════════════════════════════════════════
//  TON TEMPS PAR COLIS, TON GAIN À L'HEURE (14 nov., proposition 101 validée)
//
//  MESURÉ, JAMAIS DEVINÉ, SUR CET APPAREIL SEULEMENT :
//   · une SÉANCE = une ouverture de « Préparer mes colis » ; ce qu'elle a vu : l'heure
//     d'ouverture et l'heure de chaque « Colis fait » (celle de la séance, qui suit
//     l'écriture réelle : un « Annuler » retire le colis, src/PreparerColis.jsx) ;
//   · le temps d'UN colis = l'écart depuis l'ouverture (pour le 1er) ou depuis le
//     « Colis fait » précédent. Un écart de plus de PAUSE_MS (15 min) est une pause,
//     un écart de moins de MIN_MS (15 s) est un colis préparé avant : ni l'un ni
//     l'autre n'est un temps d'emballage ⇒ ce colis est « pas mesuré » (compté à part) ;
//   · le temps total est donc un PLANCHER (« au moins ») : les pauses, les colis faits
//     ailleurs et le temps des photos ou des achats n'y sont pas ;
//   · le gain à l'heure = le bénéfice des colis MESURÉS dont le bénéfice est connu
//     (la règle `beneficePaire` : vente − prix d'achat SAISI − frais saisis), divisé
//     par LEUR temps ; la couverture est dite à côté (« sur 12 colis »). Aucun bénéfice
//     connu ⇒ null (« — »), jamais 0.
//  La mémoire (`vrm_temps_colis`, sur l'appareil, jamais dans le nuage) : au plus
//  SEANCES_MAX séances, la plus vieille part d'abord. Module PUR sauf lire/écrire :
//  scripts/audit-colis-plus.cjs l'EXÉCUTE.
// ════════════════════════════════════════════════════════════════════════════
import { beneficePaire } from './beneficePaire.js';

export const CLE_TEMPS = 'vrm_temps_colis';
export const PAUSE_MS = 15 * 60000;
export const MIN_MS = 15000;
export const SEANCES_MAX = 300;
export const JOURS_RESUME = 30;
const J = 86400000;

// Une séance mesurée : { ouverture, colis: [{ cle, at, ms|null }] } (ms null = pas mesuré).
// `faits` : { cle: ms } — les « Colis fait » notés pendant CETTE ouverture.
export function mesurerSeance(ouverture, faits) {
  const o = Number(ouverture);
  if (!Number.isFinite(o)) return { ouverture: null, colis: [] };
  const L = Object.entries(faits && typeof faits === 'object' ? faits : {})
    .map(([cle, at]) => ({ cle, at: Number(at) }))
    .filter((x) => x.cle && Number.isFinite(x.at) && x.at >= o)
    .sort((a, b) => a.at - b.at || (a.cle < b.cle ? -1 : 1));
  let prec = o;
  const colis = L.map((x) => { const d = x.at - prec; prec = x.at; return { cle: x.cle, at: x.at, ms: d >= MIN_MS && d <= PAUSE_MS ? d : null }; });
  return { ouverture: o, colis };
}

export function lireJournal(stockage = (typeof localStorage !== 'undefined' ? localStorage : null), uid = '') {
  try {
    const j = JSON.parse((stockage && stockage.getItem(cleDe(uid))) || 'null');
    if (!j || j.v !== 1 || !Array.isArray(j.seances)) return { v: 1, seances: [] };
    return { v: 1, seances: j.seances.filter((s) => s && Number.isFinite(s.ouverture) && Array.isArray(s.colis)) };
  } catch (_) { return { v: 1, seances: [] }; }
}
const cleDe = (uid) => (uid ? `${CLE_TEMPS}_${uid}` : CLE_TEMPS);
// La séance remplace celle de la même ouverture (un « Annuler » la recalcule) ;
// une séance sans aucun colis fait n'est pas gardée.
export function noterSeance(journal, seance) {
  const j = journal && Array.isArray(journal.seances) ? journal : { v: 1, seances: [] };
  const autres = j.seances.filter((s) => s.ouverture !== seance.ouverture);
  const seances = seance && seance.colis && seance.colis.length ? [...autres, seance] : autres;
  seances.sort((a, b) => a.ouverture - b.ouverture);
  return { v: 1, seances: seances.slice(-SEANCES_MAX) };
}
export function ecrireJournal(j, stockage = (typeof localStorage !== 'undefined' ? localStorage : null), uid = '') {
  try { if (stockage) stockage.setItem(cleDe(uid), JSON.stringify(j)); return true; } catch (_) { return false; }
}

const montantTexte = (v) => {
  if (v == null || String(v).trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? (Math.round(n * 100) / 100).toFixed(2) : null;
};
// Le bénéfice d'un colis lu dans le relevé de Ventes (`vrm_stats_ventes` : lignes
// [plateforme, compte, id, ts, vente €, achat €|null, frais €|null, …]) PAR SON
// IDENTITÉ : 'v:' + n° de transaction Vinted ⇔ ligne vinted de ce n°. Sinon null.
export function beneficesParColis(releve) {
  const m = new Map();
  const L = releve && Array.isArray(releve.l) ? releve.l : (Array.isArray(releve) ? releve : []);
  for (const r of L) {
    if (!Array.isArray(r)) continue;
    const [plateforme, , id, , eur, achat, frais] = r;
    if (String(plateforme) !== 'vinted' || id == null) continue;
    const b = beneficePaire(montantTexte(eur), { buyPrice: montantTexte(achat), fees: montantTexte(frais) });
    m.set('v:' + String(id), b.benefice);
  }
  return (cle) => (m.has(cle) ? m.get(cle) : null);
}

// Le résumé : séances depuis `depuis` (ms). `beneficeDe(cle)` → € | null.
// Rend { seances, colis, mesures, totalMs, parColisMs|null, gainHeure|null, nGain }.
export function resumeTemps(journal, { depuis = -Infinity, beneficeDe = null } = {}) {
  const S = (journal && Array.isArray(journal.seances) ? journal.seances : []).filter((s) => s.ouverture >= depuis);
  let colis = 0, mesures = 0, totalMs = 0, gainC = 0, gainMs = 0, nGain = 0;
  const vus = new Set();
  for (const s of S) for (const c of s.colis) {
    if (!c || !c.cle || vus.has(c.cle)) continue;   // un même colis compté une fois
    vus.add(c.cle); colis += 1;
    if (!Number.isFinite(c.ms)) continue;
    mesures += 1; totalMs += c.ms;
    const b = typeof beneficeDe === 'function' ? beneficeDe(c.cle) : null;
    if (b != null && Number.isFinite(b)) { gainC += Math.round(b * 100); gainMs += c.ms; nGain += 1; }
  }
  return {
    seances: S.length, colis, mesures, totalMs,
    parColisMs: mesures ? Math.round(totalMs / mesures) : null,
    gainHeure: nGain && gainMs > 0 ? Math.round((gainC / 100) / (gainMs / 3600000) * 100) / 100 : null,
    nGain,
  };
}
export const depuisJours = (n = JOURS_RESUME, maintenant = Date.now()) => maintenant - n * J;

// « 4 min 20 », « 1 h 05 », « 40 s » — un temps mesuré, arrondi à la seconde.
export function dureeCourte(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60), r = s % 60;
  if (m < 60) return r ? `${m} min ${String(r).padStart(2, '0')}` : `${m} min`;
  const h = Math.floor(m / 60), mm = m % 60;
  return `${h} h ${String(mm).padStart(2, '0')}`;
}
