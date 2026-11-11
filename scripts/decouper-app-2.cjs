#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  DÉCOUPER App.jsx, VERSION 2 — l'outil REJOUABLE du 11 nov.
//  (docs/passation/2026-11-11-decoupe-app.md ; l'outil d'avant : scripts/decouper-app.cjs)
//
//    node scripts/decouper-app-2.cjs                       → dit ce qui partirait (rien n'est écrit)
//    node scripts/decouper-app-2.cjs --appliquer           → écrit src/coeur/*.jsx|.js et retouche App.jsx
//    … --plan autre-plan.json   … --racine <arbre>   … --rapport rapport.json   … --seulement VueVentes,Auth
//
//  Le PLAN (scripts/decoupe-plan.json) nomme des BLOCS — jamais des numéros de ligne : l'outil
//  se rejoue tel quel sur n'importe quel App.jsx (le main du jour). Un bloc introuvable est
//  DIT (« absent ») et le reste du plan continue ; un bloc refusé est dit avec sa raison.
//
//  Trois sortes de modules :
//   · « ecran »  (chargé à la demande, React.lazy via `aLaDemande`) :
//       - `racines` : composants de TÊTE d'App.jsx rendus seulement en JSX. Ils partent avec
//         tout ce que SEULS eux utilisent (graphe des liaisons de tête de Babel, comme
//         decouper-app.cjs) ; ce qu'ils empruntent à App.jsx est exporté en bas d'App.jsx.
//       - `vues` : une branche `{condition && (…)}` du rendu d'un composant de tête (ex.
//         `curSub==='ventes'` de Comptabilite). La branche devient `<VueX v={{a, b, …}}/>` :
//         les valeurs du composant qu'elle lit lui sont PASSÉES (le même objet, au même
//         moment du rendu — rien n'est recalculé). Refusée si elle ÉCRIT une variable du
//         composant, si une variable qu'elle lit est réaffectée ailleurs qu'avant elle dans
//         le rendu (ou dans une fonction imbriquée), si elle appelle un hook (use…), lit
//         `this`/`arguments`, ou contient await/yield du composant.
//   · « pur »    (importé STATIQUEMENT par App.jsx, règles/hooks/constantes) : les blocs nommés
//         et TOUT ce qu'ils lisent en tête d'App.jsx partent ensemble ; refusé si l'un d'eux
//         lit une variable qui doit rester dans App (le module n'importe JAMAIS App.jsx :
//         aucun cycle, aucune zone morte TDZ), ou si une initialisation fait autre chose que
//         déclarer (appel, lecture du stockage… : elle tournerait plus tôt qu'avant).
//  Garde-fous communs :
//   · seul un bloc de TÊTE se déplace : un bloc nommé déclaré DANS un composant (il lit ses
//     variables — closure) est refusé, avec les variables qu'il lit ;
//   · une instruction qui RÉAFFECTE une variable restée dans App ne part pas ;
//   · une initialisation qui a un effet (appel, `new`…) reste dans App (dans un module à la
//     demande elle tournerait plus tard qu'avant) — et ce qu'elle lit reste avec elle ;
//   · un bloc balisé `// <nom>` … `// </nom>` (règle partagée app = extension) ne se coupe jamais ;
//   · import / export ne se déplacent pas (un import qui ne sert plus qu'au module part avec
//     lui, ses feuilles de style restent importées dans App.jsx à sa place : cascade intacte) ;
//   · l'ordre relatif des instructions est gardé (l'ordre d'évaluation dans le module est
//     celui d'App.jsx) ; un module « pur » est importé APRÈS tous les imports d'App.jsx.
//  Balises (ne pas les effacer) : chaque suite d'instructions retirée laisse
//  `// ⟦→ coeur/X.jsx #k⟧` dans App.jsx et commence par `// ⟦← App.jsx #k⟧` dans le module ;
//  une vue laisse `/*⟦→ coeur/X.jsx #vk⟧*/<VueX …/>/*⟦→/⟧*/` et son texte d'origine est entre
//  `/*⟦← App.jsx #vk⟧*/` et `/*⟦←/⟧*/`. scripts/_source-app.cjs recolle le texte d'origine
//  pour les audits (scripts/verifier-decoupe.cjs prouve que le texte recollé = l'avant).
//  Après : scripts/verifier-decoupe.cjs <avant> <après> (build, audits, tests, bancs, poids).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');

const args = process.argv.slice(2);
const opt = (nom, def) => { const i = args.indexOf(nom); return i >= 0 && args[i + 1] ? args[i + 1] : def; };
const RACINE = path.resolve(opt('--racine', path.join(__dirname, '..')));
const NM = path.join(RACINE, 'node_modules', '@babel') + '/';
const NM2 = path.join(__dirname, '..', 'node_modules', '@babel') + '/';
const req = (m) => { try { return require(NM + m); } catch (_) { return require(NM2 + m); } };
const parser = req('parser');
const traverse = req('traverse').default;
const generate = req('generator').default;

const APP = path.join(RACINE, 'src', 'App.jsx');
const PLAN = path.resolve(opt('--plan', path.join(__dirname, 'decoupe-plan.json')));
const APPLIQUER = args.includes('--appliquer');
const SEULEMENT = (opt('--seulement', '') || '').split(',').map((s) => s.trim()).filter(Boolean);
const RAPPORT = opt('--rapport', null);

const PRECHARGER_AIDE = "const prechargerAuRepos = (charger) => { try { if (typeof window === 'undefined') return; setTimeout(() => { const go = () => { try { charger().catch(() => {}); } catch (_) {} }; if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(go, { timeout: 8000 }); else go(); }, 4000); } catch (_) {} }; // ⟦découpe 2⟧";
const compact = (code) => generate(parser.parseExpression(code, { plugins: ['jsx'] }), { compact: true, comments: false }).code;
const compactNode = (n) => generate(n, { compact: true, comments: false }).code;
const ko = (n) => Math.round(n / 1024);

// ── analyse d'un texte App.jsx ──────────────────────────────────────────────
function analyser(src) {
  const ast = parser.parse(src, { sourceType: 'module', plugins: ['jsx'], ranges: true });
  const body = ast.program.body;
  const starts = body.map((s) => s.start);
  const idxDe = (pos) => { let lo = 0, hi = body.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (starts[m] <= pos) lo = m; else hi = m - 1; } return lo; };
  let prog; traverse(ast, { Program(p) { prog = p; p.stop(); } });
  const bindings = prog.scope.bindings;
  const declDe = {}; const nomsDe = body.map(() => []);
  for (const [nom, b] of Object.entries(bindings)) { const i = idxDe(b.identifier.start); declDe[nom] = i; nomsDe[i].push(nom); }
  return { src, ast, body, idxDe, prog, bindings, declDe, nomsDe };
}

