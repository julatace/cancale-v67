// ── LE STOCK D'EMBALLAGES (10 nov. 2026, lot L — validé par Julien) ───────────
// Il saisit SES cartons, sacs, boîtes : un nom, combien il en a COMPTÉ (et quand),
// le coût d'un emballage (facultatif), un seuil « préviens-moi à partir de N ».
// Chaque « Colis fait » (Vinted, Leboncoin, Vestiaire) en décompte un.
//
// ⚠️ LE RESTE EST DÉRIVÉ, JAMAIS DÉCRÉMENTÉ À LA MAIN :
//    restant = compté − les « Colis fait » DATÉS APRÈS le comptage, de ce type.
//    Les « Colis fait » sont ceux que l'app range déjà (`vinted_ship_done`,
//    `vrm_lbc_colis_done`, `vrm_vc_colis_done` : { clé: ms }) — un « Annuler » ou un
//    « Pas encore déposé » rend l'emballage tout seul ; deux appareils comptent pareil.
//    Un colis eBay n'a pas de « Colis fait » (le dépôt se suit dans eBay) : pas décompté, dit.
// ⚠️ LE TYPE D'UN COLIS : SON choix s'il l'a fait (`choix[clé]`, facultatif, « aucun »
//    possible), sinon le type par défaut, sinon le seul type s'il n'y en a qu'un. Plusieurs
//    types sans défaut ni choix ⇒ le colis n'est décompté NULLE PART et c'est compté à part
//    (« N colis sans emballage choisi ») — jamais réparti au hasard.
// ⚠️ PAS COMPTÉ ≠ 0 : un type jamais compté a un reste `null` (« — »), jamais 0.
// ⚠️ LE COÛT ne va dans une vente QUE sur son clic (le champ « Emballage » de la vente,
//    `SaisieEmballage`) : jamais posé tout seul, jamais un 0 deviné.
// ⚠️ ALERTE AMBRE (un geste : en racheter) quand le reste est au seuil ou dessous —
//    jamais rouge (§7 : le rouge est pour deux paires sous un N°).
//
// La donnée (`vrm_emballages`, synchronisée, écrite sur SON clic seulement) :
//   { v: 1, types: [{ id, nom, cout, compte: { n, at } | null, seuil }], defaut, choix: { [clé colis]: id | 'aucun' } }
// Clés de colis : 'v:' + n° de transaction Vinted · 'lbc:' + n° Leboncoin · 'vc:' + id Vestiaire
// (les mêmes que les cartes de Colis).
//
// Module PUR : App.jsx, src/EmballagesCarte.jsx et scripts/audit-calculette-emballages.cjs.
import { centimes } from './beneficePaire.js';

export const CLE_EMBALLAGES = 'vrm_emballages';
export const AUCUN = 'aucun';
export const NOM_MAX = 32;
export const N_MAX = 100000;

const str = (v) => String(v == null ? '' : v).trim();
const entier = (v) => { const s = str(v); return /^\d{1,6}$/.test(s) ? Number(s) : null; };

export function reglageVide() { return { v: 1, types: [], defaut: null, choix: {} }; }

// Une donnée lue (ou n'importe quoi) ⇒ un réglage propre. Ce qui ne se lit pas est écarté.
export function lireReglage(x) {
  if (!x || typeof x !== 'object' || x.v !== 1 || !Array.isArray(x.types)) return reglageVide();
  const types = [];
  const vus = new Set();
  for (const t of x.types) {
    if (!t || typeof t !== 'object') continue;
    const id = str(t.id), nom = str(t.nom).slice(0, NOM_MAX);
    if (!id || !nom || vus.has(id)) continue;
    vus.add(id);
    const n = t.compte && Number.isInteger(t.compte.n) && t.compte.n >= 0 && t.compte.n <= N_MAX ? t.compte.n : null;
    const at = t.compte && Number.isFinite(t.compte.at) ? t.compte.at : null;
    types.push({ id, nom, cout: str(t.cout), compte: n != null && at != null ? { n, at } : null, seuil: Number.isInteger(t.seuil) && t.seuil >= 0 ? t.seuil : null });
  }
  const choix = {};
  if (x.choix && typeof x.choix === 'object') for (const [k, v] of Object.entries(x.choix)) { const s = str(v); if (s === AUCUN || vus.has(s)) choix[k] = s; }
  return { v: 1, types, defaut: vus.has(str(x.defaut)) ? str(x.defaut) : null, choix };
}

// Les « Colis fait » datés, toutes plateformes : [{ cle, at }]. Une valeur sans date
// (ancienne coche, `1`) n'est pas un « Colis fait » daté : elle n'est pas décomptée.
export function colisFaits({ vinted, leboncoin, vestiaire } = {}) {
  const out = [];
  const lire = (m, pre) => { if (m && typeof m === 'object') for (const [k, v] of Object.entries(m)) { const t = Number(v); if (k && Number.isFinite(t) && t > 1e12) out.push({ cle: pre + k, at: t }); } };
  lire(vinted, 'v:'); lire(leboncoin, 'lbc:'); lire(vestiaire, 'vc:');
  return out;
}

