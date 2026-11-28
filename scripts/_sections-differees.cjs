// ══════════════════════════════════════════════════════════════════════════
// LES SECTIONS DE `Comptabilite`, CHARGÉES AVEC LEUR ÉCRAN (27 nov., budget-vitesse)
// ══════════════════════════════════════════════════════════════════════════
// `Comptabilite` (src/ecrans/Comptabilite.jsx, 2,4 Mo de source) est UN composant qui rend Aujourd'hui,
// Ventes, Achats, Annonces, Messages et les colis selon `only` — et son morceau part au DÉMARRAGE, quel que
// soit l'écran ouvert (préchargé par index.html, `data-js-ensuite`). Les sections qu'un écran ne montre
// pas (le JSX d'Achats quand on ouvre Aujourd'hui…) étaient téléchargées et compilées pour rien.
//
// Au BUILD seulement (vite.config.js, `sectionsDifferees`), comme le français différé
// (scripts/_francais-differe.cjs) : le dépôt NE CHANGE PAS — Comptabilite.jsx reste écrit d'un seul tenant
// (les audits le lisent et le mutent ainsi), `vite dev` le sert tel quel. Le fichier livré, lui, remplace
// chaque section nommée ci-dessous (`{cond && (JSX)}` du `return` de `Comptabilite`) par un composant
// chargé à la demande (`aLaDemande`, src/App.jsx) qui rend EXACTEMENT ce JSX :
//   · ce que la section lit dans `Comptabilite` (état, calculs, fonctions du rendu) lui est passé tel quel
//     (`__vrmS`, les MÊMES valeurs, calculées au même rendu) ;
//   · ce qu'elle lit du module (imports, fonctions de tête) est IMPORTÉ par le morceau — liaisons vivantes,
//     comme avant (une variable de tête réaffectée ailleurs est relue à jour) ;
//   · les fonctions de tête que SEULES les sections lisent partent avec elles (un morceau `-tete` partagé),
//     comme la découpe d'App.jsx (scripts/decouper-app.cjs) : même texte, même ordre ;
//   · un import qui ne sert plus qu'aux sections quitte Comptabilite s'il n'a aucun effet à l'évaluation
//     (sinon il reste, nu : `import 'x'`) ; ses feuilles de style restent importées à sa place (la cascade
//     ne bouge pas) ;
//   · la condition reste dans `Comptabilite` : le morceau n'est demandé que quand la section se montre.
// Refusé (la section reste en place, et le build le dit) : une section qui appelle un crochet (`useX`,
// l'ordre des crochets de `Comptabilite` changerait), qui lit `this`/`arguments`, ou qui lit une variable
// du rendu RÉAFFECTÉE ailleurs que dans le rendu (un rappel qui la change : la section garderait la valeur
// du rendu) ou DANS la section (une valeur que le reste du rendu relirait).
// La garde : scripts/audit-sections-differees.cjs.
// ══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('node:fs');
const path = require('node:path');

// La section, sa condition (le côté gauche du `&&`, comparé sans espaces) et son nom.
// Aujourd'hui (`journee`) reste dans le morceau : c'est le premier écran, il n'attend pas un aller-retour.
// Les colis (`bordereaux`) aussi : leur rendu pose des variables (`ongletColisVu`…) que la suite relit.
const SECTIONS = [
  { nom: 'Ventes', cond: "curSub==='ventes'" },
  { nom: 'Achats', cond: "curSub==='achats'" },
  { nom: 'Annonces', cond: "curSub==='annonces'" },
  { nom: 'Messages', cond: "curSub==='messages'&&!filTous" },
  { nom: 'Rapport', cond: 'showReport' },
  { nom: 'Journee', cond: "curSub==='journee'", ouverture: 'journee' },
  { nom: 'Envoyer', cond: "ongletColisVu==='envoyer'", tous: true, discret: true, ouverture: 'ventes' },
  { nom: 'Retirer', cond: "onglet==='retirer'", discret: true, ouverture: 'achats' },
  { nom: 'Envoyes', cond: "curSub==='bordereaux'&&ongletColisVu==='envoyes'&&!(colisDans==='ventes'&&VENTES_NATIF)" },
  // les fenêtres (ouvertes d'un geste) : la pastille d'une feuille pendant le chargement
  { nom: 'Annuel', cond: 'showAnnual', feuille: true },
  { nom: 'PrixAchats', cond: 'fillBuyOpen', feuille: true },
  { nom: 'Bilan', cond: 'showWrapped', feuille: true },
  { nom: 'Sourcing', cond: 'showSourcing', feuille: true },
  { nom: 'Qr', cond: 'qrView', feuille: true },
  { nom: 'Ia', cond: 'iaOpen', feuille: true },
  { nom: 'Choix', cond: 'pickerFor', feuille: true },
  { nom: 'Lot', cond: 'lotOpen', feuille: true },
  { nom: 'Audit', cond: 'auditOpen', feuille: true },
];
const FONCTION = 'Comptabilite';
const DOSSIER = '__sections__';   // le dossier (virtuel) des morceaux, à côté de Comptabilite.jsx
const PROP = '__vrmS';
const EXTS = ['', '.js', '.jsx', '.mjs', '/index.js', '/index.jsx'];

function babel(R) {
  return { parser: require(path.join(R, 'node_modules', '@babel', 'parser')), traverse: require(path.join(R, 'node_modules', '@babel', 'traverse')).default };
}
const sansEspaces = (s) => s.replace(/\s+/g, '');
const dedans = (n, t) => !!n && n.start >= t.start && n.end <= t.end;
const resoudre = (de, spec) => { const b = path.resolve(path.dirname(de), spec.split('?')[0]); for (const e of EXTS) { try { if (fs.statSync(b + e).isFile()) return b + e; } catch (_) {} } return null; };

