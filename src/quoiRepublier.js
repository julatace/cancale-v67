// ═══════════════════════════════════════════════════════════════════════════
// « QUELLES ANNONCES REPUBLIER ? » (11 nov., lot quoi-republier — demande de Julien)
// ═══════════════════════════════════════════════════════════════════════════
// Une liste qui PROPOSE : les annonces en ligne depuis longtemps ET peu vues ET
// peu mises en favori. Rien n'est fait ici : un toucher les coche dans l'atelier
// Republier (Vinted ou Leboncoin), et c'est LUI qui lance (§3, jamais à l'aveugle).
//
// Une règle, un propriétaire (§5) :
//   · « depuis longtemps » = `articlesQuiDorment` (src/quiDorment.js), au seuil
//     30 / 60 / 90 j ; âge inconnu ⇒ dans aucune liste, compté à part (`sansDate`) ;
//     le tri est le sien (le plus ancien d'abord, à âge égal l'identifiant) ;
//   · un compteur LU = `compteurLu` (src/vendrePlus.js) : un nombre fini ≥ 0, sinon
//     `null` (« pas lu », jamais 0).
// Par-dessus, deux plafonds qu'il règle : « au plus F favoris », « au plus V vues ».
// Trois issues par annonce assez ancienne :
//   · un compteur LU au-dessus de son plafond ⇒ elle marche, pas proposée ;
//   · les deux LUS sous leurs plafonds ⇒ `liste` (proposée) ;
//   · au moins un PAS LU, l'autre (s'il est lu) sous son plafond ⇒ `aVerifier` :
//     « pas su » ne vaut pas « peu » — montrée à part, jamais mêlée à la liste.
// L'identité d'une annonce est SA clé (`cle`, ex. « compte:identifiant »), jamais
// son titre : 50 annonces au même titre restent 50 lignes (audit-quoi-republier).
// Pur, exécuté par scripts/audit-quoi-republier.cjs.
import { articlesQuiDorment, SEUILS_QUI_DORMENT, seuilValide } from './quiDorment.js';
import { compteurLu } from './vendrePlus.js';

export const SEUILS_JOURS = SEUILS_QUI_DORMENT;
export const SEUILS_FAVORIS_MAX = [0, 1, 2, 5];
export const SEUILS_VUES_MAX = [10, 25, 50, 100];
export const REGLAGE_DEFAUT = Object.freeze({ jours: 30, favoris: 1, vues: 25 });
export const CLE_REGLAGE = 'vrm_quoi_republier';

const dans = (liste, v, defaut) => (liste.includes(Number(v)) ? Number(v) : defaut);
// Lecture tolérante : une valeur hors des choix retombe sur le défaut (jamais un seuil inventé).
export function lireReglage(brut) {
  const b = brut && typeof brut === 'object' && !Array.isArray(brut) ? brut : {};
  return {
    jours: b.jours == null ? REGLAGE_DEFAUT.jours : seuilValide(b.jours),
    favoris: dans(SEUILS_FAVORIS_MAX, b.favoris, REGLAGE_DEFAUT.favoris),
    vues: dans(SEUILS_VUES_MAX, b.vues, REGLAGE_DEFAUT.vues),
  };
}

// L'âge en jours depuis une date LUE (texte ISO ou horodatage) ; illisible ⇒ null.
export function ageDepuis(date, maintenant = Date.now()) {
  if (date == null || date === '') return null;
  const t = typeof date === 'number' ? (date < 1e12 ? date * 1000 : date) : Date.parse(String(date));
  if (!Number.isFinite(t) || t > maintenant) return null;
  return Math.floor((maintenant - t) / 86400000);
}

const cleDe = (a) => String(a && (a.cle != null && a.cle !== '' ? a.cle : a.id));

// `annonces` : la base EN LIGNE du site [{ cle?, id, age, vues, favoris, … }] ;
// `null` (pas lue) ⇒ `null` (« — »), jamais une liste vide.
export function quoiRepublier(annonces, reglage) {
  if (!Array.isArray(annonces)) return null;
  const r = lireReglage(reglage);
  const vues = new Set();
  const base = [];
  for (const a of annonces) {
    if (!a || a.id == null || a.id === '') continue;
    const k = cleDe(a);
    if (vues.has(k)) continue;
    vues.add(k);
    base.push({ id: k, age: a.age, a });
  }
  const d = articlesQuiDorment(base, r.jours);
  const liste = [], aVerifier = [];
  let marchent = 0;
  for (const x of d.liste) {
    const a = x.a;
    const f = compteurLu(a.favoris), v = compteurLu(a.vues);
    if ((f != null && f > r.favoris) || (v != null && v > r.vues)) { marchent += 1; continue; }
    const ligne = { ...a, cle: x.id, age: Number(x.age), favoris: f, vues: v };
    if (f == null || v == null) aVerifier.push(ligne); else liste.push(ligne);
  }
  return { total: d.total, sansDate: d.total - d.datesConnues, anciennes: d.n, marchent, n: liste.length, liste, aVerifier, reglage: r };
}

// La raison d'une ligne, en morceaux (l'écran les dit dans sa langue) :
// « 45 j en ligne · 2 favoris · 12 vues ». Un compteur pas lu ⇒ `null`.
export const raisonRepublier = (l) => (l ? { jours: Number(l.age), favoris: compteurLu(l.favoris), vues: compteurLu(l.vues) } : null);

// La ligne de Ma journée : seulement quand la base est lue ET qu'il y a au moins
// une annonce proposée (les « à vérifier » n'y comptent pas : pas su ≠ peu).
export const ligneJourneeRepublier = (res) => (res && res.n > 0 ? { n: res.n, jours: res.reglage.jours } : null);
