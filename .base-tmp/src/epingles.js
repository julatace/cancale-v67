// ═══════════════════════════════════════════════════════════════════════════
// ÉPINGLER DES PAIRES EN HAUT DES LISTES (14 nov. 2026, chantier 94 — validé par Julien)
// ═══════════════════════════════════════════════════════════════════════════
// Une épingle tient une paire en tête de la liste d'Annonces (et de sa vue
// « Sélectionner »), sur tous ses appareils.
//   · PAR COMPTE VRM : rangée dans la ligne `main` (clé synchronisée `vrm_epingles`) ;
//     la ligne se lit-fusionne-réécrit clé par clé, sous-clé par sous-clé
//     (src/fusionNuage.js) : une épingle posée sur l'iPhone et une autre sur le Mac
//     restent toutes les deux. Tant que le nuage n'est pas lu (« pas su »), l'écran
//     n'écrit RIEN (le bouton attend) — une lecture ratée n'écrit rien (§5).
//   · PAR IDENTITÉ (§5), jamais par titre : la clé est le compte + l'id de l'annonce
//     (`a:{uid}:{id}`) ; le N° est gardé À CÔTÉ pour suivre la paire quand elle est
//     REPUBLIÉE (nouvel id, même N°, src/repriseNumero.js) — seulement si ce N° ne
//     désigne qu'UNE annonce présente (deux paires sous un N° : on ne choisit pas).
//   · 20 AU PLUS : au-delà, l'épingle est refusée et dite. Deux appareils qui en
//     posent chacun 15 : la fusion en garde 30, l'affichage les 20 plus récentes.
// Forme : { [cle]: { uid, id, n (N° ou ''), t (ms) } } ; une épingle retirée est
// une sous-clé SUPPRIMÉE (la fusion à trois voies la retire partout).
// Module PUR (aucun React, aucune horloge cachée) — scripts/audit-listes-recherche.cjs.

export const CLE_EPINGLES = 'vrm_epingles';
export const MAX_EPINGLES = 20;
const str = (v) => String(v == null ? '' : v);
export const cleEpingle = (uid, id) => `a:${str(uid)}:${str(id)}`;
const cleN = (v) => { let s = str(v).trim().toUpperCase().replace(/[\s\-_.]/g, ''); if (/^\d+$/.test(s)) s = String(parseInt(s, 10)); return s; };

// Ce que la ligne porte, propre (une valeur abîmée ne casse rien, elle est ignorée).
export function epinglesPropres(v) {
  const out = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  for (const [k, e] of Object.entries(v)) {
    if (!e || typeof e !== 'object' || !/^a:[^:]*:.+$/.test(k)) continue;
    const t = Number(e.t); if (!Number.isFinite(t)) continue;
    out[k] = { uid: str(e.uid), id: str(e.id), n: str(e.n), t };
  }
  return out;
}
// Les 20 plus récentes (la fusion de deux appareils peut en porter plus).
export function epinglesVues(v) {
  return Object.entries(epinglesPropres(v)).sort((a, b) => b[1].t - a[1].t).slice(0, MAX_EPINGLES);
}
// Poser / retirer les épingles d'une sélection. `paires` : [{ uid, id, numero }].
// Rend { v (la nouvelle valeur), faites, refusees } — rien n'est écrit au-delà de 20.
export function basculerEpingles(v, paires, { poser = true, maintenant = Date.now() } = {}) {
  const cur = epinglesPropres(v);
  const out = { ...cur }; let faites = 0, refusees = 0;
  for (const p of paires || []) {
    if (!p || p.id == null || !str(p.id).trim()) continue;
    const k = cleEpingle(p.uid, p.id);
    if (!poser) { if (out[k]) { delete out[k]; faites++; } continue; }
    if (out[k]) continue;
    if (Object.keys(out).length >= MAX_EPINGLES) { refusees++; continue; }
    out[k] = { uid: str(p.uid), id: str(p.id), n: str(p.numero || ''), t: maintenant + faites };
    faites++;
  }
  return { v: out, faites, refusees };
}
// L'ensemble des annonces épinglées PARMI celles lues : par id d'abord ; une épingle
// dont l'annonce a disparu suit son N° s'il désigne UNE seule annonce présente du
// même compte (republiée). Rend Map(cleEpingle de l'annonce → rang : 0 = la plus récente).
export function epinglesPresentes(v, annonces, { uid = (a) => a.uid, id = (a) => a.id, numero = (a) => a.numero } = {}) {
  const vues = epinglesVues(v);
  const parCle = new Map(); const parNum = new Map();
  for (const a of annonces || []) {
    const k = cleEpingle(uid(a), id(a)); parCle.set(k, a);
    const n = cleN(numero(a)); if (n) { const c = str(uid(a)) + '|' + n; parNum.set(c, parNum.has(c) ? null : k); }
  }
  const rang = new Map();
  vues.forEach(([k, e], i) => {
    if (parCle.has(k)) { if (!rang.has(k)) rang.set(k, i); return; }
    const n = cleN(e.n); if (!n) return;
    const k2 = parNum.get(str(e.uid) + '|' + n);
    if (k2 && !rang.has(k2)) rang.set(k2, i);
  });
  return rang;
}
// Les épinglées EN TÊTE, dans l'ordre de leur pose (la plus récente d'abord) ; le reste
// garde l'ordre choisi (tri stable). Rien n'entre ni ne sort de la liste.
export function epinglesEnTete(liste, rang, cleDe) {
  if (!rang || !rang.size || !Array.isArray(liste)) return liste;
  const avant = [], apres = [];
  for (const a of liste) (rang.has(cleDe(a)) ? avant : apres).push(a);
  if (!avant.length) return liste;
  avant.sort((x, y) => rang.get(cleDe(x)) - rang.get(cleDe(y)));
  return [...avant, ...apres];
}
