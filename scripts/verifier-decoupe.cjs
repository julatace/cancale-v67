#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  PREUVES DE NON-RÉGRESSION D'UNE DÉCOUPE D'App.jsx (11 nov., découpe 2)
//
//    node scripts/verifier-decoupe.cjs --avant <arbre> --apres <arbre> [étapes…] [--rapport f.json]
//      étapes : texte structure imports poids audits tests bancs   (défaut : toutes)
//      (un arbre = un dépôt extrait avec son node_modules ; `git worktree add` + lien node_modules)
//
//  1. texte      : le texte de l'app RECOLLÉ (scripts/_source-app.cjs) après = avant, ligne à ligne,
//                  aux seules différences permises : les imports de style gardés à leur place
//                  (« gardé à sa place ») et la liste d'exports des emprunts. Tout autre écart = rouge :
//                  le code n'a pas été réécrit, seulement déplacé.
//  2. structure  : sur les FICHIERS RÉELS (App.jsx + src/ecrans + src/coeur) : nombre de `tab===`,
//                  de `curSub===`, des écrans montés (branches `{tab==='x' && …}` / `curSub`), et la
//                  liste des composants RENDUS (chaque <Nom>, compté) : après = avant, plus UN rendu
//                  par vue/racine paresseuse neuve (et rien d'autre).
//  3. imports    : chaque nom importé d'un fichier relatif de src/ y est bien exporté (un écran à la
//                  demande qui emprunte un nom qu'App.jsx n'exporte plus = écran blanc).
//  4. poids      : `vite build` des deux arbres ; le PREMIER CHARGEMENT de l'app (le morceau App et ce
//                  qu'il importe statiquement : la liste `data-js`/`data-css` que index.html précharge),
//                  brut et gzip.
//  5. audits     : scripts/lancer-audits.cjs dans les deux arbres ; un audit vert avant et rouge après = rouge.
//  6. tests      : chaque scripts/tests/*.test.mjs (node --test) dans les deux arbres ; même règle.
//  7. bancs      : scripts/lancer-bancs.cjs (le lot de la CI) sur le dist/ de chaque arbre ; un banc
//                  vert avant et rouge après = rouge (relancé une fois avant d'être compté).
//  Sortie : 0 si aucune régression ; 1 sinon. Rien n'est écrit dans les arbres hors dist/.
//  (11 nov., reprise) Machine partagée : audits 2 à la fois (AUDITS_PARALLELE ≤ 2), tests 2 à la fois,
//  ports des bancs tirés au hasard. `--audits-avant f.json` / `--bancs-avant f.json` reprennent une
//  mesure de l'AVANT déjà faite (même commit : le rapport le vérifie) au lieu de la refaire ;
//  `--garder-avant d/` écrit les mesures de l'avant dans d/ pour la fois suivante.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib'), os = require('os');
const { spawnSync, spawn } = require('child_process');

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const AVANT = path.resolve(opt('--avant', ''));
const APRES = path.resolve(opt('--apres', path.join(__dirname, '..')));
const RAPPORT = opt('--rapport', null);
const AUDITS_AVANT = opt('--audits-avant', null), BANCS_AVANT = opt('--bancs-avant', null), GARDER = opt('--garder-avant', null);
const teteDe = (R) => { const r = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: R, encoding: 'utf8' }); return (r.stdout || '').trim(); };
const PORT0 = 20000 + Math.floor(Math.random() * 30000);
const TOUTES = ['texte', 'structure', 'imports', 'poids', 'audits', 'tests', 'bancs'];
const ETAPES = args.filter((a) => TOUTES.includes(a));
const etapes = ETAPES.length ? ETAPES : TOUTES;
if (!AVANT || !fs.existsSync(path.join(AVANT, 'src', 'App.jsx'))) { console.error('--avant <arbre> : un arbre avec src/App.jsx'); process.exit(2); }
const NM = path.join(__dirname, '..', 'node_modules', '@babel') + '/';
const parser = require(NM + 'parser');
const traverse = require(NM + 'traverse').default;
const S = require('./_source-app.cjs');
const rapport = { avant: AVANT, apres: APRES };
let rouge = 0;
const KO = (m) => { rouge++; console.log('❌ ' + m); };
const OK = (m) => console.log('✅ ' + m);
const ko = (n) => (n / 1024).toFixed(0) + ' Ko';

