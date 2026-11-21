// ════════════════════════════════════════════════════════════════════════════
//  LA CORBEILLE 30 JOURS (10 nov. 2026, lot Y — proposition 38, validée)
// ════════════════════════════════════════════════════════════════════════════
// Ce qu'il supprime DANS VRM (un achat hors plateforme, une dépense, un
// fournisseur, une note, une fiche saisie à la main, une réponse rapide, un
// modèle…) part ici et se RESTAURE d'un toucher pendant 30 jours ; ensuite il
// est réellement effacé. La pilule « Annuler » 5 s (lot B) reste : la corbeille
// est le filet d'après.
//
// Ne passe JAMAIS par ici :
//   · une suppression SUR UN SITE (Vinted, Leboncoin, eBay, Vestiaire) : elle
//     est irréversible et garde sa confirmation (§3) ;
//   · un numéro de rangement : il n'est jamais rendu (§5, pool append-only) —
//     restaurer une fiche lui rend son MÊME N°, qu'aucune autre n'a reçu ;
//   · une facture émise : une facture ne se supprime jamais (un avoir l'annule).
//
// UNE règle pour toutes les suppressions de l'app (§11). Une entrée garde, pour
// chaque clé touchée, un MORCEAU = la sous-valeur d'avant et celle d'après :
//   { k, type, id, sous?, idCle?, index?, defaut?, avant, apres }
//   type 'cle'     : (valeur[sous] ?? valeur)[id]                 — une clé d'objet ;
//   type 'element' : un élément de la liste (valeur[sous] ?? valeur),
//                    reconnu par `x[idCle] === id` (ou, sans idCle, par la
//                    valeur EXACTE : une réponse rapide) — jamais par ressemblance ;
//   type 'champs'  : des champs de la fiche `id` (objet par clé, ou élément de
//                    liste par `idCle`) ; jamais une fiche créée.
// Chaque morceau ne s'applique QUE si la valeur courante est encore celle de
// départ : une restauration ne réécrit jamais ce qui a changé depuis (un prix
// retapé, un élément revenu par un autre appareil) — ce morceau est « gardé »
// et compté (`ignores`). Rejouer un morceau ne change rien de plus (idempotent).
//
// La corbeille elle-même est une carte `{ [id d'entrée]: entrée }` rangée dans
// la ligne `main` (clé synchronisée `vrm_corbeille`) : elle se fusionne entrée
// par entrée entre appareils (src/fusionNuage.js), sous le comparer-et-échanger
// de `data.rev` de `cloudPush`. Une lecture ratée n'écrit RIEN (`ecrireMorceaux`).
//
// Module PUR : aucun stockage, aucune horloge implicite. Exécuté tel quel par
// scripts/audit-corbeille.cjs ; branché dans src/App.jsx (`gesteCorbeille`).
// ════════════════════════════════════════════════════════════════════════════

export const CLE_CORBEILLE = 'vrm_corbeille';
export const DUREE_CORBEILLE_J = 30;
// Bornée : la ligne `main` ne grossit pas sans fin (§4.4). Au-delà, les plus
// anciennes sortent par la même purge (leurs lignes annexes vidées pareil).
export const MAX_CORBEILLE = 300;
const JOUR = 86400e3;

// Les lignes annexes qu'une purge peut vider (une photo, un ticket) : rien d'autre.
export const PREFIXES_ANNEXES = ['achat_hors_photo_', 'depense_ticket_'];

