// ════════════════════════════════════════════════════════════════════════════
//  L'ASSISTANT DE RANGEMENT — LE PLAN (28 nov. 2026, lot agent-rangement)
//  Julien : « je veux un vrai agent IA qui pose des questions, totalement intelligent, qui adapte les étages, les pièces
//  de rangement, etc. ». Récit : docs/passation/2026-11-28-agent-rangement.md.
//
//  Module PUR (aucun accès au navigateur ni à la base). Les deux moteurs de l'assistant (src/rangement/entretien.js, l'assistant
//  guidé ; src/rangement/moteurIA.js, l'IA du navigateur — aucune clé) rendent LE MÊME plan JSON, et ce module le VALIDE avant tout
//  affichage et tout enregistrement — une réponse de modèle qui ne passe pas `validerPlan` n'est jamais montrée.
//
//  LE FORMAT (strict : toute clé inconnue, tout type faux, toute borne dépassée ⇒ refus, avec la raison) :
//    { version: 1,
//      pieces: [ { nom: '1–40 car.', meubles: [ { ref: id d'un meuble EXISTANT | null, nom: '1–40 car.',
//                  type: 'etagere'|'armoire'|'casier'|'pile'|'bac', etages: 1–50, casesParEtage: 1–30,
//                  porte?: bool } ] } ],               // 1–12 pièces, 0–30 meubles par pièce, 60 au total
//      retirer?: [ id d'un meuble existant ],           // retiré SEULEMENT s'il est nommé ici
//      etiquetage?: null | { qui: 'vrm'|'moi', serie?: 'chiffres'|'lettre', lettre?: 'A–Z (1–3)' } }
//  Une case = une boîte (un carton, un N°) : un « étage » est une rangée du meuble (`rows`), « cases par étage » ses
//  colonnes (`cols`) — le modèle d'hier (src/stockEtageres.js), rien de renommé.
//
//  LA DONNÉE : `vrm_meubles` (la même clé, la même forme), chaque meuble AUGMENTÉ de deux champs facultatifs :
//    piece?: nom de sa pièce · porte?: true (près de la porte : ses cases sont proposées en premier).
//  L'ancienne forme est la nouvelle sans ces champs (aucune migration, aucun drapeau du navigateur). `vrm_slots` ne
//  change pas de forme.
//
//  ⚠️⚠️ CLAUDE.md §5 — UN N° N'EST JAMAIS CHANGÉ NI RÉATTRIBUÉ. `appliquerPlan` ne touche QUE l'emplacement (m, i)
//  d'une clé de `vrm_slots` ; il n'en crée aucune, n'en renomme aucune. Une paire garde sa case (même rangée, même
//  colonne) quand son meuble change de taille ; si sa case disparaît (meuble rétréci ou retiré), un DÉPLACEMENT lui est
//  PROPOSÉ vers une case libre (les règles de src/ouRanger.js, piles comprises) ; s'il n'y a plus de place, elle repart
//  « à ranger » (sa case est libérée, son N° reste le même) — et c'est DIT avant la validation. Rien n'est écrit ici.
// ════════════════════════════════════════════════════════════════════════════
import { TYPES, COLS_MAX, RANGEES_MAX, tasserPiles, typeDe } from '../stockEtageres.js';
import { casesProposees } from '../ouRanger.js';
import { planchesCases, planchesRangees } from '../stockRegles.js';

export const VERSION_PLAN = 1;
export const PIECES_MAX = 12;
export const MEUBLES_PAR_PIECE_MAX = 30;
export const MEUBLES_MAX = 60;
export const NOM_MAX = 40;
export const TYPES_PLAN = Object.freeze(['etagere', 'armoire', 'casier', 'pile', 'bac']);
// Les couleurs données aux NOUVEAUX meubles, une par pièce (les couleurs du dessin, src/etageres/reglages.js).
export const COULEURS_PIECES = Object.freeze(['ciel', 'sauge', 'sable', 'ardoise']);
// Au-delà, une pile de boîtes ne tient plus debout : c'est signalé (pas refusé).
export const PILE_HAUTE = 12;

