// ═══════════════════════════════════════════════════════════════════════════
//  Les BANCS lisent « 12 € » à l'espace insécable (6 nov., v36-finition)
//  node scripts/bancs-euro-insecable.cjs [--ecrire] [fichiers…]
// ═══════════════════════════════════════════════════════════════════════════
// Depuis la finition, l'app écrit l'espace avant « € » / « % » en U+00A0 (montant(),
// scripts/typo-insecables.cjs). Un banc qui cherche `/12 €/` dans `innerText` (qui GARDE
// l'U+00A0) ne la trouve plus : il rougirait sur une règle qui n'a pas bougé. Ce script
// relit les bancs par l'arbre syntaxique et, DANS LES EXPRESSIONS RÉGULIÈRES SEULEMENT,
// remplace l'espace avant « € » ou « % » par `\s` (qui accepte l'espace ordinaire ET
// l'insécable) : le banc juge la même règle, il ne dépend plus de l'espace choisie.
// Les chaînes comparées à la lettre (`===`, `includes`) ne sont pas touchées : elles sont
// listées pour être vues une par une.
'use strict';
const fs = require('fs'), path = require('path');
const RACINE = path.join(__dirname, '..');
const parser = require(path.join(RACINE, 'node_modules', '@babel', 'parser'));
const args = process.argv.slice(2);
const ECRIRE = args.includes('--ecrire');
let fichiers = args.filter((a) => !a.startsWith('--')).map((f) => path.resolve(f));
if (!fichiers.length) fichiers = fs.readdirSync(path.join(__dirname, 'bancs')).filter((f) => /\.(c|m)?js$/.test(f)).map((f) => path.join(__dirname, 'bancs', f));
let total = 0;
for (const p of fichiers) {
  const src = fs.readFileSync(p, 'utf8');
  let ast; try { ast = parser.parse(src, { sourceType: 'unambiguous', plugins: ['jsx'], errorRecovery: true }); } catch (e) { console.log('⚠️ illisible', path.relative(RACINE, p)); continue; }
  const pos = [];
  const visite = (n) => {
    if (!n || typeof n.type !== 'string') return;
    if (n.type === 'RegExpLiteral') {
      const corps = src.slice(n.start + 1, n.start + 1 + n.pattern.length);
      const re = /([\d)\]}?*+]) (?=[€%])/g; let m;
      while ((m = re.exec(corps))) pos.push(n.start + 1 + m.index + m[1].length);
    }
    for (const k of Object.keys(n)) { if (/^(loc|start|end|extra|leadingComments|trailingComments|innerComments)$/.test(k)) continue; const v = n[k]; if (Array.isArray(v)) v.forEach((c) => c && typeof c.type === 'string' && visite(c)); else if (v && typeof v.type === 'string') visite(v); }
  };
  visite(ast.program);
  if (!pos.length) continue;
  total += pos.length;
  console.log(`${path.relative(RACINE, p)} : ${pos.length}`);
  if (ECRIRE) { let out = src; for (const i of pos.sort((a, b) => b - a)) out = out.slice(0, i) + '\\s' + out.slice(i + 1); fs.writeFileSync(p, out); }
}
console.log(`${total} expression(s) régulière(s)${ECRIRE ? ' — écrit' : ''}`);