// ── 1. texte recollé ──
function etapeTexte() {
  const norm = (t) => t.replace(/\/\/ ⟦démarrage léger⟧ emprunts des écrans à la demande\nexport \{[^}]*\};\n/, '')
    .split('\n').filter((l) => !/\/\/ \(8 nov\.\) style de .*gardé à sa place/.test(l));
  const a = norm(S.sourceApp(AVANT)), b = norm(S.sourceApp(APRES));
  // diff ligne à ligne (les deux textes doivent être ÉGAUX : pas besoin d'un vrai diff)
  let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (i === a.length && i === b.length) { OK(`texte recollé identique à l'avant (${a.length} lignes)`); rapport.texte = { lignes: a.length, ecarts: 0 }; return; }
  let ja = a.length - 1, jb = b.length - 1; while (ja >= i && jb >= i && a[ja] === b[jb]) { ja--; jb--; }
  KO(`texte recollé DIFFÉRENT de l'avant : lignes ${i + 1}–${ja + 1} (avant) / ${i + 1}–${jb + 1} (après)\n   avant : ${JSON.stringify((a[i] || '').slice(0, 160))}\n   après : ${JSON.stringify((b[i] || '').slice(0, 160))}`);
  rapport.texte = { premiereLigne: i + 1 };
}