// Une initialisation « sans effet » : déclarer, rien d'autre (fonctions, littéraux, objets/
// tableaux de tels, opérations sur tels, `Object.freeze(…)`, `new Set/Map(…)` de tels).
function sansEffet(n) {
  if (!n) return true;
  switch (n.type) {
    case 'FunctionExpression': case 'ArrowFunctionExpression': case 'StringLiteral': case 'NumericLiteral':
    case 'BooleanLiteral': case 'NullLiteral': case 'RegExpLiteral': case 'BigIntLiteral': case 'Identifier':
      return true;
    case 'TemplateLiteral': return n.expressions.every(sansEffet);
    case 'ArrayExpression': return n.elements.every((e) => !e || (e.type === 'SpreadElement' ? sansEffet(e.argument) : sansEffet(e)));
    case 'ObjectExpression': return n.properties.every((p) => p.type === 'SpreadElement' ? sansEffet(p.argument) : p.type === 'ObjectMethod' ? !p.computed || sansEffet(p.key) : (!p.computed || sansEffet(p.key)) && sansEffet(p.value));
    case 'UnaryExpression': return n.operator !== 'delete' && sansEffet(n.argument);
    case 'BinaryExpression': case 'LogicalExpression': return sansEffet(n.left) && sansEffet(n.right);
    case 'ConditionalExpression': return sansEffet(n.test) && sansEffet(n.consequent) && sansEffet(n.alternate);
    case 'MemberExpression': return sansEffet(n.object) && (!n.computed || sansEffet(n.property));
    case 'CallExpression': {
      const c = n.callee;
      // envelopper un composant : React.memo / forwardRef / lazy / aLaDemande (rien ne s'exécute avant le rendu)
      const nomC = c.type === 'Identifier' ? c.name : (c.type === 'MemberExpression' && !c.computed && c.object.type === 'Identifier' && c.object.name === 'React' ? c.property.name : '');
      if (['memo', 'forwardRef', 'lazy', 'aLaDemande'].includes(nomC) && n.arguments.length && n.arguments.every((a) => a.type !== 'SpreadElement' && sansEffet(a))) return true;
      const nom = c.type === 'MemberExpression' && c.object.type === 'Identifier' && !c.computed ? c.object.name + '.' + c.property.name : '';
      return ['Object.freeze', 'Object.keys', 'Object.entries', 'Object.fromEntries', 'Object.assign'].includes(nom) && n.arguments.every((a) => a.type !== 'SpreadElement' && sansEffet(a)) && (nom !== 'Object.assign' || (n.arguments[0] && n.arguments[0].type === 'ObjectExpression'));
    }
    case 'NewExpression': return n.callee.type === 'Identifier' && ['Set', 'Map', 'WeakMap', 'WeakSet', 'RegExp'].includes(n.callee.name) && n.arguments.every((a) => a.type !== 'SpreadElement' && sansEffet(a));
    case 'ClassExpression': return !n.superClass && n.body.body.every((m) => !m.static || m.type === 'ClassMethod');
    default: return false;
  }
}
function instructionSansEffet(st) {
  if (st.type === 'FunctionDeclaration') return true;
  if (st.type === 'ClassDeclaration') return sansEffet({ ...st, type: 'ClassExpression' });
  if (st.type === 'VariableDeclaration') return st.declarations.every((d) => sansEffet(d.init));
  return false;
}

// ── localiser une vue ───────────────────────────────────────────────────────
function trouverVue(A, vue) {
  const i = A.declDe[vue.composant];
  if (i == null) return { absent: `composant ${vue.composant} absent` };
  let fnPath = null;
  traverse(A.ast, {
    FunctionDeclaration(p) { if (p.node.id && p.node.id.name === vue.composant && p.parentPath.isProgram()) { fnPath = p; p.stop(); } },
  });
  if (!fnPath) traverse(A.ast, { VariableDeclarator(p) { if (p.node.id.name === vue.composant && p.parentPath.parentPath.isProgram() && /Function/.test((p.node.init || {}).type || '')) { fnPath = p.get('init'); p.stop(); } } });
  if (!fnPath) return { absent: `${vue.composant} n'est pas une fonction de tête` };
  const cible = compact(vue.condition);
  const trouves = [];
  fnPath.traverse({
    JSXExpressionContainer(p) {
      const e = p.node.expression;
      if (e && e.type === 'LogicalExpression' && e.operator === '&&' && compactNode(e.left) === cible) trouves.push(p.get('expression.right'));
    },
  });
  if (!trouves.length) return { absent: `branche {${vue.condition} && …} absente de ${vue.composant}` };
  if (trouves.length > 1) {
    // `laPlusGrande` : la branche la plus grande, si elle l'est NETTEMENT (au moins 2 fois la suivante)
    const tri = trouves.slice().sort((a, b) => (b.node.end - b.node.start) - (a.node.end - a.node.start));
    const t0 = tri[0].node.end - tri[0].node.start, t1 = tri[1].node.end - tri[1].node.start;
    if (vue.laPlusGrande && t0 >= 2 * t1) return { fnPath, E: tri[0] };
    return { refus: `branche {${vue.condition} && …} présente ${trouves.length} fois dans ${vue.composant} (ambigu${vue.laPlusGrande ? ' : pas de plus grande nette' : ' — « laPlusGrande » dans le plan ?'})` };
  }
  return { fnPath, E: trouves[0] };
}

