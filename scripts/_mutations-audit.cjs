// ════════════════════════════════════════════════════════════════════════════
//  LES MUTATIONS D'UN AUDIT (6 nov.) — `--prouve` : chaque mutation réaffaiblit
//  la règle dans une COPIE de l'arbre (api, src, package.json ; node_modules en
//  lien) et relance l'audit dessus (`AUDIT_RACINE`). Une mutation qui reste
//  verte est un contrôle qui ne voit pas ce qu'il prétend garder (§6.1).
//  `MUTATIONS` : { nom: [[fichier, de, vers], …] } (plusieurs remplacements par
//  mutation possibles ; une ancre absente est ROUGE, jamais ignorée).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');

function prouver(fichierAudit, R, MUTATIONS) {
  let ok = 0;
  const noms = Object.keys(MUTATIONS);
  for (const nom of noms) {
    const t = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-v2-'));
    for (const x of ['api', 'src', 'package.json']) fs.cpSync(path.join(R, x), path.join(t, x), { recursive: true });
    fs.symlinkSync(fs.realpathSync(path.join(R, 'node_modules')), path.join(t, 'node_modules'));
    let ancre = true;
    for (const [f, de, vers] of MUTATIONS[nom]) {
      const p = path.join(t, f);
      const src = fs.readFileSync(p, 'utf8');
      if (!src.includes(de)) { ancre = false; console.log(`❌ mutation ${nom} : ancre introuvable dans ${f} — « ${de.slice(0, 70)} »`); break; }
      fs.writeFileSync(p, src.replace(de, vers));
    }
    if (ancre) {
      const r = spawnSync(process.execPath, [fichierAudit], { env: { ...process.env, AUDIT_RACINE: t }, encoding: 'utf8', timeout: 300000 });
      const rouges = ((r.stdout || '').match(/^❌/gm) || []).length;
      const tombe = r.status !== 0 && rouges > 0;
      if (tombe) ok++;
      console.log(`${tombe ? '✅' : '❌'} mutation « ${nom} » ⇒ ${tombe ? rouges + ' rouge(s)' : 'VERTE (le contrôle ne la voit pas)'}`);
    }
    fs.rmSync(t, { recursive: true, force: true });
  }
  console.log(ok === noms.length ? `\n✅ ${ok}/${noms.length} mutations attrapées` : `\n❌ ${noms.length - ok} mutation(s) non attrapée(s)`);
  process.exit(ok === noms.length ? 0 : 1);
}
const sansCommentaires = (t) => t.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
module.exports = { prouver, sansCommentaires };
