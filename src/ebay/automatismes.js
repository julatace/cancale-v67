// ════════════════════════════════════════════════════════════════════════════
//  LES AUTOMATISMES eBAY (28 nov. 2026, lot ebay-automatismes) — RÈGLES PURES
// ════════════════════════════════════════════════════════════════════════════
// Julien : « copie tous les concurrents, fais pareil pour eBay ». Ce que Sixbit, inkFrog, Vendoo, 3Dsellers et
// le Seller Hub font seuls, VRM le fait par l'API OFFICIELLE d'eBay (jamais l'extension), côté serveur :
//   E1 · la BAISSE PAR RÈGLE (−5/−10/−15 % après 7/14/30 j sans vente) — la MÊME règle que Vinted, Leboncoin et
//        Vestiaire (`baisseDue`, src/reglesAuto.js), plancher compris ;
//   E2 · l'OFFRE AUX OBSERVATEURS automatique (après N heures d'observateurs, −x %, une fois par annonce et par
//        période) — la même lecture que son clic (`jugerOffre`, api/_lib/ebay-offre.js) ;
//   E3 · la CONTRE-OFFRE PAR PALIERS (la règle `palierSuivant` de src/negociationPaliers.js, telle quelle) — jamais
//        une acceptation : c'est eBay qui accepte, à SON seuil (§3) ;
//   E4 · la REMISE EN VENTE des invendus (RelistFixedPriceItem : eBay recopie l'annonce, SKU `VRM-{n°}` compris) et
//        « Vendre un similaire » (un BROUILLON prérempli, sans N° : il choisit la paire, donc un nouveau N°) ;
//   E5 · le PRIX AJUSTÉ pour eBay (+x % pour couvrir les frais) : proposé à la publication, et le plancher des trois
//        moteurs est remonté d'autant (jamais descendu) ;
//   E6 · la MODIFICATION EN MASSE (cocher N annonces ⇒ −x %, un nouveau prix, ou la fin), récapitulatif puis SON
//        clic — le chemin `revise` / `terminerannonce` d'api/ebay.js, ligne par ligne.
// Chacun est ÉTEINT par défaut, réglé par compte eBay (page eBay › Automatismes), plafonné, journalisé.
//
// LE PLANCHER (jamais franchi) : le prix mini posé à côté du N°, sinon l'achat + 10 % ; ni l'un ni l'autre ⇒ AUCUN
// geste automatique sur cette annonce. Il est PUBLIÉ par l'app (`vrm_planchers_ebay`, synchronisé, §11 : un
// propriétaire, des lecteurs) par N° (cleNum) — le serveur ne le recalcule jamais. L'annonce eBay désigne son N°
// par son SKU `VRM-{n°}` lu chez eBay (traduit par la numérotation 013) : jamais un titre (§5).
// Une publication de plus de 72 h ⇒ « plancher pas relu » ⇒ rien (« pas su » ne vaut pas « oui »).
//
// Ce module ne fait AUCUN appel : l'app (src/ebay/AutomatismesEbay.jsx, src/ecrans/Ebay.jsx) et le serveur
// (api/_lib/ebay-automatismes.js) l'importent. `scripts/audit-ebay-automatismes.cjs` l'exécute.
// ════════════════════════════════════════════════════════════════════════════
import { plancherBaisse } from '../reglesAuto.js';

// ── LES CHOIX (un toucher chacun, jamais une saisie libre) ──────────────────
export const BAISSE_PCT = Object.freeze([5, 10, 15]);
export const BAISSE_JOURS = Object.freeze([7, 14, 30]);
export const OFFRE_PCT = Object.freeze([5, 10, 15, 20]);
export const OFFRE_HEURES = Object.freeze([24, 48, 72]);
export const OFFRE_PERIODE_JOURS = Object.freeze([7, 14, 30]);
export const PALIERS_PRESETS = Object.freeze({ doux: Object.freeze([30, 60, 100]), standard: Object.freeze([50, 80, 100]), direct: Object.freeze([100]) });
export const RELANCE_PAR_JOUR = Object.freeze([3, 5, 10]);
export const MAJORATION_PCT = Object.freeze([0, 5, 8, 10, 12, 15]);
export const MASSE_PCT = Object.freeze([5, 10, 15, 20]);
export const MASSE_MAX = 25;                 // lignes par modification en masse
export const PLANCHERS_AGE_MAX_MS = 72 * 3600000;
export const MAJORATION_CLE = 'vrm_ebay_majoration';
export const PLANCHERS_CLE = 'vrm_planchers_ebay';
export const MOTEURS = Object.freeze(['baisse', 'offres', 'paliers', 'relance']);

