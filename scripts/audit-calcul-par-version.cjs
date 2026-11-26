// Audit : un calcul gardé « par version des données » (`useCalculParVersion`, src/calculParesseux.js) liste TOUT ce
// qu'il lit dans son composant (24 nov., vitesse-lectures-toucher).
//
// `cartesColis` et `listeEnvoyes` (src/ecrans/Comptabilite.jsx) ne sont plus refaits à chaque rendu : leur valeur est
// gardée tant que les identités rendues par leur `cle()` ne changent pas. Une donnée lue par le calcul mais ABSENTE de
// `cle()` rendrait une liste périmée (un colis parti encore « à envoyer ») sans aucune erreur. Ce contrôle refait l'analyse
// des lectures avec Babel : depuis la fonction de calcul, il suit chaque fonction du composant qu'elle appelle
// (transitivement, y compris celles faites par `memoVersion`) jusqu'aux états, `useMemo`, propriétés et valeurs du
// composant ; chacune doit être dans `cle()`. Il signale aussi ce que `cle()` ne peut pas voir : une lecture de
// `ref.current` (hors `memosVersion`, dont les clés sont suivies) ou d'un objet mutable importé autre que `_harvestSeen`
// (heure de capture, au plus 60 s de retard : la durée de garde).
//
//   node scripts/audit-calcul-par-version.cjs            contrôle
//   node scripts/audit-calcul-par-version.cjs --liste    imprime la liste attendue de chaque calcul
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..');
let ko = 0;
const ok = (m) => console.log('✅ ' + m);
const nok = (m, d) => { ko++; console.log('❌ ' + m + (d ? '\n   ' + d : '')); };
const parser = require(path.join(R, 'node_modules', '@babel', 'parser'));
const traverse = require(path.join(R, 'node_modules', '@babel', 'traverse')).default;

const FICHIER = path.join(R, 'src', 'ecrans', 'Comptabilite.jsx');
const COMPOSANT = 'Comptabilite';
const CALCULS = ['cartesColis', 'listeEnvoyes'];
const MUTABLES_ADMIS = new Set(['_harvestSeen']);
const REFS_ADMISES = new Set(['memosVersion']);