const estObjet = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
const entierDans = (v, min, max) => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const nomPropre = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
const cles = (o, permises) => Object.keys(o).filter((k) => !permises.includes(k));

// ── LA VALIDATION ─────────────────────────────────────────────────────────────
// `existants` : les meubles d'aujourd'hui (`vrm_meubles`, lus). Rend { ok: true, plan } (le plan NORMALISÉ : noms
// propres, `porte` booléen, `retirer` sans doublon) ou { ok: false, erreurs: ['code:détail', …] }.
export function validerPlan(brut, { existants = [] } = {}) {
  const err = [];
  const ids = new Set((Array.isArray(existants) ? existants : []).filter((m) => m && m.id != null).map((m) => String(m.id)));
  if (!estObjet(brut)) return { ok: false, erreurs: ['forme:plan'] };
  for (const k of cles(brut, ['version', 'pieces', 'retirer', 'etiquetage'])) err.push('cle:' + k);
  if (brut.version !== VERSION_PLAN) err.push('version');
  if (!Array.isArray(brut.pieces) || brut.pieces.length < 1 || brut.pieces.length > PIECES_MAX) err.push('pieces:nombre');
  const refsVues = new Set(), nomsPieces = new Set();
  let total = 0;
  const pieces = [];
  (Array.isArray(brut.pieces) ? brut.pieces : []).forEach((p, a) => {
    if (!estObjet(p)) { err.push(`piece:${a}:forme`); return; }
    for (const k of cles(p, ['nom', 'meubles'])) err.push(`piece:${a}:cle:${k}`);
    const nom = nomPropre(p.nom);
    if (!nom || nom.length > NOM_MAX) err.push(`piece:${a}:nom`);
    else if (nomsPieces.has(nom.toLowerCase())) err.push(`piece:${a}:double`);
    else nomsPieces.add(nom.toLowerCase());
    if (!Array.isArray(p.meubles) || p.meubles.length > MEUBLES_PAR_PIECE_MAX) { err.push(`piece:${a}:meubles`); return; }
    const meubles = [];
    p.meubles.forEach((m, b) => {
      const ici = `meuble:${a}.${b}`;
      if (!estObjet(m)) { err.push(ici + ':forme'); return; }
      for (const k of cles(m, ['ref', 'nom', 'type', 'etages', 'casesParEtage', 'porte'])) err.push(`${ici}:cle:${k}`);
      const n = nomPropre(m.nom);
      if (!n || n.length > NOM_MAX) err.push(ici + ':nom');
      if (!TYPES_PLAN.includes(m.type)) err.push(ici + ':type');
      if (!entierDans(m.etages, 1, RANGEES_MAX)) err.push(ici + ':etages');
      if (!entierDans(m.casesParEtage, 1, COLS_MAX)) err.push(ici + ':cases');
      if (m.porte !== undefined && typeof m.porte !== 'boolean') err.push(ici + ':porte');
      let ref = null;
      if (m.ref !== undefined && m.ref !== null) {
        if (typeof m.ref !== 'string' || !ids.has(m.ref)) err.push(ici + ':ref');
        else if (refsVues.has(m.ref)) err.push(ici + ':refDouble');
        else { ref = m.ref; refsVues.add(m.ref); }
      }
      total++;
      meubles.push({ ref, nom: n, type: m.type, etages: m.etages, casesParEtage: m.casesParEtage, porte: m.porte === true });
    });
    pieces.push({ nom, meubles });
  });
  if (total > MEUBLES_MAX) err.push('meubles:total');
  let retirer = [];
  if (brut.retirer !== undefined) {
    if (!Array.isArray(brut.retirer)) err.push('retirer:forme');
    else for (const r of brut.retirer) {
      if (typeof r !== 'string' || !ids.has(r)) err.push('retirer:ref');
      else if (refsVues.has(r)) err.push('retirer:garde');   // le même meuble gardé ET retiré
      else if (!retirer.includes(r)) retirer.push(r);
    }
  }
  let etiquetage = null;
  if (brut.etiquetage !== undefined && brut.etiquetage !== null) {
    const e = brut.etiquetage;
    if (!estObjet(e)) err.push('etiquetage:forme');
    else {
      for (const k of cles(e, ['qui', 'serie', 'lettre'])) err.push('etiquetage:cle:' + k);
      if (!['vrm', 'moi'].includes(e.qui)) err.push('etiquetage:qui');
      if (e.serie !== undefined && !['chiffres', 'lettre'].includes(e.serie)) err.push('etiquetage:serie');
      const lettre = typeof e.lettre === 'string' ? e.lettre.toUpperCase().replace(/[^A-Z]/g, '') : '';
      if (e.lettre !== undefined && (typeof e.lettre !== 'string' || !/^[A-Za-z]{1,3}$/.test(e.lettre.trim()))) err.push('etiquetage:lettre');
      if (e.serie === 'lettre' && !lettre) err.push('etiquetage:lettreVide');
      etiquetage = { qui: e.qui, ...(e.serie ? { serie: e.serie } : {}), ...(e.serie === 'lettre' ? { lettre } : {}) };
    }
  }
  if (err.length) return { ok: false, erreurs: err };
  return { ok: true, plan: { version: VERSION_PLAN, pieces, retirer, etiquetage } };
}

