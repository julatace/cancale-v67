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
//
// (14 nov., propositions 96 et 97 validées par Julien — `scripts/audit-colis-plus.cjs`)
// ⚠️ 97 · LES FOURNITURES DE CHAQUE COLIS (scotch, papier bulle, étiquettes) : un type
//    « à chaque colis » (`tous: true`) n'est pas un emballage qu'on choisit, il est pris par
//    CHAQUE « Colis fait » daté après son comptage (« Aucun » emballage compris) ; `pour` =
//    combien de colis fait UNE unité (1 rouleau de scotch ≈ 25 colis). Le reste est dit en
//    unités ENTIÈRES (une unité entamée compte comme prise : l'alerte vient AVANT d'en
//    manquer) et en colis possibles. Le seuil reste SON choix ; aucun achat, jamais.
//    « À ton rythme, environ N jours » : seulement si au moins RYTHME_MIN colis sont faits
//    dans les RYTHME_JOURS derniers jours (sinon rien n'est dit) — une mesure, pas une alerte.
// ⚠️ 96 · LE FORMAT RETENU PAR MODÈLE : quand IL choisit l'emballage d'un colis (son clic),
//    le choix est retenu pour ce modèle (`parModele`, le modèle de `modeleSur`, une
//    PROPOSITION — ressemblance permise, §5). Le colis suivant de ce modèle se voit PROPOSER
//    ce format (`propositionFormat`) ; rien n'est posé sans son toucher (« Prendre »), et
//    le décompte suit toujours son choix, sinon le défaut. Le format Vinted (petit, moyen,
//    grand) est celui de l'annonce : il ne change pas ici.
import { centimes } from './beneficePaire.js';

export const CLE_EMBALLAGES = 'vrm_emballages';
export const AUCUN = 'aucun';
export const NOM_MAX = 32;
export const N_MAX = 100000;
export const POUR_MAX = 10000;
export const RYTHME_JOURS = 14;
export const RYTHME_MIN = 3;
const JOUR = 86400000;

const str = (v) => String(v == null ? '' : v).trim();
const entier = (v) => { const s = str(v); return /^\d{1,6}$/.test(s) ? Number(s) : null; };

export function reglageVide() { return { v: 1, types: [], defaut: null, choix: {}, parModele: {} }; }
// Les types qu'on CHOISIT pour un colis (pas ceux « à chaque colis »).
const choisissables = (r) => ({ ...r, types: r.types.filter((t) => !t.tous) });

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
    const tous = t.tous === true;
    const pour = tous && Number.isInteger(t.pour) && t.pour >= 1 && t.pour <= POUR_MAX ? t.pour : 1;
    types.push({ id, nom, cout: str(t.cout), compte: n != null && at != null ? { n, at } : null, seuil: Number.isInteger(t.seuil) && t.seuil >= 0 ? t.seuil : null, ...(tous ? { tous: true, pour } : {}) });
  }
  const parTous = new Set(types.filter((t) => t.tous).map((t) => t.id));
  const choix = {};
  if (x.choix && typeof x.choix === 'object') for (const [k, v] of Object.entries(x.choix)) { const s = str(v); if (s === AUCUN || (vus.has(s) && !parTous.has(s))) choix[k] = s; }
  const parModele = {};
  if (x.parModele && typeof x.parModele === 'object') for (const [k, v] of Object.entries(x.parModele)) {
    const id = v && str(v.id);
    if (k && k.length <= 80 && id && vus.has(id) && !parTous.has(id) && Number.isFinite(v.at)) parModele[k] = { id, at: v.at, nom: str(v.nom).slice(0, 60) };
  }
  const d = str(x.defaut);
  return { v: 1, types, defaut: vus.has(d) && !parTous.has(d) ? d : null, choix, parModele };
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
  const r = choisissables(reglage);
  const c = r.choix[cle];
  if (c === AUCUN) return null;
  if (c && r.types.some((t) => t.id === c)) return c;
  if (r.defaut) return r.defaut;
  return r.types.length === 1 ? r.types[0].id : null;
}