export const DEFAUT = Object.freeze({
  baisse: Object.freeze({ actif: false, pct: 5, jours: 14 }),
  offres: Object.freeze({ actif: false, pct: 10, heures: 48, periode: 7 }),
  paliers: Object.freeze({ actif: false, preset: 'standard' }),
  relance: Object.freeze({ actif: false, parJour: 3, gratuitSeul: true }),
});

const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);
const dans = (liste, v, d) => (liste.includes(Number(v)) ? Number(v) : d);

// Les réglages d'UN compte, toujours complets (éteints par défaut ; une valeur hors des choix ⇒ le défaut).
export function reglagesCompte(brut) {
  const b = obj(brut) || {};
  const ba = obj(b.baisse) || {}, of = obj(b.offres) || {}, pa = obj(b.paliers) || {}, re = obj(b.relance) || {};
  return {
    baisse: { actif: ba.actif === true, pct: dans(BAISSE_PCT, ba.pct, DEFAUT.baisse.pct), jours: dans(BAISSE_JOURS, ba.jours, DEFAUT.baisse.jours) },
    offres: { actif: of.actif === true, pct: dans(OFFRE_PCT, of.pct, DEFAUT.offres.pct), heures: dans(OFFRE_HEURES, of.heures, DEFAUT.offres.heures), periode: dans(OFFRE_PERIODE_JOURS, of.periode, DEFAUT.offres.periode) },
    paliers: { actif: pa.actif === true, preset: Object.prototype.hasOwnProperty.call(PALIERS_PRESETS, pa.preset) ? pa.preset : DEFAUT.paliers.preset },
    relance: { actif: re.actif === true, parJour: dans(RELANCE_PAR_JOUR, re.parJour, DEFAUT.relance.parJour), gratuitSeul: re.gratuitSeul !== false },
  };
}
// Les réglages après SON geste (`maj` : { moteur: { champ: valeur } }) : seules les clés connues passent.
export function avecReglages(avant, maj) {
  const r = reglagesCompte(avant);
  const m = obj(maj) || {};
  const out = {};
  for (const k of MOTEURS) out[k] = { ...r[k], ...(obj(m[k]) || {}) };
  return reglagesCompte(out);
}
// Un moteur que SON geste ALLUME (éteint ⇒ allumé) : le serveur exige sa confirmation.
export const allumes = (avant, apres) => MOTEURS.filter((k) => !reglagesCompte(avant)[k].actif && reglagesCompte(apres)[k].actif);
export const unAllume = (r) => MOTEURS.some((k) => reglagesCompte(r)[k].actif);

// ── E1 : la règle de la baisse, sous la forme qu'attend `regleBaisseDe` (src/reglesAuto.js) ──
export const regleBaissePour = (r) => { const b = reglagesCompte(r).baisse; return { comptes: { ebay: { actif: b.actif, pct: b.pct, jours: b.jours } } }; };
// ── E3 : les réglages de paliers, sous la forme qu'attend `palierSuivant` (src/negociationPaliers.js) ──
export const reglagesPaliersPour = (r) => { const p = reglagesCompte(r).paliers; return { actif: p.actif, remiseMax: null, paliers: [...PALIERS_PRESETS[p.preset]], arrondi: true }; };