// ── LE PLAN D'AUJOURD'HUI, lu depuis les meubles ─────────────────────────────
// Le point de départ d'une modification : chaque meuble existant à sa place (`ref`), groupé par sa pièce (sans pièce :
// `pieceParDefaut`). Les meubles gardent l'ordre de la pièce (`ordre`, puis la liste).
export function planDepuisMeubles(meubles, { pieceParDefaut = 'Pièce' } = {}) {
  const liste = (Array.isArray(meubles) ? meubles : []).filter((m) => m && m.id != null)
    .map((m, k) => ({ m, k, o: Number.isFinite(Number(m.ordre)) && m.ordre !== null ? Number(m.ordre) : k }))
    .sort((a, b) => a.o - b.o || a.k - b.k).map((x) => x.m);
  const parNom = new Map();
  for (const m of liste) {
    const p = nomPropre(m.piece) || pieceParDefaut;
    if (!parNom.has(p.toLowerCase())) parNom.set(p.toLowerCase(), { nom: p.slice(0, NOM_MAX), meubles: [] });
    parNom.get(p.toLowerCase()).meubles.push({ ref: String(m.id), nom: (nomPropre(m.name) || 'Meuble').slice(0, NOM_MAX), type: typeDe(m),
      etages: Math.max(1, Math.min(RANGEES_MAX, Math.floor(Number(m.rows)) || 1)), casesParEtage: Math.max(1, Math.min(COLS_MAX, Math.floor(Number(m.cols)) || 1)), porte: m.porte === true });
  }
  return { version: VERSION_PLAN, pieces: [...parNom.values()], retirer: [], etiquetage: null };
}

// ── LES COMPTES ──────────────────────────────────────────────────────────────
export const placesMeuble = (m) => (m ? m.etages * m.casesParEtage : 0);
export function capacite(plan) {
  let places = 0, meubles = 0;
  for (const p of (plan && plan.pieces) || []) for (const m of p.meubles) { places += placesMeuble(m); meubles++; }
  return { places, meubles, pieces: ((plan && plan.pieces) || []).length };
}
// Les cases prises de chaque meuble existant (`vrm_slots` : toute entrée compte, montrée ou non).
export function occupation(slots) {
  const out = new Map();
  if (!estObjet(slots)) return out;
  for (const k of Object.keys(slots)) { const s = slots[k]; if (s && s.m != null && Number.isInteger(Number(s.i))) out.set(String(s.m), (out.get(String(s.m)) || 0) + 1); }
  return out;
}

