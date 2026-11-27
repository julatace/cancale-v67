// ── _travail-recherche — MESURER LA RECHERCHE SANS L'HORLOGE MURALE (26 nov.) ────────────────────────────────────────
// audit-recherche-partout et audit-recherche-unique jugeaient « instantané » sur `hrtime` / `performance.now()` : le temps
// MURAL, qui compte aussi le temps où le processus attend un cœur. En CI, 4 audits (et des navigateurs) se partagent
// 4 cœurs : la même frappe mesurait 0,7 ms seule et 78 ms à côté de huit boucles (mesuré ici) — rouge sans que la
// recherche ait changé d'un octet, vert « au second essai, seul ». Ce n'était pas une mesure de la règle.
// Deux mesures qui ne dépendent pas des voisins, aux MÊMES seuils :
//   1. `cpuMs` — le temps CPU du FIL principal (`process.threadCpuUsage`, Node ≥ 22.?) : ce que la recherche a calculé,
//      pas ce qu'elle a attendu (mesuré sous 8 boucles : index 42–49 ms CPU pour 60–582 ms muraux ; frappe ≤ 5 ms CPU
//      pour 2–78 ms muraux). Repli : `process.cpuUsage` (tout le processus, GC compris : plus large, jamais plus étroit).
//   2. `indexCompte` — un compteur EXACT du travail d'une frappe : chaque lecture d'une propriété de l'index et de chacune
//      de ses entrées. Déterministe (aucune horloge) : le même code et les mêmes données donnent le même nombre, ici
//      comme en CI. Il juge la FORME du travail : une frappe lit chaque entrée un nombre borné de fois (linéaire en n)
//      et l'index lui-même un nombre de fois qui ne dépend pas de n (le vocabulaire des fautes fait une fois, pas une
//      fois par entrée). Une recherche devenue quadratique le rend rouge, quelle que soit la charge de la machine.
'use strict';

const cpuMs = typeof process.threadCpuUsage === 'function'
  ? () => { const u = process.threadCpuUsage(); return (u.user + u.system) / 1000; }
  : () => { const u = process.cpuUsage(); return (u.user + u.system) / 1000; };
const SOURCE_CPU = typeof process.threadCpuUsage === 'function' ? 'CPU du fil principal' : 'CPU du processus';

// Le temps CPU d'un appel (ms) et son résultat.
function mesureCpu(fn) { const a = cpuMs(); const r = fn(); return { ms: cpuMs() - a, r }; }

// Une copie de l'index dont chaque lecture est comptée : `c.index` (l'objet index), `c.entrees` (le tableau et chaque
// entrée). Les écritures (mémos `_mots`, `_vocab`, `_alnum`) passent : elles vont sur l'objet réel, comme dans l'app.
function indexCompte(index) {
  const c = { index: 0, entrees: 0 };
  const compte = (cle) => ({ get(t, k, r) { c[cle]++; return Reflect.get(t, k, r); } });
  const entrees = new Proxy(index.entrees.map((e) => new Proxy(e, compte('entrees'))), compte('entrees'));
  const idx = new Proxy(Object.assign({}, index, { entrees }), compte('index'));
  return { idx, c, zero() { c.index = 0; c.entrees = 0; } };
}

// Le travail d'UNE frappe (après une frappe de chauffe : le vocabulaire est fait une fois par index, comme dans l'app).
function travailFrappe(R, index, q, opts) {
  const k = indexCompte(index);
  R.chercherPartout(k.idx, 'premiere frappe', opts);
  k.zero();
  R.chercherPartout(k.idx, q, opts);
  return { index: k.c.index, entrees: k.c.entrees, n: index.entrees.length, parEntree: k.c.entrees / index.entrees.length };
}

module.exports = { cpuMs, mesureCpu, indexCompte, travailFrappe, SOURCE_CPU };
