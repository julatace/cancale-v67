// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : LE MORCEAU App NE REPREND PAS CE QUI DOIT SE CHARGER À LA DEMANDE
//         node scripts/audit-morceau-app.cjs [--prouve]
// ═══════════════════════════════════════════════════════════════════════════
// (17 nov., fiabilité-vitesse — docs/passation/2026-11-17-fiabilite-vitesse.md)
// Le morceau App (src/App.jsx et tout ce qu'il importe EN STATIQUE) est téléchargé et
// compilé à chaque démarrage, avant Ma journée. Mesuré sur main 1a4eb65 : 1 892 Ko
// compressés, dont pdf-lib (≈ 180 Ko) — importé partout « à la demande », mais
// atteint en statique par un chemin de serveur (App.jsx → api/_lib/transporteur-anciens.js
// → transporteur-pdf.js → texte-pdf.js → pdf-lib), ce qui suffit à Rollup pour le coller
// dans App — et 30 blocs et feuilles rares (configuration de départ, calculette,
// impression…) importés en statique. Après : 1 636 Ko.
// Cet audit suit le GRAPHE DES IMPORTS STATIQUES depuis src/App.jsx (Babel, sans build) :
//   1. aucune bibliothèque lourde à la demande n'y est (pdf-lib, pako, three, maplibre-gl,
//      jsqr) — une seule ligne `import … from` suffit à la recoller dans le démarrage ;
//   2. aucun des modules rendus « à la demande » le 17 nov. n'y revient ;
//   3. le graphe se lit (au moins 200 modules : un graphe vide ne prouverait rien).
// `--prouve` : chaque mutation (en mémoire, aucun fichier touché) recolle un import
// statique ; l'audit doit devenir rouge.
'use strict';
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..');
const parser = require(path.join(R, 'node_modules', '@babel', 'parser'));

// Ce qui ne doit JAMAIS entrer dans le morceau App (chargé à la demande ailleurs).
const LOURDS = ['pdf-lib', 'pako', 'three', 'maplibre-gl', 'jsqr', 'qrcode-generator'];   // (17 nov., vitesse-poids) le QR aussi
// Les modules rendus « à la demande » le 17 nov. (aLaDemande, aLaDemandeFeuille, aLaDemandeDiscret).
const A_LA_DEMANDE = [
  'src/ConfigurationDepart.jsx', 'src/CreerSurVinted.jsx', 'src/composants/ImportStock.jsx', 'src/LitigesEnCours.jsx',
  'src/Bienvenue.jsx', 'src/ImpressionSimple.jsx', 'src/ExpliqueMondialRelay.jsx', 'src/MaSemaine.jsx',
  'src/OutilsArticlesVinted.jsx', 'src/composants/CollerPrixAchat.jsx', 'src/BaissesConseillees.jsx', 'src/CalculetteAchat.jsx',
  'src/OuVendre.jsx', 'src/LienVestiaire.jsx', 'src/impression/ApercuAvantImpression.jsx', 'src/DiagnosticLeboncoin.jsx',
  'src/InfosSms.jsx', 'src/AchatsEnDouble.jsx', 'src/RecusEmail.jsx', 'src/AnnoncesACompleter.jsx', 'src/SynchronisationVinted.jsx',
  'src/design/QuiDorment.jsx', 'src/design/QuoiRepublier.jsx', 'src/VuesVentes.jsx',
  'api/_lib/texte-pdf.js',
];

