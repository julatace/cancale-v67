#!/usr/bin/env node
// Après une découpe (scripts/decouper-app.cjs) : retire d'App.jsx les imports que
// plus rien n'y lit. Sans ça, un module que seul un écran découpé utilise
// (facturation électronique, Super PDP…) resterait dans le morceau App.
// `--essai` liste sans écrire.
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..');
const parser = require(path.join(R, 'node_modules/@babel/parser'));
const traverse = require(path.join(R, 'node_modules/@babel/traverse')).default;
const APP = path.join(R, 'src/App.jsx');
const src = fs.readFileSync(APP, 'utf8');
const ast = parser.parse(src, { sourceType: 'module', plugins: ['jsx'] });
let bindings; traverse(ast, { Program(p) { bindings = p.scope.bindings; p.stop(); } });
const morts = new Set();
for (const [nom, b] of Object.entries(bindings)) if (b.kind === 'module' && !b.referenced) morts.add(nom);
console.log('imports sans lecteur :', [...morts].join(', ') || '—');
if (process.argv.includes('--essai') || !morts.size) process.exit(0);
let out = src;
const decls = ast.program.body.filter((s) => s.type === 'ImportDeclaration').sort((a, b) => b.start - a.start);
for (const d of decls) {
  const garder = d.specifiers.filter((s) => !morts.has(s.local.name));
  if (garder.length === d.specifiers.length) continue;
  let txt;
  if (!garder.length) txt = `import ${JSON.stringify(d.source.value)};`.replace(/^/, '// (import retiré : plus lu ici, voir src/ecrans) ') ;
  else {
    const def = garder.find((s) => s.type === 'ImportDefaultSpecifier');
    const ns = garder.find((s) => s.type === 'ImportNamespaceSpecifier');
    const nommes = garder.filter((s) => s.type === 'ImportSpecifier').map((s) => (s.imported.name === s.local.name ? s.local.name : `${s.imported.name} as ${s.local.name}`));
    const parts = []; if (def) parts.push(def.local.name); if (ns) parts.push(`* as ${ns.local.name}`); if (nommes.length) parts.push(`{ ${nommes.join(', ')} }`);
    txt = `import ${parts.join(', ')} from ${JSON.stringify(d.source.value)};`;
  }
  out = out.slice(0, d.start) + txt + out.slice(d.end);
}
fs.writeFileSync(APP, out);
console.log('App.jsx : imports morts retirés');