const src = fs.readFileSync(FICHIER, 'utf8');
const ast = parser.parse(src, { sourceType: 'module', plugins: ['jsx'], errorRecovery: true });
let compPath = null;
traverse(ast, {
  FunctionDeclaration(p) { if (!compPath && p.node.id && p.node.id.name === COMPOSANT) compPath = p; },
  VariableDeclarator(p) { if (!compPath && p.node.id.name === COMPOSANT && p.node.init && /Function/.test(p.node.init.type)) compPath = p.get('init'); },
});
if (!compPath) { nok(`le composant ${COMPOSANT} est trouvé`); process.exit(1); }
const portee = compPath.scope;
const genre = (nom) => {
  const b = portee.bindings[nom]; if (!b) return null;
  if (b.kind === 'param') return 'prop';
  const d = b.path.node;
  if (d.type === 'FunctionDeclaration') return 'fn';
  if (d.type !== 'VariableDeclarator' || !d.init) return 'valeur';
  const i = d.init;
  if (/Function/.test(i.type)) return 'fn';
  if (i.type === 'CallExpression' && i.callee.name === 'memoVersion') return 'fn';
  if (i.type === 'CallExpression' && i.callee.name === 'useRef') return 'ref';
  return 'valeur';
};
// Ce que lit `nomCalc` (transitivement par les fonctions du composant).
function lectures(nomCalc) {
  const vus = new Set(), feuilles = new Set(), mutables = new Set(), refs = new Set();
  const visiter = (nom) => {
    if (vus.has(nom)) return; vus.add(nom);
    const g = genre(nom); if (!g) return;
    if (g === 'ref') { if (!REFS_ADMISES.has(nom)) refs.add(nom); return; }
    if (g !== 'fn') { if (!/^_\w*Memo$/.test(nom)) feuilles.add(nom); return; }   // `_xMemo` : la mémoire d'UN rendu
    const b = portee.bindings[nom];
    const p = b.path.node.type === 'VariableDeclarator' ? b.path.get('init') : b.path;
    p.traverse({ Identifier(q) {
      if (!q.isReferencedIdentifier()) return;
      const n = q.node.name, bb = q.scope.getBinding(n);
      if (bb && bb === portee.bindings[n]) visiter(n);
      else if (bb && bb.kind === 'module' && /^_/.test(n) && !MUTABLES_ADMIS.has(n)) mutables.add(n);
      else if (bb && bb.scope.block.type === 'Program' && (bb.kind === 'let' || bb.kind === 'var')) mutables.add(n);
    } });
  };
  visiter(nomCalc);
  return { feuilles, mutables, refs };
}
// La liste écrite dans `cle()` : `useCalculParVersion(() => xCalc(), () => [a, b, …], 'x', …)`.
function cleEcrite(nom) {
  let trouve = null;
  traverse(ast, { CallExpression(p) {
    const n = p.node; if (n.callee.name !== 'useCalculParVersion') return;
    const a2 = n.arguments[2]; if (!a2 || a2.type !== 'StringLiteral' || a2.value !== nom) return;
    const f = n.arguments[1]; const corps = f && f.body;
    if (!corps || corps.type !== 'ArrayExpression') { trouve = { erreur: '`cle()` doit rendre un tableau littéral' }; return; }
    // Un nom, ou l'appel sans argument d'une fonction du composant qui lit hors de l'état (`reglesNumeros()`) : sa VALEUR
    // (un texte) est comparée.
    trouve = { ids: corps.elements.map((e) => (e && e.type === 'Identifier' ? e.name : e && e.type === 'CallExpression' && !e.arguments.length && e.callee.type === 'Identifier' && genre(e.callee.name) === 'fn' ? e.callee.name + '()' : null)), calc: n.arguments[0] };
  } }, compPath.scope, compPath);
  return trouve;
}
for (const nom of CALCULS) {
  const L = lectures(nom + 'Calc');
  if (process.argv.includes('--liste')) { console.log(`${nom} : ${[...L.feuilles].sort().join(', ')}`); continue; }
  const c = cleEcrite(nom);
  if (!c) { nok(`${nom} est gardé par version (\`useCalculParVersion\`)`); continue; }
  if (c.erreur) { nok(`${nom} : ${c.erreur}`); continue; }
  if (c.ids.includes(null)) { nok(`${nom} : \`cle()\` ne liste que des noms`); continue; }
  const manquent = [...L.feuilles].filter((x) => !c.ids.includes(x));
  manquent.length ? nok(`${nom} : tout ce qu'il lit est dans \`cle()\``, 'absent : ' + manquent.join(', ')) : ok(`${nom} : les ${L.feuilles.size} données qu'il lit sont dans \`cle()\``);
  const enTrop = c.ids.filter((x) => !genre(x.replace(/\(\)$/, '')));
  enTrop.length ? nok(`${nom} : \`cle()\` ne nomme que des liaisons du composant`, enTrop.join(', ')) : ok(`${nom} : \`cle()\` ne nomme que des liaisons du composant`);
  L.mutables.size ? nok(`${nom} : aucune lecture d'un objet mutable de module (invisible à \`cle()\`)`, [...L.mutables].join(', ')) : ok(`${nom} : aucune lecture d'un objet mutable de module hors \`_harvestSeen\``);
  L.refs.size ? nok(`${nom} : aucune lecture d'une \`ref\` (invisible à \`cle()\`)`, [...L.refs].join(', ')) : ok(`${nom} : aucune lecture d'une \`ref\` hors \`memosVersion\``);
  const calc = c.calc && c.calc.body && c.calc.body.type === 'CallExpression' && c.calc.body.callee.name;
  calc === nom + 'Calc' ? ok(`${nom} : le calcul gardé est \`${nom}Calc\``) : nok(`${nom} : le calcul gardé est \`${nom}Calc\``, String(calc));
}
// La règle elle-même : rien n'est gardé si une identité change ; jamais plus de 60 s.
{
  const CP = fs.readFileSync(path.join(R, 'src', 'calculParesseux.js'), 'utf8');
  const f = CP.slice(CP.indexOf('export function useCalculParVersion'), CP.indexOf('export function useCalculParVersion') + 900);
  /e\.k\.every\(\(x, i\) => Object\.is\(x, k\[i\]\)\)/.test(f) && /t - e\.at < dureeMs/.test(f) && /dureeMs = 60000/.test(f)
    ? ok('la garde compare CHAQUE identité et ne dépasse pas 60 s') : nok('la garde compare chaque identité et ne dépasse pas 60 s');
}
if (!process.argv.includes('--liste')) { console.log(ko ? `\n${ko} défaut(s)` : '\nTout est vert.'); process.exit(ko ? 1 : 0); }
