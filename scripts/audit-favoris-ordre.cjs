#!/usr/bin/env node
// 5.440.2 (Julien, 24 nov. : « traite d'abord les favoris dont la ligne est visible, puis va chercher les plus anciens »)
// La file part des favoris les PLUS RÉCENTS (date de leur notification chez Vinted), puis les plus anciens ; une date
// inconnue garde sa place, après les datés ; tri stable. La route `lancer` (`api/_lib/favoris.js`) l'applique aux cibles
// résolues, avant `lancerFile`. `--mutation=sans-tri` : la route ne trie plus ⇒ rouge.
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..');
const mut = (process.argv.find((x) => x.startsWith('--mutation=')) || '').slice(11);
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d ? '  → ' + d : '')); } };
(async () => {
  const F = await import(pathToFileURL(path.join(RACINE, 'api', '_lib', 'favoris-file.js')).href);
  const t = (n) => ({ notificationId: n });
  const dates = { a: '2026-11-22T10:00:00Z', b: '2026-11-24T00:58:13Z', c: null, d: '2026-11-23T21:30:21Z', e: '2026-11-23T21:30:21Z' };
  const o = F.ordreRecents([t('a'), t('b'), t('c'), t('d'), t('e')], (x) => dates[x.notificationId]).map((x) => x.notificationId).join('');
  dit(o === 'bdeac', 'du plus récent au plus ancien ; à date égale l’ordre d’avant ; sans date à la fin', o);
  dit(F.ordreRecents([], () => null).length === 0 && F.ordreRecents(null, () => null).length === 0, 'liste vide ou absente ⇒ vide, sans erreur');
  // La route applique le tri aux cibles résolues, juste avant `lancerFile` (lecture du code : la fonction serverless a son propre chemin).
  let src = fs.readFileSync(path.join(RACINE, 'api', '_lib', 'favoris.js'), 'utf8');
  if (mut === 'sans-tri') src = src.replace(/targets=ordreRecents\([^\n]*\n/, '\n');
  const iTri = src.indexOf('targets=ordreRecents(targets,'), iLancer = src.indexOf('decision=d=>lancerFile(d,{owner,targets,');
  dit(iTri > 0 && iLancer > iTri && /parId\.get\(t\.notificationId\)/.test(src.slice(iTri, iTri + 200)), 'la route « lancer » trie les cibles par la date de LEUR notification avant de créer la file');
  console.log(ko ? `❌ audit-favoris-ordre : ${ko} rouge(s)` : `✅ audit-favoris-ordre : ${ok} vert(s), 0 rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
