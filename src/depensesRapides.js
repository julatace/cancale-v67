// ════════════════════════════════════════════════════════════════════════════
//  « + DÉPENSE » EN DEUX TOUCHERS (21 nov., lot transp-depenses). Julien : « saisie rapide des dépenses ».
//  Module PUR (aucune lecture de la base, aucun React) : la forme d'une dépense et l'écriture « lire, fusionner,
//  réécrire » dans la ligne EXISTANTE des charges (`vrm_compta.depenses`, la ligne de Comptabilité, synchronisée).
//  Une seule règle compte ces dépenses : celle de Comptabilité (`comptaChargesMois`, `comptaDepensesJour` dans
//  src/App.jsx) ; ce module ne calcule AUCUN total du bénéfice — il range, modifie, retire.
//    · `nouvelleDepense` : { id, date (AAAA-MM-JJ, aujourd'hui par défaut), libelle (la note, sinon la catégorie), cat
//      (la clé rangée de CATEGORIES_DEPENSE), montant (> 0, 2 décimales) } — refus NOMMÉ sinon, jamais une ligne fausse ;
//    · `appliquer(compta, geste)` : ajouter (en tête), modifier (par id, les seuls champs saisis), retirer (par id) ;
//    · `ecrireDepense({ pret, lire, ecrire }, geste)` : une lecture PAS FAITE (le nuage pas encore arrivé, `pret` faux)
//      ou RATÉE (`lire` lève ou rend autre chose qu'un objet / null) n'écrit RIEN (§5 « Lectures et écritures ») ;
//      sinon la valeur la plus fraîche est relue, le geste y est appliqué, puis écrite.
//  La photo du ticket a SA ligne (`depense_ticket_{id}`, src/depensesTicket.js) ; ici, seulement `ticket: true`.
//  Aucune lecture du ticket (ni IA, ni service distant — §2.9) : il est rangé tel quel.
// ════════════════════════════════════════════════════════════════════════════
import { CATEGORIES_DEPENSE } from './depensesTicket.js';

export const CATS = CATEGORIES_DEPENSE;
const CLES = new Set(CATS.map((c) => c.k));
export const catDe = (k) => CATS.find((c) => c.k === k) || null;
// L'id de libellé d'une clé rangée (une clé d'avant inconnue ⇒ « autre » pour l'affichage, la clé rangée ne change pas).
export const idCat = (k) => (catDe(k) || { id: 'autre' }).id;

// « 12,50 », « 12.5 », « 1 234,56 € » ⇒ 12.5 ; illisible, nul ou négatif ⇒ null.
export function lireMontant(txt) {
  const s = String(txt == null ? '' : txt).replace(/[\s  €]/g, '').replace(',', '.');
  if (!/^\d{1,7}(\.\d{0,2})?$/.test(s)) return null;
  const v = Math.round(Number(s) * 100) / 100;
  return Number.isFinite(v) && v > 0 ? v : null;
}
const JOUR_RE = /^\d{4}-\d{2}-\d{2}$/;
export const jourLocal = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// Rend { ok: true, d } ou { ok: false, raison: 'montant' | 'categorie' | 'date' }.
export function nouvelleDepense({ id, cat, montant, date = '', note = '', ticket = false, maintenant = Date.now() } = {}) {
  const m = typeof montant === 'number' ? (montant > 0 ? Math.round(montant * 100) / 100 : null) : lireMontant(montant);
  if (m == null) return { ok: false, raison: 'montant' };
  if (!CLES.has(cat)) return { ok: false, raison: 'categorie' };
  const j = date ? String(date) : jourLocal(maintenant);
  if (!JOUR_RE.test(j) || j > jourLocal(maintenant)) return { ok: false, raison: 'date' };   // une dépense à venir n'est pas une dépense
  const libelle = String(note || '').trim().slice(0, 80) || cat;
  return { ok: true, d: { id: String(id), date: j, libelle, cat, montant: m, ...(ticket ? { ticket: true } : {}), rapide: true } };
}

// `geste` : { type: 'ajouter', d } · { type: 'modifier', id, champs } · { type: 'retirer', id }. Rend la ligne entière.
export function appliquer(compta, geste) {
  const c = compta && typeof compta === 'object' && !Array.isArray(compta) ? compta : {};
  const L = Array.isArray(c.depenses) ? c.depenses : [];
  if (geste.type === 'ajouter') {
    if (L.some((x) => x && x.id === geste.d.id)) return c;          // rejoué : une dépense n'est comptée qu'une fois
    return { ...c, depenses: [geste.d, ...L] };
  }
  if (geste.type === 'modifier') {
    const ch = {}; for (const k of ['date', 'libelle', 'cat', 'montant', 'ticket']) if (geste.champs && geste.champs[k] !== undefined) ch[k] = geste.champs[k];
    return { ...c, depenses: L.map((x) => (x && x.id === geste.id ? { ...x, ...ch } : x)) };
  }
  if (geste.type === 'retirer') return { ...c, depenses: L.filter((x) => !(x && x.id === geste.id)) };
  return c;
}

// `pret()` : le nuage est arrivé ; `lire()` : la ligne la plus fraîche (objet, ou null = jamais rien noté) — lève si la
// lecture échoue ; `ecrire(v)` : la sauvegarde. Rend { ok, raison?, v? }.
export function ecrireDepense({ pret, lire, ecrire }, geste) {
  if (typeof pret === 'function' && !pret()) return { ok: false, raison: 'pas-lu' };
  let cur;
  try { cur = lire(); } catch (_) { return { ok: false, raison: 'lecture' }; }
  if (cur !== null && (typeof cur !== 'object' || Array.isArray(cur))) return { ok: false, raison: 'lecture' };
  const v = appliquer(cur || {}, geste);
  try { ecrire(v); } catch (_) { return { ok: false, raison: 'ecriture' }; }
  return { ok: true, v };
}

// Les dépenses ponctuelles du mois (AAAA-MM), la plus récente d'abord — la liste montrée sous « + Dépense ».
export function depensesDuMois(compta, ym) {
  const L = compta && Array.isArray(compta.depenses) ? compta.depenses : [];
  return L.filter((x) => x && String(x.date || '').slice(0, 7) === ym).sort((a, b) => (String(b.date) < String(a.date) ? -1 : String(b.date) > String(a.date) ? 1 : 0));
}