// Ce que la branche lit du composant (valeurs passées) — ou pourquoi elle ne peut pas partir.
function lectureVue(A, fnPath, E) {
  const s = E.node.start, e = E.node.end;
  const dedans = (n) => n.start >= s && n.end <= e;
  const captures = new Map(); // nom -> binding
  const refus = [];
  const progRefs = new Set();
  E.traverse({
    ReferencedIdentifier(p) {
      const nom = p.node.name; const b = p.scope.getBinding(nom);
      if (!b) return;
      if (b.scope === A.prog.scope) { progRefs.add(nom); return; }
      if (dedans(b.identifier)) return;
      captures.set(nom, b);
    },
    ThisExpression(p) { const f = p.getFunctionParent && p.findParent((q) => q.isFunction() && !q.isArrowFunctionExpression()); if (!f || !dedans(f.node)) refus.push(`lit \`this\` du composant (ligne ${p.node.loc.start.line})`); },
    Identifier(p) { if (p.node.name === 'arguments' && p.isReferencedIdentifier() && !p.scope.getBinding('arguments')) { const f = p.findParent((q) => q.isFunction() && !q.isArrowFunctionExpression()); if (!f || !dedans(f.node)) refus.push(`lit \`arguments\` du composant (ligne ${p.node.loc.start.line})`); } },
    AwaitExpression(p) { const f = p.getFunctionParent(); if (!f || !dedans(f.node)) refus.push(`await du composant (ligne ${p.node.loc.start.line})`); },
    YieldExpression(p) { const f = p.getFunctionParent(); if (!f || !dedans(f.node)) refus.push(`yield du composant (ligne ${p.node.loc.start.line})`); },
    CallExpression(p) {
      const c = p.node.callee;
      const nom = c.type === 'Identifier' ? c.name : (c.type === 'MemberExpression' && !c.computed ? c.property.name : '');
      if (/^use[A-Z0-9]/.test(nom)) refus.push(`appelle le hook ${nom} (ligne ${p.node.loc.start.line}) : il changerait de composant`);
    },
  });
  // écritures
  for (const [nom, b] of captures) {
    for (const cv of b.constantViolations) {
      if (dedans(cv.node)) { refus.push(`écrit la variable ${nom} du composant (ligne ${cv.node.loc.start.line})`); continue; }
      // Permis : une réaffectation faite AVANT la branche, dans le rendu lui-même — directement, ou dans
      // une fonction appelée sur-le-champ ((() => { x = … })()) : la valeur passée est la valeur finale.
      const sDecl = b.scope.getFunctionParent();   // (une Scope : son nœud est `.block`)
      const fDecl = sDecl ? { node: sDecl.block } : null;
      let f = cv.getFunctionParent(), parIIFE = true;
      while (f && fDecl && f.node !== fDecl.node) {
        const par = f.parentPath;
        if (!(par && par.isCallExpression() && par.node.callee === f.node)) { parIIFE = false; break; }
        f = f.parentPath.getFunctionParent();
      }
      if (!fDecl || !f || f.node !== fDecl.node || !parIIFE || cv.node.end > s) refus.push(`la variable ${nom} qu'elle lit est réaffectée ailleurs (ligne ${cv.node.loc.start.line}) : la valeur passée pourrait différer`);
    }
  }
  for (const nom of progRefs) for (const cv of A.bindings[nom].constantViolations) if (dedans(cv.node)) refus.push(`réaffecte ${nom} (tête d'App.jsx, ligne ${cv.node.loc.start.line})`);
  // (11 nov., reprise) LE MOMENT où les valeurs sont lues. Avant : le code de la branche tourne
  // DANS le rendu du composant, à sa place. Après : `v={{…}}` est évalué à cette même place, mais
  // le code de la branche tourne au rendu de la vue — APRÈS la fin du rendu du composant. Trois
  // écarts possibles, tous refusés :
  //  1. une valeur passée DÉCLARÉE après la branche (let/const : zone morte — écran blanc ; var :
  //     undefined) alors qu'avant, une fonction de la branche la lisait plus tard ;
  //  2. un objet passé MODIFIÉ (x.a = …, x.push(…), ref.current = …) par le rendu du composant
  //     APRÈS la branche : avant, la branche lisait l'ancien état, après le nouveau ;
  //  3. la branche elle-même modifie, AU RENDU (pas dans un geste), un objet du composant, appelle
  //     un `setX` du composant, ou appelle sur-le-champ une fonction du composant qui écrit l'une
  //     de ses variables : avant, la suite du rendu voyait l'écriture ; après, non.
  // (Ce qui tourne PLUS TARD des deux côtés — un geste `onClick`, une fonction passée à un enfant —
  // ne change pas de moment : c'est toujours après le rendu du composant.)
  const fnS = fnPath.node.start, fnE = fnPath.node.end;
  const dansComposant = (b) => b && b.identifier.start >= fnS && b.identifier.end <= fnE;
  const MUTANTS = new Set(['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'fill', 'copyWithin', 'set', 'add', 'delete', 'clear']);
  const racineDe = (n) => { while (n && (n.type === 'MemberExpression' || n.type === 'OptionalMemberExpression')) n = n.object; return n && n.type === 'Identifier' ? n : null; };
  // un nœud qui MODIFIE un objet : la racine modifiée (Identifier) ou null
  const mutation = (p) => {
    const nd = p.node;
    if ((nd.type === 'AssignmentExpression') && nd.left.type === 'MemberExpression') return racineDe(nd.left);
    if (nd.type === 'UpdateExpression' && nd.argument.type === 'MemberExpression') return racineDe(nd.argument);
    if (nd.type === 'UnaryExpression' && nd.operator === 'delete' && nd.argument.type === 'MemberExpression') return racineDe(nd.argument);
    if ((nd.type === 'CallExpression' || nd.type === 'OptionalCallExpression')) {
      const c = nd.callee;
      if ((c.type === 'MemberExpression' || c.type === 'OptionalMemberExpression') && !c.computed && MUTANTS.has(c.property.name)) return racineDe(c.object);
      if (c.type === 'MemberExpression' && !c.computed && c.object.type === 'Identifier' && c.object.name === 'Object' && /^(assign|defineProperty|defineProperties|setPrototypeOf)$/.test(c.property.name) && nd.arguments[0]) return racineDe(nd.arguments[0]);
    }
    return null;
  };
  // Une fonction PARESSEUSE : passée en attribut JSX (geste, rendu d'enfant) ou en enfant JSX,
  // éventuellement dans un objet/tableau de cet attribut ; ou passée à un hook d'effet.
  const fonctionParesseuse = (F) => {
    let q = F.parentPath;
    while (q && /^(ObjectProperty|ObjectExpression|ArrayExpression|ConditionalExpression|LogicalExpression|SequenceExpression|ParenthesizedExpression)$/.test(q.node.type)) q = q.parentPath;
    if (!q) return false;
    if (q.isJSXExpressionContainer()) return true;
    if (q.isCallExpression() && q.node.callee.type === 'Identifier' && /^use(Layout|Insertion)?Effect$|^useCallback$/.test(q.node.callee.name)) return true;
    return false;
  };
  // le nœud p tourne-t-il AU RENDU (sur-le-champ) ? (jusqu'à `borne` : la branche ou le composant)
  const auRendu = (p, borne) => {
    for (let F = p.getFunctionParent(); F && F.node !== borne.node && F.node.start >= borne.node.start; F = F.parentPath.getFunctionParent()) {
      if (fonctionParesseuse(F)) return false;
      // une fonction rangée dans une variable ne tourne que si on l'appelle : comptée « au rendu »
      // seulement si on l'appelle sur-le-champ (IIFE) — sinon c'est l'appel qui sera jugé.
      const par = F.parentPath;
      const iife = par && par.isCallExpression() && par.node.callee === F.node;
      const argument = par && par.isCallExpression() && par.node.arguments.includes(F.node);   // .map(cb), .forEach(cb)…
      if (!iife && !argument) return false;
    }
    return true;
  };
  // une fonction du composant qui écrit ses variables (ou appelle un setX) quand on l'appelle
  const ecrivainMemo = new Map();
  const estSetter = (b) => b && b.path.isVariableDeclarator() && b.path.node.id.type === 'ArrayPattern' && b.path.node.init && b.path.node.init.type === 'CallExpression'
    && /^use[A-Z]/.test(b.path.node.init.callee.type === 'Identifier' ? b.path.node.init.callee.name : (b.path.node.init.callee.property || {}).name || '') && b.path.node.id.elements.findIndex((x) => x && x.type === 'Identifier' && x.name === b.identifier.name) > 0;
  const ecrivain = (b, prof = 0) => {
    if (!b || !dansComposant(b) || prof > 4) return null;
    if (ecrivainMemo.has(b)) return ecrivainMemo.get(b);
    ecrivainMemo.set(b, null);
    let F = null;
    if (b.path.isFunctionDeclaration()) F = b.path;
    else if (b.path.isVariableDeclarator() && b.path.node.init && /Function/.test(b.path.node.init.type)) F = b.path.get('init');
    if (!F) return null;
    let res = null;
    const fs0 = F.node.start, fe0 = F.node.end;
    const dansF = (n) => n.start >= fs0 && n.end <= fe0;
    // une variable que SEULE cette fonction lit et écrit (son mémo, « let _memo » vidé à la microtâche)
    // est son état privé : l'écrire ne se voit ailleurs que par ce qu'elle rend.
    const privee = (bb) => bb.referencePaths.every((r) => dansF(r.node)) && bb.constantViolations.every((c) => dansF(c.node));
    const dehorsF = (bb) => bb && dansComposant(bb) && !dansF(bb.identifier) && !privee(bb);
    F.traverse({
      'AssignmentExpression|UpdateExpression'(q) {
        if (res || !auRendu(q, F)) return;
        const cible = q.node.type === 'AssignmentExpression' ? q.node.left : q.node.argument;
        const r = cible.type === 'Identifier' ? cible : racineDe(cible);
        if (r && dehorsF(q.scope.getBinding(r.name))) res = `${b.identifier.name} écrit ${r.name} (ligne ${q.node.loc.start.line})`;
      },
      'CallExpression|UnaryExpression'(q) {
        if (res || !auRendu(q, F)) return;
        const r = mutation(q);
        if (r && dehorsF(q.scope.getBinding(r.name))) { res = `${b.identifier.name} modifie ${r.name} (ligne ${q.node.loc.start.line})`; return; }
        if (q.node.type === 'CallExpression' && q.node.callee.type === 'Identifier') {
          const bb = q.scope.getBinding(q.node.callee.name);
          if (bb && dansComposant(bb) && !dansF(bb.identifier) && estSetter(bb)) res = `${b.identifier.name} appelle ${q.node.callee.name} (ligne ${q.node.loc.start.line})`;
          else if (bb && dansComposant(bb) && !dansF(bb.identifier)) { const r2 = ecrivain(bb, prof + 1); if (r2) res = `${b.identifier.name} → ${r2}`; }
        }
      },
    });
    ecrivainMemo.set(b, res);
    return res;
  };
  for (const [nom, b] of captures) {
    // 1. déclarée après la branche
    if (b.kind === 'let' || b.kind === 'const' || b.kind === 'var') {
      const decl = b.path.node;
      if (!(decl.end <= s)) refus.push(`lit ${nom}, déclarée ligne ${decl.loc.start.line} — pas encore posée à l'endroit de la branche (la valeur passée n'existerait pas)`);
    }
  }
  // 2. objet passé modifié par le rendu du composant APRÈS la branche
  fnPath.traverse({
    'AssignmentExpression|UpdateExpression|CallExpression|OptionalCallExpression|UnaryExpression'(p) {
      if (p.node.start < e) return;
      const r = mutation(p); if (!r || !captures.has(r.name) || p.scope.getBinding(r.name) !== captures.get(r.name)) return;
      if (auRendu(p, fnPath)) refus.push(`l'objet ${r.name} qu'elle lit est modifié par le rendu APRÈS elle (ligne ${p.node.loc.start.line}) : elle ne lirait plus le même état`);
    },
  });
  // 3. la branche écrit, au rendu, ce que la suite du composant lit
  E.traverse({
    'CallExpression|OptionalCallExpression|AssignmentExpression|UpdateExpression|UnaryExpression'(p) {
      if (!auRendu(p, E)) return;
      const r = mutation(p);
      if (r && captures.has(r.name) && p.scope.getBinding(r.name) === captures.get(r.name)) { refus.push(`modifie au rendu l'objet ${r.name} du composant (ligne ${p.node.loc.start.line})`); return; }
      if (p.node.type === 'CallExpression' && p.node.callee.type === 'Identifier' && captures.has(p.node.callee.name)) {
        const b = captures.get(p.node.callee.name);
        if (estSetter(b)) refus.push(`appelle ${p.node.callee.name} au rendu (ligne ${p.node.loc.start.line}) : un enfant ne met pas à jour son parent pendant son rendu`);
        else { const w = ecrivain(b); if (w) refus.push(`appelle au rendu ${p.node.callee.name}, qui écrit le composant (${w})`); }
      }
    },
  });
  return { captures: [...captures.keys()].sort(), refus: [...new Set(refus)] };
}

// ── découper UN module dans un texte App.jsx (en mémoire) ───────────────────
function decouper(src, mod, appFile) {
  const A = analyser(src);
  const { body, idxDe, bindings, declDe, nomsDe } = A;
  const R = { fichier: mod.fichier, sorte: mod.sorte, racines: [], vues: [], absents: [], refus: [], epingles: [], deplaces: [], tailleModule: 0 };
  const modRel = mod.fichier; // ex. coeur/VueVentes.jsx
  if (src.includes(`⟦→ ${modRel} #`)) { R.deja = true; return { src, R }; }

  // racines de tête
  const racines = [];
  for (const nom of mod.racines || []) {
    if (declDe[nom] != null) { racines.push(nom); continue; }
    // déclaré DANS une fonction ? (closure)
    let niche = null;
    traverse(A.ast, {
      'FunctionDeclaration|VariableDeclarator'(p) {
        const id = p.node.id; if (!id || id.name !== nom || p.parentPath.isProgram() || (p.parentPath.parentPath && p.parentPath.parentPath.isProgram())) return;
        const f = p.getFunctionParent(); if (!f) return;
        const lus = new Set();
        const cible = p.isFunctionDeclaration() ? p : p.get('init');
        if (cible && cible.node) cible.traverse({ ReferencedIdentifier(q) { const b = q.scope.getBinding(q.node.name); if (b && b.scope !== A.prog.scope && !(b.identifier.start >= p.node.start && b.identifier.end <= p.node.end)) lus.add(q.node.name); } });
        const hote = A.nomsDe[idxDe(p.node.start)].join('+');
        niche = { hote, lus: [...lus] }; p.stop();
      },
    });
    if (niche) R.refus.push(`${nom} : déclaré dans ${niche.hote}, pas en tête — ${niche.lus.length ? `lit ${niche.lus.length} variable(s) du composant (closure) : ${niche.lus.slice(0, 12).join(', ')}${niche.lus.length > 12 ? '…' : ''}` : 'à remonter en tête à la main d’abord'}`);
    else R.absents.push(nom);
  }

  // vues
  const vues = [];
  for (const v of mod.vues || []) {
    const t = trouverVue(A, v);
    if (t.absent) { R.absents.push(`${v.nom} (${t.absent})`); continue; }
    if (t.refus) { R.refus.push(`${v.nom} : ${t.refus}`); continue; }
    const L = lectureVue(A, t.fnPath, t.E);
    if (L.refus.length) { R.refus.push(`${v.nom} : ${L.refus.join(' ; ')}`); continue; }
    if (declDe[v.nom] != null) { R.refus.push(`${v.nom} : ce nom existe déjà en tête d'App.jsx`); continue; }
    vues.push({ ...v, E: t.E.node, captures: L.captures });
  }
  if (mod.sorte === 'pur' && vues.length) { R.refus.push('une vue ne va jamais dans un module « pur »'); vues.length = 0; }
  if (!racines.length && !vues.length) return { src, R };

  // graphe : une référence située DANS une vue compte pour la vue (pseudo-nœud), pas pour son composant
  const n = body.length;
  const noeudDe = (pos) => { for (let k = 0; k < vues.length; k++) if (pos >= vues[k].E.start && pos < vues[k].E.end) return n + k; return idxDe(pos); };
  const aretes = Array.from({ length: n + vues.length }, () => new Set());
  const affecte = body.map(() => new Set());
  const refsRacine = {};
  for (const [nom, b] of Object.entries(bindings)) {
    const j = declDe[nom];
    for (const rp of b.referencePaths) {
      const i = noeudDe(rp.node.start);
      if (i !== j) aretes[i].add(j);
      if (racines.includes(nom) && i !== j) {
        const par = rp.parentPath; let type = par ? par.node.type : '?';
        if (type === 'JSXOpeningElement' || type === 'JSXClosingElement') type = 'jsx';
        (refsRacine[nom] = refsRacine[nom] || []).push({ ligne: rp.node.loc.start.line, type, i });
      }
    }
    for (const cv of b.constantViolations) { const i = noeudDe(cv.node.start); if (i !== j) { aretes[i].add(j); if (i < n) affecte[i].add(nom); } }
  }
  const iRac = new Set(racines.map((r) => declDe[r]));
  const pseudo = vues.map((_, k) => n + k);

  // blocs balisés
  const groupes = [];
  for (const o of src.matchAll(/^[ \t]*\/\/ <([a-z0-9][a-z0-9-]*)>/gm)) {
    const f = src.indexOf(`// </${o[1]}>`, o.index); if (f < 0) continue;
    const g = []; for (let i = 0; i < n; i++) if (body[i].start >= o.index && body[i].start < f) g.push(i);
    const ia = idxDe(o.index), ib = idxDe(f); for (let i = ia; i <= ib; i++) if (!g.includes(i) && body[i].end > o.index) g.push(i);
    if (g.length > 1) groupes.push(g);
  }

  const epingles = new Set();
  let M, dehors;
  if (mod.sorte === 'pur') {
    // les blocs nommés et TOUT ce qu'ils lisent en tête
    const ferme = new Set(); const pile = [...iRac];
    while (pile.length) { const i = pile.pop(); if (ferme.has(i)) continue; ferme.add(i); for (const j of aretes[i]) if (!ferme.has(j)) pile.push(j); }
    const imp = [...ferme].filter((i) => body[i].type === 'ImportDeclaration');
    M = new Set([...ferme].filter((i) => body[i].type !== 'ImportDeclaration'));
    const pb = [];
    for (const i of M) {
      const st = body[i]; const nm = nomsDe[i].join('+') || st.type;
      if (/^Export/.test(st.type)) pb.push(`${nm} est déclaré avec export (ligne ${st.loc.start.line})`);
      else if (!instructionSansEffet(st)) pb.push(`${nm} (ligne ${st.loc.start.line}) : son initialisation fait autre chose que déclarer — elle tournerait plus tôt qu'avant`);
      for (const nom of affecte[i]) if (!M.has(declDe[nom])) pb.push(`${nm} réaffecte ${nom} qui reste dans App`);
      for (const nom of nomsDe[i]) for (const cv of bindings[nom].constantViolations) { const k = idxDe(cv.node.start); if (!M.has(k)) pb.push(`${nom} est réaffecté par App.jsx (ligne ${cv.node.loc.start.line}) : un import ne se réaffecte pas`); }
    }
    for (const g of groupes) { const d = g.filter((i) => M.has(i)); if (d.length && d.length < g.length) pb.push(`le bloc balisé ligne ${body[g[0]].loc.start.line} serait coupé`); }
    if (pb.length) { R.refus.push(...[...new Set(pb)].map((p) => `${(mod.racines || []).join(',')} : ${p}`)); return { src, R }; }
    void imp;
    dehors = new Set(body.map((_, i) => i).filter((i) => !M.has(i)));
  } else {
    // fermeture des racines et des vues
    const ferme = new Set(); const pile = [...iRac, ...pseudo];
    while (pile.length) { const i = pile.pop(); if (ferme.has(i)) continue; ferme.add(i); for (const j of aretes[i]) if (!ferme.has(j)) pile.push(j); }
    for (;;) {
      dehors = new Set();
      const p2 = body.map((_, i) => i).filter((i) => !ferme.has(i) || epingles.has(i));
      while (p2.length) { const i = p2.pop(); if (dehors.has(i)) continue; dehors.add(i); for (const j of aretes[i]) if (!dehors.has(j) && !iRac.has(j)) p2.push(j); }
      M = new Set([...ferme].filter((i) => i < n && !dehors.has(i)));
      let neuf = false;
      for (const i of M) {
        if (epingles.has(i)) continue;
        let raison = null;
        for (const nom of affecte[i]) if (!M.has(declDe[nom]) && !iRac.has(i)) raison = `réaffecte ${nom} (reste dans App)`;
        if (!raison && !iRac.has(i) && body[i].type !== 'ImportDeclaration' && !/^Export/.test(body[i].type) && !instructionSansEffet(body[i])) raison = 'son initialisation a un effet (elle tournerait plus tard)';
        if (raison) { epingles.add(i); R.epingles.push(`${nomsDe[i].join('+') || body[i].type} (ligne ${body[i].loc.start.line}) : ${raison}`); neuf = true; }
      }
      for (const g of groupes) { const d = g.filter((i) => M.has(i)); if (d.length && d.length < g.length) for (const i of d) if (!epingles.has(i)) { epingles.add(i); R.epingles.push(`${nomsDe[i].join('+')} : bloc balisé gardé entier`); neuf = true; } }
      if (!neuf) break;
    }
  }

  // imports : jamais déplacés ; ceux qui ne servent plus qu'au module partent (module à la demande seulement)
  const Mimp = new Set();
  for (const i of [...M]) if (body[i].type === 'ImportDeclaration') { M.delete(i); if (mod.sorte !== 'pur') Mimp.add(i); }
  const problemes = [];
  for (const i of M) if (/^Export/.test(body[i].type)) problemes.push(`instruction export ligne ${body[i].loc.start.line}`);
  for (const i of M) for (const nom of affecte[i]) if (!M.has(declDe[nom])) problemes.push(`affecte ${nom} (App) depuis ligne ${body[i].loc.start.line}`);
  if (mod.sorte !== 'pur') for (const r of racines) { if (!M.has(declDe[r])) problemes.push(`racine ${r} atteinte par le reste d'App hors JSX`); for (const ref of (refsRacine[r] || [])) if (!M.has(ref.i) && ref.type !== 'jsx' && !(ref.i >= n)) problemes.push(`racine ${r} utilisée hors JSX ligne ${ref.ligne} (${ref.type})`); }
  for (const i of M) { const t = body[i].type; if (t !== 'FunctionDeclaration' && t !== 'VariableDeclaration' && t !== 'ClassDeclaration') problemes.push(`instruction ${t} ligne ${body[i].loc.start.line}`); }
  if (problemes.length) { R.refus.push(...problemes.map((p) => `${modRel} : ${p}`)); return { src, R }; }

  // besoins du module
  const besoinsApp = new Set(), besoinsImport = new Map();
  const noter = (i, j, nom) => { if (body[j].type === 'ImportDeclaration') { if (!besoinsImport.has(j)) besoinsImport.set(j, new Set()); besoinsImport.get(j).add(nom); } else besoinsApp.add(nom); };
  const sources = [...M, ...pseudo];
  for (const i of sources) for (const j of aretes[i]) if (j < n && (!M.has(j) || Mimp.has(j))) {
    for (const nom of nomsDe[j]) {
      const b = bindings[nom];
      const utilise = b.referencePaths.some((rp) => noeudDe(rp.node.start) === i) || b.constantViolations.some((cv) => noeudDe(cv.node.start) === i);
      if (utilise) noter(i, j, nom);
    }
  }
  if (mod.sorte === 'pur' && besoinsApp.size) { R.refus.push(`${modRel} : lirait d'App.jsx ${[...besoinsApp].join(', ')}`); return { src, R }; }
  // ce qu'App (le reste) lit du module « pur »
  const exporteVers = new Set();
  if (mod.sorte === 'pur') for (const i of M) for (const nom of nomsDe[i]) if (bindings[nom].referencePaths.some((rp) => !M.has(idxDe(rp.node.start)))) exporteVers.add(nom);

  // ── écriture du module ──
  const modAbs = path.join(path.dirname(appFile), modRel);
  const relDeMod = (spec) => { if (!spec.startsWith('.')) return spec; const abs = path.resolve(path.dirname(appFile), spec); let r = path.relative(path.dirname(modAbs), abs).split(path.sep).join('/'); if (!r.startsWith('.')) r = './' + r; return r; };
  const appRel = (() => { let r = path.relative(path.dirname(modAbs), appFile).split(path.sep).join('/'); if (!r.startsWith('.')) r = './' + r; return r; })();
  const idxRetires = [...M, ...Mimp].sort((a, b) => a - b);
  const suiteDe = new Map(); { let k = 0; const ens = new Set(idxRetires); for (const i of idxRetires) { if (!ens.has(i - 1)) k++; suiteDe.set(i, k); } }
  const debutSuite = (i) => suiteDe.get(i) !== suiteDe.get(i - 1);
  const debutMorceau = (i) => (i === 0 ? 0 : body[i - 1].end);
  const q = (v) => "'" + v.replace(/'/g, "\\'") + "'";
  const reecrireChemins = (node, d, txt) => {
    const reecr = [];
    const vis = {
      Import(p) { const call = p.parentPath; const a = call.node.arguments && call.node.arguments[0]; if (a && a.type === 'StringLiteral' && a.value.startsWith('.')) reecr.push([a.start, a.end, src[a.start] + relDeMod(a.value) + src[a.start]]); },
      ImportExpression(p) { const a = p.node.source; if (a && a.type === 'StringLiteral' && a.value.startsWith('.')) reecr.push([a.start, a.end, src[a.start] + relDeMod(a.value) + src[a.start]]); },
      NewExpression(p) { const nn = p.node; if (nn.callee.name === 'URL' && nn.arguments[0] && nn.arguments[0].type === 'StringLiteral' && nn.arguments[0].value.startsWith('.')) reecr.push([nn.arguments[0].start, nn.arguments[0].end, src[nn.arguments[0].start] + relDeMod(nn.arguments[0].value) + src[nn.arguments[0].start]]); },
    };
    traverse(node, { noScope: true, ...vis }, A.prog.scope, null, A.prog);
    reecr.sort((a, b) => b[0] - a[0]);
    for (const [s0, e0, r] of reecr) txt = txt.slice(0, s0 - d) + r + txt.slice(e0 - d);
    return txt;
  };
  let tete = `// Découpé d'App.jsx par scripts/decouper-app-2.cjs (${mod.sorte === 'pur' ? 'module importé par App.jsx' : 'chargé à la demande par App.jsx'}).\n// Déplacement MÉCANIQUE : le code est celui d'App.jsx, inchangé — docs/passation/2026-11-11-decoupe-app.md.\n// ⚠️ Ne pas effacer les balises ⟦…⟧ : scripts/_source-app.cjs recolle par elles le texte d'origine pour les audits.\n`;
  let teteImp = '';
  for (const [j, noms] of [...besoinsImport.entries()].sort((a, b) => a[0] - b[0])) {
    const imp = body[j];
    if (Mimp.has(j)) { const t = src.slice(debutMorceau(j), imp.end); const sl = imp.source; teteImp += (debutSuite(j) ? `\n// ⟦← App.jsx #${suiteDe.get(j)}⟧` : '') + t.slice(0, sl.start - debutMorceau(j)) + src[sl.start] + relDeMod(sl.value) + src[sl.start] + t.slice(sl.end - debutMorceau(j)); continue; }
    const parts = []; let def = null, ns = null;
    for (const sp of imp.specifiers) {
      if (!noms.has(sp.local.name)) continue;
      if (sp.type === 'ImportDefaultSpecifier') def = sp.local.name;
      else if (sp.type === 'ImportNamespaceSpecifier') ns = sp.local.name;
      else { const imported = sp.imported.type === 'StringLiteral' ? JSON.stringify(sp.imported.value) : sp.imported.name; parts.push(imported === sp.local.name ? imported : `${imported} as ${sp.local.name}`); }
    }
    const morceaux = []; if (def) morceaux.push(def); if (ns) morceaux.push(`* as ${ns}`); if (parts.length) morceaux.push(`{ ${parts.join(', ')} }`);
    tete += `import ${morceaux.join(', ')} from ${q(relDeMod(imp.source.value))};\n`;
  }
  // Une vue lit React (`<React.Fragment>`, JSX classique) : il est déjà dans les besoins s'il est référencé.
  if (besoinsApp.size) tete += `import { ${[...besoinsApp].sort().join(', ')} } from '${appRel}';\n`;
  // les vues : enveloppes (dans l'en-tête : sourceApp ne les recolle pas, seul le texte d'origine l'est)
  let enveloppes = '';
  vues.forEach((v, k) => {
    const E = v.E; const orig = reecrireChemins(E, E.start, src.slice(E.start, E.end));
    v.cle = `v${k + 1}`;
    enveloppes += `\n// La branche {${v.condition} && …} de ${v.composant}, telle quelle. Ce qu'elle lit du composant lui est passé (v).\nexport function ${v.nom}({ v }) {\n  ${v.captures.length ? `const { ${v.captures.join(', ')} } = v;\n  ` : ''}return (/*⟦← App.jsx #${v.cle}⟧*/${orig}/*⟦←/⟧*/);\n}\n`;
    R.vues.push({ nom: v.nom, composant: v.composant, condition: v.condition, taille: E.end - E.start, valeursPassees: v.captures.length });
  });
  let corps = '';
  for (const i of [...M].sort((a, b) => a - b)) {
    const d = debutMorceau(i); const txt = reecrireChemins(body[i], d, src.slice(d, body[i].end));
    corps += (debutSuite(i) ? `\n// ⟦← App.jsx #${suiteDe.get(i)}⟧` : '') + txt;
    R.deplaces.push({ noms: nomsDe[i].join('+'), taille: body[i].end - body[i].start });
  }
  const exportsNoms = mod.sorte === 'pur' ? [...new Set([...racines, ...exporteVers])] : racines;
  const exportsMod = exportsNoms.length ? `\nexport { ${exportsNoms.join(', ')} };\n` : '';   // (rien après la dernière suite : sourceApp la recolle telle quelle)
  const texteModule = tete + enveloppes + teteImp + corps + exportsMod;   // (chaque suite commence par sa balise « \n// ⟦← … ⟧ » : rien entre deux)
  R.tailleModule = Buffer.byteLength(texteModule);
  R.racines = racines;

  // ── App.jsx : retirer, remplacer les vues, poser les liaisons ──
  const edits = [];
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
  const retires = new Set(idxRetires);
  for (const i of idxRetires) {
    const rep = debutSuite(i) ? `\n// ⟦→ ${modRel} #${suiteDe.get(i)}⟧` : '';
    edits.push([debutMorceau(i), body[i].end, rep]);
    if (Mimp.has(i)) {
      const abs = path.resolve(path.dirname(appFile), body[i].source.value);
      const css = [...new Set(cssDe(fs.existsSync(abs) ? abs : abs + '.js'))];
      let lignesCss = '';
      for (const c of css) { let r = path.relative(path.dirname(appFile), c).split(path.sep).join('/'); if (!r.startsWith('.')) r = './' + r; lignesCss += `\nimport '${r}'; // (8 nov.) style de ${body[i].source.value}, gardé à sa place (son écran est chargé à la demande)`; }
      if (!lignesCss) continue;
      // après la fin de SA ligne (un commentaire de fin de ligne reste avec son import dans le texte recollé),
      // sauf si la suite continue (le commentaire part alors avec elle, et les styles viennent après la suite)
      const eol = src.indexOf('\n', body[i].end);
      const finLigneSeule = eol > 0 && /^[ \t]*(\/\/[^\n]*)?$/.test(src.slice(body[i].end, eol)) && (i + 1 >= n || body[i + 1].start > eol);
      if (!retires.has(i + 1) && finLigneSeule) edits.push([eol, eol, lignesCss]);
      else edits[edits.length - 1][2] += lignesCss;
    }
  }
  for (const v of vues) edits.push([v.E.start, v.E.end, `/*⟦→ ${modRel} #${v.cle}⟧*/<${v.nom} v={{ ${v.captures.join(', ')} }}/>/*⟦→/⟧*/`]);
  if (mod.sorte === 'pur') {
    let der = -1; for (let i = 0; i < n; i++) if (body[i].type === 'ImportDeclaration') der = i;
    const pos = der >= 0 ? body[der].end : 0;
    edits.push([pos, pos, `\nimport { ${exportsNoms.join(', ')} } from './${modRel}'; // ⟦découpe 2⟧`]);
  }
  edits.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  for (let k = 1; k < edits.length; k++) if (edits[k][0] < edits[k - 1][1]) throw new Error('éditions qui se chevauchent');
  let out = ''; let cur = 0;
  for (const [s0, e0, r] of edits) { out += src.slice(cur, s0) + r; cur = e0; }
  out += src.slice(cur);

  if (mod.sorte !== 'pur') {
    const paresseux = [...racines, ...vues.map((v) => v.nom)];
    // Chaque ligne posée dans App.jsx finit par « // ⟦découpe 2⟧ » : sourceApp les retire du texte des audits.
    let lignes = paresseux.map((r) => `const ${r} = aLaDemande(() => import('./${modRel}').then((m) => ({ default: m.${r} }))${mod.feuille ? ', true' : ''}); // ⟦découpe 2⟧`).join('\n');
    // `precharger` : le morceau est demandé au repos, quelques secondes après l'ouverture (le premier
    // écran n'attend pas ses octets ; le jour où on y va, il est déjà là).
    if (mod.precharger) lignes += `\nprechargerAuRepos(() => import('./${modRel}')); // ⟦découpe 2⟧`;
    const marque = '// ⟦découpe 2⟧ racines et vues paresseuses (scripts/decouper-app-2.cjs)';
    const aide = PRECHARGER_AIDE;
    if (out.includes(marque)) out = out.replace(marque, marque + '\n' + lignes);
    else {
      const m1 = '// ⟦démarrage léger⟧ racines paresseuses';
      if (!out.includes(m1)) throw new Error('ancre « ⟦démarrage léger⟧ racines paresseuses » absente d’App.jsx');
      out = out.replace(m1, marque + '\n' + (out.includes('const prechargerAuRepos = ') ? '' : aide + '\n') + lignes + '\n' + m1);
    }
    const marqueExp = '// ⟦démarrage léger⟧ emprunts des écrans à la demande';
    const re = /\/\/ ⟦démarrage léger⟧ emprunts des écrans à la demande\nexport \{ ([^}]*) \};\n/;
    const m = out.match(re);
    const deja = m ? m[1].split(',').map((s) => s.trim()).filter(Boolean) : [];
    // Ce qu'App.jsx exporte déjà AILLEURS (export function/const, ou une autre liste `export { … }`).
    const dejaDecl = new Set();
    for (const st of body) {
      if (st.type !== 'ExportNamedDeclaration') continue;
      if (st.declaration) { const d = st.declaration; if (d.id) dejaDecl.add(d.id.name); else if (d.declarations) for (const x of d.declarations) if (x.id.name) dejaDecl.add(x.id.name); }
      else if (!st.source && src.slice(Math.max(0, st.start - marqueExp.length - 2), st.start).indexOf(marqueExp) < 0) for (const sp of st.specifiers) dejaDecl.add(sp.exported.name || sp.exported.value);
    }
    const tous = [...new Set([...deja, ...besoinsApp])].filter((nm) => !dejaDecl.has(nm));
    const nouveaux = [...besoinsApp].filter((nm) => !deja.includes(nm) && !dejaDecl.has(nm)).sort();
    const bloc = `${marqueExp}\nexport { ${[...deja.filter((x) => tous.includes(x)), ...nouveaux].join(', ')} };\n`;
    if (m) out = out.replace(re, bloc); else out = out.replace(/\n*$/, '\n') + bloc;
    R.empruntsNeufs = nouveaux.length;
  }
  R.ecrit = { module: texteModule };
  return { src: out, R, modAbs, texteModule };
}


// ── imports DIFFÉRÉS (11 nov., reprise) ──────────────────────────────────────
// Un composant importé STATIQUEMENT par App.jsx et rendu seulement en JSX (`<Nom …/>`) devient
// `const Nom = aLaDemande(() => import('./X.jsx'))` : son fichier (et ce que lui seul importe) sort
// du premier chargement. Refusé si : il sert hors JSX (appelé, passé en valeur, lu au chargement
// du module), si son fichier — ou un fichier que lui seul amène — fait autre chose que déclarer à
// son chargement (il tournerait plus tard qu'avant), importe une feuille de style (la cascade
// changerait d'ordre) ou un paquet qu'App.jsx n'importe pas lui-même.
// Texte : la ligne d'import d'origine reste, préfixée `// ⟦différé⟧ ` (scripts/_source-app.cjs
// retire le préfixe) ; ce qui est posé finit par `// ⟦découpe 2⟧`.
function modulePur(fichier, appImports, vus, raisons) {
  if (vus.has(fichier)) return; vus.add(fichier);
  if (appImports.has(fichier)) return;            // déjà chargé au démarrage par App.jsx lui-même
  // une feuille de style reste importée par App.jsx À LA PLACE de l'import différé (la cascade ne bouge pas)
  if (/\.css$/.test(fichier)) { (raisons.css = raisons.css || []).push(fichier); return; }
  if (!/\.(jsx?|mjs)$/.test(fichier)) { raisons.push(`${path.basename(fichier)} : fichier non JS`); return; }
  let t; try { t = fs.readFileSync(fichier, 'utf8'); } catch (_) { raisons.push(`${fichier} illisible`); return; }
  let ast; try { ast = parser.parse(t, { sourceType: 'module', plugins: ['jsx'] }); } catch (e) { raisons.push(`${path.basename(fichier)} ne se lit pas`); return; }
  for (const st of ast.program.body) {
    if (st.type === 'ImportDeclaration' || ((st.type === 'ExportNamedDeclaration' || st.type === 'ExportAllDeclaration') && st.source)) {
      const v = st.source.value;
      if (v.startsWith('.')) { let abs = path.resolve(path.dirname(fichier), v.replace(/\?.*$/, '')); if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) for (const e of ['.js', '.jsx', '/index.js']) if (fs.existsSync(abs + e)) { abs += e; break; } if (/\?/.test(v)) { raisons.push(`${path.basename(fichier)} importe ${v}`); continue; } modulePur(abs, appImports, vus, raisons); }
      else if (!appImports.has('paquet:' + v.split('/').slice(0, v.startsWith('@') ? 2 : 1).join('/'))) raisons.push(`${path.basename(fichier)} importe le paquet ${v} (qu'App.jsx n'importe pas)`);
      continue;
    }
    let d = st;
    if (st.type === 'ExportNamedDeclaration') { if (!st.declaration) continue; d = st.declaration; }
    if (st.type === 'ExportDefaultDeclaration') { d = st.declaration; if (/^(FunctionDeclaration|ClassDeclaration)$/.test(d.type)) { if (!instructionSansEffet(d)) raisons.push(`${path.basename(fichier)} ligne ${st.loc.start.line}`); continue; } if (!sansEffet(d)) raisons.push(`${path.basename(fichier)} ligne ${st.loc.start.line} : export default avec effet`); continue; }
    if (!instructionSansEffet(d)) raisons.push(`${path.basename(fichier)} ligne ${st.loc.start.line} : fait autre chose que déclarer au chargement`);
  }
}
function differer(src, liste, appFile) {
  const A = analyser(src);
  const R = { fichier: 'imports différés', sorte: 'differe', differes: [], absents: [], refus: [], deja: false };
  const resoudre = (v) => { let abs = path.resolve(path.dirname(appFile), v); if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) for (const e of ['.js', '.jsx', '/index.js']) if (fs.existsSync(abs + e)) { abs += e; break; } return abs; };
  const appImports = new Set();
  for (const st of A.body) if (st.type === 'ImportDeclaration') { const v = st.source.value; if (v.startsWith('.')) appImports.add(resoudre(v.replace(/\?.*$/, ''))); else appImports.add('paquet:' + v.split('/').slice(0, v.startsWith('@') ? 2 : 1).join('/')); }
  const marque = '// ⟦démarrage léger⟧ racines paresseuses';
  const posMarque = src.indexOf(marque);
  if (posMarque < 0) { R.refus.push('ancre « ⟦démarrage léger⟧ racines paresseuses » absente'); return { src, R }; }
  // par déclaration d'import : les spécificateurs différés
  const parDecl = new Map(); const lignes = []; const cssDe = new Map(); const prech = new Set();
  for (const it of liste) {
    const nom = it.nom;
    if (new RegExp(`^// ⟦différé⟧ .*\\b${nom}\\b`, 'm').test(src) && new RegExp(`^const ${nom} = aLaDemande\\(`, 'm').test(src)) { R.absents.push(`${nom} (déjà différé)`); continue; }
    const b = A.bindings[nom];
    if (!b || b.kind !== 'module') { R.absents.push(`${nom} (pas un import d'App.jsx)`); continue; }
    const decl = b.path.parentPath.node, sp = b.path.node;
    if (!decl.source.value.startsWith('.')) { R.refus.push(`${nom} : importé du paquet ${decl.source.value}`); continue; }
    if (sp.type === 'ImportNamespaceSpecifier') { R.refus.push(`${nom} : import * as`); continue; }
    const pb = [];
    for (const r of b.referencePaths) {
      const par = r.parentPath;
      if (!(par.isJSXOpeningElement() || par.isJSXClosingElement())) pb.push(`utilisé hors JSX ligne ${r.node.loc.start.line} (${par.node.type})`);
      else if (!r.getFunctionParent() && r.node.start < posMarque) pb.push(`rendu au chargement du module ligne ${r.node.loc.start.line}`);
    }
    if (!b.referencePaths.length) pb.push('jamais rendu');
    const raisons = []; modulePur(resoudre(decl.source.value), new Set([...appImports].filter((x) => x !== resoudre(decl.source.value))), new Set(), raisons);
    // un import d'App.jsx qu'on ne garde QUE pour ce composant : son fichier n'est plus « chargé par App »
    if (raisons.length) pb.push(...raisons.slice(0, 4).map((x) => 'son module : ' + x));
    if (pb.length) { R.refus.push(`${nom} : ${[...new Set(pb)].join(' ; ')}`); continue; }
    if (!parDecl.has(decl)) parDecl.set(decl, new Set());
    parDecl.get(decl).add(nom);
    cssDe.set(decl, [...new Set([...(cssDe.get(decl) || []), ...(raisons.css || [])])]);
    const importe = sp.type === 'ImportDefaultSpecifier' ? 'default' : (sp.imported.name || sp.imported.value);
    // L'attente : « rien » par défaut (un bandeau qui rend souvent null, un bouton dans une ligne : un
    // squelette clignoterait), « feuille » (la pastille « Ouverture… »), « squelette » (3 lignes grises).
    const attente = it.attente || (it.feuille ? 'feuille' : 'rien');
    if (!/^(rien|feuille|squelette)$/.test(attente)) { R.refus.push(`${nom} : attente « ${attente} » inconnue`); continue; }
    const charge = `() => import('${decl.source.value}')${importe === 'default' ? '' : `.then((m) => ({ default: m.${importe} }))`}`;
    lignes.push(attente === 'rien' ? `const ${nom} = aLaDemandeSansAttente(${charge}); // ⟦découpe 2⟧` : `const ${nom} = aLaDemande(${charge}${attente === 'feuille' ? ', true' : ''}); // ⟦découpe 2⟧`);
    prech.add(decl.source.value);
    R.differes.push({ nom, de: decl.source.value });
  }
  if (!lignes.length) return { src, R };
  const edits = [];
  for (const [decl, noms] of parDecl) {
    // début de la ligne de l'import (le préfixe se pose en tête de CHAQUE ligne de l'import)
    const deb = src.lastIndexOf('\n', decl.start - 1) + 1;
    if (src.slice(deb, decl.start).trim()) { R.refus.push(`${[...noms].join(', ')} : l'import ne commence pas sa ligne`); return { src, R: { ...R, differes: [] } }; }
    let fin = src.indexOf('\n', decl.end); if (fin < 0) fin = src.length;   // la ligne ENTIÈRE (son commentaire de fin compris)
    const texte = src.slice(deb, fin);
    let rep = texte.split('\n').map((l) => '// ⟦différé⟧ ' + l).join('\n');
    const restent = decl.specifiers.filter((x) => !noms.has(x.local.name));
    // Le module resterait importé au démarrage par ses autres noms : rien de gagné, un Suspense de plus.
    if (restent.length && !(liste.find((it) => noms.has(it.nom)) || {}).memeSiReste) { R.refus.push(`${[...noms].join(', ')} : ${decl.source.value} reste importé par App.jsx (${restent.map((x) => x.local.name).join(', ')}) — rien de gagné`); R.differes = R.differes.filter((d) => !noms.has(d.nom)); for (const n of noms) { const k = lignes.findIndex((l) => l.startsWith(`const ${n} = `)); if (k >= 0) lignes.splice(k, 1); } if (![...parDecl.keys()].some((d) => d !== decl && d.source.value === decl.source.value)) prech.delete(decl.source.value); continue; }
    if (restent.length) {
      const def = restent.find((x) => x.type === 'ImportDefaultSpecifier');
      const nommes = restent.filter((x) => x.type === 'ImportSpecifier').map((x) => { const im = x.imported.name || JSON.stringify(x.imported.value); return im === x.local.name ? im : `${im} as ${x.local.name}`; });
      const ns = restent.find((x) => x.type === 'ImportNamespaceSpecifier');
      const parts = []; if (def) parts.push(def.local.name); if (ns) parts.push(`* as ${ns.local.name}`); if (nommes.length) parts.push(`{ ${nommes.join(', ')} }`);
      rep += `\nimport ${parts.join(', ')} from ${JSON.stringify(decl.source.value)}; // ⟦découpe 2⟧`;
    }
    for (const c of cssDe.get(decl) || []) { let r = path.relative(path.dirname(appFile), c).split(path.sep).join('/'); if (!r.startsWith('.')) r = './' + r; rep += `\nimport '${r}'; // (8 nov.) style de ${decl.source.value}, gardé à sa place (son écran est chargé à la demande)`; }
    edits.push([deb, fin, rep]);
  }
  if (!lignes.length) return { src, R };
  edits.sort((a, b) => b[0] - a[0]);
  let out = src; for (const [a, z, r] of edits) out = out.slice(0, a) + r + out.slice(z);
  // Chaque module différé est demandé au repos, 4 s après l'ouverture (le jour où il s'affiche, il est là).
  const aides = [
    "const aLaDemandeSansAttente = (charger) => { const Paresseux = lazy(charger); return function MorceauSansAttente(props) { return <Suspense fallback={null}><Paresseux {...props}/></Suspense>; }; }; // ⟦découpe 2⟧",
  ];
  if (!out.includes('const prechargerAuRepos = ')) aides.push(PRECHARGER_AIDE);
  out = out.replace(marque, '// ⟦découpe 2⟧ imports différés (scripts/decouper-app-2.cjs)\n' + aides.join('\n') + '\n' + lignes.join('\n') + '\n' + [...prech].map((v) => `prechargerAuRepos(() => import('${v}')); // ⟦découpe 2⟧`).join('\n') + '\n' + marque);
  return { src: out, R };
}

