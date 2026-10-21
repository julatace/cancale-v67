// ════════════════════════════════════════════════════════════════════════════
//  LE SOURCE D'App.jsx « D'UN SEUL TENANT », pour les audits (21 octobre).
//
//  Depuis « app plus rapide », les écrans rares vivent dans src/ecrans/*.jsx
//  (découpés par scripts/decouper-app.cjs, chargés à la demande). Leur code est
//  celui d'App.jsx, sans changement — mais un audit qui cherche une règle ou une
//  phrase DANS App.jsx ne l'y trouve plus, et sortirait rouge sur un code intact
//  (ou, pire, vert parce qu'il ne regarde plus rien).
//  `sourceApp(cheminApp)` rend App.jsx PLUS le code des écrans découpés, recollé
//  comme si le fichier n'avait jamais été coupé :
//    · les lignes `const X = paresseux(() => import('./ecrans/…'), 'X');` et les
//      blocs d'export « Lu par src/ecrans/… » d'App.jsx sont retirés ;
//    · de chaque écran : l'import d'App.jsx est retiré, les imports déjà faits par
//      App.jsx aussi (même nom local), les autres sont gardés avec le chemin
//      d'App.jsx (`../x` → `./x`), et l'`export { … }` final est retiré.
//  Le résultat est un module VALIDE (un seul exemplaire de chaque nom) : un
//  audit peut le lire, l'analyser avec Babel ou en extraire une fonction.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
function nomsImportes(texte) {
  const s = new Set();
  for (const m of texte.matchAll(/^import\s+([^;]*?)\s+from\s+["'][^"']+["'];?/gm)) {
    const t = m[1];
    const def = t.match(/^([A-Za-z_$][\w$]*)/); if (def && !t.startsWith('{') && !t.startsWith('*')) s.add(def[1]);
    const ns = t.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/); if (ns) s.add(ns[1]);
    const br = t.match(/\{([^}]*)\}/); if (br) for (const x of br[1].split(',')) { const p = x.trim().split(/\s+as\s+/); const n = (p[1] || p[0]).trim(); if (n) s.add(n); }
  }
  return s;
}
function sourceApp(cheminApp) {
  const app = fs.readFileSync(cheminApp, 'utf8');
  const dir = path.join(path.dirname(cheminApp), 'ecrans');
  let fichiers = [];
  try { fichiers = fs.readdirSync(dir).filter((f) => f.endsWith('.jsx')).sort(); } catch (_) { return app; }
  if (!fichiers.length) return app;
  let base = app
    .replace(/\n\/\/ [A-Za-z0-9_$]+ : chargé à la demande \(src\/ecrans\/[^)]+\)\.\nconst [A-Za-z0-9_$]+ = paresseux\(\(\) => import\('\.\/ecrans\/[^']+'\), '[A-Za-z0-9_$]+'\);/g, '')
    .replace(/\n\n\/\/ Lu par src\/ecrans[^\n]*\nexport \{[^}]*\};\n?/g, '\n');
  const deja = nomsImportes(base);
  let suite = '';
  for (const f of fichiers) {
    let t = fs.readFileSync(path.join(dir, f), 'utf8');
    t = t.replace(/^import \{[^}]*\} from "\.\.\/App\.jsx";\n/m, '');
    t = t.replace(/^import\s+([^;]*?)\s+from\s+(["'])([^"']+)\2;\n/gm, (m, quoi, q, src) => {
      const chemin = src.startsWith('../') ? './' + src.slice(3) : src;
      const parts = [];
      const def = quoi.match(/^([A-Za-z_$][\w$]*)/);
      if (def && !quoi.startsWith('{') && !quoi.startsWith('*') && !deja.has(def[1])) parts.push(def[1]);
      const ns = quoi.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/);
      if (ns && !deja.has(ns[1])) parts.push(`* as ${ns[1]}`);
      const br = quoi.match(/\{([^}]*)\}/);
      if (br) { const garde = br[1].split(',').map((x) => x.trim()).filter(Boolean).filter((x) => { const p = x.split(/\s+as\s+/); return !deja.has((p[1] || p[0]).trim()); }); if (garde.length) parts.push(`{ ${garde.join(', ')} }`); }
      nomsImportes(m).forEach((n) => deja.add(n));
      return parts.length ? `import ${parts.join(', ')} from ${q}${chemin}${q};\n` : '';
    });
    t = t.replace(/\n\nexport \{[^}]*\};\n?\s*$/, '\n');
    suite += `\n\n// ── recollé depuis src/ecrans/${f} (scripts/_source-app.cjs) ──\n` + t;
  }
  return base + suite;
}
module.exports = sourceApp;
module.exports.sourceApp = sourceApp;
