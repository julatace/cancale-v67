// ════════════════════════════════════════════════════════════════════════════
//  DÉCOUPER App.jsx — l'outil du 8 nov. (démarrage léger,
//  docs/passation/2026-11-08-demarrage-leger.md)
//
//    node scripts/decouper-app.cjs src/App.jsx ecrans/Stock.jsx Garage,StockVinted,Inventory
//        → dit ce qui partirait (rien n'est écrit)
//    … --appliquer            écrit src/ecrans/Stock.jsx et retouche App.jsx
//    … --appliquer --feuille  la racine est une feuille (pastille « Ouverture… » pendant le chargement)
//
//  Découpe MÉCANIQUE (déplacer, jamais réécrire) : les RACINES (composants rendus par
//  App.jsx, en JSX seulement) partent avec tout ce que SEULES elles utilisent (graphe
//  des liaisons de tête de Babel). Ce que le module emprunte à App.jsx est exporté en
//  bas d'App.jsx (`export { … }`), les racines deviennent `aLaDemande(() => import(…))`.
//  Garde-fous :
//   · une instruction qui RÉAFFECTE une variable restée dans App ne part pas (un module
//     ne réaffecte pas une liaison importée) — passer par un poseur ;
//   · un bloc balisé `// <nom>` … `// </nom>` (règle partagée app = extension) ne se
//     coupe jamais ;
//   · un import qui ne sert plus qu'au module part avec lui, MAIS ses feuilles de style
//     restent importées dans App.jsx à sa place (la cascade ne bouge pas) ;
//   · chaque suite retirée laisse `// ⟦→ ecrans/X.jsx #k⟧` dans App.jsx et commence par
//     `// ⟦← App.jsx #k⟧` dans le module : scripts/_source-app.cjs recolle le texte
//     d'origine pour les audits.
//  Après : `npm run build`, audit-variables (chaque module importe tout ce qu'il lit),
//  audit-tdz, les audits qui lisaient App.jsx, et les captures avant/après (§4.11).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
const NM = path.join(__dirname, '..', 'node_modules', '@babel') + '/';
const parser = require(NM + 'parser');
const traverse = require(NM + 'traverse').default;

