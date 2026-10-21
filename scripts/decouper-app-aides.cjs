#!/usr/bin/env node
// Seconde passe de la découpe (scripts/decouper-app.cjs) : une aide d'App.jsx
// (fonction, constante sans effet au chargement) que SEUL un écran découpé lit —
// App.jsx ne l'exporte que pour lui — le rejoint dans src/ecrans/<fichier>.jsx.
// ⚠️ Jamais une aide qu'un script (audit, banc) cite par son nom : les audits
// exécutent les règles d'App.jsx en les y lisant (§6) ; elles y restent.
// Répète jusqu'à ce que plus rien ne bouge. `--essai` liste sans écrire.
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..');
const parser = require(path.join(R, 'node_modules/@babel/parser'));
const traverse = require(path.join(R, 'node_modules/@babel/traverse')).default;
const essai = process.argv.includes('--essai');
const APP = path.join(R, 'src/App.jsx');
const DIR = path.join(R, 'src/ecrans');
// Tout le texte des scripts (audits, bancs) : un nom qui y paraît reste dans App.jsx.
const textesScripts = [];
const lire = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) { if (!/^(fx|node_modules)$/.test(f.name)) lire(p); } else if (/\.(c?js|mjs|sh|json)$/.test(f.name) && !/decouper-app/.test(f.name)) textesScripts.push(fs.readFileSync(p, 'utf8')); } };
lire(path.join(R, 'scripts'));
const scripts = textesScripts.join('\n');
const citeParScript = (n) => new RegExp('(^|[^A-Za-z0-9_$])' + n.replace(/\$/g, '\\$') + '([^A-Za-z0-9_$]|$)').test(scripts);
const pur = (d) => {
  if (d.type === 'FunctionDeclaration') return true;
  if (d.type !== 'VariableDeclaration') return false;
  const ok = (e) => { if (!e) return true; switch (e.type) {
    case 'ArrowFunctionExpression': case 'FunctionExpression': case 'StringLiteral': case 'NumericLiteral': case 'BooleanLiteral': case 'NullLiteral': case 'RegExpLiteral': return true;
    case 'TemplateLiteral': return e.expressions.length === 0;
    case 'ArrayExpression': return e.elements.every((x) => x && ok(x));
    case 'ObjectExpression': return e.properties.every((p) => p.type === 'ObjectProperty' && !p.computed && ok(p.value));
    case 'UnaryExpression': return ok(e.argument);
    default: return false; } };
  return d.declarations.every((v) => v.id.type === 'Identifier' && ok(v.init));
};
let tours = 0, total = 0;
for (;;) {
  const src = fs.readFileSync(APP, 'utf8');
  const ast = parser.parse(src, { sourceType: 'module', plugins: ['jsx'] });
  const body = ast.program.body;
  let bindings; traverse(ast, { Program(p) { bindings = p.scope.bindings; p.stop(); } });
  const top = (p) => { let q = p; while (q.parentPath && q.parentPath.node !== ast.program) q = q.parentPath; return q.node; };
  // Les blocs d'export de la découpe : « // Lu par src/ecrans/<f>.jsx » puis export { … }
  const blocs = body.filter((s) => s.type === 'ExportNamedDeclaration' && !s.declaration && !s.source);
  const fichierDe = new Map(); // nom exporté -> [fichiers]
  for (const b of blocs) {
    const avant = src.slice(Math.max(0, b.start - 200), b.start);
    const m = [...avant.matchAll(/Lu par src\/ecrans\/([a-z0-9_-]+)\.jsx/g)].pop();
    if (!m) continue;
    for (const sp of b.specifiers) { const n = sp.local.name; if (!fichierDe.has(n)) fichierDe.set(n, []); fichierDe.get(n).push(m[1]); }
  }
  // Qui importe vraiment quoi (un nom peut être exporté pour un écran et lu par deux)
  const lecteurs = new Map();
  for (const f of fs.readdirSync(DIR)) {
    const t = fs.readFileSync(path.join(DIR, f), 'utf8');
    const m = t.match(/import \{([^}]*)\} from "\.\.\/App\.jsx";/);
    if (!m) continue;
    for (const n of m[1].split(',').map((x) => x.trim()).filter(Boolean)) { if (!lecteurs.has(n)) lecteurs.set(n, new Set()); lecteurs.get(n).add(f.replace(/\.jsx$/, '')); }
  }
  const aBouger = []; // {nom, fichier, stmt}
  for (const [nom, b] of Object.entries(bindings)) {
    const s = top(b.path);
    if (s.type === 'ImportDeclaration' || s.type === 'ExportNamedDeclaration') continue;
    if (!lecteurs.has(nom) || lecteurs.get(nom).size !== 1) continue;
    const decls = s.type === 'VariableDeclaration' ? s.declarations : [s];
    if (decls.length !== 1 || !pur(s)) continue;
    // Ses seules références dans App.jsx : le bloc d'export.
    const refs = b.referencePaths.filter((r) => top(r) !== s);
    if (!refs.every((r) => blocs.includes(top(r)))) continue;
    if (b.constantViolations.length) continue;
    if (citeParScript(nom)) continue;
    // ⚠️ Une aide qui RÉASSIGNE une variable d'App.jsx (`_comptesEbay = null`)
    // ne peut pas partir : importée, cette variable serait en lecture seule.
    let ecritApp = false;
    const sp0 = b.path; const st0 = sp0.isVariableDeclarator() ? sp0.parentPath : sp0;
    st0.traverse({ 'AssignmentExpression|UpdateExpression'(ap) {
      const ids = ap.isAssignmentExpression() ? Object.keys(ap.get('left').getBindingIdentifiers()) : (ap.node.argument.type === 'Identifier' ? [ap.node.argument.name] : []);
      for (const n of ids) { const nb = ap.scope.getBinding(n); if (nb && nb.scope.block === ast.program && top(nb.path) !== s) ecritApp = true; }
    } });
    if (ecritApp) continue;
    aBouger.push({ nom, fichier: [...lecteurs.get(nom)][0], s });
  }
  if (!aBouger.length) break;
  tours++;
  if (essai) { console.log(aBouger.map((x) => `${x.nom}→${x.fichier} (${x.s.end - x.s.start})`).join('\n')); console.log('total', aBouger.reduce((a, x) => a + x.s.end - x.s.start, 0)); break; }
  // Ce que chaque aide déplacée lit d'App.jsx (pour l'importer dans l'écran)
  const besoins = new Map(); // fichier -> Set(noms à importer d'App) ; imports de modules -> Map
  const modules = new Map(); // fichier -> Map(source -> Map(local -> spec))
  const bougeNoms = new Set(aBouger.map((x) => x.nom));
  for (const x of aBouger) {
    const p = traverse.NodePath ? null : null;
    const sp = bindings[x.nom].path; const stmtPath = sp.isVariableDeclarator() ? sp.parentPath : sp;
    stmtPath.traverse({ Identifier(ip) {
      if (!ip.isReferencedIdentifier()) return;
      const nb = ip.scope.getBinding(ip.node.name);
      if (!nb || nb.scope.block !== ast.program) return;
      const ds = top(nb.path);
      if (ds === x.s) return;
      if (ds.type === 'ImportDeclaration') {
        if (!modules.has(x.fichier)) modules.set(x.fichier, new Map());
        const mm = modules.get(x.fichier); if (!mm.has(ds.source.value)) mm.set(ds.source.value, new Map());
        mm.get(ds.source.value).set(nb.path.node.local.name, nb.path.node);
        return;
      }
      if (bougeNoms.has(ip.node.name) && aBouger.find((y) => y.nom === ip.node.name).fichier === x.fichier) return;
      if (!besoins.has(x.fichier)) besoins.set(x.fichier, new Set());
      besoins.get(x.fichier).add(ip.node.name);
    } });
  }
  // App.jsx : retirer les déclarations ; ajuster les blocs d'export
  let out = src;
  const debut = (s) => { const i = body.indexOf(s); return i === 0 ? 0 : body[i - 1].end; };
  const coupes = aBouger.map((x) => ({ a: debut(x.s), b: x.s.end, txt: src.slice(debut(x.s), x.s.end), x }));
  for (const c of [...coupes].sort((p, q) => q.a - p.a)) out = out.slice(0, c.a) + out.slice(c.b);
  // retirer les noms déplacés des blocs d'export, ajouter les nouveaux besoins
  out = out.replace(/export \{ ([^}]*) \};/g, (m, liste) => {
    const garde = liste.split(',').map((x) => x.trim()).filter((n) => n && !bougeNoms.has(n));
    return garde.length ? `export { ${garde.join(', ')} };` : '';
  });
  const nouveauxExports = new Set();
  for (const [, ns] of besoins) for (const n of ns) nouveauxExports.add(n);
  const dejaExp = new Set([...out.matchAll(/export \{ ([^}]*) \};/g)].flatMap((m) => m[1].split(',').map((x) => x.trim())));
  const ajout = [...nouveauxExports].filter((n) => !dejaExp.has(n)).sort();
  if (ajout.length) out = out.replace(/\s*$/, '') + `\n\n// Lu par src/ecrans (aides déplacées).\nexport { ${ajout.join(', ')} };\n`;
  fs.writeFileSync(APP, out);
  // Écrans : ajouter les aides (avant le code) et compléter les imports
  for (const f of new Set(aBouger.map((x) => x.fichier))) {
    const p = path.join(DIR, f + '.jsx');
    let t = fs.readFileSync(p, 'utf8');
    const miens = coupes.filter((c) => c.x.fichier === f).sort((p1, p2) => p1.a - p2.a);
    const ajoutTxt = miens.map((c) => c.txt).join('');
    // retirer de l'import d'App les noms désormais locaux, ajouter les besoins
    t = t.replace(/import \{([^}]*)\} from "\.\.\/App\.jsx";/, (m, liste) => {
      const s = new Set(liste.split(',').map((x) => x.trim()).filter(Boolean));
      for (const c of miens) s.delete(c.x.nom);
      for (const n of besoins.get(f) || []) if (!miens.some((c) => c.x.nom === n)) s.add(n);
      return `import { ${[...s].sort().join(', ')} } from "../App.jsx";`;
    });
    // imports de modules
    const rel = (m) => (m.startsWith('.') ? (m.startsWith('./') ? '../' + m.slice(2) : '../' + m) : m);
    let imps = '';
    for (const [m, specs] of modules.get(f) || []) {
      for (const [local, sp] of specs) {
        if (new RegExp('(^|[^A-Za-z0-9_$])' + local + '([^A-Za-z0-9_$]|$)').test(t.split('\n').filter((l) => l.startsWith('import ')).join('\n'))) continue;
        if (sp.type === 'ImportDefaultSpecifier') imps += `import ${local} from ${JSON.stringify(rel(m))};\n`;
        else if (sp.type === 'ImportNamespaceSpecifier') imps += `import * as ${local} from ${JSON.stringify(rel(m))};\n`;
        else imps += `import { ${sp.imported.name === local ? local : sp.imported.name + ' as ' + local} } from ${JSON.stringify(rel(m))};\n`;
      }
    }
    const i = t.indexOf('import { '); const fin = t.indexOf('\n', t.indexOf('from "../App.jsx";')) + 1;
    t = t.slice(0, fin) + imps + ajoutTxt + t.slice(fin);
    fs.writeFileSync(p, t);
  }
  total += aBouger.length;
  console.log(`tour ${tours} : ${aBouger.length} aides déplacées`);
  if (tours > 20) break;
}
console.log('fin :', total, 'aides déplacées');