const estObjet = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const copie = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const stable = (v) => {
  if (v === undefined || v === null) return 'null';
  if (typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  return '{' + Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
};
export const egal = (a, b) => stable(a) === stable(b);

// ── Le conteneur visé par un morceau ────────────────────────────────────────
const lireConteneur = (valeur, m) => {
  const liste = m.type === 'element' || (m.type === 'champs' && m.idCle != null);
  if (m.sous != null) {
    const p = estObjet(valeur) ? valeur : {};
    const c = p[m.sous];
    return liste ? (Array.isArray(c) ? c : (c == null && Array.isArray(m.defaut) ? m.defaut : [])) : (estObjet(c) ? c : {});
  }
  if (liste) return Array.isArray(valeur) ? valeur : (valeur == null && Array.isArray(m.defaut) ? m.defaut : []);
  return estObjet(valeur) ? valeur : {};
};
const poserConteneur = (valeur, m, c) => (m.sous != null ? { ...(estObjet(valeur) ? valeur : {}), [m.sous]: c } : c);
const indexDe = (L, m) => L.findIndex((x) => (m.idCle != null ? estObjet(x) && x[m.idCle] != null && String(x[m.idCle]) === String(m.id) : egal(x, m.id)));

// Applique UN morceau. `sens` 'apres' = le geste (supprimer), 'avant' = son
// inverse (restaurer). Rend { valeur, change, ignore }.
// `force` : pour l'ÉCRAN seulement (son état peut être une copie nettoyée de la
// valeur rangée) — l'identité suffit ; l'écriture, elle, reste conditionnelle.
export function appliquerMorceau(valeur, m, sens = 'apres', { force = false } = {}) {
  const de = sens === 'apres' ? m.avant : m.apres;
  const vers = sens === 'apres' ? m.apres : m.avant;
  const rien = { valeur, change: false, ignore: false };
  const garde = { valeur, change: false, ignore: true };
  if (m.type === 'element') {
    const L = lireConteneur(valeur, m);
    const i = indexDe(L, m);
    if (vers === undefined) {                                   // retirer
      if (i < 0) return rien;
      if (!force && !egal(L[i], de)) return garde;              // changé depuis : gardé
      return { valeur: poserConteneur(valeur, m, L.filter((_, j) => j !== i)), change: true, ignore: false };
    }
    if (i >= 0) return egal(L[i], vers) || force ? rien : garde; // déjà là (ou autre chose sous cet id : gardé)
    if (de !== undefined && !force) {                           // remplacer : l'élément de départ doit être là
      return garde;
    }
    const n = L.slice();
    const at = Number.isInteger(m.index) && m.index >= 0 ? Math.min(m.index, n.length) : n.length;
    n.splice(at, 0, copie(vers));
    return { valeur: poserConteneur(valeur, m, n), change: true, ignore: false };
  }
  if (m.type === 'champs') {
    const C = lireConteneur(valeur, m);
    const liste = Array.isArray(C);
    const i = liste ? indexDe(C, m) : -1;
    const f = liste ? (i >= 0 ? C[i] : null) : C[String(m.id)];
    if (!estObjet(f)) return garde;                              // jamais une fiche créée
    const n = { ...f };
    let change = false, ignore = false;
    const vo = estObjet(vers) ? vers : {}, deo = estObjet(de) ? de : {};
    for (const c of new Set([...Object.keys(vo), ...Object.keys(deo)])) {
      if (egal(n[c], vo[c])) continue;
      if (!force && !egal(n[c], deo[c])) { ignore = true; continue; }   // retouché depuis : gardé
      if (vo[c] === undefined) delete n[c]; else n[c] = copie(vo[c]);
      change = true;
    }
    if (!change) return { valeur, change: false, ignore };
    const nc = liste ? C.map((x, j) => (j === i ? n : x)) : { ...C, [String(m.id)]: n };
    return { valeur: poserConteneur(valeur, m, nc), change: true, ignore };
  }
  // 'cle'
  const O = lireConteneur(valeur, m);
  const id = String(m.id);
  const cur = O[id];
  if (egal(cur, vers) && (cur === undefined) === (vers === undefined)) return rien;
  if (!force && !(egal(cur, de) && (cur === undefined) === (de === undefined))) return garde;
  const n = { ...O };
  if (vers === undefined) delete n[id]; else n[id] = copie(vers);
  return { valeur: poserConteneur(valeur, m, n), change: true, ignore: false };
}

// Tous les morceaux d'une clé `k` (ou tous). Rend { valeur, change, ignores }.
export function appliquerMorceaux(valeur, morceaux, sens = 'apres', k = null, opts = {}) {
  let v = valeur, change = false, ignores = 0;
  const L = sens === 'apres' ? morceaux : morceaux.slice().reverse();
  for (const m of L) {
    if (k != null && m.k !== k) continue;
    const r = appliquerMorceau(v, m, sens, opts);
    v = r.valeur; if (r.change) change = true; if (r.ignore) ignores++;
  }
  return { valeur: v, change, ignores };
}
export const clesDesMorceaux = (morceaux) => [...new Set(morceaux.map((m) => m.k))];

// ── Écrire : TOUT LIRE d'abord, puis écrire (§4 « une lecture ratée n'écrit rien ») ──
// `lire(k)` ⇒ la valeur (null = absente) ou `undefined` = PAS SU ; `ecrire(k, v)`
// ⇒ { ok: true|false|null, … } (l'écrivain de l'app). `combiner` : l'issue unique.
export async function ecrireMorceaux({ morceaux, sens, lire, ecrire, combiner }) {
  const cles = clesDesMorceaux(morceaux);
  const lues = {};
  for (const k of cles) {
    let v; try { v = await lire(k); } catch (_) { v = undefined; }
    if (v === undefined) return { ok: false, definitif: true, ecrit: false, raison: 'lecture' };
    lues[k] = v;
  }
  const res = [];
  for (const k of cles) {
    const r = appliquerMorceaux(lues[k], morceaux, sens, k);
    if (!r.change) continue;                                     // rien à écrire pour cette clé
    let w; try { w = await ecrire(k, r.valeur); } catch (e) { w = { ok: false, definitif: true, raison: String((e && e.message) || e) }; }
    res.push(w || { ok: null });
  }
  if (!res.length) return { ok: true, ecrit: false };
  return typeof combiner === 'function' ? combiner(res) : (res.every((r) => r && r.ok === true) ? { ok: true, ecrit: true } : { ok: null, ecrit: true });
}

// ── Les entrées ─────────────────────────────────────────────────────────────
// entrée = { id, type, libelle, numero, at (ISO), morceaux, lignes? }
export const entreeValide = (e) => estObjet(e) && typeof e.id === 'string' && e.id && typeof e.at === 'string' && Number.isFinite(Date.parse(e.at)) && Array.isArray(e.morceaux) && e.morceaux.length > 0
  && e.morceaux.every((m) => estObjet(m) && typeof m.k === 'string' && m.k !== CLE_CORBEILLE && ['cle', 'element', 'champs'].includes(m.type) && m.id != null);
// La carte rangée, nettoyée (une forme abîmée ⇒ ignorée, jamais une erreur).
export function lireCorbeille(v) {
  const out = {};
  for (const [id, e] of Object.entries(estObjet(v) ? v : {})) if (entreeValide(e) && e.id === id) out[id] = e;
  return out;
}
// La liste à montrer : la plus récente d'abord.
export const listeCorbeille = (v) => Object.values(lireCorbeille(v)).sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || (a.id < b.id ? 1 : -1));