// ── LES INCOHÉRENCES (dites, jamais corrigées en silence) ─────────────────────
// `articles` : le nombre d'articles à loger (rangés + à ranger), `null` = pas su (rien n'est dit sur le manque).
// Rend [{ k, … }] : 'manque' (plus d'articles que de places), 'pieceVide', 'pileHaute', 'aucunePorte' n'est pas une faute.
export function incoherences(plan, { articles = null } = {}) {
  const out = [];
  if (!plan || !Array.isArray(plan.pieces)) return out;
  const { places } = capacite(plan);
  if (Number.isFinite(articles) && articles > places) out.push({ k: 'manque', n: articles - places, places, articles });
  plan.pieces.forEach((p) => { if (!p.meubles.length) out.push({ k: 'pieceVide', piece: p.nom }); });
  plan.pieces.forEach((p) => p.meubles.forEach((m) => { if (m.type === 'pile' && m.etages > PILE_HAUTE) out.push({ k: 'pileHaute', meuble: m.nom, n: m.etages }); }));
  return out;
}

// ── APPLIQUER (calculer, jamais écrire) ──────────────────────────────────────
// Rend { meubles, slots, deplacements: [{ cle, de: {m,i}, vers: {m,i} }], aRanger: [{ cle, de }], gardes, nouveaux,
// retires, changes } — l'appelant (src/ecrans/Stock.jsx) ne l'écrit qu'après SA validation, par les écritures
// d'hier (`vrm_meubles`, `vrm_slots` : lire-fusionner-réécrire, comparer-et-échanger de `cloudPush`).
// `idNeuf(k)` : l'identifiant d'un nouveau meuble (l'appelant : 'm' + horodatage ; les audits : déterministe).
// Les meubles existants absents du plan ET de `retirer` sont GARDÉS tels quels (une réponse incomplète ne supprime rien).
export function appliquerPlan({ meubles, slots, plan, idNeuf = (k) => 'm' + Date.now().toString(36) + k } = {}) {
  if (!Array.isArray(meubles) || !estObjet(slots) || !plan || !Array.isArray(plan.pieces)) return null;   // pas su ⇒ rien
  const parId = new Map(meubles.filter((m) => m && m.id != null).map((m) => [String(m.id), m]));
  const retires = new Set((plan.retirer || []).map(String).filter((r) => parId.has(r)));
  const planifies = [];   // dans l'ordre du plan : d'abord ceux près de la porte
  plan.pieces.forEach((p, a) => p.meubles.forEach((x, b) => planifies.push({ x, piece: p.nom, a, b })));
  const ordreDe = (e) => (e.x.porte ? 0 : 1);
  planifies.sort((u, v) => ordreDe(u) - ordreDe(v) || u.a - v.a || u.b - v.b);
  const mentionnes = new Set(planifies.filter((e) => e.x.ref).map((e) => String(e.x.ref)));
  const sortie = [];
  let neuf = 0;
  const changes = [], nouveaux = [];
  for (const e of planifies) {
    const { x } = e;
    const cols = x.casesParEtage, rows = x.etages;
    if (x.ref && parId.has(String(x.ref))) {
      const ancien = parId.get(String(x.ref));
      const memeTaille = Number(ancien.cols) === cols && Number(ancien.rows) === rows;
      const m = { ...ancien, name: x.nom, cols, rows, type: x.type, piece: e.piece, ...(x.porte ? { porte: true } : {}) };
      if (!x.porte) delete m.porte;
      if (!memeTaille && ancien.planches !== undefined) m.planches = planchesRangees(planchesCases(ancien.planches, cols, rows), cols, rows);
      if (x.type === 'pile') m.gravite = true;
      else if (typeDe(ancien) === 'pile' && x.type !== 'pile') m.gravite = false;
      m.ordre = sortie.length;
      if (JSON.stringify({ ...ancien, ordre: null }) !== JSON.stringify({ ...m, ordre: null })) changes.push(String(ancien.id));
      sortie.push(m);
    } else {
      const id = String(idNeuf(neuf++));
      const m = { id, name: x.nom, cols, rows, type: x.type, gravite: x.type === 'pile' || TYPES[x.type].pile === true, couleur: COULEURS_PIECES[e.a % COULEURS_PIECES.length],
        piece: e.piece, ...(x.porte ? { porte: true } : {}), ordre: sortie.length };
      nouveaux.push(id);
      sortie.push(m);
    }
  }
  // Les meubles ni planifiés ni retirés : gardés, à la suite (leur forme d'hier, intacte).
  const gardes = [];
  for (const m of meubles) {
    if (!m || m.id == null) continue;
    const id = String(m.id);
    if (mentionnes.has(id) || retires.has(id)) continue;
    gardes.push(id); sortie.push({ ...m, ordre: sortie.length });
  }
  // Les cases : la même rangée, la même colonne ; hors du meuble (rétréci, retiré) ⇒ à reloger.
  const final = new Map(sortie.map((m) => [String(m.id), m]));
  const anc = (id) => parId.get(id);
  let out = {};
  const reloger = [];
  for (const k of Object.keys(slots)) {
    const s = slots[k];
    if (!s || s.m == null) { out[k] = s; continue; }
    const id = String(s.m), i = Number(s.i);
    if (!anc(id)) { out[k] = s; continue; }   // un meuble inconnu d'hier : on n'y touche pas
    if (retires.has(id)) { reloger.push(k); continue; }
    const a = anc(id), f = final.get(id);
    const oc = Math.max(1, Number(a.cols) || 1);
    const r = Math.floor(i / oc), c = i % oc;
    if (r >= f.rows || c >= f.cols) { reloger.push(k); continue; }
    out[k] = { ...s, i: r * f.cols + c };
  }
  // Les piles d'abord tassées (ce qui reste), puis chaque carton à reloger reçoit SA case libre (jamais la même à deux).
  out = tasserPiles(out, sortie).slots;
  const ordreReloger = reloger.slice().sort((u, v) => String(u).localeCompare(String(v), 'fr', { numeric: true }));
  const prop = casesProposees({ meubles: sortie, slots: out, cles: ordreReloger }) || {};
  const deplacements = [], aRanger = [];
  for (const k of ordreReloger) {
    const c = prop[k];
    if (c) { out[k] = { ...slots[k], m: c.meubleId, i: c.i }; deplacements.push({ cle: k, de: { m: String(slots[k].m), i: Number(slots[k].i) }, vers: { m: c.meubleId, i: c.i } }); }
    else aRanger.push({ cle: k, de: { m: String(slots[k].m), i: Number(slots[k].i) } });
  }
  out = tasserPiles(out, sortie).slots;
  // Une paire restée dans sa case mais tombée d'un cran (pile) est aussi un déplacement : il est dit.
  for (const k of Object.keys(out)) {
    if (deplacements.some((d) => d.cle === k)) continue;
    const s0 = slots[k], s1 = out[k];
    if (!s0 || !s1 || !anc(String(s0.m))) continue;
    const a = anc(String(s0.m)), f = final.get(String(s1.m));
    const oc = Math.max(1, Number(a.cols) || 1);
    const memePlace = String(s0.m) === String(s1.m) && Math.floor(Number(s0.i) / oc) === Math.floor(Number(s1.i) / f.cols) && (Number(s0.i) % oc) === (Number(s1.i) % f.cols);
    if (!memePlace) deplacements.push({ cle: k, de: { m: String(s0.m), i: Number(s0.i) }, vers: { m: String(s1.m), i: Number(s1.i) } });
  }
  return { meubles: sortie, slots: out, deplacements, aRanger, gardes, nouveaux, retires: [...retires], changes };
}

// La place d'un index de case : « rangée r, colonne c » (1 = en haut / à gauche), comme le Stock.
export const placeDe = (i, m) => { const cols = Math.max(1, Number(m && m.cols) || 1); return { rangee: Math.floor(i / cols) + 1, colonne: (i % cols) + 1 }; };
