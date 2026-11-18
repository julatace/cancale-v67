// ════════════════════════════════════════════════════════════════════════════
//  LA CLÉ DE « COMMANDES À VÉRIFIER » PORTE TOUT CE QUE LE CALCUL LIT (18 nov., moteur-rapide)
//  node scripts/audit-cle-verifier.cjs            → vérifie (rouge si un nom lu manque à la clé)
//  node scripts/audit-cle-verifier.cjs --ecrire   → réécrit la liste entre ⟦cle-verifier⟧ … ⟦/cle-verifier⟧
//  node scripts/audit-cle-verifier.cjs --prouve   → mutations : chaque entrée retirée tour à tour ⇒ rouge
//
//  `commandesAVerifier` (Ma journée, src/App.jsx) n'est refait que si sa clé change. Une clé
//  à qui il manque une entrée montrerait un résultat PÉRIMÉ sans que rien ne le dise. Cet
//  audit refait l'analyse du code de `commandesAVerifierCalc` (babel) :
//   · tout nom de la portée de `Comptabilite` qu'il lit, directement ou par les fonctions
//     et constantes dérivées de cette portée qu'il appelle (développées, à toute profondeur) :
//     les RACINES sont les résultats de hooks (`use…`), les props, les `let` du composant ;
//   · tout `let`/`var` de module et toute table de module remplie en place (`new Map()`,
//     `{}`, `[]`) lus par les fonctions de module qu'il appelle (à toute profondeur) ;
//  et exige que chacune soit dans la clé, ou dans EXEMPTS avec sa raison. La clé porte en
//  plus `versionMemoire()` (src/versionDonnees.js) et la tranche de 10 s ; les clés du STOCKAGE lues sont
//  notées pendant le calcul (`suivreStockage`) et vérifiées à chaque rendu (`stockageInchange`) — exigé ici aussi.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const R = path.join(__dirname, '..');
const parser = require(path.join(R, 'node_modules', '@babel', 'parser'));
const traverse = require(path.join(R, 'node_modules', '@babel', 'traverse')).default;
const FICHIER = path.join(R, 'src', 'App.jsx');
const CIBLE = 'commandesAVerifierCalc';
const DEBUT = '/* ⟦cle-verifier⟧ */', FIN = '/* ⟦/cle-verifier⟧ */';

// Lus mais sans effet sur le résultat d'un rendu à l'autre — chacun avec sa raison.
const EXEMPTS = {
  _expeditionsMemo: 'mémoire interne de `expeditions()`, elle-même rangée par sa propre clé',
  memosVersion: 'référence stable (useRef) : la mémoire de `memoVersion`, rangée par version',
  INV_STATUS: 'table constante (jamais modifiée)',
  ETATS_HORS_PARCOURS: 'table constante (jamais modifiée)',
  vcLoc0: 'remplacé par ce qu\'il porte et que le calcul lit : `vcLoc0.departs` (la carte des départs) ; le reste vient du stockage (clés lues suivies : suivreStockage) et de `_vcMem` (versionMemoire)',
  _vcMem: 'copie en mémoire des clés Vestiaire : chaque changement passe par `signalerVc` ⇒ versionMemoire',
  TXN_ETATS: 'états des transactions : remplis par `noterEtatsTxn` ⇒ versionMemoire',
  _departsCarte: 'lu par `departsCarte()` : `vcLoc0.departs` est cette même carte',
};
// Ce que la clé porte en plus des noms (vérifié présent).
// Les fichiers IMPORTÉS que le calcul atteint : un état de module (`let`, table vide remplie en place, `new …`)
// n'y est admis qu'ici, avec sa raison (sinon il serait lu figé). Clé : « fichier:nom ».
const MODULES_ADMIS = {
  'liensColis.js:memo': 'mémoire d\'UN calcul synchrone, vidée à la microtâche suivante',
  'transporteursVisuels.js:_emailsParSuivi': 'WeakMap rangée par la liste elle-même (une autre liste = une autre entrée)',
  'departVente.js:_partis': 'publiée par `publierDepartsVinted`, qui appelle toucherMemoire() (versionMemoire est dans la clé)',
  '../api/_lib/limite-envoi.js:_fmt': 'formateur de date créé une fois',
  '../api/_lib/transporteurs.js:VG_RETOUR_GROUPES': 'ensemble constant', '../api/_lib/transporteurs.js:VG_GROUPES_DE_ROUTE': 'ensemble constant',
  '../api/_lib/transporteurs.js:ETATS_A_RELIRE': 'ensemble constant', '../api/_lib/transporteurs.js:AMBRE': 'ensemble constant',
  '../api/_lib/depart-colis.js:CP_PAS_DEPART': 'ensemble constant', '../api/_lib/depart-colis.js:VG_PAS_DEPART': 'ensemble constant',
};
const EN_PLUS = ['vcLoc0.departs', 'versionMemoire()', 'Math.floor(Date.now() / 10000)'];