// Fabrique une entrée. `morceaux` : ce que le geste change (avant/après) ;
// `id` et `maintenant` sont passés pour un geste rejouable à l'identique.
export function creerEntree({ type, libelle = '', numero = null, morceaux, lignes = [], maintenant = Date.now(), id }) {
  const ms = (Array.isArray(morceaux) ? morceaux : []).filter((m) => m && m.k && m.k !== CLE_CORBEILLE).map((m) => {
    const o = { k: String(m.k), type: m.type, id: m.id };
    for (const c of ['sous', 'idCle', 'index', 'defaut']) if (m[c] !== undefined && m[c] !== null) o[c] = copie(m[c]);
    o.avant = copie(m.avant); o.apres = copie(m.apres);
    if (o.avant === undefined) delete o.avant;
    if (o.apres === undefined) delete o.apres;
    return o;
  });
  if (!ms.length) return null;
  const annexes = (Array.isArray(lignes) ? lignes : []).map(String).filter((l) => PREFIXES_ANNEXES.some((p) => l.startsWith(p) && l.length > p.length));
  const e = {
    id: String(id || `${type || 'x'}_${Number(maintenant).toString(36)}_${Math.random().toString(36).slice(2, 8)}`),
    type: String(type || 'autre'), libelle: String(libelle || '').slice(0, 120),
    numero: numero == null || String(numero).trim() === '' ? null : String(numero).trim(),
    at: new Date(maintenant).toISOString(), morceaux: ms,
  };
  if (annexes.length) e.lignes = annexes;
  return e;
}
// Le morceau qui range (sens 'apres') ou sort (sens 'avant') l'entrée de la corbeille.
export const morceauCorbeille = (e) => ({ k: CLE_CORBEILLE, type: 'cle', id: e.id, apres: e });
// SUPPRIMER = les morceaux de l'entrée + l'entrée rangée. L'inverse (« Annuler » 5 s)
// remet tout exactement.
export const morceauxSupprimer = (e) => [...e.morceaux, morceauCorbeille(e)];
// RESTAURER = les mêmes, retournés (avant ⇄ après) : la restauration est un geste
// comme un autre, sa pilule « Annuler » la remet à la corbeille.
const retourne = (m) => { const o = { ...m, avant: m.apres, apres: m.avant }; if (o.avant === undefined) delete o.avant; if (o.apres === undefined) delete o.apres; return o; };
export const morceauxRestaurer = (e) => morceauxSupprimer(e).map(retourne).reverse();