const EXTS = ['', '.js', '.jsx', '.mjs', '/index.js', '/index.jsx'];
function resoudre(depuis, spec) {
  if (!spec.startsWith('.')) return null;
  const base = path.resolve(path.dirname(depuis), spec.split('?')[0]);
  for (const e of EXTS) { const p = base + e; try { if (fs.statSync(p).isFile()) return p; } catch (_) {} }
  return null;
}
// Le graphe statique depuis src/App.jsx. `textes` : { cheminRelatif: texte } pour remplacer un fichier (mutations).
function graphe(textes = {}) {
  const vus = new Set(), paquets = new Set(), pile = [path.join(R, 'src', 'App.jsx')], erreurs = [];
  while (pile.length) {
    const f = pile.pop(); if (vus.has(f)) continue; vus.add(f);
    if (!/\.(m?js|jsx)$/.test(f)) continue;
    const rel = path.relative(R, f);
    let src; try { src = textes[rel] != null ? textes[rel] : fs.readFileSync(f, 'utf8'); } catch (e) { erreurs.push(rel + ' : ' + e.message); continue; }
    let ast; try { ast = parser.parse(src, { sourceType: 'module', plugins: ['jsx'], errorRecovery: true }); } catch (e) { erreurs.push(rel + ' : ' + e.message); continue; }
    for (const s of ast.program.body) {
      const decl = (s.type === 'ImportDeclaration' && s.importKind !== 'type') || ((s.type === 'ExportNamedDeclaration' || s.type === 'ExportAllDeclaration') && s.source);
      if (!decl) continue;
      const spec = s.source.value;
      if (!spec.startsWith('.')) { paquets.add(spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0]); continue; }
      const p = resoudre(f, spec); if (p) pile.push(p);
    }
  }
  return { modules: new Set([...vus].map((f) => path.relative(R, f))), paquets, erreurs };
}

function juger(textes, dire) {
  const g = graphe(textes);
  let ko = 0;
  const dit = (c, m, d) => { if (!c) ko++; if (dire) console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
  dit(g.modules.size >= 200 && !g.erreurs.length, `le graphe des imports statiques de src/App.jsx se lit (${g.modules.size} modules)`, g.erreurs.slice(0, 3).join(' | '));
  const lourds = LOURDS.filter((x) => g.paquets.has(x));
  dit(!lourds.length, 'aucune bibliothèque chargée à la demande (pdf-lib, pako, three, maplibre-gl, jsqr) n\'est importée en statique depuis le morceau App', lourds.join(', ') || 'aucune');
  const revenus = A_LA_DEMANDE.filter((m) => g.modules.has(m));
  dit(!revenus.length, `aucun des ${A_LA_DEMANDE.length} modules chargés à la demande n'est importé en statique depuis le morceau App`, revenus.join(', ') || 'aucun');
  return ko;
}

if (process.argv.includes('--prouve')) {
  const lire = (r) => fs.readFileSync(path.join(R, r), 'utf8');
  const MUTS = [
    ['texte-pdf de nouveau importé en statique par transporteur-pdf', 'api/_lib/transporteur-pdf.js', (s) => "import { texteDuPdf } from './texte-pdf.js';\n" + s],
    ['pdf-lib importé en statique par App.jsx', 'src/App.jsx', (s) => "import { PDFDocument as _P } from 'pdf-lib';\n" + s],
    ['la calculette réimportée en statique', 'src/App.jsx', (s) => "import _Calc from './CalculetteAchat.jsx';\n" + s],
    ['un module à la demande réimporté par un module du morceau', 'src/SanteComptes.jsx', (s) => "import _I from './InfosSms.jsx';\n" + s],
  ];
  let rouges = 0;
  for (const [nom, f, mut] of MUTS) {
    const ko = juger({ [f]: mut(lire(f)) }, false);
    console.log((ko ? '  ✅ ' : '  ❌ ') + `mutation « ${nom} » ⇒ ${ko ? 'rouge' : 'VERT (le contrôle ne la voit pas)'}`);
    if (ko) rouges++;
  }
  const ok = rouges === MUTS.length;
  console.log(ok ? `\n✅ audit-morceau-app --prouve : ${rouges}/${MUTS.length} mutations rouges` : `\n❌ audit-morceau-app --prouve : ${MUTS.length - rouges} mutation(s) restée(s) verte(s)`);
  process.exit(ok ? 0 : 1);
}
const ko = juger({}, true);
console.log(ko ? `\n❌ audit-morceau-app : ${ko} rouge(s)` : '\n✅ audit-morceau-app : le morceau App ne reprend rien de ce qui se charge à la demande');
process.exit(ko ? 1 : 0);