// ── 2. structure sur les fichiers réels ──
function fichiersReels(R) { return S.fichiersApp(R); }
function structure(R) {
  const rendus = new Map(); let tab = 0, curSub = 0, branches = 0; const paresseux = new Set();
  for (const f of fichiersReels(R)) {
    const t = fs.readFileSync(f, 'utf8');
    const ast = parser.parse(t, { sourceType: 'module', plugins: ['jsx'], errorRecovery: false });
    // (11 nov.) les lignes POSÉES par l'outil (« // ⟦découpe 2⟧ » : aides aLaDemandeSansAttente…) ne comptent pas : le texte d'origine est prouvé égal par l'étape texte
    const posees = new Set(); t.split('\n').forEach((l, i) => { if (/\/\/ ⟦découpe 2⟧/.test(l)) posees.add(i + 1); });
    traverse(ast, {
      JSXOpeningElement(p) { if (posees.has(p.node.loc.start.line)) return; let n = p.node.name; let nom = n.type === 'JSXIdentifier' ? n.name : n.type === 'JSXMemberExpression' ? (n.object.name || '?') + '.' + n.property.name : '?'; if (/^[A-Z]/.test(nom) || nom.includes('.')) rendus.set(nom, (rendus.get(nom) || 0) + 1); },
      BinaryExpression(p) { const l = p.node.left; if (p.node.operator === '===' && l.type === 'Identifier') { if (l.name === 'tab') tab++; if (l.name === 'curSub') curSub++; } },
      JSXExpressionContainer(p) { const e = p.node.expression; if (e && e.type === 'LogicalExpression' && e.operator === '&&') { let g = e.left; while (g.type === 'LogicalExpression') g = g.left; if (g.type === 'BinaryExpression' && g.left.type === 'Identifier' && /^(tab|curSub)$/.test(g.left.name)) branches++; } },
    });
    // une VUE (decouper-app-2) est rendue UNE fois de plus : son appel `<VueX v={{…}}/>` dans App.jsx
    for (const m of t.matchAll(/\/\*⟦→ [^ ]+ #v\d+⟧\*\/<(\w+) /g)) paresseux.add(m[1]);
  }
  return { rendus, tab, curSub, branches, paresseux };
}
function etapeStructure() {
  const a = structure(AVANT), b = structure(APRES);
  const neufs = [...b.paresseux].filter((x) => !a.paresseux.has(x));
  rapport.structure = { avant: { tab: a.tab, curSub: a.curSub, branches: a.branches, composants: a.rendus.size }, apres: { tab: b.tab, curSub: b.curSub, branches: b.branches, composants: b.rendus.size }, paresseuxNeufs: neufs };
  (a.tab === b.tab ? OK : KO)(`\`tab===\` : ${a.tab} → ${b.tab}`);
  (a.curSub === b.curSub ? OK : KO)(`\`curSub===\` : ${a.curSub} → ${b.curSub}`);
  (a.branches === b.branches ? OK : KO)(`écrans montés (branches {tab/curSub===… && …}) : ${a.branches} → ${b.branches}`);
  const ecarts = [];
  for (const nom of new Set([...a.rendus.keys(), ...b.rendus.keys()])) {
    const x = a.rendus.get(nom) || 0, y = b.rendus.get(nom) || 0;
    const attendu = x + (neufs.includes(nom) ? 1 : 0);
    if (y !== attendu) ecarts.push(`${nom} ${x}→${y}${neufs.includes(nom) ? ' (attendu ' + attendu + ')' : ''}`);
  }
  // (11 nov., reprise) §4.11 « un composant jamais rendu ne lève rien » : chaque vue/racine d'un module
  // src/coeur/ doit être déclarée paresseuse dans App.jsx ET rendue au moins une fois (sinon son texte
  // existe, tous les comptes tombent juste, et l'écran a disparu).
  const orphelins = [];
  try {
    const app = fs.readFileSync(path.join(APRES, 'src', 'App.jsx'), 'utf8');
    for (const f of fs.readdirSync(path.join(APRES, 'src', 'coeur')).filter((x) => /\.jsx?$/.test(x))) {
      const t = fs.readFileSync(path.join(APRES, 'src', 'coeur', f), 'utf8');
      const noms = [...t.matchAll(/^export function (\w+)\(\{ v \}\)/gm)].map((m) => m[1]);
      const ex = t.match(/\nexport \{ ([^}]*) \};\n*$/); if (ex) noms.push(...ex[1].split(',').map((x) => x.trim()).filter(Boolean));
      for (const n of noms) {
        const lazyDecl = new RegExp(`^const ${n} = aLaDemande\\(\\(\\) => import\\('\\./coeur/${f.replace('.', '\\.')}'\\)`, 'm').test(app);
        const rendus = (app.match(new RegExp(`<${n}[\\s/>]`, 'g')) || []).length + [...fs.readdirSync(path.join(APRES, 'src', 'coeur'))].reduce((a, g) => a + ((fs.readFileSync(path.join(APRES, 'src', 'coeur', g), 'utf8').match(new RegExp(`<${n}[\\s/>]`, 'g')) || []).length), 0) + S.fichiersApp(APRES).filter((x) => /ecrans/.test(x)).reduce((a, g) => a + ((fs.readFileSync(g, 'utf8').match(new RegExp(`<${n}[\\s/>]`, 'g')) || []).length), 0);
        if (!lazyDecl) orphelins.push(`${n} (coeur/${f}) : pas déclaré paresseux dans App.jsx`);
        else if (!rendus) orphelins.push(`${n} (coeur/${f}) : jamais rendu`);
      }
    }
  } catch (e) { if (e.code !== 'ENOENT') throw e; }
  rapport.structure.orphelins = orphelins;
  if (orphelins.length) KO(`écran(s) découpé(s) jamais rendu(s) : ${orphelins.join(' ; ')}`);
  else OK('chaque vue/racine de src/coeur/ est déclarée paresseuse dans App.jsx et rendue');
  if (ecarts.length) KO(`composants rendus : écarts ${ecarts.slice(0, 20).join(', ')}`);
  else OK(`composants rendus : ${a.rendus.size} noms, mêmes nombres de rendus (+1 pour chacun des ${neufs.length} paresseux neufs : ${neufs.join(', ')})`);
}

// ── 3. imports / exports ──
function exportsDe(f, cache) {
  if (cache.has(f)) return cache.get(f);
  const res = { noms: new Set(), etoile: false }; cache.set(f, res);
  let t; try { t = fs.readFileSync(f, 'utf8'); } catch (_) { return null; }
  let ast; try { ast = parser.parse(t, { sourceType: 'module', plugins: ['jsx'] }); } catch (_) { res.etoile = true; return res; }
  for (const st of ast.program.body) {
    if (st.type === 'ExportDefaultDeclaration') res.noms.add('default');
    else if (st.type === 'ExportAllDeclaration') res.etoile = true;
    else if (st.type === 'ExportNamedDeclaration') {
      const d = st.declaration;
      if (d && d.id) res.noms.add(d.id.name);
      else if (d && d.declarations) for (const x of d.declarations) { if (x.id.type === 'Identifier') res.noms.add(x.id.name); else res.etoile = true; }
      for (const sp of st.specifiers || []) res.noms.add(sp.exported.name || sp.exported.value);
    }
  }
  return res;
}
function importsCasses(R) {
  const src = path.join(R, 'src'); const casses = []; const cache = new Map();
  const tous = [];
  const marcher = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) marcher(p); else if (/\.(jsx?|mjs)$/.test(e.name)) tous.push(p); } };
  marcher(src);
  const resoudre = (de, spec) => { const b = path.resolve(path.dirname(de), spec); for (const c of [b, b + '.js', b + '.jsx', path.join(b, 'index.js')]) if (fs.existsSync(c) && fs.statSync(c).isFile()) return c; return null; };
  for (const f of tous) {
    let ast; try { ast = parser.parse(fs.readFileSync(f, 'utf8'), { sourceType: 'module', plugins: ['jsx'] }); } catch (_) { continue; }
    const voir = (spec, noms, ligne) => {
      if (!spec.startsWith('.') || /\.(css|json|svg|png|wasm)(\?|$)/.test(spec)) return;
      const cible = resoudre(f, spec); if (!cible) { casses.push(`${path.relative(R, f)}:${ligne} importe ${spec} (introuvable)`); return; }
      const ex = exportsDe(cible, cache); if (!ex || ex.etoile) return;
      for (const n of noms) if (!ex.noms.has(n)) casses.push(`${path.relative(R, f)}:${ligne} importe ${n} de ${spec} (pas exporté)`);
    };
    traverse(ast, {
      ImportDeclaration(p) { voir(p.node.source.value, p.node.specifiers.filter((s) => s.type !== 'ImportNamespaceSpecifier').map((s) => s.type === 'ImportDefaultSpecifier' ? 'default' : (s.imported.name || s.imported.value)), p.node.loc.start.line); },
      // import('./x').then((m) => ({ default: m.Nom })) : le nom lu sur le module
      CallExpression(p) {
        const c = p.node; if (c.callee.type !== 'Import' || !c.arguments[0] || c.arguments[0].type !== 'StringLiteral') return;
        const par = p.parentPath; const noms = [];
        if (par.isMemberExpression() && par.parentPath.isCallExpression() && par.node.property.name === 'then') {
          const fn = par.parentPath.node.arguments[0];
          if (fn && fn.params && fn.params[0] && fn.params[0].type === 'Identifier') { const m = fn.params[0].name; par.parentPath.get('arguments.0').traverse({ MemberExpression(q) { if (q.node.object.type === 'Identifier' && q.node.object.name === m && !q.node.computed) noms.push(q.node.property.name); } }); }
        } else {
          // lazy(() => import('./X')) / aLaDemande(() => import('./X')) : l'export par défaut
          const fl = par.isArrowFunctionExpression() ? par : null;
          const appel = fl && fl.parentPath.isCallExpression() ? fl.parentPath.node.callee : null;
          const nomAppel = appel ? (appel.type === 'Identifier' ? appel.name : appel.property && appel.property.name) : '';
          if (/^(lazy|aLaDemande)$/.test(nomAppel || '')) noms.push('default');
        }
        voir(c.arguments[0].value, noms, c.loc.start.line);
      },
    });
  }
  return casses;
}
function etapeImports() {
  const a = new Set(importsCasses(AVANT)), b = importsCasses(APRES);
  const neufs = b.filter((x) => !a.has(x.replace(/:\d+ /, ' ')) && ![...a].some((y) => y.replace(/:\d+ /, ' ') === x.replace(/:\d+ /, ' ')));
  rapport.imports = { avant: a.size, apres: b.length, neufs };
  if (neufs.length) KO(`imports cassés neufs (${neufs.length}) : ${neufs.slice(0, 15).join(' ¦ ')}`);
  else OK(`chaque nom importé d'un fichier de src/ y est exporté (${b.length} défaut(s) déjà là avant : ${a.size})`);
}