// L'état du stock. Rend { types: [{ …type, utilises, restant, alerte, recompter, coutC }],
// sansType, alertes } — `restant` null = pas compté (« — »).
export function etatEmballages(reglageBrut, faits, maintenant = Date.now()) {
  const r = lireReglage(reglageBrut);
  const F = Array.isArray(faits) ? faits : [];
  const plusVieux = choisissables(r).types.reduce((m, t) => (t.compte ? Math.min(m, t.compte.at) : m), Infinity);
  let sansType = 0;
  const utilises = new Map();
  for (const f of F) {
    const id = typeDuColis(r, f.cle);
    if (id == null) { if (r.choix[f.cle] !== AUCUN && f.at > plusVieux) sansType += 1; continue; }
    const t = r.types.find((x) => x.id === id);
    if (!t || !t.compte || !(f.at > t.compte.at)) continue;
    utilises.set(id, (utilises.get(id) || 0) + 1);
  }
  // (14 nov., 97) Les fournitures « à chaque colis » : chaque « Colis fait » daté après LEUR
  // comptage ; et, pour tous les types, les colis faits ces RYTHME_JOURS derniers jours.
  const colisPris = new Map(), recents = new Map();
  const depuisRythme = maintenant - RYTHME_JOURS * JOUR;
  for (const t of r.types) {
    if (!t.compte) continue;
    const apres = (f) => f.at > t.compte.at && (t.tous || typeDuColis(r, f.cle) === t.id);
    colisPris.set(t.id, t.tous ? F.filter(apres).length : (utilises.get(t.id) || 0));
    recents.set(t.id, F.filter((f) => apres(f) && f.at >= depuisRythme && f.at <= maintenant).length);
  }
  const types = r.types.map((t) => {
    const pour = t.tous ? t.pour : 1;
    const colis = colisPris.get(t.id) || 0;
    if (t.tous) utilises.set(t.id, Math.ceil(colis / pour));
    const u = utilises.get(t.id) || 0;
    const restant = t.compte ? t.compte.n - u : null;
    const coutC = t.cout ? centimes(t.cout) : null;
    const colisPossibles = t.compte ? t.compte.n * pour - colis : null;
    const rec = recents.get(t.id) || 0;
    const fenetre = t.compte ? Math.min(RYTHME_JOURS, Math.max(1, (maintenant - Math.max(t.compte.at, depuisRythme)) / JOUR)) : 0;
    const jours = colisPossibles != null && colisPossibles > 0 && rec >= RYTHME_MIN && fenetre > 0 ? Math.floor(colisPossibles / (rec / fenetre)) : null;
    return { ...t, utilises: u, colis, colisPossibles, jours, restant, recompter: restant != null && restant < 0, alerte: restant != null && t.seuil != null && restant <= t.seuil, coutC };
  });
  return { types, sansType, alertes: types.filter((t) => t.alerte).length, defaut: r.defaut, plusieurs: choisissables(r).types.length > 1 };
}

// ── LES GESTES (sur SON clic) : chacun rend un NOUVEAU réglage, ou { erreur } ──
const nouvelId = (types) => { let i = types.length + 1; while (types.some((t) => t.id === 't' + i)) i += 1; return 't' + i; };

// Ajouter ou modifier un type. `cout` : '' (pas de coût) ou un montant lisible ;
// `n` : ce qu'il vient de compter ('' = ne change pas le comptage) ; `seuil` : '' = aucun.
// (14 nov., 97) `tous` : pris par chaque colis (scotch…) ; `pour` : colis par unité ('' = 1).
export function poserType(reglageBrut, { id = '', nom, cout = '', n = '', seuil = '', tous = false, pour = '' }, maintenant = Date.now()) {
  const r = lireReglage(reglageBrut);
  const N = str(nom).slice(0, NOM_MAX);
  if (!N) return { erreur: 'Donne-lui un nom.' };
  const c = str(cout).replace(/\s*€$/, '');
  if (c && centimes(c) == null) return { erreur: 'Coût illisible : par exemple 0,80.' };
  const nn = str(n) === '' ? undefined : entier(n);
  if (nn === null || (nn != null && nn > N_MAX)) return { erreur: 'Combien en as-tu ? Un nombre entier.' };
  const s = str(seuil) === '' ? null : entier(seuil);
  if (str(seuil) !== '' && s == null) return { erreur: 'Seuil : un nombre entier.' };
  const p = str(pour) === '' ? 1 : entier(pour);
  if (tous && (p == null || p < 1 || p > POUR_MAX)) return { erreur: 'Combien de colis pour une unité ? Un nombre entier.' };
  const avant = id ? r.types.find((t) => t.id === id) : null;
  if (id && !avant) return { erreur: 'Cet emballage n’existe plus.' };
  const t = { id: avant ? avant.id : nouvelId(r.types), nom: N, cout: c ? c.replace('.', ',') : '', compte: nn !== undefined ? { n: nn, at: maintenant } : (avant ? avant.compte : null), seuil: s, ...(tous ? { tous: true, pour: p } : {}) };
  const types = avant ? r.types.map((x) => (x.id === t.id ? t : x)) : [...r.types, t];
  // Une fourniture « à chaque colis » n'est jamais l'emballage par défaut, ni un choix gardé.
  const choix = {}; for (const [k, v] of Object.entries(r.choix)) if (!(tous && v === t.id)) choix[k] = v;
  const parModele = {}; for (const [k, v] of Object.entries(r.parModele || {})) if (!(tous && v.id === t.id)) parModele[k] = v;
  const ch = types.filter((x) => !x.tous);
  const defaut = r.defaut && !(tous && r.defaut === t.id) ? r.defaut : (ch.length === 1 ? ch[0].id : null);
  return { reglage: { ...r, types, choix, parModele, defaut } };
}

