// (11 nov., familles de l'app) Le banc de MUTATION commun des audits gardiens :
// copie api/ src/ scripts/ dans un dossier temporaire, réaffaiblit UNE règle, relance
// l'audit DANS cette copie (VRM_RACINE) et exige au moins un rouge. Une mutation qui
// survit = un gardien qui ne garde rien (§6 « un contrôle doit ÉCHOUER »).
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

function prouver(script, MUT, R) {
  let tues = 0;
  for (const [nom, fichier, de, vers] of MUT) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-mut-'));
    try {
      for (const d of ['api', 'src', 'scripts']) fs.cpSync(path.join(R, d), path.join(tmp, d), { recursive: true, filter: (s) => !/node_modules|\/fx\//.test(s) });
      try { fs.symlinkSync(path.join(R, 'node_modules'), path.join(tmp, 'node_modules')); } catch (_) {}
      fs.writeFileSync(path.join(tmp, 'package.json'), fs.readFileSync(path.join(R, 'package.json')));
      const f = path.join(tmp, fichier);
      const txt = fs.readFileSync(f, 'utf8');
      if (!txt.includes(de)) { console.log(`❌ mutation « ${nom} » : texte à réaffaiblir introuvable dans ${fichier} (mettre la mutation à jour)`); continue; }
      fs.writeFileSync(f, txt.replace(de, vers));
      const r = spawnSync('node', [path.join(tmp, 'scripts', path.basename(script))], { encoding: 'utf8', env: { ...process.env, VRM_RACINE: tmp } });
      const rouges = ((r.stdout || '').match(/^❌/mg) || []).length;
      console.log(`${rouges ? '✅' : '❌'} mutation « ${nom} » ⇒ ${rouges} contrôle(s) rouge(s)${rouges ? '' : ' — LA MUTATION SURVIT'}`);
      if (rouges) tues++;
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  }
  console.log(`\n${tues}/${MUT.length} mutations tuées`);
  return tues === MUT.length;
}

// Le texte d'un fichier sans ses commentaires (on juge la règle, pas un commentaire).
const sansCommentaires = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

// Tous les fichiers .js/.jsx d'un dossier, récursivement.
function fichiers(dossier, ext = /\.(jsx?|mjs)$/) {
  const out = [];
  const pile = [dossier];
  while (pile.length) {
    const d = pile.pop();
    let noms = [];
    try { noms = fs.readdirSync(d, { withFileTypes: true }); } catch (_) { continue; }
    for (const n of noms) {
      const p = path.join(d, n.name);
      if (n.isDirectory()) { if (n.name !== 'node_modules') pile.push(p); }
      else if (ext.test(n.name)) out.push(p);
    }
  }
  return out.sort();
}

// Une déclaration `const NOM = …;` ou `function NOM(…) {…}` de premier niveau (comme les autres audits).
function extraire(src, nom) {
  const m = new RegExp(`^(?:export )?(?:async )?function ${nom}\\(|^(?:export )?const ${nom}\\s*=\\s*`, 'm').exec(src);
  if (!m) return null;
  // Comptage des parenthèses (la méthode des audits de la compta) : fin d'une fonction à
  // l'accolade qui ferme son corps, fin d'un `const` au « ; » de premier niveau.
  const estFn = /function/.test(m[0]); let prof = 0, vuCorps = false;
  for (let i = m.index; i < src.length; i++) {
    const c = src[i];
    if (c === '(' || c === '[' || c === '{') { prof++; if (c === '{') vuCorps = true; }
    else if (c === ')' || c === ']' || c === '}') { prof--; if (estFn && vuCorps && prof === 0 && c === '}') return src.slice(m.index, i + 1).replace(/^export /, ''); }
    else if (!estFn && c === ';' && prof === 0) return src.slice(m.index, i + 1).replace(/^export /, '');
  }
  return null;
}

module.exports = { prouver, sansCommentaires, fichiers, extraire };