const [appFile, modRel, racinesArg] = process.argv.slice(2);
const appliquer = process.argv.includes('--appliquer');
const feuille = process.argv.includes('--feuille');
const racines = racinesArg.split(',').map((s) => s.trim()).filter(Boolean);
const src = fs.readFileSync(appFile, 'utf8');
const ast = parser.parse(src, { sourceType: 'module', plugins: ['jsx'], ranges: true });
const body = ast.program.body;
const starts = body.map((s) => s.start);
const idxDe = (pos) => { let lo = 0, hi = body.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (starts[m] <= pos) lo = m; else hi = m - 1; } return lo; };
let prog; traverse(ast, { Program(p) { prog = p; p.stop(); } });
const bindings = prog.scope.bindings;
// déclarant de chaque nom
const declDe = {}; // nom -> idx
const nomsDe = body.map(() => []);
for (const [nom, b] of Object.entries(bindings)) { const i = idxDe(b.identifier.start); declDe[nom] = i; nomsDe[i].push(nom); }
// arêtes
const aretes = body.map(() => new Set());
const affecte = body.map(() => new Set()); // idx -> noms affectés (hors déclarant)
const refsRacine = {}; // racine -> [{i, type}]
for (const [nom, b] of Object.entries(bindings)) {
  const j = declDe[nom];
  for (const rp of b.referencePaths) {
    const i = idxDe(rp.node.start);
    if (i !== j) aretes[i].add(j);
    if (racines.includes(nom) && i !== j) {
      const par = rp.parentPath; let type = par ? par.node.type : '?';
      if (type === 'JSXOpeningElement' || type === 'JSXClosingElement') type = 'jsx';
      (refsRacine[nom] = refsRacine[nom] || []).push({ ligne: rp.node.loc.start.line, type, i });
    }
  }
  for (const cv of b.constantViolations) { const i = idxDe(cv.node.start); if (i !== j) { aretes[i].add(j); affecte[i].add(nom); } }
}
for (const r of racines) if (declDe[r] == null) { console.error('racine inconnue', r); process.exit(2); }
const iRac = new Set(racines.map((r) => declDe[r]));
// fermeture des racines
const ferme = new Set();
const pile = [...iRac];
while (pile.length) { const i = pile.pop(); if (ferme.has(i)) continue; ferme.add(i); for (const j of aretes[i]) if (!ferme.has(j)) pile.push(j); }
// ce que le reste atteint (sans traverser les racines)
// Une instruction qui RÉAFFECTE une variable restée dans App ne peut pas partir (un module ne
// réaffecte pas une liaison importée) : elle reste dans App (épinglée), et on recommence.
const epingles = new Set();
const groupes = [];
{
  const ouv = [...src.matchAll(/^[ \t]*\/\/ <([a-z0-9][a-z0-9-]*)>/gm)];
  for (const o of ouv) {
    const f = src.indexOf(`// </${o[1]}>`, o.index);
    if (f < 0) continue;
    const g = []; for (let i = 0; i < body.length; i++) if (body[i].start >= o.index && body[i].start < f) g.push(i);
    // le bloc compte aussi l'instruction qui le CONTIENT (balises à l'intérieur d'une fonction)
    const ia = idxDe(o.index), ib = idxDe(f); for (let i = ia; i <= ib; i++) if (!g.includes(i) && body[i].end > o.index) g.push(i);
    if (g.length > 1) groupes.push(g);
  }
  if (groupes.length) console.log('blocs balisés :', groupes.length);
}
let dehors, M;
for (;;) {
  dehors = new Set();
  const pile2 = body.map((_, i) => i).filter((i) => !ferme.has(i) || epingles.has(i));
  while (pile2.length) { const i = pile2.pop(); if (dehors.has(i)) continue; dehors.add(i); for (const j of aretes[i]) if (!dehors.has(j) && !iRac.has(j)) pile2.push(j); }
  M = new Set([...ferme].filter((i) => !dehors.has(i)));
  let neuf = false;
  for (const i of M) for (const nom of affecte[i]) if (!M.has(declDe[nom]) && !iRac.has(i)) { epingles.add(i); neuf = true; }
  // Un bloc balisé (`// <nom>` … `// </nom>`, une règle partagée app = extension, §11) ne se coupe
  // jamais : s'il ne part pas en entier, il reste en entier.
  for (const g of groupes) { const dedans = g.filter((i) => M.has(i)); if (dedans.length && dedans.length < g.length) for (const i of dedans) if (!epingles.has(i)) { epingles.add(i); neuf = true; } }
  if (!neuf) break;
}
if (epingles.size) console.log('épinglées dans App (réaffectent une variable d’App) :', [...epingles].map((i) => body[i].loc.start.line).join(', '));
for (const i of iRac) if (dehors.has(i)) { console.error('racine atteinte hors JSX ?', body[i].id && body[i].id.name); }
// ne jamais déplacer import / export
const Mimp = new Set();
for (const i of [...M]) { const t = body[i].type; if (t === 'ImportDeclaration') { M.delete(i); Mimp.add(i); } else if (/^Export/.test(t)) { console.error('déplacement refusé (export):', t, body[i].loc.start.line); process.exit(3); } }
if (Mimp.size) console.log('imports qui ne servent plus qu’au module (retirés d’App) :', [...Mimp].map((i) => body[i].source.value).join(', '));
// problèmes
const problemes = [];
for (const i of M) for (const nom of affecte[i]) if (!M.has(declDe[nom])) problemes.push(`affecte ${nom} (App) depuis ligne ${body[i].loc.start.line}`);
for (const r of racines) for (const ref of (refsRacine[r] || [])) if (!M.has(ref.i) && ref.type !== 'jsx') problemes.push(`racine ${r} utilisée hors JSX ligne ${ref.ligne} (${ref.type})`);
for (const i of M) { const n = body[i]; if (n.type !== 'FunctionDeclaration' && n.type !== 'VariableDeclaration' && n.type !== 'ClassDeclaration') problemes.push(`instruction ${n.type} ligne ${n.loc.start.line}`); }
// besoins du module
const besoinsApp = new Set(), besoinsImport = new Map(); // idx import -> Set(noms)
for (const i of M) for (const j of aretes[i]) if (!M.has(j) || Mimp.has(j)) {
  for (const nom of nomsDe[j]) {
    // le nom est-il vraiment référencé depuis i ?
    const b = bindings[nom]; const utilise = b.referencePaths.some((rp) => idxDe(rp.node.start) === i) || b.constantViolations.some((cv) => idxDe(cv.node.start) === i);
    if (!utilise) continue;
    if (body[j].type === 'ImportDeclaration') { if (!besoinsImport.has(j)) besoinsImport.set(j, new Set()); besoinsImport.get(j).add(nom); }
    else besoinsApp.add(nom);
  }
}
const taille = [...M].reduce((a, i) => a + body[i].end - body[i].start, 0);
console.log(`module ${modRel} : ${M.size} instructions, ${Math.round(taille / 1024)} Ko ; ${besoinsApp.size} noms empruntés à App ; ${besoinsImport.size} imports`);
console.log('déplacées :', [...M].sort((a, b) => a - b).map((i) => nomsDe[i].join('+') || body[i].type).join(', '));
if (problemes.length) { console.log('PROBLÈMES :\n  ' + problemes.join('\n  ')); }
if (!appliquer) process.exit(0);
if (problemes.length && !process.argv.includes('--forcer')) { console.error('refusé : problèmes'); process.exit(4); }