// ── Un module sans effet à l'évaluation (son sous-graphe aussi) ? Les feuilles de style qu'il importe. ──
// Permis en tête : import, export, déclarations de fonctions / classes, `const`/`let` dont la valeur se
// calcule sans rien appeler (littéraux, fonctions, objets, tableaux, et quelques appels connus pour ne rien
// faire d'autre que construire : Object.freeze, new Set/Map, lazy…). Le reste (un appel, un `if`, une
// écriture) est un effet : l'import reste.
const APPELS_PURS = new Set(['Object.freeze', 'Object.fromEntries', 'Object.keys', 'Object.entries', 'Object.values', 'Array.from', 'Array.isArray', 'Symbol', 'String', 'Number', 'Math.max', 'Math.min', 'Math.round', 'Math.floor', 'Math.ceil', 'memo', 'React.memo', 'forwardRef', 'React.forwardRef', 'createContext', 'React.createContext', 'lazy', 'React.lazy', 'lazySur', 'aLaDemande', 'aLaDemandeDiscret', 'aLaDemandeFeuille', 'JSON.parse', 'JSON.stringify', 'RegExp']);
const NEW_PURS = new Set(['Set', 'Map', 'WeakMap', 'WeakSet', 'RegExp', 'Date', 'Error', 'Array', 'Intl.NumberFormat', 'Intl.DateTimeFormat', 'Intl.PluralRules', 'Intl.Collator']);
const nomAppel = (c) => (c.type === 'Identifier' ? c.name : c.type === 'MemberExpression' && !c.computed && c.object.type === 'Identifier' && c.property.type === 'Identifier' ? c.object.name + '.' + c.property.name : '');
function exprPure(n) {
  if (!n) return true;
  switch (n.type) {
    case 'StringLiteral': case 'NumericLiteral': case 'BooleanLiteral': case 'NullLiteral': case 'RegExpLiteral': case 'BigIntLiteral': case 'Identifier':
    case 'ArrowFunctionExpression': case 'FunctionExpression': case 'ClassExpression': return n.type !== 'ClassExpression' || !(n.body.body || []).some((m) => m.static || m.type === 'StaticBlock');
    case 'TemplateLiteral': return n.expressions.every(exprPure);
    case 'TaggedTemplateExpression': return nomAppel(n.tag) === 'String.raw' && exprPure(n.quasi);
    case 'ObjectExpression': return n.properties.every((p) => (p.type === 'SpreadElement' ? exprPure(p.argument) : p.type === 'ObjectMethod' ? !p.computed || exprPure(p.key) : (!p.computed || exprPure(p.key)) && exprPure(p.value)));
    case 'ArrayExpression': return n.elements.every((e) => !e || (e.type === 'SpreadElement' ? exprPure(e.argument) : exprPure(e)));
    case 'UnaryExpression': return n.operator !== 'delete' && exprPure(n.argument);
    case 'BinaryExpression': case 'LogicalExpression': return exprPure(n.left) && exprPure(n.right);
    case 'ConditionalExpression': return exprPure(n.test) && exprPure(n.consequent) && exprPure(n.alternate);
    case 'MemberExpression': return !n.computed && n.object.type === 'Identifier';
    case 'CallExpression': return APPELS_PURS.has(nomAppel(n.callee)) && n.arguments.every((a) => a.type !== 'SpreadElement' && exprPure(a));
    case 'NewExpression': return NEW_PURS.has(nomAppel(n.callee)) && n.arguments.every((a) => a.type !== 'SpreadElement' && exprPure(a));
    case 'SequenceExpression': return n.expressions.every(exprPure);
    case 'JSXElement': case 'JSXFragment': return true;
    default: return false;
  }
}
function instrPure(s) {
  switch (s.type) {
    case 'ImportDeclaration': case 'ExportAllDeclaration': case 'EmptyStatement': case 'FunctionDeclaration': return true;
    case 'ClassDeclaration': return !(s.body.body || []).some((m) => m.static || m.type === 'StaticBlock');
    case 'VariableDeclaration': return s.declarations.every((d) => exprPure(d.init));
    case 'ExportNamedDeclaration': return !s.declaration || instrPure(s.declaration);
    case 'ExportDefaultDeclaration': return /Declaration$/.test(s.declaration.type) ? instrPure(s.declaration) : exprPure(s.declaration);
    default: return false;
  }
}
// Les modules déjà évalués quand Comptabilite s'évalue : le graphe STATIQUE de src/main.jsx et de src/App.jsx
// (leurs effets ont eu lieu, ils ne dépendent pas de cet import).
function grapheDemarrage(R, cache) {
  const { parser } = babel(R);
  const vus = new Set(); const pile = [path.join(R, 'src', 'main.jsx'), path.join(R, 'src', 'App.jsx')];
  while (pile.length) {
    const f = pile.pop(); if (vus.has(f)) continue; vus.add(f);
    if (!/\.(m?js|jsx)$/.test(f)) continue;
    let ast = cache.get(f);
    if (!ast) { try { ast = parser.parse(fs.readFileSync(f, 'utf8'), { sourceType: 'module', plugins: ['jsx'] }); } catch (_) { continue; } cache.set(f, ast); }
    for (const s of ast.program.body) { const src = (s.type === 'ImportDeclaration' || ((s.type === 'ExportNamedDeclaration' || s.type === 'ExportAllDeclaration') && s.source)) ? s.source.value : null; if (src && src.startsWith('.')) { const g = resoudre(f, src); if (g) pile.push(g); } }
  }
  return vus;
}
function examinerModule(R, fichier, vus, cache, dejaEvalues = new Set()) {
  // rend { pur, css: [chemins absolus] } pour le sous-graphe du module (hors ce qui est déjà vu)
  const { parser } = babel(R);
  const css = [];
  const marcher = (f) => {
    if (vus.has(f)) return true; vus.add(f);
    if (/\.css$/.test(f)) { css.push(f); return true; }
    if (dejaEvalues.has(f) || /[\\/]src[\\/]App\.jsx$/.test(f)) return true;   // déjà évalué au démarrage (ses feuilles aussi)
    if (!/\.(m?js|jsx)$/.test(f)) return false;
    let ast = cache.get(f);
    if (!ast) { try { ast = parser.parse(fs.readFileSync(f, 'utf8'), { sourceType: 'module', plugins: ['jsx'] }); } catch (_) { return false; } cache.set(f, ast); }
    let pur = true;
    for (const s of ast.program.body) {
      if (!instrPure(s)) pur = false;
      const src = (s.type === 'ImportDeclaration' || ((s.type === 'ExportNamedDeclaration' || s.type === 'ExportAllDeclaration') && s.source)) ? s.source.value : null;
      if (src == null) continue;
      if (!src.startsWith('.')) { if (!/^react(-dom)?(\/|$)/.test(src)) pur = false; continue; }
      const g = resoudre(f, src);
      if (!g) { pur = false; continue; }
      if (!marcher(g)) pur = false;
    }
    return pur;
  };
  const pur = marcher(fichier);
  return { pur, css };
}

