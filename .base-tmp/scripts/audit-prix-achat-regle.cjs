// ════════════════════════════════════════════════════════════════════════════
//  LA RÈGLE DU PRIX D'ACHAT, CÔTÉ SERVEUR — UNE COPIE FABRIQUÉE (11 nov.)
//  `prixAchatDe` a UN propriétaire : src/App.jsx. Le filet du cron (api/_lib/
//  prix-achat-demande.js) en a besoin sans l'app : api/_lib/prix-achat-regle.js
//  en porte le texte EXACT, fabriqué ici — jamais modifié à la main (CLAUDE.md §5).
//    node scripts/audit-prix-achat-regle.cjs --recopie  → refabrique la copie
//    node scripts/audit-prix-achat-regle.cjs            → rouge si elle diverge, ou si
//                                                         elle ne rend pas les mêmes prix
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), vm = require('vm');
const R = path.join(__dirname, '..');
const APP = path.join(R, 'src', 'App.jsx'), COPIE = path.join(R, 'api', '_lib', 'prix-achat-regle.js');
const NOMS = ['prixAchatDe'];
const extraire = (src, nom) => {
  const i = src.indexOf(`const ${nom} = `);
  if (i < 0) return null;
  const j = src.indexOf('\n};\n', i);
  return j < 0 ? null : src.slice(i, j + 3);
};
const TETE = `// api/_lib/prix-achat-regle.js — FABRIQUÉ par \`node scripts/audit-prix-achat-regle.cjs --recopie\`
// depuis src/App.jsx (le propriétaire de la règle, §11). NE RIEN MODIFIER ICI À LA MAIN :
// modifier App.jsx, puis refabriquer. \`audit-prix-achat-regle.cjs\` rougit si les deux divergent.
/* eslint-disable */
`;
const app = fs.readFileSync(APP, 'utf8');
const decl = NOMS.map((n) => [n, extraire(app, n)]);
if (process.argv.includes('--recopie')) {
  if (decl.some(([, t]) => !t)) { console.log('❌ déclaration introuvable dans App.jsx'); process.exit(1); }
  fs.writeFileSync(COPIE, TETE + decl.map(([, t]) => 'export ' + t).join('\n') + '\n');
  console.log(`✅ copie refabriquée (${NOMS.length} déclaration)`); process.exit(0);
}
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (!c && d ? ' — ' + d : '')); };
const copie = fs.existsSync(COPIE) ? fs.readFileSync(COPIE, 'utf8') : '';
const norm = (t) => String(t || '').replace(/\s+/g, ' ').trim();
for (const [n, t] of decl) {
  const c = extraire(copie, n);
  dit(!!t && !!c && norm(t) === norm(c), `« ${n} » : la copie serveur est le texte EXACT d'App.jsx`, !c ? 'absente de la copie' : 'le code diffère — `--recopie` après avoir vérifié la règle de l’app');
}
// Les mêmes sorties, exécutées des deux côtés.
const run = (t) => { const ctx = vm.createContext({ parseFloat, Number, String }); vm.runInContext(t + '\nthis.f = prixAchatDe;', ctx); return ctx.f; };
const a = decl[0][1] ? run(decl[0][1]) : null, b = extraire(copie, 'prixAchatDe') ? run(extraire(copie, 'prixAchatDe')) : null;
const CAS = [[{ buyPrice: '25,50' }, {}], [{ numero: '124' }, { '124': '30' }], [{ numero: '124', buyPrice: '' }, { '124': '12,5' }], [{ numero: '9' }, {}], [{}, null], [{ buyPrice: 'abc' }, {}]];
dit(!!a && !!b && CAS.every(([f, m]) => JSON.stringify(a(f, m)) === JSON.stringify(b(f, m))), 'les deux rendent les mêmes prix (saisi, par N°, absent, illisible)');
// Le serveur s'en sert vraiment (pas une seconde règle à côté).
const dem = fs.readFileSync(path.join(R, 'api', '_lib', 'prix-achat-demande.js'), 'utf8');
dit(/from '\.\/prix-achat-regle\.js'/.test(dem) && /prixAchatDe\(f, buy\)/.test(dem) && !/parseFloat/.test(dem), 'api/_lib/prix-achat-demande.js lit la copie fabriquée, sans règle écrite à la main');
console.log(ko ? `\n${ko} rouge(s)` : '\nprix-achat-regle : tout vert');
process.exit(ko ? 1 : 0);