// Le type d'emballage d'un colis (id | null).
export function typeDuColis(reglage, cle) {
  const r = reglage;
  const c = r.choix[cle];
  if (c === AUCUN) return null;
  if (c && r.types.some((t) => t.id === c)) return c;
  if (r.defaut) return r.defaut;
  return r.types.length === 1 ? r.types[0].id : null;
}

// L'état du stock. Rend { types: [{ …type, utilises, restant, alerte, recompter, coutC }],
// sansType, alertes } — `restant` null = pas compté (« — »).
export function etatEmballages(reglageBrut, faits) {
  const r = lireReglage(reglageBrut);
  const F = Array.isArray(faits) ? faits : [];
  const plusVieux = r.types.reduce((m, t) => (t.compte ? Math.min(m, t.compte.at) : m), Infinity);
  let sansType = 0;
  const utilises = new Map();
  for (const f of F) {
    const id = typeDuColis(r, f.cle);
    if (id == null) { if (r.choix[f.cle] !== AUCUN && f.at > plusVieux) sansType += 1; continue; }
    const t = r.types.find((x) => x.id === id);
    if (!t || !t.compte || !(f.at > t.compte.at)) continue;
    utilises.set(id, (utilises.get(id) || 0) + 1);
  }
  const types = r.types.map((t) => {
    const u = utilises.get(t.id) || 0;
    const restant = t.compte ? t.compte.n - u : null;
    const coutC = t.cout ? centimes(t.cout) : null;
    return { ...t, utilises: u, restant, recompter: restant != null && restant < 0, alerte: restant != null && t.seuil != null && restant <= t.seuil, coutC };
  });
  return { types, sansType, alertes: types.filter((t) => t.alerte).length, defaut: r.defaut, plusieurs: r.types.length > 1 };
}

// ── LES GESTES (sur SON clic) : chacun rend un NOUVEAU réglage, ou { erreur } ──
const nouvelId = (types) => { let i = types.length + 1; while (types.some((t) => t.id === 't' + i)) i += 1; return 't' + i; };

// Ajouter ou modifier un type. `cout` : '' (pas de coût) ou un montant lisible ;
// `n` : ce qu'il vient de compter ('' = ne change pas le comptage) ; `seuil` : '' = aucun.
export function poserType(reglageBrut, { id = '', nom, cout = '', n = '', seuil = '' }, maintenant = Date.now()) {
  const r = lireReglage(reglageBrut);
  const N = str(nom).slice(0, NOM_MAX);
  if (!N) return { erreur: 'Donne-lui un nom.' };
  const c = str(cout).replace(/\s*€$/, '');
  if (c && centimes(c) == null) return { erreur: 'Coût illisible : par exemple 0,80.' };
  const nn = str(n) === '' ? undefined : entier(n);
  if (nn === null || (nn != null && nn > N_MAX)) return { erreur: 'Combien en as-tu ? Un nombre entier.' };
  const s = str(seuil) === '' ? null : entier(seuil);
  if (str(seuil) !== '' && s == null) return { erreur: 'Seuil : un nombre entier.' };
  const avant = id ? r.types.find((t) => t.id === id) : null;
  if (id && !avant) return { erreur: 'Cet emballage n’existe plus.' };
  const t = { id: avant ? avant.id : nouvelId(r.types), nom: N, cout: c ? c.replace('.', ',') : '', compte: nn !== undefined ? { n: nn, at: maintenant } : (avant ? avant.compte : null), seuil: s };
  const types = avant ? r.types.map((x) => (x.id === t.id ? t : x)) : [...r.types, t];
  return { reglage: { ...r, types, defaut: r.defaut || (types.length === 1 ? t.id : r.defaut) } };
}

export function retirerType(reglageBrut, id) {
  const r = lireReglage(reglageBrut);
  const types = r.types.filter((t) => t.id !== id);
  const choix = {}; for (const [k, v] of Object.entries(r.choix)) if (v !== id) choix[k] = v;
  return { reglage: { ...r, types, choix, defaut: r.defaut === id ? null : r.defaut } };
}

export function poserDefaut(reglageBrut, id) {
  const r = lireReglage(reglageBrut);
  return { reglage: { ...r, defaut: r.types.some((t) => t.id === id) ? id : null } };
}

// Le choix d'emballage d'UN colis (facultatif) : un id, AUCUN, ou '' pour revenir au défaut.
export function choisirPourColis(reglageBrut, cle, id) {
  const r = lireReglage(reglageBrut);
  const choix = { ...r.choix };
  if (!id) delete choix[cle];
  else if (id === AUCUN || r.types.some((t) => t.id === id)) choix[cle] = id;
  return { reglage: { ...r, choix } };
}

// Les emballages à coût, proposés dans le champ « Emballage » d'une vente (son clic remplit).
export function emballagesAvecCout(reglageBrut) {
  return lireReglage(reglageBrut).types.filter((t) => t.cout && centimes(t.cout) != null).map((t) => ({ id: t.id, nom: t.nom, cout: t.cout }));
}
