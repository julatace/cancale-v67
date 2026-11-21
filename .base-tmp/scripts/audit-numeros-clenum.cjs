// ════════════════════════════════════════════════════════════════════════════
//  GARDIEN — FAMILLE « DEUX N° SE COMPARENT PAR cleNum » (11 nov., familles de l'app)
//  §5 : l'identité d'un N° est `cleNum` (majuscules, sans espace ni tiret, « 007 » = « 7 »).
//  Comparer deux N° par `String(a) === String(b)` ou par `.trim().toLowerCase()` rate
//  « 07 » contre « 7 » : la paire n'est plus vue vendue, rangée, au garage.
//   A. les copies locales de `cleNum` (modules chargés seuls par d'autres audits) et celle
//      d'App.jsx rendent EXACTEMENT celle de api/_lib/numerotation.js ;
//   B. les règles corrigées, exécutées (reprise du N°, annulée chez toi, garage) ;
//   C. aucune comparaison `String(…num…) === String(…num…)` ni `a.num === b.num` dans src/
//      (liste blanche NOMMÉE) ; le motif `….trim().toLowerCase()` sur un N° ne peut que
//      diminuer (cliquet).
//    node scripts/audit-numeros-clenum.cjs            → contrôle
//    node scripts/audit-numeros-clenum.cjs --prouve   → chaque mutation doit faire rougir
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { prouver, sansCommentaires, fichiers, extraire } = require('./_mutations-gardien.cjs');

const R = process.env.VRM_RACINE || path.join(__dirname, '..');

if (process.argv.includes('--prouve')) {
  const MUT = [
    ['reprise du N° en majuscules seulement', 'src/repriseNumero.js', "const cleNum = (v) => { let s = String(v == null ? '' : v).trim().toUpperCase().replace(/[\\s\\-_.]/g, ''); if (/^\\d+$/.test(s)) s = String(parseInt(s, 10)); return s; };", "const cleNum = (v) => String(v == null ? '' : v).trim().toUpperCase();"],
    ['photo partagée : N° comparés en texte brut', 'src/App.jsx', "if (m[pk]) { if (cleNum(numeros[m[pk]].numero) !== cleNum(numeros[k].numero)) dup.add(pk); }", "if (m[pk]) { if (String(numeros[m[pk]].numero) !== String(numeros[k].numero)) dup.add(pk); }"],
    ['garage : N° en minuscules', 'src/App.jsx', "    const si = arr.findIndex(v => v != null && cleNum(v) === target);", "    const si = arr.findIndex(v => v != null && String(v).trim().toLowerCase() === String(target).toLowerCase() && String(v).trim().toLowerCase() === String(v).trim().toLowerCase());"],
    ['fil unique : N° comparés en texte brut', 'src/filUnique.js', "else if (A.num && cleNum(A.num) === cleNum(B.num) && ", "else if (A.num && A.num === B.num && "],
    ['annulée chez toi : clé par défaut sans cleNum', 'src/annuleesChezToi.js', "const k = typeof cle === 'function' ? cle : cleNum;", "const k = typeof cle === 'function' ? cle : (n) => String(n == null ? '' : n).trim().toUpperCase();"],
  ];
  process.exit(prouver(__filename, MUT, R) ? 0 : 1);
}

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`${c ? '✅' : '❌'} ${m}${!c && d ? ' — ' + d : ''}`); };
const lire = (f) => { try { return fs.readFileSync(path.join(R, f), 'utf8'); } catch (_) { return ''; } };
const ECHANTILLON = ['007', '7', 'B 12', 'b12', 'B-12', 'AB_125', 'ab.125', ' 42 ', '', null, undefined, 'B007', 0, '00', 'N°7'];