// ── 4. poids du premier chargement ──
function construire(R, sortie) {
  const r = spawnSync(process.execPath, [path.join(R, 'node_modules', 'vite', 'bin', 'vite.js'), 'build', '--outDir', sortie, '--emptyOutDir'], { cwd: R, encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.status !== 0) return { erreur: (r.stdout + r.stderr).split('\n').filter((l) => /error|Error/.test(l)).slice(0, 10).join('\n') || 'build en échec' };
  return { ok: true };
}
function mesurer(dist) {
  const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
  const balise = html.match(/<script[^>]*src="\/demarrage-app\.js"[^>]*>/);
  const attr = (n) => { const m = balise && balise[0].match(new RegExp(n + '="([^"]*)"')); return m ? m[1].split(',').filter(Boolean).map((x) => x.replace(/^\//, '')) : []; };
  const entree = [...html.matchAll(/<script type="module"[^>]*src="\/([^"]+)"/g), ...html.matchAll(/<link rel="modulepreload"[^>]*href="\/([^"]+)"/g)].map((m) => m[1]);
  const js = [...new Set([...entree, ...attr('data-js')])], css = [...new Set([...html.matchAll(/<link rel="stylesheet"[^>]*href="\/([^"]+)"/g)].map((m) => m[1]).concat(attr('data-css')))];
  const taille = (l) => l.reduce((acc, f) => { const b = fs.readFileSync(path.join(dist, f)); acc.brut += b.length; acc.gz += zlib.gzipSync(b, { level: 9 }).length; return acc; }, { brut: 0, gz: 0 });
  const app = attr('data-js').find((f) => /\/App-[^/]+\.js$/.test(f));
  const tApp = app ? taille([app]) : null;
  const tousJs = fs.readdirSync(path.join(dist, 'assets')).filter((f) => f.endsWith('.js')).map((f) => 'assets/' + f);
  return { js: taille(js), css: taille(css), app: tApp, fichiers: js, toutJs: taille(tousJs) };
}
function etapePoids() {
  const out = {};
  for (const [nom, R] of [['avant', AVANT], ['apres', APRES]]) {
    const d = path.join(os.tmpdir(), `vrm-decoupe-dist-${nom}-${process.pid}`);
    const b = construire(R, d);
    if (b.erreur) { KO(`build ${nom} : ${b.erreur}`); return; }
    out[nom] = mesurer(d);
    fs.rmSync(d, { recursive: true, force: true });
  }
  OK('build des deux arbres');
  const a = out.avant, b = out.apres;
  const pct = (x, y) => `${(((y - x) / x) * 100).toFixed(1)} %`;
  console.log(`   morceau App            : ${ko(a.app.brut)} / ${ko(a.app.gz)} gz → ${ko(b.app.brut)} / ${ko(b.app.gz)} gz (${pct(a.app.gz, b.app.gz)} gz)`);
  console.log(`   JS du premier chargement : ${ko(a.js.brut)} / ${ko(a.js.gz)} gz → ${ko(b.js.brut)} / ${ko(b.js.gz)} gz (${pct(a.js.gz, b.js.gz)} gz)`);
  console.log(`   CSS du premier chargement: ${ko(a.css.gz)} gz → ${ko(b.css.gz)} gz`);
  console.log(`   tout le JS construit     : ${ko(a.toutJs.gz)} gz → ${ko(b.toutJs.gz)} gz (rien de perdu : à peu près pareil)`);
  rapport.poids = out;
  if (b.js.gz > a.js.gz) KO('le premier chargement est plus LOURD qu’avant');
}

// ── 5/6/7. audits, tests, bancs : dans les deux arbres ──
function lancer(cmd, argv, R, env, ms) {
  return new Promise((resolve) => {
    const e = spawn(cmd, argv, { cwd: R, env: Object.assign({}, process.env, env || {}), stdio: ['ignore', 'pipe', 'pipe'], detached: true });
    let sortie = ''; e.stdout.on('data', (b) => { sortie += b; }); e.stderr.on('data', (b) => { sortie += b; });
    const t = setTimeout(() => { try { process.kill(-e.pid, 'SIGKILL'); } catch (_) {} }, ms);
    e.on('close', (code) => { clearTimeout(t); resolve({ code, sortie }); });
  });
}
async function etapeAudits() {
  const res = {};
  for (const [nom, R] of [['avant', AVANT], ['apres', APRES]]) {
    let j = path.join(os.tmpdir(), `vrm-decoupe-audits-${nom}-${process.pid}.json`);
    if (nom === 'avant' && AUDITS_AVANT) { j = AUDITS_AVANT; console.log(`   avant : repris de ${j}`); }
    else await lancer(process.execPath, [path.join(R, 'scripts', 'lancer-audits.cjs')], R, { AUDITS_JSON: j, AUDITS_PARALLELE: '2' }, 4 * 3600e3);
    if (nom === 'avant' && GARDER && !AUDITS_AVANT) { fs.mkdirSync(GARDER, { recursive: true }); fs.copyFileSync(j, path.join(GARDER, `audits-avant-${teteDe(AVANT).slice(0, 9)}.json`)); }
    try { res[nom] = Object.fromEntries(JSON.parse(fs.readFileSync(j, 'utf8')).map((x) => [x.audit, x.etat])); } catch (_) { KO(`audits ${nom} : pas de rapport`); return; }
    spawnSync('git', ['checkout', '--', 'public/'], { cwd: R });
  }
  const vert = (e) => e === 'vert' || e === 'instable' || e === 'exception-verte' || e === 'rouge-connu';
  const nouveaux = Object.keys(res.apres).filter((a) => !vert(res.apres[a]) && (res.avant[a] == null || vert(res.avant[a])));
  // un rouge neuf est relancé SEUL une fois (une mesure de durée en parallèle ?)
  const vraiment = [];
  for (const a of nouveaux) { const r = await lancer(process.execPath, [path.join(APRES, 'scripts', a)], APRES, {}, 900e3); if (r.code !== 0) vraiment.push(a); }
  spawnSync('git', ['checkout', '--', 'public/'], { cwd: APRES });
  const rougesAvant = Object.keys(res.avant).filter((a) => !vert(res.avant[a]));
  rapport.audits = { total: Object.keys(res.apres).length, rougesAvant, rougesNeufs: vraiment, rougesNeufsEnParallele: nouveaux };
  // (11 nov., reprise) Un rouge neuf qui repasse au vert quand ses lectures de src/App.jsx rendent l'app
  // RECOLLÉE ne voit qu'un déménagement : le remède est `node scripts/brancher-audits.cjs <audits>`.
  const brut = [];
  if (vraiment.length) {
    const pre = path.join(os.tmpdir(), `vrm-brancher-${process.pid}.cjs`);
    fs.writeFileSync(pre, `require(${JSON.stringify(path.join(APRES, 'scripts', '_source-app.cjs'))}).brancher();\n`);
    for (const a of vraiment) { const r = await lancer(process.execPath, [path.join(APRES, 'scripts', a)], APRES, { NODE_OPTIONS: `--require ${pre}` }, 900e3); if (r.code === 0) brut.push(a); }
    spawnSync('git', ['checkout', '--', 'public/'], { cwd: APRES });
  }
  rapport.audits.lisentAppBrut = brut;
  if (brut.length) console.log(`   dont ${brut.length} vert(s) sur l'app recollée (ils lisent src/App.jsx brut) : node scripts/brancher-audits.cjs ${brut.join(' ')}`);
  if (vraiment.length) KO(`audits rouges NEUFS : ${vraiment.join(', ')}`);
  else OK(`audits : ${Object.keys(res.apres).length} lancés, aucun rouge neuf (rouges déjà rouges avant : ${rougesAvant.length}${rougesAvant.length ? ' — ' + rougesAvant.join(', ') : ''})`);
}
async function etapeTests() {
  const liste = fs.readdirSync(path.join(APRES, 'scripts', 'tests')).filter((f) => f.endsWith('.test.mjs')).sort();
  const res = { avant: {}, apres: {} };
  for (const [nom, R] of [['avant', AVANT], ['apres', APRES]]) {
    // deux à la fois (machine partagée)
    let k = 0; const file = liste.slice();
    await Promise.all([0, 1].map(async () => { while (file.length) { const t = file.shift(); const p = path.join(R, 'scripts', 'tests', t); if (!fs.existsSync(p)) { res[nom][t] = 'absent'; continue; } const r = await lancer(process.execPath, ['--test', p], R, {}, 600e3); res[nom][t] = r.code === 0 ? 'vert' : 'rouge'; k++; } }));
  }
  let neufs = liste.filter((t) => res.apres[t] === 'rouge' && res.avant[t] !== 'rouge');
  const vraiment = [];
  for (const t of neufs) { const r = await lancer(process.execPath, ['--test', path.join(APRES, 'scripts', 'tests', t)], APRES, {}, 600e3); if (r.code !== 0) vraiment.push(t); }
  neufs = vraiment;
  const rougesAvant = liste.filter((t) => res.avant[t] === 'rouge');
  rapport.tests = { total: liste.length, rougesAvant, rougesNeufs: neufs };
  if (neufs.length) KO(`tests rouges NEUFS : ${neufs.join(', ')}`);
  else OK(`tests : ${liste.length} lancés, aucun rouge neuf (rouges déjà rouges avant : ${rougesAvant.length}${rougesAvant.length ? ' — ' + rougesAvant.join(', ') : ''})`);
}
async function etapeBancs() {
  const res = {};
  for (const [nom, R] of [['avant', AVANT], ['apres', APRES]]) {
    if (nom === 'avant' && BANCS_AVANT) { res.avant = JSON.parse(fs.readFileSync(BANCS_AVANT, 'utf8')); console.log(`   avant : repris de ${BANCS_AVANT}`); continue; }
    const b = construire(R, path.join(R, 'dist'));
    if (b.erreur) { KO(`build ${nom} (dist/) : ${b.erreur}`); return; }
    const r = await lancer(process.execPath, [path.join(R, 'scripts', 'lancer-bancs.cjs')], R, { BANCS_PORT_BASE: String(PORT0 + (nom === 'avant' ? 0 : 1000)) }, 6 * 3600e3);
    res[nom] = {};
    for (const l of r.sortie.split('\n')) { const m = l.match(/^(OK |KO\*|KO ) (\S+)/); if (m) res[nom][m[2]] = m[1].trim(); }
    fs.writeFileSync(path.join(os.tmpdir(), `vrm-decoupe-bancs-${nom}.log`), r.sortie);
    if (nom === 'avant' && GARDER) { fs.mkdirSync(GARDER, { recursive: true }); fs.writeFileSync(path.join(GARDER, `bancs-avant-${teteDe(AVANT).slice(0, 9)}.json`), JSON.stringify(res.avant)); }
  }
  const nouveaux = Object.keys(res.apres).filter((b) => res.apres[b] === 'KO' && res.avant[b] !== 'KO');
  const vraiment = [];
  for (const b of nouveaux) { const r = await lancer(process.execPath, [path.join(APRES, 'scripts', 'lancer-bancs.cjs'), b], APRES, { BANCS_PORT_BASE: String(PORT0 + 2000) }, 3600e3); if (r.code !== 0) vraiment.push(b); }
  const rougesAvant = Object.keys(res.avant).filter((b) => res.avant[b] === 'KO');
  rapport.bancs = { avant: res.avant, apres: res.apres, rougesNeufs: vraiment };
  if (vraiment.length) KO(`bancs rouges NEUFS : ${vraiment.join(', ')} (journaux : ${os.tmpdir()}/vrm-decoupe-bancs-*.log)`);
  else OK(`bancs : ${Object.keys(res.apres).length} lancés, aucun rouge neuf (rouges déjà rouges avant : ${rougesAvant.length}${rougesAvant.length ? ' — ' + rougesAvant.join(', ') : ''})`);
}

(async () => {
  const table = { texte: etapeTexte, structure: etapeStructure, imports: etapeImports, poids: etapePoids, audits: etapeAudits, tests: etapeTests, bancs: etapeBancs };
  for (const e of etapes) { console.log(`\n── ${e}`); try { await table[e](); } catch (err) { KO(`${e} : ${err && err.stack || err}`); } }
  if (RAPPORT) fs.writeFileSync(RAPPORT, JSON.stringify(rapport, null, 2));
  console.log(rouge ? `\n❌ ${rouge} régression(s)` : '\n✅ aucune régression');
  process.exit(rouge ? 1 : 0);
})();