// Découpe le source de Comptabilite.jsx. Rend { code, morceaux: { nomDeFichier: code }, faites, refus, deplacees, imports, dirMorceau }.
// `fichier` : le chemin absolu de Comptabilite.jsx (les imports des morceaux en sont déduits).
function decouper(R, fichier, src, sections = SECTIONS) {
  const { parser, traverse } = babel(R);
  const ast = parser.parse(src, { sourceType: 'module', plugins: ['jsx'], ranges: true });
  let prog = null, fonc = null;
  traverse(ast, { Program(p) { prog = p; p.stop(); } });
  for (const p of prog.get('body')) { const d = p.isExportNamedDeclaration() && p.get('declaration').node ? p.get('declaration') : p; if (d.isFunctionDeclaration() && d.node.id && d.node.id.name === FONCTION) fonc = d; }
  const refus = [], faites = [], morceaux = {};
  const rien = (raison) => ({ code: src, morceaux, faites, refus: sections.map((s) => ({ nom: s.nom, raison })), deplacees: [], imports: { retires: [], nus: [] } });
  if (!fonc) return rien(`fonction ${FONCTION} introuvable`);
  const corps = fonc.get('body.body');
  const ret = corps[corps.length - 1];
  if (!ret || !ret.isReturnStatement()) return rien('le rendu ne finit pas par un return');
  const conteneurs = [];
  ret.traverse({ JSXExpressionContainer(p) { const e = p.get('expression'); if (e.isLogicalExpression({ operator: '&&' })) conteneurs.push(p); } });
  const dirFichier = path.dirname(fichier);
  const dirMorceau = path.join(dirFichier, DOSSIER);
  const relDuMorceau = (abs) => { let r = path.relative(dirMorceau, abs).split(path.sep).join('/'); if (!r.startsWith('.')) r = './' + r; return r; };
  const progB = prog.scope.bindings;
  // Les chemins relatifs d'un `import('…')` / `new URL('…', import.meta.url)` du texte déplacé : réécrits vus du
  // dossier des morceaux (le texte est le même, seul le chemin change — comme scripts/decouper-app.cjs).
  const litteraux = [];
  traverse(ast, {
    Import(p) { const a = p.parentPath.node.arguments && p.parentPath.node.arguments[0]; if (a && a.type === 'StringLiteral' && a.value.startsWith('.')) litteraux.push(a); },
    ImportExpression(p) { const a = p.node.source; if (a && a.type === 'StringLiteral' && a.value.startsWith('.')) litteraux.push(a); },
    NewExpression(p) { const n = p.node; if (n.callee.name === 'URL' && n.arguments[0] && n.arguments[0].type === 'StringLiteral' && n.arguments[0].value.startsWith('.')) litteraux.push(n.arguments[0]); },
  });
  const texteDeplace = (debut, fin) => {
    let t = src.slice(debut, fin);
    for (const a of litteraux.filter((x) => x.start >= debut && x.end <= fin).sort((x, y) => y.start - x.start)) t = t.slice(0, a.start - debut) + src[a.start] + relDuMorceau(path.resolve(dirFichier, a.value)) + src[a.start] + t.slice(a.end - debut);
    return t;
  };

  // ── 1. Les sections acceptées et ce qu'elles lisent ──
  // Ce qu'un morceau de code lit hors de ses plages (`plages` : la section et ses aides), et ce qui l'empêche de partir.
  const examiner = (chemins, plages) => {
    const raisons = [], libres = new Map();
    const dansPlages = (n) => plages.some((t) => dedans(n, t));
    const fonctionDe = (p) => { const f = p.getFunctionParent(); return f; };
    for (const ch of chemins) ch.traverse({
      'Identifier|JSXIdentifier'(p) {
        if (!p.isReferencedIdentifier()) return;
        const b = p.scope.getBinding(p.node.name);
        if (!b || dansPlages(b.identifier)) return;   // un global, ou déclaré dans le morceau
        libres.set(p.node.name, b);
      },
      CallExpression(p) { const c = p.node.callee; const n = c.type === 'Identifier' ? c.name : c.type === 'MemberExpression' && !c.computed && c.property.type === 'Identifier' ? c.property.name : ''; if (/^use[A-Z0-9]/.test(n)) raisons.push(`appelle un crochet (${n}, ligne ${p.node.loc.start.line})`); },
      ThisExpression(p) { const f = fonctionDe(p); if (!f || !dansPlages(f.node) || f.isArrowFunctionExpression()) raisons.push(`lit this (ligne ${p.node.loc.start.line})`); },
      Identifier(p) { if (p.node.name === 'arguments' && p.isReferencedIdentifier() && !p.scope.getBinding('arguments')) { const f = fonctionDe(p); if (!f || !dansPlages(f.node) || f.isArrowFunctionExpression()) raisons.push(`lit arguments (ligne ${p.node.loc.start.line})`); } },
    });
    return { raisons, libres };
  };
  // Une écriture faite PENDANT le rendu de Comptabilite (dans son corps, ou dans une fonction appelée sur place,
  // `(() => { … })()`, elle-même dans le rendu) ?
  const auRendu = (cv) => { let f = cv.getFunctionParent(); while (f && f.node !== fonc.node) { const par = f.parentPath; if (!(par && par.isCallExpression() && par.node.callee === f.node)) return false; f = f.getFunctionParent(); } return !!f; };
  // Les AIDES du rendu (`const rendreX = (…) => …`, `function f() {}` dans le corps de Comptabilite) que seules
  // des sections lisent : elles partent avec elles (définies dans le morceau, au même rendu, avec les mêmes valeurs).
  const aidesPossibles = new Map();   // chemin d'instruction -> noms
  for (const st of corps.slice(0, -1)) {
    const n = st.node;
    let noms = null;
    if (n.type === 'FunctionDeclaration' && n.id) noms = [n.id.name];
    else if (n.type === 'VariableDeclaration' && n.declarations.every((d) => d.id.type === 'Identifier' && d.init && /^(ArrowFunctionExpression|FunctionExpression)$/.test(d.init.type))) noms = n.declarations.map((d) => d.id.name);
    if (!noms) continue;
    const { raisons, libres } = examiner([st], [n]);
    if (raisons.length) continue;
    if (noms.some((nm) => { const b = st.scope.getBinding(nm); return !b || b.constantViolations.length; })) continue;
    // une aide qui réaffecte une variable du dehors reste (ce serait un rappel qui écrit)
    let ecrit = false;
    st.traverse({ 'AssignmentExpression|UpdateExpression'(p) { const cible = p.node.type === 'UpdateExpression' ? p.node.argument : p.node.left; const ids = cible.type === 'Identifier' ? [cible.name] : []; if (cible.type !== 'Identifier' && cible.type !== 'MemberExpression') p.traverse({ Identifier(q) { if (q.isBindingIdentifier() || q.parentPath.isAssignmentPattern()) ids.push(q.node.name); } }); for (const id of ids) { const b = p.scope.getBinding(id); if (b && !dedans(b.identifier, n)) ecrit = true; } } });
    if (ecrit) continue;
    aidesPossibles.set(st, noms);
    void libres;
  }
  // les cibles des sections
  const cibles = [];
  for (const s of sections) {
    // une condition répétée DANS la section (un sous-bloc) ne compte pas ; deux conteneurs frères : le plus gros (ou tous, `tous`)
    const memes = conteneurs.filter((p) => sansEspaces(src.slice(p.node.expression.left.start, p.node.expression.left.end)) === sansEspaces(s.cond));
    const hauts = memes.filter((p) => !memes.some((q) => q !== p && dedans(p.node, q.node))).sort((a, b) => (b.node.end - b.node.start) - (a.node.end - a.node.start));
    if (!hauts.length) { refus.push({ nom: s.nom, raison: `condition « ${s.cond} » absente du return` }); continue; }
    const pris = s.tous ? hauts.filter((p) => p.node.end - p.node.start >= (s.tailleMin || 4000)).sort((a, b) => a.node.start - b.node.start) : [hauts[0]];
    pris.forEach((p, k) => {
      const cible = p.get('expression.right');
      if (!cible.isExpression()) { refus.push({ nom: s.nom, raison: 'droite du && inattendue' }); return; }
      // la section est-elle évaluée UNE fois par rendu de Comptabilite (seulement des fonctions appelées sur place, aucune boucle) ?
      let auRenduSeul = true;
      for (let q = cible.parentPath; q && q.node !== fonc.node; q = q.parentPath) {
        if (q.isLoop()) auRenduSeul = false;
        if (q.isFunction() && !(q.parentPath && q.parentPath.isCallExpression() && q.parentPath.node.callee === q.node)) auRenduSeul = false;
      }
      cibles.push({ s, nom: s.nom + (k ? String(k + 1) : ''), cible, t: cible.node, auRenduSeul });
    });
  }
  // Une section refusée garde ses aides dans Comptabilite : on recommence sans elle (ses aides ne partent plus).
  let enJeu = cibles.slice(), acceptees = [], refusesTour = [], aideDe = new Map();
  for (let passe = 0; passe < 50; passe++) {
    // Les aides que SEULES des sections (ou d'autres aides parties) lisent : point fixe.
    let partantes = new Set(aidesPossibles.keys());
    const plagesCibles = enJeu.map((c) => c.t);
    for (let tour = 0; tour < 100; tour++) {
      const plages = [...plagesCibles, ...[...partantes].map((st) => st.node)];
      let change = false;
      for (const st of [...partantes]) {
        const ok = aidesPossibles.get(st).every((nm) => st.scope.getBinding(nm).referencePaths.every((rp) => plages.some((t) => dedans(rp.node, t))));
        if (!ok) { partantes.delete(st); change = true; }
      }
      if (!change) break;
    }
    aideDe = new Map(); for (const st of partantes) for (const nm of aidesPossibles.get(st)) aideDe.set(nm, st);
    acceptees = []; refusesTour = [];
    for (const c of enJeu) {
      // les aides de CETTE section (et celles qu'elles lisent)
      const siennes = new Set(); const pile = [c.cible];
      while (pile.length) { const ch = pile.pop(); ch.traverse({ 'Identifier|JSXIdentifier'(p) { if (!p.isReferencedIdentifier()) return; const st = aideDe.get(p.node.name); if (st && p.scope.getBinding(p.node.name) === st.scope.getBinding(p.node.name) && !siennes.has(st)) { siennes.add(st); pile.push(st); } } }); }
      const aides = [...siennes].sort((a, b) => a.node.start - b.node.start);
      const plages = [c.t, ...aides.map((st) => st.node)];
      const { raisons, libres } = examiner([c.cible, ...aides], plages);
      const parValeur = [], deTete = [];
      for (const [nom, b] of libres) {
        if (b.scope === prog.scope) { deTete.push(nom); continue; }
        // une variable d'une portée intermédiaire (une fonction appelée sur place, `(() => { … })()`, ou un bloc, dans le
        // rendu) : la section y est évaluée pendant le rendu, une fois — sa valeur est celle du moment (mêmes règles)
        if (b.scope.block !== fonc.node && !c.auRenduSeul) { raisons.push(`« ${nom} » vient d'une portée intermédiaire`); continue; }
        // Une variable du rendu : passée par valeur. Refusée si elle est réaffectée DANS la section, dans un rappel
        // (après le rendu : la section garderait la valeur du rendu), ou au rendu APRÈS la section.
        for (const cv of b.constantViolations) {
          if (plages.some((t) => dedans(cv.node, t))) raisons.push(`« ${nom} » est réaffectée dans la section (ligne ${cv.node.loc.start.line})`);
          else if (!auRendu(cv)) raisons.push(`« ${nom} » est réaffectée dans un rappel (ligne ${cv.node.loc.start.line})`);
          else if (cv.node.end > c.t.start) raisons.push(`« ${nom} » est réaffectée au rendu après la section (ligne ${cv.node.loc.start.line})`);
        }
        parValeur.push(nom);
      }
      // (28 nov.) Une ÉCRITURE faite au rendu de la section dans un objet du dehors (`ref.current = …`) arrive plus tard qu'avant
      // (le morceau se rend après Comptabilite) : refusée si le reste du rendu la relit APRÈS la section (il lirait l'ancienne valeur).
      for (const ch of [...(c.chemins || [c.cible]), ...aides]) ch.traverse({ AssignmentExpression(p) {
        let o = p.node.left; if (o.type !== 'MemberExpression') return;
        while (o.type === 'MemberExpression') o = o.object;
        if (o.type !== 'Identifier') return;
        const b = p.scope.getBinding(o.name); if (!b || plages.some((t) => dedans(b.identifier, t))) return;
        // au rendu de la section seulement (pas dans un rappel)
        for (let f = p.getFunctionParent(); f && plages.some((t) => dedans(f.node, t)); f = f.getFunctionParent()) if (!(f.parentPath && f.parentPath.isCallExpression() && f.parentPath.node.callee === f.node)) return;
        const apres = b.referencePaths.filter((rp) => !plages.some((t) => dedans(rp.node, t)) && rp.node.start > c.t.end && auRendu(rp));
        if (apres.length) raisons.push(`« ${o.name} » est écrit au rendu de la section et relu après elle (ligne ${apres[0].node.loc.start.line})`);
      } });
      if (raisons.length) { refusesTour.push({ c, raison: { nom: c.nom, raison: [...new Set(raisons)].join(' ; ') } }); continue; }
      acceptees.push({ s: { ...c.s, nom: c.nom }, t: c.t, aides, parValeur: parValeur.sort(), deTete });
    }
    if (!refusesTour.length) break;
    for (const x of refusesTour) refus.push(x.raison);
    enJeu = enJeu.filter((c) => !refusesTour.some((x) => x.c === c));
  }
  if (!acceptees.length) return { code: src, morceaux, faites, refus, deplacees: [], imports: { retires: [], nus: [] } };
  // une aide qu'une section refusée lisait reste (son nom ne serait plus défini dans Comptabilite)
  {
    const prises = new Set(acceptees.flatMap((a) => a.aides));
    const plagesOk = [...acceptees.map((a) => a.t), ...prises].map((x) => x.node || x);
    for (const st of prises) if (!aidesPossibles.get(st).every((nm) => st.scope.getBinding(nm).referencePaths.every((rp) => plagesOk.some((t) => dedans(rp.node, t))))) {
      throw new Error('sections-differees : une aide partie est lue hors des sections acceptées (' + aidesPossibles.get(st).join(',') + ')');
    }
  }
  const plagesAides = [...new Set(acceptees.flatMap((a) => a.aides))].map((st) => st.node);
  const dansSection = (n) => acceptees.some((a) => dedans(n, a.t)) || plagesAides.some((t) => dedans(n, t));

  // ── 2. Le graphe de tête : ce que le reste de Comptabilite lit (hors sections) ──
  const body = ast.program.body;
  const starts = body.map((s) => s.start);
  const idxDe = (pos) => { let lo = 0, hi = body.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (starts[m] <= pos) lo = m; else hi = m - 1; } return lo; };
  const declDe = {}; const nomsDe = body.map(() => []);
  for (const [nom, b] of Object.entries(progB)) { const i = idxDe(b.identifier.start); declDe[nom] = i; nomsDe[i].push(nom); }
  const aretes = body.map(() => new Set());
  const affecte = body.map(() => new Set());
  for (const [nom, b] of Object.entries(progB)) {
    const j = declDe[nom];
    for (const rp of b.referencePaths) { if (dansSection(rp.node)) continue; const i = idxDe(rp.node.start); if (i !== j) aretes[i].add(j); }
    for (const cv of b.constantViolations) { if (dansSection(cv.node)) continue; const i = idxDe(cv.node.start); if (i !== j) { aretes[i].add(j); affecte[i].add(nom); } }
  }
  const estDecl = (s) => /^(FunctionDeclaration|VariableDeclaration|ClassDeclaration|ImportDeclaration)$/.test(s.type);
  const fermer = (depart, interdit) => { const vus = new Set(); const pile = [...depart]; while (pile.length) { const i = pile.pop(); if (vus.has(i) || (interdit && interdit.has(i))) continue; vus.add(i); for (const j of aretes[i]) pile.push(j); } return vus; };
  const iImports = new Set(body.map((s, i) => i).filter((i) => body[i].type === 'ImportDeclaration'));
  // ce que lisent les sections (instructions de tête)
  const deTeteTous = new Set(acceptees.flatMap((a) => a.deTete));
  const departSections = [...deTeteTous].map((n) => declDe[n]).filter((i) => !iImports.has(i));
  let garde = new Set(), deplace = new Set();
  const epingles = new Set();
  for (let tour = 0; tour < 50; tour++) {
    garde = fermer([...body.map((s, i) => i).filter((i) => !estDecl(body[i])), ...epingles]);
    const atteint = fermer(departSections);
    deplace = new Set([...atteint].filter((i) => !garde.has(i) && !iImports.has(i)));
    // une instruction déplacée qui RÉAFFECTE une variable restée dans Comptabilite reste (un module ne
    // réaffecte pas une liaison importée)
    let neuf = false;
    for (const i of deplace) for (const n of affecte[i]) if (!deplace.has(declDe[n]) && !epingles.has(i)) { epingles.add(i); neuf = true; }
    // une instruction déplacée doit être une déclaration
    for (const i of deplace) if (!/^(FunctionDeclaration|VariableDeclaration|ClassDeclaration)$/.test(body[i].type) && !epingles.has(i)) { epingles.add(i); neuf = true; }
    if (!neuf) break;
  }
  // les noms de tête qu'un morceau lit : import (réimporté de sa source), déplacé (du morceau `-tete`), resté (de Comptabilite)
  const specImport = (nom) => { const b = progB[nom]; const dec = b.path.parentPath.node; const sp = b.path.node; return { source: dec.source.value, sp }; };
  // `locaux` : les instructions déplacées déclarées DANS le morceau (pas importées) ; `depuisTete` : le morceau est `-tete`.
  const blocImports = (noms, locaux, depuisTete) => {
    const parSource = new Map(); const tete = [], reste = [];
    for (const nom of [...noms].sort()) {
      const i = declDe[nom];
      if (locaux.has(i)) continue;
      if (iImports.has(i)) {
        const { source, sp } = specImport(nom);
        const cle = source.startsWith('.') ? relDuMorceau(path.resolve(dirFichier, source)) : source;
        if (!parSource.has(cle)) parSource.set(cle, { def: null, ns: null, noms: [] });
        const e = parSource.get(cle);
        if (sp.type === 'ImportDefaultSpecifier') e.def = nom; else if (sp.type === 'ImportNamespaceSpecifier') e.ns = nom;
        else { const imp = sp.imported.type === 'StringLiteral' ? JSON.stringify(sp.imported.value) : sp.imported.name; e.noms.push(imp === nom ? nom : `${imp} as ${nom}`); }
      } else if (deplace.has(i)) { if (!depuisTete) tete.push(nom); }
      else reste.push(nom);
    }
    let out = '';
    for (const [cle, e] of [...parSource.entries()].sort()) {
      if (e.ns) out += `import * as ${e.ns} from ${JSON.stringify(cle)};\n`;
      const parts = []; if (e.def) parts.push(e.def); if (e.noms.length) parts.push(`{ ${e.noms.join(', ')} }`);
      if (parts.length) out += `import ${parts.join(', ')} from ${JSON.stringify(cle)};\n`;
    }
    if (tete.length) out += `import { ${tete.join(', ')} } from ${JSON.stringify(`./${base}-tete.jsx`)};\n`;
    if (reste.length) out += `import { ${reste.join(', ')} } from ${JSON.stringify(relDuMorceau(fichier))};\n`;
    return { out, reste };
  };
  // ce qu'une instruction déplacée lit hors d'elle (noms de tête)
  const lusPar = (i) => { const lus = new Set(); for (const j of aretes[i]) for (const nom of nomsDe[j]) { const b = progB[nom]; if (b.referencePaths.some((rp) => idxDe(rp.node.start) === i && !dansSection(rp.node)) || b.constantViolations.some((cv) => idxDe(cv.node.start) === i)) lus.add(nom); } return lus; };
  const texteInstr = (i) => texteDeplace(i === 0 ? 0 : body[i - 1].end, body[i].end);
  const exportsComptabilite = new Set();
  const base = path.basename(fichier, '.jsx');
  // ── 3. Les instructions de tête déplacées : dans le morceau de LA section qui les lit, ou dans `-tete` (plusieurs) ──
  const iDeplacees = [...deplace].sort((a, b) => a - b);
  const atteintesPar = acceptees.map((a) => { const vus = new Set(); const pile = a.deTete.map((n) => declDe[n]).filter((i) => deplace.has(i)); while (pile.length) { const i = pile.pop(); if (vus.has(i)) continue; vus.add(i); for (const j of aretes[i]) if (deplace.has(j)) pile.push(j); } return vus; });
  const partagees = new Set(iDeplacees.filter((i) => atteintesPar.filter((v) => v.has(i)).length !== 1));
  if (partagees.size) {
    const iP = [...partagees].sort((a, b) => a - b);
    const lus = new Set(); for (const i of iP) for (const n of lusPar(i)) lus.add(n);
    const { out, reste } = blocImports(lus, partagees, true);
    reste.forEach((n) => exportsComptabilite.add(n));
    morceaux[`${base}-tete.jsx`] = `// Les fonctions de tête de ${path.basename(fichier)} que SEULES ses sections lisent (plusieurs d'entre elles) — découpées\n// AU BUILD (scripts/_sections-differees.cjs) ; le texte est celui du source, inchangé, dans le même ordre.\n${out}${iP.map(texteInstr).join('')}\nexport { ${iP.flatMap((i) => nomsDe[i]).sort().join(', ')} };\n`;
  }
  // ── 4. Les morceaux des sections ──
  const remplacements = [];
  acceptees.forEach((a, k) => {
    const nomComp = `Section${a.s.nom}`;
    const fichierMorceau = `${base}-${a.s.nom}.jsx`;
    const locaux = new Set([...atteintesPar[k]].filter((i) => !partagees.has(i)));
    const iL = [...locaux].sort((x, y) => x - y);
    const lus = new Set(a.deTete); for (const i of iL) for (const n of lusPar(i)) lus.add(n);
    const { out, reste } = blocImports(lus, locaux, false);
    reste.forEach((n) => exportsComptabilite.add(n));
    morceaux[fichierMorceau] = `// Section « ${a.s.nom} » de ${path.basename(fichier)}, découpée AU BUILD (scripts/_sections-differees.cjs) :\n// le JSX est celui du source, inchangé ; chargée quand la section se montre.\n${out}${iL.map(texteInstr).join('')}\nexport function ${nomComp}({ ${PROP} }) {\n  const { ${a.parValeur.join(', ')} } = ${PROP};\n${a.aides.map((st) => texteDeplace(st.node.start, st.node.end) + '\n').join('')}  return (\n${texteDeplace(a.t.start, a.t.end)}\n  );\n}\n`;
    remplacements.push({ start: a.t.start, end: a.t.end, texte: `<${nomComp} ${PROP}={{ ${a.parValeur.join(', ')} }}/>` });
    faites.push({ nom: a.s.nom, comp: nomComp, fichier: fichierMorceau, discret: !!a.s.discret, feuille: !!a.s.feuille, ouverture: a.s.ouverture || null, valeurs: a.parValeur.length, tete: a.deTete.length, locales: iL.length, aides: a.aides.map((st) => aidesPossibles.get(st).join('+')), octets: a.t.end - a.t.start + a.aides.reduce((x, st) => x + st.node.end - st.node.start, 0) });
  });
  // ── 5. Les imports qui ne servent plus qu'aux morceaux ──
  // (lu sur le graphe : un import encore lu par une instruction gardée reste ; sinon ses noms partent)
  const luParGarde = (nom) => { const b = progB[nom]; return b.referencePaths.some((rp) => !dansSection(rp.node) && garde.has(idxDe(rp.node.start))) || b.constantViolations.some((cv) => garde.has(idxDe(cv.node.start))); };
  const luAvant = (nom) => progB[nom].referencePaths.length > 0;
  const retires = [], nus = [];
  const vus = new Set(), cacheAst = new Map();
  const dejaEvalues = grapheDemarrage(R, cacheAst);
  for (const i of iImports) {
    const s = body[i];
    if (!s.specifiers.length) continue;
    const quittent = s.specifiers.filter((sp) => luAvant(sp.local.name) && !luParGarde(sp.local.name));
    if (!quittent.length) continue;
    const restent = s.specifiers.filter((sp) => !quittent.includes(sp));
    if (restent.length) {
      // le module reste importé : seuls les noms partis sont retirés (rien ne change à son évaluation)
      const txt = (sp) => src.slice(sp.start, sp.end);
      const def = restent.filter((sp) => sp.type === 'ImportDefaultSpecifier').map(txt);
      const ns = restent.filter((sp) => sp.type === 'ImportNamespaceSpecifier').map(txt);
      const nommes = restent.filter((sp) => sp.type === 'ImportSpecifier').map(txt);
      const parts = [...def, ...ns]; if (nommes.length) parts.push(`{ ${nommes.join(', ')} }`);
      const texte = ns.length && (def.length || nommes.length)
        ? `import ${ns[0]} from ${JSON.stringify(s.source.value)}; import ${[...def, ...(nommes.length ? [`{ ${nommes.join(', ')} }`] : [])].join(', ')} from ${JSON.stringify(s.source.value)};`
        : `import ${parts.join(', ')} from ${JSON.stringify(s.source.value)};`;
      remplacements.push({ start: s.start, end: s.end, texte });
      retires.push(`${s.source.value} (${quittent.length} nom(s))`);
      continue;
    }
    // plus aucun nom lu : le module part s'il n'a aucun effet à l'évaluation, ses feuilles de style restent
    const g = s.source.value.startsWith('.') ? resoudre(fichier, s.source.value) : null;
    const ex = g ? examinerModule(R, g, new Set(vus), cacheAst, dejaEvalues) : { pur: false, css: [] };
    if (ex.pur) {
      const css = ex.css.filter((c) => !vus.has(c)); css.forEach((c) => vus.add(c));
      const rel = (c) => { let r = path.relative(dirFichier, c).split(path.sep).join('/'); if (!r.startsWith('.')) r = './' + r; return r; };
      remplacements.push({ start: s.start, end: s.end, texte: css.map((c) => `import ${JSON.stringify(rel(c))};`).join(' ') + ` /* ⟦→ sections⟧ ${s.source.value} */` });
      retires.push(s.source.value);
    } else {
      remplacements.push({ start: s.start, end: s.end, texte: `import ${JSON.stringify(s.source.value)}; /* ⟦→ sections⟧ noms partis, effets gardés */` });
      nus.push(s.source.value);
    }
  }
  // ── 6. Le fichier livré ──
  for (const st of new Set(acceptees.flatMap((a) => a.aides))) remplacements.push({ start: st.node.start, end: st.node.end, texte: `/* ⟦→ sections⟧ ${aidesPossibles.get(st).join(', ')} */` });
  for (const i of iDeplacees) remplacements.push({ start: body[i].start, end: body[i].end, texte: `/* ⟦→ ${base}-tete⟧ ${nomsDe[i].join(', ')} */` });
  remplacements.sort((a, b) => b.start - a.start);
  for (let k = 1; k < remplacements.length; k++) if (remplacements[k].end > remplacements[k - 1].start) throw new Error('sections-differees : remplacements qui se chevauchent');
  let code = src;
  for (const r of remplacements) code = code.slice(0, r.start) + r.texte + code.slice(r.end);
  code += `\n// (27 nov., budget-vitesse) Sections chargées avec leur écran — scripts/_sections-differees.cjs.\n`;
  for (const f of faites) code += `const ${f.comp} = ${f.discret ? 'aLaDemandeDiscret' : f.feuille ? 'aLaDemandeFeuille' : 'aLaDemande'}(() => import(${JSON.stringify('./' + DOSSIER + '/' + f.fichier)}).then((m) => ({ default: m.${f.comp} })));\n`;
  const dejaExportes = new Set();
  for (const st of body) if (st.type === 'ExportNamedDeclaration') { for (const sp of st.specifiers || []) dejaExportes.add(sp.exported.name); const d = st.declaration; if (d && d.id) dejaExportes.add(d.id.name); if (d && d.declarations) for (const x of d.declarations) if (x.id.name) dejaExportes.add(x.id.name); }
  const aExporter = [...exportsComptabilite].filter((n) => !dejaExportes.has(n)).sort();
  if (aExporter.length) code += `export { ${aExporter.join(', ')} };\n`;
  return { code, morceaux, faites, refus, deplacees: iDeplacees.flatMap((i) => nomsDe[i]), epinglees: [...epingles].map((i) => nomsDe[i].join('+') || body[i].type), imports: { retires, nus }, dirMorceau };
}

