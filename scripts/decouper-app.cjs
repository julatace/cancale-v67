#!/usr/bin/env node
// Découpe d'App.jsx en morceaux chargés à la demande (« app plus rapide », 21 octobre).
//
// ⚠️ UN OUTIL, PAS UN RÉFLEXE. Il déplace un groupe de déclarations de premier
// niveau d'App.jsx dans src/ecrans/<fichier>.jsx, sans en changer UNE ligne :
//   · les RACINES (des écrans rendus seulement par AppCoeur) deviennent dans
//     App.jsx un composant paresseux (`paresseux(...)`, React.lazy + Suspense
//     local) — leurs appels `<Racine …/>` ne changent pas ;
//   · tout ce que SEUL le groupe utilise le suit (fermeture), à condition d'être
//     une déclaration sans effet au chargement (fonction, flèche, littéral,
//     React.memo/forwardRef) — un `const X = calcul()` reste dans App.jsx ;
//   · tout ce que le groupe lit d'App.jsx est EXPORTÉ d'App.jsx et importé par le
//     nouveau fichier (liaisons vivantes de l'ESM : `C`, le thème, reste à jour) ;
//   · il REFUSE si le groupe réassigne une variable d'App.jsx (une liaison
//     importée est en lecture seule), ou si une racine est utilisée autrement
//     qu'en élément JSX.
// Usage : node scripts/decouper-app.cjs <fichier> <Racine1,Racine2,…> [--essai]
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..');
const parser = require(path.join(R, 'node_modules/@babel/parser'));
const traverse = require(path.join(R, 'node_modules/@babel/traverse')).default;
const [fichier, racinesArg] = process.argv.slice(2);
const essai = process.argv.includes('--essai');
// --composants : ne fait suivre que les COMPOSANTS (fonctions en PascalCase) ; les
// règles, aides et constantes restent dans App.jsx (les audits les y lisent).
const composants = process.argv.includes('--composants');
if (!fichier || !racinesArg) { console.error('usage: decouper-app.cjs <fichier> <Racine,…> [--essai]'); process.exit(2); }
const racines = racinesArg.split(',');
const APP = path.join(R, 'src/App.jsx');
const src = fs.readFileSync(APP, 'utf8');
const ast = parser.parse(src, { sourceType: 'module', plugins: ['jsx'] });
const body = ast.program.body;
const decl = (s) => (s.type === 'ExportNamedDeclaration' ? s.declaration : s);
const noms = body.map((s) => {
  const d = decl(s); if (!d) return [];
  if (d.type === 'FunctionDeclaration' || d.type === 'ClassDeclaration') return d.id ? [d.id.name] : [];
  if (d.type === 'VariableDeclaration') return d.declarations.flatMap((v) => (v.id.type === 'Identifier' ? [v.id.name] : []));
  return [];
});
const idxDe = new Map(); noms.forEach((ns, i) => ns.forEach((n) => idxDe.set(n, i)));
const top = (p) => { let q = p; while (q.parentPath && q.parentPath.node !== ast.program) q = q.parentPath; return body.indexOf(q.node); };
const users = body.map(() => new Set()); const deps = body.map(() => new Set());
const ecritures = []; // {nom, j}
const usagesNonJsx = new Map(); // nom -> [j]
let bindings;
traverse(ast, { Program(p) { bindings = p.scope.bindings; p.stop(); } });
for (const [nom, b] of Object.entries(bindings)) {
  const i = top(b.path);
  for (const r of b.referencePaths) {
    const j = top(r); if (j === i) continue;
    users[i].add(j); deps[j].add(nom);
    const jsx = r.parentPath && (r.parentPath.isJSXOpeningElement() || r.parentPath.isJSXClosingElement());
    if (!jsx) { if (!usagesNonJsx.has(nom)) usagesNonJsx.set(nom, []); usagesNonJsx.get(nom).push(j); }
  }
  for (const r of b.constantViolations) { const j = top(r); if (j !== i) { users[i].add(j); ecritures.push({ nom, j }); } }
}
const pur = (s) => {
  if (s.type === 'FunctionDeclaration' || s.type === 'ClassDeclaration') return true;
  if (s.type !== 'VariableDeclaration') return false;
  const ok = (e) => {
    if (!e) return true;
    switch (e.type) {
      case 'ArrowFunctionExpression': case 'FunctionExpression': case 'StringLiteral': case 'NumericLiteral':
      case 'BooleanLiteral': case 'NullLiteral': case 'RegExpLiteral': case 'Identifier': return true;
      case 'TemplateLiteral': return e.expressions.every(ok);
      case 'UnaryExpression': return ok(e.argument);
      case 'BinaryExpression': case 'LogicalExpression': return ok(e.left) && ok(e.right);
      case 'ArrayExpression': return e.elements.every((x) => !x || ok(x.type === 'SpreadElement' ? x.argument : x));
      case 'ObjectExpression': return e.properties.every((p) => (p.type === 'ObjectMethod') || (p.type === 'ObjectProperty' && !p.computed && ok(p.value)) || (p.type === 'SpreadElement' && ok(p.argument)));
      case 'MemberExpression': return !e.computed && ok(e.object);
      case 'CallExpression': {
        const c = e.callee; const n = c.type === 'Identifier' ? c.name : (c.type === 'MemberExpression' && !c.computed && c.object.name === 'React' ? c.property.name : '');
        return ['memo', 'forwardRef'].includes(n) && e.arguments.every(ok);
      }
      default: return false;
    }
  };
  return s.declarations.every((v) => v.id.type === 'Identifier' && ok(v.init));
};
const estFonction = (d) => d.type === 'FunctionDeclaration' || (d.type === 'VariableDeclaration' && d.declarations.length === 1 && /Function|Call/.test(d.declarations[0].init?.type || ''));
// Fermeture
const groupe = new Set(racines.map((n) => { const i = idxDe.get(n); if (i == null) throw new Error('racine introuvable : ' + n); return i; }));
for (const n of racines) {
  const bad = (usagesNonJsx.get(n) || []).filter((j) => !groupe.has(j));
  if (bad.length) throw new Error(`${n} est utilisé autrement qu'en élément JSX (premier niveau ${bad.map((j) => noms[j].join('|')).join(', ')})`);
}
let change = true;
while (change) {
  change = false;
  body.forEach((s, i) => {
    if (groupe.has(i) || !noms[i].length || !users[i].size) return;
    if (s.type === 'ExportNamedDeclaration') return;
    if (!pur(decl(s))) return;
    if (composants && !(noms[i].length === 1 && /^[A-Z][a-z]/.test(noms[i][0]) && estFonction(decl(s)))) return;
    if ([...users[i]].every((j) => groupe.has(j))) { groupe.add(i); change = true; }
  });
}
// Ce que le groupe lit d'App.jsx, et les imports à recopier
const aExporter = new Set(); const importsUtiles = new Map(); // source -> [{type, imported, local}]
for (const i of groupe) for (const nom of deps[i]) {
  const b = bindings[nom]; const j = top(b.path);
  if (groupe.has(j)) continue;
  if (body[j].type === 'ImportDeclaration') {
    const spec = b.path.node; const srcMod = body[j].source.value;
    if (!importsUtiles.has(srcMod)) importsUtiles.set(srcMod, new Map());
    importsUtiles.get(srcMod).set(spec.local.name, spec);
  } else aExporter.add(nom);
}
const casse = ecritures.filter((e) => groupe.has(e.j) && !groupe.has(idxDe.get(e.nom)));
if (casse.length) throw new Error('le groupe réassigne des variables d’App.jsx : ' + [...new Set(casse.map((e) => e.nom))].join(', '));
// Un nom exporté qui est réassigné ailleurs dans App reste une liaison vivante : c'est voulu.
const trie = [...groupe].sort((a, b) => a - b);
const debut = (i) => (i === 0 ? 0 : body[i - 1].end);
const tranche = (i) => src.slice(debut(i), body[i].end);
const taille = trie.reduce((n, i) => n + tranche(i).length, 0);
console.log(`groupe ${fichier} : ${trie.length} déclarations, ${taille} octets — ${trie.map((i) => noms[i].join('|')).join(', ')}`);
console.log(`exports ajoutés à App.jsx : ${aExporter.size}`);
if (essai) process.exit(0);
// Nouveau fichier
const rel = (m) => (m.startsWith('.') ? (m.startsWith('./') ? '../' + m.slice(2) : '../' + m) : m);
let tete = `// ⚠️ FICHIER DÉCOUPÉ D'App.jsx (scripts/decouper-app.cjs) — chargé à la demande.\n// Le code ci-dessous est celui d'App.jsx, sans changement ; ce qu'il lit d'App.jsx\n// vient de l'import ci-dessous (liaisons vivantes : le thème \`C\` reste à jour).\n`;
for (const [m, specs] of importsUtiles) {
  const def = [...specs.values()].find((s) => s.type === 'ImportDefaultSpecifier');
  const ns = [...specs.values()].find((s) => s.type === 'ImportNamespaceSpecifier');
  const nommes = [...specs.values()].filter((s) => s.type === 'ImportSpecifier').map((s) => (s.imported.name === s.local.name ? s.local.name : `${s.imported.name} as ${s.local.name}`));
  if (ns) tete += `import * as ${ns.local.name} from ${JSON.stringify(rel(m))};\n`;
  const parts = []; if (def) parts.push(def.local.name); if (nommes.length) parts.push(`{ ${nommes.join(', ')} }`);
  if (parts.length) tete += `import ${parts.join(', ')} from ${JSON.stringify(rel(m))};\n`;
}
if (aExporter.size) tete += `import { ${[...aExporter].sort().join(', ')} } from "../App.jsx";\n`;
const corps = trie.map((i) => tranche(i)).join('');
const sortie = tete + corps + `\n\nexport { ${racines.join(', ')} };\n`;
const dest = path.join(R, 'src/ecrans', fichier + '.jsx');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, sortie);
// App.jsx : retirer le groupe, poser les racines paresseuses, exporter
let out = ''; let pos = 0;
for (const i of trie) {
  out += src.slice(pos, debut(i));
  if (racines.some((n) => noms[i].includes(n))) {
    const n = noms[i].find((x) => racines.includes(x));
    out += `\n// ${n} : chargé à la demande (src/ecrans/${fichier}.jsx).\nconst ${n} = paresseux(() => import('./ecrans/${fichier}.jsx'), '${n}');`;
  }
  pos = body[i].end;
}
out += src.slice(pos);
// export des noms nécessaires (un bloc par fichier découpé, en fin d'App.jsx)
const dejaExportes = new Set(body.filter((s) => s.type === 'ExportNamedDeclaration').flatMap((s) => (s.specifiers || []).map((x) => x.local.name).concat(noms[body.indexOf(s)])));
const nouveaux = [...aExporter].filter((n) => !dejaExportes.has(n)).sort();
if (nouveaux.length) out = out.replace(/\s*$/, '') + `\n\n// Lu par src/ecrans/${fichier}.jsx (chargé à la demande).\nexport { ${nouveaux.join(', ')} };\n`;
fs.writeFileSync(APP, out);
console.log('écrit', path.relative(R, dest));