// ── écriture ──
const modAbs = path.join(path.dirname(appFile), modRel);
const relDeMod = (spec) => { if (!spec.startsWith('.')) return spec; const abs = path.resolve(path.dirname(appFile), spec); let r = path.relative(path.dirname(modAbs), abs).split(path.sep).join('/'); if (!r.startsWith('.')) r = './' + r; return r; };
const appRel = (() => { let r = path.relative(path.dirname(modAbs), appFile).split(path.sep).join('/'); if (!r.startsWith('.')) r = './' + r; return r; })();
// Les SUITES d'instructions retirées d'App (consécutives) : chacune laisse dans App.jsx une balise
// « // ⟦→ ecrans/X.jsx #k⟧ » et commence dans le module par « // ⟦← App.jsx #k⟧ » — de quoi
// recoller le texte à sa place d'origine (scripts/_source-app.cjs : les audits lisent l'app entière).
const idxRetiresTous = [...M, ...Mimp].sort((a, b) => a - b);
const suiteDe = new Map(); { let k = 0; const ens = new Set(idxRetiresTous); for (const i of idxRetiresTous) { if (!ens.has(i - 1)) k++; suiteDe.set(i, k); } }
const debutSuite = (i) => suiteDe.get(i) !== suiteDe.get(i - 1);
const baliseApp = (k) => `\n// ⟦→ ${modRel} #${k}⟧`;
const baliseMod = (k) => `\n// ⟦← App.jsx #${k}⟧`;
// morceau d'une instruction = depuis la fin de la précédente (commentaires de tête compris)
const debutMorceau = (i) => (i === 0 ? 0 : body[i - 1].end);
let teteImp = '';
let tete = `// Découpé d'App.jsx (démarrage léger, 8 nov.) : chargé à la demande par App.jsx.\n// Déplacement MÉCANIQUE (le code est celui d'App.jsx, inchangé) — voir docs/passation/2026-11-08-demarrage-leger.md.\n`;
for (const [j, noms] of [...besoinsImport.entries()].sort((a, b) => a[0] - b[0])) {
  const imp = body[j]; const parts = []; let def = null, ns = null;
  const q = (v) => "'" + v.replace(/'/g, "\\'") + "'";
  // un import qui part EN ENTIER garde son texte d'origine (seul le chemin change)
  if (Mimp.has(j)) { const t = src.slice(debutMorceau(j), imp.end); const sl = imp.source; teteImp += (debutSuite(j) ? baliseMod(suiteDe.get(j)) : '') + t.slice(0, sl.start - debutMorceau(j)) + src[sl.start] + relDeMod(sl.value) + src[sl.start] + t.slice(sl.end - debutMorceau(j)); continue; }
  for (const sp of imp.specifiers) {
    if (!noms.has(sp.local.name)) continue;
    if (sp.type === 'ImportDefaultSpecifier') def = sp.local.name;
    else if (sp.type === 'ImportNamespaceSpecifier') ns = sp.local.name;
    else { const imported = sp.imported.type === 'StringLiteral' ? JSON.stringify(sp.imported.value) : sp.imported.name; parts.push(imported === sp.local.name ? imported : `${imported} as ${sp.local.name}`); }
  }
  const morceaux = [];
  if (def) morceaux.push(def);
  if (ns) morceaux.push(`* as ${ns}`);
  if (parts.length) morceaux.push(`{ ${parts.join(', ')} }`);
  tete += `import ${morceaux.join(', ')} from ${q(relDeMod(imp.source.value))};\n`;
}
if (besoinsApp.size) tete += `import { ${[...besoinsApp].sort().join(', ')} } from '${appRel}';\n`;
// corps du module, chemins relatifs des import() réécrits
const idxM = [...M].sort((a, b) => a - b);
const idxRetires = [...M, ...Mimp].sort((a, b) => a - b);
let corps = '';
for (const i of idxM) {
  const d = debutMorceau(i); let txt = src.slice(d, body[i].end);
  // import('./x') / new URL('./x', import.meta.url)
  const reecr = [];
  traverse(body[i], {
    noScope: true,
    Import(p) { const call = p.parentPath; const a = call.node.arguments && call.node.arguments[0]; if (a && a.type === 'StringLiteral' && a.value.startsWith('.')) reecr.push([a.start, a.end, src[a.start] + relDeMod(a.value) + src[a.start]]); },
    ImportExpression(p) { const a = p.node.source; if (a && a.type === 'StringLiteral' && a.value.startsWith('.')) reecr.push([a.start, a.end, src[a.start] + relDeMod(a.value) + src[a.start]]); },
    NewExpression(p) { const n = p.node; if (n.callee.name === 'URL' && n.arguments[0] && n.arguments[0].type === 'StringLiteral' && n.arguments[0].value.startsWith('.')) reecr.push([n.arguments[0].start, n.arguments[0].end, src[n.arguments[0].start] + relDeMod(n.arguments[0].value) + src[n.arguments[0].start]]); },
  }, prog.scope, null, prog);
  reecr.sort((a, b) => b[0] - a[0]);
  for (const [s, e, r] of reecr) txt = txt.slice(0, s - d) + r + txt.slice(e - d);
  if (reecr.length) console.log(`  chemins réécrits dans ${nomsDe[i].join('+')} : ${reecr.length}`);
  corps += (debutSuite(i) ? baliseMod(suiteDe.get(i)) : '') + txt;
}
const exportsMod = `\nexport { ${racines.join(', ')} };\n`;
fs.mkdirSync(path.dirname(modAbs), { recursive: true });
fs.writeFileSync(modAbs, tete + teteImp + '\n' + corps + exportsMod);
// App.jsx : retirer les morceaux, poser les racines paresseuses, compléter la liste d'exports
let out = '';
let curseur = 0;
// Un import retiré d'App qui portait des feuilles de style : elles restent importées ICI, à sa
// place (même ordre de cascade : le CSS du morceau App ne bouge pas).
const cssDe = (fichier, vus = new Set()) => {
  if (vus.has(fichier)) return []; vus.add(fichier);
  let t; try { t = fs.readFileSync(fichier, 'utf8'); } catch (_) { return []; }
  const res = [];
  for (const mm of t.matchAll(/^\s*import\s+(?:[^'";]*?\s+from\s+)?['"](\.[^'"]+)['"]/gm)) {
    let abs = path.resolve(path.dirname(fichier), mm[1]);
    if (/\.css$/.test(abs)) { res.push(abs); continue; }
    if (!/\.(jsx?|mjs)$/.test(abs)) { for (const e of ['.js', '.jsx']) if (fs.existsSync(abs + e)) { abs += e; break; } }
    res.push(...cssDe(abs, vus));
  }
  return res;
};
for (const i of idxRetires) {
  out += src.slice(curseur, debutMorceau(i)); curseur = body[i].end;
  if (debutSuite(i)) out += baliseApp(suiteDe.get(i));
  if (Mimp.has(i)) {
    const abs = path.resolve(path.dirname(appFile), body[i].source.value);
    const css = [...new Set(cssDe(fs.existsSync(abs) ? abs : abs + '.js'))];
    for (const c of css) { let r = path.relative(path.dirname(appFile), c).split(path.sep).join('/'); if (!r.startsWith('.')) r = './' + r; out += `\nimport '${r}'; // (8 nov.) style de ${body[i].source.value}, gardé à sa place (son écran est chargé à la demande)`; }
    if (css.length) console.log('  CSS gardés dans App :', css.map((c) => path.basename(c)).join(', '));
  }
}
out += src.slice(curseur);
const marque = '// ⟦démarrage léger⟧ racines paresseuses';
const lignesLazy = racines.map((r) => `const ${r} = aLaDemande(() => import('./${modRel}').then((m) => ({ default: m.${r} }))${feuille ? ', true' : ''});`).join('\n');
if (out.includes(marque)) out = out.replace(marque, marque + '\n' + lignesLazy);
else {
  const ancre = "const JournalEmails = aLaDemande(() => import('./JournalEmails.jsx'));";
  if (!out.includes(ancre)) { console.error('ancre absente'); process.exit(5); }
  out = out.replace(ancre, ancre + '\n// (8 nov., démarrage léger) Écrans sortis d’App.jsx vers src/ecrans/ (découpe mécanique) : chargés\n// quand ils sont rendus, comme les morceaux ci-dessus. Leur code n’a pas changé ; ce qu’ils empruntent\n// à App.jsx est exporté tout en bas (`export { … }`).\n' + marque + '\n' + lignesLazy);
}
const marqueExp = '// ⟦démarrage léger⟧ emprunts des écrans à la demande';
const re = /\/\/ ⟦démarrage léger⟧ emprunts des écrans à la demande\nexport \{ ([^}]*) \};\n/;
const m = out.match(re);
const deja = m ? m[1].split(',').map((s) => s.trim()).filter(Boolean) : [];
const dejaDecl = new Set(); for (const st of body) if (st.type === 'ExportNamedDeclaration' && st.declaration) { const d = st.declaration; if (d.id) dejaDecl.add(d.id.name); else if (d.declarations) for (const x of d.declarations) if (x.id.name) dejaDecl.add(x.id.name); }
const tous = [...new Set([...deja, ...besoinsApp])].filter((n) => !dejaDecl.has(n)).sort();
const bloc = `${marqueExp}\nexport { ${tous.join(', ')} };\n`;
if (m) out = out.replace(re, bloc); else out = out.replace(/\n*$/, '\n') + bloc;
fs.writeFileSync(appFile, out);
console.log('écrit', modAbs, 'et', appFile);
