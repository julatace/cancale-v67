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
      const fDecl = b.scope.getFunctionParent();
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
  const exportsMod = exportsNoms.length ? `\nexport { ${exportsNoms.join(', ')} };\n` : '\n';
  const texteModule = tete + enveloppes + teteImp + '\n' + corps + exportsMod;
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
  for (const i of idxRetires) {
    let rep = debutSuite(i) ? `\n// ⟦→ ${modRel} #${suiteDe.get(i)}⟧` : '';
    if (Mimp.has(i)) {
      const abs = path.resolve(path.dirname(appFile), body[i].source.value);
      const css = [...new Set(cssDe(fs.existsSync(abs) ? abs : abs + '.js'))];
      for (const c of css) { let r = path.relative(path.dirname(appFile), c).split(path.sep).join('/'); if (!r.startsWith('.')) r = './' + r; rep += `\nimport '${r}'; // (8 nov.) style de ${body[i].source.value}, gardé à sa place (son écran est chargé à la demande)`; }
    }
    edits.push([debutMorceau(i), body[i].end, rep]);
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
    const aide = "const prechargerAuRepos = (charger) => { try { if (typeof window === 'undefined') return; setTimeout(() => { const go = () => { try { charger().catch(() => {}); } catch (_) {} }; if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(go, { timeout: 8000 }); else go(); }, 4000); } catch (_) {} }; // ⟦découpe 2⟧";
    if (out.includes(marque)) out = out.replace(marque, marque + '\n' + lignes);
    else {
      const m1 = '// ⟦démarrage léger⟧ racines paresseuses';
      if (!out.includes(m1)) throw new Error('ancre « ⟦démarrage léger⟧ racines paresseuses » absente d’App.jsx');
      out = out.replace(m1, marque + '\n' + aide + '\n' + lignes + '\n' + m1);
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
module.exports = { analyser, decouper, sansEffet, instructionSansEffet };