// ── exécution du plan ───────────────────────────────────────────────────────
function main() {
  const plan = JSON.parse(fs.readFileSync(PLAN, 'utf8'));
  let src = fs.readFileSync(APP, 'utf8');
  const avant = Buffer.byteLength(src);
  const ecrits = new Map();
  const rapports = [];
  for (const mod of plan.modules) {
    if (SEULEMENT.length && !SEULEMENT.some((s) => mod.fichier.includes(s))) continue;
    if (!/^coeur\/[A-Za-z0-9_-]+\.(jsx|js)$/.test(mod.fichier)) { rapports.push({ fichier: mod.fichier, refus: ['un module va dans src/coeur/ (coeur/Nom.jsx)'] }); continue; }
    if (fs.existsSync(path.join(RACINE, 'src', mod.fichier)) && !src.includes(`⟦→ ${mod.fichier} #`)) { rapports.push({ fichier: mod.fichier, refus: ['le fichier existe déjà et App.jsx ne porte pas ses balises : écrit à la main ?'] }); continue; }
    let r;
    try { r = decouper(src, mod, APP); } catch (e) { rapports.push({ fichier: mod.fichier, refus: ['erreur : ' + (e && e.stack || e)] }); continue; }
    if (r.modAbs) {
      // contrôle immédiat : les deux textes se lisent (Babel)
      try { parser.parse(r.src, { sourceType: 'module', plugins: ['jsx'] }); parser.parse(r.texteModule, { sourceType: 'module', plugins: ['jsx'] }); }
      catch (e) { r.R.refus.push('le résultat ne se lit pas : ' + e.message); r.R.ecrit = null; rapports.push(r.R); continue; }
      src = r.src; ecrits.set(r.modAbs, r.texteModule);
    }
    delete r.R.ecrit; rapports.push(r.R);
  }
  if (Array.isArray(plan.differes) && plan.differes.length && (!SEULEMENT.length || SEULEMENT.includes('differes'))) {
    try {
      const r = differer(src, plan.differes, APP);
      if (r.src !== src) { parser.parse(r.src, { sourceType: 'module', plugins: ['jsx'] }); src = r.src; }
      rapports.push(r.R);
    } catch (e) { rapports.push({ fichier: 'imports différés', refus: ['erreur : ' + (e && e.stack || e)] }); }
  }
  const apres = Buffer.byteLength(src);
  // rapport
  console.log(`App.jsx : ${ko(avant)} Ko → ${ko(apres)} Ko (${ko(avant - apres)} Ko partis dans ${ecrits.size} module(s))`);
  for (const R of rapports) {
    const tete = `· ${R.fichier}${R.sorte ? ' [' + R.sorte + ']' : ''}`;
    if (R.deja) { console.log(tete + ' : déjà découpé (balises présentes)'); continue; }
    const parts = [];
    if (R.racines && R.racines.length) parts.push(`racines ${R.racines.join(', ')}`);
    if (R.vues && R.vues.length) parts.push(`vues ${R.vues.map((v) => `${v.nom} (${ko(v.taille)} Ko, ${v.valeursPassees} valeurs passées)`).join(', ')}`);
    if (R.deplaces && R.deplaces.length) parts.push(`${R.deplaces.length} instruction(s) de tête`);
    if (R.differes && R.differes.length) parts.push(`${R.differes.length} différé(s) : ${R.differes.map((d) => d.nom).join(', ')}`);
    console.log(tete + (R.tailleModule ? ` : ${ko(R.tailleModule)} Ko` : '') + (parts.length ? ' — ' + parts.join(' ; ') : ''));
    for (const a of R.absents || []) console.log('    absent : ' + a);
    for (const x of R.refus || []) console.log('    REFUSÉ : ' + x);
    for (const x of R.epingles || []) console.log('    gardé dans App : ' + x);
  }
  if (RAPPORT) fs.writeFileSync(RAPPORT, JSON.stringify({ avant, apres, modules: rapports }, null, 2));
  if (!APPLIQUER) { console.log('(rien écrit : ajouter --appliquer)'); return; }
  fs.writeFileSync(APP, src);
  for (const [f, t] of ecrits) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, t); }
  console.log('écrit : App.jsx +', [...ecrits.keys()].map((f) => path.relative(RACINE, f)).join(', '));
}
if (require.main === module) main();
module.exports = { analyser, decouper, differer, modulePur, sansEffet, instructionSansEffet, trouverVue, lectureVue, lectureVueExport: (A, f, E) => lectureVue(A, f, E) };
