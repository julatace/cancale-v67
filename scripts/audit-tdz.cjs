// Audit : aucun code exécuté AU RENDU ne lit une constante déclarée plus bas
// dans le même composant (§4.6, le piège TDZ).
//
// Un `useMemo`, un initialiseur de `useState`, un tableau de dépendances ou une
// simple expression s'exécutent IMMÉDIATEMENT, dans l'ordre du fichier. S'ils
// lisent un `const` déclaré plus bas, React lève « Cannot access 'X' before
// initialization » et l'écran tombe. `npm run build` ne le voit pas, et le
// garde-fou d'écran rend un vrai texte — les bancs sans fixtures non plus.
// Payé au moins cinq fois (Achats, `balayeFamille`, `aucunEmailDeSuivi`…) ; la
// dernière (#407, `linkedBuyIds` posé au-dessus de `saleOv`) tuait Ma journée,
// Ventes, Annonces et Achats EN PRODUCTION.
//
// On suit la LIAISON réelle de chaque identifiant (portée de Babel), pas son
// nom : un paramètre ou une variable locale du même nom n'est pas un défaut.
// Les fonctions qui ne s'exécutent pas au rendu (gestionnaires, `useEffect`,
// `useCallback`) sont ignorées ; celles qui s'exécutent tout de suite (`useMemo`,
// `useState(() => …)`, `.map(…)` dans du code immédiat, fonction appelée sur
// place) sont suivies.
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..');
let ko = 0;
const ok = (m) => console.log('✅ ' + m);
const nok = (m, d) => { ko++; console.log('❌ ' + m + (d ? '\n   ' + d : '')); };

let parser, traverse;
try {
  parser = require(path.join(R, 'node_modules', '@babel', 'parser'));
  traverse = require(path.join(R, 'node_modules', '@babel', 'traverse')).default;
} catch (e) {
  nok('l\'analyseur Babel est disponible', 'node_modules/@babel/{parser,traverse} introuvables — l\'audit ne peut rien vérifier : ' + e.message);
  process.exit(1);
}

// Appels dont la fonction en argument s'exécute pendant le rendu.
const HOOKS_IMMEDIATS = { useMemo: [0], useState: [0], useReducer: [2] };
const METHODES_IMMEDIATES = new Set(['map', 'forEach', 'filter', 'reduce', 'reduceRight', 'some', 'every', 'find', 'findIndex',
  'findLast', 'findLastIndex', 'flatMap', 'sort', 'toSorted', 'from']);
const nomAppele = (callee) => {
  if (!callee) return '';
  if (callee.type === 'Identifier') return callee.name;
  if (callee.type === 'MemberExpression' && !callee.computed && callee.property.type === 'Identifier') return callee.property.name;
  return '';
};
const estImmediate = (fn) => {
  const p = fn.parentPath;
  if (!p || !p.isCallExpression()) return false;
  if (p.node.callee === fn.node) return true;                    // (() => …)()
  if (fn.listKey !== 'arguments') return false;
  const nom = nomAppele(p.node.callee);
  if (HOOKS_IMMEDIATS[nom]) return HOOKS_IMMEDIATS[nom].includes(fn.key);
  return METHODES_IMMEDIATES.has(nom) && fn.key === 0;
};

const fichiers = fs.readdirSync(path.join(R, 'src')).filter((f) => /\.jsx?$/.test(f)).map((f) => 'src/' + f);
const defauts = [];
let fonctions = 0;
for (const f of fichiers) {
  const src = fs.readFileSync(path.join(R, f), 'utf8');
  let ast;
  try { ast = parser.parse(src, { sourceType: 'module', plugins: ['jsx'], errorRecovery: false }); }
  catch (e) { nok(`${f} se lit`, e.message); continue; }
  traverse(ast, {
    Function(fnPath) {
      const corps = fnPath.get('body');
      if (!corps.isBlockStatement()) return;
      fonctions++;
      const portee = fnPath.scope;
      const instructions = corps.get('body');
      const rang = new Map(instructions.map((s, i) => [s.node, i]));
      instructions.forEach((stmt, i) => {
        const visiter = {
          Function(inner) { if (!estImmediate(inner)) inner.skip(); },
          ReferencedIdentifier(ref) {
            const b = ref.scope.getBinding(ref.node.name);
            if (!b || b.scope !== portee || (b.kind !== 'const' && b.kind !== 'let')) return;
            // ⚠️ AUTO-RÉFÉRENCE : « X » lu DANS son propre initialiseur, évalué
            //    tout de suite (les fonctions différées sont déjà ignorées plus
            //    haut par `inner.skip()`) → TDZ « Cannot access X before
            //    initialization ». Attrapé le 8 octobre : un `replace_all` avait
            //    transformé `const selEff = … : String(…)` en
            //    `const selEff = … : selEff;` — écran blanc en prod sur tous les
            //    écrans Vinted/Leboncoin/eBay, `npm run build` vert, et CET audit
            //    passait car la déclaration est sur la MÊME ligne que l'usage
            //    (`j <= i`, donc ignoré). `b.path` est le VariableDeclarator : si
            //    la référence est un descendant de SON déclarateur, elle vit dans
            //    l'init, donc elle se lit avant d'exister. `const a=1,b=a` n'est
            //    PAS concerné (la ref vit dans le déclarateur de `b`, pas de `a`).
            if (b.path.isVariableDeclarator() && ref.findParent((p) => p.node === b.path.node)) {
              defauts.push(`${f}:${ref.node.loc.start.line} « ${ref.node.name} » est lu dans son propre initialiseur (auto-référence → TDZ au rendu)`);
              return;
            }
            const decl = b.path.parentPath;              // VariableDeclaration
            const j = decl ? rang.get(decl.node) : undefined;
            if (j == null || j <= i) return;
            defauts.push(`${f}:${ref.node.loc.start.line} lit « ${ref.node.name} », déclaré plus bas (ligne ${b.path.node.loc.start.line})`);
          },
        };
        // L'instruction elle-même : une fonction déclarée ici ne s'exécute pas
        // au rendu (on ne la parcourt que si elle est appelée sur place).
        if (stmt.isFunctionDeclaration()) return;
        stmt.traverse(visiter);
        // `stmt.traverse` ne visite pas le nœud racine : une expression nue
        // réduite à un identifiant est rare, on la couvre quand même.
        if (stmt.isExpressionStatement() && stmt.get('expression').isIdentifier()) visiter.ReferencedIdentifier(stmt.get('expression'));
      });
    },
  });
}

const uniques = [...new Set(defauts)];
uniques.length === 0
  ? ok(`aucune lecture avant déclaration dans le code exécuté au rendu (${fonctions} fonctions, ${fichiers.length} fichiers)`)
  : nok(`${uniques.length} lecture(s) d'une constante AVANT sa déclaration — l'écran tombe au premier rendu`, uniques.slice(0, 20).join('\n   '));

console.log(ko ? `\n${ko} contrôle(s) en échec.` : '\nAucun écran ne peut tomber sur « Cannot access … before initialization ».');
process.exit(ko ? 1 : 0);