// ── Avant de restaurer : ce qui reviendra, ce qui est gardé, et le refus §5 ──
// `lire(k)` (synchrone ici : la valeur de l'appareil). `cleNum` : l'identité d'un N°.
// Un élément à N° ne revient pas si un AUTRE élément de sa liste porte maintenant
// ce N° (deux paires sous un N°, le seul défaut irréversible §5) ⇒ { conflit: N° }.
export function planRestauration(e, lire, cleNum = (x) => String(x || '').trim().toUpperCase()) {
  if (!entreeValide(e)) return { ok: false, raison: 'entree' };
  let reviennent = 0, gardes = 0;
  const cache = {};
  const lu = (k) => { if (!(k in cache)) cache[k] = lire(k); return cache[k]; };
  for (const m of e.morceaux) {
    if (m.type === 'element' && estObjet(m.avant) && m.avant.numero != null && String(m.avant.numero).trim() !== '') {
      const L = lireConteneur(lu(m.k), m);
      const c = cleNum(m.avant.numero);
      const autre = L.some((x) => estObjet(x) && !(m.idCle != null && String(x[m.idCle]) === String(m.id)) && x.numero != null && cleNum(x.numero) === c);
      if (c && autre) return { ok: false, conflit: String(m.avant.numero) };
    }
  }
  const inv = e.morceaux.map(retourne);
  for (const k of clesDesMorceaux(inv)) {
    let v = lu(k);
    for (const m of inv.filter((x) => x.k === k)) { const r = appliquerMorceau(v, m, 'apres'); v = r.valeur; if (r.change) reviennent++; if (r.ignore) gardes++; }
  }
  return { ok: true, reviennent, gardes };
}

// ── Le temps ────────────────────────────────────────────────────────────────
export const expireLe = (e) => { const t = Date.parse(e && e.at); return Number.isFinite(t) ? t + DUREE_CORBEILLE_J * JOUR : 0; };
export const expiree = (e, maintenant = Date.now()) => expireLe(e) <= maintenant;
export const joursRestants = (e, maintenant = Date.now()) => Math.max(0, Math.ceil((expireLe(e) - maintenant) / JOUR));

// La purge : plus de 30 jours, ou au-delà des MAX_CORBEILLE plus récentes.
// Rend { ids: [à sortir], purgees: [entrées] } — l'appelant les sort de la carte
// relue (lire-fusionner-réécrire) et vide leurs lignes annexes si l'élément
// n'est pas revenu (`annexesAVider`).
export function aPurger(corbeille, maintenant = Date.now(), max = MAX_CORBEILLE) {
  const L = listeCorbeille(corbeille);
  const purgees = L.filter((e, i) => expiree(e, maintenant) || i >= max);
  return { ids: purgees.map((e) => e.id), purgees };
}
// Les lignes annexes d'une entrée purgée à vider : seulement si l'élément
// supprimé n'est PAS revenu dans sa liste (restauré par un autre appareil, ou
// remis par « Annuler ») — sinon sa photo serait perdue.
export function annexesAVider(e, lire) {
  if (!entreeValide(e) || !Array.isArray(e.lignes) || !e.lignes.length) return [];
  for (const m of e.morceaux) {
    if (m.type !== 'element' || m.avant === undefined) continue;
    const L = lireConteneur(lire(m.k), m);
    if (L === undefined || indexDe(L, m) >= 0) return [];
  }
  return e.lignes.filter((l) => PREFIXES_ANNEXES.some((p) => l.startsWith(p)));
}

// ── Les mots ────────────────────────────────────────────────────────────────
export const NOMS_TYPES = {
  achat: 'Achat hors plateforme', depense: 'Dépense', cout: 'Coût fixe', abonnement: 'Abonnement', pack: 'Pack ou option',
  modele: 'Modèle de description', reponse: 'Réponse rapide', fiche: 'Fiche à publier', note: 'Note',
  fournisseur: 'Fournisseur', 'achat-gros': 'Achat en gros', autre: 'Élément',
};
export const nomType = (t) => NOMS_TYPES[t] || NOMS_TYPES.autre;
export const TEXTE_MIS = 'Mis à la corbeille';