// ── E5 : LA MAJORATION eBAY ────────────────────────────────────────────────
// `vrm_ebay_majoration` = { v: 1, comptes: { [ref]: pct } } (ref : 'principal' ou la clé du compte).
export function majorationDe(v, ref) {
  const c = obj(obj(v) && v.comptes);
  return c ? dans(MAJORATION_PCT, c[String(ref || 'principal')], 0) : 0;
}
export function avecMajoration(v, ref, pct) {
  const c = { ...((obj(obj(v) && v.comptes)) || {}) };
  c[String(ref || 'principal')] = dans(MAJORATION_PCT, pct, 0);
  return { v: 1, comptes: c };
}
// Le prix proposé pour eBay : le prix + x %, à l'euro SUPÉRIEUR (le prix ne descend jamais sous celui qu'il a choisi).
// Rend des euros, ou null (prix illisible).
export function prixMajore(prix, pct) {
  const p = Number(String(prix == null ? '' : prix).replace(',', '.'));
  if (!(Number.isFinite(p) && p > 0 && p < 100000)) return null;
  const k = dans(MAJORATION_PCT, pct, 0);
  if (!k) return Math.round(p * 100) / 100;
  return Math.ceil(Math.round(p * (100 + k)) / 100 - 1e-9);
}

// ── LE PLANCHER ────────────────────────────────────────────────────────────
// Ce que l'app publie : `{ v: 1, at, parNum: { [cleNum]: [miniC|null, achatC|null] }, presents: [cleNum…] | null }`.
const cleNum = (v) => { let s = String(v == null ? '' : v).trim().toUpperCase().replace(/[\s\-_.]/g, ''); if (/^\d+$/.test(s)) s = String(parseInt(s, 10)); return s; };
const NUM_OK = /^([A-Z]{1,3})?\d{1,6}$/;
const centimes = (v) => { if (v == null || typeof v === 'object' || typeof v === 'boolean') return null; const t = String(v).replace(/\s|€/g, '').replace(',', '.'); if (!t) return null; const n = Number(t); return Number.isFinite(n) && n > 0 && n < 1e6 ? Math.round(n * 100) : null; };
// LA PUBLICATION (côté app). `fiches` : `vinted_annonce_numeros` ; `achatParNum` : `vinted_buyprice_by_num` ;
// `physiques` : `vinted_nums_physiques` (les paires présentes, la liste de l'écran Annonces). Deux fiches au même N° ⇒ le
// plancher le PLUS HAUT (jamais le plus bas : un N° porté deux fois ne fait jamais baisser plus bas que l'une d'elles).
export function planchersAPublier(fiches, achatParNum, physiques, maintenant = Date.now()) {
  const parNum = {};
  const haut = (a, b) => (a == null ? b : b == null ? a : Math.max(a, b));
  for (const f of Object.values(obj(fiches) || {})) {
    if (!f || typeof f !== 'object') continue;
    const k = cleNum(f.numero);
    if (!k || !NUM_OK.test(k)) continue;
    const mini = centimes(f.min);
    const brut = f.buyPrice != null && String(f.buyPrice).trim() !== '' ? f.buyPrice : (obj(achatParNum) ? achatParNum[String(f.numero).trim()] : null);
    const achat = centimes(brut);
    if (mini == null && achat == null) continue;
    const a = parNum[k] || [null, null];
    parNum[k] = [haut(a[0], mini), haut(a[1], achat)];
  }
  // Un achat rangé sous un N° sans fiche (paire achetée, pas encore sur Vinted) compte aussi.
  for (const [n, v] of Object.entries(obj(achatParNum) || {})) {
    const k = cleNum(n); const achat = centimes(v);
    if (!k || !NUM_OK.test(k) || achat == null) continue;
    const a = parNum[k] || [null, null];
    parNum[k] = [a[0], haut(a[1], achat)];
  }
  const p = obj(physiques);
  // Les paires EN VENTE quelque part (Vinted, Leboncoin, une autre annonce eBay) : la preuve qu'elle est chez lui.
  // `enVente` (publié avec la liste par l'écran Annonces) ; absent ⇒ null (pas su : aucune remise en vente auto).
  const ev = p && Array.isArray(p.enVente) ? p.enVente : null;
  const presents = ev ? [...new Set(ev.map(cleNum).filter((k) => k && NUM_OK.test(k)))].sort() : null;
  return { v: 1, at: maintenant, parNum, presents, presentsAt: ev && Number(p.at) > 0 ? Number(p.at) : null };
}
// Deux publications disent-elles la même chose (sans l'heure) ? L'app ne republie que si quelque chose change, ou après 12 h.
export const memesPlanchers = (a, b) => !!(obj(a) && obj(b)) && JSON.stringify([a.parNum, a.presents]) === JSON.stringify([b.parNum, b.presents]);
// LA LECTURE (côté serveur) : null si la publication peut servir, sinon pourquoi (rien ne bouge).
export function planchersDit(pub, maintenant = Date.now()) {
  const p = obj(pub);
  if (!p || p.v !== 1 || !obj(p.parNum)) return 'absent';
  const at = Number(p.at);
  if (!Number.isFinite(at) || maintenant - at > PLANCHERS_AGE_MAX_MS || at > maintenant + 120000) return 'perime';
  return null;
}
// Le plancher eBay d'un N° (centimes) : la règle `plancherBaisse` (prix mini, sinon achat + 10 %, src/reglesAuto.js),
// remonté de la majoration eBay (arrondi au centime SUPÉRIEUR). null = aucun plancher ⇒ aucun geste automatique.
export function plancherEbay(pub, num, majPct = 0) {
  const p = obj(pub);
  const e = p && obj(p.parNum) ? p.parNum[cleNum(num)] : null;
  if (!Array.isArray(e)) return null;
  const pl = plancherBaisse({ min: e[0] != null ? e[0] / 100 : null, buyPrice: e[1] != null ? e[1] / 100 : null }, null);
  if (!pl || !Number.isInteger(pl.c) || pl.c <= 0) return null;
  const k = dans(MAJORATION_PCT, majPct, 0);
  return { c: k ? Math.ceil(pl.c * (100 + k) / 100) : pl.c, de: pl.de, majoration: k };
}
// La paire est-elle prouvée chez lui (en vente ailleurs) ? true · false · null (pas su).
export function presente(pub, num, maintenant = Date.now()) {
  const p = obj(pub);
  if (!p || !Array.isArray(p.presents)) return null;
  const at = Number(p.presentsAt);
  if (!Number.isFinite(at) || maintenant - at > 48 * 3600000) return null;
  return p.presents.includes(cleNum(num));
}

