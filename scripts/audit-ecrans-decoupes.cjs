#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  LES ÉCRANS DÉCOUPÉS D'App.jsx (src/ecrans/*.jsx, « app plus rapide »,
//  21 octobre) — chacun ne lit que ce qu'il importe vraiment.
//  `npm run build` ne voit pas une variable absente : un nom d'App.jsx oublié
//  dans l'import d'un écran découpé serait une `ReferenceError` au premier
//  rendu de cet écran (§4.8 : un helper n'est utilisable que là où il est
//  déclaré). Ce contrôle, pour chaque fichier de src/ecrans :
//    1. tout identifiant libre (ni déclaré, ni importé) n'est PAS une
//       déclaration de premier niveau d'App.jsx (sinon : import manquant) ;
//    2. tout nom importé d'App.jsx y est bien EXPORTÉ ;
//    3. aucun écran ne réassigne un nom importé (liaison en lecture seule) ;
//    4. chaque écran rendu par App.jsx via `paresseux(…, 'X')` exporte bien X ;
//    5. le morceau App ne réimporte pas un écran découpé en dur (sinon il
//       repartirait dans le morceau initial).
//  `--prouve` réaffaiblit (retire un nom d'un import) et exige le rouge.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..');
const parser = require(path.join(R, 'node_modules/@babel/parser'));
const traverse = require(path.join(R, 'node_modules/@babel/traverse')).default;
const DIR = path.join(R, 'src/ecrans');
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
function verifier(appSrc, ecrans) {
  let rouges = 0; const note = (c, m, d) => { if (!c) rouges++; dit(c, m, d); };
  const app = parser.parse(appSrc, { sourceType: 'module', plugins: ['jsx'] });
  const topApp = new Set(); const exportes = new Set();
  for (const s of app.program.body) {
    const d = s.type === 'ExportNamedDeclaration' ? s.declaration : s;
    if (s.type === 'ExportNamedDeclaration' && !s.declaration) for (const sp of s.specifiers) exportes.add(sp.exported.name);
    if (!d) continue;
    const ns = d.type === 'VariableDeclaration' ? d.declarations.filter((v) => v.id.type === 'Identifier').map((v) => v.id.name) : (d.id ? [d.id.name] : []);
    ns.forEach((n) => { topApp.add(n); if (s.type === 'ExportNamedDeclaration') exportes.add(n); });
  }
  const paresseux = [...appSrc.matchAll(/paresseux\(\(\) => import\('\.\/ecrans\/([a-z0-9_-]+)\.jsx'\), '([A-Za-z0-9_]+)'\)/g)].map((m) => ({ f: m[1], n: m[2] }));
  note(paresseux.length > 0, 'App.jsx rend des écrans découpés par `paresseux`', `${paresseux.length}`);
  for (const [f, t] of Object.entries(ecrans)) {
    const ast = parser.parse(t, { sourceType: 'module', plugins: ['jsx'] });
    let globals = [], imp = new Set(), ecrit = [], exp = new Set();
    traverse(ast, { Program(p) { globals = Object.keys(p.scope.globals); for (const [n, b] of Object.entries(p.scope.bindings)) { if (b.kind === 'module') { const s = b.path.parentPath.node; if (s.source && s.source.value === '../App.jsx') imp.add(n); if (b.constantViolations.length) ecrit.push(n); } } } });
    for (const s of ast.program.body) if (s.type === 'ExportNamedDeclaration' && !s.declaration) for (const sp of s.specifiers) exp.add(sp.exported.name);
    const manquants = globals.filter((g) => topApp.has(g));
    note(!manquants.length, `${f} : aucun nom d'App.jsx lu sans être importé`, manquants.join(', '));
    const nonExp = [...imp].filter((n) => !exportes.has(n));
    note(!nonExp.length, `${f} : tout ce qu'il importe d'App.jsx y est exporté`, nonExp.join(', '));
    note(!ecrit.length, `${f} : ne réassigne aucun nom importé`, ecrit.join(', '));
    for (const p of paresseux.filter((x) => x.f + '.jsx' === f)) note(exp.has(p.n), `${f} : exporte ${p.n} (rendu par App.jsx à la demande)`);
  }
  const enDur = [...appSrc.matchAll(/^import [^;]*from ["']\.\/ecrans\/[^"']+["']/gm)].map((m) => m[0]);
  note(!enDur.length, 'App.jsx n\'importe aucun écran découpé en dur', enDur.join(' | '));
  return rouges;
}
const appSrc = fs.readFileSync(path.join(R, 'src/App.jsx'), 'utf8');
const ecrans = {}; for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.jsx'))) ecrans[f] = fs.readFileSync(path.join(DIR, f), 'utf8');
console.log('── les écrans découpés');
verifier(appSrc, ecrans);
if (process.argv.includes('--prouve')) {
  console.log('── preuve : un nom retiré de l\'import d\'un écran doit sortir rouge');
  const ko0 = ko; const f = Object.keys(ecrans)[0];
  const mute = { ...ecrans, [f]: ecrans[f].replace(/import \{ ([A-Za-z0-9_$]+), /, 'import { ') };
  const r = verifier(appSrc, mute); ko = ko0;
  dit(r > 0, 'la mutation « import incomplet » est attrapée', `${r} rouge(s)`);
}
console.log(ko ? `\n❌ ${ko} échec(s)` : '\n✅ écrans découpés cohérents');
process.exit(ko ? 1 : 0);
