// ════════════════════════════════════════════════════════════════════════════
//  src/relaisPrevision.js — PRÉVOIR LES RETRAITS (21 nov., extension 5.411)
//  Julien : « l'extension peut essayer de capter le nom des points relais dans lesquels les colis vont arriver pour
//  pouvoir prévoir […] une carte avec les colis à aller chercher pour chaque point relais ».
//  Règles PURES (aucune lecture). Les achats en route arrivent DÉJÀ rangés sous LEUR point par `pointsARetirer`
//  (src/relaisColis.js, `attendus`, par identité : le point vient du suivi de CETTE transaction). Ici on écrit
//  seulement QUAND ils arrivent :
//    · `estimee` (AAAA-MM-JJ) : une date d'arrivée LUE sous une clé d'estimation (5.295) — « prévu le 23 nov. » ;
//    · `periode` : le texte que Vinted écrit (`estimated_detail.time_period`, 5.411) — dit tel quel, « selon Vinted » ;
//    · rien ⇒ « date pas encore dite » (jamais une date devinée, jamais « bientôt »).
//  Et le résumé de Ma journée : « Demain : 3 colis chez Relais X » seulement sur des dates LUES.
// ════════════════════════════════════════════════════════════════════════════

const jourValide = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s + 'T12:00:00Z'));
// Le jour de Paris d'un instant (AAAA-MM-JJ).
export function jourParis(ms) {
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day}`;
  } catch (_) { return new Date(ms).toISOString().slice(0, 10); }
}
// Écart en jours entre deux jours AAAA-MM-JJ.
const ecartJours = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000);

// QUAND cet achat en route arrive, d'après ce qui a été LU : { cle, jour?, dans?, texte? }
//   cle 'lue'     : date lue — `jour`, `dans` (0 aujourd'hui, 1 demain, n) ; passée ⇒ 'lue-passee'
//   cle 'vinted'  : le texte de Vinted (`texte`)
//   cle 'pas-dite': rien de lu
export function arriveePrevue(a, { maintenant = Date.now() } = {}) {
  if (a && jourValide(a.estimee)) {
    const dans = ecartJours(jourParis(maintenant), a.estimee);
    return { cle: dans < 0 ? 'lue-passee' : 'lue', jour: a.estimee, dans };
  }
  const t = a && typeof a.periode === 'string' ? a.periode.replace(/\s+/g, ' ').trim().slice(0, 60) : '';
  if (t) return { cle: 'vinted', texte: t };
  return { cle: 'pas-dite' };
}

// Le RÉSUMÉ de Ma journée : seulement les dates LUES de demain (et d'aujourd'hui), par point ; sinon les achats en route
// sous un point connu, sans date (« En route : 3 colis vers Relais X »). Rend null s'il n'y a rien à prévoir.
//   { quand: 'demain' | 'aujourdhui' | 'enroute', n, points: [{ nom, n }] }
export function prevoirRetraits(points, { maintenant = Date.now() } = {}) {
  const parQuand = { aujourdhui: new Map(), demain: new Map(), enroute: new Map() };
  for (const p of points || []) {
    if (!p || p.inconnu) continue;
    for (const a of p.attendus || []) {
      const ar = arriveePrevue(a, { maintenant });
      const q = ar.cle === 'lue' && ar.dans === 0 ? 'aujourdhui' : ar.cle === 'lue' && ar.dans === 1 ? 'demain' : 'enroute';
      const m = parQuand[q]; const cle = p.cle || p.nom;
      m.set(cle, { nom: p.nom || '', n: ((m.get(cle) || {}).n || 0) + 1 });
    }
  }
  for (const q of ['aujourdhui', 'demain', 'enroute']) {
    const l = [...parQuand[q].values()].sort((x, y) => y.n - x.n || String(x.nom).localeCompare(String(y.nom), 'fr'));
    if (l.length) return { quand: q, n: l.reduce((t, x) => t + x.n, 0), points: l };
  }
  return null;
}