// ── E6 : UNE LIGNE DE LA MODIFICATION EN MASSE (le récapitulatif ET la route, la même règle) ──
// `op` : 'pct' (−x %) · 'prix' (un nouveau prix) · 'fin' (terminer). `prixC` : le prix lu (centimes) ;
// `plancher` : { c } ou null. Rend { ok, apresC, raison } — sous le plancher ⇒ refusée (jamais remontée en silence).
export function ligneMasse({ op, prixC, valeur, plancher }) {
  if (op === 'fin') return { ok: true, apresC: null };
  if (!Number.isInteger(prixC) || prixC <= 0) return { ok: false, raison: 'prix-pas-lu' };
  let v;
  if (op === 'pct') { const k = Number(valeur); if (!MASSE_PCT.includes(k)) return { ok: false, raison: 'pct' }; v = Math.floor(prixC * (100 - k) / 100); }
  else if (op === 'prix') { v = centimes(valeur); if (v == null) return { ok: false, raison: 'prix' }; }
  else return { ok: false, raison: 'op' };
  if (v < 100) return { ok: false, raison: 'trop-bas', apresC: v };
  if (v === prixC) return { ok: false, raison: 'inchange', apresC: v };
  if (plancher && Number.isInteger(plancher.c) && v < plancher.c) return { ok: false, raison: 'sous-plancher', apresC: v, plancherC: plancher.c };
  return { ok: true, apresC: v };
}

// ── LE JOURNAL (ce qui a été fait en son nom, lu sur la page) ──────────────
export const JOURNAL_MAX = 300;
export const ETATS_JOURNAL = Object.freeze(['fait', 'incertain', 'refuse', 'saute']);
