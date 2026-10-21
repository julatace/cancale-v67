// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : LE RAPPEL URSSAF À L'ÉCHÉANCE (20 octobre)
//         node scripts/audit-rappel-urssaf.cjs [--mutation=rythme|declare|zero|fenetre]
// ═══════════════════════════════════════════════════════════════════════════
// Le rappel du 30 septembre partait le 1er de chaque mois, quel que soit le
// rythme (trimestriel : deux rappels sur trois pour une déclaration qui n'existe
// pas encore), sans date ni montant, même pour un mois déjà noté « déclaré ».
// Cet audit EXÉCUTE la vraie règle `rappelUrssaf` (extraite d'App.jsx, dans un
// vm) sur des dates et une ligne publiée INVENTÉES. `--mutation=…` réaffaiblit
// la règle : chaque mutation doit faire passer au moins un contrôle au rouge.
const fs = require('fs'), path = require('path'), vm = require('vm');
const R = path.join(__dirname, '..');
let parser;
try { parser = require(path.join(R, 'node_modules', '@babel', 'parser')); }
catch (e) { console.log('❌ l\'analyseur Babel est disponible — ' + e.message); process.exit(1); }
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
let src = require('./_source-app.cjs')(path.join(R, 'src', 'App.jsx'));
const muter = (avant, apres) => { if (!src.includes(avant)) { console.log('❌ mutation impossible : motif absent'); process.exit(2); } src = src.replace(avant, apres); };
if (MUT === 'rythme') muter('if (_startOfDay(now) <= _startOfDay(due.periodEnd)) return null;', '');
else if (MUT === 'declare') muter('yms.every((ym) => moisDeclare(declare, ym))) return null;', 'false) return null;');
else if (MUT === 'zero') muter('if (ligne && Array.isArray(ligne.mois)) {', 'ca = 0; apayer = 0; if (ligne && Array.isArray(ligne.mois)) {');
else if (MUT === 'fenetre') muter('const proche = due.daysLeft <= 7;', 'const proche = false;');
else if (MUT) { console.log('❌ mutation inconnue : ' + MUT); process.exit(2); }

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = (nom, f) => { try { f(); } catch (e) { dit(false, nom, String(e && e.message || e).slice(0, 200)); } };

const ast = parser.parse(src, { sourceType: 'module', plugins: ['jsx'] });
const decl = new Map();
for (const n of ast.program.body) {
  if (n.type === 'VariableDeclaration') for (const v of n.declarations) if (v.id && v.id.name) decl.set(v.id.name, `${n.kind} ${src.slice(v.start, v.end)};`);
  if (n.type === 'FunctionDeclaration' && n.id) decl.set(n.id.name, src.slice(n.start, n.end));
}
const VOULUS = ['_startOfDay', 'nextUrssafDeadline', 'aPayerUrssaf', 'moisDeclare', 'rappelUrssaf'];
const manq = VOULUS.filter((k) => !decl.has(k));
dit(!manq.length, 'la règle `rappelUrssaf` existe dans App.jsx', manq.join(', '));
if (manq.length) { console.log(`\n❌ audit-rappel-urssaf : ${ko} rouge(s)`); process.exit(1); }
const ctx = { tauxUrssaf: () => 13.5, Date, Math, Number, String, Array, isFinite };
vm.createContext(ctx);
vm.runInContext(VOULUS.map((k) => decl.get(k)).join('\n') + '\nthis.rappelUrssaf = rappelUrssaf;', ctx);
const r = (o) => ctx.rappelUrssaf({ taux: 13.5, ...o });
const LIGNE = { mois: [{ ym: '2026-07', ca: 100 }, { ym: '2026-08', ca: 200 }, { ym: '2026-09', ca: 300 }, { ym: '2026-10', ca: 999 }] };

essaie('trimestriel, 1er novembre', () => {
  const x = r({ freq: 'trimestriel', now: new Date(2026, 10, 1, 10) });
  dit(x === null, 'trimestriel en milieu de trimestre : aucun rappel le 1er du mois', x && x.text);
});
essaie('trimestriel, 2 octobre', () => {
  const x = r({ freq: 'trimestriel', now: new Date(2026, 9, 2, 10), ligne: LIGNE });
  dit(!!(x && /T3 2026/.test(x.text) && /31 octobre/.test(x.text)), 'trimestriel, début du mois après le trimestre : rappel daté', x && x.text);
  dit(!!(x && x.ca === 600 && x.apayer === 81), 'le montant somme les mois DE la période seulement (600 € → 81 €)', x && `${x.ca} · ${x.apayer}`);
});
essaie('trimestriel, 15 octobre', () => {
  const x = r({ freq: 'trimestriel', now: new Date(2026, 9, 15, 10) });
  dit(x === null, 'au milieu du mois de déclaration, loin de l\'échéance : rien', x && x.text);
});
essaie('trimestriel, 27 octobre', () => {
  const x = r({ freq: 'trimestriel', now: new Date(2026, 9, 27, 10), ligne: LIGNE });
  dit(!!(x && x.proche && /dans 4 jours/.test(x.text)), 'les 7 derniers jours avant l\'échéance : rappel avec le délai', x && x.text);
});
essaie('déjà déclarée', () => {
  const declare = { '2026-07': { ids: [] }, '2026-08': { ids: [] }, '2026-09': { ids: ['v:1'] } };
  const x = r({ freq: 'trimestriel', now: new Date(2026, 9, 27, 10), declare });
  dit(x === null, 'les trois mois notés « déclaré » : plus de rappel', x && x.text);
  const y = r({ freq: 'trimestriel', now: new Date(2026, 9, 27, 10), declare: { '2026-09': { ids: [] } } });
  dit(!!y, 'un seul mois noté sur trois : le rappel reste');
});
essaie('mensuel', () => {
  const x = r({ freq: 'mensuel', now: new Date(2026, 9, 1, 10), ligne: LIGNE });
  dit(!!(x && /septembre 2026/.test(x.text) && x.ca === 300), 'mensuel, le 1er : septembre à déclarer, 300 €', x && x.text);
  dit(r({ freq: 'mensuel', now: new Date(2026, 9, 12, 10) }) === null, 'mensuel, le 12 : rien');
});
essaie('pas de ligne publiée', () => {
  const x = r({ freq: 'mensuel', now: new Date(2026, 9, 1, 10), ligne: null });
  dit(!!(x && x.apayer == null && x.ca == null && !/0,00/.test(x.sub)), 'sans ligne publiée : aucun montant, jamais 0', x && x.sub);
});
essaie('ventes à dater', () => {
  const x = r({ freq: 'mensuel', now: new Date(2026, 9, 1, 10), ligne: { ...LIGNE, aDater: { n: 2 } } });
  dit(!!(x && x.partiel && /au moins/i.test(x.sub)), 'des ventes sans date de versement : « au moins »', x && x.sub);
});
const code = require('./_source-app.cjs')(path.join(R, 'src', 'App.jsx'));
dit(!/Nouveau mois : pense à ta déclaration URSSAF/.test(code), 'l\'ancien rappel fixe du 1er du mois a disparu');
dit(/rappelUrssaf\(\{\s*freq:/.test(code), 'le centre de notifications appelle `rappelUrssaf`');
console.log(ko ? `\n❌ audit-rappel-urssaf : ${ko} rouge(s)` : '\n✅ audit-rappel-urssaf : tout vert');
process.exit(ko ? 1 : 0);