// Une découpe par texte source (le français différé et le greffon de build la lisent tous les deux).
let _dernier = null;
function decouperUneFois(R, fichier, src) {
  if (_dernier && _dernier.src === src && _dernier.fichier === fichier) return _dernier.r;
  const r = decouper(R, fichier, src);
  _dernier = { src, fichier, r };
  return r;
}

// (27 nov.) LE FRANÇAIS DES SECTIONS, AVEC ELLES. Le français du démarrage (scripts/_francais-differe.cjs) se juge
// sur le Comptabilite LIVRÉ (sans ses sections) ; chaque morceau porte les clés que SON texte peut lire et que le
// démarrage n'a pas (même règle « peut lire » : clé exacte, préfixe, suffixe). fr-reste les garde aussi (le filet).
function francaisDesMorceaux(R, r, fr, base) {
  const F = require(path.join(R, 'scripts', '_francais-differe.cjs'));
  const out = {};
  const textes = {};
  for (const [f, c] of Object.entries(r.morceaux)) textes[path.join(r.dirMorceau, f)] = c;
  const { lire } = F.creer(R);
  for (const abs of Object.keys(textes)) {
    const o = lire(abs, textes);
    const P = [...o.prefixes], S = [...o.suffixes];
    const d = {};
    for (const [k, v] of Object.entries(fr)) if (!(k in base) && (o.exacts.has(k) || P.some((x) => k.startsWith(x)) || S.some((x) => k.endsWith(x)))) d[k] = v;
    for (const k of Object.keys(d)) if (fr[k + '.art'] != null && !(k + '.art' in base)) d[k + '.art'] = fr[k + '.art'];
    if (Object.keys(d).length) out[abs] = d;
  }
  return out;
}

module.exports = { decouper, decouperUneFois, francaisDesMorceaux, SECTIONS, DOSSIER, FONCTION, examinerModule };
