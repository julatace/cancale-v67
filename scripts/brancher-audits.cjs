#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  BRANCHER DES AUDITS SUR LE TEXTE RECOLLÉ (11 nov., découpe 2)
//    node scripts/brancher-audits.cjs audit-a.cjs audit-b.cjs …
//  Un audit qui lit `src/App.jsx` comme TEXTE (regex) cherche du code qui, après la découpe, vit
//  dans src/coeur/ : il rougit sans que rien n'ait changé. Remède documenté par _source-app.cjs :
//  `brancher()` en tête — toute lecture texte d'un …/src/App.jsx rend l'app RECOLLÉE (App.jsx +
//  src/ecrans + src/coeur, le texte d'avant la découpe). Posé seulement hors des modes de preuve
//  (`--prouve`, `MUT=`) : ceux-là ÉCRIVENT le fichier lu, et l'écriture d'un texte recollé dans
//  App.jsx le doublerait.
//  scripts/verifier-decoupe.cjs dit quels audits rougissent seulement pour ça (« lit App.jsx brut »).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const LIGNE = "if (!process.argv.includes('--prouve') && !process.env.MUT) require('./_source-app.cjs').brancher();   // (11 nov., découpe 2) lit l'app RECOLLÉE (scripts/brancher-audits.cjs)";
let n = 0;
for (const a of process.argv.slice(2)) {
  const f = path.join(__dirname, path.basename(a));
  let t = fs.readFileSync(f, 'utf8');
  if (t.includes("require('./_source-app.cjs').brancher()")) { console.log(`· ${path.basename(f)} : déjà branché`); continue; }
  const l = t.split('\n');
  let i = l.findIndex((x) => /^['"]use strict['"];?\s*$/.test(x));
  if (i >= 0) i += 1; else i = l[0].startsWith('#!') ? 1 : 0;
  l.splice(i, 0, LIGNE);
  fs.writeFileSync(f, l.join('\n')); n++;
  console.log(`✅ ${path.basename(f)} : branché (ligne ${i + 1})`);
}
console.log(`${n} audit(s) branché(s)`);