(async () => {
  let ref = null;
  try { ref = (await import('file://' + path.join(R, 'api', '_lib', 'numerotation.js'))).cleNum; } catch (e) { dit(false, 'api/_lib/numerotation.js se charge', e.message); }
  console.log('── A · Une seule identité de N° : les copies rendent la même chose que api/_lib/numerotation.js');
  const sorties = (f) => ECHANTILLON.map((x) => { try { return f(x); } catch (e) { return 'ERR'; } });
  const attendu = ref ? sorties(ref) : [];
  const COPIES = ['src/App.jsx', 'src/repriseNumero.js', 'src/annuleesChezToi.js', 'src/annoncesActions.js', 'src/filUnique.js'];
  for (const f of COPIES) {
    const src = f === 'src/App.jsx' ? require(path.join(R, 'scripts', '_source-app.cjs')).sourceApp(R) : lire(f);
    const t = extraire(src, 'cleNum');
    if (!t) { dit(false, `${f} : une règle cleNum (copie ou import)`, 'introuvable'); continue; }
    const ctx = { String, parseInt }; vm.createContext(ctx);
    try { vm.runInContext(t.replace(/^const /, 'var ') + '\n;this.f = cleNum;', ctx); } catch (e) { dit(false, `${f} : cleNum s’exécute`, e.message); continue; }
    const s = sorties(ctx.f);
    dit(JSON.stringify(s) === JSON.stringify(attendu), `${f} : cleNum identique (« 007 » = « 7 », « B 12 » = « B12 »)`, JSON.stringify(s));
  }

  console.log('\n── B · Les règles corrigées, exécutées');
  {
    const APP = require(path.join(R, 'scripts', '_source-app.cjs')).sourceApp(R);
    const ctx = { String, parseInt, Array, Object, isNaN }; vm.createContext(ctx);
    const noms = ['cleNum', 'garageCellOf'];
    const absents = [];
    for (const n of noms) { const t = extraire(APP, n); if (!t) { absents.push(n); continue; } try { vm.runInContext(t.replace(/^const /, 'var ') + `\n;this.${n} = ${n};`, ctx); } catch (e) { absents.push(n + ' ' + e.message); } }
    dit(!absents.length, 'App.jsx : garageCellOf se lit', absents.join(', '));
    if (ctx.garageCellOf) {
      const r = ctx.garageCellOf({ col_0: ['', '007'], col_1: ['B 12'] }, '7');
      const r2 = ctx.garageCellOf({ col_1: ['B 12'] }, 'b12');
      dit(r && r.slot === 2 && r2 && r2.col === 2, 'garage : « 007 » rangé est trouvé pour « 7 », « B 12 » pour « b12 »', JSON.stringify([r, r2]));
    }
  }
  try {
    const M = await import('file://' + path.join(R, 'src', 'annuleesChezToi.js'));
    const e = M.etatRemise({ nouvelId: 99 }, { num: '7', numeros: { 99: { numero: '007' } } });
    dit(e === 'fait', 'vente annulée remise en ligne : la nouvelle annonce qui porte « 007 » porte bien le N°7', e);
  } catch (e) { dit(false, 'src/annuleesChezToi.js se charge', e.message); }
  try {
    const M = await import('file://' + path.join(R, 'src', 'repriseNumero.js'));
    const noms = Object.keys(M).filter((k) => typeof M[k] === 'function');
    dit(noms.length > 0, 'src/repriseNumero.js se charge', noms.join(','));
  } catch (e) { dit(false, 'src/repriseNumero.js se charge', e.message); }

  console.log('\n── C · Aucune comparaison de deux N° sans cleNum dans src/');
  const P_STRING = /String\(\s*[\w.?\[\]]*(?:numero|num|Num)\w*\s*\)\s*(?:\.trim\(\))?\s*[!=]==\s*String\(\s*[\w.?\[\]]*(?:numero|num|Num)\w*\s*\)/g;
  const P_CHAMP = /[\w.?]+\.(?:numero|num)\s*[!=]==\s*[\w.?]+\.(?:numero|num)\b/g;
  const P_MINUSC = /(?:numero|num|Num)\w*\)?\s*(?:\|\|\s*'')?\)?\.trim\(\)\.toLowerCase\(\)/g;
  // Liste blanche NOMMÉE (raison) : la ligne entière doit contenir ce texte.
  const BLANCHE = [
    ['src/App.jsx', 'conflitsNum', 'pastille « doublon » de la zone Colis (agent principal) — à reprendre là-bas'],
  ];
  const PLAFOND_MINUSC = { 'src/App.jsx': 2, 'src/ecrans/Ebay.jsx': 1, 'src/ecrans/Stock.jsx': 1 };   // recherche de pièce et réservés du garage (App), recherche eBay (texte tapé), garage 2D (Stock) : à reprendre
  const trop = [], minusc = [];
  for (const f of fichiers(path.join(R, 'src'))) {
    const rel = path.relative(R, f).split(path.sep).join('/');
    const t = sansCommentaires(fs.readFileSync(f, 'utf8'));
    for (const ligne of t.split('\n')) {
      for (const re of [P_STRING, P_CHAMP]) {
        re.lastIndex = 0;
        const m = ligne.match(re);
        if (!m) continue;
        const ok2 = m.every((x) => /ficheExtra\.num/.test(x)) || BLANCHE.some(([bf, bt]) => bf === rel && ligne.includes(bt));
        if (!ok2) trop.push(`${rel} : ${m[0]}`);
      }
    }
    const n = (t.match(P_MINUSC) || []).length;
    if (n > (PLAFOND_MINUSC[rel] || 0)) minusc.push(`${rel} ${n} > ${PLAFOND_MINUSC[rel] || 0}`);
  }
  dit(!trop.length, 'aucun `String(…num…) === String(…num…)` ni `a.num === b.num` (cleNum des deux côtés)', trop.slice(0, 8).join(' · '));
  dit(!minusc.length, '`….trim().toLowerCase()` sur un N° : pas un de plus (cliquet)', minusc.join(', '));

  console.log(`\n${ko ? '❌' : '✅'} N° par cleNum : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