export function retirerType(reglageBrut, id) {
  const r = lireReglage(reglageBrut);
  const types = r.types.filter((t) => t.id !== id);
  const choix = {}; for (const [k, v] of Object.entries(r.choix)) if (v !== id) choix[k] = v;
  const parModele = {}; for (const [k, v] of Object.entries(r.parModele || {})) if (v.id !== id) parModele[k] = v;
  return { reglage: { ...r, types, choix, parModele, defaut: r.defaut === id ? null : r.defaut } };
}

export function poserDefaut(reglageBrut, id) {
  const r = lireReglage(reglageBrut);
  return { reglage: { ...r, defaut: r.types.some((t) => t.id === id && !t.tous) ? id : null } };
}

// Le choix d'emballage d'UN colis (facultatif) : un id, AUCUN, ou '' pour revenir au défaut.
// (14 nov., 96) `modele` ({ cle, nom } de `modeleSur`) : SON choix est retenu pour ce modèle
// (un vrai type seulement — « Aucun » ne retient rien) ; `retenu` : l'id à retenir quand le
// choix « revient au défaut » (l'id posé vaut alors '').
export function choisirPourColis(reglageBrut, cle, id, { modele = null, retenu = '', maintenant = Date.now() } = {}) {
  const r = lireReglage(reglageBrut);
  const ch = choisissables(r);
  const choix = { ...r.choix };
  if (!id) delete choix[cle];
  else if (id === AUCUN || ch.types.some((t) => t.id === id)) choix[cle] = id;
  const parModele = { ...(r.parModele || {}) };
  const garde = retenu || id;
  if (modele && modele.cle && garde && garde !== AUCUN && ch.types.some((t) => t.id === garde)) parModele[modele.cle] = { id: garde, at: maintenant, nom: str(modele.nom).slice(0, 60) };
  return { reglage: { ...r, choix, parModele } };
}

// (14 nov., 96) Ce que VRM PROPOSE pour un colis : le format qu'il a retenu la dernière fois
// pour ce modèle — seulement s'il n'a encore rien choisi pour CE colis et que la proposition
// diffère de ce qui serait décompté. Rend { id, nom, modele, at } ou null. N'écrit rien.
export function propositionFormat(reglageBrut, cle, modele) {
  const r = lireReglage(reglageBrut);
  if (!modele || !modele.cle || !cle || r.choix[cle]) return null;
  const m = r.parModele[modele.cle];
  const t = m && r.types.find((x) => x.id === m.id && !x.tous);
  if (!t || typeDuColis(r, cle) === t.id) return null;
  return { id: t.id, nom: t.nom, modele: m.nom || modele.nom || '', at: m.at };
}
// Le format retenu pour ce modèle est-il celui qui sera décompté pour ce colis ?
export function commeDerniereFois(reglageBrut, cle, modele) {
  const r = lireReglage(reglageBrut);
  const m = modele && modele.cle ? r.parModele[modele.cle] : null;
  return !!(m && cle && typeDuColis(r, cle) === m.id);
}

// Les emballages à coût, proposés dans le champ « Emballage » d'une vente (son clic remplit).
export function emballagesAvecCout(reglageBrut) {
  return lireReglage(reglageBrut).types.filter((t) => !t.tous && t.cout && centimes(t.cout) != null).map((t) => ({ id: t.id, nom: t.nom, cout: t.cout }));
}