function analyser(src) {
  const ast = parser.parse(src, { sourceType: 'module', plugins: ['jsx'], errorRecovery: true });
  let prog = null, compta = null;
  traverse(ast, {
    Program(p) { prog = p; },
    FunctionDeclaration(p) { if (p.node.id && p.node.id.name === 'Comptabilite') compta = p; },
  });
  if (!compta) throw new Error('fonction Comptabilite introuvable');
  const cScope = compta.scope, mScope = prog.scope;
  const b0 = cScope.getBinding(CIBLE);
  if (!b0) throw new Error(CIBLE + ' introuvable dans Comptabilite');
  const dans = (p, a) => { for (let x = p; x; x = x.parentPath) if (x === a) return true; return false; };
  const dansCompta = (s) => { for (let x = s; x; x = x.parent) if (x === cScope) return true; return false; };
  const estHook = (n) => n && n.type === 'CallExpression' && ((n.callee.type === 'Identifier' && /^use[A-Z]/.test(n.callee.name))
    || (n.callee.type === 'MemberExpression' && n.callee.property && /^use[A-Z]/.test(n.callee.property.name || '')));
  const racines = new Set(), modules = new Set(), imports = new Set();
  const vus = new Set();
  const pile = [b0.path.isFunctionDeclaration() ? b0.path : b0.path.get('init')];
  while (pile.length) {
    const corps = pile.pop();
    corps.traverse({
      'Identifier|JSXIdentifier'(ip) {
        if (ip.isIdentifier() && !ip.isReferencedIdentifier()) return;
        const nom = ip.node.name; const b = ip.scope.getBinding(nom);
        if (!b || dans(b.path, corps)) return;
        const cle = (b.scope === mScope ? 'm:' : 'c:') + nom;
        if (b.scope === mScope) {
          if (b.kind === 'module') { imports.add(nom); return; }   // import : son fichier est vérifié plus bas
          if (b.kind === 'let' || b.kind === 'var') { modules.add(nom); return; }
          const ini = b.path.node && b.path.node.init;
          if (ini && (ini.type === 'ObjectExpression' || ini.type === 'ArrayExpression' || ini.type === 'NewExpression')) { modules.add(nom); return; }
          if (vus.has(cle)) return; vus.add(cle);
          if (b.path.isFunctionDeclaration()) pile.push(b.path);
          else if (ini && /Function/.test(ini.type)) pile.push(b.path.get('init'));
          return;
        }
        if (!dansCompta(b.scope)) return;
        if (vus.has(cle)) return; vus.add(cle);
        if (b.kind === 'param') { racines.add(nom); return; }
        if (b.path.isFunctionDeclaration()) { pile.push(b.path); return; }
        const n = b.path.node;
        if (n.type === 'VariableDeclarator') {
          if (estHook(n.init)) { racines.add(nom); return; }
          if (b.kind === 'let' || b.kind === 'var') { racines.add(nom); return; }
          if (n.init) { pile.push(b.path.get('init')); return; }   // fonction ou dérivée : développée
        }
        racines.add(nom);
      },
    });
  }
  // Les fichiers importés atteints : leurs états de module (hors MODULES_ADMIS).
  const source = {};
  for (const n of prog.node.body) if (n.type === 'ImportDeclaration') for (const sp of n.specifiers) source[sp.local.name] = n.source.value;
  const etatsImportes = [];
  for (const f of new Set([...imports].map((n) => source[n]).filter((f) => f && f.startsWith('.')))) {
    let fp = path.resolve(path.dirname(FICHIER), f);
    if (!fs.existsSync(fp)) continue;
    let a2; try { a2 = parser.parse(fs.readFileSync(fp, 'utf8'), { sourceType: 'module', plugins: ['jsx'], errorRecovery: true }); } catch (_) { continue; }
    for (const n of a2.program.body) {
      const d = n.type === 'ExportNamedDeclaration' ? n.declaration : n;
      if (!d || d.type !== 'VariableDeclaration') continue;
      for (const v of d.declarations) {
        const i = v.init; const nom = v.id && v.id.name; if (!nom) continue;
        const etat = d.kind !== 'const' || (i && (i.type === 'NewExpression' || (i.type === 'ObjectExpression' && !i.properties.length) || (i.type === 'ArrayExpression' && !i.elements.length)));
        if (etat) etatsImportes.push(f.replace(/^\.\//, '') + ':' + nom);
      }
    }
  }
  return { racines: [...racines].sort(), modules: [...modules].sort(), etatsImportes };
}

function cleAttendue(a) {
  const noms = [...a.racines, ...a.modules].filter((n) => !EXEMPTS[n]);
  return [...noms, ...EN_PLUS];
}
function lireCle(src) {
  const i = src.indexOf(DEBUT), j = src.indexOf(FIN);
  if (i < 0 || j < 0 || j < i) return null;
  const t = src.slice(i + DEBUT.length, j).trim().replace(/^\[|\]$/g, '');
  return t.split(',').map((x) => x.trim()).filter(Boolean);
}
function ecrireCle(src, liste) {
  const i = src.indexOf(DEBUT), j = src.indexOf(FIN);
  return src.slice(0, i + DEBUT.length) + ' [' + liste.join(', ') + '] ' + src.slice(j);
}
function verifier(src) {
  const a = analyser(src);
  const cle = lireCle(src);
  const rouges = [];
  if (!cle) return { rouges: ['marqueurs ⟦cle-verifier⟧ introuvables'], a, cle };
  const dansCle = new Set(cle);
  for (const n of cleAttendue(a)) if (!dansCle.has(n)) rouges.push(`« ${n} » est lu par ${CIBLE} mais absent de la clé`);
  for (const e of a.etatsImportes) if (!MODULES_ADMIS[e]) rouges.push(`état de module « ${e} » lu par ${CIBLE} (fichier importé) : ni dans la clé ni admis — le versionner (toucherMemoire) puis l'admettre avec sa raison`);
  for (const n of Object.keys(EXEMPTS)) if (dansCle.has(n)) rouges.push(`« ${n} » est exempté (${EXEMPTS[n]}) mais dans la clé`);
  return { rouges, a, cle };
}

const src = fs.readFileSync(FICHIER, 'utf8');
if (process.argv.includes('--ecrire')) {
  const a = analyser(src);
  fs.writeFileSync(FICHIER, ecrireCle(src, cleAttendue(a)));
  console.log(`clé réécrite : ${cleAttendue(a).length} entrées (${a.racines.length} de l'écran, ${a.modules.length} de module)`);
  process.exit(0);
}
if (process.argv.includes('--prouve')) {
  const cle = lireCle(src) || [];
  let rougies = 0;
  for (const n of cle.filter((x) => !EN_PLUS.includes(x))) {
    const r = verifier(ecrireCle(src, cle.filter((x) => x !== n)));
    if (r.rouges.length) rougies++; else console.log(`  ✗ retirer « ${n} » ne rougit pas`);
  }
  // Un état de module importé non admis : rouge.
  { const sauve = MODULES_ADMIS['departVente.js:_partis']; delete MODULES_ADMIS['departVente.js:_partis']; const rr = verifier(src); MODULES_ADMIS['departVente.js:_partis'] = sauve;
    console.log(`état importé non admis (departVente.js:_partis) ⇒ ${rr.rouges.length ? 'rouge' : 'VERT (défaut)'}`); if (!rr.rouges.length) rougies = -1e9; }
  // Et un nom lu ajouté au calcul sans la clé : rouge.
  const mutant = src.replace(`const ${CIBLE} = () => {`, `const ${CIBLE} = () => { void cycleRepondus;`);
  const rm = verifier(mutant);
  console.log(`mutations : ${rougies}/${cle.length - EN_PLUS.length} entrées retirées ⇒ rouge ; nom lu ajouté sans la clé ⇒ ${rm.rouges.length ? 'rouge' : 'VERT (défaut)'}`);
  process.exit(rougies === cle.length - EN_PLUS.length && rm.rouges.length ? 0 : 1);
}
const r = verifier(src);
if (!/stockageInchange\(m\.lu\)/.test(src) || !/suivreStockage\(commandesAVerifierCalc\)/.test(src)) r.rouges.push('le stockage lu par le calcul n\'est plus suivi (suivreStockage / stockageInchange)');
for (const x of EN_PLUS) if (!(r.cle || []).includes(x)) r.rouges.push(`la clé ne porte pas « ${x} »`);
if (r.rouges.length) { for (const x of r.rouges) console.log('  ❌ ' + x); console.log(`\naudit-cle-verifier : ${r.rouges.length} rouge(s) — \`node scripts/audit-cle-verifier.cjs --ecrire\` refait la liste`); process.exit(1); }
console.log(`  ✅ la clé de « commandes à vérifier » porte les ${r.a.racines.length} entrées de l'écran et les ${r.a.modules.length} de module lues (${Object.keys(EXEMPTS).length} exemptées, raison dite) ; états de module des fichiers importés : ${r.a.etatsImportes.length}, tous admis avec leur raison`);
console.log('\naudit-cle-verifier : vert');
